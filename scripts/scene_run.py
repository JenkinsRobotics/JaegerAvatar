"""Run a scene for two against the running app, with a recorded person in the other part, and log every event.

    .venv/bin/python scripts/scene_run.py --who who.json --scene scenes/visitor.scene --line a.wav --line b.wav \
        --events run.jsonl [--url http://127.0.0.1:8792] [--typed "words" ...]

The app's page must be open: it plays her clips, makes each move when its cue comes and (in half duplex) says when her
words have played. This script plays the person. It starts the scene as the page does (--who: the body the page posts
to /agent/scene, its loopWho()), and at each 'listen' waits until her part has played, then says the next line into the
page's microphone route (/agent/audio, 16 kHz, in real time) or types it (--typed). Score the log with Jaeger Agent's
report:  python -m jaeger_agent.bench.scene_report SCENE run.jsonl ...
"""
import argparse
import json
import threading
import time
import urllib.request
import wave
from pathlib import Path

import numpy as np


def post(url, data, raw=False):
    body = data if raw else json.dumps(data).encode()
    urllib.request.urlopen(urllib.request.Request(url, body, method='POST'), timeout=10).read()


def pcm16k(path):
    with wave.open(str(path)) as w:
        rate, sound = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32)
    return np.interp(np.arange(0, len(sound), rate / 16000), np.arange(len(sound)), sound).astype('<i2')


def say_into_mic(url, sound, quiet_s=1.0):
    """The line at its own pace in 100 ms pieces, then quiet, and the mic's word that it went quiet (as the page does)."""
    sound = np.concatenate([sound, np.zeros(int(16000 * quiet_s), '<i2')])
    start = time.monotonic()
    for i in range(0, len(sound), 1600):
        time.sleep(max(0, start + i / 16000 - time.monotonic()))
        post(url + '/agent/audio' + ('?end=1' if i + 1600 >= len(sound) else ''), sound[i:i + 1600].tobytes(), raw=True)


def main():
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument('--url', default='http://127.0.0.1:8792')
    a.add_argument('--who', type=Path, required=True)
    a.add_argument('--scene', type=Path, required=True)
    a.add_argument('--line', type=Path, action='append', default=[], help='a WAV for each of their lines, in order')
    a.add_argument('--typed', action='append', default=[], help='or their lines typed, in order')
    a.add_argument('--events', type=Path, required=True)
    a.add_argument('--wait', type=float, default=90, help='seconds to wait for each part before giving up')
    args = a.parse_args()
    who, lines = json.loads(args.who.read_text()), [pcm16k(p) for p in args.line] or args.typed
    began, log, lock = time.monotonic(), args.events.open('w'), threading.Lock()
    state = {'part_s': 0.0, 'end_at': None, 'listen': threading.Event(), 'done': threading.Event()}

    def record(e):
        if e.get('event') == 'audio':
            secs = len(e.get('pcm') or '') * 3 / 8 / max(1, e.get('rate') or 24000)
            e = {**{k: v for k, v in e.items() if k != 'pcm'}, 'seconds': round(secs, 2)}
            state['part_s'] += secs
        with lock: log.write(json.dumps({'at': round(time.monotonic() - began, 3), **e}, default=str) + '\n'); log.flush()
        if e.get('event') == 'scene' and e.get('text') == 'end': state['end_at'] = time.monotonic()
        if e.get('event') == 'scene' and e.get('text') == 'listen': state['listen'].set()
        if e.get('event') == 'done': state['done'].set()

    def events():
        with urllib.request.urlopen(args.url + '/agent/events', timeout=600) as r:
            for raw in r:
                if raw.startswith(b'data: '):
                    try: record(json.loads(raw[6:]))
                    except ValueError: pass

    threading.Thread(target=events, daemon=True).start()
    time.sleep(1)
    post(args.url + '/agent/scene', {**who, 'script': args.scene.read_text()})
    for line in lines:
        if not state['listen'].wait(args.wait): print('never got to their line'); break
        state['listen'].clear()
        # Her part plays from the scene's 'end' (the page holds the clips until then); answer once it has, as a person would.
        played_at = (state['end_at'] or time.monotonic()) + state['part_s'] + 0.8
        time.sleep(max(0, played_at - time.monotonic()))
        state['part_s'], state['end_at'] = 0.0, None
        state['done'].clear()
        if isinstance(line, str): post(args.url + '/agent/text', {**who, 'text': line})
        else: say_into_mic(args.url, line)
    state['done'].wait(args.wait)
    time.sleep((state['part_s'] or 0) + 1)   # the last part plays out
    log.close()


if __name__ == '__main__':
    main()
