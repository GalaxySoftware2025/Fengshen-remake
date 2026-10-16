// 西岐's throne hall (maps 0eeaae / 0eecb2, the same art: scenes 20 and 22, 文王 receives the heroes), remade on the
// original's plan (tools/qa/grid.py 0eeaae) with the court's pieces (src/kit, as src/remake/court.js), symmetric about
// x = 12.5 but for the west wall's end column:
//   the back     the throne alcove (x 10-15) with lit lattice behind the gilt throne and orange curtains drawn back;
//                the inner walls either side (x 8-10, 15-17, front z 4) and the outer walls (x 1-8, 17-23, front z 6),
//                lattice bays glowing orange between red columns on green drums (x 1.5, 4.5, 7.5, 9.5; 15.5, 17.5, 20.5)
//   the dais     the floor before the throne a step up (x 8-17, rows 3-7), faced in olive stone, climbed by the one-cell
//                stairs at x 10 and 14 either side of a carved slab (x 11-14, rows 7-9) the carpet runs down to;
//                bronze braziers at (8, 6) and (16, 6)
//   the hall     the celadon star floor (T.latticeFloor), the red carpet from the throne to the door (x 11-14, south),
//                red columns down both sides (x 1.5 and 23, rows 9-12 and 16-19), lattice side walls, a red border
// Walkable as the original's grid says (the side columns' cells and the dais faces blocked).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, merged, box, pillar, parapet, latticeWall, curtain, ding, throne, stairs, shade } from '../kit/parts.js';

const UP = 0.55, TOP = 4.0, BASE = -1.6;   // (the dais one low step: the guards line up at its foot, scene 20)
const mx = x => 25 - x;   // mirror across the hall's axis (x = 12.5)
function levels() {
  const L = new Levels(24, 25, 4);
  L.set(1, 6, 24, 22, 0).set(11, 22, 14, 25, 0)            // the hall and the door's passage
    .set(8, 2.2, 17, 7, UP).set(8, 7, 10, 9, UP).set(15, 7, 17, 9, UP);   // the dais and its faces' blocks
  L.stairs(10, 7, 11, 9, 0, UP, 4, 's'); L.stairs(14, 7, 15, 9, 0, UP, 4, 's');
  L.stairs(11, 7, 14, 9, 0, UP, 10, 's');                   // the carved slab: a slope (blocked: no one climbs it)
  return L;
}
const LV = levels();

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  M.beam = T.material(T.caihua(), { envMapIntensity: 1 });
  const floor = T.material(T.latticeFloor(2), { envMapIntensity: 0.9 }, [1, 1]);
  const stone = T.material(T.bricks(0xa9a66c, 4, 'courtStone'), {}, [1, 1]);
  const rug = T.material(T.carpet(0xb0121a), {});
  const latt = { lat: 0.6 };
  M.paper = T.material(T.paper(0xf0a860), { emissive: new THREE.Color(1, 0.5, 0.2), emissiveIntensity: 0.6, side: THREE.DoubleSide });   // the lattice glows orange, as the original's
  M.lattice = M.lattice.clone(); M.lattice.color = new THREE.Color(1, 0.55, 0.38); M.lattice.metalness = 0; M.lattice.emissive = new THREE.Color(0.9, 0.32, 0.12); M.lattice.emissiveIntensity = 0.28;
  M.silk = T.material(T.silk(0xf09018), { sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.8, 0.4), side: THREE.DoubleSide });
  S.add(LV.mesh(floor, stone, BASE, 0.5));
  for (const r of LV.ramps) {
    if (r.x0 === 11) {   // the carved slab: grey stone with the clouds and waves in relief
      const slab = T.material(T.cloudRelief(2), { color: 0xb8b8a0, metalness: 0, envMapIntensity: 0.6 });
      const len = Math.hypot(r.z1 - r.z0, UP), m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 0.1, len), slab);
      m.rotation.x = -Math.PI / 2 + Math.atan2(UP, r.z1 - r.z0); m.position.set((r.x0 + r.x1) / 2, UP / 2 + 0.01, (r.z0 + r.z1) / 2); m.receiveShadow = true; S.add(m);
      S.add(stairs(r, stone, stone, 0.5));
    } else S.add(stairs(r, floor, stone, 0.5));
  }
  // the carpet: before the throne over the dais, and from the slab's foot to the door
  const runner = (z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9, z1 - z0).rotateX(-Math.PI / 2), rug.clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m.material[k] = rug[k].clone(); m.material[k].repeat.set(1, (z1 - z0) / 2.9); m.material[k].needsUpdate = true; }
    m.position.set(12.5, y + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
  };
  runner(3.0, 7.0, UP); runner(9.0, 25.5, 0);
  // the dais's front: red-and-gold copings over the stone, low parapets on its blocks
  const lacq = M.lacquer, gold = M.gold, coping = [], cg = [];
  const edge = (x0, z0, x1, z1, y) => { coping.push(box(lacq, x0, y - 0.1, z0, x1, y + 0.02, z1, 2)); cg.push(box(gold, x0 - 0.01, y - 0.14, z0 - 0.01, x1 + 0.01, y - 0.1, z1 + 0.01, 2)); };
  edge(8, 8.9, 10, 9.0, UP); edge(15, 8.9, 17, 9.0, UP); edge(7.92, 6, 8.02, 9, UP); edge(16.98, 6, 17.08, 9, UP);
  S.add(merged(lacq, coping), merged(gold, cg));
  S.add(parapet(M, stone, 8, 7.0, 10, 7.25, UP, 0.3), parapet(M, stone, 15, 7.0, 17, 7.25, UP, 0.3));
  // the walls: inner bays at z 4, outer bays at z 6, the alcove's lattice behind the throne
  S.add(latticeWall(M, 8, 9.1, 4.0, UP, TOP - UP, 1, latt), latticeWall(M, 15.9, 17, 4.0, UP, TOP - UP, 1, latt));
  S.add(latticeWall(M, 1.0, 8.0, 6.0, 0, TOP, 4, latt), latticeWall(M, 17.0, 23.0, 6.0, 0, TOP, 4, latt));
  S.add(latticeWall(M, 10.0, 15.0, 1.95, UP, TOP - UP, 3, latt));
  for (const [x0, x1] of [[9.9, 10.1], [14.9, 15.1]]) S.add(box(lacq, x0, UP, 1.8, x1, TOP, 4.0));   // the alcove's cheeks
  for (const [x, z0, z1, y] of [[8.0, 4.0, 6.0, UP], [17.0, 4.0, 6.0, UP]]) S.add(box(lacq, x - 0.08, y, z0 - 0.1, x + 0.08, TOP, z1));   // the returns between inner and outer walls
  for (const [x0, x1, z] of [[0.9, 8.1, 6.02], [16.9, 23.1, 6.02], [7.9, 17.1, 4.02], [9.9, 15.1, 1.97]]) S.add(box(M.beam, x0, TOP, z - 0.16, x1, TOP + 0.45, z + 0.12, 1 / 0.45), box(gold, x0, TOP + 0.45, z - 0.18, x1, TOP + 0.5, z + 0.14));
  S.add(curtain(M, 10.1, 11.2, 2.2, TOP - 0.3, TOP - UP - 0.4, 'l', 6), curtain(M, 13.8, 14.9, 2.2, TOP - 0.3, TOP - UP - 0.4, 'r', 6));
  S.add(throne(M, 12.5, 2.68, UP));
  // the columns: the back row up to the frieze, and down the hall's sides
  for (const [x, z, y] of [[1.5, 5.75, 0], [4.5, 5.75, 0], [7.5, 5.75, 0], [9.5, 3.75, UP], [15.5, 3.75, UP], [17.5, 5.75, 0], [20.5, 5.75, 0]]) S.add(pillar(M, x, z, y, TOP - y, 0.4));
  for (const z of [12.6, 19.6]) for (const x of [1.5, 23.0]) S.add(pillar(M, x, z, 0, TOP - 0.6, 0.38));
  // the hall's side walls: lattice bays facing in, behind the columns
  for (const [x, sg] of [[1.0, 1], [24.0, -1]]) { const w = latticeWall(M, 0, 16, 0, 0, TOP - 0.6, 8, latt); w.rotation.y = sg * Math.PI / 2; w.position.set(x, 0, sg > 0 ? 22 : 6); S.add(w); }
  // the front: a low red border either side of the door (south of everyone)
  for (const [a, b] of [[1.0, 11.0], [14.0, 24.0]]) S.add(box(lacq, a, -0.6, 21.9, b, 0.14, 22.1, 2), box(gold, a, 0.14, 21.92, b, 0.17, 22.08, 2));
  for (const x of [10.9, 14.1]) S.add(box(lacq, x - 0.1, -0.6, 22, x + 0.1, 0.14, 25, 2));
  // the braziers on the dais, burning low
  for (const x of [8.5, 16.5]) { const dg = ding(M, x, 6.5, UP, 0.95); S.add(dg.g); FX.fire(E, { x, y: 6.54, z: dg.rim - UP - 0.05, size: 0.6, light: 2.2, col: 0xff8a3a }); }
  for (const [x, z] of [[5.5, 11], [19.5, 11], [5.5, 17], [19.5, 17]]) { const L = new THREE.PointLight(0xffb070, 1.6, 6, 1.6); L.position.set(x, 3.2, z); S.add(L); }   // (warm light down the hall; no lanterns: the original hangs none)
  const key = new THREE.PointLight(0xffd2a0, 4, 6, 1.6); key.position.set(12.5, UP + 2.4, 4.6); S.add(key);
}

export default {
  build, ground: (x, z) => LV.at(x, z), particles: 'dust',
  mood: { bg: 0x030202, voidCol: 0x030202, voidY: -1.6, fog: 0x120804, fogD: 0.006, sky: 0xffe6c4, under: 0x3a1a0a, hemi: 0.95,
    sun: 0xffdcb0, sunI: 2.5, sunDir: [-0.35, 0.85, 0.5], sat: 1.04, exposure: 1.12, bloom: 0.38,
    env: { top: 0x9a6a40, mid: 0x6a3a1c, low: 0x2a1408, lights: [[0, 6, -8, 0xfff0d0, 6], [-7, 4, 0, 0xffd090, 4], [7, 4, 0, 0xffd090, 4], [0, 9, 3, 0xffe0b0, 5]] } },
  lights: [{ x: 12.5, y: 3.0, z: 9, col: 0xffb070, i: 3, d: 9 }],
};
