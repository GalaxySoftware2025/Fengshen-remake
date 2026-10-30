// Sprite keys. A unit's sprite is named by its ROM graphics address (assets/units/<gfx>.png, from tools/rom/export.py);
// the graphics that have hand-finished 4x HD sheets from the 磻溪 build keep their old names (assets/spr_<name>.png).
// Each legacy SD sheet is pixel-identical to the generated sheet of the same address.
export const LEGACY = {
  0x04f0fc: 'p0', 0x05219c: 'p1', 0x054da8: 'p2', 0x0581c4: 'p3', 0x05b120: 'p4', 0x05e3a8: 'p5', 0x061a72: 'p6',
  0x064ac8: 'jiang', 0x067a8e: 'jiang_bound', 0x0c7c6a: 'fox', 0x0c550c: 'archer', 0x0b62ba: 'ghost',
};
export const spriteKey = gfx => LEGACY[gfx] || gfx.toString(16).padStart(6, '0');
export const isLegacy = key => Object.values(LEGACY).includes(key);
// Sheets that hold one pose of their own, frame 0: the rest of the 9-frame block, and the action blobs after it, are other
// sprites' tiles. 火鳳凰 (battle 27): her record's march table (+0x0A, ROM 0x388DA) is sixteen zeros, so the original's
// marching (0x1491C: the frame copied each tick is graphic + table[step] * 32) always shows frame 0. 幻士 (battles 12, 18,
// 19): a phantom, seen only for the moment it shows itself, facing down, which both of the map's draws (0x22300,
// 0x224E8: down 0, up 0x600, left 0xC00) show as frame 0; its frames 1-8 are skull wisps. Such a unit stands on frame 0
// in every facing and pose (src/actors.js); tools/rom/sheetcheck.py checks the list against the ROM and the pictures.
export const ONE_POSE = new Set(['08dc92', '0e5960', '1231e2']);   // (1231e2: 黃飛虎 chained up in battle 20's room 2)
// The flying enemies' sheets (their records' move type crosses terrain 2: 鬼靈, 守護靈, 異鳥, 夜蝠, 飛兵): in a story scene,
// where actors have no records, these are drawn over the scenery as battle fliers are (scene 26's 鬼靈 among the bamboo,
// the user's report); not the flying heroes 哪吒 and 雷震子, who walk through towns. test/battles.mjs keeps it to the records.
export const FLYING_FOES = new Set(['0b62ba', '09039c', '0ca8fe', '0a4f50', '08b5be']);
// spirits that float off in a story scene and keep the height they rose from over lower ground (scene 42: the 北方守護靈
// leaves the stele over the balustrade and the sea, src/scene.js); drawn over the scenery as the fliers are
export const FLOATERS = new Set(['0b8ccc']);
// sheets drawn lying on the ground seen from above, laid flat on it in a story scene (src/actors.js lie), not stood up as
// a card: scene 0's rabbit carcass after 林雲's blow [the user's report: it seemed to float]; tools/qa/lying.js
// @qa scene:0 job:lying   (only scene 0's carcass lies: src/sprites.js LYING)
export const LYING = new Set(['079f32']);
