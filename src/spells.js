// Spells reimagined as 3D set-pieces. Each script gets a context from main.js:
//   ctx.vfx, ctx.cam, ctx.caster (Actor), ctx.targets (Actors), ctx.at (Vector3 on the ground), ctx.wait(ms),
//   ctx.hit(i) shows the result on target i (all when omitted), ctx.pose(kind) drives the caster's sprite pose.
import * as THREE from 'three';
import { rand, effectH } from './world.js';
import { NOISE } from './vfx.js';
import { V, ease, basis, swordMesh, pointAlong, bezier, trail, intro, outro, DARK, ticker, cueAt, facing, yawOf, swirl, arrowMesh, flameRing, LEAF, talismanTex, petalGeo } from './spellkit.js';
import { iceMaterial, shardGeometry, chunkGeometry, shatter, frost } from './elements.js';
import { SPELLBOOK, PAL, energyStreak, beastSprite } from './spellbook.js';
export { arrowMesh };
// fn after ms on the game clock (ctx.wait: not setTimeout, which runs off the fast-forward and the stepped video)
const later = (ctx, ms, fn) => { ctx.wait(ms).then(fn); };

// ---------------------------------------------------------------- archetypes
async function flyingSwords(ctx, n) {
  const col = [0.45, 0.85, 1], v = ctx.vfx;
  await intro(ctx, col, { dur: 800 });
  const c = ctx.caster.chest(), tgt = ctx.at.clone().setY(ctx.at.y + 0.45), B = basis(ctx);
  for (let i = 0; i < n; i++) {
    const s = swordMesh(col, 1.0), start = c.clone().add(V(Math.cos(i / n * 6.28) * 0.7, 0.9 + i * 0.12, Math.sin(i / n * 6.28) * 0.7));
    const rib = v.ribbon({ col, width: 0.09, n: 26 }), rib2 = v.ribbon({ col: [1, 1, 1], width: 0.025, n: 18 });
    s.position.copy(start); pointAlong(s, V(0, 1, 0));
    v.burst(start, { n: 14, speed: 1.6, col, size: 0.05, life: 0.4, g: 0 });
    v.timed(s, 1.15 + i * 0.16, (k, dt, t) => {
      const hover = 0.45 + i * 0.12;
      if (t < hover) { s.position.y = start.y + Math.sin(t * 6 + i) * 0.05; s.rotation.y += dt * 4; return; }
      // like the original, each sword weaves in a wave on its way in
      const f = Math.min(1, (t - hover) / 0.5), e = ease(f), side = B.right.clone().multiplyScalar(Math.sin(e * Math.PI * 2.0 + i) * 0.9 * (1 - e));
      const mid = start.clone().lerp(tgt, 0.5).add(V(0, 2.0, 0));
      const p = bezier(start, mid, tgt, e).add(side), nx = bezier(start, mid, tgt, Math.min(1, e + 0.03)).add(B.right.clone().multiplyScalar(Math.sin(Math.min(1, e + 0.03) * Math.PI * 2 + i) * 0.9 * (1 - e)));
      s.position.copy(p); pointAlong(s, nx.clone().sub(p).negate()); rib.push(p); rib2.push(p);
      if (Math.random() < 0.5) trail(v, p, col, 1, 0.06);
      if (f >= 1 && !s.userData.hit) { s.userData.hit = 1; v.impact(tgt, col, 0.7); v.ring(tgt, col, 1.2, 0.3, { vertical: true, yaw: yawOf(facing(start, tgt)), y: tgt.y }); s.visible = false; rib.end(); rib2.end(); }
    });
  }
  await ctx.wait(1300 + n * 160);
  v.impact(tgt, col, 1.1); ctx.hit();
  await ctx.wait(600); outro(ctx);
}
// 擎天劍: [ROM fx 1] great swords drop from the sky, one onto each cell of the cross (the spell's area), the aimed cell's
// first and largest, the four arms close behind; a fence of small swords springs up round the whole cross, as the
// original's does round the one [the user's calls, 2026-10-30: five swords, not one; no magic circle under them]
async function giantSword(ctx) {
  const col = [0.5, 0.9, 1], v = ctx.vfx;
  cueAt(ctx, 0.97);   // (the original's sound as the sword appears over him, 0.97 s after the cast begins; over at 2.8 s)
  await intro(ctx, col, { dur: 900, dist: 11, pitch: 0.38 });
  DARK(ctx, 0.45, 0.9, 0.7, 0.45);
  const cells = ctx.cells.length ? ctx.cells : [ctx.at], last = 0.25 + 0.5 + (cells.length - 1) * 0.09 + 0.12;   // (last: when the last one lands)
  cells.forEach((c, i) => {
    const big = i === 0, sc = big ? 4.2 : 3.0, top = c.clone().add(V(0, 12, 0)), end = c.clone().add(V(0, big ? -0.6 : -0.45, 0)), d = big ? 0 : 0.12 + (i - 1) * 0.09;
    const s = swordMesh(col, sc), ribs = (big ? [-0.25, 0, 0.25] : [-0.18, 0.18]).map(o => [o, v.ribbon({ col, width: o && big ? 0.12 : big ? 0.3 : 0.1, n: 16, taper: 0.6 })]);
    s.rotation.x = Math.PI; s.visible = false;
    v.timed(s, 2.2 + d, (k, dt, t) => {
      const f = Math.min(1, Math.max(0, (t - d - 0.25) / 0.5)), p = top.clone().lerp(end, f * f);
      s.visible = t >= d + 0.25; s.position.copy(p); if (f > 0 && f < 1) for (const [o, r] of ribs) r.push(p.clone().add(V(o, sc * 0.76, 0)));
      if (f >= 1 && !s.userData.hit) {
        s.userData.hit = 1; for (const [, r] of ribs) r.end();
        // (five at once: one full impact, the centre's; the arms a lighter blow each, or the light and dust white the screen out)
        if (big) v.impact(c, col, 1.4); else { v.burst(c.clone().setY(c.y + 0.3), { n: 16, speed: 3, cols: [[1, 1, 1], col], size: 0.06, life: 0.5, shape: 1 }); v.ring(c, col, 1.1, 0.45, { intensity: 1, y: c.y + 0.05 }); v.shake(0.08, 0.12); }
        v.decal(c, col, big ? 1.6 : 0.7, 1.4, { intensity: big ? 0.6 : 0.45 });
        for (let j = 0; j < (big ? 14 : 4); j++) { const a = rand(0, 6.28), sp = rand(1.5, 3.5) * (big ? 1 : 0.6); v.smokePuff(c.x, c.y + 0.15, c.z, { vx: Math.cos(a) * sp, vy: rand(0.2, 0.8), vz: Math.sin(a) * sp, drag: 2.2, life: rand(1.2, 1.8), size: 0.4, size1: big ? 1.2 : 0.8, tint: [0.4, 0.36, 0.3] }); }
        for (let j = 0; j < (big ? 40 : 12); j++) v.spark(c.x + rand(-0.4, 0.4), c.y + 0.1, c.z + rand(-0.4, 0.4), { vx: rand(-3, 3), vy: rand(2, 5), vz: rand(-3, 3), g: 12, life: rand(0.6, 1.1), size: rand(0.05, 0.1), r: 0.45, gg: 0.38, b: 0.3, a: 1, shape: 1, floor: c.y + 0.03 });
        if (big) for (let j = 0; j < 8; j++) {   // the fence, round the whole cross (past the arms' cells)
          const a = (j + 0.5) / 8 * 6.28, p2 = c.clone().add(V(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9)), g0 = c.y, sm = swordMesh(col, 1.1); sm.position.copy(p2).setY(g0 - 1.2);
          v.timed(sm, 1.1, (k2) => { sm.position.y = g0 - 1.2 + Math.min(1, k2 * 4) * 1.3; sm.rotation.y = a; if (k2 > 0.8) sm.scale.setScalar(1.1 * (1 - (k2 - 0.8) * 5)); });
          v.burst(p2.clone().setY(g0 + 0.1), { n: 8, speed: 2.5, col: [0.55, 0.45, 0.35], size: 0.06, life: 0.8, g: 9, shape: 1 });
        }
      }
      if (k > 0.85) s.scale.setScalar(sc * (1 - (k - 0.85) / 0.15));
    });
  });
  await ctx.wait(Math.max(800, last * 1000)); ctx.hit(); await ctx.wait(1200); outro(ctx);
}
// [ROM fx 4, 5] swords fly up from him into a circle in the sky, then rain down round the target, the
// first landing on the original's sound (F s after the cast begins); they stand in the ground until the effect is over (E)
async function swordRain(ctx, n, col, F, E) {
  const v = ctx.vfx;
  await intro(ctx, col, { dur: 850, dist: 11, pitch: 0.45 });
  const sky = ctx.at.clone().add(V(0, 6.5, 0)), L = Math.max(2.6, E - ctx.now() - 0.2);
  v.light(sky, col, 40, L, 12);
  // the swords rise from him into the circle, as the original's do while it gathers
  const c = ctx.caster.chest(), rise = Math.max(0.3, F - 0.5 - ctx.now());
  for (let i = 0; i < Math.min(n, 8); i++) {
    const s = swordMesh(col, 0.6), rib = v.ribbon({ col, width: 0.05, n: 10 }), d = i * rise / 8, to = sky.clone().add(V(rand(-1.4, 1.4), rand(-0.3, 0.3), rand(-1.4, 1.4)));
    v.timed(s, d + 0.5, (k, dt, t) => { if (t < d) { s.visible = false; return; } s.visible = true; const f = Math.min(1, (t - d) / 0.5), p = c.clone().lerp(to, ease(f)); s.position.copy(p); pointAlong(s, V(0, -1, 0)); rib.push(p); if (f >= 1) { s.visible = false; rib.end(); v.burst(to, { n: 8, speed: 1.5, col, size: 0.05, life: 0.4, g: 0 }); } });
  }
  await ctx.until(F - 0.22);   // (a sword falls in 0.22 s: the first lands on the sound)
  const T = ctx.now(), life = Math.max(1.6, E - 0.1 - T);
  for (let i = 0; i < n; i++) {
    const land = ctx.at.clone().add(V(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))); land.y = effectH(land.x, land.z);
    const st = V(land.x + rand(-0.5, 0.5), sky.y, land.z + rand(-0.5, 0.5));
    const s = swordMesh(col, 0.85), rib = v.ribbon({ col, width: 0.07, n: 12 });
    v.timed(s, life, (k, dt, t) => {
      const d = i * (0.9 / n);
      if (t < d) { s.visible = false; return; } s.visible = true;
      const f = Math.min(1, (t - d) / 0.22), p = st.clone().lerp(land, f);
      s.position.copy(p); pointAlong(s, st.clone().sub(land)); if (f < 1) rib.push(p.clone().add(st.clone().sub(land).normalize().multiplyScalar(0.9)));
      if (f >= 1 && !s.userData.hit) { s.userData.hit = 1; rib.end(); v.burst(land.clone().setY(land.y + 0.1), { n: 14, speed: 2.5, col, size: 0.05, life: 0.5 }); v.ring(land, col, 0.8, 0.35); v.decal(land, col, 0.5, 0.6); v.shake(0.04, 0.1);
        v.smokePuff(land.x, land.y + 0.1, land.z, { vy: 0.4, life: 1, size: 0.3, size1: 0.8, tint: [0.5, 0.45, 0.4] }); }
      if (t > life - 0.3) s.scale.setScalar(0.85 * Math.max(0.001, (life - t) / 0.3));
    });
  }
  await ctx.until(F); ctx.cue();
  await ctx.wait(900); v.impact(ctx.at, col, 1.3); ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 百步穿楊 / 旋風矢: the original fires one big arrow across the field; it strikes with its one sound (1.67 s after the
// cast begins) and a whirlwind spins on the target (the ROM's frames show it for both: tools/rom/spellsheet.py 12), the
// effect over at 4.85 s
async function arrow(ctx, wind) {
  const col = wind ? [0.55, 1, 0.7] : [1, 0.82, 0.4], v = ctx.vfx, F = 1.67, E = 4.85;
  await intro(ctx, col, { dur: 500, dist: 10, pitch: 0.4, yaw: -0.6 });
  const c = ctx.caster.chest(), b = ctx.at.clone().setY(ctx.at.y + 0.55), dir = b.clone().sub(c).normalize();
  const a = c.clone().add(dir.clone().multiplyScalar(0.35)).setY(c.y + 0.1);
  ctx.cam.shot(a.clone().lerp(b, 0.5), { dist: 9 });
  // draw: the arrow materialises at full size and charges
  const g = arrowMesh(col, 1.0); pointAlong(g, dir); g.position.copy(a);
  v.light(a, col, 8, 1.0, 5);
  const draw = Math.max(0.35, Math.min(0.75, F - 0.3 - ctx.now()));   // (a shorter draw for a caster whose own cast runs long: it looses on time)
  ticker(v, draw, (k, dt, t) => {
    const pull = Math.min(1, t / (draw * 0.8)); g.position.copy(a).add(dir.clone().multiplyScalar(-0.35 * pull));
    for (const m of g.userData.glow) m.material.opacity = pull * 0.5;
    g.userData.head.material.emissiveIntensity = 1 + pull * 3;
    const hp = g.position.clone().add(dir.clone().multiplyScalar(0.85));
    for (let i = 0; i < 3; i++) { const q = hp.clone().add(V(rand(-1, 1), rand(-0.8, 1), rand(-1, 1))); v.spark(q.x, q.y, q.z, { seek: { x: hp.x, y: hp.y, z: hp.z, k: 7 }, life: 0.35, size: rand(0.04, 0.08), r: col[0], gg: col[1], b: col[2], shape: 1 }); }
  });
  v.timed(g, 2.5, () => {});
  await ctx.wait(draw * 1000); await ctx.until(F - 0.3);   // (it strikes about 0.3 s after it leaves the bow)
  // release
  v.ring(a, col, 1.6, 0.35, { vertical: true, yaw: yawOf(dir), y: a.y }); v.ring(a, [1, 1, 1], 0.9, 0.25, { vertical: true, yaw: yawOf(dir), y: a.y });
  v.shake(0.08, 0.15);
  const rib = v.ribbon({ col, width: 0.11, n: 22 }), core = v.ribbon({ col: [1, 1, 1], width: 0.03, n: 14 });
  const helix = wind ? [0, Math.PI].map(ph => [ph, v.ribbon({ col, width: 0.05, n: 20 })]) : [];
  const right = V(-dir.z, 0, dir.x), end = b.clone().add(dir.clone().multiplyScalar(2.2));
  let last = 0, hit = false;
  await new Promise(res => ticker(v, 0.62, (k, dt, t) => {
    const f = Math.min(1, t / 0.55), p = a.clone().lerp(end, f); p.y += Math.sin(f * Math.PI) * 0.15;
    g.position.copy(p); rib.push(p); core.push(p);
    for (const [ph, r] of helix) { const ang = t * 38 + ph; r.push(p.clone().add(right.clone().multiplyScalar(Math.cos(ang) * 0.3)).add(V(0, Math.sin(ang) * 0.3, 0))); }
    if (t - last > 0.05) { last = t; v.ring(p, col, 0.7, 0.3, { vertical: true, yaw: yawOf(dir), y: p.y, intensity: 0.5 }); }
    v.spark(p.x + rand(-0.1, 0.1), p.y + rand(-0.1, 0.1), p.z + rand(-0.1, 0.1), { vx: -dir.x * 2 + rand(-0.5, 0.5), vy: rand(-0.3, 0.5), vz: -dir.z * 2 + rand(-0.5, 0.5), life: 0.35, size: 0.05, r: col[0], gg: col[1], b: col[2], shape: 1 });
    if (!hit && p.distanceTo(a) >= b.distanceTo(a)) {
      hit = true; v.hitstop = 0.14; v.impact(b, col, 1.0); v.ring(b, col, 1.8, 0.35, { vertical: true, yaw: yawOf(dir), y: b.y, intensity: 1.2 });
      v.burst(b, { n: 30, speed: 6, col, cols: [[1, 1, 1], col], size: 0.06, life: 0.6, g: 3, shape: 1 }); ctx.hit(); res();
    }
    if (f >= 1) { g.visible = false; }
    else if (hit) for (const m of g.userData.glow) m.material.opacity *= 0.85;
  }, () => { rib.end(); core.end(); for (const [, r] of helix) r.end(); g.visible = false; }));
  {
    // whirlwind: a twisting funnel with leaves and dust caught in it
    await ctx.wait(250);
    swirl(v, ctx.at.clone().setY(ctx.at.y), wind ? col : [0.85, 0.95, 0.8], 0.35, 1.25, 3.2, 1.9, { speed: 5, twist: 5, sway: true, foam: [0.9, 1, 0.9], intensity: 0.75 });
    for (let i = 0; i < 90; i++) later(ctx, i * 16, () => {
      const ang = rand(0, 6.28), r = rand(0.3, 0.9), leaf = Math.random() < 0.5;
      const cc = leaf ? [[0.45, 0.75, 0.25], [0.6, 0.85, 0.35]][(Math.random() * 2) | 0] : [0.85, 1, 0.9];
      (leaf ? v.smoke.bind(v) : v.spark.bind(v))(ctx.at.x + Math.cos(ang) * r, ctx.at.y + rand(0.05, 0.6), ctx.at.z + Math.sin(ang) * r, { vy: rand(1.2, 2.4), life: rand(0.8, 1.3), size: leaf ? rand(0.06, 0.1) : 0.05, r: cc[0], gg: cc[1], b: cc[2], a: 1, shape: 1, orb: { x: ctx.at.x, z: ctx.at.z, w: rand(7, 11) } });
    });
    for (let i = 0; i < 16; i++) { const ang = rand(0, 6.28); v.smokePuff(ctx.at.x + Math.cos(ang) * 0.6, ctx.at.y + 0.15, ctx.at.z + Math.sin(ang) * 0.6, { vy: rand(0.2, 0.6), life: rand(1, 1.6), size: 0.45, size1: 1.2, tint: [0.55, 0.5, 0.4], orb: { x: ctx.at.x, z: ctx.at.z, w: 5 } }); }
    // as it dies the dust and leaves it carried settle round the target
    later(ctx, 1700, () => { for (let i = 0; i < 24; i++) { const ang = rand(0, 6.28), r = rand(0.2, 1.1); v.smoke(ctx.at.x + Math.cos(ang) * r, ctx.at.y + rand(1, 2.4), ctx.at.z + Math.sin(ang) * r, { vx: rand(-0.3, 0.3), vy: -rand(0.3, 0.7), life: rand(1.2, 1.8), size: rand(0.06, 0.1), r: 0.5, gg: 0.75, b: 0.3, a: 1, shape: 1, wob: 1.4, ph: rand(0, 6), floor: ctx.at.y + 0.03 }); } });
    await ctx.until(E - 0.2);
  }
  outro(ctx);
}
// 炎殺: [ROM fx 22] flames spring up around the target, a fire sphere swells out of them and erupts
async function flameKill(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), gy = effectH(at.x, at.z);
  cueAt(ctx, 0.53);   // (the original's flames roar up 0.53 s after the cast begins, its one sound; over at 2.75 s)
  await intro(ctx, [1, 0.5, 0.15], { dur: 850, dist: 10, pitch: 0.42 });
  DARK(ctx, 0.45, 0.85, 0.95, 1);
  v.decal(at, [1, 0.3, 0.05], 1.5, 3.4, { intensity: 0.7, flicker: true });
  v.ring(at, [1, 0.5, 0.15], 1.4, 0.5);
  const ball = v.fireball(1, { heat: 1.05 }); ball.scale.setScalar(0.01); ball.position.set(at.x, gy, at.z);
  let erupted = false;
  v.timed(ball, 3.4, (k, dt, t) => {
    ball.userData.mat.uniforms.uT.value = t;
    // 1) the ground catches: a ring of tongues growing taller
    if (t < 2.9 && Math.random() < (t < 1.6 ? 0.9 : 0.45)) flameRing(v, at, 0.95, t < 1.6 ? 2 : 1, 0.4 + 0.45 * Math.min(1, t / 0.9) * (t < 1.6 ? 1 : 0.55));
    if (t < 1.5 && Math.random() < 0.3) flameRing(v, at, 0.5, 1, 0.35, { inner: 0 });
    // 2) a fire sphere rises out of the flames and swells around the target
    const g = Math.max(0, Math.min(1, (t - 0.55) / 0.95)), R = 0.12 + 0.78 * ease(g);
    if (t < 1.5) {
      ball.scale.setScalar(R); ball.position.y = gy + 0.15 + R * 0.75 + Math.sin(t * 9) * 0.03; ball.rotation.y += dt * 1.5;
      if (g > 0) for (let i = 0; i < 2; i++) {   // tongues licking off its surface
        const a = rand(0, 6.28), e = rand(0.1, 1.3), q = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(R * 0.92).add(ball.position);
        v.realFire(q.x, q.y, q.z, { size: R * rand(0.35, 0.55), asp: rand(1.3, 1.7), life: rand(0.25, 0.45), vy: rand(0.4, 1.2) });
      }
      if (Math.random() < 0.6) v.spark(at.x + rand(-0.8, 0.8), gy + rand(0.1, 1.2), at.z + rand(-0.8, 0.8), { vy: rand(1, 2.5), life: rand(0.4, 0.9), size: rand(0.03, 0.06), r: 1, gg: rand(0.5, 0.8), b: 0.2, shape: 1, flicker: 1, ph: rand(0, 9) });
      v.light(ball.position, [1, 0.45, 0.12], 5 + 9 * g + rand(0, 3), 0.06, 6);
    } else if (!erupted) {
      // 3) eruption
      erupted = true; ball.visible = false;
      const c = ball.position.clone();
      v.explode(c, 0.75, { n: 22 });
      v.flash([1, 0.6, 0.25], 0.16); v.shake(0.22, 0.4); v.hitstop = 0.1; v.screen.chroma = 0.5;
      v.ring(at, [1, 0.6, 0.2], 3.6, 0.7); v.ring(at, [1, 0.9, 0.6], 2, 0.4);
      v.light(c, [1, 0.5, 0.15], 28, 0.9, 9);
      v.burst(c, { n: 90, speed: 7, cols: [[1, 0.95, 0.6], [1, 0.6, 0.15], [1, 0.35, 0.05]], size: 0.07, life: 1.3, g: 6, shape: 1, flicker: 1 });
      ticker(v, 0.7, (kk) => { for (let i = 0; i < 2; i++) v.realFire(at.x + rand(-0.4, 0.4), gy, at.z + rand(-0.4, 0.4), { size: rand(0.98, 1.47) * (1 - kk * 0.4), asp: rand(1.3, 1.7), life: rand(0.4, 0.65), vy: rand(2, 3.8) }); });
      ctx.hit();
    }
  });
  await ctx.wait(1500); await ctx.wait(1500); outro(ctx);
}
// a fallback / generic fire bolt from the sky (spells without their own script)
async function meteor(ctx) {
  const v = ctx.vfx;
  await intro(ctx, [1, 0.55, 0.2], { dur: 900, dist: 12, pitch: 0.36 });
  DARK(ctx, 0.42, 0.85, 0.95, 1);
  const B = basis(ctx), from = ctx.at.clone().add(B.right.clone().multiplyScalar(-6)).add(B.toCam.clone().multiplyScalar(-4)).add(V(0, 9, 0)), to = ctx.at.clone().setY(ctx.at.y + 0.3);
  const ball = v.fireball(0.45, { heat: 1.25 }), rib = v.ribbon({ col: [1, 0.5, 0.15], width: 0.35, n: 20 });
  v.timed(ball, 1.0, (k, dt, t) => {
    ball.userData.mat.uniforms.uT.value = t;
    const p = from.clone().lerp(to, k * (0.4 + 0.6 * k)); ball.position.copy(p); rib.push(p);
    for (let i = 0; i < 4; i++) v.puff(p.x + rand(-0.15, 0.15), p.y + rand(-0.15, 0.15), p.z + rand(-0.15, 0.15), { life: rand(0.25, 0.5), size: rand(0.35, 0.6), size1: 0.9, vy: 0.4 });
    v.smokePuff(p.x, p.y, p.z, { vy: 0.4, life: 1.4, size: 0.4, size1: 1.3 });
    v.light(p, [1, 0.45, 0.12], 50, 0.08, 10);
  }, () => rib.end());
  await ctx.wait(1000);
  v.explode(to, 0.8, { n: 28 }); v.flash([1, 0.6, 0.3], 0.22); v.ring(ctx.at, [1, 0.7, 0.3], 4.5, 0.9); v.shake(0.2, 0.35); v.decal(ctx.at, [1, 0.35, 0.06], 1.8, 2.4, { flicker: true });
  v.burst(to, { n: 100, speed: 7, cols: [[1, 0.9, 0.5], [1, 0.5, 0.15], [0.9, 0.25, 0.05]], size: 0.08, life: 1.2, g: 7, shape: 1 });
  ticker(v, 1.6, (k) => flameRing(v, ctx.at, 1.0, 2, 0.4 * (1 - k)));
  ctx.hit(); await ctx.wait(1300); outro(ctx);
}
// 三昧真火: [ROM fx 23] a ring of fireballs with comet tails circles the target, then they dive into the cross of cells one
// after another, the first on the original's first sound (3.38 s after the cast begins), a roar with each to 4.9 s; the
// five fires join into one column; over at 5.85 s
async function fireOrbs(ctx) {
  const v = ctx.vfx, at = ctx.at.clone(), F = 3.38, E = 5.85;
  await intro(ctx, [1, 0.5, 0.15], { dur: 900, dist: 11, pitch: 0.45 });
  DARK(ctx, 0.42, 0.85, 0.95, 1);
  const C = Math.max(1.45, F - 0.28 - ctx.now());   // (C: they circle until the first dives, 0.28 s before it lands)
  cueAt(ctx, F);
  const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 0], [1, 0], [-1, 0]].map(([dx, dz]) => { const p = V(at.x + dx, 0, at.z + dz); p.y = effectH(p.x, p.z); return p; });
  const n = 8; let landed = 0;
  for (let i = 0; i < n; i++) {
    const o = v.fireball(0.2, { heat: 1.3 }), rib = v.ribbon({ col: [1, 0.45, 0.1], width: 0.13, n: 18 });
    let from = null, done = false;
    const dive = C + i * 0.2;
    v.timed(o, dive + 1.2, (k, dt, t) => {
      o.userData.mat.uniforms.uT.value = t + i;
      let p;
      if (t < dive) { const r = 2.1 - Math.min(1, t / dive) * 0.6, a = t * 3.4 + i / n * 6.28; p = V(at.x + Math.cos(a) * r, at.y + 1.2 + Math.sin(t * 4 + i) * 0.15 + Math.min(t, 1.6) * 0.4, at.z + Math.sin(a) * r); from = p.clone(); }
      else { const f = Math.min(1, (t - dive) / 0.28), tg = cells[i].clone().setY(cells[i].y + 0.25); p = bezier(from, from.clone().lerp(tg, 0.5).add(V(0, 1.2, 0)), tg, f * f);
        if (f >= 1 && !done) {
          done = true; o.visible = false; rib.end(); landed++;
          v.explode(tg, 0.42, { n: 12, smoke: Math.random() < 0.6 }); v.shake(0.07, 0.12); v.decal(cells[i], [1, 0.35, 0.06], 0.7, 1.4, { flicker: true });
          ticker(v, 0.7, (kk) => flameRing(v, cells[i], 0.4, 1, 0.42 * (1 - kk * 0.6), { inner: 0 }));
          v.light(tg, [1, 0.5, 0.15], 35, 0.3, 6);
        } }
      if (!done) { o.position.copy(p); rib.push(p); if (Math.random() < 0.7) v.puff(p.x, p.y, p.z, { life: 0.3, size: 0.22, size1: 0.35, vy: 0.3 }); }
    });
  }
  v.light(at.clone().setY(at.y + 1.4), [1, 0.5, 0.15], 40, C + 1.6, 9);
  await ctx.until(F + 1.75);
  // the five fires join into one column
  v.flash([1, 0.55, 0.25], 0.22); v.shake(0.2, 0.35); v.ring(at, [1, 0.6, 0.2], 3.2, 0.7);
  ticker(v, 0.8, (k) => { for (let i = 0; i < 5; i++) v.realFire(at.x + rand(-0.45, 0.45), at.y, at.z + rand(-0.45, 0.45), { size: rand(0.84, 1.33) * (1 - k * 0.5), asp: rand(1.3, 1.7), life: rand(0.35, 0.6), vy: rand(2.5, 5) }); });
  v.explode(at.clone().setY(at.y + 0.6), 0.6, { n: 16 });
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
// 冰晶術: [ROM fx 26] an ice orb falls trailing sparkles, smashes, and a cluster of crystals bursts up and shatters
async function iceCrystals(ctx) {
  const col = [0.55, 0.85, 1], v = ctx.vfx, at = ctx.at.clone();
  cueAt(ctx, 0.98);   // (the original's one sound as the orb forms, 0.98 s after the cast begins; over at 2.3 s)
  await intro(ctx, col, { dur: 800, dist: 10, pitch: 0.45 });
  DARK(ctx, 0.35, 0.9, 0.5, 0.2);
  const iceMat = iceMaterial();   // (src/elements.js)
  const B = basis(ctx), from = at.clone().add(B.right.clone().multiplyScalar(-3.5)).add(V(0, 7, 0)), to = at.clone().setY(at.y + 0.4);
  const orb = new THREE.Mesh(chunkGeometry(), iceMat); orb.scale.setScalar(0.42);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: v.glowTex, color: new THREE.Color(0.5, 0.85, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); orb.add(halo);
  const rib = v.ribbon({ col, width: 0.3, n: 22 });
  v.timed(orb, 0.75, (k, dt) => {
    const p = from.clone().lerp(to, k * k); orb.position.copy(p); orb.rotation.x += dt * 5; orb.rotation.y += dt * 3; halo.lookAt(ctx.cam.camera.position); rib.push(p);
    for (let i = 0; i < 3; i++) v.spark(p.x + rand(-0.3, 0.3), p.y + rand(-0.3, 0.3), p.z + rand(-0.3, 0.3), { vy: rand(-0.3, 0.3), life: rand(0.4, 0.8), size: rand(0.05, 0.1), r: 0.8, gg: 0.95, b: 1, shape: 1, flicker: 1, ph: rand(0, 9) });
    if (Math.random() < 0.5) v.smokePuff(p.x, p.y, p.z, { life: 0.7, size: 0.25, size1: 0.6, tint: [0.7, 0.85, 1] });
  }, () => rib.end());
  await ctx.wait(750);
  v.flash([0.7, 0.9, 1], 0.12); v.shake(0.14, 0.25); v.ring(at, [0.8, 0.95, 1], 3, 0.6); v.decal(at, [0.4, 0.7, 1], 1.8, 2.2, { intensity: 0.5 }); frost(v, at, 1.6, 2.6);
  v.burst(to, { n: 60, speed: 6, cols: [[1, 1, 1], [0.7, 0.9, 1], [0.45, 0.75, 1]], size: 0.07, life: 0.9, g: 9, shape: 1 });
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), s = rand(1.2, 2.4); v.smokePuff(at.x + Math.cos(a) * 0.5, at.y + 0.08, at.z + Math.sin(a) * 0.5, { vx: Math.cos(a) * s, vy: rand(0.02, 0.15), vz: Math.sin(a) * s, drag: 2.2, life: rand(1.2, 1.8), size: 0.3, size1: 0.9, tint: [0.62, 0.78, 0.95] }); }
  for (let i = 0; i < 13; i++) {
    const a = rand(0, 6.28), r = i === 0 ? 0 : rand(0.3, 1.0), h = i === 0 ? 2.0 : rand(0.6, 1.5);
    const m = new THREE.Mesh(shardGeometry(), iceMat); m.scale.set(0.001, 0.001, 0.001);
    const p = V(at.x + Math.cos(a) * r, effectH(at.x, at.z) - 0.05, at.z + Math.sin(a) * r);
    m.position.copy(p); m.rotation.set(rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2), rand(0, 6), rand(-0.5, 0.5) * (r > 0 ? 1 : 0.2));
    v.timed(m, 1.5, (k, dt, t) => {
      const d = i * 0.03, g = Math.min(1, Math.max(0, (t - d) / 0.14)), w = (i === 0 ? 0.24 : 0.17);
      m.scale.set(w * g + 0.001, h * g + 0.001, w * g + 0.001);
      if (t > 1.05 && !m.userData.b) { m.userData.b = 1; m.visible = false;
        v.burst(p.clone().setY(p.y + h * 0.5), { n: 20, speed: 4, cols: [[1, 1, 1], [0.7, 0.9, 1], [0.45, 0.75, 1]], size: 0.07, life: 0.9, g: 9, shape: 1 });
        shatter(v, p.clone().setY(p.y + h * 0.5), 5, iceMat, { size: 0.2 }); }
    });
  }
  v.light(at.clone().setY(at.y + 1), col, 10, 1.6, 6);
  ctx.hit();
  await ctx.wait(1100); v.flash([0.8, 0.95, 1], 0.08); v.shake(0.1, 0.2);
  await ctx.wait(800); outro(ctx);
}
// 疾雷: [ROM fx 30] one bolt strikes the target and a spiked ball of lightning crackles on it
async function thunder(ctx) {
  const col = [0.7, 0.8, 1], v = ctx.vfx, at = ctx.at.clone();
  cueAt(ctx, 0.7);   // (the original's thunder 0.7 s after the cast begins, as the storm gathers; over at 1.8 s)
  await intro(ctx, col, { dur: 800, dist: 11, pitch: 0.34 });
  v.screen.darkTarget = 0.6; v.screen.darkCol.setRGB(0.9, 0.85, 0.6);
  for (let i = 0; i < 26; i++) v.smokePuff(at.x + rand(-3, 3), at.y + rand(6, 7.5), at.z + rand(-3, 3), { vx: rand(-0.3, 0.3), life: 2.8, size: 2.2, size1: 3.4, tint: [0.12, 0.12, 0.17] });
  await ctx.wait(500);
  for (let s = 2; s < 3; s++) {   // one strike, the great one [the user's call: it struck three times]
    const tp = at.clone().add(V(rand(-0.25, 0.25), 0.2, rand(-0.25, 0.25)));
    v.bolt(tp.clone().add(V(rand(-1, 1), 8, rand(-1, 1))), tp, col, 0.28, { width: s === 2 ? 0.16 : 0.08 });
    v.flash([0.8, 0.85, 1], s === 2 ? 0.16 : 0.1); v.light(tp.clone().setY(tp.y + 2), col, 30, 0.25, 10);
    v.burst(tp, { n: 40, speed: 5, cols: [[1, 1, 1], [0.7, 0.8, 1]], size: 0.05, life: 0.6, shape: 1 });
    v.ring(tp, col, 1.6, 0.4); v.shake(0.1, 0.2); v.decal(tp, [0.5, 0.6, 1], 1.2, 0.8);
    if (s === 2) {
      v.impact(tp, col, 1.5); ctx.hit();
      // the plasma ball
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uT: { value: 0 }, uA: { value: 1 } },
        vertexShader: `varying vec3 vP, vN, vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uT, uA; varying vec3 vP, vN, vV; ${NOISE}
          void main(){ vec3 q = normalize(vP); float n = fbm(vec2(atan(q.z, q.x) * 2.0 + uT * 3.0, q.y * 3.0 - uT * 4.0) + floor(uT * 20.0) * 0.37);
            float ridge = 1.0 - abs(n * 2.0 - 1.0); ridge = pow(ridge, 8.0);
            float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            vec3 c = vec3(0.45, 0.6, 1.0) * (0.3 + f * 1.4) + vec3(0.9, 0.95, 1.0) * ridge * 3.0;
            gl_FragColor = vec4(c, (0.25 + ridge + f * 0.6) * uA); }` }));
      orb.position.copy(tp).setY(tp.y + 0.4);
      v.timed(orb, 1.0, (k, dt, t) => {
        orb.material.uniforms.uT.value = t; orb.material.uniforms.uA.value = Math.min(1, (1 - k) * 3);
        orb.scale.setScalar(0.7 + 0.35 * Math.min(1, t * 6) + Math.sin(t * 40) * 0.05);
        if (Math.random() < 0.45) { const d = V(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.9, 1.6)); v.bolt(orb.position.clone(), orb.position.clone().add(d), col, 0.1, { width: 0.03, jag: 0.4 }); }
        v.light(orb.position, col, 6 + rand(0, 6), 0.05, 5);
      });
    }
    await ctx.wait(s === 2 ? 1100 : 380);
  }
  outro(ctx);
}
// 歸元 / 凝神歸元: [ROM fx 38/40] spirit leaves drift down onto the target, a lotus-shaped ring of light opens under
// it and motes of life rise, wound by spiralling ribbons
// (it heals with the original's chime, F s after the cast begins: 3.02 for both; the leaves take the time before it)
async function heal(ctx, col, F = 3.02) {
  const v = ctx.vfx;
  await intro(ctx, col, { dur: 600, dist: 8, pitch: 0.42 });
  const list = ctx.targets.length ? ctx.targets : [{ pos: ctx.at }], D = Math.max(0.9, F - 0.45 - ctx.now()), R = Math.max(900, (F - 0.4 - ctx.now()) * 1000);   // (D: the leaves' fall; R ms: the ring)
  for (const t of list) {
    const P = t.pos.clone();
    // leaves of light spiral down onto the target
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.32), new THREE.MeshBasicMaterial({ map: LEAF, color: new THREE.Color(...col).multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      const a0 = i / 9 * 6.28, d = i * 0.05;
      v.timed(m, D + 0.1 + d, (k, dt, tt) => {
        const f = Math.max(0, Math.min(1, (tt - d) / D)), a = a0 + f * (3 + D), r = 0.9 * (1 - f) + 0.15;
        m.position.set(P.x + Math.cos(a) * r, P.y + 2.6 - f * 2.2, P.z + Math.sin(a) * r); m.rotation.set(tt * 3 + i, a, tt * 2);
        m.material.opacity = Math.min(1, f * 5) * (1 - Math.max(0, (f - 0.85) / 0.15));
        if (f >= 1 && !m.userData.p) { m.userData.p = 1; v.burst(m.position, { n: 5, speed: 1, col, size: 0.04, life: 0.4, g: 0 }); }
      });
    }
    later(ctx, R, () => {
      v.decal(P, col, 1.1, 1.8, { intensity: 0.7 }); v.ring(P, col, 1.6, 0.7, { intensity: 1.2 });
      v.pillar(P, col, 0.45, 3.2, 1.4, { taper: 0.9, intensity: 0.45, grow: 1 });
      v.light(P.clone().setY(P.y + 1.2), col, 12, 1.6, 6);
      for (let j = 0; j < 3; j++) { const r = v.ribbon({ col, width: 0.06, n: 22 });
        ticker(v, 1.3, (k, dt, tt) => { const a = tt * 6 + j * 2.09, rr = 0.5 - k * 0.2; r.push(V(P.x + Math.cos(a) * rr, P.y + 0.1 + k * 2.2, P.z + Math.sin(a) * rr)); }, () => r.end()); }
      for (let i = 0; i < 50; i++) later(ctx, i * 20, () => v.spark(P.x + rand(-0.45, 0.45), P.y + rand(0, 0.3), P.z + rand(-0.45, 0.45), { vy: rand(0.7, 1.5), life: rand(0.9, 1.4), size: rand(0.04, 0.08), r: col[0], gg: col[1], b: col[2], shape: Math.random() < 0.6 ? 1 : 0, wob: 0.5, ph: rand(0, 6) }));
    });
  }
  await ctx.until(F); ctx.hit(); await ctx.wait(1000); outro(ctx);
}
// 靈血咒 / 淨衣咒: [ROM fx 44/45] a golden talisman descends, its seal glows and it bursts, washing the target clean
// (it bursts on the original's chime, 3.45 s after the cast begins; the talisman takes the time before it to come down)
async function cleanse(ctx, col, glyph) {
  const v = ctx.vfx, F = 3.45;
  await intro(ctx, col, { dur: 600, dist: 8, pitch: 0.42 });
  const list = ctx.targets.length ? ctx.targets : [{ pos: ctx.at }], tex = talismanTex(glyph), L = Math.max(1.5, F - 0.05 - ctx.now()), DN = L - 0.7;   // (L: the card's life, to the burst; DN: its descent)
  for (const t of list) {
    const P = t.pos.clone(), top = P.clone().setY(P.y + 2.6);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    const aura = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8), new THREE.MeshBasicMaterial({ map: v.glowTex, color: new THREE.Color(...col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    aura.position.z = -0.01; card.add(aura);
    v.timed(card, L, (k, dt, tt) => {
      const f = Math.min(1, tt / DN);
      card.position.copy(top).setY(top.y + 1.4 * (1 - ease(f)) + Math.sin(tt * 3) * 0.05);
      card.lookAt(ctx.cam.camera.position); card.rotateZ(Math.sin(tt * 2.2) * 0.08);
      aura.material.opacity = Math.min(1, Math.max(0, (tt - DN + 0.2) / 0.5)) * 0.8;
      card.material.color.setScalar(1 + Math.max(0, tt - DN) * 2.5);
      if (tt > DN && Math.random() < 0.6) { const q = card.position; v.spark(q.x + rand(-0.25, 0.25), q.y + rand(-0.5, 0.5), q.z + rand(-0.25, 0.25), { vy: -rand(0.4, 1), life: 0.8, size: 0.05, r: col[0], gg: col[1], b: col[2], shape: 1 }); }
      if (k >= 0.99 && !card.userData.b) {
        card.userData.b = 1;
        v.burst(card.position, { n: 40, speed: 3, cols: [[1, 0.95, 0.7], col], size: 0.06, life: 0.9, g: 2, shape: 1 });
        for (let i = 0; i < 14; i++) v.smoke(card.position.x, card.position.y, card.position.z, { vx: rand(-1.4, 1.4), vy: rand(-0.6, 1), vz: rand(-1.4, 1.4), drag: 1.5, life: rand(0.8, 1.3), size: 0.06, r: 0.95, gg: 0.82, b: 0.5, a: 1, shape: 1, wob: 1, ph: rand(0, 6) });
        // purifying light washes down over the target
        v.pillar(P, col, 0.5, 3, 1.1, { taper: 1.1, intensity: 0.6 }); v.ring(P, col, 2, 0.6, { intensity: 1.2 }); v.decal(P, col, 1, 1.3, { intensity: 0.8 });
        v.light(P.clone().setY(P.y + 1.2), col, 14, 0.9, 6);
      }
    });
  }
  await ctx.until(F); ctx.hit(); await ctx.wait(900); outro(ctx);
}
// 迴夢: [ROM fx 51] a lotus blooms around the target, pulsing pink with each of the original's nine sounds (the first
// 1.78 s after the cast begins, a sixth of a second apart), then bursts into pink light (3.2 s); the target drowses,
// flickering in a pink haze; over at 5.3 s
async function dream(ctx) {
  const col = [1, 0.6, 0.9], v = ctx.vfx, at = ctx.at.clone(), F = 1.78, E = 5.33, tr = ctx.track.length ? ctx.track : [...Array(9).keys()].map(i => i / 6);
  await intro(ctx, col, { dur: 700, dist: 9, pitch: 0.45 });
  await ctx.until(F - 0.3);
  DARK(ctx, 0.4, 0.5, 0.85, 0.4);
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: true,
    uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv;
      void main(){ vec3 base = vec3(1.0, 0.92, 0.95), tip = vec3(1.0, 0.32, 0.62); vec3 c = mix(base, tip, smoothstep(0.25, 1.0, vUv.y));
        float vein = 1.0 - smoothstep(0.0, 0.05, abs(vUv.x - 0.5)); c += vec3(0.3, 0.05, 0.1) * vein * vUv.y;
        gl_FragColor = vec4(c * (0.9 + 0.5 * vUv.y), uA); }` });
  const pg = petalGeo(), lotus = new THREE.Group(), petals = [];
  for (const [n, sc, off, open0, open1] of [[9, 1.25, 0, 0.15, 1.15], [7, 0.95, 0.35, 0.08, 0.75], [5, 0.65, 0.1, 0.02, 0.35]]) for (let i = 0; i < n; i++) {
    const pivot = new THREE.Group(), m = new THREE.Mesh(pg, mat); pivot.rotation.y = i / n * 6.28 + off; m.scale.setScalar(sc); pivot.add(m); lotus.add(pivot); petals.push({ m, open0, open1, pivot });
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.6), toneMapped: false })); core.position.y = 0.12; lotus.add(core);
  lotus.position.set(at.x, effectH(at.x, at.z) + 0.02, at.z);
  v.light(at.clone().setY(at.y + 1), col, 25, 2.4, 6); v.decal(at, col, 1.6, 2.4);
  const BU = F + 1.42 - ctx.now();   // (the burst, after the last pulse)
  v.timed(lotus, BU + 0.9, (k, dt, t) => {
    const g = ease(Math.min(1, t / 1.0)); lotus.scale.setScalar(0.2 + 0.9 * g); lotus.rotation.y += dt * 0.5;
    mat.uniforms.uA.value = Math.min(1, t * 3) * (t > BU + 0.4 ? Math.max(0, 1 - (t - BU - 0.4) / 0.4) : 1);
    for (const p of petals) p.m.rotation.x = -(p.open0 + (p.open1 - p.open0) * g) + (t > BU ? (t - BU) * 1.5 : 0);
    if (Math.random() < 0.5) v.spark(at.x + rand(-0.6, 0.6), at.y + rand(0.2, 1), at.z + rand(-0.6, 0.6), { vy: rand(0.2, 0.6), life: 1, size: 0.06, r: 1, gg: 0.75, b: 0.92, shape: 0, wob: 0.8, ph: rand(0, 6) });
  });
  // a pulse of pink light on each sound
  for (let i = 0; i < tr.length; i++) { await ctx.until(F + tr[i]); if (i === 0) ctx.cue(); core.scale.setScalar(1.6); v.light(at.clone().setY(at.y + 0.6), col, 10, 0.12, 5); v.ring(at, col, 1.2 + (i % 3) * 0.3, 0.3, { intensity: 0.8 }); later(ctx, 80, () => core.scale.setScalar(1)); }
  await ctx.until(F + 1.42);
  // bloom bursts: pink light puffs, flying petals and a drowsy haze
  v.flash([1, 0.6, 0.85], 0.18); v.ring(at, [1, 0.7, 0.9], 2.4, 0.6);
  for (let i = 0; i < 5; i++) later(ctx, i * 90, () => { const q = at.clone().add(V(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5)));
    v.burst(q, { n: 16, speed: 2, col: [1, 0.7, 0.92], size: 0.06, life: 0.7, g: 0, shape: 1 }); v.spark(q.x, q.y, q.z, { life: 0.4, size: 0.9, size1: 0.1, r: 1, gg: 0.6, b: 0.85, shape: 0 }); });
  for (let i = 0; i < 30; i++) v.smoke(at.x + rand(-0.5, 0.5), at.y + rand(0.3, 1), at.z + rand(-0.5, 0.5), { vx: rand(-1, 1), vy: rand(0.4, 1.4), vz: rand(-1, 1), drag: 1, life: rand(1.2, 2), size: 0.1, r: 1, gg: rand(0.45, 0.7), b: 0.75, a: 1, shape: 1, wob: 1.2, ph: rand(0, 6), orb: { x: at.x, z: at.z, w: 1.5 } });
  for (let i = 0; i < 10; i++) v.smokePuff(at.x + rand(-1, 1), at.y + rand(0.05, 0.4), at.z + rand(-1, 1), { vy: rand(0.05, 0.15), life: 2.6, size: 0.4, size1: 1.1, tint: [0.95, 0.66, 0.85] });
  ticker(v, E - 0.3 - ctx.now(), (k, dt, t) => { for (const a of ctx.targets) a.flash = 0.35 * (1 - k) * (Math.sin(t * 9) > 0.3 ? 1 : 0); if (Math.random() < 0.25) v.spark(at.x + rand(-0.4, 0.4), at.y + rand(0.8, 1.4), at.z + rand(-0.4, 0.4), { vy: rand(0.1, 0.3), life: 1.2, size: 0.07, r: 1, gg: 0.7, b: 0.9, shape: 0, wob: 0.6, ph: rand(0, 6) }); }, () => { for (const a of ctx.targets) a.flash = 0; });   // (the target drowses, flickering, as the original's)
  ctx.hit(); await ctx.until(E - 0.1); outro(ctx);
}
async function dragon(ctx) {
  const col = [0.35, 0.7, 1], v = ctx.vfx;
  await intro(ctx, col, { dur: 900, dist: 13, pitch: 0.3 });
  DARK(ctx, 0.9, 0.92, 0.75, 0.42);                        // storm: the world turns a deep night-blue (stronger: on a sunlit map the old 0.62 read as a rainy afternoon)
  v.rain(ctx.at, 3.4, { n: 600 });
  for (let i = 0; i < 60; i++) v.smoke(ctx.at.x + rand(-6, 6), ctx.at.y + rand(7, 9), ctx.at.z + rand(-5, 5), { vx: rand(-0.4, 0.4), life: 3.4, size: 2.4, size1: 3.6, r: 0.06, gg: 0.08, b: 0.14, a: 0.7, shape: -1, fadeIn: 0.8 });
  // [the original's time, tools/rom/spelltime.py: its first sound 2.6 s after the cast begins, its second 1.5 s later,
  // the effect over at 5.1 s] the dragon comes up through the ground on the first (it surfaces 0.23 s into its path)
  const FIRST = 2.6, END = 5.1;
  await ctx.until(FIRST - 1.4);
  ctx.cam.shot(ctx.at.clone().add(V(0, 2.0, 0)), { cine: true, dist: 12, pitch: 0.36, yaw: 0.4, speed: 1.8 });   // [remade next-gen, 2026-10-23] low, looking up into the storm
  // the water dragon: a scaled tube following a spiral around the target, rebuilt every frame
  const N = 60, pts = Array.from({ length: N }, () => V(0, -50, 0));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, toneMapped: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vN, vV;
      void main(){
        vec2 sc = vec2(vUv.x * 90.0, vUv.y * 6.0); vec2 c = fract(sc) - 0.5; float sh = 1.0 - smoothstep(0.15, 0.5, length(c * vec2(1.0, 1.6)));
        float belly = smoothstep(0.35, 0.5, abs(vUv.y - 0.5));
        vec3 back = vec3(0.05, 0.28, 0.75), bel = vec3(0.55, 0.95, 1.0), base = mix(back, bel, belly);
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float flow = 0.5 + 0.5 * sin(vUv.x * 40.0 - uT * 12.0);
        vec3 col = base * (0.55 + 0.45 * sh) + vec3(0.5, 0.9, 1.0) * rim * 1.6 + vec3(0.2, 0.5, 1.0) * flow * 0.25;
        float tail = smoothstep(0.0, 0.06, vUv.x);
        gl_FragColor = vec4(col * 1.4, tail); }`,
  });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), mat); body.renderOrder = 6; body.frustumCulled = false;
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x2a6fd0, emissive: 0x1a4aa0, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 }));
  skull.rotation.x = Math.PI / 2; skull.position.z = 0.35; head.add(skull);
  for (const sgn of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc040, emissiveIntensity: 1.4 }));
    horn.position.set(sgn * 0.18, 0.3, -0.2); horn.rotation.set(-1.0, 0, sgn * 0.35); head.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.8), toneMapped: false }));
    eye.position.set(sgn * 0.17, 0.12, 0.25); head.add(eye);
    const whisk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.9, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.8, 2), toneMapped: false }));
    whisk.position.set(sgn * 0.25, -0.05, 0.55); whisk.rotation.set(0.4, 0, sgn * 1.2); head.add(whisk);
  }
  // [the user's call] the dragon bursts up out of the ground under the target and spirals up into the storm, not down
  // onto it: out of the earth through the target, round it in a widening coil, away into the clouds
  const g0 = effectH(ctx.at.x, ctx.at.z);
  // (a slower, lower coil than it was [the user's call, next-gen: the dragon on screen]: it rises round the target and the lifted target, its head
  // turning in view, before it climbs into the storm)
  const path = t => { const a = t * 8 + 1.2, r = 0.2 + Math.min(1, t * 1.8) * 2.6, y = g0 - 1.4 + t * 6.5 + Math.max(0, t - 0.8) * 8; return V(ctx.at.x + Math.cos(a) * r, y, ctx.at.z + Math.sin(a) * r * 0.8); };
  let erupted = false;
  // the ground bursts open where it comes through: a spiralling geyser of water round the target, with the spell's
  // first sound (the original's: the target lifted)
  const erupt = () => {
    erupted = true; ctx.cue(); const base = ctx.at.clone().setY(g0);
    v.impact(ctx.at, col, 1.6); v.flash([0.7, 0.85, 1], 0.25); v.shake(0.25, 0.4); v.hitstop = 0.08;
    swirl(v, base, [0.15, 0.45, 1], 1.0, 0.85, 6.5, 1.8, { speed: 3, twist: 6, foam: [0.85, 0.95, 1], intensity: 1.3 });
    swirl(v, base, [0.4, 0.75, 1], 0.6, 0.55, 7, 1.8, { speed: -5, twist: 3, intensity: 0.8 });
    for (let i = 0; i < 30; i++) { const a = rand(0, 6.28), s = rand(1.5, 3.5); v.smokePuff(ctx.at.x + Math.cos(a) * 0.9, g0 + 0.1, ctx.at.z + Math.sin(a) * 0.9, { vx: Math.cos(a) * s, vy: rand(0.6, 2), vz: Math.sin(a) * s, drag: 2, life: rand(1, 1.8), size: 0.5, size1: 1.4, tint: [0.7, 0.85, 1] }); }
    for (let i = 0; i < 160; i++) { const a = rand(0, 6.28), s = rand(2, 7); v.spark(ctx.at.x, g0 + 0.3, ctx.at.z, { vx: Math.cos(a) * s * 0.5, vy: rand(3, 9), vz: Math.sin(a) * s * 0.5, g: 14, life: rand(0.8, 1.4), size: rand(0.04, 0.08), r: 0.7, gg: 0.9, b: 1, shape: 1 }); }
    v.ring(ctx.at, [0.6, 0.85, 1], 3.5, 1); v.ring(ctx.at, [1, 1, 1], 2, 0.6);
  };
  // the dragon king itself, as the original shows it (its own sprite, assets/fx/summon_53.png): coiled over the target in
  // the storm, materialising out of it in a water-blue aura before its dragon comes up through the ground
  const king = beastSprite(v, 53, 2.6, PAL.water), kingAt = ctx.at.clone().add(V(0, 2.6, 0)).addScaledVector(basis(ctx).toCam, -1.2);   // (in frame, behind the target)
  v.world.scene.add(king); king.position.copy(kingAt);
  v.timed(king, END - (FIRST - 1.4) - 0.3, (k, dt, t) => { const U = king.userData; U.fit(); U.face(); U.set('uT', t); U.set('uK', Math.min(1, t / 0.8) * Math.min(1, (END - (FIRST - 1.4) - 0.3 - t) / 0.5)); king.position.y = kingAt.y + Math.sin(t * 1.6) * 0.12; });
  await ctx.until(FIRST - 0.48);   // (it breaks the surface 0.48 s into its path: on the original's first sound)
  v.timed(body, 3.4, (k, dt, t) => {
    mat.uniforms.uT.value = t;
    const lead = Math.min(1.35, t / 2.6);
    for (let i = 0; i < N; i++) pts[i] = path(Math.max(0, Math.min(1.3, lead - i * 0.0085)));
    const curve = new THREE.CatmullRomCurve3(pts.slice().reverse());
    body.geometry.dispose(); body.geometry = new THREE.TubeGeometry(curve, 120, 0.36, 10, false);
    const hp = pts[0], nx = path(Math.min(1.3, lead + 0.01)); head.position.copy(hp); head.lookAt(nx); head.visible = lead < 1.15 && hp.y > g0 - 0.3;
    body.visible = lead - (N - 1) * 0.0085 < 1.15;
    if (!erupted && hp.y > g0 - 0.2) erupt();
    if (head.visible) { v.light(hp, col, 35, 0.06, 8); for (let i = 0; i < 3; i++) { const q = pts[(Math.random() * N) | 0]; if (q.y > g0) v.spark(q.x + rand(-0.2, 0.2), q.y + rand(-0.2, 0.2), q.z + rand(-0.2, 0.2), { vy: rand(-1, 0.2), g: 4, life: 0.6, size: rand(0.04, 0.07), r: 0.6, gg: 0.85, b: 1, shape: 1 }); } }
  });
  v.timed(head, 3.4, () => {}); head.scale.setScalar(1.5);
  // as in the original, the target is lifted: up into the coil of water, turning, spirals of water streaming round it
  const T0 = ctx.targets[0], face0 = T0 && T0.u.facing, spin = [0, 1, 2].map(i => energyStreak(v, PAL.water, 20, 0.16, i * 3.7, { taper: 0.95 })), up0 = ctx.at.y;
  ticker(v, 1.45, (k, dt, t) => { if (T0) { T0.lift = 2.2 * Math.sin(Math.min(1, k * 1.3) * Math.PI / 2); T0.u.facing = ['down', 'right', 'up', 'left'][Math.floor(t * 9) % 4]; }
    spin.forEach((st, i) => { const a = t * 7 + i * 2.1, r = 0.9 + 0.2 * Math.sin(t * 3 + i); st.push(V(ctx.at.x + Math.cos(a) * r, up0 + 0.3 + k * 2.4 + i * 0.25, ctx.at.z + Math.sin(a) * r * 0.85)); }); }, () => spin.forEach(st => st.end()));
  // the original's second sound (1.5 s after its first): the target slammed down; here the storm's lightning strikes
  // it from the clouds the dragon has gone up into and dashes it to the ground
  await ctx.until(FIRST + (ctx.track[1] || 1.5) - 0.12);
  ctx.cam.shot(ctx.at.clone().add(V(0, 0.8, 0)), { cine: true, dist: 9, pitch: 0.42, yaw: 0.4, speed: 4 });
  if (T0) ticker(v, 0.12, k => { T0.lift = 2.2 * (1 - k * k); }, () => { T0.lift = 0; T0.u.facing = face0; });
  await ctx.until(FIRST + (ctx.track[1] || 1.5));
  for (let i = 0; i < 24; i++) { const a = rand(0, 6.28), sp = rand(2, 6); v.spark(ctx.at.x, up0 + 0.2, ctx.at.z, { vx: Math.cos(a) * sp, vy: rand(2, 6), vz: Math.sin(a) * sp, g: 12, life: rand(0.5, 1), size: rand(0.04, 0.08), r: 0.7, gg: 0.9, b: 1, shape: 1, floor: up0 + 0.02 }); }   // the splash
  v.decal(ctx.at, [0.03, 0.05, 0.1], 1.4, 1.6, {});
  const sky = ctx.at.clone().setY(ctx.at.y + 9), tg = ctx.at.clone().setY(ctx.at.y + 0.4);
  for (let i = 0; i < 3; i++) v.bolt(sky.clone().add(V(rand(-0.6, 0.6), 0, rand(-0.4, 0.4))), tg, [0.75, 0.9, 1], 0.35, { width: 0.09 });
  v.impact(tg, col, 1.4); v.flash([0.85, 0.92, 1], 0.3); v.shake(0.25, 0.35); v.ring(ctx.at, [0.6, 0.85, 1], 3, 0.6); v.hitstop = 0.08;
  ctx.hit(); await ctx.until(END);
  outro(ctx);
}
// ---------------------------------------------------------------- dispatch
const SCRIPT = {
  0: c => flyingSwords(c, 3), 1: giantSword, 4: c => swordRain(c, 10, [0.55, 0.85, 1], 2.68, 5.2), 5: c => swordRain(c, 16, [1, 0.85, 0.4], 4.05, 6.08),
  12: c => arrow(c, false), 16: c => arrow(c, true), 22: flameKill, 23: fireOrbs, 26: iceCrystals, 30: thunder,
  38: c => heal(c, [0.5, 1, 0.55]), 40: c => heal(c, [0.55, 1, 0.75]), 44: c => cleanse(c, [1, 0.8, 0.4], '靈血'), 45: c => cleanse(c, [1, 0.92, 0.6], '淨衣'),
  51: dream, 53: dragon, ...SPELLBOOK,   // (52 哮天犬 in SPELLBOOK)
};
export const scripted = id => id in SCRIPT;   // every spell id the ROM has gets its own set-piece (tools/qa/spells.js checks)
export async function playSpell(id, ctx, kind) {
  const f = SCRIPT[id] || (kind === 12 ? c => heal(c, [0.6, 1, 0.6]) : meteor);
  await f(ctx);
}
// items: a healing draught is a drop of light that falls and splashes; harmful items explode
export async function playItem(ctx, harmful) {
  const v = ctx.vfx, col = harmful ? [1, 0.6, 0.3] : [0.6, 1, 0.7];
  for (const t of ctx.targets.length ? ctx.targets : [{ pos: ctx.at }]) {
    const P = t.pos.clone();
    if (harmful) { v.explode(P.clone().setY(P.y + 0.5), 0.45, { n: 14 }); v.shake(0.12, 0.2); v.decal(P, [1, 0.35, 0.06], 0.8, 1.2, { flicker: true }); continue; }
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col).multiplyScalar(1.6), toneMapped: false }));
    drop.scale.y = 1.5; const rib = v.ribbon({ col, width: 0.07, n: 12 });
    v.timed(drop, 0.45, (k) => { drop.position.copy(P).setY(P.y + 2.4 - k * k * 2.1); rib.push(drop.position); }, () => {
      rib.end(); v.ring(P, col, 1.4, 0.6, { intensity: 1.3 }); v.decal(P, col, 0.9, 1.2, { intensity: 0.7 });
      v.burst(P.clone().setY(P.y + 0.3), { n: 22, speed: 2.2, col, size: 0.05, life: 0.7, g: 6, shape: 1 });
      for (let i = 0; i < 24; i++) v.spark(P.x + rand(-0.4, 0.4), P.y + 0.1, P.z + rand(-0.4, 0.4), { vy: rand(0.6, 1.4), life: 1, size: 0.06, r: col[0], gg: col[1], b: col[2], shape: 1, wob: 0.5, ph: rand(0, 6) });
    });
  }
  await ctx.wait(700); ctx.hit(); await ctx.wait(700);
}
