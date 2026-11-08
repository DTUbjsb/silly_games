export class NpcWander {
  constructor(npc) {
    this.npc = npc;
    this.anchor = { x: npc.x, y: npc.y };
    this.elapsed = 0;
  }

  update(delta) {
    this.elapsed += delta;
    this.setPosition(
      this.anchor.x + 45 * Math.sin(this.elapsed / 4500),
      this.anchor.y + 35 * Math.sin(this.elapsed / 7000),
    );
  }

  setPosition(x, y) {
    this.npc.x = x;
    this.npc.y = y;
    this.npc.sprite.setPosition(x, y);
    this.npc.nameTag.setPosition(x, y - this.npc.sprite.displayHeight / 2 - 7);
  }
}
