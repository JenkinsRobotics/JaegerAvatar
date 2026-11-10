import test from 'node:test';
import assert from 'node:assert/strict';
import { changes } from '../app/web/control-link.js';

const REST = { attached: true, session: 's', seq: 0, emotion: 'neutral', reaction: '', reaction_seq: 0, act: '', act_seq: 0, gaze: [0, 0], speak: null, speak_seq: 0, speaking: false, stop_seq: 0 };
const at = o => ({ ...REST, ...o });
const SPEAK = { clip: '/control/audio/abc', duration_ms: 900, marks: [[0.1, 0.15, 'p']], text: 'Mom' };

test('first state only reports what is set', () => {
  assert.deepEqual(changes(null, at({ seq: 1, emotion: 'joy' })), [{ kind: 'feel', value: 'joy' }]);
  assert.deepEqual(changes(null, REST), []);
});

test('seq increases fire once', () => {
  const a = at({ seq: 1, act: 'wave', act_seq: 1 }), b = at({ seq: 2, act: 'wave', act_seq: 2 });
  assert.deepEqual(changes(a, b), [{ kind: 'act', value: 'wave' }]);
  assert.deepEqual(changes(b, b), []);
  assert.deepEqual(changes(at({ seq: 1, reaction: 'wink', reaction_seq: 1 }), at({ seq: 2, reaction: 'wink', reaction_seq: 2 })), [{ kind: 'react', value: 'wink' }]);
});

test('a new session starts clean', () => {
  const a = at({ seq: 1, act: 'wave', act_seq: 1 });
  assert.deepEqual(changes(a, { ...a, session: 't' }), [{ kind: 'act', value: 'wave' }]);
});

test('speak carries its value', () => {
  assert.deepEqual(changes(REST, at({ seq: 1, speak: SPEAK, speak_seq: 1, speaking: true })), [{ kind: 'speak', value: SPEAK }]);
});

test('look fires past a small threshold, stop fires once at rest', () => {
  assert.deepEqual(changes(REST, at({ seq: 1, gaze: [0.005, 0] })), []);
  assert.deepEqual(changes(REST, at({ seq: 1, gaze: [0.5, -0.2] })), [{ kind: 'look', value: [0.5, -0.2] }]);
  const busy = at({ seq: 3, emotion: 'joy', speak: SPEAK, speak_seq: 2, speaking: true });
  assert.deepEqual(changes(busy, at({ seq: 4, stop_seq: 4 })), [{ kind: 'stop', value: null }]);
  assert.deepEqual(changes(at({ seq: 1, emotion: 'joy' }), at({ seq: 2 })), [{ kind: 'feel', value: 'neutral' }]);   // told to look neutral: not a stop
});

test('commands right after a stop still fire', () => {
  const busy = at({ seq: 3, emotion: 'angry', speak: SPEAK, speak_seq: 2, speaking: true });
  assert.deepEqual(changes(busy, at({ seq: 5, stop_seq: 4, emotion: 'joy', speak: SPEAK, speak_seq: 5, speaking: true })),
    [{ kind: 'stop', value: null }, { kind: 'feel', value: 'joy' }, { kind: 'speak', value: SPEAK }]);
});

test('expiry back to neutral is a feel, not a stop', () => {
  assert.deepEqual(changes(at({ seq: 1, emotion: 'joy' }), at({ seq: 1 })), [{ kind: 'feel', value: 'neutral' }]);
});
