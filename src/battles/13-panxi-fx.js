// 磻溪 (battle 13): presentation, on scene 26's set (the bamboo road and the hut, src/remake/bambooroad.js: its fire too). The rules are in 13-panxi.js; E is the battle engine (src/battle.js).
import { G, D } from '../rules.js';
import bambooRoad, { burnCol, ablaze } from '../remake/bambooroad.js';
import { jiang } from './13-panxi.js';
import { sayList } from '../says.js';

// [ROM say-list 0xF1766, played by the hook when the battle is won]; the rest is the scene's own outro
const RESCUE = () => sayList(0xF1766).map(l => [l.who, l.text]);

// the fire takes a column: a camera shot on the front, flames, the bamboo chars down, anyone there is lost
async function fireAdvance(E, col, victims, opening) {
  const { vfx, cam, ui, tileCenter, V, wait, anim, killAnim } = E;
  const front = tileCenter(col, 7);
  if (!opening) { cam.shot(front, { dist: 12, pitch: 0.42, yaw: -0.7 }); await wait(700); }
  burnCol(E, col, 0);
  for (let z = 0; z < 14; z++) if (!opening && Math.random() < 0.5) vfx.burst(tileCenter(col, z).add(V(0, 0.4, 0)), { n: 8, speed: 3, cols: [[1, 0.8, 0.3], [1, 0.4, 0.1]], size: 0.05, life: 0.8, g: 2, up: 0.8 });
  if (!opening) { vfx.shake(0.05, 0.5); vfx.light(front.clone().setY(1.5), [1, 0.5, 0.15], 80, 0.8, 14); }
  await anim(opening ? 0.01 : 1.1, k => burnCol(E, col, k));
  for (const u of victims) { await killAnim(u); await ui.toast(u.name + ' 被大火吞沒了', 900); }
  if (!opening) { await wait(300); cam.release(); }
}

export default {
  sprites: ['jiang'],
  look: { set: bambooRoad },
  lore: '紂王遣妖獸焚林，大火自東而來。姜子牙被縛於磻溪草廬之前，林雲一行必須在烈焰吞沒之前趕到。',
  winText: '任一我方角色抵達姜子牙身旁', loseText: '姜子牙葬身火海 · 林雲陣亡',
  // the forest east of the board is already ablaze
  stage(E) { ablaze(E, 31); },
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
    for (const [who, line] of [...RESCUE(), ...(E.opts.campaign ? [] : D.outro.map(l => [l.who, l.text]))]) await E.speak(line, who);   // the campaign plays the outro as a scene
  },
  end: { title: '西海火巖窟', sub: '—— 待續 ——' },
};
