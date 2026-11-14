import { TEST_WORLD_DATA, WEST_REGION_DATA, NORTH_REGION_DATA, SOUTH_REGION_DATA,
  NORTH_FOREST, WORLD_TILE } from './testWorld.js';

export function createWorldLayout(seed) {
  const copy = (data) => data.map((row) => row.slice());
  const world = copy(TEST_WORLD_DATA);
  const west = copy(WEST_REGION_DATA);
  const north = copy(NORTH_REGION_DATA);
  const south = copy(SOUTH_REGION_DATA);
  if (seed === null) return { world, west, north, south };

  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  for (const map of [world, west, south]) {
    for (let trail = 0; trail < 8; trail += 1) {
      let x = Math.floor(random() * map[0].length);
      let y = Math.floor(random() * map.length);
      for (let step = 0; step < 100; step += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const row = map[y + dy];
            if (row && [WORLD_TILE.GRASS, WORLD_TILE.FLOWERS].includes(row[x + dx])) {
              row[x + dx] = WORLD_TILE.PATH;
            }
          }
        }
        x = Math.max(0, Math.min(map[0].length - 1, x + Math.floor(random() * 3) - 1));
        y = Math.max(0, Math.min(map.length - 1, y + Math.floor(random() * 3) - 1));
      }
    }
    for (const row of map) {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === WORLD_TILE.GRASS && random() < 0.035) row[x] = WORLD_TILE.FLOWERS;
      }
    }
  }
  for (let y = 0; y < north.length; y += 1) {
    for (let x = 0; x < north[y].length; x += 1) {
      const protectedForest = x >= NORTH_FOREST.left && x <= NORTH_FOREST.right
        && y >= NORTH_FOREST.top && y <= NORTH_FOREST.bottom;
      if (!protectedForest && north[y][x] === WORLD_TILE.DARK_TREE && random() < 0.5) {
        north[y][x] = WORLD_TILE.DARK_GROUND;
      }
    }
  }
  return { world, west, north, south };
}
