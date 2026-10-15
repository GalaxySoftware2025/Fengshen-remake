// 朝歌城門內 (battle 7): presentation. The battle plays on the remade court inside 朝歌's north gate (src/remake/citygate.js,
// map 0ebdd4), the set of scene 13 before it. 文王 walks with the heroes; the men each beat brings come in one by one,
// the camera on each (the ROM: the camera to the cell, 10 frames, the unit drawn in), then the guard's words.
import citygate from '../remake/citygate.js';
import { GUEST, RECRUIT } from './07-chaoge.js';

export default {
  look: { set: citygate },
  sprites: [GUEST.sprite, RECRUIT.sprite],
};
