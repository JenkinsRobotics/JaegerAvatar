#!/usr/bin/env python3
"""Build one avatar's face for a robot's own panel, as a folder that runs with no browser.

    python3 scripts/build_panel_runtime.py --avatar jp01 --output dist/jp01-panel-0.3.0

The folder holds the control package (Python: avatar-control/v1 commands in), the face program (Node: the panel's
pixels out), a manifest, the character sheet and checksums. It needs Python and Node on the robot, and nothing
else from this repository. The face is the one the pack names (defaults.face) and must have a look made for the
panel; the build runs the finished folder once to be sure it does.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))
from jaeger_avatar.character import dynamics, manner, who
KIN = ROOT / 'app/web/kin'


def _build(output, avatar):
    pack_file = ROOT / 'avatars' / avatar / 'avatar.yaml'
    pack = yaml.safe_load(pack_file.read_text())
    look = pack['representations'][pack['default_representation']]['presentation']
    face = look['defaults'].get('face')
    if not face: raise ValueError(f'{avatar} names no face (defaults.face) to put on a panel')
    runtime = output / 'avatar_runtime'
    shutil.copytree(ROOT / 'jaeger_avatar/embedded', runtime, ignore=shutil.ignore_patterns('__pycache__'))
    # The face program and what it imports: plain arithmetic, no browser parts.
    pending, seen = [KIN / 'panel-run.mjs'], set()
    while pending:
        file = pending.pop().resolve()
        if file in seen: continue
        if not file.is_relative_to(KIN): raise ValueError(f'The face program reaches outside kin/: {file}')
        seen.add(file)
        (runtime / 'panel/kin').mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, runtime / 'panel/kin' / file.name)
        pending += [file.parent / spec for spec in re.findall(r'''^\s*import\s[^'"]*['"](\.[^'"]+)['"]''', file.read_text(), re.M)]
    emotions = re.findall(r"'(\w+)'", re.search(r'FACE_MOODS=\[([^\]]+)\]', (KIN / 'eyes.js').read_text()).group(1))   # the engine's own list
    manifest = {
        'schema': 'avatar-runtime-bundle/v1', 'version': pack['version'], 'pack_version': pack['version'], 'avatar': avatar, 'name': pack['name'],
        'representation': 'panel', 'renderer': 'panel-run', 'face': face, 'control_schema': 'avatar-control/v1',
        'capabilities': {'emotions': emotions, 'reactions': list(look.get('controls', {}).get('reactions', []))},
        'outputs': [{'id': 'face', 'width': 64, 'height': 64, 'format': 'rgb8'}, {'id': 'ring', 'width': 24, 'height': 1, 'format': 'rgb8'}],
        'program': {'run': ['node', 'panel/kin/panel-run.mjs', '--face', face], 'needs': 'Node 18 or newer'},
        'provenance': {'character': f'avatars/{avatar}/avatar.yaml', 'source_sha256': hashlib.sha256(pack_file.read_bytes()).hexdigest()},
    }
    # Who the character is, for the host's agent and voice. No tools, credentials or conversation travel with it.
    sheet = {**pack['profiles'][pack['default_profile']]['character'], 'schema': 'character/v1', 'character': avatar, 'name': pack['name']}
    manifest['character'] = {'who': who(sheet, pack['name']), 'manner': manner(sheet), 'dynamics': dynamics(sheet), 'voice': look['defaults'].get('kokoro') or sheet.get('identity', {}).get('voice_id', '')}   # ready for a host that reads only JSON
    manifest['activity'] = {a: a for a in ('thinking', 'listening') if a in emotions}   # the feeling shown while the agent thinks or hears someone
    (runtime / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (runtime / 'character.yaml').write_text(yaml.safe_dump(sheet, sort_keys=False, allow_unicode=True))
    (runtime / 'licenses').mkdir()
    shutil.copy2(ROOT / 'LICENSE', runtime / 'licenses/JaegerAvatar-LICENSE')
    # Run the finished folder once: a face with no look made for the panel stops here, not on the robot.
    try: ran = subprocess.run(manifest['program']['run'], cwd=runtime, input=b'', capture_output=True, timeout=30)
    except FileNotFoundError: raise ValueError('Node is needed to build and to run the panel face') from None
    if ran.returncode: raise ValueError(ran.stderr.decode().strip() or 'The face program did not start')
    sums = {str(p.relative_to(output)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.rglob('*')) if p.is_file()}
    (output / 'SHA256SUMS.json').write_text(json.dumps(sums, indent=2) + '\n')
    return output


def build(output, avatar='jp01'):
    output = Path(output).resolve()
    if output.exists(): raise ValueError('Output already exists; build a new version')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.panel-build-', dir=output.parent) as temp:   # all or nothing: a failed build leaves no folder
        staging = Path(temp) / 'bundle'
        staging.mkdir()
        _build(staging, avatar)
        staging.rename(output)
    return output


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument('--avatar', default='jp01')
    args.add_argument('--output', required=True, type=Path)
    args = args.parse_args()
    print(build(args.output, args.avatar))
