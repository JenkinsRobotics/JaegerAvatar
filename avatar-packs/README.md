# Avatar packs

Jaeger Avatar owns this library and its `avatar/v1` format, the successor to the
earlier character packs. [Format, ownership and migration](../dev/docs/packs/AVATAR_PACKS.md).

The seed contains **34 avatars, 39 persona profiles and 38 representations**:

| Source | Imported foundation |
| --- | --- |
| Mochi | 18 visual character packs with personas, sprites, clips, procedural faces and motion scripts. |
| JaegerAI | 20 persona/card packs, including traits, SOUL text, backstory and lore. |
| JaegerAgent | Default Assistant persona as data; no agent engine or visual model. |

Mochi, TARS, GLaDOS and HAL combine the two source libraries in separate variants.
Their defaults select the JaegerAI persona and Mochi appearance. Assistant defaults
to JaegerAgent's neutral persona with the JaegerAI card representation.

Browse [catalog.json](catalog.json), or run from the repository root:

```sh
python3 -m jaeger_avatar.packs list
python3 -m jaeger_avatar.packs validate
```

Each folder's `avatar.yaml` is the new authoring definition. `sources/` retains
the original files and declared licenses, with SHA-256 hashes in the manifest.
These are captured working-tree snapshots, not live links back to other repos;
15 Mochi source folders contained local changes at import. Provenance marks them.

Five JaegerAI packs contain an absent legacy `avatar/` placeholder: Clanker,
Reliability Auditor, Research Strategist, Robotics Architect and Systems
Principal. Their usable representation is the existing card image; manifests
record the missing declaration in `unavailable_assets`.

Imported material retains its source terms. Many source asset licenses are
`Unspecified`; copying the repository's Apache-2.0 license does not relicense
those assets. Each source's `REPOSITORY_LICENSE` is contextual attribution,
while `declared_license` preserves the original pack declaration.

This catalog validates data and asset references. A card is not an animated
model, and procedural files are not executed by the loader. The app renderer,
editor and agent integrations are still planned.
