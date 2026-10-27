// 女媧's temple in heaven (map 004fb4), remade: celestial jade tiles, a blue carpet with a mandala inlaid in gold, the
// tiered altar with a green-jade statue of 女媧 in a golden halo between her 童子 and 童女, offerings; lacquer columns and
// lattice under swagged gold valances, curtains tied back; six cold lacquered cauldrons; the floor ends in
// a marble balustrade over a sea of clouds.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { Levels, mats, box, pillar, latticeWall, curtain, stairs, shade, merged } from '../kit/parts.js';
import { craneBird, flap } from './title.js';
import { darken } from '../cutfx.js';

const UP = 0.2;
function levels() { const L = new Levels(8, 10, 4); L.set(0, 1.8, 8, 4.6, UP).set(0, 4.6, 8, 9.1, 0); L.stairs(0, 4.4, 8, 4.8, 0, UP, 2, 's'); return L; }
const LV = levels();

function disc(draw, n = 1024) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// the mandala: concentric rings of lotus petals and key-fret, gold on the blue
function mandalaTex() {
  return disc((g, n) => {
    const c = n / 2; g.translate(c, c); g.strokeStyle = '#e8c870'; g.fillStyle = '#e8c870';
    for (const [r, w] of [[0.49, 5], [0.46, 2], [0.33, 3], [0.3, 1.5], [0.15, 3]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r * n, 0, 7); g.stroke(); }
    for (let k = 0; k < 24; k++) { g.save(); g.rotate(k * Math.PI / 12); g.beginPath(); g.ellipse(0, -0.395 * n, 0.03 * n, 0.06 * n, 0, 0, 7); g.lineWidth = 2.5; g.stroke(); g.restore(); }
    for (let k = 0; k < 12; k++) { g.save(); g.rotate(k * Math.PI / 6 + 0.26); g.beginPath(); g.moveTo(0, -0.16 * n); g.quadraticCurveTo(0.06 * n, -0.23 * n, 0, -0.29 * n); g.quadraticCurveTo(-0.06 * n, -0.23 * n, 0, -0.16 * n); g.fill(); g.restore(); }
    g.beginPath(); g.arc(0, 0, 0.06 * n, 0, 7); g.fill();
  });
}
function haloTex() {
  return disc((g, n) => {
    const c = n / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.55, 'rgba(255,236,180,0.95)'); gr.addColorStop(0.62, 'rgba(255,210,120,1)'); gr.addColorStop(0.66, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(220,160,60,0.9)'; g.lineWidth = n * 0.008; for (let k = 0; k < 32; k++) { const a = k * Math.PI / 16; g.beginPath(); g.moveTo(c + Math.cos(a) * n * 0.33, c + Math.sin(a) * n * 0.33); g.lineTo(c + Math.cos(a) * n * 0.45, c + Math.sin(a) * n * 0.45); g.stroke(); }
  }, 512);
}
// the statues, carved in white marble [the user's choice; the original's are green jade], edged in gold so their
// forms read from afar.
// 女媧 sits cross-legged on her lotus as in the original: her robe draped over the petals, long sleeves hanging from the
// elbows to either side, hands joined at the lap round the five-coloured stone she mended the sky with (五色石,
// glowing); a high chignon of two upright buns with a gilt diadem and hairpins; her celestial shawl (披帛) swung out
// in a loop at each shoulder and trailing down past the lotus. s: scale (seated, about 0.62 s high)
const band = (curve, w0, w1, n = 64) => {   // a flat strip of silk along a curve, its width turned to face the viewer
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, p0 = curve.getPointAt(u), tg = curve.getTangentAt(u), sd = new THREE.Vector3(0, 0, 1).cross(tg).normalize().multiplyScalar(w0 + (w1 - w0) * u);
    pos.push(p0.x - sd.x, p0.y - sd.y, p0.z - sd.z, p0.x + sd.x, p0.y + sd.y, p0.z + sd.z); uv.push(u * 4, 0, u * 4, 0.15);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
function maker(mat, s) {
  const g = new THREE.Group(), V = (x, y, z) => new THREE.Vector3(x * s, y * s, z * s);
  const add = (geo, m = mat, at = [0, 0, 0], sc = [1, 1, 1], rot = [0, 0, 0]) => { const o = shade(new THREE.Mesh(geo, m)); o.position.copy(V(...at)); o.scale.set(...sc); o.rotation.set(...rot); g.add(o); return o; };
  const lathe = (pts, n = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * s, y * s)), n);
  const tube = (pts, r, m = mat) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 20, r * s, 10), m);
  const pleat = (geo, top, depth, folds) => {   // folds deepening towards the hem
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue; const down = Math.max(0, 1 - P.getY(i) / s / top), k = 1 + depth * Math.cos(Math.atan2(z, x) * folds) * down * down; P.setXYZ(i, x * k, P.getY(i), z * k); }
    geo.computeVertexNormals(); return geo;
  };
  return { g, V, add, lathe, tube, pleat };
}
function statue(mat, gold, stone, s) {
  const { g, V, add, lathe, tube, pleat } = maker(mat, s), silk = mat.clone(); silk.side = THREE.DoubleSide;
  // the crossed legs under the robe, the robe's hem falling over the lotus's front in folds
  add(new THREE.SphereGeometry(0.1 * s, 32, 16), mat, [0, 0.06, 0.02], [2.05, 0.6, 1.25]);
  const drape = new THREE.CylinderGeometry(0.2 * s, 0.24 * s, 0.13 * s, 48, 4, true, -Math.PI * 0.55, Math.PI * 1.1), P = drape.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(x, z), down = 0.5 - P.getY(i) / (0.13 * s), k = 1 + 0.06 * Math.cos(a * 14) * down; P.setXYZ(i, x * k, P.getY(i), z * k); }
  drape.computeVertexNormals(); add(drape, silk, [0, 0.0, 0.02]);
  add(new THREE.TorusGeometry(0.235 * s, 0.006 * s, 6, 48, Math.PI * 1.1), gold, [0, -0.062, 0.02], [1, 1, 1], [Math.PI / 2, 0, Math.PI * 0.45]);   // its gilt hem
  // the body: slim, upright, smooth shoulders; crossed lapels edged in gold, a sash, a beaded necklace (瓔珞)
  add(pleat(lathe([[0, 0.08], [0.1, 0.08], [0.094, 0.15], [0.08, 0.24], [0.086, 0.3], [0.078, 0.345], [0.045, 0.378], [0, 0.383]], 48), 0.2, 0.04, 10));
  add(new THREE.SphereGeometry(0.1 * s, 24, 12), mat, [0, 0.345, 0], [1.15, 0.38, 0.62]);
  add(new THREE.TorusGeometry(0.095 * s, 0.01 * s, 8, 40), gold, [0, 0.13, 0], [1, 1, 0.8], [Math.PI / 2, 0, 0]);
  for (const sd of [-1, 1]) {
    const lap = new THREE.CatmullRomCurve3([V(sd * 0.06, 0.37, 0.02), V(sd * 0.035, 0.3, 0.07), V(-sd * 0.01, 0.22, 0.08), V(-sd * 0.04, 0.14, 0.07)]);
    add(new THREE.TubeGeometry(lap, 24, 0.007 * s, 6), gold);
  }
  const neck = new THREE.CatmullRomCurve3([V(-0.07, 0.35, 0.03), V(-0.04, 0.29, 0.075), V(0, 0.265, 0.085), V(0.04, 0.29, 0.075), V(0.07, 0.35, 0.03)]);
  for (let k = 0; k <= 16; k++) add(new THREE.SphereGeometry(0.008 * s, 8, 6), gold, neck.getPointAt(k / 16).divideScalar(s).toArray());
  add(new THREE.SphereGeometry(0.014 * s, 10, 8), gold, [0, 0.25, 0.088], [1, 1.4, 0.7]);   // its pendant
  for (const sd of [-1, 1]) {
    // the wide sleeve, falling from the shoulder to the lap in one drape, flattened, a gilt cuff; the forearm and hand out of it to the front
    add(new THREE.CylinderGeometry(0.048 * s, 0.115 * s, 0.33 * s, 28, 1, true), silk, [sd * 0.16, 0.18, 0.04], [1, 1, 0.55], [0.12, 0, sd * 0.3]);
    add(new THREE.TorusGeometry(0.115 * s, 0.006 * s, 6, 32), gold, [sd * 0.207, 0.022, 0.06], [1, 0.55, 1], [Math.PI / 2 + 0.12, 0, sd * 0.3]);
    tube([[sd * 0.14, 0.2, 0.06], [sd * 0.08, 0.19, 0.11], [sd * 0.03, 0.2, 0.13]], 0.026);
  }
  add(new THREE.SphereGeometry(0.03 * s, 14, 10), mat, [0, 0.19, 0.14], [1.3, 0.9, 0.9]);                                   // hands joined
  add(new THREE.IcosahedronGeometry(0.035 * s, 0), stone, [0, 0.235, 0.15]);                                                 // the five-coloured stone
  add(new THREE.CylinderGeometry(0.024 * s, 0.028 * s, 0.045 * s, 12), mat, [0, 0.405, 0]);                                // neck
  add(new THREE.SphereGeometry(0.058 * s, 24, 18), mat, [0, 0.465, 0.005], [0.9, 1.1, 0.95]);                               // head
  add(new THREE.SphereGeometry(0.061 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mat, [0, 0.47, -0.006], [0.96, 1.1, 1]);   // hair, swept up
  add(new THREE.SphereGeometry(0.04 * s, 16, 12), mat, [0, 0.545, -0.012], [1, 0.9, 1]);                                     // the chignon's root
  for (const sd of [-1, 1]) { add(new THREE.SphereGeometry(0.034 * s, 16, 12), mat, [sd * 0.036, 0.6, -0.02], [0.7, 1.35, 0.8], [0, 0, sd * 0.3]); add(new THREE.TorusGeometry(0.024 * s, 0.005 * s, 6, 16), gold, [sd * 0.03, 0.575, -0.02], [1, 1, 1], [Math.PI / 2, 0, sd * 0.3]); }   // its two upright buns, bound in gold
  add(new THREE.TorusGeometry(0.056 * s, 0.008 * s, 8, 32, Math.PI), gold, [0, 0.505, 0.006], [1, 1, 1], [-0.3, 0, 0]);       // diadem
  add(new THREE.ConeGeometry(0.02 * s, 0.05 * s, 4), gold, [0, 0.555, 0.04], [1, 1, 0.4], [0.3, 0, 0]);                       // its jewel, a flame
  for (const sd of [-1, 1]) { add(new THREE.CylinderGeometry(0.004 * s, 0.004 * s, 0.13 * s, 6), gold, [sd * 0.03, 0.56, 0.0], [1, 1, 1], [0, 0, sd * 1.1]); add(new THREE.SphereGeometry(0.009 * s, 8, 6), gold, [sd * 0.088, 0.53, 0.0]); }   // hairpins
  // the shawl: from behind the neck over each shoulder, out in a loop, in by the sleeve and down past the lotus
  for (const sd of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([V(0, 0.37, -0.05), V(sd * 0.11, 0.39, -0.03), V(sd * 0.26, 0.46, -0.01), V(sd * 0.33, 0.34, 0.02), V(sd * 0.27, 0.2, 0.06), V(sd * 0.26, 0.04, 0.09), V(sd * 0.33, -0.08, 0.08), V(sd * 0.4, -0.14, 0.05)]);
    add(band(c, 0.02 * s, 0.03 * s), silk);
    const e = new THREE.CatmullRomCurve3(c.getPoints(40).map(p => p.clone().add(new THREE.Vector3(0, 0, 0.003))));
    add(new THREE.TubeGeometry(e, 64, 0.003 * s, 4), gold);   // its gilt edge
  }
  return g;
}
// her two attendants, carved as children in the same marble (a big head on a short body), not robed like grown-ups:
// the 童子 (boy) on the left, his crown shaved but for two little knobs of hair (總角) and a forelock, a straight
// knee-length tunic tied at the side with a sash, loose trousers gathered at the ankle, a horsetail whisk (拂塵) held
// across his joined hands; the 童女 (girl) on the right, twin buns high on her head with ribbons trailing to her
// shoulders, a fringe, a long pleated skirt, a dish of peaches held up in both hands. s: height; kind: 'boy' | 'girl'
function child(mat, gold, s, kind) {
  const { g, V, add, lathe, tube, pleat } = maker(mat, s), boy = kind === 'boy', hy = 0.78, hr = 0.12;
  if (boy) {
    for (const sd of [-1, 1]) {
      add(lathe([[0, 0.03], [0.04, 0.03], [0.048, 0.06], [0.056, 0.12], [0.058, 0.22], [0, 0.22]], 24), mat, [sd * 0.062, 0, 0]);   // trouser leg below the tunic
      add(new THREE.TorusGeometry(0.041 * s, 0.008 * s, 6, 20), gold, [sd * 0.062, 0.05, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);          // gathered at the ankle
      add(new THREE.SphereGeometry(0.038 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat, [sd * 0.068, 0, 0.02], [0.9, 0.8, 1.5], [0, sd * 0.2, 0]);   // shoe
    }
    add(pleat(lathe([[0, 0.19], [0.128, 0.19], [0.132, 0.21], [0.126, 0.32], [0.12, 0.46], [0.114, 0.56], [0.066, 0.625], [0, 0.63]], 48), 0.4, 0.03, 8));   // the tunic, straight
    add(new THREE.TorusGeometry(0.13 * s, 0.006 * s, 6, 40), gold, [0, 0.192, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);                       // its gilt hem
    add(new THREE.SphereGeometry(0.03 * s, 12, 10), mat, [0.09, 0.42, 0.08]);                                                             // the sash's knot, at the side
    for (const [dx, rz] of [[0.085, 0.15], [0.105, -0.1]]) add(new THREE.BoxGeometry(0.028 * s, 0.17 * s, 0.01 * s), mat, [dx, 0.33, 0.1], [1, 1, 1], [-0.1, 0.5, rz]);
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.026 * s, 0.17 * s, 0.012 * s), gold, [sd * 0.034, 0.56, 0.108], [1, 1, 1], [-0.35, 0, sd * 0.62]);   // the crossed collar, gilt
  } else {
    add(pleat(lathe([[0, 0], [0.16, 0], [0.172, 0.02], [0.16, 0.08], [0.138, 0.24], [0.12, 0.4], [0.112, 0.48], [0, 0.49]], 96), 0.48, 0.07, 14));   // skirt
    add(new THREE.TorusGeometry(0.168 * s, 0.006 * s, 6, 48), gold, [0, 0.012, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);                        // its gilt hem
    add(lathe([[0, 0.47], [0.112, 0.47], [0.108, 0.54], [0.098, 0.6], [0.058, 0.635], [0, 0.64]]));                                          // bodice
    add(new THREE.TorusGeometry(0.114 * s, 0.011 * s, 8, 40), gold, [0, 0.48, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);                         // sash
  }
  for (const sd of [-1, 1]) {   // shoulders and arms bent to the front; short wide sleeves
    add(new THREE.SphereGeometry(0.052 * s, 16, 12), mat, [sd * 0.098, 0.59, 0], [1, 0.75, 0.9]);
    const hand = boy ? [sd * 0.02, 0.5, 0.15] : [sd * 0.05, 0.53, 0.15];
    tube([[sd * 0.105, 0.59, 0], [sd * 0.14, 0.52, 0.03], [sd * 0.09, 0.49, 0.1], hand], 0.034);
    add(new THREE.CylinderGeometry(0.038 * s, 0.07 * s, 0.13 * s, 20, 1, true), mat, [sd * 0.12, 0.47, 0.09], [1, 1, 0.6], [0.2, 0, sd * 0.45]);
    add(new THREE.TorusGeometry(0.07 * s, 0.005 * s, 6, 24), gold, [sd * 0.135, 0.41, 0.1], [1, 0.6, 1], [Math.PI / 2 + 0.2, 0, sd * 0.45]);
  }
  if (boy) {
    add(new THREE.SphereGeometry(0.034 * s, 14, 10), mat, [0, 0.5, 0.155], [1.25, 1, 0.85]);                                                // hands joined
    add(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.2 * s, 8), gold, [0.0, 0.53, 0.17], [1, 1, 1], [0.3, 0, -0.7]);                    // the whisk's handle
    tube([[0.07, 0.6, 0.2], [0.13, 0.6, 0.19], [0.17, 0.52, 0.16], [0.18, 0.4, 0.14]], 0.02);                                                // its horsetail, over his arm
  } else {
    add(new THREE.CylinderGeometry(0.085 * s, 0.06 * s, 0.018 * s, 24), gold, [0, 0.55, 0.17]);                                             // the dish of peaches
    const peach = new THREE.MeshStandardMaterial({ color: 0xf0a060, roughness: 0.55, emissive: 0x401808 });
    for (const [x, z] of [[-0.032, 0.16], [0.032, 0.16], [0, 0.195]]) add(new THREE.SphereGeometry(0.028 * s, 12, 8), peach, [x, 0.578, z], [1, 1.1, 1]);
  }
  add(new THREE.CylinderGeometry(0.03 * s, 0.034 * s, 0.05 * s, 12), mat, [0, 0.655, 0]);   // neck
  add(new THREE.SphereGeometry(hr * s, 28, 20), mat, [0, hy, 0.005], [0.96, 1.0, 0.96]);     // the round head of a child
  for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.02 * s, 10, 8), mat, [sd * hr * 0.95, hy - 0.01, 0.0], [0.5, 1, 0.8]);   // ears
  if (boy) {
    for (const sd of [-1, 1]) {   // two little knobs of hair on the crown (總角), bound in gold
      add(new THREE.SphereGeometry(0.03 * s, 14, 10), mat, [sd * 0.04, hy + hr * 0.97, 0.01]);
      add(new THREE.TorusGeometry(0.022 * s, 0.006 * s, 6, 16), gold, [sd * 0.037, hy + hr * 0.86, 0.01], [1, 1, 1], [Math.PI / 2, 0, -sd * 0.3]);
    }
    add(new THREE.SphereGeometry(0.038 * s, 12, 8), mat, [0, hy + hr * 0.7, hr * 0.72], [1.1, 0.5, 0.55], [-0.6, 0, 0]);   // the forelock
  } else {
    add(new THREE.SphereGeometry((hr + 0.006) * s, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, [0, hy + 0.002, -0.006], [1, 1.02, 1]);   // hair
    add(new THREE.SphereGeometry(0.058 * s, 16, 10, 0, Math.PI, 0, Math.PI / 2), mat, [0, hy + hr * 0.6, hr * 0.55], [1.25, 0.6, 0.7], [-0.4, 0, 0]);   // fringe
    for (const sd of [-1, 1]) {
      add(new THREE.SphereGeometry(0.048 * s, 16, 12), mat, [sd * 0.125, hy + 0.035, -0.02], [0.9, 1, 1]);                              // twin buns at the sides
      add(new THREE.TorusGeometry(0.04 * s, 0.008 * s, 6, 24), gold, [sd * 0.105, hy + 0.035, -0.02], [1, 1, 1], [0, Math.PI / 2, 0]);   // tied with gold
      add(band(new THREE.CatmullRomCurve3([V(sd * 0.14, hy + 0.01, -0.03), V(sd * 0.16, hy - 0.07, -0.04), V(sd * 0.15, hy - 0.16, -0.03)]), 0.012 * s, 0.016 * s, 16), gold);   // ribbons
    }
  }
  return g;
}
// a lotus throne in gilt: a drum ringed by two tiers of upturned petals; r: radius
function lotus(gold, r, h) {
  const g = new THREE.Group();
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.9, h, 32), gold)));
  for (const [tier, n, rr, y, tilt] of [[0, 16, 1, -0.1, 0.5], [1, 16, 0.86, 0.3, 0.75]]) for (let k = 0; k < n; k++) {
    const a = (k + tier * 0.5) / n * Math.PI * 2, p = shade(new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 12, 8), gold));
    p.scale.set(0.8, 1.3, 0.35); p.position.set(Math.cos(a) * r * rr, y * h, Math.sin(a) * r * rr); p.rotation.set(0, -a + Math.PI / 2, 0); p.rotateX(-tilt); g.add(p);
  }
  return g;
}
// the braziers, after the original's: a purple cauldron, a low round belly with a band of key-fret, a wide flaring
// mouth gilt at the lip (cold: dark ash inside, no fire), on three cabriole legs that curl out at the foot, with two
// upright loop handles; s: size
function cauldron(body, gold, x, z, y, s) {
  const g = new THREE.Group(), L = (pts, m, n = 48) => shade(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r * s, h * s)), n), m));
  const b = 0.2;   // the belly's foot, above the floor
  g.add(L([[0, b], [0.2, b + 0.005], [0.3, b + 0.05], [0.35, b + 0.13], [0.34, b + 0.22], [0.29, b + 0.28], [0.27, b + 0.31], [0.33, b + 0.39], [0.42, b + 0.45], [0.44, b + 0.47]], body));
  g.add(L([[0.41, b + 0.47], [0.31, b + 0.4], [0.24, b + 0.33], [0.05, b + 0.3], [0, b + 0.3]], T.material(T.bronze(), { color: new THREE.Color(0.45, 0.32, 0.28), side: THREE.DoubleSide })));   // inside: dark, sooted bronze
  g.add(L([[0.415, b + 0.452], [0.445, b + 0.466], [0.45, b + 0.48], [0.42, b + 0.482], [0.405, b + 0.468]], gold, 64));   // the gilt lip
  g.add(L([[0.27, b + 0.295], [0.28, b + 0.31], [0.295, b + 0.33], [0.28, b + 0.335], [0.265, b + 0.31]], gold));     // the neck ring
  // the band of key-fret round the belly: small gilt blocks in a meander
  const fret = [];
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2, r = 0.352 * s;
    for (const [dy, w, h] of [[0.0, 0.05, 0.012], [0.03, 0.012, 0.04], [0.06, 0.05, 0.012]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, 0.012 * s), gold); m.position.set(Math.cos(a) * r, (b + 0.14 + dy) * s, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; fret.push(m);
    }
  }
  g.add(merged(gold, fret));
  // the ash: a low grey-brown mound, a few incense stubs standing in it
  const ash = shade(new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 32, 8, 0, Math.PI * 2, 0, 0.5), T.material(T.dirt(0x4e4038, 'ash'), { roughness: 1 })), false);
  ash.scale.y = 0.25; ash.position.y = (b + 0.28) * s; g.add(ash);
  const stick = new THREE.MeshStandardMaterial({ color: 0x8a2a18, roughness: 0.8 });
  for (const [dx, dz, h] of [[-0.05, 0.02, 0.1], [0.02, -0.04, 0.13], [0.06, 0.05, 0.08]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, h * s, 6), stick); m.position.set(dx * s, (b + 0.33 + h / 2) * s, dz * s); g.add(m); }
  for (let k = 0; k < 3; k++) {   // legs: out from under the belly, down, and curled out at the foot
    const a = k * Math.PI * 2 / 3 + Math.PI / 2, d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), at = (r, h) => d.clone().multiplyScalar(r * s).setY(h * s);
    const c = new THREE.CatmullRomCurve3([at(0.22, b + 0.08), at(0.3, b - 0.02), at(0.27, 0.1), at(0.28, 0.03), at(0.34, 0.02), at(0.37, 0.06)]);
    g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.045 * s, 10), body)));
    const knee = shade(new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 12, 8), gold)); knee.position.copy(at(0.29, b - 0.01)); g.add(knee);
  }
  for (const sx of [-1, 1]) {   // upright handles on the lip
    const h = shade(new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.018 * s, 8, 20, Math.PI), gold)); h.position.set(sx * 0.43 * s, (b + 0.47) * s, 0); h.rotation.y = Math.PI / 2; g.add(h);
  }
  g.position.set(x, y, z); return g;
}

async function build(E, FX) {
  const S = E.world.scene, M = mats({ lacquer: 0xb8201a, silk: 0xf2aa1e });
  const tiles = T.material(T.weave(0xbcdcc0, 8), { envMapIntensity: 0.7 }, [0.7, 0.7]);
  const marbleM = T.material(T.marble(0xf4eef4, 0x9a8ab8, 1), { envMapIntensity: 0.8 }, [0.5, 0.5]);
  S.add(LV.mesh(tiles, marbleM, -1.4, 0.5));
  for (const r of LV.ramps) S.add(stairs(r, marbleM, marbleM, 0.5));
  // the carpet and its mandala
  const rugM = T.material(T.carpet(0x1a3684), {});
  for (const [z0, z1] of [[2.0, 4.4], [4.8, 9.05]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, z1 - z0).rotateX(-Math.PI / 2), rugM.clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m.material[k] = rugM[k].clone(); m.material[k].repeat.set(1, (z1 - z0) / 2.4); m.material[k].needsUpdate = true; }
    m.position.set(4, LV.at(4, (z0 + z1) / 2) + 0.012, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
  }
  const mt = mandalaTex(), md = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mt, transparent: true, depthWrite: false, emissiveMap: mt, emissive: new THREE.Color(1, 0.8, 0.45), emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
  md.position.set(4, 0.03, 6.6); md.receiveShadow = true; S.add(md);
  FX.glow(E, { x: 4.25, y: 5.4, r: 2.0, col: 0xfff0c0, i: 1.2 });
  // the back: lacquer columns, lattice bays, swagged valances, curtains tied back to the sides
  S.add(latticeWall(M, 0, 8, 1.75, UP, 3.0, 4));
  for (const x of [0.2, 2.55, 5.45, 7.8]) S.add(pillar(M, x, 1.95, UP, 3.0, 0.2));
  for (let k = 0; k < 4; k++) {   // valance swags: a draped arc of silk between columns
    const x0 = k * 2, w = 2, geo = new THREE.PlaneGeometry(w, 0.6, 24, 6), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + w / 2) / w, v = (p.getY(i) + 0.3) / 0.6, sag = Math.sin(u * Math.PI) * 0.35 * (1 - v * 0.6); p.setXYZ(i, x0 + u * w, UP + 3.0 - (1 - v) * 0.5 - sag, 2.0 + Math.sin(u * Math.PI) * 0.12 + Math.sin(u * 30) * 0.015); }
    geo.computeVertexNormals(); S.add(shade(new THREE.Mesh(geo, M.silk)));
  }
  S.add(curtain(M, 0.3, 1.6, 2.15, UP + 3.0, 2.9, 'l', 4), curtain(M, 6.4, 7.7, 2.15, UP + 3.0, 2.9, 'r', 4));
  // the altar: a tiered marble table, the red altar cloth, offerings; the statue in its halo on a lotus plinth
  const alt = new THREE.Group(), y0 = UP;
  alt.add(box(marbleM, 2.6, y0, 1.85, 5.4, y0 + 0.28, 3.05), box(M.gold, 2.58, y0 + 0.28, 1.83, 5.42, y0 + 0.31, 3.07));
  alt.add(box(marbleM, 3.4, y0 + 0.31, 1.85, 4.6, y0 + 0.55, 2.6), box(M.gold, 3.38, y0 + 0.55, 1.83, 4.62, y0 + 0.58, 2.62));
  const cloth = T.material(T.silk(0xc81818), { sheen: 1, sheenColor: new THREE.Color(1, 0.5, 0.4), side: THREE.DoubleSide });
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), cloth); cl.position.set(4, y0 + 0.06 + 0.25 - 0.02, 3.06); alt.add(cl);
  alt.add(box(M.gold, 3.55, y0 + 0.04, 3.065, 4.45, y0 + 0.08, 3.075));
  const jadeG = T.material(T.marble(0xf7f4ee, 0xbab2aa, 2), { clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.6 }, [0.5, 0.5]);   // white marble [the user's choice; the original's are green]
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.1, flatShading: true, toneMapped: false });
  stone.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor;'); };
  const throne = lotus(M.gold, 0.3, 0.14); throne.position.set(4, y0 + 0.65, 2.2); alt.add(throne);
  const st = statue(jadeG, M.gold, stone, 1.3); st.position.set(4, y0 + 0.78, 2.2); alt.add(st);
  st.traverse(o => { if (o.isMesh && o.material === stone) { const c = [], P = o.geometry.toNonIndexed(); for (let i = 0; i < P.attributes.position.count; i++) c.push(...[[1, 0.3, 0.2], [1, 0.85, 0.3], [0.3, 0.9, 0.5], [0.35, 0.55, 1], [0.95, 0.95, 1]][Math.floor(i / 3) % 5]); P.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); o.geometry = P; } });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.4, 1.25, 1.0) }));
  halo.position.set(4, y0 + 1.45, 1.95); alt.add(halo);
  for (const [x, kind] of [[3.05, 'boy'], [4.95, 'girl']]) {   // 童子 and 童女
    const t = lotus(M.gold, 0.2, 0.08); t.position.set(x, y0 + 0.35, 2.25); alt.add(t);
    const a = child(jadeG, M.gold, 0.8, kind); a.position.set(x, y0 + 0.39, 2.25); a.rotation.y = (x < 4 ? 0.3 : -0.3); alt.add(a);
  }
  const peach = new THREE.MeshStandardMaterial({ color: 0xf09a50, roughness: 0.6, emissive: 0x401808 });
  for (const [x, z] of [[3.5, 2.75], [3.65, 2.8], [3.58, 2.68]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), peach); p.position.set(x, y0 + 0.36, z); alt.add(p); }
  const porc = T.material(T.jade(0xf4f6ff), { clearcoat: 1 });
  for (const x of [4.35, 4.6]) { const v = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.08, 0.06], [0.05, 0.14], [0.025, 0.2], [0.04, 0.24], [0, 0.24]].map(([a, b]) => new THREE.Vector2(a, b)), 20), porc); v.position.set(x, y0 + 0.31, 2.8); alt.add(v); }
  S.add(shade(alt));
  // the braziers: purple cauldrons (the two by the door in red lacquer), cold as in the original
  const purple = T.material(T.lacquer(0x6a4aa8, 'heavenPurple'), { clearcoat: 0.8 }), red = T.material(T.lacquer(0xb0201a, 'heavenRed'), { clearcoat: 0.8 });
  for (const [x, z, body] of [[2.25, 2.55, purple], [5.75, 2.55, purple], [0.55, 3.6, purple], [7.45, 3.6, purple], [0.55, 6.7, red], [7.45, 6.7, red]])
    S.add(cauldron(body, M.gold, x, z, LV.at(x, z), 1.0));
  // the balustrade at the floor's front edge, over the clouds
  const posts = [];
  for (let x = 0; x <= 8.001; x += 0.5) posts.push(box(marbleM, x - 0.06, 0, 9.0, x + 0.06, 0.48, 9.12));
  for (const x of [0.06, 7.94]) for (let z = 4.8; z < 9; z += 0.5) posts.push(box(marbleM, x - 0.06, 0, z - 0.06, x + 0.06, 0.48, z + 0.06));
  S.add(merged(marbleM, posts), box(marbleM, -0.05, 0.42, 8.98, 8.05, 0.5, 9.14), box(marbleM, -0.05, 0.08, 9.0, 8.05, 0.13, 9.12));
  for (const x of [0.06, 7.94]) S.add(box(marbleM, x - 0.07, 0.42, 4.8, x + 0.07, 0.5, 9.1));
  heaven(E);
}
// heaven round the temple: soft billows of cloud banked against the platform's sides and front, rising and turning
// slowly, so it floats; and now and then a pair of red-crowned cranes (title.js's birds) gliding past below
function puffTex() {
  return disc((g, n) => {
    // a heap of lobes, bigger in the middle, lit from above (bright tops, blue-grey undersides), all fading to nothing
    // well inside the square so no edge ever shows
    for (let k = 0; k < 22; k++) {
      const u = (Math.random() - 0.5) * 0.5, r = n * (0.07 + 0.09 * (1 - Math.abs(u) * 2) * (0.6 + 0.4 * Math.random())), x = n * (0.5 + u), y = n * (0.56 - (0.06 + 0.1 * Math.random()) * (1 - Math.abs(u) * 2));
      const gr = g.createRadialGradient(x, y - r * 0.35, 0, x, y, r); gr.addColorStop(0, 'rgba(255,253,246,0.9)'); gr.addColorStop(0.5, 'rgba(236,236,248,0.55)'); gr.addColorStop(1, 'rgba(190,198,232,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, 256);
}
function heaven(E) {
  const S = E.world.scene, tex = puffTex(), puffs = [];
  const at = [];
  for (let z = 1.5; z <= 9.5; z += 0.9) at.push([-0.9, z], [8.9, z]);
  for (let x = -0.5; x <= 8.5; x += 0.9) at.push([x, 9.9]);
  for (const [x, z] of at) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1, 0.97, 0.94), transparent: true, depthWrite: false, opacity: 0.85 }));
    const sz = 1.6 + Math.random() * 1.4; m.scale.set(sz, sz * 0.7, 1); m.position.set(x + (Math.random() - 0.5) * 0.4, -1.1 + sz * 0.3 + Math.random() * 0.25, z);   // above the cloud sea (-1.2): never cut by it m.renderOrder = 1; S.add(m);
    puffs.push({ m, y: m.position.y, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.1 });
  }
  const birds = [0, 1].map(i => { const c = craneBird(i); c.b.scale.setScalar(1.6); c.b.visible = false; S.add(c.b); return c; });
  let fly = null, wait = 4;
  E.world.updaters.push((dt, t) => {
    for (const p of puffs) { p.m.position.y = p.y + Math.sin(t * 0.3 + p.ph) * 0.08; p.m.material.rotation += p.rot * dt; }
    if (!fly) { if ((wait -= dt) > 0) return; fly = { x: -6, z: 4 + Math.random() * 5, dir: Math.random() < 0.5 ? 1 : -1 }; }
    fly.x += dt * 0.9;
    birds.forEach((c, i) => {
      flap(c, dt, t); c.b.visible = true;
      const x = fly.dir > 0 ? fly.x - i * 0.7 : 14 - fly.x + i * 0.7;
      c.b.position.set(x, -0.55 + Math.sin(t * 0.5 + c.seed) * 0.06 - i * 0.1, fly.z + i * 0.55); c.b.rotation.y += fly.dir > 0 ? 0 : Math.PI;
    });
    if (fly.x > 20) { fly = null; wait = 14 + Math.random() * 10; for (const c of birds) c.b.visible = false; }
  });
}

export default {
  build, ground: (x, z) => LV.at(x, z), particles: 'sparkles',
  native(E, ev, clock) { if (ev.name === 'redden') darken(E, ev, clock); },   // (scene 65: heaven sinks to dark before the closing words, 0x21732)
  // [design, the user's: the pink void did not read as heaven] a sea of sunlit cloud: ivory tops with a golden rim,
  // azure folds, deep blue in the gaps, a warm haze toward the horizon
  mood: { bg: 0xf6e6d2, voidCol: 0xf6e6d2, fog: 0xf2e4d4, fogD: 0.003, sky: 0xfff2de, under: 0x8a98c8, hemi: 1.0,
    sun: 0xfff0d0, sunI: 2.4, sunDir: [-0.3, 0.9, 0.5], sat: 1.06, exposure: 1.0, bloom: 0.42,
    clouds: { a: 0xfff1da, b: 0x9cb0e6, d: 0x6c8cd8, g: 0xffb860, haze: 0xfbe6cc, sun: [-0.5, 0.6, 0.4] },
    env: { top: 0xfff4e8, mid: 0xdcd8ee, low: 0x8a9ccc, lights: [[0, 8, 4, 0xffffff, 6], [-6, 3, -4, 0xffe0b0, 4]] } },
};
