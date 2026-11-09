import test from 'node:test';
import assert from 'node:assert/strict';
import {Rig} from '../app/web/rig.js';
import {faceShapes} from '../app/web/model-map.js';
import {sampleKin,VOWELS} from '../app/web/lip-sync.js';

test('KIN chooses separate vowels while retaining Nori prosody and consonants',()=>{
  const original={open:.6,wide:.1,round:0,teeth:.8,energy:.7,pitch:-.2};
  const frames=[{jaw:.8,aa:0,ee:0,ih:0,oh:0,ou:.8}];
  const voice=sampleKin(frames,0,original);
  assert.equal(voice.energy,original.energy);assert.equal(voice.pitch,original.pitch);assert.equal(voice.teeth,.8);
  assert.deepEqual(voice.vowels,{aa:0,ee:0,ih:0,oh:0,ou:.8});assert.equal(original.open,.6);
  const rig=new Rig();rig.voice=voice;
  for(let i=0;i<80;i++)rig.tick(1/120);
  const shapes=faceShapes(rig.out,false);
  assert.ok(shapes.ou>.7);assert.ok(shapes.aa<.01);assert.ok(shapes.ih>.3);
  assert.ok(Object.values(rig.out).every(Number.isFinite));
});

test('hybrid mouths settle after stop and leave the original mode available',()=>{
  const rig=new Rig();rig.voice={open:.7,wide:0,round:0,teeth:0,energy:1,pitch:0,vowels:{aa:.9}};
  for(let i=0;i<30;i++)rig.tick(1/60);
  rig.voice=null;
  for(let i=0;i<90;i++)rig.tick(1/60);
  assert.equal(rig.out.kinMouth,0);
  for(const key of VOWELS)assert.ok(Math.abs(rig.out['lip'+key.toUpperCase()])<.001);
  const before=faceShapes({...rig.out,kinMouth:0},false);
  const after=faceShapes({...rig.out,kinMouth:0,lipAA:1},false);
  assert.deepEqual(after,before);
});

test('short tracks, silence and out-of-range times remain bounded',()=>{
  const n={open:0,wide:0,round:0,teeth:0,energy:0,pitch:0};
  assert.equal(sampleKin([],0,n),n);assert.equal(sampleKin([{jaw:0}],0,null),null);
  for(const t of [-1,0,1,100])assert.deepEqual(sampleKin([{jaw:0}],t,n).vowels,{aa:0,ee:0,ih:0,oh:0,ou:0});
});
