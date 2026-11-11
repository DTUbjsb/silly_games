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

export function testMap(scene) {
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
  assert(scene.southGroundDetails?.name === 'south-ground-details'
    && scene.southGroundDetails.depth > scene.southLayer.depth
    && scene.southGroundDetails.depth < 0,
  'Southern ground details are missing or cover the player sprites.');
  assert(scene.playerManager.resolveAvatar({ avatar: 'girl', hairColor: 'purple' }) === 'girl-purple',
    'Purple-haired girl uses the wrong texture name.');
  assert(['yellow', 'brown', 'purple'].every((hairColor) => (
    scene.playerManager.resolveAvatar({ avatar: 'girl', gender: 'boy', hairColor }) === `boy-${hairColor}`
      && scene.textures.exists(`boy-${hairColor}`)
  )), 'Boy avatars are missing or do not use their selected hair colors.');
}

export async function testWestCrack(scene) {
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

export async function testWestPhysicalCollision(scene) {
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

export function testNorthFollowerAndMusic(scene) {
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

export async function testWorldMusicPause(scene) {
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

export function testGateInteractions(scene) {
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

export async function testOpenWestGates(scene) {
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

export function testMovementAndProximitySounds(scene) {
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
