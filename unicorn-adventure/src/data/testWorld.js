export const TEST_WORLD_TILE_SIZE = 32;
export const WORLD_TILE = Object.freeze({
  GRASS: 0,
  PATH: 1,
  FLOWERS: 2,
  WATER: 3,
  FOREST: 4,
  BRIDGE: 5,
});

// Keep map layout separate from rendering so this test world can later be replaced with authored maps.
export const TEST_WORLD_DATA = createTestWorld();

function createTestWorld() {
  const width = 40;
  const height = 30;
  const tiles = Array.from({ length: height }, () => Array(width).fill(WORLD_TILE.GRASS));
  const forestPath = [
    { x: 0, y: 8 },
    { x: 4, y: 8 },
    { x: 8, y: 5 },
    { x: 12, y: 5 },
    { x: 16, y: 8 },
    { x: 18, y: 8 },
  ];

  for (let x = 0; x < width; x += 1) {
    tiles[14][x] = WORLD_TILE.PATH;
    tiles[15][x] = WORLD_TILE.PATH;
    tiles[16][x] = WORLD_TILE.PATH;
  }
  for (let y = 0; y < height; y += 1) {
    tiles[y][18] = WORLD_TILE.PATH;
    tiles[y][19] = WORLD_TILE.PATH;
    tiles[y][20] = WORLD_TILE.PATH;
  }

  for (let y = 3; y < 13; y += 1) {
    for (let x = 2; x < 17; x += 1) {
      tiles[y][x] = WORLD_TILE.FOREST;
    }
  }
  carveWalkablePath(tiles, forestPath);

  for (let y = 4; y < 9; y += 1) {
    for (let x = 29; x < 35; x += 1) {
      tiles[y][x] = WORLD_TILE.WATER;
    }
  }

  for (let y = 20; y <= 21; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles[y][x] = WORLD_TILE.WATER;
    }
    for (let x = 18; x <= 20; x += 1) {
      tiles[y][x] = WORLD_TILE.BRIDGE;
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

function carveWalkablePath(tiles, points) {
  for (let index = 0; index < points.length - 1; index += 1) {
    let x = points[index].x;
    let y = points[index].y;
    const end = points[index + 1];
    const dx = Math.abs(end.x - x);
    const dy = Math.abs(end.y - y);
    const stepX = x < end.x ? 1 : -1;
    const stepY = y < end.y ? 1 : -1;
    let error = dx - dy;

    while (true) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const pathX = x + offsetX;
          const pathY = y + offsetY;
          if (tiles[pathY]?.[pathX] !== undefined) {
            tiles[pathY][pathX] = WORLD_TILE.PATH;
          }
        }
      }

      if (x === end.x && y === end.y) {
        break;
      }

      const doubledError = error * 2;
      if (doubledError > -dy) {
        error -= dy;
        x += stepX;
      }
      if (doubledError < dx) {
        error += dx;
        y += stepY;
      }
    }
  }
}
