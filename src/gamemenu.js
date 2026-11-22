// The menu at the top left [the user's call, 2026-11-08; the top right until 2026-11-20]: 選單 folds out 遊戲速度 (the game speed, src/speed.js), 畫面品質
// (the picture quality: 低 / 中 / 高, src/quality.js), 音量 (the volume: 0-100%, src/audio.js),
// 勝利條件 (the battle's name and conditions, as its brief words them; only in a battle or its camp, not a story scene) and
// 控制按鍵 (the controls page, as a first visit shows it). Folded, the button shows the speed when it is not ×1 (speed.js). A click
// outside, O or Esc folds it again (that click or key does nothing else). A page opened from it pauses the game (speed.js
// pause) until a click, I, O or Space closes it.
import * as Keys from './keys.js';
import { padConnected } from './gamepad.js';
import { pause } from './speed.js';
import { D } from './rules.js';
import { FX } from './battle.js';

const $ = id => document.getElementById(id);

// the controls page (#controls): resolves when closed; on a touch screen (the pad shown: html.touch) the pad's buttons,
// with a controller connected its buttons (src/gamepad.js)
export const showControls = () => showPanel('<div class="panel"><h3>操作說明</h3><table>' + (document.documentElement.classList.contains('touch') ? Keys.TOUCH_HELP : padConnected() ? Keys.PAD_HELP : Keys.HELP).map(h => `<tr><td>${h.pre ? `<small>${h.pre}</small>` : ''}${h.caps.map(c => `<kbd>${c}</kbd>`).join('')}${h.also ? `<small>${h.caps.length ? '或 ' : ''}${h.also}</small>` : ''}</td><td>${h.what}</td></tr>`).join('') +
  `</table><div class="press">${Keys.tapOr('點擊或按 I 繼續')}</div></div>`);
// the battle's conditions, as its brief words them (main.js brief)
const showConditions = () => showPanel(`<div class="panel cond-panel"><h3>勝利條件</h3><h2>${D.name}</h2><div class="cond"><div><b>勝利條件</b>${FX.winText || D.win.join(' · ')}</div><div><b>敗北條件</b>${FX.loseText || D.lose.join(' · ')}</div></div><div class="press">${Keys.tapOr('點擊或按 I 繼續')}</div></div>`);
// a page over the game (#controls): resolves when closed; every key and click while it shows is its own
function showPanel(html) {
  const box = $('controls');
  box.innerHTML = html;
  box.classList.remove('hidden');
  return new Promise(res => {
    const key = e => { e.preventDefault(); e.stopImmediatePropagation(); if (['ok', 'cancel', 'fast'].some(a => Keys.is(e, a))) done(); };
    const click = e => { e.stopPropagation(); done(); };
    const done = () => { box.removeEventListener('click', click); window.removeEventListener('keydown', key, true); box.classList.add('hidden'); res(); };
    box.addEventListener('click', click); window.addEventListener('keydown', key, true);
  });
}

export function mountMenu() {
  const root = $('gmenu'), panel = root.querySelector('.gm-panel');
  const isOpen = () => !panel.classList.contains('hidden');
  const fold = open => { panel.classList.toggle('hidden', !open); root.classList.toggle('open', open); };
  for (const ev of ['click', 'pointerdown', 'mousedown']) root.addEventListener(ev, e => e.stopPropagation());   // (neither advances a line nor picks a cell)
  // 勝利條件 only where there is a battle to tell of: on its field or in its camp (not a story scene, nor the title)
  const inBattle = () => !!(D.win && D.name) && [$('hud'), $('camp')].some(e => e && !e.classList.contains('hidden'));
  root.querySelector('.gm-open').addEventListener('click', () => { root.querySelector('.gm-cond').classList.toggle('hidden', !inBattle()); fold(!isOpen()); });
  const page = show => async () => { fold(false); pause(true); try { await show(); } finally { pause(false); } };
  root.querySelector('.gm-cond').addEventListener('click', page(showConditions));
  root.querySelector('.gm-keys').addEventListener('click', page(showControls));
  // a click outside folds it, and is swallowed whole (down, up, click: the battle picks a cell on pointerup)
  let swallow = false;
  window.addEventListener('pointerdown', e => { swallow = false; if (!isOpen() || root.contains(e.target)) return; fold(false); swallow = true; e.stopImmediatePropagation(); e.preventDefault(); }, true);
  for (const ev of ['pointerup', 'mouseup', 'click']) window.addEventListener(ev, e => { if (!swallow) return; e.stopImmediatePropagation(); if (ev === 'click') swallow = false; }, true);
  window.addEventListener('keydown', e => { if (isOpen() && Keys.is(e, 'cancel')) { fold(false); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}
