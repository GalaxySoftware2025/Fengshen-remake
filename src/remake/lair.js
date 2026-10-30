// The demon's lair under 摘星樓 (maps 0fd554 and 0fdcc0: scene 63's end, battle 32 and scene 64), reimagined: begun as an
// experiment in the art direction, as battle 25's (src/remake/kunlun-reimagine.js), and made the lair by the user's call
// over the first remake (the original's torn slabs over the void, in git before 8ba835e). Not those slabs but the place
// itself: the drowned sanctum of the Shang under the star-plucking tower, where 紂王 and 申公豹 fused.
// The board is battle 32's, cell for cell, and the original's pieces keep their places and their colours: the khaki slabs
// with their diamond lattice and star (here inlaid in bronze), the three towers, the crossbar, the great wall with its
// stair, the landing below, the void's deep blue and its cyan and violet stars (here the sky the black water mirrors).
//   the sanctum   every walkable cell (and the demon's dais) a walk of worn limestone flags standing a hand above its
//                 flooded courts; their faces dressed stone in courses, a coping along every edge, wet and slimed at the
//                 waterline; the courts walled all round outside the board (its walls a walk of capstones)
//   the courts    the gaps between the walks are water held almost to the floor (the user's call: the serpents, 蛇鬚,
//                 stood sunk in the floor's gaps, unseen): POOL, a quarter cell under the walks, so they rise out of it
//   the wall      row 11: the courts' south wall, a frieze of 雷紋 (thunder spirals) in bronze under its coping, braziers
//                 along its top, the stair of five steps through it to the landing (rows 12-13), a pier over the sea
//   the sea       far below the walls all round (the original's platforms hang over the void: the sanctum stands over this),
//                 black and still, mirroring a night of the void's stars and drifts of nebula; low mist on it; the broken
//                 columns of the drowned palace standing out of it; the walls buttressed down to it
//   behind him    the north wall a terrace; on it two great bronze 鼎 burning; behind the demon a bronze screen cast as a
//                 饕餮 mask, its eyes lit red while he lives, between two colossal pillars going up into the dark
//   the demon     his body the original's own pixels (demonBody), on the dais; at the seal it burns
//                 away, the mask's eyes and the embers in the floor's cracks round the dais going out with it
// Lit cold from above by the starlight, warm from the braziers, red off the demon.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, shade, merged, ding } from '../kit/parts.js';
import { D, G } from '../rules.js';
import { balustrade } from './kunlun-reimagine-props.js';

const MW = 24, UP = 0.6, LOW = 0, POOL = 0.36, SEA = -3.6, FACE = 12, WT = 0.5, NT = 1.3, Q = 4;   // WT: the side walls' depth, NT the north terrace's
const STAIR = { x0: 10, x1: 13, z0: 11, z1: 12, n: 5 };
const DAIS = { x0: 8, x1: 15, z0: 1, z1: 3 };   // the demon's place: cells 8-14 of rows 1-2 (the body stands on them)
const BRAZIER = [[6.4, -0.68], [16.6, -0.68]], WALLFIRE = [2.5, 7, 16, 20.5], SCREEN = { x0: 7.2, x1: 15.8, z: -1.55, h: 4.3 }, PILLARS = [4.6, 18.4];
const GLOW = { demon: [11.5, UP + 1.3, 2.6], left: [BRAZIER[0][0], UP + 1.25, BRAZIER[0][1]], right: [BRAZIER[1][0], UP + 1.25, BRAZIER[1][1]] };
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const NOISE_GLSL = `
  float lrh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lrn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lrh(i), lrh(i + vec2(1, 0)), f.x), mix(lrh(i + vec2(0, 1)), lrh(i + vec2(1, 1)), f.x), f.y); }`;
const U = { uTime: { value: 0 }, uLive: { value: 1 } };   // uLive: the demon's hold on the place, 1 until the seal burns it away
const REF = {};   // the water's and the mask's materials (what the seal dims)
let built = false, body = null, sealedNow = false, lvl = null;
const BODY = { x0: 8, y0: 1, w: 7, h: 3, base: 3.2 };   // (base: its foot just behind his head's cell, so the head stands before it)   // (extract/battles.js DEMON: the cut's cells)

// ---------------------------------------------------------------- the plan
// a board cell's floor level, null where the courts' water or the sea is
const terr = (x, y) => D.terrain[y] && D.terrain[y][x];
function cellLevel(x, y) {
  if (x < 0 || x >= MW || y < 0 || y > 13) return null;
  if (y === 11) return UP;   // the courts' south wall (the stair cut through it has its own steps)
  if (y >= 12) return terr(x, y) === 0 ? LOW : null;
  if (terr(x, y) === 0 || terr(x, y) === 1) return UP;
  if (x >= DAIS.x0 && x < DAIS.x1 && y >= DAIS.z0 && y < DAIS.z1) return UP;
  return null;
}
// at a point: the walls round the courts outside the board, then the board's cells
function levelAt(x, z) {
  if (x > -WT && x < MW + WT && z > -NT && z < FACE && (x < 0 || x >= MW || z < 0)) return UP;
  return cellLevel(Math.floor(x), Math.floor(z));
}
const kindAt = (x, z) => (x < 0 || x >= MW || z < 0 || Math.floor(z) === 11) ? 'cap' : 'floor';
const onStair = (x, z) => x >= STAIR.x0 && x < STAIR.x1 && z >= STAIR.z0 && z < STAIR.z1;
const stairY = z => { const k = Math.max(0, Math.min(STAIR.n - 1, Math.floor((z - STAIR.z0) / (STAIR.z1 - STAIR.z0) * STAIR.n))); return UP * (STAIR.n - k) / STAIR.n; };
const inCourts = (x, z) => x >= 0 && x < MW && z >= 0 && z < 11;
const waterAt = (x, z) => inCourts(x, z) ? POOL : SEA;

// ---------------------------------------------------------------- surfaces
// the walks' flags: pale khaki limestone a cell each, worn at the arrises, the original's diamond lattice and its star
// inlaid in tarnished bronze (thin: the slab carries the floor), a crack here and there; 2 x 2 slabs a texture
function slabTex() {
  return T.pbr('lrSlab3', 1024, (u, v, o) => {
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
  }, 3);
}
// the faces: dressed stone in courses a quarter high, blocks of uneven length, weathered grey-khaki, dark joints; 2 x 2
// units a texture
function ashlarTex() {
  return T.pbr('lrAshlar2', 1024, (u, v, o) => {
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
  }, 3);
}
// 雷紋 in bronze for the wall's frieze: two square spirals a texture across, raised, green in the hollows
function leiwenTex() {
  return T.pbr('lrLeiwen', 512, (u, v, o) => {
    const k = Math.floor(u * 2), cu = (u * 2 - k), cv = v, fx = k % 2 ? 1 - cu : cu;
    const px = fx - 0.5, py = cv - 0.5, d = Math.max(Math.abs(px), Math.abs(py)), ring = Math.floor((d + 0.02) / 0.11), f = ((d + 0.02) / 0.11) % 1;
    const side = Math.abs(px) > Math.abs(py) ? (px > 0 ? 0 : 2) : (py > 0 ? 1 : 3), gap = side === ring % 4 && Math.abs(Math.abs(px) > Math.abs(py) ? py : px) < 0.06 + ring * 0.02;
    const line = d < 0.47 && f > 0.25 && f < 0.75 && !gap ? 1 : 0, rim = Math.abs(cv - 0.5) > 0.47 ? 1 : 0;
    const n = T.fbm(u, v, 12, 3, 1401), lit = Math.max(line, rim);
    o.c = lit ? T.mixc([0.5, 0.36, 0.18], [0.66, 0.5, 0.28], n) : T.mixc([0.12, 0.22, 0.17], [0.2, 0.3, 0.22], n);
    o.m = lit ? 0.85 : 0.3; o.r = lit ? 0.4 : 0.75; o.h = 0.3 + lit * 0.5 + (n - 0.5) * 0.05;
  }, 4);
}
function sideMaterial() {
  const m = T.material(ashlarTex(), { roughness: 1 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWl; varying float vWl; varying vec3 vLW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWl = aWl; vLW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWl; varying vec3 vLW; float lrWet;' + NOISE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // the waterline: wet and dark under it, a band of slime at it, drips of damp above
        float lrY = vLW.y - vWl, lrD = lrn(vec2(vLW.x * 9.0 + vLW.z * 9.0, 1.3));
        lrWet = smoothstep(0.1 + lrD * 0.08, 0.0, lrY);
        diffuseColor.rgb *= mix(1.0, 0.45, lrWet);
        float slime = smoothstep(0.07, 0.0, abs(lrY - 0.025 - lrD * 0.03));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.08, 0.05), slime * 0.7);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, lrWet);');
  };
  m.customProgramCacheKey = () => 'lrSide';
  return m;
}
// the walks: the flags, damp toward the water, and round the dais the demon's veins: cracks glowing ember-red, slowly
// breathing, that die with him
function floorMaterial() {
  const m = T.material(slabTex(), { roughness: 1 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDamp; varying float vDamp; varying vec3 vLW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDamp = aDamp; vLW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime, uLive; varying float vDamp; varying vec3 vLW; float lrVein;' + NOISE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lrDm = vDamp * smoothstep(0.3, 0.6, lrn(vLW.xz * 2.3));
        diffuseColor.rgb *= 1.0 - lrDm * 0.28;
        vec2 lrP = vLW.xz - vec2(11.5, 2.4);
        float lrM = smoothstep(3.6, 1.2, length(lrP * vec2(0.75, 1.0))) * smoothstep(0.42, 0.6, lrn(vLW.xz * 0.9 + 4.0));
        float lrR = abs(lrn(vLW.xz * 1.9) * 0.6 + lrn(vLW.xz * 5.3 + 2.0) * 0.4 - 0.5);
        lrVein = smoothstep(0.012, 0.002, lrR) * lrM;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.06, 0.04), smoothstep(0.03, 0.006, lrR) * lrM * 0.8);   // (scorched along them)
        diffuseColor.rgb *= 1.0 - lrM * 0.12;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, lrDm);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.22, 0.04) * lrVein * uLive * (0.45 + 0.3 * sin(uTime * 1.1 + lrn(vLW.xz * 0.7) * 6.0));`);
  };
  m.customProgramCacheKey = () => 'lrFloor';
  return m;
}
// the black water: still, a slow swell; it mirrors a night of the void's stars (cyan, pale cyan, violet, twinkling) and
// drifts of nebula, and the braziers' and the demon's light in long trembling streaks. Its own shader (not tinted by the
// range: a square over it stays a square; src/battle.js overWater)
function waterMaterial(near) {
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLive: { value: 1 }, uNear: { value: null }, uNearBox: { value: new THREE.Vector4(...near.box) },
      uGlow: { value: [new THREE.Vector3(...GLOW.demon), new THREE.Vector3(...GLOW.left), new THREE.Vector3(...GLOW.right)] } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uLive; uniform vec3 uGlow[3]; uniform sampler2D uNear; uniform vec4 uNearBox; varying vec3 vW;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      float swell(vec2 p){ float t = uTime; return lrn(p * 1.1 + vec2(t * 0.05, t * 0.035)) * 0.5 + lrn(p * 2.7 - vec2(t * 0.08, -t * 0.03)) * 0.32 + lrn(p * 6.3 + vec2(-t * 0.12, t * 0.1)) * 0.18; }
      void main(){
        vec2 p = vW.xz; float e = 0.05, w0 = swell(p);
        float fine = lrn(p * 13.0 + vec2(uTime * 0.3, -uTime * 0.2)) - 0.5;
        vec3 N = normalize(vec3(-(swell(p + vec2(e, 0.0)) - w0) / e * 0.11 + fine * 0.03, 1.0, -(swell(p + vec2(0.0, e)) - w0) / e * 0.11 + fine * 0.03));
        vec3 V = normalize(cameraPosition - vW), Rf = reflect(-V, N), Rs = reflect(-V, normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.18)));
        float fr = 0.45 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        // the night it mirrors (by the reflected ray: the stars stay where they are as the eye moves, as a mirror's do): the
        // void's deep blue, drifts of nebula, a river of faint stars across it, and the stars themselves
        vec2 sp = Rs.xz / max(Rs.y, 0.12) * 70.0;
        float neb = lrn(sp * 0.018) * 0.6 + lrn(sp * 0.045 + 3.1) * 0.4, band = exp(-pow((dot(sp, vec2(0.55, 0.835)) + 8.0) / 26.0, 2.0));
        vec3 sky = mix(vec3(0.004, 0.007, 0.03), vec3(0.035, 0.035, 0.14), smoothstep(0.4, 0.9, neb));
        sky = mix(sky, vec3(0.02, 0.06, 0.15), smoothstep(0.5, 0.95, lrn(sp * 0.025 + 9.0)) * 0.6);
        sky += vec3(0.04, 0.035, 0.11) * band * (0.4 + 0.6 * smoothstep(0.3, 0.8, lrn(sp * 0.06 + 5.0)));
        vec2 g = floor(sp), f = fract(sp) - 0.5; float s = lrh(g), k = lrh(g + 3.3), big = step(0.992, s);
        float star = step(0.9 - band * 0.12, s) * smoothstep(0.16 + 0.2 * big, 0.0, length(f + (vec2(lrh(g + 1.1), lrh(g + 2.2)) - 0.5) * 0.5)) * (0.45 + 0.55 * sin(uTime * (1.0 + 2.5 * lrh(g + 1.7)) + s * 50.0)) * (0.5 + big * 1.5);
        sky += (k < 0.45 ? vec3(0.35, 0.78, 1.0) : k < 0.8 ? vec3(0.62, 0.95, 1.0) : vec3(0.6, 0.4, 1.0)) * star * 1.3;
        vec3 col = vec3(0.004, 0.007, 0.025) + sky * fr;
        // the fires' and the demon's light on it: a trembling streak toward the eye, a faint warmth round each
        for (int i = 0; i < 3; i++) {
          vec3 L = uGlow[i] - vW; float d = length(L); L /= d; float on = i == 0 ? uLive : 1.0;
          vec3 c = i == 0 ? vec3(1.0, 0.22, 0.06) : vec3(1.0, 0.55, 0.2);
          col += c * on * (pow(max(dot(Rf, L), 0.0), 140.0) * 1.3 + 0.05 / (1.0 + d * d * 0.35));
        }
        // where it meets the stone: a little darker under the walls, a thin bright line at the stone itself
        vec2 nu = (vW.xz - uNearBox.xy) / uNearBox.zw; float nd = (nu.x < 0.0 || nu.y < 0.0 || nu.x > 1.0 || nu.y > 1.0) ? 1.0 : texture2D(uNear, nu).r;
        col *= mix(0.55, 1.0, smoothstep(0.02, 0.4, nd));
        col += vec3(0.16, 0.2, 0.3) * smoothstep(0.045, 0.0, nd - 0.02 * (w0 - 0.5));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uNear.value = near.tex;
  m.userData.water = true;   // (src/battle.js overWater: a body of water lies at one level)
  return m;
}
// the mist on the sea: a thin cold veil, drifting
function mistMaterial(layer) {
  const m = new THREE.MeshBasicMaterial({ color: 0x3a4478, transparent: true, depthWrite: false, fog: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vMW;' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 mp = vMW.xz * ${(0.16 + layer * 0.07).toFixed(2)} + vec2(uTime * 0.02, uTime * 0.008) * ${(1 + layer).toFixed(1)} + ${(layer * 7.3).toFixed(1)};
        float mn = lrn(mp) * 0.55 + lrn(mp * 2.3 + 1.7) * 0.3 + lrn(mp * 5.1) * 0.15;
        diffuseColor.a = smoothstep(0.45, 0.85, mn) * ${(layer ? 0.18 : 0.3).toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'lrMist' + layer;
  return m;
}

// ---------------------------------------------------------------- the 饕餮 screen (painted on a canvas: its relief, then
// its bronze from the relief)
function taotie() {
  const W = 2048, H = 1024, PW = W / 2, PH = H / 2, c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d'); g.scale(0.5, 0.5);   // (drawn in 2048 x 1024, kept at half)
  const gray = v => { const q = Math.round(v * 255); return `rgb(${q},${q},${q})`; };
  g.fillStyle = gray(0.38); g.fillRect(0, 0, W, H);
  // the ground: 雷紋, fine, low
  const s = 34; g.lineWidth = 6; g.strokeStyle = gray(0.52);
  for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { g.beginPath(); const k = ((x / s) + (y / s)) % 2 ? 1 : -1, cx = x + s / 2, cy = y + s / 2;
    g.moveTo(cx, cy); g.lineTo(cx + k * 6, cy); g.lineTo(cx + k * 6, cy - 7); g.lineTo(cx - k * 7, cy - 7); g.lineTo(cx - k * 7, cy + 8); g.lineTo(cx + k * 12, cy + 8); g.lineTo(cx + k * 12, cy - 12); g.lineTo(cx - k * 14, cy - 12); g.stroke(); }
  // the frame and the top band
  g.strokeStyle = gray(0.82); g.lineWidth = 46; g.strokeRect(23, 23, W - 46, H - 46);
  g.fillStyle = gray(0.3); g.fillRect(46, 46, W - 92, 92);
  g.lineWidth = 10; g.strokeStyle = gray(0.72); for (let x = 70; x < W - 70; x += 92) { g.strokeRect(x, 62, 70, 60); g.strokeRect(x + 18, 80, 34, 24); }
  // the mask, the left half drawn and mirrored
  const half = () => {
    const raised = (path, v = 0.85, w = 70) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = gray(0.14); g.lineWidth = w + 22; g.stroke(path); g.strokeStyle = gray(v); g.lineWidth = w; g.stroke(path); };
    let p = new Path2D(); p.moveTo(-110, 330); p.bezierCurveTo(-260, 170, -520, 150, -650, 260); p.bezierCurveTo(-720, 330, -660, 430, -580, 410); p.bezierCurveTo(-520, 395, -530, 330, -585, 330); raised(p, 0.86, 74);   // the horn, curling out
    p = new Path2D(); p.moveTo(-90, 400); p.bezierCurveTo(-200, 360, -380, 360, -470, 420); raised(p, 0.8, 46);   // the brow
    p = new Path2D(); p.moveTo(-500, 520); p.bezierCurveTo(-620, 560, -760, 520, -830, 600); p.bezierCurveTo(-880, 660, -830, 740, -760, 720); p.bezierCurveTo(-700, 700, -720, 640, -770, 650); raised(p, 0.78, 54);   // the body, out to the side
    p = new Path2D(); p.moveTo(-860, 300); p.bezierCurveTo(-930, 380, -900, 470, -840, 480); raised(p, 0.74, 40);   // the ear
    p = new Path2D(); p.moveTo(-80, 610); p.bezierCurveTo(-140, 640, -180, 690, -150, 730); p.bezierCurveTo(-120, 760, -80, 740, -90, 710); raised(p, 0.8, 44);   // the nostril
    p = new Path2D(); p.moveTo(-60, 800); p.lineTo(-420, 800); p.bezierCurveTo(-520, 800, -560, 760, -560, 700); raised(p, 0.8, 50);   // the jaw
    // the eye: an almond, raised, its pupil a boss
    g.fillStyle = gray(0.14); g.beginPath(); g.moveTo(-460, 500); g.bezierCurveTo(-400, 410, -220, 410, -150, 505); g.bezierCurveTo(-230, 580, -400, 585, -460, 500); g.fill();
    g.fillStyle = gray(0.84); g.beginPath(); g.moveTo(-440, 500); g.bezierCurveTo(-385, 430, -235, 430, -175, 505); g.bezierCurveTo(-245, 562, -390, 566, -440, 500); g.fill();
    g.fillStyle = gray(0.2); g.beginPath(); g.arc(-305, 497, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = gray(1); g.beginPath(); g.arc(-305, 497, 50, 0, Math.PI * 2); g.fill();
    // the fangs
    g.fillStyle = gray(0.82); for (const [x, w, h] of [[-120, 46, 120], [-260, 40, 90]]) { g.beginPath(); g.moveTo(x - w, 822); g.lineTo(x + w, 822); g.lineTo(x, 822 + h); g.closePath(); g.fill(); }
  };
  g.save(); g.translate(W / 2, 0); half(); g.scale(-1, 1); half(); g.restore();
  // the flange down the middle, notched
  g.fillStyle = gray(0.14); g.fillRect(W / 2 - 34, 150, 68, 700); g.fillStyle = gray(0.9); g.fillRect(W / 2 - 24, 150, 48, 700);
  g.fillStyle = gray(0.3); for (let y = 200; y < 850; y += 90) g.fillRect(W / 2 - 24, y, 48, 16);
  g.fillStyle = gray(0.86); g.beginPath(); g.moveTo(W / 2 - 70, 560); g.lineTo(W / 2 + 70, 560); g.lineTo(W / 2 + 50, 700); g.lineTo(W / 2 - 50, 700); g.closePath(); g.fill();   // the snout
  // the bronze from the relief: rubbed gold on the high faces, dark metal between, green verdigris in the hollows;
  // the pupils lit (the emission map)
  const img = g.getImageData(0, 0, PW, PH), col = document.createElement('canvas'), em = document.createElement('canvas'); col.width = em.width = PW; col.height = em.height = PH;
  const cg = col.getContext('2d'), eg = em.getContext('2d'), ci = cg.createImageData(PW, PH), ei = eg.createImageData(PW, PH);
  for (let i = 0; i < PW * PH; i++) {
    const h = img.data[i * 4] / 255, x = i % PW, y = ((i / PW) | 0) * 2, n = T.fbm(x / PW, y / H, 18, 3, 1501), gr = T.smooth(0.5, 0.75, T.fbm(x / PW, y / H, 7, 3, 1502));
    let c = T.mixc([0.2, 0.14, 0.08], [0.32, 0.23, 0.13], n);
    c = T.mixc(c, [0.62, 0.47, 0.26], T.smooth(0.7, 0.9, h) * (0.6 + 0.4 * n));
    c = T.mixc(c, [0.14, 0.3, 0.24], T.smooth(0.42, 0.2, h) * (0.5 + 0.5 * gr));
    ci.data[i * 4] = c[0] * 255; ci.data[i * 4 + 1] = c[1] * 255; ci.data[i * 4 + 2] = c[2] * 255; ci.data[i * 4 + 3] = 255;
    const pu = h > 0.97 && y > 420 && y < 580 ? 255 : 0; ei.data[i * 4] = ei.data[i * 4 + 1] = ei.data[i * 4 + 2] = pu; ei.data[i * 4 + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); eg.putImageData(ei, 0, 0);
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t; };
  const map = tex(col); map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: tex(c), bumpScale: 5, metalness: 0.4, roughness: 0.55, emissiveMap: tex(em), emissive: new THREE.Color(1, 0.12, 0.04), emissiveIntensity: 2.2 });
  return m;
}

// ---------------------------------------------------------------- geometry
// the walks and walls: the level at a quarter cell over the board and its walls; a top a quarter cell each (the flags on
// the walks, capstones on the walls); a face wherever a level drops to a lower one or to water, down past the waterline,
// a coping along its top (one piece a run, so no corner opens)
function buildSanctum(S) {
  const X0 = -1, Z0 = -2, NX = (MW + 2) * Q, NZ = 16 * Q, s = 1 / Q;
  const lev = new Array(NX * NZ).fill(null), st = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = X0 + (i + 0.5) * s, z = Z0 + (j + 0.5) * s; lev[j * NX + i] = levelAt(x, z); st[j * NX + i] = onStair(x, z) ? 1 : 0; }
  lvl = { lev, st, NX, NZ, X0, Z0 };
  // how far each water point is from the stone (units, to 1): the water's line where it meets it
  { const F = 4, W = NX * F, H = NZ * F, d = new Uint8Array(W * H * 4), solidAt = (x, z) => { const i = Math.floor((x - X0) * Q), j = Math.floor((z - Z0) * Q); return i >= 0 && j >= 0 && i < NX && j < NZ && (lev[j * NX + i] !== null || st[j * NX + i] === 1); };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = X0 + (i + 0.5) / (Q * F), z = Z0 + (j + 0.5) / (Q * F); let best = 1;
      if (solidAt(x, z)) best = 0; else for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) { const r = Math.hypot(a, b) / Q; if (r < best && solidAt(x + a / Q, z + b / Q)) best = Math.max(0, r - 0.5 / Q); }
      const v = Math.round(best * 255); d[(j * W + i) * 4] = v; d[(j * W + i) * 4 + 3] = 255; }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    lvl.near = { tex: t, box: [X0, Z0, NX / Q, NZ / Q] }; }
  const L = (i, j) => i < 0 || j < 0 || i >= NX || j >= NZ ? null : lev[j * NX + i], isSt = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && st[j * NX + i] === 1;
  const wx = i => X0 + i * s, wz = j => Z0 + j * s;
  // the tops (damp: how near the water, for the flags)
  const top = { floor: { P: [], U: [], D: [] }, cap: { P: [], U: [], D: [] } };
  const damp = (i, j) => { let d = 9; for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (L(i + a, j + b) === null && !isSt(i + a, j + b)) d = Math.min(d, Math.hypot(a, b)); return T.smooth(3.2, 1.0, d); };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const h = L(i, j); if (h === null || isSt(i, j)) continue;
    const x0 = wx(i), x1 = x0 + s, z0 = wz(j), z1 = z0 + s, o = top[kindAt(x0 + s / 2, z0 + s / 2)], d = [damp(i, j), damp(i + 1, j), damp(i + 1, j + 1), damp(i, j + 1)];
    const v = [[x0, z1, d[3]], [x1, z1, d[2]], [x1, z0, d[1]], [x0, z1, d[3]], [x1, z0, d[1]], [x0, z0, d[0]]];
    for (const [x, z, dd] of v) { o.P.push(x, h, z); o.U.push(x * 0.5, -z * 0.5); o.D.push(dd); }
  }
  const mesh = (o, mat, attr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.U, 2)); if (attr) g.setAttribute(attr, new THREE.Float32BufferAttribute(o.D, 1)); g.computeVertexNormals(); return shade(new THREE.Mesh(g, mat)); };
  S.add(mesh(top.floor, floorMaterial(), 'aDamp'));
  S.add(mesh(top.cap, T.material(T.flags(0x8a7e68, 0x7c705c, 'lrCap', 3, 0, 0x2a2418), { roughness: 0.9 }, [1, 1]), null));
  // the faces: every edge of a level onto lower ground or water, as runs along the grid lines
  const runs = [];
  const edge = (i, j, ni, nj) => {   // the edge from (i, j) toward its neighbour: [top, bottom, waterline] or null
    const h = L(i, j); if (h === null || isSt(i, j)) return null;
    const n = L(ni, nj);
    if (isSt(ni, nj)) return h > LOW + 0.01 ? [h, LOW - 0.3, -9] : null;
    if (n !== null) return n < h - 0.01 ? [h, n, -9] : null;
    const wl = waterAt(wx(ni) + s / 2, wz(nj) + s / 2); return [h, wl - 0.35, wl];
  };
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const alongZ = dj === 0, A = alongZ ? NZ : NX, B = alongZ ? NX : NZ;   // (a face across x runs along z, and the other way)
    for (let b = 0; b < B; b++) {
      let cur = null;
      for (let a = 0; a <= A; a++) {
        const [x, z] = alongZ ? [b, a] : [a, b], e = a < A ? edge(x, z, x + di, z + dj) : null, key = e && e.join(',');
        if (cur && cur.key === key) { cur.n++; continue; }
        if (cur) runs.push(cur);
        cur = e ? { key, e, di, dj, x, z, n: 1 } : null;
      }
    }
  }
  const side = { P: [], U: [], D: [] }, copes = [], copeM = T.material(T.flags(0x8a7e68, 0x7c705c, 'lrCap', 3, 0, 0x2a2418), { roughness: 0.85 }, [1, 1]);
  for (const r of runs) {
    const [h, bot, wl] = r.e, len = r.n * s;
    // the boundary line and its direction
    let ax, az, bx, bz;
    if (r.dj === 0) { const x = r.di > 0 ? wx(r.x + 1) : wx(r.x); ax = x; bx = x; az = wz(r.z); bz = az + len; if (r.di < 0) { [az, bz] = [bz, az]; } }
    else { const z = r.dj > 0 ? wz(r.z + 1) : wz(r.z); az = z; bz = z; ax = wx(r.x); bx = ax + len; if (r.dj > 0) { [ax, bx] = [bx, ax]; } }
    const yt = h - 0.13, quad = (p, q2, q3, q4, uv) => { for (const k of [0, 1, 2, 0, 2, 3]) { const v = [p, q2, q3, q4][k]; side.P.push(...v); side.U.push(...uv[k]); side.D.push(wl); } };
    const ua = (r.dj === 0 ? az : ax) * 0.5, ub = (r.dj === 0 ? bz : bx) * 0.5;
    quad([ax, yt, az], [bx, yt, bz], [bx, bot, bz], [ax, bot, az], [[ua, yt * 0.5], [ub, yt * 0.5], [ub, bot * 0.5], [ua, bot * 0.5]]);
    // the coping: a profile run along the edge (out over the drop), its ends a little past the run's
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.012, 0); sh.lineTo(0.035, -0.023); sh.lineTo(0.035, -0.1); sh.lineTo(0, -0.13); sh.closePath();
    const ext = 0.035, g = new THREE.ExtrudeGeometry(sh, { depth: len + ext * 2, bevelEnabled: false }); g.translate(0, h, -ext);
    const m = new THREE.Mesh(g, copeM), nx = r.di, nz = r.dj;   // the profile's x is outward (the normal), its extrusion along the run
    m.matrixAutoUpdate = false;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    m.matrix.set(nx, 0, dx, ax, 0, 1, 0, 0, nz, 0, dz, az, 0, 0, 0, 1); m.updateMatrixWorld(true);
    copes.push(m);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(side.P, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(side.U, 2)); sg.setAttribute('aWl', new THREE.Float32BufferAttribute(side.D, 1)); sg.computeVertexNormals();
  S.add(shade(new THREE.Mesh(sg, sideMaterial())));
  S.add(mergedWorld(copeM, copes));
  // the frieze under the wall's coping, its south face (z FACE), but for the stair
  const fr = alt(T.material(leiwenTex(), { roughness: 1 }), 'lrFrieze'), fh = 0.17, fy = UP - 0.15;
  for (const [a, b] of [[-WT, STAIR.x0], [STAIR.x1, MW + WT]]) {
    const g = new THREE.PlaneGeometry(b - a, fh), uv = g.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setX(q, uv.getX(q) * (b - a) / (fh * 2));
    const p = new THREE.Mesh(g, fr); p.position.set((a + b) / 2, fy - fh / 2, FACE + 0.006); S.add(shade(p));
  }
  // the stair: five steps of the flags' stone, bronze on their noses, cheeks of dressed stone (the top step 3 mm under the
  // court's flags it meets: level with them, the two flickered)
  const stepM = alt(T.material(slabTex(), { roughness: 0.8 }, [0.5, 0.5]), 'lrStep'), M = mats(), steps = [], noses = [];
  for (let k = 0; k < STAIR.n; k++) { const za = STAIR.z0 + (STAIR.z1 - STAIR.z0) * k / STAIR.n, zb = za + (STAIR.z1 - STAIR.z0) / STAIR.n, y = UP * (STAIR.n - k) / STAIR.n;
    steps.push(box(stepM, STAIR.x0, LOW - 0.3, za, STAIR.x1, k ? y : y - 0.003, zb, 1)); noses.push(box(M.bronze, STAIR.x0 + 0.02, y - 0.03, zb - 0.025, STAIR.x1 - 0.02, y + 0.004, zb + 0.004, 4)); }
  S.add(shade(merged(stepM, steps)), shade(merged(M.bronze, noses)));
  for (const x of [STAIR.x0 - 0.07, STAIR.x1 - 0.01]) S.add(shade(box(copeM, x, LOW - 0.3, STAIR.z0 - 0.05, x + 0.08, UP + 0.05, STAIR.z1 + 0.01, 1)));   // (1 cm proud of the wall's face)
  // buttresses down the outer faces to the sea, every few cells (never against the landing's faces, where the pier is)
  const but = [], bm = sideMaterial(), bt = (x0, z0, x1, z1) => { const b = box(bm, x0, SEA - 0.4, z0, x1, UP - 0.16, z1, 0.5), g = b.geometry, n = g.attributes.position.count; g.setAttribute('aWl', new THREE.Float32BufferAttribute(new Array(n).fill(SEA), 1)); return b; };
  for (let z = 1.5; z < FACE - 1; z += 3.2) { but.push(bt(-WT - 0.32, z - 0.3, -WT + 0.02, z + 0.3), bt(MW + WT - 0.02, z - 0.3, MW + WT + 0.32, z + 0.3)); }
  for (const x of [-WT + 0.3, 1.8, MW - 1.8, MW + WT - 0.3]) but.push(bt(x - 0.3, FACE - 0.02, x + 0.3, FACE + 0.3));
  for (const b of but) S.add(shade(b));
  // balustrades of weathered stone along the courts' walls outside the board and the great wall's brink, open at the stair
  const balM = alt(T.material(T.rock(0x7a6e5c, 'lrBal', 0.4), { roughness: 0.85 }, [0.5, 0.5]), 'lrBal'), e = WT - 0.1, zf = FACE - 0.1;
  const line = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))); return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  S.add(shade(balustrade(balM, [line([-e, zf], [-e, -NT + 0.1]), line([MW + e, zf], [MW + e, -NT + 0.1]), line([-e, zf], [STAIR.x0 - 0.15, zf]), line([STAIR.x1 + 0.15, zf], [MW + e, zf])], UP)));
}
// pieces each with its own matrix (not position/rotation) as one mesh
function mergedWorld(mat, meshes) {
  const P = [], N = [], Uv = [];
  for (const m of meshes) { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(m.matrix); g.computeVertexNormals(); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); Uv.push(...g.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2));
  return shade(new THREE.Mesh(g, mat));
}
const alt = (m, key) => { const k0 = m.customProgramCacheKey.bind(m); m.customProgramCacheKey = () => k0() + key; return m; };

// a bowl's coals seen from above: a dim glow under the flame, not an orange disc
const dimCoals = g => g.traverse(o => { const m = o.material; if (o.isMesh && m && !m.map && m.emissiveIntensity > 0.5) { m.emissiveIntensity = 0.35; m.color.setHex(0x120804); } });
// behind him: the north terrace's braziers, the screen and its pillars, the lintel over them
function buildShrine(E, S, FX) {
  const M = mats(), stone = T.material(ashlarTex(), { roughness: 0.9 }, [0.5, 0.5]);
  for (const [x, z] of BRAZIER) { const d = ding(M, x, z, UP, 1.25); S.add(d.g); dimCoals(d.g); FX.fire(E, { x, y: z, z: d.rim - UP - 0.04, size: 0.75, light: 5, col: 0xff8a3a, smoke: false }); }
  for (const x of WALLFIRE) { const d = ding(M, x, 11.45, UP, 0.75); S.add(d.g); dimCoals(d.g); const n0 = S.children.length; FX.fire(E, { x, y: 11.45, z: d.rim - UP - 0.03, size: 0.6, light: 5, col: 0xff8a3a, smoke: false });
    for (const o of S.children.slice(n0)) if (o.isSprite) o.scale.multiplyScalar(0.5); }   // (its halo small: seen from above a big one is an orange disc)

  const ml = new THREE.PointLight(0xff9a58, 14, 9, 1.4); ml.position.set((SCREEN.x0 + SCREEN.x1) / 2, UP + 2.4, SCREEN.z + 1.6); S.add(ml);   // (the fires' light on the mask)
  // the screen: a plinth of dressed stone out of the sea, the bronze mask on it in a frame
  const { x0, x1, z, h } = SCREEN, w = x1 - x0;
  S.add(shade(box(stone, x0 - 0.5, SEA - 0.3, z - 0.55, x1 + 0.5, UP + 0.35, z + 0.3, 0.5)));
  const pm = taotie(); REF.mask = pm;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); panel.position.set((x0 + x1) / 2, UP + 0.35 + h / 2, z + 0.02); S.add(shade(panel));
  S.add(shade(box(M.bronze, x0 - 0.18, UP + 0.35, z - 0.25, x1 + 0.18, UP + 0.55, z + 0.1, 2)), shade(box(stone, x0 - 0.3, UP + 0.35 + h, z - 0.4, x1 + 0.3, UP + 0.75 + h, z + 0.12, 0.5)));
  // the pillars: drums of dark stone banded in bronze on square bases, going up out of sight; a lintel across
  const drum = T.material(T.pbr('lrPillar', 512, (u, v, o) => {
    const n = T.fbm(u, v, 6, 4, 1601), fl = Math.abs(((u * 16) % 1) - 0.5), flute = T.smooth(0.3, 0.46, fl), streak = T.fbmA(u, v, 30, 2, 3, 1602);
    o.c = T.mixc(T.mixc([0.2, 0.17, 0.15], [0.3, 0.26, 0.22], n), [0.38, 0.12, 0.08], T.smooth(0.55, 0.75, T.fbm(u, v, 4, 3, 1603)) * 0.5);   // (old red lacquer left in patches)
    o.c = T.mixc(o.c, [0.12, 0.11, 0.1], T.smooth(0.6, 0.85, streak) * 0.4);
    o.r = 0.8; o.h = 0.5 - flute * 0.15 + (n - 0.5) * 0.08;
  }, 3), { roughness: 1 }, [1, 3]);
  for (const x of PILLARS) {
    const zc = z - 0.05, H = 9;
    S.add(shade(box(stone, x - 0.62, SEA - 0.3, zc - 0.62, x + 0.62, UP + 0.45, zc + 0.62, 0.5)));
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, H, 32), drum); p.position.set(x, UP + 0.45 + H / 2, zc); S.add(shade(p));
    for (const y of [0.25, 1.4, 2.9, 4.4]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 32), M.bronze); b.position.set(x, UP + 0.45 + y, zc); S.add(shade(b)); }
  }
  S.add(shade(box(stone, PILLARS[0] - 0.6, UP + 5.6, z - 0.5, PILLARS[1] + 0.6, UP + 6.3, z + 0.4, 0.5)));
}
// the drowned palace round the sanctum: broken columns standing out of the sea, one fallen; never on the board
function buildRuins(S) {
  const mat = T.material(T.rock(0x4a4038, 'lrRuin', 0.5), { roughness: 0.92 }, [0.5, 1]), out = [];
  const spots = [[-3.2, 3.5, 0.36, 2.6], [-4.6, 9.2, 0.3, 1.2], [-2.6, 15.6, 0.28, 0.7], [-7.5, -2.5, 0.42, 3.4], [-8.5, 6.5, 0.36, 1.8],
    [27.4, 2.6, 0.38, 2.2], [28.6, 9.6, 0.3, 0.9], [26.4, 15.2, 0.28, 0.6], [31.5, -3.2, 0.44, 3.6], [32.2, 6.8, 0.34, 1.5], [3.5, 17.5, 0.3, 0.5], [21, 17.2, 0.3, 0.8], [-1.5, -5.5, 0.4, 2.8], [25.6, -5.2, 0.4, 3.1]];
  spots.forEach(([x, z, r, h], i) => {
    const L = h + 2.6, g = new THREE.CylinderGeometry(r * 0.95, r, L, 20, 8), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) > L / 2 - 0.01) p.setY(k, p.getY(k) - R(i * 13 + k * 0.7) * r * 1.1 * (0.4 + 0.6 * Math.abs(Math.sin(Math.atan2(p.getZ(k), p.getX(k)) * 2 + i))));   // (a broken top)
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.position.set(x, SEA - 1.2 + L / 2, z); m.rotation.set((R(i + 0.3) - 0.5) * 0.14, R(i) * 6, (R(i + 0.7) - 0.5) * 0.14); out.push(shade(m));
  });
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 4.2, 20), mat); f.rotation.set(0.12, 0.4, Math.PI / 2); f.position.set(-3.4, SEA + 0.08, 6.4); out.push(shade(f));   // the fallen one
  for (const o of out) S.add(o);
}

// the demon's body: the original's pixels on a card, stood up and leaning back to the camera as the cast are; its foot on
// the platform behind his head, at the level up
function demonBody(S, up = UP) {
  const tex = new THREE.TextureLoader().load('assets/fx/hd/demon-body.png'); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.42, 0.42, 0.42), alphaTest: 0.5, side: THREE.DoubleSide });
  const u = { uDissolve: { value: 0 }, uBurn: { value: new THREE.Color(1, 0.55, 0.2) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uDissolve; uniform vec3 uBurn;
      float bh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float bn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(bh(i),bh(i+vec2(1,0)),f.x), mix(bh(i+vec2(0,1)),bh(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      float dn = bn(vMapUv * vec2(28.0, 12.0)) * 0.7 + bn(vMapUv * vec2(90.0, 40.0)) * 0.3 + (1.0 - vMapUv.y) * 0.25;
      if (uDissolve > 0.0 && dn < uDissolve * 1.3 - 0.1) discard;
      float edge = uDissolve > 0.0 ? smoothstep(0.08, 0.0, dn - (uDissolve * 1.3 - 0.1)) : 0.0;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uBurn * edge * 2.5;'); };
  const g = new THREE.PlaneGeometry(BODY.w, BODY.h); g.translate(0, BODY.h / 2, 0);
  const mesh = new THREE.Mesh(g, m); mesh.position.set(BODY.x0 + BODY.w / 2, up, BODY.base); mesh.rotation.x = -0.49;   // (the cast's lean at the battle's pitch: actors.js)
  mesh.renderOrder = 1; mesh.userData.noRange = true; S.add(mesh);   // (noRange: his head stands on a blocked cell, and the see-through would cut a window in the body there, battle.js OBSTRUCT)
  const glow = new THREE.PointLight(0xff4a20, 2.2, 6, 1.8); glow.position.set(11.5, up + 0.9, 4.6); S.add(glow);
  return { mesh, u, glow };
}

function burnBody(b, k) {
  b.u.uDissolve.value = Math.min(1, k); b.glow.intensity = 3 * (1 - k) + 6 * Math.sin(Math.PI * Math.min(1, k));
  if (k >= 1) { b.mesh.visible = false; b.glow.visible = false; }
}

// ---------------------------------------------------------------- the set
async function build(E, FX) {
  const S = E.world.scene; built = false;
  buildSanctum(S);
  const wm = waterMaterial(lvl.near); REF.water = wm;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(MW + 0.6, 11.6).rotateX(-Math.PI / 2), wm); pool.position.set(MW / 2, POOL, 5.5); S.add(pool);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), wm); sea.position.set(MW / 2, SEA, 8); S.add(sea);
  for (const L of [0, 1]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), mistMaterial(L)); v.position.set(MW / 2, SEA + 0.12 + L * 0.3, 8); v.renderOrder = 2 + L; v.userData.noRange = true; S.add(v); }
  buildShrine(E, S, FX);
  buildRuins(S);
  sealedNow = (D.n === 'scene' && +D.scene === 64) || (D.n === 32 && G.sealed);   // (scene 64 plays after the seal)
  body = sealedNow ? null : demonBody(S, UP);
  setLive(sealedNow ? 0 : 1);
  E.world.updaters.push((dt, t) => { U.uTime.value = t; wm.uniforms.uTime.value = t; });
  built = true;
}
function setLive(k) { U.uLive.value = k; if (REF.water) REF.water.uniforms.uLive.value = k; if (REF.mask) REF.mask.emissiveIntensity = 2.2 * k; }
// the seal (battle 32's second fall): the body burns away (burnBody), and his hold on the place with it
function seal(k) {
  if (!body) return;
  burnBody(body, k); setLive(Math.max(0, 1 - k * 1.2));
  if (k >= 1) { sealedNow = true; setLive(0); }
}
function ground(x, z) {
  if (!built || !lvl) return UP;
  if (onStair(x, z)) return stairY(z);
  const h = levelAt(x, z); if (h !== null) return h;
  return waterAt(x, z);
}
// the cells under the body (blocked; it stands there) and the terrain-1 cells of his place
const UNDER = []; for (let y = 1; y <= 2; y++) for (let x = 8; x <= 14; x++) UNDER.push([x, y]); UNDER.push([11, 3]);
export const lair = {
  build, ground, seal, particles: null,
  props: UNDER, slopes: [[10, 11], [11, 11], [12, 11]],
  // night under the tower: a pale light from high in the south-west (the flags keep their khaki), a dim violet fill, the
  // blue in the water and the fog, the fires and the demon warm
  mood: { bg: 0x02040c, voidCol: false, fog: 0x060a1c, fogD: 0.018, sky: 0x7a86c0, under: 0x1c1428, hemi: 0.95,
    sun: 0xeae2d4, sunI: 2.5, sunDir: [-0.42, 0.82, 0.45], sat: 1.06, exposure: 1.1, bloom: 0.34, aoR: 0.8,
    env: { top: 0x4a5274, mid: 0x2c2840, low: 0x06081a, lights: [[-6, 6, 4, 0xc4d0ff, 3], [0, 3, -6, 0xff6a30, 1.8]] } },
};
