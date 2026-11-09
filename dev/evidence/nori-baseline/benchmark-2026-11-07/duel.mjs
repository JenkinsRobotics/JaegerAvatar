// Both apps as a person uses them, in separate muted Chrome profiles: load, idle on Vita, the app's own reel, and two typed chats.
// Sound is measured where it leaves each app's audio graph (zero gain after it), so nothing is audible.
import { open } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const SP = process.argv[2], app = process.argv[3], run = +process.argv[4];
const prompts = [['Hi! What is your favourite colour?', 'Tell me a very short joke about cats.'], ['Hello there, how is your day going?', 'Give me one fun fact about the ocean.'], ['Hey, can you wave at me?', 'What would you do on a rainy day?']][run % 3];
const A = {
  nori: { url: 'http://localhost:8765/', ready: `!!(window.nori&&nori.faces.vita&&nori.faces.vita.m&&document.querySelector('#loading').hidden)`, vita: `nori.setView('vita');0`, vitaReady: `!!nori.faces.vita.m`, reel: '#reel', reelBusy: `!!nori.clip||nori.rig.mode!=='idle'||(document.querySelector('#chapter')&&!document.querySelector('#chapter').hidden)`, chat: t => `(()=>{const i=document.querySelector('#input');i.value=${JSON.stringify(t)};document.querySelector('#form').requestSubmit();return 0})()`, stop: `nori.stopEverything();0` },
  kin: { url: 'http://127.0.0.1:8791/', ready: `!!(window.kin&&kin.stage.frame>3)`, vita: `document.querySelector('[data-character="vita-kin"]').click();0`, vitaReady: `kin.character==='vita-kin'&&kin.stage.ready&&kin.stage.frame>3`, reel: '#demo', reelBusy: `!document.querySelector('#reel-player').hidden`, chat: t => `(()=>{const i=document.querySelector('#message');i.value=${JSON.stringify(t)};document.querySelector('#chat-form').requestSubmit();return 0})()`, stop: `kin.stop();0` },
}[app];
const TAP = `(()=>{const C=AudioNode.prototype.connect;window.__au=[];window.__fr=[];window.__rec=false;const taps=[];AudioNode.prototype.connect=function(t,...a){if(t instanceof AudioDestinationNode){const c=this.context;if(!c.__tap){const an=c.createAnalyser();an.fftSize=1024;const z=c.createGain();z.gain.value=0;C.call(an,z);C.call(z,t);c.__tap=an;taps.push(an)}return C.call(this,c.__tap,...a)}return C.call(this,t,...a)};const d=new Float32Array(1024);setInterval(()=>{if(!window.__rec)return;let r=0;for(const an of taps){an.getFloatTimeDomainData(d);let s=0;for(const x of d)s+=x*x;r=Math.max(r,Math.sqrt(s/1024))}window.__au.push([performance.now(),r])},10);let p=0;(function f(n){if(window.__rec)window.__fr.push(n-p);p=n;requestAnimationFrame(f)})(0)})()`;
const p = await open(SP, 'about:blank', { port: 9390 + run, flags: ['--enable-precise-memory-info'] });
const { ev, sleep, send } = p;
await send('Page.addScriptToEvaluateOnNewDocument', { source: TAP });
const until = async (expr, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return Date.now() - t; } catch {} await sleep(50); } return null; };
const R = { app, run };
let t0 = Date.now(); await send('Page.navigate', { url: A.url });
R.loadMs = await until(A.ready, 30000); await sleep(3000);
Object.assign(R, JSON.parse(await ev(`JSON.stringify({kb:Math.round((performance.getEntriesByType('resource').reduce((a,e)=>a+(e.transferSize||e.encodedBodySize||0),0)+(performance.getEntriesByType('navigation')[0]?.transferSize||0))/1024),requests:performance.getEntriesByType('resource').length,heapMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1),dom:document.getElementsByTagName('*').length,small:[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11).length})`)));
t0 = Date.now(); await ev(A.vita); R.vitaMs = await until(A.vitaReady, 30000); await sleep(2500);
const stats = async () => JSON.parse(await ev(`(()=>{const f=window.__fr.slice(3),s=[...f].sort((a,b)=>a-b),sum=f.reduce((a,b)=>a+b,0);return JSON.stringify({fps:+(f.length/sum*1000).toFixed(1),p99:+(s[s.length*.99|0]||0).toFixed(1),worst:+(s[s.length-1]||0).toFixed(1),over50:f.filter(x=>x>50).length,long:window.__long.filter(l=>l[0]>window.__since).map(l=>l[1])})})()`));
const begin = () => ev(`window.__au=[];window.__fr=[];window.__since=performance.now();window.__rec=true;window.__t0=performance.now();0`);
const sound = async () => JSON.parse(await ev(`(()=>{const a=window.__au,on=a.filter(x=>x[1]>0.01);if(!on.length)return JSON.stringify({first:null});const first=on[0][0]-window.__t0,last=on.at(-1)[0];let gaps=[],q=null;for(const [t,r] of a){if(t<on[0][0]||t>last)continue;if(r<0.004){q??=t}else{if(q!==null&&t-q>400)gaps.push(Math.round(t-q));q=null}}return JSON.stringify({first:Math.round(first),span:+((last-on[0][0])/1000).toFixed(1),silences:gaps.length,longest:Math.max(0,...gaps)})})()`));
// Idle on Vita
await begin(); await sleep(8000); R.idle = await stats(); await ev('window.__rec=false;0');
// The app's own reel
await begin(); await ev(`document.querySelector('${A.reel}').click();0`); await sleep(1500);
let quiet = null; const tr = Date.now();
while (Date.now() - tr < 120000) { await sleep(500); const busy = await ev(A.reelBusy); if (!busy) { quiet ??= Date.now(); if (Date.now() - quiet > 3000) break; } else quiet = null; }
R.reel = { ...(await stats()), ...(await sound()) }; await ev('window.__rec=false;' + A.stop); await sleep(1500);
// Two typed chats, each to the end of the spoken reply
R.chat = [];
for (const q of prompts) {
  await begin(); await ev(A.chat(q));
  let heard = false, lastLoud = Date.now(); const tc = Date.now();
  while (Date.now() - tc < 60000) { await sleep(250); const r = await ev(`(window.__au.at(-1)||[0,0])[1]`); if (r > 0.01) { heard = true; lastLoud = Date.now(); } if (heard && Date.now() - lastLoud > 3500) break; }
  R.chat.push({ q, ...(await sound()), ...(await stats()) }); await ev('window.__rec=false;' + A.stop); await sleep(1500);
}
R.errors = p.errors.filter(e => !/favicon|INFO/.test(e)).slice(0, 6);
writeFileSync(`${SP}/duel/run-${app}-${run}.json`, JSON.stringify(R));
console.log(JSON.stringify(R));
p.close(); process.exit(0);
