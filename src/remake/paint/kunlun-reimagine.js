// kunlun-reimagine.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// ---------------------------------------------------------------- surfaces
// the pillars' tops: weathered pale granite worn flat, broad plates parted by fine joints with a little moss in them,
// lichen here and there (calm: the play view sees it most)
export function stoneTex() {
  return ['krStone7', 1024, (u, v, o) => {
    const n = T.fbm(u, v, 3, 4, 903), m = T.fbm(u, v, 8, 4, 906), grain = T.fbm(u, v, 90, 2, 904);
    const [w0, w1] = T.worley(u, v, 3, 901, 0.9), [q0, q1] = T.worley(u, v, 7, 909, 0.9);
    const crack = Math.max(T.smooth(0.014, 0.0, w1 - w0) * T.smooth(0.45, 0.6, T.fbm(u, v, 5, 3, 902)), T.smooth(0.008, 0.0, q1 - q0) * T.smooth(0.6, 0.72, T.fbm(u, v, 6, 3, 910)) * 0.7);
    const vein = T.smooth(0.012, 0.0, Math.abs(T.fbm(u, v, 2, 4, 911) - 0.5) - 0.002) * T.smooth(0.4, 0.6, T.fbm(u, v, 4, 2, 912));   // (a quartz vein winding through)
    const lich = T.smooth(0.6, 0.76, T.fbm(u, v, 7, 4, 905)), dots = T.smooth(0.8, 0.86, T.fbm(u, v, 40, 2, 913)) * lich, weather = T.smooth(0.5, 0.78, T.fbm(u, v, 5, 4, 908));
    let c = T.mixc([0.55, 0.52, 0.47], [0.7, 0.67, 0.61], n * 0.7 + m * 0.3);
    c = T.mixc(c, [0.45, 0.43, 0.39], weather * 0.5); c = T.mixc(c, [0.64, 0.66, 0.55], lich * 0.35); c = T.mixc(c, [0.78, 0.76, 0.6], dots * 0.5);
    c = T.mixc(c, [0.76, 0.75, 0.72], vein * 0.35);
    c = c.map(q => q * (0.97 + (grain - 0.5) * 0.08)); c = T.mixc(c, [0.3, 0.29, 0.26], crack * 0.6);
    o.c = c; o.h = 0.5 + n * 0.1 - weather * 0.05 - crack * 0.3 + vein * 0.05; o.r = 0.8 + weather * 0.1;
  }, 2];
}
// alpine turf: short grass and moss, olive to fresh green, never saturated
export function turfTex() {
  return ['krTurf2', 512, (u, v, o) => {
    const n = T.fbm(u, v, 5, 4, 911), b = T.pnoise(u * 120, v * 120, 120, 912), m = T.fbm(u, v, 16, 3, 913);
    o.c = T.mixc([0.3, 0.38, 0.17], [0.5, 0.55, 0.27], n * 0.55 + b * 0.3 + m * 0.15); o.h = 0.5 + b * 0.2; o.r = 0.95;
  }, 2];
}
// the cliffs: pale granite in tall jointed columns, darker streaks where water runs down, faint bedding across
export function cliffTex() {
  return ['krCliff5', 1024, (u, v, o) => {
    const wob = T.fbm(u, v, 3, 3, 921) * 0.6, ju = (u * 5 + wob) % 1, jw = 0.46 + T.fbm(u, v, 6, 2, 926) * 0.05, joint = T.smooth(0.04, 0.0, Math.abs(ju - 0.5) - jw) * T.smooth(0.3, 0.55, T.fbmA(u, v, 4, 14, 2, 927));
    const col = Math.floor(u * 5 + wob), tone = R(col * 3.7 + 1) * 0.1, streak = T.fbmA(u, v, 36, 3, 4, 922), stain = T.smooth(0.5, 0.78, T.fbmA(u, v, 8, 2, 3, 923));
    const n = T.fbm(u, v, 10, 4, 925), grain = T.pnoise(u * 200, v * 200, 200, 928);
    let c = T.mixc([0.42, 0.41, 0.39], [0.62, 0.6, 0.55], n * 0.5 + streak * 0.35 + 0.15 - tone);
    c = T.mixc(c, [0.27, 0.28, 0.28], stain * 0.5); c = T.mixc(c, [0.2, 0.2, 0.2], joint * 0.6);
    c = c.map(q => q * (0.94 + grain * 0.1));
    o.c = c; o.h = 0.5 + (n - 0.5) * 0.3 + streak * 0.15 - joint * 0.35 - tone; o.r = 0.9;
  }, 4];
}
// the tops: stone, turf and the summit's white-jade paving by the mix each point carries (aMix: turf, paving)
// the summit's paving: courses of long white stones of uneven lengths, worn at the arrises, the joints dark with moss
export function paveTex() {
  return ['krPave2', 1024, (u, v, o) => {
    const N = 3, row = Math.floor(v * N), fv = v * N - row, cuts = [];
    let x = R(row * 9.1) * 0.3; while (x < 1.3) { cuts.push(x); x += 0.28 + R(row * 13.7 + x * 7.3) * 0.32; }
    let du = 1, id = 0; for (let i = 0; i < cuts.length; i++) { const c = cuts[i] % 1, d = Math.min(Math.abs(u - c), Math.abs(u - c + 1), Math.abs(u - c - 1)); if (d < du) { du = d; } if (u >= c) id = i; }
    const e = Math.min(du * 3, fv, 1 - fv), joint = T.smooth(0.022, 0.006, e + (T.fbm(u, v, 40, 2, 941) - 0.5) * 0.01), wear = T.smooth(0.0, 0.07, e);
    const n = T.fbm(u, v, 8, 4, 942), tint = R(row * 3.3 + id * 1.9), pit = T.smooth(0.78, 0.9, T.fbm(u, v, 60, 2, 943));
    let c = T.mixc([0.66, 0.64, 0.6], [0.78, 0.76, 0.71], tint * 0.6 + n * 0.4); c = c.map(q => q * (0.94 + wear * 0.06) - pit * 0.05);
    c = T.mixc(c, [0.26, 0.3, 0.22], joint * 0.85);
    o.c = c; o.h = 0.5 + wear * 0.12 + (n - 0.5) * 0.06 - joint * 0.3 - pit * 0.05; o.r = 0.55 + joint * 0.3;
  }, 3];
}
