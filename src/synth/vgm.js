// A VGM log (YM2612 + SN76489, as extract/sound.js writes them) played once through into PCM: the FM chip at its own
// rate (clock / 144) resampled to the output rate, the PSG averaged over each output sample, a DC blocker at the end.
// Levels: the FM chip full scale is 1.0; the PSG's channels mixed as the Mega Drive's (FM_PSG below). A log that plays
// on the PSG alone is raised PSG_ONLY_DB (as tools/rom/render_sound.sh did for the ogg files).
import { YM2612 } from './ym2612.js';
import { PSG } from './psg.js';

export const FM_GAIN = 2.91, PSG_GAIN = 0.175, PSG_ONLY_DB = 11;   // (levels matched to libvgm's renders, the ogg files of the private build)

function header(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u32 = o => dv.getUint32(o, true);
  return { total: u32(0x18), loopOff: u32(0x1c), loopSamples: u32(0x20), psgClock: u32(0x0c), ymClock: u32(0x2c),
    data: u32(0x34) ? 0x34 + u32(0x34) : 0x40 };
}
// does the log write the PSG and (all but once) not the YM?
export function psgOnly(b) {
  const h = header(b); let psg = 0, ym = 0;
  for (let i = h.data; i < b.length;) {
    const c = b[i];
    if (c === 0x50) { psg++; i += 2; } else if (c === 0x52 || c === 0x53) { ym++; i += 3; } else if (c === 0x61) i += 3;
    else if (c === 0x66) break; else i += 1;
  }
  return psg > 0 && ym <= 1;
}
// -> { rate, left, right (Float32Array), seconds }
export function render(b, { rate = 44100 } = {}) {
  const h = header(b), n = Math.round(h.total * rate / 44100), L = new Float32Array(n), R = new Float32Array(n);   // (the log's times count 44.1 kHz samples)
  const ym = new YM2612(), psg = new PSG(), ymRate = (h.ymClock || 7670453) / 144, psgRate = (h.psgClock || 3579545) / 16;
  const fmGain = FM_GAIN / 32768, psgGain = PSG_GAIN * (psgOnly(b) ? Math.pow(10, PSG_ONLY_DB / 20) : 1);
  const cur = [0, 0], prev = [0, 0]; let ymDone = 0, psgDone = 0;
  let i = h.data, t = 0, vt = 0;   // t: output samples done; vt: the log's time (44.1 kHz samples)
  const advance = dv => {   // the log's clock moves dv samples on: render the output samples up to there
    vt += dv; const until = Math.round(vt * rate / 44100);
    for (; t < until && t < n; t++) {
      // FM: the chip's samples up to this output sample's time, linearly between the last two
      const want = (t + 1) * ymRate / rate;
      while (ymDone < want) { prev[0] = cur[0]; prev[1] = cur[1]; ym.generate(cur); ymDone++; }
      const f = 1 - (ymDone - want);
      const l = prev[0] + (cur[0] - prev[0]) * f, r = prev[1] + (cur[1] - prev[1]) * f;
      // PSG: the mean of its cycles in this output sample
      const pw = (t + 1) * psgRate / rate; let s = 0, k = 0;
      while (psgDone < pw) { s += psg.tick(); psgDone++; k++; }
      const p = k ? s / k * psgGain : 0;
      L[t] = l * fmGain + p; R[t] = r * fmGain + p;
    }
  };
  while (i < b.length && vt < h.total) {
    const c = b[i];
    if (c === 0x52 || c === 0x53) { const port = c === 0x52 ? 0 : 2; ym.write(port, b[i + 1]); ym.write(port + 1, b[i + 2]); i += 3; }
    else if (c === 0x50) { psg.write(b[i + 1]); i += 2; }
    else if (c === 0x61) { advance(b[i + 1] | b[i + 2] << 8); i += 3; }
    else if (c === 0x62) { advance(735); i++; } else if (c === 0x63) { advance(882); i++; }
    else if (c >= 0x70 && c <= 0x7f) { advance((c & 15) + 1); i++; }
    else if (c === 0x66) break;
    else i++;
  }
  advance(Math.max(0, h.total - vt));
  // a DC blocker (the PSG's square waves sit above zero; so does the DAC's idle level)
  // (it starts from the first sample: the DAC's resting level is no click)
  for (const ch of [L, R]) { let x1 = n ? ch[0] : 0, y1 = 0; for (let k = 0; k < n; k++) { const x = ch[k], y = x - x1 + 0.9995 * y1; x1 = x; y1 = y; ch[k] = y; } }
  return { rate, left: L, right: R, seconds: n / rate };
}
