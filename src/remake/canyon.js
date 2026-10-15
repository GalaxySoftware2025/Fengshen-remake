// 傅山山谷三 (map 0ea2a8: scene 5 and battle 4), remade: the valley's last stretch, a canyon of sandy floors walled by
// dark rock, at three levels the original's art draws with wooden stairs between them. The heroes come up from the
// south valley (the deploy cells, low), climb either stair at (2-3, 12-13) or (10-11, 9-11) to the west field and
// the north plateau (high), and go down the stair at (15, 5-6) to the east field (between), whose end at (29, 7) is a
// plank bridge over a river gorge, off the map to the east: the way out. Clear morning light.
// Chests: (0, 15) and (3, 3) as the art draws them; the one at (18, 3) it does not draw (hidden, as battle 1's 舍利子).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 32, MH = 20, DEPLOY = [27, 18];
const PALETTE = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800, 0xfcfc90], [CL.grass]: [0xb49024, 0xd8b448, 0x242400],
  [CL.rock]: [0x24006c, 0x000000, 0x482400, 0x906c00, 0xd8b400], [CL.water]: [0xfcfcfc, 0xb4fcfc, 0x00b4fc, 0x246cfc, 0x2400b4] };
const LOW = 0, MID = 0.7, HIGH = 1.45, RIVER = -3.2;
// the stairs: [x0, z0, x1, z1] in cells, from the upper level at z0 down to the lower at z1, and their tread count
const STAIRS = [{ r: [15, 5, 16, 7], y0: HIGH, y: MID, n: 6 }, { r: [10, 9, 12, 12], y0: HIGH, y: LOW, n: 9 }, { r: [2, 12, 4, 14], y0: HIGH, y: LOW, n: 6 }];
const BRIDGE = { x0: 28.6, z: 7.5, y: MID };
const CHESTS = [[0, 15], [3, 3]];
let land = null, chestG = new Map(), M = null, world = null;

const inStair = (x, z) => STAIRS.find(s => x >= s.r[0] && x < s.r[2] && z >= s.r[1] && z < s.r[3]);

// planks on two stringers over posts down to the river, rope rails; from x0 east, off the map
function bridge() {
  const g = new THREE.Group(), wood = T.material(T.planks(0x8a6038, 1), {}), dark = T.material(T.wood(0x4a3220, 'bridgeBeam'), {});
  const x1 = MW + 9, z = BRIDGE.z, half = 0.42, deck = BRIDGE.y + 0.02, planks = [];
  for (let x = BRIDGE.x0; x < x1; x += 0.24) {
    const p = box(wood, x, deck, z - half, x + 0.21, deck + 0.05, z + half, 2);
    p.rotation.y = Math.sin(x * 12.9) * 0.025; p.position.y += Math.sin(x * 7.3) * 0.008; planks.push(p);
  }
  g.add(merged(wood, planks));
  for (const s of [-1, 1]) g.add(box(dark, BRIDGE.x0, deck - 0.09, z + s * (half - 0.08) - 0.04, x1, deck, z + s * (half - 0.08) + 0.04));
  const posts = [];
  for (let x = BRIDGE.x0 + 0.05; x < x1; x += 1.0) for (const s of [-1, 1]) posts.push(box(dark, x - 0.05, (x > 29.4 ? RIVER : deck - 0.6), z + s * half - 0.05, x + 0.05, deck + 0.42, z + s * half + 0.05));
  g.add(merged(dark, posts));
  const rope = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 });
  for (const s of [-1, 1]) {
    const pts = []; for (let x = BRIDGE.x0 + 0.05; x <= x1; x += 0.1) { const u = ((x - BRIDGE.x0 - 0.05) % 1.0); pts.push(new THREE.Vector3(x, deck + 0.4 - Math.sin(u * Math.PI) * 0.06, z + s * half)); }
    g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.012, 5), rope)));
  }
  return shade(g);
}
// wooden steps: a plank on every tread, a dark riser below its front edge, posts and a rail along both sides
function stairs(s) {
  const g = new THREE.Group(), wood = T.material(T.planks(0x9a6a3a, 1), {}), dark = T.material(T.wood(0x4a3220, 'stairBeam'), {});
  const [x0, z0, x1, z1] = s.r, dz = (z1 - z0) / s.n, parts = [], beams = [];
  for (let k = 0; k <= s.n; k++) {   // tread k where the land's ramp rounds to step k (Land.at: round(profile * n))
    const h = s.y0 + (s.y - s.y0) * k / s.n, za = z0 + Math.max(0, k - 0.5) * dz, zb = z0 + Math.min(s.n, k + 0.5) * dz;
    parts.push(box(wood, x0 + 0.08, h - 0.05, za + 0.01, x1 - 0.08, h + 0.025, zb - 0.01, 1));
    if (k < s.n) beams.push(box(dark, x0 + 0.08, h + (s.y - s.y0) / s.n - 0.02, zb - 0.03, x1 - 0.08, h - 0.02, zb + 0.01));   // the riser down to the next tread
  }
  g.add(merged(wood, parts), merged(dark, beams));
  for (const x of [x0 + 0.06, x1 - 0.06]) {
    const post = []; for (let k = 0; k <= s.n; k += 3) { const z = z0 + k * dz, h = s.y0 + (s.y - s.y0) * k / s.n; post.push(box(dark, x - 0.035, h - 0.1, z - 0.035, x + 0.035, h + 0.45, z + 0.035)); }
    g.add(merged(dark, post));
    const a = new THREE.Vector3(x, s.y0 + 0.42, z0), b = new THREE.Vector3(x, s.y + 0.42, z1);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, a.distanceTo(b), 5).rotateX(Math.PI / 2).lookAt(new THREE.Vector3().subVectors(b, a)).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), dark));
  }
  return shade(g);
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world;
  const lay = await readLayout('assets/maps/0ea2a8.png', MW, MH, PALETTE, { [CL.water]: 1.4 });
  const W = MW * 4, H4 = MH * 4;
  const tc = (cx, cy) => D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 0;
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH && tc(cx, cy) === 0;
  const stairCell = (cx, cy) => !!inStair(cx + 0.5, cy + 0.5);
  // where anyone on foot can get to, from the deploy cells (the stairs included); the rest of the open floor (the
  // pockets at the north-east and east edges) is cliff here, never open sand no one can reach
  const reach = new Set();
  for (const q = [DEPLOY]; q.length;) {
    const [x, y] = q.shift(); if (!open(x, y) || reach.has(x + ',' + y)) continue;
    reach.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // the three floors: the open cells joined without crossing a stair, each at its level (the deploy's, the bridge's,
  // and the west field's); rock takes the highest level of the floor beside it, so a cliff belongs to the terrace
  // above it and falls to the floor below
  const level = new Float32Array(MW * MH).fill(-1);
  const fill = (sx, sy, h) => { for (const q = [[sx, sy]]; q.length;) { const [x, y] = q.shift(); const k = y * MW + x;
    if (!reach.has(x + ',' + y) || stairCell(x, y) || level[k] >= 0) continue; level[k] = h; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } };
  fill(DEPLOY[0], DEPLOY[1], LOW); fill(20, 8, MID); fill(5, 8, HIGH);
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const k = cy * MW + cx; if (level[k] >= 0) continue;
    let best = -1;
    for (let r = 1; r <= 4 && best < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const s = inStair(x + 0.5, y + 0.5), v = s ? Math.max(s.y0, s.y) : level[y * MW + x]; if (reach.has(x + ',' + y) || s) best = Math.max(best, v);
    }
    level[k] = Math.max(0, best);
  }
  // the level field at the layout's resolution, softened a little so the rims drop over half a cell
  let L = new Float32Array(W * H4);
  for (let j = 0; j < H4; j++) for (let i = 0; i < W; i++) L[j * W + i] = level[(j >> 2) * MW + (i >> 2)];
  for (let pass = 0; pass < 2; pass++) { const N = new Float32Array(W * H4);
    for (let j = 0; j < H4; j++) for (let i = 0; i < W; i++) { if (reach.has((i >> 2) + ',' + (j >> 2))) { N[j * W + i] = L[j * W + i]; continue; }   // a floor stays level: only the rock is softened
      let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H4) continue; s += L[jj * W + ii]; n++; } N[j * W + i] = s / n; }
    L = N; }
  const lvl = (x, z) => {   // a floor cell's own level; elsewhere bilinear over the field; past the map, the edge's level
    const cx = Math.floor(x), cz = Math.floor(z); if (reach.has(cx + ',' + cz) && !inStair(x, z)) return level[cz * MW + cx];
    const fx = Math.max(0, Math.min(W - 1.001, x * 4 - 0.5)), fz = Math.max(0, Math.min(H4 - 1.001, z * 4 - 0.5)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const g = (a, b) => L[Math.min(H4 - 1, b) * W + Math.min(W - 1, a)];
    return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - tz) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * tz;
  };
  // the layout follows the game's grid: a cell anyone may enter is floor; a blocked one is cliff, or the river gorge
  // north and south of the bridge's first cells (29-31, rows 4-6 and 8-10)
  const gorge = (cx, cy) => cx >= 29 && ((cy >= 4 && cy <= 6) || (cy >= 8 && cy <= 10));
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const walk = reach.has(cx + ',' + cy) && !(cx >= 29 && cy === 7);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (cy * 4 + j) * W + cx * 4 + i;
      if (gorge(cx, cy) || (cx >= 29 && cy === 7)) lay[k] = CL.rock;   // the gorge's walls: rock, cut down below (sink)
      else if (walk) { if (lay[k] === CL.rock || lay[k] === CL.water) lay[k] = CL.ground; }
      else lay[k] = CL.rock;
    }
  }
  const walk = (cx, cy) => reach.has(cx + ',' + cy);
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let j = 0; j < H4; j++) for (let i = 0; i < W; i++) {   // fray the foot of the cliffs (as the valley)
    const k = j * W + i, cx = i >> 2, cy = j >> 2, sx = i & 3, sy = j & 3; if (lay[k] !== CL.rock || walk(cx, cy)) continue;
    const d = Math.min(walk(cx - 1, cy) ? sx : 9, walk(cx + 1, cy) ? 3 - sx : 9, walk(cx, cy - 1) ? sy : 9, walk(cx, cy + 1) ? 3 - sy : 9);
    if ((d === 0 && hash(i, j) < 0.4) || (d === 1 && hash(i, j) < 0.12)) lay[k] = CL.ground;
  }
  lay.pebbles = lay.pebbles.filter(([x, z]) => walk(Math.floor(x), Math.floor(z)));
  for (const [cx, cy] of CHESTS) for (let j = cy * 4; j < cy * 4 + 4; j++) for (let i = cx * 4; i < cx * 4 + 4; i++) lay[j * W + i] = CL.ground;
  // past the map: the river gorge east (as far north and south as the bridge's chasm), rock everywhere else
  const outside = () => CL.rock;
  // the south edge, between the camera and the valley floor: a low band of rock, hiding no one behind it
  const cap = (x, z) => z < 18.6 ? 99 : 0.9 + Math.max(0, z - MH) * 0.5;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, cap, rockH: 1.6, rise: 2.4, lumpH: 0.05,
    ramps: STAIRS.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
    tex: { dirt: T.dirt(0xc89a62, 'valleyDirt'), turf: T.turf(0x8a8a3a), rock: T.rock(0x6a6058, 'valleyRock', 0.2) },
    tint: { dirt: 0xfff2e0, turf: 0xe8e8c0, rock: 0xd8c4b0 } });
  const at0 = land.at.bind(land);
  // the gorge: from x 29 east, rows 4-10, cut down to the river; its walls ragged rock, its bed narrowing with depth
  const sink = (x, z) => { const wu = ((x / 9) % 1 + 1) % 1, wv = ((z / 9) % 1 + 1) % 1, n = (T.fbm(wu, wv, 12, 3, 21) - 0.5) * 0.7;
    const e = Math.min(x - 28.9 + n, z - 3.9 + n, 11.1 - z + n); if (e <= 0) return 0; const k = Math.min(1, e / 1.6); return k * k * (3 - 2 * k); };
  // the rock just south of a floor (between it and the camera) stays low: at most 0.9 over that floor, so no one
  // standing at a rim is hidden behind it (as battle 2's south edge)
  const rim = (x, z) => { const cx = Math.floor(x); for (const d of [0.4, 0.9, 1.4]) { const cz = Math.floor(z - d); if (walk(cx, cz) && !inStair(cx + 0.5, cz + 0.5)) return level[cz * MW + cx] + 0.9 + Math.max(0, d - 0.9) * 0.6; } return 99; };
  land.at = (x, z) => { if (inStair(x, z)) return at0(x, z);   // the terraces under the rock and sand; the stairs are absolute
    let h = lvl(x, z) + at0(x, z); if (!walk(Math.floor(x), Math.floor(z))) h = Math.min(h, rim(x, z));
    const g = sink(x, z); return g ? h + (RIVER - 0.5 - h) * g : h; };
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.34, topGreen: 1, bed: 0x2a4a5a }));
  // the river at the bottom of the gorge: green-blue, glinting
  const river = new THREE.Mesh(new THREE.PlaneGeometry(26, 7, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1c4450, roughness: 0.75, metalness: 0, envMapIntensity: 0.05, fog: false }));
  river.position.set(MW + 10, RIVER, 7.5); river.receiveShadow = true; S.add(river);
  S.add(bridge());
  for (const s of STAIRS) S.add(stairs(s));
  for (const [cx, cy] of CHESTS) { const g = chest(M, cx + 0.5, cy + 0.5, land.at(cx + 0.5, cy + 0.5), false, 0, 1.4); chestG.set(cx + ',' + cy, g); S.add(g); }
  // plants and stones, as the valley: tall turf on the grass, tufts at the foot of the cliffs, scrub and trees on top
  const clear = (x, z) => !sink(x, z) && !CHESTS.some(([cx, cy]) => x > cx - 0.2 && x < cx + 1.2 && z > cy - 0.2 && z < cy + 1.2) && !inStair(x, z) && !(z > 6.6 && z < 8.4 && x > 28);
  S.add(grass(land.scatter(CL.grass, 110, clear), { size: 0.55, cols: ['#9a9a40', '#b4aa50', '#7a8030', '#c8bc60', '#8a8a38'] }));
  S.add(grass(land.scatter(CL.ground, 2.5, (x, z) => clear(x, z) && land.weight(x, z, CL.rock) > 0.05), { size: 0.4, cols: ['#a09848', '#8a8a3a', '#b0a050'] }));
  const rockM = T.material(T.rock(0x6a6058, 'valleyRock', 0.2), { color: 0xf0dcc0 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]), ...land.scatter(CL.ground, 0.3, clear)], rockM, { size: 0.13 }));
  const into = (x, z) => land.dist[Math.floor((z + 12) * 4) * land.W + Math.floor((x + 12) * 4)] || 0;
  S.add(shrubs(land.scatter(CL.rock, 2.4, (x, z) => into(x, z) > 2 && !walk(Math.floor(x), Math.floor(z - 1.6)) && !walk(Math.floor(x), Math.floor(z - 0.8)) && !inStair(x, z) && !sink(x, z)), { size: 0.46, cols: ['#4a5a2a', '#5a6a30', '#66783a', '#3e4c24'] }));
  const near = z => z > 17.5 && z < 26;   // the south edge, between the camera and the floor: no tall trees there
  S.add(pines(land.scatter(CL.rock, 0.22, (x, z) => into(x, z) > 5 && !near(z) && sink(x, z) === 0 && Math.hypot(x - 29, z - 7.5) > 3.2), { size: 1.0, cols: ['#34482a', '#405834', '#4c663a', '#2c3e22'] }));
  E.world.updaters.push((dt, t) => { windTick(t); river.material.color.setHSL(0.53, 0.45, 0.18 + Math.sin(t * 0.9) * 0.012); });
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y); if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); chestG.set(x + ',' + y, o); S.add(o);
}
// the chest the map does not draw (18, 3): struck, it shows up where it was hidden, open and empty
function found(x, y) {
  if (!land || !world) return;
  const cx = x + 0.5, cz = y + 0.5, g = chest(M, cx, cz, land.at(cx, cz), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

export default {
  build, openChest,
  slopes: STAIRS.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; }),   // the stairs' cells step down (tools/qa/sets.js lets them)
  ground: (x, z) => land ? (z > 7 && z < 8 && x > BRIDGE.x0 ? BRIDGE.y + 0.07 : land.at(x, z)) : 0, particles: 'leaves',
  // a clear morning: a high warm sun, a cool sky fill, light haze down the canyon
  mood: { bg: 0xd8d4c4, voidCol: false, fog: 0xd8d0bc, fogD: 0.012, sky: 0xd8e4ff, under: 0x6a4a28, hemi: 1.0,
    sun: 0xffe6b8, sunI: 3.1, sunDir: [-0.5, 0.75, 0.4], sat: 1.05, exposure: 1.0, bloom: 0.32, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xc0b098, low: 0x6a5a40, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
