// zhaixing-reimagine.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// ---------------------------------------------------------------- materials
// white jade: a slab a cell, faintly veined and clouded, the joints fine and grey
export function jadeTex() {
  return ['zxJade', 512, (u, v, o) => {
    const su = (u * 2) % 1, sv = (v * 2) % 1, id = Math.floor(u * 2) + Math.floor(v * 2) * 2;
    const j = Math.min(su, 1 - su, sv, 1 - sv), joint = T.smooth(0.012, 0.0, j), bev = T.smooth(0.03, 0.006, j);
    const cloud = T.fbm(u + id * 0.37, v, 3, 4, 701), vein = 1 - T.smooth(0.0, 0.02, Math.abs(T.fbmA(u + id * 0.2, v, 2, 5, 3, 702) - 0.5));
    let c = T.mixc([0.93, 0.92, 0.88], [0.84, 0.86, 0.84], cloud * 0.8); c = T.mixc(c, [0.7, 0.72, 0.7], vein * 0.35);
    c = c.map(q => q * (0.97 + T.pnoise(id * 3.1, 0.5, 8) * 0.05)); c = T.mixc(c, [0.42, 0.42, 0.4], joint * 0.8);
    o.c = c; o.h = 0.55 - bev * 0.3 - joint * 0.3 + cloud * 0.04; o.r = 0.32 + cloud * 0.12 + joint * 0.5;
  }, 2];
}
// a lit lattice window bay of the storeys below, a bay a texture: lacquer frame, a grille over paper glowing warm
export function windowTex() {
  return ['zxWindow', 256, (u, v, o) => {
    const inX = u > 0.12 && u < 0.88, inY = v > 0.18 && v < 0.86, frame = !(inX && inY);
    if (frame) { const n = T.fbm(u, v, 8, 3, 711); o.c = T.mixc([0.36, 0.06, 0.04], [0.24, 0.04, 0.03], n); o.h = 0.7; o.r = 0.45; if (v < 0.08) { o.c = [0.72, 0.52, 0.2]; o.m = 1; o.r = 0.3; } return; }
    const gu = ((u - 0.12) / 0.76) * 6, gv = ((v - 0.18) / 0.68) * 8, bar = Math.min(Math.abs(gu - Math.round(gu)), Math.abs(gv - Math.round(gv)));
    const diag = Math.abs(((gu + gv) % 2 + 2) % 2 - 1);
    if (bar < 0.07 || diag < 0.05) { o.c = [0.3, 0.07, 0.04]; o.h = 0.7; o.r = 0.5; return; }
    const glow = 0.75 + 0.25 * T.fbm(u, v, 3, 2, 712); o.c = [0.98 * glow, 0.62 * glow, 0.3 * glow]; o.e = glow; o.h = 0.3; o.r = 0.9;
  }, 1];
}
