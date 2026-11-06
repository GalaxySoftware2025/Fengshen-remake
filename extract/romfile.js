// The player's ROM file as the extractor wants it: the cartridge's 2 MB, byte for byte (checkRom). Dumps of the same
// cartridge come in other wrappings; each is undone here, and what comes out must still hash as the cartridge does (a
// trimmed dump, another revision, a translation or a hack is refused, never patched up):
//   a zip or gzip        its files, each tried as below
//   a copier header      512 bytes before the cartridge (.smd, some .bin / .gen)
//   SMD interleave       each 16 KB block its odd bytes, then its even bytes (.smd)
//   MGD interleave       the whole file its odd bytes, then its even bytes (some .md)
//   byte-swapped         each 16-bit word's two bytes the other way round
//   an overdump          the cartridge followed by a mirror of it or filler (4 MB): its first 2 MB
// findRom(bytes) -> { rom, how } or { bad } (what was wrong, and what was tried). Kept out of index.js: the extractor's
// fingerprint (tools/qa/extractver.mjs) reads that file's code, and how the file is opened changes nothing it makes.
import { ROM_SIZE, checkRom } from './index.js';

const MAX = 64 << 20;   // (no dump of a 2 MB cartridge is larger; a zip's file over it is not inflated)

const inflate = async (b, fmt) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream(fmt))).arrayBuffer());
// a block's odd bytes, then its even bytes -> the bytes in order
const deinterleave = (b, blk) => {
  const o = new Uint8Array(b.length);
  for (let s = 0; s < b.length; s += blk) { const h = blk >> 1; for (let i = 0; i < h; i++) { o[s + 2 * i] = b[s + h + i]; o[s + 2 * i + 1] = b[s + i]; } }
  return o;
};
const swap = b => { const o = new Uint8Array(b.length); for (let i = 0; i + 1 < b.length; i += 2) { o[i] = b[i + 1]; o[i + 1] = b[i]; } return o; };

// the files a zip or gzip holds (by the zip's central directory; stored or deflated, not encrypted), else the file itself
async function unpack(b) {
  if (b[0] === 0x1F && b[1] === 0x8B) return [['gunzipped', await inflate(b, 'gzip')]];
  if (!(b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4)) return [['', b]];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), out = [];
  let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054B50) e--;
  if (e < 0) throw new Error('a broken zip');
  for (let k = 0, p = dv.getUint32(e + 16, true), n = dv.getUint16(e + 10, true); k < n && dv.getUint32(p, true) === 0x02014B50; k++) {
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), full = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)), lh = dv.getUint32(p + 42, true);
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    if (flags & 1 || full < ROM_SIZE || full > MAX || (method !== 0 && method !== 8)) continue;   // (encrypted, too small or too large)
    const d = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true), raw = b.subarray(d, d + size);
    out.push(['in the zip as ' + name, method === 8 ? await inflate(raw, 'deflate-raw') : raw]);
  }
  return out;
}

// each way the bytes may hold the cartridge, [how, bytes] (an overdump cut to its first 2 MB)
function* forms(b) {
  const bodies = [['', b]];
  if (b.length % 0x4000 === 512) bodies.push(['without its 512-byte header', b.subarray(512)]);
  for (const [h, x] of bodies) {
    const and = s => [h, s].filter(Boolean).join(', ');
    const ways = [[and('as is'), x], [and('SMD-interleaved'), x.length % 0x4000 ? null : deinterleave(x, 0x4000)],
      [and('MGD-interleaved'), x.length % 2 ? null : deinterleave(x, x.length)], [and('byte-swapped'), swap(x)]];
    for (const [how, y] of ways) if (y && y.length >= ROM_SIZE) yield y.length > ROM_SIZE ? [how + ', its first 2 MB', y.subarray(0, ROM_SIZE)] : [how, y];
  }
}

export async function findRom(bytes) {
  if (bytes.length > MAX) return { bad: 'a file of ' + bytes.length + ' bytes, too large for a dump of this game' };
  let files; try { files = await unpack(bytes); } catch (err) { return { bad: String(err && err.message || err) }; }
  if (!files.length) return { bad: 'the zip holds no file the size of this game' };
  const tried = [];
  for (const [where, b] of files) {
    if (b.length < ROM_SIZE) { tried.push((where ? where + ': ' : '') + b.length + ' bytes, smaller than the game (' + ROM_SIZE + ')'); continue; }
    for (const [how, y] of forms(b)) {
      const label = [where, how].filter(Boolean).join(', ');
      if (!await checkRom(y)) return { rom: y.slice(), how: label };
      tried.push(label);
    }
  }
  return { bad: files.length === 1 && bytes.length < ROM_SIZE ? tried[0] : 'not this game\'s cartridge in any form tried: ' + tried.join('; ') };
}
