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
  Operations: emotion, reaction, act, clip, gaze, jaw, speaking, speak, stop.
- `avatar-state/v1`: current bounded presentation state, accepted sequence and
  server clock. Expiry returns the character to rest.

The Controller is the single sequence owner. Hosts should call its `send` method
rather than manufacture sequence numbers. Explicit envelopes passed to `accept`
must match the active session/identity, increase sequence, use a 1–30000 ms TTL
and contain valid finite values. Gaze is [-1,1] per axis, jaw [0,1], speaking
boolean, stop null. Expression/reaction names come from the manifest.

`act` takes a name from `capabilities.actions` (default none) and reports
`act`, `act_seq` and `act_until_ms`. `speak` takes `{clip, duration_ms, marks,
text}` and reports `speak`, `speak_seq`, `speak_started_at_ms`, with `speaking`
true until `issued_at_ms + duration_ms`:
- `clip` is an uploaded clip path starting with `/control/audio/`; the host's
  speaker plays it, never the avatar.
- `duration_ms` is 1–60000.
- `marks` holds at most 400 lip closures `[start_s, end_s, "p"|"f"]` with
  `0 <= start <= end <= duration_ms/1000` ("p" presses m/b/p shut, "f" tucks
  the lip for f/v).
- `text` is at most 600 characters.

`stop` also reports `stop_seq`, so a host can tell a stop from a return to rest.

Verify bundle hashes before loading. Start Controller(manifest) and
RuntimeServer(public_root, controller); embed the server URL. The server binds
loopback on an ephemeral port and exposes only static files and token-protected
read-only state. Close the server/subscriptions on shutdown. The renderer polls
at 50 ms and rests after a one-second disconnect. This is current-state control,
not a lossless choreography scheduler.

## Control link (demo app)

The app's own agent drives the pack directly. The control link
(`jaeger_avatar/embedded/link.py`) is an optional extra way in, for another
process on the same machine; commands go in and animation comes out. Every route is loopback only and checks
the Host header.

- `POST /control/attach` (`Content-Type: application/json`, `{avatar, capabilities}`): the page showing the
  avatar attaches with the body's declared controls. Each attach is a new session.
- `GET /control/state?session=<id>`: the `avatar-state/v1` snapshot plus
  `attached`. The page polls it every 50 ms with the session its attach returned;
  only that keeps the link alive. The newest page wins: an older tab gets
  `{attached: false, taken: true}` and waits, then attaches again once the newer
  page has gone.
- `POST /control` (JSON `{op, value, ttl_ms?}`, header `X-Avatar-Token`): one
  `avatar-control/v1` command. Errors are 403 (token) or 422 (refused), with
  `{"error": message}`.
- `POST /control/audio` (WAV body, header `X-Avatar-Token`): stores a speech
  clip and returns `{clip: "/control/audio/<id>"}`, which is then used in `speak`.
  The last 16 clips are kept, each at most 10 MB.
- `GET /control/audio/<id>`: the clip, for the host's speaker.

The token is `JAEGER_AVATAR_CONTROL_TOKEN`, or one generated at startup and
printed as `Control token: …`. JSON routes need exactly `application/json`, which
a page on another site can't send without a preflight this server never grants.
A hidden browser tab is throttled and may count as gone. A page that hasn't polled for 2 seconds counts as
gone: commands are then refused with `No avatar attached` rather than accepted
into the void. `scripts/avatar_control.py` is an example client.

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
