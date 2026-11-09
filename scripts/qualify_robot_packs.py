"""Offline consumer qualification: imports Mochi's real dispatcher; no robot/bus connection."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.deploy import verify
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--bundle',type=Path,required=True);p.add_argument('--mochi',type=Path,required=True)
p.add_argument('--animation',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
verify(a.bundle)
sys.path[:0]=[str(a.mochi.resolve()),str(a.animation.resolve())]
from modules import jaeger_animation as consumer
class Capture:
    def publish(self,event):self.event=event
rows=[]
for manifest in sorted((a.bundle/'mochi-character-v1').glob('*/character.yaml')):
    row={'pack':manifest.parent.name,'checks':[]};renderer=consumer.OfflineRenderer(128,128)
    try:
        character=consumer.load_path(manifest.parent)
        for expression,spec in character.expressions.items():
            mouths=list(spec['clips']) if isinstance(spec.get('clips'),dict) else list(character.mouth_states) or [character.default_mouth]
            for mouth in mouths:
                item={'expression':expression,'mouth':mouth}
                try:
                    bus=Capture();consumer.play(bus,character,expression,mouth)
                    event=bus.event
                    frames=[renderer.frame(event.asset_path,t,adapter=event.adapter,params=event.params) for t in (0,500)]
                    item['passed']=all(f is not None and len(f)==128*128*4 for f in frames)
                    item['frame_sha256']=[hashlib.sha256(f).hexdigest() if f else None for f in frames]
                except Exception as e:item.update(passed=False,error=str(e))
                row['checks'].append(item)
        row['passed']=bool(row['checks']) and all(c['passed'] for c in row['checks'])
    except Exception as e:row.update(passed=False,error=str(e))
    finally:renderer.close()
    rows.append(row)
report={'method':'Actual Mochi loader/dispatcher and JaegerAnimation OfflineRenderer, 128x128 RGBA, at 0 and 500 ms. Capture bus only; no network/hardware commands.',
        'mochi':str(a.mochi.resolve()),'animation':str(a.animation.resolve()),'hardware_verified':False,'rows':rows}
verify(a.bundle)
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n')
print(f"{sum(r['passed'] for r in rows)}/{len(rows)} representation exports passed offline rendering")
for r in rows:
    if not r['passed']:print(r['pack'],r.get('error') or [x for x in r['checks'] if not x['passed']][:1])

if not all(r["passed"] for r in rows):raise SystemExit(1)
