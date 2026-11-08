import { MovementSystem } from '../systems/MovementSystem.js';
import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const CROSSING_TIME = 18000;
const MAX_HITS = 3;

export class LakeBoatScene extends Phaser.Scene {
  constructor() {
    super('LakeBoatScene');
  }

  create({ player, onComplete }) {
    if (!player?.name || !this.textures.exists(player.avatar) || !this.textures.exists('lake-boat')
      || typeof onComplete !== 'function') {
      throw new Error('Bådturen mangler en spiller, båd eller afslutningsfunktion.');
    }
    this.difficulty = minigameSpeed(player.age);
    this.onComplete = onComplete;
    this.finished = false;
    this.elapsed = 0;
    this.hits = 0;
    this.invulnerableUntil = 0;
    this.nextPaddleSound = 0;
    this.musicBeat = 0;
    this.makeTextures();

    this.add.rectangle(400, 300, 800, 600, 0x4c9fba);
    this.add.rectangle(400, 15, 800, 30, 0x8bcfbb);
    this.add.text(400, 24, 'SEJL TIL ØEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(3);
    this.add.text(400, 55, 'Piletaster / WASD: Styr båden opad og undgå fisk og søuhyret!', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(3);
    this.score = this.add.text(20, 82, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setDepth(3);
    this.waves = this.add.graphics().setDepth(0);
    this.boat = this.physics.add.sprite(400, 480, 'lake-boat').setScale(0.8).setDepth(2);
    this.boat.body.setSize(55, 74);
    this.rider = this.add.image(400, 476, player.avatar).setScale(0.38).setDepth(3);
    this.movement = new MovementSystem(this, this.boat);
    this.hazards = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.boat, this.hazards, this.hit, undefined, this);
    this.time.addEvent({ delay: 1400, loop: true, callback: this.spawnFish, callbackScope: this });
    this.time.addEvent({ delay: 3800, loop: true, callback: this.spawnMonster, callbackScope: this });
    this.updateScore();
    this.registry.get('soundEffects').play('lakeStart');
    this.playMusicBeat();
    this.time.addEvent({ delay: 650, loop: true, callback: this.playMusicBeat, callbackScope: this });
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('lake-fish')) {
      graphics.fillStyle(0xffbd63).fillEllipse(24, 21, 33, 22);
      graphics.fillTriangle(8, 21, 0, 10, 0, 32);
      graphics.fillTriangle(22, 12, 31, 1, 34, 15);
      graphics.fillStyle(0x263e50).fillCircle(34, 18, 3);
      graphics.generateTexture('lake-fish', 44, 42);
      graphics.clear();
    }
    if (!this.textures.exists('lake-monster')) {
      graphics.fillStyle(0x466d75).fillEllipse(45, 37, 86, 45);
      graphics.fillEllipse(45, 23, 55, 38);
      graphics.fillStyle(0xe4f6c0).fillCircle(34, 20, 8).fillCircle(57, 20, 8);
      graphics.fillStyle(0x243b45).fillCircle(35, 20, 3).fillCircle(58, 20, 3);
      graphics.lineStyle(3, 0x243b45).lineBetween(35, 37, 58, 37);
      graphics.generateTexture('lake-monster', 90, 62);
    }
    graphics.destroy();
  }

  spawnFish() {
    if (this.finished) return;
    const fish = this.hazards.create(Phaser.Math.Between(65, 735), 110, 'lake-fish').setDepth(1);
    fish.setData('kind', 'fish');
    fish.body.setVelocity((Phaser.Math.Between(0, 1) ? 80 : -80) * this.difficulty, 150 * this.difficulty);
    this.tweens.add({ targets: fish, scaleY: 1.35, duration: 350, yoyo: true, repeat: -1 });
    this.registry.get('soundEffects').play('lakeFish');
  }

  spawnMonster() {
    if (this.finished) return;
    const monster = this.hazards.create(Phaser.Math.Between(80, 720), 110, 'lake-monster').setDepth(1);
    monster.setData('kind', 'monster');
    monster.body.setVelocity(0, 115 * this.difficulty);
    this.registry.get('soundEffects').play('lakeMonster');
  }

  hit(boat, hazard) {
    if (this.finished || !hazard.active) return;
    hazard.destroy();
    if (this.time.now < this.invulnerableUntil) return;
    this.hits += 1;
    this.registry.get('soundEffects').play('lakeHit');
    this.updateScore();
    if (this.hits >= MAX_HITS) {
      this.finish(false);
    } else {
      this.invulnerableUntil = this.time.now + 1200;
      this.tweens.add({ targets: [this.boat, this.rider], alpha: 0.4, duration: 100, yoyo: true, repeat: 5 });
    }
  }

  updateScore() {
    const remaining = Math.max(0, Math.ceil((CROSSING_TIME - this.elapsed) / 1000));
    this.score.setText(`Tid til øen: ${remaining} sek.    Ramt: ${this.hits} / ${MAX_HITS}`);
  }

  playMusicBeat() {
    if (!this.finished) {
      const notes = ['lakeMusicLow', 'lakeMusicMid', 'lakeMusicHigh', 'lakeMusicMid'];
      this.registry.get('soundEffects').play(notes[this.musicBeat++ % notes.length]);
    }
  }

  update(time, delta) {
    if (this.finished) return;
    this.elapsed += delta;
    if (this.elapsed >= CROSSING_TIME) {
      this.finish(true);
      return;
    }
    this.movement.update();
    if (this.boat.body.velocity.lengthSq() > 0 && time >= this.nextPaddleSound) {
      this.registry.get('soundEffects').play('lakePaddle');
      this.nextPaddleSound = time + 650;
    }
    this.boat.x = Phaser.Math.Clamp(this.boat.x, 40, 760);
    this.boat.y = Phaser.Math.Clamp(this.boat.y, 150, 550);
    this.rider.setPosition(this.boat.x, this.boat.y - 4);
    for (const hazard of this.hazards.getChildren()) {
      if (hazard.getData('kind') === 'fish' && (hazard.x < 35 || hazard.x > 765)) {
        hazard.body.setVelocityX(-hazard.body.velocity.x);
      }
      if (hazard.y > 660) hazard.destroy();
    }
    this.waves.clear().lineStyle(2, 0xc4eef1, 0.6);
    for (let index = 0; index < 18; index += 1) {
      const x = 30 + (index * 137) % 740;
      const y = 110 + Phaser.Math.Wrap(index * 79 + this.elapsed * 0.12, 0, 480);
      this.waves.lineBetween(x, y, x + 24, y);
    }
    this.updateScore();
  }

  finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'lakeWin' : 'lakeLose');
    const complete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    complete(won);
  }
}
