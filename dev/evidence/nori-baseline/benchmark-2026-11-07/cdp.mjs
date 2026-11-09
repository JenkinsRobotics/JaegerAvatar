// A real, separate Chrome that the tests can drive, with nothing pumping the page.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
export async function open(SP, url, { size = '1400,1000', flags = [], port = 9335 } = {}) {
  const dir = mkdtempSync(SP + '/chrome-');
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`, `--window-size=${size}`, '--no-first-run', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--mute-audio', ...flags, 'about:blank'], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waiting = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? JSON.stringify(m.params).slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text.slice(0, 200) + ' ' + (m.params.entry.url ?? '')); };
  const send = (method, params = {}) => new Promise(r => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__long=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true})}catch{}` });
  await send('Page.navigate', { url });
  const shot = async path => { const p = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(p.result.data, 'base64')); };
  const close = () => { chrome.kill(); ws.close(); setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} }, 500); };
  return { ev, send, shot, close, errors, sleep };
}
