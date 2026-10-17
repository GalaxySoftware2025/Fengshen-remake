// 黃龍堡, the southern lords' stronghold (map 0f3298: scene 31, 鄂順 and 姜子牙's council), remade: a yard of trodden grey
// earth with patches of grass, 鄂順's hall along the north (x 3-8, its front at row 3: white plaster gable over a dark
// tiled roof, red lattice windows, a double door), racks of halberds against the north (x 1-3, 8-10, 11-13, 14-16) and
// one by the hut (x 10-12, row 6), a thatched hut in the south-east (x 12.2-15.8, its front at row 7), and the fort's
// palisade of pointed stakes across the south (rows 7-8), open between x 7 and 10 for the gate. Measured on
// tools/qa/grid.py 0f3298. Overcast noon.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, house, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, windTick } from '../kit/terrain.js';
import { hut } from './bambooroad.js';

const MW = 16, MH = 10;
const PALETTE = { [CL.ground]: [0x90906c, 0x6c4848, 0x482424, 0xd8d8b4, 0xfcfcfc], [CL.grass]: [0x009000, 0x002400, 0x90d800] };
const RACKS = [[1.05, 1.0, 2.95], [8.05, 1.0, 9.95], [11.05, 1.0, 12.95], [14.05, 1.0, 15.95], [10.05, 6.0, 11.95]];   // x0, rail z, x1
const STAKES = [[0, 7], [10, 16]];   // the palisade's runs (x from, to) at rows 7-8
let land = null;

// a rack of halberds: two rails on posts, red shafts standing in it, pale crescent blades at the tops
function rack(wood, x0, z, x1, y) {
  const g = new THREE.Group(), parts = [box(wood, x0, y + 0.18, z + 0.32, x1, y + 0.26, z + 0.4), box(wood, x0, y + 0.55, z + 0.32, x1, y + 0.63, z + 0.4)];
  for (const px of [x0 + 0.04, x1 - 0.04]) parts.push(box(wood, px - 0.04, y, z + 0.3, px + 0.04, y + 0.7, z + 0.42));
  g.add(merged(wood, parts));
  const shaftM = new THREE.MeshStandardMaterial({ color: 0x8a1810, roughness: 0.6 }), blade = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 0.8, roughness: 0.25 });
  const n = Math.round((x1 - x0) * 3.3), shaft = new THREE.CylinderGeometry(0.015, 0.015, 1.25, 5).translate(0, 0.625, 0);
  const crescent = new THREE.Shape(); crescent.absarc(0, 0, 0.11, -1.2, 1.2, false); crescent.absarc(0.05, 0, 0.09, 1.1, -1.1, true);
  const bladeGeo = new THREE.ExtrudeGeometry(crescent, { depth: 0.01, bevelEnabled: false }), tip = new THREE.ConeGeometry(0.025, 0.16, 4).translate(0, 0.08, 0);
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * (x1 - x0) / n, s = new THREE.Mesh(shaft, shaftM); s.position.set(x, y, z + 0.36); s.rotation.z = (i % 2 ? 1 : -1) * 0.03; g.add(s);
    const b = new THREE.Mesh(bladeGeo, blade); b.position.set(x + 0.02, y + 1.12, z + 0.36); g.add(b);
    const t = new THREE.Mesh(tip, blade); t.position.set(x, y + 1.25, z + 0.36); g.add(t);
  }
  return shade(g);
}
// the palisade: a row of thick pointed stakes, pale weathered logs bound by a rope band
function palisade(wood, runs, z, at) {
  const g = new THREE.Group(), log = new THREE.CylinderGeometry(0.15, 0.16, 1.5, 9).translate(0, 0.75, 0), point = new THREE.ConeGeometry(0.15, 0.32, 9).translate(0, 1.66, 0);
  let n = 0; for (const [a, b] of runs) n += Math.round((b - a) * 3);
  const logs = new THREE.InstancedMesh(log, wood, n), tips = new THREE.InstancedMesh(point, wood, n), d = new THREE.Object3D(); let k = 0;
  for (const [a, b] of runs) { const m = Math.round((b - a) * 3); for (let i = 0; i < m; i++) { const x = a + (i + 0.5) * (b - a) / m, h = 0.92 + ((i * 7) % 5) * 0.04; d.position.set(x, at(x, z) - 0.05, z + ((i % 2) - 0.5) * 0.06); d.scale.set(1, h, 1); d.rotation.y = i; d.updateMatrix(); logs.setMatrixAt(k, d.matrix); tips.setMatrixAt(k, d.matrix); k++; } }
  logs.castShadow = tips.castShadow = true; logs.receiveShadow = tips.receiveShadow = true; g.add(logs, tips);
  const rope = new THREE.MeshStandardMaterial({ color: 0x6a4a24, roughness: 0.9 });
  for (const [a, b] of runs) g.add(box(rope, a, 0.95, z - 0.17, b, 1.03, z + 0.17));
  return g;
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/0f3298.png', MW, MH, PALETTE, { [CL.grass]: 1.1 });
  land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside: (x, z) => z > MH - 1 ? CL.ground : null, rockH: 1, rise: 1, lumpH: 0.03, cap: () => 99,
    tex: { dirt: T.dirt(0x8a8470, 'yardEarth'), turf: T.turf(0x3a7a24), rock: T.rock(0x6a6458, 'yardRock', 0.4), rockTop: T.rock(0x6a6458, 'yardRock', 0.4) },
    tint: { dirt: 0xf0ece0, turf: 0xd8f0c0, rock: 0xffffff } });
  S.add(land.mesh({ dirtK: 0.3, turfK: 0.35, topGreen: 0 }));
  const at = (x, z) => land.at(x, z);
  // 鄂順's hall: white plaster over a brick plinth, red lattice windows each side of the double door, a dark tiled roof
  S.add(house(M, { x0: 3.15, x1: 7.85, z0: 0.1, z1: 2.95, y: at(5.5, 2.5), wallH: 1.45, roof: 0x3a3a34, rise: 1.15, over: 0.42, doors: [5.5], windows: [[3.55, 4.75], [6.25, 7.45]], posts: [4.95, 6.05], plaster: 0xf2eee4, brick: 0x8a7a5a }));
  S.add(hut(at(14, 6.5), { x0: 12.4, x1: 15.6, z0: 4.2, z1: 6.9 }));
  const wood = T.material(T.wood(0x5a3a20, 'rackWood'), { color: 0xd8b890 }, [1, 1]);
  for (const [x0, z, x1] of RACKS) S.add(rack(wood, x0, z, x1, at((x0 + x1) / 2, z + 0.4)));
  S.add(palisade(T.material(T.wood(0xb89a60, 'stakeWood'), { color: 0xf0e0c0 }, [1, 2]), STAKES, 8.0, at));
  // the grass where the art has it, kept off the buildings
  const clear = (x, z) => !(x > 2.8 && x < 8.2 && z < 3.3) && !(x > 12 && z > 3.8 && z < 7.3) && !(z > 7.4) && !RACKS.some(([a, rz, b]) => x > a - 0.1 && x < b + 0.1 && z > rz + 0.1 && z < rz + 0.7);
  S.add(grass(land.scatter(CL.grass, 70, clear), { size: 0.34, cols: ['#2e6a1e', '#4a8a24', '#1e5a18', '#5a9a2a'] }));
  S.add(stones(land.scatter(CL.ground, 0.6, clear), T.material(T.rock(0x7a7468, 'yardPebble', 0.3), {}, [0.5, 0.5]), { size: 0.06 }));
  E.world.updaters.push((dt, t) => windTick(t));
  void FX;
}

export default {
  build, ground: (x, z) => land ? land.at(x, z) : 0,
  mood: { bg: 0xc8ccc8, voidCol: false, fog: 0xc8ccc4, fogD: 0.01, sky: 0xe0e6ec, under: 0x4a4a3a, hemi: 1.05,
    sun: 0xfff4e4, sunI: 2.5, sunDir: [-0.4, 0.8, 0.4], sat: 1.0, exposure: 1.0, bloom: 0.25, aoR: 0.8,
    env: { top: 0xd8e0ea, mid: 0x9a9a88, low: 0x4a4a3a, lights: [[-6, 7, 3, 0xfff4e4, 3]] } },
};
