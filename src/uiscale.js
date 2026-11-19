// The overlay's size follows the window's [the user's call, 2026-11-15: on a bigger screen the damage numbers, the hero
// card and the rest read small, being sized in fixed pixels while the world scales with the window]. One factor, --ui,
// is the window against the size they were made for, the user's Mac in Chrome full screen (1440 x 900 CSS px: as it was
// there, it stays): min(w / 1440, h / 900), kept within 0.6 to 2.5. style.css zooms the overlay by it (#hud, #labels,
// #gmenu, #dialog, #banner, #toast); what is placed at a point on the screen (a floater, a unit's bar and tag, the
// command menu and ring round a unit) is placed at that point divided by it (toUI), being inside the zoom. The full
// screens (title, camp, brief) are not zoomed yet. A QA page (&qa) stays at 1, as its shots and clicks assume, unless
// &ui. (tools/qa/uiscale.js)
export const REF_W = 1440, REF_H = 900;
const QA = /[#&]qa\b/.test(location.hash) && !/[#&]ui\b/.test(location.hash);
let k = 1;
export const uiScale = () => k;
export const toUI = px => px / k;
export const scaleFor = (w, h) => Math.max(0.6, Math.min(2.5, Math.min(w / REF_W, h / REF_H)));
export function fitUI() {
  k = QA ? 1 : Math.round(scaleFor(window.innerWidth, window.innerHeight) * 1000) / 1000;   // (rounded: the CSS and toUI the same)
  document.documentElement.style.setProperty('--ui', String(k));
}
fitUI(); window.addEventListener('resize', fitUI);
