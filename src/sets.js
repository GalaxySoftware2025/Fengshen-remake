// Story sets: the registry of remade scene maps (src/remake/index.js) and the effects they share — water, braziers and
// flames, smoke, torches, floor glows, ambient particles. A set's own build (src/remake/*.js) models everything else.
import * as THREE from 'three';
import { groundH } from './world.js';
import { rand } from './world.js';

const SETS = {};
export const registerSets = defs => Object.assign(SETS, defs);
export const setFor = key => SETS[key] || null;
function shadowed(mesh, map) {
  mesh.castShadow = mesh.receiveShadow = true;
  if (map) mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  return mesh;
}
const WATER = { uTime: { value: 0 } };
function water(S, p) {
  const [x0, y0, x1, y1] = p.r, geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 8, 8); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: false, uniforms: { uTime: WATER.uTime, uDeep: { value: new THREE.Color(p.deep ?? 0x050a24) }, uLit: { value: new THREE.Color(p.lit ?? 0x2a4a8a) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep, uLit; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vW.xz;
        float r = n(p * 3.0 + vec2(uTime * 0.25, uTime * 0.15)) * 0.6 + n(p * 7.0 - vec2(uTime * 0.4, 0.0)) * 0.4;
        vec3 col = mix(uDeep, uLit, smoothstep(0.55, 0.95, r) * 0.55);
        vec2 g = floor(p * 14.0); float s = h(g); float tw = 0.5 + 0.5 * sin(uTime * (1.5 + 3.0 * s) + s * 40.0);
        float star = step(0.965, s) * tw * smoothstep(0.35, 0.0, length(fract(p * 14.0) - 0.5));
        col += vec3(0.6, 0.8, 1.0) * star * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.position.set((x0 + x1) / 2, p.y ?? 0.012, (y0 + y1) / 2); S.add(m); return m;
}
// a continuous procedural flame on a camera-facing quad: domain-warped fbm noise scrolling upward, shaped into a
// teardrop that narrows and breaks up as it rises, coloured by a black-body ramp (white-hot core, orange, deep red
// tips); drawn additively with premultiplied alpha so it adds light without washing out over pale floors
const FLAME_U = { uTime: { value: 0 } };
const FLAME_FS = `uniform float uTime, uSeed, uHeat; uniform vec3 uTint; varying vec2 vUv;
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vn(p) * a; p = p * 2.02 + 7.3; a *= 0.5; } return s; }
  vec3 ramp(float h){
    vec3 c = mix(vec3(0.0), vec3(0.55, 0.05, 0.0), smoothstep(0.0, 0.25, h));
    c = mix(c, vec3(1.0, 0.32, 0.02), smoothstep(0.25, 0.5, h));
    c = mix(c, vec3(1.0, 0.68, 0.18), smoothstep(0.5, 0.75, h));
    return mix(c, vec3(1.0, 0.94, 0.75), smoothstep(0.85, 1.15, h)); }
  void main(){
    vec2 uv = vUv; float t = uTime * 1.3 + uSeed * 10.0;
    vec2 p = vec2((uv.x - 0.5) * 2.0, uv.y);
    // domain warp: slow noise pushes the body around, more strongly higher up
    vec2 q = vec2(fbm(vec2(p.x * 1.4, p.y * 1.8 - t * 1.2)), fbm(vec2(p.x * 1.4 + 5.2, p.y * 1.8 - t * 1.5)));
    vec2 wp = p + (q - 0.5) * vec2(0.9, 0.35) * uv.y;
    float n = fbm(vec2(wp.x * 3.4, wp.y * 3.0 - t * 2.8) + q * 2.0);           // the main licks
    float n2 = fbm(vec2(wp.x * 5.5, wp.y * 6.5 - t * 5.0) + 3.1);               // fine flicker
    float w = mix(0.95, 0.16, pow(uv.y, 0.65)) * (0.7 + 0.6 * n2);              // wide base, narrow crown, ragged sides
    float body = 1.0 - smoothstep(w * 0.05, w, abs(wp.x));
    float h = body * (1.05 - uv.y * 0.8);
    h -= smoothstep(0.08, 0.9, uv.y) * (1.0 - n) * 1.35;                        // tears into separate tongues as it rises
    h += (n - 0.5) * 0.35 + (n2 - 0.5) * 0.18;
    h *= smoothstep(0.0, 0.08, uv.y) * uHeat * 0.92;
    vec3 col = ramp(h) * uTint;
    float a = smoothstep(0.02, 0.45, h);   // soft edges
    float halo = exp(-dot(p - vec2(0.0, 0.22), p - vec2(0.0, 0.22)) * 5.0) * 0.16;
    gl_FragColor = vec4(col * a + vec3(1.0, 0.42, 0.1) * uTint * halo, a);
    #include <colorspace_fragment>
  }`;
function flameMesh(size, tint, seed) {
  const geo = new THREE.PlaneGeometry(0.85 * size, 1.25 * size); geo.translate(0, 0.6 * size, 0);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uTime: FLAME_U.uTime, uSeed: { value: seed }, uHeat: { value: 1 }, uTint: { value: new THREE.Color(...(tint || [1, 1, 1])) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      // cylindrical billboard: stays upright, turns to face the camera
      vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 toCam = cameraPosition - c; toCam.y = 0.0; toCam = normalize(toCam);
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
      vec3 w = c + right * position.x + vec3(0.0, position.y, 0.0);
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: FLAME_FS,
  }));
  m.renderOrder = 6; m.frustumCulled = false; return m;
}
function fire(E, p) {
  const S = E.world.scene, x = p.x, z = p.y, y = groundH(x, z) + (p.z ?? 0.9), size = (p.size ?? 1) * 0.85;
  const L = new THREE.PointLight(p.col ?? 0xff8a3a, 0, 5 * size + 2, 1.6); L.position.set(x, y + 0.4 * size, z); S.add(L);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: p.col ?? 0xff8a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
  glow.scale.setScalar(1.6 * size); glow.position.set(x, y + 0.35 * size, z + 0.02); S.add(glow);
  // two flames, slightly offset, for a fuller fire
  const f1 = flameMesh(size, p.tint, Math.random()), f2 = flameMesh(size * 0.72, p.tint, Math.random());
  f1.position.set(x, y - 0.02, z + 0.03); f2.position.set(x + 0.08 * size, y - 0.02, z + 0.05); S.add(f1, f2);
  const base = (p.light ?? 6) * size;
  let sm = 0, em = 0;
  E.world.updaters.push((dt, t) => {
    FLAME_U.uTime.value = t;
    const fl = 0.82 + 0.18 * Math.sin(t * 11 + x) * Math.sin(t * 7.3 + z); L.intensity = base * fl; glow.material.opacity = 0.32 * fl;
    f1.material.uniforms.uHeat.value = 0.92 + 0.12 * fl; f1.scale.y = 0.94 + 0.1 * fl;
    if ((em += dt) > 0.09 / size) { em = 0;   // embers: bright specks that drift up, flicker and die
      E.vfx.spark(x + rand(-0.1, 0.1) * size, y + 0.3 * size, z, { vx: rand(-0.15, 0.15), vy: rand(0.6, 1.3) * size, vz: rand(-0.1, 0.1), life: rand(0.6, 1.3), size: rand(0.015, 0.03), r: 1, gg: rand(0.45, 0.75), b: 0.12, shape: 1, flicker: 1, wob: 0.6, ph: rand(0, 9) }); }
    if (p.smoke !== false && (sm += dt) > 0.24) { sm = 0; E.vfx.smokePuff(x, y + 0.85 * size, z, { vx: rand(-0.05, 0.05), vy: rand(0.35, 0.6), life: rand(2.2, 3.2), size: 0.12 * size, size1: 0.6 * size, tint: [0.3, 0.27, 0.25] }); }
  });
}
let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow;
}
function smoke(E, p) {
  const x = p.x, z = p.y, y = groundH(x, z) + (p.z ?? 0.4); let sm = 0;
  const k = p.size ?? 1; E.world.updaters.push(dt => { if ((sm += dt) > 0.3 / Math.max(0.5, k)) { sm = 0; E.vfx.smokePuff(x + rand(-0.04, 0.04), y, z, { vx: rand(0.02, 0.08) * k, vy: rand(0.25, 0.4), life: rand(3, 4.5) * (0.6 + 0.4 * k), size: 0.08 * k, size1: 0.45 * k, tint: p.tint ?? [0.55, 0.52, 0.5] }); } });
}
function torch(E, p) {
  const S = E.world.scene, h = p.h ?? 1.3, x = p.x, z = p.y, y = groundH(x, z);
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })));
  pole.position.set(x, y + h / 2, z); S.add(pole);
  fire(E, { x, y: z, z: h, size: 0.7, light: 7, col: 0xff8a3a, smoke: true });
}
function glow(E, p) {
  const S = E.world.scene, g = new THREE.Mesh(new THREE.CircleGeometry(p.r, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex(), color: p.col ?? 0xffd890, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
  g.position.set(p.x, groundH(p.x, p.y) + 0.02, p.y); S.add(g);
  const L = new THREE.PointLight(p.col ?? 0xffd890, 0, p.r * 3, 1.5); L.position.set(p.x, 0.8, p.y); S.add(L);
  E.world.updaters.push((dt, t) => { const k = 0.75 + 0.25 * Math.sin(t * 1.4 + p.x); g.material.opacity = 0.32 * k; L.intensity = (p.i ?? 3) * k; g.rotation.y = t * 0.05; });
}

// ---------------------------------------------------------------- ambient particles around the view
function particles(E, kind) {
  let acc = 0;
  E.world.updaters.push(dt => {
    const c = E.cam.target, r = 9; acc += dt;
    if (kind === 'dust') while (acc > 0.05) { acc -= 0.05; E.vfx.smoke(c.x + rand(-r, r), rand(0.3, 3), c.z + rand(-r * 0.7, r * 0.7), { vx: rand(-0.05, 0.05), vy: rand(-0.03, 0.06), life: rand(4, 7), size: rand(0.02, 0.035), r: 1, gg: 0.85, b: 0.6, a: 0.7, shape: 1, wob: 0.5, ph: rand(0, 6), fadeIn: 1 }); }
    if (kind === 'fireflies') while (acc > 0.12) { acc -= 0.12; E.vfx.spark(c.x + rand(-r, r), rand(0.3, 1.6), c.z + rand(-r * 0.7, r * 0.7), { vx: rand(-0.2, 0.2), vy: rand(-0.05, 0.12), vz: rand(-0.2, 0.2), life: rand(2.5, 4), size: rand(0.03, 0.05), r: 0.75, gg: 1, b: 0.45, shape: 0, flicker: 1, wob: 0.8, ph: rand(0, 9) }); }
    if (kind === 'sparkles') while (acc > 0.04) { acc -= 0.04; E.vfx.spark(c.x + rand(-r, r), rand(0, 2.5), c.z + rand(-r * 0.7, r * 0.7), { vy: rand(0.1, 0.35), life: rand(2, 3.5), size: rand(0.05, 0.09), r: 1, gg: rand(0.92, 0.98), b: rand(0.78, 0.9), shape: 0, flicker: 1, wob: 0.5, ph: rand(0, 9) }); }   // soft glints (not the pixel squares)
    if (kind === 'leaves') while (acc > 0.18) { acc -= 0.18; E.vfx.smoke(c.x + rand(-r, r), rand(2, 3.5), c.z + rand(-r * 0.7, r * 0.7), { vx: rand(0.15, 0.4), vy: -rand(0.25, 0.45), life: rand(5, 7), size: rand(0.05, 0.08), r: rand(0.6, 0.85), gg: rand(0.55, 0.75), b: 0.25, a: 1, shape: 1, wob: 1.2, ph: rand(0, 6) }); }
  });
}

export const FX = { fire, smoke, glow, torch, water, flameMesh, glowTex };
// add a set's pieces and effects to the built world (call after E.loadWorld with { look: { set } })
export async function dress(E, def) {
  await def.build(E, FX);
  if (def.particles) particles(E, def.particles);
  for (const l of def.lights || []) { const L = new THREE.PointLight(l.col, l.i, l.d ?? 8, 1.6); L.position.set(l.x, l.y ?? 2, l.z); E.world.scene.add(L); }
  E.world.updaters.push((dt, t) => { WATER.uTime.value = t; });
}
