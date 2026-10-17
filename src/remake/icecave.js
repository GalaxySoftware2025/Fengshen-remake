// The 麒麟獸's cave at the top of 麒麟山 (map 0f2db4: scene 30; battle 15's second room), remade: a causeway of grey-green
// cobbles (x 8-14, rows 4-13, narrowing to the gate at x 10-12, row 2) across a black void, four islands of the same
// stone each holding a chest (x 2-4 and 18-20, rows 5-7 and 10-12), their fronts faced in blue glazed brick; along the
// north a wall of the blue brick on columns of pale green stone, and in its middle the gate's tower (x 9-14), where the
// 麒麟獸 waits. Measured on tools/qa/grid.py 0f2db4 and its grid. Cold, dim light from above.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, chest, shade } from '../kit/parts.js';
import { D, G } from '../rules.js';

const BASE = -3.2;
const FLOORS = [[8, 4, 15, 14], [9, 3, 14, 4], [10, 2, 13, 3], [2, 5, 5, 8], [18, 5, 21, 8], [2, 10, 5, 13], [18, 10, 21, 13]];
const WALLS = [[0, 0, 8.4, 2.1, 1.3], [14.6, 0, 24, 2.1, 1.3], [9, 0, 10, 2.05, 2.0], [13, 0, 14, 2.05, 2.0], [10, 0, 13, 1.0, 2.4]];   // x0, z0, x1, z1, height
const COLUMNS = [0.5, 3.5, 6.5, 17.5, 20.5, 23.5];
const ART_CHESTS = [[3, 6], [19, 6], [3, 11], [19, 11]];
let world = null, M = null, LV = null, chestG = new Map();

async function build(E, FX) {
  const S = E.world.scene; M = mats(); world = E.world; chestG = new Map();
  const MW = D.mapW, MH = D.mapH;
  LV = new Levels(MW, MH, 4); const WL = [];
  for (const [x0, z0, x1, z1] of FLOORS) LV.set(x0, z0, x1, z1, 0);
  const cobble = T.material(T.rock(0x5a7a78, 'iceCobble', 0.9), { color: 0xd8ecec, roughness: 0.8 }, [1, 1]);
  const glaze = T.material(T.bricks(0x1e5aa0, 4, 'blueGlaze'), { color: 0xc8dcff, roughness: 0.35, metalness: 0.15 }, [1, 1]);
  S.add(LV.mesh(cobble, glaze, BASE, 0.5));
  for (const [x0, z0, x1, z1, h] of WALLS) WL.push(box(glaze, x0, -0.6, z0, x1, h, z1));
  const capM = new THREE.MeshStandardMaterial({ color: 0x0e2a50, roughness: 0.6 });
  for (const [x0, z0, x1, z1, h] of WALLS) WL.push(box(capM, x0 - 0.03, h, z0, x1 + 0.03, h + 0.08, z1 + 0.03));
  for (const m of WL) S.add(shade(m));
  // the columns of pale green stone along the wall's foot, rising from the void
  const jade = T.material(T.marble(0xa8c8c0, 0x6a8a84, 2), { color: 0xe8fff8, roughness: 0.4 }, [0.5, 1]);
  for (const x of COLUMNS) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.3 - BASE, 14), jade); c.position.set(x, (1.3 + BASE) / 2, 2.3); S.add(shade(c)); }
  // the gate in the tower: a dark opening
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x020408 })); hole.position.set(11.5, 0.75, 1.02); S.add(hole);
  const chests = D.rooms && G.chests ? G.chests : ART_CHESTS.map(([x, y]) => ({ x, y, open: false }));
  for (const c of chests) if (!c.hidden || c.open) { const g = chest(M, c.x + 0.5, c.y + 0.5, 0, !!c.open, 0, 1.3); S.add(g); chestG.set(c.x + ',' + c.y, g); }
  // a cold light over the causeway, a faint blue glow from below
  const L = new THREE.PointLight(0xa8d0ff, 3, 14, 1.4); L.position.set(11.5, 4, 8); S.add(L);
  void FX;
}
function openChest(x, y) {
  const g = chestG.get(x + ',' + y), S = world && world.scene; if (!S) return;
  const p = g ? g.position : new THREE.Vector3(x + 0.5, 0, y + 0.5); if (g) S.remove(g);
  const o = chest(M, p.x, p.z, p.y, true, 0, 1.3); S.add(o); chestG.set(x + ',' + y, o);
}
export default {
  build, openChest, ground: (x, z) => LV ? LV.at(x, z) : 0,
  mood: { bg: 0x010204, voidCol: 0x010204, voidY: BASE, fog: 0x02050a, fogD: 0.02, sky: 0xc8e0ff, under: 0x0a1a2a, hemi: 0.95,
    sun: 0xd8ecff, sunI: 2.2, sunDir: [-0.3, 0.9, 0.4], sat: 1.0, exposure: 1.1, bloom: 0.4, aoR: 0.8,
    env: { top: 0x6a8aa8, mid: 0x2a3a50, low: 0x080c14, lights: [[0, 7, 3, 0xd8ecff, 3]] } },
};
