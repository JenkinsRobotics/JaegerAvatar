# Architecture and integration (planned)

## Application modes

### Standalone — the primary path

Jaeger Avatar hosts JaegerAgent through its supported embedding/runtime API.
The application supplies explicit instance storage, policy and lifecycle hooks;
JaegerAgent supplies turns, model adapters, tools and multimodal processing.
JaegerAI does not need to be installed or running for this mode.

### Connected to JaegerAI — an optional path

An explicit client adapter attaches to a selected JaegerAI instance using its
versioned protocol. JaegerAI retains session history, memory, tool policy and task
execution. Avatar supplies rendering and interaction. It must not launch another
agent or duplicate memory for the attached conversation. Qualify the required
speech, interruption, timing and activity events against the actual protocol.

### Human or scripted performance

Tracking/manual input or saved clips drive the character without an AI model.
These modes use the same presentation controls and capability checks.

## Presentation flow

```text
Embedded JaegerAgent OR connected JaegerAI OR human/script input
                             |
                   presentation coordinator
                 speech / gaze / mood / gesture
                             |
                     resolved timed pose
                             |
                 character representation adapter
                             |
                      rendered performance
```

The coordinator owns control arbitration and synchronization. Speech, gaze and
mood must be combined before latest-pose conflation. Declare channel units/ranges,
defaults, target identity, time basis, ordering, expiry and reset behavior. Discrete
triggers require their own delivery semantics; conflation must not silently drop
an action that needs to run once. Presentation runs on the audio playback clock
where speech synchronization requires it, and cancellation clears pending speech
and motion together.

The proposed `/act/display/pose` connection in the Jaeger stack is separate work.
This repository does not currently implement or publish that contract. Use the
owning runtime's topic/message definitions when agreed; do not fork them here.

## Character, representation and instance

- **Character:** reusable identity, persona defaults and available behaviors.
- **Representation:** visual assets/rig and mapping from controls to appearance.
- **Instance:** a live assistant with its own model, memory, tools and permissions.

A pack transports the first two. The runtime host owns the third. Persona text
is character data, not authority to grant tools or override host policy.

The implemented [avatar/v1 foundation](../packs/AVATAR_PACKS.md) is owned here.
One pack can preserve multiple persona profiles and visual representations, each
selected independently. Imported presentation data retains `character/v1` field
semantics inside a representation; the portable outer contract is `avatar/v1`.
Loading or validating a pack does not execute its procedural code or start an agent.

JaegerAnimation remains useful for raster/display playback. Browser or 3D
renderers can live in Avatar without forcing robot displays to adopt them.
Physical mechanisms use Aether Animation/JP01 mappings and limits; a digital pose
stream does not directly become an unrestricted actuator command.

## Reuse and dependency rules

Pin verified JaegerOS/JaegerAgent versions when implementation starts. Use public
embedding APIs inside the application host and the client protocol across a
process boundary. Keep rendering independent of a particular model/provider.
Reusable features proven in Mochi belong in their owning modules when JP01 and
Avatar consume them. Preserve original licenses and provenance when importing
prototype code or character assets.

Pack import, source integrity and reference resolution are tested here. The agent,
renderer and cross-process integrations described above remain unqualified.
