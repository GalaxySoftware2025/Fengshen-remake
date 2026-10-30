// Keyboard play on the screens built of things to press (the camp, the save slots) [the user's call, 2026-10-29]:
// W S A D (keys.js) move a gold frame to the nearest one in that direction, by where it sits on screen; I presses it,
// O goes back (the caller's back()). Moving onto one does what pointing at it does (the item's effect, the hero's
// stats, the cursor sound). The screens redraw themselves on every press: the frame then goes to the one nearest where
// it was, or to one the caller prefers when it appears (a 是 / 否 question: its lit 否). Shown only once a key is used;
// moving the mouse hides it.
import * as Keys from './keys.js';
// root: the screen; items: a selector for the things to press; start(): where the frame starts; back(cur): cancel;
// prefer: a selector, focused when it appears. Returns stop().
export function keynav(root, { items, start, back, prefer }) {
  let cur = null, at = null, kb = false, seen = new Set();
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; };
  const list = () => [...root.querySelectorAll(items)].filter(shown);
  const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const paint = () => { for (const e of root.querySelectorAll('.kf')) if (e !== cur || !kb) e.classList.remove('kf'); if (cur && kb) cur.classList.add('kf'); };
  const set = el => {
    if (el === cur) return paint();
    if (cur && cur.isConnected) cur.dispatchEvent(new MouseEvent('mouseleave'));
    cur = el; if (el) { at = mid(el); el.dispatchEvent(new MouseEvent('mouseenter')); el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); el.scrollIntoView({ block: 'nearest' }); }
    paint();
  };
  const nearest = (els, p) => els.reduce((b, e) => { const m = mid(e), d = Math.hypot(m.x - p.x, m.y - p.y); return !b || d < b.d ? { e, d } : b; }, null)?.e || null;
  // the frame after a redraw: a newly shown preferred one, else the one nearest where it was
  const settle = () => {
    const els = list(), fresh = prefer ? [...root.querySelectorAll(prefer)].filter(e => shown(e) && !seen.has(e)) : [];
    seen = new Set(prefer ? root.querySelectorAll(prefer) : []);
    if (fresh.length) return set(fresh[0]);
    if (cur && cur.isConnected && els.includes(cur)) return paint();
    cur = null; if (at && els.length) set(nearest(els, at)); else paint();
  };
  // the best one in direction (dx, dy): ahead of the frame, the least off its line (a row or column it shares counts as on it)
  const step = (dx, dy) => {
    const p = mid(cur), els = list().filter(e => e !== cur);
    let best = null;
    for (const e of els) {
      const q = mid(e), ahead = (q.x - p.x) * dx + (q.y - p.y) * dy;
      if (ahead < 4) continue;
      const gap = dx ? Math.max(0, q.r.top - p.r.bottom, p.r.top - q.r.bottom) : Math.max(0, q.r.left - p.r.right, p.r.left - q.r.right);
      const s = ahead + gap * 3;
      if (!best || s < best.s) best = { e, s };
    }
    if (best) set(best.e);
  };
  const key = e => {
    if (!shown(root) || root.classList.contains('hidden')) return;
    const d = Keys.dirOf(e), ok = Keys.is(e, 'ok'), cancel = Keys.is(e, 'cancel');
    if (!d && !ok && !cancel) return;
    e.preventDefault(); e.stopImmediatePropagation();   // (not the battle's own keys: its cursor and menus are not on screen)
    const was = kb; kb = true;
    if (!cur || !cur.isConnected) { cur = null; set(start() || list()[0] || null); if (!cur) return; if (!was && !d) return; }
    if (d) return step(...{ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d]);
    if (ok) return cur.click();
    back(cur);
  };
  const mouse = () => { if (kb) { kb = false; paint(); } };
  const obs = new MutationObserver(() => queueMicrotask(settle));
  obs.observe(root, { childList: true, subtree: true });
  window.addEventListener('keydown', key, true); root.addEventListener('pointermove', mouse);
  seen = new Set(prefer ? root.querySelectorAll(prefer) : []);
  return {
    focus: set,
    stop() { obs.disconnect(); window.removeEventListener('keydown', key, true); root.removeEventListener('pointermove', mouse); kb = false; paint(); },
  };
}
