// 封神英傑傳 — next-gen remake. Boot and flow.
//   campaign (no hash): title → camp (出戰人選, 出擊) → battle → result → camp …, with saves (campaign.js, camp.js, save.js)
//   direct (#battle=N, #auto, #sandbox, #arena): one battle with its default party, as in Phase 1 (test/index.html
//   adds &test: the test toolbar, src/testkit.js)
// The engine is battle.js, the rules rules.js, each battle's own parts src/battles/NN-*.js. Phase 3 adds story scenes.
import * as R from './rules.js';
import * as E from './battle.js';
import * as K from './campaign.js';
import * as Save from './save.js';
import { mountSpeed } from './speed.js';
import { defaultParty, autoPick } from './party.js';
import { rulesOf, fxOf } from './battles/index.js';
import { campScene, slotList } from './camp.js';
import * as Scene from './scene.js';
import { dress } from './sets.js';
import { pgSetup, pgLoop, arena, arenaSetup } from './testkit.js';
import * as Arena from './battles/arena.js';
import titleSet, { W as TITLE_W, H as TITLE_H } from './remake/title.js';
import { petals } from './ui.js';
import * as Audio from './audio.js';
const { D, G } = R;
const $ = id => document.getElementById(id);
const { opts, V, tileCenter } = E;
const direct = opts.arena || /battle=\d+|auto|sandbox/.test(location.hash);   // #from= and #scene= stay in the campaign
opts.campaign = !direct;   // battle FX: the campaign plays the scene's pre- and post-battle lines as scenes

let FX = {}, loaded = 0, dirty = false;   // the battle whose world is built; dirty once a battle has been played on it
let told = false;   // direct: the scene before the battle has just played (its lines are not repeated over the map)
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('cannot load ' + src)); document.head.appendChild(s); });
}
async function battleData(n) {
  if (!(globalThis.BATTLES && globalThis.BATTLES[n])) await loadScript('data/battles/' + String(n).padStart(2, '0') + '.js');
  return globalThis.BATTLES[n];
}
// load battle n's rules and data with this party, and build its world
async function openBattle(n, party) {
  const B = opts.arena ? Arena.record(await battleData(Arena.FOES_FROM)) : await battleData(n);   // the 演武場: its own record and set
  FX = opts.arena ? { look: Arena.look } : await fxOf(n);
  R.loadBattle(B, party || defaultParty(globalThis.COMMON, B), opts.arena ? null : await rulesOf(n), opts.arena ? arena : null);
  setScreen('loading'); const fill = $('l-fill'); fill.style.width = '0%';
  await E.loadWorld(FX, p => { fill.style.width = (p * 100) + '%'; });
  if (FX.look && FX.look.set) { await dress(E, FX.look.set); E.measureLight(); }   // a battle on a remade set (src/remake): its pieces, particles and lights
  fillScreens(); loaded = n; dirty = false; window.__remake.world = 'battle:' + n;
}

// ---------------------------------------------------------------- screens
function setScreen(id) { for (const s of ['title', 'brief', 'camp', 'end', 'loading']) E.ui.show(s, s === id); E.ui.show('hud', id === null); }
const home = () => V(D.deploy[0][0] + 1, 0, D.deploy[0][1] + 1);   // just past the first deploy cell
function fillScreens() {
  document.title = '封神英傑傳・' + (direct ? D.name + ' ' : '') + '重製';
  document.querySelector('#title .t-sub').textContent = direct ? [...D.name, '之', '戰'].join(' ') : '';
  document.querySelector('#brief h2').textContent = D.name;
  const lore = document.querySelector('#brief .lore'); lore.textContent = FX.lore || ''; lore.style.display = FX.lore ? '' : 'none';
  document.querySelector('#brief .cond').innerHTML = `<div><b>勝利條件</b>${FX.winText || D.win.join(' · ')}</div><div><b>敗北條件</b>${FX.loseText || D.lose.join(' · ')}</div>`;
}
// a slow orbit over the map, behind the title and the camp
let orbiting = false;
function orbit(on, dist) {
  if (on === orbiting) return; orbiting = on;
  if (!on) { E.cam.release(home()); E.cam.snap(); return; }
  const spin = () => { if (!orbiting) return; E.cam.shot(V(R.MAP_W / 2 + 1, 0, R.MAP_H / 2), { dist: dist || 24, pitch: 0.32, yaw: E.gameT * 0.05, speed: 1, free: true }); requestAnimationFrame(spin); };
  spin(); E.cam.snap();
}
const clickOnce = el => new Promise(res => el.addEventListener('click', res, { once: true }));

// a battle without its own staging: the scene's pre-battle lines over the map, then its name (DESIGN §7: name only)
async function intro() {
  if (FX.intro) return FX.intro(E);   // the camera stays on the heroes (no swing out over the map first: the user's call)
  if (direct && !told) for (const l of D.intro) await E.speak(l.text, l.who);   // in the campaign (and after story()) the scene has just played them
  E.cam.release(tileCenter(...D.deploy[0]));
  await E.ui.banner(D.name, '', 1700);
}
async function endScene(res) {
  E.ui.show('hud', false);
  if (res.win) {
    if (FX.victory) await FX.victory(E);
    else { await E.ui.banner('戰役勝利', D.name, 1600); if (direct) for (const l of D.outro) await E.speak(l.text, l.who); }   // the campaign plays the outro as a scene
    if (!direct) return;   // the campaign goes straight on to the scene's outro: the banner has said it (no second victory screen, whose 點擊重新開始 does not apply)
    const end = FX.end || { title: '戰役勝利', sub: '—— 待續 ——' };
    $('end-title').textContent = end.title; $('end-sub').textContent = end.sub;
  } else { $('end-title').textContent = '戰役失敗'; $('end-sub').textContent = (res.why || '') + (direct ? '' : '　·　回到出陣前，保留等級與物品'); }
  document.querySelector('#end .press').textContent = direct ? '點擊重新開始' : '點擊返回出陣';
  setScreen('end'); E.ui.show('hud', false);
  await clickOnce($('end'));
}
// stage the chosen units and play the battle to its end
async function fight(chosen) {
  if (!direct) await Scene.darken();   // from the camp: the cut to the deploy view happens in the dark
  orbit(false);
  E.stage(chosen); setScreen(null); if (D.music != null) Audio.music(D.music, 0.6, true);   // the battle's song (header word +20), from the top as the fighting starts (the camp has been playing it)
  for (const a of E.actors.values()) E.placeActor(a);
  E.cam.release(tileCenter(...D.deploy[0])); E.cam.snap();
  if (!direct) Scene.clearFade();
  if (!opts.auto && !opts.go) await intro();
  if (opts.test) pgSetup();   // test/index.html: the test toolbar over the real battle
  E.hudRound();
  const res = await E.runBattle();
  dirty = true;
  await endScene(res);
  return res;
}

// ---------------------------------------------------------------- the title's world
// the original's title pans east over a world map at 1 px a frame (60 px/s, 1.875 cells/s) for 917 px, then fades out
// (tools/rom/title.py). Here: its map remade (src/remake/title.js), flown over from the sky the same way; at the end of
// the stretch the flight starts over through a dissolve [design: no dark frames, the user's request]: the last frame
// is kept on a canvas over the view and fades out as the flight resumes from the start. Pink petals drift over the
// screen as on the original.
async function titleWorld() {
  const flat = Array.from({ length: TITLE_H }, () => Array(TITLE_W).fill(0));
  R.loadBattle({ n: 'title', name: '', chapter: 0, mapW: TITLE_W, mapH: TITLE_H, terrain: flat, deploy: [[0, 0]], enemies: [], win: [], lose: [], party: { deployMax: 0, forced: [], unavailable: [], joins: [] }, intro: [], outro: [] }, [], {});
  setScreen('loading'); const fill = $('l-fill'); fill.style.width = '0%';
  await E.loadWorld({ look: { set: titleSet }, sprites: [] }, p => { fill.style.width = (p * 100) + '%'; });
  await dress(E, titleSet); E.world.calm = true;
  loaded = 0; dirty = true; window.__remake.world = 'title:building';
}
const TITLE_VIEW = { dist: 9, pitch: 0.88, fov: 34 }, PAN = 60 / 32;   // the descent's view of a world map; cells a second
let panning = false, stopPetals = null;
function titlePan(on) {
  if (on === panning) return; panning = on;
  const cam = E.world.camera;
  if (!on) { cam.fov = 30; cam.updateProjectionMatrix(); E.vfx.screen.darkTarget = 0; if (stopPetals) stopPetals(); stopPetals = null; document.querySelectorAll('.title-xfade').forEach(c => c.remove()); return; }
  cam.fov = TITLE_VIEW.fov; cam.updateProjectionMatrix();
  const half = Math.tan(TITLE_VIEW.fov * Math.PI / 360) * TITLE_VIEW.dist * (innerWidth / innerHeight), X0 = Math.min(TITLE_W / 2, half + 0.3), X1 = Math.max(X0, TITLE_W - half - 0.3);
  let x = X0, last = performance.now(), turning = false;
  const xf = document.createElement('canvas'); xf.className = 'title-xfade'; $('gl').after(xf);   // over the 3D view, under every screen
  const place = () => { E.cam.shot(V(x, 0, TITLE_H / 2), { free: true, dist: TITLE_VIEW.dist, pitch: TITLE_VIEW.pitch, yaw: 0, speed: 100 }); E.cam.snap(); E.cam.update(0, 0); };   // the camera itself moves now, not a frame late
  const step = now => {
    if (!panning) return;
    x += PAN * Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now);   // a frame stamped before the pan began counts as no time
    if (x > X1 - 0.3 && !turning) {   // the end of the stretch: keep the frame just drawn, start over beneath it, dissolve
      turning = true;
      E.world.afterRender = gl => { xf.width = gl.width; xf.height = gl.height; xf.getContext('2d').drawImage(gl, 0, 0);
        xf.style.transition = 'none'; xf.style.opacity = 1; x = X0; turning = false;
        requestAnimationFrame(() => requestAnimationFrame(() => { xf.style.transition = 'opacity 1.6s ease-in-out'; xf.style.opacity = 0; })); };
    }
    place(); requestAnimationFrame(step);
  };
  place(); requestAnimationFrame(step);
  stopPetals = petals($('title'));
}

// ---------------------------------------------------------------- campaign
// the title: 新的開始 / 繼續旅程; resolves to a campaign state
async function titleMenu() {
  if (!/^title/.test(window.__remake.world)) await titleWorld();
  document.title = '封神英傑傳・重製'; document.querySelector('#title .t-sub').textContent = '';
  titlePan(true); setScreen('title'); window.__remake.world = 'title'; Audio.music(0x16);   // the title's song (0x3644)
  Scene.clearFade();   // the camera placed before the screen shows (dark when coming from the camp)
  const t = $('title'); t.classList.add('menu'); $('t-menu').classList.remove('hidden');
  $('t-cont').disabled = !Save.any();
  // the sword points at one line: the mouse moves it, and so do the arrow keys; Enter picks the line it points at
  const btns = [$('t-new'), $('t-cont')], point = b => { if (b.disabled) return; for (const x of btns) x.classList.toggle('on', x === b); };
  point(btns[0]); for (const b of btns) b.onmouseenter = () => point(b);
  const key = e => {
    if ($('t-menu').classList.contains('hidden')) return;
    const ok = btns.filter(b => !b.disabled), i = ok.findIndex(b => b.classList.contains('on'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { point(ok[(i + (e.key === 'ArrowDown' ? 1 : ok.length - 1)) % ok.length]); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { if (ok[i]) ok[i].click(); e.preventDefault(); }
  };
  window.addEventListener('keydown', key);
  try {
  for (;;) {
    const pick = await new Promise(res => { $('t-new').onclick = () => res('new'); $('t-cont').onclick = () => res('cont'); });
    if (pick === 'new') { t.classList.remove('menu'); $('t-menu').classList.add('hidden'); await Scene.darken(); titlePan(false); return K.newGame(); }
    const box = $('t-load'); box.classList.remove('hidden'); $('t-menu').classList.add('hidden'); t.classList.add('picking');
    const s = await slotList(E, box, 'load');
    box.classList.add('hidden'); $('t-menu').classList.remove('hidden'); t.classList.remove('picking');
    if (s) { t.classList.remove('menu'); $('t-menu').classList.add('hidden'); await Scene.darken(); titlePan(false); return s; }
  }
  } finally { window.removeEventListener('keydown', key); }
}
// the story and the battles in the original's order: scene intro → (camp → battle → scene outro) → next scene …
async function campaign() {
  Object.assign(window.__remake, { endScene });   // (QA: the campaign's end of a battle)
  let state = start();
  if (!state) state = await titleMenu();
  for (;;) {
    window.__remake.state = state;
    if (state.scene === 'end') { await Scene.darken(); state = await titleMenu(); continue; }   // the ending comes with Phase 5
    if (!state.camp) {
      const tag = typeof state.scene === 'string' ? state.scene : String(state.scene).padStart(2, '0');
      const S = await Scene.sceneData(tag);
      await Scene.darken();   // the title's or camp's world goes dark before its camera lets go (no snap seen)
      orbit(false); setScreen(null); E.ui.show('hud', false); dirty = true;
      if (state.part === 'intro' && Scene.seekPast(S)) state.part = 'outro';   // #scene=N&at=F past its battle (QA shots of the outro)
      if (state.part === 'intro' && S.chapter) state.chapter = S.chapter;   // (no 第X章 card at a new chapter: the original has none [the user's call])
      // @qa scene:42 scene:54 job:flow
      const r = await Scene.play(E, tag, state.part, { join: cid => K.join(state, cid), summon: spell => K.summon(state, spell), gifts: K.GIFTS[tag], gift: g => K.gift(state, g) });
      if (r === 'battle' && S.battle) { state.camp = true; state.battle = S.battle; continue; }   // stays dark: the camp fades in once its world is built
      K.nextScene(state); continue;
    }
    // the battle's camp
    K.enterCamp(state, await battleData(state.battle));
    G.chestFlags = JSON.parse(JSON.stringify(state.chestFlags || {}));   // the chests opened before, by table (rules.js loadChests)
    if (loaded !== state.battle || dirty) await openBattle(state.battle, K.partyOf(state));
    else D.party = K.partyOf(state);
    await Scene.clearFade(); if (D.music != null) Audio.music(D.music, 0.6, true);   // the preparation plays the coming battle's song, from the top (not carried on from the scene before) [the user's calls]
    E.stage(autoPick(D.party, D.partyRules)); setScreen('camp'); orbit(true, 20);
    const r = await campScene(E, state, () => { D.party = K.partyOf(state); });
    if (r === 'title') { await Scene.darken(); orbit(false); state = await titleMenu(); continue; }
    if (r.load) { state = r.load; continue; }
    const before = JSON.parse(JSON.stringify(state));
    Save.write(Save.AUTO, before);                     // auto-save before every battle
    const res = await fight(r.battle);
    if (res.win) K.afterBattle(state, G.units, true, G.found, G.chestFlags);  // then the scene's outro
    else { state = K.afterBattle(before, G.units, false, G.found, G.chestFlags); Save.write(Save.AUTO, state); }   // a loss: back to the camp as it was before the battle, but the heroes keep what they gained in it (levels, experience, items) [the user's call]
  }
}
// development starts: #from=N opens the camp before battle N with its roster snapshot (磻溪), #scene=S plays scene S
function start() {
  const m = location.hash.match(/from=(\d+)/), sc = location.hash.match(/scene=(prologue2?|\d+)/);
  if (m && globalThis.PARTIES[+m[1]]) return K.snapshotGame(+m[1]);
  if (sc) { const st = K.newGame(); st.scene = sc[1].startsWith('prologue') ? sc[1] : +sc[1]; st.chapter = -1; return st; }
  return null;
}

// ---------------------------------------------------------------- direct (one battle, Phase 1 flow)
// the story scene that leads into battle n, as the campaign plays it (battle 1: the hunt, the escort on the road), then
// the battle's world rebuilt in the dark. A battle with its own staging (FX.intro, 磻溪) keeps that instead.
async function story(n) {
  const tag = D.scene == null ? null : String(D.scene).padStart(2, '0');
  if (tag == null || FX.intro) return false;
  const S = await Scene.sceneData(tag).catch(() => null);
  if (!S || S.battle !== n) return false;
  await Scene.darken(); setScreen(null); E.ui.show('hud', false);
  await Scene.play(E, tag, 'intro', {});
  await openBattle(n);
  E.stage(autoPick(D.party, D.partyRules)); setScreen(null); E.cam.release(tileCenter(...D.deploy[0])); E.cam.snap();
  await Scene.clearFade();
  return true;
}
async function single() {
  const n = opts.arena ? 'arena' : +((location.hash.match(/battle=(\d+)/) || [])[1] || 13);
  await openBattle(n);
  if (opts.arena) { setScreen(null); pgSetup(); arenaSetup(); return pgLoop(); }
  if (/sandbox/.test(location.hash)) {   // debug: staged battle without the turn flow
    E.stage(autoPick(D.party, D.partyRules)); setScreen(null); E.hudRound(); E.cam.release(tileCenter(...D.deploy[0])); E.cam.snap();
    Object.assign(window.__remake, { E, stage: E.stage, ui: E.ui, wait: E.wait, setScreen, endScene }); return;
  }
  let test = null;
  for (;;) {
    let chosen;
    if (opts.auto || opts.go) chosen = autoPick(D.party, D.partyRules);   // &go: straight into round 1 (no title, lead-in scene, brief, deploy or intro)
    else {   // the battle's preparation, as the campaign's camp (a test party, 10 of every item in the bag), then its deploy
      if (!test) { told = await story(n); test = K.testGame(D.party, n); }   // the lead-in scene first, once, as the campaign plays it
      if (dirty) await openBattle(n, K.partyOf(test)); else D.party = K.partyOf(test);
      Scene.clearFade(); if (D.music != null) Audio.music(D.music, 0.6, true);   // the preparation: the battle's song from the top
      E.stage(autoPick(D.party, D.partyRules)); setScreen('camp'); orbit(true, 20);
      const r = await campScene(E, test, () => { D.party = K.partyOf(test); });
      if (r === 'title' || r.load) { location.href = 'test/index.html'; return; }
      chosen = r.battle;
    }
    const res = await fight(chosen);
    if (test) K.afterBattle(test, G.units, res.win, G.found);   // the next try keeps what was gained
    if (opts.auto || opts.go) break;
  }
}

async function main() {
  mountSpeed();   // the game speed, top right (src/speed.js)
  E.boot(); Audio.attach();
  if (/qa/.test(location.hash)) (await import('./qa.js')).install(E);   // QA probes for tools/qa/tour.js
  await document.fonts.ready;
  Object.assign(window.__remake, { K, Save, D });
  return direct ? single() : campaign();
}
main().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;top:0;left:0;color:#f88;z-index:99">' + e.stack + '</pre>'); });
