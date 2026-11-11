export class PlayerCharacter {
  constructor(scene, { id, name, age, avatar, hairColor, gender, x, y }) {
    this.id = id;
    this.name = name;
    this.age = age;
    this.avatar = avatar;
    this.hairColor = hairColor;
    this.gender = gender;
    this.sprite = scene.physics.add.sprite(x, y, avatar);
    this.sprite.setScale(0.82);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setSize(55, 62).setOffset(20, 23);
    this.sprite.setDepth(2);

    this.nameTag = scene.add.text(0, 0, name, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#294c5b',
      backgroundColor: '#ffffffdd',
      padding: { x: 7, y: 4 },
    }).setOrigin(0.5, 1).setDepth(4);
    this.updateNameTag();
  }

  updateNameTag() {
    this.nameTag.setPosition(
      this.sprite.x,
      this.sprite.y - this.sprite.displayHeight / 2 - 7,
    );
  }

  destroy() {
    this.nameTag.destroy();
    this.sprite.destroy();
  }
}
