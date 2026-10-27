// 傅山山谷 (maps 0e8caa / 0e8ce6, and battle 1's map, the same art), remade: a sandy road winding west between steep
// ridges of rock grown over with forest (the original's dark masses), patches of tall turf on the road, stones; the
// 龍安城 supply cart at (23-24, 4) and a chest at (19, 2) on a shelf in the north ridge. Afternoon sun.
// The cart follows the original: in scene 0 it is two sprites (079716 the front with the shafts, 079b24 the back) that
// roll in with the escort, played here by the model (standIn); the cell edits clear it from the map at the start and
// draw it in when the battle begins (blocks 34 / 35). The chest opens when a hero opens it in battle (openChest); the hidden one at (30, 6) shows up open and empty when struck.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, haunch } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const PALETTE = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800], [CL.grass]: [0xb49024, 0xd8b448, 0x242400], [CL.rock]: [0x24006c, 0x000000, 0x482400, 0x906c00, 0xd8b400] };   // 242400 is the grass patches' dark (measured), not rock
const CHEST = [19, 2], CART = { x: 24.05, z: 4.72 };   // the cart keeps to the south half of its row: anyone standing a row behind it stays in view
let land = null, cartG = null, chestG = null, M = null, world = null;

function cart(Mt) {   // the supply wagon, shafts to the west: plank bed on an axle, two spoked wheels, heaped with meat
  const g = new THREE.Group(), wood = T.material(T.planks(0x7a5230, 2), {}), dark = T.material(T.wood(0x3e2a18, 'cartBeam'), {});
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.45 });
  g.add(box(wood, -0.55, 0.34, -0.36, 0.55, 0.42, 0.36, 2));                                   // the bed (low: the original's cart is one cell tall)
  for (const z of [-0.36, 0.33]) g.add(box(wood, -0.55, 0.42, z, 0.55, 0.54, z + 0.03, 2));    // side boards
  g.add(box(wood, 0.52, 0.42, -0.36, 0.55, 0.54, 0.36, 2));
  g.add(box(dark, -0.62, 0.28, -0.3, 0.62, 0.34, -0.24)); g.add(box(dark, -0.62, 0.28, 0.24, 0.62, 0.34, 0.3));   // frame rails
  for (const z of [-0.2, 0.2]) { const s = box(dark, -1.25, 0.26, z - 0.025, -0.55, 0.31, z + 0.025); g.add(s); }   // shafts
  g.add(box(dark, -1.27, 0.22, -0.24, -1.2, 0.28, 0.24));                                       // the yoke bar
  // the load: the original draws a cream-and-red heap filling the bed, the same as 林雲's hand cart carries in scene 1
  // (07b34e): the haunch of meat, stretched to this longer bed, its bone end out over the front
  const load = haunch(); load.position.set(0.04, -0.02, 0); load.scale.set(1.22, 1, 1); g.add(load);
  const sack = new THREE.MeshStandardMaterial({ color: 0xb89a62, roughness: 1 });   // and the hand cart's sacks round it
  for (const [x, z, r] of [[0.38, 0.22, 0.13], [0.42, -0.2, 0.12], [-0.38, 0.24, 0.11]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), sack); m.scale.set(1, 0.8, 1); m.position.set(x, 0.42 + r * 0.7, z); g.add(shade(m)); }
  // wheels on the axle at the back half
  const wheels = g.userData.wheels = [];
  for (const z of [-0.42, 0.42]) {
    const w = new THREE.Group(); wheels.push(w);
    w.add(shade(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.032, 8, 24), dark)));
    w.add(shade(new THREE.Mesh(new THREE.TorusGeometry(0.274, 0.011, 6, 24), iron)));
    for (let k = 0; k < 8; k++) { const sp = box(dark, -0.012, 0, -0.012, 0.012, 0.25, 0.012); sp.rotation.z = k * Math.PI / 4; w.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10).rotateX(Math.PI / 2), dark); w.add(shade(hub));
    w.position.set(0.22, 0.27, z); g.add(w);
  }
  g.add(box(dark, 0.18, 0.24, -0.44, 0.26, 0.3, 0.44));                                        // axle
  const prop = box(dark, -0.6, 0, -0.03, -0.55, 0.3, 0.03); g.add(prop);                       // the prop under the front
  g.position.set(CART.x, land.at(CART.x, CART.z), CART.z); g.rotation.y = 0.06; g.scale.set(1, 1, 0.8);
  g.userData.standIn = 1;   // (a sprite's model, moving with the scene: tools/qa/sets.js leaves it out of what actors stand in)
  return shade(g);
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world;
  const lay = await readLayout('assets/maps/0e8caa.png', 32, 10, PALETTE);
  const W = 32 * 4;
  // the land follows the game's own grid (D.terrain: the battle's, or the scene map's, the same): a cell anyone may enter
  // is level ground, whatever its edge pixels say; the blocked cells keep the art's ragged outline (the cliffs then
  // rise inside them, never over a cell a unit can stand on, and do not come out box-straight)
  for (let cy = 0; cy < 10; cy++) for (let cx = 0; cx < 32; cx++) {
    const t = D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 0, blocked = t === 1 || t === 2;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (cy * 4 + j) * W + cx * 4 + i;
      if (!blocked && lay[k] === CL.rock) lay[k] = CL.ground;
      else if (cy === 9) lay[k] = CL.rock;   // row 9 holds the art's spare tiles: ridge
    }
  }
  // fray the foot of the cliffs where they meet a walkable cell: some rock samples along that side of a blocked cell
  // become ground (one sample in, often; two, now and then), so the edge does not follow the cell lines
  const walk = (cx, cy) => { const t = D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 1; return cx >= 0 && cx < 32 && cy >= 0 && cy < 9 && t !== 1 && t !== 2; };
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let j = 0; j < 36; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, cx = i >> 2, cy = j >> 2, sx = i & 3, sy = j & 3; if (lay[k] !== CL.rock || walk(cx, cy)) continue;
    const d = Math.min(walk(cx - 1, cy) ? sx : 9, walk(cx + 1, cy) ? 3 - sx : 9, walk(cx, cy - 1) ? sy : 9, walk(cx, cy + 1) ? 3 - sy : 9);
    if ((d === 0 && hash(i, j) < 0.55) || (d === 1 && hash(i, j) < 0.2)) lay[k] = CL.ground;
  }
  lay.pebbles = lay.pebbles.filter(([x, z]) => { const t = D.terrain && D.terrain[Math.floor(z)] ? D.terrain[Math.floor(z)][Math.floor(x)] : 0; return t !== 1 && t !== 2; });
  for (let j = CHEST[1] * 4; j < CHEST[1] * 4 + 4; j++) for (let i = CHEST[0] * 4; i < CHEST[0] * 4 + 4; i++) lay[j * W + i] = CL.ground;   // the chest's shelf
  for (let j = 16; j < 20; j++) for (let i = 92; i < 100; i++) lay[j * W + i] = CL.ground;   // the cart's cells: road under it
  land = new Land({ w: 32, h: 10, layout: lay, ext: 12, rockH: 1.5, rise: 2.6, lumpH: 0.06,
    tex: { dirt: T.dirt(0xc89a62, 'valleyDirt'), turf: T.turf(0x8a8a3a), rock: T.rock(0x6a6058, 'valleyRock', 0.2) },
    tint: { dirt: 0xfff2e0, turf: 0xe8e8c0, rock: 0xd8c4b0 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.34, topGreen: 1 }));   // the ridges are overgrown on top, bare on their faces
  // the cart and the chest
  cartG = cart(M); S.add(cartG); lastX = null;
  chestG = chest(M, CHEST[0] + 0.5, CHEST[1] + 0.5, land.at(CHEST[0] + 0.5, CHEST[1] + 0.5), false, 0, 1.4); S.add(chestG);
  // plants and stones: tall turf on the grass patches, scrub and dense trees over the ridges
  const clear = (x, z) => !(Math.abs(x - CART.x) < 1.4 && Math.abs(z - CART.z) < 0.8) && !(x > CHEST[0] - 0.2 && x < CHEST[0] + 1.2 && z > CHEST[1] - 0.2 && z < CHEST[1] + 1.2);
  S.add(grass(land.scatter(CL.grass, 110, clear), { size: 0.55, cols: ['#9a9a40', '#b4aa50', '#7a8030', '#c8bc60', '#8a8a38'] }));
  S.add(grass(land.scatter(CL.ground, 2.5, (x, z) => clear(x, z) && land.weight(x, z, CL.rock) > 0.05), { size: 0.4, cols: ['#a09848', '#8a8a3a', '#b0a050'] }));   // tufts along the foot of the ridges
  const rockM = T.material(T.rock(0x6a6058, 'valleyRock', 0.2), { color: 0xf0dcc0 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]), ...land.scatter(CL.ground, 0.3, clear)], rockM, { size: 0.13 }));
  const up = (x, z) => land.rawH(x, z) > 0.7;
  const into = (x, z) => land.dist[Math.floor((z + 12) * 4) * land.W + Math.floor((x + 12) * 4)] || 0;   // samples into the rock
  S.add(shrubs(land.scatter(CL.rock, 2.4, (x, z) => up(x, z) && into(x, z) > 2), { size: 0.46, cols: ['#4a5a2a', '#5a6a30', '#66783a', '#3e4c24'] }));
  const near = z => z > 6 && z < 14;   // the south ridge, between the camera and the road: no tall trees there (they would hide the units)
  S.add(pines(land.scatter(CL.rock, 0.24, (x, z) => into(x, z) > 5 && !near(z)), { size: 1.0, cols: ['#34482a', '#405834', '#4c663a', '#2c3e22'] }));   // trees only well inside the ridges: the road stays open
  E.world.updaters.push((dt, t) => windTick(t));
}

// the original's cell edits on (23, 4) / (24, 4): blocks 34 / 35 draw the cart, 3 / 28 the road without it
function cell(E, x, y, block) {
  if (y !== 4 || (x !== 23 && x !== 24) || !cartG) return;
  cartG.visible = block === 34 || block === 35;
}
// scene 0: the cart's two sprites; the model follows the front one (its centre is half a cell behind it), wheels turning
let lastX = null;
const standIn = {
  '079716': (E, x, z, moving) => {
    if (!cartG) return;
    const cx = x + 0.55, cz = z + 0.22; cartG.visible = true;
    if (lastX !== null) for (const w of cartG.userData.wheels) w.rotation.z += (lastX - cx) / 0.3;
    lastX = cx; cartG.position.set(cx, land.at(cx, cz), cz);
  },
  '079b24': () => {},
};
function openChest(x, y) {
  if (x !== CHEST[0] || y !== CHEST[1]) return found(x, y);
  if (!chestG) return;
  const p = chestG.position, S = chestG.parent; S.remove(chestG);
  chestG = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(chestG);
}
// a chest the map does not draw (battle 1's 舍利子 at (30, 6)): struck, it shows up where it was hidden, already open and
// empty, growing in from the ground with a little overshoot
function found(x, y) {
  if (!land || !world) return;
  const cx = x + 0.5, cz = y + 0.5, g = chest(M, cx, cz, land.at(cx, cz), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

export default {
  build, cell, openChest, standIn, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'bamboo',   // bamboo leaves on the wind, over battle 1 and scene 0 alike (one place) [the user's call]
  props: [[23, 4], [24, 4]],   // cells blocked by a model, not by the land (tools/qa/sets.js): the cart
  mood: { bg: 0xd8d4c4, voidCol: false, fog: 0xd8d0bc, fogD: 0.012, sky: 0xd8e4ff, under: 0x6a4a28, hemi: 1.05,
    sun: 0xffe2b0, sunI: 3.1, sunDir: [-0.5, 0.8, 0.35], sat: 1.05, exposure: 1.02, bloom: 0.35, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xc0b098, low: 0x6a5a40, lights: [[-6, 7, 3, 0xfff0d0, 4]] } },
};
