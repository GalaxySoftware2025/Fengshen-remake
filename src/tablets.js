// The 古文書 the four 守護靈 give 林雲, each the colour its line names: 白石 (scene 25), 青石 (36), 黃石 (42), 紅石 (53).
// The original draws them with three item arts (0f0cbc yellow, 0f0d36 cyan, 0f0db0 red): 白石 in the yellow one's and
// 黃石 in the red one's, as 紅石 [the user's report, 2026-11-17: scene 25's 白石古文書 came out yellow]. Here a scene's
// tablet takes the art of its colour, or a tone over the art (white: no art of it). test/tablets.mjs
// a scene's prop (src/scene.js tossSprite): { art, tone } (art: the image's name in assets/units; tone: recolor())
const BY = { '25': { 'item-0f0cbc': { tone: 'white' } }, '42': { 'item-0f0db0': { art: 'item-0f0cbc' } } };
export const tabletOf = (tag, name) => Object.assign({ art: name }, (BY[tag] || {})[name]);
// the tones: shadow, middle and light, the art's own lit pixels laid over them by brightness; the dark outline kept
const TONES = { white: [0x8e9aae, 0xd6dee8, 0xffffff] };
const ch = (c, s) => (c >> s) & 255;
export function recolor(d, tone) {   // d: RGBA bytes, changed in place
  const T = TONES[tone]; if (!T) return d;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue; const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; if (l < 0.25) continue;
    const u = Math.min(1, (l - 0.25) / 0.6) * 2, k = Math.min(1, Math.floor(u)), f = u - k, a = T[k], b = T[Math.min(2, k + 1)];
    for (const [j, s] of [[0, 16], [1, 8], [2, 0]]) d[i + j] = Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * Math.min(1, f));
  }
  return d;
}
