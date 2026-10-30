// the title screen's background (tools/rom/title.py): the original pans east over a world map, 1 px a frame, behind the
// scroll logo and the menu: grass plains, dark forests, long ridges of mountains with pale crests, sandy flats and, at
// the east end, the sea. Remade as a miniature land seen from the sky (the kit's terrain, as the 昌平村 descent's world
// map, src/remake/world.js); main.js flies the camera along it (titlePan). Late in the day for the opening: a low warm
// sun draws long shadows off the ridges, clouds drift below the camera (their shadows sliding over the land) and now and
// then a skein of red-crowned cranes overtakes the view.
import * as THREE from 'three';
import * as T from '../kit/tex.js';
import { readLayout, Land, CL, pines, shrubs, grass, windTick } from '../kit/terrain.js';

export const W = 36, H = 7;   // cells: one 32-cell period of the map and 4 of the next (assets/maps/title-bg.png)
const PALETTE = {
  [CL.grass]: [0x489000, 0x6c9000, 0x246c00], [CL.forest]: [0x004800, 0x000000],
  [CL.rock]: [0xb49000, 0x904800, 0x6c2400, 0x240000], [CL.ground]: [0xb49048, 0xb4b4b4, 0x906c24],
  [CL.water]: [0x00006c, 0x000024, 0x0048b4, 0x006cb4, 0x002490],
};
let land = null;

async function build(E, FX) {
  const S = E.world.scene;
  // the pale grey is both the flats' sand and the ridges' crests: rock wins a sample with a fair share of rock colours,
  // and a sand sample inside the range (rock on most sides) is a crest
  const lay = await readLayout('assets/maps/title-bg.png', W, H, PALETTE, { [CL.rock]: 1.6, [CL.water]: 2 });
  const RW = W * 4, RH = H * 4, src = lay.slice();
  for (let j = 1; j < RH - 1; j++) for (let i = 1; i < RW - 1; i++) {
    if (src[j * RW + i] !== CL.ground) continue; let n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if ((a || b) && src[(j + b) * RW + i + a] === CL.rock) n++;
    if (n >= 6) lay[j * RW + i] = CL.rock;
  }
  land = new Land({ w: W, h: H, layout: lay, ext: 6, rockH: 1.3, peaks: 3, rise: 1.2, serrate: 20, lumpH: 0.05, waterDepth: 0.1,
    tex: { dirt: T.dirt(0xd0b080, 'flats'), turf: T.turf(0x5e9a26), rock: T.rock(0xb08a50, "ridge") },
    tint: { dirt: 0xffffff, turf: 0xe8ffd0, rock: 0xffe2b0 } });
  S.add(land.mesh({ res: 12, dirtK: 0.6, turfK: 0.7, rockK: 0.8, snow: 99, bed: 0x1e3a5a }));
  // the sea and the river: one water surface over the carved beds
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, H + 20).rotateX(-Math.PI / 2), sea());
  water.position.set(W / 2, -0.04, H / 2); S.add(water);
  S.add(pines(land.scatter(CL.forest, 34), { size: 0.24, cols: ['#1e4a1a', '#2a5a22', '#346a2a', '#18401a'] }));
  S.add(shrubs(land.scatter(CL.grass, 0.5), { size: 0.08, cols: ['#3a6a22', '#4a7a2a'] }));
  S.add(grass(land.scatter(CL.grass, 16), { size: 0.06, cols: ['#6aa030', '#88b840', '#5a8a2a'] }));
  E.world.updaters.push((dt, t) => windTick(t));
  clouds(E); cranes(E);
}

// ---------------------------------------------------------------- the sea
// deep blue, rippling; the evening sky's warm light on the far water, and gold glints scattered toward the sun
const SEA_T = { value: 0 };
function sea() {
  return new THREE.ShaderMaterial({ fog: false, uniforms: { uT: SEA_T },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vW.xz;
        float r = n(p * vec2(1.6, 3.2) + vec2(uT * 0.22, uT * 0.08)) * 0.5 + n(p * vec2(3.6, 7.0) - vec2(uT * 0.35, 0.0)) * 0.3 + n(p * vec2(8.0, 15.0) + uT * 0.5) * 0.2;
        vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - V.y, 2.0);
        vec3 col = mix(vec3(0.004, 0.025, 0.07), vec3(0.02, 0.085, 0.16), smoothstep(0.35, 0.8, r));   // linear: deep blue, the ripples' lit faces
        col = mix(col, vec3(0.55, 0.32, 0.16), fr * 0.6);                                              // the warm sky on the far water
        vec2 q = p * vec2(7.0, 12.0), g = floor(q), f = fract(q) - 0.5; float s = h(g), tw = max(0.0, sin(uT * (1.2 + 2.5 * s) + s * 50.0));
        float glint = step(0.8, s) * pow(tw, 6.0) * smoothstep(0.5, 0.0, length(f * vec2(1.0, 2.2)) * 3.0) * (0.35 + 0.9 * smoothstep(0.0, -10.0, p.x - cameraPosition.x));
        col += vec3(1.0, 0.7, 0.35) * glint * 2.2;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}

// ---------------------------------------------------------------- clouds
// cumulus heaps of round puffs facing the camera, each lit by where it sits in its heap (the sun's side and the top
// bright, the underside a cool grey), so they keep their volume as the view passes over; a hidden sheet of the heap's
// outline casts its shadow on the land. They drift east slower than the view pans and wrap around the map's length.
function puffTex() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1, r = Math.hypot(x, y), w = T.fbm(i / N, j / N, 5, 3, 7) - 0.5;
    const z = Math.sqrt(Math.max(0, 1 - r * r)), lit = T.clamp(0.72 + (-x * 0.55 - y * 0.35 + z * 0.3) * 0.45);   // a ball lit from the upper left
    const k = (j * N + i) * 4; d[k] = d[k + 1] = d[k + 2] = lit * 255; d[k + 3] = T.clamp(1 - T.smooth(0.55, 1, r + w * 0.35)) * 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function outline(seed) {   // the heap's footprint, for its shadow
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.filter = 'blur(6px)'; g.fillStyle = '#fff';
  let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, q = Math.sqrt(rnd()) * 0.3; g.beginPath(); g.arc((0.5 + Math.cos(a) * q) * N, (0.5 + Math.sin(a) * q * 0.7) * N, (0.2 - q * 0.3) * N, 0, 6.283); g.fill(); }
  return new THREE.CanvasTexture(c);
}
function clouds(E) {
  const S = E.world.scene, tex = puffTex(), list = [], SPAN = W + 14, X0 = -7, DRIFT = 0.22;
  const sun = new THREE.Vector3(-0.8, 0.42, 0.3).normalize(), lo = new THREE.Color(0.62, 0.66, 0.8), hi = new THREE.Color(1, 0.94, 0.84);
  let r = 12345; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let n = 0; n < 12; n++) {
    const g = new THREE.Group(), L = 1.2 + rnd() * 1.0, D = 0.6 + rnd() * 0.4;
    for (let k = 0; k < 26; k++) {
      const a = rnd() * 6.283, q = Math.sqrt(rnd()), off = new THREE.Vector3(Math.cos(a) * q * L, 0, Math.sin(a) * q * D);
      const sz = (0.75 - q * 0.4) * (0.8 + rnd() * 0.5); off.y = (1 - q) * 0.45 + rnd() * 0.1;
      const lit = T.clamp(0.55 + off.clone().setY(off.y - 0.15).normalize().dot(sun) * 0.5 + off.y * 0.4);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: lo.clone().lerp(hi, lit), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
      sp.scale.set(sz * 1.3, sz, 1); sp.position.copy(off); g.add(sp);
    }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(L * 2.3, D * 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 }));
    sh.castShadow = true; sh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: outline(n + 1), alphaTest: 0.5 }); g.add(sh);
    g.position.set(X0 + (n + rnd() * 0.6) * SPAN / 12, 2.4 + rnd() * 0.9, 3 + rnd() * 4.5);   // z: under the view at that height (the camera is at z 9, 7 up)
    S.add(g); list.push(g);
  }
  E.world.updaters.push((dt, t) => { SEA_T.value = t; for (const g of list) { g.position.x += DRIFT * dt; if (g.position.x > X0 + SPAN) g.position.x -= SPAN; } });
}

// ---------------------------------------------------------------- cranes
// a skein of five red-crowned cranes in a V, flying east a little faster than the view, every 20-30 s; positions are
// kept relative to the camera (main.js starts the flight over at the end of the stretch). Each bird: a tapered white
// body, the black neck stretched out, a white head with its red crown and an olive bill, the black legs trailing; each
// wing jointed at the shoulder and the wrist, cambered, the inner wing edged behind with the black secondaries, the
// outer wing's primaries spread as fingers. The wingbeat is a downstroke quicker than the upstroke, the hand lagging
// and folding on the way up; now and then a bird glides on held wings; the body rises a little on each downstroke,
// and each bird banks, wavers and keeps its place in the V only loosely.
function wingGeo(outline, camber) {   // a flat outline (span u outward, chord v forward) bent into a wing: x = v, z = u
  const g = new THREE.ShapeGeometry(new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v))), 1), p = g.attributes.position;
  let v0 = Infinity, v1 = -Infinity; for (let i = 0; i < p.count; i++) { v0 = Math.min(v0, p.getY(i)); v1 = Math.max(v1, p.getY(i)); }
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), f = (v - v0) / (v1 - v0); p.setXYZ(i, v, camber * Math.sin(f * Math.PI) * (1 - u * 0.8), u); }
  g.computeVertexNormals(); return g;
}
const CRANE = (() => {
  const white = new THREE.MeshStandardMaterial({ color: 0xf8f6ee, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x3a3832 });   // lifted: the underwing catches light bounced up from the land
  const black = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.8, side: THREE.DoubleSide });
  // the inner wing (shoulder to wrist, 0.24 long) and its black trailing band, the feather tips ragged
  const inner = wingGeo([[0, 0.05], [0.12, 0.06], [0.24, 0.05], [0.24, -0.1], [0.2, -0.125], [0.16, -0.11], [0.12, -0.135], [0.08, -0.12], [0.04, -0.14], [0, -0.13]], 0.018);
  const band = wingGeo([[0, -0.05], [0.24, -0.045], [0.24, -0.1], [0.2, -0.125], [0.16, -0.11], [0.12, -0.135], [0.08, -0.12], [0.04, -0.14], [0, -0.13]], 0.018);
  // the hand: swept back, five primaries spread at the tip
  const hand = wingGeo([[0, 0.05], [0.1, 0.045], [0.2, 0.025], [0.3, -0.005], [0.27, -0.03], [0.31, -0.035], [0.26, -0.055], [0.29, -0.065], [0.23, -0.075], [0.25, -0.09], [0.18, -0.09], [0.1, -0.1], [0, -0.1]], 0.012);
  const bodyG = new THREE.LatheGeometry([[0, -0.16], [0.03, -0.13], [0.052, -0.06], [0.056, 0.0], [0.046, 0.07], [0.022, 0.12], [0, 0.13]].map(([r, y]) => new THREE.Vector2(r, y)), 12).rotateZ(-Math.PI / 2);
  const neckG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.11, 0.01], [0.2, 0.02], [0.28, 0.03], [0.34, 0.028]].map(([x, y]) => new THREE.Vector3(x, y, 0))), 12, 0.011, 6);
  const ink = black.clone(); ink.polygonOffset = true; ink.polygonOffsetFactor = -2; ink.polygonOffsetUnits = -4;   // the band, over the white from both sides
  return { white, black, ink, inner, band, hand, bodyG, neckG, red: new THREE.MeshStandardMaterial({ color: 0xd0201a, roughness: 0.6 }), bill: new THREE.MeshStandardMaterial({ color: 0x9a9a62, roughness: 0.6 }) };
})();
function crane() {
  const K = CRANE, b = new THREE.Group(), body = new THREE.Group(); b.add(body);
  body.add(new THREE.Mesh(K.bodyG, K.white));
  body.add(new THREE.Mesh(K.neckG, K.black));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), K.white); head.scale.set(1.3, 0.9, 0.9); head.position.set(0.355, 0.03, 0); body.add(head);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), K.red); crown.scale.set(1.4, 0.6, 1); crown.position.set(0.36, 0.044, 0); body.add(crown);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.075, 6).rotateZ(-Math.PI / 2), K.bill); bill.position.set(0.41, 0.026, 0); body.add(bill);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6).rotateZ(Math.PI / 2), K.black); tail.scale.set(1, 0.4, 1); tail.position.set(-0.17, 0.012, 0); body.add(tail);   // the black tertials draped over the tail
  for (const z of [-0.012, 0.012]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4).rotateZ(Math.PI / 2), K.black); leg.position.set(-0.26, -0.012, z); body.add(leg); }
  const wings = [1, -1].map(sd => {
    const sh = new THREE.Group(); sh.position.set(0.03, 0.02, 0); sh.scale.z = sd; body.add(sh);   // the left wing mirrored
    sh.add(new THREE.Mesh(K.inner, K.white), new THREE.Mesh(K.band, K.ink));
    const wr = new THREE.Group(); wr.position.z = 0.235; sh.add(wr); wr.add(new THREE.Mesh(K.hand, K.white));
    return { sh, wr, sd };
  });
  b.traverse(o => { if (o.isMesh) o.castShadow = true; });
  b.scale.setScalar(0.85); Object.assign(b.userData, { body, wings }); return b;
}
// one bird's flight state, and its wingbeat, glides and sway for a frame (not its place: cranes() keeps the V)
export function craneBird(i) { const b = crane(); return { b, ph: i * 1.7, f: 2.1 + i * 0.07, glide: 0, gT: 3 + i * 1.9, gOn: false, seed: i * 2.3 }; }
export function flap(c, dt, t) {
  // flap or glide: a bird glides for 1.5-2.5 s every few seconds, easing its wings out level and back to the beat
  if ((c.gT -= dt) <= 0) { c.gOn = !c.gOn; c.gT = c.gOn ? 1.5 + Math.random() : 3 + Math.random() * 4; }
  c.glide += ((c.gOn ? 1 : 0) - c.glide) * Math.min(1, dt * 2.5);
  c.ph += dt * c.f * Math.PI * 2 * (1 - c.glide * 0.85);
  const S = q => { const p = ((q % 6.2832) + 6.2832) % 6.2832; return p < Math.PI * 0.9 ? Math.cos(p / 0.9) : -Math.cos((p - Math.PI * 0.9) / 1.1); };   // +1 at the top of the stroke, -1 at the bottom: the downstroke takes 45% of the beat
  const p = c.ph % (Math.PI * 2), down = p < Math.PI * 0.9, s = S(c.ph), k = 1 - c.glide;
  const sh = (0.12 + 0.62 * s) * k + 0.06 * c.glide, wr = 0.5 * (S(c.ph - 0.9) - s) * k + 0.03 * c.glide;   // the hand trails the arm
  const fold = down ? 0 : Math.sin((p - Math.PI * 0.9) / 1.1) * k;   // on the upstroke the hand sweeps back, the wing half folded
  for (const w of c.b.userData.wings) { w.sh.rotation.x = -w.sd * sh; w.sh.rotation.y = -w.sd * 0.12 * fold; w.wr.rotation.x = -wr; w.wr.rotation.y = -0.5 * fold; }
  c.b.userData.body.position.y = -0.035 * s * k;   // the body rises on the downstroke
  c.b.rotation.set(Math.sin(t * 0.43 + c.seed) * 0.12, Math.sin(t * 0.31 + c.seed) * 0.06, 0.04 * s * k);   // bank, waver, pitch with the beat
}
function cranes(E) {
  const S = E.world.scene, V = [[0, 0], [-0.5, 0.42], [-0.5, -0.42], [-1.0, 0.84], [-1.0, -0.84]];
  const birds = V.map((v, i) => { const c = craneBird(i); c.v = v; c.b.visible = false; S.add(c.b); return c; });
  let rel = null, wait = 0.3, Z = 3.5, from = -4.5;   // the first skein starts just out of frame, in view in about 2 s [the user's call]; later ones from further off
  E.world.updaters.push((dt, t) => {
    const cx = E.world.camera.position.x;
    if (rel === null) { if ((wait -= dt) > 0) return; rel = from; from = -7.5; Z = 5 + Math.random() * 2; }
    rel += 0.75 * dt;
    for (const c of birds) {
      flap(c, dt, t); c.b.visible = true;
      c.b.position.set(cx + rel + c.v[0] + Math.sin(t * 0.37 + c.seed) * 0.06, 3.9 + Math.sin(t * 0.5 + c.seed) * 0.05, Z + c.v[1] + Math.sin(t * 0.29 + c.seed * 1.3) * 0.07);
    }
    if (rel > 7.5) { rel = null; wait = 20 + Math.random() * 10; for (const c of birds) c.b.visible = false; }
  });
}

export default {
  build, ground: (x, z) => land ? Math.max(land.at(x, z), -0.04) : 0, particles: null,
  mood: { bg: 0xe8c8a0, voidCol: false, fog: 0xe8c49a, fogD: 0.03, sky: 0x8aa6d8, under: 0x3a2a18, hemi: 1.0,
    sun: 0xffc488, sunI: 3.8, sunDir: [-0.8, 0.42, 0.3], sat: 1.05, exposure: 1.05, bloom: 0.45, aoR: 0.25,
    env: { top: 0x3a4a66, mid: 0x5a4636, low: 0x1e1810, lights: [[-8, 5, 2, 0xffc890, 1.2]] } },
};
