// 傅山山谷二 (battle 2): the rules unique to it, from its ROM turn hook (header 0x0E9322, turn hook 0x0E904C,
// research/battles/02-hooks.txt). Pure rules, shared with the headless sim; the presentation is 02-fushan-fx.js.
// The soldiers searching the hills (slots 10-15) start dormant; their leader, the 綠盔士 (slot 16), paces his post
// (AI 10: a random cell within 2 of (22, 7), until a hero is next to him). Before every unit's turn the hook checks
// three beats, each once (flags ff32c5 bits 0-2) [records: actor = 1-based slot]:
//   2  the first turn: slots 10 and 11 come at once; 14 and 15 now wake only for a hero next to them  [0x0E9110]
//   0  林雲 has come north of row 9 (y < 9): the leader and 14 / 15 fall back to (21, 7), (20, 7) and (20, 8) (AI 9)
//      and wait there, dormant, for a hero within 6 / 5 (record +37-39 = 8, 6 or 5, 0); his order:  [0x0E9050, 0x0E9038]
//   1  the leader has taken to the fight (AI 0) before beat 0: 14 and 15 join it (and beat 0 is spent)  [0x0E90D2]
// Win and lose are the generic ones (every enemy down; 林雲 falls). Changed from the original: the bottom strip is cliff (load).
import { G, setAiP } from '../rules.js';
import { sayList } from '../says.js';

const ORDER = sayList(0x0E9038);   // [ROM say-list: the leader in slot 16, then 14 and 15]
const slot = n => G.units.find(u => u.slot === n);
const hero = () => G.units.find(u => u.slot === 0 || (u.side === 'player' && u.cid === 0));
const fallBack = (n, ai, p) => { const u = slot(n); if (!u || !u.alive) return; u.ai = ai; p.forEach((v, i) => setAiP(u, 0x34 + i, v)); };

export default {
  n: 2,
  load(D) {
    // [design, the user's choice] the strip along the bottom row (14, x 8-23), open floor below the rim in the
    // original, is cliff here: blocked, as the remade gorge draws it (src/remake/gorge.js)
    D.terrain = D.terrain.map((r, y) => y === 14 ? r.map((t, x) => x >= 8 && x <= 23 ? 2 : t) : r);
  },
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    let out = null;
    const h = hero();
    if (!(G.beats & 1) && h && h.alive && h.y < 9) {
      G.beats |= 1;
      fallBack(14, 9, [0x14, 0x07, 0x10, 0x08, 0x05, 0x00]);   // the hook's bytes: goal, then +37-39 (AI 8, range 5, wake to AI 0)
      fallBack(15, 9, [0x14, 0x08, 0x10, 0x08, 0x05, 0x00]);
      fallBack(16, 9, [0x15, 0x07, 0x10, 0x08, 0x06, 0x00]);
      out = ORDER.map(l => ({ who: '', text: l.text, unit: slot(l.slot) })).filter(l => l.unit && l.unit.alive);
    }
    if (!(G.beats & 2)) {
      const lead = slot(16);
      if (lead && lead.ai === 0) { G.beats |= 3; for (const n of [14, 15]) { const u = slot(n); if (u) u.ai = 0; } }
    }
    if (!(G.beats & 4)) {
      G.beats |= 4;
      for (const n of [10, 11]) { const u = slot(n); if (u) u.ai = 0; }
      for (const n of [14, 15]) { const u = slot(n); if (u) setAiP(u, 0x34, 1); }
    }
    return out && out.length ? out : null;
  },
};
