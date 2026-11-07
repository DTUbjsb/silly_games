import { ACCESSORY_CATEGORIES } from '../data/accessoryCategories.js';

export class Hud {
  constructor(scene) {
    const game = scene.game.canvas.parentElement;
    this.element = document.createElement('div');
    this.element.className = 'game-hud';
    for (const type of ['keydown', 'keyup']) {
      this.element.addEventListener(type, (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.stopPropagation();
        }
      });
    }

    const makeElement = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      if (tag === 'button') {
        element.addEventListener('pointerdown', (event) => {
          if (event.pointerType === 'mouse') {
            event.preventDefault();
          }
        });
      }
      return element;
    };
    const location = makeElement('div', 'hud-location', '');
    this.label = makeElement('strong', 'hud-label', 'EVENTYR');
    this.resetButton = makeElement('button', 'hud-button hud-reset', 'Nulstil spil');
    this.resetButton.type = 'button';
    this.resetButton.addEventListener('click', () => scene.resetProgress());
    location.append(this.label, this.resetButton);

    const player = makeElement('div', 'hud-player', '');
    this.turn = makeElement('strong', 'hud-turn', 'Indlæser tur...');
    this.swapButton = makeElement('button', 'hud-button', 'Skift tur · T');
    this.swapButton.type = 'button';
    this.swapButton.addEventListener('click', () => scene.swapLeader());
    player.append(this.turn, this.swapButton);

    const collection = makeElement('div', 'hud-collection', '');
    this.progress = makeElement('strong', '', '');
    this.collectionProgress = makeElement('div', 'hud-accessories', '');
    this.accessoryCounters = new Map(ACCESSORY_CATEGORIES.map(({ slot }) => {
      const counter = makeElement('span', '', '');
      this.collectionProgress.append(counter);
      return [slot, counter];
    }));
    collection.append(this.progress, this.collectionProgress);
    this.element.append(location, player, collection);
    game.before(this.element);
    this.turnPopup = makeElement('div', 'turn-popup', '');
    this.turnPopup.setAttribute('role', 'status');
    this.turnPopup.setAttribute('aria-live', 'polite');
    this.turnPopup.hidden = true;
    game.append(this.turnPopup);

    const pause = () => {
      this.resetButton.disabled = true;
      this.swapButton.disabled = true;
    };
    const resume = () => {
      this.resetButton.disabled = false;
      this.swapButton.disabled = false;
      this.setLocation(false);
    };
    scene.events.on('pause', pause);
    scene.events.on('resume', resume);
    scene.events.once('shutdown', () => {
      scene.events.off('pause', pause);
      scene.events.off('resume', resume);
      clearTimeout(this.turnPopupTimer);
      this.turnPopup.remove();
      this.element.remove();
    });
  }

  setCollectionProgress(unicorns, unicornGoal, collectedAccessories, allAccessories) {
    this.progress.textContent = `Enhjørninger: ${unicorns} / ${unicornGoal}`;
    for (const { slot, label } of ACCESSORY_CATEGORIES) {
      const count = collectedAccessories.filter((item) => item.slot === slot).length;
      const total = allAccessories.filter((item) => item.slot === slot).length;
      this.accessoryCounters.get(slot).textContent = `${label}: ${count} / ${total}`;
    }
  }

  setTurn(playerName) {
    this.turn.textContent = `${playerName} har turen`;
  }

  showTurnChange(playerName) {
    clearTimeout(this.turnPopupTimer);
    this.turnPopup.textContent = `Nu er det ${playerName}s tur!`;
    this.turnPopup.hidden = false;
    this.turnPopupTimer = setTimeout(() => {
      this.turnPopup.hidden = true;
    }, 2500);
  }

  setLocation(inStable) {
    this.label.textContent = inStable ? 'ENHJØRNINGESTALDEN' : 'EVENTYR';
  }
}
