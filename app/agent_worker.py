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


class TaggedStart(OpenAIAdapter):
    """Starts every reply on '[', the first acting tag. Gemma 4 otherwise spends 6 to 16 s planning in hidden
    reasoning before its first word; with the reply already begun it answers in under a second (measured on
    E4B in LM Studio, November 10). Tool-free turns only: a reply that must open with a tag can't be a tool call."""
    START = '['

    def format_messages(self, messages, tools, system):
        kw = super().format_messages(messages, tools, system)
        kw['messages'] = [*kw['messages'], {'role': 'assistant', 'content': self.START}]
        return kw

    def call(self, formatted, interrupt_event, *, on_delta=None, **kw):
        if on_delta: on_delta(self.START)
        return super().call(formatted, interrupt_event, on_delta=on_delta, **kw)

    def parse_response(self, raw):
        msg = super().parse_response(raw)
        if msg.get('content') is not None: msg['content'] = self.START + msg['content']   # history keeps the whole reply
        return msg
sessions={}; configs={}; active={}; lock=threading.RLock(); output_lock=threading.Lock()


def emit(data):
    with output_lock:
        wire.write(json.dumps(data)+'\n');wire.flush()


def turn(request):
    key=request['session']; rid=request['id']; fragments=[]
    try:
        with lock:
            agent=sessions.get(key)
            cfg={'model':os.environ.get('GEMMA_MODEL','google/gemma-4-e4b'),'max_tokens':700,'temperature':.7,'skip_thinking':True,**request.get('adapter',{})}
            adapter=lambda:(TaggedStart if cfg['skip_thinking'] else OpenAIAdapter)(provider='lmstudio',model=cfg['model'],
                base_url=os.environ.get('LMSTUDIO_URL','http://127.0.0.1:1234').rstrip('/')+'/v1',
                max_tokens=int(cfg['max_tokens']),temperature=float(cfg['temperature']),timeout_s=float(cfg.get('timeout_s',60)))
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
