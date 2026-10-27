// 天門異界 (battle 26): the rules unique to it, from its ROM hooks (header 0x0F9CDE: win 0x0F9C6C, lose the generic 0x01AD2C,
// no turn hook, frame hook 0x0F9992; research/battles/26-hooks.txt). Pure rules, shared with the headless sim; the
// presentation is 26-tianmen-fx.js. With the four 古文書 read, 林雲 and 燕蓉 (forced; 土行孫 and 小龍女 away, up to eight)
// are taken up to the gate of heaven (scene 54: op 52, a map load out of white) to prove themselves to its guardian.
//   every frame  six colours of the second palette line (ffcf32) turn one place every ten frames: the crystal floor's
//                shimmer, the set's own (src/remake/tianmen.js)                                            [0x0F9992]
// Win [0x0F9C6C]: the 天將 (class 62) gone. Lose: no hero left.
import { G, players } from '../rules.js';

export const GUARD = 62;
export default {
  n: 26,
  victory(G) { return G.units.some(u => u.cid === GUARD && u.side === 'enemy') && !G.units.some(u => u.cid === GUARD && u.side === 'enemy' && u.alive); },
  defeat() { return players().length ? null : '我方全滅'; },
};
