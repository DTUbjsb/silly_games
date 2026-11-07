import {
  TEST_WORLD_DATA,
  TEST_WORLD_TILE_SIZE,
  WORLD_GATES,
  WORLD_TILE,
  WEST_CRACK,
  WEST_REGION_DATA,
  WEST_REGION_WIDTH,
  NORTH_HOLE,
  NORTH_REGION_DATA,
  NORTH_REGION_HEIGHT,
  EAST_ORIGIN,
  EAST_PASS,
  EAST_REGION_WIDTH,
  EAST_REGION_DATA,
} from '../data/testWorld.js';
import { CollectibleManager } from '../managers/CollectibleManager.js';
import { EducationalChallengeManager } from '../managers/EducationalChallengeManager.js';
import { GameStateManager } from '../managers/GameStateManager.js';
import { NPCManager } from '../managers/NPCManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { QuestManager } from '../managers/QuestManager.js';
import { LeaderFollowerSystem } from '../systems/LeaderFollowerSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { NorthFollowerNavigator } from '../systems/NorthFollowerNavigator.js';
import { VolcanoCatRoam } from '../systems/VolcanoCatRoam.js';
import { DialogueWindow } from '../ui/DialogueWindow.js';
import { Hud } from '../ui/Hud.js';
import { newLayoutSeed } from '../data/collectibleLayout.js';

const STABLE_ENTRANCE = { x: 160, y: 160 };
const ACCESSORY_PICKUP_SOUNDS = {
  crown: 'crown',
  saddle: 'saddlePickup',
  sticker: 'stickerPickup',
  wings: 'wings',
};

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
    const northHeight = (NORTH_REGION_HEIGHT + 1) * TEST_WORLD_TILE_SIZE;
    this.northMap = this.make.tilemap({
      data: NORTH_REGION_DATA, tileWidth: TEST_WORLD_TILE_SIZE, tileHeight: TEST_WORLD_TILE_SIZE,
    });
    const northTileset = this.northMap.addTilesetImage('world-tiles', 'world-tiles', TEST_WORLD_TILE_SIZE, TEST_WORLD_TILE_SIZE, 0, 0);
    this.northLayer = this.northMap.createLayer(0, northTileset, -westWidth, -northHeight).setDepth(-1);
    this.northMap.setCollision([WORLD_TILE.WEST_WALL, WORLD_TILE.DARK_TREE, WORLD_TILE.NORTH_FOREST_GATE]);
    this.eastMap = this.make.tilemap({ data: EAST_REGION_DATA, tileWidth: TEST_WORLD_TILE_SIZE, tileHeight: TEST_WORLD_TILE_SIZE });
    const eastTileset = this.eastMap.addTilesetImage('world-tiles', 'world-tiles', TEST_WORLD_TILE_SIZE, TEST_WORLD_TILE_SIZE, 0, 0);
    this.eastLayer = this.eastMap.createLayer(0, eastTileset, EAST_ORIGIN, 0).setDepth(-1);
    this.eastMap.setCollision([WORLD_TILE.WEST_WALL, WORLD_TILE.VOLCANIC_ROCK, WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B]);
    this.eastNorthWall = this.add.rectangle(EAST_ORIGIN + EAST_REGION_WIDTH * 16, -16, EAST_REGION_WIDTH * 32, 32, 0x513136);
    this.physics.add.existing(this.eastNorthWall, true);
    this.northFollowerNavigators = new Map();
    this.eastFollowerNavigators = new Map();
    this.worldMusicRegion = null;
    this.worldMusicBeat = 0;
    this.nextWorldMusicTime = 0;
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
    this.physics.world.setBounds(-westWidth, -northHeight, this.worldMap.widthInPixels + westWidth + EAST_REGION_WIDTH * 32, this.worldMap.heightInPixels + northHeight);

    this.stateManager = null;
    this.lastNPCChallenges = new Map();
    this.isAnswering = false;
    this.failedPickup = null;
    this.lastFootstepPosition = null;
    this.nextFootstepTime = 0;
    this.witchTimeRemaining = this.nextWitchDelay();
    this.wasInNorth = false;
    this.eruptionTimeRemaining = this.nextWitchDelay();
    this.wasInVolcano = false;
    this.volcanoCatRoam = null;
    this.catMeowTimeRemaining = null;
    this.input.keyboard.on('keydown', this.handleKeyboardInput, this);

    this.playerManager = new PlayerManager(this);
    this.collectibleManager = new CollectibleManager(this);
    this.questManager = new QuestManager();
    this.challengeManager = new EducationalChallengeManager();
    this.player = null;
    this.players = [];
    this.leaderFollowerSystem = null;
    this.movement = null;
    this.cameras.main.setBounds(-westWidth, -northHeight, this.worldMap.widthInPixels + westWidth + EAST_REGION_WIDTH * 32, this.worldMap.heightInPixels + northHeight);
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
    this.holePrompt = this.add.text(400, 520, 'Tryk MELLEMRUM for at undersøge hullet', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: '#294c5b', backgroundColor: '#ffffffdd', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6).setVisible(false);
    this.createNorthHole();
    this.eastPrompt = this.add.text(400, 520, 'Tryk MELLEMRUM for at undersøge lavakløften', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: '#294c5b', backgroundColor: '#ffffffdd', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6).setVisible(false);
    this.add.ellipse(EAST_PASS.x, EAST_PASS.y, 52, 140, 0xf4732e)
      .setStrokeStyle(6, 0xffc767).setDepth(1).setName('east-lava-pass');
    this.witchAppearance = this.add.image(400, 310, 'witch')
      .setScale(1.2).setScrollFactor(0).setDepth(7).setVisible(false);

    const camera = this.cameras.main;
    // Cancel camera zoom for screen-space UI while leaving world-space labels in the world.
    this.ui = this.add.container(
      camera.width / 2 * (1 - 1 / camera.zoom),
      camera.height / 2 * (1 - 1 / camera.zoom),
      [
        this.npcManager.interactionPrompt, this.stablePrompt, this.crackPrompt, this.holePrompt, this.eastPrompt, this.witchAppearance,
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
    const cat = this.npcManager.npcs.find((npc) => npc.id === 'volcano-cat');
    if (cat && !this.volcanoCatRoam) this.volcanoCatRoam = new VolcanoCatRoam(cat);
    if (this.volcanoCatRoam && !cat.following && !this.isAnswering && !this.dialogueWindow.isOpen) {
      this.volcanoCatRoam.update(delta);
    }
    if (cat?.following && !this.isAnswering && !this.dialogueWindow.isOpen) this.updateCatMeow(delta);
    this.updateWorldMusic(time, leader);
    this.updateWitchEncounter(delta, leader);
    this.updateEruptionEncounter(delta, leader);
    if (this.failedPickup && Phaser.Math.Distance.Between(
      leader.sprite.x, leader.sprite.y, this.failedPickup.x, this.failedPickup.y,
    ) > 110) {
      this.failedPickup = null;
    }
    const nearStable = this.isNearStable();
    const nearCrack = this.isNearWestCrack();
    const nearHole = this.isNearNorthHole();
    const nearEast = this.isNearEastPass();
    this.stablePrompt.setVisible(
      nearStable && !this.isAnswering && !this.dialogueWindow.isOpen,
    );
    this.crackPrompt.setVisible(
      nearCrack && !nearStable && !this.isAnswering && !this.dialogueWindow.isOpen,
    );
    this.holePrompt.setVisible(
      nearHole && !nearStable && !nearCrack && !this.isAnswering && !this.dialogueWindow.isOpen,
    );
    this.eastPrompt.setVisible(nearEast && !this.isAnswering && !this.dialogueWindow.isOpen);
    this.npcManager.update(
      leader,
      this.isAnswering || this.dialogueWindow.isOpen || nearStable || nearCrack || nearHole || nearEast,
    );

    if (!this.isAnswering && !this.dialogueWindow.isOpen) {
      this.movement.update();
    } else {
      this.leaderFollowerSystem.leader.sprite.setVelocity(0, 0);
    }
    this.updateFootsteps(time, leader);
    const followers = this.leaderFollowerSystem.followers.map((player, index) => ({
      sprite: player.sprite, x: player.sprite.x, y: player.sprite.y,
      distance: this.leaderFollowerSystem.spacing * (index + 1),
    }));
    this.leaderFollowerSystem.update(delta);
    for (const follower of followers) {
      const { sprite } = follower;
      if (leader.sprite.x >= EAST_ORIGIN && leader.sprite.y >= 0) {
        const attemptedX = sprite.x;
        const attemptedY = sprite.y;
        this.constrainFollowerToLayer(sprite, follower.x, follower.y, this.eastLayer);
        let navigator = this.eastFollowerNavigators.get(sprite);
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, attemptedX, attemptedY) > 0.1 || navigator?.active) {
          if (!navigator) {
            navigator = new NorthFollowerNavigator(this.eastLayer, {
              minY: 0, maxY: this.worldMap.heightInPixels, lastRowBlocked: false,
            });
            this.eastFollowerNavigators.set(sprite, navigator);
          }
          sprite.setPosition(follower.x, follower.y);
          sprite.body.updateFromGameObject();
          navigator.update(sprite, this.leaderFollowerSystem.getTrailPosition(follower.distance), time, delta);
        }
      } else {
        this.eastFollowerNavigators.get(sprite)?.reset();
      }
      if (leader.sprite.y < 0 || follower.y < 0) {
        const attemptedX = sprite.x;
        const attemptedY = sprite.y;
        this.constrainFollowerToLayer(sprite, follower.x, follower.y, this.northLayer);
        let navigator = this.northFollowerNavigators.get(sprite);
        const blocked = Phaser.Math.Distance.Between(sprite.x, sprite.y, attemptedX, attemptedY) > 0.1;
        if (blocked || navigator?.active) {
          if (!navigator) {
            navigator = new NorthFollowerNavigator(this.northLayer);
            this.northFollowerNavigators.set(sprite, navigator);
          }
          sprite.setPosition(follower.x, follower.y);
          sprite.body.updateFromGameObject();
          navigator.update(sprite, this.leaderFollowerSystem.getTrailPosition(follower.distance), time, delta);
        }
      } else {
        this.northFollowerNavigators.get(sprite)?.reset();
      }
      if (leader.sprite.y >= 0 && leader.sprite.x < 0) {
        this.constrainWestFollower(sprite, follower.x, follower.y);
      }
      if (leader.sprite.y >= 0 && sprite.body.top < 0) {
        sprite.y -= sprite.body.top;
        sprite.body.updateFromGameObject();
      } else if (leader.sprite.y < 0 && sprite.body.bottom > -TEST_WORLD_TILE_SIZE) {
        sprite.y -= sprite.body.bottom + TEST_WORLD_TILE_SIZE;
        sprite.body.updateFromGameObject();
      }
      if (leader.sprite.y >= 0 && leader.sprite.x >= 0 && sprite.body.left < 0) {
        sprite.x -= sprite.body.left;
        sprite.body.updateFromGameObject();
      } else if (leader.sprite.y >= 0 && leader.sprite.x < 0 && sprite.body.right > -TEST_WORLD_TILE_SIZE) {
        sprite.x -= sprite.body.right + TEST_WORLD_TILE_SIZE;
        sprite.body.updateFromGameObject();
      }
      if (leader.sprite.y >= 0 && leader.sprite.x < EAST_ORIGIN && sprite.body.right > EAST_ORIGIN) {
        sprite.x -= sprite.body.right - EAST_ORIGIN;
        sprite.body.updateFromGameObject();
      } else if (leader.sprite.y >= 0 && leader.sprite.x >= EAST_ORIGIN && sprite.body.left < EAST_ORIGIN + 32) {
        sprite.x += EAST_ORIGIN + 32 - sprite.body.left;
        sprite.body.updateFromGameObject();
      }
    }
    this.playerManager.update();
  }

  captureCat() {
    const cat = this.npcManager.npcs.find((npc) => npc.id === 'volcano-cat');
    if (!cat || cat.following) throw new Error('Ildkatten kan ikke slutte sig til gruppen.');
    this.physics.add.existing(cat.sprite);
    cat.sprite.body.setSize(32, 28);
    cat.sprite.body.setCollideWorldBounds(true);
    cat.following = true;
    cat.nameTag.setVisible(false);
    this.leaderFollowerSystem.addCompanion(cat);
    this.catMeowTimeRemaining = Phaser.Math.Between(10000, 15000);
  }

  updateCatMeow(delta) {
    this.catMeowTimeRemaining -= delta;
    if (this.catMeowTimeRemaining <= 0) {
      this.registry.get('soundEffects').play('catMeow');
      this.catMeowTimeRemaining = Phaser.Math.Between(10000, 15000);
    }
  }

  moveCompanionsAcrossWall() {
    this.leaderFollowerSystem.companions.forEach((companion) => {
      companion.sprite.body.reset(this.player.sprite.x, this.player.sprite.y);
    });
    this.northFollowerNavigators.forEach((navigator) => navigator.reset());
    this.eastFollowerNavigators.forEach((navigator) => navigator.reset());
  }

  constrainWestFollower(sprite, startX, startY) {
    this.constrainFollowerToLayer(sprite, startX, startY, this.westLayer);
  }

  updateWorldMusic(time, leader) {
    const region = leader.sprite.x >= EAST_ORIGIN && leader.sprite.y >= 0 ? 'volcano'
      : leader.sprite.y < -TEST_WORLD_TILE_SIZE ? 'north'
      : leader.sprite.y >= 0 && leader.sprite.y < 32 * TEST_WORLD_TILE_SIZE && leader.sprite.x >= 0
        ? 'start' : null;
    if (region !== this.worldMusicRegion) {
      this.worldMusicRegion = region;
      this.worldMusicBeat = 0;
      this.nextWorldMusicTime = time;
    }
    if (!region || time < this.nextWorldMusicTime) return;
    const melody = region === 'volcano' ? ['worldVolcanoLow', 'worldVolcanoHigh', 'worldVolcanoHigh', 'worldVolcanoLow']
      : region === 'north'
      ? ['worldDarkLow', 'worldDarkHigh', 'worldDarkMid', 'worldDarkHigh']
      : ['worldHappyC', 'worldHappyE', 'worldHappyG', 'worldHappyE', 'worldHappyF', 'worldHappyA', 'worldHappyG', 'worldHappyE'];
    this.registry.get('soundEffects').play(melody[this.worldMusicBeat++ % melody.length]);
    this.nextWorldMusicTime = time + (region === 'volcano' ? 500 : region === 'north' ? 650 : 350);
  }

  nextWitchDelay() {
    return Phaser.Math.Between(30000, 60000);
  }

  updateEruptionEncounter(delta, leader) {
    const inVolcano = leader.sprite.x >= EAST_ORIGIN + 32 && leader.sprite.y >= 0;
    if (!inVolcano) {
      if (this.wasInVolcano) this.eruptionTimeRemaining = this.nextWitchDelay();
      this.wasInVolcano = false;
      return;
    }
    this.wasInVolcano = true;
    if (this.isAnswering || this.dialogueWindow.isOpen) return;
    this.eruptionTimeRemaining -= delta;
    if (this.eruptionTimeRemaining > 0) return;
    this.eruptionTimeRemaining = this.nextWitchDelay();
    leader.sprite.setVelocity(0, 0);
    this.dialogueWindow.showLines('Vulkanen', ['Vulkanen vågner! Besvar spørgsmålet og undgå gløderne.'], () => {
      this.startNPCChallenge(null, null, 'volcanoEruption', { randomForPlayer: true, npcId: 'eruption' });
    });
  }

  updateWitchEncounter(delta, leader) {
    const inNorth = leader.sprite.y < -TEST_WORLD_TILE_SIZE;
    if (!inNorth) {
      if (this.wasInNorth) this.witchTimeRemaining = this.nextWitchDelay();
      this.wasInNorth = false;
      return;
    }
    this.wasInNorth = true;
    if (this.isAnswering || this.dialogueWindow.isOpen) return;
    this.witchTimeRemaining -= delta;
    if (this.witchTimeRemaining > 0) return;
    this.witchTimeRemaining = this.nextWitchDelay();
    leader.sprite.setVelocity(0, 0);
    this.witchAppearance.setVisible(true);
    this.registry.get('soundEffects').play('trollMusicHigh');
    this.dialogueWindow.showLines('Heksen', [
      'Nu har jeg fundet dig! Svar på mit spørgsmål og find ud af min labyrint.',
    ], () => {
      this.witchAppearance.setVisible(false);
      this.startNPCChallenge(null, null, 'witch', { randomForPlayer: true, npcId: 'witch' });
    });
  }

  constrainFollowerToLayer(sprite, startX, startY, layer) {
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
      if (layer.getTilesWithinWorldXY(
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
      } else if (this.isNearNorthHole()) {
        this.interactWithNorthHole();
      } else if (this.isNearEastPass()) {
        this.interactWithEastPass();
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

  isNearNorthHole() {
    return Boolean(this.player && Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, NORTH_HOLE.x, NORTH_HOLE.y,
    ) <= NORTH_HOLE.radius);
  }

  isNearEastPass() {
    return Boolean(this.player && Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, EAST_PASS.x, EAST_PASS.y,
    ) <= EAST_PASS.radius);
  }

  interactWithEastPass() {
    const accessories = this.collectibleManager.getCollectedItems('accessory');
    if (this.collectibleManager.getCollectedCount('unicorn') < 2
      || accessories.filter((item) => item.slot === 'saddle').length < 2
      || accessories.filter((item) => item.slot === 'wings').length < 2) {
      this.dialogueWindow.showLines('Lavakløften', ['Kom tilbage med to enhjørninger, to sadler og to sæt vinger.']);
      return;
    }
    this.dialogueWindow.showChoice('Lavakløften', 'Tør I bygge en bro over lavakløften?',
      'Vil I prøve?', (accepted) => {
        if (accepted) this.startNPCChallenge(null, () => this.crossEastPass(), 'volcanoBridge',
          { randomForPlayer: true, npcId: 'east-pass' });
      });
  }

  crossEastPass() {
    const east = this.player.sprite.x < EAST_ORIGIN;
    this.leaderFollowerSystem.players.forEach((player, index) => {
      player.sprite.body.reset(east ? EAST_ORIGIN + 90 + index * 110 : EAST_ORIGIN - 58 - index * 110, EAST_PASS.y);
    });
    this.moveCompanionsAcrossWall();
    this.leaderFollowerSystem.setLeader(this.player.id);
    this.eastFollowerNavigators.forEach((navigator) => navigator.reset());
    this.playerManager.update();
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  interactWithNorthHole() {
    const unicorns = this.collectibleManager.getCollectedCount('unicorn');
    const accessories = this.collectibleManager.getCollectedItems('accessory');
    if (unicorns < 2 || accessories.filter((item) => item.slot === 'saddle').length < 2
      || accessories.filter((item) => item.slot === 'wings').length < 2) {
      this.dialogueWindow.showLines('Hullet i muren', [
        'Kom tilbage med to enhjørninger, to sadler og to sæt vinger. Så kan I undersøge hulen sammen.',
      ]);
      return;
    }
    this.dialogueWindow.showChoice('Hullet i muren',
      'Bag hullet venter en mørk hule. Tør I gå igennem sammen?',
      'Vil I prøve at krydse hulen?', (accepted) => {
        if (accepted) {
          this.startNPCChallenge(null, () => this.crossNorthWall(), 'cave',
            { randomForPlayer: true, npcId: 'north-hole' });
        }
      });
  }

  crossNorthWall() {
    this.northFollowerNavigators.forEach((navigator) => navigator.reset());
    const goingNorth = this.player.sprite.y >= 0;
    this.leaderFollowerSystem.players.forEach((player, index) => {
      player.sprite.body.reset(NORTH_HOLE.x, goingNorth ? -90 - index * 110 : 58 + index * 110);
    });
    this.moveCompanionsAcrossWall();
    this.leaderFollowerSystem.setLeader(this.player.id);
    this.playerManager.update();
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  createNorthHole() {
    const hole = this.add.graphics().setPosition(NORTH_HOLE.x, NORTH_HOLE.y).setDepth(1).setName('north-hole');
    hole.fillStyle(0x28252c).fillEllipse(0, 0, 108, 48);
    hole.lineStyle(5, 0x7d7a80).strokeEllipse(0, 0, 108, 48);
    hole.fillStyle(0x8cdbb5, 0.65).fillCircle(-20, -3, 3).fillCircle(22, 5, 2);
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
    this.northFollowerNavigators.forEach((navigator) => navigator.reset());
    const goingWest = this.player.sprite.x >= 0;
    this.leaderFollowerSystem.players.forEach((player, index) => {
      const x = goingWest ? -90 - index * 110 : 58 + index * 110;
      player.sprite.body.reset(x, WEST_CRACK.y);
    });
    this.moveCompanionsAcrossWall();
    this.leaderFollowerSystem.setLeader(this.player.id);
    this.playerManager.update();
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  createWestCrack() {
    const ravine = this.add.graphics().setPosition(WEST_CRACK.x, WEST_CRACK.y)
      .setDepth(1).setName('west-ravine');
    ravine.fillStyle(0x5e403c).fillPoints([
      { x: -9, y: -125 }, { x: -27, y: -102 }, { x: -34, y: -69 },
      { x: -24, y: -38 }, { x: -38, y: -5 }, { x: -27, y: 28 },
      { x: -33, y: 61 }, { x: -20, y: 95 }, { x: -6, y: 124 },
      { x: 13, y: 110 }, { x: 32, y: 79 }, { x: 25, y: 43 },
      { x: 38, y: 9 }, { x: 26, y: -27 }, { x: 35, y: -57 },
      { x: 27, y: -93 }, { x: 10, y: -119 },
    ], true);
    ravine.fillStyle(0x291e28).fillPoints([
      { x: -7, y: -113 }, { x: -21, y: -91 }, { x: -25, y: -67 },
      { x: -15, y: -38 }, { x: -29, y: -4 }, { x: -18, y: 29 },
      { x: -24, y: 60 }, { x: -12, y: 92 }, { x: -4, y: 112 },
      { x: 7, y: 100 }, { x: 23, y: 76 }, { x: 16, y: 42 },
      { x: 29, y: 9 }, { x: 17, y: -28 }, { x: 25, y: -58 },
      { x: 18, y: -89 }, { x: 7, y: -108 },
    ], true);
    const lava = this.add.graphics().setPosition(WEST_CRACK.x, WEST_CRACK.y)
      .setDepth(1).setName('west-ravine-lava');
    lava.fillStyle(0xe75320).fillPoints([
      { x: -5, y: -100 }, { x: -14, y: -76 }, { x: -6, y: -46 },
      { x: -19, y: -11 }, { x: -8, y: 24 }, { x: -14, y: 55 },
      { x: -4, y: 98 }, { x: 12, y: 72 }, { x: 6, y: 42 },
      { x: 18, y: 8 }, { x: 7, y: -29 }, { x: 15, y: -58 },
      { x: 10, y: -84 }, { x: 5, y: -97 },
    ], true);
    lava.lineStyle(5, 0xffc15a, 0.9);
    lava.lineBetween(-6, -70, 5, -57).lineBetween(-12, -9, 8, 3)
      .lineBetween(-6, 41, 5, 53).lineBetween(-7, 75, 4, 81);
    lava.fillStyle(0xffdf84).fillCircle(1, -30, 3).fillCircle(-1, 21, 3);
    this.tweens.add({ targets: lava, alpha: 0.65, duration: 850, yoyo: true, repeat: -1 });

    for (const [offsetY, flipX] of [[-148, false], [148, true]]) {
      ravine.fillStyle(0x776b66).fillRect(-20, offsetY + 13, 40, 8);
      ravine.lineStyle(2, 0x403b40).strokeRect(-20, offsetY + 13, 40, 8);
      this.add.image(WEST_CRACK.x, WEST_CRACK.y + offsetY, 'pterodactyl-perched')
        .setScale(0.65).setFlipX(flipX).setDepth(1).setName('west-ravine-pterodactyl');
    }
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
      const previousSeed = this.collectibleManager.store.loadState().layoutSeed;
      this.collectibleManager.store.save(new Set(), new Map(), newLayoutSeed(previousSeed));
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
          this.physics.add.collider(player.sprite, this.northLayer);
          this.physics.add.collider(player.sprite, this.eastLayer);
          this.physics.add.collider(player.sprite, this.eastNorthWall);
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
    this.northFollowerNavigators.forEach((navigator) => navigator.reset());
    this.eastFollowerNavigators.forEach((navigator) => navigator.reset());
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
      [WORLD_TILE.NORTH_FOREST_GATE, 0x6d5576],
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
    const groundX = tileSize * WORLD_TILE.DARK_GROUND;
    graphics.fillStyle(0x273b3b).fillRect(groundX, 0, tileSize, tileSize);
    graphics.fillStyle(0x344c47).fillCircle(groundX + 6, 8, 2).fillCircle(groundX + 22, 23, 2);
    const treeX = tileSize * WORLD_TILE.DARK_TREE;
    graphics.fillStyle(0x273b3b).fillRect(treeX, 0, tileSize, tileSize);
    graphics.fillStyle(0x191f24).fillTriangle(treeX + 2, 24, treeX + 16, 0, treeX + 30, 24);
    graphics.fillStyle(0x192f2a).fillTriangle(treeX + 4, 18, treeX + 16, 2, treeX + 28, 18);
    graphics.fillStyle(0x443c3a).fillRect(treeX + 13, 22, 6, 10);
    const volcanic = tileSize * WORLD_TILE.VOLCANIC_GROUND;
    graphics.fillStyle(0x75483a).fillRect(volcanic, 0, tileSize, tileSize);
    graphics.fillStyle(0xa16042).fillCircle(volcanic + 7, 9, 2).fillCircle(volcanic + 23, 24, 2);
    const rock = tileSize * WORLD_TILE.VOLCANIC_ROCK;
    graphics.fillStyle(0x4c3439).fillRect(rock, 0, tileSize, tileSize);
    graphics.lineStyle(3, 0xe27439).lineBetween(rock + 5, 6, rock + 16, 15).lineBetween(rock + 16, 15, rock + 11, 26);
    for (const tile of [WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B]) {
      const x = tile * tileSize;
      graphics.fillStyle(0x7d4037).fillRect(x, 0, tileSize, tileSize);
      graphics.lineStyle(3, 0xffbd63).strokeRect(x + 3, 3, tileSize - 6, tileSize - 6);
      graphics.fillStyle(0xff9a42).fillCircle(x + 16, 16, 5);
    }
    graphics.generateTexture('world-tiles', tileSize * (WORLD_TILE.VOLCANIC_GATE_B + 1), tileSize);
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

    if (item.type === 'accessory') {
      this.registry.get('soundEffects').play(ACCESSORY_PICKUP_SOUNDS[item.slot]);
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
    const map = ['volcanoA', 'volcanoB'].includes(gateId) ? this.eastMap : gateId === 'northForest' ? this.northMap
      : ['westBridge', 'westForest'].includes(gateId) ? this.westMap : this.worldMap;
    map.setCollision(tile, false);
    if (![WORLD_TILE.BRIDGE, WORLD_TILE.SECOND_BRIDGE, WORLD_TILE.WEST_BRIDGE].includes(tile)) {
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.getTileAt(x, y)?.index === tile) {
            map.putTileAt(['volcanoA', 'volcanoB'].includes(gateId) ? WORLD_TILE.VOLCANIC_GROUND
              : gateId === 'northForest' ? WORLD_TILE.DARK_GROUND : WORLD_TILE.PATH, x, y);
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
      challenge: this.challengeManager.rotateOptions(challenge),
      evaluateAnswer: (answer) => this.challengeManager.evaluateAnswer(challenge.id, answer),
      onComplete: (isCorrect) => {
        if (isCorrect) {
          if (miniGame === 'mosquito' || miniGame === 'troll' || miniGame === 'flight' || miniGame === 'cave'
            || miniGame === 'witch' || miniGame === 'catMaze'
            || ['volcanoBridge', 'volcanoCrystals', 'volcanoRunes', 'volcanoEruption'].includes(miniGame)) {
            const trollGame = miniGame === 'troll';
            const flightGame = miniGame === 'flight';
            const caveGame = miniGame === 'cave';
            const witchGame = miniGame === 'witch';
            const catGame = miniGame === 'catMaze';
            const volcanoMode = {
              volcanoBridge: 'bridge', volcanoCrystals: 'crystals',
              volcanoRunes: 'runes', volcanoEruption: 'eruption',
            }[miniGame];
            const unicorns = this.collectibleManager.getCollectedItems('unicorn');
            const accessories = this.collectibleManager.getCollectedItems('accessory');
            this.scene.launch(catGame ? 'CatMazeScene' : volcanoMode ? 'VolcanoScene' : witchGame ? 'WitchMazeScene' : caveGame ? 'CaveScene'
              : flightGame ? 'FlightScene' : trollGame ? 'TrollScene' : 'MosquitoScene', {
              player: { name: this.player.name, avatar: this.player.avatar },
              ...(volcanoMode ? { mode: volcanoMode } : {}),
              ...(caveGame ? {
                players: this.leaderFollowerSystem.players.map((player) => ({ name: player.name, avatar: player.avatar })),
              } : {}),
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
                  if (catGame) this.captureCat();
                  if (!this.dialogueWindow.isOpen) {
                    this.dialogueWindow.showLines(catGame ? 'Ildkatten' : volcanoMode ? 'Vulkanen' : witchGame ? 'Heksens labyrint' : caveGame ? 'Hulen' : flightGame ? 'Flyveturen' : trollGame ? 'Troldens æbler' : 'Myggejagten', [
                      catGame ? 'Flot! Du fangede ildkatten, før den slap væk.'
                        : volcanoMode ? 'Flot! I klarede vulkanens udfordring.'
                        : witchGame ? 'Flot! Du fandt ud af heksens labyrint.'
                        : caveGame ? 'Flot! I krydsede hulen sammen.'
                        : flightGame ? 'Flot! I fløj over revnen sammen.'
                        : trollGame ? 'Flot! Du samlede syv æbler, og broen er åben.'
                        : 'Flot! Du ramte 10 myg, og stien til skoven er åben.',
                    ]);
                  }
                } else {
                  this.isAnswering = false;
                  if (catGame) {
                    if (!this.volcanoCatRoam) throw new Error('Ildkatten mangler i vulkanområdet.');
                    this.volcanoCatRoam.respawn();
                  }
                  this.swapLeader();
                  this.dialogueWindow.showLines(catGame ? 'Ildkatten' : volcanoMode ? 'Vulkanen' : witchGame ? 'Heksens labyrint' : caveGame ? 'Hulen' : flightGame ? 'Flyveturen' : trollGame ? 'Troldens æbler' : 'Myggejagten', [
                    catGame ? 'Katten slap væk og gemmer sig et andet sted i vulkanområdet. Nu er det den anden spillers tur.'
                      : volcanoMode ? 'Du blev ramt tre gange. Nu er det den anden spillers tur.'
                      : witchGame ? 'Heksen fangede dig! Nu er det den anden spillers tur.'
                      : caveGame ? 'I mistede alle fem liv. Prøv spørgsmålet og hulen igen!'
                      : flightGame ? 'I mistede alle fem liv. Prøv spørgsmålet og flyveturen igen!'
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
