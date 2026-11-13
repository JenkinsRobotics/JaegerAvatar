# TTS and STT: the app's own nodes against the framework modules

2026-11-10. Step 2 of the node plan: compare what Jaeger Avatar runs today (the baseline) with the Jaeger framework
modules, and list what the modules need before the app can use them. Read from the code; no module code was changed.
Speed numbers for the app were measured on an M1 Max. Neither module repo has measured numbers.

## Voice (TTS)

| | Jaeger Avatar, in-app (`/say`, `voice_engine.py`) | `jaeger-module-kokoro` (`jaeger_kokoro_tts` 0.12.0) |
|---|---|---|
| Input | text, voice, speed, turn id (HTTP) | `/act/speech/say` (`SpeechCommand(text, voice, rate)`), `/act/speech/stop`, `/act/speaker/state` |
| Output | one WAV clip per sentence, plus lip marks (`X-Lips`) | `/act/speaker/pcm` (whole utterance, one frame, 24 kHz mono), `/act/speech/spoken`, `/act/speech/chunk`, `/act/speaker/stop` |
| Lip-sync timing | yes, from Kokoro on MLX | none |
| First sound | after the first sentence | after the whole utterance is rendered |
| Engine | Kokoro on Apple MLX (mlx-audio), else ONNX on the CPU | PyTorch Kokoro (`kokoro` 0.9.4). No MLX on any branch. `engine.py` passes no device, so the package picks CUDA, else the CPU: on a Mac it runs on the CPU. Its comments speak of "PyTorch MPS" (Metal), but nothing selects MPS. Changed since in its `dev` worktree: MLX on Apple Silicon, see "What each pipeline runs on" |
| Speed | 0.39 s for a 0.63 s clip | not measured |
| Voices | Kokoro (15 English), cloned voice (Chatterbox Turbo), Piper fast voice, singing | Kokoro only |
| Stop | cancels by turn | stops playback; queued requests still play |
| Fan-out | the page hands the clip to the speaker and the lip sync, in code | any node can subscribe to `/act/speaker/pcm` |
| Runs without `jaeger_os` | yes | no |
| Tests | real engine in the app | 35, all fakes |

Bug found: the node reads `result["elapsed_s"]`, the engine returns `"seconds"`.

## Hearing (STT)

| | Jaeger Avatar, in-app (`/hear`, `ears.js`) | `jaeger-module-whisper` (`jaeger_whisper_stt` 0.13.0) |
|---|---|---|
| Input | one recorded phrase (16 kHz clip), character name | `/sense/mic/pcm` (live stream) |
| Output | transcript | `/sense/stt/transcript`, `/sense/stt/speech_start`, `/sys/gate/decision` |
| Clip in, text out | yes | no such call |
| Engine | whisper.cpp `base.en` on Metal behind a Silero voice filter (was faster-whisper int8 on the CPU when this was first written) | whisper.cpp (pywhispercpp); default two-pass `base.en` then `medium.en` |
| End of phrase | page detector, transcribes early at a 0.35 s pause | waits 700 ms of silence (350 ms for phrases up to 1.5 s); no early decode |
| Speed | 77 ms for a short sentence (about 250 ms on the CPU before) | 73 ms to 76 ms for the same clip with `base.en`; 433 ms with `medium.en` |
| Partial words | no | yes, in three of its modes |
| Echo / self-hearing | filter in the page, strict mode while she talks | echo cancel upstream in the audio node; the self-hearing filter needs `remember_reply(text)`, which nothing calls |
| Barge-in | a new turn stops the old one | `barge_in` off by default |
| Runs without `jaeger_os` | yes | no |
| Tests | real engine in the app | 62, all fakes |

Both modules: the manifest says 2.0.0 while the package says 0.12.0 / 0.13.0, and the docs are stale.

## The agent module's built-in voice and hearing

`jaeger_agent` 1.2.0 carries its own nodes (`audio-duplex-io`, `stt-streaming`, `stt-whisper`, `tts-kokoro`). The app
switches them off. They are wired to fixed devices inside the agent, which is the design this plan moves away from.

## Verdict

The app's own nodes are ahead today on the things the avatar needs: lip marks, time to first sound, speed on Apple
hardware, cloned voice, and a simple clip call. The modules are ahead on shape: outputs are named channels that any
number of nodes can read, and hearing reports speech start and partial words. Do not switch the app to the modules
yet. Bring the modules up to the baseline, then swap.

## What to change in the modules, in order

1. Fix what is broken: the `elapsed_s` key, a stop that leaves the queue, the uncalled `remember_reply`, the version
   numbers, the stale docs.
2. Split each module in two: an engine that imports without `jaeger_os` (text in, audio and marks out; clip in, text
   out), and a thin node that puts it on the bus. The app and the robots then run the same engine.
3. Kokoro: publish per sentence, not per utterance; add a lip-marks output; add the MLX engine beside torch.
4. Whisper: add the clip call; decode early at a pause; make the engine a choice (whisper.cpp or faster-whisper).
5. Cloned voice and Piper become their own TTS nodes on the same channels, so "the voice" is a slot.
6. One benchmark script, same sentences, same Mac, run against the app and each module. A module replaces the app's
   node when it matches the app's numbers and passes one test with the real model.

## Measured on this Mac (M1 Max), November 10

Same three sentences, model warm, time to make the whole clip. Scripts: `dev/evidence/20261110_bench/kbench.py` (PyTorch Kokoro) and a call to
the app's `/say`.

| Sentence | App: Kokoro on MLX | Module's engine: PyTorch on the CPU | PyTorch on Metal (MPS) |
|---|---|---|---|
| "Hello there." | 0.16 s | 0.26 s | 1.20 s |
| "Jaeger audio endurance check. …" | 0.37 s | 0.63 s | 1.67 s |
| "Robotics speech should remain …" | 0.29 s | 0.65 s | 1.07 s |

- MLX is about twice as fast as the module's engine. Both are faster than real time.
- PyTorch on Metal is slower than PyTorch on the CPU for this model, so "use MPS" is not the fix. MLX is.
- The PyTorch `kokoro` package returns word timings (`tokens`) with each chunk, so a lip-marks output is possible on
  either engine. The module throws them away today.
- Where MLX is in the framework today: the agent module's language-model adapter (`mlx-lm`, `mlx-vlm`) and
  JaegerLyra's singing code. Kokoro on MLX is only in this app's `voice_engine.py`.

## What each pipeline runs on by default (November 10, after the fixes)

Every pipeline should work as installed, on the fastest device the machine has. Audit and result on the M1 Max:

| Pipeline | Before | Now | Measured |
|---|---|---|---|
| Agent, in the app | Jaeger Agent over HTTP to LM Studio | Jaeger Agent with llama.cpp in-process, all layers on Metal, streaming, each character warmed. The only path | first words 0.13 s to 0.19 s (0.40 s over HTTP) |
| Hearing, in the app | faster-whisper int8 on the CPU | whisper.cpp on Metal behind the voice filter | 77 ms (about 250 ms) |
| Hearing, `jaeger-module-whisper` | whisper.cpp on Metal already | unchanged: it was never on the CPU | 73 ms to 76 ms, `base.en` |
| Voice, in the app | Kokoro on MLX already | unchanged | see the table below |
| Voice, `jaeger-module-kokoro` | PyTorch on the CPU | MLX on Apple Silicon; PyTorch on CUDA or the CPU elsewhere, and as the fallback. `tts.compute` and `bench` say which; `JAEGER_KOKORO_BACKEND=torch` or `mlx` forces one. In the module's `dev` worktree, not committed, 40 tests pass | one 4.5 s sentence: 0.21 s on MLX, 0.58 s on PyTorch; 9.2 s of speech: 0.4 s to 0.7 s on MLX, 1.2 s to 2.0 s on PyTorch |

Still open in the modules: Kokoro publishes a whole utterance as one frame and has no lip-marks output; Whisper has
no clip call and no guard of its own against words invented from noise. The agent module's built-in nodes are below.

The agent module's built-in nodes (`jaeger_agent/nodes/`, read on November 10, not changed):

- `tts-kokoro` loads `kokoro.KPipeline` itself, so on a Mac it is PyTorch on the CPU: the same gap the Kokoro
  module had, in a third copy. It should take its voice from `jaeger-module-kokoro` instead of loading its own.
- `stt-whisper` and the `listen` tool use whisper.cpp (Metal), but default to `large-v3-turbo` and `medium.en`:
  544 ms and 433 ms for the short clip, against 75 ms for `base.en`. The app, the Whisper module and the agent
  each default to a different model. Which one is right is a choice between speed and accuracy, not yet made.
- `llm-gemma` loads llama.cpp with every layer on the GPU.

## The agent's model: HTTP against in-process

The app runs Jaeger Agent, but hands it `OpenAIAdapter(provider='lmstudio')`, so the model runs in LM Studio and is
reached over HTTP on this Mac (`app/agent_worker.py`). The agent module's own default is llama.cpp in the same
process (`LocalLlamaAdapter`). Same turn, Gemma 4 E4B Q4_K_M, script `dev/evidence/20261110_bench/abench.py`:

| Path | First words | Whole reply |
|---|---|---|
| A. App today: agent over HTTP to LM Studio | 0.40 s (7.7 s on the first turn, while LM Studio loaded the model) | 0.95 s |
| B. Agent in-process (`LocalLlamaAdapter`) | none: it does not stream, the text arrives all at once | 0.66 s to 1.42 s |
| C. The same in-process model called directly, streaming on | 0.10 s to 0.13 s | 0.62 s to 0.68 s |

- In-process is faster (C against A: first words three to four times sooner) and needs no LM Studio.
- The agent module's in-process adapter sets `stream_transport=False` and never calls `on_delta`, so the app could
  not start speaking until the whole reply was written. That is the module change that makes in-process the right
  default for a voice app: stream text from `LocalLlamaAdapter`.
- The app's agent environment (`.agent-venv`) has no `llama-cpp-python` installed. In-process load is about 13 s once.

## Why the agent hard-codes its voice and hearing, and what to change

Read on November 10 in `jaeger-module-agent` (`dev` worktree, 1.2.0), before the change. What was then built is in the
last section, "Built: the agent runs on the modules".

### What the agent does today

The agent has three ways to speak or listen, and only one of them goes through a module:

| Path in the agent | Voice | Hearing |
|---|---|---|
| `speak` tool (`tools/speak.py`) | The JaegerOS `tts` slot: whichever module fills it (`runtime.ensure_tts_node`) | none |
| `listen` tool (`tools/listen.py`) | none | Its own whisper.cpp load, `medium.en` |
| Voice loop (`core/engine.py`, `core/speech.py`) | Its own `kokoro.KPipeline` (PyTorch, CPU on a Mac) | Its own whisper.cpp load, `large-v3-turbo` |

The voice loop loads its six parts by file path: `_load_node("nodes/tts-kokoro/runtime.py", ...)`, and the same for
`stt-whisper`, `stt-streaming`, `audio-duplex-io`, `vision-mmproj` and `llm-gemma`. It never asks JaegerOS what
fills a slot.

### Why it is built that way

1. **It was moved in whole.** All six nodes arrived in one commit (`3d02664`, September 25, "1.2.0 — multimodal agent
   runtime"). Each `node.json` gives its lineage as `gemma_multimodal-decomposition`: the earlier single-file voice
   loop, cut into folders and kept as verified, not rebuilt on the modules.
2. **It was a stated choice.** `module.yaml` calls them "composable agent internals, not additional JaegerOS slot
   providers". The `[multimodal]` extra installs `kokoro` and `pywhispercpp` directly and does not depend on
   `jaeger-kokoro-tts` or `jaeger-whisper-stt`, so the voice loop runs with no JaegerOS and no modules installed.
3. **The modules do not offer the calls the loop needs.** The loop wants sound back as chunks it plays itself, so
   it can stop mid-sentence when interrupted and cancel its own echo (`for chunk in node_tts.synth(text)`). It wants
   to hand a clip of sound to Whisper and get text (`node_stt.model.transcribe(audio)`), many times a second for
   live partial text. The Kokoro module offers `render` (one whole buffer) and `speak` (plays on its own device).
   The Whisper module has no call that takes a clip.
4. **The framework slot is not engine-neutral yet either.** JaegerOS finds the `tts` module by slot, then asks it for
   classes named `KokoroTTS` and `KokoroTTSConfig` (`jaeger_os/nodes/runtime.py`). Its own comment says a second
   voice engine "forces that decoupling" and that it was put off. So there is no written contract a voice or
   hearing module must meet, only "be Kokoro".

### What it costs

- An upgrade to a module does not reach the voice loop. Kokoro on MLX is the live example: the module is 3 to 4
  times faster, the agent's own copy is still PyTorch on the CPU.
- Kokoro loading exists in four places: the app, the module, the agent node, and a copy of the module inside
  `JaegerAI/packages`. Whisper loading exists in five: the app, the module, `stt-whisper`, `listen`, and the
  `JaegerAI/packages` copy (0.12.0, one version behind the module's 0.13.0).
- Three different default hearing models: `base.en` (app), `base.en` then `medium.en` (module), `large-v3-turbo`
  and `medium.en` (agent).
- Swapping Whisper for another engine means editing the agent, the opposite of "a input channel today could be
  whisper but tomorrow lyra".

### What to change, in order

1. **Write the contract in JaegerOS.** Two small calls, named for the job and not for the engine:
   voice is text in, sound chunks out (float32, with its sample rate), opening no device; hearing is a sound clip
   in, text out. Later additions: lip marks beside each chunk, partial text.
2. **Make the modules meet it.** Kokoro: a public `synth(text)` that yields chunks (it already renders this way
   inside `_synthesize`). Whisper: the clip call already on the list above.
3. **Point the agent's nodes at the slots.** `tts-kokoro` and `stt-whisper` keep their folders and their
   `build / load / synth / transcribe` shape, so `core/engine.py` barely changes; inside, they ask JaegerOS for
   whatever fills `tts` and `stt`. No copy of their own and no fallback (Jonathan's rule): with no module installed
   the agent stops with an error that says what to install. The loop stops
   reaching into `node_stt.model` and `node_stt._lock`.
4. **`listen` uses the same hearing node**, and one default hearing model is set in one place.
5. **Delete the copies** once the agent runs on the modules: the agent's own loaders, then the stale module copies
   in `JaegerAI/packages` if nothing installs from them.

Output as a channel is already half there: the loop emits every sound chunk as an `audio` event and has a `play`
switch, so with playing off a speaker, a lip-sync node or both can take the same chunks. Interrupting and echo
cancelling need to know what is being played, so the part that owns the microphone and speaker together
(`audio-duplex-io`) stays one node.

Not checked: whether anything still installs from `JaegerAI/packages`; how the Whisper module's own streaming
engines (`continuous`, `local_agreement`, `phrase_word`) compare with the agent's `stt-streaming`.

## Built: the agent runs on the modules (November 10)

Jonathan's rule: the agent gets its voice and hearing from the Jaeger modules, with no loader of its own and no
fallback copy. Built in the three `dev` worktrees; nothing is committed. The app is not switched yet (see the end).

Correction to the sections above: the live JaegerOS is `~/GITHUB/JaegerOS` (0.10.0). `JaegerAI/packages` holds old
copies and is not what the modules or the agent import.

### What changed

| Where | Change |
|---|---|
| Kokoro module (0.13.0) | `open_voice(voice=, language=)` returns a loaded voice; `synth(text)` yields float32 chunks; `sample_rate`, `compute` (`mlx`, `cuda`, `cpu`). Owns the pinned spaCy English model the agent used to pin |
| Whisper module (0.14.0) | `open_hearing(model=)` returns a loaded model; `transcribe(pcm, language=, prompt=, abort=)` returns segments in milliseconds; `compute` (`metal`, `cuda`, `cpu`) |
| Agent | `core/parts.py` asks JaegerOS what fills a slot (`resolve_slot_module`) and opens it. `tts-kokoro`, `stt-whisper`, the live-text node and the `listen` tool all go through it. The agent's own Kokoro and Whisper loaders are deleted. `listen` uses the agent's one default hearing model (`STT_MODEL`), where it had its own `medium.en` |
| Agent install | The `multimodal` extras install `jaeger-kokoro-tts>=0.13` and `jaeger-whisper-stt>=0.14` in place of `kokoro` and `pywhispercpp` |
| Agent report | `SpeechRuntime.status()` and `python -m jaeger_agent speechbench`: module, version, model and compute per part, voice speed, hearing speed and words right on the agent's own speech. Exit code 1 when a part is off the fast path |
| Agent tests | Fast tests with stand-in parts, plus one real-model test that fails if voice is not on MLX or hearing not on Metal on Apple Silicon |

`speechbench` on the M1 Max:

```
voice    jaeger_kokoro_tts 0.13.0  model af_heart  compute mlx
hearing  jaeger_whisper_stt 0.14.0  model large-v3-turbo  compute metal
load     10.82 s
voice    8.35 s of speech in 1.0835 s (x0.1298 of real time), first audio 1.0831 s
hearing  8.35 s clip in 0.6389 s, 100% of the words right
```

An earlier run of the same command gave 7.78 s to load, 0.86 s for the voice and 0.61 s for hearing.

### Before and after, same Mac, same script

`dev/evidence/20261110_bench/ab_speech.py` drives the agent's `SpeechRuntime`; five runs after one dropped warm-up,
median. Results: `ab_baseline.json` (the agent's own loaders) and `ab_new.json` (the modules).

| | Agent's own loaders | Agent on the modules |
|---|---|---|
| Load voice and hearing | 22.4 s | 6.9 s |
| Voice, 2.05 s of speech | 0.384 s | 0.114 s |
| Voice, 15.75 s of speech | 1.816 s | 0.785 s |
| Hearing, 15.75 s clip | 0.680 s | 0.701 s |
| Hearing, first 4 s with a prompt | 0.546 s | 0.554 s |
| Transcript of the clip | | identical |
| Segments and their times | | identical |

Voice is 2.3 to 3.4 times faster, because the module runs Kokoro on MLX and the agent's copy ran PyTorch on the CPU.
Hearing is the same call into the same whisper.cpp build, and the times are the same within the spread between
runs. Checked by running old and new in turn, three times each, nine decodes per run (`ab_hear.py`):

| Median per run | Old | New | Module's hearing alone |
|---|---|---|---|
| 15.75 s clip | 0.689 s to 0.735 s | 0.697 s to 0.710 s | |
| First 4 s with a prompt | 0.540 s to 0.557 s | 0.555 s to 0.564 s | 0.548 s to 0.563 s |

Voice still arrives as one chunk per call on both sides, so first sound equals the whole clip. Sentence chunks
and lip marks are the next module change.

### Not done

- **The app.** Jaeger Avatar still uses its own `/say` and `/hear`. Its agent environment (`.agent-venv`) does not
  have the two modules installed; the app does not use the agent's voice loop or `listen`, so nothing breaks, but
  it must install them before it switches.
- **The contract in JaegerOS.** The two calls are documented in the modules only. JaegerOS still asks the `tts`
  module for a class named `KokoroTTS` (`jaeger_os/nodes/runtime.py`).
- **Avatar** through a module, the third part.
- Not run: CUDA and other non-Apple hardware, a live microphone through the voice loop, a fresh
  `pip install jaeger-agent[multimodal]`.

## Built: the agent's voice loop, faster and with app-chosen audio (November 11)

Changes are in `jaeger-module-agent` on `dev`, not committed. The two modules were not touched.
Measured on the M1 Max with `loopbench.py` (no sound played), old code against new, two runs of the new code.

| | Before | After |
|---|---|---|
| Typed question to first sound | 2.19 s to 2.96 s | 0.67 s to 0.93 s |
| Typed question to whole reply voiced | 2.19 s to 2.96 s | 1.26 s to 2.07 s |
| Pieces of sound per reply | 1 | 3 to 5 |
| Speech stops to words known | 1.16 s to 1.40 s | 0.86 s to 0.90 s |
| Start-up, warm, same code with hearing loaded in turn | 6.7 s to 7.4 s | 5.9 s |

- **Sentence by sentence.** The voice starts on the first finished sentence while the model is still writing
  (`core/outputs.py` `StreamedSpeech`). The reply text is the same; the sound arrives in pieces.
- **Early hearing pass.** Hearing starts on the phrase 200 ms into the quiet instead of after the 500 ms
  end-of-phrase wait, and is thrown away if the person keeps talking. The 500 ms wait itself did not move, so
  0.5 s of the 0.86 s is that wait. The once-a-second live preview now stops when the person goes quiet, so it
  no longer holds the hearing while the early pass waits.
- **Start-up.** Hearing loads beside the voice and the model. The first before run took 27.19 s, but that was a
  cold disk cache; the fair figure is the warm one in the table, about 1 s saved. The `listen` tool and the voice
  loop share one hearing instance instead of loading two.
- **Audio in and out.** The app passes `outputs=[...]` (anything with `play(chunk, rate)`, `wait()`, `stop()`) and
  feeds `push_audio`. With no outputs given, the voice plays on the sound card in `multimodal.output_device`;
  where the agent opens a microphone itself it uses `multimodal.input_device`. The voice's own sample rate is
  passed along; nothing downstream assumes 24 kHz.
- **Hearing model** stays `large-v3-turbo`.

Two faults found and fixed on the way. Loading the voice on a worker thread made the process crash at exit
(MLX's per-thread compile cache, freed after Python had shut down) and left `sys.stdout` pointing nowhere
(Kokoro's and llama's stdout redirects overlapping). The voice now loads on the caller's thread and only the
hearing loads beside it. An app that calls `load()` from a thread of its own would still load the voice off the
main thread; that belongs in the Kokoro module.

Not run: real sound cards for the device settings, a live microphone, the echo-cancelling modes, and the outputs
with a real lip sync.
