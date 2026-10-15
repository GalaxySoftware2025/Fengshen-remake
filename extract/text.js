// The cartridge's text and scene scripts (ports of tools/rom/dec2.py and scenes.py): glyph strings, the dialogue table,
// and a walk over the 65 scene scripts with each line's text resolved.
import GLYPHS from './glyphs.js';

const M = {};
for (const [k, v] of Object.entries(GLYPHS)) M[k] = v === '•' ? '・' : v;
export { M as glyphMap };

// a glyph string at a: bank bytes F0+, FC (a line break: '/'), FD / FE with an argument; FF ends. -> [text, next address]
export function s(R, a, n = 400) {
  let out = '', bank = 0, i = a;
  while (R.B(i) !== 0xFF && [...out].length < n) {
    const b = R.B(i); i++;
    if (b === 0xFC) { out += '/'; i++; continue; }
    if (b === 0xFD || b === 0xFE) { out += '{' + (b & 15).toString(16) + R.B(i) + '}'; i++; continue; }
    if (b >= 0xF0) { bank = b - 0xF0; continue; }
    out += M[bank + ',' + b] ?? '□';
  }
  return [out, i + 1];
}
// the share of a byte run that reads as glyph text (bank selectors and mapped glyphs)
export function score(R, a, e) {
  let bank = 0, good = 0, n = 0, i = a;
  while (i < e) {
    const b = R.B(i); i++; n++;
    if (b === 0xFC || b === 0xFD || b === 0xFE) { i++; good++; continue; }
    if (b >= 0xF0) { good += b <= 0xF6 ? 1 : 0; bank = b - 0xF0; continue; }
    good += (bank + ',' + b) in M ? 1 : 0;
  }
  return good / Math.max(n, 1);
}

// scene scripts: opcode = word index into the handler table at 0x149E (58 entries), SIZE their total lengths
export const SIZE = { 0: 4, 1: 4, 2: 2, 3: 8, 4: 6, 5: 8, 6: 4, 7: 6, 8: 4, 9: 2, 10: 18, 11: 10, 12: 4, 13: 6, 14: 4, 15: 4, 16: 2,
  17: 8, 18: 2, 19: 6, 20: 8, 21: 8, 22: 8, 23: 6, 24: 6, 25: 4, 26: 8, 27: 2, 28: 4, 29: 2, 30: 4, 31: 12, 32: 4,
  33: 4, 34: 4, 35: 4, 36: 12, 37: 6, 38: 6, 39: 6, 40: 2, 41: 4, 42: 4, 43: 4, 44: 6, 45: 14, 46: 4, 47: 4, 48: 8,
  49: 6, 50: 6, 51: 16, 52: 6, 53: 4, 54: 12, 55: 6, 56: 4, 57: 2 };
export const NAME = { 35: 'join', 42: 'join2', 30: 'herotoactor', 13: 'mapptr', 19: 'setline', 0: 'map', 4: 'say', 10: 'battle', 15: 'wait', 21: 'actor', 22: 'walk', 20: 'place', 23: 'hook', 56: 'music' };
export const tables = R => ({
  SCENES: Array.from({ length: 65 }, (_, i) => R.L(0x1396 + 4 * i)),
  CHAPTER: R.list(0x31f6, 65),                                     // scene -> chapter index
  HEADERS: Array.from({ length: 65 }, (_, i) => R.L(0x1f0a + 4 * i)),   // battle header per scene, 0x582e = none
});
// the dialogue: table 0x100370[chapter][speaker][n]
export function message(R, chapter, speaker, idx) {
  const tab = R.L(R.L(R.L(0x100370) + 4 * chapter) + 4 * speaker);
  return s(R, R.L(tab + 4 * idx) + 1, 3000)[0];
}
// every scene's ops with their lines resolved (a per-speaker counter, reset each chapter, or an absolute index)
export function walk(R) {
  const { SCENES, CHAPTER, HEADERS } = tables(R), out = [];
  let chapter = -1, counters = {};
  SCENES.forEach((base, si) => {
    if (CHAPTER[si] !== chapter) { chapter = CHAPTER[si]; counters = {}; }
    const ops = []; let o = 0, ends;
    for (;;) {
      const w = R.W(base + o);
      if (w >= 0xfffd) { ends = w; break; }
      const n = SIZE[w], arg = R.bytes(base + o + 2, n - 2);
      const op = { at: base + o, op: w, name: NAME[w] || 'op' + w, arg: R.hex(base + o + 2, n - 2) };
      if (w === 4 || w === 55) {
        const spk = arg[0], actor = arg[1], cnt = arg[2] << 8 | arg[3];
        let idx;
        if (cnt >= 0x8000) idx = cnt & 0x7fff;
        else { idx = counters[spk] || 0; counters[spk] = idx + cnt; }
        let text; try { text = message(R, chapter, spk, idx); } catch (e) { text = '?'; }
        Object.assign(op, { speaker: spk, actor, idx, text });
      }
      if (w === 19) counters[R.W(base + o + 2)] = R.W(base + o + 4);
      if (w === 10) Object.assign(op, { deployMax: arg[3], heroFlags: Array.from(arg.subarray(4, 16)), counters: { ...counters } });   // (the speakers' counters as the battle starts: its say-lists count on from them)
      if (w === 35 || w === 42) op.join = R.W(base + o + 2);
      if (w === 0) op.mapIndex = R.W(base + o + 2);
      ops.push(op); o += n;
    }
    out.push({ scene: si, chapter: chapter + 1, script: base, end: ends, ops, header: HEADERS[si] === 0x582e ? null : HEADERS[si] });
  });
  return out;
}
