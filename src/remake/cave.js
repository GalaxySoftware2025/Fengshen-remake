// 海龍洞, the sea dragon's cave (maps 0ee250 and 0ee27c: scene 19; battle 10's four rooms, the first and last of them
// those two maps), remade as a grotto under the sea: wet teal rock floors streaked by the tide and rippled by the sea's
// light from above, walls of dark blue-grey rock crusted with barnacles (the art's pale speckle) rising into the black,
// kelp swaying at their feet, pools of deep moving water, barnacled rock spires, grey pebbles on the floor, shallow
// puddles that splash round the feet of whoever walks through them, and now and then a string of bubbles rising out of
// a crack or a pool (the user's calls: not pink, a sea cave; no shells; splashes as the grass is trodden). Built
// from the room's own grid: open cells are floor (the passages on, terrain 4, and back, 3, dark tunnels in the wall),
// the void (terrain 1) is the cave's wall, terrain 2 a pool where the art is water, else a rock outcrop, or a spire
// standing alone. The first room's west shelf and the last room's hall are a step up, each reached by one stair; the
// other floors are level (the art's ledges and steps in rooms 1 and 2 join the floors at both ends: drawn, not climbed).
// Measured on the rooms' art (assets/battles/10/room-K.png) and grids.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, Land, CL, grass, stones, steppers } from '../kit/terrain.js';
import { terraces, terracedAt } from '../kit/hill.js';
import { D, G } from '../rules.js';

const PALETTE = { [CL.ground]: [0x004848, 0x006c6c, 0x00b4b4, 0x244848, 0x009090], [CL.water]: [0x000048, 0x004890, 0x48b4fc] };
const UP = 0.75, LEDGE_H = 0.6;
// per room (by its art): the stair [x0, z0, x1, z1] from the step up (north end) down, a cell of each floor and its
// level, the cell the party comes in from (the flood fill's start), the scene's cast spots off the grid (way in)
const ROOMS = {
  '0ee250': { start: [4, 11], levels: [[4, 11, 0], [4, 3, UP]], stairs: [{ r: [5, 7, 7, 8], y0: UP, y: 0, n: 4 }], way: [[0, 14, 6, 15]] },
  room1: { start: [19, 2], levels: [[19, 2, 0]], stairs: [], deco: [{ r: [20, 9, 22, 10], n: 4 }] },
  room2: { start: [5, 13], levels: [[5, 13, 0]], stairs: [], deco: [{ r: [9, 8, 11, 9], n: 4 }, { r: [19, 8, 21, 9], n: 4 }] },
  '0ee27c': { start: [11, 12], levels: [[11, 12, 0], [10, 5, UP]], stairs: [{ r: [9, 8, 11, 9], y0: UP, y: 0, n: 4 }], way: [] },
};
const ART = { '0ee250': 'assets/maps/0ee250.png', room1: 'assets/battles/10/room-1.png', room2: 'assets/battles/10/room-2.png', '0ee27c': 'assets/maps/0ee27c.png' };
const ROOM_KEYS = ['0ee250', 'room1', 'room2', '0ee27c'];
let bub = null, spl = null, wetCells = [], land = null, chestG = new Map(), M = null, world = null, cur = null;

// the void's side of an exit cell (where its tunnel opens): the first neighbour that is void
const voidSide = (tc, x, y) => [[0, -1], [1, 0], [-1, 0], [0, 1]].find(([dx, dy]) => tc(x + dx, y + dy) === 1) || [0, -1];
// a spire: three or four barnacled rock cones leaning together
function spire(mat, x, z, y, s) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const h = s * (0.9 - k * 0.18), r = s * (0.24 - k * 0.03), c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 3), mat);
    const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setX(i, p.getX(i) * (1 + Math.sin(yy * 9 + k) * 0.12)); }
    c.geometry.computeVertexNormals();
    c.position.set(x + (k ? Math.cos(k * 2.2) * s * 0.22 : 0), y + h / 2 - 0.05, z + (k ? Math.sin(k * 2.2) * s * 0.16 : 0)); c.rotation.set(Math.sin(k) * 0.12, k, Math.cos(k) * 0.12);
    g.add(c);
  }
  return shade(g);
}
// a tunnel on: a black arch in the wall over the exit cell, ragged rock round it
function tunnel(rockM, x, z, y, side) {
  const g = new THREE.Group(), w = 0.9, h = 1.3;
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h * 0.55); sh.absarc(0, h * 0.55, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshBasicMaterial({ color: 0x010203 }));
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h * 0.8, 1.6), new THREE.MeshBasicMaterial({ color: 0x010203 })); back.position.set(0, h * 0.4, -0.82);
  const arch = new THREE.Group(); arch.add(hole, back);
  for (let k = 0; k < 9; k++) { const a = Math.PI * k / 8, r = w / 2 + 0.12, b = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (k % 3) * 0.03, 1), rockM)); b.position.set(-Math.cos(a) * r, h * 0.55 + Math.sin(a) * r - (k === 0 || k === 8 ? 0.5 : 0), 0.05); arch.add(b); }
  const [dx, dz] = side; arch.rotation.y = Math.atan2(-dx, -dz); arch.position.set(x + dx * 0.45, y, z + dz * 0.45); g.add(arch);
  return g;
}

// the sea's light from above, rippling over the floor: a web of bright lines drifting slowly (game time, SEA.uTime)
const SEA = { uTime: { value: 0 } };
function caustics(mesh) {
  const mat = mesh.material, base = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    base(sh); sh.uniforms.uSeaT = SEA.uTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uSeaT;
      float causL(vec2 p, float t){ float a = sin(p.x * 2.1 + sin(p.y * 1.7 + t) * 1.3 + t * 0.6) * sin(p.y * 2.3 + sin(p.x * 1.5 - t * 0.8) * 1.3 - t * 0.5); return pow(1.0 - abs(a), 7.0); }
      float caus(vec2 p, float t){ return causL(p * 1.3, t * 0.55) * 0.6 + causL(p * 2.2 + 3.7, t * 0.75) * 0.4; }`)
      .replace('diffuseColor.rgb = col;', 'diffuseColor.rgb = col * (1.0 + caus(vLW.xz, uSeaT) * 0.5 * smoothstep(0.8, 0.95, n.y));');
  };
}
// kelp: two or three dark ribbons from one foot, waving slowly as in a current (more the higher up)
function kelp(pts) {
  const geo = new THREE.BufferGeometry(), pos = [], uv = [], idx = [], N = 7;
  for (let r = 0; r < 3; r++) {
    const a = r * 2.1, ca = Math.cos(a), sa = Math.sin(a), o = pos.length / 3;
    for (let i = 0; i <= N; i++) { const k = i / N, w = 0.1 * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.12)), lean = k * k * 0.18, h = k * (1 - r * 0.18);
      pos.push(ca * lean - sa * w, h, sa * lean + ca * w, ca * lean + sa * w, h, sa * lean - ca * w); uv.push(0, k, 1, k);
      if (i) { const b = o + (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a8a44, roughness: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSeaT = SEA.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSeaT; varying float vK;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 1.9 + instanceMatrix[3].z * 2.7; float hh = position.y; vK = uv.y;
      transformed.x += sin(uSeaT * 0.9 + ph - hh * 2.4) * 0.16 * hh * hh; transformed.z += cos(uSeaT * 0.7 + ph - hh * 2.0) * 0.08 * hh * hh;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vK;').replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= mix(0.35, 1.15, vK);')   // darker at the foot
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal *= faceDirection;');   // both faces lit alike
  };
  mat.customProgramCacheKey = () => 'caveKelp';
  const m = new THREE.InstancedMesh(geo, mat, pts.length), d = new THREE.Object3D(), c = new THREE.Color();
  pts.forEach(([x, y, z, s], i) => { d.position.set(x, y - 0.03, z); d.rotation.set(0, Math.random() * 6.3, 0); d.scale.setScalar(s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); const t = 0.75 + Math.random() * 0.4; m.setColorAt(i, c.setRGB(t * 0.9, t, t * (0.7 + Math.random() * 0.3))); });
  m.renderOrder = 1; mat.depthWrite = false;   // as grass: drawn before the characters, a unit in front shows whole
  m.receiveShadow = true; m.userData.noAO = true; return m;
}
// the shallows: a film of still water on chosen floor cells (soft-edged, glossy, darker than the floor), one sheet per
// floor level, drawn over the floor and under the squares (a see-through sheet: the squares' ground reading leaves it out)
function shallows(S, cells, level, MW, MH) {
  const K = 16, byLevel = new Map();
  for (const c of cells) { const lv = level(c[0], c[1]); (byLevel.get(lv) || byLevel.set(lv, []).get(lv)).push(c); }
  for (const [lv, list] of byLevel) {
    const cv = document.createElement('canvas'); cv.width = MW * K; cv.height = MH * K; const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    const wet = new Set(list.map(c => c.join(','))), blob = (cx, cy, r) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };
    g.globalCompositeOperation = 'lighten';   // (overlaps do not add up)
    for (const [x, y] of list) {   // a puddle: a blob with a few lobes; wet neighbours joined by a blob between them, as one stretch of shallows
      blob((x + 0.5) * K, (y + 0.5) * K, K * 0.44);
      for (const [dx, dy] of [[1, 0], [0, 1]]) if (wet.has((x + dx) + ',' + (y + dy))) blob((x + 0.5 + dx / 2) * K, (y + 0.5 + dy / 2) * K, K * 0.44);
      for (let k = 0; k < 3; k++) { const h = Math.sin(x * 12.9898 + y * 78.233 + k * 3.1) * 43758.5453, f = h - Math.floor(h), a = k * 2.1 + f * 3;
        blob((x + 0.5 + Math.cos(a) * 0.2) * K, (y + 0.5 + Math.sin(a) * 0.18) * K, K * (0.2 + f * 0.1)); }
    }
    const mask = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a3e4a, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3, alphaMap: mask, transparent: true, opacity: 0.62, depthWrite: false }));
    m.material.onBeforeCompile = sh => {   // a faint sheen drifting over the water, so it reads as wet and not as a stain
      sh.uniforms.uSeaT = SEA.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSeaT; varying vec2 vSW;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sw = sin(vSW.x * 7.0 + sin(vSW.y * 5.0 + uSeaT * 0.9) * 1.6 + uSeaT * 0.7) * sin(vSW.y * 6.0 - uSeaT * 0.6 + sin(vSW.x * 4.0) * 1.2);
          totalEmissiveRadiance += vec3(0.45, 0.8, 0.9) * pow(max(0.0, sw), 6.0) * 0.35;`);
    };
    m.material.customProgramCacheKey = () => 'caveShallows';
    m.position.set(MW / 2, lv + 0.035, MH / 2); m.renderOrder = 1; m.receiveShadow = true; S.add(m);
  }
}
// splashes: a character walking on the cave's wet floor (any cell of it, the user) splashes at every step (about a quarter of a cell): a few drops pop
// round the stepping shoe, more flick off it, backward and to the sides, and fall back into the water (no ring: the
// user). Drawn over the walker's own sprite (it stands 0.12 in front of its feet: drops behind it were lost walking up
// or down, the user). Who is where is read from the characters the trodden grass reads (kit/terrain.js steppers), so a
// walk, a lunge or a push splashes alike; fliers (hovering) do not. Game time throughout
function dropTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const f = g.createRadialGradient(16, 16, 0, 16, 16, 15); f.addColorStop(0, 'rgba(240,252,255,1)'); f.addColorStop(0.5, 'rgba(200,240,255,0.8)'); f.addColorStop(1, 'rgba(200,240,255,0)');
  g.fillStyle = f; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function splasher(S, isWet, waterY) {
  const tex = dropTex(), drops = [], free = [], last = new Map(), rnd = (a, b) => a + Math.random() * (b - a), Gs = new THREE.Group(); S.add(Gs);
  let side = 1;
  const drop = (x, y, z, vx, vy, vz, size) => { const d = free.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    d.renderOrder = 6; d.scale.setScalar(size); Gs.add(d); drops.push({ s: d, x, y, z, vx, vy, vz, y0: y - 0.01, age: 0 }); };
  // ux, uz: the way the walker goes (unit)
  const splash = (x, y, z, ux, uz) => {
    tick.count++; side = -side;
    const fx = x - uz * 0.08 * side, fz = z + ux * 0.08 * side + 0.13;   // the stepping shoe, at the sprite's foot (in front of the feet)
    for (let i = 0, n = 3 + Math.floor(Math.random() * 2); i < n; i++) drop(fx + rnd(-0.05, 0.05), y + rnd(0.01, 0.05), fz + rnd(-0.02, 0.02), rnd(-0.12, 0.12), rnd(0.35, 0.65), rnd(-0.06, 0.06), rnd(0.025, 0.04));   // on the shoe
    for (let i = 0, n = 5 + Math.floor(Math.random() * 3); i < n; i++) { const back = rnd(0.15, 0.45), across = rnd(-0.5, 0.5);   // off the shoe: flicked back and out
      drop(fx, y + rnd(0.03, 0.07), fz, -ux * back - uz * across, rnd(0.7, 1.15), Math.max(-0.06, -uz * back + ux * across * 0.7), rnd(0.022, 0.038)); }   // (not far away from the camera: on screen they would climb up over the walker's body)
  };
  const tick = (dt, t) => {
    for (const a of steppers) {
      if (!a.root.visible || a.root.parent !== S || a.hover > 0.15 || a.dissolve > 0.5 || (a.fade ?? 1) < 0.5) { last.delete(a); continue; }
      const x = a.pos.x + a.off.x, z = a.pos.z + a.off.y, p = last.get(a);
      if (!p) { last.set(a, { x, z, go: 0 }); continue; }
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); p.x = x; p.z = z;
      if (d > 0.5 || !isWet(Math.floor(x), Math.floor(z))) { p.go = 0.2; continue; }   // (a jump, or off the floor: the first step back on it splashes at once)
      if ((p.go += d) >= 0.24) { p.go = 0; splash(x, waterY(x, z), z, dx / d, dz / d); }
    }
    for (let i = drops.length - 1; i >= 0; i--) { const q = drops[i]; q.age += dt; q.vy -= 6.5 * dt; q.x += q.vx * dt; q.z += q.vz * dt; q.y += q.vy * dt;
      if (q.y < q.y0) { Gs.remove(q.s); free.push(q.s); drops.splice(i, 1); continue; } q.s.position.set(q.x, q.y, q.z); q.s.material.opacity = Math.min(1, 1.5 - q.age * 2); }
  };
  tick.count = 0; tick.splash = splash; tick.show = on => { Gs.visible = on; }; return tick;
}
// bubbles: now and then one of the vents (a crack in the floor, a pool) lets go a string of four to ten, rising and
// wobbling, growing a little, gone at the top (game time: they keep to the freeze, the fast-forward and the video)
function bubbleTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const f = g.createRadialGradient(32, 32, 10, 32, 32, 29); f.addColorStop(0, 'rgba(190,235,255,0.06)'); f.addColorStop(0.75, 'rgba(200,240,255,0.22)'); f.addColorStop(1, 'rgba(230,250,255,0.9)');
  g.fillStyle = f; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(23, 21, 7, 4.5, -0.7, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bubbler(S, vents) {
  const tex = bubbleTex(), free = [], live = [], rnd = (a, b) => a + Math.random() * (b - a);
  let next = rnd(0.8, 2), now = 0;
  const burst = (x, y, z, wide) => { const n = 4 + Math.floor(Math.random() * 7);
    for (let k = 0, at = now; k < n; k++, at += rnd(0.07, 0.22)) live.push({ x: x + rnd(-1, 1) * wide, y, z: z + rnd(-1, 1) * wide, at, r: rnd(0.035, 0.08), ph: rnd(0, 6), vy: rnd(0.55, 0.85), top: rnd(1.4, 2.6), s: null }); };
  const tick = (dt, t) => {
    now = t;
    if ((next -= dt) <= 0 && vents.length) { next = rnd(1.0, 2.8); burst(...vents[Math.floor(Math.random() * vents.length)]); }
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i], age = t - b.at; if (age < 0) continue;
      if (!b.s) { b.s = free.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true })); b.s.renderOrder = 3; S.add(b.s); }
      const up = age * b.vy * (1 + age * 0.2), k = up / b.top;
      if (k >= 1) { S.remove(b.s); free.push(b.s); live.splice(i, 1); continue; }
      b.s.position.set(b.x + Math.sin(age * 5 + b.ph) * 0.045, b.y + 0.04 + up, b.z + Math.cos(age * 4 + b.ph) * 0.025);
      b.s.scale.setScalar(b.r * 2 * (1 + k * 0.6)); b.s.material.opacity = Math.min(1, age / 0.12) * (1 - Math.max(0, (k - 0.75) / 0.25));
    }
  };
  tick.burst = burst; return tick;
}

function setFor(fixedKey) {
  const keyNow = () => fixedKey || ROOM_KEYS[D.rooms ? G.room || 0 : 0];
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const key = keyNow(), R0 = ROOMS[key]; cur = key;
    const MW = D.mapW, MH = D.mapH, W = MW * 4;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const lay = await readLayout(ART[key], MW, MH, PALETTE, { [CL.water]: 1.5 });
    // terrain 2: a pool where most of the cell is water in the art, else rock; standing alone, a stalagmite
    const wet = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.water ? 1 : 0; return n >= 6; };
    const pool = (x, y) => tc(x, y) === 2 && wet(x, y), lone = (x, y) => tc(x, y) === 2 && !pool(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tc(x + dx, y + dy) === 2 || tc(x + dx, y + dy) === 1).length <= 1;   // (the wall counts: a rim cell is wall)
    const way = (x, y) => (R0.way || []).some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d);   // the scene's way in from off the grid
    const flat = (x, y) => pool(x, y) || lone(x, y) || way(x, y);
    const ledge = (x, y) => tc(x, y) === 2 && !pool(x, y) && !lone(x, y);   // terrain 2 that is neither water nor a stalagmite
    const t = terraces({ w: MW, h: MH, terrain: D.terrain, start: R0.start, levels: R0.levels, stairs: R0.stairs, flat });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (y * 4 + j) * W + x * 4 + i;
      lay[k] = t.walk(x, y) || way(x, y) || lone(x, y) ? CL.ground : pool(x, y) ? (lay[k] === CL.water ? CL.water : CL.grass) : ledge(x, y) ? CL.grass : CL.rock;   // (a pool's shore as the art draws it)
    }
    // the ledges: teal rock a step up from the floor beside them, their edges falling steeply (a field softened once)
    let LE = new Float32Array(W * MH * 4); for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) LE[j * W + i] = ledge(i >> 2, j >> 2) ? 1 : 0;
    { const N = new Float32Array(LE.length); for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) { let a = 0, n = 0; for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const ii = i + c, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= MH * 4) continue; a += LE[jj * W + ii]; n++; } N[j * W + i] = LE[j * W + i] ? a / n : 0; } LE = N; }
    const ledgeAt = (x, z) => { const i = Math.floor(x * 4), j = Math.floor(z * 4); if (i < 0 || j < 0 || i >= W || j >= MH * 4) return 0; const v = LE[j * W + i]; return v * v * (3 - 2 * v); };
    const outside = () => CL.rock;
    land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside, rockH: 1.8, rise: 2.6, lumpH: 0.03, waterDepth: 0.7,
      cap: (x, z) => z < MH - 0.7 ? 99 : 0.45 + Math.max(0, z - MH) * 0.5,
      ramps: R0.stairs.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
      tex: { dirt: T.dirt(0x1e7470, 'caveFloor'), turf: T.rock(0x1a5a58, 'caveLedge', 0.3), rock: T.seaRock(0x2c3a46, 'caveWall'), rockTop: T.rock(0x0a1216, 'caveTop', 0.3) },
      tint: { dirt: 0xc8fff8, turf: 0xb8f0e8, rock: 0xd0e4ec } });
    const base = terracedAt(land, t);
    land.at = (x, z) => way(Math.floor(x), Math.floor(z)) ? 0 : base(x, z) + ledgeAt(x, z) * LEDGE_H;
    const ground = land.mesh({ dirtK: 0.35, rockK: 0.5, topGreen: 0, bed: 0x0a1630 }); caustics(ground); S.add(ground);
    // the pools: deep blue water a little under the floor beside them, slowly moving
    const seen = new Set(), vents = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!pool(x, y) || seen.has(x + ',' + y)) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y, lv = 9;
      for (const q = [[x, y]]; q.length;) { const [a, b] = q.pop(); if (!pool(a, b) || seen.has(a + ',' + b)) continue; seen.add(a + ',' + b); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); lv = Math.min(lv, t.level(a, b)); q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      FX.water(S, { r: [x0 - 0.3, y0 - 0.3, x1 + 1.3, y1 + 1.3], y: lv - 0.22, deep: 0x041c34, lit: 0x12506e, stars: 0 });   // (no glints: in the dark they read as a night sky)
      for (const [a, b] of [...seen].map(k => k.split(',').map(Number)).filter(([a, b]) => pool(a, b) && a >= x0 && a <= x1 && b >= y0 && b <= y1 && Math.random() < 0.35)) vents.push([a + 0.5, lv - 0.22, b + 0.5, 0.25]);   // bubbles out of the pool
    }
    const rockM = T.material(T.seaRock(0x3a4852, 'caveStone'), { color: 0xe4eef2 }, [0.5, 0.5]);
    const spireM = T.material(T.seaRock(0x46545c, 'caveSpire'), { color: 0xeef4f4 }, [0.6, 0.6]);
    const pebM = T.material(T.rock(0x5a6468, 'cavePebble', 0.2), { color: 0xe8eef0, roughness: 0.5 }, [0.5, 0.5]);
    loneCells = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (lone(x, y)) { S.add(spire(spireM, x + 0.5, y + 0.55, land.at(x + 0.5, y + 0.5), 0.9)); loneCells.push([x, y]); }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) S.add(tunnel(rockM, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), voidSide(tc, x, y)));
    // the art's steps where a ledge is drawn and not climbed: flat stone slabs set in the floor
    const slab = T.material(T.bricks(0x2a6a66, 2, 'caveSlab'), {}, [1, 1]);
    for (const d of R0.deco || []) { const [x0, z0, x1, z1] = d.r, parts = []; for (let k = 0; k < d.n; k++) { const za = z0 + (z1 - z0) * k / d.n; parts.push(box(slab, x0 + 0.08, -0.04, za + 0.02, x1 - 0.08, 0.03, za + (z1 - z0) / d.n - 0.02)); } S.add(shade(merged(slab, parts))); }
    for (const s of R0.stairs) {   // stone steps on the stairs
      const [x0, z0, x1, z1] = s.r, dz = (z1 - z0) / s.n, parts = [];
      for (let k = 0; k <= s.n; k++) { const h = s.y0 + (s.y - s.y0) * k / s.n, za = z0 + Math.max(0, k - 0.5) * dz, zb = z0 + Math.min(s.n, k + 0.5) * dz; parts.push(box(slab, x0 + 0.06, h - 0.12, za + 0.01, x1 - 0.06, h + 0.03, zb - 0.01)); }
      S.add(shade(merged(slab, parts)));
    }
    // the room's chests (as they were left: a battle in rooms keeps them per room)
    const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => Object.assign({ open: false }, c));   // (before the battle is set up: the room's own)
    for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, land.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(g); chestG.set(c.x + ',' + c.y, g); }
    // grey pebbles and dark sea-weed in the floor's cracks (not in the shallows); kelp at the walls' feet and round the pools
    const clear = (x, z) => !chests.some(c => x > c.x - 0.2 && x < c.x + 1.2 && z > c.y - 0.2 && z < c.y + 1.2) && !t.inStair(x, z);
    // the shallows: floor cells beside a pool, and a few others here and there (the same cells on every visit)
    const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7 + ROOM_KEYS.indexOf(key) * 74.7) * 43758.5453; return h - Math.floor(h); };
    const dryCell = (x, y) => !t.walk(x, y) || t.inStair(x + 0.5, y + 0.5) || chests.some(c => c.x === x && c.y === y);
    const wetSet = new Set();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!dryCell(x, y) && ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => pool(x + dx, y + dy)) || hash(x, y) < 0.05)) wetSet.add(x + ',' + y);
    wetCells = [...wetSet].map(k => k.split(',').map(Number));
    shallows(S, wetCells, (x, y) => t.level(x, y), MW, MH);
    const isWet = (x, y) => wetSet.has(x + ',' + y);
    const onFloor = (x, z) => clear(x, z) && t.walk(Math.floor(x), Math.floor(z)) && !isWet(Math.floor(x), Math.floor(z));
    S.add(stones(land.scatter(CL.ground, 0.9, onFloor), pebM, { size: 0.07 }));
    S.add(grass(land.scatter(CL.ground, 0.5, onFloor), { size: 0.3, cols: ['#2a6a4c', '#347a54', '#225e44'] }));
    S.add(stones(land.scatter(CL.rock, 1.4, (x, z) => land.weight(x, z, CL.ground) > 0.1), rockM, { size: 0.2 }));
    const foot = land.scatter(CL.rock, 1.6, (x, z) => land.weight(x, z, CL.ground) > 0.3 && land.at(x, z) < t.level(Math.min(MW - 1, Math.max(0, Math.floor(x))), Math.min(MH - 1, Math.max(0, Math.floor(z)))) + 0.5)
      .concat(land.scatter(CL.grass, 0.8, (x, z) => land.weight(x, z, CL.water) < 0.4));
    S.add(kelp(foot.map(([x, y, z]) => [x, y, z, 0.6 + Math.random() * 0.7])));
    // the vents: a crack every ten floor cells or so, and the pools' (above)
    for (const [x, y, z] of land.scatter(CL.ground, 0.1, onFloor)) vents.push([x, y, z, 0.03]);
    // splashes on every floor cell (the whole cave floor is wet: the user), off the shallows' film where there is one
    const floorCell = (x, y) => t.walk(x, y) || !!t.inStair(x + 0.5, y + 0.5);
    const bubbles = bub = bubbler(S, vents), splashes = spl = splasher(S, floorCell, (x, z) => isWet(Math.floor(x), Math.floor(z)) ? t.level(Math.floor(x), Math.floor(z)) + 0.04 : land.at(x, z) + 0.01);
    E.world.updaters.push((dt, tt) => { SEA.uTime.value = tt; bubbles(dt, tt); splashes(dt, tt); });
  }
  let loneCells = [];
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => land ? land.at(x, z) : 0, particles: 'sea',
    burst: (x, z) => bub && bub.burst(x, land.at(x, z), z, 0.03),   // a string of bubbles out of the floor at (x, z) now (for a close look)
    get wet() { return wetCells; },   // the shallows' cells, and the splashes made so far (tools/qa/rooms.js)
    splashAll: true,   // (every floor cell splashes, not only the shallows)
    get splashes() { return spl ? spl.count : 0; },
    showSplashes: on => spl && spl.show(on),
    get props() { return loneCells; },   // the spires' cells (tools/qa/sets.js)
    get slopes() { const R0 = ROOMS[keyNow()]; return R0.stairs.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; }); },
    // the sea's cold light down in the rock: a blue-green fill, a pale light from above, the walls falling into black
    mood: { bg: 0x02050a, voidCol: 0x02050a, voidY: -1.5, fog: 0x020a10, fogD: 0.015, sky: 0xa8e4f8, under: 0x123c4c, hemi: 1.15,
      sun: 0xd8f0ff, sunI: 2.8, sunDir: [-0.25, 0.9, 0.35], sat: 1.05, exposure: 1.25, bloom: 0.35, aoR: 0.8,
      env: { top: 0x5aa8c4, mid: 0x22505e, low: 0x081418, lights: [[0, 7, 3, 0xd0f4ff, 3]] } },
  };
}
export const caveEntry = setFor('0ee250');
export const caveHall = setFor('0ee27c');
export default setFor(null);   // battle 10: the room the party is in
