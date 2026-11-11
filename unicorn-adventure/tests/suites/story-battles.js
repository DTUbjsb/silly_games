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

export async function testDragonBattle(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const princess = world.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  const queen = world.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  const queenState = {
    interactions: queen.interactions, lines: queen.interactions[0].lines, repeatDialogue: queen.repeatDialogue,
  };
  const princessState = { lines: princess.interactions[0].lines, repeatDialogue: princess.repeatDialogue };
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const beforeChildren = new Set(world.children.list);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(DRAGON_DEN.x, DRAGON_DEN.y + 110);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Ready dragon encounter did not offer the fight.');
    world.dialogueWindow.chooseQuest(true);
    const selected = [];
    for (const category of ['Math', 'English', 'Logic', 'Reading']) {
      const question = game.scene.getScene('ChallengeScene');
      await waitUntil(() => question.sys.isActive() && question.challenge?.category === category,
        `${category} dragon question did not start.`);
      const challenge = question.challenge;
      selected.push(challenge);
      assert(!question.children.list.some((object) => typeof object.text === 'string'
        && /^(Læs|Læsning|Matematik|Engelsk|Logik) · (niveau )?\d+$/.test(object.text)),
      'A dragon question displayed its category or difficulty.');
      assert(challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age),
        'Dragon question was not age-appropriate.');
      const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
      const right = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
      question.answerButtons[wrong].emit('pointerdown');
      assert(!question.isResolved && !game.scene.isActive('DragonBattleScene'), 'A wrong answer started the dragon battle.');
      question.answerButtons[right].emit('pointerdown');
      question.continueButton.emit('pointerdown');
    }
    const battle = game.scene.getScene('DragonBattleScene');
    await waitUntil(() => battle.sys.isActive(), 'Dragon battle did not start after four questions.');
    assert(selected.every((challenge) => !world.stateManager.learnedChallengeIds.has(challenge.id)),
      'Dragon questions were credited before victory.');
    return { battle, selected };
  };
  try {
    assert(world.dragonDen.texture.key === 'dragon-den' && !world.dragonRescued, 'Dragon den is missing.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedGates: new Set(saved.unlockedGates) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    world.finishDragonChallenge(true, []);
    assert(!world.dragonRescued && world.dialogueWindow.message.text.includes('ikke gemt'),
      'A failed rescue save did not preserve the encounter and report the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    world.player.sprite.body.reset(DRAGON_DEN.x, DRAGON_DEN.y + 110);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue' && world.dialogueWindow.message.text.includes('krigerprinsessen'),
      'Dragon den did not explain its requirements.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...savedIds, 'bow-and-arrow-1', 'bow-and-arrow-2']);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue', 'Two bows without the princess started the fight.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...savedIds, 'bow-and-arrow-1']);
    assert(world.recruitPrincess(), 'Could not recruit princess for dragon test.');
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'dialogue', 'One bow with the princess started the fight.');
    world.dialogueWindow.close();
    world.updateStoryDialogue(queen);
    assert(queen.interactions[0].lines.some((line) => line.includes('den sidste bue')),
      'Queen did not acknowledge the first collected bow.');
    collection.collectedIds.add('bow-and-arrow-2');
    world.updateStoryDialogue(queen);
    assert(queen.interactions[0].lines.some((line) => line.includes('begge buer'))
      && !queen.repeatDialogue.includes('Find krigerprinsessen'),
    'Queen did not acknowledge the princess and collected bows.');
    let { battle, selected } = await start();
    battle.time.removeAllEvents();
    assert(battle.dragonLives === 50 && battle.princessLives === 15 && battle.girls.length === 2
      && battle.difficulty === minigameSpeed(world.player.age), 'Dragon battle initialization failed.');
    assert(battle.rockCover.depth > battle.girls[0].depth && battle.rockCover.depth < battle.bows[0].depth,
      'The girls and their bows are not layered behind the rock cover.');
    const oldHeadX = battle.head.x;
    await waitUntil(() => Math.abs(battle.head.x - oldHeadX) > 40, 'Dragon head did not move sideways.');
    assert(Math.abs(battle.head.body.center.x - battle.head.x) < 1, 'Moving head and hitbox are out of sync.');
    battle.headMotionTime = 0;
    battle.update(battle.time.now, 900);
    const missedArrow = battle.arrows.create(400, battle.head.y, 'dragon-arrow');
    assert(!battle.physics.overlap(missedArrow, battle.head), 'An arrow aimed at the old position still hit the moving head.');
    missedArrow.destroy();
    const startX = battle.princess.x;
    battle.cursors.right.isDown = true;
    await waitUntil(() => battle.princess.x > startX + 10, 'Princess did not move with arrow keys.');
    battle.cursors.right.isDown = false;
    battle.pointBow({ x: battle.head.x, y: battle.head.y });
    battle.fireArrow({ repeat: false });
    assert(battle.arrows.getLength() === 1 && battle.arrows.getChildren()[0].body.velocity.y < 0,
      'Bow did not fire an aimed arrow.');
    battle.fireArrow({ repeat: true });
    assert(battle.arrows.getLength() === 1, 'Repeating space fired extra arrows.');
    await waitUntil(() => battle.dragonLives === 49, 'A fired arrow did not reach the dragon.');
    battle.shootFireball();
    assert(battle.fireballs.getLength() === 1 && battle.fireballs.getChildren()[0].body.velocity.length() > 0,
      'Dragon did not fire a moving fireball.');
    battle.fireballs.clear(true, true);
    for (let hit = 0; hit < 15; hit += 1) {
      const fireball = battle.fireballs.create(battle.princess.x, battle.princess.y, 'dragon-fireball');
      battle.physics.overlap(battle.princess, fireball, battle.hitPrincess, undefined, battle);
      if (hit < 14) assert(!battle.finished, 'Dragon battle lost before 15 fireballs.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Dragon loss did not resume the world.');
    assert(!world.dragonRescued && selected.every((challenge) => !world.stateManager.learnedChallengeIds.has(challenge.id)),
      'Dragon loss rescued the prince or credited questions.');
    world.dialogueWindow.close();
    ({ battle, selected } = await start());
    battle.time.removeAllEvents();
    battle.headMotionTime = 0;
    battle.update(battle.time.now, 0);
    for (const target of [battle.head, battle.leftPaw, battle.rightPaw]) {
      battle.princess.body.reset(target === battle.head ? 400 : target === battle.leftPaw ? 100 : 700,
        target === battle.head ? 235 : 270);
      battle.nextSwordHit = 0;
      const before = battle.dragonLives;
      battle.update(battle.time.now);
      assert(battle.dragonLives === before - 1 && battle.swordTarget === target,
        'Automatic sword did not hit or face the nearby dragon body part.');
    }
    battle.princess.body.reset(400, 390);
    for (let hit = 0; hit < 47; hit += 1) {
      const arrow = battle.arrows.create(battle.head.x, battle.head.y, 'dragon-arrow');
      battle.physics.overlap(arrow, battle.head, battle.hitDragon, undefined, battle);
      if (hit < 46) assert(!battle.finished, 'Dragon was defeated before 50 combined hits.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Dragon victory did not resume the world.');
    assert(world.dragonRescued && collection.store.loadState().unlockedGates.has('dragon')
      && selected.every((challenge) => world.stateManager.learnedChallengeIds.has(challenge.id))
      && queen.repeatDialogue.includes('hjemme igen') && world.dragonDen.texture.key === 'dragon-den-empty',
    'Victory did not save the rescue, update the queen, and credit all four questions.');
    world.dialogueWindow.close();
    world.npcManager.runInteraction(queen);
    assert(world.dialogueWindow.message.text.includes('hjemme igen'), 'Queen did not celebrate the rescue in conversation.');
    world.dialogueWindow.close();
    world.interactWithDragonDen();
    assert(world.dialogueWindow.mode === 'dialogue' && world.dialogueWindow.message.text.includes('prinsen er fri')
      && world.dialogueWindow.message.text.includes('prinsessen') && world.dialogueWindow.message.text.includes('besejret'),
    'Empty den did not celebrate the ending.');
  } finally {
    collection.store = originalStore;
    if (game.scene.isActive('DragonBattleScene')) world.scene.stop('DragonBattleScene');
    if (!world.sys.isActive()) world.scene.resume();
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.pickups.getChildren().filter((pickup) => pickup.getData('collectibleId').startsWith('bow-and-arrow-'))
      .forEach((pickup) => pickup.destroy());
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates, saved.unlockedRewards);
    collection.collectedIds = savedIds;
    world.updateCollectionProgress();
    world.leaderFollowerSystem.companions = world.leaderFollowerSystem.companions.filter((companion) => companion !== princess);
    if (princess.sprite.body) world.physics.world.disable(princess.sprite);
    princess.following = false;
    princess.nameTag.setVisible(true);
    queen.interactions = queenState.interactions;
    queen.interactions[0].lines = queenState.lines;
    queen.repeatDialogue = queenState.repeatDialogue;
    princess.interactions[0].lines = princessState.lines;
    princess.repeatDialogue = princessState.repeatDialogue;
    world.dragonRescued = false;
    world.dragonDen.setTexture('dragon-den');
    world.children.list.filter((child) => !beforeChildren.has(child) && (child.texture?.key === 'prince' || child.text === 'Prinsen'))
      .forEach((child) => child.destroy());
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export async function testWarriorPrincess(world) {
  const princess = world.npcManager.npcs.find((npc) => npc.id === 'warrior-princess');
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const pickups = () => collection.pickups.getChildren().filter(
    (pickup) => pickup.getData('collectibleId').startsWith('bow-and-arrow-'),
  );
  const begin = async () => {
    world.player.sprite.body.reset(princess.x, princess.y);
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC === princess, 'Wandering princess could not be approached.');
    world.handleSpace();
    while (world.dialogueWindow.mode === 'dialogue') world.dialogueWindow.advance();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Princess question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !world.game.scene.isActive('PrincessDuelScene'), 'Wrong answer started the duel.');
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const duel = world.game.scene.getScene('PrincessDuelScene');
    await waitUntil(() => duel.sys.isActive(), 'Princess duel did not start.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Princess question was credited before victory.');
    return { duel, challenge };
  };
  try {
    assert(princess && world.princessWander && princess.y > SOUTH_ORIGIN + 32
      && pickups().length === 0 && world.hud.toolCounters.get('bow-and-arrow').textContent === 'Buer og pile: 0 / 2',
    'Princess or locked bows are not initialized correctly.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedRewards: new Set(saved.unlockedRewards) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    assert(!world.recruitPrincess() && !princess.following && pickups().length === 0
      && world.dialogueWindow.message.text.includes('ikke gemt'),
    'A failed reward save recruited the princess, spawned bows, or hid the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    const oldX = princess.x;
    world.princessWander.update(1000);
    assert(princess.x !== oldX && princess.sprite.x === princess.x, 'Princess did not wander with her interaction position.');
    let { duel, challenge } = await begin();
    assert(duel.difficulty === minigameSpeed(world.player.age) && duel.playerLives === 5 && duel.princessLives === 5,
      'Duel difficulty or lives are incorrect.');
    await waitUntil(() => duel.player.body.blocked.down, 'Duel player did not land.');
    duel.jump({ repeat: false });
    assert(duel.player.body.velocity.y < 0, 'Duel player cannot jump.');
    duel.player.body.reset(300, 450);
    duel.princess.body.reset(600, 450);
    duel.keys.D.isDown = true;
    await waitUntil(() => duel.player.x > 320, 'Duel player cannot move horizontally.');
    duel.keys.D.isDown = false;
    duel.player.body.reset(340, 480);
    duel.princess.body.reset(420, 480);
    duel.princessAttackAt = duel.time.now + 10000;
    duel.keys.D.isDown = true;
    await waitUntil(() => duel.player.x > duel.princess.x + 25, 'Fighters could not pass through each other.');
    duel.keys.D.isDown = false;
    duel.princessAttackAt = null;
    duel.player.body.reset(400, 450);
    duel.princess.body.reset(420, 450);
    duel.update(duel.time.now);
    assert(!duel.player.flipX && duel.princess.flipX, 'Fighters do not face each other.');
    duel.player.body.reset(450, 450);
    duel.update(duel.time.now);
    assert(duel.player.flipX && !duel.princess.flipX, 'Fighters did not turn after passing.');
    duel.swing({ repeat: false });
    duel.swing({ repeat: true });
    assert(duel.princessLives === 4, 'Practice swing missed or repeated without a new press.');
    duel.player.body.reset(300, 450);
    duel.princess.body.reset(600, 450);
    duel.nextPlayerSwing = 0;
    duel.swing({ repeat: false });
    assert(duel.princessLives === 4, 'A distant practice swing hit the princess.');
    duel.player.body.reset(400, 320);
    duel.princess.body.reset(450, 450);
    duel.princessAttackAt = duel.time.now;
    duel.update(duel.time.now);
    assert(duel.playerLives === 5, 'Princess hit a player who jumped out of reach.');
    for (let hit = 0; hit < 5; hit += 1) {
      duel.player.body.reset(400, 450);
      duel.princess.body.reset(450, 450);
      duel.princessAttackAt = duel.time.now;
      duel.update(duel.time.now);
    }
    await waitUntil(() => world.sys.isActive() && !duel.sys.isActive(), 'World did not resume after losing the duel.');
    assert(!princess.following && pickups().length === 0 && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Losing the duel awarded the princess, bows, or question.');
    world.dialogueWindow.close();
    ({ duel, challenge } = await begin());
    for (let hit = 0; hit < 5; hit += 1) {
      duel.player.body.reset(400, 450);
      duel.princess.body.reset(450, 450);
      duel.nextPlayerSwing = 0;
      duel.swing({ repeat: false });
    }
    await waitUntil(() => world.sys.isActive() && !duel.sys.isActive(), 'World did not resume after winning the duel.');
    assert(princess.following && world.leaderFollowerSystem.companions.includes(princess)
      && !princess.nameTag.visible && world.stateManager.learnedChallengeIds.has(challenge.id)
      && collection.store.loadState().unlockedRewards.has('princess-bows') && pickups().length === 2,
    'Winning did not recruit the princess and unlock two bows.');
    world.dialogueWindow.close();
    for (const [index, pickup] of [...pickups()].entries()) {
      world.player.sprite.body.reset(pickup.x, pickup.y);
      await waitUntil(() => !pickup.active, 'Walking over a bow did not collect it.');
      assert(world.hud.toolCounters.get('bow-and-arrow').textContent === `Buer og pile: ${index + 1} / 2`,
        'The bow counter did not update.');
    }
    assert(collection.store.loadState().collectedIds.has('bow-and-arrow-1')
      && collection.store.loadState().collectedIds.has('bow-and-arrow-2'), 'Collected bows were not saved.');
    collection.unlockReward('princess-bows');
    assert(pickups().length === 0, 'Re-recruiting duplicated collected bows.');
    world.enterStable();
    const stable = world.game.scene.getScene('StableScene');
    await waitUntil(() => stable.sys.isActive(), 'Stable did not open with the princess.');
    assert(stable.followers.companions.some((companion) => companion.id === princess.id
      && companion.sprite.texture.key === 'warrior-princess'), 'Princess did not follow into the stable.');
    const before = world.catMeowTimeRemaining;
    stable.update(0, 100);
    assert(world.catMeowTimeRemaining === before, 'Princess alone caused cat meows.');
    stable.scene.stop();
    world.scene.resume();
    await waitUntil(() => world.sys.isActive(), 'World did not resume after stable visit.');
  } finally {
    collection.store = originalStore;
    if (world.game.scene.isActive('PrincessDuelScene')) world.scene.stop('PrincessDuelScene');
    if (world.game.scene.isActive('StableScene')) world.scene.stop('StableScene');
    if (!world.sys.isActive()) world.scene.resume();
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    pickups().forEach((pickup) => pickup.destroy());
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates, saved.unlockedRewards);
    collection.collectedIds = savedIds;
    world.updateCollectionProgress();
    world.leaderFollowerSystem.companions = world.leaderFollowerSystem.companions.filter((companion) => companion !== princess);
    if (princess.sprite.body) world.physics.world.disable(princess.sprite);
    princess.following = false;
    princess.nameTag.setVisible(true);
    princess.interactionIndex = 0;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.catMeowTimeRemaining = null;
    world.lastNPCChallenges.delete('warrior-princess');
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export function testOldQueen(world) {
  const queen = world.npcManager.npcs.find((npc) => npc.id === 'old-queen');
  assert(queen && queen.sprite.texture.key === 'old-queen' && world.textures.exists('old-queen'),
    'The old queen or her artwork did not load.');
  const leader = world.player;
  const { x, y } = leader.sprite;
  try {
    leader.sprite.body.reset(queen.x, queen.y);
    assert(!world.isNearStable(), 'The stable entrance prevents talking to the queen.');
    world.npcManager.update(leader);
    assert(world.npcManager.activeNPC === queen && world.npcManager.interactionPrompt.visible,
      'The queen cannot be approached for an interaction.');
    world.handleSpace();
    assert(world.dialogueWindow.speakerName === queen.name
      && world.dialogueWindow.message.text.includes('søn')
      && world.dialogueWindow.message.text.includes('prins')
      && world.dialogueWindow.message.text.includes('bortført')
      && world.dialogueWindow.message.text.includes('drage'),
    'The queen did not explain that the dragon abducted her son.');
    world.dialogueWindow.advance();
    assert(world.dialogueWindow.message.text.includes('dragens hule')
      && world.dialogueWindow.message.text.includes('syd')
      && world.dialogueWindow.message.text.includes('alle enhjørningernes kræfter'),
    'The queen did not describe the southern lair and unicorn powers.');
    world.dialogueWindow.advance();
    assert(world.dialogueWindow.message.text.includes('krigerprinsessen')
      && world.dialogueWindow.message.text.includes('sydlige område')
      && world.dialogueWindow.message.text.includes('besejre dragen'),
    'The queen did not explain the warrior princess help.');
    world.dialogueWindow.advance();
    world.handleSpace();
    assert(world.dialogueWindow.message.text.includes('dragens hule')
      && world.dialogueWindow.message.text.includes('alle enhjørningernes kræfter')
      && world.dialogueWindow.message.text.includes('krigerprinsessen'),
    'The queen does not repeat the guidance when spoken to again.');
  } finally {
    world.dialogueWindow.close();
    queen.interactionIndex = 0;
    leader.sprite.body.reset(x, y);
    world.npcManager.update(leader);
  }
}

export async function testSouthWizard(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const originalStore = collection.store;
  const savedIds = collection.collectedIds;
  const savedEquipment = new Map(collection.equipment);
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const all = collection.getAllItems();
  const unicorns = all.filter((item) => item.type === 'unicorn');
  const accessories = all.filter((item) => item.type === 'accessory');
  const team = wizardTeam(unicorns, accessories);
  const selectedAccessories = ['sticker', 'wings', 'crown', 'saddle'].flatMap(
    (slot) => accessories.filter((item) => item.slot === slot).slice(0, 4),
  );
  const selected = [...team, ...selectedAccessories];
  const start = async () => {
    world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Ready wizard did not offer the battle.');
    world.dialogueWindow.chooseQuest(true);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Wizard question did not start.');
    const challenge = question.challenge;
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('WizardBattleScene'), 'A wrong answer started the wizard battle.');
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const battle = game.scene.getScene('WizardBattleScene');
    await waitUntil(() => battle.sys.isActive(), 'Wizard battle did not start.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Wizard question was credited before victory.');
    return { battle, challenge };
  };
  try {
    assert(SOUTH_REGION_DATA.slice(1).every((row) => row.every((tile) => tile === WORLD_TILE.GRASS))
      && world.southMap.getTileAt(64, 0).collides && world.southMap.getTileAt(30, 0).collides,
    'Southern area is not empty grass behind a closed wall.');
    collection.store = {
      loadState: () => ({ ...saved, unlockedGates: new Set(saved.unlockedGates) }),
      save: () => { throw new Error('Lageret er spærret.'); },
    };
    assert(!world.unlockSouthPass() && !world.southOpen && world.dialogueWindow.message.text.includes('ikke åbnet'),
      'A storage failure opened the southern passage or failed to report the error.');
    world.dialogueWindow.close();
    collection.store = originalStore;
    assert(team?.length === 4, 'Could not select one unicorn from each group.');
    for (const removed of team) {
      const familyPrefix = removed.texture.match(/^unicorn-(rainbow|dark|volcano)-/)?.[0];
      const withoutFamily = unicorns.filter((item) => familyPrefix
        ? !item.texture.startsWith(familyPrefix)
        : /^(unicorn-rainbow-|unicorn-dark-|unicorn-volcano-)/.test(item.texture));
      assert(!wizardTeam(withoutFamily, accessories), 'Extra unicorns replaced a missing family.');
    }
    for (const x of [SOUTH_PASS.x, 1000, -500, EAST_ORIGIN + 500]) {
      world.player.sprite.body.reset(x, SOUTH_ORIGIN - 60);
      world.movement.keys.S.isDown = true;
      await new Promise((resolve) => setTimeout(resolve, 550));
      world.movement.keys.S.isDown = false;
      assert(world.player.sprite.body.bottom <= SOUTH_ORIGIN + 1, `Southern wall was bypassed at x=${x}.`);
    }
    const follower = world.leaderFollowerSystem.followers[0].sprite;
    for (const x of [SOUTH_PASS.x, 1000, -500, EAST_ORIGIN + 500]) {
      follower.body.reset(x, SOUTH_ORIGIN - 60);
      follower.setPosition(x, SOUTH_ORIGIN + 80);
      world.constrainFollowerToLayer(follower, x, SOUTH_ORIGIN - 60, world.southLayer, world.southWalls);
      assert(follower.body.bottom <= SOUTH_ORIGIN + 1, `Follower bypassed southern wall at x=${x}.`);
    }
    for (const removed of selected) {
      collection.collectedIds = new Set(selected.filter((item) => item !== removed).map((item) => item.id));
      world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'dialogue' && !world.southOpen,
        `Wizard allowed entry without ${removed.id}.`);
      world.dialogueWindow.close();
    }
    collection.collectedIds = new Set(selected.map((item) => item.id));
    let { battle, challenge } = await start();
    battle.time.removeAllEvents();
    assert(battle.girls.length === 2 && battle.unicorns.length === 4 && battle.wizardLives === 7 && battle.girlLives === 5
      && battle.difficulty === minigameSpeed(world.player.age), 'Wizard battle did not initialize correctly.');
    const chosenEquipment = battle.equipment.flat();
    assert(chosenEquipment.length === 16 && new Set(chosenEquipment.map((item) => item.id)).size === 16
      && battle.equipment.every((items) => new Set(items.map((item) => item.slot)).size === 4)
      && chosenEquipment.every((item) => selectedAccessories.some((candidate) => candidate.id === item.id))
      && JSON.stringify([...collection.equipment]) === JSON.stringify([...savedEquipment]),
    'Unicorn equipment was not drawn uniquely from the collected accessories.');
    const before = battle.girls.map((girl) => girl.x);
    battle.keys.D.isDown = true;
    await waitUntil(() => battle.girls[0].x > before[0] + 10, 'Girls did not move together.');
    battle.keys.D.isDown = false;
    assert(battle.girls[1].x > before[1] + 10, 'Second girl did not follow the controls.');
    battle.shootStar();
    assert(battle.stars.getLength() === 1 && battle.stars.getChildren()[0].body.velocity.length() > 0,
      'Wizard did not shoot a moving star.');
    const firstStar = battle.stars.getChildren()[0];
    firstStar.body.reset(battle.girls[0].x, battle.girls[0].y);
    await waitUntil(() => battle.girlLives === 4, 'The registered star collider did not hit a girl.');
    assert(!firstStar.active && battle.girls[0].active, 'A star hit destroyed the girl instead of the star.');
    battle.hitGirls(battle.girls[1], battle.stars.create(400, 300, 'wizard-star'));
    assert(battle.girlLives === 4, 'Shared lives or invulnerability failed.');
    for (let hit = 0; hit < 4; hit += 1) {
      battle.invulnerableUntil = 0;
      battle.hitGirls(battle.girls[hit % 2], battle.stars.create(400, 300, 'wizard-star'));
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Wizard defeat did not resume the world.');
    assert(!world.southOpen && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Losing the battle opened the passage or credited the question.');
    world.dialogueWindow.close();
    ({ battle, challenge } = await start());
    battle.time.removeAllEvents();
    for (let index = 0; index < 4; index += 1) {
      battle.input.keyboard.emit('keydown', { key: String(index + 1), repeat: false });
    }
    assert(battle.beams.getLength() === 4, 'Keys 1–4 did not fire all four unicorns.');
    assert(battle.beams.getChildren().every((beam) => beam.body.velocity.x === 430)
      && battle.wizard.body.height + battle.beams.getChildren()[0].body.height >= 120,
    'Wizard can hide between beams or the beams are not slower.');
    battle.handleShot({ key: '1', repeat: true });
    battle.handleShot({ key: '5', repeat: false });
    assert(battle.beams.getLength() === 4, 'Repeated or invalid key fired another beam.');
    battle.beams.clear(true, true);
    const dodgeBeam = battle.beams.create(battle.wizard.x - 100, battle.wizard.y - 20, 'wizard-beam');
    battle.update();
    assert(battle.wizard.body.velocity.y > 0, 'Wizard did not try to dodge an approaching beam.');
    dodgeBeam.destroy();
    battle.lastShots[0] = -Infinity;
    battle.handleShot({ key: '1', repeat: false });
    const firstBeam = battle.beams.getChildren()[0];
    firstBeam.body.reset(battle.wizard.x, battle.wizard.y);
    await waitUntil(() => battle.wizardLives === 6, 'The registered beam collider did not hit the wizard.');
    assert(!firstBeam.active && battle.wizard.active && battle.wizard.body
      && battle.score.text.includes('6 / 7') && !battle.finished,
    'A real beam hit destroyed the wizard or failed to update his lives.');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert(battle.wizard.active && battle.wizard.body, 'Wizard did not remain active after the first physics update.');
    for (let hit = 1; hit < 7; hit += 1) {
      battle.beams.create(battle.wizard.x, battle.wizard.y, 'wizard-beam');
      await waitUntil(() => battle.wizardLives === 6 - hit, 'A beam did not remove exactly one wizard life.');
      if (hit < 6) assert(!battle.finished && battle.wizard.active, 'Wizard lost before seven hits.');
    }
    await waitUntil(() => world.sys.isActive() && !battle.sys.isActive(), 'Wizard victory did not resume the world.');
    assert(world.southOpen && !world.southMap.getTileAt(64, 0).collides
      && world.southMap.getTileAt(30, 0).collides
      && collection.store.loadState().unlockedGates.has('south')
      && world.stateManager.learnedChallengeIds.has(challenge.id), 'Victory did not save and open the southern gate.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 60);
    world.leaderFollowerSystem.followers[0].sprite.body.reset(SOUTH_PASS.x, SOUTH_ORIGIN - 150);
    world.setLeader(world.player.id);
    world.movement.keys.S.isDown = true;
    await waitUntil(() => world.players.every((player) => player.sprite.y > SOUTH_ORIGIN + 70),
      'Both players could not walk through the opened southern gate.');
    world.movement.keys.S.isDown = false;
    world.movement.keys.W.isDown = true;
    await waitUntil(() => world.players.every((player) => player.sprite.y < SOUTH_ORIGIN - 30),
      'Both players could not walk back through the opened southern gate.');
    world.movement.keys.W.isDown = false;
  } finally {
    collection.store = originalStore;
    if (game.scene.isActive('WizardBattleScene')) world.scene.stop('WizardBattleScene');
    if (!world.sys.isActive()) world.scene.resume();
    world.movement.keys.S.isDown = false;
    world.movement.keys.W.isDown = false;
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed, saved.unlockedGates);
    collection.collectedIds = savedIds;
    world.southMap.setCollision(WORLD_TILE.SOUTH_GATE, true);
    for (let x = 62; x <= 66; x += 1) world.southMap.putTileAt(WORLD_TILE.SOUTH_GATE, x, 0);
    world.southOpen = false;
    world.southWizard.setVisible(true);
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('south-wizard');
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export async function testFairyShooter(world) {
  const game = world.game;
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  sounds.play = (name) => heard.push(name);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert(condition(), message);
  };
  const fairy = (id) => world.npcManager.npcs.find((npc) => npc.id === id);
  const launch = async (id) => {
    const npc = fairy(id);
    const originalStart = world.startChallenge;
    let challenge;
    world.startChallenge = function (selected, ...args) {
      challenge = selected;
      return originalStart.call(this, selected, ...args);
    };
    try {
      world.npcManager.runInteraction(npc);
      if (world.dialogueWindow.isOpen) {
        while (world.dialogueWindow.mode === 'dialogue') {
          world.dialogueWindow.advance();
        }
        if (world.dialogueWindow.mode === 'quest') {
          world.dialogueWindow.chooseQuest(true);
        }
      }
    } finally {
      world.startChallenge = originalStart;
    }
    assert(challenge && challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age)
      && !world.npcManager.getGateChallengeIds().includes(challenge.id),
    `${id} did not select a suitable non-reserved question.`);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), `${id} question did not start.`);
    const correct = question.challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, challenge.correctAnswer)
    ));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const shooter = game.scene.getScene('MosquitoScene');
    await waitUntil(() => shooter.sys.isActive(), `${id} shooter did not start.`);
    assert(shooter.difficulty === minigameSpeed(world.player.age), 'Mosquito game used the wrong player age.');
    assert(world.sys.isPaused() && world.isAnswering && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      `${id} was marked complete before the shooter was won.`);
    return { shooter, challenge };
  };
  const hit = async (shooter) => {
    const before = shooter.hits;
    const mosquito = shooter.mosquitoes.create(400, 200, 'mosquito-game-mosquito');
    mosquito.body.setVelocity(0, 0);
    shooter.stars.create(400, 200, 'mosquito-game-star');
    await waitUntil(() => shooter.hits === before + 1, 'Star did not hit mosquito.');
  };
  const win = async (shooter) => {
    shooter.time.removeAllEvents();
    shooter.stars.clear(true, true);
    shooter.mosquitoes.clear(true, true);
    for (let count = 0; count < 10; count += 1) {
      await hit(shooter);
      if (count < 9) {
        assert(!shooter.finished, 'Shooter ended before ten hits.');
      }
    }
    await waitUntil(() => world.sys.isActive() && !shooter.sys.isActive(), 'World did not resume after winning.');
  };
  const lose = async (shooter) => {
    shooter.time.removeAllEvents();
    shooter.stars.clear(true, true);
    shooter.mosquitoes.clear(true, true);
    for (let count = 0; count < 20; count += 1) {
      shooter.mosquitoes.create(400, 622, 'mosquito-game-mosquito');
      shooter.update();
    }
    assert(shooter.escaped === 20 && !shooter.finished, 'Shooter ended before more than 20 mosquitoes escaped.');
    shooter.spawnMosquito();
    shooter.update();
    shooter.mosquitoes.create(400, 622, 'mosquito-game-mosquito');
    shooter.update();
    await waitUntil(() => world.sys.isActive() && !shooter.sys.isActive(), 'World did not resume after losing.');
  };

  const firstPlayer = world.player.id;
  world.stateManager.recordAccessory(firstPlayer);
  let attempt = await launch('flora');
  let { shooter, challenge } = attempt;
  const firstFloraQuestion = challenge.id;
  assert(heard.pop() === 'mosquitoStart', 'Mosquito game did not play its start sound.');
  assert(heard.pop() === 'questionCorrect', 'Fairy question did not play its completion sound.');
  const originalBuzz = sounds.startMosquitoBuzz;
  let buzzStarted = 0;
  let buzzStopped = 0;
  sounds.startMosquitoBuzz = () => {
    buzzStarted += 1;
    return { stop: () => { buzzStopped += 1; } };
  };
  shooter.time.removeAllEvents();
  shooter.spawnMosquito();
  assert(shooter.mosquitoes.getChildren()[0].body.velocity.y === 55 * shooter.difficulty,
    'Mosquito speed did not use the difficulty.');
  shooter.update();
  shooter.update();
  assert(buzzStarted === 1 && buzzStopped === 0, 'Buzz did not start once for mosquitoes.');
  shooter.events.emit('pause');
  assert(buzzStopped === 1 && !shooter.buzz, 'Pausing did not stop the buzz.');
  shooter.update();
  assert(buzzStarted === 2, 'Buzz did not resume with mosquitoes present.');
  shooter.mosquitoes.clear(true, true);
  shooter.update();
  assert(buzzStopped === 2 && !shooter.buzz, 'Buzz did not stop after the last mosquito.');
  shooter.spawnMosquito();
  shooter.update();
  assert(buzzStarted === 3, 'Buzz did not restart for a new mosquito.');
  shooter.mosquitoes.clear(true, true);
  assert(world.worldMap.getTileAt(64, 16).collides, 'Flora gate opened before the shooter.');
  shooter.pointWand({ x: 600, y: 370 });
  shooter.input.keyboard.emit('keydown-SPACE', { repeat: false });
  assert(shooter.stars.getLength() === 1, 'MELLEMRUM did not fire one star.');
  assert(heard.pop() === 'star', 'Star did not play its firing sound.');
  shooter.input.keyboard.emit('keydown-SPACE', { repeat: true });
  assert(shooter.stars.getLength() === 1 && heard.length === 0, 'Holding space fired another star.');
  const single = shooter.stars.getChildren()[0];
  assert(single.body.velocity.x > 0 && single.body.velocity.y < 0
    && Math.abs(single.body.velocity.x + single.body.velocity.y) < 0.01,
  'Space star did not aim toward the cursor.');
  shooter.stars.clear(true, true);
  await clickCanvas(game, 200, 370);
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert(shooter.stars.getLength() === 0 && heard.length === 0, 'Mouse click fired stars or played a shot.');
  await lose(shooter);
  assert(buzzStarted === 4 && buzzStopped === 4 && !shooter.buzz, 'Buzz did not stop when the game ended.');
  sounds.startMosquitoBuzz = originalBuzz;
  assert(heard.filter((name) => name === 'mosquitoEscape').length === 21
    && heard.filter((name) => name === 'mosquitoLose').length === 1,
  'Escaping mosquitoes or losing did not play the correct sounds.');
  heard.length = 0;
  assert(world.player.id !== firstPlayer && world.worldMap.getTileAt(64, 16).collides
    && !world.stateManager.getLearnedChallengeIds().includes(firstFloraQuestion)
    && world.stateManager.turnPoints.get(firstPlayer) === 1 && world.dialogueWindow.isOpen,
  'Losing did not switch players, preserve points, and leave the question and gate unfinished.');
  world.dialogueWindow.close();
  attempt = await launch('flora');
  ({ shooter, challenge } = attempt);
  assert(challenge.id !== firstFloraQuestion, 'Flora repeated her last question despite available alternatives.');
  await win(shooter);
  assert(heard.filter((name) => name === 'mosquitoHit').length === 10
    && heard.filter((name) => name === 'mosquitoWin').length === 1,
  'Hits or winning did not play the correct sounds.');
  heard.length = 0;
  assert(!world.worldMap.getTileAt(64, 16).collides
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
    && world.stateManager.turnPoints.get(world.player.id) === 2 && world.dialogueWindow.isOpen,
  'Winning Flora shooter did not open the gate and credit the question.');
  world.dialogueWindow.close();

  attempt = await launch('luna');
  ({ shooter, challenge } = attempt);
  const firstLunaQuestion = challenge.id;
  assert(world.worldMap.getTileAt(68, 52).collides
    && !world.questManager.getQuest('rainbow-forest-rainbow').completed,
  'Luna quest or gate completed before the shooter.');
  const lunaPlayer = world.player.id;
  await lose(shooter);
  assert(world.player.id !== lunaPlayer && world.worldMap.getTileAt(68, 52).collides
    && !world.questManager.getQuest('rainbow-forest-rainbow').completed
    && world.questManager.getActiveQuests().some((quest) => quest.id === 'rainbow-forest-rainbow')
    && !world.stateManager.getLearnedChallengeIds().includes(firstLunaQuestion)
    && world.stateManager.turnPoints.get(lunaPlayer) === 2,
  'Losing Luna shooter changed the quest, gate, question or unfinished points.');
  world.dialogueWindow.close();
  world.swapLeader();
  attempt = await launch('luna');
  ({ shooter, challenge } = attempt);
  assert(challenge.id !== firstLunaQuestion, 'Luna repeated her last question despite available alternatives.');
  await win(shooter);
  assert(!world.worldMap.getTileAt(68, 52).collides
    && world.questManager.getQuest('rainbow-forest-rainbow').completed
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
    && world.player.id === firstPlayer,
  'Winning Luna shooter did not complete the quest, open the gate and count the question.');
  world.dialogueWindow.close();
  attempt = await launch('west-fairy');
  ({ shooter, challenge } = attempt);
  const westQuestion = challenge.id;
  const westPlayer = world.player.id;
  await lose(shooter);
  assert(world.player.id !== westPlayer && world.westMap.getTileAt(16, 27).collides
    && !world.stateManager.getLearnedChallengeIds().includes(westQuestion),
  'Losing Iris’s game did not preserve the western forest and question.');
  world.dialogueWindow.close();
  attempt = await launch('west-fairy');
  ({ shooter, challenge } = attempt);
  await win(shooter);
  assert(!world.westMap.getTileAt(16, 27).collides && world.westMap.getTileAt(23, 52).collides
    && world.stateManager.getLearnedChallengeIds().includes(challenge.id),
  'Winning Iris’s game did not open only the western forest and credit the question.');
  world.dialogueWindow.close();
  sounds.play = originalPlay;
}

export async function testTrollGame(world) {
  const game = world.game;
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert(condition(), message);
  };
  const start = async (npcId, challengeId, gateX, gateY) => {
    const player = world.player;
    const category = world.challengeManager.getChallenge(challengeId).category;
    world.npcManager.runInteraction(world.npcManager.npcs.find((npc) => npc.id === npcId));
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), `${npcId} question did not start.`);
    assert(question.challenge.category === category
      && question.challenge.difficulty === world.challengeManager.getDifficultyForAge(player.age),
    `${npcId} question did not match the active player's category and age.`);
    const correct = question.challenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, question.challenge.correctAnswer)
    ));
    const questionId = question.challenge.id;
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const troll = game.scene.getScene('TrollScene');
    await waitUntil(() => troll.sys.isActive(), `${npcId} game did not start.`);
    troll.questionId = questionId;
    assert(troll.difficulty === minigameSpeed(player.age), 'Troll game used the wrong player age.');
    const map = npcId === 'north-troll' ? world.northMap : npcId === 'west-troll' ? world.westMap : world.worldMap;
    assert(world.sys.isPaused() && world.isAnswering && map.getTileAt(gateX, gateY).collides
      && !world.stateManager.getLearnedChallengeIds().includes(questionId)
      && troll.player.texture.key === player.avatar && troll.player.x < 400
      && troll.children.list.some((object) => object.text === player.name),
    'Troll game did not preserve the active player or keep the bridge and question unfinished.');
    return troll;
  };
  const overlap = (troll, group, callback) => {
    const object = group.getChildren()[0];
    object.body.reset(troll.player.x, troll.player.y);
    troll.physics.overlap(troll.player, object, callback, undefined, troll);
  };
  try {
    sounds.play = (name) => heard.push(name);
    const first = world.player.id;
    world.stateManager.recordAccessory(first);
    let troll = await start('bridge-troll', 'math-addition', 31, 32);
    assert(heard.includes('trollMusicLow'), 'Troll music did not start.');
    await waitUntil(() => troll.rocks.getLength() > 0, 'Troll did not throw rocks automatically.');
    assert(Math.abs(troll.rocks.getChildren()[0].body.velocity.length() - 240 * troll.difficulty) < 0.001,
      'Rock speed did not use the difficulty.');
    assert(heard.includes('trollMusicHigh') && heard.includes('trollThrow'),
      'Troll music or automatic throwing did not continue.');
    troll.rocks.clear(true, true);
    troll.movement.keys.D.isDown = true;
    troll.update();
    assert(troll.player.body.velocity.x > 0, 'WASD did not move the troll-game player.');
    troll.movement.keys.D.isDown = false;
    troll.player.setPosition(500, 60);
    troll.update();
    assert(troll.player.x <= 380 && troll.player.y >= 135, 'Player left the permitted side of the arena.');
    troll.player.body.reset(190, 350);
    troll.throwRock();
    const rock = troll.rocks.getChildren()[0];
    assert(rock.body.velocity.x < 0 && heard.includes('trollThrow'), 'Troll did not throw a rock toward the player.');
    overlap(troll, troll.rocks, troll.hitPlayer);
    assert(troll.hits === 1 && heard.includes('trollRockHit'), 'Rock overlap did not count a hit.');
    troll.throwRock();
    overlap(troll, troll.rocks, troll.hitPlayer);
    assert(troll.hits === 1, 'Invulnerability did not prevent rapid repeated hits.');
    for (let hits = 2; hits <= 3; hits += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
      assert(troll.hits === hits, `Rock hit ${hits} was not counted.`);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after troll loss.');
    assert(world.player.id !== first && world.worldMap.getTileAt(31, 32).collides
      && !world.stateManager.getLearnedChallengeIds().includes(troll.questionId)
      && world.stateManager.turnPoints.get(first) === 1 && heard.includes('trollLose'),
    'Losing did not switch players or left incorrect bridge, question, points, or sound state.');
    world.dialogueWindow.close();
    heard.length = 0;
    troll = await start('bridge-troll', 'math-addition', 31, 32);
    troll.time.removeAllEvents();
    const winner = world.player.id;
    for (let count = troll.applesCollected + 1; count <= 7; count += 1) {
      overlap(troll, troll.apples, troll.collectApple);
      assert(troll.applesCollected === count, `Apple ${count} was not collected by overlap.`);
      if (count < 7) {
        assert(!troll.finished && troll.apples.getLength() === 1, 'Apple game ended too early or stopped spawning apples.');
      }
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after troll win.');
    assert(!world.worldMap.getTileAt(31, 32).collides && world.worldMap.getTileAt(93, 64).collides
      && world.stateManager.getLearnedChallengeIds().includes(troll.questionId)
      && world.stateManager.turnPoints.get(winner) === 2
      && heard.filter((name) => name === 'trollApple').length === 7 && heard.includes('trollWin'),
    'Winning did not open only the bridge, credit the question and play sounds.');
    world.dialogueWindow.close();
    const before = heard.filter((name) => name.startsWith('trollMusic')).length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert(heard.filter((name) => name.startsWith('trollMusic')).length === before,
      'Troll music continued after leaving the game.');

    troll = await start('river-troll', 'river-troll-berries', 93, 64);
    troll.time.removeAllEvents();
    const secondPlayer = world.player.id;
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after second troll loss.');
    assert(world.worldMap.getTileAt(93, 64).collides && world.player.id !== secondPlayer
      && !world.stateManager.getLearnedChallengeIds().includes(troll.questionId)
      && world.stateManager.turnPoints.get(secondPlayer) === 2,
    'Second troll loss changed the bridge, question, or unfinished points.');
    world.dialogueWindow.close();
    world.swapLeader();
    troll = await start('river-troll', 'river-troll-berries', 93, 64);
    troll.time.removeAllEvents();
    for (let count = troll.applesCollected; count < 7; count += 1) {
      overlap(troll, troll.apples, troll.collectApple);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after second troll.');
    assert(!world.worldMap.getTileAt(93, 64).collides
      && world.stateManager.getLearnedChallengeIds().includes(troll.questionId)
      && world.player.id === first,
    'Second troll win did not open the bridge or apply the question turn count.');
    world.dialogueWindow.close();
    troll = await start('west-troll', 'west-troll-apples', 23, 52);
    troll.time.removeAllEvents();
    const westPlayer = world.player.id;
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after western troll loss.');
    assert(world.player.id !== westPlayer && world.westMap.getTileAt(23, 52).collides
      && !world.stateManager.getLearnedChallengeIds().includes(troll.questionId),
    'Losing the western troll game changed the bridge or question.');
    world.dialogueWindow.close();
    troll = await start('west-troll', 'west-troll-apples', 23, 52);
    troll.time.removeAllEvents();
    while (troll.applesCollected < 7) {
      overlap(troll, troll.apples, troll.collectApple);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after western troll win.');
    assert(!world.westMap.getTileAt(23, 52).collides && world.westMap.getTileAt(16, 27).collides
      && world.stateManager.getLearnedChallengeIds().includes(troll.questionId),
    'Winning the western troll game did not open only its bridge and credit the question.');
    world.dialogueWindow.close();
    troll = await start('north-troll', 'north-troll-stones', 91, 20);
    troll.time.removeAllEvents();
    for (let count = 0; count < 3; count += 1) {
      troll.invulnerableUntil = 0;
      troll.throwRock();
      overlap(troll, troll.rocks, troll.hitPlayer);
    }
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after northern troll loss.');
    assert(world.northMap.getTileAt(91, 20).collides
      && !world.stateManager.getLearnedChallengeIds().includes(troll.questionId),
    'Losing the northern troll game opened the forest or credited the question.');
    world.dialogueWindow.close();
    troll = await start('north-troll', 'north-troll-stones', 91, 20);
    troll.time.removeAllEvents();
    while (troll.applesCollected < 7) overlap(troll, troll.apples, troll.collectApple);
    await waitUntil(() => world.sys.isActive() && !troll.sys.isActive(), 'World did not resume after northern troll win.');
    assert(!world.northMap.getTileAt(91, 20).collides
      && world.stateManager.getLearnedChallengeIds().includes(troll.questionId)
      && world.dialogueWindow.message.text.includes('mørkeskoven')
      && !world.dialogueWindow.message.text.includes('broen'),
    'Winning the northern troll game did not open the forest.');
    world.dialogueWindow.close();
  } finally {
    sounds.play = originalPlay;
  }
}
