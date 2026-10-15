// The files the 磻溪 build's code still loads by their old names, made from the ROM like everything else:
//   assets/sd/spr_<name>.png, assets/spr_<name>.png     walk sheets (src/sprites.js LEGACY) and their 4x
//   assets/sd/sprf_<name>.png, assets/sprf_<name>.png   the same in the hit-flash palette
//   assets/sd/act_<name>.png, assets/act_<name>.png     action sheets (extract/actions.js) in the unit's attack type
//   assets/sd/fire.png, assets/fire.png                 磻溪's burning block, 4 frames (raw tiles at 0x151DB8, the
//                                                       battle map's palette line 1)
//   assets/map.png, assets/map_hd.png                   磻溪's map as the battle opens: its 14 rows, the east column ablaze
//   assets/fx_52.png                                    哮天犬 (spell 52) running: six frames of the cast, in the atlas
//                                                       layout src/spells.js reads (anim.js fx[52] rects)
// The SD sheets are pixel-identical to the 磻溪 build's; its 4x differ in a few edge alpha pixels (another xBR run).
import { image, cramRGB } from './png.js';
import { sheetImage } from './battles.js';
import { actSheet } from './actions.js';
import { upscale } from './hd.js';
import { MD } from './md.js';
import { ringState, cast, layer, components, crop } from './spellfx.js';

export const NAMES = { 0x04f0fc: 'p0', 0x05219c: 'p1', 0x054da8: 'p2', 0x0581c4: 'p3', 0x05b120: 'p4', 0x05e3a8: 'p5', 0x061a72: 'p6',
  0x064ac8: 'jiang', 0x067a8e: 'jiang_bound', 0x0c7c6a: 'fox', 0x0c550c: 'archer', 0x0b62ba: 'ghost' };
const FRAMES = { jiang_bound: 2 };                    // the bound 姜子牙: his two poses
const NO_FLASH = new Set(['jiang_bound']), NO_ACT = new Set(['jiang', 'jiang_bound']);
const FIRE = 0x151db8, HOUND = [56, 57, 86, 87, 88, 89];   // cast frames of spell 52 (after the confirm, 0-based) that make the atlas
const HOUND_AT = [0, 95, 190, 284, 377, 469];

function flashOf(R, img) {   // a unit sheet in the hit-flash palette (actions.js FLASH)
  const RGB = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(0x38436 + 2 * i)));
  const FLASH = RGB.map(c => c.every(v => v === 0) ? [252, 252, 252] : c.map(v => Math.min(252, v + 144)));
  const out = { ...img, px: img.px.slice() };
  for (let i = 0; i < out.px.length; i += 4) {
    const k = RGB.findIndex(c => c[0] === img.px[i] && c[1] === img.px[i + 1] && c[2] === img.px[i + 2]);
    if (k >= 0) out.px.set(FLASH[k], i);
  }
  return out;
}
function frames(img, n) { const out = image(32 * n, 32, 4); for (let y = 0; y < 32; y++) out.px.set(img.px.subarray(y * img.w * 4, y * img.w * 4 + 32 * n * 4), y * 32 * n * 4); return out; }
const clear = img => { const out = { ...img, px: img.px.slice() }; for (let i = 0; i < out.px.length; i += 4) if (!out.px[i + 3]) out.px.fill(0, i, i + 3); return out; };   // the 磻溪 exporter: no colour under alpha 0
const rgba = img => { if (img.channels === 4) return img; const out = image(img.w, img.h, 4); for (let o = 0; o < img.w * img.h; o++) { out.px.set(img.px.subarray(o * 3, o * 3 + 3), o * 4); out.px[o * 4 + 3] = 255; } return out; };

// actions: the ACTIONS object extract/actions.js writes (with legacy graphics); b13: battle 13's extractBattle
export function run(R, rom, files, { actions, b13, snap }) {
  // the attack type the 磻溪 build drew each with: a hero's own (its template +0x2B), else the one battle 13 gives it
  const heroGfx = {}; for (const h of actions.common.heroes) heroGfx[h.gfx] = actions.heroes[h.cid];
  const types = {}; for (const g of Object.keys(NAMES)) types[g] = heroGfx[+g] ?? actions.battles[13][b13.enemies.findIndex(e => e.gfx === +g)];
  const put = (name, sd) => { files['assets/sd/' + name + '.png'] = sd; files['assets/' + name + '.png'] = upscale(sd); };
  for (const [g, n] of Object.entries(NAMES)) {
    const walk = FRAMES[n] ? frames(sheetImage(R, +g), FRAMES[n]) : sheetImage(R, +g);
    put('spr_' + n, walk);
    if (!NO_FLASH.has(n)) put('sprf_' + n, clear(flashOf(R, walk)));
    if (!NO_ACT.has(n)) put('act_' + n, clear(actSheet(R, +g, types[+g])));
  }
  // the fire: 4 frames of 4x4 tiles, row by row
  const pal = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(b13.map.addr.palette + 32 + 2 * i))), fire = image(128, 32, 4);
  for (let i = 0; i < 64; i++) {
    const k = i >> 4, ty = (i >> 2) & 3, tx = i & 3;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const b = R.B(FIRE + 32 * i + y * 4 + (x >> 1)), p = x & 1 ? b & 15 : b >> 4, o = ((ty * 8 + y) * 128 + k * 32 + tx * 8 + x) * 4;
      fire.px.set(pal[p], o); fire.px[o + 3] = 255;
    }
  }
  put('fire', fire);
  // the map: battle 13's top 14 rows, column 31 burning (fire frame 1)
  const m13 = b13.img, map = image(1024, 448, 3);
  for (let y = 0; y < 448; y++) map.px.set(m13.px.subarray(y * m13.w * 3, y * m13.w * 3 + 1024 * 3), y * 1024 * 3);
  for (let cy = 0; cy < 14; cy++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) map.px.set(fire.px.subarray((y * 128 + 32 + x) * 4, (y * 128 + 32 + x) * 4 + 3), ((cy * 32 + y) * 1024 + 992 + x) * 3);
  files['assets/map.png'] = map; files['assets/map_hd.png'] = upscale(rgba(map), 0, 0, true);
  // the hound: the sprite layer's largest piece at each frame
  const m = cast(rom, ringState(R, rom, snap), 52), atlas = image(1024, 344, 4); let f = 0;
  HOUND.forEach((want, k) => {
    m.run(want + 1 - f); f = want + 1;
    const im = layer(m, 's'), W = im.w, H = im.h, mask = new Uint8Array(W * H); for (let o = 0; o < W * H; o++) mask[o] = im.px[o * 4 + 3] ? 1 : 0;
    const [lab, n] = components(mask, W, H), size = new Int32Array(n + 1); for (let o = 0; o < W * H; o++) size[lab[o]]++; size[0] = 0;
    const big = size.indexOf(Math.max(...size)); for (let o = 0; o < W * H; o++) if (lab[o] !== big) im.px[o * 4 + 3] = 0;
    const c = crop(im);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const o = (y * c.w + x) * 4; if (c.px[o + 3]) atlas.px.set(c.px.subarray(o, o + 4), (y * 1024 + HOUND_AT[k] + x) * 4); }
  });
  files['assets/fx_52.png'] = atlas;
}
