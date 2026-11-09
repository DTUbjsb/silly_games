export class QuestManager {
  constructor() {
    this.quests = new Map();
    this.activeQuestIds = new Set();
    this.loadPromise = null;
  }

  async loadQuests() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchQuests();
    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async fetchQuests() {
    const manifestUrl = new URL('../data/quests/index.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Kunne ikke indlæse opgavelisten (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.quests) || manifest.quests.length === 0) {
      throw new Error('Opgavelisten skal indeholde mindst én opgavefil.');
    }

    const quests = await Promise.all(manifest.quests.map(async (filename) => {
      if (typeof filename !== 'string' || !/^[\w-]+\.json$/i.test(filename)) {
        throw new Error(`Ugyldigt filnavn til opgave: ${filename}`);
      }

      const response = await fetch(new URL(filename, manifestUrl));
      if (!response.ok) {
        throw new Error(`Kunne ikke indlæse opgaven "${filename}" (${response.status}).`);
      }

      return this.validateQuest(await response.json(), filename);
    }));

    const loadedQuests = new Map();
    for (const quest of quests) {
      if (loadedQuests.has(quest.id)) {
        throw new Error(`Opgave-id'et "${quest.id}" findes flere gange.`);
      }
      loadedQuests.set(quest.id, quest);
    }

    this.quests = loadedQuests;
    return Array.from(this.quests.values(), (quest) => ({ ...quest }));
  }

  validateQuest(quest, filename) {
    const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
    if (
      !quest
      || !hasText(quest.id)
      || !hasText(quest.title)
      || !hasText(quest.description)
      || !hasText(quest.reward)
      || typeof quest.completed !== 'boolean'
    ) {
      throw new Error(
        `Opgaven "${filename}" skal indeholde id, title, description, reward og completed.`,
      );
    }

    return {
      id: quest.id.trim(),
      title: quest.title.trim(),
      description: quest.description.trim(),
      reward: quest.reward.trim(),
      completed: quest.completed,
    };
  }

  acceptQuest(questId) {
    const quest = this.quests.get(questId);
    if (!quest) {
      throw new Error(`Opgaven "${questId}" findes ikke.`);
    }
    if (quest.completed) {
      throw new Error(`Opgaven "${questId}" er allerede gennemført.`);
    }
    if (this.activeQuestIds.has(questId)) {
      throw new Error(`Opgaven "${questId}" er allerede accepteret.`);
    }

    this.activeQuestIds.add(questId);
    return { ...quest };
  }

  getQuest(questId) {
    const quest = this.quests.get(questId);
    return quest ? { ...quest } : undefined;
  }

  completeQuest(questId) {
    const quest = this.quests.get(questId);
    if (!quest) {
      throw new Error(`Opgaven "${questId}" findes ikke.`);
    }
    if (!this.activeQuestIds.has(questId)) {
      throw new Error(`Opgaven "${questId}" er ikke accepteret.`);
    }

    quest.completed = true;
    this.activeQuestIds.delete(questId);
    return { ...quest };
  }

  getActiveQuests() {
    return Array.from(this.activeQuestIds, (id) => ({ ...this.quests.get(id) }));
  }
}
