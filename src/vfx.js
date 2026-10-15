// Effects engine: particles, rings, rune circles, pillars, lightning, lights, screen beats, and the fire wall.
import * as THREE from 'three';
import { groundH, rand, MARGIN } from './world.js';
import { MAP_H } from './rules.js';

// ---------------------------------------------------------------- particles
const PVS = `attribute vec4 aCol; attribute float aSize; attribute float aShape; uniform float uScale;
  varying vec4 vCol; varying float vShape;
  void main(){ vCol = aCol; vShape = aShape; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFS = `varying vec4 vCol; varying float vShape;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
    float a = vShape > 0.5 ? step(max(abs(c.x), abs(c.y)), 0.42) : (1.0 - smoothstep(0.0, 0.5, d)) * (vShape < -0.5 ? 1.0 : (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.22, d))));
    if (a < 0.01) discard; gl_FragColor = vec4(vCol.rgb, vCol.a * a); }`;
class Particles {
  constructor(scene, n, blending) {
    this.n = n; this.list = [];
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.shape = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
  }
  add(p) {
    if (this.list.length >= this.n) this.list.shift();
    this.list.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0, age: 0, life: 1, size: 0.1, size1: null, r: 1, gg: 1, b: 1, a: 1, shape: 0, fadeIn: 0.08, wob: 0 }, p));
  }
  update(dt) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.age += dt; if (p.age >= p.life) continue;
      if (p.seek) { const k = Math.min(1, dt * p.seek.k); p.x += (p.seek.x - p.x) * k; p.y += (p.seek.y - p.y) * k; p.z += (p.seek.z - p.z) * k; }
      p.vy -= p.g * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.orb) { const dx = p.x - p.orb.x, dz = p.z - p.orb.z, a = p.orb.w * dt, c = Math.cos(a), s = Math.sin(a), pull = p.orb.pull ? Math.exp(-p.orb.pull * dt) : 1; p.x = p.orb.x + (dx * c - dz * s) * pull; p.z = p.orb.z + (dx * s + dz * c) * pull; }
      if (p.wob) { p.x += Math.sin(p.age * 3 + p.ph) * p.wob * dt; p.z += Math.cos(p.age * 2.3 + p.ph) * p.wob * dt; }
      if (p.floor && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.age / p.life, fade = Math.min(1, p.age / p.fadeIn) * (1 - k * k);
      const j = w++;
      this.pos[j * 3] = p.x; this.pos[j * 3 + 1] = p.y; this.pos[j * 3 + 2] = p.z;
      const flick = p.flicker ? 0.6 + 0.4 * Math.sin(p.age * 40 + p.ph) : 1;
      this.col[j * 4] = p.r * flick; this.col[j * 4 + 1] = p.gg * flick; this.col[j * 4 + 2] = p.b * flick; this.col[j * 4 + 3] = p.a * fade;
      this.size[j] = p.size1 == null ? p.size : p.size + (p.size1 - p.size) * k; this.shape[j] = p.shape;
      L[w - 1] = p;
    }
    L.length = w;
    this.geo.setDrawRange(0, w);
    if (w === 0 && this.lastW === 0) return; this.lastW = w;
    for (const a of ['position', 'aCol', 'aSize', 'aShape']) { const at = this.geo.attributes[a]; at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, w) * at.itemSize); at.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- textures
function ctex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const RUNES = '乾坤震巽坎離艮兌天地風雷水火山澤';
function runeTexture() {
  return ctex(512, 512, (g, W) => {
    const c = W / 2; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, 240, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, 222, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(c, c, 150, 0, Math.PI * 2); g.stroke();
    g.font = 'bold 34px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 186, c + Math.sin(a) * 186); g.rotate(a + Math.PI / 2); g.fillText(RUNES[i], 0, 0); g.restore(); }
    for (let tri = 0; tri < 2; tri++) { g.beginPath(); for (let k = 0; k <= 3; k++) { const a = tri * Math.PI / 3 + k * Math.PI * 2 / 3 - Math.PI / 2; const x = c + Math.cos(a) * 150, y = c + Math.sin(a) * 150; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    // trigram bars around the inner circle
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 112, c + Math.sin(a) * 112); g.rotate(a + Math.PI / 2); for (let b = 0; b < 3; b++) { if ((i >> b) & 1) g.fillRect(-16, -12 + b * 9, 32, 5); else { g.fillRect(-16, -12 + b * 9, 13, 5); g.fillRect(3, -12 + b * 9, 13, 5); } } g.restore(); }
    g.beginPath(); g.arc(c, c, 40, 0, Math.PI * 2); g.stroke();
  });
}
function ringTexture() { return ctex(256, 256, (g, W) => { const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,1)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); }); }
function beamTexture() { return ctex(64, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const f = g.createLinearGradient(0, 0, 0, H); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.35, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = f; g.fillRect(0, 0, W, H); }); }

// ---------------------------------------------------------------- procedural flames, explosion puffs and smoke
// camera-facing quads shaded with scrolling fbm noise and a black-body colour ramp, so fire actually flickers and licks.
// mode 0: flame tongue (stays upright), 1: fireball puff (round, cools to embers), 2: smoke puff (normal blending)
export const NOISE = `float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += fn(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  vec3 ramp(float h){ vec3 c = mix(vec3(0.45, 0.04, 0.0), vec3(0.95, 0.2, 0.02), smoothstep(0.0, 0.3, h));
    c = mix(c, vec3(1.0, 0.42, 0.05), smoothstep(0.3, 0.6, h)); c = mix(c, vec3(1.0, 0.62, 0.15), smoothstep(0.6, 0.9, h));
    c = mix(c, vec3(1.0, 0.92, 0.62), smoothstep(0.92, 1.2, h)); return c * (0.45 + h * 0.8); }`;
const FLAME_VS = `attribute vec4 iPos; attribute vec4 iData; attribute vec3 iTint; varying vec2 vUv; varying vec4 vData; varying vec3 vTint;
  void main(){ vUv = uv; vData = iData; vTint = iTint;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = iData.w < 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float s = iPos.w, asp = iData.z;
    vec2 q = iData.w < 0.5 ? vec2(position.x, position.y + 0.5) : position.xy;   // tongues grow up from their base
    vec3 p = iPos.xyz + right * q.x * s + up * q.y * s * asp;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const FLAME_FS = `uniform float uT, uCover; varying vec2 vUv; varying vec4 vData; varying vec3 vTint;
  ${NOISE}
  void main(){
    float k = vData.x, seed = vData.y * 31.7, mode = vData.w;
    vec2 p = vUv * 2.0 - 1.0;
    vec3 col; float a;
    if (mode < 0.5) {
      float y = clamp(vUv.y, 0.0, 1.0);
      float n = fbm(vec2(p.x * 1.4 + seed, y * 1.8 - uT * 2.6 - seed));
      float n2 = fbm(vec2(p.x * 3.2 - seed, y * 3.6 - uT * 4.8));
      float xw = p.x + (n - 0.5) * 1.1 * y + sin(y * 5.0 - uT * 7.0 + seed) * 0.1 * y;
      float w = mix(0.95, 0.02, pow(y, 0.9));
      float body = 1.0 - smoothstep(0.0, w, abs(xw));                 // soft across: hot in the middle
      float h = body * (1.05 - y * 0.8) * 1.2 - smoothstep(0.25, 1.0, y) * n2 * 0.55 + (n - 0.5) * 0.3;
      h *= smoothstep(0.0, 0.1, y) * 0.5 + 0.5;
      h *= min(1.0, k * 6.0) * (1.0 - k * k * 0.8);
      col = ramp(h) * vTint; a = smoothstep(0.12, 0.4, h) * 0.85;
    } else if (mode < 1.5) {
      float r = length(p);
      float n = fbm(p * 2.2 + seed + vec2(0.0, -uT * 0.9));
      float h = (1.0 - r * 1.15) + (n - 0.5) * 0.9 - k * 0.9;
      col = ramp(h * 0.8) * vTint; a = smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.8, 1.0, r));
    } else {
      float r = length(p);
      float n = fbm(p * 1.8 + seed + vec2(uT * 0.15, -uT * 0.3));
      float d = (1.0 - r) + (n - 0.5) * 0.8;
      a = smoothstep(0.05, 0.45, d) * min(1.0, k * 5.0) * (1.0 - k) * 0.75;
      float lit = (1.0 - vUv.y) * max(0.0, 1.0 - k * 2.5);          // glowing from the fire below at first
      col = vTint * (0.55 + n * 0.5) + vec3(1.0, 0.45, 0.1) * lit * 0.6;
    }
    if (a < 0.01) discard;
    // premultiplied: the cooler outer flame partly covers what is behind it (keeps the colour saturated), the hot core adds light
    gl_FragColor = mode > 1.5 ? vec4(col, a) : vec4(col * a, a * uCover); }`;
class Flames {
  constructor(scene, n, smoke) {
    this.n = n; this.list = [];
    const base = new THREE.PlaneGeometry(1, 1), geo = this.geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(n * 4); this.aData = new Float32Array(n * 4); this.aTint = new Float32Array(n * 3);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.aPos, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iData', new THREE.InstancedBufferAttribute(this.aData, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(this.aTint, 3).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms: { uT: { value: 0 }, uCover: { value: 0.55 } }, transparent: true, depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = smoke ? 4 : 5; scene.add(this.mesh);
  }
  add(o) { if (this.list.length >= this.n) this.list.shift(); this.list.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0, age: 0, life: 1, size: 0.5, size1: null, asp: 1, mode: 0, tint: [1, 1, 1], seed: Math.random() }, o)); const q = this.list[this.list.length - 1]; if (!q.tint) q.tint = [1, 1, 1]; }
  update(dt, t) {
    this.mat.uniforms.uT.value = t;
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.age += dt; if (p.age >= p.life) continue;
      if (p.follow) { p.x = p.follow.x + (p.fx || 0); p.y = p.follow.y + (p.fy || 0); p.z = p.follow.z + (p.fz || 0); }
      p.vy -= p.g * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.orb) { const dx = p.x - p.orb.x, dz = p.z - p.orb.z, a = p.orb.w * dt, c = Math.cos(a), s = Math.sin(a); p.x = p.orb.x + dx * c - dz * s; p.z = p.orb.z + dx * s + dz * c; }
      const k = p.age / p.life, j = w++;
      this.aPos[j * 4] = p.x; this.aPos[j * 4 + 1] = p.y; this.aPos[j * 4 + 2] = p.z; this.aPos[j * 4 + 3] = p.size1 == null ? p.size : p.size + (p.size1 - p.size) * Math.sqrt(k);
      this.aData[j * 4] = k; this.aData[j * 4 + 1] = p.seed; this.aData[j * 4 + 2] = p.asp; this.aData[j * 4 + 3] = p.mode;
      this.aTint[j * 3] = p.tint[0]; this.aTint[j * 3 + 1] = p.tint[1]; this.aTint[j * 3 + 2] = p.tint[2];
      L[w - 1] = p;
    }
    L.length = w; this.geo.instanceCount = w;
    if (w === 0 && this.lastW === 0) return; this.lastW = w;
    for (const a of ['iPos', 'iData', 'iTint']) { const at = this.geo.attributes[a]; at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, w) * at.itemSize); at.needsUpdate = true; }
  }
}
// burning sphere: layered noise shell with a white-hot core and a bright rim
const BALL_FS = `uniform float uT, uHeat; uniform vec3 uTint; varying vec3 vN, vV, vP;
  ${NOISE}
  void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    vec3 q = normalize(vP);
    vec2 w = vec2(fbm(q.xy * 1.6 + vec2(uT * 0.4, -uT * 0.9)), fbm(q.zx * 1.6 + vec2(5.2, 1.3) - uT * 0.6));
    // domain-warped noise on three planes (no seams at the poles): rolling, boiling plasma
    float n = (fbm(q.xy * 2.2 + w * 1.5 + vec2(0.0, -uT * 1.4)) + fbm(q.yz * 2.2 + w.yx * 1.5 - uT * 0.9) + fbm(q.zx * 2.2 - w * 1.5 + uT * 0.7)) / 3.0;
    n = (n - 0.5) * 1.7 + 0.5;
    float core = 1.0 - f;
    float h = core * 0.4 + (n - 0.5) * 2.0 + 0.32;
    vec3 c = ramp(h * uHeat) * uTint + vec3(1.0, 0.45, 0.08) * pow(f, 2.5) * 0.9 * uHeat;   // hot rim
    float a = smoothstep(0.05, 0.35, h + f * 0.4) * (1.0 - smoothstep(0.85, 1.0, f) * 0.8);
    gl_FragColor = vec4(c * a, a * 0.8); }`;
const BALL_VS = `varying vec3 vN, vV, vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
// ribbon trail: a camera-facing strip through the last N positions of a moving point, bright core fading to the tail
class Ribbon {
  constructor(vfx, o) {
    this.v = vfx; this.o = Object.assign({ n: 24, width: 0.12, col: [1, 1, 1], fade: 0.25, taper: 1 }, o); this.pts = []; this.dead = false; this.fadeK = 1;
    const N = this.o.n, g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3); this.uvs = new Float32Array(N * 2 * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uCol: { value: new THREE.Color(...this.o.col) }, uA: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv;
        void main(){ vec2 uv = clamp(vUv, 0.0, 1.0);   // MSAA can extrapolate varyings past the strip: keep pow() bases >= 0
          float across = 1.0 - abs(uv.y * 2.0 - 1.0); float core = across * across * across; float along = pow(1.0 - uv.x, 1.6);
          vec3 c = uCol * (0.8 + core * 1.8) + vec3(core * along * 1.2); gl_FragColor = vec4(c, across * along * uA); }` });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    vfx.timed(this.mesh, 1e9, (k, dt) => this.tick(dt));
  }
  push(p) { if (!this.dead) { this.pts.unshift(p.clone()); if (this.pts.length > this.o.n) this.pts.pop(); } }
  end() { this.dead = true; }
  tick(dt) {
    const it = this.v.items.find(i => i.mesh === this.mesh);
    if (this.dead) { this.fadeK -= dt / this.o.fade; if (this.pts.length > 2) this.pts.pop(); if (this.fadeK <= 0 && it) it.life = 0; }
    this.mat.uniforms.uA.value = Math.max(0, this.fadeK);
    const P = this.pts, n = P.length, cam = this.v.world.camera.position, tmp = new THREE.Vector3(), side = new THREE.Vector3(), view = new THREE.Vector3();
    if (n < 2) { this.geo.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      tmp.subVectors(a, b); view.subVectors(cam, P[i]); side.crossVectors(tmp, view).normalize();
      const w = this.o.width * (1 - (i / (n - 1)) * this.o.taper * 0.85);
      this.pos.set([P[i].x + side.x * w, P[i].y + side.y * w, P[i].z + side.z * w, P[i].x - side.x * w, P[i].y - side.y * w, P[i].z - side.z * w], i * 6);
      this.uvs.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
    }
    this.geo.setDrawRange(0, (n - 1) * 6); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the engine
export class VFX {
  constructor(world) {
    this.world = world; const S = this.scene = world.scene;
    this.add = new Particles(S, 9000, THREE.AdditiveBlending);
    this.soft = new Particles(S, 4000, THREE.NormalBlending);
    this.flames = new Flames(S, 2500, false); this.smokes = new Flames(S, 700, true);
    this.items = [];                 // timed meshes: { mesh, t, life, update(k, dt) }
    this.runeTex = runeTexture(); this.ringTex = ringTexture(); this.beamTex = beamTexture();
    this.glowTex = ctex(128, 128, (g, W) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); });
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); l.position.set(0, -50, 0); S.add(l); this.lights.push({ l, t: 0, life: 0, base: 0 }); }
    this.screen = { shake: 0, shakeT: 0, flash: 0, flashCol: new THREE.Color(1, 1, 1), chroma: 0, dark: 0, darkTarget: 0, darkCol: new THREE.Color(1, 1, 1), bars: 0, barsTarget: 0 };
    this.hitstop = 0; this.timeScale = 1;
    this.fire = new FireWall(world, this);
  }
  // ---- primitives
  spark(x, y, z, o) { this.add.add(Object.assign({ x, y, z }, o)); }
  smoke(x, y, z, o) { this.soft.add(Object.assign({ x, y, z }, o)); }
  burst(p, o) {
    o = Object.assign({ n: 30, speed: 4, col: [1, 0.8, 0.5], size: 0.08, life: 0.7, g: 6, up: 0.4, shape: 1, spread: 1 }, o);
    for (let i = 0; i < o.n; i++) {
      const a = rand(0, Math.PI * 2), e = rand(-0.2, 1) * o.spread, v = o.speed * rand(0.35, 1);
      const c = o.cols ? o.cols[(Math.random() * o.cols.length) | 0] : o.col;
      this.spark(p.x, p.y, p.z, { vx: Math.cos(a) * v * Math.cos(e), vy: Math.sin(e) * v + o.up * o.speed, vz: Math.sin(a) * v * Math.cos(e), g: o.g, drag: 1.5, life: rand(0.5, 1) * o.life,
        size: o.size * rand(0.7, 1.3), r: c[0], gg: c[1], b: c[2], shape: o.shape, floor: groundH(p.x, p.z) + 0.02, ph: rand(0, 9), flicker: o.flicker });
    }
  }
  flame(x, y, z, o) { this.flames.add(Object.assign({ x, y, z }, o)); }
  puff(x, y, z, o) { this.flames.add(Object.assign({ x, y, z, mode: 1 }, o)); }
  smokePuff(x, y, z, o) { this.smokes.add(Object.assign({ x, y, z, mode: 2, tint: [0.16, 0.13, 0.12] }, o)); }
  ribbon(o) { return new Ribbon(this, o); }
  fireball(radius, o) {
    o = o || {};
    const mat = new THREE.ShaderMaterial({ vertexShader: BALL_VS, fragmentShader: BALL_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false,
      uniforms: { uT: { value: 0 }, uHeat: { value: o.heat || 1.1 }, uTint: { value: new THREE.Color(...(o.tint || [1, 1, 1])) } } });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 4), mat); m.renderOrder = 5; m.userData.mat = mat; return m;
  }
  // explosion: a cluster of fire puffs expanding and cooling, then smoke rolling up
  explode(p, size, o) {
    o = o || {}; const n = o.n || 18, tint = o.tint || [1, 1, 1];
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), e = rand(-0.1, 1.2), s = size * rand(1.5, 3.2);
      this.puff(p.x, p.y, p.z, { vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s * 0.8 + size * 0.6, vz: Math.sin(a) * Math.cos(e) * s, drag: 3.2, life: rand(0.45, 0.85), size: size * rand(0.5, 0.9), size1: size * rand(1.4, 2.2), tint });
    }
    if (o.smoke !== false) for (let i = 0; i < n * 0.6; i++) {
      const a = rand(0, 6.28), s = size * rand(0.6, 1.6);
      this.smokePuff(p.x + rand(-0.2, 0.2) * size, p.y + size * 0.3, p.z + rand(-0.2, 0.2) * size, { vx: Math.cos(a) * s, vy: rand(0.6, 1.4) * size, vz: Math.sin(a) * s, drag: 1.4, life: rand(1.6, 2.8), size: size * 0.8, size1: size * rand(2.2, 3.2), tint: o.smokeTint || [0.14, 0.12, 0.11] });
    }
  }
  timed(mesh, life, update, onEnd) { this.scene.add(mesh); this.items.push({ mesh, t: 0, life, update, onEnd }); return mesh; }
  // soft additive glow lying on the ground (scorch, frost, holy light), fading in and out
  decal(p, col, r, life, o) {
    o = o || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: this.glowTex, color: new THREE.Color(...col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, groundH(p.x, p.z) + 0.03, p.z); m.renderOrder = 3;
    return this.timed(m, life, k => { m.material.opacity = Math.min(1, k * life / (o.in || 0.25)) * Math.min(1, (1 - k) * life / (o.out || 0.5)) * (o.intensity || 1) * (o.flicker ? 0.8 + 0.2 * Math.random() : 1); });
  }
  ring(p, col, r1, life, o) {
    o = o || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.ringTex, color: new THREE.Color(...col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, (o.y != null ? o.y : groundH(p.x, p.z) + 0.05), p.z); m.renderOrder = 4;
    if (o.vertical) { m.rotation.set(0, o.yaw || 0, 0); }
    return this.timed(m, life, k => { const s = 0.05 + r1 * (1 - Math.pow(1 - k, 3)); m.scale.set(s, s, s); m.material.opacity = (1 - k) * (o.intensity || 2); });
  }
  runeCircle(p, col, radius, life, o) {
    o = o || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: this.runeTex, color: new THREE.Color(...col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, groundH(p.x, p.z) + 0.04, p.z); m.renderOrder = 4;
    const inner = new THREE.Mesh(m.geometry, m.material.clone()); inner.scale.setScalar(0.62); inner.position.z = 0.002; m.add(inner);
    return this.timed(m, life, (k, dt) => {
      const fadeIn = Math.min(1, k * life / 0.35), fadeOut = Math.min(1, (1 - k) * life / 0.4);
      m.material.opacity = inner.material.opacity = fadeIn * fadeOut * (o.intensity || 1.6);
      m.rotation.z += dt * (o.spin || 0.8); inner.rotation.z -= dt * (o.spin || 0.8) * 2.2;
      const s = 0.6 + 0.4 * Math.min(1, k * life / 0.35); m.scale.setScalar(s);
    });
  }
  pillar(p, col, radius, height, life, o) {
    o = o || {};
    const geo = new THREE.CylinderGeometry(radius, radius * (o.taper || 1), height, 32, 1, true); geo.translate(0, height / 2, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uCol: { value: new THREE.Color(...col) }, uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uT, uA; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9,78.2))) * 43758.5); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ float s = n(vec2(vUv.x * 18.0, vUv.y * 4.0 - uT * 3.0)) * 0.6 + n(vec2(vUv.x * 40.0, vUv.y * 9.0 - uT * 6.0)) * 0.4;
          float a = (0.35 + s) * (1.0 - vUv.y) * smoothstep(0.0, 0.08, vUv.y) * uA; gl_FragColor = vec4(uCol * (1.0 + s), a); }`,
    });
    const m = new THREE.Mesh(geo, mat); m.position.set(p.x, groundH(p.x, p.z), p.z); m.renderOrder = 4;
    return this.timed(m, life, (k, dt) => { mat.uniforms.uT.value += dt; mat.uniforms.uA.value = Math.min(1, k * life / 0.2) * Math.min(1, (1 - k) * life / 0.35) * (o.intensity || 1.4); const s = o.grow ? 0.3 + 0.7 * Math.min(1, k * 3) : 1; m.scale.set(s, 1, s); });
  }
  bolt(from, to, col, life, o) {
    o = o || {};
    // jagged ribbon (two crossed strips so it reads from any camera yaw) regenerated a few times while it lives
    const segs = 22, mk = () => {
      const pts = [from.clone()];
      for (let i = 1; i < segs; i++) { const t = i / segs, p = from.clone().lerp(to, t); const j = (1 - Math.abs(t - 0.5) * 2) * (o.jag || 0.9); p.x += rand(-j, j) * 0.6; p.z += rand(-j, j) * 0.6; pts.push(p); }
      pts.push(to.clone()); return pts;
    };
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...col).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const group = new THREE.Group();
    const build = () => {
      group.clear(); const pts = mk();
      for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
        const pos = []; const w = o.width || 0.09;
        for (const p of pts) { pos.push(p.x - axis.x * w, p.y, p.z - axis.z * w, p.x + axis.x * w, p.y, p.z + axis.z * w); }
        const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        group.add(new THREE.Mesh(g, mat));
      }
      // forks
      for (let f = 0; f < 3; f++) {
        const s = pts[(rand(4, segs - 4)) | 0], e = s.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1.4, -0.4), rand(-1, 1)));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([s.x - 0.03, s.y, s.z, s.x + 0.03, s.y, s.z, e.x, e.y, e.z], 3));
        group.add(new THREE.Mesh(g, mat));
      }
    };
    build(); group.renderOrder = 6;
    let acc = 0;
    return this.timed(group, life, (k, dt) => { acc += dt; if (acc > 0.05) { acc = 0; build(); } mat.opacity = (1 - k) * 1.2 * (0.6 + 0.4 * Math.random()); });
  }
  light(p, col, intensity, life, dist) {
    const L = this.lights.reduce((a, b) => (a.t / (a.life || 1) > b.t / (b.life || 1) ? a : b));
    const s = this.lights.find(x => x.life === 0 || x.t >= x.life) || L;
    s.l.position.copy(p); s.l.color.setRGB(...col); s.l.distance = dist || 10; s.t = 0; s.life = life; s.base = intensity * 0.55;   // effect lights stay a tint: bloom carries the glow
  }
  rain(center, life, o) {
    o = o || {}; const N = o.n || 500, pos = new Float32Array(N * 6), seed = [];
    for (let i = 0; i < N; i++) seed.push([rand(-10, 10), rand(0, 9), rand(-8, 8), rand(0.8, 1.2)]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(...(o.col || [0.55, 0.7, 1])), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.frustumCulled = false; m.renderOrder = 6;
    return this.timed(m, life, (k, dt, t) => {
      m.material.opacity = Math.min(1, t * 3) * Math.min(1, (life - t) * 2) * 0.55;
      for (let i = 0; i < N; i++) { const s0 = seed[i], y = 9 - ((s0[1] + t * 16 * s0[3]) % 9); const x = center.x + s0[0] + (9 - y) * -0.12, z = center.z + s0[2];
        pos.set([x, center.y + y, z, x + 0.06, center.y + y + 0.55, z], i * 6); }
      g.attributes.position.needsUpdate = true;
    });
  }
  // ---- screen
  shake(a, t) { this.screen.shake = Math.max(this.screen.shake, a); this.screen.shakeT = Math.max(this.screen.shakeT, t || 0.25); }
  flash(col, a) { this.screen.flash = Math.max(this.screen.flash, a); this.screen.flashCol.setRGB(...col); }
  impact(p, col, power) {
    power = power || 1;
    this.ring(p, col, 2.6 * power, 0.55);
    this.burst(p.clone().setY(p.y + 0.4), { n: 36 * power, speed: 5 * power, col: [1, 1, 1], cols: [[1, 1, 1], col, col], size: 0.07, life: 0.8, shape: 1 });
    this.burst(p.clone().setY(p.y + 0.4), { n: 6, speed: 2, col, size: 0.35, life: 0.3, g: 0, shape: 0, up: 0.1 });
    this.light(p.clone().setY(p.y + 1), col, 9 * power, 0.35, 6);
    this.shake(0.12 * power, 0.28); this.hitstop = Math.max(this.hitstop, 0.06 + 0.05 * power); this.screen.chroma = Math.max(this.screen.chroma, 0.22 * power);
    this.flash(col, 0.04 * power);
  }
  // ---- per frame
  update(dt, t) {
    this.add.update(dt); this.soft.update(dt); this.flames.update(dt, t); this.smokes.update(dt, t);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; const k = Math.min(1, it.t / it.life);
      it.update && it.update(k, dt, it.t);
      if (k >= 1) { this.scene.remove(it.mesh); it.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.items.splice(i, 1); it.onEnd && it.onEnd(); }
    }
    for (const s of this.lights) { if (s.life <= 0) continue; s.t += dt; const k = s.t / s.life; s.l.intensity = k >= 1 ? 0 : s.base * (1 - k) * (1 - k); if (k >= 1) s.life = 0; }
    const sc = this.screen;
    sc.flash *= Math.exp(-dt * 7); sc.chroma *= Math.exp(-dt * 5); sc.shakeT = Math.max(0, sc.shakeT - dt); if (!sc.shakeT) sc.shake = 0;
    sc.dark += (sc.darkTarget - sc.dark) * (1 - Math.exp(-dt * 3)); sc.bars += (sc.barsTarget - sc.bars) * (1 - Math.exp(-dt * 4));
    const gr = this.world.grade.uniforms;
    gr.uFlash.value = sc.flash; gr.uFlashCol.value.copy(sc.flashCol); gr.uChroma.value = sc.chroma; gr.uDark.value = sc.dark; gr.uDarkCol.value.copy(sc.darkCol); gr.uBars.value = sc.bars;
    this.fire.update(dt, t);
  }
  ambient(dt, center) {
    // drifting dust motes in the sunlight and bamboo leaves falling on the westward wind
    if (Math.random() < dt * 9) this.spark(center.x + rand(-9, 9), rand(0.3, 3), center.z + rand(-6, 6), { vx: rand(-0.15, 0.05), vy: rand(-0.03, 0.05), vz: rand(-0.05, 0.05), life: rand(3, 6), size: rand(0.03, 0.05), r: 1, gg: 0.92, b: 0.7, a: 0.5, shape: 0, fadeIn: 1, wob: 0.1, ph: rand(0, 6) });
    if (Math.random() < dt * 5) {
      const c = [[0.5, 0.8, 0.28], [0.36, 0.62, 0.2], [0.65, 0.85, 0.4]][(Math.random() * 3) | 0];
      this.smoke(center.x + rand(-10, 12), rand(3, 5), center.z + rand(-7, 6), { vx: rand(-0.9, -0.4), vy: rand(-0.55, -0.35), vz: rand(-0.1, 0.1), life: 8, size: 0.07, r: c[0], gg: c[1], b: c[2], a: 1, shape: 1, wob: 0.6, ph: rand(0, 6), floor: 0.05 });
    }
  }
}

// ---------------------------------------------------------------- the fire wall
// the original pixel flames (fire.png, 4 frames) as instanced billboards along every burnt column
class FireWall {
  constructor(world, vfx) {
    this.world = world; this.vfx = vfx; this.cols = new Map(); // col -> burn time
    // the original fire tile includes scorched ground behind the flames: key those colours out (mask from the SD frames)
    const cv = document.createElement('canvas'), tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    Promise.all(['assets/sd/fire.png', 'assets/fire.png'].map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }))).then(([sd, hd]) => {
      const a = document.createElement('canvas'); a.width = sd.width; a.height = sd.height; const ag = a.getContext('2d'); ag.drawImage(sd, 0, 0);
      const m = ag.getImageData(0, 0, sd.width, sd.height).data;
      cv.width = hd.width; cv.height = hd.height; const g = cv.getContext('2d'); g.drawImage(hd, 0, 0);
      const id = g.getImageData(0, 0, cv.width, cv.height), k = hd.width / sd.width;
      const bg = (r, gg, b) => (r === 108 && gg === 72) || (r === 72 && gg === 36) || (r === 144 && gg === 144) || (r === 216 && gg === 216 && b === 180);
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const j = ((y / k | 0) * sd.width + (x / k | 0)) * 4;
        if (bg(m[j], m[j + 1], m[j + 2])) id.data[(y * cv.width + x) * 4 + 3] = 0;
      }
      g.putImageData(id, 0, 0); tex.needsUpdate = true;
    });
    const MAX = 2200, geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(MAX * 4); this.aInfo = new Float32Array(MAX * 2);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.aPos, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(this.aInfo, 2).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0; this.geo = geo; this.MAX = MAX;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
      uniforms: { uMap: { value: tex }, uTime: { value: 0 }, uYaw: { value: 0 } },
      vertexShader: `attribute vec4 iPos; attribute vec2 iInfo; uniform float uTime, uYaw; varying vec2 vUv; varying float vA;
        void main(){ float fr = floor(mod(uTime * 9.0 + iInfo.x * 4.0, 4.0)); vUv = vec2((uv.x + fr) / 4.0, uv.y); vA = iInfo.y;
          float s = iPos.w; vec3 right = vec3(cos(uYaw), 0.0, -sin(uYaw));
          vec3 p = iPos.xyz + right * (position.x * s) + vec3(0.0, position.y * s * 1.25, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA;
        void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < 0.1) discard; gl_FragColor = vec4(c.rgb * 1.6, c.a * vA); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; world.scene.add(this.mesh);
    this.mat = mat;
    this.layout = [];
  }
  burn(col, t) { this.cols.set(col, t); this.relayout(); }
  relayout() {
    const L = []; const front = Math.min(...this.cols.keys());
    for (const [c, t0] of this.cols) {
      const age = c - front;                 // 0 = the advancing front
      const rows = [];
      for (let z = -MARGIN; z < MAP_H + MARGIN; z += age === 0 ? 0.5 : age === 1 ? 0.9 : 1.6) rows.push(z);
      for (const z of rows) {
        const x = c + rand(0.05, 0.95), zz = z + rand(0, 0.4);
        const s = age === 0 ? rand(1.3, 2.3) : age === 1 ? rand(0.8, 1.3) : rand(0.3, 0.6);
        if (age > 2 && Math.random() < 0.65) continue;
        L.push([x, groundH(x, zz) - 0.05, zz, s, Math.random(), age === 0 ? 1 : age === 1 ? 0.8 : 0.5]);
      }
    }
    const n = Math.min(this.MAX, L.length);
    for (let i = 0; i < n; i++) { const l = L[i]; this.aPos.set([l[0], l[1], l[2], l[3]], i * 4); this.aInfo.set([l[4], l[5]], i * 2); }
    this.geo.instanceCount = n; this.geo.attributes.iPos.needsUpdate = true; this.geo.attributes.iInfo.needsUpdate = true;
    this.front = front;
  }
  update(dt, t) {
    this.mat.uniforms.uTime.value = t;
    if (!this.cols.size) return;
    const f = this.front, v = this.vfx;
    // embers lifting off the front and smoke rolling west on the wind
    for (let i = 0; i < 3; i++) if (Math.random() < dt * 60) v.spark(f + rand(0, 1.2), rand(0.2, 1.6), rand(-4, MAP_H + 4), { vx: rand(-1.6, -0.4), vy: rand(0.8, 2.2), vz: rand(-0.3, 0.3), life: rand(0.8, 2), size: rand(0.03, 0.06), r: 1, gg: rand(0.45, 0.8), b: 0.15, shape: 1, flicker: 1, ph: rand(0, 9), wob: 0.4 });
    if (Math.random() < dt * 14) v.smoke(f + rand(0, 2), rand(0.8, 2), rand(-4, MAP_H + 4), { vx: rand(-1.2, -0.5), vy: rand(0.5, 1), vz: rand(-0.2, 0.2), life: rand(3, 5), size: rand(0.9, 1.4), size1: rand(2.4, 3.6), r: 0.16, gg: 0.13, b: 0.12, a: 0.32, shape: -1, fadeIn: 0.8 });
  }
}
