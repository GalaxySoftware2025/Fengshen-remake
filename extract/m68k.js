// A Motorola 68000 interpreter for the in-browser extractor (no ROM content here: it runs the player's own cartridge).
// Written to behave as the Unicorn core the Python research tools ran on (tools/rom/md.py), so the extractor's output
// matches what those tools produced: instruction counts, not cycles, drive time; RTE and division by zero end a run
// with a status, so the harness can handle them the way md.py does. The bus is supplied by the caller (extract/md.js):
// read8/16/32(addr), write8/16/32(addr, v), with addresses already masked to 24 bits here.
const MASK = [0, 0xFF, 0xFFFF, 0, 0xFFFFFFFF], MSB = [0, 0x80, 0x8000, 0, 0x80000000];
const sx8 = v => (v << 24) >> 24, sx16 = v => (v << 16) >> 16, U = (v, m) => (v & m) >>> 0;
export const STOP = { none: 0, count: 1, until: 2, rte: 3, div0: 4, illegal: 5, hook: 6 };

export class M68K {
  constructor(bus) {
    this.bus = bus;
    this.r = new Array(16).fill(0);          // D0-D7, A0-A7 (unsigned 32-bit numbers)
    this.pc = 0; this.srHi = 0x2700;         // the system byte of SR (S, mask, T)
    this.x = 0; this.n = 0; this.z = 0; this.v = 0; this.c = 0;
    this.usp = 0;
    this.hooks = new Map();                  // address -> fn(cpu): called before the instruction there (Unicorn UC_HOOK_CODE)
    this.hookAny = null;                     // fn(cpu) before every instruction (tracing)
    this.stopReason = 0; this.opPC = 0; this.executed = 0;
    this.table = buildTable(this);
  }
  get sr() { return this.srHi | (this.x << 4) | (this.n << 3) | (this.z << 2) | (this.v << 1) | this.c; }
  set sr(v) { this.srHi = v & 0xA700; this.ccr = v; }
  get ccr() { return (this.x << 4) | (this.n << 3) | (this.z << 2) | (this.v << 1) | this.c; }
  set ccr(v) { this.x = (v >> 4) & 1; this.n = (v >> 3) & 1; this.z = (v >> 2) & 1; this.v = (v >> 1) & 1; this.c = v & 1; }

  // ---- memory
  rd8(a) { return this.bus.read8(a & 0xFFFFFF); }
  rd16(a) { return this.bus.read16(a & 0xFFFFFF); }
  rd32(a) { return this.bus.read32(a & 0xFFFFFF) >>> 0; }
  wr8(a, v) { this.bus.write8(a & 0xFFFFFF, v & 0xFF); }
  wr16(a, v) { this.bus.write16(a & 0xFFFFFF, v & 0xFFFF); }
  wr32(a, v) { this.bus.write32(a & 0xFFFFFF, v >>> 0); }
  rd(size, a) { return size === 1 ? this.rd8(a) : size === 2 ? this.rd16(a) : this.rd32(a); }
  wr(size, a, v) { if (size === 1) this.wr8(a, v); else if (size === 2) this.wr16(a, v); else this.wr32(a, v); }
  fetch16() { const v = this.rd16(this.pc); this.pc = (this.pc + 2) >>> 0; return v; }
  fetch32() { const v = this.rd32(this.pc); this.pc = (this.pc + 4) >>> 0; return v; }
  push32(v) { this.r[15] = (this.r[15] - 4) >>> 0; this.wr32(this.r[15], v); }
  push16(v) { this.r[15] = (this.r[15] - 2) >>> 0; this.wr16(this.r[15], v); }
  pop32() { const v = this.rd32(this.r[15]); this.r[15] = (this.r[15] + 4) >>> 0; return v; }
  pop16() { const v = this.rd16(this.r[15]); this.r[15] = (this.r[15] + 2) >>> 0; return v; }

  // ---- effective addresses: (mode, reg) as encoded; size 1 / 2 / 4
  // the address of a memory operand (side effects of (An)+ / -(An) applied once, here)
  addr(mode, reg, size) {
    const r = this.r;
    switch (mode) {
      case 2: return r[8 + reg];
      case 3: { const a = r[8 + reg]; r[8 + reg] = (a + (size === 1 && reg === 7 ? 2 : size)) >>> 0; return a; }
      case 4: { const a = (r[8 + reg] - (size === 1 && reg === 7 ? 2 : size)) >>> 0; r[8 + reg] = a; return a; }
      case 5: { const d = sx16(this.fetch16()); return (r[8 + reg] + d) >>> 0; }
      case 6: return this.index(r[8 + reg]);
      case 7:
        switch (reg) {
          case 0: return sx16(this.fetch16()) >>> 0;
          case 1: return this.fetch32();
          case 2: { const base = this.pc, d = sx16(this.fetch16()); return (base + d) >>> 0; }
          case 3: return this.index(this.pc);
        }
    }
    throw new Error('bad addressing mode ' + mode + '/' + reg + ' at ' + this.opPC.toString(16));
  }
  index(base) {   // brief extension word: d8(base, Xn.size)
    const ext = this.fetch16(), xr = this.r[(ext >> 12) & 15], xi = ext & 0x800 ? xr | 0 : sx16(xr & 0xFFFF);
    return (base + sx8(ext & 0xFF) + xi) >>> 0;
  }
  // read an operand
  get(mode, reg, size) {
    if (mode === 0) return U(this.r[reg], MASK[size]);
    if (mode === 1) return size === 2 ? this.r[8 + reg] & 0xFFFF : this.r[8 + reg];
    if (mode === 7 && reg === 4) {   // immediate
      if (size === 1) return this.fetch16() & 0xFF;
      if (size === 2) return this.fetch16();
      return this.fetch32();
    }
    return this.rd(size, this.addr(mode, reg, size));
  }
  // write a register operand (mode 0 / 1)
  setReg(mode, reg, size, v) {
    if (mode === 1) { this.r[8 + reg] = size === 2 ? sx16(v) >>> 0 : v >>> 0; return; }
    if (size === 4) this.r[reg] = v >>> 0;
    else { const m = MASK[size]; this.r[reg] = ((this.r[reg] & ~m) | (v & m)) >>> 0; }
  }
  // a destination: a register (returns -1 - n) or a memory address (computed once)
  loc(mode, reg, size) { return mode === 0 ? -1 - reg : mode === 1 ? -9 - reg : this.addr(mode, reg, size); }
  rdLoc(l, size) { if (l < 0) { const n = -1 - l; return n < 8 ? U(this.r[n], MASK[size]) : (size === 2 ? this.r[n] & 0xFFFF : this.r[n]); } return this.rd(size, l); }
  wrLoc(l, size, v) {
    if (l < 0) { const n = -1 - l; if (n < 8) this.setReg(0, n, size, v); else this.setReg(1, n - 8, size, v); return; }
    this.wr(size, l, v);
  }

  // ---- flags
  nz(size, v) { this.n = (v & MSB[size]) !== 0 ? 1 : 0; this.z = (v & MASK[size]) === 0 ? 1 : 0; }
  logic(size, v) { this.nz(size, v); this.v = 0; this.c = 0; }
  cond(cc) {
    switch (cc) {
      case 0: return true; case 1: return false;
      case 2: return !this.c && !this.z;      // HI
      case 3: return !!(this.c || this.z);    // LS
      case 4: return !this.c; case 5: return !!this.c;
      case 6: return !this.z; case 7: return !!this.z;
      case 8: return !this.v; case 9: return !!this.v;
      case 10: return !this.n; case 11: return !!this.n;
      case 12: return this.n === this.v;      // GE
      case 13: return this.n !== this.v;      // LT
      case 14: return !this.z && this.n === this.v;   // GT
      case 15: return !!this.z || this.n !== this.v;  // LE
    }
  }
  add(size, d, s, x = 0) {   // d + s (+ x), flags as ADD / ADDX (the caller handles ADDX's Z)
    const m = MASK[size], sum = U(d, m) + U(s, m) + x, r = size === 4 ? sum >>> 0 : sum & m;
    this.c = sum > m ? 1 : 0; this.x = this.c;
    this.v = ((d ^ r) & (s ^ r) & MSB[size]) !== 0 ? 1 : 0;
    this.n = (r & MSB[size]) !== 0 ? 1 : 0; this.z = r === 0 ? 1 : 0;
    return r;
  }
  sub(size, d, s, x = 0, setX = true) {   // d - s (- x)
    const m = MASK[size], du = U(d, m), su = U(s, m), diff = du - su - x, r = size === 4 ? diff >>> 0 : diff & m;
    this.c = diff < 0 ? 1 : 0; if (setX) this.x = this.c;
    this.v = ((d ^ s) & (d ^ r) & MSB[size]) !== 0 ? 1 : 0;
    this.n = (r & MSB[size]) !== 0 ? 1 : 0; this.z = r === 0 ? 1 : 0;
    return r;
  }
  cmp(size, d, s) { const x = this.x; this.sub(size, d, s, 0, false); this.x = x; }

  // ---- exceptions
  exception(vec) {
    const sr = this.sr; this.srHi = (this.srHi | 0x2000) & ~0x8000;
    this.push32(this.pc); this.push16(sr);
    this.pc = this.rd32(vec * 4);
  }

  // ---- run: up to `count` instructions, or until pc === until; returns a STOP code
  run(count, until = -1) {
    const table = this.table, hooks = this.hooks;
    let i = 0; this.stopReason = 0;
    while (i < count) {
      const pc = this.pc;
      if (pc === until) { this.executed = i; return (this.stopReason = STOP.until); }
      if (hooks.size) { const h = hooks.get(pc); if (h) { h(this); if (this.stopReason === STOP.hook) { this.executed = i; return STOP.hook; } if (this.pc !== pc) continue; } }
      if (this.hookAny) this.hookAny(this);
      this.opPC = pc;
      const op = this.rd16(pc);
      if (op === 0x4E73) { this.executed = i; return (this.stopReason = STOP.rte); }   // RTE: md.py performs it itself
      this.pc = (pc + 2) >>> 0;
      const res = table[op](op);
      if (res) { this.pc = pc; this.executed = i; return (this.stopReason = res); }
      i++;
    }
    this.executed = i;
    return (this.stopReason = STOP.count);
  }
}

// ---------------------------------------------------------------- the opcode table
function buildTable(cpu) {
  const T = new Array(65536);
  const illegal = () => STOP.illegal;
  for (let op = 0; op < 65536; op++) T[op] = decode(cpu, op) || illegal;
  return T;
}
const SZ = [1, 2, 4];   // the usual 2-bit size field: 00 byte, 01 word, 10 long

function decode(cpu, op) {
  const C = cpu, r = cpu.r;
  const hi = op >> 12, mode = (op >> 3) & 7, reg = op & 7, rx = (op >> 9) & 7;
  const validEA = (m, g, alterable, data, mem) => {
    if (m === 7 && g > 4) return false;
    if (alterable && (m === 7 && g >= 2)) return false;
    if (data && m === 1) return false;
    if (mem && (m === 0 || m === 1)) return false;
    return true;
  };
  switch (hi) {
    case 0x0: {
      // bit ops with a register: BTST/BCHG/BCLR/BSET Dn,<ea> ; MOVEP
      if (op & 0x100) {
        if (mode === 1) {   // MOVEP
          const opm = (op >> 6) & 7, dn = rx, an = reg;
          return () => {
            const a = (r[8 + an] + sx16(C.fetch16())) >>> 0;
            switch (opm) {
              case 4: { const v = (C.rd8(a) << 8) | C.rd8(a + 2); C.setReg(0, dn, 2, v); break; }
              case 5: { const v = (C.rd8(a) << 24 | C.rd8(a + 2) << 16 | C.rd8(a + 4) << 8 | C.rd8(a + 6)) >>> 0; r[dn] = v; break; }
              case 6: { const v = r[dn]; C.wr8(a, v >> 8); C.wr8(a + 2, v); break; }
              case 7: { const v = r[dn]; C.wr8(a, v >>> 24); C.wr8(a + 2, v >>> 16); C.wr8(a + 4, v >>> 8); C.wr8(a + 6, v); break; }
            }
          };
        }
        const kind = (op >> 6) & 3;
        if (!validEA(mode, reg, kind !== 0, true, false) && !(kind === 0 && mode === 7 && reg <= 4)) return null;
        return bitop(C, kind, () => r[rx], mode, reg);
      }
      const sub = (op >> 9) & 7;
      if (sub === 4) {   // static bit ops: BTST/BCHG/BCLR/BSET #n,<ea>
        const kind = (op >> 6) & 3;
        if (!validEA(mode, reg, kind !== 0, true, false) && !(kind === 0 && mode === 7 && reg <= 3)) return null;
        return bitop(C, kind, () => C.fetch16() & 0xFF, mode, reg);
      }
      const size = SZ[(op >> 6) & 3]; if ((op >> 6 & 3) === 3) return null;
      const ops = { 0: 'or', 1: 'and', 2: 'sub', 3: 'add', 5: 'eor', 6: 'cmp' }[sub];
      if (!ops) return null;
      if (mode === 7 && reg === 4) {   // to CCR / SR
        if (!['or', 'and', 'eor'].includes(ops) || size === 4) return null;
        return () => {
          const imm = C.fetch16();
          if (size === 1) { const v = C.ccr; C.ccr = ops === 'or' ? v | imm : ops === 'and' ? v & imm : v ^ imm; }
          else { const v = C.sr; C.sr = ops === 'or' ? v | imm : ops === 'and' ? v & imm : v ^ imm; }
        };
      }
      if (!validEA(mode, reg, true, true, false)) return null;
      return () => {
        const imm = size === 4 ? C.fetch32() : C.fetch16() & MASK[size];
        const l = C.loc(mode, reg, size), d = C.rdLoc(l, size);
        let v;
        switch (ops) {
          case 'or': v = (d | imm) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v); break;
          case 'and': v = (d & imm) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v); break;
          case 'eor': v = (d ^ imm) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v); break;
          case 'sub': v = C.sub(size, d, imm); C.wrLoc(l, size, v); break;
          case 'add': v = C.add(size, d, imm); C.wrLoc(l, size, v); break;
          case 'cmp': C.cmp(size, d, imm); break;
        }
      };
    }
    case 0x1: case 0x2: case 0x3: {   // MOVE / MOVEA
      const size = hi === 1 ? 1 : hi === 3 ? 2 : 4, dmode = (op >> 6) & 7, dreg = rx;
      if (!validEA(mode, reg, false, false, false)) return null;
      if (size === 1 && mode === 1) return null;
      if (dmode === 1) {   // MOVEA
        if (size === 1) return null;
        return () => { const v = C.get(mode, reg, size); r[8 + dreg] = size === 2 ? sx16(v) >>> 0 : v >>> 0; };
      }
      if (dmode === 7 && dreg > 1) return null;
      return () => {
        const v = C.get(mode, reg, size);
        C.logic(size, v);
        if (dmode === 0) C.setReg(0, dreg, size, v); else C.wr(size, C.addr(dmode, dreg, size), v);
      };
    }
    case 0x4: return group4(C, op, mode, reg, rx, validEA);
    case 0x5: {
      if (((op >> 6) & 3) === 3) {
        const cc = (op >> 8) & 15;
        if (mode === 1) {   // DBcc
          return () => {
            const base = C.pc, d = sx16(C.fetch16());
            if (C.cond(cc)) return;
            const w = ((r[reg] & 0xFFFF) - 1) & 0xFFFF; r[reg] = ((r[reg] & 0xFFFF0000) | w) >>> 0;
            if (w !== 0xFFFF) C.pc = (base + d) >>> 0;
          };
        }
        if (!validEA(mode, reg, true, true, false)) return null;   // Scc
        return () => { const l = C.loc(mode, reg, 1); C.wrLoc(l, 1, C.cond(cc) ? 0xFF : 0); };
      }
      const size = SZ[(op >> 6) & 3], q = rx || 8, subq = op & 0x100;
      if (!validEA(mode, reg, true, false, false) || (size === 1 && mode === 1)) return null;
      if (mode === 1) return () => { r[8 + reg] = (subq ? r[8 + reg] - q : r[8 + reg] + q) >>> 0; };   // the whole register, no flags
      return () => { const l = C.loc(mode, reg, size), d = C.rdLoc(l, size); C.wrLoc(l, size, subq ? C.sub(size, d, q) : C.add(size, d, q)); };
    }
    case 0x6: {   // Bcc / BRA / BSR
      const cc = (op >> 8) & 15, d8 = op & 0xFF;
      return () => {
        const base = C.pc; let d = sx8(d8);
        if (d8 === 0) d = sx16(C.fetch16());
        if (cc === 1) { C.push32(C.pc); C.pc = (base + d) >>> 0; return; }   // BSR
        if (C.cond(cc)) C.pc = (base + d) >>> 0;
      };
    }
    case 0x7: {   // MOVEQ
      if (op & 0x100) return null;
      const v = sx8(op & 0xFF) >>> 0;
      return () => { r[rx] = v; C.logic(4, v); };
    }
    case 0x8: case 0xC: {   // OR / DIV / SBCD ; AND / MUL / ABCD / EXG
      const opm = (op >> 6) & 7;
      if (opm === 3 || opm === 7) {   // DIVU / DIVS, MULU / MULS
        if (!validEA(mode, reg, false, true, false)) return null;
        const signed = opm === 7;
        if (hi === 0x8) return () => {
          const s = C.get(mode, reg, 2), d = r[rx];
          if (s === 0) return STOP.div0;
          if (!signed) {
            const q = Math.floor(d / s), rem = d % s;
            if (q > 0xFFFF) { C.v = 1; C.c = 0; C.n = 1; C.z = 0; return; }
            r[rx] = ((rem << 16) | q) >>> 0; C.n = (q & 0x8000) ? 1 : 0; C.z = q === 0 ? 1 : 0; C.v = 0; C.c = 0;
          } else {
            const ds = d | 0, ss = sx16(s), q = Math.trunc(ds / ss), rem = ds - q * ss;
            if (q > 32767 || q < -32768) { C.v = 1; C.c = 0; C.n = 1; C.z = 0; return; }
            r[rx] = (((rem & 0xFFFF) << 16) | (q & 0xFFFF)) >>> 0; C.n = (q & 0x8000) ? 1 : 0; C.z = (q & 0xFFFF) === 0 ? 1 : 0; C.v = 0; C.c = 0;
          }
        };
        return () => {
          const s = C.get(mode, reg, 2), d = r[rx] & 0xFFFF;
          const v = signed ? (Math.imul(sx16(s), sx16(d)) >>> 0) : (Math.imul(s, d) >>> 0);
          r[rx] = v; C.logic(4, v);
        };
      }
      if ((op & 0x1F0) === 0x100) {   // SBCD / ABCD
        const rm = op & 8;
        return () => {
          let s, d, a;
          if (rm) { s = C.rd8(C.addr(4, reg, 1)); a = C.addr(4, rx, 1); d = C.rd8(a); } else { s = r[reg] & 0xFF; d = r[rx] & 0xFF; }
          const v = hi === 0xC ? bcdAdd(C, d, s) : bcdSub(C, d, s);
          if (rm) C.wr8(a, v); else C.setReg(0, rx, 1, v);
        };
      }
      if (hi === 0xC && (op & 0x130) === 0x100 && [0x140, 0x148, 0x188].includes(op & 0x1F8)) {   // EXG
        const k = op & 0x1F8;
        return () => {
          const a = k === 0x140 ? rx : k === 0x148 ? 8 + rx : rx, b = k === 0x140 ? reg : 8 + reg;
          const t = r[a]; r[a] = r[b]; r[b] = t;
        };
      }
      const size = SZ[opm & 3], toEA = opm & 4;
      if (toEA ? !validEA(mode, reg, true, true, true) : !validEA(mode, reg, false, true, false)) return null;
      return () => {
        if (toEA) { const l = C.loc(mode, reg, size), d = C.rdLoc(l, size), v = (hi === 0x8 ? d | r[rx] : d & r[rx]) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v >>> 0); }
        else { const s = C.get(mode, reg, size), v = (hi === 0x8 ? r[rx] | s : r[rx] & s) & MASK[size]; C.logic(size, v); C.setReg(0, rx, size, v >>> 0); }
      };
    }
    case 0x9: case 0xD: {   // SUB / SUBA / SUBX ; ADD / ADDA / ADDX
      const isAdd = hi === 0xD, opm = (op >> 6) & 7;
      if (opm === 3 || opm === 7) {   // ADDA / SUBA
        const size = opm === 3 ? 2 : 4;
        if (!validEA(mode, reg, false, false, false)) return null;
        return () => { let s = C.get(mode, reg, size); if (size === 2) s = sx16(s); r[8 + rx] = (isAdd ? r[8 + rx] + s : r[8 + rx] - s) >>> 0; };
      }
      const size = SZ[opm & 3];
      if ((op & 0x130) === 0x100) {   // ADDX / SUBX
        const rm = op & 8;
        return () => {
          let s, d, a;
          if (rm) { s = C.rd(size, C.addr(4, reg, size)); a = C.addr(4, rx, size); d = C.rd(size, a); } else { s = r[reg] & MASK[size]; d = r[rx] & MASK[size]; }
          const z = C.z, v = isAdd ? C.add(size, d, s, C.x) : C.sub(size, d, s, C.x);
          C.z = v === 0 ? z : 0;
          if (rm) C.wr(size, a, v); else C.setReg(0, rx, size, v);
        };
      }
      const toEA = opm & 4;
      if (toEA ? !validEA(mode, reg, true, false, true) : !validEA(mode, reg, false, false, false)) return null;
      if (!toEA && size === 1 && mode === 1) return null;
      return () => {
        if (toEA) { const l = C.loc(mode, reg, size), d = C.rdLoc(l, size); C.wrLoc(l, size, isAdd ? C.add(size, d, r[rx]) : C.sub(size, d, r[rx])); }
        else { const s = C.get(mode, reg, size), d = r[rx]; C.setReg(0, rx, size, isAdd ? C.add(size, d, s) : C.sub(size, d, s)); }
      };
    }
    case 0xA: case 0xF: return () => { C.pc = C.opPC; C.exception(hi === 0xA ? 10 : 11); };   // line A / F
    case 0xB: {   // CMP / CMPA / CMPM / EOR
      const opm = (op >> 6) & 7;
      if (opm === 3 || opm === 7) {   // CMPA
        const size = opm === 3 ? 2 : 4;
        if (!validEA(mode, reg, false, false, false)) return null;
        return () => { let s = C.get(mode, reg, size); if (size === 2) s = sx16(s) >>> 0; C.cmp(4, r[8 + rx], s); };
      }
      const size = SZ[opm & 3];
      if (opm < 3) {   // CMP <ea>,Dn
        if (!validEA(mode, reg, false, false, false) || (size === 1 && mode === 1)) return null;
        return () => { const s = C.get(mode, reg, size); C.cmp(size, r[rx], s); };
      }
      if (mode === 1) {   // CMPM (Ay)+,(Ax)+
        return () => { const s = C.rd(size, C.addr(3, reg, size)), d = C.rd(size, C.addr(3, rx, size)); C.cmp(size, d, s); };
      }
      if (!validEA(mode, reg, true, true, false)) return null;   // EOR Dn,<ea>
      return () => { const l = C.loc(mode, reg, size), v = (C.rdLoc(l, size) ^ r[rx]) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v >>> 0); };
    }
    case 0xE: return shifts(C, op, mode, reg, rx, validEA);
  }
  return null;
}

function bitop(C, kind, bitOf, mode, reg) {
  const r = C.r;
  return () => {
    const bit = bitOf();
    if (mode === 0) {
      const b = bit & 31, m = (1 << b) >>> 0, v = r[reg];
      C.z = (v & m) === 0 ? 1 : 0;
      if (kind === 1) r[reg] = (v ^ m) >>> 0; else if (kind === 2) r[reg] = (v & ~m) >>> 0; else if (kind === 3) r[reg] = (v | m) >>> 0;
      return;
    }
    const b = bit & 7, m = 1 << b;
    if (kind === 0) { const v = mode === 7 && reg === 4 ? C.fetch16() & 0xFF : C.rd8(C.addr(mode, reg, 1)); C.z = (v & m) === 0 ? 1 : 0; return; }
    const a = C.addr(mode, reg, 1), v = C.rd8(a);
    C.z = (v & m) === 0 ? 1 : 0;
    C.wr8(a, kind === 1 ? v ^ m : kind === 2 ? v & ~m : v | m);
  };
}

function bcdAdd(C, d, s) {
  let lo = (d & 15) + (s & 15) + C.x, hiN = (d & 0xF0) + (s & 0xF0), res = hiN + lo;
  if (lo > 9) res += 6;
  const c = res > 0x99 ? 1 : 0; if (c) res += 0x60;
  res &= 0xFF; C.c = C.x = c; if (res) C.z = 0; C.n = (res & 0x80) ? 1 : 0; C.v = 0;
  return res;
}
function bcdSub(C, d, s) {
  let lo = (d & 15) - (s & 15) - C.x, res = (d & 0xF0) - (s & 0xF0) + lo, borrow = 0;
  if (lo < 0) res -= 6;
  if (res < 0) { res -= 0x60; borrow = 1; }
  res &= 0xFF; C.c = C.x = borrow; if (res) C.z = 0; C.n = (res & 0x80) ? 1 : 0; C.v = 0;
  return res;
}

function group4(C, op, mode, reg, rx, validEA) {
  const r = C.r;
  if ((op & 0x1C0) === 0x1C0) {   // LEA
    if (!(mode === 2 || mode >= 5) || (mode === 7 && reg > 3)) return null;
    return () => { r[8 + rx] = C.addr(mode, reg, 4); };
  }
  if ((op & 0x1C0) === 0x180) {   // CHK.W
    if (!validEA(mode, reg, false, true, false)) return null;
    return () => {
      const b = sx16(C.get(mode, reg, 2)), v = sx16(r[rx] & 0xFFFF);
      if (v < 0) { C.n = 1; C.exception(6); } else if (v > b) { C.n = 0; C.exception(6); }
    };
  }
  switch (op) {
    case 0x4E70: return () => {};                                   // RESET
    case 0x4E71: return () => {};                                   // NOP
    case 0x4E72: return () => { C.sr = C.fetch16(); return STOP.illegal; };   // STOP (never expected here)
    case 0x4E75: return () => { C.pc = C.pop32(); };               // RTS
    case 0x4E76: return () => { if (C.v) C.exception(7); };        // TRAPV
    case 0x4E77: return () => { C.ccr = C.pop16(); C.pc = C.pop32(); };   // RTR
    case 0x4AFC: return () => STOP.illegal;                        // ILLEGAL
  }
  if ((op & 0xFFF0) === 0x4E40) return () => C.exception(32 + (op & 15));   // TRAP
  if ((op & 0xFFF8) === 0x4E50) return () => { const d = sx16(C.fetch16()); C.push32(r[8 + reg]); r[8 + reg] = r[15]; r[15] = (r[15] + d) >>> 0; };   // LINK
  if ((op & 0xFFF8) === 0x4E58) return () => { r[15] = r[8 + reg]; r[8 + reg] = C.pop32(); };   // UNLK
  if ((op & 0xFFF8) === 0x4E60) return () => { C.usp = r[8 + reg]; };   // MOVE An,USP
  if ((op & 0xFFF8) === 0x4E68) return () => { r[8 + reg] = C.usp; };   // MOVE USP,An
  if ((op & 0xFFC0) === 0x4E80) {   // JSR
    if (!(mode === 2 || mode >= 5) || (mode === 7 && reg > 3)) return null;
    return () => { const a = C.addr(mode, reg, 4); C.push32(C.pc); C.pc = a; };
  }
  if ((op & 0xFFC0) === 0x4EC0) {   // JMP
    if (!(mode === 2 || mode >= 5) || (mode === 7 && reg > 3)) return null;
    return () => { C.pc = C.addr(mode, reg, 4); };
  }
  if ((op & 0xFFF8) === 0x4840) return () => { const v = r[reg]; r[reg] = ((v >>> 16) | (v << 16)) >>> 0; C.logic(4, r[reg]); };   // SWAP
  if ((op & 0xFFC0) === 0x4840) {   // PEA
    if (!(mode === 2 || mode >= 5) || (mode === 7 && reg > 3)) return null;
    return () => { const a = C.addr(mode, reg, 4); C.push32(a); };
  }
  if ((op & 0xFFF8) === 0x4880) return () => { const v = sx8(r[reg] & 0xFF) & 0xFFFF; C.setReg(0, reg, 2, v); C.logic(2, v); };   // EXT.W
  if ((op & 0xFFF8) === 0x48C0) return () => { const v = sx16(r[reg] & 0xFFFF) >>> 0; r[reg] = v; C.logic(4, v); };   // EXT.L
  if ((op & 0xFB80) === 0x4880) {   // MOVEM
    const toMem = !(op & 0x400), size = op & 0x40 ? 4 : 2;
    if (toMem ? !(mode === 2 || mode === 4 || mode === 5 || mode === 6 || (mode === 7 && reg <= 1)) : !(mode === 2 || mode === 3 || mode === 5 || mode === 6 || (mode === 7 && reg <= 3))) return null;
    return () => {
      const mask = C.fetch16();
      if (toMem) {
        if (mode === 4) {   // -(An): the list is reversed (bit 0 = A7)
          let a = r[8 + reg];
          for (let i = 0; i < 16; i++) if (mask & (1 << i)) { const n = 15 - i; a = (a - size) >>> 0; C.wr(size, a, r[n]); }
          r[8 + reg] = a;
        } else {
          let a = C.addr(mode, reg, size);
          for (let n = 0; n < 16; n++) if (mask & (1 << n)) { C.wr(size, a, r[n]); a = (a + size) >>> 0; }
        }
      } else {
        let a = mode === 3 ? r[8 + reg] : C.addr(mode, reg, size);
        for (let n = 0; n < 16; n++) if (mask & (1 << n)) { let v = C.rd(size, a); if (size === 2) v = sx16(v) >>> 0; r[n] = v; a = (a + size) >>> 0; }
        if (mode === 3) r[8 + reg] = a;
      }
    };
  }
  if ((op & 0xFFC0) === 0x40C0) {   // MOVE from SR
    if (!validEA(mode, reg, true, true, false)) return null;
    return () => { const l = C.loc(mode, reg, 2); C.wrLoc(l, 2, C.sr); };
  }
  if ((op & 0xFFC0) === 0x44C0) {   // MOVE to CCR
    if (!validEA(mode, reg, false, true, false)) return null;
    return () => { C.ccr = C.get(mode, reg, 2) & 0xFF; };
  }
  if ((op & 0xFFC0) === 0x46C0) {   // MOVE to SR
    if (!validEA(mode, reg, false, true, false)) return null;
    return () => { C.sr = C.get(mode, reg, 2); };
  }
  if ((op & 0xFFC0) === 0x4800) {   // NBCD
    if (!validEA(mode, reg, true, true, false)) return null;
    return () => { const l = C.loc(mode, reg, 1), d = C.rdLoc(l, 1); C.wrLoc(l, 1, bcdSub(C, 0, d)); };
  }
  if ((op & 0xFFC0) === 0x4AC0) {   // TAS
    if (!validEA(mode, reg, true, true, false)) return null;
    return () => { const l = C.loc(mode, reg, 1), d = C.rdLoc(l, 1); C.logic(1, d); C.wrLoc(l, 1, d | 0x80); };
  }
  const size = SZ[(op >> 6) & 3];
  if (((op >> 6) & 3) === 3) return null;
  switch (op & 0xFF00) {
    case 0x4000: if (!validEA(mode, reg, true, true, false)) return null;   // NEGX
      return () => { const l = C.loc(mode, reg, size), d = C.rdLoc(l, size), z = C.z, v = C.sub(size, 0, d, C.x); C.z = v === 0 ? z : 0; C.wrLoc(l, size, v); };
    case 0x4200: if (!validEA(mode, reg, true, true, false)) return null;   // CLR
      return () => { const l = C.loc(mode, reg, size); C.wrLoc(l, size, 0); C.n = 0; C.z = 1; C.v = 0; C.c = 0; };
    case 0x4400: if (!validEA(mode, reg, true, true, false)) return null;   // NEG
      return () => { const l = C.loc(mode, reg, size), d = C.rdLoc(l, size); C.wrLoc(l, size, C.sub(size, 0, d)); };
    case 0x4600: if (!validEA(mode, reg, true, true, false)) return null;   // NOT
      return () => { const l = C.loc(mode, reg, size), v = (~C.rdLoc(l, size)) & MASK[size]; C.logic(size, v); C.wrLoc(l, size, v >>> 0); };
    case 0x4A00: if (!validEA(mode, reg, false, false, false) || (size === 1 && mode === 1)) return null;   // TST
      return () => { C.logic(size, C.get(mode, reg, size)); };
  }
  return null;
}

function shifts(C, op, mode, reg, rx, validEA) {
  const r = C.r;
  if (((op >> 6) & 3) === 3) {   // memory shifts, by one, word
    const kind = (op >> 9) & 3, left = op & 0x100;
    if (!validEA(mode, reg, true, true, true)) return null;
    return () => { const a = C.addr(mode, reg, 2), v = C.rd16(a); C.wr16(a, shift(C, kind, left, 2, v, 1)); };
  }
  const size = SZ[(op >> 6) & 3], kind = (op >> 3) & 3, left = op & 0x100, byReg = op & 0x20;
  return () => { const cnt = byReg ? r[rx] & 63 : (rx || 8); C.setReg(0, reg, size, shift(C, kind, left, size, U(r[reg], MASK[size]), cnt)); };
}
// kind: 0 AS, 1 LS, 2 ROX, 3 RO; returns the result, flags set
function shift(C, kind, left, size, v, cnt) {
  const bits = size * 8, msb = MSB[size], m = MASK[size];
  v = v >>> 0;
  if (cnt === 0) { C.nz(size, v); C.v = 0; C.c = kind === 2 ? C.x : 0; return v; }
  let c = 0, vf = 0;
  switch (kind) {
    case 0: case 1:
      if (left) {
        for (let i = 0; i < cnt; i++) { c = (v & msb) ? 1 : 0; const nv = (v * 2) % 0x100000000 & m; if (kind === 0 && ((nv ^ v) & msb)) vf = 1; v = nv >>> 0; }
      } else {
        for (let i = 0; i < cnt; i++) { c = v & 1; v = kind === 0 ? ((v >>> 1) | (v & msb)) >>> 0 : v >>> 1; }
      }
      C.x = c; C.c = c; C.v = kind === 0 ? vf : 0; break;
    case 2: {   // ROXL / ROXR
      let x = C.x;
      for (let i = 0; i < cnt; i++) {
        if (left) { c = (v & msb) ? 1 : 0; v = (((v * 2) % 0x100000000 & m) | x) >>> 0; }
        else { c = v & 1; v = ((v >>> 1) | (x ? msb : 0)) >>> 0; }
        x = c;
      }
      C.x = x; C.c = x; C.v = 0; break;
    }
    case 3: {   // ROL / ROR
      const k = cnt % bits;
      if (left) { if (k) v = (((v << k) | (v >>> (bits - k))) & m) >>> 0; c = v & 1; }
      else { if (k) v = (((v >>> k) | (v << (bits - k))) & m) >>> 0; c = (v & msb) ? 1 : 0; }
      C.c = c; C.v = 0; break;
    }
  }
  v = v & m; if (size === 4) v = v >>> 0;
  C.nz(size, v);
  return v;
}
