// In-page QA probes, loaded with #qa in the URL (tools/qa/tour.js drives them). At each dialogue line the tour calls
// __qa.probe(), which measures the next rendered frame:
//   void      the share of the view above the dialogue box that is near-black (an unbuilt edge of a set)
//   framing   the speaker is off screen (or under the dialogue box) although the original showed them
//   visible   the speaker's pixels change when the actor is hidden (catches materials that silently fail to draw)
//   blown     the share of the speaker's pixels that are near-white (an actor washed out by a light)
//   haze      how much bloom and light shafts lift everything not already near white (a veil over the whole picture)
//   occluded  the share of rays from the camera to the speaker (head, chest, knees) that set geometry stops first (a
//             remade set's wall, throne or roof in front of the speaker; cut-out leaves and effects do not count)
// It also logs every fade and every line / card shown, and, every rendered frame, whether the world can be seen (the
// fade below half, no opaque screen over it) and which world it is (__remake.world: 'map:<key>' / 'battle:<n>'):
//   __qa.stale  characters drawn that the original does not show at that frame (wrong sprite in the slot, or hidden)
//   __qa.half   a character left half-dissolved (a fade-in frozen) while a line is shown
//   __qa.propLine  a prop (scene 4's jade) shown while a line of its own frame is up: it comes after them [the user's call]
//   __qa.jumps  the camera moving more than 2.5 cells in one frame while the world is in view
//   __qa.log  (when set to []) every frame: scene frame, fade, camera, actors (tools/qa/probe.js)
//   __qa.vis  segments { w, t0, t1, said } of one world in view; the tour flags a segment that is short and holds no
//             line or interactive screen (a flash of a scene), and a world swapped for another while in view (a pop)
import * as THREE from 'three';
import * as R from './rules.js';

export function install(E) {
  const Q = window.__qa = { fades: [], shown: [] };
  let pending = null;
  Q.vis = []; let seg = null, uiWas = false, lastCam = null, lastW = null;
  const fadeEl = document.getElementById('fade'), opaque = ['card-screen', 'loading'].map(id => document.getElementById(id));
  const interactive = ['dialog', 'title', 'camp', 'brief', 'end'].map(id => document.getElementById(id)).filter(Boolean);
  const on = el => el && !el.classList.contains('hidden') && +getComputedStyle(el).opacity > 0.5;
  window.__qaFrame = () => {
    if (pending) { const p = pending; pending = null; p(); }
    const st0 = window.__remake && window.__remake.sceneT;
    if (Q.log && st0 && (!Q.logRange || (st0.t >= Q.logRange[0] && st0.t <= Q.logRange[1]))) {   // tools/qa/probe.js: every frame drawn in the range, the scene frame, the fade, the camera and each actor as shown
      const r = window.__remake || {}, c = E.world.camera.position, st = r.sceneT;
      const a = []; for (const [u, x] of E.actors) a.push([String(u.slot), u.gfx || u.sprite, +x.pos.x.toFixed(3), +x.pos.z.toFixed(3), x.root.visible ? 1 : 0, x.walking ? Math.round(x.walkMs || 95) : 0, u.facing]);
      Q.log.push({ f: st ? +st.t.toFixed(2) : null, tag: st && st.tag, w: r.world, fade: +(+getComputedStyle(fadeEl).opacity).toFixed(2), cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], a });
    }
    const now = performance.now(), w = (window.__remake && window.__remake.world) || '?';
    const seen = +getComputedStyle(fadeEl).opacity < 0.5 && !opaque.some(on);
    if (seg && (!seen || seg.w !== w)) { seg.t1 = now; seg.next = seen ? w : null; Q.vis.push(seg); seg = null; }
    if (seen && !seg) seg = { w, t0: now, said: false };
    const ui = interactive.some(on);
    // a screen closing while the world stays in view starts a new stretch: what shows after it must hold on its own
    if (seg && seg.said && !ui && uiWas) { seg.t1 = now; seg.next = null; Q.vis.push(seg); seg = { w, t0: now, said: false, after: true }; }
    uiWas = ui;
    if (seg && ui) seg.said = true;
    // the cast and camera checks count any frame where the world shows at all (a half-faded screen still shows it)
    const worldDark = E.vfx && E.vfx.screen.dark > 0.95 && E.vfx.screen.darkCol.r > 0.95;   // the view darkened by the grade (the title's pan starting over)
    if (+getComputedStyle(fadeEl).opacity < 0.95 && !opaque.some(on) && !worldDark) checkFrame(w, now); else lastCam = null;
  };
  // every frame the world is in view: a character shown that the original is not showing at this frame (a hidden one,
  // or another sprite in that slot: the previous scene's cast left standing), and a camera jump (a cut seen happening)
  Q.stale = []; Q.jumps = []; Q.half = []; Q.propLine = [];
  function checkFrame(w, now) {
    const cam = E.world.camera.position;
    if (lastCam && lastW === w && cam.distanceTo(lastCam) > 2.5) Q.jumps.push({ w, t: now, d: +cam.distanceTo(lastCam).toFixed(1), from: lastCam.toArray().map(v => +v.toFixed(2)), to: cam.toArray().map(v => +v.toFixed(2)) });
    lastCam = cam.clone(); lastW = w;
    const st = window.__remake && window.__remake.sceneT; if (!st || !w.startsWith('map:')) return;
    const S = globalThis.SCENES && globalThis.SCENES[st.tag]; if (!S) return;
    const talking = on(document.getElementById('dialog'));
    const say = window.__remake.say; if (talking && say && say.tag === st.tag && (window.__remake.propsOn || []).includes(say.f)) Q.propLine.push({ w, f: say.f });
    for (const a of E.actors.values()) {
      if (talking && !a.hidden && a.root.visible && a.dissolve > 0.02 && a.dissolve < 0.98) Q.half.push({ w, f: Math.round(st.t), slot: a.u.slot, d: +a.dissolve.toFixed(2) });   // a fade-in held under a line
      if (a.hidden || a.u.slot == null || a.u.slot === 'descent' || !a.root.visible) continue;
      const tr = (window.__remake.tracks || {})[a.u.slot] || S.actors[a.u.slot]; if (!tr) continue;   // the track as shown (src/scene.js soften: a unit the camera left behind stays)
      let p = null; for (const q of tr) { if (q[0] > st.t) break; p = q; }
      const want = p && p.length > 1 ? p[3] : null;
      if (want !== a.u.gfx) { Q.stale.push({ w, t: now, f: Math.round(st.t), slot: a.u.slot, shown: a.u.gfx, want }); continue; }
      // the previous map's cast: a point from before this map loaded that the original drops a few frames after the load
      // (its screen still black then), shown here in view
      const at = window.__remake.mapAt, q = tr[tr.indexOf(p) + 1];
      if (p && at != null && p[0] < at && q && q[0] - at < 12 && (q.length === 1 || q[3] !== p[3])) Q.stale.push({ w, t: now, f: Math.round(st.t), slot: a.u.slot, shown: a.u.gfx, want: q.length === 1 ? 'hidden' : q[3] });
    }
  }
  Q.flush = () => { if (seg) { Q.vis.push(Object.assign({}, seg, { t1: performance.now(), open: true })); } return Q.vis; };
  const gl = () => E.world.renderer.getContext();
  const W = () => gl().drawingBufferWidth, H = () => gl().drawingBufferHeight;
  function read(x, y, w, h) {   // top-left origin, drawing-buffer pixels
    x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y)); w = Math.max(1, Math.min(W() - x, Math.floor(w))); h = Math.max(1, Math.min(H() - y, Math.floor(h)));
    const px = new Uint8Array(w * h * 4); gl().readPixels(x, H() - y - h, w, h, gl().RGBA, gl().UNSIGNED_BYTE, px); return px;
  }
  // did the original show this actor on its 256x224 screen at frame f?
  function origOnScreen(S, slot, f) {
    const tr = S.actors[slot]; if (!tr) return false;
    let p = null; for (const q of tr) { if (q[0] > f) break; p = q; }
    if (!p || p.length === 1) return false;
    let c = S.camera[0]; for (const q of S.camera) { if (q[0] > f) break; c = q; }
    const sx = p[1] - c[1] * 8, sy = p[2] - c[2] * 8;
    return sx > -16 && sx < 256 - 16 && sy > -16 && sy < 224 - 16;
  }
  function measure() {
    const w = W(), h = H(), out = {};
    // void: near-black share of the band between the letterbox and the dialogue box
    const y0 = h * 0.12, y1 = h * 0.72, all = read(0, y0, w, y1 - y0);
    let dark = 0, n = 0; for (let i = 0; i < all.length; i += 4 * 7) { n++; if (all[i] + all[i + 1] + all[i + 2] < 24) dark++; }
    out.void = +(dark / n).toFixed(3);
    // haze: how much the glow passes (bloom, light shafts) lift the frame's dark and mid tones, a veil over the picture
    {
      const W0 = E.world, b0 = W0.bloom.enabled, sh = (W0.shaftMeshes || []).map(m => m.visible);
      const A0 = read(0, y0, w, y1 - y0);
      W0.bloom.enabled = false; (W0.shaftMeshes || []).forEach(m => m.visible = false); E.world.render();
      const B0 = read(0, y0, w, y1 - y0);
      W0.bloom.enabled = b0; (W0.shaftMeshes || []).forEach((m, i) => m.visible = sh[i]); E.world.render();
      let lift = 0, k = 0;   // over all but what is already near white
      for (let i = 0; i < A0.length; i += 4 * 7) { const lb = (B0[i] + B0[i + 1] + B0[i + 2]) / 3; if (lb > 225) continue; lift += (A0[i] + A0[i + 1] + A0[i + 2]) / 3 - lb; k++; }
      out.haze = k ? +(lift / k / 255).toFixed(3) : 0;
    }
    const say = window.__remake && window.__remake.say; if (!say) return out;
    out.say = { tag: say.tag, n: say.n, f: say.f, who: say.who };
    const S = globalThis.SCENES[say.tag], slot = say.actor == null ? null : String(say.actor);
    const act = [...E.actors.values()].find(a => String(a.u.slot) === slot && !a.hidden);
    const orig = S && slot != null ? origOnScreen(S, slot, say.f) : false;
    out.speaker = { slot, orig };
    if (!act) { out.speaker.present = false; return out; }
    out.speaker.present = true;
    const k = w / E.canvasRect.width, head = E.project(act.head()), feet = E.project(act.pos);
    const hx = head.x * k, hy = head.y * k, fy = feet.y * k, sz = Math.max(8, fy - hy);
    out.speaker.inView = hx > w * 0.04 && hx < w * 0.96 && hy > h * 0.04 && fy < h * 0.74 && head.z < 1;
    if (!out.speaker.inView) return out;
    // visibility and exposure: the speaker's box with and without the actor
    const bx = hx - sz * 0.45, by = hy - sz * 0.15, bw = sz * 0.9, bh = sz * 1.15;
    const A = read(bx, by, bw, bh);
    act.root.visible = false; E.world.render(); const B = read(bx, by, bw, bh); act.root.visible = true; E.world.render();
    let diff = 0, mine = 0, white = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); diff += d;
      if (d > 45) { mine++; if (A[i] > 238 && A[i + 1] > 230 && A[i + 2] > 215) white++; }
    }
    out.speaker.diff = +(diff / (A.length / 4)).toFixed(1);
    out.speaker.visible = out.speaker.diff > 6;
    out.speaker.blown = mine ? +(white / mine).toFixed(2) : 0;
    // occlusion by set geometry
    const roots = new Set([...E.actors.values()].map(a => a.root)), cam = E.world.camera.position, ray = new THREE.Raycaster(); ray.camera = E.world.camera;   // sprites need it
    const solid = o => { if (!o.isMesh || o.isInstancedMesh && o.userData.noAO) return false; for (let q = o; q; q = q.parent) { if (roots.has(q) || !q.visible) return false; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material; return !(m.transparent || m.alphaTest > 0 || m.isShaderMaterial || m.isSpriteMaterial); };
    let blocked = 0; const hitBy = new Set(), pts = [act.head(), act.chest(), act.pos.clone().setY(act.pos.y + 0.25)];
    for (const p of pts) {
      const d = p.clone().sub(cam), L = d.length(); ray.set(cam, d.normalize()); ray.far = L - 0.3;
      const hit = ray.intersectObjects(E.world.scene.children, true).find(h => solid(h.object));
      if (hit) { blocked++; hitBy.add(hit.object.geometry.type.replace('Geometry', '') + '@' + hit.point.x.toFixed(1) + ',' + hit.point.z.toFixed(1)); }
    }
    out.speaker.occluded = +(blocked / pts.length).toFixed(2); out.speaker.by = [...hitBy].slice(0, 2).join(' ');
    return out;
  }
  // shadows cut out of a texture: three r160's shadow pass takes map + alphaTest from the object's own material, so a
  // customDepthMaterial's cutout is lost when the material has none (a sprite then casts a rectangle)
  Q.shadows = () => {
    const bad = new Set();
    E.world.scene.traverse(o => {
      const c = o.customDepthMaterial; if (!o.castShadow || !c || !(c.alphaTest > 0) || !o.visible) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!(m.alphaTest > 0) || !m.map) bad.add((o.parent && o.parent.type) + '/' + o.type + ' ' + (m.type || ''));
    });
    return [...bad];
  };
  Q.probe = () => new Promise(res => { pending = () => { try { res(measure()); } catch (e) { res({ error: String(e && e.stack || e).slice(0, 300) }); } }; });   // never hang the tour
  return Q;
}
export { R };
