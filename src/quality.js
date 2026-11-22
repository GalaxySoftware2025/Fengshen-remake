// The picture quality the player picks (畫面品質 in the menu at the top right, src/gamemenu.js: 低 / 中 / 高) [the user's
// call, 2026-11-15: the Windows app held an integrated GPU at 100%]. It sets the render (battle.js apply), held as picked:
// the render scale (max, a pixel ratio at the reference window: capOf) and the costly passes left off (off, as battle.js
// QUALITY counts them: 1 ambient occlusion, 2 the multisampling too, 3 bloom too); the game never changes either itself
// [the user's call, 2026-11-21: the player picks the resolution; on a Galaxy S21 the picks drew at much the same one, a
// frame governor holding each at its floor]. Each pick draws fewer pixels than the one above (a phone: 2.6 / 1.85 / 1.3
// x the page). Remembered in this browser, as the speed is; a QA page (&qa) is always 高, so the checks' pictures stay
// as they were.
// lamps: how many of a set's lamp lights stay lit (World.trimLamps: those reaching the farthest); grass: the share of the
// grass tufts drawn (src/kit/terrain.js grass). A phone's GPU paid most for those [the user's call, 2026-11-20: a Galaxy
// S21 measured over USB: battle 1 at 6-7 fps at full scale, 2.5x with the tufts hidden; the prologue's hall at 4.3 fps,
// 6.7x with its 21 lamps off; the passes above saved ~15%]. tools/qa/qualitypick.js
const KEY = 'fengshen.quality', QA = typeof location !== 'undefined' && /[#&]qa\b/.test(location.hash);
export const LEVELS = [
  { name: '低', share: 0.5, off: 3, lamps: 0, grass: 0.3 },
  { name: '中', share: 0.7, off: 1, lamps: 4, grass: 0.5 },
  { name: '高', share: 1, off: 0, lamps: Infinity, grass: 1 },
];
// The render scale a pick draws at (battle.js apply), a pixel ratio: 高's times the pick's share (each way: 中 about half
// 高's pixels, 低 a quarter), so each pick draws fewer than the one above on any screen. 高's: 1.5 at the reference
// window (1440 x 900, the user's Mac), held as that many pixels in a smaller one, never past the display's own ratio. A
// phone (915 x 412 CSS px at 2.625) had 高 capped at 1.5: 1372 x 618 stretched over 2400 x 1080, blurred whatever its GPU
// could do [the user's report, 2026-11-20, a Galaxy S21]; 高 draws its every pixel (2.6 M, under the reference's 2.9 M).
// A window as big as the reference or bigger keeps 1.5. test/rescap.mjs
const REF_PX = 1440 * 900, TOP = 1.5;
export const capOf = (q, w, h, dpr) => q.share * Math.min(dpr || 1, Math.max(TOP, TOP * Math.sqrt(REF_PX / (w * h))));
// A phone (a touch screen, as src/touchpad.js tells one: #touch on a QA page) starts at 中, anything else at 高; the
// player's own pick, remembered, wins over either. A QA page without #touch is always 高.
const TOUCH = typeof location !== 'undefined' && (/[#&]touch\b/.test(location.hash) || (!QA && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches));
let v = TOUCH ? 1 : 2;
if (typeof window !== 'undefined') try { const s = localStorage.getItem(KEY); if (!QA && s != null && LEVELS[+s]) v = +s; } catch (e) { /* no storage: the default */ }   // (test/framecap.mjs imports this in node)
const subs = [];
export const quality = () => LEVELS[v];
export const qualityLevel = () => v;
export const onQuality = f => subs.push(f);
export function setQuality(i) {
  if (!LEVELS[i] || i === v) return;
  v = i; if (!QA) try { localStorage.setItem(KEY, String(v)); } catch (e) { /* not remembered */ }
  show(); for (const f of subs) f(LEVELS[v]);
}

// the 60 fps cap [the user's call]: on a 120 or 144 Hz screen the game drew (and lit the GPU) for every refresh. gate(now)
// says whether the frame at now is drawn: at most one in each 1/60 s, kept to a 60 Hz grid (2 ms early still counts, a
// 60 Hz refresh's own jitter); a frame more than one behind starts the grid again from there. test/framecap.mjs
export function frameGate(fps = 60) {
  const F = 1000 / fps; let next = -Infinity;
  return now => { if (now < next - 2) return false; next = now - next > F ? now + F : next + F; return true; };
}

// the control: 畫面品質 [低][中][高], the picked one lit (clicks on it stop there, as the speed's)
let el = null;
function show() { if (el) for (const b of el.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.q === v); }
export function mountQuality() {
  el = document.getElementById('quality'); if (!el) return;
  for (const ev of ['click', 'pointerdown', 'mousedown']) el.addEventListener(ev, e => e.stopPropagation());
  for (const b of el.querySelectorAll('button')) b.addEventListener('click', () => setQuality(+b.dataset.q));
  show();
}
