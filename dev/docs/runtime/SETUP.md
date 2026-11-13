# Local application setup

Run `./run.sh` at the repository root and open http://127.0.0.1:8790/ .
The launcher uses the application `.venv`; Nori's audio implementation is
currently verified on Python 3.13 / Apple Silicon. Scripted mode and the browser
synth allow performances before neural voice models are ready. Microphone and
webcam access are requested only when their controls are enabled.

## JaegerAgent host

JaegerOS currently requires Python >=3.11,<3.13. Avatar therefore keeps the agent
in `.agent-venv`, separately from audio. No agent internals are vendored.

`./run.sh` makes that environment on its first run: it looks for `python3.12`,
then `python3.11`, and installs `requirements-agent.txt` (the first install
builds llama.cpp and takes some minutes). With neither Python, or if the install
fails, the app starts on scripted replies and says so; a failed install is
removed, so the next run tries again. By hand it is:

```sh
python3.11 -m venv .agent-venv
.agent-venv/bin/python -m pip install -r requirements-agent.txt
```

`requirements-agent.txt` pins four Jaeger repos, each to one commit: JaegerOS,
Jaeger Agent, Jaeger Kokoro (voice) and Jaeger Whisper (hearing). Nothing is
read from a checkout beside the app.

The language model is one GGUF file, downloaded once (5.3 GB):

```sh
curl -L --create-dirs -o ~/models/gemma-4-E4B-it-Q4_K_M.gguf https://huggingface.co/lmstudio-community/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf
```

When only scripted replies answer, the header, the terminal and `/health`
(`why`) give the reason: the agent is not installed, there is no model file,
or the agent stopped (`app/.cache/agent.log`).

Override `JAEGER_AGENT_PYTHON` for another supported environment. The model
runs inside the agent worker: JaegerAgent's llama.cpp adapter loads a GGUF file
itself, with every layer on the GPU. There is no model server and no other
option. Model files are found in `~/.lmstudio/models` and `~/models`
(`JAEGER_MODEL_DIRS` overrides the list); the default is
`gemma-4-E4B-it-Q4_K_M` (`GEMMA_MODEL`), and Settings lists every chat model
found. The worker loads the model at startup and runs the character's
instructions through it once (about 12 s the first time), so the first reply is
as fast as the rest. The app header reports **JaegerAgent · model file** while
the worker is up and the file is on disk; otherwise it reports scripted mode.

By default the worker is Jaeger Agent's voice loop (`app/agent_loop.py`): hearing
(Jaeger Whisper), the model with its tools, and the voice (Jaeger Kokoro) run in
one process, and the app copies none of it. The page sends typed text and
microphone sound in, plays the voice sound it gets back and moves the mouth
itself. The agent's tools are on (the short tool list; `JAEGER_FULL_TOOLS=1`
shows every tool) and the context is 32768 tokens. The agent moves the body
with its own `avatar` tool (`jaeger_avatar/embedded/agent_tools.py`), which
goes over the same control link a robot body uses; the app has no list of
moves of its own. The character's prompt ends with the body it is in, the
feelings and moves that body offers, and one rule: begin every reply with one
avatar tool call, then the words. The worker adds one example call, which the
agent's model adapter writes in the loaded model's own call form
(`tool_call_example`), so the app holds no model syntax. Install the two voice modules beside the agent (see
`requirements-agent.txt`); without them the app reports scripted mode.

`JAEGER_AVATAR_LOOP=0 ./run.sh` starts the earlier path instead: the app's own
`/say` and `/hear`, a plain model with tools and skills off, and inline tags
for acting. It still carries what the loop does not yet do: cloned voices, a
voice per character, Piper, and singing.

Agent history is in memory, keyed by browser session and pack, separate from
appearance selection. Private instance storage is under `.jaeger_os/avatar`;
it is never included in a pack. Connected JaegerAI is planned.

## Voice and singing

Kokoro uses MLX on Apple Silicon and ONNX elsewhere. The preserved Piper and
built-in synthesizer paths remain optional fallbacks. Model caches and cloned
voice samples live under `app/.cache`, excluded from version control.

Fresh SoulX songs require the separately configured JaegerLyra checkout and its
research/voice environments. Set `NORI_LYRA=/path/to/JaegerLyra` if needed. Avatar
runs Lyra's existing scripts with per-job request/output files and exposes
progress and cancellation. This is a local process adapter, not a network service.
The prepared Singer A recording is bundled independently; no synthesis occurs
when the reel plays it.

## Verify

```sh
npm test
python3 -m jaeger_avatar.packs validate
python3 -m unittest discover -s tests -v
python3 scripts/check_site.py
```

The browser regression scripts (`scripts/browser_smoke.mjs` and
`scripts/browser_lifecycle.mjs`) accept `AVATAR_URL` and `PLAYWRIGHT_MODULE` and
runs with muted hardware output. Check all live characters, a library portrait,
Nori/KIN mouth modes using the same audio, Singer A, complete reel, Pause,
Stop/restart, and narrow layouts. Inspect exported recordings separately from
animation timing metrics. Real webcam hardware, room microphone behavior and
OBS capture are outside the automated migration checks.
