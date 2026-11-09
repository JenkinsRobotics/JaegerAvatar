"""Summarize browser reports. Positive mouth lag means visible motion trails audio.

This is envelope correlation of measured morph weights, not phoneme accuracy,
speaker-loopback capture, a perceptual quality score, or GPU execution timing.
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
fixture = json.loads((ROOT / 'fixtures/speech.json').read_text())
ft = np.array([f['t'] for f in fixture['frames']])
envelope = np.array([f['rms'] for f in fixture['frames']])

def corr(x, y):
    return float(np.corrcoef(x, y)[0, 1]) if np.std(x) > 1e-6 and np.std(y) > 1e-6 else 0

def summarize(report):
    frames = report['frames']
    rows = [f for f in frames if f['phase'] != 'warmup' and f['dt'] > 0]
    dt = np.array([f['dt'] for f in rows])
    costs = np.array([f['cost'] for f in rows])
    result = dict(app=report['app'], character=report['character'], kind=report['kind'],
                  fps=round(1000/np.mean(dt), 2), frameP95=round(float(np.percentile(dt,95)),2),
                  frameP99=round(float(np.percentile(dt,99)),2), frames=len(rows),
                  over33ms=int(sum(dt>33.5)), over50ms=int(sum(dt>50)),
                  jsP95=round(float(np.percentile(costs,95)),2), sources=len(report['sources']),
                  dimensions=report['summary']['dimensions'], audio=report['audio'])
    speech = [s for s in report['sources'] if s['phase']=='speech']
    result['mouthEnvelope'] = []
    for src in speech:
        # Approximate speaker clock using the browser's reported output latency.
        start=src['when']+src['outputLatency']; rate=src['rate']; end=start+src['duration']/rate
        fs=[f for f in frames if start+.25 < f['clock'] < end-.25 and f['phase']=='speech']
        if not fs: continue
        t=np.array([(f['clock']-start)*rate for f in fs])
        y=np.array([sum(f['mouth']) for f in fs])
        lags=np.arange(-.25,.351,.005)
        cs=[corr(y,np.interp(t-lag*rate,ft,envelope)) for lag in lags]
        best=int(np.argmax(cs))
        result['mouthEnvelope'].append(dict(lagMs=round(float(lags[best]*1000)),correlation=round(cs[best],3),
                                            amplitudeP95=round(float(np.percentile(y,95)),3)))
    result['phraseGapsMs']=[round((b['when']-a['when']-a['duration']/a['rate'])*1000,1) for a,b in zip(speech,speech[1:])]
    gestures=[e for e in report['events'] if e['type'] in ('gesture','small-gesture','reaction') and e['phase']=='speech']
    result['gestureVsAudioStartMs']=[dict(name=g['name'],ms=round((g['clock']-s['when']-s['outputLatency'])*1000,1)) for g,s in zip(gestures,speech)]
    for source in speech[:1]:
        request=next(e for e in report['events'] if e['type']=='speech-request')
        result['cachedCommandToAudioMs']=round((source['when']+source['outputLatency']-request['clock'])*1000,1)
    stops=[e for e in report['events'] if e['type']=='stop-command']
    if stops:
        stop=stops[-1]
        call=next((e for e in report['events'] if e['type']=='audio-stop-call' and e['ms']>=stop['ms']),None)
        result['stopCallMs']=round(call['ms']-stop['ms'],2) if call else None
        after=[f for f in frames if stop['ms']<=f['ms']<=stop['ms']+1000]
        quiet=next((f for f in after if f['ms']>stop['ms'] and sum(f['mouth'])<.05),None)
        result['mouthBelow005AfterStopMs']=round(quiet['ms']-stop['ms'],1) if quiet else None
    moves={}
    for phase in dict.fromkeys(f['phase'] for f in rows if f['phase'].startswith('move:')):
        fs=[f for f in rows if f['phase']==phase]; cams=np.array([f['camera'] for f in fs if f.get('camera')])
        roots=np.array([f['root'] for f in fs if f.get('root') is not None])
        qs=np.array([f['rightArm'] for f in fs if f.get('rightArm')])
        steps=np.degrees(2*np.arccos(np.clip(np.abs(np.sum(qs[:-1]*qs[1:],axis=1)),0,1))) if len(qs)>1 else []
        moves[phase[5:]]=dict(cameraRange=float(np.max(np.ptp(cams,axis=0))) if len(cams) else None,
                            rootRotationRange=float(np.ptp(roots)) if len(roots) else None,
                            maxArmStepDeg=float(np.max(steps)) if len(steps) else None)
    result['moves']=moves
    return result

if __name__ == '__main__':
    out=[]
    for file in sorted((ROOT/'results').glob('*.json')):
        data=json.loads(file.read_text())
        if 'frames' not in data:continue
        s=summarize(data);s['file']=file.name;out.append(s)
    (ROOT/'results/summary.json').write_text(json.dumps(out,indent=2))
    print(json.dumps(out,indent=2))
