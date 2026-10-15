// The sprites some spells show (a port of tools/rom/spellfx.py sprites, without its 磻溪 snapshot):
//   assets/fx/<name>.png   the summoned beasts (54-57), 觀音 (42) and a skull wisp (36), each cut out of the one layer
//                          that draws it (plane A or the sprites) at a frame of the cast
// The cast is played from a cold boot: scene 0 runs on into battle 1 (its battle op kept), the camp's 出擊 is
// confirmed, the opening lines clicked through to 林雲's command ring; then he is given the spell and 99 MP, the
// nearest bandit is brought next to him, and the spell is cast on it.
import { MD } from './md.js';
import { image } from './png.js';
import { bootState, stubs } from './record.js';
import { tables } from './text.js';

// name, spell, frame after the cast's confirm (battle 1's: summon 57 and 觀音 a frame or six later than on 磻溪), layer ('a' plane A, 's' sprites), a box to clear first
const SPRITES = [['summon_54', 54, 140, 'a', null], ['summon_55', 55, 150, 'a', null], ['summon_56', 56, 160, 's', null],
  ['summon_57', 57, 146, 'a', null], ['guanyin', 42, 186, 's', [0, 0, 100, 224]], ['skull', 36, 190, 's', null]];
const RING = 'w1500 D w10 D w10 D w10 D w10 A w30 L w10 A w300 A w60 A w60 A w60 A w60 A w60 A w60 A w60';   // camp: 出擊, 是; the lines

function play(m, keys, hold = 12) { for (const t of keys.split(' ')) { if (t[0] === 'w') m.run(+t.slice(1)); else m.tap(t, 3, hold); } }
// 林雲's command ring up in battle 1, from the boot state
export function ringState(R, rom, snap) {
  const m = new MD(rom).restore(snap), c = m.cpu; stubs(m);
  m.rom.set(rom.subarray(0x149e + 4 * 10, 0x149e + 4 * 10 + 4), 0x149e + 4 * 10);   // the battle op back
  m.ram[0x32ba] = 0; m.ram[0x32bb] = tables(R).CHAPTER[0]; c.r[15] = 0xFFFE00; c.sr = 0x2000; c.pc = 0x81e;
  play(m, RING);
  return m;
}
// at: the bandit's cell (林雲 stands at (5, 4)); a spell whose range misses it says the target is out of range and plays nothing
export function cast(rom, ring, sid, at = [7, 4], aim = '') {   // aim: keys moving the target cursor first (some spells start it on the caster)
  const m = new MD(rom).restore(ring.snapshot()); m.rom.set(ring.rom); const U = 0x2aa;
  m.ram[U + 0x1a] = sid; m.ram.set([0, 99, 0, 99], U + 0x2c);   // 林雲's first spell is this one; MP 99
  const g = 0x2aa + 64 * 10, [x, y] = at;   // the bandit at (8, 5) moved: its record and the unit grid (ff2724: 32 a row, x + 2)
  m.ram[g + 3] = x; m.ram[g + 5] = y; m.ram[0x2724 + 32 * 5 + 10] = 0x28; m.ram[0x2724 + 32 * y + x + 2] = 0x0b;
  play(m, 'B w30 A w30 L w30 A w30 A w40', 0);   // the ring reopened (it reads the spells as it opens), 法, the spell, the target
  if (aim) play(m, aim, 8);
  m.tap('A', 3, 0);
  return m;
}
// the screen with only one layer drawn (the others blanked in a copy of VRAM), alpha where that layer draws
export function layer(m, which, only) {
  const R = m.reg, saved = m.vram.slice(), dim = v => ({ 0: 32, 1: 64, 3: 128 })[v] || 32;
  const sat = (R[5] & 0x7F) << 9, pa = (R[2] & 0x38) << 10, pb = (R[4] & 7) << 13, pw = dim(R[16] & 3), ph = dim((R[16] >> 4) & 3);
  for (const [base, w] of [[pa, 'a'], [pb, 'b']]) if (which !== w) for (let i = 0; i < pw * ph * 2; i++) m.vram[(base + i) & 0xFFFF] = 0;
  if (which !== 's') for (const k of [0, 1, 2, 3, 6, 7]) m.vram[sat + k] = 0;
  else for (let i = 0; i < 30; i++) {   // the units' own entries (31 + unit) off the screen; a free unit's entry may draw the effect
    const r = m.ram[0x2aa + 64 * i]; if (r === 0 || r === 0xff) continue;
    m.vram[(sat + 8 * (31 + i)) & 0xFFFF] = 0; m.vram[(sat + 8 * (31 + i) + 1) & 0xFFFF] = 0;
  }
  if (only !== undefined) for (let e = 0; e < 80; e++) if (e !== only) { m.vram[(sat + 8 * e) & 0xFFFF] = 0; m.vram[(sat + 8 * e + 1) & 0xFFFF] = 0; }
  const s = m.screen(); m.vram.set(saved);
  const c = m.cram[0], c0 = [((c >> 1) & 7) * 36, ((c >> 5) & 7) * 36, ((c >> 9) & 7) * 36];
  const img = image(s.w, s.h, 4);
  for (let o = 0; o < s.w * s.h; o++) {
    for (let k = 0; k < 3; k++) img.px[o * 4 + k] = s.px[o * 3 + k];
    img.px[o * 4 + 3] = s.px[o * 3] !== c0[0] || s.px[o * 3 + 1] !== c0[1] || s.px[o * 3 + 2] !== c0[2] ? 255 : 0;
  }
  return img;
}
// 8-connected components of a mask -> labels (1..n), in scan order as the Python's
export function components(mask, W, H) {
  const lab = new Int32Array(W * H); let n = 0; const q = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x] || lab[y * W + x]) continue;
    n++; let h = 0, t = 0; q[t++] = y * W + x; lab[y * W + x] = n;
    while (h < t) {
      const p = q[h++], cy = Math.floor(p / W), cx = p % W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = cy + dy, xx = cx + dx;
        if (yy >= 0 && yy < H && xx >= 0 && xx < W && mask[yy * W + xx] && !lab[yy * W + xx]) { lab[yy * W + xx] = n; q[t++] = yy * W + xx; }
      }
    }
  }
  return [lab, n];
}
export function crop(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = image(x1 - x0 + 1, y1 - y0 + 1, 4);
  for (let y = 0; y < out.h; y++) out.px.set(img.px.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4), y * out.w * 4);
  return out;
}
export function sprite(R, rom, ring, [name, sid, f, which, clear]) {
  const m = cast(rom, ring, sid); m.run(f);
  const im = layer(m, which), W = im.w, H = im.h, A = o => im.px[o * 4 + 3];
  if (clear) { const [x0, y0, x1, y1] = clear; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) im.px[(y * W + x) * 4 + 3] = 0; }
  if (name === 'skull') return skull(m);
  const mask = new Uint8Array(W * H); for (let o = 0; o < W * H; o++) mask[o] = A(o) ? 1 : 0;
  const [lab, n] = components(mask, W, H), size = new Int32Array(n + 1); for (let o = 0; o < W * H; o++) size[lab[o]]++;
  size[0] = 0; const big = Math.max(...size), min = Math.max(30, big * (name === 'guanyin' ? 0.5 : 0.02));   // 觀音: not her shadow
  const keep = new Uint8Array(W * H); for (let o = 0; o < W * H; o++) keep[o] = lab[o] && size[lab[o]] >= min ? 1 : 0;
  const rows = Array.from({ length: H }, (_, y) => { let s = 0; for (let x = 0; x < W; x++) s += keep[y * W + x]; return s; });
  let top = rows.findIndex(r => r > 0); while (top < H - 1 && rows[top] <= 6) top++;   // the curtain's thin threads above the beast
  for (let o = 0; o < W * H; o++) im.px[o * 4 + 3] = keep[o] && o >= top * W ? 255 : 0;
  return crop(im);
}
// one skull of the swarm: the sprite entry (below the units') that draws the most pixels, alone
function skull(m) {
  let best = null, most = -1;
  for (let e = 0; e < 31; e++) {
    const im = layer(m, 's', e); let n = 0; for (let o = 0; o < im.w * im.h; o++) if (im.px[o * 4 + 3]) n++;
    if (n > most) { most = n; best = im; }
  }
  return crop(best);
}
export function run(R, rom, files, snap) {
  const ring = ringState(R, rom, snap);
  for (const s of SPRITES) files['assets/fx/' + s[0] + '.png'] = sprite(R, rom, ring, s);
}
