// 費仲官邸一 (battle 5): the rules unique to it, from its ROM hooks (header 0x0EB358: turn hook 0x0EB4FC, lose
// 0x01AD2C; research/battles/05-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 05-feizhong-fx.js. 林雲, 燕蓉 and 楊戩 (deploy (13, 17), (14, 17), (13, 18)) break out of 費仲's mansion: the money
// tree is a sham and the house is roused. Sixteen men hold it (slots 10-25), all dormant: eight 綠盔士 (AI 7, within
// 6), four archers (18-21, AI 7, within 5) and four 大力士 (22-25, AI 10: they keep their room until a hero comes near).
// Before every unit's turn the hook checks three beats, each once (flags ff32c5 bits 0-2) [records ff02aa + 64 * slot:
// +33 AI, +34.. its parameters]:
//   0  the first archer (18) has woken: 10 and 11 come                                                  [0x0EB500]
//   1  the first 大力士 (22) has woken: 12 and 14 come, the archer 19 turns healer (AI 0x81, else 6)      [0x0EB536]
//   2  a hero reaches the north hall (row 6 or above): the whole house comes, 10-17 at once, the archers
//      18-21 as healers (0x81, else 6), the 大力士 22-24 as casters (0x80, else 6); 25 keeps his room   [0x0EB57A]
// Win: every enemy down (the generic rout; the hook's beat 3 then moves the heroes before 文王's door and plays his
// lines: 05-feizhong-fx.js victory) [0x0EB630]. Lose [0x01AD2C]: no hero left.
import { G, setAiP } from '../rules.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
const ai = n => { const u = slot(n); return u ? u.ai : null; };
const wake = (...ns) => { for (const n of ns) { const u = slot(n); if (u && u.alive) u.ai = 0; } };
const order = (n, aiNo, bytes) => { const u = slot(n); if (!u || !u.alive) return; u.ai = aiNo; bytes.forEach((v, i) => setAiP(u, 0x34 + i, v)); };
const heroes = () => G.units.filter(u => u.alive && u.side === 'player');
// beat 3: where the heroes stand before 文王's room, and 文王 himself (his record, ROM 0x06802A: gfx 0x06806A) [0x0EB6B6]
export const AFTER = { heroes: [[5, 4], [4, 4], [6, 4]], wen: { x: 5, y: 3, gfx: 0x06806a } };
// the say-list (0x0EB4E8): 文王, who is no unit here (shown by the hook), then 楊戩 and 林雲
export const OUTRO = sayList(0x0EB4E8).map((l, i) => i === 0 ? { who: l.who, text: l.text, wen: true } : l);

export default {
  n: 5,
  load(D) {   // the map art draws no chest at (15, 1) or (2, 18): found by striking their cells
    D.chests = D.chests.map(c => (c.x === 15 && c.y === 1) || (c.x === 2 && c.y === 18) ? Object.assign({}, c, { hidden: true }) : c);
  },
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    if (!(G.beats & 1) && ai(18) !== 7) { wake(10, 11); G.beats |= 1; }
    if (!(G.beats & 2) && ai(22) !== 10) { wake(12, 14); order(19, 0x81, [6, 0]); G.beats |= 2; }
    if (!(G.beats & 4) && heroes().some(u => u.y <= 6)) {
      wake(10, 11, 12, 13, 14, 15, 16, 17);
      for (const n of [18, 19, 20, 21]) order(n, 0x81, [6, 0]);
      for (const n of [22, 23, 24]) order(n, 0x80, [6, 0]);
      G.beats |= 4;
    }
    return null;
  },
  defeat(G) { return heroes().length ? null : '我方全滅'; },
};
