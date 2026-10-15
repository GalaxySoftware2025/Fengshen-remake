// 紂王's court (maps 00241c / 0024b8: the same art), remade in 3D on the original's plan (tools/qa/grid.py), every
// surface modelled and procedurally textured (src/kit). The hall is symmetric about x = 11.5.
// What the original draws, north to south, and how it is built here:
//   the throne end  a stepped back wall of lit lattice bays in red lacquer (the inner bays at z 3.4 either side of the
//                   throne alcove, the outer ones at z 5.9), four tall red columns on green drums (two flanking the
//                   alcove, two at the wall's step); the alcove: gold curtains drawn back from a white folding screen,
//                   the gilt throne with jade-pearl dragon arms
//   the dais        two tiers (upper rows 3.4-5, lower x 8-15 to row 7.6), faced in olive stone under red-and-gold
//                   copings, low parapets where the original has its little brick walls, a red rail down the sides; the
//                   carpet comes down a seven-step stair through both tiers to the hall floor
//   the floor       pale khaki-celadon slabs with the olive diamond lattice and dark stars (T.latticeFloor)
//   the hall        four green bronze cauldrons where the carpet ends, the starry moat in a U, the wings (rows 17-19);
//                   below a retaining wall the lower court with its pools and cauldrons, the entrance south
// [design, the user's: "more luxury, and stairs should be higher"; no white walls; then "I still don't like it":
//  rebuilt closer to the original's look, without the full-width lattice backdrop, the wings beyond the walls and the
//  dragons, cranes, censers and banners the original never had]
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, merged, box, pillar, parapet, latticeWall, curtain, ding, screen, throne, lantern, stairs, shade } from '../kit/parts.js';

const Y = { hall: 0.6, tier1: 1.3, tier2: 2.0, mid: 0.3, low: -0.95, moat: -0.35, pool: -1.5, base: -2.3 };
const TOP = Y.tier2 + 3.7;   // the walls' lintel line
const mx = x => 23 - x;      // mirror a cell coordinate across the hall's axis (x = 11.5)
const STEPS = 7, LOW_STEPS = 4;
const STAIR = { x0: 10, x1: 13, z0: 5, z1: 7.6 };

function levels() {
  const L = new Levels(24, 35, 4);
  L.set(4, 5.9, 19, 9.5, Y.hall)                                          // the throne end's floor
    .set(7, 3.4, 16, 5, Y.tier2).set(10, 1.2, 13, 3.4, Y.tier2)           // upper tier and the throne alcove
    .set(8, 5, 15, 7.6, Y.tier1)                                          // lower tier
    .set(4, 9.5, 19, 21.6, Y.mid).set(1, 16.9, 22, 19, Y.mid).set(3, 19, 20, 20, Y.mid)   // mid hall and wings
    .set(4, 21, 19, 27, Y.low).set(7, 27, 16, 31, Y.low).set(10, 31, 13, 33, Y.low);      // lower court, entrance
  for (const [a, b, c, d] of [[7, 10, 8, 17], [8, 15.5, 9, 17], [9, 16.5, 10, 18], [10, 17.5, 13, 18], [13, 16.5, 14, 18], [14, 15.5, 15, 17], [15, 10, 16, 17]]) L.set(a, b, c, d, Y.moat);
  for (const [a, b, c, d] of [[4, 25, 6, 27], [6, 26, 9, 27], [7, 27, 9.5, 31]]) { L.set(a, b, c, d, Y.pool); L.set(mx(c), b, mx(a), d, Y.pool); }
  L.stairs(STAIR.x0, STAIR.z0, STAIR.x1, STAIR.z1, Y.hall, Y.tier2, STEPS, 's');   // the carpeted stair, through both tiers
  L.stairs(4, 9.5, 7, 10.1, Y.mid, Y.hall, 1, 's'); L.stairs(16, 9.5, 19, 10.1, Y.mid, Y.hall, 1, 's'); L.stairs(8, 9.5, 15, 10.1, Y.mid, Y.hall, 1, 's');
  L.stairs(10, 20.2, 13, 21.8, Y.low, Y.mid, LOW_STEPS, 's');   // down to the lower court
  return L;
}
const LV = levels();
const groundAt = (x, z) => LV.at(x, z);

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  M.beam = T.material(T.caihua(), { envMapIntensity: 1 });
  const floor = T.material(T.latticeFloor(2), { envMapIntensity: 0.9 }, [1, 1]);
  const stone = T.material(T.bricks(0xa9a66c, 4, 'courtStone'), {}, [1, 1]);
  const rug = T.material(T.carpet(0xb0121a), {});
  // the plain red broken up [the user's pick of five, 2026-10-13]: gilt cloud-scroll relief (祥雲, 金漆浮雕) over the
  // columns' shafts, on the walls' dado panels and in tall gold-framed panels on the returns
  const Mcol = Object.assign({}, M, { lacquer: T.material(T.cloudRelief(2), { envMapIntensity: 1.2 }, [2.5, 3]) });
  const lacq = M.lacquer, gold = M.gold, latt = { lat: 0.6 };
  const relief = T.material(T.cloudRelief(2), { envMapIntensity: 1.2 });
  latt.dado = relief;
  M.paper = T.material(T.paper(0xf0a860), { emissive: new THREE.Color(1, 0.5, 0.2), emissiveIntensity: 0.6, side: THREE.DoubleSide });   // the original's lattice glows orange (#fc6c48)
  M.lattice = M.lattice.clone(); M.lattice.color = new THREE.Color(1, 0.55, 0.38); M.lattice.metalness = 0; M.lattice.emissive = new THREE.Color(0.9, 0.32, 0.12); M.lattice.emissiveIntensity = 0.28;
  M.silk = T.material(T.silk(0xf09018), { sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.8, 0.4), side: THREE.DoubleSide });   // its curtains #fc9000 / #fcd800

  // ---- floors, tier faces, moat walls (one mesh), the stairs over their gaps
  S.add(LV.mesh(floor, stone, Y.base, 0.5));
  for (const r of LV.ramps) {
    const onRug = r.x0 === STAIR.x0 && r.z0 === STAIR.z0;
    S.add(stairs(r, onRug ? rug : floor, onRug ? rug : stone, onRug ? 1 / 3 : 0.5));
  }
  // the carpet: up the alcove to the throne, over the upper tier to the stair, and on from its foot to the cauldrons
  const runner = (z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, z1 - z0).rotateX(-Math.PI / 2), rug.clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m.material[k] = rug[k].clone(); m.material[k].repeat.set(1, (z1 - z0) / 2.8); m.material[k].needsUpdate = true; }
    m.position.set(11.5, y + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
  };
  runner(1.6, STAIR.z0, Y.tier2); runner(STAIR.z1, 9.3, Y.hall);
  // the stair: gilt nosings, and lacquer stringers with a gold cap either side (it cuts down through the lower tier)
  const trim = [], caps = [], d = (STAIR.z1 - STAIR.z0) / STEPS;
  for (let k = 0; k < STEPS; k++) {
    const y = Y.hall + (Y.tier2 - Y.hall) * (STEPS - k) / STEPS, z = STAIR.z0 + k * d;
    caps.push(box(gold, STAIR.x0 + 0.1, y - 0.03, z + d - 0.03, STAIR.x1 - 0.1, y + 0.005, z + d + 0.01, 2));
    for (const x of [STAIR.x0, STAIR.x1]) {
      trim.push(box(lacq, x - 0.07, Y.hall, z, x + 0.07, y + 0.1, z + d + 0.001, 2));
      caps.push(box(gold, x - 0.085, y + 0.1, z, x + 0.085, y + 0.13, z + d + 0.001, 2));
    }
  }
  S.add(merged(lacq, trim), merged(gold, caps));

  // ---- the dais: red-and-gold copings on every edge that drops, low parapets where the original has them, rails
  const coping = [], cg = [];
  const edge = (x0, z0, x1, z1, y) => { coping.push(box(lacq, x0, y - 0.1, z0, x1, y + 0.02, z1, 2)); cg.push(box(gold, x0 - 0.01, y - 0.14, z0 - 0.01, x1 + 0.01, y - 0.1, z1 + 0.01, 2)); };
  edge(7, 4.92, 8, 5.02, Y.tier2); edge(15, 4.92, 16, 5.02, Y.tier2); edge(8, 4.92, 10, 5.02, Y.tier2); edge(13, 4.92, 15, 5.02, Y.tier2);   // the upper tier's front
  edge(8, 7.5, 10, 7.62, Y.tier1); edge(13, 7.5, 15, 7.62, Y.tier1);                                   // the lower tier's front
  edge(6.98, 3.4, 7.08, 5, Y.tier2); edge(15.92, 3.4, 16.02, 5, Y.tier2);                               // the sides
  edge(7.98, 5, 8.08, 7.6, Y.tier1); edge(14.92, 5, 15.02, 7.6, Y.tier1);
  S.add(merged(lacq, coping), merged(gold, cg));
  // the original's little brick walls with gold caps: by the columns and at the corners of each tier
  for (const [a, b] of [[7, 8], [9, 10]]) { S.add(parapet(M, stone, a, 4.78, b, 5.0, Y.tier2, 0.34)); S.add(parapet(M, stone, mx(b), 4.78, mx(a), 5.0, Y.tier2, 0.34)); }
  S.add(parapet(M, stone, 8, 7.38, 9.1, 7.6, Y.tier1, 0.34), parapet(M, stone, 13.9, 7.38, 15, 7.6, Y.tier1, 0.34));
  // a low red rail with gilt posts along the dais's sides (the original's thin rail lines at x 8 and 15)
  const rail = [], posts = [];
  const railRun = (x, z0, z1, y) => {
    rail.push(box(lacq, x - 0.04, y + 0.28, z0, x + 0.04, y + 0.34, z1, 2), box(lacq, x - 0.025, y + 0.1, z0, x + 0.025, y + 0.14, z1, 2));
    for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / Math.max(1, Math.round((z1 - z0) / 0.6))) posts.push(box(gold, x - 0.05, y, z - 0.05, x + 0.05, y + 0.4, z + 0.05, 2));
  };
  railRun(7.12, 3.5, 4.75, Y.tier2); railRun(mx(7.12), 3.5, 4.75, Y.tier2); railRun(8.12, 5.15, 7.35, Y.tier1); railRun(mx(8.12), 5.15, 7.35, Y.tier1);
  S.add(merged(lacq, rail), merged(gold, posts));

  // ---- the walls: inner bays on the upper tier either side of the alcove, outer bays on the floor at the step
  S.add(latticeWall(M, 7, 9.1, 3.4, Y.tier2, TOP - Y.tier2, 2, latt), latticeWall(M, 13.9, 16, 3.4, Y.tier2, TOP - Y.tier2, 2, latt));
  S.add(latticeWall(M, 4, 6.1, 5.9, Y.hall, TOP - Y.hall, 2, latt), latticeWall(M, 16.9, 19, 5.9, Y.hall, TOP - Y.hall, 2, latt));
  // the returns between them (x 7 and 16, z 3.4-5.9): lacquer panels in gilt frames
  for (const x of [7, 16]) {
    const sx = x < 11 ? -1 : 1;
    S.add(box(lacq, x - 0.08 + sx * 0.08, Y.hall, 3.3, x + 0.08 + sx * 0.08, TOP, 5.9));
    reliefPanels(S, x, -sx, relief, gold);
  }
  // a painted frieze along the top of everything, the beams' ends on the columns
  for (const [x0, x1, z] of [[3.9, 7.1, 5.92], [15.9, 19.1, 5.92], [6.9, 16.1, 3.42]]) {
    S.add(box(M.beam, x0, TOP, z - 0.16, x1, TOP + 0.45, z + 0.12, 1 / 0.45), box(gold, x0, TOP + 0.45, z - 0.18, x1, TOP + 0.5, z + 0.14));
  }
  // the hall's long side walls: lattice bays turned to face in, over a plinth down to the dark
  for (const [x, sg] of [[4.0, 1], [19.0, -1]]) {
    const w = latticeWall(M, 0, 11, 0, Y.mid, 2.8, 7, latt); w.rotation.y = sg * Math.PI / 2; w.position.set(x, 0, sg > 0 ? 16.9 : 5.9); S.add(w);
    S.add(box(M.lacquerDark, x - (sg > 0 ? 0.25 : 0), Y.base, 5.9, x + (sg > 0 ? 0 : 0.25), Y.mid, 16.9));
  }
  S.add(latticeWall(M, 1, 3.2, 16.9, Y.mid, 2.8, 2, latt), latticeWall(M, 19.8, 22, 16.9, Y.mid, 2.8, 2, latt));
  S.add(curtain(M, 1.05, 2.2, 16.75, Y.mid + 2.4, 2.3, 'l', 5), curtain(M, 20.8, 21.95, 16.75, Y.mid + 2.4, 2.3, 'r', 5));
  for (const x of [3.5, 19.5]) S.add(pillar(M, x, 17.15, Y.mid, 2.8, 0.36));
  // gold curtains drawn back on the outer bays, as the original hangs them
  S.add(curtain(M, 4.1, 5.4, 5.78, TOP - 0.5, 3.4, 'l', 5), curtain(M, 17.6, 18.9, 5.78, TOP - 0.5, 3.4, 'r', 5));

  // ---- the columns: two flanking the alcove on the upper tier, two at the wall's step, up to the frieze
  for (const [x, z, y, r] of [[9.5, 3.75, Y.tier2, 0.4], [13.5, 3.75, Y.tier2, 0.4], [6.5, 6.2, Y.hall, 0.42], [16.5, 6.2, Y.hall, 0.42]]) {
    S.add(pillar(Mcol, x, z, y, TOP - y, r));
  }

  // ---- the throne alcove: a lacquer niche, the white folding screen, gold curtains drawn back, the throne
  S.add(box(M.lacquerDark, 9.85, Y.tier2, 1.0, 13.15, TOP + 0.5, 1.2));                                // the back
  S.add(box(lacq, 9.75, Y.tier2, 1.0, 10.0, TOP, 3.3), box(lacq, 13.0, Y.tier2, 1.0, 13.25, TOP, 3.3));   // its cheeks
  for (const x of [10.02, 12.98]) S.add(box(gold, x - 0.02, Y.tier2, 1.2, x + 0.02, TOP, 3.3, 2));
  S.add(box(M.beam, 9.7, TOP - 0.55, 3.25, 13.3, TOP, 3.5, 1 / 0.55), box(gold, 9.7, TOP - 0.62, 3.38, 13.3, TOP - 0.55, 3.52));   // the lintel over the opening
  const screenPaper = T.material(T.paper(0xfbf8f0), { emissive: new THREE.Color(1, 0.97, 0.9), emissiveIntensity: 0.22, side: THREE.DoubleSide });
  S.add(screen(M, 10.2, 12.8, 1.5, Y.tier2 + 0.18, 2.9, 6, screenPaper));
  S.add(box(lacq, 10.05, Y.tier2, 1.25, 12.95, Y.tier2 + 0.18, 2.0), box(gold, 10.03, Y.tier2 + 0.18, 1.23, 12.97, Y.tier2 + 0.21, 2.02));   // the screen's plinth
  S.add(throne(M, 11.5, 2.75, Y.tier2));
  S.add(curtain(M, 9.95, 11.25, 3.18, TOP - 0.6, 3.1, 'l', 7), curtain(M, 11.75, 13.05, 3.18, TOP - 0.6, 3.1, 'r', 7));
  const val = [];   // a gold valance with tassels across the top of the opening
  for (let x = 10.05; x < 12.96; x += 0.32) { const t = shade(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), gold)); t.rotation.x = Math.PI; t.position.set(x + 0.16, TOP - 0.98, 3.3); S.add(t); }
  val.push(box(M.silk, 10.0, TOP - 0.9, 3.22, 13.0, TOP - 0.6, 3.28, 2)); S.add(merged(M.silk, val));
  const key = new THREE.PointLight(0xffd2a0, 4.5, 6, 1.6); key.position.set(11.5, Y.tier2 + 2.6, 4.4); S.add(key);   // the throne lit warm (not on 紂王's spot)

  // ---- the hall: cauldrons where the carpet ends, parapets heading the moat, the moat itself
  S.add(parapet(M, stone, 7.0, 9.05, 8.0, 9.6, Y.hall, 0.4), parapet(M, stone, 15.0, 9.05, 16.0, 9.6, Y.hall, 0.4));
  const fires = [];
  for (const x of [9.5, 10.5, 12.5, 13.5]) fires.push([x, 9.3, Y.hall, 0.95]);
  for (const [a, b, c, dd] of [[4, 24.5, 6, 25], [6, 25.45, 9.5, 25.95]]) { S.add(parapet(M, stone, a, b, c, dd, Y.low, 0.4)); S.add(parapet(M, stone, mx(c), b, mx(a), dd, Y.low, 0.4)); }
  for (const x of [6.5, 7.5, 8.5]) { fires.push([x, 24.95, Y.low, 0.95]); fires.push([mx(x), 24.95, Y.low, 0.95]); }
  for (const [x, z, y, s] of fires) {
    const dg = ding(M, x, z, y, s); S.add(dg.g);
    FX.fire(E, { x, y: z + 0.04, z: dg.rim - groundAt(x, z) - 0.05, size: 0.7, light: 2.6, col: 0xff8a3a });
  }
  edgeTrim(S, M);
  for (const [a, b, c, dd] of [[7, 10, 8, 17], [8, 15.5, 9, 17], [9, 16.5, 10, 18], [10, 17.5, 13, 18], [13, 16.5, 14, 18], [14, 15.5, 15, 17], [15, 10, 16, 17]]) FX.water(S, { r: [a, b, c, dd], y: Y.moat + 0.22 });
  for (const [a, b, c, dd] of [[4, 25, 6, 27], [6, 26, 9.5, 27], [7, 27, 9.5, 31]]) { FX.water(S, { r: [a, b, c, dd], y: Y.pool + 0.3 }); FX.water(S, { r: [mx(c), b, mx(a), dd], y: Y.pool + 0.3 }); }
  // the retaining wall above the lower court: the olive stone under a red-and-gold coping
  for (const [a, b] of [[4, 10], [13, 19]]) S.add(box(lacq, a, Y.mid - 0.1, 21.55, b, Y.mid + 0.02, 21.7, 2), box(gold, a, Y.mid - 0.14, 21.6, b, Y.mid - 0.1, 21.72, 2));
  // hanging lanterns down the mid hall and the lower court (none in the throne end: the original has none there)
  for (const [x, z] of [[5.5, 11.5], [17.5, 11.5], [5.5, 15], [17.5, 15], [6, 22.6], [17, 22.6], [11.5, 23.5], [8.5, 28.5], [14.5, 28.5]]) {
    const y = groundAt(x, z) + 2.4; S.add(lantern(M, x, y, z));
    const L = new THREE.PointLight(0xff9a50, 2.0, 5, 1.6); L.position.set(x, y - 0.1, z); S.add(L);
  }
}
// the returns' seen faces (x 7 faces +x, x 16 faces -x): two tall gold-framed panels of the gilt relief
function reliefPanels(S, x, nf, relief, gold) {
  const y0 = Y.tier2 + 0.15, y1 = TOP - 0.15;
  const plane = (mat, z0, z1, ya, yb) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, yb - ya), mat); m.rotation.y = nf > 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(x + nf * 0.012, (ya + yb) / 2, (z0 + z1) / 2); m.receiveShadow = true; S.add(m); };
  const frame = (z0, z1, ya, yb, w) => { const fx = x + nf * 0.02; for (const [a, b, c, d] of [[z0, ya, z1, ya + w], [z0, yb - w, z1, yb], [z0, ya, z0 + w, yb], [z1 - w, ya, z1, yb]]) S.add(box(gold, Math.min(fx, fx + nf * 0.05), b, a, Math.max(fx, fx + nf * 0.05), d, c, 2)); };
  for (const [z0, z1] of [[3.55, 4.6], [4.75, 5.8]]) {
    const m = relief.clone(); for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set((z1 - z0) / 1.1, (y1 - y0 - 0.4) / 1.1); m[k].needsUpdate = true; }
    plane(m, z0 + 0.05, z1 - 0.05, y0 + 0.25, y1 - 0.2); frame(z0, z1, y0 + 0.2, y1 - 0.15, 0.07);
  }
}
// a lacquered kerb along every edge of the floor that faces south or sideways onto the void (the original's red border)
function edgeTrim(S, M) {
  const out = [], kerb = (...a) => out.push(box(M.lacquer, ...a, 2));
  const R = LV.R, W = LV.w * R, H = LV.h * R, g = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? NaN : LV.H[j * W + i];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const y = g(i, j); if (isNaN(y)) continue;
    const x0 = i / R, z0 = j / R, s = 1 / R;
    if (isNaN(g(i, j + 1))) kerb(x0, y - 0.6, z0 + s - 0.08, x0 + s, y + 0.12, z0 + s);
    if (isNaN(g(i - 1, j)) && z0 > 16) kerb(x0, y - 0.6, z0, x0 + 0.08, y + 0.12, z0 + s);
    if (isNaN(g(i + 1, j)) && z0 > 16) kerb(x0 + s - 0.08, y - 0.6, z0, x0 + s, y + 0.12, z0 + s);
  }
  S.add(merged(M.lacquer, out));
}

export default {
  build, ground: groundAt, particles: 'dust',
  mood: { bg: 0x030202, voidCol: 0x030202, voidY: -2.4, fog: 0x120804, fogD: 0.006, sky: 0xffe6c4, under: 0x3a1a0a, hemi: 0.95,
    sun: 0xffdcb0, sunI: 2.5, sunDir: [-0.35, 0.85, 0.5], sat: 1.04, exposure: 1.12, bloom: 0.38,
    env: { top: 0x9a6a40, mid: 0x6a3a1c, low: 0x2a1408, lights: [[0, 6, -8, 0xfff0d0, 6], [-7, 4, 0, 0xffd090, 4], [7, 4, 0, 0xffd090, 4], [0, 9, 3, 0xffe0b0, 5]] } },
  lights: [{ x: 11.5, y: 3.4, z: 6.5, col: 0xffb070, i: 3, d: 8 }],
};
