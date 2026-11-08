import { BootScene } from './scenes/BootScene.js';
import { ChallengeScene } from './scenes/ChallengeScene.js';
import { CaveScene } from './scenes/CaveScene.js';
import { CatMazeScene } from './scenes/CatMazeScene.js';
import { FlightScene } from './scenes/FlightScene.js';
import { MainWorldScene } from './scenes/MainWorldScene.js';
import { MosquitoScene } from './scenes/MosquitoScene.js';
import { StableScene } from './scenes/StableScene.js';
import { TrollScene } from './scenes/TrollScene.js';
import { WitchMazeScene } from './scenes/WitchMazeScene.js';
import { VolcanoScene } from './scenes/VolcanoScene.js';
import { LakeBoatScene } from './scenes/LakeBoatScene.js';
import { WizardBattleScene } from './scenes/WizardBattleScene.js';
import { PrincessDuelScene } from './scenes/PrincessDuelScene.js';
import { DragonBattleScene } from './scenes/DragonBattleScene.js';

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
    scene: [BootScene, MainWorldScene, ChallengeScene, MosquitoScene, TrollScene, FlightScene, CaveScene, WitchMazeScene, CatMazeScene, VolcanoScene, LakeBoatScene, WizardBattleScene, PrincessDuelScene, DragonBattleScene, StableScene],
  };
}
