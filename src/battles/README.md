# Battle modules

Every battle plays from its generated data (`data/battles/NN.js`), with the engine's generic rules: dormant enemies (AI 7 and 8) wake when a hero comes within their range (to the AI in their record's +35), AI 9 walks to a cell and then takes the AI in +37, AI 10 paces a zone until a hero comes near (`rules.js`; the record's AI bytes +34..+3B are each unit's `aip`), and chests (`D.chests`) open when a hero picks the chest's cell as the move target or attacks it from next to it (a chest marked `hidden` gets no highlight and is not a move target: a hero finds it only by attacking its cell from next to it). This folder holds only what is unique to a battle,
ported from its ROM hook code (`research/battles/NN-hooks.txt`). Register a battle in `index.js`
(`MODULES = { 1: '01-fushan', 2: '02-fushan', 3: '03-dungeon', 4: '04-fushan', 5: '05-feizhong', 6: '06-feizhong2', 7: '07-chaoge', 8: '08-lintong', 13: '13-panxi' }`). Its scripted checks go in `test/battles.mjs`. A battle without a module uses the generic rules: the win and lose conditions are read
from the condition text (rout; named units falling), and the scene's pre- and post-battle lines play over the map.

## `NN-name.js`: rules (pure; `test/sim.mjs` runs it too)
A default export. Every field is optional.

| field | when | does |
|---|---|---|
| `load(D)` | `R.loadBattle` | adds units a hook spawns (pushed onto `D.enemies` with `side: 'npc'` or `'enemy'`), or adjusts the map |
| `setup(G)` | `R.setupBattle`, after units are placed | battle state on `G` (磻溪: the fire column) |
| `beforeTurn(G, u)` | before every unit's turn (the ROM's turn hook, header +34) | scripted beats: wakes units (`ai = 0`) and returns the lines to play, `[{ who, text, unit }]` (battle 1: the escort's orders; `unit: null` for a speaker not on the map); a hero who joins is pushed onto `G.units` and `G.joined` (battle 4's 楊戩) |
| `roundStart(G)` | each round, before any unit acts | returns an event object for the presentation (磻溪: `{ col, victims }`) |
| `trigger(G)` | after every action | returns `true` when a scripted trigger fires (an ambush wakes) |
| `victory(G)` | after every action | `true` when won; replaces the generic check |
| `defeat(G)` | after every action and each round start | the loss reason text, or `null`; replaces the generic check |
| `goal(G)` | sim `rescue` option | units the AI's fliers head for |
| `hud(G)` | each round | the HUD gauge `{ label, fill, text }` |

## `NN-name-fx.js`: presentation (browser only)
A default export. Functions get `E`, the battle engine (`src/battle.js`): `cam`, `vfx`, `world`, `ui`, `wait`, `anim`,
`tileCenter`, `actorOf`, `killAnim`, and the rest of its exports.

| field | does |
|---|---|
| `look` | `{ set }`: the battle plays on a remade set (`src/remake/`, battle 1: the valley; its `openChest(x, y)` opens the chest model), or `{ mapSD, mapHD?, hdCell?, forest?, clear?(cx, cy), dress?(world) }`: the map art, the terrain code drawn as a bamboo forest, cells kept clear of it, and props built into the world. Default: the generated map art, flat. |
| `sprites` | extra sprite keys to preload (a unit that changes sprite later) |
| `lore`, `winText`, `loseText` | the brief screen; defaults to the ROM condition text |
| `stage(E)` | after the units are placed (磻溪: the forest already on fire) |
| `roundStart(E, ev)` | plays the rules hook's event |
| `trigger(E)` | plays a fired trigger |
| `join(E, u)` | a hero joining mid-battle comes in (the camera is already on them); default: a fade |
| `intro(E)` | before the first round; default: the scene's pre-battle lines, then the battle's name |
| `victory(E)` | on a win; default: a banner and the scene's post-battle lines |
| `end` | `{ title, sub }` for the end screen |
