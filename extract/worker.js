// One part of the extraction in the background: { rom, part, sounds } -> progress messages, the files stored in Cache
// Storage ('fengshen-rom', keyed by their URL under the site), then { done, table } (a sound part's lengths and loops).
import { extractAll } from './index.js';

const BASE = new URL('../', import.meta.url);
const TYPE = { png: 'image/png', js: 'text/javascript; charset=utf-8', vgz: 'application/octet-stream' };
self.onmessage = async e => {
  const { rom, part, sounds } = e.data;
  try {
    let n = 0;
    const { files, table } = await extractAll(new Uint8Array(rom), { part, sounds, log: m => self.postMessage({ step: m, n: ++n }) });
    const cache = await caches.open('fengshen-rom');
    for (const [path, bytes] of Object.entries(files)) {
      await cache.put(new URL(path, BASE).href, new Response(bytes, { headers: { 'content-type': TYPE[path.split('.').pop()] || 'application/octet-stream' } }));
    }
    self.postMessage({ done: true, count: Object.keys(files).length, table });
  } catch (err) { self.postMessage({ error: String(err && err.message || err) }); }
};
