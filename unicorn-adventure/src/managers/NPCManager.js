export class NPCManager {
  constructor(scene, {
    questManager,
    challengeManager,
    dialogueWindow,
    onChallenge,
    onBridgeOpen,
  }) {
    this.scene = scene;
    this.questManager = questManager;
    this.challengeManager = challengeManager;
    this.dialogueWindow = dialogueWindow;
    this.onChallenge = onChallenge;
    this.onBridgeOpen = onBridgeOpen;
    this.npcs = [];
    this.activeNPC = null;
    this.loadPromise = null;

    this.interactionPrompt = scene.add.text(400, 520, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#294c5b',
      backgroundColor: '#ffffffdd',
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6).setVisible(false);
  }

  async loadNPCs() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchNPCs();
    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async fetchNPCs() {
    await Promise.all([
      this.questManager.loadQuests(),
      this.challengeManager.loadChallenges(),
    ]);
    const manifestUrl = new URL('../data/npcs/index.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Kunne ikke indlæse personlisten (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.npcs) || manifest.npcs.length === 0) {
      throw new Error('Personlisten skal indeholde mindst én personfil.');
    }

    const records = await Promise.all(manifest.npcs.map(async (filename) => {
      if (typeof filename !== 'string' || !/^[\w-]+\.json$/i.test(filename)) {
        throw new Error(`Ugyldigt filnavn til person: ${filename}`);
      }

      const response = await fetch(new URL(filename, manifestUrl));
      if (!response.ok) {
        throw new Error(`Kunne ikke indlæse personen "${filename}" (${response.status}).`);
      }

      return this.validateNPC(await response.json(), filename);
    }));

    const loadedNPCs = new Map();
    for (const record of records) {
      if (loadedNPCs.has(record.id)) {
        throw new Error(`Person-id'et "${record.id}" findes flere gange.`);
      }
      loadedNPCs.set(record.id, record);
    }

    this.npcs = Array.from(loadedNPCs.values(), (record) => this.createNPC(record));
    return this.npcs.map(({ sprite, nameTag, ...npc }) => ({ ...npc }));
  }

  validateNPC(npc, filename) {
    const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
    if (
      !npc
      || !hasText(npc.id)
      || !hasText(npc.name)
      || !hasText(npc.avatar)
      || !Number.isFinite(npc.x)
      || !Number.isFinite(npc.y)
      || !Array.isArray(npc.interactions)
      || npc.interactions.length === 0
      || !hasText(npc.repeatDialogue)
    ) {
      throw new Error(
        `Personen "${filename}" skal have id, name, avatar, position, interactions og repeatDialogue.`,
      );
    }
    if (!this.scene.textures.exists(npc.avatar)) {
      throw new Error(`Personens avatar "${npc.avatar}" er ikke indlæst.`);
    }

    return {
      id: npc.id.trim(),
      name: npc.name.trim(),
      avatar: npc.avatar.trim(),
      x: npc.x,
      y: npc.y,
      interactionRadius: Number.isFinite(npc.interactionRadius)
        ? Math.max(1, npc.interactionRadius)
        : 112,
      repeatDialogue: npc.repeatDialogue.trim(),
      interactions: npc.interactions.map((interaction, index) => (
        this.validateInteraction(interaction, filename, index)
      )),
    };
  }

  validateInteraction(interaction, filename, index) {
    const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
    if (interaction?.type === 'dialogue') {
      if (
        !Array.isArray(interaction.lines)
        || interaction.lines.length === 0
        || !interaction.lines.every(hasText)
      ) {
        throw new Error(`Dialogen ${index + 1} i "${filename}" skal have mindst én tekstlinje.`);
      }
      return { type: 'dialogue', lines: interaction.lines.map((line) => line.trim()) };
    }

    if (interaction?.type === 'quest' && hasText(interaction.questId)) {
      const quest = this.questManager.getQuest(interaction.questId.trim());
      if (!quest) {
        throw new Error(`Personen "${filename}" henviser til en ukendt opgave.`);
      }
      if (!this.challengeManager.getChallenge(quest.challengeId)) {
        throw new Error(`Opgaven "${quest.id}" henviser til en ukendt læringsudfordring.`);
      }
      return { type: 'quest', questId: interaction.questId.trim() };
    }

    if (interaction?.type === 'challenge' && hasText(interaction.challengeId)) {
      const challengeId = interaction.challengeId.trim();
      if (!this.challengeManager.getChallenge(challengeId)) {
        throw new Error(`Personen "${filename}" henviser til en ukendt læringsudfordring.`);
      }
      if (interaction.opensBridge !== undefined && typeof interaction.opensBridge !== 'boolean') {
        throw new Error(`Personen "${filename}" skal angive, om broen åbnes, med true eller false.`);
      }
      return {
        type: 'challenge',
        challengeId,
        opensBridge: interaction.opensBridge ?? false,
      };
    }

    throw new Error(`Ugyldig interaktion ${index + 1} i "${filename}".`);
  }

  createNPC(record) {
    const sprite = this.scene.add.image(record.x, record.y, record.avatar)
      .setScale(0.72)
      .setDepth(2);
    const nameTag = this.scene.add.text(record.x, record.y - sprite.displayHeight / 2 - 7, record.name, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#294c5b',
      backgroundColor: '#ffffffdd',
      padding: { x: 7, y: 4 },
    }).setOrigin(0.5, 1).setDepth(4);

    return { ...record, sprite, nameTag, interactionIndex: 0 };
  }

  update(leader, blocked = false) {
    this.activeNPC = null;
    if (!blocked && leader) {
      this.activeNPC = this.npcs
        .map((npc) => ({
          npc,
          distance: Phaser.Math.Distance.Between(
            leader.sprite.x,
            leader.sprite.y,
            npc.x,
            npc.y,
          ),
        }))
        .filter(({ npc, distance }) => distance <= npc.interactionRadius)
        .sort((a, b) => a.distance - b.distance)[0]?.npc ?? null;
    }

    this.npcs.forEach((npc) => {
      npc.nameTag.setPosition(npc.x, npc.y - npc.sprite.displayHeight / 2 - 7);
    });

    this.interactionPrompt
      .setText(this.activeNPC ? `Tryk SPACE for at tale med ${this.activeNPC.name}` : '')
      .setVisible(Boolean(this.activeNPC));
  }

  interact() {
    const npc = this.activeNPC;
    if (!npc || this.dialogueWindow.isOpen) {
      return false;
    }

    this.runInteraction(npc);
    return true;
  }

  runInteraction(npc) {
    const interaction = npc.interactions[npc.interactionIndex];
    if (!interaction) {
      this.dialogueWindow.showLines(npc.name, [npc.repeatDialogue]);
      return;
    }

    if (interaction.type === 'dialogue') {
      this.dialogueWindow.showLines(npc.name, interaction.lines, () => {
        this.advanceInteraction(npc);
        if (npc.interactions[npc.interactionIndex]?.type === 'challenge') {
          this.runInteraction(npc);
        }
      });
      return;
    }

    if (interaction.type === 'quest') {
      this.offerQuest(npc, interaction.questId);
      return;
    }

    this.startChallenge(npc, interaction.challengeId);
  }

  startChallenge(npc, challengeId) {
    this.onChallenge(challengeId, () => {
      const activeQuest = this.questManager.getActiveQuests()
        .find((quest) => quest.challengeId === challengeId);
      if (activeQuest) {
        this.questManager.completeQuest(activeQuest.id);
      }

      const interaction = npc.interactions[npc.interactionIndex];
      if (interaction?.type === 'challenge' && interaction.challengeId === challengeId) {
        this.advanceInteraction(npc);
        if (interaction.opensBridge) {
          if (typeof this.onBridgeOpen !== 'function') {
            throw new Error('Der mangler en handling til at åbne broen.');
          }
          this.onBridgeOpen();
        }
      }

      if (activeQuest) {
        this.dialogueWindow.showLines(npc.name, [`Tak for hjælpen! Opgaven "${activeQuest.title}" er løst.`]);
      }
    });
  }

  offerQuest(npc, questId) {
    const quest = this.questManager.getQuest(questId);
    if (quest.completed) {
      this.advanceInteraction(npc);
      this.dialogueWindow.showLines(npc.name, [`Opgaven "${quest.title}" er allerede løst.`]);
      return;
    }

    if (this.questManager.getActiveQuests().some((activeQuest) => activeQuest.id === questId)) {
      this.advanceInteraction(npc);
      this.startChallenge(npc, quest.challengeId);
      return;
    }

    this.dialogueWindow.showQuestOffer(npc.name, quest, (accepted) => {
      if (!accepted) {
        this.dialogueWindow.showLines(npc.name, ['Det er helt i orden. Du kan spørge igen senere.']);
        return;
      }

      this.questManager.acceptQuest(questId);
      this.advanceInteraction(npc);
      const nextInteraction = npc.interactions[npc.interactionIndex];
      if (
        nextInteraction?.type === 'challenge'
        && nextInteraction.challengeId === quest.challengeId
      ) {
        this.runInteraction(npc);
      } else {
        this.startChallenge(npc, quest.challengeId);
      }
    });
  }

  advanceInteraction(npc) {
    npc.interactionIndex += 1;
  }
}
