// Every item's and spell's icon, as the battle's 物 / 法 header shows it (a port of tools/rom/icons.py, without its battle snapshot):
//   assets/items/NN.png   32x32 RGBA, colour 0 clear
//   assets/spells/NN.png  the same for each spell: the ring-icon table goes on past the 36 items with the 58 spells
//                         (spell n is entry 36 + n: 御劍術's curved sword, 擎天劍's three blades... as the 法 ring shows them)
// The header [0xE48E] unpacks the item's 16x16 ring icon (0x1B298C + 128 * item) to a pixel buffer (0xC9D8), scales it to
// 32x32 with the game's own scaler (0xCBE8, mode 1; the zoom's last step, ff0e30 = 13), packs it back to tiles (0xCA40)
// and sends them to VRAM tile 0x5E0, drawn with palette line 3 (the unit palette, 0x38436). Here those routines run
// in the emulator on the same buffers.
import { MD } from './md.js';
import { image, cramRGB } from './png.js';

const ICONS = 0x1b298c, COUNT = 36, SPELLS = 58;
export function icon(R, rom, item) {
  const m = new MD(rom); m.fresh = false;
  const L4 = (a, v) => { for (let k = 0; k < 4; k++) m.ram[(a + k) & 0xffff] = (v >>> (24 - 8 * k)) & 255; };
  const W2 = (a, v) => { m.ram[a & 0xffff] = v >> 8; m.ram[(a + 1) & 0xffff] = v & 255; };
  L4(0xff0e30, 13); L4(0xff0e34, 13); L4(0xff0e48, 1); L4(0xff0eb0, 2); L4(0xff0eb4, 2); W2(0xff0f50, 0x40); W2(0xff0f52, 9);
  m.call(0xc9d8, [0xff9000, ICONS + 128 * item]);
  m.ram[0x0f54] = 6; m.call(0xcbe8, [0xff8000, 0xff9000, 2, 2, 1]);
  L4(0xff0e48, 1); L4(0xff0eb0, 4); L4(0xff0eb4, 4); m.call(0xca40, [0xff9000, 0xff8000]);
  const rgb = Array.from({ length: 16 }, (_, i) => cramRGB(R.W(0x38436 + 2 * i))), img = image(32, 32, 4);
  for (let t = 0; t < 16; t++) {
    const cx = t >> 2, cy = t & 3;   // a 4x4 sprite: tiles run down each column
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const b = m.ram[0x9000 + t * 32 + y * 4 + (x >> 1)], p = x & 1 ? b & 15 : b >> 4, o = ((cy * 8 + y) * 32 + cx * 8 + x) * 4;
      if (p) { img.px[o] = rgb[p][0]; img.px[o + 1] = rgb[p][1]; img.px[o + 2] = rgb[p][2]; img.px[o + 3] = 255; }
    }
  }
  return img;
}
export function run(R, rom, files) {
  for (let k = 0; k < COUNT; k++) files['assets/items/' + String(k).padStart(2, '0') + '.png'] = icon(R, rom, k);
  for (let k = 0; k < SPELLS; k++) files['assets/spells/' + String(k).padStart(2, '0') + '.png'] = icon(R, rom, COUNT + k);
}
