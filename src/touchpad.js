// The touch pad: a phone's controls [the user's call, 2026-11-18: the Android app gets a virtual control panel]. On a
// touch screen (pointer: coarse; &touch shows it anywhere, for QA) a D-pad at the left and 確定 / 取消 at the right, with
// small buttons over them: 加速 (held), 跳過, and in a battle the camera's turns and the enemies' reach. Each button is a
// key of src/keys.js: it sends the same keydown / keyup the keyboard does, to window, so every screen answers it as it
// answers the keyboard (no screen has touch code of its own). The D-pad is one pad, read by the angle from its centre:
// a thumb slides from one direction to the next; a held direction repeats as a held key does (after 0.35 s, every 0.11 s).
// A tap on the game itself is a click, as before. Android's back button is 取消 (window.__back, MainActivity.java).
import { KEYS, tapOr } from './keys.js';

const SHOW = /[#&]touch\b/.test(location.hash) || (matchMedia('(pointer: coarse)').matches && !/[#&]qa\b/.test(location.hash));
const KEY_OF = code => code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code;
export function press(action, type = 'keydown', repeat = false) {
  const code = KEYS[action][0];
  window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_OF(code), repeat, bubbles: true, cancelable: true }));
}
export const pressed = action => { press(action, 'keydown'); press(action, 'keyup'); };
window.__back = () => pressed('cancel');

const HOLD = 350, EVERY = 110;
function dpad(el) {
  let id = null, dir = null, tm = null;
  const set = d => {
    if (d === dir) return;
    if (dir) { press(dir, 'keyup'); el.classList.remove('on-' + dir); }
    clearTimeout(tm); clearInterval(tm); dir = d;
    if (!d) return;
    el.classList.add('on-' + d); press(d);
    tm = setTimeout(() => { tm = setInterval(() => press(d, 'keydown', true), EVERY); }, HOLD);
  };
  const read = e => {
    const r = el.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(x, y) < r.width * 0.12) return dir;   // (the dead centre: keep the direction held)
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  };
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (id != null) return; id = e.pointerId; el.setPointerCapture(id); set(read(e)); });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) set(read(e)); });
  const end = e => { if (e.pointerId !== id) return; id = null; set(null); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, end);
}
function button(el, action, held) {
  let id = null;
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (id != null) return; id = e.pointerId; el.setPointerCapture(id); el.classList.add('on'); press(action); if (!held) press(action, 'keyup'); });
  const end = e => { if (e.pointerId !== id) return; id = null; el.classList.remove('on'); if (held) press(action, 'keyup'); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, end);
}

export function mountTouchpad() {
  if (!SHOW || document.getElementById('touchpad')) return;
  document.documentElement.classList.add('touch');
  for (const el of document.querySelectorAll('.t-press')) el.textContent = tapOr(el.textContent);   // (the title's prompt: 點擊開始)
  const pad = document.createElement('div'); pad.id = 'touchpad';
  pad.innerHTML = `<div class="tp-left"><div class="tp-dpad" data-act="dpad"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i></div></div>
    <div class="tp-right"><div class="tp-small"><b data-act="fast" data-held="1">加速</b><b data-act="skip">跳過</b></div>
      <div class="tp-small tp-battle"><b data-act="turnLeft">⟲</b><b data-act="danger">範圍</b><b data-act="turnRight">⟳</b></div>
      <b class="tp-big tp-ok" data-act="ok">確定</b><b class="tp-big tp-cancel" data-act="cancel">取消</b></div>`;
  document.body.appendChild(pad);
  dpad(pad.querySelector('.tp-dpad'));
  for (const b of pad.querySelectorAll('b[data-act]')) button(b, b.dataset.act, !!b.dataset.held);
  pad.addEventListener('contextmenu', e => e.preventDefault());
  // While the pad shows, the game takes no tap: every action is the pad's; only 選單 at the top left, all it holds and
  // opens, and the ROM picker answer a touch [the user's call, 2026-11-21: in a battle, the camp, anywhere; a tap on
  // the field had moved the cursor, a thumb on the pad too]. Where the pad is hidden (the controls page, the brief, the
  // end) a tap goes on as before: there is nothing else to press with. (Capturing at the window, before any screen's own.)
  const OPEN = '#touchpad, #gmenu, #ld';
  const guard = e => {
    if (!e.isTrusted || getComputedStyle(pad).display === 'none') return;   // (only a real touch: 確定 presses a page's button with a click of its own, src/keynav.js)
    const t = e.target; if (t && t.closest && t.closest(OPEN)) return;
    e.stopImmediatePropagation(); if (e.cancelable && !/move$/.test(e.type)) e.preventDefault();
  };
  for (const t of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'touchstart', 'touchend', 'touchmove', 'contextmenu']) window.addEventListener(t, guard, { capture: true, passive: false });
  // its two areas (the D-pad's, the buttons' with the gaps between them) are the pad's alone [the user's call, 2026-11-21:
  // a thumb held on the D-pad moved the battle's cursor to the cell under it, the battle taking each slight shift for a
  // pointer over the field]: nothing that starts or moves in them goes on to the game (its buttons have acted by then:
  // their own listeners run first); a touch on a gap does nothing (no mouse events or click after it)
  for (const zone of pad.querySelectorAll('.tp-left, .tp-right')) {
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mousemove', 'mouseup', 'click', 'touchstart', 'touchmove', 'touchend', 'wheel']) zone.addEventListener(t, e => e.stopPropagation());
    zone.addEventListener('pointerdown', e => e.preventDefault());
  }
  // the battle's buttons only in a battle (the camera's turns and the reach mean nothing elsewhere)
  setInterval(() => { const w = window.__remake && window.__remake.world; pad.classList.toggle('in-battle', typeof w === 'string' && w.startsWith('battle')); }, 500);
}
