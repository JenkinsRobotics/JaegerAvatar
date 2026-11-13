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
        self.process=None;self.ready=False;self.schema=None;self.model=None;self.pending={};self.lock=threading.RLock()
        self.report=None;self.listeners=set();self.on_control=None   # the voice loop: what it runs on, who hears its events, who moves the avatar
        atexit.register(self.close)

    def start(self,first=None):
        """Start the worker. With a first line it is the voice loop (agent_loop.py), which reads that line before loading."""
        python=Path(os.environ.get('JAEGER_AGENT_PYTHON',ROOT/'.agent-venv/bin/python'))
        if not python.is_file():return
        log=ROOT/'app/.cache/agent.log';log.parent.mkdir(parents=True,exist_ok=True)
        with log.open('ab') as out:
            self.process=process=subprocess.Popen([str(python),'-u',str(ROOT/('app/agent_loop.py' if first else 'app/agent_worker.py'))],
                cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=out,text=True,bufsize=1)
        if first:process.stdin.write(json.dumps(first)+'\n');process.stdin.flush()
        threading.Thread(target=self._read,args=(process,),daemon=True).start()

    def restart(self,first=None):
        self.close();self.start(first)

    def listen(self):
        """A queue that gets every voice loop event from now on; give it back with unlisten."""
        q=queue.Queue()
        with self.lock:self.listeners.add(q)
        return q

    def unlisten(self,q):
        with self.lock:self.listeners.discard(q)

    def _tell(self,event):
        with self.lock:
            for q in self.listeners:q.put(event)

    def _read(self,process=None):
        process=process or self.process
        for line in process.stdout:
            try:data=json.loads(line)
            except ValueError:continue
            if 'control' in data:   # the agent's avatar tool asks; the answer goes back on the same pipe
                c=data['control']
                try:result=self.on_control(c.get('op'),c.get('value'),c.get('ttl_ms'))
                except Exception as exc:result={'ok':False,'error':str(exc) if self.on_control else 'No avatar attached'}
                with self.lock:process.stdin.write(json.dumps({'op':'control_result','id':data.get('id'),'result':result})+'\n');process.stdin.flush()
                continue
            if 'event' in data:self._tell(data);continue
            with self.lock:
                if data.get('ready'):self.ready=True;self.schema=data.get('schema');self.report=data.get('report')
                elif 'report' in data:self.report=data['report']   # the loop's voice changed: what it runs on now
                if data.get('model'):self.model=data['model']   # the model file now loaded in the worker
                target=self.pending.get(data.get('id'))
                if target:target.put(data)
        with self.lock:
            if self.process is not process:return   # an old worker ending after a restart
            self.ready=False
            for target in self.pending.values():target.put({'error':'Agent worker stopped','done':True})
        self._tell({'event':'status','text':'The agent stopped'});self._tell({'event':'done'})

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

    def say(self,text,voice=None,timeout=60):
        """One line through the voice loop's own voice (or `voice`, for this line), no model: {rate, pcm, marks, ms}."""
        rid=uuid.uuid4().hex;target=queue.Queue()
        with self.lock:self.pending[rid]=target
        try:
            self.send(dict(op='say',id=rid,text=text,voice=voice))
            try:item=target.get(timeout=timeout)
            except queue.Empty:raise RuntimeError('The voice did not answer')
            if item.get('error'):raise RuntimeError(item['error'])
            return item
        finally:
            with self.lock:self.pending.pop(rid,None)

    def warm(self,system,adapter):
        """Load the model now and run these instructions through it, so the first reply waits for neither."""
        if self.ready:self.send(dict(op='warm',system=system,adapter=adapter))

    def interrupt(self,session):
        if self.ready:self.send(dict(op='interrupt',session=session))

    def close(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
        self.ready=False


agent_host=AgentHost()
