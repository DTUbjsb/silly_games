export class GameStateManager {
  constructor(goal) {
    this.goal = goal;
    this.learnedChallengeIds = new Set();
  }

  learn(challengeId) {
    this.learnedChallengeIds.add(challengeId);
  }

  get learnedCount() {
    return this.learnedChallengeIds.size;
  }

  getLearnedChallengeIds() {
    return Array.from(this.learnedChallengeIds);
  }

  isComplete() {
    return this.learnedCount >= this.goal;
  }
}
