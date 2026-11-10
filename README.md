<h1 align="center">Jaeger Avatar</h1>
<p align="center"><strong>A character, a voice, a place to perform.</strong></p>
<p align="center"><a href="https://jenkinsrobotics.github.io/JaegerAvatar/">Project website</a> · <a href="dev/docs/reality/STATUS.md">Current status</a> · <a href="dev/docs/vision/ARCHITECTURE.md">Architecture</a></p>

Jaeger Avatar now runs locally, built on **Nori's app, rig and presentation**.
Conversation sits beside the character. Perform, change expressions, play the
narrated reel, record a performance, or open a transparent/green output window.
KIN contributes Momo, the softer Vita appearance, optional vowel lip sync and
the prepared Singer A performance.

## Run

```sh
./run.sh
```

Open **http://127.0.0.1:8790/**. `./run.sh --scripted` needs no conversational
model; `--port 8790` selects the local port. On a fresh checkout, the launcher
creates `.venv` and installs `requirements-app.txt`. Neural voice/hearing models
are downloaded on first use. The application currently runs from source; there
is no packaged desktop installer.

The [demo pack launcher](http://127.0.0.1:8790/demo-packs.html) opens each live
character directly. See the [demo pack review](dev/docs/packs/DEMO_PACK_REVIEW.md)
for the new vector studies and their scope.

For conversation, install the optional [JaegerAgent host](dev/docs/runtime/SETUP.md).
It runs the public JaegerAgent API in a separate Python 3.11/3.12 environment,
with LM Studio at `http://127.0.0.1:1234` by default. The header identifies the
actual brain; without the agent/model, scripted replies and performances remain
available. JaegerAI is not required. The current agent has no tools enabled.

## Characters and packs

**56 avatar packs, 62 persona profiles and 104 representations; every pack has a live rig.** The existing
Mochi, JaegerAI and JaegerAgent library remains intact, including Clanker and the
sculpted Jaeger artwork. **Avatar library** shows live rigs, portraits, video
representations and source-only entries separately. Imported Python/MScript
artwork is preserved but not executed by the browser.

Fourteen live representations are included: Vita, Vita · KIN, Mochi, Vee, Nori,
Ace, Sol, Pip, Bo, Rook, Maya, Momo, JP01 and the archived Aster VRM. JP01 is
Jenkins Robotics' pan-tilt display head: Mochi's face on a square screen, with its
side LED rings and the head firmware's wake-up. It can also wear other faces, each a
library pack: JP01 Matrix (the firmware's blue LED eyes), JP01 T-Face (the warm
pixel face from the real build) JP01 Ring Eyes (the JX screen face) and JP01 Neon (line-art LED emotes, a grin,
<3, o_o, uwu and X_X, that switch with its mood). The Face menu under the stage switches
any JP01 between all of these and Mochi eyes with a mouth, lips or a voice waveform (lip synced
with Vita's vowel shapes).
JP01's body is the real Onshape assembly, opening on its top half like Vita. Vita's two looks
share a pack and conversation. Persona selection in Studio is independent of
appearance. Existing Mochi defaults and its original source variants are preserved.

Jaeger Avatar owns **`avatar/v1`**, the successor to character packs. Pack data
contains identity, assets and representation defaults. Conversations, model
configuration, credentials and tool permissions belong to the runtime.
An agent is optional for manual, scripted or tracked performance.

```sh
python3 -m pip install -r requirements-packs.txt
python3 -m jaeger_avatar.packs list
python3 -m jaeger_avatar.packs validate
```

See [pack format](dev/docs/packs/AVATAR_PACKS.md) and
[migration details](dev/docs/runtime/DEMO_MIGRATION.md).

## Voice, lip sync and singing

- **Nori remains the default lip sync.** Studio → Lip sync offers **KIN vowels +
  Nori smoothing**. The comparison button plays the exact same recording in both
  modes; change the selector and replay. KIN's five approximate vowel shapes use
  Nori's mouth springs while Nori continues supplying emphasis, blinks and body
  acting. Neither method provides text/phoneme alignment.
- **Singer A** is the exact prepared SoulX/Kokoro-reference recording preferred
  in KIN. Play it in Studio or leave **Singer A finale** enabled for an additional
  chapter after Nori's original reel. It is clearly labelled as prepared audio.
- **Fresh songs** use the JaegerLyra checkout through a process adapter. Configure
  `NORI_LYRA` if it is not beside JaegerAvatar. Model weights and synthesis scripts
  stay with Lyra. The saved Singer A sample works without Lyra installed.
- Kokoro speech, Whisper hearing, live mic lip sync, optional webcam tracking,
  local model loading, recording and output windows come from Nori. The local
  audio bridge is retained; JaegerOS speech-topic integration remains planned.

## Integration boundaries

| Project | Responsibility |
| --- | --- |
| Jaeger Avatar | Application, pack library, rig, rendering and performance coordination. |
| JaegerAgent | Actual conversational engine, hosted through its public API; no engine code copied. |
| JaegerLyra | Optional SoulX singing implementation and models. |
| JaegerAI | Optional connected-assistant integration, still planned. |
| JaegerOS / JaegerAnimation | Runtime contracts and robot display/media pathways; pose-bus integration is planned. |
| Mochi / JP01 | Robot demonstration and deployment consumers. |
| Aether Animation | Physical rig control, calibration and digital twins. |

The agent owns an in-memory session per browser conversation and pack. Switching
Vita's representation preserves it; Start over starts that character's new
conversation. Persistent memory, tools, pack authoring GUI, connected JaegerAI
and physical robot control are not part of this migration.

## Development

```sh
npm test
python3 -m unittest discover -s tests -v
python3 scripts/check_site.py
git diff --check
```

Browser acceptance results and lip-sync recordings are in
[dev/evidence/migration](dev/evidence/migration/). Historical Nori benchmarks are
retained under `dev/evidence/nori-baseline`; their measurements describe the old
apps, not this runtime. [Setup and verification](dev/docs/runtime/SETUP.md).

The static project website is in `docs/`; it is separate from the runnable app
and keeps its existing `gh-pages` publishing route. The inherited `workspace/`,
`examples/`, `{{package_name}}/` and `pyproject.toml.example` remain reference
scaffolds. [Documentation map](dev/docs/README.md).

## Licenses

Application repository: [Apache-2.0](LICENSE). Imported models, characters,
third-party code and optional engines retain their original terms. See the
[import and dependency inventory](app/licenses/README.md), original license
files, source hashes and each model's embedded metadata.

## Robot pack exports

Build portable packs with `.venv/bin/python -m jaeger_avatar.deploy build --output dist/robot-packs-alpha-0.1`.
The exporter preserves all 50 native packs and creates 46 explicit Mochi-compatible
representation views (including Mochi Classic). The previous 45 and the new Classic export passed local offline rendering; this is not physical
JP01 qualification. [Deployment guide](dev/docs/packs/ROBOT_DEPLOYMENT.md) and
[future development references](dev/docs/vision/OPEN_SOURCE_REFERENCES.md).

[Mochi demo family](dev/docs/packs/MOCHI_DEMO.md): Classic, Enhanced, Live and Portrait, alongside Momo Shell.
