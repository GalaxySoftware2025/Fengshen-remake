// icecave.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the floor (the art's grey-green cobbles): rounded stones packed close, each its own shade of grey-green, a pale cold
// rim where its crown catches the light, dark joints; calm (the play view looks down on it most)
export function cobbles() {
  return ['iceCobbles3', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 4, 191, 0.85), gap = w1 - w0 + (T.fbm(u, v, 16, 3, 192) - 0.5) * 0.05, stone = T.smooth(0.0, 0.05, gap);
    const n = T.fbm(u, v, 14, 4, 193), big = T.fbm(u, v, 3, 3, 194), edge = T.smooth(0.12, 0.0, gap);
    let c = T.mixc([0.27, 0.34, 0.33], [0.42, 0.5, 0.47], id * 0.45 + n * 0.3 + big * 0.25);
    c = c.map(q => q * (1 - edge * 0.12));   // the edges a little worn down, a touch darker
    c = T.mixc(c.map(q => q * 0.45), c, stone);
    o.c = c; o.h = 0.4 + stone * 0.15 - edge * 0.06 + n * 0.06; o.r = 0.75;
  }, 2];
}
// the walls' glazed brick (the art's small blue bricks): eight courses and four bricks a unit, running bond, each brick
// its own blue from deep cobalt to azure, glossy, a pale glint along its upper edge, navy joints
export function glazedBrick() {
  return ['iceGlaze2', 1024, (u, v, o) => {
    const row = Math.floor(v * 8), fv = v * 8 - row, bu = u * 4 + (row % 2) * 0.5, bi = Math.floor(bu), fu = bu - bi, cell = [((bi % 4) + 4) % 4, row];
    const id = T.pnoise(cell[0], cell[1], 4, 21, 8), id2 = T.pnoise(cell[0], cell[1], 4, 23, 8), e = Math.min(Math.min(fu, 1 - fu) * 0.25, Math.min(fv, 1 - fv) * 0.125);
    const joint = T.smooth(0.006, 0.002, e), glint = T.smooth(0.3, 0.0, 1 - fv) * T.smooth(0.0, 0.004, e) * T.smooth(0.35, 0.7, id2), n = T.fbm(u, v, 20, 3, 22), cloud = T.fbm(u, v, 3, 3, 24);
    let c = T.mixc([0.05, 0.09, 0.24], [0.14, 0.27, 0.55], id * 0.6 + n * 0.15 + cloud * 0.25);
    c = T.mixc(c, [0.32, 0.5, 0.72], T.smooth(0.8, 0.95, id2) * 0.5);   // now and then a paler, frosted brick
    c = T.mixc(c, [0.6, 0.82, 0.92], glint * 0.5); c = T.mixc(c, [0.02, 0.03, 0.09], joint);
    o.c = c; o.h = 0.6 - joint * 0.5 + n * 0.04; o.r = 0.25 + joint * 0.6 + T.smooth(0.8, 0.95, id2) * 0.3;
  }, 3];
}
