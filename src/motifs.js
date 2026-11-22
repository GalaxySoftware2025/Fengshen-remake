// What each spell's and each hero's level-up dots are made of (src/vfx.js themeParticle) [the user's call, 2026-11-21:
// no plain dots; 旋風矢's green ones small leaves, and the like for every spell and level-up]. 'hue': each dot by its
// colour (red-orange a flame lick, gold a glint, green a leaf, cyan a water drop, blue a shard, purple a ghost wisp,
// pink a petal, brown a rock chip, white a glint, grey a chip); a shape name: every dot that; { colour: shape, any:
// shape }: those over the hue's. Shapes: leaf, petal, glint, shard, flame, drop, chip, wisp, snow (and 'dot' keeps one).
// tools/qa/motifs.js casts each spell and plays each level-up and fails on a round dot left.
const SWORD = { white: 'shard', grey: 'shard', blue: 'shard', cyan: 'shard' };   // the 劍 arts: slivers of blade light
const EARTH = { white: 'chip', grey: 'chip', brown: 'chip', gold: 'chip' };      // the 刀 and the fists: stone thrown up
const WIND = { white: 'leaf', grey: 'leaf', gold: 'leaf', cyan: 'leaf' };         // the wind arrows: leaves torn off
const FIRE = { gold: 'flame', white: 'flame', brown: 'flame' };                   // fire: licks of flame, not embers
const ICE = { white: 'snow', blue: 'snow', cyan: 'snow', grey: 'snow' };          // ice: snowflakes
const THUNDER = { white: 'glint', blue: 'glint', cyan: 'glint', purple: 'glint' };   // lightning: hard glints
const HEAL = { white: 'glint', blue: 'drop', cyan: 'drop', gold: 'glint' };       // the healing arts: leaves and dew
export const SPELL_MOTIF = {
  0: SWORD, 1: SWORD, 2: SWORD, 3: SWORD, 4: SWORD, 5: SWORD, 6: SWORD, 7: { any: 'shard' },   // 御劍術 .. 怒劍式 (its crimson ones slivers too: a sword art, not fire [the user's call])
  8: EARTH, 9: EARTH, 10: EARTH,   // 地裂刀, 十字斬, 御震刀法
  11: 'hue',   // 龍嘯九天: the dragon's gold
  12: WIND, 13: WIND, 14: 'hue', 15: WIND, 16: WIND, 17: 'hue',   // 百步穿楊, 氣動箭, 萬箭穿心, 颶風矢, 旋風矢, 狂飆箭
  18: EARTH, 19: 'hue', 20: EARTH, 21: EARTH,   // 裂爆拳, 五氣朝元, 地裂天崩, 昇龍拳
  22: FIRE, 23: FIRE, 24: FIRE, 25: FIRE,   // 炎殺, 三昧真火, 煉獄之火, 天火燎原
  26: ICE, 27: ICE, 28: ICE, 29: ICE,   // 冰晶術, 裂冰術, 風雪冰天, 崩冰術
  30: THUNDER, 31: THUNDER, 32: THUNDER, 33: { ...THUNDER, grey: 'chip', brown: 'chip' },   // 疾雷, 五雷咒, 天雷破, 霸雷
  34: { white: 'glint', any: 'glint' }, 35: 'hue',   // 暴走之光, 九天之怒
  36: 'wisp', 37: { purple: 'wisp', grey: 'leaf', white: 'leaf', blue: 'wisp' },   // 積屍氣: ghost fire; 黑色狂嵐: dark wind
  38: HEAL, 39: HEAL, 40: HEAL, 41: HEAL, 43: HEAL, 44: HEAL, 45: HEAL,   // 歸元, 凝神, 凝神歸元, 元靈歸心, 還魂咒, 靈血咒, 淨衣咒
  42: { white: 'petal', gold: 'glint', any: 'petal' },   // 觀音下凡: lotus petals
  46: 'hue', 47: 'hue', 48: 'hue', 49: 'hue',   // 金剛咒, 真元護體, 金剛破, 真元歸天: gold glints
  50: 'hue', 51: { white: 'petal', any: 'petal' },   // 封魔符; 迴夢: a dream's petals
  52: EARTH, 53: { white: 'drop', blue: 'drop', cyan: 'drop', grey: 'drop' },   // 哮天犬: dust; 龍王: water
  54: EARTH, 55: FIRE, 56: FIRE, 57: 'hue',   // 龍鬚虎; 火鳳凰; 麒麟獸; 四不像
};
// the level-ups, by the hero's sprite (src/levelup.js LEVEL_POSE)
export const LEVEL_MOTIF = {
  p0: SWORD,   // 林雲: the blue sword of light
  p1: { any: 'petal', gold: 'glint' },   // 燕蓉: 天女散花, flowers
  p2: { white: 'glint', grey: 'glint', blue: 'glint' },   // 楊戩: silver mist, the third eye's gold
  p3: 'hue',   // 黃飛虎: the 五色神牛's five colours
  p4: 'hue',   // 哪吒: the lotus's pink, the wheels' fire
  p5: FIRE,   // 姬發: the phoenix
  p6: THUNDER,   // 雷震子: wind and thunder
  jiang: 'hue',   // 姜子牙: the golden lotuses
  '0a76a2': 'hue',   // 黃天化
  '0aa86c': EARTH,   // 土行孫: through the earth
  '0d006e': { white: 'drop', blue: 'drop', cyan: 'drop', grey: 'drop', gold: 'glint' },   // 小龍女: water
  '0d2ad2': 'hue',   // 燃燈: the lamp's flame, the 定海珠
};
