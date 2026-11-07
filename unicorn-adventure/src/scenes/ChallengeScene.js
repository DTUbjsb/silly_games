const CATEGORY_LABELS = {
  Reading: 'Læsning',
  Math: 'Matematik',
  English: 'Engelsk',
  Logic: 'Logik',
};

export class ChallengeScene extends Phaser.Scene {
  constructor() {
    super('ChallengeScene');
  }

  create({ challenge, evaluateAnswer, onComplete }) {
    if (
      !challenge?.story
      || typeof evaluateAnswer !== 'function'
      || typeof onComplete !== 'function'
    ) {
      throw new Error('Eventyrudfordringen mangler spørgsmål, historie eller svarfunktion.');
    }

    this.onComplete = onComplete;
    this.isResolved = false;
    this.answerButtons = [];
    const beginnerReading = challenge.category === 'Reading' && challenge.difficulty === 1;
    const optionSpacing = Math.min(54, 128 / (challenge.options.length - 1));
    const firstOptionY = 310 + (128 - (challenge.options.length - 1) * optionSpacing) / 2;
    const buttonHeight = Math.min(44, optionSpacing - 4);
    const optionFontSize = Math.max(14, Math.min(20, buttonHeight * 0.48));

    this.add.rectangle(400, 300, 800, 600, 0x182b3b, 0.72)
      .setScrollFactor(0)
      .setDepth(20);
    this.add.rectangle(400, 300, 710, 520, 0xfffcf4, 0.99)
      .setStrokeStyle(4, 0x9b83d5)
      .setScrollFactor(0)
      .setDepth(21);
    this.add.text(400, 66, beginnerReading ? 'LÆS' : 'EN NY EVENTYRUDFORDRING', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#67539b',
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.add.text(400, 104, challenge.story.character, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '23px',
      fontStyle: 'bold',
      color: '#294c5b',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.add.text(400, 148, challenge.story.introduction, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '18px',
      color: '#34526a',
      align: 'center',
      wordWrap: { width: 610 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.add.text(400, 222, (
      beginnerReading ? 'Læs · 1' : `${CATEGORY_LABELS[challenge.category]} · niveau ${challenge.difficulty}`
    ), {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#67539b',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.add.text(400, 260, challenge.question, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#233e50',
      align: 'center',
      wordWrap: { width: 620 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);

    this.feedback = this.add.text(400, 486, beginnerReading ? 'Se på et ord.' : 'Vælg et svar for at hjælpe.', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '17px',
      color: '#48616f',
      align: 'center',
      wordWrap: { width: 610 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);

    challenge.options.forEach((option, index) => {
      const y = firstOptionY + index * optionSpacing;
      const button = this.add.rectangle(400, y, 400, buttonHeight, 0xe9f3ff)
        .setStrokeStyle(2, 0xb5c9e6)
        .setScrollFactor(0)
        .setDepth(23)
        .setInteractive({ useHandCursor: true });
      this.add.text(400, y, String(option), {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: `${optionFontSize}px`,
        fontStyle: 'bold',
        color: '#34526a',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(24);
      this.answerButtons.push(button);

      button.on('pointerover', () => button.setFillStyle(0xd8eaff));
      button.on('pointerout', () => button.setFillStyle(0xe9f3ff));
      button.on('pointerdown', () => {
        if (this.isResolved) {
          return;
        }

        if (evaluateAnswer(option)) {
          this.isResolved = true;
          this.registry.get('soundEffects').play('questionCorrect');
          this.answerButtons.forEach((answerButton) => answerButton.disableInteractive());
          this.feedback.setText(challenge.story.success).setColor('#26734c');
          this.continueButton.setVisible(true);
          return;
        }

        this.feedback.setText(challenge.story.hint).setColor('#b24e54');
      });
    });

    this.continueButton = this.add.text(400, 530, beginnerReading ? 'Kom nu' : 'Fortsæt eventyret', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#34526a',
      backgroundColor: '#e9f3ff',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(24).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.continueButton.on('pointerover', () => this.continueButton.setBackgroundColor('#d8eaff'));
    this.continueButton.on('pointerout', () => this.continueButton.setBackgroundColor('#e9f3ff'));
    this.continueButton.on('pointerdown', () => this.finish());
  }

  finish() {
    if (!this.isResolved) {
      return;
    }

    const onComplete = this.onComplete;
    this.onComplete = null;
    this.scene.stop();
    if (onComplete(true) !== false) {
      this.scene.resume('MainWorldScene');
    }
  }
}
