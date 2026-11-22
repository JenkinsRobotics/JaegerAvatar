"""This app's agent worker: the shared host (jaeger_avatar/embedded/agent_host.py), with this app's Python, its log,
and the older path's worker (app/agent_worker.py, JAEGER_AVATAR_LOOP=0)."""
import os
from pathlib import Path
import queue
import subprocess
import uuid

from jaeger_avatar.embedded.agent_host import AgentHost as Host

ROOT=Path(__file__).resolve().parents[1]


class AgentHost(Host):
    def __init__(self):
        super().__init__(log=ROOT/'app/.cache/agent.log',cwd=ROOT)

    def command(self,first):
        """With a first line it is the voice loop, which reads that line before loading; without, the older path's worker."""
        return super().command(first) if first else [str(self.python),'-u',str(ROOT/'app/agent_worker.py')]

    def start(self,first=None):
        self.python=Path(os.environ.get('JAEGER_AGENT_PYTHON',ROOT/'.agent-venv/bin/python'))
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
