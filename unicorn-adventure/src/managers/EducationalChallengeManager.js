const CATEGORIES = new Set(['Reading', 'Math', 'English', 'Logic']);
const MAX_DIFFICULTY = 5;

export class EducationalChallengeManager {
  constructor() {
    this.challenges = new Map();
    this.loadPromise = null;
  }

  async loadChallenges() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchChallenges();
    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async fetchChallenges() {
    const manifestUrl = new URL('../data/challenges/index.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Kunne ikke indlæse udfordringslisten (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      throw new Error('Udfordringslisten skal indeholde mindst én datafil.');
    }

    const challengeGroups = await Promise.all(manifest.files.map(async (filename) => {
      if (typeof filename !== 'string' || !/^[\w-]+\.json$/i.test(filename)) {
        throw new Error(`Ugyldigt filnavn til udfordringer: ${filename}`);
      }

      const response = await fetch(new URL(filename, manifestUrl));
      if (!response.ok) {
        throw new Error(`Kunne ikke indlæse udfordringerne fra "${filename}" (${response.status}).`);
      }

      const data = await response.json();
      if (!Array.isArray(data.challenges) || data.challenges.length === 0) {
        throw new Error(`Filen "${filename}" skal indeholde mindst én udfordring.`);
      }

      return data.challenges.map((challenge, index) => (
        this.validateChallenge(challenge, filename, index)
      ));
    }));

    const loadedChallenges = new Map();
    for (const challenge of challengeGroups.flat()) {
      if (loadedChallenges.has(challenge.id)) {
        throw new Error(`Udfordrings-id'et "${challenge.id}" findes flere gange.`);
      }
      loadedChallenges.set(challenge.id, challenge);
    }

    this.challenges = loadedChallenges;
    return this.getAllChallenges();
  }

  validateChallenge(challenge, filename, index) {
    const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
    const isOption = (value) => (
      (typeof value === 'string' && value.trim().length > 0)
      || (typeof value === 'number' && Number.isFinite(value))
    );
    if (
      !challenge
      || !hasText(challenge.id)
      || !CATEGORIES.has(challenge.category)
      || !Number.isInteger(challenge.difficulty)
      || challenge.difficulty < 1
      || challenge.difficulty > MAX_DIFFICULTY
      || !hasText(challenge.question)
      || !Array.isArray(challenge.options)
      || challenge.options.length < 2
      || !challenge.options.every(isOption)
      || !isOption(challenge.correctAnswer)
      || !challenge.options.some((option) => this.answersMatch(option, challenge.correctAnswer))
      || !challenge.story
      || !hasText(challenge.story.character)
      || !hasText(challenge.story.introduction)
      || !hasText(challenge.story.success)
      || !hasText(challenge.story.hint)
    ) {
      throw new Error(
        `Udfordring ${index + 1} i "${filename}" har ugyldige felter, svarmuligheder eller historie.`,
      );
    }

    return {
      id: challenge.id.trim(),
      category: challenge.category,
      difficulty: challenge.difficulty,
      question: challenge.question.trim(),
      options: challenge.options.map((option) => (
        typeof option === 'string' ? option.trim() : option
      )),
      correctAnswer: typeof challenge.correctAnswer === 'string'
        ? challenge.correctAnswer.trim()
        : challenge.correctAnswer,
      story: {
        character: challenge.story.character.trim(),
        introduction: challenge.story.introduction.trim(),
        success: challenge.story.success.trim(),
        hint: challenge.story.hint.trim(),
      },
    };
  }

  getChallenge(id) {
    const challenge = this.challenges.get(id);
    return challenge ? { ...challenge, options: [...challenge.options] } : undefined;
  }

  getChallengeForAge(age, excludedIds = [], reservedIds = []) {
    if (!Number.isInteger(age) || age < 0) {
      throw new RangeError('Alderen skal være et helt tal på mindst 0.');
    }
    if (this.challenges.size === 0) {
      throw new Error('Udfordringerne er ikke indlæst.');
    }

    const targetDifficulty = this.getDifficultyForAge(age);
    const reserved = new Set(reservedIds);
    const suitable = Array.from(this.challenges.values())
      .filter((challenge) => challenge.difficulty <= targetDifficulty && !reserved.has(challenge.id));
    if (suitable.length === 0) {
      throw new Error('Der findes ingen udfordringer på et passende niveau.');
    }

    const excluded = new Set(excludedIds);
    const unseen = suitable.filter((challenge) => !excluded.has(challenge.id));
    const pool = unseen.length > 0 ? unseen : suitable;
    const difficulty = Math.max(...pool.map((challenge) => challenge.difficulty));
    const candidates = pool.filter((challenge) => challenge.difficulty === difficulty);
    const challenge = candidates[Math.floor(Math.random() * candidates.length)];
    return { ...challenge, options: [...challenge.options] };
  }

  getDifficultyForAge(age) {
    if (age <= 6) {
      return 1;
    }
    if (age <= 8) {
      return 2;
    }
    if (age <= 10) {
      return 3;
    }
    if (age <= 12) {
      return 4;
    }
    return 5;
  }

  evaluateAnswer(challengeId, answer) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Udfordringen "${challengeId}" findes ikke.`);
    }

    return this.answersMatch(answer, challenge.correctAnswer);
  }

  answersMatch(left, right) {
    if (typeof left === 'number' && typeof right === 'number') {
      return left === right;
    }
    return String(left).trim().toLocaleLowerCase()
      === String(right).trim().toLocaleLowerCase();
  }

  getAllChallenges() {
    return Array.from(this.challenges.values(), (challenge) => (
      { ...challenge, options: [...challenge.options] }
    ));
  }
}
