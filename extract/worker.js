// One of the extraction's workers (src/loader.js starts them): the ROM once ({ rom }), then a job at a time ({ part,
// sounds }: the data, or some of the songs and effects) -> progress messages, the job's files stored in Cache Storage
// ('fengshen-rom', keyed by their URL under the site), then { done, table } (a sound job's lengths and loops); the loader
// then posts the next job, or ends the worker.
import { extractAll } from './index.js';

const BASE = new URL('../', import.meta.url);
const TYPE = { png: 'image/png', js: 'text/javascript; charset=utf-8', vgz: 'application/octet-stream' };
let rom = null;
self.onmessage = async e => {
  if (e.data.rom) rom = new Uint8Array(e.data.rom);
  const { part, sounds } = e.data; if (!part) return;
  try {
    let n = 0;
    const { files, table } = await extractAll(rom, { part, sounds, log: m => self.postMessage({ step: m, n: ++n }) });
    const cache = await caches.open('fengshen-rom');
    for (const [path, bytes] of Object.entries(files)) {
      await cache.put(new URL(path, BASE).href, new Response(bytes, { headers: { 'content-type': TYPE[path.split('.').pop()] || 'application/octet-stream' } }));
    }
    self.postMessage({ done: true, count: Object.keys(files).length, table });
  } catch (err) { self.postMessage({ error: String(err && err.message || err) }); }
};
