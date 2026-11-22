// lair.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// ---------------------------------------------------------------- surfaces
// the walks' flags: pale khaki limestone a cell each, worn at the arrises, the original's diamond lattice and its star
// inlaid in tarnished bronze (thin: the slab carries the floor), a crack here and there; 2 x 2 slabs a texture
export function slabTex() {
  return ['lrSlab3', 1024, (u, v, o) => {
    const N = 2, cu = u * N, cv = v * N, ci = Math.floor(cu), cj = Math.floor(cv), fu = cu - ci, fv = cv - cj, id = R(ci * 7 + cj * 13 + 1);
    const e = Math.min(fu, 1 - fu, fv, 1 - fv), joint = 1 - T.smooth(0.004, 0.012, e + (T.fbm(u, v, 30, 2, 1201) - 0.5) * 0.008), bevel = T.smooth(0.0, 0.045, e);
    const d1 = Math.abs(((fu + fv) * 2) % 1 - 0.5), d2 = Math.abs(((fu - fv + 4) * 2) % 1 - 0.5), du = fu - 0.5, dv = fv - 0.5, r = Math.hypot(du, dv), a = Math.atan2(dv, du);
    const rs = 0.075 + 0.075 * Math.pow(Math.abs(Math.cos(a * 4)), 3), inner = r < rs - 0.03;
    const lat = T.smooth(0.02, 0.008, Math.min(d1, d2)) * T.smooth(0.0, 0.03, r - rs - 0.01) * T.smooth(0.02, 0.06, e);   // (the lattice stops short of the star and of the joints)
    const star = T.smooth(0.009, 0.003, Math.abs(r - rs)) + T.smooth(0.026, 0.02, r), inlay = Math.min(1, lat + star);
    const n = T.fbm(u, v, 6, 4, 1202), grain = T.fbm(u, v, 70, 2, 1203), stain = T.smooth(0.55, 0.8, T.fbm(u, v, 3, 3, 1204 + ci));
    const chip = T.smooth(0.72, 0.84, T.fbm(u, v, 34, 3, 1205)) * (1 - T.smooth(0.0, 0.06, e));
    const cr = id < 0.45 ? (1 - T.smooth(0.0, 0.01 + 0.006 * grain, Math.abs(T.fbmA(u + id, v, 5, 5, 4, 1206 + ci) - 0.5))) * T.smooth(0.4, 0.62, T.fbm(u, v, 4, 2, 1207 + cj)) : 0;
    let c = T.mixc([0.66, 0.55, 0.37], [0.8, 0.69, 0.5], n * 0.55 + id * 0.45);
    c = c.map(q => q * (0.95 + (grain - 0.5) * 0.12)); c = T.mixc(c, [0.52, 0.42, 0.28], stain * 0.4);
    if (inner) c = T.mixc(c, [0.6, 0.48, 0.3], 0.35);
    c = T.mixc(c, [0.34, 0.28, 0.2], chip * 0.5); c = T.mixc(c, [0.22, 0.18, 0.12], cr * 0.75);
    const bz = T.mixc([0.62, 0.44, 0.2], [0.3, 0.4, 0.3], T.smooth(0.5, 0.8, T.fbm(u, v, 20, 2, 1208)) * 0.7);   // gilt bronze, green where it has turned
    c = T.mixc(c, bz, inlay * 0.85); c = T.mixc(c, [0.24, 0.19, 0.13], joint * 0.75);
    o.c = c; o.m = inlay * 0.85; o.r = 0.78 - inlay * 0.42 + stain * 0.05;
    o.h = 0.5 + bevel * 0.07 - joint * 0.3 - chip * 0.08 - cr * 0.2 + (n - 0.5) * 0.04 + inlay * 0.02;
  }, 3];
}
// the faces: dressed stone in courses a quarter high, blocks of uneven length, weathered grey-khaki, dark joints; 2 x 2
// units a texture
export function ashlarTex() {
  return ['lrAshlar2', 1024, (u, v, o) => {
    const rows = 8, row = Math.floor(v * rows), fv = v * rows - row;
    const cuts = []; let x = R(row * 3.7 + 0.2) * 0.3; while (x < 1 + 0.3) { cuts.push(x); x += 0.16 + R(row * 9.1 + x * 5.3) * 0.17; }
    let k = 0; for (let i = 0; i < cuts.length; i++) if (((u - cuts[0]) % 1 + 1) % 1 + cuts[0] >= cuts[i]) k = i;
    const uu = ((u - cuts[0]) % 1 + 1) % 1 + cuts[0], a0 = cuts[k], a1 = cuts[k + 1] ?? cuts[0] + 1, id = R(row * 31 + k * 7.7);
    const eu = Math.min(uu - a0, a1 - uu) * 4, e = Math.min(eu, fv, 1 - fv), joint = 1 - T.smooth(0.03, 0.08, e + (T.fbm(u, v, 40, 2, 1301) - 0.5) * 0.04);
    const bevel = T.smooth(0.0, 0.25, e), n = T.fbm(u, v, 8, 4, 1302), pit = T.smooth(0.74, 0.86, T.fbm(u, v, 50, 2, 1303)), streak = T.fbmA(u, v, 40, 3, 3, 1304);
    let c = T.mixc([0.34, 0.31, 0.26], [0.5, 0.45, 0.37], n * 0.5 + id * 0.5);
    c = T.mixc(c, [0.26, 0.24, 0.21], T.smooth(0.55, 0.85, streak) * 0.45); c = c.map(q => q - pit * 0.05);
    c = T.mixc(c, [0.1, 0.09, 0.08], joint * 0.8);
    o.c = c; o.r = 0.86; o.h = 0.5 + bevel * 0.18 + (n - 0.5) * 0.1 - joint * 0.4 - pit * 0.06;
  }, 3];
}
// 雷紋 in bronze for the wall's frieze: two square spirals a texture across, raised, green in the hollows
export function leiwenTex() {
  return ['lrLeiwen', 512, (u, v, o) => {
    const k = Math.floor(u * 2), cu = (u * 2 - k), cv = v, fx = k % 2 ? 1 - cu : cu;
    const px = fx - 0.5, py = cv - 0.5, d = Math.max(Math.abs(px), Math.abs(py)), ring = Math.floor((d + 0.02) / 0.11), f = ((d + 0.02) / 0.11) % 1;
    const side = Math.abs(px) > Math.abs(py) ? (px > 0 ? 0 : 2) : (py > 0 ? 1 : 3), gap = side === ring % 4 && Math.abs(Math.abs(px) > Math.abs(py) ? py : px) < 0.06 + ring * 0.02;
    const line = d < 0.47 && f > 0.25 && f < 0.75 && !gap ? 1 : 0, rim = Math.abs(cv - 0.5) > 0.47 ? 1 : 0;
    const n = T.fbm(u, v, 12, 3, 1401), lit = Math.max(line, rim);
    o.c = lit ? T.mixc([0.5, 0.36, 0.18], [0.66, 0.5, 0.28], n) : T.mixc([0.12, 0.22, 0.17], [0.2, 0.3, 0.22], n);
    o.m = lit ? 0.85 : 0.3; o.r = lit ? 0.4 : 0.75; o.h = 0.3 + lit * 0.5 + (n - 0.5) * 0.05;
  }, 4];
}
