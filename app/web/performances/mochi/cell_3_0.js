// cell_3_0 · Spotlights, scare. Mochi's eyes are searchlights: light cones fan out from behind them and
// sweep as the face darts around the screen; it blinks, gasps, winks, squints, flashes and pulls a spiky
// scared face. Every pose is built from a few clean shapes derived from the kit's resting face (the same eye
// squashed, lid-cut or tilted; even crescents; ellipses; tapered strokes; symmetric gradient wedges), and
// symmetric poses draw their left half and mirror it about the face centre. A pose that is really one
// drawing moving is one pose plus a whole-face transform. The source cuts between drawings on exact frames.
import { begin, clamp, eye as kitEye, smile, restFace, EYE, INK, DURATION } from '../mochi-face.js';
export const title = 'Spotlights, scare';

const L = EYE.left, Y = EYE.y, CX = 180, CY = 130, D = Math.PI / 180;
let light = 1, px = 1; // light: o.intensity applied to cones and glows; px: device pixels per face pixel
const grey = v => { v = Math.round(clamp(v, 0, 255)); return `rgb(${v},${v},${v})`; };

// ---- composition ------------------------------------------------------------------------------------------
// flip: draw f reflected about the face's centre line; both: a left half and its reflection.
function flip(g, f) { g.save(); g.translate(2 * CX, 0); g.scale(-1, 1); f(); g.restore(); }
function both(g, f) { f(); flip(g, f); }
// Whole-face transform: offset, turn (degrees) and scale about the face centre.
function at(g, { x = 0, y = 0, rot = 0, s = 1 } = {}, f) {
  g.save(); g.translate(CX + x, CY + y); g.rotate(rot * D); g.scale(s, s); g.translate(-CX, -CY); f(); g.restore();
}
// Soft glow around whatever f draws (the eyes light up).
function halo(g, blur, f) { g.save(); g.shadowColor = INK; g.shadowBlur = blur * px; f(); g.restore(); }
function tone(g, lum, f) { g.save(); g.fillStyle = g.strokeStyle = grey(lum); f(); g.restore(); }

// ---- shapes -----------------------------------------------------------------------------------------------
// The kit's eye, tilt given in degrees like every other angle here.
const eye = (g, x, y, o = {}) => kitEye(g, x, y, { ...o, tilt: (o.tilt || 0) * D });
// Closed eye / frown: an even crescent `w` across whose ends sit at y; its middle sags `sag` px (negative
// arches up) and is `thick` px fatter than its round ends (`rim` px).
function lid(g, x, y, w, sag, thick, { rim = 7, tilt = 0 } = {}) {
  g.save(); g.translate(x, y); g.rotate(tilt * D); g.lineWidth = rim; g.beginPath(); g.moveTo(-w / 2, 0);
  g.quadraticCurveTo(0, 2 * sag + thick, w / 2, 0); g.quadraticCurveTo(0, 2 * sag - thick, -w / 2, 0);
  g.closePath(); g.fill(); g.stroke(); g.restore();
}
const dot = (g, x, y, w, h, tilt = 0) => { g.beginPath(); g.ellipse(x, y, w / 2, h / 2, tilt * D, 0, Math.PI * 2); g.fill(); };
// Tapered stroke: from (x1,y1), w1 thick, to (x2,y2), w2 thick, bowed `bend` px to its left; round ends.
function taper(g, x1, y1, w1, x2, y2, w2, bend = 0) {
  const n = Math.hypot(x2 - x1, y2 - y1) || 1, nx = (y2 - y1) / n, ny = -(x2 - x1) / n;
  const cx = (x1 + x2) / 2 + nx * bend * 2, cy = (y1 + y2) / 2 + ny * bend * 2, A = [], B = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, v = 1 - u, x = v * v * x1 + 2 * u * v * cx + u * u * x2, y = v * v * y1 + 2 * u * v * cy + u * u * y2;
    const tx = 2 * v * (cx - x1) + 2 * u * (x2 - cx), ty = 2 * v * (cy - y1) + 2 * u * (y2 - cy), m = Math.hypot(tx, ty) || 1;
    const h = (w1 + (w2 - w1) * u) / 2; A.push([x - ty / m * h, y + tx / m * h]); B.push([x + ty / m * h, y - tx / m * h]);
  }
  g.beginPath(); [...A, ...B.reverse()].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  for (const [x, y, w] of [[x1, y1, w1], [x2, y2, w2]]) if (w > 1) { g.beginPath(); g.arc(x, y, w / 2, 0, Math.PI * 2); g.fill(); }
}
// A searchlight: a symmetric wedge of light from (x,y) towards `dir` degrees, `half` degrees wide with a
// `soft` degree feathered edge, fading from `lum` at the apex to lum*end at distance `len` and beyond.
function cone(g, x, y, dir, { half = 34, soft = 25, len = 180, lum = 1, end = .25 } = {}) {
  const th = dir * D, a = (half + soft) * D, h = half * D, T = Math.PI * 2, c = grey(255 * lum * light);
  g.save(); g.beginPath(); g.moveTo(x, y); g.arc(x, y, 1500, th - a, th + a); g.closePath(); g.clip();
  const cg = g.createConicGradient(th - Math.PI, x, y);
  cg.addColorStop(.5 - a / T, '#000'); cg.addColorStop(.5 - h / T, c); cg.addColorStop(.5 + h / T, c); cg.addColorStop(.5 + a / T, '#000');
  g.globalCompositeOperation = 'lighter'; g.fillStyle = cg; g.fillRect(-900, -900, 2160, 2034);
  const rg = g.createRadialGradient(x, y, 0, x, y, len);
  rg.addColorStop(0, '#000'); rg.addColorStop(Math.min(.5, 8 / len), '#fff'); rg.addColorStop(1, grey(255 * end));
  g.globalCompositeOperation = 'multiply'; g.fillStyle = rg; g.fillRect(-900, -900, 2160, 2034);
  g.restore();
}
// Flash: a radial glare, `peak` (may exceed 1: a flat white core) at the centre to `edge` at radius r and beyond.
function glow(g, x, y, r, peak, edge, sy = 1) {
  const f = peak > 1 ? (peak - 1) / (peak - edge) : 0, rg = g.createRadialGradient(x, y / sy, 0, x, y / sy, r);
  rg.addColorStop(0, grey(255 * Math.min(1, peak) * light)); rg.addColorStop(f, grey(255 * Math.min(1, peak) * light)); rg.addColorStop(1, grey(255 * edge * light));
  g.save(); g.scale(1, sy); g.fillStyle = rg; g.fillRect(-900, -900 / sy, 2160, 2034 / sy); g.restore();
}

// ---- face parts (left halves are mirrored) ----------------------------------------------------------------
// The pair of searchlights behind the eyes, mirrored; tilt raises both outer ends.
const beams = (g, { tilt = 0, ...o } = {}) => both(g, () => cone(g, L + 37, Y, 180 + tilt, o));
const eyes = (g, o = {}, x = L, y = Y) => both(g, () => eye(g, x, y, o));
const shut = (g, x, y, w, sag, thick, o) => both(g, () => lid(g, x, y, w, sag, thick, o));
const halfEye = g => eye(g, 84, 151, { w: 77, h: 37, tilt: 5, lidTop: .2 });   // the half-shut squint eye
const lowCone = g => cone(g, 121, 141, 157, { half: 8, len: 120, lum: .85, end: .55 });
const gaspMouth = g => dot(g, CX, 155, 38.5, 49, 20);                        // the gasp: a tilted oval
// ">" squint eye of the scared faces: two tapered, bowed arms from an inner point (ax, ay).
function chevron(g, ax, ay, ux, uy, lx, ly, [wa, wu, wl, bu, bl]) { taper(g, ax, ay, wa, ux, uy, wu, bu); taper(g, ax, ay + 1, wa * .75, lx, ly, wl, bl); }
// The scared face: chevron eyes, brows ending in two of four evenly spaced spikes, a gritted grimace whose
// gap is an even zigzag. `angry` swaps the chevrons for lid-cut glaring eyes glowing that much.
function scared(g, angry) {
  both(g, () => {
    taper(g, CX - 30, 164, 8.5, CX - 31, 137.5, 1); taper(g, CX - 10, 163, 4.5, CX - 11.5, 137.5, 1); // spikes
    taper(g, CX - 29, 165, 10, CX - 81, 142.5, 1.5, 1.5);                                               // brow
    if (angry) halo(g, angry, () => eye(g, CX - 99, 173, { w: 90, h: 50, tilt: 21, lidTop: .2 }));
    else chevron(g, CX - 53, 187, CX - 139, 154.5, CX - 124, 186, [12, 10.5, 8.5, 5, 8.5]);
  });
  g.beginPath(); g.roundRect(CX - 40, 182, 80, 32, 12); g.fill();
  g.save(); g.strokeStyle = '#030505'; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i <= 8; i++) g.lineTo(CX - 40 + i * 10, 194.5 + (i % 2 ? -2 : 2));
  g.stroke(); g.restore();
}

// ---- poses (kit space: the resting face is restFace exactly) ----------------------------------------------
const gasp = (h, y, x = 89.5) => g => { beams(g, { tilt: 10, half: 32, len: 175 }); eyes(g, { w: 70, h, tilt: 2 }, x, y); gaspMouth(g); };
// Off-axis faces (turned, tipped back, low in a corner): each eye is the kit eye [x, y, w, h, tilt, lidTop],
// the mouth an oval [x, y, w, h, tilt] or, with bar, a small flat eye shape; cones are [x, y, dir, options].
const E = (g, [x, y, w, h, tilt = 0, lidTop = 0]) => eye(g, x, y, { w, h, tilt, lidTop });
const look = ({ c = [], l, r, m, bar }) => g => {
  for (const [x, y, dir, o] of c) cone(g, x, y, dir, o);
  if (l) E(g, l); if (r) E(g, r); bar ? E(g, m) : dot(g, ...m);
};
function skeptic(g, rh, lh, dip, mouth = smirk) {     // one eye lid-cut, the other open; a lopsided frown
  cone(g, 128, 120, 164, { half: 22, soft: 15, len: 150, end: .4 });       // the right cone dips (swings down) or not
  dip ? cone(g, 233, 99, 11, { half: 29, len: 185, end: .33 }) : cone(g, 233, 123, -4, { half: 32, end: .28 });
  eye(g, 91, 167.5 - lh / 1.6, { w: 68, h: lh / .8, tilt: -2, lidTop: .2 }); eye(g, 270, 165.5 - rh / 2, { w: 68, h: rh, tilt: 3 }); mouth(g);
}
const smirk = g => lid(g, 182.5, 153.5, 47, -4, 8, { rim: 8, tilt: -11 });
const spark = (g, x, y, tilt) => { g.save(); g.translate(x, y); g.rotate(tilt * D); taper(g, -9, 0, 2, 9, 0, 4, 2); g.restore(); };
const squint = g => { both(g, () => chevron(g, CX - 55.5, 174.5, CX - 139, 157.5, CX - 133, 178.5, [12, 12, 11, 2.5, 7])); lid(g, CX, 175, 51, 9, 8, { rim: 8 }); };
const squint2 = g => { both(g, () => chevron(g, CX - 56.5, 168.5, CX - 138.5, 148, CX - 133.5, 172.5, [14.5, 14, 11, 0, 5.5])); lid(g, CX, 170.5, 51, 8.5, 8, { rim: 8 }); };
const BLINK2 = [85, 161, 72, 7, 7.5, { tilt: 2.5 }], WINK = [85, 163.5, 73.5, 5, 6, { rim: 7.5, tilt: 2 }];
const droopEye = g => eye(g, 86.5, 160.5, { w: 74, h: 36, tilt: 8, lidTop: .1 });

const POSES = {
  rest: g => restFace(g),
  beams: g => { beams(g); restFace(g); },
  lidded: g => { eyes(g, { lidTop: .2 }, L, 116); smile(g); },
  blink: g => { shut(g, 84, 155, 72, 10, 9, { rim: 9, tilt: 4 }); smile(g); },
  blink2: g => { shut(g, ...BLINK2); smile(g); },
  droop: g => { both(g, () => { cone(g, 120, 147, 150, { half: 11, len: 100, lum: .78, end: .55 }); droopEye(g); }); lid(g, CX, 188, 50, -4, 6, { rim: 8 }); },
  droopGlow: g => { halo(g, 6, () => both(g, () => droopEye(g))); lid(g, CX, 186.5, 52, -3, 5.5, { rim: 8 }); },
  sad: g => { shut(g, 86, 169.5, 72, 6, 5.5, { rim: 9, tilt: 7 }); lid(g, CX - 1, 194, 54, -4.5, 3.5, { rim: 7.5 }); },
  gasp: gasp(108, 106.5),
  gasp2: gasp(104, 109, 89),
  gaspShut: g => { shut(g, 88.5, 149.5, 72, 11.5, 11, { rim: 7.5, tilt: 5 }); gaspMouth(g); },
  gaspShut2: g => { shut(g, 89, 156.5, 68, 7, 7, { rim: 7.5, tilt: 4.5 }); gaspMouth(g); },
  turn: look({ c: [[138, 125, 192, { half: 31, len: 190 }], [238, 125, -12, { half: 30, len: 170 }]],
    l: [100, 106, 71, 106, 2.5], r: [273, 107.5, 67, 101.5, -1], m: [189, 154, 36.5, 47, 18] }),
  turn2: look({ c: [[168, 109, 196, { half: 30, len: 205, end: .4 }], [243, 120, -14, { half: 27, len: 155 }]],
    l: [127, 94, 77, 97, 3], r: [278, 102.5, 64, 92, 2], m: [204, 141.5, 34, 38.5, 29] }),
  turn3: look({ c: [[170, 112, 197, { half: 16, len: 200, end: .45 }], [245, 115, -16, { half: 26, len: 155 }]],
    l: [134.5, 78.5, 75, 97, 3.5], r: [280.5, 97, 63.5, 89], m: [208, 131.5, 32, 36, 30] }),
  tip1: look({ c: [[127, 98, 222, { half: 20, len: 160 }], [250, 105, -23, { half: 16, len: 145 }]],
    l: [138, 66.5, 75, 77, 4], r: [281, 86.5, 62, 71, -3], m: [215, 110.5, 35, 31, 10] }),
  tip2: look({ c: [[123, 82, -98, { half: 38, len: 130, end: 0 }], [259, 90, -28, { half: 11, len: 130, lum: .93, end: .22 }]],
    l: [139, 54.5, 74, 58, 5], r: [280, 75.5, 67, 47.5, 30], m: [215, 87, 36, 25.5, 10] }),
  tip3: look({ c: [[124, 64, -90, { half: 42, len: 100, end: 0 }], [259, 80, -32, { half: 10, len: 125, lum: .74, end: .2 }]],
    l: [138, 42, 78, 40.5, 1], r: [279, 66, 65, 36, 25], m: [214, 68, 35, 20, 8] }),
  up: look({ c: [[127, 52, -91, { half: 48, len: 70, lum: .95, end: 0 }], [246, 62, -21, { half: 6, len: 125, lum: .6 }]],
    l: [136, 35, 79, 31], r: [278, 61, 67.5, 28.5, 24], m: [213, 57, 34, 17.5, 5] }),
  glare: g => { glow(g, 139, 101.5, 165, 1.15, .5, 1.1); look({ l: [160, 98.5, 86, 114], r: [296, 100.5, 50, 77, -4], m: [235.5, 144, 39.5, 16, -1], bar: 1 })(g); },
  glare2: g => { glow(g, 136, 151.5, 297, 1.05, .3, .6); look({ l: [160, 158, 88, 127], r: [300, 130.5, 52, 97], m: [226.5, 202, 58, 16, -4], bar: 1 })(g); },
  near: look({ c: [[209, 126, 42, { half: 33, end: .53 }], [118, 118, 143, { half: 34, len: 160, lum: .7, end: .68 }]],
    l: [93.5, 163, 59, 110, -2], r: [236.5, 170, 70, 104, 1.5], m: [161, 216, 32, 12], bar: 1 }),
  far: look({ c: [[159, 145, 148, { half: 33, len: 185, lum: .9, end: .55 }]], l: [42, 125, 29.5, 85, -1], r: [129.5, 169, 57, 97, -2], m: [77.5, 190, 29.5, 14, 1.5], bar: 1 }),
  farShut: g => { lid(g, 39, 160, 34, 3, 4, { rim: 6, tilt: 55 }); E(g, [77.5, 190, 29.5, 14, 1.5]); lid(g, 122, 211, 44, 4, 6, { tilt: 25 }); },
  farGlow: g => {
    halo(g, 6, () => lid(g, 39, 154, 42, 7, 9, { tilt: 52 })); E(g, [77.5, 190, 29.5, 14, 1.5]);
    halo(g, 6, () => eye(g, 130, 205, { w: 66, h: 36, tilt: 21, lidTop: .22 }));
  },
  farScare: look({ c: [[137, 206, 158, { half: 13, len: 120, end: 0 }], [151, 192, 187, { half: 18, len: 80, end: .19 }]],
    l: [45, 139.5, 29, 80.5, -9], r: [149.5, 183, 69.5, 82.5, -1], m: [89, 197, 37.5, 16, -2], bar: 1 }),
  smear: g => { taper(g, 40, 128, 16, 115, 172, 12, -6); taper(g, 55, 165, 8, 110, 178, 12, 4); taper(g, 105, 205, 12, 308, 176, 16, 6); taper(g, 140, 205, 24, 215, 200, 24); },
  squint, squint2,
  skeptic: g => skeptic(g, 103, 71),
  skeptic2: g => skeptic(g, 94, 66.5),
  skeptic3: g => skeptic(g, 89, 62, true),
  skeptic4: g => skeptic(g, 97, 67),
  twitch: g => {
    cone(g, 128, 120, 164, { half: 22, soft: 15, len: 160, end: .4 }); cone(g, 233, 99, 11, { half: 29, len: 185, end: .33 });
    look({ l: [89, 138, 73, 64, 5], r: [270, 120.5, 68, 102, 2], m: [182, 154, 56, 20.5, -9] })(g); spark(g, 139, 100.5, 0); spark(g, 222, 72, -8);
  },
  shout: g => {
    look({ c: [[106, 115, 144, { half: 26, len: 175, lum: .9, end: .42 }], [235, 99, 25.5, { half: 30, len: 200, lum: .92, end: .47 }]],
      l: [87.5, 148, 77, 71.5, 2], r: [273.5, 136, 81.5, 110, 4.5], m: [180, 176, 68, 52.5, -3.5], bar: 1 })(g);
    spark(g, 141, 108.5, 6); spark(g, 224, 84, 3);
  },
  scared: g => scared(g),
  angry: g => scared(g, 5),
  angryGlow: g => { both(g, () => cone(g, 78, 156, 120, { half: 48, len: 80, end: 0 })); scared(g, 12); },
  pop: g => { beams(g, { tilt: -7, half: 38, len: 215 }); eyes(g, { w: 79, h: 121, tilt: -4 }, 88, 131); eye(g, CX, 186, { w: 81, h: 40 }); },
  stretch: g => { beams(g); eyes(g, { w: 71, h: 109, tilt: -1 }, L + .5, 112.5); smile(g, CX, 160.5); },
  winkLid: g => { cone(g, 122, 107, 165.5, { half: 22, len: 155, end: .36 }); cone(g, 238, Y, 0); eye(g, L, Y, { lidTop: .3 }); eye(g, 2 * CX - L, Y); smile(g); },
  wink: g => { cone(g, 238, Y, 0); lid(g, ...WINK); eye(g, 2 * CX - L, Y); smile(g); },
  wink2: g => { cone(g, 238, Y, 0); eye(g, 84.5, 159, { w: 72, h: 27, tilt: 1, lidTop: .3 }); eye(g, 2 * CX - L, Y, { lidTop: .1 }); smile(g); },
  wink3: g => { lowCone(g); cone(g, 237, 102, 14, { half: 24, len: 170 }); halfEye(g); eye(g, 2 * CX - L, 116, { lidTop: .2 }); smile(g); },
  winkR: g => { cone(g, 122, Y, 180); eye(g, L, Y); flip(g, () => lid(g, ...WINK)); smile(g); },
  winkR2: g => { cone(g, 122, Y, 180); eye(g, L, Y); flip(g, () => lid(g, ...BLINK2)); smile(g); },
  winkR3: g => { cone(g, 122, Y, 180); eye(g, L, Y); flip(g, () => { lowCone(g); halfEye(g); }); smile(g); },
  halfShut: g => { both(g, () => { lowCone(g); halfEye(g); }); smile(g); },
  slide: g => { // the beams swing 5 degrees further than the face turns; the left one is cut short by the edge
    cone(g, L + 37, Y, 175, { len: 140 }); cone(g, 2 * CX - L - 37, Y, -5, { soft: 39, len: 220 }); restFace(g); },
  flash: g => { glow(g, 44, 105, 130, 1.37, .29, 1.1); at(g, { x: 10 }, () => { eyes(g, { w: 146, h: 110 }, 84, 107); smile(g, CX, 152, { w: 78, dip: 6, width: 16 }); }); },
  dim: g => { tone(g, 43, () => eyes(g)); smile(g); },
  dimShut: g => { tone(g, 43, () => eyes(g, { w: 77, h: 24, lidTop: .1 }, L - 1, 154)); smile(g); },
  dimHalf: g => { tone(g, 113, () => eyes(g, { w: 81, h: 40, lidTop: .08, tilt: 3 }, L, 147)); smile(g); },
  bright: g => { tone(g, 183, () => eyes(g)); smile(g); },
  low: g => { shut(g, 85, 162, 72, 7.5, 7); lid(g, CX, 168, 56, 9, 5, { rim: 9 }); },
  squash: g => { eyes(g, { w: 71.5, h: 80, tilt: -2 }, 83.5, 133); smile(g, CX, 163, { w: 55, dip: 9, width: 9 }); },
  stretch2: g => { eyes(g, { w: 71, h: 107, tilt: -1.5 }, 84, 113); smile(g, CX - 1, 159.5, { w: 55, dip: 10, width: 9 }); },
};

// Timing: [first video frame, pose, whole-face transform]. Frame = floor(t * 24) as a video element shows it.
const T = (x, y, rot = 0, s = 1) => ({ x, y, rot, s });
const SLIDE = [[335, T(-3.6, .5, -.75)], [337, T(-15, -.3, -2.75)], [339, T(-24.7, 1.5, -4.4)], [341, T(-27.5, 1.8, -5.1)], [344, T(-28.6, 2.2, -5.3)], [347, T(-29.3, 2.6, -5.3)]];
const DIM = T(30.3, -6, 2.6), [A, B, C] = [T(-7, 0, 3.5), T(-8, 2, 3.5), T(-12, 3, 4)]; // the scared face shivering
const TIMING = [
  [0, 'rest'], [6, 'lidded'], [7, 'blink'], [9, 'blink2'], [12, 'beams'],
  [35, 'droop'], [36, 'sad'], [38, 'sad', T(0, 2)], [41, 'gasp'], [43, 'gasp2'], [48, 'gaspShut'], [49, 'gaspShut2'], [52, 'gasp2'],
  [65, 'gasp2', T(3, 0)], [68, 'turn'], [71, 'turn2'], [74, 'turn3'], [76, 'tip1'], [78, 'tip2'], [80, 'tip3'],
  [82, 'up'], [85, 'up', T(-2, -2.5)], [99, 'up', T(3, 0)], [101, 'up', T(12, 11)],
  [103, 'glare'], [104, 'glare2'], [105, 'near'], [107, 'far', T(32, -1, -4, 1.17)], [110, 'far', T(3, 4)], [113, 'far'],
  [126, 'farShut'], [128, 'farGlow'], [129, 'far'],
  [159, 'farScare'], [161, 'smear'], [162, 'squint', T(-1.5, 0, 3)], [164, 'squint2', T(1, 0, 2.5)], [166, 'beams'],
  [189, 'droopGlow'], [190, 'sad'], [192, 'sad', T(0, 2)], [195, 'skeptic'], [197, 'skeptic2'], [199, 'skeptic3'],
  [217, 'skeptic4'], [219, 'twitch'], [221, 'shout'],
  [222, 'scared', T(-5, -7, 2)], [224, 'scared', A], [226, 'scared', B], [228, 'scared', A],
  [230, 'scared', B], [238, 'scared', C], [240, 'scared', B], [242, 'scared', C],
  [247, 'angry', T(-6, -3.5, 3.5)], [248, 'angryGlow', T(-6, -3.5, 3.5)], [249, 'pop'], [250, 'stretch'], [252, 'beams'],
  [277, 'winkLid'], [278, 'wink'], [290, 'wink2'], [291, 'wink3'], [292, 'winkR'], [294, 'winkR2'], [303, 'winkR3'], [304, 'beams'],
  [313, 'blink2'], [314, 'halfShut'], [315, 'beams'], [318, 'blink2'], [320, 'halfShut'], [321, 'beams'],
  ...SLIDE.map(([f, t]) => [f, 'slide', t]),
  [355, 'flash'], [356, 'dim', T(51.5, -7.3, 3.9)], [357, 'dim', T(40.5, -3.5, 2.9)], [358, 'dim', DIM], [368, 'dimShut', DIM],
  [370, 'dimHalf', DIM], [371, 'bright', DIM], [372, 'rest', DIM], [391, 'rest', T(29, 0, 1.9)], [392, 'low', T(13, 5, -2)],
  [394, 'squash'], [395, 'stretch2'], [397, 'rest'],
];

export function draw(ctx, t, o = {}) {
  const g = begin(ctx), c = g.canvas, f = Math.floor(clamp(t, 0, DURATION) * 24 + 1e-3);
  light = clamp(o.intensity ?? 1, 0, 1); px = Math.min(c.width / 360, c.height / 234) || 1;
  let key = TIMING[0]; for (const k of TIMING) if (f >= k[0]) key = k;
  g.translate((o.gazeX || 0) * 12, 0);
  at(g, key[2], () => POSES[key[1]](g));
}
