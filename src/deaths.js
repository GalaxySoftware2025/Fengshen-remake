// The reimagined hero falls (samples, #...&deathfx; the game plays battle.js allyDeath, the original's fall): each hero's
// own, sad and grand, from their look and their story, as the level-ups are [the user's call]. The camera keeps the
// player's angle and zoom (it only pans); the world's colour drains while the hero falls and comes back after. No
// burst sound (the original's 0x806F as a body goes): a hero's fall is quiet but for the lament [the user's call].
//   林雲 (cid 0)  the sword left standing: he drives his sword into the earth and kneels on it; the colour drains to a cold
//                 grey and rain comes; one shaft of pale sunlight breaks through onto him; his spirit stands up out of
//                 the body and rises up the light, going to motes; the body fades and leaves the sword planted where he
//                 knelt, its red tassel stirring in the rain; the blade catches the light once and goes to light too
//   哪吒 (cid 4)  return to the lotus: he spins and falls to his knees; the world dims to a warm sepia; the 混天綾 slips off him and is carried away on the wind; a lotus
//                 opens under him and he breaks into its petals; it sheds its petals, which rise into the sky (the
//                 lotus body he was reborn in); the 乾坤圈 falls where he knelt, rolls, settles like a coin and glints
import * as THREE from 'three';
import { effectH, rand } from './world.js';
import { world, vfx, cam, ui, anim, wait, V, actorOf, deathSpin, dieTex, activeMark, targetMark, tiles } from './battle.js';
import { D } from './rules.js';
import { jingle, sfx } from './audio.js';
import { lotusBloom, lotusTex, clothStrip, canvasTex, once, glowStrip, limb, petalTex, houndTex, eyeTex, drawPhoenix, bannerTex, dragonHeadTex, leiFlapFrames } from './levelup.js';
import { sheets as fireSheets } from './kit/fire.js';

// ---------------------------------------------------------------- shared pieces
const ease = k => k * k * (3 - 2 * k);
const axes = () => { const q = world.camera.quaternion; return { right: V(1, 0, 0).applyQuaternion(q).setY(0).normalize(), toCam: V(0, 0, 1).applyQuaternion(q).setY(0).normalize(), up: V(0, 1, 0).applyQuaternion(q) }; };
// the world's colour drains (k 0-1) toward a tint (cold grey, warm sepia), and comes back
function drain(tint) {
  const gr = world.grade.uniforms, sat0 = gr.uSat.value;
  return { set(k, sat = 0.22, dark = 0.3) { gr.uSat.value = sat0 + (sat - sat0) * k; vfx.screen.darkTarget = dark * k; vfx.screen.darkCol.setRGB(...tint); }, done() { gr.uSat.value = sat0; vfx.screen.darkTarget = 0; } };
}
// the hero's own frames on a 256 px canvas (the tex act's: the body in its middle 128): the standing frame (walk 0)
function standTex(a) {
  const img = a.texWalk.image, fw = img.width / 9, c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, fw, img.height, 64, 64, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a glowing copy of a frame on the actor's big plane: the spirit
function spiritOf(a, map, col) {
  const m = new THREE.Mesh(a.big.geometry.clone(), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(...col), transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }));
  m.renderOrder = 7; m.position.copy(a.big.position); m.rotation.copy(a.big.rotation); m.scale.copy(a.big.scale); vfx.timed(m, 1e9, () => {}); return m;
}
const drop = m => { const it = vfx.items.find(i => i.mesh === m); if (it) it.life = 0; };
// the stage for a fall: the HUD and the turn marks away; a vignette darkens the world round the hero (a spotlight that
// follows it on the screen), drawn over the scenery with the hero over it; the hero a fifth larger (as the original's
// fall here); set(k) brings it in, done() puts everything back
function stage(a, P) {
  const hud = document.getElementById('hud'), hudOn = hud && !hud.classList.contains('hidden'), marks = [activeMark && activeMark.group, targetMark && targetMark.group, tiles && tiles.cursor, tiles && tiles.marker].filter(Boolean).map(g => [g, g.visible]);
  if (hudOn) ui.show('hud', false); for (const [g] of marks) g.visible = false;
  const kept = [a.mesh, a.big].map(m => [m, m.material.depthTest, m.renderOrder]), wasOver = a.over;
  a.over = true; for (const m of [a.mesh, a.big]) { m.material.depthTest = false; m.renderOrder = 8; }
  const mat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uK: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uAsp: { value: 1 }, uTint: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uK, uAsp; uniform vec2 uC; uniform vec3 uTint; varying vec2 vUv;
      void main(){ vec2 d = (vUv - uC) * vec2(uAsp, 1.0); float r = length(d);
        float a = smoothstep(0.1, 0.62, r) * 0.88 * uK; gl_FragColor = vec4(uTint * a, a); }` });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); quad.renderOrder = 6.8; quad.frustumCulled = false;
  const cm = world.camera, d = new THREE.Vector3(), c = new THREE.Vector3();
  vfx.timed(quad, 1e9, () => {
    cm.getWorldDirection(d); quad.position.copy(cm.position).addScaledVector(d, 1); quad.quaternion.copy(cm.quaternion);
    const hh = 2 * Math.tan(cm.fov * Math.PI / 360) * 1.02; quad.scale.set(hh * cm.aspect, hh, 1); mat.uniforms.uAsp.value = cm.aspect;
    c.copy(P).setY(P.y + 0.7).project(cm); mat.uniforms.uC.value.set(c.x * 0.5 + 0.5, c.y * 0.5 + 0.5);
  });
  return {
    set(k) { mat.uniforms.uK.value = k; a.size = 1 + 0.2 * k; },
    done() { drop(quad); a.over = wasOver; for (const [m, dt, ro] of kept) { m.material.depthTest = dt; m.renderOrder = ro; } a.size = 1; for (const [g, v] of marks) g.visible = v; if (hudOn) ui.show('hud', true); },
  };
}
// a soft glow behind a spirit (the same frame, larger, additive)
function aura(sp, col) {
  const m = new THREE.Mesh(sp.geometry, new THREE.MeshBasicMaterial({ map: sp.material.map, color: new THREE.Color(...col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  m.renderOrder = 6.9; vfx.timed(m, 1e9, () => { m.position.copy(sp.position); m.rotation.copy(sp.rotation); m.scale.copy(sp.scale).multiplyScalar(1.12); m.material.opacity = sp.material.opacity * 0.8; }); return m;
}
// rain round a point: thin streaks falling at a slant, splashing small on the ground; rain.k (0-1) how hard
function rain(P) {
  const N = 1400, geo = new THREE.InstancedBufferGeometry(), base = new THREE.PlaneGeometry(0.016, 0.7); base.translate(0, 0.35, 0);
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const seed = new Float32Array(N * 4); for (let i = 0; i < N; i++) seed.set([rand(-7, 7), rand(-5, 5), Math.random(), rand(0.7, 1.3)], i * 4);
  geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 4)); geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uT: { value: 0 }, uK: { value: 0 }, uC: { value: new THREE.Vector3(P.x, P.y, P.z) } },
    vertexShader: `attribute vec4 iSeed; uniform float uT, uK; uniform vec3 uC; varying float vA; varying vec2 vUv;
      void main(){ vUv = uv; float h = 7.0, f = fract(iSeed.z - uT * 1.25 * iSeed.w);   // each drop's fall, looping
        vec3 base = uC + vec3(iSeed.x - (1.0 - f) * 1.2, f * h - 0.2, iSeed.y);   // slanting a little in the wind
        vec3 dir = normalize(vec3(-0.17, 1.0, 0.0)), toCam = normalize(cameraPosition - base), side = normalize(cross(dir, toCam));
        vec3 p = base + side * position.x + dir * position.y;
        vA = step(fract(iSeed.z * 7.13), uK) * smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.85, f);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vA; varying vec2 vUv; void main(){ float a = vA * (1.0 - abs(vUv.x * 2.0 - 1.0)) * vUv.y * 0.75; gl_FragColor = vec4(vec3(0.78, 0.85, 0.95) * a, a); }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 6;
  const o = { k: 0 }; let acc = 0;
  vfx.timed(mesh, 1e9, (k, dt) => {
    mat.uniforms.uT.value += dt; mat.uniforms.uK.value = o.k;
    for (acc += dt * o.k * 60; acc > 1; acc--) {   // splashes: a few small droplets kicked up where drops land
      const x = P.x + rand(-6, 6), z = P.z + rand(-4, 4), y = effectH(x, z);
      vfx.spark(x, y + 0.02, z, { vx: rand(-0.3, 0.3), vy: rand(0.4, 0.9), vz: rand(-0.3, 0.3), g: 5, life: 0.22, size: 0.018, r: 0.8, gg: 0.86, b: 0.95, shape: 1 });
    }
  });
  o.end = () => drop(mesh); return o;
}
// a shaft of light from high above onto a point (soft, warm, dust turning in it); shaft.k (0-1) its strength, w its width
function shaft(P, col) {
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uK: { value: 0 }, uT: { value: 0 }, uC: { value: new THREE.Color(...col) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uK, uT; uniform vec3 uC; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
        float body = (1.0 - smoothstep(0.25, 1.0, x)) * (0.55 + 0.45 * n(vec2(vUv.x * 6.0, y * 2.0 - uT * 0.15)));
        float a = body * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.6, 1.0, y)) * 0.95 * uK;
        gl_FragColor = vec4(uC * a, a); }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 6.85;
  const o = { k: 0, w: 2.2 }; let acc = 0;
  vfx.timed(m, 1e9, (k, dt, t) => {
    const { up } = axes(); mat.uniforms.uT.value = t; mat.uniforms.uK.value = o.k;
    // laid along the screen's up from below the hero's feet (straight and even, as the user asked of the pillar), leaning a little
    m.quaternion.copy(world.camera.quaternion); m.rotateZ(-0.12); m.position.set(P.x, P.y, P.z).addScaledVector(up, -0.4); m.scale.set(o.w, 11, 1);
    for (acc += dt * o.k * 14; acc > 1; acc--) vfx.spark(P.x + rand(-0.5, 0.5), P.y + rand(0.2, 2.6), P.z + rand(-0.3, 0.3), { vx: rand(-0.06, 0.06), vy: rand(-0.04, 0.08), life: rand(1.5, 2.5), size: rand(0.02, 0.035), r: col[0], gg: col[1], b: col[2] * 0.85, shape: 1, wob: 0.3, ph: rand(0, 6) });
  });
  o.end = () => drop(m); return o;
}

// ---------------------------------------------------------------- 林雲: the sword left standing
// a straight jian: a bright steel blade with a ridge, a gilt guard, a dark bound grip, a pommel, a red silk tassel
function jian() {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xdfe8f0, metalness: 0.95, roughness: 0.18, envMapIntensity: 1.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a843, metalness: 0.9, roughness: 0.3 }), grip = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.8 });
  const shape = new THREE.Shape(); shape.moveTo(-0.032, 0); shape.lineTo(0.032, 0); shape.lineTo(0.026, 0.86); shape.lineTo(0, 0.95); shape.lineTo(-0.026, 0.86); shape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 }), steel);
  blade.position.z = -0.006; blade.rotation.x = Math.PI; blade.position.y = 0.95; g.add(blade);   // (pointing down into the earth)
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), gold); guard.position.y = 0.97; g.add(guard);
  const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 10), grip); gp.position.y = 1.09; g.add(gp);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gold); pommel.position.y = 1.2; g.add(pommel);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
async function linYun(u) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing, { right, toCam } = axes(), cold = drain([0.55, 0.58, 0.62]);
  cam.shot(P.clone().setY(P.y + 0.6), { speed: 2.4 });
  const pose = dieTex(D.heroes[u.cid].gfx), stand = standTex(a);
  await deathSpin(u, false, 3);
  const tx = await pose; u.facing = 'down'; if (tx) a.act = { kind: 'tex', tex: tx };
  const st = stage(a, P);
  // the sword goes into the earth: a jolt of dust where its point bites
  const tipAt = P.clone().addScaledVector(right, -0.27).addScaledVector(toCam, 0.05);
  vfx.burst(tipAt.clone().setY(tipAt.y + 0.05), { n: 14, speed: 1.2, cols: [[0.7, 0.62, 0.5], [0.55, 0.48, 0.4]], size: 0.04, life: 0.6, g: 3, up: 0.6, shape: 1 });
  vfx.smokePuff(tipAt.x, tipAt.y + 0.05, tipAt.z, { vy: 0.15, life: 1.0, size: 0.15, size1: 0.45, tint: [0.5, 0.45, 0.38] }); vfx.shake(0.04, 0.2);
  const r = rain(P);
  try {
    await anim(1.6, k => { cold.set(ease(k), 0.15, 0.42); st.set(ease(k)); r.k = ease(k) * 0.85; });       // the colour drains, the dark closes in, the rain comes
    jingle(0x0a);                                                           // the lament
    const sun = shaft(P, [1, 0.9, 0.7]);
    vfx.light(P.clone().setY(P.y + 2), [1, 0.9, 0.7], 6, 6.5, 6);
    await anim(1.0, k => { sun.k = ease(k); });                               // one shaft of pale sunlight breaks through onto him
    // his spirit stands up out of the body, pauses, and goes up the light, dissolving into motes
    const sp = spiritOf(a, stand, [0.8, 0.92, 1.25]), { up } = axes(); aura(sp, [0.45, 0.7, 1]);
    await anim(1.0, k => { sp.material.opacity = 0.75 * ease(k); sp.position.copy(a.big.position).addScaledVector(up, 0.15 * k); });
    await wait(500);
    const sword = jian(); sword.position.copy(tipAt).setY(effectH(tipAt.x, tipAt.z) - 0.32); sword.rotation.set(0.08, 0.6, -0.1); sword.scale.setScalar(1.6); world.scene.add(sword);   // (larger than life: a marker)
    const tassel = clothStrip({ col: [0.85, 0.08, 0.06], width: 0.04, n: 14 });
    const pommel = () => sword.localToWorld(V(0, 1.2, 0));
    let T = 0;
    await anim(2.6, (k, dt = 1 / 60) => {
      T += dt;
      sp.position.copy(a.big.position).addScaledVector(up, 0.15 + k * 4.5); sp.material.opacity = 0.75 * (1 - ease(Math.max(0, k - 0.35) / 0.65));
      for (let i = 0; i < 3; i++) if (Math.random() < 0.7) { const q = sp.position.clone().add(V(rand(-0.3, 0.3), rand(0.2, 1.2), 0)); vfx.spark(q.x, q.y, q.z, { vy: rand(0.6, 1.4), vx: rand(-0.1, 0.1), life: rand(0.8, 1.4), size: rand(0.025, 0.045), r: 0.75, gg: 0.88, b: 1, shape: 1, wob: 0.3, ph: rand(0, 6) }); }
      a.fade = Math.max(0, 1 - k * 1.4);                                    // the body fades: the sword stands where he knelt
      const p = pommel(); tassel.push(p.clone().add(V(Math.sin(T * 3) * 0.02, -0.02 - k * 0, 0)));
      for (let i = 1; i < 3; i++) tassel.push(p.clone().add(V(Math.sin(T * 2.6 + i) * 0.03 + 0.01 * i, -0.06 * i, Math.cos(T * 2.2 + i) * 0.02)));
    });
    drop(sp); a.hidden = true;
    // the rain eases; the blade catches the light once and goes to light too
    await anim(1.0, (k, dt = 1 / 60) => { T += dt; r.k = 0.85 * (1 - k); sun.k = 1 - 0.4 * k; const p = pommel(); tassel.push(p.clone().add(V(Math.sin(T * 3) * 0.02, -0.04, 0))); });
    const tip = pommel(); vfx.light(tip, [1, 0.95, 0.85], 10, 0.4, 3);
    vfx.burst(tip, { n: 6, speed: 0.3, col: [1, 1, 1], size: 0.18, life: 0.35, g: 0, shape: 1 });   // the glint
    await wait(350);
    await anim(1.2, k => {
      sword.scale.setScalar(1.6 * (1 - ease(k) * 0.15)); sword.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 1 - k; } });
      if (Math.random() < 0.8) { const q = sword.localToWorld(V(0, rand(0, 1.2), 0)); vfx.spark(q.x, q.y, q.z, { vy: rand(0.5, 1.2), life: 1.0, size: 0.03, r: 0.85, gg: 0.92, b: 1, shape: 1 }); }
      sun.k = 0.6 * (1 - k); cold.set(1 - ease(k), 0.15, 0.42); st.set(1 - ease(k));
    });
    world.scene.remove(sword); tassel.fade(0.2); sun.end();
  } finally { r.end(); cold.done(); st.done(); a.act = null; a.hidden = false; a.fade = 1; a.dissolve = 1; u.facing = face; cam.release(); }
}

// ---------------------------------------------------------------- 哪吒: return to the lotus
async function nezha(u) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing, { right, toCam } = axes(), sepia = drain([0.42, 0.5, 0.62]);
  cam.shot(P.clone().setY(P.y + 0.6), { speed: 2.4 });
  const pose = dieTex(D.heroes[u.cid].gfx), lift0 = a.hover || 0;
  const st = stage(a, P);
  await deathSpin(u, false, 3);   // (no wind-fire wheels: the user's call)
  const tx = await pose; u.facing = 'down'; if (tx) a.act = { kind: 'tex', tex: tx };
  vfx.burst(P.clone().setY(P.y + 0.05), { n: 16, speed: 1.4, cols: [[0.7, 0.6, 0.5], [0.5, 0.42, 0.36]], size: 0.04, life: 0.5, g: 3, up: 0.5, shape: 1 }); vfx.shake(0.05, 0.2);
  try {
    // the world dims; the sash slips from his shoulders and the wind takes it
    const sash = clothStrip({ col: [0.88, 0.08, 0.06], width: 0.11, n: 40 });
    const head = a.chest().add(V(0.05, 0.1, 0)), vel = V(0.45, 0.25, -0.05);
    let T = 0;
    await anim(1.6, (k, dt = 1 / 60) => {
      T += dt; sepia.set(ease(k), 0.3, 0.42); st.set(ease(k));
      vel.x += Math.sin(T * 2.1) * dt * 0.6; vel.y += (Math.cos(T * 1.7) * 0.4 + 0.15) * dt; head.addScaledVector(vel, dt);
      sash.push(head.clone().add(V(0, Math.sin(T * 6) * 0.05, Math.cos(T * 5) * 0.04)));
    });
    jingle(0x0a);                                                           // the lament
    // a lotus opens under him, glowing; he breaks into its petals
    const lotus = lotusBloom(P); lotus.root.scale.setScalar(2.2); const glow = vfx.light(P.clone().setY(P.y + 0.4), [1, 0.62, 0.75], 6, 4.5, 4);
    vfx.decal(P, [1, 0.55, 0.7], 1.1, 4.5, { intensity: 0.45 });
    await anim(1.3, (k, dt = 1 / 60) => { T += dt; lotus.open(ease(k) * 1.05); head.addScaledVector(vel, dt); vel.y += dt * 0.2; sash.push(head.clone()); });
    const PT = lotusTex(), petal = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.36), new THREE.MeshBasicMaterial({ map: PT, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 7; return m; };
    const fly = (from, k0, up = 1) => { const m = petal(); m.position.copy(from); const v = V(rand(-0.5, 0.5), rand(0.6, 1.4) * up, rand(-0.3, 0.3)), sp = V(rand(-4, 4), rand(-3, 3), rand(-4, 4));
      vfx.timed(m, rand(2.2, 3.2), (k, dt) => { v.x += Math.sin(k * 9 + from.x) * dt * 0.8; v.multiplyScalar(1 - dt * 0.3); m.position.addScaledVector(v, dt); m.rotation.x += sp.x * dt; m.rotation.y += sp.y * dt; m.rotation.z += sp.z * dt; m.material.opacity = Math.min(1, k * 6) * (1 - k); }); };
    await anim(1.8, (k, dt = 1 / 60) => {
      T += dt; a.fade = Math.max(0, 1 - k * 1.25); head.addScaledVector(vel, dt); sash.push(head.clone());
      for (let i = 0; i < 3; i++) if (Math.random() < 0.9 * (1 - k * 0.6)) fly(a.chest().add(V(rand(-0.25, 0.25), rand(-0.45, 0.35), rand(-0.1, 0.1))), k, 2.4);   // (his petals rise into the sky)
    });
    a.hidden = true; sash.fade(0.6);
    // the lotus under him fades slowly away, whole (no bud rising, no petals of its own: the user's calls)
    const lm = []; lotus.root.traverse(o => { if (o.isMesh) { o.material.alphaTest = 0; o.material.depthWrite = false; lm.push(o.material); } });
    // the 乾坤圈 drops where he knelt, rolls in a small curve and settles flat like a coin
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 12, 40), new THREE.MeshStandardMaterial({ color: 0xe0a83a, metalness: 0.9, roughness: 0.25, emissive: 0x3a2000 }));
    ring.castShadow = true; world.scene.add(ring);
    const r0 = P.clone().addScaledVector(toCam, 0.15), rv = V(0.6, 0, 0.25);
    await anim(2.2, (k, dt = 1 / 60) => {
      for (const m of lm) m.opacity = 1 - ease(k);
      // the ring: a short drop and bounce, rolling on its edge, wobbling down to lie flat
      const kr = Math.min(1, k / 0.8), gy = effectH(r0.x, r0.z);
      const bounce = Math.abs(Math.sin(Math.min(1, kr * 1.8) * Math.PI * 1.5)) * 0.35 * Math.max(0, 1 - kr * 1.8);
      ring.position.copy(r0).addScaledVector(rv, ease(kr)).setY(gy + 0.3 * (1 - ease(Math.max(0, kr - 0.4) / 0.6)) + 0.06 + bounce);
      const lean = ease(Math.max(0, kr - 0.4) / 0.6) * Math.PI / 2;   // from upright to flat
      ring.rotation.set(lean, kr * 8 * (1 - kr), 0, 'YXZ');
    });
    { const it = vfx.items.find(i => i.mesh === lotus.root); if (it) it.life = 0; }
    vfx.light(ring.position.clone().setY(ring.position.y + 0.1), [1, 0.85, 0.5], 8, 0.4, 2);
    vfx.burst(ring.position.clone().setY(ring.position.y + 0.06), { n: 5, speed: 0.25, col: [1, 0.95, 0.75], size: 0.14, life: 0.35, g: 0, shape: 1 });   // the glint
    await wait(500);
    await anim(1.2, k => { ring.material.transparent = true; ring.material.opacity = 1 - k; sepia.set(1 - ease(k), 0.3, 0.42); st.set(1 - ease(k)); });
    world.scene.remove(ring);
  } finally { sepia.done(); st.done(); a.act = null; a.hidden = false; a.fade = 1; a.dissolve = 1; a.hover = lift0; u.facing = face; cam.release(); }
}

// ---------------------------------------------------------------- the frame every other fall plays in
// the spin, the death pose (or standing: o.stand), the stage and the colour drain; body(c) plays the hero's own part and
// brings the colour back at its end (c.set(1 - k)); everything added through c.add goes when the fall ends
const GUEST_GFX = { 文王: 0x06806a, 伯邑考: 0x07f0c2 };   // the protected guests' graphics (battle 22's hook copies their records from 0xF78BE)
const gfxOf = u => (u.cid <= 11 && D.heroes[u.cid] ? D.heroes[u.cid].gfx : 0) || GUEST_GFX[u.name] || u.gfx || 0;   // (the hero's own first: battle 13's bound 姜子牙 carries the stake's graphic)
async function fall(u, tint, body, o = {}) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing, d = drain(tint), lift0 = a.hover || 0, own = [];
  cam.shot(P.clone().setY(P.y + 0.6), { speed: 2.4 });
  const pose = dieTex(gfxOf(u));
  await deathSpin(u, false, 3);
  const tx = await pose; u.facing = 'down'; a.hover = 0;
  if (o.stand) a.act = { kind: 'pose', row: 2, base: 3, fixed: 0 }; else if (tx) a.act = { kind: 'tex', tex: tx };
  const st = stage(a, P), ax = axes();
  const c = { a, P, tx, ...ax, sat: o.sat ?? 0.25, dark: o.dark ?? 0.4,
    set(k) { d.set(k, c.sat, c.dark); st.set(k); },
    add(m, fn = () => {}) { own.push(m); vfx.timed(m, 1e9, fn); return m; },
    head: (h = 0.75) => a.big.position.clone().addScaledVector(ax.up, h * (a.size || 1)) };
  try { await body(c); }
  finally { for (const m of own) drop(m); d.done(); st.done(); a.act = null; a.hidden = false; a.fade = 1; a.dissolve = 1; a.hover = lift0; u.facing = face; cam.release(); }
}
// a copy of the hero's frame drawn over it (normal blending: a tint; additive: a glow)
function overlay(c, map, col, add) {
  const src = c.a.big.visible ? c.a.big : c.a.mesh;   // (the plane the hero is drawn on: the big one for a death pose, the small one for a sheet pose)
  const m = new THREE.Mesh(src.geometry, new THREE.MeshBasicMaterial({ map, color: new THREE.Color(...col), transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.renderOrder = 9; c.add(m, () => { m.position.copy(src.position); m.rotation.copy(src.rotation); m.scale.copy(src.scale); m.visible = !c.a.hidden; }); return m;
}
// a picture card turned to the camera (as levelup.js card), owned by the fall
function pic(c, map, w, h, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, color: new THREE.Color(...(o.col || [1, 1, 1])), opacity: o.op ?? 1 }));
  m.renderOrder = o.order || 7.5; return c.add(m, o.fn);
}
const faceCam = (m, rz = 0) => { m.quaternion.copy(world.camera.quaternion); if (rz) m.rotateZ(rz); };
const colourBack = (c, sec = 1.3) => anim(sec, k => c.set(1 - ease(k)));

// ---------------------------------------------------------------- 燕蓉: the archer of 昌平村, light and quick
// her bow slips from her hands; a blue dusk and blossoms drifting down; she breaks into white-pink butterflies that
// spiral up and away; the bow on the ground fades
function wingTex() { return canvasTex(64, 64, g => {
  g.shadowColor = 'rgba(255,190,230,0.9)'; g.shadowBlur = 6;
  const gr = g.createRadialGradient(4, 32, 2, 4, 32, 60); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#ffd6ec'); gr.addColorStop(1, '#ff8cc6'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(4, 30); g.bezierCurveTo(20, 2, 58, 0, 58, 18); g.bezierCurveTo(58, 30, 30, 32, 4, 32); g.bezierCurveTo(30, 34, 52, 44, 44, 58); g.bezierCurveTo(34, 64, 12, 50, 4, 34); g.fill();
  g.shadowBlur = 0; g.strokeStyle = 'rgba(200,90,150,0.5)'; g.lineWidth = 1; for (const [x, y] of [[50, 12], [40, 26], [38, 50]]) { g.beginPath(); g.moveTo(5, 32); g.lineTo(x, y); g.stroke(); }
}); }
function butterfly(c, p, s) {
  const T = once('wing', wingTex), g = new THREE.Group(), mk = sx => { const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0.5, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: T, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false })); m.scale.set(sx * s, s, 1); m.renderOrder = 7.6; return m; };
  const L = new THREE.Group(), R = new THREE.Group(); L.add(mk(-1)); R.add(mk(1)); g.add(L, R); g.position.copy(p);
  const v = V(rand(-0.4, 0.4), rand(0.5, 1.0), rand(-0.3, 0.3)), ph = rand(0, 6), sp = rand(0.6, 1.2), life = rand(3, 4.5); let t = 0;
  c.add(g, (k, dt) => { t += dt; faceCam(g, Math.sin(t * 1.3 + ph) * 0.3); const f = Math.sin(t * 14 * sp + ph) * 1.1; L.rotation.y = f; R.rotation.y = -f;
    v.x += Math.cos(t * 1.7 + ph) * dt * 1.2; g.position.addScaledVector(v, dt); g.position.y += Math.sin(t * 6 + ph) * dt * 0.3;
    const o = Math.min(1, t * 3) * Math.max(0, 1 - Math.max(0, t - life + 1)); for (const w of [L, R]) w.children[0].material.opacity = o; });
}
async function yanRong(u) {
  await fall(u, [0.62, 0.5, 0.2], async c => {
    const { P, right, toCam } = c;
    // the bow: a curved limb and its string, falling flat beside her
    const curve = new THREE.QuadraticBezierCurve3(V(0, -0.5, 0), V(0.2, 0, 0), V(0, 0.5, 0));
    const bow = new THREE.Group(); bow.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0x8a4a1a, roughness: 0.6 })));
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), new THREE.MeshBasicMaterial({ color: 0xf0e8d0 })); bow.add(str);
    const at = P.clone().addScaledVector(right, 0.42).addScaledVector(toCam, 0.15); bow.position.copy(at).setY(effectH(at.x, at.z) + 0.5);
    c.add(bow);
    await anim(0.6, k => { const e = k * k; bow.rotation.set(0, 0, -e * Math.PI / 2); bow.position.y = effectH(at.x, at.z) + 0.5 - e * 0.47; });
    const PT = once('petal', petalTex), drift = () => { const m = pic(c, PT, 0.12, 0.17, { col: [1, rand(0.7, 0.9), rand(0.8, 0.95)] }); const p = P.clone().add(V(rand(-3, 3), rand(3, 4), rand(-2, 2))); m.position.copy(p);
      const v = V(rand(0.1, 0.4), -rand(0.35, 0.6), 0), sp = rand(-3, 3); let t = 0; const it = vfx.items.find(i => i.mesh === m); it.update = (k, dt) => { t += dt; v.x += Math.sin(t * 2 + sp) * dt * 0.3; m.position.addScaledVector(v, dt); faceCam(m, t * sp); m.material.opacity = Math.min(1, t * 2) * Math.max(0, 1 - Math.max(0, t - 3.5)); }; };
    await anim(1.6, k => { c.set(ease(k)); if (Math.random() < 0.12) drift(); });
    jingle(0x0a);
    await anim(1.2, () => { if (Math.random() < 0.12) drift(); });
    // she breaks into butterflies
    await anim(2.4, (k) => { c.a.fade = Math.max(0, 1 - k * 1.3); if (Math.random() < 0.08) drift();
      if (Math.random() < 0.55 * (1 - k * 0.5)) butterfly(c, c.head(rand(0.15, 0.95)).add(V(rand(-0.25, 0.25), 0, rand(-0.1, 0.1))), rand(0.16, 0.24)); });
    c.a.hidden = true;
    await anim(1.6, k => { bow.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 1 - k; } }); });
    await colourBack(c);
  }, { sat: 0.6, dark: 0.4 });
}

// ---------------------------------------------------------------- 楊戩: 二郎神, the third eye, 哮天犬
// a silver night; his hound runs to him and sits at his side, lifts its head and howls; his third eye opens a last time
// and closes; hound and master go to silver motes together
async function yangJian(u) {
  await fall(u, [0.5, 0.48, 0.32], async c => {
    const { P, right, toCam } = c, map = once('houndD', houndTex).clone(); map.needsUpdate = true;
    const hound = pic(c, map, 1.9, 0.95, { col: [0.85, 0.92, 1.2], op: 0, order: 9.3 }), nF = 5, frame = i => { map.offset.x = i / nF; };
    const sit = P.clone().addScaledVector(right, -0.85).addScaledVector(toCam, 0.15), from = sit.clone().addScaledVector(right, -5);
    await anim(1.6, k => c.set(ease(k)));
    jingle(0x0a);
    let t = 0;
    await anim(1.5, (k, dt = 1 / 60) => { t += dt; frame(Math.floor(t * 10) % 4); const p = from.clone().lerp(sit, 1 - (1 - k) * (1 - k)); hound.position.copy(p).setY(effectH(p.x, p.z) + 0.45); faceCam(hound); hound.scale.x = 1; hound.material.opacity = Math.min(1, k * 4);
      if (Math.random() < 0.5) vfx.spark(p.x, p.y + 0.3, p.z, { vy: rand(0.2, 0.5), life: 0.8, size: 0.03, r: 0.8, gg: 0.9, b: 1, shape: 1 }); });
    frame(4);
    // the howl: rings of silver going out from its head
    const mouth = hound.position.clone().addScaledVector(right, 0.55).add(V(0, 0.3, 0));
    for (let i = 0; i < 3; i++) { vfx.ring(mouth, [0.6, 0.72, 1], 0.6 + i * 0.25, 0.7, { vertical: true, yaw: cam.yaw, y: mouth.y, intensity: 0.3 }); await wait(380); }
    // the third eye: opens on his brow in a gold light, then closes
    const eye = pic(c, once('eye', eyeTex), 0.2, 0.32, { op: 0, order: 9.5 }), brow = () => c.head(0.86);
    vfx.light(brow(), [1, 0.85, 0.5], 4, 1.6, 2);
    await anim(0.6, k => { eye.position.copy(brow()); faceCam(eye); eye.material.opacity = ease(k); });
    await wait(500);
    await anim(0.5, k => { eye.position.copy(brow()); faceCam(eye); eye.scale.y = Math.max(0.02, 1 - ease(k)); });
    eye.visible = false;
    // both to silver motes
    await anim(2.4, k => { c.a.fade = Math.max(0, 1 - k * 1.3); hound.material.opacity = Math.max(0, 1 - k * 1.3);
      for (const q of [c.head(rand(0.1, 0.9)), hound.position.clone().add(V(rand(-0.4, 0.4), rand(-0.2, 0.3), 0))]) if (Math.random() < 0.8) vfx.spark(q.x + rand(-0.15, 0.15), q.y, q.z, { vy: rand(0.5, 1.2), vx: rand(-0.1, 0.1), life: rand(1, 1.8), size: rand(0.025, 0.045), r: 0.82, gg: 0.9, b: 1, shape: 1, wob: 0.3, ph: rand(0, 6) }); });
    c.a.hidden = true;
    await colourBack(c);
  }, { sat: 0.12, dark: 0.45 });
}

// ---------------------------------------------------------------- 黃飛虎: the 武成王, a general to the last
// he dies on his feet, in his guard; an ember dusk; his war banner rises behind him, torn, cracking in the wind; he turns
// to ash and the wind takes him; the banner leans and falls
function warBannerTex() { return canvasTex(128, 192, g => {
  g.fillStyle = '#9a1410'; g.fillRect(0, 0, 128, 192); g.strokeStyle = '#d8a83a'; g.lineWidth = 7; g.strokeRect(5, 5, 118, 182);
  g.fillStyle = '#e8c050'; g.font = 'bold 84px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('黃', 64, 92);
  g.globalCompositeOperation = 'destination-out';   // torn: ragged holes and a frayed free edge
  for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(rand(10, 118), rand(120, 188), rand(4, 12), rand(3, 9), rand(0, 3), 0, 6.28); g.fill(); }
  for (let y = 0; y < 192; y += 6) { g.fillRect(118 + rand(-4, 6), y, 20, rand(3, 6)); }
}); }
async function huangFeihu(u) {
  await fall(u, [0.22, 0.55, 0.78], async c => {
    const { P, right, toCam } = c, H = 2.4, W = 0.8, CH = 1.15;
    const root = new THREE.Group(), base = P.clone().addScaledVector(right, -0.35).addScaledVector(toCam, -0.45); base.y = effectH(base.x, base.z);
    root.rotation.y = Math.atan2(-right.z, right.x);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, H, 8), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.8 })); pole.position.y = H / 2;
    const cg = new THREE.PlaneGeometry(W, CH, 14, 8); cg.translate(W / 2, H - 0.1 - CH / 2, 0); const rest = cg.attributes.position.array.slice();
    const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: once('warBanner', warBannerTex), side: THREE.DoubleSide, transparent: true, alphaTest: 0.2, roughness: 0.9 }));
    root.add(pole, cloth); root.position.copy(base).add(V(0, -H, 0)); let T = 0, wind = 1;
    c.add(root, (k, dt) => { T += dt; const pa = cg.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { const x = rest[i], f = x / W; pa[i + 2] = (Math.sin(x * 7 - T * 8) * 0.1 + Math.sin(rest[i + 1] * 5 - T * 5) * 0.04) * f * wind; } cg.attributes.position.needsUpdate = true; cg.computeVertexNormals(); });
    const ember = () => { const q = P.clone().add(V(rand(-3, 1), rand(0.1, 2.5), rand(-2, 2))); vfx.spark(q.x, q.y, q.z, { vx: rand(0.6, 1.4), vy: rand(0.1, 0.5), vz: rand(-0.1, 0.1), life: rand(1.2, 2.2), size: rand(0.02, 0.04), r: 1, gg: rand(0.4, 0.65), b: 0.12, shape: 1, flicker: 1, ph: rand(0, 6) }); };
    await anim(1.4, k => { c.set(ease(k)); root.position.y = base.y - H + H * (1 - Math.pow(1 - k, 3)); ember(); });
    jingle(0x0a);
    await anim(1.4, () => { ember(); ember(); });
    // to ash: grey creeps over him, then the wind takes him in drifts of ash
    const ash = overlay(c, c.a.texAct, [0.22, 0.2, 0.19], false); ash.material.map = c.a.texAct;
    const ashT = c.a.texAct.clone(); ashT.needsUpdate = true; ash.material.map = ashT;
    await anim(1.0, k => { ashT.offset.copy(c.a.texAct.offset); ashT.repeat.copy(c.a.texAct.repeat); ash.material.opacity = 0.85 * ease(k); ember(); });
    await anim(2.0, k => { ashT.offset.copy(c.a.texAct.offset); ashT.repeat.copy(c.a.texAct.repeat); c.a.fade = Math.max(0, 1 - k * 1.2); ash.material.opacity = 0.85 * Math.max(0, 1 - k * 1.2); ember();
      for (let i = 0; i < 3; i++) { const q = c.head(rand(0.05, 1.0)).add(V(rand(-0.2, 0.2), 0, 0)); vfx.smokePuff(q.x, q.y, q.z, { vx: rand(0.6, 1.2), vy: rand(0.1, 0.4), life: rand(1.2, 2), size: 0.06, size1: rand(0.2, 0.35), tint: [0.28, 0.26, 0.24] }); } });
    c.a.hidden = true;
    // the banner leans and falls; the wind drops
    await anim(1.6, k => { root.rotation.z = -ease(k) * 1.45; wind = 1 - k * 0.7; ember(); });
    await anim(1.3, k => { cloth.material.opacity = 1 - k; pole.material.transparent = true; pole.material.opacity = 1 - k; c.set(1 - ease(k)); });
  }, { stand: true, sat: 0.35, dark: 0.45 });
}

// ---------------------------------------------------------------- 姬發: the crown prince of 西岐, 武王 to be
// a golden dusk; a phoenix of light (the 鳳鳴岐山 omen of his house) rises out of him, spreads its wings over him and
// cries once; it flies up into the sky trailing gold, and he is gone with it
async function jiFa(u) {
  await fall(u, [0.12, 0.32, 0.72], async c => {
    const { P } = c, map = once('phoenix', () => glowStrip(256, 128, 2, 'rgba(255,170,60,0.95)', (g, i) => drawPhoenix(g, i === 0))).clone(); map.needsUpdate = true; map.repeat.set(0.5, 1);
    await anim(1.6, k => c.set(ease(k)));
    jingle(0x0a);
    const bird = pic(c, map, 2.8, 1.4, { col: [1.5, 1.25, 1], op: 0, order: 9.5 });
    const tails = [[1, 0.75, 0.25], [1, 0.4, 0.12]].map(col => vfx.ribbon({ col, width: 0.1, n: 30 }));
    let t = 0;
    const flap = r => { map.offset.x = Math.floor(t * r) % 2 ? 0.5 : 0; };
    vfx.light(c.head(0.5), [1, 0.75, 0.35], 7, 5, 4);
    await anim(1.6, (k, dt = 1 / 60) => { t += dt; flap(5); bird.position.copy(c.head(0.5 + ease(k) * 1.3)); faceCam(bird); bird.material.opacity = Math.min(1, k * 3); bird.scale.setScalar(0.5 + 0.5 * ease(k)); c.a.fade = 1 - 0.5 * k;
      tails.forEach((r, i) => r.push(bird.position.clone().add(V(-0.5, -0.05 * i, 0)))); });
    // the cry
    vfx.ring(bird.position, [1, 0.8, 0.4], 2.2, 0.9, { vertical: true, yaw: cam.yaw, y: bird.position.y, intensity: 0.8 }); vfx.light(bird.position.clone(), [1, 0.8, 0.4], 12, 0.6, 5);
    await anim(0.8, (k, dt = 1 / 60) => { t += dt; flap(3); faceCam(bird); });
    // away into the sky
    const p0 = bird.position.clone();
    await anim(2.2, (k, dt = 1 / 60) => { t += dt; flap(6); const e = k * k; bird.position.copy(p0).add(V(e * 3, e * 5, -e * 1.5)); faceCam(bird); bird.material.opacity = 1 - Math.max(0, k - 0.6) / 0.4;
      tails.forEach((r, i) => r.push(bird.position.clone().add(V(-0.5, -0.05 * i, 0)))); c.a.fade = Math.max(0, 0.5 - k);
      if (Math.random() < 0.8) vfx.spark(bird.position.x, bird.position.y, bird.position.z, { vy: -rand(0.2, 0.6), vx: rand(-0.3, 0.1), life: rand(1, 1.8), size: rand(0.03, 0.05), r: 1, gg: rand(0.6, 0.85), b: 0.25, shape: 1 }); });
    tails.forEach(r => r.end()); c.a.hidden = true;
    await colourBack(c);
  }, { sat: 0.75, dark: 0.32 });   // (the drain is on the whole frame: kept mild so the phoenix keeps its gold)
}

// ---------------------------------------------------------------- 雷震子: the thunder's winged son
// a storm gathers, steel-blue, lightning flickering far off; the thunder takes him back in one strike; his feathers
// scatter on the wind and the storm rolls away
function featherTex() { return canvasTex(32, 96, g => {
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#e8f0ff'); gr.addColorStop(0.5, '#7c9ad0'); gr.addColorStop(1, '#3a4a78'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(16, 2); g.bezierCurveTo(30, 20, 30, 70, 17, 92); g.lineTo(15, 92); g.bezierCurveTo(2, 70, 2, 20, 16, 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, 4); g.lineTo(16, 94); g.stroke();
}); }
async function leiZhenzi(u) {
  await fall(u, [0.58, 0.48, 0.22], async c => {
    const { P } = c, FT = once('feather', featherTex);
    let next = 0.4;
    await anim(2.0, (k, dt = 1 / 60) => { c.set(ease(k)); if ((next -= dt) < 0) { next = rand(0.5, 1.0); vfx.flash([0.7, 0.8, 1], 0.12 * k); } });
    jingle(0x0a);
    await wait(700);
    // the strike
    vfx.bolt(P.clone().add(V(0.6, 9, -1)), c.head(0.4), [0.75, 0.85, 1], 0.45, { width: 0.12 }); vfx.flash([0.85, 0.9, 1], 0.5); vfx.shake(0.25, 0.4);
    vfx.light(c.head(0.5), [0.75, 0.85, 1], 30, 0.6, 7); vfx.ring(P, [0.7, 0.85, 1], 2.4, 0.5, { intensity: 0.9 });
    vfx.burst(c.head(0.4), { n: 40, speed: 4, cols: [[1, 1, 1], [0.7, 0.85, 1]], size: 0.05, life: 0.6, g: 3, shape: 1, flicker: 1 });
    // the feathers scatter
    const feather = () => { const m = pic(c, FT, 0.07, 0.2, { order: 9.5 }); m.position.copy(c.head(rand(0.2, 0.9))).add(V(rand(-0.3, 0.3), 0, rand(-0.1, 0.1)));
      const v = V(rand(0.4, 1.6), rand(0.4, 1.4), rand(-0.3, 0.3)), sp = rand(-4, 4), life = rand(2.5, 3.5); let t = 0;
      vfx.items.find(i => i.mesh === m).update = (k, dt) => { t += dt; v.y -= dt * 0.7; v.y = Math.max(v.y, -0.35); v.x += Math.sin(t * 2.4 + sp) * dt * 0.5; m.position.addScaledVector(v, dt); faceCam(m, Math.sin(t * 3 + sp) * 1.2); m.material.opacity = Math.max(0, 1 - Math.max(0, t - life + 1)); }; };
    for (let i = 0; i < 36; i++) feather();
    await anim(1.6, k => { c.a.fade = Math.max(0, 1 - k * 3); if (Math.random() < 0.5) feather(); });
    c.a.hidden = true;
    await wait(800);
    await colourBack(c, 1.6);
  }, { sat: 0.15, dark: 0.55 });
}

// ---------------------------------------------------------------- 姜子牙: the old sage of 磻溪
// a misty dawn; his apricot banner stands beside him; a white crane of light glides down and alights by him; he goes
// with it as it rises and flies off into the sky; the banner waves on alone, and fades
function drawCrane(g, up) {
  const white = '#f8fbff', grey = '#c8d4e4';
  g.strokeStyle = '#2a2a30'; g.lineWidth = 2; g.beginPath(); g.moveTo(118, 70); g.lineTo(84, 102); g.moveTo(122, 70); g.lineTo(92, 106); g.stroke();   // legs trailing
  g.fillStyle = grey; const wing = back => { g.beginPath(); g.moveTo(128, 62); const ty = up ? 6 : 118, tx = back ? 100 : 140;
    g.quadraticCurveTo(tx - 30, up ? 30 : 92, tx - 26, ty); g.lineTo(tx - 10, ty + (up ? 8 : -8)); g.lineTo(tx + 4, ty + (up ? 2 : -2)); g.lineTo(tx + 14, ty + (up ? 12 : -12)); g.quadraticCurveTo(tx + 10, up ? 40 : 84, 142, 64); g.fill();
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(tx - 26, ty); g.lineTo(tx - 10, ty + (up ? 8 : -8)); g.lineTo(tx - 20, ty + (up ? 16 : -16)); g.fill(); g.fillStyle = grey; };
  g.globalAlpha = 0.7; wing(true); g.globalAlpha = 1;
  g.fillStyle = white; g.beginPath(); g.ellipse(132, 66, 26, 10, -0.05, 0, 6.28); g.fill();   // body
  limb(g, [[154, 62], [176, 50], [196, 42], [210, 40]], [10, 7, 6, 6], white);             // neck
  g.fillStyle = '#d8201a'; g.beginPath(); g.arc(212, 37, 4, 0, 6.28); g.fill();          // the red crown
  g.fillStyle = '#e0c060'; g.beginPath(); g.moveTo(216, 39); g.lineTo(240, 43); g.lineTo(216, 43); g.fill();   // beak
  g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(106, 66, 10, 5, 0.2, 0, 6.28); g.fill();   // the black tail
  g.fillStyle = grey; wing(false);
}
async function jiangZiya(u) {
  await fall(u, [0.3, 0.28, 0.24], async c => {
    const { P, right, toCam } = c;
    // the banner, planted beside him
    const H = 1.9, W = 0.62, CH = 0.86, root = new THREE.Group(); root.rotation.y = Math.atan2(-right.z, right.x);
    const base = P.clone().addScaledVector(right, -0.4).addScaledVector(toCam, -0.3); base.y = effectH(base.x, base.z); root.position.copy(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, H, 6), new THREE.MeshStandardMaterial({ color: 0x5a2a10, roughness: 0.8 })); pole.position.y = H / 2;
    const cg = new THREE.PlaneGeometry(W, CH, 12, 6); cg.translate(W / 2, H - 0.08 - CH / 2, 0); const rest = cg.attributes.position.array.slice();
    const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: once('banner', bannerTex), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1, roughness: 0.9 })); root.add(pole, cloth);
    let T = 0; c.add(root, (k, dt) => { T += dt; const pa = cg.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { const x = rest[i], f = x / W; pa[i + 2] = Math.sin(x * 8 - T * 5) * 0.06 * f + Math.sin(rest[i + 1] * 6 - T * 3) * 0.02 * f; } cg.attributes.position.needsUpdate = true; });
    root.scale.y = 0.01;
    await anim(1.6, k => { c.set(ease(k)); root.scale.y = Math.max(0.01, ease(Math.min(1, k * 1.5))); });
    jingle(0x0a);
    // the crane glides down
    const map = once('crane', () => glowStrip(256, 128, 2, 'rgba(220,235,255,0.95)', (g, i) => drawCrane(g, i === 0))).clone(); map.needsUpdate = true; map.repeat.set(0.5, 1);
    const crane = pic(c, map, 2.6, 1.3, { col: [1.3, 1.3, 1.35], op: 0, order: 9.5 }), land = P.clone().addScaledVector(right, -0.9).add(V(0, 0.75, 0)), sky = land.clone().add(V(4, 4.5, -1));
    let t = 0; const flap = r => { map.offset.x = Math.floor(t * r) % 2 ? 0.5 : 0; };
    await anim(2.2, (k, dt = 1 / 60) => { t += dt; flap(k < 0.7 ? 1.6 : 4); crane.position.copy(sky).lerp(land, 1 - (1 - k) * (1 - k)); faceCam(crane); crane.scale.x = -1; crane.material.opacity = Math.min(1, k * 3);
      if (Math.random() < 0.4) vfx.spark(crane.position.x, crane.position.y, crane.position.z, { vy: -0.2, life: 1.2, size: 0.03, r: 0.9, gg: 0.95, b: 1, shape: 1 }); });
    vfx.light(land, [0.9, 0.95, 1], 6, 1.2, 3);
    await wait(500);
    // he goes with it: it rises and flies off, his light following it
    const p0 = crane.position.clone(), trail = vfx.ribbon({ col: [0.8, 0.88, 1], width: 0.06, n: 28 });
    await anim(2.6, (k, dt = 1 / 60) => { t += dt; flap(5); const e = k * k; crane.position.copy(p0).add(V(-e * 4, e * 5, -e * 1.5)); faceCam(crane); crane.scale.x = -1; crane.material.opacity = 1 - Math.max(0, k - 0.7) / 0.3; trail.push(crane.position.clone().add(V(0.7, -0.1, 0)));
      c.a.fade = Math.max(0, 1 - k * 1.6); if (Math.random() < 0.7) { const q = c.head(rand(0.1, 0.9)); vfx.spark(q.x, q.y, q.z, { vx: -0.5, vy: rand(0.6, 1.2), life: 1.2, size: 0.03, r: 0.9, gg: 0.95, b: 1, shape: 1 }); } });
    trail.end(); c.a.hidden = true;
    await wait(700);
    await anim(1.4, k => { cloth.material.opacity = 1 - k; pole.material.transparent = true; pole.material.opacity = 1 - k; c.set(1 - ease(k)); });
  }, { sat: 0.55, dark: 0.28 });
}

// ---------------------------------------------------------------- 黃天化: 黃飛虎's son, his 玉麒麟's jade
// a green-grey hush; jade light creeps over him until he is jade himself; it cracks with light and shatters, the shards
// floating up, turning, and fading
async function huangTianhua(u) {
  await fall(u, [0.48, 0.22, 0.42], async c => {
    const { P, tx } = c;
    await anim(1.6, k => c.set(ease(k)));
    jingle(0x0a);
    const jade = overlay(c, tx, [0.35, 0.95, 0.6], false), glow = overlay(c, tx, [0.2, 0.7, 0.4], true);
    await anim(1.8, k => { jade.material.opacity = 0.75 * ease(k); glow.material.opacity = 0.5 * ease(k); if (Math.random() < 0.5) { const q = c.head(rand(0.1, 0.9)); vfx.spark(q.x + rand(-0.2, 0.2), q.y, q.z, { vy: 0.3, life: 0.8, size: 0.03, r: 0.5, gg: 1, b: 0.7, shape: 1 }); } });
    await wait(400);
    // it cracks
    for (let i = 0; i < 3; i++) { vfx.light(c.head(0.5), [0.5, 1, 0.7], 6 + i * 4, 0.2, 3); glow.material.opacity = 1; await wait(120); glow.material.opacity = 0.5; await wait(260); }
    // and shatters
    vfx.flash([0.6, 1, 0.75], 0.25); vfx.shake(0.08, 0.2);
    const sm = new THREE.MeshStandardMaterial({ color: 0x6ae8a0, emissive: 0x2aa060, metalness: 0.2, roughness: 0.15, transparent: true, depthTest: false });
    for (let i = 0; i < 60; i++) {
      const g = new THREE.BufferGeometry(), s = rand(0.07, 0.16); g.setAttribute('position', new THREE.Float32BufferAttribute([0, s, 0, -s * rand(0.5, 1), -s * rand(0.3, 0.8), rand(-0.02, 0.02), s * rand(0.5, 1), -s * rand(0.3, 0.8), rand(-0.02, 0.02)], 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, sm.clone()); m.renderOrder = 9.5; m.material.side = THREE.DoubleSide; m.position.copy(c.head(rand(0.05, 1.0))).add(V(rand(-0.28, 0.28), 0, rand(-0.1, 0.1)));
      const v = V(rand(-1.2, 1.2), rand(0.2, 1.4), rand(-0.6, 0.6)), sp = V(rand(-5, 5), rand(-5, 5), rand(-5, 5)), life = rand(2.2, 3.2); let t = 0;
      c.add(m, (k, dt) => { t += dt; v.multiplyScalar(1 - dt * 1.6); v.y += dt * 0.35; m.position.addScaledVector(v, dt); m.rotation.x += sp.x * dt; m.rotation.y += sp.y * dt; m.rotation.z += sp.z * dt; m.material.opacity = Math.max(0, 1 - Math.max(0, t - life + 1)); });
    }
    c.a.hidden = true; jade.visible = glow.visible = false;
    await wait(2600);
    await colourBack(c);
  }, { sat: 0.75, dark: 0.4 });
}

// ---------------------------------------------------------------- 土行孫: who travels through the earth
// a still, earthen dusk; he sinks slowly back into the ground he came through, a ring of soil heaving round him; a low
// mound is left, and from it one small sprout grows and opens a white flower
async function tuXingsun(u) {
  await fall(u, [0.28, 0.38, 0.52], async c => {
    const { P, a } = c, R = world.renderer, clip0 = R.localClippingEnabled, gy = effectH(P.x, P.z);
    await anim(1.6, k => c.set(ease(k)));
    jingle(0x0a);
    R.localClippingEnabled = true; const plane = new THREE.Plane(V(0, 1, 0), -(gy - 0.02));
    for (const m of [a.mesh, a.big]) m.material.clippingPlanes = [plane];
    try {
      await anim(2.6, k => { a.hover = -ease(k) * 1.2 * (a.size || 1);
        if (Math.random() < 0.6) { const t = rand(0, 6.28), r = rand(0.25, 0.45); vfx.smokePuff(P.x + Math.cos(t) * r, gy + 0.05, P.z + Math.sin(t) * r * 0.7, { vx: Math.cos(t) * 0.3, vy: rand(0.15, 0.35), life: 1.2, size: 0.07, size1: 0.22, tint: [0.45, 0.38, 0.28] }); }
        if (Math.random() < 0.5) vfx.spark(P.x + rand(-0.4, 0.4), gy + 0.05, P.z + rand(-0.2, 0.2), { vy: rand(0.6, 1.2), g: 5, life: 0.5, size: 0.03, r: 0.5, gg: 0.4, b: 0.3, shape: 1 }); });
    } finally { for (const m of [a.mesh, a.big]) m.material.clippingPlanes = null; R.localClippingEnabled = clip0; }
    a.hidden = true; a.hover = 0;
    // the mound, and the sprout and flower that grow from it
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 1, transparent: true }));
    mound.position.set(P.x, gy - 0.02, P.z); mound.scale.set(1, 0.01, 0.8); mound.receiveShadow = true; c.add(mound);
    await anim(0.6, k => { mound.scale.y = 0.35 * ease(k); });
    const top = gy + 0.13, stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 1, 6), new THREE.MeshStandardMaterial({ color: 0x5aa040 })); stem.position.set(P.x, top, P.z); stem.scale.y = 0.001; c.add(stem);
    const leaf = s => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), new THREE.MeshStandardMaterial({ color: 0x6ac04a })); m.scale.set(1, 0.25, 0.5); m.position.set(P.x + s * 0.1, top + 0.16, P.z); m.rotation.z = s * 0.5; m.scale.multiplyScalar(0.01); return c.add(m); };
    const leaves = [leaf(-1), leaf(1)];
    const petals = []; for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(0.1, 0.18); g.translate(0, 0.09, 0); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x806050, side: THREE.DoubleSide })); const pv = new THREE.Group(); pv.rotation.y = i / 6 * Math.PI * 2; pv.add(m); pv.position.set(P.x, top + 0.4, P.z); m.rotation.x = 0.1; pv.scale.setScalar(0.01); petals.push({ pv, m }); c.add(pv); }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0c030, emissive: 0x604000 })); heart.position.set(P.x, top + 0.4, P.z); heart.scale.setScalar(0.01); c.add(heart);
    await anim(1.4, k => { const e = ease(k); stem.scale.y = 0.4 * e; stem.position.y = top + 0.2 * e; leaves.forEach(l => l.scale.set(e, 0.25 * e, 0.5 * e)); });
    vfx.light(V(P.x, top + 0.6, P.z), [1, 0.95, 0.8], 4, 2.5, 2.5);
    await anim(1.2, k => { const e = ease(k); for (const p of petals) { p.pv.scale.setScalar(Math.max(0.01, e)); p.m.rotation.x = 0.1 + e * 1.1; } heart.scale.setScalar(Math.max(0.01, e)); });
    await wait(900);
    await anim(1.4, k => { for (const o of [mound, stem, heart, ...leaves, ...petals.map(p => p.m)]) { o.material.transparent = true; o.material.opacity = 1 - k; } c.set(1 - ease(k)); });
  }, { sat: 0.65, dark: 0.38 });
}

// ---------------------------------------------------------------- 小龍女: the dragon king's daughter
// a sea-green mist; she turns to water, drops rising off her; the water gathers into a dragon of water that coils up
// round her and climbs into the sky; a single pearl is left where she knelt, glowing, and fades
async function xiaoLongnv(u) {
  await fall(u, [0.5, 0.22, 0.08], async c => {
    const { P } = c, gy = effectH(P.x, P.z);
    await anim(1.6, k => c.set(ease(k)));
    jingle(0x0a);
    const water = overlay(c, c.tx, [0.4, 0.75, 1.2], true);
    await anim(1.4, k => { water.material.opacity = 0.7 * ease(k); for (let i = 0; i < 2; i++) { const q = c.head(rand(0.05, 1)); vfx.spark(q.x + rand(-0.25, 0.25), q.y, q.z, { vy: rand(0.4, 1.0), life: rand(0.8, 1.4), size: rand(0.025, 0.045), r: 0.6, gg: 0.85, b: 1, shape: 1 }); } });
    // the water dragon: two streams coiling up round her, a dragon's head of water at the front
    const streams = [[0.55, 0.85, 1], [0.3, 0.6, 1]].map(col => vfx.ribbon({ col, width: 0.2, n: 46 }));
    const head = pic(c, once('dragonHead', dragonHeadTex), 1.3, 0.78, { add: true, col: [0.6, 0.85, 1.2], op: 0, order: 9.6 });
    let t = 0;
    await anim(3.4, (k, dt = 1 / 60) => { t += dt; const r = 0.6 * (1 - k * 0.4), y = gy + 0.2 + k * 6, ang = t * 4.2;
      const hp = V(P.x + Math.cos(ang) * r, y, P.z + Math.sin(ang) * r * 0.7); streams.forEach((s, i) => s.push(hp.clone().add(V(0, -0.06 * i, 0))));
      head.position.copy(hp); faceCam(head, Math.cos(ang) > 0 ? 0.3 : -0.3); head.scale.x = Math.sin(ang) > 0 ? 1 : -1; head.material.opacity = Math.min(1, k * 4) * (1 - Math.max(0, k - 0.75) / 0.25);
      c.a.fade = Math.max(0, 1 - k * 1.8); water.material.opacity = 0.7 * Math.max(0, 1 - k * 1.8);
      if (Math.random() < 0.8) vfx.spark(hp.x, hp.y, hp.z, { vy: -rand(0.2, 0.6), life: 0.9, size: 0.035, r: 0.6, gg: 0.85, b: 1, shape: 1 }); });
    streams.forEach(s => s.end()); c.a.hidden = true;
    // the pearl
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf4f2ff, emissive: 0x6a7a9a, metalness: 0.1, roughness: 0.1, transparent: true }));
    pearl.position.set(P.x, gy + 0.6, P.z); c.add(pearl); vfx.light(V(P.x, gy + 0.2, P.z), [0.8, 0.9, 1], 4, 2.6, 2);
    await anim(0.6, k => { pearl.position.y = gy + 0.07 + 0.53 * (1 - k * k) + Math.abs(Math.sin(k * 9)) * 0.05 * (1 - k); });
    await wait(1000);
    await anim(1.4, k => { pearl.material.opacity = 1 - k; c.set(1 - ease(k)); });
  }, { sat: 0.7, dark: 0.38 });
}

// ---------------------------------------------------------------- 燃燈道人: the lamp-lighting sage
// night falls deeper than any other; an old bronze oil lamp appears before him and he becomes its flame, the light
// growing as he fades; it flickers, gutters and goes out; a thin curl of smoke rises from the wick
async function ranDeng(u) {
  await fall(u, [0.62, 0.62, 0.52], async c => {
    const { P, toCam } = c, at = P.clone().addScaledVector(toCam, 0.4), gy = effectH(at.x, at.z);
    const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.85, roughness: 0.35, transparent: true });
    const lamp = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.13, 0.02], [0.04, 0.05], [0.03, 0.3], [0.05, 0.33], [0.15, 0.36], [0.16, 0.4], [0.12, 0.42], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 24), bronze);
    lamp.position.set(at.x, gy, at.z); lamp.castShadow = true; lamp.scale.setScalar(0.01); c.add(lamp); const LS = 2.2;   // (larger than life: seen at play distance)
    const fire = fireSheets(world.scene, 3), L = new THREE.PointLight(0xff9030, 0, 6, 1.6); L.position.set(at.x, gy + 0.6, at.z); world.scene.add(L); c.add(fire.mesh);
    let size = 0.4, T = 0, out = false;
    const wick = () => V(at.x, gy + 0.41 * 2.2, at.z);
    const burn = (dt, flick = 0) => { T += dt; fire.tick(T); const s = out ? 0 : size * (1 + (Math.random() - 0.5) * flick); const w = wick();
      fire.set(s > 0.01 ? [[w.x - 0.02, w.y, w.z, s, 1.3, 1.05, s * 0.55], [w.x + 0.02, w.y, w.z + 0.01, s * 0.8, 4.7, 1.0, s * 0.45]] : []); L.intensity = out ? 0 : 3 + size * 14 * (1 + (Math.random() - 0.5) * flick); };
    try {
      await anim(1.8, (k, dt = 1 / 60) => { c.set(ease(k)); lamp.scale.setScalar(Math.max(0.01, LS * ease(Math.min(1, k * 1.4)))); burn(dt); });
      jingle(0x0a);
      // he becomes the flame
      await anim(2.6, (k, dt = 1 / 60) => { size = 0.4 + 0.6 * ease(k); burn(dt, 0.1); c.a.fade = Math.max(0, 1 - k * 1.2);
        if (Math.random() < 0.7) { const q = c.head(rand(0.1, 0.9)), w = wick(); const v = w.clone().sub(q).multiplyScalar(1.2); vfx.spark(q.x, q.y, q.z, { vx: v.x, vy: v.y, vz: v.z, life: 0.8, size: 0.03, r: 1, gg: 0.75, b: 0.35, shape: 1 }); } });
      c.a.hidden = true;
      await anim(1.2, (k, dt = 1 / 60) => burn(dt, 0.15));
      // it gutters and goes out
      await anim(1.6, (k, dt = 1 / 60) => { size = 1.0 * (1 - ease(k)) * (Math.sin(k * 40) > -0.3 ? 1 : 0.3); burn(dt, 0.8); });
      out = true; burn(0);
      for (let i = 0; i < 26; i++) { const w = wick(); vfx.smokePuff(w.x + Math.sin(i * 0.6) * 0.04, w.y + 0.02, w.z, { vx: Math.sin(i * 0.5) * 0.05, vy: 0.3, life: 2.2, size: 0.02, size1: 0.12, tint: [0.55, 0.53, 0.5] }); await wait(60); }
      await wait(500);
      await anim(1.6, k => { bronze.opacity = 1 - k; c.set(1 - ease(k)); });
    } finally { world.scene.remove(L); }
  }, { sat: 0.4, dark: 0.62 });
}

// ---------------------------------------------------------------- 文王 (a guest the heroes protect): the sage king of 西岐
// a golden dusk; the eight trigrams he read the world by rise round him in a slowly turning ring of gold; as he fades
// they dim one by one, and the last drifts up into the sky
function trigramTex(n) { return canvasTex(64, 64, g => {
  g.shadowColor = 'rgba(255,200,90,0.95)'; g.shadowBlur = 8; g.fillStyle = '#ffe6a0';
  for (let j = 0; j < 3; j++) { const y = 14 + j * 14; if ((n >> j) & 1) { g.fillRect(8, y, 20, 7); g.fillRect(36, y, 20, 7); } else g.fillRect(8, y, 48, 7); }
}); }
async function wenWang(u) {
  await fall(u, [0.15, 0.32, 0.7], async c => {
    const { P } = c, cards = [];
    for (let i = 0; i < 8; i++) cards.push(pic(c, once('trigram' + i, () => trigramTex(i)), 0.62, 0.62, { add: true, op: 0, order: 9.4, col: [1.4, 1.2, 0.8] }));
    let rot = 0;
    const place = (dt, r = 1.45) => { rot += dt * 0.35; cards.forEach((m, i) => { const t = rot + i / 8 * Math.PI * 2; m.position.set(P.x + Math.cos(t) * r, effectH(P.x, P.z) + 0.55 + Math.sin(t * 2 + rot) * 0.04, P.z + Math.sin(t) * r * 0.7); faceCam(m); }); };
    await anim(1.6, (k, dt = 1 / 60) => { c.set(ease(k)); place(dt); cards.forEach((m, i) => { m.material.opacity = Math.max(0, Math.min(1, k * 2 - i * 0.1)); }); });
    jingle(0x0a);
    vfx.light(c.head(0.4), [1, 0.85, 0.5], 5, 6, 4);
    await anim(1.4, (k, dt = 1 / 60) => place(dt));
    // they dim one by one as he fades; the last rises
    for (let i = 0; i < 7; i++) { const m = cards[i]; await anim(0.35, (k, dt = 1 / 60) => { place(dt); m.material.opacity = 1 - k; c.a.fade = 1 - (i + k) / 8; }); }
    const last = cards[7], p0 = last.position.clone();
    await anim(2.2, (k, dt = 1 / 60) => { last.position.copy(p0).add(V(0, ease(k) * 3, 0)); faceCam(last); last.material.opacity = 1 - Math.max(0, k - 0.6) / 0.4; c.a.fade = Math.max(0, 0.125 * (1 - k * 2)); });
    c.a.hidden = true;
    await colourBack(c);
  }, { sat: 0.65, dark: 0.38 });
}

// ---------------------------------------------------------------- 伯邑考 (a guest the heroes protect): 文王's gentle eldest son, the qin player
// a quiet blue night; the seven strings of his qin shine across before him, trembling as if played; they break one by
// one, each with a last note of light drifting up; with the seventh he is gone
async function boYikao(u) {
  await fall(u, [0.6, 0.48, 0.2], async c => {
    const { P, right } = c, strings = [];
    const sm = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.9), transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 7; i++) { const halves = [0, 1].map(() => { const g = new THREE.PlaneGeometry(0.75, 0.028, 16, 1); return new THREE.Mesh(g, sm()); }); halves.forEach(h => { h.renderOrder = 9.4; c.add(h); }); strings.push({ halves, cut: false, rest: halves.map(h => h.geometry.attributes.position.array.slice()) }); }
    let T = 0;
    const place = dt => { T += dt; const mid = c.head(0.42); strings.forEach((s, i) => { s.halves.forEach((h, j) => { const off = (j ? 0.375 : -0.375);
      h.position.copy(mid).addScaledVector(right, s.cut ? off * (1 + s.k * 0.4) : off).add(V(0, (i - 3) * 0.09, 0)); faceCam(h, s.cut ? (j ? -1 : 1) * s.k * 0.8 : 0);
      const pa = h.geometry.attributes.position.array, r = s.rest[j]; for (let q = 0; q < pa.length; q += 3) { const x = r[q] + off; pa[q + 1] = r[q + 1] + (s.cut ? 0 : Math.sin(T * 40 + i) * 0.006 * Math.cos(x / 0.75 * Math.PI)); } h.geometry.attributes.position.needsUpdate = true; }); }); };
    await anim(1.6, (k, dt = 1 / 60) => { c.set(ease(k)); place(dt); strings.forEach(s => s.halves.forEach(h => { h.material.opacity = ease(k); })); });
    jingle(0x0a);
    await anim(1.2, (k, dt = 1 / 60) => place(dt));
    for (let i = 0; i < 7; i++) {
      const s = strings[6 - i]; s.cut = true; s.k = 0; const p = s.halves[0].position.clone().addScaledVector(right, 0.375);
      vfx.burst(p, { n: 8, speed: 0.8, col: [1, 0.9, 0.6], size: 0.03, life: 0.4, g: 0, shape: 1 }); vfx.light(p, [1, 0.9, 0.6], 3, 0.3, 2);
      for (let n = 0; n < 4; n++) vfx.spark(p.x + rand(-0.1, 0.1), p.y, p.z, { vy: rand(0.4, 0.9), vx: rand(-0.2, 0.2), life: rand(1.5, 2.2), size: rand(0.03, 0.05), r: 1, gg: 0.9, b: 0.6, shape: 1, wob: 0.3, ph: rand(0, 6) });
      await anim(0.45, (k, dt = 1 / 60) => { s.k = k; s.halves.forEach(h => { h.material.opacity = 1 - k; }); place(dt); c.a.fade = 1 - (i + k) / 7; });
    }
    c.a.hidden = true;
    await wait(500);
    await colourBack(c);
  }, { sat: 0.5, dark: 0.42 });
}

// the falls by hero (cid) and by guest (name)
export const DEATHS = { 0: linYun, 1: yanRong, 2: yangJian, 3: huangFeihu, 4: nezha, 5: jiFa, 6: leiZhenzi, 7: jiangZiya, 8: huangTianhua, 9: tuXingsun, 10: xiaoLongnv, 11: ranDeng, 文王: wenWang, 伯邑考: boYikao };
export const deathOf = u => (u.cid != null && u.cid <= 11 && DEATHS[u.cid]) || DEATHS[u.name] || null;
