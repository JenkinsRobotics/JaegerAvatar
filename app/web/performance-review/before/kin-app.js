import {VoiceDesk} from './voice-desk.js';
import {CHARACTERS,isDisplay} from './characters.js';
import {AvatarStage} from './renderer.js?v=blend-1';
import {Rig} from './rig.js?v=blend-1';
import {TagParser,EMOTIONS,GESTURES} from './parser.js';
import {VoiceEngine} from './audio.js?v=demo-2';
import {REELS,ReelTimeline,expressiveReel} from './reel.js';
import {consumeReply} from './stream.js';
import {SpeechPhrases} from './phrases.js';
import {MOVES} from './motion.js?v=blend-1';
import {Puppet} from './puppet.js';
import {PerformanceOutput} from './output.js';
import {Mood} from './imported/nori-mood.js';
import {REACTIONS,FACE_MOODS} from './eyes.js?v=blend-1';
const $=id=>document.getElementById(id);
const symbols={neutral:'○',joy:'☀',excited:'✷',love:'♡',sad:'☂',angry:'ϟ',surprised:'!',scared:'◌',thinking:'⌁',confused:'?',shy:'❀',smug:'⌐',sleepy:'☾',laughing:'⌣',singing:'♫',listening:'◎'};
const labels={neutral:'Just being here',joy:'A little sunshine',excited:'Full of possibility',love:'All heart',sad:'A softer moment',angry:'Feeling the fire',surprised:'Oh, hello!',scared:'A little uncertain',thinking:'Following a thought',confused:'Finding my way',shy:'A quiet kind of happy',smug:'I know a little secret',sleepy:'Drifting a little',laughing:'Couldn’t help myself',singing:'Finding a melody',listening:'You have my attention'};
function selectPanel(name){for(const b of document.querySelectorAll('[data-panel]')){const active=b.dataset.panel===name;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;} $('perform-panel').hidden=name!=='perform';$('talk-panel').hidden=name!=='talk';}
for(const b of document.querySelectorAll('[data-panel]')){b.onclick=()=>selectPanel(b.dataset.panel);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const name=e.key==='Home'?'perform':e.key==='End'?'talk':b.dataset.panel==='talk'?'perform':'talk';selectPanel(name);$(name==='talk'?'talk-tab':'perform-tab').focus();}};}
const rig=new Rig();let stage;
try{stage=new AvatarStage($('stage'));}catch(e){$('presence').textContent='WebGL is unavailable';console.error(e);}
let character='robot',history=[],controller=null,busy=false,forceScripted=false,muted=false,recording=null,micStream=null,replyStarted=0,firstSound=false,reelActive=false,voiceError=false,interactionEpoch=0,selectionEpoch=0;
const conversations={robot:history,anime:[],'vita-kin':[],mochi:[],vee:[]};let displayMode=0;
let chosenCharacter=false,customAvatar=false,remoteFrame=null,remoteAt=0,remotePausedPose='';
const output=new URLSearchParams(location.search).get('broadcast');
document.body.dataset.bg='clear';
const backdrop=output?null:new Mood($('stage'));let showBackdrop=true;
$('mood-backdrop').onclick=()=>{showBackdrop=!showBackdrop;$('mood-backdrop').setAttribute('aria-pressed',showBackdrop);$('mood-backdrop').textContent='✧ Mood backdrop '+(showBackdrop?'on':'off');if(backdrop)backdrop.c.hidden=!showBackdrop;};
if(output){document.documentElement.classList.add('broadcast-mode');document.body.classList.toggle('green-output',output==='green');}
const puppet=new Puppet(text=>{$('tracking-status').textContent=text;});
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function mood(name){rig.setEmotion(name);$('mood-label').textContent=labels[name]||name;$('mood-icon').textContent=symbols[name]||'○';for(const b of $('emotions').children){const active=b.dataset.emotion===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}}
const voice=new VoiceEngine(event=>{
 if(event.type==='start'){
  $('speech-caption').textContent=event.text|| (event.meta.mode==='laugh'?'[laughing]':'');$('speech-caption').hidden=!$('speech-caption').textContent;
  if(event.meta.emotion)mood(event.meta.emotion);for(const g of event.meta.gestures||[])performMove(g,false);
  $('presence').textContent=event.meta.mode==='sing'?'A little song, just for you':event.meta.mode==='laugh'?'A laugh in the room':'Speaking with you';
  if(replyStarted&&!firstSound){firstSound=true;const ms=performance.now()-replyStarted;$('latency').textContent=(ms/1000).toFixed(2)+' s';metrics.latencies.push(ms);}
 }else if(event.type==='end'||event.type==='stop'){$('speech-caption').hidden=true;if(event.type==='stop'&&event.active){$('voice-status').textContent='Voice stopped. Ready when you are.';$('research-status').textContent='Audition stopped. Choose a sample to compare.';}}else if(event.type==='error'){voiceError=true;toast(event.message);$('presence').textContent='Voice unavailable · text still works';}
 else if(event.type==='prepared'){metrics.synth.push(event.synthMs);metrics.analysis.push(event.analysisMs);}
 else if(event.type==='progress'){$('presence').textContent=event.message;$('voice-status').textContent=event.message;}
});
const voiceDesk=new VoiceDesk(voice,()=>character,stopEverything,toast);
for(const name of EMOTIONS){const b=document.createElement('button');b.className='emotion-button';b.dataset.emotion=name;b.setAttribute('aria-pressed','false');const symbol=document.createElement('span');symbol.className='symbol';symbol.textContent=symbols[name];const label=document.createElement('span');label.textContent=name[0].toUpperCase()+name.slice(1);b.append(symbol,label);b.onclick=()=>{stopEverything();mood(name);if(name==='singing')toast('For a sung performance, open Make a little song in the voice studio.');};$('emotions').append(b);}
function performMove(name,changeMood=true){if(isDisplay(character)){const reaction={spin:'roll',dance:'groove',wave:'blink',hop:'wake',celebrate:'sparkle',clap:'blink',bow:'peek',heart:'heart',wink:'wink',point:'sideeye',shrug:'sideeye',nod:'blink',shake:'roll'}[name];if(reaction)performReaction(reaction);return;}if(!MOVES[name])return;rig.gesture(name);if(changeMood)mood(name==='heart'?'love':name==='wink'?'smug':'joy');$('presence').textContent=MOVES[name].label+' · performing';}
for(const name of GESTURES){const b=document.createElement('button');b.textContent=MOVES[name].icon+' '+MOVES[name].label;b.dataset.move=name;b.onclick=()=>{stopEverything();performMove(name);};$('gestures').append(b);}
document.querySelectorAll('.quick-moves [data-move]').forEach(b=>b.onclick=()=>{stopEverything();performMove(b.dataset.move);});
function performReaction(name){if(!REACTIONS[name])return;rig.react(name);$('presence').textContent=REACTIONS[name].label+' · a little reaction';}
for(const [name,reaction] of Object.entries(REACTIONS)){const b=document.createElement('button');b.textContent=reaction.icon+' '+reaction.label;b.dataset.reaction=name;b.onclick=()=>{stopEverything();performReaction(name);};$('reactions').append(b);}
document.querySelectorAll('.quick-faces [data-reaction]').forEach(b=>b.onclick=()=>{stopEverything();performReaction(b.dataset.reaction);});
$('stage').addEventListener('click',()=>{if(isDisplay(character)){stopEverything();performReaction('wake');}});
mood('neutral');
const channelNames=['lid','winkL','winkR','brow','jaw','smile','headX','headY','headZ','bodyX','bodyZ','spin','lift','crouch','handLY','handRY','aa','oh'];
const channelEls={};for(const name of channelNames){const div=document.createElement('div');div.className='channel';div.innerHTML=`${name}<span>0.00</span><div class="channel-meter"><i></i></div>`;$('rig-channels').append(div);channelEls[name]=div;}
const reel=new ReelTimeline((beat,index,count)=>{
 mood(beat.mood);if(beat.reaction)performReaction(beat.reaction);if(beat.gesture)performMove(beat.gesture,false);
 $('reel-chapter').textContent=`${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')} · ${CHARACTERS[character].name.toUpperCase()} · LITTLE FEELINGS`;
 $('reel-title').textContent=beat.title;$('reel-caption').textContent=beat.caption;
 if(beat.text!==undefined)voice.enqueue(beat.text,character,{mode:beat.mode||'speech',emotion:beat.mood});
},()=>{reelActive=false;$('reel-pause').disabled=true;$('reel-title').textContent='Make a little moment of your own.';$('reel-caption').textContent='Replay, or explore the feelings at your own pace.';$('presence').textContent='Your turn.';});
function stopReel(){reel.stop();reelActive=false;voice.setPaused(false).catch(()=>{});$('reel-player').hidden=true;document.documentElement.classList.remove('reel-visible');$('demo').innerHTML='<span>▶</span> '+(isDisplay(character)?'Face reel':'Showtime');}
function stopEverything(){interactionEpoch++;controller?.abort();controller=null;voice.stop();stopReel();rig.cancelGesture();rig.cancelReaction();busy=false;firstSound=false;replyStarted=0;rig.speech={};$('stop').hidden=true;$('send').disabled=false;$('presence').textContent='Here with you';}
function present(enabled){document.documentElement.classList.toggle('presentation-mode',enabled);$('present').textContent=enabled?'↙ Exit presentation':'⛶ Present';$('present').setAttribute('aria-pressed',enabled);if(!enabled)$('present').focus();}
$('present').onclick=()=>present(!document.documentElement.classList.contains('presentation-mode'));
function pauseReel(){if(!reel.active)return;const paused=reel.togglePause();voice.setPaused(paused).catch(e=>toast('Audio: '+e.message));$('reel-pause').textContent=paused?'▶ Resume':'Ⅱ Pause';$('presence').textContent=paused?'A moment, held still':'The little performance continues';}
$('reel-pause').onclick=pauseReel;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&reel.active&&!reel.paused)pauseReel();});
async function chooseCharacter(name,greet=true){
 if(!CHARACTERS[name])return;const selection=++selectionEpoch;stopEverything();
 if(name==='vita-kin'&&!stage?.classicReady){if(!stage)return;const loaded=await stage.loadClassicAvatar('/models/vita.vrm');if(!loaded||selection!==selectionEpoch)return;}
 if(name==='anime'&&!stage?.ready){if(!stage)return;if(!stage.avatarPromise){toast('Loading Vita locally…');stage.avatarPromise=stage.loadAvatar().finally(()=>{stage.avatarPromise=null;});}const loaded=await stage.avatarPromise;if(!loaded||selection!==selectionEpoch)return;}
 if(selection!==selectionEpoch)return;const changed=character!==name;character=name;history=conversations[name];if(changed){$('messages').replaceChildren();for(const m of history)message(m.role,m.content);$('suggestions').hidden=history.length>0;}document.documentElement.classList.toggle('momo-focus',isDisplay(name));$('demo').innerHTML='<span>▶</span> '+(isDisplay(name)?'Face reel':'Showtime');rig.spin=rig.spinOrigin=rig.values.spin=0;stage?.setCharacter(character);if(greet){mood('joy');performMove('wave',false);}
 document.querySelectorAll('[data-character]').forEach(x=>{const selected=x.dataset.character===name;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',selected);});
 voiceDesk.select(character);const profile=CHARACTERS[character];
 $('stage-label').textContent=profile.name.toUpperCase()+' / '+(profile.display?'DISPLAY COMPANION':'VIRTUAL PERFORMER');
 $('model-credit').textContent=profile.credit;
 $('studio-title').innerHTML=profile.title;$('studio-intro').innerHTML=profile.intro;
 $('playground-title').textContent=profile.display?'Every feeling, in the eyes.':'Give the feeling a pose.';
 document.querySelector('.vertical-note').textContent=profile.display?'A LITTLE SHELL. A LOT OF PERSONALITY.':'A LITTLE THEATRE. YOUR DIRECTION.';
 $('framing').classList.toggle('selected',stage?.portrait);
 $('display-mode').hidden=!['mochi','vee'].includes(character);
 if(character==='vee'&&displayMode===2)displayMode=0;
 $('display-mode').textContent=['Display: eyes + mouth','Display: eyes only','Display: OLED pixels'][displayMode];
 for(const b of document.querySelectorAll('[data-view],#framing')){b.disabled=['mochi','vee'].includes(character);b.hidden=b.disabled;}
 $('turnaround').disabled=['mochi','vee'].includes(character);
 if(backdrop)backdrop.c.hidden=isDisplay(character)||!showBackdrop;
 if(character==='anime')$('model-credit').textContent+=stage?.importedFaceDetailed?' Independent eye, brow and mouth morphs active.':' Standard VRM expressions.';
 if(customAvatar&&character==='anime')$('model-credit').textContent='Your local VRM · shared with output windows through this local server’s memory.';
 document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x.dataset.view==='0'));
}
document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{chosenCharacter=true;chooseCharacter(b.dataset.character);});
stage?.setCharacter('robot');
$('display-mode').onclick=()=>{displayMode=(displayMode+1)%(character==='vee'?2:3);$('display-mode').textContent=['Display: eyes + mouth','Display: eyes only','Display: OLED pixels'][displayMode];};
$('energy').oninput=e=>{rig.intensity=Number(e.target.value);$('energy-value').textContent=Math.round(rig.intensity*100)+'%';};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(stage)stage.targetTurn=Number(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));});
$('pose-rate').onclick=()=>{if(!stage)return;stage.onTwos=!stage.onTwos;$('pose-rate').textContent=stage.onTwos?'12 fps':'60 fps';$('pose-rate').setAttribute('aria-pressed',stage.onTwos);toast(stage.onTwos?'Vita’s poses are held at 12 fps. The motion rig keeps solving.':'Smooth motion restored.');};
$('framing').onclick=()=>{if(stage){stage.portrait=!stage.portrait;stage.frameCamera();$('framing').classList.toggle('selected',stage.portrait);}};
$('stage').addEventListener('pointermove',e=>{const r=$('stage').getBoundingClientRect();rig.pointer={x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2};});
$('stage').addEventListener('pointerleave',()=>rig.pointer={x:0,y:0});
$('message').addEventListener('input',()=>{rig.typing();if(!busy&&!voice.busy)mood('listening');});
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-form').requestSubmit();}});
$('sound-toggle').onclick=()=>{muted=!muted;voice.setVolume(muted?0:.85);$('sound-toggle').textContent=muted?'◖×':'◖))';$('sound-toggle').setAttribute('aria-label',muted?'Unmute voice':'Mute voice');$('sound-toggle').title=muted?'Unmute voice':'Mute voice';};
$('stop').onclick=stopEverything;$('stage-stop').onclick=stopEverything;
$('clear-chat').onclick=()=>{stopEverything();history.length=0;$('messages').replaceChildren();$('suggestions').hidden=false;mood('neutral');toast('A fresh little beginning.');};
$('scripted-toggle').onclick=()=>{forceScripted=!forceScripted;$('scripted-toggle').setAttribute('aria-pressed',forceScripted);$('scripted-toggle').textContent=forceScripted?'Use Gemma when available':'Use scripted rehearsal';$('connection-label').textContent=forceScripted?'Scripted rehearsal · local':'Checking local brain…';refreshStatus();};
function message(role,text){$('messages').querySelector('.welcome')?.remove();const div=document.createElement('div');div.className='message '+role;const label=document.createElement('small');label.textContent=role==='user'?'You':CHARACTERS[character].name;const content=document.createElement('span');content.textContent=text;div.append(label,content);$('messages').append(div);$('messages').scrollTop=$('messages').scrollHeight;return {div,content};}
async function send(text){
 text=text.trim();if(!text)return;selectPanel('talk');stopEverything();voiceError=false;busy=true;replyStarted=performance.now();firstSound=false;
 const requestId=new AbortController();controller=requestId;const turnCharacter=character,turnHistory=history,current=()=>controller===requestId&&!requestId.signal.aborted;
 $('message').value='';$('suggestions').hidden=true;$('stop').hidden=false;$('send').disabled=true;$('presence').textContent='A thought is taking shape';mood('thinking');
 turnHistory.push({role:'user',content:text});message('user',text);const reply=message('assistant','');reply.div.classList.add('pending');
 let prose='',mode='speech',emotion='joy',gestures=[];const seenGestures=new Set(),phrases=new SpeechPhrases();
 function speak(text){if(!current())return;const clean=text.replace(/\*+/g,'').trim();if(clean){voice.enqueue(clean,turnCharacter,{mode,emotion,gestures:[...new Set(gestures)]});gestures=[];}}
 function flush(){speak(phrases.flush());}
 const parser=new TagParser(event=>{
  if(!current())return;
  if(event.type==='text'){prose+=event.value;reply.content.textContent=prose;$('messages').scrollTop=$('messages').scrollHeight;for(const phrase of phrases.push(event.value,{hold:mode!=='speech'}))speak(phrase);}
  else if(event.type==='emotion'){flush();emotion=event.value;}
  else if(event.type==='gesture'&&!seenGestures.has(event.value)){seenGestures.add(event.value);gestures.push(event.value);}
  else if(event.type==='mode'){flush();mode=event.value;}
  else if(event.type==='sound'){flush();voice.enqueue('',turnCharacter,{mode:'laugh',emotion:'laughing',gestures:[...new Set(gestures)]});gestures=[];}
 });
 try{
  await voice.unlock();if(!current())return;
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:turnHistory,character:turnCharacter,scripted:forceScripted}),signal:requestId.signal});
  if(!current())return;if(!response.ok)throw Error((await response.json()).error||'Conversation unavailable');
  await consumeReply(response,requestId.signal,event=>{if(!current())return;if(event.type==='delta')parser.push(event.value);if(event.type==='source'){$('connection-label').textContent=event.value==='gemma'?'Gemma connected · local':event.value==='character'?'Character introduction · local':'Scripted rehearsal · local';$('connection-light').classList.toggle('offline',event.value==='scripted');}if(event.type==='error')toast('The response was interrupted: '+event.value);});
  if(!current())return;parser.end();flush();if(gestures.length)for(const g of gestures)performMove(g,false);turnHistory.push({role:'assistant',content:prose});if(!prose.trim())reply.content.textContent='I lost that thought. Try me again?';
 }catch(e){if(current()&&e.name!=='AbortError'){toast(e.message);if(!prose)reply.content.textContent='I couldn’t connect just then. Try the scripted rehearsal below.';}}
 finally{reply.div.classList.remove('pending');if(controller===requestId){controller=null;busy=false;$('send').disabled=false;}}
}
$('chat-form').onsubmit=e=>{e.preventDefault();send($('message').value);};
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));
async function startReel(expression=false){
 stopEverything();const epoch=interactionEpoch,cast=character;
 const script=expression?expressiveReel(CHARACTERS[cast].name,isDisplay(cast)):(REELS[cast]||REELS.robot);
 if(voice.profile(cast).engine!=='piper'&&script.beats.some(b=>b.text!==undefined)){
  const preparation=new AbortController();controller=preparation;busy=true;
  try{let done=0;const lines=script.beats.filter(b=>b.text!==undefined);for(const beat of lines){$('presence').textContent=`Preparing quality voice · ${done+1} / ${lines.length}`;await voice.prepare(beat.text,cast,{mode:beat.mode||'speech',emotion:beat.mood},preparation.signal);if(epoch!==interactionEpoch||cast!==character)return;done++;}}catch(e){if(e.name!=='AbortError')toast(e.message);return;}finally{if(controller===preparation){controller=null;busy=false;}}
 }
 if(script.beats.some(b=>b.text!==undefined)){try{await voice.unlock();}catch(e){toast('Audio: '+e.message);}if(epoch!==interactionEpoch||cast!==character)return;}
 rig.spin=rig.spinOrigin=rig.values.spin=0;if(stage){stage.turn=stage.targetTurn=0;if(!isDisplay(cast)){stage.portrait=expression;stage.frameCamera();$('framing').classList.remove('selected');}}
 document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x.dataset.view==='0'));
 reelActive=true;$('stop').hidden=false;$('reel-player').hidden=false;$('reel-pause').disabled=false;$('reel-pause').textContent='Ⅱ Pause';document.documentElement.classList.add('reel-visible');reel.start(script);
}
let expressivePlayback=false;const play=expressive=>{expressivePlayback=expressive;startReel(expressive);};$('demo').onclick=()=>play(false);$('acting-demo').onclick=()=>play(true);$('reel-replay').onclick=()=>startReel(expressivePlayback);
$('microphone').onclick=async()=>{
 if(recording){recording.stop();return;}
 try{
  stopEverything();await voice.unlock();micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));recording=new MediaRecorder(micStream,type?{mimeType:type}:{});const chunks=[];const recorder=recording;
  recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recording.onstop=async()=>{clearTimeout(recordingTimer);micStream?.getTracks().forEach(t=>t.stop());recording=null;$('microphone').classList.remove('recording');$('mic-label').textContent='Transcribing…';$('microphone').disabled=true;
   try{const r=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':recorder.mimeType},body:new Blob(chunks,{type:recorder.mimeType})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.text){$('message').value=d.text;rig.typing();$('presence').textContent='Ready when you are';toast('Your words are ready. Edit them or press Send.');}else toast('I didn’t catch any speech. Try a little closer.');}catch(e){toast(e.message);}finally{$('microphone').disabled=false;$('mic-label').textContent='Talk to me';mood('listening');}
  };
  recording.start();mood('listening');$('presence').textContent='Listening · tap the microphone to finish';$('microphone').classList.add('recording');$('mic-label').textContent='Finish recording';var recordingTimer=setTimeout(()=>recording?.stop(),30000);
 }catch(e){micStream?.getTracks().forEach(t=>t.stop());toast('Microphone: '+e.message);$('mic-label').textContent='Talk to me';}
};
async function saveEvidence(path,body){try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);toast('Saved in this studio’s evidence folder.');}catch(e){toast(e.message);}}
$('snapshot').onclick=()=>{if(stage)saveEvidence('/api/save-capture',{character,kind:'portrait',image:stage.screenshot()});};
$('turnaround').onclick=()=>{if(stage)saveEvidence('/api/save-capture',{character,kind:'turnaround',image:stage.turnaround()});};
const expressionsButton=document.createElement('button');expressionsButton.className='text-button';expressionsButton.id='expression-sheet';expressionsButton.textContent='Save expression sheet';$('turnaround').after(expressionsButton);
const motionButton=document.createElement('button');motionButton.className='text-button';motionButton.id='motion-record';motionButton.textContent='Record expression / motion preview';expressionsButton.after(motionButton);
let recordingPreview=false;
motionButton.onclick=async()=>{
 if(recordingPreview||!stage)return;stopEverything();recordingPreview=true;motionButton.disabled=true;motionButton.textContent='Recording the performance…';
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=800;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 if(!mime){toast('This browser cannot record WebM.');recordingPreview=false;motionButton.disabled=false;motionButton.textContent='Record expression / motion preview';stream.getTracks().forEach(t=>t.stop());return;}
 const chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000}),started=performance.now();let next=0;
 const sequence=isDisplay(character)?[{at:0,mood:'neutral',reaction:'blink'},{at:2500,mood:'joy',reaction:'wink'},{at:5000,mood:'excited'},{at:7500,mood:'love',reaction:'heart'},{at:10000,mood:'confused',reaction:'sideeye'},{at:12500,mood:'sad'},{at:15000,mood:'angry'},{at:17500,mood:'sleepy',reaction:'doze'},{at:21000,mood:'surprised',reaction:'wake'},{at:23500,mood:'laughing'},{at:26000,mood:'listening'}]:[{at:0,move:'spin'},{at:4000,move:'dance'},{at:11200,move:'hop'},{at:14000,move:'bow'},{at:17600,move:'celebrate'}];const duration=isDisplay(character)?28500:22000;const previousFraming=stage.portrait;stage.portrait=false;stage.frameCamera();
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=async()=>{stage.portrait=previousFraming;stage.frameCamera();stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mime});const reader=new FileReader();reader.onload=()=>saveEvidence('/api/save-motion',{character,video:reader.result});reader.readAsDataURL(blob);recordingPreview=false;motionButton.disabled=false;motionButton.textContent='Record expression / motion preview';};
 recorder.start();
 function draw(now){const age=now-started;if(next<sequence.length&&age>=sequence[next].at){const beat=sequence[next++];if(beat.mood)mood(beat.mood);if(beat.reaction)performReaction(beat.reaction);if(beat.move)performMove(beat.move);}ctx.fillStyle='#302735';ctx.fillRect(0,0,720,800);const src=stage.canvas,h=720,w=h*src.width/src.height;ctx.drawImage(src,(720-w)/2,40,w,h);ctx.fillStyle='#eed7bc';ctx.font='24px Georgia';ctx.fillText('KIN / '+(CHARACTERS[character].name+(isDisplay(character)?' — a whole world in two eyes':' — live motion')),30,37);ctx.font='14px sans-serif';ctx.fillText((isDisplay(character)?rig.emotion:(MOVES[rig.gestureName]?.label||'Settling'))+' · '+$('fps').textContent+' fps',30,774);if(age<duration)requestAnimationFrame(draw);else recorder.stop();}requestAnimationFrame(draw);
};
const trackerButton=document.createElement('button');trackerButton.className='text-button';trackerButton.id='check-tracker';trackerButton.textContent='Check local face tracker';motionButton.after(trackerButton);
trackerButton.onclick=async()=>{trackerButton.disabled=true;$('tracking-status').textContent='Testing local tracker without a camera…';try{const r=await puppet.check();$('tracking-status').textContent='Tracker test passed in '+r.milliseconds+' ms · no camera used';toast('Local face model and worker processed a test frame.');}catch(e){$('tracking-status').textContent='Tracker test failed: '+e.message;toast(e.message);}finally{trackerButton.disabled=false;}};
expressionsButton.onclick=()=>{
 if(!stage)return;stopEverything();const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=1280;const ctx=sheet.getContext('2d');ctx.fillStyle='#302735';ctx.fillRect(0,0,1280,1280);const previous={portrait:stage.portrait,turn:stage.turn,targetTurn:stage.targetTurn,onTwos:stage.onTwos,closeMix:stage.closeMix,autoWideUntil:stage.autoWideUntil};stage.closeMix=1;stage.autoWideUntil=0;stage.portrait=true;stage.turn=0;stage.targetTurn=0;stage.onTwos=false;stage.frameCamera();
 EMOTIONS.forEach((emotion,i)=>{const sample=new Rig(()=>.5);sample.setEmotion(emotion);sample.nextBlink=100;for(let f=0;f<180;f++)sample.update(1/60);stage.lastEyes=-Infinity;if(character!=='robot')for(let f=0;f<90;f++)stage.update(sample.values,1/60,3);stage.update(sample.values,0,3);if(character==='vita-kin'){stage.vrm?.springBoneManager?.reset();for(let f=0;f<90;f++)stage.vrm?.update(1/60);}stage.update(sample.values,1/60,3);const x=(i%4)*320,y=Math.floor(i/4)*320;const src=stage.canvas;const h=280,w=h*src.width/src.height;ctx.save();ctx.beginPath();ctx.rect(x,y,320,290);ctx.clip();ctx.drawImage(src,x+(320-w)/2,y,w,h);ctx.restore();ctx.font='14px sans-serif';ctx.fillStyle='#eed4b9';ctx.fillText(emotion.toUpperCase(),x+24,y+307);});
 Object.assign(stage,previous);stage.frameCamera();stage.update(rig.values,0,rig.time);stage.vrm?.springBoneManager?.reset();saveEvidence('/api/save-capture',{character,kind:'expressions',image:sheet.toDataURL('image/png')});
};
$('save-diagnostics').onclick=()=>{const report={character,captured:new Date().toISOString(),fps:1/(metrics.frames.reduce((a,b)=>a+b,0)/metrics.frames.length),meanJsFrameMs:metrics.costs.reduce((a,b)=>a+b,0)/metrics.costs.length,firstVoiceMs:metrics.latencies,synthesisMs:metrics.synth,audioAnalysisMs:metrics.analysis,renderer:stage?.renderer.info.render,notes:'Frame cost measures JavaScript submission, not full GPU time. Voice latency is observed playback start, not sound by ear.'};saveEvidence('/api/save-report',report);};
let lastEngineStatus=null,statusTimer;
function showEngineStatus(){
 if(!lastEngineStatus)return;
 const s=lastEngineStatus,live=s.brain==='gemma'&&!forceScripted,profile=voice.profile(character);
 const engine=profile.engine==='expressive'?`Kokoro · ${profile.speaker||'af_heart'} · ${s.kokoroReady?'ready':s.kokoroWarming?'warming up':'unavailable'}`:profile.engine==='clone'?'Chatterbox · reference matching':`Piper · ${s.voice}`;
 $('connection-label').textContent=live?'Gemma connected · local':'Scripted rehearsal · local';$('connection-light').classList.toggle('offline',!live);
 $('engine-note').textContent=`Brain: ${live?s.model+' · raw completions':'scripted rehearsal'} · Voice: ${engine} · Microphone: ${s.microphone} · Audio drives the mouth 55 ms ahead of playback.`;
}
window.addEventListener('kin-voice-profile',showEngineStatus);
async function refreshStatus(){try{
 const r=await fetch('/api/status');if(!r.ok)throw Error('Local server unavailable');lastEngineStatus=await r.json();showEngineStatus();
 clearTimeout(statusTimer);if(lastEngineStatus.voice==='loading'||lastEngineStatus.kokoroWarming)statusTimer=setTimeout(refreshStatus,2000);
}catch(e){$('connection-label').textContent='Local server disconnected';$('connection-light').classList.add('offline');}}
refreshStatus();
$('stage').addEventListener('avatar-error',e=>toast('Vita could not load: '+e.detail));
$('camera-puppet').onclick=async()=>{const b=$('camera-puppet');b.disabled=true;try{if(puppet.camera)puppet.stopCamera();else await puppet.startCamera();b.setAttribute('aria-pressed',puppet.camera);b.textContent=puppet.camera?'◎ Stop camera':'◎ Camera puppeteer';}catch(e){toast('Camera: '+e.message);}finally{b.disabled=false;}};
$('mic-puppet').onclick=async()=>{const b=$('mic-puppet');b.disabled=true;try{if(puppet.microphone)puppet.stopMic();else{voice.stop();await puppet.startMic();}b.setAttribute('aria-pressed',puppet.microphone);b.textContent=puppet.microphone?'◖ Stop live mic':'◖ Live mic lip sync';}catch(e){toast('Microphone: '+e.message);}finally{b.disabled=false;}};
$('load-vrm').onclick=()=>$('vrm-file').click();
$('vrm-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>100_000_000){toast('Please use a VRM smaller than 100 MB.');return;}const url=URL.createObjectURL(file);stopEverything();$('load-vrm').disabled=true;try{if(await stage.loadAvatar(url)){customAvatar=true;chosenCharacter=true;chooseCharacter('anime');toast('Loaded '+file.name+' locally.');await relay.avatar(await file.arrayBuffer());}}catch(e){toast(e.message);}finally{URL.revokeObjectURL(url);$('load-vrm').disabled=false;e.target.value='';}};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){stopEverything();present(false);puppet.stop();$('camera-puppet').setAttribute('aria-pressed','false');$('mic-puppet').setAttribute('aria-pressed','false');$('camera-puppet').textContent='◎ Camera puppeteer';$('mic-puppet').textContent='◖ Live mic lip sync';return;}
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
 if(e.key.toLowerCase()==='f'){e.preventDefault();present(!document.documentElement.classList.contains('presentation-mode'));return;}
 if(e.code==='Space'&&reel.active&&e.target.tagName!=='BUTTON'){e.preventDefault();pauseReel();return;}
 const move={s:'spin',d:'dance',w:isDisplay(character)?'wink':'wave',c:'clap',b:'bow',h:'heart',p:'point',j:'hop'}[e.key.toLowerCase()];if(move){e.preventDefault();stopEverything();performMove(move);}
});
const relay=new PerformanceOutput(output,data=>{remoteFrame=data;remoteAt=performance.now();if(stage&&character!==data.character)chooseCharacter(data.character,false);},async url=>{customAvatar=await stage.loadAvatar(url);});
if(output&&stage){stage.dust.visible=false;stage.shadow.visible=false;}
window.addEventListener('pagehide',()=>{puppet.stop();relay.close();});
const metrics={frames:[],costs:[],latencies:[],synth:[],analysis:[]};let prev=performance.now(),lastReadout=0,lastPresence=0,lastReelReadout=0;
function frame(now){
 const dt=Math.min(Math.max(0,(now-prev)/1000),.1);prev=now;const start=performance.now();reel.advance(dt);const paused=reel.paused;const mouth=voice.update(),live=puppet.update(now);rig.speaking=voice.busy||(live.mouth?.jaw||0)>.08;rig.speech=voice.busy?mouth:live.mouth||{};rig.tracking=live.face;if(live.face&&voice.busy)rig.tracking={...live.face,...mouth};else if(live.face&&live.mouth)rig.tracking={...live.face,...live.mouth};
 let values=paused?rig.values:rig.update(dt),renderTime=rig.time;values.performancePaused=paused?1:0;values.displayMode=displayMode;
 if(output&&remoteFrame){values=remoteFrame.values;renderTime=remoteFrame.time;if(stage){stage.portrait=remoteFrame.portrait;stage.autoWideUntil=remoteFrame.wideUntil;stage.targetTurn=remoteFrame.view;stage.onTwos=remoteFrame.onTwos;}}
 const pauseKey=`${character}/${stage?.ready}/${renderTime}/${stage?.portrait}/${stage?.targetTurn}`;if(!values.performancePaused){stage?.update(values,dt,renderTime);remotePausedPose='';}else if(stage){if(output&&remotePausedPose!==pauseKey){stage.update(values,0,renderTime);remotePausedPose=pauseKey;}else stage.renderHeld();}if(backdrop&&!isDisplay(character)&&showBackdrop){const r=$('stage').parentElement;backdrop.draw(FACE_MOODS[Math.round(values.faceMood*(FACE_MOODS.length-1))]||'neutral',renderTime,r.clientWidth,r.clientHeight,r.clientWidth/2,r.clientHeight*.4);}const cost=performance.now()-start;
 if(!output)relay.send({character,customAvatar,values,time:rig.time,portrait:stage?.portrait,wideUntil:stage?.autoWideUntil,view:stage?.targetTurn,onTwos:stage?.onTwos},now);
 if((reel.active||reel.progress===1)&&now-lastReelReadout>100){lastReelReadout=now;$('reel-progress').value=reel.progress;const stamp=t=>'0:'+String(Math.floor(t)).padStart(2,'0');$('reel-time').textContent=stamp(reel.elapsed)+' / '+stamp(reel.script.duration);}
 metrics.frames.push(dt);metrics.costs.push(cost);if(metrics.frames.length>600){metrics.frames.shift();metrics.costs.shift();}
 if(now-lastReadout>400){lastReadout=now;const recent=metrics.frames.slice(-60);$('fps').textContent=Math.round(recent.length/recent.reduce((a,b)=>a+b,0));const costs=metrics.costs.slice(-60);$('frame-cost').textContent=(costs.reduce((a,b)=>a+b,0)/costs.length).toFixed(1);
  document.querySelectorAll('[data-reaction]').forEach(b=>b.classList.toggle('active',rig.reactionActive&&b.dataset.reaction===rig.reactionName));
  document.querySelectorAll('[data-move]').forEach(b=>b.classList.toggle('active',rig.gestureActive&&b.dataset.move===rig.gestureName));
  if(document.querySelector('.inspector').open)for(const name of channelNames){channelEls[name].querySelector('span').textContent=values[name].toFixed(2);channelEls[name].querySelector('i').style.transform=`scaleX(${Math.min(1,Math.abs(values[name]))})`;}
 }
 if(!busy&&!voice.busy&&!reelActive&&!rig.gestureActive&&!rig.reactionActive&&now-lastPresence>1000){lastPresence=now;$('stop').hidden=true;if(!recording&&!voiceError)$('presence').textContent=puppet.camera?'Following your expression':'Here with you';}
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
// Small public inspection surface for reproducible local diagnostics and screenshots.
window.kin={stage,rig,voice,puppet,metrics,setMood:mood,performMove,send,stop:stopEverything,get character(){return character;}};
