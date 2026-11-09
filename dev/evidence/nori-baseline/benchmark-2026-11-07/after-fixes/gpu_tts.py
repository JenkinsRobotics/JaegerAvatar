# Alternates MLX and ONNX Kokoro in phases; prints phase boundaries so the page's frames can be split by phase.
import sys, time, random, statistics as st
sys.path.insert(0, sys.argv[1])
import voice_engine as ve, onnxruntime as ort
from kokoro_onnx import Kokoro
o = ort.SessionOptions(); o.intra_op_num_threads = ve.KOKORO_THREADS
onnx = Kokoro.from_session(ort.InferenceSession(str(ve.KOKORO / "kokoro-v1.0.onnx"), o, providers=["CPUExecutionProvider"]), str(ve.KOKORO / "voices-v1.0.bin"))
mlx = ve.MlxKokoro()
for k in (onnx, mlx): k.create("Warming up now.", voice="af_heart")
lines = ["Good morning! I fixed the coffee machine, but it now plays jazz.", "Wait, you mean the robots were dancing the whole time?", "Hi, I am Vita!", "Sorry, that was a lot.", "Honestly, I think the moon looks a little lonely tonight."]
res = {"mlx": [], "onnx": []}
print("READY", flush=True); time.sleep(10)
for rnd in range(3):
    for name, k in (("mlx", mlx), ("onnx", onnx)):
        print("PHASE", name, time.time(), flush=True); t_end = time.time() + 8
        while time.time() < t_end:
            s = f"{random.choice(lines)} {random.randint(1, 99999)}"; t = time.perf_counter(); k.create(s, voice="af_heart"); res[name].append(time.perf_counter() - t)
        print("PHASE idle", time.time(), flush=True); time.sleep(3)
print("DONE", flush=True)
for n, v in res.items(): print("RESULT", n, "median %.2f s range %.2f-%.2f n=%d" % (st.median(v), min(v), max(v), len(v)), flush=True)
