import { createGameConfig } from '../../src/config.js';
import { TEST_WORLD_DATA, WORLD_GATES, WORLD_TILE, WEST_CRACK, WEST_REGION_DATA, WEST_REGION_WIDTH,
  NORTH_HOLE, NORTH_REGION_DATA, NORTH_REGION_HEIGHT, EAST_ORIGIN, EAST_REGION_DATA, EAST_REGION_WIDTH, LAKE,
  SOUTH_ORIGIN, SOUTH_PASS, SOUTH_REGION_DATA, DRAGON_DEN } from '../../src/data/testWorld.js';
import { CollectionStore } from '../../src/managers/CollectionStore.js';
import { GameStateManager } from '../../src/managers/GameStateManager.js';
import { SoundEffects } from '../../src/audio/SoundEffects.js';
import { arrangeCollectibles } from '../../src/data/collectibleLayout.js';
import { mazePath, MAZE_LAYOUTS } from '../../src/scenes/WitchMazeScene.js';
import { CatMazeScene } from '../../src/scenes/CatMazeScene.js';
import { minigameSpeed } from '../../src/systems/MinigameDifficulty.js';
import { NorthFollowerNavigator } from '../../src/systems/NorthFollowerNavigator.js';
import { wizardTeam } from '../../src/systems/WizardTeam.js';
import { UnicornSpeedBoost } from '../../src/systems/UnicornSpeedBoost.js';
import { guideLines } from '../../src/systems/GuideGnomes.js';

import { assert, reachable, canReach, reachableWest, canReachWest, reachableNorth, canReachNorth, reachableVolcano, canReachVolcano, waitForWorld, waitForStable, collect, assertUnicornCounters, assertAccessoryCounters, clickCanvas } from '../test-support.js';

export function testUnicornCounters(scene) {
  const collection = scene.collectibleManager;
  const originalIds = collection.collectedIds;
  const unicorns = collection.getAllItems().filter((item) => item.type === 'unicorn');
  try {
    collection.collectedIds = new Set([
      unicorns.find((item) => item.texture === 'unicorn-purple').id,
      unicorns.find((item) => item.texture.startsWith('unicorn-rainbow-')).id,
      unicorns.find((item) => item.texture.startsWith('unicorn-volcano-')).id,
    ]);
    scene.updateCollectionProgress();
    assertUnicornCounters(scene);
    assert(scene.hud.unicornCounters.get('original').textContent === 'Hvide: 1 / 6'
      && scene.hud.unicornCounters.get('rainbow').textContent === 'Regnbue: 1 / 3'
      && scene.hud.unicornCounters.get('dark').textContent === 'Mørke: 0 / 3'
      && scene.hud.unicornCounters.get('volcano').textContent === 'Vulkan: 1 / 3',
    'Unicorn family counters did not distinguish mixed progress.');
  } finally {
    collection.collectedIds = originalIds;
    scene.updateCollectionProgress();
  }
}

export function testHudLayout(scene) {
  const hud = scene.hud.element;
  const controls = hud.querySelector('.hud-controls').getBoundingClientRect();
  const unicorns = hud.querySelector('.hud-unicorns').getBoundingClientRect();
  const collection = hud.querySelector('.hud-collection').getBoundingClientRect();
  const reset = scene.hud.resetButton.getBoundingClientRect();
  const player = scene.hud.turn.getBoundingClientRect();
  assert(controls.right <= unicorns.left && unicorns.right <= collection.left
    && reset.top < player.top && hud.scrollWidth <= hud.clientWidth,
  'HUD columns overlap or are incorrectly ordered.');
}

export function testCollection(scene, firstType, secondType) {
  collect(scene, firstType, 3);
  collect(scene, secondType, 2);
  collect(scene, secondType, 1);
  assert(scene.collectibleManager.getCollectedCount('unicorn') === 3
    && scene.collectibleManager.getCollectedCount('accessory') === 3,
  'Collecting three of each did not update the collection.');
  assert(scene.sys.isActive() && !scene.ui.list.some((object) => object.text === 'Fortsæt eventyret'),
    'Collecting three of each interrupted the adventure.');
  assertUnicornCounters(scene);
  assertAccessoryCounters(scene);
}

export function testChallenges(scene) {
  const manager = scene.challengeManager;
  const challenges = manager.getAllChallenges();
  const beginnerReading = challenges.filter((challenge) => challenge.category === 'Reading'
    && challenge.difficulty === 1);
  assert(beginnerReading.length >= 5, 'Too few beginner reading challenges.');
  for (const challenge of beginnerReading) {
    const text = [
      challenge.question, ...challenge.options, ...Object.values(challenge.story),
    ].join(' ');
    const words = text.match(/[A-Za-zÆØÅæøå]+/g) ?? [];
    assert(words.every((word) => word.length <= 3), `${challenge.id} has a word longer than 3 letters.`);
    assert(manager.evaluateAnswer(challenge.id, challenge.correctAnswer)
      && challenge.options.some((option) => !manager.evaluateAnswer(challenge.id, option)),
    `${challenge.id} does not have a correct answer and a wrong answer.`);
  }
  for (const difficulty of [1, 2]) {
    const englishCount = challenges.filter((challenge) => challenge.category === 'English'
      && challenge.difficulty === difficulty).length;
    assert(englishCount >= 12, `Too few English challenges at level ${difficulty}.`);
    for (const category of ['Reading', 'Math', 'Logic']) {
      const count = challenges.filter((challenge) => challenge.category === category
        && challenge.difficulty === difficulty).length;
      assert(count === englishCount * 2, `${category} is not twice the English pool at level ${difficulty}.`);
    }
    for (const challenge of challenges.filter((item) => item.difficulty === difficulty)) {
      assert(challenge.options.length === 3
        && challenge.options.filter((option) => manager.answersMatch(option, challenge.correctAnswer)).length === 1
        && new Set(challenge.options.map((option) => String(option).trim().toLocaleLowerCase())).size === 3,
      `${challenge.id} must have three distinct options and exactly one correct answer.`);
    }
  }
  const reserved = scene.npcManager.getGateChallengeIds();
  const originalRandom = Math.random;
  const originalStart = scene.startChallenge;
  const pickup = scene.collectibleManager.pickups.getChildren()
    .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'unicorn');
  try {
    for (const options of [['a', 'b', 'c'], ['a', 'b']]) {
      const question = { options, correctAnswer: 'a' };
      const positions = new Set();
      for (let offset = 0; offset < options.length; offset += 1) {
        Math.random = () => (offset + 0.5) / options.length;
        const rotated = manager.rotateOptions(question);
        positions.add(rotated.options.indexOf('a'));
        assert(rotated.options !== options && rotated.options.length === options.length
          && rotated.options.every((option) => options.includes(option)),
        'Rotation lost or mutated answer options.');
      }
      assert(positions.size === options.length && options[0] === 'a',
        'Rotation did not cover every correct-answer position equally.');
    }
    Math.random = () => 0;
    const first = manager.getChallengeForAge(6, [], reserved);
    Math.random = () => 0.999999;
    const last = manager.getChallengeForAge(6, [], reserved);
    assert(first.id !== last.id && first.difficulty === 1 && last.difficulty === 1,
      'Random selection does not use the full appropriate pool.');
    const fresh = manager.getChallengeForAge(6, [last.id], reserved);
    assert(fresh.id !== last.id && !reserved.includes(fresh.id), 'Solved or gatekeeper challenge was selected.');
    const allSuitable = challenges.filter((challenge) => challenge.difficulty <= 1)
      .map((challenge) => challenge.id);
    const repeated = manager.getChallengeForAge(6, allSuitable, reserved);
    assert(repeated.difficulty === 1 && !reserved.includes(repeated.id),
      'Exhausted beginner pool chose a harder or reserved challenge.');
    let noSuitable = false;
    try {
      manager.getChallengeForAge(6, [], allSuitable);
    } catch (error) {
      noSuitable = error.message.includes('passende niveau');
    }
    assert(noSuitable, 'Missing suitable challenges did not report an error.');

    let selected;
    scene.startChallenge = (challenge) => { selected = challenge; };
    for (const age of [8, 6]) {
      while (scene.leaderFollowerSystem.leader.age !== age) {
        scene.swapLeader();
      }
      selected = null;
      scene.collectWorldItem(scene.leaderFollowerSystem.leader.sprite, pickup);
      assert(selected?.difficulty === manager.getDifficultyForAge(age)
        && !reserved.includes(selected.id), `Unicorn did not use active player age ${age}.`);
    }
  } finally {
    Math.random = originalRandom;
    scene.startChallenge = originalStart;
    while (scene.leaderFollowerSystem.leader.age !== 8) {
      scene.swapLeader();
    }
  }
}

export function testFairyQuestionSelection(scene) {
  const originalRandom = Math.random;
  const originalStart = scene.startChallenge;
  const originalSelect = scene.challengeManager.getChallengeForAge;
  let selected;
  try {
    scene.startChallenge = (challenge) => { selected = challenge; };
    for (const age of [6, 8]) {
      while (scene.player.age !== age) {
        scene.swapLeader();
      }
      for (const [npcId, challengeId] of [['flora', 'flora-forest'], ['luna', 'regnbue']]) {
        const options = { randomForPlayer: true, npcId };
        scene.lastNPCChallenges.delete(npcId);
        Math.random = () => 0;
        scene.startNPCChallenge(challengeId, () => {}, 'mosquito', options);
        const first = selected;
        scene.lastNPCChallenges.delete(npcId);
        Math.random = () => 0.999999;
        scene.startNPCChallenge(challengeId, () => {}, 'mosquito', options);
        assert(first.id !== selected.id
          && first.difficulty === scene.challengeManager.getDifficultyForAge(age)
          && selected.difficulty === first.difficulty,
        `${npcId} did not randomly select varied age-${age} questions.`);
      }
    }
    scene.challengeManager.getChallengeForAge = () => { throw new Error('Ingen passende spørgsmål.'); };
    selected = null;
    scene.startNPCChallenge('flora-forest', () => {}, 'mosquito', { randomForPlayer: true, npcId: 'flora' });
    assert(!selected && scene.dialogueWindow.isOpen && scene.dialogueWindow.message.text.includes('Ingen passende spørgsmål'),
      'A missing fairy question was not reported.');
    scene.dialogueWindow.close();
  } finally {
    Math.random = originalRandom;
    scene.startChallenge = originalStart;
    scene.challengeManager.getChallengeForAge = originalSelect;
    scene.lastNPCChallenges.clear();
    while (scene.player.age !== 8) {
      scene.swapLeader();
    }
  }
}

export function testInteractionSounds(scene) {
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const manager = scene.npcManager;
  const originalRun = manager.runInteraction;
  const originalCollect = scene.collectibleManager.collect;
  const originalStart = scene.startChallenge;
  const originalRecord = scene.stateManager.recordAccessory;
  const heard = [];
  try {
    sounds.play = (name) => heard.push(name);
    manager.runInteraction = () => {};
    for (const [id, expected] of [
      ['bridge-troll', 'troll'], ['river-troll', 'troll'], ['flora', 'fairy'], ['luna', 'fairy'],
    ]) {
      manager.activeNPC = manager.npcs.find((npc) => npc.id === id);
      manager.interact();
      assert(heard.pop() === expected, `${id} did not play its interaction sound.`);
    }
    scene.startChallenge = () => {};
    const unicorn = scene.collectibleManager.pickups.getChildren()
      .find((pickup) => scene.collectibleManager.getItemForPickup(pickup).type === 'unicorn');
    scene.collectWorldItem(scene.player.sprite, unicorn);
    assert(heard.pop() === 'unicorn', 'Unicorn encounter did not play a gallop.');
    scene.stateManager.recordAccessory = () => false;
    const expectedSounds = { wings: 'wings', crown: 'crown', saddle: 'saddlePickup', sticker: 'stickerPickup' };
    const accessories = scene.collectibleManager.getAllItems().filter((item) => item.type === 'accessory');
    assert(accessories.length > 0, 'No accessories were available to test pickup sounds.');
    for (const item of accessories) {
      scene.collectibleManager.collect = () => item;
      scene.collectPickup({});
      assert(heard.length === 1 && heard.pop() === expectedSounds[item.slot], `${item.id} played the wrong pickup sound.`);
    }
    scene.collectibleManager.collect = () => null;
    scene.collectPickup({});
    assert(heard.length === 0, 'An already-collected pickup played a success sound.');
    scene.collectibleManager.collect = () => ({ id: 'test-unicorn', type: 'unicorn' });
    scene.collectPickup({});
    assert(heard.length === 0, 'Collecting a unicorn played an accessory pickup sound.');
    scene.collectibleManager.collect = () => { throw new Error('test'); };
    scene.collectPickup({});
    assert(heard.length === 0 && scene.dialogueWindow.isOpen,
      'A failed pickup played a success sound or did not report the error.');
    scene.dialogueWindow.close();
    scene.failedPickup = null;
  } finally {
    sounds.play = originalPlay;
    manager.runInteraction = originalRun;
    scene.collectibleManager.collect = originalCollect;
    scene.startChallenge = originalStart;
    scene.stateManager.recordAccessory = originalRecord;
  }
}

export function testWeightedTurnCounts() {
  const combinations = [
    ['question', 'question'],
    ['accessory', 'accessory', 'accessory', 'accessory'],
    ['question', 'accessory', 'accessory'],
    ['accessory', 'accessory', 'accessory', 'question'],
  ];
  for (const events of combinations) {
    const state = new GameStateManager();
    events.forEach((event, index) => {
      const switched = event === 'question' ? state.recordQuestion('a') : state.recordAccessory('a');
      assert(switched === (index === events.length - 1),
        `Wrong turn threshold for ${events.join(', ')}.`);
    });
    assert(!state.recordAccessory('a'), 'Automatic switch did not reset the count.');
  }
}

export async function testBeginnerReadingScene(scene) {
  const challenge = scene.challengeManager.getChallenge('reading-short-cat');
  const answeringPlayer = scene.leaderFollowerSystem.leader.id;
  scene.startChallenge(challenge);
  const deadline = Date.now() + 5000;
  const challengeScene = scene.game.scene.getScene('ChallengeScene');
  while (!challengeScene.sys.isActive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(challengeScene.sys.isActive(), 'Beginner reading challenge did not open.');
  assert(!challengeScene.children.list.some((object) => typeof object.text === 'string'
    && (/^Læs · 1$/.test(object.text) || object.text === 'LÆS')),
  'Beginner question displayed its category or difficulty.');
  const sounds = scene.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const displayedWords = challengeScene.children.list
    .filter((object) => typeof object.text === 'string')
    .map((object) => object.text).join(' ').match(/[A-Za-zÆØÅæøå]+/g) ?? [];
  assert(displayedWords.every((word) => word.length <= 3),
    'Beginner reading challenge screen has a word longer than 3 letters.');
  const wrong = challengeScene.challenge.options.findIndex((option) => !scene.challengeManager.answersMatch(option, challenge.correctAnswer));
  const correct = challengeScene.challenge.options.findIndex((option) => scene.challengeManager.answersMatch(option, challenge.correctAnswer));
  challengeScene.answerButtons[wrong].emit('pointerdown');
  assert(!challengeScene.isResolved && challengeScene.feedback.text === challenge.story.hint,
    'Wrong beginner reading answer did not show a hint.');
  assert(heard.length === 0, 'Wrong answer played a completion sound.');
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'Wrong answer switched players.');
  challengeScene.answerButtons[correct].emit('pointerdown');
  assert(challengeScene.isResolved && challengeScene.feedback.text === challenge.story.success,
    'Correct beginner reading answer was not accepted.');
  challengeScene.answerButtons[correct].emit('pointerdown');
  assert(heard.join(',') === 'questionCorrect', 'Correct answer did not play exactly one completion sound.');
  sounds.play = originalPlay;
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'Player switched before the question was closed.');
  challengeScene.continueButton.emit('pointerdown');
  while (!scene.sys.isActive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(scene.sys.isActive() && scene.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Completing beginner reading did not resume the world.');
  assert(scene.leaderFollowerSystem.leader.id === answeringPlayer,
    'One question switched players before the four-point threshold.');
}

export async function testAutomaticTurns(scene, store, failingStore) {
  const players = scene.leaderFollowerSystem.players;
  const first = players[0].id;
  const second = players[1].id;
  const collectAccessory = () => {
    const pickup = scene.collectibleManager.pickups.getChildren()
      .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'accessory');
    scene.collectWorldItem(scene.leaderFollowerSystem.leader.sprite, pickup);
  };
  const leader = () => scene.leaderFollowerSystem.leader.id;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 200));
  const checkPopup = (name) => {
    assert(!scene.hud.turnPopup.hidden && scene.hud.turnPopup.textContent.includes(name),
      'Player switch did not show the correct pop-up.');
  };
  const answer = async (challenge, switches, trollGame = false) => {
    const challengeScene = scene.game.scene.getScene('ChallengeScene');
    let deadline = Date.now() + 10000;
    while (!challengeScene.sys.isActive() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(challengeScene.sys.isActive(), 'Turn test challenge did not open.');
    const correct = challengeScene.challenge.options.findIndex((option) => (
      scene.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    const wrong = challengeScene.challenge.options.findIndex((option) => (
      !scene.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    const before = leader();
    challengeScene.answerButtons[wrong].emit('pointerdown');
    assert(leader() === before && !challengeScene.isResolved, 'Wrong answer changed turn.');
    challengeScene.answerButtons[correct].emit('pointerdown');
    assert(leader() === before, 'Correct answer changed turn before closing the question.');
    challengeScene.continueButton.emit('pointerdown');
    if (trollGame) {
      const troll = scene.game.scene.getScene('TrollScene');
      deadline = Date.now() + 10000;
      while (!troll.sys.isActive() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert(troll.sys.isActive() && leader() === before, 'Troll game did not start before switching.');
      for (let count = 0; count < 7; count += 1) {
        troll.collectApple(troll.player, troll.apples.getChildren()[0]);
      }
    }
    deadline = Date.now() + 10000;
    while ((!scene.sys.isActive() || challengeScene.sys.isActive()) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(scene.sys.isActive() && (leader() !== before) === switches,
      'Completed question switched at the wrong threshold.');
    if (switches) {
      checkPopup(scene.player.name);
    }
  };

  collectAccessory();
  assert(leader() === first, 'One accessory switched turns.');
  scene.input.keyboard.emit('keydown-T');
  assert(leader() === second, 'Manual T switch did not change turn.');
  checkPopup(scene.player.name);
  collectAccessory();
  assert(leader() === second, 'Each player should have an independent accessory count.');
  scene.enterStable();
  const stable = await waitForStable(scene.game, 0);
  stable.swapLeader();
  checkPopup(stable.followers.leader.name);
  stable.swapLeader();
  stable.followers.leader.sprite.setPosition(400, 105);
  stable.interact({ repeat: false });
  await wait();
  assert(scene.sys.isActive() && leader() === second, 'Stable switching changed the active player unexpectedly.');
  scene.input.keyboard.emit('keydown-T');
  assert(leader() === first, 'Manual switching back failed.');
  scene.collectibleManager.store = failingStore;
  collectAccessory();
  assert(leader() === first && scene.dialogueWindow.isOpen,
    'Failed collection changed the turn or did not report the error.');
  scene.collectibleManager.store = store;
  scene.dialogueWindow.close();
  scene.failedPickup = null;
  collectAccessory();
  assert(leader() === first, 'Two accessories switched before the four-point threshold.');

  const trollQuestion = scene.challengeManager.getChallenge('math-addition');
  scene.npcManager.runInteraction(scene.npcManager.npcs.find((npc) => npc.id === 'bridge-troll'));
  await answer(trollQuestion, true, true);
  assert(!scene.worldMap.getTileAt(31, 32).collides, 'Troll gate did not open before switching.');
  scene.dialogueWindow.close();
  assert(leader() === second && scene.hud.turn.textContent === `${scene.player.name} har turen`,
    'Question switch did not update the active player and HUD.');
  collectAccessory();
  assert(leader() === second, 'Two accessories switched before the four-point threshold.');

  const pickup = scene.collectibleManager.pickups.getChildren()
    .find((item) => scene.collectibleManager.getItemForPickup(item).type === 'unicorn');
  const item = scene.collectibleManager.getItemForPickup(pickup);
  const originalStart = scene.startChallenge;
  let unicornQuestion;
  scene.startChallenge = function (challenge, onCorrect) {
    unicornQuestion = challenge;
    return originalStart.call(this, challenge, onCorrect);
  };
  try {
    scene.collectWorldItem(scene.player.sprite, pickup);
  } finally {
    scene.startChallenge = originalStart;
  }
  assert(unicornQuestion, 'Unicorn did not start a question.');
  await answer(unicornQuestion, true);
  assert(scene.collectibleManager.collectedIds.has(item.id) && leader() === first,
    'Unicorn was not collected before the turn switched.');
  collectAccessory();
  assert(leader() === first, 'A completed turn did not reset the previous count.');
  collectAccessory();
  collectAccessory();
  assert(leader() === first, 'Three accessories switched before the threshold.');
  collectAccessory();
  assert(leader() === second && scene.movement.player === scene.player.sprite,
    'Four accessories did not switch the active movement player.');
  checkPopup(scene.player.name);

  const reading = scene.challengeManager.getChallenge('reading-short-cat');
  scene.startChallenge(reading);
  await answer(reading, false);
  scene.startChallenge(reading);
  await answer(reading, true);
  assert(leader() === first, 'Two questions did not switch players.');
  scene.startChallenge(reading);
  await answer(reading, false);
  collectAccessory();
  assert(leader() === first, 'One question and one accessory switched too early.');
  collectAccessory();
  assert(leader() === second, 'One question and two accessories did not switch.');
  checkPopup(scene.player.name);
  await new Promise((resolve) => setTimeout(resolve, 2700));
  assert(scene.hud.turnPopup.hidden, 'Turn pop-up did not disappear.');
}

export async function testPanelPointerInput(stable, unicorn) {
  const panel = stable.detailPanel;
  const camera = stable.cameras.main;
  camera.stopFollow();
  for (const scrollY of [0, camera.getBounds().height - camera.height]) {
    camera.setScroll(0, scrollY);
    panel.show(unicorn, stable.accessories);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(Math.abs(camera.scrollY - scrollY) < 1, `Camera did not reach scroll ${scrollY}.`);
    let behindClicks = 0;
    const behind = stable.add.rectangle(40, scrollY + 300, 60, 60)
      .setInteractive().on('pointerdown', () => { behindClicks += 1; });
    await clickCanvas(stable.game, 40, 300);
    assert(behindClicks === 0 && panel.isOpen, `Overlay did not block input at scroll ${scrollY}.`);
    behind.destroy();

    const slots = ['sticker', 'saddle', 'wings', 'crown'];
    for (const [categoryIndex, slot] of slots.entries()) {
      await clickCanvas(stable.game, panel.categoryButtons[categoryIndex].x, panel.categoryButtons[categoryIndex].y);
      assert(panel.category === slot && panel.page === 0, `Category ${slot} did not open at scroll ${scrollY}.`);
      const accessories = stable.accessories.filter((item) => item.slot === slot);
      for (let index = 0; index < 3; index += 1) {
        assert(panel.buttons[index].text.includes(accessories[index].name),
          `Category ${slot} displayed the wrong accessory.`);
        await clickCanvas(stable.game, panel.buttons[index].x, panel.buttons[index].y);
        assert(panel.collection.getAccessoryOwner(accessories[index].id) === unicorn.id,
          `Accessory button ${index} selected the wrong ${slot} at scroll ${scrollY}.`);
        await clickCanvas(stable.game, panel.buttons[index].x, panel.buttons[index].y);
        assert(!panel.collection.getAccessoryOwner(accessories[index].id),
          `Accessory button ${index} did not remove its ${slot} at scroll ${scrollY}.`);
      }
    }
    await clickCanvas(stable.game, panel.next.x, panel.next.y);
    assert(panel.page === 1, `Next page did not respond at scroll ${scrollY}.`);
    const secondPageHat = stable.accessories.filter((item) => item.slot === 'crown')[3];
    assert(panel.buttons[0].text.includes(secondPageHat.name), 'Second page displayed the wrong hat.');
    await clickCanvas(stable.game, panel.buttons[0].x, panel.buttons[0].y);
    assert(panel.collection.getAccessoryOwner(secondPageHat.id) === unicorn.id, 'Second-page hat was not equipped.');
    await clickCanvas(stable.game, panel.buttons[0].x, panel.buttons[0].y);
    assert(!panel.collection.getAccessoryOwner(secondPageHat.id), 'Second-page hat was not removed.');
    await clickCanvas(stable.game, panel.categoryButtons[0].x, panel.categoryButtons[0].y);
    assert(panel.category === 'sticker' && panel.page === 0 && !panel.previous.visible,
      'Changing category did not reset pagination.');
    await clickCanvas(stable.game, panel.next.x, panel.next.y);
    await clickCanvas(stable.game, panel.previous.x, panel.previous.y);
    assert(panel.page === 0, `Previous page did not respond at scroll ${scrollY}.`);
    await clickCanvas(stable.game, panel.closeButton.x, panel.closeButton.y);
    assert(!panel.isOpen, `Close did not respond at scroll ${scrollY}.`);
    panel.show(unicorn, stable.accessories);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await clickCanvas(stable.game, panel.closeButton.x, panel.closeButton.y);
    assert(!panel.isOpen, `Reopened panel did not close at scroll ${scrollY}.`);
  }
}
