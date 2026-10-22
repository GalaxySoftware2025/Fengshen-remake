// Rays straight down through a set's solid pieces, fast: what stands on a cell (battle.js cellInfo, surfaceY). three.js's
// Raycaster tests a ray against every triangle of every mesh it is given, so the first move range of a battle, whose
// squares look under each cell in range and in the enemies' reach at five points, spent 1.7 s in raycasts in one frame
// (battle 1; the user's report: a lag every battle after its name shows). Here every triangle of each mesh is laid into
// the map cells its footprint covers; a vertical ray then tests only the few triangles of its own cell. Same answers as
// the Raycaster (checked on every cell of every battle: battle.js downCheck): the triangles a ray from above would hit
// (a FrontSide face only when turned up, a BackSide face only when turned down), sorted from the top, each with its mesh
// and material. Each mesh's part is made again when the mesh has moved or its instances or vertices changed since (the
// canes battle 13's fire chars, a gate that opens): checked on use, so the index never goes stale.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _i = new THREE.Matrix4();
// what the mesh's triangles depend on: its place in the world, its instances, its vertices
const stamp = mesh => { const e = mesh.matrixWorld.elements, g = mesh.geometry;
  return e[0] + e[1] * 3 + e[2] * 5 + e[5] * 7 + e[10] * 11 + e[12] * 13 + e[13] * 17 + e[14] * 19 + (mesh.isInstancedMesh ? mesh.count * 23 + mesh.instanceMatrix.version * 29 : 0) + (g && g.attributes.position ? g.attributes.position.version * 31 : 0) + (mesh.visible ? 0 : 37); };
// one mesh's triangles into cell buckets over the area
function part(mesh, X0, Z0, X1, Z1) {
  const W = X1 - X0 + 1, buckets = new Map(), tris = [], mats = [];
  const g = mesh.geometry, pos = g && g.attributes && g.attributes.position;
  if (pos && mesh.visible) {
    const idx = g.index, n = idx ? idx.count : pos.count, groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
    const ml = [].concat(mesh.material), drawn = g.drawRange || { start: 0, count: Infinity }, inst = mesh.isInstancedMesh ? mesh.count : 1, ix = idx && idx.array;
    const raw = pos.isInterleavedBufferAttribute ? pos.data.array : pos.array, fast = raw instanceof Float32Array && !pos.normalized;   // (else read through the attribute)
    const P = raw, st = pos.isInterleavedBufferAttribute ? pos.data.stride : pos.itemSize, off = pos.offset || 0, nv = pos.count, Wv = new Float64Array(nv * 3);
    for (let k = 0; k < inst; k++) {
      _m.copy(mesh.matrixWorld); if (mesh.isInstancedMesh) { mesh.getMatrixAt(k, _i); _m.multiply(_i); }
      const flip = _m.determinant() < 0, e = _m.elements;   // (a mirrored instance turns its faces round)
      for (let v = 0; v < nv; v++) {   // every vertex into the world once (not once per triangle that shares it)
        const o = v * st + off, x = fast ? P[o] : pos.getX(v), y = fast ? P[o + 1] : pos.getY(v), z = fast ? P[o + 2] : pos.getZ(v);
        Wv[v * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; Wv[v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; Wv[v * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      for (const gr of groups) {
        const mat = ml[gr.materialIndex] || ml[0], side = mat ? mat.side : THREE.FrontSide;
        const s = Math.max(gr.start, drawn.start), e2 = Math.min(gr.start + gr.count, drawn.start + drawn.count, n);
        for (let t = s; t + 2 < e2; t += 3) {
          const a = (idx ? ix[t] : t) * 3, b = (idx ? ix[t + 1] : t + 1) * 3, c = (idx ? ix[t + 2] : t + 2) * 3;
          const ax = Wv[a], ay = Wv[a + 1], az = Wv[a + 2], bx = Wv[b], by = Wv[b + 1], bz = Wv[b + 2], cx = Wv[c], cy = Wv[c + 1], cz = Wv[c + 2];
          const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);   // the face normal's y (its XZ area, signed)
          if (Math.abs(ny) < 1e-9) continue;   // (edge on to a vertical ray)
          const up = (ny > 0) !== flip;
          if ((side === THREE.FrontSide && !up) || (side === THREE.BackSide && up)) continue;   // a ray from above hits a front face turned up, a back face turned down
          const x0 = Math.max(X0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(X1, Math.floor(Math.max(ax, bx, cx)));
          const z0 = Math.max(Z0, Math.floor(Math.min(az, bz, cz))), z1 = Math.min(Z1, Math.floor(Math.max(az, bz, cz)));
          if (x0 > x1 || z0 > z1) continue;
          const ti = mats.length; tris.push(ax, ay, az, bx, by, bz, cx, cy, cz); mats.push(gr.materialIndex);
          for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const key = (z - Z0) * W + (x - X0); let bk = buckets.get(key); if (!bk) buckets.set(key, bk = []); bk.push(ti); }
        }
      }
    }
  }
  return { mesh, stamp: stamp(mesh), buckets, T: new Float64Array(tris), mats };
}
// meshes: the solid pieces; area: [x0, z0, x1, z1] in world units (the map and a margin round it)
export function downIndex(meshes, area) {
  const [X0, Z0, X1, Z1] = area.map(Math.floor), W = X1 - X0 + 1;
  for (const m of meshes) m.updateWorldMatrix(true, false);
  const parts = meshes.map(m => part(m, X0, Z0, X1, Z1));
  return {
    get count() { return parts.reduce((s, p) => s + p.mats.length, 0); },
    // the hits of a ray down at (x, z) from height top: [{ y, object, material, face: { materialIndex } }], the highest first
    cast(x, z, top) {
      const bx = Math.floor(x), bz = Math.floor(z); if (bx < X0 || bx > X1 || bz < Z0 || bz > Z1) return [];
      const key = (bz - Z0) * W + (bx - X0), out = [];
      for (let pi = 0; pi < parts.length; pi++) {
        let p = parts[pi]; if (stamp(p.mesh) !== p.stamp) { p.mesh.updateWorldMatrix(true, false); parts[pi] = p = part(p.mesh, X0, Z0, X1, Z1); }   // (it changed: made again)
        const b = p.buckets.get(key); if (!b) continue; const T = p.T;
        for (const ti of b) {
          const o = ti * 9, ax = T[o], az = T[o + 2], bxx = T[o + 3], bzz = T[o + 5], cx = T[o + 6], cz = T[o + 8];
          const d = (bzz - cz) * (ax - cx) + (cx - bxx) * (az - cz); if (d === 0) continue;
          const l1 = ((bzz - cz) * (x - cx) + (cx - bxx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
          if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
          const y = l1 * T[o + 1] + l2 * T[o + 4] + l3 * T[o + 7]; if (y > top) continue;
          const ml = [].concat(p.mesh.material), mi = p.mats[ti];
          out.push({ y, object: p.mesh, material: ml[mi] || ml[0], face: { materialIndex: mi } });
        }
      }
      return out.sort((p, q) => q.y - p.y);
    },
  };
}
