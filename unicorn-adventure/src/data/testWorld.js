export const TEST_WORLD_TILE_SIZE = 32;
export const WORLD_TILE = Object.freeze({
  GRASS: 0,
  PATH: 1,
  FLOWERS: 2,
  WATER: 3,
  FOREST: 4,
  BRIDGE: 5,
  FLORA_GATE: 6,
  LUNA_GATE: 7,
  SECOND_BRIDGE: 8,
  WEST_WALL: 9,
  WEST_BRIDGE: 10,
  WEST_FOREST_GATE: 11,
  DARK_GROUND: 12,
  DARK_TREE: 13,
  NORTH_FOREST_GATE: 14,
  VOLCANIC_GROUND: 15,
  VOLCANIC_ROCK: 16,
  VOLCANIC_GATE_A: 17,
  VOLCANIC_GATE_B: 18,
  SOUTH_GATE: 19,
});

export const WEST_REGION_WIDTH = 32;
export const WEST_CRACK = Object.freeze({ x: -16, y: 400, radius: 115 });
export const WEST_REGION_DATA = createWestRegion();
export const NORTH_REGION_HEIGHT = 48;
export const NORTH_HOLE = Object.freeze({ x: 816, y: -16, radius: 115 });
export const LAKE = Object.freeze({
  left: 96, right: 111, top: 4, bottom: 20,
  islandLeft: 102, islandRight: 108, islandTop: 10, islandBottom: 14,
  boatX: 3376, shoreY: 660, islandY: 480,
  shoreLandingY: 698, islandLandingY: 438, radius: 85,
});
export const NORTH_FOREST = Object.freeze({ left: 90, right: 110, top: 10, bottom: 30 });
export const NORTH_REGION_DATA = createNorthRegion();
export const EAST_REGION_WIDTH = 64;
export const EAST_ORIGIN = 128 * TEST_WORLD_TILE_SIZE;
export const EAST_PASS = Object.freeze({ x: EAST_ORIGIN + 16, y: 400, radius: 115 });
export const EAST_REGION_DATA = createEastRegion();
export const SOUTH_ORIGIN = 96 * TEST_WORLD_TILE_SIZE;
export const SOUTH_REGION_HEIGHT = 32;
export const SOUTH_PASS = Object.freeze({ x: 2064, y: SOUTH_ORIGIN + 16, radius: 120 });
export const DRAGON_DEN = Object.freeze({ x: 2050, y: SOUTH_ORIGIN + 810, radius: 180 });
export const SOUTH_REGION_DATA = Array.from({ length: SOUTH_REGION_HEIGHT + 1 }, (_, y) => (
  Array.from({ length: 128 }, (_, x) => (
    y === 0 ? (x >= 62 && x <= 66 ? WORLD_TILE.SOUTH_GATE : WORLD_TILE.WEST_WALL) : WORLD_TILE.GRASS
  ))
));

function createEastRegion() {
  const tiles = Array.from({ length: 96 }, (_, y) => Array.from({ length: EAST_REGION_WIDTH }, (_, x) => (
    x === 0 ? WORLD_TILE.WEST_WALL : WORLD_TILE.VOLCANIC_GROUND
  )));
  for (const [left, right, top, bottom, gate, gateY] of [
    [12, 27, 8, 24, WORLD_TILE.VOLCANIC_GATE_A, 16],
    [35, 52, 45, 61, WORLD_TILE.VOLCANIC_GATE_B, 53],
  ]) {
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if (x === left || x === right || y === top || y === bottom) tiles[y][x] = WORLD_TILE.VOLCANIC_ROCK;
      }
    }
    for (let y = gateY - 1; y <= gateY + 1; y += 1) tiles[y][left] = gate;
  }
  return tiles;
}

function createNorthRegion() {
  const width = 128 + WEST_REGION_WIDTH;
  const tiles = Array.from({ length: NORTH_REGION_HEIGHT + 1 }, (_, y) => (
    Array.from({ length: width }, (_, x) => {
      if (y === NORTH_REGION_HEIGHT) return WORLD_TILE.WEST_WALL;
      const worldX = (x - WEST_REGION_WIDTH) * TEST_WORLD_TILE_SIZE + 16;
      const worldY = (y - NORTH_REGION_HEIGHT - 1) * TEST_WORLD_TILE_SIZE + 16;
      const nearEntrance = Math.abs(worldX - NORTH_HOLE.x) < 200 && worldY > -300;
      return !nearEntrance && x > 1 && x < width - 2 && y > 1
        && (x * 19 + y * 31 + x * y) % 29 === 0
        ? WORLD_TILE.DARK_TREE : WORLD_TILE.DARK_GROUND;
    })
  ));
  for (let y = NORTH_FOREST.top; y <= NORTH_FOREST.bottom; y += 1) {
    for (let x = NORTH_FOREST.left; x <= NORTH_FOREST.right; x += 1) {
      const border = x < NORTH_FOREST.left + 3 || x > NORTH_FOREST.right - 3
        || y < NORTH_FOREST.top + 3 || y > NORTH_FOREST.bottom - 3;
      tiles[y][x] = border ? WORLD_TILE.DARK_TREE : WORLD_TILE.DARK_GROUND;
    }
  }
  for (let y = 19; y <= 21; y += 1) {
    for (let x = 90; x <= 92; x += 1) tiles[y][x] = WORLD_TILE.NORTH_FOREST_GATE;
    for (let x = 86; x <= 89; x += 1) tiles[y][x] = WORLD_TILE.DARK_GROUND;
  }
  for (const [x, y] of [
    [8, 6], [20, 15], [30, 30], [40, 8], [48, 23],
    [60, 38], [68, 7], [76, 29], [126, 14], [145, 35],
  ]) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) tiles[y + dy][x + dx] = WORLD_TILE.DARK_GROUND;
    }
  }
  return tiles;
}

function createWestRegion() {
  const tiles = Array.from({ length: 96 }, (_, y) => (
    Array.from({ length: WEST_REGION_WIDTH }, (_, x) => (
    x === WEST_REGION_WIDTH - 1 ? WORLD_TILE.WEST_WALL
      : (x + y * 3) % 13 === 0 ? WORLD_TILE.FLOWERS : WORLD_TILE.GRASS
    ))
  ));
  createForest(tiles, { left: 3, right: 17, top: 19, bottom: 35 });
  for (let y = 26; y <= 28; y += 1) {
    for (let x = 15; x <= 17; x += 1) {
      tiles[y][x] = WORLD_TILE.WEST_FOREST_GATE;
    }
  }
  for (let y = 52; y <= 53; y += 1) {
    for (let x = 0; x < WEST_REGION_WIDTH - 1; x += 1) {
      tiles[y][x] = x >= 22 && x <= 24 ? WORLD_TILE.WEST_BRIDGE : WORLD_TILE.WATER;
    }
  }
  return tiles;
}

export const WORLD_GATES = Object.freeze({
  bridge: WORLD_TILE.BRIDGE,
  flora: WORLD_TILE.FLORA_GATE,
  luna: WORLD_TILE.LUNA_GATE,
  secondBridge: WORLD_TILE.SECOND_BRIDGE,
  westBridge: WORLD_TILE.WEST_BRIDGE,
  westForest: WORLD_TILE.WEST_FOREST_GATE,
  northForest: WORLD_TILE.NORTH_FOREST_GATE,
  volcanoA: WORLD_TILE.VOLCANIC_GATE_A,
  volcanoB: WORLD_TILE.VOLCANIC_GATE_B,
  south: WORLD_TILE.SOUTH_GATE,
});

// Keep map layout separate from rendering so this test world can later be replaced with authored maps.
export const TEST_WORLD_DATA = createTestWorld();

function createTestWorld() {
  const width = 128;
  const height = 96;
  const tiles = Array.from({ length: height }, () => Array(width).fill(WORLD_TILE.GRASS));
  for (const center of [16, 48, 80]) {
    for (let x = 0; x < width; x += 1) {
      for (let y = center - 1; y <= center + 1; y += 1) {
        tiles[y][x] = WORLD_TILE.PATH;
      }
    }
  }

  createForest(tiles, { left: 46, right: 65, top: 7, bottom: 25 });
  createForest(tiles, { left: 67, right: 88, top: 44, bottom: 59 });
  for (let y = 15; y <= 17; y += 1) {
    for (let x = 63; x <= 65; x += 1) {
      tiles[y][x] = WORLD_TILE.FLORA_GATE;
    }
  }
  for (let y = 51; y <= 53; y += 1) {
    for (let x = 67; x <= 69; x += 1) {
      tiles[y][x] = WORLD_TILE.LUNA_GATE;
    }
  }

  for (let y = LAKE.top; y <= LAKE.bottom; y += 1) {
    for (let x = LAKE.left; x <= LAKE.right; x += 1) {
      const island = x >= LAKE.islandLeft && x <= LAKE.islandRight
        && y >= LAKE.islandTop && y <= LAKE.islandBottom;
      tiles[y][x] = island ? WORLD_TILE.PATH : WORLD_TILE.WATER;
    }
  }

  for (const river of [
    { y: 32, x: 30, bridge: WORLD_TILE.BRIDGE },
    { y: 64, x: 92, bridge: WORLD_TILE.SECOND_BRIDGE },
  ]) {
    for (let y = river.y; y <= river.y + 1; y += 1) {
      for (let x = 0; x < width; x += 1) {
        tiles[y][x] = WORLD_TILE.WATER;
      }
      for (let x = river.x; x < river.x + 3; x += 1) {
        tiles[y][x] = river.bridge;
      }
    }
  }

  for (let y = 3; y < height; y += 5) {
    for (let x = 3 + (y % 4); x < width; x += 7) {
      if (tiles[y][x] === WORLD_TILE.GRASS) {
        tiles[y][x] = WORLD_TILE.FLOWERS;
      }
    }
  }

  return tiles;
}

function createForest(tiles, { left, right, top, bottom }) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const isBorder = x < left + 3 || x > right - 3 || y < top + 3 || y > bottom - 3;
      tiles[y][x] = isBorder ? WORLD_TILE.FOREST : WORLD_TILE.GRASS;
    }
  }
}
