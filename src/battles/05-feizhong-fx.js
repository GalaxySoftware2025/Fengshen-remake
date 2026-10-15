// 費仲官邸一 (battle 5): presentation. The battle plays on the remade mansion (src/remake/mansion.js), the set of
// scene 10 before it. Won, the hook's last beat [0x0EB630]: the screen goes dark, the heroes stand before 文王's room
// in the north hall ((5, 4), (4, 4), (6, 4)), 文王 comes to his door (5, 3) and asks what the noise is; 楊戩 and 林雲
// answer (the rules' AFTER / OUTRO), then the banner.
import mansion from '../remake/mansion.js';
import { G } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { darken, clearFade } from '../scene.js';
import { AFTER, OUTRO } from './05-feizhong.js';

export default {
  look: { set: mansion },
  sprites: [spriteKey(AFTER.wen.gfx)],
  async victory(E) {
    const { cam, ui, actorOf, syncActors, placeActor, tileCenter, wait } = E;
    await wait(500); await darken();
    const heroes = G.units.filter(u => u.side === 'player' && u.alive);
    heroes.forEach((u, i) => { const [x, y] = AFTER.heroes[i] || AFTER.heroes[0]; u.x = x; u.y = y; u.facing = 'up'; });
    const wen = { side: 'npc', name: '文王', sprite: spriteKey(AFTER.wen.gfx), x: AFTER.wen.x, y: AFTER.wen.y, facing: 'down', alive: true,
      status: { sleep: 0, seal: 0, poison: 0 }, buf: {}, hp: 1, mhp: 1, mp: 0, mmp: 0, done: true };
    G.units.push(wen); syncActors();
    for (const u of [...heroes, wen]) { const a = actorOf(u); if (a) placeActor(a); }
    cam.shot(tileCenter(AFTER.wen.x, AFTER.wen.y + 1), { dist: 9, pitch: 0.5, yaw: 0, speed: 100 }); cam.snap();
    await clearFade(); await wait(400);
    for (const l of OUTRO) await ui.say(l.text, l.who);
    await ui.banner('戰役勝利', '', 1600);
  },
};
