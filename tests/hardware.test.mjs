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

import { frameFor } from '../app/web/hardware.js';
import { panel } from '../app/web/kin/jp01.js';
test('a face with a look made for the panel is streamed as that look, not as the big screen shrunk', () => {
  const P = panel(); P.set(3, 2, [10, 20, 30]);
  const face = HARDWARE.jp01.outputs[0], made = frameFor(face, { stage: { nativeFace: () => P } });
  assert.equal(made.standIn, false);
  assert.equal(made.data.length, 64 * 64 * 4);
  assert.deepEqual([...made.data.slice((2 * 64 + 3) * 4, (2 * 64 + 3) * 4 + 4)], [10, 20, 30, 255]);
  assert.deepEqual([...made.data.slice(0, 4)], [0, 0, 0, 255], 'an unlit LED is black, and every pixel is opaque');
  assert.equal(frameFor(face, { stage: {} }), null, 'no screen and no look: nothing to send');
  assert.equal(frameFor(HARDWARE.mochi.outputs[0], { stage: { nativeFace: () => P } }), null, 'a 64 x 64 look is not sent to a 256 x 256 screen');
});

import { publish, serverReads } from '../app/web/hardware.js';
test('frames for an output a robot is reading are posted to the server, one at a time, until it stops reading', async () => {
  const posts = [], tick = () => new Promise(r => setTimeout(r));
  globalThis.BroadcastChannel = class { postMessage() {} };
  globalThis.fetch = async (url, init) => { posts.push([url, init.body.length]); return { json: async () => ({ wanted: posts.length < 2 }) }; };
  const jp01 = { rep: { preset: 'jp01' }, label: 'JP01' }, face = { stage: { rings: Array.from({ length: 48 }, () => ({ material: { color: { r: 1, g: .5, b: 0 } } })) } };
  publish(jp01, face);
  assert.equal(posts.length, 0, 'nobody is reading: nothing is made or sent');
  serverReads(['jp01/ringL']);
  publish(jp01, face); publish(jp01, face);   // the second comes while the first is still on its way: dropped, not queued
  assert.deepEqual(posts, [['/hardware/frame/jp01/ringL?w=24&h=1', 96]]);
  await tick(); publish(jp01, face); await tick();
  assert.equal(posts.length, 2);
  publish(jp01, face);                         // the server answered that nobody reads it any more
  assert.equal(posts.length, 2);
});
