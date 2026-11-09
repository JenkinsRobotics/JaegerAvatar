# Times Kokoro on MLX from a model path, reading sentences from stdin, one timing per line out.
import sys, time, numpy as np, os
from mlx_audio.tts.utils import load_model
import mlx.core as mx
if len(sys.argv) > 2 and sys.argv[2] == 'cap': mx.set_cache_limit(128 * 1024 * 1024)
import contextlib
with contextlib.redirect_stdout(sys.stderr): p = load_model(sys.argv[1])._get_pipeline('a')
list(p('Warming up now.', voice='af_heart'))
print('ready', flush=True)
for line in iter(sys.stdin.readline, ""):
    t = time.perf_counter(); x = [np.array(r.audio) for r in p(line.strip(), voice='af_heart', speed=1.0)]
    print(f'{time.perf_counter() - t:.3f}', flush=True)
