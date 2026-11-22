// prison.js's own texture recipes, apart from the set so src/kit/tex.js's workers can paint them ahead (src/kit/recipes.js;
// moved as they were: the pixels the same). Nothing here comes from the ROM.
import * as T from '../../kit/paint.js';

// the totems' gilt relief: a stern mask above coiled scrolls between beaded bands, worn bright on the high points
export function totemTex() {
  return ['chongTotem', 512, (u, v, o) => {
    const B = [0.85, 0.66, 0.24], n = T.fbm(u, v, 7, 4, 31);
    let h = 0.45;
    const band = y => Math.max(0, 1 - Math.abs(v - y) / 0.025);
    h += 0.35 * Math.max(band(0.08), band(0.92), band(0.55));                                  // the bands
    if (Math.abs(v - 0.08) < 0.03 || Math.abs(v - 0.92) < 0.03) h += 0.15 * (Math.sin(u * Math.PI * 24) > 0.3 ? 1 : 0);   // beads
    if (v > 0.14 && v < 0.5) {                                                                   // the mask: brow, eyes, nose, mouth
      const x = Math.abs(u - 0.5), y = (v - 0.14) / 0.36;
      if (y < 0.18 && x < 0.38) h += 0.25 * (1 - y / 0.18) * (x < 0.36 ? 1 : 0);
      if (Math.hypot((x - 0.18) / 0.11, (y - 0.33) / 0.09) < 1) h += 0.3;
      if (Math.hypot((x - 0.18) / 0.05, (y - 0.33) / 0.05) < 1) h -= 0.25;
      if (x < 0.05 && y > 0.3 && y < 0.7) h += 0.25;
      if (Math.abs(y - 0.82) < 0.05 && x < 0.22) h -= 0.2;
      if (x > 0.36 && x < 0.44 && y > 0.2 && y < 0.8) h += 0.2;                                 // the face's frame
    }
    if (v > 0.6 && v < 0.88) {                                                                   // two coiled scrolls
      for (const cx of [0.3, 0.7]) { const dx = u - cx, dy = v - 0.74, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (r < 0.17) h += 0.22 * (Math.sin(r * 90 - a * 2) > 0.2 ? 1 : 0) * (1 - r / 0.17); }
    }
    const hi = T.clamp((h - 0.45) * 2.2);
    o.c = T.mixc([B[0] * 0.7, B[1] * 0.58, B[2] * 0.36], [B[0] * 1.15, B[1] * 1.12, B[2] * 0.95], T.clamp(0.35 + hi * 0.65 + (n - 0.5) * 0.3));
    o.m = 0.55; o.r = 0.45 - hi * 0.2 + n * 0.12; o.h = h;   // (gilt over the carving: part diffuse, so the dark gaol does not turn it bronze)
  }, 4];
}
