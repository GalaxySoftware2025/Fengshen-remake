// The lines a battle's hook speaks (its say-lists), from the extracted data (data/says.js, extract/says.js), by their ROM
// address: [{ who, text, slot }], slot being the speaker's 0-based unit slot (the record's actor - 1; -1 when none).
export function sayList(addr) {
  const s = (globalThis.SAYS || {})[addr.toString(16).padStart(6, '0')];
  if (!s) throw new Error('no say-list at ' + addr.toString(16) + ' (data/says.js)');
  return s.lines.map(l => ({ who: l.who, text: l.text, slot: l.actor === 255 ? -1 : l.actor - 1 }));
}
