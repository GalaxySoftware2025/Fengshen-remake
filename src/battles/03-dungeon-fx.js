// 龍安城地牢 (battle 3): presentation. The battle plays on the remade gaol (src/remake/dungeon.js), the set of scene 3
// around it; the cells' gates stand open, as the battle's map has them (燕蓉 has broken 林雲's lock, the guards opened
// the other). The leader's order comes from the rules' turn hook (03-dungeon.js).
import dungeon from '../remake/dungeon.js';

export default {
  look: { set: dungeon },
  stage() { dungeon.open(2); dungeon.open(5); },
};
