// 西伯侯's divination room (map 002498), remade: a raised floor of green glazed tiles, a brown rug with the bagua inlaid
// in gold, the low desk with books and a cushion behind it, tiger skins either side, scroll cabinets with cushions down
// both sides, a lattice folding screen between gold curtains, purple lacquer columns and walls, celadon vases.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, pillar, latticeWall, curtain, screen, stairs, shade, V3 } from '../kit/parts.js';
import { moneyTree, treeState } from '../kit/moneytree.js';

const UP = 0.22;   // the room's raised north part (rows 0-9); the step runs right across at row 9
function levels() { const L = new Levels(8, 15, 4); L.set(0, 0, 8, 9, UP).set(0, 9, 8, 15, 0); L.stairs(0, 8.7, 8, 9.3, 0, UP, 2, 's'); return L; }
const LV = levels();

function decal(draw, n = 512) {
  const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// the bagua: eight trigrams in a ring round the taiji, gold inlay with a dark ground ring
const BAGUA = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]];
function baguaTex() {
  return decal((g, n) => {
    const c = n / 2; g.translate(c, c);
    g.strokeStyle = '#d8b25a'; g.fillStyle = '#d8b25a';
    for (const [r, w] of [[0.48, 6], [0.44, 2], [0.24, 3], [0.2, 2]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r * n, 0, 7); g.stroke(); }
    BAGUA.forEach((tri, k) => {
      g.save(); g.rotate(k * Math.PI / 4); for (let l = 0; l < 3; l++) {
        const y = -(0.27 + l * 0.05) * n, w = 0.13 * n;
        if (tri[l]) g.fillRect(-w / 2, y, w, 0.03 * n); else { g.fillRect(-w / 2, y, w * 0.42, 0.03 * n); g.fillRect(w * 0.08, y, w * 0.42, 0.03 * n); }
      } g.restore();
    });
    const R = 0.17 * n; g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); g.arc(0, R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.fill();
    g.beginPath(); g.arc(0, 0, R, 0, 7); g.lineWidth = 3; g.stroke();
    g.fillStyle = '#3a2410'; g.beginPath(); g.arc(0, -R / 2, R * 0.13, 0, 7); g.fill(); g.fillStyle = '#d8b25a'; g.beginPath(); g.arc(0, R / 2, R * 0.13, 0, 7); g.fill();
  }, 1024);
}
function tigerTex() {
  return decal((g, n) => {
    const path = new Path2D(); const c = n / 2;
    // a pelt: body with four splayed legs, head at the bottom, a tail curling up
    path.ellipse(c, c, n * 0.2, n * 0.28, 0, 0, 7);
    for (const [x, y, a] of [[-1, -1, -0.6], [1, -1, 0.6], [-1, 1, 0.5], [1, 1, -0.5]]) { const p = new Path2D(); p.ellipse(c + x * n * 0.24, c + y * n * 0.18, n * 0.16, n * 0.06, a, 0, 7); path.addPath(p); }
    const head = new Path2D(); head.ellipse(c, c + n * 0.33, n * 0.11, n * 0.1, 0, 0, 7); path.addPath(head);
    g.fillStyle = '#e08a2a'; g.fill(path); g.save(); g.clip(path);
    g.fillStyle = '#f6d8a0'; g.beginPath(); g.ellipse(c, c, n * 0.08, n * 0.22, 0, 0, 7); g.fill();
    g.strokeStyle = '#1a0c06'; g.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const y = c - n * 0.32 + i * n * 0.045, w = 6 + (i % 3) * 3; g.lineWidth = w; g.beginPath(); g.moveTo(c - n * 0.3, y + 8); g.quadraticCurveTo(c - n * 0.12, y - 10, c - n * 0.04, y + 4); g.stroke(); g.beginPath(); g.moveTo(c + n * 0.3, y + 8); g.quadraticCurveTo(c + n * 0.12, y - 10, c + n * 0.04, y + 4); g.stroke(); }
    g.restore();
    g.fillStyle = '#1a0c06'; for (const x of [-1, 1]) { g.beginPath(); g.arc(c + x * n * 0.04, c + n * 0.34, 5, 0, 7); g.fill(); }
  });
}
function flat(tex, w, h, x, y, z, rot = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }, o)));
  m.rotation.y = rot; m.position.set(x, y, z); m.receiveShadow = true; return m;
}
function cushion(x, z, y, mat, button) {
  const g = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 24), mat); c.scale.y = 1; c.position.y = 0.06; g.add(c);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 8, 0, 6.3, 0, 0.5), mat); top.position.y = 0.06; top.scale.y = 0.35; g.add(top);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), button); b.position.y = 0.17; g.add(b);
  g.position.set(x, y, z); return shade(g);
}
function vase(x, z, y) {
  const g = new THREE.Group(), cel = T.material(T.jade(0x8ab89a), { clearcoat: 0.9, clearcoatRoughness: 0.1 });
  g.add(shade(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.24, 0.12], [0.27, 0.32], [0.2, 0.52], [0.1, 0.62], [0.09, 0.72], [0.13, 0.78], [0, 0.78]].map(([a, b]) => new THREE.Vector2(a, b)), 32), cel)));
  // a spray of plum blossom: dark twigs, pink flowers
  const twig = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 }), bloom = new THREE.MeshStandardMaterial({ color: 0xf0a0b0, roughness: 0.6, emissive: 0x401018 });
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9, len = 0.4 + (k % 3) * 0.15, dir = V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.4).normalize();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, len, 5), twig); t.position.copy(dir.clone().multiplyScalar(len / 2)).add(V3(0, 0.76, 0)); t.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); g.add(t);
    for (let f = 0; f < 4; f++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bloom); b.position.copy(dir.clone().multiplyScalar(len * (0.4 + f * 0.2))).add(V3(0.03 * Math.sin(f * 3), 0.76, 0.03 * Math.cos(f * 2))); g.add(b); }
  }
  g.position.set(x, y, z); return shade(g);
}
// a scroll cabinet: a gilt-lacquer stand with rolled scrolls in pigeonholes
function cabinet(M, x, z, y) {
  const g = new THREE.Group(), body = T.material(T.lacquer(0xc07a1a, 'amberLacquer'), { clearcoat: 0.6 });
  g.add(box(body, -0.22, 0, -0.18, 0.22, 0.62, 0.18), box(M.gold, -0.24, 0.62, -0.2, 0.24, 0.66, 0.2), box(M.jade, -0.24, 0, -0.2, 0.24, 0.08, 0.2));
  const paper = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), paper); s.rotation.z = Math.PI / 2; s.scale.y = 0.55; s.position.set(-0.09 + c * 0.18, 0.18 + r * 0.15, 0.02); g.add(s); }
  g.add(box(new THREE.MeshStandardMaterial({ color: 0x1a0c06 }), -0.2, 0.1, 0.17, 0.2, 0.58, 0.185));
  g.position.set(x, y, z); return shade(g);
}
// the low desk: black lacquer with a gilt edge, bamboo-slip books, an inkstone and a brush rest
function desk(M, x, z, y) {
  const g = new THREE.Group(), black = T.material(T.lacquer(0x2a1410, 'blackLacquer'), { clearcoat: 0.8, clearcoatRoughness: 0.15 });
  g.add(box(black, -0.75, 0.32, -0.35, 0.75, 0.4, 0.35), box(M.gold, -0.77, 0.36, -0.37, 0.77, 0.38, 0.37));
  for (const sx of [-1, 1]) g.add(box(black, sx * 0.68 - 0.06, 0, -0.32, sx * 0.68 + 0.06, 0.32, 0.32));
  const slips = T.material(T.planks(0xc8a868, 12), {});
  for (let k = 0; k < 3; k++) { const b = box(slips, -0.6 + k * 0.05, 0.4 + k * 0.04, -0.2, -0.15 + k * 0.05, 0.44 + k * 0.04, 0.12); b.rotation.y = 0.05 * k; g.add(b); }
  const ink = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.16), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.3 })); ink.position.set(0.35, 0.42, 0); g.add(ink);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 })); roll.rotation.z = Math.PI / 2; roll.position.set(0.15, 0.44, -0.22); g.add(roll);
  g.position.set(x, y, z); return shade(g);
}
// a tall bronze lamp stand with an oil flame
function lampStand(M, E, FX, x, z, y) {
  const g = new THREE.Group();
  g.add(shade(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.2, 0.05], [0.06, 0.12], [0.04, 1.2], [0.14, 1.26], [0.16, 1.32], [0, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 24), M.bronze)));
  g.position.set(x, y, z); FX.fire(E, { x, y: z, z: 1.32 + (y - LV.at(x, z)), size: 0.45, light: 5, col: 0xffa050, smoke: false }); return g;
}

// the room's colourways: the original draws the same room in two palettes (002498 西伯侯's: purple lacquer, mint tiles, a
// brown rug; 0eac5a / 0eb1a0, scenes 7 and 9: red lacquer, tan tiles, a green rug), measured from the map art
const WAYS = {
  purple: { lacquer: 0x8a1a78, lacquerDark: 0x2a0a24, tiles: 0x9cc890, step: 0x6a7a5a, rug: 0x6a4418 },
  red: { lacquer: 0x9a1810, lacquerDark: 0x2a0806, tiles: 0xd8b490, step: 0x7a6a52, rug: 0x1c5a1c },
};
const build = way => async function build(E, FX) {
  const W = WAYS[way], S = E.world.scene, M = mats({ lacquer: W.lacquer, lacquerDark: W.lacquerDark, silk: 0xe8b828 });
  const tiles = T.material(T.weave(W.tiles, 8), { envMapIntensity: 0.6 }, [0.7, 0.7]);
  const stone = T.material(T.bricks(W.step, 2, 'studyStep' + way), {});
  S.add(LV.mesh(tiles, stone, -1.2, 0.5));
  for (const r of LV.ramps) S.add(stairs(r, tiles, stone, 0.5));
  // the rug: brown wool, gold border, rows 3-14, raised a hair over the tiles (it runs down the step as two pieces)
  const rugT = T.carpet(W.rug), rugM = T.material(rugT, {});
  for (const [z0, z1] of [[3, 8.7], [9.3, 14]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, z1 - z0).rotateX(-Math.PI / 2), rugM.clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m.material[k] = rugM[k].clone(); m.material[k].repeat.set(1, (z1 - z0) / 3); m.material[k].needsUpdate = true; }
    m.position.set(4, LV.at(4, (z0 + z1) / 2) + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
  }
  // the bagua, inlaid and faintly glowing
  const bg = flat(baguaTex(), 3.1, 3.1, 4, UP + 0.02, 6.7, 0, { emissive: new THREE.Color(1, 0.75, 0.3), emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.35 });
  bg.material.emissiveMap = bg.material.map; S.add(bg);
  FX.glow(E, { x: 4, y: 6.7, r: 1.6, col: 0xffc860, i: 2.2 });
  const lat = T.material(T.paper(0xfaf0dc), { emissive: new THREE.Color(1, 0.92, 0.78), emissiveIntensity: 0.45, side: THREE.DoubleSide });
  // the room runs on to both sides into the haze: more floor, the folding screens and columns continuing
  for (const [a, b] of [[-9, 0], [8, 17]]) {
    S.add(box(tiles, a, -0.6, 0.6, b, UP, 9, 0.5), box(tiles, a, -0.6, 9, b, 0, 15, 0.5));
    S.add(screen(M, a + 0.3, b - 0.3, 1.9, UP, 2.1, 12, lat));
    for (let x = a + 1.5; x < b; x += 3) S.add(pillar(M, x, 2.85, UP, 2.8, 0.22));
    S.add(box(M.lacquerDark, a, UP, 0.6, b, UP + 2.9, 0.8));
  }
  // the room's side walls: purple lattice bays turned to face in, from the curtains down to the front walls
  for (const [x, sg] of [[-0.02, 1], [8.02, -1]]) {
    const w = latticeWall(M, 0, 11, 0, UP, 2.4, 6); w.rotation.y = sg * Math.PI / 2; w.position.set(x, 0, sg > 0 ? 14 : 3); S.add(w);
  }
  // the back: purple columns at the corners, gold curtains tied back, the lattice folding screen, vases
  for (const x of [0.25, 7.75]) S.add(pillar(M, x, 2.85, UP, 2.8, 0.22));
  S.add(curtain(M, 0.5, 1.95, 2.7, UP + 2.6, 2.5, 'l', 4), curtain(M, 6.05, 7.5, 2.7, UP + 2.6, 2.5, 'r', 4));
  S.add(screen(M, 1.9, 6.1, 1.9, UP, 2.1, 8, lat));
  S.add(box(M.lacquerDark, -0.2, UP, 0.6, 8.2, UP + 2.9, 0.8));
  S.add(vase(1.6, 2.55, UP), vase(6.4, 2.55, UP));
  // the desk with its cushion behind, tiger skins, the cabinets and their cushions
  S.add(desk(M, 4.05, 4.6, UP + 0.012));
  const silkO = T.material(T.silk(0xe8901a), { sheen: 1, sheenColor: new THREE.Color(1, 0.8, 0.4) });
  S.add(cushion(4.1, 3.75, UP + 0.012, silkO, M.jade));
  const tg = tigerTex();
  S.add(flat(tg, 1.15, 1.15, 2.6, UP + 0.02, 4.6, 0.15), flat(tg, 1.15, 1.15, 5.6, UP + 0.02, 4.6, -0.15));
  for (const z of [5.75, 7.75, 10.75]) for (const [cx, kx] of [[1.95, 1.25], [6.05, 6.75]]) { const y = LV.at(cx, z) + 0.012; S.add(cabinet(M, cx, z - 0.1, y), cushion(kx, z - 0.15, y, silkO, M.jade)); }
  // the front: purple lattice walls either side of the door, a column at each door post
  S.add(latticeWall(M, 0, 1.75, 14.1, 0, 2.4, 1), latticeWall(M, 6.25, 8, 14.1, 0, 2.4, 1));
  for (const x of [1.95, 6.05]) S.add(pillar(M, x, 14.2, 0, 2.4, 0.2));
  S.add(lampStand(M, E, FX, 0.85, 3.6, UP), lampStand(M, E, FX, 7.15, 3.6, UP));
  FX.smoke(E, { x: 4.6, y: 4.5, z: 0.75, tint: [0.7, 0.66, 0.6] });   // incense on the desk
};

// 搖錢樹 (sheet 087306, scenes 7, 9 and 12) played by a model that buds, flowers and bears jewels by the scene's script
// (src/kit/moneytree.js); a jump in the clock (a seek) snaps it to the state there
let tree = null, treeT = null;
const standIn = {
  '087306': (E, x, z, moving, ctx) => {
    const fresh = !tree || tree.g.parent !== E.world.scene;
    if (fresh) { tree = moneyTree(); E.world.scene.add(tree.g); if (window.__remake) window.__remake.moneyTree = tree.g; }   // (QA close-ups find it here)
    const st = treeState(ctx.tag, ctx.t); st.snap = fresh || treeT == null || Math.abs(ctx.t - treeT) > 40; treeT = ctx.t;
    tree.pose(E, x, LV.at(x, z), z, st);
  },
  hide: (E, gfx) => { if (gfx === '087306' && tree) tree.g.visible = false; },
};
const set = way => ({
  build: build(way), standIn, ground: (x, z) => LV.at(x, z), particles: 'dust',
  mood: { bg: 0x0c0806, voidCol: 0x0c0806, voidY: -1.2, fog: 0x0c0806, fogD: 0.03, sky: 0xffe0b0, under: 0x2a1a0a, hemi: 0.75,
    sun: 0xffd0a0, sunI: 1.6, sunDir: [-0.25, 0.9, 0.4], sat: 1.04, exposure: 1.1, bloom: 0.45,
    env: { top: 0x8a6a48, mid: 0x4a3420, low: 0x1a1008, lights: [[0, 6, -8, 0xfff0d0, 5], [-6, 4, 2, 0xffc080, 3], [6, 4, 2, 0xffc080, 3]] } },
  lights: [{ x: 4, y: 2.4, z: 8.5, col: 0xffb070, i: 4, d: 8 }],
});
export default set('purple');
export const studyRed = set('red');
