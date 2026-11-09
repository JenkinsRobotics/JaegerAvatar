// Vita idling in a muted browser while Kokoro runs; frame intervals stamped with wall-clock time.
import { open } from './cdp.mjs';
import { spawn } from 'node:child_process';
const SP = process.argv[2], NORI = process.argv[3];
const p = await open(SP, 'http://localhost:8765/?perf-none', { port: 9405 });
for (let i = 0; i < 300; i++) { await p.sleep(100); try { if (await p.ev(`!!(window.nori&&nori.faces.vita&&nori.faces.vita.m&&document.querySelector('#loading').hidden)`)) break; } catch {} }
await p.ev(`window.__f=[];let q=0;(function f(n){if(q)window.__f.push([Date.now(),n-q]);q=n;requestAnimationFrame(f)})(0);0`);
const py = spawn(NORI + '/.venv/bin/python', ['-I', SP + '/gpu_tts.py', NORI], { env: { ...process.env, HF_HOME: NORI + '/.cache/hf', HF_HUB_OFFLINE: '1' } });
const phases = []; let out = '';
await new Promise(r => { py.stdout.on('data', d => { out += d; for (const l of String(d).split('\n')) { const m = l.match(/^PHASE (\w+) ([\d.]+)/); if (m) phases.push([m[1], +m[2] * 1000]); if (l.startsWith('READY')) phases.push(['idle', Date.now()]); } }); py.on('close', r); });
const f = JSON.parse(await p.ev(`JSON.stringify(window.__f)`));
const by = {};
for (const [t, dt] of f) { let ph = null; for (const x of phases) if (x[1] <= t) ph = x[0]; if (ph) (by[ph] ??= []).push(dt); }
for (const [k, v] of Object.entries(by)) { const s = [...v].sort((a, b) => a - b); console.log(k.padEnd(5), 'fps', (v.length / v.reduce((a, b) => a + b, 0) * 1000).toFixed(1), 'p99', s[s.length * .99 | 0].toFixed(1), 'worst', s.at(-1).toFixed(1), 'over 25 ms', v.filter(x => x > 25).length, 'of', v.length); }
console.log(out.split('\n').filter(l => l.startsWith('RESULT')).join('\n'));
p.close(); process.exit(0);
