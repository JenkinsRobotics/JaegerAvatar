import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
const FINGERS=['Index','Middle','Ring','Little'];
// VRM's bind pose has palms down. Measure flexion in each joint's own bind
// frame rather than assuming left/right Z signs (which break on VRM 0 rigs).
export function bindHands(node){
 const hands={};
 for(const side of ['left','right']){
  const hand=node(side+'Hand');if(!hand)continue;
  hand.updateWorldMatrix(true,true);const joints=[];
  for(const finger of [...FINGERS,'Thumb'])for(const part of ['Metacarpal','Proximal','Intermediate','Distal']){
   if(finger!=='Thumb'&&part==='Metacarpal')continue;
   const bone=node(side+finger+part);if(!bone)continue;
   const origin=bone.getWorldPosition(new THREE.Vector3());
   const child=bone.children.find(c=>c.position.length()>.0001);
   const direction=child?child.getWorldPosition(new THREE.Vector3()).sub(origin):origin.clone().sub(bone.parent.getWorldPosition(new THREE.Vector3()));
   direction.normalize();
   const palm=new THREE.Vector3(0,-1,0),axis=new THREE.Vector3().crossVectors(direction,palm).normalize();
   const inv=bone.getWorldQuaternion(new THREE.Quaternion()).invert();
   axis.applyQuaternion(inv);palm.applyQuaternion(inv);
   joints.push({bone,finger,part,axis,palm,rest:bone.quaternion.clone()});
  }
  hands[side]=joints;
 }
 return hands;
}
export function poseHand(joints,curl,point=0,spread=0){
 if(!joints)return;
 for(const {bone,finger,part,axis,palm,rest} of joints){
  const amount=clamp(finger==='Index'?curl*(1-point):Math.max(curl,point*.85),0,1);
  const max=finger==='Thumb'?{Metacarpal:.3,Proximal:.65,Intermediate:.75,Distal:.8}[part]:{Proximal:1.2,Intermediate:1.45,Distal:.9}[part];
  const bend=new THREE.Quaternion().setFromAxisAngle(axis,amount*max);
  const fan=finger!=='Thumb'&&part==='Proximal'?(FINGERS.indexOf(finger)-1.4)*clamp(spread,0,.15):0;
  bone.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(palm,fan)).multiply(bend);
 }
}
