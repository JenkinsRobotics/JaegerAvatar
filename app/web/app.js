import {charactersFromPacks,mountLibrary} from './pack-library.js';
import {kinTrack,sampleKin} from './lip-sync.js';
import { Rig, EMOTIONS, CHANNELS } from './rig.js';
import { Parser, parse, scriptedReply, reelFor, IDLE_LINE, isIntro } from './brain.js';
import * as voice from './voice.js';
import { OledFace, VisorFace, DISPLAY } from './render-led.js';
import { MOVES } from './motion.js';
import { REACTIONS } from './eyes.js';
import { AnimeChar, TIMING } from './render-anime.js';
import { Char3D } from './render-3d.js';
import { VrmChar, STAGE } from './render-vrm.js';
import { openMic, isEcho, toPcm } from './ears.js';

const { sampleTrack, SR, VOCAL_NAMES } = voice;
const $ = s => document.querySelector(s);
const rig = new Rig();
// Choices that should still be there tomorrow. A private window can refuse this, and everything still works.
const saved = (() => { try { return JSON.parse(localStorage.getItem('jaeger-avatar')) ?? {}; } catch { return {}; } })();
const remember = patch => { Object.assign(saved, patch); try { localStorage.setItem('jaeger-avatar', JSON.stringify(saved)); } catch { /* not kept, then */ } };
const toast = text => { const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('on'), 4000); };
const KRISTIN = 'en_US-kristin-medium', JOE = 'en_US-joe-medium', BRYCE = 'en_US-bryce-medium', NORMAN = 'en_US-norman-medium';
const d3 = kind => (c, ov) => new Char3D(c, ov, kind);
// pitch: playback speed-up of the voice, with the text slowed to match. Lip sync reads the clip's own clock, so it stays locked.
const params = new URLSearchParams(location.search);
const startupTrace=params.has("startup")?(await import("/performance-review/startup-trace.js")).trace:()=>{};
let startupRequest=0;
const PACKS = await (await fetch('/api/avatars')).json();
$('#libraryOpen').textContent='Avatar library · '+PACKS.length;
const CHARACTERS = charactersFromPacks(PACKS);
// The model you loaded last time comes back.
const MODEL_STORE = 'jaeger-avatar-models', DEFAULT_MODEL = params.get('model') ?? CHARACTERS.find(c=>c.id==='vita').rep.asset;
const storedModel = async () => { try { const r = await (await caches.open(MODEL_STORE)).match('/my-model'); return r ? r.blob() : null; } catch { return null; } };
const myModel = params.has('obs') || params.has('model') ? null : await storedModel();
const modelAtStart = myModel ? URL.createObjectURL(myModel) : DEFAULT_MODEL;
CHARACTERS.find(c=>c.id==='vita').make=(c,ov)=>new VrmChar(c,ov,modelAtStart);
let current = CHARACTERS.find(c => c.id === (params.get('face') ?? saved.view)) ?? CHARACTERS[0];
const panes = {}, faces = {};
for (const ch of CHARACTERS) {
  const p = document.createElement('div');
  p.className = 'pane'; p.dataset.face = ch.id;
  p.innerHTML = '<span class="tag"></span><canvas></canvas><canvas class="ov"></canvas>';
  p.querySelector('.tag').textContent=ch.name+' · '+ch.tag;
  $('#stage').prepend(p);
  panes[ch.id] = p;
}
const faceFor = id => (faces[id] ??= CHARACTERS.find(c => c.id === id).make(panes[id].querySelector('canvas'), panes[id].querySelector('.ov')));
let view = (params.get('face') ?? saved.view) === 'all' ? 'all' : current.id;

for (const [id, label] of [...CHARACTERS.filter(c=>c.featured).map(c => [c.id, c.label]), ['all', 'All']]) {
  const b = document.createElement('button');
  b.textContent = label; b.setAttribute('role', 'tab'); b.dataset.id = id;
  b.onclick = () => setView(id);
  $('#tabs').append(b);
}
function setView(id) {
  for(const f of Object.values(faces))f.suspend?.();
  view = id;
  const next = CHARACTERS.find(c => c.id === id);
  if (next && next !== current) { stopAll(); current = next; rig.mode = 'idle'; rig.setEmotion('neutral'); hudStatic(); rig.gesture('wave'); }
  remember({ view: id });
  for (const b of $('#tabs').children) b.setAttribute('aria-selected', b.dataset.id === id);
  $('#stage').className = id === 'all' ? 'all' : 'single';
  for (const [k, p] of Object.entries(panes)) p.classList.toggle('on', (id === 'all' && CHARACTERS.find(c=>c.id===k).featured) || id === k);
  if (id === 'vita' && !faces.vita) { const f = faceFor('vita'); watchLoad(f); showMeta(f.loaded); }
  showHistory();
  showVoices();
  fillViews();
  fillProfiles();
  if (voiceList.length) setTimeout(preloadReel, 800);
  micState($('#mic').dataset.state ?? 'off');
  fillMoves();
}

// --- Audio ---------------------------------------------------------------------
let ac = null;
const audio = () => (ac ??= new (window.AudioContext || window.webkitAudioContext)());
const unlock = () => { if (!reelPaused) audio().resume(); };
// Every clip goes through output, so she can drop her voice when someone talks over her and so a recording can listen in. Mute comes after that, so it never silences a recording.
let output = null, master = null, meter = null, muted = !!saved.muted;
const speaker = () => { if (!output) { output = audio().createGain(); master = audio().createGain(); master.gain.value = muted ? 0 : 1; meter = audio().createAnalyser(); meter.fftSize = 512; output.connect(master); master.connect(meter); master.connect(audio().destination); } return output; };
// Heavy audio work runs off the drawing thread. Without a worker it still runs, just with a stall.
let worker = null, jobId = 0; const jobs = new Map();
try {
  worker = new Worker('voice-worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => { jobs.get(data.id)?.(data.result); jobs.delete(data.id); };
  worker.onerror = () => { worker = null; for (const done of jobs.values()) done(null); jobs.clear(); };
} catch { worker = null; }
// A worker that never answers must not silence her, so after a few seconds the job runs here instead.
const work = async (job, ...args) => (worker && await Promise.race([new Promise(done => { jobs.set(++jobId, done); worker.postMessage({ id: jobId, job, args }); }), new Promise(done => setTimeout(() => done(null), 8000))])) ?? voice[job](...args);
// Sound that can't play must say so, not leave her silently mouthing the words.
function soundCheck() {
  const gate = document.querySelector('#soundGate');
  if (gate) gate.hidden = !ac || ac.state === 'running' || reelPaused || !(clip || running);
}
// Browsers differ on which event counts as a gesture that may start sound, so try them all.
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchend', 'keydown']) addEventListener(type, () => { unlock(); soundCheck(); }, true);
// Starting the audio system takes up to half a second, so it happens while nothing is on screen yet rather than in her first line.
if (!params.has('obs')) (window.requestIdleCallback ?? setTimeout)(() => audio());

let serverVoice = null, serverBrain = 'scripted', serverEars = false, viewers = 0;
const checkHealth=()=>fetch('/health').then(r=>r.json()).then(h=>{serverVoice=h.voice;serverBrain=h.brain;serverEars=h.ears;hudStatic();}).catch(hudStatic);checkHealth();setInterval(checkHealth,5000);

// Kokoro's pacing per feeling, local-avatar-demo's gentle range: wider swings rushed or dragged her voice. RATE is the original pipeline's.
const KSPEED = { excited: 1.08, surprised: 1.05, scared: 1.05, angry: 1.03, joy: 1.02, smug: 0.97, love: 0.97, thinking: 0.95, shy: 0.94, sad: 0.92, sleepy: 0.9 };
// Laughs and sounds in her own voice, as local-avatar-demo does; the built-in sounds are for the original pipeline.
const SAID = { laugh: 'Ha ha ha!', giggle: 'Hehe!', sigh: 'Ahh.', gasp: 'Oh!', hmm: 'Hmm...', wow: 'Wow!', aww: 'Aww!', yay: 'Yay!', ooh: 'Ooh!' };
const RATE = { excited: 215, joy: 200, angry: 205, surprised: 210, scared: 215, sad: 155, sleepy: 135, thinking: 170, shy: 170, smug: 175, love: 170 };

function readWav(buf) {
  const dv = new DataView(buf);
  let at = 12, sr = SR, ch = 1;
  while (at < dv.byteLength - 8 && dv.getUint32(at) !== 0x64617461) { if (dv.getUint32(at) === 0x666d7420) { ch = dv.getUint16(at + 10, true); sr = dv.getUint32(at + 12, true); } at += 8 + dv.getUint32(at + 4, true); }
  const len = Math.min(dv.getUint32(at + 4, true), dv.byteLength - at - 8) >> 1, n = Math.floor(len / ch), x = new Float32Array(n), y = ch > 1 ? new Float32Array(n) : null;
  for (let i = 0; i < n; i++) { x[i] = dv.getInt16(at + 8 + i * 2 * ch, true) / 32768; if (y) y[i] = dv.getInt16(at + 10 + i * 4, true) / 32768; }
  return y ? { samples: x, sr, voice: y } : { samples: x, sr };   // two channels: the song as heard, then her voice alone
}
// Which voice this character speaks with: the one chosen for them, or their own Kokoro voice. null means the fast voices.
let voiceList = [], naturalStatus = 'off', kokoroOn = null, cloneStatus = 'idle', serverTurn = Date.now();   // always ahead of an earlier page's turns
const chosenVoice = () => {
  if (saved.engine === 'fast') return null;
  const id = saved.voices?.[current.id] ?? `kokoro:${current.kokoro}`;
  return voiceList.some(v => v.id === id) ? id : voiceList.some(v => v.id === `kokoro:${current.kokoro}`) ? `kokoro:${current.kokoro}` : null;
};
// The reel's lines are rendered ahead of time in the quiet after the page loads, so pressing Play starts it straight away.
const readyClips = new Map(), clipKey = (voiceId, text, emotion) => `${voiceId}|${emotion}|${text}`;
// One request per line: the reel and its preparation share what is already on its way. Preparation is never cancelled by Stop; the reel will want it.
const inFlight = new Map(), KEEP = Number.MAX_SAFE_INTEGER;   // turns count up from the clock, so this is later than any of them
// Stop drops the requests still waiting, in the browser too: it allows six connections to the server, and lines nobody will hear must not hold them while the cancel queues behind.
let sayAbort = new AbortController();
let preloadRun = 0;
async function preloadReel() {
  if(params.has("perf")||params.has('test'))return;
  const mine = ++preloadRun, voiceId = chosenVoice();
  if (!voiceId?.startsWith('kokoro:')) return;
  const who = current;
  let emotion = 'neutral';
  for (const [, markup] of reelFor(who).beats) {
    for (const op of parse(markup.replaceAll('Nori', who.name))) {
      if (op.type === 'emotion') emotion = op.name;
      const song = op.type === 'sing' && singsHalf(voiceId), text = op.type === 'vocal' ? SAID[op.name] : op.text;
      if (song ? readyClips.has(clipKey(voiceId, op.text, '♪' + songStyle())) : !['say', 'vocal'].includes(op.type) || !text || readyClips.has(clipKey(voiceId, text, emotion))) continue;
      await wait(running || clip ? 1 : 0.05);    // never compete with what she's saying now
      if (mine !== preloadRun || chosenVoice() !== voiceId) return;   // switched voice or character: these lines are no longer wanted
      try { await (song ? singNatural(op.text, voiceId, KEEP) : sayNatural(text, voiceId, emotion, "preload", KEEP)); } catch { return; }
    }
  }
}
function sayNatural(text, voiceId, emotion, origin = "playback", turn = serverTurn) {
  const key = clipKey(voiceId, text, emotion), ready = readyClips.get(key), going = inFlight.get(key);
  if (ready) {startupTrace("cache-hit",{text,emotion,origin});return Promise.resolve(ready);}
  if (going && going.turn >= serverTurn) return going.p;    // a request from an interrupted turn may come back empty, so don't lean on it
  // Reel lines are kept, so neither a replay nor the preparation renders them twice.
  const p = fetchClip(text, voiceId, emotion, origin, turn)
    .then(c => { if (c && origin !== 'playback') readyClips.set(key, c); return c; })
    .finally(() => { if (inFlight.get(key)?.p === p) inFlight.delete(key); });
  inFlight.set(key, { p, turn });
  return p;
}
// Songs, half-sung in her own Kokoro voice over a music box, made on the server. Kept once made, and shared like her lines.
const songStyle = () => saved.singing === 'sung' ? 'sung' : 'spoken';   // spoken on the beat was chosen by ear; half-sung is the option
const singsHalf = voiceId => ['kokoro', 'sung', undefined].includes(saved.singing) && !!voiceId?.startsWith('kokoro:') && kokoroOn === 'mlx';
function singNatural(text, voiceId, turn = serverTurn, style = songStyle()) {
  const key = clipKey(voiceId, text, '♪' + style), ready = readyClips.get(key), going = inFlight.get(key);
  if (ready) return Promise.resolve(ready);
  if (going && going.turn >= serverTurn) return going.p;
  const p = (async () => {
    const r = await fetch('/song', { method: 'POST', body: JSON.stringify({ text, voice: voiceId, turn, style }), signal: turn === KEEP ? undefined : sayAbort.signal });
    if (!r.ok) return null;
    const { bpm, beats } = JSON.parse(r.headers.get('X-Song')), { samples, sr, voice: alone } = readWav(await r.arrayBuffer());
    return { samples, sr, natural: true, bpm, beats, track: await work('analyze', alone ?? samples, sr) };   // her mouth follows her voice, not the music box
  })().then(c => { if (c) readyClips.set(key, c); return c; }).finally(() => { if (inFlight.get(key)?.p === p) inFlight.delete(key); });
  inFlight.set(key, { p, turn });
  return p;
}
async function fetchClip(text, voiceId, emotion, origin, turn) {
  const request=++startupRequest;startupTrace("request-start",{request,text,emotion,origin});
  const r = await fetch('/say', { method: 'POST', body: JSON.stringify({ text, voice: voiceId, emotion, speed: KSPEED[emotion] ?? 1, turn }), signal: turn === KEEP ? undefined : sayAbort.signal });
  if (!r.ok) {startupTrace("request-failed",{request,status:r.status});return null;}
  const raw=await r.arrayBuffer();startupTrace("response",{request});
  const {samples,sr}=readWav(raw);
  const track=await work("analyze",samples,sr);startupTrace("clip-ready",{request,duration:samples.length/sr});
  return {samples,sr,natural:true,track};
}

async function prepare(op, emotionAtQueue) {
  const natural = chosenVoice(), mine = runId, { signal } = sayAbort;
  if(op.sample)return preparedSample(op.sample);
  if (op.type === 'vocal') {
    if (natural && SAID[op.name]) {
      try { const c = await sayNatural(SAID[op.name], natural, emotionAtQueue, op.reel ? 'reel' : 'playback'); if (c) return c; } catch { /* the built-in sound will do */ }
      if (mine !== runId) return null;
    }
    return work('synthVocal', op.name);   // built in: instant, and shaped to the laughing and gasping acting
  }
  if (op.type === 'sing') {
    if (singsHalf(natural)) {
      try { const c = await singNatural(op.text, natural); if (c) return c; } catch { /* the built-in singer will do */ }
      if (mine !== runId) return null;
    }
    if (saved.singing === 'voice' && (serverVoice || natural)) {
      try {                                    // the voice she's speaking with, moved onto a tune
        const notes = voice.melody(op.text), r = await fetch('/sing', { method: 'POST', body: JSON.stringify({ text: op.text, voice: natural ?? current.voice, notes, turn: serverTurn }), signal });
        if (r.ok) {
          const song = JSON.parse(r.headers.get('X-Song')), { samples, sr } = readWav(await r.arrayBuffer());
          return { ...await work('singOver', samples, sr, notes, song.onsets, song.shift), natural: !!natural };
        }
      } catch { /* the built-in singer will do */ }
    }
    return work('synthSing', op.text);
  }
  if (natural) {
    // A cloned voice may still be loading. Until it is, the character's own voice speaks instead of making anyone wait.
    for (const v of new Set([natural, `kokoro:${current.kokoro}`])) {
      try { const c = await sayNatural(op.text, v, emotionAtQueue, op.reel ? 'reel' : 'playback'); if (c) return c; } catch { /* next one */ }
      if (mine !== runId) return null;         // stopped: nobody will hear this line in any voice
    }
  }
  if (serverVoice) {
    try {
      const r = await fetch('/say', { method: 'POST', body: JSON.stringify({ text: op.text, voice: current.voice, rate: (RATE[emotionAtQueue] ?? 190) / current.pitch }), signal });
      if (r.ok) { const { samples, sr } = readWav(await r.arrayBuffer()); return { samples, sr, track: await work('analyze', samples, sr) }; }
    } catch { /* fall through to the built-in robot voice */ }
  }
  if (mine !== runId) return null;
  return work('synthSpeech', op.text);
}

// Each clip plays once; while it plays, every frame samples the analysed track slightly ahead of
// the audio clock, because mouths move before the sound they make.
const LOOKAHEAD = 0.05;
let clip = null;
const DELIVERY = { excited: 1.05, joy: 1.02, scared: 1.05, surprised: 1.04, shy: 1.02, sad: 0.96, sleepy: 0.95 };   // the voice lifts and sinks with the feeling; lip sync reads the clip's clock, so it stays locked
async function startSound() {
  const ctx = audio();
  if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), wait(0.4)]);
  soundCheck();
  return ctx.state === 'running';
}
async function playClip(c) {
  const generation=runId;
  try{if(saved.lipSync==='kin'&&!c.kinFrames)c.kinFrames=await kinTrack(c.samples,c.sr||SR,sayAbort.signal);}
  catch(e){if(generation!==runId)return;toast('Mouth analysis unavailable; using Nori for this line.');}
  while(reelPaused&&generation===runId)await wait(.05);
  if(generation!==runId)return;
  startupTrace("audio-unlock-start");
  await startSound();
  if(generation!==runId)return;
  startupTrace("audio-unlock-end",{state:audio().state});
  return new Promise(resolve => {
    const ctx = audio();
    if (ctx.state === 'running') {
      const buf = ctx.createBuffer(1, c.samples.length, c.sr ?? SR), p = c.natural ? current.kp ?? 1 : current.pitch * (DELIVERY[rig.emotion] ?? 1);   // her own voice is never pitch-shifted
      // ponytail: a ring modulator is the whole robot voice effect; a real vocoder if it needs more character
      const out = current.robot ? c.samples.map((s, i) => s * (0.78 + 0.22 * Math.sin(i * 0.0171))) : c.samples;
      buf.copyToChannel(out, 0);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = p; src.connect(speaker());
      const startAt = ctx.currentTime + 0.02;
      src.start(startAt);
      if(params.has("startup")){const first=c.samples.findIndex(x=>Math.abs(x)>.005);startupTrace("source-scheduled",{duration:buf.duration,delayMs:(startAt-ctx.currentTime+(ctx.outputLatency||0))*1000,signalLeadMs:Math.max(0,first)/(c.sr??SR)/p*1000,natural:!!c.natural});}
      clip = { ...c, now: () => (ctx.currentTime - startAt - (ctx.outputLatency || 0)) * p, iE: 0, iP: 0, iB: 0, src };
      const owned=clip;src.onended = () => { if(clip===owned)clip = null; resolve(); };
    } else {                                   // audio blocked until a user gesture: animate silently on a clock
      const t0 = performance.now(), p = current.pitch;
      clip = { ...c, now: () => (performance.now() - t0) / 1000 * p, iE: 0, iP: 0, iB: 0 };
      soundCheck();
      const owned=clip;setTimeout(() => { if(clip===owned)clip = null; resolve(); }, c.track.dur / p * 1000);
    }
  });
}

function driveClip() {
  if (!clip) { rig.voice = null; return; }
  const t = clip.now(), tr = clip.track, at = t + LOOKAHEAD;
  rig.voice = at >= 0 ? sampleTrack(tr, at) : null;
  if(saved.lipSync==='kin')rig.voice=sampleKin(clip.kinFrames,at,rig.voice);
  if (rig.voice && clip.mouth != null) rig.voice.open *= clip.mouth;
  while (clip.iE < tr.emph.length && tr.emph[clip.iE].t <= at + 0.03) rig.emphasis(tr.emph[clip.iE++].s);
  while (clip.iP < tr.pauses.length && tr.pauses[clip.iP] <= t) { rig.blink(); clip.iP++; }
  if (clip.beats) while (clip.iB < clip.beats.length && clip.beats[clip.iB] <= at) rig.beat(clip.iB++);
}

// --- Performer: a queue of ops, audio rendered as soon as it is queued --------------
const queue = [];
let reel = null, reelPaused = false, chatAbort = null;
let spoken = '', runId = 0, running = false, owner = -1, pushEmotion = 'neutral', firstSoundAt = 0, lastLatency = null, sentAt = 0;
function stopAll() {
  runId++; queue.length = 0;
  if(song){song.off=true;if(song.id)fetch('/singer/stop',{method:'POST',body:JSON.stringify({id:song.id})}).catch(()=>{});song=null;}
  if(chatAbort)fetch('/agent/interrupt',{method:'POST',body:JSON.stringify({session:sessionId(),pack:current.packId})}).catch(()=>{});
  chatAbort?.abort(); chatAbort = null;        // stops Gemma working on a reply nobody will hear
  serverTurn++;
  sayAbort.abort(); sayAbort = new AbortController();
  if (voiceList.length) fetch('/say/cancel', { method: 'POST', body: JSON.stringify({ turn: serverTurn }) }).catch(() => {});
  endReel();
  try { clip?.src?.stop(); } catch { /* already stopped */ }
  clip = null; rig.sway = null;
  sub('');
}
function enqueue(ops) {
  for (const op of ops) {
    if (op.type === 'emotion') pushEmotion = op.name;
    if (['say', 'sing', 'vocal'].includes(op.type)) op.ready = op.clip ? Promise.resolve(op.clip) : prepare(op, pushEmotion);   // a finished song comes ready
    if (op.text) spoken = (spoken + ' ' + op.text).slice(-800);
    queue.push(op);
  }
  if (owner !== runId) run();                 // a stopped loop may still be waiting on a line; the new one doesn't wait for it
}
// Breathy and hummed sounds are loud but barely open the mouth, which audio alone can't tell.
const VOCAL_MOUTH = { sigh: 0.28, gasp: 0.55, hmm: 0.05 };
const VOCAL_FACE = {
  laugh: ['laughing'], giggle: ['laughing', 0.8], sigh: [null, 'sigh'], gasp: ['surprised', 'gasp'], hmm: ['thinking', 'think'],
  wow: ['surprised'], aww: ['love'], yay: ['excited', 'bounce'], ooh: ['surprised'],
};
function sub(text) { $('#sub').textContent = text; $('#sub').classList.toggle('on', !!text); }
async function run() {
  const id = owner = runId;
  running = true;
  while (queue.length && id === runId) {
    const op = queue.shift();
    if (op.type === 'chapter') {
      if (op.at === 0) {                       // her first lines are short, so start only once the next ones are ready to follow straight on
        $('#chapterText').textContent = 'Getting ready…';
        startupTrace('wait-first-two-start');
        await Promise.all(queue.filter(o => o.ready).slice(0, 2).map(o => o.ready));
        startupTrace("wait-first-two-end");
        if (id !== runId) break;
      }
      $('#chapterText').textContent = op.label; $('#chapterBar').value = op.at;
      continue;
    }
    if (op.type === 'emotion' || op.type === 'gesture') {
      // Hold the face until its line is ready, so expression and voice land together.
      await queue.find(o => o.ready)?.ready;
      if (id !== runId) break;
      if (op.type === 'emotion') rig.setEmotion(op.name);
      else { act(op.name); if (op.name === 'wink') await wait(0.25); }
      continue;
    }
    const c = await op.ready;
    if (id !== runId) break;
    if (!firstSoundAt && sentAt) { firstSoundAt = performance.now(); lastLatency = firstSoundAt - sentAt; }
    rig.mode = 'speaking';
    const prev = rig.emotion;
    if (op.type === 'vocal') {
      const [emo, ges] = VOCAL_FACE[op.name] || [];
      if (typeof ges === 'string') rig.gesture(ges, Math.max(0.5, c.track.dur));
      if (emo) rig.setEmotion(emo);
    }
    if (op.type === 'sing') {
      rig.setEmotion('singing');
      rig.sway = { t0: rig.t, beat: 60 / (c.bpm ?? 112) };
      sub('♪ ' + op.text + ' ♪');
    } else if (op.type === 'say') sub(op.text);
    else sub({ laugh: 'hahaha!', giggle: 'hehe', sigh: 'haah…', gasp: '*gasp*', hmm: 'hmm…', wow: 'wow!', aww: 'aww…', yay: 'yay!', ooh: 'ooh!' }[op.name] || '');
    await playClip({ ...c, mouth: op.type === 'vocal' && !c.natural ? VOCAL_MOUTH[op.name] : null });
    if (id !== runId) break;
    rig.sway = null;
    if (op.type === 'vocal') {                 // happy sounds leave a happy face; a gasp or hmm returns to what she was feeling
      if (['laugh', 'giggle', 'yay', 'wow'].includes(op.name)) rig.setEmotion('joy');
      else if (VOCAL_FACE[op.name]?.[0] && op.name !== 'aww') rig.setEmotion(prev);
    }
    await wait(op.type === 'say' ? 0.06 : 0.1);
    if (id !== runId) break;
    sub('');
  }
  if (owner !== id) return;                    // replaced while it waited: the newer loop owns the queue now
  owner = -1; running = false;
  if (id === runId && streamDone) { rig.mode = 'idle'; rig.relaxIn(4); }
}
const wait = s => new Promise(r => setTimeout(r, s * 1000));
// One set of tags, and each body does what it can with them: Vita moves her whole body, the display robots act with their eyes, the rest make a smaller gesture.
const ON_DISPLAY = { spin: 'roll', dance: 'groove', hop: 'wake', celebrate: 'sparkle', clap: 'blink', bow: 'doze', point: 'sideeye' };
const SMALLER = { spin: 'tilt', dance: 'bounce', hop: 'bounce', celebrate: 'bounce', clap: 'nod', bow: 'nod', heart: 'tilt', point: 'nod', sideeye: 'tilt', sparkle: 'bounce', roll: 'tilt', peek: 'tilt', doze: 'nod', groove: 'bounce', wake: 'bounce', blink: 'nod' };
function act(name) {
  if (current.led && (REACTIONS[name] || ON_DISPLAY[name])) rig.react(REACTIONS[name] ? name : ON_DISPLAY[name]);
  else if (current.moves && MOVES[name]) rig.move(name);
  else rig.gesture(SMALLER[name] ?? name);
}

// --- Brain ---------------------------------------------------------------------
const conversationIds={};
const sessionId=()=>conversationIds[current.packId]??=crypto.randomUUID();
const histories = {};                          // each character keeps their own conversation
const IDLE_PROMPT = "(Nobody has said anything for a while. Say one short, fresh thing to your stream on your own: a thought, a question for chat, or a little tune. Don't mention the silence.)";
function bubble(role, text, who) {
  $('#empty')?.remove();
  const d = document.createElement('div'), n = document.createElement('small'), t = document.createElement('span');
  d.className = 'msg ' + role; n.textContent = who ?? (role === 'user' ? 'You' : current.name); t.textContent = text;
  d.append(n, t); $('#messages').append(d); $('#messages').scrollTop = 1e9; $('#suggest').hidden = true;
  return t;
}
function showHistory() {
  $('#messages').replaceChildren(); $('#talkTitle').textContent = `Talking with ${current.name}`;
  const shown = (histories[current.packId] ?? []).filter(m => m.content !== IDLE_PROMPT);
  for (const m of shown) bubble(m.role, plainText(m.content), m.local ? `${current.name} · intro, from local metadata` : undefined);
  $('#suggest').hidden = !!shown.length;
  if (!shown.length) { const e = document.createElement('div'); e.id = 'empty'; e.textContent = `Say or type anything. ${current.name} remembers this conversation until you reload.`; $('#messages').append(e); }
}
let streamDone = true;
const plainText = s => s.replace(/\[[^\]]*\]|[*_`#]/g, '').replace(/\s+/g, ' ').trim();
function introduce(text) {                     // from the character sheet, and labelled as such
  const history = histories[current.packId] ??= [], line = plainText(current.intro);
  stopAll();
  history.push({ role: 'user', content: text }, { role: 'assistant', content: current.intro, local: true });
  chat('You', text); chat(`${current.name} (intro, local)`, line);
  selectPanel('talk'); bubble('user', text); bubble('assistant', line, `${current.name} · intro, from local metadata`);
  $('#log').textContent = `You: ${text}   →   ${current.name} (character introduction, from local metadata): ${line}`;
  sentAt = performance.now(); firstSoundAt = 0; streamDone = true;
  pushEmotion = rig.emotion;
  enqueue(parse(current.intro));
}
async function ask(text, { idle = false } = {}) {
  if (!idle && isIntro(text)) return introduce(text);
  stopAll();
  const history = histories[current.packId] ??= [];
  history.push({ role: 'user', content: text });
  if (!idle) { $('#log').textContent = 'You: ' + text; chat('You', text); selectPanel('talk'); bubble('user', text); }
  sentAt = performance.now(); firstSoundAt = 0;
  rig.mode = 'thinking'; rig.setEmotion('thinking'); streamDone = false;
  const id = runId, parser = new Parser({ clause: !chosenVoice() });   // a natural voice takes a moment per line, so it gets whole sentences rather than a short clause followed by a gap
  let reply = '', replyText = null;
  const feed = t => {
    if (id !== runId) return;
    reply += t;
    (replyText ??= bubble('assistant', '')).textContent = plainText(reply.replace(/\[[^\]]*$/, ''));
    enqueue(parser.push(t));
  };
  try {
    if (serverBrain === 'scripted') throw new Error('scripted');
    chatAbort = new AbortController();
    const r = await fetch('/chat', { method: 'POST', body: JSON.stringify({ messages: history, character: current.id, pack:current.packId, profile:current.profileId, session:sessionId() }), signal: chatAbort.signal });
    if (!r.ok) throw new Error('chat ' + r.status);
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const parts = buf.split('\n\n'); buf = parts.pop();
      for (const p of parts) {
        const m = JSON.parse(p.replace(/^data: /, ''));
        if (m.error) throw new Error(m.error);
        feed(m.text);
      }
    }
  } catch (e) {
    if (id !== runId) return;                  // stopped on purpose
    if (e.message !== 'scripted') console.warn('brain error, using scripted reply', e);
    if (!reply) {
      feed(e.message === 'scripted' ? named(idle ? IDLE_LINE() : scriptedReply(text)) : "[confused] Oops, my brain link just dropped. [sigh] Can you try that again?");
    }
  }
  if (id !== runId) return;
  chatAbort=null;
  streamDone = true;
  enqueue(parser.flush());
  history.push({ role: 'assistant', content: reply });
  chat(current.name, plainText(reply));
  $('#log').textContent = 'You: ' + text + `   →   ${current.name}: ` + plainText(reply);
}

const named = s => s.replaceAll('Nori', current.name);
function perform(markup) {
  stopAll();
  streamDone = true; sentAt = 0;
  pushEmotion = rig.emotion;
  enqueue(parse(markup));
}
function stopEverything() {
  stopAll();
  rig.stopMove(); rig.reaction = null; rig.gestures = []; rig.sway = null; rig.mode = 'idle'; rig.relaxIn(1);
}

// The guided reel: one beat at a time, with its title and a progress bar. Anything else you do ends it.
function endReel() {
  reel = null;
  if (reelPaused) { reelPaused = false; audio().resume(); }
  $('#chapter').hidden = true; $('#quick').hidden = false; $('#reelPause').textContent = 'Pause';
}
function pauseReel() {
  if (!reel) return;
  reelPaused = !reelPaused;
  if (reelPaused) audio().suspend(); else audio().resume();
  $('#reelPause').textContent = reelPaused ? 'Resume' : 'Pause';
}
async function playReel() {
  startupTrace("reel-click",{character:current.id,voice:chosenVoice(),cachedClips:readyClips.size});
  stopEverything();
  const mine = reel = {}, { title, beats } = reelFor(current);
  $('#chapter').hidden = false; $('#quick').hidden = true; rig.relaxAt = Infinity;
  streamDone = true; sentAt = 0; pushEmotion = rig.emotion;
  // One queue for the whole reel, so every line starts rendering now and each is ready before the one before it ends. Rendering a beat at a time left the voice silent for seconds while her body kept going.
  enqueue(beats.flatMap(([name, markup], i) => [{ type: 'chapter', label: `${title} ${i + 1}/${beats.length}: ${name}`, at: i / beats.length }, ...parse(named(markup)).map(o => ({ ...o, reel: true }))]));
  if($('#reelSinger').checked){
    enqueue([{type:'chapter',label:'Singer A · prepared SoulX performance',at:.97},
      {type:'gesture',name:current.led?'groove':'dance'},
      {type:'sing',text:'You light up my day. Stay here close to me.',sample:'singer-a'}]);
  }
  do await wait(0.1); while (reel === mine && (running || queue.length || reelPaused));
  if (reel === mine) { endReel(); rig.relaxIn(3); }
}

// --- Singing: type lyrics and she sings them --------------------------------------
// The experimental singer (JaegerLyra's SoulX) renders the whole song first, about half a minute; her own Kokoro voice is quicker.
let song = null;
const singInfo = t => { $('#singInfo').textContent = t; };
const songClip = async (samples, sr, bpm) => ({ samples, sr, natural: true, bpm, beats: Array.from({ length: Math.floor(samples.length / sr * bpm / 60) }, (_, i) => i * 60 / bpm), track: await work('analyze', samples, sr) });
function performSong(lyrics, c) { streamDone = true; enqueue([{ type: 'sing', text: lyrics.replace(/\s*\n\s*/g, ' / '), clip: c }]); }
function showSingMethod() { document.querySelectorAll('#singSection .soulx').forEach(r => { r.hidden = $('#singMethod').value !== 'soulx'; }); }
$('#singMethod').onchange = showSingMethod;
$('#singStop').onclick = () => { if (song) { fetch('/singer/stop', { method: 'POST', body: JSON.stringify({ id: song.id }) }).catch(() => {}); song.off = true; song = null; } stopEverything(); singInfo('Stopped.'); };
$('#singGo').onclick = async () => {
  const lyrics = $('#lyrics').value.trim(), method = $('#singMethod').value, voiceId = chosenVoice();
  if (!lyrics) return singInfo('Type a line or two first.');
  if (song) $('#singStop').onclick();
  stopEverything(); startSound();const generation=runId;
  if (method !== 'soulx') {
    if (!singsHalf(voiceId)) return singInfo('Her own voice needs Kokoro on this Mac\'s GPU. Try the experimental singer.');
    singInfo('Making the song…');
    const c = await singNatural(lyrics.replace(/\s*\n\s*/g, ', '), voiceId, serverTurn, method).catch(() => null);
    if(generation!==runId)return;
    return c ? (singInfo(''), performSong(lyrics, c)) : singInfo('That didn\'t work. Try again.');
  }
  const tempo = +$('#singTempo').value, mine = song = { off: false };
  try {
    const r = await fetch('/singer/start', { method: 'POST', body: JSON.stringify({ lyrics, voice: voiceId ?? '', melody: $('#singMelody').value, tempo, transpose: +$('#singPitch').value, reference: $('#singRef').value }) });
    const j = await r.json();
    if (!r.ok) { song = null; return singInfo(j.error); }
    mine.id = j.id;
    if(mine.off){fetch('/singer/stop',{method:'POST',body:JSON.stringify({id:j.id})}).catch(()=>{});return;}
    for (let st = j; st.status !== 'ready'; ) {
      if (['error', 'stopped'].includes(st.status)) { song = null; return singInfo(st.phase); }
      singInfo(st.phase ?? 'Starting…');
      await wait(0.7);
      if (mine.off) return;
      st = await (await fetch('/singer/status?id=' + mine.id)).json();
    }
    singInfo('Ready. She\'s singing.');
    const { samples, sr } = readWav(await (await fetch('/singer/audio?id=' + mine.id)).arrayBuffer());
    if (mine.off) return;
    song = null;
    performSong(lyrics, await songClip(samples, sr, tempo));
  } catch { if (!mine.off) { song = null; singInfo('The singer stopped unexpectedly. Try again.'); } }
};
showSingMethod();

// --- Controls ------------------------------------------------------------------
$('#form').onsubmit = e => {
  e.preventDefault();
  const t = $('#input').value.trim();
  if (t) { $('#input').value = ''; ask(t); }
};
$('#input').addEventListener('input', () => rig.typing());
$('#input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#form').requestSubmit(); } });   // Shift-Enter for a new line
// Voice: click the mic once and just talk. When you stop, Whisper on this machine turns it into text and she answers.
// Talk over her and her voice drops at once; she only stops for good when the words turn out to be yours, not her own echo.
let closeMic = null, micOpening = false, hearing = false, overHer = false, turn = 0, lastHear = null;
const talking = () => running || !!clip;
const duck = on => speaker().gain.setTargetAtTime(on ? 0.2 : 1, audio().currentTime, 0.03);
function micState(state, note) {
  const b = $('#mic');
  b.textContent = { off: 'Mic', on: 'Listening', hearing: 'Hearing you', working: 'Got it…' }[state];
  b.dataset.state = state;
  b.setAttribute('aria-pressed', state !== 'off');
  $('#input').placeholder = note ?? (state === 'off' ? `Talk to ${current.name}. Try: tell me a joke / sing me a song / I had a bad day` : 'Listening. Just talk, or type here.');
}
// Whisper starts as soon as there's a pause. If it was the end of the sentence, the words are already there and a third of a second is saved.
let early = null;
const transcribe = samples => fetch(`/hear?name=${encodeURIComponent(current.name)}`, { method: 'POST', body: toPcm(samples).buffer }).then(r => { if (!r.ok) throw new Error('hear ' + r.status); return r.json(); });
async function heard(samples) {
  const mine = ++turn, wasOver = overHer, t0 = performance.now(), job = early ?? transcribe(samples);
  early = null;
  micState('working');
  let text = '', failed = false;
  try { ({ text } = await job); } catch (e) { console.warn('speech model error', e); failed = true; }
  if (mine !== turn || !closeMic) return;                     // she was turned off, or they already spoke again
  lastHear = performance.now() - t0;
  micState('on', failed ? "Couldn't reach the speech model. You can still type." : undefined);
  duck(false);
  if (text && !(wasOver && isEcho(text, spoken))) ask(text);
}
async function setMic(on) {
  if (!on) { closeMic?.(); closeMic = null; hearing = false; early = null; turn++; duck(false); showPrivacy(); return micState('off'); }
  if (!serverEars) return micState('off', 'The speech model did not load. See the server output, or type here.');
  if (micOpening) return;                        // a permission prompt can stay up for a while, and a second click must not open a second mic
  micOpening = true;
  try {
    if (!window.AudioWorkletNode || !navigator.mediaDevices) throw new Error('unsupported');
    closeMic = await openMic(audio(), {
      start() { hearing = true; overHer = talking(); turn++; lastTalk = performance.now(); duck(true); micState('hearing'); },
      pause(samples) { rig.gesture('nod'); early = transcribe(samples); early.catch(() => {}); },
      resume() { early = null; },
      cancel() { hearing = false; early = null; duck(false); micState('on'); },
      end(samples) { hearing = false; heard(samples); },
    }, talking);
    micState('on'); showPrivacy();
  } catch (e) {
    console.warn('mic unavailable', e);
    micState('off', e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this page in the browser, then click Mic.' : "Couldn't open a microphone. You can still type.");
  }
  micOpening = false;
}
$('#mic').onclick = () => setMic(!closeMic);
$('#reel').onclick = playReel;
$('#reelPause').onclick = pauseReel;
$('#stop').onclick = stopEverything;
function setTiming(onTwos) { TIMING.onTwos = onTwos; $('#timing').textContent = onTwos ? 'Anime, on twos' : 'Smooth, 60 fps'; remember({ onTwos }); }
$('#timing').onclick = () => setTiming(!TIMING.onTwos);
// Panels
function selectPanel(name) {
  for (const b of $('#panelTabs').children) { const on = b.dataset.panel === name; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; }
  for (const p of ['perform', 'talk', 'studio']) $(`#${p}Panel`).hidden = p !== name;
  remember({ panel: name });
}
for (const b of $('#panelTabs').children) {
  b.onclick = () => selectPanel(b.dataset.panel);
  b.onkeydown = e => {
    const tabs = [...$('#panelTabs').children], i = tabs.indexOf(b), to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); const t = tabs[(to + tabs.length) % tabs.length]; selectPanel(t.dataset.panel); t.focus(); }
  };
}
// Expression and sound
function setEnergy(v) { rig.energy = v; $('#energy').value = v; $('#energyVal').textContent = Math.round(v * 100) + '%'; remember({ energy: v }); }
$('#energy').oninput = e => setEnergy(+e.target.value);
function setMuted(on) { muted = on; if (master) master.gain.setTargetAtTime(on ? 0 : 1, audio().currentTime, 0.02); $('#mute').textContent = on ? 'Muted' : 'Sound on'; $('#mute').setAttribute('aria-pressed', on); remember({ muted: on }); }
$('#mute').onclick = () => setMuted(!muted);
$('#fresh').onclick = () => { stopEverything(); histories[current.packId] = []; conversationIds[current.packId]=crypto.randomUUID(); showHistory(); $('#log').textContent = ''; };
for (const [label, prompt] of [['Tell me a joke', 'Tell me a joke'], ['Sing me something', 'Sing me an original little song'], ['I had a bad day', 'I had a bad day'], ['Surprise me', 'Surprise me with something delightful']]) {
  const b = document.createElement('button'); b.textContent = label; b.onclick = () => ask(prompt); $('#suggest').append(b);
}
// Stream mode: the stage fills the window with captions and a chat, and the character talks on her own when things go quiet.
// For OBS, add a browser source at ?stream=1&obs=1&bg=clear (or bg=green). With no typing box there, she runs on idle talk alone.
const IDLE_SECONDS = 22;
function chat(who, text) {
  if (!text) return;
  const d = document.createElement('div'), b = document.createElement('b'); b.textContent = who + ': '; d.append(b, text);
  $('#chat').append(d);
  while ($('#chat').children.length > 5) $('#chat').firstChild.remove();
}
function setStream(on) {
  document.body.classList.toggle('stream', on);
  (on ? $('#dock') : $('#talkPanel')).append($('#form'));   // one message box: in the conversation, or under her in stream mode
  $('#plate').textContent = current.name; lastTalk = performance.now();
  if (on) $('#input').focus();
}
const BGS = ['room', 'green', 'clear'], BG_NAME = { room: 'room', green: 'green screen', clear: 'transparent' };
function setBg(mode) { document.body.dataset.bg = mode; $('#bgBtn').textContent = BG_NAME[mode][0].toUpperCase() + BG_NAME[mode].slice(1); }
let lastTalk = performance.now();
$('#stream').onclick = $('#streamBtn').onclick = () => setStream(true);
$('#exit').onclick = () => setStream(false);
const KEYS = { s: 'spin', d: 'dance', j: 'hop', c: 'clap', b: 'bow', h: 'heart', p: 'point', w: 'wink', e: 'celebrate' };
addEventListener('keydown', e => {
  if (e.key === 'Escape') { stopEverything(); setStream(false); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { e.preventDefault(); setStream(!document.body.classList.contains('stream')); }
  else if (k === 'm') { e.preventDefault(); setMic(!closeMic); }
  else if (k === 'r') { e.preventDefault(); toggleRecording(); }
  else if (k === 'v') { e.preventDefault(); $('#abVoice').click(); }
  else if (e.code === 'Space' && reel && e.target.tagName !== 'BUTTON') { e.preventDefault(); pauseReel(); }
  else if (KEYS[k]) { e.preventDefault(); act(KEYS[k]); }
});
// Tap the character for a hello. Not while she's busy.
$('#stage').addEventListener('click', e => { if (!e.target.closest('button') && !running && rig.mode === 'idle') act(current.led ? 'wake' : 'wave'); });
$('#bgBtn').onclick = () => setBg(BGS[(BGS.indexOf(document.body.dataset.bg) + 1) % 3]);
setInterval(() => {
  if (following() || rig.mode !== 'idle' || running || hearing || $('#input').value) lastTalk = performance.now();
  else if (document.body.classList.contains('stream') && performance.now() - lastTalk > IDLE_SECONDS * 1000) { lastTalk = performance.now(); ask(IDLE_PROMPT, { idle: true }); }
}, 1000);

// A model file from the person's own disk goes straight onto the model character's rig.
const showMeta = async job => {
  const info = $('#modelInfo');
  info.textContent = 'Loading model…';
  try { const m = await job; $('#loading').hidden = true; info.replaceChildren([m.title, m.author && `by ${m.author}`].filter(Boolean).join(' · ') + ' · Licence: ');
    if (/^https?:/.test(m.licence ?? '')) { const a = document.createElement('a'); a.href = m.licence; a.target = '_blank'; a.rel = 'noopener'; a.textContent = new URL(m.licence).hostname; a.style.color = 'var(--accent)'; info.append(a); } else info.append(m.licence || 'not stated'); }
  catch (e) { $('#loading').hidden = true; info.textContent = `Couldn't load that model: ${e.message}`; console.error(e); }
};
const loadFile = file => {
  setView('vita');
  const url = URL.createObjectURL(file);
  const f = faceFor('vita'), job = f.load(url).finally(() => URL.revokeObjectURL(url));
  watchLoad(f); showMeta(job);
  job.then(() => { keepModel(file); shareModel(file); $('#resetModel').hidden = false; toast('Your model is loaded, and will be here next time.'); }).catch(() => {});
};
const shareModel = file => fetch('/relay/model', { method: 'POST', body: file }).then(r => r.ok ? r.json() : null).then(r => { if (r) modelRev = r.rev; }).catch(() => {});   // so output windows can show it too
const keepModel = async file => { try { await (await caches.open(MODEL_STORE)).put('/my-model', new Response(file)); } catch { /* it just won't come back next time */ } };
$('#resetModel').onclick = async () => {
  try { await caches.delete(MODEL_STORE); } catch { /* nothing kept */ }
  const f = faceFor('vita'); watchLoad(f); showMeta(f.load(DEFAULT_MODEL));
  modelRev = 0; $('#resetModel').hidden = true;
};
if (myModel) { shareModel(myModel); $('#resetModel').hidden = false; }
function watchLoad(f) {
  const box = $('#loading'); box.hidden = false; box.textContent = 'Loading the model…';
  f.onProgress = p => { box.textContent = p < 1 ? `Loading the model… ${Math.round(p * 100)}%` : 'Getting her ready…'; };
}
$('#file').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
$('#stage').addEventListener('dragover', e => e.preventDefault());
$('#stage').addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.(vrm|glb|gltf)$/i.test(f.name)) loadFile(f); });
const FEELING = { neutral: ['○', 'Calm'], joy: ['☀', 'Joy'], excited: ['✷', 'Excited'], love: ['♡', 'Love'], sad: ['☂', 'Sad'], angry: ['⚡', 'Angry'], surprised: ['!', 'Surprised'], scared: ['⚠', 'Scared'], thinking: ['…', 'Thinking'], confused: ['?', 'Confused'], shy: ['❀', 'Shy'], smug: ['⌐', 'Smug'], sleepy: ['☾', 'Sleepy'], laughing: ['☺', 'Laughing'], singing: ['♪', 'Singing'], listening: ['◉', 'Listening'] };
for (const name of Object.keys(EMOTIONS)) {
  if (['laughing', 'singing', 'listening'].includes(name)) continue;
  const b = document.createElement('button'), i = document.createElement('span');
  i.textContent = FEELING[name]?.[0] ?? '○'; i.setAttribute('aria-hidden', 'true'); b.append(i, FEELING[name]?.[1] ?? name); b.dataset.emotion = name;
  b.onclick = () => { stopAll(); rig.mode = 'idle'; rig.setEmotion(name); rig.relaxIn(6); };
  $('#emo').append(b);
}
// The feeling and state she's in, in words, under the stage and on the grid.
let shownMood = '';
function moodUI() {
  const key = `${rig.emotion}/${rig.mode}/${hearing}`;
  if (key === shownMood) return;
  shownMood = key;
  const [icon, label] = FEELING[rig.emotion] ?? ['○', rig.emotion];
  $('#moodIcon').textContent = hearing ? '◉' : icon;
  $('#moodLabel').textContent = hearing ? 'Listening to you' : rig.mode === 'thinking' ? 'Thinking it over' : rig.emotion === 'neutral' ? (rig.mode === 'speaking' ? 'Talking' : 'Here with you') : label;
  for (const b of $('#emo').children) { const on = b.dataset.emotion === rig.emotion; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
}
// Moves or eye reactions, whichever this character has.
function fillMoves() {
  const names = current.led ? Object.keys(REACTIONS) : current.moves ? Object.keys(MOVES) : [];
  $('#movesBox').hidden = !names.length; $('#displayRow').hidden = !current.led;
  $('#movesTitle').textContent = current.led ? 'Eye reactions' : 'Full-body moves';
  const button = (name, withKey) => {
    const b = document.createElement('button'), [icon, label] = ACT_LOOK[name] ?? ['', name];
    b.append(`${icon} ${label}`); b.onclick = () => act(name);
    const k = withKey && Object.keys(KEYS).find(c => KEYS[c] === name);
    if (k) { const K = document.createElement('kbd'); K.textContent = k.toUpperCase(); b.append(K); }
    return b;
  };
  $('#moves').replaceChildren(...names.map(n => button(n, true)));
  $('#quick').replaceChildren(...(current.rep.adapter==='jaeger-study' ? (['hal_9000','glados','tars','jarvis','helldiver','daft_punk_1','daft_punk_2'].includes(current.rep.preset)?[]:['wink']) : current.led ? ['wink', 'heart', 'peek'] : current.moves ? ['spin', 'dance', 'celebrate'] : ['wave', 'nod', 'bounce']).map(n => button(n, false)));
}
const ACT_LOOK = { spin: ['⟳', 'Spin'], dance: ['♫', 'Dance'], hop: ['↟', 'Hop'], celebrate: ['✷', 'Celebrate'], clap: ['✦', 'Clap'], bow: ['⌄', 'Bow'], heart: ['♡', 'Heart'], point: ['↗', 'Point'], blink: ['◡', 'Blink'], wink: ['◕', 'Wink'], sideeye: ['⌁', 'Side-eye'], sparkle: ['✧', 'Sparkle'], roll: ['↻', 'Eye roll'], peek: ['◒', 'Peekaboo'], doze: ['☾', 'Doze'], groove: ['♫', 'Groove'], wake: ['!', 'Wake up'], wave: ['✋', 'Wave'], nod: ['↓', 'Nod'], bounce: ['↟', 'Bounce'] };
const DISPLAYS = ['mouth', 'eyes', 'pixels'], DISPLAY_NAME = { mouth: 'Eyes and mouth', eyes: 'Eyes only', pixels: 'Pixels' };
function setDisplay(mode) { DISPLAY.mode = mode; $('#display').textContent = DISPLAY_NAME[mode]; remember({ display: mode }); }
$('#display').onclick = () => setDisplay(DISPLAYS[(DISPLAYS.indexOf(DISPLAY.mode) + 1) % 3]);
const ACTS = [...VOCAL_NAMES, 'sing', 'wink', 'nod', 'shake', 'tilt', 'shrug', 'bounce'];
for (const name of ACTS) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => perform(name === 'sing' ? '[singing] [sing] Tiny little lights are glowing, wires humming soft and low. [/sing]' : `[${name}]`);
  $('#act').append(b);
}
const pointerAt = e => {
  const r = $('#stage').getBoundingClientRect();
  rig.look((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
};
$('#stage').addEventListener('pointermove', pointerAt);

// --- HUD -----------------------------------------------------------------------
const SHOWN = ['lidL', 'lidR', 'arc', 'browL', 'browR', 'tilt', 'gazeX', 'gazeY', 'jaw', 'wide', 'round', 'teeth', 'smile', 'yaw', 'pitch', 'roll', 'crouch', 'lift', 'blush'];
const bars = {};
for (const k of SHOWN) {
  const l = document.createElement('div'); l.textContent = k;
  const b = document.createElement('div'); b.className = 'bar';
  const i = document.createElement('i'); b.append(i);
  $('#bars').append(l, b); bars[k] = i;
}
function hudStatic() {
  const brainName = serverBrain === 'scripted' ? 'Scripted, no model' : /gemma/i.test(serverBrain) ? (serverBrain.startsWith('JaegerAgent')?'JaegerAgent · Gemma':'Gemma · local') : 'Claude · cloud';
  $('#status').textContent = brainName + (viewers ? ` · ${viewers} output window${viewers > 1 ? 's' : ''}` : '');
  const v = chosenVoice();
  $('#status').title = `Brain: ${serverBrain}. Voice: ${v ?? (serverVoice ? (current.voice||KRISTIN).split('-')[1] : 'built-in synth')}.`;
  $('#light').classList.toggle('on', serverBrain !== 'scripted');
}
const showPrivacy = () => { const mic = !!closeMic || !!liveMouth, cam = !!stopCam, p = $('#privacy'); p.textContent = `Mic ${mic ? 'on' : 'off'} · Camera ${cam ? 'on' : 'off'}`; p.classList.toggle('live', mic || cam); };
hudStatic();
const stats = { fps: 60, frame: 0, rig: 0 };
let hudAt = 0;
function hud(now) {
  if (now - hudAt < 150 || !$('#under').open) return;   // only spend layout on numbers someone is looking at
  hudAt = now;
  $('#hud').innerHTML = `fps&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>${stats.fps.toFixed(0)}</b><br>frame&nbsp;&nbsp;&nbsp;<b>${stats.frame.toFixed(1)} ms</b><br>rig&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>${(stats.rig * 1000).toFixed(0)} µs</b><br>channels&nbsp;<b>${CHANNELS.length}</b> floats, <b>${(CHANNELS.length * 4 * 60 / 1024).toFixed(1)} KB/s</b> at 60 Hz<br>state&nbsp;&nbsp;&nbsp;<b>${rig.mode} / ${rig.emotion}</b><br>mic→text&nbsp;&nbsp;<b>${lastHear ? lastHear.toFixed(0) + ' ms' : '-'}</b><br>send→voice&nbsp;<b>${lastLatency ? lastLatency.toFixed(0) + ' ms' : '-'}</b>`;
  for (const k of SHOWN) {
    const v = Math.max(-1, Math.min(1, rig.out[k]));
    const s = bars[k].style;
    s.left = (v < 0 ? 50 + v * 50 : 50) + '%'; s.width = Math.abs(v) * 50 + '%';
  }
}

// --- Output windows ------------------------------------------------------------
// A page opened with ?obs=1 draws what the controller page is performing, through the local server, even from another browser or OBS.
// With no controller running it falls back to performing on its own. The controller only sends while somebody is watching.
const isOutput = params.has('obs');
let relayBusy = false, relayAt = 0, modelRev = 0, followedAt = -1e9, shownModel = 0;
const following = () => performance.now() - followedAt < 2000;
function publish(now) {
  if (isOutput || !viewers || relayBusy || now - relayAt < 32 || !rig.t) return;
  relayBusy = true; relayAt = now;
  const out = {};
  for (const [k, v] of Object.entries(rig.out)) if (Number.isFinite(v)) out[k] = +v.toFixed(4);
  const body = JSON.stringify({ at: Date.now(), turnTo: faces[current.id]?.turnTo ?? 0, fullLock: !!faces[current.id]?.fullLock, calm: STAGE.calm, backdrop: STAGE.backdrop, view, out, t: rig.t, energy: rig.energy, emotion: rig.emotion, emotionAt: rig.emotionAt, mode: rig.mode, attentive: rig.attentive, reaction: rig.reaction, act: rig.act, fx: rig.fx, onTwos: TIMING.onTwos, display: DISPLAY.mode, model: modelRev,
    sub: $('#sub').textContent, plate: current.name, chat: [...$('#chat').children].map(d => [d.firstChild.textContent, d.lastChild.textContent]) });
  fetch('/relay/frame', { method: 'POST', body }).catch(() => {}).finally(() => { relayBusy = false; });
}
function follow(f) {
  if (!following()) stopAll();
  followedAt = performance.now();
  Object.assign(rig.out, f.out);
  rig.t = f.t; rig.energy = f.energy; rig.emotion = f.emotion; rig.emotionAt = f.emotionAt; rig.mode = f.mode; rig.attentive = f.attentive; rig.reaction = f.reaction; rig.act = f.act; rig.fx = f.fx;
  TIMING.onTwos = f.onTwos; DISPLAY.mode = f.display; STAGE.calm = f.calm; STAGE.backdrop = f.backdrop;
  if (f.view !== view) setView(f.view);
  const shown=faceFor(current.id);shown.turnTo=f.turnTo;shown.fullLock=f.fullLock;
  if (f.model !== shownModel) { shownModel = f.model; faceFor('vita').load(f.model ? `/relay/model?${f.model}` : DEFAULT_MODEL).catch(console.warn); }
  sub(f.sub); $('#plate').textContent = f.plate;
  if (f.chat.length !== $('#chat').children.length || f.chat.at(-1)?.[1] !== $('#chat').lastChild?.lastChild.textContent) { $('#chat').replaceChildren(); for (const [who, text] of f.chat) { const d = document.createElement('div'), b = document.createElement('b'); b.textContent = who; d.append(b, text); $('#chat').append(d); } }
}
if (isOutput) new EventSource('/relay/events').onmessage = e => follow(JSON.parse(e.data));
else {
  const watch = () => fetch('/relay/status').then(r => r.json()).then(s => { if (s.viewers !== viewers) { viewers = s.viewers; hudStatic(); } }).catch(() => { viewers = 0; });
  watch(); setInterval(watch, 1500);
}

// --- Plugins -------------------------------------------------------------------
// Perform as the character: your voice moves her mouth, with no AI in the loop. Her own lines take over while she's talking.
let liveMouth = null, lipBusy = false;
$('#lipBtn').onclick = async () => {
  if (lipBusy) return;
  const b = $('#lipBtn');
  if (liveMouth) { liveMouth.stop(); liveMouth = null; rig.voice = null; b.textContent = 'Live mic lip sync'; b.setAttribute('aria-pressed', 'false'); camNote(''); showPrivacy(); return; }
  lipBusy = true;
  try {
    const plugin = await import('./plugins/lipsync.js');
    await audio().resume();
    liveMouth = await plugin.start(audio());
    b.textContent = 'Live mic lip sync: on'; b.setAttribute('aria-pressed', 'true'); camNote('Your voice moves her mouth. It is not recorded or sent anywhere.'); showPrivacy();
  } catch (e) {
    console.warn('lip sync', e);
    camNote(e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this page in the browser, then try again.' : "Couldn't open a microphone.");
  }
  lipBusy = false;
};
// Turning the character, and how much of her is in shot.
const vitaFace = () => (view === 'vita' ? faces.vita : null);
function fillViews() {
  const box = $('#views'); box.hidden = !current.rep.adapter.endsWith('vrm');
  for (const b of box.querySelectorAll('[data-turn]')) b.setAttribute('aria-pressed', Math.abs((faces[current.id]?.turnTo ?? 0) - +b.dataset.turn) < 0.01);
  $('#viewFull').setAttribute('aria-pressed', !!faces[current.id]?.fullLock);
}
$('#views').addEventListener('click', e => {
  const b = e.target.closest('button'), f = faceFor(current.id);
  if (!b || !f) return;
  if (b.id === 'viewFull') f.fullLock = !f.fullLock; else f.turnTo = +b.dataset.turn;
  fillViews();
});
// Stage options
function setCalm(on) { STAGE.calm = on; $('#calmBtn').textContent = on ? 'Calm, steady shot' : 'Moves with the mood'; remember({ calm: on }); }
function setBackdrop(on) { STAGE.backdrop = on; $('#backdropBtn').textContent = on ? 'On' : 'Off'; remember({ backdrop: on }); }
$('#calmBtn').onclick = () => setCalm(!STAGE.calm);
$('#backdropBtn').onclick = () => setBackdrop(!STAGE.backdrop);

// Optional and loaded on first use. Delete web/plugins/webcam and the rest of the app carries on without it.
let stopCam = null, camBusy = false;
const camNote = text => { $('#camInfo').textContent = text; };
$('#camBtn').onclick = async () => {
  if (camBusy) return;
  if (stopCam) { stopCam(); stopCam = null; rig.puppet = null; $('#camBtn').setAttribute('aria-pressed', 'false'); $('#camBtn').textContent = 'Webcam tracking'; camNote(''); showPrivacy(); return; }
  camBusy = true; camNote('Loading the face tracker…');
  try {
    const plugin = await import('./plugins/webcam/index.js');
    stopCam = await plugin.start(rig, camNote, () => {
      stopCam = null;
      $('#camBtn').setAttribute('aria-pressed', 'false');
      $('#camBtn').textContent = 'Webcam tracking'; showPrivacy();
    });
    $('#camBtn').setAttribute('aria-pressed', 'true'); $('#camBtn').textContent = 'Webcam tracking: on'; showPrivacy();
  } catch (e) {
    console.warn('webcam plugin', e);
    camNote(e.name === 'NotAllowedError' ? 'The camera is blocked. Allow it for this page in the browser, then try again.' : e.name === 'TypeError' ? 'The webcam plugin is not installed.' : `Webcam tracking did not start: ${e.message}`);
  }
  camBusy = false;
};

// --- Voices --------------------------------------------------------------------
const SAMPLE_SCRIPT = "Hello! I'm recording a short sample so this app can learn how my voice sounds. It's an ordinary day, and I'm speaking the way I normally do.";
function buildVoiceBox() {
  $('#voiceBox').innerHTML = `
    <div class="row"><span>Engine</span><select id="voiceEngine" aria-label="Voice engine"><option value="natural">Kokoro</option><option value="fast">Original (Piper)</option></select></div>
    <div class="row" id="voicePickRow"><span id="voicePickLabel">Voice</span><select id="voicePick" aria-labelledby="voicePickLabel"></select></div>
    <div class="row"><span>Singing</span><select id="singWith" aria-label="Singing voice"><option value="kokoro">Her voice, on the beat</option><option value="sung">Her voice, half-sung</option><option value="classic">Classic singer</option><option value="voice">This voice (experimental)</option></select></div>
    <div class="row"><span id="voiceState" class="note"></span><button id="voiceTry" type="button">Hear it</button></div>
    <button id="voiceDelete" type="button" hidden>Delete this cloned voice</button>
    <details id="cloneBox"><summary>Clone a voice from one sample</summary>
      <div class="stack" style="margin-top:8px">
        <div class="note">Record about 8 seconds of clear speech, or choose a file. The sample stays on this machine. The voice keeps the speaker's own accent.</div>
        <div class="note" id="cloneScript" hidden></div>
        <label class="note" style="display:flex;gap:7px;align-items:flex-start"><input id="cloneOk" type="checkbox" style="flex:none;margin-top:2px">This is my own voice, or the speaker has given me permission.</label>
        <input id="cloneName" aria-label="Name for this voice" placeholder="Name this voice" maxlength="40" autocomplete="off">
        <div class="row"><button id="cloneRec" type="button" disabled style="flex:1">Record 8 seconds</button><label style="flex:1"><input id="cloneFile" type="file" accept="audio/*" disabled style="position:absolute;opacity:0;width:0"><span class="btn" style="display:block;text-align:center" id="cloneFileBtn">Choose a file</span></label></div>
        <div class="note" id="cloneInfo" aria-live="polite"></div>
      </div>
    </details>`;
  $('#voiceEngine').value = saved.engine === 'fast' ? 'fast' : 'natural';
  $('#singWith').value = ['voice', 'classic', 'sung'].includes(saved.singing) ? saved.singing : 'kokoro';
  $('#singWith').onchange = e => { remember({ singing: e.target.value }); preloadReel(); };
  $('#voiceEngine').onchange = e => setEngine(e.target.value);
  $('#voicePick').onchange = e => { remember({ voices: { ...saved.voices, [current.id]: e.target.value } }); warmClone(); showVoices(); preloadReel(); };
  $('#voiceTry').onclick = () => perform(`[joy] Hi, I'm ${current.name}. [surprised] Oh! [joy] This is how I sound.`);
  $('#voiceDelete').onclick = async () => {
    const id = $('#voicePick').value;
    await fetch('/voice/delete', { method: 'POST', body: JSON.stringify({ id }) });
    const voices = { ...saved.voices }; for (const k of Object.keys(voices)) if (voices[k] === id) delete voices[k];
    remember({ voices }); refreshVoices();
  };
  $('#cloneOk').onchange = e => { $('#cloneRec').disabled = $('#cloneFile').disabled = !e.target.checked; };
  $('#cloneRec').onclick = recordSample;
  $('#cloneFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) addClone(f, f.name.replace(/\.[^.]+$/, '')); };
}
const warmClone = () => { if (chosenVoice()?.startsWith('clone:')) fetch('/voice/warm', { method: 'POST' }).then(() => setTimeout(refreshVoices, 300)).catch(() => {}); };
// A/B: one click between Kokoro and the original pipeline, and she says something straight away so you can hear the difference. During a reel, it starts over.
function setEngine(engine, audition = false) {
  remember({ engine });
  if ($('#voiceEngine')) $('#voiceEngine').value = engine;
  showVoices(); hudStatic(); showEngine();
  if (engine === 'natural') preloadReel();
  if (!audition) return;
  if (reel) playReel();
  else perform(`[joy] Hi, I'm ${current.name}. [excited] This is the ${engine === 'fast' ? 'original' : 'Kokoro'} voice. [love] How do I sound?`);
}
const showEngine = () => { $('#abVoice').textContent = saved.engine === 'fast' ? 'Voice: Original' : 'Voice: Kokoro'; };
$('#abVoice').onclick = () => setEngine(saved.engine === 'fast' ? 'natural' : 'fast', true);
async function refreshVoices() {
  try {
    const v = await (await fetch('/voice/list')).json();
    voiceList = v.voices; naturalStatus = v.natural; kokoroOn = v.kokoro; cloneStatus = v.clone;
  } catch { voiceList = []; naturalStatus = 'off'; }
  showVoices();
  if (naturalStatus === 'loading' || cloneStatus === 'loading') setTimeout(refreshVoices, 2000);
}
function showVoices() {
  if (!$('#voicePick')) return;
  const fast = saved.engine === 'fast', pick = $('#voicePick'), id = chosenVoice();
  $('#voicePickRow').hidden = fast || !voiceList.length;
  const group = (label, list) => { const g = document.createElement('optgroup'); g.label = label; for (const v of list) g.append(new Option(v.name, v.id)); return g; };
  const built = voiceList.filter(v => v.kind === 'built-in'), clones = voiceList.filter(v => v.kind === 'clone');
  pick.replaceChildren(...[built.length && group('Kokoro voices', built), clones.length && group('Cloned voices', clones)].filter(Boolean));
  if (id) pick.value = id;
  $('#voiceDelete').hidden = !id?.startsWith('clone:');
  $('#voiceState').textContent = fast ? 'The original pipeline: Piper, quickest to start' : naturalStatus === 'loading' ? 'Kokoro is loading. Using Piper for now.' : naturalStatus !== 'ready' ? 'Kokoro is unavailable. Using Piper.' : id?.startsWith('clone:') ? (cloneStatus === 'ready' ? 'Cloned voice' : `The clone model is loading. ${current.name}'s usual voice speaks until it's ready.`) : 'Kokoro';
}
// Any recording or audio file, as the mono 24 kHz WAV the server keeps.
async function toSampleWav(blob) {
  const decoded = await audio().decodeAudioData(await blob.arrayBuffer()), rate = 24000, seconds = Math.min(decoded.duration, 30);
  const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate), src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  const x = (await off.startRendering()).getChannelData(0), pcm = new DataView(new ArrayBuffer(44 + x.length * 2));
  [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']].forEach(([at, s]) => [...s].forEach((c, i) => pcm.setUint8(at + i, c.charCodeAt(0))));
  pcm.setUint32(4, 36 + x.length * 2, true); pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 1, true); pcm.setUint32(24, rate, true); pcm.setUint32(28, rate * 2, true); pcm.setUint16(32, 2, true); pcm.setUint16(34, 16, true); pcm.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) pcm.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return pcm.buffer;
}
async function addClone(blob, fallbackName) {
  const info = $('#cloneInfo');
  if (!$('#cloneOk').checked) { info.textContent = 'Confirm this is your voice, or that you have permission, first.'; return; }
  info.textContent = 'Learning the voice…';
  try {
    const wav = await toSampleWav(blob), name = $('#cloneName').value.trim() || fallbackName || 'My voice';
    const r = await fetch(`/voice/clone?consent=1&name=${encodeURIComponent(name)}`, { method: 'POST', body: wav }), d = await r.json();
    if (!r.ok) { info.textContent = d.error; return; }
    remember({ voices: { ...saved.voices, [current.id]: d.id }, engine: 'natural' });
    $('#voiceEngine').value = 'natural'; $('#cloneName').value = ''; $('#cloneOk').checked = false; $('#cloneRec').disabled = $('#cloneFile').disabled = true;
    info.textContent = `${current.name} now speaks with "${name}". Until the clone model has loaded, you'll hear ${current.name}'s usual voice.`;
    await refreshVoices(); warmClone();
  } catch (e) { console.warn('clone', e); info.textContent = "That audio couldn't be read. Try another file."; }
}
let sampling = false;
async function recordSample() {
  if (sampling) return;
  const info = $('#cloneInfo'), btn = $('#cloneRec');
  try {
    sampling = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    $('#cloneScript').hidden = false; $('#cloneScript').textContent = `Read this: "${SAMPLE_SCRIPT}"`;
    rec.start();
    for (let s = 8; s > 0; s--) { btn.textContent = `Recording… ${s}`; await wait(1); }
    rec.stop(); await done; stream.getTracks().forEach(t => t.stop());
    $('#cloneScript').hidden = true;
    await addClone(new Blob(chunks, { type: rec.mimeType }));
  } catch (e) {
    console.warn('sample', e);
    info.textContent = e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this page, or choose a file.' : "Couldn't record a sample. You can choose a file instead.";
  }
  sampling = false; btn.textContent = 'Record 8 seconds';
}

// --- Recording -----------------------------------------------------------------
// What you see on the stage, captions included, with her voice. Saved as a file on this machine, nothing is uploaded.
let rec = null;
const REC_LIMIT = 600;   // ponytail: everything is held in memory until it's saved, so ten minutes is the ceiling; write to disk as it goes if longer takes are needed
function drawRecording(now) {
  if (now - rec.drawnAt < 1000 / 30 - 2) return;
  rec.drawnAt = now;
  const pane = panes[current.id], box = pane.getBoundingClientRect(), { g, canvas } = rec, k = canvas.width / box.width;
  g.fillStyle = document.body.dataset.bg === 'green' ? '#00b140' : '#000'; g.fillRect(0, 0, canvas.width, canvas.height);
  for (const c of pane.querySelectorAll('canvas')) {
    if (!c.width || getComputedStyle(c).display === 'none') continue;
    const r = c.getBoundingClientRect(); g.drawImage(c, (r.left - box.left) * k, (r.top - box.top) * k, r.width * k, r.height * k);
  }
  const line = $('#sub').textContent;
  if (line) {
    g.font = `${Math.round(canvas.height / 34)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(canvas.width * 0.9, g.measureText(line).width + 28), h = canvas.height / 20, y = canvas.height * 0.93;
    g.fillStyle = 'rgba(8,9,14,.76)'; g.beginPath(); g.roundRect(canvas.width / 2 - w / 2, y - h / 2, w, h, 9); g.fill();
    g.fillStyle = '#fff'; g.fillText(line, canvas.width / 2, y, canvas.width * 0.88);
  }
  const s = Math.floor((now - rec.startedAt) / 1000);
  if (s !== rec.shown) { rec.shown = s; $('#recBadge').textContent = `Rec ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= REC_LIMIT) stopRecording(); }
}
function startRecording() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return toast('This browser cannot record the stage.');
  const type = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  if (!type) return toast('This browser cannot record the stage.');
  const box = panes[current.id].getBoundingClientRect(), k = Math.min(1, 1280 / Math.max(box.width, box.height)), canvas = document.createElement('canvas');
  canvas.width = Math.round(box.width * k) & ~1; canvas.height = Math.round(box.height * k) & ~1;
  audio().resume();
  const sound = audio().createMediaStreamDestination(); speaker().connect(sound);
  const stream = canvas.captureStream(30); stream.addTrack(sound.stream.getAudioTracks()[0]);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 }), chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    output.disconnect(sound); stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType }), a = document.createElement('a'), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = URL.createObjectURL(blob); a.download = `${current.name}-${stamp}.${/mp4/.test(type) ? 'mp4' : 'webm'}`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    window.nori.lastRecording = blob;
    toast(`Saved ${a.download} to your downloads.`);
  };
  const now = performance.now();
  rec = { recorder, canvas, g: canvas.getContext('2d'), startedAt: now, drawnAt: 0, shown: -1 };
  recorder.start(1000);
  $('#recBadge').hidden = false; $('#recBadge').textContent = 'Rec 0:00'; $('#recBtn').textContent = 'Stop recording'; $('#recBtn').setAttribute('aria-pressed', 'true');
}
function stopRecording() {
  rec.recorder.stop(); rec = null;
  $('#recBadge').hidden = true; $('#recBtn').textContent = 'Record'; $('#recBtn').setAttribute('aria-pressed', 'false');
}
const toggleRecording = () => rec ? stopRecording() : startRecording();
$('#recBtn').onclick = toggleRecording;

// The sound leaving the app, after mute. If this moves and nothing is heard, the cause is the output device or the browser's tab.
const levelData = new Float32Array(512);
let shownLevel = -1;
function showLevel() {
  let peak = 0;
  if (meter) { meter.getFloatTimeDomainData(levelData); for (const x of levelData) peak = Math.max(peak, Math.abs(x)); }
  const level = Math.round(Math.min(1, peak * 1.4) * 12);
  if (level !== shownLevel) { shownLevel = level; $('#level i').style.width = level / 12 * 100 + '%'; }
}

// --- Frame loop ----------------------------------------------------------------
let last = performance.now();
let performanceProbe=null;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t0 = performance.now();
  if (!following() && !reelPaused) {          // a paused reel holds her face and body along with the sound
    driveClip();
    if (!clip && liveMouth) rig.voice = liveMouth.read();
    if (hearing) rig.listen();
    rig.tick(dt);
  }
  const t1 = performance.now();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  for (const [k, p] of Object.entries(panes)) {
    if (!((view === 'all' && CHARACTERS.find(c=>c.id===k).featured) || view === k)) continue;
    const W = Math.round(p.clientWidth * dpr), H = Math.round(p.clientHeight * dpr);
    if (!W || !H) continue;
    const f = faceFor(k);
    if (!f.gl) { const c = f.c; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } }
    f.draw(rig, W, H, dt);
  }
  const t2 = performance.now();
  stats.fps += (1000 / Math.max(1, now - (frame.prev ?? now - 16)) - stats.fps) * 0.05; frame.prev = now;
  stats.frame += (t2 - t0 - stats.frame) * 0.1;
  stats.rig += ((t1 - t0) / 1 - stats.rig) * 0.1;
  hud(now);
  moodUI();
  showLevel();
  publish(now);
  if (rec) drawRecording(now);
  performanceProbe?.(now,t2-t0);
}
requestAnimationFrame(frame);

setView(view);
setBg(BGS.includes(params.get('bg')) ? params.get('bg') : 'room');
setDisplay(DISPLAYS.includes(params.get('display')) ? params.get('display') : DISPLAYS.includes(saved.display) ? saved.display : 'mouth');
setEnergy(typeof saved.energy === 'number' ? saved.energy : 1);
setMuted(muted);
setTiming(saved.onTwos ?? true);
setCalm(!!saved.calm); setBackdrop(saved.backdrop ?? true);
buildVoiceBox(); showEngine(); refreshVoices().then(() => { warmClone(); setTimeout(preloadReel, 1200); });
selectPanel(['perform', 'talk', 'studio'].includes(saved.panel) ? saved.panel : 'talk');   // the conversation, beside her, unless you left another panel open
if (params.has('obs')) document.body.classList.add('obs');
if (params.has('stream') || params.has('obs')) setStream(true);
$('#soundGate').onclick = async () => { await audio().resume().catch(() => {}); soundCheck(); toast(audio().state === 'running' ? 'Sound is on.' : 'This browser is still blocking sound. Check its site settings for this page.'); };
window.nori = { setEngine, audioState: () => ac?.state, refreshVoices, chosenVoice, rig, ask, act, perform, playReel, pauseReel, stopEverything, toggleRecording, selectPanel, setEnergy, setView, setStream, setBg, setMic, setDisplay, histories, stats, get clip() { return clip; }, faces, faceFor, panes };

// Opt-in controlled diagnostics; cached fixture only affects this test page.
if(params.has("perf")){const {setup}=await import("/performance-review/nori.js");performanceProbe=await setup({rig,audio,speaker,startSound,stopEverything,setView,TIMING,STAGE,faceFor,readWav,work,perform,act,playReel,current:()=>current.id,clip:()=>clip,speakFixture:(text,one)=>{stopAll();streamDone=true;pushEmotion="neutral";enqueue([{type:"emotion",name:"neutral"},{type:"gesture",name:"wave"},{type:"say",text},...(one?[]:[{type:"gesture",name:"nod"},{type:"say",text}])]);},seed:(text,c)=>readyClips.set(clipKey(chosenVoice(),text,"neutral"),c)});}

function fillProfiles(){
  const select=$('#packProfile');select.replaceChildren();
  for(const p of current.pack.profiles){const option=document.createElement('option');option.value=p.id;option.textContent=p.id.replaceAll('_',' ');select.append(option);}
  select.value=current.profileId||'';select.disabled=!select.options.length;
  $('#representationInfo').textContent=current.rep.status+' · '+(current.rep.name||current.representationId.replaceAll('_',' '));
}
$('#packProfile').onchange=()=>{stopEverything();for(const c of CHARACTERS.filter(c=>c.packId===current.packId))c.profileId=$('#packProfile').value;};
mountLibrary(PACKS,CHARACTERS,setView);
const sampleCache=new Map();
async function preparedSample(name){
  if(!sampleCache.has(name))sampleCache.set(name,(async()=>{const data=await(await fetch('/audio/'+name+'.json')).json();const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));const {samples,sr}=readWav(bytes.buffer);return {samples,sr,natural:true,track:await work('analyze',samples,sr),kinFrames:data.frames};})());
  return sampleCache.get(name);
}
$('#lipSync').value=saved.lipSync||'nori';
$('#lipSync').onchange=()=>{stopEverything();remember({lipSync:$('#lipSync').value});};
$('#compareLips').onclick=async()=>{stopEverything();const mine=runId;const c=await preparedSample('heart');if(mine!==runId)return;streamDone=true;enqueue([{type:'emotion',name:'neutral'},{type:'say',text:'This is my new English voice. I hope it feels a little more like me.',clip:c}]);};
$('#singerSample').onclick=async()=>{stopEverything();const mine=runId;const c=await preparedSample('singer-a');if(mine!==runId)return;act(current.led?'groove':'dance');performSong('You light up my day. Stay here close to me.',c);};
window.jaegerAvatar={...window.nori,get clip(){return clip;},packs:PACKS,characters:CHARACTERS,get current(){return current;},preparedSample};
