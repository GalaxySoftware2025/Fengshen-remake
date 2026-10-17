// 火巖窟, the fire cave (maps 0f1ffc and 0f2034: scene 27; battle 14's two rooms, those two maps), remade: floors of
// scorched red-brown rock streaked with ash, cliffs of dark volcanic stone, a river of lava across the cave (rows 16-21)
// and a lake of it round an island in 龍鬚虎's lair, glowing and slowly moving (the original turns five of its colours
// round every 10 frames: the frame hook 0x0F2070), grey boulders standing in the floor, skulls and bones strewn about.
// Measured on tools/qa/grid.py (0f1ffc, 0f2034) and the rooms' grids. In the first room the way in (the heroes at
// (2-4, 4-5)) is an upper floor; two flights cut in the cliffs (x 5-6, rows 9-12; x 19-21, rows 7-11) go down to the
// cave's floor, which falls away into the dark at its south-west and south-east; the way on is a hole in the rock at
// (19, 30). Built from each room's grid: open cells are floor; terrain 2 is lava where the art is lava, a boulder where it
// stands alone, else cliff; the dark beyond (terrain 1) is the cave's rock.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest } from '../kit/parts.js';
import { readLayout, Land, CL, stones } from '../kit/terrain.js';
import { terraces, terracedAt } from '../kit/hill.js';
import { spire, tunnel, voidSide } from './cave.js';
import { D, G } from '../rules.js';

const UP = 0.9;
const LAVA = [0xfcd800, 0xfc9000, 0xd84800, 0xb42400];
const ROOMS = {
  main: { art: () => 'assets/maps/0f1ffc.png', start: [4, 5], levels: [[4, 5, UP], [12, 14, 0]],
    stairs: [{ r: [5, 9, 7, 13], y0: UP, y: 0, n: 5 }, { r: [19, 7, 22, 12], y0: UP, y: 0, n: 6 }] },
  lair: { art: key => key === '0f2034' ? 'assets/maps/0f2034.png' : 'assets/battles/14/room-1.png', start: [7, 7], levels: [[7, 7, 0]], stairs: [] },
};
const PALETTE = { [CL.ground]: [0xb44800, 0x480000, 0x240000, 0xd89048, 0x904848, 0xb49048], [CL.water]: LAVA, [CL.rock]: [0x000000, 0x6c0000] };

// a skull, whitened, half sunk in the ash; a long bone beside it
function bones(mat, x, z, y, k) {
  const g = new THREE.Group(), s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat); s.scale.set(1, 0.85, 1.15); s.position.y = 0.04; g.add(s);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.05), mat); jaw.position.set(0, 0.0, 0.05); g.add(jaw);
  const eye = new THREE.MeshBasicMaterial({ color: 0x1a0a04 });
  for (const sx of [-0.022, 0.022]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), eye); e.position.set(sx, 0.05, 0.058); g.add(e); }
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), mat); b.rotation.set(Math.PI / 2, 0, k * 2.3); b.position.set(0.1, 0.012, 0.02); g.add(b);
  g.position.set(x, y, z); g.rotation.y = k * 6.3; g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g;
}

function setFor(fixedKey) {
  const roomNow = () => fixedKey === '0f2034' ? 'lair' : fixedKey === '0f1ffc' ? 'main' : (D.rooms && G.room ? 'lair' : 'main');
  let land = null, chestG = new Map(), M = null, world = null, boulderCells = [], slopesNow = [];
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const R0 = ROOMS[roomNow()], art = R0.art(fixedKey);
    const MW = D.mapW, MH = D.mapH, W = MW * 4;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const lay = await readLayout(art, MW, MH, PALETTE, { [CL.water]: 1.2 });
    const lavaQ = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.water ? 1 : 0; return n; };
    const lava = (x, y) => tc(x, y) === 2 && lavaQ(x, y) >= 8;
    const lone = (x, y) => tc(x, y) === 2 && !lava(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => (tc(x + dx, y + dy) === 2 && !lava(x + dx, y + dy)) || tc(x + dx, y + dy) === 1).length <= 1;
    // floor the art draws on a blocked cell ringed by lava (the lair's island): level, out of reach
    const groundQ = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.ground ? 1 : 0; return n; };
    const isle = (x, y) => tc(x, y) === 2 && !lava(x, y) && !lone(x, y) && groundQ(x, y) >= 10 && [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => lava(x + dx, y + dy));
    const t = terraces({ w: MW, h: MH, terrain: D.terrain, start: R0.start, levels: R0.levels, stairs: R0.stairs, flat: (x, y) => lava(x, y) || lone(x, y) || isle(x, y) });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (y * 4 + j) * W + x * 4 + i;
      lay[k] = t.walk(x, y) || lone(x, y) || isle(x, y) ? CL.ground : lava(x, y) ? (lay[k] === CL.water ? CL.water : CL.ground) : CL.rock;   // (the lava's shore as the art draws it)
    }
    land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside: () => CL.rock, rockH: 1.7, rise: 2.4, lumpH: 0.04, waterDepth: 0.55,
      cap: (x, z) => z < MH - 0.7 ? 99 : 0.45 + Math.max(0, z - MH) * 0.5,
      ramps: R0.stairs.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
      tex: { dirt: T.dirt(0x8a4a20, 'ashFloor'), turf: T.dirt(0x6a2a10, 'ashShore'), rock: T.rock(0x3a1a12, 'lavaRock', 0.5), rockTop: T.rock(0x140806, 'lavaTop', 0.3) },
      tint: { dirt: 0xf0d8c0, turf: 0xe8c0a0, rock: 0xd8c0b8 } });
    land.at = terracedAt(land, t);
    S.add(land.mesh({ dirtK: 0.35, rockK: 0.5, topGreen: 0, bed: 0x2a0800 }));
    // the lava: each pool a slab of slowly moving molten rock, its light on the walls round it
    const seen = new Set();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!lava(x, y) || seen.has(x + ',' + y)) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y, lv = 9;
      for (const q = [[x, y]]; q.length;) { const [a, b] = q.pop(); if (!lava(a, b) || seen.has(a + ',' + b)) continue; seen.add(a + ',' + b); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); lv = Math.min(lv, t.level(a, b)); q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      FX.water(S, { r: [x0 - 0.4, y0 - 0.4, x1 + 1.4, y1 + 1.4], y: lv - 0.3, deep: 0x8a1400, lit: 0xffb020, stars: 0.4 });
      for (let ly = y0; ly <= y1; ly += 4) for (let lx = x0; lx <= x1; lx += 5) if (lava(lx, ly)) { const L = new THREE.PointLight(0xff8a30, 1.6, 5, 1.8); L.position.set(lx + 0.5, lv + 0.6, ly + 0.5); S.add(L); }
    }
    const rockM = T.material(T.rock(0x4a2a20, 'cinder', 0.4), { color: 0xe8c8b8 }, [0.5, 0.5]);
    const greyM = T.material(T.rock(0x7a7a78, 'boulderGrey', 0.3), { color: 0xe8e8e4, roughness: 0.7 }, [0.5, 0.5]);
    boulderCells = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (isle(x, y)) boulderCells.push([x, y]);   // (the island's cells: out of reach, tools/qa/sets.js)
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (lone(x, y)) { S.add(spire(greyM, x + 0.5, y + 0.55, land.at(x + 0.5, y + 0.5), 0.75)); boulderCells.push([x, y]); }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) S.add(tunnel(rockM, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), voidSide(tc, x, y)));
    // skulls and bones where the art strews them (its little pale clusters on the floor)
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = art; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0);
    const px = g2.getImageData(0, 0, img.width, img.height).data, pale = new Set([0xfcfcd8, 0xd8d8d8, 0xfcfcfc]), boneM = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.8 });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!t.walk(x, y)) continue; let n = 0, sx = 0, sz = 0;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4; if (pale.has((px[k] << 16) | (px[k + 1] << 8) | px[k + 2])) { n++; sx += i; sz += j; } }
      if (n >= 6) { const bx = x + sx / n / 32, bz = y + sz / n / 32; S.add(bones(boneM, bx, bz, land.at(bx, bz), (x * 7 + y * 3) % 10 / 10)); }
    }
    // the chests as left
    const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => Object.assign({ open: false }, c));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, land.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    S.add(stones(land.scatter(CL.rock, 1.4, (x, z) => land.weight(x, z, CL.ground) > 0.1), rockM, { size: 0.2 }));
    S.add(stones(land.scatter(CL.ground, 0.5, (x, z) => t.walk(Math.floor(x), Math.floor(z)) && !t.inStair(x, z) && !chests.some(c => Math.floor(x) === c.x && Math.floor(z) === c.y)), rockM, { size: 0.06 }));
    slopesNow = R0.stairs.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; });
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => land ? land.at(x, z) : 0,
    get props() { return boulderCells; }, get slopes() { return slopesNow; },
    // the lava's red glow from below, the cave's dark above
    mood: { bg: 0x0a0503, voidCol: 0x0a0503, voidY: -1.5, fog: 0x140806, fogD: 0.016, sky: 0xffe4cc, under: 0x4a2414, hemi: 0.95,
      sun: 0xfff0e0, sunI: 2.3, sunDir: [-0.3, 0.9, 0.35], sat: 0.98, exposure: 1.1, bloom: 0.45, aoR: 0.8,
      env: { top: 0x7a5a48, mid: 0x4a2a1c, low: 0x200a04, lights: [[0, 7, 3, 0xffe0c8, 3]] } },
  };
}
export const fireCave = setFor('0f1ffc');
export const fireLair = setFor('0f2034');
export default setFor(null);   // battle 14: the room the party is in
