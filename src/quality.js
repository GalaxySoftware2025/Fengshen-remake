// The picture quality the player picks (畫面品質 in the menu at the top right, src/gamemenu.js: 低 / 中 / 高) [the user's
// call, 2026-11-15: the Windows app held an integrated GPU at 100%]. It bounds the frame governor (battle.js governor):
// how far the render scale may climb (max, as a pixel ratio), the GPU ms a frame it aims at (budget; 60 Hz leaves 16.7)
// and the costly passes left off whatever the headroom (off, as battle.js QUALITY counts them: 1 ambient occlusion,
// 2 the multisampling too, 3 bloom too). 高 is the game as it was. Remembered in this browser, as the speed is; a QA
// page (&qa) is always 高, so the checks' pictures stay as they were.
const KEY = 'fengshen.quality', QA = typeof location !== 'undefined' && /[#&]qa\b/.test(location.hash);
export const LEVELS = [
  { name: '低', max: 1, budget: 6, off: 3 },
  { name: '中', max: 1, budget: 8, off: 1 },
  { name: '高', max: 1.5, budget: 12, off: 0 },
];
let v = 2;
if (typeof window !== 'undefined') try { const s = localStorage.getItem(KEY); if (!QA && s != null && LEVELS[+s]) v = +s; } catch (e) { /* no storage: 高 */ }   // (test/framecap.mjs imports this in node)
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
