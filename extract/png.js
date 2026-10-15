// A small PNG encoder (8-bit RGBA or RGB, no filtering beyond 'none'), on the platform's own deflate (CompressionStream):
// the extractor's images are written with it, in the browser and in Node alike.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf, crc = 0xFFFFFFFF) { for (let i = 0; i < buf.length; i++) crc = CRC[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); return crc; }
async function deflate(data) {
  const cs = new CompressionStream('deflate'), w = cs.writable.getWriter(); w.write(data); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); dv.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xFFFFFFFF) >>> 0);
  return out;
}
// pixels: Uint8Array of w * h * channels (4 = RGBA, 3 = RGB)
export async function encodePNG(w, h, pixels, channels = 4) {
  const stride = w * channels, raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; raw.set(pixels.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1); }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
// an image as the extractor passes it around: { w, h, channels, px }
export const image = (w, h, channels = 4) => ({ w, h, channels, px: new Uint8Array(w * h * channels) });
// the console's colours: a 9-bit CRAM word -> [r, g, b] as the Python tools scaled them (x 36)
export const cramRGB = c => [((c >> 1) & 7) * 36, ((c >> 5) & 7) * 36, ((c >> 9) & 7) * 36];
