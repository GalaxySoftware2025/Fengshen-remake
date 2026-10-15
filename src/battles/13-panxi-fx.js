// 磻溪 (battle 13): presentation and 3D dressing. The rules are in 13-panxi.js; E is the battle engine (src/battle.js).
import * as THREE from 'three';
import { G, D } from '../rules.js';
import { canvasTex, loadImg, groundH } from '../world.js';
import { jiang } from './13-panxi.js';
import { sayList } from '../says.js';

const HUT = { x0: 25.3, x1: 29.7, z0: 3.9, z1: 6.55 };
// [ROM say-list 0xF1766, played by the hook when the battle is won]; the rest is the scene's own outro
const RESCUE = () => sayList(0xF1766).map(l => [l.who, l.text]);

// 3D thatched hut, its surfaces taken from the hut drawn on the original map
async function hut(world) {
  const img = await loadImg('assets/map_hd.png');
  const crop = (x, y, w, h) => canvasTex(w, h, g => { g.imageSmoothingEnabled = false; g.drawImage(img, x * 4, y * 4, w * 4, h * 4, 0, 0, w, h); });
  const roofTex = crop(800, 96, 160, 64), wallTex = crop(806, 160, 148, 58);
  const g = new THREE.Group(), W = HUT.x1 - HUT.x0, Dp = HUT.z1 - HUT.z0, Hw = 1.25;
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.95 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, Hw, Dp), [sideMat, sideMat, sideMat, sideMat, wallMat, sideMat]);
  walls.position.set((HUT.x0 + HUT.x1) / 2, groundH(27.5, 5.2) + Hw / 2, (HUT.z0 + HUT.z1) / 2); walls.castShadow = walls.receiveShadow = true; g.add(walls);
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1, side: THREE.DoubleSide });
  const over = 0.45, ridgeH = 1.25, half = Dp / 2 + over;
  // two thatch slopes from the ridge down past the eaves (explicit quads so the thatch texture runs eave to ridge)
  const cx = walls.position.x, cz = walls.position.z, top = walls.position.y + Hw / 2, x0 = cx - W / 2 - over, x1 = cx + W / 2 + over;
  for (const sgn of [-1, 1]) {
    const geo = new THREE.BufferGeometry(), ez = cz + sgn * half, ey = top - 0.18;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([x0, top + ridgeH, cz, x1, top + ridgeH, cz, x0, ey, ez, x1, ey, ez], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(sgn > 0 ? [0, 1, 1, 1, 0, 0, 1, 0] : [0, 0, 1, 0, 0, 1, 1, 1], 2));
    geo.setIndex(sgn > 0 ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]); geo.computeVertexNormals();
    const plane = new THREE.Mesh(geo, roofMat); plane.castShadow = plane.receiveShadow = true; g.add(plane);
  }
  // gable ends
  const tri = new THREE.Shape(); tri.moveTo(-half, 0); tri.lineTo(half, 0); tri.lineTo(0, ridgeH); tri.closePath();
  for (const sgn of [-1, 1]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), sideMat); m.rotation.y = Math.PI / 2; m.position.set(walls.position.x + sgn * W / 2, walls.position.y + Hw / 2, walls.position.z); g.add(m); }
  // a few props by the door
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.36, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.8 }));
  barrel.position.set(26.1, groundH(26.1, 6.9) + 0.18, 6.9); barrel.castShadow = true; g.add(barrel);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xa8864a, roughness: 0.9 }));
  basket.position.set(26.6, groundH(26.6, 7.0) + 0.08, 7.05); basket.castShadow = true; g.add(basket);
  world.scene.add(g);
}
function stake(world) {
  const x = 22.5, z = 6.38, y = groundH(x, z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }));
  post.position.set(x, y + 0.62, z - 0.12); post.castShadow = true; world.scene.add(post);
}

// the fire takes a column: a camera shot on the front, flames, the bamboo chars down, anyone there is lost
async function fireAdvance(E, col, victims, opening) {
  const { vfx, world, cam, ui, tileCenter, V, wait, anim, killAnim } = E;
  const front = tileCenter(col, 7);
  if (!opening) { cam.shot(front, { dist: 12, pitch: 0.42, yaw: -0.7 }); await wait(700); }
  vfx.fire.burn(col, E.gameT); world.setFire(Math.min(...G.burnt), G.burnt.size);
  for (let z = 0; z < 14; z++) if (!opening && Math.random() < 0.5) vfx.burst(tileCenter(col, z).add(V(0, 0.4, 0)), { n: 8, speed: 3, cols: [[1, 0.8, 0.3], [1, 0.4, 0.1]], size: 0.05, life: 0.8, g: 2, up: 0.8 });
  if (!opening) { vfx.shake(0.05, 0.5); vfx.light(front.clone().setY(1.5), [1, 0.5, 0.15], 80, 0.8, 14); }
  await anim(opening ? 0.01 : 1.1, k => world.burnBamboo(col, k));
  for (const u of victims) { await killAnim(u); await ui.toast(u.name + ' 被大火吞沒了', 900); }
  if (!opening) { await wait(300); cam.release(); }
}

export default {
  sprites: ['jiang'],
  look: { mapHD: 'assets/map_hd.png', mapSD: 'assets/map.png', hdCell: 128, forest: 2,
    clear: (cx, cy) => cx >= 25 && cx <= 29 && cy >= 3 && cy <= 6,              // the hut
    dress: async world => { await hut(world); stake(world); } },
  lore: '紂王遣妖獸焚林，大火自東而來。姜子牙被縛於磻溪草廬之前，林雲一行必須在烈焰吞沒之前趕到。',
  winText: '任一我方角色抵達姜子牙身旁', loseText: '姜子牙葬身火海 · 林雲陣亡',
  // the forest east of the board is already ablaze
  stage(E) {
    E.vfx.fire.cols.clear();
    for (let c = 31; c < 31 + 9; c++) E.vfx.fire.burn(c, 0);
    E.world.setFire(31, 1); for (let c = 31; c < 40; c++) E.world.burnBamboo(c, 1);
  },
  roundStart: (E, ev) => fireAdvance(E, ev.col, ev.victims),
  async trigger(E) { E.cam.shot(E.tileCenter(15, 7), { dist: 13, pitch: 0.5, yaw: 0.4 }); await E.ui.toast('伏兵現身！', 1200); E.cam.release(); },
  async intro(E) {
    const { cam, ui, tileCenter, wait } = E;
    cam.shot(tileCenter(31, 7), { dist: 11, pitch: 0.3, yaw: -1.1, speed: 1.6 }); await wait(1600);
    cam.shot(tileCenter(22, 6), { dist: 7, pitch: 0.28, yaw: -0.3, speed: 1.4 }); await ui.toast('姜子牙被縛於磻溪草廬', 1600);
    cam.shot(tileCenter(3, 3), { dist: 10, pitch: 0.45, yaw: 0.4, speed: 1.4 }); await wait(1200);
    cam.release(tileCenter(3, 3));
    await ui.banner('磻溪之戰', '', 1700);
  },
  // won: 姜子牙 is freed from the stake in a pillar of light, then the rescue lines and the scene's outro
  async victory(E) {
    const { cam, ui, vfx, world, actors, actorOf, syncActors, placeActor } = E;
    const j = jiang(), ja = actorOf(j);
    cam.shot(ja.pos, { dist: 6.5, pitch: 0.3, yaw: 0.5, speed: 1.2 });
    await ui.banner('戰役勝利', '姜子牙獲救', 1600);
    j.sprite = 'jiang'; ja.dispose(world.scene); actors.delete(j); syncActors(); placeActor(actorOf(j));
    vfx.pillar(actorOf(j).pos, [1, 0.9, 0.6], 0.6, 5, 2.2, { intensity: 1.2, grow: 1 }); vfx.burst(actorOf(j).chest(), { n: 50, speed: 2, col: [1, 0.9, 0.6], size: 0.05, life: 1.2, g: 0.5 });
    for (const [who, line] of [...RESCUE(), ...(E.opts.campaign ? [] : D.outro.map(l => [l.who, l.text]))]) await ui.say(line, who);   // the campaign plays the outro as a scene
  },
  end: { title: '西海火巖窟', sub: '—— 待續 ——' },
};
