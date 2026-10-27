// 誅仙陣, 申公豹's formation on 東海金螯島 (battle 27's thirteen rooms; scene 57's maps: 0fa6a8 the gate, 0fa6f4 = room 0,
// 0fa70c = room 12, 通天教主's hall), remade from each room's own art and terrain, as all share one tileset: causeways and
// halls of grey-green cobbles laid on piers of cobalt glazed brick, standing in a dark abyss; walls of the same brick
// along their north edges, coped in turquoise glaze; the stairs the original draws for the ways on (and back); each
// gate's chamber closed by a great wall under its plaque, the arch and its green doors. Measured on tools/qa/grid.py:
//   classify  each 32 px cell of the art by its colours: the cobbles (486c6c 484848 90b4b4 6c9090 d8fcb4), the brick
//             (24246c 246cb4 00b4fc 00486c), black; walkable cells and chests are floor whatever they show
//   walls     brick standing on a floor's north side (the art draws its face over the cells it stands in: a run of brick
//             down to a floor) is a wall, raised WALL_H, kept LOW_H where a floor lies right behind it (the face over
//             that floor would hide whoever stands there); brick under a floor with the dark below is the floor's own
//             pier, falling into the abyss; black is the abyss
//   gates     the 8-wide rooms (2, 5, 8, 11) and scene 57's gate (0fa6a8): the wall across rows 1-4 (x 1-7), the plaque
//             (x 3.2-4.85, rows 1.05-1.85: its pixels from the art), the arch (x 2.9-5.1, its crown at row 2.35), the
//             doors; at the gate of scene 57 the arch stands open on steps going up into the dark
// Lit cold, as the original's blues: a pale moon-blue key from the north-west, the abyss's mist lit faintly from below.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { D, G } from '../rules.js';

const FLOOR = new Set([0x486c6c, 0x484848, 0x90b4b4, 0x6c9090, 0xd8fcb4]), BRICK = new Set([0x24246c, 0x246cb4, 0x00b4fc, 0x00486c]);
const VOID = -9, DEEP = -7, SLAB = 0.12, LOW_H = 0.65, WALL_H = 1.6, GATE_H = 4.1, MIST = -4.2;
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- materials
let MAT = null;
// the cobbles: rounded stones of grey-green as drawn, large and worn flat, set close in dark joints; a stone here and
// there paler or darker, a little grit in the joints. Calm: no moss, no specks
function cobbleTex() {
  return T.pbr('zxCobble5', 512, (u, v, o) => {
    const wob = (T.fbm(u, v, 14, 3, 275) - 0.5) * 0.09;   // (the joints wander: no ruled cracks)
    const [d1, d2, id] = T.worley(u + wob, v - wob, 5, 271, 1), edge = d2 - d1, n = T.fbm(u, v, 10, 4, 272), fine = T.fbm(u, v, 48, 3, 273), grit = T.fbm(u, v, 90, 2, 274);
    const wide = 0.1 + T.fbm(u, v, 9, 2, 276) * 0.08, dome = T.smooth(0.02, 0.45, edge), joint = 1 - T.smooth(0.02, wide, edge);
    const tone = R(id * 97.3), base = T.mixc(T.mixc([0.36, 0.43, 0.41], [0.5, 0.56, 0.52], id), [0.47, 0.47, 0.42], tone * 0.35);   // grey-green stones, a few warmer
    const worn = T.smooth(0.6, 0.95, dome) * (0.5 + fine * 0.5);
    let c = T.mixc(base, [base[0] * 1.15, base[1] * 1.13, base[2] * 1.1], worn * 0.45);
    c = T.mixc(c, [c[0] * 0.84, c[1] * 0.86, c[2] * 0.86], (fine - 0.3) * 0.7 + (n - 0.5) * 0.4);
    c = c.map(q => q * (0.74 + 0.26 * dome));   // (shaded toward its joint: a rounded stone)
    c = T.mixc(c, T.mixc([0.17, 0.18, 0.16], [0.27, 0.27, 0.23], grit), joint * 0.62);
    o.c = c; o.h = 0.3 + dome * 0.32 + (n - 0.5) * 0.05 + (fine - 0.5) * 0.035 - joint * 0.1 + grit * joint * 0.05; o.r = 0.86 - worn * 0.16 + joint * 0.08;
  }, 6);
}
// the brick: cobalt glaze, each brick its own depth of blue between the original's navy and its mid-blue, the glaze
// pooled pale along the top edges (the art's light strokes), dark sunken joints, crazing here and there
function glazeTex() {
  return T.pbr('zxGlaze2', 512, (u, v, o) => {
    const rows = 8, y = v * rows, ry = Math.floor(y), x = u * 3 + (ry % 2) * 0.5, rx = Math.floor(x), fx = x - rx, fy = y - ry;
    const id = R(((rx % 3) + 3) % 3 * 17 + ry * 5.3), n = T.fbm(u, v, 10, 4, 281), craze = T.smooth(0.0, 0.02, Math.abs(T.fbm(u, v, 30, 3, 282) - 0.5));
    const e = Math.min(fx * 3 / rows * 2.5, (1 - fx) * 3 / rows * 2.5, fy, 1 - fy), mortar = T.smooth(0.09, 0.035, e), lip = T.smooth(0.3, 0.06, fy) * (1 - mortar);
    let c = T.mixc([0.045, 0.07, 0.2], [0.08, 0.17, 0.4], id * 0.75 + n * 0.25);
    c = T.mixc(c, [0.22, 0.42, 0.6], lip * 0.35);
    c = T.mixc(c, [c[0] * 0.8, c[1] * 0.85, c[2] * 0.9], (1 - craze) * 0.25);
    c = T.mixc(c, [0.04, 0.05, 0.1], mortar * 0.9);
    o.c = c; o.h = 0.6 - mortar * 0.45 + lip * 0.04 + n * 0.03; o.r = 0.18 + mortar * 0.7 + (1 - craze) * 0.08;
  }, 3);
}
// the coping: turquoise glazed tiles, the original's bright rim (00b4fc) in a natural key
function copeTex() {
  return T.pbr('zxCope2', 256, (u, v, o) => {
    const k = Math.floor(u * 4), f = u * 4 - k, n = T.fbm(u, v, 8, 3, 291), j = T.smooth(0.05, 0.0, Math.min(f, 1 - f));
    o.c = T.mixc(T.mixc([0.09, 0.32, 0.37], [0.18, 0.46, 0.5], R(k * 7.1) * 0.6 + n * 0.4), [0.04, 0.09, 0.1], j * 0.8);
    o.h = 0.6 - j * 0.4 + n * 0.04; o.r = 0.2 + j * 0.6;
  }, 2);
}
// the wall's top and the stairs' stone: dark slate for tops (the original leaves them black), pale celadon for the steps
function materials() {
  if (MAT) return MAT;
  const M = mats();
  MAT = {
    M,
    cobble: T.material(cobbleTex(), {}, [1, 1]),
    glaze: T.material(glazeTex(), { clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 }, [0.5, 0.5]),
    cope: T.material(copeTex(), { clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.0 }, [1, 1]),
    slate: T.material(T.rock(0x23262e, 'zxSlate', 0.5), { color: 0x9aa0b0 }, [0.5, 0.5]),
    step: T.material(T.flags(0x7e8e86, 0x6a7a72, 'zxStep3', 3, 0, 0x2a3632), {}, [1, 1]),
    arch: T.material(T.rock(0x8a9a94, 'zxArch', 0.3), { color: 0xe0ece6 }, [1, 1]),
    door: T.material(T.lacquer(0x3e5a12, 'zxDoor'), { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x020306, roughness: 1 }),
  };
  return MAT;
}

// ---------------------------------------------------------------- the abyss
// slow mist far below, drifting in two layers, the formation's faint light under it
function abyss(S, cx, cz) {
  const u = { uTime: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main(){ vec2 p = vW.xz * 0.11; float t = uTime * 0.018;
        float a = fb(p + vec2(t, t * 0.6)), b = fb(p * 1.7 - vec2(t * 1.3, -t * 0.4) + a);
        float m = smoothstep(0.35, 0.85, a * 0.6 + b * 0.5);
        vec3 c = mix(vec3(0.01, 0.02, 0.05), vec3(0.08, 0.2, 0.28), m);
        gl_FragColor = vec4(c, 0.55 + m * 0.4); }` });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), m); plane.position.set(cx, MIST, cz); plane.renderOrder = -2; S.add(plane);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x010205, fog: false })); floor.position.set(cx, VOID - 0.5, cz); floor.renderOrder = -3; S.add(floor);
  return u;
}

// ---------------------------------------------------------------- reading the art
async function pixels(src) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height);
}
// per cell: F floor, W wall, P a floor's pier face (abyss), V abyss; and each wall cell's height
function plan(img, MW, MH, terr, chests, gate) {
  const share = (x, y) => { let f = 0, b = 0; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4, c = img.data[k] << 16 | img.data[k + 1] << 8 | img.data[k + 2]; if (FLOOR.has(c)) f++; else if (BRICK.has(c)) b++; } return [f / 1024, b / 1024]; };
  const chestAt = new Set(chests.map(c => c.x + ',' + c.y));
  const K = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, (_, x) => {
    const t = terr[y][x]; if (t === 0 || t === 3 || t === 4 || chestAt.has(x + ',' + y)) return 'F';
    const [f, b] = share(x, y); return f > 0.55 ? 'F' : b > 0.3 ? 'B' : 'V';
  }));
  const at = (x, y) => (x >= 0 && y >= 0 && x < MW && y < MH ? K[y][x] : 'V');
  for (let y = MH - 1; y >= 0; y--) for (let x = 0; x < MW; x++) if (K[y][x] === 'B' && (at(x, y + 1) === 'F' || at(x, y + 1) === 'W')) K[y][x] = 'W';   // a run of brick down to a floor
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (K[y][x] === 'B' && (at(x, y - 1) === 'F' || at(x, y - 1) === 'P')) K[y][x] = 'P';   // under a floor, the dark below
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (K[y][x] === 'B') K[y][x] = at(x - 1, y) === 'P' || at(x + 1, y) === 'P' ? 'P' : 'W';   // the rest go with their row
  if (gate) for (let y = 0; y < 4; y++) for (let x = 0; x < MW; x++) K[y][x] = 'V';   // (the gate's wall is built on its own)
  // a wall's height: its column's run, low where a floor lies right behind its top
  const H = Array.from({ length: MH }, () => new Array(MW).fill(0));
  for (let x = 0; x < MW; x++) for (let y = 0; y < MH; y++) if (K[y][x] === 'W' && at(x, y - 1) !== 'W') {
    let y1 = y; while (at(x, y1 + 1) === 'W') y1++;
    const h = at(x, y - 1) === 'F' ? LOW_H : WALL_H; for (let j = y; j <= y1; j++) H[j][x] = h;
  }
  return { K, H, at };
}
// texture coordinates from the world (k a unit): tops by x, z, faces by their run and height, so pieces laid side by
// side carry on one texture without a seam where they meet
function worldUV(mesh, k = 1) {
  const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay > 0.5) uv.setXY(i, x * k, z * k); else if (ax > 0.5) uv.setXY(i, z * k, y * k); else uv.setXY(i, x * k, y * k); }
  uv.needsUpdate = true; return mesh;
}
// maximal rectangles of one class
function rects(at, MW, MH, k, sameH) {
  const used = new Set(), out = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (at(x, y) !== k || used.has(x + ',' + y)) continue;
    const ok = (i, j) => at(i, j) === k && !used.has(i + ',' + j) && (!sameH || sameH(i, j) === sameH(x, y));
    let x1 = x; while (ok(x1 + 1, y)) x1++;
    let y1 = y; const row = j => { for (let i = x; i <= x1; i++) if (!ok(i, j)) return false; return true; };
    while (y1 + 1 < MH && row(y1 + 1)) y1++;
    for (let j = y; j <= y1; j++) for (let i = x; i <= x1; i++) used.add(i + ',' + j);
    out.push([x, y, x1 + 1, y1 + 1]);
  }
  return out;
}

// ---------------------------------------------------------------- pieces
// a way on goes down, a way back up [the user's call: the way on climbed]: the original draws the way on as steps sunk
// in a dark recess, stepping down from left to right (room 1's at (21, 12)), so the battle's camera, looking north,
// sees every tread (steps going down away from it hide behind the near lip); WELL its opening in the cell (the floor
// and piers cut round it, lay())
const WELL = { x0: 0.14, x1: 0.86, z0: 0.12, z1: 0.84, d: 0.42, n: 5 };
function well(x, y) {
  const { step, slate, cope } = materials(), g = new THREE.Group(), treads = [], risers = [], lining = [], rim = [];
  const X0 = x + WELL.x0, X1 = x + WELL.x1, ZN = y + WELL.z0, ZS = y + WELL.z1, dx = (X1 - X0) / WELL.n, BOT = -WELL.d - 0.08;
  for (let k = 0; k < WELL.n; k++) { const xa = X0 + k * dx, xb = xa + dx, top = -WELL.d * (k + 1) / WELL.n;   // (from the floor at the west lip down eastward)
    risers.push(box(slate, xa, BOT, ZN, xb, top - 0.03, ZS, 2)); treads.push(box(step, xa - 0.012, top - 0.03, ZN, xb, top, ZS, 2)); }
  lining.push(box(slate, X0, BOT, ZN, X1, 0, ZN + 0.02, 2), box(slate, X0, BOT, ZS - 0.02, X1, 0, ZS, 2), box(slate, X1 - 0.02, BOT, ZN, X1, 0, ZS, 2));
  rim.push(box(cope, X0 - 0.05, -0.01, ZN - 0.05, X1 + 0.05, 0.03, ZN, 2), box(cope, X0 - 0.05, -0.01, ZS, X1 + 0.05, 0.03, ZS + 0.05, 2),
    box(cope, X1, -0.01, ZN, X1 + 0.05, 0.03, ZS, 2), box(cope, X0 - 0.05, -0.01, ZN, X0, 0.03, ZS, 2));
  g.add(shade(merged(step, treads)), shade(merged(slate, [...risers, ...lining])), shade(merged(cope, rim)));
  const L = new THREE.PointLight(0x9ad8ff, 0.9, 1.1, 2); L.position.set(x + 0.62, -0.12, y + 0.48); g.add(L);   // (a cold glow down in the well)
  g.userData.stair = true; g.userData.down = true;
  return g;
}
// the stairs the original draws for a way back: four pale treads climbing north in the back of the cell, low
// cheeks of turquoise glaze, a cold light on the top tread
function stair(x, y) {
  const { step, glaze, cope } = materials(), g = new THREE.Group(), parts = [], N = 5, Z0 = y + 0.5, Z1 = y + 0.98, TOP = 0.5;
  const { slate } = materials(), risers = [];
  for (let k = 0; k < N; k++) { const z = Z0 + (Z1 - Z0) * k / N, y1 = TOP * (k + 1) / N;
    risers.push(box(slate, x + 0.22, 0, z, x + 0.78, y1 - 0.03, Z1, 2)); parts.push(box(step, x + 0.21, y1 - 0.03, z - 0.012, x + 0.79, y1, Z1, 2)); }   // pale treads, their lips over darker risers
  g.add(shade(merged(step, parts)), shade(merged(slate, risers)));
  const cheek = s => { const x0 = s < 0 ? x + 0.1 : x + 0.78, x1 = x0 + 0.12; return [box(glaze, x0, 0, Z0 - 0.02, x1, TOP + 0.06, Z1, 1), box(cope, x0 - 0.015, TOP + 0.06, Z0 - 0.04, x1 + 0.015, TOP + 0.12, Z1 + 0.01, 2)]; };
  const ch = [...cheek(-1), ...cheek(1)];
  g.add(shade(merged(glaze, ch.filter(m => m.material === glaze))), shade(merged(cope, ch.filter(m => m.material === cope))));
  const L = new THREE.PointLight(0x9ad8ff, 0.5, 1.6, 2); L.position.set(x + 0.5, TOP + 0.5, y + 1.0); g.add(L);
  g.userData.stair = true;
  return g;
}
// a gate's wall (x0..x1, from row 1 to its face at row 4), its plaque from the art, the arch and the doors (or the open
// way up at scene 57's gate)
function gateWall(S, src, open) {
  const { M, glaze, cope, slate, arch, door, dark, step } = materials(), FZ = 4, X0 = 1, X1 = 7, CX = 4;
  const AX0 = 2.95, AX1 = 5.05, AR = (AX1 - AX0) / 2, SPRING = 1.25, T0 = 0.2;   // the arch: jambs to SPRING, then the round
  // the wall in pieces round the arch's opening; the opening's inside dark
  const hole = new THREE.Shape(); hole.moveTo(AX0 + T0, 0); hole.lineTo(AX1 - T0, 0); hole.lineTo(AX1 - T0, SPRING); hole.absarc(CX, SPRING, AR - T0, 0, Math.PI, false); hole.lineTo(AX0 + T0, 0);
  const face = new THREE.Shape(); face.moveTo(X0, 0); face.lineTo(X1, 0); face.lineTo(X1, GATE_H); face.lineTo(X0, GATE_H); face.lineTo(X0, 0); face.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(face, { depth: FZ - 1, bevelEnabled: false, curveSegments: 20 });
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);   // (world-scaled: the brick's 2 units)
  const wall = new THREE.Mesh(geo, glaze); wall.position.z = 1; S.add(shade(wall));
  S.add(shade(box(slate, X0, GATE_H, 1, X1, GATE_H + 0.06, FZ, 0.5)));
  S.add(shade(merged(cope, [box(cope, X0 - 0.12, GATE_H - 0.02, FZ - 0.1, X1 + 0.12, GATE_H + 0.12, FZ + 0.12, 1), box(cope, X0 - 0.12, GATE_H - 0.02, 1, X0 + 0.02, GATE_H + 0.12, FZ, 1), box(cope, X1 - 0.02, GATE_H - 0.02, 1, X1 + 0.12, GATE_H + 0.12, FZ, 1)])));
  S.add(shade(box(glaze, X0, DEEP, 1, X1, 0, FZ, 0.5)));   // (its footing, down into the abyss)
  // the arch: a ring of dressed stones springing from two jambs, a key-fret band on its face as drawn
  const ring = [], r0 = AR - T0 / 2;
  for (const px of [AX0, AX1 - T0]) ring.push(box(arch, px, 0, FZ - 0.04, px + T0, SPRING, FZ + 0.1, 1));
  for (let k = 0; k < 11; k++) { const a0 = Math.PI * k / 11, a1 = Math.PI * (k + 1) / 11, am = (a0 + a1) / 2, seg = new THREE.Mesh(new THREE.BoxGeometry(T0, r0 * (a1 - a0) - 0.015, 0.14), arch);
    seg.position.set(CX + Math.cos(am) * r0, SPRING + Math.sin(am) * r0, FZ + 0.03); seg.rotation.z = am; ring.push(seg); }
  S.add(shade(merged(arch, ring)));
  const inside = new THREE.Mesh(new THREE.ShapeGeometry(hole, 20), dark); inside.position.z = FZ - 1.2; S.add(inside);
  if (open) {   // scene 57: steps going up through the arch into the dark
    const st = []; for (let k = 0; k < 7; k++) st.push(box(step, AX0 + T0 + 0.02, 0, FZ - 1.2 + 0.0, AX1 - T0 - 0.02, 0.14 * (k + 1), FZ - k * 0.16, 1));
    S.add(shade(merged(step, st)));
  } else {   // the green doors, shut: two leaves with rows of gilt studs
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(), w = AR - T0, xa = s < 0 ? -w : 0, xb = s < 0 ? 0 : w;
      sh.moveTo(xa, 0); sh.lineTo(xb, 0); sh.lineTo(xb, SPRING); sh.absarc(0, SPRING, w, s < 0 ? Math.PI / 2 : 0, s < 0 ? Math.PI : Math.PI / 2, false); sh.lineTo(xa, 0);
      const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false, curveSegments: 12 }), door); leaf.position.set(CX + s * 0.008, 0, FZ - 0.18); S.add(shade(leaf));
      const studs = []; for (const yy of [0.35, 0.75, 1.15, 1.5]) for (let j = 1; j <= 2; j++) { const st = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.gold); st.position.set(CX + s * j * 0.3, yy, FZ - 0.08); studs.push(st); }
      S.add(shade(merged(M.gold, studs)));
    }
  }
  // the plaque: the art's own pixels of it, in a dark frame with a gilt edge
  const PX = 3.2 * 32, PY = 1.05 * 32, PW = 1.65 * 32, PH = 0.8 * 32, PYC = 3.45;
  const c = document.createElement('canvas'); c.width = PW * 4; c.height = PH * 4; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const img = new Image(); img.onload = () => { const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(img, PX, PY, PW, PH, 0, 0, c.width, c.height); t.needsUpdate = true; }; img.src = src;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(PW / 32, PH / 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0x0a1410 })); pl.position.set(CX, PYC, FZ + 0.06); S.add(pl);
  S.add(shade(box(M.gold, CX - PW / 64 - 0.08, PYC - PH / 64 - 0.07, FZ, CX + PW / 64 + 0.08, PYC + PH / 64 + 0.07, FZ + 0.035)));
  S.add(shade(box(M.lacquerDark, CX - PW / 64 - 0.05, PYC - PH / 64 - 0.04, FZ + 0.02, CX + PW / 64 + 0.05, PYC + PH / 64 + 0.04, FZ + 0.05)));
}

// ---------------------------------------------------------------- the set
// zhuxian(src): one room's set from its art (assets/battles/27/room-K.png, or a scene's map); gate: an 8-wide gate room;
// open: its arch open (scene 57)
let current = null;
export function zhuxian(src, o = {}) {
  const st = { built: false, K: null, H: null, at: null, chestG: new Map(), stairs: new Map(), world: null, MW: 0, MH: 0, u: null };
  async function build(E, FX) {
    const S = E.world.scene, m = materials(); st.world = E.world; st.chestG = new Map(); st.stairs = new Map(); current = st;
    const MW = st.MW = D.mapW, MH = st.MH = D.mapH, terr = D.terrain, scene = D.n === 'scene';
    const chests = scene ? [] : (G.chests || D.chests || []).filter(c => !c.hidden || c.open);   // (no chests in a story scene: the battle's only)
    const img = await pixels(src), gate = MW === 8;
    const P = plan(img, MW, MH, terr, chests, gate); st.K = P.K; st.H = P.H; st.at = P.at;
    const F = (x, y) => P.at(x, y) === 'F';
    // the floors: cobbles over a thin slab, on piers of glazed brick going down into the abyss (cut round each way on's well)
    st.holes = new Set(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (terr[y][x] === 4) st.holes.add(x + ',' + y);
    st.lay = () => {
      for (const o of st.floor || []) { S.remove(o); o.geometry.dispose(); }
      const tops = [], piers = [];
      const at = (x, y) => st.holes.has(x + ',' + y) ? 'H' : P.at(x, y);
      for (const [x0, z0, x1, z1] of rects(at, MW, MH, 'F')) { tops.push(box(m.cobble, x0, -SLAB, z0, x1, 0, z1, 0.5)); piers.push(box(m.glaze, x0, DEEP, z0, x1, -SLAB, z1, 0.5)); }
      for (const k of st.holes) { const [x, y] = k.split(',').map(Number), X0 = x + WELL.x0, X1 = x + WELL.x1, ZN = y + WELL.z0, ZS = y + WELL.z1;
        for (const [a, b, c, d] of [[x, y, X0, y + 1], [X1, y, x + 1, y + 1], [X0, y, X1, ZN], [X0, ZS, X1, y + 1]]) { tops.push(box(m.cobble, a, -SLAB, b, c, 0, d, 0.5)); piers.push(box(m.glaze, a, DEEP, b, c, -SLAB, d, 0.5)); }
        piers.push(box(m.glaze, X0, DEEP, ZN, X1, -WELL.d - 0.08, ZS, 0.5)); }   // (under the well's foot: solid)
      if (gate) piers.push(box(m.glaze, 0.75, DEEP, 4, 7.25, -SLAB, MH - (MH > 10 ? 2 : 0), 0.5));   // (the chamber's rim, as drawn either side of its floor)
      st.floor = [shade(worldUV(merged(m.cobble, tops), 0.5), false), shade(worldUV(merged(m.glaze, piers), 0.5))]; S.add(...st.floor);
    };
    st.lay();
    // the coping round each floor where it falls away to the abyss: a turquoise band at the pier's top
    const cope = [], edge = (x, y) => !F(x, y) && P.at(x, y) !== 'W';
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (F(x, y)) {
      if (edge(x, y + 1)) cope.push(box(m.cope, x - (edge(x - 1, y) ? 0.04 : 0), -0.2, y + 1 - 0.02, x + 1 + (edge(x + 1, y) ? 0.04 : 0), -0.01, y + 1.04, 1));
      if (edge(x - 1, y)) cope.push(box(m.cope, x - 0.04, -0.2, y, x + 0.02, -0.01, y + 1, 1));
      if (edge(x + 1, y)) cope.push(box(m.cope, x + 1 - 0.02, -0.2, y, x + 1.04, -0.01, y + 1, 1));
      if (edge(x, y - 1) && !(gate && y === 4)) cope.push(box(m.cope, x, -0.2, y - 0.04, x + 1, -0.01, y + 0.02, 1));
    }
    if (cope.length) S.add(shade(merged(m.cope, cope)));
    // the walls: glazed brick from the abyss to their height, slate on top, coped in turquoise round the top
    const walls = [], caps = [], copes = [];
    for (const [x0, z0, x1, z1] of rects(P.at, MW, MH, 'W', (x, y) => P.H[y][x])) {
      const h = P.H[z0][x0];
      walls.push(box(m.glaze, x0, DEEP, z0, x1, h, z1, 0.5)); caps.push(box(m.slate, x0 + 0.05, h, z0 + 0.05, x1 - 0.05, h + 0.03, z1 - 0.05, 0.5));
      const c0 = h - 0.03, c1 = h + 0.05, o = 0.03, w = 0.07;   // (a slim glazed coping, a hair proud of the face)
      copes.push(box(m.cope, x0 - o, c0, z1 - w, x1 + o, c1, z1 + o, 1), box(m.cope, x0 - o, c0, z0 - o, x1 + o, c1, z0 + w, 1),
        box(m.cope, x0 - o, c0, z0, x0 + w, c1, z1, 1), box(m.cope, x1 - w, c0, z0, x1 + o, c1, z1, 1));
    }
    if (walls.length) S.add(shade(worldUV(merged(m.glaze, walls), 0.5)), shade(merged(m.slate, caps)), shade(merged(m.cope, copes)));
    if (gate) gateWall(S, src, !!o.open);
    // the ways on and back, as drawn
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (terr[y][x] === 3 || terr[y][x] === 4) addStair(x, y, terr[y][x] === 4, st);
    for (const c of chests) { const g = chest(m.M, c.x + 0.5, c.y + 0.5, 0, !!c.open, 0, 1.4); S.add(g); st.chestG.set(c.x + ',' + c.y, g); }
    // the gate's chamber lit by two bronze lamps either side of the arch; elsewhere the cold light alone
    if (gate) for (const lx of [2.2, 5.8]) {
      S.add(shade(box(m.M.bronze, lx - 0.08, 1.8, 3.96, lx + 0.08, 2.25, 4.02)));
      FX.fire(E, { x: lx, y: 4.08, z: 2.32, size: 0.32, light: 4, col: 0xffa860, smoke: false });
    }
    st.u = abyss(S, MW / 2, MH / 2);
    E.world.updaters.push((dt, t) => { if (st.u) st.u.uTime.value = t; });
    st.built = true;
  }
  function ground(x, z) {
    if (!st.built) return 0;
    const cx = Math.floor(x), cy = Math.floor(z), k = st.at(cx, cy);
    if (k === 'F') return 0;
    if (k === 'W') return st.H[cy][cx];
    if (st.MW === 8 && o.open && x >= 3.15 && x < 4.85 && z >= 2.8 && z < 4) return 0.14 * Math.min(7, Math.ceil((4 - z) / 0.16));   // (scene 57: the steps up through the open arch, where 申公豹 stands)
    if (st.MW === 8 && cy >= 1 && cy < 4 && x >= 1 && x < 7) return GATE_H;
    return VOID;
  }
  function openChest(x, y) {
    const g = st.chestG.get(x + ',' + y), S = st.world && st.world.scene; if (!S) return;
    if (g) S.remove(g);
    const c = chest(materials().M, x + 0.5, y + 0.5, 0, true, 0, 1.4); S.add(c); st.chestG.set(x + ',' + y, c);
  }
  return {
    build, ground, openChest, particles: null,
    get props() { return [...st.stairs.keys()].map(k => k.split(',').map(Number)); },
    mood: { bg: 0x02040a, voidCol: false, fog: 0x050a16, fogD: 0.016, sky: 0xa8c4ee, under: 0x0c2230, hemi: 0.95,
      sun: 0xd4e4ff, sunI: 2.3, sunDir: [-0.45, 0.82, 0.38], sat: 0.98, exposure: 1.02, bloom: 0.3, aoR: 0.8,
      env: { top: 0x5a7ab0, mid: 0x1e3050, low: 0x04080e, lights: [[-6, 7, 4, 0xdce8ff, 3.5], [6, 1, -5, 0x40c0d0, 1.6]] } },
  };
}
// a way on (down) or back (up), as drawn; or a way on drawn where there was none (battle 27's gates, 0x0FA9C6: under the
// first hero, once the chamber is cleared: the floor is cut afresh round its well); returns its group to play its coming
export function addStair(x, y, down = true, st = current) {
  if (!st || !st.world || st.stairs.has(x + ',' + y)) return null;
  if (down && !st.holes.has(x + ',' + y)) { st.holes.add(x + ',' + y); st.lay(); }
  const g = down ? well(x, y) : stair(x, y); st.world.scene.add(g); st.stairs.set(x + ',' + y, g);
  return g;
}
const art = k => k ? 'assets/battles/27/room-' + k + '.png' : 'assets/battles/27/map.png';
export const zhuxianRooms = Array.from({ length: 13 }, (_, k) => zhuxian(art(k)));
export const zhuxianGate = zhuxian('assets/maps/0fa6a8.png', { open: true });
export const zhuxianOuter = zhuxian('assets/maps/0fa6f4.png'), zhuxianHall = zhuxian('assets/maps/0fa70c.png');
