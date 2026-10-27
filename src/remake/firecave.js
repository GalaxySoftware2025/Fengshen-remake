// 火巖窟, the fire cave (maps 0f1ffc and 0f2034: scene 27; battle 14's two rooms, those two maps), remade: floors of
// scorched orange-brown earth streaked on the slant with ash and cinders, cliffs of cobbled mauve-brown rock, a river of
// molten lava across the cave (rows 16-21) and a lake of it round an island in 龍鬚虎's lair, flowing in warped bands
// under drifting plates of crust, its shores ragged (the original turns five of its colours round every 10 frames: the
// frame hook 0x0F2070), rounded grey boulders standing in the floor, skulls and bones strewn about.
// Measured on tools/qa/grid.py (0f1ffc, 0f2034) and the rooms' grids. In the first room the way in (the heroes at
// (2-4, 4-5)) is an upper floor; two flights cut in the cliffs (x 5-6, rows 9-12; x 19-21, rows 7-11) go down to the
// cave's floor, which falls away into the dark at its south-west and south-east; the way on is a hole in the rock at
// (19, 30). Built from each room's grid: open cells are floor; terrain 2 is lava where the art is lava, a boulder where it
// stands alone, else cliff; the dark beyond (terrain 1) is the cave's rock.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { mats, chest, shade } from '../kit/parts.js';
import { readLayout, Land, CL, stones } from '../kit/terrain.js';
import { terraces, terracedAt } from '../kit/hill.js';
import { tunnel, voidSide } from './cave.js';
import { D, G } from '../rules.js';

const UP = 0.9;
const LAVA = [0xfcd800, 0xfc9000, 0xd84800, 0xb42400];
const ROOMS = {
  main: { art: () => 'assets/maps/0f1ffc.png', start: [4, 5], levels: [[4, 5, UP], [12, 14, 0]],
    stairs: [{ r: [5, 9, 7, 13], y0: UP, y: 0, n: 5 }, { r: [19, 7, 22, 12], y0: UP, y: 0, n: 6 }] },
  lair: { art: key => key === '0f2034' ? 'assets/maps/0f2034.png' : 'assets/battles/14/room-1.png', start: [7, 7], levels: [[7, 7, 0]], stairs: [] },
};
const PALETTE = { [CL.ground]: [0xb44800, 0x480000, 0x240000, 0xd89048, 0x904848, 0xb49048], [CL.water]: LAVA, [CL.rock]: [0x000000, 0x6c0000] };

// a skull, whitened, half sunk in the ash: a cranium, the face narrower below it with dark sockets and a nose hole, the
// jaw; a long bone beside it, knobbed at both ends
function bones(mat, x, z, y, k) {
  const g = new THREE.Group(), dark = new THREE.MeshBasicMaterial({ color: 0x1a0a04 });
  const cr = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), mat); cr.scale.set(1, 0.9, 1.2); cr.position.set(0, 0.06, -0.01); g.add(cr);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mat); face.scale.set(1, 0.85, 0.8); face.position.set(0, 0.04, 0.05); g.add(face);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.05), mat); jaw.position.set(0, 0.008, 0.06); g.add(jaw);
  for (const sx of [-0.025, 0.025]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), dark); e.scale.set(1, 0.85, 0.5); e.position.set(sx, 0.055, 0.09); g.add(e); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), dark); nose.position.set(0, 0.032, 0.094); g.add(nose);
  const bone = new THREE.Group(), shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 8), mat); bone.add(shaft);
  for (const e of [-0.12, 0.12]) for (const sx of [-0.012, 0.012]) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), mat); kn.position.set(sx, e, 0); bone.add(kn); }
  bone.rotation.set(Math.PI / 2, 0, k * 2.3); bone.position.set(0.13, 0.014, 0.03); g.add(bone);
  g.position.set(x, y - 0.015, z); g.rotation.y = k * 6.3; g.scale.setScalar(1.3); g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g;
}
// the lava (the art's orange and yellow in wavy bands, its colours turning): molten rock, deep red to red, orange on
// the crests, a little yellow where hottest (the user: more red), boiling as it rolls: slow swells heave the surface up
// and roll over, folding the bands with them, hotter and brighter as they rise, darker red in the troughs; now and
// then a mild eruption (eruptions, below)
const LAVA_NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p = p * 2.03 + 3.1; a *= 0.5; } return s; }
      float heave(vec2 p, float t){ return n(p * 0.8 + vec2(t * 0.11, t * 0.05)) * 0.6 + n(p * 1.9 - vec2(t * 0.07, t * 0.16)) * 0.4; }
      uniform vec4 uEru[4];
      float eru(vec2 p){ float e = 0.0; for (int i = 0; i < 4; i++) { vec4 q = uEru[i]; float d = length(p - q.xy); e = max(e, q.w * sin(3.14159 * q.z) * (1.0 - smoothstep(0.0, 0.7, d))); } return e; }`;
// the eruptions' swells, shared by every pool: (x, z, phase 0-1, strength) each
const ERU = { value: Array.from({ length: 4 }, () => new THREE.Vector4(-99, -99, 0, 0)) };
function lavaPool(E, S, r, y) {
  const [x0, z0, x1, z1] = r, U = { uTime: { value: 0 }, uEru: ERU };
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) * 6), Math.ceil((z1 - z0) * 6)).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `uniform float uTime; varying vec3 vW; varying float vH; ${LAVA_NOISE}
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vH = heave(w.xz, uTime); w.y += (vH - 0.5) * 0.14 + eru(w.xz) * 0.26; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vW; varying float vH; ${LAVA_NOISE}
      void main(){
        vec2 p = vW.xz; float t = uTime;
        // the churn: two warps moving against each other, so the bands fold and roll over instead of sliding
        vec2 q = vec2(fbm(p * 0.5 + vec2(0.0, t * 0.09)), fbm(p * 0.5 + vec2(5.2, -t * 0.08)));
        vec2 r = vec2(fbm(p * 0.9 + q * 1.8 + vec2(t * 0.13, 1.7)), fbm(p * 0.9 + q * 1.8 + vec2(8.3, -t * 0.12)));
        vec2 w = p + (q - 0.5) * 2.0 + (r - 0.5) * 1.4;
        float band = 0.5 + 0.5 * sin(w.y * 4.0 + w.x * 1.3 + fbm(w * 1.2) * 5.0 - t * 0.7);
        float heat = fbm(w * 1.5 + vec2(t * 0.1, 0.0)), rise = smoothstep(0.35, 0.75, vH);
        vec3 col = mix(vec3(0.45, 0.025, 0.01), vec3(0.88, 0.1, 0.015), smoothstep(0.1, 0.75, band));                  // deep red to red
        col = mix(col, vec3(1.0, 0.3, 0.025), smoothstep(0.72, 1.0, band) * (0.3 + 0.35 * rise));                 // orange on the crests, more on a rising swell
        col = mix(col, vec3(1.0, 0.55, 0.1), smoothstep(0.9, 1.1, band * (0.45 + heat)) * (0.15 + 0.3 * rise));  // a little yellow where hottest
        col *= 0.7 + 0.35 * rise;                                                                                      // the troughs darker red
        float e = eru(p); col = mix(col, vec3(1.0, 0.42, 0.06), e * 0.85); col = mix(col, vec3(1.0, 0.66, 0.2), smoothstep(0.55, 1.0, e) * 0.6);   // the dome hot orange, its crown yellow
        gl_FragColor = vec4(col * 0.75, 1.0);   // (kept under the tone mapping's shoulder: brighter, the reds washed out to cream)
        #include <colorspace_fragment>
      }` }));
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); S.add(m);
  E.world.updaters.push((dt, tt) => { U.uTime.value = tt; });   // (game time: keeps to the fast-forward)
  return m;
}
// mild eruptions: now and then (each of up to four at once, a second or two apart) a spot of the lava heaves up into a
// glowing dome and breaks, throwing a few molten blobs that arc up a little and drop back, cooling from yellow to dark
// red and shrinking as they fall. sites: [x, y, z] on the lava. On game time (keeps to the fast-forward)
function eruptions(E, S, sites) {
  if (!sites.length) return;
  const N = 12, slots = ERU.value.length, blobs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), slots * N);
  blobs.frustumCulled = false; blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S.add(blobs);
  const d = new THREE.Object3D(), c = new THREE.Color(), state = Array.from({ length: slots }, (_, i) => ({ t0: 0.6 + i * 0.9, at: null, parts: [] }));
  const DUR = 1.5, LAUNCH = 0.35, G = 7;
  E.world.updaters.push((dt, t) => {
    state.forEach((st, i) => {
      if (!st.at && t >= st.t0) {   // a new one: a spot, its blobs
        st.at = sites[Math.floor(Math.random() * sites.length)]; st.t0 = t; const sc = 0.7 + Math.random() * 0.5;
        st.parts = Array.from({ length: N }, () => { const a = Math.random() * Math.PI * 2, sp = (0.2 + Math.random() * 0.45) * sc; return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (1.8 + Math.random() * 0.9) * Math.sqrt(sc), r: 0.04 + Math.random() * 0.045, lag: Math.random() * 0.12 }; });
        st.sc = sc;
      }
      const k = st.at ? (t - st.t0) / DUR : 0;
      ERU.value[i].set(st.at ? st.at[0] : -99, st.at ? st.at[2] : -99, Math.min(1, Math.max(0, k)), st.at ? 0.8 * st.sc : 0);
      st.parts.forEach((q, j) => {
        const tau = (t - st.t0) - LAUNCH - q.lag, idx = i * N + j;
        let y = -1e3; if (st.at && tau > 0) y = st.at[1] + 0.06 + q.vy * tau - 0.5 * G * tau * tau;
        if (!st.at || tau <= 0 || y < st.at[1]) { d.position.set(0, -50, 0); d.scale.setScalar(0.0001); }
        else { const life = Math.min(1, tau / (2 * q.vy / G)); d.position.set(st.at[0] + q.vx * tau, y, st.at[2] + q.vz * tau); d.scale.setScalar(q.r * (1 - 0.45 * life));
          blobs.setColorAt(idx, c.setRGB(0.95 - 0.35 * life, 0.32 - 0.26 * life, 0.05 - 0.04 * life)); }   // (orange cooling to dark red: brighter went white under the bloom)
        d.updateMatrix(); blobs.setMatrixAt(idx, d.matrix);
      });
      if (st.at && k >= 1) { st.at = null; st.parts = []; st.t0 = t + 0.4 + Math.random() * 1.6; }
    });
    blobs.instanceMatrix.needsUpdate = true; if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
  });
}
// the cave's rock (the art's cobbled mauve-brown walls): rounded stones packed in a matrix of darker grit, each its own
// shade, soot in the crevices
function cobbleTex() {   // (kit/terrain.js Land lays only the colour on the rock: each stone's rounding is painted into it)
  return T.pbr('fireCobble', 1024, (u, v, o) => {
    const [w0, w1, id] = T.worley(u, v, 5, 171, 0.8), gap = w1 - w0 + (T.fbm(u, v, 20, 3, 174) - 0.5) * 0.1, stone = T.smooth(0.0, 0.3, gap);
    const n = T.fbm(u, v, 16, 5, 172), big = T.fbm(u, v, 2, 3, 173), crown = T.smooth(0.55, 0.0, w0);
    let c = T.mixc([0.34, 0.2, 0.18], [0.64, 0.44, 0.38], id * 0.35 + n * 0.4 + big * 0.25);
    c = c.map(q => q * (0.72 + 0.4 * crown));   // lit on its crown, shaded toward its edges
    c = T.mixc(c.map(q => q * 0.4), c, stone);
    o.c = c; o.h = 0.25 + stone * (0.3 + crown * 0.35) + n * 0.12; o.r = 0.85;
  }, 5);
}
// the floor (the art's orange-brown ground, streaked on the slant): scorched earth, streaks running across it, ash grey
// in patches, cinders, fine cracks
function scorchTex() {
  return T.pbr('fireScorch', 1024, (u, v, o) => {
    const su = (u + v) % 1, sv = ((v - u) % 1 + 1) % 1, streak = T.fbmA(su, sv, 40, 6, 4, 181), n = T.fbm(u, v, 9, 4, 182), ash = T.smooth(0.58, 0.78, T.fbm(u, v, 4, 4, 183));
    const [w0, w1] = T.worley(u, v, 6, 184, 0.9), crack = T.smooth(0.015, 0.0, w1 - w0) * T.smooth(0.5, 0.65, T.fbm(u, v, 3, 3, 185)), cinder = T.smooth(0.82, 0.9, T.pnoise(u * 160, v * 160, 160, 186));
    let c = T.mixc([0.42, 0.2, 0.08], [0.66, 0.36, 0.15], streak * 0.6 + n * 0.4);
    c = T.mixc(c, [0.4, 0.33, 0.28], ash * 0.45); c = T.mixc(c, [0.14, 0.07, 0.04], Math.max(crack * 0.7, cinder * 0.6));
    o.c = c; o.h = 0.4 + streak * 0.2 + n * 0.15 - crack * 0.3 + cinder * 0.15; o.r = 0.92;
  }, 3);
}
// a grey boulder (the art's rounded grey stones on the lair's island): lumpy and rounded, some standing taller, sooted
// at the foot, warmed by the lava's light from below
function boulder(mat, x, z, y, seed) {
  const g = new THREE.Group(), tall = (seed * 7) % 3 === 0;
  for (const [dx, dz, k] of tall ? [[0, 0, 1]] : [[0, 0, 1], [0.17, 0.12, 0.55]]) {
    const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 0.8 + 0.4 * T.fbm((v.x + 1) / 2, (v.z + v.y + 2) / 4, 3, 3, seed + k * 9) + 0.08 * T.fbm((v.x + 1) / 2, (v.y + 1) / 2, 9, 2, seed + 3); p.setXYZ(i, v.x * f, Math.max(-0.35, v.y) * f, v.z * f); }
    geo.computeVertexNormals();
    const C = new Float32Array(p.count * 3), nr = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i), up = nr.getY(i), c = 0.75 + 0.3 * Math.max(0, up) + 0.15 * T.fbm(i * 0.0137 % 1, 0.5, 6, 2, seed), soot = Math.max(0, -yy * 1.4 - 0.1);
      C.set([c * (1 - soot * 0.6) + Math.max(0, -up) * 0.25, c * (1 - soot * 0.65) + Math.max(0, -up) * 0.08, c * (1 - soot * 0.65)], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const s = (tall ? 0.24 : 0.27) * k, m = new THREE.Mesh(geo, mat); m.scale.set(s, s * (tall ? 2.0 : 1.05), s * 0.9); m.position.set(x + dx, y + s * (tall ? 2.0 : 1.05) * 0.3, z + dz); m.rotation.y = seed;
    g.add(m);
  }
  return shade(g);
}
function setFor(fixedKey) {
  const roomNow = () => fixedKey === '0f2034' ? 'lair' : fixedKey === '0f1ffc' ? 'main' : (D.rooms && G.room ? 'lair' : 'main');
  let land = null, chestG = new Map(), M = null, world = null, boulderCells = [], slopesNow = [];
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const R0 = ROOMS[roomNow()], art = R0.art(fixedKey);
    const MW = D.mapW, MH = D.mapH, W = MW * 4;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const lay = await readLayout(art, MW, MH, PALETTE, { [CL.water]: 1.2 });
    const lavaQ = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.water ? 1 : 0; return n; };
    const lava = (x, y) => tc(x, y) === 2 && lavaQ(x, y) >= 8;
    const lone = (x, y) => tc(x, y) === 2 && !lava(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => (tc(x + dx, y + dy) === 2 && !lava(x + dx, y + dy)) || tc(x + dx, y + dy) === 1).length <= 1;
    // floor the art draws on a blocked cell ringed by lava (the lair's island): level, out of reach
    const groundQ = (x, y) => { let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lay[(y * 4 + j) * W + x * 4 + i] === CL.ground ? 1 : 0; return n; };
    const isle = (x, y) => tc(x, y) === 2 && !lava(x, y) && !lone(x, y) && groundQ(x, y) >= 10 && [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => lava(x + dx, y + dy));
    const t = terraces({ w: MW, h: MH, terrain: D.terrain, start: R0.start, levels: R0.levels, stairs: R0.stairs, flat: (x, y) => lava(x, y) || lone(x, y) || isle(x, y) });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = (y * 4 + j) * W + x * 4 + i;
      lay[k] = t.walk(x, y) || lone(x, y) || isle(x, y) ? CL.ground : lava(x, y) ? (lay[k] === CL.water ? CL.water : CL.ground) : CL.rock;   // (the lava's shore as the art draws it)
    }
    land = new Land({ w: MW, h: MH, layout: lay, ext: 10, outside: () => CL.rock, rockH: 1.7, rise: 2.4, lumpH: 0.04, waterDepth: 0.55, waterJitter: 0.45, dry: (x, z) => t.walk(Math.floor(x), Math.floor(z)),
      cap: (x, z) => z < MH - 0.7 ? 99 : 0.45 + Math.max(0, z - MH) * 0.5,
      ramps: R0.stairs.map(s => ({ r: s.r, y0: s.y0, y: s.y, axis: 'z', n: s.n })),
      tex: { dirt: scorchTex(), turf: T.rock(0x2a1612, 'lavaTop', 0.4), rock: cobbleTex() },   // (turf: the rock's tops, topGreen)
      tint: { dirt: 0xffffff, turf: 0xd8c8c0, rock: 0xffffff } });
    land.at = terracedAt(land, t);
    const ground = land.mesh({ dirtK: 0.3, rockK: 0.55, turfK: 0.4, topGreen: 1, bed: 0x2a0800 }); S.add(ground);
    { // crags: the rock broken up finer than the land's lumps, never where a unit stands or by the lava's edge
      const p = ground.geometry.attributes.position, w = v => ((v / 7) % 1 + 1) % 1, open = (x, z) => [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].some(([a, b]) => { const X = Math.floor(x + a), Y = Math.floor(z + b); return t.walk(X, Y) || lava(X, Y) || isle(X, Y) || lone(X, Y) || t.inStair(x + a, z + b); });
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (open(x, z)) continue; const f = Math.min(1, land.weight(x, z, CL.rock) * 1.5);
        p.setXYZ(i, x + (T.fbm(w(x), w(z + y), 22, 3, 41) - 0.5) * 0.14 * f, y + (T.fbm(w(x + y), w(z), 26, 3, 42) - 0.5) * 0.18 * f, z + (T.fbm(w(x + y), w(z), 22, 3, 43) - 0.5) * 0.14 * f); }
      ground.geometry.computeVertexNormals();
    }
    // the lava: each pool a slab of slowly moving molten rock, its light on the walls round it
    const seen = new Set(), eruptSites = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!lava(x, y) || seen.has(x + ',' + y)) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y, lv = 9;
      for (const q = [[x, y]]; q.length;) { const [a, b] = q.pop(); if (!lava(a, b) || seen.has(a + ',' + b)) continue; seen.add(a + ',' + b); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); lv = Math.min(lv, t.level(a, b)); q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      lavaPool(E, S, [x0 - 0.6, y0 - 0.6, x1 + 1.6, y1 + 1.6], lv - 0.3);
      for (const k of seen) { const [a, b] = k.split(',').map(Number); if (a >= x0 && a <= x1 && b >= y0 && b <= y1 && lava(a, b) && !eruptSites.some(e => e[3] === k)) eruptSites.push([a + 0.2 + Math.random() * 0.6, lv - 0.3, b + 0.2 + Math.random() * 0.6, k]); }
      for (let ly = y0; ly <= y1; ly += 4) for (let lx = x0; lx <= x1; lx += 5) if (lava(lx, ly)) { const L = new THREE.PointLight(0xff8a30, 1.6, 5, 1.8); L.position.set(lx + 0.5, lv + 0.6, ly + 0.5); S.add(L); }
    }
    eruptions(E, S, eruptSites);
    const rockM = T.material(T.rock(0x4a2a20, 'cinder', 0.4), { color: 0xe8c8b8 }, [0.5, 0.5]);
    const greyM = T.material(T.rock(0x8a8884, 'boulderGrey', 0.2), { color: 0xffffff, vertexColors: true, roughness: 0.75 }, [0.6, 0.6]);
    boulderCells = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (isle(x, y)) boulderCells.push([x, y]);   // (the island's cells: out of reach, tools/qa/sets.js)
    const chestAt = new Set((D.rooms && G.chests ? G.chests : D.chests || []).map(c => c.x + ',' + c.y));   // (no boulder on a chest's cell: it stood in the open chest)
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (lone(x, y) && !chestAt.has(x + ',' + y)) { S.add(boulder(greyM, x + 0.5, y + 0.55, land.at(x + 0.5, y + 0.5), x * 5 + y * 3)); boulderCells.push([x, y]); }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) S.add(tunnel(rockM, x + 0.5, y + 0.5, land.at(x + 0.5, y + 0.5), voidSide(tc, x, y)));
    // skulls and bones where the art strews them (its little pale clusters on the floor)
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = art; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0);
    const px = g2.getImageData(0, 0, img.width, img.height).data, pale = new Set([0xfcfcd8, 0xd8d8d8, 0xfcfcfc]), boneM = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.8 });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!t.walk(x, y)) continue; let n = 0, sx = 0, sz = 0;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = ((y * 32 + j) * img.width + x * 32 + i) * 4; if (pale.has((px[k] << 16) | (px[k + 1] << 8) | px[k + 2])) { n++; sx += i; sz += j; } }
      if (n >= 6) { const bx = x + sx / n / 32, bz = y + sz / n / 32; S.add(bones(boneM, bx, bz, land.at(bx, bz), (x * 7 + y * 3) % 10 / 10)); }
    }
    // the chests as left
    const chests = D.rooms && G.chests ? G.chests : (D.chests || []).map(c => Object.assign({ open: false }, c));
    for (const c of chests) if (!c.hidden || c.open) { const o = chest(M, c.x + 0.5, c.y + 0.5, land.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.4); S.add(o); chestG.set(c.x + ',' + c.y, o); }
    S.add(stones(land.scatter(CL.rock, 1.4, (x, z) => land.weight(x, z, CL.ground) > 0.1), rockM, { size: 0.2 }));
    S.add(stones(land.scatter(CL.ground, 0.5, (x, z) => t.walk(Math.floor(x), Math.floor(z)) && !t.inStair(x, z) && !chests.some(c => Math.floor(x) === c.x && Math.floor(z) === c.y)), rockM, { size: 0.06 }));
    slopesNow = R0.stairs.flatMap(({ r: [x0, z0, x1, z1] }) => { const out = []; for (let y = z0; y < z1; y++) for (let x = x0; x < x1; x++) out.push([x, y]); return out; });
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, land.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.4); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => land ? land.at(x, z) : 0,
    get props() { return boulderCells; }, get slopes() { return slopesNow; },
    // the lava's red glow from below, the cave's dark above
    mood: { bg: 0x0a0503, voidCol: 0x0a0503, voidY: -1.5, fog: 0x140806, fogD: 0.016, sky: 0xffe4cc, under: 0x4a2414, hemi: 0.95,
      sun: 0xfff0e0, sunI: 2.3, sunDir: [-0.3, 0.9, 0.35], sat: 0.98, exposure: 1.1, bloom: 0.45, aoR: 0.8,
      env: { top: 0x7a5a48, mid: 0x4a2a1c, low: 0x200a04, lights: [[0, 7, 3, 0xffe0c8, 3]] } },
  };
}
export const fireCave = setFor('0f1ffc');
export const fireLair = setFor('0f2034');
export default setFor(null);   // battle 14: the room the party is in
