// The bamboo road to the old man's hut (maps 0eebd8 / 0f0b10 / 0f1bb2 / 0f1c0e, the same art: scenes 21, 24 and 26, and
// battle 13 磻溪 with its fire; the old man sends 林雲
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
import { sheets } from '../kit/fire.js';

const MW = 32, MH = 15;
const PALETTE = { [CL.ground]: [0x90906c, 0x6c4848, 0xd8d8b4, 0xfcfcfc], [CL.grass]: [0x004800, 0x009000, 0x90d800] };
const HUT = { x0: 25.6, x1: 29.6, z0: 4.4, z1: 6.9 };
const hutCell = (x, y) => x + 0.5 > HUT.x0 - 0.2 && x + 0.5 < HUT.x1 + 0.2 && y + 0.5 > 2.6 && y + 0.5 < HUT.z1;
const TUFTS = [[8.5, 7.5], [8.5, 8.5], [10.5, 11.5], [10.5, 12.5], [10.5, 13.3], [31.4, 5.8], [31.4, 6.8], [31.4, 7.8], [31.4, 8.8], [30.5, 9.6], [31.4, 9.6]];
let land = null, forest = null;
// 磻溪's fire (scene 26 from its frame 472, battle 13): the burnt columns, the front (the westmost), its two lights
const FIRE = { cols: new Map(), front: null, lights: [], ash: {}, wall: null, glow: null };   // cols: column -> how far it has caught (0-1)
const FIRE_BLOCK = 58;   // the block scene 26 lays down the map's east column (x 31, rows 3-9) as 申公豹 shows the fire
// column col takes fire: flames there (flameWall), the canes char down, the floor scorched (k: 0 to 1, as it happens)
export function burnCol(E, col, k = 1) {
  if (!FIRE.cols.has(col) && land) E.world.scene.add(FIRE.ash[col] = ash(col));
  const was = FIRE.cols.get(col); FIRE.cols.set(col, k);
  if (forest) forest.userData.burn(col, k);
  if (FIRE.glow && Math.min(...FIRE.cols.keys()) !== FIRE.front) FIRE.glow.userData.place(Math.min(...FIRE.cols.keys()));
  if (FIRE.ash[col]) FIRE.ash[col].material.opacity = 0.85 * k;
  const front = Math.min(...FIRE.cols.keys()); if (front !== FIRE.front || was == null || Math.abs(k - was) > 0.04 || k === 1) { FIRE.front = front; if (FIRE.wall) FIRE.wall.layout(); }
}
// the forest fire in the remake's real fire (src/kit/fire.js sheets): tall sheets close along the front, lower ones on
// the column behind it, a few smouldering further back; their height follows how far a column has caught
function flameWall(S) {
  const fire = sheets(S), h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };   // fixed per spot: a relayout keeps each sheet where it was
  return { tick: t => fire.tick(t), layout() {
    const list = [], front = FIRE.front;
    for (const [c, k] of FIRE.cols) {
      const age = c - front, step = age === 0 ? 0.55 : age === 1 ? 0.9 : 1.7;
      if (age > 4) continue;   // further back: only the stumps and the ash
      for (let z = -5; z < MH + 3; z += step) {
        const r = h(c, z), r2 = h(z, c + 0.5); if (age >= 2 && r > (age === 2 ? 0.55 : 0.3)) continue;
        const x = c + 0.15 + r * 0.7, zz = z + r2 * step * 0.7, kk = 0.2 + 0.8 * k;
        const ht = (age === 0 ? 2.6 + r2 * 1.2 : age === 1 ? 1.3 + r2 * 0.5 : 0.5 + r2 * 0.3) * kk, wd = age === 0 ? 1.7 : age === 1 ? 1.2 : 0.7;
        // (a sheet's foot at the highest ground just behind it: leaning back, it cut into the bank there in a straight line)
        const y = Math.max(land.at(x, zz), land.at(x + 0.6, zz), land.at(x + 1.2, zz), land.at(x, zz - 0.6)) - 0.15;
        list.push([x, y, zz, ht, r * 37, (age === 0 ? 1.08 : age === 1 ? 0.95 : 0.8) * (0.6 + 0.4 * k), wd * (0.85 + r * 0.3)]);
      }
    }
    fire.set(list);
  } };
}
// the glow the fire throws on the ground along its front (moved with the front)
function frontGlow() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
  const z0 = -5, z1 = MH + 3, geo = new THREE.PlaneGeometry(2.4, z1 - z0, 6, (z1 - z0) * 2).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xff6a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.userData.noRange = true; m.renderOrder = 0.6;
  m.userData.place = col => { const p = geo.attributes.position; if (!m.userData.base) m.userData.base = Float32Array.from(p.array);
    const b = m.userData.base; for (let i = 0; i < p.count; i++) { const x = col + 0.3 + b[i * 3], z = (z0 + z1) / 2 + b[i * 3 + 2]; p.setXYZ(i, x, land.at(x, z) + 0.05, z); } p.needsUpdate = true; };
  return m;
}
// the scorched floor of a burnt column: a dark strip laid over the ground (the turf stayed green under black stumps)
function ash(col) {
  const z0 = -5, z1 = MH + 3, geo = new THREE.PlaneGeometry(1, z1 - z0, 4, (z1 - z0) * 2).rotateX(-Math.PI / 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = col + 0.5 + p.getX(i), z = (z0 + z1) / 2 + p.getZ(i); p.setXYZ(i, x, land.at(x, z) + 0.03, z); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x140c08, transparent: true, opacity: 0, depthWrite: false }));
  m.userData.noRange = true; m.renderOrder = 0.5; return m;
}
// the forest east of the map already ablaze from col on (the map's last column and the eight past it), as 申公豹 shows
// it in scene 26 and as battle 13 starts
export function ablaze(E, col) { for (let c = col; c < col + 9; c++) burnCol(E, c, 1); }

// straw on a canvas: dense golden strokes, darker toward the bottom of each course
function thatchTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#8a6a20'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 10 + Math.random() * 22; g.strokeStyle = ['#d8b448', '#c8a038', '#e8c860', '#a88428', '#f0d878'][i % 5]; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y + l); g.stroke(); }
  for (let y = 0; y < 256; y += 64) { g.fillStyle = 'rgba(60,40,10,0.35)'; g.fillRect(0, y + 56, 256, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// the hut: a raised earth floor, log walls, log posts across the front, a doorway, windows, a hip roof of thick thatch
// (r: its walls' rectangle; also 黃龍堡's, src/remake/huanglong.js; the front's pieces placed along it in proportion)
export function hut(y, r = HUT) {
  const g = new THREE.Group(), { x0, x1, z0, z1 } = r, H = 1.35, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, at = k => x0 + (k - HUT.x0) * (x1 - x0) / (HUT.x1 - HUT.x0);
  const logs = T.material(T.wood(0x7a5a2a, 'hutLogs'), { color: 0xe8d0a0 }, [1, 1]), dark = new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 1 });
  g.add(box(T.material(T.dirt(0x6a5a40, 'hutFloor'), {}), x0 - 0.1, y - 0.05, z0 - 0.1, x1 + 0.1, y + 0.08, z1 + 0.12));
  g.add(box(logs, x0, y + 0.08, z0, x1, y + H, z1 - 0.05, 1));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.85), dark); door.position.set(at(27.35), y + 0.55, z1 - 0.04); door.scale.y = 1.2; g.add(door);
  for (const wx of [27.05, 27.65]) {   // the two small windows over the doorway's sides, blue panes in a dark frame
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), new THREE.MeshStandardMaterial({ color: 0x3a7ad8, emissive: 0x0a2050, roughness: 0.3 })); w.position.set(at(wx + (wx < 27.3 ? -0.45 : 0.45)), y + 0.85, z1 - 0.03); g.add(w);
  }
  const post = new THREE.CylinderGeometry(0.07, 0.08, H + 0.1, 8), posts = [];
  for (const px of [x0 + 0.05, at(26.5), at(26.95), at(27.75), at(28.4), at(29.1), x1 - 0.05]) { const m = new THREE.Mesh(post, logs); m.position.set(px, y + 0.08 + (H + 0.1) / 2, z1 + 0.02); posts.push(m); }
  g.add(...posts);
  for (const [bx, r, h, col] of [[26.2, 0.17, 0.2, 0xb08a40], [27.05, 0.15, 0.12, 0x8a5a30]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 14), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); b.position.set(at(bx), y + 0.08 + h / 2, z1 + 0.25); g.add(b); }
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
    if (!open(x, y)) lay[k] = hutCell(x, y) ? CL.ground : CL.rock;
  }
  // the forest stands on a low bank (rock class: raised inside the blocked cells, its slope never reaching the path; mossy
  // on top, bare earth on its faces), so in battle 13 no blocked cell reads as a flat way through (DESIGN.md: what no unit
  // can reach is raised; tools/qa/sets.js), as on the land past the map
  const outside = () => CL.rock;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside, rockH: 0.5, lumpH: 0.04,
    tex: { dirt: T.dirt(0x8a806a, 'gravelPath'), turf: T.turf(0x2a5a1e), rock: T.dirt(0x5a4630, 'forestBank') },
    tint: { dirt: 0xf0ece0, turf: 0xd0e8c0, rock: 0xd8c8b0 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.5, topGreen: 1, bed: 0x2a3a2a }));
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
  S.add(forest = bamboo(pts));
  // the fire: none yet on a new build (the flames belong to the engine's effects, kept across builds), its warm light
  // flickering along the front once there is one
  FIRE.cols.clear(); FIRE.front = null; FIRE.ash = {};
  FIRE.wall = flameWall(S); S.add(FIRE.glow = frontGlow());
  FIRE.lights = [0, 1, 2].map(i => { const l = new THREE.PointLight(0xff7a2a, 0, 9, 1.6); l.position.set(40, 1.4, 2 + i * 5); S.add(l); return l; });
  let em = 0, sm = 0;
  E.world.updaters.push((dt, t) => {
    for (const [i, l] of FIRE.lights.entries()) { if (FIRE.front == null) { l.intensity = 0; continue; } l.position.x = FIRE.front + 0.2; l.intensity = 14 * (0.75 + 0.25 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.7 + i)); }
    if (FIRE.front == null) { FIRE.glow.material.opacity = 0; return; }
    FIRE.wall.tick(t); FIRE.glow.material.opacity = 0.85 * (0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3));
    const f = FIRE.front, rz = () => -3 + Math.random() * (MH + 6);
    // embers lifting off the front, drifting west on the wind, and dark smoke rolling up behind it
    for (em += dt; em > 0.02; em -= 0.02) { const z = rz(); E.vfx.spark(f + 0.2 + Math.random() * 0.8, land.at(f + 0.5, z) + 0.6 + Math.random() * 1.6, z, { vx: -0.3 - Math.random() * 1.1, vy: 0.8 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.4, life: 0.8 + Math.random() * 1.2, size: 0.02 + Math.random() * 0.03, r: 1, gg: 0.45 + Math.random() * 0.35, b: 0.12, shape: 1 }); }
    for (sm += dt; sm > 0.09; sm -= 0.09) { const z = rz(); E.vfx.smokePuff(f + 0.5 + Math.random() * 1.5, land.at(f + 1, z) + 1.6 + Math.random() * 0.8, z, { vx: -0.4 - Math.random() * 0.5, vy: 0.5 + Math.random() * 0.4, life: 3 + Math.random() * 2, size: 0.5, size1: 2.2 + Math.random(), tint: [0.16, 0.13, 0.12] }); }
  });
  // the white-flowering clumps at the path's edges, tufts along the verges, pale stones on the path
  S.add(grass(TUFTS.map(([x, z]) => [x, land.at(x, z), z]), { size: 0.75, cols: ['#e8f0c8', '#d0e0a0', '#f8f8e0', '#b8d088'] }));
  S.add(grass(land.scatter(CL.grass, 20, (x, z) => open(Math.floor(x), Math.floor(z)) || southOf(Math.floor(x), Math.floor(z)) <= 1), { size: 0.36, cols: ['#2e6a1e', '#4a8a24', '#1e5a18'] }));
  S.add(stones(await paleSpots(), T.material(T.rock(0xe0dcc8, 'stepStone', 0.15), {}, [0.5, 0.5]), { size: 0.17 }));   // the pale stepping stones the art strews on the path
  S.add(stones(lay.pebbles.filter(([x, z]) => open(Math.floor(x), Math.floor(z))).map(([x, z]) => [x, land.at(x, z), z]), T.material(T.rock(0xc8c4b0, 'paleStone', 0.2), {}, [0.5, 0.5]), { size: 0.12 }));
  E.world.updaters.push((dt, t) => windTick(t));
}

export default {
  build, ground: (x, z) => land ? land.at(x, z) : 0,
  props: (() => { const o = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (hutCell(x, y)) o.push([x, y]); return o; })(),   // the hut's cells: the hut blocks them (tools/qa/sets.js)
  // scene 26: the fire block laid down the east column (seeking to a later frame lays it again: once is enough)
  cell: (E, x, y, block) => { if (block === FIRE_BLOCK && !FIRE.cols.has(x)) ablaze(E, x); },
  // a green, quiet afternoon under the canes
  mood: { bg: 0xc8d8c0, voidCol: false, fog: 0xb8ccb0, fogD: 0.014, sky: 0xd0e8d8, under: 0x2a4a20, hemi: 1.0,
    sun: 0xfff0d0, sunI: 2.8, sunDir: [-0.4, 0.8, 0.4], sat: 1.05, exposure: 1.02, bloom: 0.3, aoR: 0.8,
    env: { top: 0xc8e0d0, mid: 0x7a9a6a, low: 0x2a4a20, lights: [[-6, 7, 3, 0xfff0d0, 3]] } },
};
