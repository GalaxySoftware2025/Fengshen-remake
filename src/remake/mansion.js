// 費仲's mansion, remade: a rich official's house at night, plum carpets and red lacquer. Two of its maps, one set
// each, built by makeMansion from a layout (f floor; w a wall, behind a lattice face; b a low brick wall; v the dark
// between the rooms) and the pieces measured on the original (tools/qa/grid.py <map>):
//
// 0eb2e6 (scene 10 and battle 5), north to south:
//   the north hall   rows 3-5 across the map (and rows 1-2 at the east), under a stepped back wall of lattice bays
//                    (its face at z 3 for x 0-9, z 2 for 9-13, z 1 for 13-16), tall red columns at the bays' joints, a
//                    gold tassel curtain at the step; a niche of chests at its west end (0, 3-5)
//   the east wing    rows 6-9 at x 9-16, a low brick wall across it (row 7, x 11-16), stone steps down the corridor's
//                    head (9-10, 7-8)
//   the corridor     x 9-10, rows 6-18, between low walls
//   the west room    rows 11-12 at x 2-10, under its own lattice wall (rows 9-10), a chest at (2, 12)
//   the south room   rows 17-18 at x 2-15, lattice walls (rows 15-16) either side of the corridor's mouth; the heroes
//                    come in here (deploy (13, 17), (14, 17), (13, 18))
// 0eb8e6 (scene 11 and battle 6), the west wing:
//   the north hall   rows 2-5 (rows 4-5 from x 4), under a back wall of red panels (face at z 2, x 0-8) that steps forward
//                    to lattice bays (z 3, x 9-21) behind a gold curtain (8-9, 0-2); columns at the bays' joints; the heroes
//                    and 文王 start at its west end
//   the terrace      rows 6-7 at x 4-21: a brick wall two rows deep, the stair down through it at (14-15, 6-8)
//   the gallery      rows 8-9 at x 4-21 (and row 10 to x 12, a chest at (4, 10))
//   the corridor     x 11-12, rows 10-16, down to the south room
//   the east room    rows 14-18 at x 11-18, under a lattice wall (rows 12-13)
//   the south room   rows 16-18 at x 3-18, a lattice wall (rows 14-16, x 6-10) and, west of it, the little vestibule
//                    (x 3-5) whose dark doorway (4, 14) is the way out: a hero or 文王 on (4, 15) ends the battle
// The original's black between the rooms is low dark masonry; every room's south and side edges carry the original's
// red rails (low walls, so no one stands hidden behind them), with stone caps at their ends.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged, pillar, latticeWall, curtain, lantern } from '../kit/parts.js';

const WALL_H = 3.1, ROOM_H = 2.6, RAIL_H = 0.55, BRICK_H = 0.55, TERRACE_H = 0.95, FILL_H = 0.45, PIT = -1.2, OUT = 6, FACADE = 0.7;   // FACADE: a wall's depth behind its face (the dark behind it, as the original's black over its walls)

export function makeMansion(L) {
  const MW = L.map[0].length, MH = L.map.length, MAP = L.map;
  const kind = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 'v' : MAP[y][x];
  const wallH = y => y <= 2 ? WALL_H : ROOM_H;   // the north hall's back wall stands taller than the rooms'
  const isDoor = (x, y) => (L.doors || []).some(([dx, dy]) => dx === x && dy === y + 1);   // a doorway in the wall cell north of (dx, dy)
  let M = null, world = null, chestG = new Map();

  // a wall cell is wall only within FACADE of a face (the cell south of it a floor), else the dark behind
  const faceZ = (x, y) => { for (let j = y; j < MH; j++) if (kind(x, j) !== 'w') return kind(x, j) === 'f' ? j : null; return null; };
  function height(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z), k = kind(cx, cz);
    if (k === 'w') { const f = faceZ(cx, cz); return f != null && z >= f - FACADE ? wallH(cz) : FILL_H; }
    return k === 'v' ? FILL_H : k === 'b' ? (kind(cx, cz - 1) === 'b' || kind(cx, cz + 1) === 'b' ? TERRACE_H : BRICK_H) : 0;
  }

  async function build(E) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    M.beam = T.material(T.caihua(), { envMapIntensity: 1 });
    // the lattice as the original draws it here: silver-grey frets on deep red, not lit paper
    M.paper = new THREE.MeshStandardMaterial({ color: 0x8c0c08, roughness: 0.55, emissive: new THREE.Color(0.55, 0.04, 0.03), emissiveIntensity: 0.3, side: THREE.DoubleSide });
    M.lattice = M.lattice.clone(); M.lattice.color = new THREE.Color(0.95, 1.0, 1.0); M.lattice.metalness = 0.3; M.lattice.roughness = 0.35;
    M.lattice.emissive = new THREE.Color(0.2, 0.24, 0.24); M.lattice.emissiveIntensity = 0.4;
    const carpet = T.material(T.mansionCarpet(2), { envMapIntensity: 0.6 }, [MW / 2, MH / 2]);
    const fill = T.material(T.rock(0x1a1418, 'mansionFill', 0.3), { color: 0x6a6070 }, [0.5, 0.5]);
    const roof = T.material(T.roofTiles(0x34303a, 8, 8), {}, [1, 1]);
    const stone = T.material(T.rock(0x6c9090, 'mansionCap', 0.2), { color: 0xd8e4e4 }, [0.5, 0.5]);   // the grey-teal caps and posts
    const brick = T.material(T.bricks(0x8a6438, 3, 'mansionBrick'), {}, [1, 1]);
    const lacq = M.lacquer, dark = M.lacquerDark, gold = M.gold;

    // the carpet: one plane over the whole map (the masonry and walls stand on it)
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH).rotateX(-Math.PI / 2), carpet);
    fl.position.set(MW / 2, 0, MH / 2); fl.receiveShadow = true; S.add(fl);
    // the dark between the rooms, out past the map's edges so the wider view never looks into nothing
    const fills = [];
    for (let y = -OUT; y < MH + OUT; y++) for (let x = -OUT; x < MW + OUT; x++) {
      const k = kind(x, y), f = k === 'w' ? faceZ(x, y) : null;
      if (k === 'v' || (k === 'w' && (f == null || y + 1 <= f - FACADE))) fills.push(box(fill, x, PIT, y, x + 1, FILL_H, y + 1, 0.5));
      else if (k === 'w' && y < f - FACADE) fills.push(box(fill, x, PIT, y, x + 1, FILL_H, f - FACADE, 0.5));
    }
    S.add(shade(merged(fill, fills)));
    // the walls: a facade FACADE deep behind each lattice face (a room south of it), dark lacquer under a tiled coping
    const blocks = [], tops = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'w' && kind(x, y + 1) === 'f') {
      const h = wallH(y), z0 = y + 1 - FACADE;
      if (!isDoor(x, y)) blocks.push(box(dark, x, 0, z0, x + 1, h, y + 1 - 0.13));   // (behind the lattice bays' back plate)
      tops.push(box(roof, x - 0.02, h, z0 - 0.06, x + 1.02, h + 0.12, y + 1.04));
    }
    S.add(shade(merged(dark, blocks)), shade(merged(roof, tops)));
    const latt = { lat: 1.3, dado: T.material(T.cloudRelief(2), { envMapIntensity: 1.2 }) };   // the dado: red panels with gilt scrolls, as the original's pink-on-red
    for (let y = 0; y < MH; y++) {   // runs of wall cells with floor south of them: one bay a cell (a doorway breaks the run)
      const face = x => kind(x, y) === 'w' && kind(x, y + 1) === 'f' && !isDoor(x, y);
      for (let x = 0; x < MW;) {
        if (!face(x)) { x++; continue; }
        let e = x; while (e + 1 < MW && face(e + 1)) e++;
        S.add(latticeWall(M, x, e + 1, y + 1.0, 0, wallH(y), e + 1 - x, latt));
        x = e + 1;
      }
    }
    for (const [x, y] of L.doors || []) S.add(doorway(x, y, lacq, gold, stone));
    // the red columns at the bays' joints and the walls' corners, as drawn
    for (const [x, z] of L.columns) S.add(pillar(M, x, z, 0, (z < 4 ? WALL_H : ROOM_H) - 0.05, 0.2));
    // the gold tassel curtain the original hangs at the back wall's step
    for (const [x0, x1, z, tie] of L.curtains) S.add(curtain(M, x0, x1, z, WALL_H - 0.3, 1.9, tie, 5));
    // the rails: a low lacquer wall on every edge where a floor cell meets the dark, on the dark's side, stone caps at the
    // corners of each run
    const rails = [], railTops = [], caps = [], ends = new Map();
    const T0 = 0.04, TH = 0.4;   // the rail's offset from the cell line and its thickness
    const run = (x0, z0, x1, z1, a, b) => {
      rails.push(box(lacq, x0, 0, z0, x1, RAIL_H, z1, 2)); railTops.push(box(gold, x0 - 0.01, RAIL_H, z0 - 0.01, x1 + 0.01, RAIL_H + 0.03, z1 + 0.01, 2));
      for (const p of [a, b]) { const k = p.join(); ends.set(k, (ends.get(k) || []).concat([[a, b]])); }
    };
    const cap = (x, z) => caps.push(box(stone, x - 0.205, 0, z - 0.205, x + 0.205, RAIL_H + 0.1, z + 0.205, 0.5));   // (0.205: at 0.2 a cap's face fell on the cell line, flush with the dark's, and flickered)
    const mid = (a, b) => (a + b) / 2;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (kind(x, y) !== 'f') continue;
      if (kind(x, y + 1) === 'v') { const z = y + 1 + T0; run(x, z, x + 1, z + TH, [x, y + 1, 'h'], [x + 1, y + 1, 'h']); }      // south
      if (kind(x - 1, y) === 'v') { const X = x - T0; run(X - TH, y, X, y + 1, [x, y, 'v'], [x, y + 1, 'v']); }                   // west
      if (kind(x + 1, y) === 'v') { const X = x + 1 + T0; run(X, y, X + TH, y + 1, [x + 1, y, 'V'], [x + 1, y + 1, 'V']); }       // east
    }
    // and beside the walls where they meet the dark (the original draws its rail on up past the rooms' back walls)
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (kind(x, y) === 'w') {
      if (kind(x - 1, y) === 'v') { const X = x - T0; run(X - TH, y, X, y + 1, [x, y, 'v'], [x, y + 1, 'v']); }
      if (kind(x + 1, y) === 'v') { const X = x + 1 + T0; run(X, y, X + TH, y + 1, [x + 1, y, 'V'], [x + 1, y + 1, 'V']); }
    }
    if (L.caps) for (const [x, z] of L.caps) cap(x, z);
    else {   // a cap at every end of a run of rail and at every corner where one turns (by the points the unit pieces share)
      for (const [k, segs] of ends) {
        const [x, y, t] = k.split(','), turns = segs.length === 1 || !segs.every(([a]) => a[2] === segs[0][0][2]);
        if (!turns) continue;
        const X = +x + (t === 'v' ? -T0 - TH / 2 : t === 'V' ? T0 + TH / 2 : 0), Z = +y + (t === 'h' ? T0 + TH / 2 : 0);
        cap(X, Z);
      }
    }
    S.add(shade(merged(lacq, rails)), shade(merged(gold, railTops)), shade(merged(stone, caps)));
    // the low brick walls under a stone coping; one two rows deep (0eb8e6's terrace) is the original's retaining wall: a
    // taller brick face under a stone kerb along its top edge, its top paved in the same brick
    for (const [x0, x1, z0, z1] of L.bricks) {
      if (z1 - z0 < 1) { S.add(shade(box(brick, x0, 0, z0, x1, BRICK_H, z1, 1.5)), shade(box(stone, x0 - 0.05, BRICK_H, z0 - 0.06, x1 + 0.05, BRICK_H + 0.08, z1 + 0.06, 0.5))); continue; }
      const h = TERRACE_H;
      S.add(shade(box(brick, x0, 0, z0, x1, h, z1, 1.5)));
      S.add(shade(box(stone, x0 - 0.05, h, z0 - 0.06, x1 + 0.05, h + 0.08, z0 + 0.3, 0.5)), shade(box(stone, x0 - 0.05, h, z1 - 0.16, x1 + 0.05, h + 0.06, z1 + 0.04, 0.5)));
      S.add(shade(box(stone, x0 - 0.01, 0, z1 - 0.02, x1 + 0.01, 0.12, z1 + 0.06, 0.5), false));   // the plinth along its foot (1 cm past the wall's ends, not flush with them)
    }
    // the steps: pale stone treads let into the carpet, stone newels at the corners
    for (const st of L.steps) {
      const treads = [], zEnd = st.z0 + (st.n - 1) * st.step + 0.3 + 0.14;
      for (let k = 0; k < st.n; k++) { const z = st.z0 + k * st.step; treads.push(box(stone, st.x0, 0, z, st.x1, 0.012 + 0.006 * (st.n - 1 - k), z + 0.3, 0.5)); }
      S.add(shade(merged(stone, treads), false));
      S.add(shade(merged(stone, [[st.x0 - 0.08, st.z0 - 0.1], [st.x1 + 0.08, st.z0 - 0.1], [st.x0 - 0.08, zEnd], [st.x1 + 0.08, zEnd]].map(([x, z]) => box(stone, x - 0.07, 0, z - 0.07, x + 0.07, 0.62, z + 0.07, 0.5)))));
    }
    // chests: the drawn ones, open ones as the art has them; the hidden ones show up when struck
    for (const [x, y] of L.chests) { const g = chest(M, x + 0.5, y + 0.5, 0, false, 0, 1.4); S.add(g); chestG.set(x + ',' + y, g); }
    for (const [x, y] of L.open || []) S.add(chest(M, x + 0.5, y + 0.5, 0, true, 0, 1.4));
    // lanterns hung close before the walls (never over a cell where someone stands in the camera's way), lit warm
    for (const [x, z] of L.lanterns) {
      const y = (z < 4 ? WALL_H : ROOM_H) - 0.55; S.add(lantern(M, x, y, z, 0.8));
      const P = new THREE.PointLight(0xff9a50, 2.2, 5, 1.6); P.position.set(x, y - 0.1, z + 0.3); S.add(P);
    }
  }
  // a doorway through the wall north of (x, y): the original's black opening between its posts, here a dark passage under
  // a lacquered lintel, red posts and a stone sill, a little cold night light from beyond (the way out)
  function doorway(x, y, lacq, gold, stone) {
    const g = new THREE.Group(), h = ROOM_H, z = y, black = new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 1 });
    g.add(box(black, x, 0, z - FACADE - 0.6, x + 1, h, z - FACADE));                  // the far end of the passage
    for (const sx of [x, x + 0.88]) g.add(shade(box(M.lacquerDark, sx, 0, z - FACADE, sx + 0.12, h, z - 0.02)));   // its sides
    for (const sx of [x - 0.04, x + 0.86]) g.add(shade(box(lacq, sx, 0, z - 0.14, sx + 0.18, h - 0.3, z + 0.02)));   // the posts
    g.add(shade(box(lacq, x - 0.08, h - 0.42, z - 0.16, x + 1.08, h - 0.22, z + 0.04)), shade(box(gold, x - 0.1, h - 0.24, z - 0.18, x + 1.1, h - 0.2, z + 0.06)));   // the lintel
    g.add(shade(box(stone, x + 0.04, 0, z - FACADE, x + 0.96, 0.03, z + 0.06, 0.5), false));   // the sill
    const P = new THREE.PointLight(0x7f9ccc, 0.45, 1.8, 2); P.position.set(x + 0.5, 0.35, z - FACADE - 0.2); g.add(P);
    return g;
  }

  function openChest(x, y) {
    const g = chestG.get(x + ',' + y);
    if (!g) return found(x, y);
    const p = g.position, S = g.parent; S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  // a chest the map does not draw: struck, it shows up open
  function found(x, y) {
    if (!world) return;
    const g = chest(M, x + 0.5, y + 0.5, 0, true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
    let t = 0;
    const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
    world.updaters.push(grow);
  }

  return {
    build, openChest, ground: (x, z) => height(x, z), particles: 'dust', viewShift: L.viewShift || 0, props: L.open || [],
    mood: { bg: 0x040205, voidCol: 0x040205, voidY: -1.4, fog: 0x0c0610, fogD: 0.008, sky: 0xffe0c8, under: 0x2a1424, hemi: 0.95,
      sun: 0xffd8b8, sunI: 2.1, sunDir: [-0.3, 0.88, 0.45], sat: 1.02, exposure: 1.18, bloom: 0.4, aoR: 0.7,
      env: { top: 0x8a5a50, mid: 0x5a2a3a, low: 0x1a0a14, lights: [[0, 6, -8, 0xffe0c0, 5], [-7, 4, 0, 0xffc090, 3], [7, 4, 0, 0xffc090, 3]] } },
  };
}

// 0eb2e6: scene 10 and battle 5 (the hidden chests (15, 1) and (2, 18) are battle 5's hook module's)
export default makeMansion({
  map: [
    'wwwwwwwwwwwwwwww',   //  0
    'wwwwwwwwwwwwwfff',   //  1  the east end's wall is a row shallower
    'wwwwwwwwwfffffff',   //  2  and the middle's two
    'ffffffffffffffff',   //  3  the north hall (the chest niche at x 0)
    'ffffffffffffffff',   //  4
    'ffffffffffffffff',   //  5
    'vvvvvvvvvfffffff',   //  6  the east wing
    'vvvvvvvvvffbbbbb',   //  7  its brick wall; the steps at (9-10, 7-8)
    'vvvvvvvvvfffffff',   //  8
    'vvwwwwwwwfffffff',   //  9  the west room's back wall
    'vvwwwwwwwffvvvvv',   // 10
    'vvfffffffffvvvvv',   // 11  the west room
    'vvfffffffffvvvvv',   // 12  its chest at (2, 12)
    'vvvvvvvvvffvvvvv',   // 13  the corridor
    'vvvvvvvvvffvvvvv',   // 14
    'vvwwwwwwwffwwwwv',   // 15  the south room's back walls, the corridor's mouth between
    'vvwwwwwwwffwwwwv',   // 16
    'vvfffffffffffffv',   // 17  the south room
    'vvfffffffffffffv',   // 18
    'vvvvvvvvvvvvvvvv',   // 19
  ],
  columns: [[3.6, 3.15], [8.55, 3.15], [9.0, 2.15], [12.7, 2.15], [13.0, 1.15], [8.9, 11.15], [2.3, 11.15],
    [2.35, 17.15], [5.0, 17.15], [8.9, 17.15], [11.1, 17.15], [12.9, 17.15], [14.85, 17.15]],
  curtains: [[13.1, 13.85, 1.08, 'l']],
  caps: [[3.5, 6.2], [6.0, 6.2], [9.0, 6.2], [2.0, 13.2], [4.1, 13.2], [9.0, 13.2], [11.0, 10.2], [15.9, 10.2], [2.0, 19.2], [5.0, 19.2], [9.0, 19.2], [11.0, 19.2], [13.0, 19.2], [15.9, 19.2], [9.0, 15.0], [11.0, 15.0], [1.9, 9.0], [15.9, 15.0]],
  bricks: [[11.05, 16.4, 7.12, 7.88]],
  steps: [{ x0: 9.12, x1: 10.88, z0: 7.15, n: 4, step: 0.42 }],
  chests: [[2, 12], [0, 4], [0, 5]],
  open: [[0, 3]],   // the open chest in the niche (drawn open: nothing in it)
  lanterns: [[2.0, 3.45], [6.0, 3.45], [11.0, 2.45], [14.5, 1.45], [5.5, 11.45], [5.5, 17.45], [13.0, 17.45]],
  viewShift: 1.5,   // scene 10's cast speaks from the south room at the foot of the original's screen: framed above the dialogue box
});

// 0eb8e6: scene 11 and battle 6 (the hidden chests (21, 3) and (18, 14) are battle 6's hook module's)
export const mansionWest = makeMansion({
  map: [
    'wwwwwwwwwwwwwwwwwwwwwwvv',   //  0
    'wwwwwwwwwwwwwwwwwwwwwwvv',   //  1
    'fffffffffwwwwwwwwwwwwwvv',   //  2  the red panels' face at z 2 (x 0-8), the lattice bays' at z 3
    'ffffffffffffffffffffffvv',   //  3  the north hall
    'vvvvffffffffffffffffffvv',   //  4
    'vvvvffffffffffffffffffvv',   //  5
    'vvvvbbbbbbbbbbffbbbbbbvv',   //  6  the terrace wall, the stair through it at x 14-15
    'vvvvbbbbbbbbbbffbbbbbbvv',   //  7
    'vvvvffffffffffffffffffvv',   //  8  the gallery
    'vvvvffffffffffffffffffvv',   //  9
    'vvvvfffffffffvvvvvvvvvvv',   // 10  its chest at (4, 10)
    'vvvvvvvvvvvffvvvvvvvvvvv',   // 11  the corridor
    'vvvvvvvvvvvffwwwwwwvvvvv',   // 12  the east room's back wall
    'vvvwwwvvvvvffwwwwwwvvvvv',   // 13  the vestibule's
    'vvvwwwwwwwwffffffffvvvvv',   // 14  the south room's wall (x 6-10); the east room
    'vvvwfwwwwwwffffffffvvvvv',   // 15  the doorway out (4, 14), its sill (4, 15)
    'vvvfffwwwwwffffffffvvvvv',   // 16
    'vvvffffffffffffffffvvvvv',   // 17  the south room
    'vvvffffffffffffffffvvvvv',   // 18
    'vvvvvvvvvvvvvvvvvvvvvvvv',   // 19
  ],
  columns: [[9.1, 3.15], [13.7, 3.15], [17.2, 3.15], [21.7, 3.15], [3.25, 16.15], [5.8, 16.15], [6.15, 17.15], [10.85, 17.15],
    [13.15, 14.15], [15.2, 14.15], [18.85, 14.15]],
  curtains: [[8.1, 8.95, 2.08, 'r']],
  bricks: [[4.05, 13.95, 6.1, 7.9], [16.05, 21.95, 6.1, 7.9]],
  steps: [{ x0: 14.12, x1: 15.88, z0: 6.15, n: 6, step: 0.43 }],
  doors: [[4, 15]],
  chests: [[4, 10]],
  lanterns: [[2.5, 2.45], [6.5, 2.45], [11.4, 3.45], [15.4, 3.45], [19.4, 3.45], [8.5, 17.45], [16.0, 14.45]],
});
