// cell_3_1 · Tired blinking. Seven times the eyes sag: they squash flat and spread wide towards a line just
// below their centres, the smile flattens with them, they thin out to bowed hairlines, then pop back open
// with a small overshoot. Every pose is the kit's resting face, squashed; stepped on the source's frames.
import { begin, clamp, mix, eye, arc, smile, restFace, EYE, MOUTH, DURATION } from '../mochi-face.js';
export const title = 'Tired blinking';

// Pose = eye width, eye height, smile dip, smile line width. Eyes squash towards y = PIVOT; under 30 px tall
// they become flat round-capped bars, and hairlines (under 8 px) bow up by BOW. The smile's middle stays put while its ends drop as it flattens, and
// it keeps its overall span as its line thins.
const REST = [EYE.w, EYE.h, MOUTH.dip, MOUTH.width], PIVOT = EYE.y + 13, BOW = 3, SPAN = MOUTH.w + MOUTH.width;
const P = {
  sag1: [74, 100, 9, 13], sag2: [80, 84, 7, 12], sag3: [86, 64, 5, 11], sag4: [92, 36, 2, 10],
  sag5: [96, 22, 1, 9], flat: [98, 14, 0, 8], line1: [98, 6, -1, 7], line2: [98, 4, -3, 7],
  open: [80, 34, 1, 8], pop: [72, 118, 10, 13],
};
// One sag cycle as [frame within the cycle, pose]; cycles are 51 frames long, start on frame 29, run 7 times.
const CYCLE = [[0, P.sag1], [3, P.sag2], [6, P.sag3], [8, P.sag4], [10, P.sag5], [13, P.flat], [36, P.line1],
  [38, P.line2], [40, P.open], [42, P.pop], [44, P.sag1], [47, REST]];
const START = 29, PERIOD = 51, CYCLES = 7;

function pose(t) {
  const f = Math.floor(clamp(t, 0, DURATION) * 24 + 1e-3) - START, c = Math.floor(f / PERIOD);
  if (f < 0 || c >= CYCLES) return REST;
  let p = REST; for (const [kf, kp] of CYCLE) if (f - c * PERIOD >= kf) p = kp;
  return p;
}

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), gx = (o.gazeX || 0) * 12, k = Math.max(0, o.intensity ?? 1), q = pose(t);
  if (q === REST) return restFace(g, gx, 0);
  const [w, h, dip, lw] = q.map((v, i) => mix(REST[i], v, k));
  const y = mix(PIVOT, EYE.y, h / EYE.h), mid = MOUTH.y + MOUTH.dip;
  for (const cx of [EYE.left + gx, EYE.right + gx])
    h < 30 ? arc(g, cx, y, w - h, h < 8 ? -BOW : 0, Math.max(1, h)) : eye(g, cx, y, { w, h });
  smile(g, MOUTH.x + gx, mid - dip, { dip, width: Math.max(1, lw), w: SPAN - Math.max(1, lw) });
}
