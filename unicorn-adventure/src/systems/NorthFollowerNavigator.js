const GRID_SIZE = 32;
const SPEED = 260;
const REPLAN_MS = 1000;
const OFFSETS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export class NorthFollowerNavigator {
  constructor(layer, { minY = -Infinity, maxY = 0, lastRowBlocked = true } = {}) {
    this.layer = layer;
    this.minY = minY;
    this.maxY = maxY;
    this.lastRowBlocked = lastRowBlocked;
    this.path = [];
    this.replanAt = 0;
    this.active = false;
  }

  reset() {
    this.path = [];
    this.replanAt = 0;
    this.active = false;
  }

  isFree(sprite, x, y) {
    const body = sprite.body;
    const left = x + body.left - sprite.x;
    const top = y + body.top - sprite.y;
    const bounds = body.world.bounds;
    return left >= Math.max(bounds.left, this.layer.x) && top >= Math.max(bounds.top, this.minY)
      && left + body.width <= Math.min(bounds.right, this.layer.x + this.layer.layer.width * GRID_SIZE)
      && top + body.height <= this.maxY
      && this.layer.getTilesWithinWorldXY(left, top, body.width, body.height, { isColliding: true }).length === 0;
  }

  canTravel(sprite, from, to) {
    const steps = Math.max(1, Math.ceil(Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) / 6));
    for (let step = 1; step <= steps; step += 1) {
      if (!this.isFree(sprite, Phaser.Math.Linear(from.x, to.x, step / steps),
        Phaser.Math.Linear(from.y, to.y, step / steps))) return false;
    }
    return true;
  }

  findPath(sprite, target) {
    const originX = this.layer.x;
    const originY = this.layer.y;
    const cell = (x, y) => ({
      x: Math.floor((x - originX) / GRID_SIZE),
      y: Math.floor((y - originY) / GRID_SIZE),
    });
    const point = (x, y) => ({
      x: originX + (x + 0.5) * GRID_SIZE,
      y: originY + (y + 0.5) * GRID_SIZE,
    });
    const candidates = (position, requireTravel) => {
      const base = cell(position.x, position.y);
      const choices = [];
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const x = base.x + dx;
          const y = base.y + dy;
          if (x < 0 || y < 0 || x >= this.layer.layer.width
            || y >= this.layer.layer.height - (this.lastRowBlocked ? 1 : 0)) continue;
          const at = point(x, y);
          if (this.isFree(sprite, at.x, at.y)
            && (!requireTravel || this.canTravel(sprite, position, at))) {
            choices.push({ x, y, distance: Phaser.Math.Distance.Between(position.x, position.y, at.x, at.y) });
          }
        }
      }
      return choices.sort((a, b) => a.distance - b.distance);
    };
    const start = candidates({ x: sprite.x, y: sprite.y }, true)[0];
    const goal = candidates(target, false)[0];
    if (!start || !goal) return [];
    const key = (x, y) => `${x},${y}`;
    const startKey = key(start.x, start.y);
    const goalKey = key(goal.x, goal.y);
    const queue = [{ ...start, g: 0 }];
    const best = new Map([[startKey, 0]]);
    const parents = new Map([[startKey, null]]);
    while (queue.length) {
      queue.sort((a, b) => (a.g + Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y))
        - (b.g + Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y)));
      const current = queue.shift();
      const currentKey = key(current.x, current.y);
      if (current.g !== best.get(currentKey)) continue;
      if (currentKey === goalKey) {
        const path = [];
        for (let cursor = currentKey; cursor !== null; cursor = parents.get(cursor)) {
          const [x, y] = cursor.split(',').map(Number);
          path.push(point(x, y));
        }
        return path.reverse();
      }
      for (const [dx, dy] of OFFSETS) {
        const x = current.x + dx;
        const y = current.y + dy;
        const nextKey = key(x, y);
        const next = point(x, y);
        const cost = current.g + 1;
        if (x < 0 || y < 0 || x >= this.layer.layer.width
          || y >= this.layer.layer.height - (this.lastRowBlocked ? 1 : 0)
          || cost >= (best.get(nextKey) ?? Infinity) || !this.isFree(sprite, next.x, next.y)
          || !this.canTravel(sprite, point(current.x, current.y), next)) continue;
        best.set(nextKey, cost);
        parents.set(nextKey, currentKey);
        queue.push({ x, y, g: cost });
      }
    }
    return [];
  }

  update(sprite, target, time, delta) {
    this.active = true;
    if (time >= this.replanAt) {
      this.path = this.findPath(sprite, target);
      this.replanAt = time + REPLAN_MS;
    }
    let remaining = SPEED * Math.min(delta, 100) / 1000;
    while (this.path.length && remaining > 0) {
      const waypoint = this.path[0];
      const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, waypoint.x, waypoint.y);
      const step = Math.min(distance, remaining);
      const next = distance ? {
        x: sprite.x + (waypoint.x - sprite.x) * step / distance,
        y: sprite.y + (waypoint.y - sprite.y) * step / distance,
      } : waypoint;
      if (!this.canTravel(sprite, { x: sprite.x, y: sprite.y }, next)) {
        this.path = [];
        this.replanAt = time + REPLAN_MS;
        break;
      }
      sprite.setPosition(next.x, next.y);
      sprite.body.updateFromGameObject();
      remaining -= step;
      if (distance <= step) this.path.shift();
      else break;
    }
    if (!this.path.length && Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y) < 70) {
      this.reset();
    }
  }
}
