// Casting animations: every caster gathers a spell their own way, with their own ROM frames (attack, guard, cast poses,
// the four facings) and what their story gives them, instead of one shared magic circle. Each faces us throughout
// (spellkit.js intro turns them first; the user's call). Simple but striking: one
// gesture and one signature effect (the user's call: no strings of poses), readable at play distance (the battle camera
// keeps the player's zoom), with no glow discs or rings on the ground (pale bubbles on sand). About a second each, played
// by spellkit.js intro before the spell itself; keyed by character id (cid); test/casts.mjs fails for any caster in the
// game without one (it would get the old shared gathering: the cast pose and a rune circle). New to the remake: the
// original only holds its cast pose.
import * as THREE from 'three';
import { rand, effectH } from './world.js';
import { vfx, anim, wait, V } from './battle.js';
import { swordMesh, pointAlong } from './spellkit.js';
import { axes, face, canvasTex, once, eyeTex, fireWheel, leiFlapFrames } from './levelup.js';

// ---------------------------------------------------------------- poses and shared beats
const pose = {
  atk: (a, f) => { a.act = { kind: 'atk', frame: f }; },        // the attack: 0 wind-up, 1 the blow, 2 follow-through (with the weapon)
  cast: (a, f) => { a.act = { kind: 'pose', row: 2, base: 6, fixed: f }; },
  guard: a => { a.act = { kind: 'pose', row: 2, base: 3 }; },
  hurt: a => { a.act = { kind: 'pose', row: 2, base: 0 }; },
  tex: (a, t) => { a.act = { kind: 'tex', tex: t }; },
  facing: (a, t, rate) => { a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * rate) % 4]; },
};
const dust = (P, n, speed, tint = [0.5, 0.43, 0.34], size = 0.15) => { for (let i = 0; i < n; i++) { const t = i / n * 6.28 + rand(-0.2, 0.2);
  vfx.smokePuff(P.x + Math.cos(t) * 0.25, P.y + 0.06, P.z + Math.sin(t) * 0.25, { vx: Math.cos(t) * speed, vz: Math.sin(t) * speed, vy: rand(0.1, 0.4), drag: 2.4, life: rand(0.6, 0.9), size, size1: size * 2.6, tint }); } };
// a blow on the ground: dust thrown round, stones and sparks, the screen shaken
function slam(P, col, power = 1, o = {}) {
  // (no ground ring or glow disc: at play distance they read as a pale bubble on sand; the dust and stones carry the blow)
  dust(P, 8 + power * 4, 1.5 + power, o.dust || [0.5, 0.43, 0.34], 0.15);
  vfx.burst(P.clone().setY(P.y + 0.1), { n: 10 * power, speed: 2.4 * power, cols: o.chips || [[0.55, 0.45, 0.35], [0.4, 0.33, 0.26]], size: 0.05, life: 0.6, g: 6, shape: 0, up: 0.6 });
  vfx.burst(P.clone().setY(P.y + 0.15), { n: 14, speed: 3, cols: [[1, 1, 1], col], size: 0.04, life: 0.35, g: 0, shape: 0 });
  vfx.light(P.clone().setY(P.y + 0.6), col, 8 * power, 0.35, 5);
  vfx.shake(0.1 * power, 0.25);
}
// a flat picture turned to the camera (face), living only as long as its beat
const flat = (map, w, h, order = 6) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); m.renderOrder = order; return m; };
const feetOf = a => (a.big.visible ? a.big : a.mesh).position.clone();

// ---------------------------------------------------------------- the kit: one gesture, one signature effect
const during = (sec, fn) => vfx.timed(new THREE.Object3D(), sec, fn);   // an effect that runs beside the gesture
const raise = (a, f = 0) => pose.cast(a, f);                           // the cast frame held: a hand or staff raised
async function strike(a, P, col, power = 1, o) {                       // the attack's wind-up held, then the blow into the ground
  pose.atk(a, 0); await anim(0.3, k => { a.lift = Math.sin(k * Math.PI / 2) * 0.1; });
  pose.atk(a, 1); await anim(0.06, k => { a.lift = 0.1 * (1 - k); }); a.lift = 0;
  slam(P, col, power, o);
}
const rise = (a, h, sec) => anim(sec, k => { a.hover = Math.sin(k * Math.PI / 2) * h; });
const land = (a, h, sec) => anim(sec, k => { a.hover = h * (1 - k * k); }).then(() => { a.hover = 0; });
const spark = (p, col, o = {}) => vfx.spark(p.x, p.y, p.z, Object.assign({ life: 0.6, size: 0.06, r: col[0], gg: col[1], b: col[2], shape: 1 }, o));
// sparks spiralling up round him
function swirl(a, P, col, sec, o = {}) { let T = 0; return during(sec, (k, dt) => { T += dt; const n = o.rate || 40;
  for (let i = 0; i < Math.ceil(dt * n); i++) { const t = T * (o.spin || 7) + rand(0, 6.28), r = (o.r || 0.6) * (1 - k * 0.3); spark(V(P.x + Math.cos(t) * r, P.y + 0.1 + rand(0, 1.1), P.z + Math.sin(t) * r), col, { vy: rand(0.6, 1.4), vx: -Math.sin(t) * 1.2, vz: Math.cos(t) * 1.2, drag: 1.5, size: o.size || rand(0.04, 0.07), shape: o.shape ?? 1 }); } }); }
// streams of light winding up round him from his feet
function ribbons(a, P, cols, sec, o = {}) { const rs = cols.map(col => vfx.ribbon({ col, width: o.width || 0.06, n: 24, fade: 0.35 })); let T = 0;
  return during(sec, (k, dt) => { T += dt; rs.forEach((r, j) => { const th = T * (o.spin || 8) + j * 6.28 / rs.length, rr = (o.r || 0.55) * (1 - k * 0.25); r.push(V(P.x + Math.cos(th) * rr, P.y + 0.1 + k * (o.h || 1.5), P.z + Math.sin(th) * rr)); }); if (k >= 1) rs.forEach(r => r.end()); }); }
// motes drawn in to his hands
function motes(a, col, sec, o = {}) { return during(sec, (k, dt) => { const c = a.chest().add(V(0, o.y || 0.1, 0));
  for (let i = 0; i < Math.ceil(dt * (o.rate || 30)); i++) { const t = rand(0, 6.28), r = rand(0.9, 1.4); spark(V(c.x + Math.cos(t) * r, c.y + rand(-0.4, 0.8), c.z + Math.sin(t) * r), col, { seek: { x: c.x, y: c.y, z: c.z, k: 5 }, life: 0.5, size: rand(0.05, 0.08) }); } }); }
// flames kindling in a ring round his feet
function flameRing(P, r, n, sec, o = {}) { return during(sec, (k, dt) => { if (Math.random() > dt * (o.rate || 40)) return; const t = rand(0, 6.28), q = V(P.x + Math.cos(t) * r, 0, P.z + Math.sin(t) * r);
  vfx.flame(q.x, effectH(q.x, q.z) + 0.05, q.z, { size: rand(0.12, 0.2) * (o.size || 1), asp: 1.5, life: rand(0.3, 0.45), vy: 0.7 }); }); }
// smoke winding up round him (a storm, a plague, a corpse's breath)
function smoke(a, P, tint, sec, o = {}) { let T = 0; return during(sec, (k, dt) => { T += dt; if (Math.random() > dt * (o.rate || 26)) return; const t = T * 6 + rand(0, 6.28), r = o.r || 0.5;
  vfx.smokePuff(P.x + Math.cos(t) * r, P.y + 0.1, P.z + Math.sin(t) * r, { vx: -Math.sin(t) * 1.4, vz: Math.cos(t) * 1.4, vy: rand(0.6, 1.2), drag: 1.2, life: rand(0.7, 1.0), size: 0.18, size1: 0.5, tint }); }); }
// a glowing orb over his head that swells and flares
function orb(a, col, sec, o = {}) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.renderOrder = 7; return vfx.timed(m, sec, k => { m.position.copy(a.head().add(V(0, 0.4, 0))); m.scale.setScalar((o.r || 0.16) * Math.min(1, k * 2.5) * (1 + 0.1 * Math.sin(k * 40))); m.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 0.9; },
    () => { const q = a.head().add(V(0, 0.4, 0)); vfx.burst(q, { n: 22, speed: 2.6, cols: [[1, 1, 1], col], size: 0.05, life: 0.4, g: 0, shape: 1 }); vfx.light(q, col, 3, 0.3, 4); }); }
// lightning crashing down round him
function bolts(P, col, n, sec) { let fired = 0; return during(sec, k => { while (fired < n * k) { fired++; const t = rand(0, 6.28), l = rand(0.6, 1.1), q = V(P.x + Math.cos(t) * l, 0, P.z + Math.sin(t) * l); q.y = effectH(q.x, q.z);
  vfx.bolt(q.clone().add(V(rand(-0.3, 0.3), 2.2, rand(-0.3, 0.3))), q, col, 0.15, { width: 0.022, jag: 0.35 }); vfx.burst(q, { n: 6, speed: 1.5, cols: [[1, 1, 1], col], size: 0.04, life: 0.3, g: 0, shape: 0 }); } }); }

// ---------------------------------------------------------------- the casters
export const CASTS = {
  // 雷震子: his wings lift him, the storm's lightning strikes his raised golden staff, and he dives and drives it into the
  // ground: the thunder runs out along the earth
  6: async (a, P) => {
    const BOLT = [0.55, 0.7, 1], FLAP = once('leiflap', () => leiFlapFrames(a, 12));
    let F = 0; const flap = (dt, hz) => { F += dt * hz; pose.tex(a, FLAP[Math.floor(F * FLAP.length) % FLAP.length]); };
    dust(P, 8, 1.3);
    await anim(0.4, (k, dt = 1 / 60) => { a.hover = Math.sin(k * Math.PI / 2) * 0.45; flap(dt, 2.6);
      if (Math.random() < dt * 14) { const c = a.chest(), s = Math.random() < 0.5 ? -1 : 1; vfx.bolt(c.clone().add(V(s * 0.3, 0.1, 0)), c.clone().add(V(s * rand(0.4, 0.7), rand(-0.2, 0.4), rand(-0.2, 0.2))), BOLT, 0.08, { width: 0.014, jag: 0.4 }); } });
    pose.cast(a, 0);
    const top = a.head().add(V(0, 0.25, 0));
    vfx.bolt(top.clone().add(V(0, 2.6, 0)), top, BOLT, 0.25, { width: 0.06 }); vfx.light(top, BOLT, 12, 0.3, 6); vfx.flash([0.75, 0.8, 1], 0.18);
    vfx.burst(top, { n: 16, speed: 2, cols: [[1, 1, 1], BOLT], size: 0.04, life: 0.3, g: 0, shape: 0 });
    await anim(0.28, k => { a.hover = 0.45 + Math.sin(k * Math.PI) * 0.06; });
    a.u.facing = 'down'; pose.atk(a, 1);   // his own blow: the staff driven down, lightning running from it into the ground
    await anim(0.1, k => { a.hover = 0.45 * (1 - k * k); });
    a.hover = 0;
    slam(P, BOLT, 1.3, { dust: [0.55, 0.55, 0.6] });
    for (let i = 0; i < 8; i++) { const t = i / 8 * 6.28 + rand(-0.2, 0.2), l = rand(1.0, 1.6), q = P.clone().add(V(Math.cos(t) * l, 0, Math.sin(t) * l)); q.y = effectH(q.x, q.z) + 0.05;
      vfx.bolt(P.clone().setY(P.y + 0.05), q, BOLT, 0.3, { width: 0.03, jag: 0.25 }); }
    await wait(380);
  },
  // 哪吒: he holds up the taiji (his own cast frame), then his wind-fire wheels flare under his feet and lift him; he
  // hangs there in their fire and drops back in a burst of flame
  4: async (a, P) => {
    const { right, toCam } = axes(), FIRE = [1, 0.45, 0.12];
    pose.cast(a, 1); await wait(380);
    pose.cast(a, 0);
    const wheels = [-1, 1].map(s => { const w = fireWheel(); w.quaternion.setFromUnitVectors(V(0, 0, 1), right.clone().multiplyScalar(0.55).addScaledVector(toCam, 0.85).normalize()); w.side = s; vfx.timed(w, 0.95, (k, dt) => { w.spin.rotation.z -= dt * 22 * s; w.scale.setScalar(1.7 * Math.min(1, k * 6) * (k > 0.88 ? (1 - k) / 0.12 : 1)); }); return w; });
    const burn = () => { const f = feetOf(a); for (const w of wheels) { w.position.copy(f).addScaledVector(right, w.side * 0.24).addScaledVector(toCam, 0.1).add(V(0, -0.08, 0));
      const q = w.position; for (let j = 0; j < 3; j++) vfx.flame(q.x + rand(-0.2, 0.2), q.y - 0.1, q.z + rand(-0.15, 0.15), { size: rand(0.14, 0.22), asp: 1.4, life: 0.25, vy: -0.7 }); } };
    vfx.burst(P.clone().setY(P.y + 0.1), { n: 14, speed: 2, cols: [[1, 0.85, 0.4], FIRE], size: 0.05, life: 0.4, g: 1, shape: 0 });
    vfx.light(P.clone().setY(P.y + 0.4), FIRE, 8, 0.9, 5);
    await anim(0.35, k => { a.hover = Math.sin(k * Math.PI / 2) * 0.5; burn(); });
    await anim(0.35, () => burn());
    await anim(0.12, k => { a.hover = 0.5 * (1 - k * k); burn(); });
    a.hover = 0;
    for (let i = 0; i < 16; i++) { const t = i / 16 * 6.28, q = P.clone().add(V(Math.cos(t) * 0.5, 0, Math.sin(t) * 0.5)); vfx.flame(q.x, effectH(q.x, q.z) + 0.05, q.z, { size: rand(0.16, 0.22), asp: 1.5, life: rand(0.35, 0.5), vy: 0.8 }); }
    vfx.shake(0.05, 0.15);
    await wait(300);
  },
  // 楊戩: standing as he is, the eye in his brow opens: a great gold eye wakes over him, its gaze flashing out in a spray
  // of gold (no raised blade: the user's call)
  2: async (a, P) => {
    const { toCam } = axes(), GOLD = [1, 0.85, 0.45];
    a.act = null; a.u.facing = 'down';   // he turns to face us first, and keeps facing us (the user's call)
    await wait(100);
    const eye = flat(once('eye', eyeTex), 0.32, 0.64, 7), at = () => a.head().add(V(0, 0.45, 0)).addScaledVector(toCam, 0.15);
    let T = 0;
    vfx.timed(eye, 0.9, (k, dt) => { T += dt; face(eye); eye.position.copy(at()); const open = Math.min(1, T / 0.25) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      eye.scale.set(0.6 + 0.4 * open, Math.max(0.02, open), 1); });
    for (let i = 0; i < 10; i++) { const t = i / 10 * 6.28, c = at(); vfx.spark(c.x + Math.cos(t) * 0.5, c.y + Math.sin(t) * 0.5, c.z, { seek: { x: c.x, y: c.y, z: c.z, k: 6 }, life: 0.3, size: 0.06, r: 1, gg: 0.85, b: 0.45, shape: 1 }); }
    await wait(300);
    const E = at(); vfx.flash(GOLD, 0.1); vfx.light(E, GOLD, 12, 0.4, 6);
    vfx.burst(E, { n: 30, speed: 3.2, cols: [[1, 1, 0.9], GOLD], size: 0.05, life: 0.45, g: 0, shape: 1 });
    await wait(420);
  },
  // 姜子牙: he lifts his staff and the eight trigrams turn under him and rise as gold (Kunlun's bagua is his, so the
  // circle stays his)
  7: async (a, P) => {
    const GOLD = [1, 0.85, 0.45];
    pose.cast(a, 0);
    const disc = vfx.runeCircle(P, GOLD, 1.25, 1.2, { spin: 2.6, intensity: 1.5 });   // the eight trigrams round the taiji (vfx.js runeTexture)
    for (let i = 0; i < 18; i++) { const t = i / 18 * 6.28, r = 0.9; vfx.spark(P.x + Math.cos(t) * r, P.y + 0.05, P.z + Math.sin(t) * r, { vy: rand(1.2, 2.2), vx: -Math.cos(t) * 0.5, vz: -Math.sin(t) * 0.5, life: 0.7, size: 0.06, r: 1, gg: 0.85, b: 0.45, shape: 1 }); }
    vfx.pillar(P, GOLD, 0.5, 2.4, 0.8, { taper: 0.8, intensity: 0.35, grow: 1 });
    vfx.light(P.clone().setY(P.y + 0.6), GOLD, 8, 0.9, 5);
    await anim(0.9, k => { disc.position.y = effectH(P.x, P.z) + 0.04 + Math.sin(k * Math.PI * 0.5) * 0.35; });
    await wait(150);
  },
  // 大力士, Shang's strongman: lifts both fists high and pounds the earth once, stones and dust thrown up round him
  17: async (a, P) => {
    a.u.facing = 'down';   // facing us throughout (the user's call: no turn from his side to the front)
    pose.atk(a, 0); await anim(0.32, k => { a.lift = Math.sin(k * Math.PI / 2) * 0.14; });
    pose.atk(a, 1); await anim(0.06, k => { a.lift = 0.14 * (1 - k); }); a.lift = 0;
    slam(P, [1, 0.62, 0.3], 1.4, { dust: [0.5, 0.42, 0.33], chips: [[0.5, 0.4, 0.3], [0.35, 0.28, 0.2], [0.6, 0.85, 0.65]] });
    await wait(450);
  },
  // 妲己, the nine-tailed fox: her nine tails fan out behind her in fox-fire, sway once, and fold away as she flicks a hand
  53: async (a, P) => {
    const { right, toCam } = axes(), PINK = [1, 0.55, 0.8];
    pose.cast(a, 0);
    const tex = once('foxtail', () => canvasTex(64, 192, g => {
      const gr = g.createLinearGradient(0, 192, 0, 0); gr.addColorStop(0, 'rgba(255,190,150,0.95)'); gr.addColorStop(0.6, 'rgba(255,225,200,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.shadowColor = '#ff70c0'; g.shadowBlur = 12; g.fillStyle = gr;
      g.beginPath(); g.moveTo(32, 190); g.bezierCurveTo(4, 150, 2, 60, 26, 8); g.quadraticCurveTo(34, 0, 40, 10); g.bezierCurveTo(62, 60, 58, 150, 32, 190); g.fill(); }));
    const base = () => a.chest().add(V(0, -0.15, 0)).addScaledVector(toCam, -0.12);
    const tails = Array.from({ length: 9 }, (_, i) => { const m = flat(tex, 0.28, 0.84, 1); m.geometry.translate(0, 0.42, 0); vfx.timed(m, 1.05, () => {}); return { m, ang: (i - 4) / 4 * 1.25 }; });
    let T = 0;
    const put = (open, sway) => { const b = base(); for (const t of tails) { face(t.m, 1, -t.ang * open + Math.sin(T * 7 + t.ang * 2) * 0.12 * sway); t.m.position.copy(b); t.m.scale.setScalar(0.35 + 0.65 * open); t.m.material.opacity = Math.min(1, open * 1.5); } };
    await anim(0.4, (k, dt = 1 / 60) => { T += dt; put(1 - Math.pow(1 - k, 3), 1);
      if (Math.random() < dt * 30) { const t = rand(0, 6.28), c = a.chest(); vfx.spark(c.x + Math.cos(t) * 0.6, c.y + rand(-0.3, 0.4), c.z + Math.sin(t) * 0.6, { vy: rand(0.3, 0.9), life: 0.6, size: rand(0.05, 0.08), r: 1, gg: 0.5, b: 0.85, shape: 1 }); } });
    vfx.light(a.chest(), PINK, 6, 0.6, 5);
    await anim(0.4, (k, dt = 1 / 60) => { T += dt; put(1, 1); });
    pose.cast(a, 1); vfx.burst(a.chest().addScaledVector(right, 0.25), { n: 18, speed: 2, cols: [[1, 1, 1], PINK], size: 0.05, life: 0.4, g: 0, shape: 1 });
    await anim(0.25, (k, dt = 1 / 60) => { T += dt; put(1 - k, 1 - k); });
    for (const t of tails) t.m.visible = false;   // (gone with their beat)
    await wait(150);
  },
  // ---- the heroes
  // 林雲, the swordsman: his sword raised, three flying swords rise out of the ground round him point up and shoot skyward
  0: async (a, P) => {
    const COL = [0.6, 0.85, 1]; raise(a, 0);
    const sw = [0, 1, 2].map(i => { const m = swordMesh(COL, 0.55), t = i / 3 * 6.28 + 0.5; m.userData.t = t; return m; });
    let T = 0;
    for (const m of sw) vfx.timed(m, 0.95, (k, dt) => { if (m === sw[0]) T += dt; const t = m.userData.t + T * 3, up = k < 0.75 ? Math.sin(k / 0.75 * Math.PI / 2) * 0.7 : 0.7 + (k - 0.75) / 0.25 * 3.5;
      m.position.set(P.x + Math.cos(t) * 0.6, P.y - 0.2 + up, P.z + Math.sin(t) * 0.6); pointAlong(m, V(0, 1, 0)); m.rotateY(T * 4); });
    for (let i = 0; i < 10; i++) { const t = rand(0, 6.28); spark(V(P.x + Math.cos(t) * 0.6, P.y + 0.05, P.z + Math.sin(t) * 0.6), COL, { vy: rand(0.8, 1.6), life: 0.5 }); }
    await wait(950);
  },
  // 燕蓉, the healer: her hand raised, leaves of green light wind up round her on the wind
  1: async (a, P) => { raise(a, 0); ribbons(a, P, [[0.5, 1, 0.6], [1, 0.7, 0.85]], 0.9, { spin: 9, width: 0.05 }); swirl(a, P, [0.6, 1, 0.7], 0.9, { rate: 30, shape: 0 }); await wait(1000); },
  // 黃飛虎, 武成王: he draws his bow, and gold war-flame licks up round him
  3: async (a, P) => { pose.atk(a, 0); flameRing(P, 0.45, 0, 0.9, { rate: 55 }); vfx.light(P.clone().setY(P.y + 0.6), [1, 0.7, 0.3], 3, 1, 5); await wait(1000); },
  // 姬發, the coming king: his hand raised, a shaft of royal gold falls on him, feathers of light turning round it
  5: async (a, P) => { const GOLD = [1, 0.8, 0.35]; raise(a, 0); vfx.pillar(P, GOLD, 0.45, 3.2, 0.9, { taper: 1, intensity: 0.18, grow: 1 }); swirl(a, P, [1, 0.55, 0.25], 0.9, { r: 0.5, rate: 26 }); vfx.light(P.clone().setY(P.y + 1), GOLD, 4, 1, 6); await wait(1000); },
  // 黃天化: a blow of his blade, and four steel-blue blades fall from above and stab into the ground round him
  8: async (a, P) => {
    const COL = [0.55, 0.8, 1];
    pose.atk(a, 0); await wait(260); pose.atk(a, 1);
    [0, 1, 2, 3].forEach(i => { const t = i / 4 * 6.28 + 0.78, q = V(P.x + Math.cos(t) * 0.75, 0, P.z + Math.sin(t) * 0.75); q.y = effectH(q.x, q.z); const m = swordMesh(COL, 0.5);
      vfx.timed(m, 0.75, k => { const f = Math.min(1, k / 0.35); m.position.copy(q).add(V(0, 0.3 + (1 - f * f) * 2.4, 0)); pointAlong(m, V(0, -1, 0)); if (f >= 1 && !m.userData.hit) { m.userData.hit = 1; dust(q, 4, 0.8); vfx.burst(q, { n: 6, speed: 1.4, cols: [[1, 1, 1], COL], size: 0.04, life: 0.3, g: 0, shape: 0 }); } }); });
    await wait(300); vfx.shake(0.06, 0.15); await wait(450);
  },
  // 土行孫, who goes under the earth: he sinks into the ground and springs back out of it in a spray of soil
  9: async (a, P) => {
    dust(P, 8, 1); await anim(0.3, k => { a.lift = -k * k * 0.55; });
    await wait(120);
    await anim(0.18, k => { a.lift = -0.55 + k * 0.75; }); slam(P, [1, 0.75, 0.4], 1, { chips: [[0.55, 0.4, 0.25], [0.4, 0.3, 0.2]] });
    await anim(0.15, k => { a.lift = 0.2 * (1 - k); }); a.lift = 0; await wait(300);
  },
  // 小龍女, the dragon girl: her hand raised, water winds up round her like a dragon and breaks into frost
  10: async (a, P) => {
    const W = [0.45, 0.8, 1]; raise(a, 0); ribbons(a, P, [W, [0.8, 0.95, 1], W], 0.8, { spin: 9, width: 0.08, h: 1.7 });
    await wait(800); const c = a.head().add(V(0, 0.3, 0)); vfx.burst(c, { n: 30, speed: 2.4, cols: [[1, 1, 1], W], size: 0.05, life: 0.5, g: 1.5, shape: 1 }); vfx.light(c, W, 3, 0.3, 5); await wait(250);
  },
  // 燃燈道人: his hand raised, the lamp flames kindle in a ring round him
  11: async (a, P) => { raise(a, 0); flameRing(P, 0.7, 0, 0.95, { rate: 50, size: 0.8 }); vfx.light(P.clone().setY(P.y + 0.5), [1, 0.8, 0.5], 3, 1, 5); await wait(1000); },
  // ---- Shang's army
  // 綠盔士: he plants his weapon and the ground answers in bronze-green sparks
  14: async (a, P) => { await strike(a, P, [0.45, 1, 0.65], 0.9, { chips: [[0.45, 0.9, 0.6], [0.5, 0.42, 0.33]] }); await wait(450); },
  // 弓箭手: his bow raised, green motes gather to it
  15: async (a, P) => { pose.atk(a, 0); motes(a, [0.55, 1, 0.6], 0.85); await wait(1000); },
  // 鐵弓手, the iron archer: his bow raised, iron-blue motes gather to it
  25: async (a, P) => { pose.atk(a, 0); motes(a, [0.6, 0.8, 1], 0.85); await wait(1000); },
  // 戰將, Shang's general: a blow into the earth, bronze chips flying
  48: async (a, P) => { await strike(a, P, [1, 0.8, 0.4], 1.1, { chips: [[0.85, 0.65, 0.3], [0.5, 0.42, 0.33]] }); await wait(450); },
  // 魯雄 (who froze in 姜子牙's snow): a blow, and frost bursts from the ground
  56: async (a, P) => { await strike(a, P, [0.7, 0.9, 1], 1, { dust: [0.75, 0.82, 0.9], chips: [[0.85, 0.95, 1], [0.6, 0.8, 1]] }); swirl(a, P, [0.8, 0.95, 1], 0.45, { rate: 40, shape: 0 }); await wait(450); },
  // the 魔家四將 of 佳夢關 (battle 24), each by the treasure the legend gives him. 魔禮青: he lifts the 青雲劍 and a great
  // blade of green light stands over him in a black wind
  57: async (a, P) => {
    const JADE = [0.35, 1, 0.75];
    raise(a, 0); const m = swordMesh(JADE, 1.1), top = () => a.head().add(V(0, 0.15, 0));
    ribbons(a, P, [[0.1, 0.25, 0.2], [0.15, 0.3, 0.25], [0.2, 0.5, 0.4]], 0.9, { r: 0.6, h: 1.8, spin: 9, width: 0.07 });
    vfx.timed(m, 0.95, k => { const f = Math.min(1, k / 0.4); m.position.copy(top()).add(V(0, f * 0.35, 0)); pointAlong(m, V(0, 1, 0)); m.scale.setScalar(0.5 + f * 1.3); });
    await wait(450);
    const q = top().add(V(0, 2.2, 0)); vfx.light(q, JADE, 9, 0.4, 6); vfx.burst(q, { n: 24, speed: 2.6, cols: [[1, 1, 1], JADE], size: 0.05, life: 0.4, g: 0, shape: 1 });
    await wait(550);
  },
  // 魔禮海: he strikes the 碧玉琵琶, and its four strings send wind and fire running out round him
  58: async (a, P) => {
    const { right, toCam } = axes(), FIRE = [1, 0.5, 0.15];
    pose.cast(a, 1);
    const lute = flat(once('pipa', () => canvasTex(64, 128, g => {
      const gr = g.createRadialGradient(28, 86, 6, 32, 84, 34); gr.addColorStop(0, '#9fe0c0'); gr.addColorStop(1, '#2f7a5a'); g.fillStyle = gr;
      g.beginPath(); g.ellipse(32, 86, 26, 34, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2416'; g.fillRect(28, 6, 8, 56); g.fillStyle = '#c9a24a'; for (const y of [18, 28, 38, 48]) g.fillRect(26, y, 12, 3);
      g.strokeStyle = 'rgba(255,250,230,0.9)'; g.lineWidth = 1; for (const x of [29, 31, 33, 35]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 112); g.stroke(); } })), 0.28, 0.56, 7);
    vfx.timed(lute, 0.95, () => { face(lute); lute.position.copy(a.chest()).addScaledVector(toCam, 0.16).addScaledVector(right, 0.05); });
    await wait(300);
    for (let s = 0; s < 4; s++) {   // a strum: each string's note goes out as a wave of wind with embers in it
      const r = vfx.ribbon({ col: s % 2 ? [0.7, 1, 0.85] : FIRE, width: 0.05, n: 20, fade: 0.3 }), t0 = s * 1.57 + 0.4;
      during(0.6, k => { const t = t0 + k * 2.6, rr = 0.3 + k * 1.1; r.push(V(P.x + Math.cos(t) * rr, P.y + 0.5 + s * 0.12, P.z + Math.sin(t) * rr)); if (Math.random() < 0.4) spark(V(P.x + Math.cos(t) * rr, P.y + 0.5, P.z + Math.sin(t) * rr), FIRE, { vy: rand(0.4, 1), life: 0.4 }); });
      await wait(70);
    }
    vfx.light(a.chest(), FIRE, 6, 0.5, 5);
    await wait(420);
  },
  // 魔禮紅: he opens the 混元傘 over his head; it turns, darkness pours from under it, its pearls glinting at the rim
  59: async (a, P) => {
    const RED = 0xa8202a, PEARL = [1, 0.95, 0.85];
    raise(a, 0);
    const um = new THREE.Group(), silk = new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.22, 16, 1, true), silk); canopy.position.y = 0.11; um.add(canopy);
    for (let i = 0; i < 8; i++) { const t = i / 8 * 6.28, rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.66, 4), new THREE.MeshBasicMaterial({ color: 0xd8b25a })); rib.position.set(Math.cos(t) * 0.31, 0.11, Math.sin(t) * 0.31); rib.rotation.z = Math.PI / 2 - 0.34; rib.rotation.y = -t; um.add(rib); }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0x3a2416 })); shaft.position.y = -0.2; um.add(shaft);
    um.renderOrder = 7;
    vfx.timed(um, 1.0, (k, dt) => { const o = Math.min(1, k / 0.3); um.position.copy(a.head().add(V(0, 0.3, 0))); um.scale.set(0.2 + o * 0.8, 0.5 + o * 0.5, 0.2 + o * 0.8); um.rotation.y += dt * (2 + k * 6); silk.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
      if (o >= 1 && Math.random() < 0.5) { const t = rand(0, 6.28), c = um.position; spark(V(c.x + Math.cos(t) * 0.6, c.y, c.z + Math.sin(t) * 0.6), PEARL, { life: 0.3, size: 0.05 }); } });
    smoke(a, P, [0.12, 0.08, 0.14], 0.9, { r: 0.45, rate: 30 });
    await wait(1000);
  },
  // 魔禮壽: the 花狐貂 leaps from his sleeve, a white beast of light, runs round him once and springs back
  60: async (a, P) => {
    const WHITE = [1, 0.95, 0.85];
    pose.atk(a, 0);
    const beast = flat(once('marten', () => canvasTex(128, 64, g => {
      const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,230,170,0)'); gr.addColorStop(0.35, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(70, 34, 30, 11, -0.1, 0, Math.PI * 2); g.fill();                 // the long body
      g.beginPath(); g.ellipse(26, 30, 24, 9, 0.3, 0, Math.PI * 2); g.fill();                                     // the brush of a tail
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(102, 28, 13, 9, -0.3, 0, Math.PI * 2); g.fill();             // the head
      g.beginPath(); g.moveTo(100, 20); g.lineTo(104, 10); g.lineTo(108, 21); g.fill(); g.beginPath(); g.moveTo(108, 22); g.lineTo(114, 13); g.lineTo(115, 25); g.fill();   // the ears
      g.fillStyle = '#c03020'; g.fillRect(108, 26, 3, 3); })), 1.0, 0.5, 8);
    const trail = vfx.ribbon({ col: WHITE, width: 0.08, n: 26, fade: 0.4 });
    pose.atk(a, 1);
    vfx.timed(beast, 0.85, k => { const t = k * 6.28 * 1.05 - 1.57, r = 0.85 * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2) * (k > 0.85 ? (1 - k) / 0.15 : 1), y = 0.35 + Math.abs(Math.sin(k * 6.28 * 3)) * 0.25;
      beast.position.set(P.x + Math.cos(t) * r, P.y + y, P.z + Math.sin(t) * r); face(beast); beast.scale.x = Math.cos(t + 1.57) > 0 ? -1 : 1; trail.push(beast.position.clone()); });
    await wait(850);
    vfx.burst(a.chest(), { n: 16, speed: 2, cols: [[1, 1, 1], WHITE], size: 0.04, life: 0.3, g: 0, shape: 1 });
    await wait(200);
  },
  // 超戰將: he braces, and gold sparks pour up round him
  69: async (a, P) => { pose.guard(a); swirl(a, P, [1, 0.8, 0.35], 0.9, { rate: 60, spin: 10 }); vfx.light(P.clone().setY(P.y + 0.6), [1, 0.8, 0.4], 3, 1, 5); await wait(1000); },
  // 魔戰將, the demon general: a blow, and hellfire rings him
  72: async (a, P) => { await strike(a, P, [1, 0.4, 0.15], 1, { chips: [[1, 0.5, 0.2], [0.4, 0.2, 0.15]] }); flameRing(P, 0.55, 0, 0.5, { rate: 70 }); await wait(500); },
  // 崇侯虎, 北伯侯: his hand raised, tiger-orange sparks swirl round him
  46: async (a, P) => { raise(a, 0); swirl(a, P, [1, 0.55, 0.15], 0.9, { rate: 45 }); await wait(1000); },
  // 崇應彪, who lulls with dreams: a violet stream winds round him
  47: async (a, P) => { raise(a, 0); ribbons(a, P, [[0.7, 0.5, 1], [1, 0.6, 0.4]], 0.9, { spin: 6, width: 0.05, h: 1.2 }); await wait(1000); },
  // 紂王, the last king of Shang: his hand raised, a black storm winds up round him, red sparks in it
  70: async (a, P) => { raise(a, 0); smoke(a, P, [0.08, 0.06, 0.08], 0.95, { rate: 40, r: 0.6 }); swirl(a, P, [1, 0.2, 0.15], 0.95, { rate: 25, r: 0.7 }); vfx.shake(0.04, 0.6); await wait(1050); },
  // ---- sorcerers
  // 法師: he holds up a talisman; it flares and burns away
  19: async (a, P) => {
    raise(a, 0);
    const tex = once('talisman', () => canvasTex(48, 128, g => { g.fillStyle = '#f2d36a'; g.fillRect(6, 4, 36, 120); g.strokeStyle = '#c0281c'; g.lineWidth = 4; g.strokeRect(9, 7, 30, 114);
      g.beginPath(); g.moveTo(24, 16); g.lineTo(16, 34); g.lineTo(32, 46); g.lineTo(16, 62); g.lineTo(32, 76); g.quadraticCurveTo(10, 92, 24, 110); g.stroke(); }));
    const m = flat(tex, 0.16, 0.42, 7);
    vfx.timed(m, 0.8, k => { face(m); m.position.copy(a.head().add(V(0, 0.35, 0))); m.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1; m.material.color.setScalar(1 + k * 1.5); },
      () => { const q = a.head().add(V(0, 0.35, 0)); vfx.burst(q, { n: 20, speed: 1.8, cols: [[1, 0.9, 0.5], [1, 0.5, 0.15]], size: 0.05, life: 0.5, g: -1, shape: 0 }); vfx.light(q, [1, 0.7, 0.3], 3, 0.3, 5); });
    await wait(1000);
  },
  // 幻士, the illusionist: streams in the colours of the rainbow wind round him
  31: async (a, P) => { raise(a, 0); ribbons(a, P, [[1, 0.35, 0.35], [1, 0.85, 0.3], [0.35, 1, 0.5], [0.4, 0.6, 1], [0.8, 0.45, 1]], 0.9, { spin: 7, width: 0.04 }); await wait(1000); },
  // 妖醫士, the demon healer: magenta motes gather to her hands
  55: async (a, P) => { raise(a, 0); motes(a, [1, 0.4, 0.85], 0.85, { rate: 34 }); await wait(1000); },
  // 呂岳, the plague god: sickly yellow-green fumes rise round him
  66: async (a, P) => { raise(a, 0); smoke(a, P, [0.45, 0.5, 0.12], 0.95, { rate: 32 }); swirl(a, P, [0.85, 1, 0.3], 0.95, { rate: 18 }); await wait(1050); },
  // 聞太師, 聞仲, who will rule the thunder: his hand raised, lightning crashes down round him
  67: async (a, P) => { raise(a, 0); bolts(P, [0.75, 0.6, 1], 5, 0.8); await wait(1000); },
  // 申公豹, the schemer: a corpse's green breath winds round him
  68: async (a, P) => { raise(a, 0); smoke(a, P, [0.12, 0.22, 0.1], 0.95, { rate: 34 }); swirl(a, P, [0.6, 1, 0.4], 0.95, { rate: 16 }); await wait(1050); },
  // 九龍島's four sages, each with their own treasure: an orb over his head that swells and flares
  49: async (a, P) => { raise(a, 0); orb(a, [1, 0.6, 0.2], 0.85); await wait(1000); },   // 高友乾, the 混元寶珠
  50: async (a, P) => { raise(a, 0); swirl(a, P, [0.75, 0.95, 1], 0.9, { rate: 40, shape: 0 }); await wait(1000); },   // 李興霜, frost
  51: async (a, P) => { raise(a, 0); orb(a, [1, 0.3, 0.25], 0.85, { r: 0.2 }); await wait(1000); },   // 王魔, the 開天珠
  52: async (a, P) => { raise(a, 0); smoke(a, P, [0.5, 0.42, 0.62], 0.9, { rate: 24 }); await wait(1000); },   // 楊森, violet cloud
  // ---- the East Sea
  // 龍太子, the dragon king's son: water winds up round him and freezes
  20: async (a, P) => { raise(a, 0); ribbons(a, P, [[0.4, 0.75, 1], [0.8, 0.95, 1]], 0.8, { spin: 8, width: 0.06 }); await wait(800); vfx.burst(a.chest(), { n: 24, speed: 2, cols: [[1, 1, 1], [0.6, 0.85, 1]], size: 0.05, life: 0.4, g: 0, shape: 0 }); await wait(250); },
  // 蟹將, the crab general: he braces and bubbles rise round him
  21: async (a, P) => { pose.guard(a); swirl(a, P, [0.75, 0.9, 1], 0.9, { rate: 30, spin: 2, size: 0.07 }); await wait(1000); },
  // 蝦兵, the shrimp soldier: a hop and a splash
  22: async (a, P) => { await rise(a, 0.3, 0.2); await land(a, 0.3, 0.14); vfx.burst(P.clone().setY(P.y + 0.1), { n: 24, speed: 2.2, cols: [[0.85, 0.95, 1], [0.4, 0.75, 1]], size: 0.05, life: 0.6, g: 6, shape: 1, up: 0.8 }); await wait(600); },
  // 海龍王, the dragon king: a column of water winds up round him and bursts into spray
  23: async (a, P) => { raise(a, 0); ribbons(a, P, [[0.3, 0.6, 1], [0.6, 0.85, 1], [0.3, 0.6, 1], [0.9, 0.95, 1]], 0.85, { spin: 7, width: 0.09, r: 0.65, h: 2 }); await wait(850);
    vfx.burst(a.head().add(V(0, 0.6, 0)), { n: 36, speed: 2.6, cols: [[1, 1, 1], [0.45, 0.75, 1]], size: 0.05, life: 0.6, g: 3, shape: 1 }); await wait(250); },
  // ---- spirits and beasts
  // 守護靈, the guardian spirit: it rises a little, soul-fire circling it
  33: async (a, P) => { await rise(a, 0.25, 0.25); swirl(a, P, [0.65, 0.95, 1], 0.7, { rate: 24, spin: 4, size: 0.08 }); await wait(700); await land(a, 0.25, 0.15); },
  // 魅影, the phantom: it fades half away, violet wisps round it, and comes back
  42: async (a, P) => { swirl(a, P, [0.75, 0.55, 1], 0.9, { rate: 28, spin: 5 }); await anim(0.45, k => { a.fade = 1 - k * 0.6; }); await anim(0.45, k => { a.fade = 0.4 + k * 0.6; }); a.fade = 1; await wait(150); },
  // 夜蝠, the night bat: it rises, a dark flutter of sparks round it
  39: async (a, P) => { await rise(a, 0.3, 0.25); swirl(a, P, [0.55, 0.35, 0.8], 0.7, { rate: 50, spin: 11, shape: 0 }); await wait(700); await land(a, 0.3, 0.15); },
  // 龍鬚虎, who hurls stones: a blow, stones thrown up
  35: async (a, P) => { await strike(a, P, [0.85, 0.75, 0.6], 1.3, { chips: [[0.55, 0.5, 0.45], [0.4, 0.37, 0.33]] }); await wait(450); },
  // 麒麟獸, the qilin: it rears up a little and flames ring it
  37: async (a, P) => { await rise(a, 0.2, 0.2); flameRing(P, 0.5, 0, 0.7, { rate: 50 }); await wait(700); await land(a, 0.2, 0.12); },
  // 四不像, 姜子牙's steed: clouds gather round it
  45: async (a, P) => { raise(a, 0); smoke(a, P, [0.85, 0.85, 0.82], 0.9, { rate: 28, r: 0.55 }); await wait(1000); },
  // 火鳳凰, the fire phoenix: it rises in a burst of flame
  64: async (a, P) => { await rise(a, 0.35, 0.3); flameRing(P, 0.35, 0, 0.6, { rate: 60, size: 1.2 }); swirl(a, P, [1, 0.6, 0.2], 0.6, { rate: 30 }); await wait(650); await land(a, 0.35, 0.15); },
  // 蛇鬚, the serpent: it coils back and venom-green mist winds low round it
  71: async (a, P) => { pose.guard(a); ribbons(a, P, [[0.4, 1, 0.35], [0.7, 1, 0.3]], 0.9, { spin: 10, width: 0.05, h: 0.5, r: 0.6 }); await wait(1000); },
  // ---- heaven's guardians
  // 天將, a general of heaven: his hand raised, a shaft of light falls on him from the sky
  62: async (a, P) => { raise(a, 0); vfx.pillar(P, [1, 0.95, 0.75], 0.4, 3.4, 0.9, { taper: 1, intensity: 0.2, grow: 1 }); vfx.light(P.clone().setY(P.y + 1), [1, 0.95, 0.8], 4, 1, 6); await wait(1000); },
  // 守門神, the door god: a blow like a gate slammed, gold sparks
  63: async (a, P) => { await strike(a, P, [1, 0.8, 0.35], 1.2, { chips: [[1, 0.8, 0.4], [0.6, 0.2, 0.15]] }); await wait(450); },
};
export const castOf = u => (u && CASTS[u.cid]) || null;
