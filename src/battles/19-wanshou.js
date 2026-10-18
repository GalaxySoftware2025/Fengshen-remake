// 萬獸山 (battle 19): the rules unique to it, from its ROM hooks (header 0x0F554E: turn hook 0x0F5522, lose 0x0F54B2, win
// 0x0F54F8; research/battles/19-hooks.txt). Pure rules, shared with the headless sim; the presentation is 19-wanshou-fx.js.
// 林雲, 楊戩, 姜子牙 and 黃天化 (forced; 黃飛虎 and 姬發 away, up to six) climb the mountain of beasts to tame the 四不像,
// held by 金銅人, 鐵弓手, 異鳥 and 幻士 (phantoms never on the map, AI 0x83: src/rules.js phantom).
//   every turn  in a round that is a multiple of four (ff32c4 % 4), the fallen of move type 7 come back at their posts
//               (0x1DAFC(7))                                                                             [0x0F5522]
// Win [0x0F54F8]: the 四不像 (class 45) gone. Lose [0x0F54B2]: 楊戩 (class 2) or 黃天化 (class 8) gone.
import { G, players, revive } from '../rules.js';

export const BEAST = 45;

export default {
  n: 19,
  setup(G) { G.beats = 0; G.joined = []; },
  beforeTurn(G) {
    if (G.round % 4 === 0) { const back = revive(7); if (back.length) G.joined.push(...back); }
    return null;
  },
  victory(G) { return G.units.some(u => u.cid === BEAST && u.side === 'enemy') && !G.units.some(u => u.cid === BEAST && u.side === 'enemy' && u.alive); },
  defeat(G) {
    for (const [cid, why] of [[8, '黃天化亡'], [2, '楊戩亡']]) { const h = G.units.find(u => u.side === 'player' && u.cid === cid); if (h && !h.alive) return why; }
    return players().length ? null : '我方全滅';
  },
};
