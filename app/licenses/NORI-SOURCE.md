# Nori: real-time expressive agent faces

One small face rig and one skeleton drive ten characters live. There is no diffusion, video or pre-drawn frames.

```bash
cd nori-face-rig && ./run.sh
```

Then open http://localhost:8765 and press **Play reel**, or **Stream mode** for the full-window VTuber view. The earlier layout and its Piper voices are kept at http://localhost:8765/classic/. Everything stays in this folder: Python in `.venv`, Piper voices (about 63 MB each), the Whisper speech model (about 140 MB) and Kokoro (about 350 MB) in `.cache`, downloaded on first run. The voice clone model (about 3.2 GB) downloads the first time a cloned voice is used.

**Brain:** Gemma in LM Studio if its server is running (`google/gemma-4-e4b`), then Claude if `ANTHROPIC_API_KEY` is set in `.env`, then a scripted brain. The header shows which. `NORI_BRAIN=claude` skips Gemma.

Self-tests: `node test.mjs` (also checks mouth shapes on the real voice if the server is running) and `.venv/bin/python test_voice.py` (also checks Gemma if LM Studio is running).

## Characters

| | Kind | Status |
|---|---|---|
| **Ace**, **Sol**, **Nori** | true 3D, flattened and inked to read as 2D anime | current focus |
| **Vita** (default), or any model you load | an artist-made VRM or glTF on the same rig, timing and cel look | current focus |
| **Mochi**, **Vee** | display robots: all the acting happens in morphing eyes on a screen. Mochi's shell and camera never move | done |
| **Pip**, **Bo**, **Rook**, **Maya** | 3D (astronaut bot, box bot, humanoid robot, human) | first draft, parked |

Use **Load model** in the side panel, or drop a `.vrm`, `.glb` or single-file `.gltf` on the stage. A model loaded this way isn't saved: reloading the page goes back to Vita, unless you open `?face=vita&model=models/yours.vrm` with the file in `web/models`. Ace, Sol, Pip and Bo are based on reference images. Rook is an original design with a similar gritty, childlike spirit to a film robot, not a copy of one.

## Voices

Open **Studio**, then **Voice**. Each character has their own voice, and every choice is remembered.

- **Kokoro** is the default: 15 clean English voices, American and British. On Apple Silicon it runs on the GPU through MLX, read the way local-avatar-demo reads it, whose voice was preferred by ear: Kokoro's own pronunciation (misaki), its gentle pacing per feeling, its loudness levelling, no pitch shifting, and laughs and gasps spoken in her own voice. `test_heart.py` checks the match against that demo when it's running. Elsewhere, or with `NORI_KOKORO=onnx`, Kokoro runs on the CPU through ONNX. Vita and Nori start with Heart, the voice chosen by ear from the samples, and the other characters start with their own. Feeling comes through pacing, pitch and punctuation, since Kokoro has no emotion control. Laughs, gasps and sighs use the built-in sounds, which are instant and shaped to the acting, and in live chat she speaks whole sentences so lines follow without gaps.
- **Clone a voice from one sample:** record 8 seconds or choose a file, and confirm it's your voice or that you have permission. Chatterbox Turbo, also chosen by ear, then speaks in that voice with its accent. The sample stays in `.cache/clones` and **Delete this cloned voice** removes it. The model loads on first use, and the character's usual voice speaks until it's ready.
- **Singing** in the reel and in chat is her own Kokoro voice on the beat over a soft music box (`song.py`), chosen by ear over a half-sung version, which stays as an option. It needs Kokoro on MLX; otherwise the built-in singer takes over. Her mouth follows her voice alone. **Studio → Singing** takes your own lyrics: the experimental singer (JaegerLyra's SoulX-Singer, `lyra_singer.py`) sings them to a chosen melody, pitch and tempo in her Kokoro voice, taking about 20-35 s before it plays; or use her own voice on the beat, which starts at once. **Singing: This voice** is an older experiment for any voice, cloned ones included: `singing.py` speaks the line, then stretches each vowel to its note and moves it to pitch. It lands on the tune by measurement, and was judged terrible by ear.
- **The original pipeline** (Piper, first-clause speech and all) is kept in full, and is also the fallback whenever a natural voice isn't ready. **Voice: Kokoro / Original** in the header, or V, switches between them and has her speak straight away, so you can A/B them. During a reel it starts the reel over.

`evidence/voice_samples/` holds short comparison clips, including GPT-SoVITS, which was tried but isn't in the app. Qwen3-TTS was dropped for its accent on English.

## Talking to her

The **Conversation** panel sits beside her: your messages and hers as a chat, with the message box at the bottom. Enter sends, Shift-Enter starts a new line, and **Start over** clears this character's conversation. Stream mode borrows the same box.

Click **Mic** in the message box and just talk, in a normal browser such as Chrome or Safari at http://localhost:8765 (the Claude app's Browser pane blocks microphones). When you stop for about 0.65 s, Whisper `base.en` turns it into text on this machine and she answers. The audio goes only to the local server and isn't saved. She looks at you while you talk and nods when you pause.

Talk over her and her voice drops right away. She stops for good once the words come back as yours. If they turn out to be her own voice leaking from the speakers, she carries on at full volume, so she shouldn't end up talking to herself. Headphones are still the safest setup. `NORI_STT` in `.env` picks another Whisper model.

## VTuber mode

**Stream mode**, on the stage or in Studio, fills the window with the character, large captions, a chat column and a name plate. Esc leaves it. After 22 quiet seconds she says something on her own, using the local model.

For OBS or a second window, use one of these, or the **Output window** links in the side panel. It draws exactly what the page you're controlling is performing, including captions and a model you loaded. Keep the controlling page open and visible, because a hidden page stops sending frames. The output window carries no sound, so capture the controlling page's audio in your streaming software. If no controlling page is open, the output window performs on its own, on idle talk:

```
http://localhost:8765/?obs=1&bg=green
http://localhost:8765/?obs=1&bg=clear
```

**Studio** also has a calm camera with no zooms or shake, and can turn the mood backdrop off. The **Background** button cycles room, green screen and transparent, on all ten characters. On green and transparent, only the character and their marks are drawn.

**Live mic lip sync** in Studio lets you perform as the character with your own voice moving her mouth and no AI involved. Her own lines take over while she's speaking.

**Webcam tracking** is an optional plugin in `web/plugins/webcam`. It loads only when you click its button and only asks for the camera then. Your head, eyes, brows, blinks and mouth drive the character like a mirror, and the way you're facing when it starts counts as straight ahead. Video stays in the browser. While she's talking, her voice keeps the mouth. Delete the folder and the rest of the app carries on, and the button says so.

## Studio controls

On Vita, the buttons on the stage turn her (front, three-quarter, side, back) and hold a full-body shot. The meter beside Sound shows the sound leaving the app: if it moves and you hear nothing, check your output device and the browser tab. If a browser blocks sound, a button on the stage says so.

**Perform** has the Expression slider, feelings, moves and sounds. **Talk** shows each character's conversation. **Studio** has voices, going live, models, tracking and shortcuts. The bar under the stage shows her mood, with quick moves, Record, Stop and the reel, which plays in chapters with Pause.

**Record** saves the stage, captions and her voice to a video file in your downloads, even while muted. It doesn't include your mic. Shortcuts: Esc stops everything, F stream mode, M mic, R record, Space pauses the reel, and W, S, D, J, C, B, H, P and E play moves. They're off while you type.

Your expression level, character, panel, display, animation timing, mute and voices are remembered, and so is a model you load, until **Back to Vita**.

## Acting beyond the face

**Vita's full-body moves:** spin, dance, hop, celebrate, clap, bow, heart and point, as tags Gemma can use or buttons in the side panel. They're keyed by hand with anticipation, holds and recovery. Her feet stay planted, the pelvis moves over them, the spin turns about the ball of her standing foot, and the shot widens to full body for the moves that need the floor. Other models scale from her height.

**Mochi and Vee's eye reactions:** blink, wink, side-eye, sparkle, heart, roll, peek, doze, groove and wake. Hearts, stars, lids and rings are one outline that morphs, so any feeling or reaction can cut off another and still settle. **Display** switches Mochi between eyes and mouth, eyes only (`?display=eyes`) and the old 128x64 pixel look. Body language plays out on the screen: a nod dips the eyes, and the shell stays still.

**Names:** every character keeps their own conversation. "Who are you" and similar questions, when they're the whole message, are answered from the character's own sheet rather than by the model, and the chat labels that reply "intro, local". Everything else goes to Gemma.

## How it works

```
text with tags --> parser --> queue --> voice audio --> analyze --+
"[joy] Hi! [laugh]"             |                                 v
                                +--> emotion / gesture --> RIG --> skeleton --> any renderer
                     pointer, typing, blinks, gaze ------------^
```

- **Rig (`web/rig.js`):** each channel is a spring with its own stiffness, so overshoot and follow-through come for free. It layers emotion, idle life (blinks, eye movements, breathing), gestures and speech.
- **Skeleton (`web/rig.js`, `web/render-anime.js`):** real joints, nothing is stretched. Spine, chest, neck, head and jaw each turn on their own pivot, and the chest and shoulders follow the head later and less, so motion travels through the body. Arms are 3D two-bone IK: wrists aim for what the hands are doing (keys, a wave, a shrug), elbows are computed, wrists lag so hands have weight. Each hand has jointed, curling fingers. Hair and drawstrings are secondary springs.
- **Anime look (`web/render-anime.js`):** one 3D body per character, so a turning head keeps its proportions and nothing can cut off. This is the method anime games use (Guilty Gear Xrd, Genshin). The head is compressed along the camera axis, which keeps the flat big-eyed read at any angle. Face normals are replaced by a sphere's, so shadows stay clean. Light is hard two-tone, with a heavier ink line on the silhouette and a finer one inside. The eyes, brows and mouth are painted in the head's own coordinates, and brows show through hair as in drawn anime.
- **Artist models (`web/render-vrm.js`, `web/model-map.js`):** the same channels drive a real model. Bones come from VRM's humanoid map, or for a plain glTF from common names (VRoid, Mixamo, Blender). Face shapes bind to morph targets by name (VRoid, Seed-san style, VRChat, ARKit, MMD), with a VRM's standard expressions as a fallback. Arms are the same IK using the model's own bone lengths. Spring bones authored in a VRM run as authored. The artist's textures and MToon colours are kept, and one toon material replaces the rest: head flattened along the camera axis, sphere normals on the face, hard two-tone light, a hard shadow from hair and chin, and the same ink pass.
- **Acting (`ACTING` in `web/model-map.js`):** each feeling has its own hand poses, placed relative to the model's face, chest, hips and shoulders so they fit any body: chin in hand when thinking, hands on hips when angry, hands up in shock, hand over the mouth when laughing. Springs carry the hands between poses, and talking stirs them.
- **Drawn acting (`web/anime-fx.js`, `CAMERA`):** what an anime cuts to around a feeling. Manga marks track the head (sweat drop, anger vein, tears, blush hatching, gloom lines, heart and sparkle eyes). The backdrop changes with the mood (shock lines, sunburst, falling rain, floating hearts, stage beams). The camera acts too, with a smash zoom on a shock, a slow drift when sad, and a pull-back for big gestures. Pupils shrink in shock, one brow can lift alone, and the mouth slides into a smirk, all in the vertex shader because these models have no morphs for them.
- **Anime timing:** a new pose shows 12 times a second ("on twos"), and the mouth snaps between a few shapes, like drawn lip flaps. The skeleton keeps running underneath. A button in the side panel switches to smooth 60 fps for comparison.
- **Lip sync (`web/voice.js`):** mouth shape comes from the audio itself, so any voice can be swapped in with no phoneme data. Loudness and two vocal resonances (formants) give open, wide, round and teeth. Volume onsets kick the brows, head and shoulders.
- **Speech (`server.py`):** Piper neural voices run on the CPU and stay loaded in memory. Each character picks a voice and a pitch. If a voice can't load, the browser uses its built-in synth.
- **Singing and laughing (`web/voice.js`):** a small built-in voice synth handles what TTS can't. Any lyric gets a tune, and the mouth runs through the same analysis.
- **Gemma (`server.py`):** LM Studio's chat endpoint can't turn off Gemma 4's hidden thinking here: it costs about 2.5 s per reply, or leaks the plan into the answer. So the server sends a raw Gemma prompt and starts the reply on `[`, which skips the planning.

## Measured on an M1 Max

| | |
|---|---|
| Cost of one anime frame, 640x720 / 1400x1000 | Ace 9 / 13 ms, Sol 8 / 15 ms, Nori 7 / 13 ms |
| Cost of one Vita frame (82 mesh parts; shadow, colour and ink passes, drawn at twice the pixels on a 1x screen), 640x720 / 1400x1000 | 2.5 / 4.8 ms |
| Time from send to first sound | 1.0-1.2 s with Gemma E4B in LM Studio once loaded, now that she speaks the first clause as soon as it exists (about 9 s if LM Studio has to reload the model), 13-166 ms with the scripted brain |
| Time from the end of your sentence to her voice, by mic (test speech through the page) | about 2.5 s: 0.65 s waiting to be sure you stopped, 0.3-0.45 s for Whisper, 1.5-1.7 s for Gemma |
| Mic speech detection | 3.5 µs per 30 ms of audio, in Node |

With Gemma, nearly all of that is the model: about 0.75 s to its first token, then finishing the first sentence.

### Against local-avatar-demo (KIN), November 7

Both apps in separate muted Chrome profiles, three alternating runs each, same Gemma E4B, same Kokoro Heart, same prompts. The Mac was busy throughout. Raw results and scripts are in `evidence/benchmark-2026-11-07/`.

| | KIN | Nori before | Nori now |
|---|---|---|---|
| Kokoro, 6 new sentences each, median | 0.28 s (MLX) | 1.57 s (ONNX) | 0.24 s (MLX) |
| Chat: send to first sound | 1.8-2.5 s | 1.2-7.7 s, median 4.0 | 0.9-2.2 s, median 1.9 |
| Reel: click to first sound | 0.67-0.80 s | 0.04-0.05 s | 0.04 s |
| Reel: freeze at the start | 0.18-0.27 s every run | none | none |
| Reel restarted while preparing | | silent until reloaded | first sound 0.5 s, full reel |
| Page load to animating | 0.37-0.46 s (Momo) | 0.95-1.6 s (Vita) | about 1.0 s (Vita) |

What changed: Kokoro runs on the Apple GPU through MLX with a 128 MB buffer cache; a restarted reel no longer waits on the stopped one; Stop drops waiting speech requests in the browser too, so the cancel isn't stuck behind them; the reel and its preparation share requests and keep their lines, so nothing is rendered twice.

### Arms and body

Vita's torso, hips (coat tails included) and thighs are measured from her own mesh as slices on each bone, and her wrists, fingertips, forearms and elbows are kept outside them every frame. A hand that reaches her rests on the surface. Measured on every finger joint over 90-200 frames: idle, heart and spin never inside; clap, dance, wave, bow and hop inside on 1-2% of checks, at most 2-3.5 cm, for a few frames during fast moves. Before and after: `evidence/arms_before_after_idle.png`.

### Final round

Reel, measured as the sound actually leaving the audio graph against her jaw, every frame:

| | Old demo | First Kokoro reel | Final |
|---|---|---|---|
| Longest silence | 0.54 s | 4.88 s | none over 0.4 s |
| Largest gap between lines | 0.34 s | 4.83 s | 0.33 s |
| Sound against jaw | 10 ms | 0 ms | 10 ms |

From the click on Play reel to first sound, in Safari's engine: 126-215 ms once the page has settled, about 4 s if pressed straight after loading. That engine is not Safari itself, and its autoplay rules are looser.

### Interface and voice round, measured while this Mac was busy

The machine's load average stayed between 17 and over 100 throughout, with other apps running, so treat these delays as an upper range rather than what an idle machine would do.

| | |
|---|---|
| Send to first voice, Kokoro | 2.5-5.7 s, plus one 12.5 s outlier on the first line after a restart |
| Send to first voice, Piper, same run | 1.4-3.2 s |
| Kokoro alone | about 0.7-1.4 s for 2 s of speech on quieter moments, up to 4 s under the heaviest load; a repeated short sound is instant |
| Whisper round trip on the samples | every sentence came back right or nearly so; "came by" became "can buy" on one Kokoro voice, and "Ha ha ha" alone became "Bye-bye-bye" |
| Singing, Kokoro, 15-note test song, measured back | all 15 within 50 cents; median 2.7, worst 11 |
| Sung words, Whisper | "Tiny little lights are glowing" was right; "wires" came back as "Why? Here's" or "Why is" |
| Cloned voice, from a public-domain 8 s sample through the real file picker | spoke, sang and was deleted; 2.6-3.2 s for 3.2 s of speech once loaded |
| GPT-SoVITS on this Mac's CPU, same sample | 14-41 s per sentence, 2.5-5.5 times slower than real time, under heavy load. Not usable live here. It wasn't tried on the GPU |
| Long stall on the page | a 250-630 ms stall during her first line was audio start-up, now moved to page load. A 15 s take with talk, spin, song and recording ran at 60 fps with no long tasks, in a separate muted Chrome |
| Recording | 15.8 s H.264 and AAC, 1012x710; Whisper heard her words back, with Sound muted in the app |
| Stop mid-spin | ended within 0.5 s, finite, facing front |
| Reel, Space, Esc, keyboard moves, no moves while typing, settings surviving a reload, no sideways scroll at 390 and 900 wide | all behaved |

By ear: the Kokoro Heart and Chatterbox Turbo clone samples were picked as the best of the set by the person listening. The experimental voice singing was judged terrible. Of three song samples in Kokoro Heart (spoken on the beat, sung, half-sung), half-sung was chosen, and is now the reel's song; in the app it has only been checked by measurement (her mouth stays shut through the music-only bars, and speech recognition reads the lyric back with one word smudged). **Record 8 seconds** with a real microphone was not exercised: the fake test microphone delivered silence, and the app correctly refused it. Reel Pause was only checked by its controls, not by audio. The voices were not exercised with an output window open. Lip sync on 24 kHz voices was checked by mouth movement, not by eye.

### This round's checks

Automated, in `node test.mjs` and `test_voice.py`: all 16 eye moods; a new feeling every 0.12 s and a reaction cut off every 0.18 s for a minute, with stalled-tab steps, stayed finite with a largest single-frame outline jump of 38 on the 1024-wide display; wink, peekaboo, anticipation and recovery; all eight moves finite and starting and ending in the stance; intro matching; plugin mirror signs; relay delivery, NaN and bad-origin refusal, and closed-window cleanup.

Scripted in the page, not kept as tests:

| Check | Result |
|---|---|
| Mochi's 383,360 pixels outside the screen, 104 checks across 14 emotions, 20 reactions or gestures, talking and a log line | none changed. On a fresh page, two runs saw the shell's edge pixels change once with no change in geometry, and that stopped when the test let the canvas settle first. It looks like Chrome switching renderer because the test reads pixels back, though that cause isn't proven |
| Vita's feet against their marks through all eight moves at full weight, ignoring the spin | under 0.01 cm off |
| Spin: the ball of the standing foot over the full turn | 0.01 mm of travel |
| Corner alpha, all ten characters, on green and on transparent | zero on all 20, after fixing the three anime rooms that still showed. Composited over magenta to look for leftovers before that fix |
| Output window in a separate Chrome process, 22 s, following view, emotion, move and reaction changes | every change followed; frames arrived in 3 ms median, 8 ms at p95, 83 ms worst; 60 fps; a closed window stopped counting within about 6 s |
| Webcam plugin with a rendered Maya at known angles, 22 ms per frame in its worker | head, gaze and eye signs correct after one correction; a downward or sharply turned head was sometimes lost on her stylized face |
| Real Gemma, typed: 3 intros and 2 chats | intros made no model call; Mochi's history stayed out of Vita's request |

Frame timing, real `requestAnimationFrame` in a separate headless Chrome at 1400x1000 (`frame` is JavaScript submission time, not GPU work):

| | fps | p99 gap | worst gap | frame |
|---|---|---|---|---|
| Mochi idle | 60 | 16.8 ms | 16.8 ms | 0.2 ms |
| Mochi, rapid reactions and emotions | 59.1 | 16.8 ms | 133 ms, once | 0.8 ms |
| Vee | 60 | 16.8 ms | 16.8 ms | 0.6 ms |
| Vita idle, on twos | 60 | 16.8 ms | 16.8 ms | 1.5 ms |
| Vita dancing, on twos | 60 | 16.8 ms | 16.8 ms | 1.1 ms |
| Vita dancing, smooth | 60 | 16.8 ms | 16.8 ms | 2.9 ms |
| Vita spinning, smooth | 60 | 16.8 ms | 16.8 ms | 3.0 ms |
| Vita talking, spinning, dancing and singing | 59.2 | 16.8 ms | 183 ms, once | 2.1 ms |

The cause of the two one-off hitches wasn't found.

Footage in `evidence/`: `before_mochi.mp4`, `after_mochi.mp4`, `before_vita.mp4`, `after_vita.mp4`, drawn from the app's own canvases with no sound. The before clips ran on a timer with the voice clock, the after clips on a virtual clock with real voice analysis driving the mouth, so they're for looking at the acting, not for comparing timing. They were scripted to match where possible, and the after clips add the new moves and reactions.

## Quality, honestly

Vita is a large step up from the code-built characters, and that difference is the artist's design rather than the renderer. It reads as a current anime game or VTuber model, not film anime: the pose comes from a rig, not an animator, and the model is a free sample. The code-built Ace, Sol and Nori remain below that, because they have no artist's hand in them. For better results, use a stronger model and add animator-made key poses.

## Not tested or not done

- Claude was only run against a local stand-in for the API, never the real service.
- Only the Kokoro Heart and Chatterbox Turbo samples have been judged by ear. Live delivery in the app, singing, the pitch shifts and Rook's ring-modulated voice have not. Audio timing and analysis were measured, but voice quality is unjudged.
- Only tested on this Mac, so frame rates on robot hardware are unknown. All the anime and 3D characters need a real GPU; for weaker hardware, bake the shapes to a mesh and keep the bones and the flatten.
- Artist models were tried on four files: VRoid samples E and F (VRM 0), Seed-san (VRM 1), and sample F with its VRM data stripped (plain glTF). Mixamo, Blender, ARKit and MMD names are only checked by unit test or not at all, with no real model. A glTF bound in an A-pose would have its arms off. A `.gltf` with separate buffer or texture files won't load from the file picker.
- Hands use fixed poses, not contact solving, so on a very different body a hand may float off or sink into the chin or chest. They were tuned only on Vita. Only Vita has been tried with the acting, marks and camera. Stream mode's backgrounds are built for the Vita tab only. Material colour changes inside VRM expressions are ignored. The body shifts as a whole for crouch and lift, so a full-body shot would show the feet slide. Hands can pass through big hair or skirts: there's no collision with the arms.
- OBS itself was never run. Green and transparent were checked in the browser, and the relay in a separate Chrome process. Real webcam tracking was never tried: the Browser pane blocks cameras, so the plugin was run on rendered frames of Maya, and how it feels on a real face is unknown. `BLINK_FLOOR`, `BLINK_RANGE` and `HEAD_GAIN` in the plugin are the first things to tune. Sound was not judged by ear this round either.
- Vita's moves have no collision, so hands and hair or skirt can pass through each other, and they were only tried on Vita. A move plays through to its end once started. Mochi's sheet shows every emotion and reaction, but the eyes borrow most of their shape language from the other project, so Mochi looks more like it than before.
- The mic has had one real-world check: a person reported it working well in their own browser. The specific cases (interrupting, her own voice coming back, noise, turning it off midway) were only measured with speech fed into the page as a stand-in stream, because the Browser pane blocks microphones, so the loudness gates in `web/ears.js` may need tuning for other rooms and speakers. English only with the default model. No live words while you talk, and an OBS browser source has no mic of its own: talk to the controlling page and the output window follows.
- Viewer chat isn't connected: stream mode's chat shows what's typed or said into the page and her replies, nothing from Twitch or YouTube. There's no webcam face tracking.
- Licensing for a shipped product: three.js and three-vrm are MIT (`web/vendor`). MediaPipe Tasks Vision and its face landmarker are Apache-2.0 (`web/plugins/webcam/LICENSE-mediapipe.txt`). Vita is CC0, see `web/models/LICENSE.txt`. Check each model you load: the panel shows the licence stored in the file, and under the VRM license an avatar can only act as a character or be redistributed if its author's settings allow that. `piper-tts` is GPL-3.0, and `kokoro-onnx` pulls in the GPL-3.0 `phonemizer-fork` and eSpeak NG, so get those reviewed before putting either in a closed-source product. Kokoro's weights are Apache-2.0. Chatterbox Turbo is MIT, and each person is responsible for having the right to clone a voice. The MLX path adds `misaki` (Apache-2.0), `spaCy` and `en_core_web_sm` (MIT), and `num2words` (LGPL-2.1). `faster-whisper`, the Whisper model and its Silero speech filter are MIT. The Kristin, Bryce and Norman voices were trained on public-domain recordings and Joe on CC0, per their model cards. Gemma has its own terms.

## Sources reused from local-avatar-demo

Copied or adapted at the user's request from the sibling project KIN. Nothing in that folder was changed.

| Here | From | How |
|---|---|---|
| `web/motion.js` | `public/js/motion.js` | keys, curves and sampling kept. Moves this app already had (wave, wink, shrug, nod, shake) removed |
| `web/eyes.js` | `public/js/eyes.js` | outline, moods, reactions and springs kept, reformatted. Rig input and display size changed, and marks moved |
| `web/plugins/webcam/index.js`, `worker.js` | `public/js/puppet.js`, `tracking-map.js`, `face-worker.js` | rewritten as a plugin for this rig. Mirror signs measured here, blink remap and zeroing added, mic lip sync left out |
| `web/plugins/webcam/vision_bundle.js`, `wasm/`, `face_landmarker.task` | `public/vendor/mediapipe`, `public/models` | unchanged copies of `@mediapipe/tasks-vision` 0.10.21 and the model, sha256 `64184e22...9ff` |
| Output relay in `server.py` and `web/app.js` | `performance_relay.py`, `public/js/output.js` | same idea, written for this rig's frames |
| Leg IK, pelvis drop and spin pivot in `web/render-vrm.js` | `public/js/renderer.js` | the method, written for this solver |
| Intros from character sheets | KIN's identity routing | the idea, with a new matcher and lines |
| `web/plugins/lipsync.js` | `public/js/tracking-map.js` (`micToRig`) | the idea, rewritten for this rig's mouth channels |
| Studio singing in `lyra_singer.py` | `singing.py`, `soulx_singing.py`, `singing_reference.py` (symlinks into JaegerLyra) | the same route: JaegerLyra's own scripts and environments are run as they are, nothing copied or changed; the job runner and controls are written here. SoulX-Singer is Apache-2.0 |
| Voice delivery in `voice_engine.py` and `web/app.js` | `expressive_worker.py`, `public/js/audio.js` | misaki through mlx-audio's pipeline, the gentle pacing per feeling, the loudness levelling, no pitch shifting, laughs spoken in her voice |
| Conversation panel with the message box beside her | `public/index.html` | the idea, in this app's own look |
| Half-sung songs in `song.py` | `kokoro_singing.py` (a symlink into JaegerLyra) | the method: Kokoro's own decoder given the tune's pitch and stretched timing. Written here, with part of her speech inflection kept, a music box and a voice-only track for the mouth |
| Kokoro on MLX in `voice_engine.py`: the cached pipeline per language, and a 128 MB MLX buffer cache | `expressive_worker.py` (a symlink into JaegerLyra) | the method, written for this engine. The cache limit halved Nori's median time a line in a side-by-side test |
| View buttons, full-body framing, calm camera and backdrop options | `public/index.html`, `public/js/renderer.js` | the ideas, written for this renderer |
| Interface structure in `web/index.html` and `web/app.js` | `public/index.html`, `public/style.css`, `public/js/app.js` | the ideas: panel tabs, emotion grid with icons, mood readout, Stop, chaptered reel, shortcuts, tap-to-react, and MediaRecorder capture. Written here, in this app's own look |

`web/classic/` is the previous version of this app, restored file by file when this interface replaced it.
