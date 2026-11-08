# Avatar packs: contract and migration

## Ownership and status

**Jaeger Avatar owns `avatar/v1`. Avatar packs supersede character packs as the
portable artifact for this ecosystem.** The first library imports the reusable
definitions and assets already present in Mochi, JaegerAI and JaegerAgent.

Implemented: seed import, independent persona/appearance variants, source
provenance, local-reference resolution, validation and a repository-local CLI.
Planned: visual authoring, rendering, agent binding and adoption by existing apps.
This change does not replace the existing apps' loaders or delete their packs.

| Owner | Responsibility |
| --- | --- |
| Jaeger Avatar | Pack contract, canonical library, import tooling and future editor. |
| JaegerAI / Mochi | Consumer integrations; their current `character/v1` loaders continue until migrated. |
| JaegerAgent | Agent execution and host-facing persona input, independent of visual assets. |
| Runtime host | Live identity policy, conversation, private memory, model config and permissions. |
| Aether Animation | Physical rigs, calibration and actuator mappings outside this pack foundation. |

A pack needs no agent. A persona-only pack and a visual-only pack are both valid.
A host can use a selected persona without rendering or drive an appearance from
manual/scripted input. Persona prose cannot grant tools or override host policy.

## Layout and fields

Each directory is self-contained and has one canonical `avatar.yaml`:

```yaml
schema: avatar/v1
avatar: example
name: Example
version: 0.1.0
description: A portable character definition.
default_profile: plain
default_representation: face
profiles:
  plain:
    character:
      name: Example
      identity:
        role: a helpful companion
        voice_tone: calm
      prompt:
        custom_instructions: Speak plainly.
representations:
  face:
    format: character/v1
    root: assets
    presentation:
      kind: clip_set
      render:
        adapter: image
        asset: card.png
      expressions:
        idle: {clips: card.png, loop: false}
      default_expression: idle
sources: {}
```

This example requires `assets/card.png`. It demonstrates the data contract; it
does not imply a renderer is installed. The Python loader in
[packs.py](../../../jaeger_avatar/packs.py) enforces the implemented contract.

- `schema` identifies the contract; unknown versions are rejected. `version` is
  the content revision of this avatar, independent of its imported sources.
- `avatar` is a stable lowercase ID using letters, digits and underscores.
- `profiles` and `representations` are independent named mappings. Each populated
  mapping requires a valid default selector; an empty mapping uses a null selector.
- A profile contains `character` data: name, description, author, license,
  identity/voice defaults, prompt, traits, lore, level, revision and neutral flag.
  An optional `card` references a pack-relative file. Hosts retain their own
  identity policy; importing `neutral` does not rename an existing agent instance.
- A representation supplies a pack-relative `root` and `presentation` data.
  `format: character/v1` preserves the existing render, expression, mouth, motion,
  mood and sprite-transition semantics without inventing a new playback engine.
  Other presentation formats and a universal pose contract remain planned.
- Persona and representation variants may name a `source`. The source records
  repository, commit, original path, dirty-working-tree flag, license declaration
  and file hashes. Native authored packs may leave `sources` empty.
- Unknown top-level fields, non-finite numbers, invalid defaults, escaping paths
  and missing declared assets are rejected. Validation checks file references,
  not media decoding, script behavior or renderer compatibility.

Imported source trees preserve the complete original manifests and files, including
source-specific fields not promoted into the new authoring definition. They are
provenance snapshots, not competing live definitions. Edit root `avatar.yaml` for
new authoring; add new assets outside `sources/`. Source hashes deliberately fail
if archived files are silently edited.

## Import decisions

The initial catalog contains 18 Mochi sources, 20 JaegerAI sources and one
JaegerAgent persona. Four shared IDs are consolidated, giving 34 distinct avatars.
Profiles are never merged field by field: both source identities remain selectable.
Shared avatars default to the richer JaegerAI persona and Mochi appearance.
Assistant defaults to the JaegerAgent profile and JaegerAI card.

JaegerAI's file-backed `SOUL.md` / `soul.md`, `lore/backstory.md` and lore lists
override YAML when populated, matching the source loader. The original files are
also retained. JaegerAgent's literal `DEFAULT_PERSONA` is extracted with Python's
AST reader; its module is never imported and its engine is not copied. JaegerAI's
vendored copy has the same default persona data and is not counted twice.

Mochi motion scripts contain paths such as `characters/HAL 9000/hal.py`.
Each representation records a `path_aliases` mapping into its local source tree.
`resolve_reference(pack, representation, reference)` resolves these paths without
rewriting the original scripts. A future playback adapter must use this resolver
or materialize equivalent paths; raw legacy scripts are not automatically portable
when handed directly to an old renderer.

Five unused JaegerAI `assets.avatar: avatar` declarations reference absent folders.
The importer records them in `unavailable_assets`, omits them from the usable
presentation and retains the exact original manifest. The existing card remains
available. No missing artwork or rig is fabricated.

## Reproduce and verify

Run from the JaegerAvatar repository root with Python 3.11 or newer:

```sh
python3 -m pip install -r requirements-packs.txt
python3 scripts/import_avatar_packs.py \
  --mochi ../Mochi \
  --jaeger-ai ../JaegerAI \
  --jaeger-agent ../jaeger-agent \
  --output /tmp/jaeger-avatar-import
python3 -m jaeger_avatar.packs validate /tmp/jaeger-avatar-import
python3 -m unittest discover -s tests -v
```

The output directory must not exist. Import uses a temporary staging directory,
verifies source hashes before and after copying, then moves the complete catalog
into place. It excludes caches and OS metadata, refuses source symlinks and never
writes back to the source repositories. Review a fresh import before replacing
authored packs; imports are explicit snapshots, not automatic synchronization.

## Consumer migration (planned)

1. Qualify a consumer against `load_pack` and select persona/representation
   explicitly. Keep existing `character/v1` reading only at the migration boundary.
2. Adapt the selected persona to the host's supported input, preserving its neutral
   identity behavior. Do not copy memory or start a second agent for JaegerAI.
3. Pass selected presentation data and resolved local resources to the owning
   rendering engine. Qualify actual expression playback and script path resolution.
4. Move new authoring to `avatar.yaml`, pin the supported contract, then retire
   the consumer's duplicate bundled library when its migration is verified.

No legacy exporter or downstream loader switch is included yet. JaegerAnimation's
existing `character/v1` contract remains in service for unmigrated clients.
Version and coordinate changes at that boundary rather than silently changing it.
