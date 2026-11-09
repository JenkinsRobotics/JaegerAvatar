import {StudyCharacter} from './render-studies.js';
import {Rig} from './rig.js';
const $=id=>document.getElementById(id),rig=new Rig();let renderers=[],paused=false,mouth=false,last=performance.now();
try{
 const response=await fetch('/api/avatars');if(!response.ok)throw new Error('Catalog HTTP '+response.status);
 const packs=await response.json();
 for(const pack of packs){
  const live=pack.representations.find(r=>r.id===pack.defaultRepresentation&&r.status==='Live rig')||pack.representations.find(r=>r.status==='Live rig');
  const card=document.createElement('article');card.className='card';card.dataset.study=String(live?.adapter==='jaeger-study');card.dataset.search=(pack.name+' '+pack.id).toLowerCase();
  const art=document.createElement('div');art.className='art';card.append(art);
  if(live?.adapter==='jaeger-study'){
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=440;canvas.setAttribute('aria-label',pack.name+' animated vector preview');art.append(canvas);renderers.push({card,canvas,face:new StudyCharacter(canvas,live.preset)});
  }else{
   const portrait=pack.profiles.find(p=>p.card)?.card;
   if(portrait){const image=document.createElement('img');image.src=portrait;image.alt=pack.name;image.loading='lazy';art.append(image);}
  }
  const title=document.createElement('h2');title.textContent=pack.name;card.append(title);
  const note=document.createElement('p');note.textContent=live?.adapter==='jaeger-study'?'Animated vector fan study':live?.defaults?.tag||(pack.error?'Pack unavailable':'No live renderer');card.append(note);
  if(live){const a=document.createElement('a');a.textContent='Launch character';a.href='/?face='+encodeURIComponent(live.defaults?.id||`${pack.id}--${live.id}`);a.setAttribute('aria-label','Launch '+pack.name);card.append(a);}
  $('grid').append(card);
 }
 $('status').textContent=`${packs.length} packs · ${$('grid').querySelectorAll('a').length} launchable · ${renderers.length} distinct new vector studies · full app launch links`;
 const filter=()=>{for(const c of $('grid').children)c.hidden=!c.dataset.search.includes($('search').value.toLowerCase())||($('group').value==='studies'&&c.dataset.study!=='true');};
 $('search').oninput=filter;$('group').onchange=filter;filter();
 $('emotion').onchange=()=>rig.setEmotion($('emotion').value);
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume previews':'Pause previews';};
 $('mouth').onclick=()=>{mouth=!mouth;$('mouth').textContent=mouth?'Stop mouth test':'Test mouth motion';};
 for(const id of ['pause','mouth','group','emotion'])$(id).disabled=false;
 $('grid').onpointermove=e=>{const r=$('grid').getBoundingClientRect();rig.look((e.clientX-r.left)/r.width*2-1,0);};
 function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused&&!document.hidden){rig.tick(dt);if(mouth)rig.out.jaw=.15+.65*Math.max(0,Math.sin(rig.t*9));for(const r of renderers)if(!r.card.hidden)r.face.draw(rig,400,440);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(e){$('status').textContent='Unable to load demo packs: '+e.message;}
