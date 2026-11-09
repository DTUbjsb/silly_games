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

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function reachable(openGates) {
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

export function canReach(visited, item) {
  return visited.has(`${Math.floor(item.x / 32)},${Math.floor(item.y / 32)}`);
}

export function reachableWest(openGates) {
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

export function canReachWest(visited, item) {
  return visited.has(`${Math.floor(item.x / 32) + WEST_REGION_WIDTH},${Math.floor(item.y / 32)}`);
}

export function reachableNorth(openGate) {
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

export function canReachNorth(visited, item) {
  return visited.has(`${Math.floor(item.x / 32) + WEST_REGION_WIDTH},${Math.floor(item.y / 32) + NORTH_REGION_HEIGHT + 1}`);
}

export function reachableVolcano(openGates) {
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

export function canReachVolcano(visited, item) {
  return visited.has(`${Math.floor((item.x - EAST_ORIGIN) / 32)},${Math.floor(item.y / 32)}`);
}

export async function waitForWorld(game, previousManager = null) {
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

export async function waitForStable(game, count) {
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

export function collect(scene, type, count) {
  const pickups = scene.collectibleManager.pickups.getChildren()
    .filter((pickup) => scene.collectibleManager.getItemForPickup(pickup).type === type);
  for (const pickup of pickups.slice(0, count)) {
    scene.collectPickup(pickup);
    assertAccessoryCounters(scene);
    assertUnicornCounters(scene);
  }
}

export function assertUnicornCounters(scene) {
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

export function assertAccessoryCounters(scene) {
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

export async function clickCanvas(game, x, y) {
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
