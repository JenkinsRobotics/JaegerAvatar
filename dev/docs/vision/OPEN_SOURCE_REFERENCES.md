# Avatar and VTuber development references

## External reference review — November 8, 2026

This is a primary-source documentation/source review, not a hands-on comparative
benchmark. Vendor frame-rate and platform claims have not been reproduced on
this Mac. The migrated Nori-based Jaeger Avatar remains the foundation; this
review does not reopen the demo migration or introduce another agent engine.

| Reference | Role and verified distinction | Lesson for Jaeger Avatar |
| --- | --- | --- |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | Closest product reference: local voice-interactive AI companion, Live2D, interruption, saved chat logs, web/desktop and macOS support. MIT app code; Live2D components/sample assets have separate terms. Its README describes v2 as early planning and v1 bug fixing. | Prioritize turn interruption, conversation continuity and explicit listening/thinking/speaking states. Keep JaegerAgent as our engine rather than importing another conversation stack. |
| [OpenSeeFace](https://github.com/emilianavt/OpenSeeFace) | Tracking library, not a complete avatar app. CPU ONNX face tracking, UDP transport, expression calibration, explicit start/stop lifecycle. | Keep capture/inference separate from rendering; qualify lost-face, startup failure and device disconnect. Evaluate an optional adapter only if it improves measured tracking on macOS. |
| [Inochi2D](https://github.com/Inochi2D/inochi2d), [Creator](https://github.com/Inochi2D/inochi-creator) and [Session](https://github.com/Inochi2D/inochi-session) | Open-source 2D puppet ecosystem with separate SDK, rigging editor and streaming application. | Best reference for future 2D authoring and keeping editable character assets separate from performance sessions. Adding an Inochi renderer is a separate qualification project, not required for the first release. |
| [three-vrm](https://github.com/pixiv/three-vrm) | MIT VRM support on Three.js; a rendering/runtime component, not an AI companion or complete performance editor. | Continue the existing VRM foundation and test expression overrides, normalized bones and imported-model limits. No renderer rewrite justified. |
| [KalidoKit / Kalidoface](https://github.com/yeemachine/kalidokit) | Landmark-to-face/body/hand solver and browser demonstrations. The upstream README explicitly marks KalidoKit deprecated in favor of MediaPipe integration. | Learn from separated tracking/retargeting stages and blink stabilization; keep our existing MediaPipe path instead of adding a deprecated dependency. |
| [VTube Studio API](https://github.com/DenchiSoft/VTubeStudio) | Public plugin API, not the source of the full app. Exposes expressions, hotkeys, parameter ranges, smoothing and ownership; injected values expire if not refreshed. | Reference for channel ownership, expiry, capability discovery and user mapping. A future API must arbitrate tracking, speech and manual control before sending the resolved pose to a renderer. |
| [XR Animator](https://github.com/ButzYung/SystemAnimatorOnline) | Full-body/face/hands mocap, VRM/MMD, motion import/export and VMC in its desktop build; web and macOS desktop options. General source license is CC BY-NC-SA 4.0, not a permissive open-source dependency. | Product reference for reusable motion clips and external tracking interoperability. Do not copy implementation into our Apache-2.0 app under an assumption of permissive reuse. |

### Gap analysis and sequence

Jaeger Avatar already has portable packs, separate persona/appearance selection,
procedural characters plus VRM, Kokoro, an agent host, manual acting, recording
and output windows. Those are the base to improve. Existing benchmark numbers
for the retired demos do not establish how this runtime compares to these tools.

1. **Lifecycle reliability (partly implemented):** tracking teardown now closes
   camera streams on failed video startup, worker failure and disconnect. Late
   bitmap/results cannot revive a stopped session. Invalid numeric tracking
   values are rejected. Existing 500 ms lost-face release remains. Synthetic
   lifecycle regression tests cover failure, stop, late work and restart; real
   camera/macOS permission behavior still needs hardware acceptance.
2. **Performance coordination (planned):** declare channel priority/expiry for
   speech, tracking, idle and manual actions; preserve speech mouth ownership.
   Add word/beat anchors when the audio engine actually supplies timing. Do not
   infer accurate phoneme timing from an amplitude envelope.
3. **Character workflow (planned):** save calibration and expression mappings per
   representation; show supported moves instead of presenting unsupported actions.
   Keep these separate from conversation identity and runtime permissions.
4. **Interoperability (planned):** qualify one VRMA clip import route and one
   external tracking route before expanding formats. VMC is a candidate, not an
   implemented endpoint or replacement for JaegerOS-owned contracts.
5. **Release acceptance (planned):** validate cold/warm first speech, repeated
   interruption, tab suspension, missing devices, recording A/V sync and OBS on
   macOS. Then package the app. Native desktop transparency/click-through remains
   a separate platform feature from the existing browser output window.

No external implementation code was copied or dependencies added for this review.
The first change follows the resource-lifecycle and stale-input principles;
it is not a claim that OpenSeeFace or VTube Studio was integrated.
