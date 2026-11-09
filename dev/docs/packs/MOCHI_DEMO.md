# Mochi animation demonstration family

The Mochi identity keeps its existing default persona and enhanced appearance.
Representations have human-readable names; technical IDs remain stable. Momo
remains a separate original companion, included alongside Mochi to demonstrate
another animation technique.

| Name | Representation | Technique | Deployment requirement |
| --- | --- | --- | --- |
| Mochi Classic | mochi / classic | Original 360x234 video animation, five paired scenes | H.264 video player or Mochi/JaegerAnimation |
| Mochi Enhanced | mochi / mochi | Enhanced 576x384 video animation, same five paired scenes | H.264 video player or Mochi/JaegerAnimation |
| Mochi Live | mochi / nori_demo | Procedural face; smooth, eyes-only and pixel display modes | Jaeger Avatar browser runtime |
| Mochi Portrait | mochi / jaeger_ai | Static image | Image player; not animated |
| Momo Shell | momo / kin_demo | Fixed 3D shell with procedural face animation | Jaeger Avatar browser/WebGL runtime |

Classic/Enhanced primary and alternate tracks are paired scene choices, **not
verified phoneme or talk/silence tracks**. The video variants demonstrate media
playback; they do not perform real-time lip sync. Live demonstrations exercise
the existing procedural rig. No new AAA character asset is claimed.

## Open and rebuild

App demo: `http://127.0.0.1:8790/mochi-demo.html`.

```sh
.venv/bin/python scripts/build_mochi_demo.py --output dist/mochi-demo-0.1.1-release
```

Use a fresh output folder if that release already exists. Open its `index.html`
to compare the videos without running an agent or speech engine. The live links
require `./run.sh` on the same computer (port 8790); no browser rig runtime is
embedded in the portable data bundle. The build also refreshes the app demo page.

The package contains both canonical identities and three Mochi legacy exports
(Classic, Enhanced and Portrait). Select one legacy representation per identity
when installing in the existing Mochi application: its loader keys by character
ID. The standalone demonstration intentionally offers Classic and Enhanced
side by side. No consumer files are overwritten by the builder.

## Asset provenance and verification

Original `sources/` assets remain byte-for-byte unchanged. The original Classic
videos use MPEG-4 Part 2, which failed browser playback during acceptance.
`assets/classic/` contains H.264/yuv420p/faststart compatibility copies at the
original dimensions. `conversion.json` records input/output hashes and encoding
settings. These are derived assets, not new art or an enhancement of Classic.

All three legacy exports passed actual Mochi dispatcher / JaegerAnimation
rendering, including all 20 video choices. Browser checks exercised both video
variants and scene switching over localhost. Direct file:// browser testing was blocked by
the browser tool URL policy, so that launch route is not claimed as verified. Bundle verification passes before and after
consumer tests. Evidence: `dev/evidence/deployment/mochi-family-0.1.1.json` and
`mochi-demo.png`.

Physical JP01 deployment is still awaiting its display/runtime configuration.
No physical motors, remote device installation or legacy MScript qualification
is included. Use [robot deployment](ROBOT_DEPLOYMENT.md) for those boundaries.

## Procedural recreation of all ten Classic clips

Open `http://127.0.0.1:8790/mochi-recreation.html` with the app running (add
`?clip=cell_2_1` to open one clip). All ten Classic clips (five scenes, each
with its alternate) are redrawn as canvas vector shapes painted onto the fixed
3D body. The procedural face never samples video pixels; the reference video
plays alongside only for comparison. **Procedural only** runs it on its own clock.

| Scene | Primary (`_0`) | Alternate (`_1`) |
| --- | --- | --- |
| 1 | Squint & wink | Pong transformation |
| 2 | Asleep, snot bubble | Close-up eyes, tongue |
| 3 | Anger, glowing colours | Speedometer |
| 4 | Spotlights, scare | Tired blinking |
| 5 | Hearts & kiss | Drowsy, big yawn |

Each clip is one module, `app/web/performances/mochi/<clip>.js`, registered in
`performances/mochi-scenes.js` and built on the shared kit `mochi-face.js`.
The clips are **idealized**, cleaner than the source drawing rather than traced
from it:

- One resting face, `restFace()`: two identical rounded eyes and an even,
  round-capped smile, exactly symmetric about the screen centre. Every clip
  starts and ends on it, pixel for pixel, so switching clips never jumps. The
  source videos place the face at different heights (up to 22 px apart); each
  clip is re-anchored as a whole.
- Expressions are built from clean primitives derived from that face (the same
  eye squashed, scaled or lid-cut; even arcs and tapered strokes; ellipses;
  symmetric hearts; a regular speedometer). Symmetric poses are drawn on one
  side and mirrored; deliberate asymmetry (winks, glances, the Pong ball, the
  snot bubble, the kiss face) is kept.
- Hand-drawn wobble, per-frame jitter and source glitches (a black frame,
  light bleeding in from neighbouring cells of the source sheet) are removed.
- Timing is unchanged: poses are keyed to the source's own 24 fps frames (the
  frame on screen at time *t*), so every cut lands where the video's does.

Shape parameters started as fits to the reference frames and were then
regularized. Measured face-relative against the reference (lit-pixel overlap
every 0.25 s, with the video shifted to the shared face position), the clips
score about 0.83 to 0.93; the remaining difference is mostly removed wobble.
`tests/mochi-clips.test.mjs` checks that every clip renders finite procedural
geometry at every frame with no image or video input. Expression strength and
gaze adjust every clip. The face texture on the 3D body is mipmapped, so the
vector edges stay smooth when the screen is shown small.

This is a visual recreation of recorded performances, not live lip sync, a
skeletal rig or a robot-qualified deployment package.
