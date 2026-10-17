// 臨潼關草原 (battle 8): the rules unique to it, from its ROM hooks (header 0x0EC69C: turn hook 0x0EC60C, lose 0x01AD2C,
// win 0x01ADDC, a frame hook 0x0EC13C that cycles two of the water's colours every 10 frames; research/battles/08-hooks.txt).
// Pure rules, shared with the headless sim; the presentation is 08-lintong-fx.js. 林雲, 燕蓉 and 黃飛虎 (joined in scene 15,
// Lv 10) with 楊戩 if chosen (deploy (8, 20), (5, 20), (7, 21) on the river's south bank, (15, 13) at its north bank) take on
// 殷破敗's men, all awake: a 綠盔士 (AI 0x80, 雷光), two archers (AI 0), two 大力士 (AI 6, the weakest first) and a 法師
// (AI 0x81, a healer).
// The turn hook: in round 3 (ff32c4, the round, counted from 1 at 0x1E736), before the first unit's turn, once (flag
// ff32c5 bit 0): 雷開's men come (0x1D956, record by record: the first of 13 cells round each spot, the first free slot from
// 10) and 雷開 (the first of them) and 林雲 have words                                               [0x0EC60C]
// Win [0x01ADDC]: every enemy down. Lose [0x01AD2C]: no hero left.
import { G, D, players, makeUnit, AROUND } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n && u.alive);
// the wave (0x0EC6FC): spot, the item it carries, its record
const REC = {
  soldier: { cid: 14, name: '綠盔士', lv: 12, atk: 18, df: 12, spd: 9, hp: 30, mhp: 30, mp: 24, mmp: 24, moveType: 0, move: 3, rangeShape: 0, atkType: 0, spells: [22], ai: 0x80, aip: [0, 0, 255, 255, 255, 255, 255, 255], gfx: 0x07cdaa },   // 0x0EC72E
  archer: { cid: 15, name: '弓箭手', lv: 10, atk: 15, df: 7, spd: 8, hp: 20, mhp: 20, mp: 3, mmp: 3, moveType: 1, move: 4, rangeShape: 1, atkType: 2, spells: [38], ai: 0, aip: [255, 255, 255, 255, 255, 255, 255, 255], gfx: 0x08278c },   // 0x0EC76E
  strong: { cid: 17, name: '大力士', lv: 10, atk: 16, df: 8, spd: 7, hp: 20, mhp: 20, mp: 7, mmp: 7, moveType: 0, move: 2, rangeShape: 0, atkType: 1, spells: [8], ai: 6, aip: [0, 0, 255, 255, 255, 255, 255, 255], gfx: 0x084bbe },   // 0x0EC7AE
  mage: { cid: 19, name: '法師', lv: 11, atk: 16, df: 6, spd: 9, hp: 25, mhp: 25, mp: 20, mmp: 20, moveType: 0, move: 2, rangeShape: 0, atkType: 1, spells: [38], ai: 0x81, aip: [0, 0, 255, 255, 255, 255, 255, 255], gfx: 0x087746 },   // 0x0EC7EE
};
export const WAVE = [[21, 19, 'soldier', 4], [23, 17, 'archer'], [21, 8, 'archer'], [17, 20, 'strong'], [20, 11, 'strong'], [19, 21, 'mage']];
export const WAVE_SPRITES = [...new Set(Object.values(REC).map(r => spriteKey(r.gfx)))];
// the say-list (0x0EC5FE): 雷開 (speaker 49, his chapter counter's line 0) on the wave's first man (actor 0x11: slot 16), then 林雲
export const LINES = sayList(0x0EC5FE).map((l, i) => i === 0 ? { who: l.who, text: l.text, first: true } : l);   // (雷開: the wave's first man)

export default {
  n: 8,
  load(D) {   // the map art draws the chests at (12, 13) and (18, 2): (0, 0) and (0, 23) are found by striking their cells
    D.chests = D.chests.map(c => (c.x === 0 && c.y === 0) || (c.x === 0 && c.y === 23) ? Object.assign({}, c, { hidden: true }) : c);
  },
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (G.beats & 1 || G.round !== 3) return null;
    G.beats |= 1;
    let first = null;
    for (const [sx, sy, kind, item] of WAVE) {
      const at = AROUND.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < D.mapW && y < D.mapH && D.costs[REC[kind].moveType][G.terrain[y][x]] < 127 && !G.units.some(u => u.alive && u.x === x && u.y === y));
      if (!at) continue;
      let s = 10; while (G.units.some(u => u.alive && u.slot === s)) s++;
      for (const u of G.units) if (!u.alive && u.slot === s) u.slot = null;
      const r = REC[kind], u = makeUnit(Object.assign({ exp: 0, items: [], sprite: spriteKey(r.gfx) }, r), 'enemy', { slot: s });
      if (item != null) u.drop = item;   // what he carries (record byte +0x12 set from the list: 0x1DA22)
      [u.x, u.y] = at; u.facing = 'left'; G.units.push(u); G.joined.push(u); first = first || u;
    }
    return LINES.map(l => ({ who: l.who, text: l.text, unit: l.first ? first : slot(l.slot) || null }));
  },
  defeat(G) { return players().length ? null : '我方全滅'; },
};
