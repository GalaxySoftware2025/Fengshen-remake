// 北海九龍島 (battle 21): the rules unique to it, from its ROM hooks (header 0x0F6AEA: turn hook 0x0F6910, lose 0x0F69DA,
// win 0x0F6A20; research/battles/21-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 21-jiulong-fx.js. 林雲 and 楊戩 (forced; 姬發 away, up to six) land on the island of the four holy knights (四聖騎), the
// allies of 崇城: the island's own map, then the shrine (data/battles/21.js rooms, the table at 0x0F6AE2: its first entry is
// the shrine again, so the battle starts on its own map, src/rules.js loadBattle), the turn hook picking the room's
// handler by its number (ff0f4f, table 0x0F68C4), each letting a hero on an exit take the party on (0x1D52A).
// [records ff02aa + 64 * slot: +1 facing (0 down, 8 up); flag ff32c5 bit 0]
//   every turn   in a round that is even (ff32c4 bit 0 clear), the fallen of move type 7 come back at their posts
//                (0x1DAFC(7); none here is of that type)                                    [0x0F693A, 0x0F6964]
//   room 1       before its first turn, once: the heroes in slots 0-5 turn to face up (north, the knights before the
//                stele), then words: 王魔, 楊戩, 林雲 and the knights (0x0F68CC, each on its speaker)            [0x0F6964]
// Win [0x0F6A20]: 高友乾, 李興霸, 王魔 and 楊森 (classes 49-52) all gone. Lose [0x0F69DA]: 林雲 (class 0) or 楊戩 (class 2) gone.
import { G, players, revive } from '../rules.js';
import { sayList } from '../says.js';

export const SHRINE = 1, KNIGHTS = [49, 50, 51, 52];
export const LINES = sayList(0x0F68CC);
// the knights by class: the say-list's speaker names one of them 李興霸 where his class's name reads 李興霜 (both the ROM's)
const KNIGHT = { 高友乾: 49, 李興霸: 50, 李興霜: 50, 王魔: 51, 楊森: 52 };
const speaker = who => G.units.find(u => u.alive && (KNIGHT[who] ? u.cid === KNIGHT[who] && u.side === 'enemy' : u.name === who)) || null;
const gone = cid => G.units.some(u => u.cid === cid && u.side === 'enemy') && !G.units.some(u => u.cid === cid && u.side === 'enemy' && u.alive);

export default {
  n: 21,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    let lines = null;
    if (G.room === SHRINE && !(G.beats & 1)) {
      G.beats |= 1;
      for (const u of G.units) if (u.side === 'player' && u.slot < 6) u.facing = 'up';
      lines = LINES.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
    }
    if (G.round % 2 === 0) { const back = revive(7); if (back.length) G.joined.push(...back); }
    return lines;
  },
  victory(G) { return KNIGHTS.every(gone); },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [2, '楊戩亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
