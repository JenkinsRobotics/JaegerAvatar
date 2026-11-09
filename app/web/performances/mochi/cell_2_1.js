// cell_2_1 · Speedometer. The eyes tip over into two bars, break into gauge segments and become a
// tachometer dial; the smile curls up into a red needle that wobbles, sweeps to the red line, spins and
// settles, then curls back into a smile while the dial dissolves and the face returns. Everything is drawn
// in the kit's coordinates from clean primitives; poses are stepped on the source's 24 fps frames.
import { begin, eye, smile, restFace, clamp, mix, EYE, DURATION } from '../mochi-face.js';
export const title = 'Speedometer';

// The gauge: centred on the face, values 1..8 every 36 degrees, symmetric about the vertical (2 and 7 level).
const CX = 180, CY = 141, RAD = Math.PI / 180, ang = v => 180 - (v - 2) * 36;
const RED = '#e04c2e', ZONE = '#ec5c3c', WHITE = '#ffffff';
const pol = (deg, r) => [CX + r * Math.cos(deg * RAD), CY - r * Math.sin(deg * RAD)];
const step = (tab, k) => { let e = tab[0]; for (const r of tab) if (r[0] <= k) e = r; return e; };
const lerpTab = (tab, k) => {                    // linear interpolation through [k, value] rows
  if (k <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (k <= tab[i][0]) { const [a, A] = tab[i - 1], [b, B] = tab[i]; return mix(A, B, (k - a) / (b - a)); }
  return tab[tab.length - 1][1];
};
const line = (g, [x0, y0], [x1, y1]) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };

// ---- eyes: per-side morph stages (left eye; the right one is its mirror about x = 180) ----
// 0 rest, 1 spread, 2 tipped, 3 fallen, 4..8 bars sliding off the bottom, 9 gauge segments, 10 dial (eye
// gone), 11 nothing; 'a' a slight squeeze as the face settles. The left eye leads the right by a frame.
const STAGES = [[0, 0, 0], [8, 1, 1], [10, 2, 1], [11, 2, 2], [12, 3, 2], [14, 4, 3], [16, 5, 4], [18, 6, 5],
  [20, 7, 6], [22, 7, 7], [23, 8, 7], [24, 8, 8], [25, 9, 8], [26, 9, 9], [27, 10, 9], [28, 10, 10],
  [230, 10, 9], [231, 9, 9], [232, 9, 8], [233, 11, 11], [234, 8, 7], [235, 7, 7], [236, 7, 6], [237, 6, 5],
  [238, 5, 4], [239, 4, 3], [240, 3, 2], [241, 2, 1], [242, 1, 1], [243, 0, 0], [245, 'a', 'a'], [249, 0, 0]];
const EYES = { 0: [EYE.left, EYE.y, EYE.w, EYE.h, 0], 1: [81, 117, 72, 104, 0], 2: [73, 130, 72, 104, -7],
  3: [68, 166, 72, 104, -38], a: [88.5, 114.5, 69, 106, 0] };   // [cx, cy, w, h, tilt]
// bars: a round-capped bar slanting down-left at 37 degrees: top cap centre, top and bottom widths, length
const BARS = { 4: [107, 173, 42, 42, 68], 5: [119, 171, 24, 20, 120], 6: [124, 172, 21, 17, 120],
  7: [125, 173, 20, 15, 120], 8: [116, 176, 22, 23, 120] };
const WEDGES = [[166.5, 180.5], [184.5, 196], [200, 209], [213, 219.5]];   // ring segments, r 85..126, 4 degree gaps

function bar(g, x, y, w0, w1, L) {
  const dx = -Math.cos(37 * RAD), dy = Math.sin(37 * RAD), ex = x + dx * L, ey = y + dy * L;
  g.beginPath(); g.moveTo(x - dy * w0 / 2, y + dx * w0 / 2); g.lineTo(ex - dy * w1 / 2, ey + dx * w1 / 2);
  g.lineTo(ex + dy * w1 / 2, ey - dx * w1 / 2); g.lineTo(x + dy * w0 / 2, y - dx * w0 / 2); g.fill();
  for (const [px, py, w] of [[x, y, w0], [ex, ey, w1]]) { g.beginPath(); g.arc(px, py, w / 2, 0, Math.PI * 2); g.fill(); }
}
function sector(g, a0, a1, r0, r1) {
  g.beginPath(); g.arc(CX, CY, r1, -a0 * RAD, -a1 * RAD, true); g.arc(CX, CY, r0, -a1 * RAD, -a0 * RAD, false); g.fill();
}
function eyeStage(g, s, side) {
  g.save(); if (side) { g.translate(360, 0); g.scale(-1, 1); }
  if (EYES[s]) { const [x, y, w, h, tl] = EYES[s]; eye(g, x, y, { w, h, tilt: tl * RAD }); }
  else if (BARS[s]) bar(g, ...BARS[s]);
  else if (s === 9) WEDGES.forEach(([a, b]) => sector(g, a, b, 85, 126));
  g.restore();
}

// ---- the dial: bold major ticks; minor ticks, numbers and the red zone fade in/out as one dim layer ----
function dial(g, k, left, right) {
  const major = k < 231 ? 1 : k < 233 ? .15 : 0;
  // the major ticks fan in from slightly spread angles (left half pivots on "1", right half on "8")
  const sl = k < 29 || k === 229 || k === 230 ? 1.038 : k < 31 || k > 226 ? 1.022 : 1;
  const sr = k < 30 || k > 227 ? 1.038 : k < 32 || k > 226 ? 1.022 : 1;
  const dim = k < 33 ? 0 : k < 63 ? (k - 33) / 30 : k < 198 ? 1 : k < 229 ? 1 - .79 * (k - 198) / 30 : k < 233 ? .15 : 0;
  g.save(); g.lineCap = 'butt'; g.strokeStyle = g.fillStyle = WHITE;
  if (dim > 0) {
    g.globalAlpha = dim; g.fillStyle = ZONE; sector(g, ang(8), ang(6.5), 106, 117);   // the red line: 6.5 to 8
    g.fillStyle = WHITE; g.lineWidth = 2.6;
    for (let v = 1.5; v < 8; v++) line(g, pol(ang(v), 102), pol(ang(v), 117));
    g.font = 'bold 15px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 1; v <= 8; v++) { const [x, y] = pol(ang(v), 83); g.fillText(String(v), x, y + 1); }
  }
  g.lineWidth = 6.2; g.globalAlpha = major;
  for (let v = 1; v <= 8; v++) {
    if (!(v <= 4 ? left : right)) continue;
    const a = v <= 4 ? 216 + (ang(v) - 216) * sl : -36 + (ang(v) + 36) * sr;
    line(g, pol(a, 94.5), pol(a, 117));
  }
  g.restore();
}

// ---- needle: dial angle (degrees, screen-up) per frame. It rests exactly on "1"; settle wobbles are
// offsets from rest, the sweep to the red line is absolute, then a spin and a settle ----
const REST = ang(1), W = d => REST + d;
const NEEDLE = [[72, REST], [73, W(-2.8)], [74, W(-2.8)], [75, W(-8.7)], [76, W(-6.6)], [77, W(-6.6)], [78, REST], [79, REST],
  [80, W(-.9)], [81, W(-.9)], [82, REST], [95, REST], [97, 213.6], [99, 210.7], [101, 206], [103, 199.6], [105, 191.5],
  [107, 182.1], [108, 176.8], [110, 165.4], [112, 153.3], [114, 140.7], [116, 128], [118, 115.3], [120, 102.5],
  [122, 90.4], [124, 79.2], [126, 68.6], [128, 58.6], [130, 48.8], [132, 39], [134, 31.1], [136, 22.6], [138, 15.9],
  [140, 9.5], [142, 4.5], [144, -2.3], [146, -6.3], [148, -11.5], [150, -15.2], [152, -17.3], [154, -21.2],
  [156, -23.9], [158, -25.7], [160, -27.2], [162, -29.6], [164, -30.5], [166, -31], [168, -33.5], [170, -32],
  [172, -32.5], [173, -8], [174, 35], [175, 95], [176, 165], [177, W(.1)], [178, W(-1.2)], [179, W(-2.5)],
  [180, W(-3.4)], [181, W(-3.7)], [182, W(-3.2)], [183, W(-2.2)], [184, W(-.9)], [185, REST], [199, REST]];
function needle(g, deg, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = RED; g.lineWidth = 5.6; line(g, pol(deg, -27), pol(deg, 117)); g.restore();
}

// ---- smile <-> needle morph strokes: [k, colour, width, ...shapes]. A shape is three points (a smooth arc
// through the middle one), ['o', cx, cy, rx, ry, rotation, from, to] (an elliptical or circular arc, degrees
// clockwise from +x) or 'fan'
// (the needle smeared about its tail as it drops onto "1") ----
const STROKES = [[0, null],
  [51, WHITE, 15, ['o', 170, 150, 23.5, 23.5, 0, -28, 138]],
  [53, WHITE, 15, ['o', 157, 153, 21, 21, 0, -102, 108]],
  [55, WHITE, 14, ['o', 158, 156, 17, 17, 0, -151, 136]],
  [61, WHITE, 15, [[135, 115], [152, 139], [155, 173]]],
  [62, '#f6dcd6', 11, [[137, 67], [130, 115], [149, 159]]],
  [63, '#eda48f', 13, [[116, 134], [121, 87], [161, 64]]],
  [65, '#e2563a', 10, [[100, 110], [126, 77], [186, 71]]],
  [67, RED, 7, [[88, 76], [140, 87], [199, 91]]],
  [69, RED, 8, [[112, 55], [150, 98], [201, 115]]],
  [70, RED, 6, ...[0, 1, 2].map(i => [[75 + 3.5 * i, 120 - 3.5 * i], [140, 150 - 4.5 * i], [200, 125]])],
  [72, RED, 4, 'fan'],
  [73, null],
  [199, RED, 7, [[97, 194], [135, 157], [192, 132]]],
  [201, RED, 7, ['o', 158.5, 252.5, 53, 139, -3.5, 207, 305]],
  [203, RED, 7, ['o', 144.5, 151, 47.5, 20.5, 90, 60, 268]],
  [206, RED, 7, ['o', 145, 132.5, 16, 38, -8, 122, 392]],
  [221, '#e0644a', 6, ...[[118, 68, 206, 320], [105, 43, 170, 356], [111, 32, 130, 368]].map(([y, r, a, b]) => ['o', 140, y, r, r, 0, a, b])],
  [222, '#ef8a76', 6, [[86, 50], [160, 30], [227, 44]]],
  [223, '#f4c6bd', 5, [[84, 38], [165, 37], [246, 38]]],
  [225, '#fbe2de', 7, [[92, 41.5], [170, 55], [246, 41.5]]],
  [227, WHITE, 8, [[119.5, 46.5], [180, 76], [240.5, 46.5]]],
  [229, null]];
function shape(g, P) {
  g.beginPath();
  if (P === 'fan') {
    const [tx, ty] = pol(REST, -27);
    for (let i = 0; i < 3; i++) { const a = (REST - 10 * i) * RAD; g.moveTo(tx, ty); g.lineTo(tx + 144 * Math.cos(a), ty - 144 * Math.sin(a)); }
  } else if (P[0] === 'o') { const [, x, y, rx, ry, rot, a, b] = P; g.ellipse(x, y, rx, ry, rot * RAD, a * RAD, b * RAD); }
  else { const [[a, b], [c, d], [e, f]] = P; g.moveTo(a, b); g.quadraticCurveTo(2 * c - (a + e) / 2, 2 * d - (b + f) / 2, e, f); }
  g.stroke();
}

// ---- mouth: the resting smile, turned as it curls away, or a reshaped smile: [k, cx, cy, rotation°, w, dip,
// width] ('rest' = the kit's smile, null = hidden) ----
const MOUTHS = [[0, 'rest'], [36, 180, 161.5, 3], [38, 181, 161.5, 7], [40, 182, 161, 12], [42, 183, 161, 14],
  [45, 183, 161, 15], [48, 183, 161, 16], [49, 182, 157, 5, 54, 16, 16], [51, null],
  [229, 180, 89, 0, 82, 24, 18], [230, 180, 159, 0, 46, 12, 18], [231, 180, 164, 0, 55, 8, 12], [233, null],
  [234, 'rest']];

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), k = Math.floor(clamp(t, 0, DURATION) * 24 + 1e-3), gx = clamp(o.gazeX || 0, -1, 1) * 12;
  const amp = clamp(o.intensity ?? 1, 0, 1.5);
  const [, L, R] = step(STAGES, k), m = step(MOUTHS, k), s = step(STROKES, k);
  if (L === 0 && R === 0 && m[1] === 'rest' && !s[1] && (k < 73 || k >= 199)) return restFace(g, gx, 0);
  g.translate(gx, 0);
  if (L === 10 || R === 10) dial(g, k, L === 10, R === 10);
  eyeStage(g, L, 0); eyeStage(g, R, 1);
  if (m[1] === 'rest') smile(g);
  else if (m[1] !== null) {
    const [, x, y, rot, w, dip, width] = m;
    g.save(); g.translate(x, y); g.rotate(rot * amp * RAD); smile(g, 0, 0, w ? { w, dip, width } : {}); g.restore();
  }
  if (s[1]) { g.save(); g.strokeStyle = s[1]; g.lineWidth = s[2]; s.slice(3).forEach(P => shape(g, P)); g.restore(); }
  if (k >= 73 && k < 199) {
    const deg = mix(REST, lerpTab(NEEDLE, k), amp);          // intensity scales the needle's travel
    if (k >= 173 && k <= 176) for (let i = 3; i >= 0; i--) needle(g, deg - i * 8, i ? .3 : 1);   // spin blur
    else needle(g, deg);
  }
}
