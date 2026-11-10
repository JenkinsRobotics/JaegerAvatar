import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsOf } from '../app/web/controls.js';

test('declared controls win and gaps fall back', () => {
  const c = controlsOf({ controls: { actions: ['clap'] } }, { led: false, moves: ['wave'], poses: [] });
  assert.deepEqual(c.actions, ['clap']);
  assert.equal(c.emotions.length, 16);
  assert.deepEqual(c.reactions, []);
  assert.ok(controlsOf({}, { led: true, moves: ['wave'], poses: [] }).reactions.includes('wink'));
  assert.deepEqual(controlsOf({}, { led: false, moves: ['wave'], poses: ['kneel', 'clap'] }).actions, ['kneel', 'clap']);
  assert.deepEqual(controlsOf({}, { led: false, moves: ['wave'], poses: [] }).actions, ['wave']);
});
