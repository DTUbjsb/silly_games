const TARGET_HITS = 10;
const MAX_ESCAPED = 20;
const WAND_X = 400;
const WAND_Y = 570;
const WAND_LENGTH = 72;
const STAR_SPEED = 520;

export class MosquitoScene extends Phaser.Scene {
  constructor() {
    super('MosquitoScene');
  }

  create({ onComplete }) {
    if (typeof onComplete !== 'function') {
      throw new Error('Myggejagten mangler en afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.finished = false;
    this.hits = 0;
    this.escaped = 0;
    this.buzz = null;
    this.aim = -Math.PI / 2;
    this.makeTextures();

    this.add.rectangle(400, 300, 800, 600, 0x203d63);
    this.add.circle(690, 130, 45, 0xfff0b4, 0.9);
    this.add.text(400, 22, 'MYGGEJAGTEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#fff7ce',
    }).setOrigin(0.5);
    this.add.text(400, 52, 'Sigt med musen · Tryk MELLEMRUM for at skyde en stjerne', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5);
    this.scoreText = this.add.text(20, 80, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    });
    this.updateScore();
    this.add.rectangle(400, 591, 800, 18, 0x315d4a);

    const wand = this.add.graphics();
    wand.lineStyle(10, 0x9b6ad0).lineBetween(0, 0, 0, -WAND_LENGTH);
    wand.lineStyle(3, 0xfbe9ff).lineBetween(-2, -4, -2, -WAND_LENGTH + 3);
    wand.fillStyle(0xffe57a).fillCircle(0, -WAND_LENGTH, 8);
    this.wand = this.add.container(WAND_X, WAND_Y, [wand]);
    this.stars = this.physics.add.group();
    this.mosquitoes = this.physics.add.group();
    this.physics.add.overlap(this.stars, this.mosquitoes, this.hitMosquito, undefined, this);
    this.time.addEvent({ delay: 900, loop: true, callback: this.spawnMosquito, callbackScope: this });

    this.input.on('pointermove', this.pointWand, this);
    this.input.keyboard.on('keydown-SPACE', this.fireSpace, this);
    this.registry.get('soundEffects').play('mosquitoStart');
    this.events.once('shutdown', () => {
      this.stopBuzz();
      this.input.off('pointermove', this.pointWand, this);
      this.input.keyboard.off('keydown-SPACE', this.fireSpace, this);
    });
    this.events.on('pause', this.stopBuzz, this);
    this.events.once('shutdown', () => this.events.off('pause', this.stopBuzz, this));
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('mosquito-game-star')) {
      graphics.fillStyle(0xffeb78);
      graphics.fillPoints([
        { x: 10, y: 0 }, { x: 12, y: 7 }, { x: 20, y: 7 }, { x: 14, y: 12 },
        { x: 16, y: 20 }, { x: 10, y: 15 }, { x: 4, y: 20 }, { x: 6, y: 12 },
        { x: 0, y: 7 }, { x: 8, y: 7 },
      ], true);
      graphics.generateTexture('mosquito-game-star', 20, 20);
      graphics.clear();
    }
    if (!this.textures.exists('mosquito-game-mosquito')) {
      graphics.fillStyle(0xd5efff, 0.9).fillEllipse(12, 12, 17, 12).fillEllipse(34, 12, 17, 12);
      graphics.lineStyle(2, 0x2a233e);
      graphics.lineBetween(17, 24, 4, 33).lineBetween(29, 24, 42, 33);
      graphics.lineBetween(19, 28, 8, 39).lineBetween(27, 28, 38, 39);
      graphics.fillStyle(0x5d4166).fillEllipse(23, 24, 14, 25);
      graphics.fillStyle(0x3c3048).fillCircle(23, 12, 7);
      graphics.fillStyle(0xffffff).fillCircle(20, 10, 2).fillCircle(26, 10, 2);
      graphics.generateTexture('mosquito-game-mosquito', 46, 42);
    }
    graphics.destroy();
  }

  pointWand(pointer) {
    const dx = pointer.x - WAND_X;
    const dy = pointer.y - WAND_Y;
    if (dx !== 0 || dy !== 0) {
      this.aim = Math.atan2(dy, dx);
      this.wand.setRotation(this.aim + Math.PI / 2);
    }
  }

  fireSpace(event) {
    if (!event.repeat) {
      this.fireStar(this.aim);
    }
  }

  fireStar(angle) {
    if (this.finished) {
      return;
    }
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const star = this.stars.create(
      WAND_X + dx * WAND_LENGTH, WAND_Y + dy * WAND_LENGTH, 'mosquito-game-star',
    );
    star.body.setVelocity(dx * STAR_SPEED, dy * STAR_SPEED);
    this.registry.get('soundEffects').play('star');
  }

  spawnMosquito() {
    if (this.finished) {
      return;
    }
    const mosquito = this.mosquitoes.create(Phaser.Math.Between(30, 770), -25, 'mosquito-game-mosquito');
    mosquito.body.setVelocityY(55);
  }

  hitMosquito(star, mosquito) {
    if (this.finished || !star.active || !mosquito.active) {
      return;
    }
    star.destroy();
    mosquito.destroy();
    this.registry.get('soundEffects').play('mosquitoHit');
    this.hits += 1;
    this.updateScore();
    if (this.hits >= TARGET_HITS) {
      this.finish(true);
    }
  }

  updateScore() {
    this.scoreText.setText(`Ramt: ${this.hits} / ${TARGET_HITS}    Sluppet forbi: ${this.escaped} / ${MAX_ESCAPED}`);
  }

  update() {
    if (this.finished) {
      return;
    }
    for (const star of this.stars.getChildren()) {
      if (star.x < -20 || star.x > 820 || star.y < -20 || star.y > 620) {
        star.destroy();
      }
    }
    for (const mosquito of this.mosquitoes.getChildren()) {
      if (mosquito.y > 621) {
        mosquito.destroy();
        this.escaped += 1;
        this.registry.get('soundEffects').play('mosquitoEscape');
        this.updateScore();
        if (this.escaped > MAX_ESCAPED) {
          this.finish(false);
          break;
        }
      }
    }
    if (!this.finished && this.mosquitoes.countActive(true) > 0) {
      if (!this.buzz) {
        this.buzz = this.registry.get('soundEffects').startMosquitoBuzz();
      }
    } else {
      this.stopBuzz();
    }
  }

  stopBuzz() {
    if (this.buzz) {
      this.buzz.stop();
      this.buzz = null;
    }
  }

  finish(won) {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.stopBuzz();
    this.registry.get('soundEffects').play(won ? 'mosquitoWin' : 'mosquitoLose');
    const onComplete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    onComplete(won);
  }
}
