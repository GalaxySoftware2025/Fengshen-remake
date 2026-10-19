// The camp between battles: the original's menus (查看人物, 勝利條件, 道具 (裝備物品 here), 選擇人物, 出擊, 儲存記錄; and
// 讀取記錄), drawn as ink-and-gold panels over the next battle's map. Also the save-slot list, shared with the title.
import * as R from './rules.js';
import * as K from './campaign.js';
import * as Save from './save.js';
import { autoPick } from './party.js';
import { sfx, SFX } from './audio.js';
const { D } = R;
const $ = id => document.getElementById(id);
const C = () => globalThis.COMMON;
const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const names = cids => cids.map(c => C().heroes[c].name).join('、') || '—';
const dateText = t => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

// ---------------------------------------------------------------- save slots (camp and title)
// mode 'save' | 'load'; resolves to the loaded state (load), true (saved) or null (closed)
export function slotList(E, box, mode, state) {
  return new Promise(res => {
    const draw = () => {
      box.innerHTML = `<h3>${mode === 'save' ? '儲存記錄' : '讀取記錄'}</h3>`;
      const t = h('div', 'slots'); t.appendChild(h('div', 'sl head', '<span></span><span>場所</span><span>等級</span><span>次數</span><span></span>'));
      for (const { slot, state: s } of Save.list()) {
        if (mode === 'save' && slot === Save.AUTO) continue;
        const sum = s && K.summary(s), row = h('div', 'sl' + (s ? '' : ' empty'));
        row.innerHTML = `<span>${slot === Save.AUTO ? '自動記錄' : '記錄' + CN[slot + 1]}</span>` + (s ? `<span>${sum.place}</span><span>${sum.lv}</span><span>${sum.saves}</span><span class="dt">${dateText(s.at)}</span>` : '<span>—</span><span></span><span></span><span></span>');
        row.onclick = () => {
          if (mode === 'load') { if (s) res(s); return; }
          // [design, the user's request: the original saves at once] ask first, as 出擊 does (否 lit), naming an overwrite
          draw(); [...box.querySelectorAll('.sl')].find(r => r.dataset.slot === String(slot)).classList.add('pick');
          const q = h('div', 'lask', `<span>${s ? '要覆蓋記錄' + CN[slot + 1] + '嗎？' : '要儲存至記錄' + CN[slot + 1] + '嗎？'}</span>`), yes = h('button', '', '是'), no = h('button', 'on', '否');
          no.onclick = () => draw();
          yes.onclick = () => {
            state.saves++;
            if (!Save.write(slot, state)) { state.saves--; draw(); return E.ui.toast('無法儲存（瀏覽器不允許存檔）', 1400); }
            sfx(SFX.saved);   // the original's sound for a save (0x8061)
            E.ui.toast('已儲存至記錄' + CN[slot + 1], 900); draw();
          };
          q.append(yes, no); box.insertBefore(q, box.querySelector('.bar'));
        };
        row.dataset.slot = slot;
        t.appendChild(row);
      }
      box.appendChild(t);
      const bar = h('div', 'bar');
      if (mode === 'save') { const b = h('button', '', '匯出檔案'); b.onclick = () => Save.exportFile(state); bar.appendChild(b); }
      else { const b = h('button', '', '匯入檔案'); b.onclick = async () => { const s = await Save.importFile(); if (s) res(s); else E.ui.toast('不是有效的記錄檔', 1200); }; bar.appendChild(b); }
      const x = h('button', '', '返回'); x.onclick = () => res(null); bar.appendChild(x);
      box.appendChild(bar);
    };
    draw();
  });
}

// ---------------------------------------------------------------- the camp
const MENU = [['people', '查看人物'], ['cond', '勝利條件'], ['pick', '選擇人物'], ['items', '裝備物品'], ['go', '出　　擊'], ['save', '儲存記錄'], ['load', '讀取記錄'], ['title', '回到標題']];   // 選擇人物 before 裝備物品 [the user's call; the original lists 道具 first]
const statLine = r => `生命 ${r.mhp}　法力 ${r.mmp}　攻 ${r.atk}　防 ${r.df}　速 ${r.spd}　移 ${r.move}`;
function itemName(id) { const it = C().items[id]; return it.name + (it.equip ? '<i class="eq">裝</i>' : ''); }

function people(E, box, state) {
  let cur = state.roster[0].cid;
  const draw = () => {
    box.innerHTML = '<h3>查看人物</h3>';
    const wrap = h('div', 'people'), list = h('div', 'htabs'), card = h('div', 'pcard');   // the heroes as 裝備物品's tabs, the card under them
    for (const r of state.roster) {
      const p = D.party.find(u => u.cid === r.cid) || r, t = h('div', 'pt' + (r.cid === cur ? ' on' : ''));
      t.appendChild(E.bank.portrait(p.sprite, 2)); t.insertAdjacentHTML('beforeend', `<span>${C().heroes[r.cid].name}</span><small>Lv ${r.lv}</small>`);
      t.onclick = () => { cur = r.cid; draw(); }; list.appendChild(t);
    }
    const r = K.heroRec(state, cur), H = C().heroes[cur], g = H.growth, next = r.lv < 99 ? g[r.lv].map((v, i) => v - g[r.lv - 1][i]) : null;
    const p = D.party.find(u => u.cid === cur);
    card.appendChild(E.bank.walker(p.sprite, 4));   // the chosen hero marking time, as on 裝備物品 [the user's call]
    card.insertAdjacentHTML('beforeend', `<div class="pn"><b>${H.name}</b><span>${H.cls}・${H.elem}　Lv ${r.lv}　經驗 ${r.exp}</span></div>
      <div class="ps">${statLine(r)}</div>
      ${next ? `<div class="pg"><b>下一級</b>生命 +${next[0]}　法力 +${next[1]}　攻 +${next[2]}　防 +${next[3]}　速 +${next[4]}${g[r.lv][5] !== 255 ? '　學會「' + C().spells[g[r.lv][5]].name + '」' : ''}</div>` : ''}
      <div class="pl"><b>法術</b>${r.spells.map(i => `<span title="${C().spells[i].name}">${C().spells[i].name}<small>${C().spells[i].mp}</small></span>`).join('') || '—'}</div>
      <div class="pl"><b>道具</b>${r.items.map(i => `<span title="${C().itemDesc[i]}">${itemName(i)}</span>`).join('') || '—'}</div>
      ${D.partyRules.forced.includes(cur) ? '<div class="pf">此戰必須出陣</div>' : D.partyRules.unavailable.includes(cur) ? '<div class="pf off">此戰無法出陣</div>' : ''}`);
    wrap.append(list, card); box.appendChild(wrap);
  };
  draw();
}
function conditions(E, box) {
  const P = D.partyRules;
  box.innerHTML = `<h3>勝利條件</h3><div class="ccard"><h2>${D.name}</h2>
    <div class="cond"><div><b>勝利條件</b>${D.win.join(' · ')}</div><div><b>敗北條件</b>${D.lose.join(' · ')}</div>
    <div><b>出陣人數</b>最多${CN[P.deployMax] || P.deployMax}人</div><div><b>必須出陣</b>${names(P.forced)}</div><div><b>無法出陣</b>${names(P.unavailable)}</div></div></div>`;
}
// 裝備物品, after the original's 道具 screen (its 裝備 / 卸下 choice, then a hero; the party's bag listed on the left with
// each item's icon and count, the hero's eight slots ringed round the hero's figure, the item's effect in a box below):
// here both at once [design: no mode to pick] - the chosen hero's figure in a ring of eight slots (click one: back to
// the bag), the bag beside it (click: give it to the hero; greyed when the hero cannot hold it), the effect below
const ICON = id => `<img class="ico" src="assets/items/hd/${String(id).padStart(2, '0')}.png" alt="">`;
// an item moving between the bag and a hero's slot [the user's call]: its icon glides straight from where it was to where it lands
// (hidden there until it arrives), then pops; the original only confirms it (0x806b, played by the caller)
function fly(id, from, toEl) {
  if (!from || !toEl) return;
  const to = toEl.getBoundingClientRect(), f = document.createElement('div'); f.className = 'iflight'; f.innerHTML = ICON(id);
  const sz = Math.min(Math.max(to.width, 32), Math.max(to.height, 32), 56), x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
  f.style.width = f.style.height = sz + 'px'; document.body.appendChild(f); toEl.style.visibility = 'hidden';
  const t0 = performance.now(), T = 300;
  const step = now => {
    const k = Math.min(1, (now - t0) / T), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    f.style.transform = `translate(${x0 + (x1 - x0) * e - sz / 2}px, ${y0 + (y1 - y0) * e - sz / 2}px)`;   // straight there [the user's call]
    if (k < 1) return requestAnimationFrame(step);
    f.remove(); toEl.style.visibility = ''; toEl.animate([{ transform: 'scale(1.35)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 220, easing: 'ease-out' });
  };
  requestAnimationFrame(step);
}
function items(E, box, state, refreshParty) {
  let cur = state.roster[0].cid, hover = null;
  const draw = () => {
    box.innerHTML = '<h3>裝備物品</h3>';
    const tabs = h('div', 'htabs'), out = cid => !(state.pick || []).includes(cid);   // not chosen for the next battle: greyed, as on 選擇人物 [the user's call]
    for (const r of state.roster) {
      const p = D.party.find(u => u.cid === r.cid), t = h('div', 'pt' + (r.cid === cur ? ' on' : '') + (out(r.cid) ? ' out' : ''));
      t.appendChild(E.bank.portrait(p.sprite, 2)); t.insertAdjacentHTML('beforeend', `<span>${C().heroes[r.cid].name}</span>`);
      t.onclick = () => { cur = r.cid; draw(); }; tabs.appendChild(t);
    }
    const r = K.heroRec(state, cur), p = D.party.find(u => u.cid === cur);
    const say = id => { hover = id; desc.classList.toggle('off', id == null);   // the effect only while the cursor is on an item [the user's call]
      desc.innerHTML = id == null ? '' : `${ICON(id)}<div><b>${C().items[id].name}</b>${C().items[id].equip ? '<i class="eq">裝</i>' : ''}<br>${C().itemDesc[id] || ''}</div>`; };
    // the hero in a ring of eight slots (the original's: three either side, one above, one below)
    const ring = h('div', 'iring'), fig = h('div', 'ifig' + (out(cur) ? ' out' : '')); fig.appendChild(E.bank.walker(p.sprite, 4, out(cur)));   // marking time [the user's call]; grey and standing if not going
    fig.insertAdjacentHTML('beforeend', `<b>${C().heroes[cur].name}</b><small>${r.items.length} / ${K.MAX_HELD}</small>`); ring.appendChild(fig);
    for (let slot = 0; slot < K.MAX_HELD; slot++) {
      const id = r.items[slot], c = h('div', 'islot s' + slot + (id == null ? ' empty' : ''), id == null ? '' : ICON(id));
      if (id != null) {
        c.title = C().items[id].name; c.onmouseenter = () => say(id); c.onmouseleave = () => say(null);
        c.onclick = () => { const from = c.getBoundingClientRect(), err = K.take(state, cur, slot); if (err) return E.ui.toast(err, 900);
          sfx(SFX.ok); refreshParty(); draw(); const row = box.querySelector(`.ibag .it[data-id="${id}"]`); fly(id, from, row && (row.querySelector('.ico') || row)); };
        if (K.usableInCamp(id)) { const u = h('button', 'iuse', '用'); u.title = '使用'; u.onclick = e => { e.stopPropagation(); const err = K.useInCamp(state, cur, slot); if (err) E.ui.toast(err, 900); else { E.ui.toast(C().heroes[cur].name + '使用了' + C().items[id].name, 900); refreshParty(); } draw(); }; c.appendChild(u); }
      }
      ring.appendChild(c);
    }
    const bag = h('div', 'ibag'); bag.innerHTML = '<h4>行囊</h4>';
    const ids = Object.keys(state.bag).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const ok = K.mayHold(r, C().items[id]), row = h('div', 'it' + (ok ? '' : ' no'), `${ICON(id)}<span>${itemName(id)}</span><small>${state.bag[id]}</small>`);
      row.onmouseenter = () => say(id); row.onmouseleave = () => say(null);
      row.dataset.id = id;
      row.onclick = () => { const from = (row.querySelector('.ico') || row).getBoundingClientRect(), err = K.give(state, cur, id); if (err) return E.ui.toast(err, 1100);
        sfx(SFX.ok); refreshParty(); draw(); const held = K.heroRec(state, cur).items, sl = box.querySelector('.islot.s' + held.lastIndexOf(id)); fly(id, from, sl); };
      bag.appendChild(row);
    }
    if (!ids.length) bag.appendChild(h('div', 'it none', '行囊是空的'));
    const stats = h('div', 'ps', statLine(r)), desc = h('div', 'idesc2'), side = h('div', 'iside'); side.append(bag, desc);
    const cols = h('div', 'icols2'); cols.append(ring, side);
    box.append(tabs, stats, cols); say(null);
  };
  draw();
}

// resolves to { battle: chosen units }, 'title', or { load: state }
// 選擇人物 [ROM op 10's cap, forced and unavailable flags], after the original's: 出場人數 n / cap over the roster's
// figures, grey until chosen and in colour once chosen; the pointed hero's level and stats in a box below. The choice
// stays while the camp is open (the original keeps it between its menus). With `ask` it is 出擊's screen: the lineup
// shown, not changed, under the confirmation (data/ui.js sortie) 是 / 否 (否 first, as the original's cursor)
function lineup(E, box, state, ask) {
  const P = D.partyRules, max = P.deployMax, roster = D.party;
  const forced = p => P.forced.includes(p.cid), away = p => P.unavailable.includes(p.cid), on = p => state.pick.includes(p.cid);
  return new Promise(res => {
    const draw = (cur = roster[0]) => {
      box.innerHTML = `<h3>${ask ? '出　擊' : '選擇人物'}</h3>`;
      const head = h('div', 'lhead', `<span>出場人數</span><b>${state.pick.length} / ${max}</b>`);
      const grid = h('div', 'lgrid'), info = h('div', 'linfo');
      const say = p => { const r = K.heroRec(state, p.cid) || p;
        info.innerHTML = `<b>${p.name}</b><span>${p.cls}・${p.elem}</span><span>級 <i>${r.lv}</i></span><span>攻 <i>${p.atk}</i></span><span>防 <i>${p.df}</i></span><span>體 <i>${p.mhp}</i></span><span>法 <i>${p.mmp}</i></span><span>速 <i>${p.spd}</i></span><span>移 <i>${p.move}</i>${p.moveType === 3 ? '・飛行' : ''}</span>`
          + (forced(p) ? '<em>此戰必須出陣</em>' : away(p) ? '<em class="off">此戰無法出陣</em>' : ''); };
      for (const p of roster) {
        const c = h('div', 'lh' + (on(p) ? ' on' : '') + (forced(p) ? ' must' : '') + (away(p) ? ' off' : '') + (ask ? ' ro' : ''));
        c.appendChild(E.bank.walker(p.sprite, 3, !on(p))); c.insertAdjacentHTML('beforeend', `<span>${p.name}</span>`);
        c.onmouseenter = () => say(p);
        if (!ask) c.onclick = () => {
          if (forced(p)) return E.ui.toast(p.name + '必須出陣', 800);
          if (away(p)) return E.ui.toast(p.name + '此戰無法出陣', 800);
          if (!on(p) && state.pick.length >= max) return E.ui.toast('最多' + (CN[max] || max) + '人出陣', 800);
          state.pick = on(p) ? state.pick.filter(c => c !== p.cid) : [...state.pick, p.cid]; draw(p);
        };
        grid.appendChild(c);
      }
      say(cur); box.append(head, grid, info);
      if (ask) {
        const q = h('div', 'lask', '<span>' + globalThis.UI_TEXT.sortie + '</span>'), yes = h('button', '', '是'), no = h('button', 'on', '否');
        yes.onclick = () => res(true); no.onclick = () => res(false); q.append(yes, no); box.appendChild(q);
      }
    };
    draw();
  });
}
export async function campScene(E, state, onChange) {
  const box = $('c-panel');
  $('c-place').textContent = D.name;
  E.ui.show('camp', true);
  const refreshParty = onChange;
  // who goes: kept from an earlier visit to this camp if still allowed, else only the heroes this battle must take (the
  // rest grey and standing until chosen) [the user's call; the original too starts from 林雲 alone]
  const P = D.partyRules, okCid = c => D.party.some(p => p.cid === c) && !P.unavailable.includes(c);
  if (!Array.isArray(state.pick) || !state.pick.every(okCid) || state.pick.length > P.deployMax || !P.forced.every(c => !okCid(c) || state.pick.includes(c)))
    state.pick = autoPick(D.party, P).filter(p => P.forced.includes(p.cid)).map(p => p.cid);
  const menu = $('c-menu'); menu.innerHTML = '';
  let pick = null;
  const open = id => {
    for (const b of menu.children) b.classList.toggle('on', b.dataset.id === id);
    box.classList.remove('hidden');
    if (id === 'people') people(E, box, state);
    else if (id === 'cond') conditions(E, box);
    else if (id === 'items') items(E, box, state, refreshParty);
    else if (id === 'pick') lineup(E, box, state, false);
    else if (id === 'save' || id === 'load') slotList(E, box, id, state).then(v => { if (id === 'load' && v) pick({ load: v }); else open('people'); });
  };
  const result = await new Promise(res => {
    pick = res;
    for (const [id, label0] of MENU) {
      if (state.test && (id === 'save' || id === 'load')) continue;   // the test page's camp: no saves (its state is not the story's)
      const label = state.test && id === 'title' ? '回到測試' : label0;   // (the test page, test/index.html)
      const b = h('button', '', label); b.dataset.id = id; menu.appendChild(b);
      b.onclick = async () => {
        if (id === 'go') {
          if (!state.pick.length) { E.ui.toast(globalThis.UI_TEXT.pick, 1000); return open('pick'); }
          for (const b2 of menu.children) b2.classList.toggle('on', b2 === b);
          if (await lineup(E, box, state, true)) return res({ battle: state.pick.map(c => D.party.find(p => p.cid === c)) });
          return open('pick');
        }
        if (id === 'title') return res('title');
        open(id);
      };
    }
    open('people');
  });
  E.ui.show('camp', false);
  return result;
}
