// The YM2612 (OPN2), the Mega Drive's FM chip: a JavaScript port of the ym2612 path of ymfm by Aaron Giles
// (github.com/aaronsgiles/ymfm, BSD-3-Clause; the notice is in src/synth/LICENSE.ymfm). Six 4-operator channels and
// the DAC on channel 6, SSG-EG, the LFO, channel 3's special mode; no timers (nothing here plays by them).
// One generate() is one sample at clock / 144 (53267 Hz on the Mega Drive), [left, right] about +-32768.

const bitfield = (v, start, len = 1) => (v >>> start) & ((1 << len) - 1);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

const SIN = new Uint16Array([
  0x859, 0x6c3, 0x607, 0x58b, 0x52e, 0x4e4, 0x4a6, 0x471, 0x443, 0x41a, 0x3f5, 0x3d3, 0x3b5, 0x398, 0x37e, 0x365,
  0x34e, 0x339, 0x324, 0x311, 0x2ff, 0x2ed, 0x2dc, 0x2cd, 0x2bd, 0x2af, 0x2a0, 0x293, 0x286, 0x279, 0x26d, 0x261,
  0x256, 0x24b, 0x240, 0x236, 0x22c, 0x222, 0x218, 0x20f, 0x206, 0x1fd, 0x1f5, 0x1ec, 0x1e4, 0x1dc, 0x1d4, 0x1cd,
  0x1c5, 0x1be, 0x1b7, 0x1b0, 0x1a9, 0x1a2, 0x19b, 0x195, 0x18f, 0x188, 0x182, 0x17c, 0x177, 0x171, 0x16b, 0x166,
  0x160, 0x15b, 0x155, 0x150, 0x14b, 0x146, 0x141, 0x13c, 0x137, 0x133, 0x12e, 0x129, 0x125, 0x121, 0x11c, 0x118,
  0x114, 0x10f, 0x10b, 0x107, 0x103, 0x0ff, 0x0fb, 0x0f8, 0x0f4, 0x0f0, 0x0ec, 0x0e9, 0x0e5, 0x0e2, 0x0de, 0x0db,
  0x0d7, 0x0d4, 0x0d1, 0x0cd, 0x0ca, 0x0c7, 0x0c4, 0x0c1, 0x0be, 0x0bb, 0x0b8, 0x0b5, 0x0b2, 0x0af, 0x0ac, 0x0a9,
  0x0a7, 0x0a4, 0x0a1, 0x09f, 0x09c, 0x099, 0x097, 0x094, 0x092, 0x08f, 0x08d, 0x08a, 0x088, 0x086, 0x083, 0x081,
  0x07f, 0x07d, 0x07a, 0x078, 0x076, 0x074, 0x072, 0x070, 0x06e, 0x06c, 0x06a, 0x068, 0x066, 0x064, 0x062, 0x060,
  0x05e, 0x05c, 0x05b, 0x059, 0x057, 0x055, 0x053, 0x052, 0x050, 0x04e, 0x04d, 0x04b, 0x04a, 0x048, 0x046, 0x045,
  0x043, 0x042, 0x040, 0x03f, 0x03e, 0x03c, 0x03b, 0x039, 0x038, 0x037, 0x035, 0x034, 0x033, 0x031, 0x030, 0x02f,
  0x02e, 0x02d, 0x02b, 0x02a, 0x029, 0x028, 0x027, 0x026, 0x025, 0x024, 0x023, 0x022, 0x021, 0x020, 0x01f, 0x01e,
  0x01d, 0x01c, 0x01b, 0x01a, 0x019, 0x018, 0x017, 0x017, 0x016, 0x015, 0x014, 0x014, 0x013, 0x012, 0x011, 0x011,
  0x010, 0x00f, 0x00f, 0x00e, 0x00d, 0x00d, 0x00c, 0x00c, 0x00b, 0x00a, 0x00a, 0x009, 0x009, 0x008, 0x008, 0x007,
  0x007, 0x007, 0x006, 0x006, 0x005, 0x005, 0x005, 0x004, 0x004, 0x004, 0x003, 0x003, 0x003, 0x002, 0x002, 0x002,
  0x002, 0x001, 0x001, 0x001, 0x001, 0x001, 0x001, 0x001, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000]);
const POW = new Uint16Array([
  0x3fa, 0x3f5, 0x3ef, 0x3ea, 0x3e4, 0x3df, 0x3da, 0x3d4, 0x3cf, 0x3c9, 0x3c4, 0x3bf, 0x3b9, 0x3b4, 0x3ae, 0x3a9,
  0x3a4, 0x39f, 0x399, 0x394, 0x38f, 0x38a, 0x384, 0x37f, 0x37a, 0x375, 0x370, 0x36a, 0x365, 0x360, 0x35b, 0x356,
  0x351, 0x34c, 0x347, 0x342, 0x33d, 0x338, 0x333, 0x32e, 0x329, 0x324, 0x31f, 0x31a, 0x315, 0x310, 0x30b, 0x306,
  0x302, 0x2fd, 0x2f8, 0x2f3, 0x2ee, 0x2e9, 0x2e5, 0x2e0, 0x2db, 0x2d6, 0x2d2, 0x2cd, 0x2c8, 0x2c4, 0x2bf, 0x2ba,
  0x2b5, 0x2b1, 0x2ac, 0x2a8, 0x2a3, 0x29e, 0x29a, 0x295, 0x291, 0x28c, 0x288, 0x283, 0x27f, 0x27a, 0x276, 0x271,
  0x26d, 0x268, 0x264, 0x25f, 0x25b, 0x257, 0x252, 0x24e, 0x249, 0x245, 0x241, 0x23c, 0x238, 0x234, 0x230, 0x22b,
  0x227, 0x223, 0x21e, 0x21a, 0x216, 0x212, 0x20e, 0x209, 0x205, 0x201, 0x1fd, 0x1f9, 0x1f5, 0x1f0, 0x1ec, 0x1e8,
  0x1e4, 0x1e0, 0x1dc, 0x1d8, 0x1d4, 0x1d0, 0x1cc, 0x1c8, 0x1c4, 0x1c0, 0x1bc, 0x1b8, 0x1b4, 0x1b0, 0x1ac, 0x1a8,
  0x1a4, 0x1a0, 0x19c, 0x199, 0x195, 0x191, 0x18d, 0x189, 0x185, 0x181, 0x17e, 0x17a, 0x176, 0x172, 0x16f, 0x16b,
  0x167, 0x163, 0x160, 0x15c, 0x158, 0x154, 0x151, 0x14d, 0x149, 0x146, 0x142, 0x13e, 0x13b, 0x137, 0x134, 0x130,
  0x12c, 0x129, 0x125, 0x122, 0x11e, 0x11b, 0x117, 0x114, 0x110, 0x10c, 0x109, 0x106, 0x102, 0x0ff, 0x0fb, 0x0f8,
  0x0f4, 0x0f1, 0x0ed, 0x0ea, 0x0e7, 0x0e3, 0x0e0, 0x0dc, 0x0d9, 0x0d6, 0x0d2, 0x0cf, 0x0cc, 0x0c8, 0x0c5, 0x0c2,
  0x0be, 0x0bb, 0x0b8, 0x0b5, 0x0b1, 0x0ae, 0x0ab, 0x0a8, 0x0a4, 0x0a1, 0x09e, 0x09b, 0x098, 0x094, 0x091, 0x08e,
  0x08b, 0x088, 0x085, 0x082, 0x07e, 0x07b, 0x078, 0x075, 0x072, 0x06f, 0x06c, 0x069, 0x066, 0x063, 0x060, 0x05d,
  0x05a, 0x057, 0x054, 0x051, 0x04e, 0x04b, 0x048, 0x045, 0x042, 0x03f, 0x03c, 0x039, 0x036, 0x033, 0x030, 0x02d,
  0x02a, 0x028, 0x025, 0x022, 0x01f, 0x01c, 0x019, 0x016, 0x014, 0x011, 0x00e, 0x00b, 0x008, 0x006, 0x003, 0x000].map(a => (a | 0x400) << 2));
const INCREMENT = [
  0x00000000, 0x00000000, 0x10101010, 0x10101010, 0x10101010, 0x10101010, 0x11101110, 0x11101110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x11111111, 0x21112111, 0x21212121, 0x22212221, 0x22222222, 0x42224222, 0x42424242, 0x44424442,
  0x44444444, 0x84448444, 0x84848484, 0x88848884, 0x88888888, 0x88888888, 0x88888888, 0x88888888];
const DETUNE = [
  [0, 0, 1, 2], [0, 0, 1, 2], [0, 0, 1, 2], [0, 0, 1, 2], [0, 1, 2, 2], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3],
  [0, 1, 2, 4], [0, 1, 3, 4], [0, 1, 3, 4], [0, 1, 3, 5], [0, 2, 4, 5], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 5, 7],
  [0, 2, 5, 8], [0, 3, 6, 8], [0, 3, 6, 9], [0, 3, 7, 10], [0, 4, 8, 11], [0, 4, 8, 12], [0, 4, 9, 13], [0, 5, 10, 14],
  [0, 5, 11, 16], [0, 6, 12, 17], [0, 6, 13, 19], [0, 7, 14, 20], [0, 8, 16, 22], [0, 8, 16, 22], [0, 8, 16, 22], [0, 8, 16, 22]];
const PM_SHIFTS = [
  [0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77], [0x77, 0x77, 0x77, 0x77, 0x72, 0x72, 0x72, 0x72],
  [0x77, 0x77, 0x77, 0x72, 0x72, 0x72, 0x17, 0x17], [0x77, 0x77, 0x72, 0x72, 0x17, 0x17, 0x12, 0x12],
  [0x77, 0x77, 0x72, 0x17, 0x17, 0x17, 0x12, 0x07], [0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01],
  [0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01], [0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01]];
const LFO_MAX = [109, 78, 72, 68, 63, 45, 9, 6];
const ALG = (o2, o3, o4, a, b, c) => o2 | (o3 << 1) | (o4 << 4) | (a << 7) | (b << 8) | (c << 9);
const ALGORITHMS = [ALG(1, 2, 3, 0, 0, 0), ALG(0, 5, 3, 0, 0, 0), ALG(0, 2, 6, 0, 0, 0), ALG(1, 0, 7, 0, 0, 0),
  ALG(1, 0, 3, 0, 1, 0), ALG(1, 1, 1, 0, 1, 1), ALG(1, 0, 0, 0, 1, 1), ALG(0, 0, 0, 1, 1, 1)];
const WAVE = new Uint16Array(0x400);
for (let i = 0; i < 0x400; i++) WAVE[i] = SIN[(bitfield(i, 8) ? ~i : i) & 0xff] | (bitfield(i, 9) << 15);

const attenuationToVolume = input => POW[input & 0xff] >>> (input >>> 8);
const EG_ATTACK = 1, EG_DECAY = 2, EG_SUSTAIN = 3, EG_RELEASE = 4, EG_QUIET = 0x380;
const effectiveRate = (raw, ksr) => raw === 0 ? 0 : Math.min(raw + ksr, 63);
const opOffset = n => (n % 12) + Math.floor((n % 12) / 3) + 0x100 * Math.floor(n / 12);
const chOffset = n => (n % 3) + 0x100 * Math.floor(n / 3);
const OPMAP = [[0, 6, 3, 9], [1, 7, 4, 10], [2, 8, 5, 11], [12, 18, 15, 21], [13, 19, 16, 22], [14, 20, 17, 23]];

class Operator {
  constructor(chip, opoffs) {
    this.chip = chip; this.opoffs = opoffs; this.choffs = 0;
    this.phase = 0; this.att = 0x3ff; this.state = EG_RELEASE; this.inverted = 0; this.key = 0; this.live = 0;
    this.c = { phaseStep: 0, totalLevel: 0, blockFreq: 0, detune: 0, multiple: 0, sustain: 0, rate: [0, 0, 0, 0, 0, 0], dynamic: false };
  }
  prepare() {
    this.chip.cacheOperator(this.choffs, this.opoffs, this.c);
    this.clockKeystate(this.live !== 0 ? 1 : 0);
    return this.state !== EG_RELEASE || this.att < EG_QUIET;
  }
  clock(envCounter, lfoPm) {
    if (this.chip.ssgEnable(this.opoffs)) this.clockSsg(); else this.inverted = 0;
    if ((envCounter & 3) === 0) this.clockEnvelope(envCounter >>> 2);
    const step = this.c.dynamic ? this.chip.phaseStep(this.choffs, this.c, lfoPm) : this.c.phaseStep;
    this.phase = (this.phase + step) >>> 0;
  }
  ph() { return this.phase >>> 10; }
  volume(phase, am) {
    if (this.att > EG_QUIET) return 0;
    const s = WAVE[phase & 0x3ff], env = this.envAtt(am) << 2;
    const r = attenuationToVolume((s & 0x7fff) + env);
    return s & 0x8000 ? -r : r;
  }
  startAttack(restart = false) {
    if (this.state === EG_ATTACK) return;
    this.state = EG_ATTACK;
    if (!restart) this.inverted = this.chip.ssgEnable(this.opoffs) & bitfield(this.chip.ssgMode(this.opoffs), 2);
    if (!restart) this.phase = 0;
    if (this.c.rate[EG_ATTACK] >= 62) this.att = 0;
  }
  startRelease() {
    if (this.state >= EG_RELEASE) return;
    this.state = EG_RELEASE;
    if (this.inverted) { this.att = (0x200 - this.att) & 0x3ff; this.inverted = 0; }
  }
  clockKeystate(k) {
    if ((k ^ this.key) !== 0) { this.key = k; if (k) this.startAttack(); else this.startRelease(); }
  }
  clockSsg() {
    if (!bitfield(this.att, 9)) return;
    const mode = this.chip.ssgMode(this.opoffs);
    if (bitfield(mode, 0)) {
      this.inverted = bitfield(mode, 2) ^ bitfield(mode, 1);
      if (this.state !== EG_ATTACK) this.att = this.inverted ? 0x200 : 0x3ff;
    } else {
      this.inverted ^= bitfield(mode, 1);
      if (this.state === EG_DECAY || this.state === EG_SUSTAIN) this.startAttack(true);
      if (bitfield(mode, 1) === 0) this.phase = 0;
    }
    if (this.state === EG_RELEASE) this.att = 0x3ff;
  }
  clockEnvelope(counter) {
    if (this.state === EG_ATTACK && this.att === 0) this.state = EG_DECAY;
    if (this.state === EG_DECAY && this.att >= this.c.sustain) this.state = EG_SUSTAIN;
    const rate = this.c.rate[this.state], shift = rate >>> 2;
    counter = (counter << shift) >>> 0;
    if (bitfield(counter, 0, 11) !== 0) return;
    const bits = bitfield(counter, shift <= 11 ? 11 : shift, 3), inc = bitfield(INCREMENT[rate], 4 * bits, 4);
    if (this.state === EG_ATTACK) {
      if (rate < 62) this.att = (this.att + ((~this.att * inc) >> 4)) & 0xffff;
    } else {
      if (!this.chip.ssgEnable(this.opoffs)) this.att += inc;
      else if (this.att < 0x200) this.att += 4 * inc;
      if (this.att >= 0x400) this.att = 0x3ff;
    }
  }
  envAtt(am) {
    let r = this.att;
    if (this.inverted) r = (0x200 - r) & 0x3ff;
    if (this.chip.amEnable(this.opoffs)) r += am;
    r += this.c.totalLevel;
    return Math.min(r, 0x3ff);
  }
}

class Channel {
  constructor(chip, choffs, ops) { this.chip = chip; this.choffs = choffs; this.ops = ops; this.fb = [0, 0]; this.fbIn = 0; for (const o of ops) o.choffs = choffs; }
  keyonoff(states) { this.ops.forEach((o, i) => { o.live = (o.live & ~1) | bitfield(states, i); }); }
  prepare() { let a = false; for (const o of this.ops) if (o.prepare()) a = true; return a; }
  clock(env, pm) { this.fb[0] = this.fb[1]; this.fb[1] = this.fbIn; for (const o of this.ops) o.clock(env, pm); }
  output4(out, rshift, clipmax) {
    const R = this.chip, c = this.choffs, am = R.amOffset(c), feedback = R.byte(0xb0, 3, 3, c);
    let opmod = feedback ? (this.fb[0] + this.fb[1]) >> (10 - feedback) : 0;
    const [o1, o2, o3, o4] = this.ops;
    const op1 = this.fbIn = toInt16(o1.volume(o1.ph() + opmod, am));
    if (R.byte(0xb4, 6, 2, c) === 0) return;
    const alg = ALGORITHMS[R.byte(0xb0, 0, 3, c)], v = this.v || (this.v = new Int16Array(8));
    v[0] = 0; v[1] = op1;
    opmod = v[bitfield(alg, 0, 1)] >> 1;
    v[2] = o2.volume(o2.ph() + opmod, am); v[5] = v[1] + v[2];
    opmod = v[bitfield(alg, 1, 3)] >> 1;
    v[3] = o3.volume(o3.ph() + opmod, am); v[6] = v[1] + v[3]; v[7] = v[2] + v[3];
    opmod = v[bitfield(alg, 4, 3)] >> 1;
    let result = o4.volume(o4.ph() + opmod, am) >> rshift;
    const clipmin = -clipmax - 1;
    if (bitfield(alg, 7)) result = clamp(result + (v[1] >> rshift), clipmin, clipmax);
    if (bitfield(alg, 8)) result = clamp(result + (v[2] >> rshift), clipmin, clipmax);
    if (bitfield(alg, 9)) result = clamp(result + (v[3] >> rshift), clipmin, clipmax);
    if (R.byte(0xb4, 7, 1, c)) out[0] += result;
    if (R.byte(0xb4, 6, 1, c)) out[1] += result;
  }
}
const toInt16 = v => (v << 16) >> 16;

export class YM2612 {
  constructor() {
    this.regs = new Uint8Array(0x200);
    this.ops = Array.from({ length: 24 }, (_, n) => new Operator(this, opOffset(n)));
    this.chans = Array.from({ length: 6 }, (_, n) => new Channel(this, chOffset(n), OPMAP[n].map(k => this.ops[k])));
    this.reset();
  }
  reset() {
    this.regs.fill(0); this.regs[0xb4] = this.regs[0xb5] = this.regs[0xb6] = 0xc0; this.regs[0x1b4] = this.regs[0x1b5] = this.regs[0x1b6] = 0xc0;
    this.lfoCounter = 0; this.lfoAm = 0; this.envCounter = 0; this.active = 0x3f; this.modified = 0x3f; this.prepareCount = 0;
    this.address = 0; this.dac = 0; this.dacEnable = 0;
    for (const c of this.chans) { c.fb = [0, 0]; c.fbIn = 0; }
    for (const o of this.ops) { o.phase = 0; o.att = 0x3ff; o.state = EG_RELEASE; o.inverted = 0; o.key = 0; o.live = 0; }
  }
  byte(off, start, count, extra = 0) { return bitfield(this.regs[off + extra], start, count); }
  ssgEnable(op) { return this.byte(0x90, 3, 1, op); }
  ssgMode(op) { return this.byte(0x90, 0, 3, op); }
  amEnable(op) { return this.byte(0x60, 7, 1, op); }
  amOffset(ch) { return (this.lfoAm << 1) >>> ((1 << (this.byte(0xb4, 4, 2, ch) ^ 3)) - 1); }
  blockFreq(ch) { return (this.byte(0xa4, 0, 6, ch) << 8) | this.byte(0xa0, 0, 8, ch); }
  cacheOperator(ch, op, c) {
    let bf = this.blockFreq(ch);
    if (this.byte(0x27, 6, 2) !== 0 && ch === 2) {   // channel 3's special mode: a frequency per operator
      if (op === 2) bf = (this.byte(0xad, 0, 6) << 8) | this.byte(0xa9, 0, 8);
      else if (op === 10) bf = (this.byte(0xae, 0, 6) << 8) | this.byte(0xaa, 0, 8);
      else if (op === 6) bf = (this.byte(0xac, 0, 6) << 8) | this.byte(0xa8, 0, 8);
    }
    c.blockFreq = bf;
    const keycode = (bitfield(bf, 10, 4) << 1) | bitfield(0xfe80, bitfield(bf, 7, 4));
    const dt = this.byte(0x30, 4, 3, op), adj = DETUNE[keycode][dt & 3];
    c.detune = bitfield(dt, 2) ? -adj : adj;
    c.multiple = this.byte(0x30, 0, 4, op) * 2 || 1;
    c.dynamic = !(this.byte(0x22, 3, 1) === 0 || this.byte(0xb4, 0, 3, ch) === 0);
    c.phaseStep = c.dynamic ? 0 : this.phaseStep(ch, c, 0);
    c.totalLevel = this.byte(0x40, 0, 7, op) << 3;
    let sl = this.byte(0x80, 4, 4, op); sl |= (sl + 1) & 0x10; c.sustain = sl << 5;
    const ksr = keycode >>> (this.byte(0x50, 6, 2, op) ^ 3);
    c.rate[EG_ATTACK] = effectiveRate(this.byte(0x50, 0, 5, op) * 2, ksr);
    c.rate[EG_DECAY] = effectiveRate(this.byte(0x60, 0, 5, op) * 2, ksr);
    c.rate[EG_SUSTAIN] = effectiveRate(this.byte(0x70, 0, 5, op) * 2, ksr);
    c.rate[EG_RELEASE] = effectiveRate(this.byte(0x80, 0, 4, op) * 4 + 2, ksr);
  }
  phaseStep(ch, c, lfoPm) {
    let fnum = bitfield(c.blockFreq, 0, 11) << 1;
    const pms = this.byte(0xb4, 0, 3, ch);
    if (pms !== 0) {
      const absPm = lfoPm < 0 ? -lfoPm : lfoPm, shifts = PM_SHIFTS[pms][absPm & 7], bits = bitfield(c.blockFreq, 4, 7);
      let adjust = (bits >>> (shifts & 15)) + (bits >>> ((shifts >> 4) & 15));
      if (pms > 5) adjust <<= pms - 5;
      adjust >>= 2;
      fnum += lfoPm < 0 ? -adjust : adjust; fnum &= 0xfff;
    }
    const block = bitfield(c.blockFreq, 11, 3);
    let step = (fnum << block) >>> 2;
    step = (step + c.detune) & 0x1ffff;
    return (step * c.multiple) >>> 1;
  }
  clockLfo() {
    if (!this.byte(0x22, 3, 1)) { this.lfoCounter = 0; this.lfoAm = 0x3f; return 0; }
    const sub = this.lfoCounter & 0xff; this.lfoCounter++;
    if (sub >= LFO_MAX[this.byte(0x22, 0, 3)]) this.lfoCounter += 0x101 - sub;
    this.lfoAm = bitfield(this.lfoCounter, 8, 6);
    if (bitfield(this.lfoCounter, 14) === 0) this.lfoAm ^= 0x3f;
    let pm = bitfield(this.lfoCounter, 10, 3);
    if (bitfield(this.lfoCounter, 13)) pm ^= 7;
    return bitfield(this.lfoCounter, 14) ? -pm : pm;
  }
  // a register write to the FM engine (0x27, the mode, only kept: its timers do not sound)
  fmWrite(reg, data) {
    this.modified = 0x3f;
    if ((reg & 0xf0) === 0xa0) {
      if ((reg & 3) === 3) return;
      const latch = 0xb8 | bitfield(reg, 3);
      if (bitfield(reg, 2)) this.regs[latch] = data & 0x3f;
      else { this.regs[reg] = data; this.regs[reg | 4] = this.regs[latch]; }
      return;
    }
    if ((reg & 0xf8) === 0xb8) return;
    this.regs[reg] = data;
    if (reg === 0x28) {
      let ch = data & 3; if (ch === 3) return;
      ch += bitfield(data, 2) * 3;
      this.chans[ch].keyonoff(bitfield(data, 4, 4));
    }
  }
  // the four ports: 0 address, 1 data, 2 upper address, 3 upper data
  write(port, data) {
    data &= 0xff;
    if (port === 0) this.address = data;
    else if (port === 2) this.address = 0x100 | data;
    else if (port === 1) {
      if (this.address & 0x100) return;
      if (this.address === 0x2a) this.dac = (this.dac & ~0x1fe) | ((data ^ 0x80) << 1);
      else if (this.address === 0x2b) this.dacEnable = bitfield(data, 7);
      else if (this.address === 0x2c) this.dac = (this.dac & ~1) | bitfield(data, 3);
      else this.fmWrite(this.address, data);
    } else { if (!(this.address & 0x100)) return; this.fmWrite(this.address, data); }
  }
  clock() {
    if (this.modified !== 0 || this.prepareCount++ >= 4096) {
      this.active = 0;
      for (let n = 0; n < 6; n++) if (this.chans[n].prepare()) this.active |= 1 << n;
      this.modified = this.prepareCount = 0;
    }
    if (((++this.envCounter) & 3) === 3) this.envCounter += 1;   // the envelope clock: 3 of every 4 cycles
    const pm = this.clockLfo();
    for (const c of this.chans) c.clock(this.envCounter >>> 0, pm);
  }
  // one sample into out ([left, right])
  generate(out) {
    this.clock();
    const disc = v => v < 0 ? v - 3 : v + 4, t = this.t || (this.t = [0, 0]);
    let l = 0, r = 0;
    const last = this.dacEnable ? 5 : 6;
    for (let n = 0; n < last; n++) {
      t[0] = 0; t[1] = 0;
      if (this.active & (1 << n)) this.chans[n].output4(t, 5, 256);
      l += disc(t[0]); r += disc(t[1]);
    }
    if (this.dacEnable) {
      const d = disc(((this.dac << 7) << 16 >> 16) >> 7);
      l += this.byte(0xb4, 7, 1, 0x102) ? d : disc(0); r += this.byte(0xb4, 6, 1, 0x102) ? d : disc(0);
    }
    out[0] = Math.trunc(l * 128 * 64 / (6 * 65)); out[1] = Math.trunc(r * 128 * 64 / (6 * 65));
  }
}
