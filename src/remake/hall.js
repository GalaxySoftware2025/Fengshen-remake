// 西岐's underground training hall, 地下練功所 (maps 0ef160 and 0ef178: scene 23; battle 11's ten rooms, the first and
// last of them those two maps), remade: floors of warm brown earth (rooms 0-4) or teal cobbles (rooms 5-9) with moss in
// the hollows, light enough for the dark move squares (tools/qa/tiles.js, every room); carved from craggy rock rising
// steeply from the floor's edge (kit/terrain.js Land), slate broken into blue-grey facets with blue crystals growing out
// of its faces (0-4) or golden flowstone streaked with drips (5-9), calmer stone on top (the user's calls: not flat blue
// or yellow walls, not a red floor, not too busy); low enclosures of dry-stone walls, grey-green stone with moss on top; white steps going down at each way on or back
// (terrain 4 and 3); in the last room a stone dais behind a wooden rail, three chests on it, up three steps (x 11-13).
// Built from each room's own grid (terrain 1: the rock; terrain 2 touching it: rock too; any other terrain 2: the olive
// walls; the dais in room 9). Rock south of a floor stays low, so it hides no one behind it. Scene 23's native cut
// 0x0EED30: the middle chest opens on the 龍吟劍.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, CL, grass, Land } from '../kit/terrain.js';
import { D, G } from '../rules.js';

const LOW = 0.45, OLIVE = 0.55, DAIS = 0.4;
const ART = k => k === 0 ? 'assets/battles/11/map.png' : 'assets/battles/11/room-' + k + '.png';
const SCENE_ROOM = { '0ef160': 0, '0ef178': 9 };
const SCENE_CHESTS = { 0: [[5, 5]], 9: [[11, 6], [13, 6]] };
const DAIS_ROOM = 9, DAIS_R = [9, 5, 16, 10], STEPS = [11, 9, 14, 10], SWORD = [12, 6];
let world = null, M = null, chestG = new Map(), LV = null, BLOCKS = [], cur = 0, sword = null, land = null, isRock = () => false, cutTick = null;

// the sword in the middle chest: a long straight blade glowing pale blue, a gold guard and grip, standing upright
function swordModel(x, z, y) {
  const g = new THREE.Group(), blade = new THREE.MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x4a8adc, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.02), blade); b.position.y = 0.55; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), blade); tip.position.y = 0.98; tip.rotation.y = Math.PI / 4; g.add(tip);
  g.add(box(M.gold, -0.13, 0.13, -0.03, 0.13, 0.18, 0.03), box(new THREE.MeshStandardMaterial({ color: 0x3a2a6a, roughness: 0.6 }), -0.025, -0.05, -0.025, 0.025, 0.13, 0.025));
  const glow = new THREE.PointLight(0x8ac0ff, 1.6, 2.5, 1.6); glow.position.y = 0.6; g.add(glow);
  g.position.set(x, y, z); return shade(g);
}
// the rock's own stone (painted with v up the faces, as kit/terrain.js Land lays it on them): slate broken into angular
// facets, each its own shade of blue-grey, their edges catching a pale crystal light, now and then a vein of blue
// crystal (rooms 0-4); golden flowstone, drip streaks running down it over bands of darker and paler stone, dark in the
// runnels (5-9)
function slateTex() {
  return T.pbr('hallSlate', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 9, 151, 0.95), edge = T.smooth(0.07, 0.0, w1 - w0), n = T.fbm(u, v, 10, 5, 152), big = T.fbm(u, v, 3, 3, 153);
    const vein = T.smooth(0.035, 0.0, Math.abs(T.fbm(u, v, 4, 4, 154) - 0.5)) * T.smooth(0.45, 0.65, T.fbm(u, v, 2, 2, 155));
    let c = T.mixc([0.16, 0.18, 0.26], [0.42, 0.47, 0.6], id * 0.55 + n * 0.3 + big * 0.15);
    c = T.mixc(c, [0.5, 0.6, 0.82], edge * 0.25); c = T.mixc(c, [0.45, 0.62, 1.0], vein * 0.8);
    o.c = c; o.h = 0.35 + id * 0.25 + n * 0.25 - edge * 0.2 + vein * 0.1; o.r = 0.6 - vein * 0.3 - edge * 0.15;
  }, 6);
}
function flowTex() {
  return T.pbr('hallFlowstone', 1024, (u, v, o) => {
    const drip = T.fbmA(u, v, 18, 2, 4, 161), run = T.smooth(0.38, 0.28, drip), band = 0.5 + 0.5 * Math.sin((v * 7 + T.fbm(u, v, 2, 3, 162) * 2) * Math.PI * 2);
    const n = T.fbm(u, v, 8, 4, 163), [w0, w1] = T.worley(u, v, 5, 164, 0.9), crack = T.smooth(0.03, 0.0, w1 - w0) * T.smooth(0.55, 0.7, T.fbm(u, v, 3, 3, 165));
    let c = T.mixc([0.5, 0.36, 0.16], [0.78, 0.58, 0.28], drip * 0.45 + n * 0.4 + band * 0.15);
    c = T.mixc(c, [0.9, 0.76, 0.48], T.smooth(0.66, 0.82, drip) * 0.3); c = T.mixc(c, [0.24, 0.16, 0.07], Math.max(run * 0.3, crack * 0.25));
    o.c = c; o.h = 0.35 + drip * 0.3 + n * 0.15 - crack * 0.1; o.r = 0.72 - T.smooth(0.66, 0.82, drip) * 0.15;
  }, 3);
}
// the enclosures (the art's olive blocks): dry-stone walls of rough-hewn grey-green stone, two courses of blocks of
// uneven length, staggered, each a little out of true and its own shade, a cushion of moss along the top with tufts in
// it. cells: [x, y] of the wall; returns [stone mesh, moss mesh]
function stoneWall(cells, stoneM, mossM, h, seed) {
  let s = seed >>> 0; const rnd = () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
  const stone = [], moss = [], v = new THREE.Vector3();
  const block = (out, x0, y0, z0, x1, y1, z1, rough, col) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0, 3, 2, 3), p = g.attributes.position, w = (x1 - x0) / 2, hh = (y1 - y0) / 2, d = (z1 - z0) / 2;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const ex = Math.abs(v.x) / w, ey = Math.abs(v.y) / hh, ez = Math.abs(v.z) / d, corner = (ex > 0.99) + (ey > 0.99) + (ez > 0.99);
      const k = corner >= 2 ? 0.9 : 1, wx = x0 + w + v.x, wz = z0 + d + v.z, wy = y0 + hh + v.y;   // the edges knocked off, the faces uneven
      const n = (a, b, c) => (T.fbm(((wx * a + wy) / 5 % 1 + 1) % 1, ((wz * a + wy * b) / 5 % 1 + 1) % 1, 9, 3, c) - 0.5) * rough;
      p.setXYZ(i, v.x * (corner >= 2 ? 0.94 : 1) + n(1, 0.3, 71), v.y * k + n(0.7, 1, 72) * 0.6, v.z * (corner >= 2 ? 0.94 : 1) + n(1.3, 0.5, 73));
    }
    g.translate(x0 + w, y0 + hh, z0 + d); g.computeVertexNormals();
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.x + v.z) * 0.9, v.y * 0.9 + (Math.abs(g.attributes.normal.getY(i)) > 0.7 ? v.z * 0.9 : 0)); }
    const C = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) C.set(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.push(g.toNonIndexed());
  };
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  for (const [x, y] of cells) {
    const courses = [0, h * (0.48 + rnd() * 0.08), h];
    for (let c = 0; c < 2; c++) {
      const sx = 0.35 + rnd() * 0.3, sz = 0.35 + rnd() * 0.3, y0 = courses[c] + (c ? 0.006 : -0.05), y1 = courses[c + 1] - (c ? 0 : 0.006) + (c ? (rnd() - 0.5) * 0.05 : 0);
      for (const [a0, a1] of [[0, sx], [sx, 1]]) for (const [b0, b1] of [[0, sz], [sz, 1]]) {
        const g = 0.012, br = 0.78 + rnd() * 0.4, tint = rnd() * 0.08;
        block(stone, x + a0 + g, y0, y + b0 + g, x + a1 - g, y1, y + b1 - g, 0.05, [br - tint, br, br - tint * 1.5]);
      }
    }
    // moss on the top: soft cushions of it here and there, the stone showing between them
    for (let m = 0, n = 3 + Math.floor(rnd() * 3); m < n; m++) {
      const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, r = 0.13 + rnd() * 0.14, cx = x + r * 0.6 + rnd() * (1 - r * 1.2), cz = y + r * 0.6 + rnd() * (1 - r * 1.2);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.75 + 0.5 * T.fbm((v.x + 1) / 2, (v.z + 1) / 2, 3, 2, m + 81); p.setXYZ(i, cx + v.x * r * k, h + 0.005 + Math.max(-0.2, v.y) * (0.035 + rnd() * 0.004) * k, cz + v.z * r * k * (0.7 + 0.3 * rnd())); }
      g.computeVertexNormals(); const c = 0.75 + rnd() * 0.35, C = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) C.set([c * (0.9 + rnd() * 0.1), c, c * 0.85], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); moss.push(g.toNonIndexed());
    }
  }
  const merge = gs => { const P = [], N = [], U = [], C = []; for (const g of gs) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); U.push(...g.attributes.uv.array); C.push(...g.attributes.color.array); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g; };
  return [shade(new THREE.Mesh(merge(stone), stoneM)), shade(new THREE.Mesh(merge(moss), mossM))];
}
// crystals in the rock's faces: clusters of faceted prisms with pointed tips growing out of one point, outward and up.
// list: { x, y, z (the root), nx, nz (outward) }; each prism coloured from the palette, pale at its tip
function crystals(list, mat, o, seed) {
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const P = [], N = [], C = [], U = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  const tri = (a, b, c, ca, cb, cc) => { nrm.subVectors(b, a).cross(e1.subVectors(c, a)).normalize(); for (const [v, k] of [[a, ca], [b, cb], [c, cc]]) { P.push(v.x, v.y, v.z); N.push(nrm.x, nrm.y, nrm.z); U.push(0, 0); C.push(...k); } };
  for (const c of list) {
    const n = 3 + Math.floor(rnd() * 5), big = 0.7 + rnd() * 0.6;
    for (let k = 0; k < n; k++) {
      const d = new THREE.Vector3(c.nx * 0.75 + (rnd() - 0.5) * 0.9, 0.55 + rnd() * 0.7, c.nz * 0.75 + (rnd() - 0.5) * 0.9).normalize();
      const len = (o.len[0] + rnd() * (o.len[1] - o.len[0])) * big * (k ? 0.6 + rnd() * 0.4 : 1), r = len * (0.12 + rnd() * 0.08), sides = 6;
      const root = new THREE.Vector3(c.x + (rnd() - 0.5) * 0.12, c.y + (rnd() - 0.5) * 0.08, c.z + (rnd() - 0.5) * 0.12).addScaledVector(d, -len * 0.25);
      e2.set(0, 1, 0); if (Math.abs(d.y) > 0.95) e2.set(1, 0, 0); const sx = new THREE.Vector3().crossVectors(d, e2).normalize(), sz = new THREE.Vector3().crossVectors(d, sx);
      const pal = o.pal[Math.floor(rnd() * o.pal.length)], br = 0.8 + rnd() * 0.4, cf = pal.map(v => v * br * 0.35), cr = pal.map(v => v * br * 0.8), ct = pal.map(v => v * br * 1.15 + 0.08);
      const ring = (t, rr) => Array.from({ length: sides }, (_, i) => { const a = i / sides * Math.PI * 2; return root.clone().addScaledVector(d, t).addScaledVector(sx, Math.cos(a) * rr).addScaledVector(sz, Math.sin(a) * rr); });
      const B = ring(0, r * 0.9), Tp = ring(len * 0.72, r), tip = root.clone().addScaledVector(d, len);
      if (o.keep && !o.keep(tip, c)) continue;   // (none reaching out over the floor at a body's height)
      for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; tri(B[i], Tp[i], Tp[j], cf, cr, cr); tri(B[i], Tp[j], B[j], cf, cr, cf); tri(Tp[i], tip, Tp[j], cr, ct, cr); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return shade(new THREE.Mesh(g, mat), false);
}
function setFor(fixedKey) {
  const roomNow = () => fixedKey != null ? SCENE_ROOM[fixedKey] : (D.rooms ? G.room || 0 : 0);
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map(); sword = null;
    const k = roomNow(); cur = k;
    const MW = D.mapW, MH = D.mapH, stone = k >= 5;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const open = (x, y) => [0, 3, 4].includes(tc(x, y));
    const nearRock = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => tc(x + dx, y + dy) === 1);
    const inDais = (x, y) => k === DAIS_ROOM && x >= DAIS_R[0] && x < DAIS_R[2] && y >= DAIS_R[1] && y < DAIS_R[3];
    const chests = D.rooms && G.chests ? G.chests : D.n === 11 ? (D.chests || []).map(c => Object.assign({ open: false }, c)) : (SCENE_CHESTS[k] || []).map(([x, y]) => ({ x, y, open: false }));   // (a scene has no chest list: those the art draws)
    const chestCell = (x, y) => chests.some(c => c.x === x && c.y === y) || (k === DAIS_ROOM && x === SWORD[0] && y === SWORD[1]);
    const kind = (x, y) => { const t = tc(x, y); if (inDais(x, y)) return 'dais'; if (t === 1) return 'rock'; if (t === 2) return chestCell(x, y) ? 'floor' : nearRock(x, y) ? 'rock' : 'olive'; return 'floor'; };
    const lowRock = (x, y) => open(x, y - 1) || open(x, y - 2);   // rock south of a floor: low
    // the levels: floor, the dais, the exits' steps down; the olive walls as their own blocks (the rock: below)
    LV = new Levels(MW, MH, 4); const OL = new Levels(MW, MH, 4);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const kd = kind(x, y);
      if (kd === 'floor') LV.set(x, y, x + 1, y + 1, 0);
      else if (kd === 'dais') LV.set(x, y, x + 1, y + 1, DAIS);
      else if (kd === 'olive') { LV.set(x, y, x + 1, y + 1, 0); OL.set(x, y, x + 1, y + 1, OLIVE); }
    }
    const exits = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) { LV.stairs(x, y, x + 1, y + 1, -0.6, 0, 4, 'n'); exits.push([x, y]); }
    if (k === DAIS_ROOM) LV.stairs(STEPS[0], STEPS[1], STEPS[2], STEPS[3], 0, DAIS, 3, 's');
    const floorT = stone ? T.material(T.rock(0x56766f, 'hallCobble', 0.08), { color: 0xe4f2ee }, [1.6, 1.6]) : T.material(T.dirt(0x9c7454, 'hallEarth'), { color: 0xf4e8dc }, [1, 1]);
    S.add(LV.mesh(floorT, floorT, -1.2, 0.5)); BLOCKS = [OL];
    const oliveCells = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'olive') oliveCells.push([x, y]);
    const wallStone = T.material(T.rock(0x8a8a72, 'hallWallStone', 0.5), { color: 0xd8d8cc, vertexColors: true }, [1, 1]);
    const wallMoss = T.material(T.turf(0x3e5a24), { color: 0xc8d8b0, vertexColors: true }, [2, 2]);
    S.add(...stoneWall(oliveCells, wallStone, wallMoss, OLIVE, k * 53 + 5));
    // the rock: craggy, rising steeply from the floor's edge (kit/terrain.js Land), slate shot with blue (rooms 0-4) or
    // ochre flowstone (5-9); low south of a floor; its ground a little under the floor, cut open at the exits' steps
    const rockCell = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH || kind(x, y) === 'rock'; isRock = rockCell;
    const rl = new Uint8Array(MW * 4 * MH * 4); for (let j = 0; j < MH * 4; j++) for (let i = 0; i < MW * 4; i++) rl[j * MW * 4 + i] = rockCell(i >> 2, j >> 2) ? CL.rock : CL.ground;
    land = new Land({ w: MW, h: MH, layout: rl, ext: 6, outside: () => CL.rock, rockH: 1.45, rise: 2.4, lumpH: 0.01,
      cap: (x, z) => { const X = Math.floor(x), Y = Math.floor(z); return X >= 0 && Y >= 0 && X < MW && Y < MH && kind(X, Y) === 'rock' && lowRock(X, Y) ? LOW : 99; },
      carve: exits.map(([x, y]) => ({ r: [x, y, x + 1, y + 1], h: -1.4 })),
      tex: { dirt: T.dirt(0x5a4030, 'hallUnder'), turf: stone ? T.rock(0x7a6236, 'hallTopG', 0.25) : T.rock(0x3a4054, 'hallTopB', 0.6), rock: stone ? flowTex() : slateTex() },   // (turf: the tops, Land's topGreen)
      tint: { rock: 0xffffff } });
    const rockMesh = land.mesh({ rockK: 0.5, turfK: 0.4, topGreen: 1 }); rockMesh.position.y = -0.03; S.add(rockMesh);
    { // crags: the rock's surface broken up finer than the land's own lumps (the floor under the floor left flat)
      const p = rockMesh.geometry.attributes.position, w = v => ((v / 7) % 1 + 1) % 1;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y < 0.08) continue; const f = Math.min(1, (y - 0.08) / 0.3);
        p.setXYZ(i, x + (T.fbm(w(x), w(z + y), 22, 3, 41) - 0.5) * (stone ? 0.1 : 0.16) * f, y + (T.fbm(w(x + y), w(z), 26, 3, 42) - 0.5) * (stone ? 0.12 : 0.22) * f, z + (T.fbm(w(x + y), w(z), 22, 3, 43) - 0.5) * (stone ? 0.1 : 0.16) * f); }
      rockMesh.geometry.computeVertexNormals();
    }
    // crystals growing out of the faces: along each edge where the rock drops to the floor, now and then a cluster
    const clusters = []; let cs = k * 131 + 7; const crnd = () => { cs = (cs * 16807) % 2147483647; return cs / 2147483647; };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (kind(x, y) !== 'rock' || lowRock(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= MW || Y >= MH || rockCell(X, Y) || crnd() > (stone ? 0.4 : 0.75)) continue;
        const t = 0.15 + crnd() * 0.7, ex = dx ? (dx > 0 ? x + 1 : x) : x + t, ez = dy ? (dy > 0 ? y + 1 : y) : y + t;
        for (let q = 0.05; q < 1; q += 0.03) { const px = ex - dx * q, pz = ez - dy * q, h = land.at(px, pz) - 0.03; if (h > 0.3 + crnd() * 0.6) { clusters.push({ x: px, y: h, z: pz, nx: dx, nz: dy }); break; } }
      }
    }
    const crysM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1, emissive: stone ? 0x3a2006 : 0x10307a, emissiveIntensity: 0.9, flatShading: true });
    const keep = (p, c) => p.y > 1.1 || rockCell(Math.floor(p.x - c.nx * 0.12), Math.floor(p.z - c.nz * 0.12));
    S.add(crystals(clusters, crysM, stone ? { keep, len: [0.35, 0.65], pal: [[1.0, 0.66, 0.2], [1.0, 0.78, 0.32], [0.86, 0.5, 0.14]] }
      : { keep, len: [0.45, 0.85], pal: [[0.3, 0.5, 1.0], [0.42, 0.66, 1.0], [0.36, 0.4, 0.95], [0.55, 0.78, 1.0]] }, k * 977 + 13));
    // the exits: white steps down into a dark opening in the rock beyond
    const white = T.material(T.bricks(0xe8e4d8, 2, 'whiteSteps'), {}, [1, 1]);
    for (const [x, y] of exits) {
      const parts = []; for (let i = 0; i < 4; i++) { const h = -0.6 + 0.15 * (i + 1); parts.push(box(white, x + 0.08, h - 0.15, y + i * 0.25, x + 0.92, h, y + i * 0.25 + 0.25)); }
      S.add(shade(merged(white, parts)));
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), new THREE.MeshBasicMaterial({ color: 0x010101 })); hole.position.set(x + 0.5, -0.2, y + 0.02); S.add(hole);
    }
    // the dais: grey stone tiles, a wooden rail round it but for the steps
    if (k === DAIS_ROOM) {
      const tiles = T.material(T.bricks(0xa8a8a0, 3, 'daisTiles'), {}, [1, 1]), wood = T.material(T.wood(0x8a4a1c, 'daisRail'), { color: 0xffc890 }, [1, 1]);
      const [x0, z0, x1, z1] = DAIS_R, tp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.1, z1 - z0 - 0.1).rotateX(-Math.PI / 2), tiles); tp.position.set((x0 + x1) / 2, DAIS + 0.005, (z0 + z1) / 2); tp.receiveShadow = true; S.add(tp);
      const rail = [], posts = [];
      const run = (a, b, c, d) => { rail.push(box(wood, a, DAIS + 0.32, b, c, DAIS + 0.38, d), box(wood, a, DAIS + 0.12, b, c, DAIS + 0.16, d)); };
      run(x0 + 0.05, z0 + 0.05, x1 - 0.05, z0 + 0.13); run(x0 + 0.05, z0 + 0.05, x0 + 0.13, z1 - 0.05); run(x1 - 0.13, z0 + 0.05, x1 - 0.05, z1 - 0.05);
      run(x0 + 0.05, z1 - 0.13, STEPS[0], z1 - 0.05); run(STEPS[2], z1 - 0.13, x1 - 0.05, z1 - 0.05);
      for (let x = x0 + 0.09; x <= x1 - 0.08; x += 0.5) posts.push(box(wood, x - 0.04, DAIS, z0 + 0.05, x + 0.04, DAIS + 0.44, z0 + 0.13));
      for (let z = z0 + 0.5; z <= z1 - 0.08; z += 0.5) for (const x of [x0 + 0.09, x1 - 0.09]) posts.push(box(wood, x - 0.04, DAIS, z - 0.04, x + 0.04, DAIS + 0.44, z + 0.04));
      S.add(shade(merged(wood, rail)), shade(merged(wood, posts)));
      const st = []; for (let i = 0; i < 3; i++) { const h = DAIS * (i + 1) / 3; st.push(box(wood, STEPS[0] + 0.05, h - 0.06, STEPS[3] - (i + 1) / 3, STEPS[2] - 0.05, h, STEPS[3] - i / 3)); }
      S.add(shade(merged(wood, st)));
    }
    // the chests (as left), and in the last room the middle one the hook never lists: the 龍吟劍's
    const yAt = (x, z) => LV.at(x, z);
    for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, yAt(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(g); chestG.set(c.x + ',' + c.y, g); }
    if (k === DAIS_ROOM) { const [sx, sz] = SWORD, g = chest(M, sx + 0.5, sz + 0.5, DAIS, false, 0, 1.3); S.add(g); chestG.set(sx + ',' + sz, g); }
    // moss in the floor's hollows, where the art has it
    const lay = await readLayout(fixedKey ? 'assets/maps/' + fixedKey + '.png' : ART(k), MW, MH, { [CL.grass]: [0x004800, 0x489000] });
    const W = MW * 4, pts = [];
    for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) {
      if (lay[j * W + i] !== CL.grass) continue; const x = (i + Math.random()) / 4, z = (j + Math.random()) / 4;
      if (kind(Math.floor(x), Math.floor(z)) === 'floor' && open(Math.floor(x), Math.floor(z))) for (let n = 0; n < 2; n++) if (Math.random() < 0.8) pts.push([x + (Math.random() - 0.5) * 0.2, yAt(x, z), z + (Math.random() - 0.5) * 0.2]);
    }
    S.add(grass(pts, { size: 0.32, cols: ['#1e4a1a', '#2a5a20', '#14381a', '#3a6a24'] }));
    void FX;
  }
  function ground(x, z) {   // the floor, or the top of the rock or wall standing there
    if (!LV) return 0;
    if (land && isRock(Math.floor(x), Math.floor(z))) return land.at(x, z) - 0.03;
    for (const L of BLOCKS) { const i = Math.floor(x * L.R), j = Math.floor(z * L.R); if (i >= 0 && j >= 0 && i < L.w * L.R && j < L.h * L.R && !isNaN(L.H[j * L.w * L.R + i])) return L.H[j * L.w * L.R + i]; }
    return LV.at(x, z);
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S || !LV) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, LV.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
  }
  // scene 23 (native cut 0x0EED30): 姬發 stands before the middle chest (f76) and it opens at ev.open on the 龍吟劍, which
  // flashes from ev.found. The original only swaps the chest for an open one; the remake shows what he says at the end of
  // battle 11 he will do (open it with his own blood), the user's call: drops of his blood fall from his hand onto the lock,
  // the lid's seam kindles red, then gold, the lid swings open with gold light spilling up and the sword rises into place.
  // Everything is a function of the scene's clock (a seek shows that moment); drops and sparks only while it plays.
  function native(E, ev, clock) {
    if (ev.name !== 'sword' || !world) return;
    if (cutTick) cutTick.stop();   // a seek calls this again: one cut at a time
    const S = world.scene, [sx, sz] = SWORD, K = 1.3, P = new THREE.Vector3(sx + 0.5, DAIS, sz + 0.5);
    const BLOOD0 = ev.f + 20, BLOOD1 = ev.open - 22, KINDLE = ev.open - 52, OPEN = ev.open, SWING = 14, RISE = 30;
    // (he stands between us and the chest, back to us: the drops rise from his raised hand over his head and fall on the lid)
    const lock = P.clone().add(new THREE.Vector3(0, 0.48 * K, 0.02)), hand = new THREE.Vector3(P.x + 0.12, DAIS + 1.05, sz + 1.35);
    const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    // the lid kindles: a glowing shell over it (it swings with the lid), and a light inside the chest
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.61, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    seam.scale.set(1, 0.8, 1); seam.position.set(0, 0, 0.2); seam.renderOrder = 5;
    { const l0 = chestG.get(sx + ',' + sz); if (l0 && l0.children[1] && !l0.userData.open) l0.children[1].add(seam); }
    const inner = new THREE.PointLight(0xff4020, 0, 2.2, 1.6); inner.position.set(P.x, DAIS + 0.5, P.z + 0.15); S.add(inner);
    const drops = [], red = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.06, 0.05), toneMapped: false }), dropGeo = new THREE.SphereGeometry(0.05, 10, 8);
    let last = -1, nextDrop = BLOOD0;
    const lidOf = () => { const g = chestG.get(sx + ',' + sz); return g && g.children[1]; };
    const tick = dt => {
      if (world !== E.world) { tick.stop(); return; }
      const t = clock(), live = last >= 0 && t - last < 4 && t >= last;
      // the drops: each falls on an arc from his hand to the lock and splashes red
      if (live) while (nextDrop <= Math.min(t, BLOOD1)) { const m = new THREE.Mesh(dropGeo, red); m.position.copy(hand); m.renderOrder = 7; S.add(m); drops.push({ m, t0: nextDrop, trail: E.vfx.ribbon({ col: [1, 0.08, 0.05], width: 0.035, n: 10, fade: 0.25 }) }); nextDrop += 7; }
      else if (t > nextDrop) nextDrop = Math.max(nextDrop, Math.ceil(t));
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i], k = (t - d.t0) / 14;
        if (k >= 1 || k < 0) { S.remove(d.m); d.trail.end(); drops.splice(i, 1); if (k >= 1 && live) { E.vfx.burst(lock, { n: 10, speed: 1, cols: [[1, 0.1, 0.08], [1, 0.4, 0.25]], size: 0.04, life: 0.4, g: 3, shape: 1 }); E.vfx.light(lock, [1, 0.2, 0.1], 2, 0.25, 2); } continue; }
        d.m.position.lerpVectors(hand, lock, k); d.m.position.y += Math.sin(k * Math.PI) * 0.35; d.m.scale.set(1, 1.3, 1); d.trail.push(d.m.position); }
      // the seam kindles red, then gold, until the lid opens
      const kin = Math.min(1, Math.max(0, (t - KINDLE) / (OPEN - KINDLE))), open = Math.min(1, Math.max(0, (t - OPEN) / SWING));
      seam.material.opacity = (t < OPEN ? kin * (0.4 + 0.12 * Math.sin(t * 0.5)) : Math.max(0, 0.5 - (t - OPEN) / 12));
      seam.material.color.setRGB(1, 0.18 + 0.4 * kin, 0.04 + 0.06 * kin); inner.color.copy(seam.material.color);   // red to a deep gold (a pale gold reads as cream on the wood)
      inner.intensity = t < OPEN ? kin * 1.5 : Math.max(0.5, 2 * (1 - (t - OPEN) / 40));
      // the lid swings open; once it is back, the open chest (its dark inside) stands in for it
      const lid = lidOf();
      if (t < OPEN + SWING) { if (lid && !chestG.get(sx + ',' + sz).userData.open) lid.rotation.x = -1.95 * ease(open) - Math.sin(open * Math.PI) * 0.08; }
      else if (!chestG.get(sx + ',' + sz)?.userData.open) { openChest(sx, sz); chestG.get(sx + ',' + sz).userData.open = 1; }
      if (live && t >= OPEN && last < OPEN) {   // the light bursts out as it opens
        E.vfx.light(P.clone().setY(DAIS + 0.8), [1, 0.85, 0.45], 3, 0.6, 5);   // (soft: a strong light or a column reads as a pale blob on this floor)
        E.vfx.burst(P.clone().setY(DAIS + 0.45), { n: 24, speed: 1.6, cols: [[1, 1, 0.85], [1, 0.8, 0.35]], size: 0.04, life: 0.6, g: -0.5, shape: 1, up: 1.2 });
      }
      if (live && t > OPEN && t < OPEN + RISE && Math.random() < 0.5) E.vfx.spark(P.x + (Math.random() - 0.5) * 0.4, DAIS + 0.4, P.z + (Math.random() - 0.5) * 0.25, { vy: 0.8 + Math.random() * 0.8, life: 0.7, size: 0.04, r: 1, gg: 0.85, b: 0.45, shape: 1 });
      // the sword rises out of the chest into its place
      if (t >= OPEN && !sword) { sword = swordModel(sx + 0.5, sz + 0.5, DAIS + 0.15); S.add(sword); }
      if (sword) { sword.position.y = DAIS + 0.15 - 0.85 * (1 - ease((t - OPEN - 4) / RISE)); sword.visible = t < ev.found || t >= ev.end || Math.floor(t) % 2 === 1; }
      last = t;
      if (t > ev.end + 2) tick.stop();
    };
    tick.stop = () => { seam.parent && seam.parent.remove(seam); S.remove(inner); for (const d of drops) { S.remove(d.m); d.trail.end(); } const i = world ? world.updaters.indexOf(tick) : -1; if (i >= 0) world.updaters.splice(i, 1); if (cutTick === tick) cutTick = null; };
    cutTick = tick; world.updaters.push(tick); tick(0);
  }
  return {
    build, openChest, native, ground, particles: 'dust',
    get slopes() { const out = []; if (!LV) return out; for (const r of LV.ramps) for (let y = r.z0; y < r.z1; y++) for (let x = r.x0; x < r.x1; x++) out.push([x, y]); return out; },
    get props() { return cur === DAIS_ROOM ? [SWORD] : []; },
    mood: { bg: 0x020202, voidCol: 0x020202, voidY: -1.2, fog: 0x060504, fogD: 0.02, sky: 0xffe8c8, under: 0x2a1a10, hemi: 1.0,
      sun: 0xfff0d8, sunI: 2.4, sunDir: [-0.3, 0.9, 0.4], sat: 1.05, exposure: 1.15, bloom: 0.35, aoR: 0.8,
      env: { top: 0x8a7a68, mid: 0x4a3a2a, low: 0x1a1008, lights: [[0, 7, 3, 0xfff0d8, 4]] } },
  };
}
export const hallEntry = setFor('0ef160');
export const hallSword = setFor('0ef178');
export default setFor(null);   // battle 11: the room the party is in
