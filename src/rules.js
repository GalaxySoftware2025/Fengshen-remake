// 封神英傑傳 — battle rules, shared by the 3D remake and the headless tests.
// Everything marked [ROM] was read out of the original 68000 code (see ../fengshen-panxi/README.md);
// [design] marks reconstructions. No rendering here: the battle flow (battle.js) calls a presenter.
// The battle being played is loaded with loadBattle(): the shared tables (data/common.js), that battle's generated data
// (data/battles/NN.js), the party, and the battle's rule hooks (src/battles/NN-*.js) for whatever is unique to it.
import { spriteKey } from './sprites.js';
export const D = {};                  // the loaded battle: COMMON tables + BATTLES[n] + party (+ what its hooks add)
export let MAP_W = 0, MAP_H = 0;
export let H = {};                    // the loaded battle's rule hooks (see src/battles/README.md)
export const HERO_CID = 0;            // 林雲: the AI goes for him first

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const key = (x, y) => x + ',' + y;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
let rngState = (Date.now() & 0x7fffffff) || 1;
export const seed = s => { rngState = s; };
export function rand128() { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return (rngState >> 8) & 0x7f; }

// ---------------------------------------------------------------- range shapes [ROM]
function diamond(r, self) { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const m = Math.abs(dx) + Math.abs(dy); if (m <= r && (self || m > 0)) o.push([dx, dy]); } return o; }
const SHAPES = {
  0: [[0, 1], [-1, 0], [1, 0], [0, -1]],
  1: null,                            // from the ROM table (COMMON.shapes.s1), set by loadBattle
  2: (() => { const o = []; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const m = Math.abs(dx) + Math.abs(dy); if (m >= 2 && m <= 3) o.push([dx, dy]); } return o; })(),
  5: diamond(1, true), 6: diamond(2, true), 7: diamond(3, true),
};
const PHYS_IMMUNE = [0x0c, 0x0d, 0x10];          // [ROM] 0xF9F0
export const SPELL_IMMUNE = [0x09, 0x0e, 0x0f, 0x10];   // [ROM] 0x21354

export function physicalAttack(a, d) {           // [ROM] 0xF8C2
  const diff = clamp(a.lv - d.lv, -4, 4) + 4;
  const miss = rand128() < D.missTable[diff];
  const crit = rand128() < D.critTable[diff];
  let dmg = a.atk + (a.buf.atk || 0) - (d.df + (d.buf.df || 0));
  if (dmg <= 0) dmg = 1;
  if (crit) dmg *= 2;
  if (PHYS_IMMUNE.includes(d.moveType)) dmg = 0;
  return { miss, crit, dmg };
}
export const spellPower = (caster, sp) => sp.pow + (caster.side === 'player' ? (caster.atk >> 2) : 0);   // [ROM] 0x21022
export function expFor(a, d, killed) {           // [ROM] 0x12372
  const e = D.expTable[clamp(a.lv - d.lv, -6, 5) + 6];
  return killed ? e : e >> 1;
}

// ---------------------------------------------------------------- state
export const G = { units: [], round: 0, terrain: [], over: null, triggerFired: false, chests: [], found: [], chestFlags: {} };   // chestFlags: ff3252, kept across battles (campaign.js)
export function makeUnit(src, side, extra) {
  return Object.assign({
    side, name: src.name, cid: src.cid, sprite: src.sprite, lv: src.lv, atk: src.atk, df: src.df, spd: src.spd,
    hp: src.hp, mhp: src.mhp, mp: src.mp, mmp: src.mmp, exp: src.exp || 0, move: src.move, moveType: src.moveType,
    rangeShape: src.rangeShape || 0, atkType: src.atkType ?? (side === 'player' ? ((globalThis.ACTIONS || {}).heroes || {})[src.cid] : undefined),   // 0 / 1 a weapon swung with its piece, 2 a bow
    items: (src.items || []).slice(), spells: (src.spells || []).slice(), drop: src.drop ?? null,   // drop: the item its spawn record gives it to hold (+0x12 [ROM 0x13344]), handed over when it falls
    ai: src.ai, aggro: src.aggro, aip: src.aip ? src.aip.slice() : null, growth: src.growth, cls: src.cls, elem: src.elem,
    x: 0, y: 0, facing: 'down', alive: true,   // (a fresh record's +1: 0, down; the battle opens with the heroes so [ROM: the deploy copies their records, 0x6B4A])
    status: { sleep: 0, seal: 0, poison: 0 }, buf: {},
  }, extra || {});
}
export const unitAt = (x, y) => G.units.find(u => u.alive && u.x === x && u.y === y);
export const players = () => G.units.filter(u => u.alive && u.side === 'player');
export const foes = u => G.units.filter(v => v.alive && v !== u && (u.side === 'player' ? v.side === 'enemy' : v.side === 'player'));
export const allies = u => G.units.filter(v => v.alive && v.side === u.side);
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
export const cost = (u, x, y) => D.costs[u.moveType][G.terrain[y][x]];

// movement range [ROM 0xB3BA]: flood fill with per-movetype terrain costs; enemies block, allies can be passed
export function reach(u) {
  const out = new Map(); out.set(key(u.x, u.y), { x: u.x, y: u.y, c: 0, prev: null, stop: true });
  const q = [[u.x, u.y]];
  while (q.length) {
    const [x, y] = q.shift(); const cur = out.get(key(x, y));
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue;
      const c = cur.c + cost(u, nx, ny); if (c > u.move) continue;
      const o = unitAt(nx, ny);
      if (o && o.side !== u.side) continue;
      const k = key(nx, ny), old = out.get(k);
      if (old && old.c <= c) continue;
      out.set(k, { x: nx, y: ny, c, prev: key(x, y), stop: !o }); q.push([nx, ny]);
    }
  }
  return out;
}
export function pathTo(r, x, y) { const p = []; let k = key(x, y); while (k) { const n = r.get(k); p.unshift([n.x, n.y]); k = n.prev; } return p; }
export const cellsInShape = (cx, cy, shape) => (SHAPES[shape] || SHAPES[0]).map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => inMap(x, y));
export const areaCells = (tx, ty, area) => area ? diamond(area, true).map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => inMap(x, y)) : [[tx, ty]];
// where a spell or item may be cast in a regular game: on someone it is for, a foe for harm, the caster's side for help
// (never an empty cell, nor a phantom off the map) [the user's call; the test toolbar keeps every cell in range]
export const castCells = (u, cells, harm) => cells.filter(([x, y]) => { const t = unitAt(x, y); return t && !t.away && (harm ? foes(u).includes(t) : t.side === u.side); });
export function faceTo(u, x, y) {
  const dx = x - u.x, dy = y - u.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx) u.facing = dx > 0 ? 'right' : 'left';
  else if (dy) u.facing = dy > 0 ? 'down' : 'up';
}

// ---------------------------------------------------------------- effects [ROM tables]
export function spellEffect(caster, sp) {
  if (sp.kind === 12) {
    if (sp.pow > 0 && sp.pow < 1000) return { kind: 12, apply: t => { const h = Math.min(sp.pow, t.mhp - t.hp); t.hp += h; return { heal: h, exp: h }; } };
    return { kind: 12, apply: t => { t.status = { sleep: 0, seal: 0, poison: 0 }; return { text: '淨化', exp: 5 }; } };
  }
  if (sp.id === 0x33) return { kind: 13, apply: t => { t.status.sleep = 2; return { text: '睡眠', status: 'sleep' }; } };   // 迴夢
  if (sp.id === 0x32) return { kind: 13, apply: t => { t.status.seal = 3; return { text: '封法', status: 'seal' }; } };    // 封魔符
  return { kind: 13, apply: () => ({ dmg: spellPower(caster, sp) }) };
}
export function itemEffect(user, it) {
  const id = it.id, p = it.pow;
  const heal = (hp, mp) => t => { const h = Math.min(hp, t.mhp - t.hp), m = Math.min(mp, t.mmp - t.mp); t.hp += h; t.mp += m; return h ? { heal: h, exp: 5 } : { text: '法力 +' + m, exp: 5 }; };
  switch (true) {
    case id <= 3: return { kind: 12, apply: heal(id === 3 ? 999 : p, 0) };
    case id <= 5: return { kind: 12, apply: heal(0, p) };
    case id === 6: return { kind: 12, apply: heal(30, 30) };
    case id >= 8 && id <= 0x0a: return { kind: 12, apply: t => { t.status = { sleep: 0, seal: 0, poison: 0 }; return { text: '解毒', exp: 3 }; } };
    case id >= 0x0b && id <= 0x0d: return { kind: 13, apply: () => ({ dmg: spellPower(user, it) }) };
    case id === 0x0e: return { kind: 13, apply: t => { t.status.poison = 3; return { text: '中毒', status: 'poison' }; } };
    case id === 0x0f: return { kind: 13, apply: t => { t.status.sleep = 2; return { text: '睡眠', status: 'sleep' }; } };
    case id === 0x10: return { kind: 13, apply: t => { t.buf.atk = (t.buf.atk || 0) - 3; t.buf.df = (t.buf.df || 0) - 3; return { text: '攻防↓' }; } };
    case id === 0x11: return { kind: 13, apply: t => { t.status.seal = 3; return { text: '封法', status: 'seal' }; } };
    case id === 0x1d: return { kind: 12, apply: t => { t.atk += 3; return { text: '攻擊 +3', exp: 0 }; } };
    case id === 0x1e: return { kind: 12, apply: t => { t.df += 3; return { text: '防禦 +3', exp: 0 }; } };
    case id === 0x1f: return { kind: 12, apply: t => { t.move += 1; return { text: '移動 +1', exp: 0 }; } };
    case id === 0x20: return { kind: 12, apply: t => { t.spd += 5; return { text: '速度 +5', exp: 0 }; } };
    case id === 0x22: return { kind: 12, apply: t => { t.buf.atk = (t.buf.atk || 0) + 2; return { text: '攻擊 +2', exp: 0 }; } };
    case id === 0x23: return { kind: 12, apply: t => { t.buf.df = (t.buf.df || 0) + 2; return { text: '防禦 +2', exp: 0 }; } };
    default: return null;
  }
}
// level-up [ROM 0x12B24] with the per-character growth tables; returns what changed
export function levelUp(u) {
  const g = u.growth; if (!g) { u.lv++; return { lv: u.lv }; }
  const before = g[u.lv - 1], after = g[u.lv]; u.lv++;
  const ch = { lv: u.lv, hp: after[0] - before[0], mp: after[1] - before[1], atk: after[2] - before[2], df: after[3] - before[3], spd: after[4] - before[4] };
  u.mhp += ch.hp; u.hp += ch.hp; u.mmp += ch.mp; u.mp += ch.mp; u.atk += ch.atk; u.df += ch.df; u.spd += ch.spd;
  if (after[5] !== 255 && !u.spells.includes(after[5])) { u.spells.push(after[5]); ch.spell = after[5]; }
  return ch;
}

// ---------------------------------------------------------------- loading
export function loadBattle(B, party, hooks, tweak) {
  for (const k of Object.keys(D)) delete D[k];
  Object.assign(D, globalThis.COMMON, B, { party, partyRules: B.party });   // party: the roster; partyRules: cap, forced, unavailable
  const AT = ((globalThis.ACTIONS || {}).battles || {})[B.n] || [];   // each unit's attack type (data/actions.js: its template's +0x2B)
  D.enemies = B.enemies.map((e, i) => Object.assign({}, e, { slot: 10 + i, sprite: spriteKey(e.gfx), atkType: AT[i] }));   // slots 10.. as in the ROM's unit table
  const withSummon = e => e.summon ? { summon: Object.assign({}, e.summon, { sprite: spriteKey(e.summon.gfx) }) } : {};
  if (B.rooms) {
    D.rooms = B.rooms.map(r => Object.assign({}, r, { enemies: r.enemies.map((e, i) => Object.assign({}, e, { slot: 10 + i, sprite: spriteKey(e.gfx) }, withSummon(e))) }));
    // the battle starts on its own map with its own enemies (the header's: the ROM loads a room record only when a hero
    // takes an exit); where the room table's first record is the next room's again (battles 14 and 15: both entries point
    // at the lair, and no way leads back), the first room is that map, not the lair
    const same = (a, b) => b && a.w === b.w && a.h === b.h && JSON.stringify(a.terrain) === JSON.stringify(b.terrain);
    if (same(D.rooms[0], D.rooms[1]) && (D.rooms[0].w !== B.mapW || D.rooms[0].h !== B.mapH)) D.rooms[0] = Object.assign({}, D.rooms[0], { w: B.mapW, h: B.mapH, terrain: B.terrain, chests: B.chests || [], chestTable: B.chestTable, enemies: [] });
    // the room it opens in (battle 17's room 2, its own map) holds the header's chests: the battle loader reads the
    // header's chest table (+0x20 [ROM 0x13240]), a room record's (+0x3C) only when a hero takes an exit (battle 12's
    // room 0 names battle 10's table; its battle opens on the header's, empty)
    G.room = (hooks && hooks.startRoom) || 0; D.rooms[G.room] = Object.assign({}, D.rooms[G.room], { chests: B.chests || [], chestTable: B.chestTable }); D.chests = D.rooms[G.room].chests; D.chestTable = B.chestTable; G.chests = null;
  }
  SHAPES[1] = D.shapes.s1;
  H = hooks || {};
  if (H.load) H.load(D);              // a battle can add the units its hook spawns, or adjust the map
  if (tweak) tweak(D);                // the 演武場 (#arena) swaps in its field
  MAP_W = D.mapW; MAP_H = D.mapH;
  COND = conditions(D);
  return D;
}

// ---------------------------------------------------------------- win / lose [design: read from the condition text]
// The ROM checks each battle's conditions in its own hook code; until a battle's hooks are ported, its condition text
// (勝利條件 / 敗北條件) is read here. Named units: 「X亡」「X死亡」 lose when X dies, 「滅X」「敗X」「降X」「X、Y亡」 win when they
// have all fallen. Anything else (reach an exit, find an item, ...) needs the battle's hooks and falls back to a rout.
let COND = { win: [], lose: [] };
function conditions(D) {
  const names = s => s.split('、').map(n => n.replace(/父子$/, ''));
  const win = D.win.map(t => t === '敵方全滅' ? { rout: 1 } : /^(滅|敗|降)/.test(t) ? { dead: names(t.slice(1)) } : /亡$/.test(t) ? { dead: names(t.slice(0, -1)) } : { rout: 1, text: t });
  const lose = D.lose.map(t => t === '我方全滅' ? { all: 1 } : /(死亡|亡)$/.test(t) ? { dead: names(t.replace(/(死亡|亡)$/, '')), text: t } : null).filter(Boolean);
  return { win, lose };
}
const named = list => G.units.filter(u => list.includes(u.name));
function genericDefeat() {   // a named loss first: 林雲 alone falling is his own lose condition, not a rout
  for (const c of COND.lose) if (c.dead && named(c.dead).some(u => !u.alive)) return c.text;
  if (!players().length) return '我方全滅';
  return null;
}
function genericVictory() {
  return COND.win.some(c => {
    const us = c.dead ? named(c.dead) : [];
    return us.length ? us.every(u => !u.alive) : !G.units.some(u => u.alive && u.side === 'enemy');
  });
}
export function checkTrigger() { return H.trigger ? H.trigger(G) : false; }
export function checkVictory() { return H.victory ? H.victory(G) : genericVictory(); }
export function checkDefeat() {
  const why = H.defeat ? H.defeat(G) : genericDefeat();
  if (why) { G.over = { win: false, why }; return true; }
  return false;
}
export function afterAction() {
  const trig = checkTrigger();
  if (checkDefeat()) return { over: true, trig };
  const v = checkVictory();   // (a battle's own win may bring lines and a rout: { lines, rout }, battle.js winBeats)
  if (v) { G.over = Object.assign({ win: true }, typeof v === 'object' ? v : {}); return { over: true, trig }; }
  return { over: false, trig };
}
// a new round: the battle's round hook runs first (磻溪's fire spreads), then the defeat check; returns what the hook did
export function startRound() {
  G.round++;
  const ev = (H.roundStart && H.roundStart(G)) || {};
  checkDefeat();
  return ev;
}
export function setupBattle(chosen) {
  const k0 = H.startRoom || 0;   // (a battle in rooms starts in the first; battle 17's hook puts it in room 2 before anyone moves, 0x0F3C50)
  if (D.rooms) { const r = D.rooms[k0]; D.mapW = r.w; D.mapH = r.h; D.terrain = r.terrain; D.chests = r.chests; D.chestTable = r.chestTable; MAP_W = r.w; MAP_H = r.h; }
  G.units = []; G.round = 0; G.terrain = D.terrain.map(r => r.slice()); G.over = null; G.triggerFired = false;
  G.chests = loadChests(D.chests, D.chestTable); G.found = [];
  const at = p => { const k = (D.party || []).findIndex(q => q.cid === p.cid); return k < 0 ? 99 : k; };
  [...chosen].sort((a, b) => at(a) - at(b))   // in roster order, whoever was picked first or forced (battle 8: 黃飛虎 on the north bank, (15, 13), where scene 15 leaves him; 楊戩 at (7, 21): the user's report)
    .forEach((p, i) => { const u = makeUnit(p, 'player', { slot: i }); [u.x, u.y] = D.deploy[i]; G.units.push(u); });   // slots 0.. in deploy order, as the ROM's
  for (const e of D.enemies) spawn(e);
  if (D.rooms) G.room = k0;
  if (H.setup) H.setup(G);
}
function spawn(e) {
  const side = e.side || 'enemy', u = makeUnit(e, side, { slot: e.slot, guest: e.guest, follow: e.follow });
  u.x = e.x; u.y = e.y; u.facing = e.facing || 'down';   // an enemy's from its record's +1 (data/battles: battle 1's escort left, the rest down)
  // the spawn loader [ROM 0x13354, a room's 0x1D7B0]: an AI 10 unit's zone is centred on the cell it starts on, whatever
  // its record says
  if (u.ai === 10) { setAiP(u, 0x34, u.x); setAiP(u, 0x35, u.y); }
  // ... a phantom (AI 0x83) and a unit of move type 6 or 7 keep their starting cell as their post (+0x3A, +0x3B: where a
  // phantom shows itself, where the fallen come back, revive); a phantom starts away, off the map
  if (u.ai === 0x83 || u.moveType === 6 || u.moveType === 7) { setAiP(u, 0x3a, u.x); setAiP(u, 0x3b, u.y); }
  if (u.ai === 0x83) { u.x = u.y = -1; u.away = true; }
  if (e.summon) { u.summon = e.summon; u.wake = e.wake; if (e.calls) u.calls = e.calls.slice(); }   // a summoner's or a phantom's call (AI 0x82, 0x83)
  G.units.push(u);
  return u;
}

// ---------------------------------------------------------------- rooms [ROM 0x1D52A]
// A battle fought through several maps (battle 10's cave, battle 11's training hall: D.rooms). Before each unit's turn
// its hook looks at the heroes (slots 0-9, in order): one standing on an exit (terrain 4 leads on, 3 back) takes the
// party to the next or the previous room. Returns +1, -1 or 0.
export function roomExit() {
  if (!D.rooms) return 0;
  for (const u of G.units.filter(v => v.side === 'player' && v.alive && v.slot < 10).sort((a, b) => a.slot - b.slot)) {
    const t = G.terrain[u.y] && G.terrain[u.y][u.x];
    if (t === 4 && G.room + 1 < D.rooms.length) return 1;
    if (t === 3 && G.room > 0) return -1;
  }
  return 0;
}
// into room k: its map; the heroes on its cells by slot (coming back, its back cells), facing down; its enemies spawned
// afresh (a room left and entered again is full again); its chests loaded afresh from its table, as the ROM's room change does
// (0x1D6F8, 0x1E42E: a chest opened before is closed again and holds its second item, loadChests);
// the round count back to 0
export function enterRoom(k, back = false) {
  const r = D.rooms[k];
  G.room = k; D.mapW = r.w; D.mapH = r.h; D.terrain = r.terrain; D.chests = r.chests; D.chestTable = r.chestTable; MAP_W = r.w; MAP_H = r.h;
  G.terrain = r.terrain.map(row => row.slice());
  const cells = (back ? r.back : r.fwd).cells;
  G.units = G.units.filter(u => u.side === 'player');
  for (const u of G.units) { if (!u.alive) continue; const c = cells[u.slot]; if (c) [u.x, u.y] = c; u.facing = 'down'; }
  for (const e of r.enemies) spawn(e);
  G.chests = loadChests(r.chests, r.chestTable);
  G.round = 0;
}
// a guest on the heroes' side (battles 6 and 7's 文王, side 'player', guest): no one commands him, his turn is his AI's
export const heroes = () => players().filter(u => !u.guest);
export const turnOrder = () => G.units.filter(u => u.alive && u.side !== 'npc').sort((a, b) => b.spd - a.spd);   // [ROM]

// ---------------------------------------------------------------- enemy AI [design]
function distanceField(u, targets) {
  const dist = new Map(), q = [];
  for (const t of targets) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const x = t.x + dx, y = t.y + dy; if (!inMap(x, y) || cost(u, x, y) >= 127) continue;
    dist.set(key(x, y), 0); q.push([x, y]);
  }
  while (q.length) {
    const [x, y] = q.shift(); const d0 = dist.get(key(x, y));
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue;
      const c = cost(u, nx, ny); if (c >= 127) continue;
      const k = key(nx, ny); if (dist.has(k) && dist.get(k) <= d0 + c) continue;
      dist.set(k, d0 + c); q.push([nx, ny]);
    }
  }
  return dist;
}
// the AI bytes of a unit's record: +33 is u.ai, +34.. its parameters (u.aip, from the ROM record; +34 is also u.aggro)
export const aiP = (u, k) => u.aip ? u.aip[k - 0x34] : k === 0x34 ? u.aggro : k === 0x35 ? 0 : 0xff;
export function setAiP(u, k, v) {
  if (!u.aip) u.aip = [u.aggro, 0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  u.aip[k - 0x34] = v; if (k === 0x34) u.aggro = v;
}
// dormant enemies [ROM 0x1E804, 0x1EA0C]: AI 7, and AI 8 (the same, after the camera has shown it), wake when a hero is
// within the record's +34 range; the AI becomes the record's +35 (0, chase the nearest hero, in the battles ported so
// far) and +34 takes +36. A battle's hook can wake them earlier (ai = 0).
export const dormant = u => u.side === 'enemy' && (u.ai === 7 || u.ai === 8);
export function wakes(u) {
  if (dormant(u)) {
    if (!players().some(p => manhattan(p, u) <= u.aggro)) return false;
    u.ai = aiP(u, 0x35); setAiP(u, 0x34, aiP(u, 0x36));
  }
  return true;
}
// the battle's turn hook [ROM header +34, called before every unit's turn at 0x1E7C0]: scripted lines and wake-ups;
// returns the lines to play ([{ who, text, unit }]) or null
export function beforeTurn(u) { return H.beforeTurn ? H.beforeTurn(G, u) : null; }
// a hook can end the heroes' round: their acted mark set (record byte +1 = 8; battle 14's lair, 0x0F2222) for this round
export const endHeroesRound = () => { for (const u of G.units) if (u.side === 'player') u.skipRound = G.round; };
export const skipsTurn = u => u.skipRound === G.round;

// ---------------------------------------------------------------- revival [ROM 0x1DAFC]
// the 13 cells tried round a spot, in the ROM's order [table 0x1D922]
export const AROUND = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
// 0x1DAFC(type): every fallen enemy (slots 10-29) of that move type comes back at its post (record +0x3A, +0x3B: its AI
// bytes 6-7) or the first of the 13 cells round it free and open to it, healed (HP and MP to their maxima); returns those
// who came back (battle 14's fire spirits, every third round)
export function revive(type) {
  const back = [];
  for (const u of G.units) {
    if (u.side !== 'enemy' || u.alive || u.moveType !== type || u.slot == null || u.slot < 10) continue;
    const px = aiP(u, 0x3a), py = aiP(u, 0x3b);
    const at = AROUND.map(([dx, dy]) => [px + dx, py + dy]).find(([x, y]) => inMap(x, y) && cost(u, x, y) < 127 && !unitAt(x, y));
    if (!at) continue;
    [u.x, u.y] = at; u.hp = u.mhp; u.mp = u.mmp; u.alive = true; u.status = { sleep: 0, seal: 0, poison: 0 }; u.buf = {}; back.push(u);
  }
  return back;
}

// ---------------------------------------------------------------- chests [ROM 0x1BA78, 0x1BAF2; table 0x168E]
// A hero opens a chest by picking its cell as the move target: it walks to a reachable cell next to it, faces it and
// opens it (0x117DE → 0x117FE). [design] A chest the map hides (no art, battle 1's 舍利子) is not a move target: a hero
// finds it only by standing next to it and attacking the empty-looking cell. Only heroes open chests. The item goes to the hero [design: to the bag when the hero
// already holds 8, or when it is equipment, which only the camp puts on]; the bag gets them after the battle.
export const MAX_HELD = 8;
export const chestAt = (x, y) => G.chests.find(c => !c.open && c.x === x && c.y === y);
export function chestTargets(u, r) {          // chest -> the cheapest reachable stop next to it
  const out = new Map(); if (u.side !== 'player') return out;
  for (const ch of G.chests) {
    if (ch.open || ch.hidden) continue;
    let best = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const n = r.get(key(ch.x + dx, ch.y + dy));
      if (n && n.stop && (!best || n.c < best.c)) best = n;
    }
    if (best) out.set(key(ch.x, ch.y), { chest: ch, from: best });
  }
  return out;
}
// an item given to a hero [ROM 0x13012]: into the first free hand, unless it is equipment or the hands are full: then
// the bag (G.found, after the battle); ids past the item table (0x24 on: battle 17's note) are nothing [ROM 0x0F4D8]
function give(u, id) {
  const it = D.items[id];
  if (!it) return null;
  if (!it.equip && u.items.length < MAX_HELD) u.items.push(id); else G.found.push(id);
  return it;
}
// a chest table loaded [ROM 0x1AFF6, at a battle's start and each room change]: every chest closed; one opened before
// (its bit, 7 - slot, set in the table's flag byte, ff3252 = G.chestFlags) holds its second item instead, `again` (byte 3:
// 金創藥 for nearly all: battle 12's 疾風種子 only the first time). The flags outlive the battle (campaign.js keeps them):
// the original clears the table's on a defeat (0x8CC) because a defeat there loses what was found; the remake's heroes
// keep it [the user's call], so the flags stay too and a chest's special item comes once
export function loadChests(list, table) {
  const f = (table != null && G.chestFlags && G.chestFlags[table]) || 0;
  return (list || []).map(c => ({ x: c.x, y: c.y, item: c.slot != null && (f >> (7 - c.slot)) & 1 && c.again != null ? c.again : c.item, hidden: !!c.hidden, open: false, table, slot: c.slot }));
}
export function openChest(u, ch) {
  ch.open = true; faceTo(u, ch.x, ch.y);
  if (ch.table != null && ch.slot != null) { G.chestFlags = G.chestFlags || {}; G.chestFlags[ch.table] = (G.chestFlags[ch.table] || 0) | (1 << (7 - ch.slot)); }   // [0x1BB58]
  return give(u, ch.item);
}
// an enemy's drop [ROM 0x21420, the action's casualties]: each enemy the action leaves at 0 HP hands the item it holds to
// the unit acting (0xFF0E18), the original's 「得到」 box and chime after (0x129B0, 0x12ABE); the end-of-battle rout's
// deaths hand nothing (0x1DA7C)
export function takeDrop(u, dead) {
  if (dead.side !== 'enemy' || dead.drop == null || u.side !== 'player') return null;
  const id = dead.drop; dead.drop = null;
  const it = give(u, id); return it ? { id, it } : null;
}
// AI 9 [ROM 0x1EE96]: go to the cell (+34, +35), attacking nothing on the way; there, the AI becomes +37 and +34-36
// take +38-3A (battle 2: the escort falls back to it and waits, dormant, for the hero to come near)
// AI 10 [ROM 0x1EFB0]: guard a zone: with a hero within +38 the AI becomes +39 (+34, +35 take +3A, +3B) and the unit
// acts on it at once; else it walks to a random free cell within +36 / +37 of (+34, +35) (battle 2's leader paces)
// AI 0x80+ [ROM 0x1BE90]: a caster's; with nothing to cast (no spell or the MP) it takes the AI in +34 for good
function toward(u, r, x, y) {   // the reachable stop nearest (x, y) by walking cost, or where it stands
  const df = distanceField(u, [{ x, y }]); let bc = null, bd = Infinity;
  for (const c of r.values()) { if (!c.stop) continue; const d = c.x === x && c.y === y ? -1 : df.has(key(c.x, c.y)) ? df.get(key(c.x, c.y)) : 999; if (d < bd || (d === bd && c.c < bc.c)) { bd = d; bc = c; } }
  return bc || r.get(key(u.x, u.y));
}
// the heroes' side's AI 9 [ROM 0x1DEE6, from the player turn at 0xA2C]: a guest goes to the cell (+34, +35) if a path
// leads there (walking it as below), and at it waits; with no path he follows the units listed at +36 (battle 6: 林雲, 燕蓉, 楊戩, by slot): for
// the first one alive, the four cells around them, behind first (by the way they face: table 0x1DE72), the first free,
// walkable one a path reaches (enemies bar the way, allies do not: 0xBFE0 mode 0, cost up to 50) is the target. He walks
// that path as far as his reach goes (0x1E060: while the next cell is one he may stop on) and his turn ends there, even
// short of a step; with no target he waits.
const BEHIND = { right: [[-1, 0], [0, 1], [0, -1], [1, 0]], left: [[1, 0], [0, -1], [0, 1], [-1, 0]],
  down: [[0, -1], [-1, 0], [1, 0], [0, 1]], up: [[0, 1], [1, 0], [-1, 0], [0, -1]] };
export function guestPath(u, tx, ty, limit = 50, through = false) {   // the cheapest way to (tx, ty) past allies, round enemies (mode 2: through them too), or null
  const best = new Map([[key(u.x, u.y), { c: 0, prev: null }]]), q = [[u.x, u.y]];
  while (q.length) {
    q.sort((a, b) => best.get(key(...a)).c - best.get(key(...b)).c);
    const [x, y] = q.shift(), cur = best.get(key(x, y));
    if (x === tx && y === ty) { const p = []; let k = key(x, y); while (k) { const [a, b] = k.split(',').map(Number); p.unshift([a, b]); k = best.get(k).prev; } return p; }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue;
      const c0 = cost(u, nx, ny); if (c0 >= 127) continue;
      const o = unitAt(nx, ny); if (o && o.side !== u.side && !through) continue;
      const c = cur.c + c0, k = key(nx, ny); if (c > limit || (best.has(k) && best.get(k).c <= c)) continue;
      best.set(k, { c, prev: key(x, y) }); q.push([nx, ny]);
    }
  }
  return null;
}
function guestPlan(u, r) {
  const stay = { cell: r.get(key(u.x, u.y)), kind: 'wait', r };
  const walk = p => { let cell = stay.cell; for (const [x, y] of p.slice(1)) { const c = r.get(key(x, y)); if (!c || !c.stop) break; cell = c; } return { cell, kind: 'wait', r }; };
  const gx = aiP(u, 0x34), gy = aiP(u, 0x35);
  if (u.x === gx && u.y === gy) return stay;
  const toGoal = guestPath(u, gx, gy, 150, true); if (toGoal) return walk(toGoal);   // (0xBFE0 mode 2: enemies do not bar it)
  for (const s of u.follow || []) {
    const h = G.units.find(v => v.slot === s && v.side === u.side && v.alive); if (!h) continue;
    for (const [dx, dy] of BEHIND[h.facing] || BEHIND.down) {
      const x = h.x + dx, y = h.y + dy;
      if (!inMap(x, y) || unitAt(x, y) || cost(u, x, y) >= 127) continue;
      const p = guestPath(u, x, y); if (p) return walk(p);
    }
  }
  return stay;
}
// AI 0x82 [ROM 0x0EFD06, from the turn dispatch at 0x1354]: a summoner (battle 11's 召喚師). Asleep until a hero comes
// within its record's +32 (u.wake; then that is cleared and it acts at once); awake, its count (+35) rises every turn and
// when it reaches +34 it starts over and calls up the record at +36 (u.summon, battle 11's 鬼靈) on the first of twelve
// cells round it (table 0x11268) that record may enter and no one holds, in the first free enemy slot (10-29), unless
// 19 enemies stand already (ff0a2b); it never moves or strikes. The newcomer acts from the next round (G.joined).
const RING = [[0, -1], [0, 1], [1, 0], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]];
// AI 0x83 [ROM 0x1EBDE, its call 0x0EFEF0 in the scene's own code]: a phantom (battle 12's 幻士). It is never on the map:
// asleep until a hero comes within its record's +32 of its post (then that is cleared and its calls count, +1C, set to 0);
// awake, its count (+35) rises every turn and when it passes +34 it starts over, and while its calls made are fewer than
// allowed (+1C < +1B, two more each time) it shows itself on the first free cell round its post (0x11266: the post, then
// the twelve of 0x11268), calls up two of the record at +36 (u.summon, battle 12's 雷角獸) on the first free cells round
// itself that record may enter, in the first free enemy slots (10-29; a fallen unit of move type 6 or 7 keeps its slot),
// and is gone again; nothing while 19 enemies stand (ff0a2b). The plan's `appear` is the cell it showed itself on.
const APPEAR = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]];
function phantom(u, r) {
  const stay = { cell: r.get(key(u.x, u.y)), kind: 'wait', r }, px = aiP(u, 0x3a), py = aiP(u, 0x3b);
  if (u.wake) { if (players().some(p => p.slot < 10 && Math.abs(p.x - px) + Math.abs(p.y - py) <= u.wake)) { u.wake = 0; u.calls[0] = 0; } else return stay; }
  if (G.units.filter(v => v.alive && v.side === 'enemy').length >= 19) return stay;
  const n = aiP(u, 0x35) + 1; setAiP(u, 0x35, n); if (aiP(u, 0x34) >= n) return stay;
  setAiP(u, 0x35, 0);
  if (u.calls[0] >= u.calls[1]) return stay;
  u.calls[0] += 2;
  const at = APPEAR.map(([dx, dy]) => [px + dx, py + dy]).find(([x, y]) => inMap(x, y) && !unitAt(x, y) && D.costs[u.moveType][G.terrain[y][x]] < 127);
  if (!at) return stay;
  const sm = u.summon, c = D.costs[sm.moveType]; let made = 0;
  for (const [dx, dy] of APPEAR.slice(1)) {
    if (made >= 2) break;
    const x = at[0] + dx, y = at[1] + dy; if (!inMap(x, y) || unitAt(x, y) || c[G.terrain[y][x]] >= 127) continue;
    let s = 10; while (s < 30 && G.units.some(v => v.slot === s && (v.alive || v.moveType === 6 || v.moveType === 7))) s++;
    if (s >= 30) break;
    for (const v of G.units) if (!v.alive && v.slot === s) v.slot = null;
    const v = makeUnit(Object.assign({ exp: 0, items: [] }, sm), 'enemy', { slot: s }); v.x = x; v.y = y; v.facing = 'down';
    G.units.push(v); (G.joined || (G.joined = [])).push(v); made++;
  }
  return Object.assign(stay, { appear: at });
}
function summoner(u, r) {
  const stay = { cell: r.get(key(u.x, u.y)), kind: 'wait', r };
  if (u.wake) { if (players().some(p => manhattan(p, u) <= u.wake)) u.wake = 0; else return stay; }
  if (G.units.filter(v => v.alive && v.side === 'enemy').length >= 19) return stay;
  const n = aiP(u, 0x35) + 1; setAiP(u, 0x35, n); if (aiP(u, 0x34) > n) return stay;
  setAiP(u, 0x35, 0);
  const sm = u.summon, c = D.costs[sm.moveType];
  for (const [dx, dy] of RING) {
    const x = u.x + dx, y = u.y + dy; if (!inMap(x, y) || unitAt(x, y) || c[G.terrain[y][x]] >= 127) continue;
    let s = 10; while (s < 30 && G.units.some(v => v.alive && v.slot === s)) s++;
    if (s >= 30) break;
    for (const v of G.units) if (!v.alive && v.slot === s) v.slot = null;
    const v = makeUnit(Object.assign({ exp: 0, items: [] }, sm), 'enemy', { slot: s }); v.x = x; v.y = y; v.facing = 'down';
    G.units.push(v); (G.joined ||= []).push(v); G.summoned = (G.summoned || 0) + 1;
    break;
  }
  return stay;
}
function aiScript(u, r) {
  if (u.side === 'player' && u.guest && u.ai === 9) return guestPlan(u, r);
  if (u.side !== 'enemy') return null;
  if (u.ai === 10) {
    if (players().some(p => manhattan(p, u) <= aiP(u, 0x38))) { u.ai = aiP(u, 0x39); setAiP(u, 0x34, aiP(u, 0x3a)); setAiP(u, 0x35, aiP(u, 0x3b)); }
    else {
      const cx = aiP(u, 0x34), cy = aiP(u, 0x35), dx = aiP(u, 0x36), dy = aiP(u, 0x37);
      for (let tries = 0; tries < 40; tries++) {
        const x = dx ? Math.max(0, cx - dx) + rand128() % (dx * 2 + 1) : cx, y = dy ? Math.max(0, cy - dy) + rand128() % (dy * 2 + 1) : cy;
        if (!inMap(x, y) || cost(u, x, y) >= 127) continue;
        const o = unitAt(x, y); if (o && o !== u) continue;
        return { cell: toward(u, r, x, y), kind: 'wait', r };
      }
      return { cell: r.get(key(u.x, u.y)), kind: 'wait', r };
    }
  }
  if (u.ai === 0x82 && u.summon) return summoner(u, r);
  if (u.ai === 0x83 && u.summon) return phantom(u, r);
  if (u.ai >= 0x80 && !u.spells.some(i => D.spells[i] && D.spells[i].mp <= u.mp)) u.ai = aiP(u, 0x34);
  if (u.ai === 9) {
    const gx = aiP(u, 0x34), gy = aiP(u, 0x35), cell = toward(u, r, gx, gy);
    if (cell.x === gx && cell.y === gy) { u.ai = aiP(u, 0x37); setAiP(u, 0x34, aiP(u, 0x38)); setAiP(u, 0x35, aiP(u, 0x39)); setAiP(u, 0x36, aiP(u, 0x3a)); }
    return { cell, kind: 'wait', r };
  }
  return null;
}
export function planAction(u, opts) {
  const r = reach(u), scripted = aiScript(u, r); if (scripted) return scripted;
  const stops = [...r.values()].filter(c => c.stop);
  const targets = foes(u);
  const heal = u.spells.map(i => D.spells[i]).find(sp => sp.kind === 12 && sp.pow > 0 && sp.mp <= u.mp);
  // heals: an enemy only as a healer, AI 0x81 [ROM 0x1C016]; the regular AIs (0-8, the table at 0x1ED0E) only move and
  // strike (battle 5's archers carry 歸元 but heal only once a beat makes them 0x81)
  if (heal && !u.status.seal && (u.side !== 'enemy' || u.ai === 0x81)) {
    const hurtAllies = allies(u).filter(a => a.mhp - a.hp >= 10);
    for (const c of stops) for (const a of hurtAllies) if (cellsInShape(c.x, c.y, heal.range).some(([x, y]) => x === a.x && y === a.y)) return { cell: c, kind: 'spell', sp: heal, at: [a.x, a.y], r };
  }
  // the caster [ROM 0x1BE90]: AI 0x80-0x84 with its first spell and the MP for it: with a hero in its reach it casts,
  // but a third of the time (0x84: never) fights this turn by the AI in +34; with none in reach it closes in without
  // striking (0x1BF54). 0x81 heals (above) or fights by +34 [ROM 0x1C016]; with no MP left aiScript set +34 for good.
  if (u.side === 'enemy' && u.ai >= 0x80 && u.ai !== 0x81 && u.ai !== 0x85 && !u.status.seal) {
    const sp = D.spells[u.spells[0]];
    if (sp && sp.kind === 13 && sp.mp <= u.mp) {
      let cast = null;
      for (const c of stops) for (const [x, y] of cellsInShape(c.x, c.y, sp.range)) {
        const t = targets.find(v => v.x === x && v.y === y); if (!t) continue;
        const score = (spellPower(u, sp) >= t.hp ? 1000 : 0) - t.hp - c.c;
        if (!cast || score > cast.score) cast = { cell: c, kind: 'spell', sp, at: [t.x, t.y], score, r };
      }
      if (!cast && targets.length) { const df = distanceField(u, targets); let bc = null, bd = Infinity;
        for (const c of stops) { const d = df.has(key(c.x, c.y)) ? df.get(key(c.x, c.y)) : 999; if (d < bd || (d === bd && c.c < bc.c)) { bd = d; bc = c; } }
        return { cell: bc || r.get(key(u.x, u.y)), kind: 'wait', r }; }
      if (cast && (u.ai === 0x84 || rand128() % 3)) return cast;
    }
  }
  // AI 6 [ROM 0x20386]: the heroes ranked by HP (record +26), not by distance as AI 0: it goes for the weakest
  const effAi = u.ai >= 0x80 ? aiP(u, 0x34) : u.ai, weakFirst = u.side === 'enemy' && effAi === 6;
  let best = null;
  for (const c of stops) for (const [x, y] of cellsInShape(c.x, c.y, u.rangeShape)) {
    const t = targets.find(v => v.x === x && v.y === y); if (!t) continue;
    const dmg = Math.max(1, u.atk - t.df);
    const score = (dmg >= t.hp ? 1000 : 0) + (weakFirst ? -t.hp * 3 : (t.cid === HERO_CID ? 40 : 0) - t.hp) - c.c;
    if (!best || score > best.score) best = { cell: c, kind: 'attack', target: t, score, r };
  }
  const goal = opts && opts.rescue && u.side === 'player' && u.moveType === 3 && H.goal ? H.goal(G) : null;   // sim option: fliers head for the battle's goal
  if (best && !goal) return best;
  if (!targets.length && !goal) return { cell: r.get(key(u.x, u.y)), kind: 'wait', r };
  const df = distanceField(u, goal || (weakFirst ? [targets.reduce((a, b) => b.hp < a.hp ? b : a)] : targets));
  let bc = null, bd = Infinity;
  for (const c of stops) { const d = df.has(key(c.x, c.y)) ? df.get(key(c.x, c.y)) : 999; if (d < bd || (d === bd && c.c < bc.c)) { bd = d; bc = c; } }
  return { cell: bc || r.get(key(u.x, u.y)), kind: 'wait', r };
}
