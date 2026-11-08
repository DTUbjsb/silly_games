import { MovementSystem } from '../systems/MovementSystem.js';
import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const APPLE_GOAL = 7;
const MAX_HITS = 3;
const TROLL_X = 665;
const TROLL_Y = 315;

export class TrollScene extends Phaser.Scene {
  constructor() {
    super('TrollScene');
  }

  create({ player, onComplete }) {
    if (!player?.name || !player.avatar || !this.textures.exists(player.avatar)
      || typeof onComplete !== 'function') {
      throw new Error('Troldespillet mangler en spiller eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.difficulty = minigameSpeed(player.age);
    this.finished = false;
    this.applesCollected = 0;
    this.hits = 0;
    this.invulnerableUntil = 0;
    this.musicBeat = 0;
    this.makeTextures();

    this.add.rectangle(400, 300, 800, 600, 0x273b37);
    this.add.rectangle(210, 348, 420, 504, 0x667753);
    this.add.rectangle(610, 348, 380, 504, 0x363b3d);
    this.add.rectangle(410, 345, 8, 510, 0x8c8970);
    this.add.text(400, 25, 'TROLDENS ÆBLER', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#fff2bd',
    }).setOrigin(0.5);
    this.add.text(400, 55, 'Saml 7 æbler og undgå sten · Bevæg dig med piletasterne eller WASD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5);
    this.scoreText = this.add.text(18, 83, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    });
    this.updateScore();
    this.add.image(TROLL_X, TROLL_Y, 'troll-arena').setScale(1.05);
    this.add.text(665, 465, 'TROLD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffd5b5',
    }).setOrigin(0.5);

    this.player = this.physics.add.sprite(190, 350, player.avatar).setScale(0.8);
    this.player.body.setSize(55, 62).setOffset(20, 23);
    this.player.setCollideWorldBounds(true);
    this.add.text(210, 575, player.name, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    this.movement = new MovementSystem(this, this.player);
    this.apples = this.physics.add.group();
    this.rocks = this.physics.add.group();
    this.physics.add.overlap(this.player, this.apples, this.collectApple, undefined, this);
    this.physics.add.overlap(this.player, this.rocks, this.hitPlayer, undefined, this);
    this.spawnApple();
    this.time.addEvent({ delay: 1400, loop: true, callback: this.throwRock, callbackScope: this });
    this.playMusicBeat();
    this.time.addEvent({ delay: 440, loop: true, callback: this.playMusicBeat, callbackScope: this });
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('troll-apple')) {
      graphics.fillStyle(0xd94e48).fillCircle(15, 17, 12).fillCircle(25, 17, 12);
      graphics.fillStyle(0x754d30).fillRect(19, 0, 3, 10);
      graphics.fillStyle(0x8ccc6b).fillEllipse(26, 5, 12, 6);
      graphics.generateTexture('troll-apple', 40, 32);
      graphics.clear();
    }
    if (!this.textures.exists('troll-rock')) {
      graphics.fillStyle(0x77717a).fillPoints([
        { x: 4, y: 12 }, { x: 10, y: 3 }, { x: 24, y: 2 },
        { x: 33, y: 12 }, { x: 29, y: 25 }, { x: 13, y: 29 }, { x: 3, y: 23 },
      ], true);
      graphics.fillStyle(0xaaa1a7).fillCircle(12, 10, 4);
      graphics.generateTexture('troll-rock', 36, 32);
    }
    graphics.destroy();
  }

  spawnApple() {
    const x = Phaser.Math.Between(55, 365);
    const y = Phaser.Math.Between(150, 535);
    this.apples.create(x, y, 'troll-apple');
  }

  collectApple(player, apple) {
    if (this.finished || !apple.active) {
      return;
    }
    apple.destroy();
    this.applesCollected += 1;
    this.registry.get('soundEffects').play('trollApple');
    this.updateScore();
    if (this.applesCollected >= APPLE_GOAL) {
      this.finish(true);
    } else {
      this.spawnApple();
    }
  }

  throwRock() {
    if (this.finished) {
      return;
    }
    const rock = this.rocks.create(TROLL_X - 90, TROLL_Y, 'troll-rock');
    const direction = new Phaser.Math.Vector2(this.player.x - rock.x, this.player.y - rock.y).normalize();
    rock.body.setVelocity(direction.x * 240 * this.difficulty, direction.y * 240 * this.difficulty);
    this.registry.get('soundEffects').play('trollThrow');
  }

  hitPlayer(player, rock) {
    if (this.finished || !rock.active) {
      return;
    }
    rock.destroy();
    if (this.time.now < this.invulnerableUntil) {
      return;
    }
    this.hits += 1;
    this.registry.get('soundEffects').play('trollRockHit');
    this.updateScore();
    if (this.hits >= MAX_HITS) {
      this.finish(false);
    } else {
      this.invulnerableUntil = this.time.now + 800;
      this.tweens.add({ targets: this.player, alpha: 0.35, duration: 100, yoyo: true, repeat: 3 });
    }
  }

  updateScore() {
    this.scoreText.setText(`Æbler: ${this.applesCollected} / ${APPLE_GOAL}    Ramt: ${this.hits} / ${MAX_HITS}`);
  }

  playMusicBeat() {
    if (!this.finished) {
      this.registry.get('soundEffects').play(this.musicBeat++ % 4 < 2 ? 'trollMusicLow' : 'trollMusicHigh');
    }
  }

  update() {
    if (this.finished) {
      return;
    }
    this.movement.update();
    this.player.x = Phaser.Math.Clamp(this.player.x, 40, 380);
    this.player.y = Phaser.Math.Clamp(this.player.y, 135, 550);
    for (const rock of this.rocks.getChildren()) {
      if (rock.x < -30 || rock.x > 830 || rock.y < -30 || rock.y > 630) {
        rock.destroy();
      }
    }
  }

  finish(won) {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'trollWin' : 'trollLose');
    const onComplete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    onComplete(won);
  }
}
