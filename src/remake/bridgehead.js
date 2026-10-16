// 傅山山谷 at the bridge's far end (map 0ea8ae: scene 6), remade: past battle 4's bridge, a strip of sandy floor under
// the canyon's rock, ledges of sand up on the cliffs, and to the west the river gorge with the plank bridge across it,
// coming in from the canyon (battle 4's set, src/remake/canyon.js, at the same height and in the same light).
// Scene 6's native cut 0x0EA6B8 (tools/rom/bridge.py): 楊戩's 神功 brings six fireballs down from the north, one after
// another, each on one piece of the bridge (there the north half of cells 0, 1 and 2, then the south half; here, the
// user's call, six stretches of the span from its far left in view to the near end, left to right); each piece bursts,
// its planks fall burning into the gorge (the first takes the rest of the span west with it), and the broken ends burn on. native(E, event, clock) acts it out by the scene's clock, so a seek (#at=) shows the state then.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { box } from '../kit/parts.js';
import { sfx } from '../audio.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 16, MH = 10;
const PALETTE = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800, 0xfcfc90], [CL.grass]: [0xb49024, 0xd8b448, 0x242400],
  [CL.rock]: [0x24006c, 0x000000, 0x482400, 0x906c00, 0xd8b400], [CL.water]: [0xfcfcfc, 0xb4fcfc, 0x00b4fc, 0x246cfc, 0x2400b4] };
const FLOOR = 0.7, LEDGE = 1.6, RIVER = -3.2;
const BR = { x0: -12, x1: 3.15, z: 7.5, y: FLOOR, half: 0.42 };
let land = null, world = null, pieces = null;

// the bridge in pieces, one per strike: RANGES[i] is the stretch of span (both halves) the i-th blast takes [the user's call:
// the six blasts walk the span from its far left in view to the near end, not the original's three cells at the map's
// edge only]; index 6 is the stub at the near end, left standing (the original's broken-end blocks 0x6A-0x6C)
const RANGES = [[-12, -4.3], [-4.3, -2.8], [-2.8, -1.3], [-1.3, 0.2], [0.2, 1.5], [1.5, 2.55]], STUB = [2.55, 3.15];
const HIT_X = [-5.0, -3.55, -2.05, -0.55, 0.85, 2.05];   // where each fireball lands (the first one in view, as the camera frames it)
function bridge() {
  const g = new THREE.Group(), wood = T.material(T.planks(0x8a6038, 1), {}), dark = T.material(T.wood(0x4a3220, 'bridgeBeam'), {});
  const deck = BR.y + 0.02, P = new Map(), put = (k, m) => { if (!P.has(k)) P.set(k, []); P.get(k).push(m); g.add(m); };
  const pieceOf = x => { const i = RANGES.findIndex(([a, b]) => x >= a && x < b); return i < 0 ? 6 : i; };
  for (let x = BR.x0; x < BR.x1; x += 0.24) for (const side of [0, 1]) {
    const z0 = side ? BR.z : BR.z - BR.half, z1 = side ? BR.z + BR.half : BR.z;
    const p = box(wood, x, deck, z0 + (side ? 0 : 0.002), x + 0.21, deck + 0.05, z1 - (side ? 0.002 : 0), 2);
    p.rotation.y = Math.sin(x * 12.9) * 0.02; p.position.y += Math.sin(x * 7.3) * 0.008; put(pieceOf(x + 0.1), p);
  }
  for (const side of [0, 1]) RANGES.concat([STUB]).forEach(([a, b], k) => {   // the stringer under each piece, and its posts and rail
    const z = BR.z + (side ? 1 : -1) * (BR.half - 0.08);
    put(k, box(dark, a, deck - 0.09, z - 0.04, b, deck, z + 0.04));
    const zr = BR.z + (side ? 1 : -1) * BR.half;
    for (let x = Math.ceil(a) + 0.05; x < b; x += 1) put(k, box(dark, x - 0.05, x < 2.6 ? RIVER : deck - 0.6, zr - 0.05, x + 0.05, deck + 0.42, zr + 0.05));
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, b - a, 5).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 }));
    rope.position.set((a + b) / 2, deck + 0.38, zr); put(k, rope);
  });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, P };
}

async function build(E, FX) {
  const S = E.world.scene; world = E.world;
  const lay = await readLayout('assets/maps/0ea8ae.png', MW, MH, PALETTE, { [CL.water]: 1.4 });
  const W = MW * 4, H4 = MH * 4;
  const tc = (cx, cy) => D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 2;
  // the floor: the open cells joined to where the heroes stop (4, 7), east of the bridge; the other open cells are the
  // ledges up on the cliffs (no one goes there); the bridge's cells (0-2, 7) are the gorge, under the planks
  const floor = new Set();
  for (const q = [[4, 7]]; q.length;) { const [x, y] = q.shift(); if (x < 3 || y < 0 || x >= MW || y >= MH || tc(x, y) !== 0 || floor.has(x + ',' + y)) continue; floor.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  const ledge = (cx, cy) => cy < 6 && tc(cx, cy) === 0;
  const gorgeAt = (x, z) => { const wu = ((x / 9) % 1 + 1) % 1, wv = ((z / 9) % 1 + 1) % 1, n = (T.fbm(wu, wv, 12, 3, 21) - 0.5) * 0.7;
    const e = Math.min(3.0 - x + n, z - 5.0 + n, 10.6 - z + n); if (e <= 0) return 0; const k = Math.min(1, e / 1.4); return k * k * (3 - 2 * k); };
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const k = (cy * 4 + j) * W + cx * 4 + i;
    if (floor.has(cx + ',' + cy) || ledge(cx, cy)) { if (lay[k] === CL.rock || lay[k] === CL.water) lay[k] = CL.ground; }
    else lay[k] = CL.rock;   // the art's spare tiles on the bottom row too
  }
  lay.pebbles = lay.pebbles.filter(([x, z]) => floor.has(Math.floor(x) + ',' + Math.floor(z)));
  land = new Land({ w: MW, h: MH, layout: lay, ext: 14, outside: () => CL.rock, rockH: 1.7, rise: 2.4, lumpH: 0.05,
    tex: { dirt: T.dirt(0xc89a62, 'valleyDirt'), turf: T.turf(0x8a8a3a), rock: T.rock(0x6a6058, 'valleyRock', 0.2) },
    tint: { dirt: 0xfff2e0, turf: 0xe8e8c0, rock: 0xd8c4b0 } });
  const at0 = land.at.bind(land);
  const base = (x, z) => { const cx = Math.floor(x), cz = Math.floor(z); return floor.has(cx + ',' + cz) ? FLOOR : ledge(cx, cz) ? LEDGE : FLOOR; };
  // the rock just south of the floor stays low (as the canyon's rims): no one at the floor's edge hidden behind it
  const rim = (x, z) => { const cx = Math.floor(x); for (const d of [0.4, 0.9, 1.4]) if (floor.has(cx + ',' + Math.floor(z - d))) return FLOOR + 0.9 + Math.max(0, d - 0.9) * 0.6; return 99; };
  land.at = (x, z) => { const cx = Math.floor(x), cz = Math.floor(z); let h = base(x, z) + at0(x, z);
    if (floor.has(cx + ',' + cz)) h = FLOOR + at0(x, z); else if (!ledge(cx, cz)) h = Math.min(h, rim(x, z));
    const g = gorgeAt(x, z); return g ? h + (RIVER - 0.5 - h) * g : h; };
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.34, topGreen: 1, bed: 0x2a4a5a }));
  const river = new THREE.Mesh(new THREE.PlaneGeometry(30, 6, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1c4450, roughness: 0.75, metalness: 0, envMapIntensity: 0.05, fog: false }));
  river.position.set(-10, RIVER, 7.8); river.receiveShadow = true; S.add(river);
  const br = bridge(); S.add(br.g); pieces = br.P;
  const clear = (x, z) => !gorgeAt(x, z) && !(z > 6.8 && z < 8.2 && x < 3.4);
  S.add(grass(land.scatter(CL.grass, 110, clear), { size: 0.55, cols: ['#9a9a40', '#b4aa50', '#7a8030', '#c8bc60', '#8a8a38'] }));
  const rockM = T.material(T.rock(0x6a6058, 'valleyRock', 0.2), { color: 0xf0dcc0 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]), ...land.scatter(CL.ground, 0.3, clear)], rockM, { size: 0.13 }));
  const into = (x, z) => land.dist[Math.floor((z + 14) * 4) * land.W + Math.floor((x + 14) * 4)] || 0;
  S.add(shrubs(land.scatter(CL.rock, 2.4, (x, z) => into(x, z) > 2 && clear(x, z) && !floor.has(Math.floor(x) + ',' + Math.floor(z - 1.2))), { size: 0.46, cols: ['#4a5a2a', '#5a6a30', '#66783a', '#3e4c24'] }));
  S.add(pines(land.scatter(CL.rock, 0.22, (x, z) => into(x, z) > 5 && clear(x, z) && z < 6), { size: 1.0, cols: ['#34482a', '#405834', '#4c663a', '#2c3e22'] }));
  E.world.updaters.push((dt, t) => windTick(t));
}

// ---------------------------------------------------------------- the bridge comes down (native 0x0EA6B8)
// (the original's strikes edit its map's cells x 0-2 of the span, rows 6-7 the north half, 8-9 the south: bridge.py)
function native(E, ev, clock) {
  if (ev.name !== 'bridge' || !pieces || !world) return;
  const S = world.scene, done = new Set(), balls = [], debris = [], fires = [];
  const ball = () => { const m = E.vfx.fireball(0.26, { heat: 1.35, tint: [1, 0.5, 0.2] }); const L = new THREE.PointLight(0xff7a30, 8, 6, 1.6); m.add(L); m.visible = false; S.add(m); return m; };
  // [the user's call] left to right along the span, from its far left in view to the near end, a stretch (both halves) at
  // each of the original's six beats (the original takes its map's three cells, the north halves, then the south)
  const beats = ev.strikes.slice().sort((a, b) => a.f - b.f);
  const strikes = beats.map((b, i) => ({ s: Object.assign({}, b, { to: [HIT_X[i] * 32, BR.z * 32] }), piece: i, ball: ball(), trail: null }));
  const hit = (st, live) => {   // the piece goes: planks fall burning (only when seen live), the broken end burns on
    for (const m of pieces.get(st.piece) || []) {
      if (!m.visible) continue; m.visible = false;
      if (!live) continue;
      const d = m.clone(); d.visible = true; S.add(d);
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox, side = m.position.z + (bb.min.z + bb.max.z) / 2 > BR.z ? 1 : -1;   // its half falls to its own side
      debris.push({ m: d, vx: (Math.random() - 0.5) * 1.6, vy: Math.random() * 2.2, vz: (Math.random() - 0.5) * 1.4 + side * 0.4, rx: (Math.random() - 0.5) * 6, rz: (Math.random() - 0.5) * 6, t: 0 });
    }
    const p = new THREE.Vector3(st.s.to[0] / 32, BR.y + 0.1, BR.z);
    if (live) sfx(0x806f);   // the original's burst on each hit (0x806F, requested a frame before each strike lands: f220, 238, ... 310) [the user's report]
    if (live) {   // the blast: a fireball swelling on the piece and burning out (the original's lingers half a second), a white-hot
      // flash, a shockwave, flames bursting up through the planks, embers and smoke [the user's call: more vivid]
      E.vfx.explode(p, 0.8, { n: 34 }); E.vfx.explode(p.clone().setY(p.y + 0.5), 0.5, { n: 14, smoke: false });
      for (let w = 1; w <= 3; w++) setTimeout(() => E.vfx.explode(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2 + w * 0.15, (Math.random() - 0.5) * 0.3)), 0.4, { n: 8, smoke: w === 3 }), w * 90);   // it billows
      E.vfx.burst(p, { n: 60, speed: 5, cols: [[1, 0.95, 0.7], [1, 0.75, 0.3], [1, 0.45, 0.1]], size: 0.06, life: 1.1, g: 5, flicker: 1 });
      E.vfx.ring(p, [1, 0.7, 0.3], 2.6, 0.45, { intensity: 1.4 }); E.vfx.light(p.clone().setY(p.y + 0.6), [1, 0.6, 0.25], 30, 0.5, 8);
      E.vfx.flash([1, 0.7, 0.4], 0.12); E.vfx.shake(0.14, 0.25);
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.4; E.vfx.flame(p.x + Math.cos(a) * r, p.y - 0.05, p.z + Math.sin(a) * r * 0.6, { size: 0.45 + Math.random() * 0.3, asp: 2.2, life: 0.5 + Math.random() * 0.3, vy: 1.6 + Math.random() * 1.6 }); }
    }
    fires.length = 0;   // (the end the last blast left has gone with this piece)
    for (const dz of [-0.22, 0.22]) fires.push(new THREE.Vector3(RANGES[st.piece][1] + 0.05, BR.y + 0.08, BR.z + dz));   // the end left standing burns
  };
  let last = -1, acc = 0;
  const tick = dt => {
    const t = clock();
    if (t > ev.end + 400 || t < ev.f - 1) { world.updaters.splice(world.updaters.indexOf(tick), 1); return; }
    for (const st of strikes) {
      const { s } = st, k = (t - s.start) / (s.f - s.start);
      if (k >= 0 && k < 1) {   // in flight: down from the sky in the north (the original's arc, from high over (4.5, 2))
        const x = THREE.MathUtils.lerp(s.from[0], s.to[0], k) / 32, z = THREE.MathUtils.lerp(s.from[1], s.to[1], k) / 32;
        st.ball.position.set(x, BR.y + 0.2 + (1 - k) * 6.5, THREE.MathUtils.lerp(z, BR.z, k)); st.ball.visible = true;
        st.ball.userData.mat.uniforms.uT.value += dt; st.ball.rotation.y += dt * 4;
        // [the user's call: a fireball, not a plain ball] flame tongues licking off it, a comet trail, heat sparks and smoke
        const q = st.ball.position;
        if (!st.trail) st.trail = E.vfx.ribbon({ col: [1, 0.5, 0.15], width: 0.42, n: 18 });
        st.trail.push(q);
        for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.6 - 0.4; E.vfx.flame(q.x + Math.cos(a) * Math.cos(e) * 0.24, q.y + Math.sin(e) * 0.24, q.z + Math.sin(a) * Math.cos(e) * 0.24, { size: 0.3 + Math.random() * 0.25, asp: 1.9, life: 0.22 + Math.random() * 0.15, vy: 1.4 }); }   // a mantle of flame round a white-hot core
        for (let i = 0; i < 2; i++) E.vfx.puff(q.x + (Math.random() - 0.5) * 0.3, q.y + 0.1, q.z + (Math.random() - 0.5) * 0.3, { size: 0.3, size1: 0.55, life: 0.32, vy: 0.8 });
        if (Math.random() < 0.5) E.vfx.smokePuff(q.x, q.y + 0.2, q.z, { vy: 0.4, life: 1, size: 0.3, size1: 0.8 });
        for (let i = 0; i < 2; i++) E.vfx.spark(q.x, q.y, q.z, { vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random(), vz: (Math.random() - 0.5) * 1.2, life: 0.5, size: 0.06, r: 1, gg: 0.75, b: 0.3, g: 2, flicker: 1, ph: Math.random() * 9 });
      } else { st.ball.visible = false; if (st.trail && k >= 1) { st.trail.end(); st.trail = null; } }
      if (t >= s.f && !done.has(st)) { done.add(st); hit(st, last >= 0 && t - s.f < 4); }
    }
    for (const d of debris) {   // falling into the gorge, turning, burning
      d.t += dt; d.vy -= 9 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
      if (Math.random() < dt * 6) E.vfx.puff(d.m.position.x, d.m.position.y, d.m.position.z, { size: 0.08, size1: 0.18, life: 0.35 });
      if (d.m.position.y < RIVER - 0.5) { d.m.visible = false; }
    }
    if ((acc += dt) > 0.12) { acc = 0; for (const f of fires) E.vfx.flame(f.x + (Math.random() - 0.5) * 0.1, f.y, f.z + (Math.random() - 0.5) * 0.3, { size: 0.22, size1: 0.1, life: 0.6, vy: 0.7 }); }
    last = t;
  };
  world.updaters.push(tick);
}

export default {
  build, native, viewShift: 1.5,
  ground: (x, z) => land ? (z > 7 && z < 8 && x < 3 ? BR.y + 0.07 : land.at(x, z)) : 0,
  // the canyon's clear morning (canyon.js)
  mood: { bg: 0xd8d4c4, voidCol: false, fog: 0xd8d0bc, fogD: 0.012, sky: 0xd8e4ff, under: 0x6a4a28, hemi: 1.0,
    sun: 0xffe6b8, sunI: 3.1, sunDir: [-0.5, 0.75, 0.4], sat: 1.05, exposure: 1.0, bloom: 0.32, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xc0b098, low: 0x6a5a40, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
