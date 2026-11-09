# Speech recognition reads each clip back; word errors against the requested text. Plus level and clipping.
import sys, re, json, wave, glob, os
import numpy as np
from faster_whisper import WhisperModel
d = sys.argv[1]; m = WhisperModel('base.en', device='cpu', compute_type='int8', download_root=sys.argv[2])
words = lambda s: re.sub(r"[^a-z' ]", ' ', s.lower()).split()
def wer(a, b):
    D = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        P, D[0] = D[:], i
        for j, y in enumerate(b, 1): D[j] = min(P[j] + 1, D[j - 1] + 1, P[j - 1] + (x != y))
    return D[-1] / max(1, len(a))
out = {}
for app in ('nori', 'kin'):
    errs, peaks, lead, tail = [], [], [], []
    for f in sorted(glob.glob(f'{d}/{app}-*.wav')):
        with wave.open(f) as w: x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; sr = w.getframerate()
        if sr != 16000: x16 = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
        else: x16 = x
        heard = ' '.join(s.text for s in m.transcribe(x16, language='en', beam_size=5)[0])
        e = wer(words(open(f[:-4] + '.txt').read()), words(heard)); errs.append(e)
        loud = np.nonzero(np.abs(x) > 0.02)[0]; peaks.append(float(np.abs(x).max())); lead.append(loud[0] / sr); tail.append((len(x) - loud[-1]) / sr)
        if e > 0: print(app, os.path.basename(f), round(e, 2), '|', heard.strip())
    out[app] = dict(wer=round(float(np.mean(errs)), 3), peak=round(max(peaks), 2), clipped=sum(p >= 0.999 for p in peaks), lead_ms=round(1000 * float(np.mean(lead))), tail_ms=round(1000 * float(np.mean(tail))), sr=sr)
print(json.dumps(out))
