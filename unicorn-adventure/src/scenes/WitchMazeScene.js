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
const SIZE = 44;
const LEFT = 70;
const TOP = 100;
const PLAYER_SPEED = 145;
const WITCH_SPEED = 65;
const DIRECTIONS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

export function mazePath(start, goal) {
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
      if (MAZE_ROWS[y]?.[x] === '.' && !parents.has(key)) {
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
    if (!player?.name || !this.textures.exists(player.avatar) || typeof onComplete !== 'function') {
      throw new Error('Heksens labyrint mangler en spiller eller afslutningsfunktion.');
    }
    this.onComplete = onComplete;
    this.finished = false;
    this.add.rectangle(400, 300, 800, 600, 0x171b27);
    this.add.text(400, 24, 'HEKSENS LABYRINT', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#e6d6f2',
    }).setOrigin(0.5);
    this.add.text(400, 55, 'Piletaster / WASD: Find udgangen, før heksen fanger dig!', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    MAZE_ROWS.forEach((row, y) => [...row].forEach((tile, x) => {
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
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.registry.get('soundEffects').play('trollMusicLow');
    this.musicBeat = 0;
    this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (!this.finished) {
        this.registry.get('soundEffects').play(this.musicBeat++ % 2 ? 'trollMusicHigh' : 'trollMusicLow');
      }
    } });
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
    const move = moves.find(([pressed, dx, dy]) => pressed && MAZE_ROWS[actor.y + dy]?.[actor.x + dx] === '.');
    return move ? [actor.x + move[1], actor.y + move[2]] : null;
  }

  chooseWitch(actor) {
    const goal = this.runner.next ?? [this.runner.x, this.runner.y];
    const path = mazePath([actor.x, actor.y], goal);
    return path?.[1] ?? null;
  }

  update(time, delta) {
    if (this.finished) return;
    const seconds = Math.min(delta, 50) / 1000;
    this.moveActor(this.runner, PLAYER_SPEED * seconds, (actor) => this.chooseRunner(actor));
    if (this.finished) return;
    this.moveActor(this.witch, WITCH_SPEED * seconds, (actor) => this.chooseWitch(actor));
    if (Phaser.Math.Distance.Between(
      this.runner.sprite.x, this.runner.sprite.y, this.witch.sprite.x, this.witch.sprite.y,
    ) < 24) this.finish(false);
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
