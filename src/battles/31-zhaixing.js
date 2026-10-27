// 摘星樓 (battle 31): the rules unique to it, from its ROM hooks (header 0x0FD656: lose the generic 0x01AD2C, win 0x0FD5B0,
// frame hook 0x0FD45C; research/battles/31-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 31-zhaixing-fx.js. In 紂王's court (the same art) the heroes face 紂王 and 妲己, and 聞太師 made a 石人.
//   every frame  three colours of the second palette line (ffcf3a) turn one place every ten frames: the set's own shimmer
// Win [0x0FD5B0]: 紂王 (class 70) and 妲己 (class 53) gone: the rout (0x1DA7C). Lose: no hero left.
import { G, players } from '../rules.js';

const gone = cid => G.units.some(u => u.cid === cid && u.side === 'enemy') && !G.units.some(u => u.cid === cid && u.side === 'enemy' && u.alive);
export default {
  n: 31,
  victory() { return gone(70) && gone(53) ? { rout: true } : false; },
  defeat() { return players().length ? null : '我方全滅'; },
};
