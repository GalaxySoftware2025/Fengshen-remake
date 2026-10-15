// Test tools (battle/index.html): a toolbar and a popup over any battle, and the 演武場 arena.
//  - #battle=N&test: the real battle, its rules and turn order, with the toolbar: bring in any hero of the roster (or
//    back from the dead), add any of the battle's enemies, raise every hero to Lv 99, end our turns for the round,
//    switch the enemies' turns off, put the enemies back as they started, heal everyone; the hero whose turn it is gets
//    a popup beside it (kill, 1 HP, a level, Lv 99, remove).
//  - #arena: 演武場, a small open arena with a fixed camera for trying out heroes, enemies and spells: click any hero to
//    select it, move and act; heroes may hit empty tiles. When every hero has acted (or 結束回合), the demons close in
//    and fight back. No win or loss. It plays on 磻溪's data and look, swapped for the arena below.
// Toolbar actions queue up and run at safe points, so they never cut an animation.
import * as R from './rules.js';
import { PG, ui, world, vfx, bank, cam, actors, actorOf, syncActors, placeActor, killAnim, flinch, levelUpAnim, anim,
  tileCenter, project, input, push, playerTurn, aiTurn, opts } from './battle.js';
import * as E from './battle.js';
import { hero } from './party.js';
const { D, G } = R;
const $ = id => document.getElementById(id);

// the arena: swaps the 32x14 valley for a small open clearing before the world is built. Each arena cell borrows the
// ground art of an interior path cell of the original map, so it keeps the same look.
export function arena(D) {
  const W = 11, H = 8, T = D.terrain;
  const open = (x, y) => T[y] && T[y][x] === 0 && x < 30;
  const src = [];
  for (let y = 0; y < D.mapH; y++) for (let x = 0; x < 30; x++) if (open(x, y) && open(x + 1, y) && open(x - 1, y) && open(x, y + 1) && open(x, y - 1)) src.push([x, y]);
  D.arena = true; D.mapW = W; D.mapH = H;
  D.terrain = Array.from({ length: H }, () => Array(W).fill(0));
  D.terrain[1][5] = D.terrain[6][5] = 2;            // two bamboo clumps for a little cover
  D.artSrc = D.terrain.map((r, y) => r.map((_, x) => src[(x * 7 + y * 13) % src.length]));
}

// the arena's spawn cells and wave; in a battle, heroes come in on its deploy cells and enemies where theirs started
Object.assign(PG, {
  spawn: [[1, 3], [1, 4], [2, 2], [2, 5], [1, 2], [1, 5], [2, 3], [2, 4], [0, 3], [0, 4], [1, 1], [1, 6]],
  wave: [['fox', 6, 3], ['fox', 6, 5], ['ghost', 7, 2], ['archer', 8, 4], ['archer', 8, 6]],
  foeAt: [7, 4], enemiesAct: true, sel: null, key: '',
});
const ARENA_FOES = { fox: '妖獸', archer: '鐵弓手', ghost: '鬼靈' };
// the enemies the picker offers: the arena's three, or one of each kind in this battle (the first of its sprite)
const foeKinds = () => opts.arena ? Object.entries(ARENA_FOES).map(([k, name]) => [D.enemies.find(e => e.sprite === k), name])
  : [...new Map(D.enemies.filter(e => (e.side || 'enemy') === 'enemy').map(e => [e.sprite, e])).values()].map(e => [e, e.name]);
function pgFree(u, prefs) {          // first free walkable cell among prefs, else the nearest one to prefs[0]
  const ok = (x, y) => R.inMap(x, y) && R.cost(u, x, y) < 127 && !R.unitAt(x, y);
  for (const [x, y] of prefs) if (ok(x, y)) return [x, y];
  const seen = new Set([R.key(...prefs[0])]), q = [prefs[0]];
  while (q.length) {
    const [x, y] = q.shift(); if (ok(x, y)) return [x, y];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [x + dx, y + dy], k = R.key(...n); if (R.inMap(...n) && !seen.has(k)) { seen.add(k); q.push(n); } }
  }
  return null;
}
function pgPlace(u, prefs) {
  const c = pgFree(u, prefs); if (!c) { ui.toast('沒有空位了', 800); return false; }
  [u.x, u.y] = c; const old = actorOf(u); if (old) { old.dispose(world.scene); actors.delete(u); }
  if (!G.units.includes(u)) G.units.push(u);
  syncActors(); placeActor(actorOf(u));
  vfx.ring(actorOf(u).pos, u.side === 'player' ? [0.6, 0.8, 1] : [1, 0.4, 0.3], 1, 0.5, { intensity: 0.6 });
  return true;
}
function pgFoe(src, at) {
  const u = R.makeUnit(src, 'enemy', { ai: 0 }); u.facing = 'left';
  pgPlace(u, at ? [at] : opts.arena ? [PG.foeAt] : [[src.x, src.y]]);
}
function pgWave() {
  if (opts.arena) for (const [k, x, y] of PG.wave) pgFoe(D.enemies.find(e => e.sprite === k), [x, y]);
  else for (const e of D.enemies) if ((e.side || 'enemy') === 'enemy') {   // the battle's enemies as they started (their own AI and slots)
    const u = R.makeUnit(e, 'enemy', { slot: e.slot }); u.facing = 'left'; pgPlace(u, [[e.x, e.y]]);
  }
}
// straight to Lv 99 on the hero's own growth table (spells learnt on the way), healed; no level-up show per level
export function maxLevel(u) {
  const lv0 = u.lv, learnt = [];
  while (u.lv < 99) { const ch = R.levelUp(u); if (ch.spell != null) learnt.push(D.spells[ch.spell].name); }
  Object.assign(u, { exp: 0, hp: u.mhp, mp: u.mmp });
  return { from: lv0, learnt };
}
async function maxAnim(us) {
  const up = us.filter(u => u.alive && u.lv < 99); if (!up.length) return ui.toast('已達最高等級', 800);
  const told = up.map(u => { const r = maxLevel(u); const a = actorOf(u); vfx.pillar(a.pos, [1, 0.85, 0.4], 0.5, 4, 1.2, { intensity: 0.7, grow: 1 }); return u.name + ' Lv ' + r.from + '→99' + (r.learnt.length ? '（學會 ' + r.learnt.join('、') + '）' : ''); });
  PG.key = ''; ui.card(up[0]);
  await ui.say(told.join('\n'), null, 2600);
}
// every hero of the game: the battle's party first (as it stands), then the rest at the party's average level with the
// spells they have learnt by then; in the arena 楊戩 also holds every summon (the story hands them out), so each can be tried
const SUMMONS = [52, 53, 54, 55, 56, 57];
function roster() {
  if (PG.roster && PG.rosterOf === D.party) return PG.roster;
  const C = globalThis.COMMON, have = new Set(D.party.map(p => p.cid)), lv = Math.round(D.party.reduce((s, p) => s + p.lv, 0) / Math.max(1, D.party.length)) || 1;
  PG.roster = D.party.concat(C.heroes.filter(h => !have.has(h.cid)).map(h => hero(C, h.cid, Math.max(h.lv, lv)))); PG.rosterOf = D.party;
  if (opts.arena) for (const p of PG.roster) if (p.cid === 2) for (const s of SUMMONS) if (!p.spells.includes(s)) p.spells.push(s);
  return PG.roster;
}
function pgHero(i) {
  const p = roster()[i]; let u = G.units.find(v => v.side === 'player' && v.cid === p.cid);
  if (u && u.alive) { PG.sel = u; return; }
  if (u) Object.assign(u, { alive: true, hp: u.mhp, mp: u.mmp, status: { sleep: 0, seal: 0, poison: 0 }, buf: {} });   // a fallen hero returns, keeping its level
  else u = R.makeUnit(p, 'player');
  u.facing = 'right'; u.done = !opts.arena; if (pgPlace(u, opts.arena ? PG.spawn : D.deploy)) PG.sel = opts.arena ? u : PG.sel;   // in a battle: acts from the next round
}
function pgRemove(u) { const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1); if (PG.sel === u) PG.sel = null; syncActors(); }
const pgRun = fn => { PG.queue.push(fn); push({ k: 'PG' }); };
async function pgFlush() { const was = PG.popup; PG.popup = false; while (PG.queue.length) await PG.queue.shift()(); PG.popup = was; pgFly(); }
const PG_ACTS = [
  ['陣亡', 'kill', async u => { if (u.alive) { u.hp = 0; u.alive = false; PG.sel = null; await killAnim(u); } }],
  ['瀕死', '', async u => { if (u.alive) { u.hp = 1; flinch(actorOf(u), 1); } }],
  ['升級', '', async u => { if (!u.alive) return; if (u.lv >= 99) return ui.toast('已達最高等級', 800); u.exp = 0; await levelUpAnim(u, R.levelUp(u)); }],
  ['Lv 99', '', async u => maxAnim([u])],
  ['移除', '', async u => pgRemove(u)],
];
// the hero picker fly-out (also used to bring the fallen back) and the enemy picker
function pgFly() {
  const H = $('pg-heroes'); H.innerHTML = '';
  roster().forEach((p, i) => {
    const u = G.units.find(v => v.side === 'player' && v.cid === p.cid), b = document.createElement('div');
    b.className = 'pg-h' + (u ? (u.alive ? ' on' : ' dead') : '');
    b.appendChild(bank.portrait(p.sprite, 2));
    b.insertAdjacentHTML('beforeend', `<span>${p.name}</span><small>${u ? (u.alive ? '在場' : '復活') : 'Lv ' + p.lv}</small>`);
    b.onclick = () => { pgRun(async () => pgHero(i)); pgOpen(null); };
    H.appendChild(b);
  });
  $('pg-act').textContent = '敵人行動：' + (PG.enemiesAct ? '開' : '關'); $('pg-act').classList.toggle('on', PG.enemiesAct);
}
function pgOpen(id) { for (const f of ['pg-heroes', 'pg-foes']) $(f).classList.toggle('hidden', f !== id || !$(f).classList.contains('hidden')); }
// the popup beside the selected hero, kept on the sprite each frame
function pgPop() {
  const u = PG.sel, el = $('pg-pop');
  const show = u && u.alive && PG.popup && actorOf(u) && !E.menuAnchor;
  el.classList.toggle('hidden', !show); if (!show) return;
  const key = [u.name, u.lv, u.hp, u.mhp, u.done].join();
  if (key !== PG.key) {
    PG.key = key; el.innerHTML = `<div class="pg-nm"><b>${u.name}</b><small>Lv ${u.lv}　${u.hp}/${u.mhp}${u.done ? '　已行動' : ''}</small></div>`;
    for (const [label, cls, fn] of PG_ACTS) { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = e => { e.stopPropagation(); pgRun(() => fn(u)); }; el.appendChild(b); }
  }
  const p = project(actorOf(u).head()); el.style.left = (p.x + 34) + 'px'; el.style.top = (p.y - 18) + 'px';
}
// the toolbar and popup, over a battle or the arena (after the battle's world is built)
export function pgSetup() {
  PG.flush = pgFlush; PG.frame = pgPop; PG.on = true;
  document.body.classList.add('tools');
  const F = $('pg-foes'); F.innerHTML = '';
  for (const [src, name] of foeKinds()) {
    const b = document.createElement('div'); b.className = 'pg-h';
    b.appendChild(bank.portrait(src.sprite, 2)); b.insertAdjacentHTML('beforeend', `<span>${name}</span><small>Lv ${src.lv}</small>`);
    b.onclick = () => { pgRun(async () => pgFoe(src)); pgOpen(null); }; F.appendChild(b);
  }
  $('pg-add').onclick = () => pgOpen('pg-heroes'); $('pg-addfoe').onclick = () => pgOpen('pg-foes');
  $('pg-end').onclick = () => { PG.endPhase = true; push({ k: 'PG' }); };
  $('pg-act').onclick = () => { PG.enemiesAct = !PG.enemiesAct; pgFly(); };
  $('pg-reset').onclick = () => pgRun(async () => { for (const v of G.units.filter(v => v.side === 'enemy')) pgRemove(v); pgWave(); });
  $('pg-max').onclick = () => pgRun(async () => maxAnim(R.players()));
  $('pg-heal').onclick = () => pgRun(async () => { for (const u of R.players()) { Object.assign(u, { hp: u.mhp, mp: u.mmp, status: { sleep: 0, seal: 0, poison: 0 } }); const a = actorOf(u); a.flash = 0.5; anim(0.6, k => { a.flash = 0.5 * (1 - k); }); } });
  for (const id of ['pg', 'pg-heroes', 'pg-foes', 'pg-pop']) $(id).addEventListener('mousedown', e => e.preventDefault());   // keep focus off the buttons so Enter / Space stay game keys
  pgFly();
  Object.assign(window.__remake, { PG, pgRun, ui, levelUpAnim, killAnim, maxLevel });
}
// the arena: an empty field, the camera fixed over it, the first wave
export function arenaSetup() {
  document.body.classList.add('arena');
  Object.assign(G, { units: [], round: 0, fireCol: 99, burnt: new Set(), terrain: D.terrain.map(r => r.slice()), over: null, triggerFired: true });
  vfx.fire.cols.clear(); world.setFire(99, 0);
  // fixed camera over the whole arena: attacks and spells may still pan, and always come back here
  const home = tileCenter((R.MAP_W - 1) / 2 - 0.8, (R.MAP_H - 1) / 2 + 0.5), rel = cam.release.bind(cam);
  cam.focus = () => {}; cam.release = () => rel(home); cam.release(); cam.snap();
  pgWave(); pgFly();
}
async function pgSelect() {          // wait for a hero to be clicked; a panel action returns null
  for (;;) {
    ui.hint(R.players().length ? '點擊我方角色以行動' : '點擊左側「＋ 我方」加入角色');
    PG.popup = true;
    const ev = await input();
    if (ev.k === 'PG') { PG.popup = false; return null; }
    if (ev.k === 'B') PG.sel = null;
    if (ev.k === 'hover') { ui.card(R.unitAt(...ev.t) || PG.sel); continue; }
    if (ev.k !== 'click') continue;
    const o = R.unitAt(...ev.t); PG.sel = o && o.side === 'player' ? o : null;
    if (o) ui.card(o);
    if (PG.sel && !PG.sel.done) { PG.popup = false; ui.hint(''); return PG.sel; }
  }
}
export async function pgLoop() {
  for (;;) {
    for (const v of G.units) v.done = false;
    let next = null;
    for (;;) {                                           // our phase: heroes act in any order
      await pgFlush();
      if (PG.endPhase) break;
      if (R.players().length && R.players().every(u => u.done)) break;
      const u = next && next.alive && !next.done ? next : await pgSelect(); next = null;
      if (!u) continue;
      PG.sel = u; G.active = u;
      const res = await playerTurn(u);
      G.active = null; ui.card(null);
      if (res && res.switch) next = res.switch; else if (res === 'acted') u.done = true;
    }
    PG.endPhase = false; PG.sel = null; ui.hint('');
    if (PG.enemiesAct) for (const e of R.turnOrder().filter(v => v.side === 'enemy')) {   // their phase, fastest first
      if (!e.alive || !R.players().length) continue;
      await pgFlush(); G.active = e; await aiTurn(e); G.active = null; e.done = true; ui.card(null);
    }
    if (!G.units.some(v => v.side === 'enemy' && v.alive)) { for (const v of G.units.filter(v => v.side === 'enemy')) pgRemove(v); pgWave(); ui.toast('敵人重新集結', 900); }
  }
}
