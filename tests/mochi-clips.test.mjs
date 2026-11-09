import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, DURATION } from '../app/web/performances/mochi-scenes.js';

// A canvas stand-in that fails on any image/video input or non-finite geometry.
function fakeCtx() {
  const stub = { addColorStop() {} };
  return new Proxy({ canvas: { width: 1024, height: 640 }, globalAlpha: 1 }, {
    get(o, k) {
      if (k in o) return o[k];
      assert.ok(!['drawImage', 'putImageData', 'createPattern'].includes(k), `uses ${String(k)}`);
      return (...args) => { for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${String(k)} got ${v}`); return stub; };
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}

test('all ten Classic clips are registered with titles', () => {
  assert.deepEqual(Object.keys(CLIPS).sort(), ['0_0', '0_1', '1_0', '1_1', '2_0', '2_1', '3_0', '3_1', '4_0', '4_1'].map(c => 'cell_' + c));
  for (const [id, c] of Object.entries(CLIPS)) { assert.equal(typeof c.draw, 'function', id); assert.ok(c.title, id); }
});

test('every clip draws finite procedural geometry at every frame, with any options', () => {
  for (const [id, c] of Object.entries(CLIPS))
    for (const o of [{}, { intensity: 0, gazeX: -1 }, { intensity: 1.5, gazeX: 1 }])
      for (let t = -1; t <= DURATION + 1; t += 1 / 24) {
        const ctx = fakeCtx();
        assert.doesNotThrow(() => c.draw(ctx, t, o), `${id} at ${t.toFixed(2)}`);
      }
});
