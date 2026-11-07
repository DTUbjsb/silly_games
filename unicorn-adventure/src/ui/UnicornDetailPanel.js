import { PORTRAIT_UNICORN_SCALE, renderUnicornAccessories } from './UnicornAccessories.js';
import { ACCESSORY_CATEGORIES as CATEGORIES } from '../data/accessoryCategories.js';

const PAGE_SIZE = 3;

export class UnicornDetailPanel {
  constructor(scene, collection, onEquipmentChanged) {
    this.scene = scene;
    this.collection = collection;
    this.onEquipmentChanged = onEquipmentChanged;
    this.isOpen = false;
    const overlay = scene.add.rectangle(400, 300, 800, 600, 0x182b3b, 0.72)
      .setInteractive();
    const background = scene.add.rectangle(400, 300, 680, 550, 0xfffcf4)
      .setStrokeStyle(4, 0x9b83d5);
    this.title = scene.add.text(400, 66, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px',
      fontStyle: 'bold', color: '#294c5b',
    }).setOrigin(0.5);
    this.color = scene.add.text(400, 98, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#67539b',
    }).setOrigin(0.5);
    this.unicorn = scene.add.image(0, 0, 'unicorn-purple').setScale(PORTRAIT_UNICORN_SCALE);
    this.accessoryLayer = scene.add.container(0, 0);
    this.portrait = scene.add.container(400, 250, [this.unicorn, this.accessoryLayer]);
    this.categoryButtons = CATEGORIES.map((category, index) => (
      this.makeButton(190 + index * 140, 361, category.label, () => this.selectCategory(category.slot))
    ));
    this.inventory = scene.add.text(400, 396, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px',
      color: '#476579', align: 'center',
    }).setOrigin(0.5);
    this.buttons = Array.from({ length: PAGE_SIZE }, (_, index) => {
      const button = scene.add.text(400, 422 + index * 28, '', {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px',
        color: '#34526a', backgroundColor: '#e9f3ff', padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.toggle(index));
      return button;
    });
    this.previous = this.makeButton(190, 522, '◀ Forrige', () => this.changePage(-1));
    this.next = this.makeButton(610, 522, 'Næste ▶', () => this.changePage(1));
    this.status = scene.add.text(400, 505, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px',
      color: '#a33d43', align: 'center', wordWrap: { width: 520 },
    }).setOrigin(0.5);
    this.closeButton = this.makeButton(400, 548, 'Luk  ·  ESC', () => this.close());
    this.container = scene.add.container(0, 0, [
      overlay, background, this.title, this.color, this.portrait, ...this.categoryButtons, this.inventory,
      ...this.buttons, this.previous, this.next, this.status, this.closeButton,
    ]).setScrollFactor(0).setDepth(20).setVisible(false);
    // Phaser uses each interactive child's scroll factor for hit testing inside containers.
    this.container.list.forEach((child) => child.setScrollFactor(0));
  }

  makeButton(x, y, label, action) {
    return this.scene.add.text(x, y, label, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px',
      color: '#34526a', backgroundColor: '#e9f3ff', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', action);
  }

  show(unicorn, accessories) {
    this.isOpen = true;
    this.current = unicorn;
    this.accessories = accessories;
    this.category = CATEGORIES[0].slot;
    this.page = 0;
    this.status.setText('');
    this.title.setText(unicorn.name);
    this.color.setText(`Farve: ${unicorn.color}`);
    this.unicorn.setTexture(unicorn.texture);
    this.container.setVisible(true);
    this.render();
  }

  render() {
    renderUnicornAccessories(this.scene, this.accessoryLayer, this.current.id, this.accessories, this.collection);
    const category = CATEGORIES.find((item) => item.slot === this.category);
    const accessories = this.accessories.filter((item) => item.slot === this.category);
    this.categoryButtons.forEach((button, index) => {
      button.setStyle({
        backgroundColor: CATEGORIES[index].slot === this.category ? '#d5c6f2' : '#e9f3ff',
        fontStyle: CATEGORIES[index].slot === this.category ? 'bold' : 'normal',
      });
    });
    this.inventory.setText(accessories.length
      ? 'Vælg tilbehør for at sætte det på eller tage det af:'
      : category.empty);
    this.buttons.forEach((button, index) => {
      const accessory = accessories[this.page * PAGE_SIZE + index];
      button.setVisible(Boolean(accessory));
      if (!accessory) {
        return;
      }
      const ownerId = this.collection.getAccessoryOwner(accessory.id);
      const owner = this.collection.items.get(ownerId);
      const action = ownerId === this.current.id ? 'Tag af'
        : ownerId ? `Flyt fra ${owner?.name ?? 'en anden enhjørning'}`
          : 'Sæt på';
      button.setText(`${accessory.name} · ${action}`);
    });
    this.previous.setVisible(this.page > 0);
    this.next.setVisible((this.page + 1) * PAGE_SIZE < accessories.length);
  }

  toggle(index) {
    const accessory = this.accessories.filter((item) => item.slot === this.category)[this.page * PAGE_SIZE + index];
    if (!accessory) {
      return;
    }
    const attaching = this.collection.getAccessoryOwner(accessory.id) !== this.current.id;
    try {
      this.collection.toggleAccessory(this.current.id, accessory.id);
    } catch (error) {
      console.error('Kunne ikke ændre tilbehøret.', error);
      this.status.setText(`${error.message} Prøv igen.`);
      return;
    }
    if (attaching) {
      this.scene.registry.get('soundEffects').play('accessoryAttach');
    }
    this.status.setText('');
    this.render();
    this.onEquipmentChanged();
  }

  selectCategory(slot) {
    this.category = slot;
    this.page = 0;
    this.status.setText('');
    this.render();
  }

  changePage(direction) {
    this.page += direction;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.container.setVisible(false);
  }
}
