// Native cuts the scene player acts out itself (extract/scenes.js turns each into a 'native' event with what the cut's
// code does, frame by frame). Each reads the scene clock, so a seek shows the state at its frame, and stops on its own.
//   wisp   scene 42 [0x0F661E]: a red spirit flame drops onto the shrine and darts about, dives at 林雲, the two flicker
//          pale, a burst, and the world goes white for a breath and comes back
//   slash  scene 43 [0x0F737E]: the possessed 伯邑考 lunges up the carpet; a crescent of cold light leaves his blade and
//          strikes the one it is aimed at (the shove itself is in the tracks)
//   tablets, light  scene 54 [0x0F9A0A, 0x0F9AB8]: the four 古文書 close into one light, which darts round the hall and
//          spirals out in white flashes (below)
//   fuse   scene 63 [0x0FD0F6]: 紂王 and 申公豹 fuse in white, the new map under a heat haze
//   sparkles  scene 64 [0x0FDAD2]: light falls down the corridor
//   ascend op 47 [0x1B86C]: a unit turns into light and flies up (the guardians, the finale)
//   vision    scene 65 [0x51F2]: heaven looks down on the world: each vignette comes up out of white, an orb of light going round it
//   cheer     scene 65 [0x5130]: the court's balloons as 姬發 takes the throne
//   darken    (for a set's 'redden', scene 65 [0x21732]): the map sinks to dark in its steps, the cast left as it was
import * as THREE from 'three';
import { groundH } from './world.js';
import { emoteTexture, FRAMES as EMOTE_FRAMES } from './emotes.js';

const lerp = (a, b, k) => a + (b - a) * k;
// the event's path at scene time t: [x, z] in cells (map px / 32), between its frames
function pathAt(path, t) {
  let i = 0; while (i + 1 < path.length && path[i + 1][0] <= t) i++;
  const p = path[i], q = path[Math.min(path.length - 1, i + 1)], k = q[0] > p[0] ? Math.min(1, Math.max(0, (t - p[0]) / (q[0] - p[0]))) : 0;
  return [lerp(p[1], q[1], k) / 32, lerp(p[2], q[2], k) / 32];
}
const running = new Set();
function run(E, key, clock, end, tick) {
  if (running.has(key)) return; running.add(key);
  const W = E.world, f = dt => { const t = clock(); if (t > end + 2 || t < 0) { W.updaters.splice(W.updaters.indexOf(f), 1); running.delete(key); tick(null, dt); return; } tick(t, dt); };
  W.updaters.push(f);
}

let HALO = null;
function haloTex() {   // a soft round glow with four faint licks of flame round it
  if (HALO) return HALO;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,200,160,0.7)'); gr.addColorStop(1, 'rgba(255,80,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 4; k++) { g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 2 + 0.4); const l = g.createLinearGradient(0, 0, 0, -58); l.addColorStop(0, 'rgba(255,150,90,0.5)'); l.addColorStop(1, 'rgba(255,60,30,0)'); g.fillStyle = l; g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-4, -30, 0, -58); g.quadraticCurveTo(4, -30, 9, 0); g.fill(); g.restore(); }
  HALO = new THREE.CanvasTexture(c); HALO.colorSpace = THREE.SRGBColorSpace; return HALO;
}
// the wisp: a spirit flame, red to gold at the core, a trail of embers behind it, its light on the stone
export function wisp(E, ev, clock, actorOf) {
  const W = E.world, end = ev.white[3];
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.15, 0.7), toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1.6, 0.5, 0.25), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(1.5); core.add(halo);
  const glow = new THREE.PointLight(0xff4a2a, 0, 4, 1.6); core.add(glow); W.scene.add(core); core.visible = false;
  const trail = E.vfx.ribbon({ col: [1, 0.35, 0.18], width: 0.12, n: 16, fade: 0.35 });
  let last = null;
  run(E, 'wisp' + ev.f, clock, end, (t, dt) => {
    if (t == null) { W.scene.remove(core); trail.end(); return; }
    const flying = t >= ev.f && t < ev.blink + 21, target = actorOf('0');
    core.visible = flying; glow.intensity = flying ? 5 + Math.sin(t * 0.7) * 1.5 : 0;
    if (flying) {
      const [x, z] = pathAt(ev.path, t), lead = t >= ev.blink && target ? target.chest() : null;
      const y = groundH(x, z), h = lead ? lead.y : y + 1.1 + Math.sin(t * 0.15) * 0.12;
      core.position.set(lead ? lead.x : x, h, lead ? lead.z : z);
      core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.2); halo.material.rotation = t * 0.08;
      if (!last || last.distanceToSquared(core.position) > 0.0004) { trail.push(core.position.clone()); last = core.position.clone(); }
      if (Math.random() < 0.6) E.vfx.spark(core.position.x, core.position.y, core.position.z, { vx: (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 0.5, size: 0.04, r: 1, gg: 0.45 + Math.random() * 0.4, b: 0.2, shape: 0, flicker: 1, ph: Math.random() * 9 });
    }
    // the blink: 林雲 flickers pale with the wisp, every other frame [the cut alternates their palette line]
    if (target) target.flash = t >= ev.blink && t < ev.hit ? (Math.floor(t) % 2 ? 0.85 : 0) : (target.flash > 0.84 ? 0 : target.flash);
    // the burst and the white: up over 16 frames, held, down over 16
    if (t >= ev.hit && t < ev.hit + 1.5 && target) { const c = target.chest(); E.vfx.burst(c, { n: 40, speed: 2.4, cols: [[1, 0.5, 0.25], [1, 0.9, 0.7]], size: 0.05, life: 0.6, g: 2 }); E.vfx.light(c, [1, 0.6, 0.4], 10, 0.4, 5); E.vfx.shake(0.12, 0.3); }
    const [a, b, c, d] = ev.white, k = t < a ? 0 : t < b ? (t - a) / (b - a) : t < c ? 1 : t < d ? 1 - (t - c) / (d - c) : 0;
    if (k > 0) { E.vfx.screen.flash = Math.max(E.vfx.screen.flash, k * 0.92); E.vfx.screen.flashCol.setRGB(1, 0.98, 0.94); }
  });
}

// the slash: the attacker's blade throws a crescent of pale light that flies at the target and breaks on it
let CRESCENT = null;
function crescentTex() {
  if (CRESCENT) return CRESCENT;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.translate(128, 110);
  const arc = (top, thin) => { g.beginPath(); g.moveTo(-118, 10); g.quadraticCurveTo(0, top, 118, 10); g.quadraticCurveTo(0, top + thin, -118, 10); g.closePath(); };
  g.shadowColor = 'rgba(150,200,255,1)'; g.shadowBlur = 16; g.fillStyle = 'rgba(170,215,255,0.85)'; arc(-104, 38); g.fill();
  g.shadowBlur = 5; g.shadowColor = '#fff'; g.fillStyle = '#ffffff'; arc(-98, 18); g.fill();
  CRESCENT = new THREE.CanvasTexture(c); CRESCENT.colorSpace = THREE.SRGBColorSpace; return CRESCENT;
}
export function slash(E, ev, clock, actorOf) {
  const W = E.world, m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: crescentTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.renderOrder = 7; m.visible = false; W.scene.add(m);
  let struck = false;
  run(E, 'slash' + ev.f, clock, ev.hit + 10, t => {
    if (t == null) { W.scene.remove(m); return; }
    const a = actorOf(ev.from), b = actorOf(ev.at); if (!a || !b) return;
    const k = (t - ev.f) / (ev.hit - ev.f);
    m.visible = k >= 0 && k <= 1;
    if (m.visible) {
      const p = a.chest().lerp(b.chest(), Math.max(0, k)); m.position.copy(p); m.quaternion.copy(W.camera.quaternion);
      const d = b.chest().sub(a.chest()); m.rotateZ(Math.atan2(-d.z, d.x) + Math.PI / 2); m.scale.setScalar(0.7 + k * 0.6); m.material.opacity = Math.min(1, k * 4);
      if (Math.random() < 0.7) E.vfx.spark(p.x, p.y, p.z, { vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, vz: 0, life: 0.3, size: 0.03, r: 0.8, gg: 0.9, b: 1, shape: 1 });
    }
    if (!struck && k >= 1) { struck = true; const c = b.chest(); E.vfx.burst(c, { n: 30, speed: 2.8, cols: [[1, 1, 1], [0.6, 0.8, 1]], size: 0.045, life: 0.5, g: 3, shape: 1 }); E.vfx.ring(c, [0.7, 0.85, 1], 0.7, 0.3, { vertical: true, y: c.y, intensity: 1.2 }); E.vfx.shake(0.1, 0.25); b.flash = 1; }
    if (struck && b.flash > 0) b.flash = Math.max(0, b.flash - 0.08);
  });
}

// ---------------------------------------------------------------- scene 54: the four 古文書 and the light they become
// [0x0F9A0A, 0x0F9AB8] the four ancient texts hang round 林雲 and 燕蓉 as op 45 lays them (the original's own sprites,
// assets/fx/tablet-N.png, crisp), each with a faint aura of its colour; the cut closes them on the middle a pixel a frame
// for 32 frames, they flash and are one light (assets/fx/scroll.png: white-hot, rimmed orange); then it flickers, darts
// three times round the hall, bursts and spirals out, the screen flashing white as it goes (天門 opening)
const TABLET_COL = [[1, 0.85, 0.3], [0.4, 0.85, 1], [1, 0.55, 0.6], [0.45, 1, 0.5]];
const texs = {};
const fxTex = name => texs[name] || (texs[name] = (() => { const t = new THREE.TextureLoader().load('assets/fx/' + name + '.png'); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; })());
const spriteOf = (name, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex(name), transparent: true, depthWrite: false, toneMapped: false })); m.scale.setScalar(s); m.renderOrder = 7; return m; };
function aura(col, s) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(...col), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); m.scale.setScalar(s); m.renderOrder = 6; return m; }
const H_HANG = 1.15;
export function tablets(E, ev, clock) {
  const W = E.world, end = ev.end ?? ev.meet + 50, mid = [ev.tablets[0].x / 32, (ev.tablets[0].y + 32) / 32];
  const items = ev.tablets.map(tb => { const g = new THREE.Group(), s = spriteOf('tablet-' + tb.k, 0.5), a = aura(TABLET_COL[tb.k], 0.9); g.add(a, s); g.visible = false; W.scene.add(g); return { tb, g, s, a }; });
  const orb = new THREE.Group(), core = spriteOf('scroll', 0.9), glow = aura([1, 0.85, 0.55], 1.6); orb.add(glow, core); orb.visible = false; W.scene.add(orb);
  let flashed = false;
  run(E, 'tablets' + ev.f, clock, end, t => {
    if (t == null) { for (const it of items) W.scene.remove(it.g); W.scene.remove(orb); return; }
    const k = Math.min(1, Math.max(0, (t - ev.close) / (ev.meet - ev.close)));
    for (const it of items) {
      const shown = t >= it.tb.appear && t < ev.meet, x = it.tb.x / 32 + (mid[0] - it.tb.x / 32) * k, z = it.tb.y / 32 + (mid[1] - it.tb.y / 32) * k;
      it.g.visible = shown; if (!shown) continue;
      const rise = Math.min(1, (t - it.tb.appear) / 18);
      it.g.position.set(x, groundH(x, z) + H_HANG + Math.sin(t * 0.06 + it.tb.k * 1.6) * 0.06, z);
      it.s.material.opacity = rise; it.a.material.opacity = 0.35 + 0.15 * Math.sin(t * 0.1 + it.tb.k);
    }
    if (t >= ev.meet && !flashed) { flashed = true; const p = V3(mid[0], groundH(...mid) + H_HANG, mid[1]); E.vfx.burst(p, { n: 30, speed: 2.2, cols: [[1, 1, 1], [1, 0.85, 0.5]], size: 0.05, life: 0.6, g: 0, shape: 1 }); E.vfx.light(p, [1, 0.9, 0.7], 8, 0.5, 6); E.vfx.screen.flash = Math.max(E.vfx.screen.flash, 0.5); E.vfx.screen.flashCol.setRGB(1, 0.97, 0.9); }
    orb.visible = t >= ev.meet && t < end;
    if (orb.visible) { orb.position.set(mid[0], groundH(...mid) + H_HANG, mid[1]); core.material.rotation = t * 0.05; glow.material.opacity = 0.5 + 0.2 * Math.sin(t * 0.2); }
  });
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export function light(E, ev, clock) {
  const W = E.world, [s0, s1] = ev.spiral, end = s1;
  const orb = new THREE.Group(), core = spriteOf('scroll', 0.9), glow = aura([1, 0.85, 0.55], 1.8); orb.add(glow, core); W.scene.add(orb);
  const lamp = new THREE.PointLight(0xffe0a0, 0, 5, 1.6); orb.add(lamp);
  const trail = E.vfx.ribbon({ col: [1, 0.9, 0.6], width: 0.1, n: 20, fade: 0.4 });
  const last = ev.path[ev.path.length - 1], cx = last[1] / 32, cz = last[2] / 32;
  let burst = false, prev = null; const flashed = new Set();
  run(E, 'light' + ev.f, clock, end, t => {
    if (t == null) { W.scene.remove(orb); trail.end(); return; }
    let x, z, vis = true;
    if (t < ev.path[0][0]) { [x, z] = [ev.at[0] / 32, ev.at[1] / 32]; vis = Math.floor(t) % 4 === 0; }   // the flicker: shown one frame in four, as the cut
    else if (t < s0) [x, z] = pathAt(ev.path, t);
    else { const n = t - s0, a = (270 + n * 15) * Math.PI / 180, r = (1 + n) / 32; x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r; }
    orb.visible = vis; orb.position.set(x, groundH(x, z) + H_HANG + 0.15, z);
    core.material.rotation = t * 0.08; lamp.intensity = vis ? 4 : 0;
    if (t >= ev.path[0][0] && (!prev || prev.distanceToSquared(orb.position) > 0.0004)) { trail.push(orb.position.clone()); prev = orb.position.clone(); }
    if (t >= s0 && !burst) { burst = true; E.vfx.burst(orb.position.clone(), { n: 36, speed: 2.6, cols: [[1, 1, 1], [1, 0.8, 0.45]], size: 0.05, life: 0.6, g: 0, shape: 1 }); E.vfx.light(orb.position.clone(), [1, 0.9, 0.7], 10, 0.5, 7); }
    for (const fl of ev.flashes) if (t >= fl && t < fl + 3 && !flashed.has(fl)) { flashed.add(fl); E.vfx.screen.flash = Math.max(E.vfx.screen.flash, 0.7); E.vfx.screen.flashCol.setRGB(1, 1, 1); }
  });
}

// ---------------------------------------------------------------- scene 63: 紂王 and 申公豹 fuse [0x0FD0F6]
// their powered-up poses (assets/units/fuse-<sheet>.png, frames 1 and 2 by turns every 5 frames) close on each other a pixel every
// 5 frames for 16 steps; the original flickers them (one frame in four): here a steady phantom, as its other flickers are played;
// the screen goes white in steps; the new map comes from white (the scene's map event) under a heat haze that settles
const sheetSprite = (name, frames) => { const t = new THREE.TextureLoader().load('assets/units/' + name + '.png'); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.repeat.set(1 / frames, 1);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.7, fog: false })); s.renderOrder = 7; return s; };
export function fuse(E, ev, clock) {
  const W = E.world, [s0, every, n] = ev.steps, sprites = ev.who.map(w => { const s = sheetSprite(w.sheet, 3); W.scene.add(s); return { w, s }; });
  run(E, 'fuse' + ev.f, clock, ev.load, t => {
    if (t == null) { for (const { s } of sprites) W.scene.remove(s); return; }
    const k = Math.min(n, Math.floor((t - s0) / every)), fr = 1 + Math.floor((t - s0) / 5) % 2;
    for (const { w, s } of sprites) { const x = (w.x + w.dir * k + 16) / 32, z = (w.y + 16) / 32; s.position.set(x, groundH(x, z) + 0.5, z); s.material.map.offset.x = fr / 3; s.visible = t >= ev.f && t < ev.load; }
    const [w0, wstep] = ev.white; if (t >= w0) { const kw = Math.min(1, (Math.floor((t - w0) / wstep) + 1) / 8); E.vfx.screen.flash = Math.max(E.vfx.screen.flash, kw * 0.96); E.vfx.screen.flashCol.setRGB(1, 1, 1); }
  });
  haze(E, ev, clock);
}
// the heat haze [0x1E686: line scroll, its depth ff0f62 from 64 down]: the game's canvas bent in horizontal bands by an SVG
// displacement, its depth falling to nothing over the stretch
function haze(E, ev, clock) {
  const [h0, h1] = ev.haze, cv = E.world.renderer.domElement;
  let svg = document.getElementById('haze-svg');
  if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'haze-svg'; svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="haze" x="0" y="0" width="100%" height="100%"><feTurbulence id="haze-t" type="fractalNoise" baseFrequency="0.0001 0.035" numOctaves="1" seed="1"/><feDisplacementMap id="haze-d" in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="A"/></filter>';
    document.body.appendChild(svg); }
  const turb = document.getElementById('haze-t'), disp = document.getElementById('haze-d');
  run(E, 'haze' + ev.f, clock, h1, t => {
    if (t == null || t < h0 || t > h1) { cv.style.filter = ''; return; }
    const depth = 1 - (t - h0) / (h1 - h0), px = cv.clientWidth / 256;   // (64 of the original's lines' worth at the start, in its pixels)
    cv.style.filter = 'url(#haze)'; disp.setAttribute('scale', (depth * 24 * px).toFixed(1)); turb.setAttribute('seed', String(Math.floor(t / 3) % 50));
  });
}

// ---------------------------------------------------------------- scene 64: sparkles down the corridor [0x0FDAD2]
// 16 sparkles of light (the original's own four frames, assets/fx/sparkle.png) falling from the sky toward the floor over the
// corridor, each at its own speed, starting over at the top until the respawn frame; a seeded run, so a seek shows the same fall
let SPARK = null;
const sparkTex = () => SPARK || (SPARK = (() => { const t = new THREE.TextureLoader().load('assets/fx/sparkle.png'); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.repeat.set(1 / 4, 1); return t; })());
export function sparkles(E, ev, clock) {
  const W = E.world, rnd = (() => { let s = 0x2545f491; return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 16) / 65536; })();
  const make = () => ({ x: ev.x[0] + rnd() * (ev.x[1] - ev.x[0]), y: ev.y[0] - rnd() * 80, v: ev.speed[0] + Math.floor(rnd() * (ev.speed[1] - ev.speed[0] + 1)) });
  const state = Array.from({ length: ev.n }, make);
  const sp = state.map(() => { const tx = sparkTex().clone(); tx.needsUpdate = true; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.6), fog: false }));
    s.scale.setScalar(0.32); s.renderOrder = 7; W.scene.add(s); return s; });
  let at = ev.f;
  run(E, 'sparkles' + ev.f, clock, ev.end, t => {
    if (t == null) { for (const s of sp) W.scene.remove(s); return; }
    for (; at < Math.floor(t); at++) for (const q of state) { if (q.done) continue; q.y += q.v; if (q.y > ev.y[1]) { if (at < ev.respawn) Object.assign(q, make(), { y: ev.y[0] }); else q.done = true; } }
    state.forEach((q, i) => { const s = sp[i]; s.visible = !q.done && q.y >= ev.y[0] && t >= ev.f; if (!s.visible) return;
      const x = (q.x + 4) / 32, z = (q.y + 4) / 32, k = (q.y - ev.y[0]) / (ev.y[1] - ev.y[0]);   // (falling from the sky as it comes down the corridor)
      s.position.set(x, groundH(x, z) + 0.3 + (1 - k) * 2.6, z); s.material.map.offset.x = (Math.floor((t + i * 3) / 8) % 4) / 4; });
  });
}

// ---------------------------------------------------------------- op 47: a unit turns into light and flies up [0x1B86C]
// the unit glows white and the light (assets/fx/light.png, its largest frame) swells over it for 40 frames; then it is the light:
// up along the cut's path into the sky, a trail behind, while its shadow on the floor shrinks every 20 frames and is gone
let SHADOW = null;
export function ascend(E, ev, clock, actorOf) {
  const W = E.world, end = ev.path[ev.path.length - 1][0] + 6;
  const lt = sheetSprite('../fx/light', 3); lt.material.opacity = 1; lt.material.toneMapped = false; lt.material.color = new THREE.Color(1.3, 1.25, 1.15); lt.material.map.offset.x = 2 / 3; W.scene.add(lt);
  if (!SHADOW) SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, fog: false, toneMapped: false });
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), SHADOW); sh.scale.set(1, 1, 0.55); sh.renderOrder = 3; W.scene.add(sh);   // (drawn over the floor: on a flat map's art it sank into the plane)
  const trail = E.vfx.ribbon({ col: [1, 0.85, 0.55], width: 0.14, n: 18, fade: 0.4 });
  const sx = (ev.at[0] + 16) / 32, sz = (ev.at[1] + 24) / 32;
  let prev = null, glowed = false;
  run(E, 'ascend' + ev.f, clock, end, t => {
    if (t == null) { W.scene.remove(lt); W.scene.remove(sh); trail.end(); const a = actorOf(ev.slot); if (a) a.flash = 0; return; }
    const a = actorOf(ev.slot);
    if (t < ev.flash) {   // the glow: the unit whitening, the light swelling over it
      const k = (t - ev.f) / (ev.flash - ev.f); if (a) a.flash = 0.35 + 0.5 * k * (0.75 + 0.25 * Math.sin(t * 0.8));
      lt.visible = true; lt.position.set(sx, groundH(sx, sz) + 0.55, sz + 0.05); lt.scale.setScalar(0.3 + k * 0.7); lt.material.opacity = 0.25 + 0.75 * k; sh.visible = false;
      return;
    }
    if (a) a.flash = 0;
    if (!glowed) { glowed = true; const p = V3(sx, groundH(sx, sz) + 0.55, sz); E.vfx.burst(p, { n: 26, speed: 2.2, cols: [[1, 1, 1], [1, 0.8, 0.45]], size: 0.05, life: 0.5, g: 0, shape: 1 }); E.vfx.light(p, [1, 0.9, 0.7], 8, 0.5, 6); }
    const [px, pz] = pathAt(ev.path, t), x = px + 0.5, z = pz + 0.5, rise = Math.min(1, (t - ev.flash) / (end - 6 - ev.flash));
    lt.visible = t < end - 6; lt.scale.setScalar(1); lt.material.opacity = 1; lt.position.set(x, groundH(x, z) + 0.55 + rise * rise * 3.2, z);
    if (!prev || prev.distanceToSquared(lt.position) > 0.001) { trail.push(lt.position.clone()); prev = lt.position.clone(); }
    const [s0, s1, s2, s3] = ev.shadow; sh.visible = t >= s0 && t < s3; sh.scale.setScalar(t < s1 ? 0.75 : t < s2 ? 0.5 : 0.25); sh.scale.z *= 0.55; sh.position.set(sx, groundH(sx, sz) + 0.04, sz);
  });
}

// ---------------------------------------------------------------- scene 65: heaven looks down [0x51F2]
// after each vignette's map load the picture comes up out of white, the palette a step down every 7th frame (seven steps, ev.steps:
// here the page's white veil thinning by sevenths), while a white orb goes round the picture along the cut's own steps (ev.orb:
// [frame, x, y, shown]), drawn every other frame: here a soft light, steady at half its strength, with a short trail
export function vision(E, ev, clock) {
  const W = E.world, end = ev.orb[ev.orb.length - 1][0], veil = document.getElementById('fade');
  const orb = new THREE.Group(), glow = aura([1, 0.97, 0.9], 1.1), core = aura([1, 1, 1], 0.45); orb.add(glow, core); W.scene.add(orb);
  const trail = E.vfx.ribbon({ col: [1, 0.97, 0.92], width: 0.07, n: 14, fade: 0.35 });
  let prev = null;
  const level = t => t < ev.show ? 1 : Math.max(0, 1 - ev.steps.filter(f => t >= f).length / ev.steps.length) * 0.88;   // (the first frame shown is already a step off white)
  run(E, 'vision' + ev.f, clock, Math.max(end, ev.steps[ev.steps.length - 1]), t => {
    if (t == null) { W.scene.remove(orb); trail.end(); if (veil.dataset.vision === String(ev.f)) { veil.style.opacity = 0; veil.style.background = ''; delete veil.dataset.vision; } return; }
    if (t <= ev.steps[ev.steps.length - 1] + 1) { veil.dataset.vision = ev.f; veil.style.transition = 'none'; veil.style.background = t < ev.show ? '' : '#fff'; veil.style.opacity = level(t); }
    else if (veil.dataset.vision === String(ev.f)) { veil.style.opacity = 0; veil.style.background = ''; delete veil.dataset.vision; }
    orb.visible = t >= ev.show && t <= end; if (!orb.visible) return;
    const [x, z] = pathAt(ev.orb, t), y = groundH(x, z) + 1.1;
    orb.position.set(x, y, z); glow.material.opacity = 0.45 + 0.1 * Math.sin(t * 0.5); core.material.opacity = 0.8;
    if (!prev || prev.distanceToSquared(orb.position) > 0.002) { trail.push(orb.position.clone()); prev = orb.position.clone(); }
  });
}
// ---------------------------------------------------------------- scene 65: the court cheers [0x5130]
// four balloons (op 11's art, ev.frame) at the cut's own places over the heroes on the steps until the script clears them
let CHEER_TEX = null;
export function cheer(E, ev, clock) {
  const W = E.world; if (!CHEER_TEX) CHEER_TEX = emoteTexture();
  const bs = ev.at.map(() => { const tx = CHEER_TEX.clone(); tx.needsUpdate = true; tx.repeat.set(1 / EMOTE_FRAMES, 1); tx.offset.x = ev.frame / EMOTE_FRAMES;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false, toneMapped: false, fog: false })); s.scale.set(0.62, 0.62, 1); s.renderOrder = 8; W.scene.add(s); return s; });
  run(E, 'cheer' + ev.f, clock, ev.end, t => {
    if (t == null) { for (const b of bs) W.scene.remove(b); return; }
    ev.at.forEach(([px, py], k) => { const x = px / 32, z = py / 32, b = bs[k]; b.visible = t >= ev.f && t < ev.end; b.position.set(x, groundH(x, z + 1) + 1.45, z + 1); });
  });
}
// ---------------------------------------------------------------- a map sinking to dark in steps (scene 65's heaven before its closing words, 0x21732)
// the original takes the map's palette lines a step down four times, the sprites untouched: here the sun, the sky light, the
// environment and the fog dim by the same steps toward night, the cast lifted so it stays as it was; held to the scene's end
export function darken(E, ev, clock) {
  const S = E.world.scene, lights = [];
  S.traverse(o => { if (o.isLight) lights.push([o, o.intensity]); });
  const fog = S.fog ? S.fog.color.clone() : null, env = S.environmentIntensity ?? 1, DARK = new THREE.Color(0.01, 0.01, 0.02), R = E.world.renderer, ex = R ? R.toneMappingExposure : 1;   // (the exposure: the sky and the cloud sea answer no light)
  const tick = () => {
    const t = clock(); if (t < ev.f - 2) { apply(0); E.world.updaters.splice(E.world.updaters.indexOf(tick), 1); return; }
    apply(ev.steps.filter(f => t >= f).length / ev.steps.length);
  };
  const apply = k => {
    for (const [l, i] of lights) l.intensity = i * (1 - 0.5 * k);
    if (fog) S.fog.color.copy(fog).lerp(DARK, 0.7 * k); S.environmentIntensity = env * (1 - 0.6 * k);
    if (R) R.toneMappingExposure = ex * (1 - 0.72 * k);   // (dim, the room still to be made out round the words, as the original's)
    for (const a of (E.actors || new Map()).values()) a.glow = 1 + 2.4 * k;
  };
  E.world.updaters.push(tick);
}
