// 天門異界, the gate of heaven (maps 0f9952 and 0f9912, the same art: scene 54 after the heroes are taken up, and battle
// 26), remade: a field of crystal tiles hanging in a starry violet void. The original draws a tile of pale ice-blue
// crystal on every cell a unit may stand (the battle's terrain, cell for cell: checked on the art) and the three chests
// on tiles of their own; round them the dark of the heavens, stars and violet wisps of cloud. Its frame hook (0x0F9992)
// turns six colours of the tiles' palette one place every ten frames: here a slow shimmer runs across the crystal.
// Each tile a thick slab, bevelled, its top faceted and clear at the edges, lit from within; a hair of gap between
// tiles, as drawn. Fliers cross the void at the field's height.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, box, chest, shade } from '../kit/parts.js';
import { G, D } from '../rules.js';

const TOP = 0, SLAB = 0.32, VOID = -6;
const SHIM = { uTime: { value: 0 } };
let tiles = null, built = false, chestG = new Map(), world = null, M = null;
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// the crystal's top: ice-blue, facets in it (a few broad planes meeting at soft ridges), clearer and paler toward the
// edges, a fine frost in places
function crystalTex() {
  return T.pbr('tmCrystal2', 512, (u, v, o) => {
    // the original's tile: deep blue glass, its rim frosted bright cyan-white, a diagonal sheen across it from the top left
    const [w0, w1] = T.worley(u, v, 3, 701, 1), ridge = T.smooth(0.05, 0.0, w1 - w0), n = T.fbm(u, v, 8, 3, 702);
    const e = Math.min(u, 1 - u, v, 1 - v), rim = T.smooth(0.13, 0.02, e), frost = T.smooth(0.55, 0.75, T.fbm(u, v, 24, 3, 703)) * T.smooth(0.22, 0.05, e);
    const d = (u - v) * 0.7071, sheen = T.smooth(0.07, 0.0, Math.abs(d + 0.12)) * 0.8 + T.smooth(0.03, 0.0, Math.abs(d - 0.05)) * 0.45;
    let c = T.mixc([0.06, 0.18, 0.5], [0.12, 0.32, 0.7], w0 * 0.5 + n * 0.5);
    c = T.mixc(c, [0.45, 0.75, 0.98], ridge * 0.35); c = T.mixc(c, [0.7, 0.92, 1], sheen * 0.6);
    c = T.mixc(c, [0.75, 0.95, 1], Math.max(rim, frost) * 0.85);
    o.c = c; o.h = 0.5 + w0 * 0.1 + ridge * 0.08 + rim * 0.2; o.r = 0.08 + frost * 0.3;
  }, 1);
}
// a shimmer that runs slowly across the field (the original's palette turning): a band of light over the tops
function shimmer(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uShim = SHIM.uTime;
    sh.vertexShader = 'varying vec3 vShW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n #ifdef USE_INSTANCING\n vShW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n #else\n vShW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n #endif');
    sh.fragmentShader = 'uniform float uShim; varying vec3 vShW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float shB = 0.5 + 0.5 * sin((vShW.x * 0.35 + vShW.z * 0.22) - uShim * 0.9); totalEmissiveRadiance += vec3(0.16, 0.34, 0.5) * pow(shB, 6.0) * 0.55;');
  };
  return mat;
}
// the void: deep violet-black with stars, and wisps of violet cloud drifting far below
function skyTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#05041a'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { const x = R(i) * 1024, y = R(i + 0.5) * 1024, r = 60 + R(i + 0.3) * 220, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${100 + R(i + 1) * 60 | 0},${30 + R(i + 2) * 40 | 0},${180 + R(i + 3) * 70 | 0},${0.22 + R(i + 4) * 0.2})`); gr.addColorStop(1, 'rgba(40,10,90,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 1400; i++) { const x = R(i + 9) * 1024, y = R(i + 7) * 1024, b = R(i + 5); g.fillStyle = `rgba(${200 + b * 55 | 0},${210 + b * 45 | 0},255,${0.3 + b * 0.7})`; g.fillRect(x, y, b > 0.93 ? 2 : 1, b > 0.93 ? 2 : 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const MW = D.mapW, MH = D.mapH, terr = D.terrain;
  const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false }));
  const on = new Set(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (terr[y][x] === 0) on.add(x + ',' + y);
  for (const c of chests) on.add(c.x + ',' + c.y);
  tiles = on;
  // the tiles: one instanced slab, its sides deeper blue; each set a hair apart and a hair off level
  const top = shimmer(T.material(crystalTex(), { emissive: new THREE.Color(0.04, 0.12, 0.3), emissiveIntensity: 1, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 0.5 }));
  const side = new THREE.MeshPhysicalMaterial({ color: 0x5aa0e0, roughness: 0.1, metalness: 0.1, clearcoat: 1, emissive: 0x1a4a8a, transparent: true, opacity: 0.9 });   // (the sides lit pale: the original's frosted edge)
  const geo = new THREE.BoxGeometry(0.94, SLAB, 0.94, 1, 1, 1);
  const list = [...on].map(k => k.split(',').map(Number)), inst = new THREE.InstancedMesh(geo, [side, side, top, side, side, side], list.length), m4 = new THREE.Matrix4();
  list.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, TOP - SLAB / 2 - R(x * 7 + y) * 0.015, y + 0.5); inst.setMatrixAt(i, m4); });
  inst.castShadow = false; inst.receiveShadow = true; S.add(inst);   // (no shadows on the void far below: they read as black holes in it)
  // a faint glow under each tile, down into the dark
  const glowM = new THREE.MeshBasicMaterial({ color: 0x3a6ad0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(Math.PI / 2), glowM, list.length);
  list.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, TOP - SLAB - 0.02, y + 0.5); glow.setMatrixAt(i, m4); }); S.add(glow);
  // the heavens: a great dome of night far round the field, and below it a floor of violet cloud in the dark
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 20), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.material.map.repeat.set(3, 2); sky.position.set(MW / 2, 0, MH / 2); sky.renderOrder = -1; S.add(sky);
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyTex(), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  cloud.material.map.repeat.set(5, 5); cloud.position.set(MW / 2, VOID, MH / 2); S.add(cloud);
  for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, TOP, !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
  E.world.updaters.push((dt, t) => { SHIM.uTime.value = t; });
  built = true; void FX;
}
function ground(x, z) {
  if (!built) return TOP;
  return tiles.has(Math.floor(x) + ',' + Math.floor(z)) ? TOP : VOID;
}
function openChest(x, y) {
  const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
  if (g) S.remove(g);
  const o = chest(M, x + 0.5, y + 0.5, TOP, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
}
export const tianmen = {
  build, ground, openChest, particles: null,
  get props() { return D.chests ? D.chests.map(c => [c.x, c.y]) : []; },
  mood: { bg: 0x05041a, voidCol: false, fog: 0x0c0a2a, fogD: 0.012, sky: 0xb8c8ff, under: 0x2a1a5a, hemi: 0.85,
    sun: 0xe0e8ff, sunI: 2.2, sunDir: [-0.35, 0.85, 0.4], sat: 1.05, exposure: 1.05, bloom: 0.4, aoR: 0.7,
    env: { top: 0x6a7ae0, mid: 0x3a2a7a, low: 0x0a0820, lights: [[-6, 7, 4, 0xe8f0ff, 4], [6, 2, -6, 0xa080ff, 2]] } },
};
