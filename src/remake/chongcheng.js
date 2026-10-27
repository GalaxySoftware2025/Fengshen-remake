// 崇侯虎's hall in 崇城 (maps 0f52a8 and 0f5894, the same art: scenes 38 and 40), remade: a floor of golden brick in the
// dark, measured on tools/qa/grid.py 0f52a8:
//   the floor     rows 9-14 (x 4-13), a red carpet up its middle (x 7-10) from the south to the throne
//   the terrace   rows 7-8 either side of the carpet (x 4-7, 10-13), a jade balustrade along its front over a brick face
//   the dais      rows 2-6 (x 4-13), up the carpeted stair (x 7-10, rows 6.5-9); jade balustrades along its front (x 5-7,
//                 10-12) and down its sides (x 5, 11.5); 崇侯虎's throne at (8.5, 3.0) before a grey stone wall with a
//                 gilt crest, stone blocks at its corners
// Lit warm from braziers either side of the dais.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, shade, merged, stairs, throne } from '../kit/parts.js';

const MW = 16, MH = 15, MID = 0.35, DAIS = 0.7, BASE = -6, TZ = 3.0;   // TZ: the throne's middle (崇侯虎 sits at 3.5, on its front)
function levels() {
  const L = new Levels(MW, MH, 4);
  L.set(4, 8.75, 13, 15, 0).set(4, 6.75, 7, 8.75, MID).set(10, 6.75, 13, 8.75, MID).set(4, 2, 13, 6.75, DAIS).set(7, 6.75, 10, 9, 0);
  L.stairs(7, 6.5, 10, 9, 0, DAIS, 7, 's');
  return L;
}
const LV = levels();
let built = false;

// a jade balustrade from (x0, z0) to (x1, z1) at height y: square green posts with gilt caps, a rail and a carved panel
function jadeRail(M, x0, z0, x1, z1, y) {
  const parts = [], gilt = [], along = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = along ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 0.5));
  for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; parts.push(box(M.jade, x - 0.06, y, z - 0.06, x + 0.06, y + 0.5, z + 0.06, 2)); gilt.push(box(M.gold, x - 0.075, y + 0.5, z - 0.075, x + 0.075, y + 0.56, z + 0.075, 2)); }
  const t = 0.04; parts.push(along ? box(M.jade, x0, y + 0.08, z0 - t, x1, y + 0.4, z0 + t, 2) : box(M.jade, x0 - t, y + 0.08, z0, x0 + t, y + 0.4, z1, 2));
  gilt.push(along ? box(M.gold, x0, y + 0.42, z0 - 0.05, x1, y + 0.46, z0 + 0.05, 2) : box(M.gold, x0 - 0.05, y + 0.42, z0, x0 + 0.05, y + 0.46, z1, 2));
  return [parts, gilt];
}
function crestTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#5a5a50'; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < 512; x += 64) { g.fillStyle = `rgba(${(x + y) % 3 ? '30,30,26' : '170,170,156'},0.18)`; g.fillRect(x + 1, y + 1, 62, 30); g.strokeStyle = 'rgba(20,20,18,0.6)'; g.strokeRect(x + 0.5, y + 0.5, 63, 31); }
  g.translate(256, 120); g.strokeStyle = '#e0b84a'; g.fillStyle = 'rgba(224,184,74,0.35)'; g.lineWidth = 7;   // the crest: a gilt sunburst over a band
  for (let k = 0; k < 12; k++) { g.save(); g.rotate(-Math.PI / 2 + (k - 5.5) * 0.18); g.beginPath(); g.moveTo(40, 0); g.lineTo(96, 0); g.stroke(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 36, Math.PI, 0); g.fill(); g.stroke(); g.fillRect(-120, 4, 240, 14); g.strokeRect(-120, 4, 240, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

async function build(E, FX) {
  const S = E.world.scene, M = mats({ lacquer: 0x9a1a10 });
  const brick = T.material(T.bricks(0xc89a30, 3, 'chongBrick'), { color: 0xfff0c8, roughness: 0.6 }, [1, 1]);
  const face = T.material(T.bricks(0x8a6a28, 4, 'chongFace'), { color: 0xe8d8b0 }, [0.5, 0.5]);
  S.add(LV.mesh(brick, face, BASE, 1));
  const red = T.material(T.carpet(0xb01410), {}), redStep = new THREE.MeshStandardMaterial({ color: 0xa01410, roughness: 0.8 }), gold = M.gold;
  for (const r of LV.ramps) S.add(stairs(r, redStep, T.material(T.bricks(0x8a6a28, 2, 'chongRiser'), {}, [1, 1]), 0.5));
  // the carpet: down the floor and over the dais, a gilt edge along it
  for (const [z0, z1, y] of [[9, 14.9, 0], [2.9, 6.5, DAIS]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9, z1 - z0).rotateX(-Math.PI / 2), red); m.position.set(8.5, y + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
    for (const x of [7.05, 9.95]) S.add(box(gold, x - 0.05, y, z0, x + 0.05, y + 0.025, z1));
  }
  // the balustrades: the terrace's front, the dais's front and sides
  const P = [], Gd = [];
  for (const [x0, z0, x1, z1, y] of [[4, 8.7, 7, 8.7, MID], [10, 8.7, 13, 8.7, MID], [5, 6.7, 7, 6.7, DAIS], [10, 6.7, 12, 6.7, DAIS], [5.3, 2.4, 5.3, 6.7, DAIS], [11.7, 2.4, 11.7, 6.7, DAIS]]) { const [p, g] = jadeRail(M, x0, z0, x1, z1, y); P.push(...p); Gd.push(...g); }
  S.add(shade(merged(M.jade, P)), shade(merged(gold, Gd)));
  // the back wall with its crest, the stone blocks at the corners, the throne
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshStandardMaterial({ map: crestTex(), roughness: 0.9 })); wall.position.set(8.5, DAIS + 1.7, 2.02); S.add(wall);
  const stone = T.material(T.rock(0xb8b4a0, 'chongStone', 0.4), {}, [0.5, 0.5]);
  for (const x of [4.5, 12.5]) S.add(shade(box(stone, x - 0.5, DAIS, 2, x + 0.5, DAIS + 0.9, 2.95, 1)));
  S.add(throne(M, 8.5, TZ, DAIS));
  for (const x of [6.3, 10.7]) {   // braziers either side of the dais
    S.add(shade(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.18, 0], [0.08, 0.1], [0.06, 0.6], [0.22, 0.72], [0.26, 0.82], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a, b)), 20), M.bronze)).translateX(x).translateY(DAIS).translateZ(5.6));
    FX.fire(E, { x, y: 5.6, z: DAIS + 0.85, size: 0.45, light: 6, col: 0xffa050, smoke: false });
  }
  // the hall runs on either side into the dark: more golden floor, red columns, the stone wall (the original frames it in
  // black; this view is wider)
  const side = T.material(T.bricks(0xa07a28, 3, 'chongSide'), { color: 0x6a5a40, roughness: 0.8 }, [1, 1]), wallM = T.material(T.rock(0x5a5a50, 'chongWall', 0.4), {}, [1, 1]);
  for (const [a, b] of [[-7, 4], [13, 24]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.4, 13), side); f.position.set((a + b) / 2, -0.2, 8.5); f.receiveShadow = true; S.add(f);
    S.add(shade(box(wallM, a, 0, 1.6, b, DAIS + 3.2, 2.0, 1)));
    for (const x of a < 0 ? [2.3] : [14.7]) for (const z of [4, 9, 14]) {
      const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.6, 20), M.lacquer)); c.position.set(x, 1.3, z); S.add(c);
      S.add(shade(box(stone, x - 0.32, 0, z - 0.32, x + 0.32, 0.18, z + 0.32, 0.5)));
    }
  }
  built = true;
}
export const chongHall = {
  build, ground: (x, z) => { if (!built) return 0; const R4 = 4, i = Math.floor(x * R4), j = Math.floor(z * R4), v = i >= 0 && j >= 0 && i < MW * R4 && j < MH * R4 ? LV.H[j * MW * R4 + i] : NaN; return isNaN(v) && !LV.ramps.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) ? BASE : LV.at(x, z); },
  // 崇侯虎 sits on the throne in both scenes (his seated sheet; a few pixels' start or shake about (8.5, 3.5)): up on its
  // step, his feet on it, in front of the cushion (he stood inside the chair, only his crown showing: the user's report)
  seat: (x, z) => built && Math.abs(x - 8.5) < 0.4 && z > TZ && z < TZ + 1.1 ? { y: DAIS + 0.27, z: Math.max(TZ + 0.47, z) } : null,
  particles: 'dust',
  mood: { bg: 0x000000, voidCol: 0x000000, voidY: BASE, fog: 0x050302, fogD: 0.03, sky: 0xffe0b0, under: 0x2a1a0a, hemi: 0.75,
    sun: 0xffd8b0, sunI: 1.7, sunDir: [-0.25, 0.9, 0.4], sat: 1.04, exposure: 1.1, bloom: 0.45,
    env: { top: 0x8a6a48, mid: 0x4a3420, low: 0x1a1008, lights: [[0, 6, -8, 0xfff0d0, 5], [-6, 4, 2, 0xffc080, 3], [6, 4, 2, 0xffc080, 3]] } },
  lights: [{ x: 8.5, y: 2.6, z: 8, col: 0xffb070, i: 4, d: 10 }],
};
