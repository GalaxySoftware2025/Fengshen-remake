// Terraced land on a battle map's grid (the canyon's way, src/remake/canyon.js, made general): the open cells a unit can
// reach from its start are level floors, one level per stretch of floor between stairs; blocked cells are cliff rising
// from the highest floor beside them, but those listed as flat (a house's or a grove's ground) stay at that floor's
// level; stairs are ramps between two levels. Land (src/kit/terrain.js) supplies the rock's shape over it.
//   o = { w, h, terrain (D.terrain), start: [x, y], levels: [[x, y, h], ...] (a cell of each floor and its height),
//         stairs: [{ r: [x0, z0, x1, z1], y0 (north end), y (south end), n }], flat(cx, cy) }
// returns { reach, walk(cx, cy), level(cx, cy), inStair(x, z), lvl(x, z), rim(x, z) }
export function terraces(o) {
  const { w: MW, h: MH } = o, W = MW * 4, H4 = MH * 4;
  const tc = (cx, cy) => o.terrain && o.terrain[cy] ? o.terrain[cy][cx] : 0;
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH && tc(cx, cy) !== 1 && tc(cx, cy) !== 2;
  const inStair = (x, z) => (o.stairs || []).find(s => x >= s.r[0] && x < s.r[2] && z >= s.r[1] && z < s.r[3]);
  const reach = new Set();
  for (const q = [o.start]; q.length;) {
    const [x, y] = q.shift(); if (!open(x, y) || reach.has(x + ',' + y)) continue;
    reach.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const walk = (cx, cy) => reach.has(cx + ',' + cy);
  const flat = o.flat || (() => false);
  const level = new Float32Array(MW * MH).fill(-1);
  const fill = (sx, sy, hh) => { for (const q = [[sx, sy]]; q.length;) { const [x, y] = q.shift(); if (x < 0 || y < 0 || x >= MW || y >= MH) continue; const k = y * MW + x;
    if (!walk(x, y) || inStair(x + 0.5, y + 0.5) || level[k] >= 0) continue; level[k] = hh; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } };
  for (const [x, y, hh] of o.levels) fill(x, y, hh);
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {   // the rest: the highest floor (or stair top) within 4
    const k = cy * MW + cx; if (level[k] >= 0) continue;
    let best = -1;
    for (let r = 1; r <= 4 && best < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const s = inStair(x + 0.5, y + 0.5), v = s ? Math.max(s.y0, s.y) : level[y * MW + x]; if (walk(x, y) || s) best = Math.max(best, v);
    }
    level[k] = Math.max(0, best);
  }
  const fixed = (cx, cy) => (walk(cx, cy) && !inStair(cx + 0.5, cy + 0.5)) || (cx >= 0 && cy >= 0 && cx < MW && cy < MH && flat(cx, cy));
  // the field at the layout's resolution, the rock softened a little so rims drop over half a cell; floors stay level
  let L = new Float32Array(W * H4);
  for (let j = 0; j < H4; j++) for (let i = 0; i < W; i++) L[j * W + i] = level[(j >> 2) * MW + (i >> 2)];
  for (let pass = 0; pass < 2; pass++) { const N = new Float32Array(W * H4);
    for (let j = 0; j < H4; j++) for (let i = 0; i < W; i++) { if (fixed(i >> 2, j >> 2)) { N[j * W + i] = L[j * W + i]; continue; }
      let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H4) continue; s += L[jj * W + ii]; n++; } N[j * W + i] = s / n; }
    L = N; }
  const lvl = (x, z) => {
    const cx = Math.floor(x), cz = Math.floor(z); if (fixed(cx, cz) && !inStair(x, z)) return level[cz * MW + cx];
    const fx = Math.max(0, Math.min(W - 1.001, x * 4 - 0.5)), fz = Math.max(0, Math.min(H4 - 1.001, z * 4 - 0.5)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const g = (a, b) => L[Math.min(H4 - 1, b) * W + Math.min(W - 1, a)];
    return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - tz) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * tz;
  };
  // rock just south of a floor (between it and the camera) stays within 0.9 of it: no one at a rim is hidden
  const rim = (x, z) => { const cx = Math.floor(x); for (const d of [0.4, 0.9, 1.4]) { const cz = Math.floor(z - d); if (walk(cx, cz) && !inStair(cx + 0.5, cz + 0.5)) return level[cz * MW + cx] + 0.9 + Math.max(0, d - 0.9) * 0.6; } return 99; };
  return { reach, walk, level: (cx, cy) => level[Math.max(0, Math.min(MH - 1, cy)) * MW + Math.max(0, Math.min(MW - 1, cx))], inStair, lvl, rim, fixed };
}
// Land's height over terraces: the land's own relief (rock rising off the layout) on the levels; the stairs absolute
export function terracedAt(land, t) {
  const at0 = land.at.bind(land);
  return (x, z) => {
    if (t.inStair(x, z)) return at0(x, z);
    let h = t.lvl(x, z) + at0(x, z);
    if (!t.walk(Math.floor(x), Math.floor(z))) h = Math.min(h, t.rim(x, z));
    return h;
  };
}
