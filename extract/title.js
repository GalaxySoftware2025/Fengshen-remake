// The title screen's background (a port of tools/rom/title.py): assets/maps/title-bg.png
// The power-on code [0x7C8 jsr 0x2CD8 (prologue part 1), 0x7E0 jsr 0xFE674 (the demo)] is skipped, so the title comes up
// at once. Its plane B is a world map in a 64x32-tile plane, streamed as it scrolls: H-scroll B falls by 1 px a frame
// for 917 px, then the screen fades out. The map repeats every 1024 px; the image is one period plus 128 px of the next
// (1152 x 224), captured while the screen is fully lit.
import { MD } from './md.js';
import { image, cramRGB } from './png.js';

const PERIOD = 1024, OUT_W = 1152;
function planeB(m) {
  const R = m.reg, pal = m.cram.map(cramRGB), dim = v => ({ 0: 32, 1: 64, 3: 128 })[v] || 32;
  const pw = dim(R[16] & 3), ph = dim((R[16] >> 4) & 3), pb = (R[4] & 7) << 13, V = m.vram;
  const img = new Array(ph * 8 * pw * 8);
  for (let ty = 0; ty < ph; ty++) for (let tx = 0; tx < pw; tx++) {
    const e = m.w(pb + 2 * (ty * pw + tx)), t = e & 0x7ff;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sx = e & 0x800 ? 7 - x : x, sy = e & 0x1000 ? 7 - y : y, b = V[t * 32 + sy * 4 + (sx >> 1)], p = sx & 1 ? b & 15 : b >> 4;
      img[(ty * 8 + y) * pw * 8 + tx * 8 + x] = pal[((e >> 13) & 3) * 16 + p];
    }
  }
  return { img, PW: pw * 8 };
}
export function titleBg(rom) {
  const m = new MD(rom); m.extra = new Uint8Array(0x400000);   // the boot code reads past the cartridge
  m.rom.set([0x4e, 0x71, 0x4e, 0x71, 0x4e, 0x71], 0x7c8); m.rom.set([0x4e, 0x71, 0x4e, 0x71, 0x4e, 0x71], 0x7e0);
  m.run(30);
  const hs = (m.reg[13] & 0x3f) << 10, BW = 1400, big = new Array(224 * BW).fill(null), seen = new Uint8Array(BW);
  let hmin = 0, full = 0;
  for (let i = 0; i < 130; i++) {
    let h = m.w(hs + 2); if (h > 32767) h -= 65536;
    if (i && h > hmin + 8) break;   // the pan is over
    hmin = Math.min(hmin, h);
    let lum = 0; for (let k = 0; k < 16; k++) { const c = m.cram[k]; lum += ((c >> 1) & 7) + ((c >> 5) & 7) + ((c >> 9) & 7); }
    full = Math.max(full, lum);
    if (lum === full) {   // not while fading in or out
      const { img, PW } = planeB(m);
      for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) big[y * BW + x - h] = img[y * PW + (((x - h) % PW) + PW) % PW];
      for (let x = 0; x < 256; x++) seen[x - h] = 1;
    }
    m.run(8);
  }
  let x0 = BW, x1 = -1; for (let x = 0; x < BW; x++) if (seen[x]) { x0 = Math.min(x0, x); x1 = x; }
  const aw = x1 + 1 - x0, out = image(OUT_W, 224, 3);
  for (let y = 0; y < 224; y++) for (let x = 0; x < aw - PERIOD; x++) {
    const a = big[y * BW + x0 + x], b = big[y * BW + x0 + x + PERIOD];
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) throw new Error('the title map does not repeat every 1024 px');
  }
  for (let y = 0; y < 224; y++) for (let x = 0; x < OUT_W; x++) { const c = big[y * BW + x0 + (x % PERIOD)], o = (y * OUT_W + x) * 3; out.px[o] = c[0]; out.px[o + 1] = c[1]; out.px[o + 2] = c[2]; }
  return { img: out, pan: -hmin };
}
export function run(R, rom, files) { files['assets/maps/title-bg.png'] = titleBg(rom).img; }
