// 封神英傑傳 — the battle engine: camera, tile overlays, input, unit animations, actions and the turn loop for whichever
// battle rules.js has loaded. A battle's own presentation comes in as FX (src/battles/NN-*-fx.js), called with this
// module (E) so it can use the same camera, effects and animations.
import * as THREE from 'three';
import { World, groundH, rand, setLook, setEffectGround } from './world.js';
import { SpriteBank, Actor } from './actors.js';
import { LEVEL_POSE } from './levelup.js';
import { speed } from './speed.js';
import { VFX } from './vfx.js';
import { playSpell, playItem, arrowMesh, scripted } from './spells.js';
import { spriteKey } from './sprites.js';
import { UI, spellDesc, itemDesc } from './ui.js';
import * as R from './rules.js';
import * as E from './battle.js';
import { sfx, jingle } from './audio.js';
import { deathOf } from './deaths.js';
import { dress } from './sets.js';
import { downIndex } from './downcast.js';
const { D, G } = R;
const AD = globalThis.ANIM_DATA;
const $ = id => document.getElementById(id);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const tileCenter = (x, y) => { const p = V(x + 0.5, 0, y + 0.5); p.y = groundH(p.x, p.z); return p; };

// ---------------------------------------------------------------- engine
export let world, vfx, bank, ui, cam, FX = {};
export const actors = new Map();
export const actorOf = u => actors.get(u) || u.stand;   // stand: the arena's empty-tile target
// arena: 演武場 (src/testkit.js); test: the test toolbar over a battle; free: a hero can be put on any empty cell (both from
// test/index.html, never set by the campaign)
export const opts = { auto: /auto/.test(location.hash), rescue: /rescue/.test(location.hash), arena: /[#&]arena\b/.test(location.hash),
  free: /[#&]free\b/.test(location.hash) && /battle=\d+/.test(location.hash) };
opts.go = /[#&]go\b/.test(location.hash);   // a test start straight into round 1 (src/main.js single)
opts.test = opts.arena || (/[#&]test\b/.test(location.hash) && /battle=\d+/.test(location.hash));
opts.classicfall = /[#&]classicfall\b/.test(location.hash);   // the original's hero fall instead of each hero's own (src/deaths.js)

// tweens on game time (respects hit-stop and fast-forward)
const tweens = [];
export function anim(sec, fn) { return new Promise(res => tweens.push({ t: 0, d: Math.max(0.0001, sec), fn, res })); }
export const wait = ms => anim(ms / 1000);
let timeScale = 1, frozen = false, stepDt = 0, stepDone = null;   // frozen: QA's still frame (tools/qa/tiles.js): no game time, camera or resolution change;
// while frozen, step(dt) advances exactly dt and resolves once that frame is drawn (tools/qa/video.js: real speed at any render speed)
export let gameT = 0;

// ---------------------------------------------------------------- camera rig
export class Cam {
  constructor(camera) {
    this.camera = camera; this.target = V(4, 0, 4); this.yaw = 0; this.pitch = 1.0; this.dist = 13;
    this.goal = { target: this.target.clone(), yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.user = { yaw: 0, pitch: 1.0, dist: 13 }; this.inShot = false; this.speed = 5.5;   // yaw 0: map x runs left to right, like the original
  }
  focus(p, snap) { this.goal.target.copy(p); if (!this.inShot) Object.assign(this.goal, { yaw: this.user.yaw, pitch: this.user.pitch, dist: this.user.dist }); if (snap) this.snap(); }
  shot(p, o) {
    this.inShot = true; this.goal.target.copy(p); this.speed = o.speed || 2.6;
    // fixed camera while playing: shots only pan, keeping the player's zoom (the title / intro shots pass free); a spell's
    // cinematic shot (cine: 楊戩's remade summons) frames its beast and its blows closer, at its own angle, and the
    // battle view comes back as the spell ends (useEffect: cam.release)
    const free = o.free || o.cine;
    this.goal.dist = free ? Math.max(o.dist || 9, o.cine ? 4 : 8) : this.user.dist;
    this.goal.yaw = free ? this.user.yaw + (o.yaw || 0) : this.user.yaw; this.goal.pitch = free ? (o.pitch || 0.5) : this.user.pitch;
  }
  release(p) { this.inShot = false; this.speed = 5.5; Object.assign(this.goal, { yaw: this.user.yaw, pitch: this.user.pitch, dist: this.user.dist }); if (p) this.goal.target.copy(p); }
  rotate() {}   // camera rotation removed: the battle keeps one fixed angle
  zoom(f) { this.user.dist = THREE.MathUtils.clamp(this.user.dist * f, 7, 26); if (!this.inShot) this.goal.dist = this.user.dist; }
  snap() { this.target.copy(this.goal.target); this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist; }
  update(dt, shake) {
    const k = 1 - Math.exp(-dt * this.speed);
    this.target.lerp(this.goal.target, k); this.yaw += (this.goal.yaw - this.yaw) * k; this.pitch += (this.goal.pitch - this.pitch) * k; this.dist += (this.goal.dist - this.dist) * k;
    const c = Math.cos(this.pitch) * this.dist, look = this.target.clone().add(V(0, 0.55, 0));
    this.camera.position.set(look.x + Math.sin(this.yaw) * c, look.y + Math.sin(this.pitch) * this.dist, look.z + Math.cos(this.yaw) * c);
    if (shake) this.camera.position.add(V(rand(-shake, shake), rand(-shake, shake), rand(-shake, shake)));
    this.camera.lookAt(look);
  }
}

// ---------------------------------------------------------------- tile overlays, cursor, path
// how light the ground of every cell is as built (sampled once per world, from straight above, lit, without fog):
// the move fill is white where the ground is dark (forest, shadowed rock) and dark grey where it is light (sand)
// dark ground (white move squares): under 0.16, or under 0.6 of the map's median where the whole battle is lit low (an
// evening battle's sand still takes the dark squares)
let groundLum = null, groundRaw = null, LUM_DARK = 0.16;   // (groundRaw: unsmoothed, for a flier's square over the void or water)
export const groundLight = () => ({ lum: groundLum, dark: LUM_DARK });   // (tools/qa/tiles.js)
// QA (the downward-ray index against the Raycaster it replaced): the highest hit under five points of every cell
export function downCheck() {
  const ray = new THREE.Raycaster(), bad = []; let n = 0;
  for (let y = 0; y < R.MAP_H; y++) for (let x = 0; x < R.MAP_W; x++) for (const [dx, dz] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8]]) {
    const g = groundH(x + 0.5, y + 0.5) + 6; ray.set(new THREE.Vector3(x + dx, g, y + dz), DOWN);
    const a = ray.intersectObjects(RANGE_SOLID, false)[0], b = rangeIdx().cast(x + dx, y + dz, g)[0]; n++;
    if (!!a !== !!b || (a && (Math.abs(a.point.y - b.y) > 2e-3 || a.object !== b.object))) bad.push((x + dx) + ',' + (y + dz) + ' ray ' + (a ? a.point.y.toFixed(3) : '-') + ' idx ' + (b ? b.y.toFixed(3) : '-'));
  }
  return { n, bad: bad.length, first: bad.slice(0, 5) };   // (a point exactly on an edge may go either way: battle 4 has one)
}
// QA (tools/qa/battlecheck.js): the first move squares drawn again from cold (their scenery looked up afresh), in ms
export function squaresCold() { RANGE_CELLS.clear(); RANGE_VOID.clear(); const t0 = performance.now(); tiles.set(tiles.last || []); return performance.now() - t0; }
export function measureLight() {
  SURF = null; RANGE_IDX = null; RANGE_CELLS.clear(); RANGE_VOID.clear(); FLOOR.clear(); NEAR.clear(); LANDED.clear(); OPEN = null; WATER = null;   // the set or the room changed: the flier surfaces and the cells' scenery are measured again
  if (tiles) { tiles.ground(); tintScenery(); rangeIdx(); }   // and the ground the squares lie on; the scenery takes the range (its downward-ray index made now, under the loading screen)
  try {
    // the map's run of light from high up; each cell the darker of that and its ground under any canopy (battle 13's bamboo
    // tops read the shaded ground under them as light: tools/qa/tiles.js)
    const above = measureGround(false), under = measureGround(true), a = [...smoothLum(above)].filter(v => v > 0.01).sort((p, q) => p - q);
    groundRaw = above.map((v, i) => Math.min(v, under[i])); groundLum = smoothLum(groundRaw);
    const med = a[a.length >> 1] || 1;
    LUM_DARK = med < 0.05 ? 0.16 : Math.min(0.16, med * 0.6) * 0.8;   // a map too dark for dark squares to show on at all takes white ones: the dark interiors, battles 3, 5, 6, 11 (median 0.040-0.043), not battle 2's night sand (0.057; tools/qa/tiles.js)   // (0.8: only ground clearly darker than the map's run; on battle 7's evenly dark night court a wall's shadow, 0.04 against 0.05 round it, turned two cells white: the user's report)
  }
  catch (e) { groundLum = null; }
  warmUp();
}
// every shader program the battle will draw, made now rather than in the frames of the fight (the user's report: a lag
// after each battle's name shows). The first frame of a set compiled ~20 programs (0.65 s) and the first move squares
// ~20 more; renderer.compile alone misses the shadow map's depth programs, the AO pass's normal programs and each
// material as actually lit, so one real frame is drawn too (under the loading screen; stage() again with the units, in
// the camp's fade); the marks and the squares are shown for it, so theirs compile as well. Draws nothing anyone sees:
// the frame is drawn over by the next.
export function warmUp() {
  if (!world || !world.renderer || !world.scene || !ready) return;
  const hidden = [tiles && tiles.cursor, tiles && tiles.marker, tiles && tiles.dots, activeMark && activeMark.group, targetMark && targetMark.group].filter(o => o && !o.visible);
  for (const o of hidden) o.visible = true;
  try { world.renderer.compile(world.scene, world.camera); world.shadowsLive = true; world.render(); } catch (e) { console.warn('warmUp', e); }
  for (const o of hidden) o.visible = false;
}
// each cell's brightness averaged with its neighbours' (its own counted twice), so that a shadow's edge or a speck does
// not flip one cell's fill against the cells round it
function smoothLum(L) {
  const W = R.MAP_W, H = R.MAP_H, out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = L[y * W + x], n = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) { s += L[Y * W + X]; n++; } }
    out[y * W + x] = s / n;
  }
  return out;
}
// each cell's brightness from straight above. under: from just above the highest open ground, so a canopy or roof over
// a cell is left out (its shadow on the ground still counts); otherwise from high up (the whole set, as the play view
// mostly sees it)
function measureGround(under) {
  const W = R.MAP_W, H = R.MAP_H, K = 8, S = world.scene, rt = new THREE.WebGLRenderTarget(W * K, H * K);
  let top = 79.4; if (under) { top = -99; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!R.D.terrain || R.D.terrain[y][x] === 0) top = Math.max(top, tileY(x, y)); }
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, 0.01, 200); cam.up.set(0, 0, -1);
  cam.position.set(0, top + 0.6, 0); cam.lookAt(0, top - 10, 0); cam.updateProjectionMatrix();
  // drifting particles and see-through glows are not ground: left in, battle 4's dust moved a cell's reading by up to
  // 0.2 from one load to the next, so the squares came out light or dark by chance (tools/qa/tiles.js)
  const hid = []; S.traverse(o => { const m = o.material; if (o.visible && (o.isPoints || (m && !Array.isArray(m) && (m.blending === THREE.AdditiveBlending || (m.transparent && !m.depthWrite))))) { o.visible = false; hid.push(o); } });
  const fog = S.fog; S.fog = null; const r = world.renderer, prev = r.getRenderTarget();
  r.setRenderTarget(rt); r.render(S, cam); r.setRenderTarget(prev); S.fog = fog; for (const o of hid) o.visible = true;
  const px = new Uint8Array(W * K * H * K * 4); r.readRenderTargetPixels(rt, 0, 0, W * K, H * K, px); rt.dispose();
  const out = new Float32Array(W * H);
  for (let py = 0; py < H * K; py++) for (let qx = 0; qx < W * K; qx++) {
    const k = (py * W * K + qx) * 4, cx = Math.floor(qx / K), cy = Math.floor(py / K);   // row 0 is the image bottom: z = +H
    const lum = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
    out[(H - 1 - cy) * W + cx] += lum / (K * K);
  }
  return out;
}
// a tile's height: the highest ground in its cell, a little above, in steps of 0.1, so that neighbours on level
// ground lie at exactly one height (their overlap, a hair wide, is shaded once) and none sinks into a lump
const groundTop = (x, y) => { let h = -99; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) h = Math.max(h, groundH(x + 0.1 + i * 0.4, y + 0.1 + j * 0.4)); return h; };   // the highest ground in a cell
const tileY = (x, y) => Math.ceil((groundTop(x, y) + 0.04) / 0.1) * 0.1;
// a tile's height on a blocked cell (a roof, a cliff a flier can reach) sits on top of what is there; with a unit in it
// or a square shown on it, on the floor level a unit stands at (floorY: what stands there fades, OBSTRUCT)
const blocked = (x, y) => !!(G.terrain && G.terrain[y] && G.terrain[y][x] !== 0 && D.costs && D.costs[0] && D.costs[0][G.terrain[y][x]] >= 127);
const sunk = (x, y) => blocked(x, y) && floorY(x, y) != null && (!!R.unitAt(x, y) || !!(tiles && tiles.sunk.has(y * R.MAP_W + x)));
const cellY = (x, y) => (G.terrain && G.terrain[y] && G.terrain[y][x] !== 0) ? (sunk(x, y) ? floorY(x, y) : Math.max(tileY(x, y), Math.ceil((surfaceY(x, y) + 0.04) / 0.1) * 0.1)) : tileY(x, y);
// the level the pointer and the cursor take a cell at [the user's call: the focus on the heroes' level]: on an open cell
// a unit's feet (the ground at its middle, standAt; cellY, the cell's highest ground, put a cell at the foot of a ledge
// at the ledge's top); on a blocked one the floor beside it a flier would stand on (floorY), or its square's height
// while one is shown there (cellY)
const levelY = (x, y) => !G.terrain || !G.terrain[y] || (blocked(x, y) && tiles && tiles.at && tiles.at.has(y * R.MAP_W + x)) ? cellY(x, y) : blocked(x, y) ? floorY(x, y) ?? cellY(x, y) : tileCenter(x, y).y;
// a cell at that level, for the camera to follow the cursor to (tileCenter is the ground there: a void's far below the
// play) [the user's report: the arrow keys dropped the view into battle 26's void]
// @qa battles
const cellAt = (x, y) => { const p = tileCenter(x, y); p.y = levelY(x, y); return p; };
// the play's level at a point, for the effects (world.js setEffectGround): the ground on an open cell, a blocked cell's
// floor level (where its units stand: the void, a wall, a cliff) [the user's call: only the ground level is focused; an
// animation over cells of other heights kept to the cell it was over: hidden in a wall's top, dropped into the abyss]
// @qa battles
const playH = (x, z) => { const gx = Math.floor(x), gz = Math.floor(z);
  if (typeof D.n !== 'number' || !G.terrain || !R.inMap(gx, gz) || !blocked(gx, gz)) return groundH(x, z);   // (a story scene's map: its own ground)
  const f = floorY(gx, gz); return f != null ? f : groundH(x, z); };
setEffectGround(playH);
// the floor level of a blocked cell (a column, a tree, a wall, a cliff, the void a flier crosses): the highest square of
// the walkable cells nearest it (within three), so a unit in it stands on the grid as in the original, not on the top
// of what is there [the user's call], but never under the cell's own land (raised ground: its top); deep in the void
// with none within three, the nearest floor's level (as standAt puts a flier); null with no floor at all
const FLOOR = new Map(), LANDED = new Set();   // (LANDED: the cells whose floor level is their own land's top)
// the open cells someone on foot can get to from where the units and the deploy cells are (by move type 0's costs): an
// enclosed pocket of open ground (battle 23's bank either side of the bridge's end, raised to read as out of reach) gives
// no floor level to the void or water beside it
let OPEN = null;
function openReach() {
  if (OPEN) return OPEN;
  OPEN = new Set(); const c = D.costs && D.costs[0], q = [...G.units.map(u => [u.x, u.y]), ...(D.deploy || [])];
  while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (OPEN.has(k) || !R.inMap(x, y) || !c || c[G.terrain[y][x]] >= 127) continue; OPEN.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  return OPEN;
}
// a body of open water (blocked cells over water in its own shader, joined side by side; not a chasm's void) lies at one level:
// the lowest walkable shore round it, the beach [the user's report: battle 21's squares over the sea stepped where
// some cells took the beach's level and others the temple terrace's, the highest within three, and fliers stood at
// either]; null with no shore one can walk to
let WATER = null;
function waterLevel(x, y) {
  if (!WATER) {
    WATER = new Map(); const W = R.MAP_W, H = R.MAP_H, wet = (i, j) => R.inMap(i, j) && blocked(i, j) && overWater(i, j);
    for (let j0 = 0; j0 < H; j0++) for (let i0 = 0; i0 < W; i0++) {
      if (WATER.has(i0 + ',' + j0) || !wet(i0, j0)) continue;
      const body = [], q = [[i0, j0]], seen = new Set([i0 + ',' + j0]); let lo = null;
      while (q.length) { const [i, j] = q.pop(); body.push(i + ',' + j);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj, nk = ni + ',' + nj; if (!R.inMap(ni, nj) || seen.has(nk)) continue;
          if (wet(ni, nj)) { seen.add(nk); q.push([ni, nj]); }
          else if (!blocked(ni, nj) && G.terrain[nj][ni] === 0 && openReach().has(nk)) lo = Math.min(lo ?? 99, tileY(ni, nj)); } }
      for (const c of body) WATER.set(c, lo);
    }
  }
  return WATER.has(x + ',' + y) ? WATER.get(x + ',' + y) : undefined;
}
function floorY(x, y) {
  const k = x + ',' + y; if (FLOOR.has(k)) return FLOOR.get(k);
  const wl = waterLevel(x, y); if (wl != null) { FLOOR.set(k, wl); return wl; }
  let best = null;
  for (let r = 1; r <= 3 && best == null; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x + dx, ny = y + dy;
    if (R.inMap(nx, ny) && !blocked(nx, ny) && G.terrain[ny][nx] === 0 && openReach().has(nx + ',' + ny)) best = Math.max(best ?? -99, tileY(nx, ny));
  }
  // never under the cell's own ground where that is solid land, nothing drawn at the floor level under it (the fade
  // cut battle 19's rock through to the sky while its squares showed, the user's report): its top. Not where the set
  // draws a floor under what stands there, nor in a set that keeps the floor level (keepFloor: the gaol, src/remake/prison.js)
  if (best != null && !(FX.look && FX.look.set && FX.look.set.keepFloor)) { const g = groundTop(x, y); if (g > best && !floorUnder(x, y, best)) { best = g; LANDED.add(k); } }
  // nor over it where the cell's own land lies well below the level found (a sand islet, a strip of shore beside a raised
  // terrace: battle 21's squares round its chest floated at the terrace's height [the user's report]): its own ground
  // (only where the top of the cell's middle is that land itself: not a kerb over the water beside battle 23's bridge)
  if (best != null) { const h = rangeIdx().cast(x + 0.5, y + 0.5, 50)[0], g = groundTop(x, y); if (h && h.material && h.material.userData.rangeTint && h.y <= g + 0.05 && g < best - 0.3) best = tileY(x, y); }
  // with no floor within three cells, over the void far below the play: the nearest floor's level, where standAt puts a
  // flier, so its cursor and square are there too [the user's report: battle 27's corners drew them in the abyss]
  // @qa battles
  if (best == null) { const n = nearFloor(x, y); if (n != null && groundTop(x, y) < n - 1) best = n; }
  FLOOR.set(k, best); return best;
}
// is something drawn at level L in cell (x, y) under what stands there: at three of five points a surface within 0.3
// under it (rays down through the set's solid pieces, surfaceY's index)
function floorUnder(x, y, L) {
  surfaceY(x, y); let n = 0;
  for (const [dx, dz] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const h = SURF.idx.cast(x + dx, y + dz, L + 0.05)[0]; if (h && h.y >= L - 0.3) n++; }
  return n >= 3;
}
// nothing of the set's own land under a cell's middle: no surface, or only water in its own shader (not tinted by the range)
function overNothing(x, y) { const h = rangeIdx().cast(x + 0.5, y + 0.5, 50)[0]; return !h || !(h.material && h.material.userData.rangeTint); }
// water under a cell's middle: the sets' water (src/sets.js water), not the void of a chasm nor rock left untinted
function overWater(x, y) { const h = rangeIdx().cast(x + 0.5, y + 0.5, 50)[0]; return !!h && !!h.material && !!h.material.userData.water; }   // (by its mark: an untinted rock is not water, battle 19)
// the ground's height under the squares, DRAPE samples a cell (at the cells' corners and every 1/DRAPE between): a square
// on open ground follows it, sloped, stepped or lumpy (a flat plate at the cell's highest point floated over a ledge's
// slope and let the ground's lumps through: battle 10's ledges, battle 8's grass, the user's report); built again with
// each world (measureLight)
const DRAPE = 8;
function drapeTexture() {
  const W = R.MAP_W * DRAPE + 1, H = R.MAP_H * DRAPE + 1, data = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) data[j * W + i] = groundH(i / DRAPE, j / DRAPE);
  const t = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
// The range drawn on the scenery itself [the user's call: a square laid flat over a rock with pearls on it floated as a
// dark pane over the rock, and the faces between two levels stayed bare]: every opaque material of the set is patched
// (tintScenery) to take the square's fill and its black cell lines wherever its surface stands in a cell of the range,
// between the cell's foot and the top of what stands on it (cellInfo). Ground, steps, a cliff's face, a rock, a chest
// all take it; the lines only on what lies flat. A cell with nothing of the set's own under its square (a flier's cell
// over the void, water drawn by its own shader) keeps the square as before.
const RU = { uRangeCell: { value: null }, uRangeBand: { value: null }, uRangeSize: { value: new THREE.Vector2(1, 1) }, uRangeOn: { value: 0 }, uRangeAlpha: { value: 1 }, uRangeT: { value: 0 }, uRangeMask: { value: 0 }, uCutCell: { value: null }, uCutOn: { value: 0 } };   // (one set for every world: a material patched once keeps them)
const RANGE_CELLS = new Map(), RANGE_VOID = new Set(); let RANGE_SOLID = [], RANGE_IDX = null;
// the downward-ray index of the solid pieces (src/downcast.js), made once a world (measureLight, under the loading screen)
const downArea = () => [-3, -3, R.MAP_W + 3, R.MAP_H + 3];
const rangeIdx = () => RANGE_IDX || (RANGE_IDX = downIndex(RANGE_SOLID, downArea()));
// how light the world beyond the set is (a flier's square over the void is seen against it)
const backdropLum = () => { const S = world.scene, c = S.background && S.background.isColor ? S.background : S.fog ? S.fog.color : null; return c ? 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b : 0; };
// a unit in a blocked cell (OBSTRUCT): what stands in that cell above its feet thins away, a screen-door dither over a
// quarter second, a trace left so the column or the tree still reads (uCutCell: the floor level, the fade, a texel a cell)
// @qa battle:9 battle:12 battle:18   (shows only where a flier stands in a blocked cell: columns, blocks, trees; tools/qa/scope.mjs)
const CUT_GLSL = `
    if (uCutOn > 0.5) {
      vec2 ctC = floor(vRangeO.xz);   // (by the piece's own root: a tree's crown overhanging the next cell goes with its trunk)
      if (ctC.x >= 0.0 && ctC.y >= 0.0 && ctC.x < uRangeSize.x && ctC.y < uRangeSize.y) {
        vec4 ct = texture2D(uCutCell, (ctC + 0.5) / uRangeSize);
        if (ct.g > 0.01 && vRangeW.y > ct.r + 0.04 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < ct.g * 0.9) discard;
      }
    }
`;
// @qa sample   (the range on the scenery: the same in every battle; tools/qa/scope.mjs)
const RANGE_GLSL = `
    if (uRangeOn > 0.5) {
      vec3 rgN = normalize(cross(dFdx(vRangeW), dFdy(vRangeW))); if (dot(rgN, cameraPosition - vRangeW) < 0.0) rgN = -rgN;
      vec2 rgP = vRangeW.xz - rgN.xz * 0.02, rgPx = fwidth(vRangeW.xz), rgC = floor(rgP);   // (a face belongs to the cell behind it)
      if (rgC.x >= 0.0 && rgC.y >= 0.0 && rgC.x < uRangeSize.x && rgC.y < uRangeSize.y) {
        vec2 rgT = (rgC + 0.5) / uRangeSize; vec4 rgD = texture2D(uRangeCell, rgT); vec4 rgB = texture2D(uRangeBand, rgT);
        if (rgD.a > 0.5 && vRangeW.y >= rgB.r && vRangeW.y <= rgB.g) {
          float rgF = max(smoothstep(0.5, 0.8, abs(rgN.y)), 1.0 - smoothstep(rgB.b + 0.3, rgB.b + 0.6, vRangeW.y)), d = max(abs(rgP.x - rgC.x - 0.5), abs(rgP.y - rgC.y - 0.5)) * 2.0 * rgF;   // (the outline and lines on what lies flat, and on all that is low: the ground's grass and pebbles; not up a wall)
          vec3 vC = rgD.rgb; float mv = step(1.5, rgD.a);
          float edge = smoothstep(0.8, 0.9, d) * (1.0 - smoothstep(0.97, 1.0, d)) * (1.0 - mv);
          float red = smoothstep(0.3, 0.6, vC.r - max(vC.g, vC.b));
          float a = mix(0.11 + 0.02 * sin(uRangeT * 2.5), 0.32, red) + edge * 0.5;
          vec3 col = vC * (0.55 + edge * 0.35);
          col = mix(col, vC, mv); a = mix(a, mix(0.66, 0.3, step(0.5, vC.r)), mv);
          float w = 2.0 * max(rgPx.x, rgPx.y), hair = mv * rgF * smoothstep(1.0 - 1.8 * w, 1.0 - 0.8 * w, d);
          col = mix(col, vec3(0.0), hair); a = mix(a, 0.92, hair);
          a *= mix(0.5, 1.0, rgF);   // (half on what stands up: a rock or a wall keeps its form under the fill)
          gl_FragColor = uRangeMask > 0.5 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(mix(gl_FragColor.rgb, col, a * uRangeAlpha), gl_FragColor.a);
        }
      }
    }
`;
function rangeMaterial(m) {
  if (!m || m.userData.rangeTint || m.transparent || m.blending !== THREE.NormalBlending || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial)) return;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    for (const k of Object.keys(RU)) sh.uniforms[k] = RU[k];
    const end = (src, code) => { const i = src.lastIndexOf('}'); return src.slice(0, i) + code + src.slice(i); };
    // vRangeO: where the piece is rooted (an instance's origin: a tree's clump; a whole mesh, each point itself)
    sh.vertexShader = 'varying vec3 vRangeW;\nvarying vec3 vRangeO;\n' + end(sh.vertexShader, '\n  vec4 rgW = vec4(transformed, 1.0), rgO = rgW;\n  #ifdef USE_INSTANCING\n  rgW = instanceMatrix * rgW; rgO = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n  #endif\n  vRangeW = (modelMatrix * rgW).xyz; vRangeO = (modelMatrix * rgO).xyz;\n');
    sh.fragmentShader = 'varying vec3 vRangeW;\nvarying vec3 vRangeO;\nuniform sampler2D uRangeCell, uRangeBand, uCutCell;\nuniform vec2 uRangeSize;\nuniform float uRangeOn, uRangeAlpha, uRangeT, uRangeMask, uCutOn;\n' + end(sh.fragmentShader, CUT_GLSL + RANGE_GLSL);
  };
  m.customProgramCacheKey = () => key() + '|range';
  m.userData.rangeTint = true; m.needsUpdate = true;
}
// every opaque material of the set (not the units, the squares, the cursor or the marks)
function tintScenery() {
  const skip = new Set(); for (const a of actors.values()) a.root.traverse(o => skip.add(o));
  for (const o of [tiles && tiles.mesh, tiles && tiles.cursor, tiles && tiles.marker, tiles && tiles.dots, activeMark && activeMark.group, targetMark && targetMark.group]) if (o) o.traverse(q => skip.add(q));
  world.scene.traverse(o => { if (o.isMesh && !skip.has(o) && !o.userData.noRange) for (const m of [].concat(o.material)) rangeMaterial(m); });
  // what a square can lie on, for cellInfo: every opaque mesh seen (water in its own shader too: it is not tinted)
  RANGE_IDX = null; RANGE_SOLID = []; world.scene.traverseVisible(o => { if (o.isMesh && !skip.has(o) && [].concat(o.material).some(m => m && !m.transparent && m.blending === THREE.NormalBlending && m.colorWrite !== false && m.side !== THREE.BackSide)) RANGE_SOLID.push(o); });
}
// what a cell of the range tints: from its foot (the lowest ground round it, so the face of a step down from it is
// coloured) to the top of what stands on it (on open ground no higher than 1.2 over it: not a canopy); null when what
// lies under the square is not the set's own (nothing, the void below a flier's cell, water in its own shader)
function cellInfo(x, y) {
  const k = x + ',' + y; if (RANGE_CELLS.has(k)) return RANGE_CELLS.get(k);
  const g = tileY(x, y), walk = !G.terrain || !G.terrain[y] || G.terrain[y][x] === 0;
  let foot = g; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) foot = Math.min(foot, groundH(x + 0.1 + i * 0.4, y + 0.1 + j * 0.4));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R.inMap(x + dx, y + dy)) foot = Math.min(foot, groundH(x + dx + 0.5, y + dy + 0.5));
  foot = Math.max(foot, g - 2.5) - 0.05;
  let top = -99, good = 0, info = { lo: foot, hi: 0 };
  for (const [dx, dz] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {   // the middle and at least two of the corners
    const hit = rangeIdx().cast(x + dx, y + dz, g + 6).find(h => !walk || h.y <= g + 1.2), hm = hit && hit.material;
    if (hit && hit.y >= foot && hm && hm.userData.rangeTint) { good++; top = Math.max(top, hit.y); } else if (dx === 0.5) { if (!hit || hit.y < foot) RANGE_VOID.add(k); good = -9; break; }
  }
  if (good < 3) info = null; else { info.hi = (walk ? Math.max(g + 0.3, top) : Math.max(g, top)) + 0.05; info.g = g; }
  RANGE_CELLS.set(k, info); return info;
}
class Tiles {
  // @qa sample   (the squares' shader and meshes: the same in every battle; tools/qa/scope.mjs)
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1, DRAPE, DRAPE); geo.rotateX(-Math.PI / 2);   // its vertices on the height samples (a draped square: no seam with its neighbour)
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, depthFunc: THREE.LessDepth,   // normal blending, tone-mapped: tints the ground without lighting it or blooming; depth: the overlap is not shaded twice
      uniforms: { uT: RU.uRangeT, uH: { value: null }, uHSize: { value: new THREE.Vector2(1, 1) }, uMask: RU.uRangeMask },   // uMask: solid magenta, where the squares are seen (tools/qa/tiles.js); both shared with the tinted scenery
      vertexShader: `attribute float aEdge; attribute float aDrape; attribute float aDecal; attribute float aHi; uniform sampler2D uH; uniform vec2 uHSize; varying vec2 vUv; varying vec3 vC; varying float vEdge;
        varying vec3 vW; varying vec2 vCell; varying float vDecal, vHi;
        void main(){ vUv = uv; vC = instanceColor; vEdge = aEdge; vDecal = aDecal; vHi = aHi; vCell = floor(instanceMatrix[3].xz); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          if (aDrape > 0.5) w.y = texture2D(uH, (w.xz * ${DRAPE}.0 + 0.5) / uHSize).r + 0.05;   // on the ground, a hair above it
          vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT, uMask; uniform mat4 projectionMatrix; varying vec2 vUv; varying vec3 vC; varying float vEdge; varying vec3 vW; varying vec2 vCell; varying float vDecal, vHi;
        void main(){
          #ifdef XRAY
          // a cell the scenery takes the range on: drawn over what hides it only where that stands outside the cell (its
          // depth moved to where the line of sight leaves the cell's column), not over the rock or the step in the cell
          vec3 dir = normalize(cameraPosition - vW); float t = 1e3;
          if (dir.x > 0.0) t = min(t, (vCell.x + 1.0 - vW.x) / dir.x); else if (dir.x < 0.0) t = min(t, (vCell.x - vW.x) / dir.x);
          if (dir.z > 0.0) t = min(t, (vCell.y + 1.0 - vW.z) / dir.z); else if (dir.z < 0.0) t = min(t, (vCell.y - vW.z) / dir.z);
          if (dir.y > 0.0) t = min(t, (vHi - vW.y) / dir.y);
          vec4 cp = projectionMatrix * viewMatrix * vec4(vW + dir * max(t, 0.0), 1.0); gl_FragDepthEXT = cp.z / cp.w * 0.5 + 0.5;
          #else
          if (vDecal > 0.5) discard;   // (the scenery draws it)
          #endif
          vec2 c = abs(vUv - 0.5) * 2.0; float d = max(c.x, c.y);
          float edge = smoothstep(0.8, 0.9, d) * (1.0 - smoothstep(0.97, 1.0, d));
          float mv = step(0.5, vEdge);   // a move tile: a flat fill, no outline (white on dark ground, dark grey on light)
          float red = smoothstep(0.3, 0.6, vC.r - max(vC.g, vC.b));
          edge *= 1.0 - mv;
          float a = mix(0.11 + 0.02 * sin(uT * 2.5), 0.32, red) + edge * 0.5;
          vec3 col = vC * (0.55 + edge * 0.35);
          float lite = step(0.5, vC.r);
          col = mix(col, vC, mv); a = mix(a, mix(0.66, 0.2, lite), mv);   // white squares (dark ground, the void) faint: at 0.3 they read as grey slabs over the dark [the user's report]
          float w = fwidth(d), hair = mv * smoothstep(1.0 - 1.8 * w, 1.0 - 0.8 * w, d);   // a one-pixel black line keeps the cells apart (white squares too: on a dark floor they merged into one block)
          col = mix(col, vec3(0.0), hair); a = mix(a, 0.92, hair);
          #ifdef XRAY
          a *= 0.5; if (uMask > 0.5) discard;   // (fainter; the QA mask shows only what is seen)
          #endif
          gl_FragColor = uMask > 0.5 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(col, a); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 600); this.mesh.count = 0; this.mesh.renderOrder = 3; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    // the parts of the squares the scenery hides (a ledge's face, a tree's crown, a wall before them): drawn fainter over
    // it, so the whole cell reads, as the original's flat highlight does (the user's report); in the opaque pass with its
    // own blending, after the scenery (0) and the grass (1) and before the characters (2), who draw over it
    const xmat = mat.clone(); xmat.uniforms = mat.uniforms; xmat.transparent = false; xmat.depthWrite = false; xmat.depthFunc = THREE.GreaterDepth;
    xmat.blending = THREE.CustomBlending; xmat.blendSrc = THREE.SrcAlphaFactor; xmat.blendDst = THREE.OneMinusSrcAlphaFactor;
    xmat.defines = { XRAY: 1 }; xmat.extensions = { fragDepth: true };
    this.xray = new THREE.InstancedMesh(geo, xmat, 600); this.xray.count = 0; this.xray.renderOrder = 1.5; this.xray.frustumCulled = false;
    this.xray.instanceMatrix = this.mesh.instanceMatrix; this.xray.instanceColor = this.mesh.instanceColor; this.mesh.add(this.xray);   // (a child: hidden with the squares)
    this.edge = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); geo.setAttribute('aEdge', this.edge);   // move tiles: sides on the range's outline
    this.drape = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); geo.setAttribute('aDrape', this.drape);   // 1: laid over the ground; 0: flat at its matrix's height (a roof's, a cliff top's: a flier's square)
    this.decal = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); geo.setAttribute('aDecal', this.decal);   // 1: the scenery draws it (cellInfo); the square only shows through what hides it
    this.hi = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); geo.setAttribute('aHi', this.hi);   // the top of the cell's column (cellInfo)
    scene.add(this.mesh); this.mat = mat; this.rangeU = RU; this.sunk = new Set();
    let shown = true; delete this.mesh.visible;   // the scenery's range shows and hides with the squares (tools/qa/tiles.js hides them)
    Object.defineProperty(this.mesh, 'visible', { configurable: true, get: () => shown, set: v => { shown = v; this.syncOn(); } });
    // cursor: four gold corners + a hovering marker
    const cc = document.createElement('canvas'); cc.width = cc.height = 64; const g = cc.getContext('2d'); g.fillStyle = '#ffe9a8';
    for (const [x, y] of [[0, 0], [52, 0], [0, 52], [52, 52]]) { g.fillRect(x, y + (y ? 8 : 0), 12, 4); g.fillRect(x + (x ? 8 : 0), y, 4, 12); }
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = THREE.NearestFilter;
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, color: new THREE.Color(1, 0.88, 0.6) }));
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.35) }));
    this.marker.scale.y = 1.6; this.cursor.renderOrder = 4; scene.add(this.cursor, this.marker); this.cursor.visible = this.marker.visible = false;
    const dg = new THREE.SphereGeometry(0.05, 8, 6);
    this.dots = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.85, 1) }), 40); this.dots.count = 0; this.dots.frustumCulled = false; scene.add(this.dots);
  }
  set(list) {
    this.last = list;   // (tools/qa/tiles.js reads the cells shown)
    const m = new THREE.Matrix4(), c = new THREE.Color(), W = R.MAP_W, [cd, bd] = this.rangeTex(W, R.MAP_H);
    // a square on a blocked cell (a column, a block, a tree a flier may enter) lies on the floor level, where the unit would
    // stand, and what stands there fades while it shows (OBSTRUCT) [the user's call: squares on the columns' tops beside
    // the floor's read as misaligned, battle 12's third room]; a plain square, not the scenery's tint (that would go
    // up the faded column)
    this.sunk = new Set(list.filter(t => blocked(t.x, t.y) && floorY(t.x, t.y) != null).map(t => t.y * W + t.x));
    list.slice(0, 600).forEach((t, i) => {
      const p = tileCenter(t.x, t.y), move = t.c === C.move, y = cellY(t.x, t.y), low = this.sunk.has(t.y * W + t.x); m.makeTranslation(p.x, y + (t.lift || 0) + (low ? 0.05 : 0), p.z); this.mesh.setMatrixAt(i, m);
      this.drape.array[i] = (low ? LANDED.has(t.x + ',' + t.y) : y <= tileY(t.x, t.y) + 0.001) && !t.lift && this.mat.uniforms.uH.value ? 1 : 0;   // (on top of what stands on a blocked cell, or on its floor level: flat; on its floor level where that is its own ground's top, raised ground: over the ground, as an open cell's, not a flat pane at the top overhanging the cell behind and taking the pointer meant for that one's square)
      const info = this.mat.uniforms.uH.value && !low ? cellInfo(t.x, t.y) : null, over = !info && RANGE_VOID.has(t.x + ',' + t.y);
      // a flier's square on the floor level of a cell with nothing drawn at that level (the void, water far below): against what
      // is seen under it, unsmoothed (battle 26's crystal beside it lifted the smoothed light over the void past the cutoff)
      const open = low && overNothing(t.x, t.y), rawL = groundRaw && groundRaw[t.y * R.MAP_W + t.x];
      c.setRGB(...(move && (over ? backdropLum() < 0.4 : open && rawL != null ? rawL < 0.4 : groundLum && groundLum[t.y * R.MAP_W + t.x] < LUM_DARK) ? C.moveLite : t.c)); this.mesh.setColorAt(i, c);   // (over the void: the fill against what is seen beyond, a cloud sea or the dark)
      this.edge.array[i] = move ? 1 : 0;
      this.decal.array[i] = info ? 1 : 0; this.hi.array[i] = info ? info.hi : -1e3;
      if (info) { const o = (t.y * W + t.x) * 4; cd[o] = c.r; cd[o + 1] = c.g; cd[o + 2] = c.b; cd[o + 3] = move ? 2 : 1; bd[o] = info.lo; bd[o + 1] = info.hi; bd[o + 2] = info.g; }
    });
    this.at = new Map(); list.slice(0, 600).forEach((t, i) => this.at.set(t.y * W + t.x, i));   // a cell's square (pick: squareAt)
    this.mesh.count = this.xray.count = Math.min(600, list.length); this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; this.edge.needsUpdate = true; this.drape.needsUpdate = true;
    this.decal.needsUpdate = true; this.hi.needsUpdate = true; RU.uRangeCell.value.needsUpdate = true; RU.uRangeBand.value.needsUpdate = true; this.syncOn();
  }
  syncOn() { RU.uRangeOn.value = this.mesh.visible && this.mesh.count > 0 ? 1 : 0; }
  // the cells' colours and columns for the tinted scenery (RANGE_GLSL), one texel a cell
  rangeTex(W, H) {
    const make = () => { const t = new THREE.DataTexture(new Float32Array(W * H * 4), W, H, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.NearestFilter; return t; };
    if (!RU.uRangeCell.value || RU.uRangeCell.value.image.width !== W || RU.uRangeCell.value.image.height !== H) {
      for (const k of ['uRangeCell', 'uRangeBand']) { if (RU[k].value) RU[k].value.dispose(); RU[k].value = make(); }
      RU.uRangeSize.value.set(W, H);
    }
    RU.uRangeCell.value.image.data.fill(0); return [RU.uRangeCell.value.image.data, RU.uRangeBand.value.image.data];
  }
  // the ground's heights for draped squares (a new world, a new room)
  ground() { const u = this.mat.uniforms; if (u.uH.value) u.uH.value.dispose(); u.uH.value = drapeTexture(); u.uHSize.value.set(u.uH.value.image.width, u.uH.value.image.height); }
  setCursor(x, y, quiet) { this.cur = x == null ? null : [x, y]; this.quiet = !!quiet; this.cursor.visible = this.marker.visible = x != null && !quiet; }   // quiet: keep the focus, hide the visuals (the target mark draws instead)
  setPath(path) {
    const m = new THREE.Matrix4(), pts = [];
    if (path) for (let i = 0; i < path.length - 1; i++) { const a = tileCenter(...path[i]), b = tileCenter(...path[i + 1]); for (let k = 0; k < 3; k++) pts.push(a.clone().lerp(b, k / 3)); }
    if (path && path.length) pts.push(tileCenter(...path[path.length - 1]));
    pts.slice(0, 40).forEach((p, i) => { m.makeTranslation(p.x, p.y + 0.12, p.z); this.dots.setMatrixAt(i, m); });
    this.dots.count = Math.min(40, pts.length); this.dots.instanceMatrix.needsUpdate = true;
  }
  // the cursor at the cell's level (levelY: a unit's feet; on a blocked cell the top of what is there, or the floor with
  // a unit or a square in it)
  update(t) {
    this.mat.uniforms.uT.value = t;
    if (this.cur) { const p = tileCenter(...this.cur); p.y = levelY(...this.cur); this.cursor.visible = !this.quiet; this.cursor.position.set(p.x, p.y + 0.02, p.z); this.cursor.scale.setScalar(1 + Math.sin(t * 5) * 0.04); const u = R.unitAt(...this.cur); this.marker.visible = !this.quiet && (!u || u !== G.active); this.marker.position.set(p.x, p.y + (u ? 1.45 : 0.55) + Math.sin(t * 3) * 0.06, p.z); this.marker.rotation.y = t * 2; }
  }
}
// the unit taking its turn: a crisp gold frame on its tile and a small pixel arrow overhead.
// Plain unlit colours below the bloom threshold, so the marker reads clearly without adding light to the scene.
// the active unit's arrow: a smooth down-pointing triangle with rounded corners, a dark rim and a bevelled face, drawn
// large (it is tinted by the side's colour, so the face is white to grey) and mip-mapped, sharp at any zoom
function arrowTex() {
  const W = 144, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tri = (inset, r) => {   // the triangle's outline, its corners rounded with radius r
    const P = [[10 + inset * 1.7, 12 + inset], [W - 10 - inset * 1.7, 12 + inset], [W / 2, H - 10 - inset * 2]];
    g.beginPath();
    for (let i = 0; i < 3; i++) { const a = P[i], b = P[(i + 1) % 3], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (i === 0) g.moveTo(m[0], m[1]); g.arcTo(b[0], b[1], (b[0] + P[(i + 2) % 3][0]) / 2, (b[1] + P[(i + 2) % 3][1]) / 2, r); }
    g.closePath();
  };
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  tri(0, 14); g.fillStyle = '#1a0f06'; g.fill();               // rim
  g.shadowColor = 'transparent';
  tri(8, 9); const f = g.createLinearGradient(0, 18, 0, H - 24); f.addColorStop(0, '#ffffff'); f.addColorStop(0.55, '#e6e6e6'); f.addColorStop(1, '#9a9a9a'); g.fillStyle = f; g.fill();   // face
  g.save(); tri(8, 9); g.clip();
  g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W / 2, H - 30); g.lineTo(28, 20); g.closePath(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();   // the lit left facet
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 20, W, 5);   // the top edge catches the light
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
class ActiveMark {
  constructor(scene) {
    // tile frame: a 1-texel outline with notched corners, drawn at 32px like the original tiles
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const g = fc.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(1, 1, 30, 30); g.clearRect(3, 3, 26, 26);
    g.fillStyle = '#fff'; g.fillRect(2, 2, 28, 1); g.fillRect(2, 29, 28, 1); g.fillRect(2, 2, 1, 28); g.fillRect(29, 2, 1, 28);
    for (const [x, y] of [[2, 2], [26, 2], [2, 26], [26, 26]]) g.fillRect(x, y, 4, 4);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 3, 26, 26);
    const ft = new THREE.CanvasTexture(fc); ft.magFilter = THREE.NearestFilter; ft.colorSpace = THREE.SRGBColorSpace;
    this.frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
    this.frame.renderOrder = 3;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex(), transparent: true, depthTest: false, toneMapped: false }));   // untoned: the side's colour stays saturated
    this.arrow.scale.set(0.3, 0.267, 1); this.arrow.renderOrder = 6;
    this.group = new THREE.Group(); this.group.add(this.frame, this.arrow); this.group.visible = false; scene.add(this.group);
  }
  update(t, a) {
    this.group.visible = !!a && a.dissolve === 0;
    if (!this.group.visible) return;
    const col = a.u.side === 'player' ? [1.0, 0.7, 0.16] : [0.95, 0.2, 0.12];
    this.frame.material.color.setRGB(...col); this.arrow.material.color.setRGB(...col, THREE.SRGBColorSpace);   // the arrow is untoned: its colour as written
    this.frame.material.opacity = 0.8 + Math.sin(t * 3) * 0.12;
    // the frame stays on the unit's tile; the arrow follows the sprite
    const p = tileCenter(a.u.x, a.u.y);
    this.frame.position.set(p.x - a.pos.x - a.off.x, p.y - a.pos.y + 0.04, p.z - a.pos.z - a.off.y); this.frame.visible = !a.walking;
    this.group.position.set(a.pos.x + a.off.x, a.pos.y, a.pos.z + a.off.y);
    this.arrow.visible = !a.act && !a.walking;
    this.arrow.position.y = 1.54 + a.hover + Math.abs(Math.sin(t * 3.2)) * 0.07;   // a soft bounce
  }
}
// target lock-on for attacks / spells: thick bracket corners (dark-outlined so they read on any ground) that snap in
// onto the tile when the target changes and then breathe, a big down-arrow over the unit and a soft pulse on its sprite.
// Unlit flat colours, like the turn marker, so nothing in the scene is lit by it.
class TargetMark {
  constructor(scene) {
    const cc = document.createElement('canvas'); cc.width = cc.height = 16; const g = cc.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 12, 5); g.fillRect(0, 0, 5, 12);
    g.fillStyle = '#fff'; g.fillRect(1, 1, 10, 3); g.fillRect(1, 1, 3, 10);
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = ct.minFilter = THREE.NearestFilter; ct.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, toneMapped: false });   // untoned: a saturated red that tone mapping would wash to salmon
    this.corners = [0, 1, 2, 3].map(i => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2), this.mat);
      m.rotation.y = -i * Math.PI / 2; m.renderOrder = 5; return m;
    });
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const f = fc.getContext('2d');
    f.fillStyle = '#fff'; f.fillRect(2, 2, 28, 28);
    const ft = new THREE.CanvasTexture(fc); ft.magFilter = THREE.NearestFilter;
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, toneMapped: false }));
    this.fill.renderOrder = 4;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex(), transparent: true, depthTest: false, toneMapped: false }));
    this.arrow.scale.set(0.42, 0.373, 1); this.arrow.renderOrder = 7;
    this.group = new THREE.Group(); this.group.add(this.fill, ...this.corners); this.group.visible = this.arrow.visible = false;
    scene.add(this.group, this.arrow);
    this.cell = null; this.t0 = 0; this.actor = null;
  }
  set(cell, col, t) {
    if (!cell) { this.cell = null; this.group.visible = this.arrow.visible = false; this.release(); return; }
    if (!this.cell || this.cell[0] !== cell[0] || this.cell[1] !== cell[1]) this.t0 = t;   // re-lock: corners snap in again
    this.cell = cell; this.col = col;
  }
  release() { if (this.actor) { this.actor.flash = 0; this.actor = null; } }
  update(t) {
    if (!this.cell) return;
    const p = tileCenter(...this.cell), k = Math.min(1, (t - this.t0) / 0.16), ease = 1 - (1 - k) * (1 - k);
    const spread = 0.25 + (1 - ease) * 0.45 + (k >= 1 ? (Math.floor(t * 3) % 2) * 0.035 : 0);   // snap in, then a two-step breathe
    this.group.visible = true; this.group.position.set(p.x, p.y + 0.075, p.z);
    this.mat.color.setRGB(...this.col); this.mat.opacity = 0.35 + 0.65 * ease;
    this.corners.forEach((m, i) => { const a = -i * Math.PI / 2; m.position.set(-spread * Math.cos(a) - spread * Math.sin(a), 0, -spread * Math.cos(a) + spread * Math.sin(a)); });
    this.fill.material.color.setRGB(...this.col); this.fill.material.opacity = 0.22 + 0.1 * Math.sin(t * 6);
    const u = R.unitAt(...this.cell), a = u && actorOf(u);
    if (a !== this.actor) { this.release(); this.actor = a || null; }
    this.arrow.visible = !!a; this.arrow.material.color.setRGB(...this.col);
    if (a) {
      this.arrow.position.set(a.pos.x, a.pos.y + 1.7 + a.hover + Math.abs(Math.sin(t * 3.2)) * 0.08 + (1 - ease) * 0.5, a.pos.z);
      a.flash = 0.12 + 0.1 * Math.sin(t * 6);   // the sprite itself pulses so the picked unit stands out
    }
  }
}
export const C = { chest: [1.0, 0.78, 0.25], move: [0.02, 0.02, 0.025], moveLite: [0.95, 0.95, 0.92], atk: [1.0, 0.22, 0.16], harm: [1.0, 0.5, 0.12], help: [0.25, 1.0, 0.45], area: [1.0, 0.9, 0.5], range: [0.55, 0.55, 0.7], danger: [0.75, 0.08, 0.05] };
export let tiles, activeMark, targetMark;

// ---------------------------------------------------------------- input
const queue = [], waiters = [];
export function push(ev) { if (waiters.length) waiters.shift()(ev); else { queue.push(ev); if (queue.length > 6) queue.shift(); } }
// hover events replace each other in the queue so a busy frame never builds a backlog (or pushes clicks out)
function pushHover(t) { const i = queue.findIndex(e => e.k === 'hover'); if (i >= 0) queue.splice(i, 1); push({ k: 'hover', t }); }
export const input = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(r => waiters.push(r));
let hoverTile = null, cursorTile = [0, 0];
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
// a unit's own pixels under the pointer [the user's report: a flier on a column top, drawn above its cell, could not be
// picked by clicking it]: the sprite planes hit, the picture's alpha read at the hit (its frame, mirrored or not); the
// nearest opaque one wins. Its transparent margin does not count, so the squares round a unit stay easy to click.
const ALPHA = new WeakMap();
function opaqueAt(tex, uv) {
  const img = tex && tex.image; if (!img || !img.width) return false;
  let A = ALPHA.get(img); if (!A) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); A = g.getImageData(0, 0, c.width, c.height); ALPHA.set(img, A); }
  const u = tex.offset.x + uv.x * tex.repeat.x, v = tex.offset.y + uv.y * tex.repeat.y;
  const px = Math.floor(u * A.width), py = Math.floor((1 - v) * A.height);
  return px >= 0 && py >= 0 && px < A.width && py < A.height && A.data[(py * A.width + px) * 4 + 3] > 96;
}
function unitUnder() {
  const ms = []; for (const a of actors.values()) { const u = a.u; if (!u.alive || u.away || !a.root.visible || (a.fade ?? 1) < 0.5 || !R.inMap(u.x, u.y)) continue; const m = a.big.visible ? a.big : a.mesh; m.userData.actor = a; ms.push(m); }
  for (const h of ray.intersectObjects(ms, false)) if (h.uv && opaqueAt(h.object.material.map, h.uv)) return h.object.userData.actor.u;
  return null;
}
function pick(ev) {
  const r = world.renderer.domElement.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, world.camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -1e-4) return null;
  const who = unitUnder(); if (who) return [who.x, who.y];   // a unit's body first, wherever its cell's square is drawn
  return rayCells(o, d, squareAt) || rayCells(o, d, levelAt);
}
// the cells under a ray in order from the camera, each asked where the ray comes down through it (hit(x, y, ta, tb,
// o, d): ta, tb the ray's span over the cell); the first answer, else null
function rayCells(o, d, hit) {
  const W = R.MAP_W, H = R.MAP_H; let t0 = 0, t1 = Infinity;
  for (const [a, b, n] of [[o.x, d.x, W], [o.z, d.z, H]]) {   // the ray's span over the map
    if (Math.abs(b) < 1e-9) { if (a < 0 || a > n) return null; continue; }
    const p = -a / b, q = (n - a) / b; t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
  }
  if (t0 >= t1) return null;
  if (hit.start) hit.start();
  const sx = Math.sign(d.x), sz = Math.sign(d.z), dx = Math.abs(1 / d.x), dz = Math.abs(1 / d.z);
  let x = Math.min(W - 1, Math.max(0, Math.floor(o.x + d.x * t0))), y = Math.min(H - 1, Math.max(0, Math.floor(o.z + d.z * t0))), t = t0;
  let tx = sx ? ((sx > 0 ? x + 1 : x) - o.x) / d.x : Infinity, tz = sz ? ((sz > 0 ? y + 1 : y) - o.z) / d.z : Infinity;
  while (t < t1 && R.inMap(x, y)) {
    const t2 = Math.min(tx, tz, t1), r = hit(x, y, t, t2, o, d); if (r) return r;
    if (tx < tz) { x += sx; t = tx; tx += dx; } else { y += sz; t = tz; tz += dz; }
  }
  return hit.last ? hit.last() : null;
}
// a shown square, as it is drawn [the user's report: a square on another level could not be clicked; three's raycast
// of the squares kept the bounding sphere of its first use, made with none shown: empty, so no click met a square]: one
// laid over the ground (aDrape) where the ray comes down through the ground in the cell (24 steps over it: at 6 a ray
// onto a wall's top inside the cell crossed the ground between two of them, battle 16), a flat one (a roof's, a
// flier's) through its height
function squareAt(x, y, ta, tb, o, d) {
  const i = tiles && tiles.mesh.count && tiles.at ? tiles.at.get(y * R.MAP_W + x) : undefined; if (i == null) return null;
  if (tiles.drape.array[i] > 0.5) {
    let prev = null; for (let k = 0; k <= 24; k++) { const t = ta + (tb - ta) * k / 24, px = o.x + d.x * t, pz = o.z + d.z * t, f = o.y + d.y * t - groundH(px, pz) - 0.05;
      if (f <= 0 && prev != null && prev >= 0) return [x, y]; prev = f; }
    return null;
  }
  const h = tiles.mesh.instanceMatrix.array[i * 16 + 13];
  return o.y + d.y * ta >= h && o.y + d.y * tb <= h ? [x, y] : null;
}
// no square under the pointer: the first cell whose level (levelY: where the cursor sits) the ray comes down through
// [the user's report: the ground followed instead (four steps of groundH) landed on the wrong cell across a step between
// two levels]. A ray that goes in under a cell's level (a wall's face) carries on to the cells behind; none crossed: the
// first it went in under.
let under = null;   // (levelAt: the first cell the ray went in under)
function levelAt(x, y, ta, tb, o, d) {
  const L = levelY(x, y), ya = o.y + d.y * ta;
  if (ya >= L && o.y + d.y * tb <= L) return [x, y];
  if (ya < L && !under) under = [x, y];
  return null;
}
levelAt.start = () => { under = null; }; levelAt.last = () => under;
let drag = null;
export function setupInput() {
  const cv = world.renderer.domElement;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { if (e.button === 2 || e.button === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, b: e.button }; });
  window.addEventListener('pointermove', e => {
    if (drag) { const dx = e.clientX - drag.x; drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
    const t = pick(e); if (t && (!hoverTile || t[0] !== hoverTile[0] || t[1] !== hoverTile[1])) { hoverTile = t; cursorTile = t; pushHover(t); }
  });
  window.addEventListener('pointerup', e => {
    if (drag && e.button === drag.b) { if (drag.moved <= 6 && e.button === 2) push({ k: 'B' }); drag = null; return; }
    if (e.button === 0 && e.target === cv) { const t = pick(e); if (t) push({ k: 'click', t }); else push({ k: 'clickoff' }); }
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === ' ') { timeScale = 3; e.preventDefault(); return; }
    if (k === 'Tab') { e.preventDefault(); return push({ k: 'TAB' }); }
    if (k === 'Enter' || k === 'z' || k === 'Z') { ui.advance(); return push({ k: 'A' }); }
    if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') return push({ k: 'B' });
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
    if (dir) {
      e.preventDefault();
      // screen-relative: rotate the key direction by the camera yaw, snapped to the grid
      const yaw = Math.round(cam.yaw / (Math.PI / 2)) * (Math.PI / 2), c = Math.cos(yaw), s = Math.sin(yaw);
      const gx = Math.round(dir[0] * c + dir[1] * s), gy = Math.round(-dir[0] * s + dir[1] * c);
      push({ k: 'DIR', d: [gx, gy], raw: k });
    }
  });
  window.addEventListener('keyup', e => { if (e.key === ' ') timeScale = 1; });
  document.addEventListener('click', () => ui && ui.advance());
}

// ---------------------------------------------------------------- presentation helpers
export function syncActors() {
  for (const [u, a] of actors) if (!G.units.includes(u)) { a.dispose(world.scene); actors.delete(u); }
  for (const u of G.units) if (!actors.has(u)) {
    const a = new Actor(bank, u, world.scene); actors.set(u, a); if (!u.alive) a.dissolve = 1;
    if (isFlier(u)) { a.pos.copy(standAt(u, u.x, u.y)); a.over = true; for (const m of [a.mesh, a.big]) { m.material.depthTest = false; m.renderOrder = 6.5; } }   // a flier is drawn over the scenery: nothing on the ground hides it, flames and see-through leaves neither (tools/qa/fliers.js)
  }
}
// a unit given another graphic by its battle's hook (battle 27's 通天教主 back in his true shape, 0x0FA93C): the sheet
// loaded, its actor made again where it stands
export async function reskin(u, key) {
  await bank.load([key]);
  const old = actors.get(u), at = old && old.pos.clone(); if (old) { old.dispose(world.scene); actors.delete(u); }
  u.sprite = key; syncActors();
  const a = actors.get(u); if (at) a.pos.copy(at);
  return a;
}
// a unit joining mid-battle (a hero, battle 4's 楊戩; or the enemy's reinforcements, battle 7's): the camera goes to where
// it appears, and it comes in (the battle's own entrance, FX.join, or a fade); it acts from the next round, as the round's
// turn order is already set
async function joinHeroes(list) {
  syncActors();
  for (const v of list) { const a = actorOf(v); placeActor(a); a.fade = 0; a.dissolve = 0; }   // (dissolve: one who fell and comes back, battle 14's revival)   // the whole wave hidden until each comes in (else the rest showed, vanished and faded in: the user's report)
  for (const v of list) {
    const a = actorOf(v);
    cam.release(); cam.focus(a.pos); await wait(450);
    if (FX.join) await FX.join(E, v); else for (let k = 1; k <= 20; k++) { a.fade = k / 20; await wait(30); }
    a.fade = 1;
  }
}
// a battle in rooms (src/rules.js enterRoom): the screen goes dark, the world is built again for the room the party has
// entered (the battle's look, FX.look, reads G.room), the units are put on their cells, the camera on the heroes; then
// it comes up again [the ROM fades out and in, 0x1D5B8 / 0x1D8A0]
export async function enterRoom(k, back) {
  const f = $('fade'); f.style.transition = 'opacity 0.3s'; f.style.opacity = 1; await wait(320);
  R.enterRoom(k, back);
  ready = false;
  for (const a of actors.values()) a.dispose(world.scene);
  actors.clear(); ui.clearUnits(); world.reset();
  setLook(FX.look || { mapSD: roomArt(k) });
  await world.build(() => {}); resize();
  vfx = new VFX(world); tiles = new Tiles(world.scene); activeMark = new ActiveMark(world.scene); targetMark = new TargetMark(world.scene);
  if (FX.look && FX.look.set) await dress(E, FX.look.set);
  measureLight();
  Object.assign(window.__remake, { tiles, vfx, world, W: world });
  await bank.load([...new Set(G.units.map(u => u.sprite))]);
  syncActors(); for (const a of actors.values()) { placeActor(a); a.dissolve = a.u.alive ? 0 : 1; }
  if (FX.room) FX.room(E, k);
  ready = true;
  const lead = R.players()[0]; if (lead) { cam.release(tileCenter(lead.x, lead.y)); cam.snap(); }
  hudRound();
  f.style.transition = 'opacity 0.4s'; f.style.opacity = 0; await wait(400);
}
const roomArt = k => 'assets/battles/' + String(D.n).padStart(2, '0') + (k ? '/room-' + k : '/map') + '.png';
// where a unit stands on a cell: the ground; a flier (a move type that may enter terrain 2) stands on whatever is there
// instead, a roof, a wall or a cliff (battle 9's 雷震子 was drawn inside the temple hall, hidden under its roof)
export const isFlier = u => { const c = D.costs && D.costs[u.moveType]; return !!(c && c[2] < 127); };
// where a unit stands on a cell: its ground; a flier over a blocked cell on the floor level round it (floorY: what is there
// fades, OBSTRUCT), or where none is near on top of what is there
export const standAt = (u, x, y) => { const p = tileCenter(x, y); if (isFlier(u)) { const f = blocked(x, y) ? floorY(x, y) : null; p.y = f != null ? f : Math.max(p.y, surfaceY(x, y), blocked(x, y) ? groundTop(x, y) : -99);
  // nor over the void far below the play where no floor is within three cells (behind 西岐's hall wall, battle 28's 飛兵 at
  // (20,2) stood 1.6 under the floor: the camera dived after it): the nearest floor's level
  if (f == null && blocked(x, y)) { const n = nearFloor(x, y); if (n != null && p.y < n - 1) p.y = n; } } return p; };
const NEAR = new Map();
function nearFloor(x, y) {
  const k = x + ',' + y; if (NEAR.has(k)) return NEAR.get(k);
  let best = null;
  for (let r = 1; r <= Math.max(R.MAP_W, R.MAP_H) && best == null; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x + dx, ny = y + dy;
    if (R.inMap(nx, ny) && !blocked(nx, ny) && G.terrain[ny][nx] === 0 && openReach().has(nx + ',' + ny)) best = Math.max(best ?? -99, tileY(nx, ny));
  }
  NEAR.set(k, best); return best;
}
// the blocked cells holding someone, a square or a walker's route ahead: their scenery fades above the unit's feet (CUT_GLSL), and comes back once they leave
const OBSTRUCT = { fade: null, W: 0, H: 0 };
function obstruct(dt) {
  const W = R.MAP_W, H = R.MAP_H; if (!W || !H) return;
  if (!RU.uCutCell.value || OBSTRUCT.W !== W || OBSTRUCT.H !== H || RU.uRangeSize.value.x !== W) {
    if (RU.uCutCell.value) RU.uCutCell.value.dispose();
    RU.uCutCell.value = new THREE.DataTexture(new Float32Array(W * H * 4), W, H, THREE.RGBAFormat, THREE.FloatType); RU.uCutCell.value.magFilter = RU.uCutCell.value.minFilter = THREE.NearestFilter;
    RU.uRangeSize.value.set(W, H); OBSTRUCT.fade = new Float32Array(W * H); OBSTRUCT.W = W; OBSTRUCT.H = H;
  }
  const want = new Set();
  for (const a of actors.values()) { if (!a.u.alive || !a.root.visible) continue; const x = Math.floor(a.pos.x + a.off.x), y = Math.floor(a.pos.z + a.off.y); if (R.inMap(x, y) && blocked(x, y) && floorY(x, y) != null) want.add(y * W + x); }
  if (tiles && tiles.mesh.visible && tiles.mesh.count) for (const i of tiles.sunk) want.add(i);   // (a square shown on it: Tiles.set)
  // a unit walking: the cells of its route still ahead (the squares just cleared: the column it is headed for does not come
  // back only to fade again as it lands)
  for (const a of actors.values()) if (a.walking && a.route) { const x = Math.floor(a.pos.x), y = Math.floor(a.pos.z), at = a.route.findIndex(([px, py]) => px === x && py === y);
    for (const [px, py] of a.route.slice(Math.max(0, at))) if (R.inMap(px, py) && blocked(px, py) && floorY(px, py) != null) want.add(py * W + px); }
  const d = RU.uCutCell.value.image.data, F = OBSTRUCT.fade; let on = 0, changed = false;
  for (let i = 0; i < W * H; i++) {
    const t = want.has(i) ? 1 : 0; if (F[i] === t) { if (t) on = 1; continue; }
    F[i] = t > F[i] ? Math.min(1, F[i] + dt * 4) : Math.max(0, F[i] - dt * 4); changed = true; if (F[i] > 0) on = 1;
    const x = i % W, y = (i / W) | 0; d[i * 4] = floorY(x, y) ?? 0; d[i * 4 + 1] = F[i];
  }
  if (changed) RU.uCutCell.value.needsUpdate = true;
  RU.uCutOn.value = on;
}
export function placeActor(a) { a.pos.copy(standAt(a.u, a.u.x, a.u.y)); a.off.set(0, 0); }
// the top of whatever stands on a cell: rays straight down at five points of it through the set's solid pieces (not
// grass or leaf cards, effects, sprites, the tiles, a sky dome); the highest hit within 6 of the ground, or the ground.
// Cached until the set or the room changes (measureLight resets it).
let SURF = null; const _down = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
function surfaceY(x, y) {
  if (!SURF) {
    const skip = new Set(); for (const a of actors.values()) a.root.traverse(o => skip.add(o));
    for (const o of [tiles && tiles.mesh, tiles && tiles.cursor, tiles && tiles.marker, tiles && tiles.dots]) if (o) skip.add(o);
    const solid = []; world.scene.traverseVisible(o => {
      const m = o.material; if (!o.isMesh || skip.has(o) || !m || Array.isArray(m)) return;
      if (m.blending === THREE.AdditiveBlending || (m.transparent && !m.depthWrite) || m.side === THREE.BackSide || (o.isInstancedMesh && m.alphaTest > 0)) return;
      solid.push(o);
    });
    SURF = { solid, cells: new Map(), idx: downIndex(solid, downArea()) };
  }
  const k = x + ',' + y; if (SURF.cells.has(k)) return SURF.cells.get(k);
  const g = groundH(x + 0.5, y + 0.5); let h = g;
  for (const [dx, dz] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    const hit = SURF.idx.cast(x + dx, y + dz, g + 6)[0]; if (hit) h = Math.max(h, hit.y);
  }
  SURF.cells.set(k, h); return h;
}
const FV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// a walk along the path: corners rounded (a quarter curve through each turn), a short speed-up and slow-down at the ends,
// the facing taken from the direction of travel. No hop per cell: the walk cycle carries the step.
const STEP = 0.15, RAMP = 0.09;   // seconds per cell at full pace; seconds to reach it / to stop
export async function walkActor(u, path) {
  const a = actorOf(u); if (path.length < 2) return;
  const P = path.map(c => standAt(u, ...c)), pts = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1], B = P[i], C = P[i + 1], turn = (B.x - A.x) * (C.z - B.z) - (B.z - A.z) * (C.x - B.x);
    if (Math.abs(turn) < 1e-6) { pts.push(B); continue; }
    const s0 = B.clone().lerp(A, 0.35), s1 = B.clone().lerp(C, 0.35);
    for (let j = 0; j <= 6; j++) { const t = j / 6, q = s0.clone().multiplyScalar((1 - t) * (1 - t)).add(B.clone().multiplyScalar(2 * t * (1 - t))).add(s1.clone().multiplyScalar(t * t)); pts.push(q); }
  }
  pts.push(P[P.length - 1]);
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const total = L[L.length - 1], T = (path.length - 1) * STEP + RAMP, r = Math.min(0.4, RAMP / T), vmax = 1 / (1 - r);
  const dist = k => k < r ? vmax * k * k / (2 * r) : k > 1 - r ? 1 - vmax * (1 - k) * (1 - k) / (2 * r) : vmax * (k - r / 2);   // trapezoid speed
  a.walking = true; a.route = path; let seg = 1;   // (route: what stands on the cells still ahead stays faded, OBSTRUCT)
  await anim(T, k => {
    const d = Math.min(total, Math.max(0, dist(k)) * total);
    while (seg < pts.length - 1 && L[seg] < d) seg++;
    const A = pts[seg - 1], B = pts[seg], f = L[seg] > L[seg - 1] ? (d - L[seg - 1]) / (L[seg] - L[seg - 1]) : 1;
    a.pos.copy(A).lerp(B, f);
    const dx = B.x - A.x, dz = B.z - A.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) u.facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
    cam.focus(a.pos);
  });
  a.walking = false; a.route = null; [u.x, u.y] = path[path.length - 1]; placeActor(a);
}
export let canvasRect = { width: 1, height: 1, left: 0, top: 0 };
const _pv = new THREE.Vector3();
export function project(p) { const v = _pv.copy(p).project(world.camera), r = canvasRect; return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, z: v.z }; }
export function flinch(a, power) {
  a.flash = 1;
  const d = a.pos.clone().sub(world.camera.position).setY(0).normalize().multiplyScalar(0.12 * power);
  anim(0.35, k => { a.off.set(d.x * Math.sin(k * Math.PI) * (1 - k) * 3, d.z * Math.sin(k * Math.PI) * (1 - k) * 3); a.flash = Math.max(0, 1 - k * 2.2); }).then(() => { a.off.set(0, 0); a.flash = 0; });
}
export function showResult(t, r) {
  const a = actorOf(t), p = a.head().add(V(0, 0.15, 0));
  if (!r) return;
  if (r.immune) ui.floater(p, "無效", "dmg text", 1.4);
  else if (r.dmg !== undefined) { ui.floater(p, String(r.dmg), 'dmg' + (t.side === 'player' ? ' ally' : ''), 1.4); flinch(a, 1.4); }   // no blow's sound: a spell or item plays its own
  else if (r.heal !== undefined) { ui.floater(p, '+' + r.heal, 'dmg heal', 1.4); a.flash = 0.5; anim(0.6, k => { a.flash = 0.5 * (1 - k); }); }
  else if (r.text && r.text.startsWith('法力')) ui.floater(p, r.text, 'dmg heal', 1.4);
  else if (r.resist) ui.floater(p, '失效', 'dmg text', 1.4);   // [ROM 0x322AC: 「失效」 floats off a target the cast missed]
  else if (r.status) ui.floater(p, GLYPH[r.status], 'dmg status ' + r.status, 1.4);   // (other words, 攻防↓ and the like, are not shown)
}
// a hero falls, as the original plays it [ROM 0x1091A, recorded frame by frame in the harness: 515 frames]: the spin
// (0x103E8, no cry), then the hero kneels in its death pose (action blob 9, loaded to VRAM 0x5A0) while the whole map
// fades to black round it (frames 72-120); the lament starts (0x10A16); a thin beam of white light comes down onto it
// (136-184) and opens into a pillar; the hero's spirit, a pale copy of the kneeling pose, rises up the pillar (250-416)
// while rows of cyan stars stream down the black; the pillar narrows to a line and goes, the body with it (416-448); the
// map fades back in without the hero (452-512) [the user's call: the original's longer fall, not a short blink]. Built
// as light: a soft glowing pillar with streaks flowing up, a glowing spirit, four-point star glints, on a black
// backdrop drawn over the scenery (the hero, the pillar and the spirit over it)
// @qa job:hud job:sounds   (shows only in a hero's fall: allyDeath; tools/qa/scope.mjs)
const DIE_TEX = new Map();
export function dieTex(gfx) {   // the death pose's HD frame (assets/units/die/hd, the extractor's), on the 256 px canvas a tex act takes
  if (!DIE_TEX.has(gfx)) DIE_TEX.set(gfx, new Promise(res => {
    const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(img, 64, 64, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; res(t); };
    img.onerror = () => res(null); img.src = 'assets/units/die/hd/' + gfx.toString(16).padStart(6, '0') + '.png';
  }));
  return DIE_TEX.get(gfx);
}
// @qa job:hud job:sounds   (shows only in a hero's fall: allyDeath; tools/qa/scope.mjs)
const STAR_FS = `uniform float uA, uStars, uT, uAsp; varying vec2 vUv;
  float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
  void main(){
    vec2 p = vec2(vUv.x * uAsp, vUv.y); vec3 col = vec3(0.0); float glow = 0.0;
    // rows of star glints falling down the screen: a row every 0.2 of its height, each with its own stars
    float sy = p.y + uT * 0.22, row = floor(sy / 0.2), fy = fract(sy / 0.2) * 0.2 - 0.1;
    for (int k = 0; k < 9; k++) {
      float sx = (float(k) + 0.15 + 0.7 * h(row * 9.1 + float(k))) / 9.0 * uAsp, d = h(row * 3.7 + float(k) * 1.3);
      vec2 q = vec2(p.x - sx, fy + (d - 0.5) * 0.02); float s = mix(0.006, 0.014, d) * (0.75 + 0.25 * sin(uT * 6.0 + d * 30.0));
      float arms = max(exp(-abs(q.y) / (s * 0.12)) * exp(-abs(q.x) / (s * 1.6)), exp(-abs(q.x) / (s * 0.12)) * exp(-abs(q.y) / (s * 1.6)));   // a four-point glint
      glow += exp(-length(q) / (s * 0.35)) * 1.4 + arms;
    }
    col = mix(vec3(0.35, 0.75, 1.0), vec3(0.9, 1.0, 1.0), clamp(glow - 0.5, 0.0, 1.0)) * glow * uStars;
    gl_FragColor = vec4(col, max(uA, clamp(glow * uStars, 0.0, 1.0)));
  }`;
// @qa job:hud job:sounds   (shows only in a hero's fall: allyDeath; tools/qa/scope.mjs)
const BEAM_FS = `uniform float uA, uTip, uT; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
    if (y < 1.0 - uTip) discard;                                                    // coming down from the top
    float core = 1.0 - smoothstep(0.0, 0.75, x), edge = 1.0 - smoothstep(0.6, 1.0, x);
    float streak = n(vec2(vUv.x * 14.0, y * 3.0 - uT * 1.6)) * 0.35 + n(vec2(vUv.x * 30.0, y * 7.0 - uT * 3.0)) * 0.15;
    float a = (edge * (0.55 + streak) + core * 0.6) * smoothstep(0.0, 0.02, y) * uA;
    vec3 col = mix(vec3(0.62, 0.8, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(col * a, a);
  }`;
// @qa job:hud job:sounds   (a hero's fall: tools/qa/hud.js checks it; it runs once a job, which best-effort coverage misses)
export async function allyDeath(u) {
  const own = !opts.classicfall && deathOf(u); if (own) return own(u);   // each hero's and guest's own fall (src/deaths.js); #...&classicfall: the original's
  const a = actorOf(u), P = a.pos.clone(), face = u.facing, S = world.scene, cm = world.camera, hudOn = !document.getElementById('hud').classList.contains('hidden');
  cam.shot(P.clone().setY(P.y + 0.6), { speed: 3 });
  const pose = dieTex(u.gfx || (D.heroes && D.heroes[u.cid] ? D.heroes[u.cid].gfx : 0));   // (a battle's units keep no graphic address: the hero table's)
  await deathSpin(u, false, 3);   // [ROM 0x1091A calls the enemy's 0x103E8: the same spin, but a hero (slot 0-9) does not cry out; three rounds here, not one: the user's call]
  sfx(SND.burst);   // [ROM 0x10506, for every unit]
  const tx = await pose; u.facing = 'down'; if (tx) a.act = { kind: 'tex', tex: tx };
  // the backdrop over the scenery, and the hero over it
  const quad = (fs, u0) => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: u0, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: fs }));
  const back = quad(STAR_FS, { uA: { value: 0 }, uStars: { value: 0 }, uT: { value: 0 }, uAsp: { value: 1 } }); back.renderOrder = 7; back.frustumCulled = false;
  const beam = quad(BEAM_FS, { uA: { value: 0 }, uTip: { value: 0 }, uT: { value: 0 } }); beam.renderOrder = 7.5; beam.frustumCulled = false;
  beam.material.blending = THREE.CustomBlending; beam.material.blendSrc = THREE.OneFactor; beam.material.blendDst = THREE.OneMinusSrcAlphaFactor; beam.geometry.translate(0, 0.5, 0);
  const spirit = new THREE.Mesh(a.big.geometry.clone(), new THREE.MeshBasicMaterial({ map: tx || a.mesh.material.map, color: new THREE.Color(0.7, 0.82, 1.15), transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));   // (the original's pale copy, seen over the white)
  spirit.renderOrder = 9; spirit.visible = false;
  S.add(back, beam, spirit);
  // (over: into the transparent pass, after the backdrop, as a flier is: the opaque pass draws before any transparent one)
  const kept = [a.mesh, a.big].map(m => [m, m.material.depthTest, m.renderOrder]), wasOver = a.over;
  a.over = true; for (const m of [a.mesh, a.big]) { m.material.depthTest = false; m.renderOrder = 8; }
  const marks = [activeMark && activeMark.group, targetMark && targetMark.group].filter(Boolean).map(g => [g, g.visible]);
  const W0 = 1.15, HB = 14;   // the pillar's width (a little wider than the body) and its length up the screen
  const up = new THREE.Vector3();   // the screen's up, in the world: the pillar and the spirit rise along it
  const tick = (dt, t) => {
    const d = new THREE.Vector3(); cm.getWorldDirection(d);
    back.position.copy(cm.position).addScaledVector(d, 1); back.quaternion.copy(cm.quaternion);
    const hh = 2 * Math.tan(cm.fov * Math.PI / 360) * 1.02; back.scale.set(hh * cm.aspect, hh, 1); back.material.uniforms.uAsp.value = cm.aspect; back.material.uniforms.uT.value = t;
    // the pillar lies parallel to the screen, rising from the hero's feet up it: as wide at the top as at the foot (an
    // upright sheet seen from above widened toward the camera, the user's report)
    // (its foot below the hero's: the hero kneels up in the light, the user's call)
    up.set(0, 1, 0).applyQuaternion(cm.quaternion); beam.position.set(P.x, P.y, P.z).addScaledVector(up, -0.9); beam.quaternion.copy(cm.quaternion); beam.material.uniforms.uT.value = t;
    spirit.rotation.copy(a.big.rotation); spirit.scale.copy(a.big.scale);
  };
  world.updaters.push(tick);
  try {
    if (hudOn) ui.show('hud', false); for (const [g] of marks) g.visible = false;
    await wait(800);                                                       // kneeling (to frame 72)
    await anim(0.8, k => { back.material.uniforms.uA.value = k; a.size = 1 + 0.2 * k * k * (3 - 2 * k); });   // the map fades to black round the hero (72-120), who grows a fifth (1.5 was too much) [the user's call]
    jingle(0x0a);                                                          // the lament [0x10A16]
    // with only the hero to see, the view slides so the hero kneels low on the screen, the pillar's length above it, as in
    // the original (a pan: the player's zoom kept [the user's call]); it comes back while the screen is still black
    { const f = new THREE.Vector3(); cm.getWorldDirection(f); f.y = 0; f.normalize();
      const d = 0.47 * cam.user.dist * Math.tan(cm.fov * Math.PI / 360) / Math.sin(cam.user.pitch);   // (the pillar's foot, below the hero, kept on the screen)
      cam.shot(P.clone().setY(P.y + 0.6).addScaledVector(f, d), { speed: 2.5 }); }
    await wait(270);
    beam.material.uniforms.uA.value = 1; beam.scale.set(0.05, HB, 1);
    await anim(0.8, k => { beam.material.uniforms.uTip.value = k; });       // a thin line of light comes down onto it (136-184)
    vfx.light(P.clone().setY(P.y + 1), [0.7, 0.85, 1], 10, 0.6, 5);
    await anim(0.27, k => { beam.scale.x = 0.05 + (W0 - 0.05) * (1 - (1 - k) * (1 - k)); });   // and opens into a pillar
    await wait(880);
    spirit.visible = true;
    await anim(2.77, k => {                                                // the spirit rises up the pillar (250-416), the stars stream down
      back.material.uniforms.uStars.value = Math.min(1, k * 4);
      spirit.position.copy(a.big.position).addScaledVector(up, k * 7); spirit.material.opacity = Math.min(1, k * 5) * (1 - Math.max(0, k - 0.8) / 0.2) * 0.85;
    });
    spirit.visible = false;
    await anim(0.53, k => {                                                // the pillar narrows to a line and goes, the body with it (416-448)
      beam.scale.x = Math.max(0.02, W0 * (1 - k)); a.fade = Math.max(0, 1 - k * 1.4); if (k > 0.85) beam.material.uniforms.uA.value = (1 - k) / 0.15;   // (a quiet fade, not a demon's ember dissolve)
    });
    beam.visible = false; a.hidden = true;
    cam.shot(P.clone().setY(P.y + 0.6), { speed: 3 }); cam.snap(); await wait(70);
    await anim(1.0, k => { back.material.uniforms.uA.value = 1 - k; back.material.uniforms.uStars.value = 1 - k; });   // the map again (452-512)
  } finally {
    world.updaters.splice(world.updaters.indexOf(tick), 1);
    for (const o of [back, beam, spirit]) { S.remove(o); o.geometry.dispose(); o.material.dispose(); }
    a.over = wasOver; for (const [m, dt, ro] of kept) { m.material.depthTest = dt; m.renderOrder = ro; }
    for (const [g, v] of marks) g.visible = v;
    if (hudOn) ui.show('hud', true);
    a.act = null; a.hidden = false; a.fade = 1; a.dissolve = 1; a.size = 1; u.facing = face; cam.release();
  }
}
// a unit falls [ROM 0x103E8 -> 0x1105A]: it spins once on the spot, its facing set down, right, up, left and down again,
// 5 frames each, then the original puffs it away (a 5-frame cloud, 0x560-0x5A0). Here the demon's body breaks apart
// into dark miasma and embers that burn upward after the spin, leaving a scorch on the ground
// the battle's sound effects, the ROM's own [the attack routine 0x0E93A: a melee blow plays only the impact (0x0EC9C); the
// bow path (move type 1, from 0x0F098) adds the arrow's whoosh (0x0F228) before the same impact; the death 0x103E8]
const SND = { arrow: 0x8081, hit: 0x8089, cry: 0x805d, burst: 0x806f, found: 0x8061, levelUp: 'levelup' };   // levelUp: 星落鈴音, falling-star chimes made for the remake (tools/audio/levelup.py; the user's pick of five) instead of the original's 0x805A
export async function deathSpin(u, cry = true, rounds = 1) {
  const a = actorOf(u); a.act = null; a.off.set(0, 0); if (cry) sfx(SND.cry);   // the death cry as the spin begins [ROM 0x1040E: only for a unit past slot 9, an enemy]
  for (let r = 0; r < rounds; r++) for (const f of ['down', 'right', 'up', 'left']) { u.facing = f; await wait(1000 * 5 / 60); }
  u.facing = 'down'; await wait(1000 * 5 / 60);
}
// a fall starts DEATH_GAP seconds after the blow that caused it, whatever dealt it [the user's call: a bow's kill fell
// 0.3 s after the arrow, a sword's 1.3 s, a spell's 0.8-1.4 s; all now wait as the slowest, 1.4 s]
const DEATH_GAP = 1.4;
export async function killAnim(u) {
  if (u.hitT != null) { const left = DEATH_GAP - (gameT - u.hitT); u.hitT = null; if (left > 0) await wait(left * 1000); }
  if (u.side === 'player' || u.side === 'npc') return allyDeath(u);   // (a guest the heroes protect falls as a hero does: 文王, battle 13's bound 姜子牙)
  const a = actorOf(u), P = a.pos.clone();
  await deathSpin(u);
  a.flash = 0.6; a.off.set(0, 0); sfx(SND.burst);   // and the burst as the body goes [ROM 0x10506]
  const c = a.chest();
  // a yellow explosion [the user's call; was dark miasma]: a fireball tinted gold, white-hot to gold sparks, a gold ring,
  // the ground lit under it, grey smoke after (quick: the burst about half as long, the user's earlier call)
  const X = 1.25;   // 25% bigger than first made [the user's call]
  vfx.light(c, [1, 0.85, 0.35], 14, 0.5, 6 * X);
  vfx.decal(P, [1, 0.7, 0.2], 0.7 * X, 0.8, { intensity: 0.5 });
  vfx.ring(P, [1, 0.88, 0.4], 1.3 * X, 0.3, { intensity: 0.7 });
  vfx.explode(c, 0.6 * X, { n: 22, tint: [1.45, 1.6, 0.45], smokeTint: [0.26, 0.23, 0.2] });
  vfx.burst(c, { n: 6, speed: 1.4 * X, col: [1, 0.88, 0.35], size: 0.5 * X, life: 0.35, g: 0, shape: 0, up: 0.1 });   // the flash at its heart
  vfx.burst(c, { n: 40, speed: 4 * X, cols: [[1, 1, 0.8], [1, 0.9, 0.35], [1, 0.7, 0.15]], size: 0.05 * X, life: 0.6, g: 5, flicker: 1 });
  await anim(0.55, k => {
    a.dissolve = k; a.flash = 0.6 * (1 - k);
    for (let i = 0; i < 2; i++) vfx.spark(c.x + rand(-0.35, 0.35) * X, c.y + rand(-0.45, 0.5) * X, c.z + rand(-0.3, 0.3) * X, { vy: rand(1.4, 3) * X, vx: rand(-0.4, 0.4), life: rand(0.35, 0.7), size: rand(0.03, 0.06), r: 1, gg: rand(0.75, 0.95), b: rand(0.2, 0.45), shape: 1, flicker: 1, ph: rand(0, 9) });
  });
  a.dissolve = 1; a.act = null; a.flash = 0;
}
// bow users (attack type 2 in the ROM: 燕蓉, 黃飛虎, 鐵弓手): nock, draw, loose; the arrow flies to the target
export function landHit(au, du, d, r) {
  const hp = d.chest();
  sfx(SND.hit, r.miss ? { vol: 0.4, rate: 1.35 } : {});   // the strike [ROM 0x0EC9C], played before the roll is read: a miss sounds it too (a forced miss logs 0x8089), here lighter: quieter and higher [the user's call]
  if (r.miss) { ui.floater(d.head(), '閃避', 'dmg miss', 1.4); vfx.burst(hp, { n: 10, speed: 2, col: [0.8, 0.9, 1], size: 0.04, life: 0.4 }); return; }
  if (r.crit) vfx.impact(hp, [1, 0.85, 0.6], 0.9);
  else { vfx.burst(hp, { n: 8, speed: 2.2, col: [1, 0.9, 0.7], size: 0.04, life: 0.35, g: 4 }); vfx.shake(0.04, 0.12); }
  if (du.stand) return;   // empty tile: sparks only
  ui.floater(d.head().add(V(0, 0.15, 0)), String(r.dmg), 'dmg' + (r.crit ? ' crit' : '') + (du.side === 'player' ? ' ally' : ''), 1.4);
  d.flash = 1; anim(0.3, kk => { d.flash = 1 - kk; });
}
// a unit's attack type [its record's +0x2B]: 2 shoots a bow
export const atkTypeOf = u => u.atkType ?? (AD.act[u.sprite] ? AD.act[u.sprite].type : (((globalThis.ACTIONS || {}).sheets || {})[u.sprite] || [])[0]);
export async function bowAnim(au, du, r, onHit) {
  const a = actorOf(au), d = actorOf(du), A = AD.attack, fv = FV[au.facing];
  if (r.crit) { vfx.screen.barsTarget = 0.6; await wait(250); }
  du.facing = { down: 'up', up: 'down', left: 'right', right: 'left' }[au.facing];
  // nock (frame 0) -> full draw (frame 1), with a slight lean back
  await anim(0.42, k => { a.act = { kind: 'atk', frame: k < 0.35 ? 0 : 1 }; const b = -Math.min(1, k * 2) * 0.06; a.off.set(fv[0] * b, fv[1] * b); });
  // loose (frame 2): the arrow leaves from the bow hand
  a.act = { kind: 'atk', frame: 2 }; a.off.set(0, 0); sfx(SND.arrow);   // the arrow's whoosh [ROM 0x0F228, the bow path only]
  const from = a.chest().add(V(fv[0] * 0.35, 0.05, fv[1] * 0.35)), to = d.chest(), dir = to.clone().sub(from), len = dir.length(); dir.normalize();
  const ar = arrowMesh(r.crit ? [1, 0.7, 0.3] : [1, 0.9, 0.7], 0.5); ar.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  const rib = vfx.ribbon({ col: [1, 0.95, 0.85], width: 0.025, n: 10 });
  const fly = 0.1 + len * 0.045, arc = Math.min(0.5, len * 0.08);
  vfx.timed(ar, fly, k => { ar.position.copy(from).lerp(to, k); ar.position.y += Math.sin(k * Math.PI) * arc; rib.push(ar.position); }, () => rib.end());
  await wait(fly * 1000);
  landHit(au, du, d, r); if (onHit) onHit();
  // the target recoils along the shot, using the ROM's hurt/guard poses and shake curve
  const n = A.shakeEnd - A.hitEnd;
  await anim(Math.max(0.3, n / 60 + 0.12), k => {
    const f = Math.floor(k * (n + 7));
    d.act = { kind: 'pose', row: !r.miss && f < 6 ? 3 : 2, base: r.miss ? 3 : 0 };
    const s = f >= 7 && f - 7 < n ? (fv[0] ? A.shakeH : A.shakeV)[f - 7] / 32 : 0; d.off.set(fv[0] * s, fv[1] * s);
    if (k > 0.5) a.act = null;
  });
  a.act = d.act = null; a.off.set(0, 0); d.off.set(0, 0);
  vfx.screen.barsTarget = 0; cam.release();
}
// physical attack, timed from the original's 60 Hz attack timeline [ROM anim data]
export async function attackAnim(au, du, r, onHit) {
  if (atkTypeOf(au) === 2) return bowAnim(au, du, r, onHit);
  const a = actorOf(au), d = actorOf(du), A = AD.attack, fv = FV[au.facing];
  const mid = a.pos.clone().lerp(d.pos, 0.5);
  const side = Math.atan2(fv[0], fv[1]);
  cam.shot(mid, { dist: 6.2, pitch: 0.36, yaw: ((side - cam.user.yaw + Math.PI * 2.5) % (Math.PI * 2)) > Math.PI ? 0.5 : -0.5 });
  if (r.crit) { vfx.screen.barsTarget = 0.6; await wait(250); }
  du.facing = { down: 'up', up: 'down', left: 'right', right: 'left' }[au.facing];
  let hit = false;
  await anim(A.end / 60, k => {
    const f = Math.min(A.end - 1, Math.floor(k * A.end));
    if (f < A.frame.length) { a.act = { kind: 'atk', frame: A.frame[f] }; const b = A.back[f] / 32; a.off.set(fv[0] * b, fv[1] * b); }
    else { a.act = null; a.off.set(0, 0); }
    if (f >= A.hitStart && f < A.shakeEnd) {
      d.act = { kind: 'pose', row: !r.miss && f >= A.flashStart && f < A.hitEnd ? 3 : 2, base: r.miss ? 3 : 0 };
      const s = f >= A.hitEnd ? (fv[0] ? A.shakeH : A.shakeV)[f - A.hitEnd] / 32 : 0; d.off.set(fv[0] * s, fv[1] * s);
    } else { d.act = null; d.off.set(0, 0); }
    if (!hit && f >= A.hitStart) { hit = true; landHit(au, du, d, r); if (onHit) onHit(); }
  });
  a.act = d.act = null; a.off.set(0, 0); d.off.set(0, 0);
  vfx.screen.barsTarget = 0; cam.release();
}
// a spell's or item's result reaches its target's numbers as it lands (ctx.hit), not as it is cast: damage comes off,
// and a remedy's HP / MP (worked out by eff.apply, then held back until now) go on [the user's call]
function landResult(t, r) {
  if (r.dmg !== undefined) { t.hp = Math.max(0, t.hp - r.dmg); t.hitT = gameT; }
  else if (r.restore) { t.hp = r.restore.hp; t.mp = r.restore.mp; }
  r.applied = true;
}
export function spellCtx(u, at, targets, results, cells) {
  const a = actorOf(u), ctx = {
    vfx, cam, caster: a, targets: targets.map(actorOf), at: cellAt(...at), wait,   // (at the cell's level, as the cursor: not a void's bottom)
    t0: gameT, track: [], until: s => wait(Math.max(0, (ctx.t0 + s - gameT) * 1000)), now: () => gameT - ctx.t0,   // (timeSpell sets the cast's own start and sound track; a raise has neither)
    cells: (cells || [at]).filter(c => R.inMap(...c)).map(c => cellAt(...c)),   // the spell's area, at its cells' levels (the aimed cell first)
    cue: () => { if (ctx.onHit) { const f = ctx.onHit; ctx.onHit = null; f(); } },   // the spell's sounds from here, before it lands (a spell whose first sound is not its blow: 哮天犬's cry as the hound appears)
    hit: i => { if (ctx.onHit) { const f = ctx.onHit; ctx.onHit = null; f(); } const list = i == null ? targets.map((t, j) => j) : [i]; for (const j of list) { const r = results[j]; if (r && !r.applied) landResult(targets[j], r); showResult(targets[j], r); } },   // damage and healing show in the HP bar as they land
    pose: kind => {
      if (!kind) { a.act = null; return; }
      if (a.texAct) { let k = 0; const loop = () => { if (a.act && a.act.kind === 'pose' && a.act.base === 6) { a.act.fixed = Math.min(2, Math.floor(k++ / 7)); requestAnimationFrame(loop); } }; a.act = { kind: 'pose', row: 2, base: 6, fixed: 0 }; loop(); }
    },
  };
  ctx.cam.camera = world.camera; return ctx;
}
export async function levelUpAnim(u, ch) {
  const a = actorOf(u), P = a.pos.clone(), face = u.facing;
  cam.focus(P);
  sfx(SND.levelUp);   // where the original plays its own (0x805A at ROM 0x12B30, as the level-up box opens)
  vfx.ring(P, [1, 0.9, 0.5], 1.4, 0.6);
  await wait(350);   // let the camera arrive
  const pose = LEVEL_POSE[u.sprite];
  if (pose) await pose(a, P); else { vfx.pillar(P, [1, 0.85, 0.4], 0.5, 4, 1.6, { intensity: 0.8, grow: 1 }); await wait(1200); }
  await wait(600);   // hold the final pose
  a.act = null; a.hover = 0; a.off.set(0, 0); u.facing = face;
  const parts = [ch.hp && '生命 +' + ch.hp, ch.mp && '法力 +' + ch.mp, ch.atk && '攻擊 +' + ch.atk, ch.df && '防禦 +' + ch.df, ch.spd && '速度 +' + ch.spd].filter(Boolean);
  await ui.say(u.name + ' 等級提升為 ' + ch.lv + ' 級。' + (parts.length ? '　' + parts.join('　') : '') + (ch.spell != null ? '\n學會了「' + D.spells[ch.spell].name + '」！' : ''), null, 2600);
}
export async function gainExp(u, amount) {
  if (u.side !== 'player' || u.guest || amount <= 0) return;
  // the experience gained, in gold over the hero after each attack, spell or item (the user's call), read before a level-up
  const a = actorOf(u); if (a && a.head) { await wait(300); ui.floater(a.head().add(V(0, 0.15, 0)), '經驗 +' + amount, 'dmg exp', 1.4); await wait(650); }   // (a beat after the blow lands: the user's call)
  u.exp += amount;
  while (u.exp > 99 && u.lv < 99) { u.exp -= 100; await levelUpAnim(u, R.levelUp(u)); }   // [ROM] 0x1246A
}

// ---------------------------------------------------------------- actions
// 石頭 blows itself up instead of striking (R.selfDestruct, ROM 0xF0672): it shudders and glows as the rock cracks with
// light, then bursts: a flash, a fireball, the eight pieces the original throws outward and more chips of stone, dust; each
// hero round it takes the blast; the stone is gone, with no experience to anyone
async function explodeAttack(au) {
  const a = actorOf(au), P = a.pos.clone(), c = a.chest(), hits = R.selfDestruct(au);
  cam.focus(P);
  await anim(0.75, (k, dt = 1 / 60) => {   // the charge: trembling, glowing hotter, sparks spitting from the cracks
    a.off.set(rand(-1, 1) * 0.04 * k, rand(-1, 1) * 0.02 * k); a.flash = 0.25 + 0.5 * k * (0.6 + 0.4 * Math.sin(k * 60));
    if (Math.random() < 0.3 + k) vfx.spark(c.x + rand(-0.3, 0.3), c.y + rand(-0.3, 0.3), c.z + 0.1, { vx: rand(-1, 1), vy: rand(0.5, 2), vz: rand(-0.4, 0.4), g: 4, life: 0.4, size: rand(0.03, 0.05), r: 1, gg: rand(0.5, 0.8), b: 0.2, shape: 1 });
    if (Math.random() < k * 0.5) vfx.light(c, [1, 0.5, 0.15], 4 + 10 * k, 0.08, 3);
  });
  a.off.set(0, 0); a.flash = 0; a.dissolve = 1; au.alive = false;
  sfx(SND.burst); vfx.flash([1, 0.75, 0.4], 0.16); vfx.shake(0.32, 0.5); vfx.hitstop = 0.08;
  vfx.explode(c, 1.1, { n: 26, tint: [1.3, 1.05, 0.6], smokeTint: [0.3, 0.27, 0.24] });
  vfx.light(c, [1, 0.6, 0.25], 30, 0.7, 7); vfx.ring(P, [1, 0.7, 0.35], 2.6, 0.5, { intensity: 0.8 }); vfx.decal(P, [0.25, 0.2, 0.16], 1.3, 3, { intensity: 0.6 });
  // the stone in pieces: the original's eight thrown outward, and smaller chips with them
  const rock = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.95 });
  for (let i = 0; i < 22; i++) {
    const ang = i < 8 ? i / 8 * Math.PI * 2 : rand(0, 6.28), sp = i < 8 ? rand(2.4, 3.2) : rand(1.2, 3.6), s = i < 8 ? rand(0.09, 0.14) : rand(0.04, 0.08);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock); m.castShadow = true; m.position.copy(c);
    const v = V(Math.cos(ang) * sp, rand(2, 4.5), Math.sin(ang) * sp * 0.8), spin = V(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    vfx.timed(m, rand(1.1, 1.6), (k, dt) => { v.y -= dt * 11; m.position.addScaledVector(v, dt); m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt;
      const g = groundH(m.position.x, m.position.z) + s * 0.6; if (m.position.y < g) { m.position.y = g; v.multiplyScalar(0.35); v.y = Math.abs(v.y) * 0.4; spin.multiplyScalar(0.5); }
      if (k > 0.7) m.scale.setScalar(1 - (k - 0.7) / 0.3); });
  }
  for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2, sp = rand(1.6, 2.6); vfx.smokePuff(P.x, P.y + 0.1, P.z, { vx: Math.cos(t) * sp, vz: Math.sin(t) * sp, vy: rand(0.2, 0.6), drag: 2.4, life: rand(1, 1.6), size: 0.3, size1: 0.9, tint: [0.48, 0.44, 0.4] }); }
  // the blast on each hero round it
  for (const { t, dmg } of hits) { const d = actorOf(t); if (!d) continue; t.hp = Math.max(0, t.hp - dmg); t.hitT = gameT;
    ui.floater(d.head().add(V(0, 0.15, 0)), String(dmg), 'dmg ally', 1.4); flinch(d, 1.6); d.flash = 1; anim(0.3, kk => { d.flash = 1 - kk; }); }
  await wait(700);
  for (const { t } of hits) if (t.hp <= 0 && t.alive) { t.alive = false; await killAnim(t); }
}
export async function doAttack(au, du) {
  if (R.explodes(au)) return explodeAttack(au);   // (石頭: its attack is its end)
  R.faceTo(au, du.x, du.y);
  const r = R.physicalAttack(au, du);
  await attackAnim(au, du, r, () => { if (!r.miss) { du.hp = Math.max(0, du.hp - r.dmg); du.hitT = gameT; } });   // the HP bar drops on the blow itself
  const rider = R.afterBlow(au, du, r);   // (a sleeper woken, landed or not; the sleep or poison some blows carry)
  if (rider) await statusPop(du, rider);
  if (r.miss) return;
  if (du.hp <= 0) { du.alive = false; await killAnim(du); await dropFind(au, du); }
  if (au.side === 'player') await gainExp(au, R.expFor(au, du, !du.alive));
}
// a status shown by the unit: its glyph, as the original flashes 封, 眠 or 毒 beside it [ROM 0x218E0, 0x582E, 0x218F6]
const GLYPH = { seal: '封', sleep: '眠', poison: '毒' };
async function statusPop(u, kind) {
  const a = actorOf(u); if (!a || !a.head) return;
  ui.floater(a.head().add(V(0, 0.15, 0)), GLYPH[kind], 'dmg status ' + kind, 1.2); await wait(600);
}
// the start of a unit's turn (R.turnStart, ROM 0x1A52C and 0x1A87C): what it holds gives back HP or MP (a rising
// number, even +0, as the original's), then its statuses tick, each by its glyph; poison's damage, and its death
async function turnStartFx(u, res) {
  const a = actorOf(u); if (!a || u.away || !res.ev.length) return;
  cam.release(); cam.focus(a.pos);
  for (const e of res.ev) {
    const p = () => a.head().add(V(0, 0.15, 0));
    if (e.kind === 'regen') { ui.floater(p(), (e.hp != null ? '+' : '法力 +') + (e.hp ?? e.mp), 'dmg heal', 1.2); a.flash = 0.4; anim(0.5, k => { a.flash = 0.4 * (1 - k); }); await wait(450); }
    else if (GLYPH[e.kind]) {
      await statusPop(u, e.kind);
      if (e.kind === 'poison') { ui.floater(p(), String(e.dmg), 'dmg' + (u.side === 'player' ? ' ally' : ''), 1.4); flinch(a, 1.2); u.hitT = gameT; await wait(500); }
    }
    else if (e.kind === 'died') { u.alive = false; await killAnim(u); }   // (no experience, no drop [ROM 0x1A9F6])
  }
}
export async function castSpell(u, sp, at) {
  u.mp -= sp.mp; R.faceTo(u, at[0], at[1]);
  const eff = R.spellEffect(u, sp);
  if (eff.kind === 3) return raiseOn(u, at, sp.name, c => playSpell(sp.id, c, sp.kind));   // (the menu picks who: pickRaise)
  const t0 = gameT, qa = window.__qa ? (window.__qa.cast = { id: sp.id, t0, snd: null, hit: null, end: null }) : null;   // (tools/qa/spells.js: the cast's beats on the game clock)
  await useEffect(u, eff, R.areaCells(at[0], at[1], sp.area), at, sp.name, async c => { timeSpell(c, sp.id, t0); c.onHit = () => { if (qa) qa.snd = gameT; spellSounds(sp.id); }; if (qa) { const h = c.hit; c.hit = i => { if (qa.hit == null) qa.hit = gameT; h(i); }; } await playSpell(sp.id, c, sp.kind); if (c.onHit) c.onHit(); if (qa) qa.end = gameT; });   // the sounds as the spell lands on its targets (its first ctx.hit; else as it ends) [the user's call]
}
// an item's icon in the world (assets/items/hd/NN.png: the xBR 4x of the 32x32 icon the original's 物 menu shows,
// assets/items/NN.png from tools/rom/icons.py; extract/hd.js), a soft glow behind it; null for an item without one
// [the user's call, 2026-10-23, after a redraw of all 36 at 256 px was tried: the original's own icons, in HD]
const iconTex = new Map();
function itemIcon(id) {
  if (id == null || id > 35) return null;
  if (!iconTex.has(id)) { const t = new THREE.TextureLoader().load('assets/items/hd/' + String(id).padStart(2, '0') + '.png'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; iconTex.set(id, t); }
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: vfx.glowTex, color: 0xfff0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  glow.scale.setScalar(1.5); g.add(glow);
  const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex.get(id), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  ic.scale.setScalar(0.82); g.add(ic); g.renderOrder = 9; glow.renderOrder = 9; ic.renderOrder = 10;
  g.userData = { glow, ic, set(o) { glow.material.opacity = o * 0.75; ic.material.opacity = o; } };
  world.scene.add(g); return g;
}
// using an item [design, after the original's 物 menu, which holds the item's icon over the hero]: the icon rises over
// the user's head, glows, and streams to the target before the effect plays (no bracket round it: the user's call)
async function itemUse(u, id, at) {
  const g = itemIcon(id); if (!g) return;
  const H = actorOf(u).head(), T = cellAt(at[0], at[1]).add(V(0, 0.6, 0)), self = at[0] === u.x && at[1] === u.y;
  await anim(0.55, k => { const e = 1 - (1 - k) ** 3; g.position.copy(H).add(V(0, 0.2 + 1.0 * e, 0)); g.userData.set(Math.min(1, k * 3)); g.userData.glow.scale.setScalar(1.5 + 0.3 * Math.sin(k * 9)); });
  await wait(250);
  const P0 = g.position.clone();
  await anim(self ? 0.35 : 0.45, k => {   // to the target (or down into the user), shrinking into a spray of light
    g.position.copy(P0).lerp(self ? H : T, k); g.position.y += Math.sin(k * Math.PI) * (self ? 0 : 0.5); g.scale.setScalar(1 - 0.6 * k); g.userData.set(1 - k * 0.5);
    if (Math.random() < 0.6) vfx.spark(g.position.x, g.position.y, g.position.z, { vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.6), vz: rand(-0.4, 0.4), life: 0.5, size: 0.05, r: 1, gg: 0.95, b: 0.7 });
  });
  vfx.burst(g.position, { n: 18, speed: 1.6, cols: [[1, 0.95, 0.7], [1, 1, 1]], size: 0.04, life: 0.6, g: 0 });
  world.scene.remove(g);
}
// opening a chest: the item's icon rises out of it in a burst of light and hangs there while the find is told, then
// drops into the hero's hands
// an enemy's drop: the item it held rises from where it fell and goes to the hero who felled it, with the chests' chime
// and line [ROM 0x21420, 0x129B0]
async function dropFind(u, dead) {
  const got = R.takeDrop(u, dead); if (!got) return;
  sfx(SND.found);
  const give = await chestFind(u, { item: got.id, x: dead.x, y: dead.y }, got.it, 0.1);
  await ui.say(u.name + '得到了「' + got.it.name + '」！' + (G.found.includes(got.id) && !u.items.includes(got.id) ? '\n（放進了行囊）' : ''), null, 1800);
  if (give) await give();
}
async function chestFind(u, ch, it, lift = 0.45) {   // lift: where the icon starts over the cell (a chest's lid; a fallen enemy's ground)
  const g = itemIcon(ch.item); if (!g) return null;
  const P = tileCenter(ch.x, ch.y);
  await anim(0.7, k => { const e = 1 - (1 - k) ** 3; g.position.set(P.x, P.y + lift + (2.2 - lift) * e, P.z); g.userData.set(Math.min(1, k * 2.5)); g.scale.setScalar(0.5 + 0.5 * e);
    if (Math.random() < 0.5) vfx.spark(P.x + rand(-0.15, 0.15), P.y + 0.5, P.z + rand(-0.15, 0.15), { vy: rand(0.6, 1.4), life: 0.6, size: 0.04, r: 1, gg: 0.9, b: 0.5 }); });
  let bob = 0, on = true; const tick = () => { if (!on) return; bob += 0.016; g.position.y = P.y + 2.2 + Math.sin(bob * 4) * 0.04; g.userData.glow.scale.setScalar(1.5 + 0.2 * Math.sin(bob * 6)); requestAnimationFrame(tick); }; tick();
  return async () => { on = false; const A = actorOf(u).chest(), Q = g.position.clone();
    await anim(0.35, k => { g.position.copy(Q).lerp(A, k); g.scale.setScalar(1 - 0.7 * k); g.userData.set(1 - k); });
    world.scene.remove(g); };
}
// each item's sounds as the original plays them once its target is confirmed [tools/rom: the sound driver's requests
// (0x1E41D4) logged in the harness, from the 磻溪 snapshot, an item at a time]: [id, frames after the first] ...; the
// first is put where the effect lands here (a remedy's drop after 0.45 s, a harmful item's blast at once)
const RESTORE = [[0x8042, 0]];
const ITEM_SND = { 6: [[0x8042, 0], [0x8042, 41]], 10: [[0x8089, 0]], 11: [[0x8086, 0]], 12: Array.from({ length: 12 }, (_, k) => [0x804b, k * 21]),
  13: [[0x80aa, 0]], 14: [[0x8042, 0], [0x8089, 42]], 15: Array.from({ length: 9 }, (_, k) => [0x807f, k * 10]), 16: [[0x806e, 0]],
  17: Array.from({ length: 9 }, (_, k) => [0x807f, k * 10]) };
function itemSounds(id, harmful) {
  const at = harmful ? 0 : 450;
  for (const [snd, f] of ITEM_SND[id] || RESTORE) later(() => sfx(snd), at + f * 1000 / 60);
}
// a spell script's own clock [the user's report: 楊戩's summons ran short of the original and its sound track]: t0 the
// cast's start, until(s) waits to s seconds after it, track the offsets (s) of the spell's own sounds from its cue
// (data/spellsound.js, the original's): the original's beats are its sounds, so a script lays its strikes on track
// from the moment the original plays its first sound (tools/rom/spelltime.py; tools/qa/spells.js checks it)
function timeSpell(c, id, t0) { c.t0 = t0; c.track = ((globalThis.SPELL_SND || {})[id] || []).map(([, f]) => f / 60); return c; }
// fn after ms of game time (not setTimeout: it keeps to the fast-forward and to tools/qa/video.js's stepped frames)
function later(fn, ms) { if (ms <= 0) fn(); else wait(ms).then(fn); }
// a spell's own sounds (data/spellsound.js), the first as it lands, the rest the original's spacing apart
function spellSounds(id) {
  for (const [snd, f] of (globalThis.SPELL_SND || {})[id] || []) later(() => sfx(snd), f * 1000 / 60);
}
export async function useItem(u, idx, at) {
  const id = u.items[idx], it = D.items[id], eff = R.itemEffect(u, it);
  u.items.splice(idx, 1); R.faceTo(u, at[0], at[1]);
  await itemUse(u, id, at);
  if (eff.kind === 3) return raiseOn(u, at, it.name, c => playSpell(43, c, 3));
  await useEffect(u, eff, R.areaCells(at[0], at[1], it.area), at, it.name, c => { itemSounds(id, eff.kind === 13); return playItem(c, eff.kind === 13); });
}
export async function useEffect(u, eff, cells, at, name, script) {
  const isHarm = eff.kind === 13;
  const targets = cells.map(([x, y]) => R.unitAt(x, y)).filter(t => t && (isHarm ? R.foes(u).includes(t) : t.side === u.side));
  const results = targets.map(t => {
    const hp = t.hp, mp = t.mp, r = eff.apply(t);
    if (r && r.dmg === undefined && (t.hp !== hp || t.mp !== mp)) { r.restore = { hp: t.hp, mp: t.mp }; t.hp = hp; t.mp = mp; }   // held back until it lands
    return r && r.dmg !== undefined && R.SPELL_IMMUNE.includes(t.moveType) ? { immune: true } : r;
  });
  ui.toast(u.name + '　·　' + name, 1100);
  await script(spellCtx(u, at, targets, results, cells));
  cam.release();
  let gained = 0, killedAny = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i], r = results[i];
    if (r && !r.applied && !r.immune) landResult(t, r);   // (a script that never called ctx.hit)
    if (r && r.dmg !== undefined) { if (t.hp <= 0) { t.alive = false; killedAny = true; await killAnim(t); await dropFind(u, t); } }
    else if (r) gained += r.exp || 0;
  }
  if (!targets.length && !opts.arena) await ui.toast('沒有效果', 800);
  // experience [ROM 0x12460]: a damage cast or item by the level difference, as a blow's; any other a flat 10 (a resisted
  // status cast too)
  const first = targets[0];
  if (u.side === 'player' && first) {
    if (isHarm && results.some(r => r && (r.dmg !== undefined || r.immune)) && first.side !== 'player') await gainExp(u, R.expFor(u, first, killedAny || !first.alive));
    else if (gained) await gainExp(u, 10);
  }
}

// ---------------------------------------------------------------- turns
function showDanger(on) {
  if (!on) return [];
  const out = new Map();
  for (const e of G.units) if (e.alive && e.side === 'enemy' && !R.dormant(e)) for (const c of R.reach(e).values()) if (c.stop) for (const [x, y] of R.cellsInShape(c.x, c.y, e.rangeShape)) out.set(x + ',' + y, { x, y, c: C.danger });
  return [...out.values()];
}
let danger = false;
const after = () => opts.arena ? { over: false, trig: false } : R.afterAction();   // the arena has no win / loss
// a chest opens [ROM 0x1BAF2]: the hero faces it, the lid opens, the item is handed over; [design] that ends the turn
// the lid flies open with a burst of light (on the blow itself when the chest is struck)
// CHEST_RISE: seconds from the lid flying open to the item rising (was 0.3; struck, the whole swing's 1.3 s): 40% less, then 20% less again [the user's calls]
const CHEST_RISE = 0.144, CHEST_RISE_STRUCK = 0.624;
function popChest(ch) {
  const set = FX.look && FX.look.set; if (set && set.openChest) set.openChest(ch.x, ch.y);
  const P = tileCenter(ch.x, ch.y); vfx.burst(P.clone().setY(P.y + 0.5), { n: 24, speed: 1.4, cols: [[1, 0.9, 0.5], [1, 1, 0.85]], size: 0.04, life: 0.9, g: -0.4, up: 0.4 });
}
// a hero strikes a chest open: the lid flies on the blow, and the item rises while the swing ends
export async function strikeChest(u, at, ch) {
  let hit; const struck = new Promise(r => { hit = r; }), sw = swingAt(u, ...at, () => { popChest(ch); hit(); });
  await struck; await wait(CHEST_RISE_STRUCK * 1000); await Promise.all([sw, openChest(u, ch, true)]);
}
export async function openChest(u, ch, popped) {
  const it = R.openChest(u, ch), a = actorOf(u); placeActor(a);
  if (!popped) { popChest(ch); sfx(SND.hit); await wait(CHEST_RISE * 1000); }   // the original strikes the lid open (its attack routine's chest path, 0x0F3F2)
  if (it) sfx(SND.found);   // the find [ROM 0x0F616, as the item is shown]
  const give = it ? await chestFind(u, ch, it) : null;   // the item's icon rises out of the chest
  if (it) await ui.say(u.name + '得到了「' + it.name + '」！' + (G.found.includes(ch.item) && !u.items.includes(ch.item) ? '\n（放進了行囊）' : ''), null, 1800);
  if (give) await give();
}
export async function playerTurn(u) {
  const a = actorOf(u);
  queue.length = 0;                 // drop clicks made while animations were playing
  if (PG.queue.length) push({ k: 'PG' });
  for (;;) {
    const r = R.reach(u), home = { x: u.x, y: u.y, facing: u.facing };
    cam.release(); cam.focus(a.pos);
    const chests = R.chestTargets(u, r);   // a chest next to a reachable cell: pick it to open it (a hidden one is found by attacking it)
    const moveTiles = [...r.values()].map(c => ({ x: c.x, y: c.y, c: C.move }))
      .concat([...chests.values()].map(t => ({ x: t.chest.x, y: t.chest.y, c: C.chest, lift: 0.01 })));
    const redraw = () => tiles.set([...showDanger(danger), ...moveTiles]);
    redraw(); ui.hint(u.name + '　·　選擇移動位置（點自己＝原地）' + (opts.free ? '　·　測試：可點任意空格' : '')); ui.card(u); PG.popup = opts.test; if (opts.test) PG.sel = u;
    cursorTile = [u.x, u.y]; tiles.setCursor(...cursorTile);
    let dest = null;
    while (!dest) {
      const ev = await input();
      if (ev.k === 'PG') { dest = 'PG'; break; }
      if (ev.k === 'B' && opts.arena) { PG.popup = false; return 'cancel'; }
      if (ev.k === 'TAB') { danger = !danger; redraw(); continue; }
      if (ev.k === 'hover' || ev.k === 'DIR') {
        // @qa battles
        if (ev.k === 'DIR') { cursorTile = [R.clamp(cursorTile[0] + ev.d[0], 0, R.MAP_W - 1), R.clamp(cursorTile[1] + ev.d[1], 0, R.MAP_H - 1)]; cam.focus(cellAt(...cursorTile)); }
        tiles.setCursor(...cursorTile);
        const n = r.get(R.key(...cursorTile)), ch = chests.get(R.key(...cursorTile));
        tiles.setPath(ch ? R.pathTo(r, ch.from.x, ch.from.y) : n && n.stop ? R.pathTo(r, ...cursorTile) : null);
        ui.card(R.unitAt(...cursorTile) || u); continue;
      }
      const t = ev.k === 'click' ? ev.t : ev.k === 'A' ? cursorTile : null;
      if (!t) continue;
      const n = r.get(R.key(...t)), ch = chests.get(R.key(...t));
      if (ch) dest = ch;
      else if (n && n.stop) dest = t;
      else if (opts.arena && R.unitAt(...t) && R.unitAt(...t).side === 'player' && R.unitAt(...t) !== u) { PG.popup = false; return { switch: R.unitAt(...t) }; }   // pick another hero
      else if (n && !n.stop) ui.toast('這裡已經有人了', 700);
      else if (opts.free && !R.unitAt(...t) && !R.chestAt(...t)) dest = { free: t };   // test start: any empty cell, out of reach or not
      else { const o = R.unitAt(...t); if (o) ui.card(o); }
    }
    tiles.set([]); tiles.setPath(null); tiles.setCursor(null); ui.hint(''); PG.popup = false;
    if (dest === 'PG') { await PG.flush(); if (!u.alive || !G.units.includes(u)) return 'cancel'; if (PG.endPhase) return 'cancel'; continue; }   // a test-toolbar action
    if (dest.chest) { await walkActor(u, R.pathTo(r, dest.from.x, dest.from.y)); await openChest(u, dest.chest); return 'acted'; }
    if (dest.free) { vfx.burst(a.chest(), { n: 14, speed: 1.4, cols: [[0.9, 0.95, 1], [1, 1, 1]], size: 0.035, life: 0.5, up: 0.3 }); [u.x, u.y] = dest.free; placeActor(a); vfx.burst(a.chest(), { n: 14, speed: 1.4, cols: [[0.9, 0.95, 1], [1, 1, 1]], size: 0.035, life: 0.5, up: 0.3 }); cam.focus(a.pos); }
    else await walkActor(u, R.pathTo(r, ...dest));
    if (after().over) return;
    const done = await commandMenu(u);
    if (done) return 'acted';
    u.x = home.x; u.y = home.y; u.facing = home.facing; placeActor(a);       // cancelled: back to where the turn began
  }
}
const MENU = [{ id: 'attack', ch: '攻', label: '攻擊', dx: 0, dy: -78 }, { id: 'magic', ch: '法', label: '法術', dx: -78, dy: 0 }, { id: 'item', ch: '物', label: '道具', dx: 78, dy: 0 }, { id: 'wait', ch: '待', label: '待機', dx: 0, dy: 78 }];
export let menuAnchor = null;
export async function commandMenu(u) {
  const a = actorOf(u);
  const chestNear = ([x, y]) => { const ch = u.side === 'player' && R.cellsInShape(u.x, u.y, u.rangeShape).some(([cx, cy]) => cx === x && cy === y) && R.chestAt(x, y); return ch || null; };   // a hero can break open a chest in his attack's reach (next to him; a bow's diagonals and two cells off: the user's call), a hidden one only this way
  const foeCells = () => R.cellsInShape(u.x, u.y, u.rangeShape).filter(([x, y]) => { const t = R.unitAt(x, y); return opts.arena ? !t || R.foes(u).includes(t) : t && R.foes(u).includes(t) || chestNear([x, y]); });   // the arena: empty tiles too
  const okMap = { attack: foeCells().length > 0, magic: u.spells.length > 0 && !u.status.seal, item: u.items.length > 0, wait: true };
  let sel = okMap.attack ? 0 : 3;
  cam.shot(a.pos, { dist: 10, pitch: 0.75, yaw: 0 });
  for (;;) {
    menuAnchor = a; ui.hint('選擇行動');
    let pick = null;
    const opts = MENU.map(m => Object.assign({}, m, { ok: okMap[m.id], onClick: i => push({ k: 'MENU', i }), onHover: i => { sel = i; ui.menu(opts, sel, ...menuPos()); } }));
    const draw = () => ui.menu(opts, sel, ...menuPos());
    draw();
    while (pick == null) {
      const ev = await input();
      if (ev.k === 'B') { ui.menu(null); menuAnchor = null; cam.release(); return false; }
      if (ev.k === 'MENU') pick = ev.i;
      if (ev.k === 'A') pick = sel;
      if (ev.k === 'DIR') { sel = { ArrowUp: 0, w: 0, ArrowLeft: 1, a: 1, ArrowRight: 2, d: 2, ArrowDown: 3, s: 3 }[ev.raw] ?? sel; draw(); }
    }
    ui.menu(null); menuAnchor = null;
    const choice = MENU[pick].id;
    if (!okMap[choice]) { ui.toast(choice === 'attack' ? '沒有可攻擊的目標' : choice === 'magic' ? (u.status.seal ? '被封法了' : '沒有法術') : '沒有道具', 800); continue; }
    if (choice === 'wait') { cam.release(); return true; }
    if (choice === 'attack') {
      const cells = foeCells();
      const at = await pickTarget(u, cells, cells, 0, C.atk, 'foe', true);
      if (!at) continue;
      const tgt = R.unitAt(...at), ch = !tgt && chestNear(at);
      if (tgt) await doAttack(u, tgt);
      else if (ch) await strikeChest(u, at, ch);
      else await swingAt(u, ...at);
      return true;
    }
    if (choice === 'magic') {
      const rows = u.spells.map(i => { const sp = D.spells[i]; return { icon: 'assets/spells/hd/' + String(sp.id).padStart(2, '0') + '.png', label: sp.name, right: '法力消耗 ' + sp.mp + ' 點', ok: sp.mp <= u.mp, desc: spellDesc(sp) }; });
      const k = await pickRing(a, rows); if (k == null) continue;
      const sp = D.spells[u.spells[k]];
      if (sp.mp > u.mp) { ui.toast('法力不足', 800); continue; }
      if (R.spellEffect(u, sp).kind === 3) {   // 還魂咒
        const p = await pickRaise(u, R.cellsInShape(u.x, u.y, sp.range), rows[k].icon); if (!p) continue;
        u.mp -= sp.mp; await raiseFx(u, p.who, p.at, sp.name, c => playSpell(sp.id, c, sp.kind)); return true;
      }
      const range = R.cellsInShape(u.x, u.y, sp.range), cells = opts.test ? range : R.castCells(u, range, sp.kind === 13);
      if (!cells.length) { ui.toast(sp.kind === 13 ? '範圍內沒有敵人' : '範圍內沒有同伴', 800); continue; }
      const at = await pickTarget(u, cells, range, sp.area, sp.kind === 13 ? C.harm : C.help, sp.kind === 13 ? 'foe' : 'ally');
      if (!at) continue;
      await castSpell(u, sp, at); return true;
    }
    if (choice === 'item') {
      const rows = u.items.map(i => ({ icon: 'assets/items/hd/' + String(i).padStart(2, '0') + '.png', label: D.items[i].name, right: '', ok: !!R.itemEffect(u, D.items[i]) && !D.items[i].equip, desc: itemDesc(i) }));
      const k = await pickRing(a, rows); if (k == null) continue;
      const it = D.items[u.items[k]], eff = R.itemEffect(u, it);
      if (!eff || it.equip) { ui.toast('無法使用', 800); continue; }
      if (eff.kind === 3) {   // 玄天聖水
        const p = await pickRaise(u, R.cellsInShape(u.x, u.y, it.range), rows[k].icon); if (!p) continue;
        const id = u.items[k]; u.items.splice(k, 1); await itemUse(u, id, p.at);
        await raiseFx(u, p.who, p.at, it.name, c => playSpell(43, c, 3)); return true;
      }
      const range = R.cellsInShape(u.x, u.y, it.range), cells = opts.test ? range : R.castCells(u, range, eff.kind === 13);
      if (!cells.length) { ui.toast(eff.kind === 13 ? '範圍內沒有敵人' : '範圍內沒有同伴', 800); continue; }
      const at = await pickTarget(u, cells, range, it.area, eff.kind === 13 ? C.harm : C.help, eff.kind === 13 ? 'foe' : 'ally');
      if (!at) continue;
      await useItem(u, k, at); return true;
    }
  }
}
// a fallen hero back (還魂咒, 玄天聖水 [ROM 0x28300]): an empty cell in the cast's range, then who, from the fallen of
// the heroes' slots; it stands up there at half its HP, the caster gaining 10
async function pickRaise(u, range, icon) {
  const dead = R.fallen(); if (!dead.length) { ui.toast('沒有陣亡的同伴', 800); return null; }
  const cells = range.filter(([x, y]) => !R.unitAt(x, y));
  if (!cells.length) { ui.toast('範圍內沒有空位', 800); return null; }
  const at = await pickTarget(u, cells, range, 0, C.help, 'ally'); if (!at) return null;
  const k = await pickRing(actorOf(u), dead.map(d => ({ icon, label: d.name, right: 'Lv ' + d.lv, ok: true, desc: '' }))); if (k == null) return null;
  return { at, who: dead[k] };
}
// a raise cast straight at a cell (the test toolbar, tools/qa/spells.js): the first of the fallen, if the cell is free
async function raiseOn(u, at, name, script) {
  const who = R.fallen()[0];
  if (who && !R.unitAt(at[0], at[1])) return raiseFx(u, who, at, name, script);
  ui.toast(u.name + '　·　' + name, 1100); await script(spellCtx(u, at, [], [], [at])); cam.release(); await ui.toast('沒有效果', 800);
}
async function raiseFx(u, who, at, name, script) {
  R.faceTo(u, at[0], at[1]); ui.toast(u.name + '　·　' + name, 1100);
  R.raise(who, at[0], at[1]);
  const a = actorOf(who); Object.assign(a, { hidden: false, fade: 0, dissolve: 0, act: null, hover: 0 }); placeActor(a);
  await script(spellCtx(u, at, [], [], [at]));   // the light comes down on the empty cell
  cam.release(); cam.focus(a.pos);
  for (let k = 1; k <= 20; k++) { a.fade = k / 20; await wait(30); }
  a.fade = 1; showResult(who, { heal: who.hp });
  if (u.side === 'player') await gainExp(u, 10);
}
export function menuPos() { if (!menuAnchor) return [0, 0]; const p = project(menuAnchor.chest()); return [p.x, p.y]; }
// the item / spell ring round the unit (ui.ring): hover or the arrow keys point, a click or A picks, B goes back
export async function pickRing(a, rows) {
  let sel = Math.max(0, rows.findIndex(r => r.ok)), top = sel;   // top: turned to the top by the keys; the mouse points without turning it
  menuAnchor = a; ui.hint('');
  const draw = () => ui.ring(rows, sel, top, ...menuPos(), i => push({ k: 'RING', i }), i => { if (sel !== i) { sel = i; draw(); } });
  draw();
  const done = k => { ui.ring(null); menuAnchor = null; return k; };
  for (;;) {
    const ev = await input();
    if (ev.k === 'B') return done(null);
    if (ev.k === 'RING') return done(ev.i);
    if (ev.k === 'A') return done(sel);
    if (ev.k === 'DIR') { const d = { ArrowRight: 1, d: 1, ArrowDown: 1, s: 1, ArrowLeft: -1, a: -1, ArrowUp: -1, w: -1 }[ev.raw]; if (d) { sel = top = (sel + d + rows.length) % rows.length; draw(); } }
  }
}
export async function pickTarget(u, cells, range, area, color, prefer, attack) {
  const score = ([x, y]) => { const t = R.unitAt(x, y); if (!t) return 0; return prefer === 'ally' ? (t.side === u.side ? 2 : 0) : (R.foes(u).includes(t) ? 2 : 0); };
  const ordered = cells.slice().sort((a, b) => score(b) - score(a) || a[1] - b[1] || a[0] - b[0]);
  let i = 0, armed = false;
  const show = () => {
    const cur = ordered[i];
    const dim = prefer === 'ally' ? [0.12, 0.45, 0.2] : [0.6, 0.12, 0.08];   // every unit you could pick shows tinted
    tiles.set([...range.map(([x, y]) => ({ x, y, c: score([x, y]) ? dim : C.range })), ...R.areaCells(cur[0], cur[1], area).map(([x, y]) => ({ x, y, c: color, lift: 0.01 }))]);
    // @qa battles
    tiles.setCursor(...cur, true); targetMark.set(cur, prefer === 'ally' ? [0.2, 0.9, 0.35] : [0.95, 0.1, 0.06], gameT); cam.focus(cellAt(...cur));
    const t = R.unitAt(...cur); ui.card(t || u);
  };
  ui.hint(attack ? '選擇攻擊目標' : '選擇施放位置'); show();
  for (;;) {
    const ev = await input();
    if (ev.k === 'B') break;
    if (ev.k === 'A') return done(ordered[i]);
    if (ev.k === 'click' || ev.k === 'hover') {
      const j = ordered.findIndex(c => c[0] === ev.t[0] && c[1] === ev.t[1]); if (j < 0) continue;
      if (ev.k === 'click' && j === i) return done(ordered[i]);
      if (j !== i) armed = false; i = j; if (ev.k === 'click') armed = true; show();
    }
    if (ev.k === 'DIR') { i = (i + ((ev.d[0] + ev.d[1]) > 0 ? 1 : ordered.length - 1)) % ordered.length; armed = false; show(); }
  }
  tiles.set([]); tiles.setCursor(null); targetMark.set(null); ui.forecast(null); ui.hint(''); return null;
  function done(c) { tiles.set([]); tiles.setCursor(null); targetMark.set(null); ui.forecast(null); ui.hint(''); return c; }
}
// a phantom (AI 0x83) calling: it flickers in on the cell it shows itself on, its callers come in, and it fades away
async function phantomCall(u, at) {
  const a = actorOf(u); a.pos.copy(standAt(u, at[0], at[1])); a.off.set(0, 0); a.fade = 0; u.away = false;
  cam.release(); cam.focus(a.pos); await wait(300);
  for (let k = 1; k <= 24; k++) { a.fade = (k / 24) * (k % 4 < 2 ? 1 : 0.45); await wait(25); }   // flickering in, as the original's (0x0EFF96)
  a.fade = 1; await wait(250);
  if (G.joined && G.joined.length) await joinHeroes(G.joined.splice(0));
  cam.focus(a.pos); for (let k = 23; k >= 0; k--) { a.fade = (k / 24) * (k % 4 < 2 ? 1 : 0.45); await wait(25); }   // and out (0x0F018C)
  a.fade = 1; u.away = true;
}
export async function aiTurn(u) {
  if (!R.wakes(u)) return;
  if (u.away) { const plan = R.planAction(u, opts); if (plan.appear) await phantomCall(u, plan.appear); return; }   // a phantom: never on the map but to call
  const a = actorOf(u); cam.release(); cam.focus(a.pos); ui.card(u);
  await wait(opts.arena ? 120 : 350);
  const plan = R.planAction(u, opts);
  if (u.side === 'enemy' && !opts.arena) { tiles.set([...plan.r.values()].map(c => ({ x: c.x, y: c.y, c: C.danger }))); await wait(450); tiles.set([]); }
  await walkActor(u, plan.path || R.pathTo(plan.r, plan.cell.x, plan.cell.y));   // (an enemy's path is the ROM's own: src/enemyai.js)
  if (plan.facing) u.facing = plan.facing;
  if (after().over) return;
  if (plan.kind === 'attack' && plan.target.alive) await doAttack(u, plan.target);
  else if (plan.kind === 'spell') await castSpell(u, plan.sp, plan.at);
  else if (plan.kind === 'zone') await zoneStrike(u, plan);
}
// battle 32's 紂王 [ROM 0x1C0C2]: two columns struck, every hero there losing 50, for his spell's MP
async function zoneStrike(u, plan) {
  u.mp = Math.max(0, u.mp - plan.sp.mp);
  const t0 = gameT; await useEffect(u, { kind: 13, apply: () => ({ dmg: plan.dmg }) }, plan.cells, plan.at, plan.sp.name, async c => { timeSpell(c, plan.sp.id, t0); c.onHit = () => spellSounds(plan.sp.id); await playSpell(plan.sp.id, c, 13); if (c.onHit) c.onHit(); });
}
export async function runBattle() {
  while (!G.over) {
    const ev = R.startRound();
    if (FX.roundStart) await FX.roundStart(E, ev);
    if (G.over) break;
    hudRound();
    const order = R.turnOrder();
    for (const v of G.units) v.done = false;
    PG.endPhase = false;
    for (let oi = 0; oi < order.length; oi++) {
      const u = order[oi];
      if (opts.test) {   // the test toolbar: its actions, our turns ended for the round, the enemies' turns off
        await PG.flush(); const res = after(); if (res.over) break;
        if (!G.units.includes(u) || (PG.endPhase && u.side === 'player') || (!PG.enemiesAct && u.side === 'enemy')) { u.done = true; continue; }
      }
      if (!u.alive || G.over) continue;
      ui.order(order.slice(oi).filter(v => v.alive && !v.away), u);   // (away: a phantom, AI 0x83)
      G.active = u;
      const step = R.roomExit();   // a battle in rooms: a hero on an exit takes the party on (or back), and the round starts over
      if (step) { G.active = null; await enterRoom(G.room + step, step < 0); break; }
      const lines = R.beforeTurn(u);   // the battle's turn hook: scripted lines (and wake-ups) before this unit moves
      if (G.joined && G.joined.length) await joinHeroes(G.joined.splice(0));   // units the hook brought in (battle 4's 楊戩, battle 7's reinforcements)
      if (lines) { for (const l of lines) { if (l.fx) { if (FX[l.fx]) await FX[l.fx](E, l); } else await speak(l.text, l.who, l); }  if (!u.alive || G.over) { G.active = null; continue; } }   // (l.fx: a beat of the battle's own between the lines, battle 27's)
      const opened = lines && R.roomExit();   // a way on the hook opened under a hero (battle 27's gates, 0x0FA9C6: it takes the party on at once)
      if (opened) { G.active = null; await enterRoom(G.room + opened, opened < 0); break; }
      if (R.skipsTurn(u)) { G.active = null; u.done = true; continue; }   // the hook ended the heroes' round (battle 14's lair)
      if (!R.wakes(u)) { G.active = null; u.done = true; continue; }   // a dormant enemy that does not wake has nothing more this turn [ROM 0x1EA0C]
      const st = R.turnStart(u); await turnStartFx(u, st);   // what it holds, then its statuses [ROM 0x1E8E6, 0x1E8EC]
      if (!u.alive) { G.active = null; u.done = true; const res = after(); if (res.over) break; continue; }   // poisoned to death
      if (st.asleep) { G.active = null; u.done = true; continue; }   // asleep: the turn passes [ROM 0x1E93A]
      if (u.side === 'player' && !opts.auto && !u.guest) await playerTurn(u); else await aiTurn(u);   // a guest (文王) moves by his AI
      G.active = null; u.done = true; ui.card(null);
      const res = after();
      if (res.trig && FX.trigger) await FX.trigger(E);
      if (res.over) break;
    }
    if (G.round > 40) G.over = { win: false, why: '時間耗盡' };
  }
  if (G.over && G.over.win && (G.over.lines || G.over.rout || G.over.after)) await winBeats(G.over);
  return G.over;
}
// a battle line: the camera on its speaker (R.speakerOf: the unit the line names, else whoever stands there by that
// name, on any side), else on the cell the line points at (o.at), then the line
export async function speak(text, who, o = {}) {
  const u = R.speakerOf(who, o.unit), a = u && actorOf(u);
  // @qa battles
  cam.release(); if (a) cam.focus(a.pos); else if (o.at) cam.focus(cellAt(...o.at));
  await ui.say(text, who || null);
}
// a win the battle's hook declares with its own end: its lines, then the rout, then any lines after [ROM 0x1DA7C: every enemy still standing
// (not move type 9, not a phantom) falls in turn, the camera on each (0xB134), its death (0x103E8)]
async function winBeats(o) {
  for (const l of o.lines || []) await speak(l.text, l.who, l);
  if (o.rout) for (const u of G.units.filter(v => v.side === 'enemy' && v.alive && !v.away && v.moveType !== 9)) {
    const a = actorOf(u); if (!a) continue; cam.release(); cam.focus(a.pos); await wait(300); u.alive = false; await killAnim(u);
  }
  for (const l of o.after || []) await speak(l.text, l.who, l);   // (lines the hook speaks after its rout: battle 23's, 0x0F8086)
}

// ---------------------------------------------------------------- loop
let last = performance.now();
// the frame governor: the render scale (pixel ratio) that keeps a steady 60 Hz. It shrinks when frames are missed (2 of 30
// over 21 ms; by the
// GPU cost measured with world.takeGpu, pixels ~ scale², where there is a timer) and grows only with clear GPU headroom
// (without a timer: after 2 s of full-rate frames). It starts within a pixel
// budget, changes in 0.05 steps only, never right after a change (each one reallocates the post chain: a hitch), and a
// scale that proved too slow becomes a ceiling, so it settles instead of see-sawing. Frames over 120 ms (loading a world,
// compiling shaders) are not counted. #fps shows it; #noscale turns it off.
const perf = { acc: 0, n: 0, scale: 0, max: Math.min(1.5, window.devicePixelRatio || 1), min: 0.6, cool: 0, fps: 0, gpu: 0, good: 0, ceil: 9, ceilAt: 0, floor: 0, miss: 0, before: 0, show: /fps/.test(location.hash) };
const BUDGET = 12, PIXELS = 2.6e6;   // GPU ms aimed at when there is room to grow (60 Hz leaves 16.7); start at most this many pixels
const step = k => Math.round(Math.min(perf.max, Math.max(perf.min, k)) * 20) / 20;
export function governor(ms) {
  if (/noscale/.test(location.hash)) return;
  if (!perf.scale) { perf.scale = step(Math.min(perf.max, Math.sqrt(PIXELS / (window.innerWidth * window.innerHeight)))); world.setScale(perf.scale); perf.cool = 1; }
  if (ms > 120) { perf.acc = perf.n = perf.miss = 0; world.takeGpu(); return; }
  perf.acc += ms; perf.n++; if (ms > 21) perf.miss++;
  if (perf.n < 30) return;
  const avg = perf.acc / perf.n, gpu = world.takeGpu(), missed = perf.miss >= 2; perf.fps = 1000 / avg; perf.gpu = gpu; perf.acc = perf.n = perf.miss = 0;
  if (perf.cool > 0) { perf.cool--; return; }
  let k = perf.scale;
  if (perf.before && gpu != null) { if (gpu > perf.before.gpu * 0.85) perf.floor = perf.before.scale; perf.before = 0; }   // a drop that saved little: the cost is not in the pixels, stop shrinking
  if (missed) k *= gpu != null && gpu > BUDGET ? Math.max(0.75, Math.sqrt(BUDGET / gpu)) : avg > 28 ? 0.8 : 0.9;   // frames missed
  else if (gpu != null ? gpu < BUDGET * 0.8 : avg < 17.6 && ++perf.good >= 4) { perf.good = 0; k = gpu != null ? Math.min(k * 1.15, k * Math.sqrt(BUDGET / gpu)) : k * 1.08; }   // clear headroom
  if (k < perf.scale) { perf.ceil = Math.min(perf.ceil, perf.scale - 0.05); perf.ceilAt = performance.now(); perf.good = 0; }
  else if (perf.ceil < 9 && performance.now() - perf.ceilAt > 30000) { perf.ceil += 0.05; perf.ceilAt = performance.now(); }   // a heavy stretch (a big spell) does not cap it for good
  k = step(Math.max(Math.min(k, perf.ceil), perf.floor));
  if (Math.abs(k - perf.scale) >= 0.05) { if (k < perf.scale && gpu != null) perf.before = { gpu, scale: perf.scale }; perf.scale = k; world.setScale(k); perf.cool = 2; }
  if (perf.show) $('fps').textContent = perf.fps.toFixed(0) + ' fps · ' + (gpu != null ? gpu.toFixed(1) + ' ms GPU · ' : '') + (perf.scale * 100 | 0) + '%';
}
export const perfState = () => ({ fps: perf.fps, gpu: perf.gpu, scale: perf.scale, ceil: perf.ceil, floor: perf.floor });
export function frame(now) {
  const ms = now - last; if (cam && ready && !frozen) governor(ms);
  const rdt = frozen ? stepDt : Math.max(0, Math.min(0.05, ms / 1000)); last = Math.max(last, now); stepDt = 0;   // a frame stamped before the last one counts as no time
  let dt = rdt * timeScale * speed();   // (speed: the player's pick, top right, src/speed.js)
  if (vfx && vfx.hitstop > 0) { vfx.hitstop -= rdt; dt *= 0.04; }
  gameT += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.d); w.fn && w.fn(k, dt); if (k >= 1) { tweens.splice(i, 1); w.res(); } }
  if (cam && ready) {
    canvasRect = world.renderer.domElement.getBoundingClientRect();
    cam.update(rdt, vfx ? vfx.screen.shake : 0);
    const f = G.active && actorOf(G.active) ? actorOf(G.active).pos : cam.target;   // see-through follows the acting unit, never the cursor
    world.shadowsLive = tweens.length > 0; for (const a of actors.values()) if (a.walking) world.shadowsLive = true;   // anything animating (a walk, a blow): shadows every frame, or they trail the sprites at half rate
    world.update(dt, gameT);
    vfx.update(dt, gameT); if (!world.calm) vfx.ambient(dt, cam.target);
    vfx.add.mat.uniforms.uScale.value = vfx.soft.mat.uniforms.uScale.value = world.renderer.domElement.height / (2 * Math.tan(world.camera.fov * Math.PI / 360));
    for (const a of actors.values()) a.update(gameT, world.camera, cam.yaw, cam.pitch);
    obstruct(dt);
    tiles.update(gameT); activeMark.update(gameT, G.active ? actorOf(G.active) : null); targetMark.update(gameT);
    ui.layout(project, [...actors.values()], dt, !$('hud').classList.contains('hidden'));
    if (menuAnchor) { const [x, y] = menuPos(); for (const m of [$('menu'), $('ring')]) if (m) { m.style.left = x + 'px'; m.style.top = y + 'px'; } }
    if (PG.frame) PG.frame();
    world.render();
    if (window.__qaFrame) window.__qaFrame();   // #qa probes read the frame just drawn (src/qa.js)
  }
  if (stepDone) { const f = stepDone; stepDone = null; f(); }
  requestAnimationFrame(frame);
}
export function resize() { world.resize(window.innerWidth, window.innerHeight); }

// a swing at an empty tile (the arena only): a stand-in target with just enough of an actor for the attack animation
export async function swingAt(au, x, y, onHit) {
  R.faceTo(au, x, y);
  const p = tileCenter(x, y), stand = { pos: p, off: new THREE.Vector2(), hover: 0, act: null, flash: 0,
    chest() { return V(p.x, p.y + 0.5, p.z); }, head() { return V(p.x, p.y + 1.05, p.z); } };
  await attackAnim(au, { side: 'none', facing: 'left', stand }, { miss: false, crit: !onHit && Math.random() < 0.25, dmg: 0 }, onHit);   // a chest: no critical pause before the blow
}
// the battle's HUD line: the round, and the battle's own meter when it has one (磻溪's fire)
export function hudRound() { ui.round(G.round, R.H.hud ? R.H.hud(G) : null); }
// lay out a battle: units on their cells, then the battle's own staging (磻溪's burning forest)
export function stage(chosen) {
  R.setupBattle(chosen); ui.clearUnits(); syncActors();
  for (const a of actors.values()) { placeActor(a); a.dissolve = a.u.alive ? 0 : 1; }
  if (FX.stage) FX.stage(E);
  warmUp();   // (the units' sprites, and what the battle's own staging added)
}
// the test tools fill these in (src/testkit.js); toolbar actions queue up and run at safe points in a turn
export const PG = { queue: [], popup: false, endPhase: false, enemiesAct: true, sel: null, flush: async () => {}, frame: null };

// once per page: the renderer, camera rig, UI, input and the frame loop
let ready = false;
export function boot() {
  world = new World($('gl'));
  window.addEventListener('resize', resize); resize();
  bank = new SpriteBank(); ui = new UI(bank); cam = new Cam(world.camera);
  setupInput();
  window.__remake = { G, R, actors, cam, tiles, C, cellInfo, pick: (x, y) => pick({ clientX: x, clientY: y }), cellLevel: levelY, vfx, world, W: world, push, opts, castSpell, scripted, syncActors, placeActor, walkActor, standAt, isFlier, levelUpAnim, enterRoom, set: () => FX.look && FX.look.set, clock: () => gameT, levelPose: LEVEL_POSE, groundLight, measureLight, freeze: on => { frozen = !!on; }, step: dt => new Promise(res => { frozen = true; stepDt = dt; stepDone = res; }), bank, doAttack, useItem, openChest, strikeChest, swingAt, popChest, tileCenter, actorOf, perfState, downCheck, squaresCold };
  requestAnimationFrame(frame);
}
// build the world for the loaded battle (R.loadBattle first) and load its sprites; again for every new battle
export async function loadWorld(fx, progress) {
  ready = false; FX = fx || {};
  for (const a of actors.values()) a.dispose(world.scene);
  actors.clear(); ui.clearUnits(); G.units = []; G.active = null;
  world.reset();
  setLook(FX.look || { mapSD: 'assets/battles/' + String(D.n).padStart(2, '0') + '/map.png' });
  await world.build(p => progress && progress(p * 0.8));
  resize();
  vfx = new VFX(world); tiles = new Tiles(world.scene); activeMark = new ActiveMark(world.scene); targetMark = new TargetMark(world.scene);
  const names = new Set([...D.party, ...[D.enemies, ...(D.rooms || []).map(r => r.enemies)].flat().flatMap(e => e.summon ? [e, e.summon] : [e])].map(u => u.sprite).concat(FX.sprites || [])
    .concat(opts.test ? globalThis.COMMON.heroes.map(h => spriteKey(h.gfx)) : []));   // the test tools can bring in any hero
  await bank.load([...names]);
  progress && progress(1);
  if (!(FX.look && FX.look.set)) measureLight();   // a remade set measures once it is dressed (main.js openBattle)
  Object.assign(window.__remake, { tiles, vfx, groundLum: () => groundLum });
  ready = true;
}
