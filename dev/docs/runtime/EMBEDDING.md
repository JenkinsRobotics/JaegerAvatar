# Embedding one avatar

Status: first desktop implementation, Mochi on macOS.

JaegerAvatar owns the renderer and distribution contract. Consumers own their
agent, audio pipeline, window and device output. They must not copy the full
avatar catalog or fork the renderer to integrate one character.

Build Mochi with:

```sh
.venv/bin/python scripts/build_embedded_mochi.py --output /tmp/avatar-mochi-next
```

The destination must not exist. The builder stages the export before installing
it and includes only the selected renderer dependency graph, Python control
host, persona projection, manifest, license notices and SHA256SUMS.json.
No voice weights, user memory or credentials are distributed.

## Contract v1

- `avatar-runtime-bundle/v1`: identity, representation, provenance, capabilities,
  named actions and activity mappings in manifest.json.
- `avatar-control/v1`: schema, avatar, session, seq, issued_at_ms, ttl_ms, op, value.
  Operations: emotion, reaction, gaze, jaw, speaking, stop.
- `avatar-state/v1`: current bounded presentation state, accepted sequence and
  server clock. Expiry returns the character to rest.

The Controller is the single sequence owner. Hosts should call its `send` method
rather than manufacture sequence numbers. Explicit envelopes passed to `accept`
must match the active session/identity, increase sequence, use a 1–30000 ms TTL
and contain valid finite values. Gaze is [-1,1] per axis, jaw [0,1], speaking
boolean, stop null. Expression/reaction names come from the manifest.

Verify bundle hashes before loading. Start Controller(manifest) and
RuntimeServer(public_root, controller); embed the server URL. The server binds
loopback on an ephemeral port and exposes only static files and token-protected
read-only state. Close the server/subscriptions on shutdown. The renderer polls
at 50 ms and rests after a one-second disconnect. This is current-state control,
not a lossless choreography scheduler.

## First consumer: Mochi

Mochi installs vendor/avatar-mochi-0.1.0. Its modules/jaeger_avatar.py maps existing
JaegerOS display commands, speaker PCM/state and Stop to this contract. Its
ChatTab validates leading expression markers against manifest actions before
stripping them from speech. The native window uses JaegerAgent's public node
factory; the avatar bundle contains no agent implementation.

Consumer acceptance: verify single-avatar isolation and integrity; exercise agent
expression, manual action, gaze, speech start/stop; reject malformed/stale/wrong
session commands; verify disconnect rest and shutdown. Document renderer/device
requirements and limits. Pixel export, physical robot installation and measured
audio latency must be qualified separately before claiming robot deployment.

## Mochi release 0.2.1

The selected pack and embedded runtime are version 0.2.1. Ten idealized
procedural performances are included as modules, without source videos. The
manifest declares `capabilities.clips` (name, module ID, duration) and named
`clip` actions with 17000 ms TTL. `avatar-state/v1` additionally reports clip,
clip_seq, clip_started_at_ms and clip_until_ms. Hosts use the declared start
clock and duration; a new clip command restarts the performance, and Stop
clears it. Existing emotion/reaction/gaze operations remain supported.

0.2.1 isolates a custom painter's canvas state with save/restore so returning
from a clip to live eyes cannot inherit its coordinate transform. Consumers
pin the immutable bundle and checksum-manifest hash in avatar.lock.json.
The schema version describes compatibility; the pack/runtime release numbers
identify a particular set of art and implementation files.
