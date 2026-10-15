// Renders the game's sound logs in the background: { id, vgz (gzipped VGM bytes), rate } -> { id, left, right }
import { render } from './vgm.js';

self.onmessage = async e => {
  const { id, vgz, rate } = e.data;
  try {
    const raw = new Uint8Array(await new Response(new Blob([vgz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const r = render(raw, { rate });
    self.postMessage({ id, left: r.left, right: r.right }, [r.left.buffer, r.right.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err) }); }
};
