"""This app's side of the agent: start Jaeger Agent's worker, talk to it, close it.

The worker is the agent's own (jaeger-module-agent, jaeger_agent/body/loop.py), run in the agent's Python (.agent-venv),
which is not this app's: so this side is plain standard library and one JSON line each way (that file lists them). The
agent brings its own model, voice, hearing, tools and turn-taking; this app tells it who the character is, which body is
on stage and what it offers, and gives it the microphone and the page to move.

    host.on_control = send                                  # the agent's avatar tool moves the body on stage
    host.start({'op': 'start', 'who': ..., 'body': ..., 'offers': ..., 'session': ..., 'open_mic': True})
    events = host.listen()                                  # words, voice sound with its lip marks and cues, scene notes
    host.send({'op': 'text', 'text': 'Hello'})

AgentHost below adds this app's Python, its log, and the older path's worker (app/agent_worker.py, JAEGER_AVATAR_LOOP=0).
"""
import atexit
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import uuid

DEFAULT_WORKER = 'jaeger_agent.body.loop'   # Jaeger Agent's voice loop; JAEGER_AGENT_WORKER=jaeger_omni_v2.avatar_loop for Omni
WORKER = os.environ.get('JAEGER_AGENT_WORKER', DEFAULT_WORKER)
OMNI_V2_PYTHON = Path.home() / 'GITHUB/jaeger-module-omni/.venv/bin/python'


class Host:
    def __init__(self, python=None, log=None, cwd=None):
        self.python, self.log, self.cwd = python, log, cwd
        self.process = None; self.ready = False; self.schema = None; self.model = None; self.pending = {}; self.lock = threading.RLock()
        self.why = ''; self.report = None; self.listeners = set(); self.on_control = None   # what it runs on, who hears its events, who moves the avatar
        atexit.register(self.close)

    def command(self, first):
        """What to run: Jaeger Agent's own voice loop by default (`JAEGER_AGENT_WORKER` overrides)."""
        worker = os.environ.get('JAEGER_AGENT_WORKER', WORKER)
        return [str(self.python), '-u', '-m', worker]

    def start(self, first=None):
        """Start the worker; it reads `first` (its start line) before loading. Nothing starts without that Python."""
        if not self.python or not Path(self.python).is_file(): return
        self.why = ''
        if self.log: Path(self.log).parent.mkdir(parents=True, exist_ok=True)
        with (open(self.log, 'ab') if self.log else open(os.devnull, 'wb')) as out:
            self.process = process = subprocess.Popen(self.command(first), cwd=self.cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=out, text=True, bufsize=1)
        if first: process.stdin.write(json.dumps(first) + '\n'); process.stdin.flush()
        threading.Thread(target=self._read, args=(process,), daemon=True).start()

    def restart(self, first=None):
        self.close(); self.start(first)

    def listen(self):
        """A queue that gets every voice loop event from now on; give it back with unlisten."""
        q = queue.Queue()
        with self.lock: self.listeners.add(q)
        return q

    def unlisten(self, q):
        with self.lock: self.listeners.discard(q)

    def _tell(self, event):
        with self.lock:
            for q in self.listeners: q.put(event)

    def _read(self, process=None):
        process = process or self.process
        for line in process.stdout:
            try: data = json.loads(line)
            except ValueError: continue
            if 'control' in data:   # the agent's avatar tool asks; the answer goes back on the same pipe
                c = data['control']
                try: result = self.on_control(c.get('op'), c.get('value'), c.get('ttl_ms'))
                except Exception as exc: result = {'ok': False, 'error': str(exc) if self.on_control else 'No avatar attached'}
                with self.lock: process.stdin.write(json.dumps({'op': 'control_result', 'id': data.get('id'), 'result': result}) + '\n'); process.stdin.flush()
                continue
            if 'event' in data: self._tell(data); continue
            with self.lock:
                if data.get('ready'): self.ready = True; self.schema = data.get('schema'); self.report = data.get('report')
                elif 'report' in data: self.report = data['report']   # the loop's voice changed: what it runs on now
                if data.get('why'): self.why = data['why']   # why the worker is about to stop, in its words
                if data.get('model'): self.model = data['model']   # the model file now loaded in the worker
                target = self.pending.get(data.get('id'))
                if target: target.put(data)
        with self.lock:
            if self.process is not process: return   # an old worker ending after a restart
            self.ready = False
            for target in self.pending.values(): target.put({'error': 'Agent worker stopped', 'done': True})
        self._tell({'event': 'status', 'text': 'The agent stopped'}); self._tell({'event': 'done'})

    def send(self, data):
        with self.lock:
            if not self.ready: raise RuntimeError('JaegerAgent is not ready')
            self.process.stdin.write(json.dumps(data) + '\n'); self.process.stdin.flush()

    def ask(self, data, timeout=60):
        """Send a line that is answered by one line with the same id, and return that answer."""
        rid = uuid.uuid4().hex; target = queue.Queue()
        with self.lock: self.pending[rid] = target
        try:
            self.send({**data, 'id': rid})
            try: item = target.get(timeout=timeout)
            except queue.Empty: raise RuntimeError('The agent did not answer')
            if item.get('error'): raise RuntimeError(item['error'])
            return item
        finally:
            with self.lock: self.pending.pop(rid, None)

    def say(self, text, voice=None, timeout=60):
        """One line through the voice loop's own voice (or `voice`, for this line), no model: {rate, pcm, marks, ms}."""
        return self.ask(dict(op='say', text=text, voice=voice), timeout)

    def close(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try: self.process.wait(timeout=3)
            except subprocess.TimeoutExpired: self.process.kill(); self.process.wait()
        self.ready = False


ROOT=Path(__file__).resolve().parents[1]


class AgentHost(Host):
    def __init__(self):
        super().__init__(log=ROOT/'app/.cache/agent.log',cwd=ROOT)

    def command(self,first):
        """With a first line it is the voice loop, which reads that line before loading; without, the older path's worker."""
        return super().command(first) if first else [str(self.python),'-u',str(ROOT/'app/agent_worker.py')]

    def start(self,first=None):
        env_py = os.environ.get('JAEGER_AGENT_PYTHON', '').strip()
        if env_py:
            self.python = Path(env_py)
        else:
            worker = os.environ.get('JAEGER_AGENT_WORKER', WORKER)
            if worker.startswith('jaeger_omni_v2') and OMNI_V2_PYTHON.is_file():
                self.python = OMNI_V2_PYTHON
            else:
                self.python = ROOT / '.agent-venv/bin/python'
        super().start(first)

    def stream(self,text,system,session,adapter=None):
        rid=uuid.uuid4().hex;target=queue.Queue()
        with self.lock:self.pending[rid]=target
        try:
            self.send(dict(op='turn',id=rid,text=text,system=system,session=session,adapter=adapter or {}))
            while True:
                item=target.get(timeout=90)
                if item.get('error'):raise RuntimeError(item['error'])
                if item.get('text'):yield item['text']
                if item.get('done'):break
        finally:
            with self.lock:self.pending.pop(rid,None)

    def warm(self,system,adapter):
        """Load the model now and run these instructions through it, so the first reply waits for neither."""
        if self.ready:self.send(dict(op='warm',system=system,adapter=adapter))

    def interrupt(self,session):
        if self.ready:self.send(dict(op='interrupt',session=session))


agent_host=AgentHost()
