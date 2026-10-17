// The first visit to the public build: the game's art, maps, scenes, music and text are not on the site, they are made
// from the player's own ROM (extract/). The player picks the file; it is checked (size, SHA-256), then read in workers
// (one for the images and data, the rest for the songs and effects), the results kept in the browser (Cache Storage)
// and served by sw.js. Nothing is uploaded. Then the page reloads into the game.
import { checkRom, sound, audioTable } from '../extract/index.js';
import { EXTRACT_VERSION } from '../extract/version.js';

const BASE = new URL('../', import.meta.url);
const css = `
#ld { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 40%, #1d1912, #050605 70%); z-index: 100; }
#ld .box { width: min(560px, calc(100vw - 32px)); padding: 28px 30px 24px; background: linear-gradient(160deg, rgba(241,230,204,.97), rgba(220,203,165,.97)); color: var(--ink);
  border: 2px solid var(--gold); border-radius: 3px; box-shadow: 0 18px 60px rgba(0,0,0,.6); font-family: var(--font); }
#ld h1 { margin: 0 0 6px; font-family: "Noto Serif TC", var(--font); font-weight: 900; font-size: 30px; letter-spacing: 6px; color: var(--red); }
#ld p { margin: 8px 0; line-height: 1.6; font-size: 16px; }
#ld p.en { font-size: 13px; color: #5a4a30; }
#ld label.pick { display: inline-block; margin-top: 10px; padding: 9px 22px; background: var(--red); color: var(--paper); border-radius: 3px; cursor: pointer; font-size: 17px; letter-spacing: 3px; }
#ld input { display: none; }
#ld .bars { margin-top: 14px; }
#ld .bar { height: 10px; margin: 6px 0 2px; background: rgba(13,11,9,.15); border-radius: 5px; overflow: hidden; }
#ld .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--gold), var(--red)); transition: width .3s; }
#ld .lab { font-size: 13px; color: #5a4a30; display: flex; justify-content: space-between; }
#ld .err { color: var(--red); font-weight: 700; }
`;

// updated: the files made from the ROM were dropped (another version of the extractor made them, or it was cut off)
export function show({ updated = false } = {}) {
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
  document.body.insertAdjacentHTML('beforeend', `<div id="ld"><div class="box">
    <h1>封神英傑傳</h1>
    <p>這個重製版不附帶原作的任何內容。請選擇你自己的 Mega Drive 卡帶檔案（ROM），遊戲的圖像、地圖、劇情、音樂與文字會在你的瀏覽器裡由它製作，檔案不會被上傳。</p>
    <p class="en">This remake ships none of the original's content. Choose your own Mega Drive ROM of the game: its art, maps, scenes, music and text are made from it in your browser. Nothing is uploaded.</p>
    ${updated ? '<p><b>遊戲已更新：需要再選擇一次 ROM，重新製作遊戲資料（存檔不受影響）。</b></p><p class="en">The game has been updated: choose your ROM once more to remake its files (your saves are kept).</p>' : ''}
    <label class="pick">選擇 ROM<input type="file" accept=".bin,.md,.gen,application/octet-stream"></label>
    <p class="msg"></p><div class="bars"></div></div></div>`);
  const box = document.querySelector('#ld .box'), msg = box.querySelector('.msg'), bars = box.querySelector('.bars');
  box.querySelector('input').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const rom = new Uint8Array(await f.arrayBuffer()), bad = await checkRom(rom);
    if (bad) { msg.innerHTML = '<span class="err">這不是本作所用的 ROM（' + bad + '）。</span>'; return; }
    box.querySelector('label.pick').remove(); msg.textContent = '正在製作遊戲資料，約需數分鐘，請勿關閉此頁。';
    try { await extract(rom, bars); } catch (err) { msg.innerHTML = '<span class="err">製作失敗：' + err + '</span>'; return; }
    msg.textContent = '完成。'; setTimeout(() => location.reload(), 600);
  });
}

// the parts over workers: the data in one, the sounds dealt round the others (songs first: they take longest)
async function extract(rom, bars) {
  if ('serviceWorker' in navigator) { await navigator.serviceWorker.register(new URL('sw.js', BASE).href); await navigator.serviceWorker.ready; }
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2)), groups = Array.from({ length: n }, () => []);
  const ids = [...sound.IDS].sort((a, b) => (a < 0x8000 ? 0 : 1) - (b < 0x8000 ? 0 : 1)); ids.forEach((id, i) => groups[i % n].push(id));
  const parts = [{ part: 'data', label: '圖像與資料', steps: 112 }, ...groups.map((g, i) => ({ part: 'sound', sounds: g, label: '音樂與音效 ' + (i + 1), steps: g.length }))];
  const tables = await Promise.all(parts.map(p => new Promise((res, rej) => {
    bars.insertAdjacentHTML('beforeend', '<div class="lab"><span>' + p.label + '</span><span></span></div><div class="bar"><i></i></div>');
    const bar = bars.lastElementChild.firstElementChild, lab = bars.lastElementChild.previousElementSibling.lastElementChild;
    const w = new Worker(new URL('extract/worker.js', BASE), { type: 'module' });
    w.onmessage = e => {
      const d = e.data;
      if (d.error) { w.terminate(); rej(d.error); return; }
      if (d.done) { bar.style.width = '100%'; lab.textContent = '✓'; w.terminate(); res(d.table || null); return; }
      bar.style.width = Math.min(99, d.n / p.steps * 100) + '%'; lab.textContent = d.step;
    };
    w.postMessage({ rom: rom.buffer.slice(0), part: p.part, sounds: p.sounds });
  })));
  const cache = await caches.open('fengshen-rom');
  await cache.put(new URL('data/audio.js', BASE).href, new Response(audioTable(tables.filter(Boolean)), { headers: { 'content-type': 'text/javascript; charset=utf-8' } }));
  // the stamp, last of all: only a whole extraction has it (index.html compares it with extract/version.js)
  await cache.put(new URL('data/extract-version.js', BASE).href, new Response('window.EXTRACT_VERSION = ' + EXTRACT_VERSION + ';\n', { headers: { 'content-type': 'text/javascript; charset=utf-8' } }));
}
