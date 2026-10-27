// 佳夢關 (battle 23): the rules unique to it, from its ROM hooks (header 0x0F8328: turn hook 0x0F8004, frame hook 0x0F7FA4,
// no win or lose hook; research/battles/23-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 23-jiameng-fx.js. 林雲 and 黃飛虎 (forced; 燕蓉 and 姬發 away, up to six) cross the long bridge to 佳夢關 while the 魔家四將
// are away at 青龍關, and 魯雄 holds the gate. [flag ff32c5 bit 0, the row ff0fca]
//   first turn  the row to fall is set to 26, the bridge's south end                                          [0x0F8014]
//   every turn  in a round that is a multiple of three (ff32c4 % 3), the fallen of move type 7 come back (0x1DAFC(7);
//               battle 23 has none)                                                                       [0x0F8024]
//               while the row is past 8, on a round's first turn (ff0e67 clear: battle 13's fire, the same test, runs once
//               a round), that row of the bridge (cells 10-13) breaks: whoever stands there falls, but those of move
//               types 3 and 7 (the fliers), the row's cells turn to blocked (terrain 2), and the next row north is the one
//               to fall                                                                                   [0x0F813A]
// Win [0x0F806E]: 魯雄 (class 56) gone: the rout (0x1DA7C), then the first hero standing says the line the hook builds in
// RAM (0x0F80C0: speaker 12's first). Lose [0x0F805A]: no hero left.
import { G, players } from '../rules.js';
import { sayList } from '../says.js';

export const ROW0 = 26, ROW_END = 8, SPAN = [10, 11, 12, 13], LUXIONG = 56;
export const LINE = sayList(0x0F80C0);

// the row breaks [0x0F813A]: its cells blocked, those on it fall (the fliers stay up); returns them
export function breakRow(y) {
  for (const x of SPAN) if (G.terrain[y]) G.terrain[y][x] = 2;
  const victims = G.units.filter(u => u.alive && !u.away && u.y === y && SPAN.includes(u.x) && u.moveType !== 3 && u.moveType !== 7);
  for (const u of victims) u.alive = false;
  return victims;
}

export default {
  n: 23,
  setup(G) { G.row = ROW0; },
  roundStart(G) {
    if (G.row <= ROW_END) return null;
    const row = G.row, victims = breakRow(row); G.row--;
    return { row, victims };
  },
  victory(G) {
    const lu = G.units.filter(u => u.cid === LUXIONG && u.side === 'enemy');
    if (!lu.length || lu.some(u => u.alive)) return false;
    const h = G.units.find(u => u.side === 'player' && u.alive && u.slot != null && u.slot < 10);
    return { rout: true, after: h ? LINE.map(l => ({ who: h.name, text: l.text, unit: h })) : [] };
  },
  defeat() { return players().length ? null : '我方全滅'; },
  hud: G => G.row > ROW_END ? { label: '橋', fill: Math.round((ROW0 - G.row) / (ROW0 - ROW_END) * 100), text: '下一段　第 ' + (G.row - ROW_END) + ' 段' } : null,
};
