import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const MAX_HITS = 5;
const REACH = 100;

export class PrincessDuelScene extends Phaser.Scene {
  constructor() {
    super('PrincessDuelScene');
  }

  create({ player, onComplete }) {
    if (!player?.name || !this.textures.exists(player.avatar) || typeof onComplete !== 'function') {
      throw new Error('Træningskampen mangler en spiller eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.difficulty = minigameSpeed(player.age);
    this.finished = false;
    this.playerLives = MAX_HITS;
    this.princessLives = MAX_HITS;
    this.nextPlayerSwing = 0;
    this.nextPrincessSwing = 0;
    this.princessAttackAt = null;
    this.playerSwingUntil = 0;
    this.princessSwingUntil = 0;
    this.add.rectangle(400, 300, 800, 600, 0xcdebc3);
    this.add.rectangle(400, 563, 800, 74, 0x80b76d);
    this.add.text(400, 25, 'TRÆN MED KRIGERPRINSESSEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#294c5b',
    }).setOrigin(0.5);
    this.add.text(400, 55, 'A/D eller pile: gå · W eller op: hop · MELLEMRUM: slå med træsværdet', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#294c5b',
    }).setOrigin(0.5);
    this.score = this.add.text(400, 83, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#294c5b',
    }).setOrigin(0.5);
    this.add.text(400, 110, 'Fem træffere vinder kampen', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', color: '#294c5b',
    }).setOrigin(0.5);
    const floor = this.add.rectangle(400, 540, 800, 20, 0x679c59);
    this.physics.add.existing(floor, true);
    this.player = this.physics.add.sprite(225, 440, player.avatar).setScale(1.05).setDepth(2);
    this.princess = this.physics.add.sprite(575, 440, 'warrior-princess').setScale(0.95).setDepth(2);
    for (const fighter of [this.player, this.princess]) {
      fighter.body.setSize(55, 85).setOffset((fighter.width - 55) / 2, fighter.height - 85)
        .setGravityY(1000).setCollideWorldBounds(true);
      this.physics.add.collider(fighter, floor);
    }
    this.playerSword = this.add.rectangle(0, 0, 68, 9, 0xa9774c).setStrokeStyle(2, 0x69472f).setDepth(3);
    this.princessSword = this.add.rectangle(0, 0, 68, 9, 0xa9774c).setStrokeStyle(2, 0x69472f).setDepth(3);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,W');
    this.input.keyboard.on('keydown-SPACE', this.swing, this);
    this.input.keyboard.on('keydown-W', this.jump, this);
    this.input.keyboard.on('keydown-UP', this.jump, this);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown-SPACE', this.swing, this);
      this.input.keyboard.off('keydown-W', this.jump, this);
      this.input.keyboard.off('keydown-UP', this.jump, this);
    });
    this.updateScore();
  }

  jump(event) {
    if (this.finished || event.repeat || !this.player.body.blocked.down) return;
    this.player.setVelocityY(-490);
    this.registry.get('soundEffects').play('flightFlap');
  }

  inReach(attacker, target) {
    return Math.abs(attacker.x - target.x) <= REACH && Math.abs(attacker.y - target.y) < 70;
  }

  swing(event) {
    if (this.finished || event.repeat || this.time.now < this.nextPlayerSwing) return;
    this.nextPlayerSwing = this.time.now + 600;
    this.playerSwingUntil = this.time.now + 200;
    this.registry.get('soundEffects').play('star');
    if (this.inReach(this.player, this.princess)) {
      this.princessLives -= 1;
      this.registry.get('soundEffects').play('mosquitoHit');
      this.updateScore();
      if (this.princessLives <= 0) this.finish(true);
    }
  }

  updateScore() {
    this.score.setText(`Dine liv: ${this.playerLives} / ${MAX_HITS}    Prinsessens liv: ${this.princessLives} / ${MAX_HITS}`);
  }

  update(time) {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    this.player.setVelocityX(dx * 230);
    const direction = this.player.x <= this.princess.x ? 1 : -1;
    this.player.setFlipX(direction < 0);
    this.princess.setFlipX(direction > 0);
    const distance = Math.abs(this.player.x - this.princess.x);
    this.princess.setVelocityX(this.princessAttackAt !== null || distance < 75 ? 0 : -direction * 110 * this.difficulty);
    if (this.princessAttackAt === null && distance <= REACH && time >= this.nextPrincessSwing) {
      this.princessAttackAt = time + 450 / this.difficulty;
      this.princess.setTint(0xffd98b);
    }
    if (this.princessAttackAt !== null && time >= this.princessAttackAt) {
      this.princessAttackAt = null;
      this.nextPrincessSwing = time + 1200 / this.difficulty;
      this.princessSwingUntil = time + 200;
      this.princess.clearTint();
      this.registry.get('soundEffects').play('star');
      if (this.inReach(this.princess, this.player)) {
        this.playerLives -= 1;
        this.registry.get('soundEffects').play('trollRockHit');
        this.updateScore();
        if (this.playerLives <= 0) {
          this.finish(false);
          return;
        }
      }
    }
    this.positionSword(this.playerSword, this.player, direction, time < this.playerSwingUntil);
    this.positionSword(this.princessSword, this.princess, -direction, time < this.princessSwingUntil);
  }

  positionSword(sword, fighter, direction, swinging) {
    sword.setPosition(fighter.x + direction * 45, fighter.y + 4)
      .setRotation(direction * (swinging ? 0 : -0.65));
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
