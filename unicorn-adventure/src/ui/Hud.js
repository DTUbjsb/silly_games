export class Hud {
  constructor(scene) {
    this.label = scene.add.text(28, 22, 'ORDJAGT', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#476579',
      letterSpacing: 2,
    }).setScrollFactor(0).setDepth(5);

    this.progress = scene.add.text(750, 19, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#294c5b',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(5);

    this.collectionProgress = scene.add.text(750, 47, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#476579',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(5);

    this.turn = scene.add.text(400, 18, 'Indlæser tur...', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#294c5b',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5);

    this.swapButton = scene.add.text(400, 46, 'Skift tur  ·  T', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#4b5574',
      backgroundColor: '#ffffffcc',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5)
      .setInteractive({ useHandCursor: true });

    this.swapButton.on('pointerover', () => this.swapButton.setBackgroundColor('#fff2b3'));
    this.swapButton.on('pointerout', () => this.swapButton.setBackgroundColor('#ffffffcc'));
    this.swapButton.on('pointerdown', () => scene.swapLeader());
  }

  setProgress(learned, goal) {
    this.progress.setText(`✨  ${learned} / ${goal} udfordringer løst`);
  }

  setCollectionProgress(unicorns, unicornGoal, accessories, accessoryGoal) {
    this.collectionProgress.setText(
      `Enhjørninger ${unicorns}/${unicornGoal} · tilbehør ${accessories}/${accessoryGoal}`,
    );
  }

  setTurn(playerName) {
    this.turn.setText(`${playerName} har turen`);
  }
}
