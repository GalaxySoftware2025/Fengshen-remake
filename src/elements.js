// Ice for the spells (冰晶術, 裂冰術, 風雪冰天, 崩冰術) made to read as ice [the user's call: "simple squares and triangles",
// make it real]: crystals grown as hexagonal prisms with pyramid tips, each face its own facet; a material that looks
// through itself (deep blue in the thick, pale at the edges, a bright rim where it turns from the light), frozen cracks
// and trapped bubbles inside, a cold glint on the facets; chunks of rough ice; shards that break off, tumble, bounce and
// melt away; frost that spreads over the ground in feathered lines.
import * as THREE from 'three';
import { groundH, rand } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// one material for all ice: lit by a fixed cold key light (the facets read the same in any set), its own look-through
const ICE_VS = `varying vec3 vW, vO; void main(){ vO = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const ICE_FS = `uniform float uA, uGlow; varying vec3 vW, vO;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  void main(){
    vec3 N = normalize(cross(dFdx(vW), dFdy(vW))), Vd = normalize(cameraPosition - vW); if (dot(N, Vd) < 0.0) N = -N;   // flat: each facet its own
    vec3 L = normalize(vec3(-0.4, 0.85, 0.35));
    float fr = pow(1.0 - max(0.0, dot(N, Vd)), 2.2), diff = 0.45 + 0.55 * max(0.0, dot(N, L));
    float spec = pow(max(0.0, dot(reflect(-L, N), Vd)), 40.0);
    // inside: frozen cracks (thin bright sheets where noise crosses a level) and a few bubbles
    vec3 q = vO * 3.0 + vW * 0.7;
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(n3(q * 2.3) - 0.5)), crack2 = 1.0 - smoothstep(0.0, 0.025, abs(n3(q * 5.1 + 9.0) - 0.5));
    float bub = smoothstep(0.93, 0.97, n3(q * 9.0));
    vec3 deep = vec3(0.05, 0.28, 0.62), pale = vec3(0.72, 0.92, 1.0);
    vec3 col = mix(deep, pale, 0.35 + 0.65 * fr) * diff;
    col += vec3(0.75, 0.92, 1.0) * (crack * 0.35 + crack2 * 0.2 + bub * 0.4);
    col += vec3(1.0) * spec * 1.4 + vec3(0.6, 0.9, 1.0) * fr * 0.55 + vec3(0.25, 0.55, 1.0) * uGlow;
    gl_FragColor = vec4(col, uA * (0.62 + 0.38 * fr));
  }`;
export function iceMaterial(o = {}) {
  return new THREE.ShaderMaterial({ vertexShader: ICE_VS, fragmentShader: ICE_FS, transparent: true, depthWrite: true, toneMapped: false, side: THREE.FrontSide,
    uniforms: { uA: { value: o.opacity ?? 0.92 }, uGlow: { value: o.glow ?? 0.12 } } });
}
// a crystal: a six-sided prism (unit radius at its foot, rising to 1 at the tip), its sides a little uneven, a pyramid tip
export function shardGeometry(sides = 6, tip = 0.28) {
  const pts = [], ring = (y, r) => Array.from({ length: sides }, (_, i) => { const a = i / sides * Math.PI * 2 + rand(-0.12, 0.12), rr = r * rand(0.82, 1.08); return V(Math.cos(a) * rr, y, Math.sin(a) * rr); });
  const b = ring(0, 1), m = ring(1 - tip, rand(0.82, 0.95)), top = V(rand(-0.12, 0.12), 1, rand(-0.12, 0.12)), bot = V(0, 0, 0);
  const tri = (a, c, d) => pts.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; tri(b[i], m[i], b[j]); tri(b[j], m[i], m[j]); tri(m[i], top, m[j]); tri(b[j], bot, b[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g;
}
// a rough chunk of ice: a lumpy faceted boulder of radius about 1
export function chunkGeometry(detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(), p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) { const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join(); if (!seen.has(k)) seen.set(k, rand(0.78, 1.12)); const s = seen.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.9, p.getZ(i) * s); }
  g.computeVertexNormals(); return g;
}
// shards breaking off from p: small crystals flung out that tumble, fall, bounce once and melt away
export function shatter(v, p, n, mat, o = {}) {
  const sp = o.speed ?? 3, sz = o.size ?? 0.12;
  for (let i = 0; i < n; i++) {
    const s = sz * rand(0.5, 1.3), m = new THREE.Mesh(shardGeometry(Math.random() < 0.5 ? 5 : 6, rand(0.25, 0.45)), mat); m.scale.set(s * 0.45, s * rand(1, 2), s * 0.45);
    m.position.copy(p).add(V(rand(-0.15, 0.15), rand(-0.1, 0.2), rand(-0.15, 0.15)));
    const vel = V(rand(-1, 1) * sp, rand(0.6, 1.6) * sp * 0.8, rand(-1, 1) * sp), spin = V(rand(-12, 12), rand(-12, 12), rand(-12, 12)), life = rand(0.9, 1.4), s0 = m.scale.clone();
    let bounced = false;
    v.timed(m, life, (k, dt) => {
      vel.y -= dt * 11; m.position.addScaledVector(vel, dt); m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
      const g = groundH(m.position.x, m.position.z) + 0.02; if (m.position.y < g) { m.position.y = g; if (!bounced) { bounced = true; vel.y = Math.abs(vel.y) * 0.3; vel.x *= 0.5; vel.z *= 0.5; spin.multiplyScalar(0.4); } else { vel.set(0, 0, 0); spin.set(0, 0, 0); } }
      if (k > 0.6) m.scale.copy(s0).multiplyScalar(1 - (k - 0.6) / 0.4);   // melting away
    });
  }
}
// frost spreading over the ground round p: feathered lines of rime growing out from the middle, then thawing
let FROST = null;
function frostTex() {
  if (FROST) return FROST;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 10, 256, 256, 250); gr.addColorStop(0, 'rgba(225,242,255,0.75)'); gr.addColorStop(0.55, 'rgba(200,232,255,0.35)'); gr.addColorStop(1, 'rgba(200,232,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); g.lineCap = 'round';
  const branch = (x, y, a, len, w, d) => {   // a fern of rime: a stem with side shoots, each shoot again
    if (d > 3 || len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.strokeStyle = `rgba(245,252,255,${0.85 - d * 0.15})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    const n = 6 - d; for (let i = 1; i <= n; i++) { const t = i / (n + 1), px = x + (x2 - x) * t, py = y + (y2 - y) * t; for (const s of [-1, 1]) branch(px, py, a + s * (0.9 + Math.random() * 0.3), len * 0.38 * (1 - t * 0.5), w * 0.6, d + 1); }
  };
  for (let i = 0; i < 14; i++) branch(256, 256, i / 14 * Math.PI * 2 + Math.random() * 0.2, 150 + Math.random() * 80, 2.6, 0);
  FROST = new THREE.CanvasTexture(c); FROST.colorSpace = THREE.SRGBColorSpace; return FROST;
}
export function frost(v, p, r, life) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: frostTex(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false, color: new THREE.Color(1.1, 1.15, 1.25) }));
  m.position.set(p.x, groundH(p.x, p.z) + 0.03, p.z); m.rotation.y = rand(0, 6.28); m.renderOrder = 2; m.userData.noRange = true;
  v.timed(m, life, k => { const g = Math.min(1, k / 0.22); m.scale.setScalar(Math.max(0.01, r * 2 * (0.3 + 0.7 * (1 - Math.pow(1 - g, 3))))); m.material.opacity = Math.min(1, k * 6) * (1 - Math.max(0, k - 0.75) / 0.25); });
  return m;
}
