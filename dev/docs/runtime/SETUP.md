# Local application setup

Run `./run.sh` at the repository root and open http://127.0.0.1:8790/ .
The launcher uses the application `.venv`; Nori's audio implementation is
currently verified on Python 3.13 / Apple Silicon. Scripted mode and the browser
synth allow performances before neural voice models are ready. Microphone and
webcam access are requested only when their controls are enabled.

## JaegerAgent host

JaegerOS currently requires Python >=3.11,<3.13. Avatar therefore keeps the agent
in `.agent-venv`, separately from audio. No agent internals are vendored.

```sh
python3.11 -m venv .agent-venv
.agent-venv/bin/python -m pip install -r requirements-agent.txt
./run.sh
```

`requirements-agent.txt` pins the reviewed base Git revisions. The JaegerOS checkout
contained pre-existing local changes when its verification wheel was built; see
`dev/evidence/migration/runtime-sources.json`. Clean pinned installation remains
a separate qualification step. The local verification
used wheels built from those checkouts, plus the dependencies needed for the
OpenAI-compatible adapter. In-process llama.cpp, hardware and multimodal extras
were not exercised. The normal installer resolves the packages' declared
dependencies; installation on a clean machine has not been benchmarked.

Override `JAEGER_AGENT_PYTHON` for another supported environment. The default
provider is LM Studio (`LMSTUDIO_URL=http://127.0.0.1:1234`,
`GEMMA_MODEL=google/gemma-4-e4b`). Run its model server before chatting. The app
header reports **JaegerAgent · Gemma** only while the worker and model endpoint
are available; otherwise it reports scripted mode.

The worker uses `JaegerAgent`, `OpenAIAdapter`, `AgentCallbacks.stream_delta`,
`interrupt()` and host workspace binding. Tools/skills are disabled in this
initial character host. Agent history is in memory, keyed by browser session and
pack, separate from appearance selection. Private instance storage is under
`.jaeger_os/avatar`; it is never included in a pack. Connected JaegerAI is planned.

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
