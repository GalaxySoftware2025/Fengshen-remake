// hall.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the rock's own stone (painted with v up the faces, as kit/terrain.js Land lays it on them): slate broken into angular
// facets, each its own shade of blue-grey, their edges catching a pale crystal light, now and then a vein of blue
// crystal (rooms 0-4); golden flowstone, drip streaks running down it over bands of darker and paler stone, dark in the
// runnels (5-9)
export function slateTex() {
  return ['hallSlate', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 9, 151, 0.95), edge = T.smooth(0.07, 0.0, w1 - w0), n = T.fbm(u, v, 10, 5, 152), big = T.fbm(u, v, 3, 3, 153);
    const vein = T.smooth(0.035, 0.0, Math.abs(T.fbm(u, v, 4, 4, 154) - 0.5)) * T.smooth(0.45, 0.65, T.fbm(u, v, 2, 2, 155));
    let c = T.mixc([0.16, 0.18, 0.26], [0.42, 0.47, 0.6], id * 0.55 + n * 0.3 + big * 0.15);
    c = T.mixc(c, [0.5, 0.6, 0.82], edge * 0.25); c = T.mixc(c, [0.45, 0.62, 1.0], vein * 0.8);
    o.c = c; o.h = 0.35 + id * 0.25 + n * 0.25 - edge * 0.2 + vein * 0.1; o.r = 0.6 - vein * 0.3 - edge * 0.15;
  }, 6];
}
export function flowTex() {
  return ['hallFlowstone', 1024, (u, v, o) => {
    const drip = T.fbmA(u, v, 18, 2, 4, 161), run = T.smooth(0.38, 0.28, drip), band = 0.5 + 0.5 * Math.sin((v * 7 + T.fbm(u, v, 2, 3, 162) * 2) * Math.PI * 2);
    const n = T.fbm(u, v, 8, 4, 163), [w0, w1] = T.worley(u, v, 5, 164, 0.9), crack = T.smooth(0.03, 0.0, w1 - w0) * T.smooth(0.55, 0.7, T.fbm(u, v, 3, 3, 165));
    let c = T.mixc([0.5, 0.36, 0.16], [0.78, 0.58, 0.28], drip * 0.45 + n * 0.4 + band * 0.15);
    c = T.mixc(c, [0.9, 0.76, 0.48], T.smooth(0.66, 0.82, drip) * 0.3); c = T.mixc(c, [0.24, 0.16, 0.07], Math.max(run * 0.3, crack * 0.25));
    o.c = c; o.h = 0.35 + drip * 0.3 + n * 0.15 - crack * 0.1; o.r = 0.72 - T.smooth(0.66, 0.82, drip) * 0.15;
  }, 3];
}
