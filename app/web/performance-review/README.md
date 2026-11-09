Historical demo comparison, preserved November 8. Old endpoint measurements are not current Avatar benchmarks.

# Avatar performance comparison

This folder holds the repeatable KIN/Nori comparison requested for animation,
speech, mouth timing and motion. Results are local measurements on this Mac,
not a claim that either demo is a production VTuber application.

## Run the controlled comparison

Start the existing KIN and Nori servers, then open:

- http://127.0.0.1:8791/?perf=1
- http://127.0.0.1:8765/?perf=1

Run one page at a time; park the other rendering page on `about:blank`.
Choose a character and press **Run controlled test**. Expand **Raw measurement
report** for the JSON. Reload the ordinary app URL to leave diagnostic mode.
The normal app does not import this folder's modules. The opt-in adapters seed
only the in-memory speech cache in the test page. They do not change voice models.

The first imported-renderer runs accidentally used a 300 × 300 internal buffer
behind a 600 × 600 output canvas. They are retained in `results/excluded/` and
excluded from final scores. Corrected runs use 600 × 600 internally, checked by
`validate.py`; the comparison recording was also remade at that resolution.

The test uses the actual audio schedulers, face rigs and renderers. It feeds two
prepared speech operations into the production queues, followed by wave, spin,
dance, celebrate and a mid-speech Stop. Display characters use eye reactions.
It bypasses the language model and sentence parser to isolate playback/animation
timing. A separate API test measures fresh synthesis with each app's original
Kokoro backend. The native-reel test exercises each app's own script and parsing.

## Controls and measurement limits

- Identical Kokoro Heart PCM, 6.225 seconds, mono 24 kHz, for controlled playback.
- Both Vita files have SHA-256 `d8eff1ed09b41afb94e30da27997560fb901dde925c813f835ab1986708521bb`.
- 600 × 600 stage and internal Vita render buffers; smooth timing, full body,
  neutral speech, expression strength 100%, steady camera. Pixel density is
  normalized for this comparison; these are not stock-resolution GPU benchmarks.
- Browser frame intervals are sampled without the apps' delta-time clamping.
  JavaScript cost excludes the diagnostic sampler and does not measure full GPU
  execution. Random blinks, idle gestures and operating-system load remain.
- Mouth alignment correlates the **rendered vowel morph envelope** with the
  original recording's RMS envelope. It uses the browser's audio clock and
  reported output latency. Positive lag means the mouth trails the sound.
  It is approximate to a frame and is **not phoneme accuracy, speaker-loopback
  verification, word-level gesture alignment, or a listening-quality score**.
- Gesture timing measures command dispatch relative to audio onset. It does not
  claim the hand reaches its target at that instant; anticipation is intentional.
- Stop timing separates the immediate audio stop call from the mouth's spring
  settling. It does not measure OS/hardware audio buffer drain by microphone.
- A higher envelope correlation does not automatically mean better expression.
  Eye robots' jaw channels are not directly comparable to human vowel morphs.
- Recordings are separate runs, with audio, so video encoding does not contaminate
  the controlled frame-cost measurements.
- The imported KIN renderer and Nori share substantial code; Nori's full-body
  motion curves were adapted from KIN. These are integrated app comparisons,
  not independent-engine competitions.

## Files and scripts

`bench.js` is the visible test UI. `kin.js` and `nori.js` adapt existing app
interfaces without replacing their timing logic. Each static web root has a
local `performance-review` symlink to this folder. Original app entrypoints are
saved in `before/`.

Run `../local-avatar-demo/.venv/bin/python analyze.py` to summarize saved browser
reports, and `../local-avatar-demo/.venv/bin/python validate.py` to verify the
common waveform, source count, run completion and finite rig values.

With rendering tabs parked, `voice_benchmark.py` requests three new sentences,
alternates app order, and repeats each request. KIN exposes its disk-cache hit
flag; Nori returns WAV without cache metadata. Results include request duration,
audio duration, real-time factor and unmodified WAV files. API timing includes
KIN's server-side mouth analysis; Nori analyzes audio in the browser afterwards.

No microphone, camera, cloud voice service, Lyra neural decoder or model training
is used by this benchmark. It does not assess webcam tracking or OBS capture.

Published comparison MP4s are remuxed with H.264 video copied intact, AAC audio and fast-start metadata for reliable full-length browser playback. Silence is padded after speech through the end of the spin. Original MediaRecorder files remain as `*-raw.mp4`; the voice-backend listening samples remain original WAV files.
