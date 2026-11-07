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
});

export const WEST_REGION_WIDTH = 32;
export const WEST_CRACK = Object.freeze({ x: -16, y: 400, radius: 115 });
export const WEST_REGION_DATA = createWestRegion();

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

  for (let y = 5; y < 13; y += 1) {
    for (let x = 104; x < 112; x += 1) {
      tiles[y][x] = WORLD_TILE.WATER;
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
