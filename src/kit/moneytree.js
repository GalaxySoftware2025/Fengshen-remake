// 搖錢樹, the money tree 楊戩 brings 費仲 and 尤渾 (sheet 087306 in scenes 7, 9 and 12), as a model: a bronze basin on
// its foot, a gnarled trunk, clumps of green leaves, and what it bears: gold coins and ingots, pearls, agate and other
// gems, which bud, swell and glitter. [design, the user's call: plain green when it is set down (scene 7 f493), from
// f609 it starts to bear gold, gems and jewels that shine, not still colours] The original's sprite is a green tree with
// gold twinkles; the script has it flower (its line at f700) and fruit as the petals drop (the line at f812).
//   moneyTree() -> { g, pose(E, x, y, z, state) }: state { fruit 0..1, bloom 0..1, snap } eased per call (snap: jump there)
//   treeState(tag, t): what the scene's script has it bear at frame t
import * as THREE from 'three';

// a polyhedron's faces joined at shared corners (indexed), so its normals come out smooth
function weld(geo) {
  const p = geo.attributes.position, seen = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e4)).join();
    if (!seen.has(k)) { seen.set(k, pos.length / 3); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    idx.push(seen.get(k));
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
const R = (a, b, s) => { const x = Math.sin(s * 127.1) * 43758.5453; return a + (x - Math.floor(x)) * (b - a); };
// the scene's schedule: scene 7 waters it (f493) and watches it bud (from f609), flower (f700) and fruit (f812); scene
// 9's is the second tree, not yet watered; in scene 12 尤渾's has fruited
export function treeState(tag, t) {
  if (tag === '12') return { fruit: 1, bloom: 0 };
  if (tag !== '07') return { fruit: 0, bloom: 0 };
  if (t < 609) return { fruit: 0, bloom: 0 };
  if (t < 700) return { fruit: 0.35, bloom: 0, slow: true };   // budding all through 楊戩's talk (the clock is held on his lines)
  if (t < 812) return { fruit: 0.45, bloom: 1 };
  return { fruit: 1, bloom: 0 };
}

export function moneyTree() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a6a30, metalness: 0.75, roughness: 0.35 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.25 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
  const leafA = new THREE.MeshStandardMaterial({ color: 0x2f7a26, roughness: 0.75 });
  const leafB = new THREE.MeshStandardMaterial({ color: 0x4aa036, roughness: 0.7 });
  const shade = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  // the basin on its foot, a gilt rim, the soil
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.14, 0.03], [0.1, 0.06], [0.12, 0.08], [0.24, 0.14], [0.27, 0.2], [0.27, 0.22], [0, 0.22]].map(([a, b]) => new THREE.Vector2(a, b)), 32), bronze);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.018, 8, 40).rotateX(Math.PI / 2), rim); lip.position.y = 0.22;
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32).rotateX(-Math.PI / 2), soil); dirt.position.y = 0.205;
  g.add(shade(pot), shade(lip), dirt);
  // the trunk: a few bends up to where it forks, and its branches out to the leaf clumps
  const limb = (a, b, r0, r1) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 7), bark); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(shade(m)); };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const trunk = [P(0, 0.2, 0), P(0.03, 0.32, 0.01), P(-0.02, 0.44, 0), P(0.01, 0.54, 0)];
  for (let i = 0; i + 1 < trunk.length; i++) limb(trunk[i], trunk[i + 1], 0.055 - i * 0.008, 0.047 - i * 0.008);
  // the crown: clumps of leaves (jittered balls, two greens), each on a branch from the fork
  const clumps = [];
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, up = k < 6 ? 0.6 + R(0, 0.12, k) : 0.82 + R(0, 0.1, k), out = k < 6 ? 0.2 + R(0, 0.06, k + 3) : 0.08;
    const c = P(Math.cos(a) * out, up, Math.sin(a) * out * 0.8), r = k < 6 ? 0.15 + R(0, 0.04, k + 7) : 0.16;
    clumps.push({ c, r }); limb(trunk[3], c.clone().multiplyScalar(0.8).setY(c.y - 0.05), 0.03, 0.016);
    for (let j = 0; j < 4; j++) {   // each clump a cloud of smaller, smooth lobes
      const lr = r * (j ? 0.62 : 0.78), off = j ? P(Math.cos(j * 2.1 + k) * r * 0.45, R(-0.2, 0.35, j + k * 5) * r, Math.sin(j * 2.1 + k) * r * 0.4) : P(0, 0, 0);
      const geo = weld(new THREE.IcosahedronGeometry(lr, 3)), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = 1 + 0.08 * Math.sin(v.x * 61 + k) * Math.sin(v.y * 53 + j) * Math.sin(v.z * 47); p.setXYZ(i, v.x * n, v.y * n * 0.85, v.z * n); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, (k + j) % 2 ? leafA : leafB); m.position.copy(c).add(off); g.add(shade(m));
    }
  }
  // what it bears, on the clumps' outer faces: coins, ingots, pearls, agates, sapphires, rubies (scale 0 until it fruits)
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.18, emissive: 0x1a1000, envMapIntensity: 1.4 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 1, sheenColor: new THREE.Color(1, 0.85, 0.9), emissive: 0x1a1612 });
  const gem = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0, emissive: new THREE.Color(c).multiplyScalar(0.25), flatShading: true });
  const agate = gem(0xe0401a), ruby = gem(0xd0102a), sapph = gem(0x2a5ae0);
  const coinGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.014, 24), ingotGeo = new THREE.SphereGeometry(0.05, 16, 10), pearlGeo = new THREE.SphereGeometry(0.038, 16, 12), gemGeo = new THREE.OctahedronGeometry(0.05, 0);
  const KINDS = [[coinGeo, gold], [pearlGeo, pearl], [gemGeo, agate], [ingotGeo, gold], [coinGeo, gold], [gemGeo, sapph], [pearlGeo, pearl], [ingotGeo, gold], [gemGeo, ruby], [coinGeo, gold]];
  const fruit = [];
  for (let i = 0; i < 52; i++) {
    const cl = clumps[i % clumps.length], th = R(0, 6.28, i * 1.7), ph = R(0.25, 1.35, i * 2.3);
    const n = P(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.9, Math.sin(ph) * Math.sin(th)).normalize();
    if (n.z < -0.3 && i % 3) n.z = -n.z;   // most on the side the camera sees
    const [geo, mat] = KINDS[i % KINDS.length], m = new THREE.Mesh(geo, mat);
    m.position.copy(cl.c).addScaledVector(n, cl.r * 1.12);
    if (geo === coinGeo) m.quaternion.setFromUnitVectors(P(0, 1, 0), n); else if (geo === ingotGeo) m.scale.set(1.5, 0.7, 0.9);
    m.userData = { base: m.scale.clone(), at: R(0, 0.6, i * 5.3) };   // when it buds, in the growth's 0..1
    m.scale.setScalar(0.0001); m.castShadow = true; g.add(m); fruit.push(m);
  }
  // the blossoms: little five-petalled white-pink flowers over the crown, falling as petals when it fruits
  const petalM = new THREE.MeshStandardMaterial({ color: 0xffe0ea, roughness: 0.6, emissive: 0x3a1a20, side: THREE.DoubleSide });
  const flowerGeo = (() => { const s = new THREE.Shape(); for (let k = 0; k <= 60; k++) { const a = k / 60 * Math.PI * 2, r = 0.03 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s); })();
  const flowers = [];
  for (let i = 0; i < 40; i++) {
    const cl = clumps[i % clumps.length], th = R(0, 6.28, i * 3.9), ph = R(0.1, 1.4, i * 4.7);
    const n = P(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).normalize();
    const m = new THREE.Mesh(flowerGeo, petalM); m.position.copy(cl.c).addScaledVector(n, cl.r * 1.02); m.lookAt(m.position.clone().add(n));
    m.userData = { home: m.position.clone(), at: R(0, 0.5, i * 7.1), v: P(R(-0.2, 0.2, i), 0, R(0.05, 0.3, i + 9)) };
    m.scale.setScalar(0.0001); g.add(m); flowers.push(m);
  }
  const glow = new THREE.PointLight(0xffc860, 0, 2.2, 2); glow.position.set(0, 0.8, 0.35); g.add(glow);
  const cur = { fruit: 0, bloom: 0, fall: 0, sparkle: 0 }, ease = (a, b, r) => a + (b - a) * Math.min(1, r);
  let last = performance.now();

  function pose(E, x, y, z, st) {
    g.position.set(x, y, z); g.visible = true;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const wasBloom = cur.bloom;
    if (st.snap) { cur.fruit = st.fruit; cur.bloom = st.bloom; cur.fall = 0; }
    else {
      cur.fruit = cur.fruit < st.fruit ? Math.min(st.fruit, cur.fruit + dt * (st.slow ? 0.05 : 0.45)) : st.fruit;   // slow budding through the talk, quick swelling when it fruits
      cur.bloom = st.bloom > cur.bloom ? Math.min(st.bloom, cur.bloom + dt * 0.8) : st.bloom;
      if (wasBloom > 0.5 && st.bloom === 0) cur.fall = 1e-4;   // the blossoms drop as it fruits
    }
    for (const m of fruit) { const k = THREE.MathUtils.clamp((cur.fruit - m.userData.at * 0.35) / 0.5, 0, 1), e = k * k * (3 - 2 * k); m.scale.copy(m.userData.base).multiplyScalar(Math.max(1e-4, e)); m.rotation.y += dt * 0.6; }
    if (cur.fall > 0) cur.fall += dt;
    for (const m of flowers) {
      const u = m.userData;
      if (cur.fall > 0) {   // falling: tumbling down past the basin, fading
        const tt = cur.fall; m.position.set(u.home.x + u.v.x * tt + Math.sin(tt * 6 + u.at * 9) * 0.04, Math.max(0.21, u.home.y - tt * tt * 0.9 - tt * 0.15), u.home.z + u.v.z * tt);
        m.rotation.x += dt * 5; m.rotation.z += dt * 3; m.scale.setScalar(Math.max(1e-4, 1 - tt / 1.6));
      } else { const k = THREE.MathUtils.clamp((cur.bloom - u.at) / 0.4, 0, 1); m.position.copy(u.home); m.scale.setScalar(Math.max(1e-4, k)); }
    }
    if (cur.fall > 1.7) { cur.fall = 0; for (const m of flowers) m.scale.setScalar(1e-4); }
    glow.intensity = 0.5 * cur.fruit;
    // glints: a star on a random jewel now and then, more as it fills
    cur.sparkle += dt * (1 + 7 * cur.fruit);
    while (cur.fruit > 0.05 && cur.sparkle > 1) {
      cur.sparkle -= 1;
      const m = fruit[Math.floor(Math.random() * fruit.length)]; if (m.scale.x < 0.3 * m.userData.base.x) continue;
      const w = m.getWorldPosition(new THREE.Vector3());
      E.vfx.spark(w.x, w.y + 0.02, w.z + 0.04, { vx: 0, vy: 0.05, vz: 0, life: 0.3 + Math.random() * 0.2, size: 0.035 + Math.random() * 0.03, r: 1, gg: 0.95, b: 0.8, g: 0, shape: 1, flicker: 1, ph: Math.random() * 9 });
    }
  }
  return { g, pose };
}
