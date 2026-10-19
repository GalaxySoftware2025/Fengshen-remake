// The extractor's version. The extraction stamps it into the player's browser last of all (data/extract-version.js in
// Cache Storage, src/loader.js), and index.html compares that stamp with this number on every visit: no stamp (made by an
// earlier build, or cut off half way) or another number, and the files made from the ROM are dropped and the ROM asked
// for again. So whenever what the extractor makes changes, EXTRACT_VERSION goes up by one: tools/qa/extractver.mjs fails
// when it changed without (FINGERPRINT is what this version makes: the data part's files, and the sound part's code,
// comments aside, as ripping all 200 sounds takes over an hour). Hashes only: nothing of the cartridge.
export const EXTRACT_VERSION = 7;   // 7: every chest's slot and what it holds once opened before (again), the opening chest table. 6: every battle's own map marks its hidden chests (the art draws none there), as its rooms did. 5: battle 18's rooms (a hook with one handler for all), battle 17's room 0 art, the say-list battle 17 builds in RAM (its note). 4: every enemy's starting facing (its record's +1). 3: the summons gained in scenes (op 41: 楊戩's 龍王, 龍鬚虎, 麒麟獸, 四不像). 2: a phantom's (AI 0x83) and the main map's summoners' calls exported (battles 12, 14, 17, 19)
export const FINGERPRINT = { data: 'd38e8f3ce09932e0288b0f7f30ec7d450a2003d7f3a55ecb05bc6ac657bdfe4f', sound: 'f28571b9efca398861b621866de983467b3fce6a7ffc1f513cbd15ca3580e4bc' };
