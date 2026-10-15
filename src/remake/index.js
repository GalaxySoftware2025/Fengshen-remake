// The remade scene maps, by the original map's descriptor address: each module builds its set in 3D (src/kit) on the
// original's layout and exports { build, ground, mood, particles, cell? } (see src/sets.js dress, src/world.js finishSet).
import court from './court.js';
import road from './road.js';
import study, { studyRed } from './study.js';
import temple from './temple.js';
import village from './village.js';
import valley from './valley.js';
import gorge from './gorge.js';
import world from './world.js';
import dungeon from './dungeon.js';
import canyon from './canyon.js';
import bridgehead from './bridgehead.js';
import mansion, { mansionWest } from './mansion.js';
import citygate from './citygate.js';
import grassland from './grassland.js';
export default { '0e8caa': valley, '0e8ce6': valley, '0e92ae': gorge, '00241c': court, '0024b8': court, '0eaed6': court, '0ec0fc': court, '002450': road, '002498': study, '0eac5a': studyRed, '0eb1a0': studyRed, '0ebb44': studyRed, '004fb4': temple, '004fd8': village, '0e8fec': village, '0e9e8e': village, 'world-95a9': world, '0e9b48': dungeon, '0e9b8c': dungeon, '0ea2a8': canyon, '0ea8ae': bridgehead, '0eb2e6': mansion, '0eb8e6': mansionWest, '0ebdd4': citygate, '0ec58e': grassland, '0ec5d6': grassland };
