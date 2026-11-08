import { mazePath, WitchMazeScene } from './WitchMazeScene.js';
import { minigameSpeed } from '../systems/MinigameDifficulty.js';

const PLAYER_SPEED = 145;
const CAT_SPEED = 55;
const EXIT = [13, 1];

export class CatMazeScene extends WitchMazeScene {
  constructor() {
    super('CatMazeScene');
  }

  create({ player, onComplete }) {
    if (!player?.name || !this.textures.exists(player.avatar) || !this.textures.exists('red-cat')
      || typeof onComplete !== 'function') {
      throw new Error('Kattens labyrint mangler en spiller, kat eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.finished = false;
    this.escaped = false;
    this.difficulty = minigameSpeed(player.age);
    this.selectMaze();
    this.add.rectangle(400, 300, 800, 600, 0x321f2b);
    this.add.text(400, 24, 'FANG ILDKATTEN', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe2a6',
    }).setOrigin(0.5);
    this.add.text(400, 55, 'Piletaster / WASD: Fang katten, før den når udgangen!', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    this.mazeRows.forEach((row, y) => [...row].forEach((tile, x) => {
      const [px, py] = this.toWorld(x, y);
      this.add.rectangle(px, py, 43, 43, tile === '#' ? 0x70483c : 0x392c30)
        .setStrokeStyle(1, tile === '#' ? 0xba7450 : 0x5d403b);
    }));
    const [exitX, exitY] = this.toWorld(...EXIT);
    this.add.rectangle(exitX, exitY, 35, 38, 0xffb659).setStrokeStyle(3, 0xffe6a3);
    this.add.text(exitX, exitY, 'UD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#5d281c',
    }).setOrigin(0.5);
    this.runner = this.makeActor(1, 1, player.avatar, 0.39);
    this.cat = this.makeActor(1, 9, 'red-cat', 0.52);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.registry.get('soundEffects').play('catMeow');
    this.musicBeat = 0;
    this.time.addEvent({ delay: 500, loop: true, callback: () => {
      if (!this.finished) this.registry.get('soundEffects').play(this.musicBeat++ % 2 ? 'worldVolcanoHigh' : 'worldVolcanoLow');
    } });
  }

  onActorArrived(actor) {
    if (actor === this.cat && actor.x === EXIT[0] && actor.y === EXIT[1]) this.escaped = true;
  }

  update(time, delta) {
    if (this.finished) return;
    const seconds = Math.min(delta, 50) / 1000;
    this.moveActor(this.runner, PLAYER_SPEED * seconds, (actor) => this.chooseRunner(actor));
    const caught = () => Phaser.Math.Distance.Between(
      this.runner.sprite.x, this.runner.sprite.y, this.cat.sprite.x, this.cat.sprite.y,
    ) < 24;
    if (caught()) {
      this.finish(true);
      return;
    }
    this.moveActor(this.cat, CAT_SPEED * this.difficulty * seconds,
      (actor) => mazePath([actor.x, actor.y], EXIT, this.mazeRows)?.[1] ?? null);
    if (caught()) this.finish(true);
    else if (this.escaped) this.finish(false);
  }
}
