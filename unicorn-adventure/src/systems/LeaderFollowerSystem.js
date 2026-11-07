export class LeaderFollowerSystem {
  constructor(players, { spacing = 110, followSpeed = 8, sampleDistance = 6 } = {}) {
    if (players.length === 0) {
      throw new Error('The leader-follower system requires at least one player.');
    }

    this.players = [...players];
    this.spacing = spacing;
    this.followSpeed = followSpeed;
    this.sampleDistance = sampleDistance;
    this.trail = [{ x: this.leader.sprite.x, y: this.leader.sprite.y }];
  }

  get leader() {
    return this.players[0];
  }

  swapLeader() {
    if (this.players.length < 2) {
      return null;
    }

    return this.setLeader(this.players[1].id);
  }

  setLeader(id) {
    const index = this.players.findIndex((player) => player.id === id);
    if (index < 0) {
      throw new Error(`Spilleren "${id}" findes ikke i gruppen.`);
    }
    [this.players[0], this.players[index]] = [this.players[index], this.players[0]];
    this.trail = [{ x: this.leader.sprite.x, y: this.leader.sprite.y }];
    return this.leader;
  }

  update(delta) {
    const leaderPosition = { x: this.leader.sprite.x, y: this.leader.sprite.y };
    const latestPosition = this.trail[0];
    if (Phaser.Math.Distance.Between(
      latestPosition.x,
      latestPosition.y,
      leaderPosition.x,
      leaderPosition.y,
    ) >= this.sampleDistance) {
      this.trail.unshift(leaderPosition);
      this.trimTrail();
    }

    const smoothing = Math.min(1, (delta / 1000) * this.followSpeed);
    this.players.slice(1).forEach((player, index) => {
      const sprite = player.sprite;
      const target = this.getTrailPosition(this.spacing * (index + 1));
      sprite.setPosition(
        Phaser.Math.Linear(sprite.x, target.x, smoothing),
        Phaser.Math.Linear(sprite.y, target.y, smoothing),
      );
      sprite.body.updateFromGameObject();
      sprite.setVelocity(0, 0);
    });
  }

  getTrailPosition(targetDistance) {
    let distance = 0;
    for (let index = 0; index < this.trail.length - 1; index += 1) {
      const current = this.trail[index];
      const previous = this.trail[index + 1];
      const segmentLength = Phaser.Math.Distance.Between(
        current.x,
        current.y,
        previous.x,
        previous.y,
      );

      if (distance + segmentLength >= targetDistance) {
        const progress = (targetDistance - distance) / segmentLength;
        return {
          x: Phaser.Math.Linear(current.x, previous.x, progress),
          y: Phaser.Math.Linear(current.y, previous.y, progress),
        };
      }
      distance += segmentLength;
    }

    const oldest = this.trail[this.trail.length - 1];
    return { x: oldest.x - (targetDistance - distance), y: oldest.y };
  }

  trimTrail() {
    const maxDistance = this.spacing * (this.players.length + 2);
    let distance = 0;
    let lastIndex = this.trail.length - 1;

    for (let index = 0; index < this.trail.length - 1; index += 1) {
      const current = this.trail[index];
      const previous = this.trail[index + 1];
      distance += Phaser.Math.Distance.Between(
        current.x,
        current.y,
        previous.x,
        previous.y,
      );
      if (distance > maxDistance) {
        lastIndex = index + 1;
        break;
      }
    }

    this.trail.length = lastIndex + 1;
  }
}
