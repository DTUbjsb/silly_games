import { PlayerCharacter } from '../systems/PlayerCharacter.js';

const GIRL_AVATARS_BY_HAIR_COLOR = new Map([
  ['yellow', 'girl-yellow'],
  ['blonde', 'girl-yellow'],
  ['blond', 'girl-yellow'],
  ['golden', 'girl-yellow'],
  ['brown', 'girl-brown'],
  ['brunette', 'girl-brown'],
  ['light brown', 'girl-brown'],
  ['dark brown', 'girl-brown'],
  ['purple', 'girl-purple'],
]);
const BOY_AVATARS_BY_HAIR_COLOR = new Map([
  ['yellow', 'boy-yellow'],
  ['blonde', 'boy-yellow'],
  ['blond', 'boy-yellow'],
  ['golden', 'boy-yellow'],
  ['brown', 'boy-brown'],
  ['brunette', 'boy-brown'],
  ['light brown', 'boy-brown'],
  ['dark brown', 'boy-brown'],
  ['purple', 'boy-purple'],
]);

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.profiles = new Map();
    this.characters = new Map();
    this.loadPromise = null;
  }

  async loadPlayers() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchPlayerProfiles();
    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async fetchPlayerProfiles() {
    const manifestUrl = new URL('../data/players/index.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Kunne ikke indlæse spillerlisten (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.players) || manifest.players.length === 0) {
      throw new Error('Spillerlisten skal indeholde mindst én profilfil.');
    }

    // Adding a child only requires a profile JSON file and an entry in this data-only manifest.
    const profiles = await Promise.all(manifest.players.map(async (filename) => {
      if (typeof filename !== 'string' || !/^[\w-]+\.json$/i.test(filename)) {
        throw new Error(`Ugyldigt filnavn til spillerprofil: ${filename}`);
      }

      const profileUrl = new URL(filename, manifestUrl);
      const response = await fetch(profileUrl);
      if (!response.ok) {
        throw new Error(`Kunne ikke indlæse spillerprofilen "${filename}" (${response.status}).`);
      }

      return this.validateProfile(await response.json(), filename);
    }));

    const loadedProfiles = new Map();
    for (const profile of profiles) {
      if (loadedProfiles.has(profile.id)) {
        throw new Error(`Spiller-id'et "${profile.id}" findes flere gange.`);
      }
      loadedProfiles.set(profile.id, profile);
    }

    const savedPlayers = this.scene.collectibleManager.store.loadState().players;
    if (savedPlayers) {
      savedPlayers.forEach((savedPlayer, index) => {
        const profile = loadedProfiles.get(savedPlayer.id);
        loadedProfiles.set(savedPlayer.id, {
          ...profile,
          name: savedPlayer.name,
          age: savedPlayer.age,
          gender: savedPlayer.gender,
          hairColor: savedPlayer.hairColor,
        });
      });
    }

    this.profiles = loadedProfiles;
    return this.getAllPlayers();
  }

  validateProfile(profile, filename) {
    const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
    if (
      !profile
      || !isNonEmptyString(profile.id)
      || !isNonEmptyString(profile.name)
      || !Number.isInteger(profile.age)
      || profile.age < 0
      || !isNonEmptyString(profile.avatar)
      || !isNonEmptyString(profile.hairColor)
    ) {
      throw new Error(`Spillerprofilen "${filename}" skal indeholde id, navn, alder, avatar og hårfarve.`);
    }

    return {
      id: profile.id.trim(),
      name: profile.name.trim(),
      age: profile.age,
      avatar: profile.avatar.trim(),
      hairColor: profile.hairColor.trim(),
      gender: profile.gender ?? 'girl',
    };
  }

  getPlayer(id) {
    const profile = this.profiles.get(id);
    return profile ? { ...profile } : undefined;
  }

  getAllPlayers() {
    return Array.from(this.profiles.values(), (profile) => ({ ...profile }));
  }

  addPlayer(id, position) {
    if (this.characters.has(id)) {
      throw new Error(`Der findes allerede en figur for spilleren "${id}".`);
    }

    const profile = this.getPlayer(id);
    if (!profile) {
      throw new Error(`Der blev ikke fundet en indlæst spillerprofil med id "${id}".`);
    }
    const avatar = this.resolveAvatar(profile);
    if (!this.scene.textures.exists(avatar)) {
      throw new Error(`Avatarbilledet "${avatar}" er ikke indlæst.`);
    }

    const character = new PlayerCharacter(this.scene, { ...profile, ...position, avatar });
    this.characters.set(id, character);
    return character;
  }

  resolveAvatar(profile) {
    const avatars = profile.gender === 'boy' ? BOY_AVATARS_BY_HAIR_COLOR : GIRL_AVATARS_BY_HAIR_COLOR;
    if (profile.avatar !== 'girl') {
      return profile.avatar;
    }

    const hairColor = profile.hairColor.trim().toLowerCase();
    const avatar = avatars.get(hairColor);
    if (!avatar) {
      throw new Error(
        `Hårfarven "${profile.hairColor}" understøttes ikke.`,
      );
    }

    return avatar;
  }

  removePlayer(id) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    character.destroy();
    this.characters.delete(id);
    return true;
  }

  update() {
    for (const character of this.characters.values()) {
      character.updateNameTag();
    }
  }
}
