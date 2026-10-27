// War's marks over a built set (孟津 after the fighting: battle 29 and scene 60). The original draws dark star-shaped breaks
// all over its roofs, walls, doors and windows (map 0fc438); here they are projected onto the buildings' own faces (project:
// the faces' triangles clipped to a box, so a break follows a roof's sag and stops at its edge), soot rising over some of
// those in the walls, and the ground scorched and holed, with what fell from the roofs at the buildings' feet [the user's
// call: the floors too, which the original leaves whole]. Nothing here changes the ground's height: units stand where they
// stood, and every piece on open ground is flat (a decal, or debris a few hundredths high).
import * as THREE from 'three';
import * as T from './tex.js';

const H = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- the marks (alpha: clear where nothing is marked)
// a break, as the original draws it: a star of six ragged points, black inside, its edge splintered and charred, soot round
// it; laths: the charred battens seen through a roof's hole
function breakTex(laths) {
  return T.pbr(laths ? 'warRoofBreak' : 'warWallBreak', 128, (u, v, o) => {
    const x = u - 0.5, y = v - 0.5, d = Math.hypot(x, y) * 2, a = Math.atan2(y, x), n = T.fbm(u, v, 6, 3, laths ? 611 : 612);
    const r = 0.34 + 0.24 * Math.pow(Math.abs(Math.cos(3 * a + (n - 0.5) * 1.4)), 3) + 0.1 * (n - 0.5);
    o.r = 1; o.c = [0.04, 0.03, 0.025]; o.h = 0.05; o.a = 1;
    if (d < r * 0.7) {
      const lath = laths ? T.smooth(0.1, 0.05, Math.abs(((u * 4.5 + 0.3) % 1) - 0.5)) : 0;
      if (lath > 0) { o.c = T.mixc(o.c, [0.22 * (0.6 + 0.4 * n), 0.13 * (0.6 + 0.4 * n), 0.07], lath); o.h = 0.05 + lath * 0.7; }
    } else if (d < r) {
      o.c = T.mixc([0.26, 0.16, 0.08], [0.07, 0.05, 0.03], T.fbm(u, v, 24, 2, 613)); o.h = 0.9;
    } else if (d < r + 0.32) {
      const s = 1 - (d - r) / 0.32; o.c = [0.05, 0.045, 0.04]; o.h = 0.5; o.a = Math.pow(s, 1.6) * 0.8 * (0.55 + 0.45 * T.fbm(u, v, 10, 3, 614));
    } else { o.a = 0; o.h = 0.5; }
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
export function project(meshes, pos, n, w, depth, spin, out) {
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
      for (let k = 1; k + 1 < poly.length; k++) for (const j of [0, k, k + 1]) { out.P.push(W[j].x, W[j].y, W[j].z); out.U.push(poly[j][0] + 0.5, poly[j][1] + 0.5); }
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
      const w = 0.62 + H(s0 + tries * 7.3 + 2) * 0.5; project(meshes, hit.point, nrm, w, 0.5, H(s0 + tries) * 6.28, out.roof); i++;
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
      const w = 0.42 + H(s0 + tries * 6.1 + 3) * 0.36; project(meshes, hit.point, nrm, w, 0.3, H(s0 + tries + 5) * 6.28, out.wall);
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
