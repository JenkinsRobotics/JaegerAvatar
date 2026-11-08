# Jaeger Avatar project website

Canonical source: `docs/index.html`, `docs/assets/` and `docs/.nojekyll` on
`master`. The existing `gh-pages` branch publishes the contents of `docs/` at
its root. Keep one publishing route; do not also enable a Pages Actions workflow
or switch the source to `master/docs` without an explicit deployment change.

Expected site URL: https://jenkinsrobotics.github.io/JaegerAvatar/

## Preview and verify

```sh
python3 scripts/check_site.py
python3 -m http.server 8898 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8898/ . Check the expression presets and gaze slider with
mouse and keyboard, navigation anchors, a narrow viewport, reduced-motion mode
and a page load without JavaScript. The site is static; its illustrative face
has no agent, speech engine, tracking or model connection.

## Publish

Commit the verified source on `master`. Update the existing `gh-pages` branch
with the same `index.html`, `assets/` and `.nojekyll` at the branch root, preserving
any hosting configuration. Never overwrite the branch from a stale head; use a
fast-forward or an expected-head check. Verify the public page after GitHub's
Pages build. Source preparation alone does not prove publication succeeded.

The template's Jaeger colors and typography are retained. The new face sketch
and favicon are original SVG/CSS artwork authored for this project. All assets
are local, and there is no install/download claim for the planned application.
