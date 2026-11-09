import { createGameConfig } from '../src/config.js';
import { TEST_WORLD_DATA, WORLD_GATES, WORLD_TILE, WEST_CRACK, WEST_REGION_DATA, WEST_REGION_WIDTH,
  NORTH_HOLE, NORTH_REGION_DATA, NORTH_REGION_HEIGHT, EAST_ORIGIN, EAST_REGION_DATA, EAST_REGION_WIDTH, LAKE,
  SOUTH_ORIGIN, SOUTH_PASS, SOUTH_REGION_DATA, DRAGON_DEN } from '../src/data/testWorld.js';
import { CollectionStore } from '../src/managers/CollectionStore.js';
import { GameStateManager } from '../src/managers/GameStateManager.js';
import { SoundEffects } from '../src/audio/SoundEffects.js';
import { arrangeCollectibles } from '../src/data/collectibleLayout.js';
import { mazePath, MAZE_LAYOUTS } from '../src/scenes/WitchMazeScene.js';
import { CatMazeScene } from '../src/scenes/CatMazeScene.js';
import { minigameSpeed } from '../src/systems/MinigameDifficulty.js';
import { NorthFollowerNavigator } from '../src/systems/NorthFollowerNavigator.js';
import { wizardTeam } from '../src/systems/WizardTeam.js';
import { UnicornSpeedBoost } from '../src/systems/UnicornSpeedBoost.js';
import { guideLines } from '../src/systems/GuideGnomes.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testSpeedBoostRules() {
  const white = { texture: 'unicorn-purple' };
  const rainbow = { texture: 'unicorn-rainbow-rose' };
  const dark = { texture: 'unicorn-dark-red' };
  const volcano = { texture: 'unicorn-volcano-flame' };
  const saddles = [{ slot: 'saddle' }, { slot: 'saddle' }];
  const boost = new UnicornSpeedBoost();
  assert(boost.getIndicator([white, rainbow], saddles.slice(0, 1)) === null, 'An unavailable boost showed an indicator.');
  let indicator = boost.getIndicator([white, rainbow], saddles);
  assert(indicator.phase === 'ready' && indicator.progress === 1 && indicator.durationSeconds === 2
    && indicator.mounts[0] === white && indicator.mounts[1] === rainbow, 'Ready bar selected the wrong mounts.');
  assert(!boost.activate([white, rainbow], saddles.slice(0, 1))
    && !boost.activate([dark, volcano], saddles), 'Boost accepted missing saddles or an invalid mixed pair.');
  assert(boost.activate([white, rainbow], saddles) && boost.multiplier === 1.5 && boost.remaining === 2000,
    'White/rainbow boost has incorrect requirements or duration.');
  assert(boost.mounts[0] === white && boost.mounts[1] === rainbow, 'Basic boost chose the wrong mounts.');
  boost.update(1000);
  indicator = boost.getIndicator([dark, dark], saddles);
  assert(indicator.phase === 'active' && indicator.progress === 0.5 && indicator.durationSeconds === 2
    && indicator.mounts[0] === white && indicator.mounts[1] === rainbow,
  'Active bar or riding pair changed before the boost ended.');
  boost.update(999);
  assert(boost.multiplier === 1.5 && boost.remaining === 1 && !boost.activate([white, rainbow], saddles),
    'Boost expired early or allowed activation during cooldown.');
  boost.update(1);
  assert(boost.multiplier === 1 && boost.cooldown === 8000, 'Basic boost did not end after exactly two seconds.');
  indicator = boost.getIndicator([dark, dark], saddles);
  assert(indicator.phase === 'recharging' && indicator.progress === 0 && indicator.durationSeconds === 4
    && indicator.mounts[0] === dark,
    'Basic bar did not empty or update the available pair after the boost.');
  boost.update(4000);
  assert(boost.getIndicator([dark, dark], saddles).progress === 0.5, 'Basic bar did not refill over eight seconds.');
  boost.update(3999);
  assert(!boost.activate([dark, dark], saddles), 'Boost cooldown ended early.');
  boost.update(1);
  assert(boost.activate([dark, dark], saddles) && boost.multiplier === 1.5 && boost.remaining === 4000,
    'Dark boost has incorrect speed or duration.');
  assert(boost.mounts.length === 2 && boost.mounts.every((item) => item === dark), 'Dark boost chose the wrong mounts.');
  boost.update(2000);
  assert(boost.getIndicator([dark, dark], saddles).progress === 0.5, 'Dark bar did not deplete over four seconds.');
  boost.update(1999);
  assert(boost.multiplier === 1.5, 'Dark boost ended early.');
  boost.update(1);
  assert(boost.multiplier === 1 && boost.cooldown === 6000, 'Dark boost or cooldown has incorrect timing.');
  assert(boost.getIndicator([dark, dark], saddles).progress === 0, 'Dark bar was not empty after the boost.');
  boost.update(3000);
  assert(boost.getIndicator([dark, dark], saddles).progress === 0.5, 'Dark bar did not refill over six seconds.');
  boost.update(3000);
  assert(boost.activate([white, rainbow, dark, dark, volcano, volcano], saddles)
    && boost.multiplier === 2 && boost.remaining === 4000, 'Volcano boost did not take priority.');
  assert(boost.mounts.length === 2 && boost.mounts.every((item) => item === volcano), 'Volcano boost chose the wrong mounts.');
  boost.update(2000);
  assert(boost.getIndicator([volcano, volcano], saddles).progress === 0.5,
    'Volcano bar did not deplete over four seconds.');
  boost.update(2000);
  assert(boost.multiplier === 1 && boost.cooldown === 6000, 'Volcano boost did not end after four seconds.');
  boost.update(3000);
  assert(boost.getIndicator([volcano, volcano], saddles).progress === 0.5, 'Volcano bar did not refill over six seconds.');
  boost.update(3000);
  assert(boost.getIndicator([volcano, volcano], saddles).phase === 'ready', 'Recharged bar did not return to ready.');
}

function testGuideGnomes(world) {
  const gnomes = world.npcManager.npcs.filter((npc) => npc.avatar === 'guide-gnome');
  assert(gnomes.length === 10 && world.textures.exists('guide-gnome'), 'Guide gnomes or artwork are missing.');
  const state = { unicorns: [], accessories: [], tools: [], southOpen: false, dragonRescued: false, princess: false };
  const speedLine = guideLines('guide-speed', state)[1];
  assert(speedLine.includes('2 sekunder') && speedLine.match(/4 sekunder/g)?.length === 2,
    'Speed guide did not explain both boost durations.');
  assert(guideLines('guide-dark', { ...state, unicorns: [{ texture: 'unicorn-dark-red' }] })[0].includes('4 sekunder')
    && guideLines('guide-volcano', { ...state, unicorns: [{ texture: 'unicorn-volcano-flame' }] })[0].includes('4 sekunder'),
  'Regional guides did not explain the four-second boost.');
  for (const npc of gnomes) {
    const lines = guideLines(npc.id, state);
    assert(lines.length >= 2 && /høhø/i.test(lines[lines.length - 1]), `${npc.id} is missing guidance or a joke.`);
    if (npc.y < 0) assert(canReachNorth(reachableNorth(false), npc), `${npc.id} is unreachable in the north.`);
  }
  assert(guideLines('guide-lake', state)[0].includes('lommelygten')
    && guideLines('guide-north', state)[0].includes('øen')
    && guideLines('guide-rainbow', state)[0].includes('lavastøvler')
    && guideLines('guide-east', state)[0].includes('lavastøvler')
    && guideLines('guide-wizard', state)[0].includes('fire sadler')
    && guideLines('guide-dragon', state)[0].includes('krigerprinsessen'), 'Early guidance is incomplete.');
  const ready = { ...state, princess: true, southOpen: true,
    tools: [{ kind: 'bow-and-arrow' }, { kind: 'bow-and-arrow' }] };
  assert(guideLines('guide-dragon', ready)[0].includes('fire spørgsmål')
    && guideLines('guide-wizard', ready)[0].includes('dragens hule'), 'Guidance did not advance to the dragon.');
  for (const npc of gnomes.filter((item) => item.id !== 'guide-speed')) {
    assert(guideLines(npc.id, { ...ready, dragonRescued: true })[0].includes('Prinsen er fri'),
      `${npc.id} did not acknowledge the rescue.`);
  }
  const speedGuide = gnomes.find((npc) => npc.id === 'guide-speed');
  world.npcManager.runInteraction(speedGuide);
  assert(world.dialogueWindow.message.text.includes('fartboost'), 'Speed guide did not explain the boost.');
  while (world.dialogueWindow.isOpen) world.dialogueWindow.advance();
  world.npcManager.runInteraction(speedGuide);
  assert(world.dialogueWindow.message.text.includes('fartboost'), 'Guide did not repeat the guidance.');
  world.dialogueWindow.close();
  const lakeGuide = gnomes.find((npc) => npc.id === 'guide-lake');
  const savedIds = world.collectibleManager.collectedIds;
  try {
    world.npcManager.runInteraction(lakeGuide);
    assert(world.dialogueWindow.message.text.includes('lommelygten'), 'Lake guide did not mention the flashlight.');
    world.dialogueWindow.close();
    world.collectibleManager.collectedIds = new Set([...savedIds, 'flashlight']);
    world.npcManager.runInteraction(lakeGuide);
    assert(world.dialogueWindow.message.text.includes('I har lommelygten'),
      'Lake guide did not update after collecting the flashlight.');
    world.dialogueWindow.close();
  } finally {
    world.collectibleManager.collectedIds = savedIds;
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
  }
}

async function testWorldBoost(world) {
  const collection = world.collectibleManager;
  const savedIds = collection.collectedIds;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const pickupBodies = collection.pickups.getChildren().map((pickup) => ({ body: pickup.body, enabled: pickup.body.enable }));
  const leaderId = world.player.id;
  const gnome = world.npcManager.npcs.find((npc) => npc.id === 'guide-speed');
  const items = collection.getAllItems();
  const unicorns = items.filter((item) => item.type === 'unicorn' && !item.texture.startsWith('unicorn-rainbow-')
    && !item.texture.startsWith('unicorn-dark-') && !item.texture.startsWith('unicorn-volcano-')).slice(0, 2);
  const saddles = items.filter((item) => item.type === 'accessory' && item.slot === 'saddle').slice(0, 2);
  try {
    pickupBodies.forEach(({ body }) => { body.enable = false; });
    collection.collectedIds = new Set([...unicorns, ...saddles].map((item) => item.id));
    world.hud.setBoostStatus(world.speedBoost.getIndicator(unicorns, saddles));
    assert(!world.hud.boostBar.hidden && world.hud.boostBar.dataset.phase === 'ready'
      && world.hud.boostFill.style.width === '100%'
      && world.hud.boostLabel.textContent.includes('2 sek.')
      && world.hud.boostMounts.every((image, index) => image.dataset.texture === unicorns[index].texture
        && image.alt === unicorns[index].name), 'Ready HUD did not show the selected unicorns and full bar.');
    world.player.sprite.body.reset(gnome.x, gnome.y);
    world.npcManager.update(world.player);
    world.handleKeyboardInput({ code: 'Space', repeat: false });
    assert(world.dialogueWindow.isOpen && world.speedBoost.cooldown === 0, 'SPACE boosted instead of interacting with a gnome.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(NORTH_HOLE.x, 58);
    world.npcManager.update(world.player, true);
    world.handleKeyboardInput({ code: 'Space', repeat: false });
    assert(world.dialogueWindow.isOpen && world.dialogueWindow.message.text.includes('lommelygten')
      && world.speedBoost.cooldown === 0, 'SPACE boosted instead of interacting with the northern entrance.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(800, 800);
    world.npcManager.update(world.player);
    world.handleKeyboardInput({ code: 'Space', repeat: true });
    assert(world.speedBoost.cooldown === 0, 'A repeated key activated the boost.');
    world.handleKeyboardInput({ code: 'Space', repeat: false });
    assert(world.speedBoost.cooldown === 10000 && world.speedBoost.multiplier === 1.5,
      'SPACE did not activate an eligible boost in the world.');
    world.hud.setBoostStatus(world.speedBoost.getIndicator(unicorns, saddles));
    assert(world.hud.boostBar.dataset.phase === 'active' && world.hud.boostLabel.textContent.includes('2 / 2 sek.')
      && world.hud.boostTrack.getAttribute('aria-valuenow') === '100', 'Active HUD did not start full.');
    const barTest = new UnicornSpeedBoost();
    barTest.activate(unicorns, saddles);
    barTest.update(2000);
    world.hud.setBoostStatus(barTest.getIndicator(unicorns, saddles));
    assert(world.hud.boostLabel.textContent === 'Lader op: 8 sek. · Boost: 2 sek.',
      'Recharging HUD did not show the cooldown and next boost duration.');
    world.updateMountedPlayers();
    for (const [index, player] of world.players.entries()) {
      const mount = world.mountedPlayers.get(player);
      assert(!player.sprite.visible && mount.list[0].texture.key === unicorns[index].texture
        && mount.list[2].texture.key === player.avatar && mount.x === player.sprite.x && mount.y === player.sprite.y,
      'Mounted appearance did not preserve the player avatar, unicorn or position.');
    }
    world.dialogueWindow.showLines('Prøve', ['Vent']);
    const remaining = world.speedBoost.remaining;
    const cooldown = world.speedBoost.cooldown;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(world.speedBoost.remaining === remaining && world.speedBoost.cooldown === cooldown,
      'Boost or cooldown elapsed while dialogue was open.');
    assert(world.hud.boostBar.hidden, 'Boost bar covered the dialogue window.');
    world.dialogueWindow.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(world.speedBoost.remaining < remaining && world.speedBoost.cooldown < cooldown,
      'Boost or cooldown did not resume after dialogue.');
    const paused = new Promise((resolve) => world.events.once('pause', resolve));
    world.scene.pause();
    await paused;
    assert(world.hud.boostBar.hidden, 'Boost bar remained visible in another scene.');
    const pausedRemaining = world.speedBoost.remaining;
    const pausedCooldown = world.speedBoost.cooldown;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(world.speedBoost.remaining === pausedRemaining && world.speedBoost.cooldown === pausedCooldown,
      'Boost or cooldown elapsed while the world was paused.');
    const resumed = new Promise((resolve) => world.events.once('resume', resolve));
    world.scene.resume();
    await resumed;
    world.movement.keys.D.isDown = true;
    world.movement.update(world.speedBoost.multiplier);
    assert(Math.abs(world.player.sprite.body.velocity.x - 363) < 0.01, 'Boost did not increase world movement by 50%.');
    world.swapLeader();
    world.movement.update(world.speedBoost.multiplier);
    assert(Math.abs(world.player.sprite.body.velocity.x - 363) < 0.01, 'Boost was lost when changing leader.');
    world.updateMountedPlayers();
    assert(world.mountedPlayers.get(world.player).list[2].texture.key === world.player.avatar,
      'Swapping leaders changed a rider’s hair or identity.');
    world.swapLeader();
    const volcanic = items.filter((item) => item.type === 'unicorn' && item.texture.startsWith('unicorn-volcano-')).slice(0, 2);
    collection.collectedIds = new Set([...volcanic, ...saddles].map((item) => item.id));
    world.speedBoost.update(10000);
    world.updateMountedPlayers();
    assert(world.mountedPlayers.size === 0 && world.players.every((player) => player.sprite.visible),
      'Players did not return to their normal appearance after the boost.');
    world.speedBoost = new UnicornSpeedBoost();
    assert(world.speedBoost.activate(volcanic, saddles), 'Could not activate volcano boost.');
    world.hud.setBoostStatus(world.speedBoost.getIndicator(volcanic, saddles));
    assert(world.hud.boostLabel.textContent.includes('4 / 4 sek.'), 'Volcano HUD did not show the four-second duration.');
    world.updateMountedPlayers();
    assert(world.players.every((player, index) => world.mountedPlayers.get(player).list[0].texture.key === volcanic[index].texture),
      'Volcano boost did not show the volcanic unicorns.');
    world.movement.update(world.speedBoost.multiplier);
    assert(Math.abs(world.player.sprite.body.velocity.x - 484) < 0.01, 'Volcano boost did not double world speed.');
    world.movement.keys.D.isDown = false;
    world.player.sprite.body.reset(160, 1600);
    world.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert(world.player.sprite.body.left >= -1 && world.player.sprite.x < 40,
      'Boosted player could not reach or passed through the western wall.');
  } finally {
    world.movement.keys.D.isDown = false;
    world.movement.keys.A.isDown = false;
    world.speedBoost = new UnicornSpeedBoost();
    world.updateMountedPlayers();
    collection.collectedIds = savedIds;
    pickupBodies.forEach(({ body, enabled }) => { body.enable = enabled; });
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.npcManager.update(world.player);
  }
}

function testCatMazeLayouts() {
  for (const rows of MAZE_LAYOUTS) {
    for (const age of [6, 7, 8]) {
      for (const chasing of [false, true]) {
        const scene = Object.create(CatMazeScene.prototype);
        Object.assign(scene, {
          mazeRows: rows, difficulty: minigameSpeed(age), finished: false, escaped: false,
          cursors: { up: {}, down: {}, left: {}, right: {} },
          keys: { W: {}, A: {}, S: {}, D: {} },
          finish(won) { this.finished = true; this.won = won; },
        });
        const actor = (x, y) => {
          const [px, py] = scene.toWorld(x, y);
          return {
            x, y, next: null, progress: 0,
            sprite: { x: px, y: py, setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; } },
          };
        };
        scene.runner = actor(1, 1);
        scene.cat = actor(1, 9);
        for (let frame = 0; frame < 1500 && !scene.finished; frame += 1) {
          if (chasing && !scene.runner.next) {
            const next = mazePath([scene.runner.x, scene.runner.y], [13, 1], rows)?.[1];
            scene.keys.W.isDown = Boolean(next && next[1] < scene.runner.y);
            scene.keys.S.isDown = Boolean(next && next[1] > scene.runner.y);
            scene.keys.A.isDown = Boolean(next && next[0] < scene.runner.x);
            scene.keys.D.isDown = Boolean(next && next[0] > scene.runner.x);
          }
          scene.update(0, 50);
        }
        assert(scene.finished && scene.won === chasing && scene.escaped !== chasing,
          `Cat maze could not ${chasing ? 'be won' : 'be lost'} at age ${age}.`);
      }
    }
  }
}

async function testSoundSynthesis() {
  const names = [
    'troll', 'fairy', 'unicorn', 'wings', 'crown', 'saddlePickup', 'stickerPickup', 'star',
    'mosquitoHit', 'mosquitoEscape', 'mosquitoStart', 'mosquitoWin', 'mosquitoLose',
    'questionCorrect', 'footstep', 'accessoryAttach', 'npcNearby',
    'trollThrow', 'trollRockHit', 'trollApple', 'trollWin', 'trollLose', 'trollMusicLow', 'trollMusicHigh',
    'flightStart', 'flightFlap', 'flightBird', 'flightBirdHit', 'flightLava',
    'flightWin', 'flightLose', 'flightMusicLow', 'flightMusicMid', 'flightMusicHigh',
    'lakeStart', 'lakePaddle', 'lakeFish', 'lakeMonster', 'lakeHit', 'lakeWin', 'lakeLose',
    'lakeMusicLow', 'lakeMusicMid', 'lakeMusicHigh',
    'worldHappyC', 'worldHappyE', 'worldHappyF', 'worldHappyG', 'worldHappyA',
    'worldDarkLow', 'worldDarkMid', 'worldDarkHigh', 'worldVolcanoLow', 'worldVolcanoHigh', 'catMeow',
  ];
  for (const name of names) {
    const audio = new OfflineAudioContext(1, 44100, 44100);
    const context = {
      state: 'running', currentTime: 0, sampleRate: audio.sampleRate,
      createGain: audio.createGain.bind(audio),
      createBuffer: audio.createBuffer.bind(audio),
      createBufferSource: audio.createBufferSource.bind(audio),
      createBiquadFilter: audio.createBiquadFilter.bind(audio),
      createOscillator: audio.createOscillator.bind(audio),
    };
    const effects = new SoundEffects({ context, locked: false, destination: audio.destination });
    effects.play(name);
    const samples = (await audio.startRendering()).getChannelData(0);
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    assert(peak > 0.01 && peak < 0.5, `${name} is silent or too loud.`);
  }
  const audio = new OfflineAudioContext(1, 44100, 44100);
  let time = 0;
  const context = {
    state: 'running', get currentTime() { return time; },
    createGain: audio.createGain.bind(audio),
    createOscillator: audio.createOscillator.bind(audio),
  };
  const effects = new SoundEffects({ context, locked: false, destination: audio.destination });
  const buzz = effects.startMosquitoBuzz();
  time = 0.4;
  buzz.stop();
  const samples = (await audio.startRendering()).getChannelData(0);
  const peak = samples.slice(4410, 13230).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const afterStop = samples.slice(22050).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  assert(peak > 0.01 && peak < 0.1 && afterStop < 0.00001,
    'Mosquito buzz was silent, too loud, or continued after stopping.');
}

function reachable(openGates) {
  const start = [9, 7];
  const visited = new Set([start.join(',')]);
  const queue = [start];
  const blockedGates = Object.values(WORLD_GATES).filter((gate) => !openGates.includes(gate));
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      const tile = TEST_WORLD_DATA[nextY]?.[nextX];
      const key = `${nextX},${nextY}`;
      if (
        tile !== undefined && tile !== WORLD_TILE.FOREST && tile !== WORLD_TILE.WATER
        && !blockedGates.includes(tile) && !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nextX, nextY]);
      }
    }
  }
  return visited;
}

function canReach(visited, item) {
  return visited.has(`${Math.floor(item.x / 32)},${Math.floor(item.y / 32)}`);
}

function reachableWest(openGates) {
  const queue = [[29, 12]];
  const visited = new Set([queue[0].join(',')]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      const tile = WEST_REGION_DATA[nextY]?.[nextX];
      const key = `${nextX},${nextY}`;
      if (tile !== undefined && ![WORLD_TILE.FOREST, WORLD_TILE.WATER, WORLD_TILE.WEST_WALL].includes(tile)
        && (![WORLD_TILE.WEST_BRIDGE, WORLD_TILE.WEST_FOREST_GATE].includes(tile) || openGates.includes(tile))
        && !visited.has(key)) {
        visited.add(key);
        queue.push([nextX, nextY]);
      }
    }
  }
  return visited;
}

function canReachWest(visited, item) {
  return visited.has(`${Math.floor(item.x / 32) + WEST_REGION_WIDTH},${Math.floor(item.y / 32)}`);
}

function reachableNorth(openGate) {
  const start = [Math.floor(NORTH_HOLE.x / 32) + WEST_REGION_WIDTH, NORTH_REGION_HEIGHT - 3];
  const queue = [start];
  const visited = new Set([start.join(',')]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const tile = NORTH_REGION_DATA[ny]?.[nx];
      const key = `${nx},${ny}`;
      if (tile !== undefined && tile !== WORLD_TILE.DARK_TREE && tile !== WORLD_TILE.WEST_WALL
        && (openGate || tile !== WORLD_TILE.NORTH_FOREST_GATE) && !visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

function canReachNorth(visited, item) {
  return visited.has(`${Math.floor(item.x / 32) + WEST_REGION_WIDTH},${Math.floor(item.y / 32) + NORTH_REGION_HEIGHT + 1}`);
}

function reachableVolcano(openGates) {
  const queue = [[2, 12]];
  const visited = new Set([queue[0].join(',')]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const tile = EAST_REGION_DATA[ny]?.[nx];
      const key = `${nx},${ny}`;
      if (tile !== undefined && ![WORLD_TILE.WEST_WALL, WORLD_TILE.VOLCANIC_ROCK].includes(tile)
        && (![WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B].includes(tile) || openGates.includes(tile))
        && !visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

function canReachVolcano(visited, item) {
  return visited.has(`${Math.floor((item.x - EAST_ORIGIN) / 32)},${Math.floor(item.y / 32)}`);
}

async function testRandomLayouts() {
  const files = ['unicorns.json', 'accessories.json', 'north-unicorns.json', 'north-accessories.json'];
  const groups = await Promise.all(files.map(async (file) => {
    const response = await fetch(new URL(`../src/data/collectibles/${file}`, import.meta.url));
    assert(response.ok, `Could not load ${file}.`);
    const data = await response.json();
    return data.items.map((item) => ({ ...item, type: data.type }));
  }));
  const items = groups.flat();
  const volcanicGroups = await Promise.all(['volcano-unicorns.json', 'volcano-accessories.json'].map(async (file) => {
    const response = await fetch(new URL(`../src/data/collectibles/${file}`, import.meta.url));
    assert(response.ok, `Could not load ${file}.`);
    const data = await response.json();
    return data.items.map((item) => ({ ...item, type: data.type }));
  }));
  const allItems = [...items, ...volcanicGroups.flat()];
  const eastAccess = [
    reachable([]), reachable([WORLD_GATES.flora]), reachable([WORLD_GATES.bridge]),
    reachable([WORLD_GATES.bridge, WORLD_GATES.luna]),
    reachable([WORLD_GATES.bridge, WORLD_GATES.secondBridge]),
    reachable(Object.values(WORLD_GATES)),
  ];
  const westAccess = [
    reachableWest([]), reachableWest([WORLD_TILE.WEST_FOREST_GATE]),
    reachableWest([WORLD_TILE.WEST_BRIDGE]),
    reachableWest([WORLD_TILE.WEST_FOREST_GATE, WORLD_TILE.WEST_BRIDGE]),
  ];
  const northClosed = reachableNorth(false);
  const northOpen = reachableNorth(true);
  const access = (item) => (item.y < 0
    ? [canReachNorth(northClosed, item), canReachNorth(northOpen, item)]
    : item.x < 0
    ? westAccess.map((visited) => canReachWest(visited, item))
    : eastAccess.map((visited) => canReach(visited, item))).join(',');
  const forest = (item) => item.y < 0
    ? !canReachNorth(northClosed, item) && canReachNorth(northOpen, item)
    : item.x < 0
    ? !canReachWest(westAccess[0], item) && canReachWest(westAccess[1], item)
    : (canReach(eastAccess[1], item) && !canReach(eastAccess[0], item))
      || (canReach(eastAccess[3], item) && !canReach(eastAccess[2], item));
  assert(JSON.stringify(arrangeCollectibles(items, null)) === JSON.stringify(items),
    'Legacy layouts changed without a reset.');
  const original = JSON.stringify(items);
  const layouts = new Set();
  const northLayouts = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    const result = arrangeCollectibles(items, seed);
    const expanded = arrangeCollectibles(allItems, seed);
    assert(JSON.stringify(expanded.slice(0, items.length)) === JSON.stringify(result),
      'Adding the volcano changed an existing seeded layout.');
    const volcanoClosed = reachableVolcano([]);
    const volcanoAll = reachableVolcano([WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B]);
    expanded.slice(items.length).forEach((item, index) => {
      const originalItem = allItems[items.length + index];
      assert(canReachVolcano(volcanoClosed, item) === canReachVolcano(volcanoClosed, originalItem)
        && canReachVolcano(volcanoAll, item), `${item.id} crossed a volcanic gate.`);
      if (!canReachVolcano(volcanoClosed, originalItem)) {
        assert(item.x === originalItem.x && item.y === originalItem.y, `${item.id} moved inside a volcanic enclosure.`);
      }
    });
    assert(JSON.stringify(result) === JSON.stringify(arrangeCollectibles(items, seed)),
      'A layout seed did not reproduce its positions.');
    assert(new Set(result.map((item) => `${item.x},${item.y}`)).size === items.length,
      'Random layout produced overlapping collectibles.');
    result.forEach((item, index) => {
      assert(access(item) === access(items[index]), `${item.id} crossed a progression boundary.`);
      if (forest(items[index])) {
        assert(item.x === items[index].x && item.y === items[index].y,
          `${item.id} moved inside a forest.`);
      }
    });
    const oldItems = items.filter((item) => item.y >= 0);
    assert(JSON.stringify(result.filter((item) => item.y >= 0)) === JSON.stringify(arrangeCollectibles(oldItems, seed)),
      'Adding northern collectibles changed an existing saved layout.');
    northLayouts.add(JSON.stringify(result.filter((item) => item.y < 0 && !forest(item))
      .map(({ x, y }) => [x, y])));
    layouts.add(JSON.stringify(result.map(({ x, y }) => [x, y])));
  }
  assert(layouts.size > 1 && northLayouts.size > 1 && JSON.stringify(items) === original,
    'Layouts did not vary or changed the authored data.');
}

async function testVolcano(world) {
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const ids = world.collectibleManager.collectedIds;
  const originalStart = world.startNPCChallenge;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  let outcome;
  const start = async (mode) => {
    outcome = undefined;
    world.scene.launch('VolcanoScene', {
      player: { name: world.player.name, avatar: world.player.avatar, age: world.player.age }, mode, onComplete: (won) => { outcome = won; },
    });
    world.scene.pause();
    const scene = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => scene.sys.isActive() && scene.mode === mode, `${mode} did not start.`);
    return scene;
  };
  try {
    world.player.sprite.body.reset(EAST_ORIGIN - 60, 400);
    const items = world.collectibleManager.getAllItems();
    const boots = items.filter((item) => item.type === 'tool' && item.kind === 'lava-boots');
    assert(boots.length === 2, 'The western region must contain two pairs of lava boots.');
    const westClosed = reachableWest([]);
    const westOpen = reachableWest([WORLD_TILE.WEST_BRIDGE]);
    for (const boot of boots) {
      assert(boot.y > 54 * 32 && !canReachWest(westClosed, boot) && canReachWest(westOpen, boot),
        `${boot.id} is not reachable exclusively beyond the western troll bridge.`);
      for (let seed = 0; seed < 10; seed += 1) {
        const placed = arrangeCollectibles(items, seed).find((item) => item.id === boot.id);
        assert(placed.x === boot.x && placed.y === boot.y, 'Lava boots moved during reshuffling.');
      }
    }
    const oldRequirements = [
      ...items.filter((item) => item.type === 'unicorn').slice(0, 2),
      ...items.filter((item) => item.slot === 'saddle').slice(0, 2),
      ...items.filter((item) => item.slot === 'wings').slice(0, 2),
    ].map((item) => item.id);
    for (const count of [0, 1]) {
      world.collectibleManager.collectedIds = new Set([...oldRequirements, ...boots.slice(0, count).map((item) => item.id)]);
      world.updateCollectionProgress();
      world.interactWithEastPass();
      assert(world.dialogueWindow.mode === 'dialogue'
        && world.dialogueWindow.message.text.includes(`${count} af 2`)
        && world.dialogueWindow.message.text.includes('vestlige verden syd for troldens bro')
        && world.hud.toolCounters.get('lava-boots').textContent.includes(`${count} / 2`),
      'Eastern crossing did not require both boots or provide guidance and progress.');
      world.dialogueWindow.close();
    }
    world.collectibleManager.collectedIds = new Set(boots.map((item) => item.id));
    let requested = false;
    world.startNPCChallenge = (id, onCorrect, miniGame, options) => {
      requested = miniGame === 'volcanoBridge' && options.randomForPlayer;
      onCorrect();
    };
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    assert(requested && world.player.sprite.x > EAST_ORIGIN && world.eastMap.getTileAt(0, 12).collides,
      'Eastern crossing did not launch the bridge or preserve the wall.');
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    assert(world.player.sprite.x < EAST_ORIGIN, 'Eastern return crossing failed.');
    world.startNPCChallenge = originalStart;
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    const bridgeQuestion = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => bridgeQuestion.sys.isActive(), 'Boots did not lead to the volcano question.');
    const bridgeChallenge = bridgeQuestion.challenge;
    const correctBridge = bridgeChallenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, bridgeChallenge.correctAnswer)
    ));
    bridgeQuestion.answerButtons[correctBridge].emit('pointerdown');
    bridgeQuestion.continueButton.emit('pointerdown');
    const bridgeGame = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => bridgeGame.sys.isActive() && bridgeGame.mode === 'bridge',
      'Answering the volcano question did not start the bridge game.');
    assert(!world.stateManager.learnedChallengeIds.has(bridgeChallenge.id), 'Bridge question was credited too early.');
    bridgeGame.finish(true);
    await waitUntil(() => world.sys.isActive() && !bridgeGame.sys.isActive(), 'Bridge victory did not resume the world.');
    assert(world.player.sprite.x > EAST_ORIGIN && world.stateManager.learnedChallengeIds.has(bridgeChallenge.id),
      'Bridge victory did not cross the wall and credit the question.');
    world.dialogueWindow.close();
    world.crossEastPass();
    world.player.sprite.body.reset(EAST_ORIGIN - 75, 400);
    world.movement.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    world.movement.keys.D.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.right <= EAST_ORIGIN + 1
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= EAST_ORIGIN + 1),
    'The eastern wall allowed players through from the west.');
    world.crossEastPass();
    world.player.sprite.body.reset(EAST_ORIGIN + 95, 400);
    world.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    world.movement.keys.A.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.left >= EAST_ORIGIN + 31
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.left >= EAST_ORIGIN + 31),
    'The eastern wall allowed players through from the volcano.');
    const sounds = world.registry.get('soundEffects');
    const play = sounds.play;
    const heard = [];
    try {
      sounds.play = (name) => heard.push(name);
      world.worldMusicRegion = null;
      world.updateWorldMusic(100, world.player);
      assert(heard.includes('worldVolcanoLow'), 'The volcanic region did not select its own music.');
    } finally {
      sounds.play = play;
      world.worldMusicRegion = null;
    }
    world.player.sprite.body.reset(EAST_ORIGIN + 150, 400);
    world.eruptionTimeRemaining = 1;
    world.dialogueWindow.showLines('Prøve', ['Vent']);
    world.updateEruptionEncounter(1000, world.player);
    assert(world.eruptionTimeRemaining === 1, 'Eruption timer did not pause during dialogue.');
    world.dialogueWindow.close();
    world.updateEruptionEncounter(1, world.player);
    assert(world.dialogueWindow.isOpen && world.eruptionTimeRemaining >= 30000
      && world.eruptionTimeRemaining <= 60000, 'Eruption encounter was not scheduled correctly.');
    world.dialogueWindow.advance();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Eruption question did not start.');
    const challenge = question.challenge;
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const eruption = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => eruption.sys.isActive() && eruption.mode === 'eruption', 'Eruption minigame did not start after the question.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Eruption question was credited before the minigame.');
    const beforeFailure = world.player.id;
    eruption.finish(false);
    await waitUntil(() => !eruption.sys.isActive(), 'Failed eruption did not stop.');
    assert(world.player.id !== beforeFailure && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Failed eruption did not switch players or left the question credited.');
    world.dialogueWindow.close();
    let scene = await start('bridge');
    assert(scene.difficulty === minigameSpeed(world.player.age), 'Volcano game used the wrong player age.');
    scene.spawnHazard();
    assert(scene.hazards.getChildren()[0].body.velocity.y >= 100 * scene.difficulty,
      'Volcano hazard speed did not use the difficulty.');
    scene.hazards.clear(true, true);
    assert(scene.bridgeBarrier.body.enable, 'Bridge could be crossed before collecting pieces.');
    while (scene.progress < 5) scene.collect(scene.player, scene.items.getChildren()[0]);
    assert(!scene.bridgeBarrier.body.enable && outcome === undefined, 'Bridge did not require reaching the exit.');
    scene.player.setPosition(690, 480);
    scene.update(0, 16);
    assert(outcome === true, 'Built bridge did not allow victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Bridge scene did not stop.');
    scene = await start('crystals');
    while (scene.progress < 7) scene.collect(scene.player, scene.items.getChildren()[0]);
    assert(outcome === true, 'Crystal collection did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Crystal scene did not stop.');
    scene = await start('runes');
    assert(scene.runeVolcano, 'Rune game did not create its volcano.');
    await waitUntil(() => scene.hazards.getLength() > 0, 'Rune volcano did not launch sparks automatically.');
    const spark = scene.hazards.getChildren()[0];
    assert(spark.y <= 520 && spark.body.velocity.y < 0,
      'Rune volcano did not launch a spark upwards.');
    scene.hit(scene.player, spark);
    assert(scene.hits === 1 && !spark.active, 'Rune spark did not damage the player.');
    scene.invulnerableUntil = 0;
    scene.hit(scene.player, scene.hazards.create(400, 520, 'volcano-hazard'));
    scene.invulnerableUntil = 0;
    scene.hit(scene.player, scene.hazards.create(400, 520, 'volcano-hazard'));
    assert(outcome === false, 'Three rune sparks did not cause defeat.');
    await waitUntil(() => !scene.sys.isActive(), 'Rune defeat did not stop the scene.');
    scene = await start('runes');
    scene.collect(scene.player, scene.items.getChildren()[1]);
    assert(scene.progress === 0, 'Runes accepted the wrong order.');
    for (let i = 0; i < 4; i += 1) scene.collect(scene.player, scene.items.getChildren().find((item) => item.getData('index') === i));
    assert(outcome === true, 'Ordered runes did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Rune scene did not stop.');
    scene = await start('eruption');
    scene.progress = 0;
    scene.update(0, 14999);
    assert(outcome === undefined, 'Eruption ended too early.');
    scene.update(0, 1);
    assert(outcome === true, 'Surviving the eruption did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Eruption scene did not stop.');
    scene = await start('crystals');
    for (let i = 0; i < 3; i += 1) {
      scene.invulnerableUntil = 0;
      scene.hit(scene.player, scene.hazards.create(300, 200, 'volcano-hazard'));
    }
    assert(outcome === false, 'Three ember hits did not cause defeat.');
    await waitUntil(() => !scene.sys.isActive(), 'Defeat scene did not stop.');
  } finally {
    world.startNPCChallenge = originalStart;
    world.movement.keys.A.isDown = false;
    world.movement.keys.D.isDown = false;
    world.collectibleManager.collectedIds = ids;
    world.dialogueWindow.close();
    if (world.game.scene.isActive('VolcanoScene')) world.scene.stop('VolcanoScene');
    if (world.sys.isPaused()) world.scene.resume();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.wasInVolcano = false;
    world.eruptionTimeRemaining = world.nextWitchDelay();
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
  }
}

async function testVolcanoCat(world) {
  const cat = world.npcManager.npcs.find((npc) => npc.id === 'volcano-cat');
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const begin = async () => {
    world.player.sprite.body.reset(cat.x, cat.y);
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC === cat, 'The roaming cat was not interactable at its current position.');
    world.handleSpace();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Cat question did not start.');
    assert(question.challenge.id === 'volcano-cat-reading', 'The cat asked the wrong question.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, question.challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !world.game.scene.isActive('CatMazeScene'), 'A wrong answer started the cat maze.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, question.challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const maze = world.game.scene.getScene('CatMazeScene');
    await waitUntil(() => maze.sys.isActive(), 'Cat maze did not start after the correct answer.');
    assert(maze.difficulty === minigameSpeed(world.player.age), 'Cat maze used the wrong player age.');
    assert(!world.stateManager.learnedChallengeIds.has('volcano-cat-reading'), 'Cat question was credited before capture.');
    return maze;
  };
  try {
    assert(cat && cat.sprite.texture.key === 'red-cat' && world.volcanoCatRoam, 'The red cat is missing.');
    const beforeWalk = { x: cat.x, y: cat.y };
    world.volcanoCatRoam.update(1000);
    assert(Phaser.Math.Distance.Between(beforeWalk.x, beforeWalk.y, cat.x, cat.y) > 1
      && cat.sprite.x === cat.x && cat.sprite.y === cat.y, 'Cat did not roam or its interaction position was stale.');
    const beforeEscape = { x: cat.x, y: cat.y };
    let maze = await begin();
    const playerBeforeFailure = world.player.id;
    for (let i = 0; i < 1000 && !maze.finished; i += 1) maze.update(0, 50);
    assert(maze.finished && maze.escaped, 'Cat did not follow the maze to its exit.');
    await waitUntil(() => !maze.sys.isActive() && world.sys.isActive(), 'World did not resume after the cat escaped.');
    assert(Phaser.Math.Distance.Between(beforeEscape.x, beforeEscape.y, cat.x, cat.y) >= 900
      && world.player.id !== playerBeforeFailure && cat.interactionIndex === 0
      && !cat.following && world.leaderFollowerSystem.companions.length === 0
      && !world.stateManager.learnedChallengeIds.has('volcano-cat-reading'),
    'Escaping cat did not relocate far away, switch players, and leave the question unfinished.');
    world.dialogueWindow.close();
    const accessible = reachableVolcano([]);
    for (let i = 0; i < 30; i += 1) {
      const previous = { x: cat.x, y: cat.y };
      world.volcanoCatRoam.respawn();
      assert(Phaser.Math.Distance.Between(previous.x, previous.y, cat.x, cat.y) >= 900,
        'Cat respawned too close to its previous position.');
      for (let step = 0; step < 20; step += 1) {
        world.volcanoCatRoam.update(1000);
        assert(canReachVolcano(accessible, cat), 'Cat wandered into a blocked or inaccessible volcanic area.');
      }
    }
    maze = await begin();
    for (let i = 0; i < 500 && !maze.finished; i += 1) {
      if (!maze.runner.next) {
        const path = mazePath([maze.runner.x, maze.runner.y], [13, 1], maze.mazeRows);
        const next = path?.[1];
        maze.keys.W.isDown = Boolean(next && next[1] < maze.runner.y);
        maze.keys.S.isDown = Boolean(next && next[1] > maze.runner.y);
        maze.keys.A.isDown = Boolean(next && next[0] < maze.runner.x);
        maze.keys.D.isDown = Boolean(next && next[0] > maze.runner.x);
      }
      maze.update(0, 50);
    }
    await waitUntil(() => !maze.sys.isActive() && world.sys.isActive(), 'World did not resume after catching the cat.');
    assert(maze.finished && !maze.escaped && cat.interactionIndex === 1
      && world.stateManager.learnedChallengeIds.has('volcano-cat-reading')
      && cat.following && world.leaderFollowerSystem.companions[0] === cat && !cat.nameTag.visible,
    'Following a valid maze route did not capture the cat and credit the question.');
    world.dialogueWindow.close();
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC !== cat, 'The companion still blocked interactions as a nearby NPC.');
    const start = { x: cat.sprite.x, y: cat.sprite.y };
    world.player.sprite.body.reset(start.x + 250, start.y);
    world.leaderFollowerSystem.setLeader(world.player.id);
    world.leaderFollowerSystem.update(100);
    assert(cat.sprite.x !== start.x && world.leaderFollowerSystem.followers.at(-1) === cat,
      'Captured cat did not follow the leader trail.');
    const beforeSwap = world.player.id;
    world.swapLeader();
    assert(world.player.id !== beforeSwap && world.player.id !== cat.id
      && world.leaderFollowerSystem.companions[0] === cat, 'Turn switching selected or lost the cat.');
    const sounds = world.registry.get('soundEffects');
    const originalPlay = sounds.play;
    const heard = [];
    try {
      sounds.play = (name) => heard.push(name);
      world.catMeowTimeRemaining = 10000;
      world.updateCatMeow(9999);
      assert(!heard.includes('catMeow'), 'Cat meowed before the interval elapsed.');
      world.updateCatMeow(1);
      assert(heard.filter((name) => name === 'catMeow').length === 1
        && world.catMeowTimeRemaining >= 10000 && world.catMeowTimeRemaining <= 15000,
      'Cat did not meow and schedule another 10–15 second interval.');
    } finally {
      sounds.play = originalPlay;
    }
    world.player.sprite.body.reset(EAST_ORIGIN + 90, 400);
    world.crossEastPass();
    assert(cat.sprite.body.right < EAST_ORIGIN, 'The cat did not cross the eastern wall with the players.');
    world.player.sprite.body.reset(90, 400);
    world.crossWestWall();
    assert(cat.sprite.body.right < 0, 'The cat did not cross the western wall with the players.');
    world.player.sprite.body.reset(816, 58);
    world.crossNorthWall();
    assert(cat.sprite.body.bottom < 0, 'The cat did not cross the northern wall with the players.');
    world.enterStable();
    const stable = world.game.scene.getScene('StableScene');
    await waitUntil(() => stable.sys.isActive() && stable.followers?.companions.length === 1,
      'Captured cat did not follow the players into the stable.');
    assert(stable.followers.companions[0].sprite.texture.key === 'red-cat', 'Stable companion is not the red cat.');
    const meowBefore = world.catMeowTimeRemaining;
    stable.update(0, 100);
    assert(world.catMeowTimeRemaining < meowBefore, 'The meow timer did not continue in the stable.');
    stable.scene.stop();
    world.scene.resume();
    await waitUntil(() => world.sys.isActive() && !stable.sys.isActive(), 'World did not resume after leaving the stable.');
  } finally {
    world.dialogueWindow.close();
    if (world.game.scene.isActive('CatMazeScene')) world.scene.stop('CatMazeScene');
    if (world.sys.isPaused()) world.scene.resume();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    cat.interactionIndex = 0;
    cat.following = false;
    cat.nameTag.setVisible(true);
    world.leaderFollowerSystem.companions = [];
    if (cat.sprite.body) world.physics.world.disable(cat.sprite);
    world.catMeowTimeRemaining = null;
    world.northFollowerNavigators.delete(cat.sprite);
    world.eastFollowerNavigators.delete(cat.sprite);
    world.volcanoCatRoam.update(0);
  }
}

async function waitForWorld(game, previousManager = null) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const scene = game.scene.getScene('MainWorldScene');
    if (scene?.sys.isActive() && scene.players?.length && scene.stateManager
      && scene.collectibleManager !== previousManager) {
      return scene;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('World did not load within 15 seconds.');
}

async function waitForStable(game, count) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const scene = game.scene.getScene('StableScene');
    if (scene?.sys.isActive() && scene.unicorns?.length === count) {
      return scene;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Stable did not load within 15 seconds.');
}

function testMap(scene) {
  const items = Object.fromEntries(scene.collectibleManager.getAllItems().map((item) => [item.id, item]));
  for (const slot of ['crown', 'saddle', 'sticker', 'wings']) {
    assert(Object.values(items).filter((item) => item.slot === slot).length === 15,
      `The ${slot} collection must contain one item per unicorn.`);
  }
  const closed = reachable([]);
  const floraOpen = reachable([WORLD_GATES.flora]);
  const bridgeOpen = reachable([WORLD_GATES.bridge]);
  const lunaOpen = reachable([WORLD_GATES.bridge, WORLD_GATES.luna]);
  const bothBridgesOpen = reachable([WORLD_GATES.bridge, WORLD_GATES.secondBridge]);
  const allOpen = reachable(Object.values(WORLD_GATES));
  const withoutFlora = reachable([WORLD_GATES.bridge, WORLD_GATES.secondBridge, WORLD_GATES.luna]);
  const withoutLuna = reachable([WORLD_GATES.bridge, WORLD_GATES.secondBridge, WORLD_GATES.flora]);
  assert(TEST_WORLD_DATA.length === 96 && TEST_WORLD_DATA.every((row) => row.length === 128),
    'World is not twice the original width and height.');
  assert(WEST_REGION_DATA.length === 96 && WEST_REGION_DATA.every((row) => (
    row.length === WEST_REGION_WIDTH && row[WEST_REGION_WIDTH - 1] === WORLD_TILE.WEST_WALL
  )), 'Western wall does not span the entire map.');
  assert(scene.westLayer.x === -WEST_REGION_WIDTH * 32
    && scene.physics.world.bounds.left === -WEST_REGION_WIDTH * 32
    && scene.westMap.getTileAt(WEST_REGION_WIDTH - 1, 0).collides
    && scene.westMap.getTileAt(WEST_REGION_WIDTH - 1, 95).collides,
  'Western region or wall collision bounds are incorrect.');
  assert(!canReach(closed, items['accessory-crown']), 'Flora forest is accessible while closed.');
  assert(!canReach(withoutFlora, items['accessory-crown']), 'Flora forest has another entrance.');
  assert(canReach(floraOpen, items['accessory-crown']), 'Flora gate does not lead to the crown.');
  assert(!canReach(bridgeOpen, items['accessory-saddle']), 'Luna forest is accessible while closed.');
  assert(!canReach(withoutLuna, items['accessory-saddle']), 'Luna forest has another entrance.');
  assert(canReach(lunaOpen, items['accessory-saddle']), 'Luna gate does not lead to the saddle.');
  assert(!canReach(closed, items['accessory-star-sticker']), 'River can be crossed without the troll.');
  assert(!canReach(bridgeOpen, items['accessory-wave'])
    && canReach(bothBridgesOpen, items['accessory-wave']),
  'Second river can be crossed without its troll, or its bridge is blocked.');
  for (const item of Object.values(items).filter((item) => item.type !== 'tool' && item.x >= 0 && item.x < EAST_ORIGIN && item.y >= 0)) {
    assert(canReach(allOpen, item), `${item.id} is unreachable with all gates open.`);
  }
  assert(!canReach(allOpen, items.flashlight)
    && canReach(closed, { x: LAKE.boatX, y: LAKE.shoreLandingY }), 'Island or shore boat is incorrectly accessible.');
  for (const npc of scene.npcManager.npcs.filter((npc) => npc.x >= 0 && npc.x < EAST_ORIGIN && npc.y >= 0 && npc.y < SOUTH_ORIGIN)) {
    const access = npc.id === 'guide-wizard' ? bothBridgesOpen
      : ['luna', 'river-troll'].includes(npc.id) ? bridgeOpen : closed;
    assert(canReach(access, npc), `${npc.id} is unreachable before its own gate opens.`);
  }
  const westClosed = reachableWest([]);
  const westForest = reachableWest([WORLD_TILE.WEST_FOREST_GATE]);
  const westBridge = reachableWest([WORLD_TILE.WEST_BRIDGE]);
  const westAll = reachableWest([WORLD_TILE.WEST_FOREST_GATE, WORLD_TILE.WEST_BRIDGE]);
  const forestItems = ['unicorn-rainbow-ocean', 'accessory-saddle-ocean', 'accessory-wings-ocean',
    'accessory-hat-ocean', 'accessory-sticker-ocean'];
  const riverItems = ['unicorn-rainbow-sun', 'accessory-saddle-sun', 'accessory-wings-sun',
    'accessory-hat-sun', 'accessory-sticker-sun'];
  const freeItems = ['unicorn-rainbow-rose', 'accessory-saddle-rose', 'accessory-wings-rose',
    'accessory-hat-rose', 'accessory-sticker-rose'];
  assert(Object.values(items).filter((item) => item.x < 0 && item.y >= 0 && item.type === 'unicorn').length === 3
    && Object.values(items).filter((item) => item.x < 0 && item.y >= 0 && item.type === 'accessory').length === 12,
  'Western region does not contain three unicorns and twelve accessories.');
  for (const id of forestItems) {
    assert(!canReachWest(westClosed, items[id]) && !canReachWest(westBridge, items[id])
      && canReachWest(westForest, items[id]), `${id} is not exclusively guarded by the western forest.`);
  }
  for (const id of riverItems) {
    assert(!canReachWest(westClosed, items[id]) && !canReachWest(westForest, items[id])
      && canReachWest(westBridge, items[id]), `${id} is not exclusively guarded by the western bridge.`);
  }
  for (const id of freeItems) {
    assert(canReachWest(westClosed, items[id]), `${id} is not freely reachable in the western region.`);
  }
  for (const npc of scene.npcManager.npcs.filter((npc) => npc.x < 0 && npc.y >= 0)) {
    assert(canReachWest(westClosed, npc), `${npc.id} is unreachable before its own gate opens.`);
  }
  assert(Object.values(items).filter((item) => item.x < 0 && item.y >= 0).every((item) => canReachWest(westAll, item)),
    'Some western items remain unreachable after opening the gates.');
  const northItems = Object.values(items).filter((item) => item.y < 0);
  const closedNorth = reachableNorth(false);
  const openNorth = reachableNorth(true);
  assert(northItems.filter((item) => item.type === 'unicorn').length === 3
    && northItems.filter((item) => item.type === 'accessory').length === 12,
  'Northern region must contain three unicorns and twelve accessories.');
  for (const item of northItems) {
    const guarded = item.id === 'unicorn-dark-red' || item.id.startsWith('accessory-dark-red-');
    assert(canReachNorth(openNorth, item) && canReachNorth(closedNorth, item) !== guarded,
      `${item.id} has the wrong northern forest access.`);
  }
  const northTroll = scene.npcManager.npcs.find((npc) => npc.id === 'north-troll');
  assert(northTroll && canReachNorth(closedNorth, northTroll), 'Northern troll is not reachable outside the forest.');
  const volcanicItems = Object.values(items).filter((item) => item.x >= EAST_ORIGIN && item.y >= 0);
  assert(EAST_REGION_DATA.length === 96 && EAST_REGION_DATA.every((row) => row.length === EAST_REGION_WIDTH
    && row[0] === WORLD_TILE.WEST_WALL) && scene.eastMap.getTileAt(0, 12).collides,
  'The eastern wall or map is incomplete.');
  assert(volcanicItems.filter((item) => item.type === 'unicorn').length === 3
    && volcanicItems.filter((item) => item.type === 'accessory').length === 12,
  'The volcano must contain three unicorns and twelve accessories.');
  const volcanoClosed = reachableVolcano([]);
  const volcanoA = reachableVolcano([WORLD_TILE.VOLCANIC_GATE_A]);
  const volcanoB = reachableVolcano([WORLD_TILE.VOLCANIC_GATE_B]);
  const volcanoAll = reachableVolcano([WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B]);
  for (const item of volcanicItems) {
    const flame = item.id === 'unicorn-volcano-flame' || item.id.startsWith('accessory-volcano-flame-');
    const ember = item.id === 'unicorn-volcano-ember' || item.id.startsWith('accessory-volcano-ember-');
    assert(canReachVolcano(volcanoAll, item) && canReachVolcano(volcanoClosed, item) === !(flame || ember)
      && canReachVolcano(volcanoA, item) === !ember && canReachVolcano(volcanoB, item) === !flame,
    `${item.id} has the wrong volcanic gate access.`);
  }
  for (const npc of scene.npcManager.npcs.filter((npc) => npc.x >= EAST_ORIGIN)) {
    assert(canReachVolcano(volcanoClosed, npc), `${npc.id} is unreachable before its gate opens.`);
  }
  assert(items['unicorn-solstraale'].texture === 'unicorn-purple'
    && items['accessory-saddle'].texture === 'accessory-saddle-pink'
    && items['accessory-saddle'].wornTexture === 'saddle-worn-pink',
  'Color-specific texture names changed the original saved IDs or are incorrect.');
  assert(items['accessory-wave'].slot === 'sticker'
    && items['accessory-alvina-hat'].slot === 'crown'
    && items['accessory-ellie-hat'].slot === 'crown', 'New accessories use incorrect slots.');
  assert(scene.playerManager.resolveAvatar({ avatar: 'girl', hairColor: 'purple' }) === 'girl-purple',
    'Purple-haired girl uses the wrong texture name.');
}

async function testWestCrack(scene) {
  const collection = scene.collectibleManager;
  const savedIds = collection.collectedIds;
  const leader = scene.player;
  const positions = scene.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const items = collection.getAllItems();
  const unicorns = items.filter((item) => item.type === 'unicorn').slice(0, 3);
  const saddles = items.filter((item) => item.slot === 'saddle').slice(0, 3);
  const wings = items.filter((item) => item.slot === 'wings').slice(0, 3);
  const unrelated = items.filter((item) => item.type === 'accessory' && !['saddle', 'wings'].includes(item.slot));
  const two = (group) => group.slice(0, 2);
  const fill = (groups) => new Set(groups.flat().map((item) => item.id));
  try {
    const ravine = scene.children.getByName('west-ravine');
    const lava = scene.children.getByName('west-ravine-lava');
    const perched = scene.children.list.filter((child) => child.name === 'west-ravine-pterodactyl');
    assert(ravine?.visible && lava?.visible && ravine.x === WEST_CRACK.x && ravine.y === WEST_CRACK.y
      && lava.x === WEST_CRACK.x && lava.y === WEST_CRACK.y
      && perched.length === 2 && perched.every((bird) => bird.visible && !bird.body
        && bird.texture.key === 'pterodactyl-perched' && bird.x === WEST_CRACK.x)
      && perched[0].y < WEST_CRACK.y && perched[1].y > WEST_CRACK.y,
    'The ravine, lava, or its two perched pterodactyls are missing or incorrectly positioned.');
    leader.sprite.body.reset(200, WEST_CRACK.y);
    scene.update(0, 16);
    assert(!scene.isNearWestCrack() && !scene.crackPrompt.visible, 'Crack prompt appeared too far away.');
    leader.sprite.body.reset(50, WEST_CRACK.y);
    scene.update(0, 16);
    assert(scene.isNearWestCrack() && scene.crackPrompt.visible, 'Crack prompt did not appear when approached.');
    for (const groups of [
      [unicorns.slice(0, 1), two(saddles), two(wings), unrelated],
      [two(unicorns), saddles.slice(0, 1), two(wings), unrelated],
      [two(unicorns), two(saddles), wings.slice(0, 1), unrelated],
      [[], [], [], unrelated],
    ]) {
      collection.collectedIds = fill(groups);
      scene.handleSpace();
      assert(scene.dialogueWindow.isOpen && scene.dialogueWindow.mode === 'dialogue'
        && scene.dialogueWindow.message.text.includes('to enhjørninger')
        && scene.dialogueWindow.message.text.includes('to sadler')
        && scene.dialogueWindow.message.text.includes('to sæt vinger'),
      'Crack did not require all three collection thresholds.');
      scene.dialogueWindow.close();
    }
    collection.collectedIds = fill([two(unicorns), two(saddles), two(wings)]);
    scene.handleSpace();
    assert(scene.dialogueWindow.mode === 'quest' && scene.dialogueWindow.message.text.includes('Tør I flyve')
      && scene.dialogueWindow.acceptButton.text === 'Ja' && scene.dialogueWindow.laterButton.text === 'Nej',
    'Ready crack did not offer a flight choice.');
    scene.dialogueWindow.cancel();
    assert(!scene.dialogueWindow.isOpen, 'Declining flight did not close the choice.');
    scene.dialogueWindow.showQuestOffer('Test', { title: 'Opgave', description: 'Beskrivelse', reward: 'Belønning' }, () => {});
    assert(scene.dialogueWindow.acceptButton.text === 'Accepter' && scene.dialogueWindow.laterButton.text === 'Afslå',
      'Quest choice labels were not restored after the flight choice.');
    scene.dialogueWindow.cancel();
    collection.collectedIds = fill([unicorns, saddles, wings]);
    scene.handleSpace();
    assert(scene.dialogueWindow.mode === 'quest', 'Crack rejected more than the required items.');
    const originalStart = scene.startNPCChallenge;
    let flightRequested = false;
    try {
      scene.startNPCChallenge = (id, onCorrect, miniGame, options) => {
        flightRequested = miniGame === 'flight' && options.randomForPlayer && typeof onCorrect === 'function';
      };
      scene.dialogueWindow.chooseQuest(true);
    } finally {
      scene.startNPCChallenge = originalStart;
    }
    assert(flightRequested && scene.westMap.getTileAt(WEST_REGION_WIDTH - 1, 12).collides,
      'Accepting flight did not request a question or changed the wall.');
    for (const y of [WEST_CRACK.y, 1600, 2600]) {
      scene.player.sprite.body.reset(60, y);
      scene.movement.keys.A.isDown = true;
      await new Promise((resolve) => setTimeout(resolve, 600));
      scene.movement.keys.A.isDown = false;
      scene.movement.update();
      assert(scene.player.sprite.body.left >= -1 && scene.player.sprite.x < 40,
        `Player did not reach or crossed the west wall at y=${y}: x=${scene.player.sprite.x}, left=${scene.player.sprite.body.left}, boost=${scene.speedBoost.multiplier}.`);
      assert(scene.leaderFollowerSystem.players.every((player) => player.sprite.body.left >= -1),
        `Follower crossed the west wall at y=${y}.`);
    }
    scene.swapLeader();
    scene.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    scene.movement.keys.A.isDown = false;
    scene.movement.update();
    assert(scene.leaderFollowerSystem.players.every((player) => player.sprite.body.left >= -1),
      'A player crossed the wall after switching leaders.');
  } finally {
    scene.movement.keys.A.isDown = false;
    collection.collectedIds = savedIds;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    scene.setLeader(leader.id);
    scene.dialogueWindow.close();
  }
}

async function testWestPhysicalCollision(scene) {
  const leader = scene.player;
  const follower = scene.leaderFollowerSystem.players[1].sprite;
  const positions = scene.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  try {
    for (const [startX, startY, targetX, targetY, boundary, side] of [
      [-400, 880, -620, 880, -448, 'forest'],
      [-272, 1600, -272, 1800, 1664, 'river'],
    ]) {
      follower.body.reset(startX, startY);
      follower.setPosition(targetX, targetY);
      follower.body.updateFromGameObject();
      scene.constrainWestFollower(follower, startX, startY);
      assert(side === 'forest' ? follower.body.left >= boundary : follower.body.bottom <= boundary,
        `Follower crossed the closed western ${side}.`);
    }
    leader.sprite.body.reset(-400, 880);
    follower.body.reset(-340, 880);
    scene.leaderFollowerSystem.setLeader(leader.id);
    scene.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    scene.movement.keys.A.isDown = false;
    scene.movement.update();
    assert(leader.sprite.x < -410 && leader.sprite.body.left >= -449,
      'Player did not reach or crossed the closed western forest gate.');
    leader.sprite.body.reset(-272, 1600);
    follower.body.reset(-272, 1540);
    scene.leaderFollowerSystem.setLeader(leader.id);
    scene.movement.keys.S.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    scene.movement.keys.S.isDown = false;
    scene.movement.update();
    assert(leader.sprite.y > 1610 && leader.sprite.body.bottom <= 1665,
      'Player did not reach or crossed the closed western bridge.');
    assert(scene.leaderFollowerSystem.players.every((player) => player.sprite.body.bottom <= 1665),
      'Follower crossed the closed western bridge while walking.');
    scene.swapLeader();
    assert(scene.player.sprite.body.bottom <= 1665, 'Switching leaders bypassed the western bridge.');
  } finally {
    scene.movement.keys.A.isDown = false;
    scene.movement.keys.S.isDown = false;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    scene.setLeader(leader.id);
  }
}

function testNorthFollowerAndMusic(scene) {
  const leader = scene.player;
  const follower = scene.leaderFollowerSystem.players[1].sprite;
  const positions = scene.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const originalTarget = scene.leaderFollowerSystem.getTrailPosition;
  const navigator = new NorthFollowerNavigator(scene.northLayer);
  try {
    let obstacle;
    for (let y = 3; y < NORTH_REGION_HEIGHT - 3 && !obstacle; y += 1) {
      for (let x = 5; x < 85 && !obstacle; x += 1) {
        if (NORTH_REGION_DATA[y][x] !== WORLD_TILE.DARK_TREE) continue;
        const centerX = scene.northLayer.x + (x + 0.5) * 32;
        const centerY = scene.northLayer.y + (y + 0.5) * 32;
        follower.body.reset(centerX - 100, centerY);
        const target = { x: centerX + 100, y: centerY };
        if (navigator.isFree(follower, follower.x, follower.y)
          && navigator.isFree(follower, target.x, target.y)
          && !navigator.canTravel(follower, { x: follower.x, y: follower.y }, target)
          && navigator.findPath(follower, target).length > 2) {
          obstacle = { start: { x: follower.x, y: follower.y }, target };
        }
      }
    }
    assert(obstacle, 'No navigable northern tree obstacle was found.');
    follower.body.reset(obstacle.start.x, obstacle.start.y);
    leader.sprite.body.reset(obstacle.target.x, obstacle.target.y);
    scene.leaderFollowerSystem.setLeader(leader.id);
    scene.leaderFollowerSystem.getTrailPosition = () => obstacle.target;
    scene.northFollowerNavigators.clear();
    for (let tick = 0; tick < 240; tick += 1) {
      scene.update(tick * 50, 50);
      assert(navigator.isFree(follower, follower.x, follower.y), 'Follower crossed a northern tree.');
      if (Phaser.Math.Distance.Between(follower.x, follower.y, obstacle.target.x, obstacle.target.y) < 70) break;
    }
    assert(Phaser.Math.Distance.Between(follower.x, follower.y, obstacle.target.x, obstacle.target.y) < 70,
      'Follower could not route around a northern tree and catch the leader.');
    const closedForest = { x: 2192, y: -912 };
    follower.body.reset(1776, -912);
    assert(navigator.findPath(follower, closedForest).length === 0,
      'Follower found a path through the closed northern forest gate.');
    scene.northMap.setCollision(WORLD_TILE.NORTH_FOREST_GATE, false);
    try {
      assert(navigator.findPath(follower, closedForest).length > 0,
        'Follower could not reach the northern forest after its gate opened.');
    } finally {
      scene.northMap.setCollision(WORLD_TILE.NORTH_FOREST_GATE, true);
    }

    const heard = [];
    sounds.play = (name) => heard.push(name);
    scene.worldMusicRegion = null;
    leader.sprite.body.reset(300, 240);
    scene.updateWorldMusic(0, leader);
    scene.updateWorldMusic(349, leader);
    scene.updateWorldMusic(350, leader);
    assert(heard.join(',') === 'worldHappyC,worldHappyE', 'Starting area music timing or melody is incorrect.');
    leader.sprite.body.reset(816, -150);
    scene.updateWorldMusic(351, leader);
    scene.updateWorldMusic(1001, leader);
    assert(heard.slice(-2).join(',') === 'worldDarkLow,worldDarkHigh', 'Northern music did not replace the starting theme.');
    leader.sprite.body.reset(-300, 500);
    scene.updateWorldMusic(2000, leader);
    assert(heard.length === 4 && scene.worldMusicRegion === null, 'Music continued outside its regions.');
  } finally {
    sounds.play = originalPlay;
    scene.leaderFollowerSystem.getTrailPosition = originalTarget;
    scene.northFollowerNavigators.clear();
    scene.worldMusicRegion = null;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    scene.setLeader(leader.id);
  }
}

async function testWorldMusicPause(scene) {
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const position = { x: scene.player.sprite.x, y: scene.player.sprite.y };
  const heard = [];
  try {
    sounds.play = (name) => { if (name.startsWith('world')) heard.push(name); };
    scene.player.sprite.body.reset(300, 240);
    scene.worldMusicRegion = null;
    await new Promise((resolve) => setTimeout(resolve, 450));
    assert(heard.some((name) => name.startsWith('worldHappy')), 'Starting music did not play during the world scene.');
    scene.scene.pause();
    const pausedCount = heard.length;
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert(heard.length === pausedCount, 'World music kept scheduling notes while paused.');
    scene.scene.resume();
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(heard.length > pausedCount, 'World music did not resume.');
  } finally {
    if (scene.sys.isPaused()) scene.scene.resume();
    sounds.play = originalPlay;
    scene.player.sprite.body.reset(position.x, position.y);
    scene.worldMusicRegion = null;
  }
}

async function testWitchEncounter(world) {
  const game = world.game;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(816, -150);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(1, world.player);
    assert(world.dialogueWindow.isOpen && world.dialogueWindow.speaker.text === 'Heksen'
      && world.witchAppearance.visible && world.witchTimeRemaining >= 30000 && world.witchTimeRemaining <= 60000,
    'Witch did not appear or schedule the next encounter in the required interval.');
    world.dialogueWindow.advance();
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Witch question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('WitchMazeScene'), 'A wrong answer started the maze.');
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const maze = game.scene.getScene('WitchMazeScene');
    await waitUntil(() => maze.sys.isActive(), 'Witch maze did not start.');
    assert(!world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && maze.runner.sprite.texture.key === world.player.avatar,
    'Witch question was credited too early or used the wrong player.');
    return { maze, challenge };
  };
  try {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0;
      assert(world.nextWitchDelay() === 30000, 'Witch delay does not include 30 seconds.');
      Math.random = () => 0.999999;
      assert(world.nextWitchDelay() === 60000, 'Witch delay does not include 60 seconds.');
    } finally {
      Math.random = originalRandom;
    }
    for (let count = 0; count < 30; count += 1) {
      const delay = world.nextWitchDelay();
      assert(delay >= 30000 && delay <= 60000, 'Witch delay is outside 30–60 seconds.');
    }
    world.player.sprite.body.reset(500, 300);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(5000, world.player);
    assert(!world.dialogueWindow.isOpen, 'Witch appeared outside the northern region.');
    world.player.sprite.body.reset(816, -150);
    world.witchTimeRemaining = 30000;
    world.updateWitchEncounter(29999, world.player);
    assert(!world.dialogueWindow.isOpen && world.witchTimeRemaining === 1,
      'Witch appeared before the chosen exploration interval elapsed.');
    world.dialogueWindow.showLines('Prøve', ['Vent']);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(5000, world.player);
    assert(world.dialogueWindow.speaker.text === 'Prøve' && world.witchTimeRemaining === 1,
      'Witch interrupted another dialogue.');
    world.dialogueWindow.close();
    assert(minigameSpeed(6) === 0.9 && minigameSpeed(7) === 1 && minigameSpeed(8) === 1.1,
      'Minigame difficulty does not respect the age boundaries.');
    assert(MAZE_LAYOUTS.length === 4 && new Set(MAZE_LAYOUTS.map((rows) => rows.join('\n'))).size === 4,
      'The maze must have four distinct configurations.');
    testCatMazeLayouts();
    for (const rows of MAZE_LAYOUTS) {
      assert(mazePath([1, 1], [13, 9], rows) && mazePath([13, 1], [1, 1], rows)
        && mazePath([1, 9], [13, 1], rows), 'A maze has no route between the starts and exits.');
      for (let y = 0; y < rows.length; y += 1) {
        for (let x = 0; x < rows[y].length; x += 1) {
          if (rows[y][x] === '.') assert(mazePath([x, y], [13, 9], rows), 'Maze has an isolated passage.');
        }
      }
    }
    let { maze, challenge } = await start();
    assert(maze.difficulty === minigameSpeed(world.player.age) && maze.blackCat.sprite.texture.key === 'black-cat',
      'Witch maze did not use the active player age or create the black cat.');
    const selection = {};
    const selected = [];
    for (let count = 0; count < 5; count += 1) {
      maze.selectMaze.call(selection);
      selected.push(selection.mazeIndex);
    }
    assert(new Set(selected.slice(0, 4)).size === 4 && selected[0] === selected[4],
      'Maze layouts do not rotate through all four before repeating.');
    maze.blackCat.x = maze.runner.x;
    maze.blackCat.y = maze.runner.y;
    maze.blackCat.next = null;
    maze.blackCat.progress = 0;
    maze.blackCat.sprite.setPosition(maze.runner.sprite.x, maze.runner.sprite.y);
    maze.update(maze.time.now, 0);
    assert(maze.captured && !maze.finished, 'Black cat did not capture the player.');
    const heldWitch = { x: maze.witch.sprite.x, y: maze.witch.sprite.y };
    maze.update(maze.time.now, 50);
    assert(maze.witch.sprite.x === heldWitch.x && maze.witch.sprite.y === heldWitch.y,
      'The witch moved while the player was held by the cat.');
    maze.input.keyboard.emit('keydown', { key: 'ArrowLeft', repeat: false });
    maze.handleWiggle({ key: 'a', repeat: false });
    maze.handleWiggle({ key: 'ArrowRight', repeat: true });
    assert(maze.wiggles.left === 1 && maze.wiggles.right === 0,
      'Repeated directions or key repeats incorrectly counted.');
    for (let count = 0; count < 4; count += 1) {
      maze.handleWiggle({ key: 'd', repeat: false });
      maze.handleWiggle({ key: 'a', repeat: false });
    }
    assert(maze.captured && maze.wiggles.left === 5 && maze.wiggles.right === 4,
      'The cat released the player before five wiggles on each side.');
    maze.handleWiggle({ key: 'ArrowRight', repeat: false });
    assert(!maze.captured && maze.catFleeRemaining > 0 && maze.catFleeGoal,
      'Completing the wiggles did not make the cat flee.');
    const catStart = { x: maze.blackCat.sprite.x, y: maze.blackCat.sprite.y };
    maze.update(maze.time.now, 50);
    assert(Phaser.Math.Distance.Between(catStart.x, catStart.y, maze.blackCat.sprite.x, maze.blackCat.sprite.y) > 0
      && !maze.captured, 'The released cat did not move away safely.');
    maze.blackCat.x = 1;
    maze.blackCat.y = 9;
    maze.blackCat.next = null;
    maze.blackCat.progress = 0;
    maze.blackCat.sprite.setPosition(...maze.toWorld(1, 9));
    const witchStart = { x: maze.witch.sprite.x, y: maze.witch.sprite.y };
    maze.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    maze.keys.D.isDown = false;
    assert(maze.runner.sprite.x > maze.toWorld(1, 1)[0]
      && Phaser.Math.Distance.Between(witchStart.x, witchStart.y, maze.witch.sprite.x, maze.witch.sprite.y) > 5,
      'Runner movement or witch pursuit did not work.');
    const loser = world.player.id;
    maze.witch.sprite.setPosition(maze.runner.sprite.x, maze.runner.sprite.y);
    maze.update(maze.time.now, 0);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after witch capture.');
    assert(world.player.id !== loser && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      'Witch capture did not switch players or left the question completed.');
    world.dialogueWindow.close();
    ({ maze, challenge } = await start());
    const route = mazePath([1, 1], [13, 9], maze.mazeRows);
    for (const step of route.slice(1)) {
      const dx = step[0] - maze.runner.x;
      const dy = step[1] - maze.runner.y;
      maze.keys.A.isDown = dx < 0;
      maze.keys.D.isDown = dx > 0;
      maze.keys.W.isDown = dy < 0;
      maze.keys.S.isDown = dy > 0;
      maze.moveActor(maze.runner, 44, (actor) => maze.chooseRunner(actor));
      if (maze.finished) break;
    }
    await waitUntil(() => world.sys.isActive(), 'Reaching the maze exit did not resume the world.');
    assert(world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.dialogueWindow.speaker.text === 'Heksens labyrint',
    'Maze victory did not credit the question.');
    world.dialogueWindow.close();
  } finally {
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('witch');
    world.wasInNorth = false;
    world.witchTimeRemaining = world.nextWitchDelay();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

async function testNorthCave(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const savedIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const previousChallenge = world.lastNPCChallenges.get('north-hole');
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    let challenge;
    const originalStart = world.startChallenge;
    try {
      world.startChallenge = function (selected, ...args) {
        challenge = selected;
        return originalStart.call(this, selected, ...args);
      };
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'quest', 'Northern hole did not offer a crossing.');
      world.dialogueWindow.chooseQuest(true);
    } finally {
      world.startChallenge = originalStart;
    }
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Northern question did not start.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('CaveScene'), 'Wrong answer started the cave.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const cave = game.scene.getScene('CaveScene');
    await waitUntil(() => cave.sys.isActive(), 'Cave did not start.');
    assert(world.sys.isPaused() && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      'Cave credited its question before victory.');
    return { cave, challenge };
  };
  try {
    assert(NORTH_REGION_DATA.length === NORTH_REGION_HEIGHT + 1
      && NORTH_REGION_DATA[NORTH_REGION_HEIGHT].every((tile) => tile === WORLD_TILE.WEST_WALL)
      && NORTH_REGION_DATA.some((row) => row.includes(WORLD_TILE.DARK_TREE))
      && world.northMap.getTileAt(Math.floor(NORTH_HOLE.x / 32) + WEST_REGION_WIDTH, NORTH_REGION_HEIGHT).collides,
    'Northern region, trees, or solid hole wall is missing.');
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    world.movement.keys.W.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    world.movement.keys.W.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.top >= -1
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.top >= -1),
    'The northern wall allowed walking through the hole.');
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    collection.collectedIds = new Set(collection.getAllItems()
      .filter((item) => item.type === 'unicorn' || item.slot === 'saddle' || item.slot === 'wings')
      .map((item) => item.id));
    world.handleSpace();
    assert(world.dialogueWindow.message.text.includes('lommelygten'), 'Northern crossing omitted the flashlight requirement.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set(['flashlight']);
    let { cave, challenge } = await start();
    assert(cave.difficulty === minigameSpeed(world.player.age)
      && Math.abs(cave.enemies.getChildren()[0].body.velocity.x) === 48 * cave.difficulty,
    'Cave enemies did not use the active player age.');
    assert(cave.lives === 5 && cave.enemies.getChildren().length === 5
      && cave.enemies.getChildren().some((enemy) => enemy.getData('kind') === 'ghost')
      && cave.enemies.getChildren().some((enemy) => enemy.getData('kind') === 'skeleton'),
    'Cave did not create its lives and both enemy types.');
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land on the floor.');
    cave.jump({ repeat: false });
    assert(cave.leader.body.velocity.y < 0, 'Cave leader could not jump.');
    const startX = cave.leader.x;
    cave.keys.D.isDown = true;
    await waitUntil(() => cave.leader.x > startX + 20, 'Cave leader could not move.');
    cave.keys.D.isDown = false;
    assert(cave.leader.x > startX + 20, 'Cave leader could not move.');
    cave.leader.body.reset(420, 470);
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land before the gap.');
    cave.keys.D.isDown = true;
    cave.jump({ repeat: false });
    await waitUntil(() => cave.leader.x > 660 || cave.leader.y > 650,
      'Cave leader did not reach the other side of the gap.');
    cave.keys.D.isDown = false;
    assert(cave.leader.x > 660 && cave.lives === 5, 'The first platform gap could not be jumped.');
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land after crossing the gap.');
    cave.hit(true);
    assert(cave.lives === 4 && cave.leader.y < 530, 'Falling did not cost a life and respawn.');
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.hit(false);
    assert(cave.lives === 3, 'Cave hit invulnerability failed.');
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.invulnerableUntil = 0;
    const loser = world.player.id;
    cave.hit(false);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after cave loss.');
    assert(world.player.id !== loser && !world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.player.sprite.y >= 0, 'Cave loss switched incorrectly or crossed the wall.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    ({ cave, challenge } = await start());
    cave.leader.body.reset(3601, 450);
    cave.update(cave.time.now);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after cave victory.');
    assert(world.players.every((player) => player.sprite.y < -32)
      && world.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Cave victory did not move both players north or credit the question.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(NORTH_HOLE.x, -80);
    ({ cave } = await start());
    cave.leader.body.reset(3601, 450);
    cave.update(cave.time.now);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after return crossing.');
    assert(world.players.every((player) => player.sprite.y > 0), 'Return crossing did not move both players south.');
    world.dialogueWindow.close();
  } finally {
    collection.collectedIds = savedIds;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    if (previousChallenge === undefined) world.lastNPCChallenges.delete('north-hole');
    else world.lastNPCChallenges.set('north-hole', previousChallenge);
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

async function testDragonBattle(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const princess = world.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  const queen = world.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  const queenState = {
    interactions: queen.interactions, lines: queen.interactions[0].lines, repeatDialogue: queen.repeatDialogue,
  };
  const princessState = { lines: princess.interactions[0].lines, repeatDialogue: princess.repeatDialogue };
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const beforeChildren = new Set(world.children.list);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(DRAGON_DEN.x, DRAGON_DEN.y + 110);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Ready dragon encounter did not offer the fight.');
    world.dialogueWindow.chooseQuest(true);
    const selected = [];
    for (const category of ['Math', 'English', 'Logic', 'Reading']) {
      const question = game.scene.getScene('ChallengeScene');
      await waitUntil(() => question.sys.isActive() && question.challenge?.category === category,
        `${category} dragon question did not start.`);
      const challenge = question.challenge;
      selected.push(challenge);
      assert(!question.children.list.some((object) => typeof object.text === 'string'
        && /^(Læs|Læsning|Matematik|Engelsk|Logik) · (niveau )?\d+$/.test(object.text)),
      'A dragon question displayed its category or difficulty.');
      assert(challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age),
        'Dragon question was not age-appropriate.');
      const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
      const right = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
      question.answerButtons[wrong].emit('pointerdown');
      assert(!question.isResolved && !game.scene.isActive('DragonBattleScene'), 'A wrong answer started the dragon battle.');
      question.answerButtons[right].emit('pointerdown');
      question.continueButton.emit('pointerdown');
    }
    const battle = game.scene.getScene('DragonBattleScene');
    await waitUntil(() => battle.sys.isActive(), 'Dragon battle did not start after four questions.');
    assert(selected.every((challenge) => !world.stateManager.learnedChallengeIds.has(challenge.id)),
      'Dragon questions were credited before victory.');
    return { battle, selected };
  };
  try {
    assert(world.dragonDen.texture.key === 'dragon-den' && !world.dragonRescued, 'Dragon den is missing.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedGates: new Set(saved.unlockedGates) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    world.finishDragonChallenge(true, []);
    assert(!world.dragonRescued && world.dialogueWindow.message.text.includes('ikke gemt'),
      'A failed rescue save did not preserve the encounter and report the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    world.player.sprite.body.reset(DRAGON_DEN.x, DRAGON_DEN.y + 110);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue' && world.dialogueWindow.message.text.includes('krigerprinsessen'),
      'Dragon den did not explain its requirements.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...savedIds, 'bow-and-arrow-1', 'bow-and-arrow-2']);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue', 'Two bows without the princess started the fight.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...savedIds, 'bow-and-arrow-1']);
    assert(world.recruitPrincess(), 'Could not recruit princess for dragon test.');
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue', 'One bow with the princess started the fight.');
    world.dialogueWindow.close();
    world.updateStoryDialogue(queen);
    assert(queen.interactions[0].lines.some((line) => line.includes('den sidste bue')),
      'Queen did not acknowledge the first collected bow.');
    collection.collectedIds.add('bow-and-arrow-2');
    world.updateStoryDialogue(queen);
    assert(queen.interactions[0].lines.some((line) => line.includes('begge buer'))
      && !queen.repeatDialogue.includes('Find krigerprinsessen'),
    'Queen did not acknowledge the princess and collected bows.');
    let { battle, selected } = await start();
    battle.time.removeAllEvents();
    assert(battle.dragonLives === 50 && battle.princessLives === 15 && battle.girls.length === 2
      && battle.difficulty === minigameSpeed(world.player.age), 'Dragon battle initialization failed.');
    assert(battle.rockCover.depth > battle.girls[0].depth && battle.rockCover.depth < battle.bows[0].depth,
      'The girls and their bows are not layered behind the rock cover.');
    const oldHeadX = battle.head.x;
    await waitUntil(() => Math.abs(battle.head.x - oldHeadX) > 40, 'Dragon head did not move sideways.');
    assert(Math.abs(battle.head.body.center.x - battle.head.x) < 1, 'Moving head and hitbox are out of sync.');
    battle.headMotionTime = 0;
    battle.update(battle.time.now, 900);
    const missedArrow = battle.arrows.create(400, battle.head.y, 'dragon-arrow');
    assert(!battle.physics.overlap(missedArrow, battle.head), 'An arrow aimed at the old position still hit the moving head.');
    missedArrow.destroy();
    const startX = battle.princess.x;
    battle.cursors.right.isDown = true;
    await waitUntil(() => battle.princess.x > startX + 10, 'Princess did not move with arrow keys.');
    battle.cursors.right.isDown = false;
    battle.pointBow({ x: battle.head.x, y: battle.head.y });
    battle.fireArrow({ repeat: false });
    assert(battle.arrows.getLength() === 1 && battle.arrows.getChildren()[0].body.velocity.y < 0,
      'Bow did not fire an aimed arrow.');
    battle.fireArrow({ repeat: true });
    assert(battle.arrows.getLength() === 1, 'Repeating space fired extra arrows.');
    await waitUntil(() => battle.dragonLives === 49, 'A fired arrow did not reach the dragon.');
    battle.shootFireball();
    assert(battle.fireballs.getLength() === 1 && battle.fireballs.getChildren()[0].body.velocity.length() > 0,
      'Dragon did not fire a moving fireball.');
    battle.fireballs.clear(true, true);
    for (let hit = 0; hit < 15; hit += 1) {
      const fireball = battle.fireballs.create(battle.princess.x, battle.princess.y, 'dragon-fireball');
      battle.physics.overlap(battle.princess, fireball, battle.hitPrincess, undefined, battle);
      if (hit < 14) assert(!battle.finished, 'Dragon battle lost before 15 fireballs.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Dragon loss did not resume the world.');
    assert(!world.dragonRescued && selected.every((challenge) => !world.stateManager.learnedChallengeIds.has(challenge.id)),
      'Dragon loss rescued the prince or credited questions.');
    world.dialogueWindow.close();
    ({ battle, selected } = await start());
    battle.time.removeAllEvents();
    battle.headMotionTime = 0;
    battle.update(battle.time.now, 0);
    for (const target of [battle.head, battle.leftPaw, battle.rightPaw]) {
      battle.princess.body.reset(target === battle.head ? 400 : target === battle.leftPaw ? 100 : 700,
        target === battle.head ? 235 : 270);
      battle.nextSwordHit = 0;
      const before = battle.dragonLives;
      battle.update(battle.time.now);
      assert(battle.dragonLives === before - 1 && battle.swordTarget === target,
        'Automatic sword did not hit or face the nearby dragon body part.');
    }
    battle.princess.body.reset(400, 390);
    for (let hit = 0; hit < 47; hit += 1) {
      const arrow = battle.arrows.create(battle.head.x, battle.head.y, 'dragon-arrow');
      battle.physics.overlap(arrow, battle.head, battle.hitDragon, undefined, battle);
      if (hit < 46) assert(!battle.finished, 'Dragon was defeated before 50 combined hits.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Dragon victory did not resume the world.');
    assert(world.dragonRescued && collection.store.loadState().unlockedGates.has('dragon')
      && selected.every((challenge) => world.stateManager.learnedChallengeIds.has(challenge.id))
      && queen.repeatDialogue.includes('hjemme igen') && world.dragonDen.texture.key === 'dragon-den-empty',
    'Victory did not save the rescue, update the queen, and credit all four questions.');
    world.dialogueWindow.close();
    world.npcManager.runInteraction(queen);
    assert(world.dialogueWindow.message.text.includes('hjemme igen'), 'Queen did not celebrate the rescue in conversation.');
    world.dialogueWindow.close();
    world.interactWithDragonDen();
    assert(world.dialogueWindow.mode === 'dialogue' && world.dialogueWindow.message.text.includes('prinsen er fri')
      && world.dialogueWindow.message.text.includes('prinsessen') && world.dialogueWindow.message.text.includes('besejret'),
    'Empty den did not celebrate the ending.');
  } finally {
    collection.store = originalStore;
    if (game.scene.isActive('DragonBattleScene')) world.scene.stop('DragonBattleScene');
    if (!world.sys.isActive()) world.scene.resume();
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.pickups.getChildren().filter((pickup) => pickup.getData('collectibleId').startsWith('bow-and-arrow-'))
      .forEach((pickup) => pickup.destroy());
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates, saved.unlockedRewards);
    collection.collectedIds = savedIds;
    world.updateCollectionProgress();
    world.leaderFollowerSystem.companions = world.leaderFollowerSystem.companions.filter((companion) => companion !== princess);
    if (princess.sprite.body) world.physics.world.disable(princess.sprite);
    princess.following = false;
    princess.nameTag.setVisible(true);
    queen.interactions = queenState.interactions;
    queen.interactions[0].lines = queenState.lines;
    queen.repeatDialogue = queenState.repeatDialogue;
    princess.interactions[0].lines = princessState.lines;
    princess.repeatDialogue = princessState.repeatDialogue;
    world.dragonRescued = false;
    world.dragonDen.setTexture('dragon-den');
    world.children.list.filter((child) => !beforeChildren.has(child) && (child.texture?.key === 'prince' || child.text === 'Prinsen'))
      .forEach((child) => child.destroy());
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

async function testWarriorPrincess(world) {
  const princess = world.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const pickups = () => collection.pickups.getChildren().filter(
    (pickup) => pickup.getData('collectibleId').startsWith('bow-and-arrow-'),
  );
  const begin = async () => {
    world.player.sprite.body.reset(princess.x, princess.y);
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC === princess, 'Wandering princess could not be approached.');
    world.handleSpace();
    while (world.dialogueWindow.mode === 'dialogue') world.dialogueWindow.advance();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Princess question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !world.game.scene.isActive('PrincessDuelScene'), 'Wrong answer started the duel.');
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const duel = world.game.scene.getScene('PrincessDuelScene');
    await waitUntil(() => duel.sys.isActive(), 'Princess duel did not start.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Princess question was credited before victory.');
    return { duel, challenge };
  };
  try {
    assert(princess && world.princessWander && princess.y > SOUTH_ORIGIN + 32
      && pickups().length === 0 && world.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 0 / 2',
    'Princess or locked bows are not initialized correctly.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedRewards: new Set(saved.unlockedRewards) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    assert(!world.recruitPrincess() && !princess.following && pickups().length === 0
      && world.dialogueWindow.message.text.includes('ikke gemt'),
    'A failed reward save recruited the princess, spawned bows, or hid the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    const oldX = princess.x;
    world.princessWander.update(1000);
    assert(princess.x !== oldX && princess.sprite.x === princess.x, 'Princess did not wander with her interaction position.');
    let { duel, challenge } = await begin();
    assert(duel.difficulty === minigameSpeed(world.player.age) && duel.playerLives === 5 && duel.princessLives === 5,
      'Duel difficulty or lives are incorrect.');
    await waitUntil(() => duel.player.body.blocked.down, 'Duel player did not land.');
    duel.jump({ repeat: false });
    assert(duel.player.body.velocity.y < 0, 'Duel player cannot jump.');
    duel.player.body.reset(300, 450);
    duel.princess.body.reset(600, 450);
    duel.keys.D.isDown = true;
    await waitUntil(() => duel.player.x > 320, 'Duel player cannot move horizontally.');
    duel.keys.D.isDown = false;
    duel.player.body.reset(340, 480);
    duel.princess.body.reset(420, 480);
    duel.princessAttackAt = duel.time.now + 10000;
    duel.keys.D.isDown = true;
    await waitUntil(() => duel.player.x > duel.princess.x + 25, 'Fighters could not pass through each other.');
    duel.keys.D.isDown = false;
    duel.princessAttackAt = null;
    duel.player.body.reset(400, 450);
    duel.princess.body.reset(420, 450);
    duel.update(duel.time.now);
    assert(!duel.player.flipX && duel.princess.flipX, 'Fighters do not face each other.');
    duel.player.body.reset(450, 450);
    duel.update(duel.time.now);
    assert(duel.player.flipX && !duel.princess.flipX, 'Fighters did not turn after passing.');
    duel.swing({ repeat: false });
    duel.swing({ repeat: true });
    assert(duel.princessLives === 4, 'Practice swing missed or repeated without a new press.');
    duel.player.body.reset(300, 450);
    duel.princess.body.reset(600, 450);
    duel.nextPlayerSwing = 0;
    duel.swing({ repeat: false });
    assert(duel.princessLives === 4, 'A distant practice swing hit the princess.');
    duel.player.body.reset(400, 320);
    duel.princess.body.reset(450, 450);
    duel.princessAttackAt = duel.time.now;
    duel.update(duel.time.now);
    assert(duel.playerLives === 5, 'Princess hit a player who jumped out of reach.');
    for (let hit = 0; hit < 5; hit += 1) {
      duel.player.body.reset(400, 450);
      duel.princess.body.reset(450, 450);
      duel.princessAttackAt = duel.time.now;
      duel.update(duel.time.now);
    }
    await waitUntil(() => world.sys.isActive() && !duel.sys.isActive(), 'World did not resume after losing the duel.');
    assert(!princess.following && pickups().length === 0 && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Losing the duel awarded the princess, bows, or question.');
    world.dialogueWindow.close();
    ({ duel, challenge } = await begin());
    for (let hit = 0; hit < 5; hit += 1) {
      duel.player.body.reset(400, 450);
      duel.princess.body.reset(450, 450);
      duel.nextPlayerSwing = 0;
      duel.swing({ repeat: false });
    }
    await waitUntil(() => world.sys.isActive() && !duel.sys.isActive(), 'World did not resume after winning the duel.');
    assert(princess.following && world.leaderFollowerSystem.companions.includes(princess)
      && !princess.nameTag.visible && world.stateManager.learnedChallengeIds.has(challenge.id)
      && collection.store.loadState().unlockedRewards.has('princess-bows') && pickups().length === 2,
    'Winning did not recruit the princess and unlock two bows.');
    world.dialogueWindow.close();
    for (const [index, pickup] of [...pickups()].entries()) {
      world.player.sprite.body.reset(pickup.x, pickup.y);
      await waitUntil(() => !pickup.active, 'Walking over a bow did not collect it.');
      assert(world.hud.toolCounters.get('bow-and-arrow').textContent === `Buer og pile: ${index + 1} / 2`,
        'The bow counter did not update.');
    }
    assert(collection.store.loadState().collectedIds.has('bow-and-arrow-1')
      && collection.store.loadState().collectedIds.has('bow-and-arrow-2'), 'Collected bows were not saved.');
    collection.unlockReward('princess-bows');
    assert(pickups().length === 0, 'Re-recruiting duplicated collected bows.');
    world.enterStable();
    const stable = world.game.scene.getScene('StableScene');
    await waitUntil(() => stable.sys.isActive(), 'Stable did not open with the princess.');
    assert(stable.followers.companions.some((companion) => companion.id === princess.id
      && companion.sprite.texture.key === 'warrior-princess'), 'Princess did not follow into the stable.');
    const before = world.catMeowTimeRemaining;
    stable.update(0, 100);
    assert(world.catMeowTimeRemaining === before, 'Princess alone caused cat meows.');
    stable.scene.stop();
    world.scene.resume();
    await waitUntil(() => world.sys.isActive(), 'World did not resume after stable visit.');
  } finally {
    collection.store = originalStore;
    if (world.game.scene.isActive('PrincessDuelScene')) world.scene.stop('PrincessDuelScene');
    if (world.game.scene.isActive('StableScene')) world.scene.stop('StableScene');
    if (!world.sys.isActive()) world.scene.resume();
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    pickups().forEach((pickup) => pickup.destroy());
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates, saved.unlockedRewards);
    collection.collectedIds = savedIds;
    world.updateCollectionProgress();
    world.leaderFollowerSystem.companions = world.leaderFollowerSystem.companions.filter((companion) => companion !== princess);
    if (princess.sprite.body) world.physics.world.disable(princess.sprite);
    princess.following = false;
    princess.nameTag.setVisible(true);
    princess.interactionIndex = 0;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.catMeowTimeRemaining = null;
    world.lastNPCChallenges.delete('warrior-princess');
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

function testOldQueen(world) {
  const queen = world.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  assert(queen && queen.sprite.texture.key === 'old-queen' && world.textures.exists('old-queen'),
    'The old queen or her artwork did not load.');
  const leader = world.player;
  const { x, y } = leader.sprite;
  try {
    leader.sprite.body.reset(queen.x, queen.y);
    assert(!world.isNearStable(), 'The stable entrance prevents talking to the queen.');
    world.npcManager.update(leader);
    assert(world.npcManager.activeNPC === queen && world.npcManager.interactionPrompt.visible,
      'The queen cannot be approached for an interaction.');
    world.handleSpace();
    assert(world.dialogueWindow.speakerName === queen.name
      && world.dialogueWindow.message.text.includes('søn')
      && world.dialogueWindow.message.text.includes('prins')
      && world.dialogueWindow.message.text.includes('bortført')
      && world.dialogueWindow.message.text.includes('drage'),
    'The queen did not explain that the dragon abducted her son.');
    world.dialogueWindow.advance();
    assert(world.dialogueWindow.message.text.includes('dragens hule')
      && world.dialogueWindow.message.text.includes('syd')
      && world.dialogueWindow.message.text.includes('alle enhjørningernes kræfter'),
    'The queen did not describe the southern lair and unicorn powers.');
    world.dialogueWindow.advance();
    assert(world.dialogueWindow.message.text.includes('krigerprinsessen')
      && world.dialogueWindow.message.text.includes('sydlige område')
      && world.dialogueWindow.message.text.includes('besejre dragen'),
    'The queen did not explain the warrior princess help.');
    world.dialogueWindow.advance();
    world.handleSpace();
    assert(world.dialogueWindow.message.text.includes('dragens hule')
      && world.dialogueWindow.message.text.includes('alle enhjørningernes kræfter')
      && world.dialogueWindow.message.text.includes('krigerprinsessen'),
    'The queen does not repeat the guidance when spoken to again.');
  } finally {
    world.dialogueWindow.close();
    queen.interactionIndex = 0;
    leader.sprite.body.reset(x, y);
    world.npcManager.update(leader);
  }
}

async function testSouthWizard(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const savedEquipment = new Map(collection.equipment);
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const all = collection.getAllItems();
  const unicorns = all.filter((item) => item.type === 'unicorn');
  const accessories = all.filter((item) => item.type === 'accessory');
  const team = wizardTeam(unicorns, accessories);
  const selectedAccessories = ['sticker', 'wings', 'crown', 'saddle'].flatMap(
    (slot) => accessories.filter((item) => item.slot === slot).slice(0, 4),
  );
  const selected = [...team, ...selectedAccessories];
  const start = async () => {
    world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Ready wizard did not offer the battle.');
    world.dialogueWindow.chooseQuest(true);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Wizard question did not start.');
    const challenge = question.challenge;
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('WizardBattleScene'), 'A wrong answer started the wizard battle.');
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const battle = game.scene.getScene('WizardBattleScene');
    await waitUntil(() => battle.sys.isActive(), 'Wizard battle did not start.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Wizard question was credited before victory.');
    return { battle, challenge };
  };
  try {
    assert(SOUTH_REGION_DATA.slice(1).every((row) => row.every((tile) => tile === WORLD_TILE.GRASS))
      && world.southMap.getTileAt(64, 0).collides && world.southMap.getTileAt(30, 0).collides,
    'Southern area is not empty grass behind a closed wall.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedGates: new Set(saved.unlockedGates) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    assert(!world.unlockSouthPass() && !world.southOpen && world.dialogueWindow.message.text.includes('ikke åbnet'),
      'A storage failure opened the southern passage or failed to report the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    assert(team?.length === 4, 'Could not select one unicorn from each group.');
    for (const removed of team) {
      const familyPrefix = removed.texture.match(/^unicorn-(rainbow|dark|volcano)-/)?.[0];
      const withoutFamily = unicorns.filter((item) => familyPrefix
        ? !item.texture.startsWith(familyPrefix)
        : /^(unicorn-rainbow-|unicorn-dark-|unicorn-volcano-)/.test(item.texture));
      assert(!wizardTeam(withoutFamily, accessories), 'Extra unicorns replaced a missing family.');
    }
    for (const x of [SOUTH_PASS.x, 1000, -500, EAST_ORIGIN + 500]) {
      world.player.sprite.body.reset(x, SOUTH_ORIGIN - 60);
      world.movement.keys.S.isDown = true;
      await new Promise((resolve) => setTimeout(resolve, 550));
      world.movement.keys.S.isDown = false;
      assert(world.player.sprite.body.bottom <= SOUTH_ORIGIN + 1, `Southern wall was bypassed at x=${x}.`);
    }
    const follower = world.leaderFollowerSystem.followers[0].sprite;
    for (const x of [SOUTH_PASS.x, 1000, -500, EAST_ORIGIN + 500]) {
      follower.body.reset(x, SOUTH_ORIGIN - 60);
      follower.setPosition(x, SOUTH_ORIGIN + 80);
      world.constrainFollowerToLayer(follower, x, SOUTH_ORIGIN - 60, world.southLayer, world.southWalls);
      assert(follower.body.bottom <= SOUTH_ORIGIN + 1, `Follower bypassed southern wall at x=${x}.`);
    }
    for (const removed of selected) {
      collection.collectedIds = new Set(selected.filter((item) => item !== removed).map((item) => item.id));
      world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'dialogue' && !world.southOpen,
        `Wizard allowed entry without ${removed.id}.`);
      world.dialogueWindow.close();
    }
    collection.collectedIds = new Set(selected.map((item) => item.id));
    let { battle, challenge } = await start();
    battle.time.removeAllEvents();
    assert(battle.girls.length === 2 && battle.unicorns.length === 4 && battle.wizardLives === 7 && battle.girlLives === 5
      && battle.difficulty === minigameSpeed(world.player.age), 'Wizard battle did not initialize correctly.');
    const chosenEquipment = battle.equipment.flat();
    assert(chosenEquipment.length === 16 && new Set(chosenEquipment.map((item) => item.id)).size === 16
      && battle.equipment.every((items) => new Set(items.map((item) => item.slot)).size === 4)
      && chosenEquipment.every((item) => selectedAccessories.some((candidate) => candidate.id === item.id))
      && JSON.stringify([...collection.equipment]) === JSON.stringify([...savedEquipment]),
    'Unicorn equipment was not drawn uniquely from the collected accessories.');
    const before = battle.girls.map((girl) => girl.x);
    battle.keys.D.isDown = true;
    await waitUntil(() => battle.girls[0].x > before[0] + 10, 'Girls did not move together.');
    battle.keys.D.isDown = false;
    assert(battle.girls[1].x > before[1] + 10, 'Second girl did not follow the controls.');
    battle.shootStar();
    assert(battle.stars.getLength() === 1 && battle.stars.getChildren()[0].body.velocity.length() > 0,
      'Wizard did not shoot a moving star.');
    const firstStar = battle.stars.getChildren()[0];
    firstStar.body.reset(battle.girls[0].x, battle.girls[0].y);
    await waitUntil(() => battle.girlLives === 4, 'The registered star collider did not hit a girl.');
    assert(!firstStar.active && battle.girls[0].active, 'A star hit destroyed the girl instead of the star.');
    battle.hitGirls(battle.girls[1], battle.stars.create(400, 300, 'wizard-star'));
    assert(battle.girlLives === 4, 'Shared lives or invulnerability failed.');
    for (let hit = 0; hit < 4; hit += 1) {
      battle.invulnerableUntil = 0;
      battle.hitGirls(battle.girls[hit % 2], battle.stars.create(400, 300, 'wizard-star'));
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Wizard defeat did not resume the world.');
    assert(!world.southOpen && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Losing the battle opened the passage or credited the question.');
    world.dialogueWindow.close();
    ({ battle, challenge } = await start());
    battle.time.removeAllEvents();
    for (let index = 0; index < 4; index += 1) {
      battle.input.keyboard.emit('keydown', { key: String(index + 1), repeat: false });
    }
    assert(battle.beams.getLength() === 4, 'Keys 1–4 did not fire all four unicorns.');
    assert(battle.beams.getChildren().every((beam) => beam.body.velocity.x === 430)
      && battle.wizard.body.height + battle.beams.getChildren()[0].body.height >= 120,
    'Wizard can hide between beams or the beams are not slower.');
    battle.handleShot({ key: '1', repeat: true });
    battle.handleShot({ key: '5', repeat: false });
    assert(battle.beams.getLength() === 4, 'Repeated or invalid key fired another beam.');
    battle.beams.clear(true, true);
    const dodgeBeam = battle.beams.create(battle.wizard.x - 100, battle.wizard.y - 20, 'wizard-beam');
    battle.update();
    assert(battle.wizard.body.velocity.y > 0, 'Wizard did not try to dodge an approaching beam.');
    dodgeBeam.destroy();
    battle.lastShots[0] = -Infinity;
    battle.handleShot({ key: '1', repeat: false });
    const firstBeam = battle.beams.getChildren()[0];
    firstBeam.body.reset(battle.wizard.x, battle.wizard.y);
    await waitUntil(() => battle.wizardLives === 6, 'The registered beam collider did not hit the wizard.');
    assert(!firstBeam.active && battle.wizard.active && battle.wizard.body
      && battle.score.text.includes('6 / 7') && !battle.finished,
    'A real beam hit destroyed the wizard or failed to update his lives.');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert(battle.wizard.active && battle.wizard.body, 'Wizard did not remain active after the first physics update.');
    for (let hit = 1; hit < 7; hit += 1) {
      battle.beams.create(battle.wizard.x, battle.wizard.y, 'wizard-beam');
      await waitUntil(() => battle.wizardLives === 6 - hit, 'A beam did not remove exactly one wizard life.');
      if (hit < 6) assert(!battle.finished && battle.wizard.active, 'Wizard lost before seven hits.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Wizard victory did not resume the world.');
    assert(world.southOpen && !world.southMap.getTileAt(64, 0).collides
      && world.southMap.getTileAt(30, 0).collides
      && collection.store.loadState().unlockedGates.has('south')
      && world.stateManager.learnedChallengeIds.has(challenge.id), 'Victory did not save and open the southern gate.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
    world.leaderFollowerSystem.followers[0].sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 150);
    world.setLeader(world.player.id);
    world.movement.keys.S.isDown = true;
    await waitUntil(() => world.players.every((player) => player.sprite.y > SOUTH_ORIGIN + 70),
      'Both players could not walk through the opened southern gate.');
    world.movement.keys.S.isDown = false;
    world.movement.keys.W.isDown = true;
    await waitUntil(() => world.players.every((player) => player.sprite.y < SOUTH_ORIGIN - 30),
      'Both players could not walk back through the opened southern gate.');
    world.movement.keys.W.isDown = false;
  } finally {
    collection.store = originalStore;
    if (game.scene.isActive('WizardBattleScene')) world.scene.stop('WizardBattleScene');
    if (!world.sys.isActive()) world.scene.resume();
    world.movement.keys.S.isDown = false;
    world.movement.keys.W.isDown = false;
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates);
    collection.collectedIds = savedIds;
    world.southMap.setCollision(WORLD_TILE.SOUTH_GATE, true);
    for (let x = 62; x <= 66; x += 1) world.southMap.putTileAt(WORLD_TILE.SOUTH_GATE, x, 0);
    world.southOpen = false;
    world.southWizard.setVisible(true);
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('south-wizard');
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

async function testLavaBootPickups(world) {
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const previousIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  try {
    for (const id of ['lava-boots-1', 'lava-boots-2']) {
      const item = collection.items.get(id);
      world.player.sprite.body.reset(item.x - 75, item.y);
      world.setLeader(world.player.id);
      world.movement.keys.D.isDown = true;
      const deadline = Date.now() + 5000;
      while (!collection.collectedIds.has(id) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      world.movement.keys.D.isDown = false;
      assert(collection.collectedIds.has(id) && collection.store.load().has(id),
        `Walking over ${id} did not collect and save it.`);
    }
    assert(world.hud.toolCounters.get('lava-boots').textContent.includes('2 / 2')
      && world.hud.toolProgress.textContent.includes('0 / 1'), 'Boot pickups changed the wrong counter.');
  } finally {
    world.movement.keys.D.isDown = false;
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed);
    collection.collectedIds = previousIds;
    for (const id of ['lava-boots-1', 'lava-boots-2']) {
      if (!collection.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === id)) {
        collection.createPickup(collection.items.get(id));
      }
    }
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.updateCollectionProgress();
  }
}

async function testLakeBoat(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const collected = collection.collectedIds;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(LAKE.boatX, LAKE.shoreLandingY);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Shore boat did not offer a crossing.');
    world.dialogueWindow.chooseQuest(true);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Boat question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('LakeBoatScene'), 'A wrong answer started the boat game.');
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const boat = game.scene.getScene('LakeBoatScene');
    await waitUntil(() => boat.sys.isActive(), 'Boat game did not start.');
    assert(world.sys.isPaused() && boat.difficulty === minigameSpeed(world.player.age)
      && !world.stateManager.learnedChallengeIds.has(challenge.id), 'Boat game credited the question too early or used the wrong age.');
    return { boat, challenge };
  };
  try {
    sounds.play = (name) => heard.push(name);
    assert(TEST_WORLD_DATA[LAKE.top][LAKE.left] === WORLD_TILE.WATER
      && TEST_WORLD_DATA[LAKE.bottom][LAKE.right] === WORLD_TILE.WATER
      && TEST_WORLD_DATA[LAKE.islandTop][LAKE.islandLeft] !== WORLD_TILE.WATER,
    'The larger lake or its island is missing.');
    const flashlight = collection.items.get('flashlight');
    assert(flashlight && collection.getTotalCount('tool') === 5
      && world.hud.toolProgress.textContent.includes('0 / 1'), 'Flashlight or its counter is missing.');
    for (let seed = 0; seed < 10; seed += 1) {
      const item = arrangeCollectibles(collection.getAllItems(), seed).find((candidate) => candidate.id === 'flashlight');
      assert(item.x === flashlight.x && item.y === flashlight.y, 'Flashlight moved off the island during shuffle.');
    }
    world.interactWithBoat();
    assert(world.dialogueWindow.message.text.includes('lommelygte'), 'Boat did not mention the uncollected flashlight.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...collected, 'flashlight']);
    world.interactWithBoat();
    assert(!world.dialogueWindow.message.text.includes('lommelygte'), 'Boat still promised a collected flashlight.');
    world.dialogueWindow.close();
    collection.collectedIds = collected;
    let { boat, challenge } = await start();
    assert(heard.includes('lakeStart') && heard.includes('lakeMusicLow'), 'Lake start or music did not play.');
    await waitUntil(() => heard.includes('lakeMusicMid'), 'Lake music did not continue automatically.');
    boat.time.removeAllEvents();
    boat.playMusicBeat();
    assert(heard.includes('lakeMusicMid') && heard.includes('lakeMusicHigh'), 'Lake music did not advance.');
    boat.spawnFish();
    boat.spawnMonster();
    assert(heard.includes('lakeFish') && heard.includes('lakeMonster'), 'Lake hazards did not play their sounds.');
    const [fish, monster] = boat.hazards.getChildren();
    assert(fish.getData('kind') === 'fish' && fish.body.velocity.y === 150 * boat.difficulty
      && monster.getData('kind') === 'monster' && monster.body.velocity.y === 115 * boat.difficulty,
    'Boat hazards or their age-scaled speeds are incorrect.');
    const startX = boat.boat.x;
    boat.movement.keys.D.isDown = true;
    await waitUntil(() => boat.boat.x > startX + 10, 'Boat did not respond to steering.');
    boat.movement.keys.D.isDown = false;
    assert(heard.includes('lakePaddle'), 'Steering did not play a paddling sound.');
    fish.body.reset(boat.boat.x, boat.boat.y);
    boat.physics.overlap(boat.boat, fish, boat.hit, undefined, boat);
    assert(boat.hits === 1 && !fish.active, 'Jumping fish did not hit the boat.');
    assert(heard.filter((name) => name === 'lakeHit').length === 1, 'Boat hit did not play its sound.');
    boat.hit(boat.boat, monster);
    assert(boat.hits === 1 && !monster.active && heard.filter((name) => name === 'lakeHit').length === 1,
      'Boat hit invulnerability did not prevent repeated damage and sound.');
    const failedPlayer = world.player.id;
    for (let hit = 0; hit < 2; hit += 1) {
      boat.invulnerableUntil = 0;
      boat.hit(boat.boat, boat.hazards.getChildren()[0] ?? boat.hazards.create(400, 200, 'lake-fish'));
    }
    await waitUntil(() => world.sys.isActive() && !boat.sys.isActive(), 'Failed crossing did not resume the world.');
    assert(heard.includes('lakeLose'), 'Failed crossing did not play its sound.');
    assert(!world.boatOnIsland && world.player.id !== failedPlayer
      && !world.stateManager.learnedChallengeIds.has(challenge.id), 'Failed crossing changed island or question progress.');
    world.dialogueWindow.close();
    ({ boat, challenge } = await start());
    boat.time.removeAllEvents();
    boat.hazards.clear(true, true);
    boat.elapsed = 0;
    boat.update(0, 17999);
    assert(!boat.finished, 'Boat game ended too early.');
    boat.update(0, 1);
    await waitUntil(() => world.sys.isActive() && !boat.sys.isActive(), 'Successful crossing did not resume the world.');
    assert(heard.includes('lakeWin'), 'Successful crossing did not play its sound.');
    const soundCount = heard.length;
    boat.playMusicBeat();
    boat.spawnFish();
    boat.spawnMonster();
    boat.update(boat.time.now + 1000, 16);
    assert(heard.length === soundCount, 'Lake sounds continued after the game finished.');
    assert(world.boatOnIsland && world.stateManager.learnedChallengeIds.has(challenge.id)
      && world.players.every((player) => player.sprite.y === LAKE.islandLandingY),
    'Successful crossing did not move both players to the island or credit the question.');
    world.dialogueWindow.close();
    world.movement.keys.W.isDown = true;
    await waitUntil(() => collection.collectedIds.has('flashlight'), 'Walking on the island did not collect the flashlight.');
    world.movement.keys.W.isDown = false;
    assert(collection.collectedIds.has('flashlight') && collection.store.load().has('flashlight')
      && world.hud.toolProgress.textContent.includes('1 / 1'), 'Flashlight pickup was not saved or counted.');
    world.player.sprite.body.reset(LAKE.boatX, LAKE.islandLandingY);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Island boat did not offer a return trip.');
    world.dialogueWindow.chooseQuest(true);
    assert(!world.boatOnIsland && world.players.every((player) => player.sprite.y === LAKE.shoreLandingY),
      'Return trip did not bring both players to the shore.');
  } finally {
    sounds.play = originalPlay;
    if (game.scene.isActive('LakeBoatScene')) world.scene.stop('LakeBoatScene');
    if (!world.sys.isActive()) world.scene.resume();
    world.movement.keys.W.isDown = false;
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed);
    collection.collectedIds = collected;
    if (!collection.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'flashlight')) {
      collection.createPickup(collection.items.get('flashlight'));
    }
    world.updateCollectionProgress();
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('lake-boat');
    world.boatOnIsland = false;
    world.lakeBoat.setPosition(LAKE.boatX, LAKE.shoreY);
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

async function testFlight(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const savedIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const previousChallenge = world.lastNPCChallenges.get('west-crack');
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert(condition(), message);
  };
  const start = async () => {
    let challenge;
    const originalStart = world.startChallenge;
    try {
      world.startChallenge = function (selected, ...args) {
        challenge = selected;
        return originalStart.call(this, selected, ...args);
      };
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'quest', 'Crack did not offer another crossing.');
      world.dialogueWindow.chooseQuest(true);
    } finally {
      world.startChallenge = originalStart;
    }
    assert(challenge && challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age),
      'Crack did not select a question appropriate for the active player.');
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Flight question did not start.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('FlightScene'), 'Wrong answer started the flight.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const flight = game.scene.getScene('FlightScene');
    await waitUntil(() => flight.sys.isActive(), 'Flight did not start after the correct answer.');
    assert(world.sys.isPaused() && world.isAnswering
      && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Flight credited the question before victory.');
    return { flight, challenge };
  };
  try {
    sounds.play = (name) => heard.push(name);
    const items = collection.getAllItems();
    collection.collectedIds = new Set([
      ...items.filter((item) => item.type === 'unicorn').slice(0, 2),
      ...items.filter((item) => item.slot === 'saddle').slice(0, 2),
      ...items.filter((item) => item.slot === 'wings').slice(0, 2),
    ].map((item) => item.id));
    world.player.sprite.body.reset(50, WEST_CRACK.y);
    let { flight, challenge } = await start();
    assert(flight.difficulty === minigameSpeed(world.player.age), 'Flight used the wrong player age.');
    assert(flight.lives === 5 && flight.elapsed === 0 && flight.scoreText.text.includes('Tid tilbage: 20 sek.')
      && flight.direction === -1
      && flight.leader.list[1].text === world.player.name,
    'Flight did not start with the correct leader, direction, duration, and lives.');
    assert(heard.includes('flightStart') && heard.includes('flightMusicLow'), 'Flight sounds did not start.');
    flight.flap({ repeat: true });
    assert(!flight.started && !heard.includes('flightFlap'), 'Held space generated repeated flaps.');
    flight.update(0, 1000);
    assert(flight.elapsed === 0 && flight.lives === 5, 'Flight started before the first flap.');
    flight.flap({ repeat: false });
    assert(flight.started && flight.leader.body.velocity.y === -285 && heard.includes('flightFlap'),
      'Space did not start the flight and make the leader climb.');
    flight.trail = [{ time: flight.time.now, y: 570 }];
    flight.leader.body.reset(flight.leader.x, 260);
    flight.update(0, 0);
    assert(flight.follower.y === 570 && flight.lives === 5, 'Lava damaged the following rider.');
    flight.spawnBird();
    let bird = flight.pterodactyls.getChildren()[0];
    assert(bird.body.velocity.x === 185 * flight.difficulty && heard.includes('flightBird'),
      'Bird did not fly against westbound riders at the age-scaled speed.');
    bird.body.reset(flight.follower.x, flight.follower.y);
    flight.physics.overlap(flight.follower, bird, flight.hitBird, undefined, flight);
    assert(flight.lives === 5 && bird.active, 'Follower was vulnerable to a bird.');
    bird.body.reset(flight.leader.x, flight.leader.y);
    flight.physics.overlap(flight.leader, bird, flight.hitBird, undefined, flight);
    assert(flight.lives === 4 && heard.includes('flightBirdHit'), 'Bird did not hit the leader.');
    flight.hit('flightLava');
    assert(flight.lives === 4, 'Invulnerability did not prevent rapid repeated damage.');
    flight.invulnerableUntil = 0;
    flight.leader.body.reset(flight.leader.x, 550);
    flight.update(0, 0);
    assert(flight.lives === 3 && heard.includes('flightLava'), 'Rising lava did not hit the leader.');
    for (let lives = 2; lives >= 0; lives -= 1) {
      flight.invulnerableUntil = 0;
      flight.hit('flightBirdHit');
      assert(flight.lives === lives, 'Flight did not consume exactly one life per hit.');
    }
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after flight loss.');
    assert(world.player.id !== leaderId && world.player.sprite.x >= 0
      && !world.stateManager.getLearnedChallengeIds().includes(challenge.id) && heard.includes('flightLose'),
    'Flight loss did not switch players or left an incorrect question or position.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(50, WEST_CRACK.y);
    ({ flight, challenge } = await start());
    const winner = world.player.id;
    flight.flap({ repeat: false });
    flight.elapsed = 19950;
    flight.update(0, 0);
    assert(!flight.finished, 'Flight ended before its timer expired.');
    flight.update(0, 50);
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after flight victory.');
    assert(world.players.every((player) => player.sprite.body.right <= -32)
      && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.stateManager.turnPoints.get(winner) === 2 && heard.includes('flightWin')
      && world.westMap.getTileAt(WEST_REGION_WIDTH - 1, 12).collides,
    'Victory did not move both players west, credit the question, and keep the wall closed.');
    world.dialogueWindow.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(world.isNearWestCrack() && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= -32),
      'Players did not stay west or could not reach the crack from the west.');
    world.swapLeader();
    assert(world.player.sprite.body.right <= -32, 'Switching leaders bypassed the wall.');
    world.player.sprite.body.reset(-90, WEST_CRACK.y);
    world.movement.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    world.movement.keys.D.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.right <= -31 && world.player.sprite.x > -80
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= -31),
    'Players did not reach or crossed the wall from the west.');
    world.player.sprite.body.reset(-70, WEST_CRACK.y);
    ({ flight } = await start());
    assert(flight.direction === 1, 'Return flight did not reverse direction.');
    flight.flap({ repeat: false });
    flight.spawnBird();
    bird = flight.pterodactyls.getChildren()[0];
    assert(bird.body.velocity.x < 0, 'Bird did not fly against eastbound riders.');
    flight.elapsed = 20000;
    flight.update(0, 0);
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after return flight.');
    assert(world.players.every((player) => player.sprite.body.left >= 0), 'Return flight did not bring both players east.');
    const before = heard.filter((name) => name.startsWith('flightMusic')).length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(heard.filter((name) => name.startsWith('flightMusic')).length === before, 'Flight music continued after leaving.');
  } finally {
    world.movement.keys.D.isDown = false;
    sounds.play = originalPlay;
    collection.collectedIds = savedIds;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    if (previousChallenge === undefined) {
      world.lastNPCChallenges.delete('west-crack');
    } else {
      world.lastNPCChallenges.set('west-crack', previousChallenge);
    }
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.dialogueWindow.close();
  }
}

function testGateInteractions(scene) {
  const manager = scene.npcManager;
  let success;
  let currentChallenge;
  let challengeOptions;
  manager.onChallenge = (challengeId, onCorrect, miniGame, options) => {
    currentChallenge = challengeId;
    success = onCorrect;
    challengeOptions = { miniGame, ...options };
  };
  const byId = (id) => manager.npcs.find((npc) => npc.id === id);
  const blocked = (x, y) => scene.worldMap.getTileAt(x, y).collides;
  const gateClosed = (gate) => {
    const layer = gate === WORLD_TILE.SOUTH_GATE ? scene.southLayer
      : [WORLD_TILE.VOLCANIC_GATE_A, WORLD_TILE.VOLCANIC_GATE_B].includes(gate) ? scene.eastLayer
      : gate === WORLD_TILE.NORTH_FOREST_GATE ? scene.northLayer
      : [WORLD_TILE.WEST_BRIDGE, WORLD_TILE.WEST_FOREST_GATE].includes(gate) ? scene.westLayer : scene.worldLayer;
    const tiles = layer.filterTiles((tile) => tile.index === gate);
    return tiles.length > 0 && tiles.every((tile) => tile.collides);
  };
  for (const gate of Object.values(WORLD_GATES)) {
    assert(gateClosed(gate), `Gate ${gate} is not completely blocked.`);
  }

  manager.runInteraction(byId('volcano-keeper'));
  assert(challengeOptions.miniGame === 'volcanoCrystals' && gateClosed(WORLD_TILE.VOLCANIC_GATE_A),
    'Crystal guardian did not guard its gate.');
  success();
  assert(!gateClosed(WORLD_TILE.VOLCANIC_GATE_A) && gateClosed(WORLD_TILE.VOLCANIC_GATE_B),
    'Crystal guardian opened the wrong gate.');
  manager.runInteraction(byId('volcano-rune-keeper'));
  assert(challengeOptions.miniGame === 'volcanoRunes' && gateClosed(WORLD_TILE.VOLCANIC_GATE_B),
    'Rune guardian did not guard its gate.');
  success();
  assert(!gateClosed(WORLD_TILE.VOLCANIC_GATE_B), 'Rune guardian did not open its gate.');

  manager.runInteraction(byId('west-fairy'));
  scene.dialogueWindow.advance();
  scene.dialogueWindow.advance();
  assert(challengeOptions.randomForPlayer && challengeOptions.miniGame === 'mosquito'
    && gateClosed(WORLD_TILE.WEST_FOREST_GATE), 'Western fairy did not guard her forest.');
  success();
  assert(!scene.westMap.getTileAt(16, 27).collides && scene.westMap.getTileAt(23, 52).collides,
    'Western fairy opened the wrong gate.');
  manager.runInteraction(byId('west-troll'));
  assert(currentChallenge === 'west-troll-apples' && challengeOptions.miniGame === 'troll'
    && gateClosed(WORLD_TILE.WEST_BRIDGE), 'Western troll did not guard the bridge.');
  success();
  assert(!scene.westMap.getTileAt(23, 52).collides && scene.westMap.getTileAt(31, 52).collides,
    'Western troll opened the wrong gate or removed the wall.');

  manager.runInteraction(byId('flora'));
  assert(scene.dialogueWindow.message.text.includes('Flora'), 'Flora does not introduce herself.');
  scene.dialogueWindow.advance();
  scene.dialogueWindow.advance();
  assert(currentChallenge === 'flora-forest' && challengeOptions.randomForPlayer
    && challengeOptions.npcId === 'flora' && challengeOptions.miniGame === 'mosquito'
    && typeof success === 'function' && blocked(64, 16), 'Flora did not offer her forest challenge.');
  success();
  assert(!blocked(64, 16) && blocked(68, 52), 'Flora opened the wrong gate.');

  success = null;
  manager.runInteraction(byId('bridge-troll'));
  assert(typeof success === 'function' && !challengeOptions.randomForPlayer && challengeOptions.miniGame === 'troll'
    && blocked(31, 32), 'Bridge opened before success or troll challenge became random.');
  success();
  assert(!blocked(31, 32) && blocked(68, 52) && blocked(93, 64), 'Troll opened the wrong gate.');

  success = null;
  manager.runInteraction(byId('river-troll'));
  assert(currentChallenge === 'river-troll-berries' && challengeOptions.miniGame === 'troll' && typeof success === 'function'
    && blocked(93, 64), 'Second troll did not guard its bridge.');
  assert(scene.challengeManager.evaluateAnswer(currentChallenge, '7')
    && !scene.challengeManager.evaluateAnswer(currentChallenge, '6'),
  'Second troll challenge does not evaluate its answers correctly.');
  success();
  assert(!blocked(93, 64) && blocked(68, 52), 'Second troll opened the wrong gate.');

  success = null;
  manager.runInteraction(byId('luna'));
  assert(scene.dialogueWindow.message.text.includes('Luna'), 'Luna does not introduce herself.');
  scene.dialogueWindow.advance();
  scene.dialogueWindow.advance();
  assert(scene.dialogueWindow.mode === 'quest', 'Luna did not offer her quest after the introduction.');
  scene.dialogueWindow.chooseQuest(false);
  scene.dialogueWindow.close();
  assert(blocked(68, 52) && success === null, 'Declining Luna opened her gate.');
  manager.runInteraction(byId('luna'));
  scene.dialogueWindow.chooseQuest(true);
  assert(currentChallenge === 'regnbue' && challengeOptions.randomForPlayer
    && challengeOptions.npcId === 'luna' && challengeOptions.miniGame === 'mosquito'
    && typeof success === 'function' && blocked(68, 52), 'Luna did not offer her forest challenge.');
  success();
  assert(!blocked(68, 52), 'Luna gate did not open after success.');
  assert(scene.questManager.getQuest('rainbow-forest-rainbow').completed, 'Luna quest was not completed.');
  scene.dialogueWindow.close();
}

async function testOpenWestGates(scene) {
  const leader = scene.player;
  const positions = scene.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  try {
    leader.sprite.body.reset(-400, 880);
    scene.leaderFollowerSystem.players[1].sprite.body.reset(-350, 880);
    scene.leaderFollowerSystem.setLeader(leader.id);
    scene.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 800));
    scene.movement.keys.A.isDown = false;
    scene.movement.update();
    assert(leader.sprite.x < -560, 'Player could not walk through the opened western forest gate.');
    leader.sprite.body.reset(-272, 1600);
    scene.leaderFollowerSystem.players[1].sprite.body.reset(-272, 1540);
    scene.leaderFollowerSystem.setLeader(leader.id);
    scene.movement.keys.S.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 800));
    scene.movement.keys.S.isDown = false;
    scene.movement.update();
    assert(leader.sprite.y > 1780, 'Player could not walk over the opened western bridge.');
  } finally {
    scene.movement.keys.A.isDown = false;
    scene.movement.keys.S.isDown = false;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    scene.setLeader(leader.id);
  }
}

function collect(scene, type, count) {
  const pickups = scene.collectibleManager.pickups.getChildren()
    .filter((pickup) => scene.collectibleManager.getItemForPickup(pickup).type === type);
  for (const pickup of pickups.slice(0, count)) {
    scene.collectPickup(pickup);
    assertAccessoryCounters(scene);
    assertUnicornCounters(scene);
  }
}

function assertUnicornCounters(scene) {
  const all = scene.collectibleManager.getAllItems().filter((item) => item.type === 'unicorn');
  const collected = scene.collectibleManager.getCollectedItems('unicorn');
  const categories = [
    ['original', 'Hvide', (item) => !/^unicorn-(rainbow|dark|volcano)-/.test(item.texture), 6],
    ['rainbow', 'Regnbue', (item) => item.texture.startsWith('unicorn-rainbow-'), 3],
    ['dark', 'Mørke', (item) => item.texture.startsWith('unicorn-dark-'), 3],
    ['volcano', 'Vulkan', (item) => item.texture.startsWith('unicorn-volcano-'), 3],
  ];
  assert(scene.hud.unicornCounters.size === 4, 'Unicorn family counters are missing.');
  for (const [id, label, matches, expected] of categories) {
    const count = collected.filter(matches).length;
    const total = all.filter(matches).length;
    assert(total === expected && scene.hud.unicornCounters.get(id).textContent === `${label}: ${count} / ${total}`,
      `${label} unicorn counter does not match the collected items.`);
  }
}

function testUnicornCounters(scene) {
  const collection = scene.collectibleManager;
  const originalIds = collection.collectedIds;
  const unicorns = collection.getAllItems().filter((item) => item.type === 'unicorn');
  try {
    collection.collectedIds = new Set([
      unicorns.find((item) => item.texture === 'unicorn-purple').id,
      unicorns.find((item) => item.texture.startsWith('unicorn-rainbow-')).id,
      unicorns.find((item) => item.texture.startsWith('unicorn-volcano-')).id,
    ]);
    scene.updateCollectionProgress();
    assertUnicornCounters(scene);
    assert(scene.hud.unicornCounters.get('original').textContent === 'Hvide: 1 / 6'
      && scene.hud.unicornCounters.get('rainbow').textContent === 'Regnbue: 1 / 3'
      && scene.hud.unicornCounters.get('dark').textContent === 'Mørke: 0 / 3'
      && scene.hud.unicornCounters.get('volcano').textContent === 'Vulkan: 1 / 3',
    'Unicorn family counters did not distinguish mixed progress.');
  } finally {
    collection.collectedIds = originalIds;
    scene.updateCollectionProgress();
  }
}

function testHudLayout(scene) {
  const hud = scene.hud.element;
  const controls = hud.querySelector('.hud-controls').getBoundingClientRect();
  const unicorns = hud.querySelector('.hud-unicorns').getBoundingClientRect();
  const collection = hud.querySelector('.hud-collection').getBoundingClientRect();
  const reset = scene.hud.resetButton.getBoundingClientRect();
  const player = scene.hud.turn.getBoundingClientRect();
  assert(controls.right <= unicorns.left && unicorns.right <= collection.left
    && reset.top < player.top && hud.scrollWidth <= hud.clientWidth,
  'HUD columns overlap or are incorrectly ordered.');
}

function assertAccessoryCounters(scene) {
  const all = scene.collectibleManager.getAllItems().filter((item) => item.type === 'accessory');
  const collected = scene.collectibleManager.getCollectedItems('accessory');
  const categories = [
    ['sticker', 'Mærker'], ['saddle', 'Sadler'], ['wings', 'Vinger'], ['crown', 'Hatte'],
  ];
  assert(scene.hud.collectionProgress.children.length === categories.length, 'Accessory counter categories are missing.');
  for (const [slot, label] of categories) {
    const count = collected.filter((item) => item.slot === slot).length;
    const total = all.filter((item) => item.slot === slot).length;
    assert(scene.hud.accessoryCounters.get(slot).textContent === `${label}: ${count} / ${total}`,
      `${label} counter does not match the collected items.`);
  }
}

function testCollection(scene, firstType, secondType) {
  collect(scene, firstType, 3);
  collect(scene, secondType, 2);
  collect(scene, secondType, 1);
  assert(scene.collectibleManager.getCollectedCount('unicorn') === 3
    && scene.collectibleManager.getCollectedCount('accessory') === 3,
  'Collecting three of each did not update the collection.');
  assert(scene.sys.isActive() && !scene.ui.list.some((object) => object.text === 'Fortsæt eventyret'),
    'Collecting three of each interrupted the adventure.');
  assertUnicornCounters(scene);
  assertAccessoryCounters(scene);
}

function testChallenges(scene) {
  const manager = scene.challengeManager;
  const challenges = manager.getAllChallenges();
  const beginnerReading = challenges.filter((challenge) => challenge.category === 'Reading'
    && challenge.difficulty === 1);
  assert(beginnerReading.length >= 5, 'Too few beginner reading challenges.');
  for (const challenge of beginnerReading) {
    const text = [
      challenge.question, ...challenge.options, ...Object.values(challenge.story),
    ].join(' ');
    const words = text.match(/[A-Za-zÆØÅæøå]+/g) ?? [];
    assert(words.every((word) => word.length <= 3), `${challenge.id} has a word longer than 3 letters.`);
    assert(manager.evaluateAnswer(challenge.id, challenge.correctAnswer)
      && challenge.options.some((option) => !manager.evaluateAnswer(challenge.id, option)),
    `${challenge.id} does not have a correct answer and a wrong answer.`);
  }
  for (const difficulty of [1, 2]) {
    const englishCount = challenges.filter((challenge) => challenge.category === 'English'
      && challenge.difficulty === difficulty).length;
    assert(englishCount >= 12, `Too few English challenges at level ${difficulty}.`);
    for (const category of ['Reading', 'Math', 'Logic']) {
      const count = challenges.filter((challenge) => challenge.category === category
        && challenge.difficulty === difficulty).length;
      assert(count === englishCount * 2, `${category} is not twice the English pool at level ${difficulty}.`);
    }
    for (const challenge of challenges.filter((item) => item.difficulty === difficulty)) {
      assert(challenge.options.length === 3
        && challenge.options.filter((option) => manager.answersMatch(option, challenge.correctAnswer)).length === 1
        && new Set(challenge.options.map((option) => String(option).trim().toLocaleLowerCase())).size === 3,
      `${challenge.id} must have three distinct options and exactly one correct answer.`);
    }
  }
  const reserved = scene.npcManager.getGateChallengeIds();
  const originalRandom = Math.random;
  const originalStart = scene.startChallenge;
  const pickup = scene.collectibleManager.pickups.getChildren()
    .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'unicorn');
  try {
    for (const options of [['a', 'b', 'c'], ['a', 'b']]) {
      const question = { options, correctAnswer: 'a' };
      const positions = new Set();
      for (let offset = 0; offset < options.length; offset += 1) {
        Math.random = () => (offset + 0.5) / options.length;
        const rotated = manager.rotateOptions(question);
        positions.add(rotated.options.indexOf('a'));
        assert(rotated.options !== options && rotated.options.length === options.length
          && rotated.options.every((option) => options.includes(option)),
        'Rotation lost or mutated answer options.');
      }
      assert(positions.size === options.length && options[0] === 'a',
        'Rotation did not cover every correct-answer position equally.');
    }
    Math.random = () => 0;
    const first = manager.getChallengeForAge(6, [], reserved);
    Math.random = () => 0.999999;
    const last = manager.getChallengeForAge(6, [], reserved);
    assert(first.id !== last.id && first.difficulty === 1 && last.difficulty === 1,
      'Random selection does not use the full appropriate pool.');
    const fresh = manager.getChallengeForAge(6, [last.id], reserved);
    assert(fresh.id !== last.id && !reserved.includes(fresh.id), 'Solved or gatekeeper challenge was selected.');
    const allSuitable = challenges.filter((challenge) => challenge.difficulty <= 1)
      .map((challenge) => challenge.id);
    const repeated = manager.getChallengeForAge(6, allSuitable, reserved);
    assert(repeated.difficulty === 1 && !reserved.includes(repeated.id),
      'Exhausted beginner pool chose a harder or reserved challenge.');
    let noSuitable = false;
    try {
      manager.getChallengeForAge(6, [], allSuitable);
    } catch (error) {
      noSuitable = error.message.includes('passende niveau');
    }
    assert(noSuitable, 'Missing suitable challenges did not report an error.');

    let selected;
    scene.startChallenge = (challenge) => { selected = challenge; };
    for (const age of [8, 6]) {
      while (scene.leaderFollowerSystem.leader.age !== age) {
        scene.swapLeader();
      }
      selected = null;
      scene.collectWorldItem(scene.leaderFollowerSystem.leader.sprite, pickup);
      assert(selected?.difficulty === manager.getDifficultyForAge(age)
        && !reserved.includes(selected.id), `Unicorn did not use active player age ${age}.`);
    }
  } finally {
    Math.random = originalRandom;
    scene.startChallenge = originalStart;
    while (scene.leaderFollowerSystem.leader.age !== 8) {
      scene.swapLeader();
    }
  }
}

function testFairyQuestionSelection(scene) {
  const originalRandom = Math.random;
  const originalStart = scene.startChallenge;
  const originalSelect = scene.challengeManager.getChallengeForAge;
  let selected;
  try {
    scene.startChallenge = (challenge) => { selected = challenge; };
    for (const age of [6, 8]) {
      while (scene.player.age !== age) {
        scene.swapLeader();
      }
      for (const [npcId, challengeId] of [['flora', 'flora-forest'], ['luna', 'regnbue']]) {
        const options = { randomForPlayer: true, npcId };
        scene.lastNPCChallenges.delete(npcId);
        Math.random = () => 0;
        scene.startNPCChallenge(challengeId, () => {}, 'mosquito', options);
        const first = selected;
        scene.lastNPCChallenges.delete(npcId);
        Math.random = () => 0.999999;
        scene.startNPCChallenge(challengeId, () => {}, 'mosquito', options);
        assert(first.id !== selected.id
          && first.difficulty === scene.challengeManager.getDifficultyForAge(age)
          && selected.difficulty === first.difficulty,
        `${npcId} did not randomly select varied age-${age} questions.`);
      }
    }
    scene.challengeManager.getChallengeForAge = () => { throw new Error('Ingen passende spørgsmål.'); };
    selected = null;
    scene.startNPCChallenge('flora-forest', () => {}, 'mosquito', { randomForPlayer: true, npcId: 'flora' });
    assert(!selected && scene.dialogueWindow.isOpen && scene.dialogueWindow.message.text.includes('Ingen passende spørgsmål'),
      'A missing fairy question was not reported.');
    scene.dialogueWindow.close();
  } finally {
    Math.random = originalRandom;
    scene.startChallenge = originalStart;
    scene.challengeManager.getChallengeForAge = originalSelect;
    scene.lastNPCChallenges.clear();
    while (scene.player.age !== 8) {
      scene.swapLeader();
    }
  }
}

function testInteractionSounds(scene) {
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const manager = scene.npcManager;
  const originalRun = manager.runInteraction;
  const originalCollect = scene.collectibleManager.collect;
  const originalStart = scene.startChallenge;
  const originalRecord = scene.stateManager.recordAccessory;
  const heard = [];
  try {
    sounds.play = (name) => heard.push(name);
    manager.runInteraction = () => {};
    for (const [id, expected] of [
      ['bridge-troll', 'troll'], ['river-troll', 'troll'], ['flora', 'fairy'], ['luna', 'fairy'],
    ]) {
      manager.activeNPC = manager.npcs.find((npc) => npc.id === id);
      manager.interact();
      assert(heard.pop() === expected, `${id} did not play its interaction sound.`);
    }
    scene.startChallenge = () => {};
    const unicorn = scene.collectibleManager.pickups.getChildren()
      .find((pickup) => scene.collectibleManager.getItemForPickup(pickup).type === 'unicorn');
    scene.collectWorldItem(scene.player.sprite, unicorn);
    assert(heard.pop() === 'unicorn', 'Unicorn encounter did not play a gallop.');
    scene.stateManager.recordAccessory = () => false;
    const expectedSounds = { wings: 'wings', crown: 'crown', saddle: 'saddlePickup', sticker: 'stickerPickup' };
    const accessories = scene.collectibleManager.getAllItems().filter((item) => item.type === 'accessory');
    assert(accessories.length > 0, 'No accessories were available to test pickup sounds.');
    for (const item of accessories) {
      scene.collectibleManager.collect = () => item;
      scene.collectPickup({});
      assert(heard.length === 1 && heard.pop() === expectedSounds[item.slot], `${item.id} played the wrong pickup sound.`);
    }
    scene.collectibleManager.collect = () => null;
    scene.collectPickup({});
    assert(heard.length === 0, 'An already-collected pickup played a success sound.');
    scene.collectibleManager.collect = () => ({ id: 'test-unicorn', type: 'unicorn' });
    scene.collectPickup({});
    assert(heard.length === 0, 'Collecting a unicorn played an accessory pickup sound.');
    scene.collectibleManager.collect = () => { throw new Error('test'); };
    scene.collectPickup({});
    assert(heard.length === 0 && scene.dialogueWindow.isOpen,
      'A failed pickup played a success sound or did not report the error.');
    scene.dialogueWindow.close();
    scene.failedPickup = null;
  } finally {
    sounds.play = originalPlay;
    manager.runInteraction = originalRun;
    scene.collectibleManager.collect = originalCollect;
    scene.startChallenge = originalStart;
    scene.stateManager.recordAccessory = originalRecord;
  }
}

function testMovementAndProximitySounds(scene) {
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const leader = { id: 'test', sprite: { x: 0, y: 0, body: { velocity: new Phaser.Math.Vector2() } } };
  const manager = scene.npcManager;
  try {
    sounds.play = (name) => heard.push(name);
    scene.lastFootstepPosition = null;
    scene.nextFootstepTime = 0;
    scene.updateFootsteps(0, leader);
    scene.updateFootsteps(400, leader);
    assert(!heard.length, 'Stationary player made footsteps.');
    leader.sprite.body.velocity.set(242, 0);
    scene.updateFootsteps(500, leader);
    assert(!heard.length, 'Blocked player made footsteps.');
    leader.sprite.x += 1;
    scene.updateFootsteps(510, leader);
    assert(heard.join(',') === 'footstep', 'Moving player did not make a footstep.');
    leader.sprite.x += 1;
    scene.updateFootsteps(600, leader);
    assert(heard.length === 1, 'Footsteps repeated before the interval.');
    leader.sprite.x += 1;
    scene.updateFootsteps(810, leader);
    assert(heard.length === 2, 'Footsteps did not continue while moving.');
    scene.dialogueWindow.showLines('Prøve', ['Prøve']);
    leader.sprite.x += 1;
    scene.updateFootsteps(1200, leader);
    assert(heard.length === 2, 'Footsteps played during dialogue.');
    scene.dialogueWindow.close();
    heard.length = 0;
    manager.nearbyNPCs.clear();
    const npc = manager.npcs.find((item) => item.id === 'flora');
    leader.sprite.x = npc.x;
    leader.sprite.y = npc.y;
    manager.update(leader);
    manager.update(leader);
    assert(heard.join(',') === 'npcNearby', 'Proximity sound did not play exactly once on entry.');
    manager.update(leader, true);
    manager.update(leader);
    assert(heard.length === 1, 'Proximity sound repeated after dialogue or blocking.');
    leader.sprite.x = 0;
    leader.sprite.y = 0;
    manager.update(leader);
    leader.sprite.x = npc.x;
    leader.sprite.y = npc.y;
    manager.update(leader);
    assert(heard.length === 2 && heard[1] === 'npcNearby', 'Re-entering NPC proximity did not play a sound.');
  } finally {
    sounds.play = originalPlay;
    manager.nearbyNPCs.clear();
    scene.lastFootstepPosition = null;
    scene.nextFootstepTime = 0;
  }
}

function testWeightedTurnCounts() {
  const combinations = [
    ['question', 'question'],
    ['accessory', 'accessory', 'accessory', 'accessory'],
    ['question', 'accessory', 'accessory'],
    ['accessory', 'accessory', 'accessory', 'question'],
  ];
  for (const events of combinations) {
    const state = new GameStateManager();
    events.forEach((event, index) => {
      const switched = event === 'question' ? state.recordQuestion('a') : state.recordAccessory('a');
      assert(switched === (index === events.length - 1),
        `Wrong turn threshold for ${events.join(', ')}.`);
    });
    assert(!state.recordAccessory('a'), 'Automatic switch did not reset the count.');
  }
}

async function testBeginnerReadingScene(scene) {
  const challenge = scene.challengeManager.getChallenge('reading-short-cat');
  const answeringPlayer = scene.leaderFollowerSystem.leader.id;
  scene.startChallenge(challenge);
  const deadline = Date.now() + 5000;
  const challengeScene = scene.game.scene.getScene('ChallengeScene');
  while (!challengeScene.sys.isActive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(challengeScene.sys.isActive(), 'Beginner reading challenge did not open.');
  assert(!challengeScene.children.list.some((object) => typeof object.text === 'string'
    && (/^Læs · 1$/.test(object.text) || object.text === 'LÆS')),
  'Beginner question displayed its category or difficulty.');
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const displayedWords = challengeScene.children.list
    .filter((object) => typeof object.text === 'string')
    .map((object) => object.text).join(' ').match(/[A-Za-zÆØÅæøå]+/g) ?? [];
  assert(displayedWords.every((word) => word.length <= 3),
    'Beginner reading challenge screen has a word longer than 3 letters.');
  const wrong = challengeScene.challenge.options.findIndex((option) => !scene.challengeManager.answersMatch(option, challenge.correctAnswer));
  const correct = challengeScene.challenge.options.findIndex((option) => scene.challengeManager.answersMatch(option, challenge.correctAnswer));
  challengeScene.answerButtons[wrong].emit('pointerdown');
  assert(!challengeScene.isResolved && challengeScene.feedback.text === challenge.story.hint,
    'Wrong beginner reading answer did not show a hint.');
  assert(heard.length === 0, 'Wrong answer played a completion sound.');
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'Wrong answer switched players.');
  challengeScene.answerButtons[correct].emit('pointerdown');
  assert(challengeScene.isResolved && challengeScene.feedback.text === challenge.story.success,
    'Correct beginner reading answer was not accepted.');
  challengeScene.answerButtons[correct].emit('pointerdown');
  assert(heard.join(',') === 'questionCorrect', 'Correct answer did not play exactly one completion sound.');
  sounds.play = originalPlay;
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'Player switched before the question was closed.');
  challengeScene.continueButton.emit('pointerdown');
  while (!scene.sys.isActive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(scene.sys.isActive() && scene.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Completing beginner reading did not resume the world.');
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'One question switched players before the four-point threshold.');
}

async function testAutomaticTurns(scene, store, failingStore) {
  const players = scene.leaderFollowerSystem.players;
  const first = players[0].id;
  const second = players[1].id;
  const collectAccessory = () => {
    const pickup = scene.collectibleManager.pickups.getChildren()
      .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'accessory');
    scene.collectWorldItem(scene.leaderFollowerSystem.leader.sprite, pickup);
  };
  const leader = () => scene.leaderFollowerSystem.leader.id;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 200));
  const checkPopup = (name) => {
    assert(!scene.hud.turnPopup.hidden && scene.hud.turnPopup.textContent.includes(name),
      'Player switch did not show the correct pop-up.');
  };
  const answer = async (challenge, switches, trollGame = false) => {
    const challengeScene = scene.game.scene.getScene('ChallengeScene');
    let deadline = Date.now() + 10000;
    while (!challengeScene.sys.isActive() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(challengeScene.sys.isActive(), 'Turn test challenge did not open.');
    const correct = challengeScene.challenge.options.findIndex((option) => (
      scene.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    const wrong = challengeScene.challenge.options.findIndex((option) => (
      !scene.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    const before = leader();
    challengeScene.answerButtons[wrong].emit('pointerdown');
    assert(leader() === before && !challengeScene.isResolved, 'Wrong answer changed turn.');
    challengeScene.answerButtons[correct].emit('pointerdown');
    assert(leader() === before, 'Correct answer changed turn before closing the question.');
    challengeScene.continueButton.emit('pointerdown');
    if (trollGame) {
      const troll = scene.game.scene.getScene('TrollScene');
      deadline = Date.now() + 10000;
      while (!troll.sys.isActive() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert(troll.sys.isActive() && leader() === before, 'Troll game did not start before switching.');
      for (let count = 0; count < 7; count += 1) {
        troll.collectApple(troll.player, troll.apples.getChildren()[0]);
      }
    }
    deadline = Date.now() + 10000;
    while ((!scene.sys.isActive() || challengeScene.sys.isActive()) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(scene.sys.isActive() && (leader() !== before) === switches,
      'Completed question switched at the wrong threshold.');
    if (switches) {
      checkPopup(scene.player.name);
    }
  };

  collectAccessory();
  assert(leader() === first, 'One accessory switched turns.');
  scene.input.keyboard.emit('keydown-T');
  assert(leader() === second, 'Manual T switch did not change turn.');
  checkPopup(scene.player.name);
  collectAccessory();
  assert(leader() === second, 'Each player should have an independent accessory count.');
  scene.enterStable();
  const stable = await waitForStable(scene.game, 0);
  stable.swapLeader();
  checkPopup(stable.followers.leader.name);
  stable.swapLeader();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await wait();
  assert(scene.sys.isActive() && leader() === second, 'Stable switching changed the active player unexpectedly.');
  scene.input.keyboard.emit('keydown-T');
  assert(leader() === first, 'Manual switching back failed.');
  scene.collectibleManager.store = failingStore;
  collectAccessory();
  assert(leader() === first && scene.dialogueWindow.isOpen,
    'Failed collection changed the turn or did not report the error.');
  scene.collectibleManager.store = store;
  scene.dialogueWindow.close();
  scene.failedPickup = null;
  collectAccessory();
  assert(leader() === first, 'Two accessories switched before the four-point threshold.');

  const trollQuestion = scene.challengeManager.getChallenge('math-addition');
  scene.npcManager.runInteraction(scene.npcManager.npcs.find((npc) => npc.id === 'bridge-troll'));
  await answer(trollQuestion, true, true);
  assert(!scene.worldMap.getTileAt(31, 32).collides, 'Troll gate did not open before switching.');
  scene.dialogueWindow.close();
  assert(leader() === second && scene.hud.turn.textContent === `${scene.player.name} har turen`,
    'Question switch did not update the active player and HUD.');
  collectAccessory();
  assert(leader() === second, 'Two accessories switched before the four-point threshold.');

  const pickup = scene.collectibleManager.pickups.getChildren()
    .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'unicorn');
  const item = scene.collectibleManager.getItemForPickup(pickup);
  const originalStart = scene.startChallenge;
  let unicornQuestion;
  scene.startChallenge = function (challenge, onCorrect) {
    unicornQuestion = challenge;
    return originalStart.call(this, challenge, onCorrect);
  };
  try {
    scene.collectWorldItem(scene.player.sprite, pickup);
  } finally {
    scene.startChallenge = originalStart;
  }
  assert(unicornQuestion, 'Unicorn did not start a question.');
  await answer(unicornQuestion, true);
  assert(scene.collectibleManager.collectedIds.has(item.id) && leader() === first,
    'Unicorn was not collected before the turn switched.');
  collectAccessory();
  assert(leader() === first, 'A completed turn did not reset the previous count.');
  collectAccessory();
  collectAccessory();
  assert(leader() === first, 'Three accessories switched before the threshold.');
  collectAccessory();
  assert(leader() === second && scene.movement.player === scene.player.sprite,
    'Four accessories did not switch the active movement player.');
  checkPopup(scene.player.name);

  const reading = scene.challengeManager.getChallenge('reading-short-cat');
  scene.startChallenge(reading);
  await answer(reading, false);
  scene.startChallenge(reading);
  await answer(reading, true);
  assert(leader() === first, 'Two questions did not switch players.');
  scene.startChallenge(reading);
  await answer(reading, false);
  collectAccessory();
  assert(leader() === first, 'One question and one accessory switched too early.');
  collectAccessory();
  assert(leader() === second, 'One question and two accessories did not switch.');
  checkPopup(scene.player.name);
  await new Promise((resolve) => setTimeout(resolve, 2700));
  assert(scene.hud.turnPopup.hidden, 'Turn pop-up did not disappear.');
}

async function testFairyShooter(world) {
  const game = world.game;
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert(condition(), message);
  };
  const fairy = (id) => world.npcManager.npcs.find((npc) => npc.id === id);
  const launch = async (id) => {
    const npc = fairy(id);
    const originalStart = world.startChallenge;
    let challenge;
    world.startChallenge = function (selected, ...args) {
      challenge = selected;
      return originalStart.call(this, selected, ...args);
    };
    try {
      world.npcManager.runInteraction(npc);
      if (world.dialogueWindow.isOpen) {
        while (world.dialogueWindow.mode === 'dialogue') {
          world.dialogueWindow.advance();
        }
        if (world.dialogueWindow.mode === 'quest') {
          world.dialogueWindow.chooseQuest(true);
        }
      }
    } finally {
      world.startChallenge = originalStart;
    }
    assert(challenge && challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age)
      && !world.npcManager.getGateChallengeIds().includes(challenge.id),
    `${id} did not select a suitable non-reserved question.`);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), `${id} question did not start.`);
    const correct = question.challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const shooter = game.scene.getScene('MosquitoScene');
    await waitUntil(() => shooter.sys.isActive(), `${id} shooter did not start.`);
    assert(shooter.difficulty === minigameSpeed(world.player.age), 'Mosquito game used the wrong player age.');
    assert(world.sys.isPaused() && world.isAnswering && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      `${id} was marked complete before the shooter was won.`);
    return { shooter, challenge };
  };
  const hit = async (shooter) => {
    const before = shooter.hits;
    const mosquito = shooter.mosquitoes.create(400, 200, 'mosquito-game-mosquito');
    mosquito.body.setVelocity(0, 0);
    shooter.stars.create(400, 200, 'mosquito-game-star');
    await waitUntil(() => shooter.hits === before + 1, 'Star did not hit mosquito.');
  };
  const win = async (shooter) => {
    shooter.time.removeAllEvents();
    shooter.stars.clear(true, true);
    shooter.mosquitoes.clear(true, true);
    for (let count = 0; count < 10; count += 1) {
      await hit(shooter);
      if (count < 9) {
        assert(!shooter.finished, 'Shooter ended before ten hits.');
      }
    }
    await waitUntil(() => world.sys.isActive() && !shooter.sys.isActive(), 'World did not resume after winning.');
  };
  const lose = async (shooter) => {
    shooter.time.removeAllEvents();
    shooter.stars.clear(true, true);
    shooter.mosquitoes.clear(true, true);
    for (let count = 0; count < 20; count += 1) {
      shooter.mosquitoes.create(400, 622, 'mosquito-game-mosquito');
      shooter.update();
    }
    assert(shooter.escaped === 20 && !shooter.finished, 'Shooter ended before more than 20 mosquitoes escaped.');
    shooter.spawnMosquito();
    shooter.update();
    shooter.mosquitoes.create(400, 622, 'mosquito-game-mosquito');
    shooter.update();
    await waitUntil(() => world.sys.isActive() && !shooter.sys.isActive(), 'World did not resume after losing.');
  };

  const firstPlayer = world.player.id;
  world.stateManager.recordAccessory(firstPlayer);
  let attempt = await launch('flora');
  let { shooter, challenge } = attempt;
  const firstFloraQuestion = challenge.id;
  assert(heard.pop() === 'mosquitoStart', 'Mosquito game did not play its start sound.');
  assert(heard.pop() === 'questionCorrect', 'Fairy question did not play its completion sound.');
  const originalBuzz = sounds.startMosquitoBuzz;
  let buzzStarted = 0;
  let buzzStopped = 0;
  sounds.startMosquitoBuzz = () => {
    buzzStarted += 1;
    return { stop: () => { buzzStopped += 1; } };
  };
  shooter.time.removeAllEvents();
  shooter.spawnMosquito();
  assert(shooter.mosquitoes.getChildren()[0].body.velocity.y === 55 * shooter.difficulty,
    'Mosquito speed did not use the difficulty.');
  shooter.update();
  shooter.update();
  assert(buzzStarted === 1 && buzzStopped === 0, 'Buzz did not start once for mosquitoes.');
  shooter.events.emit('pause');
  assert(buzzStopped === 1 && !shooter.buzz, 'Pausing did not stop the buzz.');
  shooter.update();
  assert(buzzStarted === 2, 'Buzz did not resume with mosquitoes present.');
  shooter.mosquitoes.clear(true, true);
  shooter.update();
  assert(buzzStopped === 2 && !shooter.buzz, 'Buzz did not stop after the last mosquito.');
  shooter.spawnMosquito();
  shooter.update();
  assert(buzzStarted === 3, 'Buzz did not restart for a new mosquito.');
  shooter.mosquitoes.clear(true, true);
  assert(world.worldMap.getTileAt(64, 16).collides, 'Flora gate opened before the shooter.');
  shooter.pointWand({ x: 600, y: 370 });
  shooter.input.keyboard.emit('keydown-SPACE', { repeat: false });
  assert(shooter.stars.getLength() === 1, 'MELLEMRUM did not fire one star.');
  assert(heard.pop() === 'star', 'Star did not play its firing sound.');
  shooter.input.keyboard.emit('keydown-SPACE', { repeat: true });
  assert(shooter.stars.getLength() === 1 && heard.length === 0, 'Holding space fired another star.');
  const single = shooter.stars.getChildren()[0];
  assert(single.body.velocity.x > 0 && single.body.velocity.y < 0
    && Math.abs(single.body.velocity.x + single.body.velocity.y) < 0.01,
  'Space star did not aim toward the cursor.');
  shooter.stars.clear(true, true);
  await clickCanvas(game, 200, 370);
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert(shooter.stars.getLength() === 0 && heard.length === 0, 'Mouse click fired stars or played a shot.');
  await lose(shooter);
  assert(buzzStarted === 4 && buzzStopped === 4 && !shooter.buzz, 'Buzz did not stop when the game ended.');
  sounds.startMosquitoBuzz = originalBuzz;
  assert(heard.filter((name) => name === 'mosquitoEscape').length === 21
    && heard.filter((name) => name === 'mosquitoLose').length === 1,
  'Escaping mosquitoes or losing did not play the correct sounds.');
  heard.length = 0;
  assert(world.player.id !== firstPlayer && world.worldMap.getTileAt(64, 16).collides
    && !world.stateManager.getLearnedChallengeIds().includes(firstFloraQuestion)
    && world.stateManager.turnPoints.get(firstPlayer) === 1 && world.dialogueWindow.isOpen,
  'Losing did not switch players, preserve points, and leave the question and gate unfinished.');
  world.dialogueWindow.close();
  attempt = await launch('flora');
  ({ shooter, challenge } = attempt);
  assert(challenge.id !== firstFloraQuestion, 'Flora repeated her last question despite available alternatives.');
  await win(shooter);
  assert(heard.filter((name) => name === 'mosquitoHit').length === 10
    && heard.filter((name) => name === 'mosquitoWin').length === 1,
  'Hits or winning did not play the correct sounds.');
  heard.length = 0;
  assert(!world.worldMap.getTileAt(64, 16).collides
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
    && world.stateManager.turnPoints.get(world.player.id) === 2 && world.dialogueWindow.isOpen,
  'Winning Flora shooter did not open the gate and credit the question.');
  world.dialogueWindow.close();

  attempt = await launch('luna');
  ({ shooter, challenge } = attempt);
  const firstLunaQuestion = challenge.id;
  assert(world.worldMap.getTileAt(68, 52).collides
    && !world.questManager.getQuest('rainbow-forest-rainbow').completed,
  'Luna quest or gate completed before the shooter.');
  const lunaPlayer = world.player.id;
  await lose(shooter);
  assert(world.player.id !== lunaPlayer && world.worldMap.getTileAt(68, 52).collides
    && !world.questManager.getQuest('rainbow-forest-rainbow').completed
    && world.questManager.getActiveQuests().some((quest) => quest.id === 'rainbow-forest-rainbow')
    && !world.stateManager.getLearnedChallengeIds().includes(firstLunaQuestion)
    && world.stateManager.turnPoints.get(lunaPlayer) === 2,
  'Losing Luna shooter changed the quest, gate, question or unfinished points.');
  world.dialogueWindow.close();
  world.swapLeader();
  attempt = await launch('luna');
  ({ shooter, challenge } = attempt);
  assert(challenge.id !== firstLunaQuestion, 'Luna repeated her last question despite available alternatives.');
  await win(shooter);
  assert(!world.worldMap.getTileAt(68, 52).collides
    && world.questManager.getQuest('rainbow-forest-rainbow').completed
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
    && world.player.id === firstPlayer,
  'Winning Luna shooter did not complete the quest, open the gate and count the question.');
  world.dialogueWindow.close();
  attempt = await launch('west-fairy');
  ({ shooter, challenge } = attempt);
  const westQuestion = challenge.id;
  const westPlayer = world.player.id;
  await lose(shooter);
  assert(world.player.id !== westPlayer && world.westMap.getTileAt(16, 27).collides
    && !world.stateManager.getLearnedChallengeIds().includes(westQuestion),
  'Losing Iris’s game did not preserve the western forest and question.');
  world.dialogueWindow.close();
  attempt = await launch('west-fairy');
  ({ shooter, challenge } = attempt);
  await win(shooter);
  assert(!world.westMap.getTileAt(16, 27).collides && world.westMap.getTileAt(23, 52).collides
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id),
  'Winning Iris’s game did not open only the western forest and credit the question.');
  world.dialogueWindow.close();
  sounds.play = originalPlay;
}

async function testTrollGame(world) {
  const game = world.game;
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert(condition(), message);
  };
  const start = async (npcId, challengeId, gateX, gateY) => {
    const player = world.player;
    const challenge = world.challengeManager.getChallenge(challengeId);
    world.npcManager.runInteraction(world.npcManager.npcs.find((npc) => npc.id === npcId));
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), `${npcId} question did not start.`);
    const correct = question.challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const troll = game.scene.getScene('TrollScene');
    await waitUntil(() => troll.sys.isActive(), `${npcId} game did not start.`);
    assert(troll.difficulty === minigameSpeed(player.age), 'Troll game used the wrong player age.');
    const map = npcId === 'north-troll' ? world.northMap : npcId === 'west-troll' ? world.westMap : world.worldMap;
    assert(world.sys.isPaused() && world.isAnswering && map.getTileAt(gateX, gateY).collides
      && !world.stateManager.getLearnedChallengeIds().includes(challengeId)
      && troll.player.texture.key === player.avatar && troll.player.x < 400
      && troll.children.list.some((object) => object.text === player.name),
    'Troll game did not preserve the active player or keep the bridge and question unfinished.');
    return troll;
  };
  const overlap = (troll, group, callback) => {
    const object = group.getChildren()[0];
    object.body.reset(troll.player.x, troll.player.y);
    troll.physics.overlap(troll.player, object, callback, undefined, troll);
  };
  try {
    sounds.play = (name) => heard.push(name);
    const first = world.player.id;
    world.stateManager.recordAccessory(first);
    let troll = await start('bridge-troll', 'math-addition', 31, 32);
    assert(heard.includes('trollMusicLow'), 'Troll music did not start.');
    await waitUntil(() => troll.rocks.getLength() > 0, 'Troll did not throw rocks automatically.');
    assert(Math.abs(troll.rocks.getChildren()[0].body.velocity.length() - 240 * troll.difficulty) < 0.001,
      'Rock speed did not use the difficulty.');
    assert(heard.includes('trollMusicHigh') && heard.includes('trollThrow'),
      'Troll music or automatic throwing did not continue.');
    troll.rocks.clear(true, true);
    troll.movement.keys.D.isDown = true;
    troll.update();
    assert(troll.player.body.velocity.x > 0, 'WASD did not move the troll-game player.');
    troll.movement.keys.D.isDown = false;
    troll.player.setPosition(500, 60);
    troll.update();
    assert(troll.player.x <= 380 && troll.player.y >= 135, 'Player left the permitted side of the arena.');
    troll.player.body.reset(190, 350);
    troll.throwRock();
    const rock = troll.rocks.getChildren()[0];
    assert(rock.body.velocity.x < 0 && heard.includes('trollThrow'), 'Troll did not throw a rock toward the player.');
    overlap(troll, troll.rocks, troll.hitPlayer);
    assert(troll.hits === 1 && heard.includes('trollRockHit'), 'Rock overlap did not count a hit.');
    troll.throwRock();
    overlap(troll, troll.rocks, troll.hitPlayer);
    assert(troll.hits === 1, 'Invulnerability did not prevent rapid repeated hits.');
    for (let hits = 2; hits <= 3; hits += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
      assert(troll.hits === hits, `Rock hit ${hits} was not counted.`);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after troll loss.');
    assert(world.player.id !== first && world.worldMap.getTileAt(31, 32).collides
      && !world.stateManager.getLearnedChallengeIds().includes('math-addition')
      && world.stateManager.turnPoints.get(first) === 1 && heard.includes('trollLose'),
    'Losing did not switch players or left incorrect bridge, question, points, or sound state.');
    world.dialogueWindow.close();
    heard.length = 0;
    troll = await start('bridge-troll', 'math-addition', 31, 32);
    troll.time.removeAllEvents();
    const winner = world.player.id;
    for (let count = troll.applesCollected + 1; count <= 7; count += 1) {
      overlap(troll, troll.apples, troll.collectApple);
      assert(troll.applesCollected === count, `Apple ${count} was not collected by overlap.`);
      if (count < 7) {
        assert(!troll.finished && troll.apples.getLength() === 1, 'Apple game ended too early or stopped spawning apples.');
      }
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after troll win.');
    assert(!world.worldMap.getTileAt(31, 32).collides && world.worldMap.getTileAt(93, 64).collides
      && world.stateManager.getLearnedChallengeIds().includes('math-addition')
      && world.stateManager.turnPoints.get(winner) === 2
      && heard.filter((name) => name === 'trollApple').length === 7 && heard.includes('trollWin'),
    'Winning did not open only the bridge, credit the question and play sounds.');
    world.dialogueWindow.close();
    const before = heard.filter((name) => name.startsWith('trollMusic')).length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert(heard.filter((name) => name.startsWith('trollMusic')).length === before,
      'Troll music continued after leaving the game.');

    troll = await start('river-troll', 'river-troll-berries', 93, 64);
    troll.time.removeAllEvents();
    const secondPlayer = world.player.id;
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after second troll loss.');
    assert(world.worldMap.getTileAt(93, 64).collides && world.player.id !== secondPlayer
      && !world.stateManager.getLearnedChallengeIds().includes('river-troll-berries')
      && world.stateManager.turnPoints.get(secondPlayer) === 2,
    'Second troll loss changed the bridge, question, or unfinished points.');
    world.dialogueWindow.close();
    world.swapLeader();
    troll = await start('river-troll', 'river-troll-berries', 93, 64);
    troll.time.removeAllEvents();
    for (let count = troll.applesCollected; count < 7; count += 1) {
      overlap(troll, troll.apples, troll.collectApple);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after second troll.');
    assert(!world.worldMap.getTileAt(93, 64).collides
      && world.stateManager.getLearnedChallengeIds().includes('river-troll-berries')
      && world.player.id === first,
    'Second troll win did not open the bridge or apply the question turn count.');
    world.dialogueWindow.close();
    troll = await start('west-troll', 'west-troll-apples', 23, 52);
    troll.time.removeAllEvents();
    const westPlayer = world.player.id;
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after western troll loss.');
    assert(world.player.id !== westPlayer && world.westMap.getTileAt(23, 52).collides
      && !world.stateManager.getLearnedChallengeIds().includes('west-troll-apples'),
    'Losing the western troll game changed the bridge or question.');
    world.dialogueWindow.close();
    troll = await start('west-troll', 'west-troll-apples', 23, 52);
    troll.time.removeAllEvents();
    while (troll.applesCollected < 7) {
      overlap(troll, troll.apples, troll.collectApple);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after western troll win.');
    assert(!world.westMap.getTileAt(23, 52).collides && world.westMap.getTileAt(16, 27).collides
      && world.stateManager.getLearnedChallengeIds().includes('west-troll-apples'),
    'Winning the western troll game did not open only its bridge and credit the question.');
    world.dialogueWindow.close();
    troll = await start('north-troll', 'north-troll-stones', 91, 20);
    troll.time.removeAllEvents();
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after northern troll loss.');
    assert(world.northMap.getTileAt(91, 20).collides
      && !world.stateManager.getLearnedChallengeIds().includes('north-troll-stones'),
    'Losing the northern troll game opened the forest or credited the question.');
    world.dialogueWindow.close();
    troll = await start('north-troll', 'north-troll-stones', 91, 20);
    troll.time.removeAllEvents();
    while (troll.applesCollected < 7) overlap(troll, troll.apples, troll.collectApple);
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after northern troll win.');
    assert(!world.northMap.getTileAt(91, 20).collides
      && world.stateManager.getLearnedChallengeIds().includes('north-troll-stones')
      && world.dialogueWindow.message.text.includes('mørkeskoven')
      && !world.dialogueWindow.message.text.includes('broen'),
    'Winning the northern troll game did not open the forest.');
    world.dialogueWindow.close();
  } finally {
    sounds.play = originalPlay;
  }
}

async function clickCanvas(game, x, y) {
  const canvas = game.canvas;
  const bounds = canvas.getBoundingClientRect();
  const options = {
    bubbles: true,
    clientX: bounds.left + bounds.width * x / game.config.width,
    clientY: bounds.top + bounds.height * y / game.config.height,
    button: 0,
  };
  for (const type of ['mousemove', 'mousedown', 'mouseup']) {
    canvas.dispatchEvent(new MouseEvent(type, { ...options, buttons: type === 'mouseup' ? 0 : 1 }));
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
}

async function testPanelPointerInput(stable, unicorn) {
  const panel = stable.detailPanel;
  const camera = stable.cameras.main;
  camera.stopFollow();
  for (const scrollY of [0, camera.getBounds().height - camera.height]) {
    camera.setScroll(0, scrollY);
    panel.show(unicorn, stable.accessories);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(Math.abs(camera.scrollY - scrollY) < 1, `Camera did not reach scroll ${scrollY}.`);
    let behindClicks = 0;
    const behind = stable.add.rectangle(40, scrollY + 300, 60, 60)
      .setInteractive().on('pointerdown', () => { behindClicks += 1; });
    await clickCanvas(stable.game, 40, 300);
    assert(behindClicks === 0 && panel.isOpen, `Overlay did not block input at scroll ${scrollY}.`);
    behind.destroy();

    const slots = ['sticker', 'saddle', 'wings', 'crown'];
    for (const [categoryIndex, slot] of slots.entries()) {
      await clickCanvas(stable.game, panel.categoryButtons[categoryIndex].x, panel.categoryButtons[categoryIndex].y);
      assert(panel.category === slot && panel.page === 0, `Category ${slot} did not open at scroll ${scrollY}.`);
      const accessories = stable.accessories.filter((item) => item.slot === slot);
      for (let index = 0; index < 3; index += 1) {
        assert(panel.buttons[index].text.includes(accessories[index].name),
          `Category ${slot} displayed the wrong accessory.`);
        await clickCanvas(stable.game, panel.buttons[index].x, panel.buttons[index].y);
        assert(panel.collection.getAccessoryOwner(accessories[index].id) === unicorn.id,
          `Accessory button ${index} selected the wrong ${slot} at scroll ${scrollY}.`);
        await clickCanvas(stable.game, panel.buttons[index].x, panel.buttons[index].y);
        assert(!panel.collection.getAccessoryOwner(accessories[index].id),
          `Accessory button ${index} did not remove its ${slot} at scroll ${scrollY}.`);
      }
    }
    await clickCanvas(stable.game, panel.next.x, panel.next.y);
    assert(panel.page === 1, `Next page did not respond at scroll ${scrollY}.`);
    const secondPageHat = stable.accessories.filter((item) => item.slot === 'crown')[3];
    assert(panel.buttons[0].text.includes(secondPageHat.name), 'Second page displayed the wrong hat.');
    await clickCanvas(stable.game, panel.buttons[0].x, panel.buttons[0].y);
    assert(panel.collection.getAccessoryOwner(secondPageHat.id) === unicorn.id, 'Second-page hat was not equipped.');
    await clickCanvas(stable.game, panel.buttons[0].x, panel.buttons[0].y);
    assert(!panel.collection.getAccessoryOwner(secondPageHat.id), 'Second-page hat was not removed.');
    await clickCanvas(stable.game, panel.categoryButtons[0].x, panel.categoryButtons[0].y);
    assert(panel.category === 'sticker' && panel.page === 0 && !panel.previous.visible,
      'Changing category did not reset pagination.');
    await clickCanvas(stable.game, panel.next.x, panel.next.y);
    await clickCanvas(stable.game, panel.previous.x, panel.previous.y);
    assert(panel.page === 0, `Previous page did not respond at scroll ${scrollY}.`);
    await clickCanvas(stable.game, panel.closeButton.x, panel.closeButton.y);
    assert(!panel.isOpen, `Close did not respond at scroll ${scrollY}.`);
    panel.show(unicorn, stable.accessories);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await clickCanvas(stable.game, panel.closeButton.x, panel.closeButton.y);
    assert(!panel.isOpen, `Reopened panel did not close at scroll ${scrollY}.`);
  }
}

async function run() {
  await testSoundSynthesis();
  await testRandomLayouts();
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = new CollectionStore(storage);
  const invalidStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":["same","same"]}',
  });
  let invalidRejected = false;
  try {
    invalidStore.load();
  } catch (error) {
    invalidRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidRejected, 'Invalid saved data was accepted.');
  const legacyStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":["unicorn-solstraale"]}',
  });
  assert(legacyStore.loadState().collectedIds.has('unicorn-solstraale')
    && legacyStore.loadState().equipment.size === 0 && legacyStore.loadState().layoutSeed === null,
  'Legacy collection was not migrated.');
  let legacyRaw = '{"version":1,"collectedIds":["unicorn-solstraale","accessory-crown"],'
    + '"equipment":[["accessory-crown","unicorn-solstraale"]]}';
  const writableLegacyStore = new CollectionStore({
    getItem: () => legacyRaw,
    setItem: (key, value) => { legacyRaw = value; },
  });
  const legacyState = writableLegacyStore.loadState();
  legacyState.collectedIds.add('accessory-heart');
  writableLegacyStore.save(legacyState.collectedIds, legacyState.equipment);
  assert(writableLegacyStore.loadState().layoutSeed === null
    && writableLegacyStore.loadState().collectedIds.has('accessory-heart')
    && writableLegacyStore.loadState().equipment.get('accessory-crown') === 'unicorn-solstraale',
  'Saving a legacy collection changed its layout or lost progress.');
  const invalidSeedStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"layoutSeed":-1}',
  });
  let invalidSeedRejected = false;
  try {
    invalidSeedStore.loadState();
  } catch (error) {
    invalidSeedRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidSeedRejected, 'Invalid layout seed was accepted.');
  const invalidGateStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"unlockedGates":["unknown"]}',
  });
  let invalidGateRejected = false;
  try {
    invalidGateStore.loadState();
  } catch (error) {
    invalidGateRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidGateRejected, 'Invalid saved gate was accepted.');
  const invalidRewardStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"unlockedRewards":["unknown"]}',
  });
  let invalidRewardRejected = false;
  try {
    invalidRewardStore.loadState();
  } catch (error) {
    invalidRewardRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidRewardRejected, 'Invalid saved reward was accepted.');
  const failingStore = new CollectionStore({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  });
  const failingWriteStore = new CollectionStore({
    getItem: storage.getItem,
    setItem: () => { throw new Error('blocked'); },
  });
  for (const action of [() => failingStore.load(), () => failingStore.save(new Set())]) {
    let failed = false;
    try {
      action();
    } catch (error) {
      failed = error.message.includes('browserens lager');
    }
    assert(failed, 'Storage failure was not reported.');
  }
  const game = new Phaser.Game(createGameConfig());
  game.registry.set('collectionStore', store);
  let scene = await waitForWorld(game);
  testSpeedBoostRules();
  testGuideGnomes(scene);
  await testWorldBoost(scene);
  const firstSeed = store.loadState().layoutSeed;
  const firstLayout = JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y]));
  assert(Number.isInteger(firstSeed), 'A fresh game did not persist its layout seed.');
  assertAccessoryCounters(scene);
  assertUnicornCounters(scene);
  testUnicornCounters(scene);
  testHudLayout(scene);
  assert(scene.cameras.main.zoom === 0.65 && scene.movement.speed === 242,
    'World zoom or movement speed is incorrect.');
  scene.movement.keys.D.isDown = true;
  scene.movement.update();
  assert(scene.player.sprite.body.velocity.x === 242 && scene.player.sprite.body.velocity.y === 0,
    'Straight movement velocity is incorrect.');
  scene.movement.keys.S.isDown = true;
  scene.movement.update();
  assert(Math.abs(scene.player.sprite.body.velocity.length() - 242) < 0.01,
    'Diagonal movement does not preserve speed.');
  scene.movement.keys.D.isDown = false;
  scene.movement.keys.S.isDown = false;
  scene.movement.update();
  const hudBounds = scene.hud.element.getBoundingClientRect();
  const canvasBounds = game.canvas.getBoundingClientRect();
  assert(hudBounds.bottom <= canvasBounds.top && !game.canvas.parentElement.contains(scene.hud.element),
    'Permanent HUD overlaps the map.');
  const firstLeader = scene.leaderFollowerSystem.leader.id;
  scene.hud.swapButton.click();
  assert(scene.leaderFollowerSystem.leader.id !== firstLeader, 'HUD turn button did not switch players.');
  scene.hud.swapButton.click();
  assert(scene.leaderFollowerSystem.leader.id === firstLeader, 'HUD turn button did not switch back.');
  let leakedKey = false;
  const detectKey = () => { leakedKey = true; };
  window.addEventListener('keydown', detectKey);
  scene.hud.swapButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  window.removeEventListener('keydown', detectKey);
  assert(!leakedKey, 'Activating a focused HUD button can also trigger a game interaction.');
  testWeightedTurnCounts();
  testChallenges(scene);
  testFairyQuestionSelection(scene);
  testInteractionSounds(scene);
  testMovementAndProximitySounds(scene);
  scene.dialogueWindow.showLines('Prøve', ['Første linje', 'Anden linje']);
  await new Promise((resolve) => scene.events.once('postupdate', resolve));
  game.scale.updateBounds();
  await clickCanvas(game, 710, 540);
  assert(scene.dialogueWindow.message.text === 'Anden linje', 'Dialogue button missed after changing zoom.');
  await clickCanvas(game, 710, 540);
  assert(!scene.dialogueWindow.isOpen, 'Dialogue button did not close after changing zoom.');
  await testBeginnerReadingScene(scene);
  testMap(scene);
  testOldQueen(scene);
  await testVolcanoCat(scene);
  await testWarriorPrincess(scene);
  await testDragonBattle(scene);
  await testLavaBootPickups(scene);
  await testVolcano(scene);
  testNorthFollowerAndMusic(scene);
  await testWorldMusicPause(scene);
  await testSouthWizard(scene);
  await testLakeBoat(scene);
  await testNorthCave(scene);
  await testWitchEncounter(scene);
  await testWestCrack(scene);
  await testFlight(scene);
  await testWestPhysicalCollision(scene);
  testGateInteractions(scene);
  await testOpenWestGates(scene);
  const firstPickup = scene.collectibleManager.pickups.getChildren()[0];
  scene.collectibleManager.store = failingWriteStore;
  let writeFailed = false;
  try {
    scene.collectibleManager.collect(firstPickup);
  } catch (error) {
    writeFailed = error.message.includes('browserens lager');
  }
  assert(writeFailed && firstPickup.active && scene.collectibleManager.collectedIds.size === 0,
    'A failed save changed the collection or destroyed the pickup.');
  scene.collectibleManager.store = store;
  testCollection(scene, 'unicorn', 'accessory');
  const flashlightPickup = scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'flashlight');
  scene.collectPickup(flashlightPickup);
  const bootsPickup = scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'lava-boots-1');
  scene.collectWorldItem(scene.player.sprite, bootsPickup);
  assert(scene.hud.toolCounters.get('lava-boots').textContent.includes('1 / 2')
    && new CollectionStore(storage).load().size === 8, 'Tool pickup was not counted or saved.');

  let previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(store.loadState().layoutSeed === firstSeed
    && JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y])) === firstLayout,
  'Collection or reload changed the layout.');
  assertAccessoryCounters(scene);
  assert(scene.collectibleManager.getCollectedItems('unicorn').length === 3, 'Unicorns were not restored.');
  assert(scene.collectibleManager.getCollectedItems('accessory').length === 3, 'Accessories were not restored.');
  assert(scene.collectibleManager.pickups.getChildren().length === 70
    && scene.collectibleManager.collectedIds.has('flashlight') && scene.hud.toolProgress.textContent.includes('1 / 1')
    && scene.collectibleManager.collectedIds.has('lava-boots-1')
    && scene.hud.toolCounters.get('lava-boots').textContent.includes('1 / 2'),
  'Tools or other pickups were not restored correctly after reload.');
  scene.collectibleManager.collectedIds.delete('flashlight');
  scene.collectibleManager.collectedIds.delete('lava-boots-1');
  store.save(scene.collectibleManager.collectedIds, scene.collectibleManager.equipment);
  scene.collectibleManager.createPickup(scene.collectibleManager.items.get('flashlight'));
  scene.collectibleManager.createPickup(scene.collectibleManager.items.get('lava-boots-1'));
  scene.updateCollectionProgress();
  assert(scene.sys.isActive(), 'A saved collection interrupted the adventure.');
  assert(scene.collectibleManager.getCollectedItems('unicorn').every((unicorn) => unicorn.color), 'Unicorn colors were not restored.');
  assert(scene.worldMap.getTileAt(64, 16).collides, 'Flora gate did not reset.');
  assert(scene.worldMap.getTileAt(68, 52).collides, 'Luna gate did not reset.');
  assert(scene.worldMap.getTileAt(31, 32).collides, 'Bridge did not reset.');
  assert(scene.worldMap.getTileAt(93, 64).collides, 'Second bridge did not reset.');
  assert(scene.westMap.getTileAt(23, 52).collides && scene.westMap.getTileAt(16, 27).collides,
    'Western gates did not reset.');

  scene.enterStable();
  let stable = await waitForStable(game, 3);
  assert(stable.sys.isActive() && stable.unicorns.length === 3, 'Stable did not show saved unicorns.');
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const originalPosition = { x: stable.followers.leader.sprite.x, y: stable.followers.leader.sprite.y };
  stable.followers.leader.sprite.setPosition(stable.unicorns[0].sprite.x, stable.unicorns[0].sprite.y);
  stable.interact({ repeat: false });
  assert(stable.detailPanel.isOpen && heard.join(',') === 'unicorn',
    'Stable unicorn interaction did not play a gallop.');
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(originalPosition.x, originalPosition.y);
  sounds.play = originalPlay;
  assert(stable.movement.speed === 242 && scene.hud.label.textContent === 'ENHJØRNINGESTALDEN'
    && scene.hud.resetButton.disabled && scene.hud.swapButton.disabled,
  'Stable movement or HUD state is incorrect.');
  stable.swapLeader();
  assert(scene.hud.turn.textContent === `${stable.followers.leader.name} har turen`,
    'HUD did not update when switching players in the stable.');
  stable.swapLeader();
  stable.detailPanel.show(stable.unicorns[1], stable.accessories);
  assert(stable.detailPanel.unicorn.texture.key === stable.unicorns[1].texture, 'Portrait color differs from unicorn.');
  assert(stable.detailPanel.color.text.includes(stable.unicorns[1].color), 'Portrait color label is incorrect.');
  stable.detailPanel.selectCategory('wings');
  assert(stable.detailPanel.inventory.text.includes('ikke samlet vinger')
    && stable.detailPanel.buttons.every((button) => !button.visible)
    && !stable.detailPanel.next.visible && !stable.detailPanel.previous.visible,
  'Empty category did not display its message or hide choices.');
  for (const slot of ['crown', 'saddle', 'sticker']) {
    stable.detailPanel.selectCategory(slot);
    stable.detailPanel.toggle(0);
  }
  assert(stable.detailPanel.accessoryLayer.length === 3, 'Equipped accessories are not rendered.');
  assert(stable.unicorns[1].accessoryLayer.length === 3
    && stable.unicorns[0].accessoryLayer.length === 0,
  'Equipped accessories did not appear on the correct stable unicorn.');
  for (const portraitItem of stable.detailPanel.accessoryLayer.list) {
    const stableItem = stable.unicorns[1].accessoryLayer.list
      .find((item) => item.texture.key === portraitItem.texture.key);
    assert(stableItem && stableItem.x === portraitItem.x && stableItem.y === portraitItem.y
      && stableItem.scaleX === portraitItem.scaleX,
    'Stable accessory placement differs from the portrait.');
  }
  assert(stable.unicorns[1].accessoryLayer.scaleX === stable.unicorns[1].sprite.scaleX / 2.1,
    'Stable accessories do not scale with the unicorn.');
  const crown = stable.accessories.find((item) => item.slot === 'crown');
  const originalOwner = stable.unicorns[1].id;
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === originalOwner, 'Crown was not equipped.');
  assert(stable.detailPanel.accessoryLayer.list.some((image) => (
    image.texture.key === 'accessory-star-sticker' && image.x < 0
  )), 'Star sticker is not positioned on the rear.');
  stable.detailPanel.show(stable.unicorns[0], stable.accessories);
  stable.detailPanel.selectCategory('crown');
  const crownIndex = stable.accessories.filter((item) => item.slot === 'crown')
    .findIndex((item) => item.id === crown.id);
  assert(stable.detailPanel.buttons[crownIndex].text.includes('Flyt fra'), 'Transfer is not explained.');
  heard.length = 0;
  sounds.play = (name) => heard.push(name);
  stable.detailPanel.toggle(crownIndex);
  assert(heard.join(',') === 'accessoryAttach', 'Transferring an accessory did not play the attachment sound.');
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === stable.unicorns[0].id, 'Crown did not transfer.');
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture)
    && !stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
  'Crown transfer did not update both stable unicorns.');
  assert(store.loadState().equipment.get(crown.id) === stable.unicorns[0].id, 'Crown assignment was not saved.');
  stable.detailPanel.toggle(crownIndex);
  assert(heard.length === 1, 'Removing an accessory played an attachment sound.');
  assert(!scene.collectibleManager.getAccessoryOwner(crown.id), 'Crown was not removed.');
  assert(!stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
    'Removed crown remained visible in the stable.');
  stable.detailPanel.toggle(crownIndex);
  assert(heard.join(',') === 'accessoryAttach,accessoryAttach', 'Attaching an accessory did not play a sound.');
  scene.collectibleManager.store = failingStore;
  stable.detailPanel.toggle(crownIndex);
  assert(heard.length === 2, 'A failed equipment save played an attachment sound.');
  sounds.play = originalPlay;
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === stable.unicorns[0].id
    && stable.detailPanel.status.text.includes('browserens lager'), 'Save failure did not preserve equipment or notify.');
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
    'Failed save changed the stable appearance.');
  scene.collectibleManager.store = store;
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(scene.sys.isActive(), 'Leaving the stable did not resume the world.');
  assert(scene.hud.label.textContent === 'EVENTYR' && !scene.hud.resetButton.disabled
    && !scene.hud.swapButton.disabled, 'World HUD did not resume after leaving the stable.');

  const savedUnicorns = scene.collectibleManager.getCollectedItems('unicorn');
  const many = Array.from({ length: 25 }, (_, index) => ({
    ...savedUnicorns[index % savedUnicorns.length], id: `test-${index}`,
  }));
  scene.scene.launch('StableScene', {
    players: scene.leaderFollowerSystem.players.map((p) => ({
      id: p.id, name: p.name, age: p.age, avatar: p.avatar, hairColor: p.hairColor,
    })),
    unicorns: many,
    accessories: [],
    collection: scene.collectibleManager,
  });
  scene.scene.pause();
  stable = await waitForStable(game, 25);
  assert(stable.unicorns.length === 25, 'Stable dropped unicorns in a larger collection.');
  assert(stable.unicorns[24].sprite.y < stable.physics.world.bounds.height, 'Stable did not grow for more unicorns.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));

  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === savedUnicorns[0].id, 'Equipment was not restored.');
  assert(scene.collectibleManager.getAccessoryOwner('accessory-saddle') === savedUnicorns[1].id
    && scene.collectibleManager.getAccessoryOwner('accessory-star-sticker') === savedUnicorns[1].id,
  'Other accessories were not restored with their unicorn.');
  scene.enterStable();
  stable = await waitForStable(game, 3);
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture)
    && stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === 'saddle-worn-pink')
    && stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === 'accessory-star-sticker'),
  'Saved equipment was not visible after reopening the stable.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));

  store.save(new Set(), new Map());
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  testCollection(scene, 'accessory', 'unicorn');
  collect(scene, 'unicorn', 12);
  collect(scene, 'accessory', 57);
  assert(scene.sys.isActive() && scene.collectibleManager.getCollectedCount('unicorn') === 15
    && scene.collectibleManager.getCollectedCount('accessory') === 60,
  'Additional collectibles were not obtainable.');
  const grass = scene.collectibleManager.getCollectedItems('unicorn').find((item) => item.name === 'Græs');
  assert(grass?.color === 'Grøn' && grass.texture === 'unicorn-green', 'Græs has the wrong appearance.');
  scene.enterStable();
  stable = await waitForStable(game, 15);
  assert(stable.unicorns.length === 15 && stable.accessories.length === 60, 'Stable does not show the full collection.');
  for (const unicorn of stable.unicorns) {
    const nameplate = stable.children.list.find((child) => (
      typeof child.text === 'string' && child.x === unicorn.sprite.x && child.y === unicorn.sprite.y - 70
    ));
    assert(nameplate?.text === unicorn.name, `${unicorn.name}'s stable nameplate should show only its name.`);
  }
  stable.detailPanel.show(stable.unicorns.find((unicorn) => unicorn.id === grass.id), stable.accessories);
  for (let index = 0; index < stable.accessories.length; index += 1) {
    const accessory = stable.accessories[index];
    stable.detailPanel.selectCategory(accessory.slot);
    const categoryIndex = stable.accessories.filter((item) => item.slot === accessory.slot)
      .findIndex((item) => item.id === accessory.id);
    stable.detailPanel.page = Math.floor(categoryIndex / 3);
    stable.detailPanel.render();
    stable.detailPanel.toggle(categoryIndex % 3);
    const expectedTexture = accessory.wornTexture
      ?? (accessory.slot === 'saddle' ? 'saddle-worn-pink' : accessory.texture);
    assert(stable.detailPanel.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} uses the wrong worn image.`);
    const stableUnicorn = stable.unicorns.find((unicorn) => unicorn.id === grass.id);
    assert(stableUnicorn.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} is not visible on the stable unicorn.`);
    if (['accessory-alvina-hat', 'accessory-ellie-hat'].includes(accessory.id)) {
      assert(stable.detailPanel.accessoryLayer.list.some((image) => (
        image.texture.key === expectedTexture && image.scaleX === 0.9
      )), `${accessory.name} is not rendered as a large hat.`);
    }
    assert(scene.collectibleManager.getAccessoryOwner(accessory.id) === grass.id,
      `${accessory.name} was not equipped.`);
    stable.detailPanel.toggle(categoryIndex % 3);
    assert(!stableUnicorn.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} remained visible after removal.`);
  }
  assert(stable.detailPanel.page === 4 && !stable.detailPanel.next.visible && stable.detailPanel.previous.visible,
    'Accessory pagination does not reach the last page.');
  scene.collectibleManager.toggleAccessory(grass.id, 'accessory-saddle-blue');
  scene.collectibleManager.toggleAccessory(grass.id, 'accessory-saddle-green');
  assert(!scene.collectibleManager.getAccessoryOwner('accessory-saddle-blue')
    && scene.collectibleManager.getAccessoryOwner('accessory-saddle-green') === grass.id,
  'Equipping a different saddle did not replace the previous saddle.');
  scene.collectibleManager.toggleAccessory(savedUnicorns[0].id, 'accessory-saddle-green');
  assert(scene.collectibleManager.getAccessoryOwner('accessory-saddle-green') === savedUnicorns[0].id
    && store.loadState().equipment.get('accessory-saddle-green') === savedUnicorns[0].id,
  'Moving a new accessory between unicorns was not saved.');
  await testPanelPointerInput(stable, stable.unicorns.find((unicorn) => unicorn.id === grass.id));
  const slots = ['crown', 'saddle', 'sticker', 'wings'];
  for (const [unicornIndex, unicorn] of stable.unicorns.entries()) {
    stable.detailPanel.show(unicorn, stable.accessories);
    for (const slot of slots) {
      const accessory = stable.accessories.filter((item) => item.slot === slot)[unicornIndex];
      const index = stable.accessories.filter((item) => item.slot === slot).findIndex((item) => item.id === accessory.id);
      stable.detailPanel.selectCategory(slot);
      stable.detailPanel.page = Math.floor(index / 3);
      stable.detailPanel.render();
      if (scene.collectibleManager.getAccessoryOwner(accessory.id) !== unicorn.id) {
        stable.detailPanel.toggle(index % 3);
      }
      assert(scene.collectibleManager.getAccessoryOwner(accessory.id) === unicorn.id,
        `${unicorn.name} did not receive ${accessory.name}.`);
    }
    assert(unicorn.accessoryLayer.length === 4 && stable.detailPanel.accessoryLayer.length === 4
      && (unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-wings-')
        || (unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-dark-')
          || unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-volcano-'))
          && unicorn.accessoryLayer.list[0].texture.key.endsWith('-wings')),
    `${unicorn.name} cannot wear all four slots or wings are above other accessories.`);
  }
  const firstWing = stable.accessories.find((item) => item.slot === 'wings');
  const secondWing = stable.accessories.filter((item) => item.slot === 'wings')[1];
  const wingIndex = stable.accessories.filter((item) => item.slot === 'wings').findIndex((item) => item.id === firstWing.id);
  stable.detailPanel.show(stable.unicorns[1], stable.accessories);
  stable.detailPanel.selectCategory('wings');
  stable.detailPanel.page = Math.floor(wingIndex / 3);
  stable.detailPanel.render();
  stable.detailPanel.toggle(wingIndex % 3);
  assert(scene.collectibleManager.getAccessoryOwner(firstWing.id) === stable.unicorns[1].id
    && !scene.collectibleManager.getAccessoryOwner(secondWing.id)
    && !stable.unicorns[0].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && stable.unicorns[1].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && store.loadState().equipment.get(firstWing.id) === stable.unicorns[1].id,
  'Transferring wings did not replace, update, and save both unicorns.');
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(scene.sys.isActive(), 'Leaving the stable after pointer interactions did not resume the world.');
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.collectibleManager.getCollectedCount('unicorn') === 15
    && scene.collectibleManager.getCollectedCount('accessory') === 60
    && Array.from(scene.hud.unicornCounters.values()).every((counter) => {
      const [count, total] = counter.textContent.split(': ')[1].split(' / ');
      return count === total;
    })
    && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('15 / 15'))
    && !scene.ui.list.some((object) => object.text === 'Fortsæt eventyret'),
  'Reloading a full collection interrupted play or lost progress.');
  assertAccessoryCounters(scene);
  scene.enterStable();
  stable = await waitForStable(game, 15);
  assert(stable.accessories.length === 60, 'Stable is inaccessible after reloading the full collection.');
  assert(stable.unicorns[1].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && stable.unicorns[1].accessoryLayer.length === 4
    && !stable.unicorns[0].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture),
  'Transferred wings or other equipment did not survive reloading.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  scene.collectPickup(scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'flashlight'));
  for (const id of ['lava-boots-1', 'lava-boots-2']) {
    scene.collectPickup(scene.collectibleManager.pickups.getChildren().find((pickup) => pickup.getData('collectibleId') === id));
  }
  assert(scene.hud.toolProgress.textContent.includes('1 / 1')
    && scene.hud.toolCounters.get('lava-boots').textContent.includes('2 / 2'), 'Tools were not present before reset.');
  scene.openGate('flora');
  assert(scene.unlockSouthPass(), 'Could not save an unlocked southern gate.');
  scene.collectibleManager.unlockReward('princess-bows');
  scene.collectPickup(scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-1'));
  const rescueState = store.loadState();
  rescueState.unlockedGates.add('dragon');
  store.save(rescueState.collectedIds, rescueState.equipment, rescueState.layoutSeed,
    rescueState.unlockedGates, rescueState.unlockedRewards);
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.southOpen && !scene.southWizard.visible && !scene.southMap.getTileAt(64, 0).collides
    && store.loadState().unlockedGates.has('south') && store.loadState().equipment.size > 0
    && scene.dragonRescued && store.loadState().unlockedGates.has('dragon')
    && scene.dragonDen.texture.key === 'dragon-den-empty'
    && scene.children.list.some((child) => child.texture?.key === 'prince')
    && scene.npcManager.npcs.find((npc) => npc.id === 'old-queen').repeatDialogue.includes('hjemme igen')
    && store.loadState().unlockedRewards.has('princess-bows')
    && scene.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 1 / 2'
    && scene.collectibleManager.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-2')
    && !scene.collectibleManager.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-1'),
  'Southern passage did not survive reloading with the collection.');
  scene.interactWithDragonDen();
  assert(scene.dialogueWindow.message.text.includes('prinsen er fri')
    && scene.dialogueWindow.message.text.includes('prinsessen'), 'Reloaded empty den did not celebrate the ending.');
  scene.dialogueWindow.close();
  const rescuedQueen = scene.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  scene.npcManager.runInteraction(rescuedQueen);
  assert(scene.dialogueWindow.message.text.includes('hjemme igen'), 'Reloaded queen did not celebrate the rescue.');
  scene.dialogueWindow.close();
  const rescuedPrincess = scene.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  scene.npcManager.runInteraction(rescuedPrincess);
  assert(scene.dialogueWindow.message.text.includes('reddede prinsen'), 'Reloaded princess did not remember the rescue.');
  scene.dialogueWindow.close();
  scene.openGate('flora');
  const resetButton = scene.hud.resetButton;
  const originalConfirm = window.confirm;
  let confirmations = 0;
  try {
    window.confirm = () => { confirmations += 1; return false; };
    resetButton.click();
    assert(confirmations === 1 && scene.collectibleManager.collectedIds.size === 79
      && store.loadState().equipment.size > 0 && store.loadState().layoutSeed === firstSeed
      && store.loadState().unlockedGates.has('south')
      && !scene.worldMap.getTileAt(64, 16).collides,
    'Canceling reset changed progress or the reset button did not respond.');

    window.confirm = () => { confirmations += 1; return true; };
    scene.collectibleManager.store = failingWriteStore;
    resetButton.click();
    assert(confirmations === 2 && scene.dialogueWindow.isOpen
      && scene.dialogueWindow.message.text.includes('ikke nulstillet')
      && scene.collectibleManager.collectedIds.size === 79
      && store.loadState().equipment.size > 0 && store.loadState().layoutSeed === firstSeed
      && store.loadState().unlockedGates.has('south')
      && !scene.worldMap.getTileAt(64, 16).collides,
    'A failed reset did not preserve progress and report the error.');
    scene.dialogueWindow.close();
    scene.collectibleManager.store = store;
    previousManager = scene.collectibleManager;
    resetButton.click();
    scene = await waitForWorld(game, previousManager);
    const resetSeed = store.loadState().layoutSeed;
    const resetLayout = JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y]));
    assert(confirmations === 3 && store.loadState().collectedIds.size === 0
      && resetSeed !== firstSeed && resetLayout !== firstLayout
      && store.loadState().equipment.size === 0 && scene.collectibleManager.collectedIds.size === 0
      && store.loadState().unlockedGates.size === 0 && !scene.southOpen
      && store.loadState().unlockedRewards.size === 0
      && !scene.dragonRescued && scene.dragonDen.texture.key === 'dragon-den'
      && !scene.children.list.some((child) => child.texture?.key === 'prince')
      && scene.npcManager.npcs.find((npc) => npc.id === 'old-queen').interactions.length > 0
      && scene.southWizard.visible && scene.southMap.getTileAt(64, 0).collides
      && scene.collectibleManager.pickups.getChildren().length === 78
      && scene.worldMap.getTileAt(64, 16).collides
      && Array.from(scene.hud.unicornCounters.values()).every((counter) => counter.textContent.includes(': 0 / '))
      && scene.hud.toolProgress.textContent.includes('0 / 1')
      && scene.hud.toolCounters.get('lava-boots').textContent.includes('0 / 2')
      && scene.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 0 / 2'
      && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('0 / 15'))
      && document.querySelectorAll('.game-hud').length === 1,
    'Reset did not clear the saved collection and restart the world.');
    assertAccessoryCounters(scene);
    scene.enterStable();
    stable = await waitForStable(game, 0);
    assert(stable.accessories.length === 0, 'Stable was not emptied after reset.');
    stable.followers.leader.sprite.setPosition(400, 105);
    stable.interact({ repeat: false });
    await new Promise((resolve) => setTimeout(resolve, 150));
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    assert(scene.collectibleManager.collectedIds.size === 0
      && scene.collectibleManager.equipment.size === 0
      && store.loadState().layoutSeed === resetSeed
      && JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y])) === resetLayout
      && scene.collectibleManager.pickups.getChildren().length === 78,
    'Reset progress did not remain empty after reloading the world.');
    await testAutomaticTurns(scene, store, failingStore);
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    await testFairyShooter(scene);
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    await testTrollGame(scene);
  } finally {
    window.confirm = originalConfirm;
  }
  game.destroy(true);
}

run().then(() => {
  document.getElementById('result').textContent = 'All game rules tests passed.';
}).catch((error) => {
  document.getElementById('result').textContent = `Game rules tests failed: ${error.stack}`;
  console.error(error);
});
