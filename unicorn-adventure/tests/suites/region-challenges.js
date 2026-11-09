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

export function testCatMazeLayouts() {
  for (const rows of MAZE_LAYOUTS) {
    for (const age of [6, 7, 8]) {
      for (const chasing of [false, true]) {
        const scene = Object.create(CatMazeScene.prototype);
        Object.assign(scene, {
          mazeRows: rows, difficulty: minigameSpeed(age), finished: false, escaped: false,
          cursors: { up: {}, down: {}, left: {}, right: {} },
          keys: { W: {}, A: {}, S: {}, D: {} },
          finish(won) { this.finished = true; this.won = won; },
        });
        const actor = (x, y) => {
          const [px, py] = scene.toWorld(x, y);
          return {
            x, y, next: null, progress: 0,
            sprite: { x: px, y: py, setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; } },
          };
        };
        scene.runner = actor(1, 1);
        scene.cat = actor(1, 9);
        for (let frame = 0; frame < 1500 && !scene.finished; frame += 1) {
          if (chasing && !scene.runner.next) {
            const next = mazePath([scene.runner.x, scene.runner.y], [13, 1], rows)?.[1];
            scene.keys.W.isDown = Boolean(next && next[1] < scene.runner.y);
            scene.keys.S.isDown = Boolean(next && next[1] > scene.runner.y);
            scene.keys.A.isDown = Boolean(next && next[0] < scene.runner.x);
            scene.keys.D.isDown = Boolean(next && next[0] > scene.runner.x);
          }
          scene.update(0, 50);
        }
        assert(scene.finished && scene.won === chasing && scene.escaped !== chasing,
          `Cat maze could not ${chasing ? 'be won' : 'be lost'} at age ${age}.`);
      }
    }
  }
}

export async function testVolcano(world) {
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const ids = world.collectibleManager.collectedIds;
  const originalStart = world.startNPCChallenge;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  let outcome;
  const start = async (mode) => {
    outcome = undefined;
    world.scene.launch('VolcanoScene', {
      player: { name: world.player.name, avatar: world.player.avatar, age: world.player.age }, mode, onComplete: (won) => { outcome = won; },
    });
    world.scene.pause();
    const scene = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => scene.sys.isActive() && scene.mode === mode, `${mode} did not start.`);
    return scene;
  };
  try {
    world.player.sprite.body.reset(EAST_ORIGIN - 60, 400);
    const items = world.collectibleManager.getAllItems();
    const boots = items.filter((item) => item.type === 'tool' && item.kind === 'lava-boots');
    assert(boots.length === 2, 'The western region must contain two pairs of lava boots.');
    const westClosed = reachableWest([]);
    const westOpen = reachableWest([WORLD_TILE.WEST_BRIDGE]);
    for (const boot of boots) {
      assert(boot.y > 54 * 32 && !canReachWest(westClosed, boot) && canReachWest(westOpen, boot),
        `${boot.id} is not reachable exclusively beyond the western troll bridge.`);
      for (let seed = 0; seed < 10; seed += 1) {
        const placed = arrangeCollectibles(items, seed).find((item) => item.id === boot.id);
        assert(placed.x === boot.x && placed.y === boot.y, 'Lava boots moved during reshuffling.');
      }
    }
    const oldRequirements = [
      ...items.filter((item) => item.type === 'unicorn').slice(0, 2),
      ...items.filter((item) => item.slot === 'saddle').slice(0, 2),
      ...items.filter((item) => item.slot === 'wings').slice(0, 2),
    ].map((item) => item.id);
    for (const count of [0, 1]) {
      world.collectibleManager.collectedIds = new Set([...oldRequirements, ...boots.slice(0, count).map((item) => item.id)]);
      world.updateCollectionProgress();
      world.interactWithEastPass();
      assert(world.dialogueWindow.mode === 'dialogue'
        && world.dialogueWindow.message.text.includes(`${count} af 2`)
        && world.dialogueWindow.message.text.includes('vestlige verden syd for troldens bro')
        && world.hud.toolCounters.get('lava-boots').textContent.includes(`${count} / 2`),
      'Eastern crossing did not require both boots or provide guidance and progress.');
      world.dialogueWindow.close();
    }
    world.collectibleManager.collectedIds = new Set(boots.map((item) => item.id));
    let requested = false;
    world.startNPCChallenge = (id, onCorrect, miniGame, options) => {
      requested = miniGame === 'volcanoBridge' && options.randomForPlayer;
      onCorrect();
    };
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    assert(requested && world.player.sprite.x > EAST_ORIGIN && world.eastMap.getTileAt(0, 12).collides,
      'Eastern crossing did not launch the bridge or preserve the wall.');
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    assert(world.player.sprite.x < EAST_ORIGIN, 'Eastern return crossing failed.');
    world.startNPCChallenge = originalStart;
    world.interactWithEastPass();
    world.dialogueWindow.chooseQuest(true);
    const bridgeQuestion = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => bridgeQuestion.sys.isActive(), 'Boots did not lead to the volcano question.');
    const bridgeChallenge = bridgeQuestion.challenge;
    const correctBridge = bridgeChallenge.options.findIndex((option) => (
      world.challengeManager.answersMatch(option, bridgeChallenge.correctAnswer)
    ));
    bridgeQuestion.answerButtons[correctBridge].emit('pointerdown');
    bridgeQuestion.continueButton.emit('pointerdown');
    const bridgeGame = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => bridgeGame.sys.isActive() && bridgeGame.mode === 'bridge',
      'Answering the volcano question did not start the bridge game.');
    assert(!world.stateManager.learnedChallengeIds.has(bridgeChallenge.id), 'Bridge question was credited too early.');
    bridgeGame.finish(true);
    await waitUntil(() => world.sys.isActive() && !bridgeGame.sys.isActive(), 'Bridge victory did not resume the world.');
    assert(world.player.sprite.x > EAST_ORIGIN && world.stateManager.learnedChallengeIds.has(bridgeChallenge.id),
      'Bridge victory did not cross the wall and credit the question.');
    world.dialogueWindow.close();
    world.crossEastPass();
    world.player.sprite.body.reset(EAST_ORIGIN - 75, 400);
    world.movement.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    world.movement.keys.D.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.right <= EAST_ORIGIN + 1
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= EAST_ORIGIN + 1),
    'The eastern wall allowed players through from the west.');
    world.crossEastPass();
    world.player.sprite.body.reset(EAST_ORIGIN + 95, 400);
    world.movement.keys.A.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    world.movement.keys.A.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.left >= EAST_ORIGIN + 31
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.left >= EAST_ORIGIN + 31),
    'The eastern wall allowed players through from the volcano.');
    const sounds = world.registry.get('soundEffects');
    const play = sounds.play;
    const heard = [];
    try {
      sounds.play = (name) => heard.push(name);
      world.worldMusicRegion = null;
      world.updateWorldMusic(100, world.player);
      assert(heard.includes('worldVolcanoLow'), 'The volcanic region did not select its own music.');
    } finally {
      sounds.play = play;
      world.worldMusicRegion = null;
    }
    world.player.sprite.body.reset(EAST_ORIGIN + 150, 400);
    world.eruptionTimeRemaining = 1;
    world.dialogueWindow.showLines('Prøve', ['Vent']);
    world.updateEruptionEncounter(1000, world.player);
    assert(world.eruptionTimeRemaining === 1, 'Eruption timer did not pause during dialogue.');
    world.dialogueWindow.close();
    world.updateEruptionEncounter(1, world.player);
    assert(world.dialogueWindow.isOpen && world.eruptionTimeRemaining >= 30000
      && world.eruptionTimeRemaining <= 60000, 'Eruption encounter was not scheduled correctly.');
    world.dialogueWindow.advance();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Eruption question did not start.');
    const challenge = question.challenge;
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const eruption = world.game.scene.getScene('VolcanoScene');
    await waitUntil(() => eruption.sys.isActive() && eruption.mode === 'eruption', 'Eruption minigame did not start after the question.');
    assert(!world.stateManager.learnedChallengeIds.has(challenge.id), 'Eruption question was credited before the minigame.');
    const beforeFailure = world.player.id;
    eruption.finish(false);
    await waitUntil(() => !eruption.sys.isActive(), 'Failed eruption did not stop.');
    assert(world.player.id !== beforeFailure && !world.stateManager.learnedChallengeIds.has(challenge.id),
      'Failed eruption did not switch players or left the question credited.');
    world.dialogueWindow.close();
    let scene = await start('bridge');
    assert(scene.difficulty === minigameSpeed(world.player.age), 'Volcano game used the wrong player age.');
    scene.spawnHazard();
    assert(scene.hazards.getChildren()[0].body.velocity.y >= 100 * scene.difficulty,
      'Volcano hazard speed did not use the difficulty.');
    scene.hazards.clear(true, true);
    assert(scene.bridgeBarrier.body.enable, 'Bridge could be crossed before collecting pieces.');
    while (scene.progress < 5) scene.collect(scene.player, scene.items.getChildren()[0]);
    assert(!scene.bridgeBarrier.body.enable && outcome === undefined, 'Bridge did not require reaching the exit.');
    scene.player.setPosition(690, 480);
    scene.update(0, 16);
    assert(outcome === true, 'Built bridge did not allow victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Bridge scene did not stop.');
    scene = await start('crystals');
    while (scene.progress < 7) scene.collect(scene.player, scene.items.getChildren()[0]);
    assert(outcome === true, 'Crystal collection did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Crystal scene did not stop.');
    scene = await start('runes');
    assert(scene.runeVolcano, 'Rune game did not create its volcano.');
    await waitUntil(() => scene.hazards.getLength() > 0, 'Rune volcano did not launch sparks automatically.');
    const spark = scene.hazards.getChildren()[0];
    assert(spark.y <= 520 && spark.body.velocity.y < 0,
      'Rune volcano did not launch a spark upwards.');
    scene.hit(scene.player, spark);
    assert(scene.hits === 1 && !spark.active, 'Rune spark did not damage the player.');
    scene.invulnerableUntil = 0;
    scene.hit(scene.player, scene.hazards.create(400, 520, 'volcano-hazard'));
    scene.invulnerableUntil = 0;
    scene.hit(scene.player, scene.hazards.create(400, 520, 'volcano-hazard'));
    assert(outcome === false, 'Three rune sparks did not cause defeat.');
    await waitUntil(() => !scene.sys.isActive(), 'Rune defeat did not stop the scene.');
    scene = await start('runes');
    scene.collect(scene.player, scene.items.getChildren()[1]);
    assert(scene.progress === 0, 'Runes accepted the wrong order.');
    for (let i = 0; i < 4; i += 1) scene.collect(scene.player, scene.items.getChildren().find((item) => item.getData('index') === i));
    assert(outcome === true, 'Ordered runes did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Rune scene did not stop.');
    scene = await start('eruption');
    scene.progress = 0;
    scene.update(0, 14999);
    assert(outcome === undefined, 'Eruption ended too early.');
    scene.update(0, 1);
    assert(outcome === true, 'Surviving the eruption did not lead to victory.');
    await waitUntil(() => !scene.sys.isActive(), 'Eruption scene did not stop.');
    scene = await start('crystals');
    for (let i = 0; i < 3; i += 1) {
      scene.invulnerableUntil = 0;
      scene.hit(scene.player, scene.hazards.create(300, 200, 'volcano-hazard'));
    }
    assert(outcome === false, 'Three ember hits did not cause defeat.');
    await waitUntil(() => !scene.sys.isActive(), 'Defeat scene did not stop.');
  } finally {
    world.startNPCChallenge = originalStart;
    world.movement.keys.A.isDown = false;
    world.movement.keys.D.isDown = false;
    world.collectibleManager.collectedIds = ids;
    world.dialogueWindow.close();
    if (world.game.scene.isActive('VolcanoScene')) world.scene.stop('VolcanoScene');
    if (world.sys.isPaused()) world.scene.resume();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.wasInVolcano = false;
    world.eruptionTimeRemaining = world.nextWitchDelay();
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
  }
}

export async function testVolcanoCat(world) {
  const cat = world.npcManager.npcs.find((npc) => npc.id === 'volcano-cat');
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const begin = async () => {
    world.player.sprite.body.reset(cat.x, cat.y);
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC === cat, 'The roaming cat was not interactable at its current position.');
    world.handleSpace();
    const question = world.game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Cat question did not start.');
    assert(question.challenge.id === 'volcano-cat-reading', 'The cat asked the wrong question.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, question.challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !world.game.scene.isActive('CatMazeScene'), 'A wrong answer started the cat maze.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, question.challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const maze = world.game.scene.getScene('CatMazeScene');
    await waitUntil(() => maze.sys.isActive(), 'Cat maze did not start after the correct answer.');
    assert(maze.difficulty === minigameSpeed(world.player.age), 'Cat maze used the wrong player age.');
    assert(!world.stateManager.learnedChallengeIds.has('volcano-cat-reading'), 'Cat question was credited before capture.');
    return maze;
  };
  try {
    assert(cat && cat.sprite.texture.key === 'red-cat' && world.volcanoCatRoam, 'The red cat is missing.');
    const beforeWalk = { x: cat.x, y: cat.y };
    world.volcanoCatRoam.update(1000);
    assert(Phaser.Math.Distance.Between(beforeWalk.x, beforeWalk.y, cat.x, cat.y) > 1
      && cat.sprite.x === cat.x && cat.sprite.y === cat.y, 'Cat did not roam or its interaction position was stale.');
    const beforeEscape = { x: cat.x, y: cat.y };
    let maze = await begin();
    const playerBeforeFailure = world.player.id;
    for (let i = 0; i < 1000 && !maze.finished; i += 1) maze.update(0, 50);
    assert(maze.finished && maze.escaped, 'Cat did not follow the maze to its exit.');
    await waitUntil(() => !maze.sys.isActive() && world.sys.isActive(), 'World did not resume after the cat escaped.');
    assert(Phaser.Math.Distance.Between(beforeEscape.x, beforeEscape.y, cat.x, cat.y) >= 900
      && world.player.id !== playerBeforeFailure && cat.interactionIndex === 0
      && !cat.following && world.leaderFollowerSystem.companions.length === 0
      && !world.stateManager.learnedChallengeIds.has('volcano-cat-reading'),
    'Escaping cat did not relocate far away, switch players, and leave the question unfinished.');
    world.dialogueWindow.close();
    const accessible = reachableVolcano([]);
    for (let i = 0; i < 30; i += 1) {
      const previous = { x: cat.x, y: cat.y };
      world.volcanoCatRoam.respawn();
      assert(Phaser.Math.Distance.Between(previous.x, previous.y, cat.x, cat.y) >= 900,
        'Cat respawned too close to its previous position.');
      for (let step = 0; step < 20; step += 1) {
        world.volcanoCatRoam.update(1000);
        assert(canReachVolcano(accessible, cat), 'Cat wandered into a blocked or inaccessible volcanic area.');
      }
    }
    maze = await begin();
    for (let i = 0; i < 500 && !maze.finished; i += 1) {
      if (!maze.runner.next) {
        const path = mazePath([maze.runner.x, maze.runner.y], [13, 1], maze.mazeRows);
        const next = path?.[1];
        maze.keys.W.isDown = Boolean(next && next[1] < maze.runner.y);
        maze.keys.S.isDown = Boolean(next && next[1] > maze.runner.y);
        maze.keys.A.isDown = Boolean(next && next[0] < maze.runner.x);
        maze.keys.D.isDown = Boolean(next && next[0] > maze.runner.x);
      }
      maze.update(0, 50);
    }
    await waitUntil(() => !maze.sys.isActive() && world.sys.isActive(), 'World did not resume after catching the cat.');
    assert(maze.finished && !maze.escaped && cat.interactionIndex === 1
      && world.stateManager.learnedChallengeIds.has('volcano-cat-reading')
      && cat.following && world.leaderFollowerSystem.companions[0] === cat && !cat.nameTag.visible,
    'Following a valid maze route did not capture the cat and credit the question.');
    world.dialogueWindow.close();
    world.npcManager.update(world.player);
    assert(world.npcManager.activeNPC !== cat, 'The companion still blocked interactions as a nearby NPC.');
    const start = { x: cat.sprite.x, y: cat.sprite.y };
    world.player.sprite.body.reset(start.x + 250, start.y);
    world.leaderFollowerSystem.setLeader(world.player.id);
    world.leaderFollowerSystem.update(100);
    assert(cat.sprite.x !== start.x && world.leaderFollowerSystem.followers.at(-1) === cat,
      'Captured cat did not follow the leader trail.');
    const beforeSwap = world.player.id;
    world.swapLeader();
    assert(world.player.id !== beforeSwap && world.player.id !== cat.id
      && world.leaderFollowerSystem.companions[0] === cat, 'Turn switching selected or lost the cat.');
    const sounds = world.registry.get('soundEffects');
    const originalPlay = sounds.play;
    const heard = [];
    try {
      sounds.play = (name) => heard.push(name);
      world.catMeowTimeRemaining = 10000;
      world.updateCatMeow(9999);
      assert(!heard.includes('catMeow'), 'Cat meowed before the interval elapsed.');
      world.updateCatMeow(1);
      assert(heard.filter((name) => name === 'catMeow').length === 1
        && world.catMeowTimeRemaining >= 10000 && world.catMeowTimeRemaining <= 15000,
      'Cat did not meow and schedule another 10–15 second interval.');
    } finally {
      sounds.play = originalPlay;
    }
    world.player.sprite.body.reset(EAST_ORIGIN + 90, 400);
    world.crossEastPass();
    assert(cat.sprite.body.right < EAST_ORIGIN, 'The cat did not cross the eastern wall with the players.');
    world.player.sprite.body.reset(90, 400);
    world.crossWestWall();
    assert(cat.sprite.body.right < 0, 'The cat did not cross the western wall with the players.');
    world.player.sprite.body.reset(816, 58);
    world.crossNorthWall();
    assert(cat.sprite.body.bottom < 0, 'The cat did not cross the northern wall with the players.');
    world.enterStable();
    const stable = world.game.scene.getScene('StableScene');
    await waitUntil(() => stable.sys.isActive() && stable.followers?.companions.length === 1,
      'Captured cat did not follow the players into the stable.');
    assert(stable.followers.companions[0].sprite.texture.key === 'red-cat', 'Stable companion is not the red cat.');
    const meowBefore = world.catMeowTimeRemaining;
    stable.update(0, 100);
    assert(world.catMeowTimeRemaining < meowBefore, 'The meow timer did not continue in the stable.');
    stable.scene.stop();
    world.scene.resume();
    await waitUntil(() => world.sys.isActive() && !stable.sys.isActive(), 'World did not resume after leaving the stable.');
  } finally {
    world.dialogueWindow.close();
    if (world.game.scene.isActive('CatMazeScene')) world.scene.stop('CatMazeScene');
    if (world.sys.isPaused()) world.scene.resume();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    cat.interactionIndex = 0;
    cat.following = false;
    cat.nameTag.setVisible(true);
    world.leaderFollowerSystem.companions = [];
    if (cat.sprite.body) world.physics.world.disable(cat.sprite);
    world.catMeowTimeRemaining = null;
    world.northFollowerNavigators.delete(cat.sprite);
    world.eastFollowerNavigators.delete(cat.sprite);
    world.volcanoCatRoam.update(0);
  }
}

export async function testWitchEncounter(world) {
  const game = world.game;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const leaderId = world.player.id;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(816, -150);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(1, world.player);
    assert(world.dialogueWindow.isOpen && world.dialogueWindow.speaker.text === 'Heksen'
      && world.witchAppearance.visible && world.witchTimeRemaining >= 30000 && world.witchTimeRemaining <= 60000,
    'Witch did not appear or schedule the next encounter in the required interval.');
    world.dialogueWindow.advance();
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Witch question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('WitchMazeScene'), 'A wrong answer started the maze.');
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const maze = game.scene.getScene('WitchMazeScene');
    await waitUntil(() => maze.sys.isActive(), 'Witch maze did not start.');
    assert(!world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && maze.runner.sprite.texture.key === world.player.avatar,
    'Witch question was credited too early or used the wrong player.');
    return { maze, challenge };
  };
  try {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0;
      assert(world.nextWitchDelay() === 30000, 'Witch delay does not include 30 seconds.');
      Math.random = () => 0.999999;
      assert(world.nextWitchDelay() === 60000, 'Witch delay does not include 60 seconds.');
    } finally {
      Math.random = originalRandom;
    }
    for (let count = 0; count < 30; count += 1) {
      const delay = world.nextWitchDelay();
      assert(delay >= 30000 && delay <= 60000, 'Witch delay is outside 30–60 seconds.');
    }
    world.player.sprite.body.reset(500, 300);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(5000, world.player);
    assert(!world.dialogueWindow.isOpen, 'Witch appeared outside the northern region.');
    world.player.sprite.body.reset(816, -150);
    world.witchTimeRemaining = 30000;
    world.updateWitchEncounter(29999, world.player);
    assert(!world.dialogueWindow.isOpen && world.witchTimeRemaining === 1,
      'Witch appeared before the chosen exploration interval elapsed.');
    world.dialogueWindow.showLines('Prøve', ['Vent']);
    world.witchTimeRemaining = 1;
    world.updateWitchEncounter(5000, world.player);
    assert(world.dialogueWindow.speaker.text === 'Prøve' && world.witchTimeRemaining === 1,
      'Witch interrupted another dialogue.');
    world.dialogueWindow.close();
    assert(minigameSpeed(6) === 0.9 && minigameSpeed(7) === 1 && minigameSpeed(8) === 1.1,
      'Minigame difficulty does not respect the age boundaries.');
    assert(MAZE_LAYOUTS.length === 4 && new Set(MAZE_LAYOUTS.map((rows) => rows.join('\n'))).size === 4,
      'The maze must have four distinct configurations.');
    testCatMazeLayouts();
    for (const rows of MAZE_LAYOUTS) {
      assert(mazePath([1, 1], [13, 9], rows) && mazePath([13, 1], [1, 1], rows)
        && mazePath([1, 9], [13, 1], rows), 'A maze has no route between the starts and exits.');
      for (let y = 0; y < rows.length; y += 1) {
        for (let x = 0; x < rows[y].length; x += 1) {
          if (rows[y][x] === '.') assert(mazePath([x, y], [13, 9], rows), 'Maze has an isolated passage.');
        }
      }
    }
    let { maze, challenge } = await start();
    assert(maze.difficulty === minigameSpeed(world.player.age) && maze.blackCat.sprite.texture.key === 'black-cat',
      'Witch maze did not use the active player age or create the black cat.');
    const selection = {};
    const selected = [];
    for (let count = 0; count < 5; count += 1) {
      maze.selectMaze.call(selection);
      selected.push(selection.mazeIndex);
    }
    assert(new Set(selected.slice(0, 4)).size === 4 && selected[0] === selected[4],
      'Maze layouts do not rotate through all four before repeating.');
    maze.blackCat.x = maze.runner.x;
    maze.blackCat.y = maze.runner.y;
    maze.blackCat.next = null;
    maze.blackCat.progress = 0;
    maze.blackCat.sprite.setPosition(maze.runner.sprite.x, maze.runner.sprite.y);
    maze.update(maze.time.now, 0);
    assert(maze.captured && !maze.finished, 'Black cat did not capture the player.');
    const heldWitch = { x: maze.witch.sprite.x, y: maze.witch.sprite.y };
    maze.update(maze.time.now, 50);
    assert(maze.witch.sprite.x === heldWitch.x && maze.witch.sprite.y === heldWitch.y,
      'The witch moved while the player was held by the cat.');
    maze.input.keyboard.emit('keydown', { key: 'ArrowLeft', repeat: false });
    maze.handleWiggle({ key: 'a', repeat: false });
    maze.handleWiggle({ key: 'ArrowRight', repeat: true });
    assert(maze.wiggles.left === 1 && maze.wiggles.right === 0,
      'Repeated directions or key repeats incorrectly counted.');
    for (let count = 0; count < 4; count += 1) {
      maze.handleWiggle({ key: 'd', repeat: false });
      maze.handleWiggle({ key: 'a', repeat: false });
    }
    assert(maze.captured && maze.wiggles.left === 5 && maze.wiggles.right === 4,
      'The cat released the player before five wiggles on each side.');
    maze.handleWiggle({ key: 'ArrowRight', repeat: false });
    assert(!maze.captured && maze.catFleeRemaining > 0 && maze.catFleeGoal,
      'Completing the wiggles did not make the cat flee.');
    const catStart = { x: maze.blackCat.sprite.x, y: maze.blackCat.sprite.y };
    maze.update(maze.time.now, 50);
    assert(Phaser.Math.Distance.Between(catStart.x, catStart.y, maze.blackCat.sprite.x, maze.blackCat.sprite.y) > 0
      && !maze.captured, 'The released cat did not move away safely.');
    maze.blackCat.x = 1;
    maze.blackCat.y = 9;
    maze.blackCat.next = null;
    maze.blackCat.progress = 0;
    maze.blackCat.sprite.setPosition(...maze.toWorld(1, 9));
    const witchStart = { x: maze.witch.sprite.x, y: maze.witch.sprite.y };
    maze.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    maze.keys.D.isDown = false;
    assert(maze.runner.sprite.x > maze.toWorld(1, 1)[0]
      && Phaser.Math.Distance.Between(witchStart.x, witchStart.y, maze.witch.sprite.x, maze.witch.sprite.y) > 5,
      'Runner movement or witch pursuit did not work.');
    const loser = world.player.id;
    maze.witch.sprite.setPosition(maze.runner.sprite.x, maze.runner.sprite.y);
    maze.update(maze.time.now, 0);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after witch capture.');
    assert(world.player.id !== loser && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      'Witch capture did not switch players or left the question completed.');
    world.dialogueWindow.close();
    ({ maze, challenge } = await start());
    const route = mazePath([1, 1], [13, 9], maze.mazeRows);
    for (const step of route.slice(1)) {
      const dx = step[0] - maze.runner.x;
      const dy = step[1] - maze.runner.y;
      maze.keys.A.isDown = dx < 0;
      maze.keys.D.isDown = dx > 0;
      maze.keys.W.isDown = dy < 0;
      maze.keys.S.isDown = dy > 0;
      maze.moveActor(maze.runner, 44, (actor) => maze.chooseRunner(actor));
      if (maze.finished) break;
    }
    await waitUntil(() => world.sys.isActive(), 'Reaching the maze exit did not resume the world.');
    assert(world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.dialogueWindow.speaker.text === 'Heksens labyrint',
    'Maze victory did not credit the question.');
    world.dialogueWindow.close();
  } finally {
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('witch');
    world.wasInNorth = false;
    world.witchTimeRemaining = world.nextWitchDelay();
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export async function testNorthCave(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const savedIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const previousChallenge = world.lastNPCChallenges.get('north-hole');
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    let challenge;
    const originalStart = world.startChallenge;
    try {
      world.startChallenge = function (selected, ...args) {
        challenge = selected;
        return originalStart.call(this, selected, ...args);
      };
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'quest', 'Northern hole did not offer a crossing.');
      world.dialogueWindow.chooseQuest(true);
    } finally {
      world.startChallenge = originalStart;
    }
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Northern question did not start.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('CaveScene'), 'Wrong answer started the cave.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const cave = game.scene.getScene('CaveScene');
    await waitUntil(() => cave.sys.isActive(), 'Cave did not start.');
    assert(world.sys.isPaused() && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
      'Cave credited its question before victory.');
    return { cave, challenge };
  };
  try {
    assert(NORTH_REGION_DATA.length === NORTH_REGION_HEIGHT + 1
      && NORTH_REGION_DATA[NORTH_REGION_HEIGHT].every((tile) => tile === WORLD_TILE.WEST_WALL)
      && NORTH_REGION_DATA.some((row) => row.includes(WORLD_TILE.DARK_TREE))
      && world.northMap.getTileAt(Math.floor(NORTH_HOLE.x / 32) + WEST_REGION_WIDTH, NORTH_REGION_HEIGHT).collides,
    'Northern region, trees, or solid hole wall is missing.');
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    world.movement.keys.W.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    world.movement.keys.W.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.top >= -1
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.top >= -1),
    'The northern wall allowed walking through the hole.');
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    collection.collectedIds = new Set(collection.getAllItems()
      .filter((item) => item.type === 'unicorn' || item.slot === 'saddle' || item.slot === 'wings')
      .map((item) => item.id));
    world.handleSpace();
    assert(world.dialogueWindow.message.text.includes('lommelygten'), 'Northern crossing omitted the flashlight requirement.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set(['flashlight']);
    let { cave, challenge } = await start();
    assert(cave.difficulty === minigameSpeed(world.player.age)
      && Math.abs(cave.enemies.getChildren()[0].body.velocity.x) === 48 * cave.difficulty,
    'Cave enemies did not use the active player age.');
    assert(cave.lives === 5 && cave.enemies.getChildren().length === 5
      && cave.enemies.getChildren().some((enemy) => enemy.getData('kind') === 'ghost')
      && cave.enemies.getChildren().some((enemy) => enemy.getData('kind') === 'skeleton'),
    'Cave did not create its lives and both enemy types.');
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land on the floor.');
    cave.jump({ repeat: false });
    assert(cave.leader.body.velocity.y < 0, 'Cave leader could not jump.');
    const startX = cave.leader.x;
    cave.keys.D.isDown = true;
    await waitUntil(() => cave.leader.x > startX + 20, 'Cave leader could not move.');
    cave.keys.D.isDown = false;
    assert(cave.leader.x > startX + 20, 'Cave leader could not move.');
    cave.leader.body.reset(420, 470);
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land before the gap.');
    cave.keys.D.isDown = true;
    cave.jump({ repeat: false });
    await waitUntil(() => cave.leader.x > 660 || cave.leader.y > 650,
      'Cave leader did not reach the other side of the gap.');
    cave.keys.D.isDown = false;
    assert(cave.leader.x > 660 && cave.lives === 5, 'The first platform gap could not be jumped.');
    await waitUntil(() => cave.leader.body.blocked.down, 'Cave leader did not land after crossing the gap.');
    cave.hit(true);
    assert(cave.lives === 4 && cave.leader.y < 530, 'Falling did not cost a life and respawn.');
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.hit(false);
    assert(cave.lives === 3, 'Cave hit invulnerability failed.');
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.invulnerableUntil = 0;
    cave.hit(false);
    cave.invulnerableUntil = 0;
    const loser = world.player.id;
    cave.hit(false);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after cave loss.');
    assert(world.player.id !== loser && !world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.player.sprite.y >= 0, 'Cave loss switched incorrectly or crossed the wall.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(NORTH_HOLE.x, 70);
    ({ cave, challenge } = await start());
    cave.leader.body.reset(3601, 450);
    cave.update(cave.time.now);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after cave victory.');
    assert(world.players.every((player) => player.sprite.y < -32)
      && world.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Cave victory did not move both players north or credit the question.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(NORTH_HOLE.x, -80);
    ({ cave } = await start());
    cave.leader.body.reset(3601, 450);
    cave.update(cave.time.now);
    await waitUntil(() => world.sys.isActive(), 'World did not resume after return crossing.');
    assert(world.players.every((player) => player.sprite.y > 0), 'Return crossing did not move both players south.');
    world.dialogueWindow.close();
  } finally {
    collection.collectedIds = savedIds;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    if (previousChallenge === undefined) world.lastNPCChallenges.delete('north-hole');
    else world.lastNPCChallenges.set('north-hole', previousChallenge);
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export async function testLavaBootPickups(world) {
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const previousIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  try {
    for (const id of ['lava-boots-1', 'lava-boots-2']) {
      const item = collection.items.get(id);
      world.player.sprite.body.reset(item.x - 75, item.y);
      world.setLeader(world.player.id);
      world.movement.keys.D.isDown = true;
      const deadline = Date.now() + 5000;
      while (!collection.collectedIds.has(id) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      world.movement.keys.D.isDown = false;
      assert(collection.collectedIds.has(id) && collection.store.load().has(id),
        `Walking over ${id} did not collect and save it.`);
    }
    assert(world.hud.toolCounters.get('lava-boots').textContent.includes('2 / 2')
      && world.hud.toolProgress.textContent.includes('0 / 1'), 'Boot pickups changed the wrong counter.');
  } finally {
    world.movement.keys.D.isDown = false;
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed);
    collection.collectedIds = previousIds;
    for (const id of ['lava-boots-1', 'lava-boots-2']) {
      if (!collection.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === id)) {
        collection.createPickup(collection.items.get(id));
      }
    }
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.updateCollectionProgress();
  }
}

export async function testLakeBoat(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const saved = collection.store.loadState();
  const collected = collection.collectedIds;
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const sounds = world.registry.get('soundEffects');
  const originalPlay = sounds.play;
  const heard = [];
  const waitUntil = async (condition, message) => {
    const deadline = Date.now() + 10000;
    while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert(condition(), message);
  };
  const start = async () => {
    world.player.sprite.body.reset(LAKE.boatX, LAKE.shoreLandingY);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Shore boat did not offer a crossing.');
    world.dialogueWindow.chooseQuest(true);
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Boat question did not start.');
    const challenge = question.challenge;
    const wrong = challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('LakeBoatScene'), 'A wrong answer started the boat game.');
    const correct = challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const boat = game.scene.getScene('LakeBoatScene');
    await waitUntil(() => boat.sys.isActive(), 'Boat game did not start.');
    assert(world.sys.isPaused() && boat.difficulty === minigameSpeed(world.player.age)
      && !world.stateManager.learnedChallengeIds.has(challenge.id), 'Boat game credited the question too early or used the wrong age.');
    return { boat, challenge };
  };
  try {
    sounds.play = (name) => heard.push(name);
    assert(TEST_WORLD_DATA[LAKE.top][LAKE.left] === WORLD_TILE.WATER
      && TEST_WORLD_DATA[LAKE.bottom][LAKE.right] === WORLD_TILE.WATER
      && TEST_WORLD_DATA[LAKE.islandTop][LAKE.islandLeft] !== WORLD_TILE.WATER,
    'The larger lake or its island is missing.');
    const flashlight = collection.items.get('flashlight');
    assert(flashlight && collection.getTotalCount('tool') === 5
      && world.hud.toolProgress.textContent.includes('0 / 1'), 'Flashlight or its counter is missing.');
    for (let seed = 0; seed < 10; seed += 1) {
      const item = arrangeCollectibles(collection.getAllItems(), seed).find((candidate) => candidate.id === 'flashlight');
      assert(item.x === flashlight.x && item.y === flashlight.y, 'Flashlight moved off the island during shuffle.');
    }
    world.interactWithBoat();
    assert(world.dialogueWindow.message.text.includes('lommelygte'), 'Boat did not mention the uncollected flashlight.');
    world.dialogueWindow.close();
    collection.collectedIds = new Set([...collected, 'flashlight']);
    world.interactWithBoat();
    assert(!world.dialogueWindow.message.text.includes('lommelygte'), 'Boat still promised a collected flashlight.');
    world.dialogueWindow.close();
    collection.collectedIds = collected;
    let { boat, challenge } = await start();
    assert(heard.includes('lakeStart') && heard.includes('lakeMusicLow'), 'Lake start or music did not play.');
    await waitUntil(() => heard.includes('lakeMusicMid'), 'Lake music did not continue automatically.');
    boat.time.removeAllEvents();
    boat.playMusicBeat();
    assert(heard.includes('lakeMusicMid') && heard.includes('lakeMusicHigh'), 'Lake music did not advance.');
    boat.spawnFish();
    boat.spawnMonster();
    assert(heard.includes('lakeFish') && heard.includes('lakeMonster'), 'Lake hazards did not play their sounds.');
    const [fish, monster] = boat.hazards.getChildren();
    assert(fish.getData('kind') === 'fish' && fish.body.velocity.y === 150 * boat.difficulty
      && monster.getData('kind') === 'monster' && monster.body.velocity.y === 115 * boat.difficulty,
    'Boat hazards or their age-scaled speeds are incorrect.');
    const startX = boat.boat.x;
    boat.movement.keys.D.isDown = true;
    await waitUntil(() => boat.boat.x > startX + 10, 'Boat did not respond to steering.');
    boat.movement.keys.D.isDown = false;
    assert(heard.includes('lakePaddle'), 'Steering did not play a paddling sound.');
    fish.body.reset(boat.boat.x, boat.boat.y);
    boat.physics.overlap(boat.boat, fish, boat.hit, undefined, boat);
    assert(boat.hits === 1 && !fish.active, 'Jumping fish did not hit the boat.');
    assert(heard.filter((name) => name === 'lakeHit').length === 1, 'Boat hit did not play its sound.');
    boat.hit(boat.boat, monster);
    assert(boat.hits === 1 && !monster.active && heard.filter((name) => name === 'lakeHit').length === 1,
      'Boat hit invulnerability did not prevent repeated damage and sound.');
    const failedPlayer = world.player.id;
    for (let hit = 0; hit < 2; hit += 1) {
      boat.invulnerableUntil = 0;
      boat.hit(boat.boat, boat.hazards.getChildren()[0] ?? boat.hazards.create(400, 200, 'lake-fish'));
    }
    await waitUntil(() => world.sys.isActive() && !boat.sys.isActive(), 'Failed crossing did not resume the world.');
    assert(heard.includes('lakeLose'), 'Failed crossing did not play its sound.');
    assert(!world.boatOnIsland && world.player.id !== failedPlayer
      && !world.stateManager.learnedChallengeIds.has(challenge.id), 'Failed crossing changed island or question progress.');
    world.dialogueWindow.close();
    ({ boat, challenge } = await start());
    boat.time.removeAllEvents();
    boat.hazards.clear(true, true);
    boat.elapsed = 0;
    boat.update(0, 17999);
    assert(!boat.finished, 'Boat game ended too early.');
    boat.update(0, 1);
    await waitUntil(() => world.sys.isActive() && !boat.sys.isActive(), 'Successful crossing did not resume the world.');
    assert(heard.includes('lakeWin'), 'Successful crossing did not play its sound.');
    const soundCount = heard.length;
    boat.playMusicBeat();
    boat.spawnFish();
    boat.spawnMonster();
    boat.update(boat.time.now + 1000, 16);
    assert(heard.length === soundCount, 'Lake sounds continued after the game finished.');
    assert(world.boatOnIsland && world.stateManager.learnedChallengeIds.has(challenge.id)
      && world.players.every((player) => player.sprite.y === LAKE.islandLandingY),
    'Successful crossing did not move both players to the island or credit the question.');
    world.dialogueWindow.close();
    world.movement.keys.W.isDown = true;
    await waitUntil(() => collection.collectedIds.has('flashlight'), 'Walking on the island did not collect the flashlight.');
    world.movement.keys.W.isDown = false;
    assert(collection.collectedIds.has('flashlight') && collection.store.load().has('flashlight')
      && world.hud.toolProgress.textContent.includes('1 / 1'), 'Flashlight pickup was not saved or counted.');
    world.player.sprite.body.reset(LAKE.boatX, LAKE.islandLandingY);
    world.handleSpace();
    assert(world.dialogueWindow.mode === 'quest', 'Island boat did not offer a return trip.');
    world.dialogueWindow.chooseQuest(true);
    assert(!world.boatOnIsland && world.players.every((player) => player.sprite.y === LAKE.shoreLandingY),
      'Return trip did not bring both players to the shore.');
  } finally {
    sounds.play = originalPlay;
    if (game.scene.isActive('LakeBoatScene')) world.scene.stop('LakeBoatScene');
    if (!world.sys.isActive()) world.scene.resume();
    world.movement.keys.W.isDown = false;
    if (world.dialogueWindow.isOpen) world.dialogueWindow.close();
    collection.store.save(saved.collectedIds, saved.equipment, saved.layoutSeed);
    collection.collectedIds = collected;
    if (!collection.pickups.getChildren().some((pickup) => pickup.getData('collectibleId') === 'flashlight')) {
      collection.createPickup(collection.items.get('flashlight'));
    }
    world.updateCollectionProgress();
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    world.lastNPCChallenges.delete('lake-boat');
    world.boatOnIsland = false;
    world.lakeBoat.setPosition(LAKE.boatX, LAKE.shoreY);
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
  }
}

export async function testFlight(world) {
  const game = world.game;
  const collection = world.collectibleManager;
  const savedIds = collection.collectedIds;
  const leaderId = world.player.id;
  const positions = world.players.map((player) => ({ player, x: player.sprite.x, y: player.sprite.y }));
  const learned = new Set(world.stateManager.learnedChallengeIds);
  const points = new Map(world.stateManager.turnPoints);
  const previousChallenge = world.lastNPCChallenges.get('west-crack');
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
  const start = async () => {
    let challenge;
    const originalStart = world.startChallenge;
    try {
      world.startChallenge = function (selected, ...args) {
        challenge = selected;
        return originalStart.call(this, selected, ...args);
      };
      world.handleSpace();
      assert(world.dialogueWindow.mode === 'quest', 'Crack did not offer another crossing.');
      world.dialogueWindow.chooseQuest(true);
    } finally {
      world.startChallenge = originalStart;
    }
    assert(challenge && challenge.difficulty <= world.challengeManager.getDifficultyForAge(world.player.age),
      'Crack did not select a question appropriate for the active player.');
    const question = game.scene.getScene('ChallengeScene');
    await waitUntil(() => question.sys.isActive(), 'Flight question did not start.');
    const wrong = question.challenge.options.findIndex((option) => !world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[wrong].emit('pointerdown');
    assert(!question.isResolved && !game.scene.isActive('FlightScene'), 'Wrong answer started the flight.');
    const correct = question.challenge.options.findIndex((option) => world.challengeManager.answersMatch(option, challenge.correctAnswer));
    question.answerButtons[correct].emit('pointerdown');
    question.continueButton.emit('pointerdown');
    const flight = game.scene.getScene('FlightScene');
    await waitUntil(() => flight.sys.isActive(), 'Flight did not start after the correct answer.');
    assert(world.sys.isPaused() && world.isAnswering
      && !world.stateManager.getLearnedChallengeIds().includes(challenge.id),
    'Flight credited the question before victory.');
    return { flight, challenge };
  };
  try {
    sounds.play = (name) => heard.push(name);
    const items = collection.getAllItems();
    collection.collectedIds = new Set([
      ...items.filter((item) => item.type === 'unicorn').slice(0, 2),
      ...items.filter((item) => item.slot === 'saddle').slice(0, 2),
      ...items.filter((item) => item.slot === 'wings').slice(0, 2),
    ].map((item) => item.id));
    world.player.sprite.body.reset(50, WEST_CRACK.y);
    let { flight, challenge } = await start();
    assert(flight.difficulty === minigameSpeed(world.player.age), 'Flight used the wrong player age.');
    assert(flight.lives === 5 && flight.elapsed === 0 && flight.scoreText.text.includes('Tid tilbage: 20 sek.')
      && flight.direction === -1
      && flight.leader.list[1].text === world.player.name,
    'Flight did not start with the correct leader, direction, duration, and lives.');
    assert(heard.includes('flightStart') && heard.includes('flightMusicLow'), 'Flight sounds did not start.');
    flight.flap({ repeat: true });
    assert(!flight.started && !heard.includes('flightFlap'), 'Held space generated repeated flaps.');
    flight.update(0, 1000);
    assert(flight.elapsed === 0 && flight.lives === 5, 'Flight started before the first flap.');
    flight.flap({ repeat: false });
    assert(flight.started && flight.leader.body.velocity.y === -285 && heard.includes('flightFlap'),
      'Space did not start the flight and make the leader climb.');
    flight.trail = [{ time: flight.time.now, y: 570 }];
    flight.leader.body.reset(flight.leader.x, 260);
    flight.update(0, 0);
    assert(flight.follower.y === 570 && flight.lives === 5, 'Lava damaged the following rider.');
    flight.spawnBird();
    let bird = flight.pterodactyls.getChildren()[0];
    assert(bird.body.velocity.x === 185 * flight.difficulty && heard.includes('flightBird'),
      'Bird did not fly against westbound riders at the age-scaled speed.');
    bird.body.reset(flight.follower.x, flight.follower.y);
    flight.physics.overlap(flight.follower, bird, flight.hitBird, undefined, flight);
    assert(flight.lives === 5 && bird.active, 'Follower was vulnerable to a bird.');
    bird.body.reset(flight.leader.x, flight.leader.y);
    flight.physics.overlap(flight.leader, bird, flight.hitBird, undefined, flight);
    assert(flight.lives === 4 && heard.includes('flightBirdHit'), 'Bird did not hit the leader.');
    flight.hit('flightLava');
    assert(flight.lives === 4, 'Invulnerability did not prevent rapid repeated damage.');
    flight.invulnerableUntil = 0;
    flight.leader.body.reset(flight.leader.x, 550);
    flight.update(0, 0);
    assert(flight.lives === 3 && heard.includes('flightLava'), 'Rising lava did not hit the leader.');
    for (let lives = 2; lives >= 0; lives -= 1) {
      flight.invulnerableUntil = 0;
      flight.hit('flightBirdHit');
      assert(flight.lives === lives, 'Flight did not consume exactly one life per hit.');
    }
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after flight loss.');
    assert(world.player.id !== leaderId && world.player.sprite.x >= 0
      && !world.stateManager.getLearnedChallengeIds().includes(challenge.id) && heard.includes('flightLose'),
    'Flight loss did not switch players or left an incorrect question or position.');
    world.dialogueWindow.close();
    world.player.sprite.body.reset(50, WEST_CRACK.y);
    ({ flight, challenge } = await start());
    const winner = world.player.id;
    flight.flap({ repeat: false });
    flight.elapsed = 19950;
    flight.update(0, 0);
    assert(!flight.finished, 'Flight ended before its timer expired.');
    flight.update(0, 50);
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after flight victory.');
    assert(world.players.every((player) => player.sprite.body.right <= -32)
      && world.stateManager.getLearnedChallengeIds().includes(challenge.id)
      && world.stateManager.turnPoints.get(winner) === 2 && heard.includes('flightWin')
      && world.westMap.getTileAt(WEST_REGION_WIDTH - 1, 12).collides,
    'Victory did not move both players west, credit the question, and keep the wall closed.');
    world.dialogueWindow.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(world.isNearWestCrack() && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= -32),
      'Players did not stay west or could not reach the crack from the west.');
    world.swapLeader();
    assert(world.player.sprite.body.right <= -32, 'Switching leaders bypassed the wall.');
    world.player.sprite.body.reset(-90, WEST_CRACK.y);
    world.movement.keys.D.isDown = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    world.movement.keys.D.isDown = false;
    world.movement.update();
    assert(world.player.sprite.body.right <= -31 && world.player.sprite.x > -80
      && world.leaderFollowerSystem.players.every((player) => player.sprite.body.right <= -31),
    'Players did not reach or crossed the wall from the west.');
    world.player.sprite.body.reset(-70, WEST_CRACK.y);
    ({ flight } = await start());
    assert(flight.direction === 1, 'Return flight did not reverse direction.');
    flight.flap({ repeat: false });
    flight.spawnBird();
    bird = flight.pterodactyls.getChildren()[0];
    assert(bird.body.velocity.x < 0, 'Bird did not fly against eastbound riders.');
    flight.elapsed = 20000;
    flight.update(0, 0);
    await waitUntil(() => world.sys.isActive() && !flight.sys.isActive(), 'World did not resume after return flight.');
    assert(world.players.every((player) => player.sprite.body.left >= 0), 'Return flight did not bring both players east.');
    const before = heard.filter((name) => name.startsWith('flightMusic')).length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(heard.filter((name) => name.startsWith('flightMusic')).length === before, 'Flight music continued after leaving.');
  } finally {
    world.movement.keys.D.isDown = false;
    sounds.play = originalPlay;
    collection.collectedIds = savedIds;
    world.stateManager.learnedChallengeIds = learned;
    world.stateManager.turnPoints = points;
    if (previousChallenge === undefined) {
      world.lastNPCChallenges.delete('west-crack');
    } else {
      world.lastNPCChallenges.set('west-crack', previousChallenge);
    }
    positions.forEach(({ player, x, y }) => player.sprite.body.reset(x, y));
    world.setLeader(leaderId);
    world.dialogueWindow.close();
  }
}
