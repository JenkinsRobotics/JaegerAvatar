"""A body with a speaker and a microphone, connected to Jaeger Agent. No browser: this is what Mochi and JP01 are to the agent.

    controller = Controller(manifest)                         # the body: its face is drawn from this controller's state
    device = Device(controller, AgentHost(python), who='You are Mochi, ...', speaker=Speaker())
    device.start()                                            # the agent loads; device.ready says when
    device.text('Hello')        device.scene('say Hi. | listen')        device.hear(mic_frame)        device.stop()

The agent sends each spoken line as sound with its lip marks and its cues (a scene's moves, each with its moment in
the clip). The Player plays the sound, opens the mouth with how loud the voice is, and tells the agent when a cue's
moment has come; the agent's avatar tool then makes the move through this same controller.

Turn-taking is the agent's, not this file's. Every microphone frame goes to the agent. A bare speaker and microphone
have no echo canceller, so the agent runs its own half duplex: it shuts its ears from her first word until this
device says its speaker has played her last ('voiced' from the agent, 'played' back). open_mic=True is for a device
that has an echo canceller: the agent then keeps hearing, and a person can talk over her.
"""
import base64
import queue
import threading
import time

import numpy as np

from .agent_tools import controller_transport
from .persona import persona

HOP_S = 0.02                              # the mouth follows the voice in 20 ms steps
STATE = {'thinking': 'thinking', 'hearing you': 'listening'}   # the agent's state -> the activity the character's pack gives a feeling for


def track(samples, rate, marks=(), cues=(), hop_s=HOP_S):
    """A clip as what the body does while it plays: [(seconds from its start, mouth opening 0..1 or None in a quiet
    stretch, the cue calls whose moment has come)]. The mouth opens with loudness against the clip's own loudest
    moment and closes on a lip mark (m, b, p). A cue lands on the first step at or after its moment."""
    hop = max(1, int(rate * hop_s)); n = len(samples) // hop
    level = np.sqrt(np.mean(np.asarray(samples[:n * hop], dtype=np.float32).reshape(n, hop) ** 2, axis=1)) if n else np.zeros(0)
    peak, due, steps = float(level.max()) if n else 0.0, sorted(cues, key=lambda c: c['at']), []
    for i in range(max(n, 1)):
        t, calls = i * hop / rate, []
        while due and due[0]['at'] <= t + 1e-9: calls.append(due.pop(0)['call'])
        shut = any(a <= t < b and kind == 'p' for a, b, kind in marks)
        steps.append((t, None if peak <= 0 else 0 if shut else round(float((level[i] / peak) ** 0.7), 3), calls))
    steps[-1][2].extend(c['call'] for c in due)   # a cue timed past the last step is still made
    return steps


class Speaker:
    """This computer's speaker. A robot gives its own: anything with play(samples, rate) (which returns at once) and stop()."""
    def play(self, samples, rate):
        import sounddevice
        sounddevice.play(samples, rate)

    def stop(self):
        import sounddevice
        sounddevice.stop()


class Player:
    """Plays the agent's clips in order on the speaker's clock. control(op, value, ttl_ms) moves the mouth;
    cue(call) is told each scene move as its moment comes. delay_s: how long the speaker takes to sound what it is
    handed (its buffer, a network hop), so mouth and moves wait that long too. Only the real device can say."""

    def __init__(self, control, cue, speaker=None, delay_s=0.0):
        self.control, self.cue, self.speaker, self.delay_s = control, cue, speaker, delay_s
        self.lock, self.clips, self.held, self.holding, self.playing, self.turn = threading.Lock(), queue.Queue(), [], False, False, 0
        self.left = 0                                        # clips taken in and not yet played out: the agent's microphone opens on this reaching 0
        self.idle = threading.Event(); self.idle.set()
        threading.Thread(target=self._play, daemon=True).start()

    @property
    def busy(self): return not self.idle.is_set()

    def wait(self, timeout=None): return self.idle.wait(timeout)

    def on_event(self, e):
        kind, text = e.get('event'), e.get('text')
        if kind == 'audio':
            samples = np.frombuffer(base64.b64decode(e['pcm']), '<i2').astype(np.float32) / 32768
            with self.lock:
                clip = (self.turn, samples, e['rate'], e.get('marks') or [], e.get('cues') or [])
                self.held.append(clip) if self.holding else self.clips.put(clip)
                self.left += 1; self.idle.clear()
        elif kind == 'scene' and text == 'begin':            # a scene's clips are held until every line is voiced, so no gap waits on a line
            with self.lock: self.holding = True; self.idle.clear()
        elif (kind == 'scene' and text == 'end') or kind in ('done', 'voiced'):   # 'voiced': the agent waits to hear this part has been played
            with self.lock:
                for clip in self.held: self.clips.put(clip)
                self.held, self.holding = [], False
                self._settle()

    def _settle(self):
        if not self.left and not self.holding: self.idle.set()

    def stop(self):
        """End what is playing and drop what was waiting."""
        with self.lock:
            self.turn += 1; self.held, self.holding, self.left = [], False, 0
            while not self.clips.empty(): self.clips.get_nowait()
            playing = self.playing
            self._settle()
        if playing and self.speaker: self.speaker.stop()

    def close(self):
        self.stop(); self.clips.put(None)

    def _tell(self, op, value, ttl_ms):
        try: self.control(op, value, ttl_ms)
        except Exception: pass                               # a body that refuses a mouth move still hears the line out

    def _play(self):
        while (clip := self.clips.get()) is not None:
            turn, samples, rate, marks, cues = clip
            with self.lock:
                if turn != self.turn: continue
                self.playing = True
            if self.speaker: self.speaker.play(samples, rate)
            start, spoke = time.monotonic() + self.delay_s, False
            for t, mouth, calls in [*track(samples, rate, marks, cues), (len(samples) / rate, None, [])]:
                while turn == self.turn and (left := start + t - time.monotonic()) > 0: time.sleep(min(left, 0.05))
                if turn != self.turn: break
                for call in calls: self.cue(call)
                if mouth is not None:
                    self._tell('speaking', True, 1000); self._tell('jaw', mouth, 300); spoke = True
            if spoke: self._tell('speaking', False, 1000)
            with self.lock:
                self.playing = False
                if turn == self.turn: self.left -= 1         # a clip that was stopped is already counted out
                self._settle()


class Device:
    """The body (its Controller), a speaker and a microphone, connected to the agent through an AgentHost."""

    def __init__(self, controller, host, *, who=None, body=None, speaker=None, session='device', hearing='large-v3-turbo', workspace=None,
                 show=print, on_event=None, delay_s=0.0, open_mic=False, **start):
        self.controller, self.host, self.show, self.on_event = controller, host, show, on_event
        if open_mic: start['open_mic'] = True                # this device has an echo canceller: the agent keeps hearing while she speaks
        self.turns = threading.Semaphore(0)                  # one for each turn the agent has finished
        m = controller.manifest
        self.name, self.activity = m.get('name') or m['avatar'], m.get('activity') or {}
        character = m.get('character') or {}           # who the character is and its voice, as its bundle says (a host may say otherwise)
        who = who or character.get('who') or f'You are {self.name}, an AI character.'
        if character.get('voice'): start.setdefault('voice', character['voice'])
        self.control = controller_transport(controller)
        self.player = Player(self.control, lambda call: self._send({'op': 'cue', 'call': call}), speaker, delay_s)
        self.first = {'op': 'start', 'persona': persona(who, body or self.name, self.control('offers', None, 0)['offers']), 'session': session,
                      'hearing': hearing, **({'workspace': str(workspace)} if workspace else {}), **start}

    @property
    def ready(self): return self.host.ready

    def start(self):
        self.host.on_control = self.control                  # the agent's avatar tool moves this body
        self.events = self.host.listen()
        self.host.start(self.first)
        threading.Thread(target=self._listen, daemon=True).start()

    def _send(self, data):
        try: self.host.send(data)
        except RuntimeError: pass                            # the agent is still loading, or has stopped: the host shows which

    def _listen(self):
        while (e := self.events.get()) is not None:
            kind, text = e.get('event'), e.get('text') or ''
            self.player.on_event(e)
            if kind == 'voiced': threading.Thread(target=self._played, args=(e.get('n'),), daemon=True).start()
            if kind == 'state' and self.activity.get(STATE.get(text)): self.control('emotion', self.activity[STATE[text]], 4000)
            elif kind == 'user': self.show(f'You: {text}')
            elif kind == 'assistant' and text: self.show(f'{self.name}: {text}')
            elif kind == 'scene' and text == 'listen': self.show(f"Your line: “{e['data']['expect']}”" if (e.get('data') or {}).get('expect') else 'Your turn')
            elif kind == 'scene' and text == 'refused': self.show(f"Scene refused: {e.get('data')}")
            elif kind == 'status' and text.startswith('error'): self.show(text)
            if kind == 'done': self.turns.release()
            if self.on_event: self.on_event(e)

    def text(self, words):
        """Typed words: what she was saying stops, as it does when a person talks over her."""
        self.player.stop(); self._send({'op': 'text', 'text': words})

    def scene(self, script):
        self.player.stop(); self._send({'op': 'scene', 'script': script})

    def _played(self, n):
        """The agent has voiced a part and keeps its microphone shut until the speaker has played it: say when.
        The Player's clock includes delay_s, so a slow speaker is waited for."""
        self.player.wait(); self._send({'op': 'played', 'n': n})

    def hear(self, frame):
        """Microphone sound: 16 kHz mono floats, any length. All of it goes to the agent, which shuts its own ears while she speaks."""
        self._send({'op': 'audio', 'pcm': base64.b64encode((np.clip(frame, -1, 1) * 32767).astype('<i2').tobytes()).decode()})

    def run(self, rows, wait_s=120):
        """A run with nobody at the keyboard: rows of "say: words", "scene: steps" or "sleep: seconds", each sent once the
        turn before it has ended and the last of it has been played."""
        for row in rows:
            kind, _, value = row.partition(':')
            kind, value = kind.strip(), value.strip()
            if not value or kind.startswith('#'): continue
            if kind == 'sleep': time.sleep(float(value)); continue
            while self.turns.acquire(blocking=False): pass
            (self.text if kind == 'say' else self.scene)(value)
            self.turns.acquire(timeout=wait_s)               # the agent has finished the turn
            time.sleep(0.2); self.player.wait(wait_s)        # and the device has played the last of it

    def stop(self):
        """Stop: the reply or the scene ends, and a scene that was waiting for its other line is over."""
        self._send({'op': 'interrupt'}); self.player.stop()

    def close(self):
        self.player.close(); self.host.close()
