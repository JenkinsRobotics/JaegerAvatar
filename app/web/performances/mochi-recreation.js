import {AvatarStage} from '../kin/renderer.js';
import {STANCE} from '../kin/motion.js';
import {CLIPS,DURATION} from './mochi-scenes.js';
const $=id=>document.getElementById(id),video=$('reference'),stage=new AvatarStage($('stage'));
const drawScene=(ctx,t,o)=>CLIPS[o.variant].draw(ctx,t,o);
$('variant').replaceChildren(...Object.entries(CLIPS).map(([id,c])=>new Option(`Scene ${+id[5]+1}${id[7]==="0"?"":" alt"} · ${c.title}`,id)));
const want=new URLSearchParams(location.search).get('clip');if(CLIPS[want])$('variant').value=want;
stage.dust.visible=false;stage.setCharacter('robot');
let time=0,playing=false,last=performance.now();
const options=()=>({variant:$('variant').value,intensity:+$('gain').value,gazeX:+$('gaze').value});
stage.facePainter=ctx=>drawScene(ctx,time,options());
let sourceVersion=0,sourceURL;
async function source(){
 const version=++sourceVersion;$('play').disabled=true;
 try{
  // The pack endpoint does not support byte ranges. A local Blob makes this
  // small comparison clip seekable without changing the production server.
  const response=await fetch('/packs/mochi/assets/classic/'+$('variant').value+'.mp4');
  if(!response.ok)throw new Error('Reference HTTP '+response.status);
  const blob=await response.blob();if(version!==sourceVersion)return;
  if(sourceURL)URL.revokeObjectURL(sourceURL);
  video.src=sourceURL=URL.createObjectURL(blob);
 }catch(e){$('status').textContent=e.message+'. Procedural-only mode still works.';}
 finally{if(version===sourceVersion)$('play').disabled=false;}
}
function stop(){playing=false;video.pause();$('play').textContent='Play comparison';}
async function play(){
 if(playing){stop();return;}
 if(time>=DURATION)time=0;
 if(!$('solo').checked){video.currentTime=time;try{await video.play();}catch(e){$('status').textContent='Reference playback failed: '+e.message;return;}}
 playing=true;last=performance.now();$('play').textContent='Pause';
}
$('play').onclick=play;$('reset').onclick=()=>{stop();time=0;video.currentTime=0;};
$('variant').onchange=()=>{stop();time=0;source();};
$('solo').onchange=()=>{stop();video.hidden=$('solo').checked;$('status').textContent=$('solo').checked?'Procedural playback uses its own clock; the reference video is paused and hidden.':'Comparison uses the reference playback clock for alignment.';};
$('seek').oninput=()=>{stop();time=+$('seek').value;video.currentTime=time;};
video.onloadedmetadata=()=>{video.currentTime=time;};
video.onerror=()=>{$('status').textContent='Reference unavailable. Procedural-only mode still works.';};
source();
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(playing){time=$('solo').checked?Math.min(DURATION,time+dt):Math.min(DURATION,video.currentTime);if(time>=DURATION-.02||(!$('solo').checked&&video.ended))stop();}
 stage.targetTurn=+$('view').value;stage.update({...STANCE,faceMood:0,faceEnergy:1},dt,now/1000);
 drawScene($('flat').getContext('2d'),time,options());$('seek').value=time;$('time').textContent=time.toFixed(2)+' s';requestAnimationFrame(frame);
}requestAnimationFrame(frame);
