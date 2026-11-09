import {AvatarStage} from './kin/renderer.js';
import {CLIPS} from './performances/mochi-scenes.js';
import {STANCE} from './kin/motion.js';
import {FACE_MOODS,REACTIONS} from './kin/eyes.js';
const stage=new AvatarStage(document.querySelector('#stage'),null,{label:'mochi'});stage.setCharacter('robot');stage.dust.visible=false;
const status=document.querySelector('#status'),token=new URLSearchParams(location.search).get('token');
let state=null,last=performance.now(),lastReceived=0,mood='neutral',moodAt=0,reactionSeq=0,reactionAt=0,session='';
async function poll(){try{const r=await fetch('/state?token='+encodeURIComponent(token),{cache:'no-store'});if(!r.ok)throw new Error('Host unavailable');const s=await r.json();if(s.schema!=='avatar-state/v1')throw new Error('Protocol mismatch');if(session!==s.session){session=s.session;reactionSeq=0;mood='neutral';}state=s;lastReceived=performance.now();status.textContent='Mochi · connected';}catch{status.textContent='Disconnected · resting';}finally{setTimeout(poll,50);}}poll();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;const t=now/1000,s=now-lastReceived<1000?state:null;
 const next=s?.emotion||'neutral';if(next!==mood){mood=next;moodAt=t;}
 if(s?.reaction_seq!==reactionSeq){reactionSeq=s?.reaction_seq||0;reactionAt=t;}
 const reaction=s?.reaction||'',duration=REACTIONS[reaction]?.duration||1;
 const values={...STANCE,faceMood:Math.max(0,FACE_MOODS.indexOf(mood))/(FACE_MOODS.length-1),faceMoodAge:t-moodAt,faceEnergy:1,
 faceReaction:reaction?(Object.keys(REACTIONS).indexOf(reaction)+1)/Object.keys(REACTIONS).length:0,faceProgress:Math.min(1,(t-reactionAt)/duration),
 gazeX:s?.gaze?.[0]||0,gazeY:s?.gaze?.[1]||0,jaw:s?.speaking?s.jaw:0};
 const clip=s?.clip, id=clip?['squint_wink','pong','sleep_bubble','tongue','anger','speedometer','scare','tired','hearts_kiss','yawn'].indexOf(clip):-1;
 stage.facePainter=id>=0?ctx=>CLIPS[`cell_${Math.floor(id/2)}_${id%2}`].draw(ctx,Math.max(0,(Date.now()-s.clip_started_at_ms)/1000),{intensity:1,gazeX:s.gaze?.[0]||0}):null;
 stage.update(values,dt,t);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
