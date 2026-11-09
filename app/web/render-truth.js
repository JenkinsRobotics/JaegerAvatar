// Truth: a seated, featureless white figure with a wide toothy grin, as a raymarched body for Char3D.
// Fan study for a personal pack (Fullmetal Alchemist; rights not cleared). No eyes or nose: the grin is the face.
// The grin opens with the jaw for lip sync; the head follows yaw, pitch, roll and gaze; the body breathes and leans.
export const TRUTH = `
#define CAM vec3(0,.5,5.4)
#define CAMSHIFT vec2(0,0)
#define FOCAL 3.8
#define FLOOR -.62
#define BOUND 3.
#define ENV_LOW vec3(.34,.34,.36)
#define ENV_HIGH vec3(.96,.96,.98)
#define RIM (vec3(.85,.88,.95)*.55+tint*.2)
const float HR=.5;
vec3 background(vec2 px){
  float v=smoothstep(1.9,.25,length(px*vec2(.85,.7)-vec2(0,.05)));
  float smoke=noise(vec3(px*2.2,time*.07))*.6+noise(vec3(px*5.,time*.11))*.3;
  return mix(vec3(.04),vec3(.97),SAT(v*v+smoke*.25*(1.-v)))+tint*.03;
}
vec3 toBody(vec3 p){ p.y-=lift*.04-crouch*.04; p.xz*=rot(yaw*.12); p.yz*=rot(-lean*.06); return p; }
vec3 toHead(vec3 p){
  p=toBody(p);
  p-=vec3(0,.75,.02);                                  // pivot at the top of the neck
  p.xz*=rot(yaw*.55+gazeX*.25); p.yz*=rot(pitch*.4-gazeY*.15); p.xy*=rot(roll*.4+tilt*.1);
  return p-vec3(0,.42,0);
}
float grinW(){ return .4*(1.+wide*.12+max(smile,0.)*.06); }
// The grin in 2D on the face: a U whose corners climb the cheeks, thickening in the middle as the jaw drops.
float grin(vec2 q,out float c,out float t){
  float W=grinW();
  q.x-=mouthX*.05;
  float x=SAT(abs(q.x)/W);
  c=-.19+(.2+smile*.04)*x*x;
  t=(.085+jaw*.1+round*.03)*sqrt(max(1.-x*x,0.))+.008;
  return max(abs(q.x)-W,abs(q.y-c)-t);
}
float body(vec3 b){
  float br=sin(time*1.4)*.01;
  float d=ell(b-vec3(0,.2+br,0),vec3(.34,.42,.25));                                       // chest
  d=smin(d,ell(b-vec3(0,-.32,-.02),vec3(.34,.28,.28)),.2);                                // hips on the floor
  d=smin(d,cap(b,vec3(0,.5,0),vec3(0,.78,.02),.12),.1);                                   // neck
  d=smin(d,cap(b,vec3(-.18,-.42,.08),vec3(-.42,.12,.55),.15),.08);                        // raised knee
  d=smin(d,cone(b,vec3(-.42,.12,.55),vec3(-.36,-.5,.7),.13,.085),.06);
  d=smin(d,ell(b-vec3(-.34,-.56,.8),vec3(.1,.065,.16)),.06);
  d=smin(d,cap(b,vec3(.18,-.48,.1),vec3(.55,-.5,.5),.15),.08);                            // leg folded across the front
  d=smin(d,cone(b,vec3(.55,-.5,.5),vec3(-.1,-.52,.68),.13,.085),.06);
  d=smin(d,ell(b-vec3(-.18,-.55,.72),vec3(.15,.06,.09)),.05);
  vec3 s=vec3(-.34,.5,0),e=vec3(-.5,.2,.5),w=vec3(-.38,.0,.82);                          // arm draped over the knee
  d=smin(d,cone(b,s,e,.1,.08),.08); d=smin(d,cone(b,e,w,.08,.06),.04); d=smin(d,ell(b-w-vec3(.02,-.08,.03),vec3(.07,.1,.05)),.03);
  s=vec3(.34,.5,0); e=vec3(.58,0.,-.1); w=vec3(.66,-.52,-.05);                            // arm propped on the ground
  d=smin(d,cone(b,s,e,.1,.08),.08); d=smin(d,cone(b,e,w,.08,.065),.04); d=smin(d,ell(b-w-vec3(.04,-.04,.02),vec3(.1,.05,.12)),.03);
  return d;
}
// id: 1 skin 3 mouth 5 teeth
vec2 map(vec3 p0){
  vec3 h=toHead(p0);
  float hd=ell(h,vec3(HR,HR*1.04,HR*.97));
  hd=smin(hd,ell(h-vec3(0,-.2,.08),vec3(.32,.24,.32)),.18);                                // jaw mass
  float c,t,g=grin(h.xy,c,t),front=.05-h.z;
  float cav=max(max(g,front),-(hd+.1));                                                   // a recess .1 deep, front only
  float carved=smax(hd,-cav,.008);
  vec2 res_=vec2(smin(body(toBody(p0)),carved,.08),-cav>hd+.004?3.:1.);
  float band=min((c+t-.09)-h.y,h.y-(c-t+.09));                                            // upper and lower rows
  res_=opU(res_,vec2(max(max(hd+.035,band),max(g+.014,front)),5.));   // inset: a dark rim around the teeth
  return res_;
}
void material(float id,vec3 p,vec3 n,vec3 rd,inout Mat m){
  m.alb=vec3(.9); m.rough=.55; m.sss=.25;
  if(id==3.){ m.alb=vec3(.03); m.sss=0.; m.rough=.9; }
  if(id==5.){
    vec3 h=toHead(p); float c,t; grin(h.xy,c,t);
    float seam=abs(fract((h.x-mouthX*.05)*9.+.5)-.5);
    m.alb=vec3(.97,.96,.93)*mix(.3,1.,smoothstep(.015,.05,seam))*mix(.2,1.,smoothstep(.004,.012,abs(h.y-c)));
    m.rough=.3; m.sss=.1;
  }
}`;
