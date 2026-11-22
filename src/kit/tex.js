// Procedural PBR textures for the remade sets: nothing here comes from the ROM. Each recipe paints a tileable square
// (colour, relief, roughness) pixel by pixel from seeded noise and cell patterns; relief becomes a normal map. Results
// are cached by name, so the materials of a set rebuild instantly on the next visit.
// The shared recipes are src/kit/paint.js's, which a pool of workers can paint ahead (prepaint): a 1024 px recipe took
// the main thread 0.2-0.6 s, a set's 3-5 s on this Mac and several times that on a phone, the screen dark and still and
// the next scene's song already playing [the user's report, 2026-11-21: the changes of scene and map lagged]. A world's
// recipes (plan: learnt in this browser, else texplan.data.js, made by tools/qa/texplan.js) are painted side by side
// off the main thread before the world is built (src/scene.js setMap, src/main.js openBattle), and the next map's while
// this one plays. A set's own recipes live in src/remake/paint/<set>.js (T.use('<set>.<recipe>'), src/kit/recipes.js); the
// few it still paints inline (T.pbr) are painted where it asks. tools/qa/xfade.js
import * as THREE from 'three';
import { paintArrays } from './paint.js';
import { RECIPES } from './recipes.js';
import PLAN from './texplan.data.js';
export { pnoise, fbm, fbmA, worley, clamp, smooth, mix, hex, mixc } from './paint.js';

// ---------------------------------------------------------------- painting
// The cache is bounded [the user's call: the Windows app's memory]: every recipe painted used to stay, 441 MB after the
// seven maps of scene 65. The recipes of the world being built always stay; of the others, the most recently used up to
// KEEP bytes (a room or set gone back to soon is still instant; one long gone is painted again). World.reset calls
// newWorld. (A recipe let go is freed once no material holds it: world.reset has disposed the old world's on the GPU.)
const CACHE = new Map(), KEEP = 128 * 1048576; let GEN = 0;
const bytesOf = t => ['map', 'normalMap', 'arm', '_em'].reduce((b, k) => b + (t[k] ? t[k].image.data.byteLength : 0), 0);
function trim() {
  let other = 0; for (const t of CACHE.values()) if (t.gen !== GEN) other += bytesOf(t);
  for (const [k, t] of CACHE) { if (other <= KEEP) break; if (t.gen >= GEN) continue; CACHE.delete(k); other -= bytesOf(t); }   // (oldest first: a Map keeps its order, a hit moves to the end; painted ahead for the next world, gen GEN + 1: kept, but counted in KEEP, so the old ones make room for it)
}
export function newWorld() { GEN++; USED.clear(); trim(); }
function dataTex(data, n, srgb) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
// paint(u, v, o): as src/kit/paint.js paintArrays (a set's own recipe, painted here when it asks)
export function pbr(name, n, paint, bump = 2) {
  if (CACHE.has(name)) { const t = CACHE.get(name); CACHE.delete(name); CACHE.set(name, t); t.gen = Math.max(t.gen, GEN); return t; }
  const out = make(paintArrays(n, paint, bump), n);
  out.gen = GEN; CACHE.set(name, out); trim(); return out;
}
// roughness in G, metalness in B (three's convention for roughnessMap / metalnessMap); emission in R
function make(r, n) { return { map: dataTex(r.col, n, true), normalMap: dataTex(r.nor, n, false), arm: dataTex(r.arm, n, false), alpha: r.alpha, metal: r.metal, emis: r.emis }; }
// ---------------------------------------------------------------- the shared recipes, and painting them ahead
// each recipe as tex.js has always offered it (T.rock(0x7a6a58, 'cliff')), noted as used by the world being built
const USED = new Map();   // cache name -> [recipe, args], since newWorld
const recipe = fn => (...args) => { const [name, n, paint, bump] = RECIPES[fn](...args); if (!USED.has(name)) USED.set(name, [fn, args]); return pbr(name, n, paint, bump); };
// a set's own recipe (src/remake/paint/<set>.js), as the shared ones: T.use('lair.slabTex')
export const use = (fn, ...args) => recipe(fn)(...args);
// the recipes the world built since newWorld used: [[recipe, args], ...] (a plan: learn, tools/qa/texplan.js)
export const used = () => [...USED.values()].map(([fn, args]) => [fn, args.map(a => a === undefined ? null : a)]);
let pool = null, seq = 0; const flying = new Map(), waiting = new Map();   // name -> its promise; job id -> { res, w }
function workers() {
  if (pool) return pool;
  pool = [];
  if (typeof Worker === 'undefined' || /[#&]nopaint\b/.test(location.hash)) return pool;   // (&nopaint: everything on the main thread, as before: an A / B for tools/qa/xfade.js)
  const k = +((location.hash.match(/[#&]painters=(\d+)/) || [])[1]) || Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));   // (&painters=N: the pool's size, to measure)
  for (let i = 0; i < k; i++) {
    try {
      const w = new Worker(new URL('./paintworker.js', import.meta.url), { type: 'module' }); w.jobs = 0;
      w.onmessage = ({ data: d }) => { const j = waiting.get(d.id); if (!j) return; waiting.delete(d.id); w.jobs--; j.res(d); };
      w.onerror = () => { for (const [id, j] of waiting) if (j.w === w) { waiting.delete(id); j.res({ error: 'worker' }); } w.jobs = 0; w.dead = true; };
      pool.push(w);
    } catch (e) { break; }   // (no module workers here: painted on the main thread as before)
  }
  return pool;
}
// paint these recipes ahead ([[recipe, args], ...], a plan), side by side in the workers; resolves once each is in the
// cache (or failed: then the set paints it itself when it asks). For the world about to be built or the next one: kept
// through one newWorld (gen GEN + 1). Already cached or under way: nothing more.
// ahead (the next world, painted while this one plays): AHEAD at a time, the rest queued, so the workers leave the cores
// to the frames being drawn (all six at once gave a scene's play long frames: tools/qa/tour.js scene 25's camera jump);
// a build that waits for one still queued sends it at once.
const AHEAD = 2, later = []; let aheadBusy = 0;
function post(job) {
  const ws = workers().filter(w => !w.dead); if (!ws.length) return job.res({ error: 'worker' });
  const w = ws.reduce((a, b) => b.jobs < a.jobs ? b : a), id = ++seq; w.jobs++; job.posted = true;
  waiting.set(id, { res: d => { if (job.ahead) { aheadBusy--; pump(); } job.res(d); }, w }); w.postMessage({ id, fn: job.fn, args: job.args });
}
function pump() { while (aheadBusy < AHEAD && later.length) { const j = later.shift(); aheadBusy++; post(j); } }
export function prepaint(list, ahead = false) {
  const ws = workers().filter(w => !w.dead), all = [];
  if (!ws.length || !list) return Promise.resolve();
  for (const [fn, raw] of list) {
    if (!RECIPES[fn]) continue;
    const args = raw.map(a => a === null ? undefined : a), name = RECIPES[fn](...args)[0];   // (a plan's JSON keeps no undefined: null stands for it, a recipe's default)
    if (CACHE.has(name)) { CACHE.get(name).gen = Math.max(CACHE.get(name).gen, GEN + 1); continue; }
    if (!flying.has(name)) {
      const job = { fn, args, ahead };
      const p = new Promise(res => { job.res = res; }).then(d => {
        flying.delete(name);
        if (d.error || d.name !== name || CACHE.has(name)) return;
        const out = make(d, d.n); out.gen = GEN + 1; CACHE.set(name, out); trim();
      });
      p.job = job; flying.set(name, p);
      if (ahead) { later.push(job); pump(); } else post(job);
    } else if (!ahead) { const job = flying.get(name).job, i = later.indexOf(job); if (i >= 0) { later.splice(i, 1); job.ahead = false; post(job); } }   // (queued ahead, wanted now)
    all.push(flying.get(name));
  }
  return Promise.all(all).then(() => {});
}
// a world's plan: what it used when last built in this browser (learn), else texplan.data.js; key: 'map:<key>', 'battle:<n>', 'title'
const LEARNT = 'fengshen.texplan', QA = typeof location !== 'undefined' && /[#&]qa\b/.test(location.hash);
let learnt = null;
const learnt0 = () => { if (learnt) return learnt; learnt = {}; if (!QA) try { learnt = JSON.parse(localStorage.getItem(LEARNT) || '{}') || {}; } catch (e) { /* none */ } return learnt; };
export const planOf = key => learnt0()[key] || PLAN[key] || [];
// once a world is built: its plan is what it used (a QA page keeps nothing: its checks run on texplan.data.js alone)
export function learn(key) {
  const l = learnt0(), u = used(); if (!u.length || QA) return;
  l[key] = u; try { localStorage.setItem(LEARNT, JSON.stringify(l)); } catch (e) { /* not remembered */ }
}
// what the cache holds: recipes and their painted bytes (tools/qa: memory)
export const cacheStats = () => { let b = 0, cur = 0; for (const t of CACHE.values()) { b += bytesOf(t); if (t.gen === GEN) cur += bytesOf(t); } return { n: CACHE.size, mb: Math.round(b / 1048576), inUse: Math.round(cur / 1048576) }; };
// a MeshStandard / MeshPhysical material from a recipe; o: extra material options, rep: texture repeat [u, v]
export function material(t, o = {}, rep) {
  const phys = o.clearcoat || o.sheen;
  const opts = Object.assign({ map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, roughness: 1, metalness: t.metal ? 1 : 0 }, o);
  if (t.metal) opts.metalnessMap = t.arm;
  if (t.alpha && opts.alphaTest == null && !opts.transparent) opts.alphaTest = 0.5;
  if (t.emis && !o.emissiveMap) { opts.emissiveMap = emisMap(t); opts.emissive = opts.emissive ?? new THREE.Color(1, 0.85, 0.6); }
  delete opts.rep;
  const m = phys ? new THREE.MeshPhysicalMaterial(opts) : new THREE.MeshStandardMaterial(opts);
  if (rep) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(rep[0], rep[1]); m[k].needsUpdate = true; }
  if (o.normalScale != null) m.normalScale.setScalar(o.normalScale);
  return m;
}
function emisMap(t) {   // the emission channel (R of arm) as its own map
  if (t._em) return t._em;
  const src = t.arm.image.data, n = t.arm.image.width, d = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = src[i * 4]; d[i * 4 + 3] = 255; }
  return (t._em = dataTex(d, n, false));
}

// ---------------------------------------------------------------- recipes (src/kit/paint.js)
export const palaceFloor = recipe('palaceFloor'), latticeFloor = recipe('latticeFloor'), mansionCarpet = recipe('mansionCarpet'), cloudRelief = recipe('cloudRelief'), lacquer = recipe('lacquer'), gold = recipe('gold'), bronze = recipe('bronze'), silk = recipe('silk'), carpet = recipe('carpet'), lattice = recipe('lattice'), paper = recipe('paper'), flags = recipe('flags'), bricks = recipe('bricks'), jade = recipe('jade'), wood = recipe('wood'), planks = recipe('planks'), dirt = recipe('dirt'), turf = recipe('turf'), rock = recipe('rock'), seaRock = recipe('seaRock'), roofTiles = recipe('roofTiles'), plaster = recipe('plaster'), marble = recipe('marble'), bark = recipe('bark'), weave = recipe('weave'), caihua = recipe('caihua');
