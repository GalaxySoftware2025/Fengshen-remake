// The files the 磻溪 build's code still loads by their old names, made from the ROM like everything else:
//   assets/sd/spr_<name>.png, assets/spr_<name>.png     walk sheets (src/sprites.js LEGACY) and their 4x
//   assets/sd/sprf_<name>.png, assets/sprf_<name>.png   the same in the hit-flash palette
//   assets/sd/act_<name>.png, assets/act_<name>.png     action sheets (extract/actions.js) in the unit's attack type
// The SD sheets are pixel-identical to the 磻溪 build's; its 4x differ in a few edge alpha pixels (another xBR run).
import { image, cramRGB } from './png.js';
import { sheetImage } from './battles.js';
import { actSheet } from './actions.js';
import { upscale } from './hd.js';

export const NAMES = { 0x04f0fc: 'p0', 0x05219c: 'p1', 0x054da8: 'p2', 0x0581c4: 'p3', 0x05b120: 'p4', 0x05e3a8: 'p5', 0x061a72: 'p6',
  0x064ac8: 'jiang', 0x067a8e: 'jiang_bound', 0x0c7c6a: 'fox', 0x0c550c: 'archer', 0x0b62ba: 'ghost' };
const FRAMES = { jiang_bound: 2 };                    // the bound 姜子牙: his two poses
const NO_FLASH = new Set(['jiang_bound']), NO_ACT = new Set(['jiang', 'jiang_bound']);

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

// actions: the ACTIONS object extract/actions.js writes (with legacy graphics); b13: battle 13's extractBattle
export function run(R, files, { actions, b13 }) {
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
}
