// 龍安城地牢 (maps 0e9b48 / 0e9b8c: scene 3 and battle 3), remade: the city gaol, purple-grey stone in the dark. Two
// cells (林雲's at columns 1-3, 伯邑考's and later 燕蓉's at 5-7) with straw to sleep on, split by a riveted iron post
// and shut by barred gates in a thick front wall; the corridor before them; a barred store room (its chest out of
// reach behind the bars); a small room down the stairs at the lower left; the guard hall on the right, and the stairs
// up out of the gaol at (10, 2). Torches on the walls, everything else black.
// Measured on the original (tools/qa/grid.py 0e9b48): each cell's kind below. Walls south of anyone who can stand
// there are kept low (the camera looks from the south: a cell's front wall must not hide the prisoner behind it), and
// iron bars give them their height; the black of the original is solid rock between the rooms, built low.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { grass } from '../kit/terrain.js';

const MW = 16, MH = 15;
// f floor; g a cell's gateway (floor; the gate swings in it); s the stairs' landing (floor); p the iron post between
// the cells; w a tall wall (north of everyone); l a low wall; b a low wall carrying iron bars; B a tall barred front
// (the store room's, north of the hall); v void
const MAP = [
  'vwwwwwwwwvwfffff',   //  0  the cells' back wall (its face at z 2), the stairwell's wall at 10
  'vwwwwwwwwvwfffff',   //  1
  'vfffpfffvvsfffff',   //  2  the cells, the post at 4; the stairs' landing (10, 2)
  'vfffpfffvvvvvfff',   //  3
  'vfffpfffvvvvvfff',   //  4
  'vlglpgbbvvvvvfff',   //  5  the cells' front: 林雲's gate at 2, 伯邑考's at 5, bars at 6-7
  'vlgllgbbvvvvvfff',   //  6
  'vfffffffwvwwwfff',   //  7  the corridor; the store room's back wall
  'vffffffffvffffff',   //  8  the store room (10-11, 8-9), its chest at (11, 8); its east wall open at 12 [design: battle 3's rules]
  'vffffffffvffvfff',   //  9
  'vvvlflvffwBBwfff',   // 10  the way down to the lower room (4), its posts; the store room's barred front
  'vvvlflvffwBBwfff',   // 11
  'vvvfffvfffffffff',   // 12  the lower room (3-5), the passage and the hall's foot
  'vvvfffvfffffffff',   // 13  its chest at (5, 13)
  'vvvvvvvvvvvvvvvv',   // 14  (the map's spare row)
];
const kind = (x, y) => (MAP[y] && MAP[y][x]) || 'v';
const SILL = 0.1, WALL_H = 2.4, LOW_H = 0.55, BARS_H = 1.35, POST_H = 1.35, PIT = -1.4, FILL_H = 0.5, OUT = 7;   // FILL: the solid rock between the rooms (the original's black), low so it hides no one; OUT: how far it runs past the map
const CHESTS = [[10, 8], [5, 13]];   // drawn in the art ((11, 8) there: moved a cell west, battle 3's hook module); (6, 2) and (15, 0) are hidden
const GATES = { 2: null, 5: null };   // x -> the gate's group (林雲's at 2, 伯邑考's at 5), rows 5-6, hinged on the west
let M = null, world = null, chestG = new Map();

// height of the floor or wall top in each cell: the walls' for the checks (an actor never stands on them)
function height(x, z) {
  const k = kind(Math.floor(x), Math.floor(z));
  return k === 'v' ? FILL_H : k === 'w' || k === 'B' ? WALL_H : k === 'l' ? LOW_H : k === 'b' ? LOW_H : k === 'p' ? POST_H : k === 'g' && z > 5.1 && z < 6.95 ? SILL : 0;   // a gateway: on the sill (move tiles and shadows drawn at 0 flickered under it)
}

// a row of iron bars from x0 to x1 on the line z, from y0 up h; bands near the top and the foot
function bars(iron, x0, x1, z, y0, h, step = 0.13) {
  const parts = [];
  for (let x = x0 + step / 2; x < x1; x += step) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, h, 6), iron); c.position.set(x, y0 + h / 2, z); parts.push(c); }
  for (const yy of [y0 + 0.12, y0 + h - 0.1]) parts.push(box(iron, x0, yy - 0.03, z - 0.035, x1, yy + 0.03, z + 0.035));
  return merged(iron, parts);
}
// a barred gate, 1 wide, hinged at its west post; open: swung in (north) by its userData
function gate(iron, x, z, y0, h) {
  const g = new THREE.Group(), leaf = new THREE.Group(); leaf.add(bars(iron, 0.04, 0.96, 0, y0, h, 0.12));
  const lock = box(iron, 0.78, y0 + h * 0.45, -0.06, 0.9, y0 + h * 0.6, 0.06); leaf.add(lock);   // the lock
  g.add(leaf); g.position.set(x, 0, z); g.userData.leaf = leaf; g.userData.lock = lock; return shade(g);
}
// straw spread to sleep on: a low mound, blades sticking out of it
function straw(x0, z0, x1, z1) {
  const g = new THREE.Group(), mat = T.material(T.weave(0xc8a040, 10), { color: 0xd8b860 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.scale.set((x1 - x0) * 0.95, 0.32, (z1 - z0) * 0.95); m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.add(shade(m));
  const pts = []; for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.48;
    const px = (x0 + x1) / 2 + Math.cos(a) * r * (x1 - x0), pz = (z0 + z1) / 2 + Math.sin(a) * r * (z1 - z0); pts.push([px, 0.14 * (1 - r * r * 3.5) + 0.02, pz]); }
  g.add(grass(pts, { size: 0.3, cols: ['#e0c060', '#c8a040', '#f0d880', '#b08a30'] }));
  return g;
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const stone = T.material(T.bricks(0x6a6274, 4, 'gaolWall'), { color: 0xd8d0e0 }, [0.6, 0.6]);
  const cap = T.material(T.rock(0x3a3242, 'gaolCap', 0.3), {}, [0.5, 0.5]);
  const floor = T.material(T.dirt(0x8a7480, 'gaolFloor'), { color: 0xe8d8e4 }, [0.5, 0.5]);
  const iron = new THREE.MeshStandardMaterial({ color: 0x9a9684, metalness: 0.7, roughness: 0.38 });   // the bars, pale as the original's
  const frame = T.material(T.rock(0xaaa694, 'gaolFrame', 0.2), { color: 0xe0dccc }, [0.5, 0.5]);       // their posts, sills and lintels
  const dark = new THREE.MeshStandardMaterial({ color: 0x050407, roughness: 1 });
  // the floor: a slab under every cell that is not void (walls stand on it), its edges dropping into the dark
  const slabs = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) !== 'v') slabs.push(box(floor, x, PIT, y, x + 1, 0, y + 1, 0.5));
  S.add(shade(merged(floor, slabs), false));
  // the rock between and around the rooms (the original's black): solid masonry, low, its top rough and dim, out past
  // the map's edges so the wider view never looks into nothing
  const fill = T.material(T.rock(0x3e3646, 'gaolFill', 0.35), { color: 0x9a90ac }, [0.5, 0.5]), fills = [];
  for (let y = -OUT; y < MH + OUT; y++) for (let x = -OUT; x < MW + OUT; x++) {
    const inside = x >= 0 && y >= 0 && x < MW && y < MH;
    if (inside ? kind(x, y) === 'v' : true) fills.push(box(fill, x, PIT, y, x + 1, FILL_H + (inside ? 0 : Math.min(0.6, (Math.max(-x, x - MW + 1, -y, 0) * 0.15))), y + 1, 0.5));
  }
  S.add(shade(merged(fill, fills)));
  // the walls, cell by cell, merged: tall (behind everyone) and low (a cutaway in front of someone)
  const walls = [], caps = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = kind(x, y); let z0 = y, z1 = y + 1;
    if (k === 'w' && y === 0 && kind(x, 1) === 'w') z0 = 0.45;          // the back wall's top edge, as drawn
    if (k === 'w' || k === 'B') { if (k === 'w') walls.push(box(stone, x, 0, z0, x + 1, WALL_H, z1, 0.6)); caps.push(box(cap, x, k === 'w' ? WALL_H : WALL_H - 0.05, z0, x + 1, (k === 'w' ? WALL_H : WALL_H - 0.05) + 0.06, z1, 0.5)); }
    if ((k === 'l' || k === 'b') && y !== 5 && y !== 6) walls.push(box(stone, x, 0, z0 + 0.05, x + 1, LOW_H, z1 - 0.05, 1.2));   // finer courses on the low walls (the cells' front is built below)
  }
  S.add(shade(merged(stone, walls)), shade(merged(cap, caps)));
  // the cells' front (rows 5-6), as the original draws it: barred fronts between pale stone posts under a lintel, on a
  // sill; 林雲's gate at x 2, 伯邑考's at 5 (barred leaves); solid stone only under the post (x 3.6-5), kept below head
  // height (the prisoner at (3, 4) stands just behind its west end)
  const FZ = 6.78, TOP = 1.5;
  for (const [x0, x1] of [[1.12, 3.62], [5.0, 7.98]]) {
    S.add(shade(box(frame, x0, 0, 5.1, x1, SILL, 6.95, 0.5)), shade(box(frame, x0 - 0.05, TOP, FZ - 0.17, x1 + 0.05, TOP + 0.16, FZ + 0.17, 0.5)));
    S.add(shade(box(frame, x0 - 0.05, TOP + 0.16, FZ - 0.1, x1 + 0.05, TOP + 0.22, FZ + 0.1, 0.5)));
  }
  S.add(shade(merged(frame, [1.12, 3.47, 5.0, 7.83].map(px => box(frame, px, 0, FZ - 0.14, px + 0.15, TOP, FZ + 0.14, 0.5)))));
  S.add(shade(bars(iron, 1.27, 2.0, FZ, 0.1, TOP - 0.1)), shade(bars(iron, 3.0, 3.47, FZ, 0.1, TOP - 0.1)), shade(bars(iron, 6.0, 7.83, FZ, 0.1, TOP - 0.1)));
  S.add(shade(box(stone, 3.62, 0, 5.05, 5.0, 1.0, 6.95, 1.2)), shade(box(frame, 3.6, 1.0, 5.05, 5.02, 1.06, 6.97, 0.5)));
  for (const gx of [2, 5]) { GATES[gx] = gate(iron, gx, FZ, 0.1, TOP - 0.1); S.add(GATES[gx]); }
  // the iron post between the cells, riveted, from the back wall to the front wall
  const post = new THREE.Group(); post.add(box(frame, 4.36, 0, 2.0, 4.64, POST_H, 5.05, 0.5));
  for (let z = 2.2; z < 5; z += 0.32) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), iron); r.position.set(4.5, POST_H + 0.01, z); post.add(r); }
  S.add(shade(post));
  // straw in each cell
  S.add(straw(2.1, 3.05, 3.9, 4.6), straw(6.1, 3.05, 7.9, 4.6));
  // the store room's barred front (rows 10-11), tall: nothing reachable lies north of it
  S.add(shade(box(stone, 9.62, 0, 10.05, 10.0, WALL_H, 11.95, 0.6)), shade(box(stone, 12.0, 0, 10.05, 12.62, WALL_H, 11.95, 0.6)));
  S.add(shade(bars(iron, 10.0, 12.0, 11.88, 0, WALL_H - 0.35, 0.12)), shade(box(frame, 9.62, WALL_H - 0.4, 11.6, 12.62, WALL_H, 11.95, 0.5)));
  S.add(shade(box(iron, 10.85, 0.9, 11.8, 11.15, 1.15, 11.98)));   // its padlock
  // the lower room's posts either side of the way down (rows 10-11)
  S.add(shade(merged(frame, [3.62, 5.3].map(px => box(frame, px - 0.18, 0, 11.4, px + 0.18, BARS_H + 0.15, 11.85, 0.5)))));
  // the stairs up out of the gaol: two low steps at the landing's back, then a flight up into an arch in the wall
  const steps = [];
  for (let k = 0; k < 2; k++) steps.push(box(stone, 10.12, 0, 2.0, 10.88, 0.08 * (k + 1), 2.38 - k * 0.18, 0.5));
  for (let k = 0; k < 6; k++) steps.push(box(stone, 10.12, 0, 1.0, 10.88, 0.16 + 0.14 * (k + 1), 2.0 - k * 0.16, 0.5));
  S.add(shade(merged(stone, steps)));
  S.add(box(dark, 10.12, 0.9, 0.46, 10.88, 2.0, 0.6));   // the dark beyond the arch
  // chests: drawn ones; the hidden ones show up when struck (openChest)
  for (const [x, y] of CHESTS) { const g = chest(M, x + 0.5, y + 0.5, 0, false, 0, 1.4); S.add(g); chestG.set(x + ',' + y, g); }
  // torches on the walls, warm in the cold
  for (const [x, z, h] of [[1.3, 2.12, 1.65], [7.7, 2.12, 1.65], [8.55, 8.1, 1.5], [9.85, 12.1, 1.6], [12.4, 12.1, 1.6], [13.5, 0.1, 1.6], [11.4, 2.12, 1.6]]) {
    S.add(shade(box(iron, x - 0.05, h - 0.35, z - 0.12, x + 0.05, h - 0.05, z)));
    FX.fire(E, { x, y: z + 0.08, z: h, size: 0.5, light: 8, col: 0xff8a3a, smoke: false });
  }
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y);
  if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
// a chest the map does not draw ((6, 2) in 燕蓉's cell, (15, 0) in the hall's corner): struck, it shows up open
function found(x, y) {
  if (!world) return;
  const g = chest(M, x + 0.5, y + 0.5, 0, true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}
// a blow at (x, z) (scene 3, f2492: 燕蓉 smashes the lock on 林雲's gate, op 28): the lock breaks off in sparks, spins
// away and drops to the floor; the gate then swings open with the cell edit. quiet (a seek past it): just gone
function strike(E, x, z, quiet) {
  const gx = Object.keys(GATES).map(Number).find(k => GATES[k] && Math.abs(x - (k + 0.5)) < 1 && Math.abs(z - GATES[k].position.z) < 1.3), g = gx != null && GATES[gx];
  const lock = g && g.userData.lock; if (!lock || !lock.parent) return;
  const P = new THREE.Vector3(); lock.updateWorldMatrix(true, false); lock.getWorldPosition(P);
  lock.parent.remove(lock); if (quiet) return;
  const piece = lock.clone(); piece.geometry = lock.geometry.clone(); piece.geometry.center(); piece.position.copy(P); world.scene.add(piece);
  const v = new THREE.Vector3(0.9, 1.6, 1.4), spin = new THREE.Vector3(9, 6, 4), floor = height(P.x + 0.5, P.z + 0.7) + 0.05;
  const step = dt => {
    v.y -= 9.8 * dt; piece.position.addScaledVector(v, dt); piece.rotation.x += spin.x * dt; piece.rotation.y += spin.y * dt; piece.rotation.z += spin.z * dt;
    if (piece.position.y <= floor) { piece.position.y = floor; v.multiplyScalar(0.35); v.y = Math.abs(v.y) * 0.4; spin.multiplyScalar(0.4); if (Math.abs(v.y) < 0.2) { v.set(0, 0, 0); spin.set(0, 0, 0); world.updaters.splice(world.updaters.indexOf(step), 1); } }
  };
  world.updaters.push(step);
  E.vfx.burst(P, { n: 40, speed: 3.5, cols: [[1, 0.95, 0.7], [1, 0.75, 0.35], [1, 1, 1]], size: 0.035, life: 0.6, g: 8 });
  E.vfx.ring(P, [1, 0.9, 0.6], 0.9, 0.25, { vertical: true, y: P.y, intensity: 1.4 });
  E.vfx.light(P, [1, 0.85, 0.55], 6, 0.25, 4); E.vfx.shake(0.06, 0.15);
}
// the scene's cell edits: a cell's gate (rows 5-6 at x 2 or 5) shut (blocks 33 / 38) or open (21); it swings
function cell(E, x, y, block) {
  const g = GATES[x]; if (!g || (y !== 5 && y !== 6)) return;
  const open = block === 21, leaf = g.userData.leaf, to = open ? 1.35 : 0;   // in, towards the cell (north)
  if (Math.abs(leaf.rotation.y - to) < 0.01) return;
  const from = leaf.rotation.y; let k = 0;
  const step = dt => { k = Math.min(1, k + dt / 0.35); leaf.rotation.y = from + (to - from) * (1 - (1 - k) * (1 - k)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(step), 1); };
  world.updaters.push(step);
}

export default {
  build, cell, strike, openChest, ground: (x, z) => height(x, z), particles: 'dust',
  viewShift: 1.5,   // the guards speak from the corridor at the foot of the original's screen: framed above the dialogue box (as gorge.js)
  props: [[10, 8], [11, 8], [10, 9], [11, 9]],   // the store room: floor behind locked bars, out of everyone's reach (tools/qa/sets.js)
  open: x => { const g = GATES[x]; if (g) { g.userData.leaf.rotation.y = 1.35; if (x === 2 && g.userData.lock.parent) g.userData.lock.parent.remove(g.userData.lock); } },   // battle 3: both gates stand open (林雲's lock smashed in scene 3)
  mood: { bg: 0x050407, voidCol: 0x050407, voidY: -1.6, fog: 0x08070c, fogD: 0.012, sky: 0x9aa4d0, under: 0x2a2028, hemi: 1.05,
    sun: 0xb0b8e0, sunI: 1.9, sunDir: [-0.35, 0.9, 0.45], sat: 0.98, exposure: 1.3, bloom: 0.45, aoR: 0.7,
    env: { top: 0x4a4860, mid: 0x3a3240, low: 0x100c12, lights: [[0, 5, -6, 0xffa060, 3], [-6, 3, 4, 0xff9050, 2]] } },
};
