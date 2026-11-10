import test from 'node:test';
import assert from 'node:assert/strict';
import { TruthBody, JOINTS, BASES, MOVES, BONES } from '../app/web/truth-pose.js';

const J = n => JOINTS.indexOf(n), at = (p, n) => [p[J(n) * 3], p[J(n) * 3 + 1], p[J(n) * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('Truth kneels by default and every move keeps limbs whole and joints above the floor', () => {
  const body = new TruthBody(), rest = body.target({}, 0);
  assert.equal(body.base, 'kneel');
  assert.ok(at(rest, 'knL')[1] > .6, 'one knee is up');
  for (const base of Object.keys(BASES)) for (const name of Object.keys(MOVES).filter(m => !MOVES[m].base)) {
    const b = new TruthBody(); b.play(base, 0); b.play(name, 0);
    for (let t = 0; t < MOVES[name].dur; t += .1) {
      const p = b.target({ hand: .5, lean: .3, roll: .2 }, t);
      assert.ok(p.every(Number.isFinite), `${base} ${name}`);
      for (const [a, c, len] of BONES) { const d = dist(at(p, a), at(p, c)); assert.ok(Math.abs(d - len) < 1e-4, `${base} ${name} t${t.toFixed(1)} ${a}-${c} ${d.toFixed(2)}`); }
      for (const j of JOINTS.slice(0, 17)) assert.ok(at(p, j)[1] > -.02, `${base} ${name} ${j} under the floor`);
    }
  }
});

test('Truth claps while kneeling: the hands meet in front of the chest', () => {
  const b = new TruthBody(); b.play('clap', 0);
  const gaps = [];
  for (let t = .5; t < 2.5; t += .02) { const p = b.target({}, t); gaps.push(dist(at(p, 'wrL'), at(p, 'wrR'))); }
  assert.ok(Math.min(...gaps) < .14 && Math.max(...gaps) > .3, 'hands open and close');
  assert.ok(at(b.target({}, 1), 'knL')[1] > .6, 'still kneeling');
});

test('stand and sit are visits: Truth settles back into the kneel', () => {
  const b = new TruthBody(); b.play('stand', 0);
  assert.ok(at(b.target({}, 1), 'pelvis')[1] > .8, 'standing');
  assert.ok(at(b.target({}, MOVES.stand.dur + .1), 'pelvis')[1] < .4, 'back down');
  assert.equal(b.base, 'kneel');
  let p; for (let i = 0; i < 300; i++) p = b.step({}, 20 + i / 60, 1 / 60);
  assert.ok(p.every(Number.isFinite));
});
