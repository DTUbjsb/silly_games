import { minigameSpeed } from '../systems/MinigameDifficulty.js';
import { wizardEquipment } from '../systems/WizardTeam.js';
import { renderUnicornAccessories } from '../ui/UnicornAccessories.js';

const WIZARD_LIVES = 7;
const GIRL_LIVES = 5;

export class WizardBattleScene extends Phaser.Scene {
  constructor() {
    super('WizardBattleScene');
  }

  create({ player, players, unicorns, accessories, onComplete }) {
    if (!Array.isArray(players) || players.length < 2 || !Array.isArray(unicorns) || unicorns.length !== 4
      || !Array.isArray(accessories) || ['sticker', 'wings', 'crown', 'saddle'].some(
        (slot) => accessories.filter((item) => item.slot === slot).length < 4,
      ) || typeof onComplete !== 'function'
      || players.slice(0, 2).some((item) => !this.textures.exists(item.avatar))
      || unicorns.some((item) => !this.textures.exists(item.texture))
      || accessories.some((item) => !this.textures.exists(item.wornTexture ?? item.texture))) {
      throw new Error('Troldmandskampen mangler spillere, enhjørninger, tilbehør eller afslutningsfunktion.');
    }
    this.difficulty = minigameSpeed(player?.age);
    this.onComplete = onComplete;
    this.finished = false;
    this.wizardLives = WIZARD_LIVES;
    this.girlLives = GIRL_LIVES;
    this.invulnerableUntil = 0;
    this.lastShots = [-Infinity, -Infinity, -Infinity, -Infinity];
    this.add.rectangle(400, 300, 800, 600, 0x2b3148);
    this.add.text(400, 22, 'KAMPEN MOD TROLDMANDEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff1c8',
    }).setOrigin(0.5);
    this.add.text(400, 52, '1–4: Skyd med enhjørningerne · Piletaster / WASD: Flyt pigerne', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5);
    this.score = this.add.text(400, 80, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    this.makeTextures();
    this.unicorns = [];
    this.equipment = wizardEquipment(accessories);
    unicorns.forEach((unicorn, index) => {
      const y = 145 + index * 120;
      const layer = this.add.container(0, 0);
      renderUnicornAccessories(this, layer, unicorn.id, this.equipment[index], {
        getAccessoryOwner: () => unicorn.id,
      });
      this.add.container(92, y, [
        this.add.image(0, 0, unicorn.texture), layer,
      ]).setScale(0.48);
      this.add.text(28, y, String(index + 1), {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#fff1c8',
      }).setOrigin(0.5);
      this.unicorns.push({ x: 130, y });
    });
    this.girls = players.slice(0, 2).map((child, index) => {
      const sprite = this.physics.add.sprite(345 + index * 65, 340, child.avatar).setScale(0.55).setDepth(2);
      sprite.body.setSize(55, 62).setOffset(20, 23);
      return sprite;
    });
    this.wizard = this.physics.add.sprite(690, 300, 'wizard').setScale(0.68).setDepth(2);
    this.wizard.body.setSize(90, 180);
    this.wizard.body.setVelocityY(105 * this.difficulty);
    this.beams = this.physics.add.group({ allowGravity: false });
    this.stars = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.wizard, this.beams, this.hitWizard, undefined, this);
    this.girls.forEach((girl) => this.physics.add.overlap(girl, this.stars, this.hitGirls, undefined, this));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown', this.handleShot, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.handleShot, this));
    this.time.addEvent({ delay: 1200, loop: true, callback: this.shootStar, callbackScope: this });
    this.updateScore();
    this.registry.get('soundEffects').play('flightStart');
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('wizard-beam')) {
      graphics.fillStyle(0xffe68c).fillRoundedRect(0, 0, 70, 10, 5);
      graphics.fillStyle(0xffffff).fillRoundedRect(0, 3, 70, 4, 2);
      graphics.generateTexture('wizard-beam', 70, 10);
      graphics.clear();
    }
    if (!this.textures.exists('wizard-star')) {
      graphics.fillStyle(0xe49be9).fillPoints([
        { x: 14, y: 0 }, { x: 18, y: 9 }, { x: 28, y: 10 }, { x: 20, y: 17 },
        { x: 23, y: 28 }, { x: 14, y: 22 }, { x: 5, y: 28 }, { x: 8, y: 17 },
        { x: 0, y: 10 }, { x: 10, y: 9 },
      ], true);
      graphics.generateTexture('wizard-star', 28, 28);
    }
    graphics.destroy();
  }

  handleShot(event) {
    if (this.finished || event.repeat || !/^[1-4]$/.test(event.key)) return;
    const index = Number(event.key) - 1;
    if (this.time.now - this.lastShots[index] < 350) return;
    this.lastShots[index] = this.time.now;
    const source = this.unicorns[index];
    this.beams.create(source.x, source.y, 'wizard-beam').body.setVelocityX(430);
    this.registry.get('soundEffects').play('star');
  }

  shootStar() {
    if (this.finished) return;
    const target = this.girls[Phaser.Math.Between(0, 1)];
    const star = this.stars.create(this.wizard.x - 30, this.wizard.y, 'wizard-star');
    const direction = new Phaser.Math.Vector2(target.x - star.x, target.y - star.y).normalize();
    star.body.setVelocity(direction.x * 220 * this.difficulty, direction.y * 220 * this.difficulty);
    this.registry.get('soundEffects').play('flightBird');
  }

  hitWizard(wizard, beam) {
    if (this.finished || !beam.active) return;
    beam.destroy();
    this.wizardLives -= 1;
    this.registry.get('soundEffects').play('mosquitoHit');
    this.updateScore();
    if (this.wizardLives <= 0) this.finish(true);
  }

  hitGirls(girl, star) {
    if (this.finished || !star.active) return;
    star.destroy();
    if (this.time.now < this.invulnerableUntil) return;
    this.girlLives -= 1;
    this.registry.get('soundEffects').play('trollRockHit');
    this.updateScore();
    if (this.girlLives <= 0) this.finish(false);
    else {
      this.invulnerableUntil = this.time.now + 1000;
      this.tweens.add({ targets: this.girls, alpha: 0.35, duration: 100, yoyo: true, repeat: 4 });
    }
  }

  updateScore() {
    this.score.setText(`Troldmandens liv: ${this.wizardLives} / ${WIZARD_LIVES}    Pigernes liv: ${this.girlLives} / ${GIRL_LIVES}`);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(200);
    for (const girl of this.girls) {
      girl.setVelocity(direction.x, direction.y);
    }
    const minX = Math.min(...this.girls.map((girl) => girl.x));
    const maxX = Math.max(...this.girls.map((girl) => girl.x));
    const minY = Math.min(...this.girls.map((girl) => girl.y));
    const maxY = Math.max(...this.girls.map((girl) => girl.y));
    for (const girl of this.girls) {
      girl.x += Math.max(230 - minX, 0) + Math.min(500 - maxX, 0);
      girl.y += Math.max(125 - minY, 0) + Math.min(560 - maxY, 0);
    }
    if (this.wizard.y < 130) this.wizard.body.setVelocityY(105 * this.difficulty);
    if (this.wizard.y > 550) this.wizard.body.setVelocityY(-105 * this.difficulty);
    for (const beam of this.beams.getChildren()) {
      if (beam.x > 430 && beam.x < this.wizard.x && Math.abs(beam.y - this.wizard.y) < 70) {
        const away = beam.y < this.wizard.y ? 1 : -1;
        if ((away > 0 && this.wizard.y < 520) || (away < 0 && this.wizard.y > 160)) {
          this.wizard.body.setVelocityY(away * 105 * this.difficulty);
        }
      }
    }
    for (const beam of this.beams.getChildren()) if (beam.x > 850) beam.destroy();
    for (const star of this.stars.getChildren()) {
      if (star.x < -30 || star.x > 830 || star.y < 100 || star.y > 630) star.destroy();
    }
  }

  finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'trollWin' : 'trollLose');
    const complete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    complete(won);
  }
}
