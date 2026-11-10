import test from 'node:test';
import assert from 'node:assert/strict';
import { faceTarget, FACE_MOODS } from '../app/web/kin/eyes.js';
import { FACES } from '../app/web/kin/jp01.js';
import { readFileSync } from 'node:fs';
import { STYLES, tint, fromPack } from '../app/web/kin/styles.js';
const BENDER = fromPack(JSON.parse(readFileSync(new URL('../avatar-packs/bender/looks/screen.json', import.meta.url))).style);

// A canvas stand-in that fails on any non-finite number.
const fakeCtx = (width, height) => new Proxy({ canvas: { width, height } }, {
  get(o, k) { if (k in o) return o[k]; return (...a) => { for (const v of a) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${String(k)} got ${v}`); return { addColorStop() {} }; }; },
  set(o, k, v) { o[k] = v; return true; },
});

test('every character style draws every mood, talking or not, on square and wide screens', () => {
  for (const id of Object.keys(STYLES)) for (const mood of FACE_MOODS) for (const [w, h] of [[1024, 1024], [1024, 640]]) for (const jaw of [0, 1]) {
    const v = { faceMood: FACE_MOODS.indexOf(mood) / (FACE_MOODS.length - 1), jaw, aa: jaw };
    const col = FACES['style:' + id].paint(fakeCtx(w, h), faceTarget(v, 1), jaw, { t: 1, v, layout: { scale: 1.55, spread: .8 } });
    assert.equal(col.length, 3, `${id} ${mood}`);
  }
});

test("a character's colour shows at rest, and strong mood colours still come through", () => {
  const rest = faceTarget({}, 1), love = faceTarget({ faceMood: FACE_MOODS.indexOf('love') / (FACE_MOODS.length - 1) }, 1);
  assert.ok(tint(rest, BENDER)[2] < 210, 'Bender is yellow at rest');
  const [r, g] = tint(love, BENDER); assert.ok(r - g > 40, 'love stays pink on Bender');
  assert.deepEqual(tint(rest, STYLES.mochi), [rest.red, rest.green, rest.blue], 'Mochi keeps the engine colours');
});
