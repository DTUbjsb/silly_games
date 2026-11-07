function isInForest({ x, y }) {
  const tileX = Math.floor(x / 32);
  const tileY = Math.floor(y / 32);
  if (x >= 4096 && y >= 0) {
    const eastX = tileX - 128;
    return (eastX >= 12 && eastX <= 27 && tileY >= 8 && tileY <= 24)
      || (eastX >= 35 && eastX <= 52 && tileY >= 45 && tileY <= 61);
  }
  if (y < 0) {
    const northX = tileX + 32;
    const northY = tileY + 49;
    return northX >= 90 && northX <= 110 && northY >= 10 && northY <= 30;
  }
  return x < 0
    ? tileX >= -29 && tileX <= -15 && tileY >= 19 && tileY <= 35
    : (tileX >= 46 && tileX <= 65 && tileY >= 7 && tileY <= 25)
      || (tileX >= 67 && tileX <= 88 && tileY >= 44 && tileY <= 59);
}

export function newLayoutSeed(previous = null) {
  const seed = Math.floor(Math.random() * 0x100000000);
  return seed === previous ? (seed + 1) >>> 0 : seed;
}

export function arrangeCollectibles(items, seed) {
  const arranged = items.map((item) => ({ ...item }));
  if (seed === null) {
    return arranged;
  }
  const regions = new Map();
  for (const item of arranged) {
    if (isInForest(item)) {
      continue;
    }
    const region = item.y < 0 ? 'north' : item.x >= 4096 ? 'volcano' : item.x < 0 ? `west-${item.y < 52 * 32 ? 0 : 1}`
      : `east-${item.y < 32 * 32 ? 0 : item.y < 64 * 32 ? 1 : 2}`;
    if (!regions.has(region)) {
      regions.set(region, []);
    }
    regions.get(region).push(item);
  }
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  for (const group of regions.values()) {
    const positions = group.map(({ x, y }) => ({ x, y }));
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [positions[index], positions[other]] = [positions[other], positions[index]];
    }
    group.forEach((item, index) => Object.assign(item, positions[index]));
  }
  return arranged;
}
