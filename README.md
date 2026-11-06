# silly_games
Small silly js/html games for kids. Mainly in Danish or teaching Danish->English

## Unicorn Adventure

`unicorn-adventure/` is an unfinished browser-based educational RPG built with Phaser 3. Run it from a local HTTP server (rather than opening the HTML file directly), because the game loads ES modules and JSON data.

### Current gameplay

- Explore a tile-based world with a forest path, a lake, and a river. Forest and water are blocked.
- The bridge troll guards the river crossing. Interact with the troll and answer its `3 + 4` challenge correctly to open the bridge.
- Move the active child with the arrow keys or **WASD**. Press **T** to switch the leader; the other child follows. Walk up to an NPC and press **SPACE** to interact.
- NPCs offer dialogue, quests, and educational challenges. Challenges are presented as story events and include age-scaled reading, math, English, and logic questions.
- Find unicorns around the map. Each encounter starts a challenge; answer correctly to add the unicorn to the collection. Pick up accessories such as a crown, saddle, and star sticker by walking over them. The HUD shows collection counts.

### What is not finished yet

- This is a small prototype with a test map and sample characters, NPCs, quests, collectibles, and challenges.
- Collected items, quest progress, and challenge progress are held in memory and reset when the page is reloaded.
- Accessories can be collected but cannot yet be equipped on a unicorn.

### To-do:

- Implement a stable where the collected unicorns can be outfitted with the accessories.
- Improve unicorn looks for the fitting of accessories. Possibly a detailed close-up for the customization?
- Add wing option for unicorns
- Accessory manager for each player. Accessories are not shared, so the player picking up an accessory can decide whether to use it on a unicorn
- Accesories to decorate Stable?
- Region unlocks behind e.g. bridge trolls should include a separate mini-game. Sort of like flappy bird/jet pack or a shooter type game. These should be more fast paced and up for several attempts. Possibly with an option to re-try even if the barrier they unlock is open.
- World randomization?
- Question type randomization?
