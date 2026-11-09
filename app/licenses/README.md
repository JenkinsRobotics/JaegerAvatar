# Imported application, assets and optional engines

`imports.json` records the original path and SHA-256 of imported application
files before adaptation. `NORI-SOURCE.md` preserves the source author's full
notes, attribution and historical licensing inventory. Its old paths, claims
and measurements describe Nori, not the current application. The code has been
adapted with the user's authorization; this inventory does not relicense assets.

| Material | Recorded terms / provenance |
| --- | --- |
| Nori/KIN prototype application and procedural characters | User-owned local working trees; exact source hashes recorded. No separate blanket third-party license inferred. |
| three.js | MIT; `app/web/vendor/three/LICENSE`. |
| three-vrm | MIT; `app/web/vendor/three-vrm.LICENSE`. |
| MediaPipe Tasks Vision and face model | Apache-2.0; `app/web/plugins/webcam/LICENSE-mediapipe.txt`. Optional browser plugin. |
| Vita | Original VRoid model, license note and embedded metadata preserved in its pack. Source note describes CC0; embedded VRM0 metadata links specific VRoid usage conditions. Both records retained without collapsing them into a new license claim. |
| Aster | pixiv VRM1 Constraint Twist Sample, with KIN material palette changes. VRM Public License 1.0 and embedded permissions preserved in its pack. |
| Singer A / Heart samples | Synthetic Kokoro Heart reference and prepared SoulX output from JaegerLyra. Not a newly trained voice model or live generated reel. |
| Existing character library | Each pack's original source declarations, assets, hashes and notices remain authoritative. |
| Kokoro weights | Apache-2.0 according to source inventory. MLX/ONNX wrappers and pronunciation dependencies retain their own terms. |
| misaki / spaCy / English model | Source inventory: Apache-2.0 / MIT / MIT. `num2words` is LGPL-2.1. |
| Optional Piper / phonemizer-fork / eSpeak NG | GPL components, retained as local optional voice paths. Not reclassified under the application's Apache license. |
| Whisper / faster-whisper / Silero | Source inventory: MIT. |
| Optional Chatterbox Turbo | Source inventory: MIT; user-supplied reference samples stay private. |
| SoulX-Singer | Source inventory: Apache-2.0; implementation and weights stay in JaegerLyra. |
| Gemma | Model-specific terms; model weights are not bundled. |

Application source is tracked; neural model caches, Python environments,
credentials and user voice references are excluded. The demo source baselines
were tagged before import and the original working trees are archived locally.
