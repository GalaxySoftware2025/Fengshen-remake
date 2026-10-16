// 地下練功所 (battle 11): the rules unique to it, from its ROM hooks (header 0x0EF226: turn hook 0x0EEF66, lose
// 0x0EF1F0; research/battles/11-hooks.txt). Pure rules, shared with the headless sim; the presentation is
// 11-lianggong-fx.js. 林雲 and 姬發 (both forced; up to six, deploy at the hall's south-west) go down through 西岐's
// underground training hall for the 龍吟劍: ten rooms (data/battles/11.js rooms, the table at 0x0EF286), the turn hook
// picking the room's handler by its number (ff0f4f, table 0x0EEF3E), each first letting a hero on an exit take the
// party on or back (0x1D52A: src/rules.js roomExit / enterRoom). 金銅人 and 鐵弓手 wait in the first rooms, then 召喚師
// who call up 鬼靈 (AI 0x82: src/rules.js summoner), 妖獸 and 異鳥. Beyond the exits [flags ff32c5 bits 0-1]:
//   room 0  before the first turn, once: 姬發 and 林雲 have words (the say-list 0x0EF052, no unit: actor 255)
//           [0x0EEF90; it also calls 0x1DAFC(6) every turn, which brings back fallen units of move type 6 at their
//           post: no unit in the room moves so (theirs are 0 and 1), so nothing comes of it]
//   room 9  on entering, once: 姬發 has words (0x0EF060); once no enemy is left (ff0a2b, the room's count), his last
//           words (0x0EF06E) and the battle is won                                                    [0x0EF108]
// Lose [0x0EF1F0]: 姬發 (class 5) gone.
import { G, players } from '../rules.js';
import { sayList } from '../says.js';

export const LAST = 9;   // the room of the three chests
export const START = sayList(0x0EF052), HALL = sayList(0x0EF060), END = sayList(0x0EF06E);
const voice = l => ({ who: l.who, text: l.text, unit: players().find(u => u.name === l.who) || null });   // (no actor: the camera on the speaker if he is here [design])

export default {
  n: 11,
  setup(G) { G.beats = 0; },
  beforeTurn(G) {
    if (G.room === 0 && !(G.beats & 1)) { G.beats |= 1; return START.map(voice); }
    if (G.room === LAST && !(G.beats & 2)) { G.beats |= 2; return HALL.map(voice); }
    return null;
  },
  victory(G) { return G.room === LAST && !G.units.some(u => u.alive && u.side === 'enemy'); },
  defeat(G) { const ji = G.units.find(u => u.side === 'player' && u.cid === 5); if (ji && !ji.alive) return '姬發亡'; return players().length ? null : '我方全滅'; },
};
