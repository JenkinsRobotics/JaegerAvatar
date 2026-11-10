# Characters, bodies and looks

Status: experiment, 2026-11-09. Try it: `/style-lab.html`, or pick a Persona in Studio on JP01 or Momo.

## The model

| Layer | What it is | Changes? |
|---|---|---|
| **Body** | What physically exists and its outputs: a 64×64 or 1024² square screen, a wide 1024×640 screen, pan/tilt joints, LED rings, a speaker. A VR rig or video call is also a body. | Fixed. It is the hardware. |
| **Character** | The mind: name, personality, voice, memory, button lines, and a **style**. | Swapped onto a body. |
| **Look** | How one character appears on one kind of body. | Chosen per body. |

A body runs one character wearing one look. The host picks the look from what the body can show:

1. The character's hand-made look for this kind of body, if the pack has one (e.g. a VRM for a VR room or video call).
2. Otherwise, a look generated from the character's style by the body's painter (the robot's screen).
3. Otherwise, the body's own default face, with the character's voice and personality.

So Vita on JP01's screen is her style drawn by the square-screen painter. Vita in a VR chatroom is her full VRM body. Same character, same voice and memory, different outputs.

## What was tested

There were 4 characters (Mochi, JP01, Vita, Bender) on 2 bodies (JP01 square, Momo wide). The 16 moods, the reactions and lip sync were checked in the lab and in the 3D app.

| Approach | Result | Cost to add a character | Verdict |
|---|---|---|---|
| **A. Avatar variants:** a whole pack per character × body (like `jp01_neon`) | Full control. Every mood, reaction and mouth has to be rebuilt, and they drift apart. | One per body, each a project | Keep only for signature hand-made looks. |
| **B. Look per display type:** one painter per kind of screen | Needed in any case; it is the body's job (square vs wide vs 64×64 vs LED-only) | None | It is the body's renderer, not a choice. |
| **C. Character style drawn by the body's painter:** eye type, mouth type, colour and accent in the character | All 16 moods, reactions, blinks, gaze and lip sync carried over on both screens. Each character stayed recognisable. | About 1 line of data per character, plus new eye or mouth types when needed | **Default.** |

Why C keeps the expression: all motion lives in one face stream (`kin/eyes.js`). That stream holds eye width and height, lids, blinks, gaze, heart/star morphs, brows, mood colour, blush, tears and marks. A style only changes how that stream is drawn (`kin/styles.js`), so no animation is re-authored. The character's colour shows at rest, and strong mood colours (love pink, angry orange) still come through.

Gaps found:

- A style can't yet change *which* expression a character makes. Bender's "love" should be a smug wink, not heart eyes. This needs per-character mood overrides on top of the stream.
- Screen looks lose silhouette features such as Vita's ears and hair. Accent marks on the screen or ring colour would help.
- The mood backdrop and the 3D marks are on JP01 only so far.
- The real 64×64 panel needs a pixel painter for styles. `matrixFace` is the model for it.

## Installing on the real JP01

The robot's own code is the host. It installs a pack and wires the pack's channels to the hardware:

| Pack inputs (host → pack) | Pack outputs (pack → host) |
|---|---|
| Performance text from the agent (tagged: `[joy] Hi! [wink]`) | **Display:** frames for the screen it declares (64×64 RGB on the head, or a full canvas) |
| TTS audio, or text for the pack's own voice | **Audio:** PCM for the speaker, with the lip-sync track |
| STT transcript and "listening" state | **Lights:** LED ring colours per frame |
| Vision: where the person is (gaze target), presence | **Motion:** pan/tilt targets, with the wake-up and gestures |
| Robot state: waking, sleeping, battery, e-stop | **Events:** which expression or action is playing, for logs and sync |

The browser app is one host of this contract. The Teensy/Pi head is another. The pack never talks to hardware itself.

## Splitting Mochi

Today "Mochi" means three things. They should be separate:

- **Mochi, the character:** personality, voice, button lines, style (pill eyes, mint). It can be cast onto JP01 or any screen.
- **Momo, the display body:** the 3D shell with its 1024×640 screen and its painter. Any character can run on it.
- **Mochi Classic:** the ten recreated clips. This is a hand-made look (approach A) for wide screens, used when Mochi is on a wide body.

JP01 splits the same way: **JP01 the body** (CAD, screen, rings, joints, wake-up) and **JP01 the character** (its personality and blue style).

## Locked looks (no drift)

The character owns its looks. Bender's pack (v0.2.0) ships `looks/screen.json`, a representation in the `avatar/screen-look-v1` format. That file holds:

- the renderer version it is drawn with (`screen-face/1`)
- the displays it supports (square, wide)
- its style data
- a fingerprint of every drawing call for 16 moods, a wink and 3 mouth shapes on each display

A host only says which display it has. It wears the pack's look if it draws that renderer version, or shows its own face if it doesn't, never an approximation. `tests/screen-looks.test.mjs` fails if the look, the renderer or the expression engine changes a single frame. To approve a change on purpose: bump the pack version, then run `UPDATE_LOOKS=1 node --test tests/screen-looks.test.mjs`. Packs stay data only; no pack code runs.

## Expression sounds

Each character's sounds are text in its pack profile: `character.performance.sounds`. For example, Bender's love line is "Aw, fine. You're alright, pal." The host's voice engine (Kokoro today) speaks the line in the pack's `voice_id`, at the same moment the expression plays.

Packs never contain the voice engine or the AI model. Those stay in the host, which may run Kokoro, Gemma or Claude. A button with no line in the pack uses the host's stand-in line (`SOUND` in `app.js`), the same way a body falls back to its default face. Bender, Vita, Mochi and JP01 have their own lines.

Sound effects belong to one specific animation, such as Mochi's kisses and Pong hits: audio files in the pack (`assets/performance-audio/`), each timed to the clip it was made for. Only Mochi has these so far. Generic effects stamped onto every expression (a chime for joy, a pop for neutral) are deliberately not used, because they break the avatar illusion.
