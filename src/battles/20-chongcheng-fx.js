// 崇城地下牢 (battle 20): presentation. The gaol's own floor and its lower floor are remade from their plans, the stair hall
// where 黃飛虎 is chained as 崇侯虎's court (src/remake/prison.js; maps 0f5b14 and 0f5b58 are scene 41's too).
import { gaolMain, gaolLower, gaolHall } from '../remake/prison.js';
import { byRoom } from '../remake/rooms.js';

export default { look: { set: byRoom([gaolMain, gaolLower, gaolHall]) }, sprites: ['1231e2'] };   // (1231e2: 黃飛虎 chained up, room 2)
