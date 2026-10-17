// 麒麟山 (battle 15): the rules unique to it, from its ROM hooks (header 0x0F2E7C: turn hook 0x0F2C00, lose 0x0F2D14, win
// 0x0F2D3C; research/battles/15-hooks.txt). Pure rules, shared with the headless sim; the presentation is 15-qilin-fx.js.
// 林雲, 燕蓉 and 楊戩 (forced; 黃飛虎 stays at 西岐, up to six, deploy mid-mountain) climb to tame the 麒麟獸: two rooms
// (data/battles/15.js rooms, the table at 0x0F2E40: both entries are the summit, so the battle starts on its own map,
// src/rules.js loadBattle), the turn hook picking the room's handler by its number (ff0f4f, table 0x0F2BA0). On the
// slopes 石頭 and 幻獸 wait asleep; at the summit the 麒麟獸 with 異鳥, 幻獸 and a 法師. [flags ff32c5 bits 0-2]
//   room 0  a hero on the cells of 0x0F2BA8 (x 8-11, y 3-5) brings the first wave, once; a hero on those of 0x0F2BD6
//           (x 26-28, y 7-10) the second, once (0x1E0A8: heroes only; 0x1D956: each man on the first free of 13
//           cells round his spot, the first free slot from 10); in round 4 (ff32c4), once, the two 幻獸 of slots 20
//           and 21 wake (AI 0)                                                                         [0x0F2C2A]
//   room 1  only the exits                                                                            [0x0F2D04]
// Win [0x0F2D3C]: the 麒麟獸 (class 37) gone. Lose [0x0F2D14]: 楊戩 (class 2) gone.
import { G, D, players, makeUnit, AROUND } from '../rules.js';
import { spriteKey } from '../sprites.js';

const slot = n => G.units.find(u => u.slot === n);
// the waves' records (0x0F3030 幻獸, 0x0F2FF0 石頭): asleep, waking with a hero within 7, then chasing (AI 7 -> 0)
const REC = {
  beast: { cid: 36, name: '幻獸', lv: 24, atk: 26, df: 24, spd: 12, hp: 30, mhp: 30, mp: 24, mmp: 24, moveType: 0, move: 5, rangeShape: 0, atkType: 1, spells: [], ai: 7, aggro: 7, aip: [7, 0, 255, 255, 255, 255, 255, 255], gfx: 0x0c7c6a },   // 0x0F3030
  stone: { cid: 43, name: '石頭', lv: 24, atk: 28, df: 18, spd: 20, hp: 25, mhp: 25, mp: 0, mmp: 0, moveType: 8, move: 5, rangeShape: 0, atkType: 1, spells: [], ai: 7, aggro: 7, aip: [7, 0, 255, 255, 255, 255, 255, 255], gfx: 0x0dd4d2 },   // 0x0F2FF0
};
// the trigger lists (0x0F2BA8, 0x0F2BD6) and the waves they bring (0x0F2E48, 0x0F2E62): spot, record
export const TRIGGERS = [[[9, 3], [10, 3], [11, 3], [8, 4], [9, 4], [10, 4], [11, 4], [8, 5], [9, 5], [10, 5], [11, 5]],
  [[27, 7], [28, 7], [27, 8], [28, 8], [26, 9], [27, 9], [28, 9], [26, 10], [27, 10], [28, 10]]];
export const WAVES = [[[1, 5, 'beast'], [5, 4, 'beast'], [2, 4, 'stone']], [[27, 14, 'beast'], [26, 17, 'beast'], [29, 12, 'stone']]];
export const WAVE_SPRITES = [...new Set(Object.values(REC).map(r => spriteKey(r.gfx)))];

function bring(G, wave) {
  for (const [sx, sy, kind] of wave) {
    const r = REC[kind];
    const at = AROUND.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < D.mapW && y < D.mapH && D.costs[r.moveType][G.terrain[y][x]] < 127 && !G.units.some(u => u.alive && u.x === x && u.y === y));
    if (!at) continue;
    let s = 10; while (G.units.some(u => u.alive && u.slot === s)) s++;   // the first free slot from 10 (0x1D97A)
    for (const u of G.units) if (!u.alive && u.slot === s) u.slot = null;
    const u = makeUnit(Object.assign({ exp: 0, items: [], sprite: spriteKey(r.gfx) }, r), 'enemy', { slot: s });
    [u.x, u.y] = at; u.facing = 'down'; G.units.push(u); G.joined.push(u);
  }
}

export default {
  n: 15,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (G.room !== 0) return null;
    const on = cells => players().some(p => p.slot < 10 && cells.some(([x, y]) => p.x === x && p.y === y));
    for (let k = 0; k < 2; k++) if (!(G.beats & (1 << k)) && on(TRIGGERS[k])) { G.beats |= 1 << k; bring(G, WAVES[k]); }
    if (G.round === 4 && !(G.beats & 4)) { G.beats |= 4; for (const s of [20, 21]) { const u = slot(s); if (u && u.alive) u.ai = 0; } }
    return null;
  },
  victory(G) { return G.units.some(u => u.cid === 37 && u.side === 'enemy') && !G.units.some(u => u.cid === 37 && u.side === 'enemy' && u.alive); },
  defeat(G) { const y = G.units.find(u => u.side === 'player' && u.cid === 2); if (y && !y.alive) return '楊戩亡'; return players().length ? null : '我方全滅'; },
};
