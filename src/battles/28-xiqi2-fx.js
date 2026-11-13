// 西岐大殿 (battle 28): presentation. The battle plays in 西岐's throne hall (src/remake/xiqi.js) as scene 58 shows it
// under 呂岳's plague (xiqiPlague: the same hall in a sick light); won, the rout (28-xiqi2.js), then the scene's lines.
import { xiqiPlague } from '../remake/xiqi.js';

export default {
  look: { set: xiqiPlague },
  moveFill: 'dark',   // the move squares dark throughout (battle.js measureLight): the red carpet's shade turned its column white among the dark ones, two colours [the user's call]
};
