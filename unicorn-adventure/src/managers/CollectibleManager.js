import { CollectionStore } from './CollectionStore.js';
import { arrangeCollectibles, newLayoutSeed } from '../data/collectibleLayout.js';

const COLLECTIBLE_TYPES = new Set(['unicorn', 'accessory']);
const ACCESSORY_SLOTS = new Set(['crown', 'saddle', 'sticker', 'wings']);

export class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.collectedIds = new Set();
    this.equipment = new Map();
    this.store = scene.registry.get('collectionStore') ?? new CollectionStore();
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

    const saved = this.store.loadState();
    for (const [accessoryId, unicornId] of saved.equipment) {
      const accessory = loadedItems.get(accessoryId);
      const unicorn = loadedItems.get(unicornId);
      if (
        (accessory && (accessory.type !== 'accessory' || !saved.collectedIds.has(accessoryId)))
        || (unicorn && (unicorn.type !== 'unicorn' || !saved.collectedIds.has(unicornId)))
      ) {
        throw new Error('Den gemte samling indeholder ugyldigt udstyr.');
      }
    }
    if (saved.layoutSeed === null && saved.collectedIds.size === 0 && saved.equipment.size === 0) {
      saved.layoutSeed = newLayoutSeed();
      this.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed);
    }
    this.collectedIds = saved.collectedIds;
    this.equipment = saved.equipment;
    this.items = new Map(arrangeCollectibles(Array.from(loadedItems.values()), saved.layoutSeed)
      .map((item) => [item.id, item]));
    this.items.forEach((item) => {
      if (!this.collectedIds.has(item.id)) {
        this.createPickup(item);
      }
    });
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
      || (item.type === 'unicorn' && !hasText(item.color))
      || (item.type === 'accessory' && !ACCESSORY_SLOTS.has(item.slot))
      || (item.wornTexture !== undefined && !hasText(item.wornTexture))
      || !Number.isFinite(item.x)
      || !Number.isFinite(item.y)
    ) {
      throw new Error(`Genstand ${index + 1} i "${filename}" har ugyldige felter.`);
    }
    if (!this.scene.textures.exists(item.texture)) {
      throw new Error(`Samlingens grafik "${item.texture}" er ikke indlæst.`);
    }
    if (item.wornTexture && !this.scene.textures.exists(item.wornTexture)) {
      throw new Error(`Tilbehørets grafik "${item.wornTexture}" er ikke indlæst.`);
    }

    return {
      id: item.id.trim(),
      type: item.type,
      name: item.name.trim(),
      texture: item.texture.trim(),
      ...(item.type === 'unicorn' ? { color: item.color.trim() } : {}),
      ...(item.type === 'accessory' ? { slot: item.slot } : {}),
      ...(item.wornTexture ? { wornTexture: item.wornTexture.trim() } : {}),
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

    const updatedIds = new Set(this.collectedIds);
    updatedIds.add(item.id);
    this.store.save(updatedIds, this.equipment);
    this.collectedIds = updatedIds;
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

  getCollectedItems(type) {
    return Array.from(this.items.values())
      .filter((item) => item.type === type && this.collectedIds.has(item.id))
      .map((item) => ({ ...item }));
  }

  getAccessoryOwner(accessoryId) {
    return this.equipment.get(accessoryId);
  }

  toggleAccessory(unicornId, accessoryId) {
    const unicorn = this.items.get(unicornId);
    const accessory = this.items.get(accessoryId);
    if (
      unicorn?.type !== 'unicorn' || accessory?.type !== 'accessory'
      || !this.collectedIds.has(unicornId) || !this.collectedIds.has(accessoryId)
    ) {
      throw new Error('Enhjørningen og tilbehøret skal være samlet først.');
    }
    const updated = new Map(this.equipment);
    if (updated.get(accessoryId) === unicornId) {
      updated.delete(accessoryId);
    } else {
      for (const [otherId, ownerId] of updated) {
        if (ownerId === unicornId && this.items.get(otherId)?.slot === accessory.slot) {
          updated.delete(otherId);
        }
      }
      updated.set(accessoryId, unicornId);
    }
    this.store.save(this.collectedIds, updated);
    this.equipment = updated;
  }
}
