// 麒麟山 (battle 15): presentation. The first room plays on the remade snowy mountain (src/remake/mountain.js, map
// 0f2d64), the second in the 麒麟獸's cave (src/remake/icecave.js, map 0f2db4): scene 30's sets. The waves' sprites are
// loaded with the battle.
import { qilinMount } from '../remake/mountain.js';
import iceCave from '../remake/icecave.js';
import { byRoom } from '../remake/rooms.js';
import { WAVE_SPRITES } from './15-qilin.js';

export default { look: { set: byRoom([qilinMount, iceCave]) }, sprites: WAVE_SPRITES };
