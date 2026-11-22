// tianmen.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the crystal's top: ice-blue, facets in it (a few broad planes meeting at soft ridges), clearer and paler toward the
// edges, a fine frost in places
export function crystalTex() {
  return ['tmCrystal2', 512, (u, v, o) => {
    // the original's tile: deep blue glass, its rim frosted bright cyan-white, a diagonal sheen across it from the top left
    const [w0, w1] = T.worley(u, v, 3, 701, 1), ridge = T.smooth(0.05, 0.0, w1 - w0), n = T.fbm(u, v, 8, 3, 702);
    const e = Math.min(u, 1 - u, v, 1 - v), rim = T.smooth(0.13, 0.02, e), frost = T.smooth(0.55, 0.75, T.fbm(u, v, 24, 3, 703)) * T.smooth(0.22, 0.05, e);
    const d = (u - v) * 0.7071, sheen = T.smooth(0.07, 0.0, Math.abs(d + 0.12)) * 0.8 + T.smooth(0.03, 0.0, Math.abs(d - 0.05)) * 0.45;
    let c = T.mixc([0.06, 0.18, 0.5], [0.12, 0.32, 0.7], w0 * 0.5 + n * 0.5);
    c = T.mixc(c, [0.45, 0.75, 0.98], ridge * 0.35); c = T.mixc(c, [0.7, 0.92, 1], sheen * 0.6);
    c = T.mixc(c, [0.75, 0.95, 1], Math.max(rim, frost) * 0.85);
    o.c = c; o.h = 0.5 + w0 * 0.1 + ridge * 0.08 + rim * 0.2; o.r = 0.08 + frost * 0.3;
  }, 1];
}
