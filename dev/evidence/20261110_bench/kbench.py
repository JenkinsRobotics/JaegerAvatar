# Times the PyTorch Kokoro (what jaeger-module-kokoro uses) on cpu and on mps. Same sentences as the app test.
import sys, time, os
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import torch
from kokoro import KPipeline
SENT = ["Hello there.", "Jaeger audio endurance check. The speech path is operating normally.",
        "Robotics speech should remain responsive, intelligible, and interruption safe."]
for dev in sys.argv[1:]:
    try:
        t = time.perf_counter(); p = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", device=dev); load = time.perf_counter() - t
        list(p("Warm up.", voice="af_heart"))
        for s in SENT:
            t = time.perf_counter(); first = None; n = 0; marks = 0
            for r in p(s, voice="af_heart"):
                if first is None: first = time.perf_counter() - t
                n += len(r.audio); marks += len(r.tokens or [])
            el = time.perf_counter() - t
            print(f"{dev:4} load {load:4.1f}s  first {first:5.2f}s  total {el:5.2f}s  audio {n/24000:5.2f}s  x{n/24000/el:5.1f} realtime  word-marks {marks}")
    except Exception as e:
        print(dev, "FAILED:", type(e).__name__, str(e)[:200])
