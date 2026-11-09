// Hand-authored procedural study of Mochi's first paired video scene.
// No image/video sampling: scalar controls drive paths and Pong geometry.
export const DURATION=16.708333;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const neutral={left:1,right:1,tilt:0,squeeze:0,wink:0,mouth:0,pong:0};
const keys=[
 [0,{}],[2.6,{}],[3.05,{left:1.13,right:.86,tilt:.12}],
 [3.65,{}],[4.12,{left:.72,right:1.15,tilt:-.19}],
 [4.65,{}],[5.08,{left:.1,right:.1,squeeze:1,mouth:1}],
 [6.5,{left:.1,right:.1,squeeze:1,mouth:.4}],
 [7.08,{left:.1,right:.7,squeeze:.65,wink:1,mouth:.3}],
 [7.65,{}],[8.5,{}],[9.08,{left:1.13,right:.86,tilt:.12}],
 [9.65,{}],[10.12,{left:.72,right:1.15,tilt:-.19}],
 [10.65,{}],[11.08,{left:.1,right:.1,squeeze:1,mouth:1}],
 [12.5,{left:.1,right:.1,squeeze:1,mouth:.4}],
 [13.08,{left:.1,right:.7,squeeze:.65,wink:1,mouth:.3}],
 [13.7,{}],[DURATION,{}]
].map(([t,p])=>[t,{...neutral,...p}]);
export function sampleScene(time,variant='primary'){
 const t=clamp(Number.isFinite(time)?time:0,0,DURATION);
 let i=1;while(i<keys.length-1&&keys[i][0]<t)i++;
 const [a,A]=keys[i-1],[b,B]=keys[i];let u=clamp((t-a)/(b-a));u=u*u*(3-2*u);
 const p=Object.fromEntries(Object.keys(neutral).map(k=>[k,A[k]+(B[k]-A[k])*u]));
 if(variant==='alternate'){
  Object.assign(p,neutral);
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  p.pong=smooth((t-3.4)/1.3)*(1-smooth((t-12)/1.4));
  p.mouth=smooth((t-2.6)/.6)*(1-smooth((t-12.6)/.9));
 }
 return p;
}
function eye(g,x,y,height,tilt){
 g.save();g.translate(x,y);g.rotate(tilt);const w=72,h=104*height;
 g.beginPath();g.moveTo(-w*.34,-h*.5);g.bezierCurveTo(w*.55,-h*.58,w*.55,-h*.36,w*.48,0);
 g.bezierCurveTo(w*.45,h*.55,w*.32,h*.52,0,h*.52);g.bezierCurveTo(-w*.48,h*.52,-w*.48,h*.35,-w*.5,0);
 g.bezierCurveTo(-w*.53,-h*.38,-w*.44,-h*.48,-w*.34,-h*.5);g.fill();g.restore();
}
function arc(g,x,y,w,depth,stroke){g.lineWidth=stroke;g.beginPath();g.moveTo(x-w/2,y);g.quadraticCurveTo(x,y+depth,x+w/2,y);g.stroke();}
export function drawScene(ctx,time,{variant='primary',intensity=1,gazeX=0}={}){
 const p=sampleScene(time,variant);const gain=clamp(intensity,0,1.5),g=ctx;
 g.save();g.clearRect(0,0,g.canvas.width,g.canvas.height);g.fillStyle='#030505';g.fillRect(0,0,g.canvas.width,g.canvas.height);
 const scale=Math.min(g.canvas.width/360,g.canvas.height/234);g.translate((g.canvas.width-360*scale)/2,(g.canvas.height-234*scale)/2);g.scale(scale,scale);
 g.fillStyle=g.strokeStyle='#f4fff8';g.lineCap='round';g.lineJoin='round';
 g.save();g.globalAlpha=1-p.pong;g.translate(clamp(gazeX,-1,1)*12,0);
 for(const [x,h,side] of [[83,p.left,-1],[277,p.right,1]]){
  const shut=clamp(p.squeeze*gain*(side>0?1-p.wink:1));
  if(shut<.98){g.save();g.globalAlpha*=1-shut;eye(g,x,116,1+(h-1)*gain,p.tilt*side*gain);g.restore();}
  if(shut>0){g.save();g.globalAlpha=(1-p.pong)*shut;arc(g,x,146,88,24,12);arc(g,x,126,55,18,5);g.restore();}
 }
 if(p.wink>0){g.save();g.globalAlpha*=p.wink;arc(g,277,66,48,13,6);g.restore();}
 const mouthY=166;
 if(p.mouth<.15)arc(g,180,mouthY,50,23,11);
 else {g.beginPath();g.moveTo(154,mouthY);g.quadraticCurveTo(165,mouthY+10,174,mouthY+2);g.quadraticCurveTo(181,mouthY+14,188,mouthY+1);g.quadraticCurveTo(200,mouthY+8,206,mouthY);g.quadraticCurveTo(195,mouthY+20+12*p.mouth,180,mouthY+20+12*p.mouth);g.quadraticCurveTo(164,mouthY+30,154,mouthY);g.fill();}
 g.restore();
 if(p.pong>0){
  g.save();g.globalAlpha=p.pong;g.lineWidth=2;g.setLineDash([5,7]);g.beginPath();g.moveTo(180,7);g.lineTo(180,227);g.stroke();g.setLineDash([]);
  const t=Math.max(0,time-4.6),phase=(t*.27)%2,bx=phase<1?45+phase*270:315-(phase-1)*270,by=117+Math.sin(t*1.8)*76;
  g.fillRect(39,clamp(117+Math.sin(t*1.4)*70,35,199)-25,12,50);
  g.fillRect(309,clamp(117+Math.sin(t*1.7+1)*70,35,199)-25,12,50);
  g.fillRect(bx-5,by-5,10,10);g.restore();
 }
 g.restore();return p;
}
