// A worker of tex.js's pool: paints one recipe of src/kit/recipes.js (the shared ones, src/kit/paint.js, and the sets' own) ({ id, fn, args }) and hands the pixels back
// (transferred, not copied). An error goes back as one, and tex.js paints that recipe itself when the set asks for it.
import { paintArrays } from './paint.js';
import { RECIPES } from './recipes.js';
self.onmessage = ({ data: { id, fn, args } }) => {
  try {
    const [name, n, paint, bump] = RECIPES[fn](...args), r = paintArrays(n, paint, bump);
    self.postMessage({ id, name, n, ...r }, [r.col.buffer, r.nor.buffer, r.arm.buffer]);
  } catch (e) { self.postMessage({ id, error: String(e && e.message || e) }); }
};
