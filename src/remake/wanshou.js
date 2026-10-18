// 萬獸山, the mountain of beasts (maps 0f53e0 and 0f5420, the same art: scene 39 and battle 19), remade: plateaus of
// orange earth with patches of dry grass, ringed by cliffs of dark purple rock that fall away into a sea of cloud,
// joined by steps cut in the cliffs and three plank bridges (x 20-23 at rows 8-9, 17-20 at row 17, 13-21 at rows 21-22);
// the 四不像 waits on the summit (row 0) between two boulders. Measured on tools/qa/grid.py 0f53e0.
// Built like the lotus garden (src/remake/lotus.js levels): each cell classed by its colours (PROTO: earth, grass, cliff,
// the cut steps, cloud, bridge; measured on the art), the walk's regions raised by the steps between them.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged, stairs } from '../kit/parts.js';
import { grass, windTick } from '../kit/terrain.js';
import { rock } from './citygate.js';
import { levels } from './lotus.js';
import { D, G } from '../rules.js';

const PROTO = {
  P: { b46c24: 0.39, d89024: 0.34, fcb46c: 0.15, 904800: 0.09 },
  G: { 242400: 0.31, b46c24: 0.2, d89024: 0.17, b49024: 0.1, d8b448: 0.08, fcb46c: 0.07, 904800: 0.06 },
  B: { '24006c': 0.17, '000000': 0.15, 482400: 0.14, '906c6c': 0.11, fcfcfc: 0.11, b4fcfc: 0.1, b46c24: 0.04, 242400: 0.03, '00d8fc': 0.03 },
  S: { 482400: 0.27, 904800: 0.19, '000000': 0.13, b46c24: 0.11, '24006c': 0.1, '906c6c': 0.08, d89024: 0.05, d8b4b4: 0.03 },
  W: { fcfcfc: 0.44, b4fcfc: 0.41, '00d8fc': 0.13 },
  Q: { '906c6c': 0.36, '000000': 0.33, 482400: 0.17, d8b4b4: 0.06 },
};
const CLOUD = -3.2, BED = -3.6, BOULDERS = [[11.5, 0.6, 1.3], [13.5, 0.6, 1.3]];
const R = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

async function pixels(src) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height);
}
function classify(img, MW, MH) {
  const P = Object.entries(PROTO).map(([c, h]) => [c, new Map(Object.entries(h).map(([k, v]) => [parseInt(k, 16), v]))]), out = [];
  for (let y = 0; y < MH; y++) { const row = []; for (let x = 0; x < MW; x++) {
    const h = new Map(); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4, c = img.data[k] << 16 | img.data[k + 1] << 8 | img.data[k + 2]; h.set(c, (h.get(c) || 0) + 1 / 1024); }
    let best = 'P', bd = 9; for (const [c, p] of P) { let d = 0; for (const k of new Set([...h.keys(), ...p.keys()])) d += Math.abs((h.get(k) || 0) - (p.get(k) || 0)); if (d < bd) { bd = d; best = c; } }
    row.push(best);
  } out.push(row); }
  return out;
}
// the earth's top from the classes: orange ground, dry grass, the rock's top at the cliffs' edges
function topTex(cls, MW, MH) {
  const S = 64, c = document.createElement('canvas'); c.width = MW * S; c.height = MH * S; const g = c.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = cls[y][x], X = x * S, Y = y * S;
    g.fillStyle = k === 'G' ? '#8a7a2a' : k === 'B' || k === 'S' ? '#5a4048' : '#c07a34'; g.fillRect(X, Y, S, S);
    for (let i = 0; i < 60; i++) { g.fillStyle = k === 'G' ? (R(i + x) < 0.5 ? 'rgba(180,160,60,0.6)' : 'rgba(60,60,20,0.5)') : (R(i * 3 + y) < 0.5 ? 'rgba(230,160,90,0.45)' : 'rgba(110,60,20,0.35)'); g.fillRect(X + R(i + x * 7 + y) * S, Y + R(i * 5 + y * 3 + x) * S, k === 'G' ? 2 : 3, k === 'G' ? 4 : 2); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, MW / MH); t.offset.set(0, 1); return t;
}
// the sea of cloud: soft white over pale blue, drifting slowly
function cloudSea() {
  const m = new THREE.MeshStandardMaterial({ color: 0xe8f6fa, roughness: 1, emissive: 0x7ab4c8, emissiveIntensity: 0.15, transparent: true, opacity: 0.96 });
  const u = m.userData.u = { uTime: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 cp = vWp.xz * 0.18 + vec2(uTime * 0.012, uTime * 0.004);
      float n = cn(cp) * 0.55 + cn(cp * 2.3 + 3.1) * 0.3 + cn(cp * 5.0 + 7.0) * 0.15;
      diffuseColor.rgb = mix(vec3(0.62, 0.84, 0.92), vec3(1.0), smoothstep(0.35, 0.75, n));`);
  };
  m.customProgramCacheKey = () => 'cloudSea';
  return m;
}

function setFor(src) {
  let LV = null, voidH = new Map(), bridgeH = new Map(), slopes = [], props = [], chestG = new Map(), M = null, world = null;
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const MW = D.mapW, MH = D.mapH, terr = D.terrain, art = classify(await pixels(src), MW, MH);
    const walk = (x, y) => terr[y][x] !== 2 && terr[y][x] !== 1;
    // for the levels: the walk earth (bridges too) or steps; blocked: cloud, cliff faces, the bridges' rails
    const cls = art.map((row, y) => row.map((c, x) => walk(x, y) ? (c === 'S' ? 'S' : 'P') : c === 'W' ? 'W' : c === 'Q' ? 'R' : c === 'P' || c === 'G' ? 'R' : 'B'));
    const { h, ramps } = levels(cls, terr, MW, MH, { minWide: 1, bed: BED, deck: 0.6 });
    // a cliff cell stays up only as the face of a step between two walks (walk north of it and south of it, cloud not between);
    // the rest fall away, so the plateaus end in sheer rock over the clouds rather than in flat purple tops
    const reachS = (x, y) => { for (let j = y + 1; j < Math.min(MH, y + 5); j++) { if (walk(x, j)) return true; if (art[j][x] === 'W') return false; } return false; };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!walk(x, y) && cls[y][x] === 'B' && !reachS(x, y)) h[y][x] = BED;
    let lo = 9; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (walk(x, y) && h[y][x] != null) lo = Math.min(lo, h[y][x]);
    const lift = Math.max(0, 0.6 - lo);   // the lowest walk at 0.6: nothing blocked beside it can read as open ground
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (h[y][x] != null && h[y][x] > BED + 0.01) h[y][x] += lift;
    for (const r of ramps) { r.y0 += lift; r.y1 += lift; }
    // over the void a flier hovers at the height of the walk nearby (not down at the clouds, hidden under the cliffs)
    voidH = new Map(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!(h[y][x] > BED + 0.01)) {
      let m = null; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const v = h[y + dy] && h[y + dy][x + dx]; if (v != null && v > BED + 0.01 && (m === null || v > m)) m = v; }
      voidH.set(x + ',' + y, m ?? 0.6); }
    bridgeH = new Map(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (walk(x, y) && art[y][x] === 'Q') bridgeH.set(x + ',' + y, h[y][x]);
    LV = new Levels(MW, MH, 1);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!bridgeH.has(x + ',' + y)) LV.set(x, y, x + 1, y + 1, art[y][x] === 'Q' && !walk(x, y) ? BED : h[y][x] ?? BED);   // (under a bridge's rails, and the cliff cells that read like them: the drop)
    for (const r of ramps) LV.stairs(r.x0, r.z0, r.x1, r.z1, r.y0, r.y1, Math.max(3, (r.z1 - r.z0) * 3), 's');
    slopes = ramps.flatMap(r => r.cells);
    const cliff = T.material(T.rock(0x4a3448, 'beastCliff', 0.7), { color: 0xd8c8d8 }, [0.5, 0.5]);
    S.add(LV.mesh(new THREE.MeshStandardMaterial({ map: topTex(art, MW, MH), roughness: 0.95 }), cliff, BED, 1 / 32));
    for (const r of LV.ramps) S.add(stairs(r, T.material(T.rock(0x8a6040, 'beastStep', 0.4), {}, [1, 1]), cliff, 0.5));
    // the bridges: plank decks on beams, a rail of posts and ropes along each side where the art has them
    const plank = T.material(T.planks(0x8a6a50, 4), { color: 0xd8c8b8 }, [1, 1]), wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 }), decks = [], posts = [];
    for (const [k, yy] of bridgeH) { const [x, y] = k.split(',').map(Number); decks.push(box(plank, x, yy - 0.12, y, x + 1, yy, y + 1, 1)); }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (art[y][x] === 'Q' && !walk(x, y)) {
      const n = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]].map(([a, b]) => bridgeH.get(a + ',' + b)).find(v => v != null) ?? h[y][x] ?? 0.6;
      posts.push(box(wood, x + 0.42, n - 0.4, y + 0.42, x + 0.58, n + 0.55, y + 0.58, 1), box(wood, x, n + 0.42, y + 0.45, x + 1, n + 0.48, y + 0.55, 1));
    }
    if (decks.length) S.add(shade(merged(plank, decks))); if (posts.length) S.add(shade(merged(wood, posts)));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(MW + 80, MH + 80).rotateX(-Math.PI / 2), cloudSea()); sea.position.set(MW / 2, CLOUD, MH / 2); S.add(sea);
    const stone = T.material(T.rock(0xb0a8a0, 'beastBoulder', 0.4), { color: 0xf0e8e0 }, [0.5, 0.5]);
    props = []; for (const [x, z, s] of BOULDERS) { S.add(rock(stone, x, z, h[Math.floor(z)][Math.floor(x)] ?? 0.6, s, x)); props.push([Math.floor(x), Math.floor(z)]); }
    const tufts = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (art[y][x] === 'G' && walk(x, y)) for (let i = 0; i < 6; i++) { const px = x + R(x * 7 + y * 13 + i), pz = y + R(x * 3 + y * 17 + i * 5); tufts.push([px, LV.at(px, pz), pz]); }
    if (tufts.length) S.add(grass(tufts, { size: 0.34, cols: ['#a8902e', '#8a7424', '#c0a838', '#6a5a1e'] }));
    const chests = D.rooms && G.chests ? G.chests : (G.chests || (D.chests || []).map(c => ({ x: c.x, y: c.y, hidden: c.hidden, open: false })));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, ground(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    props = props.concat(chests.map(c => [c.x, c.y]));
    E.world.updaters.push((dt, t) => { sea.material.userData.u.uTime.value = t; windTick(t); });
    void FX;
  }
  function ground(x, z) { if (!LV) return 0; const b = bridgeH.get(Math.floor(x) + ',' + Math.floor(z)); if (b != null) return b; const v = LV.at(x, z); return v <= BED + 0.01 ? (voidH.get(Math.floor(x) + ',' + Math.floor(z)) ?? 0.6) : v; }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, ground(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground, get slopes() { return slopes; }, get props() { return props; },
    // high, clear and bright above the clouds
    mood: { bg: 0xb8e0f0, voidCol: false, fog: 0xd0eaf4, fogD: 0.006, sky: 0xe8f6ff, under: 0x6a5a4a, hemi: 1.05,
      sun: 0xfff6e8, sunI: 2.8, sunDir: [-0.45, 0.8, 0.45], sat: 1.05, exposure: 0.95, bloom: 0.1, aoR: 0.8,
      env: { top: 0xd8eeff, mid: 0xb09070, low: 0x5a4a3a, lights: [[-6, 8, 4, 0xfff6e8, 3]] } },
  };
}
export const beastMount = setFor('assets/maps/0f53e0.png');
