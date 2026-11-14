import { createGameConfig } from '../src/config.js';
import { BootScene } from '../src/scenes/BootScene.js';
import { SoundEffects } from '../src/audio/SoundEffects.js';

const controls = document.querySelector('#controls');
const selection = document.querySelector('#minigame');
const age = document.querySelector('#age');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const status = document.querySelector('#status');

const games = {
  wizard: { scene: 'WizardBattleScene' },
  dragon: { scene: 'DragonBattleScene' },
  mosquito: { scene: 'MosquitoScene' },
  troll: { scene: 'TrollScene' },
  'flight-west': { scene: 'FlightScene', goingWest: true },
  'flight-east': { scene: 'FlightScene', goingWest: false },
  cave: { scene: 'CaveScene' },
  witch: { scene: 'WitchMazeScene' },
  cat: { scene: 'CatMazeScene' },
  boat: { scene: 'LakeBoatScene' },
  bridge: { scene: 'VolcanoScene', mode: 'bridge' },
  crystals: { scene: 'VolcanoScene', mode: 'crystals' },
  runes: { scene: 'VolcanoScene', mode: 'runes' },
  eruption: { scene: 'VolcanoScene', mode: 'eruption' },
  princess: { scene: 'PrincessDuelScene' },
};

const unicorns = [
  { id: 'test-white', texture: 'unicorn-purple' },
  { id: 'test-rainbow', texture: 'unicorn-rainbow-rose' },
  { id: 'test-dark', texture: 'unicorn-dark-red' },
  { id: 'test-volcano', texture: 'unicorn-volcano-flame' },
];
const accessories = ['sticker', 'wings', 'crown', 'saddle'].flatMap((slot) => (
  Array.from({ length: 4 }, (_, index) => ({
    id: `test-${slot}-${index}`,
    slot,
    texture: { sticker: 'accessory-star-sticker', wings: 'accessory-wings-pink',
      crown: 'accessory-crown', saddle: 'accessory-saddle-pink' }[slot],
    ...(slot === 'saddle' ? { wornTexture: 'saddle-worn-pink' } : {}),
  }))
));

class TestBootScene extends BootScene {
  preload() {
    this.load.on('loaderror', (file) => {
      this.loadFailed = true;
      console.error('Kunne ikke indlæse spilfilen:', file.src);
      status.textContent = 'En spilfil kunne ikke indlæses. Genindlæs siden for at prøve igen.';
    });
    super.preload();
  }

  create() {
    if (this.loadFailed) return;
    this.registry.set('soundEffects', new SoundEffects(this.sound));
    this.scene.start('MainWorldScene');
    startButton.disabled = false;
    status.textContent = 'Vælg et minispil, og tryk Start spil.';
  }
}

class TestWorldScene extends Phaser.Scene {
  constructor() {
    super('MainWorldScene');
  }
}

const config = createGameConfig();
config.scene = [TestBootScene, TestWorldScene,
  ...config.scene.filter((scene) => !['BootScene', 'MainWorldScene', 'ChallengeScene', 'StableScene'].includes(scene.name))];
const game = new Phaser.Game(config);
let activeScene = null;

function stopGame() {
  if (activeScene) game.scene.stop(activeScene);
  game.sound.stopAll();
  activeScene = null;
  stopButton.disabled = true;
}

controls.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!controls.reportValidity()) return;
  stopGame();
  const choice = games[selection.value];
  const players = [
    { id: 'test-player-1', name: 'Spiller 1', avatar: 'girl-purple', age: Number(age.value) },
    { id: 'test-player-2', name: 'Spiller 2', avatar: 'girl-yellow', age: Number(age.value) },
  ];
  activeScene = choice.scene;
  const label = selection.selectedOptions[0].textContent;
  status.textContent = `${label} er i gang.`;
  stopButton.disabled = false;
  document.activeElement.blur();
  game.scene.start(choice.scene, {
    player: players[0],
    players,
    unicorns,
    accessories,
    saddles: accessories.filter((item) => item.slot === 'saddle'),
    wings: accessories.filter((item) => item.slot === 'wings'),
    goingWest: choice.goingWest,
    mode: choice.mode,
    onComplete: (won) => {
      activeScene = null;
      stopButton.disabled = true;
      status.textContent = `${label}: ${won ? 'Du vandt!' : 'Prøv igen!'}`;
    },
  });
});

stopButton.addEventListener('click', () => {
  stopGame();
  status.textContent = 'Spillet er afsluttet. Vælg et minispil, og start igen.';
});
