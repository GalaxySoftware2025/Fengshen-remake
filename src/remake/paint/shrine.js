// shrine.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the floor's golden sandstone (the art's grainy gold brick): a texture three cells square, two courses a cell, bricks a
// cell and a half long in running bond; each brick its own shade, bevelled and worn at its arrises, the sand's grain in
// dark and pale specks, a few cracked across; sunk dark mortar between. Worn smooth (less rough) where feet have gone.
export function sandstone() {
  return ['shrineSandstone', 1024, (u, v, o) => {
    const row = Math.floor(v * 6), fv = v * 6 - row, bu = u * 2 + (row % 2) * 0.5, bi = Math.floor(bu), fu = bu - bi;
    const id = T.pnoise(((bi % 2) + 2) % 2, row, 2, 5, 6), id2 = T.pnoise(((bi % 2) + 2) % 2, row, 2, 6, 6);
    const ex = Math.min(fu, 1 - fu) * 1.5, ey = Math.min(fv, 1 - fv) * 0.5, e = Math.min(ex, ey);   // (cells to the brick's edge)
    const chip = (T.fbm(u, v, 24, 3, 7) - 0.5) * 0.03, mortar = T.smooth(0.018, 0.008, e + chip), bevel = T.smooth(0.0, 0.07, e + chip);
    const grain = T.pnoise(u * 340, v * 340, 340, 9), grain2 = T.pnoise(u * 170, v * 170, 170, 10), cloud = T.fbm(u, v, 6, 4, 11);
    const [w0, w1] = T.worley(u, v, 9, 12, 0.9), crack = id2 > 0.78 ? T.smooth(0.012, 0.0, w1 - w0) * T.smooth(0.03, 0.08, e) : 0;
    let c = T.mixc([0.56, 0.4, 0.17], [0.84, 0.66, 0.34], id * 0.6 + cloud * 0.4);
    c = T.mixc(c, [0.42, 0.28, 0.1], T.smooth(0.58, 0.78, grain) * 0.6); c = T.mixc(c, [0.96, 0.84, 0.52], T.smooth(0.66, 0.84, grain2) * 0.45);
    c = T.mixc(c, [0.38, 0.27, 0.12], T.smooth(0.12, 0.0, e) * 0.35 + T.smooth(0.55, 0.8, T.fbm(u, v, 3, 3, 13)) * 0.25);   // grime in the joints and in broad patches
    c = T.mixc(c, c.map(q => q * 0.72), 1 - bevel); c = T.mixc(c, [0.3, 0.2, 0.08], crack * 0.8); c = T.mixc(c, [0.24, 0.16, 0.06], mortar);
    o.c = c; o.h = 0.25 + bevel * 0.55 + (grain - 0.5) * 0.06 + cloud * 0.08 - crack * 0.25 - mortar * 0.25;
    o.r = 0.78 - (1 - cloud) * 0.25 * bevel + mortar * 0.15;
  }, 4];
}
