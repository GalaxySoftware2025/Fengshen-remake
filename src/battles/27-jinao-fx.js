// 東海金螯島 (battle 27): presentation. Each of the thirteen rooms of the 誅仙陣 plays on the formation's set built from
// its own art (src/remake/zhuxian.js): room 0 is scene 57's 0fa6f4, room 12 its 0fa70c. The beats of the hook
// (27-jinao.js): a gate's way on (the rout, the camera on the first hero, the stairs coming up under him, 40 frames
// [0x0FA9C6]), and 通天教主 back in his true shape between his words [0x0FA914: 48 frames of the screen pulsing, the
// phoenix's graphic, 32 more, 20 frames' pause].
import { zhuxianRooms, addStair } from '../remake/zhuxian.js';
import { byRoom } from '../remake/rooms.js';
import { PHOENIX } from './27-jinao.js';

export default {
  look: { set: byRoom(zhuxianRooms) },
  sprites: [PHOENIX],
  async wayOn(E, l) {
    const { cam, wait, anim, actorOf, killAnim, tileCenter, vfx } = E;
    for (const u of l.routed) { const a = actorOf(u); if (!a) continue; cam.release(); cam.focus(a.pos); await wait(300); await killAnim(u); }   // [0x1DA7C]
    const P = tileCenter(...l.at); cam.release(); cam.focus(P); await wait(250);
    const g = addStair(...l.at);
    if (g) {
      vfx.light(P.clone().setY(P.y + 0.6), [0.6, 0.85, 1], 3, 0.9, 4);
      vfx.burst(P.clone().setY(P.y + 0.1), { n: 22, speed: 1.2, cols: [[0.7, 0.9, 1], [0.4, 0.75, 1]], size: 0.05, life: 0.7, g: -0.6, shape: 0, up: 1.2 });
      g.scale.y = 0.01; await anim(0.4, k => { g.scale.y = Math.max(0.01, 1 - (1 - k) * (1 - k)); }); g.scale.y = 1;   // (the well opens, its steps going down)
    }
    await wait(670);   // (40 frames)
  },
  async trueShape(E, l) {
    const { cam, wait, anim, actorOf, vfx, reskin } = E, u = l.unit; if (!u) return;
    const a = actorOf(u); if (!a) return;
    cam.release(); cam.focus(a.pos);
    const P = a.pos.clone();
    // the screen pulses as he gives up his man's shape (the original steps the colours 48 frames)
    vfx.light(P.clone().setY(P.y + 0.8), [1, 0.55, 0.2], 4, 1.6, 5);
    await anim(0.8, k => { a.flash = 0.5 + 0.5 * Math.sin(k * Math.PI * 8); vfx.flash([1, 0.75, 0.45], 0.25 * Math.max(0, Math.sin(k * Math.PI * 4))); });
    a.flash = 0;
    vfx.explode(P.clone().setY(P.y + 0.5), 0.6, { smoke: false });
    const b = await reskin(u, PHOENIX);
    for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; vfx.flame(P.x + Math.cos(t) * 0.35, P.y + 0.1, P.z + Math.sin(t) * 0.35, { vy: 1.2, life: 0.7, size: 0.35 }); }
    b.fade = 0; await anim(0.53, k => { b.fade = k; }); b.fade = 1;   // (32 frames)
    await wait(330);   // (20 frames)
  },
};
