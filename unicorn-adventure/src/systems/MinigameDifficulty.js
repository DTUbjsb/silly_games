export function minigameSpeed(age) {
  if (!Number.isInteger(age) || age < 0) {
    throw new Error('Minispillet mangler en gyldig spilleralder.');
  }
  return age < 7 ? 0.9 : age >= 8 ? 1.1 : 1;
}
