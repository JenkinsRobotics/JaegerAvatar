// cell_4_0 · Hearts & kiss. A clean vector version of the reference clip in the kit's 360x234 space, anchored on
// the shared resting face (the source draws this clip 22 px lower; that offset is removed). Poses are keyed by video
// frame and held, exactly like the source's stepped 24 fps animation.
// Cycle (96 frames, plays four times from frame 14): squash and blink shut, pop into mirrored glossy heart eyes with
// blush and an open grin (squash-and-settle), squeeze into a kissy face turned to the right with a "3" mouth, blink
// back to the resting face while two bubbles beside the mouth hold and fade.
import { begin, restFace, eye, smile, EYE, MOUTH, INK, BG, clamp, mix } from '../mochi-face.js';
export const title = 'Hearts & kiss';

const T0 = 14, PERIOD = 96, CYCLES = 4;
const COL = { hl: '#f3ccd0', bl: '#d35ea6', heart: '#ae0011', edge: '#920418', tongue: '#610218', bubble: 'rgba(137,187,216,0.24)' };
// The kissy face (frames 33-37 share it; the "3" settles leftwards): blushes, brow ticks, closed-eye arcs.
const KISS = [['O', 49.9, 106.7, 41.6, 26.8, 3.07], ['O', 320.3, 180.7, 30, 21.6, -2.55], ['C', 157.3, 30, 179, 24.4, 3.1, 8.6],
  ['C', 263.7, 57.9, 274.1, 73.5, 2.5, 7], ['C', 45.8, 56.2, 164.3, 69.5, -7.8, 17.8], ['C', 260.1, 101.1, 341.1, 145.8, -4.9, 14.8]];
// Poses: [cycle frame, shapes]; null = the resting face. Pairs (…2) are mirrored exactly about x = 180.
//  E  resting eyes cut by a mirrored lid [dy, lid y, slope]   Es stretched resting eyes [dy, w, h]   S resting smile [dx, dy, tilt]
//  C / C2  even round-capped arc (pair) [x0, y0, x1, y1, sag, width]   L lens [x0, y0, x1, y1, top sag, bottom sag, round]
//  H2 heart eyes [cx, cy, w, h]   O / O2 blush ellipse (pair) [cx, cy, rx, ry, rot]   G open grin [cy, rx, ry, pop]
//  T  kiss "3" [cusp x, cusp y, (radius, start, end angle in degrees, tilt, width)]   X smear eye [cx, cy, w, h, tilt, n, lid y, slope]
const POSES = [
  [0, [['E', 14.5, 151, -0.08], ['C', 150.6, 186.9, 209.4, 186.9, -2.3, 12.6]]],
  [2, [['C2', 44.5, 171.8, 126.1, 177, 5.6, 9.3], ['C', 147.4, 196.2, 212.6, 196.2, -2.5, 8.5]]],
  [4, [['O2', 56.7, 200.2, 14.4, 9.9, 2.75], ['H2', 81.75, 119.5, 99.5, 125], ['G', 166, 34.5, 38.5, 1]]],
  [6, [['O2', 52.7, 171, 22.1, 16.5, 2.73], ['H2', 84.3, 95, 101, 110.5], ['G', 145.5, 31.4, 26.9]]],
  [8, [['O2', 52.3, 173.2, 23.2, 15.8, 2.79], ['H2', 83.9, 99.5, 104, 105], ['G', 147.5, 32.1, 24]]],
  [10, [['O2', 51.7, 176.4, 23.3, 15.4, 2.85], ['H2', 83.5, 104, 106.5, 101.5], ['G', 150, 33.1, 24]]],
  [12, [['O2', 52.5, 174, 23.2, 15.5, 2.86], ['H2', 84.25, 100.5, 106.5, 103.5], ['G', 148, 33, 24]]],
  [26, [['O2', 50.1, 182, 22.3, 16.4, 3.06], ['H2', 86, 117.5, 106, 95], ['G', 158, 31.5, 21]]],
  [28, [['O', 42.2, 192.5, 24.2, 16.7, -3.03], ['C', 37.7, 139.9, 133.4, 166.5, 10.3, 13.9], ['C', 137.7, 138.7, 150, 146.4, 0.4, 7.9],
    ['C', 238.7, 162.6, 248.5, 161.5, 0.6, 7.5], ['L', 164.8, 177.8, 213.8, 190.4, 4.6, 10.6, 11.4], ['C', 249.1, 182.2, 327.6, 187.8, 6.1, 14.2]]],
  [30, [['O', 44.8, 186.7, 25, 17.6, -3.07], ['C', 147.2, 127.2, 165.3, 127.6, 2.6, 9.3], ['C', 244.4, 146.7, 256.6, 149.5, 2.4, 9.1],
    ['L', 180.5, 183.7, 221.6, 179.3, -3.8, 10.1, 11.4], ['L', 41.2, 135.1, 144.9, 156.9, 7.4, 15.5, 13.8], ['L', 250.3, 177.8, 333.1, 185.1, 1.3, 10.1, 10.9]]],
  [32, [['O', 46.1, 179.4, 26.7, 19.6, 3.11], ['O', 322.5, 210.3, 17.4, 6.2, -3.14], ['T', 213.1, 148.1, 24, -105, 80, 0.34, 7.8],
    ['C', 167, 35.1, 184.1, 32.2, 1.7, 12.2], ['C', 270.7, 63.2, 282.4, 80.4, 2.5, 7], ['X', 119.7, 48.7, 134, 234, 0.22, 4, 53.9, 0.15], ['X', 302.2, 102.6, 91, 179, 0, 8, 115.9, 0.54]]],
  [33, [...KISS, ['T', 214.5, 139.8]]],
  [35, [...KISS, ['T', 212, 139]]],
  [37, [...KISS, ['T', 210.5, 138.8]]],
  [50, [['O', 44.6, 128.3, 31.7, 21.7, 3.1], ['O', 319.7, 191.7, 25.9, 17.5, -2.92], ['T', 211.2, 149.7], ['C', 165.9, 67.1, 181, 74.5, 1.1, 7.7],
    ['C', 250.9, 99.9, 264.8, 97, 1.3, 6.8], ['C', 254.7, 121.8, 338.3, 153.4, -2.6, 14], ['C', 51.3, 81.6, 166, 98.3, -5.2, 17.4]]],
  [52, [['L', 183.5, 189.3, 221.9, 179.4, -3.1, 7.2, 8.1], ['L', 50.1, 153.2, 154.6, 161.9, 3.7, 13.2, 12.6], ['L', 247, 170.5, 326.9, 172, 1.1, 8.6, 12.9]]],
  [54, [['E', 5.3, 88, 0, 5], ['S', 5, 6, -0.08]]],
  [56, [['Es', -2.5, 71, 111], ['S', 0, 0, 0]]],
  [58, null]];
// Bubbles beside the "3": [cycle frame, [cx, cy, r]...]; after the kiss they hold over the resting face, then fade.
const BUBBLES = [[33, [223, 118, 14.5], [215, 163, 13]], [35, [218, 119, 13.5], [211, 161, 12.5]],
  [37, [216, 120, 13.5], [211, 159, 13.5]], [50, [221, 116, 16.5], [211, 163, 15]], [52, [220, 117, 17.5], [212, 162, 15.5]]];
const FADE = [64, 91];
const THREE = [19.3, -141.5, 96, 0.2, 7.8];   // the kiss "3": two equal arcs [radius, start, cusp angle (deg), tilt, width]

const step = (table, k) => { let r = null; for (const row of table) if (row[0] <= k) r = row; return r; };
const spow = (v, p) => Math.sign(v) * Math.abs(v) ** p;

// Lens between two end points; each edge is a quadratic sagging a / b px off the chord (positive = down for a
// left-to-right chord); c rounds it. With a === b it is an even round-capped arc of width c.
function lens(g, x0, y0, x1, y1, a, b, c) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (y0 - y1) / L, ny = (x1 - x0) / L, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  g.beginPath(); g.moveTo(x0, y0);
  g.quadraticCurveTo(mx + nx * 2 * a, my + ny * 2 * a, x1, y1); g.quadraticCurveTo(mx + nx * 2 * b, my + ny * 2 * b, x0, y0);
  g.closePath(); g.fill(); g.lineWidth = c; g.stroke();
}
// A resting eye (optionally stretched) cut by a straight lid line through (cx, lid) with the given slope.
function lidEye(g, cx, cy, lid, slope, opt) {
  g.save(); g.beginPath(); g.moveTo(cx - 99, lid - 99 * slope); g.lineTo(cx + 99, lid + 99 * slope); g.lineTo(cx + 99, 400); g.lineTo(cx - 99, 400); g.clip();
  eye(g, cx, cy, opt); g.restore();
}
// Smear-frame eye: a superellipse w x h (exponent n), turned by tilt, cut by a lid line.
function smear(g, cx, cy, w, h, tilt, n, lid, slope) { lidEye(g, cx, cy, lid, slope, { w, h, tilt, n }); }
function oval(g, fill, cx, cy, rx, ry, rot) { g.fillStyle = fill; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 2 * Math.PI); g.fill(); g.fillStyle = INK; }
// Glossy heart, exactly symmetric, in a unit box scaled to w x h; its two highlights sit in the same unit box, so
// both hearts are lit from the upper left.
function heart(g, cx, cy, w, h) {
  g.save(); g.translate(cx, cy); g.scale(w, h); g.beginPath(); g.moveTo(0, -0.385);
  g.bezierCurveTo(0.02, -0.435, 0.122, -0.5, 0.25, -0.5); g.bezierCurveTo(0.372, -0.5, 0.5, -0.343, 0.5, -0.152);
  g.bezierCurveTo(0.5, 0.124, 0.235, 0.39, 0, 0.5); g.bezierCurveTo(-0.235, 0.39, -0.5, 0.124, -0.5, -0.152);
  g.bezierCurveTo(-0.5, -0.343, -0.372, -0.5, -0.25, -0.5); g.bezierCurveTo(-0.122, -0.5, -0.02, -0.435, 0, -0.385);
  g.closePath(); g.restore();
  g.fillStyle = COL.heart; g.fill(); g.strokeStyle = COL.edge; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = INK;
  g.save(); g.translate(cx, cy); g.scale(w, h);
  oval(g, COL.hl, -0.307, -0.339, 0.115, 0.061, 2.5); oval(g, COL.hl, -0.405, -0.143, 0.035, 0.028, 2);
  g.restore(); g.fillStyle = INK;
}
// Kiss "3": two equal circular arcs meeting at a left-pointing cusp.
function three(g, cx, cy, r = THREE[0], a0 = THREE[1], a1 = THREE[2], tilt = THREE[3], w = THREE[4]) {
  const A0 = a0 * Math.PI / 180, A1 = a1 * Math.PI / 180, ox = -r * Math.cos(A1), oy = r * Math.sin(A1);
  g.save(); g.translate(cx, cy); g.rotate(tilt); g.lineWidth = w; g.beginPath();
  g.arc(ox, -oy, r, A0, A1); g.arc(ox, oy, r, -A1, -A0); g.stroke(); g.restore();
}
function egg(g, rx, ry, e, n) {   // superellipse, wider at the top for e < 0; symmetric left/right
  g.beginPath();
  for (let i = 0; i < 72; i++) { const a = i / 36 * Math.PI, u = Math.cos(a), v = Math.sin(a); g.lineTo(rx * spow(u, 2 / n) * (1 + e * v), ry * spow(v, 2 / n)); }
  g.closePath();
}
// Open grin: white rim, dark inside, tongue, and a top band with two mirrored fangs. s scales it about its lower centre.
function grin(g, cy, rx, ry, pop, s) {
  const [e, n, t, bt, bk, fx, fw, fy, tcy, trx, tr] = pop ? [-0.21, 2.95, 3.7, 14, 0, 0.82 * rx, 9, 0.96 * ry, 0.78 * ry, 12.8, 4]
    : [-0.4, 2.6, 5, 8.5, 12, 0.75 * rx, 8, 0.93 * ry, 0.77 * ry, 8, 6];
  g.save(); g.translate(MOUTH.x, cy + ry * (1 - s)); g.scale(s, s);
  egg(g, rx, ry, e, n); g.fill();
  const ri = ry - t; egg(g, rx - t, ri, e, n); g.clip(); g.fillStyle = BG; g.fill();
  oval(g, COL.tongue, 0, tcy, trx, tr, 0);
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const x = (i / 12 - 1) * 1.6 * rx; g.lineTo(x, -ri + bt + bk * (x / rx) ** 2); }
  g.lineTo(1.6 * rx, -400); g.lineTo(-1.6 * rx, -400); g.closePath(); g.fill();
  for (const x of [-fx, fx]) { g.beginPath(); g.roundRect(x - fw / 2, -ri - 20, fw, fy + 20, fw / 3); g.fill(); }
  g.restore();
}

function shape(g, [kind, ...p], I) {
  const s = clamp(mix(0.55, 1, I), 0.3, 1.2);   // heart / grin size follows intensity
  if (kind === 'E') { const [dy, lid, sl, ox = 0] = p; lidEye(g, EYE.left + ox, EYE.y + dy, lid, -sl); lidEye(g, EYE.right + ox, EYE.y + dy, lid, sl); }
  else if (kind === 'Es') { const [dy, w, h] = p; eye(g, EYE.left, EYE.y + dy, { w, h }); eye(g, EYE.right, EYE.y + dy, { w, h }); }
  else if (kind === 'S') { g.save(); g.translate(MOUTH.x + p[0], MOUTH.y + p[1]); g.rotate(p[2]); smile(g, 0, 0); g.restore(); }
  else if (kind === 'C') lens(g, p[0], p[1], p[2], p[3], p[4], p[4], p[5]);
  else if (kind === 'C2') { const [x0, y0, x1, y1, a, w] = p; lens(g, x0, y0, x1, y1, a, a, w); lens(g, 360 - x1, y1, 360 - x0, y0, a, a, w); }
  else if (kind === 'L') lens(g, ...p);
  else if (kind === 'O' || kind === 'O2') {
    const [cx, cy, rx, ry, rot] = p; g.globalAlpha = clamp(I);
    oval(g, COL.bl, cx, cy, rx, ry, rot); if (kind === 'O2') oval(g, COL.bl, 360 - cx, cy, rx, ry, -rot);
    g.globalAlpha = 1;
  }
  else if (kind === 'H2') { const [cx, cy, w, h] = p; heart(g, cx, cy, w * s, h * s); heart(g, 360 - cx, cy, w * s, h * s); }
  else if (kind === 'G') grin(g, p[0], p[1], p[2], p[3], s);
  else if (kind === 'T') three(g, ...p);
  else smear(g, ...p);
}

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), I = clamp(o.intensity ?? 1, 0, 1.5), gx = clamp(o.gazeX || 0, -1, 1) * 12;
  let k = Math.floor(t * 24 + 1e-4) - T0;
  k = k >= 0 && k < PERIOD * CYCLES ? k % PERIOD : -1;
  const pose = k >= 0 ? step(POSES, k) : null;
  if (pose && pose[1]) { g.translate(gx, 0); for (const s of pose[1]) shape(g, s, I); }
  else { restFace(g, gx, 0); g.translate(gx, 0); }
  // Bubbles go on top (translucent, they tint whatever they cross).
  const b = k >= 0 ? step(BUBBLES, k) : null;
  if (b && k < FADE[1]) {
    g.globalAlpha = clamp(I) * (1 - clamp((k - FADE[0]) / (FADE[1] - FADE[0])));
    for (const [cx, cy, r] of b.slice(1)) oval(g, COL.bubble, cx, cy, r, r, 0);
    g.globalAlpha = 1;
  }
}
