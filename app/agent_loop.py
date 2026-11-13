"""Jaeger Agent's voice loop as this app's talker: hearing, the model with its tools, and the voice, in one process.

The agent takes its hearing and voice from the Jaeger modules; this app copies none of it. The app sends typed
text and microphone sound in, and gets words and voice sound out (it plays them and moves the mouth itself).
The agent moves the body through its `avatar` tool, which asks the app over the same pipe.

A scene (lines with moves timed to them) is performed by the agent too: it reads the script, voices each line, and sends
each line's moves with its sound as cues. The app plays the sound and, when a cue's moment comes on the sound's own clock,
says so; the move is then made by the same `avatar` tool the model calls. The model can write a scene itself with its
`scene` tool; the agent performs it once that reply's words are spoken.

In (one JSON line each): {op: start, ...} first, then {op: text | audio | persona | interrupt | control_result | say | scene | cue}.
Out: {ready, schema, model, report}, {event, text, data}, {event: audio, text, rate, pcm, marks, cues}, {event: done}, {control, id},
{id, rate, pcm, marks, ms} (the answer to say), {report} (after a voice change), {event: scene, text: begin | end} (around a scene's sound), {event: scene, text: refused, data} (a script it could not read).
"""
import base64
import json
import os
import queue
import sys
import threading
import time
import uuid
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TURN = {'user', 'assistant', 'audio'}     # the engine did one of these: a turn happened, so it ends with 'done'
CONTROL_WAIT = 3                          # seconds the avatar tool waits for the app to answer


class Loop:
    """One engine, one thread: work arrives in order; an interrupt cuts in from the reader's thread."""

    def __init__(self, emit):
        self.emit, self.engine = emit, None
        self.work, self.busy, self.waiting = queue.Queue(), threading.Event(), {}
        self.typed = self.turn = False
        self.hint = ''                        # one avatar call in the loaded model's own form, added to every persona
        self.extra = {}                       # what this worker adds to the engine's report: which tool list, the load time

    def report(self):
        """What each part runs on right now, as the engine says it."""
        return {**self.engine.report(), **self.extra}

    def on_event(self, e):
        if e.kind == 'user' and self.typed: return          # the page already showed what was typed
        if e.kind in TURN: self.turn = True
        if e.kind == 'audio':
            pcm = (np.clip(e.data, -1, 1) * 32767).astype('<i2').tobytes()
            self.emit({'event': 'audio', 'text': e.text, 'rate': self.engine.sample_rate, 'pcm': base64.b64encode(pcm).decode(),
                       'marks': [list(m) for m in getattr(e.data, 'marks', [])],   # when the lips close or tuck, from the voice module
                       'cues': list(getattr(e.data, 'cues', []))})                  # a scene's moves, timed from this sound's start
        else:
            self.emit({'event': e.kind, 'text': e.text, 'data': e.data})

    def control(self, op, value, ttl_ms):
        """The avatar tool's send: ask the app, wait for its answer."""
        rid = uuid.uuid4().hex
        box = self.waiting[rid] = queue.Queue()
        self.emit({'control': {'op': op, 'value': value, 'ttl_ms': ttl_ms}, 'id': rid})
        try: answer = box.get(timeout=CONTROL_WAIT)
        except queue.Empty: answer = {'ok': False, 'error': 'The avatar did not answer'}
        finally: self.waiting.pop(rid, None)
        self.emit({'event': 'tool', 'text': f'avatar {op}', 'data': {'value': value, 'result': answer}})   # shown in the Data flow window
        return answer

    def receive(self, r):
        """Called on the reader's thread for each line from the app; None means the app has gone."""
        op = r and r.get('op')
        if op == 'control_result':
            box = self.waiting.get(r.get('id'))
            if box: box.put(r.get('result') or {})
        elif op == 'interrupt':
            self.engine.force_listen()
        elif op == 'cue':                     # its moment has come: it cannot wait behind the lines still being voiced
            threading.Thread(target=self.cue, args=(r.get('call'),), daemon=True).start()
        else:
            if op == 'text' and self.busy.is_set(): self.engine.force_listen()   # typed over a reply: stop it, then answer
            self.work.put(r)

    def fitter(self, strict):
        """The body's say on each call a scene will make, for the engine to ask before the scene starts, and the list
        it fills with what it left out. The body is asked once what it offers; with nobody on stage, calls pass as
        written. strict (your own scene): a call the body cannot make in full refuses the scene, so you fix the script.
        Not strict (a scene the model wrote): the scene plays without those parts, and the model is told which."""
        from jaeger_avatar.embedded.agent_tools import fitted
        answer = self.control('offers', None, 0)
        offers, left = answer.get('offers') if answer.get('ok') else None, []
        def fit(call):
            if not offers: return call
            kept, wrong = fitted(call, offers)
            if wrong and strict: raise ValueError('This body cannot do ' + '; '.join(wrong) + '.')
            left.extend(wrong)
            return kept
        return fit, left

    def stage(self, script):
        """The scene tool's stage: the engine takes the model's script, to perform once this reply's words are spoken.
        Returns what was left out of it because the body cannot do it."""
        fit, left = self.fitter(strict=False)
        try:
            lines = self.engine.stage(script, fit=fit)
        except ValueError as exc:
            self.emit({'event': 'tool', 'text': 'scene', 'data': {'value': script, 'result': {'ok': False, 'error': str(exc)}}})
            raise
        self.emit({'event': 'tool', 'text': 'scene', 'data': {'value': script, 'result': {'ok': True, 'lines': lines, 'left_out': left}}})   # shown in the Data flow window
        return left

    def cue(self, call):
        """A scene's move: the avatar tool's own call, held for as long as the scene says (or as long as a call from the model)."""
        from jaeger_avatar.embedded.agent_tools import avatar_tool
        call = dict(call or {})
        hold = call.pop('hold', None)
        try:
            send = self.control if hold is None else lambda op, value, _ttl: self.control(op, value, int(float(hold) * 1000))
            answer = avatar_tool(send)(**call)
        except Exception as exc:
            answer = {'ok': False, 'errors': [str(exc)]}
        if not answer.get('ok'):              # each move the body took or refused is already reported by control()
            self.emit({'event': 'tool', 'text': 'avatar cue', 'data': {'value': call, 'result': answer}})

    def say(self, r):
        """One line through the agent's voice alone, no model. The answer goes to whoever asked, by id; no turn happens."""
        began, voice, rate = time.time(), r.get('voice'), self.engine.sample_rate
        try:
            parts, marks, at = [], [], 0
            for part in self.engine.synth(str(r.get('text', '')), **({'voice': voice} if voice else {})):
                marks += [[round(a + at / rate, 3), round(b + at / rate, 3), kind] for a, b, kind in getattr(part, 'marks', [])]   # timed from the clip's start
                parts.append(np.asarray(part, dtype=np.float32)); at += len(part)
            pcm = (np.clip(np.concatenate(parts) if parts else np.zeros(0, np.float32), -1, 1) * 32767).astype('<i2').tobytes()
            self.emit({'id': r.get('id'), 'rate': rate, 'pcm': base64.b64encode(pcm).decode(), 'marks': marks,
                       'ms': round((time.time() - began) * 1000, 1)})
        except Exception as exc:
            self.emit({'id': r.get('id'), 'error': str(exc)})

    def run(self):
        while (r := self.work.get()) is not None:
            op = r.get('op')
            self.typed = self.turn = op in ('text', 'scene')   # a typed turn or a scene always ends with 'done': the page is waiting
            self.busy.set()
            try:
                if op == 'text': self.engine.send_text(str(r.get('text', '')))
                elif op == 'audio': self.engine.push_audio(np.frombuffer(base64.b64decode(r['pcm']), '<i2').astype(np.float32) / 32768)
                elif op == 'persona':   # who it is now, and (when the app names one) the character's voice in the same voice module
                    voice = r.get('voice')
                    self.engine.switch_session(r['session'], r.get('persona', '') + self.hint, **({'voice': voice} if voice else {}))
                    if voice: self.emit({'report': self.report()})
                elif op == 'say': self.say(r)
                elif op == 'scene': self.engine.perform(r.get('script'), fit=self.fitter(strict=True)[0])
            except Exception as exc:
                self.turn = True
                if op == 'scene' and isinstance(exc, ValueError): self.emit({'event': 'scene', 'text': 'refused', 'data': str(exc)})   # a script it could not read: the director is told, nothing is said
                else: self.emit({'event': 'status', 'text': f'error: {exc}'})
            finally:
                self.busy.clear()
                if self.turn: self.emit({'event': 'done'})
                self.typed = self.turn = False


def call_hint(engine):
    """One avatar call the way the loaded model writes its calls: with it the small model moved the body on every turn, without it on few."""
    example = engine.call_example('avatar', {'emotion': 'joy'})
    return f' The call looks like this: {example}' if example else ''


def schema():
    try:
        from importlib.metadata import version
        from jaeger_agent.core.config import AgentConfig, MultimodalConfig
        return {'version': version('jaeger-agent'), 'agent': AgentConfig.model_json_schema()['properties'],
                'multimodal': MultimodalConfig.model_json_schema()['properties']}
    except Exception as exc:
        return {'error': str(exc)}


def main():
    # The short tool list: the model reads ~15,000 tokens of tool text at start-up with every tool shown
    # (about 48 s here against about 15 s). JAEGER_FULL_TOOLS=1 shows every tool.
    os.environ.setdefault('JAEGER_TOOLSET_SCOPING', '1')
    wire = os.fdopen(os.dup(1), 'w')                         # the app's pipe; everything else that prints goes to the log
    os.dup2(2, 1); sys.stdout = sys.stderr
    lock = threading.Lock()

    def emit(data):
        with lock:
            wire.write(json.dumps(data, default=str) + '\n'); wire.flush()

    start = json.loads(sys.stdin.readline() or '{}')
    sys.path.insert(0, str(ROOT))
    from jaeger_agent import register_tool_from_function
    from jaeger_agent.core.config import MultimodalConfig
    from jaeger_agent.core.engine import GemmaMultimodal
    from jaeger_agent.core.workspace import ensure_bound
    from jaeger_avatar.embedded.agent_tools import avatar_tool, scene_tool
    import models

    ensure_bound(ROOT / '.jaeger_os/avatar')
    found = models.found()
    name = models.pick(start.get('model'), found)
    if not name: raise SystemExit('No model file (GGUF) was found on this machine')
    loop = Loop(emit)
    register_tool_from_function(avatar_tool(loop.control), name='avatar', side_effect='gesture')   # the agent ends the turn on words + a gesture
    register_tool_from_function(scene_tool(loop.stage), name='scene', side_effect='performance')   # the scene is the reply: no second model call to narrate it
    began = time.time()
    # Speech only, no wake word, no speaker of its own: the page plays the sound and moves the mouth.
    engine = loop.engine = GemmaMultimodal(
        on_event=loop.on_event, play=False, audio_mode='plain', output_mode='speech', extra_prompt=start.get('persona', ''),
        config=MultimodalConfig(audio_mode='plain', output_mode='speech', wake_required=False,
                                stt_model=start.get('hearing', 'large-v3-turbo'), session_key=start.get('session', 'avatar')),
        runtime_config={'model_path': str(found[name]), 'model': name,
                        **{k: start[k] for k in ('max_tokens', 'temperature', 'timeout_s') if k in start}})
    engine.load()                                            # on this, the main thread: the MLX voice crashes at exit otherwise
    loop.hint = call_hint(engine)
    print('avatar call shown to the model:', loop.hint.strip() or 'none (call form not known)', file=sys.stderr)
    loop.extra = {'tool_list': 'every tool' if os.environ.get('JAEGER_FULL_TOOLS') == '1' or os.environ['JAEGER_TOOLSET_SCOPING'] != '1' else 'short list',
                  'load_s': round(time.time() - began, 1)}
    emit({'ready': True, 'schema': schema(), 'model': name, 'report': loop.report()})

    def read():
        for line in sys.stdin:
            try: loop.receive(json.loads(line))
            except Exception as exc: print('bad line from the app:', exc, file=sys.stderr)
        loop.receive(None)

    threading.Thread(target=read, daemon=True).start()
    loop.run()
    engine.close()


if __name__ == '__main__':
    main()
