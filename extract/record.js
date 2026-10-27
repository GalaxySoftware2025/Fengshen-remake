// Story scenes recorded by running the game's own scene interpreter (0x81E) in the emulator (a port of tools/rom/record.py).
// The sound driver is stubbed, dialogue boxes are skipped (their text is decoded statically: extract/text.js) and so is
// the battle op (10), so the post-battle script plays straight on. Every frame logs:
//   - the camera (ff0020 / ff0022, in 8 px units)
//   - each unit sprite (sprite table entry 31 + unit, RAM 0xFFF0F8, until op 25 swaps two entries): map position, the
//     unit's graphics (+6 in its 64-byte record), which of its 9 frames VRAM shows, h-flip
//   - every op dispatched (at the interpreter's jsr (a0), 0x872), with the frame it started on
//   - drawn: every 32x32 sprite the hardware draws on the 256x224 screen (map position, sheet and frame by its tiles)
//   - props: 16x16 sprites known by their tiles (伯邑考's jade)
import { tables, SIZE } from './text.js';

const STUB = 0x3FFF00;
const SKIP = [[4, 6], [55, 6], [10, 18], [41, 4]];   // opcode -> length: stepped over (addi.l #n, $ff0f7c ; rts); 41 waits on input
export const PROLOGUE = 0x2cd8, HALT = 0x3FFF80, TITLE = 0x3640;
const NATIVE_CARDS = [0x44ca, 0x490e, 0xe875a];
export const PART2 = 0x403e, PART2_END = 0x40a0;

export function stubs(m) {
  const w = (a, bytes) => m.rom.set(bytes, a);
  w(0x1e4100, [0x4e, 0x75]); w(0x1e41d4, [0x4e, 0x75]);   // the sound tick / play: rts
  SKIP.forEach(([op, n], k) => {
    const a = STUB + 16 * k;
    w(a, [0x06, 0xb9, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, 0x00, 0xff, 0x0f, 0x7c, 0x4e, 0x75]);
    w(0x149e + 4 * op, [a >>> 24, (a >> 16) & 255, (a >> 8) & 255, a & 255]);
  });
}

// a 512-byte tile block -> a number (FNV-1a), for looking sheets up by what VRAM shows
function hash(u8, a, n) { let h = 0x811c9dc5; for (let i = 0; i < n; i++) { h ^= u8[a + i]; h = Math.imul(h, 0x01000193); } return h >>> 0; }
const eq = (A, a, B, b, n) => { for (let i = 0; i < n; i++) if (A[a + i] !== B[b + i]) return false; return true; };
// native cuts that unpack a one-frame pose to RAM 0xFFA000 and point a unit's record at it (0x0F733C: scene 43's 伯邑考,
// the graphic whose pointer table is at 0x0802C2; 0x0F7B90: scene 45's 文王, 0x06926A): such a unit is recorded under
// that table's address as its sheet (record.py the same; extract/natives.js poseSheet makes the sheet)
const POSE_BUF = 0xffa000, CUT_POSES = { 0x0f733c: 0x0802c2, 0x0f7b90: 0x06926a, 0x0f9bd8: 0x05339c };   // (0x0F9BD8: scene 54's 燕蓉 kneeling as her memory comes back)

// The state every recording starts from: the console booted to the title (the prologue and the demo at 0x7C8 / 0x7E0
// skipped, as title.py does), with the few RAM words the Python recordings' snapshot (the 磻溪 camp of a played game) had
// otherwise and the scenes depend on: the frame counters (walk-cycle phase), ff0ea4-ea7 and four words at ff0f48-ff0f6b.
// Found by delta debugging over every scene; with them the recordings match the Python ones.
const PLAYED = [[0x0016, 6], [0x001b, 6], [0x0ea4, 0x61], [0x0ea7, 2], [0x0f49, 1], [0x0f4a, 0x43], [0x0f4b, 0xe8], [0x0f62, 0xff], [0x0f63, 0xfd], [0x0f6a, 0xff], [0x0f6b, 0xfd]];
export function bootState(MD, rom) {
  const m = new MD(rom); m.extra = new Uint8Array(0x400000);   // the boot code reads past the cartridge
  m.rom.set([0x4e, 0x71, 0x4e, 0x71, 0x4e, 0x71], 0x7c8); m.rom.set([0x4e, 0x71, 0x4e, 0x71, 0x4e, 0x71], 0x7e0);
  m.run(30);
  for (const [a, v] of PLAYED) m.ram[a] = v;
  return m.snapshot();
}
// m: an MD in the state to start from (bootState, restored); scene: 0-64, 'prologue' or 'prologue2'
// onFrame(f): called after each frame is run, before it is logged (orig.py's screen grabs)
export function record(R, m, scene, { maxFrames = 20000, onFrame = null } = {}) {
  const rom = R.b, { CHAPTER } = tables(R), c = m.cpu;
  stubs(m);
  const W = a => { const v = m.ram[a & 0xffff] << 8 | m.ram[(a + 1) & 0xffff]; return v & 0x8000 ? v - 0x10000 : v; };
  const L = a => (m.ram[a & 0xffff] << 24 | m.ram[(a + 1) & 0xffff] << 16 | m.ram[(a + 2) & 0xffff] << 8 | m.ram[(a + 3) & 0xffff]) >>> 0;
  const ops = [], tracks = new Map(), cams = [], state = { f: 0 };
  const own = Array.from({ length: 30 }, (_, i) => i);
  const onOp = cpu => {
    const off = L(0xff0f7c), scr = L(0xff32b6), w = cpu.rd16(scr + off);
    if (w < 58) { const n = SIZE[w] - 2, arg = []; for (let k = 0; k < n; k++) arg.push(cpu.rd8(scr + off + 2 + k)); ops.push({ f: state.f, at: (scr + off) >>> 0, op: w, arg: arg.map(v => v.toString(16).padStart(2, '0')).join('') }); }
    if (w === 25) { const a = cpu.rd8(scr + off + 2) - 1 - 31, b = cpu.rd8(scr + off + 3) - 1 - 31; if (a >= 0 && a < 30 && b >= 0 && b < 30) { const t = own[a]; own[a] = own[b]; own[b] = t; } }
    if (w === 0 || w === 13 || w === 52) for (let i = 0; i < 30; i++) own[i] = i;   // a map load (op 52: op 13's, from white)
  };
  c.hooks.set(0x872, onOp); c.hooks.set(0x2d26, onOp); c.hooks.set(0x4090, onOp);
  const seen = new Set(); c.hooks.set(PART2, () => seen.add(PART2)); c.hooks.set(PART2_END, () => seen.add(PART2_END));
  let startScene, sp = 0xFFFE00;
  if (scene === 'prologue2') {
    for (const a of NATIVE_CARDS) m.rom.set([0x4e, 0x75], a);
    m.rom.set([0x60, 0xfe], HALT); sp = 0xFFFDFC; c.wr32(sp, HALT);
    c.r[15] = sp; c.sr = 0x2000; c.pc = TITLE;
    m.run(200, '');
    for (let i = 0; i < 20; i++) { if (seen.has(PART2)) break; m.tap('A', 5, 25); }
    startScene = 0;
  } else if (scene === 'prologue') {
    m.rom.set([0x60, 0xfe], HALT); sp = 0xFFFDFC; c.wr32(sp, HALT);
    m.ram[0x32ba] = 0; m.ram[0x32bb] = 8; m.ram.fill(0, 0x0f7c, 0x0f80);
    c.r[15] = sp; c.sr = 0x2000; c.pc = PROLOGUE; startScene = 0;
  } else {
    m.ram[0x32ba] = scene; m.ram[0x32bb] = CHAPTER[scene];
    c.r[15] = sp; c.sr = 0x2000; c.pc = 0x81e; startScene = scene;
  }
  const PROP = { jade: rom.subarray(0x0E8622, 0x0E8622 + 128) };
  // the sheets' frames by their tiles: hash -> [[gfx, frame, rom offset]]
  const sheets = new Map(), known = new Set(), frames = new Map();
  const frameOf = (gfx, a) => {   // which of a sheet's 9 frames these VRAM tiles are, or -1
    let fm = frames.get(gfx); if (!fm) { fm = new Map(); for (let k = 0; k < 9; k++) { const h = hash(rom, gfx + 512 * k, 512); if (!fm.has(h)) fm.set(h, []); fm.get(h).push(k); } frames.set(gfx, fm); }
    const cand = fm.get(hash(m.vram, a, 512)) || [];
    let hit = -1; for (const k of cand) if (eq(rom, gfx + 512 * k, m.vram, a, 512)) hit = k;   // the last of identical frames, as record.py's table kept it
    return hit;
  };
  const seenAt = new Map(), drawn = [], props = [];
  let error = null, f, pose = null, seenOps = 0;   // the pose a cut has unpacked to 0xFFA000 (CUT_POSES)
  const J = JSON.stringify;
  for (f = 0; f < maxFrames; f++) {
    state.f = f;
    try { m.stepFrame(); } catch (e) { error = String(e.message || e); break; }
    if (onFrame) onFrame(f);
    const cx = W(0xff0020), cy = W(0xff0022);
    if (!cams.length || cams[cams.length - 1][1] !== cx || cams[cams.length - 1][2] !== cy) cams.push([f, cx, cy]);
    for (const o of ops.slice(seenOps)) if (o.op === 38 && CUT_POSES[parseInt(o.arg.slice(0, 8), 16)] != null) pose = CUT_POSES[parseInt(o.arg.slice(0, 8), 16)];
    seenOps = ops.length;
    const named = g => (g === POSE_BUF && pose != null ? pose : g).toString(16).padStart(6, '0');   // a unit's sheet: its graphic, or the pose in the buffer
    const okg = g => (g >= 0x40000 && g < 0x200000) || (g === POSE_BUF && pose != null);
    // what the hardware draws: every 32x32 sprite on the 256x224 screen, told apart by its tiles
    const cur = new Set();
    for (let i = 0; i < 30; i++) {
      const g = (m.ram[0x02aa + 64 * i + 6] << 24 | m.ram[0x02aa + 64 * i + 7] << 16 | m.ram[0x02aa + 64 * i + 8] << 8 | m.ram[0x02aa + 64 * i + 9]) >>> 0;
      if (g === POSE_BUF && pose != null) {
        cur.add(named(g)); const tl = m.ram.slice(POSE_BUF & 0xffff, (POSE_BUF & 0xffff) + 512), h = hash(tl, 0, 512);
        if (!sheets.has(h)) sheets.set(h, []); if (!sheets.get(h).some(e => e[0] === named(g))) sheets.get(h).push([named(g), 0, null, tl]);
      } else if (g >= 0x40000 && g < 0x200000) {
        cur.add(g.toString(16).padStart(6, '0'));
        if (!known.has(g)) { known.add(g); for (let k = 0; k < 9; k++) { const h = hash(rom, g + 512 * k, 512); if (!sheets.has(h)) sheets.set(h, []); sheets.get(h).push([g.toString(16).padStart(6, '0'), k, g + 512 * k]); } }
      }
    }
    const vsat = (m.reg[5] & 0x7f) << 9; let e = 0; const shown = [], shownProps = [];
    for (let n = 0; n < 80; n++) {
      const a = vsat + 8 * e, y = m.w(a) & 0x3ff, sz = m.w(a + 2), attr = m.w(a + 4), x = m.w(a + 6) & 0x1ff;
      if (((sz >> 8) & 0xf) === 0x5 && 0x80 - 16 < y && y < 0x80 + 224 && 0x80 - 16 < x && x < 0x80 + 256) {
        const t = attr & 0x7ff;
        for (const [name, tl] of Object.entries(PROP)) if (eq(tl, 0, m.vram, t * 32, 128)) shownProps.push([name, x - 0x80 + cx * 8, y - 0x80 + cy * 8]);
      }
      if (((sz >> 8) & 0xf) === 0xf && 0x80 - 32 < y && y < 0x80 + 224 && 0x80 - 32 < x && x < 0x80 + 256) {
        const t = attr & 0x7ff, h = hash(m.vram, t * 32, 512);
        const cand = (sheets.get(h) || []).filter(([, , o, tl]) => o == null ? eq(tl, 0, m.vram, t * 32, 512) : eq(rom, o, m.vram, t * 32, 512));
        const list = cand.length ? cand : [['', -1]];
        const [g, k] = list.find(x2 => cur.has(x2[0])) || list[0];
        shown.push([x - 0x80 + cx * 8, y - 0x80 + cy * 8, g, k, (attr >> 11) & 1]);
      }
      e = sz & 0x7f; if (e === 0) break;
    }
    shown.sort(cmpList);
    if (!drawn.length || J(drawn[drawn.length - 1][1]) !== J(shown)) drawn.push([f, shown]);
    shownProps.sort(cmpList);
    if (J(props.length ? props[props.length - 1][1] : []) !== J(shownProps)) props.push([f, shownProps]);
    for (let en = 0; en < 30; en++) {
      const i = own[en], so = 0xf0f8 + 8 * en;
      const y = m.ram[so] << 8 | m.ram[so + 1], attr = m.ram[so + 4] << 8 | m.ram[so + 5], x = m.ram[so + 6] << 8 | m.ram[so + 7];
      const rb = 0x02aa + 64 * i, r0 = m.ram[rb];
      const gfx = (m.ram[rb + 6] << 24 | m.ram[rb + 7] << 16 | m.ram[rb + 8] << 8 | m.ram[rb + 9]) >>> 0;
      const vis = 0x80 - 32 < y && y < 0x80 + 224 && x > 0x80 - 40 && r0 !== 0 && r0 !== 0xff && okg(gfx);
      const t = attr & 0x7ff;
      const s16 = v => v & 0x8000 ? v - 0x10000 : v, rx = s16(m.ram[rb + 2] << 8 | m.ram[rb + 3]), ry = s16(m.ram[rb + 4] << 8 | m.ram[rb + 5]);
      const present = r0 !== 0 && r0 !== 0xff && rx >= 0 && rx < 128 && ry >= 0 && ry < 128 && okg(gfx);
      let key = null;
      const incut = ops.length && ops[ops.length - 1].op === 38;
      if (vis) {
        key = [x - 0x80 + cx * 8, y - 0x80 + cy * 8, named(gfx), gfx === POSE_BUF ? 0 : frameOf(gfx, t * 32), (attr >> 11) & 1];
        seenAt.set(i, [key, [rx, ry], !!incut]);
      } else if (present && seenAt.has(i)) {
        const [k0, r0s, c0] = seenAt.get(i), same = r0s[0] === rx && r0s[1] === ry;
        const onscr = -16 < k0[0] - cx * 8 && k0[0] - cx * 8 < 240 && -16 < k0[1] - cy * 8 && k0[1] - cy * 8 < 208;
        const there = !onscr || shown.some(d => Math.abs(d[0] - k0[0]) <= 16 && Math.abs(d[1] - k0[1]) <= 16 && d[2] === k0[2]);
        if (same && (incut || (!c0 && there))) key = k0.slice();
        else if (same && !c0) seenAt.delete(i);
        else if (incut) key = [rx * 32, ry * 32, named(gfx), k0[3], k0[4]];
      }
      if (!tracks.has(i)) tracks.set(i, []);
      const tr = tracks.get(i);
      if (J(tr.length ? tr[tr.length - 1][1] : null) !== J(key)) tr.push([f, key]);
    }
    if (scene === 'prologue2' && seen.has(PART2_END)) break;
    if (typeof scene === 'number' && m.ram[0x32ba] !== startScene) break;
    if (scene === 'prologue' && (c.pc === HALT || c.pc === HALT + 2)) break;
  }
  c.hooks.clear();
  const units = {}; for (const [i, tr] of tracks) if (tr.some(([, k]) => k)) units[i] = tr;
  return { scene, frames: f + 1, ops, camera: cams, units, drawn, props, error };
}
// Python's list ordering (sort() on lists of numbers and strings)
function cmpList(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] === b[i]) continue; return a[i] < b[i] ? -1 : 1; }
  return a.length - b.length;
}
