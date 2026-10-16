// 海龍洞 (battle 10): presentation. The battle plays on the remade cave (src/remake/cave.js), built again for each
// room the party enters (src/battle.js enterRoom): the first room is scene 19's entrance, the last its hall.
import cave from '../remake/cave.js';

export default {
  look: { set: cave },
};
