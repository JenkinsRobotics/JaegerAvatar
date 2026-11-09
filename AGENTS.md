# Jaeger Avatar contributor guide

Read `dev/docs/reality/STATUS.md`, `dev/docs/vision/PRODUCT_SCOPE.md`,
`dev/docs/vision/ARCHITECTURE.md` and `CONVENTIONS.md` before implementation.

- Product name: **Jaeger Avatar**. Repository: `JaegerAvatar`.
- This repository owns `avatar/v1`, superseding character packs. Read
  `dev/docs/packs/AVATAR_PACKS.md` before changing pack data or import behavior.
  Root `avatar.yaml` files are canonical; `sources/` contains provenance snapshots.
- This is a standalone character application, not a new agent engine or a
  physical rig-control application. JaegerAgent is the planned embedded runtime;
  JaegerAI is an optional connected assistant, not a mandatory dependency.
- Keep character identity/assets separate from runtime instances, private memory,
  credentials and tool permissions. A pack cannot grant runtime permissions.
- Reuse supported runtime and client contracts. Never copy JaegerAgent internals,
  fork JaegerOS or run a second agent for a connected JaegerAI session.
- Preserve existing template references until an implementation task replaces
  them. Do not present example scaffolds as working application code.
- Keep implemented and planned features distinct in README, site and STATUS.
- Website source is `docs/`; the existing `gh-pages` branch publishes its contents
  at the branch root. Preserve that deployment route. See `docs/SITE.md`.
- For documentation/site edits run `python3 scripts/check_site.py` and
  `git diff --check`; exercise changed website controls and responsive layouts.
  For pack changes also run `python3 -m jaeger_avatar.packs validate` and
  `python3 -m unittest discover -s tests -v` after installing requirements-packs.txt.

- UI pages and demos must match the Studio home page. Reuse `app/web/theme.css`
  for colors, typography and controls; do not introduce a separate demo theme.
  Portable generated demos should embed that same stylesheet.
