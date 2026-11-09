// cell_0_1 · Pong transformation. Mochi's face turns into a game of Pong and back: the smile squashes into a
// ball, each eye squashes into a paddle, a dashed net fades in, a rally plays out (the left paddle misses once),
// then the ball unrolls back into the smile and the paddles balloon back into eyes. Every soft shape is the
// kit's own eye (a superellipse, scaled, tilted or lid-cut) or its smile (bent, stretched, turned), so the
// transformation reads as the resting face being squashed and stretched. Times are video frames at 24 fps;
// each drawing is held until the next key, exactly like the hand-drawn source.
import { begin, clamp, mix, smooth, eye, smile, restFace, EYE, INK } from '../mochi-face.js';
export const title = 'Pong transformation';

// Soft shapes, each held from its frame to the next key.
// Eye-shaped: [frame, cx, cy, w, h, tilt, n, lidTop?]. Smile-shaped: [frame, cx, cy, w, dip, turn].
const MOUTH_TO_BALL = [   // the smile straightens, balls up, stretches, then shrinks into the Pong ball
  [80, 173.5, 172, 65, 19, 0, 2.5], [82, 172.5, 180, 63, 24, 0, 2.5], [84, 170, 184, 47, 49.5, 0, 2.2],
  [88, 167.5, 182, 42, 58.5, 0, 2.2], [93, 164.5, 182.5, 33, 47.5, 0, 2.2], [94, 164, 184, 14, 16.5, 0, 3.6]];
const LEFT_TO_PADDLE = [  // left eye leans, stretches into a slanted bar, balls up small, then thins into a paddle
  [98, 85, 116, 69, 111, .12, 3.2], [100, 83, 114, 59, 128, .3, 3.2], [102, 81.5, 113.5, 51, 141.5, .34, 3.2],
  [104, 77.5, 118, 55, 132, .3, 3.2], [106, 75, 124, 54, 50.5, .17, 3.2], [108, 67.5, 131, 43, 28, .23, 2.8],
  [110, 63, 134, 31, 37, 0, 2.6], [112, 58, 138, 20.5, 58.5, 0, 3.2]];
const RIGHT_TO_PADDLE = [ // right eye tips over, flattens into a wide bar, bends, then whips up into a paddle
  [132, 274.5, 109, 80.5, 96, -.09, 3.2], [134, 279, 100.5, 127, 58, .16, 3.2], [136, 281.5, 93.5, 135.5, 50, .16, 4.5],
  [138, 283, 88, 123, 57, .32, 2.3, .16], [140, 283.5, 77, 17.5, 84, -.21, 2.7], [142, 289, 73, 8, 89, -.05, 5.5],
  [144, 294.5, 71.5, 11.5, 80.5, -.03, 3.2], [146, 299, 68, 14, 64, 0, 4]];
const BALL_TO_MOUTH = [   // the ball unrolls into an ever longer smile that swings level, overshoots and settles
  [275, 122, 162, 8, .6, 0], [277, 134, 160, 36, 5, .33], [279, 151, 161, 47.5, 7.2, .28],
  [281, 168.5, 162, 54, 9.2, .1], [283, 180, 161.5, 60, 10.5, 0], [285]];
// Paddles back to eyes: one shape mirrored about the screen centre. The right eye only lags lower (its paddle
// was lower) by yR - yL. [frame, cx of the left eye, yL, yR, w, h, n, lidTop]; n = 0 draws a flattened smile.
const PADDLES_TO_EYES = [
  [299, 59.5, 109, 119, 22, 54, 4], [300, 62.5, 112.5, 120.5, 22, 54, 4], [301, 69.5, 124.5, 132, 86.5, 23, 3],
  [303, 75, 126, 132, 80, 3.5, 0], [305, 80, 111, 113, 85.5, 71, 3.2, .5], [307, 85, 119, 119, 72, 99, 3.2],
  [309, 85, 115, 115, 65, 113.5, 3.2], [313]];

// Rigid Pong pieces, linear between keys. The ball eases out of the serve, then flies at constant speed
// between bounces (keys are the contacts: paddle faces, top and bottom walls, and the miss off the left).
const SERVE = { f0: 95, f1: 123.03, x0: 163, y0: 183.9, x1: 62.4, y1: 148.1, ease: 2.2 };
const BALL = [123.03, 62.4, 148.1, 150, 295.1, 66, 169, 127.5, 5.8, 176.01, 62.5, 34.4, 202, 295.4, 122.7,
  212.91, 224.6, 233.1, 231, 82.5, 5.1, 241, 8.7, 132.8, 253.97, -87, 212, 264, 14, 143.2, 274, 114.7, 160.8];
// Paddles: frame, left edge, top. They settle into the court, track the ball, and drift home at the end.
const PADL = [114, 48, 111.3, 115, 48, 111.3, 116, 45.1, 113.8, 118, 43.1, 115.4, 131, 42.6, 116, 133, 42.6, 114.5,
  136, 42.6, 107.3, 144, 42.6, 81.5, 151, 42.6, 53.6, 155, 42.6, 47.3, 165, 42.6, 45.9, 167, 42.6, 40.7, 172, 42.6, 18.5,
  175, 42.6, 9.4, 177, 42.6, 8.9, 180, 42.6, 13.5, 182, 42.6, 20.5, 188, 42.6, 48, 193, 42.6, 61.5, 199, 42.6, 87.7,
  205, 42.6, 126.5, 208, 42.6, 139.1, 211, 42.6, 146.6, 216, 42.6, 151.8, 229, 42.6, 152.2, 232, 42.6, 145.5,
  236, 42.6, 118.4, 240, 42.6, 74.7, 242, 42.6, 58.1, 244, 42.6, 48.3, 246, 42.6, 44, 287, 42.6, 43.8, 291, 42.9, 49.4,
  294, 44.3, 58.3, 297, 47.8, 69.7, 298, 49.7, 73.6];
const PADR = [148, 296.4, 36.6, 149, 296.4, 36.6, 152, 300.6, 35.8, 178, 300.7, 35.8, 190, 300.7, 40.9, 194, 300.7, 49.9,
  204, 300.7, 91.5, 209, 300.7, 101, 214, 300.7, 101, 216, 300.7, 98.2, 221, 300.7, 80.7, 226, 300.7, 70.9,
  232, 300.7, 47.8, 235, 300.7, 42.8, 238, 300.7, 43.5, 244, 300.7, 53.2, 250, 300.7, 75, 254, 300.7, 80.8,
  290, 300.7, 81.7, 294, 299, 82.9, 296, 297, 84.1, 298, 294, 86.3];
const PADDLE = { w: 14, h: 60 }, BALL_SIDE = 12;
// Net: frame, dash width (it pops in a little wide, then settles; under 2 px it fades instead of thinning).
const NET = [128, 0, 129, .55, 130, 1.76, 131, 2.89, 132, 4.26, 133, 4.72, 134, 4.07, 135, 2.71, 136, 2.11, 140, 2.65,
  266, 2.67, 267, 3.39, 268, 4.07, 269, 4.73, 270, 3.94, 271, 2.87, 272, 1.85, 273, .91, 274, 0];

// Sample a flat key table of rows with `w` numbers each (first = frame) at frame f, linearly.
function lerpKeys(T, w, f) {
  if (f <= T[0]) return T.slice(1, w);
  for (let i = w; i < T.length; i += w) if (f <= T[i]) {
    const u = (f - T[i - w]) / (T[i] - T[i - w]);
    return T.slice(i + 1, i + w).map((v, j) => mix(T[i - w + 1 + j], v, u));
  }
  return T.slice(T.length - w + 1);
}
const held = (K, f) => { let k = K[0]; for (const r of K) if (r[0] <= f) k = r; return k; };
const softEye = (g, [, x, y, w, h, tilt, n, lidTop = 0]) => eye(g, x, y, { w, h, tilt, n, lidTop });
function arc(g, cx, cy, w, dip, turn = 0) { // the resting smile, bent, stretched and turned
  g.save(); g.translate(cx, cy); g.rotate(turn); smile(g, 0, 0, { w, dip }); g.restore();
}

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), f = Math.floor(clamp(t, 0, 16.708333) * 24 + 1e-3);
  g.fillStyle = g.strokeStyle = INK;
  if (f < 80 || f >= 313) return restFace(g, clamp(o.gazeX ?? 0, -1, 1) * 12, 0);
  g.translate(clamp(o.gazeX ?? 0, -1, 1) * 12, 0);
  // Intensity < 1 calms the rally: ball and paddles travel less far from the screen's middle line (they
  // stay in contact because both are scaled together), easing in after the serve and out before the ending.
  const calm = mix(1, clamp(o.intensity ?? 1, 0, 1), smooth((f - 124) / 26) * (1 - smooth((f - 250) / 24)));
  const Y = y => 117 + (y - 117) * calm;
  const pad = T => { const [x, y] = lerpKeys(T, 3, f); g.fillRect(x, Y(y + PADDLE.h / 2) - PADDLE.h / 2, PADDLE.w, PADDLE.h); };

  if (f >= 299) {                                  // paddles balloon back into a mirrored pair of eyes
    const [, x, yL, yR, w, h, n, lidTop = 0] = held(PADDLES_TO_EYES, f);
    for (const [cx, cy] of [[x, yL], [360 - x, yR]]) n ? eye(g, cx, cy, { w, h, n, lidTop }) : arc(g, cx, cy, w, h);
  } else {
    if (f < 98) eye(g, EYE.left, EYE.y); else if (f < 114) softEye(g, held(LEFT_TO_PADDLE, f)); else pad(PADL);
    if (f < 132) eye(g, EYE.right, EYE.y); else if (f < 148) softEye(g, held(RIGHT_TO_PADDLE, f)); else pad(PADR);
  }

  if (f < 95) softEye(g, held(MOUTH_TO_BALL, f));
  else if (f >= 275) { const [, x, y, w, dip, turn] = held(BALL_TO_MOUTH, f); x ? arc(g, x, y, w, dip, turn) : smile(g); }
  else {
    const u = clamp((f - SERVE.f0) / (SERVE.f1 - SERVE.f0)) ** SERVE.ease;
    const [x, y] = f < SERVE.f1 ? [mix(SERVE.x0, SERVE.x1, u), mix(SERVE.y0, SERVE.y1, u)] : lerpKeys(BALL, 3, f);
    g.fillRect(x - BALL_SIDE / 2, Y(y) - BALL_SIDE / 2, BALL_SIDE, BALL_SIDE);
  }

  const w = lerpKeys(NET, 2, f)[0];
  if (w > 0) {
    g.globalAlpha = Math.min(1, w / 2); const ww = Math.max(2, w);
    for (let y = 0; y < 234; y += 14.4) g.fillRect(180 - ww / 2, y, ww, 7.2);
    g.globalAlpha = 1;
  }
}
