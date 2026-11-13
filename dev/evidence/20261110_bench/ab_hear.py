# Hearing only, same clip, through SpeechRuntime: 1 dropped warm-up + N timed decodes of each kind.
import json, statistics, sys, time
import numpy as np
from jaeger_agent.core.speech import SpeechRuntime
clip = np.load(sys.argv[1]); n = int(sys.argv[2])
rt = SpeechRuntime(); rt.load(lambda _m: None)
def med(fn):
    fn(); t = []
    for _ in range(n):
        s = time.perf_counter(); fn(); t.append(time.perf_counter() - s)
    return round(statistics.median(t), 4), round(min(t), 4)
print(json.dumps({"clip": med(lambda: rt.transcribe(clip, sample_rate=16000)),
                  "seg4s": med(lambda: rt.transcribe_segments(clip[:64000], initial_prompt="Octopuses"))}))
