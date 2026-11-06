export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('girl', 'src/assets/girl.svg');
    this.load.image('girl-yellow', 'src/assets/girl-yellow.svg');
    this.load.image('girl-brown', 'src/assets/girl-brown.svg');
    this.load.image('unicorn', 'src/assets/unicorn.svg');
    this.load.image('unicorn-blue', 'src/assets/unicorn-blue.svg');
    this.load.image('unicorn-pink', 'src/assets/unicorn-pink.svg');
    this.load.image('bridge-troll', 'src/assets/bridge-troll.svg');
    this.load.image('accessory-crown', 'src/assets/accessory-crown.svg');
    this.load.image('accessory-saddle', 'src/assets/accessory-saddle.svg');
    this.load.image('accessory-star-sticker', 'src/assets/accessory-star-sticker.svg');
  }

  create() {
    this.scene.start('MainWorldScene');
  }
}
