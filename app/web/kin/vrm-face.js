// Nori's morph-name vocabulary, adapted to KIN's existing rig and audio channels.
import {MORPHS} from './imported/nori-morphs.js';
const unit=x=>Math.max(0,Math.min(1,x||0));
export function bindFace(scene,parser){
 const bindings=[],found=new Set();
 scene.traverse(mesh=>{
  // VRoid 0.x puts target names on primitives, which GLTFLoader does not read.
  // Restore those names using Nori's render-vrm.js association technique.
  const at=parser?.associations.get(mesh);
  const names=at&&parser.json.meshes[at.meshes]?.primitives[at.primitives??0]?.extras?.targetNames;
  if(names&&mesh.morphTargetInfluences?.length===names.length)mesh.morphTargetDictionary=Object.fromEntries(names.map((name,index)=>[name,index]));
  if(!mesh.morphTargetDictionary||!mesh.morphTargetInfluences)return;
  for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
   const key=Object.keys(MORPHS).find(key=>MORPHS[key].test(name));
   if(key){bindings.push({mesh,index,key});found.add(key);}
  }
 });
 return {bindings,detailed:['aa','smile','blinkL','blinkR'].every(key=>found.has(key))};
}
export function facialWeights(v,onTwos=false){
 const vowels=Object.fromEntries(['aa','ih','ou','ee','oh'].map(key=>[key,onTwos?(v[key]>.22?.85:0):unit(v[key])]));
 const speech=Math.max(...Object.values(vowels)),smile=unit(v.smile),sad=unit(-v.smile)*(1-unit(v.tint)),angry=unit(v.tint);
 const blinkL=unit(Math.max(1-v.lid,v.winkL,v.squeeze)),blinkR=unit(Math.max(1-v.lid,v.winkR,v.squeeze));
 // Keep joy separate from eyelid closure: happy speech must still be able to wink.
 return {...vowels,smile:smile*(1-speech)*.8,smileOpen:smile*speech*.22,
  frown:sad*.65,snarl:angry*.4,blinkL,blinkR,
  eyeJoy:unit(smile*.2+v.squeeze*.65)*(1-Math.max(blinkL,blinkR)),
  eyeWide:unit(v.surprise)*.9,eyeAngry:angry*.75,eyeSad:sad*.7,
  browUp:unit(v.brow)*.85,browAngry:angry*.9,browSad:Math.max(sad,unit(-v.brow)*(1-angry))*.8,blush:unit(v.blush)};
}
export function applyFace(face,v,onTwos=false){
 const weights=facialWeights(v,onTwos);
 for(const {mesh,index,key} of face.bindings)mesh.morphTargetInfluences[index]=weights[key]||0;
}
