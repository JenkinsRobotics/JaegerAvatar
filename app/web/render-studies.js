// App-owned vector fan studies. No downloaded artwork or executable pack code.
// Every study consumes the existing Rig pose, including audio-driven mouth values.
export const STUDIES={
 anakin_skywalker:{kind:'human',hair:'#77503b',skin:'#e6bc9e',coat:'#392c29',eye:'#83bcdb',cut:'swept',scar:true},
 eren_yeager:{kind:'human',hair:'#342d2c',skin:'#deb59d',coat:'#61704b',eye:'#70b8a2',cut:'curtain'},
 kamina:{kind:'human',hair:'#274e9a',skin:'#dba580',coat:'#b62d37',eye:'#eca843',cut:'spike',glasses:true},
 lelouch:{kind:'human',hair:'#252135',skin:'#f0d4bd',coat:'#332947',eye:'#a987df',cut:'fringe',gold:true},
 simon:{kind:'human',hair:'#253957',skin:'#eac4a2',coat:'#263f6a',eye:'#4ea3d4',cut:'spike',goggles:true},
 paul_atreides:{kind:'human',hair:'#302a27',skin:'#d7b59c',coat:'#555451',eye:'#439fe9',cut:'curl',hood:true},
 bender:{kind:'bender',metal:'#99acb7',accent:'#fff3ab'},
 glados:{kind:'glados',metal:'#e1e4d8',accent:'#ffc950'},
 hal_9000:{kind:'hal',metal:'#35393e',accent:'#ff472c'},
 tars:{kind:'tars',metal:'#818b91',accent:'#b6dfcf'},
 jarvis:{kind:'jarvis',metal:'#182e3b',accent:'#62e3ff'},
 helldiver:{kind:'helmet',metal:'#3c454b',accent:'#e8cc55'},
 daft_punk_1:{kind:'gold',metal:'#d8ac50',accent:'#ffb75e'},
 daft_punk_2:{kind:'silver',metal:'#b7c6d3',accent:'#63d9ff'},
 eve:{kind:'eve',metal:'#eef4ed',accent:'#55c7ff'},
 patric:{kind:'star',metal:'#e9a1ab',accent:'#b9d779'},
};
const bounded=(v,min,max,fallback=0)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:fallback));
export class StudyCharacter {
 constructor(canvas,preset){if(!STUDIES[preset])throw new Error('Unknown study: '+preset);this.c=canvas;this.g=canvas.getContext('2d');this.p=STUDIES[preset];}
 draw(rig,W,H){
  const g=this.g,p=this.p,o=rig.out,t=rig.t||0,k=Math.min(W/400,H/460);
  const jaw=bounded(o.jaw,0,1),smile=bounded(o.smile,-1,1),gx=bounded(o.gazeX,-1,1)*7,gy=bounded(o.gazeY,-1,1)*5;
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.save();g.translate(W/2,H/2);g.scale(k,k);
  g.lineWidth=3;g.lineJoin='round';g.lineCap='round';
  const shape=(pts,fill,stroke='#17202a')=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}};
  const box=(x,y,w,h,r,fill,stroke='#17202a')=>{g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}};
  const oval=(x,y,rx,ry,fill,stroke)=>{g.beginPath();g.ellipse(x,y,Math.max(.2,rx),Math.max(.2,ry),0,0,Math.PI*2);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}};
  const line=(points,color,width=3)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.stroke();g.lineWidth=3;};
  const eyes=(y=-45,space=38,color=p.accent||p.eye,robot=false)=>{
   for(const [x,lid,brow] of [[-space,o.lidL,o.browL],[space,o.lidR,o.browR]]){
    const h=bounded(lid,0,1.4,1)*18;
    g.save();g.beginPath();g.ellipse(x,y,robot?23:21,Math.max(1,h),0,0,Math.PI*2);g.clip();
    oval(x,y,24,24,robot?color:'#fff4e6');oval(x+gx,y+gy,robot?6:9,14,robot?'#153647':color);oval(x+gx,y+gy,3.5,10,'#101722');oval(x+gx-3,y+gy-5,2.5,3,'white');g.restore();
    line([[x-22,y-h-9-bounded(brow,-1,1)*8],[x+18,y-h-8]],p.hair||'#26343d',4);
   }
  };
  const mouth=(y=23,color='#482a35')=>{if(jaw>.07)oval(0,y,12+bounded(o.wide,0,1)*9,3+jaw*18,color);else {g.beginPath();g.moveTo(-17,y);g.quadraticCurveTo(0,y+smile*15,17,y);g.strokeStyle=color;g.stroke();}};
  // Body stays anchored; only the head pivots gently in response to the rig.
  if(p.kind==='human'){
   shape([[-114,190],[-101,101],[-38,65],[38,65],[101,101],[114,190]],p.coat);
   shape([[-35,69],[0,121],[35,69],[16,166],[-14,166]],p.gold?'#d9bb67':'#92847c');
   box(-19,43,38,48,9,p.skin);g.save();g.translate(bounded(o.yaw,-1,1)*7,-bounded(o.pitch,-1,1)*5);g.rotate(bounded(o.roll,-1,1)*.12);
   oval(0,-45,82,104,p.hair);oval(-66,-22,12,21,p.skin);oval(66,-22,12,21,p.skin);
   shape([[-64,-97],[-68,-28],[-48,29],[0,58],[48,29],[68,-28],[64,-97]],p.skin);
   eyes();mouth();line([[1,-28],[-4,-4],[4,-2]],'#ad806b',2);
   let fringe;
   if(p.cut==='spike')fringe=[[-78,-35],[-100,-100],[-60,-92],[-50,-153],[-15,-120],[18,-166],[35,-117],[82,-133],[70,-76],[45,-93],[18,-64],[-10,-99],[-45,-61]];
   else if(p.cut==='curtain')fringe=[[-76,0],[-82,-110],[-28,-146],[30,-141],[79,-99],[74,8],[53,-61],[12,-106],[-5,-115],[-22,-71],[-51,-53]];
   else if(p.cut==='fringe')fringe=[[-76,-4],[-80,-112],[-24,-149],[50,-133],[84,-79],[60,-9],[39,-67],[18,-36],[7,-96],[-25,-45],[-38,-83],[-61,-28]];
   else fringe=[[-76,6],[-85,-103],[-41,-146],[32,-142],[84,-106],[72,-24],[49,-79],[23,-104],[-3,-67],[-32,-76],[-55,-19]];
   shape(fringe,p.hair);
   if(p.cut==='curl')for(let i=0;i<7;i++)oval(-63+i*21,-113-Math.sin(i/6*Math.PI)*22,17,19,p.hair);
   if(p.scar)line([[39,-72],[34,-33]],'#9b695b',2);
   if(p.glasses){shape([[-70,-66],[-4,-57],[-27,-29]],'#e64c39');shape([[70,-66],[4,-57],[27,-29]],'#e64c39');line([[-4,-57],[4,-57]],'#e64c39',5);}
   if(p.goggles){box(-64,-122,128,28,10,'#ba8c43');oval(-34,-108,24,20,'#80bcc6','#30343c');oval(34,-108,24,20,'#80bcc6','#30343c');}
   if(p.hood){line([[-90,6],[-87,-125],[0,-165],[88,-125],[90,6]],'#6e6d62',14);}
   g.restore();
  }else if(p.kind==='hal'){
   box(-92,-169,184,340,8,p.metal);box(-78,-152,156,30,2,'#13171d');
   g.fillStyle='#dce3e7';g.font='15px monospace';g.textAlign='center';g.fillText('HAL 9000',0,-131);
   oval(0,-44,66,66,'#a4a9ae');oval(0,-44,56,56,'#111');oval(gx,-44+gy,36+jaw*7,36+jaw*7,'#701609');oval(gx,-44+gy,19,19,p.accent);oval(gx-6,-52+gy,6,6,'#ffe9af');
   for(let y=45;y<151;y+=6)line([[-64,y],[64,y]],'#14191f',2);
  }else if(p.kind==='tars'){
   for(let i=0;i<4;i++){box(-102+i*51,-154,47,320,2,i%2?p.metal:'#a0a8ab');for(let y=5;y<150;y+=18)line([[-98+i*51,y],[-63+i*51,y]],'#626c74',1);}
   box(-45,-125,88,72,2,'#142629');for(let i=0;i<6;i++)line([[-34,-113+i*9],[20+Math.sin(i+t)*10,-113+i*9]],p.accent,2);
   line([[-33,-63],[-12,-63-jaw*18],[3,-63+jaw*9],[34,-63]],p.accent,2);
  }else if(p.kind==='jarvis'){
   for(let i=0;i<5;i++){g.beginPath();g.arc(0,-15,45+i*24,t*.08*(i%2?1:-1)+i,t*.08*(i%2?1:-1)+i+4.7);g.strokeStyle=i%2?'#29576b':p.accent;g.lineWidth=i===2?7:2;g.stroke();}g.lineWidth=3;
   for(let i=0;i<24;i++){const a=i*Math.PI/12;line([[Math.cos(a)*43,Math.sin(a)*43-15],[Math.cos(a)*(50+jaw*35),Math.sin(a)*(50+jaw*35)-15]],p.accent,2);}oval(gx,gy-15,12,12,'#defcff');
  }else if(p.kind==='glados'){
   line([[0,-220],[0,-135],[-38,-91]],'#667079',12);shape([[-114,-80],[-34,-126],[88,-94],[109,-20],[53,30],[-56,22]],p.metal);
   box(-51,-85,111,81,29,'#222a30');oval(12+gx,-44+gy,27+jaw*5,27+jaw*5,p.accent);oval(12+gx,-44+gy,11,11,'#fff2b3');
   line([[-85,-56],[-70,3]],'#7f898f',6);
  }else if(p.kind==='star'){
   shape([[0,-172],[48,-56],[134,-31],[68,27],[83,164],[0,116],[-83,164],[-68,27],[-134,-31],[-48,-56]],p.metal);
   shape([[-67,61],[67,61],[78,142],[0,114],[-78,142]],p.accent);for(const x of [-42,34]){oval(x,95,15,10,'#9d6eae');oval(x+8,105,8,15,'#9d6eae');}
   eyes(-46,24,'#161e29');mouth(8);oval(0,42,3,3,'#9a6575');
  }else if(p.kind==='eve'){
   oval(0,83,67,104,p.metal);oval(-90,58,18,63,p.metal);oval(90,58,18,63,p.metal);
   oval(0,-77,91,76,p.metal);box(-73,-114,146,75,34,'#102130');eyes(-79,36,p.accent,true);oval(0,57,12+jaw*7,12+jaw*7,'#b5d6b7');
  }else{
   const b=p.kind==='bender',gold=p.kind==='gold',silver=p.kind==='silver';
   box(-100,81,200,111,30,p.metal);box(-25,48,50,44,9,'#66737d');
   if(b){box(-73,-133,146,196,36,p.metal);line([[0,-133],[0,-172]],p.metal,8);oval(0,-177,9,9,p.metal);box(-83,-79,166,58,23,'#26333c');eyes(-50,36,p.accent,true);
    box(-55,0,110,38+jaw*17,10,'#eee6bf');for(let x=-35;x<55;x+=22)line([[x,1],[x,36+jaw*17]],'#394149',2);line([[-53,20],[53,20]],'#394149',2);
   }else{
    box(-88,-140,176,198,gold?65:42,p.metal);box(-74,-98,148,89,gold?35:20,'#111e29');
    if(gold){for(let i=0;i<11;i++)line([[-57+i*11,-46-jaw*20*Math.sin(i+t)**2],[-57+i*11,-27]],p.accent,4);}
    else if(silver){line([[-65,-68],[-36,-79],[35,-79],[65,-68]],p.accent,3);line([[-61,-43],[61,-43]],'#415d70',2);}
    else {shape([[-69,-75],[69,-75],[45,-39],[-45,-39]],'#c0a84a');line([[0,-135],[0,-105]],p.accent,13);box(-31,-7,62,45,8,'#253037');}
    for(let i=0;i<5;i++)line([[-37+i*18,19],[-37+i*18,34+jaw*9]],'#3a4650',3);
   }
  }
  g.restore();
 }
 suspend(){}
}
