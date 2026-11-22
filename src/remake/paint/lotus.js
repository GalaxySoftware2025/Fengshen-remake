// lotus.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the walk's paving (the art's pale cream squares, two by two a cell): large worn limestone flags, each its own shade,
// bevelled and chipped at the edges, grime in the joints, a crack here and there; calm (DESIGN.md §2: large, flat, worn)
export function flagTex() {
  return ['lotusFlag3', 1024, (u, v, o) => {
    const fu = u * 4, fv = v * 4, iu = Math.floor(fu), iv = Math.floor(fv), x = fu - iu, y = fv - iv;
    const id = T.pnoise(iu, iv, 4, 201, 4), id2 = T.pnoise(iu + 0.5, iv + 0.5, 4, 202, 4);
    const chip = (T.fbm(u, v, 28, 3, 203) - 0.5) * 0.04, e = Math.min(x, 1 - x, y, 1 - y) + chip;
    const joint = T.smooth(0.03, 0.012, e), bevel = T.smooth(0.0, 0.09, e);
    const grain = T.pnoise(u * 300, v * 300, 300, 204), cloud = T.fbm(u, v, 5, 4, 205), wear = T.fbm(u, v, 14, 3, 206);
    const [w0, w1] = T.worley(u, v, 7, 207, 0.9), crack = id2 > 0.8 ? T.smooth(0.01, 0.0, w1 - w0) * T.smooth(0.04, 0.1, e) : 0;
    let c = T.mixc([0.52, 0.49, 0.4], [0.7, 0.66, 0.55], id * 0.6 + cloud * 0.4);
    c = T.mixc(c, [0.5, 0.45, 0.34], T.smooth(0.6, 0.8, grain) * 0.3);
    c = T.mixc(c, [0.46, 0.42, 0.32], T.smooth(0.16, 0.0, e) * 0.35 + T.smooth(0.58, 0.8, T.fbm(u, v, 3, 3, 208)) * 0.2);   // grime toward the joints, and in broad patches
    c = T.mixc(c, c.map(q => q * 0.8), 1 - bevel); c = T.mixc(c, [0.3, 0.26, 0.18], crack * 0.7); c = T.mixc(c, [0.26, 0.23, 0.17], joint * 0.8);
    o.c = c; o.h = 0.3 + bevel * 0.45 + (wear - 0.5) * 0.08 - crack * 0.25 - joint * 0.2; o.r = 0.8 - bevel * (1 - cloud) * 0.15 + joint * 0.12;
  }, 3];
}
// the pebble shore (the art's pale banks between the meadow and the ponds): fine grey shingle, a few flat stones, damp
export function shingleTex() {
  return ['lotusShingle', 512, (u, v, o) => {
    const n = T.fbm(u, v, 40, 3, 211), big = T.fbm(u, v, 4, 3, 212), [w0, w1, id] = T.worley(u, v, 9, 213, 0.9), flat = T.smooth(0.0, 0.08, w1 - w0) * T.smooth(0.7, 0.85, id);
    let c = T.mixc([0.42, 0.4, 0.34], [0.6, 0.58, 0.5], n * 0.6 + big * 0.4);
    c = T.mixc(c, [0.66, 0.64, 0.56], flat * 0.5);
    o.c = c; o.h = 0.4 + n * 0.2 + flat * 0.2; o.r = 0.85 - flat * 0.1;
  }, 2];
}
// the faces under the walks (the art's dark brown courses): long fired bricks, worn and bevelled, each its own shade,
// darker mortar; DAMP darkens them toward the waterline
export function brickTex() {
  return ['lotusBrick3', 1024, (u, v, o) => {
    const rows = 5, ry = Math.floor(v * rows), fy = v * rows - ry, bx = u * 2 + (ry % 2) * 0.5, ix = Math.floor(bx), fx = bx - ix;
    const id = T.pnoise(((ix % 2) + 2) % 2, ry, 2, 221, rows), chip = (T.fbm(u, v, 24, 3, 222) - 0.5) * 0.05;
    const e = Math.min(Math.min(fx, 1 - fx) * 2 / rows * 2.5, Math.min(fy, 1 - fy)) + chip, mortar = T.smooth(0.07, 0.035, e), bevel = T.smooth(0.03, 0.2, e);
    const n = T.fbm(u, v, 10, 4, 223), grain = T.pnoise(u * 200, v * 200, 200, 224);
    let c = T.mixc([0.3, 0.22, 0.15], [0.48, 0.36, 0.25], id * 0.6 + n * 0.4);
    c = T.mixc(c, [0.22, 0.16, 0.1], T.smooth(0.62, 0.82, grain) * 0.3);
    c = T.mixc(c, c.map(q => q * 0.78), 1 - bevel); c = T.mixc(c, [0.16, 0.13, 0.1], mortar);
    o.c = c; o.h = 0.3 + bevel * 0.4 + n * 0.08 - mortar * 0.25; o.r = 0.85;
  }, 3];
}
// pale carved limestone (the balustrades' posts, caps and panels, the stair treads): fine grain, faint cloud
export function stoneTex() {
  return ['lotusStone', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 231), g = T.pnoise(u * 160, v * 160, 160, 232), p = T.smooth(0.6, 0.8, T.fbm(u, v, 3, 3, 233));
    let c = T.mixc([0.66, 0.63, 0.53], [0.8, 0.77, 0.66], n);
    c = T.mixc(c, [0.54, 0.5, 0.4], T.smooth(0.62, 0.82, g) * 0.3 + p * 0.25);
    o.c = c; o.h = 0.5 + n * 0.1 + g * 0.04; o.r = 0.72;
  }, 1];
}
// a balustrade panel's face (BoxGeometry's own 0..1 on each face): a recessed field in a raised frame, a carved rosette
export function panelTex() {
  return ['lotusPanel3', 512, (u, v, o) => {
    const ex = Math.min(u, 1 - u) * 2.2, ey = Math.min(v, 1 - v), e = Math.min(ex, ey), frame = T.smooth(0.16, 0.12, e), lip = T.smooth(0.1, 0.13, e) * T.smooth(0.17, 0.14, e);
    const dx = (u - 0.5) * 2.2, dy = v - 0.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const petal = T.smooth(0.3, 0.26, r / (0.75 + 0.25 * Math.cos(a * 8))) * T.smooth(0.0, 0.04, r), eye = T.smooth(0.07, 0.05, r);
    const n = T.fbm(u, v, 6, 4, 241), g = T.pnoise(u * 120, v * 120, 120, 242);
    let c = T.mixc([0.66, 0.63, 0.53], [0.8, 0.77, 0.66], n);
    c = T.mixc(c, [0.54, 0.5, 0.4], T.smooth(0.62, 0.82, g) * 0.3);
    const field = 1 - frame, relief = Math.max(petal * 0.8, eye);
    c = c.map(q => q * (1 - field * 0.18 + relief * 0.14 - lip * 0.25));
    o.c = c; o.h = 0.5 + frame * 0.3 + relief * 0.18 * field + n * 0.04; o.r = 0.72;
  }, 4];
}
// the carved drums' stone (the art's brown-and-pale barrel columns): warm sandstone, grain, weathered darker below
export function drumTex() {
  return ['lotusDrum2', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 251), g = T.pnoise(u * 180, v * 180, 180, 252), streak = T.fbmA(u, v, 30, 3, 3, 253);
    let c = T.mixc([0.42, 0.33, 0.22], [0.62, 0.5, 0.35], n * 0.6 + streak * 0.4);
    c = T.mixc(c, [0.3, 0.23, 0.15], T.smooth(0.62, 0.82, g) * 0.35 + T.smooth(0.3, 0.0, v) * 0.35);
    o.c = c; o.h = 0.5 + n * 0.1 + streak * 0.08; o.r = 0.78;
  }, 1.5];
}
// a lily pad's leaf: round with its notch, veins from the stem out, a paler waxy rim (alpha outside the leaf)
export function padTex() {
  return ['lotusPad', 256, (u, v, o) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx), notch = Math.abs(a) < 0.12 + (1 - r) * 0.05 && r > 0.04;
    const vein = T.smooth(0.12, 0.0, Math.abs(Math.sin(a * 11)) * r * 6) * T.smooth(0.05, 0.2, r), n = T.fbm(u, v, 8, 3, 261);
    let c = T.mixc([0.17, 0.3, 0.08], [0.3, 0.46, 0.13], n * 0.6 + r * 0.3);
    c = T.mixc(c, [0.42, 0.55, 0.2], vein * 0.35 + T.smooth(0.86, 0.96, r) * 0.3);
    o.c = c; o.a = r < 0.97 && !notch ? 1 : 0; o.h = 0.5 - vein * 0.15; o.r = 0.4;
  }, 1];
}
