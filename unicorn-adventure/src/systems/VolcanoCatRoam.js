const LOCATIONS = [
  { x: 4320, y: 1100 },
  { x: 5800, y: 450 },
  { x: 4450, y: 2200 },
  { x: 5900, y: 2700 },
];

export class VolcanoCatRoam {
  constructor(npc) {
    this.npc = npc;
    this.anchor = LOCATIONS[0];
    this.elapsed = 0;
  }

  update(delta) {
    this.elapsed += delta;
    this.setPosition(
      this.anchor.x + 45 * Math.sin(this.elapsed / 4500),
      this.anchor.y + 35 * Math.sin(this.elapsed / 7000),
    );
  }

  respawn() {
    const choices = LOCATIONS.filter((location) => Phaser.Math.Distance.Between(
      this.npc.x, this.npc.y, location.x, location.y,
    ) >= 900);
    if (!choices.length) throw new Error('Ildkatten har ingen fjern placering at vende tilbage til.');
    this.anchor = Phaser.Utils.Array.GetRandom(choices);
    this.elapsed = 0;
    this.setPosition(this.anchor.x, this.anchor.y);
  }

  setPosition(x, y) {
    this.npc.x = x;
    this.npc.y = y;
    this.npc.sprite.setPosition(x, y);
    this.npc.nameTag.setPosition(x, y - this.npc.sprite.displayHeight / 2 - 7);
  }
}
