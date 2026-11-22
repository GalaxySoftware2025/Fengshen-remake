// firecave.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the cave's rock (the art's cobbled mauve-brown walls): rounded stones packed in a matrix of darker grit, each its own
// shade, soot in the crevices
export function cobbleTex() {
  return ['fireCobble', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 5, 171, 0.8), gap = w1 - w0 + (T.fbm(u, v, 20, 3, 174) - 0.5) * 0.1, stone = T.smooth(0.0, 0.3, gap);
    const n = T.fbm(u, v, 16, 5, 172), big = T.fbm(u, v, 2, 3, 173), crown = T.smooth(0.55, 0.0, w0);
    let c = T.mixc([0.34, 0.2, 0.18], [0.64, 0.44, 0.38], id * 0.35 + n * 0.4 + big * 0.25);
    c = c.map(q => q * (0.72 + 0.4 * crown));   // lit on its crown, shaded toward its edges
    c = T.mixc(c.map(q => q * 0.4), c, stone);
    o.c = c; o.h = 0.25 + stone * (0.3 + crown * 0.35) + n * 0.12; o.r = 0.85;
  }, 5];
}
// the floor (the art's orange-brown ground, streaked on the slant): scorched earth, streaks running across it, ash grey
// in patches, cinders, fine cracks
export function scorchTex() {
  return ['fireScorch', 1024, (u, v, o) => {
    const su = (u + v) % 1, sv = ((v - u) % 1 + 1) % 1, streak = T.fbmA(su, sv, 40, 6, 4, 181), n = T.fbm(u, v, 9, 4, 182), ash = T.smooth(0.58, 0.78, T.fbm(u, v, 4, 4, 183));
    const [w0, w1] = T.worley(u, v, 6, 184, 0.9), crack = T.smooth(0.015, 0.0, w1 - w0) * T.smooth(0.5, 0.65, T.fbm(u, v, 3, 3, 185)), cinder = T.smooth(0.82, 0.9, T.pnoise(u * 160, v * 160, 160, 186));
    let c = T.mixc([0.42, 0.2, 0.08], [0.66, 0.36, 0.15], streak * 0.6 + n * 0.4);
    c = T.mixc(c, [0.4, 0.33, 0.28], ash * 0.45); c = T.mixc(c, [0.14, 0.07, 0.04], Math.max(crack * 0.7, cinder * 0.6));
    o.c = c; o.h = 0.4 + streak * 0.2 + n * 0.15 - crack * 0.3 + cinder * 0.15; o.r = 0.92;
  }, 3];
}
