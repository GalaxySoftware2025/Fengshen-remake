// A minimal Mega Drive for the in-browser extractor: the 68000 (extract/m68k.js), the cartridge, work RAM, Z80 RAM, the
// pad, and a VDP good enough for what the game's own routines do while the extractor runs them. A port of the Python
// research harness (tools/rom/md.py), quirks included, so the two produce the same results:
//   - a frame is 22000 instructions with the vertical blank flag clear, then a level 6 interrupt (if enabled) and 6000
//     more; time is counted in instructions, not cycles
//   - RTE is performed by the harness, and the rest of that run's budget is halved (Unicorn could not run it)
//   - a DIVU / DIVS Dn by zero is stepped over (this game's vector 5 is a bare RTE)
//   - from power-on, the first run executes one instruction fewer (Unicorn counted that first instruction, a VDP write,
//     twice; a run from a loaded state did not)
// No ROM content is in this file: the cartridge is the player's own, passed in as bytes.
import { M68K, STOP } from './m68k.js';

export const BTN = { U: 0, D: 1, L: 2, R: 3, B: 4, C: 5, A: 6, S: 7 };

export class MD {
  constructor(rom) {
    this.romFile = rom;                                  // the cartridge as given (vectors are read from it)
    this.rom = new Uint8Array(0x400000); this.rom.set(rom.subarray(0, 0x400000));
    this.ram = new Uint8Array(0x10000); this.z80 = new Uint8Array(0x2000);
    this.vram = new Uint8Array(0x10000); this.cram = new Array(64).fill(0); this.vsram = new Array(40).fill(0);
    this.reg = new Array(24).fill(0);
    this.cpend = null; this.code = 0; this.addr = 0; this.fillpend = false; this.fillLen = 0;
    this.pad = 0; this.th = 0x40; this.frame = 0; this.vbl = false;
    this.extra = null;                                   // optional RAM past the cartridge (title.py maps 0x400000-0x7FFFFF)
    this.dmaLog = null;
    this.ioHooks = null;                                 // optional { read(off, size), write(off, size, v) } over the default IO
    this.ym = null;                                      // optional { read(off, size), write(off, size, v) }: the YM2612 at 0xA04000 (extract/sound.js)
    this.psg = null;                                     // optional fn(v): a byte written to the PSG (0xC00011)
    this.writeHook = null;                               // optional fn(addr, size, v) on every write (Unicorn UC_HOOK_MEM_WRITE)
    this.cpu = new M68K(this);
    this.fresh = true;                                   // Unicorn counts the first instruction of a new engine's first run twice: one less runs
    const r32 = a => (rom[a] << 24 | rom[a + 1] << 16 | rom[a + 2] << 8 | rom[a + 3]) >>> 0;
    this.cpu.sr = 0x2700; this.cpu.r[15] = r32(0); this.cpu.pc = r32(4);
  }

  // ---------------------------------------------------------------- bus (addresses are 24-bit here)
  read8(a) {
    if (a < 0x400000) return this.rom[a];
    if (a >= 0xFF0000) return this.ram[a & 0xFFFF];
    if (a < 0x800000) return this.extra ? this.extra[a - 0x400000] : 0;
    if (a >= 0xA00000 && a < 0xA02000) return this.z80[a & 0x1FFF];
    if (this.ym && a >= 0xA04000 && a < 0xA05000) return this.ym.read(a - 0xA04000, 1) & 0xFF;
    if (a >= 0xA10000 && a < 0xA12000) return this.ioR(a - 0xA10000, 1) & 0xFF;
    if (a >= 0xC00000 && a < 0xC01000) return this.vdpR(a - 0xC00000, 1) & 0xFF;
    return 0;
  }
  read16(a) {
    if (a < 0x3FFFFF) return this.rom[a] << 8 | this.rom[a + 1];
    if (a >= 0xFF0000) { const o = a & 0xFFFF; return this.ram[o] << 8 | this.ram[(o + 1) & 0xFFFF]; }
    if (a >= 0xA10000 && a < 0xA12000) return this.ioR(a - 0xA10000, 2) & 0xFFFF;
    if (a >= 0xC00000 && a < 0xC01000) return this.vdpR(a - 0xC00000, 2) & 0xFFFF;
    if (this.ym && a >= 0xA04000 && a < 0xA05000) return this.ym.read(a - 0xA04000, 2) & 0xFFFF;
    return this.read8(a) << 8 | this.read8(a + 1);
  }
  read32(a) {
    if (a >= 0xC00000 && a < 0xC01000) return (this.vdpR(a - 0xC00000, 4)) >>> 0;
    return ((this.read16(a) << 16) | this.read16((a + 2) & 0xFFFFFF)) >>> 0;
  }
  write8(a, v) {
    if (this.writeHook) this.writeHook(a, 1, v);
    if (a >= 0xFF0000) { this.ram[a & 0xFFFF] = v; return; }
    if (a < 0x400000) { this.rom[a] = v; return; }   // (Unicorn mapped the cartridge writable; the game does not write it)
    if (a < 0x800000) { if (this.extra) this.extra[a - 0x400000] = v; return; }
    if (a >= 0xA00000 && a < 0xA02000) { this.z80[a & 0x1FFF] = v; return; }
    if (this.ym && a >= 0xA04000 && a < 0xA05000) { this.ym.write(a - 0xA04000, 1, v); return; }
    if (a >= 0xA10000 && a < 0xA12000) { this.ioW(a - 0xA10000, 1, v); return; }
    if (a >= 0xC00000 && a < 0xC01000) { this.vdpW(a - 0xC00000, 1, v); return; }
  }
  write16(a, v) {
    if (this.writeHook) this.writeHook(a, 2, v);
    if (a >= 0xFF0000) { const o = a & 0xFFFF; this.ram[o] = v >> 8; this.ram[(o + 1) & 0xFFFF] = v & 0xFF; return; }
    if (a >= 0xA10000 && a < 0xA12000) { this.ioW(a - 0xA10000, 2, v); return; }
    if (a >= 0xC00000 && a < 0xC01000) { this.vdpW(a - 0xC00000, 2, v); return; }
    if (this.ym && a >= 0xA04000 && a < 0xA05000) { this.ym.write(a - 0xA04000, 2, v); return; }
    const h = this.writeHook; this.writeHook = null;
    this.write8(a, v >> 8); this.write8((a + 1) & 0xFFFFFF, v & 0xFF); this.writeHook = h;
  }
  write32(a, v) {
    if (this.writeHook) this.writeHook(a, 4, v);
    if (a >= 0xC00000 && a < 0xC01000) { this.vdpW(a - 0xC00000, 4, v); return; }
    if (this.ym && a >= 0xA04000 && a < 0xA05000) { this.ym.write(a - 0xA04000, 4, v); return; }
    const h = this.writeHook; this.writeHook = null;
    this.write16(a, v >>> 16); this.write16((a + 2) & 0xFFFFFF, v & 0xFFFF); this.writeHook = h;
  }

  // ---------------------------------------------------------------- IO
  ioR(off, size) {
    if (this.ioHooks && this.ioHooks.read) { const v = this.ioHooks.read(off, size); if (v != null) return v; }
    if (off === 2 || off === 3) {
      const p = ~this.pad & 0xFF, v = this.th ? 0x40 | (p & 0x3F) : (p & 3) | ((p >> 2) & 0x30);
      return size === 2 ? (v << 8 | v) : v;
    }
    if (off === 0x1100 || off === 0x1101) return 0;   // the Z80 bus granted
    if (off === 0 || off === 1) return 0xA0;
    return 0;
  }
  ioW(off, size, v) {
    if (this.ioHooks && this.ioHooks.write && this.ioHooks.write(off, size, v)) return;
    if (off === 2 || off === 3) this.th = v & 0x40;
  }

  // ---------------------------------------------------------------- VDP
  status() { return 0x3400 | (this.vbl ? 8 : 0) | (this.vbl ? 0x80 : 0); }
  vdpR(off, size) {
    if (off < 4) { this.cpend = null; return this.dataRead(); }
    if (off < 8) { this.cpend = null; const s = this.status(); return size === 2 || size === 4 ? s : (off % 2 === 0 ? s >> 8 : s & 0xFF); }
    if (off < 0x10) { const hv = (this.vbl ? 0xE0 : 0x40) << 8; return size === 2 ? hv : hv >> 8; }
    return 0;
  }
  vdpW(off, size, v) {
    if (off >= 0x10 && off < 0x18) { if (this.psg) this.psg(v & 0xFF); return; }
    if (off < 4) {
      if (size === 4) { this.dataWrite(v >>> 16); this.dataWrite(v & 0xFFFF); }
      else this.dataWrite(size === 2 ? v : v * 0x101);
    } else if (off < 8) {
      if (size === 4) { this.ctrl(v >>> 16); this.ctrl(v & 0xFFFF); } else this.ctrl(v);
    }
  }
  ctrl(w) {
    if (this.cpend === null) {
      if ((w & 0xC000) === 0x8000) { const r = (w >> 8) & 0x1F; if (r < 24) this.reg[r] = w & 0xFF; return; }
      this.cpend = w;
      this.code = (this.code & 0x3C) | (w >> 14);
      this.addr = (this.addr & 0xC000) | (w & 0x3FFF);
      return;
    }
    const first = this.cpend; this.cpend = null;
    this.code = ((first >> 14) & 3) | ((w >> 2) & 0x3C);
    this.addr = (first & 0x3FFF) | ((w & 3) << 14);
    if ((this.code & 0x20) && (this.reg[1] & 0x10)) this.dma();
  }
  inc() { this.addr = (this.addr + this.reg[15]) & 0xFFFF; }
  dataWrite(v) {
    this.cpend = null;
    const c = this.code & 0xF;
    if (this.fillpend) { this.fillpend = false; this.doFill(v); return; }
    if (c === 1) {
      const a = this.addr;
      if (a & 1) v = ((v & 0xFF) << 8) | (v >> 8);
      this.vram[a & 0xFFFE] = v >> 8; this.vram[(a & 0xFFFE) + 1] = v & 0xFF;
    } else if (c === 3) this.cram[(this.addr >> 1) & 63] = v;
    else if (c === 5) this.vsram[(this.addr >> 1) % 40] = v;
    this.inc();
  }
  dataRead() {
    const c = this.code & 0xF, a = this.addr; let v;
    if (c === 0) v = this.vram[a & 0xFFFE] << 8 | this.vram[(a & 0xFFFE) + 1];
    else if (c === 8) v = this.cram[(a >> 1) & 63];
    else if (c === 4) v = this.vsram[(a >> 1) % 40];
    else v = 0;
    this.inc(); return v;
  }
  dma() {
    const R = this.reg, ln = (R[19] | R[20] << 8) || 0x10000, mode = R[23] >> 6;
    if (mode === 0 || mode === 1) {
      const src = ((R[21] | R[22] << 8 | (R[23] & 0x7F) << 16) << 1);
      if (this.dmaLog) this.dmaLog.push([this.frame, this.code & 0xF, this.addr, src, ln]);
      for (let i = 0; i < ln; i++) {
        let hi, lo;
        if (src < 0x400000) { const a = src + 2 * i; hi = this.read8(a & 0xFFFFFF); lo = this.read8((a + 1) & 0xFFFFFF); }
        else { const o = (src + 2 * i) & 0xFFFF; hi = this.ram[o]; lo = this.ram[(o + 1) & 0xFFFF]; }   // md.py ram_read: wraps in RAM
        this.dataWrite(hi << 8 | lo);
      }
      const s = (R[21] | R[22] << 8) + ln; R[21] = s & 0xFF; R[22] = (s >> 8) & 0xFF; R[19] = R[20] = 0;
    } else if (mode === 2) { this.fillpend = true; this.fillLen = ln; }
    else { const src = R[21] | R[22] << 8; for (let i = 0; i < ln; i++) { this.vram[this.addr] = this.vram[(src + i) & 0xFFFF]; this.inc(); } }
  }
  doFill(v) {
    const ln = this.fillLen; this.vram[this.addr] = v & 0xFF;
    for (let i = 0; i < ln; i++) { this.vram[(this.addr ^ 1) & 0xFFFF] = v >> 8; this.inc(); }
    this.reg[19] = this.reg[20] = 0;
  }

  // ---------------------------------------------------------------- run
  romLong(a) { const r = this.romFile; return (r[a] << 24 | r[a + 1] << 16 | r[a + 2] << 8 | r[a + 3]) >>> 0; }
  irq(level, vec) {
    const c = this.cpu, sr = c.sr;
    if (((sr >> 8) & 7) >= level) return false;
    const sp = (c.r[15] - 6) >>> 0;
    c.wr16(sp, sr); c.wr32(sp + 2, c.pc);
    c.sr = (sr & 0x00FF) | 0x2000 | (level << 8); c.r[15] = sp; c.pc = this.romLong(vec * 4);
    return true;
  }
  stepFrame(nActive = 22000, nVbl = 6000) {
    this.vbl = false; this.runN(nActive);
    this.vbl = true; if (this.reg[1] & 0x20) this.irq(6, 30);
    this.runN(nVbl); this.frame++;
  }
  // md.py _run: up to 64 restarts; an RTE is done here and halves the budget; a DIV Dn by zero is stepped over
  runN(n) {
    const c = this.cpu;
    for (let k = 0; k < 64; k++) {
      const res = c.run(this.fresh ? n - 1 : n); this.fresh = false;
      if (res === STOP.count) return;
      if (res === STOP.rte) {
        const sp = c.r[15], sr = c.rd16(sp), pc = c.rd32(sp + 2);
        c.r[15] = (sp + 6) >>> 0; c.sr = sr; c.pc = pc; n = Math.max(n >> 1, 100); continue;
      }
      if (res === STOP.div0) {
        const op = c.rd16(c.pc);
        if ((op & 0xF1C0) === 0x80C0 || (op & 0xF1C0) === 0x81C0) { if ((op & 0x38) === 0) { c.pc = (c.pc + 2) >>> 0; continue; } }
      }
      if (res === STOP.hook) return;
      throw new Error('CPU stop ' + res + ' at ' + c.pc.toString(16) + ' op ' + c.rd16(c.pc).toString(16) + ' (frame ' + this.frame + ')');
    }
  }
  run(frames, buttons = '') { this.pad = [...buttons].reduce((s, b) => s | (1 << BTN[b]), 0); for (let i = 0; i < frames; i++) this.stepFrame(); }
  tap(b, hold = 3, after = 12) { this.run(hold, b); this.run(after, ''); }
  // md.call: a ROM routine called C-style (args pushed right to left), run to its return
  call(addr, args = [], limit = 50000000) {
    const c = this.cpu, SENTINEL = 0x3FFFF0; let sp = 0xFFFE00;
    for (const a of [...args].reverse()) { sp -= 4; c.wr32(sp, a >>> 0); }
    sp -= 4; c.wr32(sp, SENTINEL);
    c.r[15] = sp >>> 0; c.sr = 0x2700; c.pc = addr;
    const res = c.run(this.fresh ? limit - 1 : limit, SENTINEL); this.fresh = false;
    if (res !== STOP.until) throw new Error('call ' + addr.toString(16) + ' stopped ' + res + ' at ' + c.pc.toString(16));
    return c.r[0];
  }

  // ---------------------------------------------------------------- state
  snapshot() {
    const c = this.cpu;
    return { r: c.r.slice(), pc: c.pc, sr: c.sr, usp: c.usp, ram: this.ram.slice(), z80: this.z80.slice(), vram: this.vram.slice(), cram: this.cram.slice(),
      vsram: this.vsram.slice(), reg: this.reg.slice(), frame: this.frame, th: this.th, code: this.code, addr: this.addr };
  }
  restore(s) {
    const c = this.cpu;
    for (let i = 0; i < 16; i++) c.r[i] = s.r[i] >>> 0;   // in place: the opcode handlers hold this array
    c.pc = s.pc; c.sr = s.sr; c.usp = s.usp || 0;
    this.ram.set(s.ram); this.z80.set(s.z80); this.vram.set(s.vram); this.cram = s.cram.slice(); this.vsram = s.vsram.slice(); this.reg = s.reg.slice();
    this.frame = s.frame; this.th = s.th; this.code = s.code; this.addr = s.addr;
    this.cpend = null; this.fillpend = false; this.fresh = false;   // (measured: md.py's load does not double-count, only power-on did)
    return this;
  }
  w(a) { a &= 0xFFFF; return this.vram[a] << 8 | this.vram[(a + 1) & 0xFFFF]; }

  // md.py screen(): planes B and A (full-screen, per-line or per-cell H-scroll, one V-scroll) and the sprites, by
  // priority; the window plane is not drawn. -> { w, h, px: Uint8Array RGB }
  screen() {
    const R = this.reg, W = R[12] & 1 ? 320 : 256, H = 224, V = this.vram;
    const pal = this.cram.map(c => [((c >> 1) & 7) * 36, ((c >> 5) & 7) * 36, ((c >> 9) & 7) * 36]);
    const dim = v => ({ 0: 32, 1: 64, 3: 128 })[v] || 32, pw = dim(R[16] & 3), ph = dim((R[16] >> 4) & 3);
    const pa = (R[2] & 0x38) << 10, pb = (R[4] & 7) << 13, sat = (R[5] & 0x7F) << 9, hs = (R[13] & 0x3F) << 10, mode = R[11] & 3;
    const pix = (t, x, y) => { const b = V[(t * 32 + y * 4 + (x >> 1)) & 0xFFFF]; return x & 1 ? b & 15 : b >> 4; };
    const colour = new Int32Array(W * H).fill(R[7] & 63), best = new Int32Array(W * H).fill(-1);
    [[pb, 1, 2], [pa, 0, 0]].forEach(([base, vsi, hsi], k) => {
      for (let y = 0; y < H; y++) {
        const h = (mode === 3 ? this.w(hs + 4 * y + hsi) : mode === 2 ? this.w(hs + 32 * (y >> 3) + hsi) : this.w(hs + hsi)) & 0x3FF;
        const yy = (y + (this.vsram[vsi] & 0x3FF)) % (ph * 8), ty = yy >> 3;
        for (let x = 0; x < W; x++) {
          const xs = (((x - h) % (pw * 8)) + pw * 8) % (pw * 8), e = this.w(base + 2 * (ty * pw + (xs >> 3)));
          const p = pix(e & 0x7FF, e & 0x800 ? 7 - (xs & 7) : xs & 7, e & 0x1000 ? 7 - (yy & 7) : yy & 7);
          const score = (e >> 15) * 3 + k, o = y * W + x;
          if (p && score > best[o]) { colour[o] = ((e >> 13) & 3) * 16 + p; best[o] = score; }
        }
      }
    });
    const spr = new Int32Array(W * H), sprP = new Int32Array(W * H), lst = [];
    for (let i = 0, seen = 0; seen < 80; seen++) {
      const a = sat + i * 8, sz = this.w(a + 2);
      lst.push([(this.w(a + 6) & 0x1FF) - 128, (this.w(a) & 0x3FF) - 128, ((sz >> 10) & 3) + 1, ((sz >> 8) & 3) + 1, this.w(a + 4)]);
      i = sz & 0x7F; if (i === 0) break;
    }
    for (const [x, y, sw, sh, at] of lst.reverse()) for (let cx = 0; cx < sw; cx++) for (let cy = 0; cy < sh; cy++) {
      const t = ((at & 0x7FF) + cx * sh + cy) & 0x7FF, ox = (at & 0x800 ? sw - 1 - cx : cx) * 8 + x, oy = (at & 0x1000 ? sh - 1 - cy : cy) * 8 + y;
      for (let yy = 0; yy < 8; yy++) {
        const py = oy + yy; if (py < 0 || py >= H) continue;
        for (let xx = 0; xx < 8; xx++) {
          const px = ox + xx, p = pix(t, at & 0x800 ? 7 - xx : xx, at & 0x1000 ? 7 - yy : yy);
          if (px >= 0 && px < W && p) { spr[py * W + px] = ((at >> 13) & 3) * 16 + p; sprP[py * W + px] = at >> 15; }
        }
      }
    }
    for (let o = 0; o < W * H; o++) { const score = sprP[o] * 3 + 2; if (spr[o] && score > best[o]) { colour[o] = spr[o]; best[o] = score; } }
    const px = new Uint8Array(W * H * 3);
    for (let o = 0; o < W * H; o++) { const c = pal[colour[o]]; px[o * 3] = c[0]; px[o * 3 + 1] = c[1]; px[o * 3 + 2] = c[2]; }
    return { w: W, h: H, px };
  }
}
