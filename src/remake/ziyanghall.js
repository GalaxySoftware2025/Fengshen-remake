// 紫陽觀's hall (map 0ed622: scene 17, 姜文煥 and the heroes talk the night through), remade: a plank floor of warm
// timber between gilt-and-red skirting, the shrine at the back (a gilt alcove, the great scroll 禪, a grey stone sage on
// his seat between two drum cabinets, a marble step before it, a red rug with a gold key border), two orange lacquer
// columns, ink-bamboo scrolls on the plaster wall, a marble side table with potted bamboo and a dish of fruit, a green
// chest, a bookcase, and four chairs down each side wall facing in. The room narrows to a passage south (3-5, rows 8-9).
// Everything else is dark. Measured on tools/qa/grid.py 0ed622; the cast stands on rows 3-6 between the chairs (the
// sage's step (3-5, 2.8-3.4) is low: 姜文煥 starts at (3, 3)).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, shade, merged, latticeWall } from '../kit/parts.js';

const WALL = 1.95, WALL_H = 2.7;   // the back wall's face (z) and height
function decal(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a hanging scroll: silk mounting, a paper panel with ink bamboo (or the one great character), rollers top and bottom
function scroll(x, z, y, w, h, paint) {
  const g = new THREE.Group();
  const tex = decal((c, W, H) => {
    c.fillStyle = '#3a6a3a'; c.fillRect(0, 0, W, H); c.fillStyle = '#f2ead6'; c.fillRect(W * 0.08, H * 0.1, W * 0.84, H * 0.8);
    c.strokeStyle = '#1a1a1a'; c.fillStyle = '#1a1a1a'; paint(c, W, H);
  }, 256, 512);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  m.position.set(x, y + h / 2, z); g.add(m);
  const rod = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.5 });
  for (const yy of [y, y + h]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, w + 0.12, 8).rotateZ(Math.PI / 2), rod); r.position.set(x, yy, z + 0.02); g.add(r); }
  return shade(g);
}
const inkBamboo = (c, W, H) => {
  c.lineWidth = 7; for (const x of [0.35, 0.55]) { c.beginPath(); c.moveTo(W * x, H * 0.85); c.lineTo(W * (x + 0.03), H * 0.15); c.stroke();
    for (let k = 0; k < 5; k++) { const y = H * (0.2 + k * 0.13); c.fillRect(W * x - 6, y, 14, 3); } }
  c.lineWidth = 3; for (let k = 0; k < 9; k++) { const x = W * (0.4 + Math.sin(k) * 0.12), y = H * (0.2 + k * 0.07); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 30, y - 6, x + 50 * (k % 2 ? 1 : -1), y + 18); c.stroke(); }
  c.fillStyle = '#b02010'; c.fillRect(W * 0.7, H * 0.78, 14, 14);   // the seal
};
const greatChar = (c, W, H) => { c.font = `bold ${W * 0.62}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('禪', W / 2, H * 0.48); c.fillStyle = '#b02010'; c.fillRect(W * 0.62, H * 0.8, 16, 16); };
// the rug: red with a gold key-fret border
function rugTex() {
  return decal((c, W, H) => {
    c.fillStyle = '#b8160e'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8b030'; c.lineWidth = 6;
    c.strokeRect(14, 14, W - 28, H - 28); c.lineWidth = 4; c.strokeRect(30, 30, W - 60, H - 60);
    for (const [x, y] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) { c.beginPath(); c.moveTo(x - 18 * Math.sign(x - W / 2), y); c.lineTo(x - 18 * Math.sign(x - W / 2), y - 18 * Math.sign(y - H / 2)); c.lineTo(x, y - 18 * Math.sign(y - H / 2)); c.stroke(); }
  }, 512, 256);
}
// a chair: a dark wooden frame, a slatted back, a pale cushion; facing +x (west wall) or -x
function chair(wood, cush, x, z, face) {
  const g = new THREE.Group(), parts = [];
  for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) parts.push(box(wood, a - 0.03, 0, b - 0.03, a + 0.03, 0.42, b + 0.03));
  parts.push(box(wood, -0.24, 0.38, -0.24, 0.24, 0.44, 0.24));
  for (const b of [-0.18, 0, 0.18]) parts.push(box(wood, -0.24, 0.44, b - 0.025, -0.2, 0.95, b + 0.025));
  parts.push(box(wood, -0.25, 0.92, -0.25, -0.19, 0.98, 0.25));
  g.add(merged(wood, parts), box(cush, -0.2, 0.44, -0.2, 0.22, 0.5, 0.2));
  g.rotation.y = face > 0 ? 0 : Math.PI; g.position.set(x, 0, z); return shade(g);
}
// the sage: a grey stone figure seated on a square seat, robe falling in folds, hands joined, a long beard and topknot
function sage(stone, x, z, y) {
  const g = new THREE.Group();
  g.add(box(stone, -0.32, 0, -0.28, 0.32, 0.32, 0.28, 2));
  const robe = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0.32], [0.34, 0.32], [0.3, 0.55], [0.22, 0.8], [0.16, 0.95], [0, 0.98]].map(([r, h]) => new THREE.Vector2(r, h)), 16), stone); g.add(robe);
  const lap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), stone); lap.scale.set(1.3, 0.5, 1); lap.position.set(0, 0.44, 0.18); g.add(lap);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), stone); head.position.set(0, 1.08, 0.02); g.add(head);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), stone); knot.position.set(0, 1.22, -0.02); g.add(knot);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 10), stone); beard.rotation.x = Math.PI; beard.position.set(0, 0.88, 0.11); g.add(beard);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), stone); arm.rotation.set(1.2, 0, s * 0.5); arm.position.set(s * 0.12, 0.7, 0.14); g.add(arm); }
  g.position.set(x, y, z); return shade(g);
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const floorM = T.material(T.planks(0xb8682c, 5), { roughness: 0.55, envMapIntensity: 0.6 }, [0.5, 0.5]);
  const trimRed = T.material(T.lacquer(0x7a1408, 'trimRed'), { clearcoat: 0.5 }), gold = M.gold;
  const plaster = T.material(T.plaster(0xe8d8b8), {}, [0.7, 0.7]), dado = T.material(T.bricks(0x8a9a88, 2, 'dadoStone'), {}, [1, 1]);
  const orange = T.material(T.lacquer(0xd07a1c, 'orangeLacquer'), { clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 1.1 });
  const marble = T.material(T.marble(0xece8e0, 0x9a948a), { roughness: 0.3 }), dark = T.material(T.wood(0x2a1a12, 'chairWood'), {});
  const stone = T.material(T.rock(0x9a9a9a, 'sageStone', 0.15), { color: 0xd8d8d8, roughness: 0.6 });
  // the floor: the room (0.95-7.05, 1.9-8) and the passage south (3-5, 8-10.6)
  S.add(shade(box(floorM, 0.95, -0.3, 1.9, 7.05, 0, 8.0, 0.5), false), shade(box(floorM, 3.0, -0.3, 7.9, 5.0, 0, 10.8, 0.5), false));
  // the skirting: a red rail, a gold line on it, round the room's edge and down the passage
  const rails = [[0.62, 1.9, 0.95, 8.15], [7.05, 1.9, 7.38, 8.15], [0.62, 7.85, 3.0, 8.15], [5.0, 7.85, 7.38, 8.15], [2.7, 8.15, 3.0, 10.8], [5.0, 8.15, 5.3, 10.8]];
  for (const [a, b, c, d] of rails) S.add(shade(box(trimRed, a, -0.3, b, c, 0.14, d)), shade(box(gold, a + 0.06, 0.14, b + 0.06, c - 0.06, 0.17, d - 0.06)));
  // the back wall: plaster over a grey-green dado, with the shrine's alcove between 3 and 5
  for (const [a, b] of [[0.62, 3.0], [5.0, 7.38]]) {
    S.add(shade(box(dado, a, 0, WALL - 0.3, b, 0.55, WALL, 2)), shade(box(plaster, a, 0.55, WALL - 0.3, b, WALL_H, WALL - 0.05, 2)));
    S.add(shade(box(trimRed, a, WALL_H, WALL - 0.32, b, WALL_H + 0.12, WALL + 0.02)));
  }
  S.add(scroll(2.2, WALL - 0.02, 0.9, 0.42, 1.3, inkBamboo), scroll(5.75, WALL - 0.02, 0.9, 0.42, 1.3, inkBamboo));
  // the shrine: a gilt-panelled alcove, the great scroll, the sage on his seat between two red drum cabinets
  S.add(shade(box(orange, 3.0, 0, 0.6, 5.0, WALL_H + 0.2, 0.75, 2)), shade(box(orange, 2.95, 0, 0.6, 3.1, WALL_H + 0.2, WALL + 0.01, 2)), shade(box(orange, 4.9, 0, 0.6, 5.05, WALL_H + 0.2, WALL + 0.01, 2)));   // (the frame 1 cm proud of the wall: flush with the dado, they flickered)
  S.add(shade(box(gold, 3.0, WALL_H + 0.2, 0.55, 5.05, WALL_H + 0.32, WALL)));
  S.add(scroll(4.0, 0.77, 1.0, 0.8, 1.55, greatChar));
  S.add(shade(box(orange, 3.1, 0, 1.4, 4.9, 0.35, 2.75, 2)), shade(box(gold, 3.1, 0.35, 1.4, 4.9, 0.38, 2.75)));   // the platform
  S.add(sage(stone, 4.0, 1.95, 0.38));
  for (const x of [3.42, 4.58]) {   // the drum cabinets: red lacquer, a gold ring on the front
    S.add(shade(box(M.lacquer, x - 0.22, 0.38, 2.05, x + 0.22, 0.86, 2.5)));
    const ring = shade(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), gold)); ring.position.set(x, 0.62, 2.51); S.add(ring);
  }
  S.add(shade(box(marble, 3.05, 0, 2.75, 4.95, 0.12, 3.4)));   // the marble step, low enough to stand on
  for (const x of [3.08, 4.92]) { const p = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10), orange)); p.position.set(x, 0.27, 2.95); S.add(p); }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 0.95 }));
  rug.position.set(4.0, 0.01, 4.0); rug.receiveShadow = true; S.add(rug);
  // the columns before the back wall
  for (const x of [1.48, 6.48]) {
    const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, WALL_H + 0.1, 32), orange)); c.position.set(x, (WALL_H + 0.1) / 2, 2.1); S.add(c);
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 32), gold)); b.position.set(x, 0.08, 2.1); S.add(b);
  }
  // the side table (marble on dark legs) with potted bamboo and a dish of fruit; the green chest; the bookcase
  S.add(shade(box(dark, 2.05, 0, 2.35, 2.95, 0.5, 3.15)), shade(box(marble, 2.0, 0.5, 2.3, 3.0, 0.56, 3.2)));
  for (const [x, z] of [[2.3, 2.55], [2.6, 2.75]]) {
    const pot = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.3 }))); pot.position.set(x, 0.64, z); S.add(pot);
    for (let k = 0; k < 3; k++) { const st = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x4a8a2a }))); st.position.set(x + (k - 1) * 0.02, 0.97, z); st.rotation.z = (k - 1) * 0.15; S.add(st);
      const lf = shade(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a8a24, roughness: 0.7 }))); lf.scale.set(1.4, 0.5, 0.8); lf.position.set(x + (k - 1) * 0.08, 1.05 + k * 0.08, z); S.add(lf); }
  }
  const dish = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.03, 16), gold)); dish.position.set(2.35, 0.58, 2.95); S.add(dish);
  for (let k = 0; k < 5; k++) { const f = shade(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf08a20, roughness: 0.5 }))); f.position.set(2.35 + Math.cos(k * 1.3) * 0.06, 0.63 + (k === 4 ? 0.05 : 0), 2.95 + Math.sin(k * 1.3) * 0.06); S.add(f); }
  const green = T.material(T.lacquer(0x2a7a3a, 'greenLacquer'), { clearcoat: 0.6 });
  S.add(shade(box(green, 1.02, 0, 2.3, 1.72, 0.62, 2.95)), shade(box(gold, 1.0, 0.3, 2.28, 1.74, 0.36, 2.97)), shade(box(gold, 1.0, 0.62, 2.28, 1.74, 0.66, 2.97)));
  const shelfWood = T.material(T.wood(0x5a3a22, 'shelfWood'), {});
  S.add(shade(box(shelfWood, 5.05, 0, 2.0, 6.0, 1.15, 2.2)), shade(box(shelfWood, 5.05, 0, 2.0, 5.1, 1.15, 3.2)), shade(box(shelfWood, 5.95, 0, 2.0, 6.0, 1.15, 3.2)));
  for (const y of [0.05, 0.55, 1.1]) S.add(shade(box(shelfWood, 5.05, y, 2.0, 6.0, y + 0.05, 3.2)));
  const books = []; for (let k = 0; k < 14; k++) { const x = 5.15 + (k % 7) * 0.12, y = k < 7 ? 0.1 : 0.6; books.push(box(new THREE.MeshStandardMaterial({ color: [0x8a6a3a, 0x3a5a6a, 0x6a2a1a, 0xc8b890][k % 4] }), x, y, 2.3 + (k % 3) * 0.05, x + 0.09, y + 0.3 + (k % 3) * 0.06, 3.05)); }
  for (const b of books) S.add(shade(b));
  // the chairs down both walls, facing in
  const cush = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 });
  for (const z of [4.65, 5.4, 6.1, 7.0]) S.add(chair(dark, cush, 1.25, z, 1), chair(dark, cush, 6.75, z, -1));
  FX.glow(E, { x: 4.0, y: 2.6, r: 1.8, col: 0xffc070, i: 1.6 });
  // the walls round it [design: the original draws the hall alone on black; here the hall stands in its building, the
  // night outside]: lattice side walls lit from within, low walls either side of the passage (south of the cast), the
  // back wall running on into the dark, a dim stone courtyard beyond
  for (const [x, sg] of [[0.6, 1], [7.4, -1]]) { const w = latticeWall(M, 0, 6.0, 0, 0, WALL_H, 4); w.rotation.y = sg * Math.PI / 2; w.position.set(x, 0, sg > 0 ? 7.95 : 1.95); S.add(shade(w)); }
  const low = T.material(T.plaster(0xd8c8a8), {}, [0.7, 0.7]);
  for (const [a, b, c, d] of [[0.5, 8.0, 2.7, 8.25], [5.3, 8.0, 7.5, 8.25], [2.45, 8.25, 2.7, 10.8], [5.3, 8.25, 5.55, 10.8]]) S.add(shade(box(low, a, 0, b, c, 0.5, d)), shade(box(trimRed, a - 0.02, 0.5, b - 0.02, c + 0.02, 0.58, d + 0.02)));
  for (const [a, b] of [[-9, 0.5], [7.5, 17]]) S.add(shade(box(plaster, a, 0, WALL - 0.6, b, WALL_H, WALL - 0.3, 2)), shade(box(trimRed, a, WALL_H, WALL - 0.62, b, WALL_H + 0.12, WALL - 0.28)));
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(40, 20).rotateX(-Math.PI / 2), T.material(T.bricks(0x3a3a40, 2, 'yardStone'), { color: 0x6a6a70 }, [20, 10]));
  yard.position.set(4, -0.02, 10); yard.receiveShadow = true; S.add(yard);
}

export default {
  build, ground: () => 0, particles: 'dust',
  props: [[1, 2], [2, 2], [5, 2], [3, 2], [4, 2]],
  // lamplight in the hall at night: a warm glow from the shrine, the rest falling off into the dark
  mood: { bg: 0x0a0806, voidCol: 0x0a0806, voidY: -1.2, fog: 0x0a0806, fogD: 0.03, sky: 0xffe0b0, under: 0x2a1a0a, hemi: 0.75,
    sun: 0xffd8a8, sunI: 1.6, sunDir: [-0.2, 0.9, 0.45], sat: 1.04, exposure: 1.1, bloom: 0.42,
    env: { top: 0x8a6a48, mid: 0x4a3420, low: 0x1a1008, lights: [[0, 6, -8, 0xfff0d0, 5], [-6, 4, 2, 0xffc080, 3], [6, 4, 2, 0xffc080, 3]] } },
  lights: [{ x: 4, y: 2.4, z: 5.0, col: 0xffb878, i: 4, d: 8 }],
};
