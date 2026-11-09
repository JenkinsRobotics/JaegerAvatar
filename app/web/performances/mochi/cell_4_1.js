// cell_4_1 · Drowsy, big yawn. A clean vector version of the reference clip in the kit's 360x234 space, anchored
// on the shared resting face (the source draws this clip 22 px lower; that offset is removed). Poses are keyed by
// video frame and held, exactly like the source's stepped 24 fps animation.
// Cycle (151 frames, plays twice from frame 73): mirrored lids sink along one smooth ease while the mouth glides
// through a single lens shape, a squint, a > < squeeze, a big symmetric yawn, content closed eyes over a wavy
// mouth, then the eyes reopen onto the resting face.
import { begin, restFace, eye, smile, EYE, MOUTH, INK, BG, clamp, mix, smooth } from '../mochi-face.js';
export const title = 'Drowsy, big yawn';

const T0 = 73, PERIOD = 151, CYCLES = 2, TONGUE = '#6e0a0f';
// Drooping lids: the lid steps on these frames, following one ease (depth below the eye top, px). Outer corners sit lower.
const LID_KEYS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 53, 56, 59, 63];
const lidDepth = k => 61 * smooth((k + 6) / 65), LID_TILT = 0.001;
// Mouth while the lids droop: one lens [cx, cy, w, top sag, bottom sag, tilt] (stroke 11) gliding away from the
// resting smile and back. null = the resting smile.
const WOBBLE = [[10, 186.3, 164.3, 57.1, 6.7, 10.4, -0.11], [13, 193.5, 170.1, 57, 1.3, 8.9, -0.19], [16, 198.9, 178.1, 51, -6.3, 7.2, -0.2],
  [19, 198.3, 185.4, 44.7, -13.1, 6.8, -0.13], [22, 191, 188.6, 40.9, -15.6, 6.8, -0.03], [25, 181.3, 186, 39.2, -12.9, 5.3, 0.03],
  [27, 177, 179.5, 42.6, -8.3, 1.9, 0.05], [29, 180, 175.4, 46, -6.4, 0.3, 0.04], [32, 183.7, 176.5, 41.3, -7.2, 2, 0.04],
  [35, 183.9, 179.9, 35.2, -9.2, 4.4, 0.04], [38, 180.5, 180.1, 37.9, -9.3, 5.5, 0.06], [41, 177.2, 174.8, 46.7, -4.6, 6.2, 0.08],
  [44, 177.7, 167.7, 51.1, 3.2, 7.8, 0.07], [47, null]];
// Poses from the squint on: [frame, axis shift ox, shapes]. Paired shapes are mirrored exactly about x = 180 + ox
// (the face turns a little left at the squeeze and right while yawning; that drift is the source's).
//  E  resting eyes cut by a mirrored lid [dy, lid y, slope]      S  resting smile [dy]
//  L  lens [x0, y0, x1, y1, top sag, bottom sag, round]          L2 / C2  mirrored lens / even arc [x0, y0, x1, y1, sag, width]
//  V2 chevrons [tip x, tip y, upper arm dx, dy, lower arm dx, dy, width]
//  W  wavy mouth [cx, cy, w, hump, hook, width]
//  Y  yawn centred on the axis [cy, rx, ry, egg, n, rim, tilt, top band, band curve, fang x, fang w, fang len,
//     bottom band, band curve, tooth x, tooth w, tooth len, tongue y, tongue rx, tongue ry]
const POSES = [
  [68, 2, [['E', 4.6, 134.5, 0.03], ['S', 7]]],
  [71, 0, [['L2', 59.2, 163.9, 118.1, 166.7, -3.7, 10.2, 12.6], ['L', 149.8, 182.5, 209.4, 184.4, 2.2, 6.2, 9.3]]],
  [73, -3, [['V2', 130, 184.5, -45.8, -29.5, -42, 7, 10.8], ['L', 140.6, 198, 199.5, 205.5, -10.5, -6.5, 10.3]]],
  [75, -19, [['Y', 177, 44, 44.5, 0.5, 2.9, 10, -0.22, 12, 8, 20, 0, 10, 8, 6, 20, 0, 10, 14, 15, 9], ['V2', 94.9, 147.5, -42, -10, -38, 4, 10]]],
  [77, -5.1, [['Y', 132.8, 61.7, 84.8, 0.25, 2.32, 7.9, 0, 17.4, 28.5, 38.3, 19.1, 41.5, 34, 1.5, 44.4, 21.1, 53.5, 35.2, 35, 29.6], ['C2', 56.3, 97.7, 101.7, 87.7, -3.8, 9.8]]],
  [80, -4.7, [['Y', 128.7, 70.4, 94.7, 0.23, 2.19, 8.1, 0, 20.3, 32.6, 42.1, 21.5, 48.7, 34, 12.3, 48.4, 22.3, 61.2, 39.3, 31.4, 32.5], ['C2', 56.2, 95.2, 94.5, 82.2, -3.6, 9.1]]],
  [83, -2.6, [['Y', 126, 80, 100.3, 0.21, 2.07, 8.2, 0, 21.6, 35.4, 44.6, 22.3, 51.1, 34.4, 16.1, 52.5, 24.3, 64.7, 41.1, 28.2, 33.3], ['C2', 55.8, 93.3, 92, 77.6, -2.8, 8.3]]],
  [86, 0.8, [['Y', 124.5, 89.1, 103, 0.18, 1.96, 8.1, 0, 21.9, 34.2, 46.5, 22.7, 51.3, 34.9, 16.8, 56.2, 26.6, 66.3, 41.8, 26.7, 33], ['C2', 55.7, 92.3, 92, 72.2, -2, 7.9]]],
  [90, 3.7, [['Y', 123.9, 95.1, 104.9, 0.16, 1.86, 7.9, 0, 22, 30, 48, 23.5, 51.6, 35.1, 18.4, 58.8, 27.3, 68, 42.1, 26.4, 32.7], ['C2', 56, 91.5, 92.5, 67.2, -0.8, 7.7]]],
  [94, 5.1, [['Y', 123.7, 97.9, 105.4, 0.15, 1.83, 7.6, 0, 21.8, 27.5, 49.2, 24.8, 52, 34.9, 20.6, 60.4, 26.6, 68.6, 42.2, 26.4, 32.3], ['C2', 57, 91, 93.4, 64.5, 0.8, 7]]],
  [98, 6, [['Y', 123.8, 99.2, 105.1, 0.15, 1.83, 7.3, 0, 21.3, 28.1, 49.9, 26.2, 52, 34.4, 22.4, 61.2, 26.2, 68.3, 42.2, 26.4, 32], ['C2', 58, 90.9, 94.4, 64.3, 1.6, 6.7]]],
  [102, 7.4, [['Y', 124.9, 100, 103.3, 0.15, 1.84, 7.1, 0, 22.6, 29.7, 49.8, 25.5, 50.3, 34.1, 20.8, 61.5, 25.9, 67.2, 41.8, 25.8, 32], ['C2', 59.8, 92.1, 96.3, 66.6, 2.1, 7.2]]],
  [105, 10.2, [['Y', 128.1, 100.4, 98.7, 0.17, 1.87, 6.6, 0, 27.1, 30.5, 49.5, 21.4, 47.5, 34, 14.3, 61.5, 25.2, 65.6, 40.4, 24.4, 32.3], ['C2', 63.4, 95.8, 99.2, 71.7, 2.9, 8.5]]],
  [107, 14.9, [['Y', 144.5, 98.2, 64.9, 0.27, 2.46, 6, 0, 22, -1.5, 58.5, 20, 22.8, 21.2, -7.1, 60.9, 30.6, 43.9, 26.3, 27.8, 27.4], ['C2', 59.6, 103.5, 120.1, 88.5, 3.8, 11.3]]],
  [109, 18.2, [['Y', 167.2, 92.9, 34, 0.46, 2.91, 7.8, 0, 9, 1, 57, 17.5, 9, 15.4, -16.2, 58, 36.2, 27.7, 5.9, 27.5, 19.6], ['C2', 57.9, 134.7, 132.9, 119.1, 10.4, 12.4]]],
  [111, 12, [['C2', 53.3, 161.3, 130.8, 157.1, 23.8, 10.5], ['W', 204, 199, 166.1, 8.8, 0, 11.3]]],
  [113, 10, [['C2', 53.5, 169.5, 130, 165.5, 24.1, 10.2], ['W', 194.9, 208, 155, 5.6, 2, 9.5]]],
  [116, 9.9, [['C2', 55.8, 167, 130.7, 163.9, 23.9, 10.6], ['W', 195.7, 207.8, 153, 6.8, 2.2, 11]]],
  [119, 9, [['C2', 55.1, 165, 130.9, 161, 25, 10.7], ['W', 195.3, 207, 152.5, 7.3, 1.6, 11.5]]],
  [130, 7.5, [['C2', 55.4, 171.4, 129.7, 167, 19.4, 11.2], ['W', 195.3, 209, 128.5, 10, -0.3, 12.3]]],
  [132, -3, [['C2', 51, 180, 119, 179, 10, 12.6], ['W', 188, 207.1, 82.8, 8, -4, 11.5]]],
  [134, 0, [['E', 10.7, 100.9, 0.07], ['S', 13.5]]],
  [136, 0, [['R', -2]]],          // settle: the resting face, 2 px high
  [138, null]];

const step = (table, k) => { let r = null; for (const row of table) if (row[0] <= k) r = row; return r; };

// Lens between two end points; each edge is a quadratic sagging a / b px off the chord (positive = down for a
// left-to-right chord); c rounds it. With a === b it is an even round-capped arc of width c.
function lens(g, x0, y0, x1, y1, a, b, c) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (y0 - y1) / L, ny = (x1 - x0) / L, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  g.beginPath(); g.moveTo(x0, y0);
  g.quadraticCurveTo(mx + nx * 2 * a, my + ny * 2 * a, x1, y1); g.quadraticCurveTo(mx + nx * 2 * b, my + ny * 2 * b, x0, y0);
  g.closePath(); g.fill(); g.lineWidth = c; g.stroke();
}
const lensPair = (g, A, x0, y0, x1, y1, a, b, c) => { lens(g, x0, y0, x1, y1, a, b, c); lens(g, 2 * A - x1, y1, 2 * A - x0, y0, a, b, c); };
// The resting eye cut by a straight lid line through (cx, lid) with the given slope.
function lidEye(g, cx, cy, lid, slope) {
  g.save(); g.beginPath(); g.moveTo(cx - 60, lid - 60 * slope); g.lineTo(cx + 60, lid + 60 * slope); g.lineTo(cx + 60, 300); g.lineTo(cx - 60, 300); g.clip();
  eye(g, cx, cy); g.restore();
}
const lidEyes = (g, A, dy, lid, slope) => { lidEye(g, EYE.left + A - 180, EYE.y + dy, lid, -slope); lidEye(g, EYE.right + A - 180, EYE.y + dy, lid, slope); };
function chevrons(g, A, tx, ty, ux, uy, lx, ly, w) {
  g.lineWidth = w;
  for (const s of [1, -1]) { const x = v => s > 0 ? v : 2 * A - v; g.beginPath(); g.moveTo(x(tx + ux), ty + uy); g.lineTo(x(tx), ty); g.lineTo(x(tx + lx), ty + ly); g.stroke(); }
}
// Wavy mouth: a centre hump between two small hooks, symmetric about cx.
function wave(g, cx, cy, w, hump, hook, width) {
  const h = w / 2; g.save(); g.translate(cx, cy); g.lineWidth = width; g.beginPath(); g.moveTo(-h, -hook);
  g.quadraticCurveTo(-0.85 * h, 0.6 * hook, -0.55 * h, 0); g.quadraticCurveTo(0, -2 * hump, 0.55 * h, 0); g.quadraticCurveTo(0.85 * h, 0.6 * hook, h, -hook);
  g.stroke(); g.restore();
}
const spow = (v, p) => Math.sign(v) * Math.abs(v) ** p;
function egg(g, rx, ry, e, n) {   // superellipse, wider at the bottom for e > 0; symmetric left/right
  g.beginPath();
  for (let i = 0; i < 72; i++) { const a = i / 36 * Math.PI, u = Math.cos(a), v = Math.sin(a); g.lineTo(rx * spow(u, 2 / n) * (1 + e * v), ry * spow(v, 2 / n)); }
  g.closePath();
}
function band(g, y0, k, rx, far) {   // the region beyond the parabola y = y0 + k (x/rx)^2
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const x = (i / 12 - 1) * 1.6 * rx; g.lineTo(x, y0 + k * (x / rx) ** 2); }
  g.lineTo(1.6 * rx, far); g.lineTo(-1.6 * rx, far); g.closePath(); g.fill();
}
const tooth = (g, x, y0, y1, w) => { g.beginPath(); g.roundRect(x - w / 2, y0, w, y1 - y0, Math.max(0, Math.min(w / 3, w / 2, (y1 - y0) / 2))); g.fill(); };
// The yawn: egg-shaped white rim, dark inside, tongue, and mirrored fangs / teeth on curved bands. s scales it about
// its lower centre (intensity).
function yawn(g, cx, [cy, rx, ry, e, n, t, rot, bt, bk, fx, fw, fy, bb, bkb, tx, tw, ty, tcy, trx, tr], s) {
  g.save(); g.translate(cx, cy + ry * (1 - s)); g.scale(s, s); g.rotate(rot);
  egg(g, rx, ry, e, n); g.fill();
  const ri = ry - t; egg(g, rx - t, ri, e, n); g.clip(); g.fillStyle = BG; g.fill();
  g.fillStyle = TONGUE; g.beginPath(); g.ellipse(0, tcy, trx, tr, 0, 0, 2 * Math.PI); g.fill();
  g.fillStyle = INK; band(g, -ri + bt, bk, rx, -400); band(g, ri - bb, -bkb, rx, 400);
  for (const x of [-fx, fx]) tooth(g, x, -ri - 20, -ri + fy, fw);
  for (const x of [-tx, tx]) tooth(g, x, ri - ty, ri + 20, tw);
  g.restore();
}
function shape(g, A, [kind, ...p], I) {
  if (kind === 'E') lidEyes(g, A, p[0], p[1], p[2]);
  else if (kind === 'S') smile(g, A, MOUTH.y + p[0]);
  else if (kind === 'R') restFace(g, A - 180, p[0]);
  else if (kind === 'L') lens(g, ...p);
  else if (kind === 'L2') lensPair(g, A, ...p);
  else if (kind === 'C2') lensPair(g, A, p[0], p[1], p[2], p[3], p[4], p[4], p[5]);
  else if (kind === 'V2') chevrons(g, A, ...p);
  else if (kind === 'W') wave(g, ...p);
  else yawn(g, A, p, clamp(mix(0.35, 1, I), 0.2, 1.2));
}

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), I = clamp(o.intensity ?? 1, 0, 1.5), gx = clamp(o.gazeX || 0, -1, 1) * 12;
  let k = Math.floor(t * 24 + 1e-4) - T0;
  k = k >= 0 && k < PERIOD * CYCLES ? k % PERIOD : -1;
  if (k < 0 || k >= 138) return restFace(g, gx, 0);
  g.translate(gx, 0);
  if (k >= 68) { const [, ox, shapes] = step(POSES, k); for (const s of shapes) shape(g, 180 + ox, s, I); return; }
  // Drowsy: both resting eyes cut by one mirrored lid line (depth follows intensity), and the gliding mouth.
  const d = lidDepth(step(LID_KEYS.map(f => [f]), k)[0]) * clamp(I);
  lidEyes(g, 180, 0, EYE.y - EYE.h / 2 + d, LID_TILT * d);
  const m = step(WOBBLE, k);
  if (!m || !m[1] || I <= 0.3) return smile(g);
  const [, cx, cy, w, a, b, tilt] = m, dx = Math.cos(tilt) * w / 2, dy = Math.sin(tilt) * w / 2;
  lens(g, cx - dx, cy - dy, cx + dx, cy + dy, a, b, 11);
}
