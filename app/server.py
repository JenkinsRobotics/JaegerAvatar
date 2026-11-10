#!/usr/bin/env python3
"""Local-only demo server: static files, Piper neural voices, Whisper ears, and a Gemma (LM Studio) or Claude brain."""
import io
import json
import os
import threading
import urllib.request
import wave
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote
from jaeger_avatar.catalog import catalog, persona, ROOT as PACKS
from jaeger_avatar.packs import local_path, PackError
from jaeger_avatar.embedded.control import ControlError
from jaeger_avatar.embedded.link import ControlLink
from kin_lipsync import analyze as analyze_kin

from agent_bridge import agent_host
import lyra_singer
import singing
from voice_engine import SAMPLE_LIMIT, engine, to_wav

ROOT = Path(__file__).parent
CACHE = ROOT / ".cache"
PORT = int(os.environ.get('JAEGER_AVATAR_PORT', '8790'))

for line in (ROOT / ".env").read_text().splitlines() if (ROOT / ".env").exists() else []:
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        if value.strip():
            os.environ.setdefault(key.strip(), value.strip())

VOICE = os.environ.get("NORI_VOICE", "en_US-kristin-medium")  # any Piper voice at 22050 Hz
VOICES = {VOICE, "en_US-kristin-medium", "en_US-joe-medium", "en_US-bryce-medium", "en_US-norman-medium"}
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
HAS_CLAUDE = bool(os.environ.get("ANTHROPIC_API_KEY"))
LMSTUDIO = os.environ.get("LMSTUDIO_URL", "http://localhost:1234")
GEMMA = os.environ.get("GEMMA_MODEL", "google/gemma-4-e4b")
USE_GEMMA = os.environ.get("NORI_BRAIN", "gemma") == "gemma"
STT = os.environ.get("NORI_STT", "base.en")  # any faster-whisper model name
HEAR_LIMIT = 16000 * 2 * 30  # 30 s of 16 kHz 16-bit audio; the page sends at most 20 s
FRAME_LIMIT = 64 * 1024
MODEL_LIMIT = 200 * 1024 * 1024
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
# An agent outside the avatar drives the body on stage through this link (dev/docs/runtime/EMBEDDING.md).
CONTROL_TOKEN = os.environ.get("JAEGER_AVATAR_CONTROL_TOKEN") or __import__("secrets").token_urlsafe(18)
control_link = ControlLink(CONTROL_TOKEN)
# The page can only talk to this machine, whatever a future bug or a loaded file tries.
CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: data:; worker-src 'self' blob:"

PERFORM = """You are talking out loud with a person. Your face is animated live from your words.
Latency-sensitive; begin your visible answer immediately.
Reply in 1 to 3 short spoken sentences with no lists, markdown or emoji. Be genuinely helpful and answer what was asked.
Perform with inline tags, placed right before the words they apply to. Act big, like an anime character: use at least two different emotions in every reply, and a sound or gesture where it fits.
Emotions: [neutral] [joy] [excited] [love] [sad] [angry] [surprised] [scared] [thinking] [confused] [shy] [smug] [sleepy]
Sounds, used as stand-alone beats: [laugh] [giggle] [sigh] [gasp] [hmm] [wow] [aww] [yay] [ooh]
Gestures: [nod] [shake] [tilt] [wink] [shrug] [bounce] [wave]
Singing: [sing] your own original lyrics [/sing]. Never sing existing song lyrics.
Example: [surprised] Oh! You made that yourself? [joy] That is lovely. [giggle] [tilt] How long did it take?
Song example: [joy] Sure! [sing] Little lights are glowing, soft and low, humming songs that only we know. [/sing] [wink]"""

PERSONAS = {
    "mochi": "You are Mochi, a tiny desk robot with a pixel face. Curious and sweet.",
    "visor": "You are Vee, a sleek hovering helper robot with glowing eyes. Calm, kind and a little dreamy.",
    "nori": "You are Nori, a warm, playful anime girl with a robot's heart.",
    "ace": "You are Ace, a laid-back gamer in sunglasses and a headset. Dry wit, confident, secretly kind.",
    "sol": "You are Sol, a gentle young streamer and music producer in a neon-lit studio. Thoughtful and encouraging.",
    "vita": "You are Vita, a cool, energetic anime girl with cyber cat ears who dreams of singing on big stages. Caring underneath.",
    "pip": "You are Pip, a cheerful little astronaut robot who loves meeting people and waving hello.",
    "bo": "You are Bo, a small, shy box-headed robot who is delighted by tiny things like cactuses.",
    "rook": "You are Rook, a battered humanoid robot who is new to the world. Earnest, childlike and brave, and you learn fast.",
    "maya": "You are Maya, a friendly, quick-witted human woman. Warm, natural and expressive.",
}


EXTRA_TAGS = {
    "vita": "Full-body moves, used now and then for fun: [spin] [dance] [hop] [celebrate] [clap] [bow] [heart] [point]\n",
    "mochi": "You act with your eyes. Eye reactions: [wink] [blink] [sideeye] [sparkle] [heart] [roll] [peek] [doze] [groove] [wake]\n",
    "visor": "You act with your eyes. Eye reactions: [wink] [blink] [sideeye] [sparkle] [heart] [roll] [peek] [doze] [groove] [wake]\n",
}


def system_for(character):
    persona = PERSONAS.get(character, PERSONAS["nori"])
    name = {"visor": "Vee"}.get(character, str(character).capitalize()) if character in PERSONAS else "Nori"
    # Small models answer "who are you" with their own model card unless told not to. Still honest: an AI character, with a name.
    return f"{persona} Your name is {name}. If asked who you are, answer as this AI character by name, and never call yourself Gemma or mention Google.\n{EXTRA_TAGS.get(character, '')}{PERFORM}"


voices = {}
voice_lock = threading.Lock()


def load_voice(name=VOICE):
    """Load once and keep in memory: the model load is what costs a second, not the speech."""
    with voice_lock:
        if name in voices:
            return voices[name]
        try:
            from piper import PiperVoice
            from piper.download_voices import download_voice
            folder = CACHE / "voices"
            if not (folder / f"{name}.onnx").exists():
                print(f"Downloading voice {name} (about 63 MB, first run only)...")
                folder.mkdir(parents=True, exist_ok=True)
                download_voice(name, folder)
            voice = PiperVoice.load(folder / f"{name}.onnx")
            if voice.config.sample_rate != 22050:
                raise ValueError(f"{name} is {voice.config.sample_rate} Hz; the face expects 22050 Hz (use a medium or high voice)")
            list(voice.synthesize("Hello."))  # the first inference is the slow one, so spend it before anyone is waiting
        except Exception as e:  # no network or a bad voice name: the browser falls back to its built-in voice
            print(f"Voice {name} unavailable, using the built-in synth:", e)
            voice = None
        voices[name] = voice
        return voice


def speak(text, rate, name=VOICE):
    """Returns WAV bytes, or None if the text has nothing speakable in it."""
    from piper import SynthesisConfig
    if not any(c.isalnum() for c in text):  # Piper reads a lone "!" as noise
        return None
    # [[ ]] would be Piper's raw phoneme syntax. Concurrent lines are safe: Piper locks its own phonemizer.
    pcm = b"".join(c.audio_int16_bytes for c in load_voice(name).synthesize(text.replace("[[", " "), SynthesisConfig(length_scale=190 / rate)))
    if not pcm:
        return None
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(22050)
        w.writeframes(pcm)
    return out.getvalue()


stt = None
stt_lock = threading.Lock()


def load_stt():
    """Whisper on the CPU: about 200 ms for a short sentence on an M1 Max. Returns None if it can't load."""
    global stt
    with stt_lock:
        if stt is None:
            try:
                from faster_whisper import WhisperModel
                print(f"Loading speech model {STT} (the first run downloads about 140 MB)...")
                stt = WhisperModel(STT, device="cpu", compute_type="int8", cpu_threads=6, download_root=str(CACHE / "stt"))
                hear(b"\0\0" * 16000)  # the first inference is the slow one, so spend it before anyone is waiting
            except Exception as e:  # no network or a bad model name: the mic button says so, typing still works
                print(f"Speech model {STT} unavailable:", e)
                stt = False
        return stt


def hear(pcm, name=""):
    """16 kHz mono 16-bit PCM in, text out. Empty text means no speech was found."""
    import numpy as np
    audio = np.frombuffer(pcm[:len(pcm) & ~1], dtype=np.int16).astype(np.float32) / 32768
    # The VAD filter stops Whisper inventing "Thank you." from noise. The prompt is how it learns her name is Vita, not Vida.
    segments, _ = stt.transcribe(audio, beam_size=1, vad_filter=True, condition_on_previous_text=False, without_timestamps=True,
                                 initial_prompt=f"A chat with {name}." if name else None)
    return " ".join(s.text.strip() for s in segments if s.no_speech_prob < 0.6).strip()


def gemma_ready():
    if not USE_GEMMA:
        return False
    try:
        with urllib.request.urlopen(f"{LMSTUDIO}/v1/models", timeout=0.4) as r:
            return any(m["id"] == GEMMA for m in json.load(r)["data"])
    except (OSError, ValueError, KeyError):
        return False


def brain():
    if os.environ.get('NORI_BRAIN')=='scripted':return 'scripted'
    return 'JaegerAgent · '+GEMMA if agent_host.ready and gemma_ready() else 'scripted'


def gemma_stream(messages, system, max_tokens=220):
    # ponytail: raw Gemma prompt, because LM Studio's chat endpoint has no working way to turn thinking off here
    # (it costs about 2.5 s per reply, or leaks the plan into the answer). Starting the reply on "[" skips the planning.
    clean = lambda t: t.replace("<|", "").replace("|>", "")  # user text can't forge a turn boundary
    turns = "".join(f"<|turn>{'user' if m['role'] == 'user' else 'model'}\n{clean(m['content'])}<turn|>\n" for m in messages)
    prompt = f"<bos><|turn>system\n{system}<turn|>\n{turns}<|turn>model\n["
    body = {"model": GEMMA, "prompt": prompt, "stream": True, "max_tokens": max_tokens, "temperature": 0.8, "ttl": 3600, "stop": ["<turn|>", "<|turn>"]}
    req = urllib.request.Request(f"{LMSTUDIO}/v1/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    yield "["
    with urllib.request.urlopen(req, timeout=120) as r:
        for line in r:
            line = line.decode().strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                text = json.loads(line[6:])["choices"][0].get("text")
                if text:
                    yield text


def claude_stream(messages, system):
    import anthropic
    client = anthropic.Anthropic()
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=16000,
        system=system,
        messages=messages,
        output_config={"effort": "low"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    ) as stream:
        for text in stream.text_stream:
            yield text
        if stream.get_final_message().stop_reason == "refusal":
            yield " [confused] Hmm, I can't help with that one."


class Relay:
    """The latest performance frame, for output windows in any browser on this machine. Held in memory only."""

    def __init__(self):
        self.cond = threading.Condition()
        self.frame = None
        self.rev = 0
        self.viewers = 0
        self.model = None
        self.model_rev = 0

    def publish(self, raw):
        frame = json.loads(raw)
        if not isinstance(frame, dict) or not isinstance(frame.get("out"), dict):
            raise ValueError("not a frame")
        text = json.dumps(frame, allow_nan=False, separators=(",", ":"))  # one line, so it can't break out of its SSE message
        with self.cond:
            self.frame = text
            self.rev += 1
            self.cond.notify_all()

    def events(self):
        """Yields each new frame, and a comment every 2 s when there is none, which is how a closed window gets noticed."""
        cursor = self.rev
        with self.cond:
            self.viewers += 1
        try:
            while True:
                with self.cond:
                    self.cond.wait_for(lambda: self.rev != cursor, timeout=2)
                    fresh, cursor = self.rev != cursor, self.rev
                    frame = self.frame
                yield f"data: {frame}\n\n".encode() if fresh else b": alive\n\n"
        finally:
            with self.cond:
                self.viewers -= 1


relay = Relay()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web"), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        # Models and libraries barely change and are large; the page and its code are always fresh.
        heavy = self.path.startswith(("/models/", "/vendor/", "/plugins/webcam/wasm/", "/plugins/webcam/face_landmarker"))
        self.send_header("Cache-Control", "max-age=86400" if heavy else "no-store")
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def reply(self, code, body, ctype="application/json", headers=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def control(self, route, body=None):
        """The control link's routes. Loopback only; commands and uploads carry the token in X-Avatar-Token."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        if self.client_address[0] not in LOCAL_HOSTS or host not in LOCAL_HOSTS:   # also stops DNS rebinding
            return self.reply(403, b'{"error":"not local"}')
        token = self.headers.get("X-Avatar-Token", "")
        try:
            if route == "/control/state":
                session = parse_qs(urlparse(self.path).query).get("session", [None])[0]
                return self.reply(200, json.dumps(control_link.state(session)).encode())
            if route.startswith("/control/audio/") and body is None:
                wav = control_link.audio(route[len("/control/audio/"):])
                return self.reply(200, wav, "audio/wav") if wav else self.reply(404, b'{"error":"Unknown clip"}')
            if route == "/control/audio":
                return self.reply(200, json.dumps({"clip": control_link.put_audio(body, token)}).encode())
            if self.headers.get_content_type() != "application/json":   # needs a CORS preflight, which this server never grants
                return self.reply(415, b'{"error":"Send JSON"}')
            data = json.loads(body or b"null")
            if route == "/control/attach":
                return self.reply(200, json.dumps(control_link.attach(data)).encode())
            if route == "/control":
                return self.reply(200, json.dumps(control_link.command(data, token)).encode())
        except ControlError as e:
            return self.reply(403 if str(e) == "Not allowed" else 422, json.dumps({"error": str(e)}).encode())
        except ValueError:
            return self.reply(400, b'{"error":"Bad JSON"}')
        return self.reply(404, b'{"error":"Unknown control route"}')

    def say_natural(self, voice, text, emotion, speed, turn):
        if not engine.ready_for(voice):         # the page uses the character's own voice until this one has loaded
            return self.reply(503, b'{"error":"voice not ready"}')
        try:
            marks = []      # when the lips close on m/b/p or tuck for f/v, from the voice's own phoneme timing
            x = engine.speak(voice, text.replace("[[", " "), emotion if isinstance(emotion, str) else None, float(speed), turn, marks)
        except (ValueError, RuntimeError) as e:
            return self.reply(422, json.dumps({"error": str(e)}).encode())
        return self.reply(409, b'{"error":"interrupted"}') if x is None else self.reply(200, to_wav(x, engine.sr), "audio/wav", {"X-Lips": json.dumps(marks)})

    def sing(self, body):
        """The words spoken in this voice, moved onto the tune the page chose."""
        text, voice, notes = str(body.get("text", ""))[:600].strip(), str(body.get("voice", "")), body.get("notes")
        if not text or not isinstance(notes, list) or not 0 < len(notes) <= 300:
            return self.reply(400, b'{"error":"bad song"}')
        try:
            notes = [{"t": float(n["t"]), "f": float(n["f"]), "dur": float(n["dur"])} for n in notes]
        except (TypeError, KeyError, ValueError):
            return self.reply(400, b'{"error":"bad notes"}')
        if voice.partition(":")[0] in ("kokoro", "clone"):
            if not engine.ready_for(voice):
                return self.reply(503, b'{"error":"voice not ready"}')
            try:
                x = engine.speak(voice, text, None, 0.92, int(body.get("turn", engine.current_turn)))  # a little slower gives each syllable room to hold a note
            except (ValueError, RuntimeError) as e:
                return self.reply(422, json.dumps({"error": str(e)}).encode())
            if x is None:
                return self.reply(409, b'{"error":"interrupted"}')
            sr = engine.sr
        else:
            import numpy as np
            name = voice if voice in VOICES else VOICE
            if not load_voice(name):
                return self.reply(503, b'{"error":"no voice"}')
            wav_bytes = speak(text, 170, name)
            if not wav_bytes:
                return self.reply(422, b'{"error":"nothing to sing"}')
            with wave.open(io.BytesIO(wav_bytes)) as w:
                x, sr = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768, w.getframerate()
        song, shift, onsets = singing.sing(x, sr, notes)
        data = to_wav(song, sr)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Song", json.dumps({"shift": shift, "onsets": [round(t, 3) for t in onsets]}))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        route=urlparse(self.path).path
        if route.startswith('/control/'):
            return self.control(route)
        if route == '/api/avatars':
            return self.reply(200,json.dumps(catalog()).encode())
        if route.startswith('/packs/'):
            try:
                path=local_path(PACKS,unquote(route[len('/packs/'):]))
                if not path.is_file():raise ValueError('Not a file')
                return self.reply(200,path.read_bytes(),self.guess_type(str(path)))
            except (OSError,ValueError,PackError):
                return self.reply(404,b'{"error":"Unknown pack asset"}')

        if self.path == "/health":
            return self.reply(200, json.dumps({"brain": brain(), "voice": VOICE if voices.get(VOICE) else None, "ears": bool(stt) or stt is None, "natural": engine.status}).encode())
        if self.path.startswith("/singer/"):     # the experimental singer: progress, then the finished song
            key = parse_qs(urlparse(self.path).query).get("id", [""])[0]
            try:
                if self.path.startswith("/singer/status"):
                    return self.reply(200, json.dumps(lyra_singer.status(key)).encode())
                if self.path.startswith("/singer/audio"):
                    return self.reply(200, lyra_singer.audio(key), "audio/wav")
            except (ValueError, OSError) as e:
                return self.reply(404, json.dumps({"error": str(e)}).encode())
        if self.path == "/voice/list":
            return self.reply(200, json.dumps({"natural": engine.status, "kokoro": engine.backend, "clone": engine.clone_status, "singer": lyra_singer.available(), "voices": engine.list(), "fast": sorted(VOICES)}).encode())
        if self.path == "/relay/status":
            return self.reply(200, json.dumps({"viewers": relay.viewers}).encode())
        if self.path.startswith("/relay/model"):
            return self.reply(200, relay.model, "model/gltf-binary") if relay.model else self.reply(404, b"{}")
        if self.path == "/relay/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            try:
                for chunk in relay.events():
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except OSError:  # the window closed
                pass
            return
        super().do_GET()

    def do_POST(self):
        try:size = int(self.headers.get("Content-Length", 0))
        except ValueError:return self.reply(400,b'{"error":"Invalid content length"}')
        if size < 0:
            self.close_connection=True
            return self.reply(400,b'{"error":"Invalid content length"}')
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).hostname not in LOCAL_HOSTS:  # a website in another tab can't reach the brain, mic or output windows
            self.close_connection = True
            return self.reply(403, b'{"error":"not local"}')
        if urlparse(self.path).path.startswith('/control'):
            if size > 10 * 1024 * 1024:
                self.close_connection = True
                return self.reply(413, b'{"error":"A clip is at most 10 MB"}')
            return self.control(urlparse(self.path).path, self.rfile.read(size))
        if urlparse(self.path).path == '/lip-sync':
            try:
                sr=int(parse_qs(urlparse(self.path).query).get('sample_rate_hz',['24000'])[0])
                if not 8000 <= sr <= 96000 or not 0 < size <= sr*2*60 or size%2:
                    self.close_connection=True
                    return self.reply(400,b'{"error":"Expected up to 60 seconds of mono PCM16"}')
                import numpy as np
                samples=np.frombuffer(self.rfile.read(size),dtype='<i2').astype(np.float32)/32768
                return self.reply(200,json.dumps({'frames':analyze_kin(samples,sr)}).encode())
            except (ValueError,TypeError):
                return self.reply(400,b'{"error":"Invalid audio"}')
        if self.path.startswith("/voice/clone"):
            query = parse_qs(urlparse(self.path).query)
            if size > SAMPLE_LIMIT:
                self.close_connection = True
                return self.reply(413, b'{"error":"That sample is too long. Use under a minute."}')
            data = self.rfile.read(size)
            try:
                vid = engine.add_clone(query.get("name", [""])[0], data, query.get("consent", [""])[0] == "1")
            except PermissionError:
                return self.reply(403, b'{"error":"Confirm this is your voice, or that you have permission, first."}')
            except (ValueError, EOFError, wave.Error) as e:
                return self.reply(400, json.dumps({"error": str(e)}).encode())
            return self.reply(200, json.dumps({"id": vid}).encode())
        if self.path == "/relay/frame":
            if size > FRAME_LIMIT:
                self.close_connection = True
                return self.reply(413, b'{"error":"too big"}')
            try:
                relay.publish(self.rfile.read(size))
            except ValueError:
                return self.reply(400, b'{"error":"bad frame"}')
            return self.reply(200, b"{}")
        if self.path == "/relay/model":
            if size > MODEL_LIMIT:
                self.close_connection = True
                return self.reply(413, b'{"error":"too big"}')
            data = self.rfile.read(size)
            if not data.startswith((b"glTF", b"{")):
                return self.reply(400, b'{"error":"not a model"}')
            relay.model = data
            relay.model_rev += 1
            return self.reply(200, json.dumps({"rev": relay.model_rev}).encode())
        if self.path.startswith("/hear"):
            if size > HEAR_LIMIT:
                self.close_connection = True  # the body was never read, so this connection can't be reused
                return self.reply(413, b'{"error":"too long"}')
            pcm = self.rfile.read(size)
            if not load_stt():
                return self.reply(503, b'{"error":"no speech model"}')
            name = parse_qs(urlparse(self.path).query).get("name", [""])[0][:40]
            with stt_lock:  # one transcription at a time: there is one microphone
                text = hear(pcm, name)
            return self.reply(200, json.dumps({"text": text}).encode())
        if size > 1024*1024:
            self.close_connection=True
            return self.reply(413,b'{"error":"Request too large"}')
        try:
            body=json.loads(self.rfile.read(size) or b'{}')
            if not isinstance(body,dict):raise ValueError('Expected object')
        except (ValueError,TypeError):return self.reply(400,b'{"error":"Expected JSON object"}')
        if self.path == "/voice/delete":
            try:
                engine.delete_clone(str(body.get("id", "")))
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}).encode())
            return self.reply(200, b"{}")
        if self.path == "/voice/warm":
            engine.warm()
            return self.reply(200, b"{}")
        if self.path == "/say/cancel":
            engine.cancel(int(body.get("turn", 0)))
            return self.reply(200, b"{}")
        if self.path == "/sing":
            return self.sing(body)
        if self.path == "/singer/start":
            kind, _, name = str(body.get("voice", "")).partition(":")
            try:
                return self.reply(200, json.dumps(lyra_singer.start(lyra_singer.request_of(body, name if kind == "kokoro" else ""))).encode())
            except ValueError as e:
                return self.reply(422, json.dumps({"error": str(e)}).encode())
        if self.path == "/singer/stop":
            lyra_singer.stop(str(body.get("id", "")))
            return self.reply(200, b'{"ok":true}')
        if self.path == "/song":
            text, voice = str(body.get("text", ""))[:300].strip(), str(body.get("voice", ""))
            if not text:
                return self.reply(400, b'{"error":"empty"}')
            if not engine.ready_for(voice):
                return self.reply(503, b'{"error":"voice not ready"}')
            try:
                made = engine.song(voice, text, int(body.get("turn", engine.current_turn)), body.get("style") == "sung")
            except (ValueError, RuntimeError) as e:
                return self.reply(422, json.dumps({"error": str(e)}).encode())
            if made is None:
                return self.reply(409, b'{"error":"interrupted"}')
            mix, vox, beats = made
            # Two channels: the song as heard, and her voice alone, so her mouth follows the singing and not the music box.
            import numpy as np
            both = np.stack([mix, vox], axis=1).reshape(-1)
            pcm = (np.clip(both, -1, 1) * 32767).astype(np.int16).tobytes()
            out = io.BytesIO()
            with wave.open(out, "wb") as w:
                w.setnchannels(2); w.setsampwidth(2); w.setframerate(engine.sr); w.writeframes(pcm)
            return self.reply(200, out.getvalue(), "audio/wav", {"X-Song": json.dumps({"bpm": 92, "beats": beats})})
        if self.path == "/say":
            text = str(body.get("text", ""))[:1000].strip()
            if not text:
                return self.reply(400, b'{"error":"empty"}')
            if str(body.get("voice", "")).partition(":")[0] in ("kokoro", "clone"):
                return self.say_natural(str(body["voice"]), text, body.get("emotion"), body.get("speed", 1), int(body.get("turn", engine.current_turn)))
            name = body.get("voice") if body.get("voice") in VOICES else VOICE
            if not load_voice(name):
                return self.reply(503, b'{"error":"no voice"}')
            rate = max(120, min(280, int(body.get("rate", 190))))
            wav = speak(text, rate, name)
            return self.reply(200, wav, "audio/wav") if wav else self.reply(422, b'{"error":"nothing to say"}')
        if self.path == '/agent/interrupt':
            agent_host.interrupt(str(body.get('session',''))+':'+str(body.get('pack','vita')))
            return self.reply(200,b'{}')
        if self.path == "/chat":
            current = brain()
            if current == "scripted":
                return self.reply(503, b'{"error":"no brain"}')
            if not isinstance(body.get('messages'),list) or not body['messages']:
                return self.reply(400,b'{"error":"Messages required"}')
            messages = [{"role": m["role"], "content": str(m["content"])} for m in body.get("messages", [])[-30:]
                        if isinstance(m,dict) and m.get("role") in ("user", "assistant") and "content" in m]
            if not messages:return self.reply(400,b'{"error":"Messages required"}')
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            try:
                try:
                    name, profile = persona(body.get('pack',body.get('character','vita')),body.get('profile'))
                    # The body is separate from the personality: it says what this one can do with itself right now.
                    acts = [a for a in body.get('actions', []) if isinstance(a, str) and a.isidentifier()][:16]
                    shell = str(body.get('body', ''))[:60]
                    system = f"You are {name}, an AI character. {profile}\n" + (f"Your body right now: {shell}.\n" if shell else '') + \
                        (f"Body actions, used now and then where they fit: {' '.join(f'[{a}]' for a in acts)}\n" if acts else '') + PERFORM
                except (OSError,ValueError):
                    system = system_for(body.get("character"))
                session=str(body.get('session','default'))+':'+str(body.get('pack','vita'))
                for text in agent_host.stream(messages[-1]['content'],system,session):
                    self.wfile.write(f"data: {json.dumps({'text': text})}\n\n".encode())
                    self.wfile.flush()
            except BrokenPipeError:
                agent_host.interrupt(session)
                return
            except Exception as e:  # any API failure becomes a visible in-character error, not a dead stream
                print("chat error:", e)
                self.wfile.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
            return
        self.reply(404, b"{}")


if __name__ == "__main__":
    import signal
    def shutdown(*_):raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,shutdown)
    if os.environ.get('NORI_BRAIN')!='scripted':agent_host.start()
    print(f"Jaeger Avatar: http://localhost:{PORT}  brain={brain()}  voice={VOICE if voices.get(VOICE) else 'built-in synth'}")
    print(f"Control token: {CONTROL_TOKEN}", flush=True)
    def warm():  # so nobody waits on a cold model: the other voices, then Gemma with the system prompt already cached
        engine.start()
        load_stt()
        if gemma_ready():
            try:
                list(gemma_stream([{"role": "user", "content": "Hi"}], system_for("nori"), 1))
            except OSError as e:
                print("Gemma warm-up failed:", e)
    threading.Thread(target=warm, daemon=True).start()
    server=ThreadingHTTPServer(("127.0.0.1",PORT),Handler)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:agent_host.close();server.server_close()
