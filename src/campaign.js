// The campaign state between battles: where the story is, the roster, the shared bag. Renderer-free (the tests run it).
// A save (save.js) is this object as JSON:
//   { scene: 'prologue' | 'prologue2' | 0..64 | 'end', part: 'intro' | 'outro', camp: true when at a battle's camp, battle: its n,
//     chapter: the chapter reached, place, roster: [hero records], bag: { itemId: count }, flags: {}, saves, wins,
//     chestFlags: { table: bits } (the chests opened before, ROM ff3252) }
// Rules from the ROM: after a battle every hero (cid ≤ 12) is written back to the roster fully healed, without the
// battle's temporary boosts [0x1BCCE]; held equipment is in effect while a hero holds it, its bonus added into the
// hero's stats when it moves from the bag and taken off when it goes back [0x169B0]; a hero holds up to 8 items, and
// the bag keeps up to 99 of each [0x163C8].
import { hero, JOIN_AT, autoPick } from './party.js';

const C = () => globalThis.COMMON;
const KEEP = ['cid', 'lv', 'exp', 'hp', 'mhp', 'mp', 'mmp', 'atk', 'df', 'spd', 'move', 'items', 'spells'];
export const MAX_HELD = 8, MAX_BAG = 99, LAST_BATTLE = 32;
const record = u => Object.fromEntries(KEEP.map(k => [k, Array.isArray(u[k]) ? u[k].slice() : u[k]]));

// a new game: the prologue (its two parts: the court and 妲己 before the title, 女媧 and 昌平村 after 新的開始), then scene 0, with 林雲 at his template level and an empty bag
export function newGame() {
  return { scene: 'prologue', part: 'intro', camp: false, battle: null, chapter: 0, place: '序章',
    roster: [record(hero(C(), 0, C().heroes[0].lv))], bag: {}, flags: {}, saves: 0, wins: 0 };
}
// for testing: the camp before battle n with the roster and bag the original has there (data/parties.js; 磻溪 only)
export function snapshotGame(n) {
  const C0 = C(), snap = globalThis.PARTIES[n];
  const roster = snap.map(r => record(hero(C0, r.cid, r.lv, { exp: r.exp, items: r.items, spells: r.spells })));
  return { scene: null, part: 'intro', camp: true, battle: n, chapter: 0, place: '', roster, bag: Object.assign({}, globalThis.BAGS[n]), flags: {}, saves: 0, wins: 0 };
}
// for the battle test page (test/index.html): a camp before battle n with the given party and 10 of every item in
// the bag [the user's call], so equipment can be tried out
export function testGame(party, n) {
  const bag = {}; C().items.forEach((it, id) => { bag[id] = 10; });
  return { scene: null, part: 'intro', camp: true, battle: n, chapter: 0, place: '', roster: party.map(record), bag, flags: {}, saves: 0, wins: 0, test: true };
}
// a hero joins (scene op 35 / 42): the template copied into the roster [ROM 0x1D8E]
export function join(state, cid) {
  if (!heroRec(state, cid)) { state.roster.push(record(hero(C(), cid, C().heroes[cid].lv))); state.roster.sort((a, b) => a.cid - b.cid); }
}
// a summon gained in a scene [native 0x0EDD80]: the spell into 楊戩's record (ff1050, the roster's third: cid 2), its
// first free slot of eight, once
export function summon(state, spell) {
  const r = heroRec(state, 2); if (!r || r.spells.includes(spell) || r.spells.length >= 8) return false;
  r.spells.push(spell); return true;
}
// the things the story hands a hero [the user's call: they never reached the party]: the original's scripts show them
// (the lines, 林雲's memory back at the 火靈珠) but put none in a hand or the bag that we could find (no call of the
// routine that gives an item, 0x13012, but the chests' and the drops'; no write to a held slot or the bag in scenes
// 25 and 39-56): each is given at the line it is handed over on, by scene and frame
//   火靈珠   scene 42 (after 九龍島, battle 21): 林雲 sees it in the 四聖騎's hoard and his memory comes back
//   天門雙寶 scene 54 (after 天門, battle 26): the guardian's 青翎劍 to 林雲, the 月影戒指 for 燕蓉
// @qa scene:42 scene:54 job:saving
export const GIFTS = {
  42: [{ f: 464, item: 20, to: 0, key: 'gift-42-20' }],
  54: [{ f: 1794, item: 21, to: 0, key: 'gift-54-21' }, { f: 2243, item: 18, to: 1, key: 'gift-54-18' }],
};
// a story gift, once (state.flags): into the hero's hands, equipped (its bonus on), or the bag when the hero cannot take it
// @qa scene:42 scene:54 job:saving
export function gift(state, g) {
  state.flags = state.flags || {}; if (state.flags[g.key]) return null;
  state.flags[g.key] = true;
  const r = heroRec(state, g.to), it = C().items[g.item];
  if (r && r.items.length < MAX_HELD && mayHold(r, it)) { r.items.push(g.item); equipBonus(r, it, 1); return r.cid; }
  state.bag[g.item] = Math.min(MAX_BAG, (state.bag[g.item] || 0) + 1); return 'bag';
}
// after a scene: the next one (66 scenes, the last the epilogue, then the title)
export function nextScene(state) {
  state.scene = state.scene === 'prologue' ? 'prologue2' : state.scene === 'prologue2' ? 0 : state.scene >= 65 ? 'end' : state.scene + 1;
  state.part = 'intro'; state.camp = false; state.battle = null;
  return state;
}
// the roster as unit sources for the battle (party.js fills in the template fields: name, sprite, growth, ...)
export const partyOf = state => state.roster.map(r => hero(C(), r.cid, r.lv, record(r)));
export const heroRec = (state, cid) => state.roster.find(r => r.cid === cid);

// entering the camp before battle B: the heroes who join in the scenes before it come in at their template level,
// and so does anyone the battle forces in or who has joined by then (a few joins are native code, like 燕蓉's)
export function enterCamp(state, B) {
  for (const j of B.party.joins) join(state, j.cid);
  for (const cid of B.party.forced) join(state, cid);
  JOIN_AT.forEach((n, cid) => { if (n <= B.n && !B.party.unavailable.includes(cid)) join(state, cid); });
  // @qa job:saving job:flow
  for (const [tag, list] of Object.entries(GIFTS)) if (+tag < B.scene) for (const g of list) gift(state, g);   // (a game saved past a gift's scene before it was given)
  state.place = B.name;
  return state;
}
// after the battle [ROM 0x1BCCE]: everyone who fought goes back to the roster, healed, buffs gone; a win moves on
export function afterBattle(state, units, won, found, chestFlags) {   // found: chest items no hero could hold (into the bag)
  for (const id of found || []) state.bag[id] = Math.min(MAX_BAG, (state.bag[id] || 0) + 1);
  if (chestFlags) state.chestFlags = JSON.parse(JSON.stringify(chestFlags));   // the chests opened, by table (ROM ff3252): kept, won or lost (rules.js loadChests)
  for (const u of units) {
    if (u.side !== 'player' || u.guest || u.cid > 12) continue;
    if (u.joinedHere && won) join(state, u.cid);   // joined during the battle (battle 4's 楊戩, ROM flag ff0eaf bit 1): on the roster from now on
    const r = heroRec(state, u.cid); if (!r) continue;
    Object.assign(r, record(u), { hp: u.mhp, mp: u.mmp });
  }
  if (won) { state.wins++; state.camp = false; state.part = 'outro'; }
  return state;
}
// who goes, as the camp opens: kept from an earlier visit to this battle's camp (a loss, a reload) if still allowed, else
// only the heroes the battle must take, the rest grey and standing until chosen [the user's call; the original too starts
// from 林雲 alone]. The picks carry the battle they were made for: the next battle's camp starts again from its required
// heroes [the user's report: they were carried over from the battle before]
export function campPick(state, n, party, P) {
  const ok = c => party.some(p => p.cid === c) && !P.unavailable.includes(c);
  if (state.pickFor !== n || !Array.isArray(state.pick) || !state.pick.every(ok) || state.pick.length > P.deployMax || !P.forced.every(c => !ok(c) || state.pick.includes(c)))
    state.pick = autoPick(party, P).filter(p => P.forced.includes(p.cid)).map(p => p.cid);
  state.pickFor = n;
  return state.pick;
}
export const summary = state => ({ place: state.place, lv: (heroRec(state, 0) || { lv: 1 }).lv, saves: state.saves });

// ---------------------------------------------------------------- items
const ELEM_LOCK = { 17: 2, 18: 1 };   // kind 17: 白虎 element only, 18: 青龍 element only (the element is the move type)
const HERO_LOCK = { 14: 0, 15: 1, 16: 5 };   // kind 14: 林雲 only, 15: 燕蓉 only, 16: 姬發 only
export function mayHold(r, it) {
  if (it.kind in HERO_LOCK) return r.cid === HERO_LOCK[it.kind];
  if (it.kind in ELEM_LOCK) return C().heroes[r.cid].moveType === ELEM_LOCK[it.kind];
  return true;
}
// [ROM 0x169B0] a held equipment item's bonus, into or out of the hero's stats. As in the ROM, 定風珠 only adds while
// move is under 7, but always takes one off when it leaves.
export function equipBonus(r, it, sign) {
  if (!it.equip) return;
  const p = it.pow * sign;
  switch (it.stat) {
    case 2: r.atk += p; break;
    case 3: r.df += p; break;
    case 4: r.spd += p; break;
    case 5: if (sign < 0 || r.move < 7) r.move += p; break;
    case 6: r.mhp += p; r.hp += p; break;
    case 7: r.mmp += p; r.mp += p; break;
    default: break;                    // 12 / 13 / 0: passives in battle (regen, immunity), not stats
  }
}
// bag -> hero; returns an error message or null
export function give(state, cid, id) {
  const r = heroRec(state, cid), it = C().items[id];
  if (!(state.bag[id] > 0)) return '袋中沒有' + it.name;
  if (r.items.length >= MAX_HELD) return C().heroes[cid].name + '已拿不下了';
  if (!mayHold(r, it)) return C().itemDesc[id] + '，' + C().heroes[cid].name + '無法裝備';
  if (!--state.bag[id]) delete state.bag[id];
  r.items.push(id); equipBonus(r, it, 1);
  return null;
}
// hero -> bag
export function take(state, cid, slot) {
  const r = heroRec(state, cid), id = r.items[slot], it = C().items[id];
  if ((state.bag[id] || 0) >= MAX_BAG) return it.name + '已經滿了';
  r.items.splice(slot, 1); state.bag[id] = (state.bag[id] || 0) + 1; equipBonus(r, it, -1);
  return null;
}
// items that work outside battle: the permanent boosts (ids 29-32, as in battle)
export const usableInCamp = id => id >= 29 && id <= 32;   // the stat herbs; 舍利子 (33, a level) is used in battle only: no 用 in the camp [the user's call]
export function useInCamp(state, cid, slot) {
  const r = heroRec(state, cid), id = r.items[slot];
  if (!usableInCamp(id)) return '此處無法使用';
  if (id === 29) r.atk += 3; else if (id === 30) r.df += 3; else if (id === 31) r.move += 1; else r.spd += 5;
  r.items.splice(slot, 1); r.hp = r.mhp; r.mp = r.mmp;
  return null;
}
