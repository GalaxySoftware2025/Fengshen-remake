// 朝歌外城 (battle 30): the rules unique to it, from its ROM hooks (header 0x0FCC10: lose 0x0FCB10, win 0x0FCB6E, no turn
// hook; research/battles/30-hooks.txt). Pure rules, shared with the headless sim; the presentation is 30-chaoge2-fx.js.
// The heroes come in by 朝歌's north gate while the city's men are drawn off to the east and west gates (scene 62);
// 費仲 and 尤渾 send their two generals.
// Win [0x0FCB6E]: the 超戰將 in slot 10 gone (record +0 ≤ 0) and the 魔戰將 in slot 11 too (+0 < 2): the rout (0x1DA7C).
// Lose [0x0FCB10]: 林雲, 燕蓉 or 姬發 (classes 0, 1, 5) gone.
import { G, players } from '../rules.js';

const slot = n => G.units.find(u => u.slot === n && u.side === 'enemy');
export default {
  n: 30,
  victory(G) { const a = slot(10), b = slot(11); return a && b && !a.alive && !b.alive ? { rout: true } : false; },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [1, '燕蓉亡'], [5, '姬發亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
