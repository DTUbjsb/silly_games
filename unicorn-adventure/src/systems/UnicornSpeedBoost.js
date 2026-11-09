import { UNICORN_CATEGORIES } from '../data/unicornCategories.js';

const COOLDOWN = 10000;
const TIERS = [
  { id: 'volcano', multiplier: 2, duration: 4000 },
  { id: 'dark', multiplier: 1.5, duration: 4000 },
  { id: 'basic', multiplier: 1.5, duration: 2000 },
];

export class UnicornSpeedBoost {
  constructor() {
    this.remaining = 0;
    this.cooldown = 0;
    this.duration = 0;
    this.multiplier = 1;
    this.mounts = [];
  }

  getTier(unicorns, accessories) {
    if (accessories.filter((item) => item.slot === 'saddle').length < 2) return null;
    const count = (id) => unicorns.filter(UNICORN_CATEGORIES.find((category) => category.id === id).matches).length;
    if (count('volcano') >= 2) return TIERS[0];
    if (count('dark') >= 2) return TIERS[1];
    if (count('original') + count('rainbow') >= 2) return TIERS[2];
    return null;
  }

  getAvailableMounts(unicorns, accessories) {
    const tier = this.getTier(unicorns, accessories);
    if (!tier) return [];
    const categories = tier.id === 'basic' ? ['original', 'rainbow'] : [tier.id];
    return unicorns.filter((item) => UNICORN_CATEGORIES.some(
      (category) => categories.includes(category.id) && category.matches(item),
    )).slice(0, 2);
  }

  activate(unicorns, accessories) {
    const tier = this.getTier(unicorns, accessories);
    if (!tier || this.cooldown > 0) return false;
    this.duration = tier.duration;
    this.remaining = tier.duration;
    this.cooldown = COOLDOWN;
    this.multiplier = tier.multiplier;
    this.mounts = this.getAvailableMounts(unicorns, accessories);
    return true;
  }

  getIndicator(unicorns, accessories) {
    const active = this.remaining > 0;
    const mounts = active ? this.mounts : this.getAvailableMounts(unicorns, accessories);
    if (mounts.length < 2) return null;
    const durationSeconds = (active ? this.duration : this.getTier(unicorns, accessories).duration) / 1000;
    if (active) {
      return { mounts, durationSeconds, phase: 'active', progress: this.remaining / this.duration,
        seconds: Math.ceil(this.remaining / 1000) };
    }
    if (this.cooldown > 0) {
      return { mounts, durationSeconds, phase: 'recharging', progress: 1 - this.cooldown / (COOLDOWN - this.duration),
        seconds: Math.ceil(this.cooldown / 1000) };
    }
    return { mounts, durationSeconds, phase: 'ready', progress: 1, seconds: 0 };
  }

  update(delta) {
    this.remaining = Math.max(0, this.remaining - delta);
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.remaining === 0) {
      this.multiplier = 1;
      this.mounts = [];
    }
  }
}
