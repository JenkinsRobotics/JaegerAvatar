const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const output=resolve('dev/evidence/migration');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--mute-audio']});
const p=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});let errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url());});
await p.goto((process.env.AVATAR_URL||'http://127.0.0.1:8790/')+'?test=1');await p.waitForFunction(()=>!!window.jaegerAvatar);await p.waitForTimeout(2500);
await p.click('#studioTab');const report={lip:[],errors,layout:[]};
for(const mode of ['nori','kin']){
 await p.selectOption('#lipSync',mode);await p.click('#recBtn');await p.click('#compareLips');await p.waitForFunction(()=>!!jaegerAvatar.clip,null,{timeout:12000});
 await p.waitForTimeout(1700);await p.screenshot({path:output+'/lip-'+mode+'.png'});
 report.lip.push(await p.evaluate(()=>({mode:document.querySelector('#lipSync').value,duration:jaegerAvatar.clip?.track.dur,hybrid:jaegerAvatar.rig.out.kinMouth,finite:Object.values(jaegerAvatar.rig.out).every(Number.isFinite)})));
 await p.waitForFunction(()=>!jaegerAvatar.clip,null,{timeout:15000});const dl=p.waitForEvent('download');await p.click('#recBtn');const d=await dl;await d.saveAs(output+'/lip-'+mode+'.'+d.suggestedFilename().split('.').at(-1));
}
await p.click('#singerSample');await p.waitForFunction(()=>!!jaegerAvatar.clip);report.singer=await p.evaluate(()=>({duration:jaegerAvatar.clip.track.dur,frames:jaegerAvatar.clip.kinFrames.length}));await p.waitForTimeout(1000);await p.click('#stop');await p.waitForTimeout(300);report.stop=await p.evaluate(()=>({clip:!!jaegerAvatar.clip,mode:jaegerAvatar.rig.mode}));
await p.selectOption('#lipSync','nori');await p.click('#talkTab');await p.click('#reel');await p.waitForFunction(()=>!!jaegerAvatar.clip,null,{timeout:20000});await p.click('#reelPause');const t=await p.evaluate(()=>jaegerAvatar.rig.t);await p.waitForTimeout(300);report.pause=await p.evaluate(t=>({held:jaegerAvatar.rig.t===t,audio:jaegerAvatar.audioState()}),t);await p.click('#reelPause');
let chapters=[];for(let i=0;i<180;i++){await p.waitForTimeout(500);const s=await p.evaluate(()=>({hidden:document.querySelector('#chapter').hidden,text:document.querySelector('#chapterText').textContent,clip:!!jaegerAvatar.clip}));if(chapters.at(-1)!==s.text)chapters.push(s.text);if(s.hidden)break;}report.chapters=chapters;report.finished=await p.locator('#chapter').isHidden();
await p.click('#libraryOpen');await p.fill('#librarySearch','clanker');await p.locator('#libraryGrid button:not([disabled])').first().click();await p.waitForTimeout(500);report.clanker=await p.evaluate(()=>({pack:jaegerAvatar.current.packId,status:jaegerAvatar.current.rep.status}));await p.screenshot({path:output+'/clanker.png'});
for(const width of [320,390,850,1280]){await p.setViewportSize({width,height:900});await p.waitForTimeout(150);report.layout.push(await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})));}
await writeFile(output+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
