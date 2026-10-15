// Sprite keys. A unit's sprite is named by its ROM graphics address (assets/units/<gfx>.png, from tools/rom/export.py);
// the graphics that have hand-finished 4x HD sheets from the 磻溪 build keep their old names (assets/spr_<name>.png).
// Each legacy SD sheet is pixel-identical to the generated sheet of the same address.
export const LEGACY = {
  0x04f0fc: 'p0', 0x05219c: 'p1', 0x054da8: 'p2', 0x0581c4: 'p3', 0x05b120: 'p4', 0x05e3a8: 'p5', 0x061a72: 'p6',
  0x064ac8: 'jiang', 0x067a8e: 'jiang_bound', 0x0c7c6a: 'fox', 0x0c550c: 'archer', 0x0b62ba: 'ghost',
};
export const spriteKey = gfx => LEGACY[gfx] || gfx.toString(16).padStart(6, '0');
export const isLegacy = key => Object.values(LEGACY).includes(key);
