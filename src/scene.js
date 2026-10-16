// The story scene player. A scene (data/scenes/SS.js, from tools/rom/record.py + export_scenes.py) is the original's
// own timeline: map loads, the camera, every actor's track and timed events, in frames of the original (60 Hz).
// Dialogue and narration take no frames there; here the clock waits for them. The battle op splits a scene into its
// intro (play(…, 'intro') stops at it) and its outro (play(…, 'outro') starts after it).
// Space plays at 4x, Esc skips to the end of the part. Court scenes (only 紂王's court speaking) get the cutaway look.
import * as THREE from 'three';
import * as R from './rules.js';
import { spriteKey } from './sprites.js';
import { emoteTexture, FRAMES as EMOTE_FRAMES } from './emotes.js';
import { registerSets, setFor, dress } from './sets.js';
import REMADE from './remake/index.js';
import * as Audio from './audio.js';
import { soften, camOf, paceMs, at, offFade, mapKeyOf, parked as parkedOff } from './tracks.js';
registerSets(REMADE);
const { G } = R;
const $ = id => document.getElementById(id);
const COURT = ['紂王', '妲已', '妲己', '費仲', '尤渾', '申公豹', '聞太師', '狐狸精', '崇侯虎', '崇應彪'];
// the scene camera: steep enough that the original's painted walls and pillars stand up instead of leaning away
// a long lens from far back (fov 12° instead of 30°): nearly the flat projection the art was drawn for, so walls stay parallel
const VIEW = { pitch: 1.25, dist: 33, fov: 12 };
// on a rebuilt HD set the walls and pillars are real geometry, so the camera comes down to an HD-2D angle
const SET_VIEW = { pitch: 0.95, dist: 20, fov: 22 };
let view = VIEW;
const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
// op 11's balloon kinds -> frames of assets/fx/emotes.png [ROM 0x19CDC] (drawn from src/emotes.js, its HD redraw)
const EMOTE = { 0: [0, 1, 2], 1: [3], 2: [4], 3: [5], 4: [6, 7], 5: [8, 9, 10] }, EMOTE_REST = [11, 12];

function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); }); }
export async function sceneData(tag) {
  if (!(globalThis.SCENES && globalThis.SCENES[tag])) await loadScript('data/scenes/' + tag + '.js');
  return globalThis.SCENES[tag];
}
// a court cutaway: everyone who speaks on this map (until the next map load) is of 紂王's court
function isCourt(S, f) {
  const i = S.events.findIndex(e => e.kind === 'map' && e.f >= f), j = S.events.findIndex((e, k) => k > i && e.kind === 'map');
  const who = S.events.slice(i, j < 0 ? undefined : j).filter(e => e.kind === 'say' && e.who).map(e => e.who);
  return who.length > 0 && who.every(w => COURT.includes(w));
}

// a black overlay for the original's fades
function fade(to, sec) {
  if (window.__qa) window.__qa.fades.push({ t: performance.now(), to });
  const f = $('fade'); if (f.style.opacity === String(to)) return Promise.resolve();   // already there (or going there): a new transition would restart it from the old value
  f.style.transition = 'opacity ' + sec + 's'; f.style.opacity = to;
  return new Promise(r => setTimeout(r, sec * 1000));
}
// narration pages (op 54) and chapter cards: ink text on black, click to continue
async function card(E, lines, cls, beforeHide) {
  const c = $('card-screen'); c.className = 'screen ' + (cls || ''); c.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  c.classList.remove('hidden'); if (window.__qa) window.__qa.shown.push({ t: performance.now(), kind: 'card' });
  await new Promise(res => { const go = () => { c.removeEventListener('click', go); window.removeEventListener('keydown', key); res(); }; const key = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') go(); }; c.addEventListener('click', go); window.addEventListener('keydown', key); });
  if (beforeHide) beforeHide();
  c.classList.add('hidden');
}
// what the screen shows next, from event i: the first event that changes the picture ('end' if none)
const CARDS = ['narrate', 'place'], DARK_AFTER = ['fadeOut', 'map', 'narrate', 'place', 'battle', 'end'];
function nextVisual(evs, i) {
  for (; i < evs.length; i++) if (['say', 'fadeIn', 'fadeOut', 'map', 'narrate', 'place', 'battle', 'emote', 'appear'].includes(evs[i].kind)) return evs[i].kind;
  return 'end';
}
export const chapterCard = (E, ch) => card(E, ['第' + (CN[ch] || ch) + '章'], 'chapter');

// the balloon (src/emotes.js: the original's 13 frames redrawn at 256 px), untoned and unfogged so its white stays white
let emoteTex = null;
function emoteSprite(scene) {
  const tex = (emoteTex || (emoteTex = emoteTexture())).clone(); tex.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, fog: false }));
  s.material.map.repeat.set(1 / EMOTE_FRAMES, 1); s.scale.set(0.8, 0.8, 1); s.renderOrder = 8; scene.add(s); return s;
}

// a thrown thing's sprite (assets/units/<name>.png, 16 px: half a cell), lit like the cast
function tossSprite(scene, name) {
  const tex = new THREE.TextureLoader().load('assets/units/' + name + '.png'); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, fog: false }));
  s.scale.set(0.5, 0.5, 1); s.renderOrder = 7; scene.add(s); return s;
}
// a scene map as the world: a stand-in battle with the map's size and terrain, no units
async function showMap(E, S, key, court) {
  const m = S.maps[key];
  R.loadBattle({ n: 'scene', name: '', chapter: S.chapter, mapW: m.w, mapH: m.h, terrain: m.terrain, deploy: [[0, 0]], enemies: [], win: [], lose: [], party: { deployMax: 0, forced: [], unavailable: [], joins: [] }, intro: [], outro: [] }, [], {});
  const sprites = new Set();
  for (const tr of Object.values(S.actors)) for (const p of tr) if (p[3]) sprites.add(spriteKey(parseInt(p[3], 16)));
  const set = setFor(key); view = set ? SET_VIEW : VIEW;
  await E.loadWorld({ look: set ? { set } : { mapSD: 'assets/maps/' + key + '.png' }, sprites: [...sprites] });
  if (set) await dress(E, set);
  if (court) E.world.grade.uniforms.uSat.value = set ? 0.98 : 0.85;      // 紂王's court: colour a little drained, and a letterbox
  E.vfx.screen.barsTarget = court ? 0.55 : 0;
  E.world.camera.fov = view.fov; E.world.camera.updateProjectionMatrix();
  if (!set && E.world.scene.fog) E.world.scene.fog.density = 0.003;          // the far camera would otherwise sit in haze
}
// three compiles a material and uploads its textures when the object first comes into view: on a pan that is a stall
// mid-motion (scene 0, f313: 4 programs and 9 textures, ~65 ms). So the first frame of a map, still dark, is drawn
// once with nothing culled (the shadow pass too), with the world's lights and environment as they will be.
const WINGED = '061a72';   // 雷震子's sheet
function warm(E) {
  const W = E.world, off = [];
  W.scene.traverse(o => { if (o.frustumCulled) { o.frustumCulled = false; off.push(o); } });
  W.render(); for (const o of off) o.frustumCulled = true;
}

// play one part of a scene; hooks: { join(cid) }. Resolves 'battle' when the intro reaches the battle, else 'end'.
// development: #scene=N&at=F starts the first scene played at frame F (the events before it run at once: maps, set
// edits, joins, the song; no lines, cards or fades), posed as the original has it then; a frame past the scene's
// battle starts its outro there (the battle skipped); with &hold the clock then stays at F
let seekAt = +((location.hash.match(/[#&]at=(\d+)/) || [])[1] ?? NaN);
// (a frame past the scene's battle: its second part, the outro, is played from there, the battle skipped: main.js)
export const seekPast = S => { const b = S.events.find(e => e.kind === 'battle'); return !!b && Number.isFinite(seekAt) && seekAt > b.f; };
const seekHold = /[#&]hold\b/.test(location.hash);   // &hold: and stay there (the clock stopped: tools/qa/compare.js shots)
export async function play(E, tag, part, hooks) {
  const S = await sceneData(tag);
  const bi = S.events.findIndex(e => e.kind === 'battle');
  let seek = Number.isFinite(seekAt) && (part !== 'outro' || (bi >= 0 && seekAt > S.events[bi].f)) ? seekAt : null, lit = false; seekAt = NaN;
  let t0 = 0, evs = S.events;
  if (part === 'outro') { if (bi < 0) return 'end'; t0 = S.events[bi].f; evs = S.events.slice(bi + 1); }
  else if (bi >= 0) evs = S.events.slice(0, bi + 1);
  const tEnd = part === 'intro' && bi >= 0 ? S.events[bi].f : S.frames;
  // the map to stand on at t0: the last map loaded before it (the outro may play on the battle map)
  let mapKey = null;
  for (const e of S.events) { if (e.f > t0 || (part === 'outro' && e === S.events[bi])) break; if (e.kind === 'map') mapKey = e.map; }
  if (part === 'intro') mapKey = null;
  const units = new Map();      // actor slot -> unit
  const cams = soften(S.camera, 3, 8);
  const camAt = camOf(S), loads = S.events.filter(e => e.kind === 'map' || e.kind === 'descent').map(e => e.f);
  let t = t0, fast = false, skip = false, emote = null, emoteEv = null, worldReady = false, fresh = false, toss = null, tossEv = null;
  let frameFix = 0, camFast = false;   // cells the camera moves south (+) or north to keep a line's speaker clear of the dialogue box and the top edge
  const appearing = new Map();   // slot -> a fade-in in progress (the original flickers the sprite on)
  // a unit's strike (op 28, export_scenes.py: scene 3's 燕蓉 smashing the lock): its attack frames until the blow, the
  // slash's flash, and on the blow the set reacts (dungeon.js: the lock flies off); posed from the clock, so seeks hold
  const strikes = S.events.filter(e => e.kind === 'strike'), struck = new Set(), slashed = new Set();
  // props (export_scenes.py: the 16x16 sprites the original shows apart from the units, the jade in scene 4): shown over
  // [f, until) at their map spot, held up in front of the hero beside it; a line's `shows` prop for that line only
  // [the user's call] a prop comes up once the event list has passed it: after the lines of its own frame (scene 4: 燕蓉's
  // jade after her line at f543, 林雲's after his at f580), not under them
  const propEvs = S.events.filter(e => e.kind === 'prop'), props = new Map(), propsPassed = new Set();   // event -> sprite
  let lineProp = null;
  const propAt = (spr, mx, my) => {   // a 16x16 sprite's top-left in map px -> in front of the unit there, at chest height
    // the unit's sprite stands up from its cell's centre (map y + 16); the prop's rows above that are height on it
    const P = E.tileCenter((mx + 8) / 32 - 0.5, Math.floor((my + 8) / 32) - 0.5 + 0.5), up = (Math.floor((my + 8) / 32) * 32 + 32 - (my + 8)) / 32;
    spr.position.set(P.x, P.y + up * 1.1, P.z + 0.05); spr.scale.set(0.62, 0.62, 1); spr.visible = true; };
  const keydown = e => { if (e.key === ' ') { fast = true; e.preventDefault(); } if (e.key === 'Escape') skip = true; };
  const keyup = e => { if (e.key === ' ') fast = false; };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  E.ui.show('hud', false);
  const atLabel = document.getElementById('scene-at'); atLabel.classList.remove('hidden');
  const setMap = async (key, cut) => {
    await fade(1, 0.25);
    units.clear(); emote = null; toss = null; tossEv = null; props.clear(); lineProp = null;
    await showMap(E, S, key, !cut && isCourt(S, t)); worldReady = !cut; fresh = true;
    if (window.__remake) { window.__remake.world = 'map:' + key; window.__remake.mapAt = t; }
    for (const [slot, tr] of Object.entries(S.actors)) {
      const u = { side: 'npc', name: '', sprite: 'p0', x: 0, y: 0, facing: 'down', alive: true, status: { sleep: 0, seal: 0, poison: 0 }, buf: {}, hp: 1, mhp: 1, mp: 0, mmp: 0, done: false, slot };
      const sk = strikes.find(e => e.slot === slot); if (sk) u.atkType = sk.type;   // its action frames of the attack type it strikes with
      units.set(slot, { u, tr: soften(tr, 24, 5, camAt, loads) });
    }
    if (window.__remake) window.__remake.tracks = Object.fromEntries([...units].map(([k, a]) => [k, a.tr]));   // what is shown (src/qa.js)
    G.units = []; E.syncActors();
    if (!cut) pose(true);
  };
  const clock = () => new Promise(r => { const t1 = performance.now(); requestAnimationFrame(() => r(Math.min(0.1, (performance.now() - t1) / 1000) * (fast ? 4 : 1))); });
  const strike = (e, act, t, snap) => {
    const a0 = e.f + 2, n = Math.max(3, e.hit - a0), fv = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[act.u.facing] || [0, -1];
    act.act = t >= a0 && t < e.hit ? { kind: 'atk', frame: Math.min(2, Math.floor(3 * (t - a0) / n)) } : null;
    const at = act.pos.clone().add(new THREE.Vector3(fv[0] * 0.75, 0, fv[1] * 0.75)), quiet = snap || t > e.hit + 20;
    if (!slashed.has(e) && t >= e.hit - 4) {   // the original's slash flashes over the blow (f2488)
      slashed.add(e);
      if (!quiet) { const r = E.vfx.ribbon({ col: [0.85, 0.92, 1], width: 0.1, n: 14, fade: 0.25 }), side = new THREE.Vector3(fv[1], 0, -fv[0]), c = act.pos.clone().add(new THREE.Vector3(fv[0] * 0.45, 1.05, fv[1] * 0.45));
        let k = 0; const step = dt => { k = Math.min(1, k + dt / 0.12); r.push(c.clone().add(side.clone().multiplyScalar(0.55 - k * 1.1)).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * 0.3, 0))); if (k >= 1) { r.end(); E.world.updaters.splice(E.world.updaters.indexOf(step), 1); } }; E.world.updaters.push(step); }
    }
    if (!struck.has(e) && t >= e.hit) {   // the blow lands: the set acts it out (the sound is the scene's own event at this frame)
      struck.add(e); const set = worldReady && setFor(mapKeyOf(S, t));
      if (set && set.strike) set.strike(E, at.x, at.z, quiet);
      else if (!quiet) E.vfx.burst(at.clone().setY(at.y + 0.6), { n: 20, speed: 2.5, cols: [[1, 0.95, 0.7], [1, 1, 1]], size: 0.04, life: 0.5 });
    }
  };
  // put every actor where its track says at time t
  const pose = snap => {
    if (window.__remake) window.__remake.sceneT = { tag, t };   // the original frame now shown (src/qa.js checks actors against it)
    atLabel.textContent = 'scene=' + tag + ' at=' + Math.round(t) + (mapKeyOf(S, t) ? '  map ' + mapKeyOf(S, t) : '');   // where we are, for #scene=…&at=…
    const set = worldReady && setFor(mapKeyOf(S, t)), stand = set && set.standIn;
    for (const [slot, a] of units) {
      const tr = a.tr; let i = 0; while (i + 1 < tr.length && tr[i + 1][0] <= t) i++;
      const p = tr[i], q = tr[i + 1], vis = p && p[0] <= t && p.length > 1;
      let act = E.actors.get(a.u);
      const mk = mapKeyOf(S, t), mm = mk && S.maps[mk];
      const parked = vis && parkedOff(p[1], p[2], mm);   // (scene 3's 綠盔士 waits at x -128)   // put off the map by the script, out of the original's sight: never in ours (our view is wider)
      if (!vis || parked) { if (act) { act.hidden = true; act.root.visible = false; } if (a.standGfx && stand && stand.hide) { stand.hide(E, a.standGfx); a.standGfx = null; } continue; }   // a set's stand-in goes when its sprite does   // at once: the next frame may be a fade's first
      const key = spriteKey(parseInt(p[3], 16));
      if (!act || a.u.sprite !== key) {
        if (act) { act.dispose(E.world.scene); E.actors.delete(a.u); }
        a.u.sprite = key; if (!G.units.includes(a.u)) G.units.push(a.u); E.syncActors(); act = E.actors.get(a.u);
      }
      let x = p[1], y = p[2], moving = false;
      if (q && q.length > 1 && q[3] === p[3] && q[0] > p[0]) { const k = (t - p[0]) / (q[0] - p[0]); x += (q[1] - p[1]) * k; y += (q[2] - p[2]) * k; moving = q[1] !== p[1] || q[2] !== p[2]; }
      if (stand && stand[p[3]]) { act.hidden = true; a.standGfx = p[3]; stand[p[3]](E, x / 32 + 0.5, y / 32 + 0.5, moving, { tag, t }); continue; }   // a remade set plays this sprite with a model (valley: the cart)
      a.u.still = p[5];   // a sheet the original never walk-cycles (export_scenes.py stills): the frame it shows
      a.u.gfx = p[3]; a.u.facing = p[4] || 'down'; a.u.x = Math.round(x / 32); a.u.y = Math.round(y / 32);
      const wasWalking = act.walking; act.hidden = false; act.walking = moving;
      act.fade = offFade(tr.offstage, t);   // offstage: walked off the original's screen (src/tracks.js): faded out
      if (moving) { const sp = Math.hypot(q[1] - p[1], q[2] - p[2]) / (q[0] - p[0]);
        if (sp <= 6) act.pace = act.pace == null || !wasWalking ? sp : act.pace * 0.7 + sp * 0.3;   // a new walk starts at its own pace (and follows the ease-in of a softened track within a few frames); a jump (a cut between two spots) is no walking speed
        act.walkMs = paceMs(act.pace ?? 1); }
      if ((S.ghosts || []).includes(slot + ':' + p[3]) && !act.ghost) {   // the original's flicker-translucency (that sprite in that slot): a steady phantom
        act.ghost = true; for (const m of [act.mesh.material, act.big.material]) { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; m.needsUpdate = true; }
      }
      const ap = appearing.get(slot);
      if (ap) {
        const k = Math.min(1, (t - ap.t0) / ap.dur); act.dissolve = 1 - k;
        if (ap.burst) { ap.burst = false; const P = act.chest(); E.vfx.burst(P, { n: 24, speed: 1.6, cols: [[0.85, 0.8, 1], [1, 1, 1]], size: 0.04, life: 0.9, g: -0.5, up: 0.3 }); E.vfx.ring(act.pos, [0.75, 0.7, 1], 1.1, 0.6, { intensity: 0.6 }); }
        if (k >= 1) { appearing.delete(slot); act.dissolve = 0; }
      }
      const wx = x / 32 + 0.5, wz = y / 32 + 0.5, P = E.tileCenter(wx - 0.5, wz - 0.5);
      act.pos.set(wx, P.y, wz); act.off.set(0, 0);
      if (p[3] === WINGED && !act.hover) act.hover = 0.7;   // 雷震子 flies: held in the air, so our tilted view keeps the gap the original shows (scene 15: he hung on 文王 before taking him up, the user)
      const sk = strikes.find(e => e.slot === slot && t >= e.f && t < e.hit + 40);
      if (sk) strike(sk, act, t, snap);
      else if (act.act && act.act.kind === 'atk') act.act = null;
    }
    // the camera: the original's view centre (camera * 8 px + half its 256x224 screen; the game runs in H32 mode)
    let i = 0; while (i + 1 < cams.length && cams[i + 1][0] <= t) i++;
    const c = cams[i], d = cams[i + 1]; let cx = c[1], cy = c[2];
    if (d && d[0] > c[0] && t > c[0]) { const k = Math.min(1, (t - c[0]) / (d[0] - c[0])); cx += (d[1] - c[1]) * k; cy += (d[2] - c[2]) * k; }
    const shift = (set && set.viewShift) || 0;   // a set whose cast stands low on the original's screen (its camera at the map's foot): framed above the dialogue box
    const target = E.tileCenter((cx * 8 + 128) / 32 - 0.5, (cy * 8 + 112) / 32 - 0.5 + shift + frameFix);
    if (!(window.__remake && window.__remake.camHold)) {   // camHold: a QA shot has taken the camera (tools/qa/capture.js)
      E.cam.shot(target, { free: true, dist: view.dist, pitch: view.pitch, yaw: 0, speed: snap ? 100 : camFast ? 16 : 4 });
      if (snap) E.cam.snap();
    }
    if (emote && emoteEv) {
      const fr = EMOTE[emoteEv.emote] || EMOTE_REST, k = fr[Math.floor(t / Math.max(4, emoteEv.delay || 8)) % fr.length];
      emote.material.map.offset.x = k / EMOTE_FRAMES;
      const pop = Math.min(1, (t - emoteEv.f) / 9), sc = 0.8 * (pop < 1 ? 0.55 + 0.45 * Math.sin(pop * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1);   // pops up with a slight overshoot
      emote.scale.set(sc, sc, 1);
      // beside the speaker's head, where the original draws it (its balloon is 16 px right of and 16 px above the speaker's
      // sprite in every scene): on the actor nearest the balloon's spot, not on the ground behind it (that put it high up
      // the wall behind 林雲 in scene 3)
      let near = null, nd = 48;
      for (const a of units.values()) { const q = at(a.tr, t), act = q && E.actors.get(a.u); if (!act || act.hidden) continue; const d = Math.hypot(q.x - emoteEv.x + 16, q.y - emoteEv.y - 16); if (d < nd) { nd = d; near = { act, dx: emoteEv.x - q.x }; } }
      if (near) { const H = near.act.head(); emote.position.set(H.x + Math.sign(near.dx || 1) * 0.7, H.y + 0.5, H.z); }   // up and to the side, its tail at the head
      else { const P = E.tileCenter((emoteEv.x + 16) / 32 - 0.5, (emoteEv.y + 16) / 32 - 0.5); emote.position.set(P.x, P.y + 1.1, P.z); }
    }
    if (window.__remake) window.__remake.propsOn = [];
    for (const e of propEvs) {
      const on = worldReady && propsPassed.has(e) && t >= e.f && t < e.until && mapKeyOf(S, e.f) === mapKeyOf(S, t);
      let spr = props.get(e);
      if (on && !spr) { spr = tossSprite(E.world.scene, e.name); props.set(e, spr); }
      if (spr) { if (on) propAt(spr, e.x, e.y); else spr.visible = false; }
      if (on && window.__remake) window.__remake.propsOn.push(e.f);   // (src/qa.js: none may show under a line of its own frame)
    }
    if (tossEv) {   // a thing thrown (scene 3's jade, toss.py): from the thrower's hand to the catcher's on a smooth arc
      // [design: the original's arc up its flat screen, 1-2 px steps, read as a hop; here a true parabola in 3D over the
      // cells' post, its timing the original's (toss.py), the jade turning and glinting as it flies]
      const P = tossEv.path, f0 = P[0][0], f1 = P[P.length - 1][0], u = (t - f0) / (f1 - f0);
      if (u >= 1) { if (toss) toss.visible = false; tossEv = null; }
      else if (u >= 0) {
        if (!toss) toss = tossSprite(E.world.scene, tossEv.sprite);
        const a = P[0], b = P[P.length - 1], A = E.tileCenter((a[1] + 8) / 32 - 0.5, (a[2] + 8) / 32 - 0.5), B = E.tileCenter((b[1] + 8) / 32 - 0.5, (b[2] + 8) / 32 - 0.5);
        const k = u * u * (3 - 2 * u) * 0.25 + u * 0.75;   // a little slow at the ends: thrown, then caught
        const y = A.y + 0.55 + (B.y - A.y) * k + 4 * 1.05 * k * (1 - k);   // hand height, up 1.05 at the top (its lower edge just clears the 1.35 post; higher it left the view)
        toss.position.set(A.x + (B.x - A.x) * k, y, A.z + (B.z - A.z) * k); toss.visible = true;
        toss.material.rotation = -u * Math.PI * 3;
        if (Math.random() < 0.5) E.vfx.spark(toss.position.x, toss.position.y, toss.position.z, { vx: (Math.random() - 0.5) * 0.2, vy: -0.1, vz: 0, life: 0.5, size: 0.04, r: 0.7, gg: 1, b: 0.8, g: 0, shape: 0 });
      }
    }
  };
  if (mapKey) await setMap(mapKey);
  if (tag === 'prologue' && part === 'intro') Audio.music(0x15);   // the new game's prologue sets its song before its script (0x2cdc)
  let ei = 0;
  try {
    for (;;) {
      // events due now
      while (ei < evs.length && (evs[ei].f <= t || skip || (seek != null && evs[ei].f < seek))) {
        const e = evs[ei++];
        if (e.kind === 'prop') propsPassed.add(e);
        if (seek != null && e.f < seek) {   // seeking (#at=): the state at the seek frame, nothing shown on the way
          if (e.kind === 'music') { if (e.id < 0x8000) Audio.play(e.id); }
          else if (e.kind === 'map') { await setMap(e.map); lit = false; }
          else if (e.kind === 'descent') { await setMap(e.map, true); await fade(1, 0); lit = false; }
          else if (e.kind === 'fadeIn' || e.kind === 'say') lit = true;
          else if (e.kind === 'fadeOut' || CARDS.includes(e.kind)) lit = e.kind !== 'fadeOut' && lit;
          else if (e.kind === 'emote' && worldReady) { if (!emote) emote = emoteSprite(E.world.scene); emote.visible = true; emoteEv = e; }
          else if (e.kind === 'emoteOff' && emote) { emote.visible = false; emoteEv = null; }
          else if (e.kind === 'toss' && worldReady && e.path[e.path.length - 1][0] >= seek) tossEv = e;   // still in the air at the seek frame
          else if (e.kind === 'cell' && worldReady && setFor(mapKeyOf(S, e.f))) setFor(mapKeyOf(S, e.f)).cell?.(E, e.x, e.y, e.block);
          else if (e.kind === 'cell' && worldReady && S.atlas[mapKeyOf(S, e.f)]) await E.world.paintCell(e.x, e.y, 'assets/maps/' + mapKeyOf(S, e.f) + '-blocks.png', S.atlas[mapKeyOf(S, e.f)].indexOf(e.block));
          else if (e.kind === 'join' && hooks && hooks.join) hooks.join(e.cid);
          else if (e.kind === 'native' && worldReady) setFor(mapKeyOf(S, e.f))?.native?.(E, e, () => t);   // the set shows the state at the seek frame
          else if (e.kind === 'battle') { ei--; seek = null; }   // past the first part: the battle comes as usual
          continue;
        }
        if (e.kind === 'music') { if (!skip || e.id < 0x8000) Audio.play(e.id); continue; }   // a song (skipping: still the right one), an effect
        if (skip && !['map', 'join', 'cell', 'battle'].includes(e.kind)) continue;
        if (e.kind === 'map') await setMap(e.map);   // stays dark until the original's fade-in (or the first line / card)
        else if (e.kind === 'fadeIn' && worldReady && !CARDS.includes(nextVisual(evs, ei))) {   // a fade-in for a page brings up the page, not the map
          t = Math.max(t, e.f); pose(fresh); if (fresh) { warm(E); await clock(); } fresh = false;   // cast and camera as the original has them at the fade-in (set and drawn once while dark; snap on a new map)
          await fade(0, 0.25 + 0.08 * e.speed);
        }
        else if (e.kind === 'fadeOut') await fade(1, 0.25 + 0.08 * e.speed);
        else if (e.kind === 'say') {
          t = e.pre ? e.f - 0.5 : e.f;   // show the line at its own frame: the clock may have run past it, and units can leave one frame later; a line the script runs before its frame's unit changes (export_scenes.py `pre`) shows the cast as it stood before them
          for (const ap of appearing.values()) ap.dur = Math.min(ap.dur, Math.max(1, t - ap.t0));   // a fade-in under way finishes: a line never holds a unit half-dissolved
          pose(fresh); if (fresh) warm(E); fresh = false;
          // the speaker framed above the dialogue box and below the top edge (the band the tour's framing probe checks): the
          // original's 224 px screen is all view, ours loses its lower third to the box, so a cast low or high on the
          // original's screen can fall out of ours (scene 3: guards in the corridor below the cells, 林雲 in his cell above)
          const sp = e.actor != null && units.get(String(e.actor)), sa = sp && E.actors.get(sp.u);
          if (sa && !sa.hidden) {
            const H = E.canvasRect.height, hd = E.project(sa.head()), ft = E.project(sa.pos), dn = E.project(sa.pos.clone().setZ(sa.pos.z + 1));
            const ppc = Math.max(8, dn.y - ft.y), need = ft.y > H * 0.7 ? (ft.y - H * 0.7) / ppc : hd.y < H * 0.07 ? -(H * 0.07 - hd.y) / ppc : 0;
            if (need) { frameFix = Math.max(-2.5, Math.min(2.5, frameFix + need)); camFast = true; for (let k = 0; k < 14; k++) { pose(); await clock(); } camFast = false; }   // a quick glide there before the box comes up (no jump)
          }
          await fade(0, 0.2);   // pose first: the fade must not reveal the frame before
          if (e.shows && sa && !sa.hidden) {   // [design, the user's call] the speaker holds up the prop for the line
            const pt = at(sp.tr, t); if (!lineProp) lineProp = tossSprite(E.world.scene, e.shows[0]);
            if (pt) propAt(lineProp, pt.x + e.shows[1], pt.y + e.shows[2]);
          }
          if (window.__remake) window.__remake.say = { tag, f: e.f, who: e.who, actor: e.actor, n: (window.__remake.say && window.__remake.say.tag === tag ? window.__remake.say.n : 0) + 1 };
          if (window.__qa) window.__qa.shown.push({ t: performance.now(), kind: 'say' });
          await E.ui.say(e.text, e.who || null);
          if (lineProp) lineProp.visible = false;
          if (!(evs[ei] && evs[ei].kind === 'say' && evs[ei].f === e.f)) frameFix = 0;   // after the last line here, back to the original's framing (a glide)
        }
        else if (e.kind === 'descent') { await setMap(e.map, true); if (!skip) await descend(E, e, () => clock().then(dt => fast ? dt / 4 : dt), () => skip); await fade(1, 0); }   // the 2 s cut at its own pace (space does not hurry it; Esc skips)
        else if (CARDS.includes(e.kind)) {   // a narration page (op 54) or a location card (the original's map cut), over this stretch
          await card(E, e.lines, e.kind, () => { if (DARK_AFTER.includes(nextVisual(evs, ei))) fade(1, 0); });   // nothing to see next: stay dark
          if (ei < evs.length) t = Math.max(t, evs[ei].f);
        }
        else if (e.kind === 'emote' && worldReady) { if (!emote) emote = emoteSprite(E.world.scene); emote.visible = true; emoteEv = e; if (window.__remake) window.__remake.emote = emote; }
        else if (e.kind === 'emoteOff' && emote) { emote.visible = false; emoteEv = null; }
        else if (e.kind === 'toss' && worldReady && !skip) tossEv = e;
        else if (e.kind === 'cell' && worldReady && setFor(mapKeyOf(S, e.f))) { const st = setFor(mapKeyOf(S, e.f)); if (st.cell) st.cell(E, e.x, e.y, e.block); }   // a remade set acts the change out (a door opens)
        else if (e.kind === 'cell' && worldReady && S.atlas[mapKeyOf(S, e.f)]) await E.world.paintCell(e.x, e.y, 'assets/maps/' + mapKeyOf(S, e.f) + '-blocks.png', S.atlas[mapKeyOf(S, e.f)].indexOf(e.block));
        else if (e.kind === 'join' && hooks && hooks.join) hooks.join(e.cid);
        else if (e.kind === 'native' && worldReady) setFor(mapKeyOf(S, e.f))?.native?.(E, e, () => t);   // a native cut a remade set acts out (scene 6's bridge): it reads the scene clock
        else if (e.kind === 'appear' && worldReady && !skip && !((units.get(e.slot) || {}).tr || { gone: [] }).gone.some(g => Math.abs(g - e.f) <= 12)) appearing.set(e.slot, { t0: e.f, dur: Math.max(20, e.dur || 30), burst: true });
        else if (e.kind === 'battle') { await fade(1, 0.4); return 'battle'; }   // dark while the battle's world is built
      }
      if (seek != null) {   // the seek frame reached: pose, snap the camera, show it if the original shows the world then
        t = Math.max(t, seek); seek = null;
        if (worldReady) { pose(true); warm(E); fresh = false; await clock(); if (lit) await fade(0, 0.2); }
        if (window.__remake) window.__remake.seeked = t;
        if (seekHold) for (;;) { pose(); await clock(); }   // held at the seek frame (a QA shot), for good
      }
      if (t >= tEnd || skip) break;
      if (worldReady) pose();
      const dt = await new Promise(r => { const t1 = performance.now(); requestAnimationFrame(() => r((performance.now() - t1) / 1000)); });
      t += Math.min(0.1, dt) * 60 * (fast ? 4 : 1);
    }
    if (part !== 'intro' || bi < 0) await fade(1, 0.4);
    return 'end';
  } finally {
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); atLabel.classList.add('hidden');
    if (emote) { emote.parent && emote.parent.remove(emote); }
    if (toss) { toss.parent && toss.parent.remove(toss); }
    for (const spr of props.values()) spr.parent && spr.parent.remove(spr); if (lineProp) lineProp.parent && lineProp.parent.remove(lineProp);
    E.vfx.screen.barsTarget = 0; E.world.grade.uniforms.uSat.value = 1.08;
    E.world.camera.fov = 30; E.world.camera.updateProjectionMatrix();   // back to the battle lens
  }
}
// the 昌平村 descent (0x44CA; measured by tools/rom/descent.py). The original fades the world map in as clouds clear,
// with the village marked and labelled, and holds the screen still; 林雲 drops in at the top edge tumbling (his
// facings cycled, the sprite turned over), then dives head first (his front frame upside down) onto the village, the
// sprite shrinking as he falls away from the viewer, to a dot just above the marker, where he is gone; the map fades out.
// Here the camera holds as the original's; he hangs on the camera ray through the original's sprite, sized to it.
// the original's 2.3 s cut, played slower so it can be followed: the tumble at SLOW, the 11-frame dive at DIVE.
// AIR: how far up the camera ray he hangs; ART: his drawn figure is the original's box, the sprite's quad a little more
const SLOW = 1.6, DIVE = 3, AIR = 0.45, ART = 1.45;
let cloudTex = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * 78, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.6, r = 26 + Math.random() * 40;
    const lit = 0.75 + 0.25 * (1 - y / 256);   // lit from above, shaded underneath
    const gr = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r); gr.addColorStop(0, `rgba(${255 * lit | 0},${250 * lit | 0},${255 * lit | 0},0.34)`); gr.addColorStop(0.6, `rgba(${235 * lit | 0},${230 * lit | 0},${245 * lit | 0},0.16)`); gr.addColorStop(1, 'rgba(220,220,240,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  cloudTex = new THREE.CanvasTexture(c); cloudTex.colorSpace = THREE.SRGBColorSpace; return cloudTex;
}
async function descend(E, e, clock, skipped) {
  const P = e.path, f0 = P[0][0], maxH = Math.max(...P.map(p => p[3]));
  const fFall = P.filter(p => p[3] >= maxH * 0.9).pop()[0], fLand = P[P.length - 1][0];
  const L = E.tileCenter(e.marker[0] / 32 - 0.5, (e.marker[1] - 10) / 32 - 0.5);       // where he lands: the village
  const S3 = E.world.scene, view = { dist: 7.8, pitch: 1.06, fov: 34 };   // the map (8 x 7 cells) fills the view, as on the original's screen
  E.world.camera.fov = view.fov; E.world.camera.updateProjectionMatrix();
  E.cam.shot(E.tileCenter(3.5, 3.0), { free: true, dist: view.dist, pitch: view.pitch, yaw: 0, speed: 100 }); E.cam.snap();
  // 林雲, high in the sky
  const u = { side: 'npc', name: '林雲', sprite: spriteKey(parseInt(e.sprite, 16)), x: Math.round(L.x), y: Math.round(L.z), facing: 'down', alive: true, status: { sleep: 0, seal: 0, poison: 0 }, buf: {}, hp: 1, mhp: 1, mp: 0, mmp: 0, done: true, slot: 'descent' };
  G.units.push(u); E.syncActors(); const act = E.actors.get(u); act.hidden = true;
  // clouds between the camera and the land, parting as the screen comes up
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1, 0.98, 0.95) }));
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4, r = 0.6 + Math.random() * 3.2;
    m.position.set(L.x - 1.5 + Math.cos(a) * r, 3 + Math.random() * 6, L.z + Math.sin(a) * r * 0.7); const sc = 6 + Math.random() * 6; m.scale.set(sc, sc * 0.7, 1);
    m.renderOrder = 9; m.userData = { a, v: 3 + Math.random() * 3 }; S3.add(m); clouds.push(m);
  }
  const label = document.createElement('div'); label.className = 'map-label'; label.textContent = e.label; const fadeEl = document.getElementById('fade'); fadeEl.parentNode.insertBefore(label, fadeEl);   // under the fades
  const place = () => { const q = E.project(new THREE.Vector3(L.x, L.y, e.marker[1] / 32 + 0.15)); label.style.left = (E.canvasRect.left + q.x) + 'px'; label.style.top = (E.canvasRect.top + q.y) + 'px'; };
  place(); fade(0, 1.1);
  const tF = (fFall - f0) * SLOW, tOut = tF + (fLand - fFall) * DIVE + (e.fadeOut - fLand) * SLOW + 45, END = tOut + 70;   // from 林雲's entry, slowed; a beat longer on the village
  let t = -(f0 * SLOW), gone = false, lastFace = -1;
  try {
    while (t < END && !skipped()) {
      const dt = await clock(); t += dt * 60;
      const kc = Math.min(1, (t + f0 * SLOW) / (f0 * SLOW + 8)); for (const m of clouds) {    // clouds: drift out of the way and thin
        m.position.x += Math.cos(m.userData.a) * m.userData.v * dt; m.position.z += Math.sin(m.userData.a) * m.userData.v * 0.6 * dt; m.position.y += dt * 0.8;
        m.material.opacity = 0.7 * Math.max(0, 1 - kc * 1.2);
      }
      place();
      if (t > tOut && !label.classList.contains('out')) { label.classList.add('out'); fade(1, 1.2); }
      const f = t < tF ? f0 + t / SLOW : fFall + (t - tF) / DIVE;   // the original's frame
      if (f < f0 || gone) continue;
      if (f >= fLand) { gone = true; act.hidden = true; continue; }   // a dot over the marker, then gone (no flash in the original)
      act.hidden = false;
      // the original's sprite this frame: box centre x, box bottom y, box height (screen px = map px, 32 a cell)
      const i = P.findIndex(q => q[0] > f), a = P[Math.max(0, i - 1)], b = i < 0 ? P[P.length - 1] : P[i], kk = b[0] > a[0] ? (f - a[0]) / (b[0] - a[0]) : 0;
      const sx = a[1] + (b[1] - a[1]) * kk, sy = a[2] + (b[2] - a[2]) * kk, sh = a[3] + (b[3] - a[3]) * kk;
      let px;                                      // his size on the original's screen
      if (f < fFall) {                             // tumbling in at the top edge (clipped there: a whole 32 px sprite)
        px = 32; act.spin = (f - f0) * 0.45; u.still = null;
        const face = Math.floor((f - f0) / 3) % 4; if (face !== lastFace) { lastFace = face; u.facing = ['down', 'left', 'up', 'right'][face]; }
      } else {                                     // the dive: head first, falling away
        px = Math.max(2, sh); u.facing = 'down'; u.still = 0;
        const up = Math.PI * (2 * Math.ceil((act.spin - Math.PI) / (2 * Math.PI)) + 1);   // the nearest upside-down turn ahead
        act.spin += (up - act.spin) * Math.min(1, 0.35 * dt * 60);
      }
      // a point on the ray through the sprite's middle, part way up to the camera; scaled to look the original's size
      const mid = f < fFall && sy - sh < 0 ? sy - 16 : sy - sh / 2;   // cut by the screen's top edge: the whole sprite's middle
      const C = E.world.camera.position, G0 = E.tileCenter(sx / 32 - 0.5, mid / 32 - 0.5);
      act.centre = (act.centre || new THREE.Vector3()).copy(G0).lerp(C, AIR); act.size = px / 32 * (1 - AIR) * ART;
      act.pos.set(act.centre.x, G0.y, act.centre.z);
    }
    await fade(1, 0.3);
  } finally {
    label.remove(); for (const m of clouds) S3.remove(m);
    G.units.splice(G.units.indexOf(u), 1); E.syncActors();
  }
}
export const clearFade = () => fade(0, 0.4);
export const darken = () => fade(1, 0.3);
