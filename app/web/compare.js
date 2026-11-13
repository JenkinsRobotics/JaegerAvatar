// Two voices, side by side: the same character twice, each speaking the same line through the voice picked for it.
// A side's voice is either the voice loop's own (the Jaeger voice module, asked through /voice/module, in any of the
// app's Kokoro voices) or one of the app's own voices (/say). Each clip's facts are measured here, on the clip, the same way for both sides.
import { charactersFromPacks } from './pack-library.js';
import { Rig } from './rig.js';
import { analyze, markLips, sampleTrack, readWav, clipFacts } from './voice.js';

const $ = s => document.querySelector(s), LOOKAHEAD = 0.05;   // the mouth leads the sound a little, as in the app
const note = text => { $('#note').textContent = text; };
const json = url => fetch(url).then(r => r.json());
const [packs, list, settings] = await Promise.all([json('/api/avatars'), json('/voice/list'), json('/settings')]);
const characters = charactersFromPacks(packs).filter(c => c.live);
const part = settings.parts?.voice;   // what the voice loop's voice says it runs on; absent while the loop is off or loading

// The voice module speaks any of the app's Kokoro voices; with none listed yet it still has the voice it was opened with.
const kokoro = list.voices.filter(v => v.kind !== 'clone'), where = part && `${part.module} ${part.version} on ${part.compute}, inside Jaeger Agent's voice loop`;
const VOICES = [
  ...(part ? (kokoro.length ? kokoro : [{ id: '', name: part.model }]).map(v => ({ id: 'module:' + v.id, name: `Jaeger voice module · ${v.name}`, where })) : []),
  ...list.voices.map(v => ({ id: v.id, name: `App's own · ${v.name}`,
    where: v.kind === 'clone' ? 'Chatterbox Turbo clone, app/voice_engine.py' : `Kokoro on ${list.kokoro}, app/voice_engine.py` })),
];
const sides = [...document.querySelectorAll('.side')].map(el => ({ el, rig: new Rig(), face: null, canvas: null, clip: null,
  pick: el.querySelector('.voice'), stats: el.querySelector('.stats'), pane: el.querySelector('.pane') }));

for (const c of characters) $('#who').add(new Option(c.label, c.id));
$('#who').value = new URLSearchParams(location.search).get('face') ?? 'vita';
if (!$('#who').value) $('#who').selectedIndex = 0;
sides.forEach((s, i) => {
  for (const v of VOICES) s.pick.add(new Option(v.name, v.id));
});
// Left: the voice module; right: the app's own code; both in this character's Kokoro voice, so only the path differs.
function pickOwnVoice() {
  const own = 'kokoro:' + characters.find(c => c.id === $('#who').value)?.kokoro;
  sides.forEach((s, i) => { s.pick.value = i ? own : 'module:' + own; if (s.pick.selectedIndex < 0) s.pick.selectedIndex = Math.min(i, VOICES.length - 1); });
}
if (!VOICES.length) note('No voice is ready yet. The voices load a few seconds after the app starts; reload this page then.');
else if (!part) note("The voice loop's own voice is not listed: the loop is off or still loading. Reload once it is up.");

// A fresh pair of canvases per character: a renderer keeps its drawing context for good.
function mount() {
  const c = characters.find(c => c.id === $('#who').value);
  for (const s of sides) {
    s.pane.replaceChildren(document.createElement('canvas'), Object.assign(document.createElement('canvas'), { className: 'ov' }));
    s.canvas = s.pane.firstChild;
    try { s.face = c.make(s.canvas, s.pane.lastChild); } catch (e) { s.face = null; note(`${c.label} could not be drawn here: ${e.message}`); }
  }
}
$('#who').onchange = () => { mount(); pickOwnVoice(); };
mount(); pickOwnVoice();

async function fetchClip(id, text) {
  const sent = performance.now(), post = (url, body) => fetch(url, { method: 'POST', body: JSON.stringify(body) });
  const r = id.startsWith('module:') ? await post('/voice/module', { text, voice: id.slice(7) || undefined }) : await post('/say', { text, voice: id, speed: 1 });
  if (!r.ok) throw Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  const { samples, sr } = readWav(await r.arrayBuffer()), ms = performance.now() - sent, marks = JSON.parse(r.headers.get('X-Lips') || '[]');
  return { samples, sr, marks, ms, renderMs: r.headers.get('X-Render-Ms'), track: markLips(analyze(samples, sr), marks) };
}

let ac;
function play(side, c) {
  ac ??= new AudioContext();
  // The app brings each clip up near full scale (at most doubled) before playing; "as made" leaves the clip's own level.
  const lift = $('#raw').checked ? 1 : Math.min(2, 0.95 / (clipFacts(c.samples, c.sr).peak || 1));
  return new Promise(done => {
    const buf = ac.createBuffer(1, c.samples.length, c.sr); buf.copyToChannel(c.samples.map(x => x * lift), 0);
    const src = ac.createBufferSource(), at = ac.currentTime + 0.02;
    src.buffer = buf; src.connect(ac.destination); src.start(at);
    side.clip = { track: c.track, now: () => ac.currentTime - at - (ac.outputLatency || 0) };
    src.onended = () => { side.clip = null; done(); };
  });
}

function show(side, rows) {
  side.stats.replaceChildren(...rows.flatMap(([k, v]) => [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
}

async function speak(side) {
  const text = $('#line').value.trim(), v = VOICES.find(v => v.id === side.pick.value);
  if (!text || !v) return;
  side.el.classList.add('speaking');
  try {
    const c = await fetchClip(v.id, text), f = clipFacts(c.samples, c.sr, c.marks);
    show(side, [['Voice', v.name], ['Runs on', v.where],
      ['Clip ready', `${Math.round(c.ms)} ms after asking` + (c.renderMs ? ` (${c.renderMs} ms in the voice itself)` : '')],
      ['Clip', `${f.seconds.toFixed(2)} s at ${c.sr} Hz`],
      ['Level', `loudness ${f.rms.toFixed(3)}, peak ${f.peak.toFixed(2)}`],
      ['Dead air', `${f.leadMs} ms before the voice, ${f.tailMs} ms after`],
      ['Lip marks', f.marks ? `${f.closures} closures (m/b/p), ${f.tucks} tucks (f/v)` : 'none: the mouth follows the sound only']]);
    await play(side, c);
  } catch (e) {
    show(side, [['Voice', v.name], ['Failed', e.message]]);
  } finally { side.el.classList.remove('speaking'); }
}

let busy = false;
async function run(which) {
  if (busy) return;
  busy = true; for (const b of document.querySelectorAll('button')) b.disabled = true;
  try { for (const s of which) await speak(s); }             // one after the other, never together
  finally { busy = false; for (const b of document.querySelectorAll('button')) b.disabled = false; }
}
$('#say').onsubmit = e => { e.preventDefault(); run(sides); };
sides.forEach(s => { s.el.querySelector('.one').onclick = () => run([s]); });

let last = performance.now();
requestAnimationFrame(function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000), dpr = Math.min(devicePixelRatio || 1, 2); last = now;
  for (const s of sides) {
    const at = s.clip ? s.clip.now() + LOOKAHEAD : -1;
    s.rig.voice = at >= 0 ? sampleTrack(s.clip.track, at) : null;
    s.rig.tick(dt);
    const W = Math.round(s.pane.clientWidth * dpr), H = Math.round(s.pane.clientHeight * dpr);
    if (!s.face || !W || !H) continue;
    if (!s.face.gl && (s.canvas.width !== W || s.canvas.height !== H)) { s.canvas.width = W; s.canvas.height = H; }
    s.face.draw(s.rig, W, H, dt);
  }
});
window.compare = { sides, VOICES };   // for the browser check: what each side is doing right now
