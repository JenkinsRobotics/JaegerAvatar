"""Resolve portable packs for the browser without executing pack code."""
from pathlib import Path
from urllib.parse import quote

from .packs import PackError, load_pack, local_path

ROOT = Path(__file__).resolve().parents[1] / 'avatar-packs'


def asset_url(folder, path):
    return '/packs/' + quote(folder.name) + '/' + quote(str(path.relative_to(folder)), safe='/')


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
            asset = render.get('asset')
            if asset:
                path = local_path(root_path, asset)
                entry['asset'] = asset_url(folder, path)
                if path.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm'}:
                    entry.update(supported=True, status='Video' if path.suffix.lower() in {'.mp4','.webm'} else 'Portrait',
                                 adapter='media', mediaType='video' if path.suffix.lower() in {'.mp4','.webm'} else 'image')
            if rep['format'] == 'avatar/rig-v1':
                entry.update(supported=True, status='Live rig')
            reps.append(entry)
        profiles = []
        for key, profile in pack['profiles'].items():
            entry = dict(id=key, character=profile['character'])
            if profile.get('card'):entry['card']=asset_url(folder,local_path(folder,profile['card']))
            profiles.append(entry)
        rows.append(dict(id=pack['avatar'],name=pack['name'],description=pack.get('description',''),
                         defaultProfile=pack['default_profile'],defaultRepresentation=pack['default_representation'],
                         profiles=profiles,representations=reps))
    return rows


def persona(pack_id, profile_id=None):
    folder = local_path(ROOT, pack_id)
    pack = load_pack(folder, verify_sources=False)
    profile = pack['profiles'].get(profile_id or pack['default_profile'], {})
    character = profile.get('character', {})
    prompt = character.get('prompt', {})
    text = '\n'.join(str(prompt[k]) for k in ('custom_instructions','soul','backstory') if prompt.get(k))
    return pack['name'], text
