// 佳夢關, the pass of the 魔家四將 (maps 0f7f60 and 0f87e8, the same art: scenes 47 and 50 and battle 23), remade: a
// walled gate on the water, reached by one long timber bridge. Measured on tools/qa/grid.py 0f7f60:
//   the wall       the pass's city wall of olive-grey brick right across the north (to row 3), and out over the water both
//                  sides (to z 4.3 west of x 4.5 and east of x 19), battlements along its top
//   the gatehouse  on the wall's face (x 8.1-15.9, out to z 4.0): pale brick, four red columns (x 8.8, 10.3, 13.6, 15.15),
//                  the plaque over the doors (x 11-13; its pixels from the map), green glazed eaves in two tiers; its face
//                  set back to z 3.8, 0.4 behind 魯雄 at its doors (scene 47)
//   the court      x 4.5-19, rows 3-6, packed khaki earth with patches of grass, stone balustrades down its sides
//   the front      rows 7-8: a brick rampart (its top a step up, out of reach) with a balustrade, its face down into the
//                  water; the bridge's way through it (x 10-14)
//   the bridge     x 10-14 from row 8 to the bank at row 27: round logs laid across on two stringers, lacquered posts with
//                  gilt bands and rails either side, grey stone kerbs outside them, stone piles down into the water. Each
//                  row of it is its own piece: battle 23 breaks it a row a round from the south (breakRow)
//   the bank       rows 27-28: grass down to the water, white flowers along its edge
// The water the original's royal blue. Lit from the west (the bridge's shadow falls east on the water, as drawn).
// Also 佳夢關's hall (maps 0f8b0c and 0f8b54: scene 51 and battle 24): jiamengHall below.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, shade, merged, latticeWall, curtain, screen, ding } from '../kit/parts.js';
import { readLayout, grass, CL } from '../kit/terrain.js';
import { hipRoof, groundTex } from './citygate.js';
import { G, D } from '../rules.js';

const MW = 24, MH = 30, DECK = 0, WATER = -1.15, HOVER = -0.21,   // HOVER: the water's walking height, where a flier over it hangs (just under the band that reads as open ground, tools/qa/sets.js)
  BASE = -3, RAMP = 0.5, WALL = 2.8, GATE_EAVE = 1.65;
const CX0 = 4.5, CX1 = 19, CZ0 = 3, FRONT = 7, FACE = 8.75, GX0 = 8.1, GX1 = 15.9, GZ = 3.8;   // (the gatehouse's face 0.4 behind where 魯雄 stands at its doors in scene 47)
const BX0 = 10, BX1 = 14, ROW0 = 8, ROW1 = 26, BANK = 27, SHOULDER = 0.5;   // (the bank either side of the bridge's end: no one can get there past the end posts, so it stands up)
const PALETTE = { [CL.ground]: [0xb4b490, 0x90906c], [CL.grass]: [0x002400, 0x246c00, 0x6cb400], [CL.water]: [0x000090, 0x00b4fc, 0x0024b4, 0x0048d8, 0x006cd8] };
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function levels() {
  const L = new Levels(MW, MH, 4);
  L.set(CX0, CZ0, CX1, FRONT, DECK);                                       // the court
  L.set(CX0, CZ0, 5, FRONT, RAMP).set(18, CZ0, CX1, FRONT, RAMP);         // its edges (cells 4 and 18, blocked): stone ledges under the balustrades
  L.set(BX0, FRONT, BX1, FACE, DECK);                                      // the bridge's way through the front
  L.set(CX0, FRONT, BX0, FACE, RAMP).set(BX1, FRONT, CX1, FACE, RAMP);     // the front rampart either side of it
  return L;
}
const LV = levels();
let built = false, M = null, rows = new Map(), broken = new Set(), world = null;

// ---------------------------------------------------------------- materials
let MAT = null;
function materials() {
  if (MAT) return MAT;
  M = mats();
  MAT = {
    wall: T.material(T.bricks(0x8a8a68, 4, 'jmWall'), { color: 0xe8e8d8 }, [1, 1]),                   // the olive-grey brick of the wall and the rampart
    gateBrick: T.material(T.bricks(0xd8d4b8, 6, 'jmGateBrick'), { color: 0xfffff4 }, [1, 1]),          // the gatehouse's pale brick
    cap: T.material(T.rock(0xb4b49a, 'jmCap', 0.3), { color: 0xeeeedc }, [0.5, 0.5]),                  // copings, balustrades, kerbs, piles
    walk: T.material(T.flags(0xa8a890, 0x8c8c74, 'jmWalk', 6, 0.3, 0x5a5a48), {}, [0.5, 0.5]),        // the wall-walk's flags
    log: T.material(logTex(), {}, [1, 1]),                                                               // the deck's logs, golden timber as drawn
    beam: T.material(T.wood(0x4a2c18, 'jmBeam'), {}, [1, 1]),                                           // stringers and rails' undersides
    post: T.material(T.lacquer(0xd0661e, 'jmPost2'), { clearcoat: 0.7, clearcoatRoughness: 0.25 }),      // the posts, lacquered orange as drawn
    roof: T.material(T.roofTiles(0x2e6a34, 8, 8), { envMapIntensity: 0.8, side: THREE.DoubleSide, clearcoat: 0.5, clearcoatRoughness: 0.35 }, [1, 1]),   // green glaze
    roofRim: new THREE.MeshStandardMaterial({ color: 0x3e7a3a, roughness: 0.35, metalness: 0.1 }),
    door: T.material(T.lacquer(0x7a3418, 'jmDoor'), { clearcoat: 0.5, clearcoatRoughness: 0.35 }),   // the doors, red-brown lacquer as drawn
    turf: T.material(T.turf(0x3e6a26), { color: 0xd0e0b8 }, [1, 1]),
    bankFace: T.material(T.rock(0x5a5440, 'jmBank', 0.5), { color: 0xc8c0a8 }, [1, 1]),
    flower: new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.7 }),
  };
  return MAT;
}

// the logs: barked, golden timber, the grain running along each log (the cylinder's v) with a knot here and there,
// darker in the cracks and weathered grey-brown towards the ends
function logTex() {
  return T.pbr('jmLog', 512, (u, v, o) => {
    const w = T.fbmA(u, v, 3, 18, 4, 31), grain = 0.5 + 0.5 * Math.sin((u * 26 + w * 3) * Math.PI * 2), n = T.fbm(u, v, 10, 3, 32);
    const knot = T.smooth(0.08, 0.0, Math.hypot(((u * 3) % 1) - 0.5, (((v + 0.37) * 5) % 1) - 0.5) - 0.06 * T.fbm(u, v, 30, 2, 33));
    const crack = 1 - T.smooth(0.0, 0.012, Math.abs(T.fbmA(u, v, 2, 30, 3, 34) - 0.5)), end = T.smooth(0.12, 0.0, Math.min(v, 1 - v));
    o.c = T.mixc([0.62, 0.36, 0.14], [0.9, 0.6, 0.26], grain * 0.55 + n * 0.45);
    o.c = T.mixc(o.c, [0.36, 0.2, 0.08], Math.max(knot * 0.8, crack * 0.7));
    o.c = T.mixc(o.c, [0.42, 0.33, 0.24], end * 0.5);
    o.h = 0.5 + (grain - 0.5) * 0.08 - crack * 0.25 - knot * 0.1; o.r = 0.8;
  }, 4);
}
// ---------------------------------------------------------------- the bridge, row by row
// a row of the bridge (z y .. y+1): three logs across on the two stringers, the posts and rails over it either side,
// the stone kerbs outside them; a pile pair under every third row
function bridgeRow(y) {
  const { log, beam, post, cap } = materials(), g = new THREE.Group(), logs = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const r = 0.155 + R(y * 7 + k) * 0.01, m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, BX1 - BX0 - 0.06 - R(y + k * 3) * 0.08, 14, 1), log);
    m.rotation.z = Math.PI / 2; m.rotation.x = R(y * 3 + k) * 6.28; m.position.set((BX0 + BX1) / 2 + (R(y * 5 + k) - 0.5) * 0.05, DECK - r, y + (k + 0.5) / 3); logs.add(m);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), beam); peg.rotation.z = Math.PI / 2; peg.position.set(BX0 + 0.05, DECK - r, y + (k + 0.5) / 3); logs.add(peg);
  }
  g.add(shade(logs)); g.userData.logs = logs;
  const st = [box(beam, BX0 + 0.12, DECK - 0.62, y, BX0 + 0.34, DECK - 0.3, y + 1, 1), box(beam, BX1 - 0.34, DECK - 0.62, y, BX1 - 0.12, DECK - 0.3, y + 1, 1)];
  g.add(shade(merged(beam, st)));
  const kerbs = [box(cap, BX0 - 0.55, DECK - 0.42, y, BX0 - 0.36, DECK + 0.06, y + 1, 1), box(cap, BX1 + 0.36, DECK - 0.42, y, BX1 + 0.55, DECK + 0.06, y + 1, 1)];
  g.add(shade(merged(cap, kerbs)));
  const rail = [], bands = [];
  for (const x of [BX0 - 0.2, BX1 + 0.2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.98, 12), post); p.position.set(x, DECK + 0.39, y + 0.5); rail.push(p);
    for (const yy of [0.14, 0.5, 0.82]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.06, 12), M.gold); b.position.set(x, DECK + yy, y + 0.5); bands.push(b); }
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), M.gold); kn.position.set(x, DECK + 0.94, y + 0.5); bands.push(kn);
    rail.push(box(post, x - 0.05, DECK + 0.68, y, x + 0.05, DECK + 0.77, y + 1, 1), box(post, x - 0.04, DECK + 0.3, y, x + 0.04, DECK + 0.36, y + 1, 1));
  }
  g.add(shade(merged(post, rail)), shade(merged(M.gold, bands)));
  if (y % 3 === 2) for (const x of [BX0 + 0.23, BX1 - 0.23]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, DECK - 0.6 - BASE, 12), cap); p.position.set(x, (DECK - 0.6 + BASE) / 2, y + 0.5); g.add(shade(p)); }
  return g;
}
// the row breaks (k 0..1): its logs split and tumble into the water, the rails and kerbs after them, the stubs left on
// the stringers' ends; at 1 the row is gone (battle 23's turn hook, 0x0F813A: twenty steps, four frames each)
export function breakRow(row, k) {
  const g = rows.get(row); if (!g) return;
  if (!g.userData.fall) {   // each log, peg, stringer, kerb and rail its own piece, turning about its own middle (a piece built at the origin turned about the world's: the row swung up into the sky [the user's report])
    const logs = g.userData.logs, parts = [...(logs && logs.parent === g ? logs.children : []), ...g.children.filter(c => c !== logs)];
    g.userData.fall = parts.map((c, i) => {
      const par = c.parent, mid = par.worldToLocal(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3())), piv = new THREE.Group();
      piv.position.copy(mid); par.add(piv); piv.add(c); c.position.sub(mid);
      return { c: piv, p: mid.clone(), spin: (R(row * 11 + i) - 0.5) * 3, dx: (R(row * 13 + i) - 0.5) * 0.6, delay: Math.min(0.4, i * 0.035) };
    });
    broken.add(row);
  }
  for (const f of g.userData.fall) {
    const t = Math.max(0, Math.min(1, (k - f.delay) / (1 - f.delay))), drop = t * t * (DECK - WATER + 1.6);
    f.c.position.set(f.p.x + f.dx * t, f.p.y - drop, f.p.z); f.c.rotation.set(f.spin * t, f.spin * 0.3 * t, f.spin * 0.4 * t);
  }
  if (k >= 1) g.visible = false;
}
export const rowGroup = row => rows.get(row);   // (tools/qa/battlecheck.js: the row falls into the water)
export const rowBroken = row => broken.has(row);

// ---------------------------------------------------------------- the wall and the gatehouse
function wallBlock(x0, z0, x1, z1, faceZ) {   // a stretch of the city wall: brick to the top, a coping, battlements along its south edge
  const { wall, cap, walk } = materials(), g = new THREE.Group();
  g.add(box(wall, x0, BASE, z0, x1, WALL, z1, 1), box(walk, x0, WALL, z0, x1, WALL + 0.02, z1 - 0.3, 0.5));
  const mer = [];
  for (let x = x0; x < x1 - 0.01; x += 0.6) mer.push(box(wall, x, WALL, faceZ - 0.3, Math.min(x1, x + 0.36), WALL + 0.42, faceZ, 1));
  mer.push(box(cap, x0, WALL + 0.0, faceZ - 0.32, x1, WALL + 0.05, faceZ + 0.02, 0.5));
  for (let x = x0; x < x1 - 0.01; x += 0.6) mer.push(box(cap, x - 0.02, WALL + 0.42, faceZ - 0.32, Math.min(x1, x + 0.36) + 0.02, WALL + 0.48, faceZ + 0.02, 0.5));
  g.add(merged(wall, mer));
  return shade(g);
}
function gatehouse(S) {
  const { gateBrick, cap, roof, roofRim, door } = materials(), g = new THREE.Group();
  g.add(box(cap, GX0 - 0.08, DECK, GZ - 2.1, GX1 + 0.08, DECK + 0.14, GZ + 0.06, 0.5));                // the plinth
  g.add(box(gateBrick, GX0, DECK + 0.14, GZ - 2.0, 11.0, GATE_EAVE, GZ - 0.06, 1), box(gateBrick, 13.0, DECK + 0.14, GZ - 2.0, GX1, GATE_EAVE, GZ - 0.06, 1), box(gateBrick, 11.0, 1.02, GZ - 2.0, 13.0, GATE_EAVE, GZ - 0.06, 1));
  g.add(box(cap, 10.85, DECK + 0.14, GZ - 0.2, 11.0, 1.02, GZ, 0.5), box(cap, 13.0, DECK + 0.14, GZ - 0.2, 13.15, 1.02, GZ, 0.5), box(cap, 10.8, 0.96, GZ - 0.22, 13.2, 1.06, GZ + 0.02, 0.5));
  for (const [hx, s] of [[11.0, 1], [13.0, -1]]) { const leaf = box(door, Math.min(0, s * 0.99), 0, -0.04, Math.max(0, s * 0.99), 0.82, 0.04, 1);   // (corners in order: a box drawn backwards faces inward) leaf.position.set(hx, DECK + 0.14, GZ - 0.12); g.add(leaf);
    for (const yy of [0.16, 0.41, 0.66]) for (let j = 1; j < 5; j++) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), M.gold); n.position.set(hx + s * j * 0.19, DECK + 0.14 + yy, GZ - 0.07); g.add(n); } }
  for (const x of [8.8, 10.3, 13.6, 15.15]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, GATE_EAVE - 0.14, 18), M.lacquer); c.position.set(x, (GATE_EAVE + 0.14) / 2, GZ + 0.12); g.add(c);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 18), cap); b.position.set(x, DECK + 0.2, GZ + 0.12); g.add(b); }
  g.add(box(M.lacquer, GX0 - 0.05, GATE_EAVE - 0.14, GZ + 0.02, GX1 + 0.05, GATE_EAVE, GZ + 0.22));
  S.add(shade(g));
  S.add(hipRoof(roof, roofRim, GX0 - 0.1, GX1 + 0.1, GZ - 2.2, GZ + 0.22, GATE_EAVE, 0.55, 0.45, 0.22));   // the lower eaves
  S.add(shade(box(gateBrick, 9.9, GATE_EAVE + 0.1, GZ - 1.9, 14.1, GATE_EAVE + 0.75, GZ - 0.5, 1)));
  S.add(hipRoof(roof, roofRim, 9.7, 14.3, GZ - 2.0, GZ - 0.35, GATE_EAVE + 0.75, 0.75, 0.45, 0.24));    // the upper roof
  // the plaque: the map's own pixels of it, in a dark frame
  const img = new Image(); img.src = 'assets/maps/0f7f60.png';
  const PX = 11.3 * 32, PY = 2.02 * 32, PW = 1.75 * 32, PH = 0.47 * 32;
  const c = document.createElement('canvas'); c.width = PW * 4; c.height = PH * 4; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  img.onload = () => { const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(img, PX, PY, PW, PH, 0, 0, c.width, c.height); t.needsUpdate = true; };
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(PW / 32, PH / 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
  pl.position.set(12.15, 1.28, GZ + 0.05); S.add(pl);
  S.add(shade(box(M.lacquerDark, 12.15 - PW / 64 - 0.06, 1.28 - PH / 64 - 0.05, GZ, 12.15 + PW / 64 + 0.06, 1.28 + PH / 64 + 0.05, GZ + 0.04)));
}

// ---------------------------------------------------------------- the set
async function build(E, FX) {
  const S = E.world.scene, m = materials(); world = E.world; rows = new Map(); broken = new Set();
  const lay = await readLayout('assets/maps/0f7f60.png', MW, MH, PALETTE, { [CL.grass]: 1.4 });
  // the court and the front: packed khaki earth with the original's grass patches, the rampart's brick
  const earth = new THREE.MeshStandardMaterial({ map: groundTex(lay, MW, MH), roughness: 0.95 });
  const top = T.material(T.flags(0x9a9a7c, 0x86866c, 'jmRampTop', 4, 0.3, 0x55553f), {}, [1, 1]);
  S.add(shade(LV.mesh(earth, m.wall, BASE, 1 / 32), true));
  S.add(shade(merged(top, [box(top, CX0, RAMP - 0.02, FRONT, BX0, RAMP + 0.01, FACE, 1), box(top, BX1, RAMP - 0.02, FRONT, CX1, RAMP + 0.01, FACE, 1)])));
  // balustrades: the court's sides (x 4.75 and 18.75, rows 3-7) and the rampart's north edge (either side of the way)
  const P = [], post = (x, z, y) => { P.push(box(m.cap, x - 0.08, y, z - 0.08, x + 0.08, y + 0.55, z + 0.08, 2)); const k = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m.cap); k.position.set(x, y + 0.62, z); P.push(k); };
  const run = (x0, z0, x1, z1, y) => { const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), n = Math.max(1, Math.round((along ? x1 - x0 : z1 - z0) / 0.75));
    for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, y);
    P.push(along ? box(m.cap, x0, y + 0.4, z0 - 0.05, x1, y + 0.48, z0 + 0.05, 2) : box(m.cap, x0 - 0.05, y + 0.4, z0, x0 + 0.05, y + 0.48, z1, 2));
    P.push(along ? box(m.cap, x0, y + 0.1, z0 - 0.04, x1, y + 0.16, z0 + 0.04, 2) : box(m.cap, x0 - 0.04, y + 0.1, z0, x0 + 0.04, y + 0.16, z1, 2)); };
  run(4.75, CZ0, 4.75, FRONT, RAMP); run(18.75, CZ0, 18.75, FRONT, RAMP);
  run(CX0 + 0.2, FRONT + 0.15, BX0 - 0.05, FRONT + 0.15, RAMP); run(BX1 + 0.05, FRONT + 0.15, CX1 - 0.2, FRONT + 0.15, RAMP);
  S.add(shade(merged(m.cap, P)));
  S.add(shade(merged(m.cap, [box(m.cap, CX0 - 0.04, RAMP - 0.04, FACE - 0.08, BX0, RAMP + 0.06, FACE + 0.04, 0.5), box(m.cap, BX1, RAMP - 0.04, FACE - 0.08, CX1 + 0.04, RAMP + 0.06, FACE + 0.04, 0.5)])));   // the rampart's coping
  // the wall: behind the court, and out over the water both sides; the gatehouse on its face
  S.add(wallBlock(CX0, -4, CX1, CZ0, CZ0), wallBlock(-9, -4, CX0, 4.3, 4.3), wallBlock(CX1, -4, MW + 9, 4.3, 4.3));
  gatehouse(S);
  // the bridge, row by row, from the way through the front to the bank; the posts and kerbs carry on over the front and
  // onto the bank
  for (let y = FRONT; y <= 28; y++) { const g = bridgeRow(y); if (y < ROW0 || y > ROW1) g.remove(g.userData.logs); S.add(g); rows.set(y, g); }
  for (let y = ROW0; y <= ROW1; y++) if (D.n === 23 && G.terrain && G.terrain[y] && G.terrain[y][BX0] === 2) breakRow(y, 1);   // (a battle loaded with rows already broken)
  // the bank: grass down to the water, an earthen edge, white flowers along it
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(MW + 30, 8, 60, 16).rotateX(-Math.PI / 2), m.turf); bank.position.set(MW / 2, DECK - 0.01, BANK + 4); bank.receiveShadow = true;
  const bp = bank.geometry.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i) + MW / 2, z = bp.getZ(i) + BANK + 4; bp.setY(i, bankAt(x, z) - DECK + (z > BANK + 1.2 ? (R(i) - 0.5) * 0.06 : 0)); }
  bank.geometry.computeVertexNormals(); S.add(bank);
  S.add(shade(merged(m.bankFace, [box(m.bankFace, -15, BASE, BANK - 0.25, BX0 - 0.55, DECK + SHOULDER - 0.02, BANK + 0.02, 1), box(m.bankFace, BX0 - 0.55, BASE, BANK - 0.25, BX1 + 0.55, DECK - 0.02, BANK + 0.02, 1), box(m.bankFace, BX1 + 0.55, BASE, BANK - 0.25, MW + 15, DECK + SHOULDER - 0.02, BANK + 0.02, 1),
    box(m.bankFace, BX0 - 0.6, DECK - 0.4, BANK, BX0 - 0.5, DECK + SHOULDER, BANK + 3, 1), box(m.bankFace, BX1 + 0.5, DECK - 0.4, BANK, BX1 + 0.6, DECK + SHOULDER, BANK + 3, 1)])));
  const tufts = [], fl = [];
  for (let i = 0; i < 900; i++) { const x = -6 + R(i) * (MW + 12), z = BANK + 0.05 + R(i + 0.3) * 2.6; if (x > BX0 - 0.7 && x < BX1 + 0.7) continue; tufts.push([x, bankAt(x, z), z]); }
  for (let i = 0; i < 160; i++) { const x = -6 + R(i + 7) * (MW + 12), z = BANK + 0.05 + R(i + 9) * 0.35; if (x > BX0 - 0.7 && x < BX1 + 0.7) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), m.flower); f.position.set(x, bankAt(x, z) + 0.06 + R(i) * 0.05, z); fl.push(f); }
  S.add(grass(tufts, { size: 0.3, cols: ['#2e5a1e', '#3e6e26', '#4e8030', '#2a4a1a'] }), merged(m.flower, fl));
  // the court's grass patches as short tufts (never over the legs)
  const pts = [], W4 = MW * 4;
  for (let j = CZ0 * 4; j < FRONT * 4; j++) for (let i = CX0 * 4 + 1; i < CX1 * 4 - 1; i++) if (lay[j * W4 + i] === CL.grass) for (let k = 0; k < 2; k++) {
    const x = (i + R(i * 13 + j + k)) / 4, z = (j + R(j * 11 + i + k * 7)) / 4; if (z < GZ + 0.15 && x > GX0 && x < GX1) continue; pts.push([x, DECK, z]); }
  S.add(grass(pts, { size: 0.26, cols: ['#2e5a1e', '#3a6a24', '#4a7e2c', '#5a8e34'] }));
  // the water: the original's royal blue, its ripples lighter
  FX.water(S, { r: [-16, -16, MW + 16, MH + 16], y: WATER, deep: 0x0c1c7a, lit: 0x2e6ad0, stars: 0.18 });
  built = true;
}
// the bank's height: the bridge's end at the deck, the shoulders either side a step up
function bankAt(x, z) { return x > BX0 - 0.55 && x < BX1 + 0.55 ? DECK : DECK + SHOULDER; }
function ground(x, z) {
  if (!built) return 0;
  const cx = Math.floor(x), cy = Math.floor(z);
  if (z >= BANK) return bankAt(x, z);
  if (x >= BX0 && x < BX1 && z >= FRONT) return z >= ROW0 && broken.has(cy) ? HOVER : DECK;   // the deck (a broken row: over the water)
  if (z >= CZ0 && z < FACE && x >= CX0 && x < CX1) { if (z < GZ - 0.25 && x >= GX0 && x < GX1) return GATE_EAVE; return LV.at(x, z); }
  if (z < CZ0 && x >= CX0 && x < CX1) return WALL;
  if (z < 4.3 && (x < CX0 || x >= CX1)) return WALL;
  void cx; return HOVER;   // (the water: a flier's height over it)
}
export const jiamengBridge = {
  build, ground, particles: null,
  props: [[9, 27], [9, 28], [14, 27], [14, 28]],   // the bridge's last posts on the bank
  mood: { bg: 0x6a88b8, voidCol: false, fog: 0x8aa4c8, fogD: 0.01, sky: 0xd8e6f8, under: 0x4a5040, hemi: 0.95,
    sun: 0xfff0d8, sunI: 2.9, sunDir: [-0.6, 0.72, 0.35], sat: 1.0, exposure: 1.0, bloom: 0.2, aoR: 0.9,
    env: { top: 0xc0d4f0, mid: 0x8a9478, low: 0x2a3440, lights: [[-6, 7, 4, 0xfff4e0, 3]] } },
};

// ---------------------------------------------------------------- 佳夢關's hall
// 佳夢關's hall (maps 0f8b0c and 0f8b54, the same art: scene 51 and battle 24), where the heroes wait for the 魔家四將.
// Measured on tools/qa/grid.py 0f8b0c:
//   the back      red lattice bays with gold silk curtains tied back either side of each (x 1-3 and 12-15 to z 3; x 4-6 and
//                 9-11 to z 2, the dais's alcove), a dark doorway in each corner (x 0-1, 14-15), the white folding
//                 screen of six leaves in violet frames before the alcove's middle (x 6-9.2), its foot washed in gold
//   the dais      x 4-11, z 2-7, of slate-violet stone in a border of gold and violet, a gilt table before the screen (7, 3)
//   the floor     jade-green tiles with a key fret in relief; a slate carpet edged in gold from the dais to the door (x 6-9);
//                 dark bands inlaid across at z 8-11, as drawn
//   columns       violet lacquer with green bands and pale caps: at the corners of the alcove (3.5, 2.5) and (11.5, 2.5),
//                 the back corners (0.5, 3.4) and (14.5, 3.4), and down both sides (x 0.5 and 14.5, at 8.4 and 13.4)
//   cauldrons     six bronze ding, golden as drawn: (4, 6), (10, 6), (3, 8), (11, 8), (3, 12) and (11, 12)
const HW = 16, HH = 15, HC = { lacquer: 0x6a3c8a, lacquerDark: 0x2a1030 };
let hallBuilt = false, hallChests = new Map();
function hallMats() {
  const M = mats({ lacquer: 0xa01a14, lacquerDark: 0x3a0a08, silk: 0xf0a820 });
  const violet = T.material(T.lacquer(HC.lacquer, 'jmViolet'), { clearcoat: 0.6, clearcoatRoughness: 0.25 });
  return {
    M, violet,
    jadeBand: T.material(T.lacquer(0x2a8a4a, 'jmJadeBand'), { clearcoat: 0.6 }),
    cap: T.material(T.marble(0xd8d0c0), {}, [0.5, 0.5]),
    floor: T.material(fretFloor(), {}, [1, 1]),
    slate: T.material(T.flags(0x6e6c96, 0x5e5c86, 'jmSlate2', 3, 0.22, 0x34324a), {}, [0.5, 0.5]),
    inlay: new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4, metalness: 0.2 }),
    frame: T.material(T.lacquer(0x7a4aa0, 'jmFrame'), { clearcoat: 0.6 }),
    paper: T.material(screenTex(), { color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
    stone: T.material(T.rock(0xb8b0a0, 'jmHallStone', 0.25), { color: 0xeeeae0 }, [0.5, 0.5]),
    dark: new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1 }),
  };
}
// the floor: jade-green tiles a cell each, a key fret raised in each (the original's pattern), darker in the grooves;
// lighter than the art so the dark move squares read on it
function fretFloor() {
  return T.pbr('jmFret', 512, (u, v, o) => {
    const N = 2, x = (u * N) % 1, y = (v * N) % 1, e = Math.min(x, 1 - x, y, 1 - y), n = T.fbm(u, v, 12, 3, 51);
    const gx = Math.floor(x * 8), gy = Math.floor(y * 8), fx = x * 8 - gx, fy = y * 8 - gy;
    // the fret: a meander of raised strips on an 8x8 grid
    const P = ['########', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######', '#.......'];
    const on = P[gy] && P[gy][gx] === '#' && fx > 0.18 && fx < 0.82 && fy > 0.18 && fy < 0.82 || (P[gy] && P[gy][gx] === '#' && ((gx < 7 && P[gy][gx + 1] === '#' && fx >= 0.5) || (gx > 0 && P[gy][gx - 1] === '#' && fx <= 0.5) || (gy < 7 && P[gy + 1] && P[gy + 1][gx] === '#' && fy >= 0.5) || (gy > 0 && P[gy - 1][gx] === '#' && fy <= 0.5)) && fx > 0.18 && fx < 0.82 || false);
    const joint = 1 - T.smooth(0.006, 0.03, e);
    o.c = T.mixc([0.2, 0.36, 0.22], [0.26, 0.44, 0.27], n);
    if (on) o.c = T.mixc(o.c, [0.34, 0.52, 0.32], 0.6);
    o.c = T.mixc(o.c, [0.08, 0.16, 0.08], joint * 0.8);
    o.h = 0.5 + (on ? 0.12 : 0) - joint * 0.3 + (n - 0.5) * 0.04; o.r = 0.45;
  }, 4);
}
// the screen's leaves: white silk, a wash of gold clouds rising from the foot
function screenTex() {
  return T.pbr('jmScreen2', 256, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 61), cloud = T.smooth(0.18, 0.32, v * 0.9 + (n - 0.5) * 0.25 + Math.sin(u * 12) * 0.03);   // (v 0 at the foot)
    o.c = T.mixc([0.96, 0.95, 0.93], [0.95, 0.72, 0.22], (1 - cloud) * T.smooth(0.0, 0.25, v + 0.05));
    o.h = 0.5; o.r = 0.85;
  }, 2);
}
function hallColumn(m, x, z, h) {   // violet lacquer on a pale base, green bands at foot and head, a pale cap
  const g = new THREE.Group(), r = 0.36;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.18, 24), m.cap); base.position.y = 0.09; g.add(base);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h - 0.3, 32), m.violet); sh.position.y = 0.18 + (h - 0.3) / 2; g.add(sh);
  for (const [y0, w] of [[0.28, 0.12], [0.46, 0.04], [h - 0.5, 0.04], [h - 0.36, 0.14]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, w, 32), m.jadeBand); b.position.y = y0; g.add(b); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.05, 0.14, 24), m.cap); cap.position.y = h - 0.05; g.add(cap);
  g.position.set(x, 0, z); return shade(g);
}
async function buildHall(E, FX) {
  const S = E.world.scene, m = hallMats(), { M } = m; hallChests = new Map();
  // the floor, out past the map to the south and both sides
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(HW + 4, HH + 10).rotateX(-Math.PI / 2), m.floor);
  fl.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? (HH + 10) / 2 : (HW + 4) / 2); });
  fl.position.set(HW / 2, 0, (HH + 10) / 2 - 0.5); fl.receiveShadow = true; S.add(fl);
  // the dais and the carpet: slate, a little proud of the floor, edged in gold and violet
  const lay = [], gold = [], vio = [];
  lay.push(box(m.slate, 4, 0, 2, 11, 0.025, 7, 1), box(m.slate, 6, 0, 7, 9, 0.025, HH + 6, 1));
  for (const [x0, z0, x1, z1] of [[4, 2, 4.12, 7], [10.88, 2, 11, 7], [6, 7, 6.12, HH + 6], [8.88, 7, 9, HH + 6]]) { gold.push(box(M.gold, x0, 0.025, z0, x1, 0.035, z1, 1)); vio.push(box(m.frame, x0 + (x0 < 7 ? 0.12 : -0.08), 0.025, z0, x1 + (x0 < 7 ? 0.08 : -0.12), 0.03, z1, 1)); }
  gold.push(box(M.gold, 4, 0.025, 6.9, 6.1, 0.035, 7.0, 1), box(M.gold, 8.9, 0.025, 6.9, 11, 0.035, 7.0, 1));
  for (const [x0, z0, x1, z1] of [[5, 2.1, 9.75, 2.16], [5, 5.84, 9.75, 5.9], [5, 2.1, 5.06, 5.9], [9.69, 2.1, 9.75, 5.9]]) gold.push(box(M.gold, x0, 0.025, z0, x1, 0.033, z1, 1));
  for (const [x0, z0, x1, z1] of [[5.25, 2.1, 9.5, 2.14], [5.25, 5.6, 9.5, 5.64], [5.25, 2.1, 5.29, 5.64], [9.46, 2.1, 9.5, 5.64]]) gold.push(box(M.gold, x0, 0.025, z0, x1, 0.033, z1, 1));
  // the dark bands inlaid across the hall (z 8-11), gilt bars where they cross the carpet
  const band = (x0, z0, x1, z1) => lay.push(box(m.inlay, x0, 0.004, z0, x1, 0.012, z1, 1));
  band(1, 7.95, 2.1, 8.1); band(2, 8.0, 2.1, 9.25); band(2, 9.15, 6, 9.25); band(13.9, 7.95, 15, 8.1); band(13.9, 8.0, 14, 9.25); band(9, 9.15, 14, 9.25);
  band(0, 8.45, 1.55, 8.55); band(1.5, 8.5, 1.6, 9.75); band(1.5, 9.65, 6, 9.75); band(14.45, 8.45, 16, 8.55); band(14.4, 8.5, 14.5, 9.75); band(9, 9.65, 14.5, 9.75);
  band(0, 10.2, 6, 10.3); band(9, 10.2, 16, 10.3); band(0, 10.7, 6, 10.8); band(9, 10.7, 16, 10.8);
  for (const z of [9.2, 9.7, 10.25, 10.75]) gold.push(box(M.gold, 6.12, 0.025, z - 0.04, 8.88, 0.04, z + 0.04, 1));
  S.add(shade(merged(m.slate, lay.filter(b => b.material === m.slate)), false), shade(merged(m.inlay, lay.filter(b => b.material === m.inlay)), false), shade(merged(M.gold, gold), false), shade(merged(m.frame, vio), false));
  // the back: the alcove's wall (z 2) and the outer bays (z 3), red lattice, gold curtains tied back; dark doorways in the corners
  const LM = Object.assign({}, M, { lacquer: M.lacquer, beam: M.lacquerDark });
  S.add(shade(latticeWallJm(LM, 1, 3, 3), true), shade(latticeWallJm(LM, 12, 14, 3), true), shade(latticeWallJm(LM, 4, 6, 2), true), shade(latticeWallJm(LM, 9, 11, 2), true));
  S.add(shade(box(M.lacquerDark, 6, 0, 1.3, 9.2, 2.9, 1.42)));   // behind the screen
  for (const x of [0, 14]) { S.add(shade(box(m.stone, x - 0.05, 0, 2.86, x + 1.05, 2.9, 3.0, 0.5))); S.add(box(m.dark, x + 0.12, 0.6, 2.98, x + 0.88, 2.5, 3.01)); }   // the corner doorways' frames, dark beyond
  for (const [x0, x1, tie] of [[1.0, 1.75, 'l'], [4.0, 4.8, 'l'], [5.25, 6.0, 'r'], [9.0, 9.7, 'l'], [10.2, 10.95, 'r'], [12.6, 13.5, 'r']]) S.add(curtain(M, x0, x1, (x0 < 4 || x0 > 12) ? 3.04 : 2.06, 2.8, 2.6, tie, 6));
  // the screen: six leaves in violet frames before the alcove
  S.add(shade(screen(Object.assign({}, M, { wood: m.frame }), 6.0, 9.2, 2.35, 0, 2.6, 6, m.paper)));
  // the gilt table before it
  const tb = new THREE.Group();
  tb.add(box(M.gold, -0.44, 0, -0.3, 0.44, 0.08, 0.3, 1), box(M.gold, -0.48, 0.44, -0.34, 0.48, 0.52, 0.34, 1), box(M.lacquer, -0.38, 0.08, -0.26, 0.38, 0.44, 0.26, 1));
  for (const sx of [-1, 1]) tb.add(box(M.gold, sx * 0.42 - 0.05, 0.08, -0.3, sx * 0.42 + 0.05, 0.44, 0.3, 1));
  tb.add(box(M.gold, -0.3, 0.16, 0.26, 0.3, 0.38, 0.28, 1));                                        // the gilt panel on its front
  tb.add(box(M.lacquerDark, -0.16, 0.52, -0.14, 0.16, 0.68, 0.14, 1), box(M.lacquer, -0.18, 0.68, -0.16, 0.18, 0.74, 0.16, 1));   // the seal box on it
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.gold); knob.position.y = 0.78; tb.add(knob);
  tb.position.set(7.5, 0, 3.75); S.add(shade(tb));
  // columns, cauldrons
  for (const [x, z, h] of [[3.5, 2.55, 3.0], [11.5, 2.55, 3.0], [0.5, 3.45, 3.0], [14.5, 3.45, 3.0], [0.5, 8.45, 3.0], [14.5, 8.45, 3.0], [0.5, 13.45, 3.0], [14.5, 13.45, 3.0]]) S.add(hallColumn(m, x, z, h));
  const hollow = new THREE.MeshStandardMaterial({ color: 0x1a0e06, roughness: 0.9 });   // (empty, as the original's: no coals)
  const DM = Object.assign({}, M, { bronze: new THREE.MeshStandardMaterial({ color: 0xc08a30, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.2 }) });   // burnished golden bronze, as drawn
  for (const [x, z] of [[4, 6], [10, 6], [3, 8], [11, 8], [3, 12], [11, 12]]) { const d = ding(DM, x + 0.5, z + 0.55, 0, 1.3).g; d.traverse(o => { if (o.isMesh && o.geometry.type === 'CircleGeometry') o.material = hollow; }); S.add(d); }   // (the kit's coal disc: hollow)
  // the hall's sides, past the map: lattice walls running south
  S.add(shade(latticeWallSide(LM, -0.6, 3, HH + 6)), shade(latticeWallSide(LM, HW + 0.6, 3, HH + 6)));
  hallBuilt = true; void FX;
}
// a red lattice bay set along x at z (the kit's, without the paper's glow: the original's bays are carved panels)
function latticeWallJm(M, x0, x1, z) { return latticeWall(M, x0, x1, z, 0, 2.9, Math.round(x1 - x0)); }
function latticeWallSide(M, x, z0, z1) { const g = latticeWall(M, z0, z1, 0, 0, 2.9, Math.round((z1 - z0) / 1.5)); g.rotation.y = x < 1 ? Math.PI / 2 : -Math.PI / 2; g.position.set(x, 0, x < 1 ? z1 : z0); return g; }
export const jiamengHall = {
  build: buildHall, ground: (x, z) => z < 2 || (z < 3 && (x < 4 || x >= 11)) ? 2.9 : 0, particles: 'dust',   // (the back wall's cells: raised)
  props: [[4, 6], [10, 6], [3, 8], [11, 8], [3, 12], [11, 12], [7, 3], [0, 3], [14, 3], [0, 6], [0, 7], [0, 8], [14, 8], [0, 11], [0, 12], [0, 13], [14, 6], [14, 7], [14, 11], [14, 12], [14, 13], [6, 2], [7, 2], [8, 2]],
  mood: { bg: 0x0a0806, voidCol: 0x0a0806, fog: 0x1a120c, fogD: 0.02, sky: 0xffe8c8, under: 0x3a2a1a, hemi: 0.75,
    sun: 0xffe6c4, sunI: 1.9, sunDir: [-0.3, 0.9, 0.35], sat: 1.04, exposure: 1.08, bloom: 0.3, aoR: 0.8,
    env: { top: 0x8a6a50, mid: 0x5a3a28, low: 0x1a100a, lights: [[0, 6, -6, 0xfff0d8, 4], [-6, 4, 6, 0xffc890, 2]] } },
};
