// What a scene's recorded tracks become on screen, as pure functions (no three.js, no DOM), shared by the scene player
// (src/scene.js) and the data checks that run without a browser (test/scenes.mjs: jump, held, pace).

// the original's camera at frame f (in 8 px units), between its logged points
export const camOf = S => f => { let i = 0; while (i + 1 < S.camera.length && S.camera[i + 1][0] <= f) i++; const c = S.camera[i], d = S.camera[i + 1];
  if (!d || d[0] <= c[0] || f <= c[0]) return [c[1], c[2]]; const k = Math.min(1, (f - c[0]) / (d[0] - c[0])); return [c[1] + (d[1] - c[1]) * k, c[2] + (d[2] - c[2]) * k]; };
// the walk cycle's ms a frame at a walking speed (px a frame): a frame of the walk per 10 px; the soldiers' march (1 px
// a frame) at the pace they mark time standing
export const paceMs = pxPerFrame => Math.max(85, Math.min(170, 167 / Math.max(0.1, pxPerFrame)));
// a track at frame f, as the player poses it: null when hidden, else { x, y, gfx, facing, moving, speed (px a frame) }
export function at(tr, f) {
  let i = 0; while (i + 1 < tr.length && tr[i + 1][0] <= f) i++;
  const p = tr[i], q = tr[i + 1]; if (!p || p[0] > f || p.length < 2) return null;
  let x = p[1], y = p[2], moving = false, speed = 0;
  if (q && q.length > 1 && q[3] === p[3] && q[0] > p[0]) { const k = (f - p[0]) / (q[0] - p[0]); x += (q[1] - p[1]) * k; y += (q[2] - p[2]) * k; moving = q[1] !== p[1] || q[2] !== p[2]; speed = Math.hypot(q[1] - p[1], q[2] - p[2]) / (q[0] - p[0]); }
  return { x, y, gfx: p[3], facing: p[4] || 'down', moving, speed };
}

// the original moves actors and the camera in steps: 8 px held for a few frames, then the next 8 px in one frame (a
// walk, a hop of joy, a carcass shaken in the hand). At 60 Hz on its 256 px screen that reads as motion; on a big
// screen each step is a jolt. Here a track is sampled frame by frame and averaged over the last `w` frames (the step
// period: actors step every 5 frames, the camera every 8): a walk becomes a steady glide at the original's pace, a hop a
// quick rise and fall, never ahead of the original and at most `w` frames behind it. Cuts (a far jump, a hide) start the average afresh, so they stay cuts.
// With `cam` (an actor's track; cam(f) the original's camera then, in 8 px units) three more of the recording's
// artefacts go, each a stir on screen here that the original's small screen hides:
//  - the lag: the original builds its sprite table before it scrolls, so a unit drawn while the camera pans sits a
//    frame's scroll (8 px) off where it stands (tools/rom/record.py maps screen to map with the camera after the
//    scroll); the scroll is taken back off, so the cast stands still on the ground under a pan
//  - the screen edge: the original drops a sprite that the camera leaves behind; this view is wider than its 256x224
//    screen, so a unit standing still when it went off that screen stays where it stood (gone[]: the frames it comes
//    back, when the original's flicker-on there is no arrival)
//  - the tremble: shifts of up to 3 px that the original gives some sprites (the carcass in 林雲's hand, men shaking)
// and one of the original's stagecraft: off its 256x224 screen is offstage. A unit that walks off that screen and
// stands there, out of the original's sight, is still on the map (scene 3's guards wait in the corridor below for
// 700 frames), and this wider view would show it. out.offstage lists those stretches [from, to, fadeIn, fadeOut]
// (src/scene.js fades the unit out over them): it walked out of the original's screen, or stood off it from the start,
// and it walks back in, or never comes back. One the camera left standing (it did not move) stays shown.
export function soften(tr, far, w, cam, loads = []) {   // loads: the frames of map loads (a new map shows no one left from the old)
  if (tr.length < 2) return tr;
  const f0 = tr[0][0], f1 = tr[tr.length - 1][0], raw = [], gone = [];   // per frame: the point shown, and where (as pose() has it)
  const off = (x, y, c) => { const sx = x - c[0] * 8, sy = y - c[1] * 8; return sx <= -16 || sx >= 240 || sy <= -16 || sy >= 208; };
  let held = null, bx = 0, by = 0;
  for (let f = f0, i = 0; f <= f1; f++) {
    while (i + 1 < tr.length && tr[i + 1][0] <= f) i++;
    const p = tr[i], q = tr[i + 1];
    if (p.length < 2) {
      const b = raw[raw.length - 1], bb = raw[raw.length - 2];
      const cut = cam && (Math.abs(cam(f)[0] - cam(f - 1)[0]) > 2 || Math.abs(cam(f)[1] - cam(f - 1)[1]) > 2) || loads.some(m => m >= f - 2 && m <= f + 2);   // a camera cut or a map load: the original's hide stands
      if (held && loads.includes(f)) held = null;   // held past a pan, until the next map comes up
      // left behind by a pan, standing, and seen there again later (the camera came back): one that walked out of sight
      // and never returns there (scene 3's 伯邑考, led away) is gone, as in the original
      const back = () => { for (let j = i + 1; j < tr.length; j++) if (tr[j].length > 1) return Math.abs(tr[j][1] - b.rx) <= 8 && Math.abs(tr[j][2] - b.ry) <= 8; return false; };
      if (cam && !held && !cut && b && bb && b.x === bb.x && b.y === bb.y && off(b.rx, b.ry, cam(f)) && back()) held = b;
      raw.push(held && Object.assign({}, held, { held: true })); continue;
    }
    let x = p[1], y = p[2];
    if (q && q.length > 1 && q[3] === p[3] && q[0] > p[0]) { const k = (f - p[0]) / (q[0] - p[0]); x += (q[1] - p[1]) * k; y += (q[2] - p[2]) * k; }
    const rx = x, ry = y, fresh = !raw.length || !raw[raw.length - 1];
    if (held) { gone.push(f); held = null; }
    if (cam) {
      const c = cam(f), c0 = cam(f - 1), d = [c[0] - c0[0], c[1] - c0[1]].map(v => Math.abs(v) > 2 ? 0 : Math.max(-1, Math.min(1, v)));   // a cut moves sprites with it
      x -= d[0] * 8; y -= d[1] * 8;
      if (fresh || Math.abs(x - bx) > 3) bx = x; if (fresh || Math.abs(y - by) > 3) by = y; x = bx; y = by;
    }
    raw.push({ p, x, y, rx, ry });
  }
  const out = [tr[0]], key = r => r ? r.p.slice(3).join() : '';
  let sx = 0, sy = 0, win = [], prev = null, ww = w, last = -99;
  for (let k = 0; k < raw.length; k++) {
    const r = raw[k], f = f0 + k, b = k ? raw[k - 1] : null;
    if (!r) { if (b) out.push([f]); win = []; sx = sy = 0; prev = null; continue; }
    if (!b || Math.abs(r.x - b.x) > far || Math.abs(r.y - b.y) > far) { win = []; sx = sy = 0; }   // a cut (a new sprite a step away glides on: the rabbit struck falls into its carcass)
    // a slower stepper (the soldiers' march: 8 px every 8 frames) is averaged over its own step period, so it glides on
    // without a stop between steps
    else if (Math.abs(r.x - b.x) >= 4 || Math.abs(r.y - b.y) >= 4) {
      let gap = k - last; last = k;
      if (gap > 16) { gap = 99; for (let j = k + 1; j < Math.min(raw.length, k + 17); j++) { const n = raw[j]; if (!n) break; if (Math.abs(n.x - r.x) >= 4 || Math.abs(n.y - r.y) >= 4) { gap = j - k; break; } } }   // a first step: the period of the next
      ww = gap > w && gap <= 16 ? gap : w;
    }
    win.push(r); sx += r.x; sy += r.y; while (win.length > ww) { const o = win.shift(); sx -= o.x; sy -= o.y; }
    const pt = r.p.slice(); pt[0] = f; pt[1] = +(sx / win.length).toFixed(3); pt[2] = +(sy / win.length).toFixed(3);
    if (!prev || prev[1] !== pt[1] || prev[2] !== pt[2] || key(b) !== key(r) || win.length === 1) {
      if (prev && prev[0] < f - 1) { const h = prev.slice(); h[0] = f - 1; out.push(h); }   // the end of a hold: no ramp across it
      out.push(pt); prev = pt;
    }
  }
  if (out[0] === tr[0]) out.shift();
  out.offstage = cam ? offstage(raw, f0, cam, off) : [];
  // a track that ends held (hidden at its last point, kept where it stood after a pan): gone at the next map load
  if (tr[tr.length - 1].length < 2 && raw[raw.length - 1]) { const m = loads.find(m => m > tr[tr.length - 1][0]); if (m != null) out.push([m]); }
  out.gone = gone;
  return out;
}


// the stretches a unit is offstage (see soften): runs of frames it is shown, off the original's screen and not held
// after a pan; hidden when it walked out (it moved in the 10 frames before leaving), or was off from its first frame or
// put there by the script, and it walks back in (moving as it enters), is put elsewhere, or is gone. [from, to) in frames
export function offstage(raw, f0, cam, off) {
  const out = [], n = raw.length, dist = (a, b) => a && b ? Math.hypot(a.rx - b.rx, a.ry - b.ry) : 0;
  const ends = e => { for (let j = e + 1; j < n; j++) if (raw[j]) return false; return true; };   // nothing of the track after: it left for good
  const outside = k => { const r = raw[k]; return !!r && off(r.rx, r.ry, cam(f0 + k)); };   // held frames too: one that walked off and is then kept stays offstage (a stretch that begins held, the camera leaving it, is not hidden)
  for (let k = 0; k < n; k++) {
    if (!outside(k)) continue;
    let e = k; while (e + 1 < n && outside(e + 1)) e++;
    const before = k > 0 && raw[k - 1], after = e + 1 < n && raw[e + 1];
    const walkedOut = !!before && !before.held && !raw[k].held && dist(raw[k], raw[Math.max(0, k - 10)]) > 4;
    const placedIn = !!before && !raw[k].held && dist(raw[k], before) > 24, fromStart = (!before && !raw[k].held) || placedIn;   // put there by the script: a cut, no fade
    const walkedIn = !!after && !after.held && dist(raw[e + 1], raw[Math.max(k, e - 9)]) > 4;
    const placedAway = !!after && dist(after, raw[e]) > 24, gone = !after || placedAway;
    // (a short stretch is a brush with the edge, kept; one the track ends in is an exit however short: scene 7's heroes
    // leave at f1040 and their tracks stop just past the original's screen [the user's report])
    if ((walkedOut || fromStart) && (walkedIn || gone) && (e - k >= 30 || ends(e))) out.push([f0 + k, ends(e) ? Infinity : f0 + e + 1, !fromStart, !gone]);
    k = e;
  }
  return out;
}

// how far an actor shows at frame t, given its offstage stretches [from, to, fadeIn, fadeOut]: 0 inside one, fading
// over 16 frames at each soft edge (it walks out / in through the original's screen edge), the fade wholly on the
// offstage side: on the original's screen a unit is always whole (scene 5 f82: the heroes walking up into view were
// still 0.63 faded when the line froze the clock, a fade centred on the edge)
const OFF_FADE = 8;
export function offFade(st, t) {
  let a = 1;
  for (const [f0, f1, soft0, soft1] of st || []) {
    if (t < f0 || t >= f1) continue;
    const u0 = soft0 ? Math.min(1, Math.max(0, (t - f0) / (2 * OFF_FADE))) : 1;
    const u1 = soft1 ? Math.min(1, Math.max(0, (f1 - t) / (2 * OFF_FADE))) : 1;
    a = Math.min(a, 1 - Math.min(u0, u1));
  }
  return a;
}

// the scene map up at frame f (its last map event)
export function mapKeyOf(S, f) { let k = null; for (const e of S.events) { if (e.f > f) break; if (e.kind === 'map') k = e.map; } return k; }
// a point the script puts off the map, out of the original's sight (scene 3's 綠盔士 waits at x -128): never shown here
export const parked = (x, y, mm) => !!mm && (x < -48 || y < -48 || x > mm.w * 32 + 16 || y > mm.h * 32 + 16);
// every actor the scene player shows, as pure data (src/scene.js pose; test/oracle.mjs, tools/qa/shown.mjs):
// shownTracks(S) once, then shownAt(S, T, f) -> [{ slot, x, y, gfx, facing, still, fade }] (map px; fade 0 = offstage)
export function shownTracks(S) {
  const cam = camOf(S), loads = S.events.filter(e => e.kind === 'map' || e.kind === 'descent').map(e => e.f);
  return { cam, loads, tracks: Object.fromEntries(Object.entries(S.actors).map(([slot, tr]) => [slot, soften(tr, 24, 5, cam, loads)])) };
}
export function shownAt(S, T, f) {
  const mm = S.maps[mapKeyOf(S, f)], out = [], cur = T.cur || (T.cur = {});
  for (const [slot, tr] of Object.entries(T.tracks)) {
    let i = cur[slot] || 0; if (i >= tr.length || (tr[i] && tr[i][0] > f)) i = 0;   // a cursor: frames asked in order cost no search
    while (i + 1 < tr.length && tr[i + 1][0] <= f) i++;
    cur[slot] = i;
    const p = tr[i], q = tr[i + 1]; if (!p || p[0] > f || p.length < 2) continue;
    let x = p[1], y = p[2];
    if (q && q.length > 1 && q[3] === p[3] && q[0] > p[0]) { const k = (f - p[0]) / (q[0] - p[0]); x += (q[1] - p[1]) * k; y += (q[2] - p[2]) * k; }
    if (parked(x, y, mm)) continue;
    out.push({ slot, x, y, gfx: p[3], facing: p[4] || 'down', still: p[5], fade: offFade(tr.offstage, f) });
  }
  return out;
}
// the stretches [from, to) the world is lit: from a fade-in or a line until a fade-out, a map load, a page or a battle
export function litStretches(S) {
  const lit = []; let on = null;
  for (const e of S.events) {
    if ((e.kind === 'fadeIn' || e.kind === 'say') && on == null) on = e.f;
    else if (['fadeOut', 'map', 'descent', 'narrate', 'place', 'battle'].includes(e.kind) && on != null) { lit.push([on, e.f]); on = null; }
  }
  if (on != null) lit.push([on, S.frames]);
  return lit;
}
