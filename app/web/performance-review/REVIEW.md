# KIN versus Nori: measured performance review

November 7, 2026 · local Apple Silicon Mac, arm64, 10 physical CPU cores, 32 GiB RAM.

## Recommendation

For **this animation-and-speech demo**, my preferred review configuration is
**KIN with Vita · Nori**, retaining **Vita · KIN** and Momo as selectable originals.
It combines the imported character presentation with KIN's faster Kokoro backend
and tighter queued speech. Nori's strongest contribution is its speech-driven
acting: voiced accents kick the brows, head, body and hands, and pauses can blink.
That is the next behavior I would bring into KIN.

This is a performance recommendation, not a claim that KIN has the more complete
VTuber product workflow. Nori still has advantages in its normal recording,
settings and hands-free conversation UI. Both demos share character and motion
code, so choosing either app does not require keeping two complete codebases.

## Controlled results

Ten completed runs sampled **20,225 frames**. Each Vita path ran twice; Mochi and
Vee each ran once in each app. Same Vita asset and Kokoro recording, 600 × 600
render buffers, smooth timing, full-body view and steady camera. Other avatar
rendering tabs were parked. No AI language model, microphone or camera was used.

| Measurement | KIN: original Vita | KIN: imported Vita | Nori: Vita |
| --- | ---: | ---: | ---: |
| Average frame rate | 59.89–59.95 fps | 59.97 fps | 59.97 fps |
| 95th percentile frame interval | about 18.4 ms | about 18.2–18.3 ms | about 18.4 ms |
| Mouth-envelope offset | 0 to +10 ms | −15 to −5 ms | about 0 ms |
| Prepared request → scheduled audible onset | 134–139 ms | 112 ms | 36 ms |
| Gap between queued phrases | 18 ms | 18 ms | 79–84 ms |
| Gesture dispatch relative to audio onset | −3 to +5 ms in first run | −11 to +2 ms in first run | −36 ms |
| Mouth settling below 0.05 after Stop | 190–217 ms | 122–128 ms | 175–179 ms |

Positive mouth offset means the mouth trails the audio. These small differences
are **roughly within one animation frame**, not evidence of millisecond-accurate
phoneme animation. The measurement correlates the model's rendered vowel weights
with the waveform's RMS envelope, using the browser audio clock and reported
output latency. It does not measure speaker output with a microphone, perceptual
naturalness, individual consonants or word alignment.

All controlled runs completed without a freeze or a frame interval over 50 ms.
One KIN-original run had a single interval above 33.5 ms. Mochi and Vee stayed
around 59.97–59.98 fps in both apps; their CPU rendering costs were lower than
Vita's. Display-character jaw channels are not a human lip-sync quality metric.

The Stop calls reached the audio source immediately (sub-millisecond in these
runs); mouth springs took the additional settling time above. Hardware buffering
can add time after the stop call. Neither app cut off the two normal queued clips
or overlapped them in the controlled test.

## Can the motion accompany the speech?

Yes, at **phrase level**. Both dispatched the requested wave/nod close to the
start of the correct clip, then played complete phrases. A gesture command is
not the same as the hand reaching its expressive peak: anticipation takes time.

Nori has the more useful speech-accent driver. It analyzes voiced emphasis and
pauses, then excites body/face springs from those events. KIN's main rig uses a
repeating speaking gesture, and its imported-face adapter maps mouth energy to
hand activity without bringing over the complete emphasis-event driver. This
explains why Nori can feel more connected to the delivery even when both mouths
are in time.

**Neither has word-level performance alignment.** Neither test establishes that
the wave lands on the word “wave,” or that a gesture apex lands on a chosen
syllable or musical beat. That is the largest remaining improvement for authored
performances: explicit word/beat anchors, with anticipation and recovery around
the anchor, rather than just starting a move with a phrase.

## Body motion

Wave, spin, dance and celebrate completed in all three Vita paths. The camera's
sampled position stayed constant throughout those controlled movement phases:
the movement was in the character, not camera shake. Native reels may deliberately
change their framing; the close-up comparison recordings also deliberately widen
before the spin.

Original Vita had a repeatable right-upper-arm quaternion change of about
**25–26 degrees in one frame**, around 0.42 seconds into spin preparation. The
other two paths peaked around **9–10 degrees** in their spin runs. That is a
candidate for smoothing in KIN's original arm solver. Quaternion change alone
does not prove an anatomically impossible pose, and the small wave differs
between the two rigs, so this is not a general “human motion score.” Keep the
original look and inspect that arm transition, rather than removing the character.

Full-body motion curves are substantially shared between the apps. There is no
evidence here that one has a wholly superior independent animation engine.

## Real Kokoro generation, separate from playback

Three new identical texts were requested sequentially from both local backends,
alternating which app went first. Models were already warm. Each request was
repeated once. Both used Heart at normal speed and returned non-silent mono
24 kHz audio, with peaks around 0.89 and no sample clipping.

| Backend | New-request wall time | Audio duration | Real-time factor | Repeated request |
| --- | ---: | ---: | ---: | ---: |
| KIN: Kokoro through MLX | **0.835–0.896 s** | 4.375–10.425 s | 0.080–0.205 | **4–5 ms**, disk-cache hits |
| Nori: Kokoro through ONNX | 1.283–2.356 s | 3.617–9.406 s | 0.244–0.355 | 1.053–2.221 s |

Lower real-time factor is faster; both can generate these phrases faster than
they play. KIN's response includes its server-side mouth analysis. Nori's browser
worker analysis happens after its API response and is not included in that API
time. Nori caches prepared reel clips in the page, but its backend only retains
very short utterances; the repeated long sentences regenerated.

These are three warm-model samples on this Mac, not cold-start measurements,
streaming time-to-first-chunk, end-to-end LLM response latency or a voice-quality
ranking. The two backends produced different waveforms/durations, which is why
the animation comparison used one shared recording. The comparison page includes
both freshly generated audio samples for listening.

KIN's additional prepared-playback delay comes in part from decoding the cached
base64 WAV again and its 75 ms scheduling guard. Caching decoded AudioBuffers is
a useful next optimization. It should be measured before shortening the guard.

## Native reels

- KIN's own Showtime ran through all nine motion/emotion beats and four Kokoro
  clips, including the Kokoro laugh phrase. Approximately 59.97 fps, no interval
  above 33.5 ms, no overlapping speech. For the spoken beats, gestures began
  roughly 100 ms before the scheduled audible onset.
- Nori's Showtime completed all 20 audio operations and its closing bow. One run
  had a **501.6 ms frame interval** during the giggle section and one 35 ms
  interval. A second complete run had neither hitch and averaged 59.97 fps.
  No console errors were reported. This is an isolated observation, not a
  diagnosed recurring defect; its cause is not established.
- Nori's native reel includes synthetic nonverbal/singing clips. About 11 seconds
  of sampled active playback in the first run was flagged non-natural by the
  app. Those clips should not be described as Kokoro-quality speech or as proof
  of a high-quality singing engine.

## Next improvements, in order

1. Add word/beat-anchored gesture cues and speech-accent events. This matters more
   than additional characters or camera effects.
2. Keep KIN's phrase continuity and Mac Kokoro backend; cache decoded audio buffers
   to reduce its prepared-playback delay.
3. Smooth the original Vita arm transition and test hand limits across imported
   rigs. Retain both Vita looks and the original Momo.
4. Give nonverbal sounds a consistent voice-quality path. Treat singing as a
   separate feature until its output meets the speech quality bar.

## Scope, artifacts and changes

The comparison page contains three recorded voice-and-spin clips, both real
backend speech samples, and the measured tables. Recordings were made separately
from the performance runs and contain video plus generated-voice audio; the
benchmark recorder does not add a normal production recording feature to KIN.

All raw reports, scripts and media are in this folder. `README.md` explains the
method and rerun procedure. App changes for this task are opt-in diagnostics and
a KIN footer link to the comparison. Normal timing, speech engines and animation
algorithms were not changed to improve the scores. No Lyra neural decoder,
weights or release work was used or modified.

No real-face tracking, live microphone, OBS, acoustic loopback, long-duration
soak, different hardware or stock-resolution GPU comparison is claimed. UI
frame costs differ slightly in what each app includes and do not time GPU
execution. Random idle motion and OS/browser activity remain sources of variance.

Validation completed: all ten normalized reports passed the PCM/source-count/finite-rig checks, including internal render dimensions. KIN’s 49 JavaScript tests and Nori’s existing test script passed. All three comparison MP4s have video and audio streams. Initial 300-pixel imported-renderer runs are retained under `results/excluded/` and are not included in these scores.


## Follow-up: native startup and reported KIN freeze

Fresh-page Nori reel clicks took 2.131 and 2.356 seconds to first sound (browser audio-clock estimate, not speaker loopback). A warm replay took 42 ms. In the first fresh run, opening speech was ready at 1.203 s but playback waited for the second phrase until 2.085 s. The preloader also issued duplicate generation during preparation. Traces: `results/startup/*.json`.

Restarting Nori while its first reel was preparing stranded the queue: after the second click the trace contains 33 ready clips across 37 seconds, but no scheduled source. The old runner owns `running` until it exits; the replacement queue does not start. This is an identified outstanding Nori bug, not a fixed latency result.

KIN had a reproducible code path that paused on tab hide and never automatically resumed. The timeline now distinguishes automatic visibility pauses from manual pauses and resumes only the former. Three regression tests cover tab return, manual pause, and stop while hidden. All 52 KIN tests pass. Imported rendering now ignores background/large-gap timing for adaptive resolution and restores resolution after sustained fast frames.

Both recorded KIN videos decoded to 361 distinct frames each. UI playback advanced with no media error; the imported clip visibly reached a side-facing spin pose. Added explicit Play/Pause/Replay performance buttons, visible playback status and audio-only labels for backend samples. This verifies playback on this Mac; it does not establish the exact cause of the user's reported clip freeze. Live KIN Showtime advanced through the reel and manual pause/resume was checked separately.
