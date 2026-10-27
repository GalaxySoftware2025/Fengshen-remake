// 崇城地下牢 (battle 20 and scene 41: maps 0f5b14, the battle's room 1, and 0f5b58), remade: 崇侯虎's gaol under 崇城, the
// original's purple stone in the dark (as 龍安城's gaol, src/remake/dungeon.js: the same kind of place, its pieces).
// The two lower floors are built cell by cell from a plan measured on the original (tools/qa/grid.py 0f5b14,
// assets/battles/20/room-1.png) and the battle's terrain: floor where anyone may stand; the original's black is solid
// rock between the rooms, built low so it hides no one; brick walls tall where nothing stands north of them, low where
// someone does (the camera looks from the south); the cells' barred fronts on a pale stone sill between posts under a
// lintel; the gaol's gilt totem pillars (two cells tall in the art) on their plinths; straw to sleep on; the stairs up
// out of the gaol. Room 2 (0f5b58) is 崇侯虎's stair hall: a court of gilt totems at its foot, a grand stair between brick
// terraces up to the dais where 黃飛虎 is chained, jade-pale balustrades along its edges.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { grass } from '../kit/terrain.js';
import { D } from '../rules.js';

const WALL_H = 2.4, LOW_H = 0.55, FILL_H = 0.5, PIT = -1.4, OUT = 7, SILL = 0.42, BARS_H = 1.5, POST_H = 1.75, TOTEM_H = 1.85;

// ---------------------------------------------------------------- materials and pieces
let MAT = null;
function materials() {
  if (MAT) return MAT;
  MAT = {
    M: mats(),
    stone: T.material(T.bricks(0x6e5e92, 4, 'chongGaolWall'), { color: 0xffffff }, [0.6, 0.6]),   // the original's violet brick
    cap: T.material(T.flags(0x8a809c, 0x766c88, 'chongGaolCoping', 2, 0, 0x2a2434), {}, [1, 1]),          // dressed coping stones on the walls
    top: T.material(T.bricks(0x5a4e6e, 4, 'chongGaolTop'), { color: 0xd8d0e8 }, [1, 1]),                  // the brick courses on the masses' tops
    floor: T.material(T.flags(0xb8a0b0, 0xa08ca0, 'chongGaolFlags', 4, 0, 0x4a3a48), {}, [0.5, 0.5]),   // the original's mauve grit, laid as large worn flags, light enough for dark squares
    fill: T.material(T.rock(0x2a2432, 'chongGaolFill3', 0.35), { color: 0x7a7090 }, [0.5, 0.5]),   // (near the original's black: the move squares read over it)
    iron: new THREE.MeshStandardMaterial({ color: 0x9a9684, metalness: 0.7, roughness: 0.38 }),   // the bars, pale as the original's
    frame: T.material(T.rock(0xaaa694, 'gaolFrame', 0.2), { color: 0xe0dccc }, [0.5, 0.5]),     // posts, sills, lintels
    totem: T.material(totemTex(), { envMapIntensity: 1.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050407, roughness: 1 }),
  };
  return MAT;
}
// the totems' gilt relief: a stern mask above coiled scrolls between beaded bands, worn bright on the high points
function totemTex() {
  return T.pbr('chongTotem', 512, (u, v, o) => {
    const B = [0.85, 0.66, 0.24], n = T.fbm(u, v, 7, 4, 31);
    let h = 0.45;
    const band = y => Math.max(0, 1 - Math.abs(v - y) / 0.025);
    h += 0.35 * Math.max(band(0.08), band(0.92), band(0.55));                                  // the bands
    if (Math.abs(v - 0.08) < 0.03 || Math.abs(v - 0.92) < 0.03) h += 0.15 * (Math.sin(u * Math.PI * 24) > 0.3 ? 1 : 0);   // beads
    if (v > 0.14 && v < 0.5) {                                                                   // the mask: brow, eyes, nose, mouth
      const x = Math.abs(u - 0.5), y = (v - 0.14) / 0.36;
      if (y < 0.18 && x < 0.38) h += 0.25 * (1 - y / 0.18) * (x < 0.36 ? 1 : 0);
      if (Math.hypot((x - 0.18) / 0.11, (y - 0.33) / 0.09) < 1) h += 0.3;
      if (Math.hypot((x - 0.18) / 0.05, (y - 0.33) / 0.05) < 1) h -= 0.25;
      if (x < 0.05 && y > 0.3 && y < 0.7) h += 0.25;
      if (Math.abs(y - 0.82) < 0.05 && x < 0.22) h -= 0.2;
      if (x > 0.36 && x < 0.44 && y > 0.2 && y < 0.8) h += 0.2;                                 // the face's frame
    }
    if (v > 0.6 && v < 0.88) {                                                                   // two coiled scrolls
      for (const cx of [0.3, 0.7]) { const dx = u - cx, dy = v - 0.74, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (r < 0.17) h += 0.22 * (Math.sin(r * 90 - a * 2) > 0.2 ? 1 : 0) * (1 - r / 0.17); }
    }
    const hi = T.clamp((h - 0.45) * 2.2);
    o.c = T.mixc([B[0] * 0.7, B[1] * 0.58, B[2] * 0.36], [B[0] * 1.15, B[1] * 1.12, B[2] * 0.95], T.clamp(0.35 + hi * 0.65 + (n - 0.5) * 0.3));
    o.m = 0.55; o.r = 0.45 - hi * 0.2 + n * 0.12; o.h = h;   // (gilt over the carving: part diffuse, so the dark gaol does not turn it bronze)
  }, 4);
}
// a gilt totem pillar standing on a stone plinth over the cells (x0, z0)-(x1, z1), a domed top
function totem(x0, z0, x1, z1, y = 0) {
  const { frame, totem: gold } = materials(), g = new THREE.Group(), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.min(x1 - x0, 1) * 0.78;
  g.add(box(frame, x0 + 0.06, y, z0 + 0.06, x1 - 0.06, y + SILL, z1 - 0.06, 0.6));
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, TOTEM_H - SILL - 0.25, w * 0.85), gold);
  body.position.set(cx, y + SILL + (TOTEM_H - SILL - 0.25) / 2, cz + 0.05); g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.56, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.scale.set(1, 0.55, 0.85); dome.position.set(cx, y + TOTEM_H - 0.25, cz + 0.05); g.add(dome);
  for (const yy of [y + SILL + 0.04, y + TOTEM_H - 0.3]) g.add(box(gold, cx - w * 0.56, yy, cz + 0.05 - w * 0.48, cx + w * 0.56, yy + 0.08, cz + 0.05 + w * 0.48, 1));
  return shade(g);
}
// a pale stone post with a base and a capital, on a plinth (the cells' gate posts)
function post(x, z, y = 0) {
  const { frame } = materials(), g = new THREE.Group();
  g.add(box(frame, x + 0.12, y, z + 0.12, x + 0.88, y + SILL, z + 0.88, 0.6));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, POST_H - SILL - 0.3, 16), frame); shaft.position.set(x + 0.5, y + SILL + (POST_H - SILL - 0.3) / 2 + 0.1, z + 0.5); g.add(shaft);
  g.add(box(frame, x + 0.27, y + SILL, z + 0.27, x + 0.73, y + SILL + 0.1, z + 0.73, 0.5), box(frame, x + 0.25, y + POST_H - 0.22, z + 0.25, x + 0.75, y + POST_H, z + 0.75, 0.5));
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 16), frame); r.rotation.x = Math.PI / 2; r.position.set(x + 0.5, y + POST_H - 0.3 - k * 0.07, z + 0.5); g.add(r); }
  return shade(g);
}
// a barred front over the cells (x0, z0)-(x1, z1): a stone sill, posts at its ends, a lintel, iron bars along its south
// edge (the side the camera sees), banded near the top and the foot
function barred(x0, z0, x1, z1) {
  const { frame, iron } = materials(), g = new THREE.Group(), fz = z1 - 0.3;
  g.add(box(frame, x0 + 0.04, 0, z0 + 0.1, x1 - 0.04, SILL, z1 - 0.05, 0.5));
  for (const px of [x0 + 0.04, x1 - 0.2]) g.add(box(frame, px, SILL, fz - 0.12, px + 0.16, SILL + BARS_H, fz + 0.12, 0.5));
  g.add(box(frame, x0, SILL + BARS_H, fz - 0.16, x1, SILL + BARS_H + 0.14, fz + 0.16, 0.5), box(frame, x0 + 0.05, SILL + BARS_H + 0.14, fz - 0.1, x1 - 0.05, SILL + BARS_H + 0.2, fz + 0.1, 0.5));
  const bars = [];
  for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.12) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, BARS_H, 6), iron); c.position.set(x, SILL + BARS_H / 2, fz); bars.push(c); }
  for (const yy of [SILL + 0.14, SILL + BARS_H - 0.14]) bars.push(box(iron, x0 + 0.2, yy - 0.03, fz - 0.035, x1 - 0.2, yy + 0.03, fz + 0.035));
  g.add(merged(iron, bars));
  return shade(g);
}
// straw spread to sleep on: a low mound, blades sticking out of it
function straw(x0, z0, x1, z1, y = 0) {
  const g = new THREE.Group(), mat = T.material(T.weave(0xc8a040, 10), { color: 0xd8b860 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.scale.set((x1 - x0) * 0.95, 0.3, (z1 - z0) * 0.95); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); g.add(shade(m));
  const pts = []; for (let i = 0; i < 110; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.48;
    pts.push([(x0 + x1) / 2 + Math.cos(a) * r * (x1 - x0), y + 0.13 * (1 - r * r * 3.5) + 0.02, (z0 + z1) / 2 + Math.sin(a) * r * (z1 - z0)]); }
  g.add(grass(pts, { size: 0.28, cols: ['#e0c060', '#c8a040', '#f0d880', '#b08a30'] }));
  return g;
}
function torch(S, FX, E, x, z, h) {
  S.add(shade(box(materials().iron, x - 0.05, h - 0.35, z - 0.12, x + 0.05, h - 0.05, z)));
  FX.fire(E, { x, y: z + 0.08, z: h, size: 0.5, light: 7, col: 0xff8a3a, smoke: false });
}
// maximal rectangles of one kind of cell (runs along x, then grown down while the run repeats)
function rects(kind, W, H, k) {
  const used = new Set(), out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (kind(x, y) !== k || used.has(x + ',' + y)) continue;
    let x1 = x; while (kind(x1 + 1, y) === k && !used.has((x1 + 1) + ',' + y)) x1++;
    let y1 = y; const row = yy => { for (let i = x; i <= x1; i++) if (kind(i, yy) !== k || used.has(i + ',' + yy)) return false; return true; };
    while (y1 + 1 < H && row(y1 + 1) && (k !== 'G' || y1 - y < 1)) y1++;   // (a totem is two cells tall at most)
    for (let yy = y; yy <= y1; yy++) for (let i = x; i <= x1; i++) used.add(i + ',' + yy);
    out.push([x, y, x1 + 1, y1 + 1]);
  }
  return out;
}

// ---------------------------------------------------------------- the lower floors, from a plan
// plan cells: . floor; c floor with a chest; E the exit (floor, or the steps of a way down: spec.exit.down); s the stairwell up beyond it; ' ' the rock between rooms
// (the original's black); w brick wall; b a barred front; G a gilt totem (two cells); p a stone post
function floorPlan(spec) {
  const { w: MW, h: MH, rows } = spec, kind = (x, y) => (rows[y] && rows[y][x]) || ' ';
  const open = k => k === '.' || k === 'c' || k === 'E';
  const X = spec.exit, inWell = (x, y) => !!(X && X.down) && x >= X.x0 && x < X.x1 && y >= X.z0 && y < X.z1;   // a way down: the exit cells are its steps
  const low = (x, y) => open(kind(x, y - 1)) || open(kind(x, y - 2));   // someone stands within two cells north: kept low
  const height = (x, z) => { const cx = Math.floor(x), cy = Math.floor(z), k = kind(cx, cy);
    if (inWell(cx, cy)) return -stairAt(X, z);
    if (open(k)) return 0;
    if (k === 's' && spec.exit) return stairAt(spec.exit, z);
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH || k === ' ') return FILL_H;
    if (k === 'w') return low(cx, cy) ? LOW_H : WALL_H;
    if (k === 'G') return TOTEM_H; if (k === 'p') return POST_H;
    return SILL; };
  let chestG = new Map(), world = null;
  async function build(E, FX) {
    const S = E.world.scene, { M, stone, cap, floor, fill } = materials(); world = E.world; chestG = new Map();
    const slabs = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) !== ' ' && !inWell(x, y)) slabs.push(box(floor, x, PIT, y, x + 1, 0, y + 1, 0.5));
    S.add(shade(merged(floor, slabs), false));
    const fills = [];
    for (let y = -OUT; y < MH + OUT; y++) for (let x = -OUT; x < MW + OUT; x++) {
      const inside = x >= 0 && y >= 0 && x < MW && y < MH;
      if (inside ? kind(x, y) === ' ' : true) fills.push(box(fill, x, PIT, y, x + 1, FILL_H + (inside ? 0 : Math.min(0.6, Math.max(-x, x - MW + 1, -y, 0) * 0.15)), y + 1, 0.5));
    }
    S.add(shade(merged(fill, fills)));
    const walls = [], caps = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'w') {
      const h = low(x, y) ? LOW_H : WALL_H;
      walls.push(box(stone, x, 0, y, x + 1, h, y + 1, h > 1 ? 0.6 : 1.2)); caps.push(box(cap, x - 0.03, h, y - 0.03, x + 1.03, h + 0.1, y + 1.03, 1));
    }
    S.add(shade(merged(stone, walls)), shade(merged(cap, caps)));
    for (const [x0, z0, x1, z1] of rects(kind, MW, MH, 'b')) S.add(barred(x0, z0, x1, z1));
    for (const [x0, z0, x1, z1] of rects(kind, MW, MH, 'G')) S.add(totem(x0, z0, x1, z1));
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'p') S.add(post(x, y));
    for (const r of spec.straw || []) S.add(straw(...r));
    if (D.n !== 'scene') for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'c') { const g = chest(M, x + 0.5, y + 0.5, 0, false, 0, 1.4); S.add(g); chestG.set(x + ',' + y, g); }   // (the battle's: scene 41 shows none [the user's call])
    if (spec.exit) (spec.exit.down ? exitWell : exitStair)(S, spec.exit);
    if (spec.arch) archway(S, spec.arch);
    for (const [x, z, h] of spec.torches || []) torch(S, FX, E, x, z, h);
    for (const [x, z] of spec.lamps || []) { const L = new THREE.PointLight(0xffc070, 5, 6, 1.6); L.position.set(x, 2.6, z); S.add(L); }   // warm light over the totems
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y); if (!g || !world) return;
    const p = g.position, S = g.parent; S.remove(g);
    const o = chest(materials().M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  // keepFloor: a flier in a blocked cell stays on the floor level (battle.js floorY): the walls, totems and posts stand on
  // the flagstones and the black between the rooms over the dark, so fading them shows those, never a hole
  const slopes = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (inWell(x, y)) slopes.push([x, y]);   // (tools/qa/sets.js: steps, not level)
  return { build, openChest, ground: height, particles: 'dust', mood: MOOD, keepFloor: true, slopes,
    props: rows.flatMap((r, y) => [...r].map((k, x) => (k === 'b' || k === 'p' || k === 'G') ? [x, y] : null).filter(Boolean)) };
}
// the way up out of the gaol: a flight climbing north over (x0, z0)-(x1, z1), into a dark arch
const STEPS = 7;
const stairAt = ({ z0, z1, top }, z) => top * Math.min(1, Math.ceil(Math.max(0, (z1 - z) / (z1 - z0)) * STEPS - 1e-6) / STEPS);
function exitStair(S, { x0, x1, z0, z1, top, bare }) {
  const { stone, frame, dark } = materials(), steps = [], n = STEPS;
  for (let k = 0; k < n; k++) steps.push(box(stone, x0 + 0.05, 0, z0, x1 - 0.05, top * (k + 1) / n, z1 - (z1 - z0) * k / n, 0.5));
  S.add(shade(merged(stone, steps)));
  if (bare) return;   // (behind an arch: no frame of its own)
  S.add(box(dark, x0 + 0.1, top, z0 - 0.02, x1 - 0.1, top + 1.6, z0 + 0.08));
  for (const px of [x0 - 0.12, x1 - 0.06]) S.add(shade(box(frame, px, 0, z0 - 0.1, px + 0.18, top + 1.8, z0 + 0.2, 0.5)));
  S.add(shade(box(frame, x0 - 0.15, top + 1.6, z0 - 0.12, x1 + 0.15, top + 1.85, z0 + 0.22, 0.5)));
}
// the way down out of the gaol's own floor (0f5b14): the original's pale steps falling away north on the exit cells
// themselves (22-23, rows 2-3) into the dark under the wall: a flight dropping north over (x0, z0)-(x1, z1), on the cells
// a hero steps onto to go down, to a depth of top; pale curbs along its sides, black under the wall at its foot
function exitWell(S, { x0, x1, z0, z1, top }) {
  const { frame, dark } = materials(), n = STEPS, steps = [];
  for (let k = 0; k < n; k++) { const za = z1 - (z1 - z0) * (k + 1) / n, zb = z1 - (z1 - z0) * k / n; steps.push(box(frame, x0 + 0.12, -top - 0.6, za, x1 - 0.12, -top * (k + 1) / n, zb, 0.5)); }
  S.add(shade(merged(frame, steps)));
  S.add(box(dark, x0, -top - 0.6, z0 - 0.06, x1, 0.02, z0 + 0.02));                                     // the dark under the wall it goes into
  for (const [a, b] of [[x0, x0 + 0.12], [x1 - 0.12, x1]]) S.add(shade(box(frame, a, -top - 0.6, z0, b, 0.08, z1, 0.5)));   // its curbs
  const L = new THREE.PointLight(0xc8c0ff, 3, 2.6, 1.6); L.position.set((x0 + x1) / 2, 0.5, z1 - 0.4); S.add(L);   // a little light on the top steps (the original's pale treads)
}
// a stone arch on a wall's face (the lower floor's way out, between its two totems): a ring of dressed stones springing
// from two jambs, the passage behind it dark (archway: { x0, x1, z, y } the jambs' outer edges, the face, the spring)
function archway(S, { x0, x1, z, y }) {
  const { frame, dark } = materials(), r = (x1 - x0) / 2, cx = (x0 + x1) / 2, t = 0.22, parts = [];
  for (const px of [x0, x1 - t]) parts.push(box(frame, px, 0, z - 0.2, px + t, y, z + 0.06, 0.5));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r - t / 2, t / 2, 8, 24, Math.PI), frame); ring.position.set(cx, y, z - 0.07); ring.scale.z = 1.2; parts.push(ring);
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; parts.push(box(frame, cx + Math.cos(a) * (r - t / 2) - 0.05, y + Math.sin(a) * (r - t / 2) - 0.05, z - 0.18, cx + Math.cos(a) * (r - t / 2) + 0.05, y + Math.sin(a) * (r - t / 2) + 0.05, z + 0.04, 0.5)); }   // its joints
  S.add(shade(merged(frame, parts)));
  const shape = new THREE.Shape(); shape.moveTo(x0 + t, 0); shape.lineTo(x1 - t, 0); shape.lineTo(x1 - t, y); shape.absarc(cx, y, r - t, 0, Math.PI, false); shape.lineTo(x0 + t, 0);
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), dark); hole.position.z = z - 0.9; S.add(hole);   // the dark through it
}
const MOOD = { bg: 0x050407, voidCol: 0x050407, voidY: -1.6, fog: 0x08070c, fogD: 0.012, sky: 0xa4a4d8, under: 0x2a2030, hemi: 1.1,
  sun: 0xb8b8e8, sunI: 2.0, sunDir: [-0.35, 0.9, 0.45], sat: 1.0, exposure: 1.45, bloom: 0.45, aoR: 0.7,
  env: { top: 0x4a4868, mid: 0x3a3248, low: 0x100c14, lights: [[0, 5, -6, 0xffa060, 3], [-6, 3, 4, 0xff9050, 2]] } };

// the gaol's own floor (0f5b14: battle 20's map, scene 41's first): the cell behind bars at the top left, the totem hall
// down the west side, the guard rooms, the cell with the straw at the east, the stairs up at the north-east
export const gaolMain = floorPlan({
  w: 24, h: 15, rows: [
    ' .... wwwwwww  wwwwwwwww',   //  0
    ' bbbb .......wwwwwwwwwww',   //  1
    ' bbbb .......ww.......EE',   //  2  the way down (22-23, rows 2-3: the battle's exit cells)
    ' .... p.p ............EE',   //  3
    ' .... p.p ......... p.bb',   //  4
    ' G..G ... ......... p.bb',   //  5
    ' G..G .c. ..... wwww...c',   //  6
    ' .... wwwww ... wwww....',   //  7
    ' .... ..... ... ... wwww',   //  8  (19: the rock line)
    ' G..G ...c. ... ...  www',   //  9
    ' G..Gwbbbb.w...wbb.w....',   // 10
    ' ....wbbbb.w...wbb.w....',   // 11
    ' .......................',   // 12
    '   .....................',   // 13
    '                        ',   // 14 (the map's spare row)
  ].map(r => r.slice(0, 24).padEnd(24, ' ')),
  straw: [[21.05, 6.05, 22.95, 7.95]],
  lamps: [[2.5, 6.5], [2.5, 10.5]],
  exit: { x0: 22, x1: 24, z0: 2, z1: 4, top: 1.0, down: true },   // the stairs down to the lower floor (the battle's room 1), on its exit cells
  torches: [[9.5, 1.0, 1.65], [18, 2.0, 1.65], [13.5, 3.0, 1.65]],
});
// the lower floor (battle 20's room 1): cells behind bars round the edges, straw in them, two gateways between posts, the
// arch out at the north between two totems
export const gaolLower = floorPlan({
  w: 24, h: 20, rows: [
    '........ ..c    GwswGwww',   //  0  the passage up behind the arch (18)
    '........ ... wwwGwEwGwww',   //  1  the way out (18, 1)
    '........ ... www.... www',   //  2
    '........w.bb ....... www',   //  3
    'www ....w.bb ....... ...',   //  4
    'www ........ ....... ..c',   //  5
    '... ........ ....... ...',   //  6
    'c.. ........ p.p ...w.bb',   //  7
    '... .... p.p p.p ...w.bb',   //  8
    'bb.w.... p.p ... ...... ',   //  9
    'bb.w.... ... ... ...... ',   // 10
    '........ ... wwww...... ',   // 11
    '........ ... wwww...... ',   // 12
    '........wwwww.......w.bb',   // 13
    '........wwwww.......w.bb',   // 14
    '.bbw................ ...',   // 15
    '.bbw........... wwww ...',   // 16
    '... ........... wwww ..c',   // 17
    '..c wwwwwwwwwwww.... www',   // 18
    '                        ',   // 19
  ].map(r => r.slice(0, 24).padEnd(24, ' ')),
  lamps: [[18.5, 2.5]],
  straw: [[10.05, 1.05, 11.95, 2.95], [1.05, 7.05, 2.95, 8.95], [14.05, 9.05, 15.95, 10.95], [10.05, 11.05, 11.95, 12.95], [0.05, 17.05, 1.95, 18.95]],
  exit: { x0: 18, x1: 19, z0: 0, z1: 1, top: 1.2, bare: true },
  arch: { x0: 17.35, x1: 19.65, z: 2, y: 1.15 },   // the original's arch on the wall's face over the way out (18, 1), between the totems
  torches: [[14, 3.0, 1.65], [22, 4.0, 1.65]],
});

// ---------------------------------------------------------------- room 2: 崇侯虎's stair hall (0f5b58)
// measured on tools/qa/grid.py 0f5b58 and the room's terrain:
//   the court   rows 15-23, a field of gilt totems down both sides (two cells each, staggered) and either side of the
//               stair's foot (5 and 9, rows 15-16)
//   the stair   x 6-9, rows 7-15, from the court up to the dais
//   terraces    either side of the stair, a level up (x 1-2 rows 7-12 and x 1-4 rows 11-12; mirrored at 12-14 and
//               10-14), their brick faces (rows 13-14) to the court, balustrades along their edges; brick blocks between
//               them and the stair (x 3-5, 9-11, rows 7-10): the dais's front
//   the dais    rows 3-6 (x 4-10, row 3-4 x 5-9), two levels up, its back wall (x 5-9, rows 1-2) and brick masses either
//               side; 黃飛虎 chained at (7, 2) before the wall; the two chests at (6, 3) and (8, 3)
const R2 = { MID: 1.0, TOP: 2.0, BASE: -2 };
function hallLevels() {
  const L = new Levels(16, 25, 4), { MID, TOP } = R2;
  L.set(0, 15, 16, 25, 0);                                                  // the court
  L.set(1, 7, 3, 13, MID).set(3, 11, 5, 13, MID).set(13, 7, 15, 13, MID).set(10, 11, 13, 13, MID);   // the terraces
  L.set(4, 3, 11, 7, TOP).set(5, 2, 10, 3, TOP);                            // the dais, to the back wall
  L.set(6, 7, 9, 7.2, TOP);
  L.stairs(6, 7.2, 9, 15, 0, TOP, 16, 's');
  return L;
}
const HL = hallLevels();
const HALL_PLAN = [
  '                ',   //  0
  '     wwwww      ',   //  1
  '     ddddd      ',   //  2  the dais's back edge: 黃飛虎 chained at (7, 2)
  'WWWWW.c.c.WWWWWW',   //  3
  'WWWWW.....WWWWWW',   //  4
  'WWWW.......WWWWW',   //  5
  'WWWW.......WWWWW',   //  6
  'r..bbb...bbb...r',   //  7
  'r..bbb...bbb...r',   //  8
  'r..bbb...bbb...r',   //  9
  'r..bbb...bbb...r',   // 10
  'r....b...b.....r',   // 11
  'r....b...b.....r',   // 12
  'fffffb...bffffff',   // 13
  'fffffb...bffffff',   // 14
  'G....G...G.....G',   // 15
  'GG...G...G....GG',   // 16
  '.G............G.',   // 17
  'G..............G',   // 18
  'GG............GG',   // 19
  '.G............G.',   // 20
  'G..............G',   // 21
  'G..............G',   // 22
  '.G............G.',   // 23
  '                ',   // 24
];
const hk = (x, y) => (HALL_PLAN[y] && HALL_PLAN[y][x]) || ' ';
function hallGround(x, z) {
  const cx = Math.floor(x), cy = Math.floor(z), k = hk(cx, cy), { MID, TOP } = R2;
  if (cx < 0 || cx >= 16 || cy < 0) return FILL_H + TOP;
  if (cy >= 24) return 0;
  if (k === ' ') return TOP + 1.2;
  if (k === 'w') return TOP + WALL_H;
  if (k === 'd') return TOP;
  if (k === 'W') return TOP + 0.6;                 // the brick masses beside the dais, a little over it
  if (k === 'b') return TOP - 0.05;                // the dais's front blocks (between the terraces and the stair)
  if (k === 'f') return MID;                       // the terraces' faces: their tops at the terrace's level
  if (k === 'r') return MID + 0.5;                 // the outer balustrade's line
  if (k === 'G') return TOTEM_H;
  return HL.at(x, z);
}
let hallChests = new Map(), hallWorld = null;
async function buildHall(E, FX) {
  const S = E.world.scene, { M, stone, cap, floor, fill, frame } = materials(), { MID, TOP, BASE } = R2;
  hallWorld = E.world; hallChests = new Map();
  S.add(shade(HL.mesh(floor, stone, BASE, 0.5), false));
  for (const r of HL.ramps) S.add(stairs(r, frame, stone, 0.5));
  const blocks = [], caps = [];
  const tops = [], mass = (x0, z0, x1, z1, y0, y1) => { blocks.push(box(stone, x0, y0, z0, x1, y1, z1, 0.6)); tops.push(box(materials().top, x0 + 0.08, y1, z0 + 0.08, x1 - 0.08, y1 + 0.04, z1 - 0.08, 1));
    caps.push(box(cap, x0 - 0.03, y1, z0 - 0.03, x1 + 0.03, y1 + 0.08, z0 + 0.1, 1), box(cap, x0 - 0.03, y1, z1 - 0.1, x1 + 0.03, y1 + 0.08, z1 + 0.03, 1), box(cap, x0 - 0.03, y1, z0, x0 + 0.1, y1 + 0.08, z1, 1), box(cap, x1 - 0.1, y1, z0, x1 + 0.03, y1 + 0.08, z1, 1)); };
  mass(5, 0.6, 10, 2, TOP, TOP + WALL_H);                                   // the back wall behind the dais
  // 黃飛虎's chains: two rings in the wall over his cell, iron links hanging from each to his raised wrists
  const links = [];
  for (const sx of [-1, 1]) { const ax = 7.5 + sx * 0.32, ay = TOP + 1.55;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), materials().iron); ring.position.set(ax, ay, 2.02); links.push(ring);
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 5, 8), materials().iron); l.position.set(ax - sx * k * 0.03, ay - 0.07 - k * 0.07, 2.08 + k * 0.02); l.rotation.set(0, k % 2 ? Math.PI / 2 : 0, 0); links.push(l); } }
  S.add(shade(merged(materials().iron, links)));
  mass(0, 2.6, 4, 7, BASE, TOP + 0.6); mass(11, 2.6, 16, 7, BASE, TOP + 0.6); mass(4, 2.6, 5, 5, BASE, TOP + 0.6); mass(10, 2.6, 11, 5, BASE, TOP + 0.6);
  mass(3, 7, 6, 11, BASE, TOP - 0.05); mass(9, 7, 12, 11, BASE, TOP - 0.05); mass(5, 11, 6, 15, BASE, MID); mass(9, 11, 10, 15, BASE, MID);   // the dais's front, the stair's cheeks
  mass(0, 13, 5, 15, BASE, MID); mass(10, 13, 16, 15, BASE, MID);           // the terraces' faces
  mass(0, 7, 1, 13, BASE, MID + 0.5); mass(15, 7, 16, 13, BASE, MID + 0.5);  // their outer walls
  S.add(shade(merged(stone, blocks)), shade(merged(cap, caps)), shade(merged(materials().top, tops)));
  // the rock round the hall
  const fills = [];
  for (let y = -OUT; y < 0; y++) for (let x = -OUT; x < 16 + OUT; x++) fills.push(box(fill, x, BASE, y, x + 1, TOP + 1.2, y + 1, 0.5));
  for (let y = 0; y < 3; y++) for (let x = -OUT; x < 16 + OUT; x++) if (x < 5 || x >= 10 || y === 0) fills.push(box(fill, x, BASE, y, x + 1, TOP + 1.2, y + 1, 0.5));
  for (let y = 3; y < 25 + OUT; y++) for (const x of [...Array(OUT).keys()].map(i => -1 - i).concat([...Array(OUT).keys()].map(i => 16 + i))) fills.push(box(fill, x, BASE, y, x + 1, y < 15 ? TOP + 0.6 : 0.4, y + 1, 0.5));
  S.add(shade(merged(fill, fills)));
  const court = []; for (let y = 25; y < 25 + OUT; y++) for (let x = 0; x < 16; x++) court.push(box(floor, x, BASE, y, x + 1, 0, y + 1, 0.5));
  S.add(shade(merged(floor, court), false));
  // balustrades: pale stone posts with round knobs and a carved rail, along the terraces' and the dais's edges
  const rail = (x0, z0, x1, z1, y) => {
    const parts = [], along = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = along ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 0.55));
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; parts.push(box(frame, x - 0.07, y, z - 0.07, x + 0.07, y + 0.52, z + 0.07, 2));
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), frame); b.position.set(x, y + 0.6, z); parts.push(b); }
    const t = 0.05; parts.push(along ? box(frame, x0, y + 0.1, z0 - t, x1, y + 0.4, z0 + t, 2) : box(frame, x0 - t, y + 0.1, z0, x0 + t, y + 0.4, z1, 2));
    return parts;
  };
  const P = [];
  for (const [x0, z0, x1, z1, y] of [[0.1, 13.1, 5.9, 13.1, MID], [9.1, 13.1, 15.9, 13.1, MID], [0.6, 7, 0.6, 13.1, MID], [15.4, 7, 15.4, 13.1, MID],
    [3.1, 7.1, 5.9, 7.1, MID], [9.1, 7.1, 11.9, 7.1, MID], [5.9, 7.1, 5.9, 14.9, MID], [9.1, 7.1, 9.1, 14.9, MID],
    [3.6, 3.6, 3.6, 7.1, TOP], [11.4, 3.6, 11.4, 7.1, TOP], [0.1, 6.6, 3.6, 6.6, TOP + 0.6], [11.4, 6.6, 15.9, 6.6, TOP + 0.6]]) P.push(...rail(x0, z0, x1, z1, y));
  S.add(shade(merged(frame, P)));
  // the totems of the court
  for (const [x0, z0, x1, z1] of rects(hk, 16, 25, 'G')) S.add(totem(x0, z0, x1, z1));
  // the chests on the dais
  if (D.n !== 'scene') for (const [x, y] of [[6, 3], [8, 3]]) { const g = chest(M, x + 0.5, y + 0.5, TOP, false, 0, 1.4); S.add(g); hallChests.set(x + ',' + y, g); }   // (the battle's: scene 41 shows none [the user's call])
  // torches on the back wall either side of 黃飛虎, on the terraces' faces; warm lamps over the court's totems
  for (const [x, z, h] of [[5.6, 2.02, TOP + 1.6], [9.4, 2.02, TOP + 1.6]]) torch(S, FX, E, x, z, h);
  for (const [x, z] of [[1.5, 17], [14.5, 17], [1.5, 21.5], [14.5, 21.5], [7.5, 16]]) { const L = new THREE.PointLight(0xffc070, 5, 6, 1.6); L.position.set(x, 2.6, z); S.add(L); }
  for (const [x, z, h] of [[2, 13.05, MID - 0.3], [13.5, 13.05, MID - 0.3], [1.5, 7.05, MID + 1.5], [14.5, 7.05, MID + 1.5]]) torch(S, FX, E, x, z, h);
}
export const gaolHall = {
  build: buildHall, ground: hallGround, particles: 'dust', mood: MOOD, keepFloor: true,   // (as the floors': floorPlan)
  openChest(x, y) { const g = hallChests.get(x + ',' + y); if (!g) return; const p = g.position, S = g.parent; S.remove(g); const o = chest(materials().M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); hallChests.set(x + ',' + y, o); },
  props: HALL_PLAN.flatMap((r, y) => [...r].map((k, x) => k === 'G' ? [x, y] : null).filter(Boolean)),
  slopes: (() => { const out = []; for (let y = 7; y < 15; y++) for (let x = 6; x < 9; x++) out.push([x, y]); return out; })(),
};
