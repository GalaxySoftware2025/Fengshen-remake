// 青龍關 (battle 16): the rules unique to it, from its ROM hooks (header 0x0F35B2: turn hook 0x0F345E, lose 0x0F34F4, win
// 0x0F353A; research/battles/16-hooks.txt). Pure rules, shared with the headless sim; the presentation is 16-qinglong-fx.js.
// 黃天化 and 土行孫 (both forced, lent by 鄂順; 黃飛虎 stays behind, up to nine, deploy at the pass's south gate) storm the
// pass of 張桂芳: his 金銅人 and 鐵弓手 asleep down its lanes, a 法師 at his side, he himself in the north gate (slot 10,
// AI 8: wakes for a hero next to him). [flag ff32c5 bit 0]
//   every turn  once a hero (slots 0-9) stands within 7 of 張桂芳's cell (|dx| + |dy|), once: 張桂芳, 土行孫 and 黃天化 have
//               words (0x0F343C, each line on its speaker's unit)                                     [0x0F345E]
// Win [0x0F353A]: 張桂芳 (class 38) gone. Lose [0x0F34F4]: 黃天化 (class 8) or 土行孫 (class 9) gone.
import { G, players } from '../rules.js';
import { sayList } from '../says.js';

export const LINES = sayList(0x0F343C);
export const CID = { zhang: 38, hua: 8, tu: 9 };
const slot = n => G.units.find(u => u.slot === n);
const speaker = who => G.units.find(u => u.alive && u.name === who) || null;

export default {
  n: 16,
  load(D) {   // the map art draws the chests at (1, 1) and (22, 1): (0, 18) and (23, 22) are found by striking their cells
    D.chests = D.chests.map(c => (c.x === 0 && c.y === 18) || (c.x === 23 && c.y === 22) ? Object.assign({}, c, { hidden: true }) : c);
  },
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    const z = slot(10);
    if (G.beats & 1 || !z || !players().some(p => p.slot < 10 && Math.abs(p.x - z.x) + Math.abs(p.y - z.y) <= 7)) return null;
    G.beats |= 1;
    return LINES.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
  },
  victory(G) { return G.units.some(u => u.cid === CID.zhang && u.side === 'enemy') && !G.units.some(u => u.cid === CID.zhang && u.side === 'enemy' && u.alive); },
  defeat(G) {
    for (const [cid, why] of [[CID.hua, '黃天化亡'], [CID.tu, '土行孫亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
