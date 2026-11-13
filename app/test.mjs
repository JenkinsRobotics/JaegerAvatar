// node test.mjs — fails loudly if the audio->mouth mapping, the parser or the rig break.
import assert from 'node:assert';
import { analyze, synthVowel, synthVocal, synthSing, synthSpeech, sampleTrack, syllabify, melody, singOver, readWav, clipFacts } from './web/voice.js';
import { parse, Parser, scriptedReply, isIntro, reelFor } from './web/brain.js';
import { Rig, EMOTIONS } from './web/rig.js';
import { faceShapes, humanBone, MORPHS, ACTING } from './web/model-map.js';
import { Vad, Gate, isEcho, toPcm, fromPcm, FRAME, RATE } from './web/ears.js';
import { MOODS, REACTIONS, FaceAnimator, faceTarget, eyeContour } from './web/eyes.js';
import { MOVES, sampleMove, moveNow, flightHeight } from './web/motion.js';
import { HUMANOID, REST, HEAD_HEIGHT, chainsOf } from './web/humanoid.js';
import { TruthBody, JOINTS as TRUTH_JOINTS } from './web/truth-pose.js';
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

// The standard humanoid: about 7.5 heads tall, and every pose keeps its bones their length and its body above the floor.
{
  const top = REST.head[1] + HEAD_HEIGHT * 0.86, heads = top / HEAD_HEIGHT;
  assert(heads > 7 && heads < 8, `standard proportions, ${heads.toFixed(2)} heads`);
  for (const b of ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes']) assert(HUMANOID.includes(b), b);
  assert(REST.leftUpperArm[0] > 0 && REST.rightUpperArm[0] < 0, 'the figure faces +z, so its left is +x');
  const len = (p, a, b) => { const i = TRUTH_JOINTS.indexOf(a) * 3, k = TRUTH_JOINTS.indexOf(b) * 3; return Math.hypot(p[k] - p[i], p[k + 1] - p[i + 1], p[k + 2] - p[i + 2]); };
  const rest = Float32Array.from(TRUTH_JOINTS.flatMap(j => REST[j] ?? [0, 0, 0]));
  const t = new TruthBody(), o = { wave: 0, hand: 0.5, lean: 0.3 };
  for (const move of ['kneel', 'clap', 'lean', 'sway', 'stand', 'sit']) {
    t.play(move, 0);
    for (let f = 0; f < 240; f++) {
      const p = t.step(o, f / 60, 1 / 60);
      for (const [a, b] of chainsOf(TRUTH_JOINTS)) assert(Math.abs(len(p, a, b) - len(rest, a, b)) < 1e-4, `${move}: ${a}-${b} keeps its length`);
      for (const j of HUMANOID) assert(p[TRUTH_JOINTS.indexOf(j) * 3 + 1] > -0.01, `${move}: ${j} stays above the floor`);
    }
  }
}

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
  assert.deepEqual([...fromPcm(Buffer.from(new Int16Array([0, 16384, -32768]).buffer).toString('base64'))], [0, 0.5, -1], "the voice loop's sound, back as samples");
  // What goes to the voice loop: the room while she is quiet, none of her own voice, and a person talking over her from just before they began.
  const g = new Gate(), f = n => Float32Array.of(n), sent = (...a) => g.push(...a).map(x => x[0]);
  assert.deepEqual(sent(f(1), false), [1], 'a quiet room goes straight in');
  for (let i = 2; i < 40; i++) assert.deepEqual(sent(f(i), true), [], 'her own voice is kept back');
  const over = sent(f(40), true, 'start');
  assert.deepEqual([over.length, over[0], over.at(-1)], [21, 20, 40], 'someone talks over her: the last 0.6 s, then live');
  assert.deepEqual(sent(f(41), true), [41]);
  assert.deepEqual(sent(f(42), true, 'end'), [42]);
  assert.deepEqual(sent(f(43), true), [], 'kept back again once they stop');
  assert.deepEqual(sent(f(44), false), [44], 'her last words are dropped, not sent late');
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
  const played = (seconds = 12) => { const seen = []; for (let i = 0; i < seconds * 60; i++) { rig.tick(1 / 60); if (rig.act && seen.at(-1) !== rig.act.name) seen.push(rig.act.name); } return seen; };
  rig.move('clap'); for (let i = 0; i < 60; i++) rig.tick(1 / 60);
  rig.move('spin'); assert.equal(rig.act.name, 'clap', 'a new move does not snap in: the running one is eased out first');
  let frames = 0; while (rig.act?.name !== 'spin' && frames < 600) { rig.tick(1 / 60); frames++; }
  assert(frames <= 16, `and the new move starts within a quarter of a second, so it lands on its line (took ${frames} frames)`);
  assert.deepEqual(played(), ['spin'], 'then plays through');
  assert.equal(rig.act, null);
  rig.move('clap'); rig.move('spin'); rig.move('bow');
  assert.deepEqual(played(), ['clap', 'bow'], 'one move waits: the latest asked for');
  rig.move('clap'); for (let i = 0; i < 60; i++) rig.tick(1 / 60);
  rig.move('clap'); assert(rig.act.age > 0.9 && rig.act.stop === undefined && !rig.next, 'the move she is already making is not started again');
  played();
  rig.move('clap'); rig.move('spin'); rig.stopMove();
  assert.deepEqual(played(), ['clap'], 'a stop ends the move and what was waiting behind it');
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


// The node map behind the Data flow window: every wire joins a real output port to a real input port, and events light the right wires.
{
  const { STAGES, NODES, WIRES, wiresFor } = await import('./web/flow-graph.js');
  for (const w of WIRES) {
    const [a, out] = w.from.split('.'), [b, inp] = w.to.split('.');
    assert(NODES[a]?.out.some(p => p.id === out), `wire starts at a real output: ${w.from}`);
    assert(NODES[b]?.in.some(p => p.id === inp), `wire ends at a real input: ${w.to}`);
  }
  assert(STAGES.every(s => NODES[s]), 'every traced stage is a node');
  const owned = o => Object.keys(NODES).filter(k => NODES[k].owner === o).join();
  assert.equal(owned('framework'), 'agent', 'the agent is the only imported framework node today');
  assert.equal(owned('external'), '', 'no other program is in the picture: the model runs inside the agent');
  assert(!NODES.lm && !/LM Studio|HTTP/.test(JSON.stringify(NODES.agent)), 'the agent loads its model file itself: no model server');
  assert(!NODES.agent.in.some(q => q.id === 'tokens') && !NODES.agent.out.some(q => q.id === 'prompt'), 'prompt and tokens never leave the agent');
  const lit = (s, e) => wiresFor(s, e).map(w => `${w.from}>${w.to}`).join();
  assert.equal(lit('stt', 'request'), 'mic.phrase>stt.audio');
  assert.equal(lit('tts', 'request'), 'perform.say>tts.text', 'only a traced /say request lights the voice wire: songs, built-in sounds and ready-made clips are not traced');
  assert.equal(lit('perform', 'gesture'), 'perform.act>anim.commands');
  assert.equal(lit('control', 'look'), 'control.face>anim.commands', 'feel and look go straight to the rig');
  assert.equal(lit('control', 'act'), 'perform.act>anim.commands,control.act>perform.orders', 'a remote act goes through the performance\'s body mapping');
  assert.equal(lit('control', 'speak'), 'perform.ready>speaker.clip,perform.ready>lipsync.audio,control.clip>perform.clip', 'a ready-made clip is queued by the performance and skips the app\'s voice');
  assert.equal(lit('channels', 'voice'), 'speaker.clock>lipsync.clock,lipsync.mouth>anim.mouth,lipsync.accents>anim.accents', 'the speaker\'s clip clock times the mouth');
  assert.equal(lit('agent', 'text'), '', 'a scripted reply is made by the page, not the agent: text alone lights no agent wire');
  assert.equal(wiresFor('agent', 'text', true).map(w => w.from).join(), 'agent.reply', 'in a model turn the reply lights');
  assert.equal(lit('tts', 'clip ready'), 'tts.clip>speaker.clip,tts.clip>lipsync.audio,tts.lips>lipsync.track', 'the voice output fans out to the speaker and the lip sync');
  assert.equal(lit('mic', 'speech start'), 'mic.state>anim.listen,mic.duck>speaker.duck', 'hearing you turns her voice down and makes her listen');
  assert.equal(lit('speaker', 'play'), 'speaker.playing>mic.talking', 'while she talks the microphone is strict');
  const untraced = WIRES.filter(w => !w.on.length).map(w => `${w.from}>${w.to}`).join();
  assert.equal(untraced, 'perform.stop>agent.interrupt,perform.stop>tts.cancel,anim.state>outputs.rig,speaker.tap>outputs.sound', 'real connections the app does not trace: drawn, never lit');
  // Every card is the whole part: all its inputs and outputs, and what is inside it (on: in use with today's settings).
  const ids = k => NODES[k].inside.map(r => r.id).join();
  for (const [k, n] of Object.entries(NODES)) {
    assert(n.inside?.length && n.inside.every(r => r.id && r.name && r.does && typeof r.on === 'boolean' && typeof r.note === 'string'), `${k} lists what is inside it`);
    for (const side of ['in', 'out']) assert.equal(new Set(n[side].map(q => q.id)).size, n[side].length, `${k} port ids are unique`);
    for (const q of [...n.in, ...n.out]) assert(q.label.length <= 18, `port label fits the card: ${k}.${q.id}`);
    assert(n.at[1] < 2, `${k} sits in one of the two rows`);
  }
  assert.equal(new Set(Object.values(NODES).map(n => n.at.join())).size, Object.keys(NODES).length, 'no two cards share a place');
  assert.equal(ids('mic'), 'capture,vad,early,strict');
  assert.equal(ids('stt'), 'whisper,speech,echo');
  assert.equal(ids('perform'), 'parser,clause,queue,body,scripted,reel,stop');
  assert.equal(ids('tts'), 'kokoro,clone,piper,synth,singing,cache');
  assert.equal(ids('speaker'), 'gains,lift,effects,clock,meter,fallback');
  assert.equal(ids('lipsync'), 'nori,marks,kin,ahead');
  assert.equal(ids('anim'), 'feelings,idle,gestures,reactions,moves,poses,springs');
  assert.equal(ids('render'), 'led,anime,sdf,vrm,kin,study,media');
  assert.equal(ids('outputs'), 'stage,hardware,relay,record');
  assert.equal(ids('control'), 'guard,attach,poll,clips');
  assert(NODES.render.inside.every(r => r.adapters?.length), 'each renderer names the pack adapters it draws');
  assert(!/With no model it gives/.test(NODES.agent.does) && /scripted/i.test(NODES.perform.inside.find(r => r.id === 'scripted').does), 'the scripted reply belongs to the page, not the agent');
  assert(!/30 ms/.test(NODES.speaker.does + NODES.lipsync.does), 'the mouth runs 50 ms ahead, not 30');
  assert(NODES.agent.in.some(q => q.id === 'interrupt' && !q.off), 'the agent\'s interrupt input is in use');
  // The agent card is the whole agent module: every input and output it supports (off: not used by this app), and what is inside it.
  const wired = new Set(WIRES.flatMap(w => [w.from, w.to]));
  for (const [k, n] of Object.entries(NODES)) for (const q of [...n.in, ...n.out]) assert(!(q.off && wired.has(`${k}.${q.id}`)), `a port marked off has no wire: ${k}.${q.id}`);
  assert.deepEqual(Object.fromEntries(NODES.agent.inside.map(r => [r.id, r.on])), { model: true, tools: false, skills: false, hearing: false, voice: false, audio: false, vision: false },
    'inside the agent, only the model is in use today');
  assert(NODES.agent.in.some(q => q.id === 'results' && q.off) && NODES.agent.out.some(q => q.id === 'calls' && q.off), 'tool use is a pair of ports, off today');
  // The drawing: wires run only in the gutters and the band between the rows, and never lie on top of one another.
  const { layout } = await import('./web/flow-graph.js');
  const L = layout(), segs = L.routes.map(r => r.slice(1).map((q, i) => [r[i], q]));
  assert(L.routes.length === WIRES.length && L.routes.every(r => r.length >= 2), 'every wire is routed');
  WIRES.forEach((w, i) => { const [a, out] = w.from.split('.'), [b] = w.to.split('.'), r = L.routes[i];
    assert(r[0].x === L.cards[a].x + L.cards[a].w && r.at(-1).x === L.cards[b].x, `the route runs from the output side to the input side: ${w.from} > ${w.to}`); });
  assert(segs.flat().every(([a, b]) => a.x === b.x || a.y === b.y), 'wires run straight: across or up and down');
  const inside = ([a, b], c) => Math.max(a.x, b.x) > c.x && Math.min(a.x, b.x) < c.x + c.w && Math.max(a.y, b.y) > c.y && Math.min(a.y, b.y) < c.y + c.h;
  segs.forEach((ss, i) => ss.forEach(s => assert(!Object.values(L.cards).some(c => inside(s, c)), `no wire runs through a card: ${WIRES[i].from} > ${WIRES[i].to}`)));
  const over = ([a, b], [c, d]) => a.x === b.x && c.x === d.x && a.x === c.x ? Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 0
    : a.y === b.y && c.y === d.y && a.y === c.y && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 0;
  WIRES.forEach((w, i) => WIRES.forEach((v, j) => { if (j > i && w.from !== v.from && w.to !== v.to)
    assert(!segs[i].some(s => segs[j].some(t => over(s, t))), `two unrelated wires never share a stretch: ${w.from} > ${w.to} and ${v.from} > ${v.to}`); }));
  assert(Object.values(L.cards).every(c => c.x >= 0 && c.x + c.w <= L.GW && c.y + c.h <= L.GH) && segs.flat().flat().every(q => q.x > 0 && q.x < L.GW), 'everything is on the canvas');
}
// With the voice loop on (the default) the map is a different one: hearing, the model, tool use and the voice are
// sections of the one agent framework node, and the app's own hearing is not in the picture.
{
  const { LOOP, wiresFor, layout } = await import('./web/flow-graph.js');
  const { STAGES, NODES, WIRES } = LOOP;
  for (const w of WIRES) {
    const [a, out] = w.from.split('.'), [b, inp] = w.to.split('.');
    assert(NODES[a]?.out.some(p => p.id === out), `loop map: wire starts at a real output: ${w.from}`);
    assert(NODES[b]?.in.some(p => p.id === inp), `loop map: wire ends at a real input: ${w.to}`);
  }
  assert(!NODES.stt, 'no separate hearing node: the agent does the hearing');
  assert.equal(Object.keys(NODES).filter(k => NODES[k].owner !== 'app').join(), 'agent', 'the agent is the one framework node, and nothing is external');
  const heads = NODES.agent.inside.filter(r => r.head);
  assert.deepEqual(heads.map(r => [r.id, r.on, r.stage]), [['hearing', true, 'stt'], ['model', true, 'agent'], ['tools', true, 'tools'], ['voice', true, 'voice'], ['scene', true, 'scene'], ['io', false, undefined], ['vision', false, undefined]],
    'the agent card has a hearing, a model, a tool use, a voice and a scenes section, each lit by its own traced stage');
  assert(STAGES.every(s => NODES[s] || heads.some(h => h.stage === s)), 'every traced stage is a node or a section of the agent');
  assert(NODES.agent.inside.some(r => r.id === 'avatar' && r.on), 'the avatar tool is listed under tool use');
  assert(NODES.tts.name !== 'Voice (TTS)' && /reel/.test(NODES.tts.does) && /replies/.test(NODES.tts.does), 'the app\'s own voice is named for what still uses it');
  const lit = (s, e) => wiresFor(s, e, true, WIRES).map(w => `${w.from}>${w.to}`).join();
  assert.equal(lit('mic', 'speech start'), 'mic.frames>agent.audio,mic.state>anim.listen,mic.duck>speaker.duck', 'the microphone sound goes to the agent');
  assert.equal(lit('stt', 'transcript'), 'agent.heard>perform.heard');
  assert.equal(lit('voice', 'clip ready'), 'agent.speech>perform.speech,agent.lips>lipsync.track,perform.play>speaker.clip,perform.play>lipsync.audio', 'the agent\'s voice goes to the speaker and the lip sync');
  assert.equal(lit('tools', 'tool'), 'agent.calls>control.remote,control.answer>agent.results', 'an avatar call goes to the control link and its answer comes back');
  assert.equal(lit('agent', 'done'), 'agent.reply>perform.reply');
  assert.equal(lit('tts', 'request'), 'perform.say>tts.text', 'reel and intro lines still go to the app\'s own voice');
  assert.equal(lit('control', 'feel'), 'control.face>anim.commands');
  assert.equal(lit('perform', 'cue'), 'perform.cue>agent.cue', 'when the sound reaches a cue, the page tells the agent, whose avatar tool makes the move');
  assert.equal(lit('scene', 'request'), '', 'a scene comes from the page itself, like typed words');
  assert(NODES.agent.in.some(q => q.id === 'scene') && NODES.agent.inside.some(r => r.id === 'cues' && r.on), 'the agent takes a scene and lists the cues it sends with the sound');
  assert(!/not timed to a spoken line/.test(NODES.agent.inside.find(r => r.id === 'avatar').does), 'the avatar tool is no longer described as untimed');
  assert(NODES.agent.inside.findIndex(r => r.id === 'scenetool') === NODES.agent.inside.findIndex(r => r.id === 'avatar') + 1, 'the scene tool, with which the model writes a scene, is listed under tool use beside the avatar tool');
  const wired = new Set(WIRES.flatMap(w => [w.from, w.to]));
  for (const [k, n] of Object.entries(NODES)) {
    assert(n.inside?.length && n.inside.every(r => r.id && r.name && r.does && typeof r.on === 'boolean' && typeof r.note === 'string'), `loop map: ${k} lists what is inside it`);
    assert.equal(new Set(n.inside.map(r => r.id)).size, n.inside.length, `loop map: ${k} part ids are unique`);
    for (const side of ['in', 'out']) assert.equal(new Set(n[side].map(q => q.id)).size, n[side].length, `loop map: ${k} port ids are unique`);
    for (const q of [...n.in, ...n.out]) { assert(q.label.length <= 18, `loop map: port label fits the card: ${k}.${q.id}`); assert(!(q.off && wired.has(`${k}.${q.id}`)), `loop map: a port marked off has no wire: ${k}.${q.id}`); }
  }
  assert.equal(new Set(Object.values(NODES).map(n => n.at.join())).size, Object.keys(NODES).length, 'loop map: no two cards share a place');
  const L = layout(NODES, WIRES), segs = L.routes.map(r => r.slice(1).map((q, i) => [r[i], q]));
  assert(L.routes.length === WIRES.length && segs.flat().every(([a, b]) => a.x === b.x || a.y === b.y), 'loop map: every wire is routed, straight across or up and down');
  const inside = ([a, b], c) => Math.max(a.x, b.x) > c.x && Math.min(a.x, b.x) < c.x + c.w && Math.max(a.y, b.y) > c.y && Math.min(a.y, b.y) < c.y + c.h;
  segs.forEach((ss, i) => ss.forEach(s => assert(!Object.values(L.cards).some(c => inside(s, c)), `loop map: no wire runs through a card: ${WIRES[i].from} > ${WIRES[i].to}`)));
  const near = ([a, b], [c, d]) => a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 5 ? Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 0
    : a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 5 && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 0;
  WIRES.forEach((w, i) => WIRES.forEach((v, j) => { if (j > i && w.from !== v.from && w.to !== v.to)
    assert(!segs[i].some(s => segs[j].some(t => near(s, t))), `loop map: two unrelated wires keep apart: ${w.from} > ${w.to} and ${v.from} > ${v.to}`); }));
  assert(Object.values(L.cards).every(c => c.x >= 0 && c.x + c.w <= L.GW && c.y + c.h <= L.GH) && segs.flat().flat().every(q => q.x > 0 && q.x < L.GW), 'loop map: everything is on the canvas');
}
{ // Settings says what the voice loop runs on, part by part
  const { partsLine } = await import('./web/settings.js');
  const line = partsLine({ voice: { module: 'jaeger_kokoro_tts', version: '0.13.0', compute: 'mlx', model: 'af_heart' },
    hearing: { module: 'jaeger_whisper_stt', version: '0.14.0', compute: 'metal', model: 'large-v3-turbo' },
    ctx: 32768, tools_enabled: true, max_iterations: 24, tool_list: 'short list', load_s: 16.9 });
  for (const part of ['jaeger_kokoro_tts 0.13.0 on mlx (af_heart)', 'jaeger_whisper_stt 0.14.0 on metal (large-v3-turbo)', '32768', 'tools on (short list', '16.9 s'])
    assert(line.includes(part), `the Settings page names ${part}: ${line}`);
  assert.equal(partsLine({}), '', 'no voice loop, nothing claimed');
}

// The voice comparison page: a clip as the server sends it (one 16-bit mono WAV), and the plain facts shown under each side.
{
  const sr = 24000, n = 2400, wav = new ArrayBuffer(44 + n * 2), dv = new DataView(wav);
  const put = (at, text) => [...text].forEach((ch, i) => dv.setUint8(at + i, ch.charCodeAt(0)));
  put(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); put(8, 'WAVE'); put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 240; i < 1920; i++) dv.setInt16(44 + i * 2, 16384, true);   // 10 ms of quiet, 70 ms of sound at half scale, 20 ms of quiet
  const clip = readWav(wav);
  assert.equal(clip.sr, sr, 'the clip keeps its own sample rate');
  assert.equal(clip.samples.length, n);
  const f = clipFacts(clip.samples, clip.sr, [[0.01, 0.03, 'p'], [0.04, 0.05, 'f'], [0.06, 0.07, 'p']]);
  assert.deepEqual([f.seconds, f.peak, f.leadMs, f.tailMs, f.marks, f.closures, f.tucks], [0.1, 0.5, 10, 20, 3, 2, 1], 'length, level, dead air and lip marks');
  assert(Math.abs(f.rms - 0.5 * Math.sqrt(0.7)) < 1e-3, `loudness over the whole clip: ${f.rms}`);
  const none = clipFacts(new Float32Array(240), sr, []);
  assert.deepEqual([none.peak, none.leadMs, none.tailMs, none.marks], [0, 10, 0, 0], 'a silent clip is all lead, no marks');
}
