// 孟津 (battle 29): the rules unique to it, from its ROM hooks (header 0x0FC58A: lose the generic 0x01AD2C, win 0x0FC510,
// no turn hook; research/battles/29-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 29-mengjin-fx.js. At 孟津, where the lords were to gather, 申公豹 has taken their armies for his own (scene 60); the five
// forced (林雲, 燕蓉, 姬發, 姜子牙, 燃燈道人; up to ten) must get past them to him.
// Win [0x0FC510]: 申公豹 (class 68) gone. Lose: no hero left (0x01AD2C counts the heroes' side, ff0a2a). The brief's 友軍亡
// (the lords' men falling) is the condition text only: no hook checks it, and the original plays on when they fall.
import { G, players } from '../rules.js';

export const SHEN = 68;
export default {
  n: 29,
  victory(G) { return G.units.some(u => u.cid === SHEN && u.side === 'enemy') && !G.units.some(u => u.cid === SHEN && u.side === 'enemy' && u.alive); },
  defeat() { return players().length ? null : '我方全滅'; },
};
