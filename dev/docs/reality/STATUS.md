# Current status — November 8, 2026

## Implemented

- A runnable local application at `./run.sh` / http://127.0.0.1:8790/, using
  Nori's app, rig, camera and presentation as the foundation.
- 56 avatar packs, 62 profiles and 104 representations (JP01 added Nov 9, with face packs JP01 Matrix / T-Face / Ring Eyes / Neon (mood-driven emotes) painted by `app/web/kin/jp01.js`, which also holds the firmware wake-up and the 24-LED side rings: Jenkins Robotics' pan-tilt display head, `kin-momo` preset `jp01` in `app/web/kin/renderer.js`, loading the real Onshape assembly (`avatar-packs/jp01/model/jp01.glb`: hardware removed, decimated to 300k triangles, head posed forward; pan at the neck bearing, tilt at the NeoPixel hub; a Face menu switches faces live, including Mochi eyes + mouth lip synced with Vita's vowels) with a procedural fallback, and Momo's eyes laid out for its square screen. Truth added Nov 8: fan persona on its own 3D body, `nori-3d` preset `truth` in `app/web/render-truth.js`; personal fan study, rights not cleared). The prior 39-pack library
  is preserved; the demo import adds 13 live representations across 12 identities,
  including both Vita looks, Momo, all ten Nori characters and archived Aster.
- Every pack has a live rig. The other 38 packs got a built-in rig restyled with
  `render.look`, alongside their existing representations (Mochi's LED faces are
  kept). Sixteen former neutral stand-ins now have distinct procedural vector fan
  studies. Truth retains its separately authored white stand-in. Only Vita and
  Aster have model files; these vector studies are not new 3D meshes.
- The 12 demo packs have traits, lore, author, license and a card rendered from
  the live rig. The five design studies have draft personas, marked as drafts.
  Mochi visual packs and design studies still lack traits and lore.
- Pack-backed character selection and a library of live rigs, portraits, videos
  and clearly marked unsupported source representations. A portrait is not
  described as an animated rig. Native rig presets are allowlisted.
- Independent persona/appearance selection, per-pack browser conversation, and
  a real JaegerAgent host through its public API in a separate local process.
  Tools and skills are disabled; memory is in-process until server exit.
- Original Nori lip sync plus optional KIN vowels/Nori spring smoothing. The
  same-audio comparison and recordings do not imply phoneme/word alignment.
- Nori's original narrated reel with an optional prepared Singer A finale.
  Fresh SoulX songs delegate to JaegerLyra; no singer implementation is copied.
- Kokoro MLX/ONNX speech, Whisper hearing, manual acting, model loading, optional
  webcam/mic puppeteering, recording and transparent/green output inherited from Nori.
- Original source hashes, license records, tagged source baselines and reversible
  archival of the former demo working trees after independent launch verification.

## Reference-driven tracking hardening — November 8, 2026

A primary-source comparison of Open-LLM-VTuber, OpenSeeFace, three-vrm,
KalidoKit, VTube Studio's API and XR Animator is recorded in
[Architecture](../vision/OPEN_SOURCE_REFERENCES.md).
No renderer/agent replacement or new dependency was introduced. Webcam startup
failure, runtime worker failure and camera disconnect now release capture;
late results/bitmaps cannot revive a stopped session and non-finite tracking
values are rejected. Five synthetic lifecycle/mapping tests pass alongside the
existing rig and three lip-sync tests. Physical webcam and permission-dialog
acceptance remains unverified; these tests do not measure tracking accuracy.

## Control link and hardware streams — November 10, 2026

- `avatar-control/v1` gains `act` and `speak` (an uploaded clip, its duration,
  lip closures and text) and reports `stop_seq`.
- Packs may declare `presentation.controls`; an agent is offered exactly those.
  JP01 and Truth declare theirs.
- The demo server exposes a loopback, token-protected control link (`/control`).
  The page attaches with the body's controls, follows every command and logs it
  under Inputs. `scripts/avatar_control.py` is an example client. The link is optional: the
  app's own agent, TTS and STT already drive the pack.
- Under the stage, Outputs shows each simulated hardware stream at native size
  (JP01 face 64 × 64 and both rings, Mochi 256 × 256) at 60 fps, inline or in its
  own window. Face streams are stand-ins (the twin scaled down) until a pack ships
  a native-resolution look.
- A Settings window (top bar) has a page each for the app's own agent, voice and
  hearing. Agent: LM Studio model, creativity and longest reply, applied from the
  next reply without losing the conversation. Voice: the voice picker and a
  speaking-speed control, kept in this browser. Hearing: the Whisper model and
  language. Agent and hearing settings are saved in `app/.cache/settings.json`.
- A Data flow window (top bar, opens beside the app) shows every stage live, with
  real timings and contents: mic phrases, Whisper requests and transcripts, the
  agent's streamed text and first-text delay, the commands its tags become, each
  TTS clip (time to make, length, lip marks), playback, and every animation
  trigger. A timeline shows the last 20 seconds; every animation channel is drawn
  live with its rest value. It runs over a BroadcastChannel in this browser, and
  the app sends nothing while the window is closed.

## Still planned / limited

- GUI pack authoring, packaged desktop installers, persistent agent memory and tools.
- Connected JaegerAI, JaegerOS speech/pose bus integration and robot deployment.
- General execution of imported MScript/Python character representations.
- Word/beat-aligned acting. Both current lip methods estimate mouth shapes from audio.
- Clean-machine installer qualification. Local verification used existing model
  caches; real webcam hardware, room microphone behavior and OBS capture remain
  separate acceptance checks. Fresh song timing is not a latency guarantee.

## Verification

The migration browser run exercised every live representation with finite poses,
the same 4.325-second recording through both mouth methods, the 6.1-second Singer A
sample, Stop, reel Pause/resume, all eight original Nori chapters plus the Singer A
finale, and Clanker's portrait. Browser evidence is under `dev/evidence/migration`.
A fresh JaegerAgent/Gemma reply and a new 5.12-second SoulX song completed through
the new application. Twenty Python tests, the imported Nori rig suite and three new JavaScript
lip-sync regressions pass. The app was restarted and the full browser reel
repeated successfully after both old source directories were archived. Layouts
fit at 320, 390, 850 and 1280 px. Exported comparison MP4s contain H.264 video and
AAC audio. Delayed sample cancellation, Stop before a song job returns its ID, Pause during
voice preparation, shared conversation across Vita representations and Start over
all pass the browser lifecycle check. Regression results and retirement audit
are beside the browser report.

Required checks: `npm test`, pack validation, Python test discovery,
`python3 scripts/check_site.py` and `git diff --check`.

Website source is `docs/`; the existing `gh-pages` branch publishes the static
project page. Editing that source does not itself deploy it. The inherited
workspace/module examples remain reference scaffolds, not the running app.

## Robot pack preparation — November 8, 2026

`python -m jaeger_avatar.deploy build` exports all 50 canonical packs and 45
explicit character/v1 representation views for Mochi, with per-file checksums,
source integrity checks, no symlinks and a per-representation readiness report.
Nested clip-state paths are now validated as well. Export relocation and tamper
checks are covered by regression tests. [Deployment instructions](../packs/ROBOT_DEPLOYMENT.md)
distinguish portable data, consumer rendering and physical robot qualification.
Browser rigs still need a compatible renderer; legacy scripts, target hardware,
placeholder art, draft personas and redistribution clearance remain release gates.
No consumer installation or JP01 hardware deployment is claimed.

Offline consumer result: all 45 compatibility exports render through the actual
Mochi dispatcher and JaegerAnimation at 128x128. All declared expression/clip-state
choices were sampled at 0 and 500 ms. The original 50-pack bundle passes checksum
verification before and after qualification. Evidence: `dev/evidence/deployment/mochi-offline.json`.

## Named Mochi demo family — November 8, 2026

Mochi representations now have explicit names: Classic, Enhanced, Live and
Portrait. Momo Shell keeps its own identity. Classic is a new selectable
representation using browser-compatible H.264 copies of preserved original
clips. Library/tab labels use explicit representation names when present.
There are now 97 representations across the same 50 packs, with 46 legacy
export options. The [demo guide](../packs/MOCHI_DEMO.md) documents the standalone
comparison, reproducible bundle builder and runtime requirements. Three family
exports pass offline consumer rendering; Classic and Enhanced browser playback
and scene switching are verified. Physical JP01 qualification remains pending.

### Mochi procedural recreation study — 2026-11-08

`/mochi-recreation.html` compares the first original video pair against a
hand-authored procedural face on the existing fixed 3D body. Squint/wink and
Pong transformation work with synchronized scrubbing and independent playback.
Expression strength and gaze remain adjustable. No video pixels drive the face.
This is an approximate first-scene study, not a deployed robot pack or all-scene
recreation; see `dev/docs/packs/MOCHI_DEMO.md`.

## Demo pack completion review — November 8, 2026

`/demo-packs.html` launches the live rig for each of the 51 current packs.
Sixteen grey stand-ins were replaced with distinct allowlisted vector fan
studies, driven by the existing pose and speech channels. Other shared rig
families remain unchanged. A malformed/incomplete pack no longer blanks the
entire runtime catalog, and the main library count is dynamic. All 51 launch
links selected the expected active character in browser checks. See
[demo pack review](../packs/DEMO_PACK_REVIEW.md) for capabilities, scope, evidence
and the distinction between launchable demos and finished AAA/hardware assets.

## Shared application theme — November 8, 2026

Studio, the pack launcher, Mochi comparison and Mochi family demo now share
`app/web/theme.css`: the home page's dark panels, typography, borders and mint
accent. The portable Mochi demo builder embeds the same stylesheet so regenerated
bundles keep the application theme.

## Mochi embedded desktop consumer — November 8, 2026

Mochi now has a selected `procedural_3d` representation and a reproducible
single-avatar runtime bundle (~2.5 MB), built by `scripts/build_embedded_mochi.py`.
The native macOS consumer embeds the same shell/eyes and supplies its existing
JaegerAgent and Kokoro pipeline. The versioned control contract supports bounded
expressions, reactions, gaze, speech amplitude and Stop. See
[Embedding](../runtime/EMBEDDING.md). This is desktop integration; robot pixel
output and measured hardware audio alignment remain unqualified.

## Mochi companion pack release 0.2.1

The embedded Mochi runtime includes all ten idealized procedural Classic clips,
with named agent/manual actions and a version-pinned consumer lock file. Patch
0.2.1 restores canvas state after custom clip painters so live eyes resume at
the correct scale. Mochi's React desktop consumer uses the shared renderer
and its own JaegerAgent/Kokoro/Whisper services. This does not add those services
to JaegerAvatar or qualify physical robot deployment.

## Mochi audiovisual pack 0.3.0 — November 9, 2026

Mochi now contains original procedural Foley/synth WAV tracks for all ten clips
and selected reactions/emotions, with a portable Web Audio performance player.
The desktop Mochi consumer aligns audio to clip start time, cancels it on Stop,
mute, replacement and disposal, and ducks effects during speech. Speech synthesis
remains the host's Kokoro service. These are cartoon effects, not recorded human
vocal performances. The canonical pack owns the WAV assets and timing metadata;
no commercial reference audio is sampled. Other consumers must explicitly mount
the player; adding files does not automatically enable sound in every older demo.
The embedded builder supports a checksummed visual baseline so this audio release
can preserve the deployed renderer while unrelated visual work continues.
