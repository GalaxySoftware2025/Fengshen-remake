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

// a leaf: veined, darker at the rib, a thin gold rim (it is a treasure tree)
function leafTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(32, 94); g.bezierCurveTo(4, 70, 6, 24, 32, 2); g.bezierCurveTo(58, 24, 60, 70, 32, 94); g.closePath(); };
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#bcbcbc');
  g.fillStyle = gr; path(); g.fill();
  g.strokeStyle = '#e8c060'; g.lineWidth = 3; path(); g.stroke();
  g.strokeStyle = 'rgba(70,90,40,0.55)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(32, 92); g.lineTo(32, 8); g.stroke();
  g.lineWidth = 1.2; for (let y = 22; y < 84; y += 11) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(32, y + 8); g.quadraticCurveTo(32 + s * 10, y + 2, 32 + s * 20, y - 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// a four-pointed star with a soft halo, for the glints
function glintTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const h = g.createRadialGradient(64, 64, 0, 64, 64, 40); h.addColorStop(0, 'rgba(255,255,255,1)'); h.addColorStop(0.25, 'rgba(255,240,200,0.6)'); h.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = h; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; for (const [w, l] of [[5, 62], [3, 40]]) for (let r = 0; r < (l > 50 ? 2 : 2); r++) { g.save(); g.translate(64, 64); g.rotate(r * Math.PI / 2 + (l > 50 ? 0 : Math.PI / 4)); g.beginPath(); g.moveTo(0, -l); g.quadraticCurveTo(w, 0, 0, l); g.quadraticCurveTo(-w, 0, 0, -l); g.fill(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a round coin with a square hole and a raised rim, standing upright (faces ±z)
function coinGeometry(r) {
  const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2);
  const h = r * 0.32, hole = new THREE.Path(); hole.moveTo(-h, -h); hole.lineTo(-h, h); hole.lineTo(h, h); hole.lineTo(h, -h); hole.lineTo(-h, -h); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: r * 0.14, bevelEnabled: true, bevelThickness: r * 0.06, bevelSize: r * 0.05, bevelSegments: 2, curveSegments: 28 });
  return geo.translate(0, 0, -r * 0.07);
}
// 元寶: a boat-shaped ingot whose brims curl up at both ends, a dome rising from its middle (long axis x)
function ingotGeometry(r) {
  const base = new THREE.SphereGeometry(r, 28, 16), p = base.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const u = x / r;
    x *= 1.7; z *= 1.05;
    if (y > 0) y = y * 0.35 + r * 0.55 * u * u * u * u + r * 0.08;   // the brims, rising to the ends
    else y *= 0.55;
    p.setXYZ(i, x, y, z);
  }
  base.computeVertexNormals();
  const dome = new THREE.SphereGeometry(r * 0.52, 20, 12); dome.scale(1, 0.85, 1); dome.translate(0, r * 0.2, 0);
  const out = mergeGeos([base, dome]); return out;
}
function mergeGeos(list) {   // plain non-indexed merge (positions + normals)
  const pos = [], nor = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out;
}
// a brilliant: a flat table, a crown of facets, a pointed pavilion (pointing down -y; set it along the clump's normal)
function gemGeometry(r) {
  const crown = new THREE.CylinderGeometry(r * 0.6, r, r * 0.45, 8, 1); crown.translate(0, r * 0.22, 0);
  const pav = new THREE.ConeGeometry(r, r * 0.95, 8, 1); pav.rotateX(Math.PI); pav.translate(0, -r * 0.47, 0);
  const g = mergeGeos([crown, pav]); g.translate(0, r * 0.5, 0); g.computeVertexNormals(); return g;
}
// a sprig of red coral: a few forking, tapering twigs
function coralSprig(mat, seed) {
  const g = new THREE.Group(), twig = (a, b, r0, r1) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 6), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.3, 8, 6), mat); tip.position.copy(b); g.add(tip); };
  const grow = (a, dir, len, r, depth, s) => {
    const b = a.clone().addScaledVector(dir, len); twig(a, b, r, r * 0.65);
    if (depth > 0) for (const sgn of [-1, 1]) { const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), sgn * R(0.4, 0.8, s + sgn)).applyAxisAngle(new THREE.Vector3(0, 1, 0), R(-0.8, 0.8, s * 3 + sgn)); grow(b, d.normalize(), len * 0.7, r * 0.65, depth - 1, s * 1.9 + sgn * 7); }
  };
  grow(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 1, 0), 0.07, 0.012, 2, seed + 1);
  return g;
}

export function moneyTree() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a6a30, metalness: 0.75, roughness: 0.35 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.25 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
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
  // the crown: clumps of leaves, each a dark core with leaf cards (a veined, gold-edged leaf) over its surface, on a
  // branch from the fork
  const clumps = [], leafSpots = [];
  const core = new THREE.MeshStandardMaterial({ color: 0x1c4a1a, roughness: 0.85 });
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, up = k < 6 ? 0.6 + R(0, 0.12, k) : 0.82 + R(0, 0.1, k), out = k < 6 ? 0.2 + R(0, 0.06, k + 3) : 0.08;
    const c = P(Math.cos(a) * out, up, Math.sin(a) * out * 0.8), r = k < 6 ? 0.14 + R(0, 0.035, k + 7) : 0.15;
    clumps.push({ c, r }); limb(trunk[3], c.clone().multiplyScalar(0.8).setY(c.y - 0.05), 0.03, 0.016);
    const geo = weld(new THREE.IcosahedronGeometry(r * 0.8, 2)), pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i); pp.setY(i, v.y * 0.82); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, core); m.position.copy(c); g.add(shade(m));
    for (let i = 0; i < 34; i++) {   // leaves round the clump, more on top and towards the camera, pointing outwards
      const th = R(0, 6.28, k * 91 + i * 1.3), ph = Math.acos(R(-0.55, 1, k * 37 + i * 2.9));
      const n = P(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      leafSpots.push({ p: c.clone().addScaledVector(n, r * R(0.78, 0.98, i + k * 13)).setY(c.y + n.y * r * 0.82), n, s: R(0.75, 1.15, i * 3.1 + k), tw: R(0, 6.28, i * 7.7 + k) });
    }
  }
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.14).translate(0, 0.05, 0);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.1 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafSpots.length), d3 = new THREE.Object3D(), tint = new THREE.Color();
  leafSpots.forEach((L, i) => {
    d3.position.copy(L.p); d3.lookAt(L.p.clone().add(L.n)); d3.rotateX(-Math.PI / 2 + 0.5); d3.rotateY(L.tw); d3.scale.setScalar(L.s); d3.updateMatrix();
    leaves.setMatrixAt(i, d3.matrix); leaves.setColorAt(i, tint.setHSL(0.3 + R(-0.03, 0.04, i), 0.55, R(0.32, 0.48, i * 1.7)));
  });
  leaves.castShadow = true; leaves.receiveShadow = true; g.add(leaves);
  // what it bears (scale 0 until it fruits): strings of square-holed gold coins hanging on red cords, gold ingots
  // (元寶, the boat with its upturned brims and a dome), faceted rubies, sapphires, emeralds and amethysts, pearls, and
  // red coral sprigs among the leaves [the user: luxurious and shining, not mushrooms]
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc640, metalness: 1, roughness: 0.14, emissive: 0x3a2200, envMapIntensity: 2.2, clearcoat: 0.6, clearcoatRoughness: 0.08 });
  const coinGold = gold.clone(); coinGold.metalness = 0.85; coinGold.emissive = new THREE.Color(0x7a5000); coinGold.roughness = 0.2;   // (upright, they face the dark room: lit a little from within)
  const cord = new THREE.MeshStandardMaterial({ color: 0xc8141c, roughness: 0.6, emissive: 0x300004 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfff8ee, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.6, sheen: 1, sheenColor: new THREE.Color(1, 0.85, 0.92), emissive: 0x141210, envMapIntensity: 1.2 });
  const gem = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.02, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.4, emissive: new THREE.Color(c).multiplyScalar(0.22), envMapIntensity: 3, flatShading: true });
  const GEMS = [gem(0xd0001e), gem(0x0a3ce0), gem(0x009848), gem(0x8a14d0), gem(0xff6a00)];
  const coral = new THREE.MeshPhysicalMaterial({ color: 0xff3a2a, roughness: 0.3, clearcoat: 0.8, emissive: 0x400800 });
  const coinGeo = coinGeometry(0.05), ingotGeo = ingotGeometry(0.06), pearlGeo = new THREE.SphereGeometry(0.027, 20, 14), gemGeo = gemGeometry(0.055);
  const fruit = [], swing = [];
  const bud = (m, at) => { m.userData = Object.assign(m.userData || {}, { base: m.scale.clone(), at }); m.scale.setScalar(1e-4); m.castShadow = true; g.add(m); fruit.push(m); return m; };
  const onClump = (cl, seed, front) => {   // a point on a clump's outer face (mostly the side the camera sees)
    const th = R(0, 6.28, seed * 1.7), ph = R(0.3, 1.25, seed * 2.3), n = P(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.9, Math.sin(ph) * Math.sin(th)).normalize();
    if (front && n.z < 0) n.z = -n.z;
    return { p: cl.c.clone().addScaledVector(n, cl.r * 1.05), n };
  };
  // the coin strings: from under the clumps' rims, two or three coins a string, each turned a little, swaying
  for (let i = 0; i < 12; i++) {   // (out at the crown's sides, clear of the trunk)
    const cl = clumps[i % 6], side = cl.c.x >= 0 ? 0 : Math.PI, th = side + (side ? -1 : 1) * R(0.15, 0.9, i * 4.1);
    const top = cl.c.clone().add(P(Math.cos(th) * cl.r * 0.9, -cl.r * 0.35, Math.sin(th) * cl.r * 0.9)), n = 1 + (i % 2), len = 0.04 + n * 0.075;
    const str = new THREE.Group(); str.position.copy(top);
    const c0 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 5).translate(0, -len / 2, 0), cord); str.add(c0);
    for (let j = 0; j < n; j++) { const cn = new THREE.Mesh(coinGeo, coinGold); cn.position.y = -0.07 - j * 0.075; cn.rotation.y = R(-0.6, 0.6, i * 9 + j); str.add(cn); }
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), cord); tassel.position.y = -len - 0.02; str.add(tassel);
    str.userData.ph = R(0, 6.28, i * 5.5); swing.push(str); bud(str, R(0.1, 0.7, i * 2.9));
  }
  // ingots set into the crown, gems and pearls on the clumps, coral sprigs standing out of them
  for (let i = 0; i < 12; i++) {
    const { p, n } = onClump(clumps[(i * 4) % 9], i * 3 + 1, true), m = new THREE.Mesh(ingotGeo, gold);
    m.position.copy(p); m.rotation.set(R(-0.25, 0.1, i), R(-0.7, 0.7, i * 2), R(-0.3, 0.3, i * 3)); bud(m, R(0, 0.5, i * 5.3));
  }
  for (let i = 0; i < 26; i++) {
    const { p, n } = onClump(clumps[(i * 5 + 2) % 9], i * 7 + 2, i % 3 !== 0), m = new THREE.Mesh(gemGeo, GEMS[i % GEMS.length]);
    m.position.copy(p); m.quaternion.setFromUnitVectors(P(0, 1, 0), n); m.userData.spin = R(0.3, 0.9, i); bud(m, R(0, 0.6, i * 3.7));
  }
  for (let i = 0; i < 22; i++) {
    const { p } = onClump(clumps[(i * 2 + 1) % 9], i * 11 + 5, i % 4 !== 0), m = new THREE.Mesh(pearlGeo, pearl);
    m.position.copy(p); bud(m, R(0, 0.55, i * 6.1));
  }
  for (let i = 0; i < 5; i++) {
    const { p, n } = onClump(clumps[[0, 2, 4, 6, 8][i]], i * 13 + 7, true), m = coralSprig(coral, i);
    m.position.copy(p); m.quaternion.setFromUnitVectors(P(0, 1, 0), n.clone().lerp(P(0, 1, 0), 0.5).normalize()); bud(m, R(0.05, 0.4, i * 8.3));
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
  const starTex = glintTex(), stars = [];
  for (let i = 0; i < 10; i++) { const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xfff4d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); spr.visible = false; spr.renderOrder = 7; g.add(spr); stars.push({ spr, t: 1, life: 1, size: 0.1 }); }
  const glow = new THREE.PointLight(0xffc860, 0, 2.2, 2); glow.position.set(0, 0.8, 0.35); g.add(glow);
  const cur = { fruit: 0, bloom: 0, fall: 0, sparkle: 0 }, ease = (a, b, r) => a + (b - a) * Math.min(1, r);
  let last = performance.now(), clock = 0;

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
    for (const m of fruit) { const k = THREE.MathUtils.clamp((cur.fruit - m.userData.at * 0.35) / 0.5, 0, 1), e = k * k * (3 - 2 * k); m.scale.copy(m.userData.base).multiplyScalar(Math.max(1e-4, e)); if (m.userData.spin) m.rotateY(dt * m.userData.spin); }
    clock += dt; for (const s of swing) { s.rotation.z = Math.sin(clock * 1.6 + s.userData.ph) * 0.12; s.rotation.x = Math.sin(clock * 1.1 + s.userData.ph * 1.7) * 0.06; }
    if (cur.fall > 0) cur.fall += dt;
    for (const m of flowers) {
      const u = m.userData;
      if (cur.fall > 0) {   // falling: tumbling down past the basin, fading
        const tt = cur.fall; m.position.set(u.home.x + u.v.x * tt + Math.sin(tt * 6 + u.at * 9) * 0.04, Math.max(0.21, u.home.y - tt * tt * 0.9 - tt * 0.15), u.home.z + u.v.z * tt);
        m.rotation.x += dt * 5; m.rotation.z += dt * 3; m.scale.setScalar(Math.max(1e-4, 1 - tt / 1.6));
      } else { const k = THREE.MathUtils.clamp((cur.bloom - u.at) / 0.4, 0, 1); m.position.copy(u.home); m.scale.setScalar(Math.max(1e-4, k)); }
    }
    if (cur.fall > 1.7) { cur.fall = 0; for (const m of flowers) m.scale.setScalar(1e-4); }
    glow.intensity = 0.9 * cur.fruit;
    // glints: a four-pointed star flares on a random jewel now and then, more as it fills, and gold dust drifts down
    cur.sparkle += dt * (2 + 10 * cur.fruit);
    while (cur.fruit > 0.05 && cur.sparkle > 1) {
      cur.sparkle -= 1;
      const m = fruit[Math.floor(Math.random() * fruit.length)]; if (m.scale.x < 0.3 * m.userData.base.x) continue;
      const w = m.getWorldPosition(new THREE.Vector3()), st = stars.find(s => s.t >= s.life);
      if (st) { st.t = 0; st.life = 0.35 + Math.random() * 0.3; st.size = 0.09 + Math.random() * 0.08; st.spr.position.copy(w).add(new THREE.Vector3(0, 0.02, 0.05)); st.spr.material.rotation = Math.random() * 0.8; }
      if (Math.random() < 0.35) E.vfx.spark(w.x, w.y, w.z + 0.03, { vx: 0, vy: -0.12, vz: 0, life: 1.2, size: 0.025, r: 1, gg: 0.85, b: 0.45, g: 0, shape: 0, flicker: 1, ph: Math.random() * 9, wob: 0.1 });
    }
    for (const s of stars) { s.t += dt; const k = Math.min(1, s.t / s.life), o = k < 1 ? Math.sin(k * Math.PI) : 0; s.spr.visible = o > 0.01; s.spr.material.opacity = o; s.spr.scale.setScalar(s.size * (0.6 + 0.4 * o)); }
  }
  return { g, pose };
}
