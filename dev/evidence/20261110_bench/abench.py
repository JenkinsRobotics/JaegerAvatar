# Same turn three ways: (A) the app today, Jaeger Agent -> LM Studio over HTTP; (B) Jaeger Agent in-process
# (LocalLlamaAdapter); (C) the same in-process llama.cpp model called directly with streaming on.
import os, sys, time
from pathlib import Path
os.environ['JAEGER_AGENT_NO_TOOLS'] = '1'; os.environ['JAEGER_AGENT_NO_SKILLS'] = '1'
from jaeger_agent import JaegerAgent, OpenAIAdapter, LocalLlamaAdapter, AgentCallbacks
from jaeger_agent.core.workspace import ensure_bound
ensure_bound(Path(sys.argv[1]))
GGUF = str(Path.home() / '.lmstudio/models/lmstudio-community/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf')
SYSTEM = 'You are Vita, a friendly avatar. Reply in two short spoken sentences. Start every reply with an acting tag such as [smile].'
ASKS = ['Hi Vita, what can you do?', 'Tell me one fun fact about octopuses.']

class TaggedStart(OpenAIAdapter):          # copied from JaegerAvatar/app/agent_worker.py
    START = '['
    def format_messages(self, messages, tools, system):
        kw = super().format_messages(messages, tools, system); kw['messages'] = [*kw['messages'], {'role': 'assistant', 'content': self.START}]; return kw
    def call(self, formatted, interrupt_event, *, on_delta=None, **kw):
        if on_delta: on_delta(self.START)
        return super().call(formatted, interrupt_event, on_delta=on_delta, **kw)
    def parse_response(self, raw):
        msg = super().parse_response(raw)
        if msg.get('content') is not None: msg['content'] = self.START + msg['content']
        return msg

def run(label, adapter):
    agent = JaegerAgent(adapter=adapter, tools=[], max_iterations=1, system_prompt=SYSTEM)
    for ask in ASKS:
        first = []; t = time.perf_counter()
        def delta(text):
            if len(first) < 2: first.append(time.perf_counter() - t)   # [0] is the forced "[", [1] the first real text
        agent.callbacks = AgentCallbacks(stream_delta=delta)
        out = agent.run_turn(ask); el = time.perf_counter() - t
        ft = f'{first[-1]:.2f}s' if first else 'none (no streaming)'
        print(f'{label}  first text {ft:>20}  whole reply {el:5.2f}s  {len(out or ""):3} chars  | {(out or "")[:70]!r}', flush=True)

which = sys.argv[2:]
if 'A' in which:
    run('A http LM Studio  ', TaggedStart(provider='lmstudio', model='google/gemma-4-e4b', base_url='http://127.0.0.1:1234/v1', max_tokens=120, temperature=0.0, timeout_s=60))
if 'B' in which or 'C' in which:
    from llama_cpp import Llama
    t = time.perf_counter(); llm = Llama(model_path=GGUF, n_ctx=8192, n_gpu_layers=-1, n_batch=512, flash_attn=True, verbose=False)
    print(f'in-process model load {time.perf_counter() - t:.1f}s', flush=True)
if 'B' in which:
    run('B in-process agent', LocalLlamaAdapter(llama=llm, max_tokens=120, temperature=0.0, enable_thinking=False))
if 'C' in which:
    for ask in ASKS:
        t = time.perf_counter(); first = None; text = ''
        for ch in llm.create_chat_completion(messages=[{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': ask}, {'role': 'assistant', 'content': '['}],
                                             max_tokens=120, temperature=0.0, stream=True):
            piece = ch['choices'][0]['delta'].get('content') or ''
            if piece and first is None: first = time.perf_counter() - t
            text += piece
        print(f'C in-process raw    first text {first or 0:19.2f}s  whole reply {time.perf_counter() - t:5.2f}s  {len(text):3} chars  | {text[:70]!r}', flush=True)
