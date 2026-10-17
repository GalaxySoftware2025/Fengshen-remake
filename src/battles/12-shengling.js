// 聖靈山 (battle 12): the rules unique to it, from its ROM hooks (header 0x0F106E: turn hook 0x0F0F20, lose 0x0F1050;
// research/battles/12-hooks.txt). Pure rules, shared with the headless sim; the presentation is 12-shengling-fx.js.
// 林雲 (forced; up to five, deploy at the mountain's south-west foot) climbs the holy mountain for the 洛書, the first
// 古文書: three rooms (data/battles/12.js rooms, the table at 0x0F0F90), the turn hook picking the room's handler by its
// number (ff0f4f, table 0x0F0C90), each letting a hero on an exit take the party on (0x1D52A: src/rules.js roomExit /
// enterRoom). On the slopes 華草 (move type 5) and 飛兵 wait asleep, and 幻士, phantoms never on the map (AI 0x83:
// src/rules.js phantom) who show themselves to call up 雷角獸 once a hero comes near their post. In the last room the
// 守護靈 of the scroll (slot 10, AI 8: wakes within 2 as a caster) keeps the 洛書:
//   room 2  once it is gone (record state below 2, ff052a), the battle is won                       [0x0F0F6A]
// Lose [0x0F1050]: 林雲 (slot 0) gone.
import { G, players } from '../rules.js';

export const LAST = 2;   // the 守護靈's hall
const slot = n => G.units.find(u => u.slot === n);

export default {
  n: 12,
  setup(G) { G.beats = 0; G.joined = []; },
  victory(G) { const g = slot(10); return G.room === LAST && !!g && g.side === 'enemy' && !g.alive; },
  defeat(G) { const lin = G.units.find(u => u.side === 'player' && u.cid === 0); if (lin && !lin.alive) return '林雲亡'; return players().length ? null : '我方全滅'; },
};
