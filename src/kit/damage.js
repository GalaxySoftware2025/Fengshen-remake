// War's marks over a built set (孟津 after the fighting: battle 29 and scene 60). The original draws dark star-shaped breaks
// all over its roofs, walls, doors and windows (map 0fc438); here real ones, ragged holes (breakTex), are projected onto the buildings' own faces (project:
// the faces' triangles clipped to a box, so a break follows a roof's sag and stops at its edge), soot rising over some of
// those in the walls, and the ground scorched and holed, with what fell from the roofs at the buildings' feet [the user's
// call: the floors too, which the original leaves whole]. Nothing here changes the ground's height: units stand where they
// stood, and every piece on open ground is flat (a decal, or debris a few hundredths high).
import * as THREE from 'three';
import * as T from './tex.js';

const H = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- the marks (alpha: clear where nothing is marked)
// a break, four of them in one texture (2 x 2: a break picks its cell, BREAKS), each its own ragged shape [the user's
// report, 2026-11-18: every break in battle 29 the same six-pointed star (the original's drawing), "real broken parts
// shouldn't look like this"]. In a roof (laths): tiles knocked out, the hole longer down the slope than across it (v up
// the slope: projected unturned), its rim broken tile ends showing their clay, the battens across it under the ridge's
// line, dark between them, a little soot on the tiles round it, uneven; a crack or two running on into the tiles. In a
// wall: plaster broken away in a ragged hole, its rim the plaster's thickness, the laths behind it, cracks running out
const BREAKS = 4;
function breakTex(laths) {
  return T.pbr(laths ? 'warRoofBreak2' : 'warWallBreak2', 256, (U, V, o) => {
    const k = (U >= 0.5 ? 1 : 0) + (V >= 0.5 ? 2 : 0), u = (U * 2) % 1, v = (V * 2) % 1, sd = (laths ? 700 : 760) + k * 13;
    const x = (u - 0.5) / (laths ? 0.78 : 1), y = v - 0.5, a = Math.atan2(y, x), d = Math.hypot(x, y) * 2;
    // the outline: smooth lobes round it (noise on a circle), ragged at a finer scale (broken tile ends, plaster)
    const lobe = T.fbm(0.5 + 0.35 * Math.cos(a), 0.5 + 0.35 * Math.sin(a), 3.2, 3, sd), jag = T.fbm(u, v, laths ? 26 : 18, 2, sd + 1);
    const r = (0.4 + 0.06 * k / 3) * (0.45 + 1.1 * lobe) + 0.08 * (jag - 0.5), n = T.fbm(u, v, 6, 3, sd + 2);
    o.r = 1; o.h = 0.5; o.a = 0; o.c = [0.04, 0.035, 0.03];
    if (d < r - 0.06) {   // the hole: dark, the battens (roof) or laths (wall) across it
      const pitch = laths ? 7.5 : 11, q = Math.abs(((v * pitch + k * 0.37) % 1) - 0.5), bar = T.smooth(0.2, 0.12, q) * (laths ? 1 : 0.8);
      const broke = T.fbm(u, v, 9, 2, sd + 3) < (laths ? 0.25 : 0.35);   // (one burnt through here and there)
      const wood = [0.3 * (0.6 + 0.4 * n), 0.19 * (0.6 + 0.4 * n), 0.1];   // (charred on top, still wood: they must read in the dark)
      o.c = T.mixc([0.025, 0.02, 0.018], wood, broke ? 0 : bar); o.h = 0.05 + (broke ? 0 : bar * 0.6); o.a = 1;
    } else if (d < r) {   // the rim: broken tile ends (fired clay) or the plaster's broken edge, uneven
      const t = (r - d) / 0.06, chip = T.fbm(u, v, 40, 2, sd + 4);
      o.c = laths ? T.mixc([0.4, 0.33, 0.27], [0.2, 0.15, 0.12], chip) : T.mixc([0.74, 0.7, 0.62], [0.45, 0.41, 0.36], chip);
      o.c = T.mixc(o.c, [0.06, 0.05, 0.04], T.smooth(0.55, 1, t) * 0.7); o.h = 0.75 - t * 0.3; o.a = 1;
    } else {   // round it: soot, thin and patchy, and a crack or two running on
      const soot = T.smooth(r + (laths ? 0.16 : 0.22), r, d) * T.smooth(0.35, 0.7, T.fbm(u, v, 7, 3, sd + 5));
      let crack = 0;
      for (let c = 0; c < 2 + (k & 1); c++) {
        const ca = (T.fbm(c * 0.31 + 0.1, k * 0.23 + 0.2, 1, 1, sd + 6) * 2 - 0.5) * 6.28, cl = r + 0.12 + 0.18 * T.fbm(c * 0.7, 0.3, 1, 1, sd + 7);
        const along = x * Math.cos(ca) + y * Math.sin(ca), side = -x * Math.sin(ca) + y * Math.cos(ca) + 0.03 * (T.fbm(u, v, 22, 2, sd + 8 + c) - 0.5);
        if (along * 2 > r * 0.8 && along * 2 < cl) crack = Math.max(crack, T.smooth(0.006, 0.0015, Math.abs(side)) * T.smooth(cl, cl - 0.1, along * 2));
      }
      o.c = [0.05, 0.045, 0.04]; o.a = Math.max(soot * 0.55, crack * 0.85); o.h = 0.5 - crack * 0.3;
    }
    if (u < 0.02 || u > 0.98 || v < 0.02 || v > 0.98) o.a = 0;   // (nothing bleeds into the next cell)
  }, 3);
}
// soot up a wall from a break: a plume widening as it rises, thinning to nothing (v up)
function sootTex() {
  return T.pbr('warSoot', 64, (u, v, o) => {
    const w = 0.3 + 0.55 * v, x = Math.abs((u - 0.5) * 2 + (T.fbm(u, v, 3, 3, 641) - 0.5) * 0.5 * v);
    o.c = [0.05, 0.045, 0.04]; o.r = 1; o.h = 0.5;
    o.a = T.smooth(w, w * 0.35, x) * Math.pow(1 - v, 0.8) * T.smooth(0, 0.1, v) * 0.8 * (0.6 + 0.4 * T.fbm(u, v, 6, 3, 642));
  }, 1);
}
// scorched ground: charcoal at the heart under grey ash, browned at its ragged edge
function scorchTex() {
  return T.pbr('warScorch', 128, (u, v, o) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2, n = T.fbm(u, v, 4, 4, 621), edge = 0.62 + 0.36 * (n - 0.5), k = T.smooth(edge + 0.1, edge - 0.3, d);
    const ash = T.smooth(0.58, 0.74, T.fbm(u, v, 14, 3, 622));
    o.c = T.mixc([0.24, 0.16, 0.08], [0.05, 0.045, 0.04], T.smooth(0.15, 0.8, k)); o.c = T.mixc(o.c, [0.42, 0.4, 0.37], ash * k * 0.55);
    o.a = k * (0.8 + 0.2 * T.fbm(u, v, 8, 3, 623)); o.h = 0.5 + ash * 0.2 * k; o.r = 0.95;
  }, 2);
}
// a shell-hole: a dark pit, a rim of churned earth thrown up round it, clods sprayed past the rim
function craterTex() {
  return T.pbr('warCrater', 128, (u, v, o) => {
    const clod = T.fbm(u, v, 20, 3, 632), d = Math.hypot(u - 0.5, v - 0.5) * 2 * (0.9 + 0.2 * T.fbm(u, v, 4, 3, 631));
    const pit = T.smooth(0.44, 0.18, d), ring = T.smooth(0.28, 0.5, d) * T.smooth(0.86, 0.6, d), spray = T.smooth(1.0, 0.72, d) * T.smooth(0.55, 0.72, clod);
    o.c = T.mixc([0.44, 0.36, 0.25], [0.6, 0.52, 0.38], clod); o.c = T.mixc(o.c, [0.08, 0.065, 0.05], pit * 0.92);
    o.h = 0.5 - pit * 0.45 + ring * 0.4 * (0.6 + 0.4 * clod); o.r = 0.95;
    o.a = Math.min(1, Math.max(pit, ring * 0.95, spray * 0.85));
  }, 5);
}
const mat = t => T.material(t, { transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });

// ---------------------------------------------------------------- projecting a mark onto faces
const clip = (poly, ax, s) => { const out = [];   // keep s * p[ax] <= 0.5
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = 0.5 - s * a[ax], db = 0.5 - s * b[ax];
    if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push(a.map((q, k) => q + (b[k] - q) * t)); } }
  return out; };
// the faces of `meshes` inside the box at pos (z along n, y as near world up as it can be, turned by spin), w across and
// depth deep, as triangles in world space with uvs over the box: pushed into out.P, out.U
export function project(meshes, pos, n, w, depth, spin, out, cell) {   // cell: [u0, v0, size] of the texture (default all of it)
  const [c0, c1, cs] = cell || [0, 0, 1];
  const z = n.clone().normalize(), up = Math.abs(z.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  x.applyAxisAngle(z, spin); y.applyAxisAngle(z, spin);
  const M = new THREE.Matrix4().makeBasis(x.clone().multiplyScalar(w), y.clone().multiplyScalar(w), z.clone().multiplyScalar(depth)).setPosition(pos), inv = M.clone().invert();
  const reach = new THREE.Sphere(pos, Math.hypot(w, w, depth)), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), q = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere.clone().applyMatrix4(m.matrixWorld).intersectsSphere(reach)) continue;
    const p = g.attributes.position, idx = g.index, cnt = idx ? idx.count : p.count, two = m.material.side === THREE.DoubleSide;
    for (let i = 0; i + 2 < cnt; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld);
      fn.crossVectors(e1.subVectors(v[1], v[0]), e2.subVectors(v[2], v[0])).normalize();
      const dot = fn.dot(z); if (!(dot > 0.3 || (two && dot < -0.3))) continue;   // (faces turned away or edge-on: not marked)
      let poly = v.map(a => { q.copy(a).applyMatrix4(inv); return [q.x, q.y, q.z]; });
      for (const [ax, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) { poly = clip(poly, ax, s); if (poly.length < 3) break; }
      if (poly.length < 3) continue;
      const W = poly.map(a => new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(M).addScaledVector(fn, dot > 0 ? 0.005 : -0.005));
      for (let k = 1; k + 1 < poly.length; k++) for (const j of [0, k, k + 1]) { out.P.push(W[j].x, W[j].y, W[j].z); out.U.push(c0 + (poly[j][0] + 0.5) * cs, c1 + (poly[j][1] + 0.5) * cs); }
    }
  }
}
const meshOf = (m, o) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.U, 2)); g.computeVertexNormals();
  const me = new THREE.Mesh(g, m); me.receiveShadow = true; me.renderOrder = 1; return me; };

// ---------------------------------------------------------------- a battered town
// buildings: [{ group, roof: breaks in the roof, front: breaks in the south face, fall: 'tiles' | 'straw' | 'boards', col }]
// (the group's footprint from its box; the camera looks from the south); ground: { at(x, z), spots: [[x, z, size, 'scorch' |
// 'crater']], free(x, z): where debris may lie }; seed. Returns the roof breaks' points (for smoke) and adds everything
// to the scene.
export function batter(S, buildings, ground, seed = 0) {
  const out = { roof: { P: [], U: [] }, wall: { P: [], U: [] }, soot: { P: [], U: [] }, scorch: { P: [], U: [] }, crater: { P: [], U: [] } }, smokes = [];
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), north = new THREE.Vector3(0, 0, -1), fall = [], rafters = [];
  buildings.forEach((b, bi) => {
    b.group.updateMatrixWorld(true);
    const meshes = []; b.group.traverse(m => { if (m.isMesh && m.visible) meshes.push(m); });
    const bb = new THREE.Box3().setFromObject(b.group), s0 = seed * 97 + bi * 31;
    // the roof: rays straight down onto faces looking up (a slope, never the eave's underside)
    for (let i = 0, tries = 0; i < (b.roof || 0) && tries < 40; tries++) {
      const px = bb.min.x + 0.35 + H(s0 + tries * 3.1) * (bb.max.x - bb.min.x - 0.7), pz = bb.min.z + 0.35 + H(s0 + tries * 5.7 + 1) * (bb.max.z - bb.min.z - 0.7);
      ray.set(new THREE.Vector3(px, bb.max.y + 1, pz), down); const hit = ray.intersectObjects(meshes, false)[0]; if (!hit) continue;
      const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if (nrm.y < 0) nrm.negate(); if (nrm.y < 0.3 || hit.point.y > bb.max.y - 0.25) continue;   // (a slope, not the ridge)
      const w = 0.95 + H(s0 + tries * 7.3 + 2) * 0.6, vk = Math.floor(H(s0 + tries * 9.1 + 4) * BREAKS); project(meshes, hit.point, nrm, w, 0.5, 0, out.roof, [(vk & 1) * 0.5, (vk >> 1) * 0.5, 0.5]); i++;   // (unturned: the hole runs down the slope, the battens along the ridge, as the roof's own)
      for (let k = 0; k < (H(s0 + tries * 8.7) < 0.6 ? 1 : 0); k++) {   // a charred rafter left across most holes, one end tipped up out of it
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm), a = H(s0 + tries * 3.9 + k * 7) * 6.28, len = w * (0.35 + H(s0 + tries + k * 3) * 0.25);
        const along = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q), at = hit.point.clone().addScaledVector(nrm, 0.02 + k * 0.025).addScaledVector(along, (H(s0 + k + tries * 2.2) - 0.5) * w * 0.25);
        rafters.push({ at, along, nrm, len, tilt: H(s0 + tries * 1.3 + k) * 0.25 });
      }
      if (i <= 1) smokes.push([hit.point.x, hit.point.y, hit.point.z]);
    }
    // the front: rays from the south onto faces looking south, below the eaves; soot rising from every other one
    for (let i = 0, tries = 0; i < (b.front || 0) && tries < 40; tries++) {
      const px = bb.min.x + 0.3 + H(s0 + tries * 2.3 + 9) * (bb.max.x - bb.min.x - 0.6), py = bb.min.y + 0.25 + H(s0 + tries * 4.1 + 11) * (bb.max.y - bb.min.y - 0.6);
      ray.set(new THREE.Vector3(px, py, bb.max.z + 1), north); const hit = ray.intersectObjects(meshes, false)[0]; if (!hit) continue;
      const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if (nrm.z < 0) nrm.negate(); if (nrm.z < 0.6) continue;
      const w = 0.42 + H(s0 + tries * 6.1 + 3) * 0.36, vk = Math.floor(H(s0 + tries * 9.7 + 6) * BREAKS); project(meshes, hit.point, nrm, w, 0.3, (H(s0 + tries + 5) - 0.5) * 0.6, out.wall, [(vk & 1) * 0.5, (vk >> 1) * 0.5, 0.5]);   // (the laths level, near enough)
      if (i % 2 === 0) project(meshes, hit.point.clone().add(new THREE.Vector3(0, w * 0.9, 0)), nrm, w * 1.6, 0.3, 0, out.soot);
      i++;
    }
    // what fell: at its feet, mostly to the south (the side the camera sees), never on a wall's or a building's cells
    for (let i = 0; i < (b.debris ?? 24); i++) {
      const side = H(s0 + i * 1.7 + 21), t = H(s0 + i * 2.9 + 23), off = 0.06 + Math.pow(H(s0 + i * 3.7 + 25), 1.6) * 0.75;
      const x = side < 0.65 ? bb.min.x + t * (bb.max.x - bb.min.x) : side < 0.82 ? bb.min.x - off : bb.max.x + off;
      const z = side < 0.65 ? bb.max.z + off : bb.min.z + 0.3 + t * (bb.max.z - bb.min.z - 0.3);
      if (!ground.free(x, z)) continue;
      fall.push({ kind: H(s0 + i * 4.3 + 27) < 0.15 ? 'boards' : b.fall, col: b.col, x, z, a: H(s0 + i * 5.3 + 29) * 6.28 });
    }
  });
  // the ground: scorch and shell-holes, draped over it
  for (const [x, z, size, kind] of ground.spots) {
    const N = 8, sp = H(x * 13 + z * 7) * 6.28, c = Math.cos(sp), s = Math.sin(sp), o = out[kind], pt = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const u = i / N, v = j / N, lx = (u - 0.5) * size, lz = (v - 0.5) * size, wx = x + lx * c - lz * s, wz = z + lx * s + lz * c; pt.push([wx, ground.at(wx, wz) + 0.012, wz, u, v]); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1; for (const k of [a, d, b, b, d, e]) { o.P.push(pt[k][0], pt[k][1], pt[k][2]); o.U.push(pt[k][3], pt[k][4]); } }
  }
  const tex = { roof: breakTex(true), wall: breakTex(false), soot: sootTex(), scorch: scorchTex(), crater: craterTex() };
  for (const k of Object.keys(out)) if (out[k].P.length) { const me = meshOf(mat(tex[k]), out[k]); me.name = 'war:' + k; S.add(me); }   // (named: tools/qa/sets.js finds them)
  // the debris, one instanced mesh a kind: roof tiles (in the roof's colour), straw, charred boards; flat on the ground
  const KIND = { tiles: [0.13, 0.018, 0.085], straw: [0.2, 0.012, 0.025], boards: [0.46, 0.03, 0.075] };
  const groups = new Map(); for (const f of fall) { const key = f.kind + (f.kind === 'tiles' ? f.col : ''); (groups.get(key) || groups.set(key, []).get(key)).push(f); }
  const dummy = new THREE.Object3D();
  for (const [key, list] of groups) {
    const kind = list[0].kind, [sx, sy, sz] = KIND[kind], col = kind === 'tiles' ? list[0].col : kind === 'straw' ? 0xb8963a : 0x3a2414;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color: col, roughness: kind === 'tiles' ? 0.55 : 0.95 }), list.length);
    list.forEach((f, i) => { dummy.position.set(f.x, ground.at(f.x, f.z) + sy / 2 + 0.004, f.z); dummy.rotation.set((H(i * 3.3 + key.length) - 0.5) * 0.2, f.a, (H(i * 1.9) - 0.5) * 0.2);
      const k = 0.7 + H(i * 2.1 + 7) * 0.6; dummy.scale.set(k, 1, k); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.name = 'war:debris'; im.castShadow = false; im.receiveShadow = true; S.add(im);
  }
  if (rafters.length) {   // the rafters: charred square battens, one end tipped up out of the hole
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 1), new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 0.95 }), rafters.length), m = new THREE.Matrix4(), q = new THREE.Quaternion();
    rafters.forEach((r, i) => { const dir = r.along.clone().addScaledVector(r.nrm, r.tilt).normalize(); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      m.compose(r.at.clone().addScaledVector(r.nrm, Math.max(0, r.tilt) * r.len * 0.5), q, new THREE.Vector3(1, 1, r.len)); im.setMatrixAt(i, m); });
    im.name = 'war:rafters'; im.castShadow = true; im.receiveShadow = true; S.add(im);
  }
  return { smokes };
}
