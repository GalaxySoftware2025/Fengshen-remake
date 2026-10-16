// 紫陽觀 (battle 9): the rules unique to it, from its ROM hooks (header 0x0ECFA0: turn hook 0x0EC878, lose 0x01AD2C;
// research/battles/09-hooks.txt). Pure rules, shared with the headless sim; the presentation is 09-ziyang-fx.js. 林雲,
// 燕蓉, 楊戩 and 黃飛虎 (deploy (11, 22), (12, 23), (12, 22), (11, 23), at the foot of the hill) defend 姜文煥's temple
// from 龍太子's sea troops: 龍太子 (slot 10, AI 10 round (19, 5)), three 飛兵 (11-13, AI 10: they take AI 6 when a hero
// comes within 8), five 蟹將 (14-18, AI 7 within 2) and eight 蝦兵 (19-26, AI 7 within 7).
// The turn hook, before every unit's turn, four beats, each once (flags ff32c5 bits 0-3) [records ff02aa + 64 * slot:
// byte 0 its state (0 gone; 2 has acted), +1 facing (0x10 left, 0x18 right), +2 / +4 x / y, +33 AI]:
//   0  the 飛兵 in slot 13 has woken (AI 6), or the 蟹將 in slot 15 (AI 0): 哪吒 (his hero record, ROM 0x05B0E0: Lv 12)
//      comes in as slot 4, the heroes' side (ff0a2a), at the first free of seven cells round (9, 13) [0x0EC85C], facing
//      east, his turn already spent this round (byte 0 = 2); 龍太子 faces west, the 蟹將 in slot 14 takes AI 6; 哪吒 and
//      龍太子 have words                                                                                  [0x0EC888]
//   1  the 蟹將 in slot 15 has woken: every 蝦兵 (19-26) comes (AI 0), the 飛兵 and the 蟹將 take AI 6       [0x0EC9F8]
//   2  the 蝦兵 in slot 22 has woken: 11 takes AI 6, 24, 25 and 18 come                                     [0x0ECA8E]
//   3  龍太子 is gone: the battle is won (0x1DA7C; ff0f4c bit 6)                                            [0x0ECADC]
// Lose [0x01AD2C]: no hero left.
import { G, D, makeUnit, unitAt, players } from '../rules.js';
import { hero } from '../party.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
const ai = n => { const u = slot(n); return u ? u.ai : null; };
const set = (ns, v) => { for (const n of ns) { const u = slot(n); if (u && u.alive) u.ai = v; } };
export const NEZHA = { cid: 4, slot: 4 };
export const SPOTS = [[9, 13], [8, 14], [8, 15], [7, 15], [7, 14], [7, 13], [8, 13]];   // 0x0EC85C: the first free one (else the last)
export const LINES = sayList(0x0EC82E);   // 哪吒 (actor 5: slot 4) and 龍太子 (actor 11: slot 10)

export default {
  n: 9,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    let out = null;
    if (!(G.beats & 1) && (ai(13) === 6 || ai(15) === 0)) {
      G.beats |= 1;
      if (!G.units.some(u => u.cid === NEZHA.cid && u.side === 'player')) {
        const z = makeUnit(hero(D, NEZHA.cid, D.heroes[NEZHA.cid].lv), 'player', { slot: NEZHA.slot, joinedHere: true });
        [z.x, z.y] = SPOTS.find(([x, y]) => !unitAt(x, y)) || SPOTS[SPOTS.length - 1];
        z.facing = 'right'; G.units.push(z); G.joined.push(z);
      }
      const prince = slot(10); if (prince) prince.facing = 'left';
      set([14], 6);
      out = LINES.map(l => ({ who: l.who, text: l.text, unit: slot(l.slot) || null }));
    }
    if (!(G.beats & 2) && ai(15) !== 7) { set([19, 20, 21, 22, 23, 24, 25, 26], 0); set([11, 12, 13, 14, 15, 16, 17, 18], 6); G.beats |= 2; }
    if (!(G.beats & 4) && ai(22) === 0) { set([11], 6); set([24, 25, 18], 0); G.beats |= 4; }
    return out;
  },
  victory(G) { const p = slot(10); return !!p && !p.alive; },
  defeat(G) { return players().length ? null : '我方全滅'; },
};
