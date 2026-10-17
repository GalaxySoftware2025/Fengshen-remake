// 青龍關, 張桂芳's pass (maps 0f3374 and 0f33cc, the same art: scene 32 and battle 16), remade: a fortress of stone
// terraces climbing north between mountains. Measured on tools/qa/grid.py 0f3374, south to north:
//   the gate        the south wall (rows 23-24) of pale brick under brown glazed tiles, the gatehouse over it (x 8.5-15.5,
//                   rows 21-24): two eaves, red columns and the plaque 青龍關 on its outer face
//   the gate plaza  rows 18-22 (x 0-24; from row 19 east of x 14.75): the heroes deploy here
//   the terraces    rows 12-15 west and 12-16 east, up the west stair (x 5.75-9.25, rows 15-18) or the east one (16.5-19.5,
//                   16-19); between them the walled inner yard (x 9.75-14.25, rows 10-14), up its own stair (10.75-13.25,
//                   14-18) between two stone cheeks
//   the forecourt   rows 6-9 right across, up the stairs of rows 9-12 (x 6.75-9.25 and 14.75-18.25), on to the hall's
//                   front (x 8-15, rows 3-6) between four pines on stone rings
//   the hall        張桂芳's (x 8.2-14.8, rows 0-3): red brick, red lattice windows, a four-leaf door, a brown hip roof
//   the yards       rows 1-2 either side of the hall (x 0.6-7.4 and 15.6-23.4), up the stairs of rows 3-6 (x 2.75-5.25 and
//                   17.75-20.25), each with a chest; the north wall behind them
// Every drop between levels is a stone rampart: its blocked rows are a raised deck of slabs (no unit stands there), a
// parapet on its edge, its face of big grey-green blocks. Past the map the mountains of the pass rise both sides and behind.
// Chests: (1, 1) and (22, 1) as drawn; (0, 18) and (23, 22) are not drawn (hidden: battle 16's rules module).
// Also 鄂順's council room in the pass (map 0f3a2c: scene 34): passHall below.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs, pillar, curtain, screen } from '../kit/parts.js';
import { readLayout, grass, CL } from '../kit/terrain.js';
import { tree, treeMats, rock, hipRoof, plaqueTex, groundTex } from './citygate.js';

const MW = 24, MH = 25, T0 = 0, T1 = 1, T2 = 2, T3 = 3, CAP = 0.25, WALL = T3 + 1.1, GATE = 1.15, PLINTH = 0.4, EAVE = 1.4;
const INNER = 1.4;   // the inner yard: higher than the terraces (its back wall is drawn short), so 張桂芳's way down from the hall in scene 32 crosses its back wall by a short flight
const PALETTE = { [CL.ground]: [0xb4b490, 0x90906c], [CL.grass]: [0x004800, 0x009000, 0x90d800] };
// the ramparts' decks: x0, z0, x1, z1, top (their blocked rows; the face is on the south edge, or the sides for the
// inner yard's walls)
const DECKS = [
  [0, 3, 2.75, 6, T3 + CAP], [5.25, 3, 8, 6, T3 + CAP], [15, 3, 17.75, 6, T3 + CAP], [20.25, 3, 24, 6, T3 + CAP],
  [0, 9, 6.75, 12, T2 + CAP], [18.25, 9, 24, 12, T2 + CAP], [9.25, 9, 10.75, 10, T2 + CAP], [12.25, 9, 14.75, 10, T2 + CAP], [9.25, 10, 9.75, 14, T2 + CAP], [14.25, 10, 14.75, 14, T2 + CAP],
  [0, 15, 5.75, 18, T1 + CAP], [9.25, 14, 10.75, 18, INNER + CAP], [13.25, 14, 14.75, 18, INNER + CAP], [14.75, 16, 16.5, 19, T1 + CAP], [19.5, 16, 24, 19, T1 + CAP],
];
// the stairs: x0, z0, x1, z1, foot, head, steps (all climb north)
const STAIRS = [
  [2.75, 3, 5.25, 6, T2, T3, 9], [17.75, 3, 20.25, 6, T2, T3, 9],
  [6.75, 9, 9.25, 12, T1, T2, 9], [14.75, 9, 18.25, 12, T1, T2, 9],
  [5.75, 15, 9.25, 18, T0, T1, 9], [10.75, 14, 13.25, 18, T0, INNER, 13], [10.75, 9, 12.25, 10, INNER, T2, 3],   // (the flight in the inner yard's back wall: blocked in battle, as on the original) [16.5, 16, 19.5, 19, T0, T1, 9],
];
function levels() {
  const L = new Levels(MW, MH, 4);
  L.set(0, 18, MW, MH, T0).set(0, 12, MW, 18, T1).set(9.75, 10, 14.25, 14, INNER)   // the gate plaza, the terraces, the inner yard
    .set(0, 3, MW, 9, T2).set(8, 0, 15, 3, T2).set(0, 0, 8, 3, T3).set(15, 0, MW, 3, T3);   // the forecourt and the hall's floor, the yards
  for (const [x0, z0, x1, z1, y] of DECKS) L.set(x0, z0, x1, z1, y);
  for (const [x0, z0, x1, z1, a, b, n] of STAIRS) L.stairs(x0, z0, x1, z1, a, b, n, 's');
  return L;
}
const LV = levels();
const STAIR_CELLS = STAIRS.flatMap(([x0, z0, x1, z1]) => { const out = []; for (let z = z0; z < z1; z++) for (let x = Math.ceil(x0); x + 1 <= x1; x++) out.push([x, z]); return out; });
const TREES = [[8.95, 4.45], [8.95, 6.4], [14.0, 4.45], [14.0, 6.4]];
const CHESTS = [[1, 1], [22, 1]];
let M = null, world = null, chestG = new Map();

const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// the mountains past the map: the height at the map's west or east edge, row by row (over the levels' own edges), and
// a rocky slope rising away from it
function edgeH(z) {
  if (z < 3) return WALL; if (z < 6) return T3 + CAP; if (z < 9) return T2; if (z < 12) return T2 + CAP; if (z < 15) return T1;
  if (z < 19) return T1 + CAP; if (z < 23) return T0; return GATE;
}
function mountain(x, z) {
  const dx = Math.max(0, -x, x - MW), dz = Math.max(0, -z), d = Math.hypot(dx, dz), e = z < 0 ? WALL : edgeH(Math.min(z, 24.9));
  const n = Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 1.1 - x * 0.3) + 0.5 * Math.sin(x * 2.3 + 1.7) * Math.sin(z * 2.1 + 0.4);
  return e + 0.45 + 1.5 * Math.sqrt(d) + 0.3 * d + n * (0.15 + 0.12 * d);
}
function slope(x0, x1, z0, z1, mat) {
  const nx = Math.round((x1 - x0) * 2), nz = Math.round((z1 - z0) * 2), geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2; p.setXYZ(i, x, mountain(x, z), z); }
  geo.computeVertexNormals(); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3, -p.getZ(i) / 3);
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = true; return m;
}

// ---------------------------------------------------------------- the pass
async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const lay = await readLayout('assets/maps/0f3374.png', MW, MH, PALETTE, { [CL.grass]: 1.6 });
  const earth = new THREE.MeshStandardMaterial({ map: groundTex(lay, MW, MH), roughness: 0.95 });
  const blocks = T.material(T.bricks(0x8a8c72, 3, 'passBlocks'), { color: 0xe4e6d4 }, [16, 16]);   // (the floor's UVs are map-scaled: 1/32)
  S.add(LV.mesh(earth, blocks, -0.6, 1 / 32));
  const tread = T.material(T.bricks(0xa4a48c, 1, 'passTread'), {}, [1, 1]), riser = T.material(T.bricks(0x6e705c, 2, 'passRiser'), {}, [1, 1]);
  for (const r of LV.ramps) S.add(stairs(r, tread, riser, 0.5));
  // the decks: slabs over the ramparts' tops; a parapet of pale stone along every drop, and along the stairs' cheeks
  const slab = T.material(T.bricks(0x9a9a84, 2, 'passSlab'), { color: 0xdcdccc }, [1, 1]), cap = T.material(T.rock(0xc0c0ac, 'passCap', 0.3), { color: 0xe8e8dc }, [0.5, 0.5]);
  S.add(shade(merged(slab, DECKS.map(([x0, z0, x1, z1, y]) => box(slab, x0, y - 0.04, z0, x1, y + 0.02, z1, 1)))));
  const walls = [], caps = [];
  const parapet = (x0, z0, x1, z1, y) => {   // a low solid wall, 0.14 thick, a wider cap on it
    const along = Math.abs(x1 - x0) >= Math.abs(z1 - z0), t = 0.07, c = 0.1;
    if (along) { walls.push(box(cap, x0, y, z0 - t, x1, y + 0.3, z0 + t, 0.5)); caps.push(box(cap, x0 - 0.02, y + 0.3, z0 - c, x1 + 0.02, y + 0.37, z0 + c, 0.5)); }
    else { walls.push(box(cap, x0 - t, y, z0, x0 + t, y + 0.3, z1, 0.5)); caps.push(box(cap, x0 - c, y + 0.3, z0 - 0.02, x0 + c, y + 0.37, z1 + 0.02, 0.5)); }
  };
  for (const [x0, z0, x1, z1, y] of DECKS) {
    if (x1 - x0 < 0.6 || z1 - z0 < 0.9) continue;   // (the inner yard's walls: a cap only)
    parapet(x0, z1 - 0.1, x1, z1 - 0.1, y);   // its drop
  }
  for (const [x0, z0, x1, z1] of [[9.25, 9, 9.75, 14], [14.25, 9, 14.75, 14]]) caps.push(box(cap, x0 - 0.03, T2 + CAP, z0, x1 + 0.03, T2 + CAP + 0.08, z1, 0.5));
  for (const [x0, z0, x1, z1, , head] of STAIRS) for (const [x, out] of [[x0 + 0.08, x0 - 0.1], [x1 - 0.08, x1 + 0.1]]) { const y = LV.at(out, (z0 + z1) / 2); if (y >= head + CAP - 0.01) parapet(x, z0, x, z1, y); }   // a cheek on a deck
  parapet(7.9, 3, 7.9, 6, T3 + CAP); parapet(15.1, 3, 15.1, 6, T3 + CAP);   // the upper ramparts' ends over the forecourt
  S.add(shade(merged(cap, walls)), shade(merged(cap, caps)));

  // the north: the wall behind the yards, the stone posts at their ends, 張桂芳's hall
  const wallS = T.material(T.bricks(0x8a8c72, 3, 'passBlocks'), { color: 0xe4e6d4 }, [1, 1]);
  for (const [x0, x1] of [[0, 8], [15, MW]]) { S.add(shade(box(wallS, x0, T3 - 0.5, -0.2, x1, WALL, 0.9, 1))); S.add(shade(box(cap, x0 - 0.02, WALL, -0.25, x1 + 0.02, WALL + 0.08, 0.95, 0.5))); }
  for (const [x0, x1] of [[0, 0.6], [7.4, 8], [15, 15.6], [23.4, MW]]) { S.add(shade(box(wallS, x0, T2 - 0.5, 0.9, x1, WALL, 3, 1))); S.add(shade(box(cap, x0 - 0.03, WALL, 0.9, x1 + 0.03, WALL + 0.08, 3.03, 0.5))); }
  S.add(hall());
  // the gate: the south wall under its coping of brown tiles, the gatehouse on it, seen from outside (the camera's side)
  const brick = T.material(T.bricks(0xd8d4c0, 6, 'passGateBrick'), {}, [1, 1]);
  const brown = T.material(T.roofTiles(0x6a3018, 8, 8), { envMapIntensity: 0.7, side: THREE.DoubleSide }, [1, 1]), brownRim = new THREE.MeshStandardMaterial({ color: 0x7a4428, roughness: 0.5 });
  const coping = (x0, z0, x1, z1, y) => hipRoof(brown, brownRim, x0, x1, z0, z1, y, 0.22, 0.12, 0.04, false);
  for (const [x0, x1] of [[-3, 9.0], [15.0, MW + 3]]) { S.add(shade(box(brick, x0, -0.4, 23.3, x1, GATE, 24.0, 1))); S.add(coping(x0, 23.3, x1, 24.0, GATE)); }
  S.add(shade(box(cap, 9.0, -0.4, 21.1, 15.0, PLINTH, 24.9, 0.5)));   // the gatehouse's stone plinth (its front: the blocked cells of row 21)
  S.add(shade(box(brick, 9.1, PLINTH, 22.45, 14.9, EAVE - 0.15, 24.4, 1)));   // (under the eave's sag)
  for (const x of [9.3, 10.6, 13.4, 14.7]) {
    const col = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, EAVE - PLINTH, 18), M.lacquer)); col.position.set(x, (EAVE + PLINTH) / 2, 24.65); S.add(col);
  }
  S.add(shade(box(M.lacquer, 9.1, EAVE - 0.14, 24.5, 14.9, EAVE, 24.8)));
  const doorM = T.material(T.planks(0x6a4a2a, 3), {});
  S.add(shade(box(doorM, 11.2, PLINTH, 24.38, 12.8, 1.05, 24.44, 2)), shade(box(M.lacquer, 11.1, 1.05, 24.36, 12.9, 1.12, 24.48)));
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshStandardMaterial({ map: plaqueTex('青龍關'), roughness: 0.5, emissive: 0x101010 }));
  plaque.position.set(12, 1.2, 24.82); S.add(plaque);
  S.add(hipRoof(brown, brownRim, 8.95, 15.05, 22.45, 24.5, EAVE, 0.5, 0.45, 0.2));
  S.add(shade(box(brick, 10.4, EAVE, 22.9, 13.6, EAVE + 0.45, 24.0, 1)));
  S.add(hipRoof(brown, brownRim, 10.2, 13.8, 22.85, 24.1, EAVE + 0.5, 0.6, 0.4, 0.2));
  for (const [x, f] of [[8.5, 1], [15.5, -1]]) S.add(lion(cap, x, 22.5, f));   // a stone lion either side of the plinth

  // past the map: the mountains (west, east, north), pines and boulders on them; the road out of the gate (south)
  const rockM = T.material(T.rock(0x7c7c66, 'passMountain', 0.6), { color: 0xd8d8c8 }, [1, 1]);
  S.add(slope(-16, 0, 0, 34, rockM), slope(MW, MW + 16, 0, 34, rockM), slope(-16, MW + 16, -16, 0, rockM));
  const outT = T.material(T.dirt(0x8a8466, 'passRoad'), { color: 0xb8b49a }, [10, 6]);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(MW, 12).rotateX(-Math.PI / 2), outT); out.position.set(MW / 2, -0.02, 29.85); out.receiveShadow = true; S.add(out);
  const tm = treeMats();
  TREES.forEach(([x, z], k) => S.add(tree(tm, x, z, LV.at(x, z), 0.9, k + 1)));
  for (let k = 0; k < 26; k++) {   // pines on the slopes, more further out
    const side = k % 3, x = side === 0 ? -1.2 - R(k) * 9 : side === 1 ? MW + 1.2 + R(k) * 9 : -4 + R(k) * (MW + 8), z = side === 2 ? -1.2 - R(k + 9) * 6 : R(k + 9) * 30;
    S.add(tree(tm, x, z, mountain(x, z) - 0.1, 1.0 + R(k + 3) * 0.4, k + 30));
  }
  for (let k = 0; k < 18; k++) { const side = k % 2, x = side ? MW + 0.6 + R(k + 50) * 4 : -0.6 - R(k + 50) * 4, z = R(k + 60) * 26; S.add(rock(tm.stone, x, z, mountain(x, z) - 0.2, 1.2 + R(k) * 1.5, k + 7)); }
  // grass tufts over the original's patches: on the floors, not on the stairs, decks or under the buildings
  const pts = [], W4 = MW * 4, onDeck = (x, z) => DECKS.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1);
  for (let j = 4; j < 23 * 4; j++) for (let i = 0; i < W4; i++) if (lay[j * W4 + i] === CL.grass) for (let k = 0; k < 3; k++) {
    const x = (i + R(i * 13 + j + k)) / 4, z = (j + R(j * 11 + i + k * 7)) / 4;
    if (STAIR_CELLS.some(([a, b]) => a === Math.floor(x) && b === Math.floor(z)) || onDeck(x, z) || LV.ramps.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) || (z > 21 && x > 8.3 && x < 15.7)) continue;
    pts.push([x, LV.at(x, z), z]);
  }
  S.add(grass(pts, { size: 0.42, cols: ['#3a6a26', '#4a7e2e', '#2e5a20', '#5a8a36'] }));
  for (const [x, y] of CHESTS) { const c = chest(M, x + 0.5, y + 0.5, LV.at(x + 0.5, y + 0.5), false, 0, 1.4); S.add(c); chestG.set(x + ',' + y, c); }
  void FX;
}
// a stone lion on a pedestal, sitting, turned a little towards the way in (f: 1 west of it, -1 east)
function lion(stone, x, z, f) {
  const g = new THREE.Group(), S = (r, px, py, pz, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), stone); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); g.add(m); };
  g.add(box(stone, -0.3, 0, -0.26, 0.3, 0.38, 0.26, 0.5), box(stone, -0.34, 0.38, -0.3, 0.34, 0.44, 0.3, 0.5));
  S(0.2, 0, 0.62, -0.05, 1, 1.15, 1.1); S(0.16, 0, 0.88, 0.1, 1.1, 1, 1);   // body, chest
  S(0.17, 0, 1.08, 0.12, 1.15, 1, 1); S(0.08, 0, 1.03, 0.27);                 // the maned head, the muzzle
  for (const sx of [-0.1, 0.1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), stone); l.position.set(sx, 0.58, 0.16); g.add(l); }
  g.position.set(x, PLINTH * 0, z); g.rotation.y = f * 0.35; return shade(g);
}
// 張桂芳's hall: a stone plinth, red brick walls, red lattice windows either side of a four-leaf door, timber posts, a
// brown hip roof with upturned corners
function hall() {
  const g = new THREE.Group(), y = T2, x0 = 8.25, x1 = 14.75, z0 = 0.3, z1 = 3.0, H = 1.45;
  const stoneM = T.material(T.bricks(0x8a8478, 2, 'plinth'), {}), brickM = T.material(T.bricks(0xa0503a, 6, 'redBrick'), {}, [1, 1]);
  const timber = T.material(T.wood(0x5a3820, 'timber'), {}, [1, 1]), doorM = T.material(T.planks(0x7a4422, 3), {});
  g.add(box(stoneM, x0 - 0.08, y, z0 - 0.08, x1 + 0.08, y + 0.14, z1 + 0.1, 1), box(brickM, x0, y + 0.14, z0, x1, y + H, z1, 1));
  for (const px of [x0, 10.85, 12.15, x1]) g.add(box(timber, px - 0.08, y + 0.14, z1 - 0.04, px + 0.08, y + H, z1 + 0.06, 2));
  g.add(box(timber, x0 - 0.06, y + H - 0.14, z1 - 0.05, x1 + 0.06, y + H, z1 + 0.07, 2));
  for (const [xa, xb] of [[8.55, 10.6], [12.4, 14.45]]) {   // the windows: white paper behind red lattice, over a brick sill
    const wy0 = y + 0.5, wy1 = y + H - 0.24;
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, wy1 - wy0), new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.9, emissive: 0x2a2418 })); pp.position.set((xa + xb) / 2, (wy0 + wy1) / 2, z1 + 0.02); g.add(pp);
    const lm = M.lattice.clone(); lm.map = lm.map.clone(); lm.map.repeat.set((xb - xa) * 1.8, (wy1 - wy0) * 1.8); lm.map.needsUpdate = true; lm.color = new THREE.Color(0xb02818);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, wy1 - wy0), lm); lt.position.set((xa + xb) / 2, (wy0 + wy1) / 2, z1 + 0.035); g.add(lt);
    g.add(box(timber, xa - 0.05, wy0 - 0.06, z1, xb + 0.05, wy0, z1 + 0.07), box(timber, xa - 0.05, wy1, z1, xb + 0.05, wy1 + 0.06, z1 + 0.07));
  }
  for (let k = 0; k < 4; k++) {   // the door: four leaves, lattice in their upper halves
    const a = 10.95 + k * 0.3, b = a + 0.28; g.add(box(doorM, a, y + 0.14, z1 - 0.02, b, y + H - 0.16, z1 + 0.02, 2));
    const lm = M.lattice.clone(); lm.color = new THREE.Color(0x4a2410); const lt = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.42), lm); lt.position.set((a + b) / 2, y + H - 0.48, z1 + 0.03); g.add(lt);
  }
  const roof = T.material(T.roofTiles(0x5a2a1a, 8, 8), { envMapIntensity: 0.7, side: THREE.DoubleSide }, [1, 1]), rim = new THREE.MeshStandardMaterial({ color: 0x6a3a26, roughness: 0.45 });
  g.add(hipRoof(roof, rim, x0, x1, z0, z1, y + H, 1.15, 0.5, 0.24));
  // the gable panel at the front of the ridge (the original's white triangle with its lattice board)
  const tri = new THREE.Shape(); tri.moveTo(-0.9, 0); tri.lineTo(0.9, 0); tri.lineTo(0, 0.62); tri.closePath();
  const gab = new THREE.Mesh(new THREE.ShapeGeometry(tri), T.material(T.plaster(0xf2eee4), { side: THREE.DoubleSide }, [0.6, 0.6])); gab.position.set(11.5, y + H + 0.62, 1.95); g.add(gab);
  g.add(box(timber, 10.9, y + H + 0.7, 1.96, 12.1, y + H + 0.92, 1.99, 2));
  return shade(g);
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y);
  if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
// a chest the map does not draw ((0, 18) and (23, 22)): struck, it shows up open
function found(x, y) {
  if (!world) return;
  const g = chest(M, x + 0.5, y + 0.5, LV.at(x + 0.5, y + 0.5), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g); chestG.set(x + ',' + y, g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}
// the solid tops: the floors and decks, the north wall and posts, the hall, the gate wall and the gatehouse's eaves
function ground(x, z) {
  if (x >= 9 && x < 15 && z >= 21.1 && z < 22.45) return PLINTH;
  if (x >= 8.55 && x < 15.45 && z >= 22.45) return EAVE;
  if (z >= 23.3 && z < 24) return GATE;
  if (z < 0.9 && (x < 8 || x >= 15)) return WALL;
  if (z < 3 && (x < 0.6 || x >= 23.4 || (x >= 7.4 && x < 8) || (x >= 15 && x < 15.6))) return WALL;
  if (z < 2.85 && x >= 8.25 && x < 14.75 && z >= 0.3) return T2 + 1.45;   // (its doorstep level: 法師 steps out there in scene 32)
  return LV.at(x, z);
}
const TREE_CELLS = [[8, 3], [9, 3], [8, 4], [9, 4], [8, 5], [9, 5], [8, 6], [9, 6], [13, 3], [14, 3], [13, 4], [14, 4], [13, 5], [14, 5], [13, 6], [14, 6]];
export default {
  build, openChest, ground, slopes: STAIR_CELLS, props: TREE_CELLS.concat(CHESTS, [[8, 22], [15, 22]]),
  // a clear mountain afternoon: the sun from the south-west, a cool sky
  mood: { bg: 0xa8c0d8, voidCol: false, fog: 0xb4c4d4, fogD: 0.012, sky: 0xd8e6f4, under: 0x4a4a3a, hemi: 1.0,
    sun: 0xfff0d8, sunI: 2.6, sunDir: [-0.45, 0.8, 0.5], sat: 1.02, exposure: 1.0, bloom: 0.25, aoR: 0.8,
    env: { top: 0xb8cce0, mid: 0x8a8c7a, low: 0x3a3a2c, lights: [[-6, 8, 4, 0xfff0d8, 3]] } },
};

// ---------------------------------------------------------------- 鄂順's council room (map 0f3a2c, 16 x 15)
// Measured on tools/qa/grid.py 0f3a2c: the floor x 3-12 from the back wall (z 1.75) to the front, brown tiles inlaid with
// pale diamonds; along the back blue fret panels (x 3-5 and 10-12) over a dark dado, two red columns (x 5.5 and 9.5)
// on green drums, gold curtains drawn back from a red-and-white folding screen between them; two bronze jars of gilt
// arrows (4.5 and 10.5, row 2); a red carpet with a gold border (x 5-10, rows 3-6), the low desk on it (x 6.5-8.5, row 4)
// and 鄂順's round cushion behind it (7.5, 3.5). The side walls are thin, the dark beyond them as on the original.
function decal(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const diamondTex = () => {   // a tile a cell: brown, a pale grout grid, a stepped diamond in the middle
  const t = decal((g, n) => {
    g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${R(i) < 0.5 ? '60,40,24' : '170,140,104'},0.12)`; g.fillRect(R(i + 1) * n, R(i + 2) * n, 3, 3); }
    g.strokeStyle = '#d8c4a0'; g.lineWidth = n * 0.025; g.strokeRect(0, 0, n, n); g.beginPath(); g.moveTo(n / 2, 0); g.lineTo(n / 2, n); g.moveTo(0, n / 2); g.lineTo(n, n / 2); g.stroke();
    g.fillStyle = '#d8c4a0'; const c = n / 2;
    for (const r of [0.34, 0.2]) { g.beginPath(); g.moveTo(c, c - r * n); g.lineTo(c + r * n, c); g.lineTo(c, c + r * n); g.lineTo(c - r * n, c); g.closePath(); g.fill(); g.fillStyle = '#8a6a4a'; g.beginPath(); g.moveTo(c, c - (r - 0.06) * n); g.lineTo(c + (r - 0.06) * n, c); g.lineTo(c, c + (r - 0.06) * n); g.lineTo(c - (r - 0.06) * n, c); g.closePath(); g.fill(); g.fillStyle = '#d8c4a0'; }
  }, 256, 256);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const fretTex = () => decal((g, w, h) => {   // the blue panels: a gold-edged board of blue and white key fret
  g.fillStyle = '#1a3a9a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8b030'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  const s = 32; g.lineWidth = 6;
  for (let y = 40; y < h - 40; y += s * 2) for (let x = 40; x < w - 40; x += s * 2) {
    g.strokeStyle = (x / s + y / s) % 4 < 2 ? '#e8f0ff' : '#f0c040';
    g.beginPath(); g.moveTo(x, y + s * 1.5); g.lineTo(x, y); g.lineTo(x + s * 1.5, y); g.lineTo(x + s * 1.5, y + s); g.lineTo(x + s * 0.5, y + s); g.lineTo(x + s * 0.5, y + s * 0.5); g.stroke();
  }
}, 256, 512);
function jar(x, z) {   // a squat bronze-brown jar holding gilt arrows
  const g = new THREE.Group(), glaze = T.material(T.bronze(), { color: 0x9a7a5a, envMapIntensity: 1.1 });
  g.add(shade(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.34, 0.14], [0.36, 0.3], [0.26, 0.48], [0.15, 0.54], [0.17, 0.6], [0, 0.6]].map(([a, b]) => new THREE.Vector2(a, b)), 32), glaze)));
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05, d = new THREE.Vector3(Math.cos(a) * 0.25, 1, Math.sin(a) * 0.2).normalize(), s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), M.gold);
    s.position.copy(d.clone().multiplyScalar(0.3)).add(new THREE.Vector3(0, 0.5, 0)); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(s);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), M.gold); f.position.copy(d.clone().multiplyScalar(0.62)).add(new THREE.Vector3(0, 0.5, 0)); f.quaternion.copy(s.quaternion); g.add(f);
  }
  g.position.set(x, 0, z); return shade(g);
}
function deskG(x, z) {   // the low desk: yellow lacquer, a scroll laid open, brushes in a rack, a seal
  const g = new THREE.Group(), yel = T.material(T.lacquer(0xd8a818, 'yellowLacquer'), { clearcoat: 0.8, clearcoatRoughness: 0.2 }), dark = T.material(T.lacquer(0x2a1410, 'blackLacquer'), {});
  g.add(box(yel, -0.95, 0.32, -0.36, 0.95, 0.42, 0.36), box(dark, -0.97, 0.3, -0.38, 0.97, 0.33, 0.38));
  for (const sx of [-1, 1]) g.add(box(dark, sx * 0.85 - 0.08, 0, -0.32, sx * 0.85 + 0.08, 0.3, 0.32), box(dark, sx * 0.85 - 0.12, 0, -0.34, sx * 0.85 + 0.12, 0.05, 0.34));
  const paper = new THREE.MeshStandardMaterial({ color: 0xf0e8d4, roughness: 0.8 });
  g.add(box(paper, -0.4, 0.42, -0.14, 0.45, 0.43, 0.12));
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.3, 6), dark); b.rotation.z = Math.PI / 2; b.position.set(-0.7, 0.46, -0.15 + k * 0.05); g.add(b); }
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), M.jade); seal.position.set(0.72, 0.48, 0); g.add(seal);
  g.position.set(x, 0, z); return shade(g);
}
async function buildHall(E, FX) {
  const S = E.world.scene; M = mats({ lacquer: 0xc01810, lacquerDark: 0x2a0806, silk: 0xf0b020 }); world = E.world;
  const fl = diamondTex(); fl.repeat.set(9, 13.25);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 13.25), [0, 0, 1, 0, 0, 0].map(k => k ? new THREE.MeshStandardMaterial({ map: fl, roughness: 0.6, envMapIntensity: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0x3a2a1a })));
  floor.position.set(7.5, -0.2, 8.375); floor.receiveShadow = true; S.add(floor);
  // the back wall: blue fret panels over a dark dado either side; behind the screen the wall in dark lacquer
  const fret = new THREE.MeshStandardMaterial({ map: fretTex(), roughness: 0.5, envMapIntensity: 0.6 });
  for (const [x0, x1] of [[3, 5], [10, 12]]) {
    for (const xa of [x0, x0 + 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.9), fret); p.position.set(xa + 0.5, 1.55, 1.62); S.add(p); }
    S.add(shade(box(M.lacquerDark, x0, 0, 1.6, x1, 0.55, 1.8, 1)), shade(box(M.gold, x0, 0.55, 1.58, x1, 0.6, 1.82, 1)));
  }
  S.add(shade(box(M.lacquerDark, 2.9, 0, 1.3, 12.1, 3.2, 1.55, 1)));
  const lat = T.material(T.paper(0xfaf2e4), { emissive: new THREE.Color(1, 0.94, 0.82), emissiveIntensity: 0.4, side: THREE.DoubleSide });
  S.add(screen(M, 6.1, 8.9, 1.85, 0, 2.1, 6, lat));
  S.add(curtain(M, 5.95, 7.45, 2.15, 3.0, 2.9, 'l', 5), curtain(M, 7.55, 9.05, 2.15, 3.0, 2.9, 'r', 5));
  S.add(shade(box(M.lacquer, 5.2, 2.95, 2.0, 9.8, 3.15, 2.3)));
  for (const x of [5.5, 9.5]) S.add(pillar(M, x, 2.4, 0, 2.95, 0.3));
  S.add(jar(4.5, 2.5), jar(10.5, 2.5));
  // the sides: low lattice partitions on pale posts (the original's thin strips), and past them the hall's dim aisles,
  // more floor, columns and fret panels running on into the dark
  const post = T.material(T.wood(0xc8b48a, 'palePost'), {}, [1, 1]), ps = [];
  for (const x of [2.92, 12.08]) {
    for (let z = 2; z <= 15; z += 1) ps.push(box(post, x - 0.07, 0, z - 0.07, x + 0.07, 1.0, z + 0.07, 1));
    ps.push(box(post, x - 0.05, 0.86, 1.6, x + 0.05, 0.94, 15.2, 1), box(post, x - 0.05, 0.08, 1.6, x + 0.05, 0.14, 15.2, 1));
    const lp = M.lattice.clone(); lp.map = lp.map.clone(); lp.map.repeat.set(13 * 1.6, 0.7 * 1.6); lp.map.needsUpdate = true; lp.color = new THREE.Color(0x5a3018);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 0.72), lp); l.rotation.y = Math.PI / 2; l.position.set(x, 0.5, 8.4); S.add(l);
  }
  S.add(shade(merged(post, ps)));
  for (const [a, b] of [[-6, 2.85], [12.15, 21]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 13.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: fl.clone(), roughness: 0.6, color: 0xb0a090 }));
    f.material.map.repeat.set(b - a, 13.4); f.material.map.needsUpdate = true; f.position.set((a + b) / 2, -0.001, 8.3); f.receiveShadow = true; S.add(f);
    S.add(shade(box(M.lacquerDark, a, 0, 1.3, b, 3.2, 1.55, 1)));
    for (let x = a + 0.5; x < b - 0.4; x += 1) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.9), fret); p.position.set(x, 1.55, 1.62); S.add(p); }
    S.add(shade(box(M.lacquerDark, a, 0, 1.6, b, 0.55, 1.8, 1)), shade(box(M.gold, a, 0.55, 1.58, b, 0.6, 1.82, 1)));
    for (const x of a < 0 ? [0.4, -2.6] : [14.6, 17.6]) for (const z of [2.4, 6.4, 10.4, 14.4]) S.add(pillar(M, x, z, 0, 2.95, 0.26));
  }
  // the carpet, the desk, the cushion
  const rugM = T.material(T.carpet(0xc01010), {}); for (const k of ['map', 'normalMap', 'roughnessMap']) if (rugM[k]) { rugM[k] = rugM[k].clone(); rugM[k].repeat.set(1, 0.6); rugM[k].needsUpdate = true; }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3).rotateX(-Math.PI / 2), rugM); rug.position.set(7.5, 0.012, 4.5); rug.receiveShadow = true; S.add(rug);
  S.add(deskG(7.5, 4.45));
  const silkO = T.material(T.silk(0xe8901a), { sheen: 1, sheenColor: new THREE.Color(1, 0.8, 0.4) }), cu = new THREE.Group();
  const c0 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 28), silkO); c0.position.y = 0.07; cu.add(c0);
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 8, 0, 6.3, 0, 0.5), silkO); c1.position.y = 0.07; c1.scale.y = 0.35; cu.add(c1);
  const bt = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.gold); bt.position.y = 0.19; cu.add(bt);
  cu.position.set(7.5, 0.012, 3.55); S.add(shade(cu));
  for (const x of [3.5, 11.5]) FX.fire(E, { x, y: 2.2, z: 1.55, size: 0.35, light: 4, col: 0xffa860, smoke: false });
  for (const x of [3.5, 11.5]) S.add(shade(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.18, 0], [0.16, 0.05], [0.05, 0.12], [0.04, 1.5], [0.12, 1.55], [0, 1.55]].map(([a, b]) => new THREE.Vector2(a, b)), 20), M.bronze)).translateX(x).translateZ(2.2));
}
export const passHall = {
  build: buildHall, ground: () => 0, particles: 'dust',
  mood: { bg: 0x050302, voidCol: 0x050302, voidY: -0.4, fog: 0x050302, fogD: 0.025, sky: 0xffe0b0, under: 0x2a1a0a, hemi: 0.75,
    sun: 0xffd8b0, sunI: 1.6, sunDir: [-0.25, 0.9, 0.4], sat: 1.04, exposure: 1.1, bloom: 0.4,
    env: { top: 0x8a6a48, mid: 0x4a3420, low: 0x1a1008, lights: [[0, 6, -8, 0xfff0d0, 5], [-6, 4, 2, 0xffc080, 3], [6, 4, 2, 0xffc080, 3]] } },
  lights: [{ x: 7.5, y: 2.6, z: 7, col: 0xffb070, i: 4, d: 10 }],
};
