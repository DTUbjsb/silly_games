import { BootScene } from './scenes/BootScene.js';
import { ChallengeScene } from './scenes/ChallengeScene.js';
import { MainWorldScene } from './scenes/MainWorldScene.js';

export function createGameConfig() {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: 800,
    height: 600,
    backgroundColor: '#c8e9ff',
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MainWorldScene, ChallengeScene],
  };
}
