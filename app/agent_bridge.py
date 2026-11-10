"""Own the agent worker lifecycle; no agent internals are copied into Avatar."""
import atexit
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import uuid

ROOT=Path(__file__).resolve().parents[1]


class AgentHost:
    def __init__(self):
        self.process=None;self.ready=False;self.schema=None;self.pending={};self.lock=threading.RLock()
        atexit.register(self.close)

    def start(self):
        python=Path(os.environ.get('JAEGER_AGENT_PYTHON',ROOT/'.agent-venv/bin/python'))
        if not python.is_file():return
        log=ROOT/'app/.cache/agent.log';log.parent.mkdir(parents=True,exist_ok=True)
        with log.open('ab') as out:
            self.process=subprocess.Popen([str(python),'-u',str(ROOT/'app/agent_worker.py')],
                cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=out,text=True,bufsize=1)
        threading.Thread(target=self._read,daemon=True).start()

    def _read(self):
        for line in self.process.stdout:
            try:data=json.loads(line)
            except ValueError:continue
            with self.lock:
                if data.get('ready'):self.ready=True;self.schema=data.get('schema')
                target=self.pending.get(data.get('id'))
                if target:target.put(data)
        with self.lock:
            self.ready=False
            for target in self.pending.values():target.put({'error':'Agent worker stopped','done':True})

    def send(self,data):
        with self.lock:
            if not self.ready:raise RuntimeError('JaegerAgent is not ready')
            self.process.stdin.write(json.dumps(data)+'\n');self.process.stdin.flush()

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

    def interrupt(self,session):
        if self.ready:self.send(dict(op='interrupt',session=session))

    def close(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
        self.ready=False


agent_host=AgentHost()
