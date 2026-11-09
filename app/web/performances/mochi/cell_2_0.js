// cell_2_0 · Anger, glowing colours. The face tips forward into an anger pose (> < eyes, hooked brows, a
// popping anger mark, a gritted )-( mouth), squeezes shut, then bursts into glowing eyes whose colour races
// round the hue wheel while the eyes, brows and mouth swell and the glow blooms white-hot; a blink brings the
// resting face back. The whole episode plays twice (the second copy starts 159 frames later). Everything is
// drawn from clean primitives in the kit's coordinates; poses are stepped on the source's 24 fps frames.
import { begin, eye, arc, smile, restFace, clamp, smooth, mix, DURATION } from '../mochi-face.js';
export const title = 'Anger, glowing colours';

const RAD = Math.PI / 180;
const lerpTab = (tab, k) => {
  if (k <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (k <= tab[i][0]) { const [a, A] = tab[i - 1], [b, B] = tab[i]; return mix(A, B, (k - a) / (b - a)); }
  return tab[tab.length - 1][1];
};
const hsv = (h, s, v = 1, a = 1) => {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return `rgba(${f(5)},${f(3)},${f(1)},${a})`;
};

// ---- primitives ----
// A quadratic stroke a -> c (b is the control point) that swells from pointed ends to width w in the middle.
function taper(g, [a, b, c], w) {
  const L = [], R = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, v = 1 - u, h = w / 2 * Math.sin(Math.PI * u) ** .7;
    const x = v * v * a[0] + 2 * u * v * b[0] + u * u * c[0], y = v * v * a[1] + 2 * u * v * b[1] + u * u * c[1];
    const dx = v * (b[0] - a[0]) + u * (c[0] - b[0]), dy = v * (b[1] - a[1]) + u * (c[1] - b[1]), n = Math.hypot(dx, dy) || 1;
    L.push([x - dy / n * h, y + dx / n * h]); R.unshift([x + dy / n * h, y - dx / n * h]);
  }
  g.beginPath(); [...L, ...R].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  g.save(); g.lineWidth = 2; g.stroke(); g.restore();                      // softly rounded tips
}
// A chevron: two round-capped straight arms meeting at the tip, opening along dir (degrees) by +-16 degrees;
// the arm on the `spin` side is the long one, the other is 3/4 as long.
function chevron(g, [x, y], dir, len, width, spin = 1) {
  const arm = (a, l) => [x + l * Math.cos(a * RAD), y + l * Math.sin(a * RAD)];
  g.save(); g.lineWidth = width; g.beginPath(); g.moveTo(...arm(dir + 16 * spin, len)); g.lineTo(x, y); g.lineTo(...arm(dir - 16 * spin, len * .75)); g.stroke(); g.restore();
}
const oval = (g, cx, cy, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot * RAD, 0, Math.PI * 2); g.fill(); };
const halfDisc = (g, cx, top, w, d) => { g.beginPath(); g.ellipse(cx, top, w / 2, d, 0, 0, Math.PI); g.fill(); };   // flat-topped mouth
const mirrored = (g, fn) => { fn(); g.save(); g.translate(360, 0); g.scale(-1, 1); fn(); g.restore(); };   // about x = 180
// The anger mark: four identical crescents round a centre, bowed towards it, turned 20 degrees.
function angerMark(g, cx, cy, s = 1) {
  for (let i = 0; i < 4; i++) {
    const th = (20 + 90 * i) * RAD, at = (a, r) => [cx + s * r * Math.cos(a), cy + s * r * Math.sin(a)];
    const mid = at(th, 17), A = at(th - 28 * RAD, 31), C = at(th + 28 * RAD, 31);
    taper(g, [A, [2 * mid[0] - (A[0] + C[0]) / 2, 2 * mid[1] - (A[1] + C[1]) / 2], C], 7 * s);
  }
}

// ---- the anger pose (deliberately lopsided: the face lunges forward and to the right) ----
const BROW_L = [[143, 136], [192, 157], [194, 130]], BROW_R = [[229, 120], [241, 145], [261, 104]];
// s/dy: the pop-in; mark: the anger mark's size (it shrinks away at the end).
function pose(g, s = 1, dy = 0, mark = 1) {
  g.save(); g.translate(204, 150 + dy); g.scale(s, s); g.translate(-204, -150);
  chevron(g, [184, 174], 168, 98, 12); chevron(g, [260, 155], -28, 74, 10, -1);    // > <, the far eye smaller
  taper(g, BROW_L, 7.5); taper(g, BROW_R, 7.5); angerMark(g, 229, 67, mark);
  // gritted )-( mouth: the far "(" is the ")" mirrored and leant back 30 degrees
  for (const [x, m, rot] of [[218.5, 1, 0], [233.5, -1, -30]]) {
    g.save(); g.translate(x, 188); g.rotate(rot * RAD); taper(g, [[-23.5 * m, -33], [23.5 * m, 0], [-23.5 * m, 33]], 7.5); g.restore();
  }
  g.save(); g.lineWidth = 4; g.beginPath(); g.moveTo(218.5, 188); g.lineTo(233.5, 188); g.stroke(); g.restore();
  g.restore();
}

// ---- the glow: colour cycles round the hue wheel at ~19.6 degrees a frame; eyes, brows and mouth swell
// between frames 112 and 136; the halo widens and the eye centres blanch white over the whole stretch ----
const BLUR = [[83, 2], [85, 5], [95, 10], [120, 12], [140, 20], [160, 28], [181, 34]];
const WHITE = [[111, 0], [131, .3], [141, .55], [151, .75], [161, 1]];
// The face pops in before it settles: [from frame, eye [cx, cy, w, h], brow [cx, y, w, bend, width], mouth]
const LEAD = [[83, [89, 125, 78, 110], [103, 45, 41, -10, 7], ['O', 188.5, 19.5, 24.5]],
  [85, [89, 119, 79, 118], [103, 27, 40, -11, 9], ['O', 176, 14.5, 20]],
  [88, [88, 126.5, 84, 109], [103, 50, 42, -10, 9], ['D', 182, 47, 15]]];
function glowFace(g, k, amp) {
  const hue = 19.608 * k - 1307.8, pale = k < 85, gr = clamp(smooth((k - 112) / 24) * amp, 0, 1.2);
  const wh = pale ? 1 : lerpTab(WHITE, k), S = Math.hypot(g.getTransform().a, g.getTransform().b), blur = lerpTab(BLUR, k) * mix(1, amp, .7);
  const edge = hsv(hue, pale ? .05 : mix(.3, .2, wh)), mid = hsv(hue, pale ? 0 : mix(.3, .2, wh) * (1 - wh)), rich = hsv(hue, pale ? .08 : .42);
  const [, E, B, M] = k < 91 ? LEAD.findLast(r => r[0] <= k) : [0,
    [mix(88.5, 82, gr), mix(125, 129.5, gr), mix(80, 101, gr), mix(112, 137, gr)],
    [mix(103, 100.5, gr), mix(46, 33, gr), mix(42, 58, gr), mix(-9, -13.5, gr), mix(9, 15, gr)],
    ['D', mix(181, 178, gr), mix(43, 69, gr), mix(16, 22.5, gr)]];
  const [ex, ey, ew, eh] = E;
  mirrored(g, () => {                                                          // halo, then the blanching eye
    g.save(); g.shadowColor = hsv(hue, pale ? .1 : .55); g.shadowBlur = blur * S; g.fillStyle = edge; eye(g, ex, ey, { w: ew, h: eh }); g.restore();
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(ew, eh) / 2);
    grd.addColorStop(0, mid); grd.addColorStop(.2 + .3 * wh, mid); grd.addColorStop(1, edge);
    g.save(); g.fillStyle = grd; eye(g, ex, ey, { w: ew, h: eh }); g.restore();
  });
  g.save(); g.fillStyle = g.strokeStyle = rich; g.shadowColor = hsv(hue, .55, 1, .8); g.shadowBlur = blur * .5 * S;
  mirrored(g, () => arc(g, ...B));
  M[0] === 'O' ? oval(g, 180, M[1], M[2], M[3]) : halfDisc(g, 180, M[1], M[2], M[3]);
  g.restore();
}

// ---- one episode, frame j: rest, tip forward, anger, squeeze, glow, glow off, blink, reopen, settle ----
const TIPS = {   // the face tipping forward: eyes [cx, cy, w, h, tilt] and the mouth (a flattened smile, then an O)
  50: [[84, 103.5, 72, 111, 0], [268, 103.5, 68, 103, -6], [183.5, 161, 4, 11]],
  52: [[119, 84.5, 72, 112, -12], [261, 64.5, 62, 95, -13], [197, 123.5, 16, 19.5, -10]],
  54: [[135, 82, 72, 118, -13], [266.5, 61.5, 62, 108, -15], [217.5, 115, 13, 33, -8]],
  56: [[139.5, 98.5, 72, 118, -5], [273, 74.5, 60, 100, -9], [219, 129.5, 11, 27, 5]]};
function episode(g, j, amp, gx) {
  if (j < 50 || j >= 202) return restFace(g, gx, 0);
  g.save(); g.translate(gx, 0);
  if (j < 58) {
    const [L, R, m] = TIPS[j - (j % 2)];
    for (const [cx, cy, w, h, tl] of [L, R]) eye(g, cx, cy, { w, h, tilt: tl * RAD });
    m.length === 4 ? smile(g, m[0], m[1], { dip: m[2], width: m[3] }) : oval(g, ...m);
  } else if (j < 60) {                                       // squash: eyes drop into bowls, the mark pops up
    eye(g, 137, 134, { w: 92, h: 86, tilt: 3 * RAD, lidTop: .5 }); eye(g, 274, 106, { w: 72, h: 84, tilt: -35 * RAD, lidTop: .5 });
    oval(g, 226, 160, 14, 6, -18); angerMark(g, 221, 43.5, .85);
    g.save(); g.translate(7, -31); taper(g, BROW_L, 6.8); g.restore(); g.save(); g.translate(1, -28); taper(g, BROW_R, 6.8); g.restore();
  } else if (j < 79) j < 62 ? pose(g, .97, -7 * amp) : pose(g);    // the pose pops in high, then holds
  else if (j < 81) pose(g, 1, 8, .6);                         // sinking, the mark shrinking away
  else if (j < 83) {                                          // squeezed shut, the mouth rising from below
    taper(g, [[64, 200], [123, 211], [168, 185]], 15); taper(g, [[239, 176], [291, 180], [321, 146]], 15);
    g.beginPath(); g.ellipse(213, 223, 35, 31, 0, Math.PI, 0); g.fill();
  } else if (j < 194) glowFace(g, j, amp);
  else if (j < 196) {                                         // the glow switches off: lid-cut eyes, then pink
    const pink = j === 195, S = Math.hypot(g.getTransform().a, g.getTransform().b);
    g.save(); g.fillStyle = pink ? 'rgb(249,208,211)' : '#ffffff'; if (!pink) { g.shadowColor = 'rgba(200,200,205,.8)'; g.shadowBlur = 16 * S; }
    mirrored(g, () => eye(g, 82, 130.5, { w: 101, h: 139, lidTop: .16 })); g.restore();
    g.save(); g.strokeStyle = 'rgb(249,211,228)'; mirrored(g, () => arc(g, 100.5, 47.5, 58, -14, 15)); g.restore();
    g.save(); g.fillStyle = pink ? 'rgb(244,211,216)' : 'rgb(249,228,235)'; halfDisc(g, 180, 182, 69, 20); g.restore();
  } else if (j < 198) {                                       // blink: closed lids sag into arcs
    mirrored(g, () => taper(g, [[28, 184], [78, 213], [128, 190]], 16)); arc(g, 180, 207, 70, -3.5, 8);
  } else if (j < 200) {                                       // reopening: the lower halves of the eyes
    mirrored(g, () => eye(g, 81, 158, { w: 81, h: 82, lidTop: .5 })); arc(g, 180, 194, 60, -1, 11);
  } else {                                                    // a little stretch before settling
    mirrored(g, () => eye(g, 85, 112.5, { w: 70, h: 110 })); smile(g);
  }
  g.restore();
}

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), k = Math.floor(clamp(t, 0, DURATION) * 24 + 1e-3);
  const gx = clamp(o.gazeX || 0, -1, 1) * 12, amp = clamp(o.intensity ?? 1, 0, 1.5);
  episode(g, k < 209 ? k : k - 159, amp, gx);                // frames 202..208 (and the source's dark glitch at 206) rest
}
