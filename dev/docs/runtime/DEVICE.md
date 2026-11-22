# Connecting a device to the agent

A device is a body with a speaker and a microphone: the virtual Mochi on a Mac,
JP01 with its panel, rings and head. Jaeger Agent is the mind; Jaeger Avatar's
bundle is the face and the connection. The device holds no agent, voice or
hearing code. Everything below is in the bundle (`avatar_runtime/`, built from
`jaeger_avatar/embedded/`), the same files for every device.

## What a device provides

| Part | What the device gives or takes | In the bundle |
| --- | --- | --- |
| The bundle | A folder it pins and checks (`avatar.lock.json`, `SHA256SUMS.json`). `manifest.json` says who the character is (`character.who`, `character.voice`), what the body offers (`capabilities`: emotions, reactions, actions), which feeling shows while the agent thinks or hears (`activity`) and, for a panel, its `outputs`. | `manifest.json` |
| A Python for the agent | One that has Jaeger Agent with the Kokoro and Whisper modules. It need not be the device's own Python. The agent picks its own model. | `agent_host.AgentHost(python, log, cwd)` |
| A speaker | `play(samples, rate)` that returns at once, and `stop()`. Mono floats, the rate given with each clip (24000 Hz from Kokoro). | `device.Speaker` is this computer's |
| A microphone | 16 kHz mono floats, any frame length, handed to `device.hear(frame)`. | |
| A face | Either the bundle's page in a window (`RuntimeServer(public, controller).start()` gives its address), or frames for a panel: `Panel(controller).frames()` yields `(width, height, number, rgb bytes)` for each output on every tick, 30 a second. | `server.py`, `panel.py` |
| A head, if it has one | `controller.snapshot()['gaze']`: `[x, y]`, each -1 to 1, right and up positive. The device turns it into its own joint angles. | `control.py` |

## Connecting

```python
from avatar_runtime import Controller, RuntimeServer
from avatar_runtime.agent_host import AgentHost
from avatar_runtime.device import Device, Speaker

controller = Controller(manifest)                      # the body's state: every face is drawn from it
device = Device(controller, AgentHost(python, log=..., cwd=...), speaker=Speaker())
device.start()                                         # the agent loads; device.ready says when (about 20 to 40 s)

device.text('Hello')                                   # typed words
device.hear(frame)                                     # microphone sound, as it arrives
device.scene('say Hi! | emotion listening | listen')   # a scene; with listen, a scene for two
device.stop()                                          # Stop
device.close()
```

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
