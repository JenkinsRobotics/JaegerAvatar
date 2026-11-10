"""Build a relocatable Mochi-only runtime for the first consumer integration."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,tempfile
import yaml
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'app/web'

def _build(output, visual_baseline=None):
    output=Path(output)
    if output.exists():raise ValueError('Output already exists; build a new version')
    output.mkdir(parents=True)
    runtime=output/'avatar_runtime';shutil.copytree(ROOT/'jaeger_avatar/embedded',runtime,ignore=shutil.ignore_patterns('__pycache__'))
    public=runtime/'public';public.mkdir()
    for name in ['index.html','embedded.js']:shutil.copy2(WEB/'embedded'/name,public/name)
    pending=[WEB/'kin/renderer.js',WEB/'kin/motion.js',WEB/'kin/eyes.js',WEB/'performances/mochi-scenes.js'];seen=set()
    if visual_baseline:
        baseline=Path(visual_baseline).resolve()
        for rel, digest in json.loads((baseline/"SHA256SUMS.json").read_text()).items():
            path=(baseline/rel).resolve()
            if not path.is_relative_to(baseline) or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError("Invalid visual baseline")
        shutil.copytree(baseline/"avatar_runtime/public",public,dirs_exist_ok=True)
        pending=[]
    while pending:
        file=pending.pop().resolve()
        if file in seen:continue
        if not file.is_relative_to(WEB):raise ValueError('Runtime import escapes web root')
        seen.add(file);dest=public/file.relative_to(WEB);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,dest)
        for spec in re.findall(r'''(?:^|[;\n])\s*(?:import|export)\s*(?:[^;'"]*?\bfrom\s*)?['"]([^'"]+)['"]''',re.sub(r'/\*[\s\S]*?\*/|(?m:^\s*//.*$)', '', file.read_text())):
            spec=spec.split('?')[0]
            if spec.startswith('.'):target=file.parent/spec
            elif spec=='three':target=WEB/'vendor/three/build/three.module.js'
            elif spec.startswith('three/addons/'):target=WEB/'vendor/three/examples/jsm'/spec[len('three/addons/'):]
            elif spec=='@pixiv/three-vrm':target=WEB/'vendor/three-vrm.module.min.js'
            else:raise ValueError('Unknown runtime dependency '+spec)
            pending.append(target)
    pack=yaml.safe_load((ROOT/'avatar-packs/mochi/avatar.yaml').read_text())
    # A single selected appearance, no other identities or prerecorded libraries.
    profile=pack['profiles'][pack['default_profile']]['character']
    manifest={'schema':'avatar-runtime-bundle/v1','version':'0.3.0','pack_version':pack['version'],'avatar':'mochi','name':'Mochi',
        'representation':'procedural_3d','renderer':'kin-momo','control_schema':'avatar-control/v1',
        'capabilities':{'emotions':['neutral','joy','excited','love','sad','angry','surprised','scared','thinking','confused','shy','smug','sleepy','laughing','singing','listening'],
        'reactions':['blink','wink','sideeye','sparkle','heart','roll','peek','doze','groove','wake']},
        'provenance':{'character':'avatar-packs/mochi/avatar.yaml','geometry':'KIN procedural shell shared with Momo; no external model',
        'source_representation':'procedural_3d',
        'source_sha256':hashlib.sha256((ROOT/'avatar-packs/mochi/avatar.yaml').read_bytes()).hexdigest()}}
    manifest['actions']={**{e:{'operation':'emotion','value':e} for e in manifest['capabilities']['emotions']},**{e:{'operation':'reaction','value':e} for e in manifest['capabilities']['reactions']},'look_left':{'operation':'gaze','value':[-1,0]},'look_right':{'operation':'gaze','value':[1,0]},'look_center':{'operation':'gaze','value':[0,0]},'rest':{'operation':'stop','value':None}}
    names=['squint_wink','pong','sleep_bubble','tongue','anger','speedometer','scare','tired','hearts_kiss','yawn']
    manifest['capabilities']['clips']={name:{'id':f'cell_{i//2}_{i%2}','duration_ms':16709} for i,name in enumerate(names)}
    manifest['actions'].update({name:{'operation':'clip','value':name,'ttl_ms':17000} for name in names})
    audio_source=ROOT/'avatar-packs/mochi/assets/performance-audio'
    shutil.copytree(audio_source,public/'audio')
    shutil.copy2(WEB/'embedded/performance-audio.js',public/'performance-audio.js')
    manifest['performance_audio']={'schema':'mochi-performance-audio/v1','manifest':'audio/manifest.json','player':'performance-audio.js'}
    if visual_baseline:manifest['provenance']['visual_baseline_sha256']=hashlib.sha256((Path(visual_baseline)/'SHA256SUMS.json').read_bytes()).hexdigest()
    manifest['activity']={'thinking':'thinking','error':'confused','failed':'confused'}
    (runtime/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    # Existing Mochi chat/persona adapter reads this projection; original character
    # metadata is retained and no tools, credentials or conversation are exported.
    sheet={**profile,'schema':'character/v1','character':'mochi','name':'Mochi'}
    (runtime/'character.yaml').write_text(yaml.safe_dump(sheet,sort_keys=False,allow_unicode=True))
    licenses=runtime/'licenses';licenses.mkdir();shutil.copy2(ROOT/'LICENSE',licenses/'JaegerAvatar-LICENSE')
    for p in (WEB/'vendor').rglob('*LICENSE*'):
        if p.is_file():shutil.copy2(p,licenses/(str(p.relative_to(WEB/'vendor')).replace('/','_')))
    (output/'SHA256SUMS.json').write_text(json.dumps({str(p.relative_to(output)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.rglob('*')) if p.is_file()},indent=2)+'\n')
    return output
def build(output, visual_baseline=None):
    output=Path(output).resolve()
    if output.exists():raise ValueError('Output already exists; build a new version')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.avatar-build-',dir=output.parent) as temp:
        staging=Path(temp)/'bundle'
        _build(staging, visual_baseline)
        staging.rename(output)
    return output

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,type=Path);p.add_argument('--visual-baseline',type=Path);args=p.parse_args();print(build(args.output,args.visual_baseline))
