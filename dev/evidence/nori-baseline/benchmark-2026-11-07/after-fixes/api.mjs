// Same new sentences to both local Kokoro backends, alternating who goes first. Unique text, so no disk cache.
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2], tag = Date.now().toString(36);
const lines = [
  'Good morning! I fixed the coffee machine, but it now plays jazz.',
  'Wait, you mean the robots were dancing the whole time?',
  'Honestly, I think the moon looks a little lonely tonight.',
  'Let me tell you a secret: I practice my wave in the mirror.',
  'That was the best thing I have heard all week, thank you so much!',
  'Hmm, I am not sure about that, but let us find out together.',
];
const say = {
  nori: async t => { const r = await fetch('http://localhost:8765/say', { method: 'POST', headers: { Origin: 'http://localhost:8765' }, body: JSON.stringify({ text: t, voice: 'kokoro:af_heart', emotion: 'neutral', speed: 1 }) }); if (!r.ok) throw Error('nori ' + r.status + ' ' + await r.text()); return Buffer.from(await r.arrayBuffer()); },
  kin: async t => { const r = await fetch('http://127.0.0.1:8791/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8791' }, body: JSON.stringify({ text: t, engine: 'expressive', speaker: 'af_heart', emotion: 'neutral', character: 'anime' }) }); const j = await r.json(); if (!r.ok) throw Error('kin ' + JSON.stringify(j)); return Buffer.from(j.audio.replace(/^data:[^,]+,/, ''), 'base64'); },
};
const dur = b => { const sr = b.readUInt32LE(24), ch = b.readUInt16LE(22), bits = b.readUInt16LE(34); let o = 12; while (o < b.length) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'data') return n / (sr * ch * bits / 8); o += 8 + n; } };
for (const k of ['nori', 'kin']) await say[k]('Warming up, ' + tag);
const rows = [];
for (let i = 0; i < lines.length; i++) for (const k of i % 2 ? ['kin', 'nori'] : ['nori', 'kin']) {
  const t = `${lines[i]} Take ${1 + Math.floor(Math.random() * 9999)}.`;   // never seen before, so neither side has it cached
  const t0 = performance.now(); const b = await say[k](t); const ms = performance.now() - t0, d = dur(b);
  writeFileSync(`${OUT}/${k}-${i}.wav`, b); writeFileSync(`${OUT}/${k}-${i}.txt`, t);
  rows.push({ app: k, i, ms: Math.round(ms), audio: +d.toFixed(2), rtf: +(ms / 1000 / d).toFixed(3) });
  console.log(k, i, Math.round(ms) + ' ms', d.toFixed(2) + ' s');
}
writeFileSync(`${OUT}/api.json`, JSON.stringify(rows));
