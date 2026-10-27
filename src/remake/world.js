// the world maps, remade as a miniature land seen from the sky: the original's layout of plains, forests, mountain
// ranges, rivers, the sea and the desert's edge (src/kit/terrain.js), with snow on the peaks, carved rivers and forests
// of small trees. Two maps on the one tileset:
//   world-95a9       the 昌平村 descent (0x44CA; tools/rom/descent.py): 8 x 7 cells, the village a cluster of tiny houses
//   prologue-world   the land the prologue pans over (0x256C, 0x2BF4; extract/natives.js prologueWorld): 32 x 7 cells,
//                    from the desert in the west over two ranges to the eastern sea
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, house } from '../kit/parts.js';
import { readLayout, Land, CL, pines, shrubs, grass, windTick } from '../kit/terrain.js';

const PALETTE = {
  [CL.grass]: [0x6cb400, 0x90d800, 0xb4d800, 0x009000], [CL.forest]: [0x004800, 0x249000],
  [CL.rock]: [0xfcfcfc, 0xd89048, 0xb46c24, 0xfcd848, 0x6c4800, 0xb49048, 0x906c00, 0x482400, 0xd8b448],
  [CL.ground]: [0xd8b46c, 0xfcd890, 0xb4b490], [CL.water]: [0x0048b4, 0x00246c, 0x0090fc, 0x006cd8, 0x00b4fc],
};
let land = null;

const worldSet = ({ art, w, h, village, sea }) => async function build(E, FX) {
  const S = E.world.scene, M = mats(), VILLAGE = village || [-99, -99];
  const lay = await readLayout(art, w, h, PALETTE, { [CL.water]: 2 });
  land = new Land({ w, h, layout: lay, ext: 10, rockH: 1.5, peaks: 7, lumpH: 0.05, waterDepth: 0.09,
    tex: { dirt: T.dirt(0xd8b47a, 'desert'), turf: T.turf(0x6a9a2a), rock: T.rock(0x9a7a58, 'mountain') },
    tint: { dirt: 0xffffff, turf: 0xe8ffd0, rock: 0xf0e0d0 } });
  S.add(land.mesh({ res: w > 16 ? 12 : 16, dirtK: 0.6, turfK: 0.7, rockK: 0.8, snow: 0.85, bed: 0x2a4a3a }));
  if (sea) FX.water(S, { r: [-12, -12, w + 12, h + 12], y: -0.035, deep: 0x0c3c9c, lit: 0x4a9ae0, stars: 0.12 });   // the sea and the rivers: the original's deep blue, its swell and glints
  else {   // the river: a water surface over the carved bed
    const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a5a9a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.5 }));
    water.position.set(w / 2, -0.035, h / 2); S.add(water);
  }
  // forests: small trees; a few lone ones over the plains
  const notVillage = (x, z) => Math.hypot(x - VILLAGE[0], z - VILLAGE[1]) > 0.45;
  S.add(pines(land.scatter(CL.forest, 40, notVillage), { size: 0.26, cols: ['#1e4a1a', '#2a5a22', '#346a2a', '#18401a'] }));
  S.add(shrubs(land.scatter(CL.grass, 0.6, notVillage), { size: 0.08, cols: ['#3a6a22', '#4a7a2a'] }));
  S.add(grass(land.scatter(CL.grass, 20, notVillage), { size: 0.06, cols: ['#6aa030', '#88b840', '#5a8a2a'] }));
  E.world.updaters.push((dt, t) => windTick(t));
  if (!village) return;
  // 昌平村: a cluster of tiny tiled houses round a square, a golden glow over it (the original's marker)
  const g = new THREE.Group();
  for (const [dx, dz, w] of [[-0.18, -0.1, 1], [0.16, -0.14, 0.8], [0.02, 0.16, 0.9], [-0.24, 0.18, 0.6]]) {
    const h = house(M, { x0: -1.2 * w, x1: 1.2 * w, z0: -0.7, z1: 0.7, y: 0, wallH: 0.9, roof: 0x2a4a92, doors: [0], windows: [], over: 0.25, rise: 0.6 });
    h.scale.setScalar(0.07); h.position.set(VILLAGE[0] + dx, land.at(VILLAGE[0] + dx, VILLAGE[1] + dz), VILLAGE[1] + dz); g.add(h);
  }
  S.add(g);
  FX.glow(E, { x: VILLAGE[0], y: VILLAGE[1], r: 0.45, col: 0xffd890, i: 1.2 });
};

const look = build => ({
  build, ground: (x, z) => land ? Math.max(land.at(x, z), -0.035) : 0, particles: null,
  mood: { bg: 0xcfe0f0, voidCol: false, fog: 0xd8e6f4, fogD: 0.02, sky: 0xd8ecff, under: 0x46602a, hemi: 1.15,
    sun: 0xfff0d0, sunI: 2.8, sunDir: [-0.45, 0.8, 0.4], sat: 1.05, exposure: 1.0, bloom: 0.35, aoR: 0.25,
    env: { top: 0xd8ecff, mid: 0xa8c0d0, low: 0x46602a, lights: [[-5, 8, 4, 0xffffff, 5]] } },
});
export default look(worldSet({ art: 'assets/maps/world-95a9.png', w: 8, h: 7, village: [6.5, 3.45] }));
export const prologueWorld = Object.assign(look(worldSet({ art: 'assets/maps/prologue-world.png', w: 32, h: 7, sea: true })), { view: { dist: 7.8, pitch: 1.06, fov: 34 } });   // (the original's screen, 8 x 7 cells, fills the view)
