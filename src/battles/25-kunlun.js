// 崑崙仙山 (battle 25): the rules unique to it, from its ROM hooks (header 0x0F93D0: turn hook 0x0F9330, win 0x0F935E, lose
// the generic 0x01AD2C; research/battles/25-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 25-kunlun-fx.js. 林雲 and 土行孫 (forced; 燕蓉, 姬發 and 小龍女 away, up to eight) climb the floating peaks of 崑崙 to the
// 東方守護靈, for the last 古文書 and the 甘露草.
//   every turn  in a round that is a multiple of three (ff32c4 % 3), the fallen of move type 7 (the 飛兵) come back at
//               their posts (0x1DAFC(7))                                                                    [0x0F9334]
// Win [0x0F935E]: the 守護靈 (class 33) gone. Lose: no hero left.
import { G, players, revive } from '../rules.js';

export const GUARDIAN = 33;
export default {
  n: 25,
  setup(G) { G.joined = []; },
  beforeTurn(G) { if (G.round % 3 === 0) { const back = revive(7); if (back.length) G.joined.push(...back); } return null; },
  victory(G) { return G.units.some(u => u.cid === GUARDIAN && u.side === 'enemy') && !G.units.some(u => u.cid === GUARDIAN && u.side === 'enemy' && u.alive); },
  defeat() { return players().length ? null : '我方全滅'; },
};
