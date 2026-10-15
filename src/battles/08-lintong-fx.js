// 臨潼關草原 (battle 8): presentation. The battle plays on the remade grassland (src/remake/grassland.js, map 0ec5d6),
// the set of scene 15 around it; 雷開's men come in one by one in round 3, the camera on each, then his words.
import grassland from '../remake/grassland.js';
import { WAVE_SPRITES } from './08-lintong.js';

export default {
  look: { set: grassland },
  sprites: WAVE_SPRITES,
};
