// 費仲官邸二 (battle 6): presentation. The battle plays on the remade mansion's west wing (src/remake/mansion.js, map
// 0eb8e6), the set of scene 11 before it. 文王 walks with the heroes (his sprite preloaded); before the first turn the
// camera goes to the 大力士 in the hall for the guard's challenge and back to 楊戩 for his answer (the rules' LINES).
import { mansionWest } from '../remake/mansion.js';
import { WEN } from './06-feizhong2.js';

export default {
  look: { set: mansionWest },
  sprites: [WEN.sprite],
};
