import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleScene,DURATION,drawScene} from '../app/web/performances/mochi-scene-one.js';
test('scene returns to neutral and keeps authored expressions distinct',()=>{
 const neutral=sampleScene(0);
 assert.deepEqual(sampleScene(DURATION),neutral);
 assert.deepEqual(sampleScene(-10),neutral);
 assert.equal(sampleScene(5.5).squeeze,1);
 assert.equal(sampleScene(7.08).wink,1);
 assert.equal(sampleScene(7,'alternate').pong,1);
 assert.equal(sampleScene(DURATION,'alternate').pong,0);
});
test('both performances remain finite and continuous at frame boundaries',()=>{
 for(const variant of ['primary','alternate']){
  let last=sampleScene(0,variant);
  for(let t=1/120;t<=DURATION;t+=1/120){
   const next=sampleScene(t,variant);
   for(const k of Object.keys(next)){
    assert.ok(Number.isFinite(next[k]));
    assert.ok(Math.abs(next[k]-last[k])<.05,`${variant} ${k} discontinuity at ${t}`);
   }last=next;
  }
 }
});
test('procedural renderer uses finite geometry without image or video input',()=>{
 const ctx=new Proxy({canvas:{width:1024,height:640},globalAlpha:1},{get(o,k){
  if(k in o)return o[k];
  assert.notEqual(k,'drawImage');
  return (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));};
 }});
 for(const variant of ['primary','alternate'])for(let t=0;t<=DURATION;t+=.1)drawScene(ctx,t,{variant});
});
