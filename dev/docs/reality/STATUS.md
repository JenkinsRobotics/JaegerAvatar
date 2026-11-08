# Current status — November 7, 2026

## Implemented in this repository

- `avatar/v1` foundation owned by Jaeger Avatar, superseding character packs for
  new authoring. Loader, validator, path resolver and repeatable source importer.
- 34 avatars with 39 persona profiles and 38 representations: Mochi's 18 packs,
  JaegerAI's 20 packs and JaegerAgent's default assistant persona. Shared characters
  preserve independent source variants. No agent engine is copied.
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

`python3 -m jaeger_avatar.packs validate` checks all 34 packs, declared resource
paths and source SHA-256 hashes. `python3 -m unittest discover -s tests -v` passes
11 tests covering real imported variants, source lore precedence, historical
MScript paths, missing models, repeatable import, overwrite refusal, unsupported
schemas, source tampering and paths escaping a pack.

Run `python3 scripts/check_site.py` and `git diff --check` for site/docs changes.
The updated website passed Chromium checks at 1440, 1024, 768, 390 and 320 px,
including expression buttons, keyboard gaze, reduced motion and no-JavaScript
content with no browser errors or horizontal overflow. The expression
sketch is still illustrative and is not rendering the imported library.

The website publishes through the existing `gh-pages` branch at
https://jenkinsrobotics.github.io/JaegerAvatar/ . See
[publishing instructions](../../../docs/SITE.md).
