# One desktop UI standard for Jaeger Avatar, Mochi and Jaeger Agent Omni

Approved November 24, 2026; steps 0 and 1 done, and the baseline UI is in all three apps (see "Where it stands").

## Where it stands (November 24, 2026, late)

Jonathan's correction the same evening: the apps do not share a UI package. **Jaeger Agent Omni's own UI is the
baseline**; each app copies those files into its own repo, owns them, and changes them from there (Jaeger Avatar has
its avatar panel, JP01 will grow its own). Done, uncommitted:

- **Omni** (`jaeger-module-omni`): `web/` (React + TS screen: header, optional stage, Claude-style chat, side panel with
  an Agentic tab) built into `jaeger_omni_v2/ui/screen`; `jaeger_omni_v2/ui/` (`host.py` runs the agent worker,
  `serve.py` answers `/ui/config`, `/health`, `/agent/events`, `/agent/text`, `/agent/interrupt`; `window.py`);
  `python -m jaeger_omni_v2.ui` opens it (`--browser` for a tab). Checks: `tests/check_ui.py`, `cd web && npm test`.
- **Jaeger Avatar**: its own three-pane page kept (stage and Perform/Studio are wired to the avatar in that page); the
  chat restyled to the baseline's (plain replies, soft user block, tool calls folded under a reply, Copy), and the
  Agentic line now follows the agent's health.
- **Mochi**: `web/` copied from Omni (Mochi's own), `interfaces/screen/` (the server, the window, `DeviceWorker`
  reaching Mochi's Device); `mochi_live.py` opens the window with Mochi's face on the stage (`--browser`, `--no-window`).

The table and order below are the plan as first written; where they differ, this section is current.

## The standard (agreed with Jonathan)

Every app is built the same way, the way NexusUI (`~/GITHUB/VisualReactpy`) already is:

1. **Python engine.** The app's own Python process: the agent worker (Omni V2 or Jaeger Agent), models, server.
2. **React + TypeScript screen,** built with Vite, served by that Python process on loopback.
3. **A pywebview desktop window.** `python app.py` opens the screen in its own Mac window (the system WebKit);
   `--browser` serves the same screen to a browser or another device instead.
4. **Aether's look, copied, never imported.** Aether UI's tokens (colours, radii, type, spacing) and widget styles
   are copied into each app with a note of the Aether version they came from. No `@aether/ui` dependency.

Why pywebview and not Tauri or Qt: NexusUI's measured comparison (`apps/toolkit_comparison`, README) shows the web view
is the cost, not the host language: a Rust engine under the same React screen used the same CPU as Python. The avatar
needs a web view anyway (three.js and VRM). pywebview needs no Rust or Swift toolchain and keeps the browser option.

## What changes in each app

| App | Today | After |
| --- | --- | --- |
| Jaeger Avatar | Plain JavaScript page in a browser tab; Python server | Same server; React + TS shell; the existing renderers (rig.js, render-*.js) mounted inside it unchanged; pywebview window |
| Mochi | Three UIs: PySide6 windows (~9,400 lines, `interfaces/`), Tauri + React shell (`desktop-ui/`), and the web face from its bundle | One: Jaeger Avatar's screen in device mode (only the face and the controls a body needs), in a pywebview window, started by `mochi_live.py` |
| Jaeger Agent Omni | PySide6 desktop workspace (`gui.py` + `gui_widgets.py`, ~3,900 lines); a TUI | React + TS screen for the same workspace, served by Omni's Python process, in a pywebview window; the TUI stays |

Shared between the apps: a small window launcher (pywebview, plus the microphone and camera permission the Mac needs),
copied into each app the same way as the look. No new shared package.

## Order

0. **Prove the window can hear.** pywebview 6.2.1's Mac backend has no code that grants a page's microphone or
   camera request. A 30-line test window adds that permission handler and asks for the microphone. Needs Jonathan to
   click Allow once. If it cannot be made to work, stop and choose again (Tauri has used the real microphone in Mochi).
   **Done November 24, 2026: it works, with two small pieces.** Test window and page in the session scratchpad
   (`micwin/mic_window.py`, `mic.html`), run with NexusUI's pywebview 6.2.1 on macOS 26.6:
   - pywebview as it ships: the page's microphone request was never answered (60 s timeout).
   - With a permission handler on pywebview's page delegate (a subclass of `BrowserView.BrowserDelegate` with
     `webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:`, granting only
     `127.0.0.1`/`localhost`): granted at once, no prompt. It needs `@objc.signature(b'v@:@@@q@?')` and the decision
     block registered with `objc.registerMetaDataForSelector`; without them PyObjC crashes or cannot call the block.
   - The page's AudioContext starts `suspended` in WebKit and reads silence; `ctx.resume()` works with no click.
   - Result: the Elgato XLR Dock heard in the window (peak level 0.0064 with WebKit's echo cancelling on; the same
     microphone read 0.019 raw through sounddevice). Camera not tried. Run from a Claude Code shell; a launch from
     Terminal or a packaged app has its own macOS microphone permission.
1. **Jaeger Avatar in a desktop window**, the page as it is today, with Aether's tokens copied into its CSS.
   `./run.sh` opens the window; `--browser` keeps the tab.
   **Done November 24, 2026 (uncommitted).** `jaeger_avatar/window.py` (the window and the media permission) and
   `python -m jaeger_avatar` opening it: the server runs as a child in `--browser` mode and stops when the window
   closes. Without pywebview the app serves for a browser as before. `app/web/aether-tokens.css` is Aether UI
   0.2.0-alpha.296's default dark tokens, copied; `theme.css` maps the app's variables onto them (accent is now
   Aether's blue). `index.html` still has about 25 hard-coded colours (5 the old teal); left for later because
   another agent was editing that file. Checked: 114 Python tests, 51 JavaScript, site check, 57 packs; the window
   opened with the Omni V2 agent ready. Not yet checked: speaking into the window's microphone through the app.
2. **Jaeger Avatar's screen to React + TS,** one panel at a time (header, Perform, Conversation, Studio, Settings,
   Data flow), the renderers left as they are. The app works at every step.
3. **Mochi on that screen.** Device mode of the same screen, in the same window. The Qt windows and the Tauri shell
   stay until the new window has been compared with them and does as much; then they are removed.
4. **Omni's workspace to React + TS** in the same window, panel by panel, beside the Qt window until it matches; then
   the Qt window is removed.

Each step: tests first, the project's whole test command, and a muted run before it is called done.
Commits go to each repo's `dev` branch only when Jonathan says so.

## What blocks it

- **Another agent (Antigravity) is editing all three repos now,** uncommitted: JaegerAvatar (28 files), Mochi (~140),
  Omni (about 2,100 changed paths on `jr-integrated-nn`). It overwrote one of my files once tonight. Two agents
  rewriting the same UI files will lose work. It needs to finish and commit, or stop, before step 1 in that repo.
- **Size.** Steps 2 to 4 replace roughly 20,000 lines of UI. Each is days of work, not one session.

## Not decided

- Whether Omni's workspace and Jaeger Avatar's studio should become one screen. This plan keeps them two screens
  built the same way.
- JP01's ReactPy dashboard (`JP01_Firmware/controllers/JP01-VCC01/web/`) is left out; it runs on the robot's Jetson.
