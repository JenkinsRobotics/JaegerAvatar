import test from 'node:test';
import assert from 'node:assert/strict';
import {StudyCharacter,STUDIES} from '../app/web/render-studies.js';
import {Rig,EMOTIONS} from '../app/web/rig.js';
function recorder(){const calls=[];return {calls,ctx:new Proxy({}, {get(o,k){return (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),k);calls.push([k,...args]);};},set(o,k,v){calls.push([k,v]);return true;}})};}
test('all sixteen studies render distinct geometry, and respond to speech',()=>{
 const signatures=new Set();
 for(const id of Object.keys(STUDIES)){
  const r=new Rig(),rec=recorder(),face=new StudyCharacter({getContext:()=>rec.ctx},id);r.tick(1/60);face.draw(r,400,460);
  const neutral=JSON.stringify(rec.calls);signatures.add(neutral);rec.calls.length=0;r.out.jaw=.8;face.draw(r,400,460);
  assert.notEqual(JSON.stringify(rec.calls),neutral,id+' speech response');
  for(const emotion of Object.keys(EMOTIONS)){r.setEmotion(emotion);for(let n=0;n<30;n++)r.tick(1/60);face.draw(r,400,460);}
 }
 assert.equal(signatures.size,16);
});
test('unknown studies cannot silently fall back to a duplicate',()=>assert.throws(()=>new StudyCharacter({},'unknown')));
