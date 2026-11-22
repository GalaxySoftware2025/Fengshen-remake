// jiulong.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';
const frac = v => v - Math.floor(v), rnd = (a, b, k) => frac(Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453);
// the faces' olive ashlar: long blocks in courses, bevelled, chipped at the arrises, stained
export function ashlarTex() {
  return ['jiulongAshlar', 512, (u, v, o) => {
    const rows = 4, row = Math.floor(v * rows), fv = v * rows - row, cols = 2, cu = u * cols + (row % 2) * 0.5, col = Math.floor(cu), fu = cu - col;
    const e = Math.min(fu * 2, (1 - fu) * 2, fv, 1 - fv), n = T.fbm(u, v, 14, 4, 61), fine = T.fbm(u, v, 80, 2, 62);
    const base = T.mixc([0.4, 0.35, 0.2], [0.5, 0.44, 0.27], rnd(col % cols, row, 3)), bevel = T.smooth(0, 0.1, e), joint = 1 - T.smooth(0.01, 0.05, e);
    const chip = T.smooth(0.7, 0.85, T.fbm(u, v, 40, 3, 63)) * (1 - bevel);
    o.h = 0.5 + 0.14 * bevel + (n - 0.5) * 0.12 + (fine - 0.5) * 0.04 - joint * 0.3 - chip * 0.1;
    const streak = T.smooth(0.5, 0.9, T.fbm(u * 6, v * 0.6, 6, 3, 64)) * 0.25;
    o.c = T.mixc(T.mixc(base, [base[0] * 0.8, base[1] * 0.78, base[2] * 0.7], n * 0.8 + streak), [0.2, 0.18, 0.12], T.clamp(joint * 0.75 + chip * 0.2));
    o.r = 0.9;
  }, 4];
}
// the islets' sand: pale and fine, ribbed by the wind in soft ripples that wander, darker grains and bits of shell in it
export function sandTex() {
  return ['jiulongSand3', 512, (u, v, o) => {
    const w = T.fbm(u, v, 3, 3, 91), rip = Math.sin((u * 0.6 + v + w * 0.5) * Math.PI * 2 * 14 + T.fbm(u, v, 9, 2, 92) * 4);
    const g = T.fbm(u, v, 120, 2, 93), dark = T.smooth(0.72, 0.8, g), shell = T.smooth(0.9, 0.95, T.fbm(u, v, 70, 2, 94));
    o.h = 0.5 + rip * 0.06 + (g - 0.5) * 0.05;
    const lit = rip * 0.5 + 0.5, crest = Math.pow(lit, 3);   // (the land shader reads colour only: the ripples' light and shade painted in)
    o.c = T.mixc(T.mixc([0.84, 0.77, 0.57], [0.66, 0.59, 0.42], w * 0.7 + (1 - lit) * 0.45), [0.48, 0.43, 0.31], dark * 0.55);
    o.c = T.mixc(o.c, [0.92, 0.87, 0.7], crest * 0.25);
    if (shell) o.c = T.mixc(o.c, [0.95, 0.92, 0.85], shell);
    o.r = 0.95;
  }, 3];
}
// the ramparts' tops: large old flags of the faces' olive stone, cracked, grass and dirt in every joint (no one walks
// there: rougher and darker than the terraces' paving)
export function capTex() {
  return ['jiulongCap', 512, (u, v, o) => {
    const N = 4, row = Math.floor(v * N), cu = u * N + (row % 2) * 0.37, col = Math.floor(cu), fu = cu - col, fv = v * N - row;
    const e = Math.min(fu, 1 - fu, fv, 1 - fv), n = T.fbm(u, v, 16, 4, 81), crack = 1 - T.smooth(0, 0.012, Math.abs(T.fbm(u, v, 9, 3, 82) - 0.5));
    const base = T.mixc([0.3, 0.27, 0.15], [0.38, 0.34, 0.2], rnd(col % N, row, 4)), joint = 1 - T.smooth(0.01, 0.06, e), green = T.smooth(0.3, 0.9, joint + n * 0.3);
    o.h = 0.5 + 0.1 * T.smooth(0, 0.1, e) + (n - 0.5) * 0.14 - joint * 0.3 - crack * 0.1;
    o.c = T.mixc(T.mixc(base, [base[0] * 0.78, base[1] * 0.76, base[2] * 0.68], n), [0.2, 0.27, 0.1], green * 0.7);
    o.r = 0.92;
  }, 4];
}
// the guardians' and the stele's carving: a grey stone with a stern face in relief over a band of cloud scrolls
export function guardTex() {
  return ['jiulongGuard', 512, (u, v, o) => {
    const n = T.fbm(u, v, 9, 4, 41), x = Math.abs(u - 0.5);
    let h = 0.45 + (n - 0.5) * 0.15;
    if (v < 0.06 || v > 0.94) h += 0.25;
    if (v > 0.12 && v < 0.55) { const y = (v - 0.12) / 0.43;
      if (Math.hypot((x - 0.17) / 0.1, (y - 0.32) / 0.08) < 1) h += 0.28;
      if (Math.hypot((x - 0.17) / 0.045, (y - 0.32) / 0.045) < 1) h -= 0.25;
      if (x < 0.05 && y > 0.3 && y < 0.68) h += 0.22;
      if (Math.abs(y - 0.8) < 0.05 && x < 0.2) h -= 0.2;
      if (y < 0.14 && x < 0.34) h += 0.18; }
    if (v > 0.62 && v < 0.9) { const dx = (u * 3) % 1 - 0.5, dy = v - 0.76, r = Math.hypot(dx, dy * 3); if (r < 0.4) h += 0.18 * (Math.sin(r * 40) > 0 ? 1 : 0); }
    const g = 0.62 + (n - 0.5) * 0.18 + T.clamp((h - 0.45) * 0.8) * 0.2;
    o.c = [g * 0.98, g * 0.98, g * 0.9]; o.r = 0.85; o.h = h;
  }, 4];
}
