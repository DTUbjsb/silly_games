import {
  TEST_WORLD_DATA,
  TEST_WORLD_TILE_SIZE,
  WORLD_TILE,
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
    this.worldMap.setCollision([
      WORLD_TILE.WATER,
      WORLD_TILE.FOREST,
      WORLD_TILE.BRIDGE,
    ]);
    this.physics.world.setBounds(0, 0, this.worldMap.widthInPixels, this.worldMap.heightInPixels);

    this.stateManager = null;
    this.isAnswering = false;
    this.isComplete = false;
    this.input.keyboard.on('keydown', this.handleKeyboardInput, this);

    this.playerManager = new PlayerManager(this);
    this.collectibleManager = new CollectibleManager(this);
    this.questManager = new QuestManager();
    this.challengeManager = new EducationalChallengeManager();
    this.player = null;
    this.players = [];
    this.leaderFollowerSystem = null;
    this.movement = null;
    this.hud = new Hud(this);
    this.dialogueWindow = new DialogueWindow(this);
    this.npcManager = new NPCManager(this, {
      questManager: this.questManager,
      challengeManager: this.challengeManager,
      dialogueWindow: this.dialogueWindow,
      onChallenge: (challengeId, onCorrect) => this.startNPCChallenge(challengeId, onCorrect),
      onBridgeOpen: () => this.openBridge(),
    });
    this.playerStatus = this.add.text(400, 300, 'Indlæser spilverdenen...', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '20px',
      color: '#294c5b',
      backgroundColor: '#ffffffdd',
      padding: { x: 14, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(6);

    this.cameras.main.setBounds(0, 0, this.worldMap.widthInPixels, this.worldMap.heightInPixels);
    this.cameras.main.setZoom(0.8);

    this.add.text(28, 566, 'Tip: Find enhjørninger og tilbehør, og løs udfordringerne.', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#315b69',
      backgroundColor: '#ffffffaa',
      padding: { x: 10, y: 6 },
    }).setScrollFactor(0).setDepth(5);

    this.loadPlayers();
  }

  update(time, delta) {
    if (!this.leaderFollowerSystem) {
      return;
    }

    const leader = this.leaderFollowerSystem.leader;
    this.npcManager.update(
      leader,
      this.isAnswering || this.isComplete || this.dialogueWindow.isOpen,
    );

    if (!this.isAnswering && !this.isComplete && !this.dialogueWindow.isOpen) {
      this.movement.update();
    } else {
      this.leaderFollowerSystem.leader.sprite.setVelocity(0, 0);
    }
    this.leaderFollowerSystem.update(delta);
    this.playerManager.update();
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

    if (!this.isAnswering && !this.isComplete) {
      this.npcManager.interact();
    }
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

        this.stateManager = new GameStateManager(
          this.collectibleManager.getTotalCount('unicorn'),
        );
        this.hud.setProgress(this.stateManager.learnedCount, this.stateManager.goal);
        this.updateCollectionProgress();

        this.players = profiles.map((profile, index) => this.playerManager.addPlayer(
          profile.id,
          { x: 900 - (index % 3) * 110, y: 200 + Math.floor(index / 3) * 90 },
        ));
        this.leaderFollowerSystem = new LeaderFollowerSystem(this.players);
        this.player = this.leaderFollowerSystem.leader;
        this.movement = new MovementSystem(this, this.player.sprite);
        this.players.forEach((player) => {
          this.physics.add.collider(player.sprite, this.worldLayer);
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

    this.player = nextLeader;
    this.movement.setPlayer(nextLeader.sprite);
    this.cameras.main.startFollow(nextLeader.sprite, true, 0.08, 0.08);
    this.hud.setTurn(nextLeader.name);
    return true;
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

    graphics.fillStyle(0x94643f).fillRect(tileSize * WORLD_TILE.BRIDGE, 0, tileSize, tileSize);
    graphics.fillStyle(0x67452f)
      .fillRect(tileSize * WORLD_TILE.BRIDGE, 2, tileSize, 3)
      .fillRect(tileSize * WORLD_TILE.BRIDGE, 14, tileSize, 3)
      .fillRect(tileSize * WORLD_TILE.BRIDGE, 27, tileSize, 3);
    graphics.fillStyle(0xb38257)
      .fillRect(tileSize * WORLD_TILE.BRIDGE, 6, tileSize, 2)
      .fillRect(tileSize * WORLD_TILE.BRIDGE, 19, tileSize, 2);

    graphics.generateTexture('world-tiles', tileSize * (WORLD_TILE.BRIDGE + 1), tileSize);
    graphics.destroy();
  }

  collectWorldItem(playerSprite, pickup) {
    if (
      this.isAnswering
      || this.isComplete
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

    const challenge = this.challengeManager.getChallengeForAge(
      this.leaderFollowerSystem.leader.age,
      this.stateManager.getLearnedChallengeIds(),
    );
    this.startChallenge(challenge, () => this.collectPickup(pickup));
  }

  collectPickup(pickup) {
    const item = this.collectibleManager.collect(pickup);
    if (!item) {
      return;
    }

    this.updateCollectionProgress();
  }

  updateCollectionProgress() {
    this.hud.setCollectionProgress(
      this.collectibleManager.getCollectedCount('unicorn'),
      this.collectibleManager.getTotalCount('unicorn'),
      this.collectibleManager.getCollectedCount('accessory'),
      this.collectibleManager.getTotalCount('accessory'),
    );
  }

  startNPCChallenge(challengeId, onCorrect) {
    const challenge = this.challengeManager.getChallenge(challengeId);
    if (!challenge) {
      throw new Error(`Læringsudfordringen "${challengeId}" findes ikke.`);
    }

    this.startChallenge(challenge, onCorrect);
  }

  openBridge() {
    this.worldMap.setCollision(WORLD_TILE.BRIDGE, false);
  }

  startChallenge(challenge, onCorrect = null) {
    this.isAnswering = true;
    this.scene.launch('ChallengeScene', {
      challenge,
      evaluateAnswer: (answer) => this.challengeManager.evaluateAnswer(challenge.id, answer),
      onComplete: (isCorrect) => {
        this.isAnswering = false;
        if (isCorrect) {
          this.stateManager.learn(challenge.id);
          this.hud.setProgress(this.stateManager.learnedCount, this.stateManager.goal);
          onCorrect?.();
          if (this.stateManager.isComplete()) {
            this.finishAdventure();
          }
        }
      },
    });
    this.scene.pause();
  }

  finishAdventure() {
    this.isComplete = true;
    this.add.rectangle(400, 300, 540, 230, 0x243b53, 0.88)
      .setStrokeStyle(3, 0xffd66b)
      .setScrollFactor(0)
      .setDepth(10);
    this.add.text(400, 252, 'Det klarede du, ordtrold!', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#fff2b3',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.add.text(400, 306, 'Du har løst alle udfordringerne.\nEventyrbogen er fuld af magi!', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '21px',
      align: 'center',
      color: '#ffffff',
      lineSpacing: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);
    const restart = this.add.text(400, 375, 'Spil igen  ·  tryk på ENTER', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '18px',
      color: '#193b4a',
      backgroundColor: '#ffe28a',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11).setInteractive({ useHandCursor: true });

    restart.on('pointerdown', () => this.scene.restart());
    this.input.keyboard.once('keydown-ENTER', () => this.scene.restart());
  }
}
