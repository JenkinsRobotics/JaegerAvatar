# Jaeger Avatar — product scope

Confirmed direction, November 7, 2026. Implementation is planned; current truth
lives in [STATUS](../reality/STATUS.md).

## Purpose

A standalone application to create, customize and interact with animated AI
characters. The primary experience is an avatar agent. Human puppeteering and
scripted performance are additional ways to drive the same character.

Jaeger Avatar is the chosen name for the concept previously called Aether Avatar.
It belongs alongside JaegerAI in the application layer. Aether Animation returns
to its original physical mechanism and animatronics control scope.

## Create, configure, use (planned)

1. Create a character identity, persona and preferred voice.
2. Import or customize its visual representation. Start with existing 2D/3D or
   procedural assets; qualify a first supported representation before expanding.
3. Configure expressions, mouth shapes, gaze, gestures and reusable clips.
4. Save a portable character pack with explicit control/capability declarations.
5. Run the character with embedded JaegerAgent, or attach to an existing JaegerAI
   instance. Provide manual/scripted control without requiring a conversational model.

Recording, streaming, tracking, multiple representations and richer authoring
follow a complete first character workflow. Full 3D modelling/sculpting, a new
agent engine and physical actuator calibration are outside the initial scope.

## Ownership

Avatar owns its presentation runtime, character editor and interaction UI.
JaegerAgent supplies the reusable agent engine. JaegerOS supplies runtime
infrastructure. JaegerAI remains the complete general-purpose assistant product
and can use an avatar as an optional interface. Mochi demonstrates reusable
character/robot capabilities for JP01. Aether Animation owns physical rig motion.

Keep reusable rendering inside this repository initially; extract a versioned
component when an actual second consumer requires it. JaegerAI should reuse that
component or connect to Avatar, rather than reimplementing the renderer/editor.

## Character packs

A pack describes the character: identity, assets, expressions/control mappings,
clips and optional persona/voice defaults. It can have multiple representations.
An agent instance owns conversation state, private memory, credentials, model
configuration and effective tool permissions. A visual change must not silently
switch or clone that instance.

The format is a joint authoring/runtime contract. JaegerAnimation's
`character/v1` loader is an existing reference, not a claim that all formats
already agree. Qualify adapters for Mochi, JaegerAI personas and any Aether
export before claiming interchange. Keep physical mechanism documents separate.
