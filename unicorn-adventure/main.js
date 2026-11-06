import { createGameConfig } from './src/config.js';

// Keep startup in one small entry point so scenes and systems remain independently reusable.
new Phaser.Game(createGameConfig());
