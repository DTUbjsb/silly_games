import { minigameSpeed } from '../systems/MinigameDifficulty.js';

export const MAZE_ROWS = [
  '###############',
  '#.....#.......#',
  '#.###.#.#####.#',
  '#...#.#.....#.#',
  '###.#.#####.#.#',
  '#...#.....#...#',
  '#.#######.###.#',
  '#.......#...#.#',
  '#.#####.###.#.#',
  '#.............#',
  '###############',
];
export const MAZE_LAYOUTS = [
  MAZE_ROWS,
  MAZE_ROWS.map((row) => [...row].reverse().join('')),
  [...MAZE_ROWS].reverse(),
  [...MAZE_ROWS].reverse().map((row, y) => {
    const reversed = [...row].reverse();
    if (y === 9) reversed[8] = '.';
    if (y === 6) reversed[13] = '.';
    return reversed.join('');
  }),
];
const SIZE = 44;
const LEFT = 70;
const TOP = 100;
const PLAYER_SPEED = 145;
const WITCH_SPEED = 65;
const BLACK_CAT_SPEED = 55;
const CAT_FLEE_TIME = 5000;
const DIRECTIONS = [[1, 0], [0, -1], [-1, 0], [0, 1]];

export function mazePath(start, goal, rows = MAZE_ROWS) {
  const queue = [start];
  const parents = new Map([[start.join(','), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const position = queue[index];
    if (position[0] === goal[0] && position[1] === goal[1]) {
      const path = [];
      let key = position.join(',');
      while (key !== null) {
        path.push(key.split(',').map(Number));
        key = parents.get(key);
      }
      return path.reverse();
    }
    for (const [dx, dy] of DIRECTIONS) {
      const x = position[0] + dx;
      const y = position[1] + dy;
      const key = `${x},${y}`;
      if (rows[y]?.[x] === '.' && !parents.has(key)) {
        parents.set(key, position.join(','));
        queue.push([x, y]);
      }
    }
  }
  return null;
}

export class WitchMazeScene extends Phaser.Scene {
  constructor(key = 'WitchMazeScene') {
    super(key);
  }

  create({ player, onComplete }) {
    if (!player?.name || !this.textures.exists(player.avatar) || !this.textures.exists('black-cat')
      || typeof onComplete !== 'function') {
      throw new Error('Heksens labyrint mangler en spiller eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.finished = false;
    this.difficulty = minigameSpeed(player.age);
    this.selectMaze();
    this.captured = false;
    this.catFleeRemaining = 0;
    this.add.rectangle(400, 300, 800, 600, 0x171b27);
    this.add.text(400, 24, 'HEKSENS LABYRINT', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#e6d6f2',
    }).setOrigin(0.5);
    this.add.text(400, 55, 'Piletaster / WASD: Find udgangen, og undgå heksen og den sorte kat!', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    this.mazeRows.forEach((row, y) => [...row].forEach((tile, x) => {
      const [px, py] = this.toWorld(x, y);
      this.add.rectangle(px, py, SIZE - 1, SIZE - 1, tile === '#' ? 0x46534a : 0x242b2c)
        .setStrokeStyle(1, tile === '#' ? 0x697368 : 0x303b36);
    }));
    const [exitX, exitY] = this.toWorld(13, 9);
    this.add.rectangle(exitX, exitY, 35, 38, 0x7bc791).setStrokeStyle(3, 0xd1ffdc);
    this.add.text(exitX, exitY, 'UD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#173a25',
    }).setOrigin(0.5);
    this.runner = this.makeActor(1, 1, player.avatar, 0.39);
    this.witch = this.makeActor(13, 1, 'witch', 0.42);
    this.blackCat = this.makeActor(1, 9, 'black-cat', 0.52);
    this.wiggleText = this.add.text(400, 580, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#171b27',
    }).setOrigin(0.5).setDepth(4);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown', this.handleWiggle, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.handleWiggle, this));
    this.registry.get('soundEffects').play('trollMusicLow');
    this.musicBeat = 0;
    this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (!this.finished) {
        this.registry.get('soundEffects').play(this.musicBeat++ % 2 ? 'trollMusicHigh' : 'trollMusicLow');
      }
    } });
  }

  selectMaze() {
    this.mazeIndex = this.mazeIndex === undefined
      ? Math.floor(Math.random() * MAZE_LAYOUTS.length) : (this.mazeIndex + 1) % MAZE_LAYOUTS.length;
    this.mazeRows = MAZE_LAYOUTS[this.mazeIndex];
  }

  toWorld(x, y) {
    return [LEFT + x * SIZE + SIZE / 2, TOP + y * SIZE + SIZE / 2];
  }

  makeActor(x, y, texture, scale) {
    const [px, py] = this.toWorld(x, y);
    return { x, y, next: null, progress: 0, sprite: this.add.image(px, py, texture).setScale(scale).setDepth(2) };
  }

  moveActor(actor, distance, choose) {
    while (distance > 0) {
      if (!actor.next) {
        actor.next = choose(actor);
        if (!actor.next) break;
      }
      const step = Math.min(distance, SIZE - actor.progress);
      actor.progress += step;
      distance -= step;
      const [startX, startY] = this.toWorld(actor.x, actor.y);
      const [endX, endY] = this.toWorld(...actor.next);
      actor.sprite.setPosition(
        Phaser.Math.Linear(startX, endX, actor.progress / SIZE),
        Phaser.Math.Linear(startY, endY, actor.progress / SIZE),
      );
      if (actor.progress >= SIZE) {
        [actor.x, actor.y] = actor.next;
        actor.next = null;
        actor.progress = 0;
        this.onActorArrived(actor);
        if (this.finished) return;
      }
    }
  }

  onActorArrived(actor) {
    if (actor === this.runner && actor.x === 13 && actor.y === 9) this.finish(true);
  }

  chooseRunner(actor) {
    const moves = [
      [this.cursors.up.isDown || this.keys.W.isDown, 0, -1],
      [this.cursors.left.isDown || this.keys.A.isDown, -1, 0],
      [this.cursors.right.isDown || this.keys.D.isDown, 1, 0],
      [this.cursors.down.isDown || this.keys.S.isDown, 0, 1],
    ];
    const move = moves.find(([pressed, dx, dy]) => pressed && this.mazeRows[actor.y + dy]?.[actor.x + dx] === '.');
    return move ? [actor.x + move[1], actor.y + move[2]] : null;
  }

  chooseWitch(actor) {
    const goal = this.runner.next ?? [this.runner.x, this.runner.y];
    const path = mazePath([actor.x, actor.y], goal, this.mazeRows);
    return path?.[1] ?? null;
  }

  captureByCat() {
    this.captured = true;
    this.wiggles = { left: 0, right: 0 };
    this.lastWiggle = null;
    this.updateWiggleText();
    this.registry.get('soundEffects').play('catMeow');
  }

  updateWiggleText() {
    this.wiggleText.setText(`Katten holder dig! Vrik skiftevis venstre / højre: ${this.wiggles.left} / 5 · ${this.wiggles.right} / 5`);
  }

  handleWiggle(event) {
    if (!this.captured || event.repeat) return;
    const direction = ['ArrowLeft', 'a', 'A'].includes(event.key) ? 'left'
      : ['ArrowRight', 'd', 'D'].includes(event.key) ? 'right' : null;
    if (!direction || direction === this.lastWiggle || this.wiggles[direction] >= 5) return;
    this.lastWiggle = direction;
    this.wiggles[direction] += 1;
    this.updateWiggleText();
    if (this.wiggles.left === 5 && this.wiggles.right === 5) {
      this.captured = false;
      this.catFleeRemaining = CAT_FLEE_TIME;
      const runnerPosition = this.runner.next ?? [this.runner.x, this.runner.y];
      let longest = -1;
      this.mazeRows.forEach((row, y) => [...row].forEach((tile, x) => {
        if (tile !== '.') return;
        const path = mazePath(runnerPosition, [x, y], this.mazeRows);
        if (path && path.length > longest) {
          longest = path.length;
          this.catFleeGoal = [x, y];
        }
      }));
      if (this.blackCat.next) {
        const fromStart = mazePath([this.blackCat.x, this.blackCat.y], this.catFleeGoal, this.mazeRows);
        const fromNext = mazePath(this.blackCat.next, this.catFleeGoal, this.mazeRows);
        if (this.blackCat.progress + (fromStart.length - 1) * SIZE
          < SIZE - this.blackCat.progress + (fromNext.length - 1) * SIZE) {
          const previous = [this.blackCat.x, this.blackCat.y];
          [this.blackCat.x, this.blackCat.y] = this.blackCat.next;
          this.blackCat.next = previous;
          this.blackCat.progress = SIZE - this.blackCat.progress;
        }
      }
      this.wiggleText.setText('Du er fri! Den sorte kat flygter.');
    }
  }

  update(time, delta) {
    if (this.finished) return;
    const seconds = Math.min(delta, 50) / 1000;
    if (this.captured) return;
    this.moveActor(this.runner, PLAYER_SPEED * seconds, (actor) => this.chooseRunner(actor));
    if (this.finished) return;
    this.moveActor(this.witch, WITCH_SPEED * this.difficulty * seconds, (actor) => this.chooseWitch(actor));
    if (Phaser.Math.Distance.Between(
      this.runner.sprite.x, this.runner.sprite.y, this.witch.sprite.x, this.witch.sprite.y,
    ) < 24) {
      this.finish(false);
      return;
    }
    if (this.catFleeRemaining > 0) {
      this.catFleeRemaining = Math.max(0, this.catFleeRemaining - Math.min(delta, 50));
      this.moveActor(this.blackCat, BLACK_CAT_SPEED * this.difficulty * seconds,
        (actor) => mazePath([actor.x, actor.y], this.catFleeGoal, this.mazeRows)?.[1] ?? null);
      if (this.catFleeRemaining === 0) this.wiggleText.setText('');
    } else {
      this.moveActor(this.blackCat, BLACK_CAT_SPEED * this.difficulty * seconds, (actor) => this.chooseWitch(actor));
      if (Phaser.Math.Distance.Between(
        this.runner.sprite.x, this.runner.sprite.y, this.blackCat.sprite.x, this.blackCat.sprite.y,
      ) < 24) this.captureByCat();
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
