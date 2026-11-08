# Current status — November 7, 2026

## Implemented in this repository

- Product-specific README, scope, architecture and milestone documents.
- Responsive GitHub Pages source in `docs/`, using the existing Jaeger palette.
- An illustrative browser-only expression sketch: neutral, curious and happy
  presets with a gaze slider. No model, microphone or account is used.
- A dependency-free site/document check and CI that runs the actual check.

## Not implemented

- Installable/runnable Jaeger Avatar application or real runtime dependency pins.
- Embedded JaegerAgent and connected JaegerAI adapters.
- Character-pack import/export/editor, 3D rendering or camera tracking.
- Generated speech, persistent agent sessions, recording or streaming output.
- Universal interchange between JaegerAI personas, Mochi packs and Aether formats.

The `workspace/`, `examples/`, `{{package_name}}/` and packaging examples remain
inherited references. `VERSION` is inherited template metadata, not a published
application release. No existing experiment has been imported as the product.

## Verification

Run `python3 scripts/check_site.py` and `git diff --check` for website/document
changes. The initial site passed Chromium checks at 1440, 1024, 768, 390 and 320 px
without horizontal overflow. All three expression presets, keyboard gaze control,
reduced-motion behavior and no-JavaScript content were exercised; no browser
errors were observed. Desktop and mobile screenshots were reviewed. This is
website verification only; runtime qualification requires separate tests.

Published through the existing `gh-pages` branch at commit `f5295b1`.
GitHub's Pages deployment and the source documentation/site CI both passed.
The public HTML, CSS, JavaScript and SVG each returned HTTP 200 and matched the
checked source byte-for-byte at https://jenkinsrobotics.github.io/JaegerAvatar/ .
This verification covers the initial project website, not the planned app.
