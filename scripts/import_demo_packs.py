#!/usr/bin/env python3
"""Add the reviewed Nori/KIN characters without replacing authored source variants."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import shutil
import subprocess
import sys
import struct

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.packs import validate_catalog


def import_demos(nori, kin, output):
    text = (nori / 'web/app.js').read_text()
    table = text.split('const CHARACTERS = ', 1)[1].split('\n];', 1)[0] + '\n]'
    js = "const KRISTIN='en_US-kristin-medium',JOE='en_US-joe-medium',BRYCE='en_US-bryce-medium',NORMAN='en_US-norman-medium';const d3=()=>()=>{};console.log(JSON.stringify(" + table + "));"
    characters = json.loads(subprocess.check_output(['node', '-e', js], text=True))
    personas = {}
    for node in ast.parse((nori / 'server.py').read_text()).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'PERSONAS' for t in node.targets):
            personas = ast.literal_eval(node.value)
    characters += [
        dict(id='momo', name='Momo', tag='KIN desk companion', kokoro='af_heart', pitch=1, led=True,
             intro="[joy] I'm Momo, an AI desk companion. My shell stays still, and my eyes do the talking."),
        dict(id='aster', name='Aster', tag='KIN archived VRM', kokoro='af_heart', pitch=1, moves=True,
             intro="[joy] I'm Aster, an AI character from the original KIN model experiment."),
    ]
    presets = {'vita':('nori-vrm','vita'),'mochi':('nori-led','mochi'),'visor':('nori-led','visor'),
               'nori':('nori-anime','nori'),'ace':('nori-anime','ace'),'sol':('nori-anime','sol'),
               'pip':('nori-3d','astro'),'bo':('nori-3d','cube'),'rook':('nori-3d','droid'),'maya':('nori-3d','human'),
               'momo':('kin-momo','momo'),'aster':('nori-vrm','aster')}
    for ch in characters:
        ident='vee' if ch['id']=='visor' else ch['id']
        manifest=output/ident/'avatar.yaml'
        source='kin_demo' if ident in {'momo','aster'} else 'nori_demo'
        if manifest.exists() and source in yaml.safe_load(manifest.read_text()).get('sources',{}):
            raise ValueError(f'{ident}: demo already imported; refusing to overwrite authoring')
    for ch in characters:
        ident = 'vee' if ch['id'] == 'visor' else ch['id']
        folder = output / ident
        manifest = folder / 'avatar.yaml'
        pack = yaml.safe_load(manifest.read_text()) if manifest.exists() else dict(
            schema='avatar/v1', avatar=ident, name=ch['name'], version='0.1.0',
            description=ch['tag'], default_profile=None, default_representation=None,
            profiles={}, representations={}, sources={})
        source = 'kin_demo' if ident in {'momo','aster'} else 'nori_demo'
        if source in pack['sources']:
            raise ValueError(f'{ident}: demo already imported; refusing to overwrite authoring')
        original = folder / 'sources' / source
        original.mkdir(parents=True)
        (original / 'character.json').write_text(json.dumps(ch,indent=2)+'\n')
        files = {}
        adapter,preset = presets[ch['id']]
        render = dict(adapter=adapter,preset=preset)
        if ident in {'vita','aster'}:
            model = nori/'web/models/AvatarSample_F.vrm' if ident=='vita' else kin/'public/models/avatar.vrm'
            shutil.copy2(model,original/'model.vrm')
            render['asset']='model.vrm'
            raw=model.read_bytes(); meta=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]).get('extensions',{})
            (original/'MODEL-METADATA.json').write_text(json.dumps({k:v.get('meta',{}) for k,v in meta.items() if k in ['VRM','VRMC_vrm']},indent=2,ensure_ascii=False)+'\n')
            if ident=='vita':shutil.copy2(nori/'web/models/LICENSE.txt',original/'LICENSE.txt')
            else:
                # Preserve the source model record; do not infer a broader license.
                shutil.copy2(kin/'README.md',original/'KIN-SOURCE.md')
        for p in original.iterdir():files[str(p.relative_to(folder))]=hashlib.sha256(p.read_bytes()).hexdigest()
        pack['sources'][source]=dict(repository='local avatar demos',original_path=str(nori if source=='nori_demo' else kin),
            dirty_working_tree=True,files=files,license='See app/licenses and source model metadata; mixed provenance')
        pack['profiles'][source]={'source':source,'character':dict(name=ch['name'],description=ch['tag'],
            identity={'role':ch['tag']},prompt={'custom_instructions':personas.get(ch['id'],ch['intro'])})}
        pack['representations'][source]={'source':source,'format':'avatar/rig-v1','root':str(original.relative_to(folder)),
            'presentation':{'kind':'rig','render':render,'defaults':{**ch,'pack':ident}}}
        if ident=='vita':
            pack['representations']['kin_demo']={'source':source,'format':'avatar/rig-v1','root':str(original.relative_to(folder)),
                'presentation':{'kind':'rig','render':{'adapter':'kin-vrm','preset':'vita','asset':'model.vrm'},
                                'defaults':{**ch,'id':'vita-kin','pack':'vita','tag':'original KIN soft shading'}}}
        if pack['default_profile'] is None:pack['default_profile']=source
        if pack['default_representation'] is None:pack['default_representation']=source
        manifest.write_text(yaml.safe_dump(pack,sort_keys=False,allow_unicode=True))
    packs=validate_catalog(output)
    index=json.loads((output/'catalog.json').read_text())
    index['avatars']=[dict(avatar=p['avatar'],name=p['name'],manifest=p['avatar']+'/avatar.yaml',sources=sorted(p['sources'])) for p in packs]
    (output/'catalog.json').write_text(json.dumps(index,indent=2)+'\n')
    print(f'{len(packs)} packs; added twelve characters and thirteen live representations (Mochi extends the existing pack).')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nori',type=Path,required=True);parser.add_argument('--kin',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('avatar-packs'))
    args=parser.parse_args();import_demos(args.nori,args.kin,args.output)
