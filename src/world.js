// The battlefield in 3D: terrain, sky, light and post-processing, plus what a battle's look asks for (setLook):
// its map art, an optional bamboo forest on one terrain code, cells kept clear of it, and its own dressing (props).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { D, MAP_W, MAP_H } from './rules.js';
const BLOOM_THRESHOLD = 1.35;   // linear scene luminance

export const MARGIN = 8;                       // decorative border around the playable board
let TW = 0, TH = 0;
// the battle's look: { mapSD, mapHD?, hdCell?, forest?: terrain code drawn as bamboo, clear?(cx, cy), dress?(world) }
let LOOK = {};
export function setLook(look) { LOOK = look; TW = MAP_W + MARGIN * 2; TH = MAP_H + MARGIN * 2; }
const SUN_DIR = new THREE.Vector3(-0.55, 0.78, 0.32).normalize();

// ---------------------------------------------------------------- noise
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;
export const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- terrain helpers
const isForestCell = (cx, cy) => LOOK.forest != null && (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H || D.terrain[cy][cx] === LOOK.forest);
const isHutCell = (cx, cy) => !D.arena && !!LOOK.clear && LOOK.clear(cx, cy);   // cells kept free of forest (磻溪's hut); the 演武場 arena has none
const artCell = (cx, cy) => D.artSrc ? D.artSrc[cy][cx] : [cx, cy];   // which cell of the original map art paints a board cell
function forestField(x, z) {                   // smooth 0..1 forest coverage at a world point
  const fx = x - 0.5, fz = z - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
  const f = (a, b) => (isForestCell(a, b) && !isHutCell(a, b) ? 1 : 0);
  const s = t => t * t * (3 - 2 * t);
  const a = f(x0, z0), b = f(x0 + 1, z0), c = f(x0, z0 + 1), d = f(x0 + 1, z0 + 1);
  return (a + (b - a) * s(tx)) * (1 - s(tz)) + (c + (d - c) * s(tx)) * s(tz);
}
export function groundH(x, z) {
  if (LOOK.set) return LOOK.set.ground(x, z);   // a remade set's own walking surface (src/remake)
  if (LOOK.forest == null) return 0;   // painted map art (scenes, battles without a forest look): perfectly flat, so its lines stay straight
  const f = forestField(x, z);
  return f * 0.26 + (fbm(x * 0.35, z * 0.35) - 0.5) * 0.12 + f * (fbm(x * 1.3 + 9, z * 1.3) - 0.5) * 0.16 + (fbm(x * 3, z * 3) - 0.5) * 0.02;
}

// ---------------------------------------------------------------- textures (pixel-art, generated on canvas)
export function canvasTex(w, h, draw, opts) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = (opts && opts.smooth) ? THREE.LinearFilter : THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
  return t;
}
export function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

// a battle without a forest look: its original map art, cell for cell, with the edge cells stretched out under the border
async function plainGroundTexture() {
  const PX = 64, sd = await loadImg(LOOK.mapSD);
  return canvasTex(TW * PX, TH * PX, (g, W, H) => {
    g.imageSmoothingEnabled = false;
    for (let cy = -MARGIN; cy < MAP_H + MARGIN; cy++) for (let cx = -MARGIN; cx < MAP_W + MARGIN; cx++) {
      const sx = Math.max(0, Math.min(MAP_W - 1, cx)), sy = Math.max(0, Math.min(MAP_H - 1, cy));
      g.drawImage(sd, sx * 32, sy * 32, 32, 32, (cx + MARGIN) * PX, (cy + MARGIN) * PX, PX, PX);
    }
    g.fillStyle = 'rgba(10,8,6,0.45)';   // the border reads as off the board
    g.fillRect(0, 0, W, MARGIN * PX); g.fillRect(0, (MAP_H + MARGIN) * PX, W, MARGIN * PX);
    g.fillRect(0, MARGIN * PX, MARGIN * PX, MAP_H * PX); g.fillRect((MAP_W + MARGIN) * PX, MARGIN * PX, MARGIN * PX, MAP_H * PX);
  });
}
async function groundTexture() {
  if (LOOK.forest == null || !LOOK.mapHD) return plainGroundTexture();
  const PX = 64, HC = LOOK.hdCell || 128, map = await loadImg(LOOK.mapHD), sd = await loadImg(LOOK.mapSD);
  const SW = sd.width / 32;   // the art's width in cells (the 演武場 arena paints from the full map)
  // read the original map to find clean dirt and vegetation overlap
  const sc = document.createElement('canvas'); sc.width = sd.width; sc.height = sd.height; const sg = sc.getContext('2d'); sg.drawImage(sd, 0, 0);
  const sdata = sg.getImageData(0, 0, sd.width, sd.height).data;
  const green = (x, y) => { const i = (y * sd.width + x) * 4, r = sdata[i], g = sdata[i + 1], b = sdata[i + 2]; return g > r + 18 && g > b + 8; };
  let best = null;
  for (let cy = 0; cy < MAP_H; cy++) for (let cx = 0; cx < MAP_W; cx++) {
    const [sx, sy] = artCell(cx, cy);
    if (D.terrain[cy][cx] !== 0 || sx >= SW - 2) continue;   // not the east edge, under the fire
    let n = 0; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) n += green(sx * 32 + x, sy * 32 + y);
    if (!best || n < best.n) best = { cx: sx, cy: sy, n };
  }
  return canvasTex(TW * PX, TH * PX, (g, W, H) => {
    g.imageSmoothingEnabled = false;
    // forest floor everywhere first: moss, litter and dark gaps in 2-texel "pixels"
    g.fillStyle = '#26381c'; g.fillRect(0, 0, W, H);
    const cols = ['#2f4a22', '#3a5a26', '#1c2c14', '#4a5a2a', '#5a4a2a', '#3d6a2a', '#22361a'];
    for (let i = 0; i < W * H / 22; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(((Math.random() * W) >> 1) << 1, ((Math.random() * H) >> 1) << 1, 2, 2); }
    for (let i = 0; i < W * H / 900; i++) {   // fallen bamboo leaves
      g.fillStyle = Math.random() < 0.5 ? '#7a6a32' : '#6a7a30'; const x = ((Math.random() * W) >> 1) << 1, y = ((Math.random() * H) >> 1) << 1;
      for (let k = 0; k < 4; k++) g.fillRect(x + k * 2, y + (k === 0 || k === 3 ? 0 : -2), 2, 2);
    }
    // path cells from the original HD map art, with overhanging vegetation painted out
    const tmp = document.createElement('canvas'); tmp.width = PX; tmp.height = PX; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
    const clean = document.createElement('canvas'); clean.width = PX; clean.height = PX; const cg = clean.getContext('2d'); cg.imageSmoothingEnabled = false;
    cg.drawImage(map, best.cx * HC, best.cy * HC, HC, HC, 0, 0, PX, PX);
    const cleanD = cg.getImageData(0, 0, PX, PX).data;
    for (let cy = 0; cy < MAP_H; cy++) for (let cx = 0; cx < MAP_W; cx++) {
      if (D.terrain[cy][cx] === LOOK.forest) continue;
      if (D.arena) {        // the 演武場 arena: the clean dirt tile, turned at random so it does not read as a grid
        g.save(); g.translate((cx + MARGIN + 0.5) * PX, (cy + MARGIN + 0.5) * PX); g.rotate(((Math.random() * 4) | 0) * Math.PI / 2);
        if (Math.random() < 0.5) g.scale(-1, 1);
        g.drawImage(clean, -PX / 2, -PX / 2); g.restore(); continue;
      }
      const [sx, sy] = artCell(cx, cy);
      tg.clearRect(0, 0, PX, PX); tg.drawImage(map, sx * HC, sy * HC, HC, HC, 0, 0, PX, PX);
      const id = tg.getImageData(0, 0, PX, PX), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if ((gg > r + 18 && gg > b + 8) || sx >= SW - 1) { d[i] = cleanD[i]; d[i + 1] = cleanD[i + 1]; d[i + 2] = cleanD[i + 2]; }
      }
      tg.putImageData(id, 0, 0);
      g.drawImage(tmp, (cx + MARGIN) * PX, (cy + MARGIN) * PX);
    }
    // grassy fringe where the path meets the forest
    for (let cy = -1; cy <= MAP_H; cy++) for (let cx = -1; cx <= MAP_W; cx++) {
      if (!isForestCell(cx, cy) || isHutCell(cx, cy)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (isForestCell(nx, ny)) continue;
        for (let k = 0; k < 40; k++) {
          const t = Math.random(), depth = Math.random() * 14;
          const px = (cx + MARGIN) * PX + (dx === 0 ? t * PX : dx > 0 ? PX - depth : depth);
          const py = (cy + MARGIN) * PX + (dy === 0 ? t * PX : dy > 0 ? PX - depth : depth);
          g.fillStyle = ['#4f8a2a', '#3a6a22', '#6fae3a'][(Math.random() * 3) | 0];
          const bx = (px >> 1) << 1, by = (py >> 1) << 1; g.fillRect(bx + dx * 4, by + dy * 4, 2, 2); g.fillRect(bx + dx * 6, by + dy * 6 - 2, 2, 2);
        }
      }
    }
  });
}
function leafTexture() {
  return canvasTex(128, 80, (g) => {
    const leaf = (x, y, len, ang, c1, c2) => {
      for (let i = 0; i < len; i++) {
        const t = i / len, w = Math.max(1, Math.round(Math.sin(t * Math.PI) * 3.2));
        const px = x + Math.cos(ang) * i * 2, py = y + Math.sin(ang) * i * 2 + t * t * 10;
        g.fillStyle = c2; g.fillRect(Math.round(px), Math.round(py) - w - 1, 2, w * 2 + 2);
        g.fillStyle = c1; g.fillRect(Math.round(px), Math.round(py) - w, 2, w * 2);
      }
    };
    const greens = [['#7fcf4a', '#24501a'], ['#5fae3a', '#1a4012'], ['#9fe060', '#2a5a1a'], ['#4f9a32', '#163a10']];
    for (let k = 0; k < 22; k++) { const [a, b] = greens[k % 4]; leaf(2 + Math.random() * 44, 6 + Math.random() * 50, 12 + Math.random() * 20, -0.4 + Math.random() * 0.7, a, b); }
  });
}
function fernTexture() {
  return canvasTex(64, 64, (g) => {
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.28, len = 16 + Math.random() * 12;
      for (let i = 0; i < len; i++) {
        const x = 32 + Math.cos(a) * i * 1.8, y = 62 + Math.sin(a) * i * 1.8 + (i * i) * 0.02 * Math.abs(k - 4);
        g.fillStyle = i % 3 ? '#4f8f2a' : '#7fbf3a'; g.fillRect(Math.round(x) & ~1, Math.round(y) & ~1, 2, 2);
        if (i % 3 === 0 && i > 3) { g.fillStyle = '#3a7020'; g.fillRect((Math.round(x) & ~1) - 2, (Math.round(y) & ~1) - 2, 2, 2); g.fillRect((Math.round(x) & ~1) + 2, (Math.round(y) & ~1) - 2, 2, 2); }
      }
    }
  });
}

// ---------------------------------------------------------------- shader snippets
const NOISE_GLSL = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float bayer4(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }   // interleaved gradient noise`;
export const U = { time: { value: 0 }, burnX: { value: 99 }, focus: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() }, wind: { value: 1 } };

// wind sway + "see-through" dither for bamboo (sway also on its shadow depth material; the dither is not, so shadows never shift)
function patchPlant(mat, opts) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime: U.time, uFocus: U.focus, uCam: U.camPos, uWind: U.wind, uBurnX: U.burnX });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime, uWind; varying vec3 vWP; varying float vH;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(transformed, 1.0);
      float hgt = ${opts.leaf ? 'ip.y / 4.0' : 'position.y'};
      float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 1.3;
      float gust = 0.5 + 0.5 * sin(uTime * 0.35 + instanceMatrix[3].x * 0.05);
      float bend = hgt * hgt * uWind * (0.10 + 0.14 * gust);
      vec3 sway = vec3(-bend * (1.0 + 0.35 * sin(uTime * 1.7 + ph)), 0.0, bend * 0.45 * sin(uTime * 1.3 + ph * 1.7));
      vH = position.y;`)
      .replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition.xyz += sway;
      vWP = (modelMatrix * mvPosition).xyz;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uFocus, uCam; uniform float uTime, uBurnX; varying vec3 vWP; varying float vH; ${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', opts.depth ? '#include <clipping_planes_fragment>' : `#include <clipping_planes_fragment>
      // fade plants that stand between the camera and what we are looking at
      vec3 seg = uFocus - uCam; float tt = clamp(dot(vWP - uCam, seg) / dot(seg, seg), 0.0, 1.0);
      float dd = length(vWP - (uCam + seg * tt));
      float occl = (1.0 - smoothstep(1.2, 2.6, dd)) * step(tt, 0.97) * smoothstep(0.45, 1.1, vWP.y);
      if (occl > 0.05 && bayer4(gl_FragCoord.xy) < occl * 0.85) discard;`);
    if (opts.stalk) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float nodes = fract(vH * 9.0);
      diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.08, nodes)) * mix(1.0, 0.8, smoothstep(0.85, 1.0, nodes));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.12, 0.7), smoothstep(0.4, 1.0, vH));`);
  };
  mat.customProgramCacheKey = () => (opts.leaf ? 'leaf' : 'stalk') + (opts.depth ? 'd' : '');
}

// the scene drawn multisampled, then copied once into the post chain's plain buffers: with MSAA on the composer's own
// targets every full-screen pass after it wrote and resolved a multisampled buffer too (~10 ms a frame at 2x density)
class SceneMSAAPass extends RenderPass {
  constructor(scene, camera) {
    super(scene, camera);
    this.ms = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader, blending: THREE.NoBlending, depthTest: false, depthWrite: false }));
  }
  setSize(w, h) { this.ms.setSize(w, h); }
  render(r, writeBuffer, readBuffer, dt, mask) {
    super.render(r, writeBuffer, this.ms, dt, mask);
    this.quad.material.uniforms.tDiffuse.value = this.ms.texture; r.setRenderTarget(readBuffer); this.quad.render(r);
  }
}

// ---------------------------------------------------------------- the world
export class World {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });   // the scene pass multisamples; the canvas only takes the finished picture
    r.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false; this.frameNo = 0;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 900);
    this.clock = new THREE.Clock();
    this.reset();
  }
  // a new, empty scene for the next battle; everything the old one held is freed (the renderer and post chain stay)
  reset() {
    if (this.scene) this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [], o.customDepthMaterial || [])) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
    });
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xb9c7b4, 0.012);
    this.fireLights = [];
    this.bambooByCol = new Map(); this.stalks = this.leaves = null;
    this.updaters = [];               // per-frame effects of a set (flames, water, particles)
    this.calm = false;                // true: no ambient dust and leaves (the title's sky view)
    this.shaftMeshes = [];
    if (this.renderer) { this.renderer.toneMappingExposure = 1.05; }
    if (this.bloom) this.bloom.strength = 0.42;
    if (this.renderPass) this.renderPass.scene = this.scene;
    if (this.ao) { this.ao.scene = this.scene; this.ao.enabled = false; }
  }
  async build(progress) {
    if (LOOK.set) return this.buildSet(progress);
    const S = this.scene;
    // light: warm late-afternoon sun, cool sky fill
    S.add(new THREE.HemisphereLight(0xcfe2ff, 0x4a3a22, 1.15));
    const sun = this.sun = new THREE.DirectionalLight(0xffe0b0, 3.1);
    const cx = MAP_W / 2, cz = MAP_H / 2, half = Math.max(30, (MAP_W + MAP_H) * 0.62);
    sun.position.copy(SUN_DIR).multiplyScalar(60).add(new THREE.Vector3(cx, 0, cz)); sun.target.position.set(cx, 0, cz);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half * 0.73, bottom: -half * 0.73, near: 1, far: 140 });
    S.add(sun, sun.target);
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xff7a2a, 0, 10, 1.8); l.position.set(40, 1.3, 2 + i * 3.5); S.add(l); this.fireLights.push(l); }
    progress(0.15);
    this.sky(); progress(0.25);
    await this.ground(); progress(0.5);
    if (LOOK.forest != null) this.bamboo(); progress(0.75);
    if (LOOK.dress && !D.arena) await LOOK.dress(this);
    this.shafts(); progress(0.85);
    if (!this.composer) this.post(); progress(0.95);
  }
  // ---------------------------------------------------------------- remade story sets (src/remake)
  // the set's light (sun with shadows, sky fill) and fog; its own build (src/sets.js dress) adds every surface
  async buildSet(progress) {
    const S = this.scene, set = LOOK.set, M = set.mood || {};
    S.background = new THREE.Color(M.bg ?? 0x050403);
    S.fog = new THREE.FogExp2(M.fog ?? 0x0a0806, M.fogD ?? 0.004);
    S.add(new THREE.HemisphereLight(M.sky ?? 0xcfe2ff, M.under ?? 0x3a2a1a, M.hemi ?? 0.9));
    const dir = new THREE.Vector3(...(M.sunDir || [-0.45, 0.85, 0.35])).normalize();
    const sun = this.sun = new THREE.DirectionalLight(M.sun ?? 0xffe0b0, M.sunI ?? 2.4);
    const cx = MAP_W / 2, cz = MAP_H / 2, half = Math.max(MAP_W, MAP_H) * 0.75 + 4;
    sun.position.copy(dir).multiplyScalar(60).add(new THREE.Vector3(cx, 0, cz)); sun.target.position.set(cx, 0, cz);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 160 });
    S.add(sun, sun.target);
    progress(0.2);
    return this.finishSet(M, cx, cz, progress);
  }
  // a remade set's surroundings and finish: the void (darkness or a cloud sea), an environment for reflections on
  // lacquer, gilt and stone, ambient occlusion, and the grade
  finishSet(M, cx, cz, progress) {
    const S = this.scene;
    if (M.voidCol !== false) {
      const vg = new THREE.PlaneGeometry(400, 400); vg.rotateX(-Math.PI / 2);
      const vmat = M.clouds ? cloudMaterial(Object.assign({ cx, cz }, M.clouds)) : new THREE.MeshBasicMaterial({ color: M.voidCol || 0x050403, fog: false });
      const vm = new THREE.Mesh(vg, vmat); vm.position.set(cx, M.clouds ? -1.2 : (M.voidY ?? -1.6), cz); S.add(vm); this.voidMesh = vm;
    }
    S.environment = envMap(this.renderer, M.env || {});
    if (M.shafts) this.shafts(); else this.shaftMeshes = [];
    if (!this.composer) this.post();
    this.ao.enabled = M.ao !== false; this.ao.blendIntensity = M.aoI ?? 1;
    this.ao.updateGtaoMaterial({ radius: M.aoR ?? 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 16 });
    this.grade.uniforms.uSat.value = M.sat ?? 1.05; this.renderer.toneMappingExposure = M.exposure ?? 1.0;
    this.bloom.strength = M.bloom ?? 0.4;
    progress(0.95);
  }
  sky() {
    const geo = new THREE.SphereGeometry(500, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vD; uniform vec3 sun;
        void main(){ float h = vD.y; vec3 zen = vec3(0.30,0.48,0.72), hor = vec3(0.95,0.83,0.66), low = vec3(0.55,0.6,0.5);
          vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, low, min(1.0, -h*4.0));
          float s = max(0.0, dot(vD, sun)); c += vec3(1.0,0.8,0.5) * (pow(s, 12.0) * 0.6 + pow(s, 400.0) * 4.0);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(geo, mat); sky.position.set(MAP_W / 2, 0, MAP_H / 2); this.scene.add(sky);
    // ink-wash mountain ranges far away, three layers fading into the haze
    for (let layer = 0; layer < 3; layer++) {
      const tex = canvasTex(2048, 256, (g, W, H) => {
        const col = ['rgba(120,140,140,1)', 'rgba(150,165,160,1)', 'rgba(185,192,180,1)'][layer];
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) { const n = fbm(x * 0.004 + layer * 7, layer) * 0.7 + fbm(x * 0.02, layer * 3) * 0.3; g.lineTo(x, H - n * H * (0.95 - layer * 0.15)); }
        g.lineTo(W, H); g.fill();
        const fade = g.createLinearGradient(0, 0, 0, H); fade.addColorStop(0.5, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(230,220,200,0.9)');
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = fade; g.fillRect(0, 0, W, H);
      }, { smooth: true });
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 2;
      const R = 260 - layer * 40, geo2 = new THREE.CylinderGeometry(R, R, 70 - layer * 8, 64, 1, true);
      const m = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.set(MAP_W / 2, 20 - layer * 4, MAP_H / 2); m.renderOrder = -1; this.scene.add(m);
    }
  }
  async ground() {
    const tex = await groundTexture();
    const seg = 4, geo = new THREE.PlaneGeometry(TW, TH, TW * seg, TH * seg); geo.rotateX(-Math.PI / 2);
    geo.translate(TW / 2 - MARGIN, 0, TH / 2 - MARGIN);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uBurnX: U.burnX, uTime: U.time });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uBurnX, uTime; varying vec3 vWP; ${NOISE_GLSL}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        // scorched earth behind the fire wall, with a glowing band of embers at the front
        float edge = vWP.x - uBurnX + (vn(vWP.xz * 1.7) - 0.5) * 0.6;
        float burnt = smoothstep(-0.2, 0.25, edge);
        vec3 ash = mix(vec3(0.05,0.04,0.035), vec3(0.16,0.13,0.11), vn(vWP.xz * 6.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, ash, burnt);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float glowBand = exp(-pow((edge - 0.35) * 2.2, 2.0)) + 0.5 * burnt * smoothstep(0.86, 0.95, vn(vWP.xz * 9.0 + vec2(uTime * 0.2, 0.0)));
        totalEmissiveRadiance += vec3(1.0, 0.3, 0.05) * glowBand * (0.6 + 0.4 * vn(vWP.xz * 3.0 + uTime * 1.5)) * 1.4;
        diffuseColor.rgb *= 1.0 - 0.6 * burnt;`);
    };
    const m = this.groundMesh = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m);
  }
  bamboo() {
    const stalks = [], leaves = [], ferns = [];
    for (let cy = -MARGIN; cy < MAP_H + 4; cy++) for (let cx = -MARGIN; cx < MAP_W + MARGIN; cx++) {
      if (!isForestCell(cx, cy) || isHutCell(cx, cy)) continue;
      const out = Math.max(-cx, cx - (MAP_W - 1), -cy, cy - (MAP_H - 1), 0);   // cells outside the board
      if (out > 2 && (cx + cy) % 2) continue;                                 // margin: half the cells
      // distance to the nearest open ground: stalks stay low along the paths so the board reads as a clearing
      let pd = 9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!isForestCell(cx + dx, cy + dy) && !isHutCell(cx + dx, cy + dy)) pd = Math.min(pd, Math.max(Math.abs(dx), Math.abs(dy)));
      const n = out > 2 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const x = cx + rand(0.08, 0.92), z = cy + rand(0.08, 0.92), y = groundH(x, z) - 0.05;
        const h = pd <= 1 ? rand(1.5, 2.5) : pd === 2 ? rand(2.2, 3.3) : rand(2.9, 4.4), r = rand(0.022, 0.034);
        stalks.push({ x, y, z, h, r, lean: rand(-0.09, 0.09), col: cx });
        const nl = Math.round(h * (out > 2 ? 0.9 : 1.3));                    // fewer, larger leaf sprays
        for (let k = 0; k < nl; k++) {
          const f = Math.pow(Math.random(), 0.6), ly = y + h * (0.5 + 0.5 * f);
          leaves.push({ x: x + rand(-0.12, 0.12), y: ly, z: z + rand(-0.12, 0.12), ry: rand(0, Math.PI * 2), rx: rand(0.15, 0.7), s: rand(1.2, 1.7) * (0.75 + 0.25 * f), col: cx });
        }
      }
      if (Math.random() < 0.55) ferns.push({ x: cx + rand(0.1, 0.9), z: cy + rand(0.1, 0.9), s: rand(0.45, 0.85), col: cx });
    }
    const dummy = new THREE.Object3D();
    // stalks
    const sGeo = new THREE.CylinderGeometry(0.45, 1.1, 1, 5, 5, true); sGeo.translate(0, 0.5, 0);
    const sMat = new THREE.MeshStandardMaterial({ color: 0x8fbf4a, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
    patchPlant(sMat, { stalk: 1 });
    const sm = this.stalks = new THREE.InstancedMesh(sGeo, sMat, stalks.length);
    sm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); patchPlant(sm.customDepthMaterial, { stalk: 1, depth: 1 });
    stalks.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(s.lean, 0, s.lean * 0.6); dummy.scale.set(s.r, s.h, s.r); dummy.updateMatrix(); sm.setMatrixAt(i, dummy.matrix);
      const tint = 0.8 + Math.random() * 0.35; sm.setColorAt(i, new THREE.Color(tint * 0.9, tint, tint * 0.75));
      if (!this.bambooByCol.has(s.col)) this.bambooByCol.set(s.col, { stalks: [], leaves: [], ferns: [] });
      this.bambooByCol.get(s.col).stalks.push(i);
    });
    sm.castShadow = true; sm.receiveShadow = true; this.scene.add(sm); this.stalkData = stalks;
    // leaf cards
    const lGeo = new THREE.PlaneGeometry(1.0, 0.6); lGeo.translate(0.42, 0, 0);
    const lTex = leafTexture();
    const lMat = new THREE.MeshStandardMaterial({ map: lTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    patchPlant(lMat, { leaf: 1 });
    const lm = this.leaves = new THREE.InstancedMesh(lGeo, lMat, leaves.length);
    lm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lTex, alphaTest: 0.5 }); patchPlant(lm.customDepthMaterial, { leaf: 1, depth: 1 });
    leaves.forEach((l, i) => {
      dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(l.rx, l.ry, rand(-0.5, 0.1)); dummy.scale.setScalar(l.s); dummy.updateMatrix(); lm.setMatrixAt(i, dummy.matrix);
      const t = 0.75 + Math.random() * 0.4; lm.setColorAt(i, new THREE.Color(t, t, t * 0.9));
      if (!this.bambooByCol.has(l.col)) this.bambooByCol.set(l.col, { stalks: [], leaves: [], ferns: [] });
      this.bambooByCol.get(l.col).leaves.push(i);
    });
    lm.castShadow = true; lm.receiveShadow = true; this.scene.add(lm); this.leafData = leaves;
    // ferns: crossed cards
    const fGeo = new THREE.PlaneGeometry(1, 1); fGeo.translate(0, 0.5, 0);
    const fGeo2 = fGeo.clone().rotateY(Math.PI / 2); const merged = mergeGeos([fGeo, fGeo2]);
    const fMat = new THREE.MeshStandardMaterial({ map: fernTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    patchPlant(fMat, { leaf: 1 });
    const fm = new THREE.InstancedMesh(merged, fMat, ferns.length);
    ferns.forEach((f, i) => { dummy.position.set(f.x, groundH(f.x, f.z) - 0.02, f.z); dummy.rotation.set(0, rand(0, 3), 0); dummy.scale.setScalar(f.s); dummy.updateMatrix(); fm.setMatrixAt(i, dummy.matrix); });
    fm.receiveShadow = true; this.scene.add(fm);
  }
  // burning a column: the bamboo there chars down to stumps
  burnBamboo(col, k) {
    const b = this.bambooByCol.get(col); if (!b) return;
    const dummy = new THREE.Object3D(), M = new THREE.Matrix4(), c = new THREE.Color();
    for (const i of b.stalks) {
      const s = this.stalkData[i], h = s.h * (1 - k * 0.78);
      dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(s.lean, 0, s.lean * 0.6); dummy.scale.set(s.r, h, s.r); dummy.updateMatrix(); this.stalks.setMatrixAt(i, dummy.matrix);
      c.setRGB(0.8 - k * 0.72, 0.85 - k * 0.79, 0.6 - k * 0.56); this.stalks.setColorAt(i, c);
    }
    for (const i of b.leaves) { this.leaves.getMatrixAt(i, M); const sc = Math.max(0.0001, 1 - k); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); M.decompose(p, q, s); s.setScalar(this.leafData[i].s * sc); M.compose(p, q, s); this.leaves.setMatrixAt(i, M); c.setRGB(1 - k * 0.6, 1 - k * 0.8, 1 - k * 0.9); this.leaves.setColorAt(i, c); }
    this.stalks.instanceMatrix.needsUpdate = true; this.stalks.instanceColor.needsUpdate = true;
    this.leaves.instanceMatrix.needsUpdate = true; this.leaves.instanceColor.needsUpdate = true;
  }
  shafts() {
    // soft volumetric light shafts slanting down along the sun, over the forest
    const tex = canvasTex(64, 256, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.5, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const fade = g.createLinearGradient(0, 0, 0, H); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.2, 'rgba(0,0,0,0)'); fade.addColorStop(0.8, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, W, H);
    }, { smooth: true });
    this.shaftMeshes = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.8, 1.8), 9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      const x = rand(-2, MAP_W + 2), z = rand(-1, MAP_H + 1);
      m.position.set(x, 3.6, z); m.lookAt(x + SUN_DIR.x * 10, 3.6 + SUN_DIR.y * 10, z + SUN_DIR.z * 10); m.rotateX(Math.PI / 2);
      m.userData = { base: rand(0.05, 0.12), ph: rand(0, 6) }; this.scene.add(m); this.shaftMeshes.push(m);
    }
  }
  post() {
    const r = this.renderer, size = r.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    const comp = this.composer = new EffectComposer(r, rt);
    comp.addPass(this.renderPass = new SceneMSAAPass(this.scene, this.camera));
    // ambient occlusion for the remade sets (off in battles): contact shadows where things meet the floor and walls
    const ao = this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
    ao.overrideVisibility = function () {   // cut-outs (sprites, lattice, flames) would occlude as whole rectangles
      this.scene.traverse(o => { this._visibilityCache.set(o, o.visible);
        const m = o.material; if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (m && !Array.isArray(m) && (m.transparent || m.alphaTest > 0 || m.isShaderMaterial))) o.visible = false; });
    };
    const aoSize = ao.setSize.bind(ao); ao.setSize = (w, h) => aoSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));   // at half resolution: the denoised AO is soft anyway, and full size cost ~50 ms a frame at 2x density
    ao.setSize(size.x, size.y); ao.enabled = false; comp.addPass(ao);
    // bloom only what is brighter than lit paint (fire, glows, lamps, spells): a low threshold blooms every lit floor and
    // sprite into a milky veil over the whole picture (the haze probe in src/qa.js measures it)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.42, 0.45, BLOOM_THRESHOLD); comp.addPass(this.bloom);
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(size.x, size.y) }, uTilt: { value: 0 }, uChroma: { value: 0 },
        uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uBars: { value: 0 }, uSat: { value: 1.08 }, uDark: { value: 0 }, uDarkCol: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uTilt, uChroma, uFlash, uBars, uSat, uDark; uniform vec3 uFlashCol, uDarkCol; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv, c = uv - 0.5;
          float e = smoothstep(0.30, 0.5, abs(c.y)) * uTilt;            // tilt-shift: soft top and bottom (off unless a shot asks)
          vec2 ca = c * uChroma * 0.018;
          vec3 col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
          if (e > 0.01) {
            vec3 acc = col; float rad = e * 7.0 / uRes.y;
            for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996, r = sqrt(float(i) + 0.5) / 3.5;   // golden-angle disc
              acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * rad * vec2(uRes.y / uRes.x, 1.0)).rgb; }
            col = mix(col, acc / 13.0, min(1.0, e * 1.4));
          }
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          col = mix(col, col * vec3(1.05, 1.0, 0.93), smoothstep(0.2, 0.9, l));      // warm highlights
          col = mix(col, col * vec3(0.9, 0.97, 1.08), 1.0 - smoothstep(0.0, 0.25, l)); // cool shadows
          col *= 1.0 - uDark * uDarkCol;   // spell darkness, tinted (e.g. night-blue for water)
          col += uFlashCol * uFlash;
          col *= 1.0 - smoothstep(0.42, 0.75, length(c * vec2(1.0, 0.75))) * 0.18;     // a faint vignette in the corners only
          col += (h(uv * uRes + fract(uTime) * 61.0) - 0.5) * 0.022;                 // grain
          float bar = step(abs(c.y), 0.5 - uBars * 0.11);                            // cinematic letterbox
          gl_FragColor = vec4(col * bar, 1.0);
        }`,
    });
    comp.addPass(this.grade);
    comp.addPass(new OutputPass());
  }
  // a story scene changes one map cell (scene op 24): draw that block's art over the ground
  async paintCell(cx, cy, src, k) {
    if (k < 0 || !this.groundMesh) return;
    const img = await loadImg(src), tex = this.groundMesh.material.map, g = tex.image.getContext('2d'), PX = 64;
    g.imageSmoothingEnabled = false; g.drawImage(img, k * 32, 0, 32, 32, (cx + MARGIN) * PX, (cy + MARGIN) * PX, PX, PX); tex.needsUpdate = true;
  }
  setScale(k) { this.scale = k; this.renderer.setPixelRatio(k); if (this.composer) this.composer._pixelRatio = k; if (this.lastSize) this.resize(...this.lastSize); }   // the composer keeps its own ratio: without it every pass stays at the first scale
  resize(w, h) {
    this.lastSize = [w, h];
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(w, h); this.grade.uniforms.uRes.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio()); }
  }
  setFire(front, burntCount) {      // front: first burnt column (world x)
    U.burnX.value = front;
    this.fireFront = front; this.fireOn = burntCount > 0;
  }
  update(dt, t) {
    U.time.value = t; this.grade.uniforms.uTime.value = t;
    for (const f of this.updaters) f(dt, t);
    U.camPos.value.copy(this.camera.position);
    for (const [i, l] of this.fireLights.entries()) {
      if (!this.fireOn) { l.intensity = 0; continue; }
      l.position.x = this.fireFront + 0.3; l.position.z = 3 + i * 7.5;
      l.intensity = 16 * (0.75 + 0.25 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.7 + i));
    }
    for (const m of this.shaftMeshes) m.material.opacity = m.userData.base * (0.6 + 0.4 * Math.sin(t * 0.4 + m.userData.ph));
  }
  render() {
    this.renderer.shadowMap.needsUpdate = this.shadowsLive || (this.frameNo & 1) === 0; this.frameNo++;   // still: every other frame
    const T = this.gpuTimer(), q = T && !T.busy && T.free.pop();
    if (q) { T.gl.beginQuery(T.ext.TIME_ELAPSED_EXT, q); T.busy = true; }
    this.composer.render();
    if (q) { T.gl.endQuery(T.ext.TIME_ELAPSED_EXT); T.busy = false; T.pending.push(q); }
    if (this.afterRender) { const f = this.afterRender; this.afterRender = null; f(this.renderer.domElement); }   // once: the frame just drawn, while the canvas still holds it (the title's dissolve)
  }
  // GPU time per frame (EXT_disjoint_timer_query_webgl2), read back a few frames late: the frame governor
  // (battle.js) sizes the resolution by it, as frame intervals cannot show headroom under vsync. null where unsupported.
  gpuTimer() {
    if (this.timer !== undefined) return this.timer;
    const gl = this.renderer.getContext(), ext = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.timer = ext ? { gl, ext, free: Array.from({ length: 6 }, () => gl.createQuery()), pending: [], busy: false, sum: 0, n: 0 } : null;
    return this.timer;
  }
  // the mean GPU ms of the frames finished since the last call (null: none yet, or no timer)
  takeGpu() {
    const T = this.gpuTimer(); if (!T) return null;
    const gl = T.gl;
    while (T.pending.length && gl.getQueryParameter(T.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = T.pending.shift();
      if (!gl.getParameter(T.ext.GPU_DISJOINT_EXT)) { T.sum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; T.n++; }
      T.free.push(q);
    }
    if (!T.n) return null;
    const ms = T.sum / T.n; T.sum = T.n = 0; return ms;
  }
}

// reflections for a remade set: a gradient room (ceiling, horizon, floor colours) with a few bright panels (windows,
// lamps, the sky) prefiltered for PBR; env: { top, mid, low, lights: [[x, y, z, colour, size]] }
function envMap(renderer, env) {
  const key = JSON.stringify(env); if (envMap.cache && envMap.cache.key === key) return envMap.cache.tex;
  const s = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16), top = new THREE.Color(env.top ?? 0x8a7a68), mid = new THREE.Color(env.mid ?? 0x4a3a2a), low = new THREE.Color(env.low ?? 0x1a120a);
  const c = []; for (let i = 0; i < geo.attributes.position.count; i++) { const y = geo.attributes.position.getY(i) / 10, col = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.7)) : mid.clone().lerp(low, Math.min(1, -y * 2)); c.push(col.r, col.g, col.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [x, y, z, col, sz] of env.lights || []) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sz || 3, sz || 3), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); }
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.02).texture; pm.dispose();
  if (envMap.cache) envMap.cache.tex.dispose(); envMap.cache = { key, tex }; return tex;
}
// an animated sea of clouds below a heavenly set: billows (a warped noise height) lit by the sun, their tops in warm
// ivory with a golden rim, the folds in soft azure-violet, the gaps glowing deep blue far below; a golden haze off in
// the distance (c: { a: lit, b: shadow, d: the gaps, g: the rim, haze, sun: [x, y, z] })
function cloudMaterial(c) {
  const col = (v, d) => ({ value: new THREE.Color(v ?? d) });
  const m = new THREE.ShaderMaterial({
    fog: false, uniforms: { uTime: U.time, uA: col(c.a, 0xfff2dc), uB: col(c.b, 0xa9b4e0), uD: col(c.d, 0x4a6cc0), uG: col(c.g, 0xffc878), uHaze: col(c.haze, 0xfbe8d0),
      uSun: { value: new THREE.Vector3(...(c.sun || [-0.4, 0.75, 0.5])).normalize() }, uCen: { value: new THREE.Vector2(c.cx || 0, c.cz || 0) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uA, uB, uD, uG, uHaze, uSun; uniform vec2 uCen; varying vec3 vW; ${NOISE_GLSL}
      float f(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.27 + vn(p * 4.1) * 0.15 + vn(p * 8.3) * 0.08; }
      float H(vec2 p){ vec2 q = p + vec2(f(p * 0.45 + uTime * 0.008), f(p * 0.45 - uTime * 0.01 + 3.1)) * 1.3; return smoothstep(0.22, 0.76, f(q)); }
      void main(){ vec2 p = vW.xz * 0.11 + vec2(uTime * 0.01, uTime * 0.004);
        float h = H(p), e = 0.015, hx = H(p + vec2(e, 0.0)), hz = H(p + vec2(0.0, e));
        vec3 n = normalize(vec3((h - hx) * 3.2, e * 8.0, (h - hz) * 3.2));
        float lit = clamp(dot(n, uSun), 0.0, 1.0);
        vec3 col = mix(uD, uB, smoothstep(0.0, 0.3, h));
        col = mix(col, uA, smoothstep(0.2, 0.85, h) * (0.35 + 0.65 * lit));
        col += uG * pow(1.0 - n.y, 1.3) * lit * smoothstep(0.3, 0.9, h) * 0.8;
        float d = length(vW.xz - uCen);
        col = mix(col, uHaze, smoothstep(14.0, 45.0, d) * 0.7);
        gl_FragColor = vec4(col, 1.0); }`,
  });
  return m;
}
function mergeGeos(geos) {
  const pos = [], uv = [], nor = [], idx = []; let off = 0;
  for (const g of geos) {
    const p = g.attributes.position, u = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    off += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setIndex(idx);
  return m;
}
