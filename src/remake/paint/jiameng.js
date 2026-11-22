// jiameng.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the logs: barked, golden timber, the grain running along each log (the cylinder's v) with a knot here and there,
// darker in the cracks and weathered grey-brown towards the ends
export function logTex() {
  return ['jmLog', 512, (u, v, o) => {
    const w = T.fbmA(u, v, 3, 18, 4, 31), grain = 0.5 + 0.5 * Math.sin((u * 26 + w * 3) * Math.PI * 2), n = T.fbm(u, v, 10, 3, 32);
    const knot = T.smooth(0.08, 0.0, Math.hypot(((u * 3) % 1) - 0.5, (((v + 0.37) * 5) % 1) - 0.5) - 0.06 * T.fbm(u, v, 30, 2, 33));
    const crack = 1 - T.smooth(0.0, 0.012, Math.abs(T.fbmA(u, v, 2, 30, 3, 34) - 0.5)), end = T.smooth(0.12, 0.0, Math.min(v, 1 - v));
    o.c = T.mixc([0.62, 0.36, 0.14], [0.9, 0.6, 0.26], grain * 0.55 + n * 0.45);
    o.c = T.mixc(o.c, [0.36, 0.2, 0.08], Math.max(knot * 0.8, crack * 0.7));
    o.c = T.mixc(o.c, [0.42, 0.33, 0.24], end * 0.5);
    o.h = 0.5 + (grain - 0.5) * 0.08 - crack * 0.25 - knot * 0.1; o.r = 0.8;
  }, 4];
}
// the floor: jade-green tiles a cell each, a key fret raised in each (the original's pattern), darker in the grooves;
// lighter than the art so the dark move squares read on it
export function fretFloor() {
  return ['jmFret', 512, (u, v, o) => {
    const N = 2, x = (u * N) % 1, y = (v * N) % 1, e = Math.min(x, 1 - x, y, 1 - y), n = T.fbm(u, v, 12, 3, 51);
    const gx = Math.floor(x * 8), gy = Math.floor(y * 8), fx = x * 8 - gx, fy = y * 8 - gy;
    // the fret: a meander of raised strips on an 8x8 grid
    const P = ['########', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######', '#.......'];
    const on = P[gy] && P[gy][gx] === '#' && fx > 0.18 && fx < 0.82 && fy > 0.18 && fy < 0.82 || (P[gy] && P[gy][gx] === '#' && ((gx < 7 && P[gy][gx + 1] === '#' && fx >= 0.5) || (gx > 0 && P[gy][gx - 1] === '#' && fx <= 0.5) || (gy < 7 && P[gy + 1] && P[gy + 1][gx] === '#' && fy >= 0.5) || (gy > 0 && P[gy - 1][gx] === '#' && fy <= 0.5)) && fx > 0.18 && fx < 0.82 || false);
    const joint = 1 - T.smooth(0.006, 0.03, e);
    o.c = T.mixc([0.2, 0.36, 0.22], [0.26, 0.44, 0.27], n);
    if (on) o.c = T.mixc(o.c, [0.34, 0.52, 0.32], 0.6);
    o.c = T.mixc(o.c, [0.08, 0.16, 0.08], joint * 0.8);
    o.h = 0.5 + (on ? 0.12 : 0) - joint * 0.3 + (n - 0.5) * 0.04; o.r = 0.45;
  }, 4];
}
// the screen's leaves: white silk, a wash of gold clouds rising from the foot
export function screenTex() {
  return ['jmScreen2', 256, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 61), cloud = T.smooth(0.18, 0.32, v * 0.9 + (n - 0.5) * 0.25 + Math.sin(u * 12) * 0.03);   // (v 0 at the foot)
    o.c = T.mixc([0.96, 0.95, 0.93], [0.95, 0.72, 0.22], (1 - cloud) * T.smooth(0.0, 0.25, v + 0.05));
    o.h = 0.5; o.r = 0.85;
  }, 2];
}
