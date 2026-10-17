// Procedural PBR textures for the remade sets: nothing here comes from the ROM. Each recipe paints a tileable square
// (colour, relief, roughness) pixel by pixel from seeded noise and cell patterns; relief becomes a normal map. Results
// are cached by name, so the materials of a set rebuild instantly on the next visit.
import * as THREE from 'three';

// ---------------------------------------------------------------- tileable noise
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const fade = t => t * t * (3 - 2 * t);
// value noise with period p (in lattice cells): tiles when the texture spans a whole number of periods
export function pnoise(x, y, p, s = 0, py = p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
  const m = (q, P) => ((q % P) + P) % P, x0 = m(xi, p), x1 = m(xi + 1, p), y0 = m(yi, py), y1 = m(yi + 1, py);
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fbm over u, v in [0, 1): base frequency f lattice cells across, o octaves
export function fbm(u, v, f, o = 4, s = 0) {
  let sum = 0, amp = 0.5, n = 0;
  for (let i = 0; i < o; i++) { sum += pnoise(u * f, v * f, f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
  return sum / n;
}
// fbm stretched: fu lattice cells across, fv down (streaks, grain), still tileable
export function fbmA(u, v, fu, fv, o = 4, s = 0) {
  let sum = 0, amp = 0.5, n = 0;
  for (let i = 0; i < o; i++) { sum += pnoise(u * fu, v * fv, fu, s + i * 17, fv) * amp; n += amp; amp *= 0.5; fu *= 2; fv *= 2; }
  return sum / n;
}
// tileable Worley: distance to the nearest and second-nearest jittered point, and the nearest cell's id (0..1)
export function worley(u, v, f, s = 0, jit = 0.85) {
  const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, mx = ((cx % f) + f) % f, my = ((cy % f) + f) % f;
    const px = cx + 0.5 + (hash2(mx, my, s) - 0.5) * jit, py = cy + 0.5 + (hash2(mx, my, s + 9) - 0.5) * jit;
    const d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; id = hash2(mx, my, s + 31); } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
export const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ---------------------------------------------------------------- painting
const CACHE = new Map();
function dataTex(data, n, srgb) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
// paint(u, v, o): set o.c = [r, g, b] (0..1, sRGB), o.h (relief 0..1), o.r (roughness 0..1), o.a (alpha, optional),
// o.m (metalness, optional), o.e (emission 0..1, optional). bump: relief strength for the normal map.
export function pbr(name, n, paint, bump = 2) {
  if (CACHE.has(name)) return CACHE.get(name);
  const col = new Uint8Array(n * n * 4), hgt = new Float32Array(n * n), arm = new Uint8Array(n * n * 4);
  const o = {}; let alpha = false, metal = false, emis = false;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    o.c = null; o.h = 0.5; o.r = 0.8; o.a = 1; o.m = 0; o.e = 0;
    paint((x + 0.5) / n, (y + 0.5) / n, o);
    const i = y * n + x, c = o.c || [1, 0, 1];
    col[i * 4] = clamp(c[0]) * 255; col[i * 4 + 1] = clamp(c[1]) * 255; col[i * 4 + 2] = clamp(c[2]) * 255; col[i * 4 + 3] = clamp(o.a) * 255;
    if (o.a < 1) alpha = true; if (o.m) metal = true; if (o.e) emis = true;
    hgt[i] = o.h; arm[i * 4] = clamp(o.e) * 255; arm[i * 4 + 1] = clamp(o.r) * 255; arm[i * 4 + 2] = clamp(o.m) * 255; arm[i * 4 + 3] = 255;
  }
  const nor = new Uint8Array(n * n * 4), H = (x, y) => hgt[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * bump, dy = (H(x, y + 1) - H(x, y - 1)) * bump, l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    nor[i] = (-dx / l * 0.5 + 0.5) * 255; nor[i + 1] = (dy / l * 0.5 + 0.5) * 255; nor[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  // roughness in G, metalness in B (three's convention for roughnessMap / metalnessMap); emission in R
  const out = { map: dataTex(col, n, true), normalMap: dataTex(nor, n, false), arm: dataTex(arm, n, false), alpha, metal, emis };
  CACHE.set(name, out); return out;
}
// a MeshStandard / MeshPhysical material from a recipe; o: extra material options, rep: texture repeat [u, v]
export function material(t, o = {}, rep) {
  const phys = o.clearcoat || o.sheen;
  const opts = Object.assign({ map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, roughness: 1, metalness: t.metal ? 1 : 0 }, o);
  if (t.metal) opts.metalnessMap = t.arm;
  if (t.alpha && opts.alphaTest == null && !opts.transparent) opts.alphaTest = 0.5;
  if (t.emis && !o.emissiveMap) { opts.emissiveMap = emisMap(t); opts.emissive = opts.emissive ?? new THREE.Color(1, 0.85, 0.6); }
  delete opts.rep;
  const m = phys ? new THREE.MeshPhysicalMaterial(opts) : new THREE.MeshStandardMaterial(opts);
  if (rep) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(rep[0], rep[1]); m[k].needsUpdate = true; }
  if (o.normalScale != null) m.normalScale.setScalar(o.normalScale);
  return m;
}
function emisMap(t) {   // the emission channel (R of arm) as its own map
  if (t._em) return t._em;
  const src = t.arm.image.data, n = t.arm.image.width, d = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = src[i * 4]; d[i * 4 + 3] = 255; }
  return (t._em = dataTex(d, n, false));
}

// ---------------------------------------------------------------- recipes
// palace floor: polished pale-jade slabs, `per` slabs across the texture, a carved eight-petal medallion in each,
// a faint diamond lattice inlay between (the original's star-and-lattice floor, as stone)
export function palaceFloor(per = 2, base = 0xd6cf9e, giltGrout = false) {
  return pbr('palaceFloor' + per + base + giltGrout, 1024, (u, v, o) => {
    const x = u * per, y = v * per, fx = x - Math.floor(x), fy = y - Math.floor(y), id = hash2(Math.floor(x), Math.floor(y), 3);
    const B = hex(base), m = fbm(u, v, 6, 5, 1), vein = Math.abs(fbm(u, v, 3, 5, 7) - 0.5);
    let c = mixc(B, [B[0] * 0.86, B[1] * 0.9, B[2] * 0.78], m * 0.9 + id * 0.25);
    c = mixc(c, [B[0] * 1.06, B[1] * 1.06, B[2] * 1.02], smooth(0.04, 0.0, vein) * 0.6);
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy), grout = smooth(0.012, 0.004, edge);
    // medallion: eight petals around a boss, carved shallow
    const dx = fx - 0.5, dy = fy - 0.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const petal = r < 0.17 ? smooth(0.008, 0.0, Math.abs(r - (0.1 + 0.055 * Math.abs(Math.cos(a * 4)))) - 0.004) : 0;
    const ring = smooth(0.006, 0.0, Math.abs(r - 0.205) - 0.004), boss = smooth(0.035, 0.025, r);
    // the lattice inlay: diagonals from corner to corner, stopping short of the medallion
    const dg = Math.min(Math.abs(fx - fy), Math.abs(fx + fy - 1)), lat = smooth(0.006, 0.0, dg - 0.003) * smooth(0.24, 0.28, r);
    const carve = Math.max(petal, ring, lat * 0.8);
    const ink = [B[0] * 0.55, B[1] * 0.56, B[2] * 0.36];
    c = mixc(c, ink, carve * 0.75); c = mixc(c, [B[0] * 0.8, B[1] * 0.72, B[2] * 0.4], boss * 0.8);
    c = mixc(c, giltGrout ? [0.78, 0.58, 0.22] : [0.18, 0.16, 0.1], grout);
    o.c = c; o.h = 0.6 - grout * 0.5 - carve * 0.18 + m * 0.04; o.r = 0.2 + m * 0.15 + grout * (giltGrout ? 0.05 : 0.5) + carve * 0.2; if (giltGrout) o.m = grout;
  }, 3);
}
// 紂王's court floor, after the original's (map 00241c: #d8d890 ground, #b4b46c lattice, #6c6c24 stars): polished
// pale khaki-celadon slabs, one a cell; a double olive line from edge midpoint to edge midpoint, so the lines run as a
// diamond net across the floor; a dark eight-point star inlaid in the diamond on each slab, a dot where four meet
export function latticeFloor(per = 2) {
  return pbr('latticeFloor' + per, 1024, (u, v, o) => {
    const x = u * per, y = v * per, fx = x - Math.floor(x), fy = y - Math.floor(y), id = hash2(Math.floor(x), Math.floor(y), 9);
    const B = [0.78, 0.8, 0.52], L = [0.52, 0.55, 0.27], D = [0.3, 0.32, 0.1];
    const m = fbm(u, v, 5, 5, 3), cloud = Math.abs(fbm(u, v, 2.5, 5, 11) - 0.5);
    let c = mixc([B[0] * 0.93, B[1] * 0.94, B[2] * 0.86], B, m * 0.8 + id * 0.3);
    c = mixc(c, [B[0] * 1.04, B[1] * 1.05, B[2] * 1.0], smooth(0.05, 0.0, cloud) * 0.5);   // faint veins in the stone
    const dx = fx - 0.5, dy = fy - 0.5, dm = Math.abs(dx) + Math.abs(dy);
    const line = Math.max(smooth(0.011, 0.004, Math.abs(dm - 0.46)), smooth(0.011, 0.004, Math.abs(dm - 0.54)));
    const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), star = smooth(0.012, 0.0, r - (0.05 + 0.075 * Math.pow(Math.abs(Math.cos(a * 4)), 6)));
    const cr = Math.hypot(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy)), dot = smooth(0.03, 0.02, cr);
    const grout = smooth(0.01, 0.003, Math.min(fx, fy, 1 - fx, 1 - fy));
    c = mixc(c, L, line * 0.85); c = mixc(c, D, Math.max(star, dot) * 0.9); c = mixc(c, [0.3, 0.29, 0.18], grout * 0.8);
    o.c = c; o.h = 0.6 - line * 0.12 - grout * 0.4 + m * 0.03; o.r = 0.22 + m * 0.12 + line * 0.15 + grout * 0.4 - Math.max(star, dot) * 0.08;
  }, 3);
}
// 費仲's carpet, after the original's (map 0eb2e6: #480048 ground, #6c4890 pattern, #906c90 / #b490d8 glints): a deep
// plum wool pile, one motif a cell: a lilac lozenge of two fine lines round a small diamond, a thin lilac grid on the
// cell lines with a four-point glint where they cross
export function mansionCarpet(per = 2) {
  return pbr('mansionCarpet' + per, 1024, (u, v, o) => {
    const x = u * per, y = v * per, fx = x - Math.floor(x), fy = y - Math.floor(y);
    const pile = fbm(u, v, 96, 2, 51), n = fbm(u, v, 5, 4, 52);
    const G = [0.29, 0.02, 0.29], L = [0.45, 0.3, 0.6], H = [0.6, 0.45, 0.62], S = [0.72, 0.58, 0.88];
    let c = mixc([G[0] * 0.8, G[1], G[2] * 0.8], G, pile * 0.6 + n * 0.5);
    const dx = fx - 0.5, dy = fy - 0.5, dm = Math.abs(dx) + Math.abs(dy);
    const loz = Math.max(smooth(0.016, 0.006, Math.abs(dm - 0.3)), smooth(0.016, 0.006, Math.abs(dm - 0.38)));
    const core = smooth(0.012, 0.0, dm - 0.09) - smooth(0.012, 0.0, dm - 0.05) * 0.6;
    const ex = Math.min(fx, 1 - fx), ey = Math.min(fy, 1 - fy), grid = smooth(0.008, 0.002, Math.min(ex, ey));
    const cr = Math.hypot(ex, ey), glint = smooth(0.05, 0.0, Math.min(ex, ey) * 6 + cr) ;
    c = mixc(c, L, Math.max(loz, grid * 0.75) * 0.9); c = mixc(c, H, core * 0.85); c = mixc(c, S, glint * 0.9);
    o.c = c; o.h = 0.5 + pile * 0.12 + Math.max(loz, core) * 0.06; o.r = 0.92 - glint * 0.2;
  }, 2);
}
// auspicious-cloud (祥雲) scrolls in gilt relief on a red lacquer ground (金漆浮雕), `per` motifs across: each a pair
// of spiral curls joined by a sweeping band
// pal: the ground and the carving, each from dark to light ({ ground: [lo, hi], line: [lo, hi], name }); default red and gold
export function cloudRelief(per = 2, pal = null) {
  const P = pal || { ground: [[0.42, 0.06, 0.04], [0.55, 0.1, 0.06]], line: [[0.7, 0.48, 0.16], [0.95, 0.75, 0.32]], name: '' };
  return pbr('cloudRelief' + per + P.name, 1024, (u, v, o) => {
    const x = u * per, y = v * per, fx = x - Math.floor(x), fy = y - Math.floor(y), row = Math.floor(y) % 2;
    const n = fbm(u, v, 24, 3, 301);
    let ln = 0;
    for (const [cx, cy, s] of [[0.3 + row * 0.4, 0.35, 1], [0.7 - row * 0.4, 0.68, -1], [0.3 + row * 0.4 + 1, 0.35, 1], [0.7 - row * 0.4 - 1, 0.68, -1]]) {
      const dx = (fx - cx) * s, dy = fy - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (r < 0.2) { const k = (r / 0.2) * 3 - (a / (Math.PI * 2) + 0.5); ln = Math.max(ln, smooth(0.16, 0.05, Math.abs(k - Math.round(k)) ) * smooth(0.2, 0.17, r)); }
    }
    const band = smooth(0.035, 0.012, Math.abs(fy - (0.5 + 0.17 * Math.sin((fx + row * 0.5) * Math.PI * 2))));   // the sweep joining the curls
    const rel = Math.max(ln, band * 0.9);
    const c = mixc(mixc(P.ground[0], P.ground[1], n), mixc(P.line[0], P.line[1], n), rel);
    o.c = c; o.h = 0.35 + rel * 0.55 + n * 0.03; o.m = pal ? 0 : rel; o.r = 0.35 + (1 - rel) * 0.25;
  }, 5);
}
// lacquered wood: deep red, a faint long grain and wear toward lighter red
export function lacquer(base = 0x8a1a12, name = 'lacquer') {
  return pbr(name + base, 512, (u, v, o) => {
    const B = hex(base), g = fbmA(u, v, 16, 2, 4, 4), w = fbm(u, v, 5, 5, 8);
    o.c = mixc([B[0] * 0.8, B[1] * 0.7, B[2] * 0.7], [B[0] * 1.15, B[1] * 1.1, B[2] * 1.05], g * 0.7 + w * 0.3);
    o.h = 0.5 + (g - 0.5) * 0.15; o.r = 0.22 + w * 0.2;
  }, 1);
}
// gold leaf / gilt bronze
export function gold(base = 0xd9a441) {
  return pbr('gold' + base, 256, (u, v, o) => {
    const B = hex(base), n = fbm(u, v, 6, 5, 11), s = fbm(u, v, 24, 2, 12);
    o.c = mixc([B[0] * 0.78, B[1] * 0.7, B[2] * 0.55], [B[0] * 1.08, B[1] * 1.05, B[2] * 0.95], n);
    o.m = 1; o.r = 0.22 + n * 0.25 + s * 0.08; o.h = 0.5 + (s - 0.5) * 0.2;
  }, 1);
}
// bronze with green verdigris in the hollows and rubbed bright on the high points
export function bronze() {
  return pbr('bronze', 512, (u, v, o) => {
    const n = fbm(u, v, 5, 5, 21), p = smooth(0.42, 0.62, fbm(u, v, 9, 4, 22));
    const metal = mixc([0.42, 0.28, 0.14], [0.66, 0.48, 0.26], n), pat = mixc([0.16, 0.4, 0.3], [0.32, 0.6, 0.44], fbm(u, v, 16, 3, 23));
    o.c = mixc(metal, pat, p); o.m = 1 - p * 0.9; o.r = mix(0.35, 0.8, p); o.h = 0.5 + p * 0.25 + (n - 0.5) * 0.1;
  }, 2);
}
// silk: warm gold-orange with woven sheen and a faint cloud damask
export function silk(base = 0xe8a12e) {
  return pbr('silk' + base, 512, (u, v, o) => {
    const B = hex(base), weave = 0.5 + 0.5 * Math.sin(u * 512 * Math.PI) * Math.sin(v * 512 * Math.PI);
    const dx = (u * 4) % 1 - 0.5, dy = (v * 4) % 1 - 0.5, cloud = smooth(0.02, 0.0, Math.abs(Math.hypot(dx, dy * 1.4) - 0.28 - 0.05 * Math.sin(Math.atan2(dy, dx) * 3)) - 0.012);
    const n = fbm(u, v, 4, 4, 31);
    o.c = mixc([B[0] * 0.85, B[1] * 0.72, B[2] * 0.6], [B[0] * 1.1, B[1] * 1.08, B[2] * 1.1], n * 0.6 + cloud * 0.4);
    o.h = 0.5 + weave * 0.05 + cloud * 0.08; o.r = 0.42 - cloud * 0.12;
  }, 1);
}
// a carpet runner: crimson pile, a gold border with a fret band; u runs across (0..1 = the runner's width)
export function carpet(base = 0xa0141a) {
  return pbr('carpet' + base, 512, (u, v, o) => {
    const B = hex(base), pile = fbm(u, v, 64, 2, 41), n = fbm(u, v, 6, 4, 42), e = Math.min(u, 1 - u);
    let c = mixc([B[0] * 0.78, B[1] * 0.7, B[2] * 0.7], B, pile * 0.5 + n * 0.5), h = 0.5 + pile * 0.1, r = 0.9;
    // gold border: two fillets and a key-fret band between them
    if (e < 0.11) {
      const f1 = e < 0.016 || (e > 0.09 && e < 0.105), band = e > 0.03 && e < 0.08;
      const fu = ((e - 0.03) / 0.05), fv = (v * 16) % 1, fret = band && ((fu < 0.2 || fu > 0.8) ? fv > 0.15 : (fv < 0.2 || (fv > 0.45 && fv < 0.65 && fu > 0.35)));
      if (f1 || fret) { c = mixc([0.72, 0.52, 0.18], [0.95, 0.76, 0.32], n); h = 0.62; r = 0.5; }
      else if (band) c = mixc(c, [0.25, 0.04, 0.05], 0.5);
    }
    o.c = c; o.h = h; o.r = r;
  }, 2);
}
// a lattice window: a 回-fret grille in gilded red, with see-through gaps (alpha); `n` units across
export function lattice(units = 4) {
  return pbr('lattice' + units, 512, (u, v, o) => {
    const x = (u * units) % 1, y = (v * units) % 1, bar = 0.07;
    const inBar = (q) => q < bar || q > 1 - bar;
    const ring = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)), sq = Math.abs(ring - 0.22) < bar * 0.6 || Math.abs(ring - 0.38) < bar * 0.45;
    const cross = (Math.abs(x - 0.5) < bar * 0.5 && ring > 0.22) || (Math.abs(y - 0.5) < bar * 0.5 && ring > 0.22);
    const solid = inBar(x) || inBar(y) || sq || cross;
    const n = fbm(u, v, 8, 3, 51);
    o.c = solid ? mixc([0.55, 0.12, 0.08], [0.85, 0.6, 0.25], smooth(0.3, 0.7, n) * 0.6 + (sq ? 0.4 : 0)) : [0, 0, 0];
    o.a = solid ? 1 : 0; o.h = solid ? 0.7 : 0.2; o.r = 0.35; o.m = sq ? 0.6 : 0;
  }, 3);
}
// rice paper lit from behind (emissive), faint fibres
export function paper(base = 0xf6e6c4) {
  return pbr('paper' + base, 256, (u, v, o) => {
    const B = hex(base), f = fbm(u, v, 12, 4, 61);
    o.c = mixc([B[0] * 0.9, B[1] * 0.86, B[2] * 0.78], B, f); o.e = 0.65 + f * 0.35; o.r = 0.9;
  }, 0.5);
}
// cut stone blocks in running bond (parapets, retaining walls, wells)
export function bricks(base = 0x9a9476, rows = 4, name = 'bricks') {
  return pbr(name + base + rows, 512, (u, v, o) => {
    const B = hex(base), y = v * rows, ry = Math.floor(y), x = u * 2 + (ry % 2) * 0.5, rx = Math.floor(x), fx = x - rx, fy = y - ry;
    const id = hash2(((rx % 2) + 2) % 2, ry, 71), n = fbm(u, v, 8, 5, 72), e = Math.min(fx * 2 / rows * 2, (1 - fx) * 2 / rows * 2, fy, 1 - fy);
    const mortar = smooth(0.07, 0.03, e), chip = smooth(0.62, 0.7, fbm(u, v, 20, 3, 73));
    let c = mixc([B[0] * 0.8, B[1] * 0.8, B[2] * 0.75], [B[0] * 1.1, B[1] * 1.08, B[2] * 1.02], n * 0.7 + id * 0.3);
    c = mixc(c, [B[0] * 0.5, B[1] * 0.5, B[2] * 0.45], mortar * 0.85 + chip * 0.2);
    o.c = c; o.h = 0.6 - mortar * 0.4 - chip * 0.1 + n * 0.05; o.r = 0.75 + mortar * 0.2;
  }, 3);
}
// smooth jade-green stone (column plinths)
export function jade(base = 0x2f7a52) {
  return pbr('jade' + base, 256, (u, v, o) => {
    const B = hex(base), n = fbm(u, v, 4, 5, 81), vein = smooth(0.03, 0.0, Math.abs(fbm(u, v, 3, 5, 82) - 0.5));
    o.c = mixc(mixc([B[0] * 0.6, B[1] * 0.6, B[2] * 0.6], [B[0] * 1.3, B[1] * 1.2, B[2] * 1.15], n), [0.8, 0.9, 0.82], vein * 0.4);
    o.r = 0.2 + n * 0.15; o.h = 0.5;
  }, 0.5);
}
// dark polished wood (frames, furniture), grain running along v
export function wood(base = 0x4a2a18, name = 'wood') {
  return pbr(name + base, 512, (u, v, o) => {
    const B = hex(base), w = fbmA(u, v, 24, 2, 3, 91), ring = 0.5 + 0.5 * Math.sin((u * 40 + w * 6) * Math.PI), n = fbm(u, v, 16, 3, 92);
    o.c = mixc([B[0] * 0.7, B[1] * 0.68, B[2] * 0.66], [B[0] * 1.25, B[1] * 1.2, B[2] * 1.12], ring * 0.6 + n * 0.4);
    o.h = 0.5 + (ring - 0.5) * 0.12; o.r = 0.45 + n * 0.25;
  }, 1);
}
// weathered planks (stairs, bridges, carts), `n` planks across
export function planks(base = 0x8a6a42, n = 4) {
  return pbr('planks' + base + n, 512, (u, v, o) => {
    const B = hex(base), p = u * n, i = Math.floor(p), f = p - i, id = hash2(i, 0, 101), sh = hash2(i, 1, 101);
    const w = fbmA(u, v + sh, n * 2, 6, 4, 102), grain = 0.5 + 0.5 * Math.sin((f * 6 + w * 5 + v) * Math.PI * 2);
    const gap = smooth(0.05, 0.015, Math.min(f, 1 - f)), knot = smooth(0.05, 0.0, Math.hypot(f - 0.5, ((v + sh) * 3) % 1 - 0.5) - 0.02);
    let c = mixc([B[0] * 0.7, B[1] * 0.68, B[2] * 0.64], [B[0] * 1.15, B[1] * 1.1, B[2] * 1.02], grain * 0.5 + id * 0.5);
    c = mixc(c, [B[0] * 0.35, B[1] * 0.3, B[2] * 0.25], Math.max(gap, knot * 0.7));
    o.c = c; o.h = 0.6 - gap * 0.5 + grain * 0.05; o.r = 0.8;
  }, 3);
}
// packed earth / dirt road: warm ochre, pebbles, cart ruts are left to geometry
export function dirt(base = 0xb07a44, name = 'dirt') {
  return pbr(name + base, 1024, (u, v, o) => {
    const B = hex(base), n = fbm(u, v, 5, 6, 111), d = fbm(u, v, 30, 3, 112), [w1, w2] = worley(u, v, 40, 113, 1);
    const peb = smooth(0.32, 0.18, w1) * smooth(0.55, 0.75, hash2(Math.floor(u * 40), Math.floor(v * 40), 114));
    let c = mixc([B[0] * 0.72, B[1] * 0.66, B[2] * 0.6], [B[0] * 1.12, B[1] * 1.08, B[2] * 1.0], n * 0.7 + d * 0.3);
    c = mixc(c, [B[0] * 0.85 + 0.08, B[1] * 0.85 + 0.08, B[2] * 0.9 + 0.08], peb * 0.8);
    o.c = c; o.h = 0.4 + n * 0.25 + peb * 0.35 + d * 0.05; o.r = 0.92 - peb * 0.2;
  }, 4);
}
// short turf: blended greens with dry patches (the instanced blades stand on it)
export function turf(base = 0x5a7a2a) {
  return pbr('turf' + base, 1024, (u, v, o) => {
    const B = hex(base), n = fbm(u, v, 6, 6, 121), b = fbm(u, v, 80, 2, 122), dry = smooth(0.55, 0.75, fbm(u, v, 3, 4, 123));
    let c = mixc([B[0] * 0.6, B[1] * 0.62, B[2] * 0.5], [B[0] * 1.2, B[1] * 1.2, B[2] * 0.9], n * 0.6 + b * 0.4);
    c = mixc(c, [0.62, 0.55, 0.3], dry * 0.45);
    o.c = c; o.h = 0.5 + b * 0.2; o.r = 0.95;
  }, 2);
}
// cliff rock: layered strata, cracks between plates, lichen
// cells (0..1): how strongly the Worley facets and their cracks show (low for weathered, earthy rock seen up close)
export function rock(base = 0x7a6a58, name = 'rock', cells = 1) {
  return pbr(name + base + (cells === 1 ? '' : 'c' + cells), 1024, (u, v, o) => {
    const B = hex(base), [w0, w2, id0] = worley(u, v, 12, 131, 0.9), crack = smooth(0.05, 0.0, w2 - w0) * smooth(0.45, 0.6, fbm(u, v, 4, 3, 135)) * cells;
    const id = 0.5 + (id0 - 0.5) * cells, w1 = 0.5 + (w0 - 0.5) * cells;
    const n = fbm(u, v, 8, 6, 132), m = fbm(u, v, 3, 4, 136), strata = 0.5 + 0.5 * Math.sin((v * 18 + fbm(u, v, 3, 3, 133) * 5) * Math.PI);
    const lich = smooth(0.62, 0.74, fbm(u, v, 10, 4, 134)), facet = ((1 - w1) * 0.6 + id * 0.4) * 0.5 + 0.25;
    let c = mixc([B[0] * 0.55, B[1] * 0.55, B[2] * 0.56], [B[0] * 1.25, B[1] * 1.2, B[2] * 1.15], n * 0.5 + facet * 0.15 + strata * 0.15 + m * 0.2);
    c = mixc(c, [0.42, 0.46, 0.28], lich * 0.35); c = mixc(c, [B[0] * 0.4, B[1] * 0.4, B[2] * 0.4], crack * 0.4);
    o.c = c; o.h = 0.3 + facet * 0.3 + n * 0.3 + strata * 0.06 - crack * 0.25; o.r = 0.86 - lich * 0.05;
  }, 6);
}
// sea-cave rock: dark wet stone, cracked into plates, crusted in patches with barnacles (pale rings round dark mouths)
// and slick with weed where the crust is not (海龍洞, src/remake/cave.js)
export function seaRock(base = 0x2e3c48, name = 'seaRock') {
  return pbr(name + base, 1024, (u, v, o) => {
    const B = hex(base), [w0, w2] = worley(u, v, 10, 141, 0.9), n = fbm(u, v, 8, 6, 142), m = fbm(u, v, 3, 4, 143);
    const crack = smooth(0.05, 0.0, w2 - w0) * smooth(0.4, 0.6, fbm(u, v, 4, 3, 147));
    const [b0, , bid] = worley(u, v, 40, 144, 1), crust = smooth(0.56, 0.72, fbm(u, v, 4, 4, 145)), br = 0.12 + 0.22 * bid;   // barnacles of every size, in clumps
    const barn = smooth(br, br * 0.7, b0) * crust * smooth(0.3, 0.45, (bid * 7.31) % 1), mouth = smooth(br * 0.4, br * 0.25, b0) * barn;
    const weed = smooth(0.56, 0.72, fbm(u, v, 9, 4, 146)) * (1 - crust);
    let c = mixc([B[0] * 0.5, B[1] * 0.52, B[2] * 0.56], [B[0] * 1.3, B[1] * 1.25, B[2] * 1.2], n * 0.6 + m * 0.4);
    c = mixc(c, [B[0] * 0.3, B[1] * 0.3, B[2] * 0.32], crack * 0.6);
    c = mixc(c, [0.12, 0.3, 0.24], weed * 0.55);
    c = mixc(c, [0.6, 0.62, 0.58], barn * 0.7); c = mixc(c, [0.08, 0.09, 0.1], mouth * 0.9);
    o.c = c; o.h = 0.35 + n * 0.3 - crack * 0.25 + barn * 0.35 - mouth * 0.3; o.r = 0.55 - weed * 0.25 + barn * 0.3;
  }, 6);
}
// glazed roof tiles: rows of barrel tiles, blue-glazed by default; v runs eave -> ridge, `n` tile columns across
export function roofTiles(base = 0x2a4a8a, n = 8, rows = 8) {
  return pbr('roof' + base + n + rows, 512, (u, v, o) => {
    const B = hex(base), x = (u * n) % 1, y = (v * rows) % 1, id = hash2(Math.floor(u * n), Math.floor(v * rows), 141);
    const barrel = Math.cos((x - 0.5) * Math.PI), lip = smooth(0.85, 1.0, y), gap = smooth(0.12, 0.0, barrel);
    const n2 = fbm(u, v, 8, 3, 142);
    let c = mixc([B[0] * 0.45, B[1] * 0.45, B[2] * 0.5], [B[0] * 1.3 + 0.05, B[1] * 1.25 + 0.05, B[2] * 1.15], barrel * 0.7 + n2 * 0.2 + id * 0.1);
    c = mixc(c, [0.06, 0.07, 0.1], gap * 0.7); c = mixc(c, [B[0] * 1.5 + 0.1, B[1] * 1.4 + 0.1, B[2] * 1.2 + 0.1], lip * barrel * 0.4);
    o.c = c; o.h = barrel * 0.7 + lip * 0.2 - y * 0.1; o.r = 0.25 + n2 * 0.2 + gap * 0.5;
  }, 4);
}
// lime plaster with a little grime toward the foot (v = 1 at the foot)
export function plaster(base = 0xe8dcc0) {
  return pbr('plaster' + base, 512, (u, v, o) => {
    const B = hex(base), n = fbm(u, v, 6, 5, 151), s = fbm(u, v, 30, 2, 152), grime = smooth(0.6, 1.0, v) * (0.6 + 0.4 * fbm(u, v, 10, 3, 153));
    o.c = mixc(mixc([B[0] * 0.88, B[1] * 0.86, B[2] * 0.8], B, n), [B[0] * 0.55, B[1] * 0.5, B[2] * 0.42], grime * 0.5);
    o.h = 0.5 + s * 0.1 + n * 0.05; o.r = 0.92;
  }, 1);
}
// marble: white with grey-violet veins (heaven's floor)
export function marble(base = 0xf2ecf4, vein = 0x8a7aa8, per = 2) {
  return pbr('marble' + base + vein + per, 1024, (u, v, o) => {
    const B = hex(base), V = hex(vein), x = u * per, y = v * per, fx = x % 1, fy = y % 1, edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    const t = fbm(u, v, 3, 6, 161), vv = smooth(0.025, 0.0, Math.abs(Math.sin((u * 3 + v * 2 + t * 3.5) * Math.PI)) * 0.2 - 0.0), id = hash2(Math.floor(x), Math.floor(y), 162);
    const grout = smooth(0.008, 0.002, edge);
    let c = mixc(B, mixc(B, V, 0.35), fbm(u, v, 5, 5, 163) * 0.6 + id * 0.2); c = mixc(c, V, vv * 0.55); c = mixc(c, [0.5, 0.45, 0.5], grout);
    o.c = c; o.h = 0.6 - grout * 0.5; o.r = 0.15 + vv * 0.1 + grout * 0.6;
  }, 2);
}
// bark: deep vertical furrows (v along the trunk)
export function bark(base = 0x4a3a2a) {
  return pbr('bark' + base, 512, (u, v, o) => {
    const B = hex(base), f = fbmA(u, v, 12, 3, 5, 171), r = smooth(0.35, 0.65, f), n = fbm(u, v, 20, 3, 172);
    o.c = mixc([B[0] * 0.45, B[1] * 0.42, B[2] * 0.4], [B[0] * 1.2, B[1] * 1.15, B[2] * 1.05], r * 0.7 + n * 0.3); o.h = r; o.r = 0.95;
  }, 4);
}
// glazed tiles in a basket weave: pairs of small oblong tiles turning 90 degrees cell to cell (the study's green floor)
export function weave(base = 0x9cc890, per = 8) {
  return pbr('weave' + base + per, 1024, (u, v, o) => {
    const B = hex(base), x = u * per, y = v * per, cx = Math.floor(x), cy = Math.floor(y), fx = x - cx, fy = y - cy, turn = (cx + cy) % 2;
    const a = turn ? fx : fy, b = turn ? fy : fx, half = a < 0.5 ? a * 2 : a * 2 - 1, k = a < 0.5 ? 0 : 1;
    const e = Math.min(half, 1 - half, b, 1 - b) , grout = smooth(0.07, 0.025, e), id = hash2(cx * 2 + k, cy, 191);
    const glaze = fbm(u, v, 16, 3, 192), bevel = smooth(0.0, 0.18, e);
    let c = mixc([B[0] * 0.7, B[1] * 0.74, B[2] * 0.7], [Math.min(1, B[0] * 1.15), Math.min(1, B[1] * 1.12), Math.min(1, B[2] * 1.1)], id * 0.5 + glaze * 0.3 + bevel * 0.2);
    c = mixc(c, [0.92, 0.94, 0.86], smooth(0.75, 0.95, glaze) * 0.25 * bevel); c = mixc(c, [0.3, 0.32, 0.26], grout);
    o.c = c; o.h = 0.4 + bevel * 0.3 - grout * 0.3; o.r = 0.18 + grout * 0.6 + glaze * 0.1;
  }, 3);
}
// imperial beam painting (彩画): a band of blue-green cartouches outlined in gold on vermilion; u along the beam
export function caihua() {
  return pbr('caihua', 512, (u, v, o) => {
    const x = u % 1, y = v, n = fbm(u, v, 16, 3, 201);
    const dx = (x - 0.5) * 2, dy = (y - 0.5) * 2.4, r = Math.hypot(dx, dy), lens = Math.abs(dx) * 0.55 + Math.abs(dy);
    let c = [0.62, 0.1, 0.06], h = 0.5, m = 0, ro = 0.4;
    if (y < 0.12 || y > 0.88) { c = [0.85, 0.65, 0.25]; m = 1; ro = 0.3; h = 0.6; }                 // gilt fillets
    else if (lens < 0.62) {
      const ring = Math.abs(lens - 0.55) < 0.05 || Math.abs(r - 0.25) < 0.04;
      c = ring ? [0.9, 0.7, 0.28] : mixc([0.12, 0.32, 0.5], [0.15, 0.5, 0.42], smooth(0.1, 0.5, r)); m = ring ? 1 : 0; ro = ring ? 0.3 : 0.5; h = ring ? 0.65 : 0.5;
    } else if (Math.abs(x - 0.0) < 0.03 || Math.abs(x - 1) < 0.03) { c = [0.9, 0.7, 0.28]; m = 1; }
    o.c = mixc(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85], n * 0.5); o.h = h; o.m = m; o.r = ro;
  }, 1.5);
}
