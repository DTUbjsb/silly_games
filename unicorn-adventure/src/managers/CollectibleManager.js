const COLLECTIBLE_TYPES = new Set(['unicorn', 'accessory']);

export class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.collectedIds = new Set();
    this.pickups = scene.physics.add.staticGroup();
    this.loadPromise = null;
  }

  async loadCollectibles() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchCollectibles();
    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async fetchCollectibles() {
    const manifestUrl = new URL('../data/collectibles/index.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Kunne ikke indlæse samlingslisten (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      throw new Error('Samlingslisten skal indeholde mindst én datafil.');
    }

    const groups = await Promise.all(manifest.files.map(async (filename) => {
      if (typeof filename !== 'string' || !/^[\w-]+\.json$/i.test(filename)) {
        throw new Error(`Ugyldigt filnavn til samlingen: ${filename}`);
      }

      const response = await fetch(new URL(filename, manifestUrl));
      if (!response.ok) {
        throw new Error(`Kunne ikke indlæse samlingen fra "${filename}" (${response.status}).`);
      }

      const data = await response.json();
      if (!COLLECTIBLE_TYPES.has(data.type) || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error(`Filen "${filename}" skal have en gyldig type og mindst én genstand.`);
      }

      return data.items.map((item, index) => this.validateItem(
        { ...item, type: data.type },
        filename,
        index,
      ));
    }));

    const loadedItems = new Map();
    for (const item of groups.flat()) {
      if (loadedItems.has(item.id)) {
        throw new Error(`Samlings-id'et "${item.id}" findes flere gange.`);
      }
      loadedItems.set(item.id, item);
    }

    this.items = loadedItems;
    this.items.forEach((item) => this.createPickup(item));
    return this.getAllItems();
  }

  validateItem(item, filename, index) {
    const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
    if (
      !item
      || !hasText(item.id)
      || !COLLECTIBLE_TYPES.has(item.type)
      || !hasText(item.name)
      || !hasText(item.texture)
      || !Number.isFinite(item.x)
      || !Number.isFinite(item.y)
    ) {
      throw new Error(`Genstand ${index + 1} i "${filename}" har ugyldige felter.`);
    }
    if (!this.scene.textures.exists(item.texture)) {
      throw new Error(`Samlingens grafik "${item.texture}" er ikke indlæst.`);
    }

    return {
      id: item.id.trim(),
      type: item.type,
      name: item.name.trim(),
      texture: item.texture.trim(),
      x: item.x,
      y: item.y,
    };
  }

  createPickup(item) {
    const pickup = this.pickups.create(item.x, item.y, item.texture)
      .setScale(item.type === 'unicorn' ? 0.56 : 0.72)
      .setDepth(2);
    pickup.refreshBody();
    pickup.setData('collectibleId', item.id);
  }

  getItemForPickup(pickup) {
    return this.items.get(pickup.getData('collectibleId'));
  }

  collect(pickup) {
    const item = this.getItemForPickup(pickup);
    if (!item || this.collectedIds.has(item.id)) {
      return null;
    }

    this.collectedIds.add(item.id);
    pickup.destroy();
    return { ...item };
  }

  getCollectedCount(type) {
    return Array.from(this.collectedIds)
      .filter((id) => this.items.get(id)?.type === type)
      .length;
  }

  getTotalCount(type) {
    return Array.from(this.items.values())
      .filter((item) => item.type === type)
      .length;
  }

  getAllItems() {
    return Array.from(this.items.values(), (item) => ({ ...item }));
  }
}
