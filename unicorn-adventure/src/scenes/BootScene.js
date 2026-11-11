import { SoundEffects } from '../audio/SoundEffects.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('girl-purple', 'src/assets/girl-purple.svg');
    this.load.image('girl-yellow', 'src/assets/girl-yellow.svg');
    this.load.image('girl-brown', 'src/assets/girl-brown.svg');
    this.load.image('boy-yellow', 'src/assets/boy-yellow.svg');
    this.load.image('boy-brown', 'src/assets/boy-brown.svg');
    this.load.image('boy-purple', 'src/assets/boy-purple.svg');
    this.load.image('unicorn-purple', 'src/assets/unicorn-purple.svg');
    this.load.image('unicorn-blue', 'src/assets/unicorn-blue.svg');
    this.load.image('unicorn-pink', 'src/assets/unicorn-pink.svg');
    this.load.image('unicorn-green', 'src/assets/unicorn-green.svg');
    this.load.image('unicorn-orange', 'src/assets/unicorn-orange.svg');
    this.load.image('unicorn-turquoise', 'src/assets/unicorn-turquoise.svg');
    for (const color of ['rose', 'ocean', 'sun']) {
      this.load.image(`unicorn-rainbow-${color}`, `src/assets/unicorn-rainbow-${color}.svg`);
      for (const type of ['saddle', 'wings', 'hat', 'sticker']) {
        this.load.image(`accessory-${type}-${color}`, `src/assets/accessory-${type}-${color}.svg`);
      }
      this.load.image(`saddle-worn-${color}`, `src/assets/saddle-worn-${color}.svg`);
    }
    this.load.image('fairy-flora', 'src/assets/fairy-flora.svg');
    this.load.image('fairy-luna', 'src/assets/fairy-luna.svg');
    this.load.image('bridge-troll', 'src/assets/bridge-troll.svg');
    this.load.image('troll-arena', 'src/assets/troll-arena.svg');
    this.load.image('pterodactyl-perched', 'src/assets/pterodactyl-perched.svg');
    this.load.image('witch', 'src/assets/witch.svg');
    this.load.image('wizard', 'src/assets/wizard.svg');
    this.load.image('old-queen', 'src/assets/old-queen.svg');
    this.load.image('guide-gnome', 'src/assets/guide-gnome.svg');
    this.load.image('warrior-princess', 'src/assets/warrior-princess.svg');
    this.load.image('bow-and-arrow', 'src/assets/bow-and-arrow.svg');
    this.load.image('dragon-den', 'src/assets/dragon-den.svg');
    this.load.image('dragon-den-empty', 'src/assets/dragon-den-empty.svg');
    this.load.image('dragon-head', 'src/assets/dragon-head.svg');
    this.load.image('dragon-paw', 'src/assets/dragon-paw.svg');
    this.load.image('prince', 'src/assets/prince.svg');
    this.load.image('red-cat', 'src/assets/red-cat.svg');
    this.load.image('black-cat', 'src/assets/black-cat.svg');
    this.load.image('lake-boat', 'src/assets/lake-boat.svg');
    this.load.image('flashlight', 'src/assets/flashlight.svg');
    this.load.image('lava-boots', 'src/assets/lava-boots.svg');
    for (const color of ['flame', 'ember', 'ash']) {
      this.load.image(`unicorn-volcano-${color}`, `src/assets/unicorn-volcano-${color}.svg`);
      for (const type of ['saddle', 'wings', 'hat', 'sticker']) {
        this.load.image(`accessory-volcano-${color}-${type}`, `src/assets/accessory-volcano-${color}-${type}.svg`);
      }
      this.load.image(`saddle-worn-volcano-${color}`, `src/assets/saddle-worn-volcano-${color}.svg`);
    }
    for (const color of ['red', 'purple', 'black']) {
      this.load.image(`unicorn-dark-${color}`, `src/assets/unicorn-dark-${color}.svg`);
      for (const type of ['saddle', 'wings', 'hat', 'sticker']) {
        this.load.image(`accessory-dark-${color}-${type}`, `src/assets/accessory-dark-${color}-${type}.svg`);
      }
      this.load.image(`saddle-worn-dark-${color}`, `src/assets/saddle-worn-dark-${color}.svg`);
    }
    this.load.image('accessory-crown', 'src/assets/accessory-crown.svg');
    this.load.image('accessory-saddle-pink', 'src/assets/accessory-saddle-pink.svg');
    this.load.image('saddle-worn-pink', 'src/assets/saddle-worn-pink.svg');
    this.load.image('accessory-star-sticker', 'src/assets/accessory-star-sticker.svg');
    this.load.image('accessory-heart', 'src/assets/accessory-heart.svg');
    this.load.image('accessory-flower', 'src/assets/accessory-flower.svg');
    this.load.image('accessory-moon', 'src/assets/accessory-moon.svg');
    this.load.image('accessory-wave', 'src/assets/accessory-wave.svg');
    this.load.image('accessory-rainbow', 'src/assets/accessory-rainbow.svg');
    this.load.image('accessory-alvina-hat', 'src/assets/accessory-alvina-hat.svg');
    this.load.image('accessory-ellie-hat', 'src/assets/accessory-ellie-hat.svg');
    this.load.image('accessory-witch-hat', 'src/assets/accessory-witch-hat.svg');
    this.load.image('accessory-flower-hat', 'src/assets/accessory-flower-hat.svg');
    this.load.image('accessory-party-hat', 'src/assets/accessory-party-hat.svg');
    for (const color of ['blue', 'green', 'yellow', 'purple', 'orange']) {
      this.load.image(`accessory-saddle-${color}`, `src/assets/accessory-saddle-${color}.svg`);
      this.load.image(`saddle-worn-${color}`, `src/assets/saddle-worn-${color}.svg`);
    }
    for (const color of ['pink', 'blue', 'green', 'purple', 'orange', 'turquoise']) {
      this.load.image(`accessory-wings-${color}`, `src/assets/accessory-wings-${color}.svg`);
    }
  }

  create() {
    this.registry.set('soundEffects', new SoundEffects(this.sound));
    this.scene.start('MainWorldScene');
  }
}
