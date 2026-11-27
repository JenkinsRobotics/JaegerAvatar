"""Resolve portable packs for the browser without executing pack code."""
from pathlib import Path
from urllib.parse import quote

import yaml

from .character import EXPRESSION, dial, dials, dynamics, profile as profile_words
from .packs import SCREEN_LOOK, PackError, load_pack, local_path, screen_look

ROOT = Path(__file__).resolve().parents[1] / 'avatars'


def asset_url(folder, path):
    return '/packs/' + quote(folder.name) + '/' + quote(str(path.relative_to(folder)), safe='/')


PROPS = ('name', 'hint', 'grid', 'cell_size', 'frames', 'cells', 'rows', 'files', 'ideal_size', 'scaling', 'fps', 'author', 'license')
MEDIA = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp4', '.webm', '.json'}


def exhibit(folder, root_path, p):
    """What a representation ships, for the page's exhibit: each asset's files and its sprite/bitmap properties. Read only."""
    files = []
    for name, a in (p.get('assets') or {}).items():
        if not isinstance(a, dict):
            continue
        row = dict(name=name, type=a.get('type'), adapter=a.get('adapter'))
        try:
            if a.get('file'):
                row['url'] = asset_url(folder, local_path(root_path, a['file']))
            if a.get('root'):
                d = local_path(root_path, a['root'])
                items = sorted(f for f in d.iterdir() if f.suffix.lower() in MEDIA) if d.is_dir() else []
                row.update(count=len(items), urls=[asset_url(folder, f) for f in items[:24]])
            if a.get('properties'):
                props = yaml.safe_load(local_path(root_path, a['properties']).read_text(encoding='utf-8')) or {}
                row['props'] = {k: props[k] for k in PROPS if k in props}
        except (PackError, OSError, yaml.YAMLError):
            row['missing'] = True
        files.append(row)
    return dict(kind=p.get('kind'), files=files, expressions=sorted(p.get('expressions') or {})[:40])


def catalog(root=ROOT):
    rows = []
    for manifest in sorted(root.glob('*/avatar.yaml')):
        folder = manifest.parent
        try:
            pack = load_pack(folder, verify_sources=False)
        except (PackError, OSError) as exc:
            # A pack being installed/edited must not blank the entire library.
            rows.append(dict(id=folder.name, name=folder.name, description='Pack unavailable: '+str(exc),
                             defaultProfile=None, defaultRepresentation=None, profiles=[], representations=[],
                             error=str(exc)))
            continue
        reps = []
        for key, rep in pack['representations'].items():
            p = rep['presentation']; render = p.get('render', {})
            adapter = render.get('adapter', '')
            entry = dict(id=key, name=rep.get('name'), format=rep['format'], adapter=adapter, preset=render.get('preset'), look=render.get('look', {}),
                         defaults=p.get('defaults', {}), supported=False, status='Source only · renderer not available')
            root_path = local_path(folder, rep['root'])
            entry['exhibit'] = exhibit(folder, root_path, p)
            if 'controls' in p: entry['controls'] = p['controls']
            asset = render.get('asset')
            if asset:
                path = local_path(root_path, asset)
                entry['asset'] = asset_url(folder, path)
                if path.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm'}:
                    entry.update(supported=True, status='Video' if path.suffix.lower() in {'.mp4','.webm'} else 'Portrait',
                                 adapter='media', mediaType='video' if path.suffix.lower() in {'.mp4','.webm'} else 'image')
            if rep['format'] == SCREEN_LOOK:   # worn by display bodies; not a body itself
                look = screen_look(root_path, render)
                entry.update(status='Screen look', screen={k: look[k] for k in ('renderer', 'displays', 'style')})
            if rep['format'] == 'avatar/rig-v1':
                entry.update(supported=True, status='Live rig')
            reps.append(entry)
        profiles = []
        for key, profile in pack['profiles'].items():
            entry = dict(id=key, character=profile['character'], dynamics=dynamics(profile['character']), dials=own_dials(profile['character']))   # how lively her body is, and where her personality dials start
            if profile.get('card'):entry['card']=asset_url(folder,local_path(folder,profile['card']))
            profiles.append(entry)
        rows.append(dict(id=pack['avatar'],name=pack['name'],description=pack.get('description',''),
                         defaultProfile=pack['default_profile'],defaultRepresentation=pack['default_representation'],
                         profiles=profiles,representations=reps))
    return rows


def character(pack_id, profile_id=None):
    """A profile's character sheet, and the pack's name for it."""
    pack = load_pack(local_path(ROOT, pack_id), verify_sources=False)
    sheet = pack['profiles'].get(profile_id or pack['default_profile'], {}).get('character', {})
    return sheet, sheet.get('name') or pack['name']


def persona(pack_id, profile_id=None):
    sheet, name = character(pack_id, profile_id)
    return name, profile_words(sheet)   # the words are built in one place, for every host


def own_dials(sheet):
    """Her personality dials as her pack sets them: every expression dial, in the middle where the pack says nothing."""
    traits = sheet.get('traits') if isinstance(sheet.get('traits'), dict) else {}
    return {**dict.fromkeys(EXPRESSION, 0.5), **{k: v for k, v in dials(traits.get('expression')).items() if k in EXPRESSION}}


def turned(sheet, dials):
    """The sheet with some of its expression dials turned ({name: 0..1}, from whoever is at the controls): the dials are
    hers to start with, and turning one is a choice made while she is on stage, not a change to her pack."""
    known = {k: v for k, v in (dials if isinstance(dials, dict) else {}).items() if k in EXPRESSION and dial(v) is not None}
    if not known: return sheet
    traits = sheet.get('traits') if isinstance(sheet.get('traits'), dict) else {}
    return {**sheet, 'traits': {**traits, 'expression': {**(traits.get('expression') if isinstance(traits.get('expression'), dict) else {}), **known}}}
