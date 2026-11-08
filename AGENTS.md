# Jaeger Avatar contributor guide

Read `dev/docs/reality/STATUS.md`, `dev/docs/vision/PRODUCT_SCOPE.md`,
`dev/docs/vision/ARCHITECTURE.md` and `CONVENTIONS.md` before implementation.

- Product name: **Jaeger Avatar**. Repository: `JaegerAvatar`.
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
  Runtime tests are added with real runtime behavior, not template placeholders.
