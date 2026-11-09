import test from 'node:test';
import assert from 'node:assert/strict';
import {start,faceToPuppet} from '../app/web/plugins/webcam/index.js';
const result=(score=.4)=>({faceBlendshapes:[{categories:[{categoryName:'jawOpen',score}]}]});
const flush=()=>new Promise(r=>setImmediate(r));
function setup(t,{playError=false}={}){
 const keys=['Worker','navigator','document','setInterval','clearInterval','createImageBitmap'];
 const previous=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{for(const [k,d] of previous)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});
 let worker,tick,resolveBitmap,disposed=0,stops=0,cleared=0;
 const track={stop(){stops++;},onended:null};
 const video={readyState:2,play:async()=>{if(playError)throw Error('video refused');},pause(){},srcObject:null};
 const values={
  Worker:class {constructor(){worker=this;this.sent=[];}postMessage(m){this.sent.push(m);if(m.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}terminate(){disposed++;}},
  navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}},
  document:{createElement:()=>video},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{cleared++;},
  createImageBitmap:()=>new Promise(r=>{resolveBitmap=r;})
 };
 for(const [k,v] of Object.entries(values))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 return {get worker(){return worker;},track,video,tick:()=>tick(),bitmap:v=>resolveBitmap(v),counts:()=>({disposed,stops,cleared})};
}
test('invalid tracker samples never enter the rig',()=>{
 assert.equal(faceToPuppet(null),null);assert.equal(faceToPuppet(result(NaN)),null);assert.equal(faceToPuppet(result(Infinity)),null);
 const r=result();r.facialTransformationMatrixes=[{data:Array(16).fill(NaN)}];assert.equal(faceToPuppet(r),null);
 assert.equal(faceToPuppet(result()).jaw,.6000000000000001);
});
test('video playback failure releases camera and worker',async t=>{
 const env=setup(t,{playError:true});await assert.rejects(start({},()=>{}),/video refused/);
 assert.equal(env.counts().stops,1);assert.equal(env.counts().disposed,1);assert.equal(env.video.srcObject,null);
});
test('stop is idempotent and late frames/results cannot revive tracking',async t=>{
 const env=setup(t),rig={};const stop=await start(rig,()=>{});
 const late=env.worker.onmessage;late({data:{type:'result',result:result()}});assert.ok(rig.puppet);
 env.tick();stop();stop();let closed=0;env.bitmap({close(){closed++;}});await flush();
 late({data:{type:'result',result:result()}});
 assert.equal(rig.puppet,null);assert.equal(closed,1);assert.equal(env.worker.sent.length,1);assert.equal(env.counts().stops,1);
});
test('worker failure stops capture, releases pose and reports inactive',async t=>{
 const env=setup(t),rig={};let inactive=0;const notes=[];await start(rig,s=>notes.push(s),()=>inactive++);
 env.worker.onmessage({data:{type:'result',result:result()}});env.worker.onerror({message:'inference crashed'});
 assert.equal(rig.puppet,null);assert.equal(inactive,1);assert.equal(env.counts().stops,1);assert.match(notes.at(-1),/inference crashed/);
});
test('camera disconnect ends capture and permits a fresh session',async t=>{
 const env=setup(t);let inactive=0;await start({},()=>{},()=>inactive++);env.track.onended();
 assert.equal(inactive,1);assert.equal(env.counts().disposed,1);assert.equal(env.video.srcObject,null);
 const stop=await start({},()=>{});stop();assert.equal(env.counts().disposed,2);
});
