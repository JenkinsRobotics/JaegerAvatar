"""Assemble a named Mochi demonstration with portable prerecorded playback."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import sys
from urllib.parse import quote
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.deploy import build,verify,digest
from jaeger_avatar.packs import load_pack
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
build(ROOT/'avatar-packs',a.output,avatars=['mochi','momo'])
pack=load_pack(ROOT/'avatar-packs/mochi')
def page(prefix):
    variants=[]
    for key in ['classic','mochi']:
        rep=pack['representations'][key]
        clips=[{'name':f"Scene {i+1} · {state}",'src':prefix+quote(rep['root']+'/'+ref,safe='/')} for i,spec in enumerate(rep['presentation']['expressions'].values()) for state,ref in spec['clips'].items()]
        variants.append({'name':rep['name'],'clips':clips})
    portrait=prefix+'sources/jaeger_ai/card.png'
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mochi · animation demonstrations</title>
<style>body{font:16px/1.6 system-ui;background:#f5f0e7;color:#28232e;margin:0}main{max-width:960px;margin:40px auto;padding:24px}h1{font-size:40px;line-height:1.1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:white;border:1px solid #ddd2c8;border-radius:16px;padding:22px}video{width:100%;aspect-ratio:3/2;background:#111;border-radius:10px}select,button,a.button{font:inherit;padding:9px;border-radius:8px;margin:4px 0;border:1px solid #bba8bd}button,a.button{background:#614568;color:white;cursor:pointer}a{color:#614568}small{display:block;color:#675f6a}img{max-width:160px;max-height:180px;object-fit:contain}</style><style>'''+(ROOT/'app/web/theme.css').read_text()+'''</style>
<body class="demo-page"><main><p>JAEGER AVATAR · MOCHI DEMO FAMILY</p><h1>One character. Different ways to animate.</h1><p>Classic and Enhanced use prerecorded scenes. Play each version and compare the same scene. These clips are not live lip sync.</p><section class="grid" id="clips"></section>
<section class="grid" style="margin-top:20px"><article><h2>Mochi Live</h2><p>Procedural eyes and mouth. Switch between smooth face, eyes-only and pixel modes in the live app.</p><a class="button" href="http://127.0.0.1:8790/?face=mochi">Open live demo</a><small>Requires the Jaeger Avatar app running on this computer. No live renderer is bundled in this folder.</small></article><article><h2>Momo Shell</h2><p>Momo remains a separate companion: a fixed 3D shell with a live animated face.</p><a class="button" href="http://127.0.0.1:8790/?face=momo">Open shell demo</a><small>Requires the Jaeger Avatar browser renderer.</small></article><article><h2>Mochi Portrait</h2><img alt="Mochi portrait" src="'''+portrait+'''"><p>Static artwork reference. Not an animation demo.</p></article></section><p>Robot qualification: prerecorded variants passed local consumer rendering. Hardware playback and legacy motion scripts are not yet qualified.</p></main>
<script>
const variants='''+json.dumps(variants).replace('<','\\u003c')+''';
for(const v of variants){const card=document.createElement('article');const title=document.createElement('h2');title.textContent=v.name;const video=document.createElement('video');video.controls=true;video.playsInline=true;video.muted=true;video.loop=true;video.preload='metadata';const select=document.createElement('select');select.setAttribute('aria-label',v.name+' scene');for(const c of v.clips){const o=document.createElement('option');o.textContent=c.name;o.value=c.src;select.append(o);}video.src=select.value;const button=document.createElement('button');button.textContent='Play scene';const status=document.createElement('small');status.textContent='Ready · prerecorded animation';select.onchange=()=>{video.pause();video.src=select.value;button.textContent='Play scene';status.textContent='Ready · '+select.selectedOptions[0].textContent;};button.onclick=()=>{if(video.paused)video.play().catch(e=>status.textContent=e.message);else video.pause();};video.onplaying=()=>{button.textContent='Pause scene';status.textContent='Playing · '+select.selectedOptions[0].textContent;};video.onpause=()=>button.textContent='Play scene';video.onerror=()=>status.textContent='Clip could not load';card.append(title,video,select,button,status);document.querySelector('#clips').append(card);}
</script></html>'''
(a.output/'index.html').write_text(page('avatar-v1/mochi/'))
(ROOT/'app/web/mochi-demo.html').write_text(page('/packs/mochi/'))
checks={str(f.relative_to(a.output)):digest(f) for f in sorted(a.output.rglob('*')) if f.is_file() and f.name!='SHA256SUMS.json'}
(a.output/'SHA256SUMS.json').write_text(json.dumps(checks,indent=2)+'\n');verify(a.output)
print(a.output/'index.html')
