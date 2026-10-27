// 摘星樓 (battle 32): the rules unique to it, from its ROM hooks (header 0x0FE020: lose 0x0FDF10, turn hook 0x0FDD0C, frame
// hook 0x0FD45C, no win hook; research/battles/32-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 32-zhaixing2-fx.js. The demon 紂王, fused with 申公豹 (scene 63), in his lair: his head on the body the map draws, his
// serpents round him. [slot 10: his record; flag ff32c5 bits 0-1]
//   before every turn
//     his first fall    his record copied back in from 0x0FE128 (at (11, 3), 600 HP, the same AI), the camera on him, the
//                       screen pulsing 66 frames; his words (0x0FDF7A)                                    [0x0FDD1C]
//     his second fall   the record copied in again, the camera, the pulse; 姜子牙, 林雲 and 燕蓉 find the incantation
//                       (0x0FDF88); eight palette flashes (0x21820), the map's other block grid (0x100504: the body
//                       gone), 48 frames of the heat haze (0x2186A), the sound 0x805E, the rout (0x1DA7C), won  [0x0FDDB6]
//     always            the fallen of move type 6 (the 妖獸) back at their posts (0x1DAFC(6))             [0x0FDEFC]
// Lose [0x0FDF10]: 林雲, 燕蓉 or 姜子牙 (classes 0, 1, 7) gone, or no hero left. Won only by the seal.
import { G, players, revive, setAiP } from '../rules.js';
import { sayList } from '../says.js';

export const DEMON = 70, AT = [11, 3];
export const TAUNT = sayList(0x0FDF7A), CHANT = sayList(0x0FDF88);
const king = () => G.units.find(u => u.slot === 10 && u.side === 'enemy');
const speaker = who => G.units.find(u => u.alive && u.name === who) || null;
const say = list => list.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
// the record at 0x0FE128 copied over his [0x6B3A: 15 longs]
function rise(u) {
  Object.assign(u, { alive: true, hp: 600, mhp: 600, mp: 360, mmp: 360, x: AT[0], y: AT[1], ai: 8, facing: 'down', status: { sleep: 0, seal: 0, poison: 0 }, buf: {} });
  u.aip = [17, 0x85, 0, 0, 0xff, 0xff, 0xff, 0xff]; setAiP(u, 0x34, 17);
}
export default {
  n: 32,
  setup(G) { G.beats = 0; G.joined = []; G.sealed = false; },
  beforeTurn(G) {
    let out = null;
    const u = king();
    if (u && !u.alive && !(G.beats & 1)) {
      rise(u); G.beats |= 3;
      out = [{ fx: 'rise', unit: u }, ...say(TAUNT)];
    } else if (u && !u.alive && (G.beats & 2)) {
      rise(u);
      const routed = G.units.filter(v => v.side === 'enemy' && v.alive && !v.away && v.moveType !== 9);
      out = [{ fx: 'rise', unit: u }, ...say(CHANT), { fx: 'seal', routed }];
      for (const v of routed) v.alive = false;
      G.sealed = true;
    }
    if (!G.sealed) { const back = revive(6); if (back.length) G.joined.push(...back); }   // (the ROM's runs after the seal too, but the battle is over then: none is seen)
    return out;
  },
  victory(G) { return !!G.sealed; },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [1, '燕蓉亡'], [7, '姜子牙亡']]) { const h = G.units.find(v => v.side === 'player' && v.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
