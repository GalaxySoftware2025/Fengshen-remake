// Battles with their own hook modules: n -> file stem in this folder. <stem>.js holds the pure rules (also run by
// test/sim.mjs), <stem>-fx.js the presentation and 3D dressing. Every other battle plays from its generated data alone.
// @qa keyed:battle
export const MODULES = { 1: '01-fushan', 2: '02-fushan', 3: '03-dungeon', 4: '04-fushan', 5: '05-feizhong', 6: '06-feizhong2', 7: '07-chaoge', 8: '08-lintong', 9: '09-ziyang', 10: '10-hailong', 11: '11-lianggong', 12: '12-shengling', 13: '13-panxi', 14: '14-huoyan', 15: '15-qilin', 16: '16-qinglong', 17: '17-qinlian', 18: '18-taohua', 19: '19-wanshou', 20: '20-chongcheng', 21: '21-jiulong', 22: '22-xiqi', 23: '23-jiameng', 24: '24-jiameng2', 25: '25-kunlun', 26: '26-tianmen', 27: '27-jinao', 28: '28-xiqi2', 29: '29-mengjin', 30: '30-chaoge2', 31: '31-zhaixing', 32: '32-zhaixing2' };
// experiments: the same battle (its rules, units and board) on another presentation, <stem>-<variant>-fx.js, opened as
// #battle=N-<variant> (the campaign never plays them)
// @qa keyed:battle
export const VARIANTS = { 25: ['reimagine'] };
export const variantOf = n => { const v = (location.hash.match(/battle=\d+-(\w+)/) || [])[1]; return v && (VARIANTS[n] || []).includes(v) ? v : null; };
export const rulesOf = async n => MODULES[n] ? (await import('./' + MODULES[n] + '.js')).default : {};
export const fxOf = async n => { if (!MODULES[n]) return {}; const v = typeof location === 'undefined' ? null : variantOf(n);
  return (await import('./' + MODULES[n] + (v ? '-' + v : '') + '-fx.js')).default; };
