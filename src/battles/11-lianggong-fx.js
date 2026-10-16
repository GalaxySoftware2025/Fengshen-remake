// 地下練功所 (battle 11): presentation. The battle plays on the remade training hall (src/remake/hall.js), built again
// for each room the party enters; the first room is scene 23's, the last (the three chests on their dais) its second
// map. Won, 姬發's last words before the banner [0x0EF142: the hook plays them as the last enemy falls].
import hall from '../remake/hall.js';
import { players } from '../rules.js';
import { spriteKey } from '../sprites.js';
import { END } from './11-lianggong.js';

export default {
  look: { set: hall },
  sprites: [spriteKey(0x0b62ba)],   // the 鬼靈 the 召喚師 call up
  async victory(E) {
    const { cam, ui, actorOf, wait } = E;
    await wait(400);
    for (const l of END) { const u = players().find(v => v.name === l.who); if (u) cam.focus(actorOf(u).pos); await ui.say(l.text, l.who); }
    await ui.banner('戰役勝利', '', 1600);
  },
};
