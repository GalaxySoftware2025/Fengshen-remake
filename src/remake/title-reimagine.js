// The title, reimagined (#title=reimagine): an experiment in the art direction, shown beside the game's title (src/remake
// title.js, the original's world-map pan), not in its place. 封神台 at dawn: the altar of the Investiture on the last peak
// standing out of a sea of cloud, the 封神榜 hanging over it in a column of light, souls rising to it out of the cloud as
// motes; the sun just up behind it, the other peaks fading into the haze, cranes crossing now and then. The camera drifts
// in on arrival and then sways slowly (no loop to hide). Over it (overlay below): the title in gold leaf straight on the
// sky, no scroll; a cinnabar seal; the menu with a pearl of light for a pointer.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, shade, ding } from '../kit/parts.js';
import { craneBird, flap } from './title.js';
import { clumpGeo, leafTex, mergeSimple } from '../kit/terrain.js';

export const W = 24, H = 16;   // the board loaded under it (nothing stands on it): the sun's shadow box is centred here
const C = { x: 12, z: 6 };     // the altar's middle
const CLOUD = -15, SUN = new THREE.Vector3(-0.56, 0.06, -1).normalize();   // the sun just clear of the cloud, left of the title
const U = { uTime: { value: 0 } };
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm3 = (x, y, z, o = 4) => { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += vn3(x, y, z) * a; n += a; x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 4.1; a *= 0.5; } return s / n; };

// ---------------------------------------------------------------- the sky at dawn
// indigo overhead, rose then gold toward the horizon, white-gold round the sun; a few streaks of high cloud lit pink from
// below; the last stars where the sky is still dark
function sky(S) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: U.uTime, uSun: { value: SUN }, uFog: { value: S.fog ? S.fog.color : new THREE.Color(1, 0.7, 0.5) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uSun, uFog; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vD); float up = clamp(d.y, 0.0, 1.0), s = max(dot(d, uSun), 0.0);
        vec3 zen = vec3(0.035, 0.045, 0.16), mid = vec3(0.22, 0.13, 0.3), low = vec3(0.95, 0.42, 0.26), hor = vec3(1.0, 0.72, 0.42);
        vec3 col = mix(hor, low, smoothstep(0.0, 0.08, up)); col = mix(col, mid, smoothstep(0.04, 0.16, up)); col = mix(col, zen, smoothstep(0.14, 0.5, up));
        col = mix(col, col * vec3(0.55, 0.6, 0.95), (1.0 - smoothstep(-0.2, 0.6, dot(normalize(d.xz), normalize(uSun.xz)))) * 0.5);   // away from the sun the dawn is cooler
        col += vec3(1.0, 0.62, 0.3) * pow(s, 6.0) * 0.6 + vec3(1.0, 0.85, 0.6) * pow(s, 60.0) * 1.2 + vec3(1.0, 0.95, 0.85) * pow(s, 900.0) * 6.0;
        col = mix(col, uFog, smoothstep(0.06, 0.0, d.y));   // the haze over the cloud at the horizon, as the fog paints the far cloud
        col += vec3(1.0, 0.62, 0.3) * pow(s, 6.0) * 0.5 * smoothstep(0.06, 0.0, d.y);
        float streak = n3(vec3(d.x * 3.0, d.y * 26.0, d.z * 3.0) + vec3(uTime * 0.004, 0.0, 0.0)) * 0.7 + n3(d * 11.0) * 0.3;
        float band = smoothstep(0.05, 0.12, up) * smoothstep(0.42, 0.18, up);
        col = mix(col, mix(vec3(1.0, 0.55, 0.45), vec3(1.0, 0.85, 0.6), pow(s, 3.0)) * (0.7 + 0.5 * s), smoothstep(0.58, 0.78, streak) * band * 0.75);
        vec3 g = floor(d * 240.0); float st = h(g), tw = 0.6 + 0.4 * sin(uTime * (1.0 + 3.0 * st) + st * 50.0);
        col += vec3(0.85, 0.9, 1.0) * step(0.992, st) * smoothstep(0.5, 0.0, length(fract(d * 240.0) - 0.5)) * tw * smoothstep(0.35, 0.8, up) * (1.0 - s);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), m); dome.position.set(C.x, 0, C.z); dome.renderOrder = -10; dome.userData.noRange = true; S.add(dome);
  const sunAt = SUN.clone().multiplyScalar(260).add(new THREE.Vector3(C.x, 0, C.z));
  for (const [k, o, col] of [[90, 0.45, 0xffa860], [24, 0.9, 0xfff0d0]]) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: o, fog: false }));
    g.position.copy(sunAt); g.scale.setScalar(k); g.renderOrder = -9; S.add(g);
  }
}
let glowT = null;
function glowTexture() {
  if (glowT) return glowT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (glowT = new THREE.CanvasTexture(c));
}

// ---------------------------------------------------------------- the sea of cloud
// the floor lit (the peaks' shadows fall on it): lavender in its hollows, peach and gold on the swells, brightest toward
// the sun where the light comes through; two thin veils drifting over it
function cloudMaterial(layer) {
  const m = layer === 0 ? new THREE.MeshLambertMaterial({ color: 0xffffff }) : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uSun = { value: SUN };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime; uniform vec3 uSun;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }
      float cf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += cn(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float L = ${layer.toFixed(1)}, t = uTime;
      vec2 p = vWp.xz * (0.08 + L * 0.05) + vec2(t * 0.014, t * 0.006) * (1.0 + L * 0.7) + L * 13.7;
      vec2 q = vec2(cf(p + vec2(0.0, t * 0.01)), cf(p + vec2(5.2, 1.3) - t * 0.008));
      float n = cf(p + q * 1.6), e = 0.05, nx = cf(p + vec2(e, 0.0) + q * 1.6), nz = cf(p + vec2(0.0, e) + q * 1.6);
      vec3 N = normalize(vec3(-(nx - n) / e * 0.9, 1.0, -(nz - n) / e * 0.9));
      float lit = clamp(dot(N, normalize(uSun + vec3(0.0, 0.35, 0.0))), 0.0, 1.0), puff = smoothstep(0.28, 0.8, n);
      vec3 V = normalize(vWp - cameraPosition); float fwd = pow(max(dot(normalize(vec3(V.x, 0.0, V.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0), 4.0);
      vec3 col = mix(vec3(0.3, 0.26, 0.42), vec3(0.86, 0.66, 0.62), puff) + vec3(1.0, 0.7, 0.4) * pow(lit, 3.0) * puff * 0.55;
      col += vec3(1.0, 0.72, 0.42) * fwd * (0.25 + 0.5 * (1.0 - puff));
      diffuseColor.rgb = col * (L < 0.5 ? 0.62 : 1.0); vec3 kCloud = col;
      diffuseColor.a = L < 0.5 ? 1.0 : smoothstep(0.5, 0.82, n) * (L < 1.5 ? 0.45 : 0.25);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = kCloud * 0.45;');
  };
  m.customProgramCacheKey = () => 'trCloud' + layer;
  return m;
}

// ---------------------------------------------------------------- the peaks
// a karst pillar out of the cloud: rings jagged by noise, fluted by vertical gullies, stepped by ledges, leaning a
// little; a flat crown for the altar's peak, a rounded knoll elsewhere. Vertex colours: mossed toward the top, cold and
// dark toward the cloud. Cylindrical UVs in world units, so the rock texture keeps its scale on every peak.
function peak(mat, x, z, r0, r1, top, seed, flat = false) {
  const segA = 64, segY = 56, bot = CLOUD - 4, P = [], UV = [], CO = [], I = [];
  const lx = (R(seed) - 0.5) * 0.08, lz = (R(seed + 1) - 0.5) * 0.08;
  for (let j = 0; j <= segY; j++) {
    const f = j / segY, y0 = bot + (top - bot) * f;
    const dome = flat ? 1 : f < 0.88 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.88) / 0.12, 2)));
    for (let i = 0; i <= segA; i++) {
      const a = i / segA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let r = (r0 + (r1 - r0) * Math.pow(f, 0.7)) * dome;
      r *= 0.72 + 0.62 * fbm3(ca * 1.4 + seed, y0 * 0.12, sa * 1.4 + seed * 2);   // buttresses and bays
      const gully = 1 - Math.abs(2 * fbm3(ca * 6 + seed, y0 * 0.05, sa * 6, 3) - 1);
      r *= 0.86 + 0.24 * gully;                                                  // ribs and gullies running down the face
      r *= 1 + 0.035 * Math.sin(y0 * 2.6 + fbm3(ca * 2, y0 * 0.3, sa * 2) * 7);  // bedding
      r *= 1 + 0.07 * Math.floor(fbm3(ca + seed, y0 * 0.45, sa) * 4) / 4;        // ledges
      if (flat && f > 0.975) r *= 1 + (f - 0.975) * 4;   // the crown's lip
      const Y = j === segY ? top : y0 + (fbm3(ca * 3 + seed, y0, sa * 3) - 0.5) * 0.25;
      P.push(x + ca * r + lx * (Y - bot), Y, z + sa * r + lz * (Y - bot)); UV.push(a * r0 * 0.4, y0 * 0.4);
      const moss = Math.max(0, f - 0.7) / 0.3 * (0.5 + 0.5 * fbm3(ca * 4, y0 * 2, sa * 4)), low = Math.min(1, Math.max(0, (CLOUD + 6 - Y) / 8));
      const k = 0.62 + 0.38 * gully;   // the gullies dark, the ribs catching the light
      CO.push(k * (1 - moss * 0.45 - low * 0.35), k * (1 - moss * 0.2 - low * 0.32), k * (1 - moss * 0.5 - low * 0.18));
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + segA + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const c0 = P.length / 3, ring = segY * (segA + 1); P.push(x + lx * (top - bot), top + (flat ? 0 : 0.1), z + lz * (top - bot)); UV.push(0, 0); CO.push(0.6, 0.75, 0.5);
  for (let i = 0; i < segA; i++) I.push(c0, ring + i + 1, ring + i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(CO, 3)); g.setIndex(I); g.computeVertexNormals();
  return shade(new THREE.Mesh(g, mat));
}
// pines leaning out from the crowns and ledges (after the 崑崙 set's): flat pads of needles on a crooked trunk
function pines(S, pts) {
  const trunkMat = T.material(T.bark(0x4a3a2c), {}, [1, 2]), tex = leafTex(['#1c3424', '#28462e', '#36583a', '#162c1c']);
  const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const trunk = new THREE.CylinderGeometry(0.035, 0.08, 1, 7, 4); trunk.translate(0, 0.5, 0);
  const pads = []; for (let k = 0; k < 5; k++) { const c = clumpGeo(9), a = k * 2.4, r = k < 4 ? 0.3 - k * 0.04 : 0; c.scale(0.8 - k * 0.09, 0.2, 0.8 - k * 0.09); c.translate(Math.cos(a) * r, 0.6 + k * 0.17, Math.sin(a) * r); pads.push(c); }
  const crown = mergeSimple(pads, true);
  const tm = new THREE.InstancedMesh(trunk, trunkMat, pts.length), cm = new THREE.InstancedMesh(crown, leafMat, pts.length), m = new THREE.Matrix4(), q = new THREE.Matrix4(), ax = new THREE.Vector3();
  pts.forEach(([x, y, z, s, lean, dir], i) => { ax.set(Math.sin(dir), 0, -Math.cos(dir));
    m.makeTranslation(x, y - 0.05, z).multiply(q.makeRotationAxis(ax, lean)).multiply(q.makeRotationY(R(i * 3.1) * 6.28)).multiply(q.makeScale(s, s, s)); tm.setMatrixAt(i, m); cm.setMatrixAt(i, m); });
  for (const o of [tm, cm]) { o.castShadow = o.receiveShadow = true; S.add(o); }
  cm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
}
// banks of cloud heaped on the sea and wrapped round the peaks' waists: soft billows, lit gold on top, lavender beneath
function cloudTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 58 + R(i) * 140, y = 100 + (R(i + 40) - 0.5) * 20 - Math.sin((x - 58) / 140 * Math.PI) * 30, r = 16 + R(i + 80) * 18;   // (every puff inside the canvas: no cut edge)
    const gr = g.createRadialGradient(x, y - r * 0.35, 0, x, y, r); gr.addColorStop(0, 'rgba(255,238,220,1)'); gr.addColorStop(0.5, 'rgba(240,206,196,0.85)'); gr.addColorStop(0.8, 'rgba(214,180,186,0.35)'); gr.addColorStop(1, 'rgba(214,180,186,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function banks(E, S, peaks) {
  const tex = cloudTex(), list = [];
  const put = (x, y, z, w, tint) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, depthWrite: false, opacity: 0.92 }));
    // (its foot on the sea: the sea's plane never cuts it)
    sp.position.set(x, y + w * 0.62 * 0.25, z); sp.scale.set(w, w * 0.62, 1); S.add(sp); list.push({ sp, x, ph: R(x * 3.3 + z) * 6.28 }); };
  for (let i = 0; i < 70; i++) {   // the sea's billows, from just below the altar out to the haze
    const a = R(i * 1.7) * Math.PI * 2, d = 12 + Math.pow(R(i * 2.9), 0.7) * 130;
    put(C.x + Math.cos(a) * d, CLOUD + R(i * 4.1) * 1.0, C.z + Math.sin(a) * d * 0.9, 8 + R(i * 5.3) * 18, new THREE.Color(1, 0.94 + R(i) * 0.06, 0.92));
  }
  for (const [x, z, r] of peaks) for (let k = 0; k < 3; k++) {   // a wreath across each peak's waist, on the camera's side (clear of the rock)
    const a = Math.PI * (0.3 + 0.4 * R(x + k * 7.1)); put(x + Math.cos(a) * r * 1.8, CLOUD + 1 + R(z + k) * 2.5, z + Math.sin(a) * r * 1.8, r * 2 + 3, new THREE.Color(0.95, 0.88, 0.9));
  }
  E.world.updaters.push((dt, t) => { for (const c of list) c.sp.position.x = c.x + Math.sin(t * 0.03 + c.ph) * 1.5; });
}

// ---------------------------------------------------------------- 封神台
// three tiers of white marble with gilt rims and balusters, a stair up the front of each, a bronze 鼎 on the top tier,
// a 華表 each side of the foot of the stair and four long banners at the corners
function altar(E, S, M) {
  const stone = T.material(T.marble(0xece6dc, 0x9a8c7c), { envMapIntensity: 0.6 });
  const TIERS = [[5.4, 0, 0.42], [4.0, 0.42, 0.84], [2.8, 0.84, 1.26]];
  for (const [w, y0, y1] of TIERS) {
    const h = w / 2;
    S.add(box(stone, C.x - h, y0, C.z - h, C.x + h, y1, C.z + h, 1));
    S.add(box(M.gold, C.x - h - 0.02, y1 - 0.06, C.z - h - 0.02, C.x + h + 0.02, y1 - 0.02, C.z + h + 0.02, 2));   // a gilt band under the edge
    // balusters along the rims (a gap at the front for the stair) and the rail through them
    const e = h - 0.1, posts = [], step = (2 * e) / Math.round(2 * e / 0.45);
    for (let s = -e; s <= e + 1e-6; s += step) {
      posts.push([C.x + s, C.z - e], [C.x - e, C.z + s], [C.x + e, C.z + s]);
      if (Math.abs(s) > 0.75) posts.push([C.x + s, C.z + e]);
    }
    for (const [px, pz] of posts) S.add(box(stone, px - 0.045, y1, pz - 0.045, px + 0.045, y1 + 0.26, pz + 0.045, 4), box(M.gold, px - 0.055, y1 + 0.26, pz - 0.055, px + 0.055, y1 + 0.3, pz + 0.055, 4));
    const rail = (x0, z0, x1, z1) => S.add(box(stone, x0 - 0.03, y1 + 0.2, z0 - 0.03, x1 + 0.03, y1 + 0.24, z1 + 0.03, 4));
    rail(C.x - e, C.z - e, C.x + e, C.z - e); rail(C.x - e, C.z - e, C.x - e, C.z + e); rail(C.x + e, C.z - e, C.x + e, C.z + e);
    rail(C.x - e, C.z + e, C.x - 0.75, C.z + e); rail(C.x + 0.75, C.z + e, C.x + e, C.z + e);
    // the stair: down the front from this tier to the one below (the lowest to the crown)
    const n = 5, run = 0.45, zf = C.z + h;
    for (let k = 0; k < n; k++) S.add(box(stone, C.x - 0.7, y0 + (y1 - y0) * k / n - 0.004, zf + run * (n - 1 - k) / n, C.x + 0.7, y0 + (y1 - y0) * (k + 1) / n - 0.004, zf + run * (n - k) / n, 2));
  }
  const top = TIERS[2][2];
  const d = ding(M, C.x, C.z - 0.3, top, 0.9); S.add(d.g);
  E.vfx && E.world.updaters.push((dt, t) => { if (Math.random() < dt * 5) E.vfx.smoke(C.x + (Math.random() - 0.5) * 0.3, d.rim + 0.1, C.z - 0.3, { vx: 0.05, vy: 0.35, life: 4, size: 0.25, r: 0.75, gg: 0.72, b: 0.7, a: 0.35 }); });
  // the banners: crimson silk, gold-edged, rippling from the top
  const silk = new THREE.MeshStandardMaterial({ color: 0x9a1810, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x2a0402 });
  const banners = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = C.x + sx * 2.5, z = C.z + sz * 2.5, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 4.2, 8), M.lacquer); pole.position.set(x, 0.42 + 2.1, z); S.add(shade(pole));
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), M.gold); fin.position.set(x, 0.42 + 4.3, z); S.add(fin);
    S.add(box(M.gold, x - 0.03, 0.42 + 3.95, z - 0.03, x + sx * 0.5 + 0.03, 0.42 + 4.0, z + 0.03, 4));   // the arm the banner hangs from
    const g = new THREE.PlaneGeometry(0.36, 2.6, 1, 20); g.translate(0, -1.3, 0);
    const b = new THREE.Mesh(g, silk); b.position.set(x + sx * 0.27, 0.42 + 3.93, z); b.castShadow = true; S.add(b);
    banners.push({ b, base: g.attributes.position.array.slice(), ph: sx * 1.3 + sz * 0.7 });
  }
  E.world.updaters.push((dt, t) => {
    for (const { b, base, ph } of banners) {
      const p = b.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = base[i * 3 + 1], f = -y / 2.6; p.setZ(i, Math.sin(t * 2.1 + ph - y * 2.2) * 0.12 * f + 0.25 * f * f); p.setX(i, base[i * 3] + Math.sin(t * 1.4 + ph - y * 1.6) * 0.04 * f); }
      p.needsUpdate = true; b.geometry.computeVertexNormals();
    }
  });
  return top;
}

// ---------------------------------------------------------------- 封神榜
// a hanging scroll of gold paper ruled in cinnabar, the names of the invested in columns read from the right; it hangs in
// a column of light over the altar, breathing; motes rise out of the cloud and wind up into it
const NAMES = ['黃飛虎', '聞仲', '趙公明', '比干', '姜桓楚', '鄧九公', '余化龍', '魏賁', '崇黑虎', '雷鵬', '黃天化', '殷郊', '楊任', '余元', '張奎', '金大升', '羅宣', '呂岳', '孔宣', '殷洪', '鄧嬋玉', '土行孫', '龍吉', '洪錦'];
function bangTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1152; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#d8a640'); gr.addColorStop(0.5, '#f8dc8a'); gr.addColorStop(1, '#d09a38');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 1152);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,70,10,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 1152, 1 + Math.random() * 3, 1 + Math.random() * 18); }
  g.strokeStyle = '#a0201a'; g.lineWidth = 8; g.strokeRect(22, 22, 468, 1108); g.lineWidth = 2.5; g.strokeRect(38, 38, 436, 1076);
  g.fillStyle = '#9a1a12'; g.font = '900 104px "Noto Serif TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['封', '神', '榜'].forEach((ch, i) => g.fillText(ch, 256, 120 + i * 112));
  g.fillRect(70, 452, 372, 4);
  g.fillStyle = '#3a1a08'; g.font = '700 38px "Noto Serif TC", serif';
  for (let col = 0; col < 8; col++) for (let k = 0; k < 3; k++) {
    const name = NAMES[col * 3 + k]; if (!name) continue; const x = 420 - col * 47;
    [...name].forEach((ch, i) => g.fillText(ch, x, 500 + k * 205 + i * 44));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function bang(E, S, M, base) {
  const Y = base + 2.6, w = 1.25, h = 2.8, g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: bangTexture(), side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.15, 1.08, 0.95) }));
  g.add(paper);
  for (const y of [h / 2 + 0.05, -h / 2 - 0.05]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, w + 0.2, 16).rotateZ(Math.PI / 2), M.lacquerDark); rod.position.y = y; g.add(rod);
    for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), M.gold); cap.position.set(sx * (w / 2 + 0.12), y, 0); g.add(cap); }
  }
  g.position.set(C.x, Y, C.z - 0.3); S.add(g);
  // the halo behind it and the column of light it hangs in
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd890, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
  halo.position.set(C.x, Y, C.z - 0.6); halo.scale.set(5.5, 6.5, 1); S.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 60, 32, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: U.uTime },
    vertexShader: 'varying vec2 vU; varying vec3 vN, vV; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; varying vec2 vU; varying vec3 vN, vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5), y = vU.y;
        float a = edge * smoothstep(0.0, 0.03, y) * pow(1.0 - y, 1.6) * (0.75 + 0.25 * sin(y * 90.0 - uTime * 2.0)) * 0.42;
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, a); }` }));
  beam.position.set(C.x, base + 30, C.z - 0.3); beam.userData.noRange = true; S.add(beam);
  // souls: motes rising out of the cloud from every side, drawn in to the scroll as they climb
  const N = 220, pos = new Float32Array(N * 3), st = Array.from({ length: N }, (_, i) => ({ a: R(i) * 6.283, r: 4 + R(i + 99) * 14, y: CLOUD + R(i + 7) * (Y - CLOUD), v: 0.25 + R(i + 3) * 0.35, w: (R(i + 5) - 0.5) * 0.5 }));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffe2a0, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.frustumCulled = false; S.add(pts);
  E.world.updaters.push((dt, t) => {
    U.uTime.value = t;
    g.position.y = Y + Math.sin(t * 0.7) * 0.06; g.rotation.y = Math.sin(t * 0.23) * 0.05; halo.material.opacity = 0.75 + 0.12 * Math.sin(t * 1.1);
    for (let i = 0; i < N; i++) {
      const s = st[i], f = Math.min(1, Math.max(0, (s.y - CLOUD) / (Y - CLOUD)));
      s.y += s.v * dt * (1 + f); s.a += (s.w + 0.15) * dt * (0.3 + f * 1.5);
      const r = s.r * Math.pow(1 - f, 1.4) + 0.2;
      if (f >= 1) { s.y = CLOUD + 0.2; s.r = 4 + Math.random() * 14; s.a = Math.random() * 6.283; }
      pos[i * 3] = C.x + Math.cos(s.a) * r; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = C.z - 0.3 + Math.sin(s.a) * r * 0.8;
    }
    pg.attributes.position.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- cranes
// a skein crosses the sky in front of the peaks now and then, the other way each time
function cranes(E, S) {
  const V = [[0, 0], [-0.9, 0.7], [-0.9, -0.7], [-1.8, 1.4], [-1.8, -1.4], [-2.7, 2.1]];
  const birds = V.map((v, i) => { const c = craneBird(i); c.v = v; c.b.visible = false; c.b.scale.setScalar(2.2); S.add(c.b); return c; });
  // the first skein [the user's call: early]: in front of the altar, from the right (white on the sun's side is lost in the
  // glare), from just out of the frame and faster (the frame's edge draws back faster than 1.6 a second while the camera flies in): in view at 2 s
  let rel = null, wait = 0.3, dir = -1, Y0 = 5, Z0 = 2, sp = 1.6, first = true;
  E.world.updaters.push((dt, t) => {
    if (rel === null) { if ((wait -= dt) > 0) return; rel = -30; Y0 = 4.5 + Math.random() * 2; Z0 = -2 + Math.random() * 5; sp = 1.6; if (first) { rel = -22.5; Y0 = 4.6; Z0 = 13; sp = 4; first = false; } }
    rel += sp * dt;
    for (const c of birds) {
      flap(c, dt, t); c.b.visible = true; c.b.rotation.y += dir < 0 ? Math.PI : 0;
      c.b.position.set(C.x + dir * (rel + c.v[0] * 1.8), Y0 + Math.sin(t * 0.5 + c.seed) * 0.12 + Math.abs(c.v[1]) * 0.15, Z0 + c.v[1] * 1.8);
    }
    if (rel > 30) { rel = null; wait = 16 + Math.random() * 10; dir = -dir; for (const c of birds) c.b.visible = false; }
  });
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  sky(S);
  [0, 1, 2].forEach(L => { const c = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), cloudMaterial(L)); c.position.set(C.x, CLOUD + L * 0.8, C.z); c.renderOrder = L; c.receiveShadow = L === 0; c.userData.noRange = true; S.add(c); });
  const rock = T.material(T.rock(0x9a8a76, 'trPeak'), { envMapIntensity: 0.5, vertexColors: true }, [1, 1]);
  S.add(peak(rock, C.x, C.z, 7.5, 4.8, 0, 1, true));
  // the other peaks, near to far: [x, z, base radius, crown radius, crown height]
  const others = [[-2, -3, 4.2, 1.6, 1.5], [27, -1, 3.6, 1.3, -1.0], [1, 13, 3.2, 1.2, -4.5], [24, 14, 3.0, 1.0, -3.8], [-15, -20, 5.5, 2.0, 5.5], [36, -24, 6, 2.2, 7.5],
    [-6, -36, 4.5, 1.6, 2.5], [-30, -8, 4.5, 1.8, -0.5], [48, -4, 5, 1.8, 0.5], [19, -50, 7, 2.6, 9], [-26, -48, 7, 2.5, 6], [62, -40, 8, 3, 5], [-50, -30, 8, 3, 3]];
  others.forEach(([x, z, r0, r1, top], i) => S.add(peak(rock, x, z, r0, r1, top, 10 + i * 3.7)));
  pines(S, [[C.x - 4.3, 0, C.z + 2.2, 1.1, 0.5, -1.6], [C.x + 4.4, 0, C.z + 1.2, 1.25, 0.45, 1.5], [C.x + 3.8, 0, C.z - 3.2, 1.0, 0.3, 0.9], [C.x - 3.9, 0, C.z - 2.6, 0.9, 0.35, -0.8],
    [C.x - 2.6, 0, C.z + 3.9, 0.8, 0.6, 3.2], [C.x + 2.9, 0, C.z + 3.7, 0.7, 0.55, 2.6],
    [-2.3, 1.5, -3.2, 1.0, 0.2, 0], [-1.2, 1.4, -2.4, 0.8, 0.3, 1], [27.3, -1.0, -0.8, 0.9, 0.3, 0.4], [1.2, -4.5, 13.1, 0.8, 0.3, 0], [23.9, -3.8, 14.2, 0.7, 0.3, 0.5]]);
  // a few pines on each nearer crown (the knoll's surface: the dome's height at that radius)
  const crowns = [];
  others.slice(0, 9).forEach(([x, z, r0, r1, top], i) => { for (let k = 0; k < 3 + (i % 2); k++) {
    const a = R(i * 9 + k) * 6.28, q = 0.25 + R(i * 5 + k) * 0.4, y = top - (1 - Math.sqrt(1 - q * q)) * 0.12 * (top - CLOUD + 4);
    crowns.push([x + Math.cos(a) * q * r1 * 0.8, y, z + Math.sin(a) * q * r1 * 0.8, 0.7 + R(k + i) * 0.4, q * 0.7, a + Math.PI / 2]); } });
  pines(S, crowns);
  banks(E, S, [[C.x, C.z, 6], ...others.slice(0, 8)]);
  const base = altar(E, S, M);
  bang(E, S, M, base);
  cranes(E, S);
}

// the camera: on arrival it comes in from further out and lower over 9 s, then sways slowly round the altar
const T0 = 9;
export function shot(t) {
  const k = Math.min(1, t / T0), e = 1 - Math.pow(1 - k, 3), s = Math.max(0, t - T0);
  return { target: new THREE.Vector3(C.x, 3.5 - (1 - e) * 2, C.z), dist: 25 + (1 - e) * 12 + Math.sin(s * 0.07) * 0.8, pitch: 0.15 - (1 - e) * 0.08 + Math.sin(s * 0.05) * 0.015, yaw: (1 - e) * -0.3 + Math.sin(s * 0.09) * 0.12, fov: 36 };
}

export default {
  build, ground: () => 0, particles: null,
  mood: { bg: 0xd89a78, voidCol: false, fog: 0xdcaa94, fogD: 0.0055, sky: 0x9aa0d0, under: 0x8a5a4a, hemi: 1.05,
    sun: 0xffb478, sunI: 3.4, sunDir: [-0.6, 0.45, -1], sat: 1.06, exposure: 1.02, bloom: 0.6, aoR: 0.3,
    env: { top: 0x4a4a7a, mid: 0x8a5a50, low: 0x3a2a2a, lights: [[-5, 1.5, -9, 0xffc080, 3]] } },
};

// ---------------------------------------------------------------- the overlay: the title in gold leaf, the seal, the menu
const CSS = `
#title.reimagine { justify-content: space-between; padding: 4vh 0 9vh; background: linear-gradient(to bottom, rgba(12,8,30,.45), transparent 26%, transparent 66%, rgba(16,8,14,.6)); }
#title.reimagine .t-logo, #title.reimagine .t-rays, #title.reimagine .petals { display: none; }
.t2 { width: min(70vw, 860px, 120vh); text-align: center; pointer-events: none; }
.t2 svg { display: block; width: 100%; height: auto; overflow: visible; }
.t2-wipe { animation: t2Wipe 2.4s .6s cubic-bezier(.4,0,.2,1) both; }
@keyframes t2Wipe { from { transform: translateX(-1500px); } to { transform: translateX(0); } }
.t2-shine { animation: t2Shine 7s 3.2s ease-in-out infinite; }
@keyframes t2Shine { 0% { transform: translateX(-700px); } 35%, 100% { transform: translateX(1300px); } }
.t2-seal { transform-box: fill-box; transform-origin: center; animation: t2Seal .5s 2.9s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes t2Seal { from { opacity: 0; transform: scale(1.8); } to { opacity: 1; transform: scale(1); } }
#title.reimagine #t-menu { margin-top: 0; gap: 4px; }
#title.reimagine #t-menu button { font-size: 25px; font-weight: 600; letter-spacing: .7em; text-indent: .7em; color: rgba(255,238,210,.62); text-shadow: 0 2px 12px rgba(0,0,0,.9); transition: color .25s, text-shadow .25s; }
#title.reimagine #t-menu button.on:not(:disabled) { color: #fff4d8; text-shadow: 0 0 18px rgba(255,190,90,.7), 0 2px 10px rgba(0,0,0,.9); }
#title.reimagine #t-menu button::before, #title.reimagine #t-menu button::after { width: 22px; height: 22px; vertical-align: 1px; margin: 0 16px; background: radial-gradient(circle, #fffbea 0 16%, #ffd27a 30%, rgba(255,150,40,.45) 50%, transparent 70%); opacity: 0; transform: scale(.4); transition: opacity .25s, transform .25s; filter: none; }
#title.reimagine #t-menu button.on:not(:disabled)::before, #title.reimagine #t-menu button.on:not(:disabled)::after { opacity: 1; transform: none; animation: t2Pearl 1.8s ease-in-out infinite alternate; }
@keyframes t2Pearl { from { transform: scale(.85); filter: brightness(.9); } to { transform: scale(1.1); filter: brightness(1.25); } }
`;
const GLYPH = 'assets/title/logo-glyphs.png', GX = 150, GY = 50, GW = 900, GH = 900 * 768 / 2661;
const SVG = `<svg viewBox="0 0 1200 380" aria-label="封神英傑傳">
  <defs>
    <mask id="t2-glyph" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="380"><image href="${GLYPH}" x="${GX}" y="${GY}" width="${GW}" height="${GH}" preserveAspectRatio="none"/></mask>
    <linearGradient id="t2-gold" gradientUnits="userSpaceOnUse" x1="0" y1="${GY + 10}" x2="0" y2="${GY + GH - 10}">
      <stop offset="0" stop-color="#fff6d0"/><stop offset=".3" stop-color="#f4d27a"/><stop offset=".55" stop-color="#c88a2c"/><stop offset=".72" stop-color="#8a5412"/><stop offset=".86" stop-color="#d8a648"/><stop offset="1" stop-color="#fbe2a0"/></linearGradient>
    <linearGradient id="t2-glint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="t2-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="t2-reveal" maskUnits="userSpaceOnUse" x="-1600" y="0" width="4400" height="380"><rect class="t2-wipe" x="-200" y="0" width="1500" height="380" fill="url(#t2-edge)"/></mask>
    <filter id="t2-soft" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="t2-bevel" x="0" y="0" width="100%" height="100%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b"/><feSpecularLighting in="b" surfaceScale="3" specularConstant=".9" specularExponent="18" lighting-color="#fff4d8" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3=".55"/></filter>
  </defs>
  <g mask="url(#t2-reveal)">
    <g filter="url(#t2-soft)" opacity=".7"><rect x="0" y="0" width="1200" height="380" fill="#120614" mask="url(#t2-glyph)" transform="translate(0 8)"/></g>
    <rect x="0" y="0" width="1200" height="380" fill="#3a1c06" mask="url(#t2-glyph)" transform="translate(2 4)"/>
    <g filter="url(#t2-bevel)"><rect x="0" y="0" width="1200" height="380" fill="url(#t2-gold)" mask="url(#t2-glyph)"/></g>
    <g mask="url(#t2-glyph)"><rect class="t2-shine" x="0" y="0" width="220" height="380" fill="url(#t2-glint)" transform="skewX(-20)" opacity=".7"/></g>
  </g>
  <g transform="translate(1088 262) rotate(-4)"><g class="t2-seal"><rect x="-26" y="-36" width="52" height="72" rx="3" fill="#b0261a" opacity=".92"/><rect x="-21" y="-31" width="42" height="62" fill="none" stroke="#f6e2c4" stroke-width="2"/>
    <text y="-4" text-anchor="middle" font-size="22" font-weight="900" fill="#f6e2c4" font-family="'Noto Serif TC', serif">重</text><text y="22" text-anchor="middle" font-size="22" font-weight="900" fill="#f6e2c4" font-family="'Noto Serif TC', serif">製</text></g></g>
</svg>`;
export function overlay(title) {
  if (!document.getElementById('t2-css')) { const s = document.createElement('style'); s.id = 't2-css'; s.textContent = CSS; document.head.append(s); }
  title.classList.add('reimagine');
  if (title.querySelector('.t2')) return;
  const d = document.createElement('div'); d.className = 't2'; d.innerHTML = SVG;
  title.insertBefore(d, title.querySelector('#t-menu'));
}
