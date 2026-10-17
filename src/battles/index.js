// Battles with their own hook modules: n -> file stem in this folder. <stem>.js holds the pure rules (also run by
// test/sim.mjs), <stem>-fx.js the presentation and 3D dressing. Every other battle plays from its generated data alone.
export const MODULES = { 1: '01-fushan', 2: '02-fushan', 3: '03-dungeon', 4: '04-fushan', 5: '05-feizhong', 6: '06-feizhong2', 7: '07-chaoge', 8: '08-lintong', 9: '09-ziyang', 10: '10-hailong', 11: '11-lianggong', 12: '12-shengling', 13: '13-panxi', 14: '14-huoyan', 15: '15-qilin', 16: '16-qinglong' };
export const rulesOf = async n => MODULES[n] ? (await import('./' + MODULES[n] + '.js')).default : {};
export const fxOf = async n => MODULES[n] ? (await import('./' + MODULES[n] + '-fx.js')).default : {};
