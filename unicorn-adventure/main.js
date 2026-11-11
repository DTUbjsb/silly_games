import { createGameConfig } from './src/config.js';
import { CollectionStore } from './src/managers/CollectionStore.js';

const landingPage = document.querySelector('#landing-page');
const gameShell = document.querySelector('#game-shell');
const setupForm = document.querySelector('#player-setup');
const setupMessage = document.querySelector('#setup-message');
const startButton = setupForm.querySelector('button[type="submit"]');
const store = new CollectionStore();

window.addEventListener('unicorn-adventure-reset', (event) => {
  event.preventDefault();
  window.location.reload();
}, { once: true });

for (const select of setupForm.querySelectorAll('select[name$="-age"]')) {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Vælg alder';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  for (let age = 4; age <= 18; age += 1) {
    const option = document.createElement('option');
    option.value = String(age);
    option.textContent = String(age);
    select.append(option);
  }
}

try {
  const { players } = store.loadState();
  players?.forEach((player, index) => {
    const playerNumber = index + 1;
    setupForm.elements.namedItem(`player-${playerNumber}-name`).value = player.name;
    setupForm.elements.namedItem(`player-${playerNumber}-age`).value = String(player.age);
    setupForm.elements.namedItem(`player-${playerNumber}-gender`).value = player.gender;
    setupForm.elements.namedItem(`player-${playerNumber}-hair`).value = player.hairColor;
  });
} catch (error) {
  setupMessage.textContent = error.message;
}

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  for (const input of setupForm.querySelectorAll('input[name$="-name"]')) {
    input.value = input.value.trim();
    input.setCustomValidity(input.value ? '' : 'Skriv et navn til begge spillere.');
  }
  if (!setupForm.reportValidity()) return;

  const players = [1, 2].map((playerNumber) => ({
    id: `player-00${playerNumber}`,
    name: setupForm.elements.namedItem(`player-${playerNumber}-name`).value,
    age: Number(setupForm.elements.namedItem(`player-${playerNumber}-age`).value),
    gender: setupForm.elements.namedItem(`player-${playerNumber}-gender`).value,
    hairColor: setupForm.elements.namedItem(`player-${playerNumber}-hair`).value,
  }));

  try {
    const state = store.loadState();
    store.save(
      state.collectedIds,
      state.equipment,
      state.layoutSeed,
      state.unlockedGates,
      state.unlockedRewards,
      players,
    );
    landingPage.hidden = true;
    gameShell.hidden = false;
    new Phaser.Game(createGameConfig());
  } catch (error) {
    landingPage.hidden = false;
    gameShell.hidden = true;
    setupMessage.textContent = error.message;
    startButton.focus();
  }
});
