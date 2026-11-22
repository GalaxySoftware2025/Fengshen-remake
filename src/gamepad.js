// A game controller [the user's call, 2026-11-19: a physical controller on the web and in the Windows app]: the browser's
// Gamepad API (Chromium: the Windows app's Electron, Chrome, Edge; Android's WebView), read every frame while one is
// connected. Each button is a key of src/keys.js: it sends the same keydown / keyup the keyboard does, to window (as the
// touch pad does: src/touchpad.js press), so every screen answers it as it answers the keyboard. The buttons by the
// standard layout's places (an Xbox pad's names; a PlayStation pad's the same places: ✕ ○ □ L1 R1 R2 ...):
//   A 確定 (I), B 取消 (O), X the enemies' reach (Tab), LB / RB the battle's camera a quarter turn (Q / E), LT or RT held
//   加速 (Space), Start 跳過 (Esc), Back / Select 靜音 (M); the D-pad and the left stick move (W S A D), a held one
//   repeating as a held key does (after 0.35 s, every 0.11 s).
// Not B for 跳過: mashing 取消 after a battle must not skip the story (keys.js skip).
import { press } from './touchpad.js';

export const PAD = { 0: 'ok', 1: 'cancel', 2: 'danger', 4: 'turnLeft', 5: 'turnRight', 6: 'fast', 7: 'fast', 8: 'mute', 9: 'skip' };
const DIRS = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const HOLD = 350, EVERY = 110, STICK = 0.55;   // (a held direction's repeat, as the touch pad's; the stick's dead zone)
const down = new Set();   // the actions held now (a key's keydown sent, its keyup not yet)
let dir = null, repT = 0, polling = false;

// any controller connected and seen (Chrome lists one only after its first button press)
export const padConnected = () => [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(p => p && p.connected);

function read() {
  const held = new Set(); let d = null;
  for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (!p || !p.connected) continue;
    const on = i => { const b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
    for (const [i, act] of Object.entries(PAD)) if (on(+i)) held.add(act);
    for (const [i, a] of Object.entries(DIRS)) if (!d && on(+i)) d = a;
    if (!d && p.axes.length >= 2) { const [x, y] = p.axes; if (Math.max(Math.abs(x), Math.abs(y)) > STICK) d = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'); }
  }
  return { held, d };
}
function poll(now) {
  const { held, d } = read();
  for (const act of held) if (!down.has(act)) { down.add(act); press(act); }
  for (const act of [...down]) if (!held.has(act)) { down.delete(act); press(act, 'keyup'); }
  if (d !== dir) { if (dir) press(dir, 'keyup'); dir = d; if (d) { press(d); repT = now + HOLD; } }
  else if (d && now >= repT) { press(d, 'keydown', true); repT = now + EVERY; }
  if (padConnected() || down.size || dir) requestAnimationFrame(poll);
  else polling = false;
}
const start = () => { if (!polling) { polling = true; requestAnimationFrame(poll); } };

export function mountGamepad() {
  if (!('getGamepads' in navigator)) return;
  window.addEventListener('gamepadconnected', start);
  window.addEventListener('gamepaddisconnected', start);   // (once more: what it held is let go)
  if (padConnected()) start();
}
