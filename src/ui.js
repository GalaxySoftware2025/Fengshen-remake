// DOM interface layered over the 3D view.
import { D } from './rules.js';
import { sfx, SFX } from './audio.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class UI {
  constructor(bank) {
    this.bank = bank; this.labels = $('labels'); this.bars = new Map(); this.tags = new Map(); this.floaters = [];
    this.waiter = null;
    $('dialog').addEventListener('click', () => this.advance());
  }
  // ---------- generic input hand-off for click-to-continue elements
  advance() { if (this.waiter) { const w = this.waiter; this.waiter = null; w(); } }
  waitClick(ms) { return new Promise(res => { this.waiter = res; if (ms) setTimeout(() => { if (this.waiter === res) { this.waiter = null; res('auto'); } }, ms); }); }   // 'auto': it timed out, nobody clicked
  show(id, on) { $(id).classList.toggle('hidden', !on); }

  // ---------- HUD
  round(n, meter) {                // meter: the battle's own gauge, { label, fill (0-100), text } (磻溪's fire), or none
    $('r-round').textContent = n;
    document.querySelector('#roundbox .r-fire').style.display = meter ? '' : 'none';
    if (!meter) return;
    document.querySelector('#roundbox .r-fire-label').textContent = meter.label;
    $('r-fire-fill').style.width = meter.fill + '%';
    $('r-fire-text').textContent = meter.text;
  }
  order(list, now) {
    const o = $('order'); o.innerHTML = '';
    for (const u of list.slice(0, 12)) {
      const d = el('div', 'o ' + (u.side === 'player' ? 'player' : 'enemy') + (u === now ? ' now' : ''));
      d.appendChild(this.bank.portrait(u.sprite, 2)); d.title = u.name; o.appendChild(d);
    }
  }
  card(u) {
    const c = $('card');
    if (!u) { c.classList.add('hidden'); this.cardKey = null; return; }
    const key = [u.name, u.x, u.y, u.hp, u.mp, u.lv, u.exp, u.atk, u.df, u.spd, u.move, JSON.stringify(u.status)].join();
    if (key === this.cardKey && this.cardUnit === u) return;      // unchanged: skip the DOM rebuild
    this.cardKey = key; this.cardUnit = u;
    c.classList.remove('hidden'); c.classList.toggle('enemy', u.side !== 'player');
    const st = Object.entries(u.status).filter(([, v]) => v).map(([k]) => ({ sleep: '睡眠', seal: '封法', poison: '中毒' }[k])).join(' ');
    c.innerHTML = `<div><span class="nm">${u.name}</span><span class="cl">${u.cls || ''}${u.elem ? '・' + u.elem : ''}　Lv ${u.lv}</span></div>
      <div class="bars"><div class="row"><span>生命</span><b>${u.hp} / ${u.mhp}</b></div><div class="bar hp"><i style="width:${u.hp / u.mhp * 100}%"></i></div>
      ${u.mmp ? `<div class="row"><span>法力</span><b>${u.mp} / ${u.mmp}</b></div><div class="bar mp"><i style="width:${u.mp / u.mmp * 100}%"></i></div>` : ''}</div>
      <div class="st"><span>攻 <b>${u.atk}</b></span><span>防 <b>${u.df}</b></span><span>速 <b>${u.spd}</b></span><span>移 <b>${u.move}</b></span>${u.side === 'player' ? `<span>經驗 <b>${u.exp}</b></span>` : ''}${st ? `<span style="color:#8a1a6a">${st}</span>` : ''}</div>`;
    c.prepend(this.bank.portrait(u.sprite, 3));
  }
  hint(t) { $('hint').textContent = t || ''; }
  // ---------- action menu (diamond buttons around the unit)
  menu(opts, sel, sx, sy) {
    const m = $('menu');
    if (!opts) { m.classList.add('hidden'); m.innerHTML = ''; return; }
    m.classList.remove('hidden'); m.style.left = sx + 'px'; m.style.top = sy + 'px';
    if (!m.children.length) {
      opts.forEach((o, i) => {
        const b = el('div', 'mb', `<span>${o.ch}</span>`); b.title = o.label;
        b.style.left = o.dx + 'px'; b.style.top = o.dy + 'px'; b.style.animationDelay = i * 40 + 'ms';
        b.onclick = e => { e.stopPropagation(); o.onClick(i); }; b.onmouseenter = () => o.onHover(i);
        m.appendChild(b);
      });
    }
    [...m.children].forEach((b, i) => { b.classList.toggle('sel', i === sel); b.classList.toggle('off', !opts[i].ok); });
  }
  // ---------- the item / spell ring, after the original's 物 / 法 rings: the bare icons on a circle round the unit, the
  // chosen one at the top inside a pale corner-bracket cursor (here also enlarged: the user's call), the ring turning to
  // bring the next one up (the arrow keys); a bar across the top of the screen with its icon, name and effect. The mouse
  // may point at any icon where it stands (the ring does not turn under the cursor) and click it.
  //   rows [{ icon, label, right, desc, ok }], sel: the pointed one, top: the one turned to the top
  ring(rows, sel, top, sx, sy, onPick, onHover) {
    let R = $('ring'), H = $('ringhead');
    if (!R) { R = el('div', 'hidden'); R.id = 'ring'; $('menu').after(R); }
    if (!H) { H = el('div', 'hidden'); H.id = 'ringhead'; R.after(H); }
    if (!rows) { R.classList.add('hidden'); H.classList.add('hidden'); R.innerHTML = ''; R._rows = null; return; }
    R.classList.remove('hidden'); H.classList.remove('hidden'); R.style.left = sx + 'px'; R.style.top = sy + 'px';
    const n = rows.length, rad = Math.max(94, Math.min(175, n * 15)), step = Math.PI * 2 / n;   // (room for the 72 px squares side by side)
    if (R._rows !== rows) {   // build: the icons and the bracket
      R.innerHTML = ''; R._rows = rows; R._ang = -top * step; R._goal = R._ang;
      rows.forEach((r, i) => {
        const b = el('div', 'rb' + (r.ok ? '' : ' off'), `<img src="${r.icon}" alt="">`); b.style.animationDelay = i * 25 + 'ms';
        b.onclick = e => { e.stopPropagation(); onPick(i); }; b.onmousemove = () => onHover(i);   // (move, not enter: an icon turning in under a still pointer takes no focus)
        R.appendChild(b);
      });
      const cur = el('div', 'rcur', '<i></i><i></i><i></i><i></i>'); R.appendChild(cur);
      const place = () => {
        if (!R._rows) return;
        R._ang += (R._goal - R._ang) * 0.28; if (Math.abs(R._goal - R._ang) < 1e-3) R._ang = R._goal;
        const bs = R.querySelectorAll('.rb');
        bs.forEach((b, i) => { const a = -Math.PI / 2 + i * step + R._ang; b.style.left = Math.cos(a) * rad + 'px'; b.style.top = Math.sin(a) * rad + 'px'; });
        const sb = bs[R._sel]; if (sb) { cur.style.left = sb.style.left; cur.style.top = sb.style.top; }
        requestAnimationFrame(place);
      };
      requestAnimationFrame(place);
    }
    // turn the shortest way round to bring `top` up
    let goal = -top * step; while (goal - R._ang > Math.PI) goal -= Math.PI * 2; while (goal - R._ang < -Math.PI) goal += Math.PI * 2; R._goal = goal;
    R._sel = sel;
    [...R.querySelectorAll('.rb')].forEach((b, i) => b.classList.toggle('sel', i === sel));
    const r = rows[sel];
    H.innerHTML = r ? `<img src="${r.icon}" alt=""><b>${r.label}</b><span>${r.right || r.desc || ''}</span>` : '';
  }
  forecast(a, d, f) {
    const F = $('forecast');
    if (!a) { F.classList.add('hidden'); return; }
    F.classList.remove('hidden');
    F.innerHTML = `<div class="vs"><span>${a.name}</span><span>→</span><span>${d.name}</span></div>
      <div class="big">${f.dmg}${f.kill ? ' <small style="font-size:16px;color:#ff8a6a">擊倒</small>' : ''}</div>
      <div class="sm"><span>命中 ${f.hit}%</span><span>會心 ${f.crit}%</span><span>剩餘 ${Math.max(0, d.hp - f.dmg)}</span></div>
      <div class="go">再次點擊或 Enter 確定</div>`;
  }
  // ---------- messages
  async say(text, speaker, auto) {
    const d = $('dialog'); d.classList.remove('hidden'); $('d-name').textContent = speaker || '';
    const t = $('d-text'); t.textContent = '';
    let skip = false; const prev = this.waiter; this.waiter = () => { skip = true; };
    for (const ch of text) { if (skip) break; t.textContent += ch; await sleep(28); }
    t.textContent = text; this.waiter = prev;
    if (await this.waitClick(auto) !== 'auto') sfx(SFX.ok);   // the line clicked on: the original's advance sound [ROM 0x7EEE, its wait-for-button loop]
    d.classList.add('hidden');
  }
  async banner(text, sub, ms) {
    const b = $('banner'); $('banner-text').textContent = text; $('banner-sub').textContent = sub || '';
    b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden');
    await sleep(ms || 1300); b.classList.add('hidden');
  }
  async toast(text, ms) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); await sleep(ms || 1000); t.classList.add('hidden'); }
  // ---------- floating labels anchored to world positions (positions updated by main every frame)
  floater(world, text, cls, life) {
    const e = el('div', cls, text); this.labels.appendChild(e);
    this.floaters.push({ e, world: world.clone(), t: 0, life: life || 1.1 });
  }
  hpbar(u) {
    if (!this.bars.has(u)) { const e = el('div', 'hpbar' + (u.side === 'player' ? '' : ' enemy'), '<i class="lag"></i><i class="cur"></i>'); this.labels.appendChild(e); this.bars.set(u, e); }
    return this.bars.get(u);
  }
  clearUnits() { for (const e of [...this.bars.values(), ...this.tags.values()]) e.remove(); this.bars.clear(); this.tags.clear(); }   // a new board
  tag(u, text) {
    if (!text) { const e = this.tags.get(u); if (e) { e.remove(); this.tags.delete(u); } return; }
    if (!this.tags.has(u)) { const e = el('div', 'tag'); this.labels.appendChild(e); this.tags.set(u, e); }
    this.tags.get(u).textContent = text;
  }
  layout(project, actors, dt, showBars) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.t += dt; if (f.t > f.life) { f.e.remove(); this.floaters.splice(i, 1); continue; }
      const p = project(f.world); f.e.style.left = p.x + 'px'; f.e.style.top = p.y + 'px';
    }
    for (const a of actors) {
      const u = a.u, bar = this.hpbar(u), p = project(a.head());
      const vis = showBars && u.alive && a.dissolve === 0 && !a.hidden && p.z < 1, fade = a.fade ?? 1;   // (a unit still to come in, faded out, shows no bar)
      bar.style.opacity = vis ? (u.hp < u.mhp ? 1 : 0.55) * fade : 0; bar.style.left = p.x + 'px'; bar.style.top = (p.y - 10) + 'px';
      const w = (u.hp / u.mhp * 100) + '%'; bar.children[1].style.width = w; bar.children[0].style.width = w;
      const st = u.status.sleep ? 'Zz 睡眠' : u.status.seal ? '封法' : u.status.poison ? '中毒' : '';
      this.tag(u, u.alive ? st : '');
      const tg = this.tags.get(u); if (tg) { tg.style.left = p.x + 'px'; tg.style.top = (p.y - 16) + 'px'; }
    }
  }
}
export const spellDesc = sp => {
  const kind = sp.kind === 12 ? '輔助' : '攻擊';
  return `${kind}法術　威力 ${sp.pow || '—'}　消耗 ${sp.mp}　${sp.area ? '範圍 ' + sp.area : '單體'}`;
};
export const itemDesc = i => D.itemDesc[i] || '';

// the title's petals [ROM title, tools/rom/title.py]: a chain of 12 pink petals, 16 px apart on the original's 256 px
// screen, drifting down and to the right at 1 px a frame each way, fluttering; another chain follows once one has
// crossed. Drawn on a canvas over the title (under its logo and menu), scaled to the screen; returns a stop function.
export function petals(host) {
  const c = document.createElement('canvas'); c.className = 'petals'; host.prepend(c);
  const g = c.getContext('2d'); let run = true, last = performance.now(), chains = [], wait = 0.6;
  const fit = () => { const k = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * k; c.height = innerHeight * k; };
  fit(); addEventListener('resize', fit);
  const chain = () => { const S = c.width / 256, n = 12, y0 = -30 * S - Math.random() * 40 * S, x0 = Math.random() * c.width * 0.6 - c.width * 0.2;
    return Array.from({ length: n }, (_, i) => ({ x: x0 + i * 16 * S + (Math.random() - 0.5) * 6 * S, y: y0 + (Math.random() - 0.5) * 8 * S, ph: Math.random() * 6.3, spin: 3 + Math.random() * 3, s: S * (0.8 + Math.random() * 0.4), sway: Math.random() * 6.3 })); };
  const petal = (p, t) => {
    const flip = Math.cos(t * p.spin + p.ph), w = 4.2 * p.s, h = 2.6 * p.s * Math.max(0.15, Math.abs(flip));
    g.save(); g.translate(p.x, p.y); g.rotate(t * 1.3 + p.ph);
    const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, flip > 0 ? '#ffd6e4' : '#f58cb0'); gr.addColorStop(1, flip > 0 ? '#ff8db4' : '#d8507e');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(0, -h * 1.6, w, 0); g.quadraticCurveTo(0, h * 1.6, -w, 0); g.fill();
    g.restore();
  };
  const tick = now => {
    if (!run) return;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)), t = now / 1000; last = Math.max(last, now);
    if ((wait -= dt) <= 0 && chains.length < 2) { chains.push(chain()); wait = 5 + Math.random() * 3; }
    g.clearRect(0, 0, c.width, c.height);
    const v = 60 * c.width / 256;   // 1 px a frame on the original's screen
    for (const ch of chains) for (const p of ch) { p.x += v * dt * (0.9 + 0.2 * Math.sin(t * 1.7 + p.sway)); p.y += v * dt; petal(p, t); }
    chains = chains.filter(ch => ch.some(p => p.y < c.height + 20 && p.x < c.width + 20));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { run = false; c.remove(); removeEventListener('resize', fit); };
}
