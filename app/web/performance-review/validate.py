"""Check that a controlled run really used the common PCM fixture and finite rigs."""
import json, math
from pathlib import Path
root=Path(__file__).resolve().parent
fixture=json.loads((root/'fixtures/speech.json').read_text())
def finite(x):
 if isinstance(x,dict):return all(finite(v) for v in x.values())
 if isinstance(x,list):return all(finite(v) for v in x)
 return not isinstance(x,float) or math.isfinite(x)
for file in sorted((root/'results').glob('*.json')):
 data=json.loads(file.read_text())
 if not isinstance(data,dict) or data.get('kind')!='controlled':continue
 assert not data['error'],(file,data['error'])
 assert len(data['sources'])==3,(file,'wrong source count')
 assert all(abs(s['duration']-fixture['duration'])<.001 for s in data['sources']),(file,'fixture mismatch')
 assert all(finite(f) for f in data['frames']),(file,'non-finite rig')
 if data['character'] in ('vita','anime'):
  assert all(f.get('internalDimensions')==[600,600] for f in data['frames']),(file,'internal pixel-size mismatch')
 assert len(data['frames'])>1000,(file,'insufficient frames')
 print(file.name,'PASS — shared PCM, three sources, finite rig, complete run')
