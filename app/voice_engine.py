"""Natural voices. Kokoro speaks for every character: on the Apple GPU through MLX where it can, otherwise on the CPU through ONNX. Chatterbox Turbo loads only when someone uses a voice cloned from a sample.

Everything stays on this machine. Requests from an interrupted turn are skipped.
"""
import io
import json
import os
import queue
import re
import threading
import time
import urllib.request
import uuid
import wave
from pathlib import Path

ROOT = Path(__file__).parent
CLONE_MODEL = os.environ.get("NORI_CLONE_MODEL", "mlx-community/chatterbox-turbo-fp16")
KOKORO_MLX = "mlx-community/Kokoro-82M-bf16"
KOKORO_BACKEND = os.environ.get("NORI_KOKORO", "mlx")   # "onnx" forces the CPU path, for comparing the two
GPU = threading.RLock()     # Kokoro and the clone model share the GPU; one runs at a time (re-entrant: a song speaks its lines while holding it)
KOKORO = ROOT / ".cache" / "kokoro"
KOKORO_FILES = {"kokoro-v1.0.onnx": 325532387, "voices-v1.0.bin": 28214398}
KOKORO_THREADS = 4
KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
CLONES = ROOT / ".cache" / "clones"  # the voices people add. Never sent anywhere
# The English voices worth offering, by name.
KOKORO_VOICES = {"af_heart": "Heart", "af_bella": "Bella", "af_nicole": "Nicole", "af_sarah": "Sarah", "af_sky": "Sky", "am_michael": "Michael", "am_adam": "Adam", "am_fenrir": "Fenrir", "am_puck": "Puck", "am_echo": "Echo", "am_onyx": "Onyx", "bf_emma": "Emma (British)", "bf_isabella": "Isabella (British)", "bm_george": "George (British)", "bm_lewis": "Lewis (British)"}
SAMPLE_LIMIT = 24000 * 2 * 60        # a minute of 24 kHz 16-bit audio
MIN_SAMPLE_SECONDS = 3
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "hf"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def to_wav(samples, sr):
    import numpy as np
    pcm = (np.clip(np.asarray(samples, dtype=np.float32), -1, 1) * 32767).astype(np.int16).tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)
    return out.getvalue()


def from_wav(data):
    import numpy as np
    with wave.open(io.BytesIO(data)) as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise ValueError("expected mono 16-bit WAV")
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768, w.getframerate()


def clean(x, sr, trim=None):
    """Trims dead air, so the voice starts when the mouth does, softens the edges, and evens out the level with no clipping.

    The rumble filter and the level are local-avatar-demo's: by average loudness, so quiet lines aren't left quiet, within peak headroom.
    """
    import numpy as np
    from scipy.signal import butter, sosfilt
    x = np.asarray(x, dtype=np.float32).flatten()
    if not len(x):
        return x
    x = sosfilt(butter(2, 60, fs=sr, btype="highpass", output="sos"), x).astype(np.float32)
    level = np.abs(x)
    loud = np.nonzero(level > max(0.012, level.max() * 0.03))[0]
    if len(loud):
        start = max(0, loud[0] - int(sr * 0.012))
        x = x[start:min(len(x), loud[-1] + int(sr * 0.09))]
        if trim is not None:
            trim.append(start / sr)     # lip marks are timed on the untrimmed audio
    fade = min(int(sr * 0.006), len(x) // 2)
    if fade:
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
    rms, peak = float(np.sqrt(np.mean(x * x))), float(np.abs(x).max())
    return x * min(2.5, 0.11 / max(rms, 0.001), 0.89 / peak) if peak > 1e-4 else x


# The clone model's one delivery control: a little looser when the feeling is big, steadier when it's quiet.
LOOSENESS = {"excited": 0.95, "joy": 0.88, "surprised": 0.92, "scared": 0.92, "angry": 0.9, "sad": 0.7, "sleepy": 0.65, "shy": 0.72, "thinking": 0.72}


LIPS = {"p": "p", "b": "p", "m": "p", "f": "f", "v": "f"}   # lips press shut, or the lower lip tucks under the teeth


def lip_marks(phonemes, frames, vocab, offset=0.0):
    """[start, end, kind] in seconds for each closure, from Kokoro's own phoneme durations (25 ms frames, <bos> first).
    Checked by ear and level on "Mom bought a big puppy": each b/p's silent closure falls inside its mark.

    The model skips phonemes it has no id for, so they're skipped here too, keeping each duration on its sound.
    """
    marks, t = [], offset + max(0, frames[0] - 3) * 0.025   # the sound runs 3 frames ahead of <bos>, as Kokoro's own timestamps assume
    for ph, n in zip([p for p in phonemes if p in vocab], frames[1:-1]):
        if ph in LIPS:
            marks.append([round(t, 3), round(t + n * 0.025, 3), LIPS[ph]])
        t += n * 0.025
    return marks


class MlxKokoro:
    """Kokoro on the Apple GPU, several times faster than ONNX on this Mac, read the way local-avatar-demo reads it.

    mlx-audio's pipeline pronounces with misaki, Kokoro's own rules, as local-avatar-demo does; its voice was preferred by ear
    on 2026-11-07. (Matching eSpeak, the ONNX engine's pronunciation, was tried first and judged worse.)
    """
    def __init__(self):
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
        # A small buffer cache, as local-avatar-demo does: median 1.33 s -> 0.74 s a line on this Mac, side by side.
        mx.set_cache_limit(128 * 1024 * 1024)
        self.model = load_model(KOKORO_MLX)

    def create(self, text, voice, speed=1.0, lang="en-us", marks=None):
        import numpy as np
        # The model's own generate() rebuilds its voice and pipeline every call; the cached pipeline keeps them.
        pipeline = self.model._get_pipeline("b" if lang == "en-gb" else "a")
        parts = []
        with GPU:
            for r in pipeline(text, voice=voice, speed=speed):
                if marks is not None and r.pred_dur is not None:
                    marks += lip_marks(r.phonemes, r.pred_dur.tolist(), self.model.vocab, sum(map(len, parts)) / 24000)
                parts.append(np.array(r.audio, dtype=np.float32).reshape(-1))
        return (np.concatenate(parts) if parts else np.zeros(1, np.float32)), 24000


class Engine:
    def __init__(self):
        self.status = "off"         # Kokoro: off, loading or ready. The fast voices carry on until it's ready
        self.clone_status = "idle"  # the clone model: idle until first used, then loading, ready or off
        self.error = None
        self.kokoro = None
        self.backend = None         # "mlx" or "onnx", once Kokoro is ready
        self.lines = queue.Queue()  # first come, first spoken, or a later clause can hold up the one she's about to say
        self.clone_model = None
        self.conds = {}
        self.sr = 24000
        self.jobs = queue.Queue()
        self.current_turn = 0       # the page numbers its turns. Anything from an older turn is skipped
        self.short = {}             # short sounds and words, kept once made, so a laugh is instant the second time
        self.songs = {}             # half-sung songs, kept once made: a reel replays its song instantly
        self.singer = None
        self.clone_thread = None

    def start(self):
        if self.status != "off":
            return
        self.status = "loading"
        threading.Thread(target=self._load_kokoro, daemon=True).start()

    def _load_kokoro(self):
        if KOKORO_BACKEND == "mlx":
            try:
                self.kokoro = MlxKokoro()
                self.kokoro.create("Hi there, it's so good to see you today.", voice="af_heart")  # the first inference is the slow one
                self.backend = "mlx"
            except Exception as e:  # no Apple GPU, or the model isn't downloadable yet: the CPU version below
                print("Kokoro on MLX unavailable, using ONNX:", e)
        if self.kokoro is None:
            self._load_kokoro_onnx()
        if self.kokoro is not None:
            threading.Thread(target=self._run_lines, daemon=True).start()
            self.status = "ready"
            print(f"Kokoro ready ({self.backend})")

    def _load_kokoro_onnx(self):
        try:
            KOKORO.mkdir(parents=True, exist_ok=True)
            for name, size in KOKORO_FILES.items():
                path = KOKORO / name
                if not path.exists() or path.stat().st_size != size:
                    print(f"Downloading {name} (first run only)...")
                    tmp = path.with_suffix(".part")
                    urllib.request.urlretrieve(KOKORO_URL + name, tmp)
                    if tmp.stat().st_size != size:
                        raise OSError(f"{name} arrived incomplete")
                    tmp.replace(path)
            from kokoro_onnx import Kokoro
            import onnxruntime as ort
            options = ort.SessionOptions()
            options.intra_op_num_threads = KOKORO_THREADS   # leave cores free, so the drawing and the sound never have to wait for the next line
            session = ort.InferenceSession(str(KOKORO / "kokoro-v1.0.onnx"), options, providers=["CPUExecutionProvider"])
            self.kokoro = Kokoro.from_session(session, str(KOKORO / "voices-v1.0.bin"))
            self.kokoro.create("Hi there, it's so good to see you today.", voice="af_heart", speed=1.0, lang="en-us")  # the first inference is the slow one
            self.backend = "onnx"
        except Exception as e:      # no network yet: the fast voices carry on
            print("Kokoro unavailable, using the fast voices:", e)
            self.kokoro = None
            self.status, self.error = "off", str(e)

    def _run_lines(self):
        while True:
            turn, args, done = self.lines.get()
            try:
                done["result"] = None if turn < self.current_turn else args() if callable(args) else self.kokoro.create(**args)
            except Exception as e:
                print("voice error:", e)
                done["error"] = str(e)
            done["event"].set()

    # --- the clone model, on its own thread, oldest request first ---------
    def _ensure_clone_model(self):
        if self.clone_thread:
            return
        self.clone_status = "loading"
        self.clone_thread = threading.Thread(target=self._run_clones, daemon=True)
        self.clone_thread.start()

    def _run_clones(self):
        try:
            from mlx_audio.tts.utils import load_model
            print(f"Loading the voice clone model {CLONE_MODEL} (the first use downloads about 3.2 GB)...")
            self.clone_model = load_model(CLONE_MODEL)
            self.clone_status = "ready"
            print("Voice clone model ready")
        except Exception as e:      # no MLX on this machine, or no network: clones fall back to the character's own voice
            print("Voice clone model unavailable:", e)
            self.clone_status, self.error = "off", str(e)
        while True:
            turn, fn, done = self.jobs.get()
            try:
                if self.clone_status != "ready":
                    raise RuntimeError("voice clone model unavailable")
                if turn < self.current_turn:
                    done["result"] = None
                else:
                    with GPU:
                        done["result"] = fn()
            except Exception as e:
                print("voice error:", e)
                done["error"] = str(e)
            done["event"].set()

    def _call(self, fn, turn):
        self._ensure_clone_model()
        done = {"event": threading.Event()}
        self.jobs.put((turn, fn, done))
        if not done["event"].wait(120):
            raise RuntimeError("voice clone model took too long")
        if "error" in done:
            raise RuntimeError(done["error"])
        return done.get("result")

    def warm(self):
        self._ensure_clone_model()

    def ready_for(self, voice):
        if voice.startswith("kokoro:"):
            return self.status == "ready"
        self._ensure_clone_model()      # first use of a clone starts the load, and the page falls back meanwhile
        return self.clone_status == "ready"

    def cancel(self, turn):
        """Everything from before this turn, not yet started, is for a line nobody will hear."""
        self.current_turn = max(self.current_turn, turn)

    # --- voices ---------------------------------------------------------
    def list(self):
        voices = [{"id": "kokoro:" + k, "name": n, "kind": "built-in"} for k, n in KOKORO_VOICES.items()] if self.status == "ready" else []
        for meta in sorted(CLONES.glob("*.json")) if CLONES.exists() else []:
            voices.append({"id": "clone:" + meta.stem, "name": json.loads(meta.read_text())["name"], "kind": "clone"})
        return voices

    def clone_path(self, name):
        path = CLONES / f"{name}.wav"
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", name) or not path.exists():
            raise ValueError("no such voice")
        return path

    def add_clone(self, name, wav_bytes, consent):
        if not consent:
            raise PermissionError("consent")
        samples, sr = from_wav(wav_bytes)
        seconds = len(samples) / sr
        if seconds < MIN_SAMPLE_SECONDS:
            raise ValueError(f"The sample is {seconds:.1f} s. It needs at least {MIN_SAMPLE_SECONDS} s of speech.")
        import numpy as np
        if float(np.sqrt(np.mean(samples ** 2))) < 0.003:
            raise ValueError("The sample is almost silent.")
        CLONES.mkdir(parents=True, exist_ok=True)
        vid = uuid.uuid4().hex[:12]
        (CLONES / f"{vid}.wav").write_bytes(to_wav(clean(samples, sr), sr))
        (CLONES / f"{vid}.json").write_text(json.dumps({"name": (name or "My voice")[:40], "consent": True, "seconds": round(seconds, 1), "added": time.strftime("%Y-%m-%d")}))
        return "clone:" + vid

    def delete_clone(self, voice):
        kind, _, name = voice.partition(":")
        if kind != "clone":
            raise ValueError("only added voices can be deleted")
        self.clone_path(name).unlink()
        (CLONES / f"{name}.json").unlink(missing_ok=True)
        self.conds.pop(name, None)
        self.short = {k: v for k, v in self.short.items() if k[0] != voice}

    # --- speech -----------------------------------------------------------
    def _speak_clone(self, name, text, emotion):
        import numpy as np
        if name not in self.conds:          # hearing a voice once is the costly part, so it's done once per voice
            self.clone_model.prepare_conditionals(str(self.clone_path(name)))
            self.conds[name] = self.clone_model._conds
        self.clone_model._conds = self.conds[name]
        parts = [np.array(r.audio, dtype=np.float32).flatten() for r in self.clone_model.generate(text=text, temperature=LOOSENESS.get(emotion, 0.8), top_p=0.95, repetition_penalty=1.2, norm_loudness=True)]
        return clean(np.concatenate(parts) if parts else np.zeros(1), self.sr)

    def song(self, voice, text, turn=0, sung=False):
        """(mix, voice alone, beat times) for a song, spoken on the beat or half-sung, or None if the turn was interrupted. Kokoro on MLX only."""
        kind, _, name = voice.partition(":")
        if kind != "kokoro" or name not in KOKORO_VOICES or self.backend != "mlx":
            raise ValueError("songs need a Kokoro voice on MLX")
        key = (name, text, sung)
        if key not in self.songs:
            import song
            if self.singer is None:
                self.singer = song.Singer(self.kokoro.model, lambda line, v: self.kokoro.create(line, voice=v, lang="en-gb" if v[0] == "b" else "en-us")[0])

            def make():
                with GPU:
                    return self.singer.sing(text, name, sung)
            done = {"event": threading.Event()}
            self.lines.put((turn, make, done))      # in line with her speech, and skipped like it when the turn is interrupted
            if not done["event"].wait(120):
                raise RuntimeError("the song took too long")
            if "error" in done:
                raise RuntimeError(done["error"])
            if done.get("result") is None:
                return None
            if len(self.songs) >= 8:
                self.songs.pop(next(iter(self.songs)))
            self.songs[key] = done["result"]
        return self.songs[key]

    def speak(self, voice, text, emotion=None, speed=1.0, turn=0, marks=None):
        """Returns samples at self.sr, or None if the turn was interrupted before it got this far.

        marks, if given, gets the lip closures ([start, end, "p" or "f"] in seconds). Only Kokoro on MLX knows them.
        """
        key = (voice, text, round(speed, 2))
        found = []
        if key in self.short:
            x, found = self.short[key]
            if marks is not None:
                marks += found
            return x
        kind, _, name = voice.partition(":")
        if kind == "kokoro":
            if name not in KOKORO_VOICES:
                raise ValueError("no such voice")
            done = {"event": threading.Event()}
            args = dict(text=text, voice=name, speed=max(0.6, min(1.5, speed)), lang="en-gb" if name[0] == "b" else "en-us")
            if self.backend == "mlx":
                args["marks"] = found
            self.lines.put((turn, args, done))
            if not done["event"].wait(60):
                raise RuntimeError("the voice took too long")
            if "error" in done:
                raise RuntimeError(done["error"])
            if done.get("result") is None:
                return None
            trim = []
            x = clean(*done["result"], trim)
            found = [[max(0, round(a - trim[0], 3)), round(b - trim[0], 3), k] for a, b, k in found if b > trim[0]] if trim else found
        elif kind == "clone":
            self.clone_path(name)
            x = self._call(lambda: self._speak_clone(name, text, emotion), turn)
        else:
            raise ValueError("no such voice")
        if x is not None and len(text) <= 12:
            if len(self.short) > 128:
                self.short.pop(next(iter(self.short)))
            self.short[key] = (x, found)
        if marks is not None:
            marks += found
        return x


engine = Engine()
