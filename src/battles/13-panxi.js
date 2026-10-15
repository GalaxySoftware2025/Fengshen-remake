// 磻溪 (battle 13): the rules that are unique to it, from its ROM hook code (header 0x0F1CE2, research/battles/13-hooks.txt).
// Pure rules, shared with the headless sim; the matching presentation is 13-panxi-fx.js.
//   - the forest fire: the setup burns column 31, then every round the fire takes the next column west [ROM]
//   - 姜子牙 bound to his stake at (22, 6): copied from the record at 0x64A88 into unit slot 29 [ROM 0xF17BA]
//   - the ambush: a hero stepping on the trigger cells (table 0xF1C46) wakes six of the demons [ROM 0x1E0A8]
//   - win: a hero next to 姜子牙 [ROM 0xF18CA]; lose: 姜子牙 burns, or 林雲 falls
import { G, players, manhattan } from '../rules.js';

export const JIANG_CID = 7;
const FIRE_START = 31, TRIGGER = [[13, 6], [14, 6], [15, 6], [16, 6], [13, 7], [14, 7], [15, 7], [16, 7]], TRIGGER_UNITS = [10, 11, 12, 13, 17, 18];
// [ROM 0x64A88 + the hook's overrides: move type 9 (bound), position (22, 6), the bound graphics 0x67A8E, AI 7 / aggro 0]
const JIANG = { cid: 7, lv: 22, atk: 22, df: 22, spd: 18, hp: 32, mhp: 32, exp: 0, mp: 21, mmp: 21, moveType: 9, move: 3, rangeShape: 0,
  items: [], spells: [26], ai: 7, aggro: 0, gfx: 0x67a8e, anim: 0x388ba, x: 22, y: 6, slot: 29, name: '姜子牙', sprite: 'jiang_bound', side: 'npc' };

export const jiang = () => G.units.find(u => u.cid === JIANG_CID && u.side === 'npc');

export function burnColumn(x) {
  G.burnt.add(x);
  for (let y = 0; y < 15; y++) if (G.terrain[y]) G.terrain[y][x] = 1;
  const victims = G.units.filter(u => u.alive && u.x === x);
  for (const u of victims) u.alive = false;
  return victims;
}

export default {
  n: 13,
  load(D) {
    D.mapH = 14;                      // the bottom row is all wall, and the HD map art of the 磻溪 build covers 14 rows
    D.enemies.push(Object.assign({}, JIANG));
  },
  setup(G) { G.fireCol = FIRE_START; G.burnt = new Set(); burnColumn(FIRE_START); },   // [ROM] setup burns column 31 before round 1
  roundStart(G) { const col = G.fireCol, victims = burnColumn(col); G.fireCol--; return { col, victims }; },
  trigger(G) {
    if (G.triggerFired) return false;
    if (players().some(p => TRIGGER.some(([x, y]) => p.x === x && p.y === y))) {
      G.triggerFired = true;
      for (const u of G.units) if (u.slot !== undefined && TRIGGER_UNITS.includes(u.slot)) u.ai = 0;
      return true;
    }
    return false;
  },
  victory() { const j = jiang(); return j && j.alive && players().some(p => manhattan(p, j) === 1); },
  defeat(G) {
    const j = jiang(), h = G.units.find(u => u.cid === 0 && u.side === 'player');
    if (!j.alive) return '姜子牙葬身火海';
    if (!h.alive) return '林雲陣亡';
    return null;
  },
  goal: G => G.units.filter(v => v.cid === JIANG_CID),
  hud: G => {                        // the fire meter: columns until the fire reaches 姜子牙 at x = 22
    const left = Math.max(0, G.fireCol - 22);
    return { label: '火勢', fill: Math.min(100, (31 - G.fireCol) / 9 * 100), text: left > 0 ? '距姜子牙　' + left + ' 列' : '烈焰已至' };
  },
};
