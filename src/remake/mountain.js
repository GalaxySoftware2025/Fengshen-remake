// Two mountains under the open sky, remade from the same pieces (measured on tools/qa/grid.py):
//   聖靈山 (map 0f0fdc: scene 25 and battle 12's first room), the holy mountain of the 洛書: a meadow strewn with red and
//   purple flowers, broadleaf trees round its edges, ridges of brown boulders across it (rows 11-14 in the middle, the
//   north-west corner), the cave of the 西方守護靈's shrine at (4, 4) in the north-west ridge, reached up an avenue of pale
//   standing stones (rows 5-8, x 0-7). Bright morning.
//   麒麟山 (map 0f2d64: scene 30 and battle 15's first room), deep in snow: snowfields, snow-laden trees, ridges of dark
//   rock (the north edge, a long one across rows 6-11), snow-capped boulders, the 麒麟獸's cave at (16, 1) in the north
//   ridge, chests at (1, 6), (29, 13), (0, 21) and (31, 21). A cold, clear day.
// Built from the map's grid and art: the cells a unit can stand on (terrain 0, 3, 4) are level ground; the others are
// boulder ridge where the art draws rock there (a third of the cell), else forest (a tree, two in a wide cell). The
// standing stones, the cave mouths and the chests are models.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, windTick } from '../kit/terrain.js';
import { trees, mouth } from './seacave.js';
import { flowerSpots, flowers } from './grassland.js';
import { D, G } from '../rules.js';

const ROCKY = new Set([0xd86c24, 0x484824, 0x906c00, 0xfcfc90, 0x242424, 0x486cb4, 0x6c48b4]);
const V = {
  '0f0fdc': {
    w: 32, h: 25, art: 'assets/maps/0f0fdc.png', snow: false, start: [6, 20],   // (battle 12's deploy: where the way up begins)
    palette: { [CL.grass]: [0x002400, 0x249000, 0x90b400, 0x90d800, 0xfcfc00, 0x484800], [CL.rock]: [0xd86c24, 0x484824, 0x906c00, 0xfcfc90, 0x240000] },
    rocky: [0xd86c24, 0x484824, 0x906c00, 0xfcfc90], crown: [0x90b400, 0xfcfc00],
    mouth: { x: 4.5, z: 4.55, w: 0.95, h: 1.15 },
    // the standing stones (cell coordinates of their feet, height): two clusters flank the way up to the cave, singles round
    stones: [[0.5, 6.7, 0.75], [2.5, 7.65, 0.8], [3.45, 5.55, 0.85], [3.8, 6.05, 0.7], [3.35, 6.4, 0.8], [3.85, 6.7, 0.6], [5.45, 5.55, 0.85],
      [5.8, 6.05, 0.7], [5.35, 6.4, 0.8], [5.85, 6.7, 0.6], [7.45, 6.7, 0.75], [6.5, 7.65, 0.8], [3.5, 8.65, 0.8], [5.5, 8.65, 0.8]],
    flowers: { 0xd82400: 'red', 0xfc6cb4: 'red', 0xb46cfc: 'purple', 0x6c00b4: 'purple' },
    perch: [[0.9, 2.9, 2.1, 4.1]],   // scene 25's 飛兵 on the ridge's top at (1, 3), f75-204 (as the original draws him): a flat top there
    leaves: undefined,
    tex: () => ({ dirt: T.dirt(0x5a6a2a, 'holyDirt'), turf: T.turf(0x3a7a22), rock: T.rock(0x6a4a2a, 'holyRock', 0.6), rockTop: T.rock(0x5a4a24, 'holyTop', 0.5) }),
    tint: { dirt: 0xe0e8c8, turf: 0xd8f0c0, rock: 0xf0d0b0 },
    grassCols: ['#2e6a1e', '#4a8a24', '#1e5a18', '#5a9a2a', '#3a7a20'],
    mood: { bg: 0xc8dcf0, voidCol: false, fog: 0xd0e0e8, fogD: 0.008, sky: 0xd8ecff, under: 0x2a4a20, hemi: 1.0,
      sun: 0xfff0d8, sunI: 3.0, sunDir: [-0.5, 0.75, 0.4], sat: 1.06, exposure: 1.0, bloom: 0.3, aoR: 0.8,
      env: { top: 0xd0e4ff, mid: 0x98b088, low: 0x2a4a20, lights: [[-6, 7, 3, 0xfff4e0, 3]] } },
  },
  '0f2d64': {
    w: 32, h: 25, art: 'assets/maps/0f2d64.png', snow: true, start: [16, 14],   // (battle 15's deploy)
    palette: { [CL.grass]: [0x9090fc, 0xb4d8fc, 0xfcfcfc, 0x90d8fc, 0xb4b4fc, 0x244824, 0xb46c6c, 0xb4fcb4], [CL.rock]: [0x242424, 0x486cb4, 0x484824, 0x6c48b4] },
    rocky: [0x242424, 0x486cb4, 0x6c48b4], crown: [0x244824, 0xfcfcfc],
    mouth: { x: 16.5, z: 1.6, w: 0.95, h: 1.15 },
    stones: [], flowers: null,
    flat: [[15, 2], [17, 2]],   // scene 30's two at the cave's sides (f154-195: tools/qa/sets.js): level ground, not ridge
    leaves: ['#e8f0fa', '#c8d6e8', '#ffffff', '#9aaec4', '#2e4a3a', '#d8e4f2'],
    tex: () => ({ dirt: T.dirt(0xd8e2f0, 'snowField'), turf: T.dirt(0xc8d4e8, 'snowDrift'), rock: T.rock(0x384650, 'snowRock', 0.6), rockTop: T.dirt(0xe8eef8, 'snowCap') }),
    tint: { dirt: 0xf4f8ff, turf: 0xeef4ff, rock: 0xc8d4e0 },
    grassCols: ['#c8d8e8', '#b0c4d8', '#dce8f4'],
    mood: { bg: 0xdce8f4, voidCol: false, fog: 0xe0eaf4, fogD: 0.012, sky: 0xe8f2ff, under: 0x8a9ab0, hemi: 1.05,
      sun: 0xf8fbff, sunI: 2.6, sunDir: [-0.4, 0.8, 0.45], sat: 0.95, exposure: 0.95, bloom: 0.32, aoR: 0.8,
      env: { top: 0xe0ecff, mid: 0xb8c8dc, low: 0x6a7a90, lights: [[-6, 7, 3, 0xffffff, 2.6]] } },
  },
};

// a standing stone: a pale weathered menhir, rounder at its head, leaning a little
function menhir(mat, x, z, y, h) {
  const prof = []; for (let k = 0; k <= 10; k++) { const t = k / 10; prof.push(new THREE.Vector2(0.15 * (1 - 0.25 * t) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.7) / 0.3, 2))) + 0.004, t * h)); }
  const geo = new THREE.LatheGeometry(prof, 12), p = geo.attributes.position; geo.translate(0, -h / 2, 0);
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), n = 1 + Math.sin(a * 3 + x * 5) * 0.08 + Math.sin(a * 5 + z) * 0.05; p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n * 0.8); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y + h / 2 - 0.04, z); m.rotation.set(Math.sin(x * 3) * 0.06, x * 1.3, Math.cos(z * 2) * 0.06);
  m.castShadow = m.receiveShadow = true; return m;
}

function setFor(key) {
  const v = V[key];
  let land = null, chestG = new Map(), M = null, world = null, treeCells = [];
  async function build(E, FX) {
    const S = E.world.scene, { w: MW, h: MH } = v; M = mats(); world = E.world; chestG = new Map();
    const grid = D.terrain;   // (a scene's map: its stand-in battle, src/scene.js; a battle: the room's)
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 2 : grid[y][x];
    // the ground a unit can stand on: open cells joined to the way up (pockets the ridges shut off are wood or rock)
    const reach = new Set(), q = [v.start];
    while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (reach.has(k) || ![0, 3, 4].includes(tc(x, y))) continue; reach.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    const walk = (x, y) => reach.has(x + ',' + y);
    const lay = await readLayout(v.art, MW, MH, v.palette, { [CL.rock]: 1.2 });
    // the art per cell: how much of it is rock
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = v.art; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, img.width, img.height).data, rocky = new Set(v.rocky);
    const share = (x, y, set) => { if (x < 0 || y < 0 || x >= MW || y >= MH) return 1; let n = 0; for (let j = 0; j < 32; j += 2) for (let i = 0; i < 32; i += 2) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4; if (set.has((px[k] << 16) | (px[k + 1] << 8) | px[k + 2])) n++; } return n / 256; };
    const crown = new Set(v.crown), treeArt = (x, y) => share(x, y, crown) > 0.22;   // a tree where the art draws one
    const rockShare = (x, y) => { let n = 0; for (let j = 0; j < 32; j += 2) for (let i = 0; i < 32; i += 2) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4; if (rocky.has((px[k] << 16) | (px[k + 1] << 8) | px[k + 2])) n++; } return n / 256; };
    const stoneCell = (x, y) => v.stones.some(([sx, sz]) => Math.floor(sx) === x && Math.floor(sz) === y) || (v.flat || []).some(([fx, fy]) => fx === x && fy === y);
    const rockCell = (x, y) => !walk(x, y) && !stoneCell(x, y) && rockShare(x, y) > 0.22;
    const W = MW * 4;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (y * 4 + j) * W + x * 4 + i;
      if (walk(x, y) || stoneCell(x, y)) lay[k] = CL.grass; else lay[k] = rockCell(x, y) ? CL.rock : CL.grass;
    }
    const mo = v.mouth, outside = (x, z) => z < 0 ? CL.rock : null;   // past the north edge the ridge goes on; elsewhere the land mirrors
    land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, carve: [{ r: [mo.x - 0.48, mo.z - 0.9, mo.x + 0.48, mo.z + 0.6], h: 0.02 }, ...(v.flat || []).map(([fx, fy]) => ({ r: [fx + 0.05, fy + 0.05, fx + 0.95, fy + 0.95], h: 0.25 })), ...(v.perch || []).map(r => ({ r, h: 1.6 }))],   // (the cast's spots: a low drift, blocked in battle but stood on in the scene) rockH: 1.6, rise: 1.1, lumpH: 0.04,
      cap: () => 99, tex: v.tex(), tint: v.tint });
    S.add(land.mesh({ dirtK: 0.2, rockK: 0.45, topGreen: v.snow ? 0 : 0.12, snow: v.snow ? 1.25 : 99, bed: 0x203040 }));
    const rockM = v.snow ? T.material(T.rock(0x404e58, 'snowBoulder', 0.5), { color: 0xd8e2ec }, [0.5, 0.5]) : T.material(T.rock(0x6a4a2a, 'holyRock', 0.6), { color: 0xf0d8b8 }, [0.5, 0.5]);
    S.add(mouth(land.at.bind(land), rockM, mo));
    // the forest: a tree on each cell no one stands on that is not ridge (two on a few), kept off the stones and the mouth
    treeCells = []; const list = [], bush = [], hash = (x, y, k) => { const h = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };
    for (let y = -1; y <= MH; y++) for (let x = -1; x <= MW; x++) {
      if (x >= 0 && y >= 0 && x < MW && y < MH && (walk(x, y) || rockCell(x, y) || stoneCell(x, y))) continue;
      if (Math.hypot(x + 0.5 - mo.x, y + 0.5 - mo.z) < 1.4) continue;
      if ((x < 0 || y < 0 || x >= MW || y >= MH) && hash(x, y, 9) < 0.35) continue;   // (past the edge: a thinner wood)
      if (!treeArt(x, y)) { if (x >= 0 && y >= 0 && x < MW && y < MH) { bush.push([x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5]); treeCells.push([x, y]); } continue; }   // (grass the grid blocks: a low bush says so)
      const front = walk(x, y - 1) || walk(x, y - 2);   // a tree just south of open ground (between it and the camera) kept small: its crown would hide the squares and the units
      list.push([x + 0.3 + hash(x, y, 1) * 0.4, y + 0.35 + hash(x, y, 2) * 0.4, (0.85 + hash(x, y, 3) * 0.3) * (front ? 0.55 : 1)]); treeCells.push([x, y]);
    }
    S.add(trees(list, (x, z) => land.at(x, z), v.leaves, v.snow ? 0xa89488 : 0xd88a6a));
    if (bush.length) S.add(shrubs(bush, { size: 0.55, cols: v.snow ? ['#c8d6e4', '#e8eef6', '#8aa0b4', '#2e4a3a'] : ['#2f5a1e', '#3e6e26', '#4f8230', '#26481a'] }));
    if (v.stones.length) { const sm = T.material(T.plaster(0xd8c8a0), { color: 0xf4e8cc, roughness: 0.9 }, [0.5, 0.5]); for (const [x, z, h] of v.stones) S.add(menhir(sm, x, z, land.at(x, z), h)); }   // (smooth weathered stone: the rock texture's strata read as stacked rings)
    // the chests as left (a battle's room keeps them; a scene shows the map's own)
    const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => Object.assign({ open: false }, c));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, land.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    const open = (x, z) => !list.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.35) && Math.hypot(x - mo.x, z - mo.z - 0.3) > 0.7 && !chests.some(c => Math.abs(x - c.x - 0.5) < 0.6 && Math.abs(z - c.y - 0.5) < 0.6);
    S.add(grass(land.scatter(CL.grass, v.snow ? 6 : 60, open), { size: v.snow ? 0.28 : 0.38, cols: v.grassCols }));
    S.add(stones(land.scatter(CL.rock, 6, () => true), rockM, { size: 0.3 }));   // the ridges as heaps of boulders
    if (v.flowers) S.add(flowers((await flowerSpots(v.art, v.flowers)).filter(f => open(f.x, f.z)), (x, z) => land.at(x, z)));
    E.world.updaters.push((dt, t) => windTick(t));
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return { build, openChest, ground: (x, z) => land ? land.at(x, z) : 0, mood: v.mood, get props() { return v.stones.map(([x, z]) => [Math.floor(x), Math.floor(z)]).concat(treeCells); } };   // (the stones' and the trees' cells: a model blocks them, tools/qa/sets.js)
}
export const holyMount = setFor('0f0fdc');
export const qilinMount = setFor('0f2d64');
