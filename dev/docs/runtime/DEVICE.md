# Connecting a device to the agent

A device is a body with a speaker and a microphone: the virtual Mochi on a Mac,
JP01 with its panel, rings and head, and this app's own page. Three parts meet
in it, each from its own repository:

- **Jaeger Agent** is the mind, with its own model, voice (Kokoro), hearing
  (Whisper), tools and turn-taking. Its package `jaeger_agent.body` is what a
  device imports.
- **The animation module** (`jaeger-module-animation`) is the body's engine:
  the face controller, the face page or panel frames, and the player that
  moves the mouth with her voice. The agent opens it through the JaegerOS
  `animation` slot; a device does not import it to connect.
- **A bundle** from Jaeger Avatar is one character's body as data: who it is,
  what it offers, its face. Mochi and other apps ship one bundle. This app is
  where many characters are tried: its page is the body, and it holds the
  whole library of packs.

The device holds no agent, voice, hearing or face code.

## What a device provides

| Part | What the device gives or takes | Where |
| --- | --- | --- |
| The bundle | A folder it pins and checks (`avatar.lock.json`, `SHA256SUMS.json`). `manifest.json` says who the character is (`character.who`, `character.voice`), what the body offers (`capabilities`: emotions, reactions, actions), which feeling to show while thinking and listening (`activity`), and which face to draw (`face`). | Jaeger Avatar builds it (`scripts/build_embedded_mochi.py`, `scripts/build_panel_runtime.py`) |
| A Python with the agent | Python 3.11 or 3.12 with Jaeger Agent, the Kokoro and Whisper modules and the animation module (this repo's `.agent-venv`, from `requirements-agent.txt`). The agent picks its own model. | `jaeger_agent.body.AgentHost()` starts the agent's worker in it |
| A speaker | `play(samples, rate)` that returns at once, and `stop()`. Mono floats, the rate given with each clip (24000 Hz from Kokoro). | `jaeger_animation.avatar.Speaker` is this computer's |
| A microphone | 16 kHz mono floats, any frame length, handed to `device.hear(frame)`. | |
| A face | The bundle's page in a window (`device.body.serve()` gives its address), or frames for a panel: `device.body.panel().frames()` yields `(width, height, number, rgb bytes)` for each output on every tick. | the animation module |
| A head, if it has one | `device.body.controller.snapshot()['gaze']`: `[x, y]`, each -1 to 1, right and up positive. The device turns it into its own joint angles. | the animation module |

## Connecting

```python
from jaeger_agent.body import AgentHost, Device

device = Device(AgentHost(log=..., cwd=...), bundle, checksum=..., speaker=speaker)
device.start()                                         # the agent loads; device.ready says when (about 20 to 40 s)
url = device.body.serve()                              # her face as a page, or device.body.panel() for a robot's panel

device.text('Hello')                                   # typed words
device.hear(frame)                                     # microphone sound, as it arrives
device.scene('say Hi! | emotion listening | listen')   # a scene; with listen, a scene for two
device.stop()                                          # Stop
device.close()
```

`device.body` is `None` when nothing fills the animation slot in that Python:
the agent is then a voice with no face.

That is the whole connection. `Device` does the rest:

- starts the agent as this character in this body, with the body's own list
  of feelings and moves, and gives the agent's `avatar` and `scene` tools
  this controller to move;
- plays each line the agent sends on the speaker, opens the mouth with how
  loud the voice is (20 ms steps, closed on m, b, p), and tells the agent
  when each scene move's moment has come on the clip's own clock;
- hands every microphone frame to the agent, and tells it when the speaker
  has finished each part she voiced (`voiced` from the agent, `played`
  back);
- shows the pack's own feeling for "thinking" and for "hearing someone".

Turn-taking is Jaeger Agent's own, with its own settings; `Device` sets none
of it. The agent decides when a phrase has ended, waits for the rest when the
words do not read as a finished thought (HOLDING), and, because a bare
speaker and microphone have no echo canceller, runs its half duplex: its
microphone is shut from her first word until the device says the speaker has
played her last. `open_mic=True` is for a device that has an echo canceller:
the agent then keeps hearing, and a person can talk over her.

One knob only the real hardware can set: `delay_s`, how long the speaker
takes to sound what it is handed. Mouth and moves wait that long, and so does
the word to the agent that she has been played.

A person who pauses in the middle of a sentence is not answered in halves:
until her first sound the agent goes on listening, and what they say next is
heard as one with what they had said (Jaeger Agent, November 22, 2026;
STATUS.md has the measurements). That is why the device hands the agent
every frame, and never ends a phrase for it.

## The two devices

**Mochi, virtual** (`~/GITHUB/Mochi/mochi_live.py`): the bundle's page in a
browser tab, this Mac's speaker and microphone.

**JP01** (`scripts/jp01_sim.py` here is its stand-in):

| JP01 has | It is handed | Simulated by | On the robot |
| --- | --- | --- | --- |
| Face panel | 64 x 64 RGB, 8 bits a colour, rows top to bottom, 30 frames a second | `SimDisplay('face')` | the AVC01 matrix driver (stream mode 11) |
| LED ring | 24 x 1 RGB, 30 a second, LED 0 first | `SimDisplay('ring')` | the AVC01 ring driver |
| Speaker | one clip at a time, mono floats with their rate | `SimSpeaker` | the robot's audio out |
| Microphone | gives 16 kHz mono to `device.hear` | `--mic-file`, or none | the robot's audio in |
| Head | gaze -1..1 as pan and tilt degrees | `SimHead` (45 and 25 degrees either side) | joints j1 (pan), j2 (tilt), within the robot's own limits |

Moving from the stand-in to the robot is giving `Device` the real speaker
and microphone and handing the same frames and gaze to the real drivers.
Not decided here, because only the robot can say: the panel's and the
ring's orientation as mounted (which corner is row 0, which LED is 0 and
which way round), brightness, the speaker's delay, the head's limits and
speed, and how the second ring differs from the first (the bundle draws one
ring; both rings get the same frame until the pack says otherwise).
