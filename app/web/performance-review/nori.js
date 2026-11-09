import {install,morphs} from './bench.js';
export async function setup(a){
 const {rig}=a;
 return install({
  name:'Nori',variants:[['vita','Vita'],['mochi','Mochi'],['visor','Vee']],
  context:a.audio,unlock:a.startSound,stop:a.stopEverything,neutral:()=>rig.setEmotion('neutral'),
  canvas:()=>a.faceFor(a.current()).c,audioOutput:a.speaker,
  recordFraming:close=>{const f=a.faceFor(a.current());f.fullLock=!close;f.full=close?0:1;},
  async select(id){a.setView(id);a.TIMING.onTwos=false;a.STAGE.calm=true;rig.energy=rig.intensity=1;const f=a.faceFor(id);if(f.loaded)await f.loaded;if(f.gl){f.scale=.5;f.full=1;f.fullLock=true;}},
  prepare:async(f)=>{const bytes=Uint8Array.from(atob(f.audio),c=>c.charCodeAt(0)),{samples,sr}=a.readWav(bytes.buffer);const c={samples,sr,natural:true,track:await a.work('analyze',samples,sr)};a.seed(f.text,c);},
  speak(f,one=false){a.speakFixture(f.text,one);},
  move:a.act,isDisplay:id=>id!=='vita',reel:a.playReel,reelMs:42000,
  observeActions(cb){for(const [key,kind] of [['move','gesture'],['gesture','small-gesture'],['react','reaction'],['setEmotion','emotion']]){const fn=rig[key].bind(rig);rig[key]=(...args)=>{cb(kind,args[0]);return fn(...args);};}},
  read(){const f=a.faceFor(a.current()),m=f.m;return {mouth:m?morphs(m.binds):[rig.out.jaw],jaw:rig.out.jaw,head:[rig.out.pitch,rig.out.yaw,rig.out.roll],rightArm:m?.node('rightUpperArm')?.quaternion.toArray(),camera:f.cam?.position.toArray(),root:m?.root.rotation.y,gesture:rig.act?.name??'',voiceActive:!!a.clip(),voiceNatural:!!a.clip()?.natural,dimensions:[f.c.width,f.c.height],internalDimensions:m?[f.c.width,f.c.height]:undefined};}
 });
}
