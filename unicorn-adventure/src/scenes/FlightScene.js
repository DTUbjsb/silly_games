import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const FLIGHT_DURATION = 20000;
const MAX_LIVES = 5;
const LAVA_BASE = 526;

export class FlightScene extends Phaser.Scene {
  constructor() {
    super('FlightScene');
  }

  create({ player, players, unicorns, saddles, wings, goingWest, onComplete }) {
    if (!Array.isArray(players) || players.length < 2
      || !Array.isArray(unicorns) || unicorns.length < 2
      || !Array.isArray(saddles) || saddles.length < 2
      || !Array.isArray(wings) || wings.length < 2
      || typeof goingWest !== 'boolean' || typeof onComplete !== 'function'
      || players.slice(0, 2).some((player) => !player.name || !this.textures.exists(player.avatar))
      || [...unicorns.slice(0, 2), ...wings.slice(0, 2)].some((item) => !this.textures.exists(item.texture))
      || saddles.slice(0, 2).some((item) => !this.textures.exists(item.wornTexture ?? item.texture))) {
      throw new Error('Flyveturen mangler spillere, enhjørninger, udstyr eller afslutningsfunktion.');
    }

    this.onComplete = onComplete;
    this.difficulty = minigameSpeed(player?.age);
    this.finished = false;
    this.started = false;
    this.lives = MAX_LIVES;
    this.invulnerableUntil = 0;
    this.elapsed = 0;
    this.musicBeat = 0;
    this.direction = goingWest ? -1 : 1;
    this.makeTextures();

    this.add.rectangle(400, 300, 800, 600, 0x352950);
    this.add.circle(670, 135, 62, 0xffc78d, 0.7);
    this.add.polygon(0, 0, [0, 470, 110, 250, 210, 470, 330, 300, 450, 470,
      570, 235, 730, 470, 800, 355, 800, 600, 0, 600], 0x514166).setOrigin(0);
    this.add.polygon(0, 0, [0, 515, 140, 370, 270, 515, 420, 345, 560, 515,
      680, 380, 800, 515, 800, 600, 0, 600], 0x705063).setOrigin(0);
    this.add.text(400, 22, 'FLYV OVER REVNEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#fff2c6',
    }).setOrigin(0.5);
    this.add.text(400, 52, 'Tryk MELLEMRUM for at begynde og flyve op · Undgå lava og flyveøgler', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5);
    this.scoreText = this.add.text(20, 78, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    });

    const leaderX = goingWest ? 485 : 315;
    this.leader = this.createRider(leaderX, 260, players[0], unicorns[0], saddles[0], wings[0]);
    this.follower = this.createRider(leaderX - this.direction * 150, 260, players[1], unicorns[1], saddles[1], wings[1]);
    this.physics.add.existing(this.leader);
    this.leader.body.setSize(78, 62).setOffset(-39, -31);
    this.leader.body.setGravityY(650);
    this.leader.body.setAllowGravity(false);
    this.trail = [{ time: this.time.now, y: this.leader.y }];
    this.pterodactyls = this.physics.add.group();
    this.physics.add.overlap(this.leader, this.pterodactyls, this.hitBird, undefined, this);
    this.lava = this.add.graphics().setDepth(4);
    this.wind = this.add.graphics().setDepth(1);
    this.drawLava();
    this.updateScore();
    this.input.keyboard.on('keydown-SPACE', this.flap, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown-SPACE', this.flap, this));
    this.time.addEvent({ delay: 2300, loop: true, callback: this.spawnBird, callbackScope: this });
    this.registry.get('soundEffects').play('flightStart');
    this.playMusicBeat();
    this.time.addEvent({ delay: 400, loop: true, callback: this.playMusicBeat, callbackScope: this });
  }

  createRider(x, y, player, unicorn, saddle, wings) {
    const art = this.add.container(0, 0, [
      this.add.image(-12, -30, wings.texture).setScale(0.62),
      this.add.image(0, 0, unicorn.texture).setScale(0.67),
      this.add.image(-4, -11, saddle.wornTexture ?? saddle.texture).setScale(0.52),
      this.add.image(-5, -32, player.avatar).setScale(0.48),
    ]).setScale(this.direction, 1);
    const label = this.add.text(0, -72, player.name, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#443652', padding: { x: 5, y: 2 },
    }).setOrigin(0.5);
    return this.add.container(x, y, [art, label]).setDepth(3);
  }

  makeTextures() {
    if (this.textures.exists('flight-pterodactyl')) {
      return;
    }
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x875576).fillPoints([
      { x: 4, y: 38 }, { x: 20, y: 10 }, { x: 38, y: 27 },
      { x: 50, y: 13 }, { x: 62, y: 27 }, { x: 80, y: 10 },
      { x: 96, y: 38 }, { x: 71, y: 32 }, { x: 58, y: 45 },
      { x: 42, y: 45 }, { x: 29, y: 32 },
    ], true);
    graphics.fillStyle(0x5e3b58).fillEllipse(50, 34, 24, 23);
    graphics.fillStyle(0xffda76).fillTriangle(45, 37, 55, 37, 50, 48);
    graphics.fillStyle(0xffffff).fillCircle(45, 28, 3).fillCircle(55, 28, 3);
    graphics.generateTexture('flight-pterodactyl', 100, 52);
    graphics.destroy();
  }

  flap(event) {
    if (this.finished || event.repeat) {
      return;
    }
    this.started = true;
    this.leader.body.setAllowGravity(true);
    this.leader.body.setVelocityY(-285);
    this.registry.get('soundEffects').play('flightFlap');
  }

  spawnBird() {
    if (this.finished || !this.started) {
      return;
    }
    const x = this.direction < 0 ? -55 : 855;
    const y = Phaser.Math.Between(145, 460);
    const bird = this.pterodactyls.create(x, y, 'flight-pterodactyl');
    bird.body.setSize(70, 32);
    bird.body.setVelocity(-this.direction * 185 * this.difficulty,
      Phaser.Math.Clamp((this.leader.y - y) * 0.06, -20, 20) * this.difficulty);
    this.registry.get('soundEffects').play('flightBird');
  }

  hitBird(leader, bird) {
    if (this.finished || !bird.active) {
      return;
    }
    bird.destroy();
    this.hit('flightBirdHit');
  }

  hit(sound) {
    if (this.finished || this.time.now < this.invulnerableUntil) {
      return;
    }
    this.lives -= 1;
    this.registry.get('soundEffects').play(sound);
    this.updateScore();
    if (this.lives === 0) {
      this.finish(false);
    } else {
      this.invulnerableUntil = this.time.now + 1200;
      this.tweens.add({ targets: this.leader, alpha: 0.3, duration: 100, yoyo: true, repeat: 5 });
    }
  }

  lavaHeight(x) {
    const seconds = this.time.now / 1000;
    return LAVA_BASE - 18 * Math.sin(seconds * 1.8 + x / 100)
      - 16 * (1 + Math.sin(seconds * 0.9));
  }

  drawLava() {
    this.lava.clear();
    this.lava.fillStyle(0xff702f);
    this.lava.beginPath();
    this.lava.moveTo(0, 600);
    for (let x = 0; x <= 800; x += 20) {
      this.lava.lineTo(x, this.lavaHeight(x));
    }
    this.lava.lineTo(800, 600);
    this.lava.closePath();
    this.lava.fillPath();
    this.lava.lineStyle(5, 0xffd06a, 0.9);
    this.lava.beginPath();
    for (let x = 0; x <= 800; x += 20) {
      if (x === 0) {
        this.lava.moveTo(x, this.lavaHeight(x));
      } else {
        this.lava.lineTo(x, this.lavaHeight(x));
      }
    }
    this.lava.strokePath();
  }

  drawWind() {
    this.wind.clear();
    this.wind.lineStyle(2, 0xffe6d1, 0.35);
    for (let index = 0; index < 7; index += 1) {
      const x = Phaser.Math.Wrap(index * 151 - this.direction * this.elapsed * 0.09, -60, 860);
      const y = 145 + (index * 71) % 310;
      this.wind.lineBetween(x, y, x + 36, y);
    }
  }

  updateScore() {
    const seconds = Math.max(0, Math.ceil((FLIGHT_DURATION - this.elapsed) / 1000));
    this.scoreText.setText(`Tid tilbage: ${seconds} sek.    Liv: ${this.lives} / ${MAX_LIVES}`);
  }

  playMusicBeat() {
    if (!this.finished) {
      const notes = ['flightMusicLow', 'flightMusicMid', 'flightMusicHigh', 'flightMusicMid'];
      this.registry.get('soundEffects').play(notes[this.musicBeat++ % notes.length]);
    }
  }

  update(time, delta) {
    if (this.finished) {
      return;
    }
    if (!this.started) {
      return;
    }
    this.elapsed += delta;
    if (this.elapsed >= FLIGHT_DURATION) {
      this.finish(true);
      return;
    }
    if (this.leader.y < 130) {
      this.leader.body.reset(this.leader.x, 130);
    }
    this.trail.push({ time: this.time.now, y: this.leader.y });
    while (this.trail.length > 1 && this.trail[1].time <= this.time.now - 500) {
      this.trail.shift();
    }
    this.follower.y = this.trail[0].y;
    this.drawWind();
    this.drawLava();
    if (this.leader.body.bottom >= this.lavaHeight(this.leader.x)) {
      this.hit('flightLava');
      if (this.finished) {
        return;
      }
      this.leader.body.setVelocityY(-200);
    }
    for (const bird of this.pterodactyls.getChildren()) {
      if (bird.x < -100 || bird.x > 900) {
        bird.destroy();
      }
    }
    this.updateScore();
  }

  finish(won) {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.registry.get('soundEffects').play(won ? 'flightWin' : 'flightLose');
    const onComplete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    this.scene.resume('MainWorldScene');
    onComplete(won);
  }
}
