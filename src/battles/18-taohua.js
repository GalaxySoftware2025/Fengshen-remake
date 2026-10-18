// 桃花林 (battle 18): the rules unique to it, from its ROM hooks (header 0x0F4A36: turn hook 0x0F4986, lose 0x0F49C4, win
// 0x0F49FC; research/battles/18-hooks.txt). Pure rules, shared with the headless sim; the presentation is 18-taohua-fx.js.
// 林雲 and 燕蓉 (forced; 黃飛虎 away, up to seven, deploy at the forest's south) look for the temple in the peach forest:
// two rooms (data/battles/18.js rooms, the table at 0x0F4A2E: both entries are the hall, so the battle starts on its own
// map, src/rules.js loadBattle), one handler for both: an exit takes the party on (0x1D52A).
//   every turn  in a round that is a multiple of three (ff32c4 % 3), the fallen of move type 6 (the 華草) come back at
//               their posts (0x1DAFC(6))                                                                [0x0F4986]
// Win [0x0F49FC]: in room 1, the 守護靈 (slot 10) gone (record state below 2): the battle is won and the rest fall
// (0x1DA7C). Lose [0x0F49C4]: 林雲 (class 0) or 燕蓉 (class 1) gone.
import { G, players, revive } from '../rules.js';

export const HALL = 1;
const slot = n => G.units.find(u => u.slot === n);

export default {
  n: 18,
  load(D) {   // the art draws the forest's chests at (13, 3), (22, 15), (19, 19) and (22, 21): (0, 0) and (23, 33) are found by striking
    D.chests = D.chests.map(c => (c.x === 0 && c.y === 0) || (c.x === 23 && c.y === 33) ? Object.assign({}, c, { hidden: true }) : c);
    if (D.rooms) D.rooms[0] = Object.assign({}, D.rooms[0], { chests: D.chests });
  },
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (G.round % 3 === 0) { const back = revive(6); if (back.length) G.joined.push(...back); }
    return null;
  },
  victory(G) { const g = slot(10); return G.room === HALL && !!g && g.side === 'enemy' && !g.alive ? { rout: true } : false; },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [1, '燕蓉亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
