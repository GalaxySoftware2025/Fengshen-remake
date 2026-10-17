// The game speed the player picks (top right: ×1 to ×2 in steps of 0.25, the user's call): battles (battle.js frame) and
// story scenes (scene.js clock) run their clocks this much faster; holding space still hurries on top of it. Remembered in
// this browser (a convenience: none there, or a QA page, &qa, is ×1).
const KEY = 'fengshen.speed', QA = /[#&]qa\b/.test(location.hash);
let v = 1;
try { const s = +localStorage.getItem(KEY); if (!QA && s >= 1 && s <= 2) v = s; } catch (e) { /* no storage: ×1 */ }
export const speed = () => v;
export function setSpeed(x) {
  v = Math.min(2, Math.max(1, Math.round(x * 4) / 4));
  if (!QA) try { localStorage.setItem(KEY, String(v)); } catch (e) { /* not remembered */ }
  show();
}
let el = null;
function show() { if (!el) return; el.querySelector('b').textContent = '×' + String(v); el.querySelector('[data-d="-1"]').disabled = v <= 1; el.querySelector('[data-d="1"]').disabled = v >= 2; }
// the control: − ×1.25 ＋ (clicks on it stop there: they neither advance a line nor pick a cell)
export function mountSpeed() {
  el = document.getElementById('speed'); if (!el) return;
  for (const ev of ['click', 'pointerdown', 'mousedown']) el.addEventListener(ev, e => e.stopPropagation());
  for (const b of el.querySelectorAll('button')) b.addEventListener('click', () => setSpeed(v + 0.25 * +b.dataset.d));
  show();
}
