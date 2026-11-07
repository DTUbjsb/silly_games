import { createGameConfig } from '../src/config.js';
import { TEST_WORLD_DATA, WORLD_GATES, WORLD_TILE, WEST_CRACK, WEST_REGION_DATA, WEST_REGION_WIDTH } from '../src/data/testWorld.js';
import { CollectionStore } from '../src/managers/CollectionStore.js';
import { GameStateManager } from '../src/managers/GameStateManager.js';
import { SoundEffects } from '../src/audio/SoundEffects.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testSoundSynthesis() {
  const names = [
    'troll', 'fairy', 'unicorn', 'wings', 'crown', 'star',
    'mosquitoHit', 'mosquitoEscape', 'mosquitoStart', 'mosquitoWin', 'mosquitoLose',
    'questionCorrect', 'footstep', 'accessoryAttach', 'npcNearby',
    'trollThrow', 'trollRockHit', 'trollApple', 'trollWin', 'trollLose', 'trollMusicLow', 'trollMusicHigh',
    'flightStart', 'flightFlap', 'flightBird', 'flightBirdHit', 'flightLava',
    'flightWin', 'flightLose', 'flightMusicLow', 'flightMusicMid', 'flightMusicHigh',
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
    assert(Object.values(items).filter((item) => item.slot === slot).length === 9,
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
  for (const item of Object.values(items).filter((item) => item.x >= 0)) {
    assert(canReach(allOpen, item), `${item.id} is unreachable with all gates open.`);
  }
  for (const npc of scene.npcManager.npcs.filter((npc) => npc.x >= 0)) {
    const access = ['luna', 'river-troll'].includes(npc.id) ? bridgeOpen : closed;
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
  assert(Object.values(items).filter((item) => item.x < 0 && item.type === 'unicorn').length === 3
    && Object.values(items).filter((item) => item.x < 0 && item.type === 'accessory').length === 12,
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
  for (const npc of scene.npcManager.npcs.filter((npc) => npc.x < 0)) {
    assert(canReachWest(westClosed, npc), `${npc.id} is unreachable before its own gate opens.`);
  }
  assert(Object.values(items).filter((item) => item.x < 0).every((item) => canReachWest(westAll, item)),
    'Some western items remain unreachable after opening the gates.');
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
        `Player did not reach or crossed the west wall at y=${y}.`);
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
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('FlightScene'), 'Wrong answer started the flight.');
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
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
    assert(bird.body.velocity.x > 0 && heard.includes('flightBird'), 'Bird did not fly against westbound riders.');
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
    const layer = [WORLD_TILE.WEST_BRIDGE, WORLD_TILE.WEST_FOREST_GATE].includes(gate) ? scene.westLayer : scene.worldLayer;
    const tiles = layer.filterTiles((tile) => tile.index === gate);
    return tiles.length > 0 && tiles.every((tile) => tile.collides);
  };
  for (const gate of Object.values(WORLD_GATES)) {
    assert(gateClosed(gate), `Gate ${gate} is not completely blocked.`);
  }

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
  }
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
  assert(scene.hud.progress.textContent.includes('3 / 9'), 'Unicorn counter is incorrect.');
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
  for (const category of ['Math', 'Logic']) {
    for (const difficulty of [1, 2]) {
      assert(challenges.filter((challenge) => challenge.category === category
        && challenge.difficulty === difficulty).length >= 4,
      `Too few ${category} challenges at level ${difficulty}.`);
    }
  }
  const reserved = scene.npcManager.getGateChallengeIds();
  const originalRandom = Math.random;
  const originalStart = scene.startChallenge;
  const pickup = scene.collectibleManager.pickups.getChildren()
    .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'unicorn');
  try {
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
    for (const [item, expected] of [
      [{ id: 'accessory-wings-blue', type: 'accessory', slot: 'wings' }, 'wings'],
      [{ id: 'accessory-crown', type: 'accessory', slot: 'crown' }, 'crown'],
      [{ id: 'accessory-witch-hat', type: 'accessory', slot: 'crown' }, null],
    ]) {
      scene.collectibleManager.collect = () => item;
      scene.collectPickup({});
      assert((heard.pop() ?? null) === expected, `${item.id} played the wrong pickup sound.`);
    }
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
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const displayedWords = challengeScene.children.list
    .filter((object) => typeof object.text === 'string')
    .map((object) => object.text).join(' ').match(/[A-Za-zÆØÅæøå]+/g) ?? [];
  assert(displayedWords.every((word) => word.length <= 3),
    'Beginner reading challenge screen has a word longer than 3 letters.');
  challengeScene.answerButtons[1].emit('pointerdown');
  assert(!challengeScene.isResolved && challengeScene.feedback.text === challenge.story.hint,
    'Wrong beginner reading answer did not show a hint.');
  assert(heard.length === 0, 'Wrong answer played a completion sound.');
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'Wrong answer switched players.');
  challengeScene.answerButtons[0].emit('pointerdown');
  assert(challengeScene.isResolved && challengeScene.feedback.text === challenge.story.success,
    'Correct beginner reading answer was not accepted.');
  challengeScene.answerButtons[0].emit('pointerdown');
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
    const correct = challenge.options.findIndex((option) => (
      scene.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    const wrong = challenge.options.findIndex((option) => (
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
    const correct = challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const shooter = game.scene.getScene('MosquitoScene');
    await waitUntil(() => shooter.sys.isActive(), `${id} shooter did not start.`);
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
    const correct = challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const troll = game.scene.getScene('TrollScene');
    await waitUntil(() => troll.sys.isActive(), `${npcId} game did not start.`);
    const map = npcId === 'west-troll' ? world.westMap : world.worldMap;
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
    for (let count = 0; count < 7; count += 1) {
      overlap(troll, troll.apples, troll.collectApple);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after western troll win.');
    assert(!world.westMap.getTileAt(23, 52).collides && world.westMap.getTileAt(16, 27).collides
      && world.stateManager.getLearnedChallengeIds().includes('west-troll-apples'),
    'Winning the western troll game did not open only its bridge and credit the question.');
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
    && legacyStore.loadState().equipment.size === 0, 'Legacy collection was not migrated.');
  const failingStore = new CollectionStore({
    getItem: () => { throw new Error('blocked'); },
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
  assertAccessoryCounters(scene);
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
  await testWestCrack(scene);
  await testFlight(scene);
  await testWestPhysicalCollision(scene);
  testGateInteractions(scene);
  await testOpenWestGates(scene);
  const firstPickup = scene.collectibleManager.pickups.getChildren()[0];
  scene.collectibleManager.store = failingStore;
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
  assert(new CollectionStore(storage).load().size === 6, 'Saved collection did not survive a new store instance.');

  let previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assertAccessoryCounters(scene);
  assert(scene.collectibleManager.getCollectedItems('unicorn').length === 3, 'Unicorns were not restored.');
  assert(scene.collectibleManager.getCollectedItems('accessory').length === 3, 'Accessories were not restored.');
  assert(scene.collectibleManager.pickups.getChildren().length === 39, 'Saved pickups reappeared or new pickups are missing.');
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
  collect(scene, 'unicorn', 6);
  collect(scene, 'accessory', 33);
  assert(scene.sys.isActive() && scene.collectibleManager.getCollectedCount('unicorn') === 9
    && scene.collectibleManager.getCollectedCount('accessory') === 36,
  'Additional collectibles were not obtainable.');
  const grass = scene.collectibleManager.getCollectedItems('unicorn').find((item) => item.name === 'Græs');
  assert(grass?.color === 'Grøn' && grass.texture === 'unicorn-green', 'Græs has the wrong appearance.');
  scene.enterStable();
  stable = await waitForStable(game, 9);
  assert(stable.unicorns.length === 9 && stable.accessories.length === 36, 'Stable does not show the full collection.');
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
  assert(stable.detailPanel.page === 2 && !stable.detailPanel.next.visible && stable.detailPanel.previous.visible,
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
      && unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-wings-'),
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
  assert(scene.collectibleManager.getCollectedCount('unicorn') === 9
    && scene.collectibleManager.getCollectedCount('accessory') === 36
    && scene.hud.progress.textContent.includes('9 / 9')
    && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('9 / 9'))
    && !scene.ui.list.some((object) => object.text === 'Fortsæt eventyret'),
  'Reloading a full collection interrupted play or lost progress.');
  assertAccessoryCounters(scene);
  scene.enterStable();
  stable = await waitForStable(game, 9);
  assert(stable.accessories.length === 36, 'Stable is inaccessible after reloading the full collection.');
  assert(stable.unicorns[1].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && stable.unicorns[1].accessoryLayer.length === 4
    && !stable.unicorns[0].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture),
  'Transferred wings or other equipment did not survive reloading.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  scene.openGate('flora');
  const resetButton = scene.hud.resetButton;
  const originalConfirm = window.confirm;
  let confirmations = 0;
  try {
    window.confirm = () => { confirmations += 1; return false; };
    resetButton.click();
    assert(confirmations === 1 && scene.collectibleManager.collectedIds.size === 45
      && store.loadState().equipment.size > 0 && !scene.worldMap.getTileAt(64, 16).collides,
    'Canceling reset changed progress or the reset button did not respond.');

    window.confirm = () => { confirmations += 1; return true; };
    scene.collectibleManager.store = failingStore;
    resetButton.click();
    assert(confirmations === 2 && scene.dialogueWindow.isOpen
      && scene.dialogueWindow.message.text.includes('ikke nulstillet')
      && scene.collectibleManager.collectedIds.size === 45
      && store.loadState().equipment.size > 0 && !scene.worldMap.getTileAt(64, 16).collides,
    'A failed reset did not preserve progress and report the error.');
    scene.dialogueWindow.close();
    scene.collectibleManager.store = store;
    previousManager = scene.collectibleManager;
    resetButton.click();
    scene = await waitForWorld(game, previousManager);
    assert(confirmations === 3 && store.loadState().collectedIds.size === 0
      && store.loadState().equipment.size === 0 && scene.collectibleManager.collectedIds.size === 0
      && scene.collectibleManager.pickups.getChildren().length === 45
      && scene.worldMap.getTileAt(64, 16).collides
      && scene.hud.progress.textContent.includes('0 / 9')
      && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('0 / 9'))
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
      && scene.collectibleManager.pickups.getChildren().length === 45,
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
