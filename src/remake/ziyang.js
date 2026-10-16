// 紫陽觀 (maps 0ecec2 / 0ecf2e / 0ed652, the same art: scenes 16 and 17, battle 9), remade: 姜文煥's Taoist temple on a
// green hillside, terraced by low rock walls, grey stone paths through the grass, bamboo groves along the top and the
// east edge. Four levels (measured on the game's grid, tools/qa/grid.py 0ecf2e): the field at the foot (the heroes
// deploy at (11-12, 22-23)); the west lawn with the guest hall (2-6, 3-5) and the middle lawn (6-19, 11-19), each a
// step up, by the stone stairs at (1-3, 13-15) and (21-22, 16-18); and the top, the hall at (11-15, 9-11) and the
// temple's main hall (16-22, 0-4), up the stairs at (10-11, 4-6) from the west lawn and at (9-10, 15) from the middle.
// A clear day.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, shade, merged, house } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, bamboo, windTick } from '../kit/terrain.js';
import { terraces, terracedAt } from '../kit/hill.js';
import { D } from '../rules.js';

const MW = 24, MH = 25, DEPLOY = [11, 22];
const PALETTE = { [CL.grass]: [0x004800, 0x249000, 0x90d800], [CL.ground]: [0x909090, 0xfcfcfc, 0xd8d8d8, 0xb4b490, 0x90906c],
  [CL.rock]: [0x484824, 0x484848, 0x242400] };
const FOOT = 0, MID = 0.7, TOP = 1.28;   // (one band of rock between terraces; a soldier stands at the corner of the top and the middle, scene 16 f1391)
const LEVELS = [[11, 22, FOOT], [2, 8, MID], [10, 17, MID], [14, 6, TOP]];
// the stone stairs [x0, z0, x1, z1], the north end's level (y0) down to the south end's (y)
const STAIRS = [{ r: [1, 13, 4, 16], y0: MID, y: FOOT, n: 6 }, { r: [21, 16, 23, 19], y0: MID, y: FOOT, n: 6 },
  { r: [10, 4, 12, 7], y0: TOP, y: MID, n: 6 }, { r: [9, 15, 11, 16], y0: TOP, y: MID, n: 4 }];
// the halls: the guest hall (west lawn), the hall below the temple (top), the main hall (top)
const HALLS = [
  { x0: 2.3, x1: 6.7, z0: 3.3, z1: 5.95, lvl: MID, doors: [4.5], windows: [[2.7, 3.8], [5.2, 6.3]], posts: [3.95, 5.05] },
  { x0: 11.3, x1: 15.6, z0: 9.3, z1: 11.95, lvl: TOP, doors: [13.45], windows: [[11.7, 12.8], [14.1, 15.2]], posts: [12.9, 14.0] },
];
const MAIN = { x0: 16.2, x1: 22.5, z0: 1.2, z1: 4.95, lvl: TOP, doors: [18.5, 19.5, 20.5], windows: [[16.6, 17.8], [21.1, 22.2]], posts: [18.02, 20.98] };   // a pair of doors a cell (18-20)
const inRect = (h, cx, cy) => cx + 0.5 > h.x0 && cx + 0.5 < h.x1 && cy + 0.5 > h.z0 - 0.5 && cy + 0.5 < h.z1;
const houseCell = (cx, cy) => [...HALLS, MAIN].some(h => inRect(h, cx, cy));
// the groves: along the top (but the rock line at x 9), the north-east and east edges, the south-east corner
const groveCell = (cx, cy) => (cy <= 3 && cx <= 12 && cx !== 9) || (cx >= 22 && cy >= 5 && cy <= 10) || (cx === 23 && cy <= 4) || (cy >= 23 && cx >= 20);
const OPEN = [[12.5, 21.5, 0.62, FOOT], [18.45, 14.0, 0.6, MID], [12.6, 5.5, 0.5, TOP]];   // where scene 16's cast stands on a blocked cell (楊戩 at (12, 21), f386-445; soldiers at (18, 13.5), f813-1390, and (12, 5), f871-987): the rock gives way, a notch at that floor's level
let land = null, mainHall = null;

// stone steps: a slab on every tread, its riser below the front edge, a kerb of rough stone along both sides
function stoneStairs(s, stone, kerb) {
  const g = new THREE.Group(), [x0, z0, x1, z1] = s.r, dz = (z1 - z0) / s.n, slabs = [], sides = [];
  for (let k = 0; k <= s.n; k++) {
    const h = s.y0 + (s.y - s.y0) * k / s.n, za = z0 + Math.max(0, k - 0.5) * dz, zb = z0 + Math.min(s.n, k + 0.5) * dz;
    slabs.push(box(stone, x0 + 0.06, h - 0.12, za + 0.01, x1 - 0.06, h + 0.03, zb - 0.01, 2));
  }
  for (const x of [x0 + 0.06, x1 - 0.06]) for (let k = 0; k < s.n; k += 2) {
    const z = z0 + (k + 1) * dz, h = s.y0 + (s.y - s.y0) * (k + 1) / s.n;
    sides.push(box(kerb, x - 0.09, h - 0.2, z - dz * 1.1, x + 0.09, h + 0.12, z + dz * 0.9, 2));
  }
  g.add(merged(stone, slabs), merged(kerb, sides));
  return shade(g);
}
// a hall: brick and plaster, a timber front with lattice windows, plank doors, a blue (or red-brown) tiled roof on a
// stone plinth; the main hall carries an upper roof tier over its middle
function hall(M, h, roof, wallH, rise, at) {
  const y = at((h.x0 + h.x1) / 2, h.z1 - 0.2) - 0.02;
  return house(M, Object.assign({ y, wallH, roof, rise, over: 0.38, brick: 0x8a8a7a, plaster: 0xece4cc }, h));
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/0ecf2e.png', MW, MH, PALETTE);
  const W = MW * 4;
  const flat = (cx, cy) => houseCell(cx, cy) || groveCell(cx, cy);
  const t = terraces({ w: MW, h: MH, terrain: D.terrain, start: DEPLOY, levels: LEVELS, stairs: STAIRS, flat });
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const k = (cy * 4 + j) * W + cx * 4 + i;
    if (t.walk(cx, cy)) { if (lay[k] === CL.rock) lay[k] = CL.grass; }
    else lay[k] = houseCell(cx, cy) ? CL.ground : groveCell(cx, cy) ? CL.grass : CL.rock;
  }
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) {   // the foot of the rock walls
    const k = j * W + i, cx = i >> 2, cy = j >> 2, sx = i & 3, sy = j & 3; if (lay[k] !== CL.rock) continue;
    const w = t.walk, d = Math.min(w(cx - 1, cy) ? sx : 9, w(cx + 1, cy) ? 3 - sx : 9, w(cx, cy - 1) ? sy : 9, w(cx, cy + 1) ? 3 - sy : 9);
    if (d === 0) lay[k] = CL.grass;   // the walls stand a quarter cell back from the open cells (the cast stands at their foot: scene 16's (11, 21))
    else if (d === 1 && hash(i, j) < 0.3) lay[k] = CL.grass;
  }
  for (const [ox, oz, r] of OPEN) for (let j = Math.floor((oz - r) * 4); j <= Math.floor((oz + r) * 4); j++) for (let i = Math.floor((ox - r) * 4); i <= Math.floor((ox + r) * 4); i++)
    if (Math.hypot((i + 0.5) / 4 - ox, (j + 0.5) / 4 - oz) <= r) lay[j * W + i] = CL.grass;
  lay.pebbles = lay.pebbles.filter(([x, z]) => t.walk(Math.floor(x), Math.floor(z)));
  // past the map: the groves go on north and east, grass west and south
  const outside = (x, z) => z < 0 || x >= MW ? CL.grass : null;
  const cap = (x, z) => z < MH - 1.4 ? 99 : 0.5 + Math.max(0, z - MH) * 0.4;   // the south edge, before the camera: low
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, cap, rockH: 0.9, rise: 1.4, lumpH: 0.04,
    ramps: STAIRS.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
    tex: { dirt: T.dirt(0x9a968a, 'templePath'), turf: T.turf(0x4a7a26), rock: T.rock(0x4a4a3a, 'templeRock', 0.25) },
    tint: { dirt: 0xf0f0ec, turf: 0xd8f0c0, rock: 0xc8c8b8 } });
  const base = terracedAt(land, t);
  land.at = (x, z) => {   // a level notch in the rock at each spot of OPEN
    let h = base(x, z); if (t.walk(Math.floor(x), Math.floor(z))) return h;
    for (const [ox, oz, r, lv] of OPEN) { const d = Math.hypot(x - ox, z - oz); if (d < r + 0.25) { const k = Math.min(1, Math.max(0, (d - r + 0.05) / 0.3)); h = lv + (h - lv) * k * k * (3 - 2 * k); } }
    return h;
  };
  S.add(land.mesh({ dirtK: 0.25, rockK: 0.4, topGreen: 0.8, bed: 0x2a3a2a }));
  const stone = T.material(T.bricks(0x9a9a92, 2, 'stairStone'), {}, [1, 1]), kerb = T.material(T.rock(0x6a6a5e, 'kerbRock', 0.3), {}, [0.6, 0.6]);
  for (const s of STAIRS) S.add(stoneStairs(s, stone, kerb));
  for (const h of HALLS) S.add(hall(M, h, 0x1e3c8a, 1.25, 0.95, land.at));
  mainHall = hall(M, MAIN, 0x5a2a1e, 1.55, 1.25, land.at); S.add(mainHall);
  const top = land.at(19.3, 4.7) + 1.55 + 0.55;   // the upper tier: a short wall and its own roof above the ridge's middle
  S.add(house(M, { x0: 17.5, x1: 21.2, z0: 1.9, z1: 3.9, y: top, wallH: 0.5, roof: 0x6a3222, rise: 0.75, over: 0.42, doors: [], windows: [], plaster: 0xece4cc, brick: 0x8a8a7a }));
  // the name board under the upper eave, as the original's white gable with its lattice panel
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.42), new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.7 }));
  board.position.set(19.35, top + 0.3, 3.99); S.add(board);
  const frame = T.material(T.wood(0x6a3a22, 'boardFrame'), {}); S.add(shade(box(frame, 18.5, top + 0.06, 3.97, 20.2, top + 0.1, 4.03)), shade(box(frame, 18.5, top + 0.5, 3.97, 20.2, top + 0.54, 4.03)));
  // plants: turf over the lawns, shrubs on the rock walls, the groves; stones by the paths
  const clear = (x, z) => !t.inStair(x, z) && !houseCell(Math.floor(x), Math.floor(z));
  S.add(grass(land.scatter(CL.grass, 70, (x, z) => clear(x, z) && t.walk(Math.floor(x), Math.floor(z))), { size: 0.42, cols: ['#3e7a1e', '#5a9a2a', '#2e6a18', '#6aaa34', '#4a8a24'] }));
  S.add(grass(land.scatter(CL.ground, 2, (x, z) => clear(x, z) && land.weight(x, z, CL.grass) > 0.1), { size: 0.3, cols: ['#4a7a24', '#5a8a2a'] }));
  const rockM = T.material(T.rock(0x6a6a5a, 'templeStone', 0.2), { color: 0xe8e8dc }, [0.5, 0.5]);
  S.add(stones(lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]), rockM, { size: 0.12 }));
  S.add(shrubs(land.scatter(CL.rock, 1.6, (x, z) => !t.walk(Math.floor(x), Math.floor(z)) && !t.inStair(x, z) && !t.walk(Math.floor(x), Math.floor(z - 0.8))), { size: 0.42, cols: ['#2a5a1a', '#3a6e22', '#4a8228', '#22481a'] }));
  const groves = [];
  for (let cy = -6; cy < MH + 4; cy++) for (let cx = -6; cx < MW + 6; cx++) {
    const inMap = cx >= 0 && cy >= 0 && cx < MW && cy < MH;
    const g = inMap ? groveCell(cx, cy) && !houseCell(cx, cy) && !t.walk(cx, cy) : (cy < 0 && cx > -4) || (cx >= MW && cy < MH - 2);
    if (!g) continue;
    for (let k = 0; k < 2; k++) { const x = cx + 0.2 + Math.random() * 0.6, z = cy + 0.2 + Math.random() * 0.6; groves.push([x, land.at(x, z), z, 3.2 + Math.random() * 1.4]); }
  }
  S.add(bamboo(groves));
  E.world.updaters.push((dt, tt) => windTick(tt));
}

// the original swaps the main hall's middle door cell (19, 4) to an open doorway, a table inside (block 98, scene 17
// f2055), as 哪吒 comes out to follow the heroes: here that pair of doors swings open
function cell(E, x, y, block) {
  if (!mainHall || y !== 4) return;
  const i = MAIN.doors.findIndex(d => Math.floor(d) === x); if (i < 0) return;
  const leaves = mainHall.userData.doors.slice(i * 2, i * 2 + 2), open = block === 98;
  let k = 0; const step = () => { k = Math.min(1, k + 0.08); for (const d of leaves) d.rotation.y = d.userData.open * (open ? k : 1 - k) * -1; if (k < 1) requestAnimationFrame(step); };
  step();
}

export default {
  build, cell, ground: (x, z) => land ? land.at(x, z) : 0,
  props: (() => { const out = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (houseCell(x, y) || groveCell(x, y)) out.push([x, y]); return out.concat([[12, 21]]); })(),   // the halls' and groves' cells, and the cliff foot cleared for the cast (tools/qa/sets.js)
  slopes: STAIRS.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; }),
  // a clear day on the hillside: a high sun from the south-west, a soft sky fill
  mood: { bg: 0xd8e0d0, voidCol: false, fog: 0xd0dcc8, fogD: 0.008, sky: 0xd8e8ff, under: 0x3a5a28, hemi: 1.0,
    sun: 0xfff2d8, sunI: 3.0, sunDir: [-0.45, 0.8, 0.4], sat: 1.05, exposure: 1.0, bloom: 0.3, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xa8c098, low: 0x3a5a2a, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
