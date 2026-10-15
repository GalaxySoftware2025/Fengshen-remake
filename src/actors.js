// Characters: the original pixel sprites as lit billboards standing in the 3D world (HD-2D style).
import * as THREE from 'three';
import { groundH } from './world.js';
import { isLegacy, LEGACY } from './sprites.js';

const AD = globalThis.ANIM_DATA;
const TMP = new THREE.Vector3();
const HD = 4;                 // HD sheets are 4x the 32px originals
const FACE = { down: [0, 1, 0, 2], up: [3, 4, 3, 5], left: [6, 7, 6, 8] };
const ATK_DIR = { down: 0, up: 1, left: 2, right: 2 };

function load(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; }); }
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// remove the black ground shadow baked into the bottom of each 32px frame (the 3D scene casts real ones);
// the mask is computed on the SD frame and applied to the 4x HD art
function stripShadow(sdImg, hdImg, rows) {
  const W = sdImg.width, H = sdImg.height, s = canvas(W, H), sg = s.getContext('2d'); sg.drawImage(sdImg, 0, 0);
  const sd = sg.getImageData(0, 0, W, H).data;
  const out = canvas(hdImg.width, hdImg.height), og = out.getContext('2d'); og.drawImage(hdImg, 0, 0);
  const od = og.getImageData(0, 0, out.width, out.height);
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && sd[(y * W + x) * 4 + 3] > 0;
  const dark = (x, y) => { const i = (y * W + x) * 4; return sd[i] + sd[i + 1] + sd[i + 2] < 40; };
  const colored = (x, y) => op(x, y) && !dark(x, y);
  for (let y = 0; y < H; y++) {
    const fy = y % 32; if (fy < 25 || (rows && !rows.includes(Math.floor(y / 32)))) continue;
    for (let x = 0; x < W; x++) {
      if (!op(x, y) || !dark(x, y)) continue;
      if (colored(x - 1, y) || colored(x + 1, y) || colored(x, y - 1)) continue;
      for (let yy = 0; yy < HD; yy++) for (let xx = 0; xx < HD; xx++) od.data[((y * HD + yy) * out.width + x * HD + xx) * 4 + 3] = 0;
    }
  }
  og.putImageData(od, 0, 0); return out;
}
function upscale(img, k) { const c = canvas(img.width * k, img.height * k), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height); return c; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; }

export class SpriteBank {
  async load(names) {
    this.sheets = this.sheets || {};   // kept across battles: only new sprites load
    await Promise.all(names.filter(n => !this.sheets[n]).map(async n => {
      if (!isLegacy(n)) {             // the generated 32px sheet (tools/rom/export.py) and its xBR 4x (tools/hd/upscale.js)
        const sd = await load('assets/units/' + n + '.png');
        let hd; try { hd = await load('assets/units/hd/' + n + '.png'); } catch (e) { hd = upscale(sd, HD); }
        const e = { walk: stripShadow(sd, hd), acts: {} };
        // its action frames for each attack type it is seen with (tools/rom/actions.py: attack, hurt, guard, cast)
        for (const t of ((globalThis.ACTIONS || {}).sheets || {})[n] || []) {
          const f = n + '-' + t + '.png', asd = await load('assets/units/act/' + f);
          let ahd; try { ahd = await load('assets/units/act/hd/' + f); } catch (err) { ahd = upscale(asd, HD); }
          const act = stripShadow(asd, ahd, [0, 2, 3]); e.acts[t] = { act, atk: this.attackComposite(act, t, true) };
        }
        this.sheets[n] = e; return;
      }
      const [walk, walkSD] = await Promise.all([load('assets/spr_' + n + '.png'), load('assets/sd/spr_' + n + '.png')]);
      const e = { walk: stripShadow(walkSD, walk) };
      try { const [f, fs] = await Promise.all([load('assets/sprf_' + n + '.png'), load('assets/sd/sprf_' + n + '.png')]); e.flash = stripShadow(fs, f); } catch (err) { /* no flash sheet */ }
      if (AD && AD.act[n]) {
        const [act, actSD] = await Promise.all([load('assets/act_' + n + '.png'), load('assets/sd/act_' + n + '.png')]);
        e.act = stripShadow(actSD, act, [0, 2, 3]);
        e.atk = this.attackComposite(e.act, AD.act[n].type);
      } else {   // a legacy sheet the 磻溪 build gave no actions (姜子牙): the generated ones of its graphic
        const g = Object.keys(LEGACY).find(k => LEGACY[k] === n), gn = g && (+g).toString(16).padStart(6, '0');
        e.acts = {};
        for (const t of ((globalThis.ACTIONS || {}).sheets || {})[gn] || []) {
          const f = gn + '-' + t + '.png', asd = await load('assets/units/act/' + f);
          let ahd; try { ahd = await load('assets/units/act/hd/' + f); } catch (err) { ahd = upscale(asd, HD); }
          const act = stripShadow(asd, ahd, [0, 2, 3]); e.acts[t] = { act, atk: this.attackComposite(act, t, true) };
        }
      }
      this.sheets[n] = e;
    }));
  }
  // join each attack frame with its weapon piece, as placed by the ROM table at 0xE714, into 64px cells
  // (raw: the piece is stored as its 2x4 tiles in the VDP's column order, tools/rom/actions.py; a 4x2 piece is re-tiled)
  attackComposite(act, typ, raw) {
    const recs = AD.attack.records[typ], c = canvas(9 * 64 * HD, 64 * HD), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let di = 0; di < 3; di++) for (let k = 0; k < 3; k++) {
      const col = di * 3 + k, ox = col * 64 * HD + 16 * HD, oy = 16 * HD;
      g.drawImage(act, col * 32 * HD, 0, 32 * HD, 32 * HD, ox, oy, 32 * HD, 32 * HD);
      if (typ !== 2) {
        const [w, h] = typ === 1 && di < 2 ? [32, 16] : [16, 32], r = recs[di];
        if (raw && w === 32) for (let i = 0; i < 8; i++) {   // tile i: at (i >> 2, i & 3) in the 2x4 store, (i >> 1, i & 1) in the 4x2 piece
          const T = 8 * HD; g.drawImage(act, col * 32 * HD + (i >> 2) * T, 32 * HD + (i & 3) * T, T, T, ox + r.ex * HD + (i >> 1) * T, oy + r.ey * HD + (i & 1) * T, T, T);
        }
        else g.drawImage(act, col * 32 * HD, 32 * HD, w * HD, h * HD, ox + r.ex * HD, oy + r.ey * HD, w * HD, h * HD);
      }
    }
    return c;
  }
  // a small canvas portrait (first walk frame) for UI
  portrait(n, scale) {
    const e = this.sheets[n], c = canvas(32 * scale, 32 * scale), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(e.walk, 0, 0, 32 * HD, 32 * HD, 0, 0, 32 * scale, 32 * scale); return c;
  }
  // the same, marking time facing down as on the map (the walk cycle's down frames, 165 ms each); stops when the canvas
  // leaves the page
  walker(n, scale) {
    const e = this.sheets[n], c = canvas(32 * scale, 32 * scale), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    let k = 0, started = false;
    const draw = () => { g.clearRect(0, 0, c.width, c.height); g.drawImage(e.walk, FACE.down[k % 4] * 32 * HD, 0, 32 * HD, 32 * HD, 0, 0, 32 * scale, 32 * scale); };
    draw(); const id = setInterval(() => { if (!c.isConnected) { if (started) clearInterval(id); return; } started = true; k++; draw(); }, 165);
    return c;
  }
}

const shadowTex = (() => {
  const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
})();

// sprite material: lit by the scene, never fully dark, with hit flash and an ember dissolve for deaths
function spriteMaterial(map) {
  const m = new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: new THREE.Color(0.42, 0.42, 0.42), alphaTest: 0.5, side: THREE.DoubleSide });
  m.userData.u = { uDissolve: { value: 0 }, uFlash: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uDissolve, uFlash; uniform vec3 uTint;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      float dn = vn2(vMapUv * 48.0) * 0.7 + vn2(vMapUv * 120.0) * 0.3;
      if (uDissolve > 0.0 && dn < uDissolve * 1.15 - 0.05) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance = totalEmissiveRadiance * uTint + vec3(uFlash) * diffuseColor.rgb * 2.5 + vec3(uFlash * 0.4);
      if (uDissolve > 0.0) totalEmissiveRadiance += vec3(1.0, 0.45, 0.1) * 4.0 * (1.0 - smoothstep(0.0, 0.12, dn - (uDissolve * 1.15 - 0.05)));`);
  };
  return m;
}

export class Actor {
  constructor(bank, unit, scene) {
    this.u = unit; this.bank = bank; this.sheet = bank.sheets[unit.sprite];
    if (this.sheet.acts) {   // a generated sheet: the action frames of this unit's attack type (else the first it has)
      const ts = Object.keys(this.sheet.acts), t = this.sheet.acts[unit.atkType] ? unit.atkType : ts[0];
      if (t != null) this.sheet = Object.assign({}, this.sheet, this.sheet.acts[t]);
    }
    this.pos = new THREE.Vector3(unit.x + 0.5, 0, unit.y + 0.5); this.pos.y = groundH(this.pos.x, this.pos.z);
    this.off = new THREE.Vector2(); this.act = null; this.walking = false; this.flash = 0; this.dissolve = 0; this.hover = unit.sprite === 'ghost' ? 0.22 : 0;
    // normal frames (32px cells) and attack composites (64px cells)
    this.texWalk = tex(this.sheet.walk); this.texWalk.repeat.set(1 / 9, 1);
    if (this.sheet.flash) { this.texFlash = tex(this.sheet.flash); this.texFlash.repeat.set(1 / 9, 1); }
    if (this.sheet.act) { this.texAct = tex(this.sheet.act); this.texAct.repeat.set(1 / 9, 1 / 4); this.texAtk = tex(this.sheet.atk); this.texAtk.repeat.set(1 / 9, 1); }
    const g1 = new THREE.PlaneGeometry(1, 1); g1.translate(0, 0.5, 0);
    const g2 = new THREE.PlaneGeometry(2, 2); g2.translate(0, 0.5, 0);
    this.mat = spriteMaterial(this.texWalk);
    this.mesh = new THREE.Mesh(g1, this.mat); this.big = new THREE.Mesh(g2, spriteMaterial(this.texAtk || this.texWalk));
    this.big.visible = false;
    // shadow caster: same frame, turned to face the sun, invisible to the camera
    // (three r160's shadow pass takes map and alphaTest from the object's own material, even over customDepthMaterial:
    // without them here every sprite casts its whole quad, a rectangle)
    this.caster = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, map: this.texWalk, alphaTest: 0.5 }));
    this.caster.castShadow = true;
    this.caster.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.texWalk, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.root = new THREE.Group(); this.root.add(this.mesh, this.big, this.caster, this.blob); scene.add(this.root);
    this.mesh.renderOrder = this.big.renderOrder = 2;
  }
  // which of down/up/left/right to show, given the unit's world facing and the camera yaw
  viewDir(yaw) {
    const f = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.u.facing];
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), dx = Math.sin(yaw), dz = Math.cos(yaw);
    const sx = f[0] * rx + f[1] * rz, sy = f[0] * dx + f[1] * dz;
    return Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up');
  }
  update(t, cam, yaw, pitch) {
    this.camPitch = pitch;
    const u = this.u, vd = this.viewDir(yaw), flip = vd === 'right';
    let tx = this.texWalk, frame, mesh = this.mesh;
    if (this.act && this.act.kind === 'atk' && this.texAtk) {
      mesh = this.big; tx = this.texAtk;
      frame = ATK_DIR[vd] * 3 + this.act.frame;
    } else if (this.act && this.act.kind === 'pose' && this.texAct) {
      // act sheet row 2/3: hurt (0-2), guard (3-5) by direction, cast (6-8) by frame; row 3 is the flash palette
      tx = this.texAct; tx.offset.y = 1 - (this.act.row + 1) / 4;
      frame = this.act.base + (this.act.fixed != null ? this.act.fixed : (vd === 'down' ? 0 : vd === 'up' ? 1 : 2));
    } else {
      if (this.flashPal && this.texFlash) tx = this.texFlash;
      // the cycle runs on its own clock, so a change of pace (walking/standing, a scene's slow march: walkMs) never jumps a frame
      const ms = this.walking ? (this.walkMs || 95) : 165;
      this.anim = (this.anim == null ? t * 1000 / ms : this.anim + Math.max(0, t - this.animT) * 1000 / ms); this.animT = t;
      const tick = Math.floor(this.anim);
      // units that have acted this round stand still on their first frame; the rest mark time like the original
      // each unit marks time out of step with its neighbours: a phase fixed when it first shows (from the cell it stood
      // on then: a phase from the current cell would skip a frame every cell crossed on a walk)
      if (this.phase == null) this.phase = (u.x * 3 + u.y + (parseInt(u.slot, 10) || 0)) & 3;
      const step = u.done && !this.walking ? 0 : (tick + this.phase) % 4;
      frame = u.sprite === 'jiang_bound' ? tick % 2 : u.still != null ? u.still : FACE[flip ? 'left' : vd][step];
      if (this.u.sprite === 'jiang_bound') { tx.repeat.x = 1 / 2; }
    }
    const nFrames = tx === this.texAtk ? 9 : (u.sprite === 'jiang_bound' && tx === this.texWalk ? 2 : 9);
    tx.offset.x = frame / nFrames;
    const mirror = flip && !(this.act && this.act.kind === 'pose' && this.act.fixed != null);
    tx.repeat.x = (mirror ? -1 : 1) / nFrames; if (mirror) tx.offset.x = (frame + 1) / nFrames;
    mesh.material.map = tx; mesh.material.emissiveMap = tx;
    this.mesh.visible = mesh === this.mesh; this.big.visible = mesh === this.big;
    // billboard: stand upright, face the camera around the vertical axis
    const lx = this.pos.x + this.off.x, lz = this.pos.z + this.off.y;
    const bob = (this.hover ? this.hover + Math.sin(t * 2.4 + u.x) * 0.06 : 0) + (this.lift || 0);   // lift: a scripted height (a fall from the sky)
    this.root.position.set(0, 0, 0);
    // lean the sprite back toward the camera so it never reads as squashed from high angles (HD-2D trick)
    const tilt = Math.max(0, (this.camPitch || 0.9) - 0.35) * 0.75;
    for (const m of [this.mesh, this.big]) { m.position.set(lx, this.pos.y + bob, lz); m.rotation.set(-tilt, yaw, this.spin || 0, 'YXZ'); m.scale.setScalar(this.size ?? 1); }
    if (this.centre) {   // a scripted point in the air the sprite's middle sits on, turning about it (the 昌平村 descent)
      for (const m of [this.mesh, this.big]) m.position.copy(this.centre).sub(TMP.set(0, 0.5 * (this.size ?? 1), 0).applyEuler(m.rotation));
    } else {
      // keep the sprite in front of the ground it stands on
      const cam2 = TMP.set(cam.position.x - lx, 0, cam.position.z - lz).normalize().multiplyScalar(0.12);
      this.mesh.position.add(cam2); this.big.position.add(cam2);
    }
    this.caster.visible = !this.centre;
    const sunYaw = Math.atan2(-0.55, 0.32) + Math.PI;
    this.caster.position.set(lx, this.pos.y + bob, lz); this.caster.rotation.set(0, sunYaw, 0);
    this.caster.customDepthMaterial.map = tx; this.caster.material.map = tx;
    this.blob.position.set(lx, this.pos.y + 0.025, lz + 0.02); this.blob.scale.setScalar(this.hover ? 0.7 : 1);
    // fade: a quiet fade out and in (0-1; a story actor walking off the original's screen, src/scene.js), unlike the
    // ember dissolve of a death; a ghost keeps its own translucency on top
    const fade = this.fade ?? 1, see = fade > 0.995;
    this.blob.material.opacity = this.centre ? 0 : (1 - this.dissolve) * (this.hover ? 0.6 : 1) * fade;
    for (const m of [this.mesh.material, this.big.material]) {
      m.userData.u.uFlash.value = this.flash; m.userData.u.uDissolve.value = this.dissolve;
      const tr = !see || !!this.ghost; if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
      m.opacity = (this.ghost ? 0.62 : 1) * fade; m.alphaTest = see ? 0.5 : 0.5 * fade;
    }
    if (fade < 0.5) this.caster.visible = false;
    this.root.visible = this.dissolve < 1 && !this.hidden && fade > 0.01;
  }
  head() { return new THREE.Vector3(this.pos.x + this.off.x, this.pos.y + 1.05 + this.hover + (this.lift || 0), this.pos.z + this.off.y); }
  chest() { return new THREE.Vector3(this.pos.x + this.off.x, this.pos.y + 0.5 + this.hover + (this.lift || 0), this.pos.z + this.off.y); }
  dispose(scene) { scene.remove(this.root); }
}
