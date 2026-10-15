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

const PROLOGUE = { base: 0x200e, chapter: 8 };
const PROLOGUE2 = { base: 0x4374, chapter: 8 };   // 新的開始: 女媧's heaven, the descent to 昌平村, 十五年後, the village
const NATIVE_CARDS = { 0x44ca: 0x95a9, 0x490e: 0x3590, 0xe875a: 0xe86a2 };   // native cuts -> the text they show (record.js)
const HOLD_LINES = { '04:656': { '04f0fc': ['jade', 13, 10], '05219c': ['jade', 4, 10] } };   // (scene, frame): the speaker's sheet -> [prop, dx, dy] off its sprite (the original's: 林雲 f580, 燕蓉 f543)
// [design] facings the original does not have: (scene, slot, from, to, facing). Scene 3: 林雲 and 伯邑考 turn to face
// the camera at f921 while they still talk; here they keep facing each other until the guards come up (f953) [the user's call]
const FACE = [['03', '0', 921, 953, 'left'], ['03', '1', 921, 953, 'right']];
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
function narration(R, ptr) {
  const lines = []; let i = ptr;
  for (let k = 0; k < 16; k++) {
    const [t, j] = s(R, i, 200); i = j; lines.push(t.replace(/^\/+/, ''));
    if (R.B(i) === 0xff || R.B(i) === 0x00 || !t) break;
  }
  return lines;
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
// the original flickers a sprite to bring a unit on (op 48) and for a phantom's translucency: short hidden gaps are
// dropped, the unit fades in where it first arrives (an 'appear' event), and one that keeps flickering is a ghost
function materialise(tr, slot, events, ghosts, gap = 14) {
  const out = [], toggles = new Map(); let i = 0;
  while (i < tr.length) {
    const [f, k] = tr[i], last = out[out.length - 1];
    if (k === null && last && last[1] !== null && i + 1 < tr.length && tr[i + 1][1] !== null && tr[i + 1][0] - f <= gap) {
      const g = last[1][2]; toggles.set(g, (toggles.get(g) || 0) + 1); i++; continue;
    }
    if (k !== null && (!last || last[1] === null)) {
      const nxt = tr.slice(i + 1, i + 6).filter(p => p[1] === null);
      let close = false; for (let q = i + 1; q < Math.min(tr.length, i + 6); q++) if (tr[q][1] !== null && tr[q][0] - tr[q - 1][0] <= gap) close = true;
      if (nxt.length && close) events.push({ f, kind: 'appear', slot: String(slot), dur: 30 });
    }
    out.push([f, k]); i++;
  }
  for (const [g, n] of toggles) if (n > 6) ghosts.push(slot + ':' + g);
  return out;
}
// where the hardware draws a unit's sheet (unique on screen, worn by this unit alone) 8 px or more from its track for
// 12 frames or more, the track follows the hardware (scene 8: 紂王 pacing before his throne)
function follow(pts0, drawn, sole, near = 64, off = 8, run = 12) {
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
export function exportScenes(R, rom, recs, battles, natives = {}, files = {}, sheets = new Set()) {
  const { SCENES, CHAPTER } = tables(R);
  const BATTLE_OF_SCENE = {}; for (let n = 1; n <= 32; n++) BATTLE_OF_SCENE[battles[n].scene] = n;
  const { descent: DESCENT, hunt: HUNT, toss: TOSS, bridge: BRIDGE } = natives;
  const STILL = stills([...Object.values(recs), ...Object.values(natives).filter(Boolean)]);
  const maps = new Map(), atlases = new Map();
  const sceneMap = desc => {
    if (maps.has(desc)) return maps.get(desc);
    const [info, img] = mapOf(R, rom, null, desc), key = hex6(desc);
    files['assets/maps/' + key + '.png'] = img;
    const mp = { key, w: info.w, h: info.h, terrain: info.terrain, addr: info.addr }; maps.set(desc, mp); return mp;
  };
  const out = {};
  for (const tag of ['prologue', 'prologue2', ...Array.from({ length: 65 }, (_, i) => String(i).padStart(2, '0'))]) {
    const rec = recs[tag]; if (!rec) continue;
    const extraMaps = {}; let st, chapter, n;
    if (tag === 'prologue') { st = staticOps(R, PROLOGUE.base, PROLOGUE.chapter); chapter = 0; n = null; }
    else if (tag === 'prologue2') { st = staticOps(R, PROLOGUE2.base, PROLOGUE2.chapter); chapter = 0; n = null; }
    else { const si = +tag; st = staticOps(R, SCENES[si], CHAPTER[si]); chapter = CHAPTER[si] + 1; n = BATTLE_OF_SCENE[si] ?? null; }
    const cams = rec.camera;
    const camAt = f => { let c = cams[0]; for (const x of cams) { if (x[0] > f) break; c = x; } return [c[1], c[2]]; };
    let events = []; const smaps = [], edits = new Map(); let curMap = null;
    const hexb = h => { const b = []; for (let i = 0; i < h.length; i += 2) b.push(parseInt(h.substr(i, 2), 16)); return b; };
    for (const o of rec.ops) {
      const f = o.f, w = o.op, a = hexb(o.arg), so = st.get(o.at) || {};
      const H = k => a[k] << 8 | a[k + 1], L4 = k => (a[k] << 24 | a[k + 1] << 16 | a[k + 2] << 8 | a[k + 3]) >>> 0;
      if (w === 0 || w === 13) {
        const desc = w === 0 ? R.L(0x1586 + 4 * H(0)) : L4(0);
        const mp = sceneMap(desc); curMap = desc;
        smaps.push({ f, map: mp.key }); events.push({ f, kind: 'map', map: mp.key });
      } else if (w === 4 || w === 55) {
        const text = so.text || '', at = text.indexOf('：'), who = at >= 0 ? text.slice(0, at) : text, said = at >= 0 ? text.slice(at + 1) : '';
        events.push({ f, kind: 'say', who: said ? who : '', text: said || text, speaker: so.speaker ?? null, actor: so.actor ?? null });
      } else if (w === 11) {
        const [cx, cy] = camAt(f);
        events.push({ f, kind: 'emote', x: H(0) - 0x80 + cx * 8, y: H(2) - 0x80 + cy * 8, emote: a[4], loops: a[5] + 1, hold: a[6], delay: a[7] });
      } else if (w === 14 && a[0] <= 30 && 30 <= a[1]) events.push({ f, kind: 'emoteOff' });
      else if (w === 1) events.push({ f, kind: 'fadeIn', speed: H(0) });
      else if (w === 8) events.push({ f, kind: 'fadeOut', speed: H(0) });
      else if (w === 56) events.push({ f, kind: 'music', id: H(0) });
      else if (w === 10) events.push({ f, kind: 'battle', n });
      else if (w === 54) events.push({ f, kind: 'narrate', lines: narration(R, L4(2)) });
      else if (w === 35 || w === 42) events.push({ f, kind: 'join', cid: H(0) });
      else if (w === 38 && L4(0) === 0x44ca && DESCENT) {   // the 昌平村 descent, measured by descent.py
        const e = { f, kind: 'descent', map: 'world-95a9', label: s(R, NATIVE_CARDS[0x44ca])[0].replace(/^\/+/, '') };
        for (const k of ['sprite', 'marker', 'path', 'fadeIn', 'fadeOut', 'frames']) e[k] = DESCENT[k];
        events.push(e); extraMaps['world-95a9'] = { w: 8, h: 7, terrain: Array.from({ length: 7 }, () => Array(8).fill(0)) };
      } else if (w === 38 && L4(0) === 0xe86cc && TOSS) events.push({ f, kind: 'toss', sprite: 'jade', path: TOSS.path });
      else if (w === 38 && L4(0) === 0xea6b8 && BRIDGE) events.push({ f, kind: 'native', name: 'bridge', end: BRIDGE.end, strikes: BRIDGE.strikes });
      else if (w === 38 && L4(0) === 0x2a0a) {   // the fox spirit takes 妲己 (prologue f2633): the cut holds the script until it is done
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
      const tr = materialise(walks(tr0, 90, dAt), i, events, ghosts);
      let pts = [], lastDir = 'down', lastFrame = 0;
      for (const [f, k] of tr) {
        if (k === null) { pts.push([f, null, null, null, null, null]); continue; }
        let [x, y, gfx, frame, flip] = k;
        const d = direction(frame, flip) || lastDir; lastDir = d;
        if (STILL.has(gfx) && frame < 0) frame = lastFrame;
        lastFrame = frame >= 0 ? frame : 0;
        pts.push([f, x, y, gfx, d, STILL.has(gfx) ? frame : null]);
      }
      pts = follow(pts, dAt, sole);
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
    for (const [t, slot, f0, f1, d] of FACE) if (t === tag && actors[slot]) actors[slot] = actors[slot].map(p => p.length > 1 && f0 <= p[0] && p[0] < f1 ? [...p.slice(0, 4), d, ...p.slice(5)] : p);
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
    const cam = simplify(holds(cams.map(c => [c[0], c[1], c[2]])), []);
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
    out[tag] = { tag, chapter, battle: n, frames: rec.frames, maps: mapinfo, atlas, camera: cam, actors, ghosts, events };
    files['data/scenes/' + tag + '.js'] = '// scene ' + tag + ': generated by the extractor from the player\'s ROM.\n(window.SCENES ||= {})[' + J(tag) + '] = ' + J(out[tag]) + ';\n';
  }
  files['assets/fx/emotes.png'] = emotes(R, rom);
  return out;
}
export { sheetImage };
