// zhuxian.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// the cobbles: rounded stones of grey-green as drawn, large and worn flat, set close in dark joints; a stone here and
// there paler or darker, a little grit in the joints. Calm: no moss, no specks
export function cobbleTex() {
  return ['zxCobble5', 512, (u, v, o) => {
    const wob = (T.fbm(u, v, 14, 3, 275) - 0.5) * 0.09;   // (the joints wander: no ruled cracks)
    const [d1, d2, id] = T.worley(u + wob, v - wob, 5, 271, 1), edge = d2 - d1, n = T.fbm(u, v, 10, 4, 272), fine = T.fbm(u, v, 48, 3, 273), grit = T.fbm(u, v, 90, 2, 274);
    const wide = 0.1 + T.fbm(u, v, 9, 2, 276) * 0.08, dome = T.smooth(0.02, 0.45, edge), joint = 1 - T.smooth(0.02, wide, edge);
    const tone = R(id * 97.3), base = T.mixc(T.mixc([0.36, 0.43, 0.41], [0.5, 0.56, 0.52], id), [0.47, 0.47, 0.42], tone * 0.35);   // grey-green stones, a few warmer
    const worn = T.smooth(0.6, 0.95, dome) * (0.5 + fine * 0.5);
    let c = T.mixc(base, [base[0] * 1.15, base[1] * 1.13, base[2] * 1.1], worn * 0.45);
    c = T.mixc(c, [c[0] * 0.84, c[1] * 0.86, c[2] * 0.86], (fine - 0.3) * 0.7 + (n - 0.5) * 0.4);
    c = c.map(q => q * (0.74 + 0.26 * dome));   // (shaded toward its joint: a rounded stone)
    c = T.mixc(c, T.mixc([0.17, 0.18, 0.16], [0.27, 0.27, 0.23], grit), joint * 0.62);
    o.c = c; o.h = 0.3 + dome * 0.32 + (n - 0.5) * 0.05 + (fine - 0.5) * 0.035 - joint * 0.1 + grit * joint * 0.05; o.r = 0.86 - worn * 0.16 + joint * 0.08;
  }, 6];
}
// the brick: cobalt glaze, each brick its own depth of blue between the original's navy and its mid-blue, the glaze
// pooled pale along the top edges (the art's light strokes), dark sunken joints, crazing here and there
export function glazeTex() {
  return ['zxGlaze2', 512, (u, v, o) => {
    const rows = 8, y = v * rows, ry = Math.floor(y), x = u * 3 + (ry % 2) * 0.5, rx = Math.floor(x), fx = x - rx, fy = y - ry;
    const id = R(((rx % 3) + 3) % 3 * 17 + ry * 5.3), n = T.fbm(u, v, 10, 4, 281), craze = T.smooth(0.0, 0.02, Math.abs(T.fbm(u, v, 30, 3, 282) - 0.5));
    const e = Math.min(fx * 3 / rows * 2.5, (1 - fx) * 3 / rows * 2.5, fy, 1 - fy), mortar = T.smooth(0.09, 0.035, e), lip = T.smooth(0.3, 0.06, fy) * (1 - mortar);
    let c = T.mixc([0.045, 0.07, 0.2], [0.08, 0.17, 0.4], id * 0.75 + n * 0.25);
    c = T.mixc(c, [0.22, 0.42, 0.6], lip * 0.35);
    c = T.mixc(c, [c[0] * 0.8, c[1] * 0.85, c[2] * 0.9], (1 - craze) * 0.25);
    c = T.mixc(c, [0.04, 0.05, 0.1], mortar * 0.9);
    o.c = c; o.h = 0.6 - mortar * 0.45 + lip * 0.04 + n * 0.03; o.r = 0.18 + mortar * 0.7 + (1 - craze) * 0.08;
  }, 3];
}
// the coping: turquoise glazed tiles, the original's bright rim (00b4fc) in a natural key
export function copeTex() {
  return ['zxCope2', 256, (u, v, o) => {
    const k = Math.floor(u * 4), f = u * 4 - k, n = T.fbm(u, v, 8, 3, 291), j = T.smooth(0.05, 0.0, Math.min(f, 1 - f));
    o.c = T.mixc(T.mixc([0.09, 0.32, 0.37], [0.18, 0.46, 0.5], R(k * 7.1) * 0.6 + n * 0.4), [0.04, 0.09, 0.1], j * 0.8);
    o.h = 0.6 - j * 0.4 + n * 0.04; o.r = 0.2 + j * 0.6;
  }, 2];
}
