// The extractor's version. The extraction stamps it into the player's browser last of all (data/extract-version.js in
// Cache Storage, src/loader.js), and index.html compares that stamp with this number on every visit: no stamp (made by an
// earlier build, or cut off half way) or another number, and the files made from the ROM are dropped and the ROM asked
// for again. So whenever what the extractor makes changes, EXTRACT_VERSION goes up by one: tools/qa/extractver.mjs fails
// when it changed without (FINGERPRINT is what this version makes: the data part's files, and the sound part's code,
// comments aside, as ripping all 200 sounds takes over an hour). Hashes only: nothing of the cartridge.
export const EXTRACT_VERSION = 1;
export const FINGERPRINT = { data: '13cae3fdd5a1ab2c5d19d0d0d33dde7fb2ef11c2ea54647f8d28c074272a6d4b', sound: 'f28571b9efca398861b621866de983467b3fce6a7ffc1f513cbd15ca3580e4bc' };
