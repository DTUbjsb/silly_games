import {
  TEST_WORLD_DATA,
  TEST_WORLD_TILE_SIZE,
  WORLD_GATES,
  WORLD_TILE,
  WEST_CRACK,
  WEST_REGION_DATA,
  WEST_REGION_WIDTH,
} from '../data/testWorld.js';
import { CollectibleManager } from '../managers/CollectibleManager.js';
import { EducationalChallengeManager } from '../managers/EducationalChallengeManager.js';
import { GameStateManager } from '../managers/GameStateManager.js';
import { NPCManager } from '../managers/NPCManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { QuestManager } from '../managers/QuestManager.js';
import { LeaderFollowerSystem } from '../systems/LeaderFollowerSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { DialogueWindow } from '../ui/DialogueWindow.js';
import { Hud } from '../ui/Hud.js';

const STABLE_ENTRANCE = { x: 160, y: 160 };

export class MainWorldScene extends Phaser.Scene {
  constructor() {
    super('MainWorldScene');
  }

  create() {
    // The scene assembles a tile world and focused systems; map data and player entities stay reusable.
    this.createWorldTileset();
    this.worldMap = this.make.tilemap({
      data: TEST_WORLD_DATA,
      tileWidth: TEST_WORLD_TILE_SIZE,
      tileHeight: TEST_WORLD_TILE_SIZE,
    });
    const tileset = this.worldMap.addTilesetImage(
      'world-tiles',
      'world-tiles',
      TEST_WORLD_TILE_SIZE,
      TEST_WORLD_TILE_SIZE,
      0,
      0,
    );
    this.worldLayer = this.worldMap.createLayer(0, tileset, 0, 0).setDepth(-1);
    const westWidth = WEST_REGION_WIDTH * TEST_WORLD_TILE_SIZE;
    this.westMap = this.make.tilemap({
      data: WEST_REGION_DATA,
      tileWidth: TEST_WORLD_TILE_SIZE,
      tileHeight: TEST_WORLD_TILE_SIZE,
    });
    const westTileset = this.westMap.addTilesetImage('world-tiles', 'world-tiles', TEST_WORLD_TILE_SIZE, TEST_WORLD_TILE_SIZE, 0, 0);
    this.westLayer = this.westMap.createLayer(0, westTileset, -westWidth, 0).setDepth(-1);
    this.westMap.setCollision([
      WORLD_TILE.WEST_WALL, WORLD_TILE.WATER, WORLD_TILE.FOREST,
      WORLD_TILE.WEST_BRIDGE, WORLD_TILE.WEST_FOREST_GATE,
    ]);
    this.worldMap.setCollision([
      WORLD_TILE.WATER,
      WORLD_TILE.FOREST,
      WORLD_TILE.BRIDGE,
      WORLD_TILE.FLORA_GATE,
      WORLD_TILE.LUNA_GATE,
      WORLD_TILE.SECOND_BRIDGE,
    ]);
    this.physics.world.setBounds(-westWidth, 0, this.worldMap.widthInPixels + westWidth, this.worldMap.heightInPixels);

    this.stateManager = null;
    this.lastNPCChallenges = new Map();
    this.isAnswering = false;
    this.failedPickup = null;
    this.lastFootstepPosition = null;
    this.nextFootstepTime = 0;
    this.input.keyboard.on('keydown', this.handleKeyboardInput, this);

    this.playerManager = new PlayerManager(this);
    this.collectibleManager = new CollectibleManager(this);
    this.questManager = new QuestManager();
    this.challengeManager = new EducationalChallengeManager();
    this.player = null;
    this.players = [];
    this.leaderFollowerSystem = null;
    this.movement = null;
    this.cameras.main.setBounds(-westWidth, 0, this.worldMap.widthInPixels + westWidth, this.worldMap.heightInPixels);
    this.cameras.main.setZoom(0.65);

    this.hud = new Hud(this);
    this.dialogueWindow = new DialogueWindow(this);
    this.npcManager = new NPCManager(this, {
      questManager: this.questManager,
      challengeManager: this.challengeManager,
      dialogueWindow: this.dialogueWindow,
      onChallenge: (challengeId, onCorrect, miniGame, options) => this.startNPCChallenge(challengeId, onCorrect, miniGame, options),
      gateIds: Object.keys(WORLD_GATES),
      onGateOpen: (gateId) => this.openGate(gateId),
    });
    this.playerStatus = this.add.text(400, 300, 'Indlæser spilverdenen...', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '20px',
      color: '#294c5b',
      backgroundColor: '#ffffffdd',
      padding: { x: 14, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6);

    this.add.rectangle(STABLE_ENTRANCE.x, STABLE_ENTRANCE.y - 36, 124, 92, 0xc98e69)
      .setStrokeStyle(4, 0x855b47).setDepth(1);
    this.add.triangle(STABLE_ENTRANCE.x, STABLE_ENTRANCE.y - 96, 0, 40, 70, 0, 140, 40, 0x9b6b85)
      .setDepth(1);
    this.add.rectangle(STABLE_ENTRANCE.x, STABLE_ENTRANCE.y - 18, 38, 56, 0x76513f).setDepth(1);
    this.add.text(STABLE_ENTRANCE.x, STABLE_ENTRANCE.y - 56, 'STALD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);
    this.stablePrompt = this.add.text(400, 520, 'Tryk MELLEMRUM for at gå ind i stalden', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: '#294c5b', backgroundColor: '#ffffffdd', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6).setVisible(false);
    this.crackPrompt = this.add.text(400, 520, 'Tryk MELLEMRUM for at undersøge revnen', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: '#294c5b', backgroundColor: '#ffffffdd', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6).setVisible(false);
    this.createWestCrack();

    const camera = this.cameras.main;
    // Cancel camera zoom for screen-space UI while leaving world-space labels in the world.
    this.ui = this.add.container(
      camera.width / 2 * (1 - 1 / camera.zoom),
      camera.height / 2 * (1 - 1 / camera.zoom),
      [
        this.npcManager.interactionPrompt, this.stablePrompt, this.crackPrompt,
        this.dialogueWindow.background, this.dialogueWindow.speaker, this.dialogueWindow.message,
        this.dialogueWindow.prompt, this.dialogueWindow.continueButton,
        this.dialogueWindow.acceptButton, this.dialogueWindow.laterButton, this.playerStatus,
      ],
    ).setScrollFactor(0).setScale(1 / camera.zoom).setDepth(5);

    this.loadPlayers();
  }

  update(time, delta) {
    if (!this.leaderFollowerSystem) {
      return;
    }

    const leader = this.leaderFollowerSystem.leader;
    if (this.failedPickup && Phaser.Math.Distance.Between(
      leader.sprite.x, leader.sprite.y, this.failedPickup.x, this.failedPickup.y,
    ) > 110) {
      this.failedPickup = null;
    }
    const nearStable = this.isNearStable();
    const nearCrack = this.isNearWestCrack();
    this.stablePrompt.setVisible(
      nearStable && !this.isAnswering && !this.dialogueWindow.isOpen,
    );
    this.crackPrompt.setVisible(
      nearCrack && !nearStable && !this.isAnswering && !this.dialogueWindow.isOpen,
    );
    this.npcManager.update(
      leader,
      this.isAnswering || this.dialogueWindow.isOpen || nearStable || nearCrack,
    );

    if (!this.isAnswering && !this.dialogueWindow.isOpen) {
      this.movement.update();
    } else {
      this.leaderFollowerSystem.leader.sprite.setVelocity(0, 0);
    }
    this.updateFootsteps(time, leader);
    const followers = this.leaderFollowerSystem.players.slice(1).map((player) => ({
      sprite: player.sprite, x: player.sprite.x, y: player.sprite.y,
    }));
    this.leaderFollowerSystem.update(delta);
    for (const follower of followers) {
      const { sprite } = follower;
      if (leader.sprite.x < 0) {
        this.constrainWestFollower(sprite, follower.x, follower.y);
      }
      if (leader.sprite.x >= 0 && sprite.body.left < 0) {
        sprite.x -= sprite.body.left;
        sprite.body.updateFromGameObject();
      } else if (leader.sprite.x < 0 && sprite.body.right > -TEST_WORLD_TILE_SIZE) {
        sprite.x -= sprite.body.right + TEST_WORLD_TILE_SIZE;
        sprite.body.updateFromGameObject();
      }
    }
    this.playerManager.update();
  }

  constrainWestFollower(sprite, startX, startY) {
    const targetX = sprite.x;
    const targetY = sprite.y;
    const steps = Math.max(1, Math.ceil(Phaser.Math.Distance.Between(startX, startY, targetX, targetY) / 8));
    let safeX = startX;
    let safeY = startY;
    for (let step = 1; step <= steps; step += 1) {
      sprite.setPosition(
        Phaser.Math.Linear(startX, targetX, step / steps),
        Phaser.Math.Linear(startY, targetY, step / steps),
      );
      sprite.body.updateFromGameObject();
      if (this.westLayer.getTilesWithinWorldXY(
        sprite.body.left, sprite.body.top, sprite.body.width, sprite.body.height, { isColliding: true },
      ).length > 0) {
        break;
      }
      safeX = sprite.x;
      safeY = sprite.y;
    }
    sprite.setPosition(safeX, safeY);
    sprite.body.updateFromGameObject();
  }

  updateFootsteps(time, leader) {
    const sprite = leader.sprite;
    const previous = this.lastFootstepPosition;
    if (previous && previous.id === leader.id
      && !this.isAnswering && !this.dialogueWindow.isOpen
      && sprite.body.velocity.lengthSq() > 0
      && Phaser.Math.Distance.Between(sprite.x, sprite.y, previous.x, previous.y) > 0.01
      && time >= this.nextFootstepTime) {
      this.registry.get('soundEffects').play('footstep');
      this.nextFootstepTime = time + 300;
    }
    this.lastFootstepPosition = { id: leader.id, x: sprite.x, y: sprite.y };
  }

  handleKeyboardInput(event) {
    if (event.repeat) {
      return;
    }

    if (event.code === 'Space' || event.keyCode === Phaser.Input.Keyboard.KeyCodes.SPACE) {
      this.handleSpace();
    }
  }

  handleSpace() {
    if (!this.leaderFollowerSystem || this.dialogueWindow.isOpen) {
      return;
    }

    if (!this.isAnswering) {
      if (this.isNearStable()) {
        this.enterStable();
      } else if (this.isNearWestCrack()) {
        this.interactWithWestCrack();
      } else {
        this.npcManager.interact();
      }
    }
  }

  isNearStable() {
    return Boolean(this.player && Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, STABLE_ENTRANCE.x, STABLE_ENTRANCE.y,
    ) <= 100);
  }

  isNearWestCrack() {
    return Boolean(this.player && Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, WEST_CRACK.x, WEST_CRACK.y,
    ) <= WEST_CRACK.radius);
  }

  interactWithWestCrack() {
    const unicorns = this.collectibleManager.getCollectedCount('unicorn');
    const accessories = this.collectibleManager.getCollectedItems('accessory');
    const saddles = accessories.filter((item) => item.slot === 'saddle').length;
    const wings = accessories.filter((item) => item.slot === 'wings').length;
    if (unicorns < 2 || saddles < 2 || wings < 2) {
      this.dialogueWindow.showLines('Den lysende revne', [
        'Kom tilbage med to enhjørninger, to sadler og to sæt vinger. Så kan I måske flyve over revnen.',
      ]);
      return;
    }
    this.dialogueWindow.showChoice('Den lysende revne',
      'I har to enhjørninger, to sadler og to sæt vinger. Tør I flyve over revnen?',
      'Vil I prøve at flyve?', (accepted) => {
        if (accepted) {
          this.startNPCChallenge(null, () => this.crossWestWall(), 'flight',
            { randomForPlayer: true, npcId: 'west-crack' });
        }
      });
  }

  crossWestWall() {
    const goingWest = this.player.sprite.x >= 0;
    this.leaderFollowerSystem.players.forEach((player, index) => {
      const x = goingWest ? -90 - index * 110 : 58 + index * 110;
      player.sprite.body.reset(x, WEST_CRACK.y);
    });
    this.leaderFollowerSystem.setLeader(this.player.id);
    this.playerManager.update();
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  createWestCrack() {
    const crack = this.add.graphics().setPosition(WEST_CRACK.x, WEST_CRACK.y).setDepth(1);
    const points = [[-4, -112], [6, -85], [-5, -63], [5, -42], [-7, -18], [6, 8],
      [-5, 32], [6, 54], [-4, 78], [3, 110]];
    for (const [width, color, alpha] of [[22, 0x8edfff, 0.18], [12, 0xaaf2ff, 0.4], [4, 0xffffff, 1]]) {
      crack.lineStyle(width, color, alpha);
      crack.beginPath();
      crack.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => crack.lineTo(x, y));
      crack.strokePath();
    }
    this.tweens.add({ targets: crack, alpha: 0.6, duration: 1000, yoyo: true, repeat: -1 });
  }

  enterStable() {
    if (!this.leaderFollowerSystem || this.isAnswering || this.dialogueWindow.isOpen) {
      return;
    }
    const players = this.leaderFollowerSystem.players.map((player) => ({
      id: player.id, name: player.name, age: player.age,
      avatar: player.avatar, hairColor: player.hairColor,
    }));
    this.player.sprite.setVelocity(0, 0);
    this.scene.launch('StableScene', {
      players,
      unicorns: this.collectibleManager.getCollectedItems('unicorn'),
      accessories: this.collectibleManager.getCollectedItems('accessory'),
      collection: this.collectibleManager,
    });
    this.scene.pause();
  }

  resetProgress() {
    if (this.isAnswering || this.dialogueWindow.isOpen) {
      return;
    }
    if (!window.confirm(
      'Vil du nulstille spillet? Alle indsamlede enhjørninger og alt tilbehør slettes, og eventyret starter forfra.',
    )) {
      return;
    }
    try {
      this.collectibleManager.store.save(new Set(), new Map());
    } catch (error) {
      console.error('Kunne ikke nulstille spillet.', error);
      this.dialogueWindow.showLines('Nulstil spil', [
        `${error.message} Spillet er ikke nulstillet. Prøv igen.`,
      ]);
      return;
    }
    this.scene.restart();
  }

  loadPlayers() {
    Promise.all([
      this.playerManager.loadPlayers(),
      this.collectibleManager.loadCollectibles(),
      this.questManager.loadQuests(),
      this.challengeManager.loadChallenges(),
      this.npcManager.loadNPCs(),
    ])
      .then(([profiles]) => {
        if (!this.sys.isActive()) {
          return;
        }

        this.stateManager = new GameStateManager();
        this.updateCollectionProgress();

        this.players = profiles.map((profile, index) => this.playerManager.addPlayer(
          profile.id,
          { x: 300 + (index % 3) * 80, y: 240 + Math.floor(index / 3) * 90 },
        ));
        this.leaderFollowerSystem = new LeaderFollowerSystem(this.players);
        this.player = this.leaderFollowerSystem.leader;
        this.movement = new MovementSystem(this, this.player.sprite);
        this.players.forEach((player) => {
          this.physics.add.collider(player.sprite, this.worldLayer);
          this.physics.add.collider(player.sprite, this.westLayer);
          this.physics.add.overlap(
            player.sprite,
            this.collectibleManager.pickups,
            this.collectWorldItem,
            undefined,
            this,
          );
        });
        this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
        this.hud.setTurn(this.player.name);
        this.input.keyboard.on('keydown-T', this.swapLeader, this);
        this.playerStatus.destroy();
      })
      .catch((error) => {
        if (!this.sys.isActive()) {
          return;
        }
        console.error('Kunne ikke indlæse spilverdenens data.', error);
        this.playerStatus.setText(`Kunne ikke indlæse spilverdenen: ${error.message}`);
      });
  }

  swapLeader() {
    if (!this.leaderFollowerSystem) {
      return false;
    }

    const nextLeader = this.leaderFollowerSystem.swapLeader();
    if (!nextLeader) {
      return false;
    }

    this.applyLeader(nextLeader);
    this.hud.showTurnChange(nextLeader.name);
    return true;
  }

  setLeader(id) {
    this.applyLeader(this.leaderFollowerSystem.setLeader(id));
  }

  applyLeader(leader) {
    this.player = leader;
    this.movement.setPlayer(leader.sprite);
    this.cameras.main.startFollow(leader.sprite, true, 0.08, 0.08);
    this.hud.setTurn(leader.name);
  }

  createWorldTileset() {
    const tileSize = TEST_WORLD_TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    graphics.fillStyle(0xa6dfa9).fillRect(tileSize * WORLD_TILE.GRASS, 0, tileSize, tileSize);
    graphics.fillStyle(0x91cf9a).fillCircle(7, 9, 1.5).fillCircle(24, 25, 1.5);

    graphics.fillStyle(0xe5cf9c).fillRect(tileSize * WORLD_TILE.PATH, 0, tileSize, tileSize);
    graphics.fillStyle(0xd0b77e).fillCircle(39, 8, 1.5).fillCircle(55, 24, 1.5);

    graphics.fillStyle(0xa6dfa9).fillRect(tileSize * WORLD_TILE.FLOWERS, 0, tileSize, tileSize);
    graphics.fillStyle(0xfff0a8).fillCircle(72, 13, 3);
    graphics.fillStyle(0xf39fbd).fillCircle(82, 13, 3);
    graphics.fillStyle(0xffffff).fillCircle(77, 8, 3);
    graphics.fillStyle(0xffdb72).fillCircle(77, 13, 2);

    graphics.fillStyle(0x83cfe0).fillRect(tileSize * WORLD_TILE.WATER, 0, tileSize, tileSize);
    graphics.lineStyle(2, 0xb7e8e8, 0.9);
    graphics.beginPath();
    graphics.moveTo(98, 12);
    graphics.lineTo(106, 12);
    graphics.moveTo(115, 23);
    graphics.lineTo(124, 23);
    graphics.strokePath();

    graphics.fillStyle(0x31734f).fillRect(tileSize * WORLD_TILE.FOREST, 0, tileSize, tileSize);
    graphics.fillStyle(0x245d40).fillCircle(132, 10, 9).fillCircle(149, 10, 10);
    graphics.fillStyle(0x4c9660).fillCircle(140, 7, 10).fillCircle(155, 18, 8);
    graphics.fillStyle(0x75563a).fillRect(138, 19, 6, 12);

    for (const bridge of [WORLD_TILE.BRIDGE, WORLD_TILE.SECOND_BRIDGE, WORLD_TILE.WEST_BRIDGE]) {
      graphics.fillStyle(0x94643f).fillRect(tileSize * bridge, 0, tileSize, tileSize);
      graphics.fillStyle(0x67452f)
        .fillRect(tileSize * bridge, 2, tileSize, 3)
        .fillRect(tileSize * bridge, 14, tileSize, 3)
        .fillRect(tileSize * bridge, 27, tileSize, 3);
      graphics.fillStyle(0xb38257)
        .fillRect(tileSize * bridge, 6, tileSize, 2)
        .fillRect(tileSize * bridge, 19, tileSize, 2);
    }

    for (const [tile, color] of [
      [WORLD_TILE.FLORA_GATE, 0xe58faa],
      [WORLD_TILE.LUNA_GATE, 0xa59add],
      [WORLD_TILE.WEST_FOREST_GATE, 0x70c9b8],
    ]) {
      const x = tileSize * tile;
      graphics.fillStyle(0x31734f).fillRect(x, 0, tileSize, tileSize);
      graphics.fillStyle(color).fillRect(x + 2, 0, tileSize - 4, tileSize);
      graphics.lineStyle(3, 0xffe6a3);
      graphics.strokeRect(x + 4, 3, tileSize - 8, tileSize - 6);
      graphics.fillStyle(0xfff0a8).fillCircle(x + 16, 16, 4);
    }

    const wallX = tileSize * WORLD_TILE.WEST_WALL;
    graphics.fillStyle(0x596378).fillRect(wallX, 0, tileSize, tileSize);
    graphics.lineStyle(2, 0x344256);
    graphics.strokeRect(wallX, 0, tileSize, tileSize);
    graphics.lineBetween(wallX, 15, wallX + tileSize, 15);
    graphics.lineBetween(wallX + 16, 0, wallX + 16, 15);
    graphics.lineBetween(wallX + 8, 15, wallX + 8, tileSize);
    graphics.lineBetween(wallX + 24, 15, wallX + 24, tileSize);
    graphics.generateTexture('world-tiles', tileSize * (WORLD_TILE.WEST_FOREST_GATE + 1), tileSize);
    graphics.destroy();
  }

  collectWorldItem(playerSprite, pickup) {
    if (
      this.isAnswering
      || this.dialogueWindow.isOpen
      || this.failedPickup === pickup
      || playerSprite !== this.leaderFollowerSystem?.leader.sprite
    ) {
      return;
    }

    const item = this.collectibleManager.getItemForPickup(pickup);
    if (!item) {
      return;
    }

    if (item.type === 'accessory') {
      this.collectPickup(pickup);
      return;
    }

    let challenge;
    try {
      challenge = this.getPlayerChallenge();
    } catch (error) {
      console.error('Kunne ikke finde en udfordring til enhjørningen.', error);
      this.failedPickup = pickup;
      this.dialogueWindow.showLines('Enhjørningen', [
        `${error.message} Gå væk og prøv igen.`,
      ]);
      return;
    }
    this.registry.get('soundEffects').play('unicorn');
    this.startChallenge(challenge, () => this.collectPickup(pickup));
  }

  collectPickup(pickup) {
    let item;
    try {
      item = this.collectibleManager.collect(pickup);
    } catch (error) {
      console.error('Kunne ikke gemme samlingen.', error);
      this.failedPickup = pickup;
      this.dialogueWindow.showLines('Samlingen', [
        `${error.message} Gå væk og prøv igen, eller kontrollér browserens lager.`,
      ]);
      return;
    }
    if (!item) {
      return;
    }

    if (item.type === 'accessory' && item.slot === 'wings') {
      this.registry.get('soundEffects').play('wings');
    } else if (item.id === 'accessory-crown') {
      this.registry.get('soundEffects').play('crown');
    }
    this.updateCollectionProgress();
    if (item.type === 'accessory' && this.stateManager.recordAccessory(this.leaderFollowerSystem.leader.id)) {
      this.swapLeader();
    }
  }

  updateCollectionProgress() {
    this.hud.setCollectionProgress(
      this.collectibleManager.getCollectedCount('unicorn'),
      this.collectibleManager.getTotalCount('unicorn'),
      this.collectibleManager.getCollectedItems('accessory'),
      this.collectibleManager.getAllItems().filter((item) => item.type === 'accessory'),
    );
  }

  getPlayerChallenge(extraExcludedIds = []) {
    return this.challengeManager.getChallengeForAge(
      this.leaderFollowerSystem.leader.age,
      [...this.stateManager.getLearnedChallengeIds(), ...extraExcludedIds],
      this.npcManager.getGateChallengeIds(),
    );
  }

  startNPCChallenge(challengeId, onCorrect, miniGame, options = {}) {
    let challenge;
    if (options.randomForPlayer) {
      try {
        const previous = this.lastNPCChallenges.get(options.npcId);
        challenge = this.getPlayerChallenge(previous ? [previous] : []);
      } catch (error) {
        console.error('Kunne ikke finde et spørgsmål til udfordringen.', error);
        this.dialogueWindow.showLines('Udfordringen', [`${error.message} Prøv igen senere.`]);
        return;
      }
      this.lastNPCChallenges.set(options.npcId, challenge.id);
    } else {
      challenge = this.challengeManager.getChallenge(challengeId);
    }
    if (!challenge) {
      throw new Error(`Læringsudfordringen "${challengeId}" findes ikke.`);
    }

    this.startChallenge(challenge, onCorrect, miniGame);
  }

  openGate(gateId) {
    const tile = WORLD_GATES[gateId];
    if (tile === undefined) {
      throw new Error(`Ukendt adgang: "${gateId}".`);
    }
    const map = ['westBridge', 'westForest'].includes(gateId) ? this.westMap : this.worldMap;
    map.setCollision(tile, false);
    if (![WORLD_TILE.BRIDGE, WORLD_TILE.SECOND_BRIDGE, WORLD_TILE.WEST_BRIDGE].includes(tile)) {
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.getTileAt(x, y)?.index === tile) {
            map.putTileAt(WORLD_TILE.PATH, x, y);
          }
        }
      }
    }
  }

  startChallenge(challenge, onCorrect = null, miniGame = undefined) {
    this.isAnswering = true;
    const playerId = this.leaderFollowerSystem.leader.id;
    const complete = () => {
      this.isAnswering = false;
      this.stateManager.learn(challenge.id);
      onCorrect?.();
      if (this.stateManager.recordQuestion(playerId)) {
        this.swapLeader();
      }
    };
    this.scene.launch('ChallengeScene', {
      challenge,
      evaluateAnswer: (answer) => this.challengeManager.evaluateAnswer(challenge.id, answer),
      onComplete: (isCorrect) => {
        if (isCorrect) {
          if (miniGame === 'mosquito' || miniGame === 'troll' || miniGame === 'flight') {
            const trollGame = miniGame === 'troll';
            const flightGame = miniGame === 'flight';
            const unicorns = this.collectibleManager.getCollectedItems('unicorn');
            const accessories = this.collectibleManager.getCollectedItems('accessory');
            this.scene.launch(flightGame ? 'FlightScene' : trollGame ? 'TrollScene' : 'MosquitoScene', {
              player: { name: this.player.name, avatar: this.player.avatar },
              ...(flightGame ? {
                players: this.leaderFollowerSystem.players.map((player) => ({ name: player.name, avatar: player.avatar })),
                unicorns: unicorns.slice(0, 2),
                saddles: accessories.filter((item) => item.slot === 'saddle').slice(0, 2),
                wings: accessories.filter((item) => item.slot === 'wings').slice(0, 2),
                goingWest: this.player.sprite.x >= 0,
              } : {}),
              onComplete: (won) => {
                if (won) {
                  complete();
                  if (!this.dialogueWindow.isOpen) {
                    this.dialogueWindow.showLines(flightGame ? 'Flyveturen' : trollGame ? 'Troldens æbler' : 'Myggejagten', [
                      flightGame ? 'Flot! I fløj over revnen sammen.'
                        : trollGame ? 'Flot! Du samlede syv æbler, og broen er åben.'
                        : 'Flot! Du ramte 10 myg, og stien til skoven er åben.',
                    ]);
                  }
                } else {
                  this.isAnswering = false;
                  this.swapLeader();
                  this.dialogueWindow.showLines(flightGame ? 'Flyveturen' : trollGame ? 'Troldens æbler' : 'Myggejagten', [
                    flightGame ? 'I mistede alle fem liv. Prøv spørgsmålet og flyveturen igen!'
                      : trollGame ? 'Du blev ramt af tre sten. Prøv troldens spørgsmål og æblejagten igen!'
                      : 'For mange myg slap forbi. Prøv feens spørgsmål og myggejagten igen!',
                  ]);
                }
              },
            });
            return false;
          }
          complete();
        } else {
          this.isAnswering = false;
        }
      },
    });
    this.scene.pause();
  }

}
