// The original's music and sound effects (tools/rom/sound.py ripped them from the ROM's driver; render_sound.sh made
// assets/audio/XX.ogg; without those, the logs the extractor rips are synthesized: load()). Ids as the ROM has them: under 0x8000 a song, 0x8000+ an effect. data/audio.js gives each its
// length and loop start: a song plays its intro once, then loops between loop start and its end, sample-exact.
// Browsers start sound only after a click or key: the context is resumed on the first one.
// Keys: M mutes and unmutes (kept in localStorage; keys.js).
import * as Keys from './keys.js';
let ctx = null, master = null, musicBus = null, sfxBus = null, table = null, cur = null, want = null;
const buffers = new Map(), loading = new Map();
const MUSIC_VOL = 0.55, SFX_VOL = 0.8;
export const SFX = { cursor: 0x8045, ok: 0x806b, cancel: 0x80ae, hit: 0x8089, saved: 0x8061 };   // saved: the original's on a save (tools/rom: menu.pkl, 儲存記錄 → a slot)   // the menus' and a blow's (tools/rom: menus at 0x140b8 / 0x140e6, the hunt's strike)

const key = id => typeof id === 'string' ? id : id < 0x8000 ? id.toString(16).padStart(2, '0') : id.toString(16);   // a string: a sound of the remake's own (assets/audio/<name>.ogg)
function muted() { try { return localStorage.getItem('fs-mute') === '1'; } catch (e) { return false; } }

async function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted() ? 0 : 1; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
  if (!window.AUDIO) await new Promise(res => { const s = document.createElement('script'); s.src = 'data/audio.js'; s.onload = s.onerror = res; document.head.appendChild(s); });
  table = window.AUDIO || {};
}
// a sound as a rendered file (assets/audio/XX.ogg), or else its log from the player's ROM (XX.vgz, made by the
// extractor), played through the chips' emulation in a worker (src/synth)
let synth = null; const pending = new Map();
function synthesize(k) {
  return fetch('assets/audio/' + k + '.vgz').then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(vgz => new Promise((res, rej) => {
    if (!synth) {
      synth = new Worker(new URL('./synth/worker.js', import.meta.url), { type: 'module' });
      synth.onmessage = e => { const p = pending.get(e.data.id); pending.delete(e.data.id); if (!p) return; if (e.data.error) p.rej(e.data.error); else p.res(e.data); };
    }
    pending.set(k, { res, rej }); synth.postMessage({ id: k, vgz, rate: ctx.sampleRate }, [vgz]);
  })).then(({ left, right }) => { const buf = ctx.createBuffer(2, left.length, ctx.sampleRate); buf.copyToChannel(left, 0); buf.copyToChannel(right, 1); return buf; });
}
function load(id) {
  const k = key(id);
  if (buffers.has(k)) return Promise.resolve(buffers.get(k));
  const logged = window.AUDIO_LOGS && table && table[k];   // (the public build: no rendered files, straight to the log)
  if (!loading.has(k)) loading.set(k, (logged ? synthesize(k) : fetch('assets/audio/' + k + '.ogg').then(r => r.ok ? r.arrayBuffer().then(b => ctx.decodeAudioData(b)) : synthesize(k)))
    .then(buf => { buffers.set(k, buf); return buf; }).catch(() => null));
  return loading.get(k);
}

// play song id (looping as the original does); the same song already playing carries on unless `restart` (a battle
// starting on the song its scene played: from the top); null stops the music
export async function music(id, fade = 0.6, restart = false) {
  want = id; if (window.__qa) (window.__qa.music ||= []).push(restart ? id + '!' : id);   // (tools/qa/sounds.js)
  await init(); if (!ctx) return;
  if (cur && cur.id === id && !restart) return;
  if (cur) { const old = cur; cur = null; old.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 4); setTimeout(() => { try { old.src.stop(); } catch (e) {} }, fade * 1000 + 200); }
  if (id == null) return;
  const buf = await load(id); if (!buf || want !== id || (cur && cur.id === id)) return;
  const t = table[key(id)], src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf;
  if (t && t[1] != null) { src.loop = true; src.loopStart = t[1]; src.loopEnd = Math.min(t[0], buf.duration); }
  gain.gain.value = 1; src.connect(gain); gain.connect(musicBus); src.start();
  cur = { id, src, gain };
}
// play effect id (or a name in SFX) once
export async function sfx(id, o = {}) {   // o: { vol (0-1), rate (playback speed: pitch) }
  if (typeof id === 'string' && SFX[id] != null) id = SFX[id];
  if (id == null) return;
  if (window.__qa) (window.__qa.sfx ||= []).push(id);   // what was asked for (tools/qa: sound checks), even with no audio running
  if (window.__qa) (window.__qa.sfxT ||= []).push([id, window.__remake && window.__remake.clock ? window.__remake.clock() : 0]);   // and when, on the game clock (tools/qa/spells.js: a spell's sounds against the original's)
  await init(); if (!ctx || ctx.state !== 'running') return;
  const buf = await load(id); if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf; if (o.rate) src.playbackRate.value = o.rate;
  if (o.vol != null) { const g = ctx.createGain(); g.gain.value = o.vol; src.connect(g); g.connect(sfxBus); } else src.connect(sfxBus);
  src.start();
}
// a short song played once over the music (an ally's fall: song 0x0A, ROM 0x10A16), then the song it broke into starts again
export async function jingle(id) {
  const back = want; await music(id, 0.3);
  const t = table && table[key(id)];
  setTimeout(() => { if (want === id) music(back, 0.6, true); }, ((t && t[0]) || 8) * 1000);
}
// any id from a script: a song or an effect
export const play = id => id < 0x8000 ? music(id) : sfx(id);

// start on the first gesture; the menus' sounds on every button and list row
export function attach() {
  const wake = () => { init().then(() => { if (ctx && ctx.state !== 'running') ctx.resume().then(() => { if (want != null && !cur) music(want); }); }); };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, wake, { capture: true });
  const pick = el => el && el.closest && el.closest('button, #menu > *, #ring .rb, #c-panel [class*="row"], #camp .tab');
  document.addEventListener('click', e => { const el = pick(e.target); if (!el || el.disabled) return; sfx(/返回|取消/.test(el.textContent) ? 'cancel' : 'ok'); }, true);
  let over = null;
  document.addEventListener('pointerover', e => { const el = pick(e.target); if (el && el !== over && !el.disabled) sfx('cursor'); over = el; }, true);
  window.addEventListener('keydown', e => {
    if (!Keys.is(e, 'mute')) return;
    const m = !muted(); try { localStorage.setItem('fs-mute', m ? '1' : '0'); } catch (err) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
  });
}
// for QA: what is playing
export const status = () => ({ ctx: ctx && ctx.state, song: cur && cur.id, loaded: [...buffers.keys()] });
