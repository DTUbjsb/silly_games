export class DialogueWindow {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.mode = null;
    this.lines = [];
    this.lineIndex = 0;
    this.onComplete = null;
    this.onChoice = null;

    this.background = scene.add.rectangle(400, 485, 730, 150, 0xffffff, 0.97)
      .setStrokeStyle(4, 0x9b83d5)
      .setScrollFactor(0)
      .setDepth(8)
      .setVisible(false);
    this.speaker = scene.add.text(58, 422, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#67539b',
    }).setScrollFactor(0).setDepth(9).setVisible(false);
    this.message = scene.add.text(58, 450, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '18px',
      color: '#233e50',
      wordWrap: { width: 680 },
      lineSpacing: 4,
    }).setScrollFactor(0).setDepth(9).setVisible(false);
    this.prompt = scene.add.text(742, 545, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#48616f',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(9).setVisible(false);
    this.continueButton = scene.add.text(742, 530, 'Næste', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#34526a',
      backgroundColor: '#e9f3ff',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(9).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.acceptButton = scene.add.text(610, 530, 'Accepter', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#34526a',
      backgroundColor: '#e9f3ff',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(9).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.laterButton = scene.add.text(742, 530, 'Afslå', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#34526a',
      backgroundColor: '#e9f3ff',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(9).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.continueButton.on('pointerdown', () => this.advance());
    this.acceptButton.on('pointerdown', () => this.chooseQuest(true));
    this.laterButton.on('pointerdown', () => this.chooseQuest(false));
    this.continueButton.on('pointerover', () => this.continueButton.setBackgroundColor('#d8eaff'));
    this.continueButton.on('pointerout', () => this.continueButton.setBackgroundColor('#e9f3ff'));
    this.acceptButton.on('pointerover', () => this.acceptButton.setBackgroundColor('#d8eaff'));
    this.acceptButton.on('pointerout', () => this.acceptButton.setBackgroundColor('#e9f3ff'));
    this.laterButton.on('pointerover', () => this.laterButton.setBackgroundColor('#d8eaff'));
    this.laterButton.on('pointerout', () => this.laterButton.setBackgroundColor('#e9f3ff'));
  }

  showLines(speaker, lines, onComplete = null) {
    this.mode = 'dialogue';
    this.speakerName = speaker;
    this.lines = [...lines];
    this.lineIndex = 0;
    this.onComplete = onComplete;
    this.onChoice = null;
    this.open();
    this.continueButton.setVisible(true);
    this.acceptButton.setVisible(false);
    this.laterButton.setVisible(false);
    this.renderLine();
  }

  showQuestOffer(speaker, quest, onChoice) {
    this.mode = 'quest';
    this.onChoice = onChoice;
    this.onComplete = null;
    this.open();
    this.speaker.setText(speaker);
    this.message.setText(
      `${quest.title}\n${quest.description}\nBelønning: ${quest.reward}`,
    );
    this.prompt.setPosition(58, 545).setOrigin(0, 0).setText('Vil du tage imod opgaven?').setVisible(true);
    this.continueButton.setVisible(false);
    this.acceptButton.setVisible(true);
    this.laterButton.setVisible(true);
  }

  advance() {
    if (!this.isOpen) {
      return;
    }

    if (this.mode !== 'dialogue') {
      return;
    }

    if (this.lineIndex < this.lines.length - 1) {
      this.lineIndex += 1;
      this.renderLine();
      return;
    }

    const onComplete = this.onComplete;
    this.close();
    onComplete?.();
  }

  cancel() {
    if (!this.isOpen) {
      return;
    }

    if (this.mode === 'quest') {
      this.chooseQuest(false);
      return;
    }

    this.close();
  }

  chooseQuest(accepted) {
    if (!this.isOpen || this.mode !== 'quest') {
      return;
    }

    const onChoice = this.onChoice;
    this.close();
    onChoice?.(accepted);
  }

  close() {
    this.isOpen = false;
    this.mode = null;
    this.onComplete = null;
    this.onChoice = null;
    this.background.setVisible(false);
    this.speaker.setVisible(false);
    this.message.setVisible(false);
    this.prompt.setVisible(false);
    this.continueButton.setVisible(false);
    this.acceptButton.setVisible(false);
    this.laterButton.setVisible(false);
  }

  open() {
    this.isOpen = true;
    this.background.setVisible(true);
    this.speaker.setVisible(true);
    this.message.setVisible(true);
    this.prompt.setVisible(true);
  }

  renderLine() {
    this.prompt.setPosition(58, 545).setOrigin(0, 0);
    this.speaker.setText(this.speakerName);
    this.message.setText(this.lines[this.lineIndex]);
    this.prompt.setText(
      this.lineIndex < this.lines.length - 1
        ? 'Klik på knappen for at fortsætte'
        : 'Klik på knappen for at lukke',
    );
    this.continueButton.setText(
      this.lineIndex < this.lines.length - 1 ? 'Næste' : 'Luk',
    );
  }
}
