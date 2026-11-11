const STORAGE_KEY = 'unicorn-adventure-collection-v1';
const PLAYER_GENDERS = new Set(['girl', 'boy']);
const PLAYER_HAIR_COLORS = new Set(['yellow', 'brown', 'purple']);

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
      return {
        collectedIds: new Set(),
        equipment: new Map(),
        layoutSeed: null,
        unlockedGates: new Set(),
        unlockedRewards: new Set(),
        players: null,
      };
    }

    let saved;
    try {
      saved = JSON.parse(raw);
    } catch (error) {
      throw new Error('Den gemte samling kan ikke læses.', { cause: error });
    }
    if (saved?.version === 2 && Array.isArray(saved.players)) {
      saved.players = saved.players.map((player) => (
        player?.gender === 'other' ? { ...player, gender: 'girl' } : player
      ));
    }
    if (
      !saved || ![1, 2].includes(saved.version) || !Array.isArray(saved.collectedIds)
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
      || (saved.unlockedGates !== undefined && (
        !Array.isArray(saved.unlockedGates)
        || !saved.unlockedGates.every((gate) => ['south', 'dragon'].includes(gate))
        || new Set(saved.unlockedGates).size !== saved.unlockedGates.length
      ))
      || (saved.unlockedRewards !== undefined && (
        !Array.isArray(saved.unlockedRewards)
        || !saved.unlockedRewards.every((reward) => reward === 'princess-bows')
        || new Set(saved.unlockedRewards).size !== saved.unlockedRewards.length
      ))
      || (saved.players !== undefined && saved.players !== null && (
        !Array.isArray(saved.players)
        || saved.players.length !== 2
        || !saved.players.every((player, index) => player
          && player.id === `player-00${index + 1}`
          && typeof player.name === 'string'
          && player.name.trim().length > 0
          && player.name.trim().length <= 24
          && Number.isInteger(player.age)
          && player.age >= 4
          && player.age <= 18
          && PLAYER_GENDERS.has(player.gender)
          && PLAYER_HAIR_COLORS.has(player.hairColor))
      ))
    ) {
      throw new Error('Den gemte samling har et ugyldigt format.');
    }
    return {
      collectedIds: new Set(saved.collectedIds),
      equipment: new Map(saved.equipment ?? []),
      layoutSeed: saved.layoutSeed ?? null,
      unlockedGates: new Set(saved.unlockedGates ?? []),
      unlockedRewards: new Set(saved.unlockedRewards ?? []),
      players: saved.players ? saved.players.map((player) => ({ ...player })) : null,
    };
  }

  save(ids, equipment = this.loadState().equipment, layoutSeed = this.loadState().layoutSeed,
    unlockedGates = this.loadState().unlockedGates, unlockedRewards = this.loadState().unlockedRewards,
    players = this.loadState().players) {
    try {
      (this.storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        collectedIds: Array.from(ids),
        equipment: Array.from(equipment),
        layoutSeed,
        unlockedGates: Array.from(unlockedGates),
        unlockedRewards: Array.from(unlockedRewards),
        players,
      }));
    } catch (error) {
      throw new Error('Samlingen kunne ikke gemmes i browserens lager.', { cause: error });
    }
  }
}
