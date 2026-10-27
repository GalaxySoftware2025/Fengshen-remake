// The battlefield in 3D: terrain, sky, light and post-processing, plus what a battle's look asks for (setLook): a
// remade set (src/remake), or the original map art painted flat on the ground.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { MAP_W, MAP_H } from './rules.js';
const BLOOM_THRESHOLD = 1.35;   // linear scene luminance

export const MARGIN = 8;                       // decorative border around the playable board
let TW = 0, TH = 0;
// the look: { set } (a remade set, src/remake) or { mapSD } (the original map art)
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
export function groundH(x, z) {
  if (LOOK.set) return LOOK.set.ground(x, z);   // a remade set's own walking surface (src/remake)
  return 0;   // painted map art (a map with no remade set): perfectly flat, so its lines stay straight
}
// the ground the effects stand on (spells, casts, level-ups, falls, src/vfx.js): the set's own, but in a battle the level
// the play has there (battle.js setEffectGround: a blocked cell's floor level, as its units stand), so what spills over a
// wall stays at the unit's level instead of climbing onto its top, and nothing drops into an abyss [the user's report]
export let effectH = groundH;
export function setEffectGround(fn) { effectH = fn || groundH; }

// ---------------------------------------------------------------- textures (pixel-art, generated on canvas)
export function canvasTex(w, h, draw, opts) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = (opts && opts.smooth) ? THREE.LinearFilter : THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
  return t;
}
export function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

// a map without a remade set: its original map art, cell for cell, with the edge cells stretched out under the border
async function groundTexture() {
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
// ---------------------------------------------------------------- shader snippets
const NOISE_GLSL = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`;
export const U = { time: { value: 0 } };

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
    progress(0.15);
    this.sky(); progress(0.25);
    await this.ground(); progress(0.5);
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
    const m = this.groundMesh = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m);
  }
  shafts() {
    // soft volumetric light shafts slanting down along the sun
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
  update(dt, t) {
    U.time.value = t; this.grade.uniforms.uTime.value = t;
    for (const f of this.updaters) f(dt, t);
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
