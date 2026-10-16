// Spell icons for the battle's 法術 ring [design, new to the remake: the original lists spells by name only; the user
// asked for the spell picker to match the item ring, icons only]. Each spell id gets a medallion drawn on a canvas: a
// gilt rim, a disc in its family's colour, and a pictograph (sword, blade, arrow, fist, flame, crystal, bolt, leaf,
// talisman, beast...). Gold pips on the rim mark a spell that strikes an area (one pair for area 1, two for area 2).
//   spellIcon(id, area) -> data URL (cached)
const cache = new Map();
const TAU = Math.PI * 2;

// the families: [disc colours (centre, edge), symbol, its options]
const FAM = {
  sword: [['#5a86c8', '#0e1e3e'], 'sword'], blade: [['#7a8aa8', '#1a1e2e'], 'blade'], arrow: [['#5aa860', '#0e2a12'], 'arrow'],
  wind: [['#4ab8b0', '#0a2a2a'], 'arrow'], fist: [['#c87a3a', '#3a1a08'], 'fist'], fire: [['#e8502a', '#3a0804'], 'flame'],
  ice: [['#58c8f0', '#082a40'], 'crystal'], bolt: [['#9a6af0', '#1a0a3a'], 'bolt'], light: [['#f0c850', '#3a2a04'], 'burst'],
  dark: [['#7a3a9a', '#12041e'], 'vortex'], heal: [['#5ac870', '#08300e'], 'leaf'], mana: [['#4a8af0', '#081a40'], 'drop'],
  heart: [['#f05a7a', '#3a0814'], 'heart'], lotus: [['#f0d890', '#3a2a10'], 'lotus'], soul: [['#f0e0a0', '#2a2410'], 'soul'],
  talisman: [['#e8b050', '#3a2208'], 'talisman'], guard: [['#e0b040', '#302004'], 'shield'], break: [['#a85a4a', '#2a0e08'], 'shield'],
  seal: [['#d03a3a', '#300606'], 'talisman'], sleep: [['#5a5ac8', '#0a0a30'], 'moon'], beast: [['#d8a040', '#2a1604'], 'beast'],
};
// spell id -> [family, variant]
const SPELL = {
  0: ['sword', 1], 1: ['sword', 'big'], 2: ['sword', 3], 3: ['sword', 'rays'],
  4: ['sword', 'up'], 5: ['blade', 'ring'], 6: ['sword', 'rainbow'], 7: ['sword', 'fury'],
  8: ['blade', 1], 9: ['blade', 'cross'], 10: ['blade', 'quake'], 11: ['blade', 'dragon'],
  12: ['arrow', 1], 13: ['arrow', 'glow'], 14: ['arrow', 3], 15: ['wind', 'storm'], 16: ['wind', 'swirl'], 17: ['wind', 2],
  18: ['fist', 1], 19: ['fist', 'qi'], 20: ['fist', 'quake'], 21: ['fist', 'dragon'],
  22: ['fire', 1], 23: ['fire', 3], 24: ['fire', 'inferno'], 25: ['fire', 'sky'],
  26: ['ice', 1], 27: ['ice', 'shard'], 28: ['ice', 'storm'], 29: ['ice', 'big'],
  30: ['bolt', 1], 31: ['bolt', 3], 32: ['bolt', 'sky'], 33: ['bolt', 'big'],
  34: ['light', 1], 35: ['light', 'big'], 36: ['dark', 1], 37: ['dark', 'big'],
  38: ['heal', 1], 39: ['mana', 1], 40: ['heal', 2], 41: ['heart', 1], 42: ['lotus', 1], 43: ['soul', 1],
  44: ['talisman', 'blood'], 45: ['talisman', 'clean'], 46: ['guard', 1], 47: ['guard', 2], 48: ['break', 1], 49: ['break', 2],
  50: ['seal', 'x'], 51: ['sleep', 1],
  52: ['beast', 'paw'], 53: ['beast', 'dragon'], 54: ['beast', 'claw'], 55: ['beast', 'feather'], 56: ['beast', 'horn'], 57: ['beast', 'antler'],
};

// ---------------------------------------------------------------- the pictographs (drawn round 0, 0, about ±40)
const light = g => { const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e8eef8'); return gr; };
function ink(g, path, fill) {   // a shape filled light with a dark outline
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  path(); g.strokeStyle = 'rgba(10,6,2,0.85)'; g.lineWidth = 7; g.stroke();
  path(); g.fillStyle = fill || light(g); g.fill(); g.restore();
}
function line(g, pts, w, col) { g.save(); g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.strokeStyle = 'rgba(10,6,2,0.85)'; g.lineWidth = w + 5; g.stroke(); g.strokeStyle = col || '#fff'; g.lineWidth = w; g.stroke(); g.restore(); }
function sword(g, s = 1) {
  g.save(); g.scale(s, s);
  ink(g, () => { g.beginPath(); g.moveTo(0, -42); g.lineTo(6, -32); g.lineTo(6, 14); g.lineTo(-6, 14); g.lineTo(-6, -32); g.closePath(); });
  ink(g, () => { g.beginPath(); g.roundRect(-16, 13, 32, 7, 3); }, '#f0c040');
  ink(g, () => { g.beginPath(); g.roundRect(-3.5, 20, 7, 16, 2); }, '#8a3a1a');
  ink(g, () => { g.beginPath(); g.arc(0, 39, 4.5, 0, TAU); }, '#f0c040');
  g.restore();
}
function blade(g) {   // a broad curved saber
  ink(g, () => { g.beginPath(); g.moveTo(-4, 14); g.quadraticCurveTo(-10, -18, 8, -42); g.quadraticCurveTo(16, -10, 8, 14); g.closePath(); });
  ink(g, () => { g.beginPath(); g.roundRect(-14, 12, 28, 7, 3); }, '#f0c040');
  ink(g, () => { g.beginPath(); g.roundRect(-3.5, 19, 7, 18, 2); }, '#5a2a10');
}
function arrow(g) {
  g.save(); g.rotate(Math.PI / 4);
  line(g, [[0, 34], [0, -26]], 5);
  ink(g, () => { g.beginPath(); g.moveTo(0, -42); g.lineTo(10, -24); g.lineTo(-10, -24); g.closePath(); });
  ink(g, () => { g.beginPath(); g.moveTo(0, 22); g.lineTo(9, 30); g.lineTo(9, 42); g.lineTo(0, 34); g.lineTo(-9, 42); g.lineTo(-9, 30); g.closePath(); }, '#f06a4a');
  g.restore();
}
function fist(g) {
  ink(g, () => { g.beginPath(); g.roundRect(-24, -20, 48, 34, 12); });
  ink(g, () => { g.beginPath(); g.roundRect(-30, -4, 18, 22, 8); });
  ink(g, () => { g.beginPath(); g.roundRect(-14, 12, 30, 22, 6); }, '#e8d0b0');
  g.save(); g.strokeStyle = 'rgba(60,30,10,0.8)'; g.lineWidth = 3; for (const x of [-8, 4, 16]) { g.beginPath(); g.moveTo(x, -20); g.lineTo(x, -6); g.stroke(); } g.restore();
}
function flame(g, s = 1) {
  g.save(); g.scale(s, s);
  const f = (h, w) => () => { g.beginPath(); g.moveTo(0, -h); g.bezierCurveTo(w * 0.6, -h * 0.5, w, -h * 0.1, w * 0.8, h * 0.45); g.bezierCurveTo(w * 0.6, h, -w * 0.6, h, -w * 0.8, h * 0.45); g.bezierCurveTo(-w, -h * 0.1, -w * 0.3, -h * 0.4, 0, -h); g.closePath(); };
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#ffb020'); gr.addColorStop(1, '#ff5010');
  ink(g, f(42, 30), gr); ink(g, () => { g.beginPath(); g.moveTo(0, -6); g.bezierCurveTo(10, 6, 14, 18, 0, 30); g.bezierCurveTo(-14, 18, -10, 6, 0, -6); g.closePath(); }, '#fffbe0');
  g.restore();
}
function crystal(g, s = 1) {
  g.save(); g.scale(s, s);
  for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * TAU / 6); line(g, [[0, 0], [0, -40]], 5, '#f0fbff'); line(g, [[0, -24], [9, -33]], 3.5, '#f0fbff'); line(g, [[0, -24], [-9, -33]], 3.5, '#f0fbff'); g.restore(); }
  ink(g, () => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g[k ? 'lineTo' : 'moveTo'](Math.sin(a) * 10, -Math.cos(a) * 10); } g.closePath(); }, '#c8f4ff');
  g.restore();
}
function bolt(g, s = 1) {
  g.save(); g.scale(s, s);
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#fff080');
  ink(g, () => { g.beginPath(); g.moveTo(8, -44); g.lineTo(-18, 4); g.lineTo(-2, 4); g.lineTo(-10, 44); g.lineTo(20, -8); g.lineTo(4, -8); g.closePath(); }, gr);
  g.restore();
}
function burst(g, s = 1) {
  g.save(); g.scale(s, s);
  const gr = g.createRadialGradient(0, 0, 2, 0, 0, 44); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffe080');
  ink(g, () => { g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, r = k % 2 ? 16 : 42; g[k ? 'lineTo' : 'moveTo'](Math.sin(a) * r, -Math.cos(a) * r); } g.closePath(); }, gr);
  g.restore();
}
function vortex(g, big) {
  g.save(); for (let k = 0; k < 3; k++) { g.rotate(TAU / 3); g.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const a = t * 4.2, r = 6 + t * 34; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.lineCap = 'round'; g.strokeStyle = 'rgba(10,0,20,0.9)'; g.lineWidth = 11; g.stroke(); g.strokeStyle = k ? '#d8a0ff' : '#ffffff'; g.lineWidth = 6; g.stroke(); }
  ink(g, () => { g.beginPath(); g.arc(0, 0, big ? 11 : 8, 0, TAU); }, '#1a0628'); g.restore();
}
function leaf(g) {
  const gr = g.createLinearGradient(-30, 30, 30, -30); gr.addColorStop(0, '#c8ffb0'); gr.addColorStop(1, '#ffffff');
  g.save(); g.rotate(0.6);
  ink(g, () => { g.beginPath(); g.moveTo(0, 42); g.bezierCurveTo(-34, 14, -26, -24, 0, -42); g.bezierCurveTo(26, -24, 34, 14, 0, 42); g.closePath(); }, gr);
  g.strokeStyle = 'rgba(30,110,40,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 38); g.lineTo(0, -34); for (let y = -20; y < 30; y += 12) { g.moveTo(0, y + 8); g.lineTo(14, y - 2); g.moveTo(0, y + 8); g.lineTo(-14, y - 2); } g.stroke();
  g.restore();
}
function drop(g) {
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#a8d8ff');
  ink(g, () => { g.beginPath(); g.moveTo(0, -42); g.bezierCurveTo(14, -18, 28, 0, 28, 14); g.arc(0, 14, 28, 0, Math.PI); g.bezierCurveTo(-28, 0, -14, -18, 0, -42); g.closePath(); }, gr);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-10, 12, 5, 9, 0.4, 0, TAU); g.fill();
}
function heart(g) {
  const gr = g.createLinearGradient(0, -30, 0, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffb8c8');
  ink(g, () => { g.beginPath(); g.moveTo(0, 38); g.bezierCurveTo(-46, 6, -34, -40, 0, -18); g.bezierCurveTo(34, -40, 46, 6, 0, 38); g.closePath(); }, gr);
}
function lotus(g) {
  const gr = g.createLinearGradient(0, -40, 0, 30); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffd0e0');
  for (const [a, s] of [[-1.1, 0.8], [1.1, 0.8], [-0.55, 0.92], [0.55, 0.92], [0, 1]]) { g.save(); g.translate(0, 20); g.rotate(a); g.scale(s, s);
    ink(g, () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-16, -20, -10, -46, 0, -56); g.bezierCurveTo(10, -46, 16, -20, 0, 0); g.closePath(); }, gr); g.restore(); }
  line(g, [[-30, 28], [30, 28]], 4, '#f0c040');
}
function soul(g) {
  g.save(); g.strokeStyle = 'rgba(10,6,2,0.8)'; g.lineWidth = 8; g.beginPath(); g.ellipse(0, -28, 22, 7, 0, 0, TAU); g.stroke(); g.strokeStyle = '#ffe070'; g.lineWidth = 4; g.stroke(); g.restore();
  flame(g, 0.75);
}
function talisman(g, v) {
  ink(g, () => { g.beginPath(); g.rect(-16, -40, 32, 80); }, '#f4dc90');
  g.save(); g.strokeStyle = '#b01a10'; g.lineWidth = 3.5; g.lineCap = 'round'; g.strokeRect(-11, -35, 22, 70);
  g.beginPath(); g.moveTo(-6, -26); g.lineTo(6, -26); g.moveTo(0, -30); g.lineTo(0, -14); g.moveTo(-6, -8); g.quadraticCurveTo(8, -2, -4, 6); g.quadraticCurveTo(10, 12, -2, 20); g.moveTo(-6, 26); g.lineTo(6, 26); g.stroke();
  if (v === 'x') { g.strokeStyle = 'rgba(10,6,2,0.85)'; g.lineWidth = 11; g.beginPath(); g.moveTo(-28, -28); g.lineTo(28, 28); g.moveTo(28, -28); g.lineTo(-28, 28); g.stroke(); g.strokeStyle = '#ff3a2a'; g.lineWidth = 6; g.stroke(); }
  if (v === 'blood') { g.fillStyle = '#e01a2a'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); }
  if (v === 'clean') { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.strokeStyle = '#80c8ff'; g.lineWidth = 2; g.stroke(); }
  g.restore();
}
function shield(g, broken) {
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#fff8d8'); gr.addColorStop(1, broken ? '#c8a8a0' : '#f0c040');
  ink(g, () => { g.beginPath(); g.moveTo(0, -40); g.lineTo(32, -28); g.quadraticCurveTo(32, 18, 0, 42); g.quadraticCurveTo(-32, 18, -32, -28); g.closePath(); }, gr);
  g.save(); g.strokeStyle = 'rgba(90,60,10,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 30); g.moveTo(-20, -8); g.lineTo(20, -8); g.stroke(); g.restore();
  if (broken) line(g, [[-6, -42], [6, -16], [-6, 2], [8, 22], [0, 44]], 4, '#300804');
}
function moon(g) {
  const gr = g.createLinearGradient(-20, -40, 20, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#fff0a0');
  ink(g, () => { g.beginPath(); g.arc(-4, 4, 32, 0.9, TAU - 0.9 + Math.PI * 0.0, false); g.arc(10, -4, 26, TAU - 1.2, 1.2, true); g.closePath(); }, gr);
  for (const [x, y, s] of [[22, -24, 1], [32, -38, 0.7]]) line(g, [[x - 7 * s, y - 7 * s], [x + 7 * s, y - 7 * s], [x - 7 * s, y + 7 * s], [x + 7 * s, y + 7 * s]], 3, '#ffffff');
}
function beast(g, v) {
  const gold = (() => { const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(1, '#ffd060'); return gr; })();
  if (v === 'paw') {
    ink(g, () => { g.beginPath(); g.ellipse(0, 14, 20, 17, 0, 0, TAU); }, gold);
    for (const [x, y, r] of [[-24, -10, 8], [-9, -26, 8.5], [9, -26, 8.5], [24, -10, 8]]) ink(g, () => { g.beginPath(); g.ellipse(x, y, r * 0.85, r, x / 60, 0, TAU); }, gold);
  } else if (v === 'claw') {
    for (const dx of [-16, 0, 16]) { g.save(); g.translate(dx, 0); ink(g, () => { g.beginPath(); g.moveTo(-6, -40); g.quadraticCurveTo(8, -6, 2, 40); g.quadraticCurveTo(0, -6, -6, -40); g.closePath(); }, gold); g.restore(); }
  } else if (v === 'feather') {
    g.save(); g.rotate(-0.5);
    const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.5, '#ff8a20'); gr.addColorStop(1, '#e02a10');
    ink(g, () => { g.beginPath(); g.moveTo(0, 44); g.bezierCurveTo(-24, 10, -20, -30, 0, -46); g.bezierCurveTo(22, -30, 24, 10, 0, 44); g.closePath(); }, gr);
    g.strokeStyle = 'rgba(80,20,0,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 44); g.lineTo(0, -38); for (let y = -26; y < 30; y += 9) { g.moveTo(0, y + 6); g.lineTo(13, y - 3); g.moveTo(0, y + 6); g.lineTo(-13, y - 3); } g.stroke(); g.restore();
  } else if (v === 'dragon') {   // a coiled dragon: an S body with horns and whiskers
    g.save(); g.beginPath(); g.moveTo(-26, 34); g.bezierCurveTo(30, 30, 30, 4, 0, 2); g.bezierCurveTo(-30, 0, -26, -26, 10, -28);
    g.lineCap = 'round'; g.strokeStyle = 'rgba(10,6,2,0.9)'; g.lineWidth = 17; g.stroke(); g.strokeStyle = '#7af0b0'; g.lineWidth = 11; g.stroke();
    g.strokeStyle = '#e8fff0'; g.lineWidth = 3; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]); g.restore();
    ink(g, () => { g.beginPath(); g.ellipse(18, -30, 12, 9, 0.2, 0, TAU); }, '#c8ffe0');
    line(g, [[22, -38], [30, -48]], 3, '#ffe070'); line(g, [[14, -38], [16, -50]], 3, '#ffe070'); line(g, [[28, -26], [42, -20]], 2.5, '#ffffff');
  } else if (v === 'horn') {   // 麒麟: a horn over a cloud scroll
    ink(g, () => { g.beginPath(); g.moveTo(-6, 8); g.quadraticCurveTo(-4, -26, 10, -44); g.quadraticCurveTo(8, -18, 10, 8); g.closePath(); }, gold);
    ink(g, () => { g.beginPath(); g.arc(-16, 22, 12, Math.PI, 0); g.arc(4, 18, 14, Math.PI, 0); g.arc(24, 24, 10, Math.PI, 0); g.lineTo(34, 30); g.lineTo(-28, 30); g.closePath(); }, '#ffffff');
  } else {   // 四不像: a pair of antlers
    for (const s of [-1, 1]) { g.save(); g.scale(s, 1); line(g, [[4, 34], [14, 6], [20, -18], [28, -42]], 5, '#fff0c8'); line(g, [[14, 6], [32, -2]], 4, '#fff0c8'); line(g, [[20, -18], [36, -24]], 4, '#fff0c8'); line(g, [[20, -18], [10, -36]], 4, '#fff0c8'); g.restore(); }
  }
}

function symbol(g, fam, v) {
  const s = FAM[fam][1];
  const many = (n, f, turn = 0.42) => { for (let i = 0; i < n; i++) { g.save(); g.translate(0, 30); g.rotate((i - (n - 1) / 2) * turn); g.translate(0, -30); f(); g.restore(); } };
  if (s === 'sword') {
    if (v === 3) many(3, () => sword(g, 0.72), 0.8);
    else if (v === 'big') sword(g, 1.15);
    else if (v === 'rays') { burst(g, 0.95); sword(g, 0.85); }
    else if (v === 'up') { line(g, [[-30, 30], [30, 30]], 3, '#9ad8ff'); sword(g, 0.95); }
    else if (v === 'rainbow') { g.save(); for (const [r, c] of [[38, '#ff6a6a'], [32, '#ffd060'], [26, '#7af0a0'], [20, '#7ab8ff']]) { g.beginPath(); g.arc(0, 30, r, Math.PI, 0); g.strokeStyle = c; g.lineWidth = 5; g.stroke(); } g.restore(); sword(g, 0.8); }
    else if (v === 'fury') { flame(g, 0.9); sword(g, 0.8); }
    else sword(g);
  } else if (s === 'blade') {
    if (v === 'cross') { g.save(); g.rotate(-0.6); blade(g); g.restore(); g.save(); g.rotate(0.6); g.scale(-1, 1); blade(g); g.restore(); }
    else if (v === 'ring') { g.save(); g.beginPath(); g.arc(0, 0, 36, 0, TAU); g.strokeStyle = '#ffe070'; g.lineWidth = 4; g.setLineDash([10, 6]); g.stroke(); g.restore(); blade(g); }
    else if (v === 'quake') { line(g, [[-36, 30], [-14, 22], [-4, 34], [10, 22], [36, 32]], 4, '#e0a060'); blade(g); }
    else if (v === 'dragon') { beast(g, 'dragon'); g.save(); g.scale(0.7, 0.7); blade(g); g.restore(); }
    else blade(g);
  } else if (s === 'arrow') {
    if (v === 3) for (const dx of [-16, 0, 16]) { g.save(); g.translate(dx, -dx * 0.3); g.scale(0.75, 0.75); arrow(g); g.restore(); }
    else if (v === 2) for (const dx of [-10, 10]) { g.save(); g.translate(dx, 0); g.scale(0.8, 0.8); arrow(g); g.restore(); }
    else { if (fam === 'wind' || v === 'glow') { g.save(); g.strokeStyle = fam === 'wind' ? '#c8fff4' : '#ffe070'; g.lineWidth = 4; g.lineCap = 'round'; for (const r of v === 'storm' ? [34, 24, 14] : [30, 20]) { g.beginPath(); g.arc(0, 0, r, 0.4, 3.6); g.stroke(); } g.restore(); } arrow(g); }
  } else if (s === 'fist') {
    if (v === 'qi') { burst(g, 0.95); g.save(); g.scale(0.75, 0.75); fist(g); g.restore(); }
    else if (v === 'quake') { line(g, [[-38, 34], [-16, 26], [-4, 38], [12, 26], [38, 36]], 4, '#e0a060'); g.save(); g.translate(0, -6); fist(g); g.restore(); }
    else if (v === 'dragon') { beast(g, 'dragon'); g.save(); g.scale(0.62, 0.62); g.translate(-10, 14); fist(g); g.restore(); }
    else fist(g);
  } else if (s === 'flame') {
    if (v === 3) for (const [dx, sc] of [[-18, 0.6], [18, 0.6], [0, 0.85]]) { g.save(); g.translate(dx, sc < 0.8 ? 10 : 0); flame(g, sc); g.restore(); }
    else if (v === 'inferno') { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.save(); g.translate(Math.sin(a) * 30, -Math.cos(a) * 30 + 4); flame(g, 0.28); g.restore(); } flame(g, 0.8); }
    else if (v === 'sky') { g.save(); g.translate(0, 8); flame(g, 0.85); g.restore(); for (const dx of [-26, 26]) { g.save(); g.translate(dx, -26); flame(g, 0.35); g.restore(); } }
    else flame(g);
  } else if (s === 'crystal') {
    if (v === 'shard') { crystal(g, 0.8); for (const [x, y] of [[-30, 26], [30, 26]]) { g.save(); g.translate(x, y); crystal(g, 0.25); g.restore(); } }
    else if (v === 'storm') { crystal(g, 0.7); for (const [x, y] of [[-30, -26], [30, -26], [-30, 28], [30, 28]]) { g.save(); g.translate(x, y); crystal(g, 0.22); g.restore(); } }
    else crystal(g, v === 'big' ? 1.1 : 0.95);
  } else if (s === 'bolt') {
    if (v === 3) for (const [dx, sc] of [[-20, 0.6], [20, 0.6], [0, 0.9]]) { g.save(); g.translate(dx, 0); bolt(g, sc); g.restore(); }
    else if (v === 'sky') { g.save(); g.fillStyle = 'rgba(230,230,255,0.9)'; for (const [x, r] of [[-18, 13], [0, 16], [18, 13]]) { g.beginPath(); g.arc(x, -30, r, 0, TAU); g.fill(); } g.restore(); g.save(); g.translate(0, 10); bolt(g, 0.75); g.restore(); }
    else bolt(g, v === 'big' ? 1.1 : 0.95);
  } else if (s === 'burst') burst(g, v === 'big' ? 1.1 : 0.85);
  else if (s === 'vortex') vortex(g, v === 'big');
  else if (s === 'leaf') { if (v === 2) { g.save(); g.translate(-12, 4); g.scale(0.75, 0.75); leaf(g); g.restore(); g.save(); g.translate(14, -4); g.scale(0.75, 0.75); leaf(g); g.restore(); } else leaf(g); }
  else if (s === 'drop') drop(g);
  else if (s === 'heart') heart(g);
  else if (s === 'lotus') lotus(g);
  else if (s === 'soul') soul(g);
  else if (s === 'talisman') talisman(g, v);
  else if (s === 'shield') { if (v === 2) { g.save(); g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.strokeStyle = fam === 'break' ? '#ff8a6a' : '#fff0a0'; g.lineWidth = 3; g.setLineDash([6, 5]); g.stroke(); g.restore(); g.save(); g.scale(0.82, 0.82); shield(g, fam === 'break'); g.restore(); } else shield(g, fam === 'break'); }
  else if (s === 'moon') moon(g);
  else if (s === 'beast') beast(g, v);
}

export function spellIcon(id, area) {
  const key = id + ':' + (area || 0);
  if (cache.has(key)) return cache.get(key);
  const [fam, v] = SPELL[id] || ['light', 1], [c0, c1] = FAM[fam][0];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  // the rim: dark edge, gilt band, an inner bead line
  g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fillStyle = '#1a1006'; g.fill();
  const rim = g.createLinearGradient(0, -60, 0, 60); rim.addColorStop(0, '#fff0b0'); rim.addColorStop(0.45, '#d8a038'); rim.addColorStop(1, '#7a4a10');
  g.beginPath(); g.arc(0, 0, 59, 0, TAU); g.fillStyle = rim; g.fill();
  // the disc: its family's colour, lit from above, with a faint ring of cloud scrolls
  const disc = g.createRadialGradient(-12, -18, 4, 0, 0, 54); disc.addColorStop(0, c0); disc.addColorStop(1, c1);
  g.beginPath(); g.arc(0, 0, 51, 0, TAU); g.fillStyle = disc; g.fill();
  g.save(); g.globalAlpha = 0.16; g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let k = 0; k < 8; k++) { g.save(); g.rotate(k * TAU / 8); g.beginPath(); g.arc(0, -44, 5, Math.PI * 0.2, Math.PI * 1.6); g.stroke(); g.restore(); } g.restore();
  g.beginPath(); g.arc(0, 0, 51, 0, TAU); g.strokeStyle = 'rgba(255,240,190,0.55)'; g.lineWidth = 1.5; g.stroke();
  // a soft glow behind the pictograph, then the pictograph
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 44); glow.addColorStop(0, 'rgba(255,255,255,0.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill();
  g.save(); g.scale(0.92, 0.92); symbol(g, fam, v); g.restore();
  // area pips on the rim
  const pips = area >= 2 ? [-0.5, 0.5, Math.PI - 0.5, Math.PI + 0.5] : area === 1 ? [Math.PI / 2 - 0.0, -Math.PI / 2] : [];
  for (const a of pips) { const x = Math.cos(a) * 55, y = Math.sin(a) * 55; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fillStyle = '#fff6c8'; g.fill(); g.strokeStyle = '#5a3008'; g.lineWidth = 1.5; g.stroke(); }
  // the glaze: a highlight over the top half
  const gl = g.createLinearGradient(0, -58, 0, 10); gl.addColorStop(0, 'rgba(255,255,255,0.32)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.beginPath(); g.ellipse(0, -24, 44, 30, 0, Math.PI, 0); g.fillStyle = gl; g.fill();
  const url = c.toDataURL('image/png'); cache.set(key, url); return url;
}
