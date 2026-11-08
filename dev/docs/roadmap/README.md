# Roadmap — planned work

Milestones are acceptance gates, not release dates. None of the runtime features
below is implemented in this repository yet.

1. **One character on screen.** Select the first supported representation,
   validate its pack and show it with manual expression/gaze controls. Reload
   the same pack without app-specific asset edits; handle unsupported assets clearly.
2. **Standalone conversation.** Embed JaegerAgent through supported APIs, with
   explicit instance storage and policy. Complete a typed/spoken turn, coordinate
   speech and mouth movement, and cancel without residual audio or animation.
3. **Character editing and exchange.** Configure identity, voice and expression
   mappings; save and reopen the pack. Verify a real fixture with the existing
   Jaeger/Mochi consumer before claiming portable interchange.
4. **Existing assistant connection.** Attach to a JaegerAI instance. Verify that
   its history, permissions and memory remain authoritative and no duplicate agent
   is started. Handle disconnect/reconnect and interrupted speech.
5. **Performance workflows.** Add qualified tracking, recorded clips, recording
   and streaming outputs. Inspect actual exported audio/video, not just download UI.

Local experiments may supply candidates, but their features become Jaeger Avatar
capabilities only after import, attribution and verification here.
