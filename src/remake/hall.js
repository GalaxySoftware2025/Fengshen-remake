// 西岐's underground training hall, 地下練功所 (maps 0ef160 and 0ef178: scene 23; battle 11's ten rooms, the first and
// last of them those two maps), remade: floors of red-brown earth (rooms 0-4) or dark teal cobbles (rooms 5-9) with moss
// in the hollows, carved from black rock whose faces are blue crystal (0-4) or gold (5-9); low enclosures of olive
// stone blocks; white steps going down at each way on or back (terrain 4 and 3); in the last room a stone dais behind a
// wooden rail, three chests on it, up three steps (x 11-13). Built from each room's own grid (terrain 1: the rock;
// terrain 2 touching it: its face; any other terrain 2: the olive walls; the dais in room 9). Rock south of a floor
// stays low, so it hides no one behind it. Scene 23's native cut 0x0EED30: the middle chest opens on the 龍吟劍.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade, merged } from '../kit/parts.js';
import { readLayout, CL, grass } from '../kit/terrain.js';
import { D, G } from '../rules.js';

const TALL = 2.3, LOW = 0.45, OLIVE = 0.55, DAIS = 0.4;
const ART = k => k === 0 ? 'assets/battles/11/map.png' : 'assets/battles/11/room-' + k + '.png';
const SCENE_ROOM = { '0ef160': 0, '0ef178': 9 };
const SCENE_CHESTS = { 0: [[5, 5]], 9: [[11, 6], [13, 6]] };
const DAIS_ROOM = 9, DAIS_R = [9, 5, 16, 10], STEPS = [11, 9, 14, 10], SWORD = [12, 6];
let world = null, M = null, chestG = new Map(), LV = null, BLOCKS = [], cur = 0, sword = null;

// the sword in the middle chest: a long straight blade glowing pale blue, a gold guard and grip, standing upright
function swordModel(x, z, y) {
  const g = new THREE.Group(), blade = new THREE.MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x4a8adc, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.02), blade); b.position.y = 0.55; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), blade); tip.position.y = 0.98; tip.rotation.y = Math.PI / 4; g.add(tip);
  g.add(box(M.gold, -0.13, 0.13, -0.03, 0.13, 0.18, 0.03), box(new THREE.MeshStandardMaterial({ color: 0x3a2a6a, roughness: 0.6 }), -0.025, -0.05, -0.025, 0.025, 0.13, 0.025));
  const glow = new THREE.PointLight(0x8ac0ff, 1.6, 2.5, 1.6); glow.position.y = 0.6; g.add(glow);
  g.position.set(x, y, z); return shade(g);
}
function setFor(fixedKey) {
  const roomNow = () => fixedKey != null ? SCENE_ROOM[fixedKey] : (D.rooms ? G.room || 0 : 0);
  async function build(E, FX) {
    const S = E.world.scene; M = mats(); world = E.world; chestG = new Map(); sword = null;
    const k = roomNow(); cur = k;
    const MW = D.mapW, MH = D.mapH, stone = k >= 5;
    const tc = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 1 : D.terrain[y][x];
    const open = (x, y) => [0, 3, 4].includes(tc(x, y));
    const nearRock = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => tc(x + dx, y + dy) === 1);
    const inDais = (x, y) => k === DAIS_ROOM && x >= DAIS_R[0] && x < DAIS_R[2] && y >= DAIS_R[1] && y < DAIS_R[3];
    const chests = D.rooms && G.chests ? G.chests : D.n === 11 ? (D.chests || []).map(c => Object.assign({ open: false }, c)) : (SCENE_CHESTS[k] || []).map(([x, y]) => ({ x, y, open: false }));   // (a scene has no chest list: those the art draws)
    const chestCell = (x, y) => chests.some(c => c.x === x && c.y === y) || (k === DAIS_ROOM && x === SWORD[0] && y === SWORD[1]);
    const kind = (x, y) => { const t = tc(x, y); if (inDais(x, y)) return 'dais'; if (t === 1) return 'rock'; if (t === 2) return chestCell(x, y) ? 'floor' : nearRock(x, y) ? 'rock' : 'olive'; return 'floor'; };
    const lowRock = (x, y) => open(x, y - 1) || open(x, y - 2);   // rock south of a floor: low
    // the levels: floor, the dais, the exits' steps down; the rock and the olive walls as their own blocks
    LV = new Levels(MW, MH, 4); const RK = new Levels(MW, MH, 4), OL = new Levels(MW, MH, 4);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const kd = kind(x, y);
      if (kd === 'floor') LV.set(x, y, x + 1, y + 1, 0);
      else if (kd === 'dais') LV.set(x, y, x + 1, y + 1, DAIS);
      else if (kd === 'olive') { LV.set(x, y, x + 1, y + 1, 0); OL.set(x, y, x + 1, y + 1, OLIVE); }
      else RK.set(x, y, x + 1, y + 1, lowRock(x, y) ? LOW : TALL);
    }
    const exits = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tc(x, y) === 3 || tc(x, y) === 4) { LV.stairs(x, y, x + 1, y + 1, -0.6, 0, 4, 'n'); exits.push([x, y]); }
    if (k === DAIS_ROOM) LV.stairs(STEPS[0], STEPS[1], STEPS[2], STEPS[3], 0, DAIS, 3, 's');
    const floorT = stone ? T.material(T.rock(0x34504e, 'hallCobble', 0.08), { color: 0xc8e0dc }, [1.6, 1.6]) : T.material(T.dirt(0x6a3220, 'hallEarth'), { color: 0xf0c8b0 }, [1, 1]);
    const face = stone ? T.material(T.rock(0xb08a2c, 'goldWall', 0.12), { color: 0xfff0c0, roughness: 0.6, emissive: new THREE.Color(0.08, 0.05, 0.0) }, [1.2, 1.2])
      : T.material(T.rock(0x2e2e8a, 'crystalWall', 0.12), { color: 0xc8c8ff, roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0.02, 0.02, 0.08) }, [1.2, 1.2]);
    const top = face.clone(); top.color = new THREE.Color(stone ? 0x4a3a20 : 0x262640); top.emissive = new THREE.Color(0, 0, 0);   // the rock's top: its own stone, in shadow
    const oliveM = T.material(T.bricks(0x6a6a30, 2, 'oliveBlocks'), { color: 0xe8e8c0 }, [1, 1]);
    S.add(LV.mesh(floorT, floorT, -1.2, 0.5), RK.mesh(top, face, -1.2, 0.5), OL.mesh(oliveM, oliveM, -1.2, 0.5)); BLOCKS = [RK, OL];
    // the exits: white steps down into a dark opening in the rock beyond
    const white = T.material(T.bricks(0xe8e4d8, 2, 'whiteSteps'), {}, [1, 1]);
    for (const [x, y] of exits) {
      const parts = []; for (let i = 0; i < 4; i++) { const h = -0.6 + 0.15 * (i + 1); parts.push(box(white, x + 0.08, h - 0.15, y + i * 0.25, x + 0.92, h, y + i * 0.25 + 0.25)); }
      S.add(shade(merged(white, parts)));
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), new THREE.MeshBasicMaterial({ color: 0x010101 })); hole.position.set(x + 0.5, -0.2, y + 0.02); S.add(hole);
    }
    // the dais: grey stone tiles, a wooden rail round it but for the steps
    if (k === DAIS_ROOM) {
      const tiles = T.material(T.bricks(0xa8a8a0, 3, 'daisTiles'), {}, [1, 1]), wood = T.material(T.wood(0x8a4a1c, 'daisRail'), { color: 0xffc890 }, [1, 1]);
      const [x0, z0, x1, z1] = DAIS_R, tp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.1, z1 - z0 - 0.1).rotateX(-Math.PI / 2), tiles); tp.position.set((x0 + x1) / 2, DAIS + 0.005, (z0 + z1) / 2); tp.receiveShadow = true; S.add(tp);
      const rail = [], posts = [];
      const run = (a, b, c, d) => { rail.push(box(wood, a, DAIS + 0.32, b, c, DAIS + 0.38, d), box(wood, a, DAIS + 0.12, b, c, DAIS + 0.16, d)); };
      run(x0 + 0.05, z0 + 0.05, x1 - 0.05, z0 + 0.13); run(x0 + 0.05, z0 + 0.05, x0 + 0.13, z1 - 0.05); run(x1 - 0.13, z0 + 0.05, x1 - 0.05, z1 - 0.05);
      run(x0 + 0.05, z1 - 0.13, STEPS[0], z1 - 0.05); run(STEPS[2], z1 - 0.13, x1 - 0.05, z1 - 0.05);
      for (let x = x0 + 0.09; x <= x1 - 0.08; x += 0.5) posts.push(box(wood, x - 0.04, DAIS, z0 + 0.05, x + 0.04, DAIS + 0.44, z0 + 0.13));
      for (let z = z0 + 0.5; z <= z1 - 0.08; z += 0.5) for (const x of [x0 + 0.09, x1 - 0.09]) posts.push(box(wood, x - 0.04, DAIS, z - 0.04, x + 0.04, DAIS + 0.44, z + 0.04));
      S.add(shade(merged(wood, rail)), shade(merged(wood, posts)));
      const st = []; for (let i = 0; i < 3; i++) { const h = DAIS * (i + 1) / 3; st.push(box(wood, STEPS[0] + 0.05, h - 0.06, STEPS[3] - (i + 1) / 3, STEPS[2] - 0.05, h, STEPS[3] - i / 3)); }
      S.add(shade(merged(wood, st)));
    }
    // the chests (as left), and in the last room the middle one the hook never lists: the 龍吟劍's
    const yAt = (x, z) => LV.at(x, z);
    for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, yAt(c.x + 0.5, c.y + 0.5), !!c.open, 0, 1.3); S.add(g); chestG.set(c.x + ',' + c.y, g); }
    if (k === DAIS_ROOM) { const [sx, sz] = SWORD, g = chest(M, sx + 0.5, sz + 0.5, DAIS, false, 0, 1.3); S.add(g); chestG.set(sx + ',' + sz, g); }
    // moss in the floor's hollows, where the art has it
    const lay = await readLayout(fixedKey ? 'assets/maps/' + fixedKey + '.png' : ART(k), MW, MH, { [CL.grass]: [0x004800, 0x489000] });
    const W = MW * 4, pts = [];
    for (let j = 0; j < MH * 4; j++) for (let i = 0; i < W; i++) {
      if (lay[j * W + i] !== CL.grass) continue; const x = (i + Math.random()) / 4, z = (j + Math.random()) / 4;
      if (kind(Math.floor(x), Math.floor(z)) === 'floor' && open(Math.floor(x), Math.floor(z))) for (let n = 0; n < 2; n++) pts.push([x + (Math.random() - 0.5) * 0.2, yAt(x, z), z + (Math.random() - 0.5) * 0.2]);
    }
    S.add(grass(pts, { size: 0.32, cols: ['#1e4a1a', '#2a5a20', '#14381a', '#3a6a24'] }));
    void FX;
  }
  function ground(x, z) {   // the floor, or the top of the rock or wall standing there
    if (!LV) return 0;
    for (const L of BLOCKS) { const i = Math.floor(x * L.R), j = Math.floor(z * L.R); if (i >= 0 && j >= 0 && i < L.w * L.R && j < L.h * L.R && !isNaN(L.H[j * L.w * L.R + i])) return L.H[j * L.w * L.R + i]; }
    return LV.at(x, z);
  }
  function openChest(x, y) {
    const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S || !LV) return;
    const p = g ? g.position : new THREE.Vector3(x + 0.5, LV.at(x + 0.5, y + 0.5), y + 0.5); if (g) S.remove(g);
    const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
  }
  // scene 23 (native cut 0x0EED30): 姬發 before the middle chest; after the light it opens, the 龍吟劍 standing in it
  function native(E, ev, clock) {
    if (ev.name !== 'sword') return;
    const tick = () => {
      if (!world || world !== E.world) return;
      if (clock() >= ev.open && !sword) { openChest(SWORD[0], SWORD[1]); sword = swordModel(SWORD[0] + 0.5, SWORD[1] + 0.5, DAIS + 0.15); world.scene.add(sword); }
      if (sword) { const t = clock(); sword.visible = t < ev.found || t >= ev.end || Math.floor(t) % 2 === 1; }
      if (clock() < ev.end + 2) requestAnimationFrame(tick);
    };
    tick();
  }
  return {
    build, openChest, native, ground, particles: 'dust',
    get slopes() { const out = []; if (!LV) return out; for (const r of LV.ramps) for (let y = r.z0; y < r.z1; y++) for (let x = r.x0; x < r.x1; x++) out.push([x, y]); return out; },
    get props() { return cur === DAIS_ROOM ? [SWORD] : []; },
    mood: { bg: 0x020202, voidCol: 0x020202, voidY: -1.2, fog: 0x060504, fogD: 0.02, sky: 0xffe8c8, under: 0x2a1a10, hemi: 1.0,
      sun: 0xfff0d8, sunI: 2.4, sunDir: [-0.3, 0.9, 0.4], sat: 1.05, exposure: 1.15, bloom: 0.35, aoR: 0.8,
      env: { top: 0x8a7a68, mid: 0x4a3a2a, low: 0x1a1008, lights: [[0, 7, 3, 0xfff0d8, 4]] } },
  };
}
export const hallEntry = setFor('0ef160');
export const hallSword = setFor('0ef178');
export default setFor(null);   // battle 11: the room the party is in
