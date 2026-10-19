// 海龍洞's mouth (map 0ed908: scene 18, 哪吒 runs ahead into the sea dragon's cave and the heroes follow), remade: a
// wall of mossy boulders across the north-west (rows 0-2, x 0-7) with the cave's black mouth at (3, 1), a meadow below
// with wildflowers, a pond in the south-west (x 0-6, rows 6-8) behind a bank of the same boulders, and broadleaf trees
// to the east, dark green lit with yellow, their trunks red-brown (measured on tools/qa/grid.py 0ed908). Afternoon.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, shade } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, leafTex, clumpGeo, mergeSimple, windTick } from '../kit/terrain.js';

const MW = 16, MH = 10, WATER = -0.4;
const PALETTE = { [CL.grass]: [0x002400, 0x009000, 0x6cb448, 0x90d800], [CL.rock]: [0x242400, 0x484800, 0x6c6c6c, 0xfcfc90],
  [CL.water]: [0x000048, 0x0000b4, 0x002490, 0x0090fc, 0xd8fcfc] };
// the trees: trunk foot (cell coordinates) and crown size; the thicket at the south-east corner as two low trees
const TREES = [[9.0, 2.0, 1.0], [9.0, 4.85, 0.95], [11.0, 2.7, 1.1], [12.0, 3.9, 1.05], [13.2, 2.4, 1.0], [15.0, 0.9, 1.0], [15.0, 4.85, 1.0],
  [12.9, 9.0, 0.85], [14.0, 8.8, 0.8], [8.9, 0.3, 0.9], [11.6, 0.6, 1.0], [15.2, 3.2, 0.8]];
const MOUTH = { x: 3.5, z: 2.0, w: 0.95, h: 1.15 };   // 哪吒 walks in at (3, 2) (scene 18 f814-817): a level floor runs in under the arch
const OPEN = [[7.5, 5.6, 0.8]];   // 楊戩 on the pond bank's top at (7, 5), f1320-1439: the boulders give way
let land = null;

// leaves for the crowns, painted once per palette: sprigs of real leaves (ovate, pointed, a pale midrib, lit on one
// half) on thin twigs running out from the card's middle, the outline ragged where the sprigs end, never a disc
const SPRIG = new Map();
export function sprigTex(cols) {
  const key = cols.join(); if (SPRIG.has(key)) return SPRIG.get(key);
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = q => Math.max(0, Math.min(255, Math.round(q * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const pick = () => { const i = Math.floor(Math.pow(rnd(), 2.2) * cols.length); return cols[Math.min(cols.length - 1, i)]; };   // (the palette's first, darker colours most)
  const leaf = (x, y, ang, L, col) => {
    g.save(); g.translate(x, y); g.rotate(ang); const W = L * 0.42;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(W, L * 0.2, W * 0.9, L * 0.7, 0, L); g.bezierCurveTo(-W * 0.9, L * 0.7, -W, L * 0.2, 0, 0);
    const gr = g.createLinearGradient(-W, 0, W, 0); gr.addColorStop(0, shade(col, 0.72)); gr.addColorStop(0.5, shade(col, 1.0)); gr.addColorStop(1, shade(col, 1.22));
    g.fillStyle = gr; g.fill(); g.strokeStyle = shade(col, 0.7); g.lineWidth = 1; g.stroke();
    g.strokeStyle = shade(col, 1.3); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, L * 0.05); g.lineTo(0, L * 0.85); g.stroke();
    g.restore();
  };
  for (let t = 0; t < 15; t++) {   // twigs from near the middle out to a ragged rim
    const a0 = rnd() * Math.PI * 2, r0 = rnd() * 50, len = 140 + rnd() * 90; let x = N / 2 + Math.cos(a0) * r0, y = N / 2 + Math.sin(a0) * r0, a = a0;
    const steps = 6; g.strokeStyle = '#3a2a1a'; g.lineWidth = 3;
    for (let k = 0; k < steps; k++) {
      const nx = x + Math.cos(a) * len / steps, ny = y + Math.sin(a) * len / steps; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      for (const side of [-1, 1]) if (rnd() < 0.85) { const L = 36 + rnd() * 20; leaf(nx, ny, a - Math.PI / 2 + side * (0.6 + rnd() * 0.5), L, pick()); }
      x = nx; y = ny; a += (rnd() - 0.5) * 0.35;
    }
    leaf(x, y, a - Math.PI / 2, 42 + rnd() * 14, pick());
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; SPRIG.set(key, t); return t;
}
// a broadleaf tree: a stout trunk forking into three boughs, a crown of many small leaf clumps round them, uneven,
// darker underneath and inside than on top (leaves: the crowns' colours; also 聖靈山, the snow of 麒麟山 and the peach
// forest, src/remake/mountain.js)
export function trees(list, at, leaves = ['#14401a', '#1e5a20', '#2e7024', '#6a9a1a', '#c8c820', '#3a6a1e'], barkCol = 0xd88a6a) {
  const g = new THREE.Group(), bark = T.material(T.bark(0x6a2a14), { color: barkCol }, [1, 2]);
  const tex = sprigTex(leaves);
  const leaf = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const crown = clumpGeo(14), d = new THREE.Object3D();
  const clumps = [];
  for (const [x, z, s] of list) {
    const y = at(x, z) - 0.05, h = 1.5 * s;
    let q = Math.floor(x * 31 + z * 17) * 7 + 3; const rnd = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
    const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.13 * s, h, 8), bark)); trunk.position.set(x, y + h / 2, z); g.add(trunk);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + x, len = 0.7 * s, b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.06 * s, len, 6), bark));
      b.position.set(x + Math.cos(a) * 0.22 * s, y + h + 0.15 * s, z + Math.sin(a) * 0.12 * s); b.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(b);
    }
    // the crown: clumps over an uneven dome round the boughs' ends, a few hanging lower at its rim
    const cy = y + h + 0.55 * s, n = 11 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, up = k < 2 ? 0.9 : rnd() * 1.1 - 0.25, r = Math.sqrt(Math.max(0, 1 - up * up));
      const px = x + Math.cos(a) * r * 0.62 * s, py = cy + up * 0.42 * s, pz = z + Math.sin(a) * r * 0.5 * s - 0.05;
      clumps.push([px, py, pz, (0.42 + rnd() * 0.24) * s, 0.62 + (up + 0.25) * 0.32 + rnd() * 0.12]);
    }
  }
  const m = new THREE.InstancedMesh(crown, leaf, clumps.length), c = new THREE.Color();
  clumps.forEach(([x, y, z, s, t], i) => { d.position.set(x, y, z); d.rotation.set((i % 3) * 0.4, i * 1.7, (i % 2) * 0.3); d.scale.set(s * 1.15, s * 0.9, s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, c.setRGB(t, t, t)); });
  m.castShadow = m.receiveShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  g.add(m); return g;
}
// the cave's mouth: a black opening under a ragged arch of the boulders, a breath of cold air at its foot
export function mouth(at, rockM, m = MOUTH) {
  const g = new THREE.Group(), { x, z, w, h } = m, y = at(x, z);
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h * 0.55); sh.absarc(0, h * 0.55, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshBasicMaterial({ color: 0x020203 }));
  hole.position.set(x, y - 0.02, z); g.add(hole);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h * 0.8, 1.2), new THREE.MeshBasicMaterial({ color: 0x020203 })); back.position.set(x, y + h * 0.4, z - 0.62); g.add(back);
  for (let k = 0; k < 9; k++) {   // the arch: boulders round the opening
    const a = Math.PI * k / 8, r = w / 2 + 0.12, b = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (k % 3) * 0.03, 1), rockM));
    b.position.set(x - Math.cos(a) * r, y + h * 0.55 + Math.sin(a) * r * 1.05 - (k === 0 || k === 8 ? 0.5 : 0), z + 0.05); b.scale.set(1, 0.85, 0.8); g.add(b);
  }
  return g;
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/0ed908.png', MW, MH, PALETTE, { [CL.water]: 1.3 });
  const W = MW * 4;
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = (i + 0.5) / 4, z = (j + 0.5) / 4;
    if (x >= 7.9 && lay[k] === CL.rock) lay[k] = CL.grass;   // the trees' dark shadows are not rock
    if (OPEN.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r)) lay[k] = CL.grass;
  }
  // past the map: the boulder wall goes on west and north, the meadow and the wood east and south, the pond west
  const outside = (x, z) => (z < 0 && x < 7.8) || (x < 0 && z < 3) ? CL.rock : x < 0 && z > 6 ? CL.water : CL.grass;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, carve: [{ r: [MOUTH.x - 0.48, MOUTH.z - 0.9, MOUTH.x + 0.48, 3.2], h: 0.02 }], rockH: 1.9, rise: 1.2, lumpH: 0.05, waterDepth: -WATER + 0.15,
    cap: (x, z) => z >= MH - 0.6 ? 0.5 : z > 4.6 ? 0.55 : 99,   // the pond's bank: a low band of boulders, not a wall
    tex: { dirt: T.dirt(0x6a6a3a, 'meadowDirt'), turf: T.turf(0x2e6a1e), rock: T.rock(0x5a5a30, 'mossRock', 0.3), rockTop: T.rock(0x4a5a24, 'mossTop', 0.4) },
    tint: { dirt: 0xe8f0d0, turf: 0xd0e8b8, rock: 0xd8d8b0 } });
  S.add(land.mesh({ dirtK: 0.2, rockK: 0.45, topGreen: 0.6, bed: 0x10203a }));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x081a48, roughness: 0.8, envMapIntensity: 0.05 }));
  water.position.set(MW / 2, WATER, MH / 2); water.receiveShadow = true; S.add(water);
  const rockM = T.material(T.rock(0x5a5a30, 'mossRock', 0.3), { color: 0xe0e0c0 }, [0.5, 0.5]);
  S.add(mouth(land.at.bind(land), rockM));
  S.add(trees(TREES, (x, z) => land.at(x, z)));
  const open = (x, z) => !TREES.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.3) && Math.hypot(x - MOUTH.x, z - MOUTH.z - 0.4) > 0.6;
  S.add(grass(land.scatter(CL.grass, 80, open), { size: 0.4, cols: ['#2e6a1e', '#4a8a24', '#1e5a18', '#5a9a2a', '#3a7a20'] }));
  S.add(stones(land.scatter(CL.rock, 3, () => true), rockM, { size: 0.26 }));
  S.add(shrubs(land.scatter(CL.rock, 0.6, (x, z) => land.weight(x, z, CL.grass) > 0.05), { size: 0.34, cols: ['#2a5a1a', '#3a6e22', '#22481a'] }));
  E.world.updaters.push((dt, t) => { windTick(t); water.material.color.setHSL(0.63, 0.75, 0.13 + Math.sin(t * 1.7) * 0.01); });
}

export default {
  build, ground: (x, z) => land ? land.at(x, z) : 0,
  // a clear afternoon by the sea: a warm sun from the west
  mood: { bg: 0xd0d8c8, voidCol: false, fog: 0xc8d4c0, fogD: 0.01, sky: 0xd8e8ff, under: 0x2a4a20, hemi: 1.0,
    sun: 0xffe8c8, sunI: 3.0, sunDir: [-0.6, 0.7, 0.35], sat: 1.05, exposure: 1.0, bloom: 0.3, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0x98b088, low: 0x2a4a20, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
