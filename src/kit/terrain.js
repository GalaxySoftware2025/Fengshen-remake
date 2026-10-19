// Outdoor land for the remade sets: the original map supplies only the layout (which ground is where, read off its
// colours at 8 px resolution); the land itself is new: a heightfield where rock stands up as rugged masses with steep
// faces, a splat shader blending procedural dirt, turf and rock (projected on three axes on the faces), and instanced
// grass tufts, stones, shrubs and trees. The map runs on past its edges (mirrored layout) under the fog.
import * as THREE from 'three';
import * as T from './tex.js';
import { loadImg } from '../world.js';
import { shade } from './parts.js';

const R = 4;   // layout samples per cell
export const CL = { ground: 0, grass: 1, rock: 2, water: 3, pave: 4, forest: 5 };

// read the layout from the map art: palette = { class: [0xrrggbb, ...] } (colours that belong to one kind of ground
// only; any other colour is ignored), the majority class of every 8x8 block; lone rock specks (the original's
// pebbles) become ground, their spots returned as `pebbles`
export async function readLayout(src, w, h, palette, weights = {}) {
  const img = await loadImg(src), c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, img.width, img.height).data;
  const lut = new Map(); for (const [k, cols] of Object.entries(palette)) for (const h of cols) lut.set(h, +k);
  const W = w * R, H = h * R, out = new Uint8Array(W * H), B = 32 / R;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const n = new Uint16Array(8);
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const k = ((j * B + y) * img.width + i * B + x) * 4, q = lut.get((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]); if (q != null) n[q]++; }
    let best = 0; const wt = q => n[q] * (weights[q] ?? 1); for (let q = 1; q < 8; q++) if (wt(q) > wt(best)) best = q; out[j * W + i] = best;
  }
  const pebbles = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (out[j * W + i] !== CL.rock) continue; let n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if ((a || b) && ii >= 0 && jj >= 0 && ii < W && jj < H && out[jj * W + ii] === CL.rock) n++; }
    if (n <= 2) { out[j * W + i] = CL.ground; pebbles.push([(i + 0.5) / R, (j + 0.5) / R]); }
  }
  out.pebbles = pebbles; return out;
}

// the land: o = { w, h, layout, ext (cells past the edges), outside?(x, z) (the class past the edges), rockH, plateaus: [{ r, h }], ramps: [{ r, y, axis }],
//   carve: [{ r, h }], cap?(x, z) (a height limit), tex: { dirt, turf, rock, rockTop }, tint: { dirt, turf, rock } }; mesh(opt): res, dirtK, turfK, rockK, snow, bed, topGreen
export class Land {
  constructor(o) {
    Object.assign(this, o); this.ext = o.ext ?? 10;
    const E = this.ext, W = (o.w + E * 2) * R, H = (o.h + E * 2) * R; this.W = W; this.H = H;
    // the layout over the extended area: mirrored at the map's edges, or what o.outside(x, z) (cells) says lies there
    const cls = this.cls = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let x = i - E * R, y = j - E * R; const mw = o.w * R, mh = o.h * R;
      if (o.outside && (x < 0 || y < 0 || x >= mw || y >= mh)) { const c = o.outside((x + 0.5) / R, (y + 0.5) / R); if (c != null) { cls[j * W + i] = c; continue; } }
      x = x < 0 ? -x - 1 : x >= mw ? 2 * mw - x - 1 : x; y = y < 0 ? -y - 1 : y >= mh ? 2 * mh - y - 1 : y;
      x = Math.max(0, Math.min(mw - 1, x)); y = Math.max(0, Math.min(mh - 1, y));
      cls[j * W + i] = o.layout[y * mw + x];
    }
    // distance (in samples) into the rock, for steep but not sheer faces
    const INF = 1e9, d = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) d[k] = cls[k] === CL.rock ? INF : 0;
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const jj = pass ? H - 1 - j : j, ii = pass ? W - 1 - i : i, k = jj * W + ii; if (!d[k]) continue;
      const s = pass ? 1 : -1;
      const a = (ii + s >= 0 && ii + s < W) ? d[k + s] + 1 : INF, b = (jj + s >= 0 && jj + s < H) ? d[k + s * W] + 1 : INF;
      const c = (ii + s >= 0 && ii + s < W && jj + s >= 0 && jj + s < H) ? d[k + s * W + s] + 1.414 : INF;
      d[k] = Math.min(d[k], a, b, c);
    }
    this.dist = d;
  }
  // height at a world point (x, z in map cells)
  at(x, z) {
    for (const c of this.carve || []) { const [a, b, cc, dd] = c.r; if (x >= a && x < cc && z >= b && z < dd) return c.h; }
    for (const r of this.ramps || []) {   // steps over a ridge: a hump of y at its middle, or a slope from one edge
      const [a, b, cc, dd] = r.r; if (x < a || x >= cc || z < b || z >= dd) continue;
      const k = r.axis === 'x' ? (x - a) / (cc - a) : (z - b) / (dd - b), n = r.n || 6;
      const prof = r.hump ? 1 - Math.abs(k * 2 - 1) : k; return r.y0 + (r.y - r.y0) * Math.round(prof * n) / n;
    }
    let base = this.rawH(x, z);
    for (const p of this.plateaus || []) {   // raised ground with a ragged, steep edge (noise moves the rim in and out)
      const [a, b, cc, dd] = p.r, e = Math.min(x - a, cc - x, z - b, dd - z); if (e < -0.6) continue;
      const wu = ((x / 11) % 1 + 1) % 1, wv = ((z / 11) % 1 + 1) % 1, n = T.fbm(wu, wv, 10, 3, 9) - 0.5;
      const k = Math.min(1, Math.max(0, (e + n * 0.9 + 0.2) / 0.35)), up = k * k * (3 - 2 * k);
      base = Math.max(base, up * (p.h + (T.fbm(wu, wv, 30, 2, 10) - 0.5) * 0.12));
    }
    if (this.cap) base = Math.min(base, this.cap(x, z));   // o.cap(x, z): the most the land may rise there (a low shelf in front of the camera)
    return base;
  }
  rawH(x, z) {
    const fx = (x + this.ext) * R - 0.5, fz = (z + this.ext) * R - 0.5, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const D = (a, b) => { a = Math.max(0, Math.min(this.W - 1, a)); b = Math.max(0, Math.min(this.H - 1, b)); return this.dist[b * this.W + a]; };
    const dd = (D(i, j) * (1 - tx) + D(i + 1, j) * tx) * (1 - tz) + (D(i, j + 1) * (1 - tx) + D(i + 1, j + 1) * tx) * tz;
    const H = this.rockH ?? 1, k = Math.min(1, dd / (this.rise ?? 2.2)), up = k * k * (3 - 2 * k);
    const wu = ((x / 13) % 1 + 1) % 1, wv = ((z / 13) % 1 + 1) % 1;
    const lump = T.fbm(wu, wv, 8, 4, 5) - 0.5, crag = T.fbm(wu, wv, 40, 3, 6) - 0.5;
    let y;
    if (this.peaks) {   // mountains: rising with the distance into the range, ridged (serrate: a chain of sharp peaks)
      const r = 1 - Math.abs(T.fbm(wu, wv, this.serrate || 16, 4, 11) * 2 - 1), q = Math.pow(Math.min(1, dd / this.peaks), 0.85);
      y = this.serrate ? H * q * (0.25 + 0.95 * r * r) + up * H * 0.05 + (1 - up) * lump * (this.lumpH ?? 0.08)
        : H * q * (0.55 + 0.6 * r) + up * H * 0.08 + (1 - up) * lump * (this.lumpH ?? 0.08);
    } else y = up * (H + lump * H * 0.9 + crag * H * 0.35 + Math.min(1, dd / 12) * H * 0.4) + (1 - up) * lump * (this.lumpH ?? 0.08);
    if (this.waterDepth && !(this.dry && this.dry(x, z))) {   // (o.waterJitter: the shore wanders, so it does not follow the layout's quarter-cell steps; o.dry(x, z): ground it may not dip, a walkable cell)
      const j = this.waterJitter || 0, jx = j ? (T.fbm(wu, wv, 18, 3, 12) - 0.5) * j : 0, jz = j ? (T.fbm(wu, wv, 18, 3, 13) - 0.5) * j : 0;
      y -= this.weight(x + jx, z + jz, CL.water) * this.waterDepth;
    }
    return y;
  }
  // the share of a class around a world point (bilinear over the layout samples)
  weight(x, z, cls) {
    const fx = (x + this.ext) * R - 0.5, fz = (z + this.ext) * R - 0.5, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const C = (a, b) => { a = Math.max(0, Math.min(this.W - 1, a)); b = Math.max(0, Math.min(this.H - 1, b)); return this.cls[b * this.W + a] === cls ? 1 : 0; };
    const w = (C(i, j) * (1 - tx) + C(i + 1, j) * tx) * (1 - tz) + (C(i, j + 1) * (1 - tx) + C(i + 1, j + 1) * tx) * tz;
    return w * w * (3 - 2 * w);
  }
  // splat weights texture (R ground, G grass, B rock, A water) over the extended area
  splat() {
    const W = this.W, H = this.H, data = new Uint8Array(W * H * 4);
    for (let k = 0; k < W * H; k++) { const c = this.cls[k]; data[k * 4] = c === 0 || c === 4 ? 255 : 0; data[k * 4 + 1] = c === 1 || c === 5 ? 255 : 0; data[k * 4 + 2] = c === 2 ? 255 : 0; data[k * 4 + 3] = c === 3 ? 255 : 0; }
    // soften: two box blurs
    for (let pass = 0; pass < 2; pass++) {
      const src = data.slice();
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) for (let ch = 0; ch < 4; ch++) {
        let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; s += src[(jj * W + ii) * 4 + ch]; n++; }
        data[(j * W + i) * 4 + ch] = s / n;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }
  mesh(opt = {}) {
    const E = this.ext, w = this.w + E * 2, h = this.h + E * 2, S = opt.res ?? 8;
    const geo = new THREE.PlaneGeometry(w, h, w * S, h * S); geo.rotateX(-Math.PI / 2); geo.translate(w / 2 - E, 0, h / 2 - E);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, this.at(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const tx = this.tex, tint = this.tint || {};
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, map: tx.dirt.map });   // map: so uv / map chunks compile
    const U = {
      uSplat: { value: this.splat() }, uOrigin: { value: new THREE.Vector2(-E, -E) }, uSize: { value: new THREE.Vector2(w, h) },
      uDirt: { value: tx.dirt.map }, uTurf: { value: tx.turf.map }, uRock: { value: tx.rock.map }, uRockN: { value: tx.rock.normalMap },
      uTD: { value: new THREE.Color(tint.dirt ?? 0xffffff) }, uTG: { value: new THREE.Color(tint.turf ?? 0xffffff) }, uTR: { value: new THREE.Color(tint.rock ?? 0xffffff) },
      uScale: { value: new THREE.Vector3(opt.dirtK ?? 0.3, opt.turfK ?? 0.35, opt.rockK ?? 0.28) },
      uSnow: { value: opt.snow ?? 99 }, uTopG: { value: opt.topGreen ?? 0 }, uBed: { value: new THREE.Color(opt.bed ?? 0x3a4a3a) },
    };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW; varying vec3 vLN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D uSplat, uDirt, uTurf, uRock, uRockN; uniform vec2 uOrigin, uSize; uniform vec3 uTD, uTG, uTR, uScale, uBed; uniform float uSnow, uTopG; varying vec3 vLW; varying vec3 vLN;
        float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }
        vec3 tri(sampler2D t, vec3 p, vec3 n, float k){ vec3 a = pow(abs(n), vec3(4.0)); a /= a.x + a.y + a.z;
          return texture2D(t, p.zy * k).rgb * a.x + texture2D(t, p.xz * k).rgb * a.y + texture2D(t, p.xy * k).rgb * a.z; }`)
        .replace('#include <map_fragment>', `
        vec4 sw = texture2D(uSplat, (vLW.xz - uOrigin) / uSize);
        float nz = tn(vLW.xz * 2.3) * 0.6 + tn(vLW.xz * 7.0) * 0.4;
        vec3 n = normalize(vLN); float slope = 1.0 - n.y;
        vec3 dirt = texture2D(uDirt, vLW.xz * uScale.x).rgb * uTD;
        vec3 turf = texture2D(uTurf, vLW.xz * uScale.y).rgb * uTG;
        vec3 rk = tri(uRock, vLW, n, uScale.z) * uTR;
        float g = smoothstep(0.35, 0.65, sw.g + (nz - 0.5) * 0.55);
        float r = max(smoothstep(0.4, 0.7, sw.b + (nz - 0.5) * 0.4), smoothstep(0.28, 0.55, slope));
        vec3 col = mix(dirt, turf, g);
        // rock tops get a little scrub (opt.topGreen: overgrown, as on forested ridges); faces are bare
        float tg = mix(smoothstep(0.6, 0.85, nz) * 0.5, smoothstep(0.2, 0.55, nz) * 0.92, uTopG);
        vec3 top = mix(rk, turf * 0.7, tg * (1.0 - smoothstep(0.15, 0.4, slope)));
        col = mix(col, top, r);
        col = mix(col, uBed, smoothstep(0.3, 0.7, sw.a));                       // river beds
        float snow = smoothstep(uSnow, uSnow + 0.12, vLW.y + (nz - 0.5) * 0.12) * (1.0 - smoothstep(0.35, 0.75, slope) * 0.6);
        col = mix(col, vec3(0.95, 0.96, 1.0), snow);
        col *= 0.85 + 0.3 * tn(vLW.xz * 0.6);   // large-scale variation
        diffuseColor.rgb = col;`);
    };
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = true; return m;
  }
  // world points over a class, about `per` a cell, jittered (for scattering plants and stones)
  scatter(cls, per, fn) {
    const out = [], E = this.ext;
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      if (this.cls[j * this.W + i] !== cls) continue;
      let n = per / (R * R); while (n > 0) { if (Math.random() < n) { const x = i / R - E + Math.random() / R, z = j / R - E + Math.random() / R; if (!fn || fn(x, z)) out.push([x, this.at(x, z), z]); } n -= 1; }
    }
    return out;
  }
}

// ---------------------------------------------------------------- vegetation and stones
const WIND = { uTime: { value: 0 } };
export const windTick = t => { WIND.uTime.value = t; };
function sway(mat, k = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = WIND.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3; float hh = max(0.0, position.y);
      transformed.x += sin(uTime * 1.6 + ph) * 0.07 * hh * ${k.toFixed(2)}; transformed.z += cos(uTime * 1.2 + ph) * 0.04 * hh * ${k.toFixed(2)};`);
  };
}
// characters standing in the grass (every src/actors.js Actor registers here): round each one's feet the tufts are
// pressed down and parted outward, a little darker, as trodden grass [the user's call]. Read once a frame, by the first
// grass mesh drawn (up to 16 characters: shown, on the ground, not fading away)
export const steppers = new Set();
const STEP = { uSteps: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) } };
let stepFrame = -1;
function fillSteps(renderer) {
  const f = renderer.info.render.frame; if (f === stepFrame) return; stepFrame = f;
  const v = STEP.uSteps.value; let i = 0;
  for (const a of steppers) { if (i >= v.length) break; if (!a.root.visible || a.root.parent == null || a.hover > 0.15 || a.dissolve > 0.5 || (a.fade ?? 1) < 0.5) continue; v[i++].set(a.pos.x + a.off.x, a.pos.y, a.pos.z + a.off.y, 1); }
  for (; i < v.length; i++) v[i].w = 0;
}
const TROD = `vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  #endif
  vec4 wq = modelMatrix * mvPosition; vec3 root = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  float press = 0.0; vec2 away = vec2(1.0, 0.0);
  for (int i = 0; i < 16; i++) { vec4 st = uSteps[i]; if (st.w < 0.5) break;   // (filled from the front) each blade by where it stands (not its tuft's root): a clear patch round the feet
    vec2 d = (wq.xz - st.xz) * vec2(1.0, 1.4); float l = length(d), k = (1.0 - smoothstep(0.12, 0.42, l)) * (1.0 - step(0.6, abs(root.y - st.y)));   // (squashed in depth: the patch shows either side of the sprite)
    if (k > press) { press = k; away = l > 0.001 ? normalize(wq.xz - st.xz) : vec2(1.0, 0.0); } }
  float up = max(0.0, wq.y - root.y);
  wq.y = root.y + up * (1.0 - 0.5 * press); wq.xz += away * up * press * 0.35;   // flattened and laid outward from the feet
  #ifdef USE_COLOR
  vColor *= 1.0 - 0.1 * press;
  #endif
  mvPosition = viewMatrix * wq;
  gl_Position = projectionMatrix * mvPosition;`;
// grass blades on a canvas: about 140 tapering blades in several greens, each darker at its root and lit at its tip,
// with a pale midrib; a few bend over; some carry a seed head. Soft edges, so the alpha cut stays smooth (alpha)
const BLADES = new Map();
function bladeTex(cols) {
  const k = cols.join(); if (BLADES.has(k)) return BLADES.get(k);
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), r = Math.min(255, (n >> 16) * f), gg = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f); return `rgb(${r | 0},${gg | 0},${b | 0})`; };
  for (let i = 0; i < 120; i++) {
    const back = i < 40, x = 14 + Math.random() * (W - 28), hgt = (back ? 0.55 : 0.7) * H + Math.random() * 0.3 * H, lean = (Math.random() - 0.5) * 90 * (Math.random() < 0.2 ? 2 : 1), w = 3 + Math.random() * 4;
    const col = cols[i % cols.length], tx = x + lean, ty = H - hgt + (Math.abs(lean) > 70 ? Math.abs(lean) * 0.5 : 0);
    const gr = g.createLinearGradient(0, H, 0, ty); gr.addColorStop(0, shade(col, back ? 0.62 : 0.72)); gr.addColorStop(0.5, shade(col, back ? 0.88 : 1.02)); gr.addColorStop(1, shade(col, back ? 1.05 : 1.28));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x + lean * 0.25 - w * 0.4, H - hgt * 0.55, tx, ty); g.quadraticCurveTo(x + lean * 0.25 + w * 0.4, H - hgt * 0.55, x + w, H); g.fill();
    if (!back) { g.strokeStyle = shade(col, 1.45); g.globalAlpha = 0.35; g.lineWidth = 1; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.25, H - hgt * 0.55, tx, ty); g.stroke(); g.globalAlpha = 1; }   // the midrib
    if (!back && Math.random() < 0.12) {   // a seed head at the tip
      g.fillStyle = shade(col, 1.25); for (let s = 0; s < 6; s++) { g.beginPath(); g.ellipse(tx + (Math.random() - 0.5) * 6, ty + s * 4, 2.2, 3.5, lean * 0.01, 0, 6.3); g.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; BLADES.set(k, t); return t;
}
// a clump: four crossed cards, each bent outward over three rows, normals turned up (lit as one tuft, not card by card)
// and a vertex shade from dark at the root to full at the tip
let TUFT = null;
function tuftGeo() {
  if (TUFT) return TUFT;
  const parts = [0, 1, 2, 3].map(k => {
    const q = new THREE.PlaneGeometry(1, 1, 1, 3); q.translate(0, 0.5, 0);
    const p = q.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + y * y * 0.18); }   // bent outward with height
    q.rotateY(k * Math.PI / 4); return q;
  });
  const geo = mergeSimple(parts, true), p = geo.attributes.position, n = new Float32Array(p.count * 3), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), z = p.getZ(i), l = Math.hypot(x, z) || 1;
    n[i * 3] = x / l * 0.35; n[i * 3 + 1] = 1; n[i * 3 + 2] = z / l * 0.35;
    const v = 0.72 + 0.28 * Math.min(1, y * 1.15); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3)); geo.normalizeNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (TUFT = geo);
}
export function grass(pts, o = {}) {
  const tex = bladeTex(o.cols || ['#5a7a2a', '#7a9a3a', '#4a6a22', '#8aa848', '#6a7a30']);
  const geo = tuftGeo();
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.82, vertexColors: true, color: o.color ?? 0xffffff });
  sway(mat, 1);
  const swayed = mat.onBeforeCompile;   // both faces keep the tuft's upward normal (a double-sided material flips it on the back face: dark cores)
  mat.onBeforeCompile = sh => { swayed(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal *= faceDirection;');
    sh.uniforms.uSteps = STEP.uSteps; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec4 uSteps[16];').replace('#include <project_vertex>', TROD); };
  mat.customProgramCacheKey = () => 'grassTuft2';
  // in chunks of 6 x 6 cells, each its own instanced mesh with its own bounds, so the camera skips those out of view
  // (battle 8's meadow is ~100k tufts: drawn as one mesh, every one of them went through the GPU each frame)
  const CH = 6, chunks = new Map();
  for (const p of pts) { const k = Math.floor(p[0] / CH) + ',' + Math.floor(p[2] / CH); (chunks.get(k) || chunks.set(k, []).get(k)).push(p); }
  const out = new THREE.Group(), d = new THREE.Object3D(), c = new THREE.Color();
  // drawn before the characters (render order 2) and without writing depth: a unit standing in grass shows whole
  // over it, as the original's sprites do; the ground and rocks still hide the grass behind them
  mat.depthWrite = false;
  for (const list of chunks.values()) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z], i) => {
      const s = (o.size ?? 0.45) * (0.6 + Math.random() * 0.7); d.position.set(x, y - 0.02, z); d.rotation.set(0, Math.random() * 6.3, 0); d.scale.set(s * 1.25, s * 0.7, s * 1.25); d.updateMatrix(); m.setMatrixAt(i, d.matrix);   // 30% shorter [the user's request]
      const t = (0.8 + Math.random() * 0.4) * 0.7, warm = Math.random() * 0.06; m.setColorAt(i, c.setRGB(t + warm, t, t * (0.88 - warm)));   // 30% darker [the user's request]
    });
    m.computeBoundingSphere(); m.renderOrder = 1;
    m.onBeforeRender = renderer => fillSteps(renderer);
    m.receiveShadow = true; m.userData.noAO = true; out.add(m);
  }
  out.userData.noAO = true; return out;
}
// stones: lumpy displaced icosahedra in rock material. None stands taller than o.maxH over the ground it lies on (0.18:
// ankle-high, stood among; a random turn could stand the largest on end, into a body's height: tools/qa/sets.js)
export function stones(pts, mat, o = {}) {
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 0.75 + 0.5 * T.fbm((v.x + 1) / 2, (v.z + 1) / 2, 3, 2, 7); p.setXYZ(i, v.x * k, v.y * k * 0.6, v.z * k); }
  geo.computeVertexNormals();
  const m = new THREE.InstancedMesh(geo, mat, pts.length), d = new THREE.Object3D(), v = new THREE.Vector3(), maxH = o.maxH ?? 0.18;
  const top = () => { d.updateMatrix(); let t = -Infinity; for (let j = 0; j < p.count; j++) t = Math.max(t, v.fromBufferAttribute(p, j).applyMatrix4(d.matrix).y); return t; };
  pts.forEach(([x, y, z], i) => { const s = (o.size ?? 0.12) * (0.5 + Math.random()); d.position.set(x, y + s * 0.15, z); d.rotation.set(Math.random(), Math.random() * 6, Math.random()); d.scale.set(s, s, s * (0.7 + Math.random() * 0.6));
    const h = top() - y; if (h > maxH) { const f = maxH / h; d.scale.multiplyScalar(f); d.position.y = y + (d.position.y - y) * f; }
    d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
  return shade(m);
}
// leaf texture: clusters of small leaves (alpha), for shrubs and tree crowns
export function leafTex(cols) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 420; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 110, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 6 + Math.random() * 9, ang = Math.random() * 6.28;
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = cols[(Math.random() * cols.length) | 0];
    g.beginPath(); g.ellipse(0, 0, s, s * 0.42, 0, 0, 6.28); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a foliage clump: a dozen leaf cards on a sphere, normals pointing outward (soft, rounded shading)
export function clumpGeo(n = 12) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const q = new THREE.PlaneGeometry(1.1, 1.1), dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.2, Math.random() - 0.5).normalize();
    q.lookAt(dir); q.translate(dir.x * 0.35, dir.y * 0.35, dir.z * 0.35);
    const nn = q.attributes.normal; for (let k = 0; k < nn.count; k++) { const v = new THREE.Vector3(q.attributes.position.getX(k), q.attributes.position.getY(k), q.attributes.position.getZ(k)).normalize(); nn.setXYZ(k, v.x, v.y, v.z); }
    parts.push(q);
  }
  return mergeSimple(parts, true);
}
export function shrubs(pts, o = {}) {
  const tex = o.tex || leafTex(o.cols || ['#2f4a1e', '#3e5e26', '#4f7230', '#26401a']);   // (o.tex: a set's own leaves)
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: o.color ?? 0xffffff });
  sway(mat, 0.3);
  const m = new THREE.InstancedMesh(clumpGeo(14), mat, pts.length), d = new THREE.Object3D(), c = new THREE.Color();
  pts.forEach(([x, y, z], i) => { const s = (o.size ?? 0.5) * (0.6 + Math.random() * 0.8); d.position.set(x, y + s * 0.3, z); d.rotation.set(0, Math.random() * 6, 0); d.scale.set(s, s * 0.75, s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); const t = 0.7 + Math.random() * 0.5; m.setColorAt(i, c.setRGB(t, t, t)); });
  m.castShadow = true; m.receiveShadow = true;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return m;
}
// pines: a leaning trunk and tiers of foliage clumps; one merged geometry per part, instanced
export function pines(pts, o = {}) {
  const g = new THREE.Group(), trunkMat = T.material(T.bark(o.bark ?? 0x4a3a2a), {}, [1, 2]);
  const tex = leafTex(o.cols || ['#1e3a24', '#2a4a2c', '#36583a', '#18301c']);
  const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: o.color ?? 0xffffff });
  sway(leafMat, 0.15);
  const trunk = new THREE.CylinderGeometry(0.05, 0.11, 1, 7, 4); trunk.translate(0, 0.5, 0);
  const tiers = []; for (let k = 0; k < 4; k++) { const c = clumpGeo(10); c.scale(1.3 - k * 0.25, 0.45, 1.3 - k * 0.25); c.translate((Math.random() - 0.5) * 0.2, 0.55 + k * 0.32, 0); tiers.push(c); }
  const crown = mergeSimple(tiers, true);
  const tm = new THREE.InstancedMesh(trunk, trunkMat, pts.length), cm = new THREE.InstancedMesh(crown, leafMat, pts.length), d = new THREE.Object3D(), c = new THREE.Color();
  pts.forEach(([x, y, z], i) => {
    const s = (o.size ?? 2) * (0.7 + Math.random() * 0.6); d.position.set(x, y - 0.05, z); d.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * 6, (Math.random() - 0.5) * 0.15); d.scale.setScalar(s); d.updateMatrix();
    tm.setMatrixAt(i, d.matrix); cm.setMatrixAt(i, d.matrix); const t = 0.75 + Math.random() * 0.4; cm.setColorAt(i, c.setRGB(t, t, t));
  });
  for (const m of [tm, cm]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  cm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return g;
}
export function mergeSimple(geos, keepNormals) {
  const P = [], N = [], U = [], I = []; let off = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); U.push(u.getX(i), u.getY(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) I.push(i + off);
    off += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); m.setIndex(I);
  void keepNormals; return m;
}
// bamboo: tall culms (green canes, a pale ring at every node) leaning a little, sprays of narrow drooping leaves on their
// upper half; pts: [x, y, z, height]. A grove reads as a wall of green with dark gaps between the canes
let BAMBOO = null;
function bambooTex() {
  if (BAMBOO) return BAMBOO;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#3c6a1c'); gr.addColorStop(0.35, '#86b840'); gr.addColorStop(0.6, '#6a9a30'); gr.addColorStop(1, '#2e5214');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 64) { g.fillStyle = 'rgba(230,240,190,0.75)'; g.fillRect(0, y, 64, 4); g.fillStyle = 'rgba(30,50,10,0.5)'; g.fillRect(0, y + 4, 64, 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,70,20,0.25)'; g.fillRect(Math.random() * 64, Math.random() * 256, 1, 20 + Math.random() * 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const l = document.createElement('canvas'); l.width = 256; l.height = 256; const h = l.getContext('2d');
  for (let i = 0; i < 60; i++) {   // leaves from a twig across the card, hanging down and out
    const x0 = 20 + Math.random() * 216, y0 = 30 + Math.random() * 120, ang = Math.PI * (0.25 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2, len = 40 + Math.random() * 46;
    h.save(); h.translate(x0, y0); h.rotate(ang - Math.PI / 2); h.fillStyle = ['#3e7020', '#5a9030', '#2c5418', '#6aa438'][i % 4];
    h.beginPath(); h.moveTo(0, 0); h.quadraticCurveTo(7, len * 0.4, 0, len); h.quadraticCurveTo(-7, len * 0.4, 0, 0); h.fill(); h.restore();
  }
  const lt = new THREE.CanvasTexture(l); lt.colorSpace = THREE.SRGBColorSpace;
  return (BAMBOO = { cane: t, leaf: lt });
}
export function bamboo(pts, o = {}) {
  const tx = bambooTex(), g = new THREE.Group();
  const caneGeo = new THREE.CylinderGeometry(0.03, 0.036, 1, 7, 1, true); caneGeo.translate(0, 0.5, 0);
  const caneMat = new THREE.MeshStandardMaterial({ map: tx.cane, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide });
  sway(caneMat, 0.12);
  const sprays = new THREE.PlaneGeometry(1, 0.8); sprays.translate(0, -0.15, 0);
  const sp2 = sprays.clone().rotateY(Math.PI / 2), leafGeo = mergeSimple([sprays, sp2]);
  const leafMat = new THREE.MeshStandardMaterial({ map: tx.leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: o.color ?? 0xffffff });
  sway(leafMat, 0.25);
  const canes = [], leaves = [];
  for (const [x, y, z, hh] of pts) {
    const n = 2 + (Math.random() * 2 | 0);
    for (let k = 0; k < n; k++) {
      const cx = x + (Math.random() - 0.5) * 0.35, cz = z + (Math.random() - 0.5) * 0.35, h = hh * (0.75 + Math.random() * 0.4), lean = (Math.random() - 0.5) * 0.12;
      canes.push({ x: cx, y: y - 0.05, z: cz, h, lean, r: 0.8 + Math.random() * 0.5 });
      for (let s = 0; s < Math.round(h * 1.6); s++) { const f = 0.45 + Math.random() * 0.55; leaves.push({ x: cx + Math.sin(lean) * h * f + (Math.random() - 0.5) * 0.2, y: y + h * f, z: cz + (Math.random() - 0.5) * 0.2, s: 0.5 + Math.random() * 0.45, ry: Math.random() * 6.3 }); }
    }
  }
  const cm = new THREE.InstancedMesh(caneGeo, caneMat, canes.length), lm = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length), d = new THREE.Object3D(), c = new THREE.Color();
  canes.forEach((s, i) => { d.position.set(s.x, s.y, s.z); d.rotation.set(s.lean * 0.6, 0, s.lean); d.scale.set(s.r, s.h, s.r); d.updateMatrix(); cm.setMatrixAt(i, d.matrix); tx.cane.repeat.set(1, 1); const t = 0.8 + Math.random() * 0.35; cm.setColorAt(i, c.setRGB(t * 0.95, t, t * 0.8)); });
  leaves.forEach((l, i) => { d.position.set(l.x, l.y, l.z); d.rotation.set(0, l.ry, 0); d.scale.setScalar(l.s); d.updateMatrix(); lm.setMatrixAt(i, d.matrix); const t = 0.7 + Math.random() * 0.45; lm.setColorAt(i, c.setRGB(t, t, t * 0.85)); });
  for (const m of [cm, lm]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  lm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tx.leaf, alphaTest: 0.45 });
  return g;
}
