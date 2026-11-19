// 聖靈山 (battle 12): presentation. The first room plays on the remade mountain (src/remake/mountain.js, map 0f0fdc, the
// set of scene 25), the other two in the remade shrine (src/remake/shrine.js: the walkway, then the 守護靈's hall, map
// 0f1018).
import { holyMount } from '../remake/mountain.js';
import shrine from '../remake/shrine.js';
import { byRoom } from '../remake/rooms.js';

export default {
  look: { set: byRoom([holyMount, shrine]) },
  moveLite: 0.7,   // the white move squares (a flier's, over the shrine's black void) stronger than the 0.4 elsewhere: at 0.4 they read as grey slabs [the user's call]
};
