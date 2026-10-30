// Level-up poses: every hero gets their own, built from their ROM frames (attack / guard / cast poses, turning through
// the four facings, and a few poses made for the remake from those frames) plus effects drawn from their story.
// These poses are new to the remake. battle.js levelUpAnim plays them: LEVEL_POSE[sprite](actor, feet position).
import * as THREE from 'three';
import { effectH, rand } from './world.js';
import { tex } from './actors.js';
import { arrowMesh } from './spells.js';
import { swirl } from './spellkit.js';
import { upscale } from '../extract/hd.js';
import { world, vfx, cam, ui, anim, wait, V } from './battle.js';

const LV = {
  atk: (a, f) => { a.act = { kind: 'atk', frame: f }; },
  cast: (a, f) => { a.act = { kind: 'pose', row: 2, base: 6, fixed: f }; },
  guard: a => { a.act = { kind: 'pose', row: 2, base: 3 }; },
  spin: (a, t, rate) => { a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * rate) % 4]; },
};

// ---------------------------------------------------------------- shared pieces
const later = (fn, ms) => { wait(ms).then(fn); };   // setTimeout on game time: keeps to the fast-forward and to tools/qa/video.js's stepped frames
export const axes = () => { const q = world.camera.quaternion; return { right: V(1, 0, 0).applyQuaternion(q).setY(0).normalize(), toCam: V(0, 0, 1).applyQuaternion(q).setY(0).normalize() }; };
const drop = m => { for (const it of vfx.items) if (it.mesh === m) it.life = 0; };
export const canvasTex = (w, h, draw, frames) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (frames) t.repeat.set(1 / frames, 1); return t; };
export const once = (key, make) => once.c[key] || (once.c[key] = make()); once.c = {};
// a flat picture in the world (a spirit beast, a banner): turned to the camera by face() each frame
export function card(map, w, h, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, color: new THREE.Color(...(o.col || [1, 1, 1])) }));
  m.renderOrder = o.order || 6; vfx.timed(m, 1e9, () => {}); return m;
}
export const face = (m, flip = 1, rz = 0) => { m.quaternion.copy(world.camera.quaternion); if (rz) m.rotateZ(rz); m.scale.x = Math.abs(m.scale.x) * flip; };
// tapered segments joined with round joints (limbs, necks, tails of the drawn beasts)
export function limb(g, pts, ws, col) {
  g.fillStyle = col;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.fill();
    g.beginPath(); g.arc(x1, y1, w1, 0, 6.28); g.fill();
    if (i === 0) { g.beginPath(); g.arc(x0, y0, w0, 0, 6.28); g.fill(); }
  }
}
// frames drawn flat one by one, then laid on a strip with one soft glow round each outline
export function glowStrip(fw, fh, n, glow, draw) {
  return canvasTex(fw * n, fh, g => {
    const one = document.createElement('canvas'); one.width = fw; one.height = fh; const o = one.getContext('2d');
    g.shadowColor = glow; g.shadowBlur = 10;
    for (let i = 0; i < n; i++) { o.clearRect(0, 0, fw, fh); draw(o, i); g.drawImage(one, i * fw, 0); }
  }, n);
}

// 天女散花 for 燕蓉's level-up: the arrow bursts into a ring of coloured stars, then blossoms and petals of many colours
// spin and flutter down round her (petal meshes, not square particles: the user's call)
const FLOWER_COLS = [[1, 0.45, 0.7], [1, 0.18, 0.35], [1, 0.8, 0.2], [1, 0.95, 0.85], [0.7, 0.4, 1], [0.35, 0.7, 1], [1, 0.9, 0.55]];
let PETAL_TEX = null, BLOSSOM_TEX = null;
export function petalTex() {   // a cherry petal: notched tip, white heart blushing to the edge (tinted by the material)
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(32, 92); g.bezierCurveTo(4, 70, 2, 26, 20, 8); g.lineTo(32, 18); g.lineTo(44, 8); g.bezierCurveTo(62, 26, 60, 70, 32, 92); g.closePath(); };
  const gr = g.createRadialGradient(32, 80, 2, 32, 50, 48); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#f4f4f4'); gr.addColorStop(1, '#b8b8b8');
  g.fillStyle = gr; path(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(32, 86); g.quadraticCurveTo(32 + dx * 0.6, 50, 32 + dx, 22); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function blossomTex() {   // a five-petalled blossom with a gold heart
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 5; i++) {
    g.save(); g.rotate(i / 5 * Math.PI * 2);
    const gr = g.createLinearGradient(0, 0, 0, -60); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c8c8c8'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(-30, -20, -26, -58, -8, -60); g.lineTo(0, -52); g.lineTo(8, -60); g.bezierCurveTo(26, -58, 30, -20, 0, -4); g.fill(); g.restore();
  }
  const h = g.createRadialGradient(0, 0, 1, 0, 0, 16); h.addColorStop(0, '#fff6b0'); h.addColorStop(0.6, '#ffc030'); h.addColorStop(1, 'rgba(255,170,40,0)');
  g.fillStyle = h; g.beginPath(); g.arc(0, 0, 16, 0, 6.28); g.fill();
  g.fillStyle = '#ffe070'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.beginPath(); g.arc(Math.cos(a) * 9, Math.sin(a) * 9, 2, 0, 6.28); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flowerRain(q, P) {
  PETAL_TEX = PETAL_TEX || petalTex(); BLOSSOM_TEX = BLOSSOM_TEX || blossomTex();
  const pick = () => FLOWER_COLS[(Math.random() * FLOWER_COLS.length) | 0];
  vfx.flash([1, 0.85, 0.9], 0.25); vfx.light(q, [1, 0.8, 0.85], 16, 1.2, 9);
  // the shell: a ring of round stars in every colour, each trailing a sparkle as it falls
  for (let i = 0; i < 90; i++) {
    const c = pick(), a = rand(0, 6.28), e = rand(-0.9, 0.9), sp = rand(2.6, 3.8);
    vfx.spark(q.x, q.y, q.z, { vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 0.4, vz: Math.sin(a) * Math.cos(e) * sp, g: 1.2, drag: 1.6, life: rand(1.2, 1.8), size: rand(0.12, 0.18), r: c[0], gg: c[1], b: c[2], shape: 0, flicker: 1, ph: rand(0, 9) });
  }
  vfx.burst(q, { n: 30, speed: 1.2, cols: [[1, 1, 1], [1, 0.9, 0.95]], size: 0.05, life: 0.6, g: 0, shape: 0 });
  // the flowers: petals and blossoms open out from the burst and flutter down round her, spinning as they fall
  for (let i = 0; i < 72; i++) {
    const bloom = i % 3 === 0, c = pick(), sz = bloom ? rand(0.2, 0.28) : rand(0.12, 0.17);   // (40% smaller than first made: the user's call)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bloom ? sz : sz * 0.67, sz), new THREE.MeshBasicMaterial({ map: bloom ? BLOSSOM_TEX : PETAL_TEX, color: new THREE.Color(...c), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.renderOrder = 6;
    const a = rand(0, 6.28), r1 = rand(0.6, 1.9), fall = rand(2.4, 3.6), slow = rand(2.6, 3.4), life = rand(1.7, 2.3), d = rand(0, 0.25),   // slow: the drift down as before; life: how soon it has faded [the user's call: fade faster, not fall faster]
      spin = V(rand(-4, 4), rand(-3, 3), rand(-4, 4)), ph = rand(0, 6.28);
    const end = Math.max(P.y + 0.05, effectH(q.x + Math.cos(a) * r1, q.z + Math.sin(a) * r1) + 0.05);
    vfx.timed(m, life + d, (k, dt, t) => {
      const f = Math.max(0, t - d), out = 1 - Math.exp(-f * 4), drop = Math.min(q.y - end, Math.max(0, f - 0.2) * fall / slow * (q.y - end + 0.4));
      const sway = Math.sin(f * 2.6 + ph) * 0.25;
      m.position.set(q.x + Math.cos(a) * r1 * out + Math.cos(a + 1.57) * sway, q.y + out * 0.35 - drop, q.z + Math.sin(a) * r1 * out + Math.sin(a + 1.57) * sway);
      m.rotation.set(spin.x * f, spin.y * f + ph, spin.z * f * (bloom ? 0.3 : 1));
      m.material.opacity = Math.min(1, f * 6) * Math.max(0, 1 - Math.max(0, f - 0.45) / (life - 0.45)) ** 1.5;   // fading from the moment they start to drop, gone before they land [the user's call]
      if (Math.random() < dt * 4) vfx.spark(m.position.x, m.position.y, m.position.z, { vy: -0.2, life: 0.6, size: 0.06, r: c[0], gg: c[1], b: c[2], shape: 0 });
    });
  }
}
// 哪吒's level-up pieces: lotus petals, the wind-fire wheels, the red sash (cloth, not light), the golden ring
let LOTUS_TEX = null;
export function lotusTex() {   // a lotus petal: broad, pointed, white at the base flushing to deep pink at the tip
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(32, 126); g.bezierCurveTo(2, 108, 0, 44, 32, 2); g.bezierCurveTo(64, 44, 62, 108, 32, 126); g.closePath(); };
  const gr = g.createLinearGradient(0, 126, 0, 2); gr.addColorStop(0, '#fff8f4'); gr.addColorStop(0.45, '#ffd2df'); gr.addColorStop(0.8, '#ff86ad'); gr.addColorStop(1, '#f2477e');
  g.fillStyle = gr; path(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; for (const dx of [-12, -6, 0, 6, 12]) { g.beginPath(); g.moveTo(32, 120); g.quadraticCurveTo(32 + dx * 0.9, 64, 32 + dx * 0.35, 14); g.stroke(); }
  g.strokeStyle = 'rgba(200,40,90,0.5)'; g.lineWidth = 2; path(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function lotusBloom(P) {   // two rings of petals round his feet, closed as a bud; open(k) unfolds them, scatter() flings them off
  LOTUS_TEX = LOTUS_TEX || lotusTex();
  const root = new THREE.Group(), petals = [];
  root.position.set(P.x, P.y + 0.03, P.z);
  for (const [n, len, r0, shut, wide, off] of [[10, 0.5, 0.14, 0.12, 1.2, 0], [8, 0.38, 0.08, 0.05, 0.75, 0.5]]) {
    const geo = new THREE.PlaneGeometry(len * 0.5, len); geo.translate(0, len / 2, 0);
    for (let i = 0; i < n; i++) {
      const yaw = new THREE.Group(), tilt = new THREE.Group(), m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: LOTUS_TEX, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false }));
      yaw.rotation.y = (i + off) / n * Math.PI * 2; tilt.position.z = r0; tilt.add(m); yaw.add(tilt); root.add(yaw);
      petals.push({ yaw, tilt, m, shut, wide, vel: null });
    }
  }
  vfx.timed(root, 1e9, () => {});
  const bloom = {
    open(k) { for (const p of petals) p.tilt.rotation.x = p.shut + (p.wide - p.shut) * k; },
    scatter() {   // each petal tears loose outward and drifts away, turning and fading
      for (const p of petals) {
        const w = new THREE.Vector3(); p.m.getWorldPosition(w); const q = new THREE.Quaternion(); p.m.getWorldQuaternion(q);
        p.yaw.remove(p.tilt); p.tilt.remove(p.m); vfx.scene.add(p.m); p.m.position.copy(w); p.m.quaternion.copy(q);
        const ang = p.yaw.rotation.y, sp = rand(1.2, 2.2), v = V(Math.sin(ang) * sp, rand(1.2, 2.2), Math.cos(ang) * sp), spin = V(rand(-6, 6), rand(-4, 4), rand(-6, 6)), life = rand(0.8, 1.1);
        p.m.material.alphaTest = 0; p.m.material.depthWrite = false;
        vfx.timed(p.m, life, (k, dt) => {
          v.y -= dt * 2.2; v.multiplyScalar(1 - dt * 1.5); p.m.position.addScaledVector(v, dt);
          p.m.rotation.x += spin.x * dt; p.m.rotation.y += spin.y * dt; p.m.rotation.z += spin.z * dt;
          p.m.material.opacity = (1 - k) ** 1.3;
        });
      }
      const it = vfx.items.find(i => i.mesh === root); if (it) it.life = 0;
    },
  };
  bloom.open(0); bloom.root = root; return bloom;
}
export function fireWheel() {   // a 風火輪: a red-gold rim on six spokes, spun about its axle; flames are added along the rim each frame
  const g = new THREE.Group(), spin = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.3, 0.05), transparent: true, toneMapped: false });
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 28), mat));
  const hub = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.35), transparent: true, toneMapped: false });
  for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.02, 0.012), hub); sp.rotation.z = i / 3 * Math.PI; spin.add(sp); }
  g.add(spin); g.spin = spin; g.mats = [mat, hub]; g.renderOrder = 6; return g;
}
export function clothStrip(o) {   // a camera-facing strip of cloth drawn through the last n points (vfx.ribbon is additive light; this is a solid sash)
  const N = o.n, pts = [], pos = new Float32Array(N * 6), uv = new Float32Array(N * 4), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < N - 1; i++) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); } g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(...o.col) }, uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv;
      void main(){ vec2 uv = clamp(vUv, 0.0, 1.0); float across = 1.0 - abs(uv.y * 2.0 - 1.0);
        float fold = 0.5 + 0.5 * sin(uv.x * 34.0 + uv.y * 3.0);   // soft folds along the silk
        vec3 c = uCol * (0.55 + 0.5 * across) * (0.82 + 0.25 * fold) + vec3(0.25, 0.08, 0.04) * pow(across, 6.0);
        gl_FragColor = vec4(c, smoothstep(0.0, 0.25, across) * (1.0 - smoothstep(0.7, 1.0, uv.x)) * uA); }` });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  const tmp = V(0, 0, 0), side = V(0, 0, 0), view = V(0, 0, 0);
  vfx.timed(mesh, 1e9, () => {
    const n = pts.length, cp = world.camera.position;
    if (n < 2) { g.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      tmp.subVectors(pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)]); view.subVectors(cp, pts[i]); side.crossVectors(tmp, view).normalize();
      const w = o.width * (1 - i / (N - 1) * 0.6), p = pts[i];
      pos.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], i * 6); uv.set([i / (N - 1), 0, i / (N - 1), 1], i * 4);
    }
    g.setDrawRange(0, (n - 1) * 6); g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  });
  return {
    push(p) { pts.unshift(p.clone()); if (pts.length > N) pts.pop(); },
    fade(sec) { return anim(sec, k => { mat.uniforms.uA.value = 1 - k; if (pts.length > 2 && Math.random() < 0.5) pts.pop(); }).then(() => { const it = vfx.items.find(i => i.mesh === mesh); if (it) it.life = 0; }); },
  };
}
// 楊戩's level-up pieces: the third eye (pinned to the eye mark in his own frames), 哮天犬 drawn as a glowing silver hound
// (a four-beat gallop and a sitting frame)
let EYE_TEX = null, HOUND_TEX = null;
const YANG_MARK = { guard: [65, 33.5] };   // the third eye's centre in his 128 px guard frame (act row 2, frame 3)
export function eyeTex() {   // a vertical eye: gold-white lids round a red-gold iris and a dark slit
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const lids = () => { g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(62, 64, 32, 124); g.quadraticCurveTo(2, 64, 32, 4); g.closePath(); };
  g.shadowColor = '#ffd36a'; g.shadowBlur = 10; g.fillStyle = '#fff3c4'; lids(); g.fill(); g.shadowBlur = 0;
  const ir = g.createRadialGradient(32, 64, 2, 32, 64, 20); ir.addColorStop(0, '#fff8d0'); ir.addColorStop(0.35, '#ffb020'); ir.addColorStop(1, '#c0341a');
  g.fillStyle = ir; g.beginPath(); g.ellipse(32, 64, 15, 22, 0, 0, 6.28); g.fill();
  g.fillStyle = '#2a0c08'; g.beginPath(); g.ellipse(32, 64, 3, 13, 0, 0, 6.28); g.fill();
  g.strokeStyle = '#ffcf50'; g.lineWidth = 3; lids(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 哮天犬, a slender white sighthound, side on and facing right in a 256x128 cell (paws on y 120). Each frame is its joints:
// S shoulder, P hip, arch of the back; front legs elbow-wrist-paw and hind legs stifle-hock-paw (near / far); head, muzzle
// tip, tail (two points). Four beats of the rotary gallop (after Muybridge's greyhound) and a sit.
const HOUND_POSES = [
  { S: [160, 62], P: [80, 64], arch: 0, fn: [[176, 78], [200, 88], [222, 90]], ff: [[172, 80], [194, 94], [214, 99]],   // stretched out in flight
    hn: [[70, 82], [44, 92], [20, 96]], hf: [[74, 84], [50, 96], [28, 102]], head: [196, 40], nose: [226, 46], tail: [[30, 58], [4, 48]], mouth: 1 },
  { S: [158, 64], P: [82, 62], arch: 4, fn: [[160, 86], [156, 104], [161, 120]], ff: [[152, 84], [138, 96], [130, 106]],   // front foot strikes
    hn: [[94, 82], [78, 98], [88, 110]], hf: [[88, 82], [66, 94], [66, 108]], head: [194, 48], nose: [222, 58], tail: [[30, 66], [6, 58]] },
  { S: [150, 62], P: [96, 60], arch: 14, fn: [[146, 84], [128, 94], [118, 104]], ff: [[152, 84], [138, 100], [126, 108]],  // gathered, back arched
    hn: [[116, 80], [128, 98], [148, 108]], hf: [[110, 80], [120, 98], [138, 110]], head: [184, 44], nose: [212, 50], tail: [[58, 46], [30, 52]] },
  { S: [160, 58], P: [86, 64], arch: 6, fn: [[178, 72], [198, 86], [214, 98]], ff: [[172, 76], [188, 92], [198, 106]],     // hind feet drive off
    hn: [[92, 84], [80, 100], [85, 120]], hf: [[84, 84], [66, 100], [56, 114]], head: [196, 38], nose: [226, 40], tail: [[34, 56], [8, 44]], mouth: 1 },
  { S: [150, 68], P: [100, 100], arch: 0, fn: [[154, 88], [156, 105], [162, 120]], ff: [[148, 88], [148, 105], [153, 120]],  // sitting up
    hn: [[124, 102], [104, 117], [130, 120]], hf: [[120, 104], [100, 118], [124, 121]], head: [168, 32], nose: [196, 38], tail: [[60, 116], [40, 110]], sit: 1 },
];
function drawHound(g, F, pal = HOUND_SILVER) {
  const limb = (pts, ws, col) => {   // tapered segments joined with round joints
    g.fillStyle = col;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
      g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.fill();
      g.beginPath(); g.arc(x1, y1, w1, 0, 6.28); g.fill();
    }
  };
  const paw = ([x, y], col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x + 3, y - 2, 6, 3.5, 0, 0, 6.28); g.fill(); };
  const body = g.createLinearGradient(0, 30, 0, 120); body.addColorStop(0, pal.top); body.addColorStop(1, pal.under);
  const far = pal.far, [S, P] = [F.S, F.P], T0 = [P[0] - 14, P[1] - 4];
  // far legs, behind the body
  limb([[F.S[0] - 2, F.S[1] + 10], ...F.ff], [12, 8, 5, 4], far); paw(F.ff[2], far);
  limb([P, ...F.hf], [16, 10, 6, 4], far); paw(F.hf[2], far);
  g.fillStyle = body;
  // spirit wisps streaming back off the back and tail (not when sitting)
  if (!F.sit) { g.strokeStyle = pal.wisp; g.lineCap = 'round'; for (const [y, w] of [[-6, 4], [4, 3]]) { g.lineWidth = w; g.beginPath(); g.moveTo(S[0] - 20, S[1] - 6 + y); g.bezierCurveTo(S[0] - 70, S[1] - 20 + y, P[0] - 50, P[1] + 4 + y, P[0] - 90, P[1] - 14 + y); g.stroke(); } }
  // tail
  limb([T0, ...F.tail], [7, 4, 2], body);
  // body: rump, the back's curve up to the withers, a deep chest, the waist tucked up under the loin
  const mx = (S[0] + P[0]) / 2, my = (S[1] + P[1]) / 2;
  g.beginPath(); g.moveTo(...T0);
  g.quadraticCurveTo(mx, my - 14 - F.arch, S[0] + 4, S[1] - 9);
  g.quadraticCurveTo(S[0] + 20, S[1] - 2, S[0] + 14, S[1] + 14);
  g.quadraticCurveTo(S[0] + 8, S[1] + 30, S[0] - 10, S[1] + 26);
  g.quadraticCurveTo(mx, my + 6, P[0] + 12, P[1] + 12);
  g.quadraticCurveTo(P[0] - 6, P[1] + 22, P[0] - 18, P[1] + 6);
  g.closePath(); g.fill();
  g.beginPath(); g.ellipse(P[0] - 2, P[1] + 4, 17, 14, Math.atan2(F.hn[0][1] - P[1], F.hn[0][0] - P[0]) - 1.2, 0, 6.28); g.fill();   // the haunch
  // neck and head: a long narrow head, the ear laid back at the run and pricked when sitting
  const H = F.head, N = F.nose, ha = Math.atan2(N[1] - H[1], N[0] - H[0]);
  limb([[S[0] + 4, S[1]], [H[0] - 4, H[1] + 4]], [24, 13], body);
  g.beginPath(); g.ellipse(H[0], H[1], 13, 9.5, ha, 0, 6.28); g.fill();
  limb([[H[0] + 6, H[1] - 1], N], [13, 5], body);
  if (F.mouth) { g.strokeStyle = '#7c8fb8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(H[0] + 8, H[1] + 5); g.lineTo(N[0] - 6, N[1] + 3); g.stroke(); }
  g.fillStyle = body; g.beginPath();
  if (F.sit) { g.moveTo(H[0] - 8, H[1] - 6); g.lineTo(H[0] - 6, H[1] - 24); g.lineTo(H[0] + 3, H[1] - 8); }
  else { g.moveTo(H[0] - 4, H[1] - 8); g.lineTo(H[0] - 22, H[1] - 12); g.lineTo(H[0] - 6, H[1] - 2); }
  g.fill();
  g.fillStyle = '#26324a'; g.beginPath(); g.arc(H[0] + 5 * Math.cos(ha) - 2 * Math.sin(ha), H[1] + 5 * Math.sin(ha) - 3, 2.2, 0, 6.28); g.fill();
  g.beginPath(); g.arc(N[0] - 1, N[1], 2, 0, 6.28); g.fill();   // nose
  // near legs, over the body
  limb([[S[0] - 2, S[1] + 10], ...F.fn], [14, 9, 6, 5], body); paw(F.fn[2], body);
  limb([[P[0], P[1] + 2], ...F.hn], [18, 11, 7, 5], body); paw(F.hn[2], body);
}
// the hound's colours: the level-up's silver spirit, and the 哮天犬 spell's as the original paints it (fx 52: a blue-white
// body shaded deep blue, the outline flickering gold)
const HOUND_SILVER = { top: '#ffffff', under: '#c4d2ee', far: '#97a9cf', wisp: 'rgba(190,215,255,0.55)' };
const HOUND_SPELL = { top: '#a8d4ff', under: '#2458c0', far: '#173c88', wisp: 'rgba(255,226,90,0.55)' };
// the spell's hound: the four gallop poses (HOUND_POSES 0-3) in the original's colours, a gold rim round each
export function houndRunTex() {
  const n = 4, c = document.createElement('canvas'); c.width = 256 * n; c.height = 128; const g = c.getContext('2d');
  const one = document.createElement('canvas'); one.width = 256; one.height = 128; const o = one.getContext('2d');
  g.shadowColor = 'rgba(255,214,60,0.95)'; g.shadowBlur = 5;
  for (let i = 0; i < n; i++) { o.clearRect(0, 0, 256, 128); drawHound(o, HOUND_POSES[i], HOUND_SPELL); g.drawImage(one, i * 256, 0); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / n, 1); return t;
}
export function houndTex() {   // each frame drawn flat, then laid on the strip with one soft blue glow round its outline
  const n = HOUND_POSES.length, c = document.createElement('canvas'); c.width = 256 * n; c.height = 128; const g = c.getContext('2d');
  const one = document.createElement('canvas'); one.width = 256; one.height = 128; const o = one.getContext('2d');
  g.shadowColor = 'rgba(140,190,255,0.95)'; g.shadowBlur = 9;
  HOUND_POSES.forEach((p, i) => { o.clearRect(0, 0, 256, 128); drawHound(o, p); g.drawImage(one, i * 256, 0); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / n, 1); return t;
}
async function yangLevel(a, P) {
  const camQ = world.camera.quaternion, right = V(1, 0, 0).applyQuaternion(camQ).setY(0).normalize(), toCam = V(0, 0, 1).applyQuaternion(camQ).setY(0).normalize();
  const mist = (n, r, up) => { for (let i = 0; i < n; i++) { const t = rand(0, 6.28), rr = rand(0.2, r); vfx.smokePuff(P.x + Math.cos(t) * rr, P.y + 0.08, P.z + Math.sin(t) * rr, { vx: -Math.sin(t) * 0.6, vz: Math.cos(t) * 0.6, vy: rand(0.05, up), drag: 1.5, life: rand(1, 1.5), size: rand(0.25, 0.35), size1: rand(0.6, 0.85), tint: [0.78, 0.84, 0.95] }); } };
  // a point on his sprite, from its pixels: [x, y] in the 128 px body frame (both sprite planes put the body at 0..1 tall)
  const onSprite = (px, py, z = 0.02) => { const m = a.big.visible ? a.big : a.mesh; m.updateMatrixWorld(); return m.localToWorld(V(px / 128 - 0.5, 1 - py / 128, z)); };
  const mark = YANG_MARK.guard;
  a.u.facing = 'down'; LV.guard(a);
  // 1. silver mist gathers at his feet; the third eye opens on his brow and its gold beam sweeps the field
  mist(14, 0.9, 0.25); vfx.decal(P, [0.6, 0.7, 1], 1.1, 3.2, { intensity: 0.35 });
  EYE_TEX = EYE_TEX || eyeTex();
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ map: EYE_TEX, transparent: true, depthTest: false, toneMapped: false }));
  eye.renderOrder = 9; const brow = () => onSprite(...mark);
  vfx.timed(eye, 1e9, () => { eye.position.copy(brow()); eye.quaternion.copy(world.camera.quaternion); eye.visible = a.viewDir(cam.yaw) === 'down'; });   // hidden while he looks away
  await anim(0.45, k => { eye.scale.set(1, Math.max(0.04, ease(k)), 1); });
  vfx.flash([1, 0.9, 0.6], 0.15); vfx.light(brow(), [1, 0.85, 0.5], 10, 0.5, 5);
  vfx.ring(brow(), [1, 0.85, 0.45], 0.45, 0.5, { vertical: true, yaw: cam.yaw, y: brow().y, intensity: 1 });
  const beam = vfx.ribbon({ col: [1, 0.72, 0.25], width: 0.06, n: 2, taper: 0, fade: 0.3 });
  const th0 = Math.atan2(toCam.z, toCam.x);
  await anim(0.75, k => {
    const th = th0 + Math.sin(k * Math.PI * 2) * 1.1 * (1 - k * 0.3), d = 3.2;   // swept left and right across the field before him
    const to = V(P.x + Math.cos(th) * d, 0, P.z + Math.sin(th) * d); to.y = effectH(to.x, to.z) + 0.05;
    beam.push(to); beam.push(brow());
    if (Math.random() < 0.7) vfx.spark(to.x + rand(-0.15, 0.15), to.y, to.z + rand(-0.15, 0.15), { vy: rand(0.6, 1.4), life: 0.6, size: rand(0.04, 0.07), r: 1, gg: 0.85, b: 0.45, shape: 0 });
    if (Math.random() < 0.25) vfx.decal(to, [1, 0.75, 0.35], 0.35, 0.5, { intensity: 0.5 });
  });
  beam.end();
  // 2. 哮天犬 springs out of the mist behind him, gallops a full circle round him, slows and sits at his front right
  HOUND_TEX = HOUND_TEX || houndTex();
  const map = HOUND_TEX.clone(); map.needsUpdate = true;
  const dog = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.15, 1.15, 1.2), transparent: true, depthWrite: false, toneMapped: false }));
  dog.renderOrder = 6; vfx.timed(dog, 1e9, () => {});
  const nF = HOUND_POSES.length, frame = i => { map.offset.x = i / nF; };
  const end = right.clone().addScaledVector(toCam, 0.35).normalize(), thEnd = Math.atan2(end.z, end.x), turn = Math.PI * 2 * 0.9, th1 = thEnd - turn;
  const R1 = 1.15, R2 = 1.0, stride = 1.6, D = 2.1, v = turn / 0.875;   // linear for 3/4 of the run, then easing to a stop
  const along = k => k < 0.75 ? v * k : v * 0.75 + v * (k - 0.75) - v * (k - 0.75) ** 2 / 0.5;
  const dogAt = k => { const th = th1 + along(k) / (v * 0.875) * turn, r = R1 + (R2 - R1) * Math.max(0, (k - 0.6) / 0.4) ** 2; return V(P.x + Math.cos(th) * r, P.y, P.z + Math.sin(th) * r); };
  let prev = dogAt(0), face = 1, lastF = -1; mist(6, 0.4, 0.3);
  vfx.burst(prev.clone().setY(P.y + 0.3), { n: 16, speed: 1.5, cols: [[1, 1, 1], [0.7, 0.8, 1]], size: 0.05, life: 0.5, g: 0, shape: 0 });
  await anim(D, k => {
    const q = dogAt(k), mv = q.clone().sub(prev), dist = along(k) / (v * 0.875) * turn * R1, ph = (dist / stride) % 1, f = Math.floor(ph * 4);
    if (mv.lengthSq() > 1e-8) face = mv.dot(right) < 0 ? -1 : 1;
    prev = q; frame(k > 0.97 ? 4 : f);
    q.y = effectH(q.x, q.z) + 0.23 + (k > 0.97 ? 0 : 0.035 * (0.5 + 0.5 * Math.cos(ph * Math.PI * 4)));   // a light rise in each of the gallop's two flights
    dog.position.copy(q); dog.quaternion.copy(world.camera.quaternion); dog.rotateZ(k > 0.97 ? 0 : Math.sin(ph * Math.PI * 2) * 0.05 * face);
    dog.scale.x = face; dog.material.opacity = Math.min(1, k * 10);
    if (f !== lastF && (f === 1 || f === 3) && k < 0.97) { const gq = q.clone().setY(effectH(q.x, q.z) + 0.03); for (let i = 0; i < 4; i++) vfx.spark(gq.x + rand(-0.12, 0.12), gq.y, gq.z + rand(-0.12, 0.12), { vy: rand(0.2, 0.6), vx: rand(-0.3, 0.3), life: 0.45, size: rand(0.03, 0.05), r: 0.82, gg: 0.9, b: 1, shape: 0 }); }   // light kicked up at each footfall
    lastF = f;
    const d = q.clone().sub(P); a.u.facing = Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 'right' : 'left') : (d.z > 0 ? 'down' : 'up');   // his eyes follow the hound
  });
  frame(4); dog.scale.x = P.clone().sub(prev).dot(right) < 0 ? -1 : 1;   // it sits looking up at him
  // 3. he turns back to us in his guard as the hound sits (no blade thrust to the sky: the user's call)
  a.u.facing = 'down'; LV.guard(a);
  await wait(900);
  await anim(0.3, k => { eye.scale.set(1, Math.max(0.04, 1 - ease(k)), 1); dog.material.opacity = 1 - k; });
  for (const it of vfx.items.filter(i => i.mesh === eye || i.mesh === dog)) it.life = 0;
  vfx.burst(prev.clone(), { n: 14, speed: 1.2, cols: [[1, 1, 1], [0.7, 0.8, 1]], size: 0.04, life: 0.5, g: -0.5, shape: 0 });
  await wait(300);
}
async function nezhaLevel(a, P) {
  const camQ = world.camera.quaternion, right = V(1, 0, 0).applyQuaternion(camQ).setY(0).normalize(), toCam = V(0, 0, 1).applyQuaternion(camQ).setY(0).normalize();
  const feet = () => (a.big.visible ? a.big : a.mesh).position.clone().addScaledVector(toCam, 0.03);
  a.u.facing = 'down'; LV.guard(a);
  // 1. the lotus: a bud at his feet opens wide in a pink-gold glow
  const lotus = lotusBloom(P);
  vfx.decal(P, [1, 0.55, 0.7], 1.0, 3.4, { intensity: 0.55 }); vfx.light(P.clone().setY(P.y + 0.4), [1, 0.6, 0.75], 6, 0.9, 4);
  await anim(0.5, k => {
    lotus.open(1 - Math.pow(1 - k, 3) * Math.cos(k * 3));   // opens with a little overshoot
    if (Math.random() < 0.6) { const t = rand(0, 6.28), r = rand(0.2, 0.6); vfx.spark(P.x + Math.cos(t) * r, P.y + 0.1, P.z + Math.sin(t) * r, { vy: rand(0.6, 1.2), life: 0.8, size: rand(0.04, 0.07), r: 1, gg: rand(0.6, 0.85), b: rand(0.7, 0.85), shape: 0 }); }
  });
  lotus.open(1);
  // 2. the wind-fire wheels flare under his feet and he rises, spinning, the 混天綾 streaming round him
  const wheels = [-1, 1].map(s => { const w = fireWheel(); w.quaternion.setFromUnitVectors(V(0, 0, 1), right.clone().multiplyScalar(0.55).addScaledVector(toCam, 0.85).normalize()); w.side = s; w.scale.setScalar(0.01); vfx.timed(w, 1e9, () => {}); return w; });
  const putWheels = (dt, grow) => { const f = feet(); for (const w of wheels) {
    w.position.copy(f).addScaledVector(right, w.side * 0.17).addScaledVector(toCam, 0.08).add(V(0, -0.08, 0)); w.spin.rotation.z -= dt * 22 * w.side; w.scale.setScalar(grow);
    for (let i = 0; i < 3; i++) { const t = rand(3.4, 6.0), q = V(Math.cos(t) * 0.19, Math.sin(t) * 0.19, 0).applyQuaternion(w.quaternion).multiplyScalar(grow).add(w.position);   // the lower rim: the fire licks down and away, clear of his legs
      vfx.flame(q.x, q.y, q.z, { size: rand(0.09, 0.14) * grow, asp: 1.3, life: 0.25, vy: -0.5 }); }
    if (Math.random() < dt * 30) vfx.spark(w.position.x, w.position.y, w.position.z, { vx: rand(-0.5, 0.5), vy: rand(-1.2, -0.4), vz: rand(-0.5, 0.5), g: 2, life: 0.4, size: 0.04, r: 1, gg: 0.7, b: 0.25, shape: 0, flicker: 1, ph: rand(0, 9) }); } };
  for (const w of wheels) vfx.burst(feet().addScaledVector(right, w.side * 0.17), { n: 10, speed: 1.6, cols: [[1, 0.85, 0.4], [1, 0.45, 0.1]], size: 0.05, life: 0.4, g: 1, shape: 0 });
  const sashes = [0, Math.PI].map(() => clothStrip({ col: [0.92, 0.07, 0.06], width: 0.07, n: 30 }));
  let swirl = 0;
  const sashAt = (t, dt) => { swirl += dt * 9; const c = a.chest(); sashes.forEach((s, j) => { const ang = swirl + j * Math.PI, r = 0.42 + Math.sin(t * 5 + j) * 0.06; s.push(V(c.x + Math.cos(ang) * r, c.y + Math.sin(ang * 0.5 + j) * 0.22, c.z + Math.sin(ang) * r)); }); };
  let T = 0;
  await anim(0.8, (k, dt = 1 / 60) => { T += dt; putWheels(dt, Math.min(1, k * 4)); a.hover = Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5) * 0.8; LV.spin(a, k * 0.8, 11); sashAt(T, dt); });
  // 3. the 乾坤圈: flung out on a loop round the field, tumbling and trailing gold, and snatched back with a flash
  a.u.facing = 'down'; LV.atk(a, 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.6, 0.1), toneMapped: false }));
  ring.renderOrder = 6; vfx.timed(ring, 1e9, () => {});
  const trail = vfx.ribbon({ col: [0.75, 0.32, 0.03], width: 0.08, n: 22 }), hand = () => a.chest().addScaledVector(right, 0.28).add(V(0, 0.15, 0));
  const th0 = Math.atan2(right.z, right.x);
  await anim(0.8, (k, dt = 1 / 60) => {
    T += dt; putWheels(dt, 1); sashAt(T, dt); a.hover = 0.8;
    const h = hand(), R0 = 2.1 * Math.sin(Math.PI * k), th = th0 - k * Math.PI * 2;
    ring.position.set(h.x + Math.cos(th) * R0, h.y + Math.sin(k * Math.PI * 2) * 0.35, h.z + Math.sin(th) * R0);
    ring.lookAt(world.camera.position); ring.rotateX(Math.sin(k * 14) * 0.7); ring.rotateY(Math.cos(k * 11) * 0.5); trail.push(ring.position);
    if (k > 0.25) a.act = null;
  });
  trail.end(); const caught = hand();
  for (const it of vfx.items.filter(i => i.mesh === ring)) it.life = 0;
  vfx.flash([1, 0.9, 0.6], 0.2); vfx.light(caught, [1, 0.85, 0.45], 12, 0.4, 5);
  vfx.burst(caught, { n: 26, speed: 3, cols: [[1, 1, 0.85], [1, 0.8, 0.3]], size: 0.05, life: 0.5, g: 2, shape: 0 });
  vfx.ring(caught, [1, 0.85, 0.4], 0.8, 0.35, { vertical: true, yaw: cam.yaw, y: caught.y, intensity: 1 });
  a.act = null;
  await anim(0.22, (k, dt = 1 / 60) => { T += dt; putWheels(dt, 1); sashAt(T, dt); });
  // 4. he comes down, standing (no dive pose: the user's call): the fire bursts out in a ring, the wheels gutter out and
  // the lotus petals scatter
  await anim(0.16, (k, dt = 1 / 60) => { T += dt; a.hover = 0.8 * (1 - k * k); putWheels(dt, 1); sashAt(T, dt); });
  a.hover = 0;
  for (const s of sashes) s.fade(0.5);
  for (const w of wheels) { const f = w.position.clone(); vfx.smokePuff(f.x, f.y, f.z, { vy: 0.5, life: 0.6, size: 0.15, size1: 0.4, tint: [0.4, 0.36, 0.34] }); const it = vfx.items.find(i => i.mesh === w); if (it) it.life = 0; }
  lotus.scatter();
  vfx.shake(0.14, 0.25); vfx.ring(P, [1, 0.45, 0.15], 2.2, 0.55, { intensity: 0.9 }); vfx.decal(P, [1, 0.4, 0.1], 1.0, 0.9, { intensity: 0.45 });
  vfx.light(P.clone().setY(P.y + 0.3), [1, 0.5, 0.2], 14, 0.5, 6);
  for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2, sp = rand(2.2, 2.8); vfx.flame(P.x + Math.cos(t) * 0.25, P.y + 0.05, P.z + Math.sin(t) * 0.25, { vx: Math.cos(t) * sp, vz: Math.sin(t) * sp, vy: 0.6, drag: 3, size: rand(0.26, 0.36), asp: 1.6, life: 0.55 }); }
  vfx.burst(P.clone().setY(P.y + 0.2), { n: 30, speed: 3.5, cols: [[1, 0.95, 0.6], [1, 0.55, 0.15]], size: 0.05, life: 0.6, g: 4, up: 0.6, shape: 0 });
  await wait(700);
}

// ---------------------------------------------------------------- 林雲: the young hunter of 昌平村, quick and brash
// [the user's call] he spins round and round in a rising wind, stops facing us and closes his eyes; a great sword of blue
// light takes shape at his back, point up, and shoots up into the sky, its trail a pillar of light over him; he opens his eyes
// the sword of light: a broad 劍 seen flat, point up (256 x 1024), white at its core, blue at its edges, haloed
const LIN_SWORD = () => once('linSword', () => canvasTex(256, 1024, g => {
  const blade = () => { g.beginPath(); g.moveTo(128, 30); g.lineTo(162, 110); g.lineTo(160, 700); g.lineTo(96, 700); g.lineTo(94, 110); g.closePath(); };
  g.shadowColor = 'rgba(60,140,255,1)'; g.shadowBlur = 40; g.fillStyle = 'rgba(90,160,255,0.9)'; blade(); g.fill();
  const gr = g.createLinearGradient(94, 0, 162, 0); gr.addColorStop(0, '#5aa8ff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#5aa8ff');
  g.shadowBlur = 12; g.fillStyle = gr; blade(); g.fill();
  g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 60); g.lineTo(128, 690); g.stroke();   // the ridge
  g.shadowColor = 'rgba(60,140,255,1)'; g.shadowBlur = 24; g.fillStyle = '#bfe0ff';   // the guard, swept up at its ends
  g.beginPath(); g.moveTo(30, 690); g.quadraticCurveTo(128, 730, 226, 690); g.lineTo(214, 730); g.quadraticCurveTo(128, 770, 42, 730); g.closePath(); g.fill();
  g.fillStyle = '#8cc4ff'; g.fillRect(112, 750, 32, 180);   // the grip, wrapped
  g.strokeStyle = 'rgba(40,90,200,0.8)'; g.lineWidth = 4; for (let y = 760; y < 925; y += 16) { g.beginPath(); g.moveTo(112, y); g.lineTo(144, y + 10); g.stroke(); }
  g.fillStyle = '#d8ecff'; g.beginPath(); g.arc(128, 952, 26, 0, Math.PI * 2); g.fill();   // the pommel
}));
const LIN_EYES = [[13, 11], [14, 11], [18, 11], [19, 11]];   // his eyes on the facing-us frame (32 px): white and pupil, rows 11-12
// his facing-us frame with the eyes shut: the eye pixels of the 32 px frame painted as a dark lid line over skin, smoothed
// to 4x as the extractor smooths every sheet, and only that patch laid over his own HD frame (the line on the eyes' upper
// row, under the brows: on the lower row the smoothing ran it down into the dark pixels below the eyes' outer corners, so
// the shut eyes drooped where his open eyes slant up [the user's report])
async function linEyesShut(a) {
  const sd = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/sd/spr_' + a.u.sprite + '.png'; });
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(sd, 0, 0, 32, 32, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32);
  const put = (x, y, rgb) => d.data.set([...rgb, 255], (y * 32 + x) * 4);
  for (const [x, y] of LIN_EYES) { put(x, y, [108, 36, 0]); put(x, y + 1, [252, 144, 0]); }
  const hd = upscale({ w: 32, h: 32, channels: 4, px: d.data });
  const src = a.texWalk.image, fw = src.width / 9;   // (frame 0: facing us)
  const out = document.createElement('canvas'); out.width = out.height = 2 * fw; const og = out.getContext('2d');
  og.drawImage(src, 0, 0, fw, fw, fw / 2, fw / 2, fw, fw);
  const K = fw / 32, patch = og.getImageData(fw / 2 + 12 * K, fw / 2 + 10 * K, 9 * K, 4 * K);
  for (let y = 0; y < 4 * K; y++) for (let x = 0; x < 9 * K; x++) { const o = ((10 * K + y) * 128 + 12 * K + x) * 4, p = (y * 9 * K + x) * 4; patch.data.set(hd.px.subarray(o, o + 4), p); }
  og.putImageData(patch, fw / 2 + 12 * K, fw / 2 + 10 * K);
  return tex(out);
}
async function linLevel(a, P) {
  const { toCam } = axes(), BLUE = [0.3, 0.62, 1];
  const shut = await (once.c.linEyes || (once.c.linEyes = linEyesShut(a)));
  a.u.facing = 'down'; a.act = null;
  // 1. he spins, faster and then slowing, three rounds, in a wind that rises round him, turning his way (down, right, up,
  // left: counter-clockwise from above; the wind went clockwise against him, the user's report)
  const winds = [0, 1, 2].map(() => vfx.ribbon({ col: [0.6, 0.8, 1], width: 0.05, n: 18, fade: 0.35 }));
  let T = 0, turn = 0;
  await anim(1.6, (k, dt = 1 / 60) => {
    T += dt; turn += dt * 7.5 * Math.sin(Math.PI * Math.min(1, k * 1.05));   // (3 rounds of four facings over the whole)
    LV.spin(a, turn, 1);
    winds.forEach((w, j) => { const th = -T * 10 + j * 2.1, r = 0.5 + j * 0.08; w.push(V(P.x + Math.cos(th) * r, P.y + 0.15 + j * 0.35 + k * 0.4, P.z + Math.sin(th) * r * 0.85)); });
    if (Math.random() < 0.5) { const t = rand(0, 6.28); vfx.smokePuff(P.x + Math.cos(t) * 0.35, P.y + 0.05, P.z + Math.sin(t) * 0.35, { vx: Math.cos(t) * 1.2, vz: Math.sin(t) * 1.2, vy: 0.15, drag: 2, life: 0.7, size: 0.12, size1: 0.35, tint: [0.62, 0.55, 0.46] }); }
  });
  winds.forEach(w => w.end());
  // 2. he stops facing us and closes his eyes; blue light rises softly round him
  a.u.facing = 'down'; a.act = { kind: 'tex', tex: shut };
  vfx.decal(P, BLUE, 0.9, 3.4, { intensity: 0.4 }); vfx.light(P.clone().setY(P.y + 0.9), [0.55, 0.75, 1], 2.5, 3.2, 4);
  const motes = (n, spread) => { for (let i = 0; i < n; i++) vfx.spark(P.x + rand(-spread, spread), P.y + rand(0, 0.3), P.z + rand(-spread, spread) * 0.8, { vy: rand(0.4, 0.9), life: rand(0.8, 1.3), size: rand(0.025, 0.045), r: 0.6, gg: 0.82, b: 1, shape: 0, fadeIn: 0.3 }); };
  await anim(0.7, () => motes(1, 0.5));
  // 3. the great sword takes shape at his back, point up: light gathering into it from the air round him
  const H = 3.2, big = card(LIN_SWORD(), H / 4, H, { order: 6 }); big.material.opacity = 0;
  const back = P.clone().addScaledVector(toCam, -0.8), base = back.clone().setY(P.y - 0.2 + H / 2);   // the grip at his back, the blade over his head (well behind: his sprite leans back, its head behind his feet)
  const fadeTo = v => { big.material.opacity = Math.min(1, v); big.material.color.setScalar(Math.max(1, v)); };
  await anim(0.9, k => {
    fadeTo(k * k); big.position.copy(base).setY(base.y + k * 0.25); face(big);
    for (let i = 0; i < 2; i++) { const t = rand(0, 6.28), r = rand(0.8, 1.4), y = big.position.y + rand(0.3, 2.6), q = V(back.x + Math.cos(t) * r, y, back.z + Math.sin(t) * r);
      vfx.spark(q.x, q.y, q.z, { vx: 0, vy: 0, seek: { x: back.x, y, z: back.z, k: 5 }, life: 0.45, size: rand(0.03, 0.05), r: 0.7, gg: 0.88, b: 1, shape: 1 }); }
    motes(1, 0.5);
  });
  vfx.flash([0.6, 0.8, 1], 0.08); vfx.light(back.clone().setY(P.y + 1.6), [0.45, 0.7, 1], 10, 0.6, 6);
  await anim(0.5, k => { fadeTo(1 + 0.6 * Math.sin(k * Math.PI)); face(big); motes(1, 0.5); });   // it pulses once, full
  // 4. it shoots up into the sky, leaving a pillar of light over him; then he opens his eyes
  const trail = vfx.ribbon({ col: [0.55, 0.8, 1], width: 0.5, n: 16, fade: 0.45 }), from = big.position.clone();
  vfx.shake(0.12, 0.3);
  for (let i = 0; i < 14; i++) { const t = i / 14 * 6.28, sp = rand(1.6, 2.4); vfx.smokePuff(P.x, P.y + 0.06, P.z, { vx: Math.cos(t) * sp, vz: Math.sin(t) * sp, vy: 0.2, drag: 2.5, life: 0.8, size: 0.16, size1: 0.5, tint: [0.62, 0.55, 0.46] }); }
  vfx.ring(P, [0.55, 0.8, 1], 1.8, 0.5, { intensity: 0.7 });
  await anim(0.12, k => { big.position.copy(from).setY(from.y - k * 0.15); face(big); });   // it dips, gathering itself
  const low = big.position.clone();
  await anim(0.5, k => { big.position.copy(low).setY(low.y + k * k * 18); face(big); trail.push(big.position.clone().setY(big.position.y - H * 0.3)); });
  trail.end(); drop(big);
  vfx.pillar(back, BLUE, 0.12, 16, 0.7, { intensity: 0.5 });
  vfx.flash([0.7, 0.85, 1], 0.08);
  await wait(250);
  a.act = null;   // he opens his eyes, standing as he stood (no guard pose after: the user's call)
  // light falls back down over him like fine rain
  await anim(1.0, () => { if (Math.random() < 0.8) vfx.spark(P.x + rand(-0.9, 0.9), P.y + rand(2, 3.4), P.z + rand(-0.7, 0.7), { vy: -rand(0.6, 1.1), life: rand(1, 1.6), size: rand(0.025, 0.04), r: 0.65, gg: 0.85, b: 1, shape: 0, fadeIn: 0.2 }); });
  await wait(300);
}

// ---------------------------------------------------------------- 黃飛虎: 武成王, the flying tiger
// the tiger head-on, lunging at us, drawn on a 256 grid at twice that (512x512) [the user's call: real and ferocious, not
// cute]: a broad angular head, its cheek ruffs flaring in pointed tufts, the ears pinned back; heavy brows drawn down
// over glowing amber eyes; the snarl wrinkling the nose's bridge, the upper lip drawn back off long fangs; tapering
// broken stripes and fine fur over it all; the massive forepaws thrown out below, claws out. roar: the jaws wide
export function drawTigerFront(g, roar) {
  g.save(); g.scale(2, 2);
  const R = (a, b) => a + Math.random() * (b - a), jaw = roar ? 30 : 12;
  const fur = (x0, y0, x1, y1) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#e89a48'); q.addColorStop(0.55, '#c86c24'); q.addColorStop(1, '#6a2a0c'); return q; };
  const ink = '#120604';
  const stripe = (x0, y0, x1, y1, w, b = 0) => { const mx = (x0 + x1) / 2 + b, my = (y0 + y1) / 2 - b * 0.4, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
    g.fillStyle = ink; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx + nx / l * w, my + ny / l * w, x1, y1); g.quadraticCurveTo(mx - nx / l * w, my - ny / l * w, x0, y0); g.closePath(); g.fill(); };   // pointed at both ends
  // the forepaws, out to either side and toward us, heavy, striped, the claws hooked out of the toes
  for (const s of [-1, 1]) {
    limb(g, [[128 + s * 44, 176], [128 + s * 84, 196], [128 + s * 106, 226]], [54, 44, 40], fur(128 + s * 40, 168, 128 + s * 112, 244));
    for (const t of [0.2, 0.45, 0.7]) stripe(128 + s * (50 + 52 * t), 172 + 46 * t, 128 + s * (40 + 52 * t), 198 + 46 * t, 3.2, s * 3);
    g.fillStyle = fur(128 + s * 90, 214, 128 + s * 124, 254); g.beginPath(); g.ellipse(128 + s * 106, 234, 32, 21, s * 0.2, 0, 6.28); g.fill();
    g.strokeStyle = 'rgba(60,20,4,0.7)'; g.lineWidth = 1.5; for (let c = -1; c <= 1; c++) { g.beginPath(); g.moveTo(128 + s * (106 + c * 11), 226); g.lineTo(128 + s * (106 + c * 11), 248); g.stroke(); }   // the toes
    for (let c = -2; c <= 1; c++) { const x = 128 + s * (100 + c * 11), y = 248; const cg = g.createLinearGradient(x, y - 4, x, y + 14); cg.addColorStop(0, '#f8f2dc'); cg.addColorStop(1, '#a89878');
      g.fillStyle = cg; g.beginPath(); g.moveTo(x - 3, y - 3); g.quadraticCurveTo(x + s * 2, y + 5, x + s * 6, y + 13); g.quadraticCurveTo(x + s * 0.5, y + 5, x + 3, y - 3); g.closePath(); g.fill(); }
  }
  // the shoulders behind the head, hunched: each blade rising at the side as it crouches (one oval made a ball of it all)
  g.fillStyle = fur(128, 124, 128, 214); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 66, 188, 48, 28, s * -0.35, 0, 6.28); g.fill(); }
  g.beginPath(); g.ellipse(128, 200, 64, 24, 0, 0, 6.28); g.fill();
  for (const s of [-1, 1]) for (const k of [0, 1, 2, 3]) stripe(128 + s * (66 + k * 13), 166 + k * 3, 128 + s * (60 + k * 13), 208 + k * 2, 3.5, s * 4);
  // the head and its ears 80% of the size they were drawn at, about the neck where it meets the shoulders [the user's call:
  // the face 20% smaller, the body and paws as they are]
  g.save(); g.translate(128, 176); g.scale(0.8, 0.8); g.translate(-128, -176);
  // the ears laid back at the top corners of the skull: short rounded triangles turned outward, their dark backs and
  // the white spot on each showing (a pinned blob at the sides made the head read as a ball [the user's report])
  for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 62, 58); g.rotate(s * 1.5); g.scale(0.8, 0.7);
    g.fillStyle = '#2a1206'; g.beginPath(); g.moveTo(-15, 4); g.quadraticCurveTo(-11, -16, -2, -25); g.quadraticCurveTo(3, -27, 6, -22); g.quadraticCurveTo(13, -10, 15, 4); g.closePath(); g.fill();
    const sp = g.createRadialGradient(1, -11, 0.5, 1, -11, 6); sp.addColorStop(0, 'rgba(236,226,206,0.85)'); sp.addColorStop(1, 'rgba(236,226,206,0)'); g.fillStyle = sp; g.beginPath(); g.ellipse(1, -11, 4, 6.5, 0, 0, 6.28); g.fill();
    g.strokeStyle = '#c87830'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-15, 4); g.quadraticCurveTo(-11, -16, -2, -25); g.stroke(); g.restore(); }
  // the head: a flat broad brow between the ears, the skull's sides straight down to the cheek ruffs, which flare out in
  // pointed tufts; then the jaw cut in at an angle to a square chin (not a round face: the user's report)
  const head = new Path2D(); head.moveTo(128, 40);
  head.quadraticCurveTo(152, 37, 172, 42); head.quadraticCurveTo(188, 48, 194, 64); head.lineTo(198, 90);
  for (let i = 0; i < 6; i++) { const y = 96 + i * 11, x = 204 - Math.abs(i - 2.2) * 4; head.lineTo(x + 10, y + 4); head.lineTo(x - 5, y + 8); }
  head.lineTo(176, 172); head.lineTo(156, 190); head.quadraticCurveTo(128, 197, 100, 190); head.lineTo(80, 172);
  for (let i = 5; i >= 0; i--) { const y = 96 + i * 11, x = 52 + Math.abs(i - 2.2) * 4; head.lineTo(x + 5, y + 8); head.lineTo(x - 10, y + 4); }
  head.lineTo(58, 90); head.lineTo(62, 64); head.quadraticCurveTo(68, 48, 84, 42); head.quadraticCurveTo(104, 37, 128, 40); head.closePath();
  // lit as planes, not a dome: the brow and muzzle catch the light down the middle, the cheeks turn away darker to the sides
  const hg = g.createLinearGradient(36, 0, 220, 0);
  for (const [t, c] of [[0, '#4a1a06'], [0.16, '#9a4612'], [0.3, '#c86a22'], [0.42, '#e49448'], [0.5, '#eca050'], [0.58, '#e49448'], [0.7, '#c86a22'], [0.84, '#9a4612'], [1, '#4a1a06']]) hg.addColorStop(t, c);
  g.save(); g.shadowColor = 'rgba(30,8,0,0.7)'; g.shadowBlur = 18; g.shadowOffsetY = 8; g.fillStyle = hg; g.fill(head); g.restore();   // (its shadow on the shoulders: the head stands off the body)
  const vg = g.createLinearGradient(0, 40, 0, 196); vg.addColorStop(0, 'rgba(60,20,4,0.35)'); vg.addColorStop(0.25, 'rgba(60,20,4,0)'); vg.addColorStop(0.8, 'rgba(60,20,4,0)'); vg.addColorStop(1, 'rgba(40,12,2,0.5)');
  g.fillStyle = vg; g.fill(head);
  g.save(); g.clip(head);
  const pale = (x, y, rx, ry, rot = 0, a = 0.92) => { const q = g.createRadialGradient(0, 0, 1, 0, 0, rx); q.addColorStop(0, `rgba(238,228,208,${a})`); q.addColorStop(0.65, `rgba(230,214,186,${a * 0.85})`); q.addColorStop(1, 'rgba(230,214,186,0)');
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx); g.fillStyle = q; g.beginPath(); g.arc(0, 0, rx, 0, 6.28); g.fill(); g.restore(); };
  for (const s of [-1, 1]) { pale(128 + s * 26, 74, 10, 5, s * 0.35, 0.7); pale(128 + s * 58, 154, 28, 20, s * -0.4); pale(128 + s * 19, 142, 22, 17); }   // spots over the eyes, the cheeks' undersides, the muzzle pads
  pale(128, 188, 22, 8, 0, 0.8);   // the chin under the jaw
  // the stripes: thin, black, pointed at both ends, in the brow's broken bars and the cheeks' long parallel sweeps
  stripe(114, 54, 128, 52, 2.4); stripe(128, 52, 142, 54, 2.4); stripe(112, 62, 144, 62, 2.6); stripe(118, 70, 138, 70, 2.2); stripe(128, 48, 128, 76, 1.8);
  for (const s of [-1, 1]) {
    for (const [x0, y0, x1, y1] of [[22, 52, 40, 70], [34, 48, 56, 70], [48, 54, 66, 76]]) stripe(128 + s * x0, y0, 128 + s * x1, y1, 2.6, s * 2);
    for (const [x0, y0, x1, y1, w] of [[44, 98, 88, 92, 3.4], [48, 110, 92, 106, 3.8], [50, 122, 90, 122, 3.6], [52, 134, 88, 140, 3.2], [50, 146, 80, 156, 2.8]]) stripe(128 + s * x0, y0, 128 + s * x1, y1, w, s * -4);
  }
  g.restore();
  // brows: heavy ridges driven down to the nose in a scowl, deep shadow under them
  for (const s of [-1, 1]) { const sh = g.createLinearGradient(0, 80, 0, 96); sh.addColorStop(0, 'rgba(30,10,2,0.8)'); sh.addColorStop(1, 'rgba(30,10,2,0)');
    g.fillStyle = sh; g.beginPath(); g.moveTo(128 + s * 6, 84); g.lineTo(128 + s * 46, 78); g.lineTo(128 + s * 44, 96); g.lineTo(128 + s * 8, 98); g.closePath(); g.fill();
    g.strokeStyle = ink; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 + s * 8, 89); g.quadraticCurveTo(128 + s * 26, 79, 128 + s * 46, 81); g.stroke(); }
  // the eyes: hooded, slanting down to the nose, molten amber round a small black pupil, ringed in black, a hard glint
  for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 28, 93); g.rotate(s * -0.3);
    g.fillStyle = ink; g.beginPath(); g.ellipse(0, 0, 14, 6.5, 0, 0, 6.28); g.fill();
    const ir = g.createRadialGradient(0, 1, 0.5, 0, 1, 10); ir.addColorStop(0, '#fff2a0'); ir.addColorStop(0.45, '#f0b018'); ir.addColorStop(1, '#a85000');
    g.fillStyle = ir; g.beginPath(); g.ellipse(0, 1, 11, 4.2, 0, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(20,6,0,0.55)'; g.beginPath(); g.ellipse(0, -2.5, 12, 3, 0, 0, 6.28); g.fill();   // the heavy upper lid's shadow
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 1, 2.3, 0, 6.28); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-s * 3, 0, 1, 0, 6.28); g.fill(); g.restore(); }
  // the long bridge of the nose, wrinkled in deep folds by the snarl, creases running down to the lip
  const br = g.createLinearGradient(0, 88, 0, 128); br.addColorStop(0, 'rgba(240,170,90,0.5)'); br.addColorStop(1, 'rgba(240,170,90,0)');
  g.fillStyle = br; g.beginPath(); g.moveTo(120, 88); g.lineTo(136, 88); g.lineTo(144, 126); g.lineTo(112, 126); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(50,16,2,0.85)'; g.lineWidth = 2;
  for (const y of [104, 110, 116]) { g.beginPath(); g.moveTo(117, y); g.quadraticCurveTo(128, y - 4, 139, y); g.stroke(); }
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 14, 118); g.quadraticCurveTo(128 + s * 26, 128, 128 + s * 38, 144); g.stroke(); }
  // the nose: broad, the leather a dull rose, the nostrils flared
  g.fillStyle = '#9a5848'; g.beginPath(); g.moveTo(109, 122); g.quadraticCurveTo(128, 116, 147, 122); g.quadraticCurveTo(143, 136, 128, 138); g.quadraticCurveTo(113, 136, 109, 122); g.fill();
  g.fillStyle = ink; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 7, 131, 4.2, 2.5, s * 0.5, 0, 6.28); g.fill(); }
  g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(128, 137); g.lineTo(128, 145); g.stroke();
  // the mouth: the upper lip drawn up off the gums across the whole muzzle, the jaws gaping on a dark throat
  const top = 146, bot = top + jaw * 1.6, half = 37;
  const thr = g.createRadialGradient(128, (top + bot) / 2, 2, 128, (top + bot) / 2, 40); thr.addColorStop(0, '#120201'); thr.addColorStop(0.7, '#3e0806'); thr.addColorStop(1, '#6e160e');
  g.fillStyle = thr; g.beginPath(); g.moveTo(128 - half, top); g.quadraticCurveTo(128, top - 8, 128 + half, top); g.quadraticCurveTo(128 + half - 4, bot, 128, bot + 5); g.quadraticCurveTo(128 - half + 4, bot, 128 - half, top); g.fill();
  if (roar) { g.fillStyle = '#a84444'; g.beginPath(); g.ellipse(128, bot - 3, 18, 6, 0, 0, 6.28); g.fill(); g.strokeStyle = 'rgba(80,16,16,0.6)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(128 + k * 6, bot - 8); g.lineTo(128 + k * 6.5, bot); g.stroke(); } }   // the tongue, ridged
  g.fillStyle = '#8a3438'; g.beginPath(); g.moveTo(128 - half + 2, top); g.quadraticCurveTo(128, top - 10, 128 + half - 2, top); g.lineTo(128 + half - 4, top + 5); g.quadraticCurveTo(128, top - 3, 128 - half + 4, top + 5); g.closePath(); g.fill();   // the gums
  g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(128 - half - 4, top + 2); g.quadraticCurveTo(128, top - 12, 128 + half + 4, top + 2); g.stroke();   // the black lips
  g.beginPath(); g.moveTo(128 - half + 2, bot - 8); g.quadraticCurveTo(128, bot + 8, 128 + half - 2, bot - 8); g.stroke();
  const tooth = (x, y, len, w, down) => { const d = down ? 1 : -1, tg = g.createLinearGradient(x, y, x, y + len * d); tg.addColorStop(0, '#f4ead0'); tg.addColorStop(1, '#c8b488');
    g.fillStyle = tg; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.4, y + len * 0.6 * d, x + w * 0.2, y + len * d); g.quadraticCurveTo(x + w * 0.6, y + len * 0.4 * d, x + w, y); g.closePath(); g.fill(); };
  for (const s of [-1, 1]) { tooth(128 + s * 22, top + 2, 15 + jaw * 0.3, 4.6, true); tooth(128 + s * 19, bot - 5, 11 + jaw * 0.18, 4, false); }   // the fangs
  for (let k = -3; k <= 3; k++) if (k) { tooth(128 + k * 4.6, top + 2, 4.5, 1.9, true); tooth(128 + k * 4.4, bot - 5, 3.8, 1.7, false); }   // the incisors
  // whiskers out from the pads, stiff and fine
  g.strokeStyle = 'rgba(250,244,228,0.75)'; g.lineWidth = 0.7;
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(128 + s * 30, 134 + k * 4); g.quadraticCurveTo(128 + s * 56, 130 + k * 5, 128 + s * (82 + k * 3), 124 + k * 8); g.stroke(); }
  g.restore();   // (the head's scale)
  g.restore();
  // fur over everything: short strokes in each spot's own colour, lighter and darker, running out from the nose
  const W = g.canvas.width, H = g.canvas.height, px = g.getImageData(0, 0, W, H).data;
  g.lineWidth = 1; g.lineCap = 'round';
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * W, y = Math.random() * H, o = (Math.floor(y) * W + Math.floor(x)) * 4; if (px[o + 3] < 200) continue;
    const r = px[o], gg = px[o + 1], b = px[o + 2]; if (r + gg + b < 120 && Math.random() < 0.7) continue;
    const ang = Math.atan2(y - 244, x - 256) + R(-0.3, 0.3), len = R(3, 9), k = Math.random() < 0.5 ? 1.16 : 0.8;
    g.strokeStyle = `rgba(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, b * k) | 0},0.5)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
}
// 黃飛虎's level-up [the user's call: the tiger comes out of his body, to the front]: war-fire climbs round him and a gold
// light gathers in his chest; the spirit tiger bursts out of it head-on, lunging at us, growing as it comes, and roars
// with the screen shaking; it breaks into gold embers and he stands in his guard
async function huangLevel(a, P) {
  const { right, toCam } = axes();
  a.u.facing = 'down'; LV.guard(a);
  // war-fire: low golden flames climb round him, the light gathering in his chest
  vfx.light(a.chest(), [1, 0.75, 0.3], 6, 1.2, 4);
  await anim(0.7, k => { for (let i = 0; i < 2; i++) { const t = rand(0, 6.28), r = rand(0.35, 0.65); vfx.realFire(P.x + Math.cos(t) * r, P.y - 0.05, P.z + Math.sin(t) * r, { size: rand(0.3, 0.45) * (0.5 + k), asp: 1.5, life: 0.6, vy: 0.5 }); }
    a.flash = 0.45 * k; const c = a.chest(); vfx.spark(c.x + rand(-0.5, 0.5), c.y + rand(-0.4, 0.6), c.z, { vx: 0, vy: 0, seek: { x: c.x, y: c.y, z: c.z, k: 6 }, life: 0.45, size: rand(0.03, 0.05), r: 1, gg: 0.85, b: 0.4, shape: 1 }); });
  // the tiger bursts out of his chest, lunging at the camera, growing as it comes
  const map = once('tigerFront3', () => glowStrip(512, 512, 2, 'rgba(255,150,40,0.7)', (g, i) => drawTigerFront(g, i === 1))).clone(); map.needsUpdate = true; map.repeat.set(0.5, 1);
  const tiger = card(map, 1, 1, { order: 9.5 }); tiger.material.depthTest = false;   // (solid, its own colours: see-through and brightened, the hero showed through its jaws and it read soft [the user's call: real, ferocious])
  const c0 = a.chest(), cp = world.camera.position, toward = cp.clone().sub(c0).normalize(), dist = cp.distanceTo(c0);
  vfx.flash([1, 0.8, 0.4], 0.15); vfx.burst(c0, { n: 30, speed: 2.5, cols: [[1, 0.95, 0.7], [1, 0.7, 0.25]], size: 0.05, life: 0.5, g: 0, shape: 1 });
  a.flash = 0;
  await anim(0.55, k => {
    const e = 1 - Math.pow(1 - k, 3); tiger.position.copy(c0).addScaledVector(toward, e * dist * 0.25).add(V(0, e * 0.25, 0));
    face(tiger); tiger.scale.setScalar(0.3 + e * 1.5); tiger.material.opacity = Math.min(1, k * 4); map.offset.x = k > 0.7 ? 0.5 : 0;
    if (Math.random() < 0.8) vfx.spark(tiger.position.x + rand(-0.6, 0.6), tiger.position.y + rand(-0.5, 0.5), tiger.position.z, { vy: rand(-0.3, 0.4), life: 0.5, size: rand(0.04, 0.06), r: 1, gg: 0.8, b: 0.35, shape: 1 });
  });
  // the roar
  map.offset.x = 0.5; LV.atk(a, 1);
  vfx.shake(0.28, 0.5); vfx.flash([1, 0.85, 0.5], 0.2); vfx.light(tiger.position.clone(), [1, 0.8, 0.4], 16, 0.6, 7);
  for (const [d, r] of [[0, 2.8], [120, 2.1], [240, 1.5]]) later(() => vfx.ring(tiger.position, [1, 0.8, 0.35], r, 0.6, { vertical: true, yaw: cam.yaw, y: tiger.position.y, intensity: 0.7 }), d);
  for (let i = 0; i < 18; i++) { const t = i / 18 * 6.28, sp = rand(2.2, 3.2); vfx.smokePuff(P.x, P.y + 0.08, P.z, { vx: Math.cos(t) * sp, vz: Math.sin(t) * sp, vy: 0.2, drag: 2.5, life: 0.9, size: 0.25, size1: 0.7, tint: [0.62, 0.5, 0.36] }); }
  await anim(0.5, k => { tiger.scale.setScalar(1.8 + Math.sin(k * 30) * 0.03); face(tiger); });
  // it breaks into gold embers
  const tp = tiger.position.clone();
  for (let i = 0; i < 50; i++) vfx.spark(tp.x + rand(-0.7, 0.7), tp.y + rand(-0.6, 0.6), tp.z + rand(-0.3, 0.3), { vx: rand(-1, 1), vy: rand(-0.2, 1.4), vz: rand(-0.5, 0.5), life: rand(0.6, 1.2), size: rand(0.04, 0.07), r: 1, gg: rand(0.7, 0.9), b: 0.35, shape: 1, flicker: 1, ph: rand(0, 6) });
  await anim(0.4, k => { tiger.scale.setScalar(1.8 + k * 0.4); tiger.material.opacity = 1 - k; face(tiger); });
  drop(tiger);
  LV.guard(a);
  await wait(600);
}

// ---------------------------------------------------------------- 姬發: the prince of Zhou, 鳳鳴岐山
// the phoenix whose cry on Mount Qi foretold Zhou's rise is born out of his breast and spirals up round him trailing its
// long tail and golden feathers, then soars away, a ring of gold spreading at his feet
export function drawPhoenix(g, up) {
  // a 鳳 seen side on, facing right, 256x128 [the user's call: a finer bird]: a long S of a neck under a crest of three
  // curling plumes, a hooked beak; wings of layered feathers (a fan of broad primaries, gold to orange to a crimson edge,
  // coverts over their roots); a train of five streaming plumes, each ending in an eye of blue ringed with gold
  const featherGrad = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#ffb43a'); gr.addColorStop(0.8, '#ff5a1e'); gr.addColorStop(1, '#c8102a'); return gr; };
  const feather = (x0, y0, x1, y1, w, bend) => {   // a vane from (x0, y0) to its tip, w wide at the root, bent to one side
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
    g.fillStyle = featherGrad(x0, y0, x1, y1); g.beginPath(); g.moveTo(x0 + nx * w, y0 + ny * w);
    g.quadraticCurveTo(mx + nx * w * 0.9, my + ny * w * 0.9, x1, y1); g.quadraticCurveTo(mx - nx * w * 0.7, my - ny * w * 0.7, x0 - nx * w, y0 - ny * w); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,248,220,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();   // the shaft
  };
  // the train: five plumes streaming back and down from the rump, each ending in an eye
  const R = [110, 66];
  [[-18, 0.0, 1.0], [-8, 0.5, 1.05], [2, 1.0, 0.95], [12, 1.5, 0.85], [22, 2.0, 0.75]].forEach(([dy, ph, len]) => {
    const ex = R[0] - 100 * len, ey = R[1] + 18 + dy + Math.sin(ph + (up ? 0.6 : 0)) * 6;
    const gr = g.createLinearGradient(R[0], R[1], ex, ey); gr.addColorStop(0, '#ffcf5a'); gr.addColorStop(0.6, '#ff7a2a'); gr.addColorStop(1, '#d42a1e');
    g.strokeStyle = gr; g.lineCap = 'round'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(R[0], R[1]); g.bezierCurveTo(R[0] - 40, R[1] + dy * 0.3, ex + 40, ey - 18, ex, ey); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,190,90,0.7)'; for (let t = 0.3; t < 0.95; t += 0.09) { const x = R[0] + (ex - R[0]) * t, y = R[1] + (ey - R[1]) * t + Math.sin(t * 3) * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 5); g.moveTo(x, y); g.lineTo(x - 4, y + 5); g.stroke(); }   // barbs
    g.fillStyle = '#ffd24a'; g.beginPath(); g.ellipse(ex, ey, 7, 5, 0.3, 0, 6.28); g.fill();   // the eye
    g.fillStyle = '#1a8ad8'; g.beginPath(); g.ellipse(ex, ey, 4.2, 3, 0.3, 0, 6.28); g.fill(); g.fillStyle = '#0a2a5a'; g.beginPath(); g.arc(ex + 0.5, ey, 1.6, 0, 6.28); g.fill();
  });
  const wing = (back) => {   // a fan: broad primaries from the front (the longest) round to the back, coverts layered over their roots
    const sx = back ? 140 : 134, sy = back ? 55 : 60, N = 8, L = back ? 44 : 50;
    const [aF, aB] = up ? [-1.42, -2.55] : [1.2, 2.35];
    for (let i = N - 1; i >= 0; i--) { const f = i / (N - 1), ang = aF + (aB - aF) * f, len = L * (1 - 0.42 * f), rx = sx - f * 24, ry = sy + f * 3;
      feather(rx, ry, rx + Math.cos(ang) * len, ry + Math.sin(ang) * len, 6.5 - f * 2, (up ? -1 : 1) * 3); }
    for (let i = N - 2; i >= 0; i--) { const f = i / (N - 2), ang = aF + (aB - aF) * f, len = L * 0.5 * (1 - 0.3 * f), rx = sx - f * 22, ry = sy + f * 3;   // the coverts
      const gr = g.createLinearGradient(rx, ry, rx + Math.cos(ang) * len, ry + Math.sin(ang) * len); gr.addColorStop(0, '#fff2b8'); gr.addColorStop(1, '#ffa634');
      g.fillStyle = gr; g.beginPath(); g.ellipse(rx + Math.cos(ang) * len * 0.5, ry + Math.sin(ang) * len * 0.5, len * 0.55, 6.5, ang, 0, 6.28); g.fill(); }
  };
  g.globalAlpha = 0.8; wing(true); g.globalAlpha = 1;
  const bodyG = g.createLinearGradient(100, 50, 150, 80); bodyG.addColorStop(0, '#ff9a2a'); bodyG.addColorStop(0.5, '#ffd25a'); bodyG.addColorStop(1, '#fff0b0');
  g.fillStyle = bodyG; g.beginPath(); g.moveTo(104, 68); g.bezierCurveTo(112, 50, 140, 46, 156, 56); g.bezierCurveTo(160, 64, 146, 78, 124, 78); g.bezierCurveTo(112, 78, 104, 74, 104, 68); g.fill();
  // the neck, an S up to the head
  g.strokeStyle = bodyG; g.lineCap = 'round'; g.lineWidth = 11; g.beginPath(); g.moveTo(150, 58); g.bezierCurveTo(166, 50, 160, 34, 176, 28); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(170, 30); g.lineTo(182, 26); g.stroke();
  g.fillStyle = '#fff0b8'; g.beginPath(); g.ellipse(184, 25, 8, 6.5, -0.2, 0, 6.28); g.fill();   // the head
  g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(190, 22); g.quadraticCurveTo(202, 23, 204, 30); g.quadraticCurveTo(198, 27, 190, 29); g.fill();   // the hooked beak
  g.fillStyle = '#c8102a'; g.beginPath(); g.moveTo(186, 30); g.quadraticCurveTo(184, 38, 180, 40); g.quadraticCurveTo(182, 33, 182, 29); g.fill();   // the wattle
  g.fillStyle = '#3a0a04'; g.beginPath(); g.arc(187, 23.5, 1.9, 0, 6.28); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(187.6, 23, 0.6, 0, 6.28); g.fill();
  for (const [dx, h, c] of [[-4, 20, '#ff5a1e'], [0, 24, '#ffb43a'], [4, 17, '#ff7a2a']]) {   // the crest: three curling plumes, a bead at each tip
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(182 + dx * 0.3, 19); g.bezierCurveTo(178 + dx, 8, 170 + dx, 19 - h * 0.6, 166 + dx, 19 - h); g.stroke();
    g.fillStyle = '#ffe070'; g.beginPath(); g.arc(166 + dx, 19 - h, 2.2, 0, 6.28); g.fill();
  }
  g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 0.8;   // a few strokes of breast feathers
  for (let i = 0; i < 9; i++) { const x = 120 + i * 4, y = 64 + Math.sin(i) * 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y + 4, x + 1, y + 8); g.stroke(); }
  wing(false);
}
async function jifaLevel(a, P) {
  const { right } = axes();
  a.u.facing = 'down'; LV.cast(a, 0);
  vfx.decal(P, [1, 0.8, 0.4], 1.2, 3.4, { intensity: 0.4 });
  const bird = card(once('phoenix', () => glowStrip(256, 128, 2, 'rgba(255,170,60,0.95)', (g, i) => drawPhoenix(g, i === 0))), 1.5, 0.75, { col: [1.2, 1.1, 1] });
  const tails = [[1, 0.75, 0.25], [1, 0.35, 0.12]].map(col => vfx.ribbon({ col, width: 0.09, n: 30 }));
  let prev = null;
  // it is born out of his breast in a burst of gold, small, and spirals out and up round him as it grows
  const chest = a.chest(), { toCam } = axes();
  // its course, by the angle round him as seen on screen (0 in front, + to his right); it circles clockwise as we see it
  const round = (f, r, y) => P.clone().addScaledVector(right, Math.sin(f) * r).addScaledVector(toCam, Math.cos(f) * r).setY(y);
  vfx.flash([1, 0.85, 0.5], 0.15); vfx.light(chest, [1, 0.8, 0.4], 10, 0.6, 5);
  vfx.burst(chest, { n: 24, speed: 1.6, cols: [[1, 1, 0.8], [1, 0.7, 0.25]], size: 0.05, life: 0.6, g: 0, shape: 0 });
  const at = k => round(Math.PI / 4 + (1 - k) * Math.PI * 2.5, 0.12 + 1.0 * Math.min(1, k * 1.6) ** 0.8, chest.y + Math.sin(k * Math.PI) * 0.9 + Math.sin(k * 9) * 0.06);   // up round him and down again to his front right   // ends at his front right
  await anim(1.8, (k, dt = 1 / 60) => {
    const q = at(k); bird.position.copy(q); bird.scale.setScalar(0.3 + 0.7 * Math.min(1, k * 2.2));
    const mv = prev ? q.clone().sub(prev) : V(1, 0, 0); prev = q;
    face(bird, mv.dot(right) < 0 ? -1 : 1); bird.material.map.offset.x = (k * 9) % 1 < 0.5 ? 0 : 0.5; bird.material.opacity = Math.min(1, k * 10);
    tails.forEach((t, j) => t.push(q.clone().add(V(0, -0.05 - j * 0.06, 0))));
    if (Math.random() < dt * 14) vfx.smoke(q.x, q.y, q.z, { vy: -rand(0.3, 0.6), life: 1.8, size: 0.09, r: 1, gg: rand(0.7, 0.9), b: 0.35, a: 1, shape: 2, spin: rand(-1, 1), wob: 1, ph: rand(0, 6) });   // feathers drifting down
    if (k > 0.45) LV.cast(a, 1);
  });
  // it soars away; a ring of gold spreads at his feet and light falls over him
  // on round its course: from his front right it sweeps across before him and away up to the left, rising and fading,
  // at the pace it came down at, evenly along the way (it slowed to a third at the bottom [the user's report])
  const sweep = k => round(Math.PI / 4 - k * Math.PI * 1.15, 1.1 + k * 1.4, chest.y + k * 2.2);   // a long, wide sweep, climbing gently
  const S = [0]; for (let i = 1; i <= 64; i++) S.push(S[i - 1] + sweep(i / 64).distanceTo(sweep((i - 1) / 64)));
  const along = k => { const s = k * S[64]; let i = 1; while (i < 64 && S[i] < s) i++; return (i - 1 + (s - S[i - 1]) / (S[i] - S[i - 1] || 1)) / 64; };
  const pace = at(1).distanceTo(at(0.995)) / (0.005 * 1.8), dur = S[64] / pace;
  await anim(dur, k => {
    const q = sweep(along(k)), mv = q.clone().sub(bird.position);
    bird.position.copy(q); face(bird, mv.dot(right) < 0 ? -1 : 1); bird.material.map.offset.x = (k * dur * 3.75) % 1 < 0.5 ? 0 : 0.5;   // (wingbeats as before: 6 in 1.6 s)
    bird.material.opacity = 1 - Math.max(0, k - 0.7) / 0.3; tails.forEach((t, j) => t.push(q.clone().add(V(0, -0.05 - j * 0.06, 0))));
  });
  tails.forEach(t => t.end()); drop(bird);
  const crown = a.head().add(V(0, 0.25, 0));
  vfx.ring(P, [1, 0.85, 0.4], 0.8, 1, { intensity: 1.2 });   // a ring of gold spreading at his feet
  vfx.light(crown, [1, 0.85, 0.5], 10, 0.8, 5); vfx.burst(crown, { n: 22, speed: 1.4, cols: [[1, 1, 0.8], [1, 0.8, 0.35]], size: 0.05, life: 0.7, g: 0.6, shape: 0 });
  await wait(700);
}


// 雷震子's wingbeat: his spread-wing cast frame with the wings cut off at the shoulders and turned about them, the body
// held still (the frames he has move his arms and legs with his wings: as a flap they read as cramps)
const LEI_WINGS = [   // [cut polygon, shoulder pivot] in his 128 px frame (act row 2, frame 7)
  [[[0, 8], [33, 16], [33, 46], [25, 52], [0, 62]], [32, 38], 1],
  [[[87, 10], [128, 10], [128, 62], [112, 70], [97, 59], [87, 48]], [90, 40], -1],
];
export function leiFlapFrames(a, n) {
  const src = a.texAct.image, fw = src.width / 9, k = fw / 128;
  const frame = (clip) => { const c = document.createElement('canvas'); c.width = c.height = fw; const g = c.getContext('2d'); g.scale(k, k);
    g.beginPath(); for (const poly of clip.polys) { poly.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); }
    if (clip.keep) g.clip(); g.drawImage(src, 7 * fw, 2 * fw, fw, fw, 0, 0, 128, 128);
    if (!clip.keep) { g.globalCompositeOperation = 'destination-out'; g.fill(); } return c; };
  const body = frame({ polys: LEI_WINGS.map(w => w[0]), keep: false }), wings = LEI_WINGS.map(w => frame({ polys: [w[0]], keep: true }));
  return Array.from({ length: n }, (_, i) => {
    const ang = Math.sin(i / n * Math.PI * 2) * 0.32;   // up and down through one beat
    const c = document.createElement('canvas'); c.width = c.height = 256 * k; const g = c.getContext('2d'); g.scale(k, k); g.translate(64, 64);
    LEI_WINGS.forEach(([, [px, py], s], j) => { g.save(); g.translate(px, py); g.rotate(ang * s); g.translate(-px, -py); g.drawImage(wings[j], 0, 0, fw, fw, 0, 0, 128, 128); g.restore(); });
    g.drawImage(body, 0, 0, fw, fw, 0, 0, 128, 128);
    return tex(c);
  });
}

// ---------------------------------------------------------------- 雷震子: 姬昌's hundredth son, born in a thunderstorm
// his wings lift him slowly, wind and thunder wrapped round him in the air; storm clouds gather and lightning strikes his golden
// staff; he dives and drives it into the ground, and the thunder runs out along the earth in every direction
async function leiLevel(a, P) {
  const BOLT = [0.3, 0.36, 0.55];
  a.u.facing = 'down';
  // his wings beat, slow and even, his body still and facing us
  const FLAP = once('leiflap', () => leiFlapFrames(a, 12));
  let F = 0; const flap = (dt, hz) => { F += dt * hz; a.act = { kind: 'tex', tex: FLAP[Math.floor(F * FLAP.length) % FLAP.length] }; };
  flap(0, 0);
  // the wings beat: he rises slowly, wrapped in his wind and thunder; it stays round him while he hangs in the air
  const winds = [0, 1, 2].map(() => vfx.ribbon({ col: [0.75, 0.85, 1], width: 0.045, n: 22, fade: 0.4 }));
  for (let i = 0; i < 10; i++) { const t = i / 10 * 6.28; vfx.smokePuff(P.x + Math.cos(t) * 0.3, P.y + 0.05, P.z + Math.sin(t) * 0.3, { vx: Math.cos(t) * 1.6, vz: Math.sin(t) * 1.6, vy: 0.1, drag: 2.5, life: 0.8, size: 0.2, size1: 0.55, tint: [0.62, 0.56, 0.46] }); }
  let T = 0;
  const windAndThunder = (dt, crackle) => {   // three streams of wind circling him at his height, and lightning crackling off his wings
    T += dt; const c = a.chest();
    winds.forEach((w, j) => { const th = T * 9 + j * 2.1, r = 0.55 + j * 0.1; w.push(V(c.x + Math.cos(th) * r, c.y - 0.35 + j * 0.3 + Math.sin(T * 4 + j) * 0.08, c.z + Math.sin(th) * r)); });
    if (Math.random() < dt * crackle) { const s = Math.random() < 0.5 ? -1 : 1, from = c.clone().add(V(s * 0.3, 0.15, 0)); vfx.bolt(from, from.clone().add(V(s * rand(0.3, 0.6), rand(-0.3, 0.4), rand(-0.3, 0.3))), BOLT, 0.09, { width: 0.016, jag: 0.4 }); }
    if (Math.random() < dt * 12) vfx.spark(c.x + rand(-0.5, 0.5), c.y + rand(-0.4, 0.4), c.z + rand(-0.3, 0.3), { vy: rand(-0.2, 0.3), life: 0.3, size: 0.04, r: 0.75, gg: 0.85, b: 1, shape: 0, flicker: 1, ph: rand(0, 9) });
  };
  await anim(1.6, (k, dt = 1 / 60) => { a.hover = ease(k) * 1.0; windAndThunder(dt, 3 + k * 6); flap(dt, 1.2); });
  // the storm: dark cloud gathers over him and the lightning strikes his raised staff
  for (let i = 0; i < 14; i++) { const t = rand(0, 6.28), r = rand(0, 1.1); vfx.smokePuff(P.x + Math.cos(t) * r, P.y + 2.7 + rand(-0.15, 0.25), P.z + Math.sin(t) * r, { vx: -Math.cos(t) * 0.3, vz: -Math.sin(t) * 0.3, vy: 0, life: 1.8, size: 0.55, size1: 1.0, tint: [0.16, 0.17, 0.23] }); }
  await anim(0.4, (k, dt = 1 / 60) => { windAndThunder(dt, 8); flap(dt, 1.0); });
  const top = a.head().add(V(0, 0.3, 0));
  vfx.bolt(P.clone().setY(P.y + 2.7), top, BOLT, 0.3, { width: 0.06 }); vfx.flash([0.75, 0.8, 1], 0.25); vfx.light(top, [0.7, 0.8, 1], 10, 0.4, 6);
  await anim(0.45, (k, dt = 1 / 60) => { windAndThunder(dt, 25); flap(dt, 1.0); });
  // the lightning bursts behind him: a star of bolts against the sky at his back
  const { right, toCam } = axes(), B = a.chest().addScaledVector(toCam, -0.45).add(V(0, 0.15, 0));
  vfx.flash([0.8, 0.85, 1], 0.3); vfx.shake(0.12, 0.3); vfx.light(B, [0.7, 0.8, 1], 14, 0.6, 7);
  vfx.ring(B, [0.6, 0.75, 1], 1.4, 0.5, { vertical: true, yaw: cam.yaw, y: B.y, intensity: 1.2 });
  for (let i = 0; i < 12; i++) { const t = i / 12 * 6.28 + rand(-0.12, 0.12), l = rand(1.1, 1.8), q = B.clone().addScaledVector(right, Math.cos(t) * l).add(V(0, Math.sin(t) * l, 0)).addScaledVector(toCam, -0.2);
    vfx.bolt(B, q, BOLT, 0.4, { width: 0.035, jag: 0.3 }); vfx.burst(q, { n: 4, speed: 1, cols: [[0.9, 0.95, 1], [0.6, 0.7, 1]], size: 0.04, life: 0.4, g: 0, shape: 0 }); }
  vfx.burst(B, { n: 30, speed: 2.6, cols: [[1, 1, 1], [0.7, 0.8, 1]], size: 0.05, life: 0.6, g: 0, shape: 0 });
  await anim(0.35, (k, dt = 1 / 60) => { windAndThunder(dt, 10); flap(dt, 1.0); });
  // and he comes gently back down, still beating his wings; the wind and thunder die away round him as he sinks
  await anim(1.4, (k, dt = 1 / 60) => {
    a.hover = 1.0 * (1 - ease(k)); flap(dt, 1.0 - k * 0.4);
    for (const w of winds) w.o.width = 0.045 * (1 - k);
    windAndThunder(dt, 8 * (1 - k) * (1 - k));
  });
  for (const w of winds) { w.o.fade = 0.3; w.end(); }
  a.hover = 0; a.act = { kind: 'tex', tex: FLAP[0] };
  for (let i = 0; i < 8; i++) { const t = i / 8 * 6.28; vfx.smokePuff(P.x + Math.cos(t) * 0.25, P.y + 0.05, P.z + Math.sin(t) * 0.25, { vx: Math.cos(t) * 0.9, vz: Math.sin(t) * 0.9, vy: 0.05, drag: 2.5, life: 0.6, size: 0.15, size1: 0.4, tint: [0.62, 0.56, 0.46] }); }
  await wait(500);
}

// ---------------------------------------------------------------- 姜子牙: the old sage of 磻溪, 元始天尊's disciple
// he raises his staff and the 杏黃旗 rises beside him and unfurls; where it waves, golden lotuses bloom round him in a dome
// (in the story the banner shields its bearer with ten thousand golden lotuses), then fade where they bloomed
function goldLotusTex() { return canvasTex(128, 96, g => {
  g.shadowColor = 'rgba(255,200,80,0.9)'; g.shadowBlur = 8;
  const petal = (ang, len, wide, col) => { g.save(); g.translate(64, 84); g.rotate(ang); const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, '#fff6d0'); gr.addColorStop(1, col); g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-wide, -len * 0.4, -wide * 0.6, -len * 0.85, 0, -len); g.bezierCurveTo(wide * 0.6, -len * 0.85, wide, -len * 0.4, 0, 0); g.fill(); g.restore(); };
  for (const a of [-1.0, -0.5, 0, 0.5, 1.0]) petal(a, 62, 18, '#ffc030');    // the back row
  for (const a of [-1.25, -0.62, 0.62, 1.25]) petal(a, 50, 16, '#ffaa10');   // the front row, wider open
  petal(0, 46, 14, '#ffd860');
}); }
export function bannerTex() { return canvasTex(128, 176, g => {   // apricot-yellow silk, a dark trim, the eight trigrams round a taiji, tassels below
  g.fillStyle = '#f2b23a'; g.fillRect(0, 0, 128, 160); g.strokeStyle = '#a8601a'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 152);
  g.save(); g.translate(64, 78);
  g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(0, 0, 22, 0, 6.28); g.fill();
  g.fillStyle = '#3a2410'; g.beginPath(); g.arc(0, 0, 22, -Math.PI / 2, Math.PI / 2); g.arc(0, 11, 11, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -11, 11, Math.PI / 2, -Math.PI / 2); g.fill();
  g.beginPath(); g.arc(0, -11, 3.5, 0, 6.28); g.fill(); g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(0, 11, 3.5, 0, 6.28); g.fill();
  g.fillStyle = '#3a2410';
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * 6.28); for (let j = 0; j < 3; j++) { const broken = (i >> j) & 1; if (broken) { g.fillRect(-9, -42 + j * 6, 7, 3); g.fillRect(2, -42 + j * 6, 7, 3); } else g.fillRect(-9, -42 + j * 6, 18, 3); } g.restore(); }
  g.restore();
  g.fillStyle = '#c0281a'; for (let x = 10; x < 124; x += 14) { g.fillRect(x, 158, 5, 14); g.beginPath(); g.arc(x + 2.5, 172, 4, 0, 6.28); g.fill(); }
}); }
async function jiangLevel(a, P) {
  const { right, toCam } = axes();
  a.u.facing = 'down'; LV.cast(a, 0);
  // the banner: it rises out of the ground behind him and unfurls
  const root = new THREE.Group(), H = 1.9, W = 0.62, CH = 0.86;
  root.rotation.y = Math.atan2(-right.z, right.x); const base = P.clone().addScaledVector(right, -0.28).addScaledVector(toCam, -0.5);   // behind him, the silk spread over his head
  base.y = P.y;   // at his level (behind him may be a void or a wall); was inside the comment above: height 0 on any raised cell
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, H, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.12, 0.06) })); pole.position.y = H / 2;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3), toneMapped: false })); knob.position.y = H + 0.03;
  const cg = new THREE.PlaneGeometry(W, CH, 12, 6); cg.translate(W / 2, H - 0.08 - CH / 2, 0); const rest = cg.attributes.position.array.slice();
  const cloth = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: once('banner', bannerTex), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 }));
  root.add(pole, knob, cloth); root.position.copy(base).add(V(0, -H, 0)); cloth.scale.x = 0.05;
  let T = 0;
  vfx.timed(root, 1e9, (k, dt) => { T += dt; const pa = cg.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) { const x = rest[i], f = x / W; pa[i + 2] = Math.sin(x * 8 - T * 7) * 0.07 * f + Math.sin(rest[i + 1] * 6 - T * 4) * 0.02 * f; }
    cg.attributes.position.needsUpdate = true; });
  vfx.burst(base.clone().setY(base.y + 0.1), { n: 14, speed: 1.4, cols: [[1, 0.95, 0.7], [1, 0.8, 0.35]], size: 0.05, life: 0.5, g: 2, up: 0.5, shape: 0 });
  await anim(0.4, k => { root.position.y = base.y - H * (1 - ease(k)); });
  await anim(0.35, k => { cloth.scale.x = 0.05 + 0.95 * ease(k); });
  // ten thousand golden lotuses: they bloom ring by ring round him, a dome of gold
  LV.cast(a, 1);
  const lot = once('goldlotus', goldLotusTex), blooms = [];
  for (const [n, r, y, d] of [[3, 0.58, 0.12, 0], [3, 0.5, 0.55, 220], [1, 0.34, 0.95, 440], [1, 0, 1.25, 620]]) {   // close round him
    for (let i = 0; i < n; i++) later(() => {
      const th = i / n * 6.28 + y, m = card(lot, 0.3, 0.22, { col: [1.2, 1.1, 0.9] }), q = V(P.x + Math.cos(th) * r, P.y + y, P.z + Math.sin(th) * r);
      m.position.copy(q); m.scale.setScalar(0.01); blooms.push({ m, q, t: 0 });
      vfx.spark(q.x, q.y, q.z, { vy: 0.3, life: 0.4, size: 0.08, r: 1, gg: 0.9, b: 0.5, shape: 0 });
    }, d + i * 18);
  }
  vfx.light(P.clone().setY(P.y + 0.8), [1, 0.85, 0.45], 10, 1.6, 5);
  await anim(1.3, (k, dt = 1 / 60) => { for (const b of blooms) { b.t += dt; const s = Math.min(1, b.t / 0.25), o = s < 1 ? s * (1 + 0.3 * Math.sin(s * Math.PI)) : 1; b.m.scale.setScalar(o); b.m.position.copy(b.q); b.m.position.y += Math.sin(b.t * 3 + b.q.x * 5) * 0.03; face(b.m); } });
  // they fade where they bloomed; the banner furls and sinks away
  await anim(0.6, (k, dt = 1 / 60) => {
    for (const b of blooms) { b.m.material.opacity = 1 - k; face(b.m); }
    cloth.scale.x = 1 - 0.95 * k; root.position.y = base.y - H * k * k;
  });
  blooms.forEach(b => drop(b.m)); drop(root);
  await wait(300);
}

// ---------------------------------------------------------------- 黃天化: 黃飛虎's son, 清虛道德真君's proud disciple
// a flourish of the blade, then the 攢心釘: seven golden nails flung high come down in a ring round him (half as wide again
// as his cell); jade light (the colour of his 玉麒麟) traces a seven-pointed star between them and rises as a wall of light
async function tianhuaLevel(a, P) {
  const { toCam } = axes(), nails = [];
  a.u.facing = 'down';
  for (let r = 0; r < 2; r++) for (const f of [0, 1, 2]) { LV.atk(a, f); await wait(70); }   // a flourish of the blade
  LV.cast(a, 0); await wait(150);
  const hand = a.chest().add(V(0, 0.3, 0)), th0 = Math.atan2(toCam.z, toCam.x);
  for (let i = 0; i < 7; i++) {
    const th = th0 + i / 7 * 6.28, end = V(P.x + Math.cos(th) * 0.6, 0, P.z + Math.sin(th) * 0.6);   // a ring half as wide again as his cell
    end.y = P.y;   // at his level, as every level-up keeps (a nail over a void or a wall beside him neither sinks nor perches); was inside the comment above: height 0 on any raised cell
    const trail = vfx.ribbon({ col: [0.85, 0.45, 0.04], width: 0.05, n: 12 });
    const nail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.58, 6),   // (1.6 times the size they were, and thrown higher [the user's call])
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3), toneMapped: false })); vfx.timed(nail, 1e9, () => {});
    nails.push({ nail, end, th });
    const peak = hand.clone().lerp(end, 0.5).add(V(0, 3.6, 0)), last = V(0, 0, 0);   // (the curve's top: half of that over his hand)
    later(() => anim(0.75, k => {   // a high arc, point first, down into the earth
      const q = hand.clone().lerp(peak, k).lerp(peak.clone().lerp(end, k), k); q.y += 0.11 * (1 - k);
      if (k > 0) nail.quaternion.setFromUnitVectors(V(0, 1, 0), q.clone().sub(last).normalize().negate().multiplyScalar(-1)); last.copy(q);
      nail.position.copy(q); trail.push(q);
    }).then(() => { trail.end(); nail.position.copy(end).add(V(0, 0.21, 0)); nail.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, -1, 0));
      vfx.burst(end.clone().setY(end.y + 0.05), { n: 8, speed: 0.7, cols: [[1, 0.95, 0.6], [1, 0.75, 0.25]], size: 0.035, life: 0.35, g: 3, up: 0.6, shape: 0 }); vfx.decal(end, [1, 0.7, 0.3], 0.12, 0.8, { intensity: 0.7 }); }), i * 70);
  }
  await wait(1200); LV.cast(a, 1);
  // jade light traces a seven-pointed star between the nails, then rises round him
  const star = vfx.ribbon({ col: [0.08, 0.75, 0.3], width: 0.035, n: 60, fade: 0.6 }), order = [0, 3, 6, 2, 5, 1, 4, 0];
  for (const n of nails) n.nail.material.color.setRGB(0.5, 1, 0.65);
  await anim(0.6, k => { const f = k * 7, i = Math.min(6, Math.floor(f)), u = f - i, A = nails[order[i]].end, B = nails[order[i + 1]].end; star.push(A.clone().lerp(B, u).add(V(0, 0.06, 0))); });
  star.end();
  vfx.pillar(P, [0.2, 0.9, 0.45], 0.66, 1.8, 1.0, { intensity: 0.3, grow: 1 }); vfx.ring(P, [0.15, 0.85, 0.4], 0.7, 0.7, { intensity: 1 });
  for (const n of nails) { vfx.burst(n.end.clone().setY(n.end.y + 0.1), { n: 6, speed: 0.5, cols: [[0.8, 1, 0.85], [0.35, 1, 0.6]], size: 0.035, life: 0.5, g: -1, shape: 0 }); drop(n.nail); }
  LV.atk(a, 2); await wait(800);
}


// ---------------------------------------------------------------- 土行孫: the little earth-walker, mute but sharp
// he hops, dives into the earth, and the mound of his burrowing runs a heart on the ground (he is smitten with 小龍女);
// he bursts out where he went in, fist up, chattering in the only speech he has, little hearts rising
const heartTex = () => canvasTex(64, 64, g => { g.shadowColor = 'rgba(255,120,170,0.9)'; g.shadowBlur = 6; g.fillStyle = '#ff6fa8';
  g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 36, 6, 10, 22, 10); g.bezierCurveTo(28, 10, 32, 16, 32, 20); g.bezierCurveTo(32, 16, 36, 10, 42, 10); g.bezierCurveTo(58, 10, 60, 36, 32, 54); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(22, 20, 5, 3.5, -0.6, 0, 6.28); g.fill(); });
async function tuLevel(a, P) {
  const { right, toCam } = axes(), DIRT = [0.5, 0.42, 0.32];
  const dirt = (q, n, sp) => { for (let i = 0; i < n; i++) { const t = rand(0, 6.28), v = rand(0.5, 1) * sp; vfx.smokePuff(q.x, q.y + 0.08, q.z, { vx: Math.cos(t) * v, vz: Math.sin(t) * v, vy: rand(0.3, 0.6), drag: 2.5, life: rand(0.7, 1), size: 0.22, size1: 0.6, tint: DIRT }); } };
  a.u.facing = 'down'; LV.guard(a);
  await anim(0.3, k => { a.lift = Math.abs(Math.sin(k * Math.PI * 2)) * 0.25; });   // two cheeky hops
  // down into the earth
  await anim(0.3, k => { a.lift = -k * 0.9; a.fade = 1 - k; }); dirt(P, 10, 1.6);
  // the mound runs a heart round him on the ground, glowing pink where it passed
  const heart = t => { const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return P.clone().addScaledVector(right, x / 16 * 1.1).addScaledVector(toCam, -(y + 4) / 16 * 1.1); };
  let lastDecal = -1;
  await anim(1.4, (k, dt = 1 / 60) => {
    const q = heart(k * Math.PI * 2); q.y = effectH(q.x, q.z);
    if (Math.random() < dt * 30) vfx.smokePuff(q.x + rand(-0.06, 0.06), q.y + 0.06, q.z + rand(-0.06, 0.06), { vy: rand(0.2, 0.5), life: 0.7, size: 0.13, size1: 0.32, tint: DIRT });
    if (Math.random() < dt * 25) vfx.burst(q.clone().setY(q.y + 0.05), { n: 2, speed: 0.8, cols: [DIRT, [0.62, 0.52, 0.38]], size: 0.04, life: 0.4, g: 8, up: 0.8, shape: 0 });
    const step = Math.floor(k * 56); if (step !== lastDecal) { lastDecal = step; vfx.decal(q, [1, 0.3, 0.55], 0.17, 2.0 - k * 1.2, { intensity: 1.3 }); }
  });
  // out he bursts, fist up, chattering
  vfx.shake(0.12, 0.25); dirt(P, 16, 2.4); LV.atk(a, 2);
  vfx.burst(P.clone().setY(P.y + 0.2), { n: 30, speed: 3.5, cols: [DIRT, [0.65, 0.55, 0.4], [1, 0.8, 0.45]], size: 0.06, life: 0.8, g: 10, up: 0.8, shape: 0 });
  await anim(0.35, k => { a.fade = 1; a.lift = -0.9 + Math.sin(k * Math.PI * 0.75) * 1.5; });
  await anim(0.3, k => { a.lift = 0.6 * (1 - k * k); }); a.lift = 0;
  ui.floater(a.head().add(V(0, 0.35, 0)), '＃％＄！', 'dmg text', 1.4);
  const ht = once('heart', heartTex);
  for (let i = 0; i < 5; i++) later(() => { const m = card(ht, 0.24, 0.24), q0 = a.head().addScaledVector(right, rand(-0.35, 0.35)), ph = rand(0, 6);
    anim(1.1, k => { m.position.copy(q0).add(V(Math.sin(k * 5 + ph) * 0.08, k * 0.8, 0)); face(m); m.material.opacity = Math.min(1, k * 6) * (1 - k); }).then(() => drop(m)); }, i * 120);
  await wait(900);
}

// ---------------------------------------------------------------- 小龍女: the sea dragon king's gentle daughter
// water rings rise round her; a slender blue dragon breaks from the ground in a spout of water, spirals up round her
// in a stream of water and spray and away into the sky [the user's call: up, not back down, with water along it], leaving
// its pearl glowing over her head, and a soft glittering rain falls from where it went
export function dragonHeadTex() { return canvasTex(160, 96, g => {   // side on, facing right
  g.shadowColor = 'rgba(120,200,255,0.9)'; g.shadowBlur = 8;
  const scale = g.createLinearGradient(0, 20, 0, 80); scale.addColorStop(0, '#bff0ff'); scale.addColorStop(1, '#2a7ad8');
  g.strokeStyle = '#e8fbff'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(70, 34); g.quadraticCurveTo(48, 10, 26, 8); g.stroke(); g.beginPath(); g.moveTo(80, 32); g.quadraticCurveTo(66, 6, 48, 2); g.stroke();   // antlers
  g.fillStyle = '#5ac8ff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40 + i * 8, 44); g.lineTo(28 + i * 8, 26 + (i % 2) * 6); g.lineTo(46 + i * 8, 40); g.fill(); }   // mane
  g.fillStyle = scale; g.beginPath(); g.moveTo(30, 60); g.quadraticCurveTo(60, 26, 100, 32); g.lineTo(148, 42); g.quadraticCurveTo(152, 50, 144, 54); g.lineTo(108, 56);
  g.lineTo(140, 66); g.quadraticCurveTo(132, 76, 104, 70); g.quadraticCurveTo(70, 80, 30, 72); g.closePath(); g.fill();   // the long snout, jaw open
  g.shadowBlur = 0; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(112, 56); g.lineTo(116, 62); g.lineTo(120, 56); g.fill(); g.beginPath(); g.moveTo(126, 55); g.lineTo(129, 60); g.lineTo(132, 55); g.fill();
  g.fillStyle = '#ffe070'; g.beginPath(); g.ellipse(92, 42, 5, 3.5, -0.2, 0, 6.28); g.fill(); g.fillStyle = '#10204a'; g.beginPath(); g.arc(93, 42, 1.8, 0, 6.28); g.fill();
  g.strokeStyle = '#e8fbff'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, 52); g.bezierCurveTo(150, 70, 128, 84, 138, 94); g.stroke(); g.beginPath(); g.moveTo(132, 50); g.bezierCurveTo(118, 66, 100, 72, 96, 90); g.stroke();   // whiskers
}); }
async function longnvLevel(a, P) {
  const { right, toCam } = axes();
  a.u.facing = 'down'; LV.guard(a);   // (her cast frames are a back view and a frame with the original's spell swirl drawn in)
  for (let i = 0; i < 3; i++) later(() => vfx.ring(P, [0.45, 0.8, 1], 1.2 + i * 0.4, 0.8, { intensity: 0.8 }), i * 150);
  await anim(0.4, k => { for (let i = 0; i < 3; i++) { const t = rand(0, 6.28), r = rand(0.6, 0.9); vfx.spark(P.x + Math.cos(t) * r, P.y + 0.05, P.z + Math.sin(t) * r, { vy: rand(1, 2), g: 4, life: 0.6, size: rand(0.04, 0.06), r: 0.75, gg: 0.92, b: 1, shape: 0 }); } });
  // the dragon: its silken body follows its head out of the earth, round her and up into the sky
  const body = clothStrip({ col: [0.2, 0.55, 1], width: 0.1, n: 36 }), glow = vfx.ribbon({ col: [0.35, 0.7, 1], width: 0.05, n: 30 }), head = card(once('dragonhead', dragonHeadTex), 0.65, 0.39);
  const th0 = Math.atan2(toCam.z, toCam.x) + 0.6, pq = a.head().add(V(0, 0.4, 0));
  const path = k => {   // up out of the ground, two turns climbing round her, then on up, tighter and faster, into the sky
    if (k < 0.72) { const u = k / 0.72, th = th0 + u * Math.PI * 4, r = 0.75 + Math.sin(u * Math.PI) * 0.1; return V(P.x + Math.cos(th) * r, P.y + 0.1 + u * 2.2, P.z + Math.sin(th) * r); }
    const u = (k - 0.72) / 0.28, th = th0 + Math.PI * 4 + u * Math.PI * 1.5, r = 0.75 * (1 - 0.6 * u);   // (climbing as fast as it was at first: 0.86 over u)
    return V(P.x + Math.cos(th) * r, P.y + 2.3 + u * 0.86 + u * u * 2.2, P.z + Math.sin(th) * r);
  };
  let prev = path(0);
  vfx.burst(prev.clone(), { n: 20, speed: 2, cols: [[0.9, 0.97, 1], [0.45, 0.75, 1]], size: 0.05, life: 0.6, g: 6, up: 0.8, shape: 0, floor: P.y + 0.02 });
  swirl(vfx, prev.clone().setY(P.y), [0.15, 0.45, 1], 0.32, 0.26, 1.3, 1.1, { speed: 3, twist: 6, foam: [0.85, 0.95, 1], intensity: 1 });   // the spout it breaks out of
  // water along it: two streams winding round its body, drops shaken off it falling to the ground, a fine mist behind
  const streams = [0, 1].map(() => vfx.ribbon({ col: [0.7, 0.92, 1], width: 0.055, n: 26 })), up = V(0, 1, 0), n1 = V(0, 0, 0), n2 = V(0, 0, 0);   // (read at play distance)
  await anim(1.8, (k, dt = 1 / 60) => {
    const q = path(k), mv = q.clone().sub(prev); prev = q;
    body.push(q); glow.push(q.clone().add(V(0, 0.02, 0)));
    const sx = mv.dot(right), flip = sx < 0 ? -1 : 1, pitch = Math.atan2(mv.y, Math.abs(sx) + 1e-4);
    head.position.copy(q).addScaledVector(up, 0.02); face(head, flip, pitch * flip * 0.8); head.material.opacity = 1 - Math.max(0, k - 0.86) / 0.14;
    const t = mv.lengthSq() > 1e-8 ? mv.clone().normalize() : up; n1.crossVectors(t, up); if (n1.lengthSq() < 1e-6) n1.copy(right); n1.normalize(); n2.crossVectors(t, n1);
    streams.forEach((st, j) => { const w = k * 42 + j * Math.PI; st.push(q.clone().addScaledVector(n1, Math.cos(w) * 0.2).addScaledVector(n2, Math.sin(w) * 0.2)); });
    for (let i = 0; i < 4; i++) if (Math.random() < dt * 30) vfx.spark(q.x + rand(-0.1, 0.1), q.y, q.z + rand(-0.1, 0.1), { vx: rand(-1.2, 1.2), vy: rand(0, 1.2), vz: rand(-1.2, 1.2), g: 6, life: rand(0.6, 1.1), size: rand(0.05, 0.09), r: 0.72, gg: 0.92, b: 1, shape: 0, floor: P.y + 0.02 });
    if (Math.random() < dt * 20) vfx.smoke(q.x, q.y, q.z, { vy: 0.1, life: 1.1, size: 0.3, size1: 0.7, r: 0.8, gg: 0.9, b: 1, a: 0.45, shape: -1 });
  });
  vfx.burst(prev.clone(), { n: 28, speed: 1.8, cols: [[0.9, 0.97, 1], [0.45, 0.75, 1]], size: 0.05, life: 0.9, g: 5, shape: 0, floor: P.y + 0.02 });   // a last spray where it goes
  drop(head); glow.end(); streams.forEach(st => st.end()); body.fade(0.3); LV.atk(a, 0);
  // its pearl glows over her head, and a soft glittering rain falls from the sky it went up into
  vfx.flash([0.8, 0.9, 1], 0.15); vfx.burst(pq, { n: 26, speed: 1.6, cols: [[0.9, 0.97, 1], [0.45, 0.75, 1]], size: 0.05, life: 0.7, g: 1, shape: 0 });
  vfx.ring(pq, [0.5, 0.8, 1], 0.5, 0.6, { vertical: true, yaw: cam.yaw, y: pq.y, intensity: 1 });
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.4, 1.6), toneMapped: false, transparent: true }));
  vfx.timed(pearl, 1e9, () => {});
  vfx.light(pq, [0.6, 0.85, 1], 8, 1.2, 5);
  await anim(1.1, (k, dt = 1 / 60) => {
    pearl.position.copy(pq).add(V(0, Math.sin(k * 6) * 0.04, 0)); pearl.material.opacity = Math.min(1, (1 - k) * 4);
    if (Math.random() < dt * 40) { const t = rand(0, 6.28), r = rand(0, 1.2); vfx.spark(P.x + Math.cos(t) * r, P.y + 2.8, P.z + Math.sin(t) * r, { vy: -rand(1.5, 2.2), life: 1.3, size: rand(0.03, 0.05), r: 0.8, gg: 0.93, b: 1, shape: 0, flicker: 1, ph: rand(0, 9) }); }
  });
  drop(pearl); await wait(300);
}

// ---------------------------------------------------------------- 燃燈道人: the cheerful old master of formations
// "leave it to me!": a tap of his staff and the twenty-four 定海珠 pearls tumble out and circle him, settle on the
// ground round him, and a line of light runs between them drawing a formation; a lamp flame kindles over his head
function formationTex() { return canvasTex(256, 256, g => {
  g.translate(128, 128); g.strokeStyle = '#ffd36a'; g.lineCap = 'round';
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 120, 0, 6.28); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 104, 0, 6.28); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i * 7 % 24) / 24 * 6.28; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 104, Math.sin(a) * 104); } g.stroke();   // the 24-point star
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 40, 0, 6.28); g.stroke();
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * 6.28); for (let j = 0; j < 3; j++) { const broken = (i >> j) & 1; if (broken) { g.fillStyle = '#ffd36a'; g.fillRect(-12, -70 + j * 7, 10, 3.5); g.fillRect(2, -70 + j * 7, 10, 3.5); } else { g.fillStyle = '#ffd36a'; g.fillRect(-12, -70 + j * 7, 24, 3.5); } } g.restore(); }
}); }
async function randengLevel(a, P) {
  const N = 24, R = 1.3, pearls = [];
  a.u.facing = 'down';
  for (const f of [0, 1, 2]) { LV.atk(a, f); await wait(90); }   // a tap of the staff
  vfx.ring(P, [1, 0.9, 0.6], 0.8, 0.4); LV.cast(a, 0);
  // the pearls tumble out one after another and circle him
  const pg = new THREE.SphereGeometry(0.05, 12, 8);
  for (let i = 0; i < N; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.25, 1.4), toneMapped: false })); m.visible = false; vfx.timed(m, 1e9, () => {}); pearls.push(m); }
  let T = 0;
  const orbit = (i, t) => { const th = i / N * 6.28 + t * 2.2, r = Math.min(R, 0.2 + t * 1.6); return V(P.x + Math.cos(th) * r, P.y + 0.75 + Math.sin(th * 3 + t * 3) * 0.06, P.z + Math.sin(th) * r); };
  await anim(1.1, (k, dt = 1 / 60) => { T += dt; pearls.forEach((m, i) => { const born = i * 0.03; if (T < born) return; m.visible = true; m.position.copy(orbit(i, T - born));
    if (Math.random() < dt * 4) vfx.spark(m.position.x, m.position.y, m.position.z, { life: 0.3, size: 0.05, r: 0.85, gg: 0.92, b: 1, shape: 0 }); }); });
  // they settle on the ground round him; a light runs between them and the formation shines out
  const from = pearls.map(m => m.position.clone()), spot = i => { const th = i / N * 6.28 + T * 2.2, q = V(P.x + Math.cos(th) * R, 0, P.z + Math.sin(th) * R); q.y = effectH(q.x, q.z) + 0.06; return q; };
  await anim(0.35, k => pearls.forEach((m, i) => m.position.copy(from[i]).lerp(spot(i), ease(k))));
  LV.cast(a, 1);
  const tracer = vfx.ribbon({ col: [1, 0.75, 0.25], width: 0.04, n: 40, fade: 0.4 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.3, R * 2.3), new THREE.MeshBasicMaterial({ map: once('formation', formationTex), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1, 0.8, 0.4) }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(P.x, P.y + 0.04, P.z); plate.renderOrder = 4; plate.material.opacity = 0; vfx.timed(plate, 1e9, (k, dt) => { plate.rotation.z += dt * 0.25; });
  await anim(0.8, k => { const f = k * N, i = Math.floor(f), u = f - i, A = spot((i * 7) % N), B = spot(((i + 1) * 7) % N); tracer.push(A.lerp(B, u)); plate.material.opacity = k * 0.9; });
  tracer.end(); vfx.light(P.clone().setY(P.y + 0.3), [1, 0.8, 0.4], 10, 0.8, 5); vfx.ring(P, [1, 0.85, 0.45], R * 1.3, 0.6, { intensity: 0.8 });
  // the lamp: a flame kindles over his head and burns bright while the formation glows
  const lamp = () => a.head().add(V(0, 0.32, 0));
  vfx.light(lamp(), [1, 0.75, 0.35], 8, 1.1, 4);
  await anim(1.0, (k, dt = 1 / 60) => {
    const q = lamp(); vfx.flame(q.x, q.y, q.z, { size: 0.26 + Math.sin(k * 20) * 0.03, asp: 1.7, life: 0.2, vy: 0.4, tint: [1, 0.9, 0.6] });
    if (k > 0.6) { const f = (k - 0.6) / 0.4; plate.material.opacity = 0.9 * (1 - f); pearls.forEach(m => { m.position.y += dt * 1.2; m.scale.setScalar(1 - f); }); }
  });
  pearls.forEach(drop); drop(plate);
  await wait(250);
}

export const LEVEL_POSE = {
  // 林雲: he spins, closes his eyes, and a great blue sword of light rises at his back and shoots into the sky (linLevel)
  p0: (a, P) => linLevel(a, P),
  // 燕蓉: facing us, draws and looses an arrow into the sky that bursts into 天女散花, flowers of many colours
  p1: async (a, P) => {
    a.u.facing = 'down'; LV.atk(a, 0); await wait(250); LV.atk(a, 1); await wait(350); LV.atk(a, 2);   // facing the front, the arrow loosed skywards [the user's call; she turned her back before]
    const ar = arrowMesh([1, 0.75, 0.9], 0.5), from = a.chest().add(V(0, 0.3, 0)), rib = vfx.ribbon({ col: [1, 0.8, 0.9], width: 0.04, n: 14 });
    vfx.timed(ar, 0.45, k => { ar.position.copy(from).add(V(0, k * 3.2, 0)); rib.push(ar.position); }, () => {
      rib.end(); ar.visible = false; flowerRain(from.clone().add(V(0, 3.2, 0)), P);
    });
    await wait(500); a.u.facing = 'down'; a.act = null; await wait(1200);
  },
  // 楊戩: 二郎神, calm and all-seeing [the user's call: from his story]: silver mist gathers, the third eye opens on his brow and its
  // gold beam sweeps the field (nothing is hidden from it), 哮天犬 bounds out of the mist and runs round him, and he
  // finishes with one clean sweep of the three-pointed blade
  p2: (a, P) => yangLevel(a, P),
  // 黃飛虎: 武成王, the flying tiger: a spirit tiger bursts out of his chest at us and roars (huangLevel)
  p3: (a, P) => huangLevel(a, P),
  // 哪吒: the lotus child [the user's call: from his story]: a lotus opens under him (太乙真人 remade him from lotus after he gave
  // his life back to his parents), the 風火輪 flare at his feet and lift him spinning in his red 混天綾, he flings the 乾坤圈
  // round the field and snatches it back, and drops spear-first into a burst of fire that scatters the petals
  p4: (a, P) => nezhaLevel(a, P),
  // 姬發: 鳳鳴岐山, the phoenix of Zhou circles him (jifaLevel)
  p5: (a, P) => jifaLevel(a, P),
  // 雷震子: wind-and-thunder wings, a storm, a thunderclap through the earth (leiLevel)
  p6: (a, P) => leiLevel(a, P),
  // 姜子牙: the 杏黃旗 and its ten thousand golden lotuses (jiangLevel)
  jiang: (a, P) => jiangLevel(a, P),
  // 黃天化: the 攢心釘 and a jade seven-pointed star (tianhuaLevel)
  '0a76a2': (a, P) => tianhuaLevel(a, P),
  // 土行孫: dives and burrows a heart, bursts out chattering (tuLevel)
  '0aa86c': (a, P) => tuLevel(a, P),
  // 小龍女: the water dragon and its pearl (longnvLevel)
  '0d006e': (a, P) => longnvLevel(a, P),
  // 燃燈道人: the 定海珠 laid out as a formation, a lamp flame over his head (randengLevel)
  '0d2ad2': (a, P) => randengLevel(a, P),
};
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
