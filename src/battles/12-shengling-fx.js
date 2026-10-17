// 聖靈山 (battle 12): presentation. The first room plays on the remade mountain (src/remake/mountain.js, map 0f0fdc, the
// set of scene 25), the other two in the remade shrine (src/remake/shrine.js: the walkway, then the 守護靈's hall, map
// 0f1018).
import { holyMount } from '../remake/mountain.js';
import shrine from '../remake/shrine.js';
import { byRoom } from '../remake/rooms.js';

export default { look: { set: byRoom([holyMount, shrine]) } };
