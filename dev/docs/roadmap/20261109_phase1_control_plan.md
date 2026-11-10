# Phase 1: an agent outside the avatar controls it — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any process outside Jaeger Avatar can drive the character on stage (feel, react, act, look, speak with its own audio and lip timing, stop), limited to the controls the pack declares, and the app shows every command arriving.

**Architecture:** Extend the existing `avatar-control/v1` Controller (`jaeger_avatar/embedded/control.py`) with `act` and `speak`, take each pack's declared controls as its capabilities, and expose the Controller on the demo server through a small loopback link (`POST /control`, `GET /control/state`, clip upload). The page attaches with the current body's controls, polls state every 50 ms as the embedded renderer already does, and turns changes into the same rig calls its own buttons use. An example command-line client plays the external agent and TTS.

**Tech Stack:** Python 3 standard library (`http.server`), plain ES modules in the browser, `node --test`, `unittest`.

**Spec:** [`dev/docs/vision/20261109_one_engine_design.md`](../vision/20261109_one_engine_design.md). Scope is the "order of work" it sets: avatar creation, packs, and the app working with an agent. JaegerAnimation migration, JP01 device work, native-resolution looks and voice sounds are out of this plan. Also deferred: `wear` (choosing the pack stays the host's library choice), routing the app's own built-in agent through the link (it keeps its direct path; the link proves the external one), and declaring displays at runtime (hardware profiles stay hard-coded in `app/web/hardware.js`).

## Global Constraints

- Commands in, animation out: the avatar never plays audio and never writes a device's pixels.
- The agent, TTS and STT live outside the avatar; the app only connects them to demonstrate control.
- The engine exposes exactly the controls the pack declares; it does not invent controls of its own.
- Packs are data; no pack code runs.
- Existing contract kept: `avatar-control/v1` fields `schema, avatar, session, seq, issued_at_ms, ttl_ms, op, value`; TTL 1–30000 ms; gaze `[-1,1]` per axis; jaw `[0,1]`; stop value `null`.
- The control link binds loopback only and needs a token.
- Develop on `dev`. Commit steps run only after Jonathan says to commit.
- Tests: `node --test tests/*.test.mjs` and `.venv/bin/python -m unittest discover -s tests` both pass after every task.

## Review Focus

1. A command for a control the current pack doesn't declare (`act clap` on JP01) is refused with a clear message, and the stage doesn't change.
2. Switching character while a client is sending: the page re-attaches with the new body's controls, the old session's commands are refused, nothing throws.
3. A `speak` whose clip is missing or whose marks are malformed: refused or logged, the mouth rests, the next command still works.
4. No page open: `POST /control` answers that nobody is attached instead of accepting commands into the void.
5. Two `speak` commands in quick succession: the newer one preempts the one playing (the speaker's rule), never both at once.

---

### Task 1: `act` and `speak` in the Controller

**Files:**
- Modify: `jaeger_avatar/embedded/control.py`
- Test: `tests/test_control.py` (new)
- Modify: `dev/docs/runtime/EMBEDDING.md` (Contract v1 operations list)

**Interfaces:**
- Produces: `Controller(manifest)` where `manifest['capabilities']` may now hold `actions: list[str]` (default `[]`).
  - `op 'act'`, value a name in `capabilities['actions']` → state `act`, `act_seq`, `act_until_ms`.
  - `op 'speak'`, value `{'clip': str, 'duration_ms': int, 'marks': list, 'text': str}` → state `speak` (the value), `speak_seq`, `speak_started_at_ms` (= `issued_at_ms`), and `speaking=True` until `issued_at_ms + duration_ms`.
  - Speak rules: `clip` starts with `/control/audio/`; `duration_ms` between 1 and 60000; `marks` at most 400 entries of `[start_s, end_s, 'p'|'f']` with `0 <= start <= end <= duration_ms/1000`; `text` at most 600 characters.
  - `snapshot()` returns the new keys, with `act` and `speak` reset to `''`/`None` after they expire.

- [ ] **Step 1: Write the failing tests** in `tests/test_control.py` (`unittest`, a fixed clock `lambda: 1000.0`):
  - `test_act_must_be_declared`: manifest `{'avatar':'jp01','capabilities':{'emotions':['neutral','joy'],'reactions':['wink'],'actions':['wave']}}`; `send('act','wave')` gives `state['act']=='wave'` and `act_seq==1`; `send('act','clap')` raises `ControlError('Unknown action')`.
  - `test_speak_sets_speaking_for_its_duration`: `send('speak',{'clip':'/control/audio/a1','duration_ms':1500,'marks':[[0.1,0.15,'p']],'text':'Mom'})` gives `speaking is True`, `speak_seq==1`, `speak['clip']=='/control/audio/a1'`; with the clock moved to 2600, `snapshot()['speaking'] is False` and `snapshot()['speak'] is None`.
  - `test_speak_rejects_bad_values`: each raises `ControlError`: clip `'http://evil/x.wav'`; `duration_ms` 0 and 60001; a mark `[0.5,0.2,'p']`; a mark kind `'x'`; 401 marks; text of 601 characters.
  - `test_stop_clears_act_and_speak`: after `act` and `speak`, `send('stop')` gives `act==''`, `speak is None`, `speaking is False`.

- [ ] **Step 2: Run** `.venv/bin/python -m unittest tests.test_control -v` — expected: FAIL (`Unknown operation`).

- [ ] **Step 3: Implement** both operations in `Controller.accept` and the new keys in `_reset` and `snapshot`, in the style of the existing `reaction` and `clip` branches.

- [ ] **Step 4: Run** `.venv/bin/python -m unittest tests.test_control -v` — expected: 4 tests OK. Then run both full suites — expected: pass (the embedded Mochi tests still pass).

- [ ] **Step 5: Update `EMBEDDING.md`**: add `act` and `speak` to the operations line, with the speak rules above in one sentence each.

- [ ] **Step 6: Commit** (once allowed): `git add jaeger_avatar/embedded/control.py tests/test_control.py dev/docs/runtime/EMBEDDING.md && git commit -m "feat: act and speak in avatar-control/v1"`

### Task 2: Packs declare their controls

**Files:**
- Modify: `jaeger_avatar/packs.py` (validate `presentation.controls`)
- Modify: `jaeger_avatar/catalog.py` (pass `controls` through on each representation entry)
- Create: `app/web/controls.js`
- Modify: `app/web/app.js` (agent actions, `/chat` actions and the Agent controls tab use `controlsOf`)
- Modify: `avatar-packs/jp01/avatar.yaml`, `avatar-packs/truth/avatar.yaml` (explicit controls, version bump)
- Test: `tests/test_runtime_catalog.py` (add), `tests/controls.test.mjs` (new)

**Interfaces:**
- Produces, Python: an optional `presentation.controls` mapping `{emotions?: [name], reactions?: [name], actions?: [name]}`. Names match the pack ID pattern `ID`, at most 64 per list, no duplicates. Anything else raises `PackError("controls lists names: emotions, reactions, actions")`. The catalog entry gains `controls` only when declared.
- Produces, JS: `controlsOf(rep, { led: boolean, moves: string[], poses: string[] }) -> { emotions: string[], reactions: string[], actions: string[] }`, exported from `app/web/controls.js`. The pack's declared lists win; each missing list falls back to today's behaviour: emotions are `Object.keys(EMOTIONS)`; reactions are `Object.keys(REACTIONS)` for LED bodies, else `[]`; actions are `poses` if the body has them, else `moves`.
- Consumes: `EMOTIONS` from `rig.js`, `REACTIONS` from `eyes.js`.

- [ ] **Step 1: Write the failing tests.**
  - Python `test_controls_are_validated`: a temporary copy of the `jp01` pack with `controls: {actions: ['wave','Bad Name']}` raises `PackError`; with `{actions: ['wave','nod']}` the catalog row's representation has `controls == {'actions': ['wave','nod']}`.
  - JS `tests/controls.test.mjs`, test `declared controls win and gaps fall back`:
    - `controlsOf({ controls: { actions: ['clap'] } }, { led: false, moves: ['wave'], poses: [] })` gives `actions == ['clap']`, `emotions.length == 16`, `reactions == []`;
    - `controlsOf({}, { led: true, moves: ['wave'], poses: [] }).reactions` includes `'wink'`;
    - `controlsOf({}, { led: false, moves: ['wave'], poses: ['kneel','clap'] }).actions` is `['kneel','clap']`.

- [ ] **Step 2: Run** both tests — expected: FAIL (no validation; module missing).

- [ ] **Step 3: Implement** the validation (called from `load_pack` beside `check_look`), the catalog pass-through, `controlsOf`, and the app changes. The `/chat` request's `actions` becomes `[...controls.reactions, ...controls.actions]`, and the Agent controls tab lists the same three lists.

- [ ] **Step 4: Declare controls** in the two packs. JP01: its 10 reactions and `actions: []` (its body has no moves of its own). Truth: `actions: [clap, lean, sway, stand, sit, kneel]`, `reactions: []`. Bump each pack's patch version. Re-run `node --test tests/screen-looks.test.mjs` to confirm no look changed.

- [ ] **Step 5: Run** both full suites — expected: pass. In the app, Truth's Agent controls tab lists exactly the six actions.

- [ ] **Step 6: Commit** (once allowed): `git commit -m "feat: packs declare the controls an agent may drive"`

### Task 3: The control link on the demo server

**Files:**
- Create: `jaeger_avatar/embedded/link.py`
- Modify: `app/server.py` (routes delegate to the link)
- Test: `tests/test_control_link.py` (new)
- Modify: `dev/docs/runtime/EMBEDDING.md` (a "Control link" section)

**Interfaces:**
- Produces: `ControlLink(token: str, clock=None)` with:
  - `attach(body: dict) -> dict`: called by the page with `{'avatar': str, 'capabilities': {...}}`. Replaces the Controller and returns `{'session': str}`.
  - `command(body: dict, token: str) -> dict`: `body` is `{'op', 'value', 'ttl_ms'?}`. Raises `ControlError('Not allowed')` on a wrong token and `ControlError('No avatar attached')` when nothing is attached or the page hasn't polled for 2 s. Otherwise returns `controller.send(...)`.
  - `state() -> dict`: the snapshot plus `'attached': True`. Records that the page polled.
  - `put_audio(wav: bytes, token: str) -> str`: keeps the last 16 clips (each ≤ 10 MB) and returns `'/control/audio/<12 hex>'`.
  - `audio(id: str) -> bytes | None`.
- Routes in `app/server.py`, loopback clients only: `POST /control/attach`, `POST /control`, `GET /control/state`, `POST /control/audio`, `GET /control/audio/<id>`.
  - The token comes from the `X-Avatar-Token` header (`POST /control`, `POST /control/audio`).
  - Errors return 403 or 422 with `{"error": message}`.
  - The token is `JAEGER_AVATAR_CONTROL_TOKEN` if set, else generated once and printed at startup as `Control token: <token>`.

- [ ] **Step 1: Write the failing tests** in `tests/test_control_link.py`:
  - `test_commands_need_the_token_and_a_page`: a command before attach raises `No avatar attached`; after `attach` and one `state()`, a wrong token raises `Not allowed`, and the right token with `{'op':'emotion','value':'joy'}` returns `emotion=='joy'`.
  - `test_page_gone_means_not_attached`: with the clock moved 2001 ms past the last `state()`, `command` raises `No avatar attached`.
  - `test_reattach_starts_a_new_session`: attach twice and the sessions differ; a command after the second attach validates against the second capabilities.
  - `test_audio_store_is_bounded`: 17 uploads keep the last 16, `audio()` of the first returns `None`, and 10 MB + 1 byte raises `ControlError`.

- [ ] **Step 2: Run** `.venv/bin/python -m unittest tests.test_control_link -v` — expected: FAIL (module missing).

- [ ] **Step 3: Implement** `ControlLink` and the routes. The routes are thin: parse JSON, call the link, reply.

- [ ] **Step 4: Run** the tests — expected: 4 OK. Restart the 8791 test server (tell Jonathan first), then check:
  - `curl -s -X POST localhost:8791/control -d '{"op":"emotion","value":"joy"}'` gives 403.
  - With the token and no page open, it gives 422 `No avatar attached`.

- [ ] **Step 5: Document** the link in `EMBEDDING.md`: the routes, the token and the 2-second attach rule.

- [ ] **Step 6: Commit** (once allowed): `git commit -m "feat: loopback control link for external agents"`

### Task 4: The page follows the link

**Files:**
- Create: `app/web/control-link.js`
- Modify: `app/web/app.js` (attach on character change; apply changes; log them in Inputs)
- Test: `tests/control-link.test.mjs` (new)

**Interfaces:**
- Consumes: Task 2's `controlsOf`; Task 3's routes.
- Produces: `changes(prev: State | null, next: State) -> Array<{ kind: 'feel'|'react'|'act'|'look'|'speak'|'stop', value }>`, a pure function, exported from `app/web/control-link.js`.
  - `feel` fires when `emotion` differs from `prev`.
  - `react`, `act` and `speak` fire when their `*_seq` increases.
  - `look` fires when `gaze` differs by more than 0.01.
  - `stop` fires when `seq` increased and everything is back at its reset values.
  - A changed `session` means `prev` is treated as `null`.
- Produces: `startControlLink({ capabilities: () => object, avatar: () => string, apply: (change) => void })`. It attaches, polls `/control/state` every 50 ms, and re-attaches when `avatar()` or `capabilities()` change.
- `apply` in `app.js` maps each change to the page's own calls:
  - `feel` → `rig.setEmotion`;
  - `react` / `act` → `act(name)`;
  - `look` → `rig.look(x, y)`;
  - `stop` → `stopAll`;
  - `speak`: fetch `value.clip`, then `readWav`, `voice.markLips(await work('analyze', …), value.marks)`. Enqueue it as a ready `say` op with `text`, so it preempts what's playing.
  - Each change is logged with `logInput('external ' + kind, …)`.

- [ ] **Step 1: Write the failing tests** in `tests/control-link.test.mjs`:
  - `first state only reports what is set`: `changes(null, {session:'s', seq:1, emotion:'joy', act_seq:0, …})` gives `[{kind:'feel', value:'joy'}]`.
  - `seq increases fire once`: going from `act_seq` 1 to 2 with `act:'wave'` gives one `act` change, and the same state twice gives none.
  - `a new session starts clean`: same seq numbers under a new `session` fire again.
  - `speak carries its value`: a `speak_seq` increase gives `{kind:'speak', value:{clip, duration_ms, marks, text}}`.

- [ ] **Step 2: Run** `node --test tests/control-link.test.mjs` — expected: FAIL (module missing).

- [ ] **Step 3: Implement** `changes`, `startControlLink` and the `apply` wiring in `app.js`. A failed clip fetch logs `external speak failed: <reason>` and plays nothing.

- [ ] **Step 4: Run** the full suites — expected: pass. In headless, muted Chrome on JP01, check:
  - with the token, `{"op":"emotion","value":"joy"}` shows joy and `external feel joy` in Inputs;
  - `{"op":"act","value":"clap"}` returns 422 `Unknown action`;
  - switching to Truth, then `{"op":"act","value":"clap"}`, makes Truth clap;
  - two `speak` commands 200 ms apart leave only the second playing.

- [ ] **Step 5: Commit** (once allowed): `git commit -m "feat: the stage follows external commands"`

### Task 5: An external agent and TTS, as a client

**Files:**
- Create: `scripts/avatar_control.py`
- Test: `tests/test_avatar_control_cli.py` (new; argument parsing and request building only, no network)

**Interfaces:**
- Consumes: Task 3's routes.
- Produces: the CLI `python scripts/avatar_control.py [--url http://127.0.0.1:8791] [--token T] <command>`. The token defaults to `$JAEGER_AVATAR_CONTROL_TOKEN`. Commands:
  - `feel <emotion>`, `react <name>`, `act <name>`, `look <x> <y>`, `stop`;
  - `say "<text>" [--voice kokoro:af_heart]`. This plays the external TTS: it gets audio and lip marks from the demo's voice service (`POST /say`, header `X-Lips`), uploads the WAV with `POST /control/audio`, then sends `speak` with the returned clip, the WAV's duration, the marks and the text.
- `build_request(args) -> (path, body, headers)`, exported for the test.

- [ ] **Step 1: Write the failing tests**:
  - `feel joy` builds `('/control', {'op':'emotion','value':'joy'}, {'X-Avatar-Token': 'T'})`;
  - `look 0.5 -0.2` builds value `[0.5, -0.2]`;
  - `look 2 0` exits with an error naming the range `[-1, 1]`;
  - a missing token exits with an error naming `JAEGER_AVATAR_CONTROL_TOKEN`.

- [ ] **Step 2: Run** `.venv/bin/python -m unittest tests.test_avatar_control_cli -v` — expected: FAIL.

- [ ] **Step 3: Implement** with `argparse`, `urllib.request` and `wave`. For `say`, the duration is `frames / rate * 1000`, rounded.

- [ ] **Step 4: Run** the tests — expected: OK. With the app open on JP01 (headless, muted), `say "Mom bought a big puppy"` makes the mouth press shut on m/b/p. Inputs shows `external speak`, then `speech audio … 6 lip closures`.

- [ ] **Step 5: Commit** (once allowed): `git commit -m "feat: example external agent client"`

### Task 6: Say where the framework ends

**Files:**
- Modify: `dev/docs/vision/ARCHITECTURE.md`, `dev/docs/vision/PRODUCT_SCOPE.md`, `dev/docs/packs/ROBOT_DEPLOYMENT.md`, `dev/docs/vision/RUNTIME_MIGRATION_PROPOSAL.md`, `dev/docs/reality/STATUS.md`

- [ ] **Step 1: Correct the statements** the design overturned:
  - `ARCHITECTURE.md`'s "JaegerAnimation remains useful for raster/display playback" becomes the bridge-until-evaluation wording.
  - `PRODUCT_SCOPE.md` no longer has Avatar owning a character editor or embedding JaegerAgent; editors belong to Aether Animation, and the agent is external.
  - The migration proposal's decision 2 is marked settled (the engine runs on the robot and streams frames).
  - `STATUS.md` lists the control link and hardware streams as built.
- [ ] **Step 2: Name the boundary in code terms** in `ARCHITECTURE.md`:
  - the framework is `jaeger_avatar/` plus the renderers in `app/web/`;
  - the demo harness is `app/server.py`, `app/voice_engine.py` and `app/agent_bridge.py`;
  - nothing in `jaeger_avatar/` imports the harness.
- [ ] **Step 3: Check the boundary**: `grep -rn "voice_engine\|agent_bridge\|kokoro" jaeger_avatar/` — expected: no matches.
- [ ] **Step 4: Commit** (once allowed): `git commit -m "docs: the avatar framework ends at commands in, animation out"`
