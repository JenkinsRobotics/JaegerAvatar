// A character's locked screen look must draw exactly what was approved, on every robot and every app version.
// Each pack's looks/screen.json stores a fingerprint of every drawing call for each mood, reaction and mouth
// shape. Any change to the look, the renderer or the expression engine fails here. To approve a change on
// purpose, bump the pack's version and rerun with UPDATE_LOOKS=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { faceTarget, FACE_MOODS, REACTIONS } from '../app/web/kin/eyes.js';
import { RENDERER, fromPack, styledFace } from '../app/web/kin/styles.js';

const PACKS = new URL('../avatar-packs/', import.meta.url);
const DISPLAYS = { square: [1024, 1024, { scale: 1.55, spread: .8 }], wide: [1024, 640, {}] };
const R = Object.keys(REACTIONS), mood = m => FACE_MOODS.indexOf(m) / (FACE_MOODS.length - 1);
const FRAMES = {
  ...Object.fromEntries(FACE_MOODS.map(m => [m, { faceMood: mood(m) }])),
  wink: { faceReaction: (R.indexOf('wink') + 1) / R.length, faceProgress: .5 },
  'talk aa': { aa: .9, jaw: .8 }, 'talk ee': { faceMood: mood('joy'), ee: .9, jaw: .5 }, 'talk ou': { ou: .9, jaw: .4 },
};

// Logs every call and property set on a fake canvas, numbers rounded so float noise doesn't count.
function fingerprint(paint, [w, h]) {
  const log = [], val = a => typeof a === 'number' ? Math.round(a * 10) / 10 : a;
  const ctx = new Proxy({ canvas: { width: w, height: h } }, {
    get(o, k) { if (k in o) return o[k]; return (...a) => { log.push(`${String(k)}(${a.map(val)})`); return { addColorStop() {} }; }; },
    set(o, k, v) { o[k] = v; log.push(`${String(k)}=${val(v)}`); return true; },
  });
  paint(ctx);
  return createHash('sha256').update(log.join(';')).digest('hex').slice(0, 20);
}

const looks = readdirSync(PACKS).map(id => [id, new URL(`${id}/looks/screen.json`, PACKS)]).filter(([, f]) => existsSync(f));

test('every pack screen look draws exactly what was approved', () => {
  assert.ok(looks.some(([id]) => id === 'bender'), "Bender's look is locked in his pack");
  for (const [id, file] of looks) {
    const look = JSON.parse(readFileSync(file, 'utf8')), face = styledFace(fromPack(look.style, id)), frames = {};
    assert.equal(look.renderer, RENDERER, `${id} asks for a renderer this app draws`);
    for (const display of look.displays) for (const [name, v] of Object.entries(FRAMES)) {
      const [w, h, layout] = DISPLAYS[display];
      frames[`${display}/${name}`] = fingerprint(ctx => face.paint(ctx, faceTarget(v, 2), v.jaw || 0, { t: 2, v, layout }), [w, h]);
    }
    if (process.env.UPDATE_LOOKS) { writeFileSync(file, JSON.stringify({ ...look, frames }, null, 2) + '\n'); continue; }
    assert.deepEqual(look.frames, frames, `${id}'s screen look changed. If that's intended, bump the pack version and rerun with UPDATE_LOOKS=1`);
    assert.equal(new Set(Object.values(frames)).size, Object.keys(frames).length, `${id}: every frame looks different`);
  }
});
