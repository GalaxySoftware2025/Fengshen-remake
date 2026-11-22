// wanshou.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the plateaus' earth (the art's speckled orange ground): dry ochre earth, fine grit, broad mottling, a few hairline
// cracks; natural, not saturated (DESIGN.md §2: calm tops)
export function earthTex() {
  return ['beastEarth', 1024, (u, v, o) => {
    const n = T.fbm(u, v, 5, 5, 301), grit = T.pnoise(u * 260, v * 260, 260, 302), grit2 = T.pnoise(u * 90, v * 90, 90, 303), mot = T.fbm(u, v, 2, 3, 304);
    const [w0, w1] = T.worley(u, v, 5, 305, 0.9), crack = T.smooth(0.012, 0.0, w1 - w0) * T.smooth(0.55, 0.7, T.fbm(u, v, 3, 3, 306));
    let c = T.mixc([0.5, 0.29, 0.13], [0.68, 0.43, 0.21], n * 0.55 + mot * 0.45);
    c = T.mixc(c, [0.38, 0.2, 0.08], T.smooth(0.64, 0.84, grit) * 0.4); c = T.mixc(c, [0.78, 0.56, 0.32], T.smooth(0.7, 0.86, grit2) * 0.3);
    c = T.mixc(c, [0.32, 0.17, 0.07], crack * 0.6);
    o.c = c; o.h = 0.45 + n * 0.15 + (grit - 0.5) * 0.08 - crack * 0.2; o.r = 0.93;
  }, 3];
}
// the dry grass patches' ground (under the instanced tufts): straw and olive over the earth
export function dryTurf() {
  return ['beastTurf', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 5, 311), b = T.fbm(u, v, 70, 2, 312), soil = T.smooth(0.6, 0.78, T.fbm(u, v, 4, 3, 313));
    let c = T.mixc([0.36, 0.3, 0.12], [0.6, 0.5, 0.22], n * 0.6 + b * 0.4);
    c = T.mixc(c, [0.55, 0.33, 0.15], soil * 0.5);
    o.c = c; o.h = 0.5 + b * 0.2; o.r = 0.95;
  }, 2];
}
// the cliffs (the art's dark violet rock of rounded lumps, stacked in columns): weathered stones packed in a dark matrix,
// taller than wide, each its own shade from deep violet to dusty mauve, lit on its crown (kit/terrain.js Land lays only
// the colour on the rock), dark in the crevices
export function cliffTex() {
  return ['beastCliff5', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 9, 321, 0.8), gap = w1 - w0 + (T.fbm(u, v, 18, 3, 322) - 0.5) * 0.1, mask = T.smooth(0.38, 0.62, T.fbm(u, v, 4, 3, 326));
    const stone = 1 - (1 - T.smooth(0.0, 0.12, gap)) * mask, n = T.fbm(u, v, 14, 5, 323), big = T.fbm(u, v, 2, 3, 324), streak = T.fbmA(u, v, 24, 3, 4, 325);
    const crown = T.smooth(0.55, 0.0, w0) * mask, ledge = T.smooth(0.08, 0.0, Math.abs(((v * 5 + T.fbm(u, v, 3, 3, 327) * 1.5) % 1) - 0.5) - 0.42);   // (a few weathered ledges across the face)
    let c = T.mixc([0.2, 0.15, 0.21], [0.5, 0.4, 0.46], id * 0.2 * mask + n * 0.35 + streak * 0.25 + big * 0.2);
    c = c.map(q => q * (0.85 + 0.25 * crown - ledge * 0.25));
    c = T.mixc(c.map(q => q * 0.55), c, stone);
    o.c = c; o.h = 0.3 + stone * (0.2 + crown * 0.15) + n * 0.14 + streak * 0.08 - ledge * 0.1; o.r = 0.88;
  }, 5];
}
