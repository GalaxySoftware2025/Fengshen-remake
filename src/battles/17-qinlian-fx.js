// 沁蓮園 (battle 17): presentation. Each of the eight rooms plays on the lotus garden (src/remake/lotus.js) built from its
// own art: room 2 is the battle's own map (0f3b58, scene 35), room 0 the treasure hall (0f3b98, scene 35's outro).
import { lotus } from '../remake/lotus.js';
import { byRoom } from '../remake/rooms.js';

const art = k => k === 2 ? 'assets/battles/17/map.png' : 'assets/battles/17/room-' + k + '.png';
export default { look: { set: byRoom([0, 1, 2, 3, 4, 5, 6, 7].map(k => lotus(art(k)))) } };
