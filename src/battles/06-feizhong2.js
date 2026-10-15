// 費仲官邸二 (battle 6): the rules unique to it, from its ROM hooks (header 0x0EB952: turn hook 0x0EB7B2, lose
// 0x01AD7C, win 0x01AEFE; research/battles/06-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 06-feizhong2-fx.js. 林雲, 燕蓉 and 楊戩 (deploy (2, 2), (2, 3), (1, 2)) lead 文王 out of 費仲's mansion by night.
// Thirteen men hold the house (slots 10-22), all dormant: five 綠盔士 (AI 7, within 6), four archers (15-18, AI 7, within 5,
// waking as healers: AI 0x81, else 6) and four 大力士 (19-22, AI 10: each keeps to the cells round where he stands).
// The turn hook [records ff02aa + 64 * slot: +1 facing (0 down, 8 up, 0x10 left, 0x18 right), +2 / +4 x / y, +33 AI,
// +34.. its parameters]:
//   0  before the first turn: 文王 (the record at ROM 0x06802A) is copied into slot 3 at (1, 3), the heroes' side (ff0a2a
//      counts him), AI 9 to (13, 6), following slots 0-2 (the list at 0x0EB7AE); the heroes and he face east, the 大力士
//      in the hall (19) west; the guard and 楊戩 have words                                               [0x0EB7B6]
//   1  文王 at (13, 6): on to (8, 9)                                                                       [0x0EB888]
//   2  文王 at (8, 9): on to (4, 15), the door out                                                        [0x0EB8B4]
// (13, 6) is wall, so no path ever reaches it (the ROM's own path search, 0xBFE0, fails there; played in the harness, he
// never walks there): 文王 always follows the heroes instead (rules.js guestPlan), and beats 1-2 never come. Ported as is.
// Win [0x01AEFE]: 林雲, 燕蓉, 楊戩 or 文王 on (4, 15), the door in the south-west room; or every enemy down.
// Lose [0x01AD7C]: 文王 down, or no one left on the heroes' side (文王 counts: with the heroes gone he goes on alone).
import { G, setAiP, players } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { sayList } from '../says.js';

const slot = n => G.units.find(u => u.slot === n);
export const EXIT = [4, 15];
// 文王's record (ROM 0x06802A, 15 longs): Lv 5, 攻 1, 防 8, 速 4, HP 16, moves 2 on foot; the hook sets his cell and AI
export const WEN = { cid: 12, name: '文王', lv: 5, atk: 1, df: 8, spd: 4, hp: 16, mhp: 16, mp: 0, mmp: 0, exp: 0, moveType: 2, move: 2,
  rangeShape: 0, atkType: 1, items: [], spells: [], ai: 9, aggro: 13, aip: [13, 6, 0x00, 0x0e, 0xb7, 0xae, 0xff, 0xff], gfx: 0x06806a, anim: 0x03889a,
  x: 1, y: 3, slot: 3, side: 'player', guest: true, follow: [0, 1, 2], facing: 'right', sprite: spriteKey(0x06806a) };
// beat 0's say-list (0x0EB78E): 6-byte records, the actor a 1-based slot (0x14: the 大力士 in the hall, 19)
export const LINES = sayList(0x0EB78E);

export default {
  n: 6,
  load(D) {
    // the map art draws only the chest at (4, 10): (21, 3) and (18, 14) are found by striking their cells
    D.chests = D.chests.map(c => (c.x === 21 && c.y === 3) || (c.x === 18 && c.y === 14) ? Object.assign({}, c, { hidden: true }) : c);
    D.enemies = D.enemies.concat([Object.assign({}, WEN)]);   // in place from the start: the hook copies him in before anyone moves
  },
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    let out = null;
    if (!(G.beats & 1)) {
      for (const u of G.units) if (u.side === 'player') u.facing = 'right';
      const guard = slot(19); if (guard) guard.facing = 'left';
      out = LINES.map(l => ({ who: l.who, text: l.text, unit: slot(l.slot) || null }));
      G.beats |= 1;
    }
    const wen = slot(3);
    if (wen && wen.alive) {
      if (!(G.beats & 2) && wen.x === 13 && wen.y === 6) { setAiP(wen, 0x34, 8); setAiP(wen, 0x35, 9); G.beats |= 2; }
      if (!(G.beats & 4) && wen.x === 8 && wen.y === 9) { setAiP(wen, 0x34, 4); setAiP(wen, 0x35, 15); G.beats |= 4; }
    }
    return out;
  },
  victory(G) {
    if (!G.units.some(u => u.alive && u.side === 'enemy')) return true;
    return [0, 1, 2, 3].some(n => { const u = slot(n); return u && u.alive && u.side === 'player' && u.x === EXIT[0] && u.y === EXIT[1]; });
  },
  defeat(G) {
    const wen = slot(3);
    if (wen && !wen.alive) return '文王亡';
    return players().length ? null : '我方全滅';
  },
  goal() { return [{ x: EXIT[0], y: EXIT[1] }]; },
};
