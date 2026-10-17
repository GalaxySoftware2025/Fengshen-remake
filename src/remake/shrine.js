// The 西方守護靈's shrine inside 聖靈山 (map 0f1018: scene 25; battle 12's rooms 1 and 2, the last of them that map),
// remade: floors of gold brick hung over a black void, walls of grey stone carved with clouds along the north, golden
// figures of the Buddha in alcoves with haloes, red-lacquered pillars ringed in gold, blue bronze urns, yin-yang emblems
// inlaid in the floors. Measured on tools/qa/grid.py (0f1018, assets/battles/12/room-1.png) and the rooms' grids:
//   room 1  a walkway (x 4-11, rows 5-22, narrowing to x 6-9 at its south end) across the void, chains crossing the void
//           beside it, two pairs of pillars on brick footings by the north wall (x 1-2 and 13-14), the way on: steps up
//           into an arched door in the wall's middle (x 7-8, rows 5-6)
//   room 2  the hall: an altar dais up three steps (x 6-9, rows 4-5; a chest on it at (7, 4)), the upper floor (x 1-14,
//           rows 6-12) between rows of pillars, two flights down (x 4-5 and 10-11, rows 13-15) to the lower hall (x 3-12,
//           rows 16-21) with its emblem and its pillar pairs on the void's edge, chained to it, the way in up the steps at
//           its south end (x 7-8, rows 22-23)
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged } from '../kit/parts.js';
import { D, G } from '../rules.js';

const UP = 0.6, ALTAR = 0.95, BASE = -3.5;
const ROOMS = {
  1: {
    floors: [[4, 5, 12, 23, 0], [6, 23, 10, 25, 0]],
    stairs: [],
    walls: [[0, 0, 6, 4.95], [6, 0, 7, 7.05], [9, 0, 10, 7.05], [7, 0, 9, 4.6], [10, 0, 16, 4.95]],   // the door's frame is the middle block's sides
    door: [7, 4.6, 9, 7.05],
    statues: [[1.5], [4.5], [11.5], [14.5]],
    pillars: [[1.5, 5.6], [2.5, 5.6], [13.5, 5.6], [14.5, 5.6]], footings: [[1, 7.7, 3, 9.2], [13, 7.7, 15, 9.2]],
    urns: [[4.5, 9.5], [11.5, 9.5], [4.5, 14.5], [11.5, 14.5], [4.5, 19.5], [11.5, 19.5]],
    emblems: [[8, 12.3, 1.8]],
    chains: [[[0, 9.6], [4, 9.6]], [[12, 9.6], [16, 9.6]], [[4, 10.6], [0, 15]], [[0, 11], [4, 15.5]], [[4, 15.6], [0, 20]], [[0, 16], [4, 20.5]], [[4, 20.6], [1.5, 24]],
      [[12, 10.6], [16, 15]], [[16, 11], [12, 15.5]], [[12, 15.6], [16, 20]], [[16, 16], [12, 20.5]], [[12, 20.6], [14.5, 24]]],
  },
  2: {
    floors: [[5.4, 2.9, 10.6, 6, ALTAR], [1, 6, 15, 13, UP], [3, 16, 13, 22, 0], [7, 22, 9, 24, 0], [0, 13, 4, 14, UP], [6, 13, 10, 14, UP], [12, 13, 16, 14, UP]],
    stairs: [[7, 6, 9, 9, UP, ALTAR, 3, 's'], [4, 13, 6, 16, 0, UP, 4, 's'], [10, 13, 12, 16, 0, UP, 4, 's'], [7, 22, 9, 24, 0, -0.45, 3, 'n']],
    walls: [[0, 0, 5.4, 5.05], [5.4, 0, 10.6, 2.9], [10.6, 0, 16, 5.05]],   // (the middle drawn back: the 守護靈 comes and goes in its recess, scene 25 f499-518)
    statues: [[3.5], [6.5], [9.5], [12.5]],
    pillars: [[0.5, 3.6], [0.5, 5.6], [0.5, 7.6], [0.5, 9.6], [0.5, 11.6], [15.5, 3.6], [15.5, 5.6], [15.5, 7.6], [15.5, 9.6], [15.5, 11.6],
      [0.5, 14.6], [1.5, 14.6], [0.5, 16.6], [1.5, 16.6], [0.5, 18.6], [1.5, 18.6], [0.5, 20.6], [1.5, 20.6],
      [14.5, 14.6], [15.5, 14.6], [14.5, 16.6], [15.5, 16.6], [14.5, 18.6], [15.5, 18.6], [14.5, 20.6], [15.5, 20.6]],
    footings: [[0, 21.9, 2, 23], [14, 21.9, 16, 23]],
    urns: [[5.5, 5.6], [10.5, 5.6], [3.5, 7.5], [12.5, 7.5], [4.5, 9.5], [11.5, 9.5], [6.5, 11.5], [9.5, 11.5], [3.5, 16.5], [12.5, 16.5], [3.5, 21.5], [12.5, 21.5]],
    emblems: [[8, 18.3, 1.8]],
    chains: [[[2, 17.3], [3, 17.3]], [[2, 19.3], [3, 19.3]], [[2, 21.3], [3, 21.3]], [[13, 17.3], [14, 17.3]], [[13, 19.3], [14, 19.3]], [[13, 21.3], [14, 21.3]],
      [[2, 22.6], [0, 24.5]], [[14, 22.6], [16, 24.5]]],
  },
};
let world = null, M = null, chestG = new Map(), LV = null, cur = 2;

// the yin-yang inlaid in the floor: dark bronze and pale gold, as the art draws it
function emblemTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = 120, O = 128;
  g.fillStyle = '#e8c840'; g.beginPath(); g.arc(O, O, R, 0, 7); g.fill();
  g.fillStyle = '#6a3a14'; g.beginPath(); g.arc(O, O, R, Math.PI / 2, Math.PI * 1.5); g.arc(O, O - R / 2, R / 2, Math.PI * 1.5, Math.PI / 2, true); g.arc(O, O + R / 2, R / 2, -Math.PI / 2, Math.PI / 2); g.fill();
  g.fillStyle = '#e8c840'; g.beginPath(); g.arc(O, O + R / 2, R / 7, 0, 7); g.fill();
  g.fillStyle = '#6a3a14'; g.beginPath(); g.arc(O, O - R / 2, R / 7, 0, 7); g.fill();
  g.strokeStyle = '#4a2a0c'; g.lineWidth = 4; g.beginPath(); g.arc(O, O, R, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a golden Buddha standing in a dark alcove, a halo behind his head
function statue(gold, x, z, y) {
  const g = new THREE.Group();
  const prof = [[0.2, 0], [0.22, 0.08], [0.17, 0.3], [0.15, 0.6], [0.17, 0.8], [0.13, 0.95], [0.06, 1.0], [0.001, 1.01]].map(([r, h]) => new THREE.Vector2(r, h));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), gold); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), gold); head.position.y = 1.08; g.add(head);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), gold); knot.position.y = 1.17; g.add(knot);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffe890, emissive: 0xffc840, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 }));
  halo.position.set(0, 1.08, -0.08); g.add(halo);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.35, depthWrite: false })); glow.position.set(0, 1.08, -0.09); g.add(glow);
  const alcove = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.45), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 })); alcove.position.set(0, 0.68, -0.14); g.add(alcove);
  for (const [w, h, px, py] of [[0.7, 0.05, 0, 1.42], [0.05, 1.45, -0.33, 0.69], [0.05, 1.45, 0.33, 0.69]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), gold); f.position.set(px, py, -0.12); g.add(f); }   // its gold frame
  g.scale.setScalar(1.35); g.position.set(x, y, z); return shade(g);
}
// a red-lacquered pillar ringed in gold, from deep in the void (or from the floor) up past the walls' tops
function pillar(red, gold, x, z, y0, y1) {
  const g = new THREE.Group(), h = y1 - y0;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, h, 16), red); p.position.y = y0 + h / 2; g.add(p);
  for (let y = y1 - 0.15; y > y0 + 0.2 && y > -1.2; y -= 1.0) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.12, 16), gold); r.position.y = y; g.add(r); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.18, 16), gold); cap.position.y = y1 + 0.05; g.add(cap);
  g.position.set(x, 0, z); return shade(g);
}
// a blue bronze urn on three short feet
function urn(bronze, x, z, y) {
  const prof = [[0.001, 0.06], [0.16, 0.07], [0.22, 0.16], [0.24, 0.26], [0.2, 0.36], [0.16, 0.4], [0.2, 0.44], [0.2, 0.47], [0.15, 0.47], [0.13, 0.42]].map(([r, h]) => new THREE.Vector2(r, h));
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), bronze); g.add(m);
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 6), bronze); f.position.set(Math.cos(k * 2.09) * 0.13, 0.04, Math.sin(k * 2.09) * 0.13); g.add(f); }
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a1a10 })); ember.position.y = 0.43; g.add(ember);
  g.scale.setScalar(1.55); g.position.set(x, y, z); return shade(g);
}
// a chain of links between two points of the void's edge, sagging a little, just below the floors
function chain(iron, a, b, y) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(len / 0.13)), geo = new THREE.TorusGeometry(0.05, 0.014, 6, 10);
  const m = new THREE.InstancedMesh(geo, iron, n), d = new THREE.Object3D(), yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; d.position.set(a[0] + (b[0] - a[0]) * k, y - Math.sin(k * Math.PI) * 0.18 * len / 4, a[1] + (b[1] - a[1]) * k); d.rotation.set(i % 2 ? Math.PI / 2 : 0, -yaw, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
  m.castShadow = true; return m;
}

function setFor(fixedKey) {
  const roomNow = () => fixedKey ? 2 : (D.rooms ? G.room || 2 : 2);
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
    const k = roomNow(), R = ROOMS[k]; cur = k;
    const MW = D.mapW, MH = D.mapH;
    LV = new Levels(MW, MH, 4); const WL = new Levels(MW, MH, 4);
    for (const [x0, z0, x1, z1, y] of R.floors) LV.set(x0, z0, x1, z1, y);
    for (const [x0, z0, x1, z1, y0, y1, n, from] of R.stairs) LV.stairs(x0, z0, x1, z1, y0, y1, n, from);
    for (const [x0, z0, x1, z1] of R.walls) WL.set(x0, z0, x1, z1, 3.2);
    const goldBrick = T.material(T.bricks(0xc89a1c, 3, 'shrineFloor'), { color: 0xffe8a0, roughness: 0.55, metalness: 0.15, emissive: new THREE.Color(0.06, 0.04, 0) }, [2, 2]);
    const brickSide = T.material(T.bricks(0x8a5a10, 4, 'shrineFace'), { color: 0xf0c880, roughness: 0.7 }, [1, 1]);
    const cloud = T.material(T.cloudRelief(2, { ground: [[0.32, 0.32, 0.29], [0.42, 0.42, 0.38]], line: [[0.66, 0.66, 0.6], [0.84, 0.84, 0.76]], name: 'stone' }), { roughness: 0.9 }, [0.5, 0.5]);   // grey stone, pale clouds (the art's)
    const wallTop = new THREE.MeshStandardMaterial({ color: 0x18160f, roughness: 1 });
    S.add(LV.mesh(goldBrick, brickSide, BASE, 0.5), WL.mesh(wallTop, cloud, 0, 0.5));
    // the steps: gold brick slabs over each flight
    for (const [x0, z0, x1, z1, y0, y1, n, from] of R.stairs) {
      const parts = [], dz = (z1 - z0) / n;
      for (let i = 0; i < n; i++) { const t = (i + 1) / n, h = from === 's' ? y0 + (y1 - y0) * t : y0 + (y1 - y0) * t, za = from === 's' ? z1 - (i + 1) * dz : z0 + i * dz; parts.push(box(goldBrick, x0 + 0.04, Math.min(y0, y1) - 0.6, za, x1 - 0.04, h, za + dz)); }
      S.add(shade(merged(goldBrick, parts)));
    }
    // the door on (room 1): steps up into a dark arch
    if (R.door) {
      const [x0, z0, x1, z1] = R.door, sh = new THREE.Shape(), w = x1 - x0 - 0.2, h = 1.5;
      sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h * 0.6); sh.absarc(0, h * 0.6, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
      const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshBasicMaterial({ color: 0x020202 })); hole.position.set((x0 + x1) / 2, 0.45, z0 + 0.02); S.add(hole);
      const st = []; for (let i = 0; i < 4; i++) st.push(box(goldBrick, x0 + 0.1, 0, z1 - (i + 1) * (z1 - z0) / 4, x1 - 0.1, 0.12 * (i + 1), z1 - i * (z1 - z0) / 4));
      S.add(shade(merged(goldBrick, st)));
      const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.06, 0.07, 8, 20, Math.PI), M.gold); arch.position.set((x0 + x1) / 2, 0.45 + h * 0.6, z0 + 0.04); S.add(shade(arch));
    }
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, metalness: 0.85, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0x6a1a1c, roughness: 0.45, metalness: 0.1 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x1a5a9a, metalness: 0.55, roughness: 0.4, emissive: 0x041428 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x6a4a24, metalness: 0.7, roughness: 0.5 });
    const wallFront = (x) => R.walls.filter(([a, , b]) => x >= a && x < b).reduce((m, [, , , z1]) => Math.max(m, z1), 0);
    for (const [x] of R.statues) { const z = wallFront(x) + 0.18; S.add(statue(gold, x, z, LV.at(x, z + 0.4) || (k === 2 ? UP : 0))); }   // each in its alcove on the wall's face
    for (const [x, z] of R.pillars) S.add(pillar(red, M.gold, x, z, isNaN(LV.H[Math.floor(z * 4) * MW * 4 + Math.floor(x * 4)]) ? BASE : LV.at(x, z), 3.0));
    for (const [x0, z0, x1, z1] of R.footings || []) S.add(shade(box(brickSide, x0, -2.5, z0, x1, 0.05, z1)));
    for (const [x, z] of R.urns) S.add(urn(bronze, x, z, LV.at(x, z)));
    const em = new THREE.MeshStandardMaterial({ map: emblemTex(), roughness: 0.5, metalness: 0.2, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [x, z, r] of R.emblems) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), em); m.position.set(x, LV.at(x, z) + 0.006, z); m.receiveShadow = true; S.add(m); }
    for (const [a, b] of R.chains) S.add(chain(iron, a, b, k === 2 && a[1] < 14 ? UP - 0.25 : -0.25));
    // the chests as left
    const chests = D.rooms && G.chests ? G.chests : (k === 2 ? [{ x: 7, y: 4 }, { x: 1, y: 12 }, { x: 14, y: 12 }] : []).map(c => Object.assign({ open: false }, c));
    for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, LV.at(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(g); chestG.set(c.x + ',' + c.y, g); }
    // warm light from the statues' haloes
    for (const [x] of R.statues) { const L = new THREE.PointLight(0xffd890, 2.2, 6, 1.6); L.position.set(x, 1.8 + (k === 2 ? UP : 0), wallFront(x) + 0.8); S.add(L); }
    void FX;
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S || !LV) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, LV.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
  }
  return {
    build, openChest, ground: (x, z) => LV ? LV.at(x, z) : 0,
    get slopes() { const out = []; if (!LV) return out; for (const r of LV.ramps) for (let y = r.z0; y < r.z1; y++) for (let x = r.x0; x < r.x1; x++) out.push([x, y]); return out; },
    get props() { return (ROOMS[cur].urns || []).map(([x, z]) => [Math.floor(x), Math.floor(z)]); },
    // the void's dark, the gold catching the haloes' warm light
    mood: { bg: 0x010101, voidCol: 0x010101, voidY: BASE, fog: 0x050403, fogD: 0.02, sky: 0xfff0d0, under: 0x2a1a08, hemi: 0.9,
      sun: 0xfff0d0, sunI: 2.2, sunDir: [-0.3, 0.9, 0.45], sat: 1.05, exposure: 1.1, bloom: 0.45, aoR: 0.8,
      env: { top: 0x8a7a58, mid: 0x4a3a20, low: 0x100a04, lights: [[0, 7, 3, 0xfff0d0, 4]] } },
  };
}
export const shrineHall = setFor('0f1018');
export default setFor(null);   // battle 12: the room the party is in (1 or 2; room 0 is the mountain, src/remake/mountain.js)
