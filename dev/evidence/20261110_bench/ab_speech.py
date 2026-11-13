# A/B benchmark: drives the agent's SpeechRuntime public API only, so the same script runs on the
# current setup (agent's own loaders) and the new one (Jaeger modules). No speaker, no microphone.
# usage: ab_speech.py <label> <out.json> <clip.npy>   (clip is created on the first run, reused after)
import json, os, statistics, sys, time
import numpy as np
from jaeger_agent.core.speech import SpeechRuntime

label, out, clip_path = sys.argv[1:4]
SHORT = "Hello there, I can hear you."
LONG = ("Octopuses have three hearts and blue blood. Two of the hearts pump blood through the gills, "
        "while the third sends it around the rest of the body. When an octopus swims, the third heart "
        "stops beating, which is why they prefer to crawl along the sea floor instead.")
marks = []
rt = SpeechRuntime()
t0 = time.perf_counter()
rt.load(lambda m: marks.append((round(time.perf_counter() - t0, 3), str(m))))
load_s = time.perf_counter() - t0

def voice(text, runs=5):
    rows = []
    for _ in range(runs + 1):                      # first run is a warm-up and is dropped
        t = time.perf_counter(); first = None; n = 0; chunks = 0
        for c in rt.synthesize_stream(text):
            first = first or time.perf_counter() - t; n += len(c); chunks += 1
        rows.append((first, time.perf_counter() - t, n / 24000, chunks))
    rows = rows[1:]
    med = lambda i: round(statistics.median(r[i] for r in rows), 4)
    return {"first_chunk_s": med(0), "total_s": med(1), "audio_s": med(2), "chunks": rows[0][3],
            "rtf": round(med(1) / med(2), 4), "all_total_s": [round(r[1], 4) for r in rows]}

res = {"label": label, "load_s": round(load_s, 3), "load_marks": marks,
       "voice_short": voice(SHORT), "voice_long": voice(LONG)}

if not os.path.exists(clip_path):                  # one clip, shared by both sides
    from scipy.signal import resample_poly
    np.save(clip_path, resample_poly(rt.synthesize(LONG), 2, 3).astype(np.float32))
clip = np.load(clip_path)

def hear(fn, runs=5):
    ts = []; got = None
    for _ in range(runs + 1):
        t = time.perf_counter(); got = fn(); ts.append(time.perf_counter() - t)
    return round(statistics.median(ts[1:]), 4), [round(x, 4) for x in ts[1:]], got

s, alls, text = hear(lambda: rt.transcribe(clip))
res["hear_clip"] = {"clip_s": round(len(clip) / 16000, 2), "median_s": s, "all_s": alls, "text": text}
s, alls, segs = hear(lambda: rt.transcribe_segments(clip[:16000 * 4], initial_prompt="Octopuses"))
res["hear_segments_4s"] = {"median_s": s, "all_s": alls, "segments": segs}
for name in ("tts", "stt"):
    node = getattr(rt, name, None)
    res[name + "_node"] = {k: str(getattr(node, k)) for k in ("compute", "module", "model_name") if hasattr(node, k)}
json.dump(res, open(out, "w"), indent=1)
print(json.dumps(res, indent=1))
