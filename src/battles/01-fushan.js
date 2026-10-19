// 傅山山谷一 (battle 1): the rules unique to it, from its ROM turn hook (header 0x0E8D44, turn hook 0x0E89A8,
// research/battles/01-hooks.txt). Pure rules, shared with the headless sim; the presentation is 01-fushan-fx.js.
// The supply cart's escort (slots 10-14; 14 is their leader, the 綠盔士) all start dormant. Before every unit's turn
// the hook checks four beats, each once (flags ff32c5 bits 0-3), and plays its say-list [records: actor = 1-based slot]:
//   0  the first turn: slots 10 and 11 attack                                                    [0x0E89AC, 0x0E8976]
//   1  10 or 11 has fallen, 12 still waits: the leader sends 12                                [0x0E89E2, 0x0E8984]
//   2  10 and 11 have fallen, 13 still waits: the leader sends 13                               [0x0E8A56, 0x0E8992]
//      (the ROM also tests (a1) here without loading it: a1 still holds the hook's own address, from the caller's
//      movea.l ff32bc, so it reads ROM bytes 0x48 and 0xF9 and always passes)
//   3  10-13 have all fallen and 14 still waits: the leader attacks                            [0x0E8ABE, 0x0E89A0]
// Win and lose are the generic ones (every enemy down; 林雲 falls).
import { G } from '../rules.js';
import { sayList } from '../says.js';

const LINES = { 0: sayList(0x0E8976), 1: sayList(0x0E8984), 2: sayList(0x0E8992), 3: sayList(0x0E89A0) };   // [ROM say-lists: chapter 1's speakers 40-43, the escort, who have no name]
const slot = n => G.units.find(u => u.slot === n);
const up = n => { const u = slot(n); return u && u.alive; };
const waiting = n => { const u = slot(n); return u && u.alive && u.ai !== 0; };
const wake = (...ns) => { for (const n of ns) { const u = slot(n); if (u) u.ai = 0; } };
const say = beat => LINES[beat].map(l => ({ who: '', text: l.text, unit: slot(l.slot) })).filter(l => l.unit && l.unit.alive);

export default {
  n: 1,
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    const out = [], fire = (b, ok, then) => { if (G.beats & (1 << b) || !ok) return; G.beats |= 1 << b; out.push(...say(b)); then(); };
    fire(0, true, () => wake(10, 11));
    fire(1, up(14) && waiting(14) && waiting(12) && !(up(10) && up(11)), () => wake(12));
    fire(2, !up(10) && !up(11) && waiting(13), () => wake(13));
    fire(3, waiting(14) && ![10, 11, 12, 13].some(up), () => wake(14));
    return out.length ? out : null;
  },
};
