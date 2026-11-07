import { LeaderFollowerSystem } from '../systems/LeaderFollowerSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { PlayerCharacter } from '../systems/PlayerCharacter.js';
import { UnicornDetailPanel } from '../ui/UnicornDetailPanel.js';
import { PORTRAIT_UNICORN_SCALE, renderUnicornAccessories } from '../ui/UnicornAccessories.js';

const COLUMNS = 4;
const ROW_SPACING = 190;
const EXIT = { x: 400, y: 105 };

export class StableScene extends Phaser.Scene {
  constructor() {
    super('StableScene');
  }

  create({ players, unicorns, accessories, collection }) {
    if (!Array.isArray(players) || players.length === 0 || !Array.isArray(unicorns) || !Array.isArray(accessories) || !collection) {
      throw new Error('Stalden mangler spillere eller samlingsdata.');
    }

    this.accessories = accessories;
    this.collection = collection;
    const height = Math.max(600, 300 + Math.ceil(unicorns.length / COLUMNS) * ROW_SPACING);
    this.physics.world.setBounds(0, 0, 800, height);
    this.cameras.main.setBounds(0, 0, 800, height);
    this.add.rectangle(400, height / 2, 800, height, 0xe9d2a8);
    const floor = this.add.graphics();
    floor.lineStyle(2, 0xcaa77a, 0.35);
    for (let y = 0; y < height; y += 40) {
      floor.lineBetween(0, y, 800, y);
    }
    this.add.rectangle(EXIT.x, EXIT.y, 150, 70, 0x9b704d)
      .setStrokeStyle(4, 0x765034);
    this.add.text(EXIT.x, EXIT.y, 'UDGANG', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px',
      fontStyle: 'bold', color: '#fff8df',
    }).setOrigin(0.5);

    this.unicorns = unicorns.map((unicorn, index) => {
      const x = 130 + (index % COLUMNS) * 180;
      const y = 330 + Math.floor(index / COLUMNS) * ROW_SPACING;
      this.add.rectangle(x, y, 142, 125, 0xfff3d9, 0.8)
        .setStrokeStyle(3, 0xc49b70);
      const sprite = this.add.image(x, y, unicorn.texture).setScale(0.7).setDepth(2);
      const accessoryLayer = this.add.container(x, y)
        .setScale(sprite.scaleX / PORTRAIT_UNICORN_SCALE).setDepth(3);
      renderUnicornAccessories(this, accessoryLayer, unicorn.id, accessories, collection);
      this.add.text(x, y - 70, unicorn.name, {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px',
        fontStyle: 'bold', color: '#594e59', backgroundColor: '#fff8e9',
        padding: { x: 5, y: 3 },
      }).setOrigin(0.5);
      return { ...unicorn, sprite, accessoryLayer };
    });

    this.players = players.map((player, index) => new PlayerCharacter(this, {
      ...player, x: 400 - index * 75, y: 195,
    }));
    this.followers = new LeaderFollowerSystem(this.players, { spacing: 75 });
    const world = this.scene.get('MainWorldScene');
    if (world.leaderFollowerSystem.companions.some((companion) => companion.id === 'volcano-cat')) {
      const sprite = this.physics.add.image(250, 195, 'red-cat').setScale(0.72).setDepth(2);
      sprite.body.setCollideWorldBounds(true);
      this.followers.addCompanion({ id: 'volcano-cat', sprite });
    }
    this.movement = new MovementSystem(this, this.followers.leader.sprite);
    this.cameras.main.startFollow(this.followers.leader.sprite, true, 0.12, 0.12);
    this.scene.get('MainWorldScene').hud.setLocation(true);
    this.prompt = this.add.text(400, 550, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#294c5b',
      backgroundColor: '#fff8e9', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5);
    if (unicorns.length === 0) {
      this.add.text(400, 330, 'Stalden er tom. Find en enhjørning i verden!', {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#654961',
      }).setOrigin(0.5);
    }
    this.detailPanel = new UnicornDetailPanel(this, collection, () => this.updateAccessories());
    this.input.keyboard.on('keydown-SPACE', this.interact, this);
    this.input.keyboard.on('keydown-ESC', this.closeDetails, this);
    this.input.keyboard.on('keydown-T', this.swapLeader, this);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown-SPACE', this.interact, this);
      this.input.keyboard.off('keydown-ESC', this.closeDetails, this);
      this.input.keyboard.off('keydown-T', this.swapLeader, this);
    });
  }

  updateAccessories() {
    for (const unicorn of this.unicorns) {
      renderUnicornAccessories(this, unicorn.accessoryLayer, unicorn.id, this.accessories, this.collection);
    }
  }

  update(time, delta) {
    const leader = this.followers.leader;
    if (this.detailPanel.isOpen) {
      leader.sprite.setVelocity(0, 0);
    } else {
      this.movement.update();
    }
    this.followers.update(delta);
    if (this.followers.companions.length && !this.detailPanel.isOpen) {
      this.scene.get('MainWorldScene').updateCatMeow(delta);
    }
    this.players.forEach((player) => player.updateNameTag());
    const nearest = this.getNearbyTarget();
    this.prompt.setText(this.detailPanel.isOpen ? '' : nearest?.label ?? '');
  }

  getNearbyTarget() {
    const { x, y } = this.followers.leader.sprite;
    const targets = [
      { x: EXIT.x, y: EXIT.y, label: 'Tryk MELLEMRUM for at gå ud', exit: true },
      ...this.unicorns.map((unicorn) => ({
        x: unicorn.sprite.x, y: unicorn.sprite.y,
        label: `Tryk MELLEMRUM for at se ${unicorn.name}`, unicorn,
      })),
    ];
    return targets.map((target) => ({
      ...target, distance: Phaser.Math.Distance.Between(x, y, target.x, target.y),
    })).filter((target) => target.distance <= 90)
      .sort((a, b) => a.distance - b.distance)[0];
  }

  interact(event) {
    if (event.repeat || this.detailPanel.isOpen) {
      return;
    }
    const target = this.getNearbyTarget();
    if (target?.exit) {
      const world = this.scene.get('MainWorldScene');
      world.setLeader(this.followers.leader.id);
      this.scene.stop();
      this.scene.resume('MainWorldScene');
    } else if (target?.unicorn) {
      this.followers.leader.sprite.setVelocity(0, 0);
      this.registry.get('soundEffects').play('unicorn');
      this.detailPanel.show(target.unicorn, this.accessories);
    }
  }

  closeDetails() {
    this.detailPanel.close();
  }

  swapLeader() {
    if (this.detailPanel.isOpen) {
      return;
    }
    const leader = this.followers.swapLeader();
    if (leader) {
      this.movement.setPlayer(leader.sprite);
      this.cameras.main.startFollow(leader.sprite, true, 0.12, 0.12);
      const hud = this.scene.get('MainWorldScene').hud;
      hud.setTurn(leader.name);
      hud.showTurnChange(leader.name);
    }
  }
}
