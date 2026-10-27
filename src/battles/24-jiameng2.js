// 佳夢關 (battle 24): the rules unique to it, from its ROM hooks (header 0x0F8E02: turn hook 0x0F8BAC, lose 0x0F8D06, win
// 0x0F8D4C; research/battles/24-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 24-jiameng2-fx.js. 林雲 and 土行孫 (forced; 燕蓉 and 姬發 away, up to six) wait in 佳夢關's hall for the 魔家四將 coming
// home from 青龍關. [records ff02aa + 64 * slot: +0E class, +1A first spell; flag ff32c5 bits 0-1; round ff32c4]
//   first turn  the four in slots 10-13 (魯雄's records) become the 魔家四將, each with a spell of his own: 魔禮青 (57)
//               五雷咒, 魔禮海 (58) 三昧真火, 魔禮紅 (59) 裂冰術, 魔禮壽 (60) 真元歸天                              [0x0F8BBC]
//   round 3     once: 小龍女, out of her mind, comes in on the heroes' side in slot 9 at the first free cell round (6, 12)
//               (table 0x11266, 25 cells), her record (0xD002E) as the hook rewrites it: Lv 20, 48 / 45 / 30, 50 HP,
//               70 MP, AI 10, so the player turn hands her to 0x1DC00 (src/enemyai.js berserk: she strikes whoever is
//               nearest, either side); then the words (0x0F8B98: 小龍女, 魔禮青, 土行孫)                          [0x0F8C06]
// Win [0x0F8D4C]: all four gone (classes 57-60). Lose [0x0F8D06]: 土行孫 (class 9) gone.
import { G, players, makeUnit, inMap, cost, unitAt } from '../rules.js';
import { sayList } from '../says.js';
import { hero } from '../party.js';

export const FOUR = [[10, 57, 31], [11, 58, 23], [12, 59, 27], [13, 60, 49]];   // slot, class, spell [0x0F8BC2..0x0F8BEC]
export const AROUND = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0],
  [-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2], [0, -3], [0, 3], [-3, 0], [3, 0]];   // [table 0x11266]
export const ARRIVE_ROUND = 3, ARRIVE_AT = [6, 12], LONG = 10, TU = 9;
export const WORDS = sayList(0x0F8B98);
export const CASTERS = [57, 58, 59, 60];   // (test/casts.mjs: each needs a casting animation of his own)
const slot = n => G.units.find(u => u.slot === n && u.side === 'enemy');
const speaker = who => G.units.find(u => u.alive && u.name === who) || null;

// 小龍女 as the hook writes her record [0x0F8C9E..0x0F8CDA: her template 0xD002E, then +22.. and +33]
export function longNu() {
  const C = globalThis.COMMON, t = hero(C, LONG, 50);
  return Object.assign(t, { lv: 20, atk: 48, df: 45, spd: 30, hp: 50, mhp: 50, mp: 70, mmp: 70, ai: 10, aggro: 0xff, aip: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff] });
}

export default {
  n: 24,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (!(G.beats & 1)) {
      G.beats |= 1;
      for (const [s, cid, sp] of FOUR) { const u = slot(s); if (!u) continue; u.cid = cid; u.name = globalThis.COMMON.names[cid]; u.spells = [sp].concat(u.spells.slice(1)); }
    }
    if (G.round === ARRIVE_ROUND && !(G.beats & 2)) {
      G.beats |= 2;
      const at = AROUND.map(([dx, dy]) => [ARRIVE_AT[0] + dx, ARRIVE_AT[1] + dy]).find(([x, y]) => inMap(x, y) && !unitAt(x, y) && cost({ moveType: 0 }, x, y) < 127);
      if (!at) return null;
      const u = makeUnit(longNu(), 'player', { slot: 9, guest: true, facing: 'down' }); [u.x, u.y] = at;
      G.units.push(u); G.joined.push(u);
      return WORDS.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
    }
    return null;
  },
  victory(G) { return FOUR.every(([, cid]) => G.units.some(u => u.cid === cid && u.side === 'enemy') && !G.units.some(u => u.cid === cid && u.side === 'enemy' && u.alive)); },
  defeat(G) {
    const t = G.units.find(u => u.side === 'player' && u.cid === TU); if (t && !t.alive) return '土行孫亡';
    return players().length ? null : '我方全滅';
  },
};
