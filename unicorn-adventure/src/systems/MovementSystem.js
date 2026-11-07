export class MovementSystem {
  constructor(scene, player) {
    this.player = player;
    this.speed = 242;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys('W,A,S,D');
  }

  setPlayer(player) {
    this.player = player;
  }

  update() {
    const horizontal = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const vertical = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize();

    this.player.setVelocity(direction.x * this.speed, direction.y * this.speed);
  }
}
