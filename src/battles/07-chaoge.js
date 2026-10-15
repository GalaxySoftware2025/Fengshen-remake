// 朝歌城門內 (battle 7): the rules unique to it, from its ROM hooks (header 0x0EBE5E: turn hook 0x0EBC02, lose 0x01AD7C,
// win 0x01AF62; research/battles/07-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 07-chaoge-fx.js. 林雲, 燕蓉 and 楊戩 (deploy (15, 22), (15, 23), (16, 22)) bring 文王 in through the court's south gap,
// bound for the north gate. Eight men hold the court (slots 10-17), all asleep: two 綠盔士 (AI 7, within 6), two archers
// (12-13, AI 7, within 6) and four 大力士 (14-17, AI 10: each keeps to the cells round where he stands, waking within 5
// as casters, AI 0x80).
// The turn hook [records ff02aa + 64 * slot: +1 facing (0 down, 8 up), +2 / +4 x / y, +33 AI, +34.. its parameters]:
//   0  before the first turn: 文王 (the record at ROM 0x06802A) copied into slot 3 at (16, 23), the heroes' side, AI 9 to
//      (16, 13), following slots 0-2 (0x0EB7AE); the heroes and he face north                       [0x0EBC06]
//   1  the 大力士 in slot 14 (7, 11) has woken (AI 0x80): four 綠盔士 come to the west half (0x1D956: each on the first free
//      cell round (8, 7), (10, 9), (4, 13), (7, 15)), the guard and 林雲, 文王 have words, and the soldier in slot 11
//      turns on the weakest (AI 6)                                                                        [0x0EBCA4]
//   2  the 大力士 in slot 15 (26, 11) has woken: four to the east half ((25, 7), (21, 14), (27, 15), (29, 12)), words with
//      燕蓉, and the soldier in slot 10 turns on the weakest                                              [0x0EBCFA]
//   3  文王 at (16, 13): on to (22, 9), or (9, 9) when 林雲 stands west of x 16                         [0x0EBD50]
//   4  文王 at (9, 9) or (22, 9): on to (16, 5), before the gate                                         [0x0EBD92]
// The reinforcements (record 0x0EBECE): 綠盔士 Lv 7, 攻 15, 防 8, 速 7, HP 20, moving 3, asleep (AI 7 within 6) and waking
// to AI 6; each takes the first free unit slot from 10 (a fallen man's slot is free again: 0x1D97A).
// Win [0x01AF62]: 林雲, 燕蓉, 楊戩 or 文王 on (15, 4) or (16, 4), before the gate's doors; or every enemy down.
// Lose [0x01AD7C]: 文王 down, or no one left on the heroes' side.
import { G, D, setAiP, players, makeUnit } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { sayList } from '../says.js';
import { WEN } from './06-feizhong2.js';

const slot = n => G.units.find(u => u.slot === n && u.alive);
export const EXITS = [[15, 4], [16, 4]];
export const GUEST = Object.assign({}, WEN, { x: 16, y: 23, facing: 'up', aip: [16, 13, 0x00, 0x0e, 0xb7, 0xae, 0xff, 0xff], aggro: 16 });
// the reinforcement's record (ROM 0x0EBECE)
export const RECRUIT = { cid: 14, name: '綠盔士', lv: 7, atk: 15, df: 8, spd: 7, hp: 20, mhp: 20, mp: 0, mmp: 0, exp: 0, moveType: 0, move: 3,
  rangeShape: 0, atkType: 0, items: [], spells: [], ai: 7, aggro: 6, aip: [6, 6, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], gfx: 0x07cdaa, sprite: spriteKey(0x07cdaa) };
export const WAVES = [[[8, 7], [10, 9], [4, 13], [7, 15]], [[25, 7], [21, 14], [27, 15], [29, 12]]];
// the say-lists (0x0EBBC8, 0x0EBBE2): 6-byte records, the actor a 1-based slot (0x0F: the 大力士 in slot 14)
export const LINES = [sayList(0x0EBBC8), sayList(0x0EBBE2)];
// the 13 cells tried round a spot, in the ROM's order (table 0x1D922), for the first free one a man on foot may stand on
const AROUND = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
function spawn(G, wave) {
  for (const [sx, sy] of wave) {
    const at = AROUND.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < D.mapW && y < D.mapH && D.costs[0][G.terrain[y][x]] < 127 && !G.units.some(u => u.alive && u.x === x && u.y === y));
    if (!at) continue;
    let s = 10; while (G.units.some(u => u.alive && u.slot === s)) s++;   // the first free slot from 10 (0x1D97A)
    for (const u of G.units) if (!u.alive && u.slot === s) u.slot = null;   // a fallen man's slot taken over
    const u = makeUnit(RECRUIT, 'enemy', { slot: s }); [u.x, u.y] = at; u.facing = 'down';
    G.units.push(u); G.joined.push(u);
  }
}

export default {
  n: 7,
  load(D) {
    // the map art draws the chests at (2, 15) and (29, 11): (2, 4) and (29, 4) are found by striking their cells
    D.chests = D.chests.map(c => (c.x === 2 && c.y === 4) || (c.x === 29 && c.y === 4) ? Object.assign({}, c, { hidden: true }) : c);
    D.enemies = D.enemies.concat([Object.assign({}, GUEST)]);   // in place from the start: the hook copies him in before anyone moves
  },
  setup(G) { G.beats = 0; G.joined = []; for (const u of G.units) if (u.side === 'player') u.facing = 'up'; },
  beforeTurn(G) {
    let out = null;
    if (!(G.beats & 1)) G.beats |= 1;   // (文王 and the facings: load / setup)
    const said = (k, n, wakeSlot) => {
      spawn(G, WAVES[k]);
      out = (out || []).concat(LINES[k].map(l => ({ who: l.who, text: l.text, unit: slot(l.slot) || null })));
      const w = slot(wakeSlot); if (w) w.ai = 6;
      G.beats |= n;
    };
    if (!(G.beats & 2) && slot(14) && slot(14).ai === 0x80) said(0, 2, 11);
    if (!(G.beats & 4) && slot(15) && slot(15).ai === 0x80) said(1, 4, 10);
    const wen = slot(3), lin = slot(0);
    if (wen) {
      if (!(G.beats & 8) && wen.x === 16 && wen.y === 13) { const west = lin && lin.x < 16; setAiP(wen, 0x34, west ? 9 : 22); setAiP(wen, 0x35, 9); G.beats |= 8; }
      if (!(G.beats & 16) && ((wen.x === 9 && wen.y === 9) || (wen.x === 22 && wen.y === 9))) { setAiP(wen, 0x34, 16); setAiP(wen, 0x35, 5); G.beats |= 16; }
    }
    return out;
  },
  victory(G) {
    if (!G.units.some(u => u.alive && u.side === 'enemy')) return true;
    return [0, 1, 2, 3].some(n => { const u = slot(n); return u && u.side === 'player' && EXITS.some(([x, y]) => u.x === x && u.y === y); });
  },
  defeat(G) {
    const wen = G.units.find(u => u.guest);
    if (wen && !wen.alive) return '文王亡';
    return players().length ? null : '我方全滅';
  },
  goal() { return EXITS.map(([x, y]) => ({ x, y })); },
};
