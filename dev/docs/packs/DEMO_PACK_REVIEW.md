# Demo pack review — November 8, 2026

## Result

The local app has a launchable live representation for all 51 current packs.
Open `/demo-packs.html` on the running app server. The page uses the live catalog,
links directly to each selected rig, and can filter the 16 new vector studies.
The main application still opens a single selected avatar; its 13 featured
character tabs remain unchanged. The library count now follows the catalog.

Start on macOS from the repository root:

```sh
./run.sh --scripted --port 8790
```

Open `http://127.0.0.1:8790/demo-packs.html`. Scripted mode removes the need for a
conversation model; the existing Kokoro pipeline remains available. The launch sweep used an isolated review instance on port 8796. The main
application was then restarted and verified on its usual port 8790.

## Review of the earlier work

- Confirmed: the 38 added rigs use the built-in renderers and live in the library,
  not the featured tabs. Shared geometry was real, not a loading bug.
- Confirmed: 16 fan-character packs selected the identical desaturated visor.
  Replaced those selections with an allowlisted `jaeger-study` canvas renderer.
- Preserved: original media, canonical identity/persona separation, source hashes,
  both Vita appearances, authored demo metadata, and existing default appearance
  selectors. The launcher chooses a live rig explicitly instead of changing a
  pack's default portrait/video choice.
- Fixed: a missing card in a concurrently added pack could fail the complete
  `/api/avatars` response. Invalid packs now appear unavailable while valid packs
  remain selectable. Strict pack validation still rejects incomplete packs.
- Fixed: gallery search respects hidden cards; counts are dynamic; preview
  rendering pauses when the document is hidden. New studies do not advertise
  full-body quick moves that their bust/display designs do not implement.

## The 16 studies

Anakin, Eren, Kamina, Lelouch, Simon and Paul have procedural portrait geometry,
distinct hair/costume/accessory configurations, eye closure, gaze, brows and
mouth controls. Bender has a cylindrical head, antenna and animated tooth grille;
GLaDOS a suspended housing and optical core; HAL a lens/speaker panel; TARS a
segmented block body and signal display; JARVIS concentric signal rings;
Helldiver and the two Daft Punk studies have different helmet/visor designs;
EVE an oval body/faceplate and speech indicator; Patrick a star silhouette.

These are stylized **2D vector fan studies**, not AAA models, full-body skeletal
assets or exact reproductions. They consume the existing `Rig.out` pose. Mouth
or indicator motion uses its audio-driven jaw channel; mouthless characters do
not acquire fictional human lips. Human portraits also respond to small head
pose changes. The gallery's mouth test is explicitly silent synthetic motion.
Actual recorded Kokoro playback was exercised through the app's Studio comparison.
Other packs retain their existing shared rig families and cards; they are not
claimed to have newly unique meshes. Truth was added concurrently by the other
agent and retains that agent's white stand-in design.

## Provenance and scope

No downloaded artwork, new model weights, or third-party animation dependency
was added. The new renderer is app-owned code; packs only select known presets.
Existing source snapshots and their hashes remain intact. Existing persona and
model license declarations were preserved, not independently cleared or expanded.
Fan-character rights are not granted by the renderer's repository license.
This is a local demo completion, not a public asset-rights clearance or a physical
JP01 installation. Browser rigs still require the Jaeger Avatar runtime.

## Acceptance

Browser launch checks selected the expected active pane for all 51 current
launch links. The prior missing-card failure was identified during this run;
subsequent complete launch checks passed. No additional browser error appeared
in the completed run. Gallery search, expression, mouth test and pause controls
are exercised separately. Automated tests cover unique render command streams,
finite geometry through all supported emotions, speech response in all 16
studies, preset rejection and catalog isolation of incomplete packs. Pack source
validation, Python tests, JavaScript tests, site checks and whitespace checks
are required. Evidence is under `dev/evidence/demo-packs/`.
