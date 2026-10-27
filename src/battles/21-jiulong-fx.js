// 北海九龍島 (battle 21): presentation. The island and its shrine, remade (src/remake/jiulong.js; maps 0f6860 and 0f687c
// are scene 42's too).
import { isle, isleShrine } from '../remake/jiulong.js';
import { byRoom } from '../remake/rooms.js';

export default { look: { set: byRoom([isle, isleShrine]) } };
