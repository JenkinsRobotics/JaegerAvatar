# Proposal: the runtime from the avatar playground demos

> November 8 decision: Nori is now the application foundation. The implemented
> migration is described in [DEMO_MIGRATION](../runtime/DEMO_MIGRATION.md). The
> original proposal below remains historical; its module replacement and bus
> work are not claimed complete.

November 7, 2026. **Proposal only. Nothing in this document is implemented in
this repository.** It reviews two local demos built in the AI Visual Playground
and recommends how their proven parts become Jaeger Avatar's runtime. Numbers
below were measured in those demos on one Apple Silicon Mac, not here.

The reviewer wrote one of the two demos (Nori). The comparison measurements
were taken in alternating runs under the same conditions, and the other demo's
own review is cited where it differs.

## The two demos

| | Nori (`AI Visual Playground/nori-face-rig`) | KIN (`AI Visual Playground/local-avatar-demo`) |
| --- | --- | --- |
| Shape | Browser app, Python standard-library server | Browser app, Python server; voice environments and models symlinked from `JaegerLyra` |
| Characters | Ten: 3D Vita (VRM), LED-eye Mochi/Vee, 2D anime, 3D procedural | Momo (original 3D shell), Vita · KIN, and imported Nori characters |
| Speech | Kokoro Heart on MLX, ONNX fallback; Piper as the original pipeline | Kokoro Heart on MLX |
| Version control | None yet | None yet |

Each demo contains code adapted from the other, with source records. KIN
carries about 1,500 lines of Nori's renderer and rig; Nori adapted KIN's eye
contours, keyed motion, webcam tracking and output relay.

## Recommendation

**Do not move either application across whole.** Bring Nori's character
engine into Jaeger Avatar as the presentation coordinator and representation
adapters this architecture already describes. Replace its server-side brain,
speech and hearing with the Jaeger modules that own them. Freeze both demos as
tagged references; take named parts from KIN.

The demos' own servers duplicate what the stack already provides:

| Demo server feature | Owner in the Jaeger stack |
| --- | --- |
| Gemma/Claude chat, character prompts | JaegerAgent (standalone) or JaegerAI (connected) |
| Kokoro speech, cancellation by turn | JaegerKokoroTTS: `/act/speech/say`, `/act/speech/stop`, `/act/speaker/pcm` |
| Whisper hearing, voice activity | JaegerWhisperSTT: `/sense/mic/pcm` in, `/sense/stt/transcript` out |
| Raster/LED display output | JaegerAnimation and display drivers: `/act/display/frame` |

## What Nori contributes (planned adoption)

| Part | Becomes | Evidence from the demo |
| --- | --- | --- |
| Rig: about 40 control channels with spring dynamics (`web/rig.js`) | The pose/expression controls this architecture declares | Every emotion, interrupted reactions and stalled-tab steps stay finite |
| Performer queue (`web/app.js`) | The presentation coordinator | Audio-clock scheduling; cancel clears speech and motion together; lines prepared ahead. Reel: no silence over 0.41 s, mouth within 10 ms of sound |
| Audio analysis (`web/voice.js`, worker) | Real lip sync: mouth shapes, emphasis and pause events | Replaces the placeholder amplitude pulse described below |
| VRM renderer (`web/render-vrm.js`) | The 3D representation adapter | Two-bone leg IK with planted feet, spin pivot, model-specific hand orientation, toon and ink passes. 60 fps on the test Mac |
| Solid body for limbs (same file) | Limb clearance for any VRM | Torso, hips (clothing included) and thighs measured from the mesh; idle, heart and spin never inside, fast moves inside on 1-2% of checks for a few frames |
| LED eyes (`web/render-led.js`, `web/eyes.js` from KIN) | The display/robot face adapter | 64-point contour morphs, independent blinks, anticipation and recovery |
| Expression tags (`web/brain.js`) | Agent text to acting cues, until structured cues exist | Per-character tag sets and names |
| Plugins: webcam puppet, live mic lip sync | Milestone 5 tracking | Started on a fake camera; no real face test yet |
| Recording with voice, output windows over SSE | Milestone 5 recording and streaming | Exported files not yet inspected frame by frame; OBS untested |
| Benchmarks and browser regression scripts | Acceptance tests | 23 browser checks; KIN comparison harness |

From KIN: the original Momo 3D shell, the softer Vita · KIN look, the 12 fps
stepped-animation option, local VRM loading, and its scripted rehearsal when
no model is available.

## What stays behind

- The demos' chat, TTS, STT and relay servers (replaced by the modules above).
- Piper, as the in-app fallback voice (GPL; see licensing).
- Nori's `web/classic/` copy and its experimental pitch-shift singer (`singing.py`), judged poor by ear.
- Hard-coded character sheets: these become `avatar/v1` packs.
- Chatterbox voice cloning, from the core. It could return as an optional module with an explicit consent policy.

## Measured comparison

Both demos, separate muted browser profiles, three alternating runs each, same
Gemma E4B and the same Kokoro Heart voice. The machine was busy throughout, so
ranges matter more than single values. Data and scripts are in
`nori-face-rig/evidence/benchmark-2026-11-07/`.

| | KIN | Nori, final |
| --- | --- | --- |
| Kokoro, new sentence, median | 0.28 s | 0.24 s |
| Chat: send to first sound | 1.8-2.5 s | 0.9-2.2 s |
| Reel: click to first sound | 0.67-0.80 s | about 0.04 s |
| Reel: freeze at start | 0.18-0.27 s each run | none |
| Page load to animating | about 0.4 s (Momo) | about 1.0 s (Vita) |
| Idle frame rate | 60 fps | 60 fps |

KIN's own review (`avatar-performance-review/REVIEW.md`) measured a shorter gap
between queued phrases in KIN and recorded one 0.5 s hitch in a Nori reel run;
that hitch was not reproduced in later runs. Neither demo has word- or
beat-anchored gestures yet.

## Contract gaps to propose to JaegerOS (planned)

Jaeger Avatar should not fork topic definitions. These are proposals for the
owning runtime:

1. **`/act/display/pose`**, already named in [Architecture](ARCHITECTURE.md):
   the rig channels with declared units and ranges, a time basis, ordering,
   expiry and reset. Nori's channel list is a concrete starting point.
2. **Lip sync timing.** `/act/speech/chunk` currently carries amplitude only,
   and JaegerKokoroTTS publishes a placeholder pulse "until the bus audio
   contract carries real per-chunk levels". Propose mouth-shape and emphasis
   events on the audio clock, plus playback position on `/act/speaker/state`.
3. **Acting cues.** Emotions, gestures and full-body moves as structured events
   aligned to speech, so presentation does not parse tags out of agent text.
4. **Song requests** as a speech-module capability (see below).

## Contributions to JaegerKokoroTTS (planned)

- **MLX backend on Apple Silicon.** Measured in Nori: median 0.24 s per new
  sentence on MLX against 1.57 s on ONNX CPU. Learned from KIN: a 128 MB MLX
  buffer cache halved Nori's MLX time on a busy machine (median 1.33 s to
  0.74 s side by side). Keep a CPU path; a Raspberry Pi has no MLX.
- **Half-sung songs** (`song.py`): Kokoro's own decoder given the tune's pitch
  and beat timing, keeping part of the speaking inflection, plus a voice-only
  track for the mouth. Chosen by ear over spoken and fully sung samples.
  Lyric clarity is imperfect ("wires humming" is misheard by speech recognition).
- **Cancellation lessons** for coordinator tests: a restarted performance must
  not wait on the stopped one, and pending requests must be dropped where they
  wait, or a cancel queues behind them (the browser's six-connection limit did
  exactly that in the demo).

## JP01 and other robots (planned)

- Browser 3D (VRM) is for screens, streaming and the desktop app. JP01 and
  Pi-class hosts should use the LED-eye representation, producing frames on
  `/act/display/frame` as Mochi v5 already does for its face.
- Physical head and body motion goes through Aether Animation's mappings,
  calibration and limits. A digital pose stream never becomes a raw actuator
  command, as [Architecture](ARCHITECTURE.md) already states.

## Plan against the roadmap (planned)

| Step | Work | Acceptance |
| --- | --- | --- |
| 0. Freeze the demos | Put both demos under version control and tag them. Move the browser regression and benchmark scripts into the demo. Inventory every license. | Both demos reproducible from a tag |
| [Milestone 1](../roadmap/README.md) | Rig plus VRM and LED-eye adapters. A new representation format: model file plus control mapping. Vita and Mochi load from packs with manual controls. | Reload without asset edits; unsupported assets reported clearly |
| Milestone 2 | Coordinator on the bus with JaegerAgent and JaegerKokoroTTS; real lip-sync events | First sound within 2 s; no silence over 0.5 s; mouth within one frame; 60 fps; cancel leaves no audio or motion |
| Milestones 3-5 | Editor and exchange; JaegerAI connection; webcam, recording and outputs ported from Nori | As the roadmap states, with exported media inspected |
| Parallel | LED eyes on JP01 through display frames | Frame rate and latency measured on the target host |

## Risks

- **Licensing.** Piper, eSpeak NG and the phonemizer used by `kokoro-onnx` are
  GPL; `num2words` (used with misaki on the MLX path) is LGPL. This repository
  is Apache-2.0. Decide before any of them ship.
- **Duplicated code.** The demos hold copies of each other's code; consolidate
  once, recording provenance as the pack importer does.
- **Browser bridge latency** between the Python bus and a browser renderer needs
  a budget and a measurement.
- **Unreleased JaegerOS.** Pin verified versions when implementation starts.

## Decisions needed

1. Confirm Nori's engine as the base, with KIN as a parts source.
2. ~~JP01's face: a browser kiosk on the robot, or frames rendered elsewhere.~~
   Settled ([one engine design](20261109_one_engine_design.md)): the engine runs
   on the robot and streams frames to each display at its native size.
3. Whether GPL components may ship in products built on Jaeger Avatar.
4. Who drafts `/act/display/pose` and the lip-sync event changes in JaegerOS.
