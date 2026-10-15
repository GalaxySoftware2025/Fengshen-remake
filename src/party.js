// Heroes as battle units, built from the ROM hero templates and growth tables (COMMON.heroes).
// Phase 2 replaces the default party with the saved roster; until then a battle opened on its own gets the roster
// snapshot taken from the original when there is one (data/parties/NN.js), or every hero who has joined by then.
import { spriteKey } from './sprites.js';

// the first battle each hero can deploy in (cid order), from the joins decoded in PLANNING §7:
// 燕蓉 joins in scene 3, 楊戩 during battle 4, 哪吒 during battle 9, the rest in the scenes before their battle
export const JOIN_AT = [1, 3, 5, 8, 10, 11, 11, 14, 16, 16, 25, 27];

// a hero at level lv: stats from the growth table [ROM 0x3BBEE], the template's spells plus those learned on the way up
export function hero(C, cid, lv, extra) {
  const h = C.heroes[cid], g = h.growth[lv - 1], spells = h.spells.slice();
  for (let k = h.lv; k < lv; k++) if (h.growth[k][5] !== 255 && !spells.includes(h.growth[k][5])) spells.push(h.growth[k][5]);
  return Object.assign({
    cid, name: h.name, cls: h.cls, elem: h.elem, sprite: spriteKey(h.gfx), gfx: h.gfx, anim: h.anim, growth: h.growth,
    lv, hp: g[0], mhp: g[0], mp: g[1], mmp: g[1], atk: g[2], df: g[3], spd: g[4], exp: 0,
    moveType: h.moveType, move: h.move, rangeShape: h.rangeShape, items: h.items.slice(), spells, ai: 255, aggro: 255,
  }, extra || {});
}

export function defaultParty(C, B) {
  const snap = globalThis.PARTIES && globalThis.PARTIES[B.n];
  if (snap) return snap.map(r => hero(C, r.cid, r.lv, { exp: r.exp, items: r.items.slice(), spells: r.spells.slice() }));
  const avg = B.enemies.reduce((s, e) => s + e.lv, 0) / Math.max(1, B.enemies.length);
  return C.heroes.filter(h => B.party.forced.includes(h.cid) || (JOIN_AT[h.cid] <= B.n && !B.party.unavailable.includes(h.cid)))
    .map(h => hero(C, h.cid, Math.max(h.lv, Math.min(99, Math.round(avg) - 1))));
}

// the deploy screen's default pick: forced heroes first, then the rest in roster order, up to the battle's cap
export function autoPick(party, P) {
  const ok = party.filter(p => !P.unavailable.includes(p.cid));
  return [...ok.filter(p => P.forced.includes(p.cid)), ...ok.filter(p => !P.forced.includes(p.cid))].slice(0, P.deployMax);
}
