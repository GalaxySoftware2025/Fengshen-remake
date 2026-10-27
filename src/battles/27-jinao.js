// 東海金螯島 (battle 27): the rules unique to it, from its ROM hooks (header 0x0FABC0: turn hook 0x0FA790, lose 0x0FAADA,
// win 0x0FAB38; research/battles/27-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 27-jinao-fx.js. 林雲, 楊戩 and 燃燈道人 (forced; 姬發 and 姜子牙 away, up to eight) go into 申公豹's 誅仙陣: thirteen rooms
// (data/battles/27.js rooms), the turn hook picking the room's handler by its number (ff0f4f, table 0x0FA75C) and the
// heroes' cells on arriving from the table at 0x0FAAA6 (ff0f90). Four gates, each three rooms: two halls, then the gate's
// chamber and its 守門神 (class 63); then 通天教主's hall. [records ff02aa + 64 * slot: +6 graphic, +0A its frames]
//   rooms 0 1 3 4 6 7 9 10  a hero on an exit takes the party on or back (0x1E212, the engine's roomExit)
//   rooms 2 5 8   the gate's chamber: once its 守門神 is gone, the rout (0x1DA7C), then the way on (0x0FA9C6): the cell
//                 under the first hero (slot 0) becomes an exit (terrain 4), the camera goes to it, the stairs are drawn
//                 there, 40 frames, and the party goes on (0x1E212)                                   [0x0FA7DA ...]
//   room 8        before every unit's turn its fallen 鬼靈 (move type 7) come back at their posts (0x1DAFC(7)) [0x0FA876]
//   room 11       the last gate: once no enemy is left (ff0a2b), the way on as above                     [0x0FA8D2]
//   room 12       once [ff32c5 bit 0]: 通天教主 and 燃燈 have words (0x0FA980); the screen pulses 48 frames, his record
//                 takes the phoenix's graphic (0x08DED2, frames 0x3889A: he is back in his true shape), 32 frames more;
//                 20 frames, then the next words (0x0FA9B2)                                              [0x0FA8F4]
// Win [0x0FAB38]: 通天教主 (class 64) gone. Lose [0x0FAADA]: 林雲, 楊戩 or 燃燈道人 (classes 0, 2, 11) gone.
import { G, players, revive } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { sayList } from '../says.js';

export const GUARD = 63, MASTER = 64, GATES = [2, 5, 8], LAST_GATE = 11, HALL = 12, PHOENIX = spriteKey(0x08ded2);
export const WORDS = sayList(0x0FA980), AFTER = sayList(0x0FA9B2);
const speaker = who => G.units.find(u => u.alive && u.name === who) || (who === '通天教主' ? G.units.find(u => u.cid === MASTER) : null) || null;
const say = list => list.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));

// the way on out of a gate's chamber [0x0FA9C6]: the first hero's cell an exit; returns the beat for the presentation
function wayOn(G, routed) {
  const lead = G.units.find(u => u.side === 'player' && u.slot === 0 && u.alive) || players()[0];
  if (!lead) return null;
  G.terrain[lead.y][lead.x] = 4;
  return [{ fx: 'wayOn', at: [lead.x, lead.y], routed }];
}

export default {
  n: 27,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    const r = G.room;
    if (GATES.includes(r)) {
      if (r === 8) { const back = revive(7); if (back.length) G.joined.push(...back); }
      const guard = G.units.find(u => u.cid === GUARD && u.side === 'enemy');
      if (!guard || guard.alive || G.terrain.some(row => row.includes(4))) return null;
      const routed = G.units.filter(u => u.side === 'enemy' && u.alive && !u.away && u.moveType !== 9);   // [0x1DA7C]
      for (const u of routed) u.alive = false;
      return wayOn(G, routed);
    }
    if (r === LAST_GATE) {
      if (G.units.some(u => u.side === 'enemy' && u.alive) || G.terrain.some(row => row.includes(4))) return null;
      return wayOn(G, []);
    }
    if (r === HALL && !(G.beats & 1)) {
      G.beats |= 1;
      const master = G.units.find(u => u.cid === MASTER && u.side === 'enemy');   // (his graphic changes with the presentation's beat: PHOENIX)
      return [...say(WORDS), { fx: 'trueShape', unit: master }, ...say(AFTER)];
    }
    return null;
  },
  victory(G) { return G.units.some(u => u.cid === MASTER && u.side === 'enemy') && !G.units.some(u => u.cid === MASTER && u.side === 'enemy' && u.alive); },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [2, '楊戩亡'], [11, '燃燈道人亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
