#!/usr/bin/env python3
"""Drive the body on stage from another process, through the app's optional control link.

    python scripts/avatar_control.py feel joy
    python scripts/avatar_control.py react wink
    python scripts/avatar_control.py act clap
    python scripts/avatar_control.py look 0.5 -0.2
    python scripts/avatar_control.py say "Mom bought a big puppy" --voice kokoro:af_heart
    python scripts/avatar_control.py stop

`say` borrows the demo's voice service for audio and lip timing, uploads the
clip, and sends `speak`. The token is the one the demo server prints (or $JAEGER_AVATAR_CONTROL_TOKEN).
"""
import argparse
import io
import math
import json
import os
import sys
import urllib.error
import urllib.request
import wave

OPS = {'feel': 'emotion', 'react': 'reaction', 'act': 'act'}


def parse(argv):
    p = argparse.ArgumentParser(prog='avatar_control', description='Drive the avatar on stage from outside it.')
    p.add_argument('--url', default='http://127.0.0.1:8790')
    p.add_argument('--token', default=None)
    sub = p.add_subparsers(dest='command', required=True)
    for name in OPS:
        sub.add_parser(name).add_argument('name')
    look = sub.add_parser('look'); look.add_argument('x', type=float); look.add_argument('y', type=float)
    sub.add_parser('stop')
    say = sub.add_parser('say'); say.add_argument('text'); say.add_argument('--voice', default='kokoro:af_heart')
    args = p.parse_args(argv)
    args.error = p.error
    return args


def build_request(args):
    """(path, body, headers) for one command. `say` is built after its clip is uploaded (see main)."""
    token = args.token or os.environ.get('JAEGER_AVATAR_CONTROL_TOKEN')
    if not token:
        args.error('no token: pass --token or set JAEGER_AVATAR_CONTROL_TOKEN (the demo server prints it at startup)')
    headers = {'X-Avatar-Token': token}
    if args.command in OPS:
        return '/control', {'op': OPS[args.command], 'value': args.name}, headers
    if args.command == 'look':
        if not (-1 <= args.x <= 1 and -1 <= args.y <= 1):
            args.error('look takes x and y in [-1, 1]')
        return '/control', {'op': 'gaze', 'value': [args.x, args.y]}, headers
    if args.command == 'stop':
        return '/control', {'op': 'stop', 'value': None}, headers
    return '/control', {'op': 'speak', 'value': None}, headers


def wav_ms(data):
    with wave.open(io.BytesIO(data)) as w:
        return math.ceil(w.getnframes() * 1000 / w.getframerate())   # never shorter than the sound, so every lip mark fits


def call(url, data, headers):
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read(), r.headers
    except urllib.error.HTTPError as e:
        sys.exit(f'{e.code}: {e.read().decode(errors="replace")}')
    except urllib.error.URLError as e:
        sys.exit(f'cannot reach {url}: {e.reason}')


def main(argv=None):
    args = parse(argv)
    path, body, headers = build_request(args)
    if args.command == 'say':
        wav, h = call(args.url + '/say', json.dumps({'text': args.text, 'voice': args.voice}).encode(), {'Content-Type': 'application/json'})
        marks = json.loads(h.get('X-Lips') or '[]')
        clip = json.loads(call(args.url + '/control/audio', wav, {**headers, 'Content-Type': 'audio/wav'})[0])['clip']
        body['value'] = {'clip': clip, 'duration_ms': wav_ms(wav), 'marks': marks, 'text': args.text}
    out, _ = call(args.url + path, json.dumps(body).encode(), {**headers, 'Content-Type': 'application/json'})
    state = json.loads(out)
    print(f"ok · seq {state['seq']} · {state['emotion']}" + (f" · speaking {body['value']['duration_ms']} ms, {len(body['value']['marks'])} lip marks" if args.command == 'say' else ''))


if __name__ == '__main__':
    main()
