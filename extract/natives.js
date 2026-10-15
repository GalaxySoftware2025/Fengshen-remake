// The native cuts the scene recorder steps over or cannot see, measured from the game's own code (ports of
// tools/rom/hunt.py, toss.py, bridge.py and descent.py):
//   research/scenes/hunt.json, toss.json, bridge.json, descent.json   what extract/scenes.js stages them from
//   assets/units/100378.png, 050316.png   the rabbit's hop frames and 林雲's swing (scene 0's hunt)
//   assets/units/jade.png                 伯邑考's jade (scene 3's toss)
//   assets/maps/world-95a9.png            the world map of the 昌平村 descent, without the falling sprite or label
import { MD } from './md.js';
import { image, cramRGB } from './png.js';
import { stubs, record, PART2, TITLE, HALT } from './record.js';
import { Rom } from './rom.js';

const unitRGB = R => Array.from({ length: 16 }, (_, i) => cramRGB(R.W(0x38436 + 2 * i)));

// ---------------------------------------------------------------- the hunt (scene 0, native cut 0x0E81D8)
// The cut has no randomness, only fixed frame waits: its sprite program is replayed from the code. It unpacks the rabbit
// (pointer at 0x100378) to VRAM tile 0x5D0 and 林雲's swing (0x50316) to 0x500; the rabbit hops down from the top edge,
// 4 px every 4 frames, frames 0x5D0 / 0x5F0 alternating, 29 steps; 林雲 walks down 8 px every 5 frames, 12 steps, while
// the rabbit twitches (0x5D0 / 0x5E0); he swings (0x500, 0x510, 0x520, 8 frames each); a hit (0x8089), the rabbit drops
// 12 px and becomes the 079F32 carcass.
const WALK_START = 171, HUNT_CAM = [8, 8], LIN = [160, 128];
function cutSheet(R, rom, src) {   // three frames unpacked by the cut's own call (0x6BCE), in a 9-frame sheet
  const m = new MD(rom); m.call(0x6bce, [0xff8000, src]);
  const rgb = unitRGB(R), img = image(32 * 9, 32, 4);
  for (let f = 0; f < 9; f++) for (let t = 0; t < 16; t++) {   // (frames 3-8 empty: colour 0 under alpha 0)
    const tx = t >> 2, ty = t & 3;   // sprite tiles run down the columns
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const b = f < 3 ? m.ram[0x8000 + f * 512 + t * 32 + y * 4 + (x >> 1)] : 0, p = x & 1 ? b & 15 : b >> 4, o = ((ty * 8 + y) * 32 * 9 + f * 32 + tx * 8 + x) * 4;
      img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = p ? 255 : 0;
    }
  }
  return img;
}
export function hunt(R, rom, files) {
  files['assets/units/100378.png'] = cutSheet(R, rom, R.L(0x100378));
  files['assets/units/050316.png'] = cutSheet(R, rom, 0x50316);
  const mx = sx => sx - 128 + HUNT_CAM[0] * 8, my = sy => sy - 128 + HUNT_CAM[1] * 8;
  let f = WALK_START - 116, x = 0xe0, y = 0x60;
  const track = [[f, mx(x), my(y), '100378', 'down', 0]];
  for (let k = 0; k < 29; k++) { y += 4; track.push([f, mx(x), my(y), '100378', 'down', k % 2 === 0 ? 0 : 2]); f += 4; }   // 0x0E8252
  for (let d2 = 0; d2 < 12; d2++) { track.push([f, mx(x), my(y), '100378', 'down', d2 & 1]); f += 5; }                   // 0x0E82D0
  const swing = [];
  for (let d2 = 12; d2 < 15; d2++) { track.push([f, mx(x), my(y), '100378', 'down', d2 & 1]); swing.push([f, LIN[0], LIN[1], '050316', 'down', d2 - 12]); f += 8; }   // 0x0E8314
  y += 12; track.push([f, mx(x), my(y), '079f32', 'down', 0]);   // 0x0E8380: the hit; the carcass
  swing.push([f, LIN[0], LIN[1], '04f0fc', 'down']);              // 0x0E838A: back to his own tiles
  return { track, hit: f, swing };
}

// ---------------------------------------------------------------- the toss (scene 3, native cut 0x0E86CC, op 38 at f1017)
// The jade's 2x2 tiles (0x0E8622) go to VRAM 0x500; 0x7AE6 fills 0xFF8000 with an arc of 45 points (16 bytes each: x, y
// in sprite-table coordinates) from (0xE8, 0xA8) to (0xA8, 0xA8), 0x20 high; sprite 0 steps along it a point a frame.
const TOSS_F0 = 1017, TOSS_CAM = [8, 8];
export function toss(R, rom, files, snap) {
  const m = new MD(rom); m.call(0x7ae6, [0xff8000, 0x20, 0xa8, 0xa8, 0xa8, 0xe8]);   // the cut's own call (0x0E86EC .. 0x0E8710)
  const s16 = o => { const v = m.ram[o] << 8 | m.ram[o + 1]; return v & 0x8000 ? v - 0x10000 : v; };
  const pts = Array.from({ length: 45 }, (_, k) => [s16(0x8000 + k * 16), s16(0x8000 + k * 16 + 2)]);
  const path = pts.map(([x, y], k) => [TOSS_F0 + k, x - 128 + TOSS_CAM[0] * 8, y - 128 + TOSS_CAM[1] * 8]);
  if (snap) files['assets/units/jade.png'] = jade(R, rom, snap, pts);
  return { f0: TOSS_F0, path };
}
// the jade as the original's screen shows it in flight: the screen at mid-flight against two frames before the cut
function jade(R, rom, snap, pts) {
  const mid = 22, f = TOSS_F0 + mid, grab = screensOfScene(rom, snap, 3, [TOSS_F0 - 2, f]);
  const sx = pts[mid][0] - 128, sy = pts[mid][1] - 128, a = grab[f], b = grab[TOSS_F0 - 2], img = image(16, 16, 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const o = ((sy + y) * a.w + sx + x) * 3, q = (y * 16 + x) * 4;
    let d = 0; for (let c = 0; c < 3; c++) { img.px[q + c] = a.px[o + c]; d += Math.abs(a.px[o + c] - b.px[o + c]); }
    img.px[q + 3] = d > 24 ? 255 : 0;
  }
  return img;
}
// the screens of a scene at the given frames, as record.js plays it (orig.py's grab)
export function screensOfScene(rom, snap, scene, frames) {
  const out = {}, want = new Set(frames), last = Math.max(...frames);
  const R = new Rom(rom);
  const m = new MD(rom).restore(snap);
  record(R, m, scene, { maxFrames: last + 1, onFrame: f => { if (want.has(f)) out[f] = m.screen(); } });
  return out;
}

// ---------------------------------------------------------------- the bridge (scene 6, native cut 0x0EA6B8, op 38 at f194)
// Six fireballs, one after another, each on an arc from 0x7AE6 (args from the table 0x0EA5E0), every 0x28-byte point
// shown, 18 frames; where one lands two map edits (table 0x0EA670, 12 bytes: block, x, y twice) take a piece away.
const BR_F0 = 194, STEPS = 18, STRIDE = 19, LEAD = 9, BR_CAM = [0, 8];
export function bridge(R, rom) {
  const strikes = [];
  for (let k = 0; k < 6; k++) {
    const L = [0, 1, 2, 3].map(j => R.L(0xea5e0 + 16 * k + 4 * j));
    const m = new MD(rom); m.call(0x7ae6, [0xff8000, 1, L[3], L[2], L[1], L[0]]);
    const s16 = o => { const v = m.ram[o] << 8 | m.ram[o + 1]; return v & 0x8000 ? v - 0x10000 : v; };
    const pts = Array.from({ length: STEPS }, (_, i) => [s16(0x8000 + i * 0x28), s16(0x8000 + i * 0x28 + 2)]);
    const toMap = p => [p[0] - 128 + BR_CAM[0] * 8 + 16, p[1] - 128 + BR_CAM[1] * 8 + 16];
    const e = 0xea670 + 12 * k, edits = [0, 6].map(j => [R.W(e + j + 2), R.B(e + j + 4), R.B(e + j + 5)]);
    strikes.push({ f: BR_F0 + LEAD + STRIDE * k + STEPS, start: BR_F0 + LEAD + STRIDE * k, from: toMap(pts[0]), to: toMap(pts[STEPS - 1]), edits });
  }
  return { f0: BR_F0, end: BR_F0 + 147, strikes };
}

// ---------------------------------------------------------------- the descent (prologue part 2's native cut 0x44CA)
// Run live: the world map fades in, labelled 昌平村 by a framed marker; 林雲 drops in at the top edge tumbling, falls
// toward the village shrinking, and vanishes above the marker; the map holds, then fades. Measured on the screen.
const CUT = 0x44ca, NEXT = 0x490e;
const FALL = [150, 256, 0, 100], MARKER = [194, 220, 96, 120], LABEL = [183, 234, 125, 143];
export function descentFrames(rom, snap) {
  const m = new MD(rom).restore(snap), c = m.cpu; stubs(m);
  const seen = new Set(); let inside = false;
  c.hooks.set(CUT, () => { inside = true; }); c.hooks.set(PART2, () => { seen.add(PART2); }); c.hooks.set(NEXT, () => { seen.add(NEXT); });
  m.rom.set([0x60, 0xfe], HALT); const sp = 0xFFFDFC; c.wr32(sp, HALT);
  c.r[15] = sp; c.sr = 0x2000; c.pc = TITLE;
  m.run(200, '');
  for (let i = 0; i < 20; i++) { if (seen.has(PART2)) break; m.tap('A', 5, 25); }
  const frames = [];
  for (let i = 0; i < 4000; i++) {
    m.stepFrame();
    if (inside) frames.push(m.screen());
    if (seen.has(NEXT) || frames.length > 600) break;
  }
  c.hooks.clear();
  return frames;
}
export function descent(R, rom, files, snap) {
  const F = descentFrames(rom, snap), W = 256;
  const lum = F.map(f => { let s = 0; for (const v of f.px) s += v; return s / f.px.length; }), top = Math.max(...lum);
  const lit = []; lum.forEach((l, i) => { if (l > top * 0.97) lit.push(i); });
  const fadeIn = lit[0], fadeOut = lit[lit.length - 1] + 1, bg = F[lit[lit.length - 1]].px;   // the sprite is gone by the last lit frame
  const [x0, x1, y0, y1] = FALL, path = [];
  for (let i = fadeIn; i < fadeOut; i++) {
    const p = F[i].px; let n = 0, xmin = 1e9, xmax = -1, ymin = 1e9, ymax = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (y >= MARKER[2] && y < MARKER[3] && x >= MARKER[0] && x < MARKER[1]) continue;   // the marker twinkles
      const o = (y * W + x) * 3;
      if (Math.abs(p[o] - bg[o]) + Math.abs(p[o + 1] - bg[o + 1]) + Math.abs(p[o + 2] - bg[o + 2]) > 30) { n++; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    }
    if (n > 6 && ymax - ymin < 40) path.push([i, (xmin + xmax) / 2, ymax, ymax - ymin + 1]);
  }
  // the label off: its white letters and dark outline take the colour of the nearest clean pixel in the row
  const art = bg.slice(), [lx0, lx1, ly0, ly1] = LABEL;
  for (let y = ly0; y < ly1; y++) {
    const px = x => [art[(y * W + x) * 3], art[(y * W + x) * 3 + 1], art[(y * W + x) * 3 + 2]];
    const bad = Array.from({ length: W }, (_, x) => { const c = px(x); return Math.min(...c) > 200 || Math.max(...c) < 60; });
    for (let x = lx0; x < lx1; x++) {
      if (!bad[x]) continue;
      search: for (let k = 1; k < 40; k++) for (const xx of [x - k, x + k]) {
        if (xx >= 0 && xx < W && !(lx0 <= xx && xx < lx1 && bad[xx])) { const c = px(xx); art.set(c, (y * W + x) * 3); break search; }
      }
    }
  }
  files['assets/maps/world-95a9.png'] = { w: W, h: 224, channels: 3, px: art };
  return { frames: F.length, fadeIn, fadeOut, sprite: '04f0fc', marker: [(MARKER[0] + MARKER[1]) / 2, MARKER[3]], label: [(LABEL[0] + LABEL[1]) / 2, LABEL[2]], path };
}

// all four, as files and as the measurements extract/scenes.js takes
export function run(R, rom, files, snap) {
  const out = { hunt: hunt(R, rom, files), toss: toss(R, rom, files, snap), bridge: bridge(R, rom), descent: descent(R, rom, files, snap) };
  for (const [k, v] of Object.entries(out)) files['research/scenes/' + k + '.json'] = JSON.stringify(v);
  return out;
}
