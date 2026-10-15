// 臨潼關草原 (maps 0ec58e / 0ec5d6, the same art: scene 15 and battle 8), remade: the grassland below 臨潼關, tall golden
// grass with wildflowers, a river across it from the west (rows 13-19) between banks of brown boulders, crossed where
// the grass runs over in two tongues (x 9-12 and x 18-20), and a lake in the north-east (x 13-23, rows 0-9) under its own
// boulder bank. The heroes come up from the south bank (deploy (8, 20), (5, 20), (7, 21)); 黃飛虎 stands at the river's
// north bank (15, 13). Bright morning.
// Chests: (12, 13) and (18, 2) as drawn; (0, 0) and (0, 23) are not drawn (hidden: battle 8's hook module).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 24, MH = 25, WATER = -0.42, DEPLOY = [8, 20];
const PALETTE = { [CL.grass]: [0xb49024, 0xd8b448], [CL.water]: [0x000048, 0x0000b4, 0x0090fc, 0xd8fcfc],
  [CL.rock]: [0x484824, 0xd86c24, 0xfcfc90, 0x240000] };
const FLOWER = { 0xd82400: 'red', 0xfc6cb4: 'red', 0xb46cfc: 'purple', 0x6c00b4: 'purple' };
const CHESTS = [[12, 13], [18, 2]];
const OPEN = [[15.1, 13.5, 0.5]];   // spots scene 15's cast stands on, kept clear of the bank (tools/qa/sets.js)
let land = null, chestG = new Map(), M = null, world = null;

// the wildflowers the art strews over the grass: where its little red and purple clusters are, a clump of that colour
async function flowerSpots() {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'assets/maps/0ec58e.png'; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data, hits = new Map();
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const k = (y * img.width + x) * 4, kind = FLOWER[(d[k] << 16) | (d[k + 1] << 8) | d[k + 2]]; if (!kind) continue;
    const key = Math.floor(x / 16) + ',' + Math.floor(y / 16), h = hits.get(key) || { kind, x: 0, y: 0, n: 0 }; h.x += x; h.y += y; h.n++; hits.set(key, h);
  }
  return [...hits.values()].filter(h => h.n >= 4).map(h => ({ kind: h.kind, x: h.x / h.n / 32, z: h.y / h.n / 32 }));
}
// a clump of small five-petalled flowers on short stems
function flowers(spots, at) {
  const g = new THREE.Group(), stem = new THREE.MeshStandardMaterial({ color: 0x4a6a24, roughness: 0.9 });
  const shape = new THREE.Shape(); for (let k = 0; k <= 50; k++) { const a = k / 50 * Math.PI * 2, r = 0.05 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); shape[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const head = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mid = new THREE.SphereGeometry(0.014, 6, 4);
  const cols = { red: [0xe8302a, 0xf070a8], purple: [0xa060f0, 0x7028c0] }, eye = new THREE.MeshStandardMaterial({ color: 0xf8e040, emissive: 0x302000 });
  const mats_ = Object.fromEntries(Object.entries(cols).map(([k, [a, b]]) => [k, [a, b].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color(c).multiplyScalar(0.12) }))]));
  let s = 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const p of spots) for (let i = 0; i < 6; i++) {
    const x = p.x + (rnd() - 0.5) * 0.4, z = p.z + (rnd() - 0.5) * 0.3, y = at(x, z), h = 0.12 + rnd() * 0.12;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, h, 4), stem); st.position.set(x, y + h / 2, z); g.add(st);
    const fl = new THREE.Mesh(head, mats_[p.kind][i % 2]); fl.position.set(x, y + h, z); fl.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5); g.add(fl);
    const c = new THREE.Mesh(mid, eye); c.position.set(x, y + h + 0.01, z); g.add(c);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const lay = await readLayout('assets/maps/0ec58e.png', MW, MH, PALETTE, { [CL.water]: 1.3 });
  const W = MW * 4;
  // the land follows the game's own grid (D.terrain): a cell anyone may enter is level ground; a blocked cell is the
  // river or the lake where the art has mostly water, else the boulder bank
  const tc = (cx, cy) => D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 0;
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH && tc(cx, cy) === 0;
  const reach = new Set();
  for (const q = [DEPLOY, [15, 13]]; q.length;) { const [x, y] = q.shift(); if (!open(x, y) || reach.has(x + ',' + y)) continue; reach.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const blocked = !reach.has(cx + ',' + cy);
    let wet = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) wet += lay[(cy * 4 + j) * W + cx * 4 + i] === CL.water ? 1 : 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (cy * 4 + j) * W + cx * 4 + i;
      if (!blocked && (lay[k] === CL.rock || lay[k] === CL.water)) lay[k] = CL.grass;
      else if (blocked) lay[k] = wet >= 6 ? CL.water : CL.rock;
    }
  }
  // where scene 15's cast stands at the bank's edge (黃飛虎's notch (15, 13) between boulders, at f1349-1388), the boulders give way
  for (const [ox, oz, r] of OPEN) for (let j = Math.floor((oz - r) * 4); j <= Math.floor((oz + r) * 4); j++) for (let i = Math.floor((ox - r) * 4); i <= Math.floor((ox + r) * 4); i++)
    if (Math.hypot((i + 0.5) / 4 - ox, (j + 0.5) / 4 - oz) <= r && i >= 0 && j >= 0 && i < W && j < MH * 4) lay[j * W + i] = CL.grass;
  // a bank of boulders where the water meets the grass: the art's brown rims stay rock on the water's side
  const walk = (cx, cy) => reach.has(cx + ',' + cy);
  lay.pebbles = lay.pebbles.filter(([x, z]) => walk(Math.floor(x), Math.floor(z)));
  for (const [x, y] of CHESTS) for (let j = y * 4; j < y * 4 + 4; j++) for (let i = x * 4; i < x * 4 + 4; i++) lay[j * W + i] = CL.ground;
  // past the map: the grassland goes on (the river runs on off the west and east edges, the lake off the north-east)
  const outside = (x, z) => (z > 13.2 && z < 19.5 && (x < 0 || x >= MW)) || (z < 0 && x > 13.5) || (x >= MW && z < 9) ? CL.water : CL.grass;
  const cap = (x, z) => z < MH - 0.5 ? 99 : 0.6;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, cap, carve: [{ r: [14.95, 12.95, 16.05, 13.97], h: 0.02 }],   // 黃飛虎's notch, level all over
     rockH: 0.45, rise: 0.62, lumpH: 0.05, waterDepth: -WATER + 0.12,
    tex: { dirt: T.dirt(0xa88a46, 'plainDirt'), turf: T.turf(0xa89a36), rock: T.rock(0x6a5240, 'bankRock', 0.25), rockTop: T.rock(0x7a6248, 'bankTop', 0.4) },
    tint: { dirt: 0xfff0d8, turf: 0xf0e4b0, rock: 0xe8c8a8 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.5, topGreen: 0.4, bed: 0x283a48 }));
  // the water: a deep blue that catches the sky, a slow glint (the original cycles two of its blues every 10 frames)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c1c4a, roughness: 0.85, metalness: 0, envMapIntensity: 0.05 }));   // (dark: the bright sky light lifts it to a deep blue)
  water.position.set(MW / 2, WATER, MH / 2); water.receiveShadow = true; S.add(water);
  for (const [x, y] of CHESTS) { const c = chest(M, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), false, 0, 1.4); S.add(c); chestG.set(x + ',' + y, c); }
  // tall golden grass over the plain, shorter at the banks; boulders and pebbles; the wildflowers; scrub on the banks
  const clear = (x, z) => !CHESTS.some(([cx, cy]) => x > cx - 0.2 && x < cx + 1.2 && z > cy - 0.2 && z < cy + 1.2);
  S.add(grass(land.scatter(CL.grass, 60, clear), { size: 0.62, cols: ['#c8a848', '#b89a3a', '#d8bc5a', '#a88c34', '#9a8a3a'] }));
  S.add(grass(land.scatter(CL.ground, 6, clear), { size: 0.4, cols: ['#b0983e', '#9a8a3a', '#c0a448'] }));
  const rockM = T.material(T.rock(0x6a5240, 'bankRock', 0.25), { color: 0xf0d0b0 }, [0.5, 0.5]);
  S.add(stones(land.scatter(CL.rock, 7, () => true), rockM, { size: 0.32 }));
  S.add(stones([...land.scatter(CL.rock, 2.2, () => true), ...lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z])], rockM, { size: 0.2 }));
  S.add(shrubs(land.scatter(CL.rock, 0.5, (x, z) => land.weight(x, z, CL.grass) > 0.05), { size: 0.36, cols: ['#6a7a2a', '#7a8a32', '#5a6a24'] }));
  S.add(flowers((await flowerSpots()).filter(p => walk(Math.floor(p.x), Math.floor(p.z)) && clear(p.x, p.z)), (x, z) => land.at(x, z)));
  E.world.updaters.push((dt, t) => { windTick(t); water.material.color.setHSL(0.63, 0.7, 0.12 + Math.sin(t * 2.1) * 0.01); });
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y);
  if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
// a chest the map does not draw ((0, 0), (0, 23): the plain's corners): struck, it shows up open
function found(x, y) {
  if (!land || !world) return;
  const cx = x + 0.5, cz = y + 0.5, g = chest(M, cx, cz, land.at(cx, cz), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

export default {
  build, openChest, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'leaves', props: CHESTS,
  // a bright morning over the plain: a warm low sun from the east, a clear sky
  mood: { bg: 0xd8d4c4, voidCol: false, fog: 0xd8d4bc, fogD: 0.006, sky: 0xd8e4ff, under: 0x6a5a30, hemi: 1.0,
    sun: 0xfff0d0, sunI: 3.0, sunDir: [0.55, 0.7, 0.35], sat: 1.05, exposure: 1.0, bloom: 0.3, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xc8b890, low: 0x6a5a38, lights: [[6, 7, 3, 0xfff0d0, 3]] } },
};
