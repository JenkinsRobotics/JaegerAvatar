import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_MOODS, faceTarget, drawFace } from '../app/web/kin/eyes.js';

// Records where each eye is centred, in canvas pixels, by tracking translate/scale.
function recorder(W, H) {
  let m = [1, 0, 0, 1, 0, 0]; const stack = [], eyes = [];
  const ctx = new Proxy({ canvas: { width: W, height: H } }, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'save') return () => stack.push([...m]);
      if (k === 'restore') return () => { m = stack.pop(); };
      if (k === 'translate') return (x, y) => { m[4] += m[0] * x; m[5] += m[3] * y; };
      if (k === 'scale') return (x, y) => { m[0] *= x; m[3] *= y; };
      if (k === 'fill') return () => { if (o.shadowBlur === 17) eyes.push([m[4], m[5], m[0]]); }; // the glowing eye fill
      return () => ({ addColorStop() {} });
    },
    set(o, k, v) { o[k] = v; return true; },
  });
  return { ctx, eyes };
}

test('JP01 square layout keeps every mood on the screen', () => {
  for (const mood of FACE_MOODS) {
    const p = faceTarget({ faceMood: FACE_MOODS.indexOf(mood) / (FACE_MOODS.length - 1) }, 2);
    const { ctx, eyes } = recorder(1024, 1024);
    drawFace(ctx, p, 2, { scale: 1.55, spread: .8 });
    assert.ok(eyes.length >= 2, mood);
    for (const [x, y, s] of eyes) {
      assert.equal(s, 1.55, mood);
      const halfW = p.width * 1.1 * s;
      assert.ok(x - halfW > 0 && x + halfW < 1024 && y > 150 && y < 874, `${mood} eye at ${x},${y}`);
    }
  }
});

test('the default layout is unchanged for the 1024x640 Momo screen', () => {
  const { ctx, eyes } = recorder(1024, 640);
  const p = faceTarget({}, 2);
  drawFace(ctx, p, 2);
  assert.deepEqual(eyes.map(([x, y]) => [Math.round(x - p.x), Math.round(y - p.y)]), [[512 - p.spread, 288], [512 + p.spread, 288]].map(a => a.map(Math.round)));
});

test('negative or missing clock times do not crash the eye performance', () => {
  for (const t of [-1, -0.01, NaN]) assert.doesNotThrow(() => faceTarget({}, t));
});

import { WAKE, wakeFace, ringLevels, matrixFace, tFace, FACES } from '../app/web/kin/jp01.js';
const rest = { width: 81, height: 105, x: 0, y: 0, blinkL: 0, blinkR: 0, curve: 0 };
const litBox = P => { const xs = [], ys = []; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (P.lit(x, y)) { xs.push(x); ys.push(y); } return xs.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : null; };

test('JP01 wakes in the firmware steps: blank, growing line, line, opening, open', () => {
  const at = a => wakeFace(rest, a), S = WAKE / 5;
  assert.equal(at(S * .5).width, 0);
  assert.ok(at(S * 1.5).width > 0 && at(S * 1.5).width < 81 && at(S * 1.5).height < 15);
  assert.equal(at(S * 2.5).width, 81); assert.ok(at(S * 2.5).height < 15);
  assert.ok(at(S * 3.5).height > 15 && at(S * 3.5).height < 105);
  assert.equal(at(S * 4.5).height, 105); assert.equal(wakeFace(rest, null), rest);
  const half = ringLevels(S * 1.5, 0); assert.ok(half[0] === 1 && half[23] === 0, 'the ring fills one LED at a time');
  assert.ok(ringLevels(S * 2.5, 0).every(l => l === 1), 'and is full by the line stage, as on the real head');
});

test('matrix eyes match the firmware: 20x20 at x 18 and 46, y 32', () => {
  const box = litBox(matrixFace(rest));
  assert.deepEqual(box, [8, 55, 22, 41]);
  assert.equal(litBox(matrixFace({ ...rest, width: 0, height: 0 })), null, 'blank during wake step 0');
});

test('T-face fills the panel when awake and is dark before the wake', () => {
  assert.deepEqual(litBox(tFace(rest)), [0, 63, 0, 63]);
  assert.equal(litBox(tFace({ ...rest, width: 0 })), null);
  for (const k of ['matrix', 'tface', 'ring']) assert.equal(typeof FACES[k].paint, 'function');
});

import { EMOTES, emoteFor, emoteShapes } from '../app/web/kin/jp01.js';
test('neon emotes follow the mood and each one stays on the screen', () => {
  assert.equal(emoteFor('love'), 'heart'); assert.equal(emoteFor('surprised'), 'wow'); assert.equal(emoteFor('angry'), 'dx');
  assert.equal(emoteFor('shy'), 'uwu'); assert.equal(emoteFor('neutral'), 'smile'); assert.equal(emoteFor('neutral', 'heart'), 'heart');
  for (const name of Object.keys(EMOTES)) for (const jaw of [0, 1]) {
    const { lines, fills } = emoteShapes(rest, jaw, name, 1), pts = [...lines, ...fills].flat();
    assert.ok(pts.length > 4, name);
    for (const [x, y] of pts) assert.ok(x > 3 && x < 61 && y > 8 && y < 60 && Number.isFinite(x + y), `${name} point ${x},${y}`);
  }
  const dark = emoteShapes({ ...rest, width: 0 }, 0, 'heart'); assert.equal(dark.lines.length + dark.fills.length, 0, 'dark before the wake');
});

import { mouthShape, FACE_CHOICES } from '../app/web/kin/jp01.js';
test('Mochi eyes + mouth lip syncs with the five vowel shapes', () => {
  assert.equal(mouthShape({}, 0).open, 0, 'closed (the resting smile) when quiet');
  assert.equal(mouthShape({ aa: 1 }).open, 1);
  assert.ok(mouthShape({ ee: 1 }).width > mouthShape({ ou: 1 }).width, 'ee spreads, ou puckers');
  assert.ok(mouthShape({ oh: 1 }).open > mouthShape({ ih: 1 }).open);
  for (const [style] of FACE_CHOICES) assert.ok(style === '' || FACES[style], `picker face ${style} exists`);
});

import { waveLine } from '../app/web/kin/jp01.js';
test('the waveform mouth is nearly flat when quiet and ripples when talking', () => {
  const peak = pts => Math.max(...pts.map(([, y]) => Math.abs(y)));
  assert.ok(peak(waveLine({}, 0, 1)) < .05);
  assert.ok(peak(waveLine({ aa: 1 }, 0, 1)) > .4);
  for (const [x, y] of waveLine({ ee: 1, aa: 1 }, 0, 2)) assert.ok(Number.isFinite(x + y) && Math.abs(x) <= .85);
});
