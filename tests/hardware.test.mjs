import test from 'node:test';
import assert from 'node:assert/strict';
import { HARDWARE, hardwareFor } from '../app/web/hardware.js';

test('simulated hardware streams match the real devices', () => {
  const size = (hw, id) => { const o = HARDWARE[hw].outputs.find(x => x.id === id); return [o.w, o.h]; };
  assert.deepEqual(size('jp01', 'face'), [64, 64], 'JP01: 64 x 64 LED panel');
  assert.deepEqual(size('jp01', 'ringL'), [24, 1], 'each side ring is one row of 24 pixels');
  assert.deepEqual(size('jp01', 'ringR'), [24, 1]);
  assert.deepEqual(size('mochi', 'face'), [256, 256], 'Mochi: 256 x 256 dense screen');
  assert.equal(hardwareFor({ rep: { preset: 'jp01' } }), 'jp01');
  assert.equal(hardwareFor({ rep: { preset: 'mochi' } }), 'mochi');
  assert.equal(hardwareFor({ rep: { preset: 'truth' } }), null, 'a screen-only character has no hardware stream');
});
