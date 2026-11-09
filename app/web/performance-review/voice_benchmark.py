"""Sequential local Kokoro API comparison. Run with both render tabs parked.
Uses new sentences on each invocation to avoid KIN's persistent WAV cache.
"""
import base64,io,json,time,urllib.request,wave,uuid
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent
tag=str(int(time.time())%10000)
lines=[f'Take {tag}. Hello there, I am ready to begin.',
       f'Take {tag}. Watch my hand as I wave, and notice how my mouth follows every word.',
       f'Take {tag}. First I will greet the audience with a smile. Then I will turn around, take a small bow, and settle quietly back into my pose.']
rows=[]
for i,line in enumerate(lines):
 for app in (['KIN','Nori'] if i%2==0 else ['Nori','KIN']):
  for repeat in (False,True):
   if app=='KIN': url='http://127.0.0.1:8791/api/voice';body=dict(text=line,character='vita-kin',engine='expressive',speaker='af_heart',emotion='neutral')
   else: url='http://127.0.0.1:8765/say';body=dict(text=line,voice='kokoro:af_heart',speed=1,emotion='neutral')
   t=time.perf_counter()
   with urllib.request.urlopen(urllib.request.Request(url,json.dumps(body).encode(),{'Content-Type':'application/json'}),timeout=120) as r:raw=r.read()
   elapsed=time.perf_counter()-t;meta=json.loads(raw) if app=='KIN' else {};wav=base64.b64decode(meta['audio']) if app=='KIN' else raw
   with wave.open(io.BytesIO(wav)) as f:sr=f.getframerate();duration=f.getnframes()/sr;x=np.frombuffer(f.readframes(f.getnframes()),'<i2').astype(float)/32768
   name=f'{app.lower()}-line{i+1}-{int(repeat)}.wav';(root/'results'/name).write_bytes(wav)
   row=dict(app=app,line=i+1,repeat=repeat,text=line,seconds=elapsed,duration=duration,rtf=elapsed/duration,sr=sr,peak=float(np.max(np.abs(x))),cached=meta.get('cached'),synthMs=meta.get('synthMs'),analysisMs=meta.get('analysisMs'),file=name)
   rows.append(row);print(json.dumps(row),flush=True)
   (root/'results/voice-api.json').write_text(json.dumps(rows,indent=2))
