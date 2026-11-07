import { MovementSystem } from '../systems/MovementSystem.js';

const SETTINGS = {
  bridge: { title: 'BYG LAVABROEN', instruction: 'Saml 5 brosten, og gå til udgangen. Undgå gløderne.', goal: 5 },
  crystals: { title: 'KRYSTALJAGTEN', instruction: 'Saml 7 ildkrystaller, og undgå gløderne.', goal: 7 },
  runes: { title: 'ILDENS RUNER', instruction: 'Træd på runerne i rækkefølgen 1, 2, 3, 4.', goal: 4 },
  eruption: { title: 'VULKANUDBRUD', instruction: 'Undgå gløderne i 15 sekunder!', goal: 15000 },
};

export class VolcanoScene extends Phaser.Scene {
  constructor() {
    super('VolcanoScene');
  }

  create({ player, mode, onComplete }) {
    if (!player?.name || !this.textures.exists(player.avatar) || !SETTINGS[mode]
      || typeof onComplete !== 'function') {
      throw new Error('Vulkanspillet mangler en spiller, spiltype eller afslutningsfunktion.');
    }
    this.mode = mode;
    this.onComplete = onComplete;
    this.finished = false;
    this.progress = 0;
    this.hits = 0;
    this.invulnerableUntil = 0;
    this.beat = 0;
    this.bridgeBarrier = null;
    this.add.rectangle(400, 300, 800, 600, 0x321f2b);
    this.add.rectangle(400, 348, 800, 504, 0x664334);
    this.add.polygon(0, 0, [0, 480, 160, 200, 300, 480, 460, 270, 650, 480, 800, 300, 800, 600, 0, 600], 0x53303a).setOrigin(0);
    if (mode === 'bridge') {
      this.add.rectangle(620, 360, 48, 480, 0x9b3225);
      this.add.rectangle(620, 360, 24, 480, 0xf57b2c);
      this.bridgeBarrier = this.add.rectangle(620, 360, 48, 480, 0x000000, 0);
      this.physics.add.existing(this.bridgeBarrier, true);
    }
    this.add.text(400, 24, SETTINGS[mode].title.toLocaleUpperCase(), {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe2a6',
    }).setOrigin(0.5);
    this.add.text(400, 53, `${SETTINGS[mode].instruction} Bevæg dig med piletaster eller WASD.`, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', color: '#ffffff', wordWrap: { width: 760 },
    }).setOrigin(0.5);
    this.score = this.add.text(18, 82, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: '#ffffff',
    });
    this.player = this.physics.add.sprite(100, 440, player.avatar).setScale(0.72);
    this.player.body.setSize(55, 62).setOffset(20, 23);
    if (this.bridgeBarrier) this.physics.add.collider(this.player, this.bridgeBarrier);
    this.movement = new MovementSystem(this, this.player);
    this.makeTextures();
    this.hazards = this.physics.add.group();
    this.items = this.physics.add.group({ immovable: true });
    this.physics.add.overlap(this.player, this.hazards, this.hit, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.collect, undefined, this);
    if (mode === 'bridge') {
      this.bridgePieces = Array.from({ length: 5 }, (_, index) => (
        this.add.rectangle(620, 270 + index * 36, 55, 32, 0x726159).setAlpha(0.25)
      ));
      this.add.rectangle(690, 480, 110, 75, 0x688454).setStrokeStyle(3, 0xd5eaa9);
      this.exit = this.add.text(690, 480, 'UDGANG', {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#ffffff',
      }).setOrigin(0.5);
    }
    if (mode === 'bridge' || mode === 'crystals') this.spawnItem();
    if (mode === 'runes') {
      [[165, 190], [600, 190], [600, 475], [165, 475]].forEach(([x, y], index) => {
        const rune = this.items.create(x, y, 'volcano-rune');
        rune.setData('index', index);
        this.add.text(x, y, String(index + 1), {
          fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2);
      });
    }
    if (mode !== 'runes') {
      this.time.addEvent({ delay: 1250, loop: true, callback: this.spawnHazard, callbackScope: this });
    }
    this.playMusic();
    this.time.addEvent({ delay: 500, loop: true, callback: this.playMusic, callbackScope: this });
    this.updateScore();
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    for (const [name, color] of [['volcano-item', 0xffc15c], ['volcano-hazard', 0xff5729], ['volcano-rune', 0x8e55a1]]) {
      if (!this.textures.exists(name)) {
        graphics.clear().fillStyle(color).fillCircle(22, 22, 20).lineStyle(3, 0xffe6a3).strokeCircle(22, 22, 20);
        graphics.generateTexture(name, 44, 44);
      }
    }
    graphics.destroy();
  }

  spawnItem() {
    const x = Phaser.Math.Between(100, this.mode === 'bridge' ? 530 : 650);
    const y = Phaser.Math.Between(150, 490);
    this.items.create(x, y, 'volcano-item');
  }

  collect(player, item) {
    if (this.finished || !item.active) return;
    if (this.mode === 'runes' && item.getData('index') !== this.progress) return;
    item.destroy();
    this.progress += 1;
    if (this.mode === 'bridge') {
      this.bridgePieces[this.progress - 1].setAlpha(1).setFillStyle(0xd0a47b);
      if (this.progress === SETTINGS.bridge.goal) {
        this.bridgeBarrier.body.enable = false;
      }
    }
    this.registry.get('soundEffects').play('trollApple');
    this.updateScore();
    if (this.progress >= SETTINGS[this.mode].goal) {
      if (this.mode !== 'bridge') this.finish(true);
    } else if (this.mode !== 'runes') this.spawnItem();
  }

  spawnHazard() {
    if (this.finished) return;
    const hazard = this.hazards.create(Phaser.Math.Between(60, 740), 110, 'volcano-hazard');
    const direction = new Phaser.Math.Vector2(this.player.x - hazard.x, this.player.y - hazard.y).normalize();
    hazard.body.setVelocity(direction.x * 125, Math.max(100, direction.y * 125));
    this.registry.get('soundEffects').play('flightBird');
  }

  hit(player, hazard) {
    if (this.finished || !hazard.active) return;
    hazard.destroy();
    if (this.time.now < this.invulnerableUntil) return;
    this.hits += 1;
    this.invulnerableUntil = this.time.now + 1000;
    this.registry.get('soundEffects').play('flightLava');
    this.updateScore();
    if (this.hits >= 3) this.finish(false);
    else this.tweens.add({ targets: this.player, alpha: 0.4, duration: 100, yoyo: true, repeat: 4 });
  }

  updateScore() {
    const progress = this.mode === 'eruption' ? `${Math.max(0, Math.ceil((15000 - this.progress) / 1000))} sek.`
      : `${this.progress} / ${SETTINGS[this.mode].goal}`;
    this.score.setText(`${this.mode === 'eruption' ? 'Tid tilbage' : 'Samlet'}: ${progress}    Ramt: ${this.hits} / 3`);
  }

  playMusic() {
    if (!this.finished) this.registry.get('soundEffects').play(this.beat++ % 2 ? 'worldVolcanoHigh' : 'worldVolcanoLow');
  }

  update(time, delta) {
    if (this.finished) return;
    this.movement.update();
    this.player.x = Phaser.Math.Clamp(this.player.x, 40, 760);
    this.player.y = Phaser.Math.Clamp(this.player.y, 135, 555);
    for (const hazard of this.hazards.getChildren()) {
      if (hazard.x < -50 || hazard.x > 850 || hazard.y > 650) hazard.destroy();
    }
    if (this.mode === 'eruption') {
      this.progress += delta;
      this.updateScore();
      if (this.progress >= SETTINGS.eruption.goal) this.finish(true);
    } else if (this.mode === 'bridge' && this.progress >= SETTINGS.bridge.goal
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, 690, 480) < 60) {
      this.finish(true);
    }
  }

  finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'flightWin' : 'flightLose');
    const complete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    complete(won);
  }
}
