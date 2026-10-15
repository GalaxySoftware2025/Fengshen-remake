// The rest of the spell set-pieces, one per spell id the ROM has (src/spells.js holds the first ones and the dispatch).
// Each follows the original's own effect (captured from the ROM, cast by 林雲 on 磻溪: the beats, the order, the
// silhouette) rebuilt in 3D after DESIGN §5: one clear silhouette, a single readable impact beat, ctx.hit() on it.
// Area spells play over ctx.cells (the cells the spell covers, from battle.js spellCtx). The summoned beasts, 觀音 and
// the skull wisps are the original's own sprites (assets/fx/<name>.png, cut out of the ROM's plane A / sprite layer
// during the cast; xBR 4x in assets/fx/hd): ROM-derived, keep private.
import * as THREE from 'three';
import { rand, groundH } from './world.js';
import { NOISE } from './vfx.js';
import { V, ease, basis, swordMesh, pointAlong, bezier, intro, outro, DARK, ticker, facing, yawOf, swirl, arrowMesh, flameRing, talismanTex, petalGeo } from './spellkit.js';

// ---------------------------------------------------------------- shared pieces
// the area, nearest the aimed cell first, each point on the ground
const cellsOf = ctx => (ctx.cells && ctx.cells.length ? ctx.cells : [ctx.at]).map(c => c.clone().setY(groundH(c.x, c.z)))
  .sort((a, b) => a.distanceTo(ctx.at) - b.distanceTo(ctx.at));
const spreadOf = cells => cells.reduce((m, c) => Math.max(m, c.distanceTo(cells[0])), 0);   // 0 one cell, 1 a cross, 2 the big diamond
const later = (ms, fn) => setTimeout(fn, ms);
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
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, groundH(p.x, p.z) + 0.035, p.z); m.renderOrder = 3;
  return v.timed(m, life, (k, dt, t) => { const g = Math.min(1, t / (o.grow || 0.4)); m.scale.setScalar(0.3 + 0.7 * g); m.material.opacity = (o.a || 0.7) * g * Math.min(1, (life - t) / 0.3); });
}
// a glowing crack across the ground from a to b: a dark fissure with a hot seam, opening over `open` seconds
function crack(v, a, b, col, life, o) {
  o = o || {};
  const n = 14, pts = [], d = b.clone().sub(a), side = V(-d.z, 0, d.x).normalize();
  for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t).add(side.clone().multiplyScalar(i && i < n ? rand(-0.18, 0.18) : 0)); p.y = groundH(p.x, p.z) + 0.04; pts.push(p); }
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
const ICE = () => new THREE.MeshPhongMaterial({ color: 0xbfeaff, emissive: 0x2a7fd0, emissiveIntensity: 0.9, specular: 0xffffff, shininess: 140, flatShading: true, transparent: true, opacity: 0.88 });
const ICE_COLS = [[1, 1, 1], [0.7, 0.9, 1], [0.45, 0.75, 1]];
function crystals(v, P, n, scale, hold, mat) {
  mat = mat || ICE();
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), r = i === 0 ? 0 : rand(0.2, 0.75) * scale, h = (i === 0 ? 1.7 : rand(0.5, 1.3)) * scale;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat); m.scale.setScalar(0.001);
    const p = V(P.x + Math.cos(a) * r, groundH(P.x, P.z), P.z + Math.sin(a) * r);
    m.position.copy(p); m.rotation.set(rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2), rand(0, 6), rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2));
    v.timed(m, hold + 0.1, (k, dt, t) => {
      const g = Math.min(1, Math.max(0, (t - i * 0.03) / 0.14)), w = (i === 0 ? 0.22 : 0.15) * scale;
      m.scale.set(w * g + 0.001, h * g + 0.001, w * g + 0.001);
      if (t > hold && !m.userData.b) { m.userData.b = 1; m.visible = false;
        v.burst(p.clone().setY(p.y + h * 0.5), { n: 14, speed: 3.5, cols: ICE_COLS, size: 0.06, life: 0.8, g: 9, shape: 1 }); }
    });
  }
  v.burst(P.clone().setY(P.y + 0.2), { n: 24, speed: 4, cols: ICE_COLS, size: 0.06, life: 0.7, g: 8, shape: 1 });
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
const STORM = (v, at, n, w, h, tint) => { for (let i = 0; i < n; i++) v.smokePuff(at.x + rand(-w, w), at.y + rand(h, h + 1.5), at.z + rand(-w, w), { vx: rand(-0.3, 0.3), life: 3, size: 2.2, size1: 3.4, tint: tint || [0.12, 0.12, 0.17] }); };
const look = (ctx, p, o) => ctx.cam.shot(p, Object.assign({ dist: 10, pitch: 0.42, yaw: -0.25 }, o));   // a new framing mid-spell
const mid = cells => cells.reduce((s, c) => s.add(c), V(0, 0, 0)).multiplyScalar(1 / cells.length);

// ---------------------------------------------------------------- swords (林雲, 姬發)
// 萬劍訣: [ROM fx 2] shadows spread over the whole area, then swords rain down into every cell and a white flash
async function swordStorm(ctx, col) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells);
  await intro(ctx, col, { dur: 900, dist: 13, pitch: 0.5 });
  DARK(ctx, 0.4, 1, 0.85, 0.6);
  const sky = c0.clone().setY(c0.y + 4.6);
  const disc = v.runeCircle(sky, col, 3.4, 3.2, { spin: 1.2, intensity: 1.6 }); disc.position.y = sky.y;
  v.light(sky, col, 35, 3, 14);
  for (const c of cells) shadowDisc(v, c, 0.45, 2.6, { grow: 0.9, a: 0.55 });
  await ctx.wait(700);
  const drops = cells.flatMap(c => [c, c, c].map(() => c.clone().add(V(rand(-0.35, 0.35), 0, rand(-0.35, 0.35))))).sort(() => Math.random() - 0.5);
  drops.forEach((land, i) => {
    land.y = groundH(land.x, land.z);
    const st = land.clone().add(V(rand(-0.4, 0.4), 5.2, rand(-0.4, 0.4))), s = swordMesh(col, 0.8), rib = v.ribbon({ col, width: 0.06, n: 10 }), d = i * (1.25 / drops.length);
    v.timed(s, d + 1.3, (k, dt, t) => {
      if (t < d) { s.visible = false; return; } s.visible = true;
      const f = Math.min(1, (t - d) / 0.2), p = st.clone().lerp(land, f); s.position.copy(p); pointAlong(s, st.clone().sub(land));
      if (f < 1) rib.push(p.clone().add(st.clone().sub(land).normalize().multiplyScalar(0.9)));
      else if (!s.userData.hit) { s.userData.hit = 1; rib.end(); v.burst(land.clone().setY(land.y + 0.1), { n: 8, speed: 2.2, col, size: 0.05, life: 0.45 }); v.ring(land, col, 0.6, 0.3); if (i % 3 === 0) v.shake(0.05, 0.1); }
      if (t > d + 1.0) s.scale.setScalar(0.8 * Math.max(0.001, 1 - (t - d - 1.0) / 0.3));
    });
  });
  await ctx.wait(1500);
  v.flash([0.85, 0.95, 1], 0.45); v.impact(c0, col, 1.3); v.ring(c0, col, 5, 0.8, { intensity: 1.2 }); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 天劍訣 / 怒劍式: [ROM fx 3, 7] swords fan out into a spinning wheel over the target, then dive into it one after
// another from every side, each strike flashing; the last ones together
async function swordWheel(ctx, col, n, rounds) {
  const v = ctx.vfx, at = ctx.at.clone(), B = basis(ctx);
  await intro(ctx, col, { dur: 900, dist: 9.5, pitch: 0.36 });
  DARK(ctx, 0.5, 1, 0.85, 0.65);
  const hub = at.clone().setY(at.y + 2.6), R = 1.5, swords = [];
  v.light(hub, col, 22, 3.6, 8);
  const hubGlow = glowCard(v, col, 1.4); hubGlow.position.copy(hub); v.timed(hubGlow, 2.9, (k, dt, t) => { hubGlow.material.opacity = Math.min(1, t * 2) * (0.6 + 0.2 * Math.sin(t * 20)) * (1 - k * k); });
  let spin = 0, spinV = 1;
  ticker(v, 3.6, (k, dt, t) => { spinV = t < 1.2 ? 1 + t * 5 : 7; spin += dt * spinV; });
  for (let i = 0; i < n; i++) {
    const s = swordMesh(col, 1.05), rib = v.ribbon({ col, width: 0.08, n: 14 }); swords.push(s);
    const a0 = i / n * Math.PI * 2, launch = 1.45 + (i % Math.ceil(n / rounds)) * (1.2 / Math.ceil(n / rounds)) + Math.floor(i / Math.ceil(n / rounds)) * 0.15, appear = i * 0.05;
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
  await ctx.wait(2750);
  v.flash([1, 1, 1], 0.5); v.impact(at, col, 1.5); v.decal(at, col, 1.5, 1.4, { intensity: 0.8 }); v.hitstop = 0.12;
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 長虹貫日: [ROM fx 6] one sword streaks back and forth across the area like a rainbow, cutting every cell, then a flash
async function rainbowDash(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = Math.max(1.5, spreadOf(cells) + 1.2);
  const hues = [[0.7, 0.08, 0.08], [0.7, 0.45, 0.04], [0.15, 0.6, 0.12], [0.08, 0.3, 0.75], [0.4, 0.1, 0.65]], bright = hues.map(c => c.map(x => Math.min(1, x * 1.3 + 0.3)));
  await intro(ctx, [1, 0.95, 0.8], { dur: 800, dist: 12.5, pitch: 0.5 });
  DARK(ctx, 0.42, 0.9, 0.85, 0.75);
  const s = swordMesh([1, 0.95, 0.85], 0.95), passes = 6, pts = [];
  for (let i = 0; i <= passes; i++) { const a = i * (Math.PI * 4 / 5) + 0.3; pts.push(c0.clone().add(V(Math.cos(a) * R, 0.6 + (i % 2) * 0.25, Math.sin(a) * R))); }
  const ribs = hues.map((c, j) => [j, v.ribbon({ col: c, width: 0.08, n: 34, fade: 0.6, taper: 0.3 })]);
  const per = 0.26, life = per * passes;
  v.timed(s, life + 0.05, (k, dt, t) => {
    const i = Math.min(passes - 1, Math.floor(t / per)), f = Math.min(1, (t - i * per) / per), a = pts[i], b = pts[i + 1];
    const p = a.clone().lerp(b, ease(f)); s.position.copy(p); pointAlong(s, b.clone().sub(a).negate());
    const up = V(0, 1, 0); for (const [j, r] of ribs) r.push(p.clone().add(up.clone().multiplyScalar((j - 2) * 0.13)));
    for (const c of cells) if (!c.userData && c.distanceTo(p.clone().setY(c.y)) < 0.5) { c.userData = 1; v.burst(c.clone().setY(c.y + 0.5), { n: 12, speed: 3, cols: bright, size: 0.05, life: 0.5, g: 2 }); v.ring(c, [1, 0.95, 0.8], 0.7, 0.3); }
  }, () => { for (const [, r] of ribs) r.end(); s.visible = false; });
  ticker(v, life, () => {}); await ctx.wait(life * 1000 + 100);
  // the sword dives into the middle of the area: a rainbow ring and a white flash
  v.flash([1, 1, 1], 0.55); v.shake(0.18, 0.3);
  bright.forEach((c, j) => v.ring(c0, c, 2.2 + j * 0.6, 0.8 + j * 0.06, { intensity: 1.2 }));
  for (const c of cells) v.burst(c.clone().setY(c.y + 0.4), { n: 10, speed: 3, cols: bright, size: 0.05, life: 0.6 });
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}

// ---------------------------------------------------------------- blades (黃天化)
const AMBER = [1, 0.7, 0.35];
// 地裂刀: [ROM fx 8] a broad blade plunges into the ground and the earth splits open under the target
async function earthSplit(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), cp = ctx.caster.pos.clone(), dir = facing(cp, at), stab = at.clone().sub(dir.clone().multiplyScalar(0.75)); stab.y = groundH(stab.x, stab.z);
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
// shaking under every pass
async function bladeOrbit(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], R = Math.max(1, spreadOf(cells));
  await intro(ctx, AMBER, { dur: 800, dist: 12.5, pitch: 0.5 });
  DARK(ctx, 0.42, 0.6, 0.8, 0.95);
  const s = swordMesh([1, 0.8, 0.5], 1.5), rib = v.ribbon({ col: AMBER, width: 0.2, n: 30, fade: 0.4 }), core = v.ribbon({ col: [1, 1, 1], width: 0.05, n: 20 });
  const life = 2.0;
  v.timed(s, life, (k, dt, t) => {
    const r = 0.8 + (R + 0.2) * Math.max(0, (t - 0.5) / 1.2), a = t * 9, p = c0.clone().add(V(Math.cos(a) * r, 0.55 + Math.sin(t * 5) * 0.1, Math.sin(a) * r));
    s.position.copy(p); const tan = V(-Math.sin(a), 0, Math.cos(a)); pointAlong(s, V(Math.cos(a), 0.25, Math.sin(a))); s.rotateY(0.3); rib.push(p.clone().add(tan.multiplyScalar(-0.2))); core.push(p);
    for (const c of cells) if (!c.userData && t > 0.5 && c.distanceTo(p.clone().setY(c.y)) < 0.55) { c.userData = 1; v.ring(c, AMBER, 1.2, 0.4); dustBurst(v, c, 0.45); v.burst(c.clone().setY(c.y + 0.4), { n: 10, speed: 3, cols: [[1, 1, 1], AMBER], size: 0.05, life: 0.5 }); v.shake(0.06, 0.12); }
    if (k > 0.9) s.scale.setScalar(1.5 * (1 - (k - 0.9) * 10) + 0.01);
  }, () => { rib.end(); core.end(); });
  await ctx.wait(life * 1000);
  v.flash([1, 0.9, 0.7], 0.4); v.ring(c0, AMBER, R * 2 + 2.5, 0.8, { intensity: 1.4 }); v.shake(0.2, 0.35);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.4; crack(v, c0, c0.clone().add(V(Math.cos(a) * (R + 0.6), 0, Math.sin(a) * (R + 0.6))), AMBER, 1.4, { open: 0.25 }); }
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 龍嘯九天: [ROM fx 11] blades whirl up around the target in a dragon's spiral, then pour back down onto it
async function bladeCyclone(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), n = 14, col = [1, 0.78, 0.4];
  await intro(ctx, col, { dur: 900, dist: 10.5, pitch: 0.34 });
  DARK(ctx, 0.5, 0.6, 0.8, 0.95);
  swirl(v, at, [1, 0.75, 0.4], 0.5, 1.6, 6, 2.0, { speed: 6, twist: 6, foam: [1, 0.95, 0.8], intensity: 0.6 });
  const dragon = v.ribbon({ col: [1, 0.6, 0.2], width: 0.28, n: 40, fade: 0.5 }), dcore = v.ribbon({ col: [1, 0.95, 0.7], width: 0.07, n: 30 });
  ticker(v, 1.7, (k, dt, t) => { const a = t * 7, r = 1.2 - k * 0.4; const p = at.clone().add(V(Math.cos(a) * r, 0.2 + k * 6, Math.sin(a) * r)); dragon.push(p); dcore.push(p); }, () => { dragon.end(); dcore.end(); });
  v.light(at.clone().setY(at.y + 2), col, 24, 3, 9);
  for (let i = 0; i < n; i++) {
    const s = swordMesh(col, 0.75), rib = v.ribbon({ col, width: 0.06, n: 12 }), ph = i / n * 6.28, down = 1.9 + i * 0.06;
    let top = null, hit = false;
    v.timed(s, down + 0.4, (k, dt, t) => {
      if (t < down) { const f = Math.min(1, t / 1.7), a = ph + t * 6, r = 0.9 + f * 0.6; s.position.copy(at).add(V(Math.cos(a) * r, 0.2 + f * 5.2 + Math.sin(ph * 3) * 0.3, Math.sin(a) * r)); pointAlong(s, V(-Math.sin(a), 0.6, Math.cos(a))); top = s.position.clone(); rib.push(s.position); return; }
      const f = Math.min(1, (t - down) / 0.2), tg = at.clone().add(V(rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2))), p = top.clone().lerp(tg, f * f);
      s.position.copy(p); pointAlong(s, top.clone().sub(tg)); rib.push(p);
      if (f >= 1 && !hit) { hit = true; s.visible = false; rib.end(); v.burst(tg, { n: 10, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.4 }); v.shake(0.06, 0.1); }
    });
  }
  await ctx.wait(2850);
  v.flash([1, 0.9, 0.6], 0.5); v.impact(at, col, 1.6); v.ring(at, col, 4, 0.8, { intensity: 1.2 }); dustBurst(v, at, 1.2); glowTargets(ctx, 0.9);
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}

// ---------------------------------------------------------------- arrows (黃飛虎)
// 氣動箭 / 狂飆箭: [ROM fx 13, 17] arrows loosed into the sky drop into every cell of the cross and stick, and a
// whirlwind rises out of each
async function arrowVolley(ctx, col, wind) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], a = ctx.caster;
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  ctx.pose(null); a.act = { kind: 'atk', frame: 1 };
  const from = a.chest().add(V(0, 0.3, 0));
  const sticks = [];
  cells.forEach((c, i) => later(i * 90, () => {
    const g = arrowMesh(col, 0.6), rib = v.ribbon({ col, width: 0.06, n: 16 }), land = c.clone().add(V(rand(-0.15, 0.15), 0.25, rand(-0.15, 0.15))), up = from.clone().add(V(rand(-0.4, 0.4), 6.5, rand(-0.4, 0.4)));
    for (const m of g.userData.glow) m.material.opacity = 0.5;
    v.timed(g, 2.4, (k, dt, t) => {
      const f = Math.min(1, t / 0.8);
      const p = f < 0.45 ? from.clone().lerp(up, ease(f / 0.45)) : up.clone().lerp(land, ((f - 0.45) / 0.55) ** 2), nx = f < 0.45 ? up : land;
      if (f < 1) { g.position.copy(p); pointAlong(g, nx.clone().sub(p)); rib.push(p); if (Math.random() < 0.6) v.flame(p.x, p.y, p.z, { size: 0.18, asp: 1.3, life: 0.25, tint: col.map(x => x * 1.2) }); }
      else if (!g.userData.l) { g.userData.l = 1; rib.end(); pointAlong(g, V(0.15, -1, 0.1)); g.position.copy(land); v.burst(land, { n: 10, speed: 2, col, size: 0.05, life: 0.4 }); v.shake(0.04, 0.08); }
      if (t > 2.1) g.scale.setScalar(0.6 * (1 - (t - 2.1) / 0.3) + 0.001);
    });
  }));
  later(250, () => { a.act = null; });
  await ctx.wait(900 + cells.length * 90);
  for (const c of cells) swirl(v, c, wind, 0.25, 0.85, 2.6, 1.5, { speed: 6, twist: 5, sway: true, foam: wind.map(x => x * 0.5 + 0.5), intensity: 0.55, normal: true });
  for (const c of cells) for (let i = 0; i < 18; i++) later(i * 40, () => { const ang = rand(0, 6.28), r = rand(0.2, 0.6); v.spark(c.x + Math.cos(ang) * r, c.y + rand(0.05, 0.4), c.z + Math.sin(ang) * r, { vy: rand(1.2, 2.2), life: 0.9, size: 0.05, r: wind[0], gg: wind[1], b: wind[2], shape: 1, orb: { x: c.x, z: c.z, w: rand(7, 11) } }); });
  v.ring(c0, wind, 2.6, 0.6); glowTargets(ctx, 0.7, 1);
  await ctx.wait(500); ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 萬箭穿心: [ROM fx 14] the world goes dark, a whirlwind takes the target and arrows fly through it from every side;
// then whirlwinds break out over the whole area
async function arrowStorm(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], col = [1, 0.75, 0.4], wind = [0.45, 0.7, 0.85];
  await intro(ctx, col, { dur: 700, dist: 10, pitch: 0.42 });
  DARK(ctx, 0.75, 0.95, 0.85, 0.7);
  swirl(v, at, wind, 0.4, 1.2, 3.6, 2.2, { speed: 6, twist: 5, sway: true, intensity: 0.6, normal: true });
  const N = 34;
  for (let i = 0; i < N; i++) later(i * 42, () => {
    const a = rand(0, 6.28), e = rand(-0.2, 0.5), d = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), c = at.clone().setY(at.y + rand(0.3, 1.3));
    const from = c.clone().add(d.clone().multiplyScalar(5)), to = c.clone().sub(d.clone().multiplyScalar(5)), g = arrowMesh(col, 0.5), rib = v.ribbon({ col, width: 0.04, n: 12 });
    pointAlong(g, to.clone().sub(from));
    v.timed(g, 0.32, k => { g.position.copy(from).lerp(to, k); rib.push(g.position); }, () => { rib.end(); g.visible = false; });
    later(160, () => { v.burst(c, { n: 5, speed: 2, col, size: 0.04, life: 0.3, g: 0 }); });
  });
  ticker(v, 1.5, () => { for (const a of tgts(ctx)) a.flash = Math.random() < 0.4 ? 0.6 : 0; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.wait(1500);
  v.flash([0.9, 0.95, 1], 0.4); v.shake(0.16, 0.3);
  for (const c of cells) swirl(v, c, wind, 0.3, 0.9, 2.8, 1.3, { speed: 7, twist: 5, sway: true, intensity: 0.5, normal: true });
  v.ring(at, wind, spreadOf(cells) * 2 + 2, 0.7);
  ctx.hit(); await ctx.wait(1200); outro(ctx);
}
// 颶風矢: [ROM fx 15] three arrows fly; a towering water-blue cyclone lifts the target, spins it high and drops it
async function hurricane(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [0.5, 0.85, 1], c = ctx.caster.chest(), B = basis(ctx);
  await intro(ctx, col, { dur: 600, dist: 10, pitch: 0.4, yaw: -0.5 });
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
  const face0 = a ? a.u.facing : null;
  if (a) ticker(v, 2.2, (k, dt, t) => { a.lift = t < 1.4 ? ease(Math.min(1, t / 1.2)) * 2.6 : 2.6 * (1 - ((t - 1.4) / 0.25) ** 2); a.lift = Math.max(0, a.lift); a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 16) % 4]; },
    () => { a.lift = 0; a.u.facing = face0; });
  await ctx.wait(1650);
  v.flash([0.85, 0.95, 1], 0.55); v.shake(0.25, 0.4); v.ring(at, col, 4, 0.7); dustBurst(v, at, 1); v.hitstop = 0.1;
  ctx.hit(); await ctx.wait(1100); outro(ctx);
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
// 五氣朝元: [ROM fx 19] five orbs of qi gather over him, fly to the cells of the cross and bloom into blue spirit fire
async function fiveQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), col = [0.5, 0.8, 1], c = ctx.caster.chest();
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  const orbs = cells.map((cell, i) => {
    const o = orb(v, col, 0.32), rib = v.ribbon({ col, width: 0.1, n: 18 }), hold = 0.7 + i * 0.12;
    let from = null, done = false;
    v.timed(o, hold + 0.6, (k, dt, t) => {
      if (t < hold) { const a = t * 4 + i / cells.length * 6.28, r = 0.8; o.position.copy(c).add(V(Math.cos(a) * r, 1 + Math.sin(t * 5 + i) * 0.15, Math.sin(a) * r)); o.scale.setScalar(Math.min(1, t * 3)); from = o.position.clone(); return; }
      const f = Math.min(1, (t - hold) / 0.5), tg = cell.clone().setY(cell.y + 0.35), p = bezier(from, from.clone().lerp(tg, 0.5).add(V(0, 2.2, 0)), tg, ease(f));
      o.position.copy(p); rib.push(p);
      if (f >= 1 && !done) { done = true; o.visible = false; rib.end();
        v.ring(cell, col, 1.2, 0.4); v.burst(tg, { n: 18, speed: 2.5, cols: [[1, 1, 1], col], size: 0.05, life: 0.6, g: 0 });
        ticker(v, 1.2, kk => { for (let j = 0; j < 2; j++) v.flame(cell.x + rand(-0.3, 0.3), cell.y, cell.z + rand(-0.3, 0.3), { size: rand(0.35, 0.55) * (1 - kk * 0.5), asp: 2, life: 0.5, vy: rand(0.8, 1.6), tint: [0.25, 0.6, 1.8] }); });
        v.pillar(cell, col, 0.35, 2.4, 1.2, { intensity: 0.5, grow: 1 }); v.light(tg, col, 12, 0.6, 5);
      }
    });
    return o;
  });
  await ctx.wait(1500 + cells.length * 120);
  v.flash([0.7, 0.85, 1], 0.25); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 地裂天崩: [ROM fx 20] he sinks into the earth; the land goes dark and splits, and fire bursts out of every crack
async function quake(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), a = ctx.caster, R = spreadOf(cells) + 0.8;
  await intro(ctx, FIRE, { dur: 600, dist: 12.5, pitch: 0.5 });
  ctx.pose(null); a.act = { kind: 'pose', row: 2, base: 3 };
  dustBurst(v, a.pos, 0.8);
  await new Promise(res => ticker(v, 0.5, k => { a.lift = -k * 0.9; a.fade = 1 - k; }, res));
  DARK(ctx, 0.8, 0.6, 0.75, 0.9);
  v.shake(0.12, 2.2);
  for (let i = 0; i < 7; i++) { const ang = i / 7 * 6.28 + rand(-0.2, 0.2); crack(v, c0, c0.clone().add(V(Math.cos(ang) * R, 0, Math.sin(ang) * R)), FIRE, 2.6, { open: 0.6, width: 0.14 }); }
  await ctx.wait(700);
  cells.forEach((c, i) => later(i * 70 + rand(0, 60), () => {
    v.explode(c.clone().setY(c.y + 0.35), 0.6, { n: 12, smoke: i % 2 === 0 }); v.light(c, FIRE, 14, 0.25, 5);
    for (let j = 0; j < 2; j++) { const r = rockMesh(rand(0.1, 0.18)), d = V(rand(-1, 1), 0, rand(-1, 1)); lob(v, r, c.clone().setY(c.y + 0.2), c.clone().add(d).setY(c.y), rand(1.2, 2.2), 0.7); }
  }));
  await ctx.wait(cells.length * 70 + 300);
  v.flash([1, 0.75, 0.45], 0.5); v.shake(0.3, 0.5); v.ring(c0, FIRE, R * 2 + 2, 0.8); glowTargets(ctx, 0.9);
  ctx.hit();
  await ctx.wait(500);
  await new Promise(res => ticker(v, 0.45, k => { a.lift = -(1 - k) * 0.9; a.fade = k; }, () => { a.lift = 0; a.fade = 1; res(); }));
  a.act = null; dustBurst(v, a.pos, 0.6);
  await ctx.wait(500); outro(ctx);
}
// 昇龍拳: [ROM fx 21] he leaps; a dragon of fire bursts up out of the ground under the target and climbs to the sky,
// then falls back on it as a fireball
async function risingDragon(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), a = ctx.caster;
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
  await ctx.wait(1000);
  const ball = v.fireball(0.55, { heat: 1.3 }), from = at.clone().setY(at.y + 9), tg = at.clone().setY(at.y + 0.4), tail = v.ribbon({ col: FIRE, width: 0.45, n: 18 });
  v.timed(ball, 0.45, (k, dt, t) => { ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); }, () => { tail.end(); ball.visible = false; });
  await ctx.wait(450);
  v.explode(tg, 0.9, { n: 26 }); v.flash([1, 0.7, 0.4], 0.45); v.shake(0.25, 0.4); v.hitstop = 0.12; v.ring(at, FIRE, 4, 0.8); v.decal(at, [1, 0.35, 0.06], 1.6, 2, { flicker: true });
  ctx.hit(); await ctx.wait(400); a.act = null; await ctx.wait(800); outro(ctx);
}

// ---------------------------------------------------------------- fire
// 煉獄之火: [ROM fx 24] the whole area becomes a sea of fire, rows of fireballs bursting across it in waves
async function inferno(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells);
  await intro(ctx, FIRE, { dur: 800, dist: 13, pitch: 0.48 });
  DARK(ctx, 0.55, 0.25, 0.6, 0.85);
  for (const c of cells) v.decal(c, [1, 0.3, 0.05], 0.8, 3.2, { flicker: true, intensity: 0.8 });
  ticker(v, 3, (k) => { if (Math.random() < 0.6) { const c = cells[(Math.random() * cells.length) | 0]; v.flame(c.x + rand(-0.3, 0.3), c.y - 0.05, c.z + rand(-0.3, 0.3), { size: rand(0.75, 1.05) * (k < 0.85 ? 1 : (1 - k) * 6), asp: rand(1.4, 1.9), life: rand(0.5, 0.8), vy: rand(0.2, 0.6) }); } });
  v.light(c0.clone().setY(c0.y + 1.5), FIRE, 30, 3, 12);
  await ctx.wait(500);
  for (let w = 0; w < 3; w++) {
    const order = cells.slice().sort((a, b) => (a.x + a.z) - (b.x + b.z));
    order.forEach((c, i) => later(i * 35, () => { v.explode(c.clone().setY(c.y + 0.4), 0.55, { n: 10, smoke: (i + w) % 3 === 0 }); v.light(c, FIRE, 8, 0.25, 4); }));
    v.shake(0.12, 0.3); v.flash([1, 0.6, 0.3], 0.18);
    if (w === 1) { glowTargets(ctx, 0.9, 0.8); ctx.hit(); }
    await ctx.wait(order.length * 35 + 250);
  }
  await ctx.wait(700); outro(ctx);
}
// 天火燎原: [ROM fx 25] night falls; a single flame drops from the sky onto the target, a white flash, a rain of
// sparks, and fire runs out over the plain all around
async function skyFire(ctx) {
  const v = ctx.vfx, at = ctx.at.clone();
  await intro(ctx, FIRE, { dur: 800, dist: 12, pitch: 0.42 });
  DARK(ctx, 0.75, 0.95, 0.8, 0.55);
  const from = at.clone().setY(at.y + 10), tg = at.clone().setY(at.y + 0.3), ball = v.fireball(0.4, { heat: 1.3 }), tail = v.ribbon({ col: FIRE, width: 0.35, n: 22 });
  v.timed(ball, 0.9, (k, dt, t) => { ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); v.flame(ball.position.x, ball.position.y, ball.position.z, { size: 0.5, asp: 1.8, life: 0.3, vy: 1 }); v.light(ball.position, FIRE, 20, 0.06, 8); }, () => { tail.end(); ball.visible = false; });
  await ctx.wait(900);
  v.flash([1, 1, 1], 0.7); v.shake(0.25, 0.4); v.hitstop = 0.1; v.explode(tg, 0.8, { n: 24 }); glowTargets(ctx, 1, 0.8);
  for (let i = 0; i < 80; i++) later(i * 18, () => v.spark(at.x + rand(-3, 3), at.y + rand(3, 5), at.z + rand(-3, 3), { vy: -rand(2, 4), g: 2, life: 1.2, size: rand(0.06, 0.12), r: 1, gg: rand(0.7, 0.95), b: 0.5, shape: 0, flicker: 1, ph: rand(0, 9), floor: at.y + 0.05 }));
  ctx.hit();
  // the prairie fire: a ring of flames running outwards, leaving the ground burning
  ticker(v, 1.6, (k) => {
    const r = 0.5 + k * 3.2;
    for (let i = 0; i < 6; i++) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r, z = at.z + Math.sin(ang) * r; v.flame(x, groundH(x, z) - 0.05, z, { size: rand(0.4, 0.7) * (1 - k * 0.3), asp: 2, life: rand(0.4, 0.7), vy: 0.4 }); }
    if (Math.random() < 0.3) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r * 0.7, z = at.z + Math.sin(ang) * r * 0.7; v.decal(V(x, 0, z), [1, 0.3, 0.05], 0.5, 1.5, { flicker: true, intensity: 0.6 }); }
  });
  v.ring(at, FIRE, 7, 1.6, { intensity: 1 });
  await ctx.wait(1700); outro(ctx);
}

// ---------------------------------------------------------------- ice
const ICEC = [0.55, 0.85, 1];
// 裂冰術: [ROM fx 27] sparkles gather into an orb of ice over the target; it splits, flies to each cell of the cross
// and bursts into crystals that shatter
async function iceSplit(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], mat = ICE();
  await intro(ctx, ICEC, { dur: 700, dist: 10.5, pitch: 0.46 });
  DARK(ctx, 0.35, 0.9, 0.5, 0.2);
  const hub = at.clone().setY(at.y + 2.2);
  for (let i = 0; i < 40; i++) later(i * 15, () => { const p = hub.clone().add(V(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))); v.spark(p.x, p.y, p.z, { seek: { x: hub.x, y: hub.y, z: hub.z, k: 5 }, life: 0.6, size: rand(0.06, 0.12), r: 0.85, gg: 0.95, b: 1, shape: 0, flicker: 1, ph: rand(0, 9) }); });
  const big = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat); big.position.copy(hub); big.scale.setScalar(0.01);
  v.timed(big, 1.0, (k, dt) => { big.scale.setScalar(0.01 + ease(Math.min(1, k * 1.4))); big.rotation.y += dt * 2; big.rotation.x += dt; });
  await ctx.wait(1000);
  v.flash([0.8, 0.95, 1], 0.12); v.burst(hub, { n: 30, speed: 3, cols: ICE_COLS, size: 0.06, life: 0.6, g: 0 });
  cells.forEach((c, i) => {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat), tg = c.clone().setY(c.y + 0.3), rib = v.ribbon({ col: ICEC, width: 0.14, n: 16 });
    v.timed(o, 0.45, (k, dt) => { o.position.copy(bezier(hub, hub.clone().lerp(tg, 0.5).add(V(0, 0.8, 0)), tg, k * k)); o.rotation.y += dt * 6; rib.push(o.position); }, () => { rib.end(); o.visible = false; crystals(v, c, 6, 0.8, 0.9, mat); v.ring(c, ICEC, 1.2, 0.4); v.shake(0.06, 0.1); });
  });
  await ctx.wait(500); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(1300); outro(ctx);
}
// 風雪冰天: [ROM fx 28] the sky darkens and a blizzard sweeps over the area, frost spreads and freezes everything,
// then the ice bursts
async function blizzard(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), mat = ICE();
  await intro(ctx, ICEC, { dur: 700, dist: 13, pitch: 0.48 });
  DARK(ctx, 0.7, 1, 0.7, 0.35);
  const B = basis(ctx), wind = B.right.clone().multiplyScalar(-5);
  ticker(v, 3, (k) => {
    for (let i = 0; i < 14; i++) v.spark(c0.x + rand(-6, 6) - wind.x * 0.4, c0.y + rand(0.2, 5), c0.z + rand(-6, 6) - wind.z * 0.4, { vx: wind.x * rand(0.8, 1.3), vy: -rand(0.8, 1.6), vz: wind.z * rand(0.8, 1.3) + rand(-0.5, 0.5), life: rand(0.8, 1.4), size: rand(0.05, 0.11), r: 0.92, gg: 0.96, b: 1, a: 0.9, shape: 0, wob: 1.5, ph: rand(0, 6) });
    if (Math.random() < 0.18) v.smokePuff(c0.x + rand(-4, 4), c0.y + rand(0.3, 1.2), c0.z + rand(-4, 4), { vx: wind.x * 0.5, vz: wind.z * 0.5, life: 1.4, size: 0.7, size1: 1.6, tint: [0.8, 0.9, 1] });
  });
  await ctx.wait(800);
  cells.forEach((c, i) => later(i * 50, () => { v.decal(c, [0.5, 0.75, 1], 0.7, 2.4, { intensity: 0.7 }); crystals(v, c, 5, 0.65, 1.4, mat); }));
  await ctx.wait(cells.length * 50 + 600);
  glowTargets(ctx, 0.8, 0.9); ctx.hit();
  await ctx.wait(900);
  v.flash([0.85, 0.95, 1], 0.3); v.shake(0.14, 0.3); v.ring(c0, ICEC, spreadOf(cells) * 2 + 2, 0.7);
  await ctx.wait(800); outro(ctx);
}
// 崩冰術: [ROM fx 29] under a night sky, boulders of ice crash onto the target one after another, then a huge block
// of ice closes over it and shatters
async function iceAvalanche(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), mat = ICE();
  await intro(ctx, ICEC, { dur: 800, dist: 10.5, pitch: 0.38 });
  DARK(ctx, 0.65, 1, 0.75, 0.4);
  for (let i = 0; i < 5; i++) later(i * 300, () => {
    const r = rand(0.35, 0.55), m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat), off = V(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
    lob(v, m, at.clone().add(off).add(V(rand(-2, 2), 8, rand(-1, 1))), at.clone().add(off).setY(at.y + r * 0.6), 0, 0.42, (p) => {
      v.burst(p, { n: 34, speed: 5, cols: ICE_COLS, size: 0.07, life: 0.8, g: 9 }); v.shake(0.1, 0.15); v.flash([0.8, 0.9, 1], 0.08); v.ring(at, ICEC, 1.6, 0.35); glowTargets(ctx, 0.6, 0.3);
      for (let j = 0; j < 5; j++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.07, 0.14)), mat), d = V(rand(-1.2, 1.2), 0, rand(-1.2, 1.2)); lob(v, sh, p, at.clone().add(d), rand(0.6, 1.2), 0.5); }
    }, { fall: true });
  });
  await ctx.wait(1700);
  // the block: an ice prism closing over the target
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 1.9, 6), mat); block.position.copy(at).setY(at.y + 0.95);
  v.timed(block, 1.1, (k, dt, t) => { const g = Math.min(1, t / 0.18); block.scale.set(1, g, 1); block.position.y = at.y + 0.95 * g; if (t > 0.95) block.scale.setScalar(1 + (t - 0.95) * 2); },
    () => { v.burst(at.clone().setY(at.y + 0.9), { n: 120, speed: 7, cols: ICE_COLS, size: 0.08, life: 1.1, g: 9 }); v.flash([0.9, 0.97, 1], 0.45); v.shake(0.22, 0.35); v.hitstop = 0.12;
      for (let j = 0; j < 10; j++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.1, 0.22)), mat), d = V(rand(-2, 2), 0, rand(-2, 2)); lob(v, sh, at.clone().setY(at.y + rand(0.3, 1.6)), at.clone().add(d), rand(0.8, 1.6), 0.7); } });
  v.decal(at, [0.5, 0.75, 1], 1.4, 2, { intensity: 0.8 });
  ticker(v, 1.1, () => { for (const a of tgts(ctx)) a.flash = 0.35; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.wait(1150); ctx.hit(); await ctx.wait(1000); outro(ctx);
}

// ---------------------------------------------------------------- thunder (雷震子)
const BOLT = [0.7, 0.8, 1];
// 五雷咒: [ROM fx 31] balls of lightning hang over the cells of the cross; bolts strike them one by one, the middle last
async function fiveThunder(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0];
  await intro(ctx, BOLT, { dur: 700, dist: 11, pitch: 0.4 });
  DARK(ctx, 0.62, 0.9, 0.85, 0.6); STORM(v, at, 20, 3, 6.5);
  const order = cells.slice(1).concat([at]);
  for (const c of order) plasma(v, c.clone().setY(c.y + 2.2), BOLT, 1.6 + order.length * 0.28, 0.32);
  await ctx.wait(600);
  for (let i = 0; i < order.length; i++) {
    const c = order[i], last = i === order.length - 1;
    strike(v, c, BOLT, { width: last ? 0.16 : 0.09, ring: last ? 2 : 1.2 }); v.flash([0.85, 0.9, 1], last ? 0.3 : 0.12); v.shake(last ? 0.16 : 0.07, 0.2);
    if (last) { v.impact(c, BOLT, 1.3); plasma(v, c.clone().setY(c.y + 0.5), BOLT, 0.9, 0.5); glowTargets(ctx, 0.9); ctx.hit(); }
    await ctx.wait(last ? 1000 : 260);
  }
  outro(ctx);
}
// 天雷破: [ROM fx 32] a storm cloud drifts over the area, bolts raining onto every cell, then all strike at once
async function thunderStorm(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 1;
  await intro(ctx, BOLT, { dur: 700, dist: 13, pitch: 0.42 });
  DARK(ctx, 0.72, 0.85, 0.85, 0.65); STORM(v, c0, 40, R + 1, 6.5);
  v.rain(c0, 3.2, { n: 400 });
  await ctx.wait(500);
  for (let i = 0; i < 18; i++) { const c = cells[(Math.random() * cells.length) | 0]; strike(v, c.clone().add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), BOLT, { n: 14, ring: 0.9 }); if (i % 3 === 0) v.flash([0.85, 0.9, 1], 0.1); v.shake(0.05, 0.1); await ctx.wait(85); }
  for (const c of cells) strike(v, c, BOLT, { width: 0.12, n: 18, ring: 1.4 });
  v.flash([0.95, 0.97, 1], 0.55); v.shake(0.22, 0.4); v.hitstop = 0.1; glowTargets(ctx, 1);
  ctx.hit(); await ctx.wait(1100); outro(ctx);
}
// 霸雷: [ROM fx 33] one colossal column of lightning on the target, a crown of sparks, a white-out, a crackling orb
async function greatThunder(ctx) {
  const v = ctx.vfx, at = ctx.at.clone();
  await intro(ctx, BOLT, { dur: 900, dist: 10, pitch: 0.3 });
  DARK(ctx, 0.75, 0.85, 0.85, 0.6); STORM(v, at, 30, 3, 7, [0.1, 0.1, 0.16]);
  for (let i = 0; i < 40; i++) v.smokePuff(at.x + Math.cos(i) * 2, at.y + 7.5, at.z + Math.sin(i) * 2, { life: 2.6, size: 1.6, size1: 2.6, tint: [0.1, 0.1, 0.18], orb: { x: at.x, z: at.z, w: 1.6 } });
  await ctx.wait(600);
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
  await ctx.wait(1000);
  for (let i = 0; i < 10; i++) later(i * 50, () => { const a = i / 10 * 6.28, p = sky.clone().add(V(Math.cos(a) * (R + 0.6), -0.3, Math.sin(a) * (R + 0.6))), g = orb(v, col, 0.5); g.position.copy(p);
    v.timed(g, 0.6, k => { g.scale.setScalar(0.4 + k * 1.6); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; }); });
  await ctx.wait(700);
  for (const c of cells) v.pillar(c, col, 0.42, 7, 0.9, { intensity: 1.4 });
  v.flash([1, 1, 1], 0.95); v.shake(0.3, 0.5); v.hitstop = 0.1; v.ring(c0, col, R * 2 + 3, 1);
  for (const c of cells) v.burst(c.clone().setY(c.y + 0.3), { n: 14, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.7 });
  glowTargets(ctx, 1, 1); ctx.hit();
  await ctx.wait(1300); outro(ctx);
}
// 積屍氣: [ROM fx 36] a flash, then darkness: black miasma rises and the skulls of the dead (the original's own) swirl
// through the targets
const SKULL = () => tex('assets/fx/hd/skull.png');
async function corpseQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], col = [0.55, 0.9, 0.75];
  await intro(ctx, [0.6, 1, 0.8], { dur: 700, dist: 10.5, pitch: 0.45 });
  v.ring(at, [1, 0.95, 0.8], 2.4, 0.5); v.flash([1, 1, 0.9], 0.35);
  await ctx.wait(250);
  DARK(ctx, 0.88, 1, 0.85, 0.95);
  ticker(v, 2.8, () => { for (const c of cells) if (Math.random() < 0.35) v.smokePuff(c.x + rand(-0.4, 0.4), c.y + 0.05, c.z + rand(-0.4, 0.4), { vy: rand(0.3, 0.8), life: rand(1.2, 1.8), size: 0.4, size1: 1.1, tint: [0.05, 0.07, 0.06] }); });
  const map = SKULL(), n = 10 + cells.length * 2;
  for (let i = 0; i < n; i++) {
    const s = card(map, 0.55, 0.68, { order: 8 }), c = cells[i % cells.length], ph = rand(0, 6.28), w = rand(2.5, 4) * (i % 2 ? 1 : -1), d = rand(0, 0.8);
    s.material.opacity = 0;
    v.timed(s, 2.6, (k, dt, t) => {
      const f = Math.max(0, t - d), r = 1.3 - Math.min(1, f / 1.6) * 0.9, a = ph + f * w;
      s.position.set(c.x + Math.cos(a) * r, c.y + 0.4 + Math.sin(f * 3 + ph) * 0.35 + f * 0.25, c.z + Math.sin(a) * r);
      s.material.opacity = Math.min(1, f * 3) * Math.min(1, (2.6 - t) * 3) * 0.9; s.material.rotation = Math.sin(f * 4 + ph) * 0.3;
      if (Math.random() < 0.3) v.smoke(s.position.x, s.position.y, s.position.z, { vy: rand(0.1, 0.4), life: 0.6, size: 0.12, r: col[0] * 0.4, gg: col[1] * 0.4, b: col[2] * 0.4, a: 0.5, shape: -1 });
    });
  }
  ticker(v, 2.4, () => { for (const a of tgts(ctx)) a.flash = Math.random() < 0.15 ? 0.5 : a.flash * 0.9; }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  await ctx.wait(1800); ctx.hit(); v.shake(0.1, 0.25);
  await ctx.wait(1000); outro(ctx);
}
// 黑色狂嵐: [ROM fx 37] black: a gale of darkness roars over the whole area, then it bursts into a red blaze
async function blackGale(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 0.8;
  await intro(ctx, [0.6, 0.5, 0.9], { dur: 800, dist: 14, pitch: 0.42 });
  DARK(ctx, 0.92, 1, 1, 0.95);
  swirl(v, c0, [0.55, 0.55, 0.65], R * 0.6, R + 0.8, 4, 2.4, { speed: 9, twist: 3, foam: [0.85, 0.85, 1], intensity: 0.75 });
  swirl(v, c0, [0.3, 0.3, 0.45], R * 0.4, R + 0.4, 3, 2.4, { speed: -7, twist: 2, intensity: 0.6 });
  ticker(v, 2.4, () => {
    for (let i = 0; i < 4; i++) { const a = rand(0, 6.28), r = rand(0.4, R + 0.5); v.smokePuff(c0.x + Math.cos(a) * r, c0.y + rand(0.2, 2.5), c0.z + Math.sin(a) * r, { life: 0.9, size: 0.6, size1: 1.4, tint: [0.08, 0.08, 0.1], orb: { x: c0.x, z: c0.z, w: 5 } }); }
    if (Math.random() < 0.5) { const a = rand(0, 6.28), r = rand(0.5, R); v.spark(c0.x + Math.cos(a) * r, c0.y + rand(0.3, 2.5), c0.z + Math.sin(a) * r, { life: 0.5, size: 0.14, size1: 0.02, r: 0.5, gg: 0.6, b: 1, shape: 0, orb: { x: c0.x, z: c0.z, w: 7 } }); }
  });
  v.shake(0.08, 2.2);
  await ctx.wait(2100);
  DARK(ctx, 0.75, 0.2, 0.8, 0.85); v.flash([1, 0.25, 0.1], 0.5);
  cells.forEach((c, i) => later(i * 30, () => v.explode(c.clone().setY(c.y + 0.4), 0.5, { n: 10, smoke: i % 2 === 0, tint: [1, 0.7, 0.7] })));
  v.shake(0.25, 0.5); v.hitstop = 0.1; glowTargets(ctx, 1, 0.9);
  ctx.hit(); await ctx.wait(1300); outro(ctx);
}

// ---------------------------------------------------------------- healing and blessings
// 凝神: [ROM fx 39] a column of blue light comes down onto the target, sparkles settle, the target glows
async function mpColumn(ctx) {
  const v = ctx.vfx, col = [0.45, 0.75, 1];
  await intro(ctx, col, { dur: 600, dist: 8, pitch: 0.42 });
  for (const t of (tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }])) {
    const P = t.pos.clone(), beam = v.pillar(P, col, 0.42, 6, 1.6, { intensity: 1.6 });
    v.timed(new THREE.Object3D(), 0.5, k => { beam.position.y = P.y + (1 - ease(k)) * 6; });
    later(500, () => { v.ring(P, col, 1.6, 0.6); v.decal(P, col, 1, 1.4, { intensity: 0.8 }); v.light(P.clone().setY(P.y + 1), col, 14, 1.2, 6);
      for (let i = 0; i < 30; i++) later(i * 25, () => v.spark(P.x + rand(-0.5, 0.5), P.y + rand(1.5, 2.5), P.z + rand(-0.5, 0.5), { vy: -rand(0.6, 1.2), life: 1.2, size: rand(0.05, 0.09), r: 0.7, gg: 0.9, b: 1, shape: 0, flicker: 1, ph: rand(0, 9) })); });
  }
  await ctx.wait(700); glowTargets(ctx, 0.7, 1.2);
  await ctx.wait(500); ctx.hit(); await ctx.wait(900); outro(ctx);
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
async function hearts(ctx) {
  const v = ctx.vfx, col = [1, 0.45, 0.55];
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.45 });
  HEART = HEART || heartTex();
  const list = tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }];
  list.forEach((t, i) => {
    const P = t.pos.clone(), s = card(HEART, 0.6, 0.6, { add: true, order: 8 }), d = i * 0.12;
    v.timed(s, 1.3 + d, (k, dt, tt) => {
      const f = Math.max(0, Math.min(1, (tt - d) / 1.1)); s.position.set(P.x + Math.sin(f * 7) * 0.25 * (1 - f), P.y + 3 - f * 2.2, P.z); s.material.opacity = Math.min(1, f * 5) * (f > 0.9 ? (1 - f) * 10 : 1); s.scale.setScalar(0.6 + Math.sin(tt * 9) * 0.04);
      if (f >= 1 && !s.userData.p) { s.userData.p = 1; v.burst(s.position, { n: 26, speed: 2, cols: [[1, 0.8, 0.85], col], size: 0.05, life: 0.8, g: 0.5 }); v.ring(P, col, 1.3, 0.6); v.light(P.clone().setY(P.y + 1), col, 10, 0.8, 5); ticker(v, 1, k2 => { t.flash = 0.5 * (1 - k2); }, () => { t.flash = 0; }); }
    });
  });
  await ctx.wait(1300 + list.length * 120); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 觀音下凡: [ROM fx 42] 觀音 (the original's own figure, on her lotus with her halo) comes down from the sky, circles
// over the area, and a rain of blue light falls on everyone
async function guanyin(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), col = [0.6, 0.85, 1];
  await intro(ctx, [1, 0.9, 0.6], { dur: 700, dist: 12.5, pitch: 0.4 });
  DARK(ctx, 0.35, 0.8, 0.8, 0.9);
  const fig = card(tex('assets/fx/hd/guanyin.png'), 1.9, 2.1, { order: 8 }), halo = glowCard(v, [1, 0.85, 0.45], 3.4); halo.renderOrder = 7;
  const g = new THREE.Group(); g.add(halo, fig); halo.position.y = 0.25;
  const top = c0.clone().setY(c0.y + 7), hover = c0.clone().setY(c0.y + 2.8);
  v.light(hover, [1, 0.9, 0.6], 20, 3.2, 10);
  v.timed(g, 3.2, (k, dt, t) => {
    const f = ease(Math.min(1, t / 1.0)), a = t * 1.4, r = Math.min(1.3, spreadOf(cells) * 0.6);
    g.position.copy(top).lerp(hover, f).add(V(Math.cos(a) * r * f, Math.sin(t * 2) * 0.08, Math.sin(a) * r * f));
    const o = Math.min(1, t * 2) * Math.min(1, (3.2 - t) * 2); fig.material.opacity = o; halo.material.opacity = o * (0.55 + 0.1 * Math.sin(t * 5));
    if (Math.random() < 0.5) v.spark(g.position.x + rand(-0.6, 0.6), g.position.y - 0.6, g.position.z + rand(-0.6, 0.6), { vy: -0.4, life: 1, size: 0.06, r: 1, gg: 0.9, b: 0.6, shape: 0 });
  });
  await ctx.wait(1200);
  ticker(v, 1.6, () => { for (let i = 0; i < 4; i++) { const c = cells[(Math.random() * cells.length) | 0]; v.spark(c.x + rand(-0.5, 0.5), c.y + rand(2.5, 3.5), c.z + rand(-0.5, 0.5), { vy: -rand(1.2, 2), life: 1.4, size: rand(0.06, 0.1), r: col[0], gg: col[1], b: col[2], shape: 0, flicker: 1, ph: rand(0, 9), floor: c.y + 0.05 }); } });
  for (const t of tgts(ctx)) later(400, () => { v.pillar(t.pos, col, 0.45, 3, 1.4, { intensity: 0.5, grow: 1 }); v.ring(t.pos, col, 1.4, 0.7); });
  await ctx.wait(900); glowTargets(ctx, 0.7, 1.2);
  await ctx.wait(500); ctx.hit(); await ctx.wait(800); outro(ctx);
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
  lotus.position.copy(P).setY(groundH(P.x, P.z) + 0.03);
  v.timed(lotus, 2.4, (k, dt, t) => { lotus.scale.setScalar(0.3 + 0.9 * ease(Math.min(1, t / 0.9))); lotus.rotation.y += dt * 0.6; mat.opacity = Math.min(1, t * 2) * Math.min(1, (2.4 - t) * 2) * 0.55; });
  await ctx.wait(1000);
  v.pillar(P, col, 0.5, 5, 1.4, { intensity: 1, grow: 1 }); v.flash(col, 0.3); v.ring(P, col, 2, 0.7); v.light(P.clone().setY(P.y + 1), col, 18, 1.2, 6);
  for (let j = 0; j < 3; j++) { const r = v.ribbon({ col, width: 0.06, n: 22 }); ticker(v, 1.2, (k, dt, tt) => { const a = tt * 6 + j * 2.09; r.push(V(P.x + Math.cos(a) * 0.5, P.y + 0.1 + k * 2.6, P.z + Math.sin(a) * 0.5)); }, () => r.end()); }
  ctx.hit(); await ctx.wait(1400); outro(ctx);
}

// ---------------------------------------------------------------- protection and its breaking
// 金剛咒 / 真元護體: [ROM fx 46, 47] shards fly in from all around and close into a crystal prism around each target,
// which glows and dissolves upwards
async function diamondGuard(ctx, col) {
  const v = ctx.vfx;
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.42 });
  const list = tgts(ctx).length ? tgts(ctx) : [{ pos: ctx.at }];
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(...col), emissive: new THREE.Color(...col).multiplyScalar(0.6), specular: 0xffffff, shininess: 120, flatShading: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  for (const t of list) {
    const P = t.pos.clone();
    for (let i = 0; i < 14; i++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.06, 0.12)), mat), a = rand(0, 6.28), from = P.clone().add(V(Math.cos(a) * 2.2, rand(0.3, 2), Math.sin(a) * 2.2));
      lob(v, sh, from, P.clone().add(V(Math.cos(a) * 0.55, rand(0.2, 1.4), Math.sin(a) * 0.55)), 0.3, 0.55 + rand(0, 0.2)); }
    later(650, () => {
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 6, 1, true), mat), edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 6)), new THREE.LineBasicMaterial({ color: new THREE.Color(...col).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
      prism.add(edge); prism.position.copy(P).setY(P.y + 0.9);
      v.timed(prism, 1.4, (k, dt, tt) => { const g = Math.min(1, tt / 0.2); prism.scale.set(1, g, 1); prism.rotation.y += dt * 0.8; const o = Math.min(1, (1.4 - tt) / 0.5); mat.opacity = 0.55 * o; edge.material.opacity = o; if (tt > 0.9) prism.position.y = P.y + 0.9 + (tt - 0.9) * 1.2; });
      v.ring(P, col, 1.4, 0.5); v.light(P.clone().setY(P.y + 1), col, 10, 1, 5); ticker(v, 1, k2 => { t.flash = 0.45 * (1 - k2); }, () => { t.flash = 0; });
      for (let i = 0; i < 20; i++) later(800 + i * 25, () => v.spark(P.x + rand(-0.5, 0.5), P.y + rand(0.2, 1.8), P.z + rand(-0.5, 0.5), { vy: rand(0.6, 1.4), life: 0.9, size: 0.05, r: col[0], gg: col[1], b: col[2], shape: 1 }));
    });
  }
  await ctx.wait(1500); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 金剛破 / 真元歸天: [ROM fx 48, 49] a shield shows before each target, cracks and shatters; dark miasma sinks into it
async function shieldBreak(ctx, col) {
  const v = ctx.vfx;
  await intro(ctx, col, { dur: 600, dist: 9.5, pitch: 0.42 });
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
    later(500, () => { const q = s.position.clone(); for (let i = 0; i < 4; i++) v.bolt(q.clone().add(V(0, 0.05, 0.1)), q.clone().add(V(rand(-0.4, 0.4), rand(-0.45, 0.45), 0.1)), [0.2, 0.2, 0.25], 0.45, { width: 0.012, jag: 0.25 }); v.shake(0.05, 0.1); });
    later(1000, () => {
      const q = s.position.clone();
      for (let i = 0; i < 10; i++) { const sh = rockMesh(rand(0.05, 0.1), 0x9fb4c8); lob(v, sh, q, P.clone().add(V(rand(-1, 1), 0, rand(-1, 1))), rand(0.3, 0.8), 0.6); }
      v.burst(q, { n: 26, speed: 3, cols: [[0.9, 0.95, 1], [0.6, 0.7, 0.8]], size: 0.05, life: 0.7, g: 8 }); v.flash([0.6, 0.6, 0.7], 0.12);
      for (let i = 0; i < 16; i++) v.smokePuff(P.x + rand(-0.6, 0.6), P.y + rand(1.2, 1.8), P.z + rand(-0.6, 0.6), { vy: -rand(0.6, 1.1), life: 1.2, size: 0.3, size1: 0.6, tint: col.map(c => c * 0.25) });
      ticker(v, 0.9, k2 => { t.flash = (0.4 * (1 - k2)) * (Math.random() < 0.5 ? 1 : 0); }, () => { t.flash = 0; });
    });
  }
  await ctx.wait(1200); ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 封魔符: [ROM fx 50] a talisman flies to the target, sticks, flares three times, and a 封 seal locks around it
async function sealTalisman(ctx) {
  const v = ctx.vfx, col = [1, 0.85, 0.4], P = ctx.at.clone(), from = ctx.caster.chest().add(V(0, 0.4, 0)), tgt = P.clone().setY(P.y + 0.75);
  await intro(ctx, col, { dur: 600, dist: 8.5, pitch: 0.4 });
  const tc = card(talismanTex('封魔'), 0.42, 1.1, { order: 9 }), rib = v.ribbon({ col, width: 0.06, n: 14 });
  v.timed(tc, 2.2, (k, dt, t) => {
    const f = Math.min(1, t / 0.55); tc.position.copy(bezier(from, from.clone().lerp(tgt, 0.5).add(V(0, 1.4, 0)), tgt, ease(f))); if (f < 1) rib.push(tc.position); else if (!tc.userData.s) { tc.userData.s = 1; rib.end(); }
    tc.material.rotation = f < 1 ? t * 9 : 0; tc.material.color.setScalar(1 + (t > 0.6 ? 0.8 * Math.max(0, Math.sin((t - 0.6) * 12)) : 0));
    tc.material.opacity = Math.min(1, (2.2 - t) * 3);
  });
  await ctx.wait(600);
  for (let i = 0; i < 3; i++) { v.burst(tgt, { n: 20, speed: 2.5, cols: [[1, 1, 0.85], col], size: 0.05, life: 0.5, g: 0 }); v.light(tgt, col, 12, 0.2, 5); v.ring(tgt, col, 1.2, 0.3, { vertical: true, yaw: ctx.cam.yaw || 0, y: tgt.y }); await ctx.wait(260); }
  const seal = v.runeCircle(P, [0.5, 0.75, 1], 1.0, 1.6, { spin: 2, intensity: 1.6 });
  const glyph = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = 'bold 96px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#7fc0ff'; g.shadowBlur = 16; g.fillStyle = '#e8f4ff'; g.fillText('封', 64, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const gc = card(glyph, 0.9, 0.9, { add: true, order: 9 }); gc.position.copy(tgt).setY(tgt.y + 0.7);
  v.timed(gc, 1.4, (k, dt, t) => { gc.material.opacity = Math.min(1, t * 4) * (1 - k) * (0.75 + 0.25 * Math.sin(t * 14)); gc.scale.setScalar(0.9 + k * 0.2); });
  ticker(v, 1.2, k => { for (const a of tgts(ctx)) a.flash = 0.4 * (1 - k); }, () => { for (const a of tgts(ctx)) a.flash = 0; });
  ctx.hit(); await ctx.wait(1300); outro(ctx);
}

// ---------------------------------------------------------------- summons (the beasts are the original's sprites)
// the beast comes out of a curtain of light streaks (gold for most, fire for the phoenix), as the original's do
function curtain(v, p, col, life) {
  for (let i = 0; i < 9; i++) { const q = p.clone().add(V(rand(-1.2, 1.2), 0, rand(-0.3, 0.3))); later(i * 40, () => v.pillar(q, col, rand(0.04, 0.12), 6, life, { intensity: 1.6 })); }
}
function beast(v, id, h) {
  const t = tex('assets/fx/hd/summon_' + id + '.png'), s = card(t, h, h, { order: 8 });
  const fit = () => { if (t.image && t.image.width) s.scale.set(h * t.image.width / t.image.height, h, 1); }; fit(); if (!t.image) later(100, fit); else if (!t.image.width) t.image.addEventListener('load', fit);
  const glow = glowCard(v, [1, 0.9, 0.6], h * 1.8); glow.renderOrder = 7; const g = new THREE.Group(); g.add(glow, s); g.userData = { s, glow, fit }; return g;
}
async function beastIn(ctx, id, h, p, col, o) {
  const v = ctx.vfx; o = o || {};
  curtain(v, p.clone().setY(groundH(p.x, p.z)), col, 1.4);
  const g = beast(v, id, h); g.position.copy(p); g.userData.s.material.opacity = 0; g.userData.glow.material.opacity = 0;
  v.timed(g, o.life || 3.2, (k, dt, t) => {
    g.userData.fit(); const f = Math.min(1, Math.max(0, (t - 0.5) / 0.6)), out = Math.min(1, ((o.life || 3.2) - t) / 0.4);
    g.userData.s.material.opacity = f * out; g.userData.glow.material.opacity = (0.35 * f + (t < 1.1 ? 0.5 * Math.sin(Math.min(1, t / 1.1) * Math.PI) : 0)) * out;
    if (o.move) o.move(g, t, dt);
  });
  return g;
}
// 龍鬚虎: [ROM fx 54] the shaggy beast stands out of the gold curtain and hurls boulders onto the cross
async function summonTiger(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), at = cells[0], B = basis(ctx), col = [1, 0.85, 0.5];
  await intro(ctx, col, { dur: 700, dist: 12.5, pitch: 0.36 });
  DARK(ctx, 0.75, 0.9, 0.9, 0.85);
  const home = at.clone().add(B.right.clone().multiplyScalar(-2.6)).add(B.toCam.clone().multiplyScalar(-1.2)); home.y = groundH(home.x, home.z) + 1.25;
  await beastIn(ctx, 54, 2.5, home, col, { life: 3.6, move: (g, t) => { g.position.y = home.y + Math.abs(Math.sin(t * 5)) * (t > 1.4 && t < 2.6 ? 0.12 : 0); } });
  await ctx.wait(1200);
  v.ring(home.clone().setY(home.y - 1.2), col, 3, 0.6); v.shake(0.12, 0.3);
  cells.concat(cells).forEach((c, i) => later(i * 110, () => {
    const r = rockMesh(rand(0.25, 0.38), 0x8a7458), land = c.clone().add(V(rand(-0.2, 0.2), 0.2, rand(-0.2, 0.2)));
    lob(v, r, home.clone().add(V(rand(-0.3, 0.3), 1.2, 0)), land, 3, 0.6, () => { dustBurst(v, c, 0.8); v.shake(0.1, 0.15); v.ring(c, [0.8, 0.7, 0.5], 1.4, 0.4); for (let j = 0; j < 4; j++) { const sh = rockMesh(rand(0.05, 0.1)); lob(v, sh, land, c.clone().add(V(rand(-0.8, 0.8), 0, rand(-0.8, 0.8))), rand(0.4, 0.9), 0.45); } });
  }));
  await ctx.wait(cells.length * 220 + 600);
  glowTargets(ctx, 0.8); ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 火鳳凰: [ROM fx 55] the phoenix rises out of a curtain of fire, the world turns red, and it dives onto the target as
// a comet of fire, again and again
async function summonPhoenix(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), B = basis(ctx);
  await intro(ctx, FIRE, { dur: 700, dist: 12, pitch: 0.34 });
  DARK(ctx, 0.7, 0.2, 0.65, 0.8);
  const home = at.clone().add(B.right.clone().multiplyScalar(-2.4)).add(V(0, 2.2, 0));
  const g = await beastIn(ctx, 55, 2.6, home, [1, 0.45, 0.15], { life: 2.2, move: (g, t) => { g.position.y = home.y + Math.sin(t * 3) * 0.15; for (let i = 0; i < 2; i++) v.flame(g.position.x + rand(-1.1, 1.1), g.position.y + rand(-0.4, 0.6), g.position.z + rand(-0.3, 0.3), { size: rand(0.3, 0.5), asp: 1.6, life: 0.4, vy: 0.8 }); } });
  await ctx.wait(1700);
  for (let d = 0; d < 3; d++) {
    const from = at.clone().add(B.right.clone().multiplyScalar([-5, 5, -1][d])).add(V(0, 7, 0)), tg = at.clone().setY(at.y + 0.5), ball = v.fireball(0.45, { heat: 1.3 }), tail = v.ribbon({ col: FIRE, width: 0.6, n: 20 });
    v.timed(ball, 0.4, (k, dt, t) => { ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); for (let i = 0; i < 2; i++) v.flame(ball.position.x, ball.position.y, ball.position.z, { size: 0.6, asp: 1.5, life: 0.3, vy: 0.5 }); }, () => { tail.end(); ball.visible = false; });
    await ctx.wait(400);
    v.explode(tg, 0.75, { n: 18 }); v.flash([1, 0.85, 0.7], d === 2 ? 0.6 : 0.35); v.shake(0.18, 0.3); v.ring(at, FIRE, 3, 0.6); glowTargets(ctx, 0.8, 0.3);
    if (d === 2) { v.decal(at, [1, 0.35, 0.06], 1.6, 2, { flicker: true }); ctx.hit(); }
    await ctx.wait(d === 2 ? 1100 : 300);
  }
  outro(ctx);
}
// 麒麟獸: [ROM fx 56] the qilin flies across the sky in green fire, and pillars of golden lightning strike the area
async function summonQilin(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), B = basis(ctx), gold = [1, 0.9, 0.35];
  await intro(ctx, gold, { dur: 700, dist: 13.5, pitch: 0.38 });
  DARK(ctx, 0.85, 0.9, 0.9, 0.8);
  const a = c0.clone().add(B.right.clone().multiplyScalar(-5)).add(B.toCam.clone().multiplyScalar(1)).add(V(0, 2, 0)), b = c0.clone().add(B.right.clone().multiplyScalar(5)).add(B.toCam.clone().multiplyScalar(1)).add(V(0, 2.4, 0));
  const g = beast(v, 56, 2.4); g.userData.s.material.opacity = 0; g.userData.glow.material.opacity = 0;
  v.timed(g, 1.8, (k, dt, t) => { g.userData.fit(); g.position.copy(a).lerp(b, k); g.position.y += Math.sin(k * Math.PI) * 0.6; g.userData.s.material.opacity = Math.min(1, t * 4) * Math.min(1, (1.8 - t) * 4); g.userData.glow.material.opacity = 0.3 * g.userData.s.material.opacity;
    for (let i = 0; i < 2; i++) v.flame(g.position.x + rand(-0.8, 0.8), g.position.y - 0.9, g.position.z + rand(-0.2, 0.2), { size: rand(0.25, 0.4), asp: 1.6, life: 0.45, vy: -0.3, tint: [0.45, 1.3, 0.4] }); });
  await ctx.wait(1500);
  for (let w = 0; w < 3; w++) {
    const pick = cells.filter((c, i) => (i + w) % 2 === 0 || w === 2);
    for (const c of pick) { v.pillar(c, gold, 0.3, 8, 0.45, { intensity: 1.8 }); v.bolt(c.clone().setY(c.y + 8), c.clone().setY(c.y + 0.1), gold, 0.3, { width: 0.08 }); v.burst(c.clone().setY(c.y + 0.2), { n: 10, speed: 3, cols: [[1, 1, 0.8], gold], size: 0.05, life: 0.5 });
      for (let i = 0; i < 3; i++) v.flame(c.x + rand(-0.3, 0.3), c.y, c.z + rand(-0.3, 0.3), { size: 0.35, asp: 2, life: 0.5, vy: 0.8, tint: [0.45, 1.3, 0.4] }); }
    v.flash([1, 0.95, 0.6], w === 2 ? 0.6 : 0.25); v.shake(w === 2 ? 0.22 : 0.1, 0.25);
    if (w === 2) { glowTargets(ctx, 1); ctx.hit(); }
    await ctx.wait(w === 2 ? 1100 : 380);
  }
  outro(ctx);
}
// 四不像: [ROM fx 57] golden streaks, the beast rises, a wave of water rolls out, and orbs of spirit light burst all
// over the area
async function summonSibuxiang(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), B = basis(ctx), col = [0.8, 0.7, 1], gold = [1, 0.9, 0.4];
  await intro(ctx, gold, { dur: 700, dist: 13.5, pitch: 0.38 });
  DARK(ctx, 0.85, 0.95, 0.9, 0.85);
  const home = c0.clone().add(B.right.clone().multiplyScalar(-2.4)).add(B.toCam.clone().multiplyScalar(0.3)); home.y += 1.5;
  for (let i = 0; i < 6; i++) { const r = v.ribbon({ col: gold, width: 0.05, n: 20 }), y = home.y + rand(-1, 1.5); ticker(v, 0.5, k => r.push(home.clone().add(B.right.clone().multiplyScalar(-4 + k * 8)).setY(y + Math.sin(k * 6 + i) * 0.4)), () => r.end()); }
  await beastIn(ctx, 57, 3, home, gold, { life: 2.6, move: (g, t) => { g.position.y = home.y + Math.max(0, t - 1.6) * 1.5; } });
  await ctx.wait(1500);
  // the wave
  const R = spreadOf(cells) + 1.5;
  ticker(v, 0.9, (k) => { const r = 0.5 + k * R; for (let i = 0; i < 10; i++) { const a = rand(0, 6.28); v.spark(c0.x + Math.cos(a) * r, c0.y + 0.2, c0.z + Math.sin(a) * r, { vx: Math.cos(a) * 2, vy: rand(1.5, 3), vz: Math.sin(a) * 2, g: 9, life: 0.7, size: rand(0.05, 0.1), r: 0.6, gg: 0.85, b: 1, shape: 1, floor: c0.y + 0.03 }); }
    if (Math.random() < 0.5) v.smokePuff(c0.x + rand(-r, r), c0.y + 0.2, c0.z + rand(-r, r), { vy: 0.4, life: 1, size: 0.5, size1: 1.2, tint: [0.7, 0.85, 1] }); });
  v.ring(c0, [0.6, 0.85, 1], R * 2, 0.9, { intensity: 1.4 });
  await ctx.wait(600);
  // the orbs of spirit light
  const seq = cells.concat(cells.slice(0, Math.min(5, cells.length))).sort(() => Math.random() - 0.5);
  seq.forEach((c, i) => later(i * 90, () => {
    const p = c.clone().setY(c.y + 0.7), g = orb(v, col, 0.6); g.position.copy(p);
    v.timed(g, 0.5, k => { g.scale.setScalar(0.4 + k * 1.8); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; });
    for (let j = 0; j < 4; j++) { const a = j / 4 * 6.28 + 0.4; v.bolt(p, p.clone().add(V(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0)), [0.9, 0.85, 1], 0.15, { width: 0.02, jag: 0.05 }); }
    v.ring(c, col, 1.3, 0.4); v.light(p, col, 12, 0.3, 5); if (i % 3 === 0) v.flash([0.9, 0.85, 1], 0.2); v.shake(0.06, 0.1);
  }));
  await ctx.wait(seq.length * 90 + 200);
  v.flash([1, 1, 1], 0.6); glowTargets(ctx, 1); ctx.hit(); await ctx.wait(1100); outro(ctx);
}

// ---------------------------------------------------------------- the spells, by id
export const SPELLBOOK = {
  2: c => swordStorm(c, [0.45, 0.85, 1]), 3: c => swordWheel(c, [0.5, 0.88, 1], 12, 2), 6: rainbowDash, 7: c => swordWheel(c, [1, 0.55, 0.3], 16, 2),
  8: earthSplit, 9: crossSlash, 10: bladeOrbit, 11: bladeCyclone,
  13: c => arrowVolley(c, [1, 0.6, 0.25], [0.45, 0.8, 0.5]), 14: arrowStorm, 15: hurricane, 17: c => arrowVolley(c, [0.8, 0.5, 1], [0.55, 0.4, 0.8]),
  18: burstFist, 19: fiveQi, 20: quake, 21: risingDragon,
  24: inferno, 25: skyFire, 27: iceSplit, 28: blizzard, 29: iceAvalanche,
  31: fiveThunder, 32: thunderStorm, 33: greatThunder,
  34: lightBurst, 35: heavenWrath, 36: corpseQi, 37: blackGale,
  39: mpColumn, 41: hearts, 42: guanyin, 43: revive,
  46: c => diamondGuard(c, [0.45, 0.75, 1]), 47: c => diamondGuard(c, [1, 0.85, 0.4]), 48: c => shieldBreak(c, [0.55, 0.45, 0.75]), 49: c => shieldBreak(c, [0.6, 0.35, 0.7]), 50: sealTalisman,
  54: summonTiger, 55: summonPhoenix, 56: summonQilin, 57: summonSibuxiang,
};
