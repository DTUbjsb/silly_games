import { createGameConfig } from '../src/config.js';
import { TEST_WORLD_DATA, WORLD_GATES, WORLD_TILE, WEST_CRACK, WEST_REGION_DATA, WEST_REGION_WIDTH,
  NORTH_HOLE, NORTH_REGION_DATA, NORTH_REGION_HEIGHT, EAST_ORIGIN, EAST_REGION_DATA, EAST_REGION_WIDTH, LAKE,
  SOUTH_ORIGIN, SOUTH_PASS, SOUTH_REGION_DATA, DRAGON_DEN } from '../src/data/testWorld.js';
import { CollectionStore } from '../src/managers/CollectionStore.js';
import { GameStateManager } from '../src/managers/GameStateManager.js';
import { SoundEffects } from '../src/audio/SoundEffects.js';
import { arrangeCollectibles } from '../src/data/collectibleLayout.js';
import { mazePath, MAZE_LAYOUTS } from '../src/scenes/WitchMazeScene.js';
import { CatMazeScene } from '../src/scenes/CatMazeScene.js';
import { minigameSpeed } from '../src/systems/MinigameDifficulty.js';
import { NorthFollowerNavigator } from '../src/systems/NorthFollowerNavigator.js';
import { wizardTeam } from '../src/systems/WizardTeam.js';
import { UnicornSpeedBoost } from '../src/systems/UnicornSpeedBoost.js';
import { guideLines } from '../src/systems/GuideGnomes.js';

import { assert, reachable, canReach, reachableWest, canReachWest, reachableNorth, canReachNorth, reachableVolcano, canReachVolcano, waitForWorld, waitForStable, collect, assertUnicornCounters, assertAccessoryCounters, clickCanvas } from './test-support.js';
import { testSpeedBoostRules, testGuideGnomes, testWorldBoost, testSoundSynthesis, testRandomLayouts } from './suites/systems-and-data.js';
import { testMap, testWestCrack, testWestPhysicalCollision, testNorthFollowerAndMusic, testWorldMusicPause, testGateInteractions, testOpenWestGates, testMovementAndProximitySounds } from './suites/world-navigation.js';
import { testCatMazeLayouts, testVolcano, testVolcanoCat, testWitchEncounter, testNorthCave, testLavaBootPickups, testLakeBoat, testFlight } from './suites/region-challenges.js';
import { testDragonBattle, testWarriorPrincess, testOldQueen, testSouthWizard, testFairyShooter, testTrollGame } from './suites/story-battles.js';
import { testUnicornCounters, testHudLayout, testCollection, testChallenges, testFairyQuestionSelection, testInteractionSounds, testWeightedTurnCounts, testBeginnerReadingScene, testAutomaticTurns, testPanelPointerInput } from './suites/collection-and-ui.js';

export async function run() {
  await testSoundSynthesis();
  await testRandomLayouts();
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = new CollectionStore(storage);
  const invalidStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":["same","same"]}',
  });
  let invalidRejected = false;
  try {
    invalidStore.load();
  } catch (error) {
    invalidRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidRejected, 'Invalid saved data was accepted.');
  const legacyStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":["unicorn-solstraale"]}',
  });
  assert(legacyStore.loadState().collectedIds.has('unicorn-solstraale')
    && legacyStore.loadState().equipment.size === 0 && legacyStore.loadState().layoutSeed === null,
  'Legacy collection was not migrated.');
  let legacyRaw = '{"version":1,"collectedIds":["unicorn-solstraale","accessory-crown"],'
    + '"equipment":[["accessory-crown","unicorn-solstraale"]]}';
  const writableLegacyStore = new CollectionStore({
    getItem: () => legacyRaw,
    setItem: (key, value) => { legacyRaw = value; },
  });
  const legacyState = writableLegacyStore.loadState();
  legacyState.collectedIds.add('accessory-heart');
  writableLegacyStore.save(legacyState.collectedIds, legacyState.equipment);
  assert(writableLegacyStore.loadState().layoutSeed === null
    && writableLegacyStore.loadState().collectedIds.has('accessory-heart')
    && writableLegacyStore.loadState().equipment.get('accessory-crown') === 'unicorn-solstraale',
  'Saving a legacy collection changed its layout or lost progress.');
  const invalidSeedStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"layoutSeed":-1}',
  });
  let invalidSeedRejected = false;
  try {
    invalidSeedStore.loadState();
  } catch (error) {
    invalidSeedRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidSeedRejected, 'Invalid layout seed was accepted.');
  const invalidGateStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"unlockedGates":["unknown"]}',
  });
  let invalidGateRejected = false;
  try {
    invalidGateStore.loadState();
  } catch (error) {
    invalidGateRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidGateRejected, 'Invalid saved gate was accepted.');
  const invalidRewardStore = new CollectionStore({
    getItem: () => '{"version":1,"collectedIds":[],"unlockedRewards":["unknown"]}',
  });
  let invalidRewardRejected = false;
  try {
    invalidRewardStore.loadState();
  } catch (error) {
    invalidRewardRejected = error.message.includes('ugyldigt format');
  }
  assert(invalidRewardRejected, 'Invalid saved reward was accepted.');
  const failingStore = new CollectionStore({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  });
  const failingWriteStore = new CollectionStore({
    getItem: storage.getItem,
    setItem: () => { throw new Error('blocked'); },
  });
  for (const action of [() => failingStore.load(), () => failingStore.save(new Set())]) {
    let failed = false;
    try {
      action();
    } catch (error) {
      failed = error.message.includes('browserens lager');
    }
    assert(failed, 'Storage failure was not reported.');
  }
  const game = new Phaser.Game(createGameConfig());
  game.registry.set('collectionStore', store);
  let scene = await waitForWorld(game);
  testSpeedBoostRules();
  testGuideGnomes(scene);
  await testWorldBoost(scene);
  const firstSeed = store.loadState().layoutSeed;
  const firstLayout = JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y]));
  assert(Number.isInteger(firstSeed), 'A fresh game did not persist its layout seed.');
  assertAccessoryCounters(scene);
  assertUnicornCounters(scene);
  testUnicornCounters(scene);
  testHudLayout(scene);
  assert(scene.cameras.main.zoom === 0.65 && scene.movement.speed === 242,
    'World zoom or movement speed is incorrect.');
  scene.movement.keys.D.isDown = true;
  scene.movement.update();
  assert(scene.player.sprite.body.velocity.x === 242 && scene.player.sprite.body.velocity.y === 0,
    'Straight movement velocity is incorrect.');
  scene.movement.keys.S.isDown = true;
  scene.movement.update();
  assert(Math.abs(scene.player.sprite.body.velocity.length() - 242) < 0.01,
    'Diagonal movement does not preserve speed.');
  scene.movement.keys.D.isDown = false;
  scene.movement.keys.S.isDown = false;
  scene.movement.update();
  const hudBounds = scene.hud.element.getBoundingClientRect();
  const canvasBounds = game.canvas.getBoundingClientRect();
  assert(hudBounds.bottom <= canvasBounds.top && !game.canvas.parentElement.contains(scene.hud.element),
    'Permanent HUD overlaps the map.');
  const firstLeader = scene.leaderFollowerSystem.leader.id;
  scene.hud.swapButton.click();
  assert(scene.leaderFollowerSystem.leader.id !== firstLeader, 'HUD turn button did not switch players.');
  scene.hud.swapButton.click();
  assert(scene.leaderFollowerSystem.leader.id === firstLeader, 'HUD turn button did not switch back.');
  let leakedKey = false;
  const detectKey = () => { leakedKey = true; };
  window.addEventListener('keydown', detectKey);
  scene.hud.swapButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  window.removeEventListener('keydown', detectKey);
  assert(!leakedKey, 'Activating a focused HUD button can also trigger a game interaction.');
  testWeightedTurnCounts();
  testChallenges(scene);
  testFairyQuestionSelection(scene);
  testInteractionSounds(scene);
  testMovementAndProximitySounds(scene);
  scene.dialogueWindow.showLines('Prøve', ['Første linje', 'Anden linje']);
  await new Promise((resolve) => scene.events.once('postupdate', resolve));
  game.scale.updateBounds();
  await clickCanvas(game, 710, 540);
  assert(scene.dialogueWindow.message.text === 'Anden linje', 'Dialogue button missed after changing zoom.');
  await clickCanvas(game, 710, 540);
  assert(!scene.dialogueWindow.isOpen, 'Dialogue button did not close after changing zoom.');
  await testBeginnerReadingScene(scene);
  testMap(scene);
  testOldQueen(scene);
  await testVolcanoCat(scene);
  await testWarriorPrincess(scene);
  await testDragonBattle(scene);
  await testLavaBootPickups(scene);
  await testVolcano(scene);
  testNorthFollowerAndMusic(scene);
  await testWorldMusicPause(scene);
  await testSouthWizard(scene);
  await testLakeBoat(scene);
  await testNorthCave(scene);
  await testWitchEncounter(scene);
  await testWestCrack(scene);
  await testFlight(scene);
  await testWestPhysicalCollision(scene);
  testGateInteractions(scene);
  await testOpenWestGates(scene);
  const firstPickup = scene.collectibleManager.pickups.getChildren()[0];
  scene.collectibleManager.store = failingWriteStore;
  let writeFailed = false;
  try {
    scene.collectibleManager.collect(firstPickup);
  } catch (error) {
    writeFailed = error.message.includes('browserens lager');
  }
  assert(writeFailed && firstPickup.active && scene.collectibleManager.collectedIds.size === 0,
    'A failed save changed the collection or destroyed the pickup.');
  scene.collectibleManager.store = store;
  testCollection(scene, 'unicorn', 'accessory');
  const flashlightPickup = scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'flashlight');
  scene.collectPickup(flashlightPickup);
  const bootsPickup = scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'lava-boots-1');
  scene.collectWorldItem(scene.player.sprite, bootsPickup);
  assert(scene.hud.toolCounters.get('lava-boots').textContent.includes('1 / 2')
    && new CollectionStore(storage).load().size === 8, 'Tool pickup was not counted or saved.');

  let previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(store.loadState().layoutSeed === firstSeed
    && JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y])) === firstLayout,
  'Collection or reload changed the layout.');
  assertAccessoryCounters(scene);
  assert(scene.collectibleManager.getCollectedItems('unicorn').length === 3, 'Unicorns were not restored.');
  assert(scene.collectibleManager.getCollectedItems('accessory').length === 3, 'Accessories were not restored.');
  assert(scene.collectibleManager.pickups.getChildren().length === 70
    && scene.collectibleManager.collectedIds.has('flashlight') && scene.hud.toolProgress.textContent.includes('1 / 1')
    && scene.collectibleManager.collectedIds.has('lava-boots-1')
    && scene.hud.toolCounters.get('lava-boots').textContent.includes('1 / 2'),
  'Tools or other pickups were not restored correctly after reload.');
  scene.collectibleManager.collectedIds.delete('flashlight');
  scene.collectibleManager.collectedIds.delete('lava-boots-1');
  store.save(scene.collectibleManager.collectedIds, scene.collectibleManager.equipment);
  scene.collectibleManager.createPickup(scene.collectibleManager.items.get('flashlight'));
  scene.collectibleManager.createPickup(scene.collectibleManager.items.get('lava-boots-1'));
  scene.updateCollectionProgress();
  assert(scene.sys.isActive(), 'A saved collection interrupted the adventure.');
  assert(scene.collectibleManager.getCollectedItems('unicorn').every((unicorn) => unicorn.color), 'Unicorn colors were not restored.');
  assert(scene.worldMap.getTileAt(64, 16).collides, 'Flora gate did not reset.');
  assert(scene.worldMap.getTileAt(68, 52).collides, 'Luna gate did not reset.');
  assert(scene.worldMap.getTileAt(31, 32).collides, 'Bridge did not reset.');
  assert(scene.worldMap.getTileAt(93, 64).collides, 'Second bridge did not reset.');
  assert(scene.westMap.getTileAt(23, 52).collides && scene.westMap.getTileAt(16, 27).collides,
    'Western gates did not reset.');

  scene.enterStable();
  let stable = await waitForStable(game, 3);
  assert(stable.sys.isActive() && stable.unicorns.length === 3, 'Stable did not show saved unicorns.');
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const originalPosition = { x: stable.followers.leader.sprite.x, y: stable.followers.leader.sprite.y };
  stable.followers.leader.sprite.setPosition(stable.unicorns[0].sprite.x, stable.unicorns[0].sprite.y);
  stable.interact({ repeat: false });
  assert(stable.detailPanel.isOpen && heard.join(',') === 'unicorn',
    'Stable unicorn interaction did not play a gallop.');
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(originalPosition.x, originalPosition.y);
  sounds.play = originalPlay;
  assert(stable.movement.speed === 242 && scene.hud.label.textContent === 'ENHJØRNINGESTALDEN'
    && scene.hud.resetButton.disabled && scene.hud.swapButton.disabled,
  'Stable movement or HUD state is incorrect.');
  stable.swapLeader();
  assert(scene.hud.turn.textContent === `${stable.followers.leader.name} har turen`,
    'HUD did not update when switching players in the stable.');
  stable.swapLeader();
  stable.detailPanel.show(stable.unicorns[1], stable.accessories);
  assert(stable.detailPanel.unicorn.texture.key === stable.unicorns[1].texture, 'Portrait color differs from unicorn.');
  assert(stable.detailPanel.color.text.includes(stable.unicorns[1].color), 'Portrait color label is incorrect.');
  stable.detailPanel.selectCategory('wings');
  assert(stable.detailPanel.inventory.text.includes('ikke samlet vinger')
    && stable.detailPanel.buttons.every((button) => !button.visible)
    && !stable.detailPanel.next.visible && !stable.detailPanel.previous.visible,
  'Empty category did not display its message or hide choices.');
  for (const slot of ['crown', 'saddle', 'sticker']) {
    stable.detailPanel.selectCategory(slot);
    stable.detailPanel.toggle(0);
  }
  assert(stable.detailPanel.accessoryLayer.length === 3, 'Equipped accessories are not rendered.');
  assert(stable.unicorns[1].accessoryLayer.length === 3
    && stable.unicorns[0].accessoryLayer.length === 0,
  'Equipped accessories did not appear on the correct stable unicorn.');
  for (const portraitItem of stable.detailPanel.accessoryLayer.list) {
    const stableItem = stable.unicorns[1].accessoryLayer.list
      .find((item) => item.texture.key === portraitItem.texture.key);
    assert(stableItem && stableItem.x === portraitItem.x && stableItem.y === portraitItem.y
      && stableItem.scaleX === portraitItem.scaleX,
    'Stable accessory placement differs from the portrait.');
  }
  assert(stable.unicorns[1].accessoryLayer.scaleX === stable.unicorns[1].sprite.scaleX / 2.1,
    'Stable accessories do not scale with the unicorn.');
  const crown = stable.accessories.find((item) => item.slot === 'crown');
  const originalOwner = stable.unicorns[1].id;
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === originalOwner, 'Crown was not equipped.');
  assert(stable.detailPanel.accessoryLayer.list.some((image) => (
    image.texture.key === 'accessory-star-sticker' && image.x < 0
  )), 'Star sticker is not positioned on the rear.');
  stable.detailPanel.show(stable.unicorns[0], stable.accessories);
  stable.detailPanel.selectCategory('crown');
  const crownIndex = stable.accessories.filter((item) => item.slot === 'crown')
    .findIndex((item) => item.id === crown.id);
  assert(stable.detailPanel.buttons[crownIndex].text.includes('Flyt fra'), 'Transfer is not explained.');
  heard.length = 0;
  sounds.play = (name) => heard.push(name);
  stable.detailPanel.toggle(crownIndex);
  assert(heard.join(',') === 'accessoryAttach', 'Transferring an accessory did not play the attachment sound.');
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === stable.unicorns[0].id, 'Crown did not transfer.');
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture)
    && !stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
  'Crown transfer did not update both stable unicorns.');
  assert(store.loadState().equipment.get(crown.id) === stable.unicorns[0].id, 'Crown assignment was not saved.');
  stable.detailPanel.toggle(crownIndex);
  assert(heard.length === 1, 'Removing an accessory played an attachment sound.');
  assert(!scene.collectibleManager.getAccessoryOwner(crown.id), 'Crown was not removed.');
  assert(!stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
    'Removed crown remained visible in the stable.');
  stable.detailPanel.toggle(crownIndex);
  assert(heard.join(',') === 'accessoryAttach,accessoryAttach', 'Attaching an accessory did not play a sound.');
  scene.collectibleManager.store = failingStore;
  stable.detailPanel.toggle(crownIndex);
  assert(heard.length === 2, 'A failed equipment save played an attachment sound.');
  sounds.play = originalPlay;
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === stable.unicorns[0].id
    && stable.detailPanel.status.text.includes('browserens lager'), 'Save failure did not preserve equipment or notify.');
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture),
    'Failed save changed the stable appearance.');
  scene.collectibleManager.store = store;
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(scene.sys.isActive(), 'Leaving the stable did not resume the world.');
  assert(scene.hud.label.textContent === 'EVENTYR' && !scene.hud.resetButton.disabled
    && !scene.hud.swapButton.disabled, 'World HUD did not resume after leaving the stable.');

  const savedUnicorns = scene.collectibleManager.getCollectedItems('unicorn');
  const many = Array.from({ length: 25 }, (_, index) => ({
    ...savedUnicorns[index % savedUnicorns.length], id: `test-${index}`,
  }));
  scene.scene.launch('StableScene', {
    players: scene.leaderFollowerSystem.players.map((p) => ({
      id: p.id, name: p.name, age: p.age, avatar: p.avatar, hairColor: p.hairColor,
    })),
    unicorns: many,
    accessories: [],
    collection: scene.collectibleManager,
  });
  scene.scene.pause();
  stable = await waitForStable(game, 25);
  assert(stable.unicorns.length === 25, 'Stable dropped unicorns in a larger collection.');
  assert(stable.unicorns[24].sprite.y < stable.physics.world.bounds.height, 'Stable did not grow for more unicorns.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));

  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.collectibleManager.getAccessoryOwner(crown.id) === savedUnicorns[0].id, 'Equipment was not restored.');
  assert(scene.collectibleManager.getAccessoryOwner('accessory-saddle') === savedUnicorns[1].id
    && scene.collectibleManager.getAccessoryOwner('accessory-star-sticker') === savedUnicorns[1].id,
  'Other accessories were not restored with their unicorn.');
  scene.enterStable();
  stable = await waitForStable(game, 3);
  assert(stable.unicorns[0].accessoryLayer.list.some((item) => item.texture.key === crown.texture)
    && stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === 'saddle-worn-pink')
    && stable.unicorns[1].accessoryLayer.list.some((item) => item.texture.key === 'accessory-star-sticker'),
  'Saved equipment was not visible after reopening the stable.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));

  store.save(new Set(), new Map());
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  testCollection(scene, 'accessory', 'unicorn');
  collect(scene, 'unicorn', 12);
  collect(scene, 'accessory', 57);
  assert(scene.sys.isActive() && scene.collectibleManager.getCollectedCount('unicorn') === 15
    && scene.collectibleManager.getCollectedCount('accessory') === 60,
  'Additional collectibles were not obtainable.');
  const grass = scene.collectibleManager.getCollectedItems('unicorn').find((item) => item.name === 'Græs');
  assert(grass?.color === 'Grøn' && grass.texture === 'unicorn-green', 'Græs has the wrong appearance.');
  scene.enterStable();
  stable = await waitForStable(game, 15);
  assert(stable.unicorns.length === 15 && stable.accessories.length === 60, 'Stable does not show the full collection.');
  for (const unicorn of stable.unicorns) {
    const nameplate = stable.children.list.find((child) => (
      typeof child.text === 'string' && child.x === unicorn.sprite.x && child.y === unicorn.sprite.y - 70
    ));
    assert(nameplate?.text === unicorn.name, `${unicorn.name}'s stable nameplate should show only its name.`);
  }
  stable.detailPanel.show(stable.unicorns.find((unicorn) => unicorn.id === grass.id), stable.accessories);
  for (let index = 0; index < stable.accessories.length; index += 1) {
    const accessory = stable.accessories[index];
    stable.detailPanel.selectCategory(accessory.slot);
    const categoryIndex = stable.accessories.filter((item) => item.slot === accessory.slot)
      .findIndex((item) => item.id === accessory.id);
    stable.detailPanel.page = Math.floor(categoryIndex / 3);
    stable.detailPanel.render();
    stable.detailPanel.toggle(categoryIndex % 3);
    const expectedTexture = accessory.wornTexture
      ?? (accessory.slot === 'saddle' ? 'saddle-worn-pink' : accessory.texture);
    assert(stable.detailPanel.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} uses the wrong worn image.`);
    const stableUnicorn = stable.unicorns.find((unicorn) => unicorn.id === grass.id);
    assert(stableUnicorn.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} is not visible on the stable unicorn.`);
    if (['accessory-alvina-hat', 'accessory-ellie-hat'].includes(accessory.id)) {
      assert(stable.detailPanel.accessoryLayer.list.some((image) => (
        image.texture.key === expectedTexture && image.scaleX === 0.9
      )), `${accessory.name} is not rendered as a large hat.`);
    }
    assert(scene.collectibleManager.getAccessoryOwner(accessory.id) === grass.id,
      `${accessory.name} was not equipped.`);
    stable.detailPanel.toggle(categoryIndex % 3);
    assert(!stableUnicorn.accessoryLayer.list.some((image) => image.texture.key === expectedTexture),
      `${accessory.name} remained visible after removal.`);
  }
  assert(stable.detailPanel.page === 4 && !stable.detailPanel.next.visible && stable.detailPanel.previous.visible,
    'Accessory pagination does not reach the last page.');
  scene.collectibleManager.toggleAccessory(grass.id, 'accessory-saddle-blue');
  scene.collectibleManager.toggleAccessory(grass.id, 'accessory-saddle-green');
  assert(!scene.collectibleManager.getAccessoryOwner('accessory-saddle-blue')
    && scene.collectibleManager.getAccessoryOwner('accessory-saddle-green') === grass.id,
  'Equipping a different saddle did not replace the previous saddle.');
  scene.collectibleManager.toggleAccessory(savedUnicorns[0].id, 'accessory-saddle-green');
  assert(scene.collectibleManager.getAccessoryOwner('accessory-saddle-green') === savedUnicorns[0].id
    && store.loadState().equipment.get('accessory-saddle-green') === savedUnicorns[0].id,
  'Moving a new accessory between unicorns was not saved.');
  await testPanelPointerInput(stable, stable.unicorns.find((unicorn) => unicorn.id === grass.id));
  const slots = ['crown', 'saddle', 'sticker', 'wings'];
  for (const [unicornIndex, unicorn] of stable.unicorns.entries()) {
    stable.detailPanel.show(unicorn, stable.accessories);
    for (const slot of slots) {
      const accessory = stable.accessories.filter((item) => item.slot === slot)[unicornIndex];
      const index = stable.accessories.filter((item) => item.slot === slot).findIndex((item) => item.id === accessory.id);
      stable.detailPanel.selectCategory(slot);
      stable.detailPanel.page = Math.floor(index / 3);
      stable.detailPanel.render();
      if (scene.collectibleManager.getAccessoryOwner(accessory.id) !== unicorn.id) {
        stable.detailPanel.toggle(index % 3);
      }
      assert(scene.collectibleManager.getAccessoryOwner(accessory.id) === unicorn.id,
        `${unicorn.name} did not receive ${accessory.name}.`);
    }
    assert(unicorn.accessoryLayer.length === 4 && stable.detailPanel.accessoryLayer.length === 4
      && (unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-wings-')
        || (unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-dark-')
          || unicorn.accessoryLayer.list[0].texture.key.startsWith('accessory-volcano-'))
          && unicorn.accessoryLayer.list[0].texture.key.endsWith('-wings')),
    `${unicorn.name} cannot wear all four slots or wings are above other accessories.`);
  }
  const firstWing = stable.accessories.find((item) => item.slot === 'wings');
  const secondWing = stable.accessories.filter((item) => item.slot === 'wings')[1];
  const wingIndex = stable.accessories.filter((item) => item.slot === 'wings').findIndex((item) => item.id === firstWing.id);
  stable.detailPanel.show(stable.unicorns[1], stable.accessories);
  stable.detailPanel.selectCategory('wings');
  stable.detailPanel.page = Math.floor(wingIndex / 3);
  stable.detailPanel.render();
  stable.detailPanel.toggle(wingIndex % 3);
  assert(scene.collectibleManager.getAccessoryOwner(firstWing.id) === stable.unicorns[1].id
    && !scene.collectibleManager.getAccessoryOwner(secondWing.id)
    && !stable.unicorns[0].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && stable.unicorns[1].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && store.loadState().equipment.get(firstWing.id) === stable.unicorns[1].id,
  'Transferring wings did not replace, update, and save both unicorns.');
  stable.detailPanel.close();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(scene.sys.isActive(), 'Leaving the stable after pointer interactions did not resume the world.');
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.collectibleManager.getCollectedCount('unicorn') === 15
    && scene.collectibleManager.getCollectedCount('accessory') === 60
    && Array.from(scene.hud.unicornCounters.values()).every((counter) => {
      const [count, total] = counter.textContent.split(': ')[1].split(' / ');
      return count === total;
    })
    && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('15 / 15'))
    && !scene.ui.list.some((object) => object.text === 'Fortsæt eventyret'),
  'Reloading a full collection interrupted play or lost progress.');
  assertAccessoryCounters(scene);
  scene.enterStable();
  stable = await waitForStable(game, 15);
  assert(stable.accessories.length === 60, 'Stable is inaccessible after reloading the full collection.');
  assert(stable.unicorns[1].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture)
    && stable.unicorns[1].accessoryLayer.length === 4
    && !stable.unicorns[0].accessoryLayer.list.some((image) => image.texture.key === firstWing.texture),
  'Transferred wings or other equipment did not survive reloading.');
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  scene.collectPickup(scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'flashlight'));
  for (const id of ['lava-boots-1', 'lava-boots-2']) {
    scene.collectPickup(scene.collectibleManager.pickups.getChildren().find((pickup) => pickup.getData('collectibleId') === id));
  }
  assert(scene.hud.toolProgress.textContent.includes('1 / 1')
    && scene.hud.toolCounters.get('lava-boots').textContent.includes('2 / 2'), 'Tools were not present before reset.');
  scene.openGate('flora');
  assert(scene.unlockSouthPass(), 'Could not save an unlocked southern gate.');
  scene.collectibleManager.unlockReward('princess-bows');
  scene.collectPickup(scene.collectibleManager.pickups.getChildren()
    .find((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-1'));
  const rescueState = store.loadState();
  rescueState.unlockedGates.add('dragon');
  store.save(rescueState.collectedIds, rescueState.equipment, rescueState.layoutSeed,
    rescueState.unlockedGates, rescueState.unlockedRewards);
  previousManager = scene.collectibleManager;
  scene.scene.restart();
  scene = await waitForWorld(game, previousManager);
  assert(scene.southOpen && !scene.southWizard.visible && !scene.southMap.getTileAt(64, 0).collides
    && store.loadState().unlockedGates.has('south') && store.loadState().equipment.size > 0
    && scene.dragonRescued && store.loadState().unlockedGates.has('dragon')
    && scene.dragonDen.texture.key === 'dragon-den-empty'
    && scene.children.list.some((child) => child.texture?.key === 'prince')
    && scene.npcManager.npcs.find((npc) => npc.id === 'old-queen').repeatDialogue.includes('hjemme igen')
    && store.loadState().unlockedRewards.has('princess-bows')
    && scene.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 1 / 2'
    && scene.collectibleManager.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-2')
    && !scene.collectibleManager.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'bow-and-arrow-1'),
  'Southern passage did not survive reloading with the collection.');
  scene.interactWithDragonDen();
  assert(scene.dialogueWindow.message.text.includes('prinsen er fri')
    && scene.dialogueWindow.message.text.includes('prinsessen'), 'Reloaded empty den did not celebrate the ending.');
  scene.dialogueWindow.close();
  const rescuedQueen = scene.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  scene.npcManager.runInteraction(rescuedQueen);
  assert(scene.dialogueWindow.message.text.includes('hjemme igen'), 'Reloaded queen did not celebrate the rescue.');
  scene.dialogueWindow.close();
  const rescuedPrincess = scene.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  scene.npcManager.runInteraction(rescuedPrincess);
  assert(scene.dialogueWindow.message.text.includes('reddede prinsen'), 'Reloaded princess did not remember the rescue.');
  scene.dialogueWindow.close();
  scene.openGate('flora');
  const resetButton = scene.hud.resetButton;
  const originalConfirm = window.confirm;
  let confirmations = 0;
  try {
    window.confirm = () => { confirmations += 1; return false; };
    resetButton.click();
    assert(confirmations === 1 && scene.collectibleManager.collectedIds.size === 79
      && store.loadState().equipment.size > 0 && store.loadState().layoutSeed === firstSeed
      && store.loadState().unlockedGates.has('south')
      && !scene.worldMap.getTileAt(64, 16).collides,
    'Canceling reset changed progress or the reset button did not respond.');

    window.confirm = () => { confirmations += 1; return true; };
    scene.collectibleManager.store = failingWriteStore;
    resetButton.click();
    assert(confirmations === 2 && scene.dialogueWindow.isOpen
      && scene.dialogueWindow.message.text.includes('ikke nulstillet')
      && scene.collectibleManager.collectedIds.size === 79
      && store.loadState().equipment.size > 0 && store.loadState().layoutSeed === firstSeed
      && store.loadState().unlockedGates.has('south')
      && !scene.worldMap.getTileAt(64, 16).collides,
    'A failed reset did not preserve progress and report the error.');
    scene.dialogueWindow.close();
    scene.collectibleManager.store = store;
    previousManager = scene.collectibleManager;
    resetButton.click();
    scene = await waitForWorld(game, previousManager);
    const resetSeed = store.loadState().layoutSeed;
    const resetLayout = JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y]));
    assert(confirmations === 3 && store.loadState().collectedIds.size === 0
      && resetSeed !== firstSeed && resetLayout !== firstLayout
      && store.loadState().equipment.size === 0 && scene.collectibleManager.collectedIds.size === 0
      && store.loadState().unlockedGates.size === 0 && !scene.southOpen
      && store.loadState().unlockedRewards.size === 0
      && !scene.dragonRescued && scene.dragonDen.texture.key === 'dragon-den'
      && !scene.children.list.some((child) => child.texture?.key === 'prince')
      && scene.npcManager.npcs.find((npc) => npc.id === 'old-queen').interactions.length > 0
      && scene.southWizard.visible && scene.southMap.getTileAt(64, 0).collides
      && scene.collectibleManager.pickups.getChildren().length === 78
      && scene.worldMap.getTileAt(64, 16).collides
      && Array.from(scene.hud.unicornCounters.values()).every((counter) => counter.textContent.includes(': 0 / '))
      && scene.hud.toolProgress.textContent.includes('0 / 1')
      && scene.hud.toolCounters.get('lava-boots').textContent.includes('0 / 2')
      && scene.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 0 / 2'
      && Array.from(scene.hud.accessoryCounters.values()).every((counter) => counter.textContent.includes('0 / 15'))
      && document.querySelectorAll('.game-hud').length === 1,
    'Reset did not clear the saved collection and restart the world.');
    assertAccessoryCounters(scene);
    scene.enterStable();
    stable = await waitForStable(game, 0);
    assert(stable.accessories.length === 0, 'Stable was not emptied after reset.');
    stable.followers.leader.sprite.setPosition(400, 105);
    stable.interact({ repeat: false });
    await new Promise((resolve) => setTimeout(resolve, 150));
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    assert(scene.collectibleManager.collectedIds.size === 0
      && scene.collectibleManager.equipment.size === 0
      && store.loadState().layoutSeed === resetSeed
      && JSON.stringify(scene.collectibleManager.getAllItems().map(({ id, x, y }) => [id, x, y])) === resetLayout
      && scene.collectibleManager.pickups.getChildren().length === 78,
    'Reset progress did not remain empty after reloading the world.');
    await testAutomaticTurns(scene, store, failingStore);
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    await testFairyShooter(scene);
    previousManager = scene.collectibleManager;
    scene.scene.restart();
    scene = await waitForWorld(game, previousManager);
    await testTrollGame(scene);
  } finally {
    window.confirm = originalConfirm;
  }
  game.destroy(true);
}
