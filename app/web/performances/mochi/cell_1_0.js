// cell_1_0 · Asleep, snot bubble. Mochi blinks, nods off (lids slide shut and sink), then snores with an open
// mouth, tongue and drool while a translucent snot bubble swells and shrinks with each breath, until it pops,
// the face jolts awake, settles, and dozes off again (the clip repeats every 200 frames). Animated on twos with
// hard cuts, so poses are looked up by video frame index rather than eased.
// A clean vector take on the reference: the awake poses are the kit's resting eye and smile squashed,
// stretched or cut by straight lids; everything else is built from a few ideal shapes (a dome, a tapered
// stroke, an ellipse, a circle), mirrored about x = 180 wherever the pose is symmetric.
import { begin, clamp, mix, INK, EYE, MOUTH, eye, smile, restFace } from '../mochi-face.js';
export const title = 'Asleep, snot bubble';

const TONGUE = '#650010', SNOT = 'rgba(137,172,192,0.65)', SPLAT = '#5b7180', DROOL = '#5f7280', GLINT = 'rgba(205,225,236,0.55)';

// ── shapes ──────────────────────────────────────────────────────────────────────────────────────────────────
// Dome: an upper half-ellipse (ryT; negative bows it down into a crescent) on a lower half-superellipse (ryB,
// exponent nB: 2 = ellipse, higher = flatter-bottomed). Covers bowls, crescents, little "o" mouths and the snore mouth.
function domePath(g, cx, cy, rx, ryT, ryB, rot = 0, nB = 2) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (x, y) => g.lineTo(cx + x * c - y * s, cy + x * s + y * c);
  g.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; P(-rx * Math.cos(a), -ryT * Math.sin(a)); }
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI, u = Math.cos(a); P(rx * Math.sign(u) * Math.abs(u) ** (2 / nB), ryB * Math.sin(a) ** (2 / nB)); }
  g.closePath();
}
const dome = (g, ...a) => { domePath(g, ...a); g.fill(); };
const domes = (g, cy, rx, ryT, ryB) => { dome(g, EYE.left, cy, rx, ryT, ryB); dome(g, EYE.right, cy, rx, ryT, ryB); };
// A quadratic stroke A -C- B whose width tapers wA -> wB, with round ends.
function stroke(g, A, C, B, wA, wB) {
  const L = [], R = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t, x = u * u * A[0] + 2 * t * u * C[0] + t * t * B[0], y = u * u * A[1] + 2 * t * u * C[1] + t * t * B[1];
    const dx = u * (C[0] - A[0]) + t * (B[0] - C[0]), dy = u * (C[1] - A[1]) + t * (B[1] - C[1]), l = Math.hypot(dx, dy) || 1, h = mix(wA, wB, t) / 2;
    L.push([x - dy / l * h, y + dx / l * h]); R.unshift([x + dy / l * h, y - dx / l * h]);
  }
  g.beginPath(); L.concat(R).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  for (const [[x, y], w] of [[A, wA], [B, wB]]) { g.beginPath(); g.arc(x, y, w / 2, 0, 7); g.fill(); }
}
// Closed eyes: one tapered stroke from the outer corner (x 42, thin) to the inner corner (x 129, thick), mirrored.
// Posed by three heights: outer end, control point, inner end.
function closedEyes(g, [ay, cy, by], wA = 6.5, wB = 10) {
  stroke(g, [42, ay], [79, cy], [129, by], wA, wB); stroke(g, [318, ay], [281, cy], [231, by], wA, wB);
}
// Wide-open eyes: the resting eye, stretched or squashed.
const eyes = (g, o = {}, cy = EYE.y) => { eye(g, EYE.left, cy, o); eye(g, EYE.right, cy, o); };

// The snoring mouth: a flat-bottomed dome with an even white rim, a straight row of upper teeth and a round tongue.
const RIM = 3.6;
function snoreMouth(g, [cx, cy, rx, T, B, rot], drool) {
  const s = rx / 42;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  if (drool > 0) { g.strokeStyle = DROOL; g.lineWidth = 5.5; g.beginPath(); g.moveTo(-.67 * rx, B - 5); g.lineTo(-.67 * rx, B - 5 + drool); g.stroke(); }
  g.fillStyle = INK; dome(g, 0, 0, rx, T, B, 0, 3.6);
  g.fillStyle = '#000'; domePath(g, 0, 0, rx - RIM, T - RIM, B - RIM, 0, 3.6); g.fill(); g.clip();
  g.fillStyle = TONGUE; g.beginPath(); g.ellipse(-.24 * rx, 6.5 * s, 34 * s, 21 * s, 0, 0, 7); g.fill();
  g.fillStyle = INK; g.beginPath(); g.moveTo(-rx, -T); g.lineTo(rx, -T); g.lineTo(rx, -.65 * T); g.lineTo(-rx, -.4 * T); g.fill();
  g.restore();
}
// The snot bubble: a circle hanging from the nostril by a short tail (lower left), with a glint. It grows away
// from the nostril, so its centre follows its radius.
function bubble(g, r, dx = 0, dy = 0) {
  if (r <= .5) return;
  const cx = 192 + 1.22 * r + dx, cy = 89.7 - .156 * r + dy, a = 3 * Math.PI / 4;
  g.save(); g.fillStyle = SNOT; g.beginPath();
  g.arc(cx, cy, r, a + .44, a - .44 + 2 * Math.PI); g.lineTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4); g.closePath(); g.fill();
  if (r > 6) { g.strokeStyle = GLINT; g.lineWidth = r * .14; g.beginPath(); g.arc(cx, cy, r * .68, 3.6, 4.3); g.stroke(); }
  g.restore();
}
const dots = (g, list) => { g.fillStyle = SPLAT; for (const [x, y, r] of list) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
function splat(g, cx, cy) { // the popped bubble: a regular eight-point star with soft corners, plus flecks
  g.save(); g.fillStyle = g.strokeStyle = SPLAT; g.lineWidth = 5; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 22 : 31; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke(); g.restore();
  dots(g, [[cx + 32, cy - 30, 3], [cx + 40, cy + 12, 2.5], [cx - 10, cy - 42, 2.5], [cx - 36, cy + 22, 2]]);
}
const DROPS = [[221, 20, 1.6], [235, 17, 1.6], [227, 34, 1.5], [244, 26, 1.4], [212, 41, 1.3], [258, 38, 1.4], [204, 60, 1.2], [246, 92, 1.3], [215, 104, 1.2], [238, 116, 1.2]];

// ── asleep ──────────────────────────────────────────────────────────────────────────────────────────────────
// A sleeping face = closed-eye heights [outer, control, inner], snore mouth [cx, cy, rx, ryT, ryB, rot], drool.
// Sinking into sleep (and the jolt after the pop), with the bubble's offset while it first emerges:
const INTRO = [
  [28, [143.5, 144, 141.5], [182, 161, 25.5, 17, 18, -.24], 3, 0],
  [32, [120.5, 115.5, 115.5], [181, 151, 32.5, 26.5, 16.5, -.18], 7, 28],
  [36, [111, 103.5, 104], [180, 144, 39.5, 29, 14, -.06], 12, 19],
  [40, [106, 96, 98.5], [181, 144, 42, 33, 10.5, -.04], 14, 10],
];
const JOLT = { 160: [[133.5, 136.5, 133], [180, 154.5, 45, 20, 14, -.05]], 161: [[140.5, 151, 140], [180, 161.5, 46, 20, 13.5, -.05]] };
// Snoring breath, on twos from frame 44: level 0 (face up, mouth tall) .. 6 (face sunk, mouth squashed).
const BREATH = '2211000000112233445566666665544332211000000112233445566666';
const UP = [[104, 93.5, 94.5], [180, 143, 42, 36.75, 12, 0]], DOWN = [[108.5, 100, 102.5], [180, 146, 42, 31, 8.5, 0]];
// Bubble radius on fours from frame 32 (one six-frame hold at 88 shifts the later ones by a frame pair): two slow
// breaths, then one big swell before it pops at 158.
const BUBBLE = [2.4, 4, 10, 13.5, 14.5, 15.5, 15.5, 16, 17, 18.5, 21, 23.5, 24.5, 25, 25, 25.5, 25, 24.5, 23.5, 21.5, 18.5, 17, 16, 15.5, 16.5, 18.5, 21, 26, 31, 34, 36, 37];

function sleepFace(g, f, k) {
  if (f < 44) { const [, L, Mo, drool] = INTRO.filter(r => r[0] <= f).pop(); closedEyes(g, L); return snoreMouth(g, Mo, drool); }
  const b = (+BREATH[(f - 44) >> 1] || 0) / 6 * k, lerp = (A, B) => A.map((v, i) => mix(v, B[i], b));
  closedEyes(g, lerp(UP[0], DOWN[0])); snoreMouth(g, lerp(UP[1], DOWN[1]), 17);
}

// ── awake ───────────────────────────────────────────────────────────────────────────────────────────────────
// Poses by first-cycle frame; REST is the kit's resting face, SLEEP hands over to the snoring face above.
// The awake poses are drawn in the kit's frame. The dozing and sleeping ones keep the coordinates measured off
// the video, whose face sits LIFT px lower than the kit's, so they are lifted by it: the whole clip shares one anchor.
const REST = 'rest', SLEEP = 'sleep', LIFT = 6;
const lift = fn => g => { g.translate(0, -LIFT); fn(g); };
const POSES = [
  [0, REST],
  [2, g => { eyes(g, { lidTop: .08 }); smile(g, 180, MOUTH.y + 2); }],                       // blink starts: lids drop
  [5, g => { eyes(g, { lidTop: .43 }, EYE.y + 6); smile(g, 180, MOUTH.y + 5.5); }],
  [8, lift(g => { domes(g, 165, 43, 0, 22); dome(g, 180, 179, 38, 2.5, 12); })],  // shut: half-eye bowls...
  [12, lift(g => { domes(g, 176, 41, -1, 15); dome(g, 180, 186, 37, 7, 5.5); })],  // ...thinning to crescents
  [16, lift(g => { domes(g, 180.5, 41, -2.5, 12); dome(g, 180, 188.5, 36, 9, 4); })],
  [20, lift(g => { domes(g, 176, 42, -1, 10); dome(g, 180, 185, 29, 10, 5.5); })],
  [24, lift(g => { domes(g, 164, 48, 1.5, 8); dome(g, 180, 176.5, 25, 12.5, 8.5); })],
  [28, SLEEP],
  [160, lift(g => { closedEyes(g, JOLT[160][0], 11, 11); snoreMouth(g, JOLT[160][1], 12); })],  // pop! eyes squeeze
  [161, lift(g => { closedEyes(g, JOLT[161][0], 12, 12); snoreMouth(g, JOLT[161][1], 12); })],
  [162, g => { eyes(g, { w: 82, h: 37 }, 133); dome(g, 180, 179, 20, 24, 8); }],              // startled squash
  [164, g => { eyes(g, { w: 69, h: 137 }); dome(g, 180, 179, 22, 19, 3); }],                  // ...stretch, settling
  [166, g => { eyes(g, { h: 124 }); dome(g, 180, 175, 22, 15.5, 4.5); }],
  [168, g => { eyes(g, { h: 119 }); dome(g, 180, 174.5, 22.5, 15.5, 4); }],
  [194, g => { eyes(g, { h: 114 }); dome(g, 180, 170.5, 29, 8.5, 4.5); }],
  [197, g => { eyes(g, { h: 108 }); smile(g, 180, MOUTH.y + 2, { dip: 8 }); }],
  [199, REST],
];

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), k = clamp(o.intensity ?? 1, 0, 1.5), gx = clamp(o.gazeX || 0, -1, 1) * 12;
  const F = Math.min(400, Math.floor(clamp(t, 0, 16.708333) * 24 + 1e-3)); // the video frame on screen at t
  let f = F < 200 ? F : F - 200;
  if (F >= 200 && f < 4) f++; else if (F >= 200 && f === 4) f = 5; // the second blink starts a frame early
  if (F >= 200 && f >= 157) f += 1; // ...and its bubble pops a frame earlier
  const pose = POSES.filter(r => r[0] <= f).pop()[1];
  if (pose === REST) return restFace(g, gx, 0);
  g.translate(gx, 0);
  if (pose !== SLEEP) return pose(g);
  g.translate(0, -LIFT);
  if (f >= 158) { sleepFace(g, 158, k); return f === 158 ? splat(g, 238, 76) : dots(g, DROPS); }
  const fs = f - f % 2; // on twos
  sleepFace(g, fs, k);
  const i = (fs - 32) >> 1;
  if (i >= 0) bubble(g, BUBBLE[(i + (i > 28)) >> 1] * k, fs < 44 ? 5 : 0, fs < 44 ? INTRO.filter(r => r[0] <= fs).pop()[4] : 0);
}
