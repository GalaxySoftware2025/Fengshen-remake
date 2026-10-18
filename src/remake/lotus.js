// 沁蓮園, 聞太師's treasure garden of lotus ponds (battle 17's eight rooms; scene 35's maps 0f3b58 = room 2 and 0f3b98 =
// room 0), remade from each room's own art and terrain, as all eight share one tileset: walkways and terraces of pale
// flagstones over dark ponds of lily pads and red lotus buds, faced with brick, edged with balustrades of capped posts,
// carved drum columns, stairs between the levels, grass banks with pebble shores (room 2's meadow).
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
import { grass, stones, shrubs, windTick } from '../kit/terrain.js';
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
// the top of every floor: flagstones where the walk is, grass, pebbles, the pond's dark bed, from the cells' classes
function floorTex(cls, h, MW, MH) {
  const S = 64, c = document.createElement('canvas'); c.width = MW * S; c.height = MH * S; const g = c.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = cls[y][x], X = x * S, Y = y * S;
    if (k === 'G') { g.fillStyle = '#4a5a1c'; g.fillRect(X, Y, S, S); for (let i = 0; i < 70; i++) { g.fillStyle = R(x * 31 + y * 7 + i) < 0.5 ? 'rgba(110,120,40,0.6)' : 'rgba(30,50,10,0.5)'; g.fillRect(X + R(i + x) * S, Y + R(i * 3 + y) * S, 2, 3); } }
    else if (k === 'K') { g.fillStyle = '#8a8670'; g.fillRect(X, Y, S, S); for (let i = 0; i < 26; i++) { g.fillStyle = `rgb(${150 + R(i + x) * 60 | 0},${145 + R(i + y) * 55 | 0},${120 + R(i * 2) * 50 | 0})`; g.beginPath(); g.ellipse(X + R(i * 5 + x) * S, Y + R(i * 7 + y) * S, 3 + R(i) * 5, 2 + R(i + 1) * 4, R(i) * 3, 0, 7); g.fill(); } }
    else if (k === 'W') { g.fillStyle = '#16201a'; g.fillRect(X, Y, S, S); }
    else {   // flagstones: two by two a cell, pale, joints dark, each stone a little different
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const v = 0.92 + R(x * 13 + y * 29 + i + j * 2) * 0.12; g.fillStyle = `rgb(${190 * v | 0},${184 * v | 0},${150 * v | 0})`; g.fillRect(X + i * S / 2, Y + j * S / 2, S / 2, S / 2);
        for (let n = 0; n < 14; n++) { g.fillStyle = R(n + i + x) < 0.5 ? 'rgba(90,70,40,0.25)' : 'rgba(255,250,220,0.3)'; g.fillRect(X + i * S / 2 + R(n * 3 + y) * S / 2, Y + j * S / 2 + R(n * 7 + x) * S / 2, 3, 2); } }
      g.strokeStyle = 'rgba(60,44,24,0.8)'; g.lineWidth = 2; g.strokeRect(X + 1, Y + 1, S / 2 - 1, S / 2 - 1); g.strokeRect(X + S / 2, Y + 1, S / 2 - 1, S / 2 - 1); g.strokeRect(X + 1, Y + S / 2, S / 2 - 1, S / 2 - 1); g.strokeRect(X + S / 2, Y + S / 2, S / 2 - 1, S / 2 - 1);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, MW / MH); t.offset.set(0, 1); return t;
}
// a carved drum column: a round shaft with bands of relief, a wide base and cap
function column(stone, x, z, y) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.36, 0], [0.36, 0.1], [0.3, 0.16], [0.28, 0.2], [0.28, 1.05], [0.31, 1.1], [0.36, 1.16], [0.36, 1.26], [0, 1.26]].map(([a, b]) => new THREE.Vector2(a, b)), 28), stone));
  for (const yy of [0.32, 0.62, 0.92]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.03, 6, 28), stone); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
  g.position.set(x, y, z); return shade(g);
}
// a lily pad: a flat round leaf with its notch, a little tilted; a lotus bud: a pink pointed bud on a short stem
function padGeo() { const s = new THREE.Shape(); s.absarc(0, 0, 0.2, 0.25, Math.PI * 2 - 0.25, false); s.lineTo(0, 0); return new THREE.ShapeGeometry(s, 16).rotateX(-Math.PI / 2); }

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
    const floor = new THREE.MeshStandardMaterial({ map: floorTex(cls, h, MW, MH), roughness: 0.9 });
    const brick = T.material(T.bricks(0x6c5838, 4, 'lotusBrick'), { color: 0xd8ccb0 }, [16, 16]);
    S.add(LV.mesh(floor, brick, BED - 0.4, 1 / 32));
    const tread = T.material(T.bricks(0xb4ac88, 1, 'lotusTread'), {}, [1, 1]), riser = T.material(T.bricks(0x5a4a30, 2, 'lotusRiser'), {}, [1, 1]);
    for (const r of LV.ramps) S.add(stairs(r, tread, riser, 0.5));
    // the water over every pond, and on past the map
    const water = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), pondWater()); water.position.set(MW / 2, WATER, MH / 2); S.add(water);   // (no shadows on it: the walkways' fell black on the ponds)
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: 1 })); bed.position.set(MW / 2, BED - 0.42, MH / 2); S.add(bed);
    // balustrades on the blocked flagstone-and-post cells: a capped post at each, a carved panel to each neighbour
    const cap = T.material(T.rock(0xd8d4b8, 'lotusCap', 0.3), { color: 0xf0ecd8 }, [0.5, 0.5]), panelM = T.material(T.bricks(0xb8b090, 2, 'lotusPanel'), {}, [1, 1]);
    const rail = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && !walk(x, y) && cls[y][x] === 'R';
    const posts = [], panels = [], balls = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!rail(x, y)) continue; const yy = h[y][x] ?? DECK, cx = x + 0.5, cz = y + 0.6;
      posts.push(box(cap, cx - 0.09, yy, cz - 0.09, cx + 0.09, yy + RAIL, cz + 0.09, 0.5));
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), cap); b.position.set(cx, yy + RAIL + 0.07, cz); balls.push(b);
      if (rail(x + 1, y) && Math.abs((h[y][x + 1] ?? DECK) - yy) < 0.05) panels.push(box(panelM, cx + 0.09, yy + 0.05, cz - 0.05, cx + 0.91, yy + RAIL - 0.1, cz + 0.05, 1), box(cap, cx + 0.09, yy + RAIL - 0.12, cz - 0.07, cx + 0.91, yy + RAIL - 0.04, cz + 0.07, 0.5));
      if (rail(x, y + 1) && Math.abs((h[y + 1][x] ?? DECK) - yy) < 0.05) panels.push(box(panelM, cx - 0.05, yy + 0.05, cz + 0.09, cx + 0.05, yy + RAIL - 0.1, cz + 0.91, 1), box(cap, cx - 0.07, yy + RAIL - 0.12, cz + 0.09, cx + 0.07, yy + RAIL - 0.04, cz + 0.91, 0.5));
    }
    if (posts.length) S.add(shade(merged(cap, posts)), shade(merged(cap, balls)));
    if (panels.length) S.add(shade(merged(panelM, panels)));
    // the carved columns: one at each run of blocked column cells, standing on its lowest
    const drum = T.material(T.rock(0xa89a78, 'lotusDrum', 0.4), { color: 0xe8dcc0 }, [1, 1]), seen = new Set(); props = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (walk(x, y) || cls[y][x] !== 'C' || seen.has(x + ',' + y)) continue;
      let y1 = y; while (y1 + 1 < MH && !walk(x, y1 + 1) && cls[y1 + 1][x] === 'C') y1++;
      for (let j = y; j <= y1; j++) { seen.add(x + ',' + j); props.push([x, j]); }
      S.add(column(drum, x + 0.5, y1 + 0.5, h[y1][x] ?? DECK));
    }
    // lily pads and lotus buds where the art has them, grass on the meadow, pebbles on the shores
    const padM = new THREE.MeshStandardMaterial({ color: 0x5a8a24, roughness: 0.6, side: THREE.DoubleSide }), pg = padGeo(), pm = new THREE.InstancedMesh(pg, padM, Math.max(1, pads.length * 2)), d = new THREE.Object3D(); let n = 0;
    for (const [x, z, s] of pads) for (let i = 0; i < (s > 120 ? 2 : 1); i++) { d.position.set(x + (i ? 0.18 : 0), WATER + 0.012, z + (i ? 0.14 : 0)); d.rotation.set(0, R(x * 9 + z + i) * 6.28, 0); d.scale.setScalar(i ? 0.7 : 1); d.updateMatrix(); pm.setMatrixAt(n++, d.matrix); }
    pm.count = n; pm.receiveShadow = true; S.add(pm);
    const budM = new THREE.MeshStandardMaterial({ color: 0xe86a8a, roughness: 0.5, emissive: 0x3a0a14 }), stemM = new THREE.MeshStandardMaterial({ color: 0x3a6a1c });
    for (const [x, z] of buds) {
      const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), budM); b.scale.set(1, 1.7, 1); b.position.y = 0.16; g.add(b);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 8), budM); t.position.y = 0.3; g.add(t);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), stemM); st.position.y = 0.06; g.add(st);
      g.position.set(x, WATER, z); S.add(shade(g));
    }
    const tufts = [], peb = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (cls[y][x] === 'G') for (let i = 0; i < 5; i++) { const px = x + R(x * 7 + y * 13 + i), pz = y + R(x * 3 + y * 17 + i * 5); tufts.push([px, LV.at(px, pz), pz]); }
      if (cls[y][x] === 'K') for (let i = 0; i < 3; i++) { const px = x + R(x * 11 + y + i), pz = y + R(y * 5 + x + i * 3); peb.push([px, LV.at(px, pz), pz]); }
    }
    if (tufts.length) S.add(grass(tufts, { size: 0.36, cols: ['#4a6a1e', '#5a7a24', '#3a5a18', '#6a8a2a'] }));
    if (peb.length) S.add(stones(peb, T.material(T.rock(0x9a9684, 'lotusPebble', 0.3), {}, [0.5, 0.5]), { size: 0.09 }));
    const chests = G.chests || (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false }));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, LV.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    props = props.concat(chests.map(c => [c.x, c.y]), low);
    if (bushes.length) S.add(shrubs(bushes, { size: 0.55, cols: ['#2f5a1e', '#3e6e26', '#4f8230', '#26481a'] }));
    E.world.updaters.push((dt, t) => { water.material.userData.u.uTime.value = t; windTick(t); });
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
