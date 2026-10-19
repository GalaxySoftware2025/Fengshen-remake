// 萬獸山, the mountain of beasts (maps 0f53e0 and 0f5420, the same art: scene 39 and battle 19), remade: plateaus of
// orange earth with patches of dry grass, ringed by cliffs of dark purple rock that fall away into a sea of cloud,
// joined by steps cut in the cliffs and three plank bridges (x 20-23 at rows 8-9, 17-20 at row 17, 13-21 at rows 21-22);
// the 四不像 waits on the summit (row 0) between two boulders. Measured on tools/qa/grid.py 0f53e0.
// Built like the lotus garden (src/remake/lotus.js levels): each cell classed by its colours (PROTO: earth, grass, cliff,
// the cut steps, cloud, bridge; measured on the art), the walk's regions raised by the steps between them. The land is
// a heightfield (kit/terrain.js Land's look, its height ours): level where a unit stands, the art's outline at a quarter
// cell for the rest of the raised ground, and craggy cliffs falling from it into the billowing cloud over a cell or so.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { readLayout, Land, CL, grass, windTick } from '../kit/terrain.js';
import { levels } from './lotus.js';
import { D, G } from '../rules.js';

const PROTO = {
  P: { b46c24: 0.39, d89024: 0.34, fcb46c: 0.15, 904800: 0.09 },
  G: { 242400: 0.31, b46c24: 0.2, d89024: 0.17, b49024: 0.1, d8b448: 0.08, fcb46c: 0.07, 904800: 0.06 },
  B: { '24006c': 0.17, '000000': 0.15, 482400: 0.14, '906c6c': 0.11, fcfcfc: 0.11, b4fcfc: 0.1, b46c24: 0.04, 242400: 0.03, '00d8fc': 0.03 },
  S: { 482400: 0.27, 904800: 0.19, '000000': 0.13, b46c24: 0.11, '24006c': 0.1, '906c6c': 0.08, d89024: 0.05, d8b4b4: 0.03 },
  W: { fcfcfc: 0.44, b4fcfc: 0.41, '00d8fc': 0.13 },
  Q: { '906c6c': 0.36, '000000': 0.33, 482400: 0.17, d8b4b4: 0.06 },
};
const CLOUD = -3.2, BED = -3.6, BOULDERS = [[11.5, 0.6, 1.3], [13.5, 0.6, 1.3]];
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

async function pixels(src) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height);
}
function classify(img, MW, MH) {
  const P = Object.entries(PROTO).map(([c, h]) => [c, new Map(Object.entries(h).map(([k, v]) => [parseInt(k, 16), v]))]), out = [];
  for (let y = 0; y < MH; y++) { const row = []; for (let x = 0; x < MW; x++) {
    const h = new Map(); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4, c = img.data[k] << 16 | img.data[k + 1] << 8 | img.data[k + 2]; h.set(c, (h.get(c) || 0) + 1 / 1024); }
    let best = 'P', bd = 9; for (const [c, p] of P) { let d = 0; for (const k of new Set([...h.keys(), ...p.keys()])) d += Math.abs((h.get(k) || 0) - (p.get(k) || 0)); if (d < bd) { bd = d; best = c; } }
    row.push(best);
  } out.push(row); }
  return out;
}
// the plateaus' earth (the art's speckled orange ground): dry ochre earth, fine grit, broad mottling, a few hairline
// cracks; natural, not saturated (DESIGN.md §2: calm tops)
function earthTex() {
  return T.pbr('beastEarth', 1024, (u, v, o) => {
    const n = T.fbm(u, v, 5, 5, 301), grit = T.pnoise(u * 260, v * 260, 260, 302), grit2 = T.pnoise(u * 90, v * 90, 90, 303), mot = T.fbm(u, v, 2, 3, 304);
    const [w0, w1] = T.worley(u, v, 5, 305, 0.9), crack = T.smooth(0.012, 0.0, w1 - w0) * T.smooth(0.55, 0.7, T.fbm(u, v, 3, 3, 306));
    let c = T.mixc([0.5, 0.29, 0.13], [0.68, 0.43, 0.21], n * 0.55 + mot * 0.45);
    c = T.mixc(c, [0.38, 0.2, 0.08], T.smooth(0.64, 0.84, grit) * 0.4); c = T.mixc(c, [0.78, 0.56, 0.32], T.smooth(0.7, 0.86, grit2) * 0.3);
    c = T.mixc(c, [0.32, 0.17, 0.07], crack * 0.6);
    o.c = c; o.h = 0.45 + n * 0.15 + (grit - 0.5) * 0.08 - crack * 0.2; o.r = 0.93;
  }, 3);
}
// the dry grass patches' ground (under the instanced tufts): straw and olive over the earth
function dryTurf() {
  return T.pbr('beastTurf', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 5, 311), b = T.fbm(u, v, 70, 2, 312), soil = T.smooth(0.6, 0.78, T.fbm(u, v, 4, 3, 313));
    let c = T.mixc([0.36, 0.3, 0.12], [0.6, 0.5, 0.22], n * 0.6 + b * 0.4);
    c = T.mixc(c, [0.55, 0.33, 0.15], soil * 0.5);
    o.c = c; o.h = 0.5 + b * 0.2; o.r = 0.95;
  }, 2);
}
// the cliffs (the art's dark violet rock of rounded lumps, stacked in columns): weathered stones packed in a dark matrix,
// taller than wide, each its own shade from deep violet to dusty mauve, lit on its crown (kit/terrain.js Land lays only
// the colour on the rock), dark in the crevices
function cliffTex() {
  return T.pbr('beastCliff5', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 9, 321, 0.8), gap = w1 - w0 + (T.fbm(u, v, 18, 3, 322) - 0.5) * 0.1, mask = T.smooth(0.38, 0.62, T.fbm(u, v, 4, 3, 326));
    const stone = 1 - (1 - T.smooth(0.0, 0.12, gap)) * mask, n = T.fbm(u, v, 14, 5, 323), big = T.fbm(u, v, 2, 3, 324), streak = T.fbmA(u, v, 24, 3, 4, 325);
    const crown = T.smooth(0.55, 0.0, w0) * mask, ledge = T.smooth(0.08, 0.0, Math.abs(((v * 5 + T.fbm(u, v, 3, 3, 327) * 1.5) % 1) - 0.5) - 0.42);   // (a few weathered ledges across the face)
    let c = T.mixc([0.2, 0.15, 0.21], [0.5, 0.4, 0.46], id * 0.2 * mask + n * 0.35 + streak * 0.25 + big * 0.2);
    c = c.map(q => q * (0.85 + 0.25 * crown - ledge * 0.25));
    c = T.mixc(c.map(q => q * 0.55), c, stone);
    o.c = c; o.h = 0.3 + stone * (0.2 + crown * 0.15) + n * 0.14 + streak * 0.08 - ledge * 0.1; o.r = 0.88;
  }, 5);
}
// the sea of cloud below the plateaus (the art's white and pale cyan billows): soft heaps of cloud, lit on their tops
// by the sun and blue-grey in the hollows, slowly rolling as they drift (a warped noise that changes as it moves);
// layer 0 is the sea itself, the higher layers thin wisps that veil the cliffs' feet
function cloudLayer(layer) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: layer > 0, depthWrite: layer === 0, fog: true });
  const u = m.userData.u = { uTime: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }
      float cf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += cn(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float L = ${layer.toFixed(1)}, t = uTime;
      vec2 p = vWp.xz * (0.11 + L * 0.05) + vec2(t * 0.035, t * 0.012) * (1.0 + L * 0.6) + L * 13.7;
      vec2 q = vec2(cf(p + vec2(0.0, t * 0.02)), cf(p + vec2(5.2, 1.3) - t * 0.017));
      float n = cf(p + q * 1.7), e = 0.06;
      float nx = cf(p + vec2(e, 0.0) + q * 1.7), nz = cf(p + vec2(0.0, e) + q * 1.7);
      vec3 N = normalize(vec3(-(nx - n) / e * 0.9, 1.0, -(nz - n) / e * 0.9));
      float lit = clamp(dot(N, normalize(vec3(-0.45, 0.8, 0.45))), 0.0, 1.0), puff = smoothstep(0.32, 0.78, n);
      vec3 col = mix(vec3(0.36, 0.47, 0.6), vec3(0.88, 0.9, 0.92), clamp(puff * 0.6 + pow(lit, 4.0) * 0.5 - (1.0 - puff) * 0.2, 0.0, 1.0));
      diffuseColor.rgb = col;
      diffuseColor.a = L < 0.5 ? 1.0 : smoothstep(0.5, 0.78, n) * (L < 1.5 ? 0.6 : 0.35);`);
  };
  m.customProgramCacheKey = () => 'beastCloud' + layer;
  return m;
}
// a boulder (the art's two pale rounded stones on the summit): lumpy, rounded, a little flattened, dusted with earth below
function boulder(mat, x, z, y, s, seed) {
  const geo = new THREE.IcosahedronGeometry(1, 4), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 0.82 + 0.32 * T.fbm((v.x + 1) / 2, (v.z + v.y + 2) / 4, 3, 3, seed) + 0.06 * T.fbm((v.x + 1) / 2, (v.y + 1) / 2, 10, 2, seed + 3); p.setXYZ(i, v.x * f, Math.max(-0.3, v.y) * f * 0.8, v.z * f); }
  geo.computeVertexNormals();
  const C = new Float32Array(p.count * 3), nr = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { const yy = p.getY(i), c = 0.78 + 0.22 * Math.max(0, nr.getY(i)), dust = T.smooth(0.0, -0.3, yy); C.set([c * (1 - dust * 0.1), c * (1 - dust * 0.3), c * (1 - dust * 0.45)], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const m = new THREE.Mesh(geo, mat); m.scale.setScalar(s); m.position.set(x, y + s * 0.18, z); m.rotation.y = seed; return shade(m);
}
// the plank bridges (the art's three, planks laid across the way, rails of posts and rope): weathered planks on two
// stringers, each plank a little askew; posts at the ends and every cell or so along both edges, outside the walk, two
// ropes sagging between them
function bridges(cells, H) {
  const g = new THREE.Group(), wood = T.material(T.planks(0x7a5e48, 1), { color: 0xe8dcd0 }), dark = T.material(T.wood(0x4a3426, 'beastBeam'), {});
  const rope = new THREE.MeshStandardMaterial({ color: 0xa89068, roughness: 1 }), seen = new Set(), planks = [], beams = [], posts = [];
  for (const k0 of cells) { if (seen.has(k0)) continue;
    const comp = []; for (const q = [k0]; q.length;) { const k = q.pop(); if (seen.has(k) || !cells.has(k)) continue; seen.add(k); comp.push(k); const [x, y] = k.split(',').map(Number); q.push((x + 1) + ',' + y, (x - 1) + ',' + y, x + ',' + (y + 1), x + ',' + (y - 1)); }
    const xs = comp.map(k => +k.split(',')[0]), ys = comp.map(k => +k.split(',')[1]), x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...ys), z1 = Math.max(...ys) + 1, deck = H.get(comp[0]);
    for (let x = x0 + 0.02; x < x1 - 0.1; x += 0.25) { const p = box(wood, x, deck - 0.06, z0 - 0.04, x + 0.22, deck, z1 + 0.04, 2); p.rotation.y = Math.sin(x * 12.9) * 0.02; p.position.y += Math.sin(x * 7.3) * 0.006 - 0.004; planks.push(p); }
    for (const z of [z0 + 0.12, z1 - 0.12]) beams.push(box(dark, x0 - 0.2, deck - 0.16, z - 0.05, x1 + 0.2, deck - 0.06, z + 0.05, 2));
    const n = Math.max(1, Math.round((x1 - x0) / 1.4)), px = []; for (let i = 0; i <= n; i++) px.push(x0 + 0.05 + (x1 - x0 - 0.1) * i / n);
    for (const z of [z0 - 0.07, z1 + 0.07]) {
      for (const x of px) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 8), dark); c.position.set(x, deck + 0.375 - 0.2, z); posts.push(c); }
      for (const hh of [0.42, 0.2]) { const pts = []; for (let i = 0; i < px.length - 1; i++) for (let j = 0; j < 8; j++) { const f = j / 8; pts.push(new THREE.Vector3(px[i] + (px[i + 1] - px[i]) * f, deck + hh - Math.sin(f * Math.PI) * 0.07, z)); } pts.push(new THREE.Vector3(px[px.length - 1], deck + hh, z));
        g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.013, 5), rope))); }
    }
  }
  if (planks.length) g.add(merged(wood, planks)); if (beams.length) g.add(merged(dark, beams)); if (posts.length) g.add(merged(dark, posts));
  return shade(g);
}
const PAL = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800], [CL.grass]: [0xb49024, 0xd8b448, 0x242400], [CL.rock]: [0x24006c, 0x000000, 0x482400, 0x906c6c, 0xd8b4b4], [CL.water]: [0xfcfcfc, 0xb4fcfc, 0x00d8fc] };

function setFor(src) {
  let LV = null, land = null, at = null, clouds = [], voidH = new Map(), bridgeH = new Map(), slopes = [], props = [], chestG = new Map(), M = null, world = null;
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const MW = D.mapW, MH = D.mapH, terr = D.terrain, art = classify(await pixels(src), MW, MH);
    const walk = (x, y) => terr[y][x] !== 2 && terr[y][x] !== 1;
    // for the levels: the walk earth (bridges too) or steps; blocked: cloud, cliff faces, the bridges' rails
    const cls = art.map((row, y) => row.map((c, x) => walk(x, y) ? (c === 'S' ? 'S' : 'P') : c === 'W' ? 'W' : c === 'Q' ? 'R' : c === 'P' || c === 'G' ? 'R' : 'B'));
    const { h, ramps } = levels(cls, terr, MW, MH, { minWide: 1, bed: BED, deck: 0.6 });
    // a cliff cell stays up only as the face of a step between two walks (walk north of it and south of it, cloud not between);
    // the rest fall away, so the plateaus end in sheer rock over the clouds rather than in flat purple tops
    const reachS = (x, y) => { for (let j = y + 1; j < Math.min(MH, y + 5); j++) { if (walk(x, j)) return true; if (art[j][x] === 'W') return false; } return false; };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!walk(x, y) && cls[y][x] === 'B' && !reachS(x, y)) h[y][x] = BED;
    let lo = 9; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (walk(x, y) && h[y][x] != null) lo = Math.min(lo, h[y][x]);
    const lift = Math.max(0, 0.6 - lo);   // the lowest walk at 0.6: nothing blocked beside it can read as open ground
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (h[y][x] != null && h[y][x] > BED + 0.01) h[y][x] += lift;
    for (const r of ramps) { r.y0 += lift; r.y1 += lift; }
    // over the void a flier hovers at the height of the walk nearby (not down at the clouds, hidden under the cliffs)
    voidH = new Map(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!(h[y][x] > BED + 0.01)) {
      let m = null; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const v = h[y + dy] && h[y + dy][x + dx]; if (v != null && v > BED + 0.01 && (m === null || v > m)) m = v; }
      voidH.set(x + ',' + y, m ?? 0.6); }
    bridgeH = new Map(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (walk(x, y) && art[y][x] === 'Q') bridgeH.set(x + ',' + y, h[y][x]);
    LV = new Levels(MW, MH, 1);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) LV.set(x, y, x + 1, y + 1, h[y][x] ?? BED);
    for (const r of ramps) LV.stairs(r.x0, r.z0, r.x1, r.z1, r.y0, r.y1, Math.max(3, (r.z1 - r.z0) * 3), 's');
    slopes = ramps.flatMap(r => r.cells);
    // the land: a heightfield over the map and past it. Every cell a unit stands on is level at its height; a raised cell
    // no one reaches keeps its height where the art draws earth or grass on it; the rest falls away as cliff from the
    // nearest raised ground down into the clouds over a cell or so (the band the art draws its violet faces in), ragged
    // and broken into crags
    const lay = await readLayout(src, MW, MH, PAL, { [CL.water]: 1.1 }), SR = 4, EX = 8, GW = (MW + EX * 2) * SR, GH = (MH + EX * 2) * SR, LW = MW * SR;
    const bridgeC = new Set(bridgeH.keys()), isBridge = (x, y) => bridgeC.has(x + ',' + y), stood = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && walk(x, y) && !isBridge(x, y);
    const cellUp = (x, y) => { if (y >= MH && x >= 0 && x < MW) y = MH - 1; if (x < 0 || y < 0 || x >= MW || y >= MH || isBridge(x, y) || (art[y][x] === 'Q' && !walk(x, y))) return null; const v = h[y][x]; return v != null && v > BED + 0.01 ? v : null; };
    const artAt = (i, j) => { const x = Math.max(0, Math.min(LW - 1, i)), y = Math.max(0, Math.min(MH * SR - 1, j)); return lay[y * LW + x]; };
    const inRamp = (x, z) => ramps.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1);
    const up = new Float32Array(GW * GH).fill(NaN);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const li = i - EX * SR, lj = j - EX * SR, cx = Math.floor(li / SR), cy = Math.floor(lj / SR), a = artAt(li, lj), c = cellUp(cx, cy);
      if (stood(cx, cy)) up[j * GW + i] = inRamp((i + 0.5) / SR - EX, (j + 0.5) / SR - EX) ? LV.at((i + 0.5) / SR - EX, (j + 0.5) / SR - EX) : h[cy][cx];
      else if (c != null && (a === CL.ground || a === CL.grass)) up[j * GW + i] = c;
      else if (c == null && (a === CL.ground || a === CL.grass) && !isBridge(cx, cy)) { let m = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = cellUp(cx + dx, cy + dy); if (v != null && (m === null || v > m)) m = v; } if (m != null) up[j * GW + i] = m; }
    }
    // the rest: from every raised sample within reach, a cliff falling from its height (to the clouds over a cell or so);
    // the highest wins, so a cliff between two levels lands on the lower one instead of dropping into a pit before it
    const field = new Float32Array(GW * GH).fill(BED), srcH = new Float32Array(GW * GH).fill(BED), wrap = v => ((v / 9) % 1 + 1) % 1, RD = 7;
    const jit = new Float32Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) jit[j * GW + i] = (T.fbm(wrap((i + 0.5) / SR), wrap((j + 0.5) / SR), 9, 3, 331) - 0.5) * 0.5;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i;
      if (!isNaN(up[k])) { field[k] = srcH[k] = up[k]; continue; }
      for (let b = Math.max(0, j - RD); b <= Math.min(GH - 1, j + RD); b++) for (let a = Math.max(0, i - RD); a <= Math.min(GW - 1, i + RD); a++) { const q = b * GW + a, u = up[q]; if (isNaN(u)) continue;
        const d = Math.hypot(a - i, b - j) / SR + jit[k], v = u - (u - BED) * T.smooth(0.05, 1.3, d); if (v > field[k]) { field[k] = v; srcH[k] = u; } }
    }
    const fieldAt = (x, z) => { const fx = Math.max(0, Math.min(GW - 1.001, (x + EX) * SR - 0.5)), fz = Math.max(0, Math.min(GH - 1.001, (z + EX) * SR - 0.5)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, F = (a, b) => field[b * GW + a];
      return (F(i, j) * (1 - tx) + F(i + 1, j) * tx) * (1 - tz) + (F(i, j + 1) * (1 - tx) + F(i + 1, j + 1) * tx) * tz; };
    at = (x, z) => { const cx = Math.floor(x), cz = Math.floor(z); if (inRamp(x, z)) return LV.at(x, z); if (stood(cx, cz)) return h[cz][cx]; return fieldAt(x, z); };
    // the layout for the land's look: earth and grass on the raised ground as the art draws it, rock everywhere else
    const look = new Uint8Array(LW * MH * SR);
    for (let j = 0; j < MH * SR; j++) for (let i = 0; i < LW; i++) { const k = (j + EX * SR) * GW + i + EX * SR, a = lay[j * LW + i]; look[j * LW + i] = isNaN(up[k]) ? CL.rock : a === CL.grass ? CL.grass : CL.ground; }
    land = new Land({ w: MW, h: MH, layout: look, ext: EX, outside: (x, z) => z >= MH && x >= 0 && x < MW ? null : CL.rock,
      tex: { dirt: earthTex(), turf: dryTurf(), rock: cliffTex() }, tint: { dirt: 0xffffff, turf: 0xffffff, rock: 0xffffff } });
    // under the stairs the land sinks below their foot: at the treads' own heights it fought them for the same pixels
    // and the steps flickered (units stand on `at`; this is only the land's surface)
    const underStairs = (x, z) => ramps.find(r => x > r.x0 + 0.01 && x < r.x1 - 0.01 && z > r.z0 + 0.01 && z < r.z1 - 0.01);
    land.at = (x, z) => { const r = underStairs(x, z); return r ? Math.min(r.y0, r.y1) - 0.15 : at(x, z); };
    const mesh = land.mesh({ res: 8, dirtK: 0.28, turfK: 0.35, rockK: 0.42, bed: 0x5a6a88 }); S.add(mesh);
    { // crags: the cliffs broken up finer than the field, bulging in and out as they fall; never where a unit stands
      const p = mesh.geometry.attributes.position, open = (x, z) => [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].some(([a, b]) => stood(Math.floor(x + a), Math.floor(z + b)) || isBridge(Math.floor(x + a), Math.floor(z + b)) || inRamp(x + a, z + b));
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (open(x, z)) continue;
        const fi = Math.max(0, Math.min(GW - 1, Math.floor((x + EX) * SR))), fj = Math.max(0, Math.min(GH - 1, Math.floor((z + EX) * SR))), drop = srcH[fj * GW + fi] - y, f = T.smooth(0.0, 0.4, drop);
        const bulge = (T.fbm(wrap(x + y * 0.3), wrap(z - y * 0.2), 5, 3, 341) - 0.5) * 0.5 * T.smooth(0.3, 1.5, drop);
        p.setXYZ(i, x + ((T.fbm(wrap(x), wrap(z + y), 24, 3, 342) - 0.5) * 0.22 + bulge) * f, y + (T.fbm(wrap(x + y), wrap(z), 28, 3, 343) - 0.5) * 0.16 * f, z + ((T.fbm(wrap(x + y), wrap(z), 24, 3, 344) - 0.5) * 0.22 + bulge) * f); }
      mesh.geometry.computeVertexNormals();
    }
    // the steps cut in the cliffs
    const tread = T.material(earthTex(), { color: 0xd8c8c0 }, [0.6, 0.6]), riser = T.material(cliffTex(), {}, [1, 1]);
    for (const r of LV.ramps) S.add(stairs(r, tread, riser, 0.6));
    S.add(bridges(bridgeC, bridgeH));
    // the sea of cloud, and wisps over it
    clouds = [0, 1, 2].map(L => { const c = new THREE.Mesh(new THREE.PlaneGeometry(MW + 90, MH + 90).rotateX(-Math.PI / 2), cloudLayer(L)); c.position.set(MW / 2, CLOUD + L * 0.75, MH / 2); c.renderOrder = L; S.add(c); return c; });
    const stone = T.material(T.rock(0xb4a8a4, 'beastBoulder2', 0.3), { vertexColors: true, roughness: 0.8 }, [0.6, 0.6]);
    props = []; for (const [x, z, s] of BOULDERS) { S.add(boulder(stone, x, z, h[Math.floor(z)][Math.floor(x)] ?? 0.6, s * 0.28, x)); props.push([Math.floor(x), Math.floor(z)]); }
    const tufts = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (walk(x, y) && !isBridge(x, y)) for (let j = 0; j < SR; j++) for (let i = 0; i < SR; i++) if (lay[(y * SR + j) * LW + x * SR + i] === CL.grass && R(x * 31 + y * 7 + i * 3 + j) < 0.45) { const px = x + (i + R(x + y * 3 + i * 5 + j)) / SR, pz = y + (j + R(x * 5 + y + i + j * 7)) / SR; tufts.push([px, at(px, pz), pz]); }
    if (tufts.length) S.add(grass(tufts, { size: 0.32, cols: ['#8a7428', '#6e5c20', '#a08a34', '#5a4a1a'] }));
    const chests = D.rooms && G.chests ? G.chests : (G.chests || (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false })));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, ground(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    props = props.concat(chests.map(c => [c.x, c.y]));
    E.world.updaters.push((dt, t) => { for (const c of clouds) c.material.userData.u.uTime.value = t; windTick(t); });
    void FX;
  }
  function ground(x, z) { if (!LV || !at) return 0; const k = Math.floor(x) + ',' + Math.floor(z), b = bridgeH.get(k); if (b != null) return b; return LV.at(x, z) <= BED + 0.01 ? (voidH.get(k) ?? 0.6) : at(x, z); }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, ground(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground, get slopes() { return slopes; }, get props() { return props; },
    // high, clear and bright above the clouds
    mood: { bg: 0xb8e0f0, voidCol: false, fog: 0xd0eaf4, fogD: 0.006, sky: 0xe8f6ff, under: 0x6a5a4a, hemi: 1.05,
      sun: 0xfff6e8, sunI: 2.8, sunDir: [-0.45, 0.8, 0.45], sat: 1.05, exposure: 0.95, bloom: 0.1, aoR: 0.8,
      env: { top: 0xd8eeff, mid: 0xb09070, low: 0x5a4a3a, lights: [[-6, 8, 4, 0xfff6e8, 3]] } },
  };
}
export const beastMount = setFor('assets/maps/0f53e0.png');
