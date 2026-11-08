# Current status — November 7, 2026

## Implemented in this repository

- `avatar/v1` foundation owned by Jaeger Avatar, superseding character packs for
  new authoring. Loader, validator, path resolver and repeatable source importer.
- 39 avatars with 39 persona profiles and 45 representations: Mochi's 18 packs,
  JaegerAI's 20 packs and JaegerAgent's default assistant persona. Shared characters
  preserve independent source variants. No agent engine is copied.
- Five additional visual packs recovered from UI assets and branch history:
  sculpted Jaeger, Atlas, Nova, Relay and bronze Jaeger. Six source MP4s decode
  successfully. Earlier renderer experiments are retained as archives, not plugins.
- Clanker already includes its persona, lore and card; its UI portrait is a
  byte-identical duplicate. No additional Clanker model/animation was found.
- A reviewed, commit-pinned Git importer expands a copy of the seed catalog
  without modifying source checkouts or overwriting existing authoring.
- Original assets, persona text, traits, SOUL/lore, scripts, license declarations
  and hashed provenance. Fifteen Mochi folders were imported from locally modified
  working trees; their provenance records this rather than claiming clean commits.
- Five missing JaegerAI avatar-directory placeholders are recorded explicitly;
  their available appearance remains the original card image.
- Product-specific README, scope, architecture, pack and milestone documents.
- Responsive GitHub Pages source in `docs/`, with an illustrative expression/gaze
  sketch. No model, microphone or account is used by the site.
- CI validates pack source integrity, exercises import/loading and checks site/docs.

## Not implemented

- Installable/runnable avatar application, GUI pack editor or renderer.
- Embedded JaegerAgent and connected JaegerAI adapters.
- Consumer migration from `character/v1`, legacy export or Aether interchange.
- Speech, persistent agent sessions, 3D rendering, tracking, recording or streaming.

The pack tools run from the repository with `requirements-packs.txt` installed.
The `workspace/`, `examples/`, `{{package_name}}/` and packaging examples remain
inherited references. `VERSION` is inherited metadata, not an application release.
Importing a procedural file does not qualify its execution in Jaeger Avatar.

## Verification

`python3 -m jaeger_avatar.packs validate` checks all 39 packs, declared resource
paths and source SHA-256 hashes. `python3 -m unittest discover -s tests -v` passes
17 tests covering real imported variants, source lore precedence, historical
MScript paths, missing models, repeatable import, overwrite refusal, unsupported
schemas, source tampering, paths escaping a pack, additive import failure cleanup,
duplicate-card detection and the distinction between media and archived prototypes.

Run `python3 scripts/check_site.py` and `git diff --check` for site/docs changes.
The updated website passed Chromium checks at 1440, 1024, 768, 390 and 320 px,
including expression buttons, keyboard gaze, reduced motion and no-JavaScript
content with no browser errors or horizontal overflow. The expression
sketch is still illustrative and is not rendering the imported library.

The website publishes through the existing `gh-pages` branch at
https://jenkinsrobotics.github.io/JaegerAvatar/ . See
[publishing instructions](../../../docs/SITE.md).
