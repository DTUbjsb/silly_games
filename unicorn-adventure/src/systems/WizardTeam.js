import { UNICORN_CATEGORIES } from '../data/unicornCategories.js';

export function wizardTeam(unicorns, accessories) {
  const team = UNICORN_CATEGORIES.map(({ matches }) => unicorns.find(matches));
  if (team.some((unicorn) => !unicorn)
    || ['sticker', 'wings', 'crown', 'saddle'].some(
      (slot) => accessories.filter((item) => item.slot === slot).length < 4,
    )) return null;
  return team;
}

export function wizardEquipment(accessories) {
  const equipment = Array.from({ length: 4 }, () => []);
  for (const slot of ['sticker', 'wings', 'crown', 'saddle']) {
    const choices = Phaser.Utils.Array.Shuffle(accessories.filter((item) => item.slot === slot));
    choices.slice(0, 4).forEach((item, index) => equipment[index].push(item));
  }
  return equipment;
}
