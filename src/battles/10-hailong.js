// 海龍洞 (battle 10): the rules unique to it, from its ROM hooks (header 0x0EE540: turn hook 0x0ED9AC, lose 0x01ADB4, a
// frame hook 0x0ED934 that swaps two of the water's colours every 9 frames; research/battles/10-hooks.txt). Pure rules,
// shared with the headless sim; the presentation is 10-hailong-fx.js. 林雲, 燕蓉, 楊戩, 黃飛虎 and 哪吒 go down the sea
// dragon's cave, four rooms (data/battles/10.js rooms, the table at 0x0EE2AC): the turn hook picks the room's handler by
// its number (ff0f4f, table 0x0ED97C); every handler first lets a hero on an exit take the party on or back (0x1D52A:
// src/rules.js roomExit / enterRoom). Rooms 0-2 hold 蝦兵, 蟹將 and 飛兵 (dormant AI 7, the 飛兵 pacing, AI 10); the
// last room's handler [0x0EDA06] adds, each once (flags ff32c5 bits 0-1) [records ff02aa + 64 * slot: byte 0 its state
// (0 gone), +33 AI]:
//   0  哪吒 and 海龍王 have words (the say-list 0x0ED98C: 哪吒 is slot 4, 海龍王 slot 10)
//   1  海龍王 (slot 10, AI 8: wakes within 3 as a caster, 0x80) has woken: the four 飛兵 (15-18) take AI 6
// and the battle is won once 海龍王 is gone (ff0f4c bit 6). Lose [0x01ADB4]: 哪吒 (slot 4) gone.
import { G, players } from '../rules.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
const set = (ns, v) => { for (const n of ns) { const u = slot(n); if (u && u.alive) u.ai = v; } };
export const LAST = 3;   // the hall of 海龍王
export const LINES = sayList(0x0ED98C);

export default {
  n: 10,
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    if (G.room !== LAST) return null;
    let out = null;
    if (!(G.beats & 1)) { G.beats |= 1; out = LINES.map(l => ({ who: l.who, text: l.text, unit: slot(l.slot) || null })); }
    if (!(G.beats & 2)) { const king = slot(10); if (king && king.ai === 0x80) { set([15, 16, 17, 18], 6); G.beats |= 2; } }
    return out;
  },
  victory(G) { const king = slot(10); return G.room === LAST && !!king && !king.alive; },
  defeat(G) { const z = G.units.find(u => u.side === 'player' && u.cid === 4); if (z && !z.alive) return '哪吒死亡'; return players().length ? null : '我方全滅'; },
};
