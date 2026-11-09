import {install,morphs} from './bench.js';
export async function setup(a){
 const {stage,rig,voice}=a;
 return install({
  name:'KIN', variants:[['vita-kin','Vita · KIN'],['anime','Vita · Nori'],['robot','Momo'],['mochi','Mochi'],['vee','Vee']],
  context:()=>voice.context,unlock:()=>voice.unlock(),stop:a.stop,neutral:()=>a.setMood('neutral'),
  canvas:()=>stage.canvas,audioOutput:()=>voice.gain,
  recordFraming:close=>{stage.portrait=close;stage.frameCamera();},
  async select(id){await a.chooseCharacter(id,false);rig.intensity=1;stage.onTwos=false;stage.portrait=false;stage.renderer.setPixelRatio(1);stage.resize();if(stage.imported.avatar)stage.imported.avatar.scale=1/Math.min(1.5,devicePixelRatio||1);},
  async prepare(f){voice.profiles[a.character]={engine:'expressive',speaker:'af_heart',emotion:'neutral'};voice.cache.set(JSON.stringify(voice.request(f.text,a.character,{emotion:'neutral'})),f);},
  speak(f,one=false){voice.enqueue(f.text,a.character,{emotion:'neutral',gestures:['wave']});if(!one)voice.enqueue(f.text,a.character,{emotion:'neutral',gestures:['nod']});},
  move:name=>['robot','mochi','vee'].includes(a.character)?a.performReaction(name):a.performMove(name,false),
  isDisplay:id=>['robot','mochi','vee'].includes(id),reel:a.startReel,reelMs:42000,
  observeActions(cb){for(const [obj,key,kind] of [[rig,'gesture','gesture'],[rig,'react','reaction'],[rig,'setEmotion','emotion']]){const fn=obj[key].bind(obj);obj[key]=(...args)=>{cb(kind,args[0]);return fn(...args);};}},
  read(){
   const v=rig.values, imported=stage.character!=='robot'&&!stage.classic, avatar=imported?stage.imported.avatar:null;
   const m=avatar?.m, cam=imported?avatar?.cam:stage.camera, root=imported?m?.root:stage.cast;
   const mouth=stage.classic?['aa','ih','ou','ee','oh'].map(k=>{const b=stage.faceBindings?.bindings.find(b=>b.key===k);return b?.mesh.morphTargetInfluences[b.index]||0;}):imported&&stage.character==='anime'?morphs(m?.binds):[v.n_jaw??v.jaw];
   const bone=k=>stage.classic?stage.vrm?.humanoid.getNormalizedBoneNode(k):m?.node(k);
   return {mouth,jaw:stage.classic?v.jaw:v.n_jaw,head:stage.classic?[v.headX,v.headY,v.headZ]:[v.n_pitch,v.n_yaw,v.n_roll],rightArm:bone('rightUpperArm')?.quaternion.toArray(),camera:cam?.position.toArray(),root:root?.rotation.y,gesture:rig.gestureActive?rig.gestureName:'',dimensions:[stage.canvas.width,stage.canvas.height],internalDimensions:imported&&stage.character==='anime'?[avatar.c.width,avatar.c.height]:undefined};
  }
 });
}
