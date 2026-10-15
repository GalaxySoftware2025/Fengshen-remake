// Reading the player's cartridge: big-endian bytes, words and longs, and the checks that it is the one this was made for.
export class Rom {
  constructor(bytes) { this.b = bytes; }
  B(a) { if (a < 0 || a >= this.b.length) throw new RangeError('ROM read past the end at ' + a.toString(16)); return this.b[a]; }
  W(a) { return this.B(a) << 8 | this.B(a + 1); }
  L(a) { return (this.B(a) << 24 | this.B(a + 1) << 16 | this.B(a + 2) << 8 | this.B(a + 3)) >>> 0; }
  sW(a) { const v = this.W(a); return v & 0x8000 ? v - 0x10000 : v; }
  bytes(a, n) { return this.b.subarray(a, a + n); }
  list(a, n) { return Array.from(this.b.subarray(a, a + n)); }
  hex(a, n) { return Array.from(this.b.subarray(a, a + n), v => v.toString(16).padStart(2, '0')).join(''); }
  find(seq, from = 0) {   // Python bytes.find
    const b = this.b, n = seq.length;
    outer: for (let i = from; i <= b.length - n; i++) { for (let k = 0; k < n; k++) if (b[i + k] !== seq[k]) continue outer; return i; }
    return -1;
  }
}
export const hex6 = v => v.toString(16).padStart(6, '0');
