import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelFace } from '../app/web/kin/panel.js';

// JP01's face with no browser: the control state in, the real panel's pixels out.
const lit = (rgb, y0 = 0, y1 = 64) => { const out = []; for (let y = y0; y < y1; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 3; if (Math.max(rgb[i], rgb[i + 1], rgb[i + 2]) > 60) out.push([x, y, rgb[i], rgb[i + 1], rgb[i + 2]]); } return out; };
const rows = pts => new Set(pts.map(p => p[1])).size;
// Run the face from `from` to `to` seconds at 30 frames a second, the same state throughout; the last frame.
const run = (panel, state, from, to) => { let f; for (let t = from; t <= to + 1e-9; t += 1 / 30) f = panel.frame(state, t); return f; };

test('the panel face wakes as the head firmware does, then rests with open eyes and a flat voice line', () => {
  const panel = new PanelFace(), first = panel.frame(null, 10);
  assert.equal(first.face.length, 64 * 64 * 3, 'the face is 64 x 64 pixels of red, green, blue');
  assert.equal(first.ring.length, 24 * 3, 'the ring is 24 LEDs');
  assert.equal(lit(first.face).length, 0, 'it starts dark: the first wake step');
  assert.ok(first.ring.every(v => v === 0), 'and so does the ring');
  const awake = run(panel, null, 10, 13);
  assert.ok(lit(awake.face, 8, 36).length > 300, 'two open eyes');
  assert.equal(rows(lit(awake.face, 38)), 2, 'a quiet voice line two LEDs thick');
  assert.ok(awake.ring.every((v, i) => v === awake.ring[i % 3]) && awake.ring[1] > 120, 'the ring glows evenly in the eye colour');
});

test('the panel face follows the control state: feeling, speech and reactions', () => {
  const panel = new PanelFace(), on = { emotion: 'neutral', reaction: '', reaction_seq: 0, gaze: [0, 0], speaking: false, jaw: 0 };
  run(panel, on, 0, 3);
  const love = lit(run(panel, { ...on, emotion: 'love' }, 3, 5).face, 8, 36).find(p => p[2] === 255);
  assert.deepEqual(love?.slice(2), [255, 163, 193], 'love turns the eyes pink');
  const quiet = run(panel, { ...on, jaw: 1 }, 5, 6), talking = run(panel, { ...on, speaking: true, jaw: 1 }, 6, 7);
  assert.equal(rows(lit(quiet.face, 38)), 2, 'a jaw value while not speaking moves nothing');
  assert.ok(rows(lit(talking.face, 38)) >= 6, 'speech makes the voice line swing');
  assert.ok(talking.ring[1] > quiet.ring[1], 'and the ring swells with it');
  const open = lit(run(panel, on, 7, 9).face, 8, 36).length;
  let least = open;
  for (let t = 9; t < 9.9; t += 1 / 30) least = Math.min(least, lit(panel.frame({ ...on, reaction: 'blink', reaction_seq: 4 }, t).face, 8, 36).length);
  assert.ok(least < open / 3, `a blink reaction closes the eyes (${least} of ${open} LEDs)`);
  assert.ok(lit(run(panel, { ...on, emotion: 'nonsense' }, 10, 11).face).length > 300, 'a feeling it does not know is shown as neutral');
});

test('a face with no look made for the panel is refused when the program starts', () => {
  assert.throws(() => new PanelFace({ face: 'mochi_lips' }), /no look made for the panel/);
  assert.ok(lit(run(new PanelFace({ face: 'matrix' }), null, 0, 3).face).length > 100, 'the firmware\'s own matrix face runs too');
});
