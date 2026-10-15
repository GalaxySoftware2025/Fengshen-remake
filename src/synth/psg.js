// The SN76489 PSG as the Mega Drive's VDP has it: three square-wave tones and a noise channel (a 16-bit shift register,
// white noise tapped at bits 0 and 3), 2 dB volume steps. Clocked at the PSG clock / 16; one tick() is one such cycle.
const VOLUME = Array.from({ length: 16 }, (_, i) => i === 15 ? 0 : Math.pow(10, -2 * i / 20));

export class PSG {
  constructor() { this.reset(); }
  reset() {
    this.period = [0, 0, 0, 0]; this.vol = [15, 15, 15, 15]; this.count = [0, 0, 0, 0]; this.out = [1, 1, 1, 1];
    this.latch = 0; this.lfsr = 0x8000;
    this.noise = 7;   // white noise at tone 2's rate: the game's boot writes E7 (the logs start after it; effect 0x8079 relies on it)
  }
  write(v) {
    v &= 0xff;
    if (v & 0x80) {
      this.latch = (v >> 4) & 7; const ch = this.latch >> 1;
      if (this.latch & 1) this.vol[ch] = v & 15;
      else if (ch < 3) this.period[ch] = (this.period[ch] & 0x3f0) | (v & 15);
      else { this.noise = v & 7; this.lfsr = 0x8000; }
    } else {
      const ch = this.latch >> 1;
      if (this.latch & 1) this.vol[ch] = v & 15;
      else if (ch < 3) this.period[ch] = (this.period[ch] & 15) | ((v & 0x3f) << 4);
      else { this.noise = v & 7; this.lfsr = 0x8000; }
    }
  }
  noisePeriod() { const r = this.noise & 3; return r === 3 ? this.period[2] : 0x10 << r; }
  // one cycle (clock / 16): the channels' levels summed, 0 .. 4
  tick() {
    let sum = 0;
    for (let ch = 0; ch < 3; ch++) {
      const p = this.period[ch];
      if (p <= 1) { this.out[ch] = 1; }   // a period of 0 or 1 holds the output high
      else if (--this.count[ch] <= 0) { this.count[ch] = p; this.out[ch] ^= 1; }
      sum += this.out[ch] ? VOLUME[this.vol[ch]] : -VOLUME[this.vol[ch]];
    }
    if (--this.count[3] <= 0) {
      this.count[3] = this.noisePeriod() || 1; this.out[3] ^= 1;
      if (this.out[3]) {   // the register shifts on each rising edge
        const fb = this.noise & 4 ? ((this.lfsr ^ (this.lfsr >> 3)) & 1) : (this.lfsr & 1);
        this.lfsr = (this.lfsr >> 1) | (fb << 15);
      }
    }
    const nv = this.noise & 4 ? VOLUME[this.vol[3]] / 2 : VOLUME[this.vol[3]];   // white noise at half its level, as the reference core (Maxim's SN76489) plays it
    sum += this.lfsr & 1 ? nv : -nv;
    return sum;
  }
}
