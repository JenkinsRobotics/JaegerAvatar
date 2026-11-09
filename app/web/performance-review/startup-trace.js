// Opt-in startup instrumentation. Does not change queueing, caching or synthesis.
const events=[];
const panel=document.createElement('details');panel.open=true;
panel.style.cssText='position:fixed;bottom:12px;left:12px;z-index:99999;background:#fff;color:#28232e;padding:12px;border:1px solid #aaa;border-radius:10px;max-width:620px;max-height:230px;overflow:auto;font:12px monospace';
panel.innerHTML='<summary id="startup-summary">Reel startup trace</summary><pre id="startup-report"></pre>';
document.body.append(panel);
export function trace(type,data={}){
 events.push({ms:performance.now(),type,...data});
 const click=events.findLast(e=>e.type==='reel-click'),source=click&&events.find(e=>e.type==='source-scheduled'&&e.ms>=click.ms);
 panel.querySelector('#startup-summary').textContent=click?(source?`First sound estimate: ${Math.round(source.ms+source.delayMs+source.signalLeadMs-click.ms)} ms`:'Waiting for reel audio…'):'Preloading · press Play reel';
 panel.querySelector('#startup-report').textContent=JSON.stringify({date:new Date().toISOString(),events},null,2);
}
