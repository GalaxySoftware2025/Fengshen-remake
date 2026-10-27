// 崇城地下牢 (battle 20): the rules unique to it, from its ROM hooks (header 0x0F5DAC: turn hook 0x0F5BD4, lose 0x0F5CEA,
// win 0x0F5D14; research/battles/20-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 20-chongcheng-fx.js. 黃天化 (forced; 黃飛虎 held here, 姬發 away, up to six) goes down into 崇侯虎's gaol for his father:
// the gaol's own map, then two rooms (data/battles/20.js rooms, the table at 0x0F5D56: both first entries are the lower
// floor, so the battle starts on its own map, src/rules.js loadBattle), the turn hook picking the room's handler by its
// number (ff0f4f, table 0x0F5B9C), each letting a hero on an exit take the party on (0x1D52A). [flag ff32c5 bit 0]
//   room 1       in a round that is a multiple of four (ff32c4 % 4), the fallen of move type 7 (the 鬼靈) come back at
//                their posts (0x1DAFC(7))                                                               [0x0F5C0E]
//   room 2       before its first turn, once: 黃飛虎 is chained up by the dais (a unit record built in slot 27, ff096a:
//                records ff02aa + 64 * slot, the first after the room's seventeen; class 3, move type 9, (7, 2), 1 HP,
//                AI 7 and aggro 0, the one-pose graphic the long at 0x1003BC points to + 0x40), then words: 黃飛虎,
//                崇侯虎 and 崇應彪 (0x0F5BA8, each on its speaker); then as room 1                          [0x0F5C42]
// Win [0x0F5D14]: 崇侯虎 (class 46) and 崇應彪 (class 47) both gone. Lose [0x0F5CEA]: 黃天化 (class 8) gone.
import { G, players, revive, makeUnit } from '../rules.js';
import { sayList } from '../says.js';

export const HALL = 2, CID = { hua: 8, hu: 46, biao: 47 };
export const LINES = sayList(0x0F5BA8);
// [ROM 0x0F5C52: the record the hook writes; the HP, MP and AI as written, the rest as his own (so the HUD reads right)]
export const FEIHU = { cid: 3, name: '黃飛虎', sprite: '1231e2', gfx: 0x1231e2, anim: 0x3891a, moveType: 9, move: 0, x: 7, y: 2, slot: 27,
  hp: 1, mhp: 1, mp: 1, mmp: 1, ai: 7, aggro: 0, lv: 1, atk: 0, df: 0, spd: 0, items: [], spells: [], side: 'npc', chained: true };
const speaker = who => G.units.find(u => u.alive && u.name === who) || null;
const gone = cid => G.units.some(u => u.cid === cid && u.side === 'enemy') && !G.units.some(u => u.cid === cid && u.side === 'enemy' && u.alive);

export default {
  n: 20,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (G.room >= 1 && G.round % 4 === 0) { const back = revive(7); if (back.length) G.joined.push(...back); }
    if (G.room !== HALL || G.beats & 1) return null;
    G.beats |= 1;
    const f = makeUnit(FEIHU, 'npc', { x: FEIHU.x, y: FEIHU.y, slot: FEIHU.slot, facing: 'down', chained: true }); G.units.push(f); G.joined.push(f);
    return LINES.map(l => ({ who: l.who, text: l.text, unit: speaker(l.who) }));
  },
  victory(G) { return gone(CID.hu) && gone(CID.biao); },
  defeat(G) {
    const h = G.units.find(u => u.side === 'player' && u.cid === CID.hua); if (h && !h.alive) return '黃天化亡';
    return players().length ? null : '我方全滅';
  },
};
