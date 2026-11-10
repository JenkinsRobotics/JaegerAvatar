# Robot avatar deployment

The first target is the existing Mochi display dispatcher, which consumes
`character/v1` through JaegerAnimation. Jaeger Avatar remains the authoring owner
of `avatar/v1`. No downstream schema was silently changed. JP01's inspected
JaegerOS topology exposes controllers but does not specify an avatar playback
runtime or display dimensions; those remain a deployment prerequisite.

Direction ([one engine design](../vision/20261109_one_engine_design.md)): Jaeger
Avatar becomes the engine on the device and hands each display a video stream at
its size (JP01: a 64 × 64 face and two 24 × 1 LED rings; Mochi: 256 × 256). The
JaegerAnimation path below is the bridge until that evaluation.

## Build and verify

From the JaegerAvatar repository:

```sh
.venv/bin/python -m jaeger_avatar.deploy build --output dist/robot-packs-alpha-0.1
.venv/bin/python -m jaeger_avatar.deploy verify dist/robot-packs-alpha-0.1
```

Build refuses an existing destination. Use a fresh release directory for a new
revision. It validates original source hashes, rejects symlinks, copies every
canonical pack into `avatar-v1/`, and creates an explicit compatibility view for
each supported representation under `mochi-character-v1/`. Source data is never
rewritten. Every file has a SHA-256 checksum and the inventory is verified.
Checksums detect corruption; they are not publisher signatures.

The bundle contains 50 canonical packs and 45 legacy representation exports.
`readiness.json` lists every representation, including unsupported browser rigs.
A native pack is portable data, not a bundled renderer. Static images remain
labelled static; no portrait is claimed to be a fully animated robot face.
The complete native library preserves source and license records. Unspecified
licenses and third-party characters still require an owner decision before
redistribution; export does not change their rights.

## Mochi installation boundary

Choose one compatible representation per avatar. Each exported folder has a
`character.yaml`, chosen default persona and local display assets. Place the
chosen folder under Mochi's `characters/` directory to use its existing discovery
path. Do not install all alternative representations at once: they intentionally
share a character ID. Do not overwrite an existing character directory without
backing it up and choosing which representation should own that ID.

No automatic installation into Mochi has been performed. Default profile remains
the canonical pack's selection; full alternate profiles remain in `avatar-v1`.
Legacy MScript files and path aliases are preserved for provenance but are NOT
qualified for playback through the old project-root resolver. The verified path
is expression/mouth-state dispatch; motion scripts need a separate consumer
integration. Browser rigs (`avatar/rig-v1`) are not disguised as compatible legacy
packs. They require a browser renderer integration or authored raster exports.

## Offline consumer qualification

```sh
.agent-venv/bin/python -m pip install -r requirements-deployment-test.txt
.agent-venv/bin/python scripts/qualify_robot_packs.py \
  --bundle dist/robot-packs-alpha-0.1 \
  --mochi ../Mochi --animation ../JaegerAnimation \
  --output dev/evidence/deployment/mochi-offline.json
```

This imports the actual Mochi loader/dispatcher and JaegerAnimation renderer,
loads every compatibility export, dispatches its expression/mouth variants to a
capture-only bus, and renders RGBA at 128x128 at 0 and 500 ms. The agent environment
supplies JaegerOS dependencies. Tests send no robot or network commands. The
report records failures rather than treating a missing decoder as success.
Current result: all 45 exported representations passed offline rendering. The
qualification tool verifies bundle checksums before and after rendering and
disables Python bytecode writes so packs remain unchanged.

These checks validate asset decoding and dispatch, not target frame rate, visual
quality, sound, physical display operation or animation continuity.

## Remaining release gates

- Confirm JP01 display dimensions, pixel/color format, orientation and playback
  runtime; qualify on the actual target and record its resource budget.
- Choose browser-runtime versus baked clips/sprites for the browser-only rigs.
- Qualify motion-script path resolution before enabling legacy scripts.
- Resolve draft personas/placeholder visuals and redistribution rights per pack;
  the inherited library is preserved, not declared artistically finished.
- Install selected packs in a staging consumer, verify idle/talk/emotion/reset,
  cold boot and disconnected-input fallback before robot rollout.

The pack contains character data only. It grants no agent tools, carries no
private memory and does not map digital expressions directly to physical motors.
