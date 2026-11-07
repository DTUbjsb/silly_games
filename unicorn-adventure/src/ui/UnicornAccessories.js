const ATTACHMENTS = {
  crown: { x: 87, y: -82, scale: 0.53 },
  saddle: { x: -9, y: -33, scale: 1.05 },
  sticker: { x: -73, y: 7, scale: 0.46 },
  wings: { x: -18, y: -76, scale: 1.0 },
};
const LARGE_HAT_PLACEMENT = { x: 87, y: -100, scale: 0.9 };
const ACCESSORY_PLACEMENTS = {
  'accessory-alvina-hat': LARGE_HAT_PLACEMENT,
  'accessory-ellie-hat': LARGE_HAT_PLACEMENT,
};
export const PORTRAIT_UNICORN_SCALE = 2.1;

export function renderUnicornAccessories(scene, layer, unicornId, accessories, collection) {
  layer.removeAll(true);
  const orderedAccessories = [...accessories].sort((a, b) => Number(b.slot === 'wings') - Number(a.slot === 'wings'));
  for (const accessory of orderedAccessories) {
    if (collection.getAccessoryOwner(accessory.id) === unicornId) {
      const placement = ACCESSORY_PLACEMENTS[accessory.id] ?? ATTACHMENTS[accessory.slot];
      layer.add(scene.add.image(
        placement.x, placement.y,
        accessory.wornTexture ?? (accessory.slot === 'saddle' ? 'saddle-worn-pink' : accessory.texture),
      ).setScale(placement.scale));
    }
  }
}
