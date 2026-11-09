"""Build portable avatar bundles and explicit character/v1 compatibility exports.

No renderer, model, private runtime state or physical actuator commands are bundled.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import yaml
from .packs import PackError, load_pack, local_path, validate_catalog

ADAPTERS = {'image', 'gif', 'video', 'sprite', 'bitmap', 'math'}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def safe_tree(root):
    for p in root.rglob('*'):
        if p.is_symlink():
            raise PackError(f'Symlinks are not deployable: {p}')

def references(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value: yield from references(item)
    elif isinstance(value, dict):
        for item in value.values(): yield from references(item)

def compatibility(pack, key):
    rep = pack['representations'][key]
    p = rep['presentation']; render = p.get('render', {})
    if rep['format'] != 'character/v1':
        return 'Requires Jaeger Avatar browser rig runtime; not playable by the current Mochi dispatcher'
    if p.get('kind') not in {'sprite_sheet', 'clip_set', 'procedural'}:
        return 'Unsupported Mochi representation kind'
    if render.get('adapter') not in ADAPTERS or not render.get('asset'):
        return 'No supported display adapter/asset'
    if not p.get('expressions') or p.get('default_expression') not in p['expressions']:
        return 'Missing expression/default expression'
    return None

def legacy_manifest(pack, key):
    reason = compatibility(pack, key)
    if reason: raise PackError(reason)
    p = copy.deepcopy(pack['representations'][key]['presentation'])
    # Never present browser performance defaults as consumer capabilities.
    p.pop('defaults', None)
    profile = pack.get('profiles', {}).get(pack.get('default_profile'), {}).get('character', {})
    return {**copy.deepcopy(profile), **p, 'schema':'character/v1',
            'character':pack['avatar'], 'name':pack['representations'][key].get('name',pack['name']), 'version':pack['version']}

def build(root: Path, output: Path, *, avatars=None):
    root, output = Path(root).resolve(), Path(output).absolute()
    if output.exists(): raise PackError(f'Output already exists: {output}')
    if output.is_relative_to(root): raise PackError('Output must be outside the source catalog')
    packs=validate_catalog(root)
    if avatars and set(avatars)-{p['avatar'] for p in packs}:raise PackError('Unknown avatar selection')
    output.parent.mkdir(parents=True, exist_ok=True)
    rows=[]
    with tempfile.TemporaryDirectory(prefix='.avatar-export-',dir=output.parent) as temp:
        stage=Path(temp)/'release';stage.mkdir()
        for manifest in sorted(root.glob('*/avatar.yaml')):
            folder=manifest.parent; pack=load_pack(folder,verify_sources=True)
            if avatars and pack['avatar'] not in avatars:continue
            safe_tree(folder)
            native=stage/'avatar-v1'/pack['avatar']
            shutil.copytree(folder,native)
            load_pack(native,verify_sources=True)
            row={'avatar':pack['avatar'],'version':pack['version'],'native':'avatar-v1/'+pack['avatar'],
                 'profile':pack.get('default_profile'),'representations':[],
                 'hardware_verified':False}
            for key,rep in pack['representations'].items():
                p=rep['presentation']; reason=compatibility(pack,key)
                entry={'id':key,'name':rep.get('name',key),'adapter':p.get('render',{}).get('adapter'),
                       'status':'requires_runtime' if reason else 'compatibility_export',
                       'reason':reason,'motion_scripts_qualified':False}
                if not reason:
                    target=stage/'mochi-character-v1'/f"{pack['avatar']}--{key}"
                    source=local_path(folder,rep['root'])
                    shutil.copytree(source,target)
                    data=legacy_manifest(pack,key)
                    # Check every expression's clip choice, including nested mouth-state maps.
                    for spec in data['expressions'].values():
                        for field in ('clips','asset'):
                            for ref in references(spec.get(field)):
                                local_path(target,ref)
                    local_path(target,data['render']['asset'])
                    (target/'character.yaml').write_text(yaml.safe_dump(data,sort_keys=False,allow_unicode=True))
                    # Preserve alias metadata; scripts need a consumer resolver and are not qualified here.
                    (target/'avatar-export.json').write_text(json.dumps({'avatar':pack['avatar'],'representation':key,
                        'profile':pack.get('default_profile'),'path_aliases':rep.get('path_aliases',{}),
                        'motion_scripts_qualified':False},indent=2)+'\n')
                    entry['path']=str(target.relative_to(stage))
                    entry['presentation']='static' if p.get('render',{}).get('adapter')=='image' else 'animated_or_stateful'
                row['representations'].append(entry)
            rows.append(row)
        report={'schema':'avatar-deployment-report/v1','packs':rows,
                'qualification':'Export and local references validated; consumer/hardware verification is separate',
                'license_note':'Original declarations preserved. Export does not grant redistribution rights.',
                'jp01':'Display target and runtime must be qualified; no robot connection or actuator control performed.'}
        (stage/'readiness.json').write_text(json.dumps(report,indent=2)+'\n')
        (stage/'README.txt').write_text('Jaeger Avatar deployment bundle\n\navatar-v1/: complete canonical packs for an avatar/v1 consumer.\nmochi-character-v1/: explicit representation exports for the existing Mochi loader.\nChoose ONE representation per avatar when installing; duplicate character IDs otherwise override each other.\nStatic portraits are not animated faces. Browser rigs need the Jaeger Avatar runtime.\nLegacy motion scripts are preserved but NOT deployment-qualified; use readiness.json.\nNo hardware deployment or rights clearance is implied. Original source/license records remain in avatar-v1.\nRun: python -m jaeger_avatar.deploy verify <bundle-directory>\n')
        checks={str(p.relative_to(stage)):digest(p) for p in sorted(stage.rglob('*')) if p.is_file()}
        (stage/'SHA256SUMS.json').write_text(json.dumps(checks,indent=2)+'\n')
        verify(stage)
        stage.rename(output)
    return report

def verify(root):
    root=Path(root);safe_tree(root)
    checks=json.loads((root/'SHA256SUMS.json').read_text())
    actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}-{'SHA256SUMS.json'}
    if actual!=set(checks): raise PackError('Bundle file inventory changed')
    for rel,expected in checks.items():
        if digest(local_path(root,rel))!=expected: raise PackError(f'Bundle checksum mismatch: {rel}')
    validate_catalog(root/'avatar-v1')
    return len(checks)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('build');p.add_argument('--root',type=Path,default=Path('avatar-packs'));p.add_argument('--output',type=Path,required=True);p.add_argument('--avatar',action='append',dest='avatars')
    p=sub.add_parser('verify');p.add_argument('root',type=Path)
    args=parser.parse_args()
    try:
        if args.command=='verify':print(f'Verified {verify(args.root)} files')
        else:
            report=build(args.root,args.output,avatars=args.avatars)
            print(f"Exported {len(report['packs'])} canonical packs to {args.output}; inspect readiness.json for consumer limits")
    except (PackError,OSError,ValueError) as exc:parser.exit(1,str(exc)+'\n')
if __name__=='__main__':main()
