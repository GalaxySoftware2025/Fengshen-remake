// 佳夢關 (battle 23): presentation. The battle plays on the remade pass of scenes 47 and 50 (src/remake/jiameng.js), its
// bridge breaking a row a round from the south (the rules: 23-jiameng.js).
import { jiamengBridge, breakRow } from '../remake/jiameng.js';
import { sfx } from '../audio.js';

// a row of the bridge breaks: the camera pans to it (the player's zoom kept), the logs split and fall into the water
// over the original's 80 frames (twenty steps of four), its crash (0x80A0) half way; whoever stood there goes down with
// it into the water
async function rowFalls(E, row, victims) {
  const { cam, wait, anim, tileCenter, actorOf, vfx, V } = E;
  cam.shot(tileCenter(11.5, row), {}); await wait(450);
  vfx.shake(0.05, 0.4);
  let crashed = false;
  const acts = victims.map(u => actorOf(u)).filter(Boolean);
  await anim(80 / 60, k => {
    breakRow(row, k);
    if (!crashed && k >= 0.5) { crashed = true; sfx(0x80a0); for (let x = 10; x < 14; x++) vfx.burst(tileCenter(x, row).add(V(0, -0.9, 0)), { n: 12, speed: 2.2, cols: [[0.85, 0.93, 1], [0.5, 0.7, 0.95]], size: 0.05, life: 0.6, g: 5, up: 1.4, shape: 1 }); }
    for (const a of acts) { const t = Math.max(0, (k - 0.6) / 0.4); a.lift = -t * t * 1.6; a.fade = 1 - t; }
  });
  for (const a of acts) { a.root.visible = false; a.lift = 0; a.fade = 1; }
  await wait(250); cam.release();
}

export default {
  look: { set: jiamengBridge },
  roundStart: (E, ev) => ev && ev.row != null ? rowFalls(E, ev.row, ev.victims || []) : null,
};
