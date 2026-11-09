"""Speech into song, in whatever voice said it: each syllable's vowel is stretched to its note and moved to its pitch.

No singing model, so it works with any cloned voice and always lands on the tune. TD-PSOLA moves the pitch and keeps the
vowel's character, which holds up for a few semitones and gets thinner past that, so the tune is transposed to sit near the voice.
"""
import numpy as np

HOP = 0.005


def track_pitch(x, sr, lo=70.0, hi=520.0):
    """Returns (f0 per hop, 0 where unvoiced; loudness per hop). Normalized autocorrelation, with continuity left to the caller."""
    hop, win = int(sr * HOP), int(sr * 0.04)
    frames = max(0, (len(x) - win) // hop)
    f0, loud = np.zeros(frames), np.zeros(frames)
    lag_lo, lag_hi = int(sr / hi), min(int(sr / lo), win - 2)
    window = np.hanning(win)
    for i in range(frames):
        seg = x[i * hop:i * hop + win]
        loud[i] = np.sqrt(np.mean(seg ** 2))
        if loud[i] < 1e-3:
            continue
        s = (seg - seg.mean()) * window
        spec = np.fft.rfft(s, win * 2)
        ac = np.fft.irfft(np.abs(spec) ** 2)[:lag_hi + 2]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lag = lag_lo + int(np.argmax(ac[lag_lo:lag_hi]))
        # Octave errors: a clear peak at half the lag is the real period.
        half = lag // 2
        if half >= lag_lo and ac[half] > 0.85 * ac[lag]:
            lag = half
        if ac[lag] > 0.5 and 0 < lag < lag_hi:
            a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
            f0[i] = sr / (lag + 0.5 * (a - c) / max(a - 2 * b + c, -1e9) if a - 2 * b + c < 0 else lag)
    return f0, loud


def find_nuclei(f0, loud, count):
    """Exactly `count` voiced stretches, one per syllable, as (start, end) hops, or as near as the speech allows."""
    smooth = np.convolve(loud, np.ones(9) / 9, mode="same")
    on = (f0 > 0) & (smooth > 0.12 * (smooth.max() or 1))
    spans, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            if (i - start) * HOP >= 0.03:
                spans.append((start, i - 1))
            start = None
    if start is not None:
        spans.append((start, len(on) - 1))
    while len(spans) > max(count, 1):                       # too many: join the two closest
        gaps = [spans[i + 1][0] - spans[i][1] for i in range(len(spans) - 1)]
        i = int(np.argmin(gaps))
        spans[i:i + 2] = [(spans[i][0], spans[i + 1][1])]
    while spans and len(spans) < count:                     # too few: split the longest at its deepest dip
        i = int(np.argmax([e - s_ for s_, e in spans]))
        s_, e = spans[i]
        if (e - s_) * HOP < 0.1:
            break
        lo, hi = s_ + (e - s_) // 4, e - (e - s_) // 4
        cut = lo + int(np.argmin(smooth[lo:hi + 1]))
        spans[i:i + 1] = [(s_, cut - 1), (cut + 1, e)]
    return spans


def fit_key(f0, notes):
    """Semitones to move the tune so its middle sits on the middle of this voice."""
    voiced = f0[f0 > 0]
    if not len(voiced) or not notes:
        return 0
    return int(round(12 * np.log2(np.median(voiced) / np.median([n["f"] for n in notes]))))


def sing(x, sr, notes, vibrato=0.012):
    """x: speech. notes: [{t, f, dur}] in seconds and Hz. Returns (audio, transpose in semitones, when each note really starts)."""
    x = np.asarray(x, dtype=np.float64)
    f0, loud = track_pitch(x, sr)
    hop = int(sr * HOP)
    spans = find_nuclei(f0, loud, len(notes))
    if not spans:
        return x.astype(np.float32), 0, []
    shift = fit_key(f0, notes)
    notes = notes[:len(spans)]
    spans = spans[:len(notes)]
    ratio = 2 ** (shift / 12)

    # Where each output moment reads from: consonants at their own speed, vowels stretched to fill their note.
    src_of, tgt_of = [0.0], [0.0]
    for n, (a, b) in zip(notes, spans):
        sa, sb = a * HOP, (b + 1) * HOP
        consonant = max(0.0, sa - src_of[-1])
        onset = max(n["t"] + 0.25, tgt_of[-1] + consonant)     # a quarter second lead-in leaves room for the first consonant
        src_of += [sa, sb]
        tgt_of += [onset, max(onset + 0.04, onset + n["dur"] - 0.03)]
    src_of.append(len(x) / sr)
    tgt_of.append(tgt_of[-1] + max(0.0, src_of[-1] - src_of[-2]))
    total = tgt_of[-1] + 0.05
    out, norm = np.zeros(int(total * sr) + sr // 4), np.zeros(int(total * sr) + sr // 4)
    in_vowel = [(tgt_of[1 + i * 2], tgt_of[2 + i * 2], n["f"] * ratio, i == len(notes) - 1 or n["dur"] > 0.6) for i, n in enumerate(notes)]

    def target_pitch(t):
        for start, end, f, held in in_vowel:
            if start <= t < end:
                glide = min(1.0, (t - start) / 0.04)                # slides into each note, the way a voice does
                wobble = 1 + vibrato * np.sin(2 * np.pi * 5.5 * t) * min(1.0, max(0.0, (t - start - 0.15) / 0.2)) * (1 if held else 0.3)
                return f * wobble, glide
        return 0.0, 0.0

    onsets = [v[0] for v in in_vowel]
    t = 0.0
    while t < total:
        src_t = float(np.interp(t, tgt_of, src_of))
        i = min(len(f0) - 1, int(src_t / HOP)) if len(f0) else 0
        centre = int(src_t * sr)
        period_src = sr / f0[i] if len(f0) and f0[i] > 0 else sr * 0.008
        want, glide = target_pitch(t)
        if want > 0 and f0[i] > 0:
            period_out = sr / (want * glide + f0[i] * (1 - glide))
        else:
            period_out = period_src                                 # consonants and breath carry on as they were
        half = int(period_src)
        # Line the grain up on this region's strongest beat, so periods stack in phase.
        lo, hi = max(0, centre - half // 2), min(len(x), centre + half // 2 + 1)
        if want > 0 and f0[i] > 0 and hi > lo:
            centre = lo + int(np.argmax(np.abs(x[lo:hi])))
        a, b = max(0, centre - half), min(len(x), centre + half)
        if b - a > 4:
            grain = x[a:b] * np.hanning(b - a)
            at = int(t * sr) - (centre - a)
            if 0 <= at and at + (b - a) < len(out):
                out[at:at + b - a] += grain
                norm[at:at + b - a] += np.hanning(b - a)
        t += period_out / sr
    out = out / np.maximum(norm, 0.5)
    last = np.nonzero(np.abs(out) > 1e-4)[0]
    out = out[:last[-1] + 1] if len(last) else out
    peak = np.abs(out).max() or 1
    return (out / peak * 0.85).astype(np.float32), shift, onsets


if __name__ == "__main__":  # the smallest check that fails if the tune stops landing: a fake voice, a known melody, measured back
    sr = 24000
    syllables = [(0.1, 0.25, 180), (0.42, 0.25, 200), (0.75, 0.25, 170), (1.1, 0.3, 190)]
    t = np.arange(int(sr * 1.6)) / sr
    speech = np.zeros_like(t)
    for at, dur, f in syllables:
        on = (t >= at) & (t < at + dur)
        speech += on * sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 8)) * 0.2
    notes = [{"t": 0, "f": 220, "dur": 0.5}, {"t": 0.5, "f": 247, "dur": 0.5}, {"t": 1.0, "f": 196, "dur": 0.5}, {"t": 1.5, "f": 220, "dur": 1.0}]
    song, shift, _ = sing(speech, sr, notes, vibrato=0)
    f0, _ = track_pitch(song.astype(np.float64), sr)
    off = []
    for n in notes:
        a, b = int((n["t"] + 0.32) / HOP), int((n["t"] + 0.25 + n["dur"] - 0.1) / HOP)
        seg = f0[a:b]
        seg = seg[seg > 0]
        assert len(seg), f"no voice during the note at {n['t']}"
        off.append(abs(1200 * np.log2(np.median(seg) / (n["f"] * 2 ** (shift / 12)))))
    print("cents off per note", [round(c, 1) for c in off], "transpose", shift, "length", round(len(song) / sr, 2))
    assert max(off) < 30, off
    print("ok")
