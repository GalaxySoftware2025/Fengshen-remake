// The 演武場 (the test page's arena, #arena): a training ground of the remake's own, on no map of the original. An 11 x 8
// board (src/testkit.js arena: every cell open but the two braziers' at (5, 1) and (5, 6)) on a terrace of large worn
// flagstones, light so the dark move squares read; cut-stone walls drop from it to a packed-earth yard; a stone balustrade
// with lacquered rails on three sides, broad steps down the front (toward the camera: nothing stands before the front
// row); the two cover cells are bronze cauldrons burning (the remake's real fire) on stone plinths. In the yard behind: two weapon racks of
// spears with red tassels, a war drum on its stand between them, red banners on poles at the terrace's corners, and a
// plastered wall under grey tiles closing the ground. A clear, warm afternoon.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { box, shade, merged, mats, ding } from '../kit/parts.js';
import { sheets } from '../kit/fire.js';

export const W = 11, H = 8, BRAZIERS = [[5, 1], [5, 6]];
const EDGE = 0.7, YARD = -0.7, STEPS = 3;
const lathe = (pts, mat, seg = 32) => shade(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat));

// the ground: the terrace top (0) over the board and its margin, the steps down the front, the yard round it
function ground(x, z) {
  if (x >= -EDGE && x <= W + EDGE && z >= -EDGE && z <= H + EDGE) return 0;
  if (x >= -EDGE && x <= W + EDGE && z > H + EDGE && z <= H + EDGE + STEPS * 0.32) return YARD * Math.ceil((z - H - EDGE) / 0.32) / STEPS;
  return YARD;
}
// a spear in a rack: a turned shaft, a steel leaf blade, a red horsehair tassel under it
function spear(M, steel, red, x, z, y, lean) {
  const g = new THREE.Group(), L = 1.9;
  const shaft = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, L, 10), M.wood)); shaft.position.y = L / 2; g.add(shaft);
  const blade = lathe([[0, 0], [0.045, 0.06], [0.05, 0.14], [0.03, 0.26], [0, 0.34]], steel, 4); blade.scale.z = 0.35; blade.position.y = L; g.add(blade);
  const tas = lathe([[0.02, 0.1], [0.07, 0.04], [0.09, -0.08], [0.05, -0.16], [0, -0.17]], red, 16); tas.position.y = L - 0.02; g.add(tas);
  g.position.set(x, y, z); g.rotation.z = lean; return g;
}
function rack(M, steel, red, x0, x1, z, y) {
  const g = new THREE.Group(), dark = T.material(T.wood(0x3a2414, 'rackWood'));
  for (const x of [x0, x1]) g.add(box(dark, x - 0.06, y, z - 0.06, x + 0.06, y + 1.5, z + 0.06, 4));
  g.add(box(dark, x0 - 0.1, y + 1.32, z - 0.05, x1 + 0.1, y + 1.42, z + 0.05, 4), box(dark, x0, y + 0.42, z - 0.12, x1, y + 0.5, z + 0.12, 4));
  const n = Math.round((x1 - x0) / 0.32);
  for (let i = 1; i < n; i++) g.add(spear(M, steel, red, x0 + i * (x1 - x0) / n, z + 0.02, y + 0.46, (i % 2 ? 1 : -1) * 0.04));
  return shade(g);
}
// the war drum: a red-lacquered barrel bound with brass, two hide heads, tilted toward the ground on a wooden stand
function drum(M, x, z, y) {
  const g = new THREE.Group(), d = new THREE.Group(), R = 0.48, Ld = 0.62, hide = T.material(T.paper(0xd8c49a), { roughness: 0.85 });
  const prof = []; for (let i = 0; i <= 10; i++) { const v = i / 10; prof.push([R * (0.9 + 0.1 * Math.sin(v * Math.PI)), v * Ld - Ld / 2]); }
  d.add(lathe(prof, M.lacquer, 40));
  for (const s of [-1, 1]) {
    const head = shade(new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 40), hide)); head.position.y = s * Ld / 2; head.rotation.x = -s * Math.PI / 2; d.add(head);
    const band = shade(new THREE.Mesh(new THREE.TorusGeometry(R * 0.91, 0.022, 8, 40), M.gold)); band.position.y = s * (Ld / 2 - 0.03); band.rotation.x = Math.PI / 2; d.add(band);
  }
  d.rotation.x = Math.PI / 2 - 0.35; d.position.y = y + 1.05; g.add(d);
  const wood = T.material(T.wood(0x4a2a16, 'drumStand'));
  for (const s of [-1, 1]) { g.add(box(wood, s * 0.55 - 0.05, y, -0.05, s * 0.55 + 0.05, y + 1.2, 0.05, 4)); }
  g.add(box(wood, -0.6, y + 0.3, -0.04, 0.6, y + 0.38, 0.04, 4));
  for (const s of [-1, 1]) { const st = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 8), wood)); st.position.set(s * 0.22, y + 0.5, 0.42); st.rotation.x = 0.5; st.rotation.z = s * 0.4; g.add(st); }
  g.position.set(x, 0, z); return shade(g);
}
// a banner: a lacquered pole with a gilt finial, a red silk flag hung from a crossbar, rippling slowly in the wind
function banner(M, red, x, z, y, flags) {
  const g = new THREE.Group(), Hp = 3.4;
  const pole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, Hp, 12), M.lacquerDark)); pole.position.y = y + Hp / 2; g.add(pole);
  const fin = lathe([[0, 0], [0.06, 0.04], [0.04, 0.12], [0, 0.22]], M.gold, 12); fin.position.y = y + Hp; g.add(fin);
  g.add(box(M.lacquerDark, -0.02, y + Hp - 0.22, -0.02, 0.75, y + Hp - 0.16, 0.02, 4));
  const geo = new THREE.PlaneGeometry(0.66, 1.5, 10, 12); geo.translate(0.4, y + Hp - 0.95, 0);
  const flag = shade(new THREE.Mesh(geo, red)); g.add(flag);
  flags.push({ geo, base: Float32Array.from(geo.attributes.position.array), ph: x * 0.7 + z });
  g.position.set(x, 0, z); return g;
}

async function build(E) {
  const S = E.world.scene, M = mats();
  const slab = T.material(T.bricks(0xc4bba0, 2, 'arenaSlab'), { roughness: 0.9 }, [(W + EDGE * 2) / 2, (H + EDGE * 2) / 2]);
  const wall = T.material(T.bricks(0x8e8672, 3, 'arenaWall'), {}, [1, 1]), cap = T.material(T.bricks(0xb4ac94, 1, 'arenaCap'), {}, [1, 1]);
  const yard = T.material(T.dirt(0xb09c78, 'arenaYard'), {}, [24, 24]);
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.3 });
  const red = T.material(T.silk(0xa81c14), { sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(1, 0.6, 0.4), side: THREE.DoubleSide });
  // the yard, the terrace (walls of cut stone, its top paved), the steps down the front
  const yd = shade(new THREE.Mesh(new THREE.PlaneGeometry(60, 40).rotateX(-Math.PI / 2), yard), false); yd.position.set(W / 2, YARD, H / 2); S.add(yd);
  S.add(shade(box(wall, -EDGE, YARD, -EDGE, W + EDGE, -0.02, H + EDGE, 2)));
  const top = shade(new THREE.Mesh(new THREE.PlaneGeometry(W + EDGE * 2, H + EDGE * 2).rotateX(-Math.PI / 2), slab), false); top.position.set(W / 2, 0, H / 2); S.add(top);
  for (let i = 0; i < STEPS; i++) S.add(shade(box(cap, -EDGE, YARD, H + EDGE, W + EDGE, YARD * (i + 1) / STEPS, H + EDGE + (STEPS - i) * 0.32, 2)));
  // the balustrade on the back and the sides: square stone posts, a lacquered rail, a stone sill
  const posts = [], rails = [], b = 0.45, yT = 0;
  const run = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.1));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; posts.push(box(cap, x - 0.08, yT, z - 0.08, x + 0.08, yT + b + 0.08, z + 0.08, 4)); }
    rails.push(box(M.lacquer, Math.min(x0, x1) - 0.04, yT + b - 0.06, Math.min(z0, z1) - 0.04, Math.max(x0, x1) + 0.04, yT + b, Math.max(z0, z1) + 0.04, 4));
    rails.push(box(cap, Math.min(x0, x1) - 0.06, yT, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, yT + 0.07, Math.max(z0, z1) + 0.06, 4));
  };
  const e = EDGE - 0.12; run(-e, -e, W + e, -e); run(-e, -e, -e, H + e); run(W + e, -e, W + e, H + e);
  S.add(shade(merged(cap, posts)), shade(merged(M.lacquer, rails.filter((_, i) => i % 2 === 0))), shade(merged(cap, rails.filter((_, i) => i % 2 === 1))));
  // the two braziers: a stone plinth in the cell, a bronze cauldron on it, a fire in it
  // (the fire: the remake's real fire, src/kit/fire.js, three sheets in each bowl; a warm light flickering over it; embers)
  const fire = sheets(S, 12), flames = [], lights = [];
  for (const [cx, cy] of BRAZIERS) {
    const x = cx + 0.5, z = cy + 0.5, ph = 0.42;
    S.add(shade(box(wall, x - 0.42, 0, z - 0.42, x + 0.42, ph - 0.06, z + 0.42, 2)), shade(box(cap, x - 0.46, ph - 0.06, z - 0.46, x + 0.46, ph, z + 0.46, 2)));
    const dg = ding(M, x, z, ph, 0.85); S.add(dg.g);
    for (const [dx, dz, k] of [[-0.09, 0.02, 0], [0.1, -0.03, 1], [0, 0.06, 2]]) flames.push([x + dx, dg.rim - 0.14, z + dz, 1.0 + 0.15 * k, cx * 3.1 + k * 5.7, 1.05, 0.62]);
    const L = new THREE.PointLight(0xff8a3a, 0, 6, 1.6); L.position.set(x, dg.rim + 0.5, z); S.add(L); lights.push({ L, x, y: dg.rim + 0.3, z });
  }
  fire.set(flames);
  let em = 0;
  E.world.updaters.push((dt, t) => {
    fire.tick(t);
    for (const [i, l] of lights.entries()) l.L.intensity = 3.2 * (0.8 + 0.2 * Math.sin(t * 11 + i * 2) * Math.sin(t * 7.3 + i));
    for (em += dt; em > 0.08; em -= 0.08) { const l = lights[(Math.random() * lights.length) | 0]; E.vfx.spark(l.x + (Math.random() - 0.5) * 0.3, l.y + 0.3, l.z, { vx: (Math.random() - 0.5) * 0.3, vy: 0.7 + Math.random() * 0.8, life: 0.7 + Math.random() * 0.8, size: 0.015 + Math.random() * 0.02, r: 1, gg: 0.5 + Math.random() * 0.3, b: 0.12, shape: 1 }); }
  });
  // the yard behind: weapon racks either side of the war drum, banners at the terrace's corners, the wall closing it
  S.add(rack(M, steel, red, 1.2, 4.0, -1.7, YARD), rack(M, steel, red, 7.0, 9.8, -1.7, YARD), drum(M, W / 2, -1.75, YARD));
  const flags = [];
  for (const [x, z] of [[-EDGE - 0.35, -EDGE - 0.35], [W + EDGE + 0.35, -EDGE - 0.35], [-EDGE - 0.35, H + EDGE - 0.3], [W + EDGE + 0.35, H + EDGE - 0.3]]) S.add(banner(M, red, x, z, YARD, flags));
  const plaster = T.material(T.plaster(0xe2d6bc), {}, [6, 1]), tiles = T.material(T.roofTiles(0x4a4c50, 8, 4), {}, [12, 1]);
  S.add(shade(box(plaster, -9, YARD, -3.8, W + 9, YARD + 2.1, -3.45, 1)), shade(box(tiles, -9.2, YARD + 2.1, -4.05, W + 9.2, YARD + 2.3, -3.2, 1)));
  const ridge = shade(new THREE.Mesh(new THREE.BoxGeometry(W + 18.6, 0.16, 0.22), tiles)); ridge.position.set(W / 2, YARD + 2.4, -3.62); S.add(ridge);
  for (const sx of [-1, 1]) { const x = sx < 0 ? -9 : W + 9; S.add(shade(box(plaster, x - 0.18, YARD, -3.8, x + 0.18, YARD + 2.1, H + 8, 1)), shade(box(tiles, x - 0.4, YARD + 2.1, -4, x + 0.4, YARD + 2.3, H + 8, 1))); }
  E.world.updaters.push((dt, t) => {
    for (const f of flags) {   // the flags ripple: a wave running out from the pole, stronger at the free edge
      const p = f.geo.attributes.position, a = p.array, bb = f.base;
      for (let i = 0; i < p.count; i++) { const u = bb[i * 3] - 0.07, v = bb[i * 3 + 1]; a[i * 3 + 2] = bb[i * 3 + 2] + Math.sin(t * 2.2 - u * 7 + f.ph + v * 0.8) * 0.07 * u; }
      p.needsUpdate = true; f.geo.computeVertexNormals();
    }
  });
}

export default {
  build, ground,
  props: BRAZIERS,   // the braziers' cells: a plinth and a cauldron stand there (tools/qa/sets.js)
  // a clear warm afternoon over the yard
  mood: { bg: 0xcfdbe0, voidCol: false, fog: 0xc9d3cf, fogD: 0.012, sky: 0xd8e6ec, under: 0x5a4a34, hemi: 1.0,
    sun: 0xfff0d6, sunI: 3.0, sunDir: [-0.45, 0.85, 0.35], sat: 1.05, exposure: 1.02, bloom: 0.3, aoR: 0.8,
    env: { top: 0xd8e6ec, mid: 0x9a8a70, low: 0x4a3a28, lights: [[-6, 7, 3, 0xfff0d6, 3]] } },
};
