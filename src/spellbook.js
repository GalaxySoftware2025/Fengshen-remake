// The rest of the spell set-pieces, one per spell id the ROM has (src/spells.js holds the first ones and the dispatch).
// Each follows the original's own effect (captured from the ROM, cast by 林雲 on 磻溪: the beats, the order, the
// silhouette) rebuilt in 3D after DESIGN §5: one clear silhouette, a single readable impact beat, ctx.hit() on it.
// Area spells play over ctx.cells (the cells the spell covers, from battle.js spellCtx). The summoned beasts, 觀音 and
// the skull wisps are the original's own sprites (assets/fx/<name>.png, cut out of the ROM's plane A / sprite layer
// during the cast; xBR 4x in assets/fx/hd): ROM-derived, keep private.
import * as THREE from 'three';
import { rand, effectH } from './world.js';
import { NOISE } from './vfx.js';
import { wait } from './battle.js';   // (used at run time only: battle.js imports this module)
import { houndRunTex } from './levelup.js';   // (the 哮天犬's gallop: run time only)
import { iceMaterial, shardGeometry, chunkGeometry, shatter, frost } from './elements.js';
import { V, ease, basis, swordMesh, pointAlong, bezier, intro, outro, DARK, ticker, cueAt, channel, facing, yawOf, swirl, arrowMesh, flameRing, talismanTex, petalGeo } from './spellkit.js';

// ---------------------------------------------------------------- shared pieces
// the area, nearest the aimed cell first, each point on the ground
const cellsOf = ctx => (ctx.cells && ctx.cells.length ? ctx.cells : [ctx.at]).map(c => c.clone().setY(effectH(c.x, c.z)))
  .sort((a, b) => a.distanceTo(ctx.at) - b.distanceTo(ctx.at));
const spreadOf = cells => cells.reduce((m, c) => Math.max(m, c.distanceTo(cells[0])), 0);   // 0 one cell, 1 a cross, 2 the big diamond
const later = (ms, fn) => { wait(ms).then(fn); };   // on the game clock (not setTimeout: it keeps to the fast-forward and the stepped video)
const tgts = ctx => ctx.targets.length ? ctx.targets : [];
function glowTargets(ctx, amount, life) {   // the targets light up with the spell (the original's palette flash)
  for (const a of tgts(ctx)) ticker(ctx.vfx, life || 0.6, k => { a.flash = amount * (1 - k); }, () => { a.flash = 0; });
}
const texCache = new Map();
function tex(path) {
  if (!texCache.has(path)) { const t = new THREE.TextureLoader().load(path); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(path, t); }
  return texCache.get(path);
}
// a camera-facing card: a sprite of the original's art, or a soft glow
function card(map, w, h, o) {
  o = o || {};
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(...(o.col || [1, 1, 1])), transparent: true, depthWrite: false, opacity: o.opacity ?? 1,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !o.add }));
  s.scale.set(w, h, 1); s.renderOrder = o.order || 7; return s;
}
const glowCard = (v, col, size) => card(v.glowTex, size, size, { col, add: true });
// a dark disc lying on the ground (a falling thing's shadow, a pit)
function shadowDisc(v, p, r, life, o) {
  o = o || {};
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ map: v.glowTex, color: new THREE.Color(...(o.col || [0, 0, 0])), transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, effectH(p.x, p.z) + 0.035, p.z); m.renderOrder = 3;
  return v.timed(m, life, (k, dt, t) => { const g = Math.min(1, t / (o.grow || 0.4)); m.scale.setScalar(0.3 + 0.7 * g); m.material.opacity = (o.a || 0.7) * g * Math.min(1, (life - t) / 0.3); });
}
// a glowing crack across the ground from a to b: a dark fissure with a hot seam, opening over `open` seconds
function crack(v, a, b, col, life, o) {
  o = o || {};
  const n = 14, pts = [], d = b.clone().sub(a), side = V(-d.z, 0, d.x).normalize();
  for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t).add(side.clone().multiplyScalar(i && i < n ? rand(-0.18, 0.18) : 0)); p.y = effectH(p.x, p.z) + 0.04; pts.push(p); }
  const strip = (w, mat) => {
    const pos = []; for (const p of pts) pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
    const idx = []; for (let i = 0; i < n; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('t', new THREE.Float32BufferAttribute(pts.flatMap((_, i) => [i / n, i / n]), 1)); g.setIndex(idx);
    return new THREE.Mesh(g, mat);
  };
  const reveal = `attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const mk = (c, add) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uK: { value: 0 }, uA: { value: 1 }, uC: { value: new THREE.Color(...c) } }, vertexShader: reveal,
    fragmentShader: `uniform float uK, uA; uniform vec3 uC; varying float vT; void main(){ if (vT > uK) discard; gl_FragColor = vec4(uC, uA); }` });
  const g = new THREE.Group(), dark = strip(o.width || 0.13, mk([0.04, 0.02, 0.01], false)), hot = strip((o.width || 0.13) * 0.4, mk(col.map(c => c * 1.1), true));
  g.add(dark, hot); g.renderOrder = 3;
  v.timed(g, life, (k, dt, t) => {
    const r = Math.min(1, t / (o.open || 0.35)), f = Math.min(1, (life - t) / 0.4);
    for (const m of [dark, hot]) { m.material.uniforms.uK.value = r; m.material.uniforms.uA.value = f * (m === hot ? 0.8 + 0.2 * Math.sin(t * 30) : 0.85); }
  });
  return g;
}
// a lump of rock: a displaced dodecahedron
function rockMesh(size, col) {
  const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const s = 0.75 + 0.25 * Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.7) * Math.cos(p.getZ(i) * 4.3); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.85, p.getZ(i) * s); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col || 0x7a6650, roughness: 0.95, flatShading: true }));
  m.scale.setScalar(size); m.castShadow = true; return m;
}
// a thrown object: from a to b over life along an arc of height h, spinning; onLand at the end
function lob(v, obj, a, b, h, life, onLand, o) {
  o = o || {}; const spin = V(rand(-6, 6), rand(-6, 6), rand(-6, 6));
  obj.position.copy(a);
  return v.timed(obj, life, (k, dt) => {
    const e = o.fall ? k * k : k; obj.position.copy(a).lerp(b, e); obj.position.y += Math.sin(k * Math.PI) * h;
    if (o.spin !== false) { obj.rotation.x += spin.x * dt; obj.rotation.y += spin.y * dt; obj.rotation.z += spin.z * dt; }
    if (o.each) o.each(obj.position, k);
  }, () => { obj.visible = false; onLand && onLand(b); });
}
function dustBurst(v, p, s, tint) {
  for (let i = 0; i < 10 * s; i++) { const a = rand(0, 6.28), sp = rand(1, 2.6) * s; v.smokePuff(p.x, p.y + 0.12, p.z, { vx: Math.cos(a) * sp, vy: rand(0.2, 0.9), vz: Math.sin(a) * sp, drag: 2.2, life: rand(1, 1.7), size: 0.35 * s, size1: 1.1 * s, tint: tint || [0.5, 0.44, 0.36] }); }
  for (let i = 0; i < 16 * s; i++) v.spark(p.x + rand(-0.3, 0.3), p.y + 0.1, p.z + rand(-0.3, 0.3), { vx: rand(-2.5, 2.5) * s, vy: rand(2, 5) * s, vz: rand(-2.5, 2.5) * s, g: 12, life: rand(0.6, 1.1), size: rand(0.05, 0.09), r: 0.42, gg: 0.36, b: 0.28, a: 1, shape: 1, floor: p.y + 0.03 });
}
// ice: faceted crystal material and a cluster of crystals that bursts up out of the ground and shatters at `hold`
const ICE = () => iceMaterial();   // (src/elements.js: ice that looks through itself, facets, cracks; not a flat-shaded blue)
const ICE_COLS = [[1, 1, 1], [0.7, 0.9, 1], [0.45, 0.75, 1]];
function crystals(v, P, n, scale, hold, mat) {
  mat = mat || ICE();
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), r = i === 0 ? 0 : rand(0.2, 0.75) * scale, h = (i === 0 ? 1.7 : rand(0.5, 1.3)) * scale;
    const m = new THREE.Mesh(shardGeometry(), mat); m.scale.setScalar(0.001);   // (a hexagonal crystal, foot on the ground)
    const p = V(P.x + Math.cos(a) * r, effectH(P.x, P.z) - 0.05, P.z + Math.sin(a) * r);
    m.position.copy(p); m.rotation.set(rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2), rand(0, 6), rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2));
    v.timed(m, hold + 0.1, (k, dt, t) => {
      const g = Math.min(1, Math.max(0, (t - i * 0.03) / 0.14)), w = (i === 0 ? 0.22 : 0.15) * scale;
      m.scale.set(w * g + 0.001, h * g + 0.001, w * g + 0.001);
      if (t > hold && !m.userData.b) { m.userData.b = 1; m.visible = false;
        v.burst(p.clone().setY(p.y + h * 0.5), { n: 10, speed: 3, cols: ICE_COLS, size: 0.04, life: 0.6, g: 9, shape: 1 }); shatter(v, p.clone().setY(p.y + h * 0.5), 5, mat, { size: 0.16 * scale + 0.06 }); }
    });
  }
  v.burst(P.clone().setY(P.y + 0.2), { n: 16, speed: 3.5, cols: ICE_COLS, size: 0.045, life: 0.6, g: 8, shape: 1 }); frost(v, P, 0.9 * scale + 0.3, hold + 1.2);
  for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), s = rand(1, 2); v.smokePuff(P.x, P.y + 0.08, P.z, { vx: Math.cos(a) * s, vy: rand(0.02, 0.15), vz: Math.sin(a) * s, drag: 2.4, life: rand(1, 1.5), size: 0.25, size1: 0.8, tint: [0.62, 0.78, 0.95] }); }
}
// lightning: a strike from the sky onto p, with its splash
function strike(v, p, col, o) {
  o = o || {}; const tp = p.clone().setY(p.y + 0.15);
  v.bolt(tp.clone().add(V(rand(-0.8, 0.8), o.h || 8, rand(-0.8, 0.8))), tp, col, o.life || 0.25, { width: o.width || 0.08 });
  v.light(tp.clone().setY(tp.y + 1.5), col, o.light || 20, 0.25, 8);
  v.burst(tp, { n: o.n || 26, speed: 4.5, cols: [[1, 1, 1], col], size: 0.05, life: 0.55, shape: 1 });
  v.ring(tp, col, o.ring || 1.3, 0.35); v.decal(tp, col.map(c => c * 0.7), 0.9, 0.7);
}
// a ball of crackling plasma (the 疾雷 orb), for life seconds
function plasma(v, p, col, life, size) {
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(size || 0.45, 3), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uT: { value: rand(0, 9) }, uA: { value: 1 }, uC: { value: new THREE.Color(...col) } },
    vertexShader: `varying vec3 vP, vN, vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uA; uniform vec3 uC; varying vec3 vP, vN, vV; ${NOISE}
      void main(){ vec3 q = normalize(vP); float n = fbm(vec2(atan(q.z, q.x) * 2.0 + uT * 3.0, q.y * 3.0 - uT * 4.0) + floor(uT * 20.0) * 0.37);
        float ridge = pow(1.0 - abs(n * 2.0 - 1.0), 8.0); float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        vec3 c = uC * (0.3 + f * 1.4) + vec3(0.95) * ridge * 3.0; gl_FragColor = vec4(c, (0.25 + ridge + f * 0.6) * uA); }` }));
  orb.position.copy(p);
  return v.timed(orb, life, (k, dt, t) => {
    orb.material.uniforms.uT.value += dt; orb.material.uniforms.uA.value = Math.min(1, t * 6) * Math.min(1, (1 - k) * 4);
    orb.scale.setScalar(0.7 + 0.35 * Math.min(1, t * 5) + Math.sin(t * 40) * 0.05);
    if (Math.random() < 0.3) { const d = V(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.6, 1.2) * (size || 0.45) * 2.2); v.bolt(orb.position.clone(), orb.position.clone().add(d), col, 0.08, { width: 0.025, jag: 0.4 }); }
  });
}
// a spirit orb: a glow with a hot core, optionally trailing a ribbon while it moves
function orb(v, col, size) {
  const g = new THREE.Group(), halo = glowCard(v, col, size * 2.6), core = glowCard(v, [1, 1, 1], size);
  g.add(halo, core); g.userData = { halo, core }; return g;
}
const STORM = (v, at, n, w, h, tint, life) => { for (let i = 0; i < n; i++) v.smokePuff(at.x + rand(-w, w), at.y + rand(h, h + 1.5), at.z + rand(-w, w), { vx: rand(-0.3, 0.3), life: life || 3, size: 2.2, size1: 3.4, tint: tint || [0.12, 0.12, 0.17] }); };
const look = (ctx, p, o) => ctx.cam.shot(p, Object.assign({ dist: 10, pitch: 0.42, yaw: -0.25 }, o));   // a new framing mid-spell
const mid = cells => cells.reduce((s, c) => s.add(c), V(0, 0, 0)).multiplyScalar(1 / cells.length);

// ---------------------------------------------------------------- swords (林雲, 姬發)
// 萬劍訣: [ROM fx 2] shadows spread over the whole area with the original's first sound (1.6 s after the cast begins), then
// swords rain down into every cell (2.3-4 s) and a white flash (4.1 s); the shadows fade, the effect over at 5.2 s
async function swordStorm(ctx, col) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), F = 1.6, E = 5.23;
  await intro(ctx, col, { dur: 900, dist: 13, pitch: 0.5 });
  DARK(ctx, 0.4, 1, 0.85, 0.6);
  await ctx.until(F - 0.1);
  const sky = c0.clone().setY(c0.y + 4.6), L = E - ctx.now() - 0.3;
  const disc = v.runeCircle(sky, col, 3.4, L, { spin: 1.2, intensity: 1.6 }); disc.position.y = sky.y;
  v.light(sky, col, 35, L, 14);
  for (const c of cells) shadowDisc(v, c, 0.45, L, { grow: 0.9, a: 0.55 });
  ctx.cue();
  await ctx.until(F + 0.7);
  const drops = cells.flatMap(c => [c, c, c].map(() => c.clone().add(V(rand(-0.35, 0.35), 0, rand(-0.35, 0.35))))).sort(() => Math.random() - 0.5);
  drops.forEach((land, i) => {
    land.y = effectH(land.x, land.z);
    const st = land.clone().add(V(rand(-0.4, 0.4), 5.2, rand(-0.4, 0.4))), s = swordMesh(col, 0.8), rib = v.ribbon({ col, width: 0.06, n: 10 }), d = i * (1.6 / drops.length);
    v.timed(s, d + 1.3, (k, dt, t) => {
      if (t < d) { s.visible = false; return; } s.visible = true;
      const f = Math.min(1, (t - d) / 0.2), p = st.clone().lerp(land, f); s.position.copy(p); pointAlong(s, st.clone().sub(land));
      if (f < 1) rib.push(p.clone().add(st.clone().sub(land).normalize().multiplyScalar(0.9)));
      else if (!s.userData.hit) { s.userData.hit = 1; rib.end(); v.burst(land.clone().setY(land.y + 0.1), { n: 8, speed: 2.2, col, size: 0.05, life: 0.45 }); v.ring(land, col, 0.6, 0.3); if (i % 3 === 0) v.shake(0.05, 0.1); }
      if (t > d + 1.0) s.scale.setScalar(0.8 * Math.max(0.001, 1 - (t - d - 1.0) / 0.3));
    });
  });
  await ctx.until(F + 2.5);
  v.flash([0.85, 0.95, 1], 0.45); v.impact(c0, col, 1.3); v.ring(c0, col, 5, 0.8, { intensity: 1.2 }); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}
// 天劍訣 / 怒劍式: [ROM fx 3, 7] swords fan out into a spinning wheel over the target as soon as he has cast, then dive into it one after another from every side, one dive on each of the original's eight
// sounds (F s after the cast begins, data/spellsound.js apart), each strike flashing; a white flash after the last, the
// effect over at E
async function swordWheel(ctx, col, n, rounds, F, E) {
  const v = ctx.vfx, at = ctx.at.clone(), B = basis(ctx);
  await intro(ctx, col, { dur: 900, dist: 9.5, pitch: 0.36 });
  DARK(ctx, 0.5, 1, 0.85, 0.65);
  const T = ctx.now(), tr = ctx.track.length ? ctx.track : [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75], last = F + tr[tr.length - 1], W = last + 0.4 - T;   // (W: the wheel's time, to the last dive)
  const hub = at.clone().setY(at.y + 2.6), R = 1.5, swords = [];
  v.light(hub, col, 22, W, 8);
  const hubGlow = glowCard(v, col, 1.4); hubGlow.position.copy(hub); v.timed(hubGlow, W, (k, dt, t) => { hubGlow.material.opacity = Math.min(1, t * 2) * (0.6 + 0.2 * Math.sin(t * 20)) * (1 - k * k); });
  let spin = 0, spinV = 1;
  ticker(v, W, (k, dt, t) => { spinV = t < 1.2 ? 1 + t * 5 : 7; spin += dt * spinV; });
  cueAt(ctx, F);
  for (let i = 0; i < n; i++) {
    const s = swordMesh(col, 1.05), rib = v.ribbon({ col, width: 0.08, n: 14 }); swords.push(s);
    const a0 = i / n * Math.PI * 2, launch = F + tr[i % tr.length] - 0.22 - T, appear = i * 0.05;   // (a dive takes 0.22 s: it strikes on its sound)
    let from = null, hit = false;
    v.timed(s, launch + 0.5, (k, dt, t) => {
      if (t < appear) { s.visible = false; return; } s.visible = true;
      if (t < launch) {   // on the wheel: blades pointing outwards, the wheel in the camera's plane
        const a = a0 + spin, out = B.right.clone().multiplyScalar(Math.cos(a)).add(V(0, Math.sin(a), 0)), g = Math.min(1, (t - appear) / 0.25);
        s.position.copy(hub).add(out.clone().multiplyScalar(R * (0.3 + 0.7 * g))); pointAlong(s, out); s.scale.setScalar(1.05 * g + 0.01); from = s.position.clone();
        return;
      }
      const f = Math.min(1, (t - launch) / 0.22), tg = at.clone().setY(at.y + 0.5), ctrl = from.clone().add(from.clone().sub(hub).multiplyScalar(1.2));
      const p = bezier(from, ctrl, tg, ease(f)), nx = bezier(from, ctrl, tg, Math.min(1, ease(f) + 0.05));
      s.position.copy(p); pointAlong(s, p.clone().sub(nx)); rib.push(p);
      if (f >= 1 && !hit) { hit = true; s.visible = false; rib.end(); v.burst(tg, { n: 16, speed: 3.5, cols: [[1, 1, 1], col], size: 0.05, life: 0.45, shape: 1 }); v.ring(tg, col, 1.1, 0.25, { vertical: true, yaw: yawOf(facing(from, tg)), y: tg.y }); v.flash(col, 0.06); v.shake(0.06, 0.1); glowTargets(ctx, 0.6, 0.2); }
    });
  }
  await ctx.until(last + 0.1);
  v.flash([1, 1, 1], 0.5); v.impact(at, col, 1.5); v.decal(at, col, 1.5, 1.4, { intensity: 0.8 }); v.hitstop = 0.12;
  ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}
// 長虹貫日: [ROM fx 6] one sword streaks back and forth across the area like a rainbow, cutting every cell, until the
// original's one sound (4.13 s after the cast begins): a flash; the effect over at 5.1 s
async function rainbowDash(ctx) {
  const F = 4.13, E = 5.13;
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = Math.max(1.5, spreadOf(cells) + 1.2);
  const hues = [[0.7, 0.08, 0.08], [0.7, 0.45, 0.04], [0.15, 0.6, 0.12], [0.08, 0.3, 0.75], [0.4, 0.1, 0.65]], bright = hues.map(c => c.map(x => Math.min(1, x * 1.3 + 0.3)));
  await intro(ctx, [1, 0.95, 0.8], { dur: 800, dist: 12.5, pitch: 0.5 });
  DARK(ctx, 0.42, 0.9, 0.85, 0.75);
  const s = swordMesh([1, 0.95, 0.85], 0.95), passes = 6, pts = [];
  for (let i = 0; i <= passes; i++) { const a = i * (Math.PI * 4 / 5) + 0.3; pts.push(c0.clone().add(V(Math.cos(a) * R, 0.6 + (i % 2) * 0.25, Math.sin(a) * R))); }
  const ribs = hues.map((c, j) => [j, v.ribbon({ col: c, width: 0.08, n: 34, fade: 0.6, taper: 0.3 })]);
  const life = Math.max(1.56, F - 0.1 - ctx.now()), per = life / passes;   // (the passes fill the time to the sound)
  v.timed(s, life + 0.05, (k, dt, t) => {
    const i = Math.min(passes - 1, Math.floor(t / per)), f = Math.min(1, (t - i * per) / per), a = pts[i], b = pts[i + 1];
    const p = a.clone().lerp(b, ease(f)); s.position.copy(p); pointAlong(s, b.clone().sub(a).negate());
    const up = V(0, 1, 0); for (const [j, r] of ribs) r.push(p.clone().add(up.clone().multiplyScalar((j - 2) * 0.13)));
    for (const c of cells) if (!c.userData && c.distanceTo(p.clone().setY(c.y)) < 0.5) { c.userData = 1; v.burst(c.clone().setY(c.y + 0.5), { n: 12, speed: 3, cols: bright, size: 0.05, life: 0.5, g: 2 }); v.ring(c, [1, 0.95, 0.8], 0.7, 0.3); }
  }, () => { for (const [, r] of ribs) r.end(); s.visible = false; });
  ticker(v, life, () => {}); await ctx.until(F);
  // the sword dives into the middle of the area: a rainbow ring and a white flash
  v.flash([1, 1, 1], 0.55); v.shake(0.18, 0.3);
  bright.forEach((c, j) => v.ring(c0, c, 2.2 + j * 0.6, 0.8 + j * 0.06, { intensity: 1.2 }));
  for (const c of cells) v.burst(c.clone().setY(c.y + 0.4), { n: 10, speed: 3, cols: bright, size: 0.05, life: 0.6 });
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}

// ---------------------------------------------------------------- blades (黃天化)
const AMBER = [1, 0.7, 0.35];
// 地裂刀: [ROM fx 8] a broad blade plunges into the ground and the earth splits open under the target
async function earthSplit(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), cp = ctx.caster.pos.clone(), dir = facing(cp, at), stab = at.clone().sub(dir.clone().multiplyScalar(0.75)); stab.y = effectH(stab.x, stab.z);
  cueAt(ctx, 1.12);   // (the original's sound as the blade plunges, 1.12 s after the cast begins; over at 2.5 s)
  await intro(ctx, AMBER, { dur: 700, dist: 9, pitch: 0.4 });
  DARK(ctx, 0.35, 0.6, 0.8, 0.95);
  const s = swordMesh(AMBER, 1.7), top = stab.clone().setY(stab.y + 5);
  v.timed(s, 1.9, (k, dt, t) => {
    const f = Math.min(1, t / 0.3); s.position.copy(top).lerp(stab.clone().setY(stab.y - 0.7), f * f); pointAlong(s, V(0, 1, 0)); s.rotation.y = yawOf(dir);
    if (t > 1.6) s.scale.setScalar(1.7 * (1 - (t - 1.6) / 0.3));
  });
  await ctx.wait(300);
  v.shake(0.15, 0.3); v.ring(stab, AMBER, 1.6, 0.4); dustBurst(v, stab, 0.8);
  crack(v, stab, at.clone().add(dir.clone().multiplyScalar(0.6)), AMBER, 2.2, { open: 0.3, width: 0.16 });
  crack(v, at.clone().add(V(-0.4, 0, 0.3)), at.clone().add(V(0.5, 0, -0.3)), AMBER, 2, { open: 0.4 });
  await ctx.wait(350);
  // the ground bursts open: shards and a column of dust and dark earth
  v.shake(0.22, 0.4); v.flash([1, 0.75, 0.4], 0.15); v.hitstop = 0.08;
  shadowDisc(v, at, 0.7, 1.8, { grow: 0.15, a: 0.8 });
  for (let i = 0; i < 9; i++) { const r = rockMesh(rand(0.08, 0.17)), a = rand(0, 6.28); lob(v, r, at.clone().setY(at.y + 0.1), at.clone().add(V(Math.cos(a) * rand(0.8, 1.6), 0, Math.sin(a) * rand(0.8, 1.6))).setY(at.y), rand(1.4, 2.4), rand(0.6, 0.9), q => dustBurst(v, q, 0.3)); }
  for (let i = 0; i < 18; i++) v.smokePuff(at.x + rand(-0.3, 0.3), at.y + 0.1, at.z + rand(-0.3, 0.3), { vy: rand(2.5, 4.5), drag: 1.8, life: rand(1, 1.6), size: 0.4, size1: 1.1, tint: [0.36, 0.3, 0.24] });
  v.burst(at.clone().setY(at.y + 0.3), { n: 50, speed: 5, cols: [[1, 0.85, 0.5], AMBER, [0.5, 0.4, 0.3]], size: 0.06, life: 0.9, g: 9, up: 0.9 });
  v.light(at.clone().setY(at.y + 0.6), AMBER, 18, 0.5, 6); glowTargets(ctx, 0.7);
  ctx.hit(); await ctx.wait(1100); outro(ctx);
}
// 十字斬: [ROM fx 9] blades stand over the arms of the cross and drop in; the ground splits in a cross; two slashes of
// light cross over the middle
async function crossSlash(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], B = basis(ctx);
  await intro(ctx, AMBER, { dur: 750, dist: 10.5, pitch: 0.48 });
  DARK(ctx, 0.4, 0.6, 0.8, 0.95);
  const arms = cells.slice(1);
  arms.forEach((c, i) => {
    const s = swordMesh(AMBER, 1.0), top = c.clone().setY(c.y + 1.6);
    v.timed(s, 2.3, (k, dt, t) => {
      const g = Math.min(1, t / 0.25), drop = Math.max(0, Math.min(1, (t - 0.6 - i * 0.06) / 0.12));
      s.position.copy(top).setY(top.y - drop * 1.9 + Math.sin(t * 4 + i) * 0.04 * (1 - drop)); s.rotation.x = Math.PI; s.scale.setScalar(Math.max(0.01, g * (t > 2 ? 1 - (t - 2) / 0.3 : 1)));
      if (drop >= 1 && !s.userData.d) { s.userData.d = 1; v.burst(c.clone().setY(c.y + 0.1), { n: 12, speed: 2.5, col: AMBER, size: 0.05, life: 0.5 }); v.shake(0.05, 0.1); }
    });
  });
  await ctx.wait(800);
  for (const c of arms) crack(v, c, at, AMBER, 1.9, { open: 0.3, width: 0.15 });
  v.shake(0.14, 0.4); v.decal(at, AMBER, 1.4, 1.6, { intensity: 0.6 });
  await ctx.wait(350);
  // the cross slash: two arcs of light crossing over the middle
  for (const sgn of [-1, 1]) { const r = v.ribbon({ col: [1, 0.85, 0.55], width: 0.18, n: 18, fade: 0.35 }), r2 = v.ribbon({ col: [1, 1, 1], width: 0.05, n: 14 });
    ticker(v, 0.18, k => { const p = at.clone().add(B.right.clone().multiplyScalar((k - 0.5) * 3.2 * sgn)).add(V(0, 2 - k * 2.2 + 0.4, 0)); r.push(p); r2.push(p); }, () => { r.end(); r2.end(); }); await ctx.wait(140); }
  v.flash([1, 0.9, 0.7], 0.35); v.impact(at, AMBER, 1.3);
  for (const c of cells) { v.burst(c.clone().setY(c.y + 0.3), { n: 18, speed: 3.5, cols: [[1, 1, 1], AMBER], size: 0.05, life: 0.6 }); dustBurst(v, c, 0.5); }
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 御震刀法: [ROM fx 10] a great blade circles the target, then sweeps out in widening arcs over the area, the ground
// shaking under every pass, for as long as the original's (to its one sound, 5.85 s after the cast begins: a white flash;
// over at 6.75 s)
async function bladeOrbit(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], R = Math.max(1, spreadOf(cells)), F = 5.85, E = 6.75;
  await intro(ctx, AMBER, { dur: 800, dist: 12.5, pitch: 0.5 });
  DARK(ctx, 0.42, 0.6, 0.8, 0.95);
  const s = swordMesh([1, 0.8, 0.5], 1.5), rib = v.ribbon({ col: AMBER, width: 0.2, n: 30, fade: 0.4 }), core = v.ribbon({ col: [1, 1, 1], width: 0.05, n: 20 });
  const life = Math.max(2, F - ctx.now()), out = Math.max(1.2, life - 1.6);   // (out: the time its circles take to widen over the area)
  v.timed(s, life, (k, dt, t) => {
    const r = 0.8 + (R + 0.2) * Math.min(1, Math.max(0, (t - 0.5) / out)), a = t * 9, p = c0.clone().add(V(Math.cos(a) * r, 0.55 + Math.sin(t * 5) * 0.1, Math.sin(a) * r));
    s.position.copy(p); const tan = V(-Math.sin(a), 0, Math.cos(a)); pointAlong(s, V(Math.cos(a), 0.25, Math.sin(a))); s.rotateY(0.3); rib.push(p.clone().add(tan.multiplyScalar(-0.2))); core.push(p);
    for (const c of cells) if (!c.userData && t > 0.5 && c.distanceTo(p.clone().setY(c.y)) < 0.55) { c.userData = 1; v.ring(c, AMBER, 1.2, 0.4); dustBurst(v, c, 0.45); v.burst(c.clone().setY(c.y + 0.4), { n: 10, speed: 3, cols: [[1, 1, 1], AMBER], size: 0.05, life: 0.5 }); v.shake(0.06, 0.12); }
    if (k > 0.9) s.scale.setScalar(1.5 * (1 - (k - 0.9) * 10) + 0.01);
  }, () => { rib.end(); core.end(); });
  await ctx.until(F);
  v.flash([1, 0.9, 0.7], 0.4); v.ring(c0, AMBER, R * 2 + 2.5, 0.8, { intensity: 1.4 }); v.shake(0.2, 0.35);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.4; crack(v, c0, c0.clone().add(V(Math.cos(a) * (R + 0.6), 0, Math.sin(a) * (R + 0.6))), AMBER, 1.4, { open: 0.25 }); }
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 龍嘯九天: [ROM fx 11] blades whirl up around the target in a dragon's spiral and keep whirling, as long as the original's
// do (3.5 s), then pour back down onto it, the last on its one sound (5.63 s after the cast begins); over at 6.5 s
async function bladeCyclone(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), n = 14, col = [1, 0.78, 0.4], F = 5.63, E = 6.5;
  await intro(ctx, col, { dur: 900, dist: 10.5, pitch: 0.34 });
  DARK(ctx, 0.5, 0.6, 0.8, 0.95);
  const D = Math.max(1.9, F - 0.2 - (n - 1) * 0.03 - ctx.now());   // (D: until the first blade comes down)
  swirl(v, at, [1, 0.75, 0.4], 0.5, 1.6, 6, D + 0.3, { speed: 6, twist: 6, foam: [1, 0.95, 0.8], intensity: 0.6 });
  for (let w = 0; w < D - 1; w += 1.6) later(w * 1000, () => {   // the dragon's spiral climbs again and again while they whirl
    const dragon = v.ribbon({ col: [1, 0.6, 0.2], width: 0.28, n: 40, fade: 0.5 }), dcore = v.ribbon({ col: [1, 0.95, 0.7], width: 0.07, n: 30 });
    ticker(v, 1.7, (k, dt, t) => { const a = t * 7, r = 1.2 - k * 0.4; const p = at.clone().add(V(Math.cos(a) * r, 0.2 + k * 6, Math.sin(a) * r)); dragon.push(p); dcore.push(p); }, () => { dragon.end(); dcore.end(); });
  });
  v.light(at.clone().setY(at.y + 2), col, 24, D + 1, 9);
  for (let i = 0; i < n; i++) {
    const s = swordMesh(col, 0.75), rib = v.ribbon({ col, width: 0.06, n: 12 }), ph = i / n * 6.28, down = D + i * 0.03;
    let top = null, hit = false;
    v.timed(s, down + 0.4, (k, dt, t) => {
      if (t < down) { const f = Math.min(1, t / 1.7), a = ph + t * 6, r = 0.9 + f * 0.6; s.position.copy(at).add(V(Math.cos(a) * r, 0.2 + f * 2.8 + Math.sin(ph * 3 + t * 2) * 0.3, Math.sin(a) * r)); pointAlong(s, V(-Math.sin(a), 0.6, Math.cos(a))); top = s.position.clone(); rib.push(s.position); return; }   // (they whirl in view round the target, as the original's)
      const f = Math.min(1, (t - down) / 0.2), tg = at.clone().add(V(rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2))), p = top.clone().lerp(tg, f * f);
      s.position.copy(p); pointAlong(s, top.clone().sub(tg)); rib.push(p);
      if (f >= 1 && !hit) { hit = true; s.visible = false; rib.end(); v.burst(tg, { n: 10, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.4 }); v.shake(0.06, 0.1); }
    });
  }
  await ctx.until(F);
  v.flash([1, 0.9, 0.6], 0.5); v.impact(at, col, 1.6); v.ring(at, col, 4, 0.8, { intensity: 1.2 }); dustBurst(v, at, 1.2); glowTargets(ctx, 0.9);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- arrows (黃飛虎)
// 氣動箭 / 狂飆箭: [ROM fx 13, 17] arrows loosed into the sky drop into every cell of the cross and stick, the first on
// the original's one sound (3.02 s after the cast begins), and a whirlwind rises out of each (4.2-5.3 s); over at 6.8 s
async function arrowVolley(ctx, col, wind) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], a = ctx.caster, F = 3.02, E = 6.78;
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  await channel(ctx, col, F - 0.8);   // (an arrow is 0.8 s from the bow to the ground)
  cueAt(ctx, F);
  ctx.pose(null); a.act = { kind: 'atk', frame: 1 };
  const from = a.chest().add(V(0, 0.3, 0));
  const sticks = [];
  cells.forEach((c, i) => later(i * 90, () => {
    const g = arrowMesh(col, 0.6), rib = v.ribbon({ col, width: 0.06, n: 16 }), land = c.clone().add(V(rand(-0.15, 0.15), 0.25, rand(-0.15, 0.15))), up = from.clone().add(V(rand(-0.4, 0.4), 6.5, rand(-0.4, 0.4)));
    for (const m of g.userData.glow) m.material.opacity = 0.5;
    const life = E - 0.3 - ctx.now();   // (they stand in the ground to the end)
    v.timed(g, life, (k, dt, t) => {
      const f = Math.min(1, t / 0.8);
      const p = f < 0.45 ? from.clone().lerp(up, ease(f / 0.45)) : up.clone().lerp(land, ((f - 0.45) / 0.55) ** 2), nx = f < 0.45 ? up : land;
      if (f < 1) { g.position.copy(p); pointAlong(g, nx.clone().sub(p)); rib.push(p); if (Math.random() < 0.6) v.flame(p.x, p.y, p.z, { size: 0.18, asp: 1.3, life: 0.25, tint: col.map(x => x * 1.2) }); }
      else if (!g.userData.l) { g.userData.l = 1; rib.end(); pointAlong(g, V(0.15, -1, 0.1)); g.position.copy(land); v.burst(land, { n: 10, speed: 2, col, size: 0.05, life: 0.4 }); v.shake(0.04, 0.08); }
      if (t > life - 0.3) g.scale.setScalar(0.6 * Math.max(0, (life - t) / 0.3) + 0.001);
    });
  }));
  later(250, () => { a.act = null; });
  await ctx.until(F + 1.15);
  for (const c of cells) swirl(v, c, wind, 0.25, 0.85, 2.6, 1.5, { speed: 6, twist: 5, sway: true, foam: wind.map(x => x * 0.5 + 0.5), intensity: 0.55, normal: true });
  for (const c of cells) for (let i = 0; i < 18; i++) later(i * 40, () => { const ang = rand(0, 6.28), r = rand(0.2, 0.6); v.spark(c.x + Math.cos(ang) * r, c.y + rand(0.05, 0.4), c.z + Math.sin(ang) * r, { vy: rand(1.2, 2.2), life: 0.9, size: 0.05, r: wind[0], gg: wind[1], b: wind[2], shape: 1, orb: { x: c.x, z: c.z, w: rand(7, 11) } }); });
  v.ring(c0, wind, 2.6, 0.6); glowTargets(ctx, 0.7, 1);
  await ctx.wait(500); ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}
// 萬箭穿心: [ROM fx 14] the world goes dark, a whirlwind takes the target and arrows fly through it from every side,
// from the original's first sound (1.57 s after the cast begins) for 3 s, a whine with each; a white flash (4.67 s), then
// whirlwinds break out over the whole area; over at 6.1 s
async function arrowStorm(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], col = [1, 0.75, 0.4], wind = [0.45, 0.7, 0.85], F = 1.57, E = 6.12;
  await intro(ctx, col, { dur: 700, dist: 10, pitch: 0.42 });
  await ctx.until(F - 0.3);
  DARK(ctx, 0.75, 0.95, 0.85, 0.7);
  const L = F + 3.1 - ctx.now();   // (to the flash)
  swirl(v, at, wind, 0.4, 1.2, 3.6, L, { speed: 6, twist: 5, sway: true, intensity: 0.6, normal: true });
  const N = Math.round((L - 0.45) / 0.055); cueAt(ctx, F);
  for (let i = 0; i < N; i++) later(140 + i * 55, () => {
    const a = rand(0, 6.28), e = rand(-0.2, 0.5), d = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), c = at.clone().setY(at.y + rand(0.3, 1.3));
    const from = c.clone().add(d.clone().multiplyScalar(5)), to = c.clone().sub(d.clone().multiplyScalar(5)), g = arrowMesh(col, 0.5), rib = v.ribbon({ col, width: 0.04, n: 12 });
    pointAlong(g, to.clone().sub(from));
    v.timed(g, 0.32, k => { g.position.copy(from).lerp(to, k); rib.push(g.position); }, () => { rib.end(); g.visible = false; });
    later(160, () => { v.burst(c, { n: 5, speed: 2, col, size: 0.04, life: 0.3, g: 0 }); });
  });
  ticker(v, L, () => { for (const a of tgts(ctx)) a.flash = Math.random() < 0.4 ? 0.6 : 0; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.until(F + 3.1);
  v.flash([0.9, 0.95, 1], 0.4); v.shake(0.16, 0.3); DARK(ctx, 0.3, 0.95, 0.85, 0.7);
  for (const c of cells) swirl(v, c, wind, 0.3, 0.9, 2.8, 1.3, { speed: 7, twist: 5, sway: true, intensity: 0.5, normal: true });
  v.ring(at, wind, spreadOf(cells) * 2 + 2, 0.7);
  ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}
// 颶風矢: [ROM fx 15] three arrows fly with the original's first sound (2.13 s after the cast begins); a towering
// water-blue cyclone lifts the target, spins it high and drops it, slamming down on the second (4.23 s); over at 5.3 s
async function hurricane(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [0.5, 0.85, 1], c = ctx.caster.chest(), B = basis(ctx), F = 2.13, E = 5.27;
  await intro(ctx, col, { dur: 600, dist: 10, pitch: 0.4, yaw: -0.5 });
  await channel(ctx, col, F); ctx.cue();
  ctx.pose(null); ctx.caster.act = { kind: 'atk', frame: 2 };
  const tg = at.clone().setY(at.y + 0.6);
  for (let i = -1; i <= 1; i++) {
    const g = arrowMesh(col, 0.7), rib = v.ribbon({ col, width: 0.07, n: 16 }), off = B.right.clone().multiplyScalar(i * 0.5).add(V(0, i * 0.15, 0));
    v.timed(g, 0.4, k => { const p = bezier(c, c.clone().lerp(tg, 0.5).add(off), tg, k); g.position.copy(p); pointAlong(g, tg.clone().sub(p)); rib.push(p); }, () => { rib.end(); g.visible = false; });
  }
  await ctx.wait(400); ctx.caster.act = null;
  v.impact(tg, col, 0.9);
  const a = tgts(ctx)[0];
  swirl(v, at, [0.2, 0.55, 0.9], 0.6, 1.3, 5.5, 2.6, { speed: 7, twist: 6, foam: [0.85, 0.95, 1], intensity: 0.75, normal: true });
  swirl(v, at, [0.5, 0.8, 1], 0.4, 0.9, 6, 2.6, { speed: -8, twist: 3, intensity: 0.35 });
  for (let i = 0; i < 60; i++) later(i * 35, () => { const ang = rand(0, 6.28), r = rand(0.5, 1.4); v.spark(at.x + Math.cos(ang) * r, at.y + rand(0.1, 3), at.z + Math.sin(ang) * r, { vy: rand(2, 4), life: 1, size: 0.06, r: 0.8, gg: 0.95, b: 1, shape: 1, orb: { x: at.x, z: at.z, w: 9 } }); });
  const face0 = a ? a.u.facing : null, S = F + (ctx.track[1] || 2.1), drop = S - 0.25 - ctx.now();   // (S: the slam, on the second sound; it falls for 0.25 s)
  if (a) ticker(v, drop + 0.55, (k, dt, t) => { a.lift = t < drop ? ease(Math.min(1, t / 1.2)) * 2.6 : 2.6 * (1 - ((t - drop) / 0.25) ** 2); a.lift = Math.max(0, a.lift); a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 16) % 4]; },
    () => { a.lift = 0; a.u.facing = face0; });
  await ctx.until(S);
  v.flash([0.85, 0.95, 1], 0.55); v.shake(0.25, 0.4); v.ring(at, col, 4, 0.7); dustBurst(v, at, 1); v.hitstop = 0.1;
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- fists (土行孫)
const FIRE = [1, 0.55, 0.2];
// 裂爆拳: [ROM fx 18] he winds up and punches; the blow bursts on the target in a ball of fire
async function burstFist(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), a = ctx.caster, dir = facing(a.pos, at);
  await intro(ctx, FIRE, { dur: 700, dist: 8.5, pitch: 0.38 });
  ctx.pose(null);
  for (const f of [0, 1]) { a.act = { kind: 'atk', frame: f }; await ctx.wait(140); }
  a.act = { kind: 'atk', frame: 2 };
  const from = a.chest().add(dir.clone().multiplyScalar(0.4)), tg = at.clone().setY(at.y + 0.55);
  const fist = v.fireball(0.28, { heat: 1.3 }), rib = v.ribbon({ col: FIRE, width: 0.22, n: 14 });
  v.ring(from, FIRE, 1.1, 0.3, { vertical: true, yaw: yawOf(dir), y: from.y });
  v.timed(fist, 0.25, (k, dt, t) => { fist.userData.mat.uniforms.uT.value = t; fist.position.copy(from).lerp(tg, k); rib.push(fist.position); }, () => { rib.end(); fist.visible = false; });
  await ctx.wait(250);
  v.explode(tg, 0.7, { n: 22 }); v.flash([1, 0.7, 0.4], 0.3); v.shake(0.22, 0.35); v.hitstop = 0.12;
  for (let i = 0; i < 3; i++) later(i * 70, () => v.ring(tg, i ? FIRE : [1, 1, 1], 1.4 + i * 0.6, 0.35, { vertical: true, yaw: yawOf(dir), y: tg.y }));
  v.burst(tg, { n: 70, speed: 6, cols: [[1, 0.95, 0.7], FIRE, [1, 0.3, 0.05]], size: 0.07, life: 0.9, g: 5 });
  v.light(tg, FIRE, 30, 0.6, 7); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(300); a.act = null; await ctx.wait(800); outro(ctx);
}
// 五氣朝元: [ROM fx 19] five orbs of qi gather over him, fly to the cells of the cross and bloom into blue spirit fire,
// the first on the original's first sound (3.5 s after the cast begins), blooming on to 5 s; over at 5.7 s
async function fiveQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), col = [0.5, 0.8, 1], c = ctx.caster.chest(), F = 3.5, E = 5.67;
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  const H = Math.max(0.7, F - 0.5 - ctx.now());   // (they circle him until the first flies, 0.5 s before it lands)
  cueAt(ctx, F);
  const orbs = cells.map((cell, i) => {
    const o = orb(v, col, 0.32), rib = v.ribbon({ col, width: 0.1, n: 18 }), hold = H + i * 0.12;
    let from = null, done = false;
    v.timed(o, hold + 0.6, (k, dt, t) => {
      if (t < hold) { const a = t * 4 + i / cells.length * 6.28, r = 0.8; o.position.copy(c).add(V(Math.cos(a) * r, 1 + Math.sin(t * 5 + i) * 0.15, Math.sin(a) * r)); o.scale.setScalar(Math.min(1, t * 3)); from = o.position.clone(); return; }
      const f = Math.min(1, (t - hold) / 0.5), tg = cell.clone().setY(cell.y + 0.35), p = bezier(from, from.clone().lerp(tg, 0.5).add(V(0, 2.2, 0)), tg, ease(f));
      o.position.copy(p); rib.push(p);
      if (f >= 1 && !done) { done = true; o.visible = false; rib.end();
        v.ring(cell, col, 1.2, 0.4); v.burst(tg, { n: 18, speed: 2.5, cols: [[1, 1, 1], col], size: 0.05, life: 0.6, g: 0 });
        ticker(v, 1.6, kk => { for (let j = 0; j < 2; j++) v.flame(cell.x + rand(-0.3, 0.3), cell.y, cell.z + rand(-0.3, 0.3), { size: rand(0.35, 0.55) * (1 - kk * 0.5), asp: 2, life: 0.5, vy: rand(0.8, 1.6), tint: [0.25, 0.6, 1.8] }); });
        v.pillar(cell, col, 0.35, 2.4, 1.2, { intensity: 0.5, grow: 1 }); v.light(tg, col, 12, 0.6, 5);
      }
    });
    return o;
  });
  await ctx.until(F + 0.9);
  v.flash([0.7, 0.85, 1], 0.25); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 地裂天崩: [ROM fx 20] he sinks into the earth; with the original's first sound (2.47 s after the cast begins) a flash, the
// land goes dark and splits; on its third (3.93 s) fire bursts out of every crack, wave on wave to 5.4 s; over at 6.1 s
async function quake(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), a = ctx.caster, R = spreadOf(cells) + 0.8, F = 2.47, E = 6.08;
  await intro(ctx, FIRE, { dur: 600, dist: 12.5, pitch: 0.5 });
  ctx.pose(null); a.act = { kind: 'pose', row: 2, base: 3 };
  dustBurst(v, a.pos, 0.8);
  const sink = Math.max(0.5, F - ctx.now());
  await new Promise(res => ticker(v, sink, k => { a.lift = -k * 0.9; a.fade = 1 - k; }, res));
  ctx.cue(); v.flash([1, 0.85, 0.6], 0.2);
  DARK(ctx, 0.8, 0.6, 0.75, 0.9);
  const B = F + (ctx.track[2] || 1.47);   // (the bursts, on the third sound)
  v.shake(0.12, B + 1.4 - ctx.now());
  for (let i = 0; i < 7; i++) { const ang = i / 7 * 6.28 + rand(-0.2, 0.2); crack(v, c0, c0.clone().add(V(Math.cos(ang) * R, 0, Math.sin(ang) * R)), FIRE, B + 1.8 - ctx.now(), { open: 0.6, width: 0.14 }); }
  await ctx.until(B);
  for (let w = 0; w < 3; w++) cells.forEach((c, i) => later(w * 500 + i * 70 + rand(0, 60), () => {
    v.explode(c.clone().setY(c.y + 0.35), 0.6 - w * 0.1, { n: 12, smoke: (i + w) % 2 === 0 }); v.light(c, FIRE, 14, 0.25, 5);
    if (w === 0) for (let j = 0; j < 2; j++) { const r = rockMesh(rand(0.1, 0.18)), d = V(rand(-1, 1), 0, rand(-1, 1)); lob(v, r, c.clone().setY(c.y + 0.2), c.clone().add(d).setY(c.y), rand(1.2, 2.2), 0.7); }
  }));
  await ctx.wait(cells.length * 70 + 300);
  v.flash([1, 0.75, 0.45], 0.5); v.shake(0.3, 0.5); v.ring(c0, FIRE, R * 2 + 2, 0.8); glowTargets(ctx, 0.9);
  ctx.hit();
  await ctx.until(E - 0.75);
  await new Promise(res => ticker(v, 0.45, k => { a.lift = -(1 - k) * 0.9; a.fade = k; }, () => { a.lift = 0; a.fade = 1; res(); }));
  a.act = null; dustBurst(v, a.pos, 0.6);
  await ctx.until(E - 0.1); outro(ctx);
}
// 昇龍拳: [ROM fx 21] he leaps; a dragon of fire bursts up out of the ground under the target and climbs to the sky,
// then falls back on it as a fireball, striking on the original's one sound (3.12 s after the cast begins); over at 5 s
async function risingDragon(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), a = ctx.caster, F = 3.12, E = 4.98;
  await intro(ctx, FIRE, { dur: 600, dist: 10, pitch: 0.32 });
  ctx.pose(null); a.act = { kind: 'atk', frame: 2 };
  await new Promise(res => ticker(v, 0.35, k => { a.lift = Math.sin(k * Math.PI) * 0.9; }, () => { a.lift = 0; res(); }));
  crack(v, at.clone().add(V(-0.5, 0, 0.2)), at.clone().add(V(0.5, 0, -0.2)), FIRE, 2.6, { open: 0.15 });
  v.shake(0.15, 0.3);
  const rib = v.ribbon({ col: [1, 0.45, 0.1], width: 0.45, n: 36, fade: 0.5 }), core = v.ribbon({ col: [1, 0.9, 0.6], width: 0.12, n: 28 });
  ticker(v, 0.9, (k, dt, t) => {
    const ang = t * 11, r = 0.45 * (1 - k * 0.5), p = at.clone().add(V(Math.cos(ang) * r, 0.2 + ease(k) * 9, Math.sin(ang) * r)); rib.push(p); core.push(p);
    for (let i = 0; i < 3; i++) v.flame(at.x + rand(-0.3, 0.3), at.y, at.z + rand(-0.3, 0.3), { size: rand(0.6, 0.9) * (1 - k * 0.4), asp: 3, life: 0.45, vy: rand(4, 6) });
    v.light(at.clone().setY(at.y + 1.5), FIRE, 25, 0.06, 8);
  }, () => { rib.end(); core.end(); });
  glowTargets(ctx, 0.7, 0.9);
  await ctx.wait(1000); await ctx.until(F - 0.45);
  const ball = v.fireball(0.55, { heat: 1.3 }), from = at.clone().setY(at.y + 9), tg = at.clone().setY(at.y + 0.4), tail = v.ribbon({ col: FIRE, width: 0.45, n: 18 });
  v.timed(ball, 0.45, (k, dt, t) => { ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); }, () => { tail.end(); ball.visible = false; });
  await ctx.wait(450);
  v.explode(tg, 0.9, { n: 26 }); v.flash([1, 0.7, 0.4], 0.45); v.shake(0.25, 0.4); v.hitstop = 0.12; v.ring(at, FIRE, 4, 0.8); v.decal(at, [1, 0.35, 0.06], 1.6, 2, { flicker: true });
  ticker(v, 0.9, k => { for (let i = 0; i < 2; i++) v.realFire(at.x + rand(-0.4, 0.4), at.y, at.z + rand(-0.4, 0.4), { size: rand(0.7, 1.1) * (1 - k * 0.6), asp: rand(1.3, 1.7), life: rand(0.4, 0.6), vy: rand(1.5, 3) }); });   // (the fire burns on, as the original's)
  ctx.hit(); await ctx.wait(400); a.act = null; await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- fire
// 煉獄之火: [ROM fx 24] with the original's first sound (2 s after the cast begins) the whole area becomes a sea of fire,
// rows of fireballs bursting across it in waves until 6.2 s; over at 7 s
async function inferno(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), F = 2.0, E = 6.98;
  await intro(ctx, FIRE, { dur: 800, dist: 13, pitch: 0.48 });
  await channel(ctx, FIRE, F); ctx.cue();
  DARK(ctx, 0.55, 0.25, 0.6, 0.85);
  const L = 6.25 - ctx.now();   // (the sea burns to 6.2 s)
  for (const c of cells) v.decal(c, [1, 0.3, 0.05], 0.8, L + 0.2, { flicker: true, intensity: 0.8 });
  ticker(v, L, (k) => { if (Math.random() < 0.6) { const c = cells[(Math.random() * cells.length) | 0]; v.realFire(c.x + rand(-0.3, 0.3), c.y - 0.05, c.z + rand(-0.3, 0.3), { size: rand(1.05, 1.47) * (k < 0.9 ? 1 : (1 - k) * 10), asp: rand(1.3, 1.7), life: rand(0.5, 0.8), vy: rand(0.2, 0.6) }); } });
  v.light(c0.clone().setY(c0.y + 1.5), FIRE, 30, L, 12);
  await ctx.wait(300);
  for (let w = 0; ctx.now() < 5.6; w++) {
    const order = cells.slice().sort((a, b) => (a.x + a.z) - (b.x + b.z));
    order.forEach((c, i) => later(i * 35, () => { v.explode(c.clone().setY(c.y + 0.4), 0.55, { n: 10, smoke: (i + w) % 3 === 0 }); v.light(c, FIRE, 8, 0.25, 4); }));
    v.shake(0.12, 0.3); v.flash([1, 0.6, 0.3], 0.18);
    if (w === 1) { glowTargets(ctx, 0.9, 0.8); ctx.hit(); }
    await ctx.wait(Math.max(order.length * 35 + 250, 650));
  }
  await ctx.until(E - 0.2); outro(ctx);
}
// 天火燎原: [ROM fx 25] night falls; a single flame drops from the sky onto the target, a white flash, a rain of
// sparks, and fire runs out over the plain all around
async function skyFire(ctx) {
  const v = ctx.vfx, at = ctx.at.clone();
  cueAt(ctx, 1.65);   // (the original's first sound as the flame drops, 1.65 s after the cast begins; over at 4.3 s)
  await intro(ctx, FIRE, { dur: 800, dist: 12, pitch: 0.42 });
  DARK(ctx, 0.75, 0.95, 0.8, 0.55);
  const from = at.clone().setY(at.y + 10), tg = at.clone().setY(at.y + 0.3), ball = v.fireball(0.4, { heat: 1.3 }), tail = v.ribbon({ col: FIRE, width: 0.35, n: 22 });
  v.timed(ball, 0.9, (k, dt, t) => { ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); v.realFire(ball.position.x, ball.position.y, ball.position.z, { size: 0.70, asp: 1.5, life: 0.3, vy: 1 }); v.light(ball.position, FIRE, 20, 0.06, 8); }, () => { tail.end(); ball.visible = false; });
  await ctx.wait(900);
  v.flash([1, 1, 1], 0.7); v.shake(0.25, 0.4); v.hitstop = 0.1; v.explode(tg, 0.8, { n: 24 }); glowTargets(ctx, 1, 0.8);
  for (let i = 0; i < 80; i++) later(i * 18, () => v.spark(at.x + rand(-3, 3), at.y + rand(3, 5), at.z + rand(-3, 3), { vy: -rand(2, 4), g: 2, life: 1.2, size: rand(0.06, 0.12), r: 1, gg: rand(0.7, 0.95), b: 0.5, shape: 1, flicker: 1, ph: rand(0, 9), floor: at.y + 0.05 }));
  ctx.hit();
  // the prairie fire: a ring of flames running outwards, leaving the ground burning
  ticker(v, 1.6, (k) => {
    const r = 0.5 + k * 3.2;
    for (let i = 0; i < 6; i++) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r, z = at.z + Math.sin(ang) * r; v.realFire(x, effectH(x, z) - 0.05, z, { size: rand(0.56, 0.98) * (1 - k * 0.3), asp: 1.5, life: rand(0.4, 0.7), vy: 0.4 }); }
    if (Math.random() < 0.3) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r * 0.7, z = at.z + Math.sin(ang) * r * 0.7; v.decal(V(x, 0, z), [1, 0.3, 0.05], 0.5, 1.5, { flicker: true, intensity: 0.6 }); }
  });
  v.ring(at, FIRE, 7, 1.6, { intensity: 1 });
  await ctx.wait(1700); outro(ctx);
}

// ---------------------------------------------------------------- ice
const ICEC = [0.55, 0.85, 1];
// 裂冰術: [ROM fx 27] with the original's first sound (1.45 s after the cast begins) sparkles gather into an orb of ice
// over the target; it splits, flies to each cell of the cross and bursts into crystals on its second (3.15 s); over at 4.4 s
async function iceSplit(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], mat = ICE(), F = 1.45, E = 4.42;
  await intro(ctx, ICEC, { dur: 700, dist: 10.5, pitch: 0.46 });
  DARK(ctx, 0.35, 0.9, 0.5, 0.2);
  await ctx.until(F); ctx.cue();
  const hub = at.clone().setY(at.y + 2.2), S = F + (ctx.track[1] || 1.7) - 0.45, G = Math.max(1, S - ctx.now());   // (S: it splits, 0.45 s before the crystals burst on the second sound)
  for (let i = 0; i < 40 + G * 20; i++) later(i * 15, () => { const p = hub.clone().add(V(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))); v.spark(p.x, p.y, p.z, { seek: { x: hub.x, y: hub.y, z: hub.z, k: 5 }, life: 0.6, size: rand(0.06, 0.12), r: 0.85, gg: 0.95, b: 1, shape: 1, flicker: 1, ph: rand(0, 9) }); });
  const big = new THREE.Mesh(chunkGeometry(), mat); big.position.copy(hub); big.scale.setScalar(0.01);
  v.timed(big, G, (k, dt, t) => { big.scale.setScalar(0.01 + 0.5 * ease(Math.min(1, t / 0.7))); big.rotation.y += dt * 2; big.rotation.x += dt; big.position.y = hub.y + Math.sin(t * 2.5) * 0.12; });
  await ctx.until(S);
  v.flash([0.8, 0.95, 1], 0.12); v.burst(hub, { n: 30, speed: 3, cols: ICE_COLS, size: 0.06, life: 0.6, g: 0 });
  cells.forEach((c, i) => {
    const o = new THREE.Mesh(chunkGeometry(), mat); o.scale.setScalar(0.28); const tg = c.clone().setY(c.y + 0.3), rib = v.ribbon({ col: ICEC, width: 0.14, n: 16 });
    v.timed(o, 0.45, (k, dt) => { o.position.copy(bezier(hub, hub.clone().lerp(tg, 0.5).add(V(0, 0.8, 0)), tg, k * k)); o.rotation.y += dt * 6; rib.push(o.position); }, () => { rib.end(); o.visible = false; crystals(v, c, 6, 0.8, 0.9, mat); v.ring(c, ICEC, 1.2, 0.4); v.shake(0.06, 0.1); });
  });
  await ctx.wait(450); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 風雪冰天: [ROM fx 28] with the original's first sound (1.43 s after the cast begins) the sky darkens and a blizzard
// sweeps over the area; on its second (3.12 s) frost spreads and freezes everything, on its third (4.8 s) the ice
// bursts; over at 5.9 s
async function blizzard(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), mat = ICE(), F = 1.43, E = 5.9, tr = ctx.track.length > 2 ? ctx.track : [0, 1.68, 3.37];
  await intro(ctx, ICEC, { dur: 700, dist: 13, pitch: 0.48 });
  await ctx.until(F); ctx.cue();
  DARK(ctx, 0.7, 1, 0.7, 0.35);
  const B = basis(ctx), wind = B.right.clone().multiplyScalar(-5);
  ticker(v, F + tr[2] + 0.2 - ctx.now(), (k) => {
    for (let i = 0; i < 14; i++) v.spark(c0.x + rand(-6, 6) - wind.x * 0.4, c0.y + rand(0.2, 5), c0.z + rand(-6, 6) - wind.z * 0.4, { vx: wind.x * rand(0.8, 1.3), vy: -rand(0.8, 1.6), vz: wind.z * rand(0.8, 1.3) + rand(-0.5, 0.5), life: rand(0.8, 1.4), size: rand(0.05, 0.11), r: 0.92, gg: 0.96, b: 1, a: 0.9, shape: 1, wob: 1.5, ph: rand(0, 6) });
    if (Math.random() < 0.18) v.smokePuff(c0.x + rand(-4, 4), c0.y + rand(0.3, 1.2), c0.z + rand(-4, 4), { vx: wind.x * 0.5, vz: wind.z * 0.5, life: 1.4, size: 0.7, size1: 1.6, tint: [0.8, 0.9, 1] });
  });
  await ctx.until(F + tr[1]);
  const H = F + tr[2] - ctx.now();   // (the crystals stand until the third sound, then burst)
  cells.forEach((c, i) => later(i * 50, () => { v.decal(c, [0.5, 0.75, 1], 0.7, H + 0.8, { intensity: 0.7 }); crystals(v, c, 5, 0.65, H - i * 0.05, mat); }));
  await ctx.wait(cells.length * 50 + 300);
  glowTargets(ctx, 0.8, 0.9); ctx.hit();
  await ctx.until(F + tr[2]);
  v.flash([0.85, 0.95, 1], 0.3); v.shake(0.14, 0.3); v.ring(c0, ICEC, spreadOf(cells) * 2 + 2, 0.7);
  await ctx.until(E - 0.1); outro(ctx);
}
// 崩冰術: [ROM fx 29] under a night sky, boulders of ice crash onto the target one after another from the original's first
// sound (2.32 s after the cast begins) to 5 s, then a huge block of ice closes over it (5.2 s) and shatters (5.7 s);
// over at 6.9 s
async function iceAvalanche(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), mat = ICE(), F = 2.32, E = 6.93;
  await intro(ctx, ICEC, { dur: 800, dist: 10.5, pitch: 0.38 });
  await channel(ctx, ICEC, F - 0.6);
  DARK(ctx, 0.65, 1, 0.75, 0.4);
  await ctx.until(F - 0.42); cueAt(ctx, F);   // (a boulder falls for 0.42 s: the first lands on the sound)
  for (let i = 0; i < 11; i++) later(i * 260, () => {
    const r = rand(0.35, 0.55), m = new THREE.Mesh(chunkGeometry(), mat); m.scale.setScalar(r); const off = V(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
    lob(v, m, at.clone().add(off).add(V(rand(-2, 2), 8, rand(-1, 1))), at.clone().add(off).setY(at.y + r * 0.6), 0, 0.42, (p) => {
      v.burst(p, { n: 34, speed: 5, cols: ICE_COLS, size: 0.07, life: 0.8, g: 9 }); v.shake(0.1, 0.15); v.flash([0.8, 0.9, 1], 0.08); v.ring(at, ICEC, 1.6, 0.35); glowTargets(ctx, 0.6, 0.3);
      shatter(v, p, 7, mat, { size: 0.2, speed: 2.6 }); frost(v, at, 1.2, 2.4);
    }, { fall: true });
  });
  await ctx.until(F + 2.85);
  // the block: an ice prism closing over the target
  const block = new THREE.Mesh(shardGeometry(6, 0.22), mat); block.position.copy(at).setY(at.y - 0.05);   // (a great crystal closing over the target)
  v.timed(block, 1.1, (k, dt, t) => { const g = Math.min(1, t / 0.18), sw = t > 0.95 ? 1 + (t - 0.95) * 2 : 1; block.scale.set(0.72 * sw, 2.1 * g * sw + 0.001, 0.72 * sw); },
    () => { v.burst(at.clone().setY(at.y + 0.9), { n: 120, speed: 7, cols: ICE_COLS, size: 0.08, life: 1.1, g: 9 }); v.flash([0.9, 0.97, 1], 0.45); v.shake(0.22, 0.35); v.hitstop = 0.12;
      shatter(v, at.clone().setY(at.y + 0.9), 16, mat, { size: 0.3, speed: 3.4 }); frost(v, at, 1.8, 2.6); });
  v.decal(at, [0.5, 0.75, 1], 1.4, 2, { intensity: 0.8 });
  ticker(v, 1.1, () => { for (const a of tgts(ctx)) a.flash = 0.35; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.wait(1150); ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- thunder (雷震子)
const BOLT = [0.7, 0.8, 1];
// 五雷咒: [ROM fx 31] balls of lightning hang over the cells of the cross; bolts strike them one by one, one on each of the
// original's twelve sounds (the first 1.43 s after the cast begins, 0.35 s apart), round the cross again and again, the
// middle last; over at 6 s
async function fiveThunder(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], F = 1.43, E = 6.02, tr = ctx.track.length ? ctx.track : [...Array(12).keys()].map(i => i * 0.35);
  await intro(ctx, BOLT, { dur: 700, dist: 11, pitch: 0.4 });
  await ctx.until(F - 0.6);
  const L = F + tr[tr.length - 1] - ctx.now();   // (to the last strike)
  DARK(ctx, 0.62, 0.9, 0.85, 0.6); STORM(v, at, 20, 3, 6.5, null, L + 0.8);
  const order = cells.slice(1).concat([at]);
  for (const c of order) plasma(v, c.clone().setY(c.y + 2.2), BOLT, L + 0.1, 0.32);
  for (let i = 0; i < tr.length; i++) {
    await ctx.until(F + tr[i]); if (i === 0) ctx.cue();
    const last = i === tr.length - 1, c = last ? at : order[i % order.length];
    strike(v, c, BOLT, { width: last ? 0.16 : 0.09, ring: last ? 2 : 1.2 }); v.flash([0.85, 0.9, 1], last ? 0.3 : 0.12); v.shake(last ? 0.16 : 0.07, 0.2);
    if (last) { v.impact(c, BOLT, 1.3); plasma(v, c.clone().setY(c.y + 0.5), BOLT, 0.9, 0.5); glowTargets(ctx, 0.9); ctx.hit(); }
  }
  await ctx.until(E - 0.1); outro(ctx);
}
// 天雷破: [ROM fx 32] a storm cloud drifts over the area, bolts raining onto its cells, two or three on each of the
// original's sixteen sounds (the first 1.37 s after the cast begins, 0.35 s apart), then all strike at once on the last;
// over at 7.3 s
async function thunderStorm(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 1, F = 1.37, E = 7.3, tr = ctx.track.length ? ctx.track : [...Array(16).keys()].map(i => i * 0.35);
  await intro(ctx, BOLT, { dur: 700, dist: 13, pitch: 0.42 });
  await ctx.until(F - 0.5);
  const L = F + tr[tr.length - 1] - ctx.now();
  DARK(ctx, 0.72, 0.85, 0.85, 0.65); STORM(v, c0, 40, R + 1, 6.5, null, L + 1);
  v.rain(c0, L + 0.6, { n: 400 });
  for (let i = 0; i < tr.length - 1; i++) {
    await ctx.until(F + tr[i]); if (i === 0) ctx.cue();
    for (let j = 0; j < 1 + (i % 2) + (i % 5 === 0 ? 1 : 0); j++) later(j * 70, () => { const c = cells[(Math.random() * cells.length) | 0]; strike(v, c.clone().add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), BOLT, { n: 14, ring: 0.9 }); });
    if (i % 3 === 0) v.flash([0.85, 0.9, 1], 0.1); v.shake(0.05, 0.1);
  }
  await ctx.until(F + tr[tr.length - 1]);
  for (const c of cells) strike(v, c, BOLT, { width: 0.12, n: 18, ring: 1.4 });
  v.flash([0.95, 0.97, 1], 0.55); v.shake(0.22, 0.4); v.hitstop = 0.1; glowTargets(ctx, 1);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 霸雷: [ROM fx 33] one colossal column of lightning on the target, a crown of sparks, a white-out, a crackling orb
async function greatThunder(ctx) {
  const v = ctx.vfx, at = ctx.at.clone();
  await intro(ctx, BOLT, { dur: 900, dist: 10, pitch: 0.3 });
  DARK(ctx, 0.75, 0.85, 0.85, 0.6); STORM(v, at, 30, 3, 7, [0.1, 0.1, 0.16]);
  for (let i = 0; i < 40; i++) v.smokePuff(at.x + Math.cos(i) * 2, at.y + 7.5, at.z + Math.sin(i) * 2, { life: 2.6, size: 1.6, size1: 2.6, tint: [0.1, 0.1, 0.18], orb: { x: at.x, z: at.z, w: 1.6 } });
  await ctx.wait(150); await ctx.until(1.38);   // (it strikes with the original's sound, 1.38 s after the cast begins; over at 2.9 s)
  v.pillar(at, [0.75, 0.85, 1], 0.55, 12, 1.0, { intensity: 2.2 }); v.pillar(at, [1, 1, 1], 0.22, 12, 0.9, { intensity: 2.4 });
  for (let i = 0; i < 6; i++) v.bolt(at.clone().add(V(rand(-0.6, 0.6), 11, rand(-0.6, 0.6))), at.clone().add(V(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), BOLT, 0.7, { width: 0.12 });
  v.flash([1, 1, 1], 0.9); v.shake(0.35, 0.6); v.hitstop = 0.15; v.screen.chroma = 0.6;
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; v.bolt(at.clone().setY(at.y + 0.1), at.clone().add(V(Math.cos(a) * 1.8, rand(0.4, 1.4), Math.sin(a) * 1.8)), BOLT, 0.3, { width: 0.05, jag: 0.5 }); }
  v.burst(at.clone().setY(at.y + 0.2), { n: 120, speed: 8, cols: [[1, 1, 1], BOLT, [0.5, 0.6, 1]], size: 0.06, life: 0.9, g: 4 });
  v.ring(at, BOLT, 5, 0.9, { intensity: 1.6 }); v.decal(at, [0.5, 0.6, 1], 2, 1.8);
  glowTargets(ctx, 1, 1); ctx.hit();
  await ctx.wait(600); plasma(v, at.clone().setY(at.y + 0.6), BOLT, 1.1, 0.55);
  await ctx.wait(1100); outro(ctx);
}

// ---------------------------------------------------------------- light and darkness
// 暴走之光: [ROM fx 34] a ball of light rises from the caster, beams streak down, and light bursts on every cell
// of the cross, twice
async function lightBurst(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], col = [1, 0.85, 0.5];
  cueAt(ctx, 1.73);   // (the original's first sound as the ball of light rises, 1.73 s after the cast begins; over at 4.6 s)
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  const o = orb(v, col, 0.45), from = ctx.caster.chest().add(V(0, 0.6, 0)), sky = at.clone().setY(at.y + 6);
  v.timed(o, 0.8, k => { o.position.copy(from).lerp(sky, ease(k)); }, () => { o.visible = false; });
  await ctx.wait(800);
  for (const c of cells) v.bolt(sky, c.clone().setY(c.y + 0.3), [1, 0.95, 0.75], 0.25, { width: 0.06, jag: 0.15 });
  v.flash([1, 0.95, 0.8], 0.3);
  for (let w = 0; w < 2; w++) {
    cells.forEach((c, i) => later(i * 60, () => {
      const p = c.clone().setY(c.y + 0.6), g = orb(v, [1, 0.8, 0.45], 0.5); g.position.copy(p);
      v.timed(g, 0.45, k => { g.scale.setScalar(0.3 + k * 1.4); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; });
      v.ring(c, [1, 0.45, 0.3], 1.3, 0.45); v.burst(p, { n: 16, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.5, g: 1 }); v.light(p, col, 10, 0.3, 5);
    }));
    v.shake(0.1, 0.2);
    if (w === 1) { glowTargets(ctx, 0.9); ctx.hit(); }
    await ctx.wait(cells.length * 60 + 450);
  }
  await ctx.wait(600); outro(ctx);
}
// 九天之怒: [ROM fx 35] in darkness a vast wheel of light opens in the sky, a ring of light orbs bursts around it and
// it comes down on the whole area in a white-out
async function heavenWrath(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), col = [1, 0.95, 0.75], R = spreadOf(cells) + 1.2;
  await intro(ctx, col, { dur: 800, dist: 14, pitch: 0.42 });
  DARK(ctx, 0.85, 0.95, 0.95, 0.85);
  const sky = c0.clone().setY(c0.y + 4.2);
  const disc = v.runeCircle(sky, col, R * 0.75 + 0.5, 2.8, { spin: 0.8, intensity: 1.3 }); disc.position.y = sky.y;
  const halo = glowCard(v, col, (R + 1) * 3); halo.position.copy(sky);
  v.timed(halo, 2.8, (k, dt, t) => { halo.material.opacity = Math.min(1, t / 0.6) * 0.6 * (1 - k * k); });
  v.light(sky, col, 40, 2.8, 16);
  await ctx.wait(400); await ctx.until(2.32 - 0.7);   // (it comes down with the original's sound, 2.32 s after the cast begins; over at 3.8 s)
  for (let i = 0; i < 10; i++) later(i * 50, () => { const a = i / 10 * 6.28, p = sky.clone().add(V(Math.cos(a) * (R + 0.6), -0.3, Math.sin(a) * (R + 0.6))), g = orb(v, col, 0.5); g.position.copy(p);
    v.timed(g, 0.6, k => { g.scale.setScalar(0.4 + k * 1.6); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; }); });
  await ctx.until(2.32);
  for (const c of cells) v.pillar(c, col, 0.42, 7, 0.9, { intensity: 1.4 });
  v.flash([1, 1, 1], 0.95); v.shake(0.3, 0.5); v.hitstop = 0.1; v.ring(c0, col, R * 2 + 3, 1);
  for (const c of cells) v.burst(c.clone().setY(c.y + 0.3), { n: 14, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.7 });
  glowTargets(ctx, 1, 1); ctx.hit();
  await ctx.wait(1300); outro(ctx);
}
// 積屍氣: [ROM fx 36] a flash, then darkness: black miasma rises and the skulls of the dead (the original's own) swirl
// through the targets
const SKULL = () => tex('assets/fx/hd/skull.png');
// (the flash on the original's first sound, 2.02 s after the cast begins; the skulls swirl, a wail every half second, to
// 7 s; over at 7.5 s)
async function corpseQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], col = [0.55, 0.9, 0.75], F = 2.02, E = 7.5;
  await intro(ctx, [0.6, 1, 0.8], { dur: 700, dist: 10.5, pitch: 0.45 });
  await channel(ctx, [0.6, 1, 0.8], F); ctx.cue();
  v.ring(at, [1, 0.95, 0.8], 2.4, 0.5); v.flash([1, 1, 0.9], 0.35);
  await ctx.wait(250);
  DARK(ctx, 0.88, 1, 0.85, 0.95);
  const L = 7.05 - ctx.now();   // (the skulls swirl to 7 s)
  ticker(v, L, () => { for (const c of cells) if (Math.random() < 0.35) v.smokePuff(c.x + rand(-0.4, 0.4), c.y + 0.05, c.z + rand(-0.4, 0.4), { vy: rand(0.3, 0.8), life: rand(1.2, 1.8), size: 0.4, size1: 1.1, tint: [0.05, 0.07, 0.06] }); });
  const map = SKULL(), n = 10 + cells.length * 2;
  for (let i = 0; i < n; i++) {
    const s = card(map, 0.55, 0.68, { order: 8 }), c = cells[i % cells.length], ph = rand(0, 6.28), w = rand(2.5, 4) * (i % 2 ? 1 : -1), d = rand(0, 0.8);
    s.material.opacity = 0;
    v.timed(s, L, (k, dt, t) => {
      const f = Math.max(0, t - d), r = 0.4 + 0.9 * (0.5 + 0.5 * Math.cos(f * 1.3 + ph)), a = ph + f * w;   // (they swirl in and out round the target)
      s.position.set(c.x + Math.cos(a) * r, c.y + 0.4 + Math.sin(f * 3 + ph) * 0.35 + (1 - Math.cos(f * 0.9)) * 0.3, c.z + Math.sin(a) * r);
      s.material.opacity = Math.min(1, f * 3) * Math.min(1, (L - t) * 3) * 0.9; s.material.rotation = Math.sin(f * 4 + ph) * 0.3;
      if (Math.random() < 0.3) v.smoke(s.position.x, s.position.y, s.position.z, { vy: rand(0.1, 0.4), life: 0.6, size: 0.12, r: col[0] * 0.4, gg: col[1] * 0.4, b: col[2] * 0.4, a: 0.5, shape: -1 });
    });
  }
  ticker(v, L - 0.2, () => { for (const a of tgts(ctx)) a.flash = Math.random() < 0.15 ? 0.5 : a.flash * 0.9; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.wait(1800); ctx.hit(); v.shake(0.1, 0.25);
  await ctx.until(E - 0.1); outro(ctx);
}
// 黑色狂嵐: [ROM fx 37] black: a gale of darkness roars over the whole area, its roar the original's first three sounds
// (from 2.18 s after the cast begins), then it bursts into a red blaze on its fourth (5.48 s); over at 6.8 s
async function blackGale(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 0.8, F = 2.18, E = 6.8;
  await intro(ctx, [0.6, 0.5, 0.9], { dur: 800, dist: 14, pitch: 0.42 });
  DARK(ctx, 0.92, 1, 1, 0.95); cueAt(ctx, F);
  const S = F + (ctx.track[3] || 3.3), L = S + 0.3 - ctx.now();   // (S: the blaze)
  swirl(v, c0, [0.55, 0.55, 0.65], R * 0.6, R + 0.8, 4, L, { speed: 9, twist: 3, foam: [0.85, 0.85, 1], intensity: 0.75 });
  swirl(v, c0, [0.3, 0.3, 0.45], R * 0.4, R + 0.4, 3, L, { speed: -7, twist: 2, intensity: 0.6 });
  ticker(v, L, () => {
    for (let i = 0; i < 4; i++) { const a = rand(0, 6.28), r = rand(0.4, R + 0.5); v.smokePuff(c0.x + Math.cos(a) * r, c0.y + rand(0.2, 2.5), c0.z + Math.sin(a) * r, { life: 0.9, size: 0.6, size1: 1.4, tint: [0.08, 0.08, 0.1], orb: { x: c0.x, z: c0.z, w: 5 } }); }
    if (Math.random() < 0.5) { const a = rand(0, 6.28), r = rand(0.5, R); v.spark(c0.x + Math.cos(a) * r, c0.y + rand(0.3, 2.5), c0.z + Math.sin(a) * r, { life: 0.5, size: 0.14, size1: 0.02, r: 0.5, gg: 0.6, b: 1, shape: 0, orb: { x: c0.x, z: c0.z, w: 7 } }); }
  });
  v.shake(0.08, L - 0.2);
  await ctx.until(S);
  DARK(ctx, 0.75, 0.2, 0.8, 0.85); v.flash([1, 0.25, 0.1], 0.5);
  cells.forEach((c, i) => later(i * 30, () => v.explode(c.clone().setY(c.y + 0.4), 0.5, { n: 10, smoke: i % 2 === 0, tint: [1, 0.7, 0.7] })));
  v.shake(0.25, 0.5); v.hitstop = 0.1; glowTargets(ctx, 1, 0.9);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- healing and blessings
// 凝神: [ROM fx 39] a column of blue light comes down onto the target, sparkles settle, the target glows
// (the target fills with the original's chime, 3.45 s after the cast begins; the column comes down 1.2 s before)
async function mpColumn(ctx) {
  const v = ctx.vfx, col = [0.45, 0.75, 1], F = 3.45;
  await intro(ctx, col, { dur: 600, dist: 8, pitch: 0.42 });
  // motes of blue light gather over the target while it waits for the column
  for (const t of (tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }])) { const P = t.pos.clone(); ticker(v, Math.max(0.05, F - 1.2 - ctx.now()), () => { if (Math.random() < 0.5) { const q = P.clone().add(V(rand(-1.2, 1.2), rand(2.5, 4), rand(-1.2, 1.2))); v.spark(q.x, q.y, q.z, { seek: { x: P.x, y: P.y + 3, z: P.z, k: 3 }, life: 0.6, size: rand(0.05, 0.09), r: 0.7, gg: 0.9, b: 1, shape: 0 }); } }); }
  await ctx.until(F - 1.2);
  for (const t of (tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }])) {
    const P = t.pos.clone(), beam = v.pillar(P, col, 0.42, 6, 1.6, { intensity: 1.6 });
    v.timed(new THREE.Object3D(), 0.5, k => { beam.position.y = P.y + (1 - ease(k)) * 6; });
    later(500, () => { v.ring(P, col, 1.6, 0.6); v.decal(P, col, 1, 1.4, { intensity: 0.8 }); v.light(P.clone().setY(P.y + 1), col, 14, 1.2, 6);
      for (let i = 0; i < 30; i++) later(i * 25, () => v.spark(P.x + rand(-0.5, 0.5), P.y + rand(1.5, 2.5), P.z + rand(-0.5, 0.5), { vy: -rand(0.6, 1.2), life: 1.2, size: rand(0.05, 0.09), r: 0.7, gg: 0.9, b: 1, shape: 0, flicker: 1, ph: rand(0, 9) })); });
  }
  await ctx.wait(700); glowTargets(ctx, 0.7, 1.2);
  await ctx.until(F); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 元靈歸心: [ROM fx 41] hearts of red light drift down onto each target and break into warm sparkles
function heartTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(8, 72, 8, 22, 40, 22); g.bezierCurveTo(54, 22, 62, 34, 64, 44); g.bezierCurveTo(66, 34, 74, 22, 88, 22); g.bezierCurveTo(120, 22, 120, 72, 64, 112); g.closePath(); };
  g.shadowColor = 'rgba(255,90,110,1)'; g.shadowBlur = 18; g.fillStyle = '#ff5a6e'; path(); g.fill();
  g.shadowBlur = 0; const gr = g.createRadialGradient(48, 46, 2, 56, 56, 46); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,200,205,0.3)'); gr.addColorStop(1, 'rgba(255,120,140,0)'); g.fillStyle = gr; path(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let HEART = null;
// (they break with the original's chime, 3.32 s after the cast begins; the hearts drift down for the time before it)
async function hearts(ctx) {
  const v = ctx.vfx, col = [1, 0.45, 0.55], F = 3.32;
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.45 });
  HEART = HEART || heartTex();
  const list = tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }], D = Math.max(1.1, F - ctx.now() - (list.length - 1) * 0.12);   // (D: a heart's drift)
  list.forEach((t, i) => {
    const P = t.pos.clone(), s = card(HEART, 0.6, 0.6, { add: true, order: 8 }), d = i * 0.12;
    v.timed(s, D + 0.2 + d, (k, dt, tt) => {
      const f = Math.max(0, Math.min(1, (tt - d) / D)); s.position.set(P.x + Math.sin(f * 7) * 0.25 * (1 - f), P.y + 3 - f * 2.2, P.z); s.material.opacity = Math.min(1, f * 5) * (f > 0.9 ? (1 - f) * 10 : 1); s.scale.setScalar(0.6 + Math.sin(tt * 9) * 0.04);
      if (f >= 1 && !s.userData.p) { s.userData.p = 1; v.burst(s.position, { n: 26, speed: 2, cols: [[1, 0.8, 0.85], col], size: 0.05, life: 0.8, g: 0.5 }); v.ring(P, col, 1.3, 0.6); v.light(P.clone().setY(P.y + 1), col, 10, 0.8, 5); ticker(v, 1, k2 => { t.flash = 0.5 * (1 - k2); }, () => { t.flash = 0; }); }
    });
  });
  await ctx.until(F); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 觀音下凡: [ROM fx 42] 觀音 (the original's own figure, on her lotus with her halo) comes down from the sky, circles
// over the area, and a rain of blue light falls on everyone
// (after the original's: she comes at 1.5 s and circles over the area, raining light from 4 s to 6.2 s, and leaves; the targets glow with its chime at 7.65 s; over at 8.5 s)
async function guanyin(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), col = [0.6, 0.85, 1], F = 7.65, E = 8.48;
  await intro(ctx, [1, 0.9, 0.6], { dur: 700, dist: 12.5, pitch: 0.4 });
  DARK(ctx, 0.35, 0.8, 0.8, 0.9);
  const fig = card(tex('assets/fx/hd/guanyin.png'), 1.9, 2.1, { order: 8 }), halo = glowCard(v, [1, 0.85, 0.45], 3.4); halo.renderOrder = 7;
  const g = new THREE.Group(); g.add(halo, fig); halo.position.y = 0.25;
  const top = c0.clone().setY(c0.y + 7), hover = c0.clone().setY(c0.y + 2.8), L = Math.max(3.2, 6.3 - ctx.now());   // (L: she stays to 6.3 s)
  v.light(hover, [1, 0.9, 0.6], 20, L, 10);
  v.timed(g, L, (k, dt, t) => {
    const f = ease(Math.min(1, t / 1.0)), a = t * 1.4, r = Math.min(1.3, spreadOf(cells) * 0.6);
    g.position.copy(top).lerp(hover, f).add(V(Math.cos(a) * r * f, Math.sin(t * 2) * 0.08, Math.sin(a) * r * f));
    const o = Math.min(1, t * 2) * Math.min(1, (L - t) * 2); fig.material.opacity = o; halo.material.opacity = o * (0.55 + 0.1 * Math.sin(t * 5));
    if (Math.random() < 0.5) v.spark(g.position.x + rand(-0.6, 0.6), g.position.y - 0.6, g.position.z + rand(-0.6, 0.6), { vy: -0.4, life: 1, size: 0.06, r: 1, gg: 0.9, b: 0.6, shape: 0 });
  });
  await ctx.until(Math.max(ctx.now() + 1.2, 4.0));
  ticker(v, Math.max(1.6, 6.2 - ctx.now()), () => { for (let i = 0; i < 4; i++) { const c = cells[(Math.random() * cells.length) | 0]; v.spark(c.x + rand(-0.5, 0.5), c.y + rand(2.5, 3.5), c.z + rand(-0.5, 0.5), { vy: -rand(1.2, 2), life: 1.4, size: rand(0.06, 0.1), r: col[0], gg: col[1], b: col[2], shape: 0, flicker: 1, ph: rand(0, 9), floor: c.y + 0.05 }); } });
  // the light she leaves settles on the targets, and they glow with the chime
  await ctx.until(F - 1.2);
  for (const t of tgts(ctx)) { v.pillar(t.pos, col, 0.45, 3, 1.6, { intensity: 0.5, grow: 1 }); v.ring(t.pos, col, 1.4, 0.7); }
  await ctx.until(F - 0.3); glowTargets(ctx, 0.7, 1.2);
  await ctx.until(F); ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 還魂咒: [ROM fx 43] a soul light comes down into the fallen, a lotus of light opens under it and a column rises
async function revive(ctx) {
  const v = ctx.vfx, col = [1, 0.95, 0.75], P = ctx.at.clone();
  await intro(ctx, col, { dur: 800, dist: 8.5, pitch: 0.42 });
  DARK(ctx, 0.4, 0.9, 0.85, 0.8);
  const soul = orb(v, [0.7, 0.85, 1], 0.35), from = P.clone().setY(P.y + 5), rib = v.ribbon({ col: [0.7, 0.85, 1], width: 0.12, n: 24 });
  v.timed(soul, 1.0, (k, dt, t) => { soul.position.copy(from).lerp(P.clone().setY(P.y + 0.5), ease(k)).add(V(Math.sin(t * 6) * 0.5 * (1 - k), 0, Math.cos(t * 6) * 0.5 * (1 - k))); rib.push(soul.position); }, () => { rib.end(); soul.visible = false; });
  v.runeCircle(P, col, 1.3, 2.6, { spin: 0.6, intensity: 1.4 });
  const pg = petalGeo(), lotus = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.1, 0.8), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  for (let i = 0; i < 8; i++) { const pv = new THREE.Group(), m = new THREE.Mesh(pg, mat); pv.rotation.y = i / 8 * 6.28; m.rotation.x = -0.9; pv.add(m); lotus.add(pv); }
  lotus.position.copy(P).setY(effectH(P.x, P.z) + 0.03);
  v.timed(lotus, 2.4, (k, dt, t) => { lotus.scale.setScalar(0.3 + 0.9 * ease(Math.min(1, t / 0.9))); lotus.rotation.y += dt * 0.6; mat.opacity = Math.min(1, t * 2) * Math.min(1, (2.4 - t) * 2) * 0.55; });
  await ctx.wait(1000);
  v.pillar(P, col, 0.5, 5, 1.4, { intensity: 1, grow: 1 }); v.flash(col, 0.3); v.ring(P, col, 2, 0.7); v.light(P.clone().setY(P.y + 1), col, 18, 1.2, 6);
  for (let j = 0; j < 3; j++) { const r = v.ribbon({ col, width: 0.06, n: 22 }); ticker(v, 1.2, (k, dt, tt) => { const a = tt * 6 + j * 2.09; r.push(V(P.x + Math.cos(a) * 0.5, P.y + 0.1 + k * 2.6, P.z + Math.sin(a) * 0.5)); }, () => r.end()); }
  ctx.hit(); await ctx.wait(1400); outro(ctx);
}

// ---------------------------------------------------------------- protection and its breaking
// 金剛咒 / 真元護體: [ROM fx 46, 47] shards fly in from all around, closing on each target with the original's chime (1.75
// s after the cast begins), and close into a crystal prism around it (3.3 s), which glows and dissolves upwards; over at E
async function diamondGuard(ctx, col, E) {
  const v = ctx.vfx, F = 1.75;
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.42 });
  cueAt(ctx, F);
  const PR = Math.max(650, (F + 1.5 - ctx.now()) * 1000);   // (PR ms: the prism, at 3.3 s)
  const list = tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }];
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(...col), emissive: new THREE.Color(...col).multiplyScalar(0.6), specular: 0xffffff, shininess: 120, flatShading: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  for (const t of list) {
    const P = t.pos.clone();
    for (let i = 0; i < 14; i++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.06, 0.12)), mat), a = rand(0, 6.28), from = P.clone().add(V(Math.cos(a) * 2.2, rand(0.3, 2), Math.sin(a) * 2.2));
      lob(v, sh, from, P.clone().add(V(Math.cos(a) * 0.55, rand(0.2, 1.4), Math.sin(a) * 0.55)), 0.3, 0.55 + rand(0, 0.2)); }
    // the shards hang round the target, glinting, until the prism closes
    later(800, () => ticker(v, Math.max(0.05, PR / 1000 - 0.8), () => { if (Math.random() < 0.4) { const a = rand(0, 6.28); v.spark(P.x + Math.cos(a) * 0.55, P.y + rand(0.2, 1.5), P.z + Math.sin(a) * 0.55, { life: 0.3, size: rand(0.05, 0.1), r: col[0], gg: col[1], b: col[2], shape: 0 }); } }));
    later(PR, () => {
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 6, 1, true), mat), edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 6)), new THREE.LineBasicMaterial({ color: new THREE.Color(...col).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
      prism.add(edge); prism.position.copy(P).setY(P.y + 0.9);
      v.timed(prism, 1.4, (k, dt, tt) => { const g = Math.min(1, tt / 0.2); prism.scale.set(1, g, 1); prism.rotation.y += dt * 0.8; const o = Math.min(1, (1.4 - tt) / 0.5); mat.opacity = 0.55 * o; edge.material.opacity = o; if (tt > 0.9) prism.position.y = P.y + 0.9 + (tt - 0.9) * 1.2; });
      v.ring(P, col, 1.4, 0.5); v.light(P.clone().setY(P.y + 1), col, 10, 1, 5); ticker(v, 1, k2 => { t.flash = 0.45 * (1 - k2); }, () => { t.flash = 0; });
      for (let i = 0; i < 20; i++) later(800 + i * 25, () => v.spark(P.x + rand(-0.5, 0.5), P.y + rand(0.2, 1.8), P.z + rand(-0.5, 0.5), { vy: rand(0.6, 1.4), life: 0.9, size: 0.05, r: col[0], gg: col[1], b: col[2], shape: 1 }));
    });
  }
  await ctx.until(F + 1.5); ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 金剛破 / 真元歸天: [ROM fx 48, 49] a shield shows before each target, cracks and shatters on the original's one sound (F s
// after the cast begins); dark miasma sinks into it; over at E
async function shieldBreak(ctx, col, F, E) {
  const v = ctx.vfx;
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.42 });
  const B = Math.max(0.55, F - ctx.now()) * 1000;   // (it shatters B ms after it shows, on the sound)
  const list = tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }];
  const shield = () => { const c = document.createElement('canvas'); c.width = 128; c.height = 150; const g = c.getContext('2d');
    g.beginPath(); g.moveTo(64, 4); g.lineTo(122, 26); g.lineTo(112, 92); g.quadraticCurveTo(96, 132, 64, 146); g.quadraticCurveTo(32, 132, 16, 92); g.lineTo(6, 26); g.closePath();
    const gr = g.createLinearGradient(0, 0, 128, 150); gr.addColorStop(0, '#e8f0f8'); gr.addColorStop(0.5, '#9fb4c8'); gr.addColorStop(1, '#5d7088'); g.fillStyle = gr; g.fill(); g.lineWidth = 6; g.strokeStyle = '#2c3a4c'; g.stroke();
    g.fillStyle = '#d8b450'; g.font = 'bold 60px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('護', 64, 72);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const map = shield();
  for (const t of list) {
    const P = t.pos.clone(), s = card(map, 0.85, 1.0, { order: 8 }); s.position.copy(P).setY(P.y + 0.75); s.material.opacity = 0;
    v.timed(s, 1.0, (k, dt, tt) => { s.material.opacity = Math.min(1, tt * 4); s.position.x = P.x + (tt > 0.5 ? rand(-0.03, 0.03) : 0); });
    later(B * 0.5, () => { const q = s.position.clone(); for (let i = 0; i < 4; i++) v.bolt(q.clone().add(V(0, 0.05, 0.1)), q.clone().add(V(rand(-0.4, 0.4), rand(-0.45, 0.45), 0.1)), [0.2, 0.2, 0.25], 0.45, { width: 0.012, jag: 0.25 }); v.shake(0.05, 0.1); });
    later(B, () => {
      const q = s.position.clone(); s.visible = false;
      for (let i = 0; i < 10; i++) { const sh = rockMesh(rand(0.05, 0.1), 0x9fb4c8); lob(v, sh, q, P.clone().add(V(rand(-1, 1), 0, rand(-1, 1))), rand(0.3, 0.8), 0.6); }
      v.burst(q, { n: 26, speed: 3, cols: [[0.9, 0.95, 1], [0.6, 0.7, 0.8]], size: 0.05, life: 0.7, g: 8 }); v.flash([0.6, 0.6, 0.7], 0.12);
      for (let i = 0; i < 16; i++) v.smokePuff(P.x + rand(-0.6, 0.6), P.y + rand(1.2, 1.8), P.z + rand(-0.6, 0.6), { vy: -rand(0.6, 1.1), life: 1.2, size: 0.3, size1: 0.6, tint: col.map(c => c * 0.25) });
      ticker(v, 0.9, k2 => { t.flash = (0.4 * (1 - k2)) * (Math.random() < 0.5 ? 1 : 0); }, () => { t.flash = 0; });
    });
  }
  await ctx.until(F); ctx.cue(); await ctx.wait(200); ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 封魔符: [ROM fx 50] a talisman flies to the target and sticks, flaring with each of the original's nine sounds (the first
// 1.8 s after the cast begins, a sixth of a second apart), and a 封 seal locks around it (3.3 s), the target flickering
// under it; over at 5.35 s
async function sealTalisman(ctx) {
  const v = ctx.vfx, col = [1, 0.85, 0.4], P = ctx.at.clone(), from = ctx.caster.chest().add(V(0, 0.4, 0)), tgt = P.clone().setY(P.y + 0.75), F = 1.8, E = 5.35;
  const tr = ctx.track.length ? ctx.track : [...Array(9).keys()].map(i => i / 6);
  await intro(ctx, col, { dur: 600, dist: 8.5, pitch: 0.4 });
  await ctx.until(F - 0.6);
  const tc = card(talismanTex('封魔'), 0.42, 1.1, { order: 9 }), rib = v.ribbon({ col, width: 0.06, n: 14 }), TL = F + tr[tr.length - 1] + 0.9 - ctx.now();
  v.timed(tc, TL, (k, dt, t) => {
    const f = Math.min(1, t / 0.55); tc.position.copy(bezier(from, from.clone().lerp(tgt, 0.5).add(V(0, 1.4, 0)), tgt, ease(f))); if (f < 1) rib.push(tc.position); else if (!tc.userData.s) { tc.userData.s = 1; rib.end(); }
    tc.material.rotation = f < 1 ? t * 9 : 0; tc.material.color.setScalar(1 + (t > 0.6 ? 0.8 * Math.max(0, Math.sin((t - 0.6) * 18.8)) : 0));
    tc.material.opacity = Math.min(1, (TL - t) * 3);
  });
  for (let i = 0; i < tr.length; i++) { await ctx.until(F + tr[i]); if (i === 0) ctx.cue(); v.burst(tgt, { n: 14, speed: 2.5, cols: [[1, 1, 0.85], col], size: 0.05, life: 0.5, g: 0 }); v.light(tgt, col, 12, 0.15, 5); if (i % 3 === 0) v.ring(tgt, col, 1.2, 0.3, { vertical: true, yaw: ctx.cam.yaw || 0, y: tgt.y }); }
  await ctx.until(F + 1.5);
  const seal = v.runeCircle(P, [0.5, 0.75, 1], 1.0, 1.6, { spin: 2, intensity: 1.6 });
  const glyph = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = 'bold 96px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#7fc0ff'; g.shadowBlur = 16; g.fillStyle = '#e8f4ff'; g.fillText('封', 64, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const gc = card(glyph, 0.9, 0.9, { add: true, order: 9 }); gc.position.copy(tgt).setY(tgt.y + 0.7);
  v.timed(gc, 1.4, (k, dt, t) => { gc.material.opacity = Math.min(1, t * 4) * (1 - k) * (0.75 + 0.25 * Math.sin(t * 14)); gc.scale.setScalar(0.9 + k * 0.2); });
  ticker(v, 1.5, (k, dt, t) => { for (const a of tgts(ctx)) a.flash = 0.45 * (1 - k) * (Math.sin(t * 25) > 0 ? 1 : 0.3); }, () => { for (const a of tgts(ctx)) a.flash = 0; });   // (the target flickers under the seal, as the original's)
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- summons (the beasts are the original's sprites)
// the beast comes out of a curtain of light streaks (gold for most, fire for the phoenix), as the original's do
function curtain(v, p, col, life) {
  for (let i = 0; i < 9; i++) { const q = p.clone().add(V(rand(-1.2, 1.2), 0, rand(-0.3, 0.3))); later(i * 40, () => v.pillar(q, col, rand(0.04, 0.12), 6, life, { intensity: 1.6 })); }
}
// a summoned beast: the original's own sprite (assets/fx/hd/summon_NN.png) as a spirit in its palette
function beast(v, id, h, pal) { return spirit(v, tex('assets/fx/hd/summon_' + id + '.png'), h, pal || PAL.gold); }
export const beastSprite = beast;   // (龍王's, in spells.js)
// it rises out of a curtain of light, materialising from the noise over 0.7 s, and dissolves away at the end of its life
async function beastIn(ctx, id, h, p, col, o) {
  const v = ctx.vfx; o = o || {}; const life = o.life || 3.2, pal = o.pal || PAL.gold;
  curtain(v, p.clone().setY(effectH(p.x, p.z)), col, 1.4);
  const g = beast(v, id, h, pal); g.position.copy(p);
  v.timed(g, life, (k, dt, t) => {
    const U = g.userData; U.fit(); U.face(); U.set('uT', t);
    U.set('uK', Math.min(1, Math.max(0, (t - 0.35) / 0.7)) * Math.min(1, Math.max(0, (life - t) / 0.5)));
    if (o.move) o.move(g, t, dt);
  });
  return g;
}
// 龍鬚虎 [ROM fx 54; remade next-gen, 2026-10-23]: pillars of gold light fall round the field, the shaggy beast
// materialises out of them, its mane burning gold; with each of the original's five sounds (the first 2.9 s after the
// cast begins) it rears and hurls a boulder that arcs onto the target trailing embers, smashing a crater, throwing rock
// and dust; the last the biggest (the effect over at 6.4 s)
async function summonTiger(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], B = basis(ctx), col = [1, 0.85, 0.5], FIRST = 2.9, END = 6.4, AIR = 0.6;
  await intro(ctx, col, { dur: 600, dist: 12.5, pitch: 0.36 });
  DARK(ctx, 0.88, 0.75, 0.85, 0.95);   // (a deep amber dusk: the gold reads against it)
  const home = at.clone().add(B.right.clone().multiplyScalar(-3.8)).add(B.toCam.clone().multiplyScalar(-1.6)); home.y = effectH(home.x, home.z) + 1.35;
  ctx.cam.shot(home.clone().lerp(at, 0.5).add(V(0, 0.9, 0)), { cine: true, dist: 13, pitch: 0.46, yaw: -0.15, speed: 2 });   // (the beast and the target both in view)
  for (let i = 0; i < 7; i++) later(i * 120, () => { const q = home.clone().add(V(rand(-2.5, 2.5), 0, rand(-1, 1))); q.y = effectH(q.x, q.z); v.pillar(q, [1, 0.85, 0.45], rand(0.12, 0.3), 9, 1.2, { intensity: 2 }); v.ring(q, [1, 0.8, 0.4], 1.2, 0.5); });
  let rear = 0;
  const g = await beastIn(ctx, 54, 2.7, home, col, { life: END - 1.4, pal: PAL.gold, move: (g, t, dt) => { rear = Math.max(0, rear - dt * 3); g.position.y = home.y + rear * 0.35; g.scale.setScalar(1 + rear * 0.08); g.userData.set('uFlash', rear * 0.35); } });
  const throwOne = k => {
    const big = k === ctx.track.length - 1, c = cells[k % cells.length], land = c.clone().add(V(rand(-0.2, 0.2), 0.25, rand(-0.2, 0.2)));
    // a boulder burning like a meteor: rock with an ember-gold glow round it and a wide trail of fire
    const r = rockMesh(big ? 1.0 : rand(0.55, 0.7), 0x6a5038), ember = glowCard(v, [1, 0.6, 0.2], (big ? 1.0 : 0.6) * 3.2); ember.material.opacity = 0.85; r.add(ember);
    const from = home.clone().add(V(0, 1.6, 0)), trail = energyStreak(v, PAL.fire, 20, big ? 0.55 : 0.36, k * 3.1, { taper: 0.9 });
    rear = 1; v.ring(home.clone().setY(home.y - 1.3), col, 3, 0.5); v.shake(0.08, 0.2);
    v.timed(new THREE.Object3D(), AIR, () => { if (Math.random() < 0.7) v.flame(r.position.x, r.position.y, r.position.z, { size: big ? 0.6 : 0.4, asp: 1.5, life: 0.35, vy: 0.4 }); });
    lob(v, r, from, land, big ? 2.4 : 1.8, AIR, () => {
      trail.end(); dustBurst(v, c, big ? 1.6 : 0.9); v.impact(land, [1, 0.75, 0.4], big ? 1.6 : 0.9); v.ring(c, [0.9, 0.75, 0.5], big ? 3.5 : 1.8, 0.5, { intensity: 1.2 });
      v.decal(c, [0.06, 0.04, 0.02], big ? 1.4 : 0.8, END, {}); v.shake(big ? 0.3 : 0.14, big ? 0.5 : 0.25); v.light(land, [1, 0.7, 0.35], big ? 24 : 12, 0.35, 6);
      for (let j = 0; j < (big ? 10 : 5); j++) { const sh = rockMesh(rand(0.06, 0.14)); lob(v, sh, land, c.clone().add(V(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))), rand(0.5, 1.2), 0.5); }
      for (let j = 0; j < 20; j++) { const a = rand(0, 6.28), sp = rand(1, 4); v.spark(land.x, land.y, land.z, { vx: Math.cos(a) * sp, vy: rand(1, 4), vz: Math.sin(a) * sp, g: 10, life: rand(0.4, 0.8), size: rand(0.03, 0.06), r: 1, gg: 0.8, b: 0.4, shape: 1, floor: c.y + 0.02 }); }
      glowTargets(ctx, big ? 1 : 0.5, 0.25);
      if (big) { v.flash([1, 0.9, 0.7], 0.5); v.hitstop = 0.12; ctx.hit(); } });
    v.timed(new THREE.Object3D(), AIR, () => trail.push(r.position));
  };
  for (let k = 0; k < ctx.track.length; k++) { await ctx.until(FIRST + ctx.track[k] - AIR); throwOne(k); if (!k) later(AIR * 1000, () => ctx.cue()); }
  await ctx.until(END); outro(ctx);
}
// ---------------------------------------------------------------- the fire bird (火鳳凰, remade: a phoenix made of fire)
// A great bird of living flame, built from sheets (two wings, a body, a crest, three tail plumes) deformed every frame and
// painted with a flowing fire shader: white-gold where the flame is hottest (a wing's leading edge, the spine, a plume's
// heart), orange, then red where it tears into feathered licks (noise streaming back along the sheet); additive, over the
// bloom, so it glows. Embers stream off its trailing edges; it carries its own light and halo. After the original's
// phoenix (fx 55: red-orange plumage, gold crest, long tail plumes). pose: { p, fwd, flap (-1 down .. 1 up), fold (0
// spread .. 1 swept back along the body: a dive), s (scale), heat (0-1) }
const FIRE_SHEET_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// the sheet's colours, dark tips to white heart: [c0, c1, c2, c3]
export const PAL = {
  fire: [[0.55, 0.05, 0.02], [1.0, 0.22, 0.04], [1.0, 0.55, 0.1], [1.0, 0.93, 0.65]],
  silver: [[0.12, 0.2, 0.55], [0.35, 0.6, 1.0], [0.7, 0.88, 1.0], [1.0, 1.0, 1.0]],
  water: [[0.02, 0.12, 0.4], [0.08, 0.42, 0.95], [0.45, 0.82, 1.0], [0.92, 1.0, 1.0]],
  gold: [[0.45, 0.2, 0.02], [1.0, 0.55, 0.08], [1.0, 0.84, 0.35], [1.0, 1.0, 0.85]],
  jade: [[0.02, 0.28, 0.08], [0.12, 0.72, 0.28], [0.5, 1.0, 0.5], [0.92, 1.0, 0.86]],
};
const ENERGY_FS = `uniform float uT, uHeat, uMode, uSeed, uGain; uniform vec3 uC0, uC1, uC2, uC3; varying vec2 vUv;
  ${NOISE}
  void main(){
    // mode 0, a wing: u along the span (root 0 .. tip 1), v across the chord (leading edge 0 .. trailing 1)
    // mode 1, a plume, a body or a streak: u along it, v across it (0.5 its heart)
    float u = vUv.x, v = vUv.y, wing = step(uMode, 0.5), edge = mix(abs(v - 0.5) * 2.0, v, wing);
    vec2 q = mix(vec2(v * 3.0 + uSeed, u * 4.0 - uT * 3.2), vec2(u * 6.0 + uSeed, v * 2.6 - uT * 3.0), wing);
    float n = fbm(q + vec2(fbm(q * 1.9 + 3.1), fbm(q * 1.3 - 1.7)) * 1.1);   // flowing, folded noise: the licks
    float nf = fbm(q * 3.4 + 7.0);   // fine flicker
    // a wing's flight feathers: the trailing edge cut into separate pointed feathers, longest toward the tip
    float fu = u * mix(7.0, 11.0, u), fx = abs(fract(fu) - 0.5) * 2.0;
    float featherCut = wing * smoothstep(0.25, 1.0, v) * fx * fx * 0.55;
    float reach = mix(0.92, mix(0.98, 0.7, smoothstep(0.82, 1.0, u)), wing);
    float a = smoothstep(reach, reach - 0.38, edge + featherCut + (n - 0.5) * 0.85 + (nf - 0.5) * 0.25);
    a *= smoothstep(0.0, mix(0.08, 0.03, wing), mix(u, v, wing));
    a *= mix(smoothstep(1.0, 0.72, u), smoothstep(1.0, 0.9, u), wing);
    float hot = smoothstep(0.6, 0.0, edge + (n - 0.5) * 0.5);
    float streak = mix(1.0, 0.75 + 0.25 * sin(u * 70.0 + n * 6.0), wing * smoothstep(0.15, 0.6, v));   // the feathers' vanes
    vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.3, hot));
    col = mix(col, uC2, smoothstep(0.3, 0.65, hot));
    col = mix(col, uC3, smoothstep(0.75, 1.0, hot));
    col *= (0.9 + 1.2 * hot) * streak * uGain;   // over the bloom's threshold where hot (not more: sheets overlap, brighter burns white)
    gl_FragColor = vec4(col * uHeat, a * uHeat * 0.92); }`;
// a sheet of flowing energy (nu x nv quads), its shape set each frame by mesh.shape((u, v, out) => ...): drawn over the
// scenery (a spirit, never hidden in a cliff), additive
function energySheet(nu, nv, mode, pal, seed, o = {}) {
  const g = new THREE.PlaneGeometry(1, 1, nu, nv), c = pal.map(x => new THREE.Vector3(...x));
  const m = new THREE.ShaderMaterial({ vertexShader: FIRE_SHEET_VS, fragmentShader: ENERGY_FS,
    uniforms: { uT: { value: 0 }, uHeat: { value: 1 }, uMode: { value: mode }, uSeed: { value: seed }, uGain: { value: o.gain ?? 1 }, uC0: { value: c[0] }, uC1: { value: c[1] }, uC2: { value: c[2] }, uC3: { value: c[3] } },
    transparent: true, depthWrite: false, depthTest: !!o.depth, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = o.order || 6;
  const P = g.attributes.position, uv = g.attributes.uv;
  mesh.shape = f => { const t = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { f(uv.getX(i), uv.getY(i), t); P.setXYZ(i, t.x, t.y, t.z); } P.needsUpdate = true; };
  mesh.tick = (t, heat = 1) => { m.uniforms.uT.value = t; m.uniforms.uHeat.value = heat; };
  return mesh;
}
const fireSheet = (nu, nv, mode, seed) => energySheet(nu, nv, mode, PAL.fire, seed);
// a streak of energy along a polyline of points (newest first), w its half width: a comet's tail, a dash, a wave's crest
export function energyStreak(v, pal, n, w, seed, o = {}) {
  const sh = energySheet(Math.max(4, n - 1), 4, 1, pal, seed, o), pts = [];
  v.world.scene.add(sh);
  const cam = () => v.world.camera.position, side = V(0, 0, 0), dir = V(0, 0, 0), view = V(0, 0, 0);
  sh.push = p => { pts.unshift(p.clone()); if (pts.length > n) pts.pop();
    sh.shape((u, vv, t) => { if (pts.length < 2) { t.set(0, -99, 0); return; } const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i, a = pts[i], b = pts[i + 1];
      t.copy(a).lerp(b, k); dir.copy(b).sub(a).normalize(); view.copy(cam()).sub(t).normalize(); side.copy(dir).cross(view).normalize();
      t.addScaledVector(side, (vv - 0.5) * 2 * w * (1 - u * (o.taper ?? 0.8))); }); };
  sh.end = () => sh.parent && sh.parent.remove(sh);
  return sh;
}

// ---------------------------------------------------------------- the spirit sprite: a summoned beast from the original's
// art (its sprite, assets/fx/hd/summon_NN.png, or a sheet of frames), drawn through a shader: it materialises out of
// noise with a burning edge in its palette (k 0 .. 1; back to 0 to dissolve away), an aura of its palette round its
// outline, a shimmer of energy across it, and a flash to white on a blow [the user's call, 2026-10-23: 楊戩's summons
// remade next-gen]. A plane that faces the camera (face()); the sprite fills its middle, a margin left for the aura
const SPIRIT_FS = `uniform sampler2D map; uniform vec2 uRep, uOff; uniform float uK, uAura, uFlash, uT, uPad, uMode, uFlip; uniform vec3 uC1, uC2; varying vec2 vUv;
  ${NOISE}
  float alphaAt(vec2 s){ if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) return 0.0; return texture2D(map, uOff + vec2(mix(s.x, 1.0 - s.x, uFlip), s.y) * uRep).a; }
  void main(){
    vec2 s = (vUv - uPad) / (1.0 - 2.0 * uPad);
    float n = fbm(s * 7.0 + vec2(uT * 0.15, 0.0)), th = uK * 1.35 - 0.2;   // the materialising front: noise under th shows
    float vis = smoothstep(th + 0.02, th - 0.02, n), burn = smoothstep(th - 0.1, th, n) * step(n, th + 0.02) * step(0.001, uK) * step(uK, 0.999);
    if (uMode > 0.5) {   // the aura: the outline's alpha spread round it (a ring of samples at two radii), additive
      float g = 0.0; for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 d = vec2(cos(a), sin(a)); g += alphaAt(s + d * 0.035) + alphaAt(s + d * 0.075) * 0.6; }
      g = clamp(g / 12.0, 0.0, 1.0) * (1.0 - alphaAt(s) * 0.6);
      float flick = 0.75 + 0.25 * fbm(s * 5.0 - vec2(0.0, uT * 1.5));
      gl_FragColor = vec4(mix(uC1, uC2, g) * g * flick * uAura * uK * 1.2, g * uAura * uK); return; }
    vec4 c = texture2D(map, uOff + vec2(mix(s.x, 1.0 - s.x, uFlip), s.y) * uRep); if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) c = vec4(0.0);
    float sh = fbm(s * 9.0 - vec2(0.0, uT * 0.8));
    vec3 col = c.rgb * (0.92 + 0.22 * sh * uAura) + uC1 * 0.06 * uAura;   // a light shimmer of its energy across it (its own colours kept: more washed them white)
    col = mix(col, vec3(1.0), uFlash);
    col += uC2 * burn * 2.5;   // the burning edge of the front
    gl_FragColor = vec4(col, c.a * max(vis, burn)); }`;
function spirit(v, map, h, pal, o = {}) {
  const pad = 0.14, g = new THREE.Group(), c1 = new THREE.Vector3(...pal[1]), c2 = new THREE.Vector3(...pal[3]);
  const mk = mode => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: FIRE_SHEET_VS, fragmentShader: SPIRIT_FS,
    uniforms: { map: { value: map }, uRep: { value: new THREE.Vector2(...(o.rep || [1, 1])) }, uOff: { value: new THREE.Vector2(0, 0) }, uK: { value: 0 }, uAura: { value: o.aura ?? 1 }, uFlash: { value: 0 }, uT: { value: 0 }, uPad: { value: pad }, uMode: { value: mode }, uFlip: { value: 0 }, uC1: { value: c1 }, uC2: { value: c2 } },
    transparent: true, depthWrite: false, depthTest: false, blending: mode ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !mode }));
  const aura = mk(1), body = mk(0); aura.renderOrder = 7; body.renderOrder = 8; g.add(aura, body);
  const U = [aura, body].map(m => m.material.uniforms), set = (k, val) => U.forEach(u => { if (u[k].value && u[k].value.set && Array.isArray(val)) u[k].value.set(...val); else u[k].value = val; });
  let aspect = o.aspect || 1;
  const fit = () => { const im = map.image; if (!o.aspect && im && im.width) aspect = im.width * (o.rep ? o.rep[0] : 1) / (im.height * (o.rep ? o.rep[1] : 1)); const w = h * aspect / (1 - 2 * pad), hh = h / (1 - 2 * pad); for (const m of [aura, body]) m.scale.set(w, hh, 1); };
  fit();
  g.userData = { fit, set, face: () => g.quaternion.copy(v.world.camera.quaternion), frame: (i, n) => set('uOff', [((i % n) + n) % n / n, 0]), flip: on => set('uFlip', on ? 1 : 0) };
  return g;
}
function fireBird(v, scene) {
  const root = new THREE.Group(), parts = [], add = m => { root.add(m); parts.push(m); return m; };
  const wings = [-1, 1].map((side, i) => add(fireSheet(28, 10, 0, 1.7 + i * 5.3))), body = add(fireSheet(16, 8, 1, 9.1)), bodyX = add(fireSheet(16, 6, 1, 12.4));
  const tails = [-1, 0, 1].map((k, i) => add(fireSheet(24, 6, 1, 20 + i * 4.1))), crest = [-1, 0, 1].map((k, i) => add(fireSheet(8, 4, 1, 40 + i)));
  const head = add(fireSheet(10, 6, 1, 50.3));
  const halo = glowCard(v, [1, 0.45, 0.12], 1), core = glowCard(v, [1, 0.85, 0.5], 1), eye = glowCard(v, [1, 0.97, 0.8], 1), light = new THREE.PointLight(0xff7a30, 0, 16, 1.6);
  scene.add(root, halo, core, eye, light); halo.renderOrder = 4; core.renderOrder = 7; eye.renderOrder = 8;
  const bez = (a, b, c, t, out) => out.set((1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1], (1 - t) * (1 - t) * a[2] + 2 * (1 - t) * t * b[2] + t * t * c[2]);
  const up = V(0, 1, 0), M = new THREE.Matrix4(), L = V(0, 0, 0); let T = 0, acc = 0;
  return {
    update(o, dt) {
      T += dt; const fold = o.fold || 0, flap = o.flap, heat = o.heat ?? 1, s = o.s;
      // the bird's frame: x right, y up, z forward (its head)
      const f = o.fwd.clone().normalize(), r = up.clone().cross(f).normalize(), u = f.clone().cross(r).normalize();   // (right-handed: r x u = f; the other order is a reflection, which squashed the bird to a sliver)
      M.makeBasis(r, u, f); root.quaternion.setFromRotationMatrix(M); root.position.copy(o.p); root.scale.setScalar(s);
      // the wings: a leading edge from the shoulder through the wrist to the tip, raised or lowered by the beat and swept
      // back by the fold; each chord running back from it, longest at mid-span (the long flight feathers)
      wings.forEach((w, i) => { const side = i ? 1 : -1;
        const sh = [side * 0.22, 0.05, 0.25], wr = [side * (1.5 - fold * 0.9), 0.35 + 0.9 * flap * (1 - fold), 0.55 - fold * 1.2], tip = [side * (3.3 - fold * 2.4), 1.15 * flap * (1 - fold) - 0.15, -0.3 - fold * 2.2];
        w.shape((uu, vv, t) => { bez(sh, wr, tip, uu, L); const chord = (0.75 + 1.6 * Math.sin(Math.PI * Math.min(1, uu * 1.15))) * (1 - fold * 0.35), droop = -0.25 * vv * vv * (0.4 + flap * 0.4);
          t.set(L.x + side * vv * chord * 0.12 * uu, L.y + droop, L.z - vv * chord); }); });
      // the body: a teardrop along the spine, in two crossed sheets (it reads from any angle)
      const bodyR = zz => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (zz + 1.0) / 2.1))), 0.6);
      body.shape((uu, vv, t) => { const zz = -1.0 + uu * 2.1; t.set(0, (vv - 0.5) * 2 * bodyR(zz), zz); });
      bodyX.shape((uu, vv, t) => { const zz = -1.0 + uu * 2.1; t.set((vv - 0.5) * 2 * bodyR(zz) * 1.25, 0, zz); });   // (the wider: it faces the camera in the reared pose)
      head.shape((uu, vv, t) => { const zz = 0.85 + uu * 0.75, w = 0.26 * Math.sin(Math.PI * Math.min(1, uu * 1.3 + 0.1)) * (1 - uu * 0.6); t.set((vv - 0.5) * 2 * w, 0.1 + uu * 0.12, zz); });   // the head, a beak-pointed flame
      // the crest: three short plumes up and back from the head
      crest.forEach((c, k) => c.shape((uu, vv, t) => { const kk = k - 1, w = 0.1 + 0.12 * Math.sin(Math.PI * uu); t.set(kk * 0.22 * uu + (vv - 0.5) * 2 * w, 0.2 + uu * (0.9 + 0.2 * (1 - Math.abs(kk))), 1.0 - uu * 1.1); }));
      // the tail: three long plumes sweeping back and down, swaying, widening to a flame at their ends
      // (fanning out sideways and curling toward its back, so that reared up they spread like a train, not a beam to the ground)
      tails.forEach((tl, k) => tl.shape((uu, vv, t) => { const kk = k - 1, sway = Math.sin(T * 3.2 + kk * 1.7 - uu * 3.2) * 0.4 * uu, w = 0.18 + 0.38 * Math.sin(Math.PI * Math.min(1, uu * 1.05)) * (0.6 + 0.4 * uu);
        t.set(kk * 1.5 * uu * (0.6 + 0.4 * uu) + sway + (vv - 0.5) * 2 * w, -0.5 * uu - 0.9 * uu * uu + Math.sin(T * 2.4 + kk) * 0.12 * uu, -0.95 - uu * (2.6 + Math.abs(kk) * 0.4)); }));
      for (const m of parts) { m.material.uniforms.uT.value = T; m.material.uniforms.uHeat.value = heat; }
      const headAt = o.p.clone().addScaledVector(f, 0.95 * s).addScaledVector(u, 0.12 * s), cq = v.world.camera.quaternion;
      halo.position.copy(o.p); halo.scale.setScalar(7 * s * (0.92 + 0.08 * Math.sin(T * 9))); halo.material.opacity = 0.28 * heat; halo.quaternion.copy(cq);
      core.position.copy(o.p.clone().addScaledVector(f, 0.2 * s)); core.scale.setScalar(1.5 * s); core.material.opacity = 0.6 * heat; core.quaternion.copy(cq);
      eye.position.copy(headAt); eye.scale.setScalar(0.55 * s); eye.material.opacity = heat; eye.quaternion.copy(cq);
      light.position.copy(o.p).addScaledVector(u, 0.6 * s); light.intensity = 30 * heat * s;
      // embers off the trailing edges and the tail
      acc += dt * 90 * heat * s;
      for (; acc > 1; acc -= 1) { const side = Math.random() < 0.5 ? -1 : 1, wu = Math.random(), tail = Math.random() < 0.35;
        const lp = tail ? V(rand(-0.8, 0.8), -0.4, -1.5 - rand(0, 3)) : V(side * (0.3 + wu * 3 * (1 - fold * 0.7)), 0.3 * flap, -0.4 - wu * 1.2 - fold * wu * 2);
        const q = o.p.clone().addScaledVector(r, lp.x * s).addScaledVector(u, lp.y * s).addScaledVector(f, lp.z * s);
        v.spark(q.x, q.y, q.z, { vx: -f.x * 1.5 + rand(-0.5, 0.5), vy: rand(0.3, 1.4), vz: -f.z * 1.5 + rand(-0.5, 0.5), life: rand(0.5, 1), size: rand(0.03, 0.06) * Math.max(0.6, s), r: 1, gg: rand(0.45, 0.8), b: 0.2, shape: 1 }); }
    },
    dispose() { for (const m of [root, halo, core, eye, light]) m.parent && m.parent.remove(m); for (const m of parts) { m.geometry.dispose(); m.material.dispose(); } },
  };
}
// a fire bird's flight for its life: path(k) gives the pose for k 0-1 of the time; done then
function flyBird(v, scene, life, path, onEnd) {
  const b = fireBird(v, scene); v.timed(new THREE.Object3D(), life, (k, dt) => b.update(path(k), dt), () => { b.dispose(); if (onEnd) onEnd(); }); return b;
}
// 火鳳凰 [ROM fx 55; the user's call, 2026-10-23: remade next-gen]: the world sinks into a red dusk, a ring of fire
// rises round 楊戩 and the phoenix bursts out of it, a great bird of living flame; it beats its wings over him, lighting
// the field orange, and climbs into the sky. Then it dives on the target again and again, one dive landing with each of
// the original's eleven sounds (the first 3.4 s after the cast begins), each a smaller bird of fire with its wings
// folded, striking in a fireball and a shockwave, embers flying, the ground scorched more each time; on the last the
// phoenix itself comes down, in a beat of slow motion, into a pillar of fire; the red burns out to white (over at 9.8 s)
async function summonPhoenix(ctx) {
  const v = ctx.vfx, S = v.world.scene, at = ctx.at.clone(), B = basis(ctx), caster = ctx.caster.pos.clone(), FIRST = 3.4, END = 9.8, FALL = 0.5;
  await intro(ctx, FIRE, { dur: 600, dist: 12, pitch: 0.34 });
  // the red dusk and the ring of fire round the caster
  DARK(ctx, 0.92, 0.45, 0.92, 0.95);   // (deep crimson, as the original's screen: the fire reads against it)
  ctx.cam.shot(caster.clone().add(V(0, 1.4, 0)), { cine: true, dist: 10, pitch: 0.42, yaw: -0.45, speed: 2.2 });
  const g0 = effectH(caster.x, caster.z);
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28; later(i * 18, () => v.realFire(caster.x + Math.cos(a) * 1.3, g0, caster.z + Math.sin(a) * 1.3, { size: rand(0.5, 0.8), life: 1.6 })); }
  v.decal(caster, [1, 0.35, 0.06], 1.8, 2.4, { flicker: true }); v.light(caster.clone().setY(g0 + 0.6), FIRE, 10, 2.4, 6);
  ticker(v, 2.2, () => { for (let i = 0; i < 3; i++) v.spark(caster.x + rand(-3, 3), g0 + rand(0, 0.3), caster.z + rand(-2.5, 2.5), { vy: rand(0.6, 1.6), vx: rand(-0.2, 0.2), life: rand(1.2, 2), size: rand(0.03, 0.06), r: 1, gg: rand(0.4, 0.7), b: 0.15, shape: 1 }); });   // embers rising off the field
  await ctx.wait(500);
  // the phoenix bursts out of the ring, beats its wings over him and climbs away
  v.flash([1, 0.6, 0.3], 0.45); v.shake(0.12, 0.4); v.ring(caster, FIRE, 4, 0.7, { intensity: 1.4 });
  // (reared up over him, its breast to the camera and its wings spread wide across the view, beating; then it turns and
  // climbs away)
  const home = caster.clone().add(B.toCam.clone().multiplyScalar(-0.8)).add(V(0, 2.4, 0)), sky = home.clone().add(B.right.clone().multiplyScalar(3)).add(V(0, 12, 0)), RISE = 2.3;
  ctx.cam.shot(home.clone().add(V(0, -0.6, 0)), { cine: true, dist: 10.5, pitch: 0.36, yaw: -0.45, speed: 2.4 });
  flyBird(v, S, RISE, k => {
    const grow = Math.min(1, k / 0.18), climb = Math.max(0, (k - 0.7) / 0.3), p = home.clone().add(V(0, Math.sin(k * 14) * 0.18 - (1 - grow) * 1.5, 0)).lerp(sky, climb * climb);
    const rear = B.toCam.clone().multiplyScalar(0.45).add(V(0, 1, 0)), away = sky.clone().sub(home).normalize();
    return { p, fwd: rear.lerp(away, Math.min(1, climb * 2)), flap: 0.35 + 0.65 * Math.sin(k * RISE * 7.5), s: 0.4 + 0.65 * grow, heat: 1 };
  });
  await ctx.wait(1400); ctx.cam.shot(home.clone().add(V(0, 2.5, 0)), { cine: true, dist: 11, pitch: 0.42, yaw: -0.35, speed: 1.4 });   // the camera follows it up
  // the dives
  await ctx.until(FIRST - FALL - 0.5);
  ctx.cam.shot(at.clone().add(V(0, 0.8, 0)), { cine: true, dist: 10.5, pitch: 0.55, yaw: 0.35, speed: 1.8 });
  const last = ctx.track.length - 1;
  let scorch = 0;
  const dive = k => {
    const big = k === last, side = [-1, 1, -0.5, 0.8, -0.9, 0.3][k % 6], from = at.clone().addScaledVector(B.right, side * (big ? 4 : 6)).add(V(0, big ? 12 : 9, 0)).addScaledVector(B.toCam, -2), tg = at.clone().setY(at.y + 0.6);
    const fall = big ? FALL * 1.6 : FALL;
    const trail = v.ribbon({ col: FIRE, width: big ? 1.2 : 0.6, n: 24, fade: 0.5 });
    flyBird(v, S, fall, q => { const e = q * q, p = from.clone().lerp(tg, e); trail.push(p); return { p, fwd: tg.clone().sub(from), flap: big ? 0.3 : 0, fold: big ? 0.35 : 0.85, s: big ? 1.1 : 0.5, heat: 1 }; }, () => {
      trail.end();
      v.explode(tg, big ? 1.3 : 0.7, { n: big ? 30 : 14 }); v.impact(tg, FIRE, big ? 2 : 1.1); v.ring(at, [1, 0.55, 0.2], big ? 6 : 3, big ? 0.8 : 0.5, { intensity: big ? 2 : 1.2 });
      v.light(tg, [1, 0.6, 0.3], big ? 40 : 18, big ? 0.8 : 0.35, 8); v.shake(big ? 0.35 : 0.14, big ? 0.6 : 0.25); glowTargets(ctx, big ? 1 : 0.6, 0.3);
      for (let i = 0; i < (big ? 70 : 24); i++) { const a = rand(0, 6.28), sp = rand(2, big ? 9 : 5); v.spark(tg.x, tg.y, tg.z, { vx: Math.cos(a) * sp, vy: rand(2, big ? 9 : 5), vz: Math.sin(a) * sp, g: 12, life: rand(0.6, 1.2), size: rand(0.03, 0.07), r: 1, gg: rand(0.5, 0.85), b: 0.25, shape: 1, floor: at.y + 0.02 }); }   // embers thrown
      scorch = Math.min(1, scorch + 0.12); v.decal(at, [0.08, 0.02, 0], 1.2 + scorch * 1.4, big ? 6 : 3, {});   // the ground scorched more each time
      if (k % 3 === 2) v.flash([1, 0.9, 0.8], 0.4);
      if (!k) ctx.cue();   // (the first dive's blow: the sound track from here)
      if (big) {
        v.hitstop = 0.18; v.flash([1, 0.95, 0.85], 0.7);
        v.pillar(at, [1, 0.5, 0.15], 1.1, 9, 1.2, { intensity: 2 });
        for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; v.realFire(at.x + Math.cos(a) * rand(0.6, 1.6), at.y, at.z + Math.sin(a) * rand(0.6, 1.6), { size: rand(0.7, 1.1), life: 1.8 }); }
        ctx.hit();
      }
    });
  };
  for (let k = 0; k <= last; k++) {
    const big = k === last;
    if (big) ctx.cam.shot(at.clone().add(V(0, 1.2, 0)), { cine: true, dist: 8, pitch: 0.42, yaw: 0.6, speed: 2 });   // closer, lower, for the phoenix's own dive
    await ctx.until(FIRST + ctx.track[k] - (big ? FALL * 1.6 : FALL)); dive(k);
  }
  await ctx.until(FIRST + ctx.track[last] + 0.4);
  // the red burns out to white, and the world comes back, embers drifting down over the scorched ground
  ctx.cam.shot(at.clone().add(V(0, 1, 0)), { cine: true, dist: 11, pitch: 0.5, yaw: 0.4, speed: 1.2 });
  ticker(v, 1.1, q => { v.flash([1, 0.85, 0.75], 0.6 * Math.sin(q * Math.PI)); if (q > 0.5) DARK(ctx, 0.92 * (1 - q) * 2, 0.45, 0.92, 0.95); });
  ticker(v, 1.4, () => { for (let i = 0; i < 2; i++) v.spark(at.x + rand(-2.5, 2.5), at.y + rand(2, 4), at.z + rand(-2, 2), { vy: -rand(0.3, 0.7), vx: rand(-0.3, 0.3), life: rand(1.2, 1.8), size: rand(0.03, 0.05), r: 1, gg: rand(0.4, 0.6), b: 0.15, shape: 1 }); });
  await ctx.until(END); outro(ctx);
}
// 麒麟獸 [ROM fx 56; remade next-gen, 2026-10-23]: the qilin materialises in jade fire and gallops in an arc across the
// field, green flames rising from its hoofprints; then the sky answers it: with each of the original's eleven sounds (the
// first 3.9 s after the cast begins) a column of golden lightning strikes a cell of the area, splitting the ground and
// throwing a ring of plasma, the last three whiting out the screen, the last striking every cell (over at 10.7 s)
async function summonQilin(ctx) {
  const v = ctx.vfx, S = v.world.scene, cells = cellsOf(ctx), c0 = mid(cells), B = basis(ctx), gold = [1, 0.9, 0.35], FIRST = 3.9, END = 10.7;
  await intro(ctx, gold, { dur: 600, dist: 13.5, pitch: 0.38 });
  DARK(ctx, 0.9, 0.9, 0.8, 0.6);   // (a storm night, blue: gold lightning stands out against it; a green dark read as plain dim grassland)
  ctx.cam.shot(c0.clone().add(V(0, 0.8, 0)), { cine: true, dist: 12, pitch: 0.42, yaw: -0.25, speed: 1.8 });
  // the gallop: an arc in front of the area, left to right
  const a = c0.clone().addScaledVector(B.right, -6).addScaledVector(B.toCam, 1.6), b = c0.clone().addScaledVector(B.right, 6).addScaledVector(B.toCam, 1.6), mid2 = c0.clone().addScaledVector(B.toCam, 3.4);
  const g = beast(v, 56, 2.3, PAL.jade); S.add(g); const RUN = 2.6; let lastStep = 0;
  v.timed(g, RUN, (k, dt, t) => { const U = g.userData; U.fit(); U.face(); U.set('uT', t); U.set('uK', Math.min(1, t / 0.6) * Math.min(1, (RUN - t) / 0.5)); U.flip(false);
    const p = bezier(a, mid2, b, k); g.position.copy(p).setY(effectH(p.x, p.z) + 1.25 + Math.abs(Math.sin(k * 26)) * 0.12);
    if (t - lastStep > 0.09) { lastStep = t; const q = p.clone(); q.y = effectH(q.x, q.z); v.decal(q, [0.1, 0.9, 0.35], 0.25, 2.2, {}); for (let i = 0; i < 3; i++) v.flame(q.x + rand(-0.2, 0.2), q.y, q.z + rand(-0.2, 0.2), { size: rand(0.25, 0.4), asp: 2, life: 0.8, vy: 1, tint: [0.45, 1.3, 0.45] }); }
    v.light(g.position, [0.4, 1, 0.5], 10, 0.05, 6); });
  // the strikes
  const last = ctx.track.length - 1;
  const strike = k => {
    const big = k === last, pick = big ? cells : [cells[k % cells.length]];
    for (const c of pick) {
      const top = c.clone().setY(c.y + 12), col = energySheet(4, 6, 1, PAL.gold, k * 1.7 + c.x), W = big ? 1.1 : 0.85;
      S.add(col); col.shape((u, vv, t) => { t.copy(c).addScaledVector(B.right, (vv - 0.5) * 2 * W * (1 - u * 0.4)); t.y = c.y + u * 12; });   // (across the camera's view)
      let T = 0; v.timed(col, 0.9, (q, dt) => { T += dt; col.tick(T, (1 - q) * (1 - q)); });
      // the bolts: a trunk and branches forking off it, flickering a moment (they were thin and gone in an instant)
      for (let j = 0; j < 3; j++) later(j * 60, () => { v.bolt(top.clone().add(V(rand(-0.5, 0.5), 0, rand(-0.4, 0.4))), c.clone().setY(c.y + 0.1), gold, 0.35, { width: 0.13 });
        const fork = c.clone().setY(c.y + rand(3, 7)); v.bolt(fork, fork.clone().add(V(rand(-1.8, 1.8), -rand(1.5, 3), rand(-1, 1))), [1, 0.95, 0.7], 0.25, { width: 0.06 }); });
      v.pillar(c, gold, W * 0.5, 9, 0.6, { intensity: 2 });
      v.decal(c, [0.04, 0.02, 0.0], 0.9, END, {}); v.ring(c, [1, 0.95, 0.6], big ? 2.6 : 1.8, 0.4, { intensity: 1.8 }); v.light(c.clone().setY(c.y + 1), gold, big ? 30 : 16, 0.3, 7);
      v.burst(c.clone().setY(c.y + 0.2), { n: 14, speed: 3.5, cols: [[1, 1, 0.85], gold], size: 0.05, life: 0.5 });
    }
    v.flash([1, 0.97, 0.8], k >= last - 2 ? 0.42 : 0.18); v.shake(big ? 0.3 : 0.12, 0.25); glowTargets(ctx, big ? 1 : 0.5, 0.25);
    if (big) { v.hitstop = 0.12; ctx.hit(); } };
  for (let k = 0; k <= last; k++) { await ctx.until(FIRST + ctx.track[k]); if (!k) ctx.cue(); strike(k); }
  await ctx.until(END); outro(ctx);
}
// 四不像 [ROM fx 57; remade next-gen, 2026-10-23]: streaks of gold light zigzag across the field, the beast materialises
// out of them and rises; with the original's first sound (3.5 s after the cast begins) it sends out crescent waves of ice
// light that sweep across the area, then orbs of spirit light burst over it, one with each of its forty more sounds,
// each a star of light with a shockwave, a white flash on every fifth (the effect over at 13.3 s)
async function summonSibuxiang(ctx) {
  const v = ctx.vfx, S = v.world.scene, cells = cellsOf(ctx), c0 = mid(cells), B = basis(ctx), col = [0.8, 0.7, 1], gold = [1, 0.9, 0.4], FIRST = 3.5, END = 13.3;
  await intro(ctx, gold, { dur: 600, dist: 13.5, pitch: 0.38 });
  DARK(ctx, 0.9, 0.8, 0.85, 0.7);   // (a violet night)
  const home = c0.clone().add(B.right.clone().multiplyScalar(-2.6)).add(B.toCam.clone().multiplyScalar(-0.6)); home.y = effectH(home.x, home.z) + 1.6;
  ctx.cam.shot(home.clone().lerp(c0, 0.5).add(V(0, 1.4, 0)), { cine: true, dist: 12.5, pitch: 0.42, yaw: 0.25, speed: 1.8 });   // (the beast's head in frame)
  // the gold streaks: zigzags of light weaving across the view
  for (let i = 0; i < 5; i++) later(i * 140, () => { const st = energyStreak(v, PAL.gold, 22, 0.14, i * 2.3, { taper: 0.9 }), y = home.y + rand(-0.5, 2), z0 = rand(-2, 2);
    ticker(v, 0.9, k => st.push(home.clone().addScaledVector(B.right, -6 + k * 12).addScaledVector(B.toCam, z0 + Math.sin(k * 14 + i) * 1.2).setY(y + Math.sin(k * 9 + i * 2) * 0.6)), () => later(300, () => st.end())); });
  beastIn(ctx, 57, 3.1, home, gold, { life: END - 1.8, pal: PAL.gold, move: (g, t) => { g.position.y = home.y + Math.min(1, Math.max(0, t - 1.6)) * 1.2 + Math.sin(t * 2) * 0.1; } });
  // the crescent waves of ice light
  await ctx.until(FIRST); ctx.cue();
  ctx.cam.shot(c0.clone().add(V(0, 0.6, 0)), { cine: true, dist: 12.5, pitch: 0.42, yaw: 0.3, speed: 1.6 });
  const R = spreadOf(cells) + 2;
  for (let w = 0; w < 3; w++) later(w * 160, () => { const sh = energySheet(24, 4, 1, PAL.water, w * 4.4); S.add(sh); let T = 0;
    v.timed(sh, 1.0, (k, dt) => { T += dt; sh.tick(T, 1 - k * k); const r0 = 0.8 + k * (R + 2) * 1.4; sh.shape((u, vv, t) => { const a = (u - 0.5) * 2.4 + 0.0, r = r0 + (vv - 0.5) * 1.3; const d = B.toCam.clone().multiplyScalar(Math.cos(a)).addScaledVector(B.right, Math.sin(a)); t.copy(home).setY(c0.y + 0.6 + (vv - 0.5) * 0.9).addScaledVector(d, r).addScaledVector(B.right, k * 2); }); }); });
  // the orbs of spirit light, one with each sound after the waves'
  const last = ctx.track.length - 1, orbAt = (i, c) => {
    // (all over the field round the area, as the original's burst all over the screen; a few on the targets themselves)
    const a = rand(0, 6.28), rr = i % 4 === 0 ? rand(0, 0.5) : rand(0.8, 3.2), q = c.clone().addScaledVector(B.right, Math.cos(a) * rr).addScaledVector(B.toCam, Math.sin(a) * rr * 0.7); q.y = effectH(q.x, q.z);
    const p = q.clone().add(V(0, rand(0.6, 1.6), 0)), g = orb(v, col, 0.8); g.position.copy(p);
    v.timed(g, 0.55, k => { g.scale.setScalar(0.5 + k * 2.4); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; });
    star(v, p, [0.95, 0.9, 1], 1.6, 0.4);
    v.ring(q, col, 2.2, 0.45, { intensity: 1.4 }); v.light(p, col, 9, 0.25, 5); if (i % 5 === 0) v.flash([0.92, 0.88, 1], 0.15); v.shake(0.05, 0.1);   // (lights and flashes kept low: forty of them overlap)
    for (let j = 0; j < 8; j++) { const a = rand(0, 6.28), sp = rand(1.5, 3); v.spark(p.x, p.y, p.z, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(-1, 1), life: 0.4, size: 0.04, r: 0.85, gg: 0.85, b: 1, shape: 1 }); } };
  for (let i = 1; i <= last; i++) { await ctx.until(FIRST + ctx.track[i]); orbAt(i, cells[Math.floor(rand(0, cells.length))]); }
  await ctx.wait(200);
  v.flash([1, 1, 1], 0.6); glowTargets(ctx, 1); ctx.hit(); await ctx.until(END); outro(ctx);
}
// a four-pointed star of light (a lens glint) at p, size s, for life seconds: two crossed energy streaks, a hot core
function star(v, p, col, s, life) {
  const g = glowCard(v, col, s * 1.6); g.position.copy(p); g.renderOrder = 9; g.material.depthTest = false;
  const rays = [0, 1].map(i => { const r = glowCard(v, col, 1); r.material.depthTest = false; r.renderOrder = 9; return r; });
  const grp = new THREE.Group(); grp.add(g, ...rays);
  v.timed(grp, life, k => { const f = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k); g.material.opacity = f; rays.forEach((r, i) => { r.position.copy(p); r.quaternion.copy(v.world.camera.quaternion); r.rotateZ(i ? Math.PI / 4 : -Math.PI / 4 + 0.785); r.scale.set(s * 3.2 * (0.6 + k), s * 0.12, 1); r.material.opacity = f; }); g.quaternion.copy(v.world.camera.quaternion); });
}
// 哮天犬 [ROM fx 52; remade next-gen, 2026-10-23]: with its cry (the original's first sound, 0.9 s after the cast
// begins) a rift of silver mist opens beside the target and the hound materialises out of it, a spirit of silver-blue
// light galloping in, afterimages streaming behind it; it gathers itself and lunges through the target as a streak of
// light; with the original's second sound (1.95 s) its fangs close in two crossing crescents, a shockwave rings out and
// the screen whites out as the original's does (the effect over at 3.2 s)
async function houndNext(ctx) {
  const v = ctx.vfx, S = v.world.scene, B = basis(ctx), at = ctx.at.clone(), FIRST = 0.92, BITE = 1.95, END = 3.2;
  await intro(ctx, [0.6, 0.85, 1], { dur: 300, dist: 10, pitch: 0.38, yaw: -0.9 });
  DARK(ctx, 0.5, 0.9, 0.75, 0.5);   // (a dimmed blue: the original keeps its field lit until the whiteout)
  ctx.cam.shot(at.clone().addScaledVector(B.right, 1.4).add(V(0, 0.7, 0)), { cine: true, dist: 9, pitch: 0.5, yaw: -0.2, speed: 2.6 });   // (high enough that trees in front do not hide the target)
  await ctx.until(FIRST); ctx.cue();
  const start = at.clone().addScaledVector(B.right, 4.6), near = at.clone().addScaledVector(B.right, 1.6), past = at.clone().addScaledVector(B.right, -4);
  // the rift
  const rift = start.clone(); rift.y = effectH(rift.x, rift.z); v.ring(rift, [0.7, 0.85, 1], 2.2, 0.6, { intensity: 1.6 }); v.light(rift.clone().setY(rift.y + 1), [0.6, 0.8, 1], 18, 0.6, 6);
  for (let i = 0; i < 16; i++) v.smokePuff(rift.x + rand(-0.6, 0.6), rift.y + rand(0, 1.2), rift.z + rand(-0.4, 0.4), { vy: 0.4, life: 1.2, size: 0.5, size1: 1.3, tint: [0.6, 0.7, 0.95] });
  const tex = houndRunTex(), g = spirit(v, tex, 1.7, PAL.silver, { rep: [0.25, 1], aspect: 2 }); S.add(g);
  const IN = BITE - FIRST - 0.28, ghosts = [];
  let streak = null;
  v.timed(g, END - FIRST - 0.2, (k, dt, t) => {
    const U = g.userData; U.fit(); U.face(); U.set('uT', t); U.flip(true);
    const run = t < IN ? t / IN : 1 + (t - IN) / 0.18, p = run <= 1 ? start.clone().lerp(near, run) : near.clone().lerp(past, Math.min(1, run - 1));
    g.position.copy(p).setY(effectH(p.x, p.z) + 0.85 + (run <= 1 ? Math.abs(Math.sin(t * 15)) * 0.1 : 0.15));
    U.frame(Math.floor(t * 14), 4); U.set('uK', Math.min(1, t / 0.35) * (run > 1.7 ? Math.max(0, 1 - (run - 1.7) * 3) : 1));
    if (run > 1 && !streak) { streak = energyStreak(v, PAL.silver, 16, 0.55, 3.3); }
    if (streak) streak.push(g.position);
    // afterimages left behind it, faint and under it (on top of it, white, they washed the hound out to a pale blob)
    if (t - (g.userData.lastGhost || 0) > (run > 1 ? 0.025 : 0.07)) { g.userData.lastGhost = t; const gh = spirit(v, tex, 1.7, PAL.silver, { rep: [0.25, 1], aspect: 2, aura: 0.6 }); S.add(gh); gh.position.copy(g.position); gh.userData.frame(Math.floor(t * 14), 4); gh.userData.flip(true);
      gh.children.forEach(m => { m.renderOrder -= 3; }); v.timed(gh, 0.28, q => { gh.userData.face(); gh.userData.set('uK', 0.4 * (1 - q)); gh.userData.set('uFlash', 0.25); }); }
    if (run <= 1 && Math.random() < 0.5) dustBurst(v, p.clone().setY(effectH(p.x, p.z)), 0.25);
  }, () => streak && later(200, () => streak.end()));
  // the bite
  await ctx.until(BITE);
  const bp = at.clone().setY(at.y + 0.6);
  for (const sgn of [-1, 1]) { const fang = energySheet(16, 4, 1, PAL.silver, sgn * 7); S.add(fang); let T = 0;
    v.timed(fang, 0.35, (k, dt) => { T += dt; fang.tick(T, 1 - k); const sweep = Math.min(1, k * 3); fang.shape((u, vv, t) => { const a = (u - 0.5) * 2.4 * sweep, r = 0.95 + (vv - 0.5) * 0.25; t.copy(bp).addScaledVector(B.right, Math.sin(a) * r).add(V(0, sgn * (0.55 - Math.cos(a) * r * 0.55), 0)).addScaledVector(B.toCam, 0.3); }); }); }
  v.impact(bp, [0.7, 0.85, 1], 1.2); v.ring(at, [0.75, 0.9, 1], 3.2, 0.55, { intensity: 1.8 }); v.shake(0.2, 0.35); v.hitstop = 0.1; glowTargets(ctx, 1, 0.3);
  ticker(v, 0.75, k => v.flash([0.93, 0.97, 1], 0.72 * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8)));   // (the whiteout rising just after the fangs close, so they are seen)
  ctx.hit(); await ctx.until(END); outro(ctx);
}

// ---------------------------------------------------------------- the spells, by id
export const SPELLBOOK = {
  2: c => swordStorm(c, [0.45, 0.85, 1]), 3: c => swordWheel(c, [0.5, 0.88, 1], 12, 2, 4.4, 7.0), 6: rainbowDash, 7: c => swordWheel(c, [1, 0.55, 0.3], 16, 2, 3.42, 6.52),
  8: earthSplit, 9: crossSlash, 10: bladeOrbit, 11: bladeCyclone,
  13: c => arrowVolley(c, [1, 0.6, 0.25], [0.45, 0.8, 0.5]), 14: arrowStorm, 15: hurricane, 17: c => arrowVolley(c, [0.8, 0.5, 1], [0.55, 0.4, 0.8]),
  18: burstFist, 19: fiveQi, 20: quake, 21: risingDragon,
  24: inferno, 25: skyFire, 27: iceSplit, 28: blizzard, 29: iceAvalanche,
  31: fiveThunder, 32: thunderStorm, 33: greatThunder,
  34: lightBurst, 35: heavenWrath, 36: corpseQi, 37: blackGale,
  39: mpColumn, 41: hearts, 42: guanyin, 43: revive,
  46: c => diamondGuard(c, [0.45, 0.75, 1], 4.3), 47: c => diamondGuard(c, [1, 0.85, 0.4], 4.68), 48: c => shieldBreak(c, [0.55, 0.45, 0.75], 1.63, 2.9), 49: c => shieldBreak(c, [0.6, 0.35, 0.7], 1.95, 3.22), 50: sealTalisman,
  52: houndNext, 54: summonTiger, 55: summonPhoenix, 56: summonQilin, 57: summonSibuxiang,
};
