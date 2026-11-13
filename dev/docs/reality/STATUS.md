# Current status — November 8, 2026

## Implemented

- A runnable local application at `./run.sh` / http://127.0.0.1:8790/, using
  Nori's app, rig, camera and presentation as the foundation.
- 56 avatar packs, 62 profiles and 104 representations (JP01 added Nov 9, with face packs JP01 Matrix / T-Face / Ring Eyes / Neon (mood-driven emotes) painted by `app/web/kin/jp01.js`, which also holds the firmware wake-up and the 24-LED side rings: Jenkins Robotics' pan-tilt display head, `kin-momo` preset `jp01` in `app/web/kin/renderer.js`, loading the real Onshape assembly (`avatar-packs/jp01/model/jp01.glb`: hardware removed, decimated to 300k triangles, head posed forward; pan at the neck bearing, tilt at the NeoPixel hub; a Face menu switches faces live, including Mochi eyes + mouth lip synced with Vita's vowels) with a procedural fallback, and Momo's eyes laid out for its square screen. Truth added Nov 8: fan persona on its own 3D body, `nori-3d` preset `truth` in `app/web/render-truth.js`; personal fan study, rights not cleared). The prior 39-pack library
  is preserved; the demo import adds 13 live representations across 12 identities,
  including both Vita looks, Momo, all ten Nori characters and archived Aster.
- Every pack has a live rig. The other 38 packs got a built-in rig restyled with
  `render.look`, alongside their existing representations (Mochi's LED faces are
  kept). Sixteen former neutral stand-ins now have distinct procedural vector fan
  studies. Truth retains its separately authored white stand-in. Only Vita and
  Aster have model files; these vector studies are not new 3D meshes.
- The 12 demo packs have traits, lore, author, license and a card rendered from
  the live rig. The five design studies have draft personas, marked as drafts.
  Mochi visual packs and design studies still lack traits and lore.
- Pack-backed character selection and a library of live rigs, portraits, videos
  and clearly marked unsupported source representations. A portrait is not
  described as an animated rig. Native rig presets are allowlisted.
- Independent persona/appearance selection, per-pack browser conversation, and
  a real JaegerAgent host through its public API in a separate local process.
  Tools and skills are disabled; memory is in-process until server exit.
- Original Nori lip sync plus optional KIN vowels/Nori spring smoothing. The
  same-audio comparison and recordings do not imply phoneme/word alignment.
- Nori's original narrated reel with an optional prepared Singer A finale.
  Fresh SoulX songs delegate to JaegerLyra; no singer implementation is copied.
- Kokoro MLX/ONNX speech, Whisper hearing, manual acting, model loading, optional
  webcam/mic puppeteering, recording and transparent/green output inherited from Nori.
- Original source hashes, license records, tagged source baselines and reversible
  archival of the former demo working trees after independent launch verification.

## Reference-driven tracking hardening — November 8, 2026

A primary-source comparison of Open-LLM-VTuber, OpenSeeFace, three-vrm,
KalidoKit, VTube Studio's API and XR Animator is recorded in
[Architecture](../vision/OPEN_SOURCE_REFERENCES.md).
No renderer/agent replacement or new dependency was introduced. Webcam startup
failure, runtime worker failure and camera disconnect now release capture;
late results/bitmaps cannot revive a stopped session and non-finite tracking
values are rejected. Five synthetic lifecycle/mapping tests pass alongside the
existing rig and three lip-sync tests. Physical webcam and permission-dialog
acceptance remains unverified; these tests do not measure tracking accuracy.

## Control link and hardware streams — November 10, 2026

- `avatar-control/v1` gains `act` and `speak` (an uploaded clip, its duration,
  lip closures and text) and reports `stop_seq`.
- Packs may declare `presentation.controls`; an agent is offered exactly those.
  JP01 and Truth declare theirs.
- The demo server exposes a loopback, token-protected control link (`/control`).
  The page attaches with the body's controls, follows every command and logs it
  under Inputs. `scripts/avatar_control.py` is an example client. The link is optional: the
  app's own agent, TTS and STT already drive the pack.
- Under the stage, Outputs shows each simulated hardware stream at native size
  (JP01 face 64 × 64 and both rings, Mochi 256 × 256) at 60 fps, inline or in its
  own window. Face streams are stand-ins (the twin scaled down) until a pack ships
  a native-resolution look.
- A Settings window (top bar) has a page each for the app's own agent, voice and
  hearing. Agent: the model file, creativity and longest reply, applied from the
  next reply without losing the conversation. Voice: the voice picker and a
  speaking-speed control, kept in this browser. Hearing: the Whisper model and
  language. Agent and hearing settings are saved in `app/.cache/settings.json`.
  Hearing runs on the GPU where there is one: whisper.cpp on Metal on Apple
  Silicon, behind a voice filter (77 ms for a short sentence on an M1 Max; the
  CPU engine it replaced took about 250 ms). Elsewhere it is faster-whisper on
  CUDA, or on the CPU; that branch has not been run. Settings, the node view and
  the "Who is driving" card show the engine, model and device in use.
  The Agent page also lists every JaegerAgent setting (its `AgentConfig` and
  `MultimodalConfig`, reported by the agent itself) with the value this app uses
  and why. The model is loaded in-process (llama.cpp on the GPU, no model
  server). Since November 11 the app runs JaegerAgent's voice loop by default
  (next section); the hearing and first-word numbers in this section are the
  older in-app path's. JaegerAgent's duplex modes and Omni are not used.
- First-word delay: the model runs inside the agent (llama.cpp on the GPU, no model
  server), streams as it writes, and has hidden thinking off unless "Skip hidden
  thinking" is cleared. The page sends its character ahead (`/warm`) so the model
  has read the instructions before the first message. Measured through `/chat` on
  an M1 Max with E4B, November 10: 0.13–0.19 s to the first words on every turn,
  the first included (0.40 s over HTTP to LM Studio; 0.9–1.3 s on a first turn
  before `/warm`). A whole spoken reply of about 450 characters takes 2.5–3.0 s.
- A Data flow window (top bar, opens beside the app) shows every stage live, with
  real timings and contents: mic phrases, Whisper requests and transcripts, the
  agent's streamed text and first-text delay, the commands its tags become, each
  TTS clip (time to make, length, lip marks), playback, and every animation
  trigger. A timeline shows the last 20 seconds; every animation channel is drawn
  live with its rest value. It runs over a BroadcastChannel in this browser, and
  the app sends nothing while the window is closed.
- **Standard humanoid; Truth rebuilt on it.** `app/web/humanoid.js` is a blank
  adult humanoid for 3D bodies: VRM humanoid bone names, about 7.5 heads tall in
  metres, with pelvis, waist, ribcage, neck, shoulders, arms, hands with four
  fingers and a thumb, legs and feet. It is posed by joint keyframes settled by
  springs; bones keep their rest length and joints rest on the floor instead of
  sinking through it. Truth (`render-truth.js`, `truth-pose.js`) is now that
  humanoid in white clay with its grin, replacing the earlier blended blob on a
  three-head skeleton. Kneel, sit, stand, clap, lean and sway were re-authored.
  The 3D renderer takes per-body march, shadow and scale settings; other bodies
  are unchanged. Every Mochi and Vita control and a live agent turn with each
  were checked: all respond, first sound about 1 to 1.5 s after a question once
  warm (the first turn after a server start takes about 10 s).

## Agent voice loop — November 11, 2026

- **The app talks through JaegerAgent's voice loop by default.** One worker
  process (`app/agent_loop.py`) holds the agent with its tools, the Jaeger
  Whisper module for hearing and the Jaeger Kokoro module for the voice. The app
  holds no model, voice or hearing code on this path: the page sends typed text
  and microphone sound in (`/agent/text`, `/agent/audio`) and plays the voice
  sound that comes back (`/agent/events`), moving the mouth itself.
  `/settings` and `/health` report what runs: `jaeger_kokoro_tts 0.13.0` on MLX,
  `jaeger_whisper_stt 0.14.0` on Metal with `large-v3-turbo`, `jaeger-agent` on
  llama.cpp, tools on, context 32768, the short tool list (21 tools).
- **The agent moves the body with a tool, not the app.** The worker registers one
  `avatar` tool (`jaeger_avatar/embedded/agent_tools.py`) that sends
  `avatar-control/v1` commands over the same control link an outside client uses.
  The page no longer turns inline tags into moves on this path.
- **The older in-app path is kept**: `JAEGER_AVATAR_LOOP=0`. Only it has clone
  voices, a voice per character, Piper, singing and inline-tag acting.
- **Measured old against new** on one M1 Max (32 GB, swap nearly full throughout),
  Vita, gemma-4-E4B-it-Q4_K_M, seven typed lines per pass in a muted browser:
  - First sound after a question: old path 0.37–1.98 s (median 1.10 s over two
    early passes, 0.46 s and 0.48 s in two later ones); voice loop 1.1–3.7 s,
    median about 1.7 s in six passes and 2.1 s in the last one (swap 34.9 of
    35.8 GB used). **The voice loop is slower to first sound. The gap is open.**
  - Where the voice loop's wait goes (its own timing notes): first token
    0.16–0.42 s (up to 1.06 s in the last pass), first words handed to the voice
    0.56–1.13 s (the avatar call, about 0.4 s, is written before the words),
    first sound made 1.07–2.27 s. The voice takes 0.5–1.1 s to make that first
    clip; warm, the same clip takes about 0.1 s.
  - Why the first clip is slow: the machine is out of memory (swap full, LM
    Studio and Ollama loaded too), so macOS packs away the voice's idle memory
    within seconds and the first clip after a pause pays to bring it back: about
    110 ms warm, 220–690 ms after 6 s idle, about 620 ms after 20 s. Both paths
    pay it. Tested, no help: pinning the memory (`mx.set_wired_limit`), a larger
    MLX cache, small keep-alive work, and waking the voice as the turn starts
    (first token went from 276 ms to 552 ms, first sound stayed at 1.7 s).
  - Why the old path still starts sooner: its inline-tag persona makes replies
    open with a tiny exclamation or sound ("[joy] Oh!", "[giggle]"), every
    sentence is its own clip, and clips of 12 characters or fewer are kept once
    made (`voice_engine.py`, `short`), so the opening plays from memory while
    the voice wakes. When its reply opens with a longer clause it takes
    1.0–2.0 s, the same as the voice loop.
  - Tried on the voice loop, seven lines twice each: words before the avatar
    call is about 0.4 s sooner, but the body moved on 4–6 of 7 turns (7 of 7
    with the call first) and one turn ran a web search — not kept. Asking for a
    one-word opening reaction: the model wrote "Oh, hi there!", not "Oh!", and
    first sound did not change (means 1.0–1.9 s against 1.2–1.4 s) — not kept.
    An opening one-word "Oh!" or "Hmm?" now goes out as its own clip (the
    agent's `StreamedSpeech`); this model seldom writes one.
  - Built in the agent module, not yet judged by ear: a one-word opening clause
    ("Oh,") is its own clip (`StreamedSpeech`), and the agent's voice node keeps
    clips of 12 characters or fewer once made (128 at most, emptied when the
    voice changes), as the old path does. Measured over 28 turns (the seven
    lines four times, one conversation): **median first sound did not move**,
    about 1.7 s in the first two rounds and 1.8 s in the last two. The model
    wrote a different short opener almost every turn ("Hello!", "Oh wow,",
    "Honestly,", "Oh,", "Hi again!", "Ooh,", "Okay,"), so a kept clip was
    reused on 0 of the first 14 turns and 4 of the next 14 ("Ooh,", "Okay,"
    twice, "Here you go!"). On those four, sound began with the first words
    (0–15 ms after them): first sound 0.81, 0.93 and 1.01 s, and 2.13 s on a
    turn whose words came late. A short clip made for the first time costs as
    much as any first clip (0.56–0.74 s after the words). Old path, same pass:
    0.44–0.51 s on four lines, 1.31 s and 1.45 s on two, no sound on
    "Take a bow." (it replied "[bow] [bow]").
  - Found in that pass: on 2 of 28 turns (both stories in the first two rounds)
    the reply ended with a made-up tool note
    (`tool {"ok": true, "did": ["emotion excited"]}`) written after the avatar
    call, which the voice would read aloud; and "What time is it right now?"
    got a made-up answer in the last two rounds ("11:30 AM on Tuesday,
    October 24th, 2024"). Cause, found 2026-11-11: tool results reached
    gemma-4 as a `tool` turn of raw JSON that its template does not have, so
    the model ignored the result or copied the note. Fixed in the agent module
    (`adapters/local_llama.py`): results now go back as `tool_responses` on
    the model's own turn. Checked, the seven lines twice in one conversation:
    the time was made up on 2 of 2 turns before and right on 2 of 2 after, in
    two separate runs. The tool note did not come back in any 14-turn run,
    before or after, so it is not proven fixed — only its source is gone.
  - What that fix cost and gave, same 14 turns in the app: gemma-4 now writes
    the avatar call alone and waits for its result, one more model call. First
    words came 0.2–0.3 s later (median 1.23 s and 1.12 s against 0.89–1.02 s
    in the four earlier rounds); first sound was 2.31 s in the first round and
    1.53 s in the second against 1.70–1.82 s, inside this machine's
    run-to-run spread (the voice's first clip took 0.6–0.9 s after the words);
    the finished reply was the same (1.75–1.85 s against 1.70–1.78 s). The
    feeling now lands with the call, 0.64–0.96 s into the turn, instead of
    with the finished reply (1.4–5.4 s). A feeling was set on 4 and 5 of 7
    turns (4 to 7 of 7 before).
  - **Voice and lips on the voice loop, November 11.** The character's chosen
    Kokoro voice now reaches the loop (the page sends it with who it is; the
    loop's voice node changes voice without loading again), and each clip
    comes with the voice module's lip marks, so m/b/p close the lips and f/v
    tuck the lip on this path too. Checked on the running app: a spoken turn
    sent 10 marks with its sentence clip in Heart and in George; the same
    line through the module and through the app's own code gave the same
    marks within 3 ms in Heart, Bella and Emma, and the module keeps the
    opening "m" of "My…" that the app's own code loses when it trims the
    start. A voice the module does not have (a clone) is not sent; the loop
    keeps its voice. Not done: speed per character or feeling.
  - **`/compare.html` — two avatars, one voice path each.** The same character
    twice; each side speaks the typed line through the voice picked for it
    (the voice module inside the loop, in any of the 15 Kokoro voices, through
    the new `/voice/module`; or the app's own voices through `/say`), one
    after the other. Under each: time to the clip, length, level, dead air and
    lip marks, measured on that clip. What it showed for "My puppy found five
    big blue marbles, wow!" in Heart: the module's clip starts with 0.32 s of
    dead air and ends with 0.49 s (the app's own code trims to 0.01 s and
    0.06 s), and is quieter (loudness 0.044 against 0.110); the page evens
    the level when it plays, as the app does, unless "Play as made" is
    ticked. The dead air is 0.28–0.43 s of wait before every clip on the
    loop that the app's own path does not have. Not fixed.
  - Clone voices, checked November 11: they work, in the app's own code only
    (`app/voice_engine.py`, Chatterbox Turbo on MLX). A clone made from a
    6.7 s clip of a built-in voice spoke one line (a 2.97 s clip, 8.9 s to
    make with the model loading, no lip marks) and was deleted. Nobody
    listened to it. The agent cannot use a clone: it is not a module.
  - **Dead air trimmed in the voice module, November 12.** Every clip now
    keeps 12 ms before the voice and 90 ms after (the values this app's own
    voice code uses), with the lip marks moved to match. The same line through
    the module and through the app's own code, in Heart, Bella and Emma: the
    same length (2.54–2.61 s), the same lead (9–12 ms against 8–11 ms) and the
    same lip marks. Before, each module clip began with 0.28–0.43 s of silence
    and ended with 0.49 s. Level is still the module's own (loudness
    0.05–0.07 against 0.11); the page evens it when it plays. Nobody has
    listened to it yet.
  - **Is the module slower than the app's own voice? No.** Same machine, same
    process layout as the app runs: a short clause takes 354 ms (median) in
    the module and 337 ms in the app's own code when nothing else runs, and
    0.33–0.45 s a clip against 0.3–0.6 s while the model is writing. The first
    clip after a pause is slow in both (0.55–1.24 s in the agent's process,
    0.33–1.13 s in the server's), as measured before: the machine is out of
    memory (swap 37.6 of 38.9 GB) and the voice's idle memory is packed away.
  - **Where the loop's wait goes**, seven lines twice on each path with both
    servers loaded (so every number is higher than usual): first words about
    0.77 s into the turn on the old path, 1.08–1.32 s on the loop (the model
    writes its avatar call first, then makes a second model call); first
    sound 1.64–1.77 s on the old path, 2.03–3.04 s on the loop. The gap is
    open. Not tried: the same pass with the other model apps closed.
  - **The extra model call was measured, not cut, November 12.** With the
    model alone a turn with an avatar call reaches its first spoken word at
    0.53 s (median): 0.12 s to the first token, 0.25 s to write the call,
    0.12 s for the second call, the rest small. The second call's 0.12 s is
    the model library's floor for reading even a few new tokens, and the only
    way round it is the off-template shape that made the model invent
    answers. One short word before the call was tried: the model still called
    first. Neither was adopted.
  - **Found on the way and fixed in the agent: made-up tags held the voice
    back.** When the model wrote `<emotion:joy> <action:wave>` instead of
    calling the avatar tool, the voice stayed muted until the reply was
    finished and then read the tags aloud. They are now dropped and the voice
    keeps going. Worker alone, 14 turns of such a conversation: first audio
    1.35–2.6 s before, 0.41–1.08 s after (median 0.82 s, then 0.43 s). The
    body still does not move on such a turn.
  - In the app after that, seven lines twice, one server: first words 0.94 s
    and 0.81 s (median), first sound 2.01 s and 1.52 s. The same lines typed
    with no page open: first words 0.92 s and 1.07 s, first audio 1.52 s and
    1.35 s. The worker alone: first words 0.41–0.58 s, first audio
    0.41–1.08 s (that conversation made no avatar calls). So about 0.4–0.5 s
    of the wait is the avatar call before the words. The worker-alone figure
    is not a fair one: see the trace below.
  - **Traced November 12: the voice's first clip is not slower inside the
    app.** The earlier gap came from the two test drivers: the worker-alone
    driver typed the next line the moment a reply ended, so the voice was
    still warm; the app driver waited for the sound to finish. With the same
    character, the same lines and 8 s of quiet before each turn, the worker
    alone made its first clip in 827 ms (median) against 884 ms in the app
    with the page open, in the same busy half hour; the same clips cost the
    same both ways ("Here you go!" 810 ms in the app, 827 ms alone;
    "Honestly," 685 and 669 ms). The page is not it either: the loop's voice
    alone took 1151 and 418 ms a clip with no page, 1144 and 528 ms with the
    page drawing the avatar at 60 frames a second, 1056 and 690 ms with it
    drawing 2 (two rounds; the rounds differ because another agent's test run
    was loading the machine in the first).
  - What the first clip of a reply costs, the same 0.8 s line ("Here you
    go!") each time: 88 ms straight after another clip, 156–168 ms after 3 s
    of rest, 272 ms while the model is writing (voice and model alone in one
    bare process); 508 ms as the first clip of a turn in the worker on a quiet
    machine, 810–830 ms while the other job ran. All of it is in the voice's
    model step; turning words into sounds takes 1–13 ms. Later clips of the
    same reply take about 0.1 s per second of sound.
  - What makes it worse on this machine: when the voice has rested a few
    seconds and something else is busy, macOS packs the voice's working
    memory away. The same line after 6–8 s of quiet took 456–1176 ms with
    about 4,600 page faults in the worker while the other job ran, and
    148–247 ms with about 20 once it ended (swap about 28.5 of 29.7 GB used
    both times). Not proven: that a machine with free memory never pays it.
  - Tried in the traced worker, none kept (nothing was changed in the code):
    the model waiting while the voice makes a clip (first clip 528 ms against
    627 ms on alternate turns, the reply's text done 0.6 s later); waking the
    voice as the turn starts (first clip 390 ms against 592 ms, but the words
    came 0.2 s later, so first sound 1.37 s against 1.43 s); waking it 1.5 s
    before the words, as it could when someone starts to speak (346–435 ms on
    three turns, 704–782 ms on two others); keeping MLX's memory resident
    (571 ms against 542 ms over 28 turns); a new thread per reply is not it
    (121 ms against 112 ms).
  - A first sentence with no comma used to be one clip: its words reached
    the voice at 1.0–1.2 s (the model had to finish the sentence) and a
    3–9 s sentence took 0.8–1.0 s to make, so first sound came at 1.8–2.2 s
    on those turns (3 of 14, worker alone, quiet machine) against 0.8–1.5 s
    when the reply opened with a short clause.
    **Cut at a breath point since November 12** (in Jaeger Agent,
    `core/outputs.py`): once four words are out, the opening goes to the
    voice before the first "and", "but", "because", "when", "while" or
    "which"; the rest of the sentence follows as one clip. Old against new,
    worker alone, same seven lines, 8 s of quiet before each, the arms
    alternated (old, new, old, new), first sound on the three turns it
    touches: "I'm feeling super energetic | and ready…" 1750 and 1704 ms
    before, 1419 and 1533 ms after; "Did you know that octopuses are super
    smart | and can…" 2924 and 2616 before, 1323 and 1728 after; "Hearing
    from people like you | and getting…" 2383 and 1906 before, 1110 and
    1465 after. No silence between the two halves on any of them. The other
    four lines are not cut and moved either way by up to 0.2 s (the machine
    was busy: 418% of a core in use when the run began, 145% in the middle,
    339% at the end, and the agent's test suite ran during the first old
    run). Not judged by ear yet: the first half is voiced without the rest
    of its sentence, so its melody may differ. The list of joining words is
    short on purpose; "you | and I" can be cut wrongly.
  - The Data flow window (`/flow.html`) draws the path that runs. With the
    voice loop on (the default) the agent is one framework node with a
    hearing, a model, a tool-use and a voice section, each lit by its own
    events, and the app's own hearing is not drawn; with the loop off it
    draws the older path. What that map makes plain, still open: the intro
    line, the guided reel, songs and sound effects are voiced by this app's
    own voice code (`app/voice_engine.py`), not by the agent's voice module;
    only the avatar tool's calls are reported (the agent sends no event for
    its other tools); an avatar call from the model acts at once and holds
    ten seconds, so in a reply a move is not timed to a word (in a scene it
    is: next point).
  - **Scenes with moves on cue, since November 12.** A scene is a script of
    steps in order, split by `|` or a new line: `say` a line, `wait`
    seconds of quiet, and moves (`emotion`, `action`, `look`). A move
    happens as the next line or quiet starts; `hold` keeps the moves before
    it that many seconds while the scene waits; `on` a word puts the moves
    before it on that word of the line just said. Write it in the
    Perform tab's Scene box. The agent performs it (`engine.perform`,
    `jaeger_agent/core/scene.py`, in the Jaeger Agent repo): it reads the
    script (one it cannot read is refused with the step named, before a word
    is said), voices each line whole in its own voice with no model, and
    sends each line's moves with the clip as cues (seconds from the clip's
    start, and the avatar call to make then). Quiet goes out as silent
    sound, so the sound's clock is the only clock. The page plays the clips;
    when the playing clip's clock reaches a cue it tells the agent
    (`/agent/cue`), whose avatar tool makes the move through the control
    link, exactly as for a call from the model. The lines join the
    conversation. The Data flow window has a Scenes section on the agent
    card and lights the cue's path (Performance → Agent → Control link →
    Animation); each control event says how long after its moment the move
    landed.
    The page holds a scene's clips until every line is voiced, then plays
    them straight through: four lines (9.8 s of sound) started 0.9–1.1 s
    after Perform.
    Measured in headless Chrome on Vita, scenes with four cues, machine at
    136–398% of a core in use. With no lead a move landed 6 to 60 ms after
    its moment (33 ms in the middle, 20 moves; the page reads the control
    link every 50 ms). Sent 30 ms early (`CUE_LEAD` in `app.js`): 19 ms
    before to 31 ms after for the later cues, but the first cue of a scene
    up to 108 ms late, because the agent was still voicing the later lines
    when it was asked for the move (its answer took 14–95 ms then, 2–4 ms
    otherwise). With the clips held as well: 19 ms before to 39 ms after,
    all 31 moves on 8 freshly opened pages with no other page connected.
    One late move is not explained: once, before the hold, the first move
    of the first scene on a fresh page landed 940 ms late (and once 141 ms).
    Ruled out: the app's own voice preparing reel clips, a long task on the
    page, the page attaching to the control link twice. A run that recorded
    no moves at all was explained: four test browsers left open from a
    failed script were playing every scene too and sending its cues first.
    Since then a page that does not have the body (a newer page took the
    control link) sends no cues; with two pages open, each move was asked
    for once. Each control event in the Data flow window says how late its
    move was, so a recurrence shows.
    Checked with the engine alone: after a scene asked "So, what did you do
    today?", "Sorry, I missed that. Can you say your question again?" got
    "No problem at all! I was just asking what you did today." The same
    model answered "What was the last question you asked me?" with "I don't
    have a memory of asking you a question", although it was given the line
    (what the model is given was printed and checked). In the app, after a
    five-line scene performed twice, the first probe got "I think I got a
    little mixed up there. Could you maybe remind me what you were asking?"
    So the lines are in the conversation, and this small model uses them
    some of the time (1 of 3 probes).
    Open: a move on a word is timed by the share of the letters before it,
    not by the voice's word timings, and no scene has been judged by eye or
    ear. A full-body move runs to its end (a clap takes about 3.8 s). One
    asked for meanwhile used to be dropped without a word; since November
    13 it waits and follows (`rig.move`: one move waits, the latest asked
    for). Seen in a scene, "action clap | say I clap for you, | action bow
    | say and then I take a bow.": the clap began 0.65 s after Perform and
    the bow 4.45 s after, when the clap ended: no longer lost, but 2.7 s
    after its cue and after its line was over. So, the same day, a new move
    now eases the running one out over a quarter of a second (as Stop
    does) and then starts; asked again for the move she is already making,
    she carries on. The same scene, three runs: the bow began 284, 285 and
    301 ms after its cue was sent (the clap 34 to 68 ms after its own).
    Not judged by eye: how a clap cut short a second in looks. Cues are checked on
    each drawn frame: a page in a hidden tab draws none, so its cues wait,
    and are lost if the clip ends first. When the agent plays the sound
    itself (a robot's speaker) nothing makes the cues yet. A feeling still
    held from before a scene carries into it.
  - **She writes a scene herself when asked in words, since November 12.**
    The model has a `scene` tool (`jaeger_avatar/embedded/agent_tools.py`):
    it writes the script, the agent reads it (`engine.stage`), and the
    scene is performed once any words that came with the call are spoken.
    Three things made it work, all found by asking her and reading what
    she wrote. (1) The first script form (one beat a line, parts split by
    `|`) lost most of her scenes: she wrote everything on one line, so the
    form became steps in order, and the reader also takes "wait 0", line
    breaks written as `\n` and two moves in one step joined by a comma.
    (2) After the tool answered, the model was called again and narrated
    the scene before it played ("Wow, how was that?") or apologised for an
    empty reply; the agent loop now ends the turn on a tool registered as
    a performance (`side_effect="performance"`), and sends a refused script
    back to the model to fix. (3) One sentence in the body rule
    (`app/server.py`) says when to write a scene. Same nine asks, each arm
    on a fresh server and conversation: without the sentence she wrote a
    scene on 5 of the 6 asks that wanted one ("Look up for two seconds,
    then look at me and tell me a secret" was done with two avatar calls
    at once); with it, on 6 of 6, none narrated. On the 3 ordinary asks
    both arms began with one avatar call and wrote no scene. No script was
    refused. Her moves landed 17 ms before to 40 ms after their moments
    (13 moves). One model (gemma-4-E4B), one character (Vita); whether
    the scene she writes is the scene that was asked for was read from the
    scripts, not judged by eye or ear.
  - **A scene's moves are fitted to the body before it starts, since
    November 13.** The body is asked once what it offers (`offers` over the
    same pipe as the avatar tool), and the agent asks about each call a
    scene will make (`engine.perform(script, fit=)`, `engine.stage(script,
    fit=)`; the fitting is `fitted` in `jaeger_avatar/embedded/
    agent_tools.py`). Your own scene with a move the body lacks is refused
    before a word, with what the body does offer (seen in the app: "This
    body cannot do action moonwalk (it does: spin, dance, hop, …)"). A
    scene the model wrote plays without that move, and the tool's answer
    tells the model what was left out. Why not refuse hers too: the same
    ten asks, three ways, each on a fresh server and conversation. With no
    check, all 7 scenes played and 3 of them had a move refused at its
    moment ("emotion happy", "action gasp", "action wave"), which she was
    not told; one of those also left out the question it was asked for.
    Refusing the script: she rewrote 1 of the 3 (after saying "Whoopsie! I
    think I used an emotion I can't actually show right now"), and on the
    other 2 only apologised and performed nothing, so 5 of 7 played.
    Fitting: 7 of 7 played, nothing refused at its moment, and "Wave hello,
    wait one second, then ask me my name" asked the name, without the wave
    this body does not have. Not measured: whether being told stops her
    naming the same move again later in a conversation.
- Not run: a live microphone, echo with real speakers, other characters or
  models, non-Apple hardware.

## Fresh install — November 13, 2026

`./run.sh` on a fresh checkout now installs everything but the model file.
It makes the app's environment, then the agent's (`.agent-venv`, Python 3.12
or 3.11) from `requirements-agent.txt`, which pins JaegerOS, Jaeger Agent,
Jaeger Kokoro and Jaeger Whisper each to one commit. Before this the agent,
voice and hearing were read from three dev checkouts beside the app, and the
file pinned an agent commit with no streaming and no scenes.

Tried once, on this Mac, from the committed `dev` branch cloned into an empty
folder, with pip's cache off (machine busy, load 13 to 30):

- **First run, no model file:** both environments were built in 6 min 4 s
  (939 MB and 1.8 GB), llama.cpp compiled, and the app started. Header,
  terminal and `/health` said "no model file in ~/models".
- **Second run, model file present:** nothing was installed again. The agent
  was ready 73 s after `./run.sh`, which includes downloading the voice
  (340 MB). All four Jaeger packages were loaded from the new environment,
  none from a checkout.
- **Asked "How are you today?":** one avatar call (joy), three spoken clips.
- **Asked for a scene in words:** she wrote it, it played, and its two moves
  landed 8 and 25 ms after their moment. No errors on the page or in the
  agent's log.

What this run did not show:

- The three module commits (agent `816a619`, Kokoro `ba4085e`, Whisper
  `a46e903`) are on `dev` on this machine only. For the test git read those
  three repos from disk; JaegerOS and every other package came from the
  network. Until the three `dev` branches are pushed, nobody else can install.
- The model file was the one already on this Mac. The download address in the
  README answers (5.3 GB) but the file was not downloaded again.
- Whisper's model files were already on this Mac (pywhispercpp keeps them
  outside the app's folder), and nothing was spoken into a microphone.
- Same computer: its Python 3.11, its compiler, Apple Silicon. Not a second
  machine, not Linux, not Windows.

When only scripted replies answer, the app now gives the reason
(`why_scripted` in `app/server.py`): started with `--scripted`, the agent is
not installed, no model file, or the agent stopped. `tests/test_install.py`
runs `run.sh` against stand-in Pythons: fresh checkout, second run, 3.11 for
3.12, no usable Python, and an install that fails (removed, tried again).

## Still planned / limited

- GUI pack authoring, packaged desktop installers, persistent agent memory.
- Connected JaegerAI, JaegerOS speech/pose bus integration and robot deployment.
- General execution of imported MScript/Python character representations.
- Word/beat-aligned acting. Both current lip methods estimate mouth shapes from audio.
- Installing on another machine. A fresh checkout was installed in an empty
  folder on this Mac (see "Fresh install" below); a second computer, Linux and
  Windows are not tried. Real webcam hardware, room microphone behavior and OBS
  capture remain separate acceptance checks. Fresh song timing is not a latency
  guarantee.

## Verification

The migration browser run exercised every live representation with finite poses,
the same 4.325-second recording through both mouth methods, the 6.1-second Singer A
sample, Stop, reel Pause/resume, all eight original Nori chapters plus the Singer A
finale, and Clanker's portrait. Browser evidence is under `dev/evidence/migration`.
A fresh JaegerAgent/Gemma reply and a new 5.12-second SoulX song completed through
the new application. Twenty Python tests, the imported Nori rig suite and three new JavaScript
lip-sync regressions pass. The app was restarted and the full browser reel
repeated successfully after both old source directories were archived. Layouts
fit at 320, 390, 850 and 1280 px. Exported comparison MP4s contain H.264 video and
AAC audio. Delayed sample cancellation, Stop before a song job returns its ID, Pause during
voice preparation, shared conversation across Vita representations and Start over
all pass the browser lifecycle check. Regression results and retirement audit
are beside the browser report.

Required checks: `npm test`, pack validation, Python test discovery,
`python3 scripts/check_site.py` and `git diff --check`.

Website source is `docs/`; the existing `gh-pages` branch publishes the static
project page. Editing that source does not itself deploy it. The inherited
workspace/module examples remain reference scaffolds, not the running app.

## Robot pack preparation — November 8, 2026

`python -m jaeger_avatar.deploy build` exports all 50 canonical packs and 45
explicit character/v1 representation views for Mochi, with per-file checksums,
source integrity checks, no symlinks and a per-representation readiness report.
Nested clip-state paths are now validated as well. Export relocation and tamper
checks are covered by regression tests. [Deployment instructions](../packs/ROBOT_DEPLOYMENT.md)
distinguish portable data, consumer rendering and physical robot qualification.
Browser rigs still need a compatible renderer; legacy scripts, target hardware,
placeholder art, draft personas and redistribution clearance remain release gates.
No consumer installation or JP01 hardware deployment is claimed.

Offline consumer result: all 45 compatibility exports render through the actual
Mochi dispatcher and JaegerAnimation at 128x128. All declared expression/clip-state
choices were sampled at 0 and 500 ms. The original 50-pack bundle passes checksum
verification before and after qualification. Evidence: `dev/evidence/deployment/mochi-offline.json`.

## Named Mochi demo family — November 8, 2026

Mochi representations now have explicit names: Classic, Enhanced, Live and
Portrait. Momo Shell keeps its own identity. Classic is a new selectable
representation using browser-compatible H.264 copies of preserved original
clips. Library/tab labels use explicit representation names when present.
There are now 97 representations across the same 50 packs, with 46 legacy
export options. The [demo guide](../packs/MOCHI_DEMO.md) documents the standalone
comparison, reproducible bundle builder and runtime requirements. Three family
exports pass offline consumer rendering; Classic and Enhanced browser playback
and scene switching are verified. Physical JP01 qualification remains pending.

### Mochi procedural recreation study — 2026-11-08

`/mochi-recreation.html` compares the first original video pair against a
hand-authored procedural face on the existing fixed 3D body. Squint/wink and
Pong transformation work with synchronized scrubbing and independent playback.
Expression strength and gaze remain adjustable. No video pixels drive the face.
This is an approximate first-scene study, not a deployed robot pack or all-scene
recreation; see `dev/docs/packs/MOCHI_DEMO.md`.

## Demo pack completion review — November 8, 2026

`/demo-packs.html` launches the live rig for each of the 51 current packs.
Sixteen grey stand-ins were replaced with distinct allowlisted vector fan
studies, driven by the existing pose and speech channels. Other shared rig
families remain unchanged. A malformed/incomplete pack no longer blanks the
entire runtime catalog, and the main library count is dynamic. All 51 launch
links selected the expected active character in browser checks. See
[demo pack review](../packs/DEMO_PACK_REVIEW.md) for capabilities, scope, evidence
and the distinction between launchable demos and finished AAA/hardware assets.

## Shared application theme — November 8, 2026

Studio, the pack launcher, Mochi comparison and Mochi family demo now share
`app/web/theme.css`: the home page's dark panels, typography, borders and mint
accent. The portable Mochi demo builder embeds the same stylesheet so regenerated
bundles keep the application theme.

## Mochi embedded desktop consumer — November 8, 2026

Mochi now has a selected `procedural_3d` representation and a reproducible
single-avatar runtime bundle (~2.5 MB), built by `scripts/build_embedded_mochi.py`.
The native macOS consumer embeds the same shell/eyes and supplies its existing
JaegerAgent and Kokoro pipeline. The versioned control contract supports bounded
expressions, reactions, gaze, speech amplitude and Stop. See
[Embedding](../runtime/EMBEDDING.md). This is desktop integration; robot pixel
output and measured hardware audio alignment remain unqualified.

## Mochi companion pack release 0.2.1

The embedded Mochi runtime includes all ten idealized procedural Classic clips,
with named agent/manual actions and a version-pinned consumer lock file. Patch
0.2.1 restores canvas state after custom clip painters so live eyes resume at
the correct scale. Mochi's React desktop consumer uses the shared renderer
and its own JaegerAgent/Kokoro/Whisper services. This does not add those services
to JaegerAvatar or qualify physical robot deployment.

## Mochi audiovisual pack 0.3.0 — November 9, 2026

Mochi now contains original procedural Foley/synth WAV tracks for all ten clips
and selected reactions/emotions, with a portable Web Audio performance player.
The desktop Mochi consumer aligns audio to clip start time, cancels it on Stop,
mute, replacement and disposal, and ducks effects during speech. Speech synthesis
remains the host's Kokoro service. These are cartoon effects, not recorded human
vocal performances. The canonical pack owns the WAV assets and timing metadata;
no commercial reference audio is sampled. Other consumers must explicitly mount
the player; adding files does not automatically enable sound in every older demo.
The embedded builder supports a checksummed visual baseline so this audio release
can preserve the deployed renderer while unrelated visual work continues.
