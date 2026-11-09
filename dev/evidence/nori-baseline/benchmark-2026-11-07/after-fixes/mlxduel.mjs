import { spawn } from 'node:child_process';
const SP = process.argv[2], NORI = '/Users/jonathanjenkins/GITHUB/AI Visual Playground/nori-face-rig', KIN = '/Users/jonathanjenkins/GITHUB/AI Visual Playground/local-avatar-demo';
const mk = (py, model, extra, env) => { const c = spawn(py, ['-I', SP + '/mlxtime.py', model, ...extra], { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, HF_HUB_OFFLINE: '1', ...env } }); let buf = '', waiters = []; c.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); waiters.shift()?.(l); } }); return { next: () => new Promise(r => waiters.push(r)), say: t => { c.stdin.write(t + '\n'); }, kill: () => c.kill() }; };
const arms = {
  nori: mk(NORI + '/.venv/bin/python', 'mlx-community/Kokoro-82M-bf16', [], { HF_HOME: NORI + '/.cache/hf' }),
  noriCap: mk(NORI + '/.venv/bin/python', 'mlx-community/Kokoro-82M-bf16', ['cap'], { HF_HOME: NORI + '/.cache/hf' }),
  kin: mk(KIN + '/.voice-venv/bin/python', KIN + '/models/expressive/Kokoro-82M-bf16', ['cap'], {}),
};
for (const a of Object.values(arms)) await a.next();
const lines = ['Good morning! I fixed the coffee machine, but it now plays jazz.', 'Wait, you mean the robots were dancing the whole time?', 'Honestly, I think the moon looks a little lonely tonight.', 'Let me tell you a secret: I practice my wave in the mirror.', 'Sorry, that was a lot.'];
const res = { nori: [], noriCap: [], kin: [] }, names = Object.keys(arms);
for (let i = 0; i < 15; i++) { const t = `${lines[i % 5]} Take ${1 + Math.floor(Math.random() * 9999)}.`; for (const n of (i % 2 ? names : [...names].reverse())) { const w = arms[n].next(); arms[n].say(t); res[n].push(+await w); } }
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const [n, v] of Object.entries(res)) console.log(n.padEnd(8), 'median', med(v).toFixed(2), 's  range', Math.min(...v).toFixed(2), '-', Math.max(...v).toFixed(2));
for (const a of Object.values(arms)) a.kill(); process.exit(0);
