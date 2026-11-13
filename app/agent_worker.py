"""Application host for the public JaegerAgent API, isolated from audio's Python.

The language model runs inside this process: JaegerAgent's llama.cpp adapter loads the GGUF file itself
(every layer on the GPU). There is no model server and no HTTP between the agent and its model."""
import json
import os
from pathlib import Path
import sys
import threading

os.environ['JAEGER_AGENT_NO_TOOLS']='1'
os.environ['JAEGER_AGENT_NO_SKILLS']='1'
# Keep stdout exclusively for the application's internal worker messages.
wire=sys.stdout
sys.stdout=sys.stderr
from jaeger_agent import JaegerAgent, LocalLlamaAdapter, AgentCallbacks
from jaeger_agent.core.workspace import ensure_bound
import models

ensure_bound(Path(__file__).resolve().parents[1]/'.jaeger_os/avatar')

sessions={}; active={}; lock=threading.RLock(); output_lock=threading.Lock()
engine={'key':None,'adapter':None}   # one model in memory, shared by every conversation
model_lock=threading.Lock()          # one model: one load or one reply at a time
DEFAULTS={'model':models.DEFAULT,'max_tokens':700,'temperature':.7,'skip_thinking':True,'timeout_s':60}


def emit(data):
    with output_lock:
        wire.write(json.dumps(data)+'\n');wire.flush()


def adapter_for(cfg):
    """The in-process model for these settings. Loads it (about 12 s) when the model or the thinking switch changes.
    Call with model_lock held."""
    key=(cfg['model'],bool(cfg['skip_thinking']))
    if engine['key']!=key:   # only then look on disk: the scan reads every model folder (about 0.75 s)
        found=models.found(); name=models.pick(cfg['model'],found)
        if name is None:raise RuntimeError('No model file (GGUF) was found on this machine')
        if engine['adapter']:engine['adapter'].close()   # free the old model before loading the next
        engine.update(key=None,adapter=None)
        # Thinking off is asked of the model's own chat template; a model without that switch is unaffected.
        engine.update(adapter=LocalLlamaAdapter(model=name,model_path=found[name],enable_thinking=False if key[1] else None),key=key)
        emit({'model':name})
    adapter=engine['adapter'];adapter.max_tokens=int(cfg['max_tokens']);adapter.temperature=float(cfg['temperature'])
    return adapter


def warm(request):
    """Load the model and run the character's instructions through it once, so the first reply doesn't wait for either."""
    try:
        with model_lock:adapter_for({**DEFAULTS,**request.get('adapter',{})}).warmup(system_prompt=request.get('system',''))
    except Exception as exc:
        print('warm-up failed:',exc,flush=True)


def turn(request):
    key=request['session']; rid=request['id']; fragments=[]
    try:
        cfg={**DEFAULTS,**request.get('adapter',{})}
        with model_lock:
            adapter=adapter_for(cfg)
            with lock:
                agent=sessions.get(key)
                if agent is None:
                    agent=sessions[key]=JaegerAgent(adapter=adapter,tools=[],max_iterations=1,system_prompt=request['system'])
                agent.primary_adapter=adapter   # Settings changed: same conversation, new model or limits
                agent.stale_call_timeout_s=float(cfg['timeout_s'])   # seconds without a new token before the call is stopped
                agent.system_prompt=request['system']
                def delta(text):
                    fragments.append(text);emit({'id':rid,'text':text})
                agent.callbacks=AgentCallbacks(stream_delta=delta)   # a listener: the adapter streams the reply as it is written
                active[key]=agent
            result=agent.run_turn(request['text'])
        if not fragments and result:emit({'id':rid,'text':result})
    except Exception as exc:
        emit({'id':rid,'error':str(exc)})
    finally:
        with lock:active.pop(key,None)
        emit({'id':rid,'done':True})


def schema():
    """JaegerAgent's own settings, straight from its config models, so the Settings page can't drift from them."""
    try:
        from importlib.metadata import version
        from jaeger_agent.core.config import AgentConfig, MultimodalConfig
        return {'version': version('jaeger-agent'), 'agent': AgentConfig.model_json_schema()['properties'],
                'multimodal': MultimodalConfig.model_json_schema()['properties']}
    except Exception as exc:
        return {'error': str(exc)}


emit({'ready':True,'schema':schema()})
for line in sys.stdin:
    try:
        r=json.loads(line); key=r.get('session','')
        with lock:
            if r.get('op')=='warm':
                threading.Thread(target=warm,args=(r,),daemon=True).start()
            elif r.get('op')=='interrupt':
                if active.get(key):active[key].interrupt()
            elif r.get('op')=='clear':
                if active.get(key):active[key].interrupt()
                sessions.pop(key,None)
            elif key in active:
                emit({'id':r['id'],'error':'The previous turn is still stopping. Try again.','done':True})
            else:
                # Reserve before the thread starts to prevent overlapping turns.
                active[key]=None
                threading.Thread(target=turn,args=(r,),daemon=True).start()
    except Exception as exc:print('Agent worker:',exc,file=sys.stderr)
