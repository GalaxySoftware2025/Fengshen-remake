// 紫陽觀 (battle 9): presentation. The battle plays on the remade temple hill (src/remake/ziyang.js, map 0ecf2e), the
// set of scenes 16 and 17 around it. 哪吒 comes in when the rules' beat 0 fires: the camera goes to where he appears and he
// fades in (the ROM loads his sprite there and shows him with the camera on him, 0x0EC8E2), then his words with 龍太子.
import ziyang from '../remake/ziyang.js';
import { spriteKey } from '../sprites.js';

export default {
  look: { set: ziyang },
  sprites: [spriteKey(globalThis.COMMON.heroes[4].gfx)],
};
