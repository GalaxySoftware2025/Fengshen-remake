// Modelled set pieces for the remade scene maps: real geometry with the procedural materials of tex.js, placed in map
// cells (x = map column, z = map row, y up; one cell = one world unit). Nothing is cut from the ROM art.
import * as THREE from 'three';
import * as T from './tex.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- materials (fresh per set; textures are cached)
export function mats(o = {}) {
  const M = {
    lacquer: T.material(T.lacquer(0x8c1810), { clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.9 }),
    lacquerDark: T.material(T.lacquer(0x3a0c08, 'lacquerD'), { clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    gold: T.material(T.gold(), { envMapIntensity: 1.3 }),
    bronze: T.material(T.bronze(), { envMapIntensity: 1.0 }),
    jade: T.material(T.jade(), { clearcoat: 0.4, envMapIntensity: 0.8 }),
    silk: T.material(T.silk(0xf2a81c), { sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.85, 0.5), side: THREE.DoubleSide }),
    wood: T.material(T.wood()),
    paper: T.material(T.paper(0xf0c27a), { emissive: new THREE.Color(1, 0.62, 0.28), emissiveIntensity: 0.75, side: THREE.DoubleSide }),
    lattice: T.material(T.lattice(), { side: THREE.DoubleSide }),
  };
  if (o.lacquer) { M.lacquer = T.material(T.lacquer(o.lacquer), { clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.9 }); M.lacquerDark = T.material(T.lacquer(o.lacquerDark ?? 0x2a0a20, 'lacquerD'), { clearcoat: 0.5 }); }
  if (o.silk) M.silk = T.material(T.silk(o.silk), { sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.9, 0.6), side: THREE.DoubleSide });
  return M;
}
export function shade(o, cast = true) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; }
// world-scaled UVs on a box: textures keep their size whatever the box's dimensions (k texture repeats per unit)
export function boxGeo(w, h, d, k = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] * k, uv.getY(j) * dims[f][1] * k); }
  return g;
}
export function box(mat, x0, y0, z0, x1, y1, z1, k = 1) {
  const m = new THREE.Mesh(boxGeo(x1 - x0, y1 - y0, z1 - z0, k), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return shade(m);
}
// many small static pieces of one material as a single mesh (fewer draw calls): meshes are baked with their transforms
export function merged(mat, meshes) {
  const P = [], N = [], U = [];
  for (const m of meshes) {
    m.updateMatrixWorld(true); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); U.push(...g.attributes.uv.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return shade(new THREE.Mesh(g, mat));
}
function lathe(pts, mat, seg = 32) { return shade(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat)); }

// ---------------------------------------------------------------- floors with levels, moats and retaining walls
// A level map at R sub-cells a cell: each sub-cell has a floor height, NaN for nothing (the void). Built as one mesh:
// tops in `top` material, the drops between levels faced in `side` (stone courses), world-scaled UVs.
export class Levels {
  constructor(w, h, R = 4) { this.w = w; this.h = h; this.R = R; this.H = new Float32Array(w * R * h * R).fill(NaN); this.ramps = []; }
  // fill a rect (cells) at height y
  set(x0, z0, x1, z1, y) {
    const R = this.R;
    for (let j = Math.round(z0 * R); j < Math.round(z1 * R); j++) for (let i = Math.round(x0 * R); i < Math.round(x1 * R); i++)
      if (i >= 0 && j >= 0 && i < this.w * R && j < this.h * R) this.H[j * this.w * R + i] = y;
    return this;
  }
  // a flight of stairs over a rect, from y0 at the `from` edge up to y1 at the opposite one ('s': climbs north)
  stairs(x0, z0, x1, z1, y0, y1, n, from = 's') { this.ramps.push({ x0, z0, x1, z1, y0, y1, n, from }); return this; }
  at(x, z) {   // the walking height at a world point (stairs included)
    for (const r of this.ramps) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) {
      const k = r.from === 's' ? (r.z1 - z) / (r.z1 - r.z0) : r.from === 'n' ? (z - r.z0) / (r.z1 - r.z0) : r.from === 'e' ? (r.x1 - x) / (r.x1 - r.x0) : (x - r.x0) / (r.x1 - r.x0);
      return r.y0 + (r.y1 - r.y0) * Math.min(1, Math.ceil(k * r.n - 1e-6) / r.n);
    }
    const R = this.R, i = Math.floor(x * R), j = Math.floor(z * R);
    if (i < 0 || j < 0 || i >= this.w * R || j >= this.h * R) return 0;
    const v = this.H[j * this.w * R + i]; return isNaN(v) ? 0 : v;
  }
  mesh(top, side, base = -1.5, k = 0.5) {
    const R = this.R, W = this.w * R, Hh = this.h * R, s = 1 / R, P = [], U = [], N = [], I = [[], []];
    const get = (i, j) => (i < 0 || j < 0 || i >= W || j >= Hh) ? NaN : this.H[j * W + i];
    const quad = (g, a, b, c, d, n, uvs) => {
      const o = P.length / 3; P.push(...a, ...b, ...c, ...d); N.push(...n, ...n, ...n, ...n); U.push(...uvs); I[g].push(o, o + 1, o + 2, o, o + 2, o + 3);
    };
    const inRamp = (i, j) => { const cx = (i + 0.5) * s, cz = (j + 0.5) * s; return this.ramps.some(r => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1); };
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const y = get(i, j); if (isNaN(y)) continue;
      const x0 = i * s, x1 = x0 + s, z0 = j * s, z1 = z0 + s;
      if (inRamp(i, j)) continue;   // the stair's own blocks fill its rect
      quad(0, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], [0, 1, 0], [x0 * k, -z0 * k, x0 * k, -z1 * k, x1 * k, -z1 * k, x1 * k, -z0 * k]);
      // drops: a face wherever the neighbour is lower or missing (a stair neighbour counts at its step height)
      for (const [di, dj, n] of [[1, 0, [1, 0, 0]], [-1, 0, [-1, 0, 0]], [0, 1, [0, 0, 1]], [0, -1, [0, 0, -1]]]) {
        let yn = inRamp(i + di, j + dj) ? this.at((i + di + 0.5) * s, (j + dj + 0.5) * s) : get(i + di, j + dj); if (isNaN(yn)) yn = base; if (yn >= y - 1e-4) continue;
        let a, b; if (di === 1) { a = [x1, z1]; b = [x1, z0]; } else if (di === -1) { a = [x0, z0]; b = [x0, z1]; } else if (dj === 1) { a = [x0, z1]; b = [x1, z1]; } else { a = [x1, z0]; b = [x0, z0]; }
        const ua = (di ? a[1] : a[0]) * k * 2, ub = (di ? b[1] : b[0]) * k * 2;
        quad(1, [a[0], y, a[1]], [a[0], yn, a[1]], [b[0], yn, b[1]], [b[0], y, b[1]], n, [ua, y * k * 2, ua, yn * k * 2, ub, yn * k * 2, ub, y * k * 2]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex([...I[0], ...I[1]]); g.addGroup(0, I[0].length, 0); g.addGroup(I[0].length, I[1].length, 1);
    const m = new THREE.Mesh(g, [top, side]); m.receiveShadow = true; m.castShadow = true; return m;
  }
}
// stair treads and risers for a Levels ramp (drawn over the gap the ramp leaves in the floor)
export function stairs(r, tread, riser, k = 1) {
  const g = new THREE.Group(), n = r.n, alongZ = r.from === 's' || r.from === 'n';
  for (let i = 0; i < n; i++) {
    const y = r.y0 + (r.y1 - r.y0) * (i + 1) / n, f0 = i / n, f1 = (i + 1) / n;
    let x0 = r.x0, x1 = r.x1, z0 = r.z0, z1 = r.z1;
    if (r.from === 's') { z0 = r.z1 - (r.z1 - r.z0) * 1; z1 = r.z1 - (r.z1 - r.z0) * f0; }
    else if (r.from === 'n') { z0 = r.z0 + (r.z1 - r.z0) * f0; }
    else if (r.from === 'e') { x0 = r.x0; x1 = r.x1 - (r.x1 - r.x0) * f0; }
    else { x0 = r.x0 + (r.x1 - r.x0) * f0; }
    const yb = i ? r.y0 + (r.y1 - r.y0) * i / n : r.y0 - 0.02;   // (each block stacked on the one below, not reaching down to the foot: overlapping blocks shared their side faces and flickered)
    const yt = i === n - 1 ? y - 0.003 : y;   // (the top tread 3 mm under the floor it meets: a ramp off the floor's grid overlaps the floor's last cell, and the two tops flickered, the temple's step)
    const b = new THREE.Mesh(boxGeo(x1 - x0, yt - yb, z1 - z0, k), [riser, riser, tread, tread, riser, riser]);
    b.position.set((x0 + x1) / 2, (yt + yb) / 2, (z0 + z1) / 2); g.add(b);
    void f1; void alongZ;
  }
  return shade(g);
}

// ---------------------------------------------------------------- architecture
// a lacquered column on a jade drum, gilt bands, a bracket capital; y: floor height, h: to the underside of the beam
export function pillar(M, x, z, y, h, r = 0.34) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [r * 1.55, 0], [r * 1.6, 0.06], [r * 1.5, 0.12], [r * 1.3, 0.3], [r * 1.2, 0.36], [r * 1.12, 0.4], [0, 0.4]], M.jade, 8));   // octagonal drum
  const shaft = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h - 0.4, 40, 1, true), M.lacquer)); shaft.position.y = 0.4 + (h - 0.4) / 2; g.add(shaft);
  for (const [y0, w] of [[0.5, 0.07], [0.62, 0.03], [h - 0.55, 0.03], [h - 0.42, 0.1]]) {
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, w, 40), M.gold)); b.position.y = y0; g.add(b);
  }
  // capital: a gilt block and two tiers of brackets
  g.add(box(M.gold, -r * 1.1, h - 0.3, -r * 1.1, r * 1.1, h - 0.12, r * 1.1));
  const arm = M.beam || M.lacquer;   // painted brackets in a palace
  g.add(box(arm, -r * 1.9, h - 0.12, -r * 0.6, r * 1.9, h + 0.06, r * 0.6, 1 / 0.18), box(arm, -r * 0.6, h - 0.12, -r * 1.9, r * 0.6, h + 0.06, r * 1.9, 1 / 0.18));
  g.add(box(M.gold, -r * 1.2, h + 0.06, -r * 0.7, r * 1.2, h + 0.1, r * 0.7));
  g.position.set(x, y, z); return shade(g);
}
// a low stone parapet with a gilt-and-lacquer coping (the original's brick walls with gold caps)
export function parapet(M, stone, x0, z0, x1, z1, y, h = 0.42) {
  const g = new THREE.Group();
  g.add(box(stone, x0, y, z0, x1, y + h, z1, 2));
  g.add(box(M.lacquer, x0 - 0.03, y + h, z0 - 0.03, x1 + 0.03, y + h + 0.07, z1 + 0.03, 2));
  g.add(box(M.gold, x0 - 0.05, y + h + 0.07, z0 - 0.05, x1 + 0.05, y + h + 0.1, z1 + 0.05, 2));
  return g;
}
// a back wall bay: lacquered posts and beams framing glowing lattice windows over carved dado panels; runs along x at z
export function latticeWall(M, x0, x1, z, y, h = 2.6, bays, o = {}) {   // o.lat: grille units per cell (0.8); o.dado: the dado panels' material
  const g = new THREE.Group(), n = bays || Math.max(1, Math.round((x1 - x0) / 1)), w = (x1 - x0) / n;
  g.add(box(M.lacquerDark, x0, y, z - 0.115, x1, y + h - 0.02, z - 0.06));   // the wall behind (its top and back inside the lintel's, not on them: they flickered)
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w, b = a + w;
    // dado: a panel with a gilt cartouche
    g.add(box(o.dado || M.lacquer, a + 0.06, y, z - 0.06, b - 0.06, y + 0.75, z));
    g.add(box(M.gold, a + 0.2, y + 0.22, z - 0.005, b - 0.2, y + 0.52, z + 0.025));
    // the window: paper lit from behind, the grille in front
    const pw = b - a - 0.16, ph = h - 1.25;
    const ppr = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.paper); ppr.position.set((a + b) / 2, y + 0.85 + ph / 2, z - 0.05); g.add(ppr);
    const lm = M.lattice.clone(); lm.map = lm.map.clone(); lm.map.repeat.set(pw * (o.lat ?? 0.8), ph * (o.lat ?? 0.8)); lm.map.needsUpdate = true;
    for (const k of ['normalMap', 'roughnessMap', 'metalnessMap']) if (lm[k]) { lm[k] = lm[k].clone(); lm[k].repeat.copy(lm.map.repeat); lm[k].needsUpdate = true; }
    const lat = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), lm); lat.position.set((a + b) / 2, y + 0.85 + ph / 2, z - 0.02); shade(lat); g.add(lat);
    g.add(box(M.lacquer, a + 0.04, y + 0.75, z - 0.06, b - 0.04, y + 0.85, z + 0.01));
  }
  for (let i = 0; i <= n; i++) { const px = x0 + i * w; g.add(box(M.lacquer, px - 0.08, y, z - 0.1, px + 0.08, y + h - 0.02, z + 0.06)); }   // (the posts' tops inside the lintel)
  g.add(box(M.beam || M.lacquer, x0 - 0.085, y + h - 0.38, z - 0.12, x1 + 0.085, y + h, z + 0.08, M.beam ? 1 / 0.38 : 1));   // lintel (painted beams in a palace; its ends past the end posts', not flush)
  g.add(box(M.gold, x0 - 0.085, y + h - 0.32, z + 0.08, x1 + 0.085, y + h - 0.26, z + 0.1));
  return g;
}
// a silk curtain hung from a rod at (x0..x1, top y, z), gathered and tied back toward `tie` ('l' or 'r')
export function curtain(M, x0, x1, z, yTop, h, tie = 'l', folds = 7) {
  const W = x1 - x0, geo = new THREE.PlaneGeometry(W, h, 48, 32), p = geo.attributes.position;
  const tieY = 0.42;   // the tie-back sits this far up (fraction of the height)
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + W / 2) / W, v = (p.getY(i) + h / 2) / h;   // v = 1 at the rod
    const pull = Math.max(0, 1 - Math.abs(v - tieY) / (v > tieY ? 1 - tieY + 0.15 : tieY + 0.35));   // how gathered at this height
    const g = Math.pow(pull, 0.9) * 0.6, side = tie === 'l' ? 0 : 1;
    let uu = u + (side - u) * g;   // gather toward the tied side
    const amp = 0.06 + g * 0.05;
    const zz = Math.sin(u * folds * Math.PI * 2) * amp;
    p.setXYZ(i, x0 + uu * W, yTop - (1 - v) * h, z + zz + (1 - v) * 0.06);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group(), m = shade(new THREE.Mesh(geo, M.silk)); g.add(m);
  const rod = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.2, 10), M.gold)); rod.rotation.z = Math.PI / 2; rod.position.set((x0 + x1) / 2, yTop + 0.03, z); g.add(rod);
  // the tie: a gilt cord with a tassel
  const tx = tie === 'l' ? x0 + W * 0.12 : x1 - W * 0.12, ty = yTop - (1 - tieY) * h;
  const cord = shade(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), M.gold)); cord.position.set(tx, ty, z + 0.05); cord.scale.set(1, 0.6, 1); g.add(cord);
  const tas = lathe([[0, 0], [0.05, 0.02], [0.07, 0.18], [0.0, 0.2]], M.gold, 12); tas.position.set(tx, ty - 0.3, z + 0.08); g.add(tas);
  return g;
}
// a bronze ding: a round-bellied cauldron on three legs with two upright handles; returns the group and its rim height
export function ding(M, x, z, y, s = 1) {
  const g = new THREE.Group(), legH = 0.26 * s, b = legH;
  g.add(lathe([[0, b], [0.2 * s, b + 0.01], [0.33 * s, b + 0.1 * s], [0.38 * s, b + 0.24 * s], [0.37 * s, b + 0.36 * s], [0.4 * s, b + 0.4 * s], [0.4 * s, b + 0.44 * s], [0.34 * s, b + 0.44 * s], [0.33 * s, b + 0.38 * s], [0.1 * s, b + 0.3 * s]], M.bronze, 36));
  const coal = shade(new THREE.Mesh(new THREE.CircleGeometry(0.33 * s, 24), new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: 0xff5a10, emissiveIntensity: 0.9, roughness: 1 })), false);
  coal.rotation.x = -Math.PI / 2; coal.position.y = b + 0.37 * s; g.add(coal);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + Math.PI / 2, leg = lathe([[0, 0], [0.06 * s, 0], [0.05 * s, legH * 0.5], [0.07 * s, legH], [0, legH + 0.05 * s]], M.bronze, 10);
    leg.position.set(Math.cos(a) * 0.24 * s, 0, Math.sin(a) * 0.24 * s); g.add(leg);
  }
  for (const sx of [-1, 1]) {
    const hnd = shade(new THREE.Mesh(new THREE.TorusGeometry(0.09 * s, 0.022 * s, 8, 16, Math.PI), M.bronze)); hnd.position.set(sx * 0.3 * s, b + 0.44 * s, 0); hnd.rotation.y = Math.PI / 2; g.add(hnd);
  }
  g.position.set(x, y, z); return { g: shade(g), rim: y + b + 0.4 * s };
}
// a folding screen of `n` leaves standing at z, zig-zagged, rosewood frames round lit paper with a painted wash
export function screen(M, x0, x1, z, y, h, n = 6, inner) {
  const g = new THREE.Group(), w = (x1 - x0) / n * 1.03;
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Group(), a = (i % 2 ? -1 : 1) * 0.22;
    leaf.add(box(M.wood, -w / 2, 0, -0.03, -w / 2 + 0.05, h, 0.03), box(M.wood, w / 2 - 0.05, 0, -0.03, w / 2, h, 0.03));
    leaf.add(box(M.wood, -w / 2, h - 0.06, -0.03, w / 2, h, 0.03), box(M.wood, -w / 2, 0.12, -0.03, w / 2, 0.2, 0.03), box(M.wood, -w / 2, 0.0, -0.03, w / 2, 0.05, 0.03));
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.28), inner || M.paper); pp.position.set(0, 0.2 + (h - 0.28) / 2, 0); leaf.add(pp);
    leaf.position.set(x0 + (i + 0.5) * (x1 - x0) / n, y, z + (i % 2) * Math.sin(Math.abs(a)) * w * 0.5); leaf.rotation.y = a; g.add(shade(leaf));
  }
  return g;
}
// 紂王's throne: a gilt seat with a curved back panel and dragon-head arms on a lacquered plinth, facing +z
export function throne(M, x, z, y) {
  const g = new THREE.Group(), cushion = T.material(T.silk(0xb0201a), { sheen: 1, sheenColor: new THREE.Color(1, 0.6, 0.4) });
  g.add(box(M.lacquer, -0.75, 0, -0.55, 0.75, 0.22, 0.45), box(M.gold, -0.78, 0.22, -0.57, 0.78, 0.27, 0.47));
  g.add(box(M.gold, -0.6, 0.27, -0.45, 0.6, 0.52, 0.35));
  g.add(box(cushion, -0.5, 0.52, -0.38, 0.5, 0.6, 0.3));
  const back = new THREE.Shape(); back.moveTo(-0.62, 0); back.lineTo(0.62, 0); back.lineTo(0.62, 0.7); back.quadraticCurveTo(0.6, 1.05, 0.0, 1.12); back.quadraticCurveTo(-0.6, 1.05, -0.62, 0.7); back.closePath();
  const bk = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(back, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), M.gold)); bk.position.set(0, 0.52, -0.48); g.add(bk);
  const inset = new THREE.Shape(); inset.moveTo(-0.45, 0.08); inset.lineTo(0.45, 0.08); inset.lineTo(0.45, 0.68); inset.quadraticCurveTo(0.4, 0.92, 0, 0.96); inset.quadraticCurveTo(-0.4, 0.92, -0.45, 0.68); inset.closePath();
  const ins = shade(new THREE.Mesh(new THREE.ShapeGeometry(inset), cushion)); ins.position.set(0, 0.52, -0.318); g.add(ins);   // (in front of the back's face, at -0.48 + 0.12 deep + 0.03 bevel = -0.33: on it, the two flickered, scene 43 [the user's report])
  for (const sx of [-1, 1]) {
    g.add(box(M.gold, sx * 0.62 - 0.07, 0.52, -0.42, sx * 0.62 + 0.07, 0.82, 0.32));
    const head = shade(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.gold)); head.scale.set(1, 0.9, 1.4); head.position.set(sx * 0.62, 0.86, 0.3); g.add(head);
    const pearl = shade(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.jade)); pearl.position.set(sx * 0.62, 0.86, 0.45); g.add(pearl);
  }
  g.position.set(x, y, z); return shade(g);
}
// a hanging palace lantern (red silk drum, gilt caps, a tassel) glowing from inside
export function lantern(M, x, y, z, s = 1) {
  const g = new THREE.Group(), red = T.material(T.silk(0xb01a10), { emissive: new THREE.Color(1, 0.3, 0.1), emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const body = shade(new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 24, 16), red)); body.scale.y = 0.85; g.add(body);
  for (const sy of [-1, 1]) { const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.07 * s, 16), M.gold)); c.position.y = sy * 0.25 * s; g.add(c); }
  const tas = lathe([[0, 0], [0.04 * s, 0.02 * s], [0.06 * s, 0.3 * s], [0, 0.32 * s]], new THREE.MeshStandardMaterial({ color: 0xc81a10, roughness: 0.8 }), 10); tas.position.y = -0.6 * s; g.add(tas);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.5, 4), M.gold); cord.position.y = 1.0 * s; g.add(cord);
  g.position.set(x, y, z); return g;
}
// a treasure chest (s: size): plank panels in a dark wood frame, steel-blue iron straps studded with rivets (the
// original's chests are blue-banded), gilt corner caps, ring handles on the ends, a gilt lock plate with a keyhole and
// a barrel lid with its own straps and a lip; open: the lid thrown back on its hinges, the empty dark inside showing
export function chest(M, x, z, y, open = false, rot = 0, s = 1) {
  const g = new THREE.Group(), body = new THREE.Group();
  const wd = T.material(T.planks(0x8a5430, 3), {}), frame = T.material(T.wood(0x3a2214, 'chestFrame'), {});
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a6aa8, metalness: 0.75, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 1 });
  const W = 0.3, D = 0.2, H = 0.3, R = 0.2;                                     // half width / half depth, body height, lid radius
  body.add(box(wd, -W + 0.01, 0.02, -D + 0.01, W - 0.01, H - 0.012, D - 0.01, 2));       // under the rail's top: no two faces share a plane (they flicker once the lid is off)
  body.add(box(frame, -W - 0.01, 0, -D - 0.01, W + 0.01, 0.04, D + 0.01));                 // plinth
  body.add(box(frame, -W - 0.005, H - 0.035, -D - 0.005, W + 0.005, H, D + 0.005));      // top rail
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                   // corner posts and gilt caps
    body.add(box(frame, sx * W - 0.025, 0, sz * D - 0.025, sx * W + 0.025, H, sz * D + 0.025));
    body.add(box(M.gold, sx * W - 0.032, 0, sz * D - 0.032, sx * W + 0.032, 0.05, sz * D + 0.032));
    body.add(box(M.gold, sx * W - 0.032, H - 0.05, sz * D - 0.032, sx * W + 0.032, H + 0.004, sz * D + 0.032));
  }
  const rivet = new THREE.SphereGeometry(0.011, 6, 4);
  for (const bx of [-0.15, 0.15]) {                                                       // straps over front, back and lid
    body.add(box(iron, bx - 0.028, 0.03, -D - 0.012, bx + 0.028, H - 0.03, D + 0.012));
    for (const sz of [-1, 1]) for (const yy of [0.08, 0.16, 0.24]) { const r = new THREE.Mesh(rivet, M.gold); r.position.set(bx, yy, sz * (D + 0.014)); body.add(r); }
  }
  for (const sx of [-1, 1]) {                                                             // ring handles
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 14), iron); ring.rotation.y = Math.PI / 2; ring.position.set(sx * (W + 0.03), 0.17, 0); body.add(ring);
    body.add(box(iron, sx * W - 0.005 + sx * 0.012, 0.19, -0.02, sx * W + 0.005 + sx * 0.012, 0.23, 0.02));
  }
  body.add(box(M.gold, -0.055, 0.1, D + 0.005, 0.055, 0.25, D + 0.02));                   // lock plate and keyhole
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8).rotateX(Math.PI / 2), dark); key.position.set(0, 0.185, D + 0.024); body.add(key);
  body.add(box(dark, -0.005, 0.15, D + 0.02, 0.005, 0.18, D + 0.026));
  if (open) {                                                                             // the empty inside, drawn over the rail's top
    const hole = dark.clone(); hole.polygonOffset = true; hole.polygonOffsetFactor = -2; hole.polygonOffsetUnits = -2;
    body.add(box(hole, -W + 0.03, H - 0.01, -D + 0.03, W - 0.03, H + 0.002, D - 0.03));
  }
  g.add(body);
  const lid = new THREE.Group(), lg = new THREE.CylinderGeometry(R, R, W * 2 - 0.01, 18, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
  const wdIn = wd.clone(); wdIn.side = THREE.DoubleSide;                                   // seen from below when thrown back
  const lm = new THREE.Mesh(lg, wdIn); lm.scale.set(1, 0.8, 1); lm.position.set(0, 0, D); lid.add(lm);
  for (const sx of [-1, 1]) {                                                             // the lid's end boards
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 18, 0, Math.PI).rotateY(sx * Math.PI / 2), wdIn);
    cap.scale.set(1, 0.8, 1); cap.position.set(sx * (W - 0.005), 0, D); lid.add(cap);
  }
  for (const bx of [-0.15, 0.15, -W + 0.02, W - 0.02]) {
    const b = new THREE.CylinderGeometry(R + 0.008, R + 0.008, bx === 0.15 || bx === -0.15 ? 0.056 : 0.04, 18, 1, false, 0, Math.PI); b.rotateZ(Math.PI / 2);
    const bm = new THREE.Mesh(b, Math.abs(bx) > 0.2 ? M.gold : iron); bm.scale.set(1, 0.8, 1); bm.position.set(bx, 0, D); lid.add(bm);
  }
  lid.add(box(frame, -W - 0.005, -0.012, D + D - 0.012, W + 0.005, 0.012, D + D + 0.014));   // the lip at the front edge
  if (!open) lid.add(box(M.gold, -0.04, -0.06, D + D + 0.006, 0.04, 0.0, D + D + 0.022));    // the hasp down onto the lock
  lid.position.set(0, H, -D); if (open) lid.rotation.x = -1.95; g.add(lid);
  g.scale.setScalar(s); g.position.set(x, y, z); g.rotation.y = rot; g.userData.chest = 1; return shade(g);   // (chest: tools/qa/sets.js looks into it)
}
// a village house: a brick plinth course, plaster walls framed in timber, lattice windows and a pair of plank doors on
// the front (+z) face, a gable roof of glazed barrel tiles with a ridge and upturned ridge ends.
// o = { x0, x1, z0 (back), z1 (front), y, wallH, roof: colour, doors: [x centres], windows: [[xa, xb]], over }
export function house(M, o) {
  const g = new THREE.Group(), W = o.x1 - o.x0, D = o.z1 - o.z0, H = o.wallH ?? 1.25, y = o.y ?? 0, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
  const plasterM = T.material(T.plaster(o.plaster ?? 0xe6dcc4), {}, [0.6, 0.6]);
  const brickM = T.material(T.bricks(o.brick ?? 0xb0684a, 6, 'redBrick'), {}, [1, 1]);
  const timber = T.material(T.wood(0x5a3820, 'timber'), {}, [1, 1]);
  const doorM = T.material(T.planks(0x8a5430, 3), {});
  const stoneM = T.material(T.bricks(0x8a8478, 2, 'plinth'), {});
  g.add(box(stoneM, o.x0 - 0.05, y, o.z0 - 0.05, o.x1 + 0.05, y + 0.14, o.z1 + 0.05, 1));
  g.add(box(brickM, o.x0, y + 0.14, o.z0, o.x1, y + 0.55, o.z1, 1));
  g.add(box(plasterM, o.x0 + 0.02, y + 0.55, o.z0 + 0.02, o.x1 - 0.02, y + H, o.z1 - 0.02, 1));
  // timber frame on the front: corner and bay posts, a sill beam, a lintel under the eaves
  const posts = [o.x0, o.x1, ...(o.posts || [])];
  // (the posts' tops 1 cm under the wall's, the lintel's 5 mm over it: the three flush, seen through the gable, flickered)
  for (const px of posts) g.add(box(timber, px - 0.07, y + 0.14, o.z1 - 0.06, px + 0.07, y + H - 0.01, o.z1 + 0.04, 2));
  for (const px of [o.x0, o.x1]) g.add(box(timber, px - 0.07, y + 0.14, o.z0 - 0.04, px + 0.07, y + H - 0.01, o.z0 + 0.06, 2));
  g.add(box(timber, o.x0, y + 0.52, o.z1 - 0.04, o.x1, y + 0.6, o.z1 + 0.03, 2), box(timber, o.x0 - 0.05, y + H - 0.12, o.z1 - 0.05, o.x1 + 0.05, y + H + 0.005, o.z1 + 0.05, 2));
  for (const [xa, xb] of o.windows || []) {   // a lattice window: timber frame, paper behind a grille
    const wy0 = y + 0.66, wy1 = y + H - 0.22;
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa - 0.1, wy1 - wy0 - 0.1), new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.9, emissive: 0x2a2010 }));
    pp.position.set((xa + xb) / 2, (wy0 + wy1) / 2, o.z1 + 0.025); g.add(pp);
    const lm = M.lattice.clone(); lm.map = lm.map.clone(); lm.map.repeat.set((xb - xa) * 1.6, (wy1 - wy0) * 1.6); lm.map.needsUpdate = true; lm.color = new THREE.Color(0x6a3a20);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa - 0.1, wy1 - wy0 - 0.1), lm); lt.position.set((xa + xb) / 2, (wy0 + wy1) / 2, o.z1 + 0.04); g.add(shade(lt));
    g.add(box(timber, xa - 0.05, wy0 - 0.05, o.z1, xb + 0.05, wy0 + 0.03, o.z1 + 0.07), box(timber, xa - 0.05, wy1 - 0.03, o.z1, xb + 0.05, wy1 + 0.05, o.z1 + 0.07));
    g.add(box(timber, xa - 0.05, wy0, o.z1, xa + 0.03, wy1, o.z1 + 0.07), box(timber, xb - 0.03, wy0, o.z1, xb + 0.05, wy1, o.z1 + 0.07));
  }
  for (const dx of o.doors || []) {   // a pair of plank doors, recessed in a timber frame, with a threshold step
    const dw = 0.42, dh = H - 0.2;
    for (const s of [-1, 1]) {   // each leaf hangs on a pivot at its outer edge, so it can swing inward (house.userData.doors)
      const piv = new THREE.Group(); piv.position.set(dx + s * dw, y, o.z1);
      piv.add(box(doorM, s < 0 ? 0.01 : -dw + 0.01, 0.14, -0.02, s < 0 ? dw - 0.01 : -0.01, dh, 0.02, 2));
      piv.userData.open = s * 1.6; g.add(piv); (g.userData.doors ||= []).push(piv);
    }
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(dw * 2, dh - 0.14), new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 1 }));
    dark.position.set(dx, y + 0.14 + (dh - 0.14) / 2, o.z1 - 0.012); g.add(dark);   // the dim room behind the doors
    g.add(box(timber, dx - dw - 0.08, y + 0.14, o.z1 - 0.03, dx - dw, y + dh + 0.06, o.z1 + 0.06), box(timber, dx + dw, y + 0.14, o.z1 - 0.03, dx + dw + 0.08, y + dh + 0.06, o.z1 + 0.06));
    g.add(box(timber, dx - dw - 0.08, y + dh, o.z1 - 0.03, dx + dw + 0.08, y + dh + 0.08, o.z1 + 0.06), box(stoneM, dx - dw - 0.1, y, o.z1, dx + dw + 0.1, y + 0.1, o.z1 + 0.25));
    for (const s of [-1, 1]) { const r = shade(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), M.gold)); r.position.set(dx + s * 0.07, y + dh * 0.55, o.z1 + 0.035); g.add(r); }
  }
  // the roof
  const ov = o.over ?? 0.4, rise = o.rise ?? Math.min(1.1, D * 0.42), top = y + H, ridgeY = top + rise, x0 = o.x0 - ov, x1 = o.x1 + ov;
  const tiles = T.roofTiles(o.roof ?? 0x2a4a8a, 8, 8), slopeL = Math.hypot(D / 2 + ov, rise + 0.1);
  const rm = T.material(tiles, { envMapIntensity: 0.8, side: THREE.DoubleSide }, [(x1 - x0) / 1.1, slopeL / 1.1]);
  for (const sg of [1, -1]) {
    const ez = sg > 0 ? o.z1 + ov : o.z0 - ov, geo = new THREE.BufferGeometry(), N = 12, P = [], UV = [], I = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= 1; j++) {   // slightly concave slope: the eave flattens out
      const t = i / N, sag = Math.sin(t * Math.PI) * 0.08, zz = cz + (ez - cz) * t, yy = ridgeY + (top - 0.12 - ridgeY) * t - sag * (1 - t) * 0 - sag;
      P.push(j ? x1 : x0, yy, zz); UV.push(j, 1 - t);
    }
    for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (sg > 0) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
    g.add(shade(new THREE.Mesh(geo, rm)));
    const eave = box(timber, x0, top - 0.2, ez - 0.04 * sg - 0.04, x1, top - 0.1, ez - 0.04 * sg + 0.04); g.add(eave);
    // the eave tiles' round ends, a row of glazed discs
    const capM = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.roof ?? 0x2a4a8a).multiplyScalar(1.3), roughness: 0.3, metalness: 0.1 });
    const caps = []; for (let x = x0 + 0.07; x < x1; x += 1.1 / 8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10).rotateX(Math.PI / 2), capM); c.position.set(x, top - 0.1, ez + 0.01 * sg); caps.push(c); }
    g.add(merged(capM, caps));
  }
  const ridgeM = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.roof ?? 0x2a4a8a).multiplyScalar(0.8), roughness: 0.35 });
  g.add(box(ridgeM, x0 - 0.05, ridgeY - 0.06, cz - 0.12, x1 + 0.05, ridgeY + 0.16, cz + 0.12));
  for (const ex of [x0 - 0.05, x1 + 0.05]) { const h = shade(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 8), ridgeM)); h.position.set(ex, ridgeY + 0.26, cz); h.rotation.z = ex < cx ? 0.5 : -0.5; g.add(h); }
  // gables: plaster triangles with a timber king post
  const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
  for (const ex of [o.x0 + 0.02, o.x1 - 0.02]) { const m = shade(new THREE.Mesh(new THREE.ShapeGeometry(tri), plasterM)); m.rotation.y = Math.PI / 2; m.position.set(ex, top, cz); m.material.side = THREE.DoubleSide; g.add(m); g.add(box(timber, ex - 0.04, top, cz - 0.05, ex + 0.04, ridgeY - 0.05, cz + 0.05)); }
  return shade(g);
}
// a stack of split logs, 3-2-1, lying along x; ends show pale end grain
export function woodpile(x, z, y, len = 0.8, rot = 0) {
  const g = new THREE.Group(), barkM = T.material(T.bark(0x6a4a2a), {}, [1, 0.5]), endM = new THREE.MeshStandardMaterial({ color: 0xd8b078, roughness: 0.85 });
  const r = 0.09; let k = 0;
  for (const [row, n] of [[0, 3], [1, 2], [2, 1]]) for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * (0.9 + Math.random() * 0.2), r, len * (0.92 + Math.random() * 0.12), 10), [barkM, endM, endM]);
    c.rotation.z = Math.PI / 2; c.position.set((Math.random() - 0.5) * 0.06, r + row * r * 1.72, (i - (n - 1) / 2) * r * 2.02); g.add(c); k++;
  }
  g.position.set(x, y, z); g.rotation.y = rot; return shade(g);
}

// a great haunch of meat (林雲's hunt), the load of the original's carts (scene 0's and battle 1's supply cart, scene
// 1's hand cart: the same cream-and-red heap): lumpy, roasted brown with pale fat, the cut face red, a bone end out of
// it. Laid as on the hand cart's bed (bed top at y 0.44, its long side along x); place, turn and scale the group to fit.
export function haunch() {
  const g = new THREE.Group();
  const meatT = T.material(T.pbr('cartMeat', 256, (u, v, o) => { const n = T.fbm(u, v, 6, 4, 5), f = T.fbm(u, v, 14, 3, 6);
    o.c = T.mixc(T.mixc([0.42, 0.16, 0.08], [0.66, 0.3, 0.14], n), [0.92, 0.8, 0.62], T.smooth(0.62, 0.7, f) * 0.7); o.h = 0.5 + n * 0.2; o.r = 0.55 - f * 0.2; }, 2), { clearcoat: 0.3, clearcoatRoughness: 0.5 });
  const geo = new THREE.SphereGeometry(0.36, 28, 20), P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 1 + 0.12 * Math.sin(x * 9 + z * 5) * Math.cos(y * 7) + 0.08 * Math.sin(z * 13 + y * 4); P.setXYZ(i, x * k * 1.15, y * k * 0.85, z * k); }
  geo.computeVertexNormals();
  const meat = new THREE.Mesh(geo, meatT); meat.position.set(0, 0.78, -0.05); meat.rotation.set(0.2, 0.5, 0.15); g.add(shade(meat));
  const cut = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ color: 0xb8323a, roughness: 0.6, emissive: 0x2a0606 }));
  cut.position.set(0.3, 0.8, 0.12); cut.rotation.y = 1.1; g.add(cut);
  const boneM = new THREE.MeshStandardMaterial({ color: 0xf0e6d0, roughness: 0.7 });
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), boneM); bone.rotation.z = Math.PI / 2.4; bone.position.set(-0.42, 0.86, 0.02); g.add(shade(bone));
  for (const dz of [-0.04, 0.04]) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), boneM); knob.position.set(-0.55, 0.92, dz); g.add(shade(knob)); }
  return g;
}
