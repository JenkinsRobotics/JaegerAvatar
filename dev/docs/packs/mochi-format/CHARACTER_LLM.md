> Preserved from the archived Mochi repository (`characters/`), November 26, 2026. Every avatar pack keeps its original Mochi-format character under `sources/mochi/`; this documents that format.

The stack
Rig: I'd go 3D VRM (VRoid Studio to author, Unity/Godot/Blender to render) over 2D Live2D — not because 2D is worse, but because of your robot. Your long-term doc has JaegerExpression driving a physical face. A 3D blendshape vector maps onto servos and displays; Live2D's 2D mesh deformations don't. Same control signal drives the YouTube avatar and, later, the robot's face. If you specifically want the flat anime VTuber look, Inochi2D is the open Live2D alternative and skips Cubism's commercial licensing.

Control surface: ARKit's 52 blendshapes. It's the de-facto standard, every tool speaks it, and it's just 52 floats.

Lipsync — and this is the lazy win: you don't need audio→viseme inference, because you generated the audio and you know the exact text. Run forced alignment (torchaudio's MMS_FA, or Rhubarb for a CPU-only phoneme pass) on the generated audio against the known transcript, get phoneme timings, map phonemes to visemes. Accurate, deterministic, ~free. Audio-driven models like Audio2Face exist and are worth it later for a subtler mouth, but not for v1.

Emotion: the style spec you're already sending to the TTS drives the upper face. {emotion: angry, intensity: 0.7} becomes brow and eye blendshape targets through a lookup table with smoothing. A table, not a network.

Why this is the piece that makes the roadmap click
Look at what the control signal is in all three tracks now:


cognition → { text, style_spec, expression_spec }
                │        │              │
                │        │              └─► rig blendshapes → render
                │        └─► TTS conditioning → audio
                └─► speech content
One small structured vector out of cognition, three consumers. That's JaegerExpression and JaegerAudio from your long-term doc, at Generation 1, using nothing but off-the-shelf parts and lookup tables. And when Generation 2 arrives, the thing you train is a small network that predicts that vector instead of you authoring it — the interface doesn't change. Which was the whole architectural bet in your docs.

Also worth noting: the rig is what makes lipsync-to-emotion coherence possible at all. In a generated-video approach, "angry while saying this word" is an emergent property you pray for. Here it's two independently controlled parameter groups.