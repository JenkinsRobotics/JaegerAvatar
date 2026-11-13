import test from 'node:test';
import assert from 'node:assert/strict';
import { TruthBody, JOINTS, MOVES } from '../app/web/truth-pose.js';
// Bone lengths and the floor are checked for every move in app/test.mjs; this file checks what each pose means.

const J = n => JOINTS.indexOf(n), at = (p, n) => [p[J(n) * 3], p[J(n) * 3 + 1], p[J(n) * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const kneeUp = p => at(p, 'rightLowerLeg')[1] > .35 && at(p, 'leftLowerLeg')[1] < .15;

test('Truth kneels by default: the right knee up, the left leg folded under', () => {
  const body = new TruthBody();
  assert.equal(body.base, 'kneel');
  assert.ok(kneeUp(body.target({}, 0)));
});

test('Truth claps while kneeling: the hands meet in front of the chest', () => {
  const b = new TruthBody(); b.play('clap', 0);
  const gaps = [];
  for (let t = .5; t < 2.5; t += .02) { const p = b.target({}, t); gaps.push(dist(at(p, 'leftHand'), at(p, 'rightHand'))); }
  assert.ok(Math.min(...gaps) < .06 && Math.max(...gaps) > .1, `hands open and close: ${Math.min(...gaps).toFixed(3)} to ${Math.max(...gaps).toFixed(3)}`);
  assert.ok(kneeUp(b.target({}, 1)), 'still kneeling');
});

test('stand and sit are visits: Truth settles back into the kneel', () => {
  const b = new TruthBody(); b.play('stand', 0);
  assert.ok(at(b.target({}, 1), 'hips')[1] > .8, 'standing');
  assert.ok(at(b.target({}, MOVES.stand.dur + .1), 'hips')[1] < .4, 'back down');
  assert.equal(b.base, 'kneel');
  let p; for (let i = 0; i < 300; i++) p = b.step({}, 20 + i / 60, 1 / 60);
  assert.ok(p.every(Number.isFinite));
});
