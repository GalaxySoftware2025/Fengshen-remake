// The extractor's version. The extraction stamps it into the player's browser last of all (data/extract-version.js in
// Cache Storage, src/loader.js), and index.html compares that stamp with this number on every visit: no stamp (made by an
// earlier build, or cut off half way) or another number, and the files made from the ROM are dropped and the ROM asked
// for again. So whenever what the extractor makes changes, EXTRACT_VERSION goes up by one: tools/qa/extractver.mjs fails
// when it changed without (FINGERPRINT is what this version makes: the data part's files, and the sound part's code,
// comments aside, as ripping all 200 sounds takes over an hour). Hashes only: nothing of the cartridge.
export const EXTRACT_VERSION = 25;   // 25: a character's inner thought (ROM op 33 / 34) as a 'think' event: everything but the thinker dims
export const FINGERPRINT = { data: '3457c0b3dd9ae4d7f1c017b665354941dfdd1d177541879ad8ab6a1ae0afcb06', sound: '7c26ee2cd1166d14e2824894015a640ac024dccf01852f1c7414aef124e9f365' };
