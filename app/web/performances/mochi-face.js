// Shared drawing kit for Mochi's face display. Every clip draws in the video's own 360x234 pixel space,
// so shapes and positions can be measured straight off the reference frames. No video pixels are sampled.
export const W = 360, H = 234, INK = '#fbfefb', BG = '#030505', DURATION = 16.708333;
// The IDEAL resting face, shared by every clip: sized off the neutral frame (cell_0_0 at 0.5 s), then made
// exactly symmetric about the screen centre. Clips are cleaned-up versions of the video, not traces of it.
export const EYE = { w: 72, h: 104, y: 115, left: 85, right: 275 };
export const MOUTH = { x: 180, y: 161.5, w: 52, dip: 10, width: 13 };   // round-capped stroke; caps reach x 147..213

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const mix = (a, b, u) => a + (b - a) * u;

// Keyframed poses: [[time, {param: value}], ...] over a neutral pose. Eased between keys; a key with
// `cut: true` snaps instead (the source animation has many hard cuts at 24 fps).
export function timeline(neutral, keys) {
  const K = keys.map(([t, p]) => [t, { ...neutral, ...p }]).sort((a, b) => a[0] - b[0]);
  return time => {
    const t = clamp(time, 0, DURATION);
    let i = 1; while (i < K.length - 1 && K[i][0] < t) i++;
    if (K.length < 2 || t <= K[0][0]) return { ...K[0][1] };
    const [a, A] = K[i - 1], [b, B] = K[i];
    const u = B.cut ? (t >= b ? 1 : 0) : smooth((t - a) / Math.max(1e-6, b - a));
    const out = {};
    for (const k of Object.keys(neutral)) out[k] = typeof A[k] === 'number' ? mix(A[k], B[k], u) : (u < .5 ? A[k] : B[k]);
    return out;
  };
}

// Clear to the display's black and map 360x234 onto whatever canvas the face is painted into.
export function begin(ctx) {
  const g = ctx, c = g.canvas;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = BG; g.fillRect(0, 0, c.width, c.height);
  const s = Math.min(c.width / W, c.height / H);
  g.translate((c.width - W * s) / 2, (c.height - H * s) / 2); g.scale(s, s);
  g.fillStyle = g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  return g;
}

// Mochi's soft rounded-rectangle eye (a superellipse). lidTop/lidBottom (0..1) cut it from above/below,
// so squints, sleepy lids and flat "-" eyes are the same shape.
export function eye(g, cx, cy, { w = EYE.w, h = EYE.h, tilt = 0, lidTop = 0, lidBottom = 0, n = 3.2 } = {}) {
  if (w <= .5 || h <= .5) return;
  g.save(); g.translate(cx, cy); g.rotate(tilt);
  if (lidTop > 0 || lidBottom > 0) { g.beginPath(); g.rect(-w, -h / 2 + h * lidTop, w * 2, h * Math.max(0, 1 - lidTop - lidBottom)); g.clip(); }
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** (2 / n) * w / 2, y = Math.sign(s) * Math.abs(s) ** (2 / n) * h / 2;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath(); g.fill(); g.restore();
}

// The neutral smile: a filled crescent. depth bends it (negative frowns), thick is its middle thickness.
export function crescent(g, cx = MOUTH.x, cy = MOUTH.y, { w = MOUTH.w, depth = 34, thick = 13 } = {}) {
  const l = cx - w / 2, r = cx + w / 2;
  g.beginPath(); g.moveTo(l, cy);
  g.quadraticCurveTo(cx, cy + depth, r, cy);
  g.quadraticCurveTo(cx, cy + depth - thick * 2, l, cy);
  g.closePath(); g.fill();
  g.save(); g.lineWidth = 3; g.stroke(); g.restore();
}

// The resting smile: an even, round-capped stroke. dip is how far its middle sags below the ends.
export function smile(g, cx = MOUTH.x, cy = MOUTH.y, { w = MOUTH.w, dip = MOUTH.dip, width = MOUTH.width } = {}) {
  g.save(); g.lineWidth = width; g.beginPath(); g.moveTo(cx - w / 2, cy); g.quadraticCurveTo(cx, cy + dip * 2, cx + w / 2, cy); g.stroke(); g.restore();
}

// The resting face itself. Every clip starts and ends here, so switching clips never jumps.
export function restFace(g, dx = 0, dy = 0) {
  eye(g, EYE.left + dx, EYE.y + dy); eye(g, EYE.right + dx, EYE.y + dy); smile(g, MOUTH.x + dx, MOUTH.y + dy);
}

// A stroked curve: ^ ^ squints, closed-eye arcs, brows and flat lines. bend > 0 sags down, < 0 arches up.
export function arc(g, cx, cy, w, bend, width = 6) {
  g.save(); g.lineWidth = width; g.beginPath(); g.moveTo(cx - w / 2, cy); g.quadraticCurveTo(cx, cy + bend * 2, cx + w / 2, cy); g.stroke(); g.restore();
}

export function heart(g, cx, cy, size, fill = '#c0101c') {
  g.save(); g.translate(cx, cy); g.scale(size / 32, size / 32); g.fillStyle = fill;
  g.beginPath(); g.moveTo(0, 12);
  g.bezierCurveTo(-30, -8, -18, -34, 0, -18); g.bezierCurveTo(18, -34, 30, -8, 0, 12);
  g.fill(); g.restore();
}

export function blush(g, cx, cy, rx = 16, ry = 9, fill = '#e06aa8') {
  g.save(); g.fillStyle = fill; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
}
