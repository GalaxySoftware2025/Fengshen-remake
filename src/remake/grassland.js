// 臨潼關草原 (maps 0ec58e / 0ec5d6, the same art: scene 15 and battle 8), remade: the grassland below 臨潼關, tall golden
// grass with wildflowers, a river across it from the west (rows 13-19) between banks of brown boulders, crossed where
// the grass runs over in two tongues (x 9-12 and x 18-20), and a lake in the north-east (x 13-23, rows 0-9) under its own
// boulder bank. The heroes come up from the south bank (deploy (8, 20), (5, 20), (7, 21)); 黃飛虎 stands at the river's
// north bank (15, 13). Bright morning.
// Chests: (12, 13) and (18, 2) as drawn; (0, 0) and (0, 23) are not drawn (hidden: battle 8's hook module).
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, shrubs, windTick } from '../kit/terrain.js';
import { D } from '../rules.js';

const MW = 24, MH = 25, WATER = -0.42, DEPLOY = [8, 20];
const PALETTE = { [CL.grass]: [0xb49024, 0xd8b448], [CL.water]: [0x000048, 0x0000b4, 0x0090fc, 0xd8fcfc],
  [CL.rock]: [0x484824, 0xd86c24, 0xfcfc90, 0x240000] };
const FLOWER = { 0xd82400: 'red', 0xfc6cb4: 'red', 0xb46cfc: 'purple', 0x6c00b4: 'purple' };
const CHESTS = [[12, 13], [18, 2]];
const OPEN = [[15.1, 13.5, 0.5]];   // spots scene 15's cast stands on, kept clear of the bank (tools/qa/sets.js)
let land = null, chestG = new Map(), M = null, world = null;

// the wildflowers the art strews over the grass: where its little red and purple clusters are, a clump of that colour
export async function flowerSpots(src = 'assets/maps/0ec58e.png', palette = FLOWER) {   // (also 聖靈山's meadow: src/remake/mountain.js)
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data, hits = new Map();
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const k = (y * img.width + x) * 4, kind = palette[(d[k] << 16) | (d[k + 1] << 8) | d[k + 2]]; if (!kind) continue;
    const key = Math.floor(x / 16) + ',' + Math.floor(y / 16), h = hits.get(key) || { kind, x: 0, y: 0, n: 0 }; h.x += x; h.y += y; h.n++; hits.set(key, h);
  }
  return [...hits.values()].filter(h => h.n >= 4).map(h => ({ kind: h.kind, x: h.x / h.n / 32, z: h.y / h.n / 32 }));
}
// a clump of small five-petalled flowers on short stems: three instanced meshes (stems, heads coloured per flower,
// their gold eyes) rather than three meshes a flower (~670 draws, twice over with the shadows: frame rate [the user])
export function flowers(spots, at) {
  const g = new THREE.Group(), stem = new THREE.MeshStandardMaterial({ color: 0x4a6a24, roughness: 0.9 });
  const shape = new THREE.Shape(); for (let k = 0; k <= 50; k++) { const a = k / 50 * Math.PI * 2, r = 0.05 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); shape[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const head = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mid = new THREE.SphereGeometry(0.014, 6, 4), stick = new THREE.CylinderGeometry(0.006, 0.008, 1, 4).translate(0, 0.5, 0);
  const cols = { red: [0xe8302a, 0xf070a8], purple: [0xa060f0, 0x7028c0] }, eye = new THREE.MeshStandardMaterial({ color: 0xf8e040, emissive: 0x302000 });
  const petal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x141414 });
  const n = spots.length * 6, stems = new THREE.InstancedMesh(stick, stem, n), heads = new THREE.InstancedMesh(head, petal, n), eyes = new THREE.InstancedMesh(mid, eye, n);
  const d = new THREE.Object3D(), c = new THREE.Color();
  let s = 1, i = 0;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const p of spots) for (let j = 0; j < 6; j++, i++) {
    const x = p.x + (rnd() - 0.5) * 0.4, z = p.z + (rnd() - 0.5) * 0.3, y = at(x, z), h = 0.12 + rnd() * 0.12;
    d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
    d.position.set(x, y + h, z); d.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5); d.scale.set(1, 1, 1); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
    heads.setColorAt(i, c.setHex(cols[p.kind][j % 2]));
    d.position.set(x, y + h + 0.01, z); d.rotation.set(0, 0, 0); d.updateMatrix(); eyes.setMatrixAt(i, d.matrix);
  }
  for (const m of [stems, heads, eyes]) { m.computeBoundingSphere(); m.castShadow = true; g.add(m); }
  return g;
}

// where the water is, 4 texels a cell over the map and 20 cells round it (the set's `outside` past the map), blurred: the
// shader finds the banks where it falls off (foam)
const PAD = 20;
function shoreMask(lay, W, outside) {
  const K = 4, cw = (MW + PAD * 2) * K, ch = (MH + PAD * 2) * K, c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'), img = g.createImageData(cw, ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = i / K - PAD, z = j / K - PAD, xi = Math.floor(x * 4), zi = Math.floor(z * 4);
    const wet = x >= 0 && z >= 0 && x < MW && z < MH ? lay[zi * W + xi] === CL.water : outside(x, z) === CL.water;
    const k = (j * cw + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = wet ? 255 : 0; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const b = document.createElement('canvas'); b.width = cw; b.height = ch; const bg = b.getContext('2d'); bg.filter = 'blur(3px)'; bg.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(b); t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter; return t;
}
// the river's material: the old flat blue (MeshStandardMaterial, so it lights as before) with, in its shader, a normal
// rippled by noise flowing east (the river runs west to east; slower on the lake), so the sun glints off it; light
// streaks drawn out along the current; foam bands lapping in and out where the mask falls off at the banks; twinkles
function riverWater(mask) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0c1c4a, roughness: 0.2, metalness: 0, envMapIntensity: 0.2 });
  const u = m.userData.u = { uTime: { value: 0 }, uMask: { value: mask }, uBox: { value: new THREE.Vector4(-PAD, -PAD, MW + PAD * 2, MH + PAD * 2) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime; uniform sampler2D uMask; uniform vec4 uBox;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // smooth noise: quintic blend, each octave turned so no grid lines up (the old value noise read as pixels: the user)
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
      float wf(vec2 p){ mat2 r = mat2(0.8, -0.6, 0.6, 0.8); float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += wn(p) * a; p = r * p * 2.07 + 5.3; a *= 0.5; } return s / 0.875; }
      // the ripples: directional waves running mostly downstream, each with its exact slope (smooth at any distance),
      // their heights swelling and easing with a slow noise
      vec3 waves(vec2 p, float flow){
        vec3 h = vec3(0.0);   // height, d/dx, d/dz
        const int N = 6; vec2 D[6]; D[0] = vec2(1.0, 0.18); D[1] = vec2(0.92, -0.38); D[2] = vec2(0.7, 0.71); D[3] = vec2(1.0, -0.05); D[4] = vec2(0.45, -0.89); D[5] = vec2(0.85, 0.52);
        float F[6]; F[0] = 3.1; F[1] = 4.3; F[2] = 5.9; F[3] = 8.2; F[4] = 10.7; F[5] = 13.9;
        float sw = 0.6 + 0.8 * wf(p * 0.35 + vec2(-uTime * 0.05, 0.0));
        for (int i = 0; i < N; i++) { vec2 k = normalize(D[i]) * F[i]; float A = 0.05 / F[i] * sw, ph = dot(k, p) - uTime * (1.2 + F[i] * 0.22) * mix(0.5, 1.0, flow) + float(i) * 1.7;
          h.x += A * sin(ph); h.yz += A * cos(ph) * k; }
        return h;
      }
      // wavelets: ridged noise (crested, soft troughs) drifting with the current, two layers crossing; few of them, large
      // [the user: the crested version, with fewer ripples]
      float chop(vec2 p, float flow){ mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
        float a = 1.0 - abs(wn(p * 2.0 - vec2(uTime * 0.9 * flow, uTime * 0.2)) * 2.0 - 1.0);
        float b = 1.0 - abs(wn(r * p * 3.3 + vec2(-uTime * 1.3 * flow, uTime * 0.45)) * 2.0 - 1.0);
        return smoothstep(0.0, 1.0, a) * 0.65 + smoothstep(0.0, 1.0, b) * 0.35; }
      float wetAt(vec2 p){ return texture2D(uMask, (p - uBox.xy) / uBox.zw).r; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec2 wp = vWp.xz; float flow = smoothstep(11.5, 12.5, wp.y) * (1.0 - smoothstep(20.0, 21.0, wp.y)) * 0.65 + 0.35;   // the river's band flows; the lake barely
      vec3 wv = waves(wp, flow); float w0 = 0.5 + wv.x * 8.0;
      float ce = 0.025, c0 = chop(wp, flow), cx = chop(wp + vec2(ce, 0.0), flow), cz = chop(wp + vec2(0.0, ce), flow);
      vec3 wN = normalize(vec3(-wv.y * 1.6 - (cx - c0) / ce * 0.03, 1.0, -wv.z * 1.6 - (cz - c0) / ce * 0.03));   // (gentle: at 0.05 it read as hammered metal, the user)
      normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float wet = wetAt(wp), lap = sin(uTime * 1.3 + wf(wp * 0.8) * 6.0) * 0.05;   // the waterline (wet 0.5 in the blurred mask) breathing in and out
      float ge = 0.08; vec2 gw = vec2(wetAt(wp + vec2(ge, 0.0)) - wetAt(wp - vec2(ge, 0.0)), wetAt(wp + vec2(0.0, ge)) - wetAt(wp - vec2(0.0, ge))) / (2.0 * ge);
      float dist = (wet - 0.56) / max(length(gw), 0.6) - lap;   // cells out from the waterline (by the mask's slope: a corner's slow falloff no longer widens it)
      float line = exp(-pow(dist / 0.035, 2.0));   // a thin lapping edge
      float foam = line * smoothstep(0.45, 0.8, wf(wp * vec2(2.5, 6.0) + vec2(-uTime * 0.5 * flow, uTime * 0.15))) * smoothstep(0.3, 0.45, wet);   // broken up, drifting with the current
      float shallow = (1.0 - smoothstep(0.0, 0.45, dist)) * smoothstep(-0.05, 0.05, dist);   // the shallows by the banks, a lighter blue
      float open_ = smoothstep(0.8, 0.95, wet);   // out in the stream
      float streak = smoothstep(0.62, 0.9, wf(wp * vec2(0.6, 4.5) - vec2(uTime * 0.8 * flow, 0.0))) * open_;
      float crest = smoothstep(0.55, 0.85, w0) * open_, glint = smoothstep(0.56, 0.74, c0) * open_ * (0.6 + 0.4 * sin(uTime * 3.0 + wp.x * 2.0 + wp.y * 1.3));   // the wavelets' crests catching the light
      vec2 sg = floor(wp * 6.0); float sr = wh(sg), tw = max(0.0, sin(uTime * (2.0 + 4.0 * sr) + sr * 60.0));   // twinkles: one now and then, at a jittered point in its cell, soft round
      vec2 sj = vec2(wh(sg + 3.1), wh(sg + 7.7)) * 0.6 + 0.2;
      float star = step(0.97, sr) * tw * tw * exp(-pow(length(fract(wp * 6.0) - sj) / 0.07, 2.0)) * open_;
      vec3 vv = normalize(cameraPosition - vWp); float fres = pow(1.0 - clamp(dot(wN, vv), 0.0, 1.0), 4.0);   // a little reflection: the pale sky caught more as the eye grazes the surface, rippled by the waves [the user's call]
      float skyN = wf(reflect(-vv, wN).xz * 1.5 + vec2(uTime * 0.02, 0.0));   // soft clouds in it
      totalEmissiveRadiance += vec3(0.42, 0.56, 0.72) * fres * (0.6 + 0.5 * skyN) * open_ + vec3(0.06, 0.09, 0.13) * (0.5 + 0.5 * skyN) * open_ * 0.5;
      totalEmissiveRadiance += vec3(0.6, 0.72, 0.85) * foam * 0.16 + vec3(0.03, 0.1, 0.16) * shallow * (0.8 + 0.2 * sin(uTime * 0.9 + wp.x * 0.7)) + vec3(0.16, 0.3, 0.62) * streak * 0.6 + vec3(0.03, 0.07, 0.16) * crest + vec3(0.16, 0.24, 0.36) * glint + vec3(0.9, 0.95, 1.0) * star * 1.4;`);
  };
  m.customProgramCacheKey = () => 'riverWater';
  return m;
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const lay = await readLayout('assets/maps/0ec58e.png', MW, MH, PALETTE, { [CL.water]: 1.3 });
  const W = MW * 4;
  // the land follows the game's own grid (D.terrain): a cell anyone may enter is level ground; a blocked cell is the
  // river or the lake where the art has mostly water, else the boulder bank
  const tc = (cx, cy) => D.terrain && D.terrain[cy] ? D.terrain[cy][cx] : 0;
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH && tc(cx, cy) === 0;
  const reach = new Set();
  for (const q = [DEPLOY, [15, 13]]; q.length;) { const [x, y] = q.shift(); if (!open(x, y) || reach.has(x + ',' + y)) continue; reach.add(x + ',' + y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const blocked = !reach.has(cx + ',' + cy);
    let wet = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) wet += lay[(cy * 4 + j) * W + cx * 4 + i] === CL.water ? 1 : 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (cy * 4 + j) * W + cx * 4 + i;
      if (!blocked && (lay[k] === CL.rock || lay[k] === CL.water)) lay[k] = CL.grass;
      else if (blocked) lay[k] = wet >= 6 ? CL.water : CL.rock;
    }
  }
  // where scene 15's cast stands at the bank's edge (黃飛虎's notch (15, 13) between boulders, at f1349-1388), the boulders give way
  for (const [ox, oz, r] of OPEN) for (let j = Math.floor((oz - r) * 4); j <= Math.floor((oz + r) * 4); j++) for (let i = Math.floor((ox - r) * 4); i <= Math.floor((ox + r) * 4); i++)
    if (Math.hypot((i + 0.5) / 4 - ox, (j + 0.5) / 4 - oz) <= r && i >= 0 && j >= 0 && i < W && j < MH * 4) lay[j * W + i] = CL.grass;
  // a bank of boulders where the water meets the grass: the art's brown rims stay rock on the water's side
  const walk = (cx, cy) => reach.has(cx + ',' + cy);
  lay.pebbles = lay.pebbles.filter(([x, z]) => walk(Math.floor(x), Math.floor(z)));
  for (const [x, y] of CHESTS) for (let j = y * 4; j < y * 4 + 4; j++) for (let i = x * 4; i < x * 4 + 4; i++) lay[j * W + i] = CL.ground;
  // past the map: the grassland goes on (the river runs on off the west and east edges, the lake off the north-east)
  const outside = (x, z) => (z > 13.2 && z < 19.5 && (x < 0 || x >= MW)) || (z < 0 && x > 13.5) || (x >= MW && z < 9) ? CL.water : CL.grass;
  const cap = (x, z) => z < MH - 0.5 ? 99 : 0.6;
  land = new Land({ w: MW, h: MH, layout: lay, ext: 12, outside, cap, carve: [{ r: [14.95, 12.95, 16.05, 13.97], h: 0.02 }],   // 黃飛虎's notch, level all over
     rockH: 0.45, rise: 0.62, lumpH: 0.05, waterDepth: -WATER + 0.12,
    tex: { dirt: T.dirt(0xa88a46, 'plainDirt'), turf: T.turf(0xa89a36), rock: T.rock(0x6a5240, 'bankRock', 0.25), rockTop: T.rock(0x7a6248, 'bankTop', 0.4) },
    tint: { dirt: 0xfff0d8, turf: 0xf0e4b0, rock: 0xe8c8a8 } });
  S.add(land.mesh({ dirtK: 0.3, rockK: 0.5, topGreen: 0.4, bed: 0x283a48 }));
  // the water: a deep blue that catches the sky (the original cycles two of its blues every 10 frames), alive [the user:
  // the same blue, more water effects]: ripples flowing downstream catch the sun, streaks drift with the current, foam
  // laps at the boulder banks, and points of light twinkle (riverWater)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MW + 40, MH + 40).rotateX(-Math.PI / 2), riverWater(shoreMask(lay, W, outside)));
  water.position.set(MW / 2, WATER, MH / 2); water.receiveShadow = true; S.add(water);
  for (const [x, y] of CHESTS) { const c = chest(M, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), false, 0, 1.4); S.add(c); chestG.set(x + ',' + y, c); }
  // tall golden grass over the plain, shorter at the banks; boulders and pebbles; the wildflowers; scrub on the banks
  const clear = (x, z) => !CHESTS.some(([cx, cy]) => x > cx - 0.2 && x < cx + 1.2 && z > cy - 0.2 && z < cy + 1.2);
  const near = (x, z) => x > -2.5 && z > -2.5 && x < MW + 2.5 && z < MH + 2.5;   // past the map (seen only at the view's edges) a third as thick: frame rate [the user]
  S.add(grass(land.scatter(CL.grass, 48, clear).filter(([x, , z]) => near(x, z) || Math.random() < 0.35), { size: 0.67, cols: ['#c8a848', '#b89a3a', '#d8bc5a', '#a88c34', '#9a8a3a'] }));
  S.add(grass(land.scatter(CL.ground, 6, clear), { size: 0.4, cols: ['#b0983e', '#9a8a3a', '#c0a448'] }));
  const rockM = T.material(T.rock(0x6a5240, 'bankRock', 0.25), { color: 0xf0d0b0 }, [0.5, 0.5]);
  // boulders and pebbles off the cells a unit can stand on (lying there they rose through the move squares: the user's
  // report); on those cells only grit, low enough to stay under them
  const off = (x, z) => !walk(Math.floor(x), Math.floor(z)), pebbles = lay.pebbles.filter(([x, z]) => clear(x, z)).map(([x, z]) => [x, land.at(x, z), z]);
  S.add(stones(land.scatter(CL.rock, 7, off), rockM, { size: 0.32 }));
  S.add(stones([...land.scatter(CL.rock, 2.2, off), ...pebbles.filter(([x, , z]) => off(x, z))], rockM, { size: 0.2 }));
  S.add(stones(pebbles.filter(([x, , z]) => !off(x, z)), rockM, { size: 0.05 }));
  S.add(shrubs(land.scatter(CL.rock, 0.5, (x, z) => land.weight(x, z, CL.grass) > 0.05), { size: 0.36, cols: ['#6a7a2a', '#7a8a32', '#5a6a24'] }));
  S.add(flowers((await flowerSpots()).filter(p => walk(Math.floor(p.x), Math.floor(p.z)) && clear(p.x, p.z)), (x, z) => land.at(x, z)));
  E.world.updaters.push((dt, t) => { windTick(t); water.material.color.setHSL(0.63, 0.7, 0.12 + Math.sin(t * 2.1) * 0.01); water.material.userData.u.uTime.value = t; });
}

function openChest(x, y) {
  const g = chestG.get(x + ',' + y);
  if (!g) return found(x, y);
  const p = g.position, S = g.parent; S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
// a chest the map does not draw ((0, 0), (0, 23): the plain's corners): struck, it shows up open
function found(x, y) {
  if (!land || !world) return;
  const cx = x + 0.5, cz = y + 0.5, g = chest(M, cx, cz, land.at(cx, cz), true, 0, 1.4); g.scale.setScalar(0.01); world.scene.add(g);
  let t = 0;
  const grow = dt => { t += dt; const k = Math.min(1, t / 0.35), e = 1 + 0.12 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) * (1 - k); g.scale.setScalar(1.4 * Math.max(0.01, k < 1 ? e * k ** 0.5 : 1)); if (k >= 1) world.updaters.splice(world.updaters.indexOf(grow), 1); };
  world.updaters.push(grow);
}

export default {
  build, openChest, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'grass', props: CHESTS,
  // a bright morning over the plain: a warm low sun from the east, a clear sky
  mood: { bg: 0xd8d4c4, voidCol: false, fog: 0xd8d4bc, fogD: 0.006, sky: 0xd8e4ff, under: 0x6a5a30, hemi: 1.0,
    sun: 0xfff0d0, sunI: 3.0, sunDir: [0.55, 0.7, 0.35], sat: 1.05, exposure: 1.0, bloom: 0.3, aoR: 0.8,
    env: { top: 0xd0e0ff, mid: 0xc8b890, low: 0x6a5a38, lights: [[6, 7, 3, 0xfff0d0, 3]] } },
};
