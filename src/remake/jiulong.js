// 北海九龍島 (battle 21 and scene 42: maps 0f6860 and 0f687c), remade: the island of the four holy knights in the
// northern sea. Sand and grass islets between channels of dark sea, and on them a temple of pale stone: its terraces
// paved in cream slabs, faced in olive brick, edged with balustrades of round-knobbed posts, joined by broad stairs.
// The island (0f6860): the west terrace, the east terrace a step lower (a flight down between them, diagonal as the
// original draws it), the upper court before the gate (its plaque from the map's own pixels; two stone guardians
// either side), stairs down to the sand from each terrace and up to the north islet. The shrine (0f687c): a terrace in
// the shape of a cross on the sea, a long stair up out of the water, and above, the court of the stele.
// Both are built from plans measured on the original (tools/qa/grid.py) and the battle's terrain: the land and sea from
// the art itself (src/kit/terrain.js Land), the temple over it cell by cell (heights per kind, below).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs } from '../kit/terrain.js';

// plan cells. Land: . sand or grass (as the art); k the same under a chest; ~ sea; r rock (land no one may stand on);
// p a pocket of open sand no one can get to (walled off by the temple): rock, as the rule for such ground
// Temple (heights from spec.H): L R U walkable terraces; l q u their edges (a balustrade); D a step of the diagonal flight
// (spec.D); S a stair (spec.stairs); s a stair's lane the battle keeps no one on; c a stair's cheek; f an olive brick face down from the terrace north of it; X a stone
// guardian or the stele; W the gate's wall; E the gate's threshold (walkable)
const SEA = -0.55, BASE = -1.2, RAIL = 0.6;
const LAND = new Set(['.', 'k', '~', 'r', 'p']);
const PALETTE = { [CL.ground]: [0x6c6c24, 0x909024, 0xb4b46c, 0x484824], [CL.grass]: [0x00fc6c, 0x009000, 0x006c24, 0x00b448, 0x242400],   // (0x242400: the grass's dark shading, a tenth of the sand)
  [CL.water]: [0x24006c, 0x000000, 0x486c6c, 0x24246c, 0x2400b4, 0x6c90b4] };
let MAT = null;
function materials() {
  if (MAT) return MAT;
  MAT = {
    M: mats(),
    slab: T.material(flagTex(), {}, [0.5, 0.5]),                                                         // the cream limestone flags of the terraces
    brick: T.material(ashlarTex(), {}, [1, 1]),                                                          // the olive ashlar of their faces
    moss: T.material(T.turf(0x55693a), { color: 0xc8d0a8 }, [0.7, 0.7]),                                 // moss on the ramparts' tops
    cap: T.material(capTex(), {}, [0.5, 0.5]),                                                           // the ramparts' tops: old olive flags
    roof: T.material(T.roofTiles(0x4a5a52, 8, 8), { envMapIntensity: 0.7, side: THREE.DoubleSide }, [1, 1]),
    timber: T.material(T.wood(0x4a3220, 'jiulongTimber'), {}, [1, 1]),
    stone: T.material(T.rock(0xc8c0a0, 'jiulongStone', 0.25), { color: 0xfff8e8 }, [0.5, 0.5]),          // posts, rails, cheeks
    guard: T.material(guardTex(), {}),
    dark: new THREE.MeshStandardMaterial({ color: 0x060504, roughness: 1 }),
  };
  return MAT;
}
// the terraces' paving: cream limestone flags, two by two a cell, laid in courses (T.flags: worn edges, grime in the
// joints, pits, a faint cloud scroll carved in some, the original's swirled tiles)
const frac = v => v - Math.floor(v), rnd = (a, b, k) => frac(Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453);
const flagTex = () => T.flags(0xe0d6b8, 0xc2c2a8, 'jiulongFlag', 8, 0.28, 0x665e4c);
// the faces' olive ashlar: long blocks in courses, bevelled, chipped at the arrises, stained
function ashlarTex() {
  return T.pbr('jiulongAshlar', 512, (u, v, o) => {
    const rows = 4, row = Math.floor(v * rows), fv = v * rows - row, cols = 2, cu = u * cols + (row % 2) * 0.5, col = Math.floor(cu), fu = cu - col;
    const e = Math.min(fu * 2, (1 - fu) * 2, fv, 1 - fv), n = T.fbm(u, v, 14, 4, 61), fine = T.fbm(u, v, 80, 2, 62);
    const base = T.mixc([0.4, 0.35, 0.2], [0.5, 0.44, 0.27], rnd(col % cols, row, 3)), bevel = T.smooth(0, 0.1, e), joint = 1 - T.smooth(0.01, 0.05, e);
    const chip = T.smooth(0.7, 0.85, T.fbm(u, v, 40, 3, 63)) * (1 - bevel);
    o.h = 0.5 + 0.14 * bevel + (n - 0.5) * 0.12 + (fine - 0.5) * 0.04 - joint * 0.3 - chip * 0.1;
    const streak = T.smooth(0.5, 0.9, T.fbm(u * 6, v * 0.6, 6, 3, 64)) * 0.25;
    o.c = T.mixc(T.mixc(base, [base[0] * 0.8, base[1] * 0.78, base[2] * 0.7], n * 0.8 + streak), [0.2, 0.18, 0.12], T.clamp(joint * 0.75 + chip * 0.2));
    o.r = 0.9;
  }, 4);
}
// the islets' sand: pale and fine, ribbed by the wind in soft ripples that wander, darker grains and bits of shell in it
function sandTex() {
  return T.pbr('jiulongSand3', 512, (u, v, o) => {
    const w = T.fbm(u, v, 3, 3, 91), rip = Math.sin((u * 0.6 + v + w * 0.5) * Math.PI * 2 * 14 + T.fbm(u, v, 9, 2, 92) * 4);
    const g = T.fbm(u, v, 120, 2, 93), dark = T.smooth(0.72, 0.8, g), shell = T.smooth(0.9, 0.95, T.fbm(u, v, 70, 2, 94));
    o.h = 0.5 + rip * 0.06 + (g - 0.5) * 0.05;
    const lit = rip * 0.5 + 0.5, crest = Math.pow(lit, 3);   // (the land shader reads colour only: the ripples' light and shade painted in)
    o.c = T.mixc(T.mixc([0.84, 0.77, 0.57], [0.66, 0.59, 0.42], w * 0.7 + (1 - lit) * 0.45), [0.48, 0.43, 0.31], dark * 0.55);
    o.c = T.mixc(o.c, [0.92, 0.87, 0.7], crest * 0.25);
    if (shell) o.c = T.mixc(o.c, [0.95, 0.92, 0.85], shell);
    o.r = 0.95;
  }, 3);
}
// the ramparts' tops: large old flags of the faces' olive stone, cracked, grass and dirt in every joint (no one walks
// there: rougher and darker than the terraces' paving)
function capTex() {
  return T.pbr('jiulongCap', 512, (u, v, o) => {
    const N = 4, row = Math.floor(v * N), cu = u * N + (row % 2) * 0.37, col = Math.floor(cu), fu = cu - col, fv = v * N - row;
    const e = Math.min(fu, 1 - fu, fv, 1 - fv), n = T.fbm(u, v, 16, 4, 81), crack = 1 - T.smooth(0, 0.012, Math.abs(T.fbm(u, v, 9, 3, 82) - 0.5));
    const base = T.mixc([0.3, 0.27, 0.15], [0.38, 0.34, 0.2], rnd(col % N, row, 4)), joint = 1 - T.smooth(0.01, 0.06, e), green = T.smooth(0.3, 0.9, joint + n * 0.3);
    o.h = 0.5 + 0.1 * T.smooth(0, 0.1, e) + (n - 0.5) * 0.14 - joint * 0.3 - crack * 0.1;
    o.c = T.mixc(T.mixc(base, [base[0] * 0.78, base[1] * 0.76, base[2] * 0.68], n), [0.2, 0.27, 0.1], green * 0.7);
    o.r = 0.92;
  }, 4);
}
// the guardians' and the stele's carving: a grey stone with a stern face in relief over a band of cloud scrolls
function guardTex() {
  return T.pbr('jiulongGuard', 512, (u, v, o) => {
    const n = T.fbm(u, v, 9, 4, 41), x = Math.abs(u - 0.5);
    let h = 0.45 + (n - 0.5) * 0.15;
    if (v < 0.06 || v > 0.94) h += 0.25;
    if (v > 0.12 && v < 0.55) { const y = (v - 0.12) / 0.43;
      if (Math.hypot((x - 0.17) / 0.1, (y - 0.32) / 0.08) < 1) h += 0.28;
      if (Math.hypot((x - 0.17) / 0.045, (y - 0.32) / 0.045) < 1) h -= 0.25;
      if (x < 0.05 && y > 0.3 && y < 0.68) h += 0.22;
      if (Math.abs(y - 0.8) < 0.05 && x < 0.2) h -= 0.2;
      if (y < 0.14 && x < 0.34) h += 0.18; }
    if (v > 0.62 && v < 0.9) { const dx = (u * 3) % 1 - 0.5, dy = v - 0.76, r = Math.hypot(dx, dy * 3); if (r < 0.4) h += 0.18 * (Math.sin(r * 40) > 0 ? 1 : 0); }
    const g = 0.62 + (n - 0.5) * 0.18 + T.clamp((h - 0.45) * 0.8) * 0.2;
    o.c = [g * 0.98, g * 0.98, g * 0.9]; o.r = 0.85; o.h = h;
  }, 4);
}

function island(spec) {
  const { w: MW, h: MH, rows, H, D = {}, art } = spec, kind = (x, y) => (rows[y] && rows[y][x]) || (y >= MH ? '.' : '~');
  const isLand = k => LAND.has(k);
  const edgeH = { l: H.L, q: H.R, u: H.U, X: H.U, E: H.U };
  // the olive faces under the terraces' edges, as battle 16's ramparts: the cells no one may enter are a thick rampart at
  // the terrace's height (raised, out of reach), its top weathered flags grown over in the joints, and one sheer ashlar
  // wall at its south end down to what lies below, a coping stone along its edge (tiers read as stairs, a slope as a ramp)
  const faceH = (x, z) => { const cx = Math.floor(x), cy = Math.floor(z); let y0 = cy, y1 = cy; while (kind(cx, y0 - 1) === 'f') y0--; while (kind(cx, y1 + 1) === 'f') y1++;
    const n = kind(cx, y0 - 1), s = kind(cx, y1 + 1), top = H[n] ?? edgeH[n] ?? (n === 'S' || n === 'c' ? LV.at(cx + 0.5, y0 - 0.5) : H.R);
    return top - 0.18; };   // (the rampart's top: a little under the terrace behind its balustrade; one sheer wall at its south end)
  const LV = new Levels(MW, MH, 4);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const k = kind(x, y);
    if (H[k] != null) LV.set(x, y, x + 1, y + 1, H[k]);
    else if (edgeH[k] != null) LV.set(x, y, x + 1, y + 1, edgeH[k]);
    else if (k === 'D') LV.set(x, y, x + 1, y + 1, D[x + ',' + y]); }
  for (const s of spec.stairs) LV.stairs(...s);
  const cheekH = (x, z) => LV.at(x + 0.5, z + 0.5) + 0.45;   // (a cheek runs beside its stair, the stair's height at that row)
  const stairAt = (x, z) => { for (const [x0, z0, x1, z1, y0, y1, n, from] of spec.stairs) if (z >= z0 && z < z1 && x >= x0 - 1 && x < x1 + 1) return LV.at(Math.max(x0 + 0.01, Math.min(x1 - 0.01, x)), z); return H.R; };
  let land = null, chestG = new Map(), world = null;
  function ground(x, z) {
    const cx = Math.floor(x), cy = Math.floor(z), k = kind(cx, cy);
    if (k === 'S' || k === 's') return LV.at(x, z);
    if (k === 'f') return faceH(x, z);
    if (k === 'c') return stairAt(x, z) + 0.45;
    if (k === 'W') return H.U + 2.6;
    if (H[k] != null || edgeH[k] != null || k === 'D') return LV.at(x, z) + (k === 'l' || k === 'q' || k === 'u' ? 0 : 0);
    return land ? land.at(x, z) : 0;
  }
  async function build(E, FX) {
    const S = E.world.scene, { M, slab, brick, stone, dark } = materials(); world = E.world; chestG = new Map();
    // the land and the sea, from the art: sand and grass where anyone may walk; sea or rock where no one may; flat sand
    // under the temple
    const lay = await readLayout(art, MW, MH, PALETTE, { [CL.water]: 1.3 }), W4 = MW * 4;
    for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) { const k = kind(cx, cy);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const q = (cy * 4 + j) * W4 + cx * 4 + i;
        if (k === '~') lay[q] = CL.water; else if (k === 'r' || k === 'p') lay[q] = CL.rock;
        else if (!isLand(k)) lay[q] = CL.ground; else if (lay[q] === CL.water || lay[q] === CL.rock) lay[q] = CL.ground; } }
    lay.pebbles = lay.pebbles.filter(([x, z]) => { const k = kind(Math.floor(x), Math.floor(z)); return k === '.'; });
    // the shore: the sand level to its cell's edge (where anyone may stand), then a gentle shelf of wet sand into the sea
    // over most of a cell; the waterline wanders off the grid
    const dry = (x, z) => { const k = kind(Math.floor(x), Math.floor(z)); return k !== '~'; };
    land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside: (x, z) => (z > MH + 2 && spec.southLand) ? CL.ground : CL.water, rockH: 0.9, rise: 1.6, lumpH: 0.04, waterDepth: -SEA + 0.35, waterJitter: 0.5, dry,
      tex: { dirt: sandTex(), turf: T.turf(0x4a7a34), rock: T.rock(0x6a6a50, 'jiulongRock', 0.2) },
      tint: { dirt: 0xfff6e4, turf: 0xd0e4b8, rock: 0xe0dcc8 } });
    const wet = shoreField(lay, MW * 4, MH * 4, 12);   // (quarter cells out from the nearest dry sample)
    const W0 = land.weight.bind(land); land.weight = (x, z, c) => c === CL.water ? wet(x, z) : W0(x, z, c);
    S.add(land.mesh({ dirtK: 0.3, rockK: 0.34, topGreen: 1, bed: 0x7a6c48 }));
    FX.water(S, { r: [-14, -14, MW + 14, MH + 14], y: SEA, deep: 0x1c2250, lit: 0x4a7a88, stars: 0.12 });   // the original's deep violet-blue sea, its grey-green swell, a few glints
    S.add(grass(land.scatter(CL.grass, 140, (x, z) => '.rp'.includes(kind(Math.floor(x), Math.floor(z)))), { size: 0.22, cols: ['#4a8a3a', '#5a9a40', '#3a7030', '#6aa848', '#7aa850'] }));
    S.add(shrubs(land.scatter(CL.rock, 3, (x, z) => 'rp'.includes(kind(Math.floor(x), Math.floor(z)))), { size: 0.42, cols: ['#3e5a2a', '#4a6a30', '#56763a', '#33482a'] }));
    S.add(stones(lay.pebbles.map(([x, z]) => [x, land.at(x, z), z]), T.material(T.rock(0x8a8470, 'jiulongPebble', 0.2), {}, [0.5, 0.5]), { size: 0.1 }));
    // the temple: its terraces (slabs on top, brick on the sides), its stairs
    S.add(shade(LV.mesh(slab, brick, BASE, 0.5), true));
    for (const r of LV.ramps) S.add(stairs(r, slab, brick, 0.5));
    // the olive faces stepping down south of the terraces, the stairs' cheeks
    const faces = [], cheeks = [], ledges = [], copings = [], tufts = [], mossy = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const k = kind(x, y);
      if (k === 'f') { const h = faceH(x + 0.5, y + 0.5), south = kind(x, y + 1) !== 'f';
        faces.push(box(brick, x, BASE, y, x + 1, h, y + 1, 1)); ledges.push(box(materials().cap, x, h, y, x + 1, h + 0.02, y + 1, 1));
        if (south) copings.push(box(stone, x - 0.01, h - 0.05, y + 0.86, x + 1.01, h + 0.07, y + 1.04, 0.5));
        if (rnd(x, y, 9) < 0.18) for (let i = 0; i < 3; i++) tufts.push([x + rnd(x, y, 10 + i), h + 0.02, y + rnd(x, y, 20 + i) * 0.85]); }
      if (k === 'c') {   // a stair's cheek: a dado wall stepping down beside the treads, a knobbed post on it every cell (as the original's)
        const side = kind(x + 1, y) === 'S' || kind(x + 1, y) === 's' ? 1 : -1, wx = side > 0 ? x + 0.62 : x + 0.08, wx1 = wx + 0.3;
        for (let j = 0; j < 4; j++) cheeks.push(box(stone, wx, BASE, y + j / 4, wx1, stairAt(x + 0.5, y + j / 4 + 0.12) + 0.32, y + (j + 1) / 4, 0.5));
        const py = stairAt(x + 0.5, y + 0.5) + 0.32, pcx = (wx + wx1) / 2;
        cheeks.push(box(stone, pcx - 0.11, py, y + 0.39, pcx + 0.11, py + 0.42, y + 0.61, 1));
        const kb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), stone); kb.position.set(pcx, py + 0.52, y + 0.5); cheeks.push(kb);
        if (side < 0 && kind(x - 1, y) !== '~' && kind(x - 1, y) !== 'c') faces.push(box(brick, x, BASE, y, wx, faceH(x + 0.5, y + 0.5), y + 1, 1)); } }
    if (faces.length) S.add(shade(merged(brick, faces)), shade(merged(materials().cap, ledges)), shade(merged(stone, copings)));
    if (mossy.length) S.add(shade(merged(materials().moss, mossy), false));
    if (tufts.length) S.add(grass(tufts, { size: 0.32, cols: ['#4a7a34', '#5a8a3a', '#3e6a2c', '#6a9440'] }));
    if (cheeks.length) S.add(shade(merged(stone, cheeks)));
    // balustrades along the edge cells: a post with a round knob on each, rails to the edge cells beside it
    const P = [], edge = (x, y) => 'lqu'.includes(kind(x, y)) || (kind(x, y) === 'c');
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const k = kind(x, y); if (!'lqu'.includes(k)) continue;
      const cx = x + 0.5, cz = y + 0.5, y0 = edgeH[k];
      P.push(box(stone, cx - 0.09, y0, cz - 0.09, cx + 0.09, y0 + RAIL, cz + 0.09, 2));
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), stone); b.position.set(cx, y0 + RAIL + 0.1, cz); P.push(b);
      if (edge(x + 1, y) && kind(x + 1, y) === k) { P.push(box(stone, cx, y0 + 0.12, cz - 0.05, cx + 1, y0 + 0.2, cz + 0.05, 2), box(stone, cx, y0 + RAIL - 0.14, cz - 0.06, cx + 1, y0 + RAIL - 0.04, cz + 0.06, 2));
        for (let t = 0.25; t < 1; t += 0.25) P.push(box(stone, cx + t - 0.025, y0 + 0.2, cz - 0.03, cx + t + 0.025, y0 + RAIL - 0.14, cz + 0.03, 2)); }
      if (edge(x, y + 1) && kind(x, y + 1) === k) { P.push(box(stone, cx - 0.05, y0 + 0.12, cz, cx + 0.05, y0 + 0.2, cz + 1, 2), box(stone, cx - 0.06, y0 + RAIL - 0.14, cz, cx + 0.06, y0 + RAIL - 0.04, cz + 1, 2));
        for (let t = 0.25; t < 1; t += 0.25) P.push(box(stone, cx - 0.03, y0 + 0.2, cz + t - 0.025, cx + 0.03, y0 + RAIL - 0.14, cz + t + 0.025, 2)); } }
    if (P.length) S.add(shade(merged(stone, P)));
    // the diagonal flight's steps: slab blocks over the terrace mesh's own cells there, 3 mm over its top and 5 mm out from
    // its sides (on them, the two flickered), flush only with a step of the same height beside
    for (const [key, h] of Object.entries(D)) { const [x, y] = key.split(',').map(Number), o = (dx, dy) => D[(x + dx) + ',' + (y + dy)] === h ? 0 : 0.005;
      S.add(shade(box(slab, x - o(-1, 0), BASE, y - o(0, -1), x + 1 + o(1, 0), h + 0.003, y + 1 + o(0, 1), 0.6))); }
    // guardians (and the stele)
    for (const [x0, z0, x1, z1, tall] of spec.guards || []) S.add(guardian(x0, z0, x1, z1, H.U, tall));
    if (spec.gate) gate(S, spec.gate, H.U);
    for (const [x, y, hidden] of spec.chests || []) { if (hidden) continue; const g = chest(M, x + 0.5, y + 0.5, ground(x + 0.5, y + 0.5), false, 0, 1.4); S.add(g); chestG.set(x + ',' + y, g); }
    E.world.updaters.push(() => {});
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, ground(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(materials().M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  const slopes = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'S') slopes.push([x, y]);
  const props = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if ('XWkc'.includes(kind(x, y))) props.push([x, y]);
  return { build, openChest, ground, slopes, props, particles: null, mood: MOOD };
}
// the sea's share of the ground near a shore: 0 on and up to the dry land's edge, rising to 1 over three quarter cells
// out (a gentle shelf), from a distance transform over the layout's samples (ext: the land's margin in cells)
function shoreField(lay, W, H, ext) {
  const R = 4, E = ext * R, WW = W + 2 * E, HH = H + 2 * E, d = new Float32Array(WW * HH).fill(1e9);
  const cls = (i, j) => { const x = Math.min(W - 1, Math.max(0, i - E)), y = Math.min(H - 1, Math.max(0, j - E)); return (i - E < 0 || j - E < 0 || i - E >= W || j - E >= H) ? CL.water : lay[y * W + x]; };
  for (let j = 0; j < HH; j++) for (let i = 0; i < WW; i++) if (cls(i, j) !== CL.water) d[j * WW + i] = 0;
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j < HH; j++) for (let i = 0; i < WW; i++) {
    const jj = pass ? HH - 1 - j : j, ii = pass ? WW - 1 - i : i, k = jj * WW + ii, s = pass ? 1 : -1; if (!d[k]) continue;
    const a = ii + s >= 0 && ii + s < WW ? d[k + s] + 1 : 1e9, b = jj + s >= 0 && jj + s < HH ? d[k + s * WW] + 1 : 1e9;
    const c = ii + s >= 0 && ii + s < WW && jj + s >= 0 && jj + s < HH ? d[k + s * WW + s] + 1.414 : 1e9; d[k] = Math.min(d[k], a, b, c);
  }
  return (x, z) => { const wu = ((x / 9) % 1 + 1) % 1, wv = ((z / 9) % 1 + 1) % 1;   // (the waterline wanders: the field read off the grid by up to half a cell)
    x += (T.fbm(wu, wv, 7, 3, 71) - 0.5) * 1.6; z += (T.fbm(wu, wv, 7, 3, 72) - 0.5) * 1.6;
    const fx = (x + ext) * R - 0.5, fz = (z + ext) * R - 0.5, i = Math.max(0, Math.min(WW - 2, Math.floor(fx))), j = Math.max(0, Math.min(HH - 2, Math.floor(fz))), tx = fx - i, tz = fz - j;
    const D = (a, b) => d[b * WW + a], v = (D(i, j) * (1 - tx) + D(i + 1, j) * tx) * (1 - tz) + (D(i, j + 1) * (1 - tx) + D(i + 1, j + 1) * tx) * tz;
    return T.smooth(0.2, 3.2, v); };
}
// a stone guardian (or the stele: tall) over the cells (x0, z0)-(x1, z1): a moulded pedestal, a carved shaft (a little
// tapered, the stern mask in relief), a capital and a ball finial; the stele a tall carved slab under a pitched cap
function guardian(x0, z0, x1, z1, y, tall) {
  const { stone, guard } = materials(), g = new THREE.Group(), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.min(x1 - x0, 1) * 0.7, h = tall ? 2.4 : 1.95;
  g.add(box(stone, cx - w * 0.72, y, cz - w * 0.62, cx + w * 0.72, y + 0.16, cz + w * 0.62, 0.6),
        box(stone, cx - w * 0.62, y + 0.16, cz - w * 0.54, cx + w * 0.62, y + 0.3, cz + w * 0.54, 0.6),
        box(stone, cx - w * 0.56, y + 0.3, cz - w * 0.48, cx + w * 0.56, y + 0.36, cz + w * 0.48, 0.6));
  const sh = h - 0.36 - (tall ? 0.3 : 0.42), body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.46, w * 0.52, sh, 4, 1), guard);
  body.rotation.y = Math.PI / 4; body.scale.set(1, 1, tall ? 0.45 : 0.8); body.position.set(cx, y + 0.36 + sh / 2, cz); g.add(body);
  const top = y + 0.36 + sh;
  if (tall) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, w * 0.72, 0.32, 4, 1), stone); cap.rotation.y = Math.PI / 4; cap.scale.set(1, 1, 0.55); cap.position.set(cx, top + 0.16, cz); g.add(cap); }
  else {
    g.add(box(stone, cx - w * 0.52, top, cz - w * 0.42, cx + w * 0.52, top + 0.1, cz + w * 0.42, 0.6), box(stone, cx - w * 0.44, top + 0.1, cz - w * 0.36, cx + w * 0.44, top + 0.2, cz + w * 0.36, 0.6));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(w * 0.26, 18, 12), stone); ball.position.set(cx, top + 0.2 + w * 0.24, cz); g.add(ball);
  }
  return shade(g);
}
// the gate over the court's north (x0-x1, z0-z1): a pale stone plinth, olive ashlar walls with stone quoins at their
// corners, a stone door frame and lintel, dark doors standing ajar, the plaque cut from the map's own pixels over the
// door, and a tiled roof on timber eaves over it all
function gate(S, { x0, x1, z0, z1, door: [dx0, dx1], plaque }, y) {
  const { brick, stone, dark, roof, timber } = materials(), top = y + 2.5, g = new THREE.Group();
  g.add(box(stone, x0 - 0.1, y, z0, x1 + 0.1, y + 0.32, z1 + 0.06, 0.6));
  g.add(shade(merged(brick, [box(brick, x0, y + 0.32, z0, dx0, top, z1 - 0.05, 1), box(brick, dx1, y + 0.32, z0, x1, top, z1 - 0.05, 1), box(brick, dx0, y + 2.05, z0, dx1, top, z1 - 0.05, 1)])));
  const Q = []; for (const qx of [x0, x1 - 0.32]) for (let k = 0; k < 6; k++) { const yy = y + 0.32 + k * 0.36, wide = k % 2 ? 0.32 : 0.46; Q.push(box(stone, qx === x0 ? x0 - 0.02 : x1 - wide + 0.02, yy, z1 - 0.12, qx === x0 ? x0 + wide : x1 + 0.02, yy + 0.34, z1 + 0.02, 0.5)); }
  Q.push(box(stone, dx0 - 0.18, y + 0.32, z1 - 0.12, dx0 + 0.02, y + 2.1, z1 + 0.06, 0.5), box(stone, dx1 - 0.02, y + 0.32, z1 - 0.12, dx1 + 0.18, y + 2.1, z1 + 0.06, 0.5),
    box(stone, dx0 - 0.3, y + 2.05, z1 - 0.14, dx1 + 0.3, y + 2.28, z1 + 0.1, 0.5), box(stone, x0 - 0.06, top, z0 - 0.04, x1 + 0.06, top + 0.12, z1 + 0.06, 0.5));
  g.add(shade(merged(stone, Q)));
  g.add(box(dark, dx0 + 0.02, y + 0.32, z1 - 0.6, dx1 - 0.02, y + 2.05, z1 - 0.5));
  const dw = (dx1 - dx0) / 2;
  for (const [hx, sgn] of [[dx0, 1], [dx1, -1]]) { const leaf = new THREE.Group(), m = box(timber, 0, 0, -0.04, dw * 0.92 * sgn, 1.7, 0.04, 1); m.position.y = y + 0.32; leaf.add(m);
    for (const yy of [0.35, 0.85, 1.35]) { const bnd = box(materials().M.bronze, 0, yy, 0.04, dw * 0.92 * sgn, yy + 0.06, 0.06, 1); bnd.position.y = y + 0.32; leaf.add(bnd); }
    leaf.position.set(hx, 0, z1 - 0.12); leaf.rotation.y = -sgn * 0.55; g.add(shade(leaf)); }
  // the roof: timber eaves and a tiled hip over the gate, its ridge along x
  const eave = 0.45, ry = top + 0.12, rh = 0.9, rw = x1 - x0 + eave * 2, rd = z1 - z0 + eave * 2;
  g.add(shade(box(timber, x0 - eave + 0.1, ry, z0 - eave + 0.1, x1 + eave - 0.1, ry + 0.14, z1 + eave - 0.1, 1)));
  const rg = new THREE.BufferGeometry(), X0 = x0 - eave, X1 = x1 + eave, Z0 = z0 - eave, Z1 = z1 + eave, Y0 = ry + 0.14, Y1 = Y0 + rh, inset = rd / 2;
  const P = [X0, Y0, Z1, X1, Y0, Z1, X1 - inset, Y1, (Z0 + Z1) / 2, X0, Y0, Z1, X1 - inset, Y1, (Z0 + Z1) / 2, X0 + inset, Y1, (Z0 + Z1) / 2,
    X1, Y0, Z0, X0, Y0, Z0, X0 + inset, Y1, (Z0 + Z1) / 2, X1, Y0, Z0, X0 + inset, Y1, (Z0 + Z1) / 2, X1 - inset, Y1, (Z0 + Z1) / 2,
    X0, Y0, Z0, X0, Y0, Z1, X0 + inset, Y1, (Z0 + Z1) / 2, X1, Y0, Z1, X1, Y0, Z0, X1 - inset, Y1, (Z0 + Z1) / 2];
  rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const uv = []; for (let i = 0; i < P.length; i += 3) uv.push(P[i] * 0.6, P[i + 1] * 0.9 + P[i + 2] * 0.6); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.computeVertexNormals();
  g.add(shade(new THREE.Mesh(rg, roof)));
  g.add(shade(box(materials().M.bronze, X0 + inset - 0.05, Y1 - 0.02, (Z0 + Z1) / 2 - 0.07, X1 - inset + 0.05, Y1 + 0.1, (Z0 + Z1) / 2 + 0.07, 1)));
  S.add(g);
  if (plaque) {
    const img = new Image(); img.src = plaque.src;
    const c = document.createElement('canvas'); c.width = plaque.w * 4; c.height = plaque.h * 4; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    img.onload = () => { const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(img, plaque.x, plaque.y, plaque.w, plaque.h, 0, 0, c.width, c.height); t.needsUpdate = true; };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(plaque.w / 32, plaque.h / 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    m.position.set((dx0 + dx1) / 2, y + 2.32 + plaque.h / 64, z1 + 0.11); S.add(m);
    S.add(shade(box(materials().M.bronze, (dx0 + dx1) / 2 - plaque.w / 64 - 0.05, y + 2.27, z1 + 0.05, (dx0 + dx1) / 2 + plaque.w / 64 + 0.05, y + 2.37 + plaque.h / 32, z1 + 0.1, 1)));
  }
}
const MOOD = { bg: 0x5a6a84, voidCol: false, fog: 0x6a7a94, fogD: 0.014, sky: 0xc0d0ec, under: 0x4a4636, hemi: 0.9,
  sun: 0xffe8c8, sunI: 2.9, sunDir: [-0.55, 0.68, 0.45], sat: 0.98, exposure: 1.0, bloom: 0.28, aoR: 0.9,
  env: { top: 0xb0c4e0, mid: 0x8a8a70, low: 0x3a3a30, lights: [[-6, 6, 4, 0xfff0d0, 3]] } };

// the island (0f6860, battle 21's map): T1 the east terrace, T2 the west, T3 the upper court
export const isle = island({
  w: 32, h: 25, art: 'assets/maps/0f6860.png', southLand: true, H: { R: 1.0, L: 1.6, U: 2.2 },
  rows: [
    '~~......~~~~~~~~WWWWWWWW~~~rr~~~',   //  0  the gate (16-23)
    '........~~~k~~~~WWWWWWWW~~~~~~~r',   //  1  the chest on the spit (11, 1)
    '........~~~~~uuuuXWEWXuuuuuuuu~~',   //  2  the guardians (17, 21), the threshold (19)
    '......~~~~~~~uUUUXUUUXUUUUUUUu~~',   //  3
    '....~~~~~~~~~uUUUUUUUUUUUUUUUu~~',   //  4
    'lSSl~~~~~~~~~uUUUUUUUUUUUUUUUu~~',   //  5  the stairs up from the north islet (1-2)
    'lSSllllllllllluuuuuuuuuuuSSuuu~~',   //  6  the court's stairs down east (25-26)
    'lSSlLLLLLLLLlffffffffffffSSfff~~',   //  7
    'lLLLLLLLLLLLLDfffffffffffSSfff~~',   //  8  the diagonal flight (13-15, rows 8-11)
    'lLLLLLLLLLLLLLDffffffffffSSfff~~',   //  9
    'lLLLLLLLLLLLLLDDfffffffffSSfffqq',   // 10
    'lllllLLLLLLlllDRRRRRRRRRRRRRRRRq',   // 11
    'ffffflLLLLLffffRRRRRRRRRRRRRRRRq',   // 12
    'ffffffffSSSfffffRRRRRRRRRRRRRRRq',   // 13  the stairs down to the sand (8-10)
    'ffffffffSSSff.fffRRRRRRRRRRRRRRq',   // 14
    'ffffffffSSS~...ffRRRRRRRRRRRRRRq',   // 15
    '.~~~~fffSSS~.~~~fffSSfffffRRRRRq',   // 16  the stairs down from the east terrace (19-20)
    '.~~~~fffSSS~.~~~fffSSfffffffRRRq',   // 17
    '~~~~~~~.......~~fffSSfffffffffff',   // 18
    '~~~~~~~......~~~ppfSSfffpfffffff',   // 19  (16-17, 24: pockets)
    '...~~~......~~~~p~~SS~~~pppfffff',   // 20
    '........~~~~~~~~~......~~~pppppp',   // 21  (26-31: the south-east beach, cut off)
    '.......~~~~~~~~~~~........~~pppp',   // 22
    '....~~~~~~~~~~~~~~~.......~~~~~~',   // 23
    '................................',   // 24 (past the map: the sand runs on)
  ],
  D: { '13,8': 1.5, '14,9': 1.38, '14,10': 1.26, '15,10': 1.26, '14,11': 1.13 },
  stairs: [[1, 5, 3, 8, 0, 1.6, 7, 'n'], [25, 6, 27, 11, 1.0, 2.2, 9, 's'], [8, 13, 11, 18, 0, 1.6, 9, 's'], [19, 16, 21, 21, 0, 1.0, 7, 's']],
  guards: [[17, 2, 18, 4], [21, 2, 22, 4]],
  gate: { x0: 16, x1: 24, z0: 0, z1: 2, door: [18.2, 20.8], plaque: { src: 'assets/maps/0f6860.png', x: 18.3 * 32, y: 0.15 * 32, w: 2.4 * 32, h: 0.75 * 32 } },
  chests: [[11, 1], [31, 1, true]],
});
// the shrine (0f687c, battle 21's room 1): T2 the cross of the terrace, T3 the stele's court
export const isleShrine = island({
  w: 16, h: 20, art: 'assets/maps/0f687c.png', southLand: false, H: { L: 1.4, U: 2.0, R: 1.4 },
  rows: [
    '~~~~~~~~~~~~~~~~',   //  0
    '~~~~~~~~~~~~~~~~',   //  1
    '~~~~uuuXuuuu~~~~',   //  2  the stele (7)
    '~~~~uUUXUUuu~~~~',   //  3
    '~llllUUUUUuulll~',   //  4
    '~lLLcsSSSscLLl~~',   //  5  the stairs up to the stele, five wide as drawn (5-9; the battle's units use 6-8)
    '~lLLcsSSSscLLl~~',   //  6
    '~lLLLsSSSsLLLl~~',   //  7
    'rllLLLLLLLLLll~~',   //  8
    'kfffLLLLLLLfff~~',   //  9  the chest at (0, 9)
    'rffffLLLLLffff~~',   // 10
    'rrffffcSScfff~~~',   // 11  the long stair up out of the sea (7-8)
    '~~~fffcSScff~~~.',   // 12
    '..~~ffcSScf~~~..',   // 13
    '....rrcSSc~~~...',   // 14
    '~~~.~~cSSc~~~~~~',   // 15
    '~~~~~~cSSc~~~~~~',   // 16
    '~~~~~~cSSc~~k~~~',   // 17  the chest on the islet (12, 17)
    '~~~~~~cSSc~~~~~~',   // 18
    '~~~~~~cSSc~~~~~~',   // 19 (past the map: the stair runs on down into the sea)
  ],
  stairs: [[5, 5, 10, 8, 1.4, 2.0, 6, 's'], [7, 11, 9, 20, 0 - 0.5, 1.4, 16, 's']],
  guards: [[7, 2, 8, 4, true]],
  chests: [[0, 9], [12, 17]],
});
// scene 42: the third 古文書, which the 北方守護靈 gives at the stele. The original draws it with 姬發's unit (slot 5, sheet
// 05e3a8: he is not there, its tiles swapped for the tablet's) on the stele's face, a small rose-red tablet (f645-718);
// the remade shrine plays that sheet as a glowing tablet, as scene 36's temple does (src/remake/taohua.js standIn)
let tablet = null;
isleShrine.standIn = {
  '05e3a8': (E, x, z, moving, ctx) => {
    if (ctx.tag !== '42') return false;
    if (!tablet || tablet.parent !== E.world.scene) {
      tablet = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0xff8aa0, emissive: 0xd83a5a, emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.07), m); b.position.y = 0.5; tablet.add(b);
      const L = new THREE.PointLight(0xff7a90, 2, 3, 1.6); L.position.y = 0.55; tablet.add(L);
      E.world.scene.add(tablet);
    }
    tablet.visible = true; tablet.position.set(x, isleShrine.ground(x, z) + 0.6 + 0.1 * Math.sin(E.gameT * 2.4), z + 0.3); tablet.rotation.y = E.gameT * 0.8;
  },
  hide: (E, gfx) => { if (gfx === '05e3a8' && tablet) tablet.visible = false; },
};
