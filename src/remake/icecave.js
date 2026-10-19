// The 麒麟獸's cave at the top of 麒麟山 (map 0f2db4: scene 30; battle 15's second room), remade: a causeway of grey-green
// cobbles (x 8-14, rows 4-13, narrowing to the gate at x 10-12, row 2) across a black void, four islands of the same
// stone each holding a chest (x 2-4 and 18-20, rows 5-7 and 10-12), their fronts faced in blue glazed brick; along the
// north a wall of the blue brick on columns of pale green stone, and in its middle the gate's tower (x 9-14), where the
// 麒麟獸 waits. Measured on tools/qa/grid.py 0f2db4 and its grid. Cold, dim light from above. Rendered as the design
// direction asks (DESIGN.md §2): rounded cobbles with pale rims, small glazed bricks each its own blue, a crust of frost
// along every top edge (the art's pale cyan), islands of dark rock under their brick fronts, carved jade columns.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade } from '../kit/parts.js';
import { D, G } from '../rules.js';

const BASE = -3.2;
const FLOORS = [[8, 4, 15, 14], [9, 3, 14, 4], [10, 2, 13, 3], [2, 5, 5, 8], [18, 5, 21, 8], [2, 10, 5, 13], [18, 10, 21, 13]];
const WALLS = [[0, 0, 8.4, 2.1, 1.3], [14.6, 0, 24, 2.1, 1.3], [9, 0, 10, 2.05, 2.0], [13, 0, 14, 2.05, 2.0], [10, 0, 13, 1.0, 2.4]];   // x0, z0, x1, z1, height
const COLUMNS = [0.5, 3.5, 6.5, 17.5, 20.5, 23.5];
const ART_CHESTS = [[3, 6], [19, 6], [3, 11], [19, 11]];
let world = null, M = null, LV = null, chestG = new Map();

// the floor (the art's grey-green cobbles): rounded stones packed close, each its own shade of grey-green, a pale cold
// rim where its crown catches the light, dark joints; calm (the play view looks down on it most)
function cobbles() {   // (the user: rounded pebbles "too much, visually uncomfortable": large, flat, worn stones, calm)
  return T.pbr('iceCobbles3', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 4, 191, 0.85), gap = w1 - w0 + (T.fbm(u, v, 16, 3, 192) - 0.5) * 0.05, stone = T.smooth(0.0, 0.05, gap);
    const n = T.fbm(u, v, 14, 4, 193), big = T.fbm(u, v, 3, 3, 194), edge = T.smooth(0.12, 0.0, gap);
    let c = T.mixc([0.27, 0.34, 0.33], [0.42, 0.5, 0.47], id * 0.45 + n * 0.3 + big * 0.25);
    c = c.map(q => q * (1 - edge * 0.12));   // the edges a little worn down, a touch darker
    c = T.mixc(c.map(q => q * 0.45), c, stone);
    o.c = c; o.h = 0.4 + stone * 0.15 - edge * 0.06 + n * 0.06; o.r = 0.75;
  }, 2);
}
// the walls' glazed brick (the art's small blue bricks): eight courses and four bricks a unit, running bond, each brick
// its own blue from deep cobalt to azure, glossy, a pale glint along its upper edge, navy joints
function glazedBrick() {
  return T.pbr('iceGlaze2', 1024, (u, v, o) => {
    const row = Math.floor(v * 8), fv = v * 8 - row, bu = u * 4 + (row % 2) * 0.5, bi = Math.floor(bu), fu = bu - bi, cell = [((bi % 4) + 4) % 4, row];
    const id = T.pnoise(cell[0], cell[1], 4, 21, 8), id2 = T.pnoise(cell[0], cell[1], 4, 23, 8), e = Math.min(Math.min(fu, 1 - fu) * 0.25, Math.min(fv, 1 - fv) * 0.125);
    const joint = T.smooth(0.006, 0.002, e), glint = T.smooth(0.3, 0.0, 1 - fv) * T.smooth(0.0, 0.004, e) * T.smooth(0.35, 0.7, id2), n = T.fbm(u, v, 20, 3, 22), cloud = T.fbm(u, v, 3, 3, 24);
    let c = T.mixc([0.05, 0.09, 0.24], [0.14, 0.27, 0.55], id * 0.6 + n * 0.15 + cloud * 0.25);
    c = T.mixc(c, [0.32, 0.5, 0.72], T.smooth(0.8, 0.95, id2) * 0.5);   // now and then a paler, frosted brick
    c = T.mixc(c, [0.6, 0.82, 0.92], glint * 0.5); c = T.mixc(c, [0.02, 0.03, 0.09], joint);
    o.c = c; o.h = 0.6 - joint * 0.5 + n * 0.04; o.r = 0.25 + joint * 0.6 + T.smooth(0.8, 0.95, id2) * 0.3;
  }, 3);
}
// frost along a top edge (the art's pale cyan crust): a ragged ridge of rime over the edge from x0 to x1 at height y on
// the line z (a strip along x), lumpy, drooping a little over the front
function frost(mat, x0, x1, z, y, seed, along = 'x') {   // a thin ragged crust on the edge running from x0 to x1 (along x; 'z': x0..x1 are z, the edge at x = z)
  const len = x1 - x0, nx = Math.max(8, Math.round(len * 14)), geo = new THREE.BoxGeometry(len + 0.04, 0.035, 0.13, nx, 1, 3), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const u = (((v.x + x0) / 9) % 1 + 1) % 1, top = v.y > 0, out = v.z > 0.03;
    const lump = T.fbm(u, 0.3, 40, 3, seed), drip = out && !top ? Math.max(0, T.fbm(u, 0.7, 60, 2, seed + 1) - 0.45) * 0.35 : 0;
    p.setXYZ(i, v.x, top ? v.y + lump * 0.04 : v.y - drip, v.z + (out ? (lump - 0.5) * 0.03 : 0));
  }
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat);
  if (along === 'x') m.position.set((x0 + x1) / 2, y + 0.012, z - 0.045); else { m.rotation.y = z > 0 ? -Math.PI / 2 : Math.PI / 2; m.position.set(Math.abs(z) - (z > 0 ? 0.045 : -0.045), y + 0.012, (x0 + x1) / 2); }
  return shade(m, false);
}
// a column of pale green stone (the art's carved columns under the wall): a shaft wound with a spiral of carved fluting,
// a moulded capital and a ring at its foot where it rises out of the dark
function column(mat, x, z, y0, y1) {
  const h = y1 - y0, geo = new THREE.CylinderGeometry(0.2, 0.22, h, 32, Math.ceil(h * 12)), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), py = p.getY(i), a = Math.atan2(pz, px), r = Math.hypot(px, pz); if (r < 1e-3) continue;
    const k = 1 - 0.09 * Math.pow(Math.max(0, Math.sin(a * 5 + py * 3.2)), 3); p.setXYZ(i, px * k, py, pz * k); }
  geo.computeVertexNormals();
  const g = new THREE.Group(), shaft = new THREE.Mesh(geo, mat); shaft.position.y = y0 + h / 2; g.add(shaft);
  const cap = new THREE.Mesh(new THREE.LatheGeometry([[0.2, 0], [0.24, 0.04], [0.22, 0.08], [0.28, 0.14], [0.3, 0.2], [0.001, 0.2]].map(([r, q]) => new THREE.Vector2(r, q)), 32), mat); cap.position.y = y1 - 0.2; g.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.025, 8, 32), mat); ring.rotation.x = Math.PI / 2; ring.position.y = y1 - 0.32; g.add(ring);
  g.position.set(x, 0, z); return shade(g);
}
// rock under an island (or the causeway) where its brick front ends: a craggy mass narrowing down into the dark
function underRock(mat, x0, z0, x1, z1, top, seed) {
  const w = x1 - x0, d = z1 - z0, geo = new THREE.CylinderGeometry(1, 0.35, 1, 24, 6, true), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), q = v.y + 0.5, n = 0.8 + 0.35 * T.fbm((a / 6.283 + 1) % 1, q * 0.5, 6, 3, seed);
    const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) * 0.92;   // (squared off near the top, to sit under the rect)
    const k = q > 0.85 ? sq : n; p.setXYZ(i, v.x * k * w / 2, v.y, v.z * k * d / 2); }
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.scale.y = 2.2; m.position.set((x0 + x1) / 2, top - 1.1, (z0 + z1) / 2); return shade(m);
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const MW = D.mapW, MH = D.mapH, BAND = -0.45;
  LV = new Levels(MW, MH, 4); const WL = [];
  for (const [x0, z0, x1, z1] of FLOORS) LV.set(x0, z0, x1, z1, 0);
  const floorM = T.material(cobbles(), { color: 0xffffff }, [0.7, 0.7]), brickM = T.material(glazedBrick(), { color: 0xffffff }, [1, 1]);
  S.add(LV.mesh(floorM, brickM, BAND, 0.5));   // the floors, their fronts a band of the glazed brick
  const rockM = T.material(T.rock(0x1c2430, 'iceUnder', 0.6), { color: 0xa8b8c8 }, [0.6, 0.6]);
  FLOORS.forEach(([x0, z0, x1, z1], i) => { if (x1 - x0 >= 2 && z1 - z0 >= 2) S.add(underRock(rockM, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, BAND + 0.02, i * 7 + 3)); });
  for (const [x0, z0, x1, z1, h] of WALLS) WL.push(box(brickM, x0, -0.6, z0, x1, h, z1));
  for (const m of WL) S.add(shade(m));
  // frost on every top edge: the walls' tops and the floors' front rims
  const rime = new THREE.MeshStandardMaterial({ color: 0xb8dcec, roughness: 0.4, emissive: 0x0a1828 });
  const topM = new THREE.MeshStandardMaterial({ color: 0x0c1a30, roughness: 0.7 });
  WALLS.forEach(([x0, z0, x1, z1, h], i) => {
    S.add(shade(box(topM, x0 + 0.005, h, z0, x1 - 0.005, h + 0.008, z1 - 0.005)), frost(rime, x0, x1, z1, h, 30 + i));   // the top dark, the crust on its front edge
    const lower = (x, side) => !WALLS.some(([a, , b, , hh]) => (side > 0 ? a === x : b === x) && hh >= h - 0.01);   // a side edge where the neighbour is lower
    if (lower(x1, 1)) S.add(frost(rime, z0, z1, x1, h, 50 + i, 'z')); if (lower(x0, -1) && x0 > 0) S.add(frost(rime, z0, z1, -x0, h, 70 + i, 'z'));
  });
  // the columns of pale green stone along the wall's foot, rising from the void
  const jade = T.material(T.marble(0xa8c8c0, 0x6a8a84, 2), { color: 0xe8fff8, roughness: 0.35 }, [0.5, 1]);
  for (const x of COLUMNS) S.add(column(jade, x, 2.3, BASE, 1.3));
  const chests = D.rooms && G.chests ? G.chests : ART_CHESTS.map(([x, y]) => ({ x, y, open: false }));
  for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, 0, !!c.open, 0, 1.3); S.add(g); chestG.set(c.x + ',' + c.y, g); }
  // a cold light over the causeway, catching the glaze
  const L = new THREE.PointLight(0xa8d0ff, 3, 14, 1.4); L.position.set(11.5, 4, 8); S.add(L);
  void FX;
}
function openChest(x, y) {
  const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
  const p = g ? g.position : new THREE.Vector3(x + 0.5, 0, y + 0.5); if (g) S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
}
export default {
  build, openChest, ground: (x, z) => LV ? LV.at(x, z) : 0,
  mood: { bg: 0x010204, voidCol: 0x010204, voidY: BASE, fog: 0x02050a, fogD: 0.02, sky: 0xc8e0ff, under: 0x0a1a2a, hemi: 0.95,
    sun: 0xd8ecff, sunI: 2.2, sunDir: [-0.3, 0.9, 0.4], sat: 1.0, exposure: 1.1, bloom: 0.4, aoR: 0.8,
    env: { top: 0x6a8aa8, mid: 0x2a3a50, low: 0x080c14, lights: [[0, 7, 3, 0xd8ecff, 3]] } },
};
