// The controls, one table for every screen [the user's choice, 2026-10-29: W S A D to move, I to confirm, O to cancel,
// Q / E to turn the battle's camera].
// Matched by the physical key (e.code), so Caps Lock, Shift or a Chinese input method does not change them; the arrows,
// Enter and Esc work as well. A synthetic event with only a key (the QA tools' ' ') is matched by that key.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  ok: ['KeyI', 'Enter'], cancel: ['KeyO', 'Escape', 'Backspace'],
  fast: ['Space'],     // held: a scene at 4x, a battle's animations at 3x
  skip: ['Escape'],    // a story scene to the end of its part (not O: mashing cancel after a battle must not skip the story)
  danger: ['Tab'],     // a battle: the enemies' reach
  turnLeft: ['KeyQ'], turnRight: ['KeyE'],   // a battle: the camera a quarter turn round the map
  mute: ['KeyM'],
  slower: ['Minus', 'NumpadSubtract'], faster: ['Equal', 'NumpadAdd'],   // the game speed (speed.js), as its − and ＋ [the keyboard's gap: they were mouse-only]
};
const codeOf = k => k == null ? '' : k === ' ' ? 'Space' : k.length === 1 ? 'Key' + k.toUpperCase() : k;
// is e one of action's keys
export const is = (e, action) => KEYS[action].includes(e.code || codeOf(e.key));
// the direction e moves in, or null
export const dirOf = e => ['up', 'down', 'left', 'right'].find(a => is(e, a)) || null;
// The controls page shown on a player's first visit (main.js controlsPage) [the user's request, 2026-10-29]: one row a
// line, every action above in some row (tools/qa/keys.js checks it); caps are the keys drawn as keys, also the others.
export const HELP = [
  { act: ['up', 'down', 'left', 'right'], caps: ['W', 'S', 'A', 'D'], also: '方向鍵', what: '移動游標 · 選擇' },
  { act: ['ok'], caps: ['I'], also: 'Enter · 滑鼠左鍵', what: '確定' },
  { act: ['cancel'], caps: ['O'], also: 'Esc · 滑鼠右鍵', what: '取消 · 返回' },
  { act: ['turnLeft', 'turnRight'], caps: ['Q', 'E'], what: '轉動戰場視角' },
  { act: ['danger'], caps: ['Tab'], what: '顯示敵方攻擊範圍' },
  { act: ['fast'], caps: ['Space'], pre: '按住', what: '加速' },
  { act: ['skip'], caps: ['Esc'], what: '跳過劇情' },
  { act: ['slower', 'faster'], caps: ['−', '+'], what: '遊戲速度' },
  { act: ['mute'], caps: ['M'], what: '靜音' },
];
