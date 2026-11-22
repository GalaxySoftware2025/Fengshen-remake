// Every recipe tex.js's workers can paint (src/kit/paintworker.js): the shared ones (src/kit/paint.js) by their names, and
// the sets' own (src/remake/paint/<set>.js) as '<set>.<recipe>' (a set asks for one with T.use). Nothing here is ROM data.
import { RECIPES as SHARED } from './paint.js';
import * as firecave from '../remake/paint/firecave.js';
import * as hall from '../remake/paint/hall.js';
import * as icecave from '../remake/paint/icecave.js';
import * as jiameng from '../remake/paint/jiameng.js';
import * as jiulong from '../remake/paint/jiulong.js';
import * as kunlunReimagine from '../remake/paint/kunlun-reimagine.js';
import * as lair from '../remake/paint/lair.js';
import * as lotus from '../remake/paint/lotus.js';
import * as prison from '../remake/paint/prison.js';
import * as shrine from '../remake/paint/shrine.js';
import * as tianmen from '../remake/paint/tianmen.js';
import * as wanshou from '../remake/paint/wanshou.js';
import * as zhaixingReimagine from '../remake/paint/zhaixing-reimagine.js';
import * as zhuxian from '../remake/paint/zhuxian.js';
export const RECIPES = { ...SHARED };
for (const [mod, fns] of Object.entries({ firecave, hall, icecave, jiameng, jiulong, 'kunlun-reimagine': kunlunReimagine, lair, lotus, prison, shrine, tianmen, wanshou, 'zhaixing-reimagine': zhaixingReimagine, zhuxian })) for (const [k, f] of Object.entries(fns)) RECIPES[mod + '.' + k] = f;
