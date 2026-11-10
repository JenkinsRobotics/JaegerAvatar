import {bindHands,poseHand} from './hands.js';

import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {bindFace,applyFace} from './vrm-face.js';
import {FaceAnimator,drawFace,REACTIONS,FACE_MOODS} from './eyes.js?v=momo-4';
import {WAKE,wakeFace,ringLevels,addRing,FACES} from './jp01.js';import './styles.js';
const clamp=THREE.MathUtils.clamp;
function mesh(geometry,color,roughness=.55,metalness=0){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));}
function rounded(w,h,d,r,color){return mesh(new RoundedBoxGeometry(w,h,d,5,r),color);}
function add(parent,node,x=0,y=0,z=0){node.position.set(x,y,z);parent.add(node);return node;}

// Analytic two-bone solver, independent of VRM; targets and pole are world-space.
export function solveArm(upper,lower,hand,target,pole){
 if(!upper||!lower||!hand)return;
 upper.updateWorldMatrix(true,true);
 const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
 const l1=a.distanceTo(b),l2=b.distanceTo(c),direction=target.clone().sub(a),distance=clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-.001);direction.normalize();
 const side=pole.clone().sub(a).addScaledVector(direction,-pole.clone().sub(a).dot(direction)).normalize();
 const along=(l1*l1+distance*distance-l2*l2)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const elbow=a.clone().addScaledVector(direction,along).addScaledVector(side,height),end=a.clone().addScaledVector(direction,distance);
 function align(bone,from,to){const world=bone.getWorldQuaternion(new THREE.Quaternion());const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta.multiply(world)));bone.updateWorldMatrix(false,true);}
 align(upper,b.clone().sub(a),elbow.clone().sub(a));
 const nb=lower.getWorldPosition(new THREE.Vector3()),nc=hand.getWorldPosition(new THREE.Vector3());align(lower,nc.sub(nb),end.sub(nb));
}

export function plantedFootTarget(rest,v,side){
 const pitch=v['footPitch'+side]||0;
 return rest.clone().add(new THREE.Vector3(v['foot'+side+'X']||0,Math.max(0,v['step'+side]||0)+Math.abs(Math.sin(pitch))*.09,v['foot'+side+'Z']||0));
}
export function pivotOffset(anchor,angle,view=0){
 const turned=anchor.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle);
 return anchor.clone().sub(turned).applyAxisAngle(new THREE.Vector3(0,1,0),view);
}
export function requiredPelvisDrop(hip,foot,length){
 const horizontal=(hip.x-foot.x)**2+(hip.z-foot.z)**2;
 const reach=Math.sqrt(Math.max(0,(length*.985)**2-horizontal));
 return Math.max(0,hip.y-foot.y-reach);
}

export class AvatarStage {
 constructor(container,canvas=null,options={}){
  this.label=options.label||'momo';this.shape=options.shape||'momo';this.faceStyle=options.face;
  this.container=container;this.character='robot';this.onTwos=false;this.turn=0;this.targetTurn=0;this.lastPose=-1;this.frame=0;this.ready=false;this.disposed=false;
  this.renderer=new THREE.WebGLRenderer({canvas:canvas||undefined,antialias:true,alpha:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;container.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Animated companion. Move your pointer to guide its gaze.');
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(24,1,.1,100);this.camera.position.set(0,1.28,6.8);this.camera.lookAt(0,1.07,0);
  this.ambient=new THREE.HemisphereLight(0xffeddf,0x8d6a90,2.3);this.scene.add(this.ambient);
  const key=this.key=new THREE.DirectionalLight(0xffe1c5,3.2);key.position.set(-3,5,5);this.scene.add(key);
  const rim=this.rim=new THREE.DirectionalLight(0xb7d3ff,2.7);rim.position.set(3,2,-3);this.scene.add(rim);
  const fill=this.fill=new THREE.PointLight(0xff9f62,8,5);fill.position.set(-2,.5,1);this.scene.add(fill);
  this.cast=new THREE.Group();this.scene.add(this.cast);
  this.shadow=this.makeShadow();this.scene.add(this.shadow);
  this.robot=this.shape==='jp01'?this.makeJP01():this.makeMomo();this.cast.add(this.robot);
  this.anime=new THREE.Group();this.anime.visible=false;this.cast.add(this.anime);
  this.makeParticles();
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  this.imported={canvas:document.createElement('canvas'),dispose(){}};this.effects=this.makeEffects();this.scene.add(this.effects);this.autoWideUntil=0;this.closeMix=0;
  // The anime model loads only when selected; Momo is ready immediately.
 }
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.frameCamera();}
 makeShadow(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(15,8,20,.55)');g.addColorStop(.6,'rgba(15,8,20,.2)');g.addColorStop(1,'transparent');x.fillStyle=g;x.fillRect(0,0,128,128);const m=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.06;return m;}
 makeParticles(){const points=[];for(let i=0;i<45;i++)points.push(Math.sin(i*127.7)*3,Math.abs(Math.cos(i*93.5))*3.5,-1-Math.abs(Math.sin(i*14)));const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));this.dust=new THREE.Points(g,new THREE.PointsMaterial({color:0xffd6b1,size:.009,transparent:true,opacity:.45}));this.scene.add(this.dust);}
 makeMomo(){
  const root=new THREE.Group();root.position.y=.82;
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf2e6d0,roughness:.38,metalness:0,clearcoat:.35,clearcoatRoughness:.4});
  const shell=new THREE.Mesh(new RoundedBoxGeometry(1.67,1.3,.94,8,.26),ceramic);root.add(shell);
  const back=add(root,rounded(1.58,1.2,.13,.065,0x8d9d90),0,0,-.43);
  const shape=new THREE.Shape(),w=1.43,h=.96,r=.18;
  shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const bezel=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:4,curveSegments:12}),new THREE.MeshPhysicalMaterial({color:0x091416,roughness:.24,metalness:.18,clearcoat:.8}));add(root,bezel,0,.035,.44);
  this.face=document.createElement('canvas');this.face.width=1024;this.face.height=640;this.ctx=this.face.getContext('2d');this.faceTexture=new THREE.CanvasTexture(this.face);this.faceTexture.colorSpace=THREE.SRGBColorSpace;this.faceTexture.minFilter=THREE.LinearMipmapLinearFilter;this.faceTexture.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||1);// mipmaps keep vector faces crisp when the 1024px canvas is shown small
  this.screen=add(root,new THREE.Mesh(new THREE.PlaneGeometry(1.32,.825),new THREE.MeshBasicMaterial({map:this.faceTexture,transparent:true,toneMapped:false,depthWrite:false})),0,.035,.531);
  this.faceAnimator=new FaceAnimator();
  for(const side of [-1,1]){const pivot=add(root,mesh(new THREE.CylinderGeometry(.13,.13,.035,40),0x8b9d91,.4,.2),side*.825,.07,0);pivot.rotation.z=Math.PI/2;const centre=add(root,mesh(new THREE.CylinderGeometry(.065,.065,.041,32),0xe9d8b7,.4),side*.837,.07,0);centre.rotation.z=Math.PI/2;
   add(root,rounded(.31,.095,.5,.045,0x423f3c),side*.47,-.68,0);
  }
  add(root,rounded(.28,.028,.016,.008,0xc5795a),0,-.543,.435);
  for(const x of [-.59,-.53,-.47])add(root,mesh(new THREE.SphereGeometry(.012,12,8),0xa59b87),x,-.542,.414);
  const label=document.createElement('canvas');label.width=256;label.height=64;const ink=label.getContext('2d');ink.fillStyle='#766b58';ink.font='500 26px sans-serif';ink.textAlign='center';ink.fillText([...this.label.slice(0,12)].join(' '),128,41);const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
  add(root,new THREE.Mesh(new THREE.PlaneGeometry(.29,.0725),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false})),.48,-.545,.437);
  return root;
 }
 // Seconds into JP01's wake-up: once when it first appears, and again whenever the Wake up reaction plays.
 wakeAge(v,t){
  this.bootAt??=t;const keys=Object.keys(REACTIONS),key=keys[Math.round((v.faceReaction||0)*keys.length)-1];
  if(key==='wake')return clamp(v.faceProgress||0,0,1)*WAKE;
  return t-this.bootAt<WAKE?Math.max(0,t-this.bootAt):null;
 }
 // JP01: Jenkins Robotics' pan-tilt display head. A blue box with a square screen on a turret neck; the
 // face is Mochi's, laid out larger and closer together for the square display.
 makeJP01(){
  this.fill.color.set(0xb4c8ff);this.ambient.color.set(0xeef2ff);// cool workshop light: the stage's warm fill turns grey metal pink
  const root=new THREE.Group();root.position.y=.82;
  const blue=new THREE.MeshPhysicalMaterial({color:0x4f86bf,roughness:.42,metalness:.05,clearcoat:.3,clearcoatRoughness:.45});
  const steel=(c=0xb9bec4)=>new THREE.MeshStandardMaterial({color:c,roughness:.38,metalness:.55});
  // Turret neck: flange, two drive stages and a collar, rising from the floor (root y=-.82) to the head.
  const flange=add(root,new THREE.Mesh(new THREE.CylinderGeometry(.34,.36,.05,8),steel(0xa9aeb4)),0,-.775,0);flange.rotation.y=Math.PI/8;
  add(root,new THREE.Mesh(new THREE.CylinderGeometry(.24,.27,.08,40),steel()),0,-.71,0);
  for(const [y,r] of [[-.57,.2],[-.42,.205],[-.28,.19]]){add(root,new THREE.Mesh(new THREE.CylinderGeometry(r,r,.13,40),steel()),0,y,0);add(root,new THREE.Mesh(new THREE.TorusGeometry(r+.002,.008,8,40),steel(0x6f757c)),0,y+.066,0).rotation.x=Math.PI/2;}
  add(root,new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.1,40),steel(0x9aa0a7)),0,-.17,0);
  const head=this.pan=this.tilt=add(root,new THREE.Group(),0,-.12,0);// pivot at the top of the neck
  const H=1.0,y0=.62;// head height and centre above the pivot
  add(head,new THREE.Mesh(new RoundedBoxGeometry(1.06,H,1.16,6,.09),blue),0,y0,-.06);
  add(head,new THREE.Mesh(new RoundedBoxGeometry(.98,.16,.9,4,.06),blue),0,y0+H/2+.03,-.2);// raised top rail toward the back
  // Square screen in a dark bezel, with a bolted chin plate below it.
  const S=.8,r=.07,shape=new THREE.Shape();
  shape.moveTo(-S/2+r,-S/2);shape.lineTo(S/2-r,-S/2);shape.quadraticCurveTo(S/2,-S/2,S/2,-S/2+r);shape.lineTo(S/2,S/2-r);shape.quadraticCurveTo(S/2,S/2,S/2-r,S/2);shape.lineTo(-S/2+r,S/2);shape.quadraticCurveTo(-S/2,S/2,-S/2,S/2-r);shape.lineTo(-S/2,-S/2+r);shape.quadraticCurveTo(-S/2,-S/2,-S/2+r,-S/2);
  add(head,new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:4,curveSegments:12}),new THREE.MeshPhysicalMaterial({color:0x091416,roughness:.24,metalness:.18,clearcoat:.8})),0,y0+.07,.5);
  this.face=document.createElement('canvas');this.face.width=this.face.height=1024;this.ctx=this.face.getContext('2d');this.faceTexture=new THREE.CanvasTexture(this.face);this.faceTexture.colorSpace=THREE.SRGBColorSpace;this.faceTexture.minFilter=THREE.LinearMipmapLinearFilter;this.faceTexture.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||1);
  this.faceLayout={scale:1.55,spread:.8};
  this.screen=add(head,new THREE.Mesh(new THREE.PlaneGeometry(.74,.74),new THREE.MeshBasicMaterial({map:this.faceTexture,transparent:true,toneMapped:false,depthWrite:false})),0,y0+.07,.565);
  this.faceAnimator=new FaceAnimator();
  add(head,new THREE.Mesh(new RoundedBoxGeometry(.9,.13,.08,4,.03),blue),0,y0-.42,.5);
  for(const x of [-.3,0,.3]){const bolt=add(head,mesh(new THREE.CylinderGeometry(.022,.022,.02,20),0x4d5560,.4,.6),x,y0-.42,.545);bolt.rotation.x=Math.PI/2;}
  // Side drive hubs: the tilt axis.
  for(const side of [-1,1]){
   const hub=add(head,new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.04,48),blue),side*.535,y0-.02,.04);hub.rotation.z=Math.PI/2;
   const ring=add(head,new THREE.Mesh(new THREE.TorusGeometry(.2,.018,10,48),steel(0x7d8b99)),side*.56,y0-.02,.04);ring.rotation.y=Math.PI/2;
   const cap=add(head,new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.05,40),steel()),side*.56,y0-.02,.04);cap.rotation.z=Math.PI/2;
  }
  this.rings=[-1,1].flatMap(side=>addRing(THREE,head,[side*.592,y0-.02,.04],side,.165,.03));// the two 24-LED side rings
  const label=document.createElement('canvas');label.width=256;label.height=64;const ink=label.getContext('2d');ink.fillStyle='#2c3e52';ink.font='600 30px sans-serif';ink.textAlign='center';ink.fillText([...this.label.slice(0,12)].join(' '),128,43);const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
  add(head,new THREE.Mesh(new THREE.PlaneGeometry(.26,.065),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false})),-.33,y0+H/2-.085,.522);
  const body=this.jp01Body=new THREE.Group();body.add(...root.children);body.scale.setScalar(.84);body.position.y=-.15;root.add(body);// fit flange-to-rail in the robot camera frame
  return root;
 }
 // The real JP01 CAD (Onshape assembly, metres, Y up, facing +Z, floor at 0), prepared offline: hardware and
 // internals removed, head turned to face front. Nodes: Torso, PanPivot > Pan (neck) > TiltPivot > Tilt (head),
 // with Screen (the 64x64 LED panel's centre) and Ring (the NeoPixel hub) marked on the head.
 async loadJP01(url){
  try{
   const gltf=await new GLTFLoader().loadAsync(url),model=gltf.scene,get=n=>model.getObjectByName(n);
   const pan=get('PanPivot'),tilt=get('TiltPivot'),screen=get('Screen'),ring=get('Ring');
   if(!pan||!tilt||!screen||!ring)throw new Error('JP01 model is missing its pivots');
   const k=1.47;model.scale.setScalar(k);model.position.y=-.82;this.jp01Full=true;this.frameCamera();// 1.09 m robot; portrait framing shows its top half
   model.traverse(o=>{if(o.isMesh){const m=o.material;m.color?.multiplyScalar(.62);m.roughness=Math.max(m.roughness??1,.5);m.metalness=Math.min(m.metalness??0,.25);}});// CAD whites and greys otherwise burn out under the stage lights
   // The face: the 160 mm panel (64 LEDs at 2.5 mm), a black backing just in front of the CAD's screen face.
   const S=.16;add(screen,new THREE.Mesh(new THREE.PlaneGeometry(S,S),new THREE.MeshBasicMaterial({color:0x040707})),0,0,.004);
   add(screen,new THREE.Mesh(new THREE.PlaneGeometry(S*.98,S*.98),this.screen.material),0,0,.0045);
   // The 24-LED rings: the CAD's one on its hub, and its twin on the other side (the firmware drives two).
   const r=ring.position,mid=screen.position.x,rings=[[r.x,r.x<mid?-1:1],[2*mid-r.x,r.x<mid?1:-1]].flatMap(([x,side])=>addRing(THREE,tilt,[x+side*.004,r.y,r.z],side,.028,.0055));
   this.robot.add(model);this.jp01Body.visible=false;this.pan=pan;this.tilt=tilt;this.rings=rings;return true;
  }catch(e){console.warn('JP01 model unavailable; keeping the procedural head',e);return false;}
 }

 // Retained source geometry for the earlier Pip study.
 makeRobot(){
  const root=new THREE.Group();root.position.y=.38;
  this.torso=add(root,new THREE.Group(),0,.35,0);
  add(this.torso,rounded(.57,.45,.4,.12,0xe8ba91));
  const medallion=add(this.torso,mesh(new THREE.CylinderGeometry(.115,.115,.025,48),0x8a5140,.25,.5),0,.015,.218);medallion.rotation.x=Math.PI/2;
  const light=add(this.torso,mesh(new THREE.TorusGeometry(.065,.008,8,36),0xffd386,.2,.4),0,.015,.237);light.material.emissive.set(0xffb34d);light.material.emissiveIntensity=.4;
  add(this.torso,rounded(.035,.08,.02,.008,0xfbe1b3),-.025,.015,.245);add(this.torso,rounded(.035,.08,.02,.008,0xfbe1b3),.025,.015,.245);
  for(let i=0;i<3;i++)add(root,mesh(new THREE.TorusGeometry(.09,.012,8,30),0x987058,.25,.6),0,.64+i*.038,0).rotation.x=Math.PI/2;
  this.head=add(root,new THREE.Group(),0,.99,0);
  add(this.head,rounded(1.05,.66,.53,.17,0xf5debd));
  add(this.head,rounded(.94,.55,.12,.14,0x583b3c),0,0,.23);
  add(this.head,rounded(.89,.49,.09,.125,0x211b28),0,0,.3);
  this.face=document.createElement('canvas');this.face.width=1024;this.face.height=512;this.ctx=this.face.getContext('2d');this.faceTexture=new THREE.CanvasTexture(this.face);this.faceTexture.colorSpace=THREE.SRGBColorSpace;
  this.screen=add(this.head,new THREE.Mesh(new THREE.PlaneGeometry(.83,.415),new THREE.MeshBasicMaterial({map:this.faceTexture,transparent:true,toneMapped:false})),0,0,.349);
  for(const sign of [-1,1]){
   const ear=add(this.head,mesh(new THREE.CylinderGeometry(.105,.105,.075,32),0xb47c58,.3,.45),sign*.54,-.015,0);ear.rotation.z=Math.PI/2;
   const inset=add(this.head,mesh(new THREE.CylinderGeometry(.06,.06,.08,32),0x5c4042,.3,.25),sign*.56,-.015,0);inset.rotation.z=Math.PI/2;
   add(this.head,rounded(.03,.1,.012,.009,0xf1b768),sign*.48,-.015,.22);
  }
  const antenna=add(this.head,mesh(new THREE.CylinderGeometry(.015,.015,.16,16),0xb9865c,.25,.5),-.28,.39,0);antenna.rotation.z=.3;
  this.beacon=add(this.head,mesh(new THREE.SphereGeometry(.042,24,16),0xffc071,.25),-.305,.47,0);this.beacon.material.emissive.set(0xff8b3d);this.beacon.material.emissiveIntensity=.5;
  this.robotArms=[];
  for(const s of [-1,1]){
   const upper=add(this.torso,new THREE.Group(),s*.32,.1,0);
   add(upper,mesh(new THREE.SphereGeometry(.075,24,16),0xb88461,.4,.4));
   add(upper,rounded(.095,.2,.11,.04,0xe4b38d),0,-.11,0);
   const lower=add(upper,new THREE.Group(),0,-.22,0);add(lower,mesh(new THREE.SphereGeometry(.055,20,12),0x6f5050));add(lower,rounded(.1,.19,.11,.035,0xf4d7b0),0,-.1,0);
   const hand=add(lower,new THREE.Group(),0,-.2,0);add(hand,rounded(.13,.11,.07,.035,0xf4d7b0));
   for(let f=0;f<3;f++)add(hand,rounded(.027,.075,.04,.013,0xf4d7b0),(f-1)*.037,-.07,0);
   add(hand,rounded(.034,.07,.04,.015,0xf4d7b0),s*.075,-.015,.01).rotation.z=s*.4;
   this.robotArms.push({upper,lower,hand,s,fingers:hand.children.slice(1),length:.42});
  }
  // Three small levitation vanes give Pip a distinctive, mechanical silhouette.
  for(let i=0;i<3;i++){const fin=add(this.torso,rounded(.13,.11,.22,.035,0x85574a),Math.sin(i*2.094)*.18,-.26,Math.cos(i*2.094)*.12);fin.rotation.y=i*2.094;}
  return root;
 }
 drawEyes(v,t){
  const x=this.ctx,w=1024,h=512;x.clearRect(0,0,w,h);
  const color=v.tint>.1?`rgb(255,${Math.round(192-v.tint*65)},107)`:'#ffd08a';
  for(const s of [-1,1]){
   x.save();x.translate(w/2+s*191+v.gazeX*38,h/2-v.gazeY*42);x.rotate(s*(v.tint>.3?-.35:-Math.min(0,v.brow)*.3)+v.headZ*.15);x.fillStyle=color;x.strokeStyle=color;x.lineWidth=36;x.lineCap='round';x.shadowColor=color;x.shadowBlur=25+v.jaw*25;
   const wink=s>0?v.winkL:v.winkR;
   x.scale(1.28,1.28);
   if(wink>.55){x.beginPath();x.moveTo(-65,3);x.quadraticCurveTo(0,28,65,3);x.stroke();}
   else if(v.heart>.55){x.scale(1.08,1.08);x.beginPath();x.moveTo(0,66);x.bezierCurveTo(-155,-25,-55,-120,0,-50);x.bezierCurveTo(55,-120,155,-25,0,66);x.fill();}
   else if(v.squeeze>.45){x.beginPath();x.moveTo(s*50,-38);x.lineTo(-s*35,0);x.lineTo(s*50,38);x.stroke();}
   else if(v.surprise>.4){const radius=v.tint<-.2?48:67;x.lineWidth=23;x.beginPath();x.arc(v.tint<-.2?Math.sin(t*20)*6:0,0,radius,0,Math.PI*2);x.stroke();}
   else if(v.stars>.5){x.beginPath();for(let i=0;i<8;i++){const angle=i*Math.PI/4-Math.PI/2,r=i%2?30:84;x.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);}x.closePath();x.fill();}
   else if(v.smile>.55&&v.lid<.62){x.beginPath();x.moveTo(-65,s>0?5:15);x.quadraticCurveTo(0,s>0?15:-20,65,s>0?5:15);x.stroke();}
   else if(v.smile>.55&&v.lid<.88){x.beginPath();x.moveTo(-69,18);x.quadraticCurveTo(0,-65,69,18);x.stroke();}
   else {const height=Math.max(5,128*v.lid);x.beginPath();x.roundRect(-65,-height/2,130,height,[45,45,40,40]);x.fill();
   }
   x.restore();
  }
  if(v.blush>.1){x.save();x.globalAlpha=v.blush*.65;x.fillStyle='#ff8c89';for(const s of [-1,1])for(let i=0;i<3;i++){x.beginPath();x.ellipse(512+s*330+i*17-17,350,5,14,-.25,0,Math.PI*2);x.fill();}x.restore();}
  // The audio envelope modulates eye glow; Pip has no human mouth.
  this.faceTexture.needsUpdate=true;
 }
 async loadAvatar(url='/models/vita.vrm'){
  try{const result=await this.imported.load(url);this.ready=true;this.loadError=null;this.importedFaceDetailed=['aa','smile','blinkL','blinkR'].every(key=>this.imported.avatar?.m?.binds[key]?.morphs.length>0);this.container.dispatchEvent(new CustomEvent('avatar-ready'));return result;}catch(error){this.loadError=error.message;this.container.dispatchEvent(new CustomEvent('avatar-error',{detail:error.message}));return false;}
 }
 async loadClassicAvatar(url='/models/vita.vrm'){
  const generation=this.loadGeneration=(this.loadGeneration||0)+1;
  try{
   const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync(url);const next=gltf.userData.vrm;if(!next)throw Error('This file does not contain a VRM humanoid.');if(generation!==this.loadGeneration){VRMUtils.deepDispose(next.scene);return false;}
   const previous=this.vrm;this.vrm=next;VRMUtils.removeUnnecessaryVertices(this.vrm.scene);VRMUtils.combineSkeletons(this.vrm.scene);VRMUtils.rotateVRM0(this.vrm);this.anime.add(this.vrm.scene);
   if(previous){previous.scene.removeFromParent();VRMUtils.deepDispose(previous.scene);}
   this.faceBindings=bindFace(this.vrm.scene,gltf.parser);this.bones=this.vrm.humanoid;this.rest=new Map();for(const node of Object.values(this.bones.normalizedHumanBones)){this.rest.set(node.node,node.node.quaternion.clone());}
   this.handBindings=bindHands(n=>this.bones.getNormalizedBoneNode(n));
   const head=this.bones.getNormalizedBoneNode('head');if(head&&url==='/models/avatar.vrm')head.scale.z=.9;
   this.restPositions=new Map();this.anime.updateWorldMatrix(true,true);this.headHeight=head?this.anime.worldToLocal(head.getWorldPosition(new THREE.Vector3())).y:1.5;
   for(const node of Object.values(this.bones.normalizedHumanBones))this.restPositions.set(node.node,node.node.position.clone());
   this.limbs={};for(const [side,s] of [['left',1],['right',-1]]){const upper=this.bones.getNormalizedBoneNode(side+'UpperArm'),lower=this.bones.getNormalizedBoneNode(side+'LowerArm'),hand=this.bones.getNormalizedBoneNode(side+'Hand'),foot=this.bones.getNormalizedBoneNode(side+'Foot');
    if(upper&&lower&&hand){const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3()),thigh=this.bones.getNormalizedBoneNode(side+'UpperLeg'),shin=this.bones.getNormalizedBoneNode(side+'LowerLeg');const legLength=thigh&&shin&&foot?thigh.getWorldPosition(new THREE.Vector3()).distanceTo(shin.getWorldPosition(new THREE.Vector3()))+shin.getWorldPosition(new THREE.Vector3()).distanceTo(foot.getWorldPosition(new THREE.Vector3())):0;this.limbs[side]={upper,lower,hand,s,length:a.distanceTo(b)+b.distanceTo(c),legLength,fingerAxis:this.bones.getNormalizedBoneNode(side+'MiddleProximal')?hand.worldToLocal(this.bones.getNormalizedBoneNode(side+'MiddleProximal').getWorldPosition(new THREE.Vector3())).normalize():new THREE.Vector3(s,0,0),footRest:foot?this.anime.worldToLocal(foot.getWorldPosition(new THREE.Vector3())):null};}}
   for(const name of ['happy','sad','angry','surprised','relaxed']){const expression=this.vrm.expressionManager.getExpression(name);if(expression){expression.overrideBlink='none';expression.overrideMouth='none';}}
   this.vrm.scene.traverse(obj=>{if(!obj.isMesh)return;obj.frustumCulled=false;const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const m of mats){if(m.isMToonMaterial){m.shadingToonyFactor=1;m.outlineWidthFactor=m.name?.includes('HAIR')?.00065:.0015;m.outlineColorFactor?.set(0x332735);m.needsUpdate=true;}
     if(url==='/models/avatar.vrm'&&m.name==='Bottoms_01_CLOTH'){m.map=null;m.color.set(0x829383);if(m.shadeColorFactor)m.shadeColorFactor.set(0x536654);m.shadeMultiplyTexture=null;m.needsUpdate=true;}
     if(m.name?.includes('Brow')){m.depthTest=false;m.depthWrite=false;obj.renderOrder=30;}
    }
    // Decouple the bundled model's smile from its baked-in closed eyes. Blinks remain independent.
    if(url==='/models/avatar.vrm'&&mats.some(m=>/^Eye|FaceEyeline|Face_00_SKIN/.test(m.name))&&obj.geometry.morphTargetsRelative){
     obj.geometry=obj.geometry.clone();const attr=obj.geometry.morphAttributes.position?.[3],normal=obj.geometry.morphAttributes.normal?.[3],position=obj.geometry.attributes.position;
     if(attr){const delta=attr.clone();obj.geometry.morphAttributes.position[3]=delta;const nd=normal?.clone();if(nd)obj.geometry.morphAttributes.normal[3]=nd;
      for(let i=0;i<delta.count;i++){const y=position.getY(i),band=THREE.MathUtils.smoothstep(y,1.408,1.425)*(1-THREE.MathUtils.smoothstep(y,1.466,1.48));const factor=mats.some(m=>m.name==='Face_00_SKIN')?1-.86*band:.14;delta.setXYZ(i,delta.getX(i)*factor,delta.getY(i)*factor,delta.getZ(i)*factor);if(nd)nd.setXYZ(i,nd.getX(i)*factor,nd.getY(i)*factor,nd.getZ(i)*factor);}}
    }
    // Face-only radial normal field, preserving all skinning and morph positions.
    if(url==='/models/avatar.vrm'&&mats.some(m=>m.name==='Face_00_SKIN')&&mats.length===1){obj.geometry=obj.geometry.clone();const pos=obj.geometry.attributes.position,norm=obj.geometry.attributes.normal;if(norm){obj.geometry.computeBoundingBox();const c=obj.geometry.boundingBox.getCenter(new THREE.Vector3());for(let i=0;i<pos.count;i++){const n=new THREE.Vector3(pos.getX(i)-c.x,(pos.getY(i)-c.y)*.8,(pos.getZ(i)-c.z)+.055).normalize();norm.setXYZ(i,n.x,n.y,n.z);}norm.needsUpdate=true;}}
   });this.classicReady=true;this.loadError=null;this.container.dispatchEvent(new CustomEvent('avatar-ready'));return true;
  }catch(error){this.loadError=error.message;console.error(error);this.container.dispatchEvent(new CustomEvent('avatar-error',{detail:error.message}));return false;}
 }
 setCharacter(name){this.classic=name==='vita-kin';this.character=this.classic?'anime':name;this.renderer.domElement.hidden=name!=='robot'&&!this.classic;this.imported.canvas.hidden=name==='robot'||this.classic;this.robot.visible=name==='robot';this.anime.visible=this.classic;this.targetTurn=0;const anime=this.character==='anime';this.portrait=anime;this.frameCamera();this.ambient.intensity=anime?.55:2.3;this.key.intensity=anime?1.05:3.2;this.rim.intensity=anime?.6:2.7;this.fill.intensity=anime?.4:8;this.renderer.toneMappingExposure=anime?1:1.3;}
 frameCamera(){
  if(this.jp01Full&&this.character==='robot'&&this.portrait){// JP01's top half, waist to head, like Vita's portrait view
   const d=Math.max(.62/(Math.tan(this.camera.fov*Math.PI/360)*Math.max(.3,this.camera.aspect)),2.75);
   this.cameraPortrait=this.portrait;this.cameraCharacter=this.character;this.camera.position.set(0,1.18,d);this.camera.lookAt(0,1.13,0);return;}
  const anime=this.character==='anime',focus=(this.headHeight||1.5)-.04;
  const fit=(anime?(this.portrait?.48:.65):(this.portrait?.82:1.03))/(Math.tan(this.camera.fov*Math.PI/360)*Math.max(.3,this.camera.aspect));
  const distance=Math.max(fit,anime?(this.portrait?2.15:5.1):(this.portrait?3.1:4.0));
  this.cameraPortrait=this.portrait;this.cameraCharacter=this.character;
  this.camera.position.set(0,anime?(this.portrait?focus+.06:1.08):1.02,distance);this.camera.lookAt(0,anime?(this.portrait?focus:.86):.82,0);
 }

 makeEffects(){
  const group=new THREE.Group();this.effectSprites=[];
  for(const kind of ['heart','star','surprise','anger']){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.translate(64,64);c.fillStyle=kind==='heart'?'#ff9db9':kind==='anger'?'#fa8c73':'#ffe1a3';c.strokeStyle=c.fillStyle;c.lineWidth=10;c.lineCap='round';
   if(kind==='heart'){c.beginPath();c.moveTo(0,40);c.bezierCurveTo(-95,-15,-32,-70,0,-27);c.bezierCurveTo(32,-70,95,-15,0,40);c.fill();}
   if(kind==='star'){c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?12:48;c.lineTo(Math.sin(a)*r,Math.cos(a)*r);}c.fill();}
   if(kind==='surprise'){c.fillRect(-7,-43,14,55);c.beginPath();c.arc(0,32,8,0,Math.PI*2);c.fill();}
   if(kind==='anger'){for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.beginPath();c.moveTo(6,27);c.lineTo(6,6);c.lineTo(27,6);c.stroke();}}
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   for(let i=0;i<3;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}));sprite.userData={kind,index:i};sprite.renderOrder=40;group.add(sprite);this.effectSprites.push(sprite);}
  }return group;
 }
 updateEffects(v,t){
  const head=this.character==='anime'&&this.vrm?this.bones.getNormalizedBoneNode('head'):this.tilt||this.head;
  const anchor=head?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(0,1.4,0);
  for(const sprite of this.effectSprites){const {kind,index:i}=sprite.userData;const strength=kind==='heart'?v.heart:kind==='star'?v.stars:kind==='surprise'?v.surprise:Math.max(0,v.tint);
   sprite.visible=strength>.3;const phase=(t*.42+i*.31)%1;sprite.material.opacity=clamp(strength,0,1)*Math.sin(phase*Math.PI)*.85;const k=this.shape==='jp01'?.6:1;sprite.position.copy(anchor).add(new THREE.Vector3((i%2?1:-1)*(.28+i*.06)*k,(.15+phase*.28)*k,.18));sprite.scale.setScalar((.09+Math.sin(phase*Math.PI)*.065)*k);// JP01's head is framed closer
  }
 }
 applyArm(limb,v,root){
  const {upper,lower,hand,s,length}=limb,k=s>0?'L':'R';
  root.updateWorldMatrix(true,true);const origin=upper.getWorldPosition(new THREE.Vector3()),q=root.getWorldQuaternion(new THREE.Quaternion());
  const target=new THREE.Vector3(s*v['hand'+k+'X'],v['hand'+k+'Y'],v['hand'+k+'Z']).multiplyScalar(length).applyQuaternion(q).add(origin);
  const pole=new THREE.Vector3(s*.65,-.6,-.18).multiplyScalar(length).applyQuaternion(q).add(origin);
  solveArm(upper,lower,hand,target,pole);
  const open=clamp(v['palm'+k],0,1);
  if(open>0){const desired=new THREE.Quaternion().setFromUnitVectors(limb.fingerAxis||new THREE.Vector3(s,0,0),new THREE.Vector3(s*.18,1,.05).normalize());desired.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),v['palmTurn'+k]||0));desired.premultiply(q);const parent=hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();desired.premultiply(parent);hand.quaternion.slerp(desired,open);}
  hand.rotateZ(v['wrist'+k]*s);hand.rotateX(-.08);
 }
 poseAnime(v,dt,t){
  if(!this.vrm)return;
  for(const [node,q] of this.rest)node.quaternion.copy(q);
  for(const [node,p] of this.restPositions)node.position.copy(p);
  const bone=n=>this.bones.getNormalizedBoneNode(n),rotate=(name,x,y,z)=>{const b=bone(name);if(b)b.rotation.set(x,y,z);};
  // Translate the pelvis inside the rig, leaving each stance foot at its stage-space target.
  const hips=bone('hips');if(hips){hips.position.x+=v.shiftX;hips.position.y-=Math.max(0,v.crouch)*.13;hips.position.z+=v.shiftZ||0;}
  rotate('hips',v.bodyX*.5,v.hipYaw||0,v.hipZ||0);
  rotate('spine',v.bodyX*.3,v.spine+v.bodyYaw*.55,v.bodyZ*.55);
  rotate('chest',v.bodyX*.2,v.spine*.5+v.bodyYaw*.45,v.bodyZ*.45);
  const headX=v.headX-v.bodyX*.25,headY=v.headY-v.bodyYaw*.22,headZ=v.headZ-v.bodyZ*.35-(v.hipZ||0)*.3;
  rotate('neck',headX*.3,headY*.3,headZ*.3);rotate('head',headX*.7,headY*.7,headZ*.7);
  this.anime.updateWorldMatrix(true,true);let drop=0;
  for(const [side,k] of [['left','L'],['right','R']]){const limb=this.limbs[side],thigh=bone(side+'UpperLeg');if(limb?.footRest&&thigh&&limb.legLength){const hip=this.anime.worldToLocal(thigh.getWorldPosition(new THREE.Vector3()));drop=Math.max(drop,requiredPelvisDrop(hip,plantedFootTarget(limb.footRest,v,k),limb.legLength));}}
  if(hips)hips.position.y-=Math.min(.12,drop);
  for(const [side,s] of [['left',1],['right',-1]]){
   const limb=this.limbs[side];if(!limb)continue;const k=s>0?'L':'R';
   rotate(side+'Shoulder',0,0,s*v.shoulders*.15);
   this.applyArm(limb,v,this.anime);
   poseHand(this.handBindings?.[side],v['curl'+k],v['point'+k],v['palm'+k]*.1);
   const foot=bone(side+'Foot'),upper=bone(side+'UpperLeg'),lower=bone(side+'LowerLeg');
   if(foot&&upper&&lower&&limb.footRest){this.anime.updateWorldMatrix(true,true);const target=this.anime.localToWorld(plantedFootTarget(limb.footRest,v,k)),pole=this.anime.localToWorld(new THREE.Vector3(s*.12+v.shiftX*.3,.5,.6+(v.shiftZ||0)));solveArm(upper,lower,foot,target,pole);const desired=this.anime.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(v['footPitch'+k]||0,0,0)));foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));}
  }
  this.facePose=v;const e=this.vrm.expressionManager;
  for(const key of ['happy','sad','angry','relaxed','surprised','blink','blinkLeft','blinkRight','aa','ee','ih','oh','ou','lookLeft','lookRight','lookUp','lookDown'])e.setValue(key,0);
  const mouthActivity=Math.max(v.aa,v.ee,v.ih,v.oh,v.ou),talkDamp=1-mouthActivity*.45;
  if(!this.faceBindings?.detailed){e.setValue('happy',clamp(v.smile,0,1)*.9*talkDamp);e.setValue('sad',clamp(-v.smile,0,1)*(v.tint>.4?.1:1));e.setValue('angry',clamp(v.tint,0,1));e.setValue('surprised',clamp(v.surprise,0,1));
  e.setValue('blinkLeft',clamp(Math.max(1-v.lid,v.winkL,v.squeeze*.85),0,1));e.setValue('blinkRight',clamp(Math.max(1-v.lid,v.winkR,v.squeeze*.85),0,1));
  for(const key of ['aa','ee','ih','oh','ou'])e.setValue(key,this.onTwos?(v[key]>.22?.9:0):clamp(v[key]*1.12,0,1));}
  e.setValue(v.gazeX>0?'lookRight':'lookLeft',Math.abs(v.gazeX)*.7);e.setValue(v.gazeY>0?'lookUp':'lookDown',Math.abs(v.gazeY)*.6);
  this.vrm.update(dt);
 }
 get canvas(){return this.character==='robot'||this.classic?this.renderer.domElement:this.imported.canvas;}
 renderHeld(){if(this.character==='robot'||this.classic)this.renderer.render(this.scene,this.camera);}
 update(v,dt,t){
  this.lastValues=v;this.lastTime=t;
  if(this.character!=='robot'&&!this.classic&&this.imported){this.turn+=(this.targetTurn-this.turn)*(1-Math.exp(-dt*8));this.imported.draw(this.character,v,dt,t,this);this.frame++;return;}
  this.turn+=(this.targetTurn-this.turn)*(1-Math.exp(-dt*8));this.cast.rotation.y=this.turn+(this.character==='robot'?0:v.spin);
  const anchor=this.character==='anime'&&this.limbs?.left?.footRest?this.limbs.left.footRest.clone():new THREE.Vector3(.08,0,0);anchor.y=0;anchor.z+=.08;anchor.multiplyScalar(v.pivot||0);this.cast.position.copy(this.character==='robot'?new THREE.Vector3():pivotOffset(anchor,v.spin,this.turn));
  // Framing is a deliberate user action, never a reaction to a hand or a bounce.
  if(this.cameraPortrait!==this.portrait||this.cameraCharacter!==this.character)this.frameCamera();
  const showPose=!this.onTwos||Math.floor(t*12)!==this.lastPose;
  if(this.character==='robot'){
   this.robot.position.set(0,.82,0);this.robot.rotation.set(0,0,0);
   const wake=this.shape==='jp01'?this.wakeAge(v,t):null,asleep=wake==null?0:1-Math.min(1,wake/WAKE)**2;
   if(this.pan){this.pan.rotation.y=clamp((v.headY||0)*.45,-.45,.45)*(1-asleep);this.tilt.rotation.x=clamp(-(v.headX||0)*.3,-.25,.25)+.28*asleep;}// JP01 pans at the neck and tilts at the hubs (no roll axis); it wakes from a bowed head
   if(this.facePainter){this.ctx.save();try{this.facePainter(this.ctx,v,dt,t);}finally{this.ctx.restore();}}
   else {const face=wakeFace(this.faceAnimator.update(v,dt,t),wake),look=FACES[this.faceStyle];
    const keys=Object.keys(REACTIONS),mood=FACE_MOODS[Math.round(clamp(v.faceMood||0,0,1)*(FACE_MOODS.length-1))],reaction=keys[Math.round((v.faceReaction||0)*keys.length)-1];
    const lit=look?look.paint(this.ctx,face,clamp(v.jaw||0,0,1),{mood,reaction,t,v,layout:this.faceLayout}):drawFace(this.ctx,face,t,this.faceLayout);// JP01 can wear other faces
    if(this.rings){const levels=ringLevels(wake,t,v.jaw),[r,g,b]=lit||look?.ring||[face.red,face.green,face.blue];this.rings.forEach((led,i)=>led.material.color.setRGB(r/255*levels[i%24],g/255*levels[i%24],b/255*levels[i%24]));}}
   this.faceTexture.needsUpdate=true;
  }else if(showPose){this.anime.position.set(0,v.lift,0);this.poseAnime(v,this.onTwos?0:dt,t);this.lastPose=Math.floor(t*12);}
  if(this.character==='anime'&&this.onTwos)this.vrm?.update(dt);
  if(this.character==='anime'&&this.facePose&&this.faceBindings?.detailed)applyFace(this.faceBindings,this.facePose,this.onTwos);
  this.shadow.position.x=this.character==='robot'?0:v.shiftX;this.shadow.scale.setScalar(this.character==='robot'?.75:1-Math.min(.3,Math.max(0,v.lift)*.7));this.shadow.material.opacity=this.character==='robot'?.9:1-Math.min(.5,Math.max(0,v.lift));
  if(this.character==='anime'||this.shape==='jp01')this.updateEffects(v,t);else for(const sprite of this.effectSprites)sprite.visible=false;this.dust.rotation.y=0;this.renderer.render(this.scene,this.camera);this.frame++;
 }
 screenshot(){return this.canvas.toDataURL('image/png');}
 turnaround(){
  if(this.character==='anime'&&!this.classic){
   const c=document.createElement('canvas');c.width=1600;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle='#302735';ctx.fillRect(0,0,1600,640);
   const previous={turn:this.turn,targetTurn:this.targetTurn,portrait:this.portrait,onTwos:this.onTwos};this.portrait=false;this.onTwos=false;
   for(const [i,angle] of [0,.65,Math.PI/2,Math.PI].entries()){
    this.turn=this.targetTurn=angle;this.imported.avatar?.m?.vrm?.springBoneManager?.reset();
    this.update(this.lastValues,0,this.lastTime);const source=this.canvas,h=520,w=h*source.width/source.height;
    ctx.save();ctx.beginPath();ctx.rect(i*400,60,400,520);ctx.clip();ctx.drawImage(source,i*400+(400-w)/2,60,w,h);ctx.restore();
   }
   Object.assign(this,previous);this.update(this.lastValues,0,this.lastTime);return c.toDataURL('image/png');
  }
  const c=document.createElement('canvas');c.width=1600;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle='#302735';ctx.fillRect(0,0,c.width,c.height);const oldAngle=this.cast.rotation.y,oldPortrait=this.portrait;this.portrait=false;this.frameCamera();
  ctx.fillStyle='#f3d7b7';ctx.font='26px Georgia';ctx.fillText(`KIN / ${this.character==='robot'?'Momo — original character':'Vita — VRoid Project / CC0'}`,30,40);
  for(const [i,angle] of [0,.65,Math.PI/2,Math.PI].entries()){
   this.cast.rotation.y=angle;this.renderer.render(this.scene,this.camera);const source=this.renderer.domElement;const h=520,w=h*source.width/source.height;ctx.save();ctx.beginPath();ctx.rect(i*400,60,400,520);ctx.clip();ctx.drawImage(source,i*400+(400-w)/2,60,w,h);ctx.restore();ctx.fillStyle='#bba5b7';ctx.font='13px sans-serif';ctx.fillText(['FRONT','THREE-QUARTER','SIDE','BACK'][i],i*400+25,610);
  }
  this.cast.rotation.y=oldAngle;this.portrait=oldPortrait;this.frameCamera();this.renderer.render(this.scene,this.camera);return c.toDataURL('image/png');
 }
 dispose(){this.resizeObserver.disconnect();this.imported.dispose();this.renderer.dispose();this.disposed=true;}
}
