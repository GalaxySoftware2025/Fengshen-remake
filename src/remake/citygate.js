// 朝歌城門內 (map 0ebdd4: scene 13 and battle 7), remade: the walled court inside 朝歌's north gate, by night. Measured
// on the original (tools/qa/grid.py 0ebdd4), south to north:
//   the lower plaza   rows 19-22 (x 2-29), entered through the gap in the south wall (14-17, 23-24): the heroes and 文王
//                     come in here; two trees either side of the way in (13-14, 21-22), (17-18, 21-22)
//   the middle court  rows 11-16 at x 2-29, up the broad stair (13-18, 15-16) between the stone retaining walls of
//                     rows 17-18 (a passage at x 13-18 below it); trees at (2-3, 13-14), (23-24, 13-14), (10-11, 15-16)
//   the upper court   rows 3-9, up the west stair (8-9, 9-10) or the east one (22-25, 9-10), with a stone platform
//                     jutting into the middle court (14-17, 10-11); the blue-coped walls of rows 9-10 to either side,
//                     rows of trees along them (7-8), two trees before the gate (13-14, 4-5) and (17-18, 4-5)
//   the gate          the gatehouse over the north wall (x 12.6-19.2): two eaves of blue glazed tiles, red columns,
//                     the plaque 朝歌城, its doors over (15-16, 3); a hero or 文王 on (15, 4) or (16, 4) is out
// Past the north wall the land outside, trees and rocks along it, as the original draws it over the wall. Chests: (2, 15)
// and (29, 11) as drawn; (2, 4) and (29, 4) are not drawn (hidden: battle 7's hook module).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { readLayout, grass, CL, leafTex, clumpGeo } from '../kit/terrain.js';

const MW = 32, MH = 25, LOW = 0, MID = 0.7, HIGH = 1.4;
const PALETTE = { [CL.ground]: [0xb4b490, 0x90906c], [CL.grass]: [0x004800, 0x009000, 0x90d800] };
function levels() {
  const L = new Levels(MW, MH, 4);
  L.set(2, 3, 30, 11, HIGH).set(13, 11, 19, 13, HIGH)                    // the upper court and its platform
    .set(2, 11, 13, 19, MID).set(19, 11, 30, 19, MID).set(13, 13, 19, 15, MID)   // the middle court (the walls of rows 17-18 on it)
    .set(13, 15, 19, 19, LOW).set(2, 19, 30, 23, LOW).set(14, 23, 18, 25, LOW);  // the passage below the stair, the plaza, the way in
  L.stairs(8, 9, 10, 11, MID, HIGH, 5, 's').stairs(22, 9, 26, 11, MID, HIGH, 5, 's').stairs(13, 15, 19, 17, LOW, MID, 5, 's');
  return L;
}
const LV = levels();
const STAIR_CELLS = [[8, 9], [9, 9], [8, 10], [9, 10], [22, 9], [23, 9], [24, 9], [25, 9], [22, 10], [23, 10], [24, 10], [25, 10],
  [13, 15], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [13, 16], [14, 16], [15, 16], [16, 16], [17, 16], [18, 16]];
const TREES = [[14.0, 5.0], [17.9, 5.0], [2.85, 8.0], [4.8, 8.0], [6.75, 8.0], [27.0, 8.0], [28.95, 8.0], [3.0, 14.0], [23.7, 14.0],
  [10.6, 16.0], [13.95, 22.0], [17.8, 22.0]];
const TREES_OUT = [[3.0, 1.0], [7.0, 1.0], [10.9, 1.0], [21.0, 1.0], [24.9, 1.0], [28.9, 1.0], [-3, -1.5], [34.5, -1.2], [16, -3.5], [8, -4], [25, -4.2]];
const ROCKS = [[5.55, 5.6, 0.9], [4.55, 6.6, 0.8], [19.6, 6.6, 0.85], [22.6, 14.6, 0.85]];
const ROCKS_OUT = [[0.6, 0.6], [1.7, 1.5], [5.6, 0.6], [9.6, 0.6], [22.6, 0.6], [23.7, 1.5], [26.6, 1.5], [27.6, 0.6], [31.4, 0.6]];
const CHESTS = [[2, 15], [29, 11]];
let M = null, world = null, chestG = new Map();

// ---------------------------------------------------------------- pieces
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function weld(geo) {   // a polyhedron's faces joined at their corners (indexed: smooth normals)
  const p = geo.attributes.position, seen = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) { const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e4)).join(); if (!seen.has(k)) { seen.set(k, pos.length / 3); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(seen.get(k)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// the original's tree: a gnarled trunk forking low, layered clumps of dark needles lit green on top, on a ring of stones
function tree(mats, x, z, y, s, seed) {
  const g = new THREE.Group(), { bark, leaf, leaf2, stone } = mats;
  const limb = (a, b, r0, r1) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 7), bark); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m); };
  const top = V(R(seed) * 0.1 - 0.05, 0.75, 0); limb(V(0, 0, 0), V(0.04, 0.4, 0.02), 0.13, 0.1); limb(V(0.04, 0.4, 0.02), top, 0.1, 0.08);
  const clumps = [[0, 1.55, 0, 0.55], [-0.5, 1.15, 0.05, 0.45], [0.52, 1.2, 0, 0.45], [-0.2, 0.95, 0.35, 0.38], [0.3, 1.0, 0.32, 0.36], [0.05, 1.3, -0.3, 0.45], [-0.45, 1.5, -0.1, 0.36], [0.45, 1.55, -0.05, 0.36]];
  clumps.forEach(([cx, cy, cz, r], k) => {
    const c = V(cx + (R(seed + k) - 0.5) * 0.12, cy, cz); limb(top, c.clone().multiplyScalar(0.75).setY(cy - 0.1), 0.06, 0.03);
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 12, 8), mats.core); core.scale.y = 0.55; core.position.copy(c); g.add(core);   // so no light shows through the cards
    const cards = new THREE.Mesh(clumpGeo(16), k % 3 === 2 ? leaf2 : leaf); cards.scale.set(r * 1.9, r * 1.05, r * 1.9); cards.position.copy(c); cards.rotation.y = R(seed + k * 9) * 6.28;
    cards.customDepthMaterial = mats.depth; g.add(cards);
  });
  const ring = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + R(seed + k * 3) * 0.05, 0), stone); b.position.set(Math.cos(a) * 0.62, 0.04, Math.sin(a) * 0.5); b.rotation.set(R(k), R(k + 1) * 3, 0); b.scale.y = 0.6; ring.push(b); }
  g.add(merged(stone, ring));
  g.scale.setScalar(s); g.position.set(x, y, z); g.rotation.y = R(seed * 7) * 6.28; return shade(g);
}
function rock(stone, x, z, y, s, seed) {
  const geo = weld(new THREE.IcosahedronGeometry(0.3, 2)), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)), n = 1 + 0.22 * Math.sin(v.x * 9 + seed) * Math.sin(v.y * 11 + seed * 2) + 0.1 * Math.sin(v.z * 21); p.setXYZ(i, v.x * n * 1.1, Math.max(-0.05, v.y * n * 1.05), v.z * n); }
  geo.computeVertexNormals(); const m = shade(new THREE.Mesh(geo, stone)); m.position.set(x, y + 0.12 * s, z); m.scale.setScalar(s); m.rotation.y = seed; return m;
}
// a hip roof with upturned corners: the eave runs x0..x1, z0..z1 at height y, the ridge rise above it, overhang ov
function hipRoof(mat, rim, x0, x1, z0, z1, y, rise, ov, curl = 0.18, beasts = true) {
  const g = new THREE.Group(), X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, cz = (z0 + z1) / 2, half = Math.min(z1 - z0, x1 - x0) / 2;
  const rX0 = X0 + half + ov * 0.4, rX1 = X1 - half - ov * 0.4, ry = y + rise, N = 10, P = [], U = [], I = [];
  // the four faces as one grid each: eave edge (t=0) to ridge (t=1); the eave sags inward a little and lifts at the corners
  const face = (a0, a1, b0, b1) => {   // eave from a0 to a1, ridge from b0 to b1
    const o = P.length / 3;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= 8; j++) {
      const t = i / N, u = j / 8, e = a0.clone().lerp(a1, u), r = b0.clone().lerp(b1, u), q = e.clone().lerp(r, t);
      const corner = Math.pow(Math.abs(u - 0.5) * 2, 4) * (1 - t) * (1 - t);   // the eave's ends turn up
      q.y += -Math.sin(t * Math.PI) * 0.08 * rise + corner * curl;
      P.push(q.x, q.y, q.z); U.push(u * a0.distanceTo(a1) / 0.55, t * e.distanceTo(r) / 0.55);   // a course of tiles every 0.55 / 8 along the slope
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < 8; j++) { const a = o + i * 9 + j, b = a + 1, c = a + 9, d = c + 1; I.push(a, b, c, b, d, c); }
  };
  face(V(X0, y, Z1), V(X1, y, Z1), V(rX0, ry, cz), V(rX1, ry, cz));   // front (south)
  face(V(X1, y, Z0), V(X0, y, Z0), V(rX1, ry, cz), V(rX0, ry, cz));   // back
  face(V(X1, y, Z1), V(X1, y, Z0), V(rX1, ry, cz), V(rX1, ry, cz));   // east hip
  face(V(X0, y, Z0), V(X0, y, Z1), V(rX0, ry, cz), V(rX0, ry, cz));   // west hip
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.computeVertexNormals();
  g.add(shade(new THREE.Mesh(geo, mat)));
  // the ridge and its end beasts, the hips' ridges
  const rw = beasts ? 0.1 : 0.05; g.add(shade(box(rim, rX0 - rw, ry - 0.04, cz - rw, rX1 + rw, ry + rw * 1.6, cz + rw)));
  if (beasts) for (const ex of [rX0 - 0.1, rX1 + 0.1]) { const h = shade(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 8), rim)); h.position.set(ex, ry + 0.3, cz); h.rotation.z = ex < (rX0 + rX1) / 2 ? 0.45 : -0.45; g.add(h); }
  if (beasts) for (const [ex, ez, rx] of [[X0, Z1, rX0], [X1, Z1, rX1], [X0, Z0, rX0], [X1, Z0, rX1]]) {
    const a = V(ex, y + curl, ez), b = V(rx, ry, cz), d = b.clone().sub(a), m = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, d.length(), 6), rim));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m);
  }
  return g;
}
function plaqueTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#1c2a4a'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#d8b25a'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = '#f0e2b0'; g.font = 'bold 104px "Noto Serif TC", "Songti TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('朝歌城', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// the ground's colour over the whole map: the original's khaki earth, its grass patches (from the art, blurred and
// broken up) and some scuffing; one texture, laid over all three levels
function groundTex(lay) {
  const S = 64, c = document.createElement('canvas'); c.width = MW * S; c.height = MH * S; const g = c.getContext('2d');
  g.fillStyle = '#8c8462'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) { const x = R(i) * c.width, y = R(i + 0.5) * c.height, r = 2 + R(i + 0.3) * 9; g.fillStyle = `rgba(${R(i + 2) < 0.5 ? '60,52,34' : '182,172,132'},${0.05 + R(i + 4) * 0.1})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.filter = 'blur(10px)';
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < MW * 4; i++) if (lay[j * MW * 4 + i] === CL.grass) { g.fillStyle = 'rgba(46,92,30,0.55)'; g.beginPath(); g.arc((i + 0.5) * S / 4, (j + 0.5) * S / 4, S * 0.24, 0, 7); g.fill(); }
  g.filter = 'none';
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < MW * 4; i++) if (lay[j * MW * 4 + i] === CL.grass) for (let k = 0; k < 10; k++) {
    const x = (i + R(i * 7 + j + k)) * S / 4, y = (j + R(j * 5 + i + k * 3)) * S / 4; g.strokeStyle = `rgba(${R(k + i) < 0.5 ? '70,130,40' : '40,90,26'},0.7)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R(k) - 0.5) * 4, y - 5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, MW / MH); t.offset.set(0, 1); return t;
}

// ---------------------------------------------------------------- the set
async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const lay = await readLayout('assets/maps/0ebdd4.png', MW, MH, PALETTE, { [CL.grass]: 1.6 });
  const earth = new THREE.MeshStandardMaterial({ map: groundTex(lay), roughness: 0.95 });
  const stoneT = T.bricks(0x9a9a8a, 3, 'gateStone'), stoneW = T.material(stoneT, {}, [16, 16]);   // the retaining walls (the floor's UVs are map-scaled: 1/32)
  S.add(LV.mesh(earth, stoneW, -0.6, 1 / 32));
  const tread = T.material(T.bricks(0xb8b4a0, 1, 'gateTread'), {}, [1, 1]), riser = T.material(T.bricks(0x8a8878, 2, 'gateRiser'), {}, [1, 1]);
  for (const r of LV.ramps) S.add(stairs(r, tread, riser, 0.5));
  const cap = T.material(T.rock(0xb8b8a8, 'gateCap', 0.3), { color: 0xe0e0d4 }, [0.5, 0.5]);
  const blue = T.material(T.roofTiles(0x22407e, 8, 8), { envMapIntensity: 0.7, side: THREE.DoubleSide }, [1, 1]);
  const blueRim = new THREE.MeshStandardMaterial({ color: 0x2a467e, roughness: 0.45, metalness: 0.1 });
  const wallB = T.material(T.bricks(0xc8c2a4, 6, 'gateWall'), {}, [1, 1]);
  const lacq = M.lacquer, gold = M.gold;

  // a wall's coping: a narrow roof of the glazed tiles, its ridge along the wall (turned for one running north-south)
  const coping = (x0, z0, x1, z1, y) => {
    if (x1 - x0 >= z1 - z0) return hipRoof(blue, blueRim, x0, x1, z0, z1, y, 0.26, 0.14, 0.04, false);
    const g = hipRoof(blue, blueRim, -z1, -z0, x0, x1, y, 0.26, 0.14, 0.04, false); g.rotation.y = Math.PI / 2; return g;
  };
  const wall = (x0, z0, x1, z1, y0, y1) => { S.add(shade(box(wallB, x0, y0, z0, x1, y1, z1, 1))); S.add(coping(x0, z0, x1, z1, y1)); };
  // stone parapets (posts and a rail) along the top of the retaining walls, as the original draws them
  const rails = [], posts = [];
  const parapet = (x0, z0, x1, z1, y) => {
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = along ? x1 - x0 : z1 - z0;
    rails.push(box(cap, Math.min(x0, x1) - (along ? 0 : 0.06), y + 0.3, Math.min(z0, z1) - (along ? 0.06 : 0), Math.max(x0, x1) + (along ? 0 : 0.06), y + 0.38, Math.max(z0, z1) + (along ? 0.06 : 0), 0.5));
    rails.push(box(cap, Math.min(x0, x1) - (along ? 0 : 0.04), y, Math.min(z0, z1) - (along ? 0.04 : 0), Math.max(x0, x1) + (along ? 0 : 0.04), y + 0.07, Math.max(z0, z1) + (along ? 0.04 : 0), 0.5));
    const n = Math.max(1, Math.round(Math.abs(len) / 0.55));
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; posts.push(box(cap, x - 0.07, y, z - 0.07, x + 0.07, y + 0.46, z + 0.07, 0.5)); }
  };
  parapet(10, 10.85, 13, 10.85, HIGH); parapet(19, 10.85, 22, 10.85, HIGH);            // the upper court's edge either side of the platform
  parapet(13.15, 11, 13.15, 12.85, HIGH); parapet(18.85, 11, 18.85, 12.85, HIGH); parapet(13.15, 12.85, 18.85, 12.85, HIGH);   // the platform
  parapet(2, 16.85, 13, 16.85, MID); parapet(19, 16.85, 30, 16.85, MID);               // the middle court's south edge (its walls of rows 17-18)
  parapet(12.85, 15, 12.85, 17, MID); parapet(19.15, 15, 19.15, 17, MID);               // the big stair's sides
  for (const [x0, x1] of [[7.85, 10.15], [21.85, 26.15]]) { parapet(x0, 9, x0, 11, HIGH); parapet(x1, 9, x1, 11, HIGH); }   // the side stairs' cheeks
  S.add(shade(merged(cap, rails)), shade(merged(cap, posts)));
  // the walls of rows 17-18 (stone, on the middle level, their faces down to the plaza) carry the stone of the floor's own
  // faces; the blue-coped walls of rows 9-10 (x 2-8 and 26-30) a coping of glazed tiles over their drop
  for (const [x0, x1] of [[2, 7.85], [26.15, 30]]) wall(x0, 9.4, x1, 10.0, HIGH, HIGH + 0.75);

  // the outer walls: pale brick under a coping of blue glazed tiles (a little gable along the top)
  wall(-0.6, 1.95, 12.7, 3.0, -0.4, HIGH + 1.45); wall(19.2, 1.95, 32.6, 3.0, -0.4, HIGH + 1.45);   // north, either side of the gatehouse
  wall(1.2, 3.0, 1.95, 23.0, -0.4, HIGH + 1.45); wall(30.05, 3.0, 30.8, 23.0, -0.4, HIGH + 1.45);   // west and east
  wall(1.2, 23.1, 14.0, 23.75, -0.4, LOW + 0.85); wall(18.0, 23.1, 30.8, 23.75, -0.4, LOW + 0.85);   // south, the way in between
  for (const x of [13.75, 18.25]) { S.add(shade(box(wallB, x - 0.25, -0.4, 22.95, x + 0.25, LOW + 1.2, 23.9, 1))); S.add(coping(x - 0.25, 22.95, x + 0.25, 23.9, LOW + 1.2)); }   // its piers

  // the gatehouse: a brick body on the wall, red columns across its front, the doors, the plaque, two blue eaves
  const gx0 = 12.7, gx1 = 19.2, gz0 = 1.55, gz1 = 3.05, gy = HIGH;
  S.add(shade(box(wallB, gx0, -0.4, gz0, gx1, gy + 1.9, gz1, 1)));
  for (const x of [13.35, 14.45, 17.4, 18.5]) {
    const col = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 1.95, 20), lacq)); col.position.set(x, gy + 0.975, gz1 + 0.15); S.add(col);
    S.add(shade(box(cap, x - 0.2, gy, gz1 - 0.05, x + 0.2, gy + 0.12, gz1 + 0.35, 0.5)));
  }
  S.add(shade(box(lacq, gx0 + 0.1, gy + 1.8, gz1 + 0.02, gx1 - 0.1, gy + 1.98, gz1 + 0.3)));   // the beam over the columns
  const doorM = T.material(T.planks(0x6a3a1c, 3), {});
  for (const [a, b] of [[14.95, 15.98], [16.02, 17.05]]) {
    S.add(shade(box(doorM, a, gy, gz1 - 0.06, b, gy + 1.45, gz1 + 0.02, 2)));
    const studs = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), gold); s.position.set(a + 0.15 + c * (b - a - 0.3) / 3, gy + 0.2 + r * 0.21, gz1 + 0.03); studs.push(s); }
    S.add(shade(merged(gold, studs)));
  }
  S.add(shade(box(lacq, 14.85, gy + 1.45, gz1 - 0.08, 17.15, gy + 1.56, gz1 + 0.05)));
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), new THREE.MeshStandardMaterial({ map: plaqueTex(), roughness: 0.5, emissive: 0x101010 }));
  plaque.position.set(16, gy + 1.68, gz1 + 0.32); S.add(plaque);
  S.add(hipRoof(blue, blueRim, gx0 - 0.1, gx1 + 0.1, gz0 - 0.15, gz1 + 0.35, gy + 1.98, 0.7, 0.45, 0.22));
  S.add(shade(box(wallB, 13.6, gy + 2.2, gz0 + 0.1, 18.3, gy + 2.85, gz1 - 0.15, 1)));
  for (const x of [13.75, 18.15]) { const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.65, 14), lacq)); c.position.set(x, gy + 2.52, gz1 - 0.1); S.add(c); }
  S.add(hipRoof(blue, blueRim, 13.4, 18.5, gz0 - 0.05, gz1 - 0.05, gy + 2.85, 0.75, 0.4, 0.2));
  for (const x of [13.2, 18.7]) { FX.fire(E, { x, y: gz1 + 0.6, z: gy + 1.25 - LV.at(x, gz1 + 0.6), size: 0.42, light: 6, col: 0xff9040, smoke: false }); S.add(shade(box(M.bronze, x - 0.09, gy, gz1 + 0.51, x + 0.09, gy + 1.2, gz1 + 0.69))); }   // torches flanking the gate

  // outside: the land beyond the north wall (at the gate's level) and round the others (low), a few rocks and trees
  const outT = T.material(T.dirt(0x6a6a48, 'gateOutside'), { color: 0x9a9a80 }, [12, 6]);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(60, 14).rotateX(-Math.PI / 2), outT); out.position.set(16, HIGH - 0.01, -5); out.receiveShadow = true; S.add(out);
  const outS = new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), outT); outS.position.set(16, -0.42, 20); outS.receiveShadow = true; S.add(outS);
  const lt = leafTex(['#1e4a1c', '#2a5e24', '#3a722c', '#163a16', '#4a8434']), lt2 = leafTex(['#2a5e24', '#3e7a2e', '#4e8e38', '#1e4a1c']);
  const cardM = t => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const tm = { bark: T.material(T.bark(0x5a4030), {}, [1, 2]), leaf: cardM(lt), leaf2: cardM(lt2), core: new THREE.MeshStandardMaterial({ color: 0x122a10, roughness: 1 }),
    depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lt, alphaTest: 0.5 }),
    stone: T.material(T.rock(0x9a9a90, 'gateRock', 0.3), { color: 0xd8d8d0 }, [0.4, 0.4]) };
  TREES.forEach(([x, z], k) => S.add(tree(tm, x, z, LV.at(x, z), 1.05, k + 1)));
  TREES_OUT.forEach(([x, z], k) => S.add(tree(tm, x, z, HIGH, 1.15, k + 40)));
  ROCKS.forEach(([x, z, s], k) => S.add(rock(tm.stone, x, z, LV.at(x, z), s, k + 3)));
  ROCKS_OUT.forEach(([x, z], k) => S.add(rock(tm.stone, x, z, HIGH, 0.9, k + 20)));
  // grass tufts over the original's patches, not on the stairs
  const pts = [], W4 = MW * 4;
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W4; i++) if (lay[j * W4 + i] === CL.grass) for (let k = 0; k < 3; k++) {
    const x = (i + R(i * 13 + j + k)) / 4, z = (j + R(j * 11 + i + k * 7)) / 4;
    if (!STAIR_CELLS.some(([a, b]) => a === Math.floor(x) && b === Math.floor(z))) pts.push([x, LV.at(x, z), z]);
  }
  S.add(grass(pts, { size: 0.42, cols: ['#3a6a26', '#4a7e2e', '#2e5a20', '#5a8a36'] }));
  for (const [x, y] of CHESTS) { const c = chest(M, x + 0.5, y + 0.5, LV.at(x + 0.5, y + 0.5), false, 0, 1.4); S.add(c); chestG.set(x + ',' + y, c); }
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y);
  if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
// a chest the map does not draw ((2, 4) and (29, 4), the upper court's corners): struck, it shows up open
function found(x, y) {
  if (!world) return;
  const g = chest(M, x + 0.5, y + 0.5, LV.at(x + 0.5, y + 0.5), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

// the solid tops: the floors, and the walls, the gatehouse and the land outside the north wall (at the gate's level)
function ground(x, z) {
  if (z < 1.95) return HIGH;
  if (x < 1.95 || x >= 30.05) return z < 23.1 ? HIGH + 1.45 : LOW + 0.85;
  if (z < 3.05 && (x < 12.7 || x >= 19.2)) return HIGH + 1.45;
  if (z < 3.05) return HIGH + 1.9;
  if (z >= 23.1 && (x < 14 || x >= 18)) return LOW + 0.85;
  return LV.at(x, z);
}
// cells a model blocks (tools/qa/sets.js): each tree's 2 x 2 cells round its foot, the rocks
const TREE_CELLS = TREES.flatMap(([x, z]) => { const cx = Math.round(x), cz = Math.round(z); return [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]; });
export default {
  build, openChest, ground, particles: 'leaves', slopes: STAIR_CELLS,
  props: TREE_CELLS.concat(ROCKS.map(([x, z]) => [Math.floor(x), Math.floor(z)]), CHESTS),
  // a clear night: moonlight from the north-west, the gate's torches warm
  mood: { bg: 0x0c1428, voidCol: false, fog: 0x101a34, fogD: 0.014, sky: 0x9ab4e8, under: 0x2a2434, hemi: 0.95,
    sun: 0xc0d0ff, sunI: 2.4, sunDir: [-0.35, 0.82, 0.45], sat: 1.0, exposure: 1.15, bloom: 0.5, aoR: 0.8,
    env: { top: 0x3a4a7a, mid: 0x242c48, low: 0x101018, lights: [[4, 8, -6, 0xc8d4ff, 4]] } },
};
