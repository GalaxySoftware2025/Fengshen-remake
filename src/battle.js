// 封神英傑傳 — the battle engine: camera, tile overlays, input, unit animations, actions and the turn loop for whichever
// battle rules.js has loaded. A battle's own presentation comes in as FX (src/battles/NN-*-fx.js), called with this
// module (E) so it can use the same camera, effects and animations.
import * as THREE from 'three';
import { World, groundH, rand, setLook, U as WU } from './world.js';
import { SpriteBank, Actor } from './actors.js';
import { VFX } from './vfx.js';
import { playSpell, playItem, arrowMesh, scripted } from './spells.js';
import { spriteKey } from './sprites.js';
import { UI, spellDesc, itemDesc } from './ui.js';
import * as R from './rules.js';
import * as E from './battle.js';
import { sfx, jingle } from './audio.js';
import { dress } from './sets.js';
const { D, G } = R;
const AD = globalThis.ANIM_DATA;
const $ = id => document.getElementById(id);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const tileCenter = (x, y) => { const p = V(x + 0.5, 0, y + 0.5); p.y = groundH(p.x, p.z); return p; };

// ---------------------------------------------------------------- engine
export let world, vfx, bank, ui, cam, FX = {};
export const actors = new Map();
export const actorOf = u => actors.get(u) || u.stand;   // stand: the arena's empty-tile target
// arena: 演武場 (src/testkit.js); test: the test toolbar over a battle; free: a hero can be put on any empty cell (both from
// battle/index.html, never set by the campaign)
export const opts = { auto: /auto/.test(location.hash), rescue: /rescue/.test(location.hash), arena: /[#&]arena\b/.test(location.hash),
  free: /[#&]free\b/.test(location.hash) && /battle=\d+/.test(location.hash) };
opts.go = /[#&]go\b/.test(location.hash);   // a test start straight into round 1 (src/main.js single)
opts.test = opts.arena || (/[#&]test\b/.test(location.hash) && /battle=\d+/.test(location.hash));

// tweens on game time (respects hit-stop and fast-forward)
const tweens = [];
export function anim(sec, fn) { return new Promise(res => tweens.push({ t: 0, d: Math.max(0.0001, sec), fn, res })); }
export const wait = ms => anim(ms / 1000);
let timeScale = 1;
export let gameT = 0;

// ---------------------------------------------------------------- camera rig
export class Cam {
  constructor(camera) {
    this.camera = camera; this.target = V(4, 0, 4); this.yaw = 0; this.pitch = 1.0; this.dist = 13;
    this.goal = { target: this.target.clone(), yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.user = { yaw: 0, pitch: 1.0, dist: 13 }; this.inShot = false; this.speed = 5.5;   // yaw 0: map x runs left to right, like the original
  }
  focus(p, snap) { this.goal.target.copy(p); if (!this.inShot) Object.assign(this.goal, { yaw: this.user.yaw, pitch: this.user.pitch, dist: this.user.dist }); if (snap) this.snap(); }
  shot(p, o) {
    this.inShot = true; this.goal.target.copy(p); this.speed = o.speed || 2.6;
    // fixed camera while playing: shots only pan, keeping the player's zoom (the title / intro shots pass free)
    this.goal.dist = o.free ? Math.max(o.dist || 9, 8) : this.user.dist;
    this.goal.yaw = o.free ? this.user.yaw + (o.yaw || 0) : this.user.yaw; this.goal.pitch = o.free ? (o.pitch || 0.5) : this.user.pitch;
  }
  release(p) { this.inShot = false; this.speed = 5.5; Object.assign(this.goal, { yaw: this.user.yaw, pitch: this.user.pitch, dist: this.user.dist }); if (p) this.goal.target.copy(p); }
  rotate() {}   // camera rotation removed: the battle keeps one fixed angle
  zoom(f) { this.user.dist = THREE.MathUtils.clamp(this.user.dist * f, 7, 26); if (!this.inShot) this.goal.dist = this.user.dist; }
  snap() { this.target.copy(this.goal.target); this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist; }
  update(dt, shake) {
    const k = 1 - Math.exp(-dt * this.speed);
    this.target.lerp(this.goal.target, k); this.yaw += (this.goal.yaw - this.yaw) * k; this.pitch += (this.goal.pitch - this.pitch) * k; this.dist += (this.goal.dist - this.dist) * k;
    const c = Math.cos(this.pitch) * this.dist, look = this.target.clone().add(V(0, 0.55, 0));
    this.camera.position.set(look.x + Math.sin(this.yaw) * c, look.y + Math.sin(this.pitch) * this.dist, look.z + Math.cos(this.yaw) * c);
    if (shake) this.camera.position.add(V(rand(-shake, shake), rand(-shake, shake), rand(-shake, shake)));
    this.camera.lookAt(look);
  }
}

// ---------------------------------------------------------------- tile overlays, cursor, path
// how light the ground of every cell is as built (sampled once per world, from straight above, lit, without fog):
// the move fill is white where the ground is dark (forest, shadowed rock) and dark grey where it is light (sand)
// dark ground (white move squares): under 0.16, or under 0.6 of the map's median where the whole battle is lit low (an
// evening battle's sand still takes the dark squares)
let groundLum = null, LUM_DARK = 0.16;
export function measureLight() {
  try {
    groundLum = smoothLum(measureGround()); const a = [...groundLum].filter(v => v > 0.01).sort((p, q) => p - q);
    LUM_DARK = Math.min(0.16, (a[a.length >> 1] || 1) * 0.6) * 0.8;   // (0.8: only ground clearly darker than the map's run; on battle 7's evenly dark night court a wall's shadow, 0.04 against 0.05 round it, turned two cells white: the user's report)
  }
  catch (e) { groundLum = null; }
}
// each cell's brightness averaged with its neighbours' (its own counted twice), so that a shadow's edge or a speck does
// not flip one cell's fill against the cells round it
function smoothLum(L) {
  const W = R.MAP_W, H = R.MAP_H, out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = L[y * W + x], n = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) { s += L[Y * W + X]; n++; } }
    out[y * W + x] = s / n;
  }
  return out;
}
function measureGround() {
  const W = R.MAP_W, H = R.MAP_H, K = 8, S = world.scene, rt = new THREE.WebGLRenderTarget(W * K, H * K);
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, 1, 200); cam.position.set(0, 80, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  cam.left = 0; cam.right = W; cam.top = 0; cam.bottom = -H; cam.position.set(0, 80, 0); cam.updateProjectionMatrix();
  const fog = S.fog; S.fog = null; const r = world.renderer, prev = r.getRenderTarget();
  r.setRenderTarget(rt); r.render(S, cam); r.setRenderTarget(prev); S.fog = fog;
  const px = new Uint8Array(W * K * H * K * 4); r.readRenderTargetPixels(rt, 0, 0, W * K, H * K, px); rt.dispose();
  const out = new Float32Array(W * H);
  for (let py = 0; py < H * K; py++) for (let qx = 0; qx < W * K; qx++) {
    const k = (py * W * K + qx) * 4, cx = Math.floor(qx / K), cy = Math.floor(py / K);   // row 0 is the image bottom: z = +H
    const lum = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
    out[(H - 1 - cy) * W + cx] += lum / (K * K);
  }
  return out;
}
// a tile's height: the highest ground in its cell, a little above, in steps of 0.1, so that neighbours on level
// ground lie at exactly one height (their overlap, a hair wide, is shaded once) and none sinks into a lump
const tileY = (x, y) => { let h = -99; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) h = Math.max(h, groundH(x + 0.1 + i * 0.4, y + 0.1 + j * 0.4)); return Math.ceil((h + 0.04) / 0.1) * 0.1; };
class Tiles {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1.01, 1.01); geo.rotateX(-Math.PI / 2);   // a hair over a cell: no seams between tiles
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, depthFunc: THREE.LessDepth,   // normal blending, tone-mapped: tints the ground without lighting it or blooming; depth: the overlap is not shaded twice
      uniforms: { uT: { value: 0 } },
      vertexShader: `attribute float aEdge; varying vec2 vUv; varying vec3 vC; varying float vEdge; void main(){ vUv = uv; vC = instanceColor; vEdge = aEdge; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vC; varying float vEdge;
        float bit(float n, float b){ return mod(floor(n / b), 2.0); }
        void main(){ vec2 c = abs(vUv - 0.5) * 2.0; float d = max(c.x, c.y);
          float edge = smoothstep(0.8, 0.9, d) * (1.0 - smoothstep(0.97, 1.0, d));
          float mv = step(0.5, vEdge);   // a move tile: a flat fill, no outline (white on dark ground, dark grey on light)
          float red = smoothstep(0.3, 0.6, vC.r - max(vC.g, vC.b));
          edge *= 1.0 - mv;
          float a = mix(0.11 + 0.02 * sin(uT * 2.5), 0.32, red) + edge * 0.5;
          vec3 col = vC * (0.55 + edge * 0.35);
          float lite = step(0.5, vC.r);
          col = mix(col, vC, mv); a = mix(a, mix(0.66, 0.4, lite), mv);
          float w = fwidth(d), hair = mv * (1.0 - lite) * smoothstep(1.0 - 1.8 * w, 1.0 - 0.8 * w, d);   // dark squares: a one-pixel black line keeps the cells apart
          col = mix(col, vec3(0.0), hair); a = mix(a, 0.92, hair);
          gl_FragColor = vec4(col, a); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 600); this.mesh.count = 0; this.mesh.renderOrder = 3; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    this.edge = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); geo.setAttribute('aEdge', this.edge);   // move tiles: sides on the range's outline
    scene.add(this.mesh); this.mat = mat;
    // cursor: four gold corners + a hovering marker
    const cc = document.createElement('canvas'); cc.width = cc.height = 64; const g = cc.getContext('2d'); g.fillStyle = '#ffe9a8';
    for (const [x, y] of [[0, 0], [52, 0], [0, 52], [52, 52]]) { g.fillRect(x, y + (y ? 8 : 0), 12, 4); g.fillRect(x + (x ? 8 : 0), y, 4, 12); }
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = THREE.NearestFilter;
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, color: new THREE.Color(1, 0.88, 0.6) }));
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.35) }));
    this.marker.scale.y = 1.6; this.cursor.renderOrder = 4; scene.add(this.cursor, this.marker); this.cursor.visible = this.marker.visible = false;
    const dg = new THREE.SphereGeometry(0.05, 8, 6);
    this.dots = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.85, 1) }), 40); this.dots.count = 0; this.dots.frustumCulled = false; scene.add(this.dots);
  }
  set(list) {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    list.slice(0, 600).forEach((t, i) => {
      const p = tileCenter(t.x, t.y), move = t.c === C.move; m.makeTranslation(p.x, tileY(t.x, t.y) + (t.lift || 0), p.z); this.mesh.setMatrixAt(i, m);
      c.setRGB(...(move && groundLum && groundLum[t.y * R.MAP_W + t.x] < LUM_DARK ? C.moveLite : t.c)); this.mesh.setColorAt(i, c);
      this.edge.array[i] = move ? 1 : 0;
    });
    this.mesh.count = Math.min(600, list.length); this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; this.edge.needsUpdate = true;
  }
  setCursor(x, y, quiet) { this.cur = x == null ? null : [x, y]; this.quiet = !!quiet; this.cursor.visible = this.marker.visible = x != null && !quiet; }   // quiet: keep the focus, hide the visuals (the target mark draws instead)
  setPath(path) {
    const m = new THREE.Matrix4(), pts = [];
    if (path) for (let i = 0; i < path.length - 1; i++) { const a = tileCenter(...path[i]), b = tileCenter(...path[i + 1]); for (let k = 0; k < 3; k++) pts.push(a.clone().lerp(b, k / 3)); }
    if (path && path.length) pts.push(tileCenter(...path[path.length - 1]));
    pts.slice(0, 40).forEach((p, i) => { m.makeTranslation(p.x, p.y + 0.12, p.z); this.dots.setMatrixAt(i, m); });
    this.dots.count = Math.min(40, pts.length); this.dots.instanceMatrix.needsUpdate = true;
  }
  update(t) {
    this.mat.uniforms.uT.value = t;
    if (this.cur) { const p = tileCenter(...this.cur); this.cursor.visible = !this.quiet; this.cursor.position.set(p.x, p.y + 0.07, p.z); this.cursor.scale.setScalar(1 + Math.sin(t * 5) * 0.04); const u = R.unitAt(...this.cur); this.marker.visible = !this.quiet && (!u || u !== G.active); this.marker.position.set(p.x, p.y + (u ? 1.45 : 0.55) + Math.sin(t * 3) * 0.06, p.z); this.marker.rotation.y = t * 2; }
  }
}
// the unit taking its turn: a crisp gold frame on its tile and a small pixel arrow overhead.
// Plain unlit colours below the bloom threshold, so the marker reads clearly without adding light to the scene.
// the active unit's arrow: a smooth down-pointing triangle with rounded corners, a dark rim and a bevelled face, drawn
// large (it is tinted by the side's colour, so the face is white to grey) and mip-mapped, sharp at any zoom
function arrowTex() {
  const W = 144, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tri = (inset, r) => {   // the triangle's outline, its corners rounded with radius r
    const P = [[10 + inset * 1.7, 12 + inset], [W - 10 - inset * 1.7, 12 + inset], [W / 2, H - 10 - inset * 2]];
    g.beginPath();
    for (let i = 0; i < 3; i++) { const a = P[i], b = P[(i + 1) % 3], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (i === 0) g.moveTo(m[0], m[1]); g.arcTo(b[0], b[1], (b[0] + P[(i + 2) % 3][0]) / 2, (b[1] + P[(i + 2) % 3][1]) / 2, r); }
    g.closePath();
  };
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  tri(0, 14); g.fillStyle = '#1a0f06'; g.fill();               // rim
  g.shadowColor = 'transparent';
  tri(8, 9); const f = g.createLinearGradient(0, 18, 0, H - 24); f.addColorStop(0, '#ffffff'); f.addColorStop(0.55, '#e6e6e6'); f.addColorStop(1, '#9a9a9a'); g.fillStyle = f; g.fill();   // face
  g.save(); tri(8, 9); g.clip();
  g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W / 2, H - 30); g.lineTo(28, 20); g.closePath(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();   // the lit left facet
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 20, W, 5);   // the top edge catches the light
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
class ActiveMark {
  constructor(scene) {
    // tile frame: a 1-texel outline with notched corners, drawn at 32px like the original tiles
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const g = fc.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(1, 1, 30, 30); g.clearRect(3, 3, 26, 26);
    g.fillStyle = '#fff'; g.fillRect(2, 2, 28, 1); g.fillRect(2, 29, 28, 1); g.fillRect(2, 2, 1, 28); g.fillRect(29, 2, 1, 28);
    for (const [x, y] of [[2, 2], [26, 2], [2, 26], [26, 26]]) g.fillRect(x, y, 4, 4);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 3, 26, 26);
    const ft = new THREE.CanvasTexture(fc); ft.magFilter = THREE.NearestFilter; ft.colorSpace = THREE.SRGBColorSpace;
    this.frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
    this.frame.renderOrder = 3;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex(), transparent: true, depthTest: false, toneMapped: false }));   // untoned: the side's colour stays saturated
    this.arrow.scale.set(0.3, 0.267, 1); this.arrow.renderOrder = 6;
    this.group = new THREE.Group(); this.group.add(this.frame, this.arrow); this.group.visible = false; scene.add(this.group);
  }
  update(t, a) {
    this.group.visible = !!a && a.dissolve === 0;
    if (!this.group.visible) return;
    const col = a.u.side === 'player' ? [1.0, 0.7, 0.16] : [0.95, 0.2, 0.12];
    this.frame.material.color.setRGB(...col); this.arrow.material.color.setRGB(...col, THREE.SRGBColorSpace);   // the arrow is untoned: its colour as written
    this.frame.material.opacity = 0.8 + Math.sin(t * 3) * 0.12;
    // the frame stays on the unit's tile; the arrow follows the sprite
    const p = tileCenter(a.u.x, a.u.y);
    this.frame.position.set(p.x - a.pos.x - a.off.x, p.y - a.pos.y + 0.04, p.z - a.pos.z - a.off.y); this.frame.visible = !a.walking;
    this.group.position.set(a.pos.x + a.off.x, a.pos.y, a.pos.z + a.off.y);
    this.arrow.visible = !a.act && !a.walking;
    this.arrow.position.y = 1.54 + a.hover + Math.abs(Math.sin(t * 3.2)) * 0.07;   // a soft bounce
  }
}
// target lock-on for attacks / spells: thick bracket corners (dark-outlined so they read on any ground) that snap in
// onto the tile when the target changes and then breathe, a big down-arrow over the unit and a soft pulse on its sprite.
// Unlit flat colours, like the turn marker, so nothing in the scene is lit by it.
class TargetMark {
  constructor(scene) {
    const cc = document.createElement('canvas'); cc.width = cc.height = 16; const g = cc.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 12, 5); g.fillRect(0, 0, 5, 12);
    g.fillStyle = '#fff'; g.fillRect(1, 1, 10, 3); g.fillRect(1, 1, 3, 10);
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = ct.minFilter = THREE.NearestFilter; ct.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, toneMapped: false });   // untoned: a saturated red that tone mapping would wash to salmon
    this.corners = [0, 1, 2, 3].map(i => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2), this.mat);
      m.rotation.y = -i * Math.PI / 2; m.renderOrder = 5; return m;
    });
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const f = fc.getContext('2d');
    f.fillStyle = '#fff'; f.fillRect(2, 2, 28, 28);
    const ft = new THREE.CanvasTexture(fc); ft.magFilter = THREE.NearestFilter;
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, toneMapped: false }));
    this.fill.renderOrder = 4;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex(), transparent: true, depthTest: false, toneMapped: false }));
    this.arrow.scale.set(0.42, 0.373, 1); this.arrow.renderOrder = 7;
    this.group = new THREE.Group(); this.group.add(this.fill, ...this.corners); this.group.visible = this.arrow.visible = false;
    scene.add(this.group, this.arrow);
    this.cell = null; this.t0 = 0; this.actor = null;
  }
  set(cell, col, t) {
    if (!cell) { this.cell = null; this.group.visible = this.arrow.visible = false; this.release(); return; }
    if (!this.cell || this.cell[0] !== cell[0] || this.cell[1] !== cell[1]) this.t0 = t;   // re-lock: corners snap in again
    this.cell = cell; this.col = col;
  }
  release() { if (this.actor) { this.actor.flash = 0; this.actor = null; } }
  update(t) {
    if (!this.cell) return;
    const p = tileCenter(...this.cell), k = Math.min(1, (t - this.t0) / 0.16), ease = 1 - (1 - k) * (1 - k);
    const spread = 0.25 + (1 - ease) * 0.45 + (k >= 1 ? (Math.floor(t * 3) % 2) * 0.035 : 0);   // snap in, then a two-step breathe
    this.group.visible = true; this.group.position.set(p.x, p.y + 0.075, p.z);
    this.mat.color.setRGB(...this.col); this.mat.opacity = 0.35 + 0.65 * ease;
    this.corners.forEach((m, i) => { const a = -i * Math.PI / 2; m.position.set(-spread * Math.cos(a) - spread * Math.sin(a), 0, -spread * Math.cos(a) + spread * Math.sin(a)); });
    this.fill.material.color.setRGB(...this.col); this.fill.material.opacity = 0.22 + 0.1 * Math.sin(t * 6);
    const u = R.unitAt(...this.cell), a = u && actorOf(u);
    if (a !== this.actor) { this.release(); this.actor = a || null; }
    this.arrow.visible = !!a; this.arrow.material.color.setRGB(...this.col);
    if (a) {
      this.arrow.position.set(a.pos.x, a.pos.y + 1.7 + a.hover + Math.abs(Math.sin(t * 3.2)) * 0.08 + (1 - ease) * 0.5, a.pos.z);
      a.flash = 0.12 + 0.1 * Math.sin(t * 6);   // the sprite itself pulses so the picked unit stands out
    }
  }
}
export const C = { chest: [1.0, 0.78, 0.25], move: [0.02, 0.02, 0.025], moveLite: [0.95, 0.95, 0.92], atk: [1.0, 0.22, 0.16], harm: [1.0, 0.5, 0.12], help: [0.25, 1.0, 0.45], area: [1.0, 0.9, 0.5], range: [0.55, 0.55, 0.7], danger: [0.75, 0.08, 0.05] };
export let tiles, activeMark, targetMark;

// ---------------------------------------------------------------- input
const queue = [], waiters = [];
export function push(ev) { if (waiters.length) waiters.shift()(ev); else { queue.push(ev); if (queue.length > 6) queue.shift(); } }
// hover events replace each other in the queue so a busy frame never builds a backlog (or pushes clicks out)
function pushHover(t) { const i = queue.findIndex(e => e.k === 'hover'); if (i >= 0) queue.splice(i, 1); push({ k: 'hover', t }); }
export const input = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(r => waiters.push(r));
let hoverTile = null, cursorTile = [0, 0];
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pick(ev) {
  const r = world.renderer.domElement.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, world.camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -1e-4) return null;
  let h = 0.1, px = 0, pz = 0;
  for (let i = 0; i < 4; i++) { const t = (h - o.y) / d.y; px = o.x + d.x * t; pz = o.z + d.z * t; h = groundH(px, pz); }
  const x = Math.floor(px), y = Math.floor(pz);
  return R.inMap(x, y) ? [x, y] : null;
}
let drag = null;
export function setupInput() {
  const cv = world.renderer.domElement;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { if (e.button === 2 || e.button === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, b: e.button }; });
  window.addEventListener('pointermove', e => {
    if (drag) { const dx = e.clientX - drag.x; drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
    const t = pick(e); if (t && (!hoverTile || t[0] !== hoverTile[0] || t[1] !== hoverTile[1])) { hoverTile = t; cursorTile = t; pushHover(t); }
  });
  window.addEventListener('pointerup', e => {
    if (drag && e.button === drag.b) { if (drag.moved <= 6 && e.button === 2) push({ k: 'B' }); drag = null; return; }
    if (e.button === 0 && e.target === cv) { const t = pick(e); if (t) push({ k: 'click', t }); else push({ k: 'clickoff' }); }
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === ' ') { timeScale = 3; e.preventDefault(); return; }
    if (k === 'Tab') { e.preventDefault(); return push({ k: 'TAB' }); }
    if (k === 'Enter' || k === 'z' || k === 'Z') { ui.advance(); return push({ k: 'A' }); }
    if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') return push({ k: 'B' });
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
    if (dir) {
      e.preventDefault();
      // screen-relative: rotate the key direction by the camera yaw, snapped to the grid
      const yaw = Math.round(cam.yaw / (Math.PI / 2)) * (Math.PI / 2), c = Math.cos(yaw), s = Math.sin(yaw);
      const gx = Math.round(dir[0] * c + dir[1] * s), gy = Math.round(-dir[0] * s + dir[1] * c);
      push({ k: 'DIR', d: [gx, gy], raw: k });
    }
  });
  window.addEventListener('keyup', e => { if (e.key === ' ') timeScale = 1; });
  document.addEventListener('click', () => ui && ui.advance());
}

// ---------------------------------------------------------------- presentation helpers
export function syncActors() {
  for (const [u, a] of actors) if (!G.units.includes(u)) { a.dispose(world.scene); actors.delete(u); }
  for (const u of G.units) if (!actors.has(u)) { const a = new Actor(bank, u, world.scene); actors.set(u, a); if (!u.alive) a.dissolve = 1; }
}
// a unit joining mid-battle (a hero, battle 4's 楊戩; or the enemy's reinforcements, battle 7's): the camera goes to where
// it appears, and it comes in (the battle's own entrance, FX.join, or a fade); it acts from the next round, as the round's
// turn order is already set
async function joinHeroes(list) {
  syncActors();
  for (const v of list) { const a = actorOf(v); placeActor(a); a.fade = 0; }   // the whole wave hidden until each comes in (else the rest showed, vanished and faded in: the user's report)
  for (const v of list) {
    const a = actorOf(v);
    cam.release(); cam.focus(a.pos); await wait(450);
    if (FX.join) await FX.join(E, v); else for (let k = 1; k <= 20; k++) { a.fade = k / 20; await wait(30); }
    a.fade = 1;
  }
}
// a battle in rooms (src/rules.js enterRoom): the screen goes dark, the world is built again for the room the party has
// entered (the battle's look, FX.look, reads G.room), the units are put on their cells, the camera on the heroes; then
// it comes up again [the ROM fades out and in, 0x1D5B8 / 0x1D8A0]
export async function enterRoom(k, back) {
  const f = $('fade'); f.style.transition = 'opacity 0.3s'; f.style.opacity = 1; await wait(320);
  R.enterRoom(k, back);
  ready = false;
  for (const a of actors.values()) a.dispose(world.scene);
  actors.clear(); ui.clearUnits(); world.reset();
  setLook(FX.look || { mapSD: roomArt(k) });
  await world.build(() => {}); resize();
  vfx = new VFX(world); tiles = new Tiles(world.scene); activeMark = new ActiveMark(world.scene); targetMark = new TargetMark(world.scene);
  if (FX.look && FX.look.set) await dress(E, FX.look.set);
  measureLight();
  Object.assign(window.__remake, { tiles, vfx, world, W: world });
  await bank.load([...new Set(G.units.map(u => u.sprite))]);
  syncActors(); for (const a of actors.values()) { placeActor(a); a.dissolve = a.u.alive ? 0 : 1; }
  if (FX.room) FX.room(E, k);
  ready = true;
  const lead = R.players()[0]; if (lead) { cam.release(tileCenter(lead.x, lead.y)); cam.snap(); }
  hudRound();
  f.style.transition = 'opacity 0.4s'; f.style.opacity = 0; await wait(400);
}
const roomArt = k => 'assets/battles/' + String(D.n).padStart(2, '0') + (k ? '/room-' + k : '/map') + '.png';
export function placeActor(a) { const p = tileCenter(a.u.x, a.u.y); a.pos.copy(p); a.off.set(0, 0); }
const FV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// a walk along the path: corners rounded (a quarter curve through each turn), a short speed-up and slow-down at the ends,
// the facing taken from the direction of travel. No hop per cell: the walk cycle carries the step.
const STEP = 0.15, RAMP = 0.09;   // seconds per cell at full pace; seconds to reach it / to stop
export async function walkActor(u, path) {
  const a = actorOf(u); if (path.length < 2) return;
  const P = path.map(c => tileCenter(...c)), pts = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1], B = P[i], C = P[i + 1], turn = (B.x - A.x) * (C.z - B.z) - (B.z - A.z) * (C.x - B.x);
    if (Math.abs(turn) < 1e-6) { pts.push(B); continue; }
    const s0 = B.clone().lerp(A, 0.35), s1 = B.clone().lerp(C, 0.35);
    for (let j = 0; j <= 6; j++) { const t = j / 6, q = s0.clone().multiplyScalar((1 - t) * (1 - t)).add(B.clone().multiplyScalar(2 * t * (1 - t))).add(s1.clone().multiplyScalar(t * t)); pts.push(q); }
  }
  pts.push(P[P.length - 1]);
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const total = L[L.length - 1], T = (path.length - 1) * STEP + RAMP, r = Math.min(0.4, RAMP / T), vmax = 1 / (1 - r);
  const dist = k => k < r ? vmax * k * k / (2 * r) : k > 1 - r ? 1 - vmax * (1 - k) * (1 - k) / (2 * r) : vmax * (k - r / 2);   // trapezoid speed
  a.walking = true; let seg = 1;
  await anim(T, k => {
    const d = Math.min(total, Math.max(0, dist(k)) * total);
    while (seg < pts.length - 1 && L[seg] < d) seg++;
    const A = pts[seg - 1], B = pts[seg], f = L[seg] > L[seg - 1] ? (d - L[seg - 1]) / (L[seg] - L[seg - 1]) : 1;
    a.pos.copy(A).lerp(B, f);
    const dx = B.x - A.x, dz = B.z - A.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) u.facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
    cam.focus(a.pos);
  });
  a.walking = false; [u.x, u.y] = path[path.length - 1]; placeActor(a);
}
export let canvasRect = { width: 1, height: 1, left: 0, top: 0 };
const _pv = new THREE.Vector3();
export function project(p) { const v = _pv.copy(p).project(world.camera), r = canvasRect; return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, z: v.z }; }
export function flinch(a, power) {
  a.flash = 1;
  const d = a.pos.clone().sub(world.camera.position).setY(0).normalize().multiplyScalar(0.12 * power);
  anim(0.35, k => { a.off.set(d.x * Math.sin(k * Math.PI) * (1 - k) * 3, d.z * Math.sin(k * Math.PI) * (1 - k) * 3); a.flash = Math.max(0, 1 - k * 2.2); }).then(() => { a.off.set(0, 0); a.flash = 0; });
}
export function showResult(t, r) {
  const a = actorOf(t), p = a.head().add(V(0, 0.15, 0));
  if (!r) return;
  if (r.immune) ui.floater(p, "無效", "dmg text", 1.4);
  else if (r.dmg !== undefined) { ui.floater(p, String(r.dmg), 'dmg' + (t.side === 'player' ? ' ally' : ''), 1.4); flinch(a, 1.4); }   // no blow's sound: a spell or item plays its own
  else if (r.heal !== undefined) { ui.floater(p, '+' + r.heal, 'dmg heal', 1.4); a.flash = 0.5; anim(0.6, k => { a.flash = 0.5 * (1 - k); }); }
  else if (r.text && r.text.startsWith('法力')) ui.floater(p, r.text, 'dmg heal', 1.4);   // status words (淨化, 睡眠...) are not shown
}
// an ally falls: it spins like an enemy (deathSpin, below), then its spirit (a pale copy of the sprite) rises out of the body as it blinks away
export async function allyDeath(u) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing;
  cam.focus(P);
  vfx.screen.darkTarget = 0.35; vfx.screen.darkCol.setRGB(0.6, 0.6, 0.45);
  await deathSpin(u, false);   // [ROM 0x1091A calls the enemy's 0x103E8: the same spin, but a hero (slot 0-9) does not cry out]
  vfx.smokePuff(P.x, P.y + 0.1, P.z, { vy: 0.3, life: 1.2, size: 0.4, size1: 1.1, tint: [0.45, 0.42, 0.38] }); sfx(SND.burst);   // [ROM 0x10506, for every unit]
  await wait(250);
  // the spirit leaves the body
  const src = a.mesh.material.map, t2 = src.clone(); t2.needsUpdate = true;
  const ghost = new THREE.Mesh(a.mesh.geometry.clone(), new THREE.MeshBasicMaterial({ map: t2, color: new THREE.Color(0.75, 0.9, 1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ghost.renderOrder = 6;
  vfx.light(P.clone().setY(P.y + 1), [0.6, 0.75, 1], 8, 2.2, 5);
  vfx.pillar(P, [0.55, 0.7, 1], 0.42, 3.5, 2.0, { taper: 0.8, intensity: 0.35, grow: 1 });
  vfx.timed(ghost, 2.0, (k) => {
    ghost.position.copy(a.mesh.position).add(V(0, k * 1.8, 0)); ghost.rotation.copy(a.mesh.rotation);
    ghost.material.opacity = Math.min(1, k * 4) * (1 - k) * 0.8; ghost.scale.setScalar(1 + k * 0.15);
    if (Math.random() < 0.5) { const q = ghost.position; vfx.spark(q.x + rand(-0.3, 0.3), q.y + rand(0.1, 0.9), q.z + rand(-0.2, 0.2), { vy: rand(0.3, 0.8), life: 1, size: 0.05, r: 0.7, gg: 0.85, b: 1, shape: 0, wob: 0.4, ph: rand(0, 6) }); }
  });
  // meanwhile the body blinks out (the original puffs it away in a small cloud)
  for (let i = 0; i < 14; i++) { a.flashPal = i % 2 === 0; a.flash = i % 2 ? 0 : 0.5; a.hidden = !!(i % 2 && i > 6); await wait(i < 7 ? 90 : 70); }
  a.flashPal = false; a.flash = 0; a.act = null; a.hidden = false; a.dissolve = 1; u.facing = face;
  await wait(900);
  vfx.screen.darkTarget = 0;
  jingle(0x0a);   // a short lament over the music, then the battle's song again [ROM 0x10A16, the end of the ally's fall]
}
// a unit falls [ROM 0x103E8 -> 0x1105A]: it spins once on the spot, its facing set down, right, up, left and down again,
// 5 frames each, then the original puffs it away (a 5-frame cloud, 0x560-0x5A0). Here the demon's body breaks apart
// into dark miasma and embers that burn upward after the spin, leaving a scorch on the ground
// the battle's sound effects, the ROM's own [the attack routine 0x0E93A: a melee blow plays only the impact (0x0EC9C); the
// bow path (move type 1, from 0x0F098) adds the arrow's whoosh (0x0F228) before the same impact; the death 0x103E8]
const SND = { arrow: 0x8081, hit: 0x8089, cry: 0x805d, burst: 0x806f, found: 0x8061, levelUp: 'levelup' };   // levelUp: 星落鈴音, falling-star chimes made for the remake (tools/audio/levelup.py; the user's pick of five) instead of the original's 0x805A
export async function deathSpin(u, cry = true) {
  const a = actorOf(u); a.act = null; a.off.set(0, 0); if (cry) sfx(SND.cry);   // the death cry as the spin begins [ROM 0x1040E: only for a unit past slot 9, an enemy]
  for (const f of ['down', 'right', 'up', 'left', 'down']) { u.facing = f; await wait(1000 * 5 / 60); }
}
export async function killAnim(u) {
  if (u.side === 'player') return allyDeath(u);
  const a = actorOf(u), P = a.pos.clone();
  await deathSpin(u);
  a.flash = 0.6; a.off.set(0, 0); sfx(SND.burst);   // and the burst as the body goes [ROM 0x10506]
  const c = a.chest();
  // a yellow explosion [the user's call; was dark miasma]: a fireball tinted gold, white-hot to gold sparks, a gold ring,
  // the ground lit under it, grey smoke after (quick: the burst about half as long, the user's earlier call)
  const X = 1.25;   // 25% bigger than first made [the user's call]
  vfx.light(c, [1, 0.85, 0.35], 14, 0.5, 6 * X);
  vfx.decal(P, [1, 0.7, 0.2], 0.7 * X, 0.8, { intensity: 0.5 });
  vfx.ring(P, [1, 0.88, 0.4], 1.3 * X, 0.3, { intensity: 0.7 });
  vfx.explode(c, 0.6 * X, { n: 22, tint: [1.45, 1.6, 0.45], smokeTint: [0.26, 0.23, 0.2] });
  vfx.burst(c, { n: 6, speed: 1.4 * X, col: [1, 0.88, 0.35], size: 0.5 * X, life: 0.35, g: 0, shape: 0, up: 0.1 });   // the flash at its heart
  vfx.burst(c, { n: 40, speed: 4 * X, cols: [[1, 1, 0.8], [1, 0.9, 0.35], [1, 0.7, 0.15]], size: 0.05 * X, life: 0.6, g: 5, flicker: 1 });
  await anim(0.55, k => {
    a.dissolve = k; a.flash = 0.6 * (1 - k);
    for (let i = 0; i < 2; i++) vfx.spark(c.x + rand(-0.35, 0.35) * X, c.y + rand(-0.45, 0.5) * X, c.z + rand(-0.3, 0.3) * X, { vy: rand(1.4, 3) * X, vx: rand(-0.4, 0.4), life: rand(0.35, 0.7), size: rand(0.03, 0.06), r: 1, gg: rand(0.75, 0.95), b: rand(0.2, 0.45), shape: 1, flicker: 1, ph: rand(0, 9) });
  });
  a.dissolve = 1; a.act = null; a.flash = 0;
}
// bow users (attack type 2 in the ROM: 燕蓉, 黃飛虎, 鐵弓手): nock, draw, loose; the arrow flies to the target
export function landHit(au, du, d, r) {
  const hp = d.chest();
  sfx(SND.hit, r.miss ? { vol: 0.4, rate: 1.35 } : {});   // the strike [ROM 0x0EC9C], played before the roll is read: a miss sounds it too (a forced miss logs 0x8089), here lighter: quieter and higher [the user's call]
  if (r.miss) { ui.floater(d.head(), '閃避', 'dmg miss', 1.4); vfx.burst(hp, { n: 10, speed: 2, col: [0.8, 0.9, 1], size: 0.04, life: 0.4 }); return; }
  if (r.crit) vfx.impact(hp, [1, 0.85, 0.6], 0.9);
  else { vfx.burst(hp, { n: 8, speed: 2.2, col: [1, 0.9, 0.7], size: 0.04, life: 0.35, g: 4 }); vfx.shake(0.04, 0.12); }
  if (du.stand) return;   // empty tile: sparks only
  ui.floater(d.head().add(V(0, 0.15, 0)), String(r.dmg), 'dmg' + (r.crit ? ' crit' : '') + (du.side === 'player' ? ' ally' : ''), 1.4);
  d.flash = 1; anim(0.3, kk => { d.flash = 1 - kk; });
}
// a unit's attack type [its record's +0x2B]: 2 shoots a bow
export const atkTypeOf = u => u.atkType ?? (AD.act[u.sprite] ? AD.act[u.sprite].type : (((globalThis.ACTIONS || {}).sheets || {})[u.sprite] || [])[0]);
export async function bowAnim(au, du, r, onHit) {
  const a = actorOf(au), d = actorOf(du), A = AD.attack, fv = FV[au.facing];
  if (r.crit) { vfx.screen.barsTarget = 0.6; await wait(250); }
  du.facing = { down: 'up', up: 'down', left: 'right', right: 'left' }[au.facing];
  // nock (frame 0) -> full draw (frame 1), with a slight lean back
  await anim(0.42, k => { a.act = { kind: 'atk', frame: k < 0.35 ? 0 : 1 }; const b = -Math.min(1, k * 2) * 0.06; a.off.set(fv[0] * b, fv[1] * b); });
  // loose (frame 2): the arrow leaves from the bow hand
  a.act = { kind: 'atk', frame: 2 }; a.off.set(0, 0); sfx(SND.arrow);   // the arrow's whoosh [ROM 0x0F228, the bow path only]
  const from = a.chest().add(V(fv[0] * 0.35, 0.05, fv[1] * 0.35)), to = d.chest(), dir = to.clone().sub(from), len = dir.length(); dir.normalize();
  const ar = arrowMesh(r.crit ? [1, 0.7, 0.3] : [1, 0.9, 0.7], 0.5); ar.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  const rib = vfx.ribbon({ col: [1, 0.95, 0.85], width: 0.025, n: 10 });
  const fly = 0.1 + len * 0.045, arc = Math.min(0.5, len * 0.08);
  vfx.timed(ar, fly, k => { ar.position.copy(from).lerp(to, k); ar.position.y += Math.sin(k * Math.PI) * arc; rib.push(ar.position); }, () => rib.end());
  await wait(fly * 1000);
  landHit(au, du, d, r); if (onHit) onHit();
  // the target recoils along the shot, using the ROM's hurt/guard poses and shake curve
  const n = A.shakeEnd - A.hitEnd;
  await anim(Math.max(0.3, n / 60 + 0.12), k => {
    const f = Math.floor(k * (n + 7));
    d.act = { kind: 'pose', row: !r.miss && f < 6 ? 3 : 2, base: r.miss ? 3 : 0 };
    const s = f >= 7 && f - 7 < n ? (fv[0] ? A.shakeH : A.shakeV)[f - 7] / 32 : 0; d.off.set(fv[0] * s, fv[1] * s);
    if (k > 0.5) a.act = null;
  });
  a.act = d.act = null; a.off.set(0, 0); d.off.set(0, 0);
  vfx.screen.barsTarget = 0; cam.release();
}
// physical attack, timed from the original's 60 Hz attack timeline [ROM anim data]
export async function attackAnim(au, du, r, onHit) {
  if (atkTypeOf(au) === 2) return bowAnim(au, du, r, onHit);
  const a = actorOf(au), d = actorOf(du), A = AD.attack, fv = FV[au.facing];
  const mid = a.pos.clone().lerp(d.pos, 0.5);
  const side = Math.atan2(fv[0], fv[1]);
  cam.shot(mid, { dist: 6.2, pitch: 0.36, yaw: ((side - cam.user.yaw + Math.PI * 2.5) % (Math.PI * 2)) > Math.PI ? 0.5 : -0.5 });
  if (r.crit) { vfx.screen.barsTarget = 0.6; await wait(250); }
  du.facing = { down: 'up', up: 'down', left: 'right', right: 'left' }[au.facing];
  let hit = false;
  await anim(A.end / 60, k => {
    const f = Math.min(A.end - 1, Math.floor(k * A.end));
    if (f < A.frame.length) { a.act = { kind: 'atk', frame: A.frame[f] }; const b = A.back[f] / 32; a.off.set(fv[0] * b, fv[1] * b); }
    else { a.act = null; a.off.set(0, 0); }
    if (f >= A.hitStart && f < A.shakeEnd) {
      d.act = { kind: 'pose', row: !r.miss && f >= A.flashStart && f < A.hitEnd ? 3 : 2, base: r.miss ? 3 : 0 };
      const s = f >= A.hitEnd ? (fv[0] ? A.shakeH : A.shakeV)[f - A.hitEnd] / 32 : 0; d.off.set(fv[0] * s, fv[1] * s);
    } else { d.act = null; d.off.set(0, 0); }
    if (!hit && f >= A.hitStart) { hit = true; landHit(au, du, d, r); if (onHit) onHit(); }
  });
  a.act = d.act = null; a.off.set(0, 0); d.off.set(0, 0);
  vfx.screen.barsTarget = 0; cam.release();
}
// a spell's or item's result reaches its target's numbers as it lands (ctx.hit), not as it is cast: damage comes off,
// and a remedy's HP / MP (worked out by eff.apply, then held back until now) go on [the user's call]
function landResult(t, r) {
  if (r.dmg !== undefined) t.hp = Math.max(0, t.hp - r.dmg);
  else if (r.restore) { t.hp = r.restore.hp; t.mp = r.restore.mp; }
  r.applied = true;
}
export function spellCtx(u, at, targets, results, cells) {
  const a = actorOf(u), ctx = {
    vfx, cam, caster: a, targets: targets.map(actorOf), at: tileCenter(...at), wait,
    cells: (cells || [at]).filter(c => R.inMap(...c)).map(c => tileCenter(...c)),   // the spell's area, on the ground (the aimed cell first)
    hit: i => { if (ctx.onHit) { const f = ctx.onHit; ctx.onHit = null; f(); } const list = i == null ? targets.map((t, j) => j) : [i]; for (const j of list) { const r = results[j]; if (r && !r.applied) landResult(targets[j], r); showResult(targets[j], r); } },   // damage and healing show in the HP bar as they land
    pose: kind => {
      if (!kind) { a.act = null; return; }
      if (a.texAct) { let k = 0; const loop = () => { if (a.act && a.act.kind === 'pose' && a.act.base === 6) { a.act.fixed = Math.min(2, Math.floor(k++ / 7)); requestAnimationFrame(loop); } }; a.act = { kind: 'pose', row: 2, base: 6, fixed: 0 }; loop(); }
    },
  };
  ctx.cam.camera = world.camera; return ctx;
}
// level up: every hero gets their own victory pose, built from their ROM frames (attack / guard / cast poses,
// turning through the four facings) plus effects that fit them. These poses are new to the remake.
const LV = {
  atk: (a, f) => { a.act = { kind: 'atk', frame: f }; },
  cast: (a, f) => { a.act = { kind: 'pose', row: 2, base: 6, fixed: f }; },
  guard: a => { a.act = { kind: 'pose', row: 2, base: 3 }; },
  spin: (a, t, rate) => { a.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * rate) % 4]; },
};
// 天女散花 for 燕蓉's level-up: the arrow bursts into a ring of coloured stars, then blossoms and petals of many colours
// spin and flutter down round her (petal meshes, not square particles: the user's call)
const FLOWER_COLS = [[1, 0.45, 0.7], [1, 0.18, 0.35], [1, 0.8, 0.2], [1, 0.95, 0.85], [0.7, 0.4, 1], [0.35, 0.7, 1], [1, 0.9, 0.55]];
let PETAL_TEX = null, BLOSSOM_TEX = null;
function petalTex() {   // a cherry petal: notched tip, white heart blushing to the edge (tinted by the material)
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(32, 92); g.bezierCurveTo(4, 70, 2, 26, 20, 8); g.lineTo(32, 18); g.lineTo(44, 8); g.bezierCurveTo(62, 26, 60, 70, 32, 92); g.closePath(); };
  const gr = g.createRadialGradient(32, 80, 2, 32, 50, 48); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#f4f4f4'); gr.addColorStop(1, '#b8b8b8');
  g.fillStyle = gr; path(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(32, 86); g.quadraticCurveTo(32 + dx * 0.6, 50, 32 + dx, 22); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blossomTex() {   // a five-petalled blossom with a gold heart
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
    const end = Math.max(P.y + 0.05, groundH(q.x + Math.cos(a) * r1, q.z + Math.sin(a) * r1) + 0.05);
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
const LEVEL_POSE = {
  // 林雲: two spins, then a sword thrust to the sky inside a sweeping ring of sword light
  p0: async (a, P) => {
    await anim(0.6, (k, dt) => LV.spin(a, k * 0.6, 14));
    a.u.facing = 'down'; LV.atk(a, 2);
    const rib = vfx.ribbon({ col: [0.5, 0.85, 1], width: 0.12, n: 30 });
    anim(0.6, k => rib.push(V(P.x + Math.cos(k * 7) * 0.75, P.y + 0.5 + k * 0.5, P.z + Math.sin(k * 7) * 0.75))).then(() => rib.end());
    vfx.ring(P, [0.5, 0.85, 1], 2, 0.7); vfx.burst(a.head(), { n: 30, speed: 3, col: [0.7, 0.9, 1], size: 0.05, life: 0.8, g: 2 });
    await wait(900);
  },
  // 燕蓉: facing us, draws and looses an arrow into the sky that bursts into 天女散花, flowers of many colours
  p1: async (a, P) => {
    a.u.facing = 'down'; LV.atk(a, 0); await wait(250); LV.atk(a, 1); await wait(350); LV.atk(a, 2);   // facing the front, the arrow loosed skywards [the user's call; she turned her back before]
    const ar = arrowMesh([1, 0.75, 0.9], 0.5), from = a.chest().add(V(0, 0.3, 0)), rib = vfx.ribbon({ col: [1, 0.8, 0.9], width: 0.04, n: 14 });
    vfx.timed(ar, 0.45, k => { ar.position.copy(from).add(V(0, k * 3.2, 0)); rib.push(ar.position); }, () => {
      rib.end(); ar.visible = false; flowerRain(from.clone().add(V(0, 3.2, 0)), P);
    });
    await wait(500); a.u.facing = 'down'; a.act = null; await wait(1200);
  },
  // 楊戩: the third eye opens — a golden eye of light above his brow and a sweeping beam, spirit wisps circling
  p2: async (a, P) => {
    a.u.facing = 'down'; LV.cast(a, 0); await wait(200); LV.cast(a, 2);
    const h = a.head().add(V(0, 0.2, 0));
    vfx.ring(h, [1, 0.8, 0.4], 0.7, 0.9, { vertical: true, y: h.y, yaw: cam.yaw, intensity: 0.8 });
    vfx.pillar(P, [1, 0.8, 0.4], 0.06, 5, 1.2, { intensity: 0.45 });
    for (let j = 0; j < 3; j++) { const r = vfx.ribbon({ col: [0.55, 0.8, 1], width: 0.05, n: 20 }); anim(1.2, k => r.push(V(P.x + Math.cos(k * 9 + j * 2.1) * 0.7, P.y + 0.3 + Math.sin(k * 5 + j) * 0.25, P.z + Math.sin(k * 9 + j * 2.1) * 0.7))).then(() => r.end()); }
    await wait(1300);
  },
  // 黃飛虎: leaps and slams down; the ground cracks with a shockwave and golden war-flame rises around him
  p3: async (a, P) => {
    a.u.facing = 'down'; LV.guard(a);
    await anim(0.45, k => { a.hover = Math.sin(k * Math.PI) * 0.7; });
    a.hover = 0; vfx.shake(0.18, 0.3); vfx.ring(P, [1, 0.75, 0.3], 2.2, 0.6, { intensity: 0.6 }); vfx.decal(P, [1, 0.55, 0.15], 0.9, 1.2, { intensity: 0.35 });
    for (let i = 0; i < 16; i++) { const t = rand(0, 6.28), sp = rand(1.5, 3); vfx.smokePuff(P.x, P.y + 0.1, P.z, { vx: Math.cos(t) * sp, vy: rand(0.2, 0.6), vz: Math.sin(t) * sp, drag: 2.5, life: 1.2, size: 0.35, size1: 0.9, tint: [0.5, 0.45, 0.38] }); }
    LV.atk(a, 1);
    await anim(1.0, k => { for (let i = 0; i < 2; i++) { const t = rand(0, 6.28), r = rand(0.35, 0.6); vfx.flame(P.x + Math.cos(t) * r, P.y, P.z + Math.sin(t) * r, { size: rand(0.25, 0.4) * (1 - k * 0.5), asp: 2, life: 0.5, vy: 0.8, tint: [1, 0.95, 0.6] }); } });
  },
  // 哪吒: rises on the wind-fire wheels, spinning, with fire circling his feet and his red sash streaming
  p4: async (a, P) => {
    const sash = vfx.ribbon({ col: [1, 0.25, 0.2], width: 0.07, n: 26 });
    await anim(1.3, k => {
      a.hover = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * 0.7 * (k > 0.8 ? 1 - (k - 0.8) * 5 : 1); LV.spin(a, k * 1.3, 12);
      const y = P.y + a.hover + 0.05;
      for (const s2 of [-1, 1]) { const t = k * 40 + (s2 > 0 ? Math.PI : 0); vfx.flame(P.x + Math.cos(t) * 0.3, y, P.z + Math.sin(t) * 0.3, { size: 0.18, asp: 1.4, life: 0.3, vy: -0.3 }); }
      sash.push(V(P.x + Math.cos(k * 25) * 0.45, y + 0.55, P.z + Math.sin(k * 25) * 0.45));
    });
    sash.end(); a.hover = 0; a.u.facing = 'down'; LV.atk(a, 2); vfx.ring(P, [1, 0.5, 0.2], 1.8, 0.5); await wait(500);
  },
  // 姬發: the prince raises his hands; a royal shaft of gold falls from the sky with drifting golden petals
  p5: async (a, P) => {
    a.u.facing = 'down'; LV.cast(a, 1);
    vfx.runeCircle(P, [1, 0.8, 0.35], 1.1, 1.8, { spin: 0.4, intensity: 0.8 });
    vfx.pillar(P, [1, 0.8, 0.4], 0.45, 5, 1.7, { taper: 1.2, intensity: 0.22, grow: 1 });
    for (let i = 0; i < 40; i++) setTimeout(() => vfx.smoke(P.x + rand(-1, 1), P.y + rand(2.2, 3), P.z + rand(-1, 1), { vy: -rand(0.5, 0.9), life: 2.2, size: 0.1, r: 1, gg: rand(0.75, 0.9), b: 0.4, a: 1, shape: 2, spin: rand(-0.8, 0.8), wob: 1, ph: rand(0, 6) }), i * 25);   // petal-shaped
    await wait(500); LV.cast(a, 2); await wait(1000);
  },
  // 雷震子: beats his wings and leaps high; lightning strikes him from the storm and he lands crackling
  p6: async (a, P) => {
    a.u.facing = 'down'; LV.guard(a);
    await anim(0.4, k => { a.hover = ease(k) * 1.2; });
    const top = a.chest();
    vfx.bolt(top.clone().add(V(rand(-0.5, 0.5), 6, 0)), top, [0.3, 0.36, 0.55], 0.3, { width: 0.05 }); vfx.light(top, [0.7, 0.8, 1], 6, 0.3, 5);
    LV.atk(a, 1);
    await anim(0.45, k => { a.hover = 1.2 * (1 - k * k); if (Math.random() < 0.3) vfx.bolt(a.chest(), a.chest().add(V(rand(-0.7, 0.7), rand(-0.4, 0.5), rand(-0.5, 0.5))), [0.3, 0.36, 0.55], 0.08, { width: 0.015, jag: 0.4 }); });
    a.hover = 0; vfx.shake(0.12, 0.25); vfx.ring(P, [0.6, 0.7, 1], 2, 0.5, { intensity: 0.9 }); vfx.burst(P.clone().setY(P.y + 0.2), { n: 24, speed: 4, cols: [[0.9, 0.95, 1], [0.6, 0.7, 1]], size: 0.05, life: 0.6, shape: 1 });
    LV.atk(a, 2); await wait(700);
  },
  // 姜子牙: the sage raises his hands; the eight trigrams turn under him and rise around him on a column of gold
  jiang: async (a, P) => {
    a.u.facing = 'down'; LV.cast(a, 0);
    vfx.runeCircle(P, [1, 0.85, 0.45], 1.4, 2.2, { spin: 0.7, intensity: 1.2 });
    await wait(300); LV.cast(a, 1);
    for (let i = 0; i < 8; i++) { const ang = i / 8 * Math.PI * 2, r = vfx.ribbon({ col: [1, 0.85, 0.5], width: 0.05, n: 16 });
      anim(1.1, k => r.push(V(P.x + Math.cos(ang + k * 2.4) * 1.1, P.y + 0.1 + k * 2, P.z + Math.sin(ang + k * 2.4) * 1.1))).then(() => r.end()); }
    vfx.pillar(P, [1, 0.85, 0.45], 0.4, 4, 1.4, { intensity: 0.4, grow: 1 });
    await wait(500); LV.cast(a, 2); vfx.burst(a.head().add(V(0, 0.3, 0)), { n: 30, speed: 2.5, cols: [[1, 0.95, 0.7], [1, 0.8, 0.4]], size: 0.05, life: 0.9, g: 0.5 });
    await wait(800);
  },
  // 黃天化: swings his blade overhead, and a crown of steel-blue blades whirls round him and stabs into the ground
  '0a76a2': async (a, P) => {
    a.u.facing = 'down';
    for (const f of [0, 1, 2]) { LV.atk(a, f); await wait(110); }
    const blades = [];
    for (let i = 0; i < 6; i++) { const r = vfx.ribbon({ col: [0.55, 0.75, 1], width: 0.09, n: 18 }); blades.push(r);
      anim(0.7, k => { const ang = i / 6 * Math.PI * 2 + k * 6; r.push(V(P.x + Math.cos(ang) * 0.9, P.y + 0.6 + Math.sin(k * Math.PI) * 0.5, P.z + Math.sin(ang) * 0.9)); }).then(() => r.end()); }
    await wait(700);
    vfx.shake(0.1, 0.2); vfx.ring(P, [0.55, 0.75, 1], 2.2, 0.6);
    for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2, q = V(P.x + Math.cos(ang) * 0.9, P.y + 0.05, P.z + Math.sin(ang) * 0.9); vfx.burst(q, { n: 8, speed: 2, cols: [[1, 1, 1], [0.55, 0.75, 1]], size: 0.05, life: 0.5 }); vfx.decal(q, [0.5, 0.7, 1], 0.3, 1); }
    LV.atk(a, 2); await wait(700);
  },
  // 土行孫: sinks into the earth and bursts out of it in a spray of soil and stones, fist raised
  '0aa86c': async (a, P) => {
    a.u.facing = 'down'; LV.guard(a);
    await anim(0.4, k => { a.lift = -k * 0.9; a.fade = 1 - k; });
    for (let i = 0; i < 12; i++) { const t = Math.random() * 6.28, sp = 1 + Math.random() * 1.5; vfx.smokePuff(P.x, P.y + 0.1, P.z, { vx: Math.cos(t) * sp, vy: 0.4, vz: Math.sin(t) * sp, drag: 2.5, life: 1, size: 0.3, size1: 0.8, tint: [0.5, 0.42, 0.32] }); }
    await wait(350);
    vfx.shake(0.15, 0.3); LV.atk(a, 2);
    await anim(0.35, k => { a.fade = 1; a.lift = -0.9 + Math.sin(k * Math.PI * 0.75) * 1.6; });
    vfx.burst(P.clone().setY(P.y + 0.2), { n: 40, speed: 4, cols: [[0.5, 0.42, 0.32], [0.65, 0.55, 0.4], [1, 0.8, 0.45]], size: 0.07, life: 0.9, g: 10, up: 0.8 });
    vfx.ring(P, [1, 0.75, 0.4], 1.8, 0.5);
    await anim(0.3, k => { a.lift = 0.6 * (1 - k * k); }); a.lift = 0;
    vfx.burst(P.clone().setY(P.y + 0.1), { n: 16, speed: 2.5, cols: [[0.55, 0.45, 0.35]], size: 0.05, life: 0.6, g: 9 });
    await wait(500);
  },
  // 小龍女: a dragon of water spirals up around her and breaks into a crown of spray and pearls
  '0d006e': async (a, P) => {
    a.u.facing = 'down'; LV.cast(a, 0);
    const r = vfx.ribbon({ col: [0.4, 0.75, 1], width: 0.22, n: 36, fade: 0.5 }), c = vfx.ribbon({ col: [0.9, 0.97, 1], width: 0.06, n: 28 });
    await anim(1.0, k => { const ang = k * 13; const q = V(P.x + Math.cos(ang) * 0.7 * (1 - k * 0.4), P.y + 0.1 + k * 2.6, P.z + Math.sin(ang) * 0.7 * (1 - k * 0.4)); r.push(q); c.push(q);
      if (Math.random() < 0.5) vfx.spark(q.x, q.y, q.z, { vy: -0.5, g: 4, life: 0.6, size: 0.05, r: 0.7, gg: 0.9, b: 1, shape: 1 }); });
    r.end(); c.end(); LV.cast(a, 2);
    const top = P.clone().setY(P.y + 2.7);
    vfx.burst(top, { n: 60, speed: 3.5, cols: [[0.9, 0.97, 1], [0.45, 0.75, 1]], size: 0.06, life: 1.2, g: 6, shape: 1 });
    vfx.ring(P, [0.45, 0.8, 1], 2, 0.7); vfx.light(top, [0.5, 0.8, 1], 10, 0.6, 5);
    await wait(900);
  },
  // 燃燈: the old lamp-lighter: lamp flames kindle one by one in a ring round him and rise, and a halo opens behind his head
  '0d2ad2': async (a, P) => {
    a.u.facing = 'down'; LV.cast(a, 1);
    for (let i = 0; i < 12; i++) setTimeout(() => { const ang = i / 12 * Math.PI * 2, q = V(P.x + Math.cos(ang) * 1.0, P.y + 0.2, P.z + Math.sin(ang) * 1.0);
      anim(1.2, k => { const y = q.y + k * 1.4, aa = ang + k * 1.2; vfx.flame(P.x + Math.cos(aa) * (1 - k * 0.3), y, P.z + Math.sin(aa) * (1 - k * 0.3), { size: 0.18, asp: 1.6, life: 0.12, tint: [1, 0.9, 0.6] }); }); }, i * 60);
    vfx.ring(a.head().add(V(0, 0.1, 0)), [1, 0.85, 0.45], 0.8, 1.6, { vertical: true, yaw: cam.yaw, y: a.head().y + 0.1, intensity: 0.9 });
    await wait(700); LV.cast(a, 2); vfx.light(a.head(), [1, 0.8, 0.45], 10, 1, 5);
    await wait(1000);
  },
};
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export async function levelUpAnim(u, ch) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing;
  cam.focus(P);
  sfx(SND.levelUp);   // where the original plays its own (0x805A at ROM 0x12B30, as the level-up box opens)
  vfx.ring(P, [1, 0.9, 0.5], 1.4, 0.6);
  await wait(350);   // let the camera arrive
  const pose = LEVEL_POSE[u.sprite];
  if (pose) await pose(a, P); else { vfx.pillar(P, [1, 0.85, 0.4], 0.5, 4, 1.6, { intensity: 0.8, grow: 1 }); await wait(1200); }
  await wait(600);   // hold the final pose
  a.act = null; a.hover = 0; a.off.set(0, 0); u.facing = face;
  const parts = [ch.hp && '生命 +' + ch.hp, ch.mp && '法力 +' + ch.mp, ch.atk && '攻擊 +' + ch.atk, ch.df && '防禦 +' + ch.df, ch.spd && '速度 +' + ch.spd].filter(Boolean);
  await ui.say(u.name + ' 等級提升為 ' + ch.lv + ' 級。' + (parts.length ? '　' + parts.join('　') : '') + (ch.spell != null ? '\n學會了「' + D.spells[ch.spell].name + '」！' : ''), null, 2600);
}
export async function gainExp(u, amount) {
  if (u.side !== 'player' || u.guest || amount <= 0) return;
  u.exp += amount;   // no popup: the unit card shows experience
  while (u.exp > 99 && u.lv < 99) { u.exp -= 100; await levelUpAnim(u, R.levelUp(u)); }   // [ROM] 0x1246A
}

// ---------------------------------------------------------------- actions
export async function doAttack(au, du) {
  R.faceTo(au, du.x, du.y);
  const r = R.physicalAttack(au, du);
  await attackAnim(au, du, r, () => { if (!r.miss) du.hp = Math.max(0, du.hp - r.dmg); });   // the HP bar drops on the blow itself
  if (r.miss) return;
  if (du.hp <= 0) { du.alive = false; await killAnim(du); }
  if (au.side === 'player') await gainExp(au, R.expFor(au, du, !du.alive));
  if (du.status.sleep) du.status.sleep = 0;
}
export async function castSpell(u, sp, at) {
  u.mp -= sp.mp; R.faceTo(u, at[0], at[1]);
  const eff = R.spellEffect(u, sp); await useEffect(u, eff, R.areaCells(at[0], at[1], sp.area), at, sp.name, async c => { c.onHit = () => spellSounds(sp.id); await playSpell(sp.id, c, sp.kind); if (c.onHit) c.onHit(); });   // the sounds as the spell lands on its targets (its first ctx.hit; else as it ends) [the user's call]
}
// an item's icon in the world (assets/items/hd/NN.png: the xBR 4x of the 32x32 icon the original's 物 menu shows,
// assets/items/NN.png from tools/rom/icons.py; node tools/hd/upscale.js tiles <in> <out> 32),
// a soft glow behind it; null for an item without one
const iconTex = new Map();
function itemIcon(id) {
  if (id == null || id > 35) return null;
  if (!iconTex.has(id)) { const t = new THREE.TextureLoader().load('assets/items/hd/' + String(id).padStart(2, '0') + '.png'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; iconTex.set(id, t); }   // the HD upscale of the original's
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: vfx.glowTex, color: 0xfff0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  glow.scale.setScalar(1.5); g.add(glow);
  const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex.get(id), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  ic.scale.setScalar(0.82); g.add(ic); g.renderOrder = 9; glow.renderOrder = 9; ic.renderOrder = 10;
  g.userData = { glow, ic, set(o) { glow.material.opacity = o * 0.75; ic.material.opacity = o; } };
  world.scene.add(g); return g;
}
// using an item [design, after the original's 物 menu, which holds the item's icon over the hero]: the icon rises over
// the user's head, glows, and streams to the target before the effect plays (no bracket round it: the user's call)
async function itemUse(u, id, at) {
  const g = itemIcon(id); if (!g) return;
  const H = actorOf(u).head(), T = tileCenter(at[0], at[1]).add(V(0, 0.6, 0)), self = at[0] === u.x && at[1] === u.y;
  await anim(0.55, k => { const e = 1 - (1 - k) ** 3; g.position.copy(H).add(V(0, 0.2 + 1.0 * e, 0)); g.userData.set(Math.min(1, k * 3)); g.userData.glow.scale.setScalar(1.5 + 0.3 * Math.sin(k * 9)); });
  await wait(250);
  const P0 = g.position.clone();
  await anim(self ? 0.35 : 0.45, k => {   // to the target (or down into the user), shrinking into a spray of light
    g.position.copy(P0).lerp(self ? H : T, k); g.position.y += Math.sin(k * Math.PI) * (self ? 0 : 0.5); g.scale.setScalar(1 - 0.6 * k); g.userData.set(1 - k * 0.5);
    if (Math.random() < 0.6) vfx.spark(g.position.x, g.position.y, g.position.z, { vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.6), vz: rand(-0.4, 0.4), life: 0.5, size: 0.05, r: 1, gg: 0.95, b: 0.7 });
  });
  vfx.burst(g.position, { n: 18, speed: 1.6, cols: [[1, 0.95, 0.7], [1, 1, 1]], size: 0.04, life: 0.6, g: 0 });
  world.scene.remove(g);
}
// opening a chest: the item's icon rises out of it in a burst of light and hangs there while the find is told, then
// drops into the hero's hands
async function chestFind(u, ch, it) {
  const g = itemIcon(ch.item); if (!g) return null;
  const P = tileCenter(ch.x, ch.y);
  await anim(0.7, k => { const e = 1 - (1 - k) ** 3; g.position.set(P.x, P.y + 0.45 + 1.75 * e, P.z); g.userData.set(Math.min(1, k * 2.5)); g.scale.setScalar(0.5 + 0.5 * e);
    if (Math.random() < 0.5) vfx.spark(P.x + rand(-0.15, 0.15), P.y + 0.5, P.z + rand(-0.15, 0.15), { vy: rand(0.6, 1.4), life: 0.6, size: 0.04, r: 1, gg: 0.9, b: 0.5 }); });
  let bob = 0, on = true; const tick = () => { if (!on) return; bob += 0.016; g.position.y = P.y + 2.2 + Math.sin(bob * 4) * 0.04; g.userData.glow.scale.setScalar(1.5 + 0.2 * Math.sin(bob * 6)); requestAnimationFrame(tick); }; tick();
  return async () => { on = false; const A = actorOf(u).chest(), Q = g.position.clone();
    await anim(0.35, k => { g.position.copy(Q).lerp(A, k); g.scale.setScalar(1 - 0.7 * k); g.userData.set(1 - k); });
    world.scene.remove(g); };
}
// each item's sounds as the original plays them once its target is confirmed [tools/rom: the sound driver's requests
// (0x1E41D4) logged in the harness, from the 磻溪 snapshot, an item at a time]: [id, frames after the first] ...; the
// first is put where the effect lands here (a remedy's drop after 0.45 s, a harmful item's blast at once)
const RESTORE = [[0x8042, 0]];
const ITEM_SND = { 6: [[0x8042, 0], [0x8042, 41]], 10: [[0x8089, 0]], 11: [[0x8086, 0]], 12: Array.from({ length: 12 }, (_, k) => [0x804b, k * 21]),
  13: [[0x80aa, 0]], 14: [[0x8042, 0], [0x8089, 42]], 15: Array.from({ length: 9 }, (_, k) => [0x807f, k * 10]), 16: [[0x806e, 0]],
  17: Array.from({ length: 9 }, (_, k) => [0x807f, k * 10]) };
function itemSounds(id, harmful) {
  const at = harmful ? 0 : 450;
  for (const [snd, f] of ITEM_SND[id] || RESTORE) setTimeout(() => sfx(snd), at + f * 1000 / 60);
}
// a spell's own sounds (data/spellsound.js), the first as it lands, the rest the original's spacing apart
function spellSounds(id) {
  for (const [snd, f] of (globalThis.SPELL_SND || {})[id] || []) setTimeout(() => sfx(snd), f * 1000 / 60);
}
export async function useItem(u, idx, at) {
  const id = u.items[idx], it = D.items[id], eff = R.itemEffect(u, it);
  u.items.splice(idx, 1); R.faceTo(u, at[0], at[1]);
  await itemUse(u, id, at);
  await useEffect(u, eff, R.areaCells(at[0], at[1], it.area), at, it.name, c => { itemSounds(id, eff.kind === 13); return playItem(c, eff.kind === 13); });
}
export async function useEffect(u, eff, cells, at, name, script) {
  const isHarm = eff.kind === 13;
  const targets = cells.map(([x, y]) => R.unitAt(x, y)).filter(t => t && (isHarm ? R.foes(u).includes(t) : t.side === u.side));
  const results = targets.map(t => {
    const hp = t.hp, mp = t.mp, r = eff.apply(t);
    if (r && r.dmg === undefined && (t.hp !== hp || t.mp !== mp)) { r.restore = { hp: t.hp, mp: t.mp }; t.hp = hp; t.mp = mp; }   // held back until it lands
    return r && r.dmg !== undefined && R.SPELL_IMMUNE.includes(t.moveType) ? { immune: true } : r;
  });
  ui.toast(u.name + '　·　' + name, 1100);
  await script(spellCtx(u, at, targets, results, cells));
  cam.release();
  let gained = 0, killedAny = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i], r = results[i];
    if (r && !r.applied && !r.immune) landResult(t, r);   // (a script that never called ctx.hit)
    if (r && r.dmg !== undefined) { if (t.hp <= 0) { t.alive = false; killedAny = true; await killAnim(t); } }
    else if (r) gained += r.exp || 0;
  }
  if (!targets.length && !opts.arena) await ui.toast('沒有效果', 800);
  const first = targets[0];
  if (u.side === 'player' && first) {
    if (isHarm && first.side !== 'player') await gainExp(u, R.expFor(u, first, killedAny || !first.alive));
    else if (!isHarm) await gainExp(u, Math.min(gained, 50));
  }
}

// ---------------------------------------------------------------- turns
function showDanger(on) {
  if (!on) return [];
  const out = new Map();
  for (const e of G.units) if (e.alive && e.side === 'enemy' && !R.dormant(e)) for (const c of R.reach(e).values()) if (c.stop) for (const [x, y] of R.cellsInShape(c.x, c.y, e.rangeShape)) out.set(x + ',' + y, { x, y, c: C.danger });
  return [...out.values()];
}
let danger = false;
const after = () => opts.arena ? { over: false, trig: false } : R.afterAction();   // the arena has no win / loss
// a chest opens [ROM 0x1BAF2]: the hero faces it, the lid opens, the item is handed over; [design] that ends the turn
// the lid flies open with a burst of light (on the blow itself when the chest is struck)
// CHEST_RISE: seconds from the lid flying open to the item rising (was 0.3; struck, the whole swing's 1.3 s): 40% less, then 20% less again [the user's calls]
const CHEST_RISE = 0.144, CHEST_RISE_STRUCK = 0.624;
function popChest(ch) {
  const set = FX.look && FX.look.set; if (set && set.openChest) set.openChest(ch.x, ch.y);
  const P = tileCenter(ch.x, ch.y); vfx.burst(P.clone().setY(P.y + 0.5), { n: 24, speed: 1.4, cols: [[1, 0.9, 0.5], [1, 1, 0.85]], size: 0.04, life: 0.9, g: -0.4, up: 0.4 });
}
// a hero strikes a chest open: the lid flies on the blow, and the item rises while the swing ends
export async function strikeChest(u, at, ch) {
  let hit; const struck = new Promise(r => { hit = r; }), sw = swingAt(u, ...at, () => { popChest(ch); hit(); });
  await struck; await wait(CHEST_RISE_STRUCK * 1000); await Promise.all([sw, openChest(u, ch, true)]);
}
export async function openChest(u, ch, popped) {
  const it = R.openChest(u, ch), a = actorOf(u); placeActor(a);
  if (!popped) { popChest(ch); sfx(SND.hit); await wait(CHEST_RISE * 1000); }   // the original strikes the lid open (its attack routine's chest path, 0x0F3F2)
  if (it) sfx(SND.found);   // the find [ROM 0x0F616, as the item is shown]
  const give = it ? await chestFind(u, ch, it) : null;   // the item's icon rises out of the chest
  if (it) await ui.say(u.name + '得到了「' + it.name + '」！' + (G.found.includes(ch.item) && !u.items.includes(ch.item) ? '\n（放進了行囊）' : ''), null, 1800);
  if (give) await give();
}
export async function playerTurn(u) {
  const a = actorOf(u);
  queue.length = 0;                 // drop clicks made while animations were playing
  if (PG.queue.length) push({ k: 'PG' });
  for (;;) {
    const r = R.reach(u), home = { x: u.x, y: u.y, facing: u.facing };
    cam.release(); cam.focus(a.pos);
    const chests = R.chestTargets(u, r);   // a chest next to a reachable cell: pick it to open it (a hidden one is found by attacking it)
    const moveTiles = [...r.values()].map(c => ({ x: c.x, y: c.y, c: C.move }))
      .concat([...chests.values()].map(t => ({ x: t.chest.x, y: t.chest.y, c: C.chest, lift: 0.01 })));
    const redraw = () => tiles.set([...showDanger(danger), ...moveTiles]);
    redraw(); ui.hint(u.name + '　·　選擇移動位置（點自己＝原地）' + (opts.free ? '　·　測試：可點任意空格' : '')); ui.card(u); PG.popup = opts.test; if (opts.test) PG.sel = u;
    cursorTile = [u.x, u.y]; tiles.setCursor(...cursorTile);
    let dest = null;
    while (!dest) {
      const ev = await input();
      if (ev.k === 'PG') { dest = 'PG'; break; }
      if (ev.k === 'B' && opts.arena) { PG.popup = false; return 'cancel'; }
      if (ev.k === 'TAB') { danger = !danger; redraw(); continue; }
      if (ev.k === 'hover' || ev.k === 'DIR') {
        if (ev.k === 'DIR') { cursorTile = [R.clamp(cursorTile[0] + ev.d[0], 0, R.MAP_W - 1), R.clamp(cursorTile[1] + ev.d[1], 0, R.MAP_H - 1)]; cam.focus(tileCenter(...cursorTile)); }
        tiles.setCursor(...cursorTile);
        const n = r.get(R.key(...cursorTile)), ch = chests.get(R.key(...cursorTile));
        tiles.setPath(ch ? R.pathTo(r, ch.from.x, ch.from.y) : n && n.stop ? R.pathTo(r, ...cursorTile) : null);
        ui.card(R.unitAt(...cursorTile) || u); continue;
      }
      const t = ev.k === 'click' ? ev.t : ev.k === 'A' ? cursorTile : null;
      if (!t) continue;
      const n = r.get(R.key(...t)), ch = chests.get(R.key(...t));
      if (ch) dest = ch;
      else if (n && n.stop) dest = t;
      else if (opts.arena && R.unitAt(...t) && R.unitAt(...t).side === 'player' && R.unitAt(...t) !== u) { PG.popup = false; return { switch: R.unitAt(...t) }; }   // pick another hero
      else if (n && !n.stop) ui.toast('這裡已經有人了', 700);
      else if (opts.free && !R.unitAt(...t) && !R.chestAt(...t)) dest = { free: t };   // test start: any empty cell, out of reach or not
      else { const o = R.unitAt(...t); if (o) ui.card(o); }
    }
    tiles.set([]); tiles.setPath(null); tiles.setCursor(null); ui.hint(''); PG.popup = false;
    if (dest === 'PG') { await PG.flush(); if (!u.alive || !G.units.includes(u)) return 'cancel'; if (PG.endPhase) return 'cancel'; continue; }   // a test-toolbar action
    if (dest.chest) { await walkActor(u, R.pathTo(r, dest.from.x, dest.from.y)); await openChest(u, dest.chest); return 'acted'; }
    if (dest.free) { vfx.burst(a.chest(), { n: 14, speed: 1.4, cols: [[0.9, 0.95, 1], [1, 1, 1]], size: 0.035, life: 0.5, up: 0.3 }); [u.x, u.y] = dest.free; placeActor(a); vfx.burst(a.chest(), { n: 14, speed: 1.4, cols: [[0.9, 0.95, 1], [1, 1, 1]], size: 0.035, life: 0.5, up: 0.3 }); cam.focus(a.pos); }
    else await walkActor(u, R.pathTo(r, ...dest));
    if (after().over) return;
    const done = await commandMenu(u);
    if (done) return 'acted';
    u.x = home.x; u.y = home.y; u.facing = home.facing; placeActor(a);       // cancelled: back to where the turn began
  }
}
const MENU = [{ id: 'attack', ch: '攻', label: '攻擊', dx: 0, dy: -78 }, { id: 'magic', ch: '法', label: '法術', dx: -78, dy: 0 }, { id: 'item', ch: '物', label: '道具', dx: 78, dy: 0 }, { id: 'wait', ch: '待', label: '待機', dx: 0, dy: 78 }];
export let menuAnchor = null;
export async function commandMenu(u) {
  const a = actorOf(u);
  const chestNear = ([x, y]) => { const ch = u.side === 'player' && R.cellsInShape(u.x, u.y, u.rangeShape).some(([cx, cy]) => cx === x && cy === y) && R.chestAt(x, y); return ch || null; };   // a hero can break open a chest in his attack's reach (next to him; a bow's diagonals and two cells off: the user's call), a hidden one only this way
  const foeCells = () => R.cellsInShape(u.x, u.y, u.rangeShape).filter(([x, y]) => { const t = R.unitAt(x, y); return opts.arena ? !t || R.foes(u).includes(t) : t && R.foes(u).includes(t) || chestNear([x, y]); });   // the arena: empty tiles too
  const okMap = { attack: foeCells().length > 0, magic: u.spells.length > 0 && !u.status.seal, item: u.items.length > 0, wait: true };
  let sel = okMap.attack ? 0 : 3;
  cam.shot(a.pos, { dist: 10, pitch: 0.75, yaw: 0 });
  for (;;) {
    menuAnchor = a; ui.hint('選擇行動');
    let pick = null;
    const opts = MENU.map(m => Object.assign({}, m, { ok: okMap[m.id], onClick: i => push({ k: 'MENU', i }), onHover: i => { sel = i; ui.menu(opts, sel, ...menuPos()); } }));
    const draw = () => ui.menu(opts, sel, ...menuPos());
    draw();
    while (pick == null) {
      const ev = await input();
      if (ev.k === 'B') { ui.menu(null); menuAnchor = null; cam.release(); return false; }
      if (ev.k === 'MENU') pick = ev.i;
      if (ev.k === 'A') pick = sel;
      if (ev.k === 'DIR') { sel = { ArrowUp: 0, w: 0, ArrowLeft: 1, a: 1, ArrowRight: 2, d: 2, ArrowDown: 3, s: 3 }[ev.raw] ?? sel; draw(); }
    }
    ui.menu(null); menuAnchor = null;
    const choice = MENU[pick].id;
    if (!okMap[choice]) { ui.toast(choice === 'attack' ? '沒有可攻擊的目標' : choice === 'magic' ? (u.status.seal ? '被封法了' : '沒有法術') : '沒有道具', 800); continue; }
    if (choice === 'wait') { cam.release(); return true; }
    if (choice === 'attack') {
      const cells = foeCells();
      const at = await pickTarget(u, cells, cells, 0, C.atk, 'foe', true);
      if (!at) continue;
      const tgt = R.unitAt(...at), ch = !tgt && chestNear(at);
      if (tgt) await doAttack(u, tgt);
      else if (ch) await strikeChest(u, at, ch);
      else await swingAt(u, ...at);
      return true;
    }
    if (choice === 'magic') {
      const rows = u.spells.map(i => { const sp = D.spells[i]; return { icon: 'assets/spells/hd/' + String(sp.id).padStart(2, '0') + '.png', label: sp.name, right: '法力消耗 ' + sp.mp + ' 點', ok: sp.mp <= u.mp, desc: spellDesc(sp) }; });
      const k = await pickRing(a, rows); if (k == null) continue;
      const sp = D.spells[u.spells[k]];
      if (sp.mp > u.mp) { ui.toast('法力不足', 800); continue; }
      const range = R.cellsInShape(u.x, u.y, sp.range);
      const at = await pickTarget(u, range, range, sp.area, sp.kind === 13 ? C.harm : C.help, sp.kind === 13 ? 'foe' : 'ally');
      if (!at) continue;
      await castSpell(u, sp, at); return true;
    }
    if (choice === 'item') {
      const rows = u.items.map(i => ({ icon: 'assets/items/hd/' + String(i).padStart(2, '0') + '.png', label: D.items[i].name, right: '', ok: !!R.itemEffect(u, D.items[i]) && !D.items[i].equip, desc: itemDesc(i) }));
      const k = await pickRing(a, rows); if (k == null) continue;
      const it = D.items[u.items[k]], eff = R.itemEffect(u, it);
      if (!eff || it.equip) { ui.toast('無法使用', 800); continue; }
      const range = R.cellsInShape(u.x, u.y, it.range);
      const at = await pickTarget(u, range, range, it.area, eff.kind === 13 ? C.harm : C.help, eff.kind === 13 ? 'foe' : 'ally');
      if (!at) continue;
      await useItem(u, k, at); return true;
    }
  }
}
export function menuPos() { if (!menuAnchor) return [0, 0]; const p = project(menuAnchor.chest()); return [p.x, p.y]; }
// the item / spell ring round the unit (ui.ring): hover or the arrow keys point, a click or A picks, B goes back
export async function pickRing(a, rows) {
  let sel = Math.max(0, rows.findIndex(r => r.ok)), top = sel;   // top: turned to the top by the keys; the mouse points without turning it
  menuAnchor = a; ui.hint('');
  const draw = () => ui.ring(rows, sel, top, ...menuPos(), i => push({ k: 'RING', i }), i => { if (sel !== i) { sel = i; draw(); } });
  draw();
  const done = k => { ui.ring(null); menuAnchor = null; return k; };
  for (;;) {
    const ev = await input();
    if (ev.k === 'B') return done(null);
    if (ev.k === 'RING') return done(ev.i);
    if (ev.k === 'A') return done(sel);
    if (ev.k === 'DIR') { const d = { ArrowRight: 1, d: 1, ArrowDown: 1, s: 1, ArrowLeft: -1, a: -1, ArrowUp: -1, w: -1 }[ev.raw]; if (d) { sel = top = (sel + d + rows.length) % rows.length; draw(); } }
  }
}
export async function pickTarget(u, cells, range, area, color, prefer, attack) {
  const score = ([x, y]) => { const t = R.unitAt(x, y); if (!t) return 0; return prefer === 'ally' ? (t.side === u.side ? 2 : 0) : (R.foes(u).includes(t) ? 2 : 0); };
  const ordered = cells.slice().sort((a, b) => score(b) - score(a) || a[1] - b[1] || a[0] - b[0]);
  let i = 0, armed = false;
  const show = () => {
    const cur = ordered[i];
    const dim = prefer === 'ally' ? [0.12, 0.45, 0.2] : [0.6, 0.12, 0.08];   // every unit you could pick shows tinted
    tiles.set([...range.map(([x, y]) => ({ x, y, c: score([x, y]) ? dim : C.range })), ...R.areaCells(cur[0], cur[1], area).map(([x, y]) => ({ x, y, c: color, lift: 0.01 }))]);
    tiles.setCursor(...cur, true); targetMark.set(cur, prefer === 'ally' ? [0.2, 0.9, 0.35] : [0.95, 0.1, 0.06], gameT); cam.focus(tileCenter(...cur));
    const t = R.unitAt(...cur); ui.card(t || u);
  };
  ui.hint(attack ? '選擇攻擊目標' : '選擇施放位置'); show();
  for (;;) {
    const ev = await input();
    if (ev.k === 'B') break;
    if (ev.k === 'A') return done(ordered[i]);
    if (ev.k === 'click' || ev.k === 'hover') {
      const j = ordered.findIndex(c => c[0] === ev.t[0] && c[1] === ev.t[1]); if (j < 0) continue;
      if (ev.k === 'click' && j === i) return done(ordered[i]);
      if (j !== i) armed = false; i = j; if (ev.k === 'click') armed = true; show();
    }
    if (ev.k === 'DIR') { i = (i + ((ev.d[0] + ev.d[1]) > 0 ? 1 : ordered.length - 1)) % ordered.length; armed = false; show(); }
  }
  tiles.set([]); tiles.setCursor(null); targetMark.set(null); ui.forecast(null); ui.hint(''); return null;
  function done(c) { tiles.set([]); tiles.setCursor(null); targetMark.set(null); ui.forecast(null); ui.hint(''); return c; }
}
export async function aiTurn(u) {
  if (!R.wakes(u)) return;
  const a = actorOf(u); cam.release(); cam.focus(a.pos); ui.card(u);
  await wait(opts.arena ? 120 : 350);
  const plan = R.planAction(u, opts);
  if (u.side === 'enemy' && !opts.arena) { tiles.set([...plan.r.values()].map(c => ({ x: c.x, y: c.y, c: C.danger }))); await wait(450); tiles.set([]); }
  await walkActor(u, R.pathTo(plan.r, plan.cell.x, plan.cell.y));
  if (after().over) return;
  if (plan.kind === 'attack' && plan.target.alive) await doAttack(u, plan.target);
  else if (plan.kind === 'spell') await castSpell(u, plan.sp, plan.at);
}
export async function runBattle() {
  while (!G.over) {
    const ev = R.startRound();
    if (FX.roundStart) await FX.roundStart(E, ev);
    if (G.over) break;
    hudRound();
    const order = R.turnOrder();
    for (const v of G.units) v.done = false;
    PG.endPhase = false;
    for (let oi = 0; oi < order.length; oi++) {
      const u = order[oi];
      if (opts.test) {   // the test toolbar: its actions, our turns ended for the round, the enemies' turns off
        await PG.flush(); const res = after(); if (res.over) break;
        if (!G.units.includes(u) || (PG.endPhase && u.side === 'player') || (!PG.enemiesAct && u.side === 'enemy')) { u.done = true; continue; }
      }
      if (!u.alive || G.over) continue;
      ui.order(order.slice(oi).filter(v => v.alive), u);
      if (u.status.poison) { u.hp = Math.max(1, u.hp - 3); u.status.poison--; }
      if (u.status.sleep) { u.status.sleep--; u.done = true; if (u.side === 'player') { cam.focus(actorOf(u).pos); await ui.toast(u.name + ' 正在睡眠', 800); } continue; }
      if (u.status.seal) u.status.seal--;
      G.active = u;
      const step = R.roomExit();   // a battle in rooms: a hero on an exit takes the party on (or back), and the round starts over
      if (step) { G.active = null; await enterRoom(G.room + step, step < 0); break; }
      const lines = R.beforeTurn(u);   // the battle's turn hook: scripted lines (and wake-ups) before this unit moves
      if (G.joined && G.joined.length) await joinHeroes(G.joined.splice(0));   // units the hook brought in (battle 4's 楊戩, battle 7's reinforcements)
      if (lines) { for (const l of lines) { cam.release(); if (l.unit) cam.focus(actorOf(l.unit).pos); await ui.say(l.text, l.who || null); } if (!u.alive || G.over) { G.active = null; continue; } }
      if (u.side === 'player' && !opts.auto && !u.guest) await playerTurn(u); else await aiTurn(u);   // a guest (文王) moves by his AI
      G.active = null; u.done = true; ui.card(null);
      const res = after();
      if (res.trig && FX.trigger) await FX.trigger(E);
      if (res.over) break;
    }
    if (G.round > 40) G.over = { win: false, why: '時間耗盡' };
  }
  return G.over;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
// the frame governor: the render scale (pixel ratio) that keeps a steady 60 Hz. It shrinks when frames are missed (2 of 30
// over 21 ms; by the
// GPU cost measured with world.takeGpu, pixels ~ scale², where there is a timer) and grows only with clear GPU headroom
// (without a timer: after 2 s of full-rate frames). It starts within a pixel
// budget, changes in 0.05 steps only, never right after a change (each one reallocates the post chain: a hitch), and a
// scale that proved too slow becomes a ceiling, so it settles instead of see-sawing. Frames over 120 ms (loading a world,
// compiling shaders) are not counted. #fps shows it; #noscale turns it off.
const perf = { acc: 0, n: 0, scale: 0, max: Math.min(1.5, window.devicePixelRatio || 1), min: 0.6, cool: 0, fps: 0, gpu: 0, good: 0, ceil: 9, ceilAt: 0, floor: 0, miss: 0, before: 0, show: /fps/.test(location.hash) };
const BUDGET = 12, PIXELS = 2.6e6;   // GPU ms aimed at when there is room to grow (60 Hz leaves 16.7); start at most this many pixels
const step = k => Math.round(Math.min(perf.max, Math.max(perf.min, k)) * 20) / 20;
export function governor(ms) {
  if (/noscale/.test(location.hash)) return;
  if (!perf.scale) { perf.scale = step(Math.min(perf.max, Math.sqrt(PIXELS / (window.innerWidth * window.innerHeight)))); world.setScale(perf.scale); perf.cool = 1; }
  if (ms > 120) { perf.acc = perf.n = perf.miss = 0; world.takeGpu(); return; }
  perf.acc += ms; perf.n++; if (ms > 21) perf.miss++;
  if (perf.n < 30) return;
  const avg = perf.acc / perf.n, gpu = world.takeGpu(), missed = perf.miss >= 2; perf.fps = 1000 / avg; perf.gpu = gpu; perf.acc = perf.n = perf.miss = 0;
  if (perf.cool > 0) { perf.cool--; return; }
  let k = perf.scale;
  if (perf.before && gpu != null) { if (gpu > perf.before.gpu * 0.85) perf.floor = perf.before.scale; perf.before = 0; }   // a drop that saved little: the cost is not in the pixels, stop shrinking
  if (missed) k *= gpu != null && gpu > BUDGET ? Math.max(0.75, Math.sqrt(BUDGET / gpu)) : avg > 28 ? 0.8 : 0.9;   // frames missed
  else if (gpu != null ? gpu < BUDGET * 0.8 : avg < 17.6 && ++perf.good >= 4) { perf.good = 0; k = gpu != null ? Math.min(k * 1.15, k * Math.sqrt(BUDGET / gpu)) : k * 1.08; }   // clear headroom
  if (k < perf.scale) { perf.ceil = Math.min(perf.ceil, perf.scale - 0.05); perf.ceilAt = performance.now(); perf.good = 0; }
  else if (perf.ceil < 9 && performance.now() - perf.ceilAt > 30000) { perf.ceil += 0.05; perf.ceilAt = performance.now(); }   // a heavy stretch (a big spell) does not cap it for good
  k = step(Math.max(Math.min(k, perf.ceil), perf.floor));
  if (Math.abs(k - perf.scale) >= 0.05) { if (k < perf.scale && gpu != null) perf.before = { gpu, scale: perf.scale }; perf.scale = k; world.setScale(k); perf.cool = 2; }
  if (perf.show) $('fps').textContent = perf.fps.toFixed(0) + ' fps · ' + (gpu != null ? gpu.toFixed(1) + ' ms GPU · ' : '') + (perf.scale * 100 | 0) + '%';
}
export const perfState = () => ({ fps: perf.fps, gpu: perf.gpu, scale: perf.scale, ceil: perf.ceil, floor: perf.floor });
export function frame(now) {
  const ms = now - last; if (cam && ready) governor(ms);
  const rdt = Math.max(0, Math.min(0.05, ms / 1000)); last = Math.max(last, now);   // a frame stamped before the last one counts as no time
  let dt = rdt * timeScale;
  if (vfx && vfx.hitstop > 0) { vfx.hitstop -= rdt; dt *= 0.04; }
  gameT += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.d); w.fn && w.fn(k, dt); if (k >= 1) { tweens.splice(i, 1); w.res(); } }
  if (cam && ready) {
    canvasRect = world.renderer.domElement.getBoundingClientRect();
    cam.update(rdt, vfx ? vfx.screen.shake : 0);
    const f = G.active && actorOf(G.active) ? actorOf(G.active).pos : cam.target;   // see-through follows the acting unit, never the cursor
    WU.focus.value.copy(f).setY(f.y + 0.6);
    world.shadowsLive = tweens.length > 0; for (const a of actors.values()) if (a.walking) world.shadowsLive = true;   // anything animating (a walk, a blow): shadows every frame, or they trail the sprites at half rate
    world.update(dt, gameT);
    vfx.update(dt, gameT); if (!world.calm) vfx.ambient(dt, cam.target); vfx.fire.mat.uniforms.uYaw.value = cam.yaw;
    vfx.add.mat.uniforms.uScale.value = vfx.soft.mat.uniforms.uScale.value = world.renderer.domElement.height / (2 * Math.tan(world.camera.fov * Math.PI / 360));
    for (const a of actors.values()) a.update(gameT, world.camera, cam.yaw, cam.pitch);
    tiles.update(gameT); activeMark.update(gameT, G.active ? actorOf(G.active) : null); targetMark.update(gameT);
    ui.layout(project, [...actors.values()], dt, !$('hud').classList.contains('hidden'));
    if (menuAnchor) { const [x, y] = menuPos(); for (const m of [$('menu'), $('ring')]) if (m) { m.style.left = x + 'px'; m.style.top = y + 'px'; } }
    if (PG.frame) PG.frame();
    world.render();
    if (window.__qaFrame) window.__qaFrame();   // #qa probes read the frame just drawn (src/qa.js)
  }
  requestAnimationFrame(frame);
}
export function resize() { world.resize(window.innerWidth, window.innerHeight); }

// a swing at an empty tile (the arena only): a stand-in target with just enough of an actor for the attack animation
export async function swingAt(au, x, y, onHit) {
  R.faceTo(au, x, y);
  const p = tileCenter(x, y), stand = { pos: p, off: new THREE.Vector2(), hover: 0, act: null, flash: 0,
    chest() { return V(p.x, p.y + 0.5, p.z); }, head() { return V(p.x, p.y + 1.05, p.z); } };
  await attackAnim(au, { side: 'none', facing: 'left', stand }, { miss: false, crit: !onHit && Math.random() < 0.25, dmg: 0 }, onHit);   // a chest: no critical pause before the blow
}
// the battle's HUD line: the round, and the battle's own meter when it has one (磻溪's fire)
export function hudRound() { ui.round(G.round, R.H.hud ? R.H.hud(G) : null); }
// lay out a battle: units on their cells, then the battle's own staging (磻溪's burning forest)
export function stage(chosen) {
  R.setupBattle(chosen); ui.clearUnits(); syncActors();
  for (const a of actors.values()) { placeActor(a); a.dissolve = a.u.alive ? 0 : 1; }
  vfx.fire.cols.clear();
  if (FX.stage) FX.stage(E);
}
// the test tools fill these in (src/testkit.js); toolbar actions queue up and run at safe points in a turn
export const PG = { queue: [], popup: false, endPhase: false, enemiesAct: true, sel: null, flush: async () => {}, frame: null };

// once per page: the renderer, camera rig, UI, input and the frame loop
let ready = false;
export function boot() {
  world = new World($('gl'));
  window.addEventListener('resize', resize); resize();
  bank = new SpriteBank(); ui = new UI(bank); cam = new Cam(world.camera);
  setupInput();
  window.__remake = { G, R, actors, cam, tiles, C, vfx, world, W: world, push, opts, castSpell, scripted, syncActors, placeActor, levelUpAnim, levelPose: LEVEL_POSE, bank, doAttack, useItem, openChest, strikeChest, swingAt, popChest, tileCenter, actorOf, perfState };
  requestAnimationFrame(frame);
}
// build the world for the loaded battle (R.loadBattle first) and load its sprites; again for every new battle
export async function loadWorld(fx, progress) {
  ready = false; FX = fx || {};
  for (const a of actors.values()) a.dispose(world.scene);
  actors.clear(); ui.clearUnits(); G.units = []; G.active = null;
  world.reset();
  setLook(FX.look || { mapSD: 'assets/battles/' + String(D.n).padStart(2, '0') + '/map.png' });
  await world.build(p => progress && progress(p * 0.8));
  resize();
  vfx = new VFX(world); tiles = new Tiles(world.scene); activeMark = new ActiveMark(world.scene); targetMark = new TargetMark(world.scene);
  const names = new Set([...D.party, ...D.enemies, ...(D.rooms || []).flatMap(r => r.enemies.flatMap(e => e.summon ? [e, e.summon] : [e]))].map(u => u.sprite).concat(FX.sprites || [])
    .concat(opts.test ? globalThis.COMMON.heroes.map(h => spriteKey(h.gfx)) : []));   // the test tools can bring in any hero
  await bank.load([...names]);
  progress && progress(1);
  if (!(FX.look && FX.look.set)) measureLight();   // a remade set measures once it is dressed (main.js openBattle)
  Object.assign(window.__remake, { tiles, vfx, groundLum: () => groundLum });
  ready = true;
}
