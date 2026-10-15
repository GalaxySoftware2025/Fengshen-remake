// The game's music and sound effects ripped to VGM logs (a port of tools/rom/sound.py):
//   research/sound/XX.vgm (songs), 8XXX.vgm (effects), data/audio.js   each one's length and loop (seconds)
// The driver (68000, 0x1E41D4 plays the id in ff3d00; 0x1E4100 is its per-frame tick, from vblank): the 68000 is the
// sequencer (in state 3, ff3d04, it polls the YM2612's Timer B flag once a frame and steps the five FM channels and the
// DAC channel when it has overflowed, counting ticks in ff3d0e); the Z80 only plays drum and voice samples (the 68000
// writes a sample number to Z80 RAM 0x22 and 'S' to 0x20; the Z80 streams it from ROM through its bank window to the
// DAC, YM reg 0x2A). Both CPUs run in lockstep, a frame at a time (the 68000's frame, then a frame of Z80 cycles in
// slices), the YM's two timers emulated, every YM / PSG write logged at its time.
import { MD } from './md.js';
import { Z80 } from './vendor/z80/index.js';

const FM = 7670453, PSG = 3579545, FPS = PSG / (262 * 228), ZCYC = 262 * 228, RATE = 44100;
const INIT = 0x1e4218, PLAY = 0x1e41d4, WORK = 0x3d04, WORK_N = 0x251, TICKS = 0x3d0e;
export const SONGS = Array.from({ length: 0x18 }, (_, i) => i);

// the writes, packed (millions in a song: arrays of arrays would not fit several workers' memory): time in frames, and
// kind << 16 | register << 8 | value (kind 0/1 = YM port, 2 = PSG)
class WriteLog {
  constructor() { this.t = new Float64Array(1 << 16); this.v = new Int32Array(1 << 16); this.length = 0; }
  push(t, k, a, d) {
    if (this.length === this.t.length) { const t2 = new Float64Array(this.t.length * 2), v2 = new Int32Array(this.t.length * 2); t2.set(this.t); v2.set(this.v); this.t = t2; this.v = v2; }
    this.t[this.length] = t; this.v[this.length++] = k << 16 | a << 8 | d;
  }
  clear() { this.length = 0; }
}
export class Rig {
  constructor(rom, snap) {
    const m = this.m = new MD(rom).restore(snap);
    this.rom = rom; this.log = new WriteLog();
    this.ym = { addr: [0, 0], regs: [new Array(256).fill(0), new Array(256).fill(0)], tA: 0, tB: 0, flags: 0, last: 0 };
    this.zt = this.zk = 0;
    // Z80 memory: its 8 KB of RAM is what the 68000 sees at 0xA00000
    const zm = this.zmem = new Uint8Array(0x10000); zm.set(m.z80); m.z80 = zm.subarray(0, 0x2000);
    // a stale stack byte the vblank sound tick reads (it runs on the main program's stack): 1 as a played game leaves
    // it (the Python rig's snapshot); 0 there, as after a cold boot, sends songs past their loop (found by delta debugging)
    m.ram[0xefbb] = 1;
    // a stale stack byte the vblank sound tick reads (it runs on the main program's stack): 1 as a played game leaves
    // it (the Python rig's snapshot); 0 there, as after a cold boot, sends songs past their loop (found by delta debugging)
    m.ram[0xefbb] = 1;
    m.ym = { read: () => this.ymStatus(m.frame), write: (off, size, v) => this.ymWrite(m.frame, off, v) };
    m.psg = v => this.log.push(m.frame, 2, 0, v & 0xff);
    this.bank = 0; this.bankBits = 0; this.bankN = 0; this.latch = 0;
    // The Python rig's Z80 (the z80 package's Z80Machine) counts ticks as each machine cycle ends and calls a memory
    // handler before that access's ticks; it stops a run after the instruction in which its tick limit runs out, and
    // also every 100000 ticks (its 'frame'), dropping the rest of that slice. The core here counts an access's ticks
    // first, so the clock is watched as it moves: the limit, the 100000-tick frame and the count before the last access.
    const self = this; let ticks = 0;
    this.tts = 0; this.prevTts = 0; this.frameTick = 0; this.stop = false;
    this.hal = {
      get tStateCount() { return ticks; },
      set tStateCount(v) {
        const t = v - ticks; ticks = v; self.prevTts = self.tts;
        if (self.tts) { if (self.tts > t) self.tts -= t; else { self.tts = 0; self.stop = true; } }
        self.frameTick += t; if (self.frameTick >= 100000) { self.frameTick %= 100000; self.stop = true; }
      },
      readMemory(a) { return self.zRead(a); }, writeMemory(a, v) { self.zWrite(a, v); },
      contendMemory() {}, readPort() { return 0xff; }, writePort() {}, contendPort() {},
    };
    this.z = new Z80(this.hal); this.z.regs.pc = 0;
  }
  // ---- the YM2612: its timers (all the driver reads back) and the log
  ymTick(t) {
    const y = this.ym, dt = (t - y.last) / FPS, r = y.regs[0], ctl = r[0x27]; y.last = t;
    if (ctl & 1) { const pa = 144 * (1024 - (r[0x24] << 2 | (r[0x25] & 3))) / FM; y.tA += dt; if (y.tA >= pa) { y.tA %= pa; y.flags |= ctl & 4 ? 1 : 0; } }
    if (ctl & 2) { const pb = 144 * 16 * (256 - r[0x26]) / FM; y.tB += dt; if (y.tB >= pb) { y.tB %= pb; y.flags |= ctl & 8 ? 2 : 0; } }
  }
  ymStatus(t) { this.ymTick(t); return this.ym.flags; }
  ymWrite(t, off, val) {
    val &= 0xff; const port = off >> 1 & 1, y = this.ym;
    if (!(off & 1)) { y.addr[port] = val; return; }
    const a = y.addr[port];
    if (port === 0 && a === 0x27) { this.ymTick(t); if (val & 0x10) y.flags &= ~1; if (val & 0x20) y.flags &= ~2; }
    if (port === 0 && a >= 0x24 && a <= 0x27) { y.regs[0][a] = val; return; }   // timers: not sound
    y.regs[port][a] = val; this.log.push(t, port, a, val);
  }
  // ---- the Z80's view: the YM at 0x4000, the bank register at 0x6000, the PSG at 0x7F11, the bank window at 0x8000.
  // The cartridge has a protection port at 0x400004 / 0x400006: a byte written to +4 reads back at +6 (the Z80's
  // start-up reads its bank register's address, a bank offset and its mixer's opcode through it; without it every
  // sample streams from open bus)
  zRead(a) {
    if (a >= 0x4000 && a < 0x6000) return this.ymStatus(this.ztime(0));
    if (a >= 0x6000 && a < 0x8000) return 0xff;
    if (a >= 0x8004 && a < 0x8008) {
      if (this.bank === 0x80) return a & 2 ? this.latch : 0xff;
      const o = (this.bank << 15) + a - 0x8000; return o < this.rom.length ? this.rom[o] : 0xff;
    }
    return this.zmem[a];
  }
  zWrite(a, v) {
    const t = this.ztime(2);
    if (a >= 0x4000 && a < 0x6000) this.ymWrite(t, a & 3, v);
    else if (a >= 0x6000 && a < 0x6100) {   // the bank register: 9 writes of bit 0, low bit first
      this.bankBits |= (v & 1) << this.bankN; this.bankN++;
      if (this.bankN === 9) {
        this.bank = this.bankBits; this.bankBits = this.bankN = 0;
        const base = this.bank << 15; this.zmem.fill(0xff, 0x8000); if (base < this.rom.length) this.zmem.set(this.rom.subarray(base, Math.min(base + 0x8000, this.rom.length)), 0x8000);
      }
    } else if (a >= 0x8004 && a < 0x8008) { if (this.bank === 0x80 && !(a & 2)) this.latch = v; }
    else if (a === 0x7f11) this.log.push(t, 2, 0, v);
    else if (a >= 0x6100 && a < 0x8000) { /* watched, not memory */ }
    else this.zmem[a] = v;
  }
  // now, in frames; at an access the Python core has counted 'into' of its 3 ticks (a write lands after 2)
  ztime(into = 0) { return this.m.frame + (this.zt + this.zk - (this.zk ? Math.max(0, this.prevTts - into) : 0)) / ZCYC; }
  frame() {
    this.m.stepFrame();
    for (let n = 0; n < ZCYC;) {   // a frame of Z80 time, in slices so its writes carry their time
      const k = Math.min(4096, ZCYC - n); this.zt = n; this.zk = k; this.tts = this.prevTts = k; this.stop = false;
      do this.z.step(); while (!this.stop);
      n += k;
    }
    this.zt = this.zk = 0;
  }
  call(addr) {
    const c = this.m.cpu, r = c.r.slice(), sr = c.sr, pc = c.pc;
    this.m.call(addr);
    for (let i = 0; i < 16; i++) c.r[i] = r[i]; c.sr = sr; c.pc = pc;
  }
  request(sid) { this.m.ram[0x3d00] = sid >> 8; this.m.ram[0x3d01] = sid & 0xff; this.call(PLAY); }
}

// one id -> { log (a WriteLog, times from t0), t0, frames (length), loop (start frame or null) }. Per sequencer tick the six channels' sequence pointers
// (the first long of each 0x60-byte channel at ff3d14): a song has ended when none moves for stillSec (cut releaseSec
// after the last move); else its loop is the shortest period from which the pointer sequence repeats to the end
export function record(rom, snap, sid, { maxSec = 400, minLoopSec = 3, stillSec = 2.5, releaseSec = 1.5 } = {}) {
  const r = new Rig(rom, snap); r.call(INIT); r.frame();
  const t0 = r.m.frame; r.log.clear(); r.log.push(t0, 0, 0x2b, 0x80); r.request(sid);   // the DAC on (set once at boot)
  const music = sid < 0x8000, ticks = [], frames = [], rel = () => ({ t: r.log.t, v: r.log.v, length: r.log.length, t0 });
  let lastTk = null, moved = t0;
  const ram = r.m.ram, L = o => (ram[o] << 24 | ram[o + 1] << 16 | ram[o + 2] << 8 | ram[o + 3]) >>> 0;
  while (r.m.frame - t0 < maxSec * FPS) {
    r.frame(); const f = r.m.frame;
    if (music) {
      const tk = ram[TICKS] << 8 | ram[TICKS + 1];
      if (tk !== lastTk) {
        lastTk = tk; const P = Array.from({ length: 6 }, (_, c) => L(0x3d14 + 0x60 * c));
        if (ticks.length && P.some((v, i) => v !== ticks[ticks.length - 1][i])) moved = f;
        ticks.push(P); frames.push(f);
      }
      if (f - moved > stillSec * FPS || (ram[WORK] !== 3 && f - t0 > 30)) return { log: rel(), frames: Math.min(f, moved + releaseSec * FPS) - t0, loop: null };
    } else if (f - t0 > 10 && (r.log.length === 0 || r.log.t[r.log.length - 1] < f - 30)) break;   // an effect: done once silent for half a second
  }
  const log = rel();
  if (globalThis.__soundDebug) globalThis.__soundDebug({ ticks, frames, t0 });
  if (!music) return { log, frames: r.m.frame - t0, loop: null };
  const N = ticks.length, same = (i, j, c) => c === undefined ? ticks[i].every((v, q) => v === ticks[j][q]) : ticks[i][c] === ticks[j][c];
  // the run, counted from the end, over which index i equals i + L
  const runOf = (Lp, c) => { let run = 0; for (let i = N - Lp - 1; i >= 0 && same(i, i + Lp, c); i--) run++; return run; };
  let best = null;
  for (let Lp = 1; Lp < Math.floor(N / 2); Lp++) {
    if (frames[Math.min(N - 1, Lp)] - frames[0] < minLoopSec * FPS) continue;
    const run = runOf(Lp);
    if (run >= Math.max(Lp, 64)) { best = [N - Lp - run, Lp]; break; }   // seen repeating for at least one whole period
  }
  if (!best) {   // a channel loops out of step for good: loop on the period most of the five FM voices share
    const per = [];
    for (let c = 0; c < 5; c++) for (let Lp = 1; Lp < Math.floor(N / 2); Lp++) {
      if (frames[Math.min(N - 1, Lp)] - frames[0] < minLoopSec * FPS) continue;
      const run = runOf(Lp, c); if (run >= Lp) { per.push([Lp, N - Lp - run]); break; }
    }
    if (!per.length) return { log, frames: r.m.frame - t0, loop: null };
    const Ls = per.map(p => p[0]), count = v => Ls.filter(x => x === v).length;
    let Lp = null; for (const v of [...new Set(Ls)].sort((a, b) => a - b)) if (Lp === null || count(v) > count(Lp)) Lp = v;   // (Python's max over a set of ints: a tie goes to the smallest)
    best = [Math.max(...per.filter(p => p[0] === Lp).map(p => p[1])), Lp];
  }
  const [s0, Lp] = best;
  return { log, frames: frames[s0 + Lp] - t0, loop: frames[s0] - t0 };
}

const roundHalfEven = x => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
// Python's round(x, n)
export function pyRound(x, n) {
  const p = 10 ** n, s = x * p, f = Math.floor(s);
  if (s - f === 0.5 && (f + 0.5) / p === x) return (f % 2 === 0 ? f : f + 1) / p;
  return Number(x.toFixed(n));
}
// VGM 1.50: YM2612 + SN76489 at the Mega Drive's clocks, 44.1 kHz waits
export function vgm(log, frames, loopF) {
  const smp = t => roundHalfEven(t / FPS * RATE), n = log.length, at = new Int32Array(n);
  for (let i = 0; i < n; i++) at[i] = smp(log.t[i] - log.t0);
  let m = 0; for (let i = 0; i < n; i++) if (log.t[i] - log.t0 <= frames) m++;
  const order = new Uint32Array(m); m = 0; for (let i = 0; i < n; i++) if (log.t[i] - log.t0 <= frames) order[m++] = i;
  order.sort((p, q) => at[p] - at[q] || p - q);
  let body = new Uint8Array(1 << 16), len = 0, cur = 0, loopOff = null;
  const put = (...b) => { if (len + b.length > body.length) { const nb = new Uint8Array(body.length * 2); nb.set(body); body = nb; } for (const x of b) body[len++] = x; };
  const wait = k => { while (k > 0) { const w = Math.min(k, 65535); put(0x61, w & 255, w >> 8); k -= w; } };
  const total = smp(frames), lp = loopF !== null ? smp(loopF) : null;
  const step = s => { if (lp !== null && loopOff === null && s >= lp) { wait(lp - cur); cur = lp; loopOff = len; } if (s > cur) { wait(s - cur); cur = s; } };
  for (const i of order) {
    step(at[i]);
    const v = log.v[i], k = v >> 16, a = (v >> 8) & 255, d = v & 255;
    if (k < 2) put(0x52 + k, a, d); else put(0x50, d);
  }
  step(total);
  put(0x66); body = body.subarray(0, len);
  const out = new Uint8Array(0x40 + body.length), dv = new DataView(out.buffer);
  out.set([0x56, 0x67, 0x6d, 0x20]);
  const u32 = [0x40 + body.length - 4, 0x150, PSG, 0, 0, total, loopOff !== null ? 0x40 + loopOff - 0x1c : 0, lp !== null ? total - lp : 0, 60];
  u32.forEach((v, i) => dv.setUint32(4 + 4 * i, v, true));
  dv.setUint16(0x28, 0x0009, true); dv.setUint8(0x2a, 16); dv.setUint32(0x2c, FM, true); dv.setUint32(0x30, 0, true); dv.setUint32(0x34, 0x40 - 0x34, true);
  out.set(body, 0x40);
  return out;
}
export function rip(rom, snap, sid) {
  const { log, frames, loop } = record(rom, snap, sid);
  return { vgm: vgm(log, frames, loop), sec: pyRound(frames / FPS, 3), loop: loop !== null ? pyRound(loop / FPS, 3) : null, writes: log.length };
}

// every song and effect the Python rip had: songs 00-19, effects 8001-80B0 (8096 and 8097 left out, as it left them)
export const IDS = [...Array.from({ length: 0x1a }, (_, i) => i), ...Array.from({ length: 0xb0 }, (_, i) => 0x8001 + i).filter(i => i !== 0x8096 && i !== 0x8097)];
export const nameOf = id => id < 0x8000 ? id.toString(16).padStart(2, '0') : id.toString(16);
async function gzip(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
//   assets/audio/XX.vgz   each log gzipped (src/audio.js plays it through src/synth when there is no XX.ogg)
//   data/audio.js         window.AUDIO = { XX: [length, loop start or null] } (seconds)
export async function run(rom, snap, files, log = () => {}) {
  const table = {};
  for (const id of IDS) {
    const r = rip(rom, snap, id), k = nameOf(id);
    files['assets/audio/' + k + '.vgz'] = await gzip(r.vgm); table[k] = [r.sec, r.loop];
    log('sound ' + k);
  }
  const sorted = Object.fromEntries(Object.keys(table).sort().map(k => [k, table[k]]));
  files['data/audio.js'] = '// every song and effect of the original, its length and loop start (seconds): generated by the extractor from the player\'s ROM.\nwindow.AUDIO = ' + JSON.stringify(sorted) + ';\nwindow.AUDIO_LOGS = true;   // (the sounds are logs to synthesize: src/audio.js)\n';
  return table;
}
