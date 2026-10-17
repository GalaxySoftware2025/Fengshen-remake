// 火巖窟 (battle 14): the rules unique to it, from its ROM hooks (header 0x0F2356: turn hook 0x0F213A, lose 0x0F2320, a
// frame hook 0x0F2070 that turns five of the lava's colours round every 10 frames; research/battles/14-hooks.txt). Pure
// rules, shared with the headless sim; the presentation is 14-huoyan-fx.js. 林雲 and 姜子牙 (both forced; 雷震子 gone home,
// up to six, deploy at the cave's mouth in the north-west) chase 申公豹 into the fire cave: two rooms (data/battles/14.js
// rooms, the table at 0x0F22C8: both its entries are the lair, so the battle starts on its own map, src/rules.js
// loadBattle), the turn hook picking the room's handler by its number (ff0f4f, table 0x0F20DC). 妖獸 of the fire (move type
// 6) and 召喚師 who call up 石頭 hold the cave; 龍鬚虎 waits in his lair with 鐵弓手 and more 妖獸. [flags ff32c5 bits 0-2]
//   both rooms  before every unit's turn in a round that is a multiple of three (ff32c4 % 3), the fallen 妖獸 come back at
//               their posts, healed (0x1DAFC(6): src/rules.js revive)
//   room 0  once any unit stands in the rectangle x 16-21, y 15-18 (table 0x0F20E4, the 24 cells; units of either side,
//           0x200D6), the five 妖獸 of slots 10-14 wake (AI 0)                                         [0x0F2164]
//   room 1  on entering, once: every hero's turn is over for the round (record byte +1 = 8, the acted mark), so 龍鬚虎's
//           side moves first; then once, 龍鬚虎, 姜子牙 and 林雲 have words (0x0F2114); once 龍鬚虎 (slot 10) is gone
//           (state below 2) the battle is won                                                       [0x0F2212]
// Lose [0x0F2320]: 姜子牙 (class 7) gone.
import { G, players, revive, endHeroesRound } from '../rules.js';
import { sayList } from '../says.js';

export const LAST = 1;   // 龍鬚虎's lair
export const LINES = sayList(0x0F2114);
const slot = n => G.units.find(u => u.slot === n);
const ZONE = (x, y) => x >= 16 && x <= 21 && y >= 15 && y <= 18;   // 0x0F20E4

export default {
  n: 14,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    let out = null;
    if (G.room === LAST && !(G.beats & 4)) { G.beats |= 4; endHeroesRound(); }
    if (G.round % 3 === 0) { const back = revive(6); if (back.length) G.joined.push(...back); }
    if (G.room === 0 && !(G.beats & 1) && G.units.some(u => u.alive && !u.away && ZONE(u.x, u.y))) {
      G.beats |= 1; for (let s = 10; s <= 14; s++) { const u = slot(s); if (u && u.alive) u.ai = 0; }
    }
    if (G.room === LAST && !(G.beats & 2)) { G.beats |= 2; out = LINES.map(l => ({ who: l.who, text: l.text, unit: slot(l.slot) || players().find(p => p.name === l.who) || null })); }
    return out;
  },
  victory(G) { const k = slot(10); return G.room === LAST && !!k && k.side === 'enemy' && !k.alive; },
  defeat(G) { const j = G.units.find(u => u.side === 'player' && u.cid === 7); if (j && !j.alive) return '姜子牙亡'; return players().length ? null : '我方全滅'; },
};
