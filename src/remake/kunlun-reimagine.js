// 崑崙仙山, reimagined (battle 25 as #battle=25-reimagine): an experiment in the art direction. Not the original's tiles
// (src/remake/wanshou.js kunlun remakes those) but the place itself as a modern game would stage it: the immortals'
// mountain at dawn, a stair of sheer stone pillars standing out of a sea of cloud, joined by white-jade bridges, the
// way climbing north from the landing to the summit where the 東方守護靈 keeps the last 古文書 before its stele and gate.
// The board is battle 25's, cell for cell: every open cell is the flat top of a pillar, every blocked one the drop
// between them (fliers cross it at the height of the ground beside them), the five spans the original bridges are
// bridges, its three climbs stairs. The pillars climb from the south: the landing (0.6), the west terraces and the
// eastern pillars (1.3), the high west terrace and the central pillar (2.0), the summit (3.6); a lone crag hangs free in
// the north-east. Each pillar's top is weathered pale granite with patches of alpine turf, its sides sheer, jointed and
// stained, mossed on the ledges, fading into the haze as they fall into the cloud; pines lean out from the rims;
// springs fall from the cliffs into the cloud. Nothing higher stands south of anything lower: the way climbs away from
// the camera, so no cliff hides a unit.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest, shade, box, merged, Levels, stairs as stairBlocks } from '../kit/parts.js';
import { grass, clumpGeo, leafTex, mergeSimple, windTick, stones, shrubs } from '../kit/terrain.js';
import { alt, altAll, ropeBridge, stoneLantern, shrine, balustrade, herbs, herbBed, palace, vines, roots, chain, spray, cranes, ribbons } from './kunlun-reimagine-props.js';
import { D, G } from '../rules.js';

const SR = 8, EXT = 3, VOID = -8, BOT = -10, SEA = -7, K = 40;
const LEVEL = { south: 0.6, mid: 1.3, east: 1.3, isle: 1.3, upper: 2.0, centre: 2.0, summit: 3.6, lone: 3.0 };
const SEEDS = { south: [10, 26], mid: [2, 13], upper: [2, 8], centre: [11, 8], east: [20, 8], isle: [10, 13], summit: [11, 2], lone: [20, 1] };
const BRIDGES = [[8, 6, 9], [8, 15, 18], [13, 6, 9], [14, 16, 19], [27, 15, 18]];   // [row, x0, x1): the original's five spans
// the climbs (north from the lower level): to the summit, and the west terraces' two
const STAIRS = [{ x0: 11, x1: 13, z0: 4, z1: 7, lo: 'centre', hi: 'summit', n: 10 }, { x0: 2, x1: 4, z0: 10, z1: 11, lo: 'mid', hi: 'upper', n: 4 }, { x0: 2, x1: 4, z0: 16, z1: 17, lo: 'south', hi: 'mid', n: 4 }];
const STELE = [11, 1], GATE = [9, 10, 11, 12, 13];   // the stele's cell; the gate's cells on row 0 (behind the summit)
const FALLS = [[0.8, 8.4, 0.9], [10.4, 10.2, 0.8], [24.2, 12.4, 0.75]];   // springs: near this point of a rim, this wide
// the climb, wild to sacred: the low tiers wild mountain (rope bridges, steps hewn in the rock), the middle ones the
// pilgrims' (old paving half lost under the turf, stone lanterns, a roadside shrine), the summit the guardian's precinct
const ZONE = { south: 'wild', mid: 'wild', east: 'wild', isle: 'wild', lone: 'wild', upper: 'path', centre: 'path', summit: 'sacred' };
const LANTERNS = [[10, 6], [13, 6], [6, 7], [6, 9], [15, 7], [15, 9]], SHRINE = [1, 6];   // their cells (blocked: pads beside the way)
const PALACE = [11.5, -7.8, 3.4, 4.6];   // 玉虛宮's peak: x, z, radius, top
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- noise (3D value noise, for the cliffs' crags)
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm3 = (x, y, z, o = 3) => { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += vn3(x, y, z) * a; n += a; x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 4.1; a *= 0.5; } return s / n; };

// ---------------------------------------------------------------- surfaces
// the pillars' tops: weathered pale granite worn flat, broad plates parted by fine joints with a little moss in them,
// lichen here and there (calm: the play view sees it most)
function stoneTex() {
  return T.pbr('krStone7', 1024, (u, v, o) => {
    const n = T.fbm(u, v, 3, 4, 903), m = T.fbm(u, v, 8, 4, 906), grain = T.fbm(u, v, 90, 2, 904);
    const [w0, w1] = T.worley(u, v, 3, 901, 0.9), [q0, q1] = T.worley(u, v, 7, 909, 0.9);
    const crack = Math.max(T.smooth(0.014, 0.0, w1 - w0) * T.smooth(0.45, 0.6, T.fbm(u, v, 5, 3, 902)), T.smooth(0.008, 0.0, q1 - q0) * T.smooth(0.6, 0.72, T.fbm(u, v, 6, 3, 910)) * 0.7);
    const vein = T.smooth(0.012, 0.0, Math.abs(T.fbm(u, v, 2, 4, 911) - 0.5) - 0.002) * T.smooth(0.4, 0.6, T.fbm(u, v, 4, 2, 912));   // (a quartz vein winding through)
    const lich = T.smooth(0.6, 0.76, T.fbm(u, v, 7, 4, 905)), dots = T.smooth(0.8, 0.86, T.fbm(u, v, 40, 2, 913)) * lich, weather = T.smooth(0.5, 0.78, T.fbm(u, v, 5, 4, 908));
    let c = T.mixc([0.55, 0.52, 0.47], [0.7, 0.67, 0.61], n * 0.7 + m * 0.3);
    c = T.mixc(c, [0.45, 0.43, 0.39], weather * 0.5); c = T.mixc(c, [0.64, 0.66, 0.55], lich * 0.35); c = T.mixc(c, [0.78, 0.76, 0.6], dots * 0.5);
    c = T.mixc(c, [0.76, 0.75, 0.72], vein * 0.35);
    c = c.map(q => q * (0.97 + (grain - 0.5) * 0.08)); c = T.mixc(c, [0.3, 0.29, 0.26], crack * 0.6);
    o.c = c; o.h = 0.5 + n * 0.1 - weather * 0.05 - crack * 0.3 + vein * 0.05; o.r = 0.8 + weather * 0.1;
  }, 2);
}
// alpine turf: short grass and moss, olive to fresh green, never saturated
function turfTex() {
  return T.pbr('krTurf2', 512, (u, v, o) => {
    const n = T.fbm(u, v, 5, 4, 911), b = T.pnoise(u * 120, v * 120, 120, 912), m = T.fbm(u, v, 16, 3, 913);
    o.c = T.mixc([0.3, 0.38, 0.17], [0.5, 0.55, 0.27], n * 0.55 + b * 0.3 + m * 0.15); o.h = 0.5 + b * 0.2; o.r = 0.95;
  }, 2);
}
// the cliffs: pale granite in tall jointed columns, darker streaks where water runs down, faint bedding across
function cliffTex() {
  return T.pbr('krCliff5', 1024, (u, v, o) => {
    const wob = T.fbm(u, v, 3, 3, 921) * 0.6, ju = (u * 5 + wob) % 1, jw = 0.46 + T.fbm(u, v, 6, 2, 926) * 0.05, joint = T.smooth(0.04, 0.0, Math.abs(ju - 0.5) - jw) * T.smooth(0.3, 0.55, T.fbmA(u, v, 4, 14, 2, 927));
    const col = Math.floor(u * 5 + wob), tone = R(col * 3.7 + 1) * 0.1, streak = T.fbmA(u, v, 36, 3, 4, 922), stain = T.smooth(0.5, 0.78, T.fbmA(u, v, 8, 2, 3, 923));
    const n = T.fbm(u, v, 10, 4, 925), grain = T.pnoise(u * 200, v * 200, 200, 928);
    let c = T.mixc([0.42, 0.41, 0.39], [0.62, 0.6, 0.55], n * 0.5 + streak * 0.35 + 0.15 - tone);
    c = T.mixc(c, [0.27, 0.28, 0.28], stain * 0.5); c = T.mixc(c, [0.2, 0.2, 0.2], joint * 0.6);
    c = c.map(q => q * (0.94 + grain * 0.1));
    o.c = c; o.h = 0.5 + (n - 0.5) * 0.3 + streak * 0.15 - joint * 0.35 - tone; o.r = 0.9;
  }, 4);
}
const BUMP_GLSL = `
  vec3 krDx = dFdx(-vViewPosition), krDy = dFdy(-vViewPosition); float krHx = dFdx(krH), krHy = dFdy(krH);
  vec3 krR1 = cross(krDy, normal), krR2 = cross(normal, krDx); float krDet = dot(krDx, krR1);
  normal = normalize(abs(krDet) * normal - sign(krDet) * (krHx * krR1 + krHy * krR2) * uBump);`;
const NOISE_GLSL = `
  float krh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float krn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(krh(i), krh(i + vec2(1, 0)), f.x), mix(krh(i + vec2(0, 1)), krh(i + vec2(1, 1)), f.x), f.y); }`;
// the tops: stone, turf and the summit's white-jade paving by the mix each point carries (aMix: turf, paving)
// the summit's paving: courses of long white stones of uneven lengths, worn at the arrises, the joints dark with moss
function paveTex() {
  return T.pbr('krPave2', 1024, (u, v, o) => {
    const N = 3, row = Math.floor(v * N), fv = v * N - row, cuts = [];
    let x = R(row * 9.1) * 0.3; while (x < 1.3) { cuts.push(x); x += 0.28 + R(row * 13.7 + x * 7.3) * 0.32; }
    let du = 1, id = 0; for (let i = 0; i < cuts.length; i++) { const c = cuts[i] % 1, d = Math.min(Math.abs(u - c), Math.abs(u - c + 1), Math.abs(u - c - 1)); if (d < du) { du = d; } if (u >= c) id = i; }
    const e = Math.min(du * 3, fv, 1 - fv), joint = T.smooth(0.022, 0.006, e + (T.fbm(u, v, 40, 2, 941) - 0.5) * 0.01), wear = T.smooth(0.0, 0.07, e);
    const n = T.fbm(u, v, 8, 4, 942), tint = R(row * 3.3 + id * 1.9), pit = T.smooth(0.78, 0.9, T.fbm(u, v, 60, 2, 943));
    let c = T.mixc([0.66, 0.64, 0.6], [0.78, 0.76, 0.71], tint * 0.6 + n * 0.4); c = c.map(q => q * (0.94 + wear * 0.06) - pit * 0.05);
    c = T.mixc(c, [0.26, 0.3, 0.22], joint * 0.85);
    o.c = c; o.h = 0.5 + wear * 0.12 + (n - 0.5) * 0.06 - joint * 0.3 - pit * 0.05; o.r = 0.55 + joint * 0.3;
  }, 3);
}
function topMaterial() {
  const st = stoneTex(), tf = turfTex(), pv = paveTex();
  const U = { uStone: { value: st.map }, uTurf: { value: tf.map }, uPave: { value: pv.map }, uBump: { value: 0.5 } };
  const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, normalMap: st.normalMap }); m.normalScale.setScalar(0.7);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMix; varying vec3 vMix; varying vec3 vKW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMix = aMix; vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uStone, uTurf, uPave; uniform float uBump; varying vec3 vMix; varying vec3 vKW;' + NOISE_GLSL)
      .replace('#include <map_fragment>', `
        vec3 kS = texture2D(uStone, vKW.xz * 0.24).rgb, kT = texture2D(uTurf, vKW.xz * 0.5).rgb, kP = texture2D(uPave, vKW.xz * 0.36).rgb;
        float kg = smoothstep(0.47, 0.55, vMix.x + (krn(vKW.xz * 3.1) - 0.5) * 0.3 + (krn(vKW.xz * 13.0) - 0.5) * 0.18 + (kT.g - 0.4) * 0.6);
        vec3 kc = mix(mix(kS, kT, kg), kP, vMix.y);
        kc *= (0.93 + 0.14 * krn(vKW.xz * 0.45)) * (1.0 - vMix.z * (0.16 + 0.1 * krn(vKW.xz * 4.0)) * (1.0 - vMix.y * 0.6));
        diffuseColor.rgb = kc;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, vMix.y);');
  };
  m.customProgramCacheKey = () => 'krTop4';
  return m;
}
// the cliffs: the granite thrown on from three sides, moss on what faces up, and the haze of the cloud sea taking the
// rock as it falls toward it
function cliffMaterial() {
  const ct = cliffTex(), U = { uRock: { value: ct.map }, uBump: { value: 1.0 } };
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDep; varying float vDep; varying vec3 vKW; varying vec3 vKN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz; vKN = normalize(mat3(modelMatrix) * objectNormal); vDep = aDep;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uRock; uniform float uBump; varying float vDep; varying vec3 vKW; varying vec3 vKN; float kJade;' + NOISE_GLSL)
      .replace('#include <map_fragment>', `
        vec3 kn = normalize(vKN), ka = pow(abs(kn), vec3(4.0)); ka /= ka.x + ka.y + ka.z; float kk = 0.3;
        vec3 kc = texture2D(uRock, vec2(vKW.z, vKW.y * 0.6) * kk).rgb * ka.x + texture2D(uRock, vKW.xz * kk).rgb * ka.y + texture2D(uRock, vec2(vKW.x, vKW.y * 0.6) * kk).rgb * ka.z;
        float krH = dot(kc, vec3(0.33));
        float moss = smoothstep(0.42, 0.75, kn.y) * smoothstep(0.38, 0.62, krn(vKW.xz * 1.9 + vKW.y * 0.7));
        kc = mix(kc, vec3(0.24, 0.32, 0.14) * (0.8 + 0.4 * krn(vKW.xz * 11.0)), moss * 0.8);
        // 崑崙's jade: under each rim the rock turns pale green-white, veined, smoother, more so the higher the pillar
        float kTop = vKW.y + vDep, kv = abs(krn(vec2(vKW.x + vKW.z, vKW.y * 1.7) * 2.1) - 0.5);
        kJade = smoothstep(1.9, 0.3, vDep) * smoothstep(0.3, 0.55, krn(vKW.xz * 0.9 + vKW.y * 0.6)) * mix(0.55, 1.0, smoothstep(0.6, 3.6, kTop));
        vec3 kjc = mix(vec3(0.5, 0.66, 0.54), vec3(0.74, 0.84, 0.74), krn(vKW.xz * 3.0 + vKW.y));
        kc = mix(kc, kjc * (0.9 + 0.2 * krH), kJade * 0.85); kc = mix(kc, vec3(0.93, 0.97, 0.9), smoothstep(0.035, 0.0, kv) * kJade * 0.8);
        float kd = smoothstep(0.0, -7.0, vKW.y);   // the haze of the cloud sea below, blue as it deepens
        kc = mix(kc, vec3(0.5, 0.53, 0.68), kd * 0.62);
        diffuseColor.rgb = kc;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, kJade);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.5, 0.62, 0.5) * kJade * 0.05;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + BUMP_GLSL);
  };
  m.customProgramCacheKey = () => 'krCliff3';
  return m;
}
// the sea of cloud at dawn: heaps lit gold-cream where the sun finds them, lavender in the hollows, slowly rolling;
// layers above it thin veils over the pillars' feet
function cloudMaterial(layer, sun) {   // (the sea itself lit, so the pillars' shadows fall across it; the veils unlit)
  const m = layer === 0 ? new THREE.MeshLambertMaterial({ color: 0xffffff }) : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: true });
  const u = m.userData.u = { uTime: { value: 0 }, uSun: { value: sun.clone().normalize() } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime; uniform vec3 uSun;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }
      float cf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += cn(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float L = ${layer.toFixed(1)}, t = uTime;
      vec2 p = vWp.xz * (0.085 + L * 0.05) + vec2(t * 0.018, t * 0.006) * (1.0 + L * 0.7) + L * 13.7;
      vec2 q = vec2(cf(p + vec2(0.0, t * 0.012)), cf(p + vec2(5.2, 1.3) - t * 0.01));
      float n = cf(p + q * 1.6), e = 0.05;
      float nx = cf(p + vec2(e, 0.0) + q * 1.6), nz = cf(p + vec2(0.0, e) + q * 1.6);
      vec3 N = normalize(vec3(-(nx - n) / e * 0.8, 1.0, -(nz - n) / e * 0.8));
      float lit = clamp(dot(N, uSun), 0.0, 1.0), puff = smoothstep(0.3, 0.78, n);
      vec3 col = mix(vec3(0.46, 0.5, 0.64), vec3(0.84, 0.83, 0.88), puff);
      col = mix(col, vec3(1.0, 0.86, 0.68), pow(lit, 3.0) * puff * 0.75);
      diffuseColor.rgb = col * (L < 0.5 ? 0.4 : 1.0); vec3 kCloud = col;
      diffuseColor.a = L < 0.5 ? 1.0 : smoothstep(0.5, 0.8, n) * (L < 1.5 ? 0.45 : 0.22);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = kCloud * 0.74;');
  };
  m.customProgramCacheKey = () => 'krCloud2' + layer;
  return m;
}
// a spring falling from a cliff: streaks of white water racing down, thinning and fraying as they fall
function fallMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const u = m.userData.u = { uTime: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aFall; varying vec2 vFall;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFall = aFall;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vFall;' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float s = vFall.x, d = vFall.y, t = uTime;
      float st = krn(vec2(s * 14.0, d * 0.9 - t * 2.6)) * 0.6 + krn(vec2(s * 31.0, d * 2.2 - t * 3.4)) * 0.4;
      float edge = smoothstep(0.0, 0.22, s) * smoothstep(1.0, 0.78, s), body = smoothstep(0.25, 0.75, st);
      float fray = 1.0 - smoothstep(4.0, 9.0, d) * 0.7;
      diffuseColor.rgb = mix(vec3(0.66, 0.76, 0.82), vec3(0.97, 0.98, 1.0), body);
      diffuseColor.a = edge * fray * (0.35 + body * 0.6) * smoothstep(0.0, 0.25, d);`);
  };
  m.customProgramCacheKey = () => 'krFall';
  return m;
}

// ---------------------------------------------------------------- pines (the rims' wind-bent pines, flat-crowned)
let PINE = null;
function pineParts() {
  if (PINE) return PINE;
  const trunkMat = T.material(T.bark(0x5a4636), {}, [1, 2]), tex = leafTex(['#1f3a26', '#2c4c30', '#3a5e3a', '#183020']);
  const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const trunk = new THREE.CylinderGeometry(0.035, 0.08, 1, 7, 4); trunk.translate(0, 0.5, 0);
  // a pine's crown: flat pads of needles on short limbs, wider below, the top flattened (the mountain's pines)
  const pads = []; for (let k = 0; k < 5; k++) { const c = clumpGeo(9), a = k * 2.4, r = k < 4 ? 0.28 - k * 0.04 : 0; c.scale(0.75 - k * 0.08, 0.22, 0.75 - k * 0.08); c.translate(Math.cos(a) * r, 0.62 + k * 0.17, Math.sin(a) * r); pads.push(c); }
  alt(trunkMat, 'krPineT'); alt(leafMat, 'krPineL');
  return (PINE = { trunkMat, leafMat, tex, trunk, crown: mergeSimple(pads, true) });
}
// pts: [x, y, z, scale, lean (radians), lean toward (angle in the ground plane)]
function pinesAt(pts) {
  const P = pineParts(), g = new THREE.Group();
  const tm = new THREE.InstancedMesh(P.trunk, P.trunkMat, pts.length), cm = new THREE.InstancedMesh(P.crown, P.leafMat, pts.length), c = new THREE.Color();
  const ax = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Matrix4();
  pts.forEach(([x, y, z, s, lean, dir], i) => {   // (leaning toward dir: turned about the level axis across it)
    ax.set(Math.sin(dir), 0, -Math.cos(dir));
    m.makeTranslation(x, y - 0.04, z).multiply(q.makeRotationAxis(ax, lean)).multiply(q.makeRotationY(R(i * 3.1) * 6.28)).multiply(q.makeScale(s, s, s));
    tm.setMatrixAt(i, m); cm.setMatrixAt(i, m); const t = 0.8 + R(i * 7.7) * 0.35; cm.setColorAt(i, c.setRGB(t, t, t * 0.95));
  });
  for (const m of [tm, cm]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  cm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: P.tex, alphaTest: 0.5 });
  return g;
}

// ---------------------------------------------------------------- the cliffs: a curtain of rock hung from each rim
// loop: { p: [[x, z]], n: [[nx, nz]], top: [y], float } (a closed rim, its outward normals and heights): rings of rock
// down from it, sheer and jointed, bulging and recessed with the crags, broadening a little as they fall (pillars) or
// drawing in to a point (the lone crag, hanging free). Returns the geometry and each point's column of offsets
function curtain(loops) {
  const P = [], I = [], cols = [], DP = [];
  for (const L of loops) {
    const n = L.p.length, base = P.length / 3, col = [];
    for (let j = 0; j < n; j++) {
      const [x, z] = L.p[j], [nx, nz] = L.n[j], top = L.top[j], offs = [];
      for (let k = 0; k <= K; k++) {
        const t = k / K, y = L.float ? top - 3.6 * Math.pow(t, 1.15) : top - (top - BOT) * Math.pow(t, 1.45);
        const rg = 1 - Math.abs(fbm3(x * 2.2, y * 0.45, z * 2.2) * 2 - 1), crag = (fbm3(x * 1.1, y * 0.2, z * 1.1) - 0.5) * 0.6 + (rg - 0.6) * 0.22 + (fbm3(x * 5, y * 1.4, z * 5) - 0.5) * 0.12;
        // the bedding: the rock in courses a half cell or so deep, each standing a little in or out of the next (ledges)
        const bed = Math.floor((y + (fbm3(x * 0.5, 1.7, z * 0.5) - 0.5) * 1.4) / 0.5), ledge = (h3(bed, Math.floor(x * 0.8), Math.floor(z * 0.8)) - 0.5) * 0.2 + (h3(bed, 3, 7) - 0.5) * 0.1;
        let off = k === 0 ? 0 : k === 1 ? 0.035 : 0.04 + (crag + ledge) * T.smooth(0.0, 0.07, t) + (L.float ? -1.15 * Math.pow(t, 1.3) : 0.35 * t);
        if (t < 0.14) off = Math.max(off, 0.03 * (1 - T.smooth(0.08, 0.14, t)));
        offs.push(off); P.push(x + nx * off, y, z + nz * off); DP.push(top - y);
      }
      col.push(offs);
    }
    for (let j = 0; j < n; j++) { const a = base + j * (K + 1), b = base + ((j + 1) % n) * (K + 1);
      for (let k = 0; k < K; k++) I.push(a + k, b + k, a + k + 1, b + k, b + k + 1, a + k + 1); }
    cols.push(col);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aDep', new THREE.Float32BufferAttribute(DP, 1)); g.setIndex(I); g.computeVertexNormals();
  // each loop's faces turned outward (the rim's winding decides it): checked on its first point's second ring
  let base = 0; const nr = g.attributes.normal;
  for (let li = 0; li < loops.length; li++) { const L = loops[li], n = L.p.length, v = base * (K + 1) + 2;
    const wrong = nr.getX(v) * L.n[0][0] + nr.getZ(v) * L.n[0][1] < 0;
    if (wrong) { /* flip this loop's triangles */ L.flip = true; }
    base += n; }
  if (loops.some(L => L.flip)) {
    let ti = 0; base = 0;
    for (const L of loops) { const nT = L.p.length * K * 2; if (L.flip) for (let q = ti; q < ti + nT; q++) { const t1 = I[q * 3 + 1]; I[q * 3 + 1] = I[q * 3 + 2]; I[q * 3 + 2] = t1; } ti += nT; }
    g.setIndex(I); g.computeVertexNormals();
  }
  return { geo: g, cols };
}
// marching squares over the field s (inside where s <= 0): the closed rims, each resampled about every 0.1 and smoothed
function rims(s, NX, NZ, X0, Z0) {
  const at = (i, j) => s[j * NX + i], px = i => X0 + i / SR, pz = j => Z0 + j / SR, pos = new Map(), adj = new Map();
  const edge = (id, x, z) => { if (!pos.has(id)) pos.set(id, [x, z]); return id; };
  const H = (i, j) => { const a = at(i, j), b = at(i + 1, j), f = a / (a - b); return edge('h' + i + ',' + j, px(i) + f / SR, pz(j)); };
  const V = (i, j) => { const a = at(i, j), b = at(i, j + 1), f = a / (a - b); return edge('v' + i + ',' + j, px(i), pz(j) + f / SR); };
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const c = (at(i, j) <= 0 ? 1 : 0) | (at(i + 1, j) <= 0 ? 2 : 0) | (at(i + 1, j + 1) <= 0 ? 4 : 0) | (at(i, j + 1) <= 0 ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const t = () => H(i, j), r = () => V(i + 1, j), b = () => H(i, j + 1), l = () => V(i, j), mid = (at(i, j) + at(i + 1, j) + at(i, j + 1) + at(i + 1, j + 1)) / 4 <= 0;
    switch (c) {
      case 1: case 14: link(l(), t()); break; case 2: case 13: link(t(), r()); break; case 3: case 12: link(l(), r()); break;
      case 4: case 11: link(r(), b()); break; case 6: case 9: link(t(), b()); break; case 7: case 8: link(l(), b()); break;
      case 5: if (mid) { link(t(), r()); link(b(), l()); } else { link(l(), t()); link(r(), b()); } break;
      case 10: if (mid) { link(l(), t()); link(r(), b()); } else { link(t(), r()); link(b(), l()); } break;
    }
  }
  const seen = new Set(), out = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !seen.has(cur)) { seen.add(cur); loop.push(pos.get(cur)); const nb = adj.get(cur); const nx = nb[0] !== prev ? nb[0] : nb[1]; prev = cur; cur = nx; }
    if (loop.length < 6) continue;
    let len = 0; const cum = [0]; for (let i = 1; i <= loop.length; i++) { const a = loop[i - 1], b = loop[i % loop.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(len); }
    if (len < 0.8) continue;
    const m = Math.max(8, Math.round(len / 0.1)), pts = [];
    for (let q = 0, i = 0; q < m; q++) { const d = len * q / m; while (cum[i + 1] < d) i++; const a = loop[i], b = loop[(i + 1) % loop.length], f = (d - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]); pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    for (let pass = 0; pass < 2; pass++) { const c = pts.map(p => p.slice()); for (let i = 0; i < m; i++) { const a = c[(i + m - 1) % m], b = c[(i + 1) % m]; pts[i] = [c[i][0] * 0.5 + (a[0] + b[0]) * 0.25, c[i][1] * 0.5 + (a[1] + b[1]) * 0.25]; } }
    out.push(pts);
  }
  return out;
}

// ---------------------------------------------------------------- the set
let life = [], built = false, lvl = null, bridgeH = new Map(), LV = null, field = null, chestG = new Map(), M = null, world = null, props = [], slopes = [], falls = [], clouds = [];
async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map(); falls = []; clouds = []; life = []; let distant = [], rimPines = [];
  const MW = D.mapW, MH = D.mapH, terr = D.terrain, walk = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && terr[y][x] === 0;
  const key = (x, y) => x + ',' + y;
  // the bridges' cells, the stairs' cells
  const bridgeC = new Map(); for (const [y, x0, x1] of BRIDGES) for (let x = x0; x < x1; x++) bridgeC.set(key(x, y), [y, x0, x1]);
  const stairOf = new Map(); for (const st of STAIRS) for (let y = st.z0; y < st.z1; y++) for (let x = st.x0; x < st.x1; x++) stairOf.set(key(x, y), st);
  // the pillars' regions: the open ground cut at the bridges and stairs, each named by a cell it holds
  const reg = new Map();
  for (const [name, [sx, sy]] of Object.entries(SEEDS)) {
    for (const q = [[sx, sy]]; q.length;) { const [x, y] = q.pop(), k = key(x, y); if (!walk(x, y) || reg.has(k) || bridgeC.has(k) || stairOf.has(k)) continue; reg.set(k, name); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const k = key(x, y); if (walk(x, y) && !reg.has(k) && !bridgeC.has(k) && !stairOf.has(k)) reg.set(k, 'south'); }   // (any stray cell: the landing's)
  // pads: the chests on blocked cells, the stele's cell, the gate's: ground at the level beside them
  const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false }));
  for (const c of chests) if (!walk(c.x, c.y)) { let best = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const r = reg.get(key(c.x + dx, c.y + dy)); if (r && (best === null || LEVEL[r] > LEVEL[best])) best = r; } if (best) reg.set(key(c.x, c.y), best); }
  reg.set(key(...STELE), 'summit'); for (const x of GATE) reg.set(key(x, 0), 'summit');
  for (const [x, y] of [...LANTERNS, SHRINE]) { let best = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const r = reg.get(key(x + dx, y + dy)); if (r && (best === null || LEVEL[r] > LEVEL[best])) best = r; } if (best) reg.set(key(x, y), best); }
  props = [STELE, ...GATE.map(x => [x, 0]), ...LANTERNS, SHRINE, ...chests.map(c => [c.x, c.y])];
  // the land's cells and their level; a stair's cell climbs with its stair
  const land = new Map(); for (const [k, r] of reg) land.set(k, { r, y: LEVEL[r] });
  for (const [k, st] of stairOf) land.set(k, { r: 'stair', st });
  lvl = land;
  const rampY = (st, z) => LEVEL[st.lo] + (LEVEL[st.hi] - LEVEL[st.lo]) * T.clamp((st.z1 - z) / (st.z1 - st.z0));
  LV = new Levels(MW, MH, 4); slopes = [];
  for (const st of STAIRS) { LV.stairs(st.x0, st.z0, st.x1, st.z1, LEVEL[st.lo], LEVEL[st.hi], st.n, 's'); for (let y = st.z0; y < st.z1; y++) for (let x = st.x0; x < st.x1; x++) slopes.push([x, y]); }
  // the bridges' decks: level cell by cell, stepping evenly between the two ends' heights
  bridgeH = new Map();
  for (const [y, x0, x1] of BRIDGES) { const hw = land.get(key(x0 - 1, y)).y, he = land.get(key(x1, y)).y, n = x1 - x0; for (let i = 0; i < n; i++) bridgeH.set(key(x0 + i, y), +(hw + (he - hw) * (i + 1) / (n + 1)).toFixed(3)); }

  // the field: signed distance to the land (cells), less a ragged margin; never into a bridge's cells (the rock ends
  // square at its abutment); and the land cell nearest each sample
  const NX = (MW + EXT * 2) * SR + 1, NZ = (MH + EXT * 2) * SR + 1, X0 = -EXT, Z0 = -EXT, s = new Float32Array(NX * NZ), near = new Array(NX * NZ);
  const isLand = (x, y) => land.has(key(x, y));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i / SR, z = Z0 + j / SR, cx = Math.floor(x), cz = Math.floor(z);
    let d = 9, nk = null;
    if (isLand(cx, cz)) {   // inside: the distance to the nearest cell that is not land, negative
      nk = key(cx, cz); d = 0; let o = 3;
      for (let b = cz - 2; b <= cz + 2; b++) for (let a = cx - 2; a <= cx + 2; a++) if (!isLand(a, b)) { const dx = Math.max(a - x, 0, x - a - 1), dz = Math.max(b - z, 0, z - b - 1); o = Math.min(o, Math.hypot(dx, dz)); }
      d = -o;
    } else for (let b = cz - 3; b <= cz + 3; b++) for (let a = cx - 3; a <= cx + 3; a++) if (isLand(a, b)) { const dx = Math.max(a - x, 0, x - a - 1), dz = Math.max(b - z, 0, z - b - 1), q = Math.hypot(dx, dz); if (q < d) { d = q; nk = key(a, b); } }
    const margin = 0.15 + (fbm3(x * 1.4, 0.5, z * 1.4) - 0.5) * 0.18;
    let v = d - margin;
    const bc = bridgeC.get(key(cx, cz)); if (bc && !isLand(cx, cz)) v = Math.max(v, 0.02 + Math.min(x - bc[1], bc[2] - x, 0.3));
    s[j * NX + i] = v; near[j * NX + i] = nk;
  }
  const sAt = (x, z) => { const fx = T.clamp((x - X0) * SR, 0, NX - 1.001), fz = T.clamp((z - Z0) * SR, 0, NZ - 1.001), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, F = (a, b) => s[b * NX + a];
    return (F(i, j) * (1 - tx) + F(i + 1, j) * tx) * (1 - tz) + (F(i, j + 1) * (1 - tx) + F(i + 1, j + 1) * tx) * tz; };
  const grad = (x, z) => { const e = 0.04, gx = sAt(x + e, z) - sAt(x - e, z), gz = sAt(x, z + e) - sAt(x, z - e), l = Math.hypot(gx, gz) || 1; return [gx / l, gz / l]; };
  const nearAt = (x, z) => near[Math.round(T.clamp((z - Z0) * SR, 0, NZ - 1)) * NX + Math.round(T.clamp((x - X0) * SR, 0, NX - 1))];
  const topOf = (k, z) => { const c = k && land.get(k); return !c ? LEVEL.south : c.st ? rampY(c.st, z) : c.y; };
  const topAt = (x, z) => topOf(nearAt(x, z), z);
  field = { sAt, topAt, nearAt };
  const inStair = (x, z, e = 0) => STAIRS.find(st => x > st.x0 + e && x < st.x1 - e && z > st.z0 + e && z < st.z1 - e);

  // ---- the tops: the grid where the field is inside, its rim drawn onto the edge; turf by noise, paving on the summit
  {
    const P = new Float32Array(NX * NZ * 3), MX = new Float32Array(NX * NZ * 3), used = new Uint8Array(NX * NZ), I = [];
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX + 1, d = a + NX, tri = (p, q, r) => { if (Math.min(s[p], s[q], s[r]) <= 0) { I.push(p, r, q); used[p] = used[q] = used[r] = 1; } };
      if ((i + j) & 1) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
    }
    for (let k = 0; k < NX * NZ; k++) {
      if (!used[k]) continue;
      let x = X0 + (k % NX) / SR, z = Z0 + Math.floor(k / NX) / SR;
      for (let it = 0; it < 3; it++) { const v = sAt(x, z); if (v <= 0.012) break; const [gx, gz] = grad(x, z); x -= gx * (v - 0.012); z -= gz * (v - 0.012); }
      const nk = near[k], c = nk && land.get(nk);
      let y = topOf(nk, z); if (inStair(x, z, 0.001)) { const st = inStair(x, z, 0.001); y = LEVEL[st.lo] - 0.25; }
      P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
      const zone = c ? (c.st ? (c.st.hi === 'summit' ? 'path' : 'wild') : ZONE[c.r]) : 'wild';
      const turf = (T.smooth(0.42, 0.7, fbm3(x * 0.32, 3.3, z * 0.32)) * 0.9 + T.smooth(-0.05, 0.12, s[k]) * 0.25) * (zone === 'wild' ? 1.1 : 0.7);
      const old = zone === 'path' ? T.smooth(0.42, 0.56, fbm3(x * 0.55, 7.1, z * 0.55)) * 0.85 : 0;   // the pilgrims' tiers: old paving, half lost
      MX[k * 3] = zone === 'sacred' ? 0 : turf * (1 - old); MX[k * 3 + 1] = zone === 'sacred' ? 1 : old; MX[k * 3 + 2] = T.smooth(-0.3, 0.0, s[k]);
    }
    const UV = new Float32Array(NX * NZ * 2); for (let k = 0; k < NX * NZ; k++) { UV[k * 2] = P[k * 3] * 0.24; UV[k * 2 + 1] = -P[k * 3 + 2] * 0.24; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aMix', new THREE.BufferAttribute(MX, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
    const top = new THREE.Mesh(g, alt(topMaterial(), 'krTop')); top.receiveShadow = true; top.castShadow = true; S.add(top);
    // turf tufts, sparse, on the turf (never on the paving or the stairs)
    const tufts = []; for (let k = 0; k < NX * NZ; k += 1) { if (!used[k] || s[k] > -0.05 || MX[k * 3] < 0.62 || R(k * 0.37) > 0.3) continue; const x = P[k * 3] + (R(k) - 0.5) * 0.12, z = P[k * 3 + 2] + (R(k + 0.5) - 0.5) * 0.12; if (!inStair(x, z, -0.1)) tufts.push([x, P[k * 3 + 1], z]); }
    if (tufts.length) S.add(grass(tufts, { size: 0.26, cols: ['#5a6a2a', '#6e7c34', '#4a5a24', '#82884a'] }));
  }

  // ---- the cliffs: a curtain from every rim of the land
  const loops = rims(s, NX, NZ, X0, Z0).map(pts => {
    const n = pts.map(([x, z]) => grad(x, z)), top = pts.map(([x, z]) => { const [gx, gz] = grad(x, z); return topAt(x - gx * 0.08, z - gz * 0.08); });
    const r = (land.get(nearAt(pts[0][0] - n[0][0] * 0.1, pts[0][1] - n[0][1] * 0.1)) || {}).r;
    return { p: pts, n, top, float: r === 'lone' };
  });
  const cliffMat = alt(cliffMaterial(), 'krCliff'), { geo: cg, cols } = curtain(loops), cliff = new THREE.Mesh(cg, cliffMat); cliff.castShadow = cliff.receiveShadow = true; S.add(cliff);

  // ---- the pillars standing out of the cloud round the board and below it, lower than the play (a depth to look into)
  {
    const pl = [], caps = [], capMix = [], capI = [], pinePts = [];
    const free = (x, z, r) => { for (let b = Math.floor(z - r - 1.2); b <= z + r + 1.2; b++) for (let a = Math.floor(x - r - 1.2); a <= x + r + 1.2; a++) if (land.has(key(a, b)) || bridgeC.has(key(a, b))) return false; return true; };
    const spots = [[PALACE[0], PALACE[1], PALACE[2], PALACE[3], true]]; for (let i = 0; spots.length < 46 && i < 900; i++) {
      const x = -16 + R(i * 1.7 + 0.3) * (MW + 32), z = -18 + R(i * 2.9 + 0.7) * (MH + 34), r = 0.7 + R(i * 4.1) * 2.2, inside = x > -1 && x < MW + 1 && z > -1 && z < MH + 1;
      const edge = Math.hypot(Math.max(-x, 0, x - MW), Math.max(-z, 0, z - MH));   // (outside the board, clear of the cranes' lanes along its edges)
      if (!free(x, z, r) || (!inside && edge < r + 6) || spots.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + r + 1.2)) continue;
      const top = inside ? -3.2 - R(i * 5.3) * 2.2 : -3.4 + R(i * 5.3) * 3.6;
      spots.push([x, z, r, top]);
    }
    for (const [x, z, r, top, isPalace] of spots) {
      const m = Math.max(16, Math.round(Math.PI * 2 * r / 0.14)), pts = [], nn = [], tops = [];
      for (let q = 0; q < m; q++) { const a = q / m * Math.PI * 2, rr = r * (0.82 + 0.3 * fbm3(Math.cos(a) * 1.3 + x, Math.sin(a) * 1.3 + z, 7.7)); pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]); nn.push([Math.cos(a), Math.sin(a)]); tops.push(top); }
      pl.push({ p: pts, n: nn, top: tops, float: false });
      const c0 = caps.length / 3; caps.push(x, top + 0.04, z); capMix.push(0.8, 0, 0); for (const [px, pz] of pts) { caps.push(px, top, pz); capMix.push(0.6, 0, 1); }
      for (let q = 0; q < m; q++) capI.push(c0, c0 + 1 + (q + 1) % m, c0 + 1 + q);
      const np = Math.round(r * 1.6); for (let q = 0; q < np; q++) { const a = R(x * 3 + q) * 6.28, d = r * (isPalace ? 0.85 + R(z + q * 7) * 0.1 : 0.25 + R(z + q * 7) * 0.45); pinePts.push([x + Math.cos(a) * d, top, z + Math.sin(a) * d, 0.9 + R(q + x) * 0.9, R(q * 3 + z) * 0.2, a]); }
    }
    const { geo } = curtain(pl), pm = new THREE.Mesh(geo, cliffMat); pm.receiveShadow = pm.castShadow = true; S.add(pm);
    S.add(altAll(palace(PALACE[0], PALACE[1], PALACE[3]), 'krPalace'));
    distant = spots;
    const cg2 = new THREE.BufferGeometry(); cg2.setAttribute('position', new THREE.Float32BufferAttribute(caps, 3)); cg2.setAttribute('aMix', new THREE.Float32BufferAttribute(capMix, 3)); cg2.setAttribute('uv', new THREE.Float32BufferAttribute(caps.flatMap((v, i) => i % 3 === 0 ? [v * 0.24] : i % 3 === 2 ? [-v * 0.24] : []), 2)); cg2.setIndex(capI); cg2.computeVertexNormals();
    const cm = new THREE.Mesh(cg2, alt(topMaterial(), 'krTop')); cm.receiveShadow = true; S.add(cm);
    // and the rims' own pines, leaning out over the drop: on rims that face away from the camera or to the side (one on
    // a rim facing it would stand in front of who is on the top behind it), clear of the bridges and stairs
    loops.forEach((L, li) => { if (L.float) return; for (let j = 0; j < L.p.length; j += 7) {
      const [x, z] = L.p[j], [nx, nz] = L.n[j]; if (nz > 0.35 || R(li * 31 + j * 0.13) > 0.22) continue;
      if (STAIRS.some(st => x > st.x0 - 1.2 && x < st.x1 + 1.2 && z > st.z0 - 1.2 && z < st.z1 + 1.2) || BRIDGES.some(([y, x0, x1]) => x > x0 - 1.3 && x < x1 + 1.3 && z > y - 1.2 && z < y + 2.2)) continue;
      if (rimPines.some(p => Math.hypot(p[0] - x, p[2] - z) < 1.6)) continue;
      const t = cols[li][j], dip = L.top[j] - 0.5, o = t[6] + 0.04;   // (rooted under the rim, leaning far out: the crown hangs over the drop, not behind who stands on the top)
      rimPines.push([x + nx * o, dip, z + nz * o, 0.55 + R(j * 1.3 + li) * 0.3, 0.7 + R(j + li * 3) * 0.35, Math.atan2(nz, nx)]);
    } });
    S.add(pinesAt(pinePts.concat(rimPines)));
  }

  // ---- the rims: boulders on the lips of the wild and pilgrims' tiers, roots over the edge, vines down the faces, ferns
  // and shrubs on the ledges; all of it on the rim or below it, never on a cell
  const nearWorks = (x, z, e = 1.0) => STAIRS.some(st => x > st.x0 - e && x < st.x1 + e && z > st.z0 - e && z < st.z1 + e) || BRIDGES.some(([y, x0, x1]) => x > x0 - e && x < x1 + e && z > y - e && z < y + 1 + e);
  {
    const bpts = [], strands = [], rpaths = [], colY = (top, k) => top - (top - BOT) * Math.pow(k / K, 1.45);
    loops.forEach((L, li) => { const n = L.p.length;
      for (let j = 0; j < n; j++) {
        const [x, z] = L.p[j], [nx, nz] = L.n[j], top = L.top[j], c = land.get(nearAt(x - nx * 0.1, z - nz * 0.1)), zone = c ? (c.st ? 'path' : ZONE[c.r]) : 'wild';
        if (nearWorks(x, z)) continue;
        if (zone !== 'sacred' && !L.float && R(li * 13 + j * 0.71) < 0.05) bpts.push([x - nx * 0.05, top, z - nz * 0.05]);
        if (L.float || j % 8 || R(li * 7 + j * 0.37) > 0.32) continue;
        // a vine: down the rock's own column, a leaf pair every few hundredths
        const kk = 4 + Math.floor(R(j + li * 3) * 9), col = cols[li][j], st = [];
        for (let k = 1; k < kk; k++) { const y0 = colY(top, k), y1 = colY(top, k + 1), o0 = col[k], o1 = col[k + 1], m = Math.max(1, Math.round((y0 - y1) / 0.07));
          for (let q = 0; q < m; q++) { const f = q / m, o = o0 + (o1 - o0) * f + 0.02; st.push([x + nx * o, y0 + (y1 - y0) * f, z + nz * o, nx, nz]); } }
        strands.push(st);
        if (R(j * 1.7 + li) < 0.5) { const tx = -nz, tz = nx, w = (R(j + 0.3) - 0.5) * 0.3;   // and a root over the lip beside it
          rpaths.push([new THREE.Vector3(x - nx * 0.12, top + 0.012, z - nz * 0.12), new THREE.Vector3(x + nx * 0.04 + tx * w * 0.3, top - 0.02, z + nz * 0.04 + tz * w * 0.3),
            new THREE.Vector3(x + nx * (col[4] + 0.03) + tx * w, colY(top, 4), z + nz * (col[4] + 0.03) + tz * w), new THREE.Vector3(x + nx * (col[8] + 0.03) + tx * w * 1.6, colY(top, 8), z + nz * (col[8] + 0.03) + tz * w * 1.6)]); }
      } });
    for (const [px, py, pz, , , dir] of rimPines) for (const sd of [-1, 1]) { const nx = Math.cos(dir), nz = Math.sin(dir), tx = -nz * sd * 0.12, tz = nx * sd * 0.12;   // the rim pines' roots, gripping the lip
      rpaths.push([new THREE.Vector3(px - nx * 0.3 + tx, py + 0.5, pz - nz * 0.3 + tz), new THREE.Vector3(px - nx * 0.05 + tx * 1.5, py + 0.47, pz - nz * 0.05 + tz * 1.5), new THREE.Vector3(px + tx * 2, py + 0.2, pz + tz * 2), new THREE.Vector3(px + nx * 0.03 + tx * 2.4, py - 0.15, pz + nz * 0.03 + tz * 2.4)]); }
    const boulderMat = alt(T.material(T.rock(0x8e887c, 'krBoulder', 0.35), { roughness: 0.9 }, [0.5, 0.5]), 'krBoulder');
    if (bpts.length) S.add(stones(bpts, boulderMat, { size: 0.14, maxH: 0.18 }));
    if (strands.length) { const v = vines(strands); alt(v.material, 'krVine'); S.add(v); }
    if (rpaths.length) S.add(altAll(roots(rpaths), 'krRoot'));
    // ferns and shrubs on the ledges: where the rock faces up, well under a rim and above the haze
    const pa = cg.attributes.position, na = cg.attributes.normal, da = cg.attributes.aDep, ledge = [];
    for (let i = 0; i < pa.count; i++) { const d = da.getX(i), y = pa.getY(i); if (na.getY(i) > 0.55 && d > 0.6 && d < 6 && y > -4.5 && R(i * 0.613) < 0.06) ledge.push([pa.getX(i), y, pa.getZ(i)]); }
    if (ledge.length) { const sh = shrubs(ledge, { size: 0.26, cols: ['#2c4a22', '#3c5e2a', '#4e7232', '#20381a'] }); alt(sh.material, 'krFern'); S.add(sh); }
  }

  // ---- the springs: from just under a rim, down the cliff into the cloud, clear of the rock
  {
    const fm = fallMaterial(), Pp = [], Fa = [], Ii = [], bases = [];
    for (const [fx, fz, w] of FALLS) {
      let best = null; loops.forEach((L, li) => L.p.forEach(([x, z], j) => { const d = Math.hypot(x - fx, z - fz); if (!best || d < best.d) best = { d, li, j }; }));
      if (!best || best.d > 1.5) continue;
      const L = loops[best.li], n = L.p.length, half = Math.max(1, Math.round(w / 0.2)), base = Pp.length / 3, cw = half * 2 + 1;
      { const [x, z] = L.p[best.j], [nx, nz] = L.n[best.j]; bases.push([x + nx * 1.0, SEA + 0.5, z + nz * 1.0]); }
      for (let q = -half; q <= half; q++) {
        const j = (best.j + q + n) % n, [x, z] = L.p[j], [nx, nz] = L.n[best.j], col = cols[best.li][j];
        let reach = 0, dist = 0, py = null;
        for (let k = 2; k <= K; k++) {
          const t = k / K, y = L.top[j] - (L.top[j] - BOT) * Math.pow(t, 1.45); reach = Math.max(reach, col[k] + 0.08 + Math.min(0.5, (L.top[j] - y) * 0.06));
          if (py != null) dist += py - y; py = y;
          Pp.push(x + nx * reach, y, z + nz * reach); Fa.push((q + half) / (cw - 1), dist);
        }
      }
      const rows = K - 1;
      for (let c = 0; c < cw - 1; c++) for (let k = 0; k < rows - 1; k++) { const a = base + c * rows + k, b = base + (c + 1) * rows + k; Ii.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    if (Pp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('aFall', new THREE.Float32BufferAttribute(Fa, 2)); g.setIndex(Ii);
      const m = new THREE.Mesh(g, fm); m.renderOrder = 2; m.userData.noRange = true; S.add(m); falls.push(fm); }
    const sp = spray(bases); S.add(sp.group); life.push(sp);
  }

  // ---- the works of the way: rope bridges and steps hewn in the rock below, white jade above; the pilgrims' lanterns and
  // shrine; the summit's balustrade, its stele of red stone, the beds of 甘露草 and the gate
  const jade = alt(T.material(T.marble(0xece8e0, 0x9a9a8c, 2), { roughness: 0.5 }, [0.5, 0.5]), 'krJade');
  const jadeRough = alt(T.material(T.flags(0xe2ded2, 0xd4d0c2, 'krDeck', 4, 0, 0x8a8678), { roughness: 0.7 }, [0.5, 0.5]), 'krDeck');
  const wildSpan = ([y, x0, x1]) => ZONE[land.get(key(x0 - 1, y)).r] === 'wild' && ZONE[land.get(key(x1, y)).r] === 'wild';
  S.add(bridges(jade, jadeRough, land, BRIDGES.filter(b => !wildSpan(b))));
  for (const b of BRIDGES.filter(wildSpan)) S.add(altAll(ropeBridge(b[0], b[1], b[2], bridgeH.get(key(b[1], b[0]))), 'krRope'));
  const hewn = alt(T.material(stoneTex(), { roughness: 0.9 }, [0.5, 0.5]), 'krHewn'), hewnFace = alt(T.material(cliffTex(), { roughness: 0.92 }, [0.6, 0.6]), 'krHewnFace');
  STAIRS.forEach((st, i) => { const sacred = st.hi === 'summit'; S.add(stairBlocks(LV.ramps[i], sacred ? jadeRough : hewn, sacred ? jade : hewnFace, 0.6)); if (!sacred) return;
    const lo = LEVEL[st.lo], hi = LEVEL[st.hi], len = Math.hypot(st.z1 - st.z0, hi - lo), ang = Math.atan2(hi - lo, st.z1 - st.z0);
    for (const x of [st.x0 - 0.07, st.x1 + 0.07]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.7, len + 0.1), jade); w.position.set(x, (lo + hi) / 2 + 0.05, (st.z0 + st.z1) / 2); w.rotation.x = ang; S.add(shade(w)); } });
  for (const [x, y] of LANTERNS) S.add(altAll(stoneLantern(x + 0.5, y + 0.5, land.get(key(x, y)).y, 0.95), 'krLantern'));
  S.add(altAll(shrine(SHRINE[0] + 0.5, SHRINE[1] + 0.55, land.get(key(...SHRINE)).y), 'krShrine'));
  { // the summit's balustrade: round its rim, open at the head of the stair and behind, at the gate
    const runs = []; let run = [];
    loops.forEach(L => { if (L.float) return; const c0 = land.get(nearAt(L.p[0][0] - L.n[0][0] * 0.1, L.p[0][1] - L.n[0][1] * 0.1)); if (!c0 || c0.r !== 'summit') return;
      for (let j = 0; j < L.p.length; j += 5) { const [x, z] = L.p[j], [nx, nz] = L.n[j], c = land.get(nearAt(x - nx * 0.1, z - nz * 0.1)), skip = !c || c.r !== 'summit' || z < 0.75 || (x > 10.5 && x < 13.5 && z > 3.2);
        if (skip) { if (run.length > 1) runs.push(run); run = []; continue; }
        run.push([x - nx * 0.08, z - nz * 0.08]); }
      if (run.length > 1) runs.push(run); run = []; });
    S.add(balustrade(jade, runs, LEVEL.summit));
  }
  S.add(altAll(stele(STELE[0] + 0.5, STELE[1] + 0.48, LEVEL.summit), 'krStele'));
  S.add(altAll(gate(jade, 11.5, 0.3, LEVEL.summit), 'krGate'));
  for (const [x0, x1] of [[9.25, 10.45], [12.55, 13.75]]) S.add(altAll(herbBed(jade, x0, 0.64, x1, 0.94, LEVEL.summit), 'krBed'));
  S.add(herbs([[9.5, 3.7, 0.79, 0.72], [9.9, 3.7, 0.77, 0.82], [10.25, 3.7, 0.8, 0.7], [12.75, 3.7, 0.8, 0.72], [13.15, 3.7, 0.77, 0.82], [13.5, 3.7, 0.79, 0.7],
    [11.1, LEVEL.summit, 1.9, 0.34], [11.9, LEVEL.summit, 1.9, 0.34]]));
  // the lone crag: chained to the summit, roots trailing from its underside
  S.add(chain(new THREE.Vector3(16.95, LEVEL.summit - 0.15, 1.4), new THREE.Vector3(19.15, LEVEL.lone - 0.3, 1.45), 0.35));
  S.add(chain(new THREE.Vector3(16.95, LEVEL.summit - 0.2, 2.45), new THREE.Vector3(20.1, LEVEL.lone - 0.4, 2.4), 0.45));
  { const hang = []; loops.forEach((L, li) => { if (!L.float) return; for (let j = 0; j < L.p.length; j += 6) { const [x, z] = L.p[j], [nx, nz] = L.n[j], k = 10 + (j % 4) * 3, t = k / K, y = L.top[j] - 3.6 * Math.pow(t, 1.15), o = cols[li][j][k];
    const p0 = new THREE.Vector3(x + nx * o, y, z + nz * o), drop = 0.9 + R(j) * 1.6; hang.push([p0, p0.clone().add(new THREE.Vector3(nx * 0.1, -drop * 0.4, nz * 0.1)), p0.clone().add(new THREE.Vector3((R(j + 1) - 0.5) * 0.3, -drop * 0.75, (R(j + 2) - 0.5) * 0.3)), p0.clone().add(new THREE.Vector3((R(j + 3) - 0.5) * 0.3, -drop, (R(j + 4) - 0.5) * 0.3))]); } });
    if (hang.length) S.add(altAll(roots(hang), 'krHang')); }

  // ---- the sea of cloud and its veils
  const sunV = new THREE.Vector3(...kunlunReimagined.mood.sunDir);
  clouds = [0, 1, 2].map(L => { const c = new THREE.Mesh(new THREE.PlaneGeometry(MW + 160, MH + 160).rotateX(-Math.PI / 2), cloudMaterial(L, sunV)); c.position.set(MW / 2, SEA + L * 1.9, MH / 2); c.renderOrder = L; c.userData.noRange = true; S.add(c); return c; });

  clouds[0].receiveShadow = true;
  // ---- the life of the mountain (the user's call): cranes wheeling below the board, under every top; ribbons of
  // auspicious cloud winding round the lone crag, 玉虛宮's peak and a few of the far pillars, below their tops
  // (in the open air beside the board's four edges, never under it: through the pillars they would fly into rock)
  const cr = cranes([[-3, -1.6, 15, 2.1, 12, 0.05, 0], [-3.2, -1.9, 15, 2.0, 11.6, 0.05, 0.5], [27.2, -2.0, 15, 2.1, 12, -0.045, 1.4], [12, -1.3, -2.4, 11, 1.3, 0.05, 2.2], [12, -1.8, 32.6, 11, 1.6, -0.05, 3.1]]);
  S.add(cr.group); life.push(cr);
  const far = distant.filter(([x, z, r, top, pal]) => !pal && top > -2 && (x < -2 || x > MW + 2 || z < -2 || z > MH + 2)).sort((a, b) => Math.hypot(a[0] - MW / 2, a[1] - MH / 2) - Math.hypot(b[0] - MW / 2, b[1] - MH / 2)).slice(0, 3);
  const rb = ribbons([[21.4, 1.7, 3.6, 2.1, 1.0, 2.1, 1.3, 0.62, 0], [PALACE[0], PALACE[1], PALACE[2] + 1.3, PALACE[2] + 1.2, PALACE[3] - 2.6, PALACE[3] - 0.9, 1.25, 0.8, 1.1],
    ...far.map(([x, z, r, top], i) => [x, z, r + 0.8, r + 0.75, top - 2.6, top - 0.7, 1.4, 0.7, i * 2.1])]);
  S.add(rb.group); life.push(rb);

  for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, ground(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(key(c.x, c.y), o); }
  E.world.updaters.push((dt, t) => { for (const c of clouds) c.material.userData.u.uTime.value = t; for (const f of falls) f.userData.u.uTime.value = t; for (const l of life) l.tick(t); windTick(t); });
  built = true; void FX;
}

// the bridges: a deck of white-jade flags on a single stone arch, balustrades of posts with lotus-bud caps and carved
// panels along both edges (on the cell's rim, outside the walk)
function bridges(jade, deckMat, land, list) {
  const g = new THREE.Group(), decks = [], stone = [];
  for (const [y, x0, x1] of list) {
    const hs = []; for (let x = x0; x < x1; x++) hs.push(bridgeH.get(x + ',' + y));
    const hw = land.get((x0 - 1) + ',' + y).y, he = land.get(x1 + ',' + y).y;
    hs.forEach((h, i) => decks.push(box(deckMat, x0 + i - (i === 0 && hw >= h ? 0.08 : 0), h - 0.24, y + 0.02, x0 + i + 1 + (i === hs.length - 1 && he >= h ? 0.08 : 0), h, y + 0.98, 1)));
    // the arch: a slab under the deck, an elliptic opening out of its underside, springing from the cliffs
    const lo = Math.min(...hs) - 0.24, sh = new THREE.Shape(), cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 - 0.05, yb = lo - 1.6, ry = 1.25;
    sh.moveTo(x0 - 0.3, lo); sh.lineTo(x1 + 0.3, lo); sh.lineTo(x1 + 0.3, yb);
    for (let q = 0; q <= 24; q++) { const a = q / 24 * Math.PI; sh.lineTo(cx + Math.cos(a) * rx, yb + Math.sin(a) * ry); }
    sh.lineTo(x0 - 0.3, yb); sh.closePath();
    const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.84, bevelEnabled: false, curveSegments: 1 }); ag.translate(0, 0, y + 0.08);
    const uv = ag.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    stone.push(new THREE.Mesh(ag, jade));
    // balustrades: a post at every half cell, rails and panels between, stepping with the deck
    for (const z of [y + 0.075, y + 0.925]) for (let q = 0; q <= (x1 - x0) * 2; q++) {
      const x = x0 + q / 2, i = Math.min(hs.length - 1, Math.floor(q / 2)), h = q % 2 === 0 && q > 0 ? Math.max(hs[i], hs[i - 1]) : hs[i];
      stone.push(box(jade, x - 0.05, h, z - 0.05, x + 0.05, h + 0.44, z + 0.05, 1));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), jade); cap.scale.set(1, 1.3, 1); cap.position.set(x, h + 0.49, z); stone.push(cap);
      if (q < (x1 - x0) * 2) { const hh = hs[Math.floor(q / 2)]; stone.push(box(jade, x + 0.05, hh + 0.33, z - 0.03, x + 0.45, hh + 0.39, z + 0.03, 1), box(jade, x + 0.07, hh + 0.06, z - 0.018, x + 0.43, hh + 0.27, z + 0.018, 1)); }
    }
  }
  g.add(merged(deckMat, decks), merged(jade, stone));
  return shade(g);
}
// the stele that keeps the 紅石古文書: a tall slab of red stone on a stepped white plinth, a round head, its face cut with
// bands of cloud filled in azure-green (青, the east's colour: the 東方守護靈's) inside a gilt border
function stele(x, z, y) {
  const g = new THREE.Group(), white = T.material(T.marble(0xe8e4da, 0x8a8a7c, 1), { roughness: 0.55 }, [0.5, 0.5]);
  const slab = T.material(T.pbr('krStele2', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 931), vein = T.smooth(0.03, 0.0, Math.abs(T.fbm(u, v, 3, 5, 932) - 0.5)), panel = u > 0.14 && u < 0.86 && v > 0.12 && v < 0.8;
    const lines = panel && Math.abs(((u - 0.14) / 0.72 * 5) % 1 - 0.5) < 0.17 && T.fbm(u * 2, v * 7, 5, 2, 933) > 0.5;
    const border = (Math.abs(u - 0.14) < 0.012 || Math.abs(u - 0.86) < 0.012) && v > 0.12 && v < 0.8 || (Math.abs(v - 0.12) < 0.012 || Math.abs(v - 0.8) < 0.012) && u > 0.14 && u < 0.86;
    let c = T.mixc([0.3, 0.1, 0.07], [0.46, 0.16, 0.1], n); c = T.mixc(c, [0.66, 0.32, 0.22], vein * 0.35);
    if (border) { c = [0.78, 0.6, 0.26]; o.m = 1; o.r = 0.3; } else if (lines) { c = [0.16, 0.46, 0.44]; o.r = 0.6; } else o.r = 0.3;
    o.c = c; o.h = 0.5 - (lines ? 0.2 : 0) - (border ? 0.1 : 0);
  }, 3), { clearcoat: 0.6, clearcoatRoughness: 0.2 });
  g.add(box(white, x - 0.46, y, z - 0.3, x + 0.46, y + 0.12, z + 0.3, 0.5), box(white, x - 0.38, y + 0.12, z - 0.24, x + 0.38, y + 0.24, z + 0.24, 0.5));
  g.add(box(slab, x - 0.3, y + 0.24, z - 0.14, x + 0.3, y + 1.8, z + 0.14, 1));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.28, 28, 1, false, -Math.PI / 2, Math.PI), slab); crown.rotation.x = -Math.PI / 2; crown.position.set(x, y + 1.8, z); crown.scale.set(1, 1, 0.75);
  g.add(crown);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 1, roughness: 0.3 });
  g.add(box(gold, x - 0.31, y + 0.24, z - 0.15, x + 0.31, y + 0.28, z + 0.15, 1));
  // the head carved with a cloud scroll each side (a coil of the 青 band), the spine of the slab edged
  return shade(g);
}
// the gate behind the summit (a 牌坊): four white-jade posts on drum bases, the middle bay higher, beams and a gilt
// panel, roofs of blue-green glaze with upturned eaves
function gate(jade, cx, z, y) {
  const g = new THREE.Group(), roofT = T.material(T.roofTiles(0x2a6a64, 8, 8), { roughness: 0.4, clearcoat: 0.5 }, [1, 1]), gold = new THREE.MeshStandardMaterial({ color: 0xc89a40, metalness: 1, roughness: 0.32 });
  const xs = [cx - 1.85, cx - 0.62, cx + 0.62, cx + 1.85], hs = [2.3, 2.95, 2.95, 2.3];
  xs.forEach((x, i) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, hs[i], 12), jade); p.position.set(x, y + hs[i] / 2, z); g.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.32, 12), jade); base.position.set(x, y + 0.16, z); g.add(base); });
  const bay = (x0, x1, top, w) => {
    g.add(box(jade, x0 - 0.08, top - 0.42, z - 0.1, x1 + 0.08, top - 0.26, z + 0.1, 1), box(jade, x0 - 0.06, top - 0.9, z - 0.08, x1 + 0.06, top - 0.78, z + 0.08, 1));
    // the roof: a hipped ridge with the eaves swept up at the corners
    const len = x1 - x0 + 0.7, geo = new THREE.BoxGeometry(len, 0.2, w, 12, 1, 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), e = Math.abs(px) / (len / 2);
      const ridge = py > 0 ? (1 - Math.abs(pz) / (w / 2)) * 0.22 : 0; p.setY(i, py + ridge + Math.pow(e, 4) * 0.16); p.setZ(i, pz * (py > 0 ? 1 : 0.9)); }
    geo.computeVertexNormals(); const r = new THREE.Mesh(geo, roofT); r.position.set((x0 + x1) / 2, top - 0.12, z); g.add(r);
  };
  bay(xs[1], xs[2], y + hs[1] + 0.25, 0.62); bay(xs[0], xs[1], y + hs[0] + 0.2, 0.54); bay(xs[2], xs[3], y + hs[0] + 0.2, 0.54);
  g.add(box(gold, cx - 0.36, y + hs[1] - 0.65, z - 0.09, cx + 0.36, y + hs[1] - 0.47, z + 0.09, 1));
  return shade(g);
}

function ground(x, z) {
  if (!built) return 0;
  const cx = Math.floor(x), cz = Math.floor(z), k = cx + ',' + cz, b = bridgeH.get(k); if (b != null) return b;
  const c = lvl.get(k); if (c) return c.st ? LV.at(x, z) : c.y;
  return field.sAt(x, z) <= 0 ? field.topAt(x, z) : VOID;
}
function openChest(x, y) {
  const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
  if (g) S.remove(g);
  const o = chest(M, x + 0.5, y + 0.5, ground(x + 0.5, y + 0.5), true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
export const kunlunReimagined = {
  build, ground, openChest, particles: null,
  get props() { return props; }, get slopes() { return slopes; },
  // dawn over the cloud: a low gold sun from the east, a cool clear sky, the cloud below throwing warm light back up
  mood: { bg: 0xc8c4d8, voidCol: false, fog: 0xc4c0d6, fogD: 0.006, sky: 0xa8bce8, under: 0xd8b8a8, hemi: 0.6,
    sun: 0xffc890, sunI: 3.7, sunDir: [0.62, 0.55, 0.5], sat: 1.1, exposure: 1.0, bloom: 0.22, aoR: 0.8,
    env: { top: 0xb8c8f0, mid: 0xe8c8a8, low: 0xb8a8c0, lights: [[9, 6, 6, 0xffd0a0, 3]] } },
};
