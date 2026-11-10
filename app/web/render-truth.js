// Truth: a smooth white figure with a huge toothy grin, raymarched for Char3D from the joint skeleton in
// truth-pose.js (kneels by default; leans, sways, claps, stands, sits). Matched to the reference sculpt
// (jaeger_sculpted's card). Fan study for a personal pack (Fullmetal Alchemist; rights not cleared).
// No eyes or nose: the grin is the whole face, so it carries the rig. The upper teeth row stays with the skull
// and the lower row rides the jaw, so speech parts them; corners curl up the cheeks to grin or droop to frown;
// mouthX lifts one corner for a smirk; "oo" narrows and opens the grin, "ee" stretches it.
export { TruthBody } from './truth-pose.js';
export const TRUTH = `
uniform vec3 TJ[19];
#define P0 TJ[0]
#define CH TJ[1]
#define NK TJ[2]
#define CAM (vec3(.06,.95,7.6)+TJ[17])
#define CAMSHIFT vec2(0,-.5)                                                       // looking down a little, like the reference
#define FOCAL 5.
#define FLOOR -1.
#define BOUND 2.2
#define ENV_LOW vec3(.1,.1,.11)                                                         // dim fill, so the form shades like the reference
#define ENV_HIGH vec3(.62,.62,.64)
#define RIM (vec3(.85,.88,.95)*.55+tint*.2)
const float HR=.5;
vec3 background(vec2 px){
  float v=smoothstep(1.6,.1,length(px*vec2(.8,.7)-vec2(0,-.05)));                      // black, as in the reference, with a faint glow behind
  float smoke=noise(vec3(px*2.2,time*.07))*.6+noise(vec3(px*5.,time*.11))*.3;
  return vec3(.004)*v*v*(.7+.3*smoke)+tint*.002;
}
vec3 toBody(vec3 p){ p.y-=FLOOR; p.xz*=rot(yaw*.1); return p; }
// Head space: pivot at the neck joint, turned by the pose (TJ[18]: roll, pitch, yaw) and the rig, centre at the origin.
vec3 toHead(vec3 p){
  p=toBody(p)-NK;
  vec3 a=TJ[18];
  p.xz*=rot(yaw*.5+gazeX*.25+a.z); p.yz*=rot(pitch*.4-gazeY*.15+a.y); p.xy*=rot(roll*.4+tilt*.1+a.x);
  return p-vec3(0,.49,.03);
}
// The grin, in 2D on the face. top/bot: the mouth's outline at this x; tu/tl: heights of the two teeth rows.
float W_(){ return .345*(1.+max(smile,0.)*.12+wide*.14-round*.38+jaw*.04); }
float grin(vec2 q,out float top,out float bot,out float tu,out float tl){
  float W=W_(),x=clamp(q.x/W,-1.,1.),arch=sqrt(max(1.-x*x,0.));
  float x8=x*x*x*x; x8*=x8;
  float c=-.37+(.15+.25*smile-.06*round)*x*x+(.075+.09*smile)*x8+mouthX*.07*x+jaw*.02;   // corners curl up the cheeks or droop; mouthX smirks
  float gap=(jaw*.16+round*.07)*(.3+.7*arch);                                // the jaw drops the lower row
  tu=.13*(.3+.7*arch)*(1.-.25*round); tl=tu*.8;
  top=c+tu+gap*.2; bot=c-tl-gap*.8;
  return max(abs(q.x)-W,max(q.y-top,bot-q.y)*.7);
}
float limb(vec3 b,vec3 a,vec3 c,float ra,float rc){ return cone(b,a,c,ra,rc); }
float body(vec3 b){
  float d=ell(b-P0-vec3(0,-.02,0),vec3(.36,.3,.3));                                       // hips, sat on the floor
  d=smin(d,ell(b-CH,vec3(.28,.31,.25)),.22);                                              // chest and belly
  d=smin(d,limb(b,P0,CH,.3,.25),.14);
  d=smin(d,cap(b,CH,NK+vec3(0,.05,0),.14),.16);                                                         // short neck under the chin
  for(int s=0;s<2;s++){
    vec3 sh=TJ[3+s*4],el=TJ[4+s*4],wr=TJ[5+s*4],hd=TJ[6+s*4],hp=TJ[11+s*3],kn=TJ[12+s*3],an=TJ[13+s*3];
    d=smin(d,ell(b-sh,vec3(.13)),.1);                                                     // round shoulder
    d=smin(d,limb(b,sh,el,.115,.095),.1); d=smin(d,limb(b,el,wr,.095,.075),.05);
    d=smin(d,cone(b,wr,hd,.075,.058),.04); d=smin(d,ell(b-mix(wr,hd,.55),vec3(.095,.065,.095)),.04);   // mitten hand with a palm
    d=smin(d,limb(b,hp,kn,.25,.17),.14); d=smin(d,limb(b,kn,an,.17,.11),.08);
    d=smin(d,cap(b,an+vec3(0,-.02,-.04),an+vec3(0,-.03,.14),.095),.07);                  // foot
  }
  return d;
}
// id: 1 skin 3 mouth 5 teeth
vec2 map(vec3 p0){
  vec3 h=toHead(p0);
  float hd=ell(h,vec3(HR,HR*1.02,HR*.98));
  hd=smin(hd,ell(h-vec3(0,-.2-jaw*.12,.05),vec3(.37,.27,.36)),.16);                         // the jaw: the chin drops as the mouth opens
  float top,bot,tu,tl,g=grin(h.xy,top,bot,tu,tl),front=.04-h.z;
  float cav=max(max(g,front),-(hd+.12));                                                  // the mouth: a recess .12 deep
  float carved=smax(hd,-cav,.012);
  vec2 res_=vec2(smin(body(toBody(p0)),carved,.06),-cav>hd+.004?3.:1.);
  float rows=max(h.y-(top-tu),(bot+tl)-h.y);                                              // upper row hangs, lower row rides the jaw
  float x=h.x/W_(),tooth=x*2.7*(1.+.45*abs(x)),row=h.y>(top-tu+bot+tl)*.5?(h.y-(top-tu))/tu:((bot+tl)-h.y)/tl;
  float bulge=.016*sqrt(SAT(sin(3.1416*fract(tooth))))*sqrt(SAT(sin(3.1416*SAT(1.-row))));   // each tooth rounded
  res_=opU(res_,vec2(max(max(hd+.034-bulge,-rows),max(g+.032,front)),5.));
  return res_;
}
void material(float id,vec3 p,vec3 n,vec3 rd,inout Mat m){
  m.alb=vec3(.42); m.rough=.6; m.sss=.2;                                                  // matte grey-white clay, as in the reference
  if(id==3.){ m.alb=vec3(.02,.015,.015); m.sss=0.; m.rough=.9; }
  if(id==5.){
    vec3 h=toHead(p); float top,bot,tu,tl; grin(h.xy,top,bot,tu,tl);
    float x=h.x/W_(),tooth=x*2.7*(1.+.45*abs(x));                                          // big front teeth, narrower toward the corners
    float seam=.5-abs(fract(tooth)-.5);                                                    // 0 at the gap between teeth
    float gum=min(abs(h.y-(top-tu)),abs(h.y-(bot+tl)));                                   // where each row meets the dark gap
    m.alb=vec3(.62,.61,.6)*mix(.5,1.,smoothstep(.0,.13,seam))*mix(.55,1.,smoothstep(.0,.016,gum));
    m.rough=.3; m.sss=.12;
  }
}`;
