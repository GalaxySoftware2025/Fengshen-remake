// 西岐城大殿 (battle 22): the rules unique to it, from its ROM hooks (header 0x0F7716: turn hook 0x0F7598, lose 0x0F762E,
// win 0x0F768C; research/battles/22-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 22-xiqi-fx.js. 林雲 (forced, up to eight) holds 西岐's great hall against 妲己 and the court's 戰將, 異鳥 and 大力士,
// with 文王 and 伯邑考 to keep alive at its south end. [records ff02aa + 64 * slot: +11 move, +32.. wake, AI and its
// parameters; flag ff32c5 bit 0]
//   first turn  文王 and 伯邑考 (the records at ROM 0x0F78BE, 31 longs) are copied into slots 8 and 9, the heroes' side:
//               Lv 10, standing where they are (move 0; AI 9 to their own cells (12, 22) and (12, 23)); the 戰將 either
//               side of the hall (slots 15 and 16) get move 4, and they and two 異鳥 (19, 20) the AI 0x0B, hunting
//               伯邑考 (class 54: 15, 19) or 文王 (class 12: 16, 20), falling back to AI 0 (rules.js hunt)      [0x0F75A8]
//   every turn  in a round that is a multiple of three (ff32c4 % 3), the fallen of move type 7 (the 異鳥) come back at
//               their posts (0x1DAFC(7))                                                                    [0x0F7604]
// Win [0x0F768C]: 妲己 (class 53) gone. Lose [0x0F762E]: 林雲 (class 0), 文王 (class 12) or 伯邑考 (class 54) gone.
import { G, players, revive, setAiP } from '../rules.js';
import { spriteKey } from '../sprites.js';

export const CID = { lin: 0, wen: 12, bo: 54, daji: 53 };
// [ROM 0x0F78BE and 0x0F78FE: their own records (the second copied but for its last four bytes, AI parameters past +3B)]
const guest = o => Object.assign({ lv: 10, exp: 0, moveType: 0, move: 0, rangeShape: 0, atkType: 1, items: [], spells: [], ai: 9, side: 'player', guest: true, facing: 'down' }, o, { sprite: spriteKey(o.gfx) });
export const WEN = guest({ cid: 12, name: '文王', atk: 32, df: 28, spd: 24, hp: 50, mhp: 50, mp: 24, mmp: 24, aggro: 12, aip: [12, 22, 0, 0, 0xff, 0xff, 0xff, 0xff], gfx: 0x06806a, anim: 0x03889a, x: 12, y: 22, slot: 8 });
export const BO = guest({ cid: 54, name: '伯邑考', atk: 30, df: 26, spd: 0, hp: 40, mhp: 40, mp: 0, mmp: 0, aggro: 12, aip: [12, 23, 0, 0, 0xff, 0xff, 0xff, 0xff], gfx: 0x07f0c2, anim: 0x03891a, x: 12, y: 23, slot: 9 });
export const HUNTERS = [[15, CID.bo, 4], [16, CID.wen, 4], [19, CID.bo], [20, CID.wen]];   // slot, quarry, the move it gets
const slot = n => G.units.find(u => u.slot === n);
const down = cid => { const u = G.units.find(v => v.cid === cid && v.side === 'player'); return u && !u.alive; };

export default {
  n: 22,
  load(D) { D.enemies = D.enemies.concat([Object.assign({}, WEN), Object.assign({}, BO)]); },   // in place before anyone moves
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (!(G.beats & 1)) {
      G.beats |= 1;
      for (const [s, q, mv] of HUNTERS) { const u = slot(s); if (!u) continue; if (mv) u.move = mv; u.ai = 0x0b; setAiP(u, 0x34, q); setAiP(u, 0x35, 0); }
    }
    if (G.round % 3 === 0) { const back = revive(7); if (back.length) G.joined.push(...back); }
    return null;
  },
  victory(G) { return G.units.some(u => u.cid === CID.daji && u.side === 'enemy') && !G.units.some(u => u.cid === CID.daji && u.side === 'enemy' && u.alive); },
  defeat(G) {
    if (down(CID.lin)) return '林雲亡';
    if (down(CID.wen)) return '文王亡';
    if (down(CID.bo)) return '伯邑考亡';
    return players().length ? null : '我方全滅';
  },
};
