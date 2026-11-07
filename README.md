# silly_games
Small silly js/html games for kids. Mainly in Danish or teaching Danish->English

## Unicorn Adventure

`unicorn-adventure/` is an unfinished browser-based educational RPG built with Phaser 3. Run it from a local HTTP server (rather than opening the HTML file directly), because the game loads ES modules and JSON data.

To run the game-rules regression checks, start the same server and open `tests/index.html` beneath the game URL. The tests use the same Phaser CDN as the game.

### Current gameplay

- Explore the original 128 × 96 tile world and a new 32-tile-wide western region behind a solid wall. Forest walls and water are blocked.
- Investigate the glowing crack in the western wall with **MELLEMRUM**. Bring two rescued unicorns, two collected saddles, and two collected pairs of wings, then answer an age-appropriate question to open the flight. Press **MELLEMRUM** to begin and climb; survive for 20 seconds, avoiding lava and flying pterodactyls with the leading rider while the second rider follows safely. Five hits end the attempt, switch players, and leave the question unfinished. Winning takes both riders to the other side. The solid wall remains closed, so crossing back requires another question and flight.
- West of the wall, discover three long-horned rainbow unicorns and twelve matching accessories. Iris guards a forest with one unicorn and four accessories, and a troll guards a river leading to another unicorn and four accessories; the rest are scattered around the region. Both guardians use the same question and minigame rules as the other fairies and trolls.
- A troll guards each river crossing. Answer its question, then collect seven apples while dodging rocks to open the bridge. Move with the arrow keys or **WASD**; three rock hits end the attempt, switch players, and leave the question and bridge unfinished.
- Move the active child with the arrow keys or **WASD**. Press **T** to switch the leader; the other child follows. Walk up to an NPC and press **MELLEMRUM** to interact.
- Turns switch automatically at four points: each correctly completed question counts as two points, and each collected accessory counts as one. Manual switches preserve each player's unfinished count; an automatic switch resets the outgoing player's count. A brief pop-up announces each change.
- The collection counters, turn controls, and reset button appear above the game window so they do not cover the map. Accessories are counted separately as stickers, saddles, wings, and hats.
- The fairies Flora and Luna each guard the only entrance to a forest containing an accessory. Answer a randomly selected question suited to the active player's age, then play the mosquito chase to open the entrance. Aim the wand with the mouse and press **MELLEMRUM** for one star at a time. Hit 10 mosquitoes to win; if more than 20 get through, the other player takes a turn and must answer another question. Luna's forest is across the troll's bridge.
- Correct answers, footsteps on the map, approaching NPCs, troll and fairy interactions, unicorn encounters, wing and crown pickups, equipping accessories, and all minigames have sound effects. Mosquitoes buzz while present, and the troll and flight games also have music. Browser audio may require a click or keypress before it starts.
- Find nine unicorns and 36 accessories around the map: nine hats, nine saddles, nine stickers, and nine pairs of wings. Each unicorn encounter starts a challenge; answer correctly to add it to the collection. Pick up accessories by walking over them. The HUD tracks both collections, and the adventure has no ending.
- Visit the stable in the upper-left corner near the starting area by walking up to it and pressing **MELLEMRUM**. Walk up to a rescued unicorn and press **MELLEMRUM** to see its portrait. Choose a category to equip or remove collected stickers, saddles, wings, or hats and crowns. Equipped items are also visible on the unicorns in the stable. Each accessory can be worn by one unicorn at a time; choosing it on another unicorn moves it. Close the panel with **ESC** or the button. Return to the world through the stable exit.
- Rescued unicorns, accessories, and their equipped assignments are saved in the browser's local storage across reloads and new playthroughs on the same browser and origin. They do not reappear as pickups; clearing browser site data removes the collection.
- Use **Nulstil spil** in the upper-left corner of the world to start over. After confirmation, the saved collection and equipment are cleared and the world, gates, and quests reset.
- Challenges are presented as story events and include age-scaled reading, math, English, and logic questions.
- Unicorn and fairy encounters choose randomly from challenges suited to the active player's age, avoiding previously solved questions when possible. Fairies also avoid their most recent question when possible. Troll challenges remain fixed; suitable questions can repeat if the available pool is exhausted.

### What is not finished yet

- This is a small prototype with a test map and sample characters, NPCs, quests, collectibles, and challenges.
- Quest progress, gate access, and challenge progress are held in memory and reset when the page is reloaded.

### To-do:

- Accessory manager for each player. Accessories are not shared, so the player picking up an accessory can decide whether to use it on a unicorn
- Accesories to decorate Stable?
- Region unlocks behind e.g. bridge trolls should include a separate mini-game. Sort of like flappy bird/jet pack or a shooter type game. These should be more fast paced and up for several attempts. Possibly with an option to re-try even if the barrier they unlock is open.
- World randomization?
- Question type randomization?

- ADD A STORY LINE
