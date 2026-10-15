// 傅山山谷二 (battle 2): presentation. The battle plays on the remade gorge (src/remake/gorge.js), the same set and
// light (late in the day, overcast) as scene 2 before it; the leader's order to fall back comes from the rules' turn
// hook (02-fushan.js). The battle a little brighter than the scene [the user's call]: more exposure and sky light,
// a touch more colour, thinner haze.
import gorge from '../remake/gorge.js';

const M = gorge.mood;
export default {
  look: { set: Object.assign({}, gorge, { mood: Object.assign({}, M, { exposure: 0.82, hemi: 0.95, sunI: 2.8, sat: 0.86, fogD: 0.014 }) }) },
};
