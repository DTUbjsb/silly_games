import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const DRAGON_LIVES = 50;
const PRINCESS_LIVES = 15;
const ARROW_SPEED = 600;

export class DragonBattleScene extends Phaser.Scene {
  constructor() {
    super('DragonBattleScene');
  }

  create({ player, players, onComplete }) {
    if (!Array.isArray(players) || players.length < 2 || typeof onComplete !== 'function'
      || players.slice(0, 2).some((child) => !this.textures.exists(child.avatar))) {
      throw new Error('Dragekampen mangler spillere eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.difficulty = minigameSpeed(player?.age);
    this.finished = false;
    this.dragonLives = DRAGON_LIVES;
    this.princessLives = PRINCESS_LIVES;
    this.nextSwordHit = 0;
    this.swordTarget = null;
    this.swordSwingUntil = 0;
    this.nextArrow = 0;
    this.nextShooter = 0;
    this.aimTarget = { x: 400, y: 120 };
    this.add.rectangle(400, 300, 800, 600, 0x282534);
    this.add.ellipse(400, 220, 650, 400, 0x191824);
    this.add.rectangle(400, 510, 800, 180, 0x52493f);
    this.targets = this.physics.add.staticGroup();
    this.head = this.targets.create(400, 145, 'dragon-head').setDepth(2);
    this.headMotionTime = 0;
    this.leftPaw = this.targets.create(48, 265, 'dragon-paw').setDepth(2);
    this.rightPaw = this.targets.create(752, 265, 'dragon-paw').setFlipX(true).setDepth(2);
    this.princess = this.physics.add.sprite(400, 390, 'warrior-princess').setScale(0.7).setDepth(4);
    this.princess.body.setSize(55, 85).setOffset(22, 35);
    this.sword = this.add.rectangle(0, 0, 12, 72, 0xd8e6e9).setStrokeStyle(3, 0x6a7987).setDepth(5);
    this.bows = [];
    this.girls = players.slice(0, 2).map((child, index) => {
      const x = 300 + index * 200;
      this.bows.push(this.add.image(x, 555, 'bow-and-arrow').setScale(0.65).setDepth(5));
      return this.add.image(x, 562, child.avatar).setScale(0.58).setDepth(3);
    });
    this.rockCover = this.add.graphics().setDepth(4);
    for (const x of [300, 500]) {
      this.rockCover.fillStyle(0x36343c).fillEllipse(x, 592, 125, 43);
      this.rockCover.fillStyle(0x77717a).fillEllipse(x - 34, 581, 58, 38)
        .fillEllipse(x + 25, 582, 67, 41);
      this.rockCover.lineStyle(2, 0x4c4852).strokeEllipse(x - 34, 581, 58, 38)
        .strokeEllipse(x + 25, 582, 67, 41);
    }
    this.pointBow(this.aimTarget);
    this.makeTextures();
    this.arrows = this.physics.add.group({ allowGravity: false });
    this.fireballs = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.arrows, this.targets, this.hitDragon, undefined, this);
    this.physics.add.overlap(this.princess, this.fireballs, this.hitPrincess, undefined, this);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.on('pointermove', this.pointBow, this);
    this.input.keyboard.on('keydown-SPACE', this.fireArrow, this);
    this.events.once('shutdown', () => {
      this.input.off('pointermove', this.pointBow, this);
      this.input.keyboard.off('keydown-SPACE', this.fireArrow, this);
    });
    this.time.addEvent({ delay: 1000 / this.difficulty, loop: true, callback: this.shootFireball, callbackScope: this });
    this.add.rectangle(400, 28, 800, 56, 0x161722, 0.9).setDepth(8);
    this.add.text(400, 15, 'DRAGEKAMPEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#fff2ce',
    }).setOrigin(0.5).setDepth(9);
    this.score = this.add.text(400, 40, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(9);
    this.add.text(400, 584, 'Mus + MELLEMRUM: skyd · Piletaster: flyt krigerprinsessen', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', color: '#ffffff',
      backgroundColor: '#191824dd', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(9);
    this.updateScore();
  }

  makeTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('dragon-arrow')) {
      graphics.lineStyle(3, 0xe9d2a4).lineBetween(2, 4, 25, 4);
      graphics.fillStyle(0xdfe9ed).fillTriangle(25, 0, 32, 4, 25, 8);
      graphics.generateTexture('dragon-arrow', 32, 8);
      graphics.clear();
    }
    if (!this.textures.exists('dragon-fireball')) {
      graphics.fillStyle(0xd84b23).fillCircle(16, 16, 16);
      graphics.fillStyle(0xff9a34).fillCircle(16, 16, 11);
      graphics.fillStyle(0xffe888).fillCircle(16, 16, 6);
      graphics.generateTexture('dragon-fireball', 32, 32);
    }
    graphics.destroy();
  }

  pointBow(pointer) {
    this.aimTarget = { x: pointer.x, y: pointer.y };
    this.bows.forEach((bow, index) => {
      const girl = this.girls[index];
      bow.setRotation(Phaser.Math.Angle.Between(girl.x, girl.y, pointer.x, pointer.y) + Math.PI / 4);
    });
  }

  fireArrow(event) {
    if (this.finished || event.repeat || this.time.now < this.nextArrow) return;
    this.nextArrow = this.time.now + 180;
    const shooter = this.girls[this.nextShooter];
    this.nextShooter = 1 - this.nextShooter;
    const angle = Phaser.Math.Angle.Between(shooter.x, shooter.y, this.aimTarget.x, this.aimTarget.y);
    const arrow = this.arrows.create(shooter.x, shooter.y, 'dragon-arrow').setRotation(angle).setDepth(5);
    arrow.body.setVelocity(Math.cos(angle) * ARROW_SPEED, Math.sin(angle) * ARROW_SPEED);
    this.registry.get('soundEffects').play('star');
  }

  shootFireball() {
    if (this.finished) return;
    const fireball = this.fireballs.create(this.head.x, this.head.y + 65, 'dragon-fireball').setDepth(3);
    const direction = new Phaser.Math.Vector2(this.princess.x - fireball.x, this.princess.y - fireball.y).normalize();
    fireball.body.setVelocity(direction.x * 225 * this.difficulty, direction.y * 225 * this.difficulty);
    this.registry.get('soundEffects').play('trollThrow');
  }

  hitDragon(arrow) {
    if (this.finished || !arrow.active) return;
    arrow.destroy();
    this.damageDragon();
  }

  damageDragon() {
    if (this.finished) return;
    this.dragonLives -= 1;
    this.registry.get('soundEffects').play('mosquitoHit');
    this.updateScore();
    if (this.dragonLives <= 0) this.finish(true);
  }

  hitPrincess(princess, fireball) {
    if (this.finished || !fireball.active) return;
    fireball.destroy();
    this.princessLives -= 1;
    this.registry.get('soundEffects').play('trollRockHit');
    this.updateScore();
    if (this.princessLives <= 0) this.finish(false);
  }

  updateScore() {
    this.score.setText(`Dragens liv: ${this.dragonLives} / ${DRAGON_LIVES}    Krigerprinsessens liv: ${this.princessLives} / ${PRINCESS_LIVES}`);
  }

  update(time, delta = 0) {
    if (this.finished) return;
    this.headMotionTime += delta;
    this.head.x = 400 + 170 * Math.sin(this.headMotionTime * Math.PI * 2 / 3600);
    this.head.refreshBody();
    const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    const velocity = new Phaser.Math.Vector2(dx, dy).normalize().scale(220);
    this.princess.setVelocity(velocity.x, velocity.y);
    this.princess.x = Phaser.Math.Clamp(this.princess.x, 70, 730);
    this.princess.y = Phaser.Math.Clamp(this.princess.y, 135, 480);
    if (time >= this.nextSwordHit) {
      const body = this.princess.body;
      const target = this.targets.getChildren().find((target) => {
        const closestX = Phaser.Math.Clamp(body.center.x, target.body.left, target.body.right);
        const closestY = Phaser.Math.Clamp(body.center.y, target.body.top, target.body.bottom);
        return Phaser.Math.Distance.Between(body.center.x, body.center.y, closestX, closestY) <= 55;
      });
      if (target) {
        this.nextSwordHit = time + 700;
        this.swordTarget = target;
        this.swordSwingUntil = time + 200;
        this.damageDragon();
      }
    }
    if (this.swordTarget && time < this.swordSwingUntil) {
      const angle = Phaser.Math.Angle.Between(this.princess.x, this.princess.y, this.swordTarget.x, this.swordTarget.y);
      this.sword.setPosition(this.princess.x + Math.cos(angle) * 32, this.princess.y + Math.sin(angle) * 32)
        .setRotation(angle + Math.PI / 2);
    } else {
      this.swordTarget = null;
      this.sword.setPosition(this.princess.x + 25, this.princess.y - 20).setRotation(0.6);
    }
    for (const projectile of [...this.arrows.getChildren(), ...this.fireballs.getChildren()]) {
      if (projectile.x < -40 || projectile.x > 840 || projectile.y < -40 || projectile.y > 640) projectile.destroy();
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
