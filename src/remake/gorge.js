// 傅山山谷二 (map 0e92ae: scene 2 and battle 2), remade: the valley's sandy floor further north, crossed by two long
// ridges of rock grown over with scrub and trees (the original's dark bands), patches of tall turf, stones; in the
// north-east the land ends in cliffs over the sea, and a plank bridge leads off east from (29, 4) above the water.
// Late in the day, overcast (the mood below).
// A chest sits on the floor between the ridges at (16, 6); the one at (27, 3) the map does not draw (hidden, as
// battle 1's 舍利子): struck, it shows up open and empty.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, pines, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 32, MH = 15;
const PALETTE = { [CL.ground]: [0xb46c24, 0xd89024, 0xfcb46c, 0x904800], [CL.grass]: [0xb49024, 0xd8b448, 0x242400],
  [CL.rock]: [0x24006c, 0x000000, 0x482400, 0x906c00, 0xd8b400], [CL.water]: [0xfcfcfc, 0xb4fcfc, 0x00b4fc, 0x246cfc, 0x2400b4] };
const CHEST = [16, 6], BRIDGE = { x0: 28.55, z: 4.5, y: 0 }, SEA = -0.75;
let land = null, chestG = null, M = null, world = null;

// planks on two stringers over posts in the water, rope rails on posts at both sides; from x0 east to off the map
function bridge(Mt) {
  const g = new THREE.Group(), wood = T.material(T.planks(0x8a6038, 1), {}), dark = T.material(T.wood(0x4a3220, 'bridgeBeam'), {});
  const x1 = MW + 6, z = BRIDGE.z, half = 0.42, deck = BRIDGE.y + 0.02, planks = [];
  for (let x = BRIDGE.x0; x < x1; x += 0.24) {
    const p = box(wood, x, deck, z - half, x + 0.21, deck + 0.05, z + half, 2);
    p.rotation.y = Math.sin(x * 12.9) * 0.025; p.position.y += Math.sin(x * 7.3) * 0.008; planks.push(p);
  }
  g.add(merged(wood, planks));
  for (const s of [-1, 1]) g.add(box(dark, BRIDGE.x0, deck - 0.09, z + s * (half - 0.08) - 0.04, x1, deck, z + s * (half - 0.08) + 0.04));   // stringers
  const posts = [];
  for (let x = BRIDGE.x0 + 0.05; x < x1; x += 1.0) for (const s of [-1, 1]) {
    posts.push(box(dark, x - 0.05, SEA - 0.2, z + s * half - 0.05, x + 0.05, deck + 0.42, z + s * half + 0.05));
  }
  g.add(merged(dark, posts));
  const rope = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 });
  for (const s of [-1, 1]) {   // a rope rail sagging between posts
    const pts = []; for (let x = BRIDGE.x0 + 0.05; x <= x1; x += 0.1) { const u = ((x - BRIDGE.x0 - 0.05) % 1.0); pts.push(new THREE.Vector3(x, deck + 0.4 - Math.sin(u * Math.PI) * 0.06, z + s * half)); }
    g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.012, 5), rope)));
  }
  return shade(g);
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world;
  const lay = await readLayout('assets/maps/0e92ae.png', MW, MH, PALETTE, { [CL.water]: 1.4 });
  const W = MW * 4;
  // the land follows the game's own grid (D.terrain), as the valley: a cell anyone may enter is level ground (the
  // bridge's cells excepted: water under the planks); a blocked cell is cliff, or sea where the art has water (the
  // art's spare tiles, code 1 at row 14's ends, are cliff too)
  const tc = (cx, cy) => D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 0;
  // where anyone on foot can get to: the original's open cells joined to the hero's deploy cell (26, 12). The rest of
  // its open floor is walled off by the ridges (the plateau north of the north ridge, the west pocket, the strip at
  // rows 8-9 east): cliff here too, never open sand no one can reach
  const reach = new Set(), open = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH - 1 && tc(cx, cy) !== 1 && tc(cx, cy) !== 2;   // not the bottom row: its strip is cliff here ([design] the user's choice; battle 2's hook blocks it, 02-fushan.js)
  for (const q = [[26, 12]]; q.length;) {
    const [x, y] = q.shift(); if (!open(x, y) || reach.has(x + ',' + y)) continue;
    reach.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const onBridge = (cx, cy) => (cy === 4 || cy === 5) && cx >= 29;   // the sea under the bridge: its deck on row 4 (walkable), its south rail over row 5 (the original draws the bridge two rows deep)
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const t = tc(cx, cy), blocked = !reach.has(cx + ',' + cy);
    let wet = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) wet += lay[(cy * 4 + j) * W + cx * 4 + i] === CL.water ? 1 : 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (cy * 4 + j) * W + cx * 4 + i;
      if (onBridge(cx, cy)) lay[k] = CL.water;
      else if (!blocked && (lay[k] === CL.rock || lay[k] === CL.water)) lay[k] = CL.ground;
      // a cell no one may enter is cliff all over (the art's rims and grassy slopes too), or sea where the art has
      // mostly water: never half of each, which averages out to a flat ledge
      else if (blocked) lay[k] = wet >= 8 ? CL.water : CL.rock;
    }
  }
  // fray the foot of the cliffs where they meet a walkable cell (as the valley)
  const walk = (cx, cy) => reach.has(cx + ',' + cy);
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, cx = i >> 2, cy = j >> 2, sx = i & 3, sy = j & 3; if (lay[k] !== CL.rock || walk(cx, cy)) continue;
    const d = Math.min(walk(cx - 1, cy) ? sx : 9, walk(cx + 1, cy) ? 3 - sx : 9, walk(cx, cy - 1) ? sy : 9, walk(cx, cy + 1) ? 3 - sy : 9);
    const thin = (walk(cx - 1, cy) && walk(cx + 1, cy)) || (walk(cx, cy - 1) && walk(cx, cy + 1));   // a ridge one cell wide (the rims at rows 11-13): barely frayed, so it still stands as cliff
    if (thin ? d === 0 && hash(i, j) < 0.2 : (d === 0 && hash(i, j) < 0.55) || (d === 1 && hash(i, j) < 0.2)) lay[k] = CL.ground;
  }
  lay.pebbles = lay.pebbles.filter(([x, z]) => walk(Math.floor(x), Math.floor(z)));
  for (let j = CHEST[1] * 4; j < CHEST[1] * 4 + 4; j++) for (let i = CHEST[0] * 4; i < CHEST[0] * 4 + 4; i++) lay[j * W + i] = CL.ground;
  // and past the map: the sea north of the shore and east of the cliffs (as far as the bridge), cliff everywhere else
  // (low in front of the camera, south: cap below)
  const outside = (x, z) => (z < 0 && x > 5 - z * 0.6) || (x >= MW && z < 7 + (x - MW) * 0.3) ? CL.water : CL.rock;
  // the south edge, from row 12 down (the rim's boulder line, the bottom strip, past the map): one even band of cliff about
  // 1 high, low enough to hide no one standing behind it (a rim taller than the cliff below it read as a separate wall);
  // a shelf at x 27-30 on the last rows, where scene 2's men walk in from the bottom edge
  const cap = (x, z) => z < 12 ? 99 : (x > 26.5 && z > MH - 1.05 ? 0.5 : 1.0) + Math.max(0, z - MH) * 0.5;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, cap, rockH: 1.5, rise: 2.6, lumpH: 0.06, waterDepth: -SEA + 0.15,
    tex: { dirt: T.dirt(0xc89a62, 'valleyDirt'), turf: T.turf(0x8a8a3a), rock: T.rock(0x6a6058, 'valleyRock', 0.2) },
    tint: { dirt: 0xfff2e0, turf: 0xe8e8c0, rock: 0xd8c4b0 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.34, topGreen: 1, bed: 0x2a4a5a }));
  // the sea below the cliffs: a deep green-blue surface, glinting, a little foam drifting
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1c5470, roughness: 0.55, metalness: 0, envMapIntensity: 0.2 }));
  sea.position.set(MW / 2, SEA, MH / 2); sea.receiveShadow = true; S.add(sea);
  S.add(bridge(M));
  chestG = chest(M, CHEST[0] + 0.5, CHEST[1] + 0.5, land.at(CHEST[0] + 0.5, CHEST[1] + 0.5), false, 0, 1.4); S.add(chestG);
  // plants and stones, as the valley: tall turf on the grass, tufts at the foot of the ridges, scrub and trees on them
  const clear = (x, z) => !(x > CHEST[0] - 0.2 && x < CHEST[0] + 1.2 && z > CHEST[1] - 0.2 && z < CHEST[1] + 1.2) && !(z > 3.6 && z < 5.4 && x > 27.5);
  S.add(grass(land.scatter(CL.grass, 110, clear), { size: 0.55, cols: ['#9a9a40', '#b4aa50', '#7a8030', '#c8bc60', '#8a8a38'] }));
  S.add(grass(land.scatter(CL.ground, 2.5, (x, z) => clear(x, z) && land.weight(x, z, CL.rock) > 0.05), { size: 0.4, cols: ['#a09848', '#8a8a3a', '#b0a050'] }));
  const rockM = T.material(T.rock(0x6a6058, 'valleyRock', 0.2), { color: 0xf0dcc0 }, [0.5, 0.5]);
  S.add(stones([...lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]), ...land.scatter(CL.ground, 0.3, clear)], rockM, { size: 0.13 }));
  const up = (x, z) => land.rawH(x, z) > 0.7;
  const into = (x, z) => land.dist[Math.floor((z + 12) * 4) * land.W + Math.floor((x + 12) * 4)] || 0;
  S.add(shrubs(land.scatter(CL.rock, 2.4, (x, z) => up(x, z) && into(x, z) > 2), { size: 0.46, cols: ['#4a5a2a', '#5a6a30', '#66783a', '#3e4c24'] }));
  const near = z => z > 12.5 && z < 20;   // the south edge, between the camera and the floor: no tall trees there
  S.add(pines(land.scatter(CL.rock, 0.22, (x, z) => into(x, z) > 5 && !near(z)), { size: 1.0, cols: ['#34482a', '#405834', '#4c663a', '#2c3e22'] }));
  E.world.updaters.push((dt, t) => { windTick(t); sea.material.color.setHSL(0.55, 0.6, 0.26 + Math.sin(t * 0.7) * 0.01); });
}

function openChest(x, y) {
  if (x !== CHEST[0] || y !== CHEST[1]) return found(x, y);
  if (!chestG) return;
  const p = chestG.position, S = chestG.parent; S.remove(chestG);
  chestG = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(chestG);
}
// the chest the map does not draw (27, 3): struck, it shows up where it was hidden, open and empty
function found(x, y) {
  if (!land || !world) return;
  const cx = x + 0.5, cz = y + 0.5, g = chest(M, cx, cz, land.at(cx, cz), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

export default {
  build, openChest, viewShift: 2,   // scene 2's cast stands at the foot of the original's screen (its camera against the map's bottom edge)
  ground: (x, z) => land ? Math.max(land.at(x, z), (z > 4 && z < 5 && x > BRIDGE.x0) ? BRIDGE.y + 0.07 : -9) : 0,
  // late in the day under a low overcast sky, for scene 2 and battle 2 alike: a low pale sun, a cool grey fill, haze in
  // the gorge; darker by exposure and grade, the lights kept up (the move squares read the lit ground, battle.js
  // measureGround, before tone mapping: sand stays sand there)
  mood: { bg: 0x5a5a66, voidCol: false, fog: 0x605e68, fogD: 0.017, sky: 0x8c9cc0, under: 0x3a2c20, hemi: 0.85,
    sun: 0xffdcc0, sunI: 2.5, sunDir: [-0.75, 0.45, 0.3], sat: 0.8, exposure: 0.7, bloom: 0.26, aoR: 0.9,
    env: { top: 0x707c98, mid: 0x5c544c, low: 0x2a241c, lights: [[-7, 3.5, 3, 0xffa060, 2.2]] } },
};
