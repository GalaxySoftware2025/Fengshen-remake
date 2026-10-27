// The enemies' turn as the ROM plays it (the AI dispatch at 0x1ECEA and what it calls), for src/rules.js planAction.
// Everything here reads the board the way the original does:
//   the reach list [0xB3B6]   a depth-first walk from the unit, four passes in four neighbour orders, each cell listed the
//                             first time it is reached (never moved for a cheaper way): its order is what casters and
//                             archers try first
//   the overlay [0x200D6]     a byte a cell: every unit its slot + 1, every reach cell + 0x28 (so 0x28 a free cell in
//                             reach, 0x29 + slot a unit in reach, 1-10 a hero out of reach)
//   the path search [0xBFE0]  a greedy depth-first search towards the goal (not the shortest way), run from both ends,
//                             the reverse kept on a tie; mode 1 the whole map by passable terrain, else the reach cells;
//                             the limit counts steps
// AI 0-6 rank the heroes (by distance, defence, attack or HP: the table at 0x1ED0E) and then share one turn [0x1ED66]:
// strike a hero it can reach this turn, else walk towards one without striking, else the fallback. The casters (0x80,
// 0x84, 0x85 [0x1BE90]) aim where the spell takes the most heroes, the healer (0x81) the weakest of its own at half HP or
// under; AI 9 walks to a cell, AI 10 guards a zone. Each returns a plan: { kind, path, facing, target | sp + at | cells }.
import { G, D, key, inMap, cost, aiP, setAiP, rand128, statOf } from './rules.js';

const FACE = ['down', 'up', 'left', 'right'];
const isHero = v => v.slot != null ? v.slot < 10 : v.side === 'player';   // the heroes' slots 0-9 (guests too)
const slotOf = v => v.slot != null ? v.slot : isHero(v) ? 0 : 10;
const live = v => v.alive && !v.away && inMap(v.x, v.y);
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const costAt = (mt, x, y) => D.costs[mt][G.terrain[y][x]];

// ---------------------------------------------------------------- the board
// the reach list [0xB3B6, 0xB5EE, 0xB6C2, 0xB8C0]: the passes in the neighbour orders of table 0x38C78 (variants 0, 2, 4,
// 6); a cell is entered while it has been visited fewer than four times, and every count goes back to 1 between passes
const PASSES = [[[0, -1], [-1, 0], [1, 0], [0, 1]], [[0, 1], [1, 0], [-1, 0], [0, -1]], [[-1, 0], [0, 1], [0, -1], [1, 0]], [[1, 0], [0, -1], [0, 1], [-1, 0]]];
export function reachList(u) {
  const side = isHero(u), block = new Set(G.units.filter(v => live(v) && isHero(v) !== side).map(v => key(v.x, v.y)));
  const out = [], visits = new Map();
  const c = (x, y) => x === u.x && y === u.y ? 0 : block.has(key(x, y)) ? 0x7f : cost(u, x, y);
  let dirs = PASSES[0];
  const go = (rem, x, y) => {
    if (!inMap(x, y)) return;
    const k = c(x, y); if (k >= 0x7f) return;
    const left = rem - k; if (left < 0) return;
    const id = key(x, y), n = visits.get(id) || 0; if (!n) out.push([x, y]); visits.set(id, n + 1);
    if (left <= 0) return;
    for (const [dx, dy] of dirs) if ((visits.get(key(x + dx, y + dy)) || 0) < 4) go(left, x + dx, y + dy);
  };
  for (dirs of PASSES) { go(u.move, u.x, u.y); for (const k of visits.keys()) visits.set(k, 1); }
  return out;
}
// the board as the AI reads it for this mover
function board(u) {
  const list = reachList(u), ov = new Map();
  for (const v of G.units) if (live(v)) ov.set(key(v.x, v.y), slotOf(v) + 1);
  for (const [x, y] of list) { const k = key(x, y); ov.set(k, (ov.get(k) || 0) + 0x28); }
  const at = (x, y) => inMap(x, y) ? ov.get(key(x, y)) || 0 : -1;   // (-1 off the map: the ROM reads past it, never to a path)
  return { u, list, inReach: new Set(list.map(([x, y]) => key(x, y))), at, heroAt: (x, y) => { const v = at(x, y); return v >= 1 && v <= 10 || v >= 0x29 && v <= 0x32; } };
}

// the path search [0xBFE0 / 0xC4F0]: neighbour orders by where the goal lies (table 0x38C78, variants 0-7); the variant is
// one value for the whole search, set at each cell and read again at every step (deeper calls change it, as the ROM's)
const V8 = [[[0, -1], [-1, 0], [1, 0], [0, 1]], [[0, -1], [1, 0], [-1, 0], [0, 1]], [[0, 1], [1, 0], [-1, 0], [0, -1]], [[0, 1], [-1, 0], [1, 0], [0, -1]],
  [[-1, 0], [0, 1], [0, -1], [1, 0]], [[-1, 0], [0, -1], [0, 1], [1, 0]], [[1, 0], [0, -1], [0, 1], [-1, 0]], [[1, 0], [0, 1], [0, -1], [-1, 0]]];
function variant(x, y, gx, gy) {
  const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
  if (gy >= y && gx >= x && dy >= dx) return 2;
  if (gy > y && gx < x && dy >= dx) return 3;
  if (gy < y && gx > x && dy >= dx) return 1;
  if (gy <= y && gx <= x && dy >= dx) return 0;
  if (gy >= y && gx >= x) return 7;
  if (gy > y && gx < x) return 4;
  if (gy < y && gx > x) return 6;
  return 5;
}
function dfs(open, limit, sx, sy, gx, gy) {
  const vis = new Set(), path = []; let found = false, n = 0, v = 0;
  const free = (x, y) => !vis.has(key(x, y)) && open(x, y);
  const go = (lim, x, y, i) => {
    if (found || !open(x, y) || lim < 0) return;
    const k = key(x, y);
    if (!vis.has(k)) { path.length = i; path.push([x, y]); vis.add(k); n = i + 1; if (x === gx && y === gy) { found = true; return; } }
    if (y === gy && gx > x) { if (free(x + 1, y)) go(lim - 1, x + 1, y, i + 1); }
    else if (y === gy && gx < x) { if (free(x - 1, y)) go(lim - 1, x - 1, y, i + 1); }
    else if (gx === x && gy > y) { if (free(x, y + 1)) go(lim - 1, x, y + 1, i + 1); }
    else if (gx === x && gy < y) { if (free(x, y - 1)) go(lim - 1, x, y - 1, i + 1); }
    v = variant(x, y, gx, gy);
    for (let j = 0; j < 4; j++) { const [dx, dy] = V8[v][j]; if (!found && !vis.has(key(x + dx, y + dy))) go(lim - 1, x + dx, y + dy, i + 1); }
  };
  go(limit, sx, sy, 0);
  return found ? path.slice(0, n) : null;
}
// mode 1: passable terrain for the mover, else its reach cells; heroes (slots 0-9) bar the way, the mover never.
// From (sx, sy) to (gx, gy): the cells, both ends included, or null
export function findPath(b, mode, limit, gx, gy, sx = b.u.x, sy = b.u.y) {
  const u = b.u;
  if (sx === gx && sy === gy) return [[gx, gy]];
  if (!u.move) return null;   // (the ROM returns at once for a unit that cannot move)
  const barred = new Set(G.units.filter(v => live(v) && v !== u && isHero(v)).map(v => key(v.x, v.y)));
  const open = (x, y) => inMap(x, y) && !barred.has(key(x, y)) && (mode === 1 ? costAt(u.moveType, x, y) < 0x7f : b.inReach.has(key(x, y)));
  const a = dfs(open, limit, sx, sy, gx, gy), r = dfs(open, limit, gx, gy, sx, sy);
  if (!a && !r) return null;
  return r && (!a || r.length <= a.length) ? r.reverse() : a;
}

// ---------------------------------------------------------------- facing and the strike
// face a cell [0x1FF58]: across when it lies further across than up or down, else up or down; move type 9 never turns
export function faceRule(u, x, y) {
  if (u.moveType === 9) return u.facing;
  const dx = x - u.x, dy = y - u.y;
  return Math.abs(dx) > Math.abs(dy) ? (x >= u.x ? 'right' : 'left') : (y >= u.y ? 'down' : 'up');
}
// the cells round a hero tried in turn [table 0x1F306]: by the set in record +32 (0 front, sides, back; 1 the flanks
// first; 2 behind first) and the way the hero faces
const T = [
  { down: [[0, 1], [-1, 0], [1, 0], [0, -1]], up: [[0, -1], [-1, 0], [1, 0], [0, 1]], left: [[-1, 0], [0, -1], [0, 1], [1, 0]], right: [[1, 0], [0, -1], [0, 1], [-1, 0]] },
  { down: [[-1, 0], [1, 0], [0, 1], [0, -1]], up: [[-1, 0], [1, 0], [0, -1], [0, 1]], left: [[0, -1], [0, 1], [-1, 0], [1, 0]], right: [[0, -1], [0, 1], [1, 0], [-1, 0]] },
  { down: [[0, -1], [-1, 0], [1, 0], [0, 1]], up: [[0, 1], [-1, 0], [1, 0], [0, -1]], left: [[1, 0], [0, -1], [0, 1], [-1, 0]], right: [[-1, 0], [0, -1], [0, 1], [1, 0]] },
];
const cellsRound = (f32, h) => (T[f32] || T[0])[FACE.includes(h.facing) ? h.facing : 'down'];
// an archer's (move type 1) ring two cells out [0x11186], by the way it faces
const BOW = {
  down: [[0, 2], [-1, 1], [1, 1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2]], up: [[0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, 2]],
  left: [[-2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [0, -2], [0, 2], [2, 0]], right: [[2, 0], [1, -1], [1, 1], [-1, -1], [-1, 1], [0, -2], [0, 2], [-2, 0]],
};
// the strike [0x1FD1E]: the first hero round the unit, standing at (x, y) facing `facing`, in its facing's order: the four
// cells next to it, an archer's ring instead (it never strikes a hero next to it)
export function strikeTarget(u, x, y, facing) {
  for (const [dx, dy] of (u.moveType === 1 ? BOW : T[0])[facing] || T[0].down) {
    const v = G.units.find(w => live(w) && isHero(w) && w.x === x + dx && w.y === y + dy); if (v) return v;
  }
  return null;
}

// ---------------------------------------------------------------- the plan
const DLRU = [[0, 1], [-1, 0], [1, 0], [0, -1]];
function plan(b, path, face, strike, extra) {
  const u = b.u, [x, y] = path[path.length - 1], facing = face ? faceRule(Object.assign({}, u, { x, y }), face.x, face.y) : u.facing;
  const target = strike ? strikeTarget(u, x, y, facing) : null;
  return Object.assign({ kind: target ? 'attack' : 'wait', path, cell: { x, y }, facing, target, r: new Map(b.list.map(([cx, cy]) => [key(cx, cy), { x: cx, y: cy, c: 0, stop: true }])) }, extra || {});
}
const stay = b => [[b.u.x, b.u.y]];
// the walk of the casters, the fallback and AI 9 / 10 [0x1FB46]: as far as the last free reach cell on the path, stopping
// short at a cell out of reach
function walkReach(b, P) {
  let i = -1; P.forEach(([x, y], k) => { if (b.at(x, y) === 0x28) i = k; });
  if (i < 0) return stay(b);
  const out = [P[0]];
  for (let k = 1; k <= i; k++) { if (b.at(...P[k]) <= 0x1e) break; out.push(P[k]); }
  while (out.length > 1 && b.at(...out[out.length - 1]) !== 0x28) out.pop();   // (never end on an ally: back to the last free cell)
  return out;
}
// the walk towards a hero out of reach [0x1F9E2]: the path's first stretch in reach; ending on an ally, the first free
// reach cell next to that one (D, L, R, U) with a way there of ten steps or fewer, else a cell further back
function walkToward(b, P) {
  const run = []; for (const [x, y] of P) { const v = b.at(x, y); if (v === 0x28 || v > 0x32) run.push([x, y]); else break; }
  let L = run.length - 1;
  if (L >= 0 && b.at(...P[L]) === 0x28) return run;
  for (L = Math.max(0, L); ;) {
    const [x, y] = P[L];
    for (const [dx, dy] of DLRU) if (b.at(x + dx, y + dy) === 0x28) return findPath(b, 1, 10, x + dx, y + dy) || stay(b);
    L--; if (L <= 0) return stay(b);
  }
}
// the heroes in the order an AI goes for them [the table at 0x1ED0E, sorted 0x201FE: ascending, ties to the lower slot];
// the fallen are left out (AI 3's quarry aside)
function ranked(u, ai) {
  const hs = G.units.filter(v => isHero(v) && v.side !== 'npc').sort((a, b) => slotOf(a) - slotOf(b));
  const keyOf = { 1: h => statOf(h, 'df'), 2: h => 255 - statOf(h, 'atk'), 5: h => 999 - h.hp, 6: h => h.hp }[ai] || (h => man(h, u));
  const list = hs.filter(h => h.alive && !h.away).map(h => ({ h, k: keyOf(h) }));
  if (ai === 3) {   // [0x202D0] the hero whose class is +36 first, fallen or not; with none, slot 0's [the ROM's own slip]
    const q = hs.find(h => h.cid === aiP(u, 0x36)) || hs.find(h => slotOf(h) === 0);
    if (q) { const i = list.findIndex(e => e.h === q); if (i >= 0) list.splice(i, 1); list.unshift({ h: q, k: 0 }); }
  }
  return list.map((e, i) => ({ e, i })).sort((a, b) => a.e.k - b.e.k || a.i - b.i).map(x => x.e.h);
}

// AI 0-6 [0x1ED66]
function regular(b, ai) {
  const u = b.u, f32 = u.cellSet || 0, archer = u.moveType === 1, order = ranked(u, ai);
  // 0. hemmed in (no free reach cell nor ally in reach next to it; a unit that cannot move): strike where it stands [0x1F8D2]
  if (!DLRU.some(([dx, dy]) => { const v = b.at(u.x + dx, u.y + dy); return v === 0x28 || v >= 0x33; })) return plan(b, stay(b), null, true, { why: 'S' });
  // 1. a hero it can strike this turn [0x1F366; an archer 0x1F6AC], the first in rank that works
  for (const h of order) {
    if (archer) {
      if (man(h, u) - 1 > u.move + 3) continue;
      for (const [x, y] of b.list) {
        if (!(x === u.x && y === u.y || b.at(x, y) === 0x28) || Math.abs(x - h.x) + Math.abs(y - h.y) !== 2) continue;
        const p = findPath(b, 0, 10, x, y); if (p) return plan(b, p, h, true, { why: 'A', full: p, toward: h });
      }
      continue;
    }
    if (man(h, u) - 1 > u.move) continue;
    let cells = f32 ? cellsRound(f32, h) : DLRU.slice();
    if (!f32) {   // nearest the mover first [0x759C: an exchange sort, swapping only on greater]
      const k = cells.map(([dx, dy]) => Math.abs(h.x + dx - u.x) + Math.abs(h.y + dy - u.y));
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 4; j++) if (k[i] > k[j]) { [k[i], k[j]] = [k[j], k[i]]; [cells[i], cells[j]] = [cells[j], cells[i]]; }
    }
    for (const [dx, dy] of cells) {
      const x = h.x + dx, y = h.y + dy;
      if (x === u.x && y === u.y) return plan(b, stay(b), h, true, { why: 'A', full: stay(b), toward: h });
      if (b.at(x, y) !== 0x28) continue;
      const p = findPath(b, 0, 10, x, y); if (p) return plan(b, p, h, true, { why: 'A', full: p, toward: h });
    }
  }
  // 2. towards a hero out of reach, no strike [0x1F58E]: the first cell round it (empty, out of reach, passable for the
  // hero's own move type, the ROM's slip) with a way there
  for (const h of order) {
    const P = towardCell(b, h, f32, 100);
    if (P) return plan(b, walkToward(b, P), h, false, { why: 'B', full: P, toward: h });
  }
  // 3. the fallback [0x1FC24]: the first open cell of twelve round the first in rank, one try at a way there
  const h = order[0];
  if (h && h.alive) for (const [dx, dy] of FALLBACK) {
    const x = h.x + dx, y = h.y + dy;
    if (!inMap(x, y) || costAt(u.moveType, x, y) >= 0x7f || (b.at(x, y) !== 0 && b.at(x, y) !== 0x28)) continue;
    const P = findPath(b, 1, 40, x, y);
    return plan(b, P ? walkReach(b, P) : stay(b), null, false, { why: 'C', full: P, toward: h });
  }
  return plan(b, stay(b), null, false, { why: 'C', toward: h });
}
const FALLBACK = [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [0, -2], [-2, 0], [2, 0]];
function towardCell(b, h, f32, limit) {
  for (const [dx, dy] of cellsRound(f32, h)) {
    const x = h.x + dx, y = h.y + dy;
    if (b.at(x, y) !== 0 || costAt(h.moveType, x, y) >= 0x7f) continue;
    const P = findPath(b, 1, limit, x, y); if (P) return P;
  }
  return null;
}

// ---------------------------------------------------------------- casters [0x1BE90]
// a spell's reach and area as the AI reads them [tables 0x1BE34, 0x1BE74; ranges 1-2 cut short and 3-4 a single cell by
// the ROM's own slips]
const R5 = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0]], R6 = R5.concat([[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]);
const RANGE = [DLRU, [[0, 2], [-1, 1], [1, 1], [-1, -1]], [[0, 2], [-1, 1], [1, 1], [-1, -1]], [[0, -1]], [[0, -1]], R5, R6,
  R6.concat([[-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2], [0, -3], [0, 3], [-3, 0], [3, 0]])];
const A1 = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]], AREA = [[[0, 0]], A1, A1.concat([[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]])];
// the pick of several [0x75E6]: one is taken; of exactly two the first, whatever they hold; else the first of the best
function pick(c, score) {
  if (c.length <= 2) return c[0] || null;
  return c.reduce((a, x) => score(x) > score(a) ? x : a);
}
function caster(b, ai) {
  const u = b.u, sp = D.spells[u.spells[0]], range = RANGE[sp.range] || RANGE[0], area = AREA[sp.area] || AREA[0];
  const cells = b.list.filter(([x, y]) => x === u.x && y === u.y || b.at(x, y) === 0x28);
  if (ai === 0x81) {   // the healer [0x1C532, 0x1C6E4]: its own side round each aim, the lowest HP first; heals at half or under
    const c = [], ownAt = (x, y, cx, cy) => x === cx && y === cy ? u : x === u.x && y === u.y ? null : G.units.find(t => live(t) && t !== u && !isHero(t) && t.x === x && t.y === y) || null;
    for (const [cx, cy] of cells) for (const [ox, oy] of range) {   // (as though it stood on the cell it would cast from)
      const ax = cx + ox, ay = cy + oy; if (!ownAt(ax, ay, cx, cy)) continue;
      for (const [dx, dy] of area) { const w = ownAt(ax + dx, ay + dy, cx, cy); if (w) c.push({ w, at: [ax, ay], from: [cx, cy] }); }
    }
    const order = c.length === 2 ? c : c.map((e, i) => ({ e, i })).sort((a, z) => a.e.w.hp - z.e.w.hp || a.i - z.i).map(x => x.e);
    const best = order[0];
    if (best && best.w.hp <= best.w.mhp >> 1) {
      const P = findPath(b, 0, 40, ...best.from);
      return plan(b, P ? walkReach(b, P) : stay(b), { x: best.at[0], y: best.at[1] }, false, { kind: 'spell', sp, at: best.at });
    }
    return regular(b, aiP(u, 0x34));
  }
  // an attack caster [0x1C3B2]: every reach cell and every aim in range at a hero, counted by the heroes in the area
  const c = [];
  for (const [cx, cy] of cells) for (const [ox, oy] of range) {
    const ax = cx + ox, ay = cy + oy, v = b.at(ax, ay); if (!(v >= 1 && v <= 10)) continue;
    c.push({ at: [ax, ay], from: [cx, cy], n: area.filter(([dx, dy]) => { const w = b.at(ax + dx, ay + dy); return w >= 1 && w <= 10; }).length });
  }
  const best = pick(c, e => e.n);
  if (!best) {   // none in range [0x1BF54, 0x1C812]: towards the nearest hero (only ever the first: the ROM's slip), striking if it ends by one
    const h = ranked(u, 0)[0], P = h && towardCell(b, h, u.cellSet || 0, 50);
    return plan(b, P ? walkReach(b, P) : stay(b), h || null, true);
  }
  if (ai !== 0x84 && rand128() % 3 === 0) return regular(b, aiP(u, 0x34));   // one turn in three it fights by +34 (0x84 never)
  const P = findPath(b, 1, 30, ...best.from);
  return plan(b, P ? walkReach(b, P) : stay(b), { x: best.at[0], y: best.at[1] }, false, { kind: 'spell', sp, at: best.at });
}
// AI 0x85 [0x1C0C2], battle 32's 紂王: in a round that is a multiple of three, two of three columns (x 10, 11, 12; y 3-9,
// table 0x1BE0A) drawn by lot are struck, every hero there losing 50, for the first spell's MP; else a caster as 0x80
const ZONE = [10, 11, 12];
function zone(b) {
  const u = b.u, sp = D.spells[u.spells[0]], a = rand128() % 3; let c = rand128() % 3; while (c === a) c = rand128() % 3;
  const cells = [a, c].flatMap(k => Array.from({ length: 7 }, (_, i) => [ZONE[k], 3 + i])).filter(([x, y]) => inMap(x, y));
  return Object.assign(plan(b, stay(b), null, false), { kind: 'zone', sp, cells, at: [11, 6], dmg: 50 });
}

// ---------------------------------------------------------------- AI 9 and 10 [0x1EE96, 0x1EFB0]
const NEAR9 = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [-1, -1]];
function goTo(b) {   // AI 9: to (+34, +35), or the first open cell by it; there its next AI; then the strike
  const u = b.u, gx = aiP(u, 0x34), gy = aiP(u, 0x35);
  let path = stay(b);
  for (const [dx, dy] of NEAR9) {
    const x = gx + dx, y = gy + dy, v = b.at(x, y);
    if (!(v === 0x28 || v === 0 || x === u.x && y === u.y)) continue;
    const P = findPath(b, 1, 30, x, y); if (P) { path = walkReach(b, P); break; }
  }
  const [ex, ey] = path[path.length - 1];
  let facing = null;
  if (ex === gx && ey === gy) { facing = { 0: 'down', 8: 'up', 0x10: 'left', 0x18: 'right' }[aiP(u, 0x36)]; u.ai = aiP(u, 0x37); setAiP(u, 0x34, aiP(u, 0x38)); setAiP(u, 0x35, aiP(u, 0x39)); setAiP(u, 0x36, aiP(u, 0x3a)); }
  const p = plan(b, path, null, false); if (facing) p.facing = facing;
  p.target = strikeTarget(u, ex, ey, p.facing); p.kind = p.target ? 'attack' : 'wait'; return p;
}
function guard(b) {   // AI 10: a hero within +38 and it takes its next AI now; else a random free cell of its zone, then the strike
  const u = b.u, W = G.terrain[0].length, H = G.terrain.length;
  if (G.units.some(h => live(h) && isHero(h) && man(h, u) <= aiP(u, 0x38))) {
    u.ai = aiP(u, 0x39); setAiP(u, 0x34, aiP(u, 0x3a)); setAiP(u, 0x35, aiP(u, 0x3b));
    return turn(u);
  }
  const cx = aiP(u, 0x34), cy = aiP(u, 0x35), dx = aiP(u, 0x36), dy = aiP(u, 0x37);
  let x = u.x, y = u.y;
  for (let tries = 0; tries < 200; tries++) {
    let nx, ny, clamped = false;
    do { nx = dx ? (clamped = cx - dx < 0, Math.max(0, cx - dx)) + rand128() % (dx * 2 + 1) : cx; } while (nx > W);
    do { ny = dy ? (clamped ? cy - dy : Math.max(0, cy - dy)) + rand128() % (dy * 2 + 1) : cy; } while (ny > H);   // (the y clamp skipped when x's fired: the ROM's)
    if (nx === u.x && ny === u.y || b.at(nx, ny) === 0x28) { x = nx; y = ny; break; }
  }
  const P = findPath(b, 1, 8, x, y), path = P ? walkReach(b, P) : stay(b), [ex, ey] = path[path.length - 1];
  const p = plan(b, path, null, false); p.target = strikeTarget(u, ex, ey, p.facing); p.kind = p.target ? 'attack' : 'wait'; return p;
}

// ---------------------------------------------------------------- AI 10 on the heroes' side: berserk [0x1DC00]
// the player turn [0xA2C] hands a unit of its own side to 0x1DEE6 at AI 9 (rules.js guestPlan) and to this at AI 10 (battle
// 24's 小龍女, out of her mind): every other unit standing, of either side, nearest first [0x1DD0E: |dx| + |dy|; the list
// sorted at 0x759C]; for each, the four cells round it in turn [table 0x1DE72: up, left, right, down], the first free one
// its terrain lets it into [0x1E13A] with a way there (0xBFE0 mode 1, up to 60) is walked to as far as its reach goes
// [0x1E060]; then it strikes the first unit next to it in that order [0x1DD9A], whoever it is; none found, it waits
const ROUND = [[0, -1], [-1, 0], [1, 0], [0, 1]];
export function berserk(u) {
  const b = board(u), others = G.units.filter(v => live(v) && v !== u).map((v, i) => [v, i]).sort((p, q) => man(p[0], u) - man(q[0], u) || p[1] - q[1]).map(p => p[0]);
  const free = (x, y) => inMap(x, y) && costAt(u.moveType, x, y) < 0x7f && !G.units.some(v => live(v) && v.x === x && v.y === y);
  for (const t of others) for (const [dx, dy] of ROUND) {
    const x = t.x + dx, y = t.y + dy; if (!free(x, y)) continue;
    const P = findPath(b, 1, 60, x, y); if (!P) continue;
    const path = walkReach(b, P), [ex, ey] = path[path.length - 1];
    const v = ROUND.map(([ax, ay]) => G.units.find(w => live(w) && w !== u && w.x === ex + ax && w.y === ey + ay)).find(Boolean) || null;
    const p = plan(b, path, null, false); if (v) { p.target = v; p.kind = 'attack'; p.facing = faceRule(Object.assign({}, u, { x: ex, y: ey }), v.x, v.y); }
    return p;
  }
  return plan(b, stay(b), null, false);
}

// ---------------------------------------------------------------- the dispatch [0x1ECEA]
export function turn(u, aiOver) {
  const b = board(u);
  let ai = aiOver ?? u.ai;
  if (ai >= 0x80) {   // a caster with no MP for its first spell, or sealed, takes the AI in +34 for good [0x1BEC0]
    const sp = D.spells[u.spells[0]];
    if (!sp || u.mp < sp.mp || u.status.seal) { u.ai = ai = aiP(u, 0x34); }
  }
  if (ai === 9) return goTo(b);
  if (ai === 10) return guard(b);
  if (ai === 0x85 && G.round % 3 === 0) return zone(b);
  if (ai >= 0x80) return caster(b, ai);
  return regular(b, ai);
}
