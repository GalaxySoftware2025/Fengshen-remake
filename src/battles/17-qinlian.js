// 沁蓮園 (battle 17): the rules unique to it, from its ROM hooks (header 0x0F3DDA: turn hook 0x0F3C40, lose 0x0F3D02, win
// 0x0F3D48, a frame hook 0x0F3BD8 that swaps two of the water's colours every 9 frames; research/battles/17-hooks.txt).
// Pure rules, shared with the headless sim; the presentation is 17-qinlian-fx.js. 林雲, 燕蓉 and 姜子牙 (forced; 黃飛虎
// gone ahead, up to seven, deploy at the garden's south) search 聞太師's treasure garden for 黃飛虎: eight rooms of lotus
// ponds (data/battles/17.js rooms, the table at 0x0F3DBA), the turn hook picking the room's handler by its number (ff0f4f,
// table 0x0F3C20), each letting a hero on an exit take the party on or back (0x1D52A). [flag ff32c5 bit 0]
//   first turn  the battle is in room 2, the entrance garden (its own map): back lies room 1, then the treasure hall
//               (room 0); on, rooms 3-7                                                                 [0x0F3C50]
//   room 1      before every unit's turn its fallen 魅影 (move type 6) come back at their posts (0x1DAFC(6)) [0x0F3C96]
// Win [0x0F3D48]: in room 0, once the chest at (11, 3) (its fifth: ff3232 + 0x12, the opened mark) is opened, a line
// built in RAM (speaker 40's: the note 黃飛虎 left in it; data/says.js 0f3d96) and the rout (0x1DA7C). Lose [0x0F3D02]:
// 林雲 (class 0) or 姜子牙 (class 7) gone.
import { G, players, revive } from '../rules.js';
import { sayList } from '../says.js';

export const START = 2, HALL = 0, NOTE_AT = [11, 3];
export const NOTE = sayList(0x0F3D96);

export default {
  n: 17, startRoom: START,
  setup(G) { G.beats = 1; G.joined = []; },
  beforeTurn(G) {
    if (G.room === 1) { const back = revive(6); if (back.length) G.joined.push(...back); }
    return null;
  },
  victory(G) {
    const ch = G.room === HALL && (G.chests || []).find(c => c.x === NOTE_AT[0] && c.y === NOTE_AT[1]);
    return ch && ch.open ? { lines: NOTE.map(l => ({ who: l.who, text: l.text, at: NOTE_AT })), rout: true } : false;
  },
  defeat(G) {
    for (const [cid, why] of [[0, '林雲亡'], [7, '姜子牙亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
