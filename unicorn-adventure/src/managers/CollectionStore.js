const STORAGE_KEY = 'unicorn-adventure-collection-v1';

export class CollectionStore {
  constructor(storage) {
    this.storage = storage;
  }

  load() {
    return this.loadState().collectedIds;
  }

  loadState() {
    let raw;
    try {
      raw = (this.storage ?? window.localStorage).getItem(STORAGE_KEY);
    } catch (error) {
      throw new Error('Samlingen kunne ikke læses fra browserens lager.', { cause: error });
    }
    if (raw === null) {
      return { collectedIds: new Set(), equipment: new Map(), layoutSeed: null };
    }

    let saved;
    try {
      saved = JSON.parse(raw);
    } catch (error) {
      throw new Error('Den gemte samling kan ikke læses.', { cause: error });
    }
    if (
      !saved || saved.version !== 1 || !Array.isArray(saved.collectedIds)
      || !saved.collectedIds.every((id) => typeof id === 'string' && id.trim().length > 0)
      || new Set(saved.collectedIds).size !== saved.collectedIds.length
      || (saved.equipment !== undefined && (
        !Array.isArray(saved.equipment)
        || !saved.equipment.every((entry) => Array.isArray(entry) && entry.length === 2
          && entry.every((id) => typeof id === 'string' && id.trim().length > 0))
        || new Set(saved.equipment.map((entry) => entry[0])).size !== saved.equipment.length
      ))
      || (saved.layoutSeed !== undefined && saved.layoutSeed !== null
        && (!Number.isInteger(saved.layoutSeed) || saved.layoutSeed < 0 || saved.layoutSeed > 0xffffffff))
    ) {
      throw new Error('Den gemte samling har et ugyldigt format.');
    }
    return {
      collectedIds: new Set(saved.collectedIds),
      equipment: new Map(saved.equipment ?? []),
      layoutSeed: saved.layoutSeed ?? null,
    };
  }

  save(ids, equipment = this.loadState().equipment, layoutSeed = this.loadState().layoutSeed) {
    try {
      (this.storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        collectedIds: Array.from(ids),
        equipment: Array.from(equipment),
        layoutSeed,
      }));
    } catch (error) {
      throw new Error('Samlingen kunne ikke gemmes i browserens lager.', { cause: error });
    }
  }
}
