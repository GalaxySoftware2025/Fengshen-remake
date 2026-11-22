// Keyboard play on the screens built of things to press (the camp, the save slots) [the user's call, 2026-10-29]:
// W S A D (keys.js) move a gold frame to the nearest one in that direction, by where it sits on screen; I presses it,
// O goes back (the caller's back()). Moving onto one does what pointing at it does (the item's effect, the hero's
// stats, the cursor sound). The screens redraw themselves on every press: the frame then goes to the one nearest where
// it was, or to one the caller prefers when it appears (a 是 / 否 question: its lit 否). Shown only once a key is used;
// moving the mouse hides it.
import * as Keys from './keys.js';
// root: the screen; items: a selector for the things to press; start(): where the frame starts; back(cur): cancel;
// prefer: a selector, focused when it appears; groups: selectors for the screen's parts (the camp's menu and page): W / S
// keep to the frame's part while it has one that way (from 裝備物品's first hero S went out to the menu's button below
// it, nearer than his items [the user's report]), A / D cross. Returns stop().
export function keynav(root, { items, start, back, prefer, groups = [] }) {
  let cur = null, at = null, kb = false, seen = new Set();
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; };
  const list = () => [...root.querySelectorAll(items)].filter(shown);
  const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const paint = () => { for (const e of root.querySelectorAll('.kf')) if (e !== cur || !kb) e.classList.remove('kf'); if (cur && kb) cur.classList.add('kf'); };
  // quiet: no cursor sound (src/audio.js): the frame moved by the game, not a key (a page opened from the camp's menu
  // frames its first item: one sound, the press's, not two [the user's report, 2026-11-21])
  const set = (el, quiet) => {
    if (el === cur) return paint();
    if (cur && cur.isConnected) cur.dispatchEvent(new MouseEvent('mouseleave'));
    cur = el; if (el) { at = mid(el); el.dispatchEvent(new MouseEvent('mouseenter')); const po = new PointerEvent('pointerover', { bubbles: true }); po.quiet = !!quiet; el.dispatchEvent(po); el.scrollIntoView({ block: 'nearest' }); }
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
  const step = (dx, dy) => {
    const p = mid(cur), part = dy && groups.find(g => cur.closest(g)), all = list().filter(e => e !== cur);
    const mine = part ? all.filter(e => e.closest(part) && (mid(e).y - p.y) * dy >= 4) : [], els = mine.length ? mine : all;
    const home = groups.find(g => cur.closest(g)), best = choose(p, els.map(e => Object.assign(mid(e), { e })), dx, dy, q => !home || !!q.e.closest(home));
    if (best) set(best);
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
    focus: (el, show) => { if (show) kb = true; set(el, true); },   // show: the frame shown at once, as after a key (camp.js: a page opened from its menu)
    stop() { obs.disconnect(); window.removeEventListener('keydown', key, true); root.removeEventListener('pointermove', mouse); kb = false; paint(); },
  };
}

// the best one in direction (dx, dy) from p ({ x, y, r }: the frame's middle and box) among cands ({ e, x, y, r }): ahead of
// it; one sharing its row (A / D) or column (W / S) in the frame's own part of the screen (home: the camp's page or its
// menu) before any other, then the least far ahead and off its line [the user's report, 2026-11-16: A on 裝備物品's 太乙仙丹,
// the bag's middle column, framed 黃天化's tab, 44 px left and up a row, over 金創藥 on its own row 500 px away: the score
// alone let a near one off the row win]. (Crossing parts keeps to the score: D from the menu's 裝備物品 frames the first
// hero's tab, not the item slot level with the button; tools/qa/keys.js)
export function choose(p, cands, dx, dy, home = () => true) {
  let best = null;
  for (const q of cands) {
    const ahead = (q.x - p.x) * dx + (q.y - p.y) * dy; if (ahead < 4) continue;
    const gap = dx ? Math.max(0, q.r.top - p.r.bottom, p.r.top - q.r.bottom) : Math.max(0, q.r.left - p.r.right, p.r.left - q.r.right);
    const off = gap > 0 || !home(q) ? 1 : 0, s = ahead + gap * 3 + 0.01 * Math.abs(dx ? q.y - p.y : q.x - p.x);   // (a tie: the one whose middle is nearer the frame's line, W on 太乙仙丹 framed 姜子牙's tab over 黃天化's, both over its column)
    if (!best || off < best.off || (off === best.off && s < best.s)) best = { e: q.e, off, s };
  }
  return best ? best.e : null;
}
