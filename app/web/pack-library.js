import {StudyCharacter} from './render-studies.js';
import {OledFace, VisorFace} from './render-led.js';
import {AnimeChar} from './render-anime.js';
import {Char3D} from './render-3d.js';
import {VrmChar} from './render-vrm.js';
import {KinCharacter} from './kin-character.js';

class MediaCharacter {
  constructor(canvas, rep) {
    this.c=canvas; this.ctx=canvas.getContext('2d'); this.rep=rep;
    this.media=document.createElement(rep.mediaType==='video'?'video':'img');
    this.media.src=rep.asset;
    if(rep.mediaType==='video'){this.media.muted=true;this.media.loop=true;this.media.playsInline=true;}
  }
  draw(rig,w,h){
    const m=this.media,g=this.ctx;
    if(m.tagName==='VIDEO'&&m.paused)m.play().catch(()=>{});
    g.clearRect(0,0,w,h);
    const mw=m.videoWidth||m.naturalWidth,mh=m.videoHeight||m.naturalHeight;
    if(mw&&mh){const k=Math.min(w/mw,h/mh);g.drawImage(m,(w-mw*k)/2,(h-mh*k)/2,mw*k,mh*k);}
  }
  suspend(){if(this.media.pause)this.media.pause();}
}

const FILTERS = {hue: v => `hue-rotate(${v}deg)`, saturate: v => `saturate(${v})`, brightness: v => `brightness(${v})`,
  contrast: v => `contrast(${v})`, sepia: v => `sepia(${v})`, grayscale: v => `grayscale(${v})`};
export const filterCss = (f = {}) => Object.entries(f).filter(([k, v]) => FILTERS[k] && Number.isFinite(+v)).map(([k, v]) => FILTERS[k](+v)).join(' ');

export function charactersFromPacks(packs) {
  const result=[];
  for(const pack of packs) for(const rep of pack.representations){
    if(!rep.supported)continue;
    const d=rep.defaults||{}, live=rep.status==='Live rig';
    const look=rep.look||{}, filter=filterCss(look.filter);
    const build=(c,ov)=>{
      switch(rep.adapter){
        case 'jaeger-study':return new StudyCharacter(c,rep.preset);
        case 'nori-vrm':return new VrmChar(c,ov,rep.asset);
        case 'nori-anime':return new AnimeChar(c,ov,rep.preset,look.palette);
        case 'nori-3d':return new Char3D(c,ov,rep.preset);
        case 'nori-led':return rep.preset==='mochi'?new OledFace(c):new VisorFace(c);
        case 'kin-momo':case 'kin-vrm':return new KinCharacter(c,rep);
        default:return new MediaCharacter(c,rep);
      }
    };
    // A pack's own colours over a shared rig; the anime rig also inserts a room canvas beside its own.
    const make=(c,ov)=>{const f=build(c,ov);if(filter)for(const el of c.parentNode.querySelectorAll('canvas'))el.style.filter=filter;return f;};
    result.push({...d,id:d.id||`${pack.id}--${rep.id}`,packId:pack.id,profileId:pack.defaultProfile,
      representationId:rep.id,name:pack.name,label:rep.name|| (rep.adapter==='kin-vrm'?`${pack.name} · KIN`:pack.name),
      tag:d.tag||rep.status,kokoro:d.kokoro||'af_heart',voice:d.voice||'en_US-kristin-medium',pitch:d.pitch||1,
      intro:d.intro||`[joy] I'm ${pack.name}, an AI character.`,live,featured:live&&!d.library,make,rep,pack});
  }
  return result.sort((a,b)=>(a.id==='vita'?-1:b.id==='vita'?1:0));
}

export function mountLibrary(packs,characters,onSelect){
  const grid=document.querySelector('#libraryGrid'), search=document.querySelector('#librarySearch');
  const draw=()=>{
    grid.replaceChildren();
    for(const pack of packs.filter(p=>(p.name+' '+p.id).toLowerCase().includes(search.value.toLowerCase()))){
      const card=document.createElement('article'),title=document.createElement('h3');title.textContent=pack.name;card.append(title);
      const portrait=pack.profiles.find(p=>p.card)?.card;
      if(portrait){const img=document.createElement('img');img.src=portrait;img.alt=pack.name;img.loading='lazy';card.prepend(img);}
      for(const rep of pack.representations){
        const b=document.createElement('button');b.textContent=`${rep.name||rep.id.replaceAll('_',' ')} · ${rep.status}`;
        b.disabled=!rep.supported;
        b.onclick=()=>{onSelect(characters.find(c=>c.packId===pack.id&&c.representationId===rep.id).id);document.querySelector('#library').close();};
        card.append(b);
      }
      if(!pack.representations.length){const p=document.createElement('p');p.textContent=pack.error?'Pack unavailable · '+pack.error:'Persona only · no visual representation';card.append(p);}
      grid.append(card);
    }
  };
  search.oninput=draw;draw();
  document.querySelector('#libraryOpen').onclick=()=>document.querySelector('#library').showModal();
  document.querySelector('#libraryClose').onclick=()=>document.querySelector('#library').close();
}
