// The bamboo road to the old man's hut (maps 0eebd8 / 0f0b10, the same art: scenes 21 and 24; the old man sends 林雲
// for the 龍吟劍, then for the 洛書), remade: a gravel path with pale stepping stones winding east through a dense bamboo
// forest, white-flowering clumps at its edges, and at its end the thatched hut (x 25.5-29.8, its front at row 7: log
// posts, a dark doorway, two small blue-paned windows, a basket and a pot by the door). Grid: open cells are the path,
// blocked cells the forest and the hut (tools/qa/grid.py 0eebd8). Bamboo just south of the path stays low, so the cast on
// it is never hidden from the camera.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { box, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, bamboo, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 32, MH = 15;
const PALETTE = { [CL.ground]: [0x90906c, 0x6c4848, 0xd8d8b4, 0xfcfcfc], [CL.grass]: [0x004800, 0x009000, 0x90d800] };
const HUT = { x0: 25.6, x1: 29.6, z0: 4.4, z1: 6.9 };
const hutCell = (x, y) => x + 0.5 > HUT.x0 - 0.2 && x + 0.5 < HUT.x1 + 0.2 && y + 0.5 > 2.6 && y + 0.5 < HUT.z1;
const TUFTS = [[8.5, 7.5], [8.5, 8.5], [10.5, 11.5], [10.5, 12.5], [10.5, 13.3], [31.4, 5.8], [31.4, 6.8], [31.4, 7.8], [31.4, 8.8], [30.5, 9.6], [31.4, 9.6]];
let land = null;

// straw on a canvas: dense golden strokes, darker toward the bottom of each course
function thatchTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#8a6a20'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 10 + Math.random() * 22; g.strokeStyle = ['#d8b448', '#c8a038', '#e8c860', '#a88428', '#f0d878'][i % 5]; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y + l); g.stroke(); }
  for (let y = 0; y < 256; y += 64) { g.fillStyle = 'rgba(60,40,10,0.35)'; g.fillRect(0, y + 56, 256, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// the hut: a raised earth floor, log walls, log posts across the front, a doorway, windows, a hip roof of thick thatch
function hut(y) {
  const g = new THREE.Group(), { x0, x1, z0, z1 } = HUT, H = 1.35, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const logs = T.material(T.wood(0x7a5a2a, 'hutLogs'), { color: 0xe8d0a0 }, [1, 1]), dark = new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 1 });
  g.add(box(T.material(T.dirt(0x6a5a40, 'hutFloor'), {}), x0 - 0.1, y - 0.05, z0 - 0.1, x1 + 0.1, y + 0.08, z1 + 0.12));
  g.add(box(logs, x0, y + 0.08, z0, x1, y + H, z1 - 0.05, 1));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.85), dark); door.position.set(27.35, y + 0.55, z1 - 0.04); door.scale.y = 1.2; g.add(door);
  for (const wx of [27.05, 27.65]) {   // the two small windows over the doorway's sides, blue panes in a dark frame
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), new THREE.MeshStandardMaterial({ color: 0x3a7ad8, emissive: 0x0a2050, roughness: 0.3 })); w.position.set(wx + (wx < 27.3 ? -0.45 : 0.45), y + 0.85, z1 - 0.03); g.add(w);
  }
  const post = new THREE.CylinderGeometry(0.07, 0.08, H + 0.1, 8), posts = [];
  for (const px of [x0 + 0.05, 26.5, 26.95, 27.75, 28.4, 29.1, x1 - 0.05]) { const m = new THREE.Mesh(post, logs); m.position.set(px, y + 0.08 + (H + 0.1) / 2, z1 + 0.02); posts.push(m); }
  g.add(...posts);
  for (const [bx, r, h, col] of [[26.2, 0.17, 0.2, 0xb08a40], [27.05, 0.15, 0.12, 0x8a5a30]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 14), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); b.position.set(bx, y + 0.08 + h / 2, z1 + 0.25); g.add(b); }
  // the roof: a ridge along x, four slopes down to eaves that overhang, a thick straw rim along the eaves
  const top = y + H, ov = 0.4, rise = 1.0, ex0 = x0 - ov, ex1 = x1 + ov, ez0 = z0 - ov, ez1 = z1 + 0.12, rx0 = x0 + 0.9, rx1 = x1 - 0.9, ry = top + rise;
  const P = [], UV = [], tri = (a, b, c, uv) => { P.push(...a, ...b, ...c); UV.push(...uv); };
  const A = [ex0, top, ez1], B = [ex1, top, ez1], C = [ex1, top, ez0], Dd = [ex0, top, ez0], E1 = [rx0, ry, cz], E2 = [rx1, ry, cz];
  tri(A, B, E2, [0, 0, 5, 0, 4, 1.5]); tri(A, E2, E1, [0, 0, 4, 1.5, 1, 1.5]);   // the front slope
  tri(C, Dd, E1, [0, 0, 5, 0, 4, 1.5]); tri(C, E1, E2, [0, 0, 4, 1.5, 1, 1.5]);  // the back
  tri(Dd, A, E1, [0, 0, 3, 0, 1.5, 1.5]); tri(B, C, E2, [0, 0, 3, 0, 1.5, 1.5]);  // the hips
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.computeVertexNormals();
  const straw = new THREE.MeshStandardMaterial({ map: thatchTex(), roughness: 0.95, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(geo, straw));
  const rim = [], rimM = straw;
  for (const [a, b, c, d] of [[ex0, ez1 - 0.12, ex1, ez1 + 0.02], [ex0, ez0 - 0.02, ex1, ez0 + 0.12], [ex0 - 0.02, ez0, ex0 + 0.12, ez1], [ex1 - 0.12, ez0, ex1 + 0.02, ez1]]) rim.push(box(rimM, a, top - 0.16, b, c, top + 0.04, d, 2));
  g.add(merged(rimM, rim), box(T.material(T.wood(0x5a3a1a, 'ridgePole'), {}), rx0 - 0.1, ry - 0.06, cz - 0.1, rx1 + 0.1, ry + 0.1, cz + 0.1));
  void cx; return shade(g);
}

// where the art's path is pale (its stepping stones): an 8 px block mostly pale, a flat stone there
async function paleSpots() {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'assets/maps/0eebd8.png'; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data, out = [];
  for (let by = 0; by < img.height / 8; by++) for (let bx = 0; bx < img.width / 8; bx++) {
    let n = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const k = ((by * 8 + y) * img.width + bx * 8 + x) * 4; if (d[k] > 200 && d[k + 1] > 200 && d[k + 2] > 160) n++; }
    const hsh = Math.sin(bx * 127.1 + by * 311.7) * 43758.5453; if (n > 22 && hsh - Math.floor(hsh) < 0.4) { const x = (bx + 0.5) / 4, z = (by + 0.5) / 4; out.push([x, land.at(x, z) - 0.09, z]); }   // (set flush: only their worn tops show)
  }
  return out;
}
async function build(E, FX) {
  const S = E.world.scene;
  const lay = await readLayout('assets/maps/0eebd8.png', MW, MH, PALETTE);
  const W = MW * 4, tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 2 : D.terrain[y][x];
  const open = (x, y) => tc(x, y) === 0;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const k = (y * 4 + j) * W + x * 4 + i;
    if (!open(x, y)) lay[k] = hutCell(x, y) ? CL.ground : CL.grass;
  }
  const outside = () => CL.grass;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside, rockH: 0.3, lumpH: 0.04,
    tex: { dirt: T.dirt(0x8a806a, 'gravelPath'), turf: T.turf(0x2a5a1e), rock: T.rock(0x6a6050, 'pathRock', 0.3) },
    tint: { dirt: 0xf0ece0, turf: 0xd0e8c0, rock: 0xe0d8c8 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.4, topGreen: 0, bed: 0x2a3a2a }));
  S.add(hut(land.at(27.6, 6.5)));
  // the forest: canes on every blocked cell (and on past the map), low just south of the path (no one hidden behind)
  const southOf = (x, y) => { for (let d = 1; d <= 3; d++) if (open(x, y - d)) return d; return 9; };
  const pts = [];
  for (let y = -5; y < MH + 3; y++) for (let x = -6; x < MW + 6; x++) {
    const inMap = x >= 0 && y >= 0 && x < MW && y < MH;
    if (inMap && (open(x, y) || hutCell(x, y))) continue;
    const d = southOf(x, y), h = d === 1 ? 0.9 : d === 2 ? 1.6 : d === 3 ? 2.4 : 3.4;
    for (let k = 0; k < 2; k++) { const px = x + 0.15 + Math.random() * 0.7, pz = y + 0.15 + Math.random() * 0.7; pts.push([px, land.at(px, pz), pz, h * (0.9 + Math.random() * 0.25)]); }
  }
  S.add(bamboo(pts));
  // the white-flowering clumps at the path's edges, tufts along the verges, pale stones on the path
  S.add(grass(TUFTS.map(([x, z]) => [x, land.at(x, z), z]), { size: 0.75, cols: ['#e8f0c8', '#d0e0a0', '#f8f8e0', '#b8d088'] }));
  S.add(grass(land.scatter(CL.grass, 20, (x, z) => open(Math.floor(x), Math.floor(z)) || southOf(Math.floor(x), Math.floor(z)) <= 1), { size: 0.36, cols: ['#2e6a1e', '#4a8a24', '#1e5a18'] }));
  S.add(stones(await paleSpots(), T.material(T.rock(0xe0dcc8, 'stepStone', 0.15), {}, [0.5, 0.5]), { size: 0.17 }));   // the pale stepping stones the art strews on the path
  S.add(stones(lay.pebbles.filter(([x, z]) => open(Math.floor(x), Math.floor(z))).map(([x, z]) => [x, land.at(x, z), z]), T.material(T.rock(0xc8c4b0, 'paleStone', 0.2), {}, [0.5, 0.5]), { size: 0.12 }));
  E.world.updaters.push((dt, t) => windTick(t));
}

export default {
  build, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'leaves',
  // a green, quiet afternoon under the canes
  mood: { bg: 0xc8d8c0, voidCol: false, fog: 0xb8ccb0, fogD: 0.014, sky: 0xd0e8d8, under: 0x2a4a20, hemi: 1.0,
    sun: 0xfff0d0, sunI: 2.8, sunDir: [-0.4, 0.8, 0.4], sat: 1.05, exposure: 1.02, bloom: 0.3, aoR: 0.8,
    env: { top: 0xc8e0d0, mid: 0x7a9a6a, low: 0x2a4a20, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
