// The original KIN appearances, driven by Nori's single performance clock.
import {AvatarStage} from './kin/renderer.js';
import {STANCE,sampleMove,MOVES} from './kin/motion.js';
import {FACE_MOODS,REACTIONS} from './kin/eyes.js';
import {faceShapes} from './model-map.js';
import {TIMING} from './render-anime.js';
import {Mood} from './anime-fx.js';

export class KinCharacter {
  constructor(canvas,rep){
    this.c=canvas;this.gl=true;this.rep=rep;
    this.stage=new AvatarStage(canvas.parentElement,canvas,{label:rep.defaults?.shell_label||'momo',shape:rep.preset,face:rep.defaults?.face});
    this.stage.setCharacter(rep.adapter==='kin-momo'?'robot':'vita-kin');
    this.stage.dust.visible=false;this.turnTo=0;this.fullLock=false;
    if(rep.preset==='jp01')this.mood=new Mood(canvas);// Vita's mood backdrop, behind the robot
    // JP01 face packs share the JP01 pack's model.
    this.loaded=rep.preset==='jp01'?this.stage.loadJP01(rep.asset||'/packs/jp01/model/jp01.glb'):rep.asset?this.stage.loadClassicAvatar(rep.asset):Promise.resolve(true);
  }
  draw(r,w,h,dt){
    const o=r.out,s=faceShapes(o,false),m=r.act&&MOVES[r.act.name]?sampleMove(r.act.name,r.act.age)?.pose||{}:{};
    const values={...STANCE,spin:r.heading||0,...m,headX:o.pitch*.5,headY:o.yaw*.62,headZ:o.roll*.42,
      lid:(o.lidL+o.lidR)/2,winkL:o.blinkR||0,winkR:o.blinkL||0,gazeX:o.gazeX,gazeY:o.gazeY,
      brow:(o.browL+o.browR)/2,jaw:o.jaw,...Object.fromEntries(['aa','ee','ih','oh','ou'].map(k=>[k,s[k]])),
      smile:o.smile,surprise:r.emotion==='surprised'?1:0,blush:o.blush,tint:r.emotion==='angry'?1:0,
      energy:o.energy,heart:o.heart,squeeze:o.squeeze,stars:o.sparkle,
      faceMood:Math.max(0,FACE_MOODS.indexOf(r.emotion))/(FACE_MOODS.length-1),faceMoodAge:r.t-r.emotionAt,
      faceReaction:r.reaction?(Object.keys(REACTIONS).indexOf(r.reaction.name)+1)/Object.keys(REACTIONS).length:0,
      faceProgress:r.reaction?Math.min(1,r.reaction.age/(REACTIONS[r.reaction.name]?.duration||1)):0,faceEnergy:r.energy};
    if(!r.act&&o.wave>.01){values.handLX=.55;values.handLY=o.wave*.8;values.handLZ=.3;values.palmL=o.wave;}
    this.stage.onTwos=TIMING.onTwos;this.stage.targetTurn=this.turnTo;
    this.stage.portrait=(this.rep.adapter!=='kin-momo'||this.rep.preset==='jp01')&&!this.fullLock&&!(r.act&&MOVES[r.act.name]?.wide);// JP01 opens on its top half
    this.stage.update(values,dt,r.t);
    if(this.mood){const plain=document.body.dataset.bg&&document.body.dataset.bg!=='room',head=(this.stage.tilt||this.stage.head)?.getWorldPosition(this.headAt??=this.stage.camera.position.clone()).project(this.stage.camera);
      this.mood.draw(plain?'none':r.emotion,r.t,w,h,head?(head.x+1)/2*w:w/2,head?(1-head.y)/2*h:h/3);}
  }
}
