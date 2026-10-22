// The 演武場 (#arena): its own record and look, on no battle of the original. The board is the remade set's
// (src/remake/arena.js: an 11 x 8 terrace, two braziers); the heroes are the whole roster at the level of the foes; the
// foes the toolbar and the waves bring in are three kinds of the game's enemies (妖獸, 鬼靈, 鐵弓手), their records read
// from the game data of the battle they first fight in together (FOES_FROM). No rules hooks, no win or loss
// (src/testkit.js plays it).
import arenaSet, { W, H, BRAZIERS } from '../remake/arena.js';

export const FOES_FROM = 13;   // 磻溪: its demons, archers and ghosts
export const look = { set: arenaSet };
// the arena's battle record, from the data of FOES_FROM (only its enemies are used)
export function record(src) {
  const terrain = Array.from({ length: H }, () => Array(W).fill(0));
  for (const [x, y] of BRAZIERS) terrain[y][x] = 2;   // blocked to walkers (a flier may cross)
  return { n: 'arena', name: '演武場', win: [], lose: [], mapW: W, mapH: H, terrain, deploy: [[1, 3]], music: null,
    party: { deployMax: 12, forced: [0], unavailable: [] }, enemies: src.enemies, chests: [], intro: [], outro: [] };
}
// each enemy's attack type (data/actions.js holds them by battle: the record's are FOES_FROM's)
export const attackTypes = D => { const AT = ((globalThis.ACTIONS || {}).battles || {})[FOES_FROM] || []; D.enemies.forEach((e, i) => { e.atkType = AT[i]; }); };
