import { ACCESSORY_CATEGORIES } from '../data/accessoryCategories.js';
import { TOOL_CATEGORIES } from '../data/toolCategories.js';
import { UNICORN_CATEGORIES } from '../data/unicornCategories.js';

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
    const controls = makeElement('div', 'hud-controls', '');
    const location = makeElement('div', 'hud-location', '');
    this.label = makeElement('strong', 'hud-label', 'EVENTYR');
    this.resetButton = makeElement('button', 'hud-button hud-reset', 'Nulstil spil');
    this.resetButton.type = 'button';
    this.resetButton.addEventListener('click', () => scene.resetProgress());
    location.append(this.resetButton, this.label);

    const player = makeElement('div', 'hud-player', '');
    this.turn = makeElement('strong', 'hud-turn', 'Indlæser tur...');
    this.swapButton = makeElement('button', 'hud-button', 'Skift tur · T');
    this.swapButton.type = 'button';
    this.swapButton.addEventListener('click', () => scene.swapLeader());
    player.append(this.turn, this.swapButton);

    controls.append(location, player);
    const unicorns = makeElement('div', 'hud-unicorns', '');
    this.unicornCounters = new Map(UNICORN_CATEGORIES.map(({ id }) => {
      const counter = makeElement('strong', '', '');
      unicorns.append(counter);
      return [id, counter];
    }));
    const collection = makeElement('div', 'hud-collection', '');
    this.toolCounters = new Map(TOOL_CATEGORIES.map(({ kind }) => [kind, makeElement('strong', '', '')]));
    this.toolProgress = this.toolCounters.get('flashlight');
    this.collectionProgress = makeElement('div', 'hud-accessories', '');
    this.accessoryCounters = new Map(ACCESSORY_CATEGORIES.map(({ slot }) => {
      const counter = makeElement('span', '', '');
      this.collectionProgress.append(counter);
      return [slot, counter];
    }));
    collection.append(this.collectionProgress, ...this.toolCounters.values());
    this.element.append(controls, unicorns, collection);
    game.before(this.element);
    this.turnPopup = makeElement('div', 'turn-popup', '');
    this.turnPopup.setAttribute('role', 'status');
    this.turnPopup.setAttribute('aria-live', 'polite');
    this.turnPopup.hidden = true;
    game.append(this.turnPopup);

    this.boostBar = makeElement('div', 'boost-bar', '');
    this.boostBar.hidden = true;
    const boostTrack = makeElement('div', 'boost-track', '');
    boostTrack.setAttribute('role', 'progressbar');
    boostTrack.setAttribute('aria-label', 'Fartboost');
    boostTrack.setAttribute('aria-valuemin', '0');
    boostTrack.setAttribute('aria-valuemax', '100');
    this.boostTrack = boostTrack;
    this.boostFill = makeElement('div', 'boost-fill', '');
    this.boostLabel = makeElement('span', 'boost-label', '');
    boostTrack.append(this.boostFill, this.boostLabel);
    const boostMounts = makeElement('div', 'boost-mounts', '');
    this.boostMounts = [0, 1].map(() => {
      const image = document.createElement('img');
      boostMounts.append(image);
      return image;
    });
    this.boostBar.append(boostTrack, boostMounts);
    game.append(this.boostBar);

    const pause = () => {
      this.resetButton.disabled = true;
      this.swapButton.disabled = true;
      this.boostBar.hidden = true;
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
      this.boostBar.remove();
      this.element.remove();
    });
  }

  setCollectionProgress(collectedUnicorns, allUnicorns, collectedAccessories, allAccessories, collectedTools, allTools) {
    for (const { id, label, matches } of UNICORN_CATEGORIES) {
      const count = collectedUnicorns.filter(matches).length;
      const total = allUnicorns.filter(matches).length;
      this.unicornCounters.get(id).textContent = `${label}: ${count} / ${total}`;
    }
    for (const { kind, label } of TOOL_CATEGORIES) {
      const count = collectedTools.filter((item) => item.kind === kind).length;
      const total = allTools.filter((item) => item.kind === kind).length;
      this.toolCounters.get(kind).textContent = `${label}: ${count} / ${total}`;
    }
    for (const { slot, label } of ACCESSORY_CATEGORIES) {
      const count = collectedAccessories.filter((item) => item.slot === slot).length;
      const total = allAccessories.filter((item) => item.slot === slot).length;
      this.accessoryCounters.get(slot).textContent = `${label}: ${count} / ${total}`;
    }
  }

  setTurn(playerName) {
    this.turn.textContent = `${playerName} har turen`;
  }

  setBoostStatus(indicator) {
    this.boostBar.hidden = !indicator;
    if (!indicator) return;
    const { mounts, phase, progress, seconds, durationSeconds } = indicator;
    const label = phase === 'ready' ? `Klar · ${durationSeconds} sek. · MELLEMRUM`
      : phase === 'active' ? `Fartboost · ${seconds} / ${durationSeconds} sek.`
        : `Lader op: ${seconds} sek. · Boost: ${durationSeconds} sek.`;
    this.boostBar.dataset.phase = phase;
    this.boostFill.style.width = `${progress * 100}%`;
    this.boostLabel.textContent = label;
    this.boostTrack.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    this.boostTrack.setAttribute('aria-valuetext', label);
    mounts.forEach((mount, index) => {
      const image = this.boostMounts[index];
      if (image.dataset.texture !== mount.texture) {
        image.src = `src/assets/${mount.texture}.svg`;
        image.dataset.texture = mount.texture;
      }
      image.alt = mount.name;
    });
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
