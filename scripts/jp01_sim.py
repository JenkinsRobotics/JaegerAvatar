#!/usr/bin/env python3
"""A simulated JP01 connected to Jaeger Agent: the connection the real robot makes, with stand-ins for its hardware.

    .agent-venv/bin/python scripts/jp01_sim.py                       # type to it; /scene, /stop, /quit as in Mochi
    .agent-venv/bin/python scripts/jp01_sim.py --script steps.txt --out run/      # nobody at the keyboard; pictures of the panel in run/

Run it with the Python that has Jaeger Agent and the animation module (.agent-venv; ./run.sh makes it). JP01 is a
body: the agent (jaeger_agent.body) with its own model, voice, hearing and turn-taking, which opens JP01's body from
the animation slot. This builds JP01's bundle the way the robot gets it (scripts/build_panel_runtime.py) and gives
the agent five stand-ins, one for each thing the robot has (dev/docs/runtime/DEVICE.md):

    face panel   64 x 64 RGB frames, 30 a second          SimDisplay('face')   real: the AVC01 matrix driver
    LED ring     24 x 1 RGB frames, 30 a second           SimDisplay('ring')   real: the AVC01 ring driver
    speaker      clips of mono sound, one at a time       SimSpeaker           real: the robot's audio out
    microphone   16 kHz mono frames to device.hear()      --mic-file, or none  real: the robot's audio in
    head         gaze -1..1 -> pan and tilt degrees       SimHead              real: joints j1 (pan), j2 (tilt)

Moving to the real robot is giving the agent's Device the real speaker and microphone and handing the same frames and
gaze to the real drivers. Nothing in the agent, the animation module or the bundle changes.
"""
import argparse
import json
import struct
import sys
import tempfile
import threading
import time
import wave
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
PAN_DEG, TILT_DEG = 45, 25                 # the head's reach either side of centre. The robot's own limits decide the real ones.
MIC_RATE, MIC_FRAME = 16000, 480


def png(path, rgb, width, height, scale=6):
    """A frame as a picture, each LED a square."""
    rows = np.frombuffer(rgb, np.uint8).reshape(height, width, 3).repeat(scale, 0).repeat(scale, 1)
    raw = b''.join(b'\0' + row.tobytes() for row in rows)
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width * scale, height * scale, 8, 2, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


class SimDisplay:
    """Stands in for a panel or a ring: keeps count of the frames it is handed, and how many differed from the one before."""
    def __init__(self, name): self.name, self.frames, self.changed, self.last, self.first_at, self.last_at = name, 0, 0, None, None, None
    def show(self, rgb):
        now = time.monotonic()
        self.first_at = self.first_at or now; self.last_at = now
        self.frames += 1; self.changed += rgb != self.last; self.last = rgb
    @property
    def fps(self): return round((self.frames - 1) / (self.last_at - self.first_at), 1) if self.frames > 1 and self.last_at > self.first_at else 0.0


class SimSpeaker:
    """Stands in for the robot's audio out: takes each clip and keeps time, with no sound."""
    def __init__(self): self.clips, self.seconds, self.stops = 0, 0.0, 0
    def play(self, samples, rate): self.clips += 1; self.seconds += len(samples) / rate
    def stop(self): self.stops += 1


class SimHead:
    """Stands in for the pan-tilt head: where the avatar looks, as the two joint angles."""
    def __init__(self): self.pan, self.tilt, self.moves = 0.0, 0.0, []
    def look(self, gaze, at):
        pan, tilt = round(gaze[0] * PAN_DEG, 1), round(gaze[1] * TILT_DEG, 1)
        if (pan, tilt) != (self.pan, self.tilt): self.pan, self.tilt = pan, tilt; self.moves.append((round(at, 2), pan, tilt))


def main():
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument('--script', type=Path, help='rows of "say: words", "scene: steps", "sleep: seconds"; then quit')
    args.add_argument('--mic-file', type=Path, help='a WAV played in as the microphone')
    args.add_argument('--out', type=Path, help='a folder for pictures of the panel (two a second), events.jsonl and report.json')
    args = args.parse_args()

    try: from jaeger_agent.body import AgentHost, Device
    except ImportError: raise SystemExit('Jaeger Agent is not in this Python. Run it with .agent-venv/bin/python (./run.sh makes it).')
    import build_panel_runtime
    with tempfile.TemporaryDirectory(prefix='jp01-sim-') as tmp:
        bundle = build_panel_runtime.build(Path(tmp) / 'jp01-panel')       # the folder the robot vendors and pins

        began = time.monotonic()
        if args.out: args.out.mkdir(parents=True, exist_ok=True)
        log, lock = (args.out / 'events.jsonl').open('w') if args.out else None, threading.Lock()
        def record(entry):
            if log:
                with lock: log.write(json.dumps({'at': round(time.monotonic() - began, 3), **entry}, default=str) + '\n'); log.flush()
        def on_event(e):
            record({**{k: v for k, v in e.items() if k != 'pcm'}, **({'seconds': round(len(e['pcm']) * 3 / 8 / e['rate'], 2)} if e.get('event') == 'audio' else {})})
        def show(line): record({'event': 'shown', 'text': line}); print(line, flush=True)

        face, ring, speaker, head = SimDisplay('face'), SimDisplay('ring'), SimSpeaker(), SimHead()
        host = AgentHost(log=ROOT / 'app/.cache/jp01-sim-agent.log', cwd=ROOT)
        device = Device(host, bundle, speaker=speaker, session='jp01-sim', show=show, on_event=on_event)
        if device.body is None: raise SystemExit('Nothing fills the animation slot in this Python: install jaeger-animation (requirements-agent.txt).')
        manifest, controller = device.body.manifest, device.body.controller
        panel = device.body.panel()                                         # the bundle's face program, fed this body's state
        talking = {'frames': 0, 'changed': 0}                               # the face panel while she speaks: it must be moving

        def draw():
            shot = 0.0
            for width, height, number, rgb in panel.frames():
                state = controller.snapshot()
                if height > 1:
                    before = face.changed; face.show(rgb)
                    if state['speaking']: talking['frames'] += 1; talking['changed'] += face.changed - before
                    head.look(state['gaze'], time.monotonic() - began)
                    if args.out and time.monotonic() - shot >= 0.5:
                        shot = time.monotonic()
                        png(args.out / f"face_{time.monotonic() - began:07.2f}s_{state['emotion']}{'_speaking' if state['speaking'] else ''}.png", rgb, width, height)
                else:
                    ring.show(rgb)
        threading.Thread(target=draw, daemon=True).start()

        print(f"{manifest['name']} {manifest['version']} (simulated): {', '.join('{id} {width}x{height} {format}'.format(**o) for o in manifest['outputs'])}", flush=True)
        device.start()
        print('Loading the agent (its model, voice and hearing)…', flush=True)
        while not device.ready:
            if host.process is None or host.process.poll() is not None:
                raise SystemExit(host.why or 'The agent did not start. See app/.cache/jp01-sim-agent.log')
            time.sleep(0.2)
        ready = time.monotonic() - began
        record({'event': 'ready', 'report': host.report})
        print('Ready.', flush=True)

        if args.mic_file:
            def mic():
                with wave.open(str(args.mic_file)) as w:
                    rate, sound = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
                sound = np.interp(np.arange(0, len(sound), rate / MIC_RATE), np.arange(len(sound)), sound).astype(np.float32)
                start = time.monotonic()
                for i in range(0, len(sound), MIC_FRAME):
                    time.sleep(max(0, start + i / MIC_RATE - time.monotonic()))
                    device.hear(sound[i:i + MIC_FRAME])
            threading.Thread(target=mic, daemon=True).start()
        try:
            if args.script:
                device.run(args.script.read_text().splitlines()); time.sleep(0.5)
            else:
                print('Type to JP01 (/scene <steps>, /stop, /quit):', flush=True)
                for line in sys.stdin:
                    line = line.strip()
                    if line in ('/quit', '/exit'): break
                    if line == '/stop': device.stop()
                    elif line.startswith('/scene'): device.scene(line[len('/scene'):].strip())
                    elif line: device.text(line)
        except KeyboardInterrupt:
            pass
        report = {'agent_ready_s': round(ready, 1), 'parts': host.report,
                  'face': {'size': '64x64 rgb8', 'frames': face.frames, 'fps': face.fps, 'frames_while_speaking': talking['frames'], 'of_those_changed': talking['changed']},
                  'ring': {'size': '24x1 rgb8', 'frames': ring.frames, 'fps': ring.fps, 'changed': ring.changed},
                  'speaker': {'clips': speaker.clips, 'seconds': round(speaker.seconds, 1), 'stops': speaker.stops},
                  'head': {'moves': head.moves, 'reach_deg': [PAN_DEG, TILT_DEG]}}
        print(json.dumps(report, indent=1, default=str), flush=True)
        if args.out: (args.out / 'report.json').write_text(json.dumps(report, indent=1, default=str) + '\n')
        device.close()                                                      # the body goes with it, its panel too
        if log: log.close()


if __name__ == '__main__':
    main()
