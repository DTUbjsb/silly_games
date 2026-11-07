const TURN_LIMIT = 4;

export class GameStateManager {
  constructor() {
    this.learnedChallengeIds = new Set();
    this.turnPoints = new Map();
  }

  learn(challengeId) {
    this.learnedChallengeIds.add(challengeId);
  }

  getLearnedChallengeIds() {
    return Array.from(this.learnedChallengeIds);
  }

  recordAccessory(playerId) {
    return this.recordTurnPoints(playerId, 1);
  }

  recordQuestion(playerId) {
    return this.recordTurnPoints(playerId, 2);
  }

  recordTurnPoints(playerId, points) {
    const total = (this.turnPoints.get(playerId) ?? 0) + points;
    if (total >= TURN_LIMIT) {
      this.turnPoints.delete(playerId);
      return true;
    }
    this.turnPoints.set(playerId, total);
    return false;
  }
}
