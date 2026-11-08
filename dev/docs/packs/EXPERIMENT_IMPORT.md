# Recovered JaegerAI avatar experiments

The original import covered character manifests. This follow-up searches the UI
asset folders, 35 remote branches and selected historical renderer commits. It
adds five visual packs and retains earlier renderer experiments as source archives.
The library now has **39 avatars, 39 persona profiles and 45 representations**.

## Added appearances

| Pack | Included | Status |
| --- | --- | --- |
| [Jaeger (Sculpted)](../../../avatar-packs/jaeger_sculpted/README.md) | The white grinning artwork shown in the reference screenshot; portrait and six silent MP4 clips. | Image/clip resources available; application playback remains planned. |
| [Atlas](../../../avatar-packs/atlas/avatar.yaml) | White robot portrait. | Source UI placeholder; no animated model or persona supplied. |
| [Nova](../../../avatar-packs/nova/avatar.yaml) | Illustrated human portrait. | Source UI placeholder; no animated model or persona supplied. |
| [Relay](../../../avatar-packs/relay/avatar.yaml) | Blue/bronze robot portrait. | Source UI placeholder; no animated model or persona supplied. |
| [Jaeger (Bronze)](../../../avatar-packs/jaeger_bronze/avatar.yaml) | Face/full crops and original sizes from the design-tokens branch. | Static design study; two selectable representations. |

Sculpted Jaeger is a separate `jaeger_sculpted` pack because Mochi's existing
`jaeger` pack describes different artwork and a persona. No God/Truth fictional
personality is inferred from the appearance. The new visual packs have empty
persona maps and can be paired with a host-selected persona later.

The clips preserve the source's idle, working, making-something, waiting,
connecting and milestone states. The milestone expression is configured as a
one-shot. They are unchanged pre-rendered composites, including the original
laptop/smile treatment; importing them does not repair or endorse that animation.
All six decode successfully as H.264 at 420×720: connecting is 3 seconds and the
other clips are 4 seconds. Agent-state wiring is not implemented in this app yet.

## Retained source experiments

The sculpted pack's sources include the current cutout and smile-layer components,
the offline clip generator, the earlier drawn SVG character and the superseded
procedural Three.js reconstruction. The generic Assistant pack gains the earlier
canvas face, deterministic shape/robot presets and a historical VRM adapter.

These files are source archives. They preserve original paths and imports and
are not installed plugins or active representation adapters. Host dependencies
and runtime permissions are not imported. `sources.*.status` and `notes` record
their disposition; no new presentation format is declared.

The VRM experiment referenced an external runtime model,
`VRM1_Constraint_Twist_Sample.vrm`. No VRM/GLB/Rive model was found in the inspected
branches, and the referenced local avatar-assets directory was absent. The
adapter and its attribution document are preserved; the model is not included.

## Clanker and duplicates

[Clanker](../../../avatar-packs/clanker/README.md) was already included in the
first import, with its personality, voice preference, SOUL, backstory, lore and
card. Its UI image is byte-identical to that card. Three manifest variants across
the inspected branches have identical persona fields; no additional Clanker rig
or animation asset was found. The legacy missing `avatar/` placeholder remains
reported honestly in its manifest.

All 20 character-card images in the UI duplicate already imported images. They
are recorded in the discovery report rather than turned into duplicate packs.
The bronze UI icon likewise duplicates a recovered design asset.
Twenty-four older media paths found in Git history are also byte-identical aliases
of the recovered/current artwork; their original paths and commits are recorded.

## Provenance and reproduction

The [discovery report](../../imports/jaeger-ai-discovery.json) records branch heads,
media Git blob IDs, duplicate locations and dispositions. The
[reviewed import plan](../../imports/jaeger-ai-experiments.json) pins complete
commit IDs and exact file lists. Original assets retain their source declarations;
repository license copies do not change unspecified artwork rights.

The additive importer reads Git objects without switching or modifying JaegerAI's
checkout. It operates on a copy of the base catalog, refuses existing output or
source collisions, preserves persona/default selections and validates the result
before publishing the output directory. Prototype code is never executed.

To reproduce this follow-up from the original seed commit, run from JaegerAvatar:

```sh
git -C ../JaegerAI fetch origin
git worktree add --detach /tmp/jaeger-avatar-seed d510be2
python3 scripts/import_avatar_experiments.py \
  --repo ../JaegerAI \
  --base /tmp/jaeger-avatar-seed/avatar-packs \
  --plan dev/imports/jaeger-ai-experiments.json \
  --output /tmp/jaeger-avatar-recovered
python3 -m jaeger_avatar.packs validate /tmp/jaeger-avatar-recovered
git worktree remove /tmp/jaeger-avatar-seed
```

Use fresh temporary paths. A new import plan is required for new upstream work;
the tool deliberately does not replace existing authoring or provenance snapshots.
