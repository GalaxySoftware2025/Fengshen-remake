// 傅山山谷三 (battle 4): the rules unique to it, from its ROM hooks (header 0x0EA31E: turn hook 0x0E9F18, win 0x01AE48,
// lose 0x01AD2C; research/battles/04-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 04-fushan-fx.js. 林雲 and 燕蓉 come up the valley from the south-east (deploy (27, 18), (28, 18)) for the bridge out
// at the north-east. Thirteen of 龍安城's men wait in it (slots 10-22), dormant (AI 7, within 4), but for an archer on
// the north ridge (slot 20, AI 8) and two who hold the bridge's approach (21, 22: AI 10). Before every unit's turn the
// hook checks six beats, each once (flags ff32c5 bits 0-5) [records ff02aa + 64 * slot: +33 AI, +34.. its parameters;
// say-list actors are 1-based slots]:
//   0  every turn until it fires: the archer's wake-up is set (AI 8, within 5, then AI 0x81) and slots 10 and 15
//      come at once; once 10 or 15 has fallen while 16 still waits, 16 swears revenge and sends 11 and 12 to
//      (9, 14) and (10, 12) (AI 9; there, dormant within 5, waking to 0)                     [0x0E9F1C, 0x0E9EC6]
//   1  16 has woken: 11 and 12 come at once                                                                 [0x0E9FF2]
//   2  13 has woken: 17 comes too                                                                           [0x0EA02E]
//   3  the archer has woken (AI 0x81): 13, 17 and 18 come, and 楊戩 appears at (15, 6), joins as slot 2, and
//      speaks with the archer                                                                  [0x0EA05E, 0x0E9ECE]
//   4  a hero reaches the cells (14-18, 7-9) by the bridge's road: the 大力士 (22) orders 14, 19, 21 and himself to
//      the bridge's mouth (AI 9 to (22-23, 7-9); there, dormant: 14 and 19 within 1 waking to 0, 21 within 1 to
//      0x81, 22 within 6 to 0x80)                                                              [0x0EA120, 0x0E9EE2]
//   5  the 大力士 has woken (AI 0x80): 14 and 19 come, 21 turns healer (0x81, else AI 6)                     [0x0EA1FE]
// Win [0x01AE48]: every enemy down, or a hero on the bridge's first cells (29-31, 7). Lose [0x01AD2C]: no hero left.
import { G, D, setAiP, makeUnit, unitAt } from '../rules.js';
import { hero } from '../party.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
const ai = n => { const u = slot(n); return u ? u.ai : null; };
const wake = (...ns) => { for (const n of ns) { const u = slot(n); if (u && u.alive) u.ai = 0; } };
const order = (n, aiNo, bytes) => { const u = slot(n); if (!u || !u.alive) return; u.ai = aiNo; bytes.forEach((v, i) => setAiP(u, 0x34 + i, v)); };
const line = (n, text, who = '') => ({ who, text, unit: n == null ? null : slot(n) });
const says = addr => sayList(addr).map(l => line(l.slot, l.text, l.who));   // a ROM say-list, each line on its actor's unit
export const EXIT = [[29, 7], [30, 7], [31, 7]];
export const ROAD = [[15, 7], [16, 7], [17, 7], [18, 7], [15, 8], [16, 8], [17, 8], [18, 8], [15, 9], [16, 9], [17, 9], [18, 9], [14, 7], [14, 8]];   // table 0x0E9EFC
export const YANG = { cid: 2, x: 15, y: 6 };   // 楊戩's record, ROM 0x054D68: level 5, at (15, 6); the camera goes there
const heroes = () => G.units.filter(u => u.alive && u.side === 'player');
const on = (cells, u) => cells.some(([x, y]) => u.x === x && u.y === y);

export default {
  n: 4,
  load(D) {   // the map art draws no chest at (18, 3)
    D.chests = D.chests.map(c => c.x === 18 && c.y === 3 ? Object.assign({}, c, { hidden: true }) : c);
  },
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    const out = [];
    if (!(G.beats & 1)) {
      order(20, 8, [5, 0x81, 0, 0, 0, 0]);   // +32-39 = 00 08 05 81 00 00 00 00: dormant (shown to the camera), within 5, wakes healing
      // (the ROM writes this every turn until the beat fires: an archer already awake is put back to sleep)
      const a = slot(10), b = slot(15); wake(10, 15);
      if (!(a && a.alive && b && b.alive) && ai(16) !== 0) {
        out.push(...says(0x0E9EC6));
        order(11, 9, [9, 14, 0x18, 8, 5, 0]); order(12, 9, [10, 12, 0, 8, 5, 0]);
        G.beats |= 1;
      }
    }
    if (!(G.beats & 2) && ai(16) === 0) { wake(11, 12); G.beats |= 2; }
    if (!(G.beats & 4) && ai(13) === 0) { wake(17); G.beats |= 4; }
    if (!(G.beats & 8) && ai(20) === 0x81) {
      wake(13, 17, 18);
      if (!G.units.some(u => u.cid === YANG.cid && u.side === 'player')) {
        const y = makeUnit(hero(D, YANG.cid, D.heroes[YANG.cid].lv), 'player', { slot: 2, joinedHere: true });
        [y.x, y.y] = unitAt(YANG.x, YANG.y) ? free(YANG.x, YANG.y) : [YANG.x, YANG.y];
        G.units.push(y); G.joined.push(y);
      }
      out.push(...says(0x0E9ECE));
      G.beats |= 8;
    }
    if (!(G.beats & 16) && heroes().some(u => on(ROAD, u))) {
      out.push(...says(0x0E9EE2));
      order(14, 9, [0x16, 0x08, 0x10, 0x08, 0x01, 0x00, 0x06, 0xff]); order(19, 9, [0x17, 0x07, 0x10, 0x08, 0x01, 0x00, 0x06, 0xff]);
      order(21, 9, [0x17, 0x09, 0x10, 0x08, 0x01, 0x81, 0x06, 0xff]); order(22, 9, [0x17, 0x08, 0x10, 0x08, 0x06, 0x80, 0x06, 0xff]);
      G.beats |= 16;
    }
    if (!(G.beats & 32) && ai(22) === 0x80) { wake(14, 19); order(21, 0x81, [6]); G.beats |= 32; }
    const said = out.filter(l => !l.unit || l.unit.alive);
    return said.length ? said : null;
  },
  victory(G) { return !G.units.some(u => u.alive && u.side === 'enemy') || heroes().some(u => on(EXIT, u)); },
  defeat(G) { return heroes().length ? null : '我方全滅'; },
};
// the nearest free open cell to (x, y), should someone stand where 楊戩 appears [design]
function free(x, y) {
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy; if (Math.abs(dx) + Math.abs(dy) !== r || !G.terrain[ny] || G.terrain[ny][nx] !== 0 || unitAt(nx, ny)) continue;
    return [nx, ny];
  }
  return [x, y];
}
