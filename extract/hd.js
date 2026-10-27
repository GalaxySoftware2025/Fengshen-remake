// The 4x HD art (a port of tools/hd/upscale.js): xBR 4x of the original pixel art, a sheet of 32 px frames scaled frame
// by frame (frames never bleed into each other), transparent edges first filled with their opaque neighbours' colours.
//   assets/units/hd/<gfx>.png, assets/units/act/hd/*.png, assets/items/hd/*.png, assets/spells/hd/*.png, assets/fx/hd/*.png
// A sheet whose size is not a multiple of 32 is cut as upscale.js cut it (its last frames read past the row's end).
import { xbr4x } from './vendor/xbr.js';
import { image } from './png.js';

const K = 4, P = 2;
function bleed(px, w, h) {   // spread opaque colours into transparent neighbours so edges don't blend toward black
  for (let pass = 0; pass < 2; pass++) {
    const copy = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (px[i] >>> 24) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (copy[j] & 0xffffff && !(px[i] & 0xffffff)) px[i] = copy[j] & 0xffffff;
      }
    }
  }
}
// img: { w, h, channels: 4, px } -> the 4x image
export function upscale(img, tw = 32, th = 32, clampEdges = false) {
  const W = img.w, H = img.h, d = img.px; tw = tw || W; th = th || H;
  const out = image(W * K, H * K, 4);
  for (let ty = 0; ty < H; ty += th) for (let tx = 0; tx < W; tx += tw) {
    const pw = tw + P * 2, ph = th + P * 2, px = new Uint32Array(pw * ph); let opaque = false;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      let sx = tx + x - P, sy = ty + y - P, inside = sx >= tx && sx < tx + tw && sy >= ty && sy < ty + th;
      if (!inside && clampEdges) { sx = Math.min(tx + tw - 1, Math.max(tx, sx)); sy = Math.min(ty + th - 1, Math.max(ty, sy)); inside = true; }
      if (!inside) continue;
      const o = (sy * W + sx) * 4; if (d[o + 3]) opaque = true;
      px[y * pw + x] = ((d[o + 3] << 24) | (d[o + 2] << 16) | (d[o + 1] << 8) | d[o]) >>> 0;
    }
    if (!opaque) continue;
    bleed(px, pw, ph);
    const big = xbr4x(px, pw, ph, { blendColors: true, scaleAlpha: true });
    for (let y = 0; y < th * K; y++) for (let x = 0; x < tw * K; x++) {
      const v = big[(y + P * K) * pw * K + (x + P * K)], o = ((ty * K + y) * W * K + tx * K + x) * 4;
      out.px[o] = v & 255; out.px[o + 1] = (v >>> 8) & 255; out.px[o + 2] = (v >>> 16) & 255; out.px[o + 3] = v >>> 24;
    }
  }
  return out;
}
const WHOLE = /^assets\/fx\/demon-body\.png$/;   // a sprite scaled whole (tools/hd/upscale.js sprite)
const HD = [/^assets\/units\/[0-9a-f]{6}\.png$/, /^assets\/units\/act\/[^/]+\.png$/, /^assets\/units\/die\/[^/]+\.png$/, /^assets\/items\/[^/]+\.png$/, /^assets\/spells\/[^/]+\.png$/, /^assets\/fx\/(summon_\d+|guanyin|skull)\.png$/];
// every sprite sheet among files gets its HD sheet beside it, in hd/
export function run(files) {
  for (const p of Object.keys(files)) if (WHOLE.test(p) && typeof files[p] === 'object' && files[p].channels === 4) { const i = p.lastIndexOf('/'); files[p.slice(0, i) + '/hd' + p.slice(i)] = upscale(files[p], files[p].w, files[p].h); }
  for (const p of Object.keys(files)) if (HD.some(r => r.test(p)) && typeof files[p] === 'object' && files[p].channels === 4) {
    const i = p.lastIndexOf('/'); files[p.slice(0, i) + '/hd' + p.slice(i)] = upscale(files[p]);
  }
}
