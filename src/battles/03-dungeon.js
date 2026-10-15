// 龍安城地牢 (battle 3): the rules unique to it, from its ROM turn hook (header 0x0E9BF8, turn hook 0x0E9432,
// research/battles/03-hooks.txt). Pure rules, shared with the headless sim; the presentation is 03-dungeon-fx.js.
// 林雲 and 燕蓉 break out of the cells (deploy (2, 4), (2, 6)); the seven guards (slots 10-16) start dormant (AI 7,
// within 5); their leader, the 綠盔士 (slot 17), paces before the stairs up (AI 10: a cell within 2 / 1 of (13, 2)
// until a hero is within 6). Before every unit's turn the hook checks two beats, each once (flags ff32c5 bits 0-1)
// [records ff02aa + 64 * slot: +2 x, +33 AI, +34.. its parameters]:
//   0  the first turn: slots 10-12, the guards in the corridor and the cell block, come at once        [0x0E9436]
//   1  a hero (slot 0 or 1) has come east to column 13 or beyond: the rest (13-16) come too, and the leader goes to
//      (14, 2), the foot of the stairs (AI 9), and waits there, dormant, for a hero within 5 (+37-39 = 8, 5, 0x80:
//      0x80 with nothing to cast takes +34, then 0: he fights); his order:                    [0x0E9462, 0x0E942A]
// Win and lose are the generic ones (every enemy down; both heroes fall).
import { G, setAiP } from '../rules.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
const wake = (...ns) => { for (const n of ns) { const u = slot(n); if (u && u.alive) u.ai = 0; } };

export default {
  n: 3,
  load(D) {   // the map art draws no chest at (6, 2) (in 燕蓉's cell) nor at (15, 0) (the hall's corner)
    // [design, the user's call] the store room's east wall opened at (12, 8): the original seals the room (barred front,
    // walls), so its chest at (11, 8) could not be reached; a hero now steps in beside it from the hall
    D.terrain = D.terrain.map((r, y) => y === 8 ? r.map((t, x) => x === 12 ? 0 : t) : r);
    D.chests = D.chests.map(c => (c.x === 6 && c.y === 2) || (c.x === 15 && c.y === 0) ? Object.assign({}, c, { hidden: true }) : c);
    // [design, the user's call] the store room's chest one cell west, (10, 8): the original draws it at (11, 8), right at
    // the gap we opened in the room's east wall
    D.chests = D.chests.map(c => c.x === 11 && c.y === 8 ? Object.assign({}, c, { x: 10 }) : c);
  },
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    let out = null;
    if (!(G.beats & 1)) { G.beats |= 1; wake(10, 11, 12); }
    if (!(G.beats & 2) && G.units.some(u => u.side === 'player' && u.alive && u.x >= 13)) {
      G.beats |= 2; wake(13, 14, 15, 16);
      const lead = slot(17);
      if (lead && lead.alive) {
        lead.ai = 9; [0x0e, 0x02, 0x00, 0x08, 0x05, 0x80].forEach((v, i) => setAiP(lead, 0x34 + i, v));   // the hook's bytes: goal (14, 2), then +37-39
        out = [{ who: '', text: sayList(0x0E942A)[0].text, unit: lead }];   // [ROM say-list 0x0E942A]
      }
    }
    return out;
  },
};
