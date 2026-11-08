import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const CAVE_LENGTH = 3600;
const MAX_LIVES = 5;

export class CaveScene extends Phaser.Scene {
  constructor() {
    super('CaveScene');
  }

  create({ player, players, onComplete }) {
    if (!Array.isArray(players) || players.length < 2 || typeof onComplete !== 'function'
      || players.slice(0, 2).some((player) => !player.name || !this.textures.exists(player.avatar))) {
      throw new Error('Hulen mangler spillere eller afslutningsfunktion.');
    }

    this.onComplete = onComplete;
    this.difficulty = minigameSpeed(player?.age);
    this.finished = false;
    this.lives = MAX_LIVES;
    this.invulnerableUntil = 0;
    this.checkpoint = { x: 120, y: 460 };
    this.trail = [];
    this.musicBeat = 0;
    this.physics.world.setBounds(0, 0, CAVE_LENGTH + 100, 800);
    this.cameras.main.setBounds(0, 0, CAVE_LENGTH + 100, 600);
    this.makeEnemyTextures();

    this.add.rectangle(CAVE_LENGTH / 2, 300, CAVE_LENGTH + 800, 600, 0x171b2b);
    for (let x = 0; x < CAVE_LENGTH + 400; x += 200) {
      this.add.triangle(x, 100, 0, 0, 100, 180, 200, 0, 0x29303f).setOrigin(0);
      this.add.triangle(x + 50, 430, 0, 200, 100, 0, 200, 200, 0x222a37).setOrigin(0);
    }
    this.platforms = this.physics.add.staticGroup();
    for (const [left, right] of [[0, 480], [630, 1140], [1290, 1800], [1950, 2460], [2610, 3120], [3270, 3750]]) {
      this.addPlatform(left, right - left, 530, 70);
    }
    for (const x of [555, 1215, 1875, 2535, 3195]) {
      this.addPlatform(x - 50, 100, 470, 20);
    }
    this.add.rectangle(CAVE_LENGTH, 450, 62, 160, 0x294239).setStrokeStyle(5, 0x9dd8ac);
    this.add.text(CAVE_LENGTH, 365, 'UDGANG', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: '#c9ffda',
    }).setOrigin(0.5);

    this.leader = this.physics.add.sprite(120, 450, players[0].avatar).setScale(0.65).setDepth(3);
    this.leader.body.setSize(42, 70).setGravityY(1000).setCollideWorldBounds(false);
    this.follower = this.add.image(65, 450, players[1].avatar).setScale(0.65).setDepth(2).setAlpha(0.9);
    this.physics.add.collider(this.leader, this.platforms);
    this.enemies = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const [x, type] of [
      [820, 'skeleton'], [1430, 'ghost'], [2080, 'skeleton'],
      [2700, 'ghost'], [3370, 'skeleton'],
    ]) {
      const enemy = this.enemies.create(x, type === 'ghost' ? 390 : 498, `cave-${type}`).setDepth(2);
      enemy.setData('originX', x).setData('kind', type);
      enemy.body.setSize(type === 'ghost' ? 42 : 34, 55);
      enemy.body.setVelocityX((type === 'ghost' ? 65 : 48) * this.difficulty);
    }
    this.physics.add.overlap(this.leader, this.enemies, () => this.hit(false), undefined, this);
    this.cameras.main.startFollow(this.leader, true, 0.1, 0);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,W');
    this.input.keyboard.on('keydown-SPACE', this.jump, this);
    this.input.keyboard.on('keydown-W', this.jump, this);
    this.input.keyboard.on('keydown-UP', this.jump, this);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown-SPACE', this.jump, this);
      this.input.keyboard.off('keydown-W', this.jump, this);
      this.input.keyboard.off('keydown-UP', this.jump, this);
    });
    this.add.rectangle(400, 44, 800, 88, 0x111722, 0.88).setScrollFactor(0).setDepth(10);
    this.add.text(400, 18, 'KRYDS DEN MØRKE HULE', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#dcf8e6',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.add.text(400, 45, 'Piletaster / A og D: gå · MELLEMRUM / op / W: hop · Undgå spøgelser og skeletter', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.scoreText = this.add.text(400, 70, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.updateScore();
    this.registry.get('soundEffects').play('trollMusicLow');
    this.time.addEvent({ delay: 800, loop: true, callback: () => {
      if (!this.finished) {
        this.registry.get('soundEffects').play(this.musicBeat++ % 2 ? 'trollMusicHigh' : 'trollMusicLow');
      }
    } });
  }

  addPlatform(left, width, top, height) {
    const platform = this.add.rectangle(left + width / 2, top + height / 2, width, height, 0x4c5052)
      .setStrokeStyle(3, 0x777a72);
    this.physics.add.existing(platform, true);
    this.platforms.add(platform);
  }

  makeEnemyTextures() {
    if (this.textures.exists('cave-ghost') && this.textures.exists('cave-skeleton')) return;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    if (!this.textures.exists('cave-ghost')) {
      graphics.fillStyle(0xd0e9df, 0.9).fillCircle(28, 23, 21).fillRect(7, 23, 42, 26);
      graphics.fillTriangle(7, 49, 17, 58, 24, 49).fillTriangle(29, 49, 39, 58, 49, 49);
      graphics.fillStyle(0x24352f).fillCircle(20, 23, 3).fillCircle(36, 23, 3);
      graphics.generateTexture('cave-ghost', 56, 60);
    }
    graphics.clear();
    if (!this.textures.exists('cave-skeleton')) {
      graphics.fillStyle(0xdcd9c8).fillCircle(28, 13, 12).fillRect(22, 24, 12, 22);
      graphics.fillRect(13, 28, 30, 5).fillRect(16, 44, 8, 15).fillRect(32, 44, 8, 15);
      graphics.fillStyle(0x292a30).fillCircle(24, 11, 3).fillCircle(33, 11, 3);
      graphics.generateTexture('cave-skeleton', 56, 60);
    }
    graphics.destroy();
  }

  jump(event) {
    if (this.finished || event.repeat || !this.leader.body.blocked.down) return;
    this.leader.body.setVelocityY(-510);
    this.registry.get('soundEffects').play('flightFlap');
  }

  hit(fell) {
    if (this.finished || (!fell && this.time.now < this.invulnerableUntil)) return;
    this.lives -= 1;
    this.registry.get('soundEffects').play('trollRockHit');
    this.updateScore();
    if (this.lives <= 0) {
      this.finish(false);
      return;
    }
    this.invulnerableUntil = this.time.now + 1500;
    if (fell) {
      this.leader.body.reset(this.checkpoint.x, this.checkpoint.y);
      this.follower.setPosition(this.checkpoint.x - 55, this.checkpoint.y);
      this.trail = [];
    } else {
      this.leader.body.setVelocityY(-240);
    }
    this.tweens.add({ targets: this.leader, alpha: 0.35, duration: 120, yoyo: true, repeat: 5 });
  }

  updateScore() {
    const distance = Math.min(CAVE_LENGTH, Math.max(0, Math.floor(this.leader.x)));
    this.scoreText.setText(`Afstand: ${distance} / ${CAVE_LENGTH}    Liv: ${this.lives} / ${MAX_LIVES}`);
  }

  update(time) {
    if (this.finished) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    this.leader.body.setVelocityX((Number(right) - Number(left)) * 220);
    if (this.leader.x < 25) this.leader.body.reset(25, this.leader.y);
    if (this.leader.body.blocked.down && this.leader.y < 510) {
      this.checkpoint = { x: this.leader.x, y: this.leader.y - 5 };
    }
    if (this.leader.y > 650) this.hit(true);
    if (this.finished) return;
    if (this.leader.x >= CAVE_LENGTH) {
      this.finish(true);
      return;
    }
    this.trail.push({ time, x: this.leader.x, y: this.leader.y });
    while (this.trail.length > 1 && this.trail[1].time <= time - 350) this.trail.shift();
    this.follower.setPosition(this.trail[0].x - 55, this.trail[0].y);
    for (const enemy of this.enemies.getChildren()) {
      const origin = enemy.getData('originX');
      if (enemy.x < origin - 80) enemy.body.setVelocityX(Math.abs(enemy.body.velocity.x));
      if (enemy.x > origin + 80) enemy.body.setVelocityX(-Math.abs(enemy.body.velocity.x));
      if (enemy.getData('kind') === 'ghost') {
        enemy.body.setVelocityY(Math.cos(time / 650) * 55 * this.difficulty);
      }
    }
    this.updateScore();
  }

  finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'trollWin' : 'trollLose');
    const onComplete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    onComplete(won);
  }
}
