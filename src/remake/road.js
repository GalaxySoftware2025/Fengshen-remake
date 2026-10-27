// the night road where 崇侯虎 stops 蘇護 (map 002450), remade: the original's layout of sandy paths between rugged rock
// (src/kit/terrain.js reads it off the map's colours), wooden steps cut through three ridges, a plank bridge over a
// chasm at the east edge, chests where the original has them; moonlight, torches, pines and scrub on the rocks.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';
import { Actor } from '../actors.js';
import { spriteKey } from '../sprites.js';

const PALETTE = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800], [CL.grass]: [0xb49024, 0xd8b448], [CL.rock]: [0x24006c, 0x000000, 0x906c00, 0xd8b400, 0x482400, 0xfcfc90] };
const STEPS = [{ r: [10, 9.2, 12, 11.8], axis: 'z' }, { r: [15, 5.1, 16, 6.9], axis: 'z' }, { r: [2, 12.0, 4, 13.6], axis: 'z' }];
// cells the original's terrain leaves open where the map art's rock edge overhangs them: 崇侯虎's soldier stands at
// (19,6) and (20,6) as the fox comes (prologue f2117-2443); cut back so he stands at the cliff's foot, not in it
const OPEN = [[18.7, 5.7, 21, 7]];
const CHASM = [29.55, 33.45], BRIDGE = { x0: 29.2, x1: 33.8, z0: 6.95, z1: 8.65 };
let land = null;

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/002450.png', 32, 20, PALETTE);
  for (const s of STEPS) for (let j = s.r[1] * 4; j < s.r[3] * 4; j++) for (let i = s.r[0] * 4; i < s.r[2] * 4; i++) lay[Math.floor(j) * 128 + Math.floor(i)] = CL.ground;   // the cut through the ridge
  for (const r of OPEN) for (let j = r[1] * 4; j < r[3] * 4; j++) for (let i = r[0] * 4; i < r[2] * 4; i++) lay[Math.floor(j) * 128 + Math.floor(i)] = CL.ground;
  land = new Land({ w: 32, h: 20, layout: lay, ext: 12, rockH: 1.15, rise: 2.4,
    ramps: STEPS.map(s => ({ r: s.r, axis: s.axis, y0: 0, y: 0.45, hump: true, n: 8 })),
    carve: [{ r: [CHASM[0], -20, CHASM[1], 40], h: -4 }],
    tex: { dirt: T.dirt(0xb88a5a, 'roadDirt'), turf: T.turf(0x6a7030), rock: T.rock(0x625e6c, 'nightRock') },
    tint: { dirt: 0xf0e0d0, turf: 0xd8e0c0, rock: 0xc4c0d4 } });
  S.add(land.mesh({ dirtK: 0.28, rockK: 0.32 }));
  // the chasm's walls (the heightfield drops straight down there) and a mist far below
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(CHASM[1] - CHASM[0] + 1, 70).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a2a4a, transparent: true, opacity: 0.85, depthWrite: false }));
  mist.position.set((CHASM[0] + CHASM[1]) / 2, -2.2, 10); S.add(mist);
  // the wooden steps through the ridges: plank treads on their hump, log edging
  const plank = T.material(T.planks(0x8a6640, 3), {});
  for (const s of STEPS) {
    const [x0, z0, x1, z1] = s.r, n = 8;
    for (let k = 0; k < n; k++) {
      const za = z0 + (z1 - z0) * k / n, zb = z0 + (z1 - z0) * (k + 1) / n, y = land.at((x0 + x1) / 2, (za + zb) / 2);
      S.add(box(plank, x0 + 0.05, y - 0.12, za + 0.02, x1 - 0.05, y + 0.02, zb - 0.02, 1));
    }
  }
  // the bridge: plank deck on two beams, rope rails on posts
  const beam = T.material(T.wood(0x3a2616, 'beam'), {});
  const yb = 0.02, g = new THREE.Group();
  for (const z of [BRIDGE.z0 + 0.15, BRIDGE.z1 - 0.15]) g.add(box(beam, BRIDGE.x0, yb - 0.3, z - 0.08, BRIDGE.x1, yb - 0.1, z + 0.08));
  for (let x = BRIDGE.x0; x < BRIDGE.x1 - 0.01; x += 0.26) g.add(box(plank, x + 0.01, yb - 0.1, BRIDGE.z0, x + 0.24, yb, BRIDGE.z1, 2));
  const rope = new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 1 });
  for (const z of [BRIDGE.z0 + 0.04, BRIDGE.z1 - 0.04]) {
    for (let x = BRIDGE.x0; x <= BRIDGE.x1 + 0.01; x += (BRIDGE.x1 - BRIDGE.x0) / 4) g.add(box(beam, x - 0.05, yb, z - 0.05, x + 0.05, yb + 0.7, z + 0.05));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, BRIDGE.x1 - BRIDGE.x0, 6), rope); r.rotation.z = Math.PI / 2; r.position.set((BRIDGE.x0 + BRIDGE.x1) / 2, yb + 0.6, z); g.add(r);
  }
  S.add(shade(g));
  // chests where the original has them (the one at 1,19 lies open)
  for (const [x, z, open] of [[3.5, 3.6, false], [0.5, 15.6, false], [0.5, 19.6, false], [1.5, 19.6, true]]) S.add(chest(M, x, z, land.at(x, z), open));
  // plants and stones
  const off = (x, z) => !(x > CHASM[0] - 0.3 && x < CHASM[1] + 0.3) && !STEPS.some(s => x > s.r[0] - 0.1 && x < s.r[2] + 0.1 && z > s.r[1] - 0.1 && z < s.r[3] + 0.1);
  S.add(grass(land.scatter(CL.grass, 80, off), { size: 0.5, cols: ['#8a9a40', '#a8b050', '#6a7a30', '#c0c060', '#7a8838'] }));
  const rockM = T.material(T.rock(0x625e6c, 'nightRock'), { color: 0xb0a090 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.filter(([x, z]) => off(x, z)).map(([x, z]) => [x, land.at(x, z), z]), ...land.scatter(CL.ground, 0.25, off)], rockM, { size: 0.12 }));
  const deep = (x, z) => off(x, z) && land.rawH(x, z) > 1.0;
  S.add(shrubs(land.scatter(CL.rock, 1.3, deep), { size: 0.55, cols: ['#25381e', '#2f4626', '#3a5430', '#1c2c18'] }));
  S.add(pines(land.scatter(CL.rock, 0.1, (x, z) => deep(x, z) && land.dist[Math.floor((z + 12) * 4) * land.W + Math.floor((x + 12) * 4)] > 5), { size: 1.9 }));
  // torches along the road
  for (const [x, z] of [[22.5, 4.5], [27.6, 4.2], [23.4, 9.6], [27.4, 9.4], [15.5, 7.6], [9.5, 8.6]]) FX.torch(E, { x, y: z });
  E.world.updaters.push((dt, t) => windTick(t));
}

// ---------------------------------------------------------------- the fox spirit takes 妲己 (native 0x002A0A, prologue f2633)
// The original, as 妲己 cries out: the white fox vanishes, she flickers grey and back while the cut runs (to f2744), and
// she stands on as the fox's (orig.py prologue 2634-2810). Remade [design]: her own spirit is drawn out of her, pale
// blue, and into the fox; the fox flares, turns to a violet spirit and dives into her body along an arc; she flickers
// violet with the fox's shape inside her, fading. All by the scene's clock, so a seek (#at=) shows the state then.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = k => k * k * (3 - 2 * k), seg = (u, a, b) => Math.min(1, Math.max(0, (u - a) / (b - a)));
function glowCopy(src, col) {   // an additive copy of a sprite, following its frame
  const map = src.material.map.clone(); map.needsUpdate = true;
  const m = new THREE.Mesh(src.geometry, new THREE.MeshBasicMaterial({ map, color: new THREE.Color(...col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide }));
  m.renderOrder = 6; m.sync = s => { map.offset.copy(s.material.map.offset); map.repeat.copy(s.material.map.repeat); m.position.copy(s.position); m.rotation.copy(s.rotation); m.scale.copy(s.scale); };
  return m;
}
function possess(E, ev, clock) {
  const S = E.world.scene, f0 = ev.f, D = ev.end - ev.f, fx = ev.fox;
  const hostOf = () => { for (const [u, a] of E.actors) if (u.slot === ev.host) return a; return null; };
  const unit = { side: 'npc', name: '', sprite: spriteKey(parseInt(fx.gfx, 16)), x: Math.round(fx.x / 32), y: Math.round(fx.y / 32), facing: fx.facing || 'down', still: fx.still, alive: true, done: false, slot: 'possess', status: {}, buf: {} };
  const fox = new Actor(E.bank, unit, S); fox.caster.castShadow = false;
  const F = V3(fx.x / 32 + 0.5, 0, fx.y / 32 + 0.5); F.y = land ? land.at(F.x, F.z) : 0; fox.pos.copy(F);
  const foxGlow = glowCopy(fox.mesh, [0.75, 0.45, 1.3]); S.add(foxGlow);
  let soul = null, haunt = null, inner = null, trail = null, last = -1;
  const T = { soul: [0.04 * D, 0.36 * D], dive: [0.43 * D, 0.72 * D], end: D + 16 };
  const done = () => { E.world.updaters.splice(E.world.updaters.indexOf(tick), 1); fox.dispose(S); for (const m of [foxGlow, soul, haunt, inner]) if (m) S.remove(m); if (trail) trail.end(); const h = hostOf(); if (h) h.flash = 0; };
  const tick = () => {
    const t = clock(), u = t - f0, live = last >= 0 && t - last < 6, crossed = x => live && last - f0 < x && u >= x;
    if (u < -1 || u > T.end) { done(); return; }
    const host = hostOf(); if (!host) { last = t; return; }
    const H = host.chest(), Fc = F.clone().setY(F.y + 0.45);
    // her spirit, drawn out of her body and over into the fox
    const s = seg(u, ...T.soul);
    if (!soul) { soul = glowCopy(host.mesh, [0.6, 0.85, 1.4]); S.add(soul); }
    soul.sync(host.mesh); soul.visible = s > 0 && s < 1;
    if (soul.visible) {
      const k = ease(s); soul.position.lerp(V3(F.x, soul.position.y, F.z), k); soul.position.y += 0.15 + Math.sin(s * Math.PI) * 0.45;
      soul.scale.setScalar(1 - 0.65 * s); soul.material.opacity = Math.min(1, s * 6) * (1 - ease(seg(s, 0.75, 1))) * 0.9;
      if (live && Math.random() < 0.7) { const q = soul.position; E.vfx.spark(q.x + (Math.random() - 0.5) * 0.3, q.y + 0.2 + Math.random() * 0.5, q.z, { vx: (F.x - q.x) * 0.6, vy: 0.2, vz: 0, life: 0.6, size: 0.05, r: 0.65, gg: 0.85, b: 1, g: 0, shape: 0 }); }
    }
    host.flash = s > 0 && s < 1 ? 0.35 * (1 - s) : 0;   // stunned pale while it is taken
    if (crossed(T.soul[1])) { E.vfx.burst(Fc, { n: 26, speed: 1.6, cols: [[0.7, 0.85, 1], [0.8, 0.5, 1]], size: 0.05, life: 0.7, g: 0, up: 0.2 }); E.vfx.ring(F, [0.7, 0.5, 1], 1.2, 0.6, { intensity: 0.8 }); E.vfx.light(Fc, [0.7, 0.5, 1], 5, 0.6, 4); }
    // the fox: glowing as it waits, flaring as it takes her spirit, then a violet spirit diving into her
    const d = seg(u, ...T.dive);
    fox.hidden = d >= 1; fox.root.visible = d < 1;
    if (d > 0 && d < 1) {
      const k = ease(d), A = Fc, B = H, M = A.clone().lerp(B, 0.5).setY(Math.max(A.y, B.y) + 1.3);
      fox.centre = A.clone().multiplyScalar((1 - k) ** 2).add(M.clone().multiplyScalar(2 * k * (1 - k))).add(B.clone().multiplyScalar(k * k));
      fox.size = 1 - 0.6 * k; fox.spin = Math.sin(k * Math.PI) * 0.5; fox.fade = 1 - 0.55 * k;
      if (!trail && live) trail = E.vfx.ribbon({ col: [0.75, 0.45, 1], width: 0.16, n: 22 });
      if (trail) trail.push(fox.centre.clone());
      if (live) for (let i = 0; i < 2; i++) E.vfx.spark(fox.centre.x + (Math.random() - 0.5) * 0.25, fox.centre.y + (Math.random() - 0.5) * 0.25, fox.centre.z, { vx: (Math.random() - 0.5) * 0.4, vy: 0.3, vz: (Math.random() - 0.5) * 0.4, life: 0.7, size: 0.05, r: 0.85, gg: 0.55, b: 1, g: 0, shape: 0, wob: 0.3, ph: Math.random() * 6 });
    } else { fox.centre = null; fox.size = 1; fox.spin = 0; fox.fade = 1; }
    if (d >= 1 && trail) { trail.end(); trail = null; }
    if (!fox.hidden) fox.update(E.gameT, E.world.camera, E.cam.yaw, E.cam.pitch);
    foxGlow.sync(fox.mesh); foxGlow.visible = !fox.hidden;
    const flare = Math.max(0, 1 - Math.abs(u - T.soul[1]) / (0.08 * D));
    foxGlow.material.opacity = d > 0 ? 0.55 + 0.45 * d : 0.18 + 0.12 * Math.sin(u * 0.35) + 0.8 * flare;
    // into her: she flickers violet with the fox's shape inside her, fading out
    const e = seg(u, T.dive[1], T.end);
    if (crossed(T.dive[1])) { E.vfx.burst(H, { n: 40, speed: 2.2, cols: [[0.85, 0.5, 1], [1, 0.85, 1]], size: 0.05, life: 0.8, g: 0, up: 0.1 }); E.vfx.ring(host.pos, [0.8, 0.45, 1], 1.4, 0.7, { intensity: 1 }); E.vfx.light(H, [0.8, 0.45, 1], 7, 0.8, 5); }
    if (!haunt) { haunt = glowCopy(host.mesh, [0.8, 0.4, 1.2]); inner = glowCopy(fox.mesh, [0.85, 0.5, 1.3]); S.add(haunt, inner); }
    haunt.sync(host.mesh); haunt.visible = inner.visible = e > 0 && e < 1;
    if (haunt.visible) {
      const on = Math.floor(u / 4) % 2 === 0;   // the original's flicker, every four frames
      haunt.material.opacity = on ? 0.8 * (1 - 0.6 * e) : 0.1; host.flash = on ? 0.3 * (1 - e) : 0;
      inner.sync(fox.mesh); inner.position.copy(host.mesh.position).add(V3(0, 0.05, 0)); inner.rotation.copy(host.mesh.rotation); inner.scale.setScalar(0.85);
      inner.material.opacity = 0.55 * (1 - e) * (on ? 1 : 0.5);
    }
    last = t;
  };
  E.world.updaters.push(tick);
}
// ---------------------------------------------------------------- the night darkens to deep red (0x21732, prologue f1965-1995)
// The original takes the map's palette lines a step down a channel each, four times (f1966, 1967, 1981, 1995): its orange
// road goes deep red and the rock black, the sprites untouched; the map's own colours come back under the fox army's
// white (f2237-2259). Here the moon, the sky light and the fog dim and redden by the same steps, and the cast is lifted
// to stay as it was. All by the scene's clock.
const RED = new THREE.Color(1, 0.2, 0.1), DEEP = new THREE.Color(0.09, 0.012, 0.008);
function redden(E, ev, clock) {
  const S = E.world.scene, lights = [];
  S.traverse(o => { if (o.isLight && !o.isPointLight && !o.isSpotLight) lights.push([o, o.intensity, o.color.clone(), o.groundColor ? o.groundColor.clone() : null]); });   // (the torches keep their own flicker)
  const fog = S.fog ? S.fog.color.clone() : null, bg = S.background && S.background.isColor ? S.background.clone() : null, env = S.environmentIntensity ?? 1;
  const level = t => {
    if (t < ev.f) return 0;
    let k = ev.steps.filter(f => t >= f).length / ev.steps.length;
    if (ev.until) { const [a, b] = ev.until; if (t >= a) k *= Math.max(0, 1 - (t - a) / (b - a)); }
    return k;
  };
  const apply = k => {
    for (const [l, i, c, g] of lights) { l.intensity = i * (1 - 0.78 * k); l.color.copy(c).lerp(RED, 0.7 * k); if (g) l.groundColor.copy(g).lerp(DEEP, k); }
    if (fog) S.fog.color.copy(fog).lerp(DEEP, k); if (bg) S.background.copy(bg).lerp(DEEP, k);
    S.environmentIntensity = env * (1 - 0.8 * k);
    for (const a of E.actors.values()) a.glow = 1 + 1.5 * k;
  };
  const tick = () => {
    const t = clock(), k = level(t); apply(k);
    if (t < ev.f - 2 || (ev.until && t > ev.until[1] + 2)) { apply(0); E.world.updaters.splice(E.world.updaters.indexOf(tick), 1); }
  };
  E.world.updaters.push(tick);
}

// ---------------------------------------------------------------- the fox's army (0x278E, prologue f2207-2259)
// Two ranks of eight of the 戰將's sheet charge in from where the two 戰將 stand, each a leader and seven a frame behind
// him, 10 px a frame from f2210 (rank one down a third of its run, rank two up a sixth: a '>' across the road), gone at
// the white; the palette rises to white every third frame from f2222, holds at f2237-2240 and comes back by f2259.
// Remade [design]: dust behind every runner.
function army(E, ev, clock) {
  const S = E.world.scene, men = [], sprite = spriteKey(parseInt(ev.sheet, 16));
  for (let r = 0; r < ev.ranks.length; r++) for (let j = 0; j < ev.n; j++) {
    const unit = { side: 'npc', name: '', sprite, x: 0, y: 0, facing: 'right', alive: true, done: false, slot: 'army', status: {}, buf: {} };
    const a = new Actor(E.bank, unit, S); a.walking = true; a.walkMs = 90; a.root.visible = false; men.push({ a, r, j });
  }
  let last = -1;
  const done = () => { E.world.updaters.splice(E.world.updaters.indexOf(tick), 1); for (const m of men) m.a.dispose(S); };
  const tick = () => {
    const t = clock();
    if (t < ev.f - 1 || t > ev.white[3] + 4) { done(); return; }
    const live = last >= 0 && t - last < 6; last = t;
    for (const { a, r, j } of men) {
      const on = t >= ev.appear + j && t < ev.end; a.hidden = !on; a.root.visible = on; if (!on) continue;
      const run = ev.speed * Math.max(0, t - j - ev.run), [x0, y0, slope] = ev.ranks[r], x = (x0 + run) / 32 + 0.5, z = (y0 + run * slope) / 32 + 0.5;
      a.pos.set(x, land ? land.at(x, z) : 0, z);
      a.update(E.gameT, E.world.camera, E.cam.yaw, E.cam.pitch);
      if (live && run > 0 && Math.random() < 0.35) E.vfx.smokePuff(x - 0.35, a.pos.y + 0.04, z + (Math.random() - 0.5) * 0.3, { vy: 0.2, life: 0.5, size: 0.18, size1: 0.42, tint: [0.2, 0.1, 0.07] });
    }
    // the white: up in six steps, held, down in eight (the original's), as a smooth flash
    const [w0, w1, w2, w3] = ev.white, k = t < w0 ? 0 : t < w1 ? ((t - w0) / (w1 - w0)) ** 2 : t < w2 ? 1 : t < w3 ? 1 - (t - w2) / (w3 - w2) : 0;   // (a channel step every third frame: slow to lift at first)
    if (k > 0) { E.vfx.screen.flash = Math.max(E.vfx.screen.flash, k * 0.88); E.vfx.screen.flashCol.setRGB(0.92, 0.94, 1); }
  };
  E.world.updaters.push(tick);
}
function native(E, ev, clock) { if (ev.name === 'possess') possess(E, ev, clock); else if (ev.name === 'redden') redden(E, ev, clock); else if (ev.name === 'army') army(E, ev, clock); }

export default {
  build, native, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'fireflies',
  mood: { bg: 0x0c1428, voidCol: false, fog: 0x101a34, fogD: 0.03, sky: 0x8aa4dc, under: 0x241c30, hemi: 0.75,
    sun: 0xb0c4ff, sunI: 2.0, sunDir: [0.4, 0.8, -0.35], sat: 1.0, exposure: 1.05, bloom: 0.6, aoR: 0.8,
    env: { top: 0x2a3a6a, mid: 0x18203a, low: 0x0a0a12, lights: [[4, 8, -6, 0xc0d0ff, 3]] } },
};
