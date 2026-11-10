"""Generate original, deterministic Foley/synth performance tracks (requires numpy)."""
from pathlib import Path
import json, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'avatar-packs/mochi/assets/performance-audio'
RATE=24000
rng=np.random.default_rng(701)

def sound(kind,duration,f0=360,f1=None):
    t=np.arange(round(duration*RATE))/RATE; u=t/max(duration,.001)
    f1=f0 if f1 is None else f1
    hz=f0+(f1-f0)*(u*u*(3-2*u))
    phase=2*np.pi*np.cumsum(hz)/RATE
    noise=rng.normal(0,1,len(t));noise=np.convolve(noise,np.ones(7)/7,mode='same')
    env=np.minimum(1,t/.018)*np.minimum(1,(duration-t)/.04)
    if kind=='kiss':
        # Breath drawn through pursed lips, then a short resonant lip release.
        env*=np.exp(-u*3)
        y=.34*noise+.5*np.sin(phase)*np.exp(-u*7)+.15*np.sin(phase*2.07)
    elif kind in ('breath','snore','yawn','huff'):
        env*=np.sin(np.pi*u)**.7
        y=.25*noise+sum(np.sin(phase*k)/k for k in range(1,8))*.16
        if kind=='snore':y*=.65+.35*np.sin(2*np.pi*19*t)
    elif kind=='rev':
        env*=.75+.25*np.sin(np.pi*u)
        y=sum(np.sin(phase*k)/k for k in range(1,9))*.18+.09*noise
    elif kind=='whoosh':
        env*=np.sin(np.pi*u)**2;y=.9*noise+.15*np.sin(phase)
    else:
        env*=np.exp(-u*4);y=.6*np.sin(phase)+.2*np.sin(phase*2.01)
    return y*env

def write(name,duration,events):
    mix=np.zeros(round(duration*RATE))
    for at,kind,length,f0,f1,gain in events:
        y=sound(kind,length,f0,f1)*gain; start=round(at*RATE);count=min(len(y),len(mix)-start)
        if count>0:mix[start:start+count]+=y[:count]
    peak=max(.001,float(np.max(np.abs(mix))))
    if peak>.8:mix*=.8/peak
    with wave.open(str(OUT/(name+'.wav')),'wb') as wav:
        wav.setparams((1,2,RATE,0,'NONE','not compressed'));wav.writeframes((np.clip(mix,-.9,.9)*32767).astype('<i2').tobytes())
    return {'file':name+'.wav','duration_ms':round(duration*1000),'events':[{'at_ms':round(e[0]*1000),'kind':e[1]} for e in events]}

OUT.mkdir(parents=True,exist_ok=True)
E=lambda at,kind='pop',length=.18,f0=500,f1=300,gain=1:(at,kind,length,f0,f1,gain)
tracks={
 'squint_wink':[E(.7,'whoosh',.25),E(2.2,'pop',.13,900,1250),E(5.8,'pop',.13,700,1100),E(10,'pop',.15,900,1200),E(14,'pop',.13,700,1100)],
 'pong':[E(.5,'whoosh',.4)]+[E(t,'pop',.08,640 if i%2 else 400,500,.7) for i,t in enumerate([2,2.7,3.4,4.2,4.9,5.6,6.4,7.1,7.8,8.6,9.3,10,10.8,11.5,12.2,13])],
 'sleep_bubble':[E(t,'snore',1.35,115,85,.9) for t in [2.4,4.3,10.7,12.6]]+[E(6.6,'pop',.14,700,170),E(14.9,'pop',.14,700,170)],
 'tongue':[E(t,'kiss',.32,460,190) for t in [1.2,4.6,8,11.4,14.8]],
 'anger':[E(t,'huff',.65,150,100,1.3) for t in [1.3,4.5,7.7,10.9,14.1]],
 'speedometer':[E(.4,'whoosh',.65),E(1.25,'pop',.18,600,250),E(3,'rev',.65,70,100,.8),E(95/24,'rev',77/24,85,480),E(172/24,'whoosh',.4,850,100),E(9.6,'whoosh',.5,300,100)],
 'scare':[E(t,'yawn',.32,270,650,1.1) for t in [1.5,5.5,9.5,13.5]],
 'tired':[E(t,'breath',1.2,190,120,.8) for t in [2,6,10,14]],
 'hearts_kiss':sum(([E((14+i*96+4)/24,'pop',.25,750,1100,.6),E((14+i*96+33)/24,'kiss',.4,650,130,1.4)] for i in range(4)),[]),
 'yawn':[E((73+i*151+5)/24,'breath',1.35,160,200,.7) for i in range(2)]+[E((73+i*151+63)/24,'yawn',1.4,220,130,1.2) for i in range(2)]
}
manifest={'schema':'mochi-performance-audio/v1','author':'Jenkins Robotics','license':'Apache-2.0','provenance':'Original deterministic procedural Foley/synth; no sampled commercial audio or cloned voices.','clips':{n:write(n,16709/1000,events) for n,events in tracks.items()},'reactions':{},'emotions':{}}
for name,kind,f0,f1 in [('heart','kiss',650,150),('wink','pop',800,1200),('wake','pop',450,900),('doze','breath',160,90),('sparkle','pop',1100,1500)]:
 manifest['reactions'][name]=write('reaction_'+name,.65,[E(0,kind,.45,f0,f1)])
for name,kind,f0,f1 in [('joy','pop',520,850),('excited','pop',650,1300),('love','kiss',650,150),('sad','breath',200,100),('angry','huff',160,90),('surprised','yawn',220,600),('scared','yawn',260,700),('sleepy','breath',170,100),('laughing','yawn',400,600),('confused','pop',600,400)]:
 manifest['emotions'][name]=write('emotion_'+name,.8,[E(0,kind,.6,f0,f1)])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(OUT)
