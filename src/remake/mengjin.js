// 孟津, the ford town where the lords were to gather (maps 0fc438 and 0fc4b8, the same art: scene 60 and battle 29),
// remade: a walled town of earth lanes and grass, the fighting just over (scene 60: 林雲 sees there has been a battle here). Measured on
// tools/qa/grid.py 0fc438:
//   the walls      ashlar of pale khaki stone: the north wall (rows 0-1) either side of the way out (x 10-14), the west and
//                  east walls (x 0, x 23), the south wall (rows 26-28, its top drawn at row 26) either side of the way in;
//                  kept low on the south, where the heroes stand right behind it
//   houses         three tiled in blue glaze, plaster over brick (x 3-8 rows 3-6; x 15-20 rows 11-14; x 12-17 rows 19-22),
//                  three thatched huts of logs (x 10-14 rows 5-9; x 19-23 rows 16-20; x 4-8 rows 20-24), two halls of dark
//                  timber, their white gables to the lane (x 18-23 rows 4-9; x 3-8 rows 12-16)
//   the ground     the art's packed earth and grass, a shrub in each blocked cell no building takes
// Past the walls the fields, the road on north and south, trees; smoke going up beyond the north wall. A grey afternoon.
// The town after the fighting (kit/damage.js): the breaks the art draws in every roof, wall, door and window, soot over
// some, two roofs still smoking; the lanes scorched and holed, tiles, straw and boards fallen at the houses' feet [the
// user's call: the floors too].
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, house, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, shrubs, windTick } from '../kit/terrain.js';
import { hut } from './bambooroad.js';
import { tree, treeMats } from './citygate.js';
import { D } from '../rules.js';
import { batter } from '../kit/damage.js';

const MW = 24, MH = 30, NORTH_H = 2.2, SIDE_H = 1.3, SOUTH_H = 0.7;
const PALETTE = { [CL.ground]: [0x90906c, 0x484824], [CL.grass]: [0x009000, 0x002400, 0x90d800] };
const TILED = [
  { x0: 3.05, x1: 7.95, z0: 3.1, z1: 5.85, doors: [5.5], windows: [[3.4, 4.85], [6.15, 7.6]], posts: [4.95, 6.05] },
  { x0: 15.05, x1: 19.95, z0: 11.1, z1: 13.85, doors: [17.5], windows: [[15.4, 16.85], [18.15, 19.6]], posts: [16.95, 18.05] },
  { x0: 12.05, x1: 16.95, z0: 19.1, z1: 21.85, doors: [14.5], windows: [[12.4, 13.85], [15.15, 16.6]], posts: [13.95, 15.05] },
];
const HUTS = [{ x0: 10.1, x1: 13.9, z0: 5.7, z1: 8.6 }, { x0: 19.1, x1: 22.9, z0: 16.7, z1: 19.6 }, { x0: 4.1, x1: 6.9, z0: 20.7, z1: 23.6 }];   // (the third's walls short of its last column: scene 60's lords' men line up along it, f1354-1385, drawn over its edge in the original)
const UNDER_EAVE = [[7, 20], [7, 21], [7, 22], [7, 23]];   // (blocked; the hut's eave over them)
const HALLS = [{ x0: 18.1, x1: 22.9, z0: 5.05, z1: 8.75 }, { x0: 3.1, x1: 7.9, z0: 13.05, z1: 15.75 }];
const ROOF = [[19, 4], [20, 4], [21, 4], [4, 12], [5, 12], [6, 12]];   // the halls' cells the art blocks for their tall roofs (the cells beside them open)
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const inR = (x, z, r, m = 0) => x >= r.x0 - m && x < r.x1 + m && z >= r.z0 - m && z < r.z1 + m;
// the buildings' blocked cells (whole cells), the walls'
const CELLS = [[3, 3, 8, 6], [15, 11, 20, 14], [12, 19, 17, 22], [10, 5, 14, 9], [19, 16, 24, 20], [4, 20, 8, 24], [18, 5, 24, 9], [3, 13, 8, 16], [19, 4, 22, 5], [4, 12, 7, 13]];
const isWall = (x, y) => x === 0 || x === MW - 1 || (y <= 1 && (x < 10 || x > 13)) || (y >= 26 && y <= 28 && (x < 10 || x > 13));
const isBuilt = (x, y) => CELLS.some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d);
// the lanes' scars: scorch and shell-holes on cells no building or wall takes, the same every time [x, z, size, kind]
function scars() { if (scars.list) return scars.list; const out = [], open = [];
  for (let y = 2; y < 26; y++) for (let x = 1; x < MW - 1; x++) if (!isBuilt(x, y) && !isWall(x, y)) open.push([x, y]);
  for (let i = 0; i < 22; i++) { const [x, y] = open[Math.floor(R(i * 9.7 + 40) * open.length)], crater = i % 3 === 2;
    out.push([x + 0.2 + R(i * 3.3 + 41) * 0.6, y + 0.2 + R(i * 5.1 + 42) * 0.6, crater ? 0.9 + R(i + 43) * 0.5 : 1.2 + R(i + 44) * 1.0, crater ? 'crater' : 'scorch']); }
  return (scars.list = out); }
const scarred = (x, z) => scars().some(([a, b, k]) => Math.hypot(x - a, z - b) < k * 0.38);
let land = null;

// a hall: its gable to the lane, as drawn: a stone plinth, walls of dark boards with lattice windows and a door in the
// middle, the roof's two slopes falling east and west in dark tiles, the white gable under its eaves with its lattice vent
function hall(M, o) {
  const g = new THREE.Group(), y = o.y ?? 0, H = 1.35, W = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2, rise = 1.5, ov = 0.38, top = y + H;
  const boards = T.material(T.planks(0x3e2818, 5), {}, [1, 1]), timber = T.material(T.wood(0x2a1a10, 'mjTimber'), {}, [1, 1]);
  const plaster = T.material(T.plaster(0xece4d2), {}, [0.6, 0.6]), stone = T.material(T.bricks(0x8a8476, 2, 'plinth'), {});
  g.add(box(stone, o.x0 - 0.06, y, o.z0 - 0.06, o.x1 + 0.06, y + 0.18, o.z1 + 0.06, 1));
  g.add(box(boards, o.x0, y + 0.18, o.z0, o.x1, top, o.z1, 1));
  for (const px of [o.x0, o.x0 + W * 0.3, cx - 0.5, cx + 0.5, o.x1 - W * 0.3, o.x1]) g.add(box(timber, px - 0.07, y + 0.18, o.z1 - 0.04, px + 0.07, top, o.z1 + 0.06, 2));
  g.add(box(timber, o.x0 - 0.05, top - 0.14, o.z1 - 0.05, o.x1 + 0.05, top, o.z1 + 0.07, 2));
  for (const [xa, xb] of [[o.x0 + 0.25, o.x0 + W * 0.3 - 0.2], [o.x1 - W * 0.3 + 0.2, o.x1 - 0.25]]) {   // lattice windows over white paper
    const wy0 = y + 0.6, wy1 = top - 0.28;
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, wy1 - wy0), new THREE.MeshStandardMaterial({ color: 0xeee4ca, roughness: 0.9, emissive: 0x2a2010 })); pp.position.set((xa + xb) / 2, (wy0 + wy1) / 2, o.z1 + 0.03); g.add(pp);
    const lm = M.lattice.clone(); lm.map = lm.map.clone(); lm.map.repeat.set((xb - xa) * 1.6, (wy1 - wy0) * 1.6); lm.map.needsUpdate = true; lm.color = new THREE.Color(0x3a2014);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, wy1 - wy0), lm); lt.position.set((xa + xb) / 2, (wy0 + wy1) / 2, o.z1 + 0.045); g.add(lt);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.86, H - 0.4), T.material(T.planks(0x6a4428, 3), {})); door.position.set(cx, y + 0.18 + (H - 0.4) / 2, o.z1 + 0.03); g.add(door);
  g.add(box(stone, cx - 0.55, y, o.z1, cx + 0.55, y + 0.1, o.z1 + 0.2));
  // the roof: two slopes from the ridge (along z) down to the eaves east and west, overhanging front and back
  const rm = T.material(T.roofTiles(0x3a2a22, 8, 8), { envMapIntensity: 0.6, side: THREE.DoubleSide }, [Math.hypot(W / 2 + ov, rise) / 1.1, (o.z1 - o.z0 + ov * 2) / 1.1]);
  for (const s of [-1, 1]) {
    const geo = new THREE.BufferGeometry(), N = 10, P = [], UV = [], I = [], ex = s < 0 ? o.x0 - ov : o.x1 + ov;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= 1; j++) { const t = i / N, sag = Math.sin(t * Math.PI) * 0.1; P.push(cx + (ex - cx) * t, top + rise + (-0.12 - rise) * t - sag, j ? o.z1 + ov : o.z0 - ov); UV.push(t, j); }
    for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (s > 0) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
    g.add(shade(new THREE.Mesh(geo, rm)));
  }
  const ridge = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 0.4 });
  g.add(box(ridge, cx - 0.13, top + rise - 0.06, o.z0 - ov - 0.05, cx + 0.13, top + rise + 0.16, o.z1 + ov + 0.05));
  for (const z of [o.z0 - ov - 0.05, o.z1 + ov + 0.05]) { const h = shade(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), ridge)); h.position.set(cx, top + rise + 0.3, z); g.add(h); }
  // the gable to the lane: white plaster in a timber frame, a lattice vent at its peak; its barge boards
  const tri = new THREE.Shape(); tri.moveTo(-W / 2, 0); tri.lineTo(W / 2, 0); tri.lineTo(0, rise); tri.closePath();
  for (const [z, f] of [[o.z1 + 0.02, 1], [o.z0 - 0.02, -1]]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), plaster); m.position.set(cx, top, z); if (f < 0) m.rotation.y = Math.PI; g.add(shade(m));
    if (f > 0) {
      g.add(box(timber, cx - 0.05, top, z, cx + 0.05, top + rise - 0.1, z + 0.05), box(timber, o.x0, top + 0.02, z, o.x1, top + 0.1, z + 0.05));
      const v = M.lattice.clone(); v.color = new THREE.Color(0x3a2014); const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), v); vent.position.set(cx, top + rise * 0.48, z + 0.03); g.add(vent);
      for (const s of [-1, 1]) { const len = Math.hypot(W / 2 + ov, rise + 0.12), bb = box(timber, -len / 2, -0.06, 0, len / 2, 0.06, 0.06); bb.position.set(cx + s * (W / 2 + ov) / 2, top + rise / 2 - 0.06, o.z1 + ov - 0.02); bb.rotation.z = -s * Math.atan2(rise + 0.12, W / 2 + ov); g.add(bb); }
    }
  }
  return shade(g);
}
// the town wall: ashlar to its height, a coping of dressed stone (x0..x1, z0..z1 in cells)
function wall(m, x0, z0, x1, z1, h) {   // (its top laid in dressed blocks, coped along its edges)
  const e = 0.16, t = h + 0.08;
  return [box(m.ashlar, x0, -0.6, z0, x1, h, z1, 1), box(m.top, x0 + e, h, z0 + e, x1 - e, h + 0.05, z1 - e, 0.5),
    box(m.cope, x0 - 0.04, h, z0 - 0.04, x1 + 0.04, t, z0 + e, 1), box(m.cope, x0 - 0.04, h, z1 - e, x1 + 0.04, t, z1 + 0.04, 1),
    box(m.cope, x0 - 0.04, h, z0 + e, x0 + e, t, z1 - e, 1), box(m.cope, x1 - e, h, z0 + e, x1 + 0.04, t, z1 - e, 1)];
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/0fc438.png', MW, MH, PALETTE, { [CL.grass]: 1.2 });
  const W4 = MW * 4;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (isWall(x, y) || isBuilt(x, y) || y >= 29) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const k = (y * 4 + j) * W4 + x * 4 + i; if (lay[k] === CL.rock) lay[k] = CL.ground; }
  // past the walls: fields of grass, the road north and south through the gates
  const outside = (x, z) => (x >= 9.6 && x < 14.4 && (z < 0 || z >= MH)) ? CL.ground : CL.grass;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 16, outside, rockH: 0, lumpH: 0.04,
    tex: { dirt: T.dirt(0x9a8a62, 'mjDirt'), turf: T.turf(0x4e6e2a), rock: T.rock(0x7a7464, 'mjRock') }, tint: { dirt: 0xf4ece0, turf: 0xe8f0d8, rock: 0xffffff } });
  S.add(land.mesh({ dirtK: 0.3, turfK: 0.35 }));
  const m = { ashlar: T.material(T.bricks(0xb8b294, 3, 'mjWall'), { color: 0xf0ece0 }, [1, 1]), cope: T.material(T.rock(0xc8c4a8, 'mjCope', 0.3), { color: 0xf4f2e4 }, [0.5, 0.5]), top: T.material(T.flags(0xb4ae90, 0xa29c80, 'mjWallTop', 4, 0, 0x5a5444), {}, [1, 1]) };
  const walls = [];
  walls.push(...wall(m, 0, -0.6, 10, 2, NORTH_H), ...wall(m, 14, -0.6, MW, 2, NORTH_H));
  walls.push(...wall(m, 0, 2, 1, 26, SIDE_H), ...wall(m, MW - 1, 2, MW, 26, SIDE_H));
  walls.push(...wall(m, 0, 26, 10, 29, SOUTH_H), ...wall(m, 14, 26, MW, 29, SOUTH_H));
  for (const x of [9.75, 14.25]) for (const [z, h] of [[0.85, NORTH_H + 0.35], [27.5, SOUTH_H + 0.3]]) walls.push(box(m.ashlar, x - 0.3, -0.6, z - 0.75, x + 0.3, h, z + 0.75, 1), box(m.cope, x - 0.36, h, z - 0.81, x + 0.36, h + 0.12, z + 0.81, 1));   // the gate piers
  S.add(shade(merged(m.ashlar, walls.filter(w => w.material === m.ashlar))), shade(merged(m.cope, walls.filter(w => w.material === m.cope))), shade(merged(m.top, walls.filter(w => w.material === m.top))));
  // the houses, the huts, the halls
  const built = [];
  for (const h of TILED) { const g = house(M, Object.assign({ y: 0, wallH: 1.3, roof: 0x24467e, rise: 0.85, over: 0.32 }, h)); S.add(g); built.push({ group: g, roof: 7, front: 6, fall: 'tiles', col: 0x24467e }); }
  for (const r of HUTS) { const g = hut(0, r); S.add(g); built.push({ group: g, roof: 6, front: 5, fall: 'straw' }); }
  for (const h of HALLS) { const g = hall(M, h); S.add(g); built.push({ group: g, roof: 8, front: 7, fall: 'tiles', col: 0x3a2a22 }); }
  // the fighting's marks on them and on the lanes; smoke still going up from two roofs
  const free = (x, z) => x > 1.05 && x < MW - 1.05 && z > 2.05 && z < 25.95 && !TILED.some(h => inR(x, z, h, 0.05)) && !HUTS.some(h => inR(x, z, h, 0.05)) && !HALLS.some(h => inR(x, z, h, 0.05)) && !isBuilt(Math.floor(x), Math.floor(z));
  const { smokes } = batter(S, built, { at: (x, z) => land.at(x, z), spots: scars(), free }, 29);
  for (const [x, y, z] of [smokes[3], smokes[6]].filter(Boolean)) FX.smoke(E, { x, y: z, z: y - ground(x, z) + 0.05, size: 0.7, tint: [0.32, 0.3, 0.28] });
  // a shrub in every blocked cell no building or wall takes, as drawn
  const bush = [];
  for (let y = 2; y < 26; y++) for (let x = 1; x < MW - 1; x++) if (D.terrain[y][x] === 2 && !isBuilt(x, y)) for (let k = 0; k < 3; k++) bush.push([x + 0.25 + R(x * 7 + y + k) * 0.5, 0, y + 0.25 + R(y * 5 + x + k * 3) * 0.5]);
  if (bush.length) S.add(shrubs(bush, { size: 0.62, cols: ['#2a4a1c', '#36582a', '#466c30', '#22401a'] }));
  // grass on the green, short (never over the legs); clear of the buildings and the walls
  const clear = (x, z) => !scarred(x, z) && !TILED.some(h => inR(x, z, h, 0.45)) && !HUTS.some(h => inR(x, z, h, 0.5)) && !HALLS.some(h => inR(x, z, h, 0.45)) && !isWall(Math.floor(x), Math.floor(z));
  S.add(grass(land.scatter(CL.grass, 40, clear), { size: 0.3, cols: ['#3e6a22', '#4e7e2a', '#5e8e32', '#2e5a1c'] }));
  // outside: trees along the walls and in the fields
  const TM = treeMats(), spots = [];
  for (let i = 0; i < 26; i++) { const side = i % 4, t = R(i * 3.1); let x, z;
    if (side === 0) { x = -1.5 + t * (MW + 3); z = -2.2 - R(i) * 5; } else if (side === 1) { x = -1.5 + t * (MW + 3); z = 30.6 + R(i) * 4; } else if (side === 2) { x = -1.6 - R(i) * 4; z = t * MH; } else { x = MW + 0.6 + R(i) * 4; z = t * MH; }
    if (x > 8.8 && x < 15.2 && (z < 0 || z > 29)) continue; spots.push([x, z]); }
  for (const [x, z] of spots) S.add(tree(TM, x, z, land.at(x, z), 1.05 + R(x + z) * 0.4, x * 3 + z));
  S.add(shrubs(land.scatter(CL.grass, 0.6, (x, z) => (x < -0.5 || x > MW + 0.5 || z < -0.8 || z > 29.5) && !(x > 9 && x < 15)), { size: 0.7, cols: ['#2a4a1c', '#36582a', '#466c30'] }));
  // smoke going up beyond the north wall, where the armies fought
  for (const [x, z, k] of [[5.5, -6, 1.6], [19, -8, 1.3], [-4, 6, 1.1]]) FX.smoke(E, { x, y: z, z: 0.3, size: k, tint: [0.4, 0.38, 0.36] });
  E.world.updaters.push((dt, t) => windTick(t));
}
function ground(x, z) {
  if (!land) return 0;
  const cx = Math.floor(x), cy = Math.floor(z);
  if (cx >= 0 && cx < MW && cy >= 0 && cy < 29 && isWall(cx, cy)) return cy <= 1 ? NORTH_H : cy >= 26 ? SOUTH_H : SIDE_H;
  if (TILED.some(h => inR(x, z, h))) return 1.7;
  if (HALLS.some(h => inR(x, z, h)) || ROOF.some(([a, b]) => a === cx && b === cy)) return 2.0;
  if (HUTS.some(h => inR(x, z, h))) return 1.8;
  return land.at(x, z);
}
// (the set as the world takes it: read only where it shows)
// @qa map:0fc438 battle:29 scene:60
export const mengjin = {
  build, ground, particles: null, war: true,   // (battered: tools/qa/sets.js checks its war marks lie on the buildings)
  get props() { const out = []; for (let y = 2; y < 26; y++) for (let x = 1; x < MW - 1; x++) if (D.terrain && D.terrain[y] && D.terrain[y][x] === 2 && !isBuilt(x, y)) out.push([x, y]); return out.concat(UNDER_EAVE); },
  mood: { bg: 0xb8bcb4, voidCol: false, fog: 0xb4b4aa, fogD: 0.013, sky: 0xd4dce4, under: 0x4a4430, hemi: 1.05,
    sun: 0xffe4c4, sunI: 2.6, sunDir: [-0.5, 0.8, 0.34], sat: 0.96, exposure: 1.0, bloom: 0.25, aoR: 0.8,
    env: { top: 0xc8d0d8, mid: 0x9a9480, low: 0x4a4434, lights: [[-6, 7, 3, 0xfff0d8, 3.5]] } },
};
