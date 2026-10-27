// The story scenes for the remake, from the recordings (extract/record.js) and the decoded scripts (a port of
// tools/rom/export_scenes.py):
//   data/scenes/SS.js            window.SCENES[SS] (and 'prologue', 'prologue2'): maps, camera, actor tracks, timed events
//   assets/maps/<desc>.png       each scene map's art (32 px cells), <desc>-blocks.png its block atlas (for cell edits)
//   assets/fx/emotes.png         the 13 emote frames (op 11), 32 px each (the reference for src/emotes.js)
// Times are in frames (60 Hz) of the original, with dialogue taking no time (the player waits there). Positions are map
// pixels (32 per cell).
import { MD } from './md.js';
import { s, SIZE, tables, message } from './text.js';
import { image, cramRGB } from './png.js';
import { mapOf, sheetImage } from './battles.js';
import { TABLETS as TABLET_ART } from './natives.js';

const PROLOGUE = { base: 0x200e, chapter: 8 };
const PROLOGUE2 = { base: 0x4374, chapter: 8 };   // 新的開始: 女媧's heaven, the descent to 昌平村, 十五年後, the village
const NATIVE_CARDS = { 0x44ca: 0x95a9, 0x490e: 0x3590, 0xe875a: 0xe86a2 };   // native cuts -> the text they show (record.js)
const HOLD_LINES = { '04:656': { '04f0fc': ['jade', 13, 10], '05219c': ['jade', 4, 10] } };   // (scene, frame): the speaker's sheet -> [prop, dx, dy] off its sprite (the original's: 林雲 f580, 燕蓉 f543)
// [design] facings the original does not have: (scene, slot, from, to, facing). Scene 3: 林雲 and 伯邑考 turn to face
// the camera at f921 while they still talk; here they keep facing each other until the guards come up (f953) [the user's call]
const FACE = [['03', '0', 921, 953, 'left'], ['03', '1', 921, 953, 'right']];
// stretches where a unit's record keeps a place the original never draws it at (the possessed 伯邑考, scene 43, before and
// between his flights up the hall: off the original's screen): hidden there, so ours never shows him standing where the
// original shows no one (export_scenes.py HIDE)
const DRAWN_CUTS = {
  0x0f737e: { pose: '0802dc', frame: d => Math.min(2, Math.floor(d / 14)), slash: 14 },   // 伯邑考 lunges (frames every 14), the hit at 14 [0x0F737E]
  0x0f7bd2: { pose: '061760', frame: d => d < 20 ? 1 : 1 - Math.floor((d - 20) / 20) % 2 },   // 姬發 kneels and weeps, a frame every 20 [0x0F7BD2]
};
const HIDE = [['43', '10', 1523, 1534], ['43', '10', 1545, 1552]];
const hex6 = v => v.toString(16).padStart(6, '0');
const hypot = (x, y) => Math.sqrt(x * x + y * y);
const J = JSON.stringify;
const eqv = (a, b) => J(a) === J(b);

// Python's round(x, 2): the exact decimal value rounded, ties (x = j / 8, j odd) to even
export function pyRound(x) {
  if (Number.isInteger(x)) return x;
  if (Number.isInteger(x * 8) && !Number.isInteger(x * 4)) { const v = x * 100, f = Math.floor(v); return (f % 2 === 0 ? f : f + 1) / 100; }
  return Number(x.toFixed(2));
}

// the script's ops with dialogue resolved (counters fresh for this script)
function staticOps(R, base, chapter) {
  const out = new Map(), counters = {}; let o = 0;
  for (;;) {
    const w = R.W(base + o);
    if (w >= 0xfffd) break;
    const n = SIZE[w], arg = R.bytes(base + o + 2, n - 2), op = { op: w };
    if (w === 19) counters[R.W(base + o + 2)] = R.W(base + o + 4);
    if (w === 4 || w === 55) {
      const spk = arg[0], cnt = arg[2] << 8 | arg[3]; let idx;
      if (cnt >= 0x8000) idx = cnt & 0x7fff; else { idx = counters[spk] || 0; counters[spk] = idx + cnt; }
      try { op.text = message(R, chapter, spk, idx); } catch (e) { if (!(e instanceof RangeError)) throw e; op.text = '?'; }
      op.speaker = spk; op.actor = arg[1];
    }
    out.set(base + o, op); o += n;
  }
  return out;
}
// an op-54 page: lines of text, each 'fc nn' + glyphs + 'ff'
// where a rolled narration's lines start on the original's screen (x px; measured, tools/rom/prologue_world.py), by text
const ROLL_X = { 0x237c: [56, 80, 80, 80, 80, 64, 80] };
function narration(R, ptr) {   // (up to 64 lines: the epilogue's staff roll has 47)
  const lines = []; let i = ptr;
  for (let k = 0; k < 64; k++) {
    const [t, j] = s(R, i, 200); i = j; lines.push(t.replace(/^\/+/, ''));
    if (R.B(i) === 0xff || R.B(i) === 0x00 || !t) break;
  }
  return lines;
}
// where each of a page's lines starts on the original's screen: its 'fc nn' header, nn columns of 8 px (the epilogue's)
function narrationX(R, ptr) {
  const xs = []; let i = ptr;
  for (let k = 0; k < 64; k++) {
    xs.push(R.B(i) === 0xfc ? R.B(i + 1) * 8 : null);
    const [t, j] = s(R, i, 200); i = j;
    if (R.B(i) === 0xff || R.B(i) === 0x00 || !t) break;
  }
  return xs;
}
// op 11's balloon frames: tiles unpacked from 0x4E282, 13 sprites of 4x4 tiles, palette line 2
export function emotes(R, rom) {
  const m = new MD(rom); m.reg[15] = 2; m.call(0x6bce, [0xff8000, 0x4e282]);
  const rgb = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(0x38436 + 2 * i))), img = image(32 * 13, 32, 4);
  for (let f = 0; f < 13; f++) for (let t = 0; t < 16; t++) {
    const tx = t >> 2, ty = t & 3;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const b = m.ram[0x8000 + f * 512 + t * 32 + y * 4 + (x >> 1)], p = x & 1 ? b & 15 : b >> 4, o = ((ty * 8 + y) * 32 * 13 + f * 32 + tx * 8 + x) * 4;
      img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = p ? 255 : 0;
    }
  }
  return img;
}
// 32 px images of the given block ids of a map, in a row (for op-24 cell edits)
function blockAtlas(R, rom, a, ids) {
  const m = new MD(rom); m.reg[15] = 2; m.call(0x5af6, [a.art, 0x200]);
  const rgb = Array.from({ length: 32 }, (_, i) => cramRGB(R.W(a.palette + 2 * i))), img = image(32 * ids.length, 32, 3), V = m.vram;
  ids.forEach((b, j) => {
    for (let k = 0; k < 16; k++) {
      const e = R.W(a.blocks + b * 32 + 2 * k), t = e & 0x7ff, hf = e & 0x800, vf = e & 0x1000, line = ((e >> 13) & 1) * 16, ty = k >> 2, tx = k & 3;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const sx = hf ? 7 - x : x, sy = vf ? 7 - y : y, byte = V[t * 32 + sy * 4 + (sx >> 1)], p = sx & 1 ? byte & 15 : byte >> 4;
        const c = rgb[line + p], o = ((ty * 8 + y) * 32 * ids.length + j * 32 + tx * 8 + x) * 3;
        img.px[o] = c[0]; img.px[o + 1] = c[1]; img.px[o + 2] = c[2];
      }
    }
  });
  return img;
}

// sheet frames 0-2 face down, 3-5 up, 6-8 left (h-flipped: right); other poses keep the last facing
function direction(frame, flip) {
  if (frame < 0) return null;
  return !(frame >= 6 && flip) ? ['down', 'up', 'left'][Math.floor(frame / 3)] : 'right';
}
// sprites the original never walk-cycles: a gfx that never shows all three frames of any facing, over every recording,
// plays exactly the frames the original shows
function stills(recs) {
  const seen = new Map();
  for (const rec of recs) for (const tr of Object.values(rec.units || {})) for (const [, k] of tr) {
    if (k !== null && k[3] >= 0) { if (!seen.has(k[2])) seen.set(k[2], new Set()); seen.get(k[2]).add(k[3]); }
  }
  return new Set([...seen].filter(([, fr]) => ![0, 3, 6].some(q => fr.has(q) && fr.has(q + 1) && fr.has(q + 2))).map(([g]) => g));
}
// the recordings log a value only when it changes; add the held value just before each change
function holds(points) {
  const out = [];
  for (const p of points) {
    const l = out[out.length - 1];
    if (l && p[0] - l[0] > 1 && l[1] !== null) out.push([p[0] - 1, ...l.slice(1)]);
    out.push(p);
  }
  return out;
}
// the original flickers a sprite to bring a unit on (op 48) and for a phantom's translucency: short hidden gaps where it
// comes back where it was are dropped, the unit fades in where it arrives (an 'appear' event), and one flickered frame by
// frame (on, off, on, a frame each, six times running) is a ghost; a burst of slowing or quickening flicker only brings a
// unit on or takes it off (scene 56's 燃燈道人 blinking about the hall was drawn translucent all scene [the user's report])
function materialise(tr, slot, events, ghosts, gap = 14, raw = tr) {   // (raw: the recording's own track, frame by frame where it flickers; walks() reshapes it)
  const out = []; let i = 0;
  while (i < tr.length) {
    const [f, k] = tr[i], last = out[out.length - 1];
    const back = i + 1 < tr.length && tr[i + 1][1] !== null && last && last[1] !== null && hypot(tr[i + 1][1][0] - last[1][0], tr[i + 1][1][1] - last[1][1]) <= 32;
    if (k === null && back && tr[i + 1][0] - f <= gap) {   // (back where it went: a flicker; one moved while hidden stays hidden, scene 43's 妲己 at f1466)
      i++; continue;
    }
    if (k !== null && (!last || last[1] === null)) {
      const nxt = tr.slice(i + 1, i + 6).filter(p => p[1] === null);
      let close = false; for (let q = i + 1; q < Math.min(tr.length, i + 6); q++) if (tr[q][1] !== null && tr[q][0] - tr[q - 1][0] <= gap) close = true;
      if (nxt.length && close) events.push({ f, kind: 'appear', slot: String(slot), dur: 30 });
    }
    out.push([f, k]); i++;
  }
  const on = p => p[1] !== null, flick = new Set(); let run = 0;
  for (let q = 2; q < raw.length; q++) { run = on(raw[q]) !== on(raw[q - 1]) && on(raw[q - 1]) !== on(raw[q - 2]) && raw[q][0] - raw[q - 1][0] === 1 ? run + 1 : 0; if (run >= 6) flick.add((on(raw[q]) ? raw[q] : raw[q - 1])[1][2]); }
  for (const g of flick) ghosts.push(slot + ':' + g);
  return out;
}
// where the hardware draws a unit's sheet (unique on screen, worn by this unit alone) 8 px or more from its track for
// 12 frames or more, the track follows the hardware (scene 8: 紂王 pacing before his throne)
const RAW_CUTS = [[0x0ee120, '0edf20', '30', 18]];   // native cut, the sheet of its sprite (extract/natives.js), the slot it takes, frames of growth
function follow(pts0, drawn, sole, near = 128, off = 8, run = 12) {   // (near: a stale record can trail a slow walk by 95 px, scene 16 f1060)
  let pts = [];
  pts0.forEach((p, k) => { pts.push(p); if (k + 1 < pts0.length) for (let f = p[0] + 1; f < pts0[k + 1][0]; f++) { const q = p.slice(); q[0] = f; pts.push(q); } });
  const vis = []; pts.forEach((p, k) => { if (p[1] !== null) vis.push(k); });
  const fill = new Map();
  for (let v = 0; v + 1 < vis.length; v++) {
    const a = vis[v], b = vis[v + 1];
    if (b - a < 2 || pts[a][3] !== pts[b][3] || !sole.has(pts[a][3])) continue;
    const g = pts[a][3]; let seen = [];
    for (let j = a + 1; j < b; j++) {
      const on = (drawn(pts[j][0]) || []).filter(d => d[2] === g);
      if (on.length !== 1) { seen = null; break; }
      seen.push(on[0]);
    }
    if (seen && seen.length) seen.forEach((d, q) => fill.set(a + 1 + q, [g, d]));
  }
  for (const [j, [g, d]] of fill) pts[j] = [pts[j][0], d[0], d[1], g, direction(d[3], d[4]) || 'down', ...(pts[j].length > 5 ? [null] : [])];
  const out = pts.map(p => p.slice()), cand = [];
  for (const p of pts) {
    let hit = null;
    if (p[1] !== null && sole.has(p[3])) {
      const on = (drawn(p[0]) || []).filter(d => d[2] === p[3]);
      if (on.length === 1) { const h = hypot(on[0][0] - p[1], on[0][1] - p[2]); if (off <= h && h <= near) hit = on[0]; }
    }
    cand.push(hit);
  }
  let k = 0;
  while (k < cand.length) {
    if (cand[k] === null) { k++; continue; }
    let e = k;
    while (e + 1 < cand.length && cand[e + 1] !== null) e++;
    if (pts[e][0] - pts[k][0] + 1 >= run) for (let j = k; j <= e; j++) { const d = cand[j]; out[j][1] = d[0]; out[j][2] = d[1]; out[j][4] = direction(d[3], d[4]) || out[j][4]; }
    k = e + 1;
  }
  return out;
}
// a unit off the original's screen that the camera carries along is pinned to the screen's edge, not moving: over a
// stretch off the screen (one sheet, never back on) the camera ranges over 48 px or more on an axis, the sprite's map
// position over at least half that and its screen position over at most half; the original parks such a
// sprite at the edge and re-pins it as the camera goes (scene 40 f444: 崇侯虎 carried 110 px of the camera's 128, his screen
// position saw-toothing between y -53 and -29, while it pans down the hall, as if he walked down off his throne). It holds the map spot where the stretch
// began [the user's report] (pts: dense, as follow() leaves them)
function pinned(pts, camAt, pan = 48) {
  const out = pts.map(p => p.slice()), n = pts.length;
  const scr = p => { const [cx, cy] = camAt(p[0]); return [p[1] - cx * 8, p[2] - cy * 8]; };
  const off = s => s[0] < 0 || s[0] > 224 || s[1] < 0 || s[1] > 192;
  for (let k = 0; k < n;) {
    if (pts[k][1] === null || !off(scr(pts[k]))) { k++; continue; }
    let e = k; while (e + 1 < n && pts[e + 1][1] !== null && pts[e + 1][3] === pts[k][3] && off(scr(pts[e + 1]))) e++;
    const rng = a => Math.max(...a) - Math.min(...a);
    for (const ax of [0, 1]) {
      const cam = [], ss = [], us = [];
      for (let j = k; j <= e; j++) { cam.push(camAt(pts[j][0])[ax] * 8); ss.push(scr(pts[j])[ax]); us.push(pts[j][ax + 1]); }
      if (rng(cam) >= pan && rng(ss) <= rng(cam) / 2 && rng(us) >= rng(cam) / 2) {   // carried: at least half the camera's way on the map, at most half of it on the screen
        for (let j = k + 1; j <= e; j++) { out[j][1] = pts[k][1]; out[j][2] = pts[k][2]; }
        break;
      }
    }
    k = e + 1;
  }
  return out;
}
// the original's hardware-drawn 32x32 sprites at a frame (record `drawn`: [x, y, sheet, frame, flip])
function drawnAt(rec) {
  const d = rec.drawn;
  if (!d || !d.length) return () => null;
  const fs = d.map(x => x[0]);
  return f => { if (f < fs[0]) return []; let lo = 0, hi = fs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (fs[mid] <= f) lo = mid + 1; else hi = mid; } return d[lo - 1][1]; };
}
// a walk the recording cannot see (the sprite's tiles match none of its sheet's frames, or it is dropped from the table
// at the move op): between two seen points of the same sheet, the walk from the one to the other, a point a frame,
// facing the way it goes; where the hardware draws that sheet near the line, its true spot and frame
function walks(tr, gap = 90, drawn = () => null) {
  const out = []; let i = 0;
  const point = (g, x, y, gfx, frame, flip) => {
    const last = out.length && out[out.length - 1][1] ? out[out.length - 1][1] : null;
    const near = (drawn(g) || []).filter(d => d[2] === gfx && hypot(d[0] - x, d[1] - y) <= 48 && (!last || hypot(d[0] - last[0], d[1] - last[1]) <= 8));
    if (!near.length) return [g, [pyRound(x), pyRound(y), gfx, frame, flip]];
    let d = near[0]; for (const c of near) if (hypot(c[0] - x, c[1] - y) < hypot(d[0] - x, d[1] - y)) d = c;
    return [g, [d[0], d[1], gfx, d[3] >= 0 ? d[3] : frame, d[3] >= 0 ? d[4] : flip]];
  };
  const seen = k => k !== null && k[3] >= 0;
  while (i < tr.length) {
    const [f, k] = tr[i]; out.push(tr[i]); i++;
    if (seen(k) && i < tr.length && tr[i][1] === null) {   // a walk wholly unseen, straight along a row or column at walking pace
      let j = i;
      while (j < tr.length && tr[j][1] === null) j++;
      if (j < tr.length && seen(tr[j][1]) && tr[j][1][2] === k[2]) {
        const [f1, k1] = tr[j], dx = k1[0] - k[0], dy = k1[1] - k[1], sp = hypot(dx, dy) / Math.max(1, f1 - f);
        if (f1 - f <= gap && (dx === 0 || dy === 0) && sp >= 1 && sp <= 4.2) {
          const [frame, flip] = Math.abs(dx) >= Math.abs(dy) ? [6, dx > 0 ? 1 : 0] : [dy > 0 ? 0 : 3, 0];
          for (let g = f + 1; g < f1; g++) { const t = (g - f) / (f1 - f); out.push(point(g, k[0] + dx * t, k[1] + dy * t, k[2], frame, flip)); }
          i = j;
        }
      }
      continue;
    }
    if (!seen(k) || i >= tr.length || tr[i][1] === null || tr[i][1][3] >= 0) continue;
    let j = i, blank = null;   // the run may hold a short blank (the sprite dropped a few frames)
    while (j < tr.length && (tr[j][1] === null || (tr[j][1][3] < 0 && tr[j][1][2] === k[2]))) {
      if (tr[j][1] === null) blank = blank === null ? tr[j][0] : blank;
      else if (blank !== null) blank = null;
      j++;
      if (blank !== null && j < tr.length && tr[j][0] - f > gap) break;   // (a blank mid-walk: it walked off the screen)
    }
    if (j >= tr.length || !seen(tr[j][1]) || tr[j][1][2] !== k[2] || tr[j][0] - f > gap || eqv(tr[j][1].slice(0, 2), k.slice(0, 2))) continue;
    const [f1, k1] = tr[j], dx = k1[0] - k[0], dy = k1[1] - k[1];
    const [frame, flip] = Math.abs(dx) >= Math.abs(dy) ? [6, dx > 0 ? 1 : 0] : [dy > 0 ? 0 : 3, 0];
    for (let g = f + 1; g < f1; g++) { const t = (g - f) / (f1 - f); out.push(point(g, k[0] + dx * t, k[1] + dy * t, k[2], frame, flip)); }
    i = j;
  }
  return out;
}
// a hop walk (a whole cell every few frames: scene 3's guards): a run of two or more hops one way becomes one even walk
function hops(pts) {
  const cell = (a, b) => { if (a[1] === null || b[1] === null || a[3] !== b[3]) return false; const s2 = [Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])].sort((p, q) => p - q); return s2[0] === 0 && s2[1] === 32; };
  const out = []; let i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && cell(pts[j], pts[j + 1]) && pts[j + 1][0] - pts[j][0] <= 16 && (j === i || (
      pts[j + 1][1] - pts[j][1] === pts[j][1] - pts[j - 1][1] && pts[j + 1][2] - pts[j][2] === pts[j][2] - pts[j - 1][2] && pts[j + 1][0] - pts[j][0] >= 4))) j++;
    if (j - i >= 2) {
      const a = pts[i], b = pts[j], per = []; for (let q = i + 1; q < j; q++) per.push(pts[q + 1][0] - pts[q][0]);
      per.sort((p, q) => p - q);
      let t0 = Math.min(a[0], b[0] - per[Math.floor((j - i - 1) / 2)] * (j - i));
      if (out.length) t0 = Math.max(t0, out[out.length - 1][0] + 1);
      for (let g = t0; g < b[0]; g++) {
        const t = (g - t0) / (b[0] - t0); let k = -1; for (let q = i; q <= j; q++) if (pts[q][0] <= g) k = q; if (k < 0) k = i;
        out.push([g, pyRound(a[1] + (b[1] - a[1]) * t), pyRound(a[2] + (b[2] - a[2]) * t), ...pts[k].slice(3)]);
      }
      i = j;
    } else { out.push(pts[i]); i++; }
  }
  return out;
}
// keep the points where a non-position key changes or the motion changes (linear in between)
function simplify(points, keys) {
  const out = [];
  points.forEach((p, i) => {
    if (!out.length || i === points.length - 1) { out.push(p); return; }
    const a = out[out.length - 1], b = points[i + 1];
    if (p[1] === null || a[1] === null || b[1] === null || keys.some(k => p[k] !== a[k] || p[k] !== b[k])) { out.push(p); return; }
    const t = (p[0] - a[0]) / Math.max(1, b[0] - a[0]);
    if (Math.abs(a[1] + (b[1] - a[1]) * t - p[1]) > 0.5 || Math.abs(a[2] + (b[2] - a[2]) * t - p[2]) > 0.5) out.push(p);
  });
  return out;
}

// recs: { tag: recording }; battles: { n: extractBattle result }; natives: { descent, hunt, toss, bridge } (the native
// cuts' measurements, each optional); sheets: a Set the unit graphics used are added to. Returns { tag: scene }.
// a 16 px sprite op 45 lays (two tiles by two, column by column), unpacked from its art by the game's routine (0x6BCE), in
// the palette line its attribute names (the source op 31 last copied there; line 2 the units')
function itemImage(R, rom, art, pal) {
  const m = new MD(rom); m.call(0x6bce, [0xff8000, art]);
  const rgb = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(pal + 2 * i))), img = image(16, 16, 4);
  for (let t = 0; t < 4; t++) { const tx = t >> 1, ty = t & 1;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const b = m.ram[0x8000 + t * 32 + y * 4 + (x >> 1)], p = x & 1 ? b & 15 : b >> 4, o = ((ty * 8 + y) * 16 + tx * 8 + x) * 4;
      img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = p ? 255 : 0; } }
  return img;
}
// a sheet of `frames` sprites of n x n tiles (column by column), from art packed at `art` (unpacked by 0x6BCE) or raw there
function cutSheet(R, rom, art, pal, n, frames, raw = false) {
  const m = new MD(rom); if (!raw) m.call(0x6bce, [0xff8000, art]);
  const rd = raw ? a => R.B(art + a) : a => m.ram[0x8000 + a];
  const rgb = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(pal + 2 * i))), S = n * 8, img = image(S * frames, S, 4);
  for (let fr = 0; fr < frames; fr++) for (let t = 0; t < n * n; t++) { const tx = Math.floor(t / n), ty = t % n;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const b = rd((fr * n * n + t) * 32 + y * 4 + (x >> 1)), p = x & 1 ? b & 15 : b >> 4, o = ((ty * 8 + y) * S * frames + fr * S + tx * 8 + x) * 4;
      img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = p ? 255 : 0; } }
  return img;
}
const OP47_X = 0x1b7fa, OP47_Y = 0x1b833;   // op 47's flight: 56 steps of x and y [0x1B984]
export function exportScenes(R, rom, recs, battles, natives = {}, files = {}, sheets = new Set()) {
  const { SCENES, CHAPTER } = tables(R);
  const BATTLE_OF_SCENE = {}; for (let n = 1; n <= 32; n++) BATTLE_OF_SCENE[battles[n].scene] = n;
  const { descent: DESCENT, hunt: HUNT, toss: TOSS, bridge: BRIDGE } = natives;
  const STILL = stills([...Object.values(recs), ...Object.values(natives).filter(Boolean)]);
  for (const g of ['0802c2', '06926a', '05339c']) STILL.add(g);   // (the one-frame poses cuts put on a unit, record.js CUT_POSES: never walk-cycled)
  const maps = new Map(), atlases = new Map();
  const sceneMap = desc => {
    if (maps.has(desc)) return maps.get(desc);
    const [info, img] = mapOf(R, rom, null, desc), key = hex6(desc);
    files['assets/maps/' + key + '.png'] = img;
    const mp = { key, w: info.w, h: info.h, terrain: info.terrain, addr: info.addr }; maps.set(desc, mp); return mp;
  };
  const out = {};
  for (const tag of ['prologue', 'prologue2', ...Array.from({ length: 66 }, (_, i) => String(i).padStart(2, '0'))]) {
    const rec = recs[tag]; if (!rec) continue;
    const extraMaps = {}; let st, chapter, n;
    if (tag === 'prologue') { st = staticOps(R, PROLOGUE.base, PROLOGUE.chapter); chapter = 0; n = null; }
    else if (tag === 'prologue2') { st = staticOps(R, PROLOGUE2.base, PROLOGUE2.chapter); chapter = 0; n = null; }
    else { const si = +tag; st = staticOps(R, SCENES[si], CHAPTER[si]); chapter = CHAPTER[si] + 1; n = BATTLE_OF_SCENE[si] ?? null; }
    const cams = rec.camera; let pan = null;
    const camAt = f => { let c = cams[0]; for (const x of cams) { if (x[0] > f) break; c = x; } return [c[1], c[2]]; };
    let events = []; const smaps = [], edits = new Map(); let curMap = null; const ascents = [], tablets = [], lays = [], pal3 = { 2: 0x38436 };   // (lays: op 45's items; pal3: the source op 31 last copied to each palette line)
    const hexb = h => { const b = []; for (let i = 0; i < h.length; i += 2) b.push(parseInt(h.substr(i, 2), 16)); return b; };
    let holdAt = null;
    const lit = () => { for (let i = events.length - 1; i >= 0; i--) { const e = events[i]; if (['fadeOut', 'narrate', 'map', 'fadeIn'].includes(e.kind)) return false; if (e.kind === 'roll' || (e.kind === 'native' && e.name === 'redden')) return true; } return false; };   // (a page over a map a cut has darkened but left showing, the epilogue's heaven: it rolls over it; elsewhere the remake's page card [design])
    for (const o of rec.ops) {
      const f = o.f, w = o.op, a = hexb(o.arg), so = st.get(o.at) || {};
      const H = k => a[k] << 8 | a[k + 1], L4 = k => (a[k] << 24 | a[k + 1] << 16 | a[k + 2] << 8 | a[k + 3]) >>> 0;
      if (w === 0 || w === 13 || w === 52) for (const l of lays) if (l.end == null) l.end = f;   // (a map load clears the sprites)
      if (w === 14) for (const l of lays) if (l.end == null && a[0] <= l.entry && l.entry <= a[1]) l.end = f;   // [0x1A4F2] entries a[0]..a[1] cleared
      if (w === 0 || w === 13 || w === 52) {   // op 52 [0x199AE]: op 13's load with the palette white instead of black (scene 54, into heaven)
        const desc = w === 0 ? R.L(0x1586 + 4 * H(0)) : L4(0);
        const mp = sceneMap(desc); curMap = desc;
        smaps.push({ f, map: mp.key }); events.push(Object.assign({ f, kind: 'map', map: mp.key }, w === 52 ? { white: true } : {}));
      } else if (w === 53) {   // [0x19A82] eight palette steps out of white, the argument's frames between them
        events.push({ f, kind: 'fadeIn', speed: 0, white: true, frames: 8 * (H(0) + 1) });
      } else if (w === 4 || w === 55) {
        const text = so.text || '', at = text.indexOf('：'), who = at >= 0 ? text.slice(0, at) : text, said = at >= 0 ? text.slice(at + 1) : '';
        events.push({ f, kind: 'say', who: said ? who : '', text: said || text, speaker: so.speaker ?? null, actor: so.actor ?? null });
      } else if (w === 11) {
        const [cx, cy] = camAt(f);
        events.push({ f, kind: 'emote', x: H(0) - 0x80 + cx * 8, y: H(2) - 0x80 + cy * 8, emote: a[4], loops: a[5] + 1, hold: a[6], delay: a[7] });
      } else if (w === 44 || w === 49) {   // [0x19FB0 / 0x1A068] one balloon (frame 4 / 11 of op 11's art) over every unit from slot a[0] to a[1], 16 px
        // right of and above its sprite, in the sprite table's first entries, till op 14 clears them
        events.push({ f, kind: 'emotes', slots: Array.from({ length: a[1] - a[0] + 1 }, (_, i) => String(a[0] + i)), frame: w === 44 ? 4 : 11 });
      } else if (w === 14 && a[0] <= 30 && 30 <= a[1]) events.push({ f, kind: 'emoteOff' });
      else if (w === 14 && a[0] <= 1 && 1 <= a[1]) events.push({ f, kind: 'emotesOff' });
      else if (w === 1) events.push({ f, kind: 'fadeIn', speed: H(0) });
      else if (w === 8) events.push({ f, kind: 'fadeOut', speed: H(0) });
      else if (w === 56) events.push({ f, kind: 'music', id: H(0) });
      else if (w === 10) events.push({ f, kind: 'battle', n });
      else if (w === 54 && pan && !pan.roll) {   // narration over the world map's pan: it rolls up over the land like credits [the 0x26AC callback]
        pan.roll = f; events.push({ f, kind: 'roll', lines: narration(R, L4(2)), xs: ROLL_X[L4(2)] || null });
      }
      else if (w === 54 && lit()) {   // a page over the map still shown (the epilogue's closing words and staff roll, over the darkened heaven): it rolls up
        // as the prologue's, from below the screen, line k at 240 + 16k - (t - f) / 2, until the op returns; the last page held there through the
        // long wait before the reset (op 15 0x7FFF: the remake waits for a click instead)
        const nx = rec.ops.find(x => x.at > o.at && x.f > f), hold = !!(nx && nx.op === 15 && parseInt(nx.arg.slice(0, 4), 16) >= 0x4000);
        events.push({ f, kind: 'roll', lines: narration(R, L4(2)), xs: narrationX(R, L4(2)), end: nx ? nx.f : f + 720, hold });
      }
      else if (w === 54) events.push({ f, kind: 'narrate', lines: narration(R, L4(2)) });
      else if (w === 15 && H(0) >= 0x4000) { events.push({ f, kind: 'hold' }); holdAt = f; }   // the epilogue's last wait (0x7FFF frames, then the reset at 0x51A): held for a click
      else if (w === 38 && L4(0) === 0x51f2) {   // the epilogue's look down from heaven [0x51F2], after each of its vignettes' map loads: the picture comes up out of
        // white (the palette a step down every 7th frame, 0x2184C), a white orb going round it all the while, drawn every other frame (+0x100 on its y),
        // along the steps unpacked from 0x359A (x) and 0x35DE (y) from (0x70, 0x90), 2 n - 1 frames (n: the unpacker's count)
        const m = new MD(rom); m.reg[15] = 2; const n0 = m.call(0x6bce, [0xff8000, 0x359a]) & 0xffff; m.call(0x6bce, [0xff83e8, 0x35de]);
        const sb = v => v & 0x80 ? v - 256 : v, [cx, cy] = camAt(f), S0 = f + 16, N = 2 * n0;
        let x = 0x70, y = 0x90; const orb = [];
        for (let i = 0; i < N; i++) { x += sb(m.ram[0x8000 + i]); y += sb(m.ram[0x83e8 + i]); orb.push([S0 + i, x - 0x80 + cx * 8 + 16, y - 0x80 + cy * 8 + 16, (N - 1 - i) & 1 ? 0 : 1]); }
        events.push({ f, kind: 'native', name: 'vision', show: S0, steps: Array.from({ length: 7 }, (_, k) => S0 + 7 * (k + 1)), orb });
      }
      else if (w === 38 && L4(0) === 0x5130) {   // the epilogue's court cheers its king [0x5130]: four balloons (24 px, at (0xD8, 0xE0), (0x118, 0xE0), (0xD8, 0x100),
        // (0x118, 0x100)) over the heroes till the script clears them (op 14)
        const [cx, cy] = camAt(f), nx = rec.ops.find(x => x.at > o.at && x.f > f);
        events.push({ f, kind: 'native', name: 'cheer', end: nx ? nx.f : f + 120, frame: 11, at: [[0xd8, 0xe0], [0x118, 0xe0], [0xd8, 0x100], [0x118, 0x100]].map(([X, Y]) => [X - 0x80 + cx * 8 + 12, Y - 0x80 + cy * 8 + 12]) });
      }
      else if (w === 35 || w === 42) events.push({ f, kind: 'join', cid: H(0) });
      else if (w === 41) events.push({ f, kind: 'summon', spell: R.B(0xedd7a + H(0)) });   // a summon gained (native 0x0EDD80: its spell, from the table at 0x0EDD7A, into the first free slot of 楊戩's record, ff1050; scenes 19, 27, 30, 39, 57)
      else if (w === 38 && L4(0) === 0x44ca && DESCENT) {   // the 昌平村 descent, measured by descent.py
        const e = { f, kind: 'descent', map: 'world-95a9', label: s(R, NATIVE_CARDS[0x44ca])[0].replace(/^\/+/, '') };
        for (const k of ['sprite', 'marker', 'path', 'fadeIn', 'fadeOut', 'frames']) e[k] = DESCENT[k];
        events.push(e); extraMaps['world-95a9'] = { w: 8, h: 7, terrain: Array.from({ length: 7 }, () => Array(8).fill(0)) };
      } else if (w === 38 && L4(0) === 0xe86cc && TOSS) events.push({ f, kind: 'toss', sprite: 'jade', path: TOSS.path });
      else if (w === 38 && L4(0) === 0xea6b8 && BRIDGE) events.push({ f, kind: 'native', name: 'bridge', end: BRIDGE.end, strikes: BRIDGE.strikes });
      else if (w === 38 && L4(0) === 0xf661e) {   // scene 42: the red wisp [0x0F661E]: a 16 px sprite from (0xE8, 0x70) on the screen
        // drops a pixel a frame for 91 frames, darts twice along the 52 steps of the tables at 0x0F651C (x) and 0x0F6550 (y);
        // then 21 frames it and its target blink pale, the burst sound (0x8048), the palette to white in eight steps of two
        // frames, 60 frames held, and back in eight steps
        const cam = [...rec.camera].reverse().find(c => c[0] <= f) || [0, 0, 0], sb = a => { const v = R.B(a); return v & 0x80 ? v - 256 : v; };
        let x = 0xe8, y = 0x70, t = f; const path = [], at = () => [t, x - 0x80 + cam[1] * 8 + 8, y - 0x80 + cam[2] * 8 + 8];
        for (let k = 0; k <= 0x5a; k++) { path.push(at()); y++; t++; }
        for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= 0x33; i++) { x += sb(0xf651c + i); y += sb(0xf6550 + i); path.push(at()); t++; }
        const hit = t + 21;
        events.push({ f, kind: 'native', name: 'wisp', path, blink: t, hit, white: [hit, hit + 16, hit + 76, hit + 92] }, { f: hit, kind: 'music', id: 0x8048 });
      }
      else if (w === 45) {   // [0x1B4E8] a 16 px sprite in sprite entry a[3] (y, size, entry, attribute, x on the screen, its art packed at L4(8)):
        // the 古文書 and other things handed over; on a unit's entry (32 + slot) it moves as that unit's record moves (op 22)
        const cam = [...rec.camera].reverse().find(c => c[0] <= f) || [0, 0, 0], entry = a[3];
        for (const l of lays) if (l.entry === entry && l.end == null) l.end = f;
        const lay = { f, entry, art: L4(8), line: (H(4) >> 13) & 3, x: H(6) - 0x80 + cam[1] * 8, y: H(0) - 0x80 + cam[2] * 8, end: null, blink: null };
        lay.src = pal3[lay.line] ?? 0x38436; lays.push(lay);
        if (TABLET_ART.includes(lay.art)) tablets.push({ k: TABLET_ART.indexOf(lay.art), appear: f, x: lay.x + 8, y: lay.y + 8, lay });
      }
      else if (w === 46) { for (const l of lays) if (l.entry === a[1] && l.end == null) { l.blink = [f, f + a[0]]; l.end = f + a[0]; } }   // [0x1B55A] entry a[1] blinks a[0] frames, then is gone
      else if (w === 31) pal3[a[1]] = L4(2);   // [0x19C58] palette line a[1] from L4(2)
      else if (w === 47) ascents.push({ f, entry: a[0] });   // [0x1B86C] a unit turns into light and flies up (below)
      else if (w === 38 && L4(0) === 0xfd0f6) {   // scene 63 [0x0FD0F6]: 紂王 and 申公豹 fuse. Each one's pose (its sheet + 0x1214, + its word + 6: three
        // 32 px frames) at slots 12 and 13's places, flickering (one frame in four); they close a pixel each every 5 frames, 16 steps; 64
        // frames more, the palette stepped to white every 5 (0x21820); then a map from white (0x0FD554, op 52's load), eight steps out of
        // white, and a heat haze over the new map settling over 126 frames (line scroll, its depth from 64 down)
        const cam = [...rec.camera].reverse().find(c => c[0] <= f) || [0, 0, 0], who = [];
        for (const sl of ['12', '13']) { const p = (rec.units[sl] || []).filter(([t, q]) => q && t <= f).pop(); if (!p) continue;
          const g = parseInt(p[1][2], 16), art = g + 0x1214 + R.W(g + 0x1214) + 6, name = 'fuse-' + p[1][2];
          files['assets/units/' + name + '.png'] = cutSheet(R, rom, art, 0x38436, 4, 3); who.push({ sheet: name, x: p[1][0], y: p[1][1], dir: sl === '12' ? 1 : -1 }); }
        const load = f + 145, mp = sceneMap(0xfd554);
        events.push({ f, kind: 'native', name: 'fuse', who, steps: [f, 5, 16], white: [f + 80, 5], load, haze: [load + 8, load + 134] });
        smaps.push({ f: load, map: mp.key }); events.push({ f: load, kind: 'map', map: mp.key, white: true }, { f: load, kind: 'fadeIn', speed: 0, white: true, frames: 8 });
        void cam;
      }
      else if (w === 38 && L4(0) === 0xfdad2) {   // scene 64 [0x0FDAD2]: sparkles fall down the corridor for 400 frames: 16 of 8 px (raw art at 0x039806, four
        // frames a frame every 8), at random x across 48 px of the screen's middle from above its top to 80 px down, 1-4 px a frame, each
        // starting over at the top with a new speed and place until 256 frames have gone; a chime (0x807F) every 11 frames while any falls
        const cam = [...rec.camera].reverse().find(c => c[0] <= f) || [0, 0, 0];
        files['assets/fx/sparkle.png'] = cutSheet(R, rom, 0x039806, 0x38436, 1, 4, true);
        events.push({ f, kind: 'native', name: 'sparkles', n: 16, x: [0x50 + cam[1] * 8, 0x7f + cam[1] * 8], y: [-8 + cam[2] * 8, 0x50 + cam[2] * 8], speed: [1, 4], respawn: f + 256, end: f + 401 });
        for (let t = f + 11; t < f + 300; t += 11) events.push({ f: t, kind: 'music', id: 0x807f });
      }
      else if (w === 38 && L4(0) === 0xf9a0a) {   // scene 54 [0x0F9A0A]: the four close on the middle a pixel a frame for 32 frames, a chime (0x807F), and
        // the one left becomes a light (assets/fx/scroll.png) where they met, till the next cut
        const tl = tablets.filter(tb => tb.lay.end == null); for (const tb of tl) { tb.lay.end = f + 32; tb.lay.cut = true; }   // (the cut acts them out: not props)
        events.push({ f: tl.length ? tl[0].appear : f, kind: 'native', name: 'tablets', tablets: tl.map(({ lay, ...tb }) => tb), close: f, meet: f + 32, end: null }, { f: f + 32, kind: 'music', id: 0x807f });   // (from the first laid: they show from then)
      }
      else if (w === 38 && L4(0) === 0xf9ab8) {   // scene 54 [0x0F9AB8]: the light (32 px at (0xE0, 0xE0)) flickers 31 frames, rises to (0xE0, 0xC0) and darts
        // three times round the 52 steps of the tables at 0x0F651C / 0x0F6550 (scene 42's wisp's), bursts (0x8048), then spirals out from
        // there 128 frames, a pixel further a frame, the angle 15 on a frame, the palette flashed white every 13 frames (0x21820)
        const cam = [...rec.camera].reverse().find(c => c[0] <= f) || [0, 0, 0], sb = a => { const v = R.B(a); return v & 0x80 ? v - 256 : v; };
        const mx = v => v - 0x80 + cam[1] * 8 + 16, my = v => v - 0x80 + cam[2] * 8 + 16;
        let x = 0xe0, y = 0xc0, t = f + 31; const path = [[t, mx(x), my(y)]];
        for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= 0x33; i++) { x += sb(0xf651c + i); y += sb(0xf6550 + i); t++; path.push([t, mx(x), my(y)]); }
        const tb = events.find(e => e.name === 'tablets'); if (tb) tb.end = f;
        events.push({ f, kind: 'native', name: 'light', at: [mx(0xe0), my(0xe0)], path, burst: t, spiral: [t, t + 128], flashes: Array.from({ length: 9 }, (_, k) => t + 13 * (k + 1)) }, { f: t, kind: 'music', id: 0x8048 });
      }
      else if (w === 38 && L4(0) === 0x21820 && !events.some(e => e.name === 'flash' && f - e.f < 8)) events.push({ f, kind: 'native', name: 'flash' });   // the palette stepped to white and back (0x21820, then 0x2186A, three frames each): a white flash
      else if (w === 38 && L4(0) === 0x256c) {   // the prologue's world map [0x256C]: the court gives way to the land, which pans east (below)
        events.push({ f, kind: 'map', map: 'prologue-world' }); smaps.push({ f, map: 'prologue-world' });
        extraMaps['prologue-world'] = { w: 32, h: 7, terrain: Array.from({ length: 7 }, () => Array(32).fill(0)) };
        pan = { f };
      }
      else if (w === 38 && L4(0) === 0x2bf4) events.push({ f, kind: 'fadeOut', speed: 6 });   // on over the sea [0x2BF4]: every colour a step darker each 6th frame, black in 42
      else if (w === 38 && L4(0) === 0x21732) {   // the night darkens to deep red [0x21732, then 0x466 shows it a frame on]: the map's palette lines a
        // step less a channel each, floored, the sprites' line untouched; four steps, held until the flash (0x278E)
        const d = events.find(e => e.name === 'redden' && f - e.steps[e.steps.length - 1] < 40);
        if (d) d.steps.push(f + 1); else events.push({ f, kind: 'native', name: 'redden', steps: [f + 1] });
      }
      else if (w === 38 && L4(0) === 0x278e) {   // the fox's army [0x278E]: two ranks of eight of the 戰將's sheet (0AEBC8, facing right) run in
        // from where the two 戰將 stand, a leader and seven behind him a frame apart, 10 px a frame from f + 3; the palette
        // rises to white from f + 15 (every 3rd frame), held from f + 30 to f + 33 (the sound 0x8069), and comes back down
        // over the red by f + 52; the army is gone at the white, and those it took stand as stone (below)
        const d = events.find(e => e.name === 'redden'); if (d) d.until = [f + 30, f + 52];
        events.push({ f, kind: 'native', name: 'army', sheet: '0aebc8', appear: f + 2, run: f + 3, speed: 10, n: 8, end: f + 30,
          ranks: [[608, 192, 1 / 3], [608, 256, -1 / 6]], white: [f + 15, f + 30, f + 33, f + 52] }, { f: f + 30, kind: 'music', id: 0x8069 });
      }
      else if (w === 38 && L4(0) === 0xeed30) {   // scene 23: the 龍吟劍 (0x0EED30): a light 96 frames, the middle chest opens on the sword (cell 12, 6), 96 frames more, the find sound and 20 frames of blinking
        events.push({ f, kind: 'native', name: 'sword', open: f + 96, found: f + 192, end: f + 212 }, { f: f + 192, kind: 'music', id: 0x8061 });
      } else if (w === 38 && L4(0) === 0x2a0a) {   // the fox spirit takes 妲己 (prologue f2633): the cut holds the script until it is done
        const nxt = rec.ops.find(x => x.at > o.at).f;
        events.push({ f, kind: 'native', name: 'possess', end: nxt });
      } else if (w === 38 && NATIVE_CARDS[L4(0)] !== undefined) {   // a native cut: its text as a card
        const ptr = L4(0);
        events.push({ f, kind: ptr === 0x44ca ? 'place' : 'narrate', lines: [s(R, NATIVE_CARDS[ptr])[0].replace(/^\/+/, '')] });
      } else if (w === 28) {   // a unit strikes, holding the script until the blow lands; its sound (0x8089) as the next op runs
        const nxt = rec.ops.find(x => x.at > o.at || x.f > f).f;
        events.push({ f, kind: 'strike', slot: String(a[0]), hit: nxt }); events.push({ f: nxt, kind: 'music', id: 0x8089 });
      } else if (w === 24) {
        const blk = a[1], x = a[2], y = a[3];
        events.push({ f, kind: 'cell', x, y, block: blk });
        if (!edits.has(curMap)) edits.set(curMap, new Set()); edits.get(curMap).add(blk);
      }
    }
    const atlas = {};
    for (const [d, ids0] of edits) {
      if (d === null) continue;
      const mp = sceneMap(d), ids = [...ids0].sort((p, q) => p - q);
      files['assets/maps/' + mp.key + '-blocks.png'] = blockAtlas(R, rom, mp.addr, ids);   // (the last scene to edit a map writes its atlas, as the Python did)
      atlases.set(mp.key, ids); atlas[mp.key] = ids;
    }
    const actors = {}, ghosts = [];
    const seenBy = new Map();   // sheet -> the units that wear it in this scene
    for (const [i, tr] of Object.entries(rec.units)) for (const [, k] of tr) if (k !== null) { if (!seenBy.has(k[2])) seenBy.set(k[2], new Set()); seenBy.get(k[2]).add(i); }
    const sole = new Set([...seenBy].filter(([, us]) => us.size === 1).map(([g]) => g));
    const dAt = drawnAt(rec);
    for (const [i, tr0] of Object.entries(rec.units)) {
      const tr = materialise(walks(tr0, 90, dAt), i, events, ghosts, 14, tr0);
      let pts = [], lastDir = 'down', lastFrame = 0;
      for (const [f, k] of tr) {
        if (k === null) { pts.push([f, null, null, null, null, null]); continue; }
        let [x, y, gfx, frame, flip] = k;
        const d = direction(frame, flip) || lastDir; lastDir = d;
        if (STILL.has(gfx) && frame < 0) frame = lastFrame;
        lastFrame = frame >= 0 ? frame : 0;
        pts.push([f, x, y, gfx, d, STILL.has(gfx) ? frame : null]);
      }
      pts = pinned(follow(pts, dAt, sole), camAt);
      pts = simplify(holds(hops(pts)), [3, 4, 5]);
      actors[i] = pts.map(p => p[1] === null ? [p[0]] : p[5] === null ? p.slice(0, 5) : p);
      for (const p of pts) if (p[3]) sheets.add(parseInt(p[3], 16));
    }
    for (const e of events) {
      if (e.kind !== 'native' || e.name !== 'possess') continue;
      // the fox is the unit the cut takes off (hidden on the cut's frame), the host the one who spoke just before
      let fox = null, k = 0;
      outer: for (const [i, tr] of Object.entries(actors)) for (let q = 1; q < tr.length; q++) if (eqv(tr[q], [e.f]) && tr[q - 1].length > 1) { fox = i; k = q; break outer; }
      const host = String([...events].reverse().find(x => x.kind === 'say' && x.f <= e.f).actor);
      const p = actors[fox][k - 1];
      Object.assign(e, { fox: { slot: fox, x: p[1], y: p[2], gfx: p[3], facing: p[4], still: p.length > 5 ? p[5] : null }, host });
      const later = smaps.filter(m => m.f > e.f).map(m => m.f), nmap = later.length ? Math.min(...later) : rec.frames;
      // her hide moves to the map change: without one, the player would walk her from here to her next spot
      actors[host] = actors[host].map(q => q.length === 1 && e.f <= q[0] && q[0] < nmap ? [nmap] : q);
    }
    const army = events.find(e => e.name === 'army');
    if (army) {   // those the fox's army took stand as stone [0x278E at the white: their sprites to the grey palette line, their records
      // cleared (so the recorder loses them), the sprites left as they were until the next map]: frozen on frame 7, unflipped
      const at = army.end, later = smaps.filter(m => m.f > at).map(m => m.f), until = later.length ? Math.min(...later) : rec.frames;
      for (const [i, tr] of Object.entries(actors)) {
        const k = tr.findIndex(q => q[0] === at && q.length === 1), p = k > 0 ? tr[k - 1] : null;
        if (!p || p.length < 5) continue;   // (lost at the white: those it cleared; the fox and the 戰將 are hidden from its start)
        actors[i] = [...tr.filter(q => q[0] < at), [at, p[1], p[2], p[3], 'down', 7, 1], ...tr.filter(q => q[0] >= until)];
        if (!actors[i].some(q => q[0] >= until)) actors[i].push([until]);
      }
    }
    if (tag === '00' && HUNT && actors['8']) {   // the rabbit (hunt.py) runs on as slot 8, the carcass the recording has from f276
      actors['8'] = [...HUNT.track, ...actors['8']];
      if (HUNT.swing && actors['0']) {   // 林雲's swing over the recording's standing pose
        const sw = HUNT.swing, a0 = actors['0'];
        actors['0'] = [...a0.filter(p => p[0] < sw[0][0]), ...sw, ...a0.filter(p => p[0] > sw[sw.length - 1][0])];
      }
      const until = actors['8'][HUNT.track.length][0];
      events = events.filter(e => !(e.kind === 'appear' && e.slot === '8' && e.f <= until));
      if (HUNT.hit) events.push({ f: HUNT.hit, kind: 'music', id: 0x8089 });
    }
    // a cut that grows a raw sprite of its own (海龍王's dragon, 0x0EE120): it stands as a unit of that sheet where the
    // hardware draws it from the cut on (the first raw sprite after it, and those within 48 px of it), fading in over
    // the cut's 18 frames of growth
    for (const [cut, gfx, slot, grow] of RAW_CUTS) {
      const op = rec.ops.find(o => o.op === 38 && parseInt(o.arg, 16) === cut); if (!op || !rec.drawn) continue;
      const pts = []; let first = null;
      for (const [f, list] of rec.drawn) { if (f < op.f) continue; const r = list.find(d => d[2] === '' && (!first || Math.hypot(d[0] - first[0], d[1] - first[1]) <= 48)); if (!r) continue; first = first || r; pts.push([f, r[0], r[1], gfx, 'down', 0]); }
      if (!pts.length) continue;
      actors[slot] = pts; events.push({ f: pts[0][0], kind: 'appear', slot, dur: grow });
    }
    // a cut that moves units' sprites itself and dresses one in a pose of its own (DRAWN_CUTS): from the cut on, each unit
    // stands where the hardware draws its sheet (the nearest within 16 px of where it was), and a raw sprite near a unit
    // is that unit in the cut's pose (the frame by the cut's timing), until its own sheet is drawn there again after the cut
    for (const op of rec.ops) {
      const C = op.op === 38 && DRAWN_CUTS[parseInt(op.arg.slice(0, 8), 16)]; if (!C || !rec.drawn) continue;
      const f0 = op.f, nx = rec.ops.find(x => x.at > op.at && x.f > op.f), f1 = nx ? nx.f : rec.frames;
      for (const [slot, tr] of Object.entries(actors)) {
        const p0 = [...tr].reverse().find(p => p[0] <= f0 && p.length > 1); if (!p0 || (tr.find(p => p[0] > p0[0]) || [1e9])[0] <= f0) continue;
        let cx = p0[1], cy = p0[2], moved = false, end = null; const pts = [];
        for (const [f, list] of rec.drawn) {
          if (f < f0) continue;
          const own = list.find(d => d[2] === p0[3] && Math.hypot(d[0] - cx, d[1] - cy) <= 16), raw = !own && list.find(d => d[2] === '' && Math.hypot(d[0] - cx, d[1] - cy) <= 40);
          if (f >= f1 && own && pts.some(p => p[3] === C.pose)) { end = f; break; }
          if (f >= f1 && !pts.some(p => p[3] === C.pose)) { end = f; break; }
          const r = own || raw; if (!r) continue;
          if (Math.hypot(r[0] - p0[1], r[1] - p0[2]) > 2 || raw) moved = true;
          cx = r[0]; cy = r[1];
          pts.push(raw ? [f, r[0], r[1], C.pose, p0[4], C.frame(f - f0)] : p0.length > 5 ? [f, r[0], r[1], p0[3], p0[4], p0[5]] : [f, r[0], r[1], p0[3], direction(r[3], r[4]) || p0[4]]);   // (a still keeps its frame)
        }
        if (!moved) continue;
        const stop = end ?? rec.frames;
        actors[slot] = [...tr.filter(p => p[0] < f0), ...pts, ...tr.filter(p => p[0] >= stop)];
        sheets.add(parseInt(C.pose, 16));
        if (C.slash && pts.some(p => p[3] === C.pose)) C.attacker = slot;
      }
      if (C.slash) {   // the blade's streak: from the attacker at the cut, at the one it strikes (the unit shoved furthest)
        let victim = null, far = 0;
        for (const [slot, tr] of Object.entries(actors)) { if (slot === C.attacker) continue; const a = tr.find(p => p[0] >= f0 && p.length > 1), b = [...tr].reverse().find(p => p[0] < f1 && p.length > 1);
          if (a && b && a[0] < b[0]) { const d = Math.hypot(b[1] - a[1], b[2] - a[2]); if (d > far) { far = d; victim = slot; } } }
        events.push({ f: f0, kind: 'native', name: 'slash', from: C.attacker, at: victim, hit: f0 + C.slash });
        C.attacker = null;
      }
    }
    for (const [t, slot, f0, f1, d] of FACE) if (t === tag && actors[slot]) actors[slot] = actors[slot].map(p => p.length > 1 && f0 <= p[0] && p[0] < f1 ? [...p.slice(0, 4), d, ...p.slice(5)] : p);
    for (const [t, slot, f0, f1] of HIDE) if (t === tag && actors[slot]) actors[slot] = actors[slot].filter(p => !(f0 <= p[0] && p[0] <= f1)).concat([[f0]]).sort((p, q) => p[0] - q[0]);
    // op 45's items as props of their own sprite (assets/units/item-<art>.png); one on a unit's entry follows that unit's record
    // (its path) while the unit itself is hidden: the hardware draws the item there, not the unit
    for (const l of lays) {
      if (l.cut) continue;
      const end = l.end ?? rec.frames, name = 'item-' + l.art.toString(16).padStart(6, '0'), slot = String(l.entry - 32), tr = rec.units[slot];
      files['assets/units/' + name + '.png'] = itemImage(R, rom, l.art, l.src);
      const ev = { f: l.f, kind: 'prop', name, x: l.x, y: l.y, until: end };
      if (l.blink) ev.blink = l.blink;
      if (l.entry >= 32 && tr) {
        ev.path = tr.filter(([t, p]) => p && t >= l.f && t <= end).map(([t, p]) => [t, p[0], p[1]]);   // (a null point: not drawn that frame)
        if (ev.path.length) { ev.x = ev.path[0][1]; ev.y = ev.path[0][2]; }
        const after = tr.find(([t]) => t > end), resume = after && after[1] && after[1][3] !== -1;
        if (actors[slot]) { const was = actors[slot].filter(p => p[0] >= l.f && p[0] <= end && p.length > 1).pop();
          actors[slot] = actors[slot].filter(p => !(p[0] >= l.f && p[0] <= end)).concat([[l.f]], resume && was ? [[end + 1, ...was.slice(1)]] : []).sort((p, q) => p[0] - q[0]); }
      }
      events.push(ev);
    }
    // op 47: the unit's sprite flashes with a light for 40 frames (the art at 0x03A07C, its frame at tile 0x20: assets/fx/light.png), then, as
    // the light, flies 56 frames along the tables at 0x1B7FA / 0x1B833 (0x8093 as it goes), while its shadow where it stood shrinks every 20
    // frames as its count down from 55 passes 40, 20 and 0 (24, 16, 8 px: 15, 35 and 55 frames into the flight) and is gone; the unit is not drawn after
    if (ascents.length) files['assets/fx/light.png'] = cutSheet(R, rom, 0x03a07c, 0x03a05c, 4, 3);
    for (const as of ascents) {
      const slot = String(as.entry - 32), tr = rec.units[slot] || [], at = tr.filter(([t, q]) => q && t <= as.f).pop(); if (!at) continue;
      const sb = a => { const v = R.B(a); return v & 0x80 ? v - 256 : v; }; let x = at[1][0], y = at[1][1]; const path = [[as.f + 40, x, y]];
      for (let i = 0; i < 56; i++) { x += sb(OP47_X + i); y += sb(OP47_Y + i); path.push([as.f + 41 + i, x, y]); }
      events.push({ f: as.f, kind: 'native', name: 'ascend', slot, at: [at[1][0], at[1][1]], flash: as.f + 40, path, shadow: [as.f + 55, as.f + 75, as.f + 95, as.f + 96] }, { f: as.f + 40, kind: 'music', id: 0x8093 });
      if (actors[slot]) { const after = actors[slot].filter(p => p[0] > as.f + 96 && p.length > 1);
        actors[slot] = actors[slot].filter(p => p[0] < as.f + 40).concat([[as.f + 40]], after).sort((p, q) => p[0] - q[0]); }
    }
    // lines whose frame's unit changes all come after them in the script: shown as the cast stood before (`pre`)
    const UNIT_OPS = new Set([2, 6, 14, 20, 21, 22, 25]), byf = new Map();
    for (const o of rec.ops) { if (!byf.has(o.f)) byf.set(o.f, []); byf.get(o.f).push(o.op); }
    for (const [f, ops] of byf) {
      const says = []; ops.forEach((w, i) => { if (w === 4 || w === 55) says.push(i); });
      if (!says.length) continue;
      const before = ops.slice(0, says[0]).some(w => UNIT_OPS.has(w) || w === 38 || w === 48), after = ops.slice(says[says.length - 1] + 1).some(w => UNIT_OPS.has(w));
      if (after && !before) for (const e of events) if (e.kind === 'say' && e.f === f) e.pre = true;
    }
    // a fade-in for a unit the final track shows right up to it: a gap follow() has filled since
    const shownBefore = (slot, f) => { const prev = (actors[slot] || []).filter(q => q[0] < f); return prev.length > 0 && prev[prev.length - 1].length > 1; };
    events = events.filter(e => !(e.kind === 'appear' && shownBefore(e.slot, e.f)));
    let cam = simplify(holds(cams.map(c => [c[0], c[1], c[2]])), []);
    if (pan) {   // the world map pans east a pixel a frame from the narration on [the 0x26AC callback, plane B's scroll] until the next
      // map (a smooth glide: the player eases between keys)
      const to = smaps.find(m => m.f > pan.f).f, from = pan.roll ?? pan.f;
      const before = cam.filter(c => c[0] < pan.f), held = before[before.length - 1];
      cam = [...before, [pan.f - 1, held[1], held[2]], [pan.f, 0, 0], [from, 0, 0], [to, (to - from) / 8, 0], ...cam.filter(c => c[0] > to)];
    }
    events.sort((p, q) => p.f - q.f);
    const mapinfo = {};
    for (const m of maps.values()) if (smaps.some(x => x.map === m.key)) mapinfo[m.key] = { w: m.w, h: m.h, terrain: m.terrain };
    Object.assign(mapinfo, extraMaps);
    // props: the 16x16 sprites the recorder names by their tiles (the jade), as stretches shown at a map spot
    const pr = rec.props || [];
    pr.forEach(([f0, items], k) => {
      const f1 = k + 1 < pr.length ? pr[k + 1][0] : rec.frames;
      const tossed = events.some(e => e.kind === 'toss' && e.path[0][0] - 2 <= f0 && f0 <= e.path[e.path.length - 1][0] + 2);
      for (const [name, x, y] of items) if (!tossed) events.push({ f: f0, kind: 'prop', name, x, y, until: f1 });
    });
    // [design, the user's call] lines where the speaker also holds up a prop the original shows elsewhere in the scene
    for (const e of events) {
      const hl = HOLD_LINES[tag + ':' + e.f];
      if (e.kind !== 'say' || !hl || e.actor === null || e.actor === undefined) continue;
      const pts = (actors[String(e.actor)] || []).filter(p => p[0] <= e.f && p.length > 3);
      const held = pts.length && hl[pts[pts.length - 1][3]];
      if (held) e.shows = held;
    }
    events.sort((p, q) => p.f - q.f);
    for (const e of events) {   // a strike's attack type: the striker's record +0x2B, as the scene's battle gives its sheet
      if (e.kind !== 'strike') continue;
      const pts = (actors[e.slot] || []).filter(p => p[0] <= e.f && p.length > 3), gfx = pts.length ? pts[pts.length - 1][3] : null;
      const ens = n ? battles[n].enemies : [], x = ens.find(x2 => hex6(x2.gfx) === gfx);
      e.type = x ? R.B(x.template + 0x2b) : 0;
    }
    out[tag] = { tag, chapter, battle: n, frames: holdAt != null ? Math.min(rec.frames, holdAt + 2) : rec.frames, maps: mapinfo, atlas, camera: cam, actors, ghosts, events };   // (the epilogue ends at its held last page)
    files['data/scenes/' + tag + '.js'] = '// scene ' + tag + ': generated by the extractor from the player\'s ROM.\n(window.SCENES ||= {})[' + J(tag) + '] = ' + J(out[tag]) + ';\n';
  }
  files['assets/fx/emotes.png'] = emotes(R, rom);
  return out;
}
export { sheetImage };
