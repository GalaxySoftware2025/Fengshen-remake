// 海龍洞, the sea dragon's cave (maps 0ee250 and 0ee27c: scene 19; battle 10's four rooms, the first and last of them
// those two maps), remade: wet teal rock floors streaked by the tide, walls of dark rock speckled pink and cream rising
// into the black, pools of deep blue water, pink stalagmites, scattered pink pebbles and dark weed in the cracks. Built
// from the room's own grid: open cells are floor (the passages on, terrain 4, and back, 3, dark tunnels in the wall),
// the void (terrain 1) is the cave's wall, terrain 2 a pool where the art is water, else a rock outcrop, or a stalagmite
// standing alone. The first room's west shelf and the last room's hall are a step up, each reached by one stair; the
// other floors are level (the art's ledges and steps in rooms 1 and 2 join the floors at both ends: drawn, not climbed).
// Measured on the rooms' art (assets/battles/10/room-K.png) and grids.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones } from '../kit/terrain.js';
import { terraces, terracedAt } from '../kit/hill.js';
import { D, G } from '../rules.js';

const PALETTE = { [CL.ground]: [0x004848, 0x006c6c, 0x00b4b4, 0x244848, 0x009090], [CL.water]: [0x000048, 0x004890, 0x48b4fc] };
const UP = 0.75, LEDGE_H = 0.6;
// per room (by its art): the stair [x0, z0, x1, z1] from the step up (north end) down, a cell of each floor and its
// level, the cell the party comes in from (the flood fill's start), the scene's cast spots off the grid (way in)
const ROOMS = {
  '0ee250': { start: [4, 11], levels: [[4, 11, 0], [4, 3, UP]], stairs: [{ r: [5, 7, 7, 8], y0: UP, y: 0, n: 4 }], way: [[0, 14, 6, 15]] },
  room1: { start: [19, 2], levels: [[19, 2, 0]], stairs: [], deco: [{ r: [20, 9, 22, 10], n: 4 }] },
  room2: { start: [5, 13], levels: [[5, 13, 0]], stairs: [], deco: [{ r: [9, 8, 11, 9], n: 4 }, { r: [19, 8, 21, 9], n: 4 }] },
  '0ee27c': { start: [11, 12], levels: [[11, 12, 0], [10, 5, UP]], stairs: [{ r: [9, 8, 11, 9], y0: UP, y: 0, n: 4 }], way: [] },
};
const ART = { '0ee250': 'assets/maps/0ee250.png', room1: 'assets/battles/10/room-1.png', room2: 'assets/battles/10/room-2.png', '0ee27c': 'assets/maps/0ee27c.png' };
const ROOM_KEYS = ['0ee250', 'room1', 'room2', '0ee27c'];
let land = null, chestG = new Map(), M = null, world = null, cur = null;

// the void's side of an exit cell (where its tunnel opens): the first neighbour that is void
const voidSide = (tc, x, y) => [[0, -1], [1, 0], [-1, 0], [0, 1]].find(([dx, dy]) => tc(x + dx, y + dy) === 1) || [0, -1];
// a stalagmite: three or four pink-brown cones leaning together
function stalagmite(mat, x, z, y, s) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const h = s * (0.9 - k * 0.18), r = s * (0.24 - k * 0.03), c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 3), mat);
    const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setX(i, p.getX(i) * (1 + Math.sin(yy * 9 + k) * 0.12)); }
    c.geometry.computeVertexNormals();
    c.position.set(x + (k ? Math.cos(k * 2.2) * s * 0.22 : 0), y + h / 2 - 0.05, z + (k ? Math.sin(k * 2.2) * s * 0.16 : 0)); c.rotation.set(Math.sin(k) * 0.12, k, Math.cos(k) * 0.12);
    g.add(c);
  }
  return shade(g);
}
// a tunnel on: a black arch in the wall over the exit cell, ragged rock round it
function tunnel(rockM, x, z, y, side) {
  const g = new THREE.Group(), w = 0.9, h = 1.3;
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h * 0.55); sh.absarc(0, h * 0.55, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshBasicMaterial({ color: 0x010203 }));
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h * 0.8, 1.6), new THREE.MeshBasicMaterial({ color: 0x010203 })); back.position.set(0, h * 0.4, -0.82);
  const arch = new THREE.Group(); arch.add(hole, back);
  for (let k = 0; k < 9; k++) { const a = Math.PI * k / 8, r = w / 2 + 0.12, b = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (k % 3) * 0.03, 1), rockM)); b.position.set(-Math.cos(a) * r, h * 0.55 + Math.sin(a) * r - (k === 0 || k === 8 ? 0.5 : 0), 0.05); arch.add(b); }
  const [dx, dz] = side; arch.rotation.y = Math.atan2(-dx, -dz); arch.position.set(x + dx * 0.45, y, z + dz * 0.45); g.add(arch);
  return g;
}

function setFor(fixedKey) {
  const keyNow = () => fixedKey || ROOM_KEYS[D.rooms ? G.room || 0 : 0];
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const key = keyNow(), R0 = ROOMS[key]; cur = key;
    const MW = D.mapW, MH = D.mapH, W = MW * 4;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const lay = await readLayout(ART[key], MW, MH, PALETTE, { [CL.water]: 1.5 });
    // terrain 2: a pool where most of the cell is water in the art, else rock; standing alone, a stalagmite
    const wet = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.water ? 1 : 0; return n >= 6; };
    const pool = (x, y) => tc(x, y) === 2 && wet(x, y), lone = (x, y) => tc(x, y) === 2 && !pool(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tc(x + dx, y + dy) === 2 || tc(x + dx, y + dy) === 1).length <= 1;   // (the wall counts: a rim cell is wall)
    const way = (x, y) => (R0.way || []).some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d);   // the scene's way in from off the grid
    const flat = (x, y) => pool(x, y) || lone(x, y) || way(x, y);
    const ledge = (x, y) => tc(x, y) === 2 && !pool(x, y) && !lone(x, y);   // terrain 2 that is neither water nor a stalagmite
    const t = terraces({ w: MW, h: MH, terrain: D.terrain, start: R0.start, levels: R0.levels, stairs: R0.stairs, flat });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (y * 4 + j) * W + x * 4 + i;
      lay[k] = t.walk(x, y) || way(x, y) || lone(x, y) ? CL.ground : pool(x, y) ? (lay[k] === CL.water ? CL.water : CL.grass) : ledge(x, y) ? CL.grass : CL.rock;   // (a pool's shore as the art draws it)
    }
    // the ledges: teal rock a step up from the floor beside them, their edges falling steeply (a field softened once)
    let LE = new Float32Array(W * MH * 4); for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) LE[j * W + i] = ledge(i >> 2, j >> 2) ? 1 : 0;
    { const N = new Float32Array(LE.length); for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) { let a = 0, n = 0; for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const ii = i + c, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= MH * 4) continue; a += LE[jj * W + ii]; n++; } N[j * W + i] = LE[j * W + i] ? a / n : 0; } LE = N; }
    const ledgeAt = (x, z) => { const i = Math.floor(x * 4), j = Math.floor(z * 4); if (i < 0 || j < 0 || i >= W || j >= MH * 4) return 0; const v = LE[j * W + i]; return v * v * (3 - 2 * v); };
    const outside = () => CL.rock;
    land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside, rockH: 1.8, rise: 2.6, lumpH: 0.03, waterDepth: 0.7,
      cap: (x, z) => z < MH - 0.7 ? 99 : 0.45 + Math.max(0, z - MH) * 0.5,
      ramps: R0.stairs.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
      tex: { dirt: T.dirt(0x1e7470, 'caveFloor'), turf: T.rock(0x1a5a58, 'caveLedge', 0.3), rock: T.rock(0x4a2a3a, 'caveWall', 0.35), rockTop: T.rock(0x140c12, 'caveTop', 0.3) },
      tint: { dirt: 0xc8fff8, turf: 0xb8f0e8, rock: 0xf0c0d0 } });
    const base = terracedAt(land, t);
    land.at = (x, z) => way(Math.floor(x), Math.floor(z)) ? 0 : base(x, z) + ledgeAt(x, z) * LEDGE_H;
    S.add(land.mesh({ dirtK: 0.35, rockK: 0.5, topGreen: 0, bed: 0x0a1630 }));
    // the pools: still deep blue water a little under the floor beside them
    const seen = new Set();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!pool(x, y) || seen.has(x + ',' + y)) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y, lv = 9;
      for (const q = [[x, y]]; q.length;) { const [a, b] = q.pop(); if (!pool(a, b) || seen.has(a + ',' + b)) continue; seen.add(a + ',' + b); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); lv = Math.min(lv, t.level(a, b)); q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      const wp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 1.6, y1 - y0 + 1.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x050c30, roughness: 0.18, metalness: 0.2, envMapIntensity: 0.9 }));
      wp.position.set((x0 + x1 + 1) / 2, lv - 0.22, (y0 + y1 + 1) / 2); wp.receiveShadow = true; S.add(wp);
    }
    const rockM = T.material(T.rock(0x8a5a6a, 'caveStone', 0.25), { color: 0xf0d0d8 }, [0.5, 0.5]);
    const pinkM = T.material(T.rock(0xc87888, 'stalagmite', 0.15), { color: 0xffe0e8, roughness: 0.55 }, [0.5, 0.5]);
    loneCells = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (lone(x, y)) { S.add(stalagmite(pinkM, x + 0.5, y + 0.55, land.at(x + 0.5, y + 0.5), 0.9)); loneCells.push([x, y]); }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) S.add(tunnel(rockM, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), voidSide(tc, x, y)));
    // the art's steps where a ledge is drawn and not climbed: flat stone slabs set in the floor
    const slab = T.material(T.bricks(0x2a6a66, 2, 'caveSlab'), {}, [1, 1]);
    for (const d of R0.deco || []) { const [x0, z0, x1, z1] = d.r, parts = []; for (let k = 0; k < d.n; k++) { const za = z0 + (z1 - z0) * k / d.n; parts.push(box(slab, x0 + 0.08, -0.04, za + 0.02, x1 - 0.08, 0.03, za + (z1 - z0) / d.n - 0.02)); } S.add(shade(merged(slab, parts))); }
    for (const s of R0.stairs) {   // stone steps on the stairs
      const [x0, z0, x1, z1] = s.r, dz = (z1 - z0) / s.n, parts = [];
      for (let k = 0; k <= s.n; k++) { const h = s.y0 + (s.y - s.y0) * k / s.n, za = z0 + Math.max(0, k - 0.5) * dz, zb = z0 + Math.min(s.n, k + 0.5) * dz; parts.push(box(slab, x0 + 0.06, h - 0.12, za + 0.01, x1 - 0.06, h + 0.03, zb - 0.01)); }
      S.add(shade(merged(slab, parts)));
    }
    // the room's chests (as they were left: a battle in rooms keeps them per room)
    const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => Object.assign({ open: false }, c));   // (before the battle is set up: the room's own)
    for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, land.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(g); chestG.set(c.x + ',' + c.y, g); }
    // pink pebbles and dark weed in the floor's cracks
    const clear = (x, z) => !chests.some(c => x > c.x - 0.2 && x < c.x + 1.2 && z > c.y - 0.2 && z < c.y + 1.2) && !t.inStair(x, z);
    const floorPts = land.scatter(CL.ground, 1.2, (x, z) => clear(x, z) && t.walk(Math.floor(x), Math.floor(z)));
    S.add(stones(floorPts, pinkM, { size: 0.07 }));
    S.add(grass(land.scatter(CL.ground, 1.0, (x, z) => clear(x, z) && t.walk(Math.floor(x), Math.floor(z))), { size: 0.3, cols: ['#0a2a30', '#14363a', '#0e3034'] }));
    S.add(stones(land.scatter(CL.rock, 1.4, (x, z) => land.weight(x, z, CL.ground) > 0.1), rockM, { size: 0.2 }));
    E.world.updaters.push(() => {});
  }
  let loneCells = [];
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'dust',
    get props() { return loneCells; },   // the stalagmites' cells (tools/qa/sets.js)
    get slopes() { const R0 = ROOMS[keyNow()]; return R0.stairs.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; }); },
    // the sea's cold light down in the rock: a cyan fill, a pale light from above, the walls falling into black
    mood: { bg: 0x020406, voidCol: 0x020406, voidY: -1.5, fog: 0x02080a, fogD: 0.015, sky: 0xb8f0f8, under: 0x184048, hemi: 1.15,
      sun: 0xe0f4ff, sunI: 2.8, sunDir: [-0.25, 0.9, 0.35], sat: 1.08, exposure: 1.25, bloom: 0.35, aoR: 0.8,
      env: { top: 0x6ab0b8, mid: 0x2a5a60, low: 0x0a1418, lights: [[0, 7, 3, 0xd8f8ff, 3]] } },
  };
}
export const caveEntry = setFor('0ee250');
export const caveHall = setFor('0ee27c');
export default setFor(null);   // battle 10: the room the party is in
