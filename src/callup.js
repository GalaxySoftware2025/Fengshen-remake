// An enemy summoner calls up another (AI 0x82: battle 11's 召喚師 and 鬼靈, 14's 召喚師, 17's 馴犬師): the original's
// cut [ROM 0x3522E, after 0x0EFD06 has put the newcomer on its cell], run in the harness: a blue-white spirit orb with
// a short trail loops about the field (frames 44-158), drops onto the newcomer's cell, a cloud of dust puffs out
// sideways there (162-230) with the call's one sound (0x807F at frame 201), and the newcomer flickers into view
// (218-230); 236 frames, 3.9 s, in all. Remade on the same timing: the orb rises off the summoner, loops round it and the
// cell, drops on the cell; the dust, the sound, the flicker. (tools/qa/callup.js)
import * as THREE from 'three';
import { sfx } from './audio.js';

let glowTex = null;
function glow() {   // a soft round glow, white at the heart
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(200,228,255,0.75)'); r.addColorStop(1, 'rgba(70,140,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (glowTex = new THREE.CanvasTexture(c));
}
const rand = (a, b) => a + Math.random() * (b - a);
const ease = k => k * k * (3 - 2 * k);
const FLY = 1.95, DROP = 0.35, DUST = 1.15, SOUND = 0.65, FLICKER = [0.9, 1.15];   // seconds (frames 44-158 / 158-162 / 162-230 / 201 / 218-230 at 60 Hz)

// E: { actorOf, world, vfx, cam, anim }; v the newcomer (already on its cell, hidden), by its summoner
export async function callUp(E, v, by) {
  const a = E.actorOf(v), b = by && E.actorOf(by), vfx = E.vfx; if (!a) return;
  a.fade = 0;
  const to = a.chest(), from = b ? b.chest() : to.clone().add(new THREE.Vector3(0, 1.6, 0)), mid = from.clone().lerp(to, 0.5);
  E.cam.release(); E.cam.focus(mid.clone().setY(a.pos.y));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.85, 2.1), toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: new THREE.Color(0.75, 1.1, 1.9), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(0.85); core.add(halo); core.name = 'callup-orb'; core.renderOrder = 7;
  E.world.scene.add(core);
  // its light the pool's, moved with it (a PointLight of its own made three.js build every lit material's program again: a
  // 0.36 s stall as the orb rose [the user's report, 2026-11-20])
  const light = vfx.holdLight(), lit = [0.52, 0.74, 1], shine = () => light.set(core.position, lit, 4, 4);
  const trail = vfx.ribbon({ col: [0.45, 0.72, 1], width: 0.07, n: 72, fade: 0.3 });   // (points along the path between frames: a frame's step drawn as one chord showed corners)
  // the loops: off the summoner, two and a half turns round the pair at a swelling then closing radius, bobbing
  const span = Math.max(1.2, from.distanceTo(to)), loop = k => {
    const th = k * Math.PI * 5 - Math.PI / 2, r = (0.5 + span * 0.55) * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.25;
    return new THREE.Vector3(mid.x + Math.cos(th) * r, mid.y + 0.9 + Math.sin(k * Math.PI * 3) * 0.3, mid.z + Math.sin(th) * r * 0.75);
  };
  const place = (p, path, k0, k1) => { for (let i = 1; i <= 3; i++) trail.push(path(k0 + (k1 - k0) * i / 4)); core.position.copy(p); shine(); trail.push(p); if (Math.random() < 0.55) vfx.spark(p.x, p.y, p.z, { vx: rand(-0.2, 0.2), vy: rand(0.05, 0.3), vz: rand(-0.2, 0.2), life: 0.45, size: 0.035, r: 0.7, gg: 0.88, b: 1, shape: 5, flicker: 1, ph: rand(0, 9) }); };
  const flight = k => { const p = loop(k); if (k < 0.12) p.lerp(from, 1 - k / 0.12); return p; };
  let k0 = 0; await E.anim(FLY, k => { place(flight(k), flight, k0, k); k0 = k; halo.material.rotation = k * 6; });
  const top = core.position.clone(), drop = k => top.clone().lerp(to, ease(k));
  k0 = 0; await E.anim(DROP, k => { place(drop(k), drop, k0, k); k0 = k; });
  light.release(); E.world.scene.remove(core); core.geometry.dispose(); core.material.dispose(); halo.material.dispose(); trail.end();
  // the landing: dust puffing out sideways round the cell, a flash of the orb's light; the sound; the newcomer flickers in
  const P = a.pos.clone(); vfx.light(to, [0.6, 0.8, 1], 6, 0.35, 4);
  vfx.burst(to, { shape: 5, n: 18, speed: 1.6, cols: [[0.7, 0.85, 1], [1, 1, 1]], size: 0.04, life: 0.5, up: 0.4 });
  let heard = false, puffs = 0;
  await E.anim(DUST, (k, dt) => {
    const t = k * DUST;
    while (puffs < Math.min(26, Math.floor(t / 0.035))) { puffs++; const s = Math.random() < 0.5 ? -1 : 1, sp = rand(0.7, 1.5);
      vfx.smokePuff(P.x + s * rand(0, 0.25), P.y + rand(0.05, 0.45), P.z + rand(-0.2, 0.25), { vx: s * sp, vz: rand(-0.25, 0.25), vy: rand(0.05, 0.3), drag: 2.2, life: rand(0.7, 1.0), size: 0.2, size1: 0.55, tint: [0.78, 0.7, 0.56] }); }
    if (!heard && t >= SOUND) { heard = true; sfx(0x807f); }
    a.fade = t < FLICKER[0] ? 0 : t < FLICKER[1] ? (Math.floor(t * 30) % 2 ? 1 : 0.15) : 1;
  });
  if (!heard) sfx(0x807f);
  a.fade = 1;
}
