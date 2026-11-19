// The extractor's version. The extraction stamps it into the player's browser last of all (data/extract-version.js in
// Cache Storage, src/loader.js), and index.html compares that stamp with this number on every visit: no stamp (made by an
// earlier build, or cut off half way) or another number, and the files made from the ROM are dropped and the ROM asked
// for again. So whenever what the extractor makes changes, EXTRACT_VERSION goes up by one: tools/qa/extractver.mjs fails
// when it changed without (FINGERPRINT is what this version makes: the data part's files, and the sound part's code,
// comments aside, as ripping all 200 sounds takes over an hour). Hashes only: nothing of the cartridge.
export const EXTRACT_VERSION = 28;   // 28: scene 65 court cheer's own line (the cut's op-4 immediates at 0x51B4). 27: a unit's lost stretch filled from the hardware for a sheet others wear too, none of them shown then: scene 43's 文王
// 26: a ghost (a phantom's flicker-translucency) from the frame its flicker starts ('slot:gfx@f'): scene 36's 守護靈 solid until f192
export const FINGERPRINT = { data: 'b3984847f8f04b1f1856774cbcd2b806647dece38913da5f23c356989d7619f0', sound: '7c26ee2cd1166d14e2824894015a640ac024dccf01852f1c7414aef124e9f365' };
