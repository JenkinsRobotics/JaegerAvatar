// cell_1_1 · Close-up eyes, tongue. From the neutral face Mochi squashes, squints and pokes out a tongue, then
// the face lunges into a close-up of furious "> <" eyes while the tongue flaps up and down (blurred in-betweens
// with speed lines), springs back to a wide "‿ ‿" grin, and laughs with arched "∩ ∩" eyes before settling.
// One 74-frame cycle (from frame 18) repeats through the clip. Every pose is a hard cut, so poses are looked up
// by video frame. A clean vector take on the reference: eyes are drawn once on the left and mirrored about
// x = 180 (a pose may lean or tilt the whole face), built from a few ideal shapes: the kit's eye and smile,
// tapered strokes, half-ellipse domes, ellipses and round-capped arches. The tongue is the deliberate asymmetry.
import { begin, clamp, MOUTH, eye, smile, restFace } from '../mochi-face.js';
export const title = 'Close-up eyes, tongue';

const TONGUE = '#6e0a10', STREAK = 'rgba(240,226,228,0.9)';

// ── shapes ──────────────────────────────────────────────────────────────────────────────────────────────────
// Dome: an upper half-ellipse (ryT) on a lower half-ellipse (ryB); with ryT ~ 0 it is a flat-topped bowl.
function dome(g, cx, cy, rx, ryT, ryB, rot = 0) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath();
  g.ellipse(0, 0, rx, Math.max(ryT, .01), 0, Math.PI, 2 * Math.PI); g.ellipse(0, 0, rx, Math.max(ryB, .01), 0, 0, Math.PI);
  g.fill(); g.restore();
}
const ellipses = (g, E) => { for (const [x, y, rx, ry, r = 0] of E) { g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, 7); g.fill(); } };
const tongue = (g, fn) => { g.save(); g.fillStyle = TONGUE; fn(g); g.restore(); };
// A quadratic stroke A -C- B whose width tapers wA -> wB; round ends unless the end is off screen.
function stroke(g, A, C, B, wA, wB, capA = true, capB = true) {
  const L = [], R = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t, x = u * u * A[0] + 2 * t * u * C[0] + t * t * B[0], y = u * u * A[1] + 2 * t * u * C[1] + t * t * B[1];
    const dx = u * (C[0] - A[0]) + t * (B[0] - C[0]), dy = u * (C[1] - A[1]) + t * (B[1] - C[1]), l = Math.hypot(dx, dy) || 1, h = (wA + (wB - wA) * t) / 2;
    L.push([x - dy / l * h, y + dx / l * h]); R.unshift([x + dy / l * h, y - dx / l * h]);
  }
  g.beginPath(); L.concat(R).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  if (capA) { g.beginPath(); g.arc(A[0], A[1], wA / 2, 0, 7); g.fill(); }
  if (capB) { g.beginPath(); g.arc(B[0], B[1], wB / 2, 0, 7); g.fill(); }
}
// ">" eye (left; mirrored for "<"): two tapered strokes from the outer ends [x1,y1] / [x2,y2] to the tip.
// The close-up version runs its outer ends off screen (x = -40).
function chevron(g, [x1, y1, c1x, c1y, tx, ty, c2x, c2y, x2, y2, wE, wT]) {
  const on = x1 > -40;
  stroke(g, [x1, y1], [c1x, c1y], [tx, ty], wE, wT, on); stroke(g, [tx, ty], [c2x, c2y], [x2, y2], wT, wE, true, on);
}
const closeUp = ([y1, c1x, c1y, tx, ty, c2x, c2y, y2, wE, wT]) => [-40, y1, c1x, c1y, tx, ty, c2x, c2y, -40, y2, wE, wT];
// Laughing "∩" eye: an even round-capped stroke over a half-ellipse with straight legs.
function arch(g, cx, cy, rx, ry, lw, leg) {
  g.save(); g.lineWidth = lw; g.beginPath(); g.moveTo(cx - rx, cy + leg); g.lineTo(cx - rx, cy);
  g.ellipse(cx, cy, rx, ry, 0, Math.PI, 2 * Math.PI); g.lineTo(cx + rx, cy + leg); g.stroke(); g.restore();
}
// Draw fn for the left eye, then again mirrored about x = 180.
const pair = (g, fn) => { fn(g); g.save(); g.translate(360, 0); g.scale(-1, 1); fn(g); g.restore(); };
// The whole face leaned sideways by dx and tilted by rot about the screen centre.
const lean = (g, dx, rot, fn) => { g.save(); g.translate(180 + dx, 125); g.rotate(rot); g.translate(-180, -125); fn(g); g.restore(); };
function streaks(g, S) {
  g.save(); g.strokeStyle = STREAK; g.lineWidth = 1.6;
  for (const [x, y0, y1, b] of S) { g.beginPath(); g.moveTo(x - b, y0); g.quadraticCurveTo(x + b, (y0 + y1) / 2, x - b, y1); g.stroke(); }
  g.restore();
}

// ── poses ───────────────────────────────────────────────────────────────────────────────────────────────────
const SQUINT = [ // small ">" eyes with the face leaning [dx], the mouth an "o" with the tongue poking out to the right
  [0, [65.5, 88.5, 109.5, 83.5, 137, 103, 86.5, 104, 59.5, 114, 8.5, 11], [169.5, 123, 31, 28, 13, -.1], [180.5, 127, 22.5, 8, .16]],
  [5, [62.5, 85, 109, 82, 139.5, 101.5, 88, 103, 53.5, 113.5, 7.5, 9.5], [168.5, 122.5, 31, 28.5, 14, -.16], [180.5, 125.5, 22, 10.5, .14]],
  [6, [59, 84, 109, 79, 139.5, 101.5, 81, 101.5, 62, 113.5, 8, 8], [170, 122.5, 31.5, 29.5, 11, -.35], [182.5, 124, 22, 10.5, .25]],
];
const squint = ([dx, eyeP, M, T]) => g => lean(g, dx, 0, g => { pair(g, g => chevron(g, eyeP)); dome(g, ...M); tongue(g, g => ellipses(g, [T])); });
// Close-up "> <" eyes (the face tilted .03 rad); the tongue is drawn untilted over them.
const C32 = [45, 80, 74, 119.5, 102.5, 37.5, 120, 155, 24, 17], C34 = [56.5, 84.5, 97, 111, 129.5, 43, 151, 184, 27, 18];
const C36 = [55, 78, 93, 111.5, 127, 50, 146.5, 181.5, 25, 18], C38 = [55, 75, 89, 114.5, 124.5, 39, 146, 180.5, 22.5, 16.5];
const C62 = [60, 70.5, 100.5, 115.5, 135.5, 52, 152, 176, 21, 16.5], C64 = [69, 59, 127, 108, 152.5, 136, 175, 169, 20, 16];
const fury = (C, dx, rot, tongueFn) => g => { lean(g, dx, rot, g => pair(g, g => chevron(g, closeUp(C)))); tongue(g, tongueFn); };
const FLAP = [ // tongue flap cycle while the close-up eyes hold (frames 38..61, period 4): down, blur, up, blur
  g => ellipses(g, [[191.5, 184, 50.5, 38.5, .26]]),
  g => { ellipses(g, [[193, 152, 56, 12], [194, 175.5, 54, 7.5], [196.5, 196.5, 49, 3.5]]); streaks(g, [[174, 143, 190, 1], [181.5, 147, 185, 1], [206.5, 125, 205, 2], [213, 140, 180, 1], [231, 140, 200, 2]]); },
  g => ellipses(g, [[192, 136.5, 55.5, 33, -.22]]),
  g => { ellipses(g, [[197, 132, 58, 5, -.08], [199.5, 156, 59.5, 11.5], [199, 188, 55, 9.5]]); streaks(g, [[164, 126, 203, 2], [174, 150, 195, 1], [211, 118, 202, 2], [235, 130, 205, 2]]); },
];
const laugh = (cy, ry, lw, leg, M, dx = 0) => g => { lean(g, dx, 0, g => pair(g, g => arch(g, 89.5, cy, 30.5, ry, lw, leg))); dome(g, 180, ...M); };
const REST = 'rest', LIFT = 6;
const POSES = [ // [first cycle frame, draw]
  [0, REST],
  [22, g => { pair(g, g => eye(g, 85, 120, { w: 76, h: 89 })); smile(g, 180, MOUTH.y + .5, { dip: 0, width: 21 }); }], // squash onto the eyes' base
  [24, g => { pair(g, g => dome(g, 92, 114, 47, 30, 12, -.15)); dome(g, 165, 128, 35, 22, 7, -.04); tongue(g, g => ellipses(g, [[169, 132, 23, 3.3, .07]])); }],
  [26, squint(SQUINT[0])],
  [28, squint(SQUINT[1])],
  [30, squint(SQUINT[2])],
  [32, fury(C32, -4, .01, g => ellipses(g, [[202, 106.5, 34, 6.5, -.12], [188, 131.5, 44, 14.5, -.07]]))],
  [34, fury(C34, 0, .03, g => ellipses(g, [[202, 139, 55.5, 35, -.42]]))],
  [36, fury(C36, -1, .03, g => ellipses(g, [[206.5, 150, 57, 33, -.32]]))],
  [37, fury(C36, -1, .03, g => ellipses(g, [[203.5, 139.5, 54, 7, -.15], [211, 163.5, 64.5, 13, -.09], [206.5, 195.5, 53.5, 11.5, -.04]]))],
  [38, (g, f) => fury(C38, -2.5, .03, FLAP[(f - 38) % 4])(g)],
  [62, fury(C62, 1, .03, g => dome(g, 193, 170, 46, 12, 30, -.06))],
  [64, fury(C64, 10, 0, g => dome(g, 192.5, 192.5, 44.5, 8.5, 21, -.05))],
  [66, g => lean(g, 6, 0, g => { pair(g, g => stroke(g, [10.5, 183], [78.5, 214.5], [121, 195], 25, 11)); smile(g, 180, 223, { w: 69, dip: 8.5, width: 13.5 }); })], // grin
  [68, g => lean(g, -4, 0, g => { pair(g, g => dome(g, 81, 146, 47, 7, 20.5)); dome(g, 180, 170.5, 34.5, 6, 18.5); })],
  [70, laugh(100.5, 32, 17, 19, [126, 39.5, 3, 36], -2.5)],
  [71, laugh(90.5, 36, 14.5, 16.5, [115.5, 39.5, 9, 31])],
  [73, laugh(95.5, 37, 15, 17, [120, 39.5, 7, 34])],
  [85, laugh(98, 33, 17, 23, [126, 39, 3.5, 34.5])],
  [86, 3.5], [89, 2.5], [91, REST], // settling: the resting face dips and comes back up
];

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), gx = clamp(o.gazeX || 0, -1, 1) * 12, k = clamp(o.intensity ?? 1, 0, 1.5);
  const F = Math.min(400, Math.floor(clamp(t, 0, 16.708333) * 24 + 1e-3)); // video frame on screen at t
  const f = F < 18 ? F : F >= 388 ? 91 : 18 + (F - 18) % 74; // the last cycle never starts
  const pose = POSES.filter(r => r[0] <= f).pop()[1];
  if (pose === REST) return restFace(g, gx, 0);
  if (typeof pose === 'number') return restFace(g, gx, pose);
  g.translate(gx, -LIFT); // pose coordinates were measured off the video, whose face sits LIFT px below the kit's
  // intensity scales how far the furious close-up (frames 32..67) zooms in on the face
  const s = f >= 32 && f < 68 ? 1 + (k - 1) * .25 : 1;
  if (s !== 1) { g.translate(180, 125); g.scale(s, s); g.translate(-180, -125); }
  pose(g, f);
}
