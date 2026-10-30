// Shared pieces of the spell set-pieces (src/spells.js, src/spellbook.js): staging (intro / outro, the caster's
// gathering light, darkening), models (swords, arrows, a talisman, leaves, petals) and shapes (swirls, flame rings).
import * as THREE from 'three';
import { rand, effectH } from './world.js';
import { NOISE } from './vfx.js';
import { castOf } from './casts.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------------------------------------------------------------- shared pieces
export function basis(ctx) {   // camera right / toward-camera on the ground plane, so effects can be staged on screen
  const c = ctx.cam.camera.position, f = V(c.x - ctx.at.x, 0, c.z - ctx.at.z).normalize();
  return { right: V(f.z, 0, -f.x), toCam: f };
}
// soft elongated glow for blades (a gradient, so no visible quad edges)
export const BLADE_GLOW = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.translate(32, 128); g.scale(1, 4); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
export function swordMesh(col, scale) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xcfe6f2, metalness: 0.85, roughness: 0.2, emissive: new THREE.Color(...col), emissiveIntensity: 0.55, flatShading: true }));
  blade.scale.set(0.055, 0.62, 0.016); blade.position.y = 0.62;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.8, roughness: 0.3, emissive: 0x5a3a08, emissiveIntensity: 1 }));
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x5a1a10, roughness: 0.6 }));
  hilt.position.y = -0.11;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.7), new THREE.MeshBasicMaterial({ map: BLADE_GLOW, color: new THREE.Color(...col), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  glow.position.y = 0.62; const glow2 = glow.clone(); glow2.rotation.y = Math.PI / 2;
  g.add(blade, guard, hilt, glow, glow2); g.scale.setScalar(scale || 1);
  return g;
}
export function pointAlong(obj, dir) { const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); obj.quaternion.copy(q); }
export function bezier(a, b, c, t) { return a.clone().multiplyScalar((1 - t) * (1 - t)).add(b.clone().multiplyScalar(2 * (1 - t) * t)).add(c.clone().multiplyScalar(t * t)); }
export function trail(vfx, p, col, n, size) { for (let i = 0; i < (n || 2); i++) vfx.spark(p.x + rand(-0.04, 0.04), p.y + rand(-0.04, 0.04), p.z + rand(-0.04, 0.04), { life: rand(0.25, 0.5), size: size || 0.12, size1: 0.01, r: col[0], gg: col[1], b: col[2], shape: 0 }); }
export function gather(ctx, col, dur) {
  const c = ctx.caster.chest(), v = ctx.vfx;
  v.light(c.clone().add(V(0, 0.8, 0)), col, 3.5, dur / 1000 + 0.3, 4);
  const n = Math.round(dur / 18);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(1.1, 1.8), p = V(c.x + Math.cos(a) * r, c.y + rand(-0.4, 0.9), c.z + Math.sin(a) * r);
    ctx.wait(i * 18).then(() => v.spark(p.x, p.y, p.z, { seek: { x: c.x, y: c.y, z: c.z, k: 4.5 }, life: 0.55, size: rand(0.06, 0.11), r: col[0], gg: col[1], b: col[2], shape: Math.random() < 0.5 ? 1 : 0 }));   // (the game clock)
  }
  for (let i = 0; i < 16; i++) v.spark(ctx.caster.pos.x + rand(-0.5, 0.5), ctx.caster.pos.y + 0.05, ctx.caster.pos.z + rand(-0.5, 0.5), { vy: rand(1, 2.2), life: rand(0.6, 1.1), size: 0.06, r: col[0], gg: col[1], b: col[2], shape: 1 });
}
export async function intro(ctx, col, o) {
  o = o || {};
  ctx.vfx.screen.barsTarget = 1;
  const own = castOf(ctx.caster.u);   // the caster's own way of casting (src/casts.js), else the shared gathering
  ctx.cam.shot(ctx.caster.pos, { dist: 7.5, pitch: 0.42, yaw: 0.35, speed: own ? 6 : 0 });
  if (own) { const a = ctx.caster, keep = { facing: a.u.facing, hover: a.hover, lift: a.lift }; a.u.facing = 'down'; await ctx.wait(180); await own(a, a.pos.clone(), col, ctx); a.u.facing = keep.facing; a.hover = keep.hover; a.lift = keep.lift; }
  else { ctx.pose('cast'); gather(ctx, col, o.dur || 900); await ctx.wait(o.dur || 900); }
  ctx.pose('cast');
  if (!o.keep) ctx.cam.shot(ctx.at, { dist: o.dist || 9, pitch: o.pitch || 0.5, yaw: o.yaw == null ? -0.25 : o.yaw });   // (keep: the spell has already moved the camera on, mid-cast)
}
export function outro(ctx) { ctx.vfx.screen.barsTarget = 0; ctx.vfx.screen.darkTarget = 0; ctx.pose(null); }
// darkCol is the light taken away (world.js grade: col *= 1 - dark * darkCol): (0.9, 0.75, 0.45) leaves a night-blue
export const DARK = (ctx, a, r, g, b) => { ctx.vfx.screen.darkTarget = a; ctx.vfx.screen.darkCol.setRGB(r, g, b); };

// hold the cast to s seconds after it began (an original's beat later than the caster's own cast ends): light drawn into
// the caster meanwhile, never a still gap
export function channel(ctx, col, s) {
  const g = s - ctx.now();
  if (g > 0.15) {
    const c = ctx.caster.chest(), v = ctx.vfx; ctx.pose('cast'); v.light(c.clone().add(V(0, 0.5, 0)), col, 3, g, 4);
    ticker(v, g, () => { if (Math.random() < 0.6) { const a = rand(0, 6.28), r = rand(0.8, 1.5), p = V(c.x + Math.cos(a) * r, c.y + rand(-0.3, 0.9), c.z + Math.sin(a) * r); v.spark(p.x, p.y, p.z, { seek: { x: c.x, y: c.y, z: c.z, k: 4.5 }, life: 0.5, size: rand(0.05, 0.09), r: col[0], gg: col[1], b: col[2], shape: 1 }); } });
  }
  return ctx.until(s);
}
// the spell's sounds from s seconds after the cast began (the original's first sound, tools/rom/spelltime.py), whatever
// the script is doing then: a spell whose first sound is its casting, not its blow
export const cueAt = (ctx, s) => { ctx.until(s).then(() => ctx.cue && ctx.cue()); };
// a cinematic shot at s seconds into the cast (its own clock): the camera swings round the action between a spell's beats
// so it reads in 3D [the user's call, 2026-10-30: the last spells' cameras, after 楊戩's summons]; p a point or a function of
// one (taken when the shot starts)
export const shotAt = (ctx, s, p, o) => ctx.until(s).then(() => ctx.cam.shot(typeof p === 'function' ? p() : p, Object.assign({ cine: true }, o)));
// the shot's yaw (from the player's own) that puts the camera on from's side of to, looking across it, at most lim round
export function yawToward(ctx, from, to, lim = 0.9) { let d = Math.atan2(from.x - to.x, from.z - to.z) - ctx.cam.user.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.max(-lim, Math.min(lim, d)); }
export const ticker = (v, life, fn, onEnd) => v.timed(new THREE.Object3D(), life, fn, onEnd);   // per-frame callback for a while
export const facing = (a, b) => b.clone().sub(a).setY(0).normalize();
export const yawOf = d => Math.atan2(d.x, d.z);
// shader for swirling energy surfaces (tornado, water column): streaks scrolling around and up an open cylinder
export function swirlMat(col, o) {
  o = o || {};
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(...col) }, uFoam: { value: new THREE.Color(...(o.foam || [1, 1, 1])) }, uSp: { value: o.speed || 4 }, uTw: { value: o.twist || 4 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uA, uSp, uTw; uniform vec3 uCol, uFoam; varying vec2 vUv; varying vec3 vN, vV;
      ${NOISE}
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float s = fbm(vec2(vUv.x * 7.0 + vUv.y * uTw - uT * uSp, vUv.y * 2.5 - uT * 1.3));
        float st = smoothstep(0.42, 0.78, s), foam = smoothstep(0.7, 0.9, s);
        float fade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
        vec3 c = uCol * (0.35 + st * 1.4) + uFoam * foam * 1.2;
        gl_FragColor = vec4(c, (0.12 + st * 0.7 + f * 0.25) * fade * uA); }`,
  });
}
export function swirl(v, p, col, r0, r1, h, life, o) {
  o = o || {};
  const g = new THREE.Group();
  const layers = [[1, 1], [0.72, -1.4]].map(([k, sp]) => {
    const geo = new THREE.CylinderGeometry(r1 * k, r0 * k, h, 40, 10, true); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, swirlMat(col, Object.assign({}, o, { speed: (o.speed || 4) * sp }))); m.renderOrder = 6; g.add(m); return m;
  });
  g.position.copy(p);
  v.timed(g, life, (k, dt, t) => {
    const a = Math.min(1, t / 0.25) * Math.min(1, (life - t) / 0.4) * (o.intensity || 1);
    for (const m of layers) { m.material.uniforms.uT.value = t; m.material.uniforms.uA.value = a; }
    const sc = 0.4 + 0.6 * Math.min(1, t / 0.3); g.scale.set(sc, 0.6 + 0.4 * Math.min(1, t / 0.25), sc);
    if (o.sway) { g.rotation.z = Math.sin(t * 3.1) * 0.06; g.rotation.x = Math.cos(t * 2.3) * 0.05; }
  });
  return g;
}
export function arrowMesh(col, scale) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8), new THREE.MeshStandardMaterial({ color: 0x6a3a18, roughness: 0.7 }));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 4), new THREE.MeshStandardMaterial({ color: 0xe8f0ff, metalness: 0.9, roughness: 0.2, emissive: new THREE.Color(...col), emissiveIntensity: 2.4 }));
  head.position.y = 0.84;
  g.add(shaft, head);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.36), new THREE.MeshStandardMaterial({ color: i ? 0xf4ecd8 : 0xc0301c, side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color(...col), emissiveIntensity: 0.25 }));
    f.position.set(0, -0.5, 0); f.rotation.y = i * Math.PI * 2 / 3; f.translateX(0.07); g.add(f);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const glow2 = glow.clone(); glow2.rotation.y = Math.PI / 2; g.add(glow, glow2); g.userData.glow = [glow, glow2]; g.userData.head = head;
  g.scale.setScalar(scale || 1); return g;
}
// a ring of flame tongues licking up around p
export function flameRing(v, p, r, n, size, o) {
  o = o || {};
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), rr = r * Math.sqrt(rand(o.inner || 0.75, 1)), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
    v.realFire(x, effectH(x, z) - 0.08, z, { size: size * rand(1.1, 1.6), asp: rand(1.3, 1.7), life: rand(0.55, 0.9), vy: rand(0.05, 0.3), tint: o.tint });   // (real fire, not tongues: the user's call)
  }
}


export function leafTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(16, 2); g.quadraticCurveTo(31, 30, 16, 62); g.quadraticCurveTo(1, 30, 16, 2); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.fillRect(15, 10, 2, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const LEAF = leafTex();

export function talismanTex(glyph) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f2d88a'; g.fillRect(6, 4, 84, 248); g.strokeStyle = '#a0201a'; g.lineWidth = 5; g.strokeRect(14, 12, 68, 232);
  g.fillStyle = '#a0201a'; g.font = 'bold 54px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...glyph].forEach((ch, i) => g.fillText(ch, 48, 60 + i * 66));
  g.beginPath(); g.arc(48, 222, 12, 0, 6.28); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function petalGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 6, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), vv = p.getY(i) + 0.5, w = Math.pow(Math.sin(Math.PI * Math.min(vv, 0.97)), 0.7) * (1 - vv * 0.25);
    p.setXYZ(i, u * 0.5 * w, vv * 0.8, -(u * u) * 0.5 * w + vv * vv * 0.18);
  }
  g.computeVertexNormals(); return g;
}
