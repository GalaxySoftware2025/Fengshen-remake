// 崑崙仙山 reimagined (src/remake/kunlun-reimagine.js): its pieces. The light by height every material takes, the rope
// bridges and rock-hewn steps of the wild lower tiers, the pilgrims' stone lanterns and roadside shrine, the summit's
// balustrade and its beds of 甘露草, the 玉虛宮 on the far peak to the north, the rims' vines, roots and boulders, the
// spray where the springs meet the cloud, the chains that hold the lone crag, and the life of the place the user asked
// for: cranes gliding below the board and ribbons of auspicious cloud (祥雲) curling round the pillars.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { box, shade, merged } from '../kit/parts.js';
import { leafTex } from '../kit/terrain.js';

const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- light by height
// the summit takes the first gold of the sun, the low tiers the cool blue of the morning shadow: the lit colour of a
// material turned from cool to warm with its height (the brightness kept, so the floors stay as light for the squares)
const ALT_GLSL = `
  { float kAl = smoothstep(0.2, 3.9, vAltY); outgoingLight *= mix(vec3(0.95, 0.995, 1.06), vec3(1.09, 1.0, 0.85), kAl); }
`;
export function alt(m, key) {
  if (!m || m.userData.krAlt) return m; m.userData.krAlt = true;
  const prev = m.onBeforeCompile, own = m.hasOwnProperty('customProgramCacheKey') ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    const i = sh.vertexShader.lastIndexOf('}');
    sh.vertexShader = 'varying float vAltY;\n' + sh.vertexShader.slice(0, i) + '\n  { vec4 kAw = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  kAw = instanceMatrix * kAw;\n  #endif\n  vAltY = (modelMatrix * kAw).y; }\n' + sh.vertexShader.slice(i);
    sh.fragmentShader = 'varying float vAltY;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', ALT_GLSL + '#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => own() + '|' + key + '|alt';
  m.needsUpdate = true; return m;
}
export const altAll = (o, key) => { o.traverse(q => { if (q.isMesh) for (const m of [].concat(q.material)) if (m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial)) alt(m, key + (m.uuid.slice(0, 4))); }); return o; };

// ---------------------------------------------------------------- the wild tiers: rope bridges
// planks laid across on two stringers, each a little askew and its own shade; a post at each end on both edges, two
// ropes sagging between them and short hangers down to the deck's edge
export function ropeBridge(y, x0, x1, h) {
  const g = new THREE.Group(), wood = T.material(T.planks(0x7a6048, 1), { color: 0xe8dccc }), dark = T.material(T.wood(0x4a3628, 'krBeam'), {});
  const rope = new THREE.MeshStandardMaterial({ color: 0xa08a64, roughness: 1 }), planks = [], beams = [], posts = [];
  for (let x = x0 + 0.02, i = 0; x < x1 - 0.1; x += 0.25, i++) { const p = box(wood, x, h - 0.06, y + 0.03, x + 0.22, h, y + 0.97, 2); p.rotation.y = (R(x * 9.1) - 0.5) * 0.06; p.position.y -= R(x * 3.3) * 0.012; planks.push(p); }
  for (const z of [y + 0.18, y + 0.82]) beams.push(box(dark, x0 - 0.25, h - 0.16, z - 0.05, x1 + 0.25, h - 0.06, z + 0.05, 2));
  for (const z of [y + 0.05, y + 0.95]) {
    for (const x of [x0 + 0.04, x1 - 0.04]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 8), dark); c.position.set(x, h + 0.25, z); posts.push(c); }
    for (const hh of [0.62, 0.36]) { const pts = []; for (let j = 0; j <= 16; j++) { const f = j / 16; pts.push(V(x0 + 0.04 + (x1 - x0 - 0.08) * f, h + hh - Math.sin(f * Math.PI) * 0.13, z)); }
      g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.014, 5), rope))); }
    for (let x = x0 + 0.5; x < x1 - 0.2; x += 0.5) { const f = (x - x0) / (x1 - x0), top = h + 0.62 - Math.sin(f * Math.PI) * 0.13, c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, top - h, 4), rope); c.position.set(x, (top + h) / 2, z); posts.push(c); }
  }
  g.add(merged(wood, planks), merged(dark, beams), merged(dark, posts));
  return shade(g);
}

// ---------------------------------------------------------------- the pilgrims' way: stone lanterns and a shrine
let STONE = null;
const stone = () => STONE || (STONE = T.material(T.rock(0x8e897c, 'krLanternStone', 0.4), { roughness: 0.9 }, [0.6, 0.6]));
function lathe(pts, mat, seg = 16) { return shade(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat)); }
// a 石燈籠: a round foot, an eight-sided shaft, the fire box with its windows (a faint glow inside), a curved hipped cap
// and a jewel on top; weathered grey stone with moss at the foot (the rock's own material)
export function stoneLantern(x, z, y, s = 1) {
  const g = new THREE.Group(), m = stone(), glow = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffb060, emissiveIntensity: 0.9 });
  g.add(lathe([[0, 0], [0.2, 0], [0.2, 0.08], [0.15, 0.12], [0.1, 0.16], [0.08, 0.2], [0, 0.2]], m, 8));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.42, 8), m); shaft.position.y = 0.41; g.add(shade(shaft));
  g.add(Object.assign(box(m, -0.15, 0.62, -0.15, 0.15, 0.68, 0.15, 1), {}));
  for (const [a, b] of [[-0.13, -0.13], [0.09, -0.13], [-0.13, 0.09], [0.09, 0.09]]) g.add(box(m, a, 0.68, b, a + 0.04, 0.88, b + 0.04, 1));
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.17), glow); light.position.y = 0.78; g.add(light);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.27, 0.16, 4), m); cap.rotation.y = Math.PI / 4; cap.position.y = 0.96; g.add(shade(cap));
  const p = cap.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const py = p.getY(i); if (py < 0) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, py + r * 0.18); } } cap.geometry.computeVertexNormals();
  g.add(lathe([[0, 0], [0.04, 0.01], [0.05, 0.05], [0.025, 0.1], [0, 0.13]], m, 10).translateY(1.03));
  g.position.set(x, y, z); g.scale.setScalar(s); return shade(g);
}
// a roadside shrine (土地龕) on the west terrace: a stone house a little taller than a man's knee on a plinth, its niche
// dark under a tiled roof, a red cloth over the offering ledge, a small bronze censer before it
export function shrine(x, z, y) {
  const g = new THREE.Group(), m = stone(), roof = T.material(T.roofTiles(0x4a5a58, 6, 6), { roughness: 0.6 }, [1, 1]), dark = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 });
  const red = T.material(T.silk(0xa01c14), {}), bronze = T.material(T.bronze(), {});
  g.add(box(m, -0.36, 0, -0.28, 0.36, 0.16, 0.28, 1), box(m, -0.28, 0.16, -0.22, 0.28, 0.66, 0.2, 1));
  g.add(box(dark, -0.15, 0.24, 0.12, 0.15, 0.56, 0.205, 1), box(red, -0.2, 0.2, 0.2, 0.2, 0.24, 0.27, 1));
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.44, 0.24, 4), roof); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.85); r.position.y = 0.78; g.add(r);
  const c = lathe([[0, 0], [0.05, 0], [0.07, 0.05], [0.08, 0.1], [0.07, 0.12], [0, 0.12]], bronze, 12); c.position.set(0, 0, 0.42); g.add(c);
  g.position.set(x, y, z); return shade(g);
}

// ---------------------------------------------------------------- the summit
// the balustrade round the summit's rim: posts with lotus-bud caps, a rail and panels between; pts: the rim's points
// (already inside it), in order; a gap wherever two are more than `gap` apart
export function balustrade(mat, runs, y) {
  const parts = [];
  for (const pts of runs) for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i]; parts.push(box(mat, x - 0.05, y, z - 0.05, x + 0.05, y + 0.42, z + 0.05, 1));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), mat); cap.scale.set(1, 1.3, 1); cap.position.set(x, y + 0.47, z); parts.push(cap);
    if (i + 1 < pts.length) { const [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x, z2 - z), a = Math.atan2(z2 - z, x2 - x), mx = (x + x2) / 2, mz = (z + z2) / 2;
      for (const [y0, y1, t] of [[0.32, 0.38, 0.05], [0.06, 0.26, 0.03]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, y1 - y0, t), mat); b.position.set(mx, y + (y0 + y1) / 2, mz); b.rotation.y = -a; parts.push(b); } }
  }
  return parts.length ? merged(mat, parts) : new THREE.Group();
}
// 甘露草, the sweet-dew herb the guardian gives: slender arching blades of pale jade-silver, a spike of tiny white flowers,
// and on the tips beads of dew that hold the light (faintly bright: bloom takes them)
let HERB = null;
function herbParts() {
  if (HERB) return HERB;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const x0 = 64 + (R(i) - 0.5) * 30, lean = (R(i + 0.3) - 0.5) * 90, len = 140 + R(i + 0.7) * 100;
    const gr = g.createLinearGradient(0, 256, 0, 256 - len); gr.addColorStop(0, '#4f6e58'); gr.addColorStop(0.6, '#9cc4a8'); gr.addColorStop(1, '#d8f0e0');
    g.strokeStyle = gr; g.lineWidth = 3 + R(i + 0.9) * 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, 256); g.quadraticCurveTo(x0 + lean * 0.3, 256 - len * 0.6, x0 + lean, 256 - len); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(250,252,245,0.95)'; g.beginPath(); g.arc(58 + (R(i + 5) - 0.5) * 16, 30 + R(i + 6) * 60, 2.4, 0, 6.3); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const q1 = new THREE.PlaneGeometry(0.42, 0.84); q1.translate(0, 0.42, 0); const q2 = q1.clone().rotateY(Math.PI / 2), q3 = q1.clone().rotateY(Math.PI / 4);
  const geo = new THREE.BufferGeometry().copy(q1); const parts = [q1, q2, q3];
  const P = [], N = [], U = [], I = []; let off = 0; for (const q of parts) { const p = q.attributes.position; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(0, 1, 0); U.push(q.attributes.uv.getX(i), q.attributes.uv.getY(i)); } for (let i = 0; i < q.index.count; i++) I.push(q.index.getX(i) + off); off += p.count; }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, color: 0xe8f0e8 });
  const dew = new THREE.MeshStandardMaterial({ color: 0xe8fff4, emissive: 0xd8fff0, emissiveIntensity: 1.6, roughness: 0.1 });
  return (HERB = { geo, mat, dew, tex });
}
// pts: [x, y, z, size]; one clump each
export function herbs(pts) {
  const H = herbParts(), g = new THREE.Group(), m = new THREE.InstancedMesh(H.geo, H.mat, pts.length), d = new THREE.Object3D(), dews = [];
  pts.forEach(([x, y, z, s], i) => { d.position.set(x, y, z); d.rotation.set(0, R(i * 3.7) * 6.3, 0); d.scale.set(s, s * (0.8 + R(i) * 0.4), s); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    for (let k = 0; k < 5; k++) { const a = R(i * 7 + k) * 6.3, r = (0.06 + R(i + k * 3) * 0.12) * s; dews.push([x + Math.cos(a) * r, y + (0.45 + R(i * 2 + k) * 0.35) * s, z + Math.sin(a) * r]); } });
  m.castShadow = true; m.receiveShadow = true; m.userData.soft = true; g.add(m);
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: H.tex, alphaTest: 0.45 });
  const dm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), H.dew, dews.length);
  dews.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.setScalar(0.7 + R(i) * 0.6); d.updateMatrix(); dm.setMatrixAt(i, d.matrix); });
  dm.userData.soft = true; g.add(dm);
  return g;
}
// a bed for them: a low curb of white jade round dark earth
export function herbBed(jade, x0, z0, x1, z1, y) {
  const g = new THREE.Group(), earth = new THREE.MeshStandardMaterial({ color: 0x3a3024, roughness: 1 }), t = 0.07;
  g.add(box(earth, x0, y, z0, x1, y + 0.1, z1, 1));
  g.add(box(jade, x0 - t, y, z0 - t, x1 + t, y + 0.16, z0, 1), box(jade, x0 - t, y, z1, x1 + t, y + 0.16, z1 + t, 1), box(jade, x0 - t, y, z0, x0, y + 0.16, z1, 1), box(jade, x1, y, z0, x1 + t, y + 0.16, z1, 1));
  return shade(g);
}

// ---------------------------------------------------------------- 玉虛宮 on the far peak
// the palace of the masters of 崑崙 above the summit, north: a two-tiered terrace of white jade, a great hall with double
// eaves of blue-green glaze and a gilt ridge, a lesser hall each side, red columns along the fronts; seen far off, in haze
function hipRoof(mat, cx, cz, y, len, w, h) {
  const geo = new THREE.CylinderGeometry(0.02, 0.7071, 1, 4, 1); geo.rotateY(Math.PI / 4);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const py = p.getY(i); if (py < 0) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, py + r * 0.25); } }
  geo.computeVertexNormals(); const r = new THREE.Mesh(geo, mat); r.scale.set(len, h, w); r.position.set(cx, y + h / 2, cz); return r;
}
export function palace(cx, cz, y) {
  const g = new THREE.Group(), jade = T.material(T.marble(0xece8e0, 0x9a9a8c, 2), { roughness: 0.5 }, [0.5, 0.5]), roof = T.material(T.roofTiles(0x2a6a64, 8, 8), { roughness: 0.4 }, [1, 1]);
  const lac = T.material(T.lacquer(0x8a1a12, 'krPalaceLac'), {}), wall = T.material(T.plaster(0xe8e0d0), {}), gold = new THREE.MeshStandardMaterial({ color: 0xc89a40, metalness: 1, roughness: 0.3 });
  g.add(box(jade, cx - 3.0, y, cz - 2.0, cx + 3.0, y + 0.35, cz + 1.8, 0.5), box(jade, cx - 2.2, y + 0.35, cz - 1.6, cx + 2.2, y + 0.65, cz + 1.0, 0.5));
  g.add(box(jade, cx - 0.5, y, cz + 1.0, cx + 0.5, y + 0.6, cz + 2.3, 0.5));
  const hall = (x, z, w, d, h, y0, two) => {
    g.add(box(wall, x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, 1));
    for (let i = 0; i <= 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 8), lac); c.position.set(x - w / 2 + 0.1 + (w - 0.2) * i / 6, y0 + h / 2, z + d / 2 + 0.12); g.add(c); }
    g.add(hipRoof(roof, x, z + 0.06, y0 + h, w + 0.7, d + 0.8, two ? 0.5 : 0.62));
    if (two) { g.add(box(wall, x - w / 2 + 0.3, y0 + h + 0.32, z - d / 2 + 0.25, x + w / 2 - 0.3, y0 + h + 0.72, z + d / 2 - 0.25, 1)); g.add(hipRoof(roof, x, z, y0 + h + 0.7, w + 0.1, d + 0.2, 0.62)); g.add(box(gold, x - w / 2 + 0.2, y0 + h + 1.3, z - 0.03, x + w / 2 - 0.2, y0 + h + 1.36, z + 0.03, 1)); }
  };
  hall(cx, cz - 0.5, 3.0, 1.5, 1.05, y + 0.65, true); hall(cx - 2.45, cz + 0.2, 1.1, 0.9, 0.7, y + 0.35, false); hall(cx + 2.45, cz + 0.2, 1.1, 0.9, 0.7, y + 0.35, false);
  return shade(g);
}

// ---------------------------------------------------------------- the rims
// vines hanging down a cliff from its rim: small leaves along a strand that follows the rock; strands: [[x, y, z, nx, nz]]
export function vines(strands) {
  const pts = []; for (const s of strands) for (let i = 0; i < s.length; i++) { const [x, y, z, nx, nz] = s[i]; for (let k = 0; k < 2; k++) pts.push([x + nx * 0.05 + (R(i * 3 + k + x) - 0.5) * 0.08, y - k * 0.04, z + nz * 0.05 + (R(i * 5 + k + z) - 0.5) * 0.08, Math.atan2(nx, nz), 0.8 + R(i + k + y) * 0.6]); }
  const tex = leafTex(['#2e4a24', '#3e5e2c', '#4e6e34', '#24401c']), mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const geo = new THREE.PlaneGeometry(0.16, 0.16), m = new THREE.InstancedMesh(geo, mat, pts.length), d = new THREE.Object3D();
  pts.forEach(([x, y, z, a, s], i) => { d.position.set(x, y, z); d.rotation.set((R(i) - 0.5) * 0.8, a + (R(i + 0.4) - 0.5) * 0.9, (R(i + 0.8) - 0.5) * 0.8); d.scale.setScalar(s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
  m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return m;
}
// roots over a lip: thin twisting tubes from the top, out over the edge and down the face; paths: [[V3...]]
export function roots(paths) {
  const mat = T.material(T.bark(0x4e3e30), {}, [0.3, 1]), out = [];
  for (const p of paths) out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 16, 0.018 + R(p[0].x) * 0.014, 5), mat));
  return out.length ? merged(mat, out) : new THREE.Group();
}
// the chains that hold the lone crag to the summit: iron links, each turned a quarter from the last, sagging
export function chain(a, b, sag) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.85, roughness: 0.55 }), len = a.distanceTo(b), n = Math.round(len / 0.085), geo = new THREE.TorusGeometry(0.045, 0.012, 6, 12);
  geo.scale(1, 0.6, 1);
  const m = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, f2 = Math.min(1, f + 0.01); p.lerpVectors(a, b, f); p.y -= Math.sin(f * Math.PI) * sag; q.lerpVectors(a, b, f2); q.y -= Math.sin(f2 * Math.PI) * sag;
    d.position.copy(p); d.lookAt(q); d.rotateX(Math.PI / 2); d.rotateY(i % 2 ? Math.PI / 2 : 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
  m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- spray where the falls meet the cloud
let MIST = null;
function mistTex() {
  if (MIST) return MIST;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 30; i++) { const x = 64 + (R(i) - 0.5) * 60, y = 64 + (R(i + 0.5) - 0.5) * 60, r = 16 + R(i + 0.2) * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const fade = g.createRadialGradient(64, 64, 20, 64, 64, 64); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (MIST = t);
}
// at each base [x, y, z]: a few soft puffs of spray, slowly swelling and fading in turn; returns { group, tick(t) }
export function spray(bases) {
  const g = new THREE.Group(), puffs = [];
  bases.forEach(([x, y, z], b) => { for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex(), color: 0xf4f2f8, transparent: true, depthWrite: false, opacity: 0.6, fog: true }));
    s.position.set(x + (R(b * 7 + k) - 0.5) * 0.8, y + k * 0.35, z + (R(b * 3 + k) - 0.5) * 0.6); s.userData.noRange = true; g.add(s); puffs.push([s, R(b + k * 1.3) * 10, 2.2 + k * 0.5]); } });
  return { group: g, tick(t) { for (const [s, ph, sz] of puffs) { const f = ((t * 0.12 + ph) % 1); s.scale.setScalar(sz * (0.7 + f * 0.6)); s.material.opacity = 0.55 * Math.sin(f * Math.PI); } } };
}

// ---------------------------------------------------------------- cranes (仙鶴), gliding below the board
// a white crane: a slim body, a long neck stretched forward and a small head with its red crown, black-tipped wings
// that beat now and then and glide between, the legs trailing; they keep below every top (under the play), wheeling
let CRANE = null;
function craneParts() {
  if (CRANE) return CRANE;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#f6f6f2'); gr.addColorStop(0.62, '#f2f2ee'); gr.addColorStop(0.72, '#2a2a2c'); gr.addColorStop(1, '#141416');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(140, 0, 256, 26); g.lineTo(256, 40); for (let i = 0; i < 7; i++) { g.lineTo(240 - i * 16, 56 - (i % 2) * 6); } g.quadraticCurveTo(80, 52, 0, 56); g.closePath(); g.fill();
  const wt = new THREE.CanvasTexture(c); wt.colorSpace = THREE.SRGBColorSpace;
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.7 }), black = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.8 }), red = new THREE.MeshStandardMaterial({ color: 0xc02018, roughness: 0.6 });
  const wing = new THREE.MeshStandardMaterial({ map: wt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  return (CRANE = { white, black, red, wing });
}
function crane() {
  const P = craneParts(), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), P.white); body.scale.set(0.9, 0.8, 2.2); g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.34, 6), P.black); neck.rotation.x = Math.PI / 2 - 0.15; neck.position.set(0, 0.03, -0.34); g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), P.black); head.position.set(0, 0.06, -0.52); g.add(head);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), P.red); crown.position.set(0, 0.09, -0.52); g.add(crown);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x8a8060 })); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.055, -0.61); g.add(beak);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), P.black); legs.rotation.x = Math.PI / 2 + 0.1; legs.position.set(0, -0.02, 0.36); g.add(legs);
  const wings = [-1, 1].map(sd => { const pivot = new THREE.Group(), q = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), P.wing); q.rotation.x = -Math.PI / 2; q.position.x = sd * 0.36; if (sd < 0) q.scale.x = -1; pivot.add(q); pivot.position.set(sd * 0.05, 0.03, -0.02); g.add(pivot); return [pivot, sd]; });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.noRange = true; } });
  return { g, wings };
}
// flights: [[cx, cy, cz, radius x, radius z, speed (rad/s), phase]]; returns { group, tick(t) }
export function cranes(flights) {
  const group = new THREE.Group(), birds = flights.map(f => { const c = crane(); group.add(c.g); return [c, f]; });
  return { group, tick(t) {
    for (const [c, [cx, cy, cz, rx, rz, w, ph]] of birds) {
      const a = t * w + ph, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, y = cy + Math.sin(a * 2.3 + ph) * 0.35;
      const dx = -Math.sin(a) * rx * w, dz = Math.cos(a) * rz * w;
      c.g.position.set(x, y, z); c.g.rotation.set(0, Math.atan2(-dx, -dz), 0); c.g.rotateZ(Math.sign(w) * 0.25);
      const beat = (t * 0.35 + ph) % 1 < 0.3, flap = beat ? Math.sin(t * 9 + ph) * 0.55 : 0.08 + Math.sin(t * 1.3 + ph) * 0.04;
      for (const [p, sd] of c.wings) p.rotation.z = sd * flap;
    }
  } };
}

// ---------------------------------------------------------------- 祥雲: ribbons of auspicious cloud round the pillars
// a long soft band of cloud winding round a pillar, its ends curling up into the scroll of the auspicious-cloud motif,
// cream with a warm edge, wisps running along it; below the tops it winds round, so it never crosses the play
function ribbonMat() {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const u = m.userData.u = { uTime: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRib; varying vec2 vRib;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRib = aRib;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uTime; varying vec2 vRib;
      float rh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float a = vRib.x, b = vRib.y, t = uTime;
      float w = rn(vec2(a * 1.6 - t * 0.25, b * 3.0)) * 0.6 + rn(vec2(a * 4.0 - t * 0.4, b * 6.0)) * 0.4;
      float edge = smoothstep(0.0, 0.3, b) * smoothstep(1.0, 0.7, b), rim = smoothstep(0.55, 0.95, abs(b - 0.5) * 2.0);
      diffuseColor.rgb = mix(vec3(0.99, 0.97, 0.93), vec3(1.0, 0.82, 0.55), rim * 0.6);
      diffuseColor.a = edge * (0.4 + w * 0.55) * smoothstep(0.0, 0.06, a) * smoothstep(1.0, 0.94, a) * 0.85;`);
  };
  m.customProgramCacheKey = () => 'krRibbon';
  return m;
}
// specs: [[cx, cz, rx, rz, y0, y1, turns, width, phase]]; returns { group, tick(t) }
export function ribbons(specs) {
  const mat = ribbonMat(), group = new THREE.Group();
  for (const [cx, cz, rx, rz, y0, y1, turns, wid, ph] of specs) {
    const n = 140, P = [], A = [], I = [], pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, a = ph + f * turns * Math.PI * 2; let x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, y = y0 + (y1 - y0) * f + Math.sin(f * 9 + ph) * 0.15;
      const end = Math.max(T.smooth(0.82, 1.0, f), T.smooth(0.18, 0.0, f));   // the ends curl up and over (the scroll)
      if (end > 0) { const ang = end * Math.PI * 1.6, r = 0.45 * (1 - end * 0.5); y += Math.sin(ang) * r; const out = (1 - Math.cos(ang)) * r * 0.6; x += Math.cos(a) * out; z += Math.sin(a) * out; }
      pts.push([x, y, z, a]);
    }
    pts.forEach(([x, y, z, a], i) => { const f = i / n, w = wid * (0.55 + 0.45 * Math.sin(f * Math.PI)), tw = Math.sin(f * 5 + ph) * 0.6;   // (the band twists a little as it winds)
      const nx = Math.cos(a), nz = Math.sin(a), up = Math.cos(tw), side = Math.sin(tw);
      P.push(x - nx * side * w / 2, y - up * w / 2, z - nz * side * w / 2, x + nx * side * w / 2, y + up * w / 2, z + nz * side * w / 2); A.push(f, 0, f, 1);
      if (i < n) { const k = i * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aRib', new THREE.Float32BufferAttribute(A, 2)); g.setIndex(I);
    const m = new THREE.Mesh(g, mat); m.renderOrder = 3; m.userData.noRange = true; group.add(m);
  }
  return { group, tick(t) { mat.userData.u.uTime.value = t; } };
}
