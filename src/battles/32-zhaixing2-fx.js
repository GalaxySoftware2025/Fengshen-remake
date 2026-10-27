// 摘星樓 (battle 32): presentation. The battle plays in the demon's lair, the drowned sanctum under the tower
// (src/remake/lair.js), as scene 63 ends.
// The hook's beats (32-zhaixing2.js): 紂王 rising again (the camera on him, the screen pulsing [0x0FDD58: 66 frames]),
// and the seal [0x0FDE34]: eight white flashes as the two say the incantation's last words, the body burning away
// (the hook's other block grid), the haze, the sound 0x805E, then every enemy falls.
import { lair } from '../remake/lair.js';
import { sfx } from '../audio.js';

export default {
  look: { set: lair },
  async rise(E, l) {
    const { cam, wait, anim, actorOf, vfx, placeActor } = E, u = l.unit, a = actorOf(u); if (!a) return;
    placeActor(a); a.dissolve = 0; a.fade = 0; cam.release(); cam.focus(a.pos); await wait(250);
    const P = a.pos.clone();
    vfx.light(P.clone().setY(P.y + 0.8), [0.8, 0.3, 1], 4, 1.1, 6);
    await anim(1.1, k => { a.fade = Math.min(1, k * 1.6); vfx.flash([0.35, 0.1, 0.45], 0.22 * Math.max(0, Math.sin(k * Math.PI * 3))); a.flash = 0.5 * Math.max(0, Math.sin(k * Math.PI * 6)); });
    a.fade = 1; a.flash = 0;
  },
  async seal(E, l) {
    const { cam, wait, anim, actorOf, killAnim, tileCenter, vfx } = E;
    const P = tileCenter(11, 3); cam.release(); cam.focus(P);
    for (let i = 0; i < 8; i++) { vfx.flash([1, 1, 1], 0.55); await wait(110); }   // [0x21820 eight times]
    vfx.light(P.clone().setY(P.y + 1.2), [1, 0.95, 0.8], 6, 1.6, 10);
    await anim(1.6, k => lair.seal(k));   // [the grid 0x100504: the body gone]
    lair.seal(1); sfx(0x805e).catch(() => {});
    vfx.shake(0.05, 0.6);
    for (const u of l.routed) { const a = actorOf(u); if (!a) continue; cam.release(); cam.focus(a.pos); await wait(260); await killAnim(u); }   // [0x1DA7C]
  },
};
