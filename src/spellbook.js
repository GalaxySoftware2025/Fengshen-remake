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
import { houndRunTex, lotusBloom } from './levelup.js';   // (the 哮天犬's gallop, 觀音's lotuses: run time only)
import { iceMaterial, shardGeometry, chunkGeometry, shatter, frost } from './elements.js';
import { V, ease, basis, swordMesh, pointAlong, bezier, intro, outro, DARK, ticker, cueAt, shotAt, yawToward, channel, facing, yawOf, swirl, arrowMesh, flameRing, talismanTex, petalGeo } from './spellkit.js';

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
  for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t).add(side.clone().multiplyScalar(i && i < n ? rand(-0.18, 0.18) : 0)); p.y = (o.y ?? effectH(p.x, p.z)) + 0.04; pts.push(p); }   // (o.y: one level, the target's: a crack running to a cliff would climb its wall)
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
// a chasm torn in the ground along a path (points on one level): a ragged gap, dark earth walls with the spell's light far
// down in it, a pale broken lip, the ground darkened round it, slabs of the lip heaving up and tipping back as it opens.
// The caller drives it through the returned object: front (0-1, how far it has torn from the path's start), open (0-1),
// hot (the light in it), a (fade); at(t) a point along it. Its front throws up dust and chips as it tears.
function chasm(v, path, col, o) {
  o = o || {};
  const W = o.w || 0.24, y0 = o.y ?? path[0].y, prof = o.prof || (t => Math.min(1, t / 0.15, (1 - t) / 0.15)), seg = [];
  let L = 0; for (let i = 1; i < path.length; i++) { seg.push(path[i].distanceTo(path[i - 1])); L += seg[i - 1]; }
  const along = s => { let i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; } return path[i].clone().lerp(path[i + 1], Math.min(1, s / seg[i])); };
  const N = Math.max(8, Math.ceil(L / 0.06)), ph = [rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)], P = [], S = [], HW = W * 1.6 + 0.3;
  for (let i = 0; i <= N; i++) {
    const s = i / N * L, d = along(Math.min(L, s + 0.05)).sub(along(Math.max(0, s - 0.05))).setY(0).normalize(), n = V(-d.z, 0, d.x);
    const m = (Math.sin(s * 2.3 + ph[0]) * 0.6 + Math.sin(s * 5.9 + ph[1]) * 0.3 + Math.sin(s * 13 + ph[2]) * 0.15) * (o.wander ?? 0.12) * Math.min(1, s / 0.3, (L - s) / 0.3);   // (none at the ends: arms meet where they should)
    P.push(along(s).addScaledVector(n, m).setY(y0 + 0.035)); S.push(n);
  }
  const pos = [], aS = [], aX = [], aW = [], idx = [];
  P.forEach((p, i) => { for (const x of [-HW, HW]) { pos.push(p.x + S[i].x * x, p.y, p.z + S[i].z * x); aS.push(i / N * L); aX.push(x); aW.push(W * prof(i / N)); } });
  for (let i = 0; i < N; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setAttribute('aX', new THREE.Float32BufferAttribute(aX, 1)); g.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
  const u = { uFront: { value: 0 }, uOpen: { value: 0 }, uHot: { value: 0 }, uA: { value: 1 }, uT: { value: 0 }, uC: { value: new THREE.Color(...col) } };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: `attribute float aS, aX, aW; varying float vS, vX, vW; void main(){ vS = aS; vX = aX; vW = aW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uFront, uOpen, uHot, uA, uT; uniform vec3 uC; varying float vS, vX, vW; ${NOISE}
      void main(){
        float fr = uFront - vS; if (fr < 0.0) discard;
        float n1 = fn(vec2(vS * 9.0, 1.7)), n2 = fn(vec2(vS * 9.0, 7.3)), n3 = fn(vec2(vS * 31.0, 3.1)), tip = smoothstep(0.0, 0.6, fr);
        float hw = max(vW * uOpen * tip * (0.45 + 0.75 * (vX > 0.0 ? n1 : n2) + 0.35 * (n3 - 0.5)), 0.014);   // (each lip its own jag; a hairline where it has only torn)
        float d = abs(vX), lip = 0.03 + 0.03 * n3 + 0.05 * uOpen * tip;
        vec4 c;
        if (d < hw) {
          float x = d / hw;
          vec3 wall = mix(vec3(0.006, 0.004, 0.003), vec3(0.1, 0.06, 0.035), smoothstep(0.55, 1.0, x)) * (0.7 + 0.6 * fn(vec2(vS * 12.0, x * 5.0 + step(0.0, vX) * 5.0)));   // dark walls, banded (linear light: these are near black)
          float fl = uHot * (0.75 + 0.25 * sin(uT * 13.0 + vS * 6.0));
          c = vec4(wall + uC * uC * exp(-x * x * 26.0) * fl * 1.2 + vec3(1.0, 0.8, 0.45) * exp(-x * x * 140.0) * fl * 0.9, 1.0);   // its light far down: a thin hot seam
        } else if (d < hw + lip) c = vec4(vec3(0.5, 0.33, 0.17) * (0.7 + 0.5 * n3), 0.9);   // the broken lip, earth turned up
        else { float s = 1.0 - (d - hw - lip) / (0.05 + 0.2 * uOpen * tip); if (s <= 0.0) discard; c = vec4(0.07, 0.04, 0.02, 0.5 * s * s); }   // the ground round it, heaved and shadowed
        gl_FragColor = vec4(c.rgb, c.a * uA);
      }` }));
  m.renderOrder = 2;
  // the slabs of its lips, under the ground until it tears past them
  const slabs = [];
  for (let s = 0.15; s < L - 0.1; s += rand(0.13, 0.2)) for (const sg of [-1, 1]) {
    const i = Math.round(s / L * N), r = rockMesh(rand(0.06, 0.11), [0x7a6650, 0x6b5a46, 0x8a7660][(Math.random() * 3) | 0]);
    r.scale.multiply(V(1, 0.5, 1.5)); r.userData = { s, i, sg, j: rand(0.7, 1.2), yaw: Math.atan2(-S[i].z, S[i].x) + rand(-0.3, 0.3) }; r.visible = false; slabs.push(r);   // (long along the chasm)
  }
  const grp = new THREE.Group(); grp.add(m, ...slabs);
  const c = { front: 0, open: 0, hot: 0, a: 1, L, at: t => P[Math.round(Math.max(0, Math.min(1, t)) * N)].clone() };
  let torn = 0;
  v.timed(grp, o.life || 3, (k, dt, t) => {
    const F = c.front * (L + 0.6); u.uFront.value = F; u.uOpen.value = c.open; u.uHot.value = c.hot; u.uA.value = c.a; u.uT.value = t;   // (F past the end at 1: its narrowing tip off it)
    for (const r of slabs) { const q = r.userData, f = Math.min(1, Math.max(0, (F - q.s) / 0.6)) * c.open * prof(q.s / L) * q.j, p = P[q.i];
      r.visible = F > q.s && c.a > 0.05; r.position.copy(p).addScaledVector(S[q.i], q.sg * (W * 0.8 * f + 0.05)).setY(p.y - 0.07 + 0.11 * f);
      r.rotation.set(0, q.yaw, 0); r.rotateZ(-q.sg * 0.7 * f); }   // (its edge on the gap heaved up, tipping back)
    // the tearing front: dust thrown up both sides, chips
    for (; torn < F - 0.3 && torn < L; torn += 0.3) { const p = P[Math.round(torn / L * N)], n = S[Math.round(torn / L * N)];
      for (const sg of [-1, 1]) v.smokePuff(p.x + n.x * sg * 0.15, p.y + 0.05, p.z + n.z * sg * 0.15, { vx: n.x * sg * rand(0.6, 1.2), vz: n.z * sg * rand(0.6, 1.2), vy: rand(0.4, 0.9), drag: 2.4, life: rand(0.6, 0.9), size: 0.14, size1: 0.4, tint: [0.55, 0.42, 0.28] });
      v.burst(p.clone().setY(p.y + 0.05), { n: 4, speed: 1.8, cols: [[0.55, 0.45, 0.35], [0.4, 0.33, 0.26]], size: 0.045, life: 0.5, g: 8, shape: 0, up: 0.8 }); }
  });
  return c;
}
// how far the ground keeps to a's level from a along dir, up to len (a chasm stops at a cliff's foot or a void's edge)
function levelRun(a, dir, len) {
  let s = 0; while (s < len && Math.abs(effectH(a.x + dir.x * (s + 0.1), a.z + dir.z * (s + 0.1)) - a.y) < 0.2) s += 0.1;
  return Math.min(s, len);
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
        v.burst(p.clone().setY(p.y + h * 0.5), { n: 10, speed: 3, cols: ICE_COLS, size: 0.04, life: 0.6, g: 9, shape: 7 }); shatter(v, p.clone().setY(p.y + h * 0.5), 5, mat, { size: 0.16 * scale + 0.06 }); }
    });
  }
  v.burst(P.clone().setY(P.y + 0.2), { n: 16, speed: 3.5, cols: ICE_COLS, size: 0.045, life: 0.6, g: 8, shape: 7 }); frost(v, P, 0.9 * scale + 0.3, hold + 1.2);
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
// a spectral sword drawn flat, point down (64 x 256): a white core to a sky-blue edge, haloed, the hilt dimmer
const SPIRIT_SWORD = (() => { let t; return () => t || (t = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const blade = () => { g.beginPath(); g.moveTo(32, 250); g.lineTo(42, 214); g.lineTo(41, 62); g.lineTo(23, 62); g.lineTo(22, 214); g.closePath(); };
  g.shadowColor = 'rgba(80,170,255,1)'; g.shadowBlur = 14; g.fillStyle = 'rgba(110,190,255,0.85)'; blade(); g.fill();
  const gr = g.createLinearGradient(22, 0, 42, 0); gr.addColorStop(0, '#6cc0ff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#6cc0ff');
  g.shadowBlur = 6; g.fillStyle = gr; blade(); g.fill();
  g.shadowBlur = 10; g.fillStyle = '#a8dcff'; g.fillRect(8, 52, 48, 9);   // the guard
  g.fillStyle = 'rgba(150,200,255,0.8)'; g.fillRect(28, 14, 8, 38); g.beginPath(); g.arc(32, 12, 7, 0, 7); g.fill();   // the grip and pommel
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; })()); })();
function spiritSword(h, col) {   // anchored at its point (sprite.center), so set on the ground it stands stuck in it
  const s = card(SPIRIT_SWORD(), h / 4, h, { col: col || [1, 1, 1], add: true }); s.center.set(0.5, 0.03); return s;
}
// 萬劍訣: [ROM fx 2] shadows spread over the whole area with the original's first sound (1.6 s after the cast begins), then
// swords rain down into every cell (2.3-4 s) and a white flash (4.1 s); the shadows fade, the effect over at 5.2 s.
// Remade [the user's call: too simple]: night falls and a host of spirit swords appears in the sky over the area, points
// down and trembling, their shadows spreading on the ground; they rain down in a quickening downpour, each striking its
// shadow and standing in the ground, until the field bristles with them; a great sword falls on the middle (the
// original's flash) and every sword in the field bursts into light with the blow; the light drifts up as the night lifts
async function swordStorm(ctx, col) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), F = 1.6, R0 = 2.2, R1 = 3.85, H = 4.1, E = 5.23;
  await intro(ctx, col, { dur: 900, dist: 13, pitch: 0.5 });
  DARK(ctx, 0.8, 0.9, 0.75, 0.45);
  await ctx.until(F - 0.1);
  ctx.cue();
  // the host [the user's calls: faster, more than one round, then one unbroken rain]: swords for every cell, off its
  // middle (where the unit stands), each taking shape in the sky over its spot a moment before it falls, so the sky is
  // never empty; they rain down without a break from 2.2 s, thickening to the end; each stands planted a while and bursts
  // into light, those that fall last standing to the blow
  const per = cells.length > 6 ? 9 : 12, swords = [];
  for (const c of cells) for (let j = 0; j < per; j++) {
    const a = j / per * 6.28 + rand(-0.3, 0.3), d = rand(0.22, 0.48), land = c.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); land.y = effectH(land.x, land.z);
    swords.push({ land, sky: land.clone().add(V(rand(-0.25, 0.25), rand(2.6, 3.8), rand(-0.25, 0.25))), h: rand(0.8, 1.05) });
  }
  swords.sort(() => Math.random() - 0.5).forEach((q, i) => {
    q.fall = R0 + (R1 - R0) * Math.pow((i + 0.5) / swords.length, 0.85);   // (evenly, a little thicker at the end: no lull)
    q.show = Math.max(F, q.fall - rand(0.35, 0.6)); q.end = q.fall > H - 0.7 ? H : q.fall + rand(0.5, 0.7);
  });
  for (const q of swords) {
    q.s = spiritSword(q.h); q.s.material.opacity = 0; q.ph = rand(0, 6.28);
    q.sh = shadowDisc(v, q.land, 0.16, q.end + 0.3 - ctx.now(), { grow: q.fall - ctx.now(), a: 0.7 });   // (its shadow growing until it strikes, gone with the sword)
    v.timed(q.s, E - ctx.now(), (k, dt) => stroke(q, dt));
  }
  const FALL = 0.07;   // (from the sky to the ground: a flicker)
  function stroke(q, dt) {
    const T = ctx.now(), s = q.s;
    if (T < q.show) s.visible = false;
    else if (T < q.fall) { s.visible = true; const f = Math.min(1, (T - q.show) / 0.2); s.material.opacity = f * (0.75 + 0.25 * Math.sin(T * 30 + q.ph));   // hanging, trembling
      s.position.copy(q.sky).add(V(Math.sin(T * 23 + q.ph) * 0.015, Math.sin(T * 3 + q.ph) * 0.06, 0)); }
    else if (T < q.fall + FALL) { const f = (T - q.fall) / FALL; s.visible = true; s.material.opacity = 1; s.position.copy(q.sky).lerp(q.land, f * f);
      if (!q.rib) { q.rib = v.ribbon({ col: [0.5, 0.8, 1], width: 0.07, n: 6, fade: 0.2 }); q.rib.push(q.sky.clone().setY(q.sky.y + q.h * 0.6)); } q.rib.push(s.position.clone().setY(s.position.y + q.h * 0.6)); }
    else if (!q.hit) { q.hit = 1; s.visible = true; s.position.copy(q.land).setY(q.land.y - 0.03); if (q.rib) q.rib.end();   // it strikes: sparks, chips, a puff of dust
      v.burst(q.land.clone().setY(q.land.y + 0.08), { n: 7, speed: 2, cols: [[0.8, 0.95, 1], col], size: 0.04, life: 0.35, g: 6, up: 0.7, shape: 1 });
      v.smokePuff(q.land.x, q.land.y + 0.05, q.land.z, { vy: 0.3, drag: 2, life: 0.6, size: 0.12, size1: 0.35, tint: [0.5, 0.45, 0.4] });
      if (Math.random() < 0.2) v.shake(0.04, 0.08); }
    else if (T < q.end) s.material.opacity = 0.6 + 0.15 * Math.sin(T * 8 + q.ph);   // stuck, glowing
    else if (!q.gone) { q.gone = 1; s.visible = false; const p = q.land.clone().setY(q.land.y + q.h * 0.5);   // bursting into light (the next round's strikes, or the blow)
      v.burst(p, { n: q.end < H ? 3 : 6, speed: 1.6, cols: [[1, 1, 1], col], size: 0.05, life: 0.6, g: -1.5, shape: 0 }); }
  }
  // the great sword over the middle: it takes shape high up as the downpour ends, and falls with the blow
  const big = spiritSword(2.8), top = c0.clone().setY(c0.y + 3.6); big.material.opacity = 0;   // (its guard in the frame: taller, it read as a beam)
  v.timed(big, E - ctx.now(), () => {
    const T = ctx.now();
    if (T < H - 0.12) { const f = Math.max(0, Math.min(1, (T - (R1 - 0.45)) / 0.4)); big.material.opacity = f; big.position.copy(top).setY(top.y + 0.6 * (1 - f)); }
    else if (T < H) { const f = (T - (H - 0.12)) / 0.12; big.material.opacity = 1; big.position.copy(top).lerp(c0, f * f); }
    else { const f = Math.min(1, (T - H) / (E - H - 0.25)); big.position.copy(c0).setY(c0.y - 0.25 - f * 0.5); big.material.opacity = Math.max(0, 1 - f * 1.4); }
  });
  await ctx.until(R1 - 0.45);
  v.light(top, [0.55, 0.8, 1], 6, 0.5, 8);
  await ctx.until(H);
  // the blow: the ground heaves out from the middle, the field of swords bursts into light
  v.shake(0.3, 0.5); v.hitstop = 0.1; v.screen.chroma = 0.6;   // (no flash: over the night it washed the field milky)
  dustBurst(v, c0, 1.1); v.burst(c0.clone().setY(c0.y + 0.4), { n: 40, speed: 5, cols: [[1, 1, 1], [0.7, 0.9, 1], col], size: 0.06, life: 0.7, g: 3 });
  v.light(c0.clone().setY(c0.y + 1), [0.55, 0.8, 1], 22, 0.4, 9);
  glowTargets(ctx, 0.6); ctx.hit();
  // the light drifts up as the night lifts
  ticker(v, E - H - 0.2, (k, dt) => { for (let j = perSec(dt, 40 * (1 - k)); j > 0; j--) { const c = cells[(Math.random() * cells.length) | 0];
    v.spark(c.x + rand(-0.5, 0.5), c.y + rand(0, 0.5), c.z + rand(-0.5, 0.5), { vy: rand(0.5, 1.2), life: rand(0.6, 1.1), size: rand(0.03, 0.05), r: 0.7, gg: 0.88, b: 1, shape: 0, fadeIn: 0.2 }); } });
  await ctx.until(H + 0.45); v.screen.darkTarget = 0;   // (eased off; its colour kept)
  await ctx.until(E - 0.2); outro(ctx);
}
// 乾坤破: [ROM fx 5] swords fly up from the caster into the sky (1.8-2.6 s), a pause, and on the original's one sound
// (4.05 s after the cast begins) a sword drops into each cell of the cross and stands there, the blow at 5.6 s (over at
// 6.08 s). Redesigned [the user's call]: breaking heaven and earth. Five golden swords shoot up from 姬發 one after
// another and come down out of the sky into a ring over the cross, points down, wheeling clockwise ever faster with
// arcs of light crackling between them, while the earth under them stirs, pebbles lifting off it; they part, each over
// its cell, and on the sound plunge in together, golden cracks tearing from the arms to the middle; planted, they hum,
// the cracks glowing hotter and the ground trembling, until on the blow the swords burst into gold and the earth breaks
// open along the cracks
async function qiankunBreak(ctx) {
  const v = ctx.vfx, GOLD = [1, 0.78, 0.32], cells = cellsOf(ctx).slice(0, 5), c0 = cells[0], F = 4.05, H = 5.6, E = 6.08, RING = 2.75, PART = 3.8;
  await intro(ctx, GOLD, { dur: 850, dist: 11, pitch: 0.45 });
  DARK(ctx, 0.7, 0.85, 0.75, 0.5);
  const hand = ctx.caster.chest().add(V(0, 0.3, 0)), up = hand.clone().setY(hand.y + 8), N = cells.length, SC = 1.6, BL = 1.24 * SC, B = basis(ctx);
  let spin = 0, w = 2, last = ctx.now();
  const swords = cells.map((c, i) => {
    const s = swordMesh(GOLD, SC), q = { s, c, i, launch: Math.max(ctx.now(), 1.4) + i * 0.16, ph: rand(0, 6.28), mats: [] };
    s.traverse(m => { if (m.material) { m.material.transparent = true; q.mats.push(m.material); } });
    q.drop = c.clone().addScaledVector(B.toCam, -0.3).setY(c.y + BL - 0.45);   // (planted, its point 0.45 in the ground, just behind the unit on the cell: in front, its glow washed the unit out)
    v.timed(s, E - ctx.now(), () => fly(q));
    return q;
  });
  const ringAt = (q, T) => { const th = spin + q.i / N * Math.PI * 2; return c0.clone().add(V(Math.cos(th) * 0.95, 3.1 + Math.sin(T * 4 + q.i) * 0.08, Math.sin(th) * 0.95)); };
  const glow = (q, g) => { for (const m of q.mats) if (m.blending === THREE.AdditiveBlending) m.opacity = g; };
  function fly(q) {
    const T = ctx.now(), s = q.s;
    if (q.i === 0) { const dt = T - last; last = T; if (T > RING - 0.35 && T < PART) { w = Math.min(9, w + dt * 4.5); spin += w * dt; } }   // (the ring's turn: the angle rising, clockwise seen from above)
    if (T < q.launch) { s.visible = false; return; }
    s.visible = true;
    if (T < q.launch + 0.45) {   // up out of his hand into the sky
      const f = (T - q.launch) / 0.45; s.position.copy(hand).lerp(up, f * f); pointAlong(s, V(0, 1, 0));
      if (!q.rib) q.rib = v.ribbon({ col: GOLD, width: 0.07, n: 10, fade: 0.3 }); q.rib.push(s.position.clone().setY(s.position.y + BL * 0.5));
    } else if (T < RING - 0.35 + q.i * 0.05) { s.visible = false; if (q.rib && !q.ribEnd) { q.ribEnd = 1; q.rib.end(); } }   // (in the sky, out of sight)
    else if (T < PART) {   // down out of the sky into the ring, wheeling, points down
      const f = Math.min(1, (T - (RING - 0.35 + q.i * 0.05)) / 0.35), p = ringAt(q, T), from = p.clone().setY(p.y + 6);
      s.position.copy(from).lerp(p, 1 - (1 - f) * (1 - f)); pointAlong(s, V(0, -1, 0)); s.rotateY(spin); glow(q, 0.9);
      if (!q.trail) q.trail = v.ribbon({ col: [1, 0.7, 0.25], width: 0.16, n: 22, fade: 0.45 }); q.trail.push(s.position.clone().setY(s.position.y - BL * 0.5));
    } else if (T < F) {   // the ring parts: each over its own cell, then the plunge
      if (q.trail && !q.trailEnd) { q.trailEnd = 1; q.trail.end(); q.from = s.position.clone(); }
      const over = q.c.clone().setY(q.c.y + BL + 1.6), f = Math.min(1, (T - PART) / 0.18), g = Math.max(0, (T - (F - 0.08)) / 0.08);
      s.position.copy(q.from).lerp(over, ease(f)).lerp(q.drop, g * g); pointAlong(s, V(0, -1, 0));
    } else if (T < H) {   // planted, humming
      const hum = Math.min(1, (T - F) / (H - F)); s.position.copy(q.drop).setY(q.drop.y + (T > H - 0.15 ? (T - (H - 0.15)) * 0.8 : 0));
      pointAlong(s, V(0, -1, 0)); s.rotateX(Math.sin(T * (30 + 40 * hum) + q.ph) * 0.03 * (0.4 + hum)); s.rotateZ(Math.cos(T * (27 + 35 * hum) + q.ph) * 0.03 * (0.4 + hum));
      s.traverse(m => { if (m.material && m.material.emissive) m.material.emissiveIntensity = 0.55 + 1.6 * hum * (0.7 + 0.3 * Math.sin(T * 25)); }); glow(q, 0.45 + 0.35 * hum);
    } else s.visible = false;
  }
  // the earth under the ring stirs: shadows spread on the cells, pebbles lift off them
  await ctx.until(RING - 0.4);
  for (const c of cells) shadowDisc(v, c, 0.5, F + 0.3 - ctx.now(), { grow: F - ctx.now(), a: 0.6 });
  const pebbles = cells.flatMap(c => [0, 1, 2].map(() => { const r = rockMesh(rand(0.04, 0.07)), p = c.clone().add(V(rand(-0.4, 0.4), 0, rand(-0.4, 0.4))), h = rand(0.25, 0.6), t0 = ctx.now() + rand(0, 0.4), ph = rand(0, 6);
    v.timed(r, F - ctx.now(), () => { const T = ctx.now(), f = Math.max(0, Math.min(1, (T - t0) / (F - t0))); r.position.copy(p).setY(p.y + ease(f) * h + Math.sin(T * 9 + ph) * 0.02 * f); r.rotation.y += 0.02; }); return { r, p, h }; }));
  // arcs of light crackle between the swords as the ring turns
  ticker(v, PART - ctx.now(), (k, dt) => { if (ctx.now() < RING) return; for (let j = perSec(dt, 6); j > 0; j--) { const i = (Math.random() * N) | 0, a = swords[i], b = swords[(i + 1) % N]; if (a !== b) v.bolt(a.s.position.clone().setY(a.s.position.y - BL * 0.45), b.s.position.clone().setY(b.s.position.y - BL * 0.45), [1, 0.75, 0.3], 0.07, { width: 0.02, jag: 0.4 }); } });   // (few, gold, next-door only: many white ones hid the swords)
  await ctx.until(RING); v.light(c0.clone().setY(c0.y + 3), GOLD, 4, PART - RING, 6);
  // the plunge, on the sound: dust, sparks and the pebbles flung off; golden cracks tear from the arms to the middle
  await ctx.until(F); ctx.cue();
  v.shake(0.22, 0.35); v.hitstop = 0.06;
  for (const c of cells) { dustBurst(v, c, 0.45); v.burst(c.clone().setY(c.y + 0.1), { n: 14, speed: 2.8, cols: [[1, 0.95, 0.7], GOLD], size: 0.045, life: 0.45, g: 6, up: 0.7, shape: 1 }); }
  for (const pb of pebbles) { pb.r.visible = false; const r = rockMesh(rand(0.04, 0.07)), a = rand(0, 6.28), d = rand(0.4, 1); lob(v, r, pb.p.clone().setY(pb.p.y + pb.h), pb.p.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)), rand(0.3, 0.7), rand(0.4, 0.6)); }
  v.light(c0.clone().setY(c0.y + 0.6), GOLD, 8, 0.3, 6);
  const cracks = cells.slice(1).filter(c => Math.abs(c.y - c0.y) < 0.2).map(c => chasm(v, [c.clone().setY(c0.y), c0.clone()], GOLD, { w: 0.2, y: c0.y, life: E + 0.1 - ctx.now(), wander: 0.07, prof: t => Math.min(1, t / 0.1) * (0.7 + 0.3 * t) }));
  // planted, they hum, the cracks glowing hotter, the ground trembling more and more
  ticker(v, H - F, (k, dt, t) => { for (const ch of cracks) { ch.front = ease(Math.min(1, t / 0.25)); ch.open = Math.min(1, t / 0.3) * (0.6 + 0.4 * k); ch.hot = 0.6 + 1.6 * k * k; }
    if (Math.random() < dt * (3 + 20 * k)) v.shake(0.02 + 0.05 * k, 0.1);
    for (let j = perSec(dt, 10 + 50 * k); j > 0; j--) { const c = cells[(Math.random() * N) | 0]; v.spark(c.x + rand(-0.45, 0.45), c.y + 0.05, c.z + rand(-0.45, 0.45), { vy: rand(0.5, 1.4), life: rand(0.5, 0.9), size: rand(0.025, 0.045), r: 1, gg: 0.82, b: 0.4, shape: 0, fadeIn: 0.15 }); } });
  // 破: the blow. The swords burst into gold, the earth breaks open along the cracks
  await ctx.until(H);
  v.shake(0.32, 0.5); v.hitstop = 0.1; v.screen.chroma = 0.5;
  for (const q of swords) { const p = q.drop.clone().setY(q.drop.y - BL * 0.4); v.burst(p, { n: 26, speed: 4, cols: [[1, 1, 0.85], GOLD, [1, 0.55, 0.15]], size: 0.06, life: 0.7, g: 3, up: 0.6 }); dustBurst(v, q.c, 0.55); }
  for (const ch of cracks) for (let i = 0; i < 3; i++) { const p = ch.at(rand(0.15, 0.9)), r = rockMesh(rand(0.06, 0.11)), a = rand(0, 6.28), d = rand(0.4, 1);
    lob(v, r, p.clone().setY(c0.y + 0.1), p.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)).setY(c0.y), rand(0.8, 1.6), rand(0.5, 0.8), q => dustBurst(v, q, 0.2));
    for (let j = 0; j < 8; j++) { const q = ch.at(rand(0, 1)); v.spark(q.x, q.y + 0.05, q.z, { vx: rand(-0.3, 0.3), vy: rand(2.5, 5), vz: rand(-0.3, 0.3), g: 6, life: rand(0.4, 0.7), size: rand(0.04, 0.06), r: 1, gg: rand(0.7, 0.9), b: 0.35, shape: 1 }); } }
  for (const c of cells) v.pillar(c, GOLD, 0.2, 3, 0.4, { intensity: 0.6 });   // (columns of gold out of the broken ground)
  v.light(c0.clone().setY(c0.y + 0.8), GOLD, 22, 0.45, 7);
  glowTargets(ctx, 0.6); ctx.hit();
  ticker(v, E - H - 0.05, k => { for (const ch of cracks) { ch.open = (1 - ease(k)) * 1.2; ch.hot = k < 0.15 ? 2.6 : 2.6 * (1 - (k - 0.15) / 0.85); ch.a = 1 - Math.max(0, (k - 0.6) / 0.4); } }, () => cracks.forEach(ch => { ch.a = 0; }));
  await ctx.until(H + 0.25); v.screen.darkTarget = 0;
  await ctx.until(E - 0.1); outro(ctx);
}
// 天劍訣: [ROM fx 3] the original fans its swords out over the target and dives them into it one after another, one on
// each of its eight sounds (4.4 s after the cast begins, data/spellsound.js apart), the blow at 7 s. Remade as 姬發's
// last spell [the user's call, 2026-10-30: next-gen]: night-blue; a beam of light pierces the sky over the target and a
// dome of twenty-four spectral blades forms round it, turning slowly, all aimed in at it; on each sound three of them
// streak through it, each cut leaving a crescent of light; then one colossal blade of light drops down the beam and
// pierces it, the cuts all flaring at once
function slashArc(v, p, col, size, life) {   // a crescent cut of light at p, any way round, flashing and fading
  const g = new THREE.Group(), arc = 2.3, tube = (r, w, a) => new THREE.Mesh(new THREE.TorusGeometry(r, w, 4, 40, arc), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const soft = tube(size, size * 0.08, 0.45), sharp = tube(size, size * 0.022, 1); sharp.material.color.setRGB(1, 1, 1); g.add(soft, sharp);
  g.position.copy(p); g.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)); g.rotateZ(-arc / 2);
  return v.timed(g, life, k => { const s2 = 0.75 + 0.5 * Math.sqrt(k); g.scale.setScalar(s2); soft.material.opacity = 0.45 * (1 - k); sharp.material.opacity = 1 - k * k; });
}
async function skySwords(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [0.55, 0.85, 1], F = 4.4, E = 7.0, N = 24;
  await intro(ctx, col, { dur: 900, dist: 9.5, pitch: 0.4 });
  DARK(ctx, 0.6, 0.85, 0.6, 0.3);
  const T = ctx.now(), tr = ctx.track.length ? ctx.track : [0, 0.27, 0.53, 0.8, 1.07, 1.33, 1.6, 1.87], last = F + tr[tr.length - 1], fin = last + 0.3, W = fin - T;
  const ctr = at.clone().setY(at.y + 0.55), R = 1.9;
  [[T + 0.1, -0.8, 1.1], [T + 1.3, 0, 1], [T + 2.5, 0.8, 1]].forEach(([s2, yaw, sp]) => shotAt(ctx, s2, ctr.clone(), { dist: 10, pitch: 0.42, yaw, speed: sp }));   // a slow orbit round the dome
  shotAt(ctx, fin - 0.6, at.clone().add(V(0, 2.5, 0)), { dist: 11, pitch: 0.25, yaw: 0.2, speed: 2 });   // up the beam as the great blade drops
  shotAt(ctx, fin + 0.2, at.clone().add(V(0, 0.6, 0)), { dist: 10, pitch: 0.5, yaw: -0.2, speed: 1.5 });
  // the beam over the target, and motes of light drawn in to it
  v.pillar(at, [0.6, 0.85, 1], 0.28, 14, W + 0.4, { intensity: 0.7 });
  v.light(ctr.clone().setY(ctr.y + 2), col, 20, W + 0.4, 8);
  ticker(v, W, (k, dt) => { if (Math.random() < dt * 30) { const d = V(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize(), p = ctr.clone().addScaledVector(d, rand(2.2, 3)); v.spark(p.x, p.y, p.z, { vx: -d.x * 2, vy: -d.y * 2, vz: -d.z * 2, life: 0.6, size: 0.04, r: 0.75, gg: 0.92, b: 1, shape: 0 }); } });
  // the dome: blades on a sphere round it (its upper part: the lowest at the ground), aimed in, turning slowly
  const base = Array.from({ length: N }, (_, i) => { const y = -0.28 + (i + 0.5) / N * 1.25, r = Math.sqrt(Math.max(0, 1 - y * y)), f = i * 2.39996; return V(Math.cos(f) * r, y, Math.sin(f) * r); });
  let turn = 0; ticker(v, W + 0.5, (k, dt) => { turn += dt * 0.5; });
  const seat = i => { const b = base[i], c = Math.cos(turn), sn = Math.sin(turn); return ctr.clone().add(V((b.x * c - b.z * sn) * R, b.y * R, (b.x * sn + b.z * c) * R)); };
  const blades = base.map((_, i) => {
    const s = swordMesh(col, 0.8), b = { s, gone: false, flying: false }, appear = 0.2 + i * 0.05; s.visible = false;
    v.timed(s, W + 0.6, (k, dt, t) => {
      if (b.gone) { s.visible = false; return; } if (b.flying || t < appear) return;
      const g = Math.min(1, (t - appear) / 0.3), p = seat(i); s.visible = true; s.position.copy(p); pointAlong(s, ctr.clone().sub(p)); s.scale.setScalar(0.8 * g + 0.01);
      if (g < 1 && Math.random() < 0.3) v.spark(p.x, p.y, p.z, { life: 0.3, size: 0.06, size1: 0.01, r: 0.8, gg: 0.95, b: 1, shape: 0 });
    });
    return b;
  });
  // the cuts: on each sound three blades streak through it to the far side, each leaving a crescent of light
  cueAt(ctx, F);
  tr.forEach((d, i) => {
    for (const j of [i, i + 8, i + 16]) {
      const b = blades[j];
      ctx.until(F + d - 0.06).then(() => {
        b.flying = true; const from = b.s.position.clone(), to = ctr.clone().multiplyScalar(2).sub(from), dir = to.clone().sub(from).normalize(), rib = v.ribbon({ col, width: 0.09, n: 10 }), core = v.ribbon({ col: [1, 1, 1], width: 0.025, n: 8 });
        let cut = false;
        v.timed(new THREE.Object3D(), 0.12, k => { const p = from.clone().lerp(to, k); b.s.position.copy(p); pointAlong(b.s, dir); rib.push(p); core.push(p);
          if (k > 0.45 && !cut) { cut = true; slashArc(v, ctr, [0.6, 0.9, 1], rand(0.55, 0.8), 0.35); v.burst(ctr, { n: 10, speed: 3, cols: [[1, 1, 1], col], size: 0.045, life: 0.35, shape: 1 }); v.flash(col, 0.05); v.shake(0.05, 0.08); glowTargets(ctx, 0.6, 0.15); } },
          () => { rib.end(); core.end(); b.gone = true; v.burst(to, { n: 8, speed: 1.2, cols: [col, [1, 1, 1]], size: 0.04, life: 0.5, g: 0 }); });
      });
    }
  });
  // the blow: a colossal blade of light drops down the beam and pierces it; every cut flares at once
  await ctx.until(fin - 0.35);
  const big = swordMesh([0.7, 0.95, 1], 3.4), top = at.clone().setY(at.y + 11), end = at.clone().setY(at.y - 0.5), rib = v.ribbon({ col, width: 0.5, n: 14 });
  big.rotation.x = Math.PI;
  v.timed(big, 1.4, (k, dt, t) => { const f = Math.min(1, t / 0.35); big.position.copy(top).lerp(end, f * f); if (f < 1) rib.push(big.position.clone().setY(big.position.y + 2.6)); else rib.end(); if (t > 1.1) big.scale.setScalar(3.4 * Math.max(0.001, (1.4 - t) / 0.3)); });
  await ctx.until(fin);
  v.flash([0.85, 0.95, 1], 0.8); v.impact(at, col, 1.8); v.hitstop = 0.16; v.screen.chroma = 0.5;
  v.pillar(at, [0.6, 0.85, 1], 0.7, 9, 1.0, { intensity: 2, grow: 1 }); v.ring(at, col, 5, 0.9, { intensity: 1.6 }); v.ring(at, [1, 1, 1], 2.5, 0.5);
  for (let i = 0; i < 8; i++) slashArc(v, ctr, [0.6, 0.9, 1], rand(0.7, 1.2), 0.6);
  for (let i = 0; i < 40; i++) v.spark(ctr.x, ctr.y, ctr.z, { vx: rand(-4, 4), vy: rand(-1, 4), vz: rand(-4, 4), g: 5, life: rand(0.6, 1), size: rand(0.03, 0.06), r: 0.8, gg: 0.95, b: 1, shape: 0, flicker: 1, ph: rand(0, 9), floor: at.y + 0.02 });   // glittering shards
  ctx.hit(); await ctx.until(E + 0.3); outro(ctx);
}
// 怒劍式: [ROM fx 7] (林雲's, at Lv 48) the original raises his swords into a spinning star over the target and strikes it with them one
// by one, one on each of its eight sounds (3.42 s after the cast begins, data/spellsound.js apart), the blow at 6.52 s.
// Remade [the user's call, 2026-10-30: next-gen, no wheel]: the sky turns blood-red and the ground under the target glows
// hot; sixteen blades burst out of the earth round it on trails of fire and spiral up into a crown of swords aimed down
// at it, red lightning crackling between them, embers rising. On each sound two opposite blades tear free and plunge
// through the target into the ground, where they stay, a cage of glowing blades; after the last, the cage flares and
// erupts in a column of fire, the blades shatter into sparks: the blow.
async function furySwords(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [1, 0.26, 0.05], hot = [1, 0.55, 0.15], F = 3.42, E = 6.52, N = 16;   // (deep: additive light blooms toward white)
  await intro(ctx, col, { dur: 900, dist: 10, pitch: 0.4 });
  DARK(ctx, 0.6, 0.3, 0.85, 0.9);   // (the grade darkens each channel by these: red least, a blood-red sky)
  const T = ctx.now(), tr = ctx.track.length ? ctx.track : [0, 0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.45], last = F + tr[tr.length - 1], fin = last + 0.15, W = fin - T;
  const hub = at.clone().setY(at.y + 2.7), R = 1.25, tg = at.clone().setY(at.y + 0.5);
  cueAt(ctx, F);
  // the heat: the ground glows under the target, embers rise round it, a dull red light swells over it
  v.decal(at, [1, 0.32, 0.08], 1.5, W + 0.6, { in: 1.2, intensity: 0.75, flicker: true });
  v.light(hub, col, 26, W + 0.3, 9);
  const core = glowCard(v, col, 1.1); core.position.copy(hub); v.timed(core, W, (k, dt, t) => { const g = Math.min(1, t / 1.5); core.scale.setScalar(0.4 + 0.9 * g + 0.08 * Math.sin(t * 23)); core.material.opacity = 0.45 + 0.35 * g; });
  ticker(v, W, (k, dt) => { if (Math.random() < dt * 40) { const a = rand(0, 6.28), r = rand(0, 1.3); v.spark(at.x + Math.cos(a) * r, at.y + 0.05, at.z + Math.sin(a) * r, { vy: rand(0.8, 2.2), vx: rand(-0.2, 0.2), vz: rand(-0.2, 0.2), life: rand(0.8, 1.4), size: rand(0.03, 0.055), r: 1, gg: rand(0.4, 0.7), b: 0.15, shape: 0, flicker: 1, ph: rand(0, 9) }); } });
  // the crown: each blade bursts from the ground at its own bearing, spirals in and up to its place, tip down at the target
  let spin = 0; ticker(v, W, (k, dt, t) => { spin += dt * Math.min(3.2, 0.6 + t * 1.4); });
  const blades = [], seat = j => { const a = j / N * Math.PI * 2 + spin; return hub.clone().add(V(Math.cos(a) * R, Math.sin(a * 3 + spin) * 0.06, Math.sin(a) * R)); };
  for (let j = 0; j < N; j++) {
    const a0 = j / N * Math.PI * 2, from = at.clone().add(V(Math.cos(a0) * 3.0, 0, Math.sin(a0) * 3.0)), appear = 0.15 + j * 0.055, rise = 0.95;
    from.y = effectH(from.x, from.z);
    const s = swordMesh(col, 0.95), fire = v.ribbon({ col, width: 0.11, n: 18 }), core2 = v.ribbon({ col: hot, width: 0.03, n: 12 }), b = { s, stuck: null, gone: false };
    blades.push(b); s.visible = false;
    later(appear * 1000, () => { v.burst(from.clone().setY(from.y + 0.1), { n: 12, speed: 2.4, cols: [hot, col], size: 0.05, life: 0.5, g: 5, up: 0.8, shape: 1, floor: from.y + 0.02 }); v.decal(from, col, 0.35, 0.8, { intensity: 0.8 }); });
    v.timed(s, W + 0.6, (k, dt, t) => {
      if (b.gone) { s.visible = false; return; }
      if (b.stuck) return;
      if (t < appear) return;
      s.visible = true;
      const f = Math.min(1, (t - appear) / rise), e = ease(f), place = seat(j);
      if (f < 1) {   // out of the ground, round and up: a spiral that closes on its seat
        const a = a0 + (1 - e) * -1.6 + spin * e, r = 3.0 + (R - 3.0) * e, p = at.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = from.y + (place.y - from.y) * Math.sin(e * Math.PI / 2) + Math.sin(e * Math.PI) * 0.6;
        s.position.copy(p); pointAlong(s, V(0, 1, 0).lerp(tg.clone().sub(p).normalize(), e)); fire.push(p); core2.push(p);
      } else { s.position.copy(place); pointAlong(s, tg.clone().sub(place)); fire.push(place); core2.push(place); if (t - appear > rise + 0.25) { fire.end(); core2.end(); } }
    });
  }
  // red lightning crackling between neighbouring blades of the crown
  ticker(v, W - 0.2, (k, dt, t) => { if (t > 1.6 && Math.random() < dt * 9) { const j = (Math.random() * N) | 0, A = blades[j], B = blades[(j + 1) % N]; if (!A.stuck && !B.stuck && A.s.visible && B.s.visible) v.bolt(A.s.position.clone(), B.s.position.clone(), [1, 0.35, 0.2], 0.09, { width: 0.025, jag: 0.25 }); } });
  later(Math.max(0, (F - 0.7 - ctx.now()) * 1000), () => ctx.cam.shot(at.clone().add(V(0, 1.3, 0)), { cine: true, dist: 8.5, pitch: 0.5, yaw: 0.35, speed: 1.6 }));   // in on the crown (not lower: a cliff by the target would come between)
  // the strikes: on each sound two opposite blades tear free and plunge through the target into the ground
  tr.forEach((d, i) => {
    for (const j of [i % N, (i + N / 2) % N]) {
      const b = blades[j], launch = F + d - 0.16;
      ctx.until(launch).then(() => {
        const from = b.s.position.clone(), out = from.clone().sub(hub).setY(0).normalize(), stick = at.clone().addScaledVector(out, -0.42); stick.y = at.y - 0.12;   // (through him: it lands on his far side)
        const dir = stick.clone().sub(from).normalize(), fire = v.ribbon({ col, width: 0.16, n: 14 }), white = v.ribbon({ col: [1, 0.75, 0.4], width: 0.045, n: 10 });
        b.stuck = true;
        v.timed(new THREE.Object3D(), 0.16, (k) => {
          const p = from.clone().addScaledVector(out, 0.25 * Math.sin(Math.min(1, k * 3) * Math.PI)).lerp(stick, Math.max(0, (k - 0.3) / 0.7) ** 1.6);   // a hitch back, then the plunge
          b.s.position.copy(p); pointAlong(b.s, dir); fire.push(p); white.push(p);
        }, () => {
          b.s.position.copy(stick); pointAlong(b.s, dir); fire.end(); white.end();
          v.burst(tg, { n: 18, speed: 3.6, cols: [[1, 1, 1], hot, col], size: 0.05, life: 0.45, shape: 1 });
          v.ring(tg, col, 1.2, 0.22, { vertical: true, yaw: yawOf(out), y: tg.y, intensity: 2.2 });
          v.decal(stick, hot, 0.3, 1.2, { intensity: 0.9 }); v.smokePuff(stick.x, at.y + 0.1, stick.z, { vy: 0.5, life: 0.9, size: 0.2, size1: 0.6, tint: [0.35, 0.22, 0.18] });
          v.flash(col, 0.07); v.shake(0.08, 0.1); v.hitstop = Math.max(v.hitstop, 0.035); glowTargets(ctx, 0.7, 0.18);
          for (const c of b.s.children) if (c.material && c.material.emissive) c.material.emissiveIntensity = 1.4;   // (stuck: glowing hot)
        });
      });
    }
  });
  // the blow: the cage flares, then erupts in a column of fire; the blades shatter into sparks
  await ctx.until(fin - 0.18);
  for (const b of blades) for (const c of b.s.children) if (c.material && c.material.emissive) { c.material.emissive.setRGB(1, 0.4, 0.1); c.material.emissiveIntensity = 3; }
  v.light(tg, hot, 40, 0.5, 6);
  await ctx.until(fin);
  v.flash([1, 0.55, 0.3], 0.5); v.impact(at, col, 1.9); v.hitstop = 0.15; v.shake(0.3, 0.45);
  v.pillar(at, [1, 0.22, 0.03], 0.62, 6.5, 1.0, { intensity: 1.6, grow: 1 }); v.pillar(at, [1, 0.55, 0.15], 0.3, 7, 0.7, { intensity: 1.1 });
  v.ring(at, col, 4.2, 0.9, { intensity: 1.6, y: at.y + 0.05 }); v.ring(at, [1, 1, 1], 2.4, 0.5, { y: at.y + 0.05 });
  v.explode(at.clone().setY(at.y + 0.3), 0.7, { tint: [1, 0.6, 0.3] });
  for (const b of blades) { const p = b.s.position.clone().add(V(0, 0.4, 0)); v.burst(p, { n: 10, speed: 3, cols: [[1, 1, 1], hot, col], size: 0.045, life: 0.6, g: 6, shape: 1, floor: at.y + 0.02 }); b.gone = true; b.s.visible = false; }
  ctx.hit(); await ctx.until(E + 0.3); outro(ctx);
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
// a great blade of light, point down, its flat to the camera or edge on along a line (yaw: the group's x along it)
function bigBlade(sc, yaw) { const g = new THREE.Group(), s = swordMesh(AMBER, sc); s.rotation.z = Math.PI; g.add(s); g.rotation.y = yaw; g.blade = s; return g; }
const bladeLen = sc => 1.24 * sc;
// 地裂刀: [ROM fx 8] the earth splits in a long fissure from 黃天化's side, under the target and on past it (1.2 s, after the
// original's sound at 1.12 s), and the target is struck as it closes (2.0 s; over at 2.5 s). Here a great blade of amber
// light drops point first into the ground short of the target and ploughs on through the earth under it, tearing the
// chasm open behind it, its lips heaving up and its depths glowing; past the target it lifts away, the ground under the
// target bursts up in rock and light (the blow), and the chasm grinds shut
async function earthSplit(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), cp = ctx.caster.pos.clone(), dir = facing(cp, at), F = 1.12, H = 2.0, E = 2.5;
  cueAt(ctx, F);
  const shot = intro(ctx, AMBER, { dur: 700, dist: 9, pitch: 0.4 });   // (not waited for: his own casting runs past the original's beat, and the blade falls as he ends it)
  await ctx.until(F - 0.32);
  DARK(ctx, 0.4, 0.6, 0.8, 0.95);
  const back = levelRun(at, dir.clone().negate(), Math.min(2.2, Math.max(0.8, cp.distanceTo(at) - 0.7))), ahead = levelRun(at, dir, 1.3), L = back + ahead, tAt = back / L;
  const a0 = at.clone().addScaledVector(dir, -back), a1 = at.clone().addScaledVector(dir, ahead);
  const ch = chasm(v, [a0, a1], AMBER, { w: 0.36, life: E + 0.1 - ctx.now(), prof: t => Math.min(1, t / 0.12, (1 - t) / 0.2) * (0.55 + 0.45 * Math.max(0, 1 - Math.abs(t - tAt) / 0.45)) });
  // the blade: it falls point first into the ground, ploughs through it to past the target and lifts away
  const SC = 2.3, BL = bladeLen(SC), b = bigBlade(SC, Math.atan2(-dir.z, dir.x)), sink = 0.85, T0 = Math.max(ctx.now(), F - 0.3), PL = 0.45;
  b.blade.rotation.z = Math.PI + 0.28;   // (leaning, its point ahead: cutting forward)
  const ground = a0.y, mats = []; b.traverse(m => m.material && mats.push(m.material));
  const lamp = (p, i, l) => v.light(p.clone().setY(ground + 0.5), AMBER, i, l, 4);
  v.timed(b, H - T0, (k, dt) => {
    const T = ctx.now(); let p, y = ground + BL - sink, op = 1;
    if (T < F) { const f = Math.max(0, (T - T0) / (F - T0)); p = a0; y += (1 - f * f) * 4; op = Math.min(1, f * 3); }
    else if (T < F + PL) { const g = 1 - Math.pow(1 - (T - F) / PL, 2); p = a0.clone().lerp(a1, g); ch.front = g;
      // where it cuts the ground: sparks sprayed back and up, the earth flung aside
      for (let j = perSec(dt, 90); j > 0; j--) v.spark(p.x, ground + 0.05, p.z, { vx: -dir.x * rand(1, 3) + rand(-1, 1), vy: rand(1.5, 3.5), vz: -dir.z * rand(1, 3) + rand(-1, 1), g: 9, life: rand(0.3, 0.55), size: rand(0.03, 0.05), r: 1, gg: rand(0.7, 0.9), b: 0.4, shape: 1 }); }
    else { const f = (T - F - PL) / (H - F - PL); p = a1; ch.front = 1; y += f * f * 3.5; op = 1 - f; }
    b.position.set(p.x, y, p.z); for (const m of mats) { m.transparent = true; m.opacity = op * (m.blending === THREE.AdditiveBlending ? 0.9 : 1); }   // (its glow full: a blade of light)
  });
  await ctx.until(F);
  v.shake(0.16, 0.3); v.hitstop = 0.05; dustBurst(v, a0, 0.6); lamp(a0, 10, 0.4);
  ticker(v, H - F, (k, dt, t) => { ch.open = Math.min(1, t / 0.6); ch.hot = Math.min(1, t / 0.3) * (0.8 + 0.2 * Math.sin(t * 20)); });
  await ctx.until(F + PL); await shot;
  lamp(at, 6, H - F - PL + 0.3);
  // the ground under the target gathers itself: it trembles, its light swells
  await ctx.until(H - 0.2);
  v.shake(0.06, 0.2);
  ticker(v, 0.2, k => { ch.hot = 1 + k * 1.2; });
  await ctx.until(H - 0.07);
  for (let i = 0; i < 8; i++) {   // spears of rock thrust up out of the chasm either side of the target (not on it: they hid it), leaning out of it
    const off = (i < 4 ? -1 : 1) * (0.35 + (i % 4) * 0.17), t = tAt + off / L, q = ch.at(t), sg = i % 2 ? 1 : -1, n = V(-dir.z, 0, dir.x).multiplyScalar(sg), r = rockMesh(rand(0.14, 0.22), 0x6b5a46), h = rand(0.6, 0.9) * (1 - (i % 4) * 0.15);
    r.scale.y *= 3; pointAlong(r, n.clone().multiplyScalar(rand(0.3, 0.6)).add(dir.clone().multiplyScalar(rand(-0.3, 0.3))).setY(1)); q.addScaledVector(n, 0.08);
    v.timed(r, 0.7, k => { const up = k < 0.15 ? Math.sin(k / 0.15 * Math.PI / 2) : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; r.position.copy(q).setY(at.y - 0.3 + up * h); }); }
  await ctx.until(H);
  // the blow: the earth under the target bursts up, spears of rock thrust through it, stones thrown wide; light up the gap
  v.shake(0.26, 0.45); v.hitstop = 0.08;
  for (let i = 0; i < 10; i++) { const r = rockMesh(rand(0.07, 0.13)), a = rand(0, 6.28), d = rand(0.8, 1.8); lob(v, r, at.clone().setY(at.y + 0.2), at.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)).setY(at.y), rand(1.4, 2.6), rand(0.6, 0.9), q => dustBurst(v, q, 0.25)); }
  dustBurst(v, at, 0.8);
  for (let i = 0; i < 40; i++) { const q = ch.at(tAt + rand(-0.8, 0.8) / L); v.spark(q.x, q.y + 0.05, q.z, { vx: rand(-0.4, 0.4), vy: rand(2.5, 5.5), vz: rand(-0.4, 0.4), g: 6, life: rand(0.4, 0.8), size: rand(0.04, 0.07), r: 1, gg: rand(0.65, 0.9), b: 0.35, shape: 1 }); }   // its light bursting out of the gap
  v.light(at.clone().setY(at.y + 0.6), AMBER, 20, 0.5, 6);
  glowTargets(ctx, 0.75); ctx.hit();
  // it grinds shut, its light dying
  ticker(v, E - H - 0.05, k => { const e = ease(k); ch.open = 1 - e; ch.hot = 2.2 * (1 - Math.min(1, k * 2)); ch.a = 1 - Math.max(0, (k - 0.6) / 0.4); }, () => { ch.a = 0; });
  await ctx.until(E - 0.1); outro(ctx);
}
// 十字斬: [ROM fx 9] blades fall from the sky onto the arms of the cross and stab into the ground (0.93-1.07 s); the
// ground splits open in a cross between them, through the target (1.2-2.1 s); the blades come up out of it (2.27 s) and
// the target is struck (2.8 s; over at 3.1 s). Here, risen, they turn on the middle and slash in from the four arms,
// crossing over it: the cross of the name; the chasm flares and grinds shut under the blow
async function crossSlash(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], B = basis(ctx), UP = 2.2, H = 2.8, E = 3.1;
  await intro(ctx, AMBER, { dur: 750, dist: 10.5, pitch: 0.48 });
  const DROP = Math.max(1.05, ctx.now() + 0.3), TEAR = DROP + 0.15;   // (his own casting runs past the original's 1.05 s: the original is silent, no sound to keep to)
  DARK(ctx, 0.4, 0.6, 0.8, 0.95);
  let arms = cells.slice(1).filter(c => c.distanceTo(c0) < 1.6);
  if (!arms.length) arms = [B.right, B.toCam].flatMap(d => [d, d.clone().negate()]).map(d => { const p = c0.clone().add(d); p.y = effectH(p.x, p.z); return p; });
  const SC = 1.9, BL = bladeLen(SC), yaw = Math.atan2(-B.right.z, B.right.x), lamp = (p, i, l) => v.light(p.clone().setY(p.y + 0.6), AMBER, i, l, 4);
  // the blades: high over the arms, a glint each, then they drop point first into the ground
  const blades = arms.map((c, i) => {
    const b = bigBlade(SC, yaw), mats = []; b.traverse(m => m.material && (m.material = m.material.clone(), m.material.transparent = true, mats.push(m.material)));
    const into = c0.clone().sub(c).setY(0).normalize(), drop = DROP + i * 0.04, st = { c: c.clone().addScaledVector(B.toCam, -0.32), line: c, into, drop, mats, b };   // (stood just behind the unit on its cell: in front, its glow washed the unit out)
    v.timed(b, E - ctx.now(), () => blade(st));
    return st;
  });
  const T0 = ctx.now(), sunk = c => c.y + BL - 0.55;
  const setOp = (st, o, g = 0.4) => { for (const m of st.mats) m.opacity = o * (m.blending === THREE.AdditiveBlending ? g : 1); };   // (g its glow: full only in the slash; stood on the arms' cells it washed the units there pale)
  function blade(st) {
    const T = ctx.now(), b = st.b, c = st.c;
    if (T < st.drop) { const f = Math.max(0, (T - T0) / (st.drop - T0)); b.position.set(c.x, sunk(c) + (1 - f * f) * 3.6, c.z); setOp(st, Math.min(1, f * 2.5)); }
    else if (T < UP) b.position.set(c.x, sunk(c), c.z);
    else if (T < H - 0.1) {   // pulled up out of the ground, then turning point first on the middle
      const f = Math.min(1, (T - UP) / 0.25), r = Math.max(0, Math.min(1, (T - UP - 0.2) / 0.2)), lift = ease(f);
      const tipDir = V(0, -1, 0).lerp(st.into, ease(r)).normalize(), mid = c.clone().lerp(st.line, ease(r)).addScaledVector(st.into, -0.2 * ease(r)).setY(c.y + BL / 2 - 0.55 + lift * 0.65);   // (out until its point clears the ground; onto the arm's line as it turns)
      mid.y += (c0.y + 0.6 - mid.y) * ease(r);   // (and down to the height it slashes at)
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tipDir); b.blade.rotation.set(0, 0, 0); b.rotation.set(0, 0, 0); b.quaternion.copy(q);
      b.position.copy(mid).addScaledVector(tipDir, -BL / 2);
      setOp(st, 1, 0.4 + 0.5 * r);
      if (!st.out && f > 0.1) { st.out = 1; v.burst(c.clone().setY(c.y + 0.1), { n: 10, speed: 2, cols: [[0.55, 0.45, 0.35], AMBER], size: 0.05, life: 0.5, g: 8, up: 1 }); }
    } else {   // the slash: in through the middle and out past the far arm, trailing light
      const f = (T - (H - 0.1)) / 0.2, p = st.line.clone().setY(c0.y + 0.6).addScaledVector(st.into, -0.2 + f * 2.5);
      b.position.copy(p).addScaledVector(st.into, -BL / 2);
      if (!st.rib) { st.rib = [v.ribbon({ col: [1, 0.6, 0.2], width: 0.42, n: 14, fade: 0.4 }), v.ribbon({ col: [1, 0.85, 0.55], width: 0.16, n: 12, fade: 0.35 }), v.ribbon({ col: [1, 1, 0.9], width: 0.05, n: 10, fade: 0.3 })]; }   // (a broad stroke: at play distance a thin one was lost)
      if (f < 1) st.rib.forEach(r => r.push(p.clone().addScaledVector(st.into, 0.3)));
      else if (!st.done) { st.done = 1; st.rib.forEach(r => r.end()); }
      setOp(st, Math.max(0, 1 - Math.max(0, f - 0.6) / 0.4), 0.9);
    }
  }
  await ctx.until(DROP);
  for (const st of blades) later(Math.max(0, (st.drop - DROP) * 1000), () => {
    const c = st.c; v.shake(0.07, 0.12); dustBurst(v, c, 0.35); lamp(c, 2, 0.3);
    v.burst(c.clone().setY(c.y + 0.1), { n: 14, speed: 2.6, cols: [[1, 0.9, 0.6], AMBER], size: 0.045, life: 0.45, g: 6, up: 0.6, shape: 1 }); });
  // the ground splits from each blade to the middle, a cross through the target
  await ctx.until(TEAR);
  const arm = arms.filter(c => Math.abs(c.y - c0.y) < 0.2).map(c => { const out = c.clone().sub(c0).setY(0).normalize();
    return chasm(v, [c.clone().addScaledVector(out, 0.3).setY(c0.y), c0.clone()], AMBER, { w: 0.3, y: c0.y, life: E + 0.1 - ctx.now(), wander: 0.08, prof: t => Math.min(1, t / 0.1) * (0.6 + 0.4 * t) }); });
  ticker(v, H - TEAR, (k, dt, t) => { for (const ch of arm) { ch.front = ease(Math.min(1, t / 0.3)); ch.open = Math.min(1, Math.max(0, (t - 0.1) / 0.5)); ch.hot = Math.min(1, t / 0.4) * (0.8 + 0.2 * Math.sin(t * 18)); } });
  await ctx.until(TEAR + 0.3);
  v.shake(0.14, 0.35); dustBurst(v, c0, 0.5); lamp(c0, 2.5, 0.6); v.burst(c0.clone().setY(c0.y + 0.2), { n: 18, speed: 3, cols: [[1, 0.9, 0.6], AMBER], size: 0.05, life: 0.6, g: 6, up: 1 });   // (the lights brief and low: lasting, they lit the units on the cross white)
  await ctx.until(UP);
  // the blow: the four meet over the middle; the chasm flares and grinds shut, stones thrown up along it
  await ctx.until(H);
  v.shake(0.24, 0.45); v.hitstop = 0.08; v.screen.chroma = 0.5;
  v.burst(c0.clone().setY(c0.y + 0.6), { n: 36, speed: 4.5, cols: [[1, 0.95, 0.8], AMBER, [1, 0.55, 0.2]], size: 0.06, life: 0.7, g: 4 });
  v.light(c0.clone().setY(c0.y + 0.7), AMBER, 22, 0.45, 6); v.ring(c0, AMBER, 1.3, 0.35, { intensity: 0.6 });
  for (const ch of arm) for (let i = 0; i < 3; i++) { const p = ch.at(rand(0.1, 0.9)), r = rockMesh(rand(0.06, 0.11)), a = rand(0, 6.28), d = rand(0.3, 0.8);
    lob(v, r, p.clone().setY(c0.y + 0.1), p.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)).setY(c0.y), rand(0.8, 1.5), rand(0.5, 0.75), q => dustBurst(v, q, 0.2)); }
  for (const c of cells) dustBurst(v, c, 0.35);
  glowTargets(ctx, 0.55); ctx.hit();
  ticker(v, E - H - 0.05, k => { for (const ch of arm) { ch.open = 1 - ease(k); ch.hot = k < 0.15 ? 2.4 : 2.4 * (1 - (k - 0.15) / 0.85); ch.a = 1 - Math.max(0, (k - 0.6) / 0.4); } }, () => arm.forEach(ch => { ch.a = 0; }));
  await ctx.until(E - 0.15); outro(ctx);
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
// a Chinese dragon's head, facing +z, about 1.7 long: a sculpted skull and snout (brow ridges over the eyes, cheekbones,
// a nose bulb, scales), a hinged lower jaw with teeth and fangs, slit-pupilled eyes, branching antlers, cheek frills, a
// flowing mane, a beard and long whiskers that sway. Returns { group, jaw (the hinge: rotation.x opens it), sway(t) }.
const scaleTex = once2('dragonScales', () => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e8c070'; g.fillRect(0, 0, 128, 128);
  for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) { const cx = x * 16 + (y % 2) * 8, cy = y * 14; const gr = g.createRadialGradient(cx, cy - 4, 1, cx, cy, 11); gr.addColorStop(0, '#fff4d0'); gr.addColorStop(0.6, '#f0cc78'); gr.addColorStop(1, '#a87a30');   // (the body's pale gold)
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.colorSpace = THREE.SRGBColorSpace; return t; });
function once2(k, f) { return () => (once2.c[k] || (once2.c[k] = f())); } once2.c = {};
function sculpt(geo, fn) { const P = geo.attributes.position, v = V(0, 0, 0); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); fn(v); P.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; }
function dragonHead() {
  const gold = new THREE.MeshStandardMaterial({ map: scaleTex(), color: 0xfff0d0, metalness: 0.55, roughness: 0.38, emissive: 0x6a4a18, emissiveIntensity: 0.8 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xffe8b0, metalness: 0.35, roughness: 0.45, emissive: 0x5a4818, emissiveIntensity: 0.7 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xfff6e0, metalness: 0.1, roughness: 0.4, emissive: 0x403830, emissiveIntensity: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8401a, metalness: 0.3, roughness: 0.5, emissive: 0x7a1808, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x5a0a06 });
  const g = new THREE.Group();
  // the skull and upper jaw: a sphere drawn out into a long snout, flat beneath, with brows, cheekbones and a nose
  const skull = sculpt(new THREE.SphereGeometry(1, 40, 28), v => {
    let { x, y, z } = v; const f = Math.max(0, z);   // (f: how far into the snout)
    x *= 0.42 * (1 - 0.42 * f ** 1.2); y *= (y < 0 ? 0.16 : 0.36) * (1 - 0.35 * f ** 1.1); z = z < 0 ? z * 0.45 : z * 0.5 + f ** 1.3 * 0.78;
    y -= 0.05 * f;
    const brow = Math.exp(-((Math.abs(x) - 0.22) ** 2 / 0.006 + (z - 0.24) ** 2 / 0.02)) * (y > 0 ? 1 : 0); y += brow * 0.15; x += Math.sign(x) * brow * 0.05;   // brow ridges, jutting over the eyes
    y += Math.exp(-(x * x) / 0.003) * (y > 0 ? 1 : 0) * Math.max(0, Math.min(1, (0.95 - z) * 3)) * Math.max(0, Math.min(1, (z + 0.1) * 4)) * 0.035;   // a ridge down the snout
    const cheek = Math.exp(-((z + 0.02) ** 2) / 0.03) * (Math.abs(y) < 0.15 ? 1 : 0.4); x += Math.sign(x) * cheek * 0.08;   // cheekbones
    const nose = Math.exp(-((Math.abs(x) - 0.09) ** 2 + (z - 1.12) ** 2) / 0.006) * (y > -0.02 ? 1 : 0); y += nose * 0.06;   // nostril bulbs
    v.set(x, y, z);
  });
  g.add(new THREE.Mesh(skull, gold));
  for (const sg of [-1, 1]) {   // nostrils
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mouthM); n.scale.set(1, 0.45, 0.8); n.position.set(sg * 0.085, 0.07, 1.19); g.add(n);   // (set into the nose)
  }
  // the lower jaw on its hinge, its mouth dark red inside, teeth along both jaws, two fangs
  const jaw = new THREE.Group(); jaw.position.set(0, -0.06, -0.05); g.add(jaw);
  const jawG = sculpt(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), v => { const f = Math.max(0, v.z); v.set(v.x * 0.3 * (1 - 0.45 * f), v.y * 0.13, v.z * 0.62 + 0.42 + f * 0.25); });
  jaw.add(new THREE.Mesh(jawG, pale));
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.7), mouthM); tongue.position.set(0, -0.03, 0.55); jaw.add(tongue);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.1), mouthM); roof.rotation.x = Math.PI / 2; roof.position.set(0, -0.045, 0.55); g.add(roof);
  for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) {
    const z = 0.32 + i * 0.13, w = 0.27 * (1 - 0.42 * Math.max(0, (z - 0.3) / 1.1));
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.022, i === 4 ? 0.2 : 0.09, 5), ivory); up.position.set(sg * w * 0.85, -0.08 - (i === 4 ? 0.05 : 0), z); up.rotation.x = Math.PI; g.add(up);   // (the fifth: the fang)
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.02, i === 2 ? 0.16 : 0.07, 5), ivory); lo.position.set(sg * w * 0.75, 0.02, z - 0.02); jaw.add(lo);
  }
  // the eyes: amber, slit-pupilled, glowing, under the brows
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.5), toneMapped: false }), pupilM = new THREE.MeshBasicMaterial({ color: 0x100400 });
  for (const sg of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(sg * 0.33, 0.1, 0.26); eye.rotation.y = sg * 1.25; g.add(eye);   // (on the sides, under the brow)
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), eyeM));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilM); pupil.scale.set(0.12, 0.85, 0.3); pupil.position.z = 0.055; eye.add(pupil);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, 0, Math.PI / 5), gold); lid.rotation.x = 0.5; eye.add(lid);   // (a heavy upper lid: a frown)
  }
  // antlers: a beam sweeping back and up with two tines; cheek frills; a mane flowing back; a beard
  const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, r, 6, false), m);
  for (const sg of [-1, 1]) {
    const base = V(sg * 0.17, 0.28, 0.02);
    g.add(tube([base, base.clone().add(V(sg * 0.1, 0.3, -0.25)), base.clone().add(V(sg * 0.16, 0.5, -0.65)), base.clone().add(V(sg * 0.12, 0.62, -1.05))], 0.032, ivory));
    g.add(tube([base.clone().add(V(sg * 0.12, 0.38, -0.4)), base.clone().add(V(sg * 0.2, 0.62, -0.38)), base.clone().add(V(sg * 0.22, 0.78, -0.5))], 0.02, ivory));
    g.add(tube([base.clone().add(V(sg * 0.15, 0.55, -0.75)), base.clone().add(V(sg * 0.28, 0.72, -0.72)), base.clone().add(V(sg * 0.32, 0.86, -0.85))], 0.016, ivory));
    const frill = new THREE.Shape(); frill.moveTo(0, 0); frill.quadraticCurveTo(-0.15, 0.25, -0.55, 0.22); frill.lineTo(-0.38, 0.1); frill.lineTo(-0.62, 0.02); frill.lineTo(-0.4, -0.06); frill.lineTo(-0.55, -0.18); frill.quadraticCurveTo(-0.2, -0.15, 0, 0);   // a cheek fin, its points streaming back
    const fr = new THREE.Mesh(new THREE.ShapeGeometry(frill), pale); fr.position.set(sg * 0.38, -0.02, -0.08); fr.rotation.set(0, sg * -1.35 + (sg > 0 ? Math.PI : 0), 0); g.add(fr);
  }
  const mane = [];
  for (let i = 0; i < 9; i++) {   // flowing spines, red with pale roots, fanning back from the crown and down the neck
    const a = (i - 4) / 4, pts = [V(a * 0.22, 0.22 - Math.abs(a) * 0.08, -0.25), V(a * 0.4, 0.3 - Math.abs(a) * 0.15, -0.7), V(a * 0.55, 0.15 - Math.abs(a) * 0.2, -1.15), V(a * 0.6, -0.05 - Math.abs(a) * 0.2, -1.5)];
    const m = tube(pts, 0.035 - Math.abs(a) * 0.008, i % 2 ? red : pale); g.add(m); mane.push(m);
  }
  for (let i = 0; i < 3; i++) { const b = tube([V((i - 1) * 0.06, -0.1, 0.45), V((i - 1) * 0.09, -0.24, 0.2), V((i - 1) * 0.12, -0.32, -0.15), V((i - 1) * 0.14, -0.3, -0.5)], 0.025, pale); jaw.add(b); }   // the beard, flowing back under the jaw
  // whiskers: long, from beside the nose, curling back; they sway
  const whiskers = [-1, 1].map(sg => { const w = new THREE.Group(); w.position.set(sg * 0.13, 0.03, 1.1); g.add(w);
    w.add(tube([V(0, 0, 0), V(sg * 0.25, -0.05, -0.1), V(sg * 0.5, -0.2, -0.45), V(sg * 0.6, -0.45, -0.95), V(sg * 0.5, -0.7, -1.4)], 0.012, pale)); return w; });
  return {
    group: g, jaw,
    sway(t) { whiskers.forEach((w, i) => { w.rotation.set(Math.sin(t * 3 + i) * 0.25, Math.sin(t * 2.3 + i * 2) * 0.2, 0); }); mane.forEach((m, i) => { m.rotation.x = Math.sin(t * 4 + i * 0.7) * 0.06; }); },
  };
}
// a golden dragon [the user's call, 2026-10-30: large, a real dragon]: a scaled body tapering to its tail, drawn through
// the points given each frame (head first), its spine crested with blades; a head with antlers, a mane, glowing eyes,
// whiskers and jaws that open (roar). update(pts) places it; jaw(k) opens the mouth; dispose() takes it away.
function goldDragon(v, R = 0.32) {
  const N = 56, S = 140, RS = 12;
  const mat = new THREE.ShaderMaterial({
    transparent: false, depthWrite: true, toneMapped: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vN, vV;
      void main(){
        vec2 sc = vec2(vUv.x * 150.0, vUv.y * 8.0); sc.y += mod(floor(sc.x), 2.0) * 0.5; vec2 c = fract(sc) - 0.5;
        float scale = 1.0 - smoothstep(0.2, 0.5, length(c * vec2(1.0, 1.4))), edge = smoothstep(0.32, 0.48, length(c * vec2(1.0, 1.4)));
        float belly = smoothstep(0.32, 0.48, abs(vUv.y - 0.5));
        vec3 back = vec3(0.55, 0.32, 0.06), bel = vec3(1.0, 0.86, 0.5), base = mix(back, bel, belly);
        float ridge = belly < 0.5 ? 1.0 : 0.6;
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2), shine = 0.5 + 0.5 * sin(vUv.x * 60.0 - uT * 6.0);
        vec3 col = base * (0.55 + 0.6 * scale) - vec3(0.12, 0.08, 0.02) * edge * ridge + vec3(1.0, 0.8, 0.4) * rim * 1.3 + vec3(1.0, 0.7, 0.25) * shine * 0.12;
        gl_FragColor = vec4(col * 1.25, 1.0); }`,
  });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), mat); body.frustumCulled = false; body.renderOrder = 5;
  // the head, facing +z [the user's call, 2026-10-30: a real dragon's head]: dragonHead below
  const H = dragonHead(), head = H.group, jawPivot = H.jaw; head.scale.setScalar(R / 0.32 * 1.05);   // (wider than the neck behind it)
  // the crest: blades along its spine
  const crest = Array.from({ length: 12 }, (_, i) => swordMesh([1, 0.78, 0.35], 0.5 - i * 0.022));
  const g = new THREE.Group(); g.add(body, head, ...crest); v.timed(g, 1e9, () => {});
  const up = V(0, 1, 0), tmp = V(0, 0, 0);
  return {
    head,
    update(pts, t) {
      mat.uniforms.uT.value = t || 0; H.sway(t || 0);
      const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, S, R, RS, false), P = geo.attributes.position;
      for (let i = 0; i <= S; i++) {   // taper: a neck, the full body, a tail thinning to a point
        const u = i / S, w = u < 0.12 ? 0.62 + u / 0.12 * 0.38 : u < 0.45 ? 1 : Math.max(0.08, 1 - (u - 0.45) / 0.55 * 0.92), c = curve.getPointAt(u);
        for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; tmp.set(P.getX(k), P.getY(k), P.getZ(k)).sub(c).multiplyScalar(w).add(c); P.setXYZ(k, tmp.x, tmp.y, tmp.z); }
      }
      body.geometry.dispose(); body.geometry = geo;
      const h = pts[0], nx = pts[1]; head.position.copy(h); head.lookAt(h.clone().sub(nx).add(h));
      crest.forEach((c2, i) => {
        const u = 0.1 + i * 0.045, p = curve.getPointAt(u), tg = curve.getTangentAt(u), side = tg.clone().cross(up).normalize(), dorsal = side.lengthSq() < 1e-6 ? up.clone() : side.cross(tg).normalize();
        if (dorsal.y < 0) dorsal.negate();
        c2.position.copy(p).addScaledVector(dorsal, R * 0.7); pointAlong(c2, dorsal.clone().addScaledVector(tg, 0.6));
      });
    },
    jaw(k) { jawPivot.rotation.x = 0.55 * k; },
    sway(t) { H.sway(t); },
    dispose() { g.visible = false; body.geometry.dispose(); },
  };
}
// 龍嘯九天: [ROM fx 11] blades whirl up round the target in a dragon's spiral and keep whirling (3.5 s), then pour back
// down onto it, the last on its one sound (5.63 s after the cast begins); over at 6.5 s. Remade as 黃天化's last spell
// [the user's calls, 2026-10-30: next-gen; a large, real dragon]: a great golden dragon, its spine crested with his
// blades, bursts up out of the ground beside the target, coils twice round it and climbs into the sky, rears and roars;
// then it dives: its head strikes the target on the sound and its whole body pours down after it into the earth
async function bladeCyclone(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [1, 0.78, 0.35], F = 5.63, E = 6.5, gold = [1, 0.85, 0.45];
  await intro(ctx, col, { dur: 900, dist: 11, pitch: 0.34 });
  DARK(ctx, 0.55, 0.6, 0.8, 0.95);
  const T0 = ctx.now(), dive = 0.4, D = F - dive - T0, top = at.clone().setY(at.y + 7.5), R0 = 2.3, start = at.clone().add(V(R0, 0, 0));   // (D: the head's climb, to the top of its dive)
  // the head's way: up out of the ground, two coils round the target, up into the sky in a loop, then straight down and on into the earth
  const path = t => {
    if (t <= 0) return start.clone().add(V(0, t * 5, 0));
    if (t < D * 0.55) { const u = t / (D * 0.55), a = u * Math.PI * 4, r = R0 - u * 0.3; return at.clone().add(V(Math.cos(a) * r, u * 3.6, Math.sin(a) * r)); }
    if (t < D) { const u = (t - D * 0.55) / (D * 0.45), a = Math.PI * 4 + u * Math.PI * 1.6, r = (R0 - 0.3) + Math.sin(u * Math.PI) * 1.8; return at.clone().add(V(Math.cos(a) * r, 3.6 + Math.sin(u * Math.PI * 0.5) * 3.9, Math.sin(a) * r)).lerp(top, u * u); }
    const u = (t - D) / dive; return u <= 1 ? top.clone().lerp(at.clone().setY(at.y + 0.5), u * u) : at.clone().setY(at.y + 0.5 - (u - 1) * dive * 14);
  };
  shotAt(ctx, T0 + 0.3, at.clone().add(V(0, 1.6, 0)), { dist: 12, pitch: 0.3, yaw: 0.5, speed: 1.2 });   // round the coils
  shotAt(ctx, T0 + D * 0.55, at.clone().add(V(0, 4.5, 0)), { dist: 14, pitch: 0.22, yaw: -0.3, speed: 1.4 });   // up as it climbs into the sky
  shotAt(ctx, F - 0.55, at.clone().add(V(0, 1.4, 0)), { dist: 11, pitch: 0.6, yaw: 0.2, speed: 2.5 });   // over the top for the dive
  v.light(at.clone().setY(at.y + 2.5), col, 26, F + 1 - T0, 11);
  crack(v, start.clone().add(V(-0.6, 0, -0.5)), start.clone().add(V(0.6, 0, 0.5)), col, 1.4, { open: 0.15, y: effectH(start.x, start.z) }); dustBurst(v, start, 1.2); v.shake(0.2, 0.4);   // where it bursts out
  const dragon = goldDragon(v, 0.34), N = 56, lag = 0.022;   // (its length: N * lag seconds of its own way)
  let roared = false, entered = false;
  v.timed(new THREE.Object3D(), F - T0 + N * lag + 0.2, (k, dt, t) => {
    const pts = []; for (let i = 0; i < N; i++) pts.push(path(t - i * lag));
    dragon.update(pts, t);
    const h = pts[0];
    if (Math.random() < dt * 30) v.spark(h.x + rand(-0.2, 0.2), h.y, h.z + rand(-0.2, 0.2), { vx: rand(-0.5, 0.5), vy: rand(-0.6, 0.3), vz: rand(-0.5, 0.5), life: 0.7, size: rand(0.04, 0.07), r: 1, gg: 0.85, b: 0.45, shape: 0, flicker: 1, ph: rand(0, 9) });   // gold dust off it
    if (t < 0.6 && Math.random() < dt * 20) v.smokePuff(start.x + rand(-0.4, 0.4), start.y + 0.1, start.z + rand(-0.4, 0.4), { vy: rand(0.5, 1.2), life: 1.2, size: 0.4, size1: 1.0, tint: [0.45, 0.4, 0.32] });   // the earth it broke out of
    const roar = t - (D - 0.55); dragon.jaw(roar > 0 && roar < 0.6 ? Math.sin(roar / 0.6 * Math.PI) : t > D ? 0.8 : 0.15);   // it rears and roars, and dives jaws open
    if (!roared && roar > 0.15) { roared = true; v.ring(h, gold, 2.6, 0.6, { vertical: true, yaw: ctx.cam.yaw || 0, y: h.y, intensity: 2 }); v.flash(gold, 0.15); v.shake(0.12, 0.4); }
    if (t > D + dive && Math.random() < dt * 25) { if (!entered) entered = true; v.smokePuff(at.x + rand(-0.3, 0.3), at.y + 0.1, at.z + rand(-0.3, 0.3), { vx: rand(-1.5, 1.5), vy: rand(0.4, 1), vz: rand(-1.5, 1.5), drag: 2, life: 1, size: 0.4, size1: 1.1, tint: [0.5, 0.42, 0.3] }); v.spark(at.x, at.y + 0.2, at.z, { vx: rand(-3, 3), vy: rand(2, 5), vz: rand(-3, 3), g: 10, life: 0.8, size: 0.06, r: 1, gg: 0.8, b: 0.4, shape: 1, floor: at.y + 0.02 }); }   // its body pouring into the earth
  }, () => dragon.dispose());
  await ctx.until(F);
  v.flash([1, 0.9, 0.6], 0.65); v.impact(at, col, 1.9); v.hitstop = 0.16; v.screen.chroma = 0.45;
  v.pillar(at, gold, 0.85, 7, 1.0, { intensity: 1.6, grow: 1 }); v.ring(at, col, 5.5, 0.9, { intensity: 1.5 }); v.ring(at, [1, 1, 1], 2.6, 0.4); dustBurst(v, at, 1.6); glowTargets(ctx, 0.9);
  for (let i = 0; i < 4; i++) { const a2 = i / 4 * 6.28 + 0.4; crack(v, at.clone(), at.clone().add(V(Math.cos(a2) * 2, 0, Math.sin(a2) * 2)), col, 1.8, { open: 0.12, y: at.y }); }
  ctx.hit(); await ctx.until(E + 0.4); outro(ctx);
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
  for (const c of cells) swirl(v, c, wind, 0.25, 0.85, 2.6, 1.5, { speed: 6, twist: 5, sway: true, foam: wind.map(x => x * 0.5 + 0.5), intensity: 0.55, normal: true, ragged: true });
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
  swirl(v, at, wind, 0.4, 1.2, 3.6, L, { speed: 6, twist: 5, sway: true, intensity: 0.6, normal: true, ragged: true });
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
  for (const c of cells) swirl(v, c, wind, 0.3, 0.9, 2.8, 1.3, { speed: 7, twist: 5, sway: true, intensity: 0.5, normal: true, ragged: true });
  v.ring(at, wind, spreadOf(cells) * 2 + 2, 0.7);
  ctx.hit(); await ctx.until(E - 0.2); outro(ctx);
}
// 颶風矢: [ROM fx 15] an arrow flies with the original's first sound (2.13 s after the cast begins); a cyclone lifts the
// target, spins it high and drops it, slamming down on the second (4.23 s); over at 5.3 s. Remade as 黃飛虎's last spell
// [the user's call, 2026-10-30: next-gen]: wind gathers round him and winds onto the arrow; one great arrow flies in a
// corkscrew of wind, rings of air bursting off it; where it strikes a towering cyclone tears up out of the ground,
// stones and dust whirling up it, the target lifted and spun at its heart; on the second sound the cyclone slams down
// and bursts out across the ground
async function hurricane(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), col = [0.55, 0.9, 1], c = ctx.caster.chest(), F = 2.13, E = 5.27;
  await intro(ctx, col, { dur: 600, dist: 10, pitch: 0.4, yaw: -0.5 });
  const cp = ctx.caster.pos.clone();
  shotAt(ctx, ctx.now() + 0.05, cp.clone().lerp(at, 0.3).add(V(0, 0.8, 0)), { dist: 7.5, pitch: 0.3, yaw: yawToward(ctx, cp, at, 1.1), speed: 1.8 });   // over his shoulder for the draw
  shotAt(ctx, F + 0.05, at.clone().add(V(0, 2.6, 0)), { dist: 12, pitch: 0.3, yaw: -0.3, speed: 1.6 });   // up the cyclone
  shotAt(ctx, F + (ctx.track[1] || 2.1) - 0.5, at.clone().add(V(0, 0.7, 0)), { dist: 9, pitch: 0.5, yaw: 0.45, speed: 2.2 });   // down, swung round, for the slam
  // the draw: wind gathers round him and winds in onto the arrow
  const W = Math.max(0.5, F - 0.25 - ctx.now()), winds = [0, 1, 2].map(() => v.ribbon({ col, width: 0.05, n: 18 }));
  ticker(v, W, (k, dt, t) => {
    winds.forEach((r, i) => { const a = t * 9 + i * 2.09, rr = 1.3 * (1 - k) + 0.2; r.push(c.clone().add(V(Math.cos(a) * rr, Math.sin(t * 4 + i) * 0.3 * (1 - k), Math.sin(a) * rr))); });
    if (Math.random() < dt * 30) { const a = rand(0, 6.28), r = rand(1, 1.8); v.spark(c.x + Math.cos(a) * r, c.y + rand(-0.5, 0.8), c.z + Math.sin(a) * r, { vx: -Math.cos(a) * 2.2, vz: -Math.sin(a) * 2.2, life: 0.45, size: 0.04, r: 0.8, gg: 0.95, b: 1, shape: 0 }); }
  }, () => winds.forEach(r => r.end()));
  v.light(c, col, 10, W + 0.3, 5);
  await ctx.until(F - 0.25);
  ctx.pose(null); ctx.caster.act = { kind: 'atk', frame: 2 };
  // the shot: one great arrow in a corkscrew of wind, rings of air bursting off it
  const tg = at.clone().setY(at.y + 0.6), dir = tg.clone().sub(c).normalize(), side = V(-dir.z, 0, dir.x).normalize(), up = side.clone().cross(dir).normalize();
  const g = arrowMesh(col, 1.1), core = v.ribbon({ col: [1, 1, 1], width: 0.05, n: 14 }), helix = [0, 1].map(() => v.ribbon({ col, width: 0.07, n: 26 }));
  v.timed(g, 0.25, k => {
    const p = c.clone().lerp(tg, k); g.position.copy(p); pointAlong(g, dir); core.push(p);
    helix.forEach((r, i) => { const a = k * 26 + i * Math.PI; r.push(p.clone().addScaledVector(side, Math.cos(a) * 0.22).addScaledVector(up, Math.sin(a) * 0.22)); });
    if (Math.random() < 0.5) v.ring(p, col, 0.6, 0.25, { vertical: true, yaw: yawOf(dir), y: p.y, intensity: 1 });
  }, () => { core.end(); helix.forEach(r => r.end()); g.visible = false; });
  await ctx.until(F); ctx.cue(); ctx.caster.act = null;
  v.impact(tg, col, 1.0);
  // the cyclone: towering, stones and dust whirling up it, the target lifted and spun at its heart
  const a = tgts(ctx)[0], S = F + (ctx.track[1] || 2.1), L = S - ctx.now() + 0.25;
  swirl(v, at, [0.2, 0.55, 0.9], 0.55, 1.6, 7, L, { speed: 8, twist: 7, foam: [0.85, 0.95, 1], intensity: 0.8, normal: true, sway: true, ragged: true });
  swirl(v, at, [0.55, 0.85, 1], 0.4, 1.1, 7.5, L, { speed: -9, twist: 3, intensity: 0.4, ragged: true });
  swirl(v, at, [0.85, 0.95, 1], 0.9, 2.2, 2.2, L, { speed: 5, twist: 2, intensity: 0.3, ragged: true });
  const streaks = [0, 1, 2, 3].map(() => v.ribbon({ col: [0.85, 0.97, 1], width: 0.04, n: 20 }));
  ticker(v, L, (k, dt, t) => {
    streaks.forEach((r, i) => { const ang = t * (7 + i) + i * 1.57, rr = 0.7 + i * 0.25, h = ((t * 1.6 + i * 0.25) % 1) * 6; r.push(at.clone().add(V(Math.cos(ang) * rr * (1 + h * 0.12), 0.2 + h, Math.sin(ang) * rr * (1 + h * 0.12)))); });
    if (Math.random() < dt * 50) { const ang = rand(0, 6.28), r = rand(0.5, 1.4); v.spark(at.x + Math.cos(ang) * r, at.y + rand(0.05, 0.6), at.z + Math.sin(ang) * r, { vy: rand(1.5, 3.5), life: rand(1, 1.5), size: rand(0.05, 0.09), r: 0.55, gg: 0.5, b: 0.42, shape: 1, orb: { x: at.x, z: at.z, w: 6 } }); }   // stones
    if (Math.random() < dt * 14) { const ang = rand(0, 6.28), r = rand(0.8, 1.6); v.smokePuff(at.x + Math.cos(ang) * r, at.y + 0.2, at.z + Math.sin(ang) * r, { vy: rand(0.8, 1.6), life: 1.2, size: 0.4, size1: 1.1, tint: [0.5, 0.46, 0.4], orb: { x: at.x, z: at.z, w: 4 } }); }   // dust
  }, () => streaks.forEach(r => r.end()));
  const face0 = a ? a.u.facing : null, drop = S - 0.25 - ctx.now();   // (it falls for 0.25 s: the slam on the second sound)
  if (a) ticker(v, drop + 0.55, (k, dt, t) => { a.lift = t < drop ? ease(Math.min(1, t / 1.2)) * 2.8 : 2.8 * (1 - ((t - drop) / 0.25) ** 2); a.lift = Math.max(0, a.lift); a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 16) % 4]; },
    () => { a.lift = 0; a.u.facing = face0; });
  // the slam: the cyclone comes down with it and bursts out across the ground
  await ctx.until(S);
  v.flash([0.85, 0.95, 1], 0.6); v.shake(0.3, 0.45); v.hitstop = 0.12;
  v.ring(at, col, 5, 0.8, { intensity: 1.6 }); v.ring(at, [1, 1, 1], 2.4, 0.4); dustBurst(v, at, 1.4); crack(v, at.clone().add(V(-0.7, 0, 0.3)), at.clone().add(V(0.7, 0, -0.3)), col, 1.4, { open: 0.1, y: at.y });
  for (let i = 0; i < 24; i++) { const ang = i / 24 * 6.28; v.smokePuff(at.x, at.y + 0.15, at.z, { vx: Math.cos(ang) * 5, vz: Math.sin(ang) * 5, vy: 0.2, drag: 2.5, life: 0.9, size: 0.4, size1: 1.0, tint: [0.75, 0.85, 0.9] }); }   // the gust out along the ground
  glowTargets(ctx, 0.8, 0.5);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}

// ---------------------------------------------------------------- fists (土行孫)
const FIRE = [1, 0.55, 0.2];
// 裂爆拳: [ROM fx 18] he winds up and punches; the blow bursts on the target in a ball of fire
async function burstFist(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), a = ctx.caster, dir = facing(a.pos, at);
  ctx.stand = true;   // (his casting without going under the earth: the user's call)
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
  v.burst(tg, { shape: 6, n: 70, speed: 6, cols: [[1, 0.95, 0.7], FIRE, [1, 0.3, 0.05]], size: 0.07, life: 0.9, g: 5 });
  v.light(tg, FIRE, 30, 0.6, 7); glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.wait(300); a.act = null; await ctx.wait(800); outro(ctx);
}
// 五氣朝元: [ROM fx 19] five orbs of qi gather over him and fly to the cells of the cross, blooming into blue spirit fire,
// the first on the original's first sound (3.5 s after the cast begins), blooming on to 5 s; over at 5.7 s. [The user's
// call] they circle him, shoot up one after another into the sky, and fall out of it like stars, one on each cell
async function fiveQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), col = [0.5, 0.8, 1], F = 3.5, E = 5.67;
  ctx.stand = true;   // (his casting without going under the earth: the user's call)
  await intro(ctx, col, { dur: 600, dist: 11, pitch: 0.45 });
  cueAt(ctx, F);
  const c = ctx.caster.chest(), T0 = ctx.now(), UP = Math.max(T0 + 0.6, F - 1.3);   // (UP: the first shoots up; each falls 0.4 s, the first landing on the sound)
  cells.forEach((cell, i) => {
    const o = orb(v, col, 0.32), go = UP + i * 0.14, land = F + i * 0.12, drop = land - 0.4, tg = cell.clone().setY(cell.y + 0.3), sky = tg.clone().setY(tg.y + 7);
    let rib = null, from = null, done = false;
    v.timed(o, land + 0.1 - T0, () => {
      const T = ctx.now();
      if (T < go) { const a = T * 4 + i / cells.length * 6.28; o.position.copy(c).add(V(Math.cos(a) * 0.8, 1 + Math.sin(T * 5 + i) * 0.15, Math.sin(a) * 0.8)); o.scale.setScalar(Math.min(1, (T - T0) * 3)); from = o.position.clone(); return; }   // round him
      if (T < go + 0.35) { const f = (T - go) / 0.35; o.position.copy(from).add(V(0, f * f * 7, 0)); if (!rib) rib = v.ribbon({ col, width: 0.1, n: 14, fade: 0.35 }); rib.push(o.position); return; }   // up into the sky
      if (T < drop) { o.visible = false; if (rib) { rib.end(); rib = null; } return; }
      o.visible = true; o.scale.setScalar(1.4);
      const f = Math.min(1, (T - drop) / 0.4); o.position.copy(sky).lerp(tg, f * f);   // falling like a star
      if (!rib) rib = v.ribbon({ col, width: 0.18, n: 14, fade: 0.4 }); rib.push(o.position);
      if (f >= 1 && !done) { done = true; o.visible = false; rib.end();
        v.shake(0.06, 0.12); dustBurst(v, cell, 0.3); v.burst(tg, { shape: 5, n: 22, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.6, g: 1 });
        ticker(v, 1.6, kk => { for (let j = 0; j < 2; j++) v.flame(cell.x + rand(-0.3, 0.3), cell.y, cell.z + rand(-0.3, 0.3), { size: rand(0.35, 0.55) * (1 - kk * 0.5), asp: 2, life: 0.5, vy: rand(0.8, 1.6), tint: [0.25, 0.6, 1.8] }); });
        v.pillar(cell, col, 0.35, 2.4, 1.2, { intensity: 0.5, grow: 1 }); v.light(tg, col, 12, 0.6, 5);
      }
    });
  });
  await ctx.until(F + 0.9);
  glowTargets(ctx, 0.8);
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 地裂天崩: [ROM fx 20] he leaps out of sight; with the original's first sound (2.47 s after the cast begins) a flash, the
// land splits open into a black gulf down the screen; on its third (3.93 s) it is gone in a white blaze of fire over
// every cell, wave on wave to 5.4 s, the blow at 5.75 s; over at 6.1 s. Redesigned [the user's calls: then, the ground
// cut open and the enemies squeezed as it closes]: he leaps high and comes down fist first on the sound; the ground
// tears open under the area in gulfs running up the screen (the original's), and the enemies drop into them up to the
// waist, struggling, stones tumbling in; on the third sound the earth slams shut on them, dust blasting out along the
// seams, and they are crushed between its lips; it grinds on them twice more, fire spurting from the seams, and on the
// blow it crushes them a last time and the fire bursts out of every seam, flinging them up out of it
async function quake(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], a = ctx.caster, B = basis(ctx), F = 2.47, E = 6.08, H = 5.6;
  ctx.stand = true;   // (his casting without going under the earth: the user's call)
  await intro(ctx, FIRE, { dur: 600, dist: 12.5, pitch: 0.5 });
  // he leaps high and comes down fist first on the sound
  const up = Math.max(ctx.now(), F - 0.75);
  await ctx.until(up); a.act = { kind: 'atk', frame: 0 };
  ticker(v, F - up, () => { const T = ctx.now(); a.lift = T < F - 0.2 ? 2.6 * Math.sin(Math.min(1, (T - up) / (F - 0.2 - up)) * Math.PI / 2) : 2.6 * Math.max(0, (F - T) / 0.2); if (T > F - 0.2) a.act = { kind: 'atk', frame: 2 }; }, () => { a.lift = 0; });
  await ctx.until(F); ctx.cue(); a.lift = 0;
  dustBurst(v, a.pos, 0.8); v.burst(a.pos.clone().setY(a.pos.y + 0.1), { n: 20, speed: 3, cols: [[1, 0.85, 0.5], FIRE], size: 0.05, life: 0.5, g: 6, up: 0.7 });   // (his fist into the ground)
  v.shake(0.3, 0.5); v.hitstop = 0.08;
  DARK(ctx, 0.8, 0.45, 0.85, 0.95);   // (the sky reddening: red kept most)
  // the gulfs: one down each line of cells running up the screen (along the grid axis nearest the camera's view)
  const ax = Math.abs(B.toCam.x) > Math.abs(B.toCam.z) ? V(1, 0, 0) : V(0, 0, 1), side = V(ax.z, 0, ax.x), lines = new Map();
  for (const c of cells) { const k = Math.round(c.dot(side) * 2); (lines.get(k) || lines.set(k, []).get(k)).push(c); }
  const rifts = [...lines.values()].map(cs => { cs.sort((p, q) => p.dot(ax) - q.dot(ax)); const m = cs[(cs.length - 1) >> 1], lo = m.dot(ax) - cs[0].dot(ax) + 0.5, hi = cs[cs.length - 1].dot(ax) - m.dot(ax) + 0.5;
    const back = levelRun(m, ax.clone().negate(), lo), fwd = levelRun(m, ax, hi); if (back + fwd < 0.4) return null;
    const ch = chasm(v, [m.clone().addScaledVector(ax, -back), m.clone().addScaledVector(ax, fwd)], FIRE, { w: 0.6, y: m.y, life: E + 0.1 - ctx.now(), wander: 0.06, prof: t => Math.min(1, t / 0.12, (1 - t) / 0.12) });
    ch.y = m.y; return ch; }).filter(Boolean);
  const C = F + (ctx.track[2] || 1.46), GRIND = [C + 0.55, C + 1.1];   // (C: the slam shut, on the third sound)
  let open = 0, hot = 0.7, flare = 0;
  ticker(v, E - ctx.now(), (k, dt, t) => { flare *= Math.exp(-dt * 6); for (const ch of rifts) { ch.front = ease(Math.min(1, t / 0.35)); ch.open = open; ch.hot = hot * (1 + flare); } });
  // they open: the enemies drop into them, struggling, stones tumbling in
  const vic = tgts(ctx).map(t => ({ t, ph: rand(0, 6.28) }));
  ticker(v, C - ctx.now(), (k, dt, t) => { open = ease(Math.min(1, t / 0.5)); const T = ctx.now();
    for (const q of vic) { q.t.lift = -0.5 * ease(Math.min(1, Math.max(0, (t - 0.1) / 0.35))) + Math.sin(T * 26 + q.ph) * 0.015; q.t.off.set(Math.sin(T * 19 + q.ph) * 0.02, 0); }
    if (Math.random() < dt * 8) v.shake(0.05, 0.12);
    for (let j = perSec(dt, 14); j > 0 && rifts.length; j--) { const ch = rifts[(Math.random() * rifts.length) | 0], p = ch.at(rand(0.1, 0.9)), r = rockMesh(rand(0.04, 0.08)); const s0 = p.clone().addScaledVector(side, rand(-0.5, 0.5)).setY(ch.y + 0.05);
      lob(v, r, s0, p.clone().setY(ch.y - 0.5), 0.15, 0.4); } });   // (pebbles tumbling over the lips into the dark)
  // the slam: the lips crash together on them; dust blasts out along every seam; they are crushed
  const crush = (amt, len) => ticker(v, len, k => { const e = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75; for (const q of vic) q.t.sqz = amt * e; }, () => { for (const q of vic) q.t.sqz = 0; });
  const seamDust = (n, sp) => { for (const ch of rifts) for (let i = 0; i < n; i++) { const p = ch.at(i / (n - 1)); for (const sg of [-1, 1]) v.smokePuff(p.x, ch.y + 0.08, p.z, { vx: side.x * sg * sp * rand(0.7, 1.2), vz: side.z * sg * sp * rand(0.7, 1.2), vy: rand(0.4, 1.2), drag: 2.6, life: rand(0.7, 1.1), size: 0.22, size1: 0.7, tint: [0.5, 0.42, 0.33] }); } };
  await ctx.until(C);
  ticker(v, 0.1, k => { open = 1 - k * k; }, () => { open = 0; });
  await ctx.until(C + 0.1);
  v.shake(0.4, 0.5); v.hitstop = 0.1; v.screen.chroma = 0.4; hot = 1.6; flare = 1;
  seamDust(6, 2.6);
  for (const q of vic) { q.t.lift = -0.12; q.t.off.set(0, 0); v.burst(q.t.chest(), { n: 10, speed: 2, cols: [[0.55, 0.45, 0.35], FIRE], size: 0.045, life: 0.45, g: 7, up: 0.8, shape: 0 }); }
  crush(0.6, 0.6);   // (no glow here: lit up, they hid the squeeze)
  // it grinds on them: fire spurting from the seams, crushed again
  const spurt = (n, big) => { for (const ch of rifts) for (let i = 0; i < n; i++) { const p = ch.at(rand(0.05, 0.95));
    ticker(v, big ? 0.6 : 0.35, (k, dt) => { for (let j = perSec(dt, big ? 40 : 22); j > 0; j--) v.realFire(p.x + rand(-0.12, 0.12), ch.y, p.z + rand(-0.12, 0.12), { size: rand(0.35, 0.6) * (big ? 1.4 : 1), asp: rand(1.6, 2.2), life: rand(0.35, 0.55), vy: rand(2.5, 4.5) * (big ? 1.4 : 1) }); }); } };
  for (const g of GRIND) { await ctx.until(g); v.shake(0.18, 0.3); flare = 1.2; crush(0.4, 0.4); seamDust(3, 1.4); spurt(2, false); v.light(c0.clone().setY(c0.y + 0.4), FIRE, 10, 0.3, 6); }
  // the blow: a last crush, and the fire bursts out of every seam, flinging them up out of it
  await ctx.until(H);
  v.shake(0.36, 0.5); v.hitstop = 0.1; flare = 2; crush(0.6, 0.35); spurt(3, true); seamDust(5, 2.2);
  for (const ch of rifts) for (let i = 0; i < 3; i++) { const p = ch.at(rand(0.1, 0.9)), r = rockMesh(rand(0.06, 0.12)), d = side.clone().multiplyScalar(rand(-1.4, 1.4)); lob(v, r, p.clone().setY(ch.y + 0.1), p.clone().add(d).setY(ch.y), rand(1, 1.8), rand(0.5, 0.8), q => dustBurst(v, q, 0.2)); }
  v.light(c0.clone().setY(c0.y + 0.5), FIRE, 24, 0.4, 8);
  ticker(v, 0.4, k => { for (const q of vic) q.t.lift = -0.12 + Math.sin(k * Math.PI) * 0.45 + 0.12 * k; }, () => { for (const q of vic) { q.t.lift = 0; q.t.off.set(0, 0); } });
  glowTargets(ctx, 0.9); ctx.hit();
  ticker(v, E - H - 0.1, k => { hot = 1.6 * (1 - k); for (const ch of rifts) ch.a = 1 - Math.max(0, (k - 0.5) / 0.5); });
  await ctx.until(H + 0.25); v.screen.darkTarget = 0;
  await ctx.until(E - 0.1); a.act = null; for (const q of vic) { q.t.lift = 0; q.t.sqz = 0; q.t.off.set(0, 0); } outro(ctx);
}
// 昇龍拳: [ROM fx 21] he leaps; a dragon of fire bursts up out of the ground under the target and climbs to the sky,
// then falls back on it as a fireball, striking on the original's one sound (3.12 s after the cast begins); over at 5 s.
// Remade as 土行孫's last spell [the user's calls, 2026-10-30: next-gen; he goes up with it and comes down on the ground]:
// fire gathers round him while the ground under the target splits with glowing cracks and trembles; a dragon of fire
// tears up out of it round a column of flame and he leaps into it, uppercutting the target, the two carried up spinning;
// at the top he turns and dives back down wrapped in a great fireball and drives his fist into the ground beside it: a
// crater of fire; then he hops back to his cell
async function risingDragon(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), a = ctx.caster, F = 3.12, E = 4.98, P0 = a.pos.clone();
  await intro(ctx, FIRE, { dur: 600, dist: 10, pitch: 0.32 });
  ctx.pose(null); a.act = { kind: 'atk', frame: 0 };
  // the gathering: fire round him; under the target the ground splits and trembles
  const up = Math.max(0.6, 1.5 - ctx.now());
  shotAt(ctx, ctx.now() + 0.05, P0.clone().lerp(at, 0.6).add(V(0, 0.5, 0)), { dist: 9, pitch: 0.35, yaw: -0.4, speed: 1.6 });   // low on the cracking ground, him in frame
  ticker(v, up + 0.3, (k, dt) => { if (Math.random() < dt * 30) { const ang = rand(0, 6.28); v.realFire(P0.x + Math.cos(ang) * 0.35, P0.y, P0.z + Math.sin(ang) * 0.35, { size: rand(0.3, 0.5), asp: 2, life: 0.4, vy: rand(1.5, 2.5) }); } });
  for (let i = 0; i < 5; i++) { const ang = i / 5 * 6.28 + rand(-0.3, 0.3); crack(v, at.clone(), at.clone().add(V(Math.cos(ang) * 1.8, 0, Math.sin(ang) * 1.8)), FIRE, E - ctx.now(), { open: 0.12, y: at.y }); }
  ticker(v, up, (k, dt) => { v.shake(0.03 + k * 0.1, 0.1); if (Math.random() < dt * 40) { const ang = rand(0, 6.28), r = rand(0.2, 1.6); v.spark(at.x + Math.cos(ang) * r, at.y + 0.05, at.z + Math.sin(ang) * r, { vy: rand(0.8, 2), life: 0.7, size: 0.05, r: 1, gg: 0.55, b: 0.15, shape: 0, flicker: 1, ph: rand(0, 9) }); } });
  v.decal(at, [1, 0.35, 0.06], 1.6, E - ctx.now(), { flicker: true, in: 1 });
  await ctx.wait(up * 1000);
  // the dragon tears up round a column of flame; he leaps into it under the target and they are carried up spinning
  const climb = Math.max(0.8, F - 0.45 - ctx.now()), tg = tgts(ctx)[0], face0 = tg ? tg.u.facing : null, myFace = a.u.facing, TOP = 4.2;
  const d = new THREE.Vector2(at.x - P0.x, at.z - P0.z), len = d.length() || 1, beside = d.clone().multiplyScalar(Math.max(0, 1 - 0.42 / len));   // (his offset: beside the target, on his own side)
  shotAt(ctx, ctx.now() + 0.15, at.clone().add(V(0, 3.2, 0)), { dist: 11.5, pitch: 0.18, yaw: 0.35, speed: 1.8 });   // looking up as they rise
  v.flash([1, 0.6, 0.25], 0.3); v.shake(0.25, 0.4); v.explode(at.clone().setY(at.y + 0.2), 0.6, { n: 14, tint: [1, 0.7, 0.4] });
  v.pillar(at, [1, 0.42, 0.08], 0.55, 9, climb + 0.2, { intensity: 1.6, grow: 1 });
  const rib = v.ribbon({ col: [1, 0.42, 0.08], width: 0.7, n: 40, fade: 0.5 }), core = v.ribbon({ col: [1, 0.9, 0.6], width: 0.18, n: 30 });
  const head = v.fireball(0.45, { heat: 1.2 });
  v.timed(head, climb, (k, dt, t) => { head.userData.mat.uniforms.uT.value = t; const ang = t * 9, r = 0.9 * (1 - k * 0.3), p = at.clone().add(V(Math.cos(ang) * r, 0.3 + ease(k) * 8.5, Math.sin(ang) * r)); head.position.copy(p); rib.push(p); core.push(p); v.light(p, FIRE, 25, 0.06, 8); }, () => { rib.end(); core.end(); head.visible = false; });
  for (let i = 0; i < 30; i++) v.spark(at.x + rand(-0.5, 0.5), at.y + 0.2, at.z + rand(-0.5, 0.5), { vx: rand(-2, 2), vy: rand(5, 9), vz: rand(-2, 2), g: 9, life: rand(1, 1.6), size: rand(0.06, 0.12), r: 0.4, gg: 0.32, b: 0.26, shape: 1, floor: at.y + 0.02 });   // rocks
  ticker(v, climb, (k, dt, t) => {   // him: a leap across to the target (0.3 s), then up the column with it, spinning, fire round him
    const j = Math.min(1, t / 0.3); a.off.copy(beside).multiplyScalar(ease(j));
    a.lift = j < 1 ? Math.sin(j * Math.PI / 2) * 0.8 : 0.8 + (TOP - 0.8) * ease(Math.min(1, (t - 0.3) / Math.max(0.3, climb - 0.3)));
    a.act = { kind: 'atk', frame: j < 1 ? 1 : 2 }; if (j >= 1) a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 12) % 4];
    const c = a.chest(); if (Math.random() < dt * 40) v.realFire(c.x + rand(-0.15, 0.15), c.y - 0.3, c.z + rand(-0.15, 0.15), { size: rand(0.35, 0.55), asp: 1.8, life: 0.3, vy: -1 });
  });
  if (tg) ticker(v, climb + 0.45, (k, dt, t) => { tg.lift = t < climb ? ease(Math.min(1, t / 0.6)) * (TOP - 0.6) : (TOP - 0.6) * Math.max(0, 1 - ((t - climb) / 0.42) ** 2); tg.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 14) % 4]; }, () => { tg.lift = 0; tg.u.facing = face0; });
  glowTargets(ctx, 0.7, climb);
  // he dives back down wrapped in a great fireball
  await ctx.until(F - 0.45);
  shotAt(ctx, ctx.now(), at.clone().add(V(0, 0.8, 0)), { dist: 10.5, pitch: 0.55, yaw: 0, speed: 2.4 });   // high for the dive
  a.u.facing = 'down'; a.act = { kind: 'atk', frame: 2 };
  const ball = v.fireball(0.85, { heat: 1.4 }), tail = v.ribbon({ col: FIRE, width: 0.8, n: 20 });
  v.timed(ball, 0.45, (k, dt, t) => { a.lift = TOP * (1 - k * k); const p = a.chest(); ball.userData.mat.uniforms.uT.value = t; ball.position.copy(p).add(V(0, 0.25, 0)); ball.scale.setScalar(0.7 + 0.3 * k); tail.push(ball.position); v.realFire(p.x, p.y, p.z, { size: 1, asp: 1.5, life: 0.25, vy: 1 }); }, () => { tail.end(); ball.visible = false; a.lift = 0; });
  await ctx.until(F);
  // the blow: his fist into the ground, a crater of fire
  const hit = at.clone().setY(at.y + 0.3); a.lift = 0; a.act = { kind: 'atk', frame: 2 };
  v.explode(hit, 1.2, { n: 32 }); v.flash([1, 0.7, 0.4], 0.6); v.shake(0.4, 0.55); v.hitstop = 0.16; v.screen.chroma = 0.4;
  v.ring(at, FIRE, 5, 0.9, { intensity: 1.6 }); v.ring(at, [1, 1, 1], 2.2, 0.4); dustBurst(v, at, 1.5, [0.4, 0.3, 0.25]);
  for (let i = 0; i < 6; i++) { const ang = i / 6 * 6.28, p = at.clone().add(V(Math.cos(ang) * 1.3, 0, Math.sin(ang) * 1.3)); p.y = effectH(p.x, p.z); later(i * 40, () => { v.pillar(p, [1, 0.42, 0.08], 0.25, 2.4, 0.6, { intensity: 1.4, grow: 1 }); }); }
  ticker(v, 1.2, k => { for (let i = 0; i < 3; i++) v.realFire(at.x + rand(-0.6, 0.6), at.y, at.z + rand(-0.6, 0.6), { size: rand(0.6, 1.0) * (1 - k * 0.6), asp: rand(1.3, 1.7), life: rand(0.4, 0.6), vy: rand(1.5, 3) }); });   // the crater burning
  ctx.hit();
  // a beat crouched in the fire, then a hop back to his cell
  await ctx.wait(500);
  const from = a.off.clone();
  await new Promise(res => ticker(v, 0.35, k => { a.off.copy(from).multiplyScalar(1 - ease(k)); a.lift = Math.sin(k * Math.PI) * 0.7; a.act = { kind: 'atk', frame: 1 }; }, () => { a.off.set(0, 0); a.lift = 0; a.act = null; a.u.facing = myFace; res(); }));
  await ctx.until(E + 0.3); outro(ctx);
}

// ---------------------------------------------------------------- fire
// 煉獄之火: [ROM fx 24] with the original's first sound (2 s after the cast begins) the whole area becomes a sea of fire,
// rows of fireballs bursting across it in waves, a second roar (4.7 s) until 6.2 s; over at 7 s. Remade [the user's call,
// 2026-10-30: look better, the camera as it was]: the ground splits from the middle of the area and molten rock floods
// out of the cracks over every cell, churning, flames dancing over it; waves of lava bombs heave out of it in rows and
// crash back down bursting; on the second roar every cell erupts in a column of fire; then the sea cools to a black
// crust veined with fire and sinks away
// the molten sea: a quad per cell at its own level, one churning pattern in world space so the cells run together;
// u.R the flood's reach from the middle, u.cool its crust (0 molten, 1 black rock veined red), u.a its fade
function lavaSea(v, cells, c0, life) {
  const u = { uT: { value: 0 }, uR: { value: 0 }, uCool: { value: 0 }, uA: { value: 1 }, uC: { value: new THREE.Vector2(c0.x, c0.z) } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec3 vW; varying vec2 vL; void main(){ vL = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uR, uCool, uA; uniform vec2 uC; varying vec3 vW; varying vec2 vL; ${NOISE}
      void main(){
        vec2 p = vW.xz; float t = uT;
        float edge = fbm(p * 1.7 + 3.0), d = length(p - uC) + (edge - 0.5) * 0.9;
        float reach = 1.0 - smoothstep(uR - 0.35, uR, d), own = 1.0 - smoothstep(0.55, 0.8, mix(max(abs(vL.x), abs(vL.y)), length(vL), 0.55) + (fbm(p * 2.6 + 9.0) - 0.5) * 0.45);   // (rounded, ragged: no square per cell)
        float m = reach * own; if (m < 0.01) discard;
        // the churn: two warps moving against each other, the bands folding over
        vec2 q = vec2(fbm(p * 0.9 + vec2(0.0, t * 0.35)), fbm(p * 0.9 + vec2(5.2, -t * 0.3)));
        vec2 w = p + (q - 0.5) * 1.6;
        float band = 0.5 + 0.5 * sin(w.y * 5.0 + w.x * 2.0 + fbm(w * 1.6) * 6.0 - t * 2.2), heat = fbm(w * 2.4 + vec2(t * 0.4, 0.0));
        vec3 col = mix(vec3(0.3, 0.015, 0.0), vec3(0.8, 0.09, 0.01), smoothstep(0.15, 0.8, band));                // deep red to red
        col = mix(col, vec3(1.0, 0.36, 0.03), smoothstep(0.78, 1.0, band) * 0.7);                                   // orange on the crests
        col = mix(col, vec3(1.0, 0.68, 0.2), smoothstep(0.6, 0.75, heat) * 0.55);                                   // yellow where hottest
        // skins of half-cooled rock drifting on it, near black, the melt glowing in the gaps between them
        float sk = fbm(w * 2.2 + vec2(t * 0.15, -t * 0.1)), skin = smoothstep(0.52, 0.6, sk) * (1.0 - smoothstep(0.62, 0.8, heat));
        col = mix(col, vec3(0.12, 0.025, 0.01) + vec3(0.5, 0.06, 0.0) * smoothstep(0.75, 0.6, sk), skin * 0.85);
        col += vec3(1.0, 0.45, 0.06) * smoothstep(0.08, 0.0, abs(sk - 0.52)) * 0.45;                              // the gaps' rims hottest
        col += vec3(1.0, 0.5, 0.1) * smoothstep(uR - 0.6, uR - 0.1, d) * reach * 0.5;                              // the flood's front glowing hot
        // cooling: a black crust closing over it, the fire left in its seams
        float cell = fbm(p * 3.2), seam = 1.0 - smoothstep(0.0, 0.05 + 0.04 * (1.0 - uCool), abs(cell - 0.5));
        float crust = smoothstep(0.0, 1.0, uCool * 1.6 - heat * 0.6);
        col = mix(col, vec3(0.07, 0.035, 0.03) + vec3(1.0, 0.3, 0.05) * seam * (1.0 - uCool * 0.6), crust);
        gl_FragColor = vec4(min(col, vec3(1.0)) * 0.8, m * uA * (0.85 + 0.15 * (1.0 - crust)));
      }` });
  const g = new THREE.Group();
  for (const c of cells) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), mat); q.position.set(c.x, c.y + 0.035, c.z); q.renderOrder = 2; g.add(q); }   // (on each quad: a group's own renderOrder sorts all of it after every loose effect, and it painted over the flames)
  v.timed(g, life, (k, dt, t) => { u.uT.value = t; });
  return u;
}
// a lava bomb: a gobbet of fire heaved from a up through h to b, trailing fire, bursting where it lands
function lavaBomb(v, a, b, h, life) {
  const ball = v.fireball(rand(0.13, 0.2), { heat: 1.1 }), tail = v.ribbon({ col: FIRE, width: 0.22, n: 12 }), up = Math.max(a.y, b.y) + h;
  v.burst(a.clone().setY(a.y + 0.1), { n: 8, speed: 2.4, cols: [[1, 0.85, 0.4], FIRE], size: 0.06, life: 0.5, g: 9, shape: 6, floor: a.y + 0.02 });   // the splash it leaves
  v.timed(ball, life, (k, dt, t) => {
    ball.userData.mat.uniforms.uT.value = t; ball.position.copy(a).lerp(b, k); ball.position.y = a.y + (b.y - a.y) * k + 4 * (up - Math.max(a.y, b.y)) * k * (1 - k) + 0.1;
    tail.push(ball.position); if (Math.random() < 0.5) v.realFire(ball.position.x, ball.position.y, ball.position.z, { size: 0.35, asp: 1.3, life: 0.2, vy: 0.4 });
  }, () => {
    tail.end(); ball.visible = false; const p = b.clone().setY(b.y + 0.15);
    v.explode(p, 0.38, { n: 6, smoke: false }); v.light(p, FIRE, 7, 0.22, 4);
    v.burst(p, { n: 12, speed: 3, cols: [[1, 0.9, 0.5], FIRE], size: 0.05, life: 0.6, g: 9, shape: 6, floor: b.y + 0.02 });
  });
}
const perSec = (dt, rate) => { const n = dt * rate; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };   // how many to spawn this frame for rate a second (any frame rate)
async function inferno(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), F = 2.0, F2 = 4.7, E = 6.98, R = spreadOf(cells) + 1.2;
  await intro(ctx, FIRE, { dur: 800, dist: 13, pitch: 0.48 });
  await channel(ctx, FIRE, F); ctx.cue();
  DARK(ctx, 0.75, 0.25, 0.75, 0.85);   // the light goes red
  v.screen.heatTarget = 1;   // and the whole picture burns and ripples, as the original's [the user's call: the screen twisted as if burning]
  const L = E - 0.1 - ctx.now(), lava = lavaSea(v, cells, c0, L);
  // the ground splits from the middle, then the flood pours out of it
  v.flash([1, 0.4, 0.15], 0.12); v.shake(0.18, 0.4);   // (no pale ring or white flash: they washed the ground out)
  for (let i = 0; i < 7; i++) { const ang = i / 7 * 6.28 + rand(-0.25, 0.25), r = (R - 0.6) * rand(0.6, 0.85); crack(v, c0, c0.clone().add(V(Math.cos(ang) * r, 0, Math.sin(ang) * r)), [1, 0.45, 0.08], 0.75, { open: 0.2, y: c0.y, width: 0.08 }); }   // (inside the flood: it pours out of them)
  later(150, () => ticker(v, 0.75, k => { lava.uR.value = 0.2 + ease(k) * (R + 0.6); }));
  v.light(c0.clone().setY(c0.y + 1.2), FIRE, 26, L, 12);
  // flames dancing over the sea, embers rising off it, heaviest while it is molten
  const FL = 6.2 - ctx.now();
  ticker(v, FL, (k, dt) => {
    const fade = k < 0.85 ? Math.min(1, k * 6) : (1 - k) / 0.15;
    for (let i = perSec(dt, cells.length * 5 * fade); i > 0; i--) { const c = cells[(Math.random() * cells.length) | 0]; v.realFire(c.x + rand(-0.55, 0.55), c.y, c.z + rand(-0.55, 0.55), { size: rand(0.45, 0.85), asp: rand(1.6, 2.3), life: rand(0.35, 0.6), vy: rand(0.6, 1.2) }); }
    if (Math.random() < dt * 40 * fade) { const c = cells[(Math.random() * cells.length) | 0]; v.spark(c.x + rand(-0.7, 0.7), c.y + 0.1, c.z + rand(-0.7, 0.7), { vy: rand(1.2, 2.6), vx: rand(-0.3, 0.3), vz: rand(-0.3, 0.3), g: -0.4, life: rand(0.9, 1.5), size: rand(0.035, 0.06), r: 1, gg: rand(0.45, 0.8), b: 0.15, shape: 0, flicker: 1, ph: rand(0, 9) }); }
  });
  // waves of lava bombs heaving out of the sea in rows, each row sweeping across it from another side
  await ctx.wait(350);
  const sweep = [V(1, 0, 1), V(-1, 0, 1), V(1, 0, -1), V(-1, 0, -1), V(1, 0, 0)];
  for (let w = 0; ctx.now() < F2 - 0.45; w++) {
    const dir = sweep[w % sweep.length], order = cells.slice().sort((a, b) => a.dot(dir) - b.dot(dir));
    order.forEach((c, i) => later(i * 45, () => {
      for (let j = Math.random() < 0.35 ? 1 : 0; j > 0; j--) {   // (a few: the burning screen carries it, not the bombs)
        const a = c.clone().add(V(rand(-0.45, 0.45), 0, rand(-0.45, 0.45))), b = cells[(Math.random() * cells.length) | 0].clone().add(V(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)));
        if (b.distanceTo(a) > 1.8) b.copy(a).add(V(rand(-0.9, 0.9), 0, rand(-0.9, 0.9))).setY(c.y);
        lavaBomb(v, a, b, rand(1.1, 2.0), rand(0.55, 0.75));
      }
      v.explode(c.clone().setY(c.y + 0.25), 0.35, { n: 4, smoke: false }); v.light(c, FIRE, 6, 0.2, 3);
    }));
    v.shake(0.08, 0.25);
    await ctx.wait(Math.max(order.length * 45 + 300, 650));
  }
  // the second roar: every cell erupts in a column of fire
  await ctx.until(F2);
  v.flash([1, 0.45, 0.15], 0.12); v.shake(0.3, 0.5); v.hitstop = 0.08; glowTargets(ctx, 1, 0.9);   // (no white-out: the columns are the blow)
  cells.forEach((c, i) => later(i * 25, () => {
    ticker(v, 0.8, (k, dt) => { for (let j = perSec(dt, 22); j > 0; j--) { const a = rand(0, 6.28), r = rand(0, 0.38); v.realFire(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r, { size: rand(0.4, 0.7) * (1 - k * 0.5), asp: rand(1.4, 1.9), life: rand(0.45, 0.7), vy: rand(3.5, 5.5), vx: Math.cos(a) * 0.4, vz: Math.sin(a) * 0.4 }); } });   // (many small flames, spread: big tall ones stood as slabs)
    v.burst(c.clone().setY(c.y + 0.2), { n: 16, speed: 3.6, cols: [[1, 0.9, 0.5], FIRE], size: 0.06, life: 0.8, g: 8, shape: 6, floor: c.y + 0.02 });
  }));
  ctx.hit();
  // then it cools: a black crust closes over the sea, wisps of smoke off it, and it sinks away
  await ctx.until(5.5);
  ticker(v, 0.9, k => { lava.uCool.value = ease(k); }); later(500, () => { v.screen.heatTarget = 0; });
  for (const c of cells) for (let j = 0; j < 2; j++) later(rand(0, 500), () => v.smokePuff(c.x + rand(-0.5, 0.5), c.y + 0.2, c.z + rand(-0.5, 0.5), { vy: rand(0.4, 0.8), life: rand(1.0, 1.4), size: 0.5, size1: 1.3, tint: [0.1, 0.08, 0.07] }));
  await ctx.until(6.3);
  ticker(v, E - 0.15 - ctx.now(), k => { lava.uA.value = 1 - k; });
  await ctx.until(E - 0.2); v.screen.heatTarget = 0; outro(ctx);
}
// 天火燎原: [ROM fx 25] night falls; a flame drops from the sky onto the target with the original's first sound (1.65 s
// after the cast begins), a white-out, fire over the plain; a second roar (2.73 s); over at 5.6 s. Remade as a hero's
// last spell [the user's call, 2026-10-30: next-gen]: night falls and the sky over the target smoulders red; a meteor
// breaks out of it, shedding burning fragments, and strikes on the first sound: a white-out, a dome of fire, a ring of
// flame racing out over the plain, the ground left burning; on the second the earth erupts in geysers of fire round the
// target; embers rain to the end
async function skyFire(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), F = 1.65, F2 = 2.73, E = 5.6, B = basis(ctx);
  cueAt(ctx, F);
  await intro(ctx, FIRE, { dur: 800, dist: 12, pitch: 0.42 });
  DARK(ctx, 0.8, 0.95, 0.85, 0.6);
  // the sky smoulders: a low cloud over the target, lit red from inside
  const sky = at.clone().setY(at.y + 5.2), L = E - ctx.now();
  for (let i = 0; i < 26; i++) v.smokePuff(sky.x + rand(-3.5, 3.5), sky.y + rand(-0.4, 0.8), sky.z + rand(-3.5, 3.5) - 1.5, { vx: rand(-0.2, 0.2), life: L, size: 2.0, size1: 3.0, tint: [0.32, 0.08, 0.04] });
  const glow = glowCard(v, [1, 0.35, 0.08], 9); glow.position.copy(sky);
  v.timed(glow, L, (k, dt, t) => { glow.material.opacity = Math.min(1, t / 0.5) * (0.35 + 0.15 * Math.sin(t * 9)) * (1 - k); });
  v.light(sky.clone().setY(sky.y - 2), [1, 0.35, 0.1], 18, L, 14);
  // the meteor: out of the cloud, slanting in from behind the target, burning fragments peeling off it
  const fall = 0.8, from = sky.clone().addScaledVector(B.toCam, -2).addScaledVector(B.right, 2.2), tg = at.clone().setY(at.y + 0.3);
  shotAt(ctx, F - 1.3, at.clone().add(V(0, 2.4, 0)), { dist: 13, pitch: 0.34, yaw: -0.45, speed: 2.2 });   // up into the burning sky as the meteor comes (the play view's frame stops 3 above the target), swung round
  shotAt(ctx, F2 - 0.15, at.clone().add(V(0, 0.9, 0)), { dist: 9.5, pitch: 0.38, yaw: 0.15, speed: 1.2 });   // in low for the geysers
  await ctx.until(F - fall);
  const ball = v.fireball(0.6, { heat: 1.4 }), tail = v.ribbon({ col: FIRE, width: 0.6, n: 26 }), core = v.ribbon({ col: [1, 0.9, 0.6], width: 0.18, n: 18 });
  v.timed(ball, fall, (k, dt, t) => {
    ball.userData.mat.uniforms.uT.value = t; ball.position.copy(from).lerp(tg, k * k); tail.push(ball.position); core.push(ball.position);
    const p = ball.position; v.realFire(p.x, p.y, p.z, { size: 0.9, asp: 1.5, life: 0.3, vy: 1 }); v.light(p, FIRE, 10 + 30 * k, 0.06, 10);
    if (Math.random() < dt * 40) v.spark(p.x, p.y, p.z, { vx: rand(-2, 2), vy: rand(-0.5, 2), vz: rand(-2, 2), g: 5, life: rand(0.5, 0.9), size: rand(0.06, 0.11), r: 1, gg: rand(0.45, 0.75), b: 0.2, shape: 0, flicker: 1, ph: rand(0, 9) });
  }, () => { tail.end(); core.end(); ball.visible = false; });
  await ctx.until(F);
  // the strike: a white-out, a dome of fire, the fire running out over the plain
  v.flash([1, 0.95, 0.85], 0.85); v.shake(0.35, 0.5); v.hitstop = 0.14; v.screen.chroma = 0.5;
  later(250, () => ctx.cam.shot(at.clone().add(V(0, 0.6, 0)), { cine: true, dist: 11, pitch: 0.5, yaw: 0.4, speed: 1.4 }));   // back down over the burning plain, sweeping across it
  v.explode(tg, 1.1, { n: 30, tint: [1, 0.7, 0.4] }); glowTargets(ctx, 1, 0.8);
  v.pillar(at, [1, 0.38, 0.06], 0.9, 6, 1.3, { intensity: 1.6, grow: 1 }); v.ring(at, [1, 0.6, 0.2], 6, 1.0, { intensity: 1.6 }); v.ring(at, [1, 1, 1], 2.8, 0.45);
  v.decal(at, [1, 0.3, 0.05], 2.6, E - F, { flicker: true, intensity: 0.8 });
  ticker(v, 1.4, k => {
    const r = 0.6 + ease(k) * 3.4;
    for (let i = 0; i < 7; i++) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r, z = at.z + Math.sin(ang) * r; v.realFire(x, effectH(x, z) - 0.05, z, { size: rand(0.6, 1.0) * (1 - k * 0.3), asp: 1.6, life: rand(0.4, 0.7), vy: 0.5 }); }
    if (Math.random() < 0.35) { const ang = rand(0, 6.28), x = at.x + Math.cos(ang) * r * 0.8, z = at.z + Math.sin(ang) * r * 0.8; v.decal(V(x, 0, z), [1, 0.3, 0.05], 0.5, 2.2, { flicker: true, intensity: 0.7 }); }
  });
  ticker(v, E - F - 0.3, (k, dt) => { if (Math.random() < dt * 9) { const a = rand(0, 6.28), r = rand(0.6, 3.2), x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r; v.realFire(x, effectH(x, z) - 0.05, z, { size: rand(0.35, 0.6), asp: 1.6, life: rand(0.5, 0.8), vy: 0.4 }); } });   // the plain burning on to the end
  ticker(v, E - F - 0.2, (k, dt) => { if (Math.random() < dt * 60) v.spark(at.x + rand(-3.5, 3.5), at.y + rand(3.5, 6), at.z + rand(-3.5, 3.5), { vy: -rand(1.5, 3), vx: rand(-0.4, 0.4), g: 1.5, life: 1.6, size: rand(0.04, 0.08), r: 1, gg: rand(0.45, 0.8), b: 0.2, shape: 0, flicker: 1, ph: rand(0, 9), floor: at.y + 0.04 }); });   // embers raining
  // the second roar: the earth erupts in geysers of fire round the target
  await ctx.until(F2);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.28 + rand(-0.2, 0.2), r = rand(1.2, 2.4), p = at.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = effectH(p.x, p.z);
    later(i * 60, () => {
      v.pillar(p, [1, 0.42, 0.08], 0.32, rand(2.5, 3.8), 0.8, { intensity: 1.5, grow: 1 });
      ticker(v, 0.6, k => { v.realFire(p.x + rand(-0.15, 0.15), p.y, p.z + rand(-0.15, 0.15), { size: rand(0.6, 0.9) * (1 - k * 0.5), asp: 2.4, life: 0.5, vy: rand(3, 5) }); });
      v.burst(p.clone().setY(p.y + 0.2), { n: 14, speed: 3, cols: [[1, 0.9, 0.5], FIRE], size: 0.06, life: 0.7, g: 8, shape: 6, floor: p.y + 0.02 });
    });
  }
  v.shake(0.2, 0.4); v.flash([1, 0.5, 0.2], 0.3); v.hitstop = 0.06;
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
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
  for (let i = 0; i < 40 + G * 20; i++) later(i * 15, () => { const p = hub.clone().add(V(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))); v.spark(p.x, p.y, p.z, { seek: { x: hub.x, y: hub.y, z: hub.z, k: 5 }, life: 0.6, size: rand(0.06, 0.12), r: 0.85, gg: 0.95, b: 1, shape: 7, flicker: 1, ph: rand(0, 9) }); });
  const big = new THREE.Mesh(chunkGeometry(), mat); big.position.copy(hub); big.scale.setScalar(0.01);
  v.timed(big, G, (k, dt, t) => { big.scale.setScalar(0.01 + 0.5 * ease(Math.min(1, t / 0.7))); big.rotation.y += dt * 2; big.rotation.x += dt; big.position.y = hub.y + Math.sin(t * 2.5) * 0.12; });
  await ctx.until(S);
  v.flash([0.8, 0.95, 1], 0.12); v.burst(hub, { shape: 7, n: 30, speed: 3, cols: ICE_COLS, size: 0.06, life: 0.6, g: 0 });
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
    for (let i = 0; i < 14; i++) v.spark(c0.x + rand(-6, 6) - wind.x * 0.4, c0.y + rand(0.2, 5), c0.z + rand(-6, 6) - wind.z * 0.4, { vx: wind.x * rand(0.8, 1.3), vy: -rand(0.8, 1.6), vz: wind.z * rand(0.8, 1.3) + rand(-0.5, 0.5), life: rand(0.8, 1.4), size: rand(0.05, 0.11), r: 0.92, gg: 0.96, b: 1, a: 0.9, shape: 7, wob: 1.5, ph: rand(0, 6) });
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
// sound (2.32 s after the cast begins) to 5 s, then a huge block of ice closes over it (5.2 s) and shatters (5.7 s); over
// at 6.9 s. Remade as 姜子牙's and 小龍女's last spell [the user's call, 2026-10-30: next-gen]: night; frost creeps over
// the ground and snow fills the air; ice flies in from all round and fuses into a glacier hanging over the target,
// cracks of light running through it; it calves, boulder after boulder crashing onto the target, ice spikes bursting
// from the ground after each; what is left of it closes over the target as one great crystal, and everything shatters
async function iceAvalanche(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), mat = ICE(), F = 2.32, E = 6.93, hang = at.clone().setY(at.y + 4.2);
  await intro(ctx, ICEC, { dur: 800, dist: 10.5, pitch: 0.38 });
  DARK(ctx, 0.7, 1, 0.72, 0.38);
  shotAt(ctx, ctx.now() + 0.05, at.clone().add(V(0, 2.2, 0)), { dist: 11, pitch: 0.25, yaw: 0.5, speed: 1.3 });   // up at the glacier forming
  shotAt(ctx, F + 0.3, at.clone().add(V(0, 1, 0)), { dist: 10, pitch: 0.45, yaw: -0.35, speed: 0.7 });   // a slow sweep through the avalanche
  shotAt(ctx, F + 2.7, at.clone().add(V(0, 0.8, 0)), { dist: 8, pitch: 0.35, yaw: 0.25, speed: 1.8 });   // close for the crystal
  frost(v, at, 2.4, E - ctx.now());
  ticker(v, E - ctx.now(), (k, dt) => { if (Math.random() < dt * 40) v.spark(at.x + rand(-3, 3), at.y + rand(3, 5), at.z + rand(-3, 3), { vy: -rand(0.5, 1), vx: rand(-0.3, 0.3), life: 3, size: rand(0.03, 0.05), r: 0.9, gg: 0.96, b: 1, shape: 0, floor: at.y + 0.03 }); });   // snow
  // the glacier: ice flies in from all round and fuses over the target
  const glacier = new THREE.Group(); glacier.position.copy(hang); const parts = [];
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(chunkGeometry(), mat); m.scale.setScalar(rand(0.45, 0.75)); m.position.set(rand(-0.6, 0.6), rand(-0.3, 0.3), rand(-0.6, 0.6)); m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); m.visible = false; glacier.add(m); parts.push(m); }
  let size = 0.01; v.timed(glacier, E - ctx.now(), (k, dt) => { glacier.rotation.y += dt * 0.15; glacier.scale.setScalar(size); });
  v.light(hang, ICEC, 14, F + 3 - ctx.now(), 8);
  parts.forEach((m, i) => later(i * 110, () => {
    const from = hang.clone().add(V(rand(-5, 5), rand(-2, 2.5), rand(-5, 5))), fly = new THREE.Mesh(chunkGeometry(), mat), rib = v.ribbon({ col: ICEC, width: 0.08, n: 10 }); fly.scale.setScalar(0.5);
    lob(v, fly, from, hang.clone().add(m.position), 0.6, 0.45, () => { rib.end(); m.visible = true; size = Math.min(1.35, size + 0.16); v.burst(hang.clone().add(m.position), { shape: 7, n: 12, speed: 2, cols: ICE_COLS, size: 0.05, life: 0.4, g: 2 }); }, { each: p => rib.push(p) });
  }));
  ticker(v, F + 0.2 - ctx.now(), (k, dt) => { if (k > 0.5 && Math.random() < dt * 8) v.bolt(hang.clone().add(V(rand(-0.6, 0.6), rand(-0.4, 0.4), rand(-0.6, 0.6))), hang.clone().add(V(rand(-0.6, 0.6), rand(-0.4, 0.4), rand(-0.6, 0.6))), [0.85, 0.95, 1], 0.08, { width: 0.02, jag: 0.2 }); });   // cracks of light
  // it calves: boulder after boulder crashes onto the target, ice spikes bursting from the ground after each
  await ctx.until(F - 0.42); cueAt(ctx, F);   // (a boulder falls for 0.42 s: the first lands on the sound)
  for (let i = 0; i < 11; i++) later(i * 260, () => {
    const r = rand(0.38, 0.6), m = new THREE.Mesh(chunkGeometry(), mat); m.scale.setScalar(r); const off = V(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
    size = Math.max(0.55, size - 0.06);
    lob(v, m, hang.clone().add(V(rand(-0.5, 0.5), -0.4, rand(-0.5, 0.5))), at.clone().add(off).setY(at.y + r * 0.6), 0, 0.42, (p) => {
      v.burst(p, { shape: 7, n: 34, speed: 5, cols: ICE_COLS, size: 0.07, life: 0.8, g: 9 }); v.shake(0.1, 0.15); v.flash([0.8, 0.9, 1], 0.08); v.ring(at, ICEC, 1.8, 0.35); glowTargets(ctx, 0.6, 0.3);
      shatter(v, p, 7, mat, { size: 0.2, speed: 2.6 });
      const a = rand(0, 6.28), d = rand(0.9, 1.9), sp = at.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); sp.y = effectH(sp.x, sp.z);   // a spike bursting up
      const spike = new THREE.Mesh(shardGeometry(6, 0.18), mat); spike.position.copy(sp); spike.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3)); const h = rand(0.6, 1.1);
      v.timed(spike, E - 0.1 - ctx.now(), (k2, dt2, t2) => { spike.scale.set(0.2, h * Math.min(1, t2 / 0.12) + 0.001, 0.2); spike.visible = t2 < E - 0.1 - ctx.now() - 0.05 && !spike.userData.gone; });
      spikes.push({ spike, sp, h });
    }, { fall: true });
  });
  const spikes = [];
  await ctx.until(F + 2.85);
  // the last of it closes over the target as one great crystal, and everything shatters
  glacier.visible = false;
  const block = new THREE.Mesh(shardGeometry(6, 0.22), mat); block.position.copy(at).setY(at.y - 0.05);
  v.timed(block, 1.1, (k, dt, t) => { const g = Math.min(1, t / 0.18), sw = t > 0.95 ? 1 + (t - 0.95) * 2 : 1; block.scale.set(0.75 * sw, 2.2 * g * sw + 0.001, 0.75 * sw); },
    () => {
      v.burst(at.clone().setY(at.y + 0.9), { shape: 7, n: 140, speed: 7.5, cols: ICE_COLS, size: 0.08, life: 1.1, g: 9 }); v.flash([0.9, 0.97, 1], 0.55); v.shake(0.28, 0.4); v.hitstop = 0.14;
      shatter(v, at.clone().setY(at.y + 0.9), 18, mat, { size: 0.32, speed: 3.6 }); v.ring(at, ICEC, 5, 0.8, { intensity: 1.6 }); v.ring(at, [1, 1, 1], 2.4, 0.4);
      for (const s2 of spikes) { s2.spike.userData.gone = true; shatter(v, s2.sp.clone().setY(s2.sp.y + s2.h * 0.5), 4, mat, { size: 0.16, speed: 2.2 }); }
    });
  v.decal(at, [0.5, 0.75, 1], 1.6, 2, { intensity: 0.8 });
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
// 霸雷: [ROM fx 33] one colossal column of lightning on the target with the original's two sounds (1.38 s after the cast
// begins), a white-out; over at 4.2 s. Remade as 雷震子's last spell [the user's call, 2026-10-30: next-gen]: storm
// clouds churn over the target, flickering from inside; charge crawls up out of the ground round it in thin rising
// leaders; then the strike: a column of lightning as wide as a cell with bolts braided round it, a white-out, light
// running out along the earth in every direction; the afterglow hangs, arcs crawling over the target, and three last
// strikes fall round it
async function greatThunder(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), F = 1.38, E = 4.2;
  shotAt(ctx, 0.5, at.clone().add(V(0, 2.2, 0)), { dist: 11, pitch: 0.18, yaw: -0.5, speed: 2 });   // low, the storm overhead: under way while he still casts, so it has come round before the strike [the user's call]
  ctx.until(0.45).then(() => {   // the storm gathers over the target while he casts, as the camera comes to it
    DARK(ctx, 0.8, 0.85, 0.85, 0.55); STORM(v, at, 30, 3, 7, [0.1, 0.1, 0.16], 3.6);
    for (let i = 0; i < 40; i++) v.smokePuff(at.x + Math.cos(i) * 2, at.y + 7.5, at.z + Math.sin(i) * 2, { life: 3.6, size: 1.6, size1: 2.6, tint: [0.1, 0.1, 0.18], orb: { x: at.x, z: at.z, w: 1.6 } });
  });
  await intro(ctx, BOLT, { dur: 900, keep: true });
  shotAt(ctx, F + 0.3, at.clone().add(V(0, 0.6, 0)), { dist: 9.5, pitch: 0.6, yaw: 0.4, speed: 1.4 });   // high, swung round, the lightning running out along the earth
  ticker(v, E - ctx.now(), (k, dt) => { if (Math.random() < dt * 6) v.light(at.clone().add(V(rand(-2, 2), 7.5, rand(-2, 2))), BOLT, rand(20, 45), 0.08, 12); });   // the cloud lit from inside
  // charge: thin leaders crawl up out of the ground round the target, more and more
  ticker(v, Math.max(0.3, F - ctx.now()), (k, dt) => {
    if (Math.random() < dt * (6 + k * 22)) { const a = rand(0, 6.28), r = rand(0.4, 1.5), p = at.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = effectH(p.x, p.z) + 0.05; v.bolt(p, p.clone().add(V(rand(-0.2, 0.2), rand(0.5, 1.4) * (0.5 + k), rand(-0.2, 0.2))), BOLT, 0.1, { width: 0.025, jag: 0.3 }); }
    if (Math.random() < dt * 30) { const a = rand(0, 6.28), r = rand(0.3, 1.4); v.spark(at.x + Math.cos(a) * r, at.y + 0.05, at.z + Math.sin(a) * r, { vy: rand(1.5, 3), life: 0.6, size: 0.04, r: 0.75, gg: 0.85, b: 1, shape: 0 }); }
  });
  await ctx.until(F);
  // the strike
  v.pillar(at, [0.6, 0.75, 1], 0.75, 14, 1.0, { intensity: 2.4 }); v.pillar(at, [1, 1, 1], 0.3, 14, 0.8, { intensity: 2.6 });
  for (let i = 0; i < 8; i++) v.bolt(at.clone().add(V(rand(-0.7, 0.7), 12, rand(-0.7, 0.7))), at.clone().add(V(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), i < 2 ? [1, 1, 1] : BOLT, 0.8, { width: i < 2 ? 0.2 : 0.12 });
  v.flash([1, 1, 1], 1); v.shake(0.4, 0.7); v.hitstop = 0.18; v.screen.chroma = 0.7;
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + rand(-0.15, 0.15), len = rand(1.8, 3.2), e = at.clone().add(V(Math.cos(a) * len, 0, Math.sin(a) * len)); e.y = effectH(e.x, e.z) + 0.05; v.bolt(at.clone().setY(at.y + 0.05), e, BOLT, 0.5, { width: 0.06, jag: 0.35 }); }   // along the earth
  v.burst(at.clone().setY(at.y + 0.2), { shape: 5, n: 120, speed: 8, cols: [[1, 1, 1], BOLT, [0.5, 0.6, 1]], size: 0.06, life: 0.9, g: 4 });
  v.ring(at, BOLT, 6, 1.0, { intensity: 1.8 }); v.ring(at, [1, 1, 1], 3, 0.5); v.decal(at, [0.5, 0.6, 1], 2.4, 2.2); dustBurst(v, at, 1.3, [0.3, 0.3, 0.38]);
  glowTargets(ctx, 1, 1.2); ctx.hit();
  // the afterglow: arcs crawl over the target; three last strikes round it
  plasma(v, at.clone().setY(at.y + 0.6), BOLT, 1.5, 0.6);
  for (let i = 0; i < 3; i++) later(500 + i * 280, () => {
    const a = rand(0, 6.28), r = rand(1.3, 2.1), p = at.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = effectH(p.x, p.z);
    v.bolt(p.clone().setY(p.y + 11), p, BOLT, 0.25, { width: 0.08 }); v.flash([0.8, 0.85, 1], 0.25); v.ring(p, BOLT, 1.4, 0.4); v.burst(p.clone().setY(p.y + 0.1), { shape: 5, n: 20, speed: 3, cols: [[1, 1, 1], BOLT], size: 0.05, life: 0.5 });
  });
  await ctx.until(E - 0.1); outro(ctx);
}

// 暴走之光: [ROM fx 34] the caster glows; a ball of light flies up off him (its first sound, 1.73 s after the cast begins)
// and a white streak crosses the sky (1.97 s); then the light runs wild over the cross: every cell pulses, a white ring
// (2.0 s), a ball of orange fire (2.25), a smaller ring (2.5), a ring (2.75), fire (3.0), a scatter of sparks (3.25),
// small fire (3.5), and last a wave of dark-red fire as the screen darkens (3.75); the screen flashing pale with the
// rings; over at 4.6 s. Rebuilt on the original's own frames [the user's call: refer to how the original looks]: the same
// beats, each a 3D piece: rings of white light bursting out, fireballs swelling and bursting, the light running back and
// forth between white and fire, the pulses smaller and quicker, the last fire dark red with the blow
async function lightBurst(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = cells[0], a = ctx.caster, B = basis(ctx), F = 1.73, F2 = 1.97, H = 3.75, E = 4.6;
  const WHITE = [1, 0.97, 0.9], ORANGE = [1, 0.55, 0.15], RED = [0.85, 0.12, 0.05];
  cueAt(ctx, F);
  await intro(ctx, WHITE, { dur: 600, dist: 11, pitch: 0.45 });
  // he glows, the light gathering in him
  const hand = a.chest().add(V(0, 0.4, 0));
  ticker(v, Math.max(0, F - ctx.now()), (k, dt) => { a.flash = 0.25 + 0.3 * k * (0.6 + 0.4 * Math.sin(ctx.now() * 30));
    for (let j = perSec(dt, 40); j > 0; j--) { const t = rand(0, 6.28), r = rand(0.5, 0.9); v.spark(hand.x + Math.cos(t) * r, hand.y + rand(-0.4, 0.3), hand.z + Math.sin(t) * r, { seek: { x: hand.x, y: hand.y, z: hand.z, k: 6 }, life: 0.35, size: rand(0.03, 0.05), r: 1, gg: 0.95, b: 0.85, shape: 5 }); } }, () => { a.flash = 0; });
  // the ball of light flies up off him, and a white streak crosses the sky
  await ctx.until(F);
  const ball = glowCard(v, WHITE, 0.5), rib = v.ribbon({ col: WHITE, width: 0.12, n: 12, fade: 0.3 }), to = hand.clone().addScaledVector(B.right, 2).add(V(0, 7, 0));
  v.timed(ball, 0.35, k => { ball.position.copy(hand).lerp(to, k * k); rib.push(ball.position.clone()); }, () => rib.end());
  v.flash(WHITE, 0.15);
  await ctx.until(F2);
  const s0 = c0.clone().addScaledVector(B.right, -4).addScaledVector(B.toCam, 2).setY(c0.y + 0.5), s1 = c0.clone().addScaledVector(B.right, 3).addScaledVector(B.toCam, -3).setY(c0.y + 6);
  v.bolt(s0, s1, WHITE, 0.2, { width: 0.1, jag: 0.03 });
  // the pulses over every cell of the cross, on the original's beats
  const at = c => c.clone().setY(c.y + 0.55), yaw = yawOf(B.toCam);
  const ring = (s, pale) => { for (const c of cells) { const p = at(c); v.ring(p, WHITE, 1.1 * s, 0.3, { vertical: true, yaw, y: p.y, intensity: 1.6 });
      const g = glowCard(v, WHITE, 0.5 * s); g.position.copy(p); v.timed(g, 0.22, k => { g.scale.setScalar(0.5 * s * (1 + k)); g.material.opacity = 1 - k; });
      v.burst(p, { n: 6, speed: 2 * s, cols: [WHITE], size: 0.04, life: 0.3, g: 0, shape: 5 }); }
    if (pale) v.flash([1, 0.98, 0.92], 0.14); };
  const fire = (s, col, dark) => { for (const c of cells) { const p = at(c), fb = v.fireball(0.3 * s, { ragged: 1, heat: dark ? 0.9 : 1.3, tint: dark ? [1, 0.45, 0.35] : [1, 1, 1] });
      fb.position.copy(p); v.timed(fb, 0.3, (k, dt, t) => { fb.userData.mat.uniforms.uT.value = t; fb.scale.setScalar(0.5 + 0.9 * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2)); fb.userData.mat.uniforms.uHeat.value = (dark ? 0.9 : 1.3) * (1 - k * 0.6); }, () => { fb.visible = false; });
      v.explode(p, 0.32 * s, { n: Math.round(9 * s), smoke: !!dark, tint: dark ? [1.1, 0.4, 0.3] : [1.2, 1, 0.8], smokeTint: [0.2, 0.08, 0.06] });   // (the flame round the core: the fireball alone read pale in daylight)
      v.burst(p, { n: 10 * s, speed: 3 * s, cols: [col, [1, 0.85, 0.5]], size: 0.05, life: 0.45, g: 2, shape: 5 }); v.light(p, col, 6 * s, 0.25, 4); } };
  const sparks = () => { for (const c of cells) v.burst(at(c), { n: 14, speed: 2.5, cols: [WHITE, [1, 0.85, 0.5]], size: 0.035, life: 0.35, g: 1, shape: 5 }); };
  const BEATS = [[2.0, () => ring(1, true)], [2.25, () => fire(1, ORANGE)], [2.5, () => ring(0.7, true)], [2.75, () => ring(1, true)], [3.0, () => fire(1, ORANGE)], [3.25, sparks], [3.5, () => fire(0.7, ORANGE)]];
  for (const [t, f] of BEATS) { await ctx.until(t); f(); v.shake(0.06, 0.12); }
  // the last: the screen darkens and dark-red fire bursts on every cell with the blow
  await ctx.until(H - 0.15); DARK(ctx, 0.75, 0.3, 0.8, 0.85);
  await ctx.until(H);
  fire(1.4, RED, true); v.shake(0.28, 0.4); v.hitstop = 0.08; v.screen.chroma = 0.4;
  for (const c of cells) dustBurst(v, c, 0.4);
  glowTargets(ctx, 0.8, 0.5); ctx.hit();
  await ctx.until(H + 0.3); v.screen.darkTarget = 0;
  await ctx.until(E - 0.1); outro(ctx);
}
// 九天之怒: [ROM fx 35] in darkness a vast wheel of light opens in the sky, a ring of light orbs bursts around it and
// it comes down on the whole area in a white-out
async function heavenWrath(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), col = [1, 0.95, 0.75], R = spreadOf(cells) + 1.2;
  await intro(ctx, col, { dur: 800, dist: 14, pitch: 0.42 });
  DARK(ctx, 0.85, 0.95, 0.95, 0.85);
  const sky = c0.clone().setY(c0.y + 4.2);
  const halo = glowCard(v, col, (R + 1) * 3); halo.position.copy(sky);
  v.timed(halo, 2.8, (k, dt, t) => { halo.material.opacity = Math.min(1, t / 0.6) * 0.6 * (1 - k * k); });
  v.light(sky, col, 40, 2.8, 16);
  await ctx.wait(400); await ctx.until(2.32 - 0.7);   // (it comes down with the original's sound, 2.32 s after the cast begins; over at 3.8 s)
  for (let i = 0; i < 10; i++) later(i * 50, () => { const a = i / 10 * 6.28, p = sky.clone().add(V(Math.cos(a) * (R + 0.6), -0.3, Math.sin(a) * (R + 0.6))), g = orb(v, col, 0.5); g.position.copy(p);
    v.timed(g, 0.6, k => { g.scale.setScalar(0.4 + k * 1.6); g.userData.halo.material.opacity = 1 - k; g.userData.core.material.opacity = 1 - k; }); });
  await ctx.until(2.32);
  for (const c of cells) v.pillar(c, col, 0.42, 7, 0.9, { intensity: 1.4 });
  v.flash([1, 1, 1], 0.95); v.shake(0.3, 0.5); v.hitstop = 0.1; v.ring(c0, col, R * 2 + 3, 1);
  for (const c of cells) v.burst(c.clone().setY(c.y + 0.3), { shape: 5, n: 14, speed: 3, cols: [[1, 1, 1], col], size: 0.05, life: 0.7 });
  glowTargets(ctx, 1, 1); ctx.hit();
  await ctx.wait(1300); outro(ctx);
}
// 積屍氣: [ROM fx 36] a ring of white lights round the target (1.25 s), then black, only the target showing; from 2.25 s
// the skulls of the dead (the original's own: assets/fx/hd/skull.png) swoop through the dark round it, a wail every half
// second (its sound track, from 2.02 s), to 7 s; the light comes back with the blow (7.25 s); over at 7.5 s.
// Redesigned [the user's call]: ghost-lights kindle round the area and sink into the earth; the dark falls, green-black,
// the ground of every cell glowing a sick green as the miasma of the dead seeps up out of it; the dead rise out of the
// earth as wailing skulls that wheel up round the area on green wisp-tails and dive screaming through the targets, rising
// again, ever more of them; at the end every one of them turns on the targets at once and the miasma bursts out of them
// with the blow, the light coming back
const SKULL = () => tex('assets/fx/hd/skull.png');
async function corpseQi(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 0.9, F = 2.02, H = 7.05, E = 7.5;
  const SICK = [0.55, 1, 0.6], BURST = [3, 4, 3];
  // a colour that shows as c through the grade's darkness as it stands now (it divides by what the darkness leaves: red and
  // blue 0.05 of themselves at its full, green 0.13), so a ghost is pale green whether the dark is falling or full
  const lit = c => { const d = v.screen.dark; return [c[0] / Math.max(0.05, 1 - d), c[1] / Math.max(0.08, 1 - d * 0.92), c[2] / Math.max(0.05, 1 - d)]; };
  const GHOST = [0.6, 0.8, 0.58], GLOW = lit(GHOST);
  await intro(ctx, SICK, { dur: 700, dist: 10.5, pitch: 0.45 });
  // ghost-lights round the area, guttering (the original's ring of lights), then they sink into the earth
  const lights = [...Array(8)].map((_, i) => { const a = i / 8 * 6.28, p = c0.clone().add(V(Math.cos(a) * R, 0, Math.sin(a) * R)); p.y = effectH(p.x, p.z);
    const g = glowCard(v, [0.7, 1.4, 0.8], 0.45), t0 = ctx.now(), ph = rand(0, 6); g.material.opacity = 0;
    v.timed(g, F + 0.3 - t0, (k, dt, t) => { const T = ctx.now(), sink = Math.max(0, (T - (F - 0.15)) / 0.3);
      g.position.copy(p).setY(p.y + 0.45 + Math.sin(T * 3 + ph) * 0.08 - sink * sink * 0.6); g.material.opacity = Math.min(1, t * 3) * (0.7 + 0.3 * Math.sin(T * 17 + ph)) * (1 - sink); }); return p; });
  await channel(ctx, SICK, F); ctx.cue();
  // the dark falls; the ground glows a sick green under the cells, the miasma seeps up
  DARK(ctx, 0.95, 1, 0.92, 1);   // (near black, green kept a little: the grade darkens before the gamma, and 0.85 left the field half lit)
  for (const p of lights) v.burst(p.clone().setY(p.y + 0.1), { n: 6, speed: 1, cols: [[0.7, 1.4, 0.8]], size: 0.05, life: 0.4, g: -1, shape: 0 });
  later(500, () => { for (const c of cells) v.decal(c, lit([0.2, 1.1, 0.25]), 0.6, H + 0.3 - ctx.now(), { intensity: 0.3, in: 0.6, flicker: true }); });   // (once the dark is most of the way down)
  ticker(v, H - 0.5 - ctx.now(), (k, dt) => {   // (stopping before the light comes back: lit for the dark, they flared as it lifted)
    const mist = lit([0.1, 0.8, 0.12]), mote = lit([0.3, 0.55, 0.3]);
    for (let j = perSec(dt, 12 * cells.length); j > 0; j--) { const c = cells[(Math.random() * cells.length) | 0];
      v.smoke(c.x + rand(-0.45, 0.45), c.y + 0.05, c.z + rand(-0.45, 0.45), { vy: rand(0.15, 0.4), life: rand(1.0, 1.4), size: rand(0.25, 0.4), r: mist[0], gg: mist[1], b: mist[2], a: 0.3, shape: -1 }); }   // (the miasma, lit green from under)
    for (let j = perSec(dt, 25); j > 0; j--) { const c = cells[(Math.random() * cells.length) | 0];
      v.spark(c.x + rand(-0.5, 0.5), c.y + 0.05, c.z + rand(-0.5, 0.5), { vy: rand(0.3, 0.9), life: rand(0.8, 1.4), size: rand(0.025, 0.045), r: mote[0], gg: mote[1], b: mote[2], shape: 0, fadeIn: 0.3 }); }
  });
  // the dead: skulls rise out of the earth, wheel up round the area and dive through the targets, again and again
  const targets = tgts(ctx).length ? tgts(ctx) : null, aim = () => targets ? targets[(Math.random() * targets.length) | 0].chest() : cells[(Math.random() * cells.length) | 0].clone().setY(c0.y + 0.5);
  const n = 6 + Math.round(cells.length * 1.6), T0 = ctx.now(), GATHER = H - 0.45;
  for (let i = 0; i < n; i++) {
    const s = card(SKULL(), 0.58, 0.72, { col: GLOW, add: true, order: 8 }), q = { born: T0 + 0.25 + i * (2.2 / n), ph: rand(0, 6.28), dir: Math.random() < 0.7 ? 1 : -1 };
    s.material.opacity = 0; s.visible = false;
    const rise = () => { const c = cells[(Math.random() * cells.length) | 0]; q.from = c.clone().add(V(rand(-0.4, 0.4), -0.1, rand(-0.4, 0.4))); q.a0 = Math.atan2(q.from.z - c0.z, q.from.x - c0.x); q.cyc = rand(1.5, 2.1); q.rib && q.rib.end(); q.rib = v.ribbon({ col: [0.45, 1.3, 0.55], width: 0.14, n: 12, fade: 0.4 });
      v.burst(q.from.clone().setY(q.from.y + 0.15), { n: 5, speed: 0.8, cols: [lit(GHOST)], size: 0.04, life: 0.4, g: -1, shape: 0 }); };
    v.timed(s, E - ctx.now(), () => {
      const T = ctx.now();
      if (T < q.born) return;
      if (!q.from) { rise(); q.t0 = T; s.visible = true; }
      let p;
      if (T >= GATHER) {   // every one of them on the targets at once
        if (!q.last) { q.last = s.position.clone(); q.end = aim(); }
        const f = Math.min(1, (T - GATHER) / (H - GATHER)); p = q.last.clone().lerp(q.end, f * f); s.material.opacity = 0.75; s.scale.set(0.58 * (1 + f * 0.25), 0.72 * (1 + f * 0.25), 1);   // (all at once: dimmer, or they ran together white)
        if (f >= 1) { s.visible = false; if (q.rib) { q.rib.end(); q.rib = null; } return; }
      } else {
        const f = (T - q.t0) / q.cyc;
        if (f >= 1) { rise(); q.t0 = T; return; }
        if (f < 0.65) {   // up out of the earth and round the area
          const g = f / 0.65, a = q.a0 + q.dir * g * 3.4, r = R * (0.35 + 0.55 * Math.sin(g * Math.PI * 0.8));
          p = c0.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = q.from.y + 0.2 + g * 2.2 + Math.sin(T * 5 + q.ph) * 0.12;
          if (g < 0.1) p.lerp(q.from, 1 - g / 0.1);
        } else {   // the dive through a target, screaming
          if (!q.dive) { q.dive = aim(); q.top = s.position.clone(); }
          const g = (f - 0.65) / 0.35; p = q.top.clone().lerp(q.dive.clone().add(q.dive.clone().sub(q.top).setY(0).multiplyScalar(0.4)).setY(q.dive.y - 0.3), g * g);
          if (g > 0.75 && !q.through) { q.through = 1; for (const a of tgts(ctx)) if (a.chest().distanceTo(q.dive) < 0.3) a.flash = 0.6;
            v.burst(q.dive.clone(), { n: 8, speed: 1.4, cols: [lit(GHOST)], size: 0.04, life: 0.45, g: 0, shape: 0 }); }
        }
        if (f < 0.65) { q.dive = null; q.through = 0; }
        s.material.opacity = Math.min(1, (T - q.t0) * 4) * (f > 0.9 ? (1 - f) * 10 : 1) * (0.85 + 0.15 * Math.sin(T * 23 + q.ph));
        s.scale.set(0.58, 0.72, 1);
      }
      s.position.copy(p); s.material.rotation = Math.sin(T * 6 + q.ph) * 0.25; s.material.color.setRGB(...lit(GHOST));
      if (q.rib) q.rib.push(p.clone().setY(p.y - 0.15));
    });
  }
  ticker(v, H - 0.1 - ctx.now(), (k, dt) => { for (const a of tgts(ctx)) a.flash *= Math.exp(-dt * 6); });   // (each dive through one lights it, fading)
  // the blow: the miasma bursts out of the targets, the light comes back
  await ctx.until(H);
  v.shake(0.26, 0.45); v.hitstop = 0.08; v.screen.chroma = 0.5;
  for (const c of cells) { v.burst(c.clone().setY(c.y + 0.5), { n: 24, speed: 3.5, cols: [BURST, [1, 2.2, 1.1]], size: 0.05, life: 0.6, g: 0, shape: 0 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; v.smokePuff(c.x, c.y + 0.3, c.z, { vx: Math.cos(a) * 1.8, vz: Math.sin(a) * 1.8, vy: rand(0.3, 0.9), drag: 2.2, life: rand(0.8, 1.2), size: 0.3, size1: 0.9, tint: [0.12, 0.2, 0.12] }); } }
  glowTargets(ctx, 0.8); ctx.hit();
  await ctx.wait(100); v.screen.darkTarget = 0;   // (eased off: the light back with the blow, as the original's)
  await ctx.until(E - 0.1); outro(ctx);
}
// 黑色狂嵐: [ROM fx 37] black: a gale of darkness roars over the whole area, its roar the original's first three sounds
// (from 2.18 s after the cast begins), then it bursts into a red blaze on its fourth (5.48 s); over at 6.8 s. Remade as
// 燃燈's last spell [the user's call, 2026-10-30: next-gen]: the light dies to a violet black; a vast vortex of black
// wind turns over the area, violet lightning crawling in it; each roar is a pulse, a violet shockwave and strikes
// among the targets; then the storm condenses into a black sphere at its heart, drawing everything in, and detonates in
// a crimson blaze over every cell
async function blackGale(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells), R = spreadOf(cells) + 0.8, F = 2.18, E = 6.8, VIO = [0.65, 0.35, 1];
  await intro(ctx, VIO, { dur: 800, dist: 14, pitch: 0.42 });
  DARK(ctx, 0.92, 0.95, 1, 0.75); cueAt(ctx, F);   // (red and green darkened most: a violet black)
  const S = F + (ctx.track[3] || 3.3), L = S + 0.3 - ctx.now();   // (S: the blaze)
  shotAt(ctx, ctx.now() + 0.05, c0.clone().add(V(0, 1.5, 0)), { dist: 14, pitch: 0.75, yaw: -0.5, speed: 1 });   // high, looking down into the vortex (from its side, its wall hid everything)
  shotAt(ctx, F + 1, c0.clone().add(V(0, 1.2, 0)), { dist: 13, pitch: 0.7, yaw: 0.45, speed: 0.6 });   // a slow sweep round over it
  shotAt(ctx, F + (ctx.track[2] ?? 2) + 0.2, c0.clone().add(V(0, 1.4, 0)), { dist: 10, pitch: 0.6, yaw: 0.1, speed: 1.6 });   // in on the black sphere
  shotAt(ctx, S + 0.2, c0.clone().add(V(0, 0.6, 0)), { dist: 14, pitch: 0.55, yaw: -0.2, speed: 1.5 });   // pulling back over the blaze
  const vortex = [swirl(v, c0, [0.4, 0.3, 0.55], R * 0.6, R + 0.9, 4.5, L, { speed: 9, twist: 3, foam: [0.75, 0.6, 1], intensity: 0.75, normal: true }),
    swirl(v, c0, [0.25, 0.2, 0.4], R * 0.4, R + 0.5, 3.5, L, { speed: -7, twist: 2, intensity: 0.6, normal: true })];
  let pull = 1;   // (the storm closing in on its heart, 1 to 0)
  ticker(v, L, (k, dt) => {
    for (const g of vortex) g.scale.x = g.scale.z = Math.max(0.15, pull) * g.scale.y;
    for (let i = 0; i < 4; i++) { const a = rand(0, 6.28), r = rand(0.4, R + 0.5) * pull; v.smokePuff(c0.x + Math.cos(a) * r, c0.y + rand(0.2, 2.8), c0.z + Math.sin(a) * r, { life: 0.9, size: 0.6, size1: 1.4, tint: [0.06, 0.04, 0.09], orb: { x: c0.x, z: c0.z, w: 4 } }); }
    if (Math.random() < dt * 5) { const a = rand(0, 6.28), r = rand(0.5, R) * pull, b2 = a + rand(0.6, 1.4), p = c0.clone().add(V(Math.cos(a) * r, rand(0.6, 2.8), Math.sin(a) * r)); v.bolt(p, c0.clone().add(V(Math.cos(b2) * r, rand(0.6, 2.8), Math.sin(b2) * r)), VIO, 0.12, { width: 0.04, jag: 0.4 }); }   // lightning crawling in it
  });
  v.shake(0.06, L - 0.2);
  // the three roars: a pulse, a violet shockwave over the area, strikes among the targets
  for (let i = 0; i < 3; i++) ctx.until(F + (ctx.track[i] ?? i)).then(() => {
    v.flash(VIO, 0.25); v.shake(0.18, 0.3); v.ring(c0, VIO, R + 2.5, 0.7, { intensity: 1.4 }); glowTargets(ctx, 0.5, 0.3);
    for (const c of cells.filter(() => Math.random() < 0.5).slice(0, 4)) v.bolt(c.clone().setY(c.y + 7), c.clone().setY(c.y + 0.1), VIO, 0.2, { width: 0.07 });
  });
  // the storm condenses into a black sphere at its heart, drawing everything in
  const C1 = F + (ctx.track[2] ?? 2) + 0.2, heart = c0.clone().setY(c0.y + 1.4);
  await ctx.until(C1);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })), rim = glowCard(v, VIO, 1);
  sphere.position.copy(heart); rim.position.copy(heart); sphere.renderOrder = 8;
  const grow = S - C1;
  v.timed(sphere, grow + 0.05, (k) => { sphere.scale.setScalar(0.05 + ease(k) * 0.75); pull = 1 - ease(k) * 0.85; });
  v.timed(rim, grow + 0.05, (k, dt, t) => { rim.scale.setScalar(0.4 + ease(k) * 2.4 + Math.sin(t * 30) * 0.08); rim.material.opacity = 0.9; });
  ticker(v, grow, (k, dt) => { for (let i = 0; i < 3; i++) { const d = V(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize(), r = rand(2, R + 1.5), p = heart.clone().addScaledVector(d, r); v.spark(p.x, p.y, p.z, { vx: -d.x * r * 1.6, vy: -d.y * r * 1.6, vz: -d.z * r * 1.6, life: 0.55, size: 0.05, r: 0.7, gg: 0.5, b: 1, shape: 0 }); } });
  // it detonates: a crimson blaze over every cell
  await ctx.until(S);
  sphere.visible = rim.visible = false;
  DARK(ctx, 0.75, 0.2, 0.8, 0.85); v.flash([1, 0.25, 0.1], 0.7); v.hitstop = 0.15; v.screen.chroma = 0.5;
  v.pillar(c0, [1, 0.15, 0.08], 0.9, 8, 1.0, { intensity: 1.8, grow: 1 }); v.ring(c0, [1, 0.2, 0.1], R + 3.5, 1.0, { intensity: 1.8 }); v.ring(c0, [1, 0.8, 0.8], R + 1, 0.5);
  v.explode(heart, 1.1, { n: 30, tint: [1, 0.5, 0.5] });
  cells.forEach((c, i) => later(i * 30, () => v.explode(c.clone().setY(c.y + 0.4), 0.5, { n: 10, smoke: i % 2 === 0, tint: [1, 0.6, 0.6] })));
  v.shake(0.35, 0.6); glowTargets(ctx, 1, 0.9);
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
      if (f >= 1 && !s.userData.p) { s.userData.p = 1; v.burst(s.position, { shape: 5, n: 26, speed: 2, cols: [[1, 0.8, 0.85], col], size: 0.05, life: 0.8, g: 0.5 }); v.ring(P, col, 1.3, 0.6); v.light(P.clone().setY(P.y + 1), col, 10, 0.8, 5); ticker(v, 1, k2 => { t.flash = 0.5 * (1 - k2); }, () => { t.flash = 0; }); }
    });
  });
  await ctx.until(F); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 觀音下凡: [ROM fx 42] 觀音 (the original's own figure, on her lotus with her halo) comes down from the sky at 1.5 s,
// circles over the area to 3.75 s, hovers raining blue light from 4 s to 6 s and goes up again; the targets glow with
// its chime at 7.65 s; over at 8.5 s. Redesigned [the user's call]: the clouds part and a shaft of soft gold falls on the
// area; she comes down it on her lotus, a crown of rays turning behind her, and circles the area once (clockwise); then,
// still over the middle, she sprinkles sweet dew from her willow sprig: drops of light arcing out and falling over
// everyone, and a lotus rises and opens at the feet of each ally; she goes back up the light; on the chime each ally is
// lifted in a soft column of light and their lotus scatters its petals upward
const RAY_CROWN = (() => { let t; return () => t || (t = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128);
  for (let i = 0; i < 24; i++) { g.rotate(Math.PI * 2 / 24); const gr = g.createLinearGradient(0, 0, 0, -124); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); const w = i % 2 ? 4 : 7; g.moveTo(-w, -18); g.lineTo(0, i % 2 ? -100 : -124); g.lineTo(w, -18); g.closePath(); g.fill(); }
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 60); r.addColorStop(0, 'rgba(255,250,230,0.9)'); r.addColorStop(0.5, 'rgba(255,220,150,0.35)'); r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fill();
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; })()); })();
async function guanyin(ctx) {
  const v = ctx.vfx, cells = cellsOf(ctx), c0 = mid(cells).setY(cells[0].y), DEW = [0.75, 0.9, 1], GOLD = [1, 0.88, 0.6], F = 7.65, E = 8.48;
  const ARRIVE = 1.5, CIRCLE = 2.7, HOVER = 3.85, DEW0 = 4.0, DEW1 = 6.0, LEAVE = 6.15, GONE = 6.8;
  await intro(ctx, [1, 0.9, 0.6], { dur: 700, dist: 12.5, pitch: 0.4 });
  DARK(ctx, 0.45, 0.85, 0.8, 0.6);   // (a blue dusk, so her light shows)
  // the clouds part: a ring of cloud over the area opening out, a shaft of soft gold down through it
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = rand(0.6, 1.1); v.smokePuff(c0.x + Math.cos(a) * r, c0.y + rand(4.4, 5), c0.z + Math.sin(a) * r, { vx: Math.cos(a) * 1.3, vz: Math.sin(a) * 1.3, vy: 0, drag: 0.8, life: 2.2, size: 0.7, size1: 1.2, tint: [0.95, 0.93, 0.9] }); }
  v.pillar(c0, GOLD, 1.3, 10, GONE + 0.4 - ctx.now(), { intensity: 0.12, grow: 1 });   // (faint: stronger, it hid the dew falling through it)
  // 觀音: down the light, round the area once, over the middle, and back up
  const fig = card(tex('assets/fx/hd/guanyin.png'), 1.9, 2.1, { order: 8 }), crown = card(RAY_CROWN(), 3.4, 3.4, { add: true, order: 7 }), glow = glowCard(v, [1, 0.9, 0.65], 2.4);
  const g = new THREE.Group(); g.add(glow, crown, fig); crown.position.y = 0.35; glow.position.y = 0.1; glow.renderOrder = 6;
  const hover = c0.clone().setY(c0.y + 3.1), top = hover.clone().setY(hover.y + 6), r = Math.min(1.4, spreadOf(cells) * 0.6 + 0.4);
  let hand = hover.clone();
  v.light(hover, GOLD, 10, GONE - ctx.now(), 10);
  v.timed(g, GONE - ctx.now(), () => {
    const T = ctx.now(); let p;
    if (T < CIRCLE) p = top.clone().lerp(hover, ease(Math.max(0, (T - ARRIVE) / (CIRCLE - ARRIVE))));
    else if (T < HOVER) { const k = (T - CIRCLE) / (HOVER - CIRCLE), a = k * Math.PI * 2, rr = r * Math.sin(k * Math.PI);   // (the angle rising: clockwise seen from above)
      p = hover.clone().add(V(Math.cos(a) * rr, 0, Math.sin(a) * rr)); }
    else if (T < LEAVE) p = hover.clone();
    else p = hover.clone().lerp(top, ease(Math.min(1, (T - LEAVE) / (GONE - LEAVE))));
    g.position.copy(p).setY(p.y + Math.sin(T * 2) * 0.07); hand = g.position.clone().add(V(0, -0.2, 0));
    const o = Math.min(1, Math.max(0, (T - ARRIVE) * 2)) * Math.min(1, Math.max(0, (GONE - T) * 2.5));
    fig.material.opacity = o; crown.material.opacity = o * 0.7; crown.material.rotation = T * 0.4; glow.material.opacity = o * 0.5;
    if (o > 0.3 && Math.random() < 0.4) v.spark(g.position.x + rand(-0.5, 0.5), g.position.y - 0.7, g.position.z + rand(-0.5, 0.5), { vy: -0.4, life: 1, size: 0.05, r: 1, gg: 0.9, b: 0.6, shape: 0 });
  });
  // the sweet dew: sprinkled from her sprig in flicks, drops of light arcing out and falling over the area
  const blooms = tgts(ctx).map(t => ({ t, b: null }));
  await ctx.until(DEW0);
  ticker(v, DEW1 - DEW0, (k, dt) => {
    for (let j = perSec(dt, 110); j > 0; j--) { const c = cells[(Math.random() * cells.length) | 0], to = c.clone().add(V(rand(-0.45, 0.45), 0, rand(-0.45, 0.45))), d = to.clone().sub(hand), tt = rand(0.8, 1.1), G = 4;
      v.spark(hand.x, hand.y, hand.z, { vx: d.x / tt, vy: (d.y + 0.5 * G * tt * tt) / tt, vz: d.z / tt, g: G, life: tt, size: rand(0.07, 0.1), r: DEW[0] * 1.5, gg: DEW[1] * 1.5, b: DEW[2] * 1.5, shape: 0 }); }   // (thrown to land on the cell: g pulls it down)
    for (let j = perSec(dt, 14); j > 0; j--) { const c = cells[(Math.random() * cells.length) | 0]; v.burst(c.clone().add(V(rand(-0.4, 0.4), 0.05, rand(-0.4, 0.4))), { n: 4, speed: 0.7, cols: [[1, 1, 1], DEW], size: 0.035, life: 0.4, g: 2, up: 1, shape: 0 }); }   // (where they land)
  });
  // a lotus rises and opens at each ally's feet as the dew falls
  blooms.forEach((q, i) => later(250 + i * 160, () => { q.b = lotusBloom(q.t.pos.clone()); const t0 = ctx.now();
    ticker(v, F - t0, () => { const f = Math.min(1, (ctx.now() - t0) / 1.8); q.b.open(1 - Math.pow(1 - f, 3)); q.b.root.scale.setScalar(0.4 + 0.6 * Math.min(1, f * 2)); }); }));
  // the chime: each ally lifted in a soft column of light, their lotus scattering its petals upward
  await ctx.until(F - 0.5);
  for (const q of blooms) v.light(q.t.pos.clone().setY(q.t.pos.y + 0.8), DEW, 5, 0.9, 4);
  await ctx.until(F); ctx.hit();
  for (const q of blooms) { v.pillar(q.t.pos, DEW, 0.42, 3, 0.9, { intensity: 0.5, grow: 1 }); if (q.b) q.b.scatter();
    for (let i = 0; i < 14; i++) v.spark(q.t.pos.x + rand(-0.35, 0.35), q.t.pos.y + rand(0, 0.4), q.t.pos.z + rand(-0.35, 0.35), { vy: rand(1, 2.2), life: rand(0.7, 1.1), size: rand(0.03, 0.05), r: 1, gg: 0.95, b: 0.8, shape: 0 }); }
  glowTargets(ctx, 0.7, 1.2);
  await ctx.until(F + 0.2); v.screen.darkTarget = 0;
  await ctx.until(E - 0.1); outro(ctx);
}
// 還魂咒: [ROM fx 43] a soul light comes down into the fallen. Remade as 燕蓉's last spell [the user's call, 2026-10-30:
// next-gen]: twilight; a shaft of gold light opens from the sky onto the fallen; the soul comes down it in a slow spiral,
// trailing light; a lotus of light, two rings of petals, blooms under the body; the soul sinks in, halos of light rise up
// the body one after another and golden motes drift away
async function revive(ctx) {
  const v = ctx.vfx, col = [1, 0.92, 0.65], soulCol = [0.75, 0.9, 1], P = ctx.at.clone();
  await intro(ctx, col, { dur: 800, dist: 8.5, pitch: 0.42 });
  DARK(ctx, 0.5, 0.85, 0.8, 0.6);
  const T = ctx.now(); shotAt(ctx, T + 0.05, P.clone().add(V(0, 2.3, 0)), { dist: 9, pitch: 0.22, yaw: -0.5, speed: 1.3 });   // low, looking up the shaft as the soul comes down
  shotAt(ctx, T + 1.2, P.clone().add(V(0, 0.6, 0)), { dist: 6.5, pitch: 0.42, yaw: 0.35, speed: 1.6 });   // close, swung round, as it sinks in
  // the shaft of light from the sky
  v.pillar(P, [1, 0.78, 0.4], 0.3, 9, 3.4, { intensity: 0.35, grow: 1 }); v.light(P.clone().setY(P.y + 2), col, 12, 3.4, 7);   // (soft: the soul and the lotus are what show)
  ticker(v, 3.2, (k, dt) => { if (Math.random() < dt * 25) { const a = rand(0, 6.28), r = rand(0, 0.45); v.spark(P.x + Math.cos(a) * r, P.y + rand(1, 5), P.z + Math.sin(a) * r, { vy: -rand(0.3, 0.8), life: 1.2, size: rand(0.03, 0.05), r: 1, gg: 0.93, b: 0.7, shape: 0, flicker: 1, ph: rand(0, 9) }); } });   // motes in the shaft
  // the lotus: two rings of petals of light opening under the body
  const pg = petalGeo(), lotus = new THREE.Group(), mats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.05, 0.75), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  [[8, 1, -0.9, 0], [8, 0.7, -1.3, Math.PI / 8]].forEach(([n, sc, tilt, off], ring) => { for (let i = 0; i < n; i++) { const pv = new THREE.Group(), m = new THREE.Mesh(pg, mats[ring]); pv.rotation.y = off + i / n * 6.28; m.rotation.x = tilt; m.scale.setScalar(sc); pv.add(m); lotus.add(pv); } });
  lotus.position.copy(P).setY(P.y + 0.03);
  v.timed(lotus, 3.4, (k, dt, t) => { lotus.scale.setScalar(0.2 + 1.1 * ease(Math.min(1, t / 1.4))); lotus.rotation.y += dt * 0.4; mats.forEach((m, i) => { m.opacity = Math.min(1, Math.max(0, t - i * 0.3) * 1.5) * Math.min(1, (3.4 - t) * 2) * 0.6; }); });
  // the soul comes down the shaft in a slow spiral
  const soul = orb(v, soulCol, 0.32), from = P.clone().setY(P.y + 5.5), rib = v.ribbon({ col: soulCol, width: 0.1, n: 30 }), rib2 = v.ribbon({ col: [1, 1, 1], width: 0.03, n: 20 });
  await new Promise(res => v.timed(soul, 1.6, (k, dt, t) => { const e = ease(k), r = 0.6 * (1 - e); soul.position.copy(from).lerp(P.clone().setY(P.y + 0.6), e).add(V(Math.cos(t * 5) * r, 0, Math.sin(t * 5) * r)); rib.push(soul.position); rib2.push(soul.position); },
    () => { rib.end(); rib2.end(); soul.visible = false; res(); }));
  // it sinks in: halos rise up the body, golden motes drift away
  v.flash(col, 0.35); v.burst(P.clone().setY(P.y + 0.6), { shape: 5, n: 30, speed: 2, cols: [[1, 1, 1], col, soulCol], size: 0.05, life: 0.8, g: -0.5 });
  for (let i = 0; i < 4; i++) later(i * 160, () => v.ring(P, col, 0.9 - i * 0.12, 0.6, { y: P.y + 0.15 + i * 0.4, intensity: 1.4 }));
  v.pillar(P, col, 0.3, 2.6, 1.2, { intensity: 0.8, grow: 1 });
  ticker(v, 1.2, (k, dt) => { if (Math.random() < dt * 40) { const a = rand(0, 6.28), r = rand(0.2, 0.7); v.spark(P.x + Math.cos(a) * r, P.y + rand(0.1, 1.2), P.z + Math.sin(a) * r, { vy: rand(0.6, 1.4), vx: Math.cos(a) * 0.3, vz: Math.sin(a) * 0.3, life: 1.2, size: rand(0.03, 0.06), r: 1, gg: 0.9, b: 0.6, shape: 0, flicker: 1, ph: rand(0, 9) }); } });
  glowTargets(ctx, 0.9, 1);
  ctx.hit(); await ctx.wait(1300); outro(ctx);
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
      for (let i = 0; i < 20; i++) later(800 + i * 25, () => v.spark(P.x + rand(-0.5, 0.5), P.y + rand(0.2, 1.8), P.z + rand(-0.5, 0.5), { vy: rand(0.6, 1.4), life: 0.9, size: 0.05, r: col[0], gg: col[1], b: col[2], shape: 5 }));
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
      v.burst(q, { shape: 5, n: 26, speed: 3, cols: [[0.9, 0.95, 1], [0.6, 0.7, 0.8]], size: 0.05, life: 0.7, g: 8 }); v.flash([0.6, 0.6, 0.7], 0.12);
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
  for (let i = 0; i < tr.length; i++) { await ctx.until(F + tr[i]); if (i === 0) ctx.cue(); v.burst(tgt, { shape: 5, n: 14, speed: 2.5, cols: [[1, 1, 0.85], col], size: 0.05, life: 0.5, g: 0 }); v.light(tgt, col, 12, 0.15, 5); if (i % 3 === 0) v.ring(tgt, col, 1.2, 0.3, { vertical: true, yaw: ctx.cam.yaw || 0, y: tgt.y }); }
  await ctx.until(F + 1.5);
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
        v.spark(q.x, q.y, q.z, { vx: -f.x * 1.5 + rand(-0.5, 0.5), vy: rand(0.3, 1.4), vz: -f.z * 1.5 + rand(-0.5, 0.5), life: rand(0.5, 1), size: rand(0.03, 0.06) * Math.max(0.6, s), r: 1, gg: rand(0.45, 0.8), b: 0.2, shape: 6 }); }
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
  ticker(v, 2.2, () => { for (let i = 0; i < 3; i++) v.spark(caster.x + rand(-3, 3), g0 + rand(0, 0.3), caster.z + rand(-2.5, 2.5), { vy: rand(0.6, 1.6), vx: rand(-0.2, 0.2), life: rand(1.2, 2), size: rand(0.03, 0.06), r: 1, gg: rand(0.4, 0.7), b: 0.15, shape: 6 }); });   // embers rising off the field
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
      for (let i = 0; i < (big ? 70 : 24); i++) { const a = rand(0, 6.28), sp = rand(2, big ? 9 : 5); v.spark(tg.x, tg.y, tg.z, { vx: Math.cos(a) * sp, vy: rand(2, big ? 9 : 5), vz: Math.sin(a) * sp, g: 12, life: rand(0.6, 1.2), size: rand(0.03, 0.07), r: 1, gg: rand(0.5, 0.85), b: 0.25, shape: 6, floor: at.y + 0.02 }); }   // embers thrown
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
  ticker(v, 1.4, () => { for (let i = 0; i < 2; i++) v.spark(at.x + rand(-2.5, 2.5), at.y + rand(2, 4), at.z + rand(-2, 2), { vy: -rand(0.3, 0.7), vx: rand(-0.3, 0.3), life: rand(1.2, 1.8), size: rand(0.03, 0.05), r: 1, gg: rand(0.4, 0.6), b: 0.15, shape: 6 }); });
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
      v.burst(c.clone().setY(c.y + 0.2), { shape: 5, n: 14, speed: 3.5, cols: [[1, 1, 0.85], gold], size: 0.05, life: 0.5 });
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
    for (let j = 0; j < 8; j++) { const a = rand(0, 6.28), sp = rand(1.5, 3); v.spark(p.x, p.y, p.z, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(-1, 1), life: 0.4, size: 0.04, r: 0.85, gg: 0.85, b: 1, shape: 5 }); } };
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
  2: c => swordStorm(c, [0.45, 0.85, 1]), 3: skySwords, 5: qiankunBreak, 6: rainbowDash, 7: furySwords,
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
