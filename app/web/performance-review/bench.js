// Opt-in diagnostic UI. Runs the real apps' audio queues, rigs and renderers.
// No chat model or microphone is used. Controlled runs receive identical Kokoro PCM.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const quantile = (a, p) => [...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)] ?? 0;
export function morphs(bindings) {
  return ['aa','ih','ou','ee','oh'].map(k => {
    const b=bindings?.[k];
    if (b?.morphs?.length) return b.morphs[0][0].morphTargetInfluences[b.morphs[0][1]];
    return 0;
  });
}
export async function install(adapter) {
  const fixture=await (await fetch('/performance-review/fixtures/speech.json')).json();
  const stage=document.querySelector('#stage');
  const style=document.createElement('style');
  style.textContent=`body{margin:0!important;background:#eeeae4!important;color:#25212d!important;font:14px system-ui!important;overflow:auto!important}body> :not(#performance-lab):not(style):not(script){display:none!important}#performance-lab{display:block!important;padding:20px;max-width:1200px;margin:auto}#performance-lab h1{font-size:27px;margin:5px 0}#performance-lab p{margin:8px 0 16px}#perf-grid{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}#perf-stage{width:600px;height:600px;background:#302735;position:relative;overflow:hidden;border-radius:20px;flex-shrink:0}#perf-stage #stage{position:relative!important;inset:auto!important;width:600px!important;height:600px!important;margin:0!important;max-height:none!important;max-width:none!important;min-height:0!important;border:0!important}#perf-controls{width:340px}#perf-controls button,#perf-controls select{padding:12px;margin:4px 4px 8px 0;font:inherit;border:1px solid #bbb;border-radius:8px;color:#25212d;background:#fff}#perf-controls button{cursor:pointer}#perf-status{font-weight:650;min-height:40px}#perf-summary{white-space:pre-wrap;font-size:12px;background:#fff;padding:14px;border-radius:12px}#perf-report{white-space:pre-wrap;overflow:auto;max-height:240px;font-size:10px}#perf-controls label{display:block;margin:10px 0}.pane{border-radius:0!important}`;
  document.head.append(style);
  const ui=document.createElement('section');ui.id='performance-lab';
  ui.innerHTML=`<h1>${adapter.name} · Performance test</h1><p>Same Kokoro Heart recording · 600 × 600 stage · smooth animation · neutral speech. Audio is audible.</p><div id="perf-grid"><div id="perf-stage"></div><div id="perf-controls"><label>Character <select id="perf-cast"></select></label><button id="perf-run">Run controlled test</button><button id="perf-stop">Stop test</button><button id="perf-reel">Measure native reel</button><p id="perf-status">Preparing…</p><pre id="perf-summary"></pre><details><summary>Raw measurement report</summary><pre id="perf-report"></pre></details></div></div>`;
  document.body.append(ui);ui.querySelector('#perf-stage').append(stage);
  const status=ui.querySelector('#perf-status'), reportEl=ui.querySelector('#perf-report'), summary=ui.querySelector('#perf-summary');
  const cast=ui.querySelector('#perf-cast');
  for(const [id,name] of adapter.variants)cast.add(new Option(name,id));
  let report=null, phase='idle', serial=0, running=false, previous=0, currentSource=null,captureAbort=null;
  const lockControls=locked=>{cast.disabled=locked;for(const id of ['perf-run','perf-reel','perf-record']){const b=ui.querySelector('#'+id);if(b)b.disabled=locked;}};
  const event=(type,data={})=>{if(running)report.events.push({type,ms:performance.now()-report.started,clock:adapter.context()?.currentTime??null,phase,...data});};
  // Observe WebAudio source scheduling, without changing scheduling or audio samples.
  function observeAudio(){
    const ctx=adapter.context();if(ctx.__performanceObserved)return;ctx.__performanceObserved=true;
    const create=ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource=()=>{
      const src=create(), start=src.start.bind(src), stop=src.stop.bind(src);
      src.start=(when=0,...rest)=>{
        if(running){const entry={when:Math.max(when,ctx.currentTime),duration:src.buffer?.duration,rate:src.playbackRate.value,phase,scheduledMs:performance.now()-report.started,outputLatency:ctx.outputLatency||0};report.sources.push(entry);currentSource=entry;src.addEventListener('ended',()=>{entry.endedClock=ctx.currentTime;event('audio-ended');});}
        return start(when,...rest);
      };
      src.stop=(...args)=>{event('audio-stop-call');return stop(...args);};return src;
    };
  }
  const recordAction=(kind,name)=>event(kind,{name});
  adapter.observeActions(recordAction);
  async function select(){status.textContent='Loading character…';await adapter.select(cast.value);await adapter.prepare(fixture);status.textContent='Ready';}
  cast.onchange=()=>select().catch(e=>status.textContent=e.message);
  function finish(error){
    if(!report)return;running=false;report.finished=new Date().toISOString();report.error=error||null;
    const frames=report.frames.filter(f=>f.phase!=='warmup'), dt=frames.map(f=>f.dt).filter(x=>x>0);
    report.summary={frames:frames.length,fps:1000/(dt.reduce((a,b)=>a+b,0)/dt.length),frameP50:quantile(dt,.5),frameP95:quantile(dt,.95),frameP99:quantile(dt,.99),over33ms:dt.filter(x=>x>33.5).length,over50ms:dt.filter(x=>x>50).length,jsP95:quantile(frames.map(f=>f.cost),.95),sources:report.sources.length,dimensions:adapter.read().dimensions};
    summary.textContent=JSON.stringify(report.summary,null,2);reportEl.textContent=JSON.stringify(report);status.textContent=error?'Stopped: '+error:'Complete · report ready';
  }
  async function run(nativeReel=false){
    if(running)return;const mine=++serial;adapter.stop();await adapter.unlock();observeAudio();await select();await wait(1200);
    report={schema:1,app:adapter.name,character:cast.value,kind:nativeReel?'native-reel':'controlled',started:performance.now(),date:new Date().toISOString(),devicePixelRatio,fixture:{text:fixture.text,duration:fixture.duration},audio:{sampleRate:adapter.context().sampleRate,baseLatency:adapter.context().baseLatency,outputLatency:adapter.context().outputLatency},frames:[],events:[],sources:[]};
    previous=0;running=true;reportEl.textContent='';summary.textContent='';
    const hold=async(ms)=>{await wait(ms);if(mine!==serial)throw Error('Cancelled');};
    try{
      phase='warmup';await hold(1000);
      if(nativeReel){phase='native-reel';status.textContent='Measuring the app’s own reel…';adapter.reel();await hold(adapter.reelMs);}
      else{
        phase='speech';status.textContent='Two queued spoken lines, wave then nod…';event('speech-request');adapter.speak(fixture);await hold(fixture.duration*2000+1500);
        const moves=adapter.isDisplay(cast.value)?[['heart',2200],['wink',2200],['roll',3200],['groove',4000]]:[['wave',3600],['spin',4100],['dance',7300],['celebrate',4700]];
        for(const [name,ms] of moves){phase='move:'+name;status.textContent='Measuring '+name+'…';event('move-command',{name});adapter.move(name);await hold(ms);}
        phase='stop-test';adapter.neutral();event('speech-request');adapter.speak(fixture,true);await hold(1300);event('stop-command');adapter.stop();await hold(1000);
      }
      phase='settle';adapter.stop();adapter.neutral();await hold(1000);finish();
    }catch(e){adapter.stop();if(running)finish(e.message);}
  }
  const launch=async native=>{lockControls(true);try{await run(native);}catch(e){status.textContent=e.message;}finally{lockControls(false);}};
  ui.querySelector('#perf-run').onclick=()=>launch(false);
  ui.querySelector('#perf-reel').onclick=()=>launch(true);
  ui.querySelector('#perf-stop').onclick=()=>{serial++;captureAbort?.abort();event('stop-command');adapter.stop();if(running)finish('Stopped by user');else status.textContent='Stopped';};
  // Recording is a separate pass, so encoder overhead is absent from the timing runs.
  const recordButton=document.createElement('button');recordButton.id='perf-record';recordButton.textContent='Record spoken sample';ui.querySelector('#perf-controls').append(recordButton);
  recordButton.onclick=async()=>{
    if(running||captureAbort)return;lockControls(true);captureAbort=new AbortController();
    const signal=captureAbort.signal;let destination,stream,recorder;
    const hold=ms=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
    try{
      adapter.stop();await adapter.unlock();await select();adapter.neutral();adapter.recordFraming?.(true);await hold(1200);
      const ctx=adapter.context();destination=ctx.createMediaStreamDestination();adapter.audioOutput().connect(destination);
      stream=adapter.canvas().captureStream(30);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
      const mimeType=['video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2500000});const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();status.textContent='Recording one spoken line with sound…';
      await hold(500);adapter.speak(fixture,true);await hold(fixture.duration*1000+1200);
      status.textContent='Recording the spin / eye roll…';adapter.recordFraming?.(false);adapter.move(adapter.isDisplay(cast.value)?'roll':'spin');await hold(4100);recorder.stop();await done;
      const blob=new Blob(chunks,{type:mimeType});const reader=new FileReader();const loaded=new Promise(resolve=>reader.onload=resolve);reader.readAsDataURL(blob);await loaded;
      let link=ui.querySelector('#perf-clip');if(!link){link=document.createElement('a');link.id='perf-clip';link.textContent='Download recorded sample';ui.querySelector('#perf-controls').append(link);}link.href=reader.result;link.download=adapter.name+'-'+cast.value+(mimeType.includes('mp4')?'.mp4':'.webm');
      status.textContent='Recording ready · includes generated voice';
    }catch(e){status.textContent=e.message;}finally{if(recorder?.state==='recording')recorder.stop();if(destination)adapter.audioOutput().disconnect(destination);stream?.getTracks().forEach(t=>t.stop());captureAbort=null;lockControls(false);adapter.stop();}
  };
  await select();
  return (now,cost)=>{
    if(!running)return;
    const ctx=adapter.context(), state=adapter.read();
    report.frames.push({ms:performance.now()-report.started,dt:previous?now-previous:0,cost,clock:ctx?.currentTime,phase,...state});previous=now;
  };
}
