// 沁蓮園, 聞太師's treasure garden of lotus ponds (battle 17's eight rooms; scene 35's maps 0f3b58 = room 2 and 0f3b98 =
// room 0), remade from each room's own art and terrain, as all eight share one tileset: walkways and terraces of large
// worn limestone flags over dark ponds of lily pads and lotus buds, faced with damp brick, edged with balustrades of
// turned posts and carved panels, fluted drum columns, stairs between the levels, grass banks with shingle shores (room
// 2's meadow). The tops are one material: the flags where paved, grass, shingle and the ponds' bed by the cells' classes.
//   classify  each cell of the art by its colours against the tileset's surfaces (PROTO: the share of each palette colour
//             in a cell of water, grass, pebble bank, flagstone, stairs, balustrade, brick face, column; measured on rooms
//             0, 2 and 4) and the battle's terrain (walkable or not)
//   levels    the walkable cells fall into regions joined by stair runs (at least two cells wide, ground at both ends);
//             a run climbs north (the treads face the camera), STEP a row: the grass lies at 0, a region the stairs lead up
//             to above it; a walkway with no stairs stands DECK over the water. Blocked cells: water down to the bed, a
//             balustrade or column at the height of the walk beside it, a brick face at the height of the walk behind it
// lotus(src) makes one room's set: src the room's art (assets/battles/17/room-K.png, or a scene's map).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { grass, shrubs, windTick } from '../kit/terrain.js';
import { sprigTex } from './seacave.js';
import { D, G } from '../rules.js';

const PROTO = {
  R: { 242400: 0.19, 242448: 0.03, '000000': 0.41, '6c4824': 0.16, b4b490: 0.11, fcfcd8: 0.07 },
  B: { 242400: 0.38, '000000': 0.27, '6c4824': 0.25, b4b490: 0.09 },
  C: { 242400: 0.19, '6c4824': 0.32, '000000': 0.28, b4b490: 0.16, fcfcd8: 0.05 },
  P: { 242400: 0.09, b4b490: 0.42, '6c4824': 0.34, fcfcd8: 0.15 },
  S: { 242400: 0.31, '000000': 0.33, '6c4824': 0.17, b4b490: 0.13, fcfcd8: 0.05 },
  W: { 242448: 0.42, '000000': 0.41, '24486c': 0.14 },
  G: { '002400': 0.6, '906c00': 0.21, b49024: 0.1, '6c4824': 0.03, b4b490: 0.03 },
  K: { 242400: 0.07, 242448: 0.09, b4b490: 0.39, '6c4824': 0.2, fcfcd8: 0.09, '000000': 0.08, '24486c': 0.03, '002400': 0.03 },
};
// the carved drum's two cells (the art repeats them exactly): a cell is a column only near one of these; a balustrade's
// end post (more pale stone) reads as one otherwise
const DRUM = [{ '6c4824': 0.34, '000000': 0.28, b4b490: 0.17, 242400: 0.16, fcfcd8: 0.05 }, { '6c4824': 0.3, '000000': 0.29, 242400: 0.22, b4b490: 0.14, fcfcd8: 0.05 }];
const PAD = 0x90b400, PAD2 = 0xfcfc00, BUD = 0xd84848;   // lily pads, lotus buds (in water cells)
const WATER = -0.3, BED = -0.75, STEP = 0.22, DECK = 0.45, RAIL = 0.55;
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

async function pixels(src) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height);
}
// every cell's class and its pads and buds (cell-relative points)
function classify(img, MW, MH) {
  const P = Object.entries(PROTO).map(([c, h]) => [c, new Map(Object.entries(h).map(([k, v]) => [parseInt(k, 16), v]))]);
  const DRUMS = DRUM.map(h => new Map(Object.entries(h).map(([k, v]) => [parseInt(k, 16), v]))), cls = [], pads = [], buds = [];
  for (let y = 0; y < MH; y++) { const row = []; for (let x = 0; x < MW; x++) {
    const h = new Map(); let pad = [0, 0, 0], bud = [0, 0, 0];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const k = ((y * 32 + j) * img.width + x * 32 + i) * 4, c = img.data[k] << 16 | img.data[k + 1] << 8 | img.data[k + 2];
      h.set(c, (h.get(c) || 0) + 1 / 1024);
      if (c === PAD || c === PAD2) { pad[0] += i; pad[1] += j; pad[2]++; } else if (c === BUD) { bud[0] += i; bud[1] += j; bud[2]++; }
    }
    let best = 'P', bd = 9;
    for (const [c, p] of P) { let d = 0; for (const k of new Set([...h.keys(), ...p.keys()])) d += Math.abs((h.get(k) || 0) - (p.get(k) || 0)); if (d < bd) { bd = d; best = c; } }
    if (best === 'C') { let dm = 9; for (const p of DRUMS) { let d = 0; for (const k of new Set([...h.keys(), ...p.keys()])) d += Math.abs((h.get(k) || 0) - (p.get(k) || 0)); dm = Math.min(dm, d); } if (dm > 0.15) best = 'R'; }
    row.push(best);
    if (best === 'W' && pad[2] > 25) pads.push([x + pad[0] / pad[2] / 32, y + pad[1] / pad[2] / 32, pad[2]]);
    if (best === 'W' && bud[2] > 6) buds.push([x + bud[0] / bud[2] / 32, y + bud[1] / bud[2] / 32]);
  } cls.push(row); }
  return { cls, pads, buds };
}
// the levels: per cell a height, the stair runs (as Levels ramps), the regions
export function levels(cls, terr, MW, MH, o = {}) {   // o: minWide (a stair run's least width, 2), bed (the drop's foot, BED), deck (DECK)
  const minWide = o.minWide ?? 2, bed = o.bed ?? BED, deck = o.deck ?? DECK;
  const walk = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && terr[y][x] !== 2 && terr[y][x] !== 1;
  const kind = (x, y) => cls[y][x] === 'G' || cls[y][x] === 'K' ? 'G' : cls[y][x] === 'S' ? 'S' : 'P';
  const k = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, (_, x) => walk(x, y) ? kind(x, y) : null));
  const comps = test => { const id = Array.from({ length: MH }, () => new Array(MW).fill(-1)), out = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (id[y][x] >= 0 || !test(x, y)) continue;
      const c = [], q = [[x, y]]; id[y][x] = out.length;
      while (q.length) { const [a, b] = q.pop(); c.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy; if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && id[ny][nx] < 0 && test(nx, ny)) { id[ny][nx] = out.length; q.push([nx, ny]); } } }
      out.push(c); }
    return { id, out }; };
  for (let y = MH - 2; y >= 0; y--) for (let x = 0; x < MW; x++) if (k[y][x] === 'P' && (cls[y][x] === 'C' || cls[y][x] === 'R') && k[y + 1][x] === 'S') k[y][x] = 'S';   // a stair's top tread reads like a column's shadowed stone
  // stair runs: two cells wide or more, walkable ground beyond both ends (north and south); the rest is flagstone
  const S = comps((x, y) => k[y][x] === 'S'), runs = [];
  for (const c of S.out) {
    const xs = c.map(p => p[0]), ys = c.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
    const wide = Math.max(...[...new Set(ys)].map(y => c.filter(p => p[1] === y).length)) >= minWide;
    const north = c.some(([x, y]) => y === y0 && walk(x, y0 - 1) && k[y0 - 1][x] !== 'S'), south = c.some(([x, y]) => y === y1 - 1 && walk(x, y1) && k[y1][x] !== 'S');
    if (wide && north && south) runs.push({ cells: c, x0, x1, y0, y1 }); else for (const [x, y] of c) k[y][x] = 'P';
  }
  const Rg = comps((x, y) => k[y][x] && k[y][x] !== 'S'), H = Rg.out.map(() => null);
  const edges = runs.map(r => {   // the region north of the run and the one south of it (by the cells beyond its ends)
    const at = (x, y) => (y >= 0 && y < MH && Rg.id[y][x] >= 0 ? Rg.id[y][x] : -1);
    const n = r.cells.map(([x, y]) => y === r.y0 ? at(x, y - 1) : -1).find(v => v >= 0), s = r.cells.map(([x, y]) => y === r.y1 - 1 ? at(x, y + 1) : -1).find(v => v >= 0);
    return { r, n, s, rise: (r.y1 - r.y0) * STEP };
  });
  const greens = Rg.out.map(c => c.filter(([x, y]) => k[y][x] === 'G').length);
  // the seed: grass first (the most), else a walk at the foot of the stairs (no stairs lead down from it... into it from below), the biggest
  const foot = i => !edges.some(e => e.n === i && e.s != null && H[e.s] === null);
  const seedOf = () => { let best = -1; const score = i => (greens[i] ? 1e6 + greens[i] : 0) + (foot(i) ? 1e4 : 0) + Rg.out[i].length;
    for (let i = 0; i < H.length; i++) if (H[i] === null && (best < 0 || score(i) > score(best))) best = i; return best; };
  const linked = new Set(edges.flatMap(e => [e.n, e.s]));
  const nearH = i => {   // a walk no stairs lead to: the height of the nearest walk already placed (within 3 cells), else DECK
    let best = null, bd = 9;
    for (const [x, y] of Rg.out[i]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= MH || xx >= MW) continue; const j = Rg.id[yy][xx]; if (j < 0 || j === i || H[j] === null) continue;
      const d = Math.abs(dx) + Math.abs(dy) + (greens[j] > Rg.out[j].length / 2 && greens[i] <= Rg.out[i].length / 2 ? 4 : 0); if (d < bd) { bd = d; best = H[j]; } }   // (a paved pocket keeps to the paving)
    return best;
  };
  for (let s = seedOf(); s >= 0; s = seedOf()) {
    H[s] = greens[s] > Rg.out[s].length / 2 ? 0 : (!linked.has(s) && nearH(s) !== null ? nearH(s) : deck); const q = [s];
    while (q.length) { const a = q.pop(); for (const e of edges) {
      if (e.s === a && e.n != null && H[e.n] === null) { H[e.n] = H[a] + e.rise; q.push(e.n); }
      if (e.n === a && e.s != null && H[e.s] === null) { H[e.s] = Math.max(H[a] - e.rise, greens[e.s] ? 0 : 0.15); q.push(e.s); }
    } }
  }
  const h = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, (_, x) => Rg.id[y][x] >= 0 ? H[Rg.id[y][x]] : null));
  const ramps = edges.filter(e => e.n != null && e.s != null).map(e => ({ x0: e.r.x0, z0: e.r.y0, x1: e.r.x1, z1: e.r.y1, y0: H[e.s], y1: H[e.n], cells: e.r.cells }));
  for (const rp of ramps) for (const [x, y] of rp.cells) h[y][x] = (rp.y0 + rp.y1) / 2;
  // blocked cells: water to the bed; balustrades and columns at the walk beside them; brick faces at the walk behind (north)
  const near = (x, y) => { let m = null; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = y + dy >= 0 && y + dy < MH && x + dx >= 0 && x + dx < MW ? h[y + dy][x + dx] : null; if (v !== null && walk(x + dx, y + dy) && (m === null || v > m)) m = v; } return m; };
  for (let pass = 0; pass < 3; pass++) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (walk(x, y) || (h[y][x] !== null && pass === 0)) continue;
    const c = cls[y][x];
    if (c === 'W') { h[y][x] = bed; continue; }
    if (c === 'G' || c === 'K') { h[y][x] = c === 'K' ? -0.05 : 0; continue; }
    if (c === 'B') { let v = null; for (let j = y - 1; j >= 0 && v === null; j--) if (walk(x, j)) v = h[j][x]; else if (cls[j][x] === 'W') break; h[y][x] = v ?? near(x, y) ?? deck; continue; }
    const v = near(x, y); if (v !== null) h[y][x] = v; else if (pass === 2) h[y][x] = deck;
  }
  return { h, ramps, walk };
}

// the pond's water: a deep blue-green, rippled by drifting noise so the sky glints off it, its two blues swapped now and
// then as the original cycles them (every 9 frames, 0x0F3BD8) [a gentle breathing here]
function pondWater() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0e2238, roughness: 0.12, metalness: 0, envMapIntensity: 0.35 });
  const u = m.userData.u = { uTime: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime;
      float lh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ln(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lh(i), lh(i + vec2(1, 0)), f.x), mix(lh(i + vec2(0, 1)), lh(i + vec2(1, 1)), f.x), f.y); }
      float lf(vec2 p){ return ln(p) * 0.6 + ln(p * 2.3 + 4.1) * 0.3 + ln(p * 5.1 + 9.7) * 0.1; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec2 wp = vWp.xz * 1.4; float e = 0.04, t = uTime * 0.25;
      float a = lf(wp + vec2(t, t * 0.6)), ax = lf(wp + vec2(e, 0.0) + vec2(t, t * 0.6)), az = lf(wp + vec2(0.0, e) + vec2(t, t * 0.6));
      vec3 wN = normalize(vec3(-(ax - a) / e * 0.06, 1.0, -(az - a) / e * 0.06));
      normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec3 vv = normalize(cameraPosition - vWp); float fres = pow(1.0 - clamp(dot(vec3(0.0, 1.0, 0.0), vv), 0.0, 1.0), 3.0);
      float cyc = 0.5 + 0.5 * sin(uTime * 1.6 + lf(vWp.xz * 0.3) * 6.0);
      totalEmissiveRadiance += vec3(0.05, 0.11, 0.16) * (0.6 + 0.4 * cyc) + vec3(0.35, 0.45, 0.55) * fres * 0.5;`);
  };
  m.customProgramCacheKey = () => 'lotusWater';
  return m;
}
// the walk's paving (the art's pale cream squares, two by two a cell): large worn limestone flags, each its own shade,
// bevelled and chipped at the edges, grime in the joints, a crack here and there; calm (DESIGN.md §2: large, flat, worn)
function flagTex() {   // one repeat = two cells (LV.mesh k 0.5): four flags across
  return T.pbr('lotusFlag3', 1024, (u, v, o) => {
    const fu = u * 4, fv = v * 4, iu = Math.floor(fu), iv = Math.floor(fv), x = fu - iu, y = fv - iv;
    const id = T.pnoise(iu, iv, 4, 201, 4), id2 = T.pnoise(iu + 0.5, iv + 0.5, 4, 202, 4);
    const chip = (T.fbm(u, v, 28, 3, 203) - 0.5) * 0.04, e = Math.min(x, 1 - x, y, 1 - y) + chip;
    const joint = T.smooth(0.03, 0.012, e), bevel = T.smooth(0.0, 0.09, e);
    const grain = T.pnoise(u * 300, v * 300, 300, 204), cloud = T.fbm(u, v, 5, 4, 205), wear = T.fbm(u, v, 14, 3, 206);
    const [w0, w1] = T.worley(u, v, 7, 207, 0.9), crack = id2 > 0.8 ? T.smooth(0.01, 0.0, w1 - w0) * T.smooth(0.04, 0.1, e) : 0;
    let c = T.mixc([0.52, 0.49, 0.4], [0.7, 0.66, 0.55], id * 0.6 + cloud * 0.4);
    c = T.mixc(c, [0.5, 0.45, 0.34], T.smooth(0.6, 0.8, grain) * 0.3);
    c = T.mixc(c, [0.46, 0.42, 0.32], T.smooth(0.16, 0.0, e) * 0.35 + T.smooth(0.58, 0.8, T.fbm(u, v, 3, 3, 208)) * 0.2);   // grime toward the joints, and in broad patches
    c = T.mixc(c, c.map(q => q * 0.8), 1 - bevel); c = T.mixc(c, [0.3, 0.26, 0.18], crack * 0.7); c = T.mixc(c, [0.26, 0.23, 0.17], joint * 0.8);
    o.c = c; o.h = 0.3 + bevel * 0.45 + (wear - 0.5) * 0.08 - crack * 0.25 - joint * 0.2; o.r = 0.8 - bevel * (1 - cloud) * 0.15 + joint * 0.12;
  }, 3);
}
// the pebble shore (the art's pale banks between the meadow and the ponds): fine grey shingle, a few flat stones, damp
function shingleTex() {
  return T.pbr('lotusShingle', 512, (u, v, o) => {
    const n = T.fbm(u, v, 40, 3, 211), big = T.fbm(u, v, 4, 3, 212), [w0, w1, id] = T.worley(u, v, 9, 213, 0.9), flat = T.smooth(0.0, 0.08, w1 - w0) * T.smooth(0.7, 0.85, id);
    let c = T.mixc([0.42, 0.4, 0.34], [0.6, 0.58, 0.5], n * 0.6 + big * 0.4);
    c = T.mixc(c, [0.66, 0.64, 0.56], flat * 0.5);
    o.c = c; o.h = 0.4 + n * 0.2 + flat * 0.2; o.r = 0.85 - flat * 0.1;
  }, 2);
}
// the faces under the walks (the art's dark brown courses): long fired bricks, worn and bevelled, each its own shade,
// darker mortar; DAMP darkens them toward the waterline
function brickTex() {   // five courses a unit, two bricks across
  return T.pbr('lotusBrick3', 1024, (u, v, o) => {
    const rows = 5, ry = Math.floor(v * rows), fy = v * rows - ry, bx = u * 2 + (ry % 2) * 0.5, ix = Math.floor(bx), fx = bx - ix;
    const id = T.pnoise(((ix % 2) + 2) % 2, ry, 2, 221, rows), chip = (T.fbm(u, v, 24, 3, 222) - 0.5) * 0.05;
    const e = Math.min(Math.min(fx, 1 - fx) * 2 / rows * 2.5, Math.min(fy, 1 - fy)) + chip, mortar = T.smooth(0.07, 0.035, e), bevel = T.smooth(0.03, 0.2, e);
    const n = T.fbm(u, v, 10, 4, 223), grain = T.pnoise(u * 200, v * 200, 200, 224);
    let c = T.mixc([0.3, 0.22, 0.15], [0.48, 0.36, 0.25], id * 0.6 + n * 0.4);
    c = T.mixc(c, [0.22, 0.16, 0.1], T.smooth(0.62, 0.82, grain) * 0.3);
    c = T.mixc(c, c.map(q => q * 0.78), 1 - bevel); c = T.mixc(c, [0.16, 0.13, 0.1], mortar);
    o.c = c; o.h = 0.3 + bevel * 0.4 + n * 0.08 - mortar * 0.25; o.r = 0.85;
  }, 3);
}
// pale carved limestone (the balustrades' posts, caps and panels, the stair treads): fine grain, faint cloud
function stoneTex() {
  return T.pbr('lotusStone', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 231), g = T.pnoise(u * 160, v * 160, 160, 232), p = T.smooth(0.6, 0.8, T.fbm(u, v, 3, 3, 233));
    let c = T.mixc([0.66, 0.63, 0.53], [0.8, 0.77, 0.66], n);
    c = T.mixc(c, [0.54, 0.5, 0.4], T.smooth(0.62, 0.82, g) * 0.3 + p * 0.25);
    o.c = c; o.h = 0.5 + n * 0.1 + g * 0.04; o.r = 0.72;
  }, 1);
}
// a balustrade panel's face (BoxGeometry's own 0..1 on each face): a recessed field in a raised frame, a carved rosette
function panelTex() {
  return T.pbr('lotusPanel3', 512, (u, v, o) => {
    const ex = Math.min(u, 1 - u) * 2.2, ey = Math.min(v, 1 - v), e = Math.min(ex, ey), frame = T.smooth(0.16, 0.12, e), lip = T.smooth(0.1, 0.13, e) * T.smooth(0.17, 0.14, e);
    const dx = (u - 0.5) * 2.2, dy = v - 0.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const petal = T.smooth(0.3, 0.26, r / (0.75 + 0.25 * Math.cos(a * 8))) * T.smooth(0.0, 0.04, r), eye = T.smooth(0.07, 0.05, r);
    const n = T.fbm(u, v, 6, 4, 241), g = T.pnoise(u * 120, v * 120, 120, 242);
    let c = T.mixc([0.66, 0.63, 0.53], [0.8, 0.77, 0.66], n);
    c = T.mixc(c, [0.54, 0.5, 0.4], T.smooth(0.62, 0.82, g) * 0.3);
    const field = 1 - frame, relief = Math.max(petal * 0.8, eye);
    c = c.map(q => q * (1 - field * 0.18 + relief * 0.14 - lip * 0.25));
    o.c = c; o.h = 0.5 + frame * 0.3 + relief * 0.18 * field + n * 0.04; o.r = 0.72;
  }, 4);
}
// the carved drums' stone (the art's brown-and-pale barrel columns): warm sandstone, grain, weathered darker below
function drumTex() {
  return T.pbr('lotusDrum2', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 251), g = T.pnoise(u * 180, v * 180, 180, 252), streak = T.fbmA(u, v, 30, 3, 3, 253);
    let c = T.mixc([0.42, 0.33, 0.22], [0.62, 0.5, 0.35], n * 0.6 + streak * 0.4);
    c = T.mixc(c, [0.3, 0.23, 0.15], T.smooth(0.62, 0.82, g) * 0.35 + T.smooth(0.3, 0.0, v) * 0.35);
    o.c = c; o.h = 0.5 + n * 0.1 + streak * 0.08; o.r = 0.78;
  }, 1.5);
}
// the floors' tops in one material: the flags (the map, its relief and roughness) where a cell is paved; grass, shingle
// and the ponds' dark bed blended by the cells' classes (a texture of them, a soft copy warped by noise for the natural
// edges) and laid in world space
function topMat(cls, MW, MH) {
  const d = new Uint8Array(MW * MH * 4);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const k = cls[y][x], i = (y * MW + x) * 4; d[i + (k === 'G' ? 1 : k === 'K' ? 2 : k === 'W' ? 3 : 0)] = 255; }
  const hard = new THREE.DataTexture(d, MW, MH, THREE.RGBAFormat); hard.needsUpdate = true;
  const soft = new THREE.DataTexture(d, MW, MH, THREE.RGBAFormat); soft.magFilter = soft.minFilter = THREE.LinearFilter; soft.needsUpdate = true;
  const m = T.material(flagTex(), {}), U = { uHard: { value: hard }, uSoft: { value: soft }, uSize: { value: new THREE.Vector2(MW, MH) },
    uTurf: { value: T.turf(0x56702a).map }, uShin: { value: shingleTex().map }, uBed: { value: new THREE.Color(0x0c140f) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform sampler2D uHard, uSoft, uTurf, uShin; uniform vec2 uSize; uniform vec3 uBed; float gPav;
      float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec2 cu = vWp.xz / uSize; float nz = tn(vWp.xz * 2.3) * 0.6 + tn(vWp.xz * 7.0) * 0.4;
      gPav = texture2D(uHard, cu).r;
      vec4 cs = texture2D(uSoft, cu + (vec2(nz, tn(vWp.zx * 2.3 + 5.0)) - 0.5) * 0.7 / uSize);
      vec3 tf = texture2D(uTurf, vWp.xz * 0.35).rgb * (0.85 + 0.3 * tn(vWp.xz * 0.7)), shg = texture2D(uShin, vWp.xz * 0.45).rgb;
      float sw = smoothstep(0.35, 0.65, cs.b / max(0.001, cs.g + cs.b + cs.a) + (nz - 0.5) * 0.5), ww = smoothstep(0.45, 0.75, cs.a + (nz - 0.5) * 0.4);
      vec3 nat = mix(mix(tf, shg, sw), uBed, ww);
      diffuseColor.rgb = mix(nat, diffuseColor.rgb, gPav);`)
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * gPav;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n      roughnessFactor = mix(0.95, roughnessFactor, gPav);');
  };
  m.customProgramCacheKey = () => 'lotusTop';
  return m;
}
// the brick faces: darker and greener toward the waterline, as stone stays wet there
function damp(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; float dh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float dn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(dh(i), dh(i+vec2(1,0)), f.x), mix(dh(i+vec2(0,1)), dh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float wn = dn(vec2(vWp.x + vWp.z, vWp.y * 3.0) * 4.0), wet = 1.0 - smoothstep(${WATER.toFixed(2)} + 0.04, ${WATER.toFixed(2)} + 0.3 + wn * 0.12, vWp.y);
      diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - wet * 0.45), vec3(0.07, 0.1, 0.05), wet * 0.3 * wn);`);
  };
  m.customProgramCacheKey = () => 'lotusDamp';
  return m;
}
// a balustrade post (the art's round posts with a ball on top): turned stone, plinth, shaft, collar, finial
function postGeo() {
  const pts = [[0, 0], [0.12, 0], [0.12, 0.05], [0.1, 0.07], [0.085, 0.09], [0.075, 0.12], [0.075, 0.38], [0.085, 0.4], [0.105, 0.42], [0.105, 0.46], [0.08, 0.48], [0.05, 0.52]];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + 0.75 + (Math.PI / 2 - 0.75 + Math.PI / 2) * i / 8; pts.push([Math.max(0.0001, 0.078 * Math.cos(a)), 0.6 + 0.078 * Math.sin(a)]); }
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20);
}
// a carved drum column (the art's banded barrel columns): a fluted shaft between two carved bands, a moulded base and
// capital
function column(stone, x, z, y) {
  const g = new THREE.Group(), H = 1.0, shaft = new THREE.CylinderGeometry(0.27, 0.285, H, 48, 30), p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), py = p.getY(i) + H / 2, r = Math.hypot(px, pz); if (r < 1e-3) continue;
    const a = Math.atan2(pz, px), band = (py > 0.2 && py < 0.3) || (py > 0.72 && py < 0.82), groove = band ? 0 : Math.pow(0.5 + 0.5 * Math.cos(a * 14), 4) * 0.09;
    const k = (band ? 1.04 + 0.012 * Math.cos(a * 20) : 1) - groove; p.setXYZ(i, px * k, p.getY(i), pz * k); }
  shaft.computeVertexNormals();
  const s = new THREE.Mesh(shaft, stone); s.position.y = 0.16 + H / 2; g.add(s);
  const lathe = pts => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, q]) => new THREE.Vector2(r, q)), 48), stone);
  g.add(lathe([[0.001, 0], [0.38, 0], [0.38, 0.06], [0.35, 0.08], [0.33, 0.1], [0.34, 0.12], [0.3, 0.14], [0.285, 0.16]]));
  const cap = lathe([[0.27, 0], [0.3, 0.02], [0.31, 0.05], [0.29, 0.07], [0.34, 0.1], [0.38, 0.12], [0.38, 0.18], [0.001, 0.18]]); cap.position.y = 0.16 + H; g.add(cap);
  g.position.set(x, y, z); return shade(g);
}
// a lily pad's leaf: round with its notch, veins from the stem out, a paler waxy rim (alpha outside the leaf)
function padTex() {
  return T.pbr('lotusPad', 256, (u, v, o) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx), notch = Math.abs(a) < 0.12 + (1 - r) * 0.05 && r > 0.04;
    const vein = T.smooth(0.12, 0.0, Math.abs(Math.sin(a * 11)) * r * 6) * T.smooth(0.05, 0.2, r), n = T.fbm(u, v, 8, 3, 261);
    let c = T.mixc([0.17, 0.3, 0.08], [0.3, 0.46, 0.13], n * 0.6 + r * 0.3);
    c = T.mixc(c, [0.42, 0.55, 0.2], vein * 0.35 + T.smooth(0.86, 0.96, r) * 0.3);
    o.c = c; o.a = r < 0.97 && !notch ? 1 : 0; o.h = 0.5 - vein * 0.15; o.r = 0.4;
  }, 1);
}
// a lotus bud (the art's red buds standing out of the ponds): five petals closed to a point, pale green at the base
// flushing to deep pink at the tip, on a curved stem
function budGeo() {
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.max(0.0005, 0.07 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.7) * (1 - 0.45 * t)), t * 0.24)); }
  const g = new THREE.LatheGeometry(pts, 20), p = g.attributes.position, C = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), t = y / 0.24, a = Math.atan2(z, x), k = 1 + 0.12 * Math.abs(Math.cos(a * 2.5)) * Math.sin(Math.PI * t);
    p.setXYZ(i, x * k, y, z * k);
    const c = t < 0.35 ? T.mixc([0.62, 0.72, 0.42], [0.95, 0.72, 0.72], t / 0.35) : T.mixc([0.95, 0.72, 0.72], [0.78, 0.16, 0.26], (t - 0.35) / 0.65); C.set(c, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
}

export function lotus(src) {
  let LV = null, slopes = [], props = [], world = null, M = null, chestG = new Map();
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const MW = D.mapW, MH = D.mapH, img = await pixels(src), { cls, pads, buds } = classify(img, MW, MH), terr = D.terrain;
    const { h, ramps, walk } = levels(cls, terr, MW, MH);
    // blocked cells low enough to read as open ground: a pebble shore sinks toward the water; the rest are held by a
    // model (balustrade, column, or a bush on grass) and listed as props (tools/qa/sets.js)
    const low = [], bushes = [];
    // a small pocket of walkable ground the rest of the walk never joins (room 2's grass corner at (22, 0-5)): no one stands
    // there, so it is decoration (bushes on its grass), not open ground
    { const seen = new Set();
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (!walk(x, y) || seen.has(x + ',' + y)) continue;
        const c = [], q = [[x, y]]; seen.add(x + ',' + y);
        while (q.length) { const [a, b] = q.pop(); c.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy, k = nx + ',' + ny; if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && walk(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
        if (c.length < 16 && !c.some(([a, b]) => terr[b][a] === 3 || terr[b][a] === 4)) for (const [a, b] of c) { low.push([a, b]); if (cls[b][a] === 'G') bushes.push([a + 0.5, h[b][a] ?? 0, b + 0.5]); }
      } }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (walk(x, y) || cls[y][x] === 'W') continue;
      if (cls[y][x] === 'K') { h[y][x] = -0.35; continue; }
      if (cls[y][x] === 'R' || cls[y][x] === 'C' || (h[y][x] ?? 0) < 0.15) low.push([x, y]);
      if (cls[y][x] === 'G' && (h[y][x] ?? 0) < 0.15) bushes.push([x + 0.5, (h[y][x] ?? 0), y + 0.5]);
    }
    LV = new Levels(MW, MH, 1);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) LV.set(x, y, x + 1, y + 1, h[y][x] ?? BED);
    for (const r of ramps) LV.stairs(r.x0, r.z0, r.x1, r.z1, r.y0, r.y1, Math.max(3, (r.z1 - r.z0) * 3), 's');
    slopes = ramps.flatMap(r => r.cells);
    const brick = damp(T.material(brickTex(), {}));
    S.add(LV.mesh(topMat(cls, MW, MH), brick, BED - 0.4, 0.5));
    const stone = T.material(stoneTex(), {}), riser = damp(T.material(brickTex(), {}));
    for (const r of LV.ramps) S.add(stairs(r, stone, riser, 1));
    // the water over every pond, and on past the map
    const water = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), pondWater()); water.position.set(MW / 2, WATER, MH / 2); S.add(water);   // (no shadows on it: the walkways' fell black on the ponds)
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: 1 })); bed.position.set(MW / 2, BED - 0.42, MH / 2); S.add(bed);
    // balustrades on the blocked flagstone-and-post cells: a turned post at each, a carved panel under a rounded rail to
    // each neighbour at the same height
    const panelM = T.material(panelTex(), {});
    // (not a chest's cell: the art's chest reads as pale stone, and its post stood inside the open chest)
    const chestAt = new Set((G.chests || D.chests || []).map(c => c.x + ',' + c.y));
    const rail = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && !walk(x, y) && cls[y][x] === 'R' && !chestAt.has(x + ',' + y);
    const pg0 = postGeo(), posts = [], panels = [], rails = [];
    const span = (ax, az, bx, bz, yy) => {   // a panel from post a to post b
      const along = ax !== bx, len = (along ? bx - ax : bz - az) - 0.2, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const pn = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.07, RAIL - 0.2, along ? 0.07 : len), panelM); pn.position.set(mx, yy + 0.06 + (RAIL - 0.2) / 2, mz); panels.push(pn);
      const base = box(stone, mx - (along ? len / 2 : 0.06), yy, mz - (along ? 0.06 : len / 2), mx + (along ? len / 2 : 0.06), yy + 0.06, mz + (along ? 0.06 : len / 2), 2); rails.push(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 10), stone); if (along) top.rotation.z = Math.PI / 2; else top.rotation.x = Math.PI / 2;
      top.position.set(mx, yy + RAIL - 0.12, mz); rails.push(top);
      const lip = box(stone, mx - (along ? len / 2 : 0.055), yy + RAIL - 0.16, mz - (along ? 0.055 : len / 2), mx + (along ? len / 2 : 0.055), yy + RAIL - 0.13, mz + (along ? 0.055 : len / 2), 2); rails.push(lip);
    };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!rail(x, y)) continue; const yy = h[y][x] ?? DECK, cx = x + 0.5, cz = y + 0.6;
      const pm0 = new THREE.Mesh(pg0, stone); pm0.position.set(cx, yy, cz); pm0.rotation.y = R(x * 3 + y) * 6; posts.push(pm0);
      if (rail(x + 1, y) && Math.abs((h[y][x + 1] ?? DECK) - yy) < 0.05) span(cx, cz, cx + 1, cz, yy);
      if (rail(x, y + 1) && Math.abs((h[y + 1][x] ?? DECK) - yy) < 0.05) span(cx, cz, cx, cz + 1, yy);
    }
    if (posts.length) S.add(shade(merged(stone, posts)));
    if (panels.length) S.add(shade(merged(panelM, panels)));
    if (rails.length) S.add(shade(merged(stone, rails)));
    // the carved columns: one at each run of blocked column cells, standing on its lowest
    const drum = T.material(drumTex(), {}), seen = new Set(); props = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (walk(x, y) || cls[y][x] !== 'C' || seen.has(x + ',' + y)) continue;
      let y1 = y; while (y1 + 1 < MH && !walk(x, y1 + 1) && cls[y1 + 1][x] === 'C') y1++;
      for (let j = y; j <= y1; j++) { seen.add(x + ',' + j); props.push([x, j]); }
      S.add(column(drum, x + 0.5, y1 + 0.5, h[y1][x] ?? DECK));
    }
    // lily pads and lotus buds where the art has them, grass on the meadow
    const padM = T.material(padTex(), { side: THREE.DoubleSide, alphaTest: 0.5 }), pg = new THREE.RingGeometry(0.001, 0.2, 28, 3);
    { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)) / 0.2; p.setZ(i, r * r * 0.025); } pg.rotateX(-Math.PI / 2); pg.computeVertexNormals(); }   // (the rim turned up a little)
    const pm = new THREE.InstancedMesh(pg, padM, Math.max(1, pads.length * 2)), d = new THREE.Object3D(), pc = new THREE.Color(); let n = 0;
    for (const [x, z, s] of pads) for (let i = 0; i < (s > 120 ? 2 : 1); i++) { d.position.set(x + (i ? 0.18 : 0), WATER + 0.008, z + (i ? 0.14 : 0)); d.rotation.set(0, R(x * 9 + z + i) * 6.28, 0); d.scale.setScalar((i ? 0.7 : 1) * (0.85 + R(x + z * 5 + i) * 0.3)); d.updateMatrix(); pm.setMatrixAt(n, d.matrix); const t = 0.85 + R(x * 3 + z + i) * 0.3; pm.setColorAt(n++, pc.setRGB(t, t, t * 0.9)); }
    pm.count = n; pm.receiveShadow = true; S.add(pm);
    const budM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), stemM = new THREE.MeshStandardMaterial({ color: 0x3a5a1c, roughness: 0.8 }), bg = budGeo(), sways = [];
    for (const [x, z] of buds) {
      const g = new THREE.Group(), lean = (R(x * 5 + z) - 0.5) * 0.3, stem = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(lean * 0.3, 0.14, 0)), 6, 0.012, 5);
      g.add(new THREE.Mesh(stem, stemM)); const b = new THREE.Mesh(bg, budM); b.position.set(lean * 0.3, 0.13, 0); b.rotation.z = -lean; g.add(b);
      g.position.set(x, WATER, z); g.rotation.y = R(x + z * 3) * 6.28; S.add(shade(g)); sways.push([g, R(x * 7 + z) * 6.28]);
    }
    const tufts = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (cls[y][x] === 'G') for (let i = 0; i < 5; i++) { const px = x + R(x * 7 + y * 13 + i), pz = y + R(x * 3 + y * 17 + i * 5); tufts.push([px, LV.at(px, pz), pz]); }
    if (tufts.length) S.add(grass(tufts, { size: 0.36, cols: ['#4a6a1e', '#5a7a24', '#3a5a18', '#6a8a2a'] }));
    const chests = G.chests || (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false }));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, LV.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    props = props.concat(chests.map(c => [c.x, c.y]), low);
    if (bushes.length) S.add(shrubs(bushes, { size: 0.55, tex: sprigTex(['#2f5a1e', '#3e6e26', '#4f8230', '#26481a']) }));
    E.world.updaters.push((dt, t) => { water.material.userData.u.uTime.value = t; windTick(t); for (const [g, ph] of sways) { g.rotation.x = Math.sin(t * 0.7 + ph) * 0.05; g.rotation.z = Math.sin(t * 0.55 + ph * 1.3) * 0.05; } });
    void FX;
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, LV.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => { if (!LV) return 0; const v = LV.at(x, z); return v < WATER ? WATER : v; },
    get slopes() { return slopes; }, get props() { return props; },
    // a bright, still afternoon over the ponds
    mood: { bg: 0x8aa0b0, voidCol: false, fog: 0x9ab0b8, fogD: 0.012, sky: 0xdce8f0, under: 0x3a4a2a, hemi: 1.0,
      sun: 0xfff2dc, sunI: 2.5, sunDir: [-0.4, 0.82, 0.45], sat: 1.04, exposure: 1.0, bloom: 0.3, aoR: 0.8,
      env: { top: 0xc8d8e8, mid: 0x7a8a6a, low: 0x2a3424, lights: [[-6, 8, 4, 0xfff2dc, 3]] } },
  };
}
