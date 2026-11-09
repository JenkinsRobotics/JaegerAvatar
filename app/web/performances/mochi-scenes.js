// All ten Mochi Classic clips: five scenes, primary (_0) and alternate (_1). Each draws in 360x234 video space.
import * as c00 from './mochi/cell_0_0.js'; import * as c01 from './mochi/cell_0_1.js';
import * as c10 from './mochi/cell_1_0.js'; import * as c11 from './mochi/cell_1_1.js';
import * as c20 from './mochi/cell_2_0.js'; import * as c21 from './mochi/cell_2_1.js';
import * as c30 from './mochi/cell_3_0.js'; import * as c31 from './mochi/cell_3_1.js';
import * as c40 from './mochi/cell_4_0.js'; import * as c41 from './mochi/cell_4_1.js';
export { DURATION } from './mochi-face.js';
export const CLIPS = { cell_0_0: c00, cell_0_1: c01, cell_1_0: c10, cell_1_1: c11, cell_2_0: c20, cell_2_1: c21, cell_3_0: c30, cell_3_1: c31, cell_4_0: c40, cell_4_1: c41 };
