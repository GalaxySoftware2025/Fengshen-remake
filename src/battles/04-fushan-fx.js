// 傅山山谷三 (battle 4): presentation. The battle plays on the remade canyon (src/remake/canyon.js), the set of scene 5
// before it. 楊戩 comes in mid-battle (the rules' beat 3): the camera goes to (15, 6) and he lands there in a gust of
// pale light [design; the original loads his sprite and shows him with the camera on him, ROM 0x0EA0B6].
import canyon from '../remake/canyon.js';
import { sfx } from '../audio.js';

export default {
  look: { set: canyon },
  sprites: ['p2'],
  async join(E, u) {
    const a = E.actorOf(u), p = a.pos.clone();
    sfx(0x804e);   // [design, the user's request: the ROM plays none here] the original's own sting for a summoned beast's arrival (四不像, 哮天犬's landing)
    E.vfx.decal(p, [0.6, 0.85, 1], 0.9, 1.4); E.vfx.ring(p, [0.7, 0.9, 1], 1.4, 0.7);
    E.vfx.burst(p, { n: 36, speed: 3, cols: [[0.8, 0.95, 1], [1, 1, 1], [0.6, 0.8, 1]], size: 0.06, life: 0.8, g: 2, up: 0.6 });
    for (let k = 1; k <= 24; k++) { a.fade = k / 24; await E.wait(25); }
  },
};
