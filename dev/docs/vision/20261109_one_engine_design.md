# Design: Jaeger Avatar is the one animation engine

November 9, 2026. **Direction, not a work order. Nothing here is implemented yet.**
Decided with Jonathan in conversation; anything marked *(builder's call)* or
*(Claude's call)* was not decided by him and can be overridden.

**Order of work (Jonathan, November 9):** first finish avatar creation, the
packs, and the app working with a real agent. JaegerAnimation stays in place
meanwhile and may be used as a bridge to devices. What it still does is
evaluated at the end; the migration below is the expected end state, not
today's task. What's still open about JP01 (the firmware's boot and fallback
face, and a unit to measure 60 fps on), and what keeps running during the
move, wait until then.

## Intent

Jaeger Avatar is a complete, self-sufficient AI companion app: **an avatar
pack plus its own TTS, STT and agent** (Jonathan, November 10). The agent
drives the pack; nothing outside the app is needed for the full experience.
Inside it, the engine works on one rule: **commands come in, animation comes
out.** It turns the agent's commands into a performance and hands each display
a finished video stream at the size and ratio that display declares.

JaegerOS apps such as Mochi and JP01 copy the same recipe: **the same avatar
pack plus their own TTS, STT and agent**, with the same engine playing it. What
travels between them is the pack.

The reason for this design is drift. Today two engines play the same
character formats: JaegerAnimation in Python and Jaeger Avatar's renderers in
the browser. Two codebases for one job means the same pack can look different
on two devices, and every fix is made twice. One engine removes that.

## Decisions (Jonathan's)

1. Jaeger Avatar's engine becomes the only animation engine. **JaegerAnimation
   is expected to be removed** once its responsibilities migrate; until that
   evaluation it remains available as a bridge.
2. Jaeger Avatar treats every device as a screen. It produces a video stream
   at the display's declared size and ratio. It does not drive hardware: the
   device's display driver lights the pixels.
3. **Each app brings its own TTS, STT and agent** (Jonathan, November 10,
   replacing the November 9 wording that put them outside). The Jaeger Avatar
   app ships with them and is a full product, not a demo harness. A JaegerOS
   app (Mochi, JP01) ships its own. The agent drives the pack; it doesn't
   have to come from outside the app. The engine code stays free of any
   particular agent or speech engine so each app can plug in its own, and the
   control link (`/control`) is an optional extra way in, not a requirement.
4. Aether Animation is the authoring software (think Blender plus After
   Effects): it makes the rigs, animations, assets and scripts that make up an
   avatar pack. It supersedes the November 7 Aether Animation scope note,
   which narrowed it to physical rigs.
5. The pipeline is:
   - **Aether Animation defines the pack**: the rig, the controllable nodes
     (the channels an agent may drive, with names, ranges and defaults), the
     sprite sheets, bitmaps, clips and motion scripts.
   - **Jaeger Avatar is the engine an agent needs to control that pack**, and
     its app is the full experience: pack, TTS, STT and agent (or the pack as
     a simple avatar with no agent).
   - **A JaegerOS app runs the engine plus the pack, with its own TTS, STT and
     agent, to play it on a device.**
   The engine exposes exactly the controls the pack declares; it does not
   invent controls of its own.
6. Jaeger Avatar does not become full animation software. It plays and
   explains; it does not edit. **Authoring and playing are separate apps, like
   a game and its engine's editor:** a shipped game carries its runtime and
   its assets, not the tools that made them. Editors are used while a pack is
   being made and never again, so they live in Aether Animation; everything a
   device needs afterwards is in the pack, and the device only plays it.
7. The target is 60 fps.

## Goals

- One engine plays every pack format: procedural screen faces, code-built 3D,
  artist models (VRM), vector studies, sprite sheets, bitmaps, GIFs, clips,
  motion scripts (MScript) and procedural "math" scenes.
- A transport-neutral command interface usable from JaegerOS and from projects
  that don't use JaegerOS.
- Per-display video output at the declared size, ratio and frame rate.
- The same pack looks and sounds identical on every device, enforced by tests.

## Non-goals

- Hardware drivers, LED or Teensy protocols, colour calibration, brightness.
- Owning a speaker or a screen. The avatar is one source among many; JaegerOS
  decides what each device plays at any moment.
- Playing media that isn't part of a character (videos, calls, alerts).
- Motor or actuator commands of any kind. The app's agent and the Jaeger
  project own the physical rig.
- Editors and authoring tools (bitmap editor, MScript editor, timeline).
- Tying the engine to one agent or speech engine. Each app supplies its own.

## Anti-goals (failure even if it works)

- A second renderer for any character format, anywhere: on a device, in
  Python, in a firmware. If a device shows a character, it gets frames from
  this engine.
- Running code shipped inside a pack. Packs are data.
- The framework growing a studio: if a feature only helps author a pack, it
  belongs in Aether Animation.

## Who owns what

| Part | Owns | Does not own |
| --- | --- | --- |
| **Jaeger Avatar engine** (`jaeger_avatar/` and the renderers) | Packs (load, validate, lock), the engine and its renderers, the command interface, per-display video output, render status | A particular agent, TTS or STT; hardware; editors |
| **Jaeger Avatar app** | The full, self-sufficient experience: its own agent, TTS and STT driving the pack; the library, Pack assets and "How this is animated" exhibit; testing every output | Anything the engine needs to work |
| **Each app's agent** (JaegerAgent in Jaeger Avatar; Mochi's and JP01's own) | Deciding what the character says, feels and does; on a robot, also the physical rig | Rendering |
| **TTS / STT** (JaegerKokoroTTS, JaegerWhisperSTT) | Speech audio and its timing (including lip marks); transcripts | Mouth animation |
| **Aether Animation** | Authoring rigs and their controllable nodes, animations, sprite sheets, bitmaps, motion scripts; exporting avatar packs | Playback at runtime |
| **Jaeger project** (JP01 and others) | Display drivers (pixel format, orientation, brightness, the Teensy link), physical motion, deployment, packaging chosen packs | Rendering faces |
| **JaegerOS** | Bus, nodes, supervision, the display topic contract; on a device, running Jaeger Avatar plus the chosen pack as a node. **Owns the speakers and screens**: mixing and arbitrating every source (the avatar, video, calls, alerts), and playing non-character media | Rendering characters, character formats |
| **Mochi** | The app that proved the whole idea (making, programming and integrating an avatar). It keeps only what a player needs; its editors leave | Authoring tools |
| **JaegerAnimation** | Removed | — |

## The framework's contract

### Commands in

One command vocabulary, carried over two links *(Claude's call)*: a JaegerOS
bus node for the Jaegers, and a WebSocket for the demo app and non-JaegerOS
projects. The vocabulary, at minimum:

- **wear**: load a pack, choose its persona and render.
- **declare display**: an output's id, width, height, ratio, frame rate and
  pixel format.
- **speak**: speech audio (or a reference to it) on a clock, with timing marks:
  lip closures (`[start, end, "p" | "f"]`, already produced by the Kokoro path
  in this repo) and optionally vowel or phoneme timing.
- **feel**: an emotion and intensity.
- **act**: a gesture, reaction or move (wave, wink, clap, lean, stand).
- **look**: gaze or head direction.
- **play**: a pack asset or motion script by name.
- **stop / cancel**: clears pending speech and motion together.

Existing JaegerOS messages are reused where they fit: `DisplayCommand`
(`/act/display/play`), `DisplayStop`, `DisplayState` and `DisplayStats`. The
avatar-level commands (speak with marks, feel, act, look) need the
`/act/display/pose` and lip-sync contract additions already proposed in
[the runtime migration proposal](RUNTIME_MIGRATION_PROPOSAL.md#contract-gaps-to-propose-to-jaegeros-planned).
Those are drafted with JaegerOS, not forked here.

### Animation out

- **Small displays** (LED matrices; JP01's face): raw RGBA frames on
  `/act/display/frame` (`DisplayFrame`: width, height, RGBA8, `duration_ms`,
  `is_final`), exactly what such sinks consume today. Confirmed sizes
  (Jonathan, November 9): JP01's face is **64 × 64** with large LED pixels;
  Mochi's is **256 × 256** at a much denser pixel pitch. Even 256 × 256 is
  256 KB a frame, about 16 MB/s at 60 fps, which a local link carries.
- **JP01's two side rings are displays too** (Jonathan, November 9): each is
  a 24 × 1 output, a single row of pixels, in the same video stream. The pack
  can give them looks, animations, scripts and logic just as it does the face;
  the avatar never sets an individual LED.
- **The stream is the whole interface.** The hardware side decodes it and
  sets its physical pixels; the avatar never writes to a device. That is what
  makes the avatar side universal: any device that can take a video stream
  of its declared size can show any character that has a look for it.
- **Large displays**: a compressed video stream *(builder's call: codec and
  transport)*. Raw 1080p at 60 fps is about 500 MB/s, which no link carries.
- **Status**: `DisplayState` and `DisplayStats` per output, including actual
  versus target fps.
- **Pose data** *(Claude's call, optional)*: the engine may publish the
  character's resolved pose so a project can choose to mirror it on a body.
  Jaeger Avatar never sends it to motors.

## Migration of JaegerAnimation's responsibilities

| JaegerAnimation part | Goes to | Notes |
| --- | --- | --- |
| Image, GIF, video players | Engine (browser) | Already partly there (`MediaCharacter`) |
| Sprite player | Engine | The exhibit's sprite player is the start; it needs mood→cell and mouth-row mapping from the pack's props |
| Bitmap player | Engine | The exhibit already draws `bitmap_set` JSON |
| MScript runner (`mscript_engine.py`, `mscript_adapter.py`) | Engine, ported once to JS | Same script format; `[Resources]`/`[Main]`, `MATH`, `MEDIA`, `BITMAP`, `WAIT`, `D[]`, `FG[]`, `BG[]` |
| Math adapter (executes pack Python) | **Replaced** by named engine renderers | Packs name a renderer and its settings, as Bender's look names `screen-face/1`. Which of Mochi's `assets/math/*.py` scenes are kept is to be chosen with Jonathan *(builder proposes; `eyes`, `face`, `bars` look worth keeping, `test_*` do not)* |
| `character/v1` reference loader (`characters.py`) | Jaeger Avatar's `packs.py` | Already loads `character/v1` inside `avatar/v1` packs |
| JaegerOS node and `animation` slot (`node.py`, `module.yaml`) | A Jaeger Avatar node | Claims the slot, consumes commands, produces frames and status |
| Headless player CLI (`play.py --headless`) | A Jaeger Avatar headless runner | Same use: CI and development |
| Tests (`test_all_adapters_render`, `test_mscript`, character tests) | Jaeger Avatar tests | Become output fingerprints, like `tests/screen-looks.test.mjs` |
| `PIL`, `numpy` dependencies | Gone | |

Once every row is done and qualified, the JaegerAnimation repository is
archived and the dependents below are updated.

## The engine on a device

The engine runs headless on the device's computer (on JP01, the Jetson Orin),
renders each declared display at its size, and hands the frames to the
display path. Requirements:

- 60 fps sustained for the LED face at its native size, measured on the
  Jetson, with `DisplayStats` reporting actual fps.
- A latency budget from command to visible change *(builder proposes; the
  existing acceptance is "mouth within one frame of sound")*.
- How frames leave the headless browser is *(builder's call)*: reading the
  canvas and passing RGBA to the local node is the simplest fit for small
  displays.

## What changes in Jaeger Avatar itself

- Kokoro, the agent worker, Whisper and the singer stay in the app, as its
  own TTS, agent and STT. They drive the engine through the same command
  vocabulary a JaegerOS app's agent uses, so either can be swapped. The
  lip-mark code in `app/voice_engine.py` is part of the TTS side.
- The app keeps the library, Pack assets and the "How this is animated"
  exhibit.
- **The app demos and tests every output** (Jonathan, November 9): for
  the body on show it lists each display it would drive (JP01: the 64 × 64
  face and the two 24 × 1 rings; Mochi: the 256 × 256 face; a desktop window)
  and can open any one as a live view of exactly the stream that device would
  receive, at native resolution, with its frame rate and frame count. The
  existing "output windows" (a re-rendered character for streaming tools such
  as OBS) are a different thing and stay.
- Nothing in the engine imports a particular agent or speech engine.

## Mochi

Mochi started as a demo of the avatar and of how to make, program and
integrate one. As it grew it showed that making a pack and playing a pack need
different tools. Its editors move out; what remains is a player of packs.
Whether that player stays a Mochi app or becomes Jaeger Avatar plus the pack
on JaegerOS is decided at the end-of-project evaluation.

| Mochi part | Goes to |
| --- | --- |
| Characters | Avatar packs (mostly imported already) |
| Player, stage, virtual display | The engine; Mochi keeps its own TTS, STT and agent |
| Bitmap editor, MScript editor, MScript graph, character editor | Aether Animation |
| Display driving | The Jaeger project's display driver |

## Dependents to update

From a search of `~/GITHUB`:

- **JaegerOS**: `contract/topics.py`, `app/catalog.py`, `app/control.py`,
  `timeline/runner.py`, the animation contract and module-discovery tests.
- **JaegerAI**: `nodes/animation/`, `nodes/media/` (its media playback moves to a JaegerOS media path, not the avatar), the personality
  character loader and its tests.
- **jaeger_agent_omni**: its vendored copy of the JaegerOS files above.
- **jaeger-agent**: `tests/test_module_boundary.py`.
- **Mochi**: `modules/jaeger_animation.py`, `core/*`, `interfaces/*`, `main.py`.
- **Jaeger Avatar docs**: `vision/ARCHITECTURE.md` (says "JaegerAnimation
  remains useful for raster/display playback"), `vision/PRODUCT_SCOPE.md`
  (Avatar owns a character editor and embeds JaegerAgent), `packs/ROBOT_DEPLOYMENT.md`,
  `vision/RUNTIME_MIGRATION_PROPOSAL.md` (its decision 2 is settled: the engine
  runs on the robot), `scripts/qualify_robot_packs.py`, `reality/STATUS.md`.
- **Aether Animation**: `PRODUCT_SCOPE.md` (authoring software, not a runtime
  rig mapper).

## Keeping it from drifting

- One engine, one codebase.
- Every format is versioned (`screen-face/1`, the asset-props schema,
  MScript), and every pack's rendered output is fingerprinted. Changing an
  engine's output fails the tests until the pack version is bumped and the
  change approved, as already done for looks.
- A pack never ships code.

## Constraints

- 60 fps.
- JaegerOS is unreleased: pin verified versions when implementation starts.
- Licensing is unchanged by this design: Piper, eSpeak NG and `kokoro-onnx`'s
  phonemizer are GPL; fan-likeness packs (Truth, Bender and others) have no
  cleared rights.
- Develop on `dev`; `master` only through a release PR.

## Settled during review *(Claude's calls; each can be overridden)*

1. **Audio.** The speaker lives at the hardware level, in JaegerOS, and the
   avatar's speech is only one of its inputs (alongside video sound, calls and
   alerts). Speech audio goes from the app's TTS to JaegerOS's speaker, never
   through the avatar. The engine follows the speaker's playback position, which needs
   the playback-position addition to `/act/speaker/state` already listed as a
   contract gap; until it exists, the engine follows the clock carried with
   the `speak` command. The engine outputs no audio at all. A character's
   voice sounds (laughs, breaths, sighs, kisses) are speech too: the app's
   TTS voices them, or the pack carries them as recorded clips (as Mochi's
   `assets/performance-audio/` does) for the speaker to play. Either way they
   reach the engine as `speak` commands with timing, so the mouth moves with
   them.

   **Sound effects follow one rule** (Jonathan, November 9): a sound made for
   one specific animation belongs to it, like Mochi's Pong hits, its sleep
   bubble, or a kiss timed to a kiss. Generic effects stamped onto every
   expression (a chime for joy, a pop for neutral) are not used: they break
   the avatar illusion. An animation-bound sound is pack data with its timing.
   The engine doesn't play it; it emits a timed cue ("play this pack clip
   now") and JaegerOS's speaker plays it, exactly as it plays speech.
2. **Displays and tailored looks.** Each output the avatar is given has a role
   (`face`, `ring`), a size in pixels and a pixel pitch (how big each
   pixel is physically). JaegerOS decides when that output is actually on a
   screen. **A pack is tailored to the hardware** (Jonathan): a 64 × 64 matrix
   of big LEDs needs a look designed at that resolution, not a dense render
   shrunk until it blurs. So a pack's looks are frozen per display class, and
   a class is a shape plus a resolution (for example `square-64` for JP01,
   `square-256` for Mochi, `ring-24` for JP01's side rings, `wide` for a
   desktop window). The engine renders the
   matching look at the display's native size. If a pack has no look for that
   class, the nearest class may be scaled only within a small range, and
   otherwise the output is refused with a clear error; the engine never
   invents a layout. Fingerprints cover each class at its native size. Roles
   let a pack assign a face screen and side rings to different looks; Aether
   Animation exports looks per role and class.
3. **Qualifying migrated formats.** Not pixel parity with the Python engine.
   Before JaegerAnimation is removed, its renders of every pack representation
   are captured as reference images; each JS port is reviewed side by side
   against them, then its own output is frozen as the new fingerprint
   baseline. Content in scope is Jaeger Avatar's `avatar-packs/` (Mochi's
   characters are already imported there), including the imported MScripts.
4. **Media outside packs is not the avatar's job** (Jonathan, November 9).
   A video file, a phone call or any other media plays through JaegerOS's own
   media path, on the same screens and speakers, without the avatar knowing.
   The "no second renderer" rule is about character formats only: a plain
   video player is not a second avatar engine.
5. **Large-display streaming is deferred.** A large screen plugged into the
   machine running the engine is just a full-screen output. A compressed
   stream to another machine is built when such a display exists.
6. **The existing embedding contract is extended, not replaced.**
   `avatar-runtime-bundle/v1`, `avatar-control/v1` and `avatar-state/v1`
   ([EMBEDDING](../runtime/EMBEDDING.md)) are already how projects embed an
   avatar. The command vocabulary above becomes `avatar-control` operations
   (adding speak with marks, act, look, play, wear, declare display);
   `avatar-state` stays the status. A new major version is used only where a
   field must change meaning.

## Left to the builder

- Command message shapes and the WebSocket protocol.
- Codec and transport for large-display video.
- How frames leave the headless engine.
- The order of migration steps and how each is qualified.
- Proposing which math scenes to keep.
