// A battle in rooms played on more than one set (battle 12: the mountain, then the shrine): each room's set by the room
// the party is in (src/battle.js enterRoom builds the look again on entering one). sets[k]: room k's; the last serves
// any room past the list.
import { G } from '../rules.js';
export function byRoom(sets) {
  const now = () => sets[Math.min(sets.length - 1, G.room || 0)];
  return {
    build: (E, FX) => now().build(E, FX),
    openChest: (x, y) => now().openChest && now().openChest(x, y),
    ground: (x, z) => now().ground(x, z),
    get mood() { return now().mood; }, get particles() { return now().particles; },
    get props() { return now().props || []; }, get slopes() { return now().slopes || []; },
  };
}
