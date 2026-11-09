import { createGameConfig } from '../../src/config.js';
import { TEST_WORLD_DATA, WORLD_GATES, WORLD_TILE, WEST_CRACK, WEST_REGION_DATA, WEST_REGION_WIDTH,
  NORTH_HOLE, NORTH_REGION_DATA, NORTH_REGION_HEIGHT, EAST_ORIGIN, EAST_REGION_DATA, EAST_REGION_WIDTH, LAKE,
  SOUTH_ORIGIN, SOUTH_PASS, SOUTH_REGION_DATA, DRAGON_DEN } from '../../src/data/testWorld.js';
import { CollectionStore } from '../../src/managers/CollectionStore.js';
import { GameStateManager } from '../../src/managers/GameStateManager.js';
import { SoundEffects } from '../../src/audio/SoundEffects.js';
import { arrangeCollectibles } from '../../src/data/collectibleLayout.js';
import { mazePath, MAZE_LAYOUTS } from '../../src/scenes/WitchMazeScene.js';
import { CatMazeScene } from '../../src/scenes/CatMazeScene.js';
import { minigameSpeed } from '../../src/systems/MinigameDifficulty.js';
import { NorthFollowerNavigator } from '../../src/systems/NorthFollowerNavigator.js';
import { wizardTeam } from '../../src/systems/WizardTeam.js';
import { UnicornSpeedBoost } from '../../src/systems/UnicornSpeedBoost.js';
import { guideLines } from '../../src/systems/GuideGnomes.js';

import { assert, reachable, canReach, reachableWest, canReachWest, reachableNorth, canReachNorth, reachableVolcano, canReachVolcano, waitForWorld, waitForStable, collect, assertUnicornCounters, assertAccessoryCounters, clickCanvas } from '../test-support.js';

export function testSpeedBoostRules() {
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

export function testGuideGnomes(world) {
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

export async function testWorldBoost(world) {
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

export async function testSoundSynthesis() {
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

export async function testRandomLayouts() {
  const files = ['unicorns.json', 'accessories.json', 'north-unicorns.json', 'north-accessories.json'];
  const groups = await Promise.all(files.map(async (file) => {
    const response = await fetch(new URL(`../../src/data/collectibles/${file}`, import.meta.url));
    assert(response.ok, `Could not load ${file}.`);
    const data = await response.json();
    return data.items.map((item) => ({ ...item, type: data.type }));
  }));
  const items = groups.flat();
  const volcanicGroups = await Promise.all(['volcano-unicorns.json', 'volcano-accessories.json'].map(async (file) => {
    const response = await fetch(new URL(`../../src/data/collectibles/${file}`, import.meta.url));
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
