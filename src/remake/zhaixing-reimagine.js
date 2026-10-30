// 摘星樓 (battle 31), reimagined: an experiment in the art direction (#battle=31-reimagine). Built from what the place is
// rather than from the court's tiles: the summit of the tower 紂王 raised so high a hand might pluck the stars, on the
// night 朝歌 falls (battle 30's dusk). A throne terrace open to the sky, no walls and no roof: red columns carry bare
// beams against the night, silk hangs between them, white jade balustrades run round every edge. Below, the tower's
// own storeys step down in tiers of dark glazed eaves and lit lattice into a sea of cloud, lit orange from beneath where
// the city burns; smoke climbs out of it. Above, the stars, and behind the throne a bronze armillary turning slowly
// against them.
// The board and its levels are battle 31's as the court has them (src/remake/court.js: the same tiers, stairs and
// steps, so every unit walks and stands where it did), each piece rebuilt:
//   the floor      white jade, a slab a cell, inlaid in gold with constellations, and in the middle of the hall a
//                  star chart: the twenty-eight lodges round a sun (pale: the move squares stay dark on it)
//   the moat       紂王's 酒池, the wine pool: crimson, gold-kerbed, lamps floating on it
//   the throne end the throne under a gilt canopy, a black lacquer screen with the nine-tailed fox in gold (妲己's),
//                  the armillary beyond the alcove's edge on a bronze column from the roof below
//   the wings      a bronze celestial globe on a raised jade platform at each end, under a little pavilion roof
//   the lower court its pools opened into light wells down into the storey below, the glow of its fires coming up;
//                  the cauldrons kept
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { D } from '../rules.js';
import { Levels, mats, merged, box, pillar, parapet, curtain, ding, throne, stairs, shade, lantern } from '../kit/parts.js';
import { balustrade } from './kunlun-reimagine-props.js';

const Y = { hall: 0.6, tier1: 1.3, tier2: 2.0, mid: 0.3, low: -0.95, moat: -0.35, wing: 0.8, base: -2.3, deck: -2.32, cloud: -13 };
const TOP = Y.tier2 + 3.7;
const mx = x => 23 - x;
const STEPS = 7, LOW_STEPS = 4;
const STAIR = { x0: 10, x1: 13, z0: 5, z1: 7.6 };
const MOAT = [[7, 10, 8, 17], [8, 15.5, 9, 17], [9, 16.5, 10, 18], [10, 17.5, 13, 18], [13, 16.5, 14, 18], [14, 15.5, 15, 17], [15, 10, 16, 17]];
const WELLS = [[4, 25, 6, 27], [6, 26, 9, 27], [7, 27, 9, 31]];   // (and their mirrors)
const CHART = [11.5, 13.2];   // the star chart's middle, inside the moat's U
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const U = { uTime: { value: 0 } };

function levels() {
  const L = new Levels(24, 35, 4);
  L.set(4, 5.9, 19, 9.5, Y.hall).set(7, 3.4, 16, 5, Y.tier2).set(10, 1.2, 13, 3.4, Y.tier2).set(8, 5, 15, 7.6, Y.tier1)
    .set(4, 9.5, 19, 21.6, Y.mid).set(1, 16.9, 22, 19, Y.mid).set(3, 19, 20, 20, Y.mid)
    .set(4, 21, 19, 27, Y.low).set(7, 27, 16, 31, Y.low).set(10, 31, 13, 33, Y.low);
  for (const [a, b, c, d] of MOAT) L.set(a, b, c, d, Y.moat);
  for (const [a, b, c, d] of WELLS) { L.set(a, b, c, d, NaN); L.set(mx(c), b, mx(a), d, NaN); }   // open: the wells
  L.set(1, 14, 4, 16.9, Y.wing).set(19, 14, 22, 16.9, Y.wing);   // the globes' platforms (blocked cells, raised)
  L.stairs(STAIR.x0, STAIR.z0, STAIR.x1, STAIR.z1, Y.hall, Y.tier2, STEPS, 's');
  L.stairs(4, 9.5, 7, 10.1, Y.mid, Y.hall, 1, 's'); L.stairs(16, 9.5, 19, 10.1, Y.mid, Y.hall, 1, 's'); L.stairs(8, 9.5, 15, 10.1, Y.mid, Y.hall, 1, 's');
  L.stairs(10, 20.2, 13, 21.8, Y.low, Y.mid, LOW_STEPS, 's');
  return L;
}
const LV = levels();
const onFloor = (x, z) => LV.ramps.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) || !isNaN(LV.H[Math.floor(z * LV.R) * LV.w * LV.R + Math.floor(x * LV.R)]);
const ground = (x, z) => (x < 0 || z < 0 || x >= 24 || z >= 35 || !onFloor(x, z)) ? Y.base : LV.at(x, z);
const STAIR_CELLS = [];
for (let z = 5; z <= 7; z++) for (let x = 10; x <= 12; x++) STAIR_CELLS.push([x, z]);
for (let x = 4; x <= 18; x++) STAIR_CELLS.push([x, 9]);
for (const z of [20, 21]) for (let x = 10; x <= 12; x++) STAIR_CELLS.push([x, z]);

// ---------------------------------------------------------------- materials
// white jade: a slab a cell, faintly veined and clouded, the joints fine and grey
function jadeTex() {
  return T.pbr('zxJade', 512, (u, v, o) => {
    const su = (u * 2) % 1, sv = (v * 2) % 1, id = Math.floor(u * 2) + Math.floor(v * 2) * 2;
    const j = Math.min(su, 1 - su, sv, 1 - sv), joint = T.smooth(0.012, 0.0, j), bev = T.smooth(0.03, 0.006, j);
    const cloud = T.fbm(u + id * 0.37, v, 3, 4, 701), vein = 1 - T.smooth(0.0, 0.02, Math.abs(T.fbmA(u + id * 0.2, v, 2, 5, 3, 702) - 0.5));
    let c = T.mixc([0.93, 0.92, 0.88], [0.84, 0.86, 0.84], cloud * 0.8); c = T.mixc(c, [0.7, 0.72, 0.7], vein * 0.35);
    c = c.map(q => q * (0.97 + T.pnoise(id * 3.1, 0.5, 8) * 0.05)); c = T.mixc(c, [0.42, 0.42, 0.4], joint * 0.8);
    o.c = c; o.h = 0.55 - bev * 0.3 - joint * 0.3 + cloud * 0.04; o.r = 0.32 + cloud * 0.12 + joint * 0.5;
  }, 2);
}
// the floor: the jade, with constellations inlaid in gold (a short walk of stars joined by fine lines, one figure to most
// four-cell blocks) and the star chart in the hall's middle; by the world's x, z, whatever the level
function floorMaterial() {
  const m = T.material(jadeTex(), { envMapIntensity: 0.9 }, [1, 1]);
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vZW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vZW; float zxGold;
      vec2 zh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float zseg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      float zxInlay(vec2 p){
        vec2 c0 = floor(p / 4.0); float line = 1e3, star = 1e3;
        for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
          vec2 cc = c0 + vec2(float(ox), float(oy)), r0 = zh2(cc * 1.91 + 3.7); if (r0.x < 0.3) continue;
          vec2 s = (cc + 0.3 + 0.4 * zh2(cc * 7.13)) * 4.0, prev = s; float a = r0.y * 6.2832;
          for (int i = 0; i < 6; i++) { vec2 r = zh2(cc * 3.3 + float(i) * 1.7); if (i > 0) { a += (r.x - 0.5) * 2.2; s += vec2(cos(a), sin(a)) * (0.8 + 0.8 * r.y); line = min(line, zseg(p, prev, s)); }
            star = min(star, length(p - s) - (r.y > 0.75 ? 0.07 : 0.045)); prev = s; } }
        return max(1.0 - smoothstep(0.016, 0.032, line), 1.0 - smoothstep(0.0, 0.025, star));
      }
      float zxChart(vec2 p){
        vec2 d = p - vec2(${CHART[0].toFixed(2)}, ${CHART[1].toFixed(2)}); float r = length(d), a = atan(d.y, d.x) / 6.2832 + 0.5;
        float ring = 0.0; for (int i = 0; i < 4; i++) { float rr = i == 0 ? 0.55 : i == 1 ? 1.25 : i == 2 ? 2.05 : 2.85; ring = max(ring, 1.0 - smoothstep(0.012, 0.03, abs(r - rr))); }
        float tick = (r > 2.05 && r < 2.85) ? 1.0 - smoothstep(0.004, 0.012, abs(fract(a * 28.0) - 0.5) * 6.2832 * r / 28.0 * 0.5 - 0.0) : 0.0;
        float sun = r < 0.5 ? 1.0 - smoothstep(0.0, 0.03, r - 0.12 - 0.22 * pow(abs(cos(a * 6.2832 * 4.0)), 8.0)) : 0.0;
        float spokes = (r > 0.55 && r < 1.25) ? 1.0 - smoothstep(0.006, 0.016, abs(fract(a * 8.0) - 0.5) * 6.2832 * r / 8.0) : 0.0;
        return max(max(ring, tick), max(sun, spokes));
      }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec2 p = vZW.xz; float rc = length(p - vec2(${CHART[0].toFixed(2)}, ${CHART[1].toFixed(2)}));
        float lap = (rc > 2.05 && rc < 2.85) ? 0.22 : 0.0;
        zxGold = rc < 3.1 ? zxChart(p) : zxInlay(p);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.42, 0.72), lap);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.7, 0.28), zxGold); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.45, zxGold);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.35, zxGold);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.95, 0.62, 0.22) * zxGold * 0.35;');
  };
  m.customProgramCacheKey = () => 'zxFloor2';
  return m;
}
// the faces of the tiers, the terrace's walls and the wells: dressed white jade in long courses
const sideTex = () => T.bricks(0xd6d2c4, 3, 'zxSide');
// a lit lattice window bay of the storeys below, a bay a texture: lacquer frame, a grille over paper glowing warm
function windowTex() {
  return T.pbr('zxWindow', 256, (u, v, o) => {
    const inX = u > 0.12 && u < 0.88, inY = v > 0.18 && v < 0.86, frame = !(inX && inY);
    if (frame) { const n = T.fbm(u, v, 8, 3, 711); o.c = T.mixc([0.36, 0.06, 0.04], [0.24, 0.04, 0.03], n); o.h = 0.7; o.r = 0.45; if (v < 0.08) { o.c = [0.72, 0.52, 0.2]; o.m = 1; o.r = 0.3; } return; }
    const gu = ((u - 0.12) / 0.76) * 6, gv = ((v - 0.18) / 0.68) * 8, bar = Math.min(Math.abs(gu - Math.round(gu)), Math.abs(gv - Math.round(gv)));
    const diag = Math.abs(((gu + gv) % 2 + 2) % 2 - 1);
    if (bar < 0.07 || diag < 0.05) { o.c = [0.3, 0.07, 0.04]; o.h = 0.7; o.r = 0.5; return; }
    const glow = 0.75 + 0.25 * T.fbm(u, v, 3, 2, 712); o.c = [0.98 * glow, 0.62 * glow, 0.3 * glow]; o.e = glow; o.h = 0.3; o.r = 0.9;
  }, 1);
}
// the black lacquer screen behind the throne: the nine-tailed fox in gold line, her tails fanned like flame, among stars
function foxTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e0806'); bg.addColorStop(1, '#1c0c08'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c89436'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 3; g.strokeRect(34, 34, W - 68, H - 68);
  for (const x of [W / 3, 2 * W / 3]) { g.lineWidth = 8; g.beginPath(); g.moveTo(x, 14); g.lineTo(x, H - 14); g.stroke(); }
  for (let i = 0; i < 70; i++) { const x = 50 + R(i * 3.1) * (W - 100), y = 50 + R(i * 5.7) * (H - 100), r = 1 + R(i * 1.3) * 2.5; g.fillStyle = `rgba(232,196,110,${0.5 + R(i) * 0.5})`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
  const cx = W / 2, cy = H * 0.62; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 9; k++) {   // the tails: long S-curves fanning from behind her, each tipped in a flame's lick
    const a = Math.PI * (1.05 + k * 0.1), len = 250 + (k % 3) * 30, ex = cx + Math.cos(a) * len * 1.35, ey = cy + Math.sin(a) * len * 0.95;
    g.strokeStyle = '#e0aa48'; g.lineWidth = 7 - Math.abs(k - 4) * 0.5; g.beginPath(); g.moveTo(cx, cy);
    g.bezierCurveTo(cx + Math.cos(a + 0.5) * len * 0.5, cy + Math.sin(a + 0.5) * len * 0.4, cx + Math.cos(a - 0.4) * len * 0.9, cy + Math.sin(a - 0.4) * len * 0.75, ex, ey); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + Math.cos(a + 1.2) * 30, ey + Math.sin(a + 1.2) * 30, ex + Math.cos(a) * 34, ey + Math.sin(a) * 30); g.stroke();
  }
  g.fillStyle = '#1a0c08'; g.strokeStyle = '#f0c060'; g.lineWidth = 6;   // her body, couchant, head raised and turned
  g.beginPath(); g.moveTo(cx - 120, cy + 60); g.bezierCurveTo(cx - 100, cy - 10, cx + 40, cy - 30, cx + 90, cy - 70); g.lineTo(cx + 120, cy - 120); g.lineTo(cx + 128, cy - 84);
  g.lineTo(cx + 150, cy - 112); g.lineTo(cx + 146, cy - 70); g.bezierCurveTo(cx + 175, cy - 52, cx + 168, cy - 30, cx + 140, cy - 28); g.bezierCurveTo(cx + 120, cy - 10, cx + 110, cy + 30, cx + 130, cy + 60); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ff5030'; g.beginPath(); g.arc(cx + 140, cy - 62, 6, 0, 6.283); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------- the sky, the cloud, the storeys below
// a dome of night: the stars (some brighter, a few warm), the river of heaven across it, a deep blue going black overhead
function skyDome(S) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTime: U.uTime }, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vD); float up = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(vec3(0.05, 0.07, 0.16), vec3(0.008, 0.012, 0.035), smoothstep(0.0, 0.7, up));
        col += vec3(0.5, 0.22, 0.08) * smoothstep(0.25, -0.15, d.y) * 0.35;   // the city's glow low on every side
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.25, 0.9))) / 0.22, 2.0)), dust = n3(d * 9.0) * 0.6 + n3(d * 23.0) * 0.4;
        col += vec3(0.28, 0.3, 0.42) * band * smoothstep(0.35, 0.8, dust) * 0.55;
        vec3 g = floor(d * 260.0); float s = h(g), tw = 0.65 + 0.35 * sin(uTime * (1.0 + 3.0 * s) + s * 50.0);
        float st = step(0.985 - band * 0.012, s) * smoothstep(0.5, 0.0, length(fract(d * 260.0) - 0.5)) * tw;
        col += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.6), step(0.995, s)) * st * (1.2 + band);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), m); dome.position.set(11.5, 0, 17); dome.renderOrder = -10; dome.userData.noRange = true; S.add(dome);
  // the moon, low in the east over the cloud: a pale disc in a soft halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc8d4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false }));
  halo.position.set(95, 38, -60); halo.scale.setScalar(46); S.add(halo);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ color: 0xf4f0e4, fog: false })); disc.position.copy(halo.position); disc.lookAt(11.5, 0, 17); S.add(disc);
}
let glowT = null;
function glowTexture() {
  if (glowT) return glowT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (glowT = new THREE.CanvasTexture(c));
}
// the sea of cloud far below, at night: blue-grey, moonlit on its swells, and orange from beneath where the city burns
// (patches that breathe), thinner veils drifting over it
function cloudMaterial(layer) {
  const m = layer === 0 ? new THREE.MeshLambertMaterial({ color: 0x404858 }) : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }
      float cf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += cn(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float L = ${layer.toFixed(1)}, t = uTime;
      vec2 p = vWp.xz * (0.07 + L * 0.05) + vec2(t * 0.012, t * 0.004) * (1.0 + L * 0.7) + L * 13.7;
      vec2 q = vec2(cf(p + vec2(0.0, t * 0.01)), cf(p + vec2(5.2, 1.3) - t * 0.008));
      float n = cf(p + q * 1.6), e = 0.05, nx = cf(p + vec2(e, 0.0) + q * 1.6), nz = cf(p + vec2(0.0, e) + q * 1.6);
      vec3 N = normalize(vec3(-(nx - n) / e * 0.8, 1.0, -(nz - n) / e * 0.8));
      float moon = clamp(dot(N, normalize(vec3(0.8, 0.5, -0.4))), 0.0, 1.0), puff = smoothstep(0.3, 0.78, n);
      vec3 col = mix(vec3(0.05, 0.06, 0.1), vec3(0.2, 0.23, 0.32), puff) + vec3(0.3, 0.36, 0.52) * pow(moon, 3.0) * puff * 0.6;
      float city = smoothstep(0.55, 0.85, cf(vWp.xz * 0.02 + vec2(3.1, 7.7))) * (0.75 + 0.25 * sin(t * 0.9 + vWp.x * 0.13 + vWp.z * 0.07));
      col += vec3(1.0, 0.36, 0.08) * city * (1.0 - puff * 0.55) * (L < 0.5 ? 0.85 : 0.35);
      diffuseColor.rgb = col * (L < 0.5 ? 0.5 : 1.0); vec3 kCloud = col;
      diffuseColor.a = L < 0.5 ? 1.0 : smoothstep(0.5, 0.8, n) * (L < 1.5 ? 0.4 : 0.2);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = kCloud * 0.55;');
  };
  m.customProgramCacheKey = () => 'zxCloud2' + layer;
  return m;
}
// a roof skirt of dark glazed tiles: from an inner rectangle at y down and out by `out` to the eave, its corners swept up
function skirt(mat, gold, r, y, out, drop, lift = 0.7) {
  const P = [], UV = [], I = [], N = 24, sides = [[[r.x0, r.z1], [r.x1, r.z1], [0, 1]], [[r.x1, r.z1], [r.x1, r.z0], [1, 0]], [[r.x1, r.z0], [r.x0, r.z0], [0, -1]], [[r.x0, r.z0], [r.x0, r.z1], [-1, 0]]];
  const trim = [];
  for (const [[ax, az], [bx, bz], [nx, nz]] of sides) {
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len, o0 = P.length / 3;
    for (let i = 0; i <= N; i++) {
      const s = i / N, ix = ax + (bx - ax) * s, iz = az + (bz - az) * s, ox = ix + nx * out + tx * out * (2 * s - 1), oz = iz + nz * out + tz * out * (2 * s - 1);
      const lenO = len + 2 * out, d = Math.min(s * lenO, (1 - s) * lenO), up = lift * Math.pow(Math.max(0, 1 - d / Math.min(3, lenO / 3)), 2);
      P.push(ix, y, iz, ox, y - drop + up, oz); UV.push(s * len / 1.1, 0, s * len / 1.1, Math.hypot(out, drop) / 1.1);
      if (i < N) I.push(o0 + i * 2, o0 + i * 2 + 1, o0 + i * 2 + 2, o0 + i * 2 + 1, o0 + i * 2 + 3, o0 + i * 2 + 2);
      if (i < N) { const nx2 = ix + (bx - ax) / N + nx * out + tx * out * (2 * (i + 1) / N - 1), nz2 = iz + (bz - az) / N + nz * out + tz * out * (2 * (i + 1) / N - 1);
        const d2 = Math.min((i + 1) / N * lenO, (1 - (i + 1) / N) * lenO), up2 = lift * Math.pow(Math.max(0, 1 - d2 / Math.min(3, lenO / 3)), 2);
        const a = new THREE.Vector3(ox, y - drop + up, oz), b = new THREE.Vector3(nx2, y - drop + up2, nz2), m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, a.distanceTo(b), 6), gold);
        m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); trim.push(m); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  const grp = new THREE.Group(); grp.add(shade(new THREE.Mesh(g, mat)), merged(gold, trim));
  return grp;
}
// a storey of the tower below the terrace: walls of lit lattice bays (south, east and west: the faces seen) under its
// skirt; r its walls' rectangle, y its top, h its height
function storey(S, M, win, roof, r, y, h, out) {
  const walls = [], wins = [], posts = [];
  const side = (ax, az, bx, bz, nx, nz) => {   // a wall from a to b, facing n; bays of lit lattice between lacquer posts
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.5)), w = len / n, rot = Math.atan2(nx, nz);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.2), M.lacquerDark); wall.position.set((ax + bx) / 2 - nx * 0.1, y - h / 2, (az + bz) / 2 - nz * 0.1); wall.rotation.y = rot; walls.push(wall);
    const pane = new THREE.PlaneGeometry(len, h * 0.62), uv = pane.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
    const p = new THREE.Mesh(pane, win); p.position.set((ax + bx) / 2 + nx * 0.01, y - h * 0.5, (az + bz) / 2 + nz * 0.01); p.rotation.y = rot; wins.push(p);
    for (let i = 0; i <= n; i++) { const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, b = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), M.lacquer); b.position.set(px + nx * 0.05, y - h / 2, pz + nz * 0.05); posts.push(b); }
    void w;
  };
  side(r.x0, r.z1, r.x1, r.z1, 0, 1); side(r.x1, r.z1, r.x1, r.z0, 1, 0); side(r.x0, r.z0, r.x0, r.z1, -1, 0);
  S.add(merged(M.lacquerDark, walls), merged(win, wins), merged(M.lacquer, posts));
  S.add(skirt(roof, M.gold, { x0: r.x0 - 0.05, x1: r.x1 + 0.05, z0: r.z0 - 0.05, z1: r.z1 + 0.05 }, y - h - 0.02, out, out * 0.55));
}

// ---------------------------------------------------------------- the pieces on the terrace
// a bronze armillary: the fixed meridian, horizon and equator rings, the turning ecliptic and sighting rings round a jade
// earth, on a column with four curled dragon feet rising from the roof below
function armillary(M, x, y, z) {
  const g = new THREE.Group(), spin = new THREE.Group(), ring = (r, t, mat) => shade(new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 96), mat));
  const mer = ring(2.0, 0.07, M.bronze); mer.rotation.y = Math.PI / 2; g.add(mer);
  const hor = ring(2.1, 0.09, M.gold); hor.rotation.x = Math.PI / 2; g.add(hor);
  const eq = ring(1.75, 0.055, M.bronze); eq.rotation.x = Math.PI / 2 - 0.62; g.add(eq);
  const ecl = ring(1.55, 0.05, M.gold); ecl.rotation.x = Math.PI / 2 - 0.62 - 0.41; spin.add(ecl);
  const sight = ring(1.35, 0.045, M.bronze); spin.add(sight);
  const tube = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), M.gold)); tube.rotation.z = Math.PI / 2; spin.add(tube);
  spin.rotation.z = 0.62; g.add(spin);
  const earth = shade(new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), M.jade)); g.add(earth);
  const axis = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.3, 8), M.gold)); axis.rotation.x = 0.62; g.add(axis);
  g.position.set(x, y, z);
  const col = new THREE.Group(), H = y - 2.05 - Y.deck;
  const shaft = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, H, 16), M.bronze)); shaft.position.y = Y.deck + H / 2; col.add(shaft);
  const cup = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.25, 0.4, 16), M.bronze)); cup.position.y = y - 2.15; col.add(cup);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, leg = shade(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 16, Math.PI * 0.8), M.bronze)); leg.position.set(Math.cos(a) * 0.4, Y.deck + 0.45, Math.sin(a) * 0.4); leg.rotation.y = -a; col.add(leg); }
  col.position.set(x, 0, z);
  return { g, col, spin };
}
// a bronze celestial globe on a dragon stand: the sphere banded with its lodges, held in a gilt meridian
function globe(M, x, z, y) {
  const g = new THREE.Group(), tex = T.material(T.bronze(), { color: 0x6a8a7a, envMapIntensity: 1.1 });
  const sph = shade(new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), tex)); sph.position.y = 1.0; g.add(sph);
  const mer = shade(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 48), M.gold)); mer.position.y = 1.0; mer.rotation.y = 0.6; g.add(mer);
  const hor = shade(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), M.gold)); hor.position.y = 1.0; hor.rotation.x = Math.PI / 2; g.add(hor);
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.6, 12), M.bronze)).translateY(0.3 + 0.05));
  const base = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.1, 16), M.bronze)); base.position.y = 0.05; g.add(base);
  g.position.set(x, y, z); return g;
}
// a little pavilion roof on four slim columns over a platform (the wings' globes)
function pavilion(M, roof, r, y, h) {
  const g = new THREE.Group();
  for (const [x, z] of [[r.x0 + 0.15, r.z0 + 0.15], [r.x1 - 0.15, r.z0 + 0.15], [r.x0 + 0.15, r.z1 - 0.15], [r.x1 - 0.15, r.z1 - 0.15]]) {
    const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, h, 16), M.lacquer)); c.position.set(x, y + h / 2, z); g.add(c);
    g.add(box(M.gold, x - 0.12, y + h - 0.14, z - 0.12, x + 0.12, y + h, z + 0.12));
  }
  g.add(box(M.lacquer, r.x0, y + h - 0.18, r.z0, r.x1, y + h, r.z1));
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  g.add(skirt(roof, M.gold, { x0: cx - 0.25, x1: cx + 0.25, z0: cz - 0.25, z1: cz + 0.25 }, y + h + 0.95, Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2 + 0.2, 0.95, 0.35));
  const fin = shade(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), M.gold)); fin.position.set(cx, y + h + 1.2, cz); g.add(fin);
  return g;
}
// a floating lamp: a gilt lotus cup with a small flame, bobbing on the wine
function lampCup(M) {
  const g = new THREE.Group();
  for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.gold); p.scale.set(0.6, 0.45, 1.3); const a = k * Math.PI / 4; p.position.set(Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07); p.rotation.y = -a; g.add(p); }
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.scale.set(0.16, 0.26, 1); fl.position.y = 0.13; g.add(fl);
  return g;
}
// the white jade balustrade round every edge of the floor that drops to the dark (or into a well): from the levels' grid,
// edge by edge, joined into straight runs, set a hand in from the edge, posts no more than half a cell apart
function edgeRuns() {
  const Rr = LV.R, W = LV.w * Rr, Hh = LV.h * Rr, g = (i, j) => (i < 0 || j < 0 || i >= W || j >= Hh) ? NaN : LV.H[j * W + i], s = 1 / Rr, inset = 0.07;
  const ramp = (i, j) => LV.ramps.some(r => (i + 0.5) * s > r.x0 && (i + 0.5) * s < r.x1 && (j + 0.5) * s > r.z0 && (j + 0.5) * s < r.z1);
  const segs = new Map();   // key: dir + line coordinate + level -> list of [a, b]
  const add = (k, a, b) => (segs.get(k) || segs.set(k, []).get(k)).push([a, b]);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const y = g(i, j); if (isNaN(y) || ramp(i, j)) continue;
    if (isNaN(g(i, j + 1)) && !ramp(i, j + 1)) add('s|' + (j + 1) + '|' + y, i, i + 1);
    if (isNaN(g(i, j - 1)) && !ramp(i, j - 1)) add('n|' + j + '|' + y, i, i + 1);
    if (isNaN(g(i + 1, j)) && !ramp(i + 1, j)) add('e|' + (i + 1) + '|' + y, j, j + 1);
    if (isNaN(g(i - 1, j)) && !ramp(i - 1, j)) add('w|' + i + '|' + y, j, j + 1);
  }
  const out = [];
  for (const [k, list] of segs) {
    const [d, line, y] = k.split('|'), L = +line * s; list.sort((p, q) => p[0] - q[0]);
    const runs = []; for (const [a, b] of list) { const last = runs[runs.length - 1]; if (last && last[1] === a) last[1] = b; else runs.push([a, b]); }
    for (const [a, b] of runs) {
      const A = a * s, B = b * s, n = Math.max(1, Math.ceil((B - A) / 0.5)), pts = [];
      for (let q = 0; q <= n; q++) { const t = A + (B - A) * q / n;
        pts.push(d === 's' ? [t, L - inset] : d === 'n' ? [t, L + inset] : d === 'e' ? [L - inset, t] : [L + inset, t]); }
      out.push({ y: +y, pts });
    }
  }
  return out;
}

async function build(E, FX) {
  const S = E.world.scene, M = mats();
  M.beam = T.material(T.caihua(), { envMapIntensity: 1 });
  const floor = floorMaterial(), side = T.material(sideTex(), { envMapIntensity: 0.8 }, [1, 1]);
  const jade = T.material(T.marble(0xf2f0e8, 0xb8bcae), { envMapIntensity: 0.9 }), rug = T.material(T.carpet(0xa8101a), {});
  const roof = T.material(T.roofTiles(0x1c2a26, 8, 8), { envMapIntensity: 0.7, side: THREE.DoubleSide }, [1, 1]);
  const Mcol = Object.assign({}, M, { lacquer: T.material(T.cloudRelief(2), { envMapIntensity: 1.2 }, [2.5, 3]) });
  const lacq = M.lacquer, gold = M.gold;
  M.silk = T.material(T.silk(0xc0182a), { sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.55, 0.5), side: THREE.DoubleSide });   // crimson silk

  // ---- the terrace: floors, tier faces and its walls down to the roof below; the stairs
  S.add(LV.mesh(floor, side, Y.base, 0.5));
  for (const r of LV.ramps) { const onRug = r.x0 === STAIR.x0 && r.z0 === STAIR.z0; S.add(stairs(r, onRug ? rug : jade, onRug ? rug : side, onRug ? 1 / 3 : 0.5)); }
  const runner = (z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, z1 - z0).rotateX(-Math.PI / 2), rug.clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m.material[k] = rug[k].clone(); m.material[k].repeat.set(1, (z1 - z0) / 2.8); m.material[k].needsUpdate = true; }
    m.position.set(11.5, y + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
  };
  runner(1.6, STAIR.z0, Y.tier2); runner(STAIR.z1, 9.3, Y.hall);
  const trim = [], caps = [], d = (STAIR.z1 - STAIR.z0) / STEPS;
  for (let k = 0; k < STEPS; k++) {
    const y = Y.hall + (Y.tier2 - Y.hall) * (STEPS - k) / STEPS, z = STAIR.z0 + k * d;
    caps.push(box(gold, STAIR.x0 + 0.1, y - 0.03, z + d - 0.03, STAIR.x1 - 0.1, y + 0.005, z + d + 0.01, 2));
    for (const x of [STAIR.x0, STAIR.x1]) { trim.push(box(jade, x - 0.07, Y.hall, z, x + 0.07, y + 0.1, z + d + 0.001, 2)); caps.push(box(gold, x - 0.085, y + 0.1, z, x + 0.085, y + 0.13, z + d + 0.001, 2)); }
  }
  S.add(merged(jade, trim), merged(gold, caps));
  // the dais's edges: a gilt line under a jade coping where a tier drops; jade parapets where the court has its walls
  const coping = [], cg = [];
  const edge = (x0, z0, x1, z1, y) => { coping.push(box(jade, x0, y - 0.1, z0, x1, y + 0.02, z1, 2)); cg.push(box(gold, x0 - 0.01, y - 0.14, z0 - 0.01, x1 + 0.01, y - 0.1, z1 + 0.01, 2)); };
  edge(7, 4.92, 8, 5.02, Y.tier2); edge(15, 4.92, 16, 5.02, Y.tier2); edge(8, 4.92, 10, 5.02, Y.tier2); edge(13, 4.92, 15, 5.02, Y.tier2);
  edge(8, 7.5, 10, 7.62, Y.tier1); edge(13, 7.5, 15, 7.62, Y.tier1);
  edge(6.98, 3.4, 7.08, 5, Y.tier2); edge(15.92, 3.4, 16.02, 5, Y.tier2); edge(7.98, 5, 8.08, 7.6, Y.tier1); edge(14.92, 5, 15.02, 7.6, Y.tier1);
  S.add(merged(jade, coping), merged(gold, cg));
  for (const [a, b] of [[7, 8], [9, 10]]) { S.add(parapet(M, jade, a, 4.78, b, 5.0, Y.tier2, 0.34)); S.add(parapet(M, jade, mx(b), 4.78, mx(a), 5.0, Y.tier2, 0.34)); }
  S.add(parapet(M, jade, 8, 7.38, 9.1, 7.6, Y.tier1, 0.34), parapet(M, jade, 13.9, 7.38, 15, 7.6, Y.tier1, 0.34));
  // the balustrades round every drop to the dark
  const byY = new Map(); for (const { y, pts } of edgeRuns()) (byY.get(y) || byY.set(y, []).get(y)).push(pts);
  for (const [y, runs] of byY) S.add(shade(balustrade(jade, runs, y)));

  // ---- the throne end, open to the sky: columns and bare beams, crimson silk in the side bays, the canopy, the throne,
  // the fox screen; beyond the alcove's edge the armillary
  for (const [x, z, y, r] of [[9.5, 3.75, Y.tier2, 0.4], [13.5, 3.75, Y.tier2, 0.4], [6.5, 5.5, Y.hall, 0.42], [16.5, 5.5, Y.hall, 0.42], [4.3, 5.6, Y.hall, 0.3], [18.7, 5.6, Y.hall, 0.3]]) S.add(pillar(Mcol, x, z, y, TOP - y, r));
  for (const [x0, x1, z] of [[4.0, 7.0, 5.6], [16.0, 19.0, 5.6], [9.0, 14.0, 3.75]]) S.add(box(M.beam, x0, TOP, z - 0.16, x1, TOP + 0.45, z + 0.16, 1 / 0.45), box(gold, x0, TOP + 0.45, z - 0.18, x1, TOP + 0.5, z + 0.18));
  S.add(curtain(M, 4.6, 5.6, 5.85, TOP - 0.1, 3.6, 'l', 5), curtain(M, 5.4, 6.2, 5.85, TOP - 0.1, 3.6, 'r', 5), curtain(M, 16.8, 17.6, 5.85, TOP - 0.1, 3.6, 'l', 5), curtain(M, 17.4, 18.4, 5.85, TOP - 0.1, 3.6, 'r', 5));
  S.add(throne(M, 11.5, 2.75, Y.tier2));
  const foxTex = foxTexture(), foxM = new THREE.MeshStandardMaterial({ map: foxTex, emissiveMap: foxTex, emissive: new THREE.Color(1, 0.85, 0.6), emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.1, envMapIntensity: 0.6 });
  const fox = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.65), foxM); fox.position.set(11.5, Y.tier2 + 0.3 + 0.82, 1.3); S.add(shade(fox));
  S.add(box(lacq, 9.75, Y.tier2, 1.2, 13.25, Y.tier2 + 0.3, 1.36), box(gold, 9.7, Y.tier2 + 0.3, 1.18, 13.3, Y.tier2 + 0.34, 1.38), box(gold, 9.75, Y.tier2 + 1.95, 1.22, 13.25, Y.tier2 + 2.02, 1.36));
  for (const x of [9.78, 13.22]) S.add(box(gold, x - 0.04, Y.tier2 + 0.3, 1.24, x + 0.04, Y.tier2 + 2.0, 1.36));
  // the canopy: a tiered gilt drum hung from the lintel, crimson silk valances with tassels
  const cy = TOP - 0.55, can = new THREE.Group();
  can.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.18, 32), gold)));
  const val = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.32, 0.42, 32, 1, true), M.silk); val.position.y = -0.3; can.add(shade(val));
  const crown = shade(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 32), gold)); crown.position.y = 0.33; can.add(crown);
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, t = shade(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 6), gold)); t.rotation.x = Math.PI; t.position.set(Math.cos(a) * 1.3, -0.6, Math.sin(a) * 1.3); can.add(t); }
  can.position.set(11.5, cy, 2.8); S.add(can);
  const arm = armillary(M, 11.5, Y.tier2 + 3.3, -1.1); S.add(arm.g, shade(arm.col));
  const key = new THREE.PointLight(0xffd2a0, 4.0, 6, 1.6); key.position.set(11.5, Y.tier2 + 2.4, 4.6); S.add(key);

  // ---- the hall: braziers where the carpet ends, the wine pool, lamps on posts along its sides
  S.add(parapet(M, jade, 7.0, 9.05, 8.0, 9.6, Y.hall, 0.4), parapet(M, jade, 15.0, 9.05, 16.0, 9.6, Y.hall, 0.4));
  const fires = [];
  for (const x of [9.5, 10.5, 12.5, 13.5]) fires.push([x, 9.3, Y.hall, 0.95]);
  for (const [a, b, c, dd] of [[4, 24.5, 6, 25], [6, 25.45, 9, 25.95]]) { S.add(parapet(M, jade, a, b, c, dd, Y.low, 0.4)); S.add(parapet(M, jade, mx(c), b, mx(a), dd, Y.low, 0.4)); }
  for (const x of [6.5, 7.5, 8.5]) { fires.push([x, 24.95, Y.low, 0.95]); fires.push([mx(x), 24.95, Y.low, 0.95]); }
  for (const [x, z, y, s] of fires) { const dg = ding(M, x, z, y, s); S.add(dg.g); FX.fire(E, { x, y: z + 0.04, z: dg.rim - LV.at(x, z) - 0.05, size: 0.7, light: 2.6, col: 0xff8a3a }); }
  const kerb = [];
  for (const [a, b, c, dd] of MOAT) {
    FX.water(S, { r: [a, b, c, dd], y: Y.moat + 0.24, deep: 0x4a0610, lit: 0xb81a2a, stars: 0.4 });
    kerb.push(box(gold, a, Y.mid - 0.03, b, c, Y.mid + 0.01, b + 0.04), box(gold, a, Y.mid - 0.03, dd - 0.04, c, Y.mid + 0.01, dd));
  }
  S.add(merged(gold, kerb));
  const lamps = [];
  for (let i = 0; i < 16; i++) { const [a, b, c, dd] = MOAT[i % MOAT.length], l = lampCup(M); const x = a + 0.2 + R(i * 3.7) * (c - a - 0.4), z = b + 0.2 + R(i * 5.3) * (dd - b - 0.4);
    l.position.set(x, Y.moat + 0.25, z); l.userData.ph = R(i) * 6.28; S.add(l); lamps.push(l); }
  for (const [x, z] of [[11.5, 17.75], [7.5, 13.5], [15.5, 13.5]]) { const L = new THREE.PointLight(0xff4a3a, 1.6, 4, 1.6); L.position.set(x, Y.mid + 0.6, z); S.add(L); }
  // lamps on posts just past the balustrade, down both long sides and round the lower court
  for (const [x, z] of [[3.75, 11.5], [19.25, 11.5], [3.75, 15], [19.25, 15], [3.75, 23.5], [19.25, 23.5], [6.75, 29], [16.25, 29]]) {
    const y0 = ground(x + (x < 11.5 ? 0.4 : -0.4), z), p = new THREE.Group();
    p.add(box(lacq, x - 0.05, Y.deck, z - 0.05, x + 0.05, y0 + 1.7, z + 0.05), box(gold, x - 0.07, y0 + 1.68, z - 0.07, x + 0.07, y0 + 1.75, z + 0.07));
    const armX = x < 11.5 ? 0.3 : -0.3; p.add(box(lacq, Math.min(x, x + armX), y0 + 1.66, z - 0.025, Math.max(x, x + armX), y0 + 1.7, z + 0.025));
    S.add(p, lantern(M, x + armX, y0 + 1.35, z, 0.55));
    const L = new THREE.PointLight(0xff9a50, 1.4, 4, 1.6); L.position.set(x + armX, y0 + 1.3, z); S.add(L);
  }

  // ---- the wings: a celestial globe on each raised platform under its pavilion
  for (const [r, gx] of [[{ x0: 1, x1: 4, z0: 14, z1: 16.9 }, 1.7], [{ x0: 19, x1: 22, z0: 14, z1: 16.9 }, 21.3]]) {
    S.add(pavilion(M, roof, r, Y.wing, 2.4), globe(M, gx, 15.9, Y.wing));
  }

  // ---- the lower court's wells: down into the storey below, its fires' glow coming up
  for (const [a, b, c, dd] of WELLS) for (const [x0, x1] of [[a, c], [mx(c), mx(a)]]) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, dd - b).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a1004 }));
    glow.position.set((x0 + x1) / 2, Y.base + 0.02, (b + dd) / 2); S.add(glow);
  }
  for (const [x, z] of [[5, 26], [8, 29], [mx(5), 26], [mx(8), 29]]) FX.fire(E, { x, y: z, z: Y.base + 0.05 - ground(x, z), size: 0.55, light: 2.2, col: 0xff7a30 });
    // the retaining wall's coping above the lower court
  for (const [a, b] of [[4, 10], [13, 19]]) S.add(box(jade, a, Y.mid - 0.1, 21.55, b, Y.mid + 0.02, 21.7, 2), box(gold, a, Y.mid - 0.14, 21.6, b, Y.mid - 0.1, 21.72, 2));

  // ---- the tower below: the roof under the terrace, three storeys of lit lattice stepping down and out into the cloud
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 34.2).rotateX(-Math.PI / 2), roof); deck.position.set(11.5, Y.deck, 17); deck.receiveShadow = true; S.add(deck);
  S.add(skirt(roof, gold, { x0: -0.3, x1: 23.3, z0: -0.1, z1: 34.1 }, Y.deck, 1.6, 0.9));
  const win = T.material(windowTex(), { emissive: new THREE.Color(1, 0.62, 0.28), emissiveIntensity: 2.6 }, [1, 1]);
  let r = { x0: -0.6, x1: 23.6, z0: -0.4, z1: 34.4 }, y = Y.deck - 0.85;
  for (let k = 0; k < 3; k++) { storey(S, M, win, roof, r, y, 2.6, 1.8); y -= 2.6 + 1.0; r = { x0: r.x0 - 1.2, x1: r.x1 + 1.2, z0: r.z0 - 1.2, z1: r.z1 + 1.2 }; }
  // eave lanterns at the first skirt's corners
  for (const [x, z] of [[-1.9, -1.7], [24.9, -1.7], [-1.9, 35.7], [24.9, 35.7]]) S.add(lantern(M, x, Y.deck - 0.9, z, 0.8));

  // ---- the night: the sky, the cloud far below, the smoke of the city climbing out of it
  skyDome(S);
  const clouds = [0, 1, 2].map(L => { const c = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), cloudMaterial(L)); c.position.set(11.5, Y.cloud + L * 1.6, 17); c.renderOrder = L; c.userData.noRange = true; S.add(c); return c; });
  void clouds;
  for (const [x, z, k] of [[-16, 30, 2.4], [38, 8, 2.2], [30, 46, 2.6], [-10, -6, 1.8]]) FX.smoke(E, { x, y: z, z: Y.cloud + 1 - Y.base, size: k, tint: [0.22, 0.18, 0.16] });

  E.world.updaters.push((dt, t) => {
    U.uTime.value = t;
    arm.spin.rotation.y = t * 0.06;
    for (const l of lamps) { l.position.y = Y.moat + 0.25 + Math.sin(t * 1.3 + l.userData.ph) * 0.012; l.rotation.y = t * 0.1 + l.userData.ph; }
  });
}

export const zhaixingReimagined = {
  build, ground, particles: null, slopes: STAIR_CELLS,
  // night: the moon cool from the east, the braziers and the city's glow warm from below
  mood: { bg: 0x04060e, voidCol: false, fog: 0x0a0e1e, fogD: 0.008, sky: 0x7080c0, under: 0x3a1a0c, hemi: 0.7,
    sun: 0xaabcff, sunI: 1.7, sunDir: [0.6, 0.8, 0.25], sat: 1.04, exposure: 1.02, bloom: 0.42,
    env: { top: 0x3a4a78, mid: 0x3a2a30, low: 0x3a1608, lights: [[6, 6, -4, 0xc8d4ff, 4], [0, -4, 0, 0xff7a30, 3], [-6, 3, 4, 0xffb070, 2.5]] } },
};
