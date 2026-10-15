// The balloons of op 11 (assets/fx/emotes.png: 13 frames of 32 px), redrawn as vector art at 256 px a frame so they stay
// crisp at any size: the same shapes in the same order, a black outline over a gold rim, a white face, the tail to the
// lower left (the balloon sits up and right of the head). Frames:
//   0-2 a cloud with a growing z (asleep)   3 a round balloon with ?   4 a burst with !   5 a burst with a lit bulb
//   6-7 a cloud with a tangle (cross)       8-10 a square balloon, a drop of sweat sliding down   11-12 dots (speechless)
import * as THREE from 'three';

export const FRAMES = 13, S = 256;
const INK = '#141008', RIM = '#f0b818', FACE = '#fffdf6';

// a balloon is a union of circles and polygons; drawn three times, each grown by the layer's margin, it gets an even
// outline even where the parts meet
function balloon(g, parts, ox) {
  for (const [col, grow] of [[INK, 15], [RIM, 8], [FACE, 0]]) {
    g.fillStyle = g.strokeStyle = col; g.lineJoin = 'round'; g.lineWidth = grow * 2;
    for (const p of parts) {
      g.beginPath();
      if (p.c) g.arc(ox + p.c[0], p.c[1], p.c[2] + grow, 0, Math.PI * 2);
      else { p.poly.forEach(([x, y], i) => i ? g.lineTo(ox + x, y) : g.moveTo(ox + x, y)); g.closePath(); if (grow) g.stroke(); }
      g.fill();
    }
  }
}
const cloud = [{ c: [96, 118, 50] }, { c: [152, 92, 54] }, { c: [200, 132, 44] }, { c: [160, 168, 50] }, { c: [100, 166, 46] }, { c: [140, 128, 50] },
  { c: [52, 216, 16] }, { c: [24, 240, 8] }];
const round = [{ c: [144, 116, 92] }, { poly: [[70, 160], [112, 196], [34, 236]] }];
const thought = [{ c: [148, 116, 90] }, { c: [60, 208, 17] }, { c: [30, 238, 9] }];
const square = [{ poly: [[48, 52], [236, 52], [236, 192], [48, 192]] }, { poly: [[66, 180], [112, 186], [34, 238]] }];
function burst(cx, cy, n, r0, r1, wob) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r1 : r0 + (i % 4 ? 0 : wob); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return [{ poly: pts }];
}
const z = (g, x, y, h, w) => {   // a Z, its strokes as thick as the size allows
  g.strokeStyle = INK; g.lineWidth = Math.max(9, h * 0.2); g.lineJoin = 'miter'; g.lineCap = 'square';
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
};
function glyph(g, ch, x, y, size) {
  g.fillStyle = INK; g.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, x, y);
}
function drop(g, x, y, s) {   // a bead of sweat: round at the bottom, pointed on top
  g.beginPath(); g.moveTo(x, y - s * 1.6);
  g.bezierCurveTo(x + s * 0.35, y - s * 0.9, x + s, y - s * 0.35, x + s, y + s * 0.1);
  g.arc(x, y + s * 0.1, s, 0, Math.PI); g.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.35, y - s * 0.9, x, y - s * 1.6); g.closePath();
  g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  const f = g.createLinearGradient(x - s, y - s, x + s, y + s); f.addColorStop(0, '#d8f2ff'); f.addColorStop(1, '#58aef0'); g.fillStyle = f; g.fill();
  g.beginPath(); g.ellipse(x - s * 0.38, y - s * 0.05, s * 0.18, s * 0.32, -0.3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
}
function tangle(g, cx, cy, turn) {   // a scrawled knot (crossness)
  g.save(); g.translate(cx, cy); g.rotate(turn); g.strokeStyle = INK; g.lineWidth = 10; g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 6, r = 34 + 16 * Math.sin(a * 1.66); const x = Math.cos(a) * r + Math.cos(a * 0.5) * 10, y = Math.sin(a) * r * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.restore();
}
function bulb(g, cx, cy) {
  const glow = g.createRadialGradient(cx, cy - 16, 4, cx, cy - 16, 60); glow.addColorStop(0, '#fff6b0'); glow.addColorStop(1, '#ffd23a');
  g.beginPath(); g.arc(cx, cy - 18, 40, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(cx + 18, cy + 30); g.lineTo(cx - 18, cy + 30); g.closePath();
  g.fillStyle = glow; g.fill(); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 10, cy + 28); g.lineTo(cx - 6, cy - 8); g.lineTo(cx, cy + 2); g.lineTo(cx + 6, cy - 8); g.lineTo(cx + 10, cy + 28); g.stroke();   // the filament
  g.fillStyle = '#4a4a50'; g.strokeStyle = INK; g.lineWidth = 6;
  for (const k of [0, 1]) { g.beginPath(); g.rect(cx - 19 + k * 3, cy + 32 + k * 13, 38 - k * 6, 12); g.fill(); g.stroke(); }
}

export function emoteTexture() {
  const c = document.createElement('canvas'); c.width = S * FRAMES; c.height = S; const g = c.getContext('2d');
  for (let k = 0; k < FRAMES; k++) {
    const o = k * S;
    g.save(); g.beginPath(); g.rect(o, 0, S, S); g.clip();
    if (k <= 2) { balloon(g, cloud, o); const h = [34, 52, 74][k]; z(g, o + 146 - h / 2, 134 - h / 2, h, h * 0.95); }
    else if (k === 3) { balloon(g, round, o); glyph(g, '?', o + 146, 122, 140); }
    else if (k === 4 || k === 5) {
      balloon(g, burst(144, 118, 11, 104, 74, 10), o);
      if (k === 4) { g.fillStyle = INK; g.beginPath(); g.moveTo(o + 128, 62); g.lineTo(o + 160, 62); g.lineTo(o + 151, 136); g.lineTo(o + 137, 136); g.closePath(); g.fill(); g.beginPath(); g.arc(o + 144, 160, 13, 0, Math.PI * 2); g.fill(); }
      else bulb(g, o + 144, 112);
    }
    else if (k <= 7) { balloon(g, thought, o); tangle(g, o + 148, 116, k === 6 ? 0 : 0.9); }
    else if (k <= 10) { balloon(g, square, o); g.save(); g.beginPath(); g.rect(o + 40, k === 8 ? 0 : 52, 200, 150); g.clip(); drop(g, o + 150, [48, 94, 134][k - 8], 26); g.restore(); }
    else { balloon(g, square, o); const n = k === 11 ? 2 : 4; g.fillStyle = INK; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(o + 142 + (i - (n - 1) / 2) * 34, 124, 11, 0, Math.PI * 2); g.fill(); } }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
