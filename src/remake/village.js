// 昌平村 (maps 004fd8 and 0e8fec: the same art; scene 1 and prologue part 2), remade: the original's layout (src/kit/terrain.js) of a sandy square with grass, cliffs to the
// north and west with a ledge, three tiled houses, woodpiles and boulders; an afternoon sun, chimney smoke, trees on
// the high ground.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, house, woodpile, shade, haunch } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';

const PALETTE = { [CL.ground]: [0xfcb46c, 0xd89024, 0xb46c24, 0x904824], [CL.grass]: [0x909000, 0xb4d800], [CL.rock]: [0x24006c, 0x242400, 0x000000, 0x6c4800, 0xb49000, 0xfcd800] };
const HOUSES = [
  { x0: 7.05, x1: 11.95, z0: 5.0, z1: 7.85, doors: [9.5], windows: [[7.4, 8.85], [10.15, 11.6]], posts: [8.95, 10.05] },
  { x0: 3.05, x1: 7.95, z0: 11.0, z1: 13.85, doors: [5.5], windows: [[3.4, 4.85], [6.15, 7.6]], posts: [4.95, 6.05] },
  { x0: 13.05, x1: 18.5, z0: 10.0, z1: 12.85, doors: [15.5], windows: [[13.4, 14.85], [16.15, 17.6]], posts: [14.95, 16.05] },
];
const PILES = [[12.5, 7.6], [13.5, 7.6], [12.5, 8.6], [11.5, 10.6], [12.5, 10.6], [12.5, 11.6]];
let land = null, houses = [], cartG = null, lastZ = null;
// 林雲's hand cart in scene 1 (sprites 07b34e above, 07b75c below: the original draws it as two pieces): a plank bed
// on two spoked wheels, two handles reaching back to whoever pushes it, loaded with a great haunch of meat (his hunt,
// scene 0) with his sword driven into it, sacks round it [the user's design]; played by this model (standIn)
function handcart() {
  const g = new THREE.Group(), wood = T.material(T.planks(0x8a6038, 2), {}), dark = T.material(T.wood(0x3e2a18, 'cartBeam'), {});
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.45 });
  const sack = new THREE.MeshStandardMaterial({ color: 0xb89a62, roughness: 1 });
  g.add(box(wood, -0.34, 0.36, -0.5, 0.34, 0.44, 0.42, 2));
  for (const x of [-0.34, 0.31]) g.add(box(wood, x, 0.44, -0.5, x + 0.03, 0.56, 0.42, 2));
  g.add(box(wood, -0.34, 0.44, -0.5, 0.34, 0.56, -0.47, 2));
  for (const x of [-0.24, 0.24]) g.add(box(dark, x - 0.025, 0.34, -0.45, x + 0.025, 0.4, 1.0));                    // the handles, back to the pusher (+z)
  g.add(box(dark, -0.27, 0.36, 0.92, 0.27, 0.41, 0.96));
  for (const x of [-0.2, 0.2]) g.add(box(dark, x - 0.02, 0, 0.3, x + 0.02, 0.36, 0.34));                           // the legs it rests on
  g.add(haunch());   // the meat (src/kit/parts.js), the same load as the supply cart's in scene 0 and battle 1
  // the sword driven down into it, leaning back: blade, gilt guard, red-wrapped grip, pommel
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8e4f0, metalness: 0.9, roughness: 0.25 }), goldM = new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 0.9, roughness: 0.35 });
  const sword = new THREE.Group();
  sword.add(box(steel, -0.035, 0, -0.008, 0.035, 0.5, 0.008));
  sword.add(box(goldM, -0.12, 0.5, -0.03, 0.12, 0.54, 0.03));
  sword.add(box(new THREE.MeshStandardMaterial({ color: 0x9a1a14, roughness: 0.8 }), -0.025, 0.54, -0.025, 0.025, 0.74, 0.025));
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), goldM); pom.position.y = 0.77; sword.add(pom);
  sword.position.set(0.08, 0.86, -0.1); sword.rotation.set(-0.35, 0.3, -0.25); g.add(shade(sword));
  for (const [x, z, r] of [[-0.2, 0.26, 0.13], [0.18, 0.28, 0.12], [0.02, 0.32, 0.11]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), sack); m.scale.set(1, 0.8, 1); m.position.set(x, 0.44 + r * 0.7, z); g.add(shade(m)); }
  const wheels = g.userData.wheels = [];
  for (const x of [-0.42, 0.42]) {
    const w = new THREE.Group(); wheels.push(w);
    w.add(shade(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 24), dark)), shade(new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.012, 6, 24), iron)));
    for (let k = 0; k < 8; k++) { const sp = box(dark, -0.012, 0, -0.012, 0.012, 0.29, 0.012); sp.rotation.z = k * Math.PI / 4; w.add(sp); }
    w.rotation.y = Math.PI / 2; w.position.set(x, 0.31, -0.15); g.add(w);
  }
  g.add(box(iron, -0.44, 0.29, -0.17, 0.44, 0.33, -0.13));
  return shade(g);
}
const standIn = {
  '07b34e': (E, x, z, moving) => {   // the cart's upper piece: the bed spans it and the cell below
    if (!cartG) { cartG = handcart(); E.world.scene.add(cartG); }
    const cz = z + 0.4; cartG.visible = true;
    if (lastZ !== null) for (const w of cartG.userData.wheels) w.rotation.x += (cz - lastZ) / 0.3;
    lastZ = cz; cartG.position.set(x, land ? land.at(x, cz) : 0, cz);
  },
  '07b75c': () => {},
  hide: (E, gfx) => { if (gfx === '07b34e' && cartG) cartG.visible = false; },   // its sprite gone (hidden away at f624)
};

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  const lay = await readLayout('assets/maps/004fd8.png', 16, 16, PALETTE, { [CL.grass]: 2.5 });
  // nothing of the houses' roofs or the woodpiles is ground cover: keep their cells plain
  land = new Land({ w: 16, h: 16, layout: lay, ext: 14, rockH: 0.85, rise: 2.0,
    plateaus: [{ r: [5.2, -16, 32, 1.1], h: 1.45 }, { r: [-16, -16, 1.9, 3.0], h: 1.45 }, { r: [-16, 3.35, 3.2, 5.45], h: 0.8 }],
    tex: { dirt: T.dirt(0xc89a62, 'villageDirt'), turf: T.turf(0x6a8a2a), rock: T.rock(0x7a6a5a, 'villageRock') },
    tint: { dirt: 0xffffff, turf: 0xf0ffe0, rock: 0xe0d8d0 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.3 }));
  houses = HOUSES.map(h => house(M, Object.assign({ y: land.at((h.x0 + h.x1) / 2, h.z1) - 0.02, wallH: 1.3, roof: 0x2a4a92, rise: 0.85, over: 0.32 }, h)));
  for (const h of houses) S.add(h);
  for (const [x, z] of PILES) S.add(woodpile(x, z, land.at(x, z), 0.8, 0.5));
  // the shed and the drying rack at the south edge
  const timber = T.material(T.wood(0x5a3820, 'timber'), {}), straw = T.material(T.planks(0xb89850, 8), {});
  S.add(house(M, { x0: 2.0, x1: 2.95, z0: 15.2, z1: 16.2, y: land.at(2.5, 15.5), wallH: 0.9, roof: 0x2a4a92, doors: [], windows: [], over: 0.2, rise: 0.4 }));
  const rack = new THREE.Group(); for (const x of [3.1, 3.9]) rack.add(box(timber, x - 0.04, 0, 15.4, x + 0.04, 1.0, 15.48)); for (const y of [0.45, 0.9]) rack.add(box(timber, 3.05, y, 15.4, 3.95, y + 0.05, 15.48));
  rack.add(box(straw, 3.12, 0.5, 15.35, 3.88, 0.88, 15.38)); rack.position.y = land.at(3.5, 15.4); S.add(shade(rack));
  // plants and stones
  const clear = (x, z) => !HOUSES.some(h => x > h.x0 - 0.5 && x < h.x1 + 0.5 && z > h.z0 - 0.6 && z < h.z1 + 0.4) && !PILES.some(([px, pz]) => Math.abs(px - x) < 0.55 && Math.abs(pz - z) < 0.45);
  S.add(grass(land.scatter(CL.grass, 70, clear), { size: 0.42, cols: ['#7a9a30', '#98b840', '#5a7a22', '#b0c858', '#6a8a2a'] }));
  S.add(grass(land.scatter(CL.ground, 2, clear), { size: 0.3, cols: ['#8a9a40', '#a0a850'] }));
  const rockM = T.material(T.rock(0x7a6a5a, 'villageRock'), { color: 0xd8c8b0 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.map(([x, z]) => [x, land.at(x, z), z]).filter(([x, , z]) => clear(x, z)), [4.5, land.at(4.5, 1.6), 1.6], [9.9, land.at(9.9, 3.4), 3.4], [2.4, land.at(2.4, 9.6), 9.6]], rockM, { size: 0.18 }));
  const high = (x, z) => land.at(x, z) > 1.0 && clear(x, z);
  S.add(shrubs(land.scatter(CL.rock, 0.8, high), { size: 0.5, cols: ['#3a5a22', '#4a6e2a', '#5a8034', '#2e4a1c'] }));
  S.add(shrubs([...land.scatter(CL.grass, 0.5, high), ...land.scatter(CL.ground, 0.25, high)], { size: 0.6, cols: ['#4a6e2a', '#5a8034', '#6a9040'] }));
  S.add(pines([...land.scatter(CL.ground, 0.12, (x, z) => high(x, z) && (z < -1 || x < -1)), ...land.scatter(CL.grass, 0.12, (x, z) => high(x, z) && (z < -1 || x < -1))], { size: 2.2, cols: ['#2a4a24', '#36583a', '#4a6a38', '#203a1c'] }));
  for (const [x, z] of [[8.2, 6.2], [4.4, 12.2]]) FX.smoke(E, { x, y: z, z: 2.6 });
  cartG = null; lastZ = null;
  E.world.updaters.push((dt, t) => windTick(t));
}

// the original swaps a house's door cells to an open doorway (blocks 60, 61) and back (52, 56): the first house's
// (9,6 / 9,7) as 林雲 steps out in prologue part 2, the second's (5,12 / 5,13) as 武吉 hides the cart in scene 1; here
// that house's doors swing open and shut
function cell(E, x, y, block) {
  const k0 = HOUSES.findIndex(h => h.doors.some(d => Math.floor(d) === x) && (y === Math.floor(h.z1) - 1 || y === Math.floor(h.z1)));
  if (k0 < 0 || !houses[k0]) return;
  const open = block === 60 || block === 61, doors = houses[k0].userData.doors;
  let k = 0; const step = () => { k = Math.min(1, k + 0.08); for (const d of doors) d.rotation.y = d.userData.open * (open ? k : 1 - k) * -1; if (k < 1) requestAnimationFrame(step); };
  if (doors.some(d => (Math.abs(d.rotation.y) > 0.5) !== open)) step();
}

export default {
  build, cell, standIn, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'leaves',
  mood: { bg: 0xcfd8d0, voidCol: false, fog: 0xcfd8d0, fogD: 0.012, sky: 0xcfe2ff, under: 0x5a4022, hemi: 1.1,
    sun: 0xffe0b0, sunI: 3.0, sunDir: [-0.55, 0.78, 0.32], sat: 1.06, exposure: 1.02, bloom: 0.4, shafts: true, aoR: 0.7,
    env: { top: 0xcfe2ff, mid: 0xb8b0a0, low: 0x6a5a40, lights: [[-6, 7, 3, 0xfff0d0, 4]] } },
};
