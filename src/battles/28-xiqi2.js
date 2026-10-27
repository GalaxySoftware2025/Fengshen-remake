// 西岐大殿 (battle 28): the rules unique to it, from its ROM hooks (header 0x0FBB86: turn hook 0x0FBAE2, lose the generic
// 0x01AD2C, win 0x0FBB10; research/battles/28-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 28-xiqi2-fx.js. Back from the 誅仙陣, 林雲 and 燃燈道人 (forced; 姬發 and 姜子牙 away, poisoned: up to six) find 聞太師
// and 呂岳 in 西岐's hall, with the masked 石人 and the archers of their plague.
//   first turn  once [ff32c5 bit 0]: 燃燈 warns of the masks, 聞太師 answers (0x0FBAD4)                     [0x0FBAE2]
// Win [0x0FBB10]: 聞太師 (class 67) gone: the rout (0x1DA7C), then won. Lose: no hero left.
import { G, players } from '../rules.js';
import { sayList } from '../says.js';

export const WEN = 67;
export const WORDS = sayList(0x0FBAD4);
const speaker = who => G.units.find(u => u.alive && u.name === who) || null;

export default {
  n: 28,
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    if (G.beats & 1) return null;
    G.beats |= 1;
    return WORDS.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
  },
  victory(G) {
    const won = G.units.some(u => u.cid === WEN && u.side === 'enemy') && !G.units.some(u => u.cid === WEN && u.side === 'enemy' && u.alive);
    return won ? { rout: true } : false;
  },
  defeat() { return players().length ? null : '我方全滅'; },
};
