"""Application host for the public JaegerAgent API, isolated from audio's Python."""
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
from jaeger_agent import JaegerAgent, OpenAIAdapter, AgentCallbacks
from jaeger_agent.core.workspace import ensure_bound

ensure_bound(Path(__file__).resolve().parents[1]/'.jaeger_os/avatar')
sessions={}; configs={}; active={}; lock=threading.RLock(); output_lock=threading.Lock()


def emit(data):
    with output_lock:
        wire.write(json.dumps(data)+'\n');wire.flush()


def turn(request):
    key=request['session']; rid=request['id']; fragments=[]
    try:
        with lock:
            agent=sessions.get(key)
            cfg={'model':os.environ.get('GEMMA_MODEL','google/gemma-4-e4b'),'max_tokens':700,'temperature':.7,**request.get('adapter',{})}
            adapter=lambda:OpenAIAdapter(provider='lmstudio',model=cfg['model'],
                base_url=os.environ.get('LMSTUDIO_URL','http://127.0.0.1:1234').rstrip('/')+'/v1',
                max_tokens=int(cfg['max_tokens']),temperature=float(cfg['temperature']),timeout_s=60)
            if agent is None:
                agent=JaegerAgent(adapter=adapter(),tools=[],max_iterations=1,system_prompt=request['system'])
                sessions[key]=agent;configs[key]=cfg
            elif configs.get(key)!=cfg:   # Settings changed: same conversation, new model or limits
                agent.primary_adapter=adapter();configs[key]=cfg
            agent.system_prompt=request['system']
            def delta(text):
                fragments.append(text);emit({'id':rid,'text':text})
            agent.callbacks=AgentCallbacks(stream_delta=delta)
            active[key]=agent
        result=agent.run_turn(request['text'])
        if not fragments and result:emit({'id':rid,'text':result})
    except Exception as exc:
        emit({'id':rid,'error':str(exc)})
    finally:
        with lock:active.pop(key,None)
        emit({'id':rid,'done':True})


emit({'ready':True})
for line in sys.stdin:
    try:
        r=json.loads(line); key=r.get('session','')
        with lock:
            if r.get('op')=='interrupt':
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
