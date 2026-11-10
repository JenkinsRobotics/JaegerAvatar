import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceAudio } from '../app/web/embedded/performance-audio.js';
let sources=[];
class Context {
  state='running';currentTime=0;
  createGain(){return {connect(){},gain:{setTargetAtTime(){}}};}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
  async decodeAudioData(){return {duration:16.709};}
  createBufferSource(){const source={connect(){},disconnect(){},start(_,offset){this.offset=offset;},stop(){this.stopped=true;}};sources.push(source);return source;}
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function fakeFetch(){globalThis.fetch=async url=>({ok:true,json:async()=>({schema:'mochi-performance-audio/v1',clips:{hearts_kiss:{file:'hearts_kiss.wav'},pong:{file:'pong.wav'}}}),arrayBuffer:async()=>new ArrayBuffer(8)});globalThis.AudioContext=Context;sources=[];}
const state=(clip='hearts_kiss',seq=1)=>({clip,clip_seq:seq,clip_started_at_ms:Date.now()-1000,session:'a',emotion:'neutral'});
test('offset follows the visual clock; duplicate state does not retrigger; Stop clears scheduled source',async()=>{
 fakeFetch();const p=new PerformanceAudio('/audio/');await p.unlock();const s=state();p.update(s);await settle();assert.equal(sources.length,1);assert.ok(sources[0].offset>=1);p.update(s);await p.unlock();await settle();assert.equal(sources.length,1);p.update({...s,clip:''});assert.equal(sources[0].stopped,true);p.dispose();
});
test('mute stops immediately; unmute rejoins the current offset; replay sequence replaces audio',async()=>{
 fakeFetch();const p=new PerformanceAudio('/audio/');await p.unlock();p.update(state());await settle();p.setEnabled(false);assert.equal(sources[0].stopped,true);p.setEnabled(true);await settle();assert.equal(sources.length,2);p.update(state('hearts_kiss',2));await settle();assert.equal(sources[1].stopped,true);assert.equal(sources.length,3);p.dispose();
});
test('cancel while decode is pending prevents late sound',async()=>{
 fakeFetch();let release;Context.prototype.decodeAudioData=()=>new Promise(r=>release=r);const p=new PerformanceAudio('/audio/');await p.unlock();p.update(state());await settle();p.stop();release({duration:17});await settle();assert.equal(sources.length,0);p.dispose();
});
