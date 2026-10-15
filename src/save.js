// Saves: the campaign state as one JSON object (campaign.js), in browser storage. Four slots, like the four in the
// original's cartridge SRAM (0x200101 + 0x7C0 × slot), plus an auto-save written before every battle, and export /
// import to a file. Everything goes through here, so the backend can change later.
const KEY = 'fengshen-remake.save.', SLOTS = 4, VERSION = 1;
export const AUTO = 'auto';

function store() { try { return window.localStorage; } catch (e) { return null; } }
export function read(slot) {
  try { const s = store(), raw = s && s.getItem(KEY + slot); if (!raw) return null; const o = JSON.parse(raw); return o && o.v === VERSION ? o : null; }
  catch (e) { return null; }
}
export function write(slot, state) {
  const s = store(); if (!s) return false;
  try { s.setItem(KEY + slot, JSON.stringify(Object.assign({}, state, { v: VERSION, at: Date.now() }))); return true; }
  catch (e) { return false; }
}
export function remove(slot) { try { const s = store(); if (s) s.removeItem(KEY + slot); } catch (e) { /* storage blocked */ } }
// the slot list: [{ slot, state | null }] for the four slots, then the auto-save
export const list = () => [...Array.from({ length: SLOTS }, (_, i) => i), AUTO].map(slot => ({ slot, state: read(slot) }));
export const any = () => list().some(r => r.state);

export function exportFile(state) {
  const blob = new Blob([JSON.stringify(Object.assign({}, state, { v: VERSION }), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'fengshen-save-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// ask for a save file; resolves to its state, or null if cancelled or not a save
export function importFile() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      try { const o = JSON.parse(await inp.files[0].text()); res(o && o.v === VERSION && Array.isArray(o.roster) ? o : null); } catch (e) { res(null); }
    };
    inp.click();
  });
}
