# Nori and KIN consolidation — November 8, 2026

The user selected Nori's app, rig and presentation as the product foundation.
The local app now lives under `app/`; portable identity and appearance data lives
in `avatar-packs/`. Nori's body acting, camera, side-by-side conversation, reel,
tracking and recording are retained. KIN contributes Momo, the original soft
Vita renderer, the archived Aster model, formant/vowel analysis and Singer A.

The library grew from 39 to 50 packs: twelve demo character identities overlap
with one existing Mochi identity. Thirteen live representations include both
Vita looks. Existing profiles/defaults are preserved. A selected representation
uses its pack identity for conversation; selecting another appearance of the
same character does not start another agent. Unsupported imported Python and
MScript representations remain labelled source-only. Portraits and videos have
simple browser playback; legacy expression scripts are not executed.

## Mouth comparison

Both analyzers estimate vowels from audio; Nori already uses an LPC second
formant, not just broad frequency bands. KIN uses 40 Hz formant estimates to
choose one of five vowel morphs. The optional hybrid passes those weights through
Nori's mouth springs, preserving Nori's consonant, emphasis and pause signals.
The Studio comparison uses exactly the same bundled Kokoro recording. Nori stays
the default pending the user's visual choice. Recordings are in
`dev/evidence/migration/lip-nori.mp4` and `lip-kin.mp4`.

## Agent and audio ownership

`app/agent_worker.py` hosts the public JaegerAgent API. It does not copy the
engine. A separate Python 3.11 environment avoids JaegerOS's `<3.13` restriction
conflicting with the already working audio environment. Each browser conversation
and pack has its own in-memory agent session; tools and skills are disabled.
The existing Nori raw-provider chat helpers are historical unused code; chat now
uses the agent worker. Connected JaegerAI and bus speech contracts remain planned.

Speech and hearing retain Nori's local adapters. Fresh singing delegates to the
JaegerLyra scripts and environments through a local process adapter, with
progress and cancellation. Singer A is an independent prepared recording, added
after the unchanged original reel. This does not claim a network singing service.

## Baselines and retirement

Source-only Git baselines were captured before importing and tagged
`demo-baseline-2026-11-08`. Complete original working folders, including private
local caches and evidence, are retained outside the active playground under
`/Users/jonathanjenkins/GITHUB/AvatarDemoArchive/2026-11-08`. The original folders
were removed from the active playground, and the new app was restarted with
neither source directory present. `dev/evidence/migration/retirement.json` records
the locations. Move an archived folder back to its recorded original path to
restore that demo; external dependency links in the archive are absolute.
The baseline repositories exclude private state and large caches; they are not
standalone model distributions. Import hashes and original source notes remain
in `app/licenses` and the packs.

Retirement requires the new app to start and pass its key flows with neither
old source directory present. Archive relocation is reversible; it is not a
permanent deletion of the user's experiments. JaegerLyra remains in service.
