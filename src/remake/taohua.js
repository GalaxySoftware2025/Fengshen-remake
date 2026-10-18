// The temple in 桃花林 (map 0f48ca: scene 36; battle 18's second room, the 守護靈's hall), remade: platforms of golden
// brick hanging in a black void, measured on tools/qa/grid.py 0f48ca:
//   the walkway   rows 10-12 (x 4-21), its front faced in brick down into the dark, entered up the causeway at x 11-14
//                 (rows 13-14) from the south
//   the wings     x 4-7 and 18-21, rows 4-12, each with a chest at its head ((6, 4), (18, 4)); chains hang from their outer
//                 sides into the void
//   the altar     a raised block of the golden brick (x 8.3-16.7, rows 1-7), its top (x 9-16, rows 1-6) up a broad stair
//                 (x 11-14, rows 6-10); the chest at (12, 1) on top
//   the back      a wall of grey stone (row 0) carved with clouds, five golden figures in niches along it (x 0.5, 3.5, 6.5,
//                 18.5, 21.5)
// Dim, warm light from the figures and the gold.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { D, G } from '../rules.js';

const MW = 24, MH = 15, TOP = 1.1, BASE = -9;
const FLOORS = [[4, 4, 7, 13], [18, 4, 21, 13], [4, 10, 21, 13], [11, 13, 14, 15]];
const FIGURES = [0.55, 3.5, 6.5, 18.5, 21.5];
let LV = null, M = null, world = null, chestG = new Map();
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function levels() {
  const L = new Levels(MW, MH, 4);
  for (const [x0, z0, x1, z1] of FLOORS) L.set(x0, z0, x1, z1, 0);
  L.set(8.25, 1, 16.75, 7, TOP).set(11, 6, 14, 10, 0);
  L.stairs(11, 6, 14, 10, 0, TOP, 10, 's');
  return L;
}
// the grey wall's carving: blocks of stone, swirling clouds in low relief
function cloudWall() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#8a8a7c'; g.fillRect(0, 0, 1024, 256);
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < 1024; x += 48) { g.fillStyle = `rgba(${R(x + y) < 0.5 ? '40,40,34' : '200,200,186'},0.12)`; g.fillRect(x + 1, y + 1, 46, 30); g.strokeStyle = 'rgba(30,30,26,0.55)'; g.strokeRect(x + 0.5, y + 0.5, 47, 31); }
  for (let k = 0; k < 14; k++) {   // the clouds: curling bands of pale stone, a dark under-edge
    const cx = R(k) * 1024, cy = 50 + R(k + 3) * 150, s = 18 + R(k + 7) * 16;
    for (const [col, dy] of [['rgba(40,40,32,0.5)', 3], ['rgba(225,222,206,0.85)', 0]]) {
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath();
      for (let t = 0; t < 9.5; t += 0.08) { const r = s * (1 - t / 12), x = cx + Math.cos(t) * r + t * 6, y = cy + dy + Math.sin(t) * r * 0.6; t ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.anisotropy = 8; return t;
}
// a golden figure in its niche: a robed standing form, hands joined, a halo behind its head, on a lotus base
function figure(gold, x) {
  const g = new THREE.Group(), robe = new THREE.LatheGeometry([[0, 0], [0.28, 0], [0.3, 0.06], [0.22, 0.12], [0.24, 0.5], [0.2, 1.0], [0.16, 1.3], [0.12, 1.42], [0, 1.44]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  g.add(new THREE.Mesh(robe, gold));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), gold); head.position.y = 1.56; g.add(head);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), gold); knot.position.y = 1.72; g.add(knot);
  const hands = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold); hands.position.set(0, 1.1, 0.2); g.add(hands);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xc08020, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }));
  halo.position.set(0, 1.58, -0.12); g.add(halo);
  const lotus = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.14, 16), gold); lotus.position.y = -0.05; g.add(lotus);
  g.position.set(x, 0.55, 0.85); return shade(g);
}
// a chain hanging from a platform's side into the dark: oval links, each turned a quarter from the last
function chainLinks(link, a, b, n) {
  const out = [], d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), link); m.position.copy(a).addScaledVector(d, (k + 0.5) / n); m.quaternion.copy(q); m.rotateY(k % 2 ? Math.PI / 2 : 0); m.scale.set(1, 1.5, 1); out.push(m); }
  return out;
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map(); LV = levels();
  const brick = T.material(T.bricks(0xc89820, 4, 'goldBrick'), { color: 0xfff0c0, metalness: 0.25, roughness: 0.5 }, [1, 1]);
  const brickTop = T.material(T.bricks(0xd8a828, 2, 'goldFloor'), { color: 0xffe8b0, metalness: 0.2, roughness: 0.55 }, [1, 1]);
  const face = T.material(T.bricks(0x8a6418, 4, 'goldFace'), { color: 0xe8d098, metalness: 0.15, roughness: 0.6 }, [0.5, 0.5]);
  S.add(LV.mesh(brickTop, face, BASE, 1));
  for (const r of LV.ramps) S.add(stairs(r, brickTop, face, 0.5));
  // the stair's golden rails, the altar's top edge lit
  const gold = T.material(T.gold(), { envMapIntensity: 1.3 });
  for (const x of [10.9, 14.1]) { const rl = box(gold, x - 0.08, 0, 6.2, x + 0.08, 0.2, 10, 1); rl.geometry.translate(0, 0, 0); S.add(shade(rl)); }
  S.add(shade(box(gold, 8.2, TOP, 6.92, 16.8, TOP + 0.08, 7.04, 1)));
  // the back wall, its niches and figures
  const wall = new THREE.MeshStandardMaterial({ map: cloudWall(), roughness: 0.9 });
  const wm = new THREE.Mesh(new THREE.BoxGeometry(30, 4.6, 0.5), [wall, wall, wall, wall, wall, wall]); wm.position.set(12, 1.8, 0.25); S.add(shade(wm));
  S.add(shade(box(new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 1 }), -3, -0.2, 0.4, 27, 0.55, 1.3, 1)));   // the ledge along its foot
  const niche = new THREE.MeshStandardMaterial({ color: 0x14100a, roughness: 1 }), frame = new THREE.MeshStandardMaterial({ color: 0xe8e4d4, roughness: 0.7 });
  for (const x of FIGURES) {
    S.add(box(niche, x - 0.42, 0.55, 0.49, x + 0.42, 2.55, 0.52));
    for (const [a, b] of [[x - 0.5, x - 0.42], [x + 0.42, x + 0.5]]) S.add(shade(box(frame, a, 0.55, 0.45, b, 2.6, 0.6)));
    S.add(shade(box(frame, x - 0.5, 2.55, 0.45, x + 0.5, 2.68, 0.6)));
    S.add(figure(gold, x));
    const L = new THREE.PointLight(0xffc870, 1.6, 3.5, 1.6); L.position.set(x, 1.8, 1.4); S.add(L);
  }
  // chains from the wings' outer sides down into the void
  const link = new THREE.MeshStandardMaterial({ color: 0x6a4a20, metalness: 0.6, roughness: 0.5 }), links = [];
  for (const [x, z, dx] of [[4, 5.5, -1], [4, 8.6, -1], [4, 11.6, -1], [21, 5.5, 1], [21, 8.6, 1], [21, 11.6, 1], [7.05, 5.8, 1], [17.95, 5.8, -1]]) {
    const a = new THREE.Vector3(x, -0.05, z), b = new THREE.Vector3(x + dx * 1.6, -2.6, z + 0.9); links.push(...chainLinks(link, a, b, 14));
  }
  S.add(shade(merged(link, links)));
  const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false }));
  for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, LV.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(o); chestG.set(c.x + ',' + c.y, o); }
  const glow = new THREE.PointLight(0xffd890, 4, 12, 1.4); glow.position.set(12.5, 3.5, 4); S.add(glow);
  void FX;
}
function openChest(x, y) {
  const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
  const p = g ? g.position : new THREE.Vector3(x + 0.5, LV.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
}
// the solid tops: the platforms and the altar; the void far below; the wall and its ledge
function ground(x, z) {
  if (z < 0.5) return 4.1;
  if (z < 1.3 && (x < 8.25 || x >= 16.75)) return 0.55;
  if (!LV) return 0;
  const R4 = 4, i = Math.floor(x * R4), j = Math.floor(z * R4), v = i >= 0 && j >= 0 && i < MW * R4 && j < MH * R4 ? LV.H[j * MW * R4 + i] : NaN;
  return isNaN(v) && !LV.ramps.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) ? BASE : LV.at(x, z);
}
// scene 36: the 古文書 the 南方守護靈 gives, the original drawing it with 黃飛虎's unit (slot 3, sheet 0581c4: he is not
// there) as a glowing blue tablet that floats down the stair to the heroes (f94-188); the 守護靈 itself (0bb674, a
// flickering phantom) is no longer drawn from f192 [test/oracle.mjs: the original's own sprites]
let tablet = null;
const standIn = {
  '0581c4': (E, x, z) => {
    if (!tablet || tablet.parent !== E.world.scene) {
      tablet = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0x6ab8ff, emissive: 0x2a78e8, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.08), m); b.position.y = 0.55; tablet.add(b);
      const L = new THREE.PointLight(0x6ab8ff, 2.2, 3, 1.6); L.position.y = 0.6; tablet.add(L);
      E.world.scene.add(tablet);
    }
    tablet.visible = true; tablet.position.set(x, ground(x, z) + 0.12 * Math.sin(E.gameT * 2.4), z); tablet.rotation.y = E.gameT * 0.8;
  },
  '0bb674': (E, x, z, moving, ctx) => ctx.tag === '36' && ctx.t >= 192 ? undefined : false,
  hide: (E, gfx) => { if (gfx === '0581c4' && tablet) tablet.visible = false; },
};
const STAIR_CELLS = [6, 7, 8, 9].flatMap(y => [[11, y], [12, y], [13, y]]);
export const peachShrine = {
  build, openChest, ground, slopes: STAIR_CELLS, standIn,
  mood: { bg: 0x000000, voidCol: 0x000000, voidY: BASE, fog: 0x050302, fogD: 0.03, sky: 0xffe0a0, under: 0x2a1a06, hemi: 0.7,
    sun: 0xffe6b8, sunI: 1.9, sunDir: [-0.3, 0.9, 0.4], sat: 1.05, exposure: 1.1, bloom: 0.5, aoR: 0.8,
    env: { top: 0x8a6a30, mid: 0x3a2a10, low: 0x050302, lights: [[0, 6, 3, 0xffe0a0, 4]] } },
};
