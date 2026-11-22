// The mouse pointer hides while the game is played by keys [the user's call, 2026-11-19]: a key (the keyboard's, or a
// controller's: src/gamepad.js sends keys) hides it (html.no-cursor: style.css); the mouse moving shows it again. Only a
// real move counts: Chromium also sends a mousemove where the pointer stays (when what is under it changes), so the
// pointer must have left the spot it was hidden at. A click shows it too.
let at = null;   // where the pointer was when it hid
const show = () => { document.documentElement.classList.remove('no-cursor'); at = null; };
export function mountCursor() {
  const root = document.documentElement; let last = null;   // (the pointer's last place seen)
  window.addEventListener('keydown', () => { if (!root.classList.contains('no-cursor')) { root.classList.add('no-cursor'); at = last; } }, true);
  window.addEventListener('mousemove', e => {
    const p = [e.clientX, e.clientY], was = last; last = p;
    if (!root.classList.contains('no-cursor')) return;
    const from = at || was;
    if (from && Math.hypot(p[0] - from[0], p[1] - from[1]) >= 2) show();
    else if (!from) at = p;   // (the first move seen while hidden: where it is)
  }, true);
  window.addEventListener('mousedown', show, true);
}
