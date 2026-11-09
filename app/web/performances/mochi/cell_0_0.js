// cell_0_0 · Squint & wink. Mochi glances aside, narrows its eyes into a sly squint, screws them shut into a
// laugh while its head turns and dips to the left, winks the right eye open, scrunches into > < and pops back.
// A clean vector version of the hand-drawn reference: every drawing is built from a handful of ideal shapes,
// all derived from the resting face, and held on exactly the frames the source holds it (24 fps, on twos).
import { begin, clamp, mix, restFace, smile, EYE, MOUTH, INK } from '../mochi-face.js';
export const title = 'Squint & wink';

// ── Shapes ───────────────────────────────────────────────────────────────────────────────────────────────
// E: the resting eye (the kit's 3.2 superellipse) at any size, its top lid sheared by `slant` px (left edge up,
//    right edge down when positive) and the whole eye turned by `tilt`. Squints and glances are this one shape.
function eye(g, x, y, w, h, slant = 0, tilt = 0) {
  g.save(); g.translate(x, y); g.rotate(tilt); g.beginPath();
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const u = Math.sign(c) * Math.abs(c) ** (2 / 3.2), v = Math.sign(s) * Math.abs(s) ** (2 / 3.2);
    g.lineTo(u * w / 2, v * h / 2 + (1 - v) / 2 * u * slant / 2);
  }
  g.closePath(); g.fill(); g.restore();
}
// L: a quadratic curve stroked with round caps and a smoothly tapering width [start, middle, end]. Closed
//    happy eyes, brows, tick marks and the > < chevrons are all this one stroke with a named width profile.
const PROFILE = {
  BROW: [3, 6, 2], BROW_UP: [4, 8, 2],        // brows (thin tips, a little weight at the bend); raised wink brow
  LENS_L: [13, 12, 4], LENS_R: [13, 15.5, 5], // closed happy eyes, blunt outer end tapering to the nose
  ARM_L: [8, 12, 11], ARM_R: [10.5, 16, 14],  // the > < arms (the right one is nearer, so heavier)
  W: [9, 9, 9],                               // the cat-mouth "w"
};
function line(g, x0, y0, cx, cy, x1, y1, prof) {
  const [w0, wm, w1] = typeof prof === 'string' ? PROFILE[prof] : prof, wc = 2 * wm - (w0 + w1) / 2, side = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, s = 1 - t;
    let dx = s * (cx - x0) + t * (x1 - cx), dy = s * (cy - y0) + t * (y1 - cy); const d = Math.hypot(dx, dy) || 1;
    side.push([s * s * x0 + 2 * t * s * cx + t * t * x1, s * s * y0 + 2 * t * s * cy + t * t * y1,
      dx / d, dy / d, Math.max(.01, (s * s * w0 + 2 * t * s * wc + t * t * w1) / 2)]);
  }
  g.beginPath();
  for (const [x, y, dx, dy, r] of side) g.lineTo(x - dy * r, y + dx * r);
  let [x, y, dx, dy, r] = side[24]; g.arc(x, y, r, Math.atan2(dy, dx) + Math.PI / 2, Math.atan2(dy, dx) - Math.PI / 2, true);
  for (let i = 24; i >= 0; i--) { [x, y, dx, dy, r] = side[i]; g.lineTo(x + dy * r, y - dx * r); }
  g.arc(x, y, r, Math.atan2(dy, dx) - Math.PI / 2, Math.atan2(dy, dx) - Math.PI * 1.5, true);
  g.closePath(); g.fill();
}
// A: the resting smile itself, moved and turned (it never changes shape while the eyes act).
function turnedSmile(g, x, y, turn) { g.save(); g.translate(x, y); g.rotate(turn); smile(g, 0, 0); g.restore(); }
// M: the open laughing mouth: a half-ellipse bowl under a top lip of two arcs meeting in a small peak
//    (p = peak height, q = how far each half of the lip sags). W: the cat mouth, two equal U strokes.
function openMouth(g, x, y, w, d, p, q) {
  g.beginPath(); g.moveTo(x - w / 2, y);
  g.quadraticCurveTo(x - w / 4, y + 2 * q, x, y - p); g.quadraticCurveTo(x + w / 4, y + 2 * q, x + w / 2, y);
  g.ellipse(x, y, w / 2, Math.abs(d), 0, 0, Math.PI); g.closePath(); g.fill();
  g.save(); g.lineWidth = 4; g.stroke(); g.restore(); // rounds the lip corners
}
function catMouth(g, x, y, w, b) {
  line(g, x - w / 2, y, x - w / 4, y + 2 * b, x, y, 'W'); line(g, x, y, x + w / 4, y + 2 * b, x + w / 2, y, 'W');
}
const SHAPES = { E: eye, L: line, A: turnedSmile, M: openMouth, W: catMouth };

// ── Poses ────────────────────────────────────────────────────────────────────────────────────────────────
// Pose 0 is the kit's resting face. The rest are the drawings, in order: 1-4 glance (eyes shrink and shift as
// the head turns), 5-8 squint (lids slant in), 9-11 brows drop and the mouth opens, 12-28 eyes close into
// a laugh while the head turns away and dips left (the mouth opens wider on every other drawing: ha, ha),
// 29-33 the right eye winks open under a raised brow, 34-36 > < scrunch, 37 the face springs back.
// The head turn makes these poses deliberately asymmetric: the far (left) features are smaller.
const POSES = [null,
  /* 1 */ [['E', 83, 117, 71, 104, 0, -.04], ['E', 274, 120, 72, 101, -4, .07], ['A', 177, 164, 0]],
  /* 2 */ [['E', 79, 120, 69, 104, 10, -.04], ['E', 270.5, 134, 69, 87, -16, .13], ['A', 173, 167, 0]],
  /* 3 */ [['E', 77.5, 115.5, 68, 108.5, 12, 0], ['E', 268, 132, 70, 90, -12, .08], ['A', 170.5, 167, 0]],
  /* 4 */ [['E', 77, 111, 68, 114, 8, 0], ['E', 266, 131, 71, 92, -10.5, .07], ['A', 168.5, 165, 0]],
  /* 5 */ [['E', 78, 129.5, 66, 93, 18.5, -.07], ['E', 270, 138, 69, 85, -23, .11], ['A', 174, 172.5, .04]],
  /* 6 */ [['E', 84.5, 148, 63, 70, 22, -.14], ['E', 274, 142, 69, 78, -31, .14], ['A', 181, 174, .07]],
  /* 7 */ [['E', 92.5, 144, 67.5, 74, 21, -.11], ['E', 284, 126, 65, 88, -36.5, .11], ['A', 194, 171, .07]],
  /* 8 */ [['E', 97, 142, 70.5, 77, 23, -.08], ['E', 286, 119, 67, 92, -34.5, .05], ['A', 197, 167.5, .05]],
  /* 9 */ [['E', 95.5, 145, 68.5, 71, 26, -.12], ['E', 285, 126, 65, 81, -43, .12], ['A', 195, 169, .06], ['L', 116, 99, 134.5, 106, 140.5, 98.5, 'BROW'], ['L', 243, 91, 256.5, 87, 265, 82, 'BROW']],
  /* 10 */ [['E', 94, 152.5, 72.5, 52, 24, 0], ['E', 282, 142, 70, 54, -42, .03], ['L', 109, 108.5, 139.5, 123, 150, 108.5, 'BROW'], ['L', 233.5, 107, 261.5, 104, 278.5, 88, 'BROW'], ['M', 191, 172, 61, 17.5, 1, 0]],
  /* 11 */ [['E', 94.5, 158, 71, 42, 27.5, -.04], ['E', 277, 150, 70.5, 44, -53, .12], ['L', 102, 119, 138, 140, 153, 119, 'BROW'], ['L', 228, 117, 263, 119, 281, 100, 'BROW'], ['M', 187, 174, 59.5, 17, 3, .5]],
  /* 12 */ [['L', 62, 144, 91, 176.5, 124.5, 164, [14, 30, 13]], ['L', 307, 129.5, 287, 166, 243, 164, [14.5, 31, 12.5]], ['L', 97.5, 128, 139, 153, 151.5, 133.5, 'BROW'], ['L', 221, 132, 252, 134.5, 284, 112, 'BROW'], ['M', 184, 176, 59, 17.5, 4.5, 2]],
  /* 13 */ [['L', 60, 146, 88, 170, 122, 162, [14, 22.5, 12]], ['L', 301, 141.5, 282, 163, 235.5, 164.5, [18, 22, 11]], ['L', 95.5, 128.5, 137, 152, 149, 131, 'BROW'], ['L', 211, 134, 245, 140, 281, 112, 'BROW'], ['M', 176.5, 174, 58, 22.5, 8, 1]],
  /* 14 */ [['L', 58.5, 154, 101, 178, 126.5, 167, 'LENS_L'], ['L', 300, 151, 262, 175.5, 223, 170, 'LENS_R'], ['L', 91, 134.5, 133, 161.5, 147, 140, 'BROW'], ['L', 278, 121.5, 221, 160.5, 205, 135.5, 'BROW'], ['M', 171, 179, 58, 20.5, 7.5, 3]],
  /* 15 */ [['L', 56, 148, 96, 170.5, 120.5, 159.5, 'LENS_L'], ['L', 294.5, 147, 256.5, 171.5, 215.5, 164.5, 'LENS_R'], ['L', 87.5, 130, 129, 157.5, 142.5, 135, 'BROW'], ['L', 269.5, 120, 213, 156, 196.5, 133, 'BROW'], ['M', 165, 174.5, 58, 26.5, 10.5, .5]],
  /* 16 */ [['L', 53.5, 155.5, 92.5, 176.5, 115.5, 165.5, 'LENS_L'], ['L', 288.5, 156.5, 249.5, 180.5, 207.5, 172, 'LENS_R'], ['L', 84.5, 138, 125, 166, 138, 142.5, 'BROW'], ['L', 260.5, 131.5, 204, 165, 187.5, 142.5, 'BROW'], ['M', 159, 182, 58, 26, 7.5, 4]],
  /* 17 */ [['L', 52, 149, 90, 169.5, 111.5, 158.5, 'LENS_L'], ['L', 282, 152.5, 242.5, 176, 200.5, 166.5, 'LENS_R'], ['L', 83, 132.5, 122.5, 160.5, 134, 137, 'BROW'], ['L', 251.5, 129.5, 195.5, 160, 179.5, 138.5, 'BROW'], ['M', 154, 176, 58, 31, 11, 2]],
  /* 18 */ [['L', 50, 153.5, 87, 174, 107, 163, 'LENS_L'], ['L', 274, 160, 234.5, 182, 192.5, 172, 'LENS_R'], ['L', 80, 137.5, 119, 165.5, 129, 142.5, 'BROW'], ['L', 241.5, 138, 186, 166.5, 170.5, 145, 'BROW'], ['M', 148, 180.5, 58, 31, 6, 5.5]],
  /* 19 */ [['L', 47.5, 147.5, 84.5, 168, 103, 157.5, 'LENS_L'], ['L', 266, 157, 226, 178, 184.5, 167, 'LENS_R'], ['L', 78, 132.5, 115.5, 160.5, 124, 137.5, 'BROW'], ['L', 231, 136, 176.5, 162.5, 162, 140.5, 'BROW'], ['M', 142, 174.5, 58, 35, 5, 5.5]],
  /* 20 */ [['L', 45.5, 150.5, 82, 171, 99.5, 160.5, 'LENS_L'], ['L', 257.5, 162.5, 217.5, 182, 177, 171, 'LENS_R'], ['L', 75.5, 136, 112.5, 163.5, 118.5, 141, 'BROW'], ['L', 221, 142.5, 167.5, 166.5, 153.5, 144.5, 'BROW'], ['M', 136.5, 176.5, 58, 31, 1.5, 8]],
  /* 21 */ [['L', 42.5, 143, 78.5, 164, 95, 154, 'LENS_L'], ['L', 248.5, 158, 209, 176, 168.5, 164.5, 'LENS_R'], ['L', 73, 129, 108.5, 156, 113, 134.5, 'BROW'], ['L', 210, 138, 158, 160.5, 144.5, 138.5, 'BROW'], ['M', 130, 169, 58, 27, 2, 7]],
  /* 22 */ [['L', 39, 146, 74.5, 167.5, 90.5, 158, 'LENS_L'], ['L', 239, 163.5, 200, 180.5, 160, 168.5, 'LENS_R'], ['L', 69.5, 132.5, 104, 159, 107, 138, 'BROW'], ['L', 199, 143.5, 148, 164.5, 135.5, 142.5, 'BROW'], ['M', 123.5, 172, 58, 28, -1, 7]],
  /* 23 */ [['L', 35.5, 137.5, 70.5, 158.5, 86, 149.5, 'LENS_L'], ['L', 230, 157, 192, 172.5, 152, 160.5, 'LENS_R'], ['L', 67, 124.5, 99.5, 150.5, 101, 130, 'BROW'], ['L', 188, 136.5, 139, 156.5, 127, 134.5, 'BROW'], ['M', 117.5, 163, 58, 30.5, .5, 5]],
  /* 24 */ [['L', 31.5, 140, 64.5, 161, 80.5, 153, 'LENS_L'], ['L', 221, 161.5, 184.5, 176, 144, 163.5, 'LENS_R'], ['L', 63, 128, 94.5, 153, 95, 133, 'BROW'], ['L', 177.5, 140, 130, 159, 119, 138, 'BROW'], ['M', 110.5, 166, 58, 26, -4.5, 10]],
  /* 25 */ [['L', 30.5, 137, 61.5, 157.5, 78, 150, 'LENS_L'], ['L', 216, 160, 181, 174, 139.5, 161, 'LENS_R'], ['L', 62.5, 126, 92, 150.5, 92.5, 130, 'BROW'], ['L', 170, 137, 125, 155.5, 114, 136, 'BROW'], ['M', 107.5, 164, 58, 27, -3, 10]],
  /* 26 */ [['L', 30, 138, 58, 157, 76, 151, 'LENS_L'], ['L', 213, 161.5, 180, 175.5, 136.5, 162, 'LENS_R'], ['L', 63, 128, 90, 151.5, 91, 131, 'BROW'], ['L', 164.5, 137, 122, 155.5, 111.5, 137.5, 'BROW'], ['W', 105, 173, 45, 10]],
  /* 27 */ [['L', 28, 136, 52, 153, 72.5, 148, 'LENS_L'], ['L', 210, 159, 179, 174, 133, 159, 'LENS_R'], ['L', 61.5, 127, 86, 149.5, 88.5, 128, 'BROW'], ['L', 158.5, 133, 118.5, 151.5, 108, 136, 'BROW'], ['W', 101, 170, 43, 8]],
  /* 28 */ [['L', 26, 135, 51, 151, 72, 147, 'LENS_L'], ['L', 209, 158, 178.5, 173.5, 130, 157.5, 'LENS_R'], ['L', 59.5, 125, 84, 147.5, 87, 128, 'BROW'], ['L', 155, 131, 117, 151, 105, 133, 'BROW'], ['W', 99, 169, 43, 7]],
  /* 29 */ [['L', 26, 136, 61.5, 156, 74, 145, 'LENS_L'], ['L', 207, 161, 177, 173, 133, 161, 'LENS_R'], ['L', 60.5, 126, 86, 148, 87, 130, 'BROW'], ['L', 156, 132, 115, 152, 106, 134, 'BROW'], ['W', 100, 170, 43, 7]],
  /* 30 */ [['L', 27.5, 137.5, 62, 155, 73, 145.5, 'LENS_L'], ['L', 206.5, 164, 164, 178, 135, 163, 'LENS_R'], ['L', 63, 127, 86, 150.5, 89.5, 129, 'BROW'], ['L', 157, 134.5, 115, 154, 108, 137, 'BROW'], ['W', 100, 172, 42, 7.5]],
  /* 31 */ [['L', 28, 139, 64.5, 156, 73, 145, 'LENS_L'], ['E', 177, 163, 71, 25, 0, 0], ['L', 66, 130, 90, 147, 89, 127, 'BROW'], ['L', 115.5, 115.5, 114, 130.5, 155, 126, 'BROW_UP'], ['W', 101, 171, 44, 8]],
  /* 32 */ [['L', 28, 140.5, 65.5, 158, 74.5, 143.5, 'LENS_L'], ['E', 182.5, 142, 68, 69.5, 0, 0], ['L', 62.5, 128.5, 92.5, 144.5, 86.5, 123.5, 'BROW'], ['L', 134, 57.5, 129.5, 84, 182.5, 80, 'BROW_UP'], ['W', 102.5, 172.5, 45, 7]],
  /* 33 */ [['L', 28, 138.5, 69.5, 166, 80.5, 154, 'LENS_L'], ['E', 182.5, 150, 70.5, 67, -14.5, .1], ['L', 65, 132.5, 99, 150, 88.5, 126, 'BROW'], ['L', 124, 77, 127.5, 101, 180, 89, 'BROW_UP'], ['W', 103, 179.5, 43, 8]],
  /* 34 */ [['L', 33.5, 136, 44.5, 156, 75.5, 170.5, 'ARM_L'], ['L', 29, 173, 52, 179, 78, 173, 'ARM_L'], ['L', 219, 132, 201, 154.5, 152, 175, 'ARM_R'], ['L', 230.5, 191.5, 204, 197, 158, 181.5, 'ARM_R'], ['L', 74, 144, 93, 159, 98.5, 151, 'BROW'], ['L', 132.5, 151, 161, 141.5, 171.5, 133.5, 'BROW'], ['L', 108, 148.5, 114, 159.5, 120.5, 155, 'BROW'], ['W', 110, 194, 43, 9.5]],
  /* 35 */ [['L', 41, 137, 60.5, 168.5, 82, 178, 'ARM_L'], ['L', 33, 180, 61.5, 185.5, 87, 182, 'ARM_L'], ['L', 237, 145, 214.5, 169.5, 165, 188, 'ARM_R'], ['L', 236, 193.5, 200, 207.5, 159, 189, 'ARM_R'], ['L', 87.5, 161, 98.5, 168, 108, 170, 'BROW'], ['L', 113, 157, 116, 179, 130.5, 171.5, 'BROW'], ['L', 136, 172, 165, 167, 175, 153.5, 'BROW'], ['W', 119.5, 202, 46, 11]],
  /* 36 */ [['L', 54, 136, 71, 162, 107, 173, 'ARM_L'], ['L', 45, 174, 75, 190, 106.5, 176, 'ARM_L'], ['L', 246, 134, 225, 161, 178, 186.5, 'ARM_R'], ['L', 260, 184, 238, 205, 176.5, 193.5, 'ARM_R'], ['L', 109.5, 145, 119.5, 148, 127.5, 148, 'BROW'], ['L', 155, 149, 175, 150, 185, 143.5, 'BROW'], ['W', 132, 202, 47, 8]],
  /* 37 */ [['E', 87, 138, 72, 90, -6, 0], ['E', 265.5, 140, 72, 96, -6, .19], ['A', 174.5, 183, -.03]]];
// [video frame, pose]: the pose that starts on that frame. The squint-wink plays twice, 139 frames apart.
const CYCLE = [69,1, 71,2, 73,3, 75,4, 89,3, 91,5, 93,6, 95,7, 97,8, 113,9, 115,10, 117,11, 119,12, 121,13,
  123,14, 125,15, 127,16, 129,17, 131,18, 133,19, 135,20, 137,21, 139,22, 141,23, 143,24, 145,25,
  147,26, 149,27, 152,28, 170,29, 172,30, 174,31, 175,32, 191,33, 194,34, 196,35, 198,36,
  199,37, 200,0];
const CUTS = [0, 0, ...CYCLE, ...CYCLE.map((v, i) => i % 2 ? v : v + 139)];

// Rest, in the same terms, for intensity: below 1 a pose eases back toward it, above 1 it is exaggerated.
const REST = [['E', EYE.left, EYE.y, EYE.w, EYE.h, 0, 0], ['E', EYE.right, EYE.y, EYE.w, EYE.h, 0, 0], ['A', MOUTH.x, MOUTH.y, 0]];
const centre = pose => { let x = 0, y = 0; for (const p of pose) { x += p[1]; y += p[2]; } return [x / pose.length, y / pose.length]; };
const [RX, RY] = centre(REST);

export function draw(ctx, t, o = {}) {
  const g = begin(ctx); g.fillStyle = g.strokeStyle = INK;
  const k = clamp(o.intensity ?? 1, 0, 1.5), gx = clamp(o.gazeX ?? 0, -1, 1) * 12;
  const f = Math.floor(clamp(t, 0, 16.708333) * 24 + 1e-3);
  let id = 0; for (let i = 0; i < CUTS.length; i += 2) if (CUTS[i] <= f) id = CUTS[i + 1];
  if (!id) return restFace(g, gx, 0);
  const pose = POSES[id];
  // Glance and squint poses share the rest face's parts, so intensity morphs each part toward rest; the
  // laugh, wink and scrunch poses are different shapes, so intensity scales how far the face has moved.
  const morph = pose.length === REST.length && REST.every((r, i) => pose[i][0] === r[0]);
  const [cx, cy] = centre(pose);
  g.translate(gx + (morph ? 0 : (k - 1) * (cx - RX)), morph ? 0 : (k - 1) * (cy - RY));
  pose.forEach((p, i) => SHAPES[p[0]](g, ...(morph && i < 3 ? p.slice(1).map((v, j) => mix(REST[i][j + 1], v, k)) : p.slice(1))));
}
