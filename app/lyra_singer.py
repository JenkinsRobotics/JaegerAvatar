"""Sung lyrics from JaegerLyra's experimental singer (SoulX-Singer, Apache-2.0), run from that project as it is.

Two stages, each JaegerLyra's own script in its own Python environment: Kokoro makes a short reference of the voice (kept once
made, in JaegerLyra's cache), then SoulX sings the lyrics to a melody in that voice. The request and the finished song live in
this project's .cache/songs. Nothing in JaegerLyra is changed. One song at a time; Stop ends the running stage.
The same route local-avatar-demo uses; see the README's source record.
"""
import atexit
import hashlib
import json
import os
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).parent
LYRA = Path(os.environ.get("NORI_LYRA", ROOT.parent.parent / "JaegerLyra")).expanduser()
SONGS = ROOT / ".cache" / "songs"
VOICES = ("af_heart", "af_bella", "af_nicole", "am_michael", "bf_emma", "bm_george")   # the voices it has references for
MELODIES = {"glow": "Little glow", "lullaby": "Lullaby"}
jobs, guard = {}, threading.Lock()


def available():
    return all(p.exists() for p in (LYRA / ".research-venv/bin/python", LYRA / ".voice-venv/bin/python", LYRA / "models/soulx-singer/model.pt", LYRA / "soulx_singing.py"))


def request_of(body, voice):
    """The worker validates lyrics, tempo and range itself; this only picks what to send."""
    return {"engine": "soulx", "lyrics": str(body.get("lyrics", ""))[:200], "speaker": voice if voice in VOICES else "af_heart",
            "melody": body.get("melody") if body.get("melody") in MELODIES else "glow", "tempo": body.get("tempo", 104),
            "transpose": body.get("transpose", 0), "referenceKind": "sung" if body.get("reference") == "sung" else "speech"}


def start(request):
    if not available():
        raise ValueError(f"The experimental singer isn't installed: it needs JaegerLyra at {LYRA}.")
    key = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()[:24]
    with guard:
        if (SONGS / f"{key}.wav").exists() and (SONGS / f"{key}.result.json").exists():
            return {"id": key, "status": "ready"}
        if any(j["status"] in ("queued", "singing") for k, j in jobs.items() if k != key):
            raise ValueError("A song is already being sung. Stop it or wait for it to finish.")
        if key not in jobs or jobs[key]["status"] in ("error", "stopped"):
            jobs[key] = {"status": "queued", "phase": "Waiting to start", "process": None}
            threading.Thread(target=_run, args=(key, request), daemon=True).start()
    return {"id": key, "status": jobs[key]["status"]}


def _stage(job, python, script, path, phase):
    with guard:
        if job["status"] == "stopped":
            return False
        job["phase"] = phase
        log = open(SONGS / "singer.log", "a")
        job["process"] = subprocess.Popen([str(LYRA / python), "-u", str(LYRA / script), str(path)], cwd=LYRA, stdout=log, stderr=log,
                                          env={**os.environ, "HF_HUB_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1", "TOKENIZERS_PARALLELISM": "false", "PYTORCH_ENABLE_MPS_FALLBACK": "1"})
    try:
        code = job["process"].wait(timeout=360)
    except subprocess.TimeoutExpired:
        job["process"].kill()
        raise RuntimeError("The singer took too long.")
    finally:
        log.close()
    if job["status"] == "stopped":
        return False
    if code:
        error = path.with_suffix(".error.json")
        raise ValueError(json.loads(error.read_text())["error"] if error.exists() else f"The singer failed; see {SONGS / 'singer.log'}.")
    return True


def _run(key, request):
    job, path = jobs[key], SONGS / f"{key}.json"
    try:
        SONGS.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(request))
        job["status"] = "singing"
        reference = LYRA / ".cache/singing-references" / f"v1-{request['speaker']}-{request['referenceKind']}.wav"
        if not reference.exists() and not _stage(job, ".voice-venv/bin/python", "singing_reference.py", path, "Making a reference of her voice…"):
            return
        if _stage(job, ".research-venv/bin/python", "soulx_singing.py", path, "Loading the singer and singing… (about half a minute)"):
            job.update(status="ready", phase="Ready")
    except Exception as e:  # shown to the person as it is
        if job["status"] != "stopped":
            job.update(status="error", phase=str(e))


def status(key):
    if not isinstance(key, str) or len(key) != 24 or not all(c in "0123456789abcdef" for c in key):
        raise ValueError("unknown song")
    if (SONGS / f"{key}.wav").exists() and (SONGS / f"{key}.result.json").exists():
        details = json.loads((SONGS / f"{key}.result.json").read_text())
        return {"status": "ready", "duration": details.get("duration"), "notice": details.get("notice")}
    job = jobs.get(key)
    if not job:
        raise ValueError("unknown song")
    return {"status": job["status"], "phase": job["phase"]}


def audio(key):
    status(key)                                  # validates the id
    return (SONGS / f"{key}.wav").read_bytes()


def stop(key):
    with guard:
        job = jobs.get(key)
        if not job or job["status"] not in ("queued", "singing"):
            return
        job.update(status="stopped", phase="Stopped")
        process = job["process"]
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


atexit.register(lambda: [stop(k) for k in list(jobs)])   # a song still rendering ends with the server


if __name__ == "__main__":      # self-check that needs no model
    r = request_of({"lyrics": "Little lights\nHere tonight", "melody": "nope", "reference": "sung"}, "af_sky")
    assert r["speaker"] == "af_heart" and r["melody"] == "glow" and r["referenceKind"] == "sung"
    for bad in ("../x", "g" * 24, 5):
        try:
            status(bad); raise AssertionError(bad)
        except ValueError:
            pass
    print("ok", "available" if available() else "JaegerLyra not found")
