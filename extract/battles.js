// The battles and the shared game tables, from the player's cartridge (ports of tools/rom/dump.py's battle index,
// battle.py and export.py). Writes, as the Python pipeline did:
//   data/common.js            window.COMMON: names, hero templates and growth, spells, items, move costs, tables
//   data/battles/NN.js        window.BATTLES[n]: map, terrain, deploy, enemies, chests, conditions, scene lines
//   assets/battles/NN/map.png the map art (32 px a cell)
//   assets/units/<gfx>.png    each unit graphic's 9-frame sheet
import { MD } from './md.js';
import { s, score, walk as walkScenes } from './text.js';
import { image, cramRGB } from './png.js';

const UNIT_KEYS = ['cid', 'lv', 'atk', 'df', 'spd', 'hp', 'mhp', 'exp', 'mp', 'mmp', 'moveType', 'move', 'rangeShape', 'items', 'spells', 'ai', 'aggro', 'gfx', 'anim'];

// ---------------------------------------------------------------- dump.py: the 32 battles' index
export function battleIndex(R) {
  const T = []; for (let i = 0x1d8e; i < 0x200e; i += 4) T.push(R.L(i));
  const H = []; T.forEach((h, i) => { if (i >= 95 && h !== 0x582e) H.push([i - 95, h]); });
  const cond = []; let i = 0xe8000;
  while (i < 0xfe400) {
    const b = R.B(i);
    if (b >= 0xf0 && b <= 0xf6) {
      const e = R.find([0xff], i);
      if (e - i > 1 && e - i < 80 && score(R, i, e) > 0.95) {
        const t = s(R, i)[0];
        if (t && (t.match(/□/g) || []).length <= 1) { cond.push([i, t]); i = e + 1; continue; }
      }
    }
    i++;
  }
  return H.map(([si, h], n) => {
    const dep = [];
    for (let k = 0; k < 10; k++) { const x = R.B(h + 2 * k), y = R.B(h + 2 * k + 1); if (x !== 0xff && !(k && x === 0 && y === 0)) dep.push([x, y]); }
    const prev = n ? H[n - 1][1] : 0xe8000, cs = cond.filter(([a]) => prev < a && a < h).map(([, t]) => t);
    const k = cs.findIndex(t => t.startsWith('勝利條件')), rest = cs.slice(k + 1), j = rest.findIndex(t => t.startsWith('敗北條件'));
    return { n: n + 1, scene: si, header: h.toString(16).padStart(6, '0'), name: cs[k - 1], win: rest.slice(0, j),
      lose: rest.slice(j + 1).filter(t => t.endsWith('亡') || t.endsWith('滅')), deploy: dep };
  });
}

// ---------------------------------------------------------------- battle.py
const pairs = (b, o) => { const out = []; for (let k = 0; k < 8; k++) if (b[o + k] !== 0xff) out.push(b[o + k]); return out; };
const be16 = (b, o) => b[o] << 8 | b[o + 1], be32 = (b, o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
const hexOf = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
export function rec(b) {
  return { cid: b[0xe], lv: b[0x22], atk: b[0x23], df: b[0x24], spd: b[0x25], hp: be16(b, 0x26), mhp: be16(b, 0x28), exp: b[0x2a],
    mp: be16(b, 0x2c), mmp: be16(b, 0x2e), moveType: b[0x10], move: b[0x11], rangeShape: b[0x31] !== 0xff ? b[0x31] >> 4 : 0,
    items: pairs(b, 0x12), spells: pairs(b, 0x1a), ai: b[0x33], aggro: b[0x34], gfx: be32(b, 6), anim: be32(b, 10), raw: hexOf(b) };
}
// a battle map: idx = map table 0x1586 index (op 0), or d = a descriptor (op 13): block grid, block table, tile art (to
// tile 0x200), packed terrain, 2 palette lines; the art and terrain unpacked by the game's own routines
export function mapOf(R, rom, idx, d = null, ptrs = null) {   // ptrs: the five pointers themselves (a room's, below)
  d = d || (ptrs ? 0 : R.L(0x1586 + 4 * idx));
  const [grid, blocks, art, terr, pal] = (ptrs || [0, 1, 2, 3, 4].map(k => R.L(d + 4 * k))).map(p => R.L(p));
  const w = R.B(grid), h = R.B(grid + 1);
  const m = new MD(rom); m.reg[15] = 2;
  m.call(0x5af6, [art, 0x200]); m.call(0x6bce, [0xff139a, terr]);
  const terrain = []; for (let y = 0; y < h; y++) terrain.push(Array.from(m.ram.subarray(0x139a + y * w, 0x139a + y * w + w)));
  const rgb = Array.from({ length: 32 }, (_, i) => cramRGB(R.W(pal + 2 * i)));
  const img = image(w * 32, h * 32, 3), V = m.vram;
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const b = R.B(grid + 2 + by * w + bx);
    for (let k = 0; k < 16; k++) {
      const e = R.W(blocks + b * 32 + 2 * k), t = e & 0x7ff, hf = e & 0x800, vf = e & 0x1000, line = ((e >> 13) & 1) * 16, ty = k >> 2, tx = k & 3;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const sx = hf ? 7 - x : x, sy = vf ? 7 - y : y, byte = V[t * 32 + sy * 4 + (sx >> 1)], p = sx & 1 ? byte & 15 : byte >> 4;
        const c = rgb[line + p], o = ((by * 32 + ty * 8 + y) * w * 32 + bx * 32 + tx * 8 + x) * 3;
        img.px[o] = c[0]; img.px[o + 1] = c[1]; img.px[o + 2] = c[2];
      }
    }
  }
  const grows = []; for (let y = 0; y < h; y++) grows.push(R.list(grid + 2 + y * w, w));
  return [{ index: idx, w, h, grid: grows, terrain, addr: { grid, blocks, art, terrain: terr, palette: pal } }, img];
}
// rooms: a battle fought through several maps (battle 10's cave, battle 11's training hall). Its turn hook points ff0f90
// at a table of room records [0x0ED9B0, 0x0EEF6A]; when a hero stands on an exit (terrain 4: on, 3: back) the routine at
// 0x1D52A loads the next or the previous room. A record: the heroes' cells by slot (10 pairs) and the camera's cell,
// coming forward (+0) and coming back (+0x16); the grid, blocks, art and terrain (+0x2C: pointers to pointers); the
// chest table's index (+0x3C, 0x1AFF6); the palette (+0x3E); the enemies (+0x42: 8 bytes each, x, y, item, -, template;
// to 0xFFFF), spawned afresh each time the room is entered
export function roomsOf(R, rom, turn) {
  // the table goes in ff0f90; a handler per room follows, picked by the room's number (ff0f4f) from the table the hook
  // then takes (lea abs.l, a0): as many rooms as handlers
  let t = -1, a = turn; for (; a < turn + 64; a += 2) if (R.W(a) === 0x23fc && R.L(a + 6) === 0xff0f90) { t = R.L(a + 2); break; }
  if (t < 0) return null;
  while (a < turn + 64 && R.W(a) !== 0x41f9) a += 2;
  const recs = [], isRec = r => r >= 0x200 && r < 0x100000 && !(r & 1) && R.L(r + 0x2c) >= 0x200 && R.L(r + 0x2c) < 0x400000;
  if (R.W(a) === 0x41f9) { const code = R.L(a + 2); for (let k = 0; ; k++) { const c = R.L(code + 4 * k); if (c < 0x200 || c >= 0x100000 || c & 1) break; recs.push(R.L(t + 4 * k)); } }
  else for (let k = 0; isRec(R.L(t + 4 * k)); k++) recs.push(R.L(t + 4 * k));   // one handler for every room (battle 18, 0x0F4986): the table's run of room records
  if (!recs.length) return null;
  return recs.map((r, room) => {
    const side = b => ({ cells: Array.from({ length: 10 }, (_, k) => [R.B(b + 2 * k), R.B(b + 2 * k + 1)]).filter(([x]) => x !== 0xff), cam: [R.B(b + 20), R.B(b + 21)] });
    const ptrs = [0, 1, 2, 3].map(k => R.L(r + 0x2c + 4 * k)).concat([R.L(r + 0x3e)]), [map, img] = mapOf(R, rom, null, null, ptrs);
    const spawns = []; for (let a = r + 0x42; R.W(a) !== 0xffff; a += 8) {
      const tp = R.L(a + 4), u = rec(R.bytes(tp, 64));
      spawns.push(Object.assign(u, { x: R.B(a), y: R.B(a + 1), item: R.B(a + 2) === 0xff ? null : R.B(a + 2), template: tp }));
    }
    return { room, addr: r, fwd: side(r), back: side(r + 0x16), chestTable: R.W(r + 0x3c), map, img, enemies: spawns };
  });
}
export function extractBattle(R, rom, n, walk, index) {
  const b = index[n - 1], si = b.scene, h = R.L(0x1f0a + 4 * si), sc = walk[si];
  if (h !== parseInt(b.header, 16)) throw new Error('battle ' + n + ': header mismatch');
  const spawns = []; let a = h + 46;
  while (R.W(a) !== 0xffff) {
    const t = R.L(a + 4), u = rec(R.bytes(t, 64));
    Object.assign(u, { x: R.B(a), y: R.B(a + 1), item: R.B(a + 2) === 0xff ? null : R.B(a + 2), template: t });
    spawns.push(u); a += 8;
  }
  const ops = sc.ops, bi = ops.findIndex(o => o.op === 10);
  const maps = ops.slice(0, bi).filter(o => o.op === 0 || o.op === 13).map(o => o.op === 0 ? [o.mapIndex, null] : [null, R.L(o.at + 2)]);
  const [mp, img] = mapOf(R, rom, ...maps[maps.length - 1]);
  return { n, name: b.name, scene: si, chapter: sc.chapter, win: b.win, lose: b.lose, deploy: b.deploy, header: h, music: R.W(h + 20),
    camera: [R.B(h + 22), R.B(h + 23)], partyTable: R.W(h + 32),
    hooks: { ff3226: R.L(h + 24), ff322a: R.L(h + 28), turn: R.L(h + 34), frame: R.L(h + 42) }, text: R.L(h + 38),
    map: mp, party: { deployMax: ops[bi].deployMax, flags: ops[bi].heroFlags }, enemies: spawns, scene_ops: ops, img, rooms: roomsOf(R, rom, R.L(h + 34)) };
}

// ---------------------------------------------------------------- export.py
export function sheetImage(R, gfx, frames = 9) {   // a unit graphic's 9 frames, 32 px each, unit palette (CRAM line 2), RGBA
  const rgb = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(0x38436 + 2 * i)));
  const img = image(32 * frames, 32, 4);
  for (let f = 0; f < frames; f++) for (let t = 0; t < 16; t++) {
    const a = gfx + f * 512 + t * 32, tx = t >> 2, ty = t & 3;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const byte = R.B(a + y * 4 + (x >> 1)), p = x & 1 ? byte & 15 : byte >> 4, o = ((ty * 8 + y) * 32 * frames + f * 32 + tx * 8 + x) * 4;
      img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = p ? 255 : 0;
    }
  }
  return img;
}
const names = R => Array.from({ length: 73 }, (_, i) => s(R, R.L(0x39c86 + 4 * i))[0]);
const growth = (R, cid) => { const p = R.L(0x3bbee + 4 * cid); return Array.from({ length: 99 }, (_, lv) => R.list(p + 6 * lv, 6)); };
// the spells, items and their menu texts (records led by their bank byte; descriptions with full-width digits)
const FW = t => t.replace(/[0-9]/g, d => String.fromCharCode(0xFF10 + +d));
export function spells(R) {
  return Array.from({ length: 0x3a }, (_, i) => { const e = R.bytes(0x3e37e + 12 * i, 12);
    return { id: i, name: s(R, 0x1b236e + 9 * i, 20)[0].replace(/　+$/, ''), range: e[0], area: e[1], side: e[2], kind: e[3], mp: be16(e, 4), pow: be16(e, 6) }; });
}
export function items(R) {
  return Array.from({ length: 0x24 }, (_, i) => { const e = R.bytes(0x377cc + 14 * i, 14);
    return { id: i, name: s(R, 0x1b1fa2 + 9 * i, 20)[0].replace(/　+$/, ''), range: e[0], area: e[1], side: e[2], kind: e[3], equip: e[4], stat: e[5], pow: be16(e, 8) }; });
}
export const itemDesc = R => Array.from({ length: 0x24 }, (_, i) => FW(s(R, 0x1b20e6 + 18 * i, 40)[0].replace(/^　+|　+$/g, '')));
export function common(R, sheets) {
  const NAMES = names(R), word = i => s(R, R.L(0x39c86 + 4 * i))[0], heroes = [];
  for (let cid = 0; cid < 12; cid++) {
    const t = R.L(0x1d8e + 4 * cid), b = R.bytes(t, 64);
    heroes.push({ cid, name: NAMES[cid], template: t, lv: b[0x22], items: pairs(b, 0x12), spells: pairs(b, 0x1a),
      cls: word(77 + b[0x0f]), elem: b[0x10] < 4 ? word(73 + b[0x10]) : '', moveType: b[0x10], move: b[0x11],
      rangeShape: b[0x31] !== 0xff ? b[0x31] >> 4 : 0, gfx: be32(b, 6), anim: be32(b, 10), growth: growth(R, cid) });
    sheets.add(be32(b, 6));
  }
  const ct = R.bytes(0x38476, 2 + 2 * 7 * 21);
  const shape = (a, n) => Array.from({ length: n }, (_, k) => [(R.B(a + 2 * k) << 24) >> 24, (R.B(a + 2 * k + 1) << 24) >> 24]);
  return { names: NAMES, heroes, spells: spells(R), items: items(R), itemDesc: itemDesc(R),
    costs: Array.from({ length: 21 }, (_, mt) => Array.from({ length: 7 }, (_, t) => ct[2 + mt * 14 + 2 * t])),
    missTable: R.list(0xf8a6, 9), critTable: R.list(0xf8af, 9),
    expTable: Array.from({ length: 12 }, (_, k) => R.W(0x12406 + 4 * k)),   // the immediates the routine at 0x12372 lays out
    shapes: { s0: shape(0x11166, 4), s1: shape(0x11186, 8) } };
}
const line = op => { const t = op.text, k = t.indexOf('：'); return { who: k >= 0 ? t.slice(0, k) : '', text: k >= 0 ? t.slice(k + 1) : t, speaker: op.speaker, actor: op.actor }; };
function walkUpto(walk, scene) {   // hero joins (ops 35 / 42) since the previous battle, up to this one's start
  const heads = walk.filter(x => x.header && x.scene < scene).map(x => x.scene), prev = Math.max(-1, ...heads), out = [];
  for (const x of walk.slice(prev + 1, scene + 1)) {
    let ops = x.ops;
    if (x.scene === scene) { const k = ops.findIndex(o => o.op === 10); ops = ops.slice(0, k < 0 ? ops.length : k); }
    out.push(ops.filter(o => 'join' in o).map(o => o.join));
  }
  if (prev >= 0) { const ops = walk[prev].ops, k = ops.findIndex(o => o.op === 10); out.unshift(ops.slice(k + 1).filter(o => 'join' in o).map(o => o.join)); }
  return out;
}
// a chest table's chests [table 0x168E: 8 slots of x, y, item, again]: `again` is what the chest holds once it has been
// opened before (its bit, 7 - slot, in the table's flag byte ff3252: the loader 0x1AFF6 takes byte 3 then, 0x1BB58 sets it)
const chestsOf = (R, t) => { const out = []; for (let k = 0; k < 8; k++) { const c = R.bytes(0x168e + 32 * t + 4 * k, 4); if (c[0] !== 0xff) out.push({ x: c[0], y: c[1], item: c[2], again: c[3], slot: k }); } return out; };
// a chest the map's art draws: its cell's block shares tiles with the chest the art keeps at its bottom-left corner (the
// chest tiles' own block); one sharing none is hidden, found only by striking its cell (every battle's chests, its own
// map's and its rooms')
const drawnChest = (R, m, c) => { const tiles = k => Array.from({ length: 16 }, (_, i) => R.W(m.addr.blocks + k * 32 + 2 * i)), icon = tiles(m.grid[m.h - 1][0]);
  return !!m.grid[c.y] && m.grid[c.y][c.x] != null && tiles(m.grid[c.y][c.x]).some(v => icon.includes(v)); };   // (a cell off the room's map: hidden)
const FACING = { 0: 'down', 8: 'up', 0x10: 'left', 0x18: 'right' };   // a unit record's +1 (table 0x1DE72)
const enemiesOut = (list, NAMES, sheets, R = null, RS = R) => list.map(e => {   // R: with the attack type (+0x2B; a room's, data/actions.js has the battle's own); RS: with a summoner's call
  const u = {}; for (const k of UNIT_KEYS) u[k] = e[k];
  if (R) u.atkType = R.B(e.template + 0x2b);
  if (RS && (e.ai === 0x82 || e.ai === 0x83)) {   // a summoner (AI 0x82, 0x0EFD06) or a phantom (AI 0x83, 0x1EBDE): its waking range (+32) and the record it calls up (+36)
    const t = RS.L(e.template + 0x36), sm = rec(RS.bytes(t, 64)), v = {}; for (const k of UNIT_KEYS) v[k] = sm[k];
    if (e.ai === 0x83) u.calls = [RS.B(e.template + 0x1c), RS.B(e.template + 0x1b)];   // a phantom's calls: made and allowed, two units each (+1C, +1B)
    u.wake = RS.B(e.template + 0x32); u.summon = Object.assign(v, { name: NAMES[sm.cid], sprite: sm.gfx.toString(16).padStart(6, '0'), atkType: RS.B(t + 0x2b), aip: Array.from(RS.bytes(t + 0x34, 8)), template: t });
    sheets.add(sm.gfx);
  }
  Object.assign(u, { x: e.x, y: e.y, name: NAMES[e.cid], sprite: e.gfx.toString(16).padStart(6, '0') });
  u.aip = Array.from(Buffer_from_hex(e.raw).subarray(0x34, 0x3c));
  u.facing = FACING[Buffer_from_hex(e.raw)[1]] || 'down';   // where it faces as the battle opens: its record's +1, copied whole by the spawn loader (0x13322)
  if (e.item !== null) u.drop = e.item;
  sheets.add(e.gfx); return u;
});
export function exportBattle(R, b, walk, sheets) {
  const hide = m => c => drawnChest(R, m, c) ? c : Object.assign(c, { hidden: true });   // (the battle's own map as its rooms')
  const NAMES = names(R), enemies = enemiesOut(b.enemies, NAMES, sheets, null, R), chests = chestsOf(R, b.partyTable).map(hide(b.map));
  const ops = b.scene_ops, cut = ops.findIndex(o => o.op === 10), f = b.party.flags;
  const party = { deployMax: b.party.deployMax, forced: [...Array(12).keys()].filter(c => f[c] === 2), unavailable: [...Array(12).keys()].filter(c => f[c] === 1),
    joins: walkUpto(walk, b.scene).flat().map(j => ({ cid: j, lv: R.B(R.L(0x1d8e + 4 * j) + 0x22) })) };
  const say = part => part.filter(o => o.op === 4 || o.op === 55).map(line);
  const rooms = b.rooms && b.rooms.map(r => ({ w: r.map.w, h: r.map.h, terrain: r.map.terrain, fwd: r.fwd, back: r.back, chestTable: r.chestTable,
    chests: chestsOf(R, r.chestTable).map(hide(r.map)), enemies: enemiesOut(r.enemies, NAMES, sheets, R), rom: r.addr.toString(16).padStart(6, '0') }));
  return { n: b.n, name: b.name, chapter: b.chapter, scene: b.scene, win: b.win, lose: b.lose, mapW: b.map.w, mapH: b.map.h, terrain: b.map.terrain,
    deploy: b.deploy, camera: b.camera, music: b.music, party, enemies, chests, chestTable: b.partyTable, intro: say(ops.slice(0, cut)), outro: say(ops.slice(cut + 1)),
    rom: { header: b.header.toString(16).padStart(6, '0'), hooks: Object.fromEntries(Object.entries(b.hooks).map(([k, v]) => [k, v.toString(16).padStart(6, '0')])) },
    ...(rooms ? { rooms } : {}) };
}
function Buffer_from_hex(h) { const out = new Uint8Array(h.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(2 * i, 2), 16); return out; }

// everything above, as files: { path: string | image }
export function run(R, rom, files, log = () => {}) {
  const walk = walkScenes(R), index = battleIndex(R), sheets = new Set();
  const C = common(R, sheets);
  files['data/common.js'] = '// shared game tables: generated by the extractor from the player\'s ROM.\nwindow.COMMON = ' + JSON.stringify(C) + ';\n';
  const battles = {};
  for (let n = 1; n <= 32; n++) {
    const b = extractBattle(R, rom, n, walk, index), out = exportBattle(R, b, walk, sheets);
    battles[n] = b;
    files['assets/battles/' + String(n).padStart(2, '0') + '/map.png'] = b.img;
    const own = r => r.room === 0 && (r.map.addr.grid === b.map.addr.grid || (b.rooms[1] && b.rooms[1].addr === r.addr));   // room 0: the battle's own map, or a stand-in for the next (battles 14, 15, 18); not battle 17's, a room of its own
    for (const r of b.rooms || []) if (!own(r)) files['assets/battles/' + String(n).padStart(2, '0') + '/room-' + r.room + '.png'] = r.img;
    files['data/battles/' + String(n).padStart(2, '0') + '.js'] = '// battle ' + n + ' ' + b.name + ': generated by the extractor from the player\'s ROM.\n(window.BATTLES ||= {})[' + n + '] = ' + JSON.stringify(out) + ';\n';
    log('battle ' + n);
  }
  for (const g of sheets) files['assets/units/' + g.toString(16).padStart(6, '0') + '.png'] = sheetImage(R, g);
  return { walk, index, battles, sheets, common: C };
}
