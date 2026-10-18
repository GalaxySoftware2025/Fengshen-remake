// 桃花林 (battle 18): presentation. The forest plays on the remade peach meadow (src/remake/mountain.js, map 0f488a), the
// 守護靈's hall in the remade golden temple (src/remake/taohua.js, map 0f48ca): scene 36's sets.
import { peachForest } from '../remake/mountain.js';
import { peachShrine } from '../remake/taohua.js';
import { byRoom } from '../remake/rooms.js';

export default { look: { set: byRoom([peachForest, peachShrine]) } };
