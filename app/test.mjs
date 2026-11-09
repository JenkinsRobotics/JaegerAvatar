// node test.mjs — fails loudly if the audio->mouth mapping, the parser or the rig break.
import assert from 'node:assert';
import { analyze, synthVowel, synthVocal, synthSing, synthSpeech, sampleTrack, syllabify, melody, singOver } from './web/voice.js';
import { parse, Parser, scriptedReply, isIntro, reelFor } from './web/brain.js';
import { Rig, EMOTIONS } from './web/rig.js';
import { faceShapes, humanBone, MORPHS, ACTING } from './web/model-map.js';
import { Vad, isEcho, toPcm, FRAME, RATE } from './web/ears.js';
import { MOODS, REACTIONS, FaceAnimator, faceTarget, eyeContour } from './web/eyes.js';
import { MOVES, sampleMove, moveNow, flightHeight } from './web/motion.js';
import { faceToPuppet } from './web/plugins/webcam/index.js';
import { mouthFrom } from './web/plugins/lipsync.js';

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const vowel = v => { const t = analyze(synthVowel(v)); const m = k => mean([...t[k]].slice(10, 40)); return { open: m('open'), wide: m('wide'), round: m('round') }; };

// Mouth shapes come out of audio alone.
const a = vowel('a'), i = vowel('i'), u = vowel('u');
console.log({ a, i, u });
assert(a.open > i.open + 0.2 && a.open > u.open + 0.2, 'ah opens widest');
assert(i.wide > 0.5 && i.wide > u.wide + 0.3, 'ee is wide');
assert(u.round > 0.5 && u.round > i.round + 0.3, 'oo is round');

// Laugh bursts become separate emphasis events; silence closes the mouth.
for (let n = 0; n < 20; n++) {                    // the synth's breath noise is random, so try a few
  const bursts = synthVocal('laugh').track.emph.length;
  assert(bursts >= 5 && bursts <= 8, `laugh bursts ${bursts}`);
}
assert(sampleTrack(analyze(new Float32Array(22050)), 0.5).open < 0.01, 'silence is shut');

// Singing and speech fallback render with sane lengths.
const song = synthSing('la la la, tiny lights are glowing.');
assert(song.track.dur > 2 && song.beats.length > 3);
assert(synthSpeech('Hello there, how are you?').track.dur > 0.8);
assert.equal(syllabify('hello').length, 2);

// Artist models: any common rig's bones and morphs land on the right part of the face and skeleton.
for (const [name, want] of [['J_Bip_C_Head', 'head'], ['J_Bip_L_UpperArm', 'leftUpperArm'], ['J_Bip_R_LowerArm', 'rightLowerArm'], ['J_Bip_R_Thumb2', 'rightThumbProximal'], ['J_Adj_L_FaceEye', 'leftEye'], ['J_Sec_Hair1_01', null], ['J_Adj_L_FaceEyeSet', null],
  ['mixamorig:Hips', 'hips'], ['mixamorig:Spine2', 'upperChest'], ['mixamorig:LeftArm', 'leftUpperArm'], ['mixamorig:LeftForeArm', 'leftLowerArm'], ['mixamorig:RightHandIndex1', 'rightIndexProximal'], ['mixamorig:LeftHand', 'leftHand'], ['upper_arm.L', 'leftUpperArm'], ['mixamorig:HeadTop_End', null]]) assert.equal(humanBone(name), want, name);
assert(MORPHS.aa.test('Face.M_F00_000_00_Fcl_MTH_A') && !MORPHS.aa.test('Face.M_F00_000_00_Fcl_MTH_Angry') && MORPHS.ih.test('vrc.v_ih') && MORPHS.aa.test('jawOpen'), 'morph names');
const restFace = new Rig().out, face = (over, twos = false) => faceShapes({ ...restFace, smile: 0, ...over }, twos);
assert(face({ }).aa === 0 && face({ }).blinkL === 0, 'rest: mouth shut, eyes open');
assert(face({ jaw: 0.7 }).aa === 1 && face({ jaw: 0.7, round: 1 }).oh === 1 && face({ jaw: 0.1, round: 1 }).ou > 0.8, 'jaw and round pick the vowel');
assert(face({ lidL: 0 }).blinkR === 1 && face({ lidL: 0 }).blinkL === 0, "lidL is the viewer's left, the character's right eye");
assert.equal(face({ jaw: 0.33 }, true).aa, 0.42 / 0.7, 'on twos the jaw snaps to a drawn mouth shape');

// Every acting pose names a real anchor and full vectors; a live stream speaks its first clause early, a whole text doesn't.
for (const [emo, arms] of Object.entries(ACTING)) { assert(EMOTIONS[emo], emo); for (const A of Object.values(arms)) assert(['face', 'chest', 'hip', 'shoulder'].includes(A.at) && A.p.length === 3 && A.f.length === 3 && A.open >= 0 && A.open <= 1, emo); }
const live = new Parser({ clause: true });
assert.deepEqual([...live.push('[joy] Oh wow, that is '), ...live.push('great, truly. Yes, it is.'), ...live.flush()].map(o => o.text || o.name), ['joy', 'Oh wow,', 'that is great, truly.', 'Yes, it is.']);
assert.deepEqual(parse('Oh wow, that is great.').map(o => o.text), ['Oh wow, that is great.']);

// Parser: tags, sentences, song blocks, and split across stream chunks.
assert.deepEqual(parse('[joy] Hi there! [laugh] [sing] la la [/sing] [wink]').map(o => o.type), ['emotion', 'say', 'vocal', 'sing', 'gesture']);
assert.deepEqual(parse('[nonsense] Hi.').map(o => o.text), ['Hi.']);
const p = new Parser();
const ops = [...p.push('[jo'), ...p.push('y] First one. Sec'), ...p.push('ond [sa'), ...p.push('d] third'), ...p.flush()];
assert.deepEqual(ops.map(o => o.text || o.name), ['joy', 'First one.', 'Second', 'sad', 'third']);
// What a small model really writes: stray song tags, stage directions, emoji.
assert.deepEqual(parse('[excited] Yes!\n\n[singing] (To a bright melody)\nLittle robot glow! [/sing] [joy] Hope you liked it 😊').map(o => o.text || o.name), ['excited', 'Yes!', 'Little robot glow!', 'joy', 'Hope you liked it']);
assert.deepEqual(parse('[singing] [sing] la la. [/singing] [wave] hi').map(o => o.text || o.name), ['la la.', 'wave', 'hi']);
for (const q of ['hi', 'sing me a song', 'tell a joke', 'I am sad', 'random words here', 'why?']) assert(parse(scriptedReply(q)).length > 1, q);

// Rig settles on every pose, stays finite under punishment, returns to rest, and 60Hz costs well under a frame.
const r = new Rig();
for (const e of Object.keys(EMOTIONS)) {
  r.setEmotion(e); r.emphasis(1); r.gesture('gasp');
  for (let f = 0; f < 240; f++) r.tick(f % 7 ? 1 / 60 : 1 / 20);
  for (const [k, v] of Object.entries(r.out)) assert(Number.isFinite(v), `${e}.${k}`);
}
r.setEmotion('joy'); for (let f = 0; f < 180; f++) r.tick(1 / 60);
assert(Math.abs(r.x.smile - EMOTIONS.joy.smile) < 0.1, 'smile reached');
r.setEmotion('neutral'); for (let f = 0; f < 240; f++) r.tick(1 / 60);
assert(r.x.smile < 0.2, 'smile released');
// Skeleton: the chest follows the head later and less, so motion travels through the joints.
r.setEmotion('neutral'); r.fix = { x: 0, y: 0 }; r.nextFix = 1e9; r.kick('yaw', 6);
let lagged = 0;
for (let f = 0; f < 30; f++) { r.tick(1 / 60); if (Math.abs(r.out.chestYaw) < Math.abs(r.out.yaw) * 0.42) lagged++; for (const k of ['chestYaw', 'chestPitch', 'chestRoll', 'shL', 'shR', 'hipX', 'breath']) assert(Number.isFinite(r.out[k]), k); }
assert(lagged > 8, 'chest lags the head');
const t0 = performance.now(); for (let f = 0; f < 6000; f++) r.tick(1 / 60);
const us = (performance.now() - t0) / 6000 * 1000;
console.log(`rig tick ${us.toFixed(1)}us`);
assert(us < 1000);

// Real voice, when the server is running: "oo" words round the mouth, "ee" words widen it. Neural TTS breaks naive formant estimates.
const said = await fetch('http://localhost:8790/health').then(r => r.json()).catch(() => null);
if (said?.voice) {
  const mouth = async w => {
    const b = Buffer.from(await (await fetch('http://localhost:8790/say', { method: 'POST', body: JSON.stringify({ text: w }) })).arrayBuffer());
    const at = b.indexOf('data') + 8, t = analyze(Float32Array.from({ length: (b.length - at) >> 1 }, (_, i) => b.readInt16LE(at + i * 2) / 32768));
    const loud = [...t.energy.keys()].filter(i => t.energy[i] > 0.4), m = k => mean(loud.map(i => t[k][i]));
    return { wide: m('wide'), round: m('round') };
  };
  const shape = async ws => { const r = await Promise.all(ws.map(mouth)); return { wide: mean(r.map(x => x.wide)), round: mean(r.map(x => x.round)) }; };
  const oo = await shape(['moon', 'food', 'blue', 'two']), ee = await shape(['see', 'tree', 'he', 'eee']);
  console.log(said.voice, { oo, ee });
  assert(oo.round > oo.wide + 0.25, 'oo words round on the real voice');
  assert(ee.wide > ee.round + 0.4, 'ee words widen on the real voice');
} else console.log('server not running: skipped the real-voice mouth check');
console.log('ok');

// The mic: when speech starts and stops, and what isn't speech.
{
  const feed = (vad, level, seconds, strict) => {
    const out = [];
    for (let i = 0; i < seconds * RATE / FRAME; i++) { const r = vad.push(new Float32Array(FRAME).fill(level), strict); if (r) out.push(r); }
    return out;
  };
  let v = new Vad();
  assert.deepEqual(feed(v, 0.001, 1), [], 'a quiet room is not speech');
  assert.deepEqual(feed(v, 0.1, 0.09), [], 'a click is not speech');
  assert.deepEqual(feed(v, 0.001, 0.5), []);
  assert.deepEqual(feed(v, 0.1, 1), ['start']);
  assert.deepEqual(feed(v, 0.001, 0.3), [], 'a breath between words does not end it');
  assert.deepEqual(feed(v, 0.1, 0.5), []);
  assert.deepEqual(feed(v, 0.001, 1), ['pause', 'end']);
  assert(v.audio.length > RATE * 2 && v.audio[0] < 0.1, 'kept the audio from just before it started');
  v = new Vad();
  assert.deepEqual(feed(v, 0.02, 0.5, true), [], 'her voice leaking in does not count while she talks');
  assert.deepEqual(feed(v, 0.02, 0.5), ['start'], 'the same level is speech when she is quiet');
  v = new Vad();
  assert.deepEqual([...feed(v, 0.1, 0.18), ...feed(v, 0.001, 1)], ['start', 'pause', 'cancel'], 'too short to send');
  v = new Vad();
  assert.deepEqual(feed(v, 0.1, 21), ['start', 'end'], 'cut off at 20 seconds');
  assert.deepEqual(feed(v, 0.1, 2), [], 'a sound that never stops becomes the room');
  assert(isEcho('tiny little lights are glowing', '[sing] Tiny little lights are glowing, wires humming.'), 'her own words');
  assert(!isEcho('wait stop that is not what I meant', 'Tiny little lights are glowing, that is what I meant.'), 'a real interruption');
  assert(isEcho('', 'anything'), 'nothing heard');
  assert.equal(toPcm([2])[0], 32767, 'clipped, not wrapped');
}

// The display robots' eyes: every emotion settles, and any change can interrupt any other without a jump or a bad number.
{
  const moods = Object.keys(MOODS), names = Object.keys(REACTIONS);
  assert.equal(moods.length, 16);
  for (const emotion of moods) {
    const anim = new FaceAnimator();
    for (let i = 0; i < 180; i++) anim.update({ emotion }, 1 / 60, i / 60);
    const before = eyeContour(anim.values, 1);
    anim.update({ emotion }, 1 / 60, 3);
    assert(before.every(([x, y]) => Number.isFinite(x + y)), emotion);
    assert.equal(eyeContour(anim.values, -1).length, before.length, 'one outline for every shape');
  }
  const anim = new FaceAnimator();
  let reaction = null, emotion = 'neutral', prev = eyeContour(anim.values, 1), worst = 0, n = 7;
  const next = m => (n = (n * 16807) % 2147483647) % m;
  for (let i = 0; i < 3600; i++) {
    if (i % 7 === 0) emotion = moods[next(moods.length)];            // a new feeling every 0.12 s
    if (i % 11 === 0) reaction = { name: names[next(names.length)], age: 0 };   // and a reaction cut off every 0.18 s
    if (reaction) reaction.age += 1 / 60;
    const p = anim.update({ emotion, reaction, moodAge: 0.1 }, i % 100 ? 1 / 60 : 0.5, i / 60), now = eyeContour(p, 1);   // with a stalled tab every so often
    assert(Object.values(p).every(Number.isFinite), 'finite under interruption');
    if (i % 100 > 1) now.forEach(([x, y], k) => { worst = Math.max(worst, Math.hypot(x - prev[k][0], y - prev[k][1])); });
    prev = now;
  }
  console.log('largest eye outline jump in one frame', worst.toFixed(1), 'of 1024');
  assert(worst < 70, 'a shape changed too far in one frame');
  // A wink closes one eye; peekaboo opens them at different times; a cut-off reaction recovers.
  const at = (name, age) => faceTarget({ emotion: 'neutral', reaction: { name, age } }, 0);
  assert(at('wink', 0.6).blinkR > 0.9 && at('wink', 0.6).blinkL === 0, 'wink is one eye');
  assert(at('peek', 1.0).blinkL < at('peek', 1.0).blinkR, 'peekaboo: one eye opens first');
  assert(at('wink', 0.02).blinkR === 0, 'anticipation before the lid moves');
  for (const name of names) assert(at(name, REACTIONS[name]).blinkL < 0.01 && Math.abs(at(name, REACTIONS[name]).x) < 1, `${name} recovers`);
  // The rig runs a reaction out, and a new one replaces it.
  const rig = new Rig();
  rig.react('doze'); rig.react('wink'); assert.equal(rig.reaction.name, 'wink');
  for (let i = 0; i < 130; i++) rig.tick(1 / 60);
  assert.equal(rig.reaction, null, 'finished');
  assert(rig.out.blinkR !== undefined && rig.out.blinkL !== undefined);
}

// Full-body moves start and end in the resting stance, stay finite, and leave the floor only in a hop.
{
  for (const name of Object.keys(MOVES)) {
    const d = MOVES[name].duration;
    assert.equal(sampleMove(name, 0).weight, 0, name);
    assert(sampleMove(name, d).weight < 0.001, name);
    assert.equal(sampleMove(name, d + 1), null, name);
    for (let t = 0; t < d; t += 1 / 60) {
      const s = sampleMove(name, t);
      assert(Object.values(s.pose).every(Number.isFinite), `${name} at ${t}`);
      if (name !== 'hop') assert(!s.pose.lift, `${name} leaves the floor`);
    }
  }
  assert(Math.abs(sampleMove('spin', 3.5).pose.spin - Math.PI * 2) < 1e-6, 'a spin ends one full turn round');
  assert.equal(flightHeight(0.58), 0); assert(flightHeight(0.81) > 0.2);
  const rig = new Rig();
  rig.move('clap'); rig.move('spin'); assert.equal(rig.act.name, 'clap', 'a move plays out before another');
  for (let i = 0; i < 240; i++) rig.tick(1 / 60);
  assert.equal(rig.act, null);
  const ops = parse('[spin] Hi. [sideeye]').filter(o => o.type === 'gesture').map(o => o.name);
  assert.deepEqual(ops, ['spin', 'sideeye'], 'new tags parse as gestures');
}

// "Who are you" goes to the character sheet, and only when that's the whole question.
for (const t of ['who are you', 'Who are you?', 'Hey Vita, who are you?', "What's your name?", 'whats your name', 'introduce yourself', 'are you gemma?', 'tell me about yourself.']) assert(isIntro(t), t);
for (const t of ['who are you voting for', 'tell me a joke', "what's your name for this song", 'are you okay?', 'who is this song by']) assert(!isIntro(t), t);

// The webcam plugin: mirrored, with the signs measured against a rendered head, and it only ever needs numbers.
{
  const rot = (yaw, pitch, roll) => { const m = new Array(16).fill(0); m[0] = Math.cos(roll); m[1] = Math.sin(roll); m[8] = Math.sin(yaw); m[9] = -Math.sin(pitch); m[10] = Math.cos(pitch); return m; };
  const face = (shapes, m = rot(0, 0, 0)) => faceToPuppet({ faceBlendshapes: [{ categories: Object.entries(shapes).map(([categoryName, score]) => ({ categoryName, score })) }], facialTransformationMatrixes: [{ data: m }] });
  assert.equal(faceToPuppet({ faceBlendshapes: [] }), null, 'no face, no puppet');
  assert(face({ eyeBlinkLeft: 0.9 }).blinkL === 1 && face({ eyeBlinkLeft: 0.9 }).blinkR === 0);
  assert(face({ eyeBlinkLeft: 0.1 }).blinkL === 0, 'a resting lid reads open');
  assert(face({}, rot(0.4, 0, 0)).yaw < 0 && face({}, rot(0, 0.4, 0)).pitch < 0 && face({}, rot(0, 0, 0.4)).roll > 0);
  assert(face({ eyeLookOutLeft: 1 }).gazeX < 0);
  const rig = new Rig();
  rig.puppet = { ...face({ jawOpen: 0.5 }), yaw: 0.5 };
  for (let i = 0; i < 120; i++) rig.tick(1 / 60);
  assert(rig.out.yaw > 0.3 && rig.out.jaw > 0.3, 'the puppet drives the head and the mouth');
  rig.voice = { open: 0, wide: 0, round: 0, teeth: 0, pitch: 0, energy: 0.5 };
  for (let i = 0; i < 60; i++) rig.tick(1 / 60);
  assert(rig.out.jaw < 0.2, 'her voice takes the mouth back when she talks');
}

// Stopping a move fades it out, and a spin turns back the short way rather than unwinding.
{
  const late = moveNow({ name: 'spin', age: 2.2, stop: 0.5 }), early = moveNow({ name: 'spin', age: 1.0, stop: 0.5 });
  assert(late.weight < sampleMove('spin', 2.2).weight, 'fading out');
  assert(late.pose.spin > sampleMove('spin', 2.2).pose.spin, 'past halfway it finishes the turn');
  assert(early.pose.spin < sampleMove('spin', 1.0).pose.spin, 'before halfway it comes back');
  const rig = new Rig();
  rig.move('dance'); for (let i = 0; i < 60; i++) rig.tick(1 / 60);
  rig.stopMove(); for (let i = 0; i < 20; i++) rig.tick(1 / 60);
  assert.equal(rig.act, null, 'gone within a quarter of a second');
  rig.energy = 1.5; rig.setEmotion('joy'); for (let i = 0; i < 90; i++) rig.tick(1 / 60);
  const big = rig.out.smile; rig.energy = 0.5; for (let i = 0; i < 90; i++) rig.tick(1 / 60);
  assert(big > rig.out.smile, 'the expression control scales the feeling');
}

// The mic: a pause hands over the words so far, and going on takes it back.
{
  const v = new Vad(), say = (level, s) => { const out = []; for (let i = 0; i < s * RATE / FRAME; i++) { const r = v.push(new Float32Array(FRAME).fill(level)); if (r) out.push(r); } return out; };
  say(0.1, 1); assert.deepEqual(say(0.001, 0.4), ['pause']); assert(v.audio.length > RATE, 'the words so far');
  assert.deepEqual(say(0.1, 0.3), ['resume']); assert.deepEqual(say(0.001, 1), ['pause', 'end']);
}

// Singing with a real voice: the tune is the same as the built-in singer's, and the accompaniment follows the voice.
{
  const text = 'Tiny little lights are glowing, wires humming soft and low.', notes = melody(text);
  assert.deepEqual(notes, melody(text), 'the same words always get the same tune');
  assert(notes.length >= 12 && notes.every(n => n.f > 100 && n.dur > 0));
  const voice = new Float32Array(24000 * 3).fill(0.1), song = singOver(voice, 24000, notes, notes.map((_, i) => 0.25 + i * 0.2), -3);
  assert.equal(song.sr, 24000); assert(song.samples.length === voice.length && song.beats.length > 3 && song.track);
  assert(song.samples.every(Number.isFinite));
}

// Reels: every tag in them means something, for both kinds of body.
for (const led of [true, false]) {
  const { beats } = reelFor({ led });
  assert(beats.length >= 6);
  for (const [, markup] of beats) for (const op of parse(markup)) assert(['say', 'sing', 'emotion', 'gesture', 'vocal'].includes(op.type), markup);
  assert(beats.some(([, m]) => parse(m).some(o => o.type === 'sing')), 'a reel sings');
}

// Live mic lip sync: silence shuts the mouth, loud speech opens it, and nothing it returns can break the rig.
{
  const quiet = mouthFrom(new Float32Array(1024), new Float32Array(512).fill(-100), 48000);
  assert(quiet.open === 0 && quiet.energy === 0, 'silence is shut');
  const tone = Float32Array.from({ length: 1024 }, (_, i) => 0.2 * Math.sin(i * 0.05)), spec = new Float32Array(512).fill(-90);
  for (let i = 4; i < 10; i++) spec[i] = -20;
  const ah = mouthFrom(tone, spec, 48000);
  assert(ah.open > 0.3 && ah.round === ah.energy, 'a low, loud sound opens a round mouth');
  assert(Object.values(ah).every(Number.isFinite));
  const rig = new Rig(); rig.voice = ah; for (let i = 0; i < 60; i++) rig.tick(1 / 60);
  assert(rig.out.jaw > 0.1, 'it drives the jaw');
}

