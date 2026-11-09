"""Songs in the character's own Kokoro voice over a soft music box: spoken on the beat (the default, chosen by ear), or half-sung.

Kokoro's own decoder makes the sound: it is given the tune's pitch and the beat's timing in place of speech prosody, with a little of
her speaking rise and fall kept on top, so the words stay hers. The method idea is from local-avatar-demo/kokoro_singing.py (which
adapts mlx-audio 0.6.4, MIT). Needs Kokoro on MLX; anywhere else the page uses its built-in singer.
"""
import numpy as np

SR, BPM = 24000, 92
BEAT = 60 / BPM
BAR = BEAT * 4
INTRO = 1                       # bars of music before she comes in
KEEP_SPEECH = 0.45              # how much of her own speaking inflection rides on the tune; 0 sings it dead straight
VOWELS = set("aeiouæɑɒɔəɛɜɪʊʌɚɝAIOWYᵊ")
# Two alternating phrases, semitones above the key's root; each line ends on a held note, the song on the root.
PHRASES = [[4, 4, 7, 7, 9, 9, 7, 4], [5, 5, 4, 4, 2, 0]]


def tune(syllables, line, last):
    phrase = PHRASES[line % 2]
    notes = [(phrase[min(k, len(phrase) - 1)] if k < syllables - 1 else (0 if last else phrase[-1]), 0.5) for k in range(syllables)]
    if syllables > 1:
        notes[-2] = (notes[-2][0], 0.75)
    notes[-1] = (notes[-1][0], 2.25 if last else 1.25)
    return notes


def lines_of(text):
    parts = [p.strip() for p in text.replace(";", ",").replace("!", ".").replace("?", ".").split(",")]
    out = []
    for p in parts:
        out += [q.strip() + "," for q in p.split(".") if q.strip()]
    return out[:6] or [text]


class Singer:
    def __init__(self, model, speak):
        import mlx.core as mx
        self.mx, self.model, self.speak, self.keys, self.packs = mx, model, speak, {}, {}

    def _front(self, text, voice):
        mx, model = self.mx, self.model
        pipe = model._get_pipeline("b" if voice[0] == "b" else "a")
        if voice not in self.packs:
            self.packs[voice] = pipe.load_voice(voice)
        _, tokens = pipe.g2p(text)
        segments = list(pipe.en_tokenize(tokens))
        ph = "".join(p for seg in segments for p in seg[1] if p in model.vocab)[:400]
        ref = self.packs[voice][len(ph) - 1]
        ids = mx.array([[0, *[model.vocab[p] for p in ph], 0]])
        lengths, mask = mx.array([ids.shape[1]]), mx.zeros(ids.shape, dtype=mx.bool_)
        bert, _ = model.bert(ids, attention_mask=(~mask).astype(mx.int32))
        style = ref[:, 128:]
        enc = model.predictor.text_encoder(model.bert_encoder(bert).transpose(0, 2, 1), style, lengths, mask)
        x, _ = model.predictor.lstm(enc)
        natural = np.array(mx.clip(mx.round(mx.sigmoid(model.predictor.duration_proj(x)).sum(-1)), 1, 100)[0]).astype(int)
        return ph, ref, ids, lengths, mask, style, enc, natural

    def _align(self, n, durations):
        mx = self.mx
        idx = mx.array(np.repeat(np.arange(len(durations)), durations))
        a = mx.zeros((n, len(idx)))
        a[idx, mx.arange(len(idx))] = 1
        return a[None, :]

    def _key(self, voice):
        """Where her speaking voice sits, so the tune's middle lands a little above it."""
        if voice not in self.keys:
            _, _, ids, _, _, style, enc, natural = self._front("Hello, I am here, and this is my song.", voice)
            f0, _ = self.model.predictor.F0Ntrain(enc.transpose(0, 2, 1) @ self._align(ids.shape[1], natural), style)
            f0 = np.array(f0)[0]
            self.keys[voice] = float(np.median(f0[f0 > 55])) * 2 ** (-3 / 12)
        return self.keys[voice]

    def _line(self, line, voice, line_no, last):
        mx, model = self.mx, self.model
        ph, ref, ids, lengths, mask, style, enc, natural = self._front(line, voice)
        chars = [""] + list(ph) + [""]
        nuclei = [i for i, p in enumerate(chars) if p in VOWELS]
        # A vowel then a schwa is one syllable ("wires" is w-I-ə-r); other pairs are two ("glow-ing").
        nuclei = [n for k, n in enumerate(nuclei) if not (k and n - nuclei[k - 1] == 1 and chars[n] in "əɚᵊ")]
        if not nuclei:
            return None, 0.0
        notes = tune(len(nuclei), line_no, last)
        dur = np.clip(natural, 1, 9).copy()
        for i, p in enumerate(chars):
            if p and p in " ˈˌ.,!?;:":
                dur[i] = 1
        bounds = [1] + [(a + b) // 2 + 1 for a, b in zip(nuclei, nuclei[1:])] + [len(chars) - 1]
        for j, nuc in enumerate(nuclei):      # each syllable fills its beats; only the vowel stretches, consonants keep their own length
            frames = round(40 * BEAT * notes[j][1])
            dur[nuc] = max(4, frames - int(dur[bounds[j]:bounds[j + 1]].sum() - dur[nuc]))
        # Prosody predicted at speech timing, then stretched: predicting it at held lengths smears the words.
        f0n, noise = model.predictor.F0Ntrain(enc.transpose(0, 2, 1) @ self._align(ids.shape[1], natural), style)
        f0n, noise = np.array(f0n)[0], np.array(noise)[0]
        edges = np.r_[0, np.cumsum(natural)] * 2
        warp = np.concatenate([np.linspace(edges[i], edges[i + 1] - 1, int(n) * 2) for i, n in enumerate(dur)])
        ax = np.arange(len(f0n))
        f0, nz = np.interp(warp, ax, f0n), np.interp(warp, ax, noise)
        off = np.r_[0, np.cumsum(dur)] * 2
        target, prev = np.zeros(len(f0)), notes[0][0]
        for j in range(len(nuclei)):
            a, b = int(off[bounds[j]]), int(off[bounds[j + 1]])
            t = np.arange(b - a) / 80
            target[a:b] = prev + (notes[j][0] - prev) * np.clip(t / 0.06, 0, 1) + 0.18 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.22) / 0.25, 0, 1)
            prev = notes[j][0]
        target[int(off[bounds[-1]]):] = prev
        hz = self._key(voice) * 2 ** (target / 12)
        voiced = f0 > 55
        local = np.where(voiced, np.log2(np.maximum(f0, 1)), np.nan)
        if voiced.any():
            hz = hz * 2 ** (np.nan_to_num(local - np.nanmedian(local)) * KEEP_SPEECH)
        sung = mx.array(np.where(voiced, hz, f0).astype(np.float32))[None, :]
        text = model.text_encoder(ids, lengths, mask) @ self._align(ids.shape[1], dur)
        audio = model.decoder(text, sung, mx.array(nz.astype(np.float32))[None, :], ref[:, :128])[0]
        x = np.array(audio).reshape(-1).astype(np.float32)
        return x, sum(n[1] for n in notes) * BEAT

    def sing(self, text, voice, sung=False):
        """Returns (mix, voice alone, beat times in seconds), both tracks the same length at SR.
        Spoken: each line in her ordinary voice, starting on a bar. Sung: Kokoro's decoder given the tune."""
        lines = lines_of(text)
        if sung:
            parts = [self._line(l, voice, i, i == len(lines) - 1) for i, l in enumerate(lines)]
        else:
            parts = [(x, len(x) / SR) for x in (np.asarray(self.speak(l, voice), dtype=np.float32) for l in lines)]
        last = (INTRO + 2 * (len(lines) - 1)) * BAR + (parts[-1][1] or BAR)
        n = int(SR * (last + 1.2))                                  # her last note, then a moment for the music box to ring out
        bars = int(np.ceil(n / (SR * BAR)))
        vox = np.zeros(n + SR)
        for i, (x, _) in enumerate(parts):
            if x is None:
                continue
            x = x / (np.abs(x).max() or 1) * 0.8
            at = max(0, int(SR * (INTRO + 2 * i) * BAR) - int(SR * 0.04))   # a breath early, so the first vowel lands on the beat
            vox[at:at + len(x)] += x[:len(vox) - at]
        vox = vox[:n]
        music = backing(bars, self._key(voice))[:n]
        mix = reverb(vox) + music / (np.abs(music).max() or 1) * 0.32
        fade = int(SR * 1.0)
        mix[-fade:] *= np.linspace(1, 0, fade)
        mix *= 0.89 / max(1e-6, np.abs(mix).max())
        return mix.astype(np.float32), vox.astype(np.float32), [round(k * BEAT, 4) for k in range(int(n / SR / BEAT) + 1)]


def backing(bars, key_hz):
    n = int(SR * BAR * bars) + SR * 2
    out = np.zeros(n)
    chords = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]]          # I IV I V
    t16 = np.arange(int(SR * 1.6)) / SR
    tbar = np.arange(int(SR * BAR)) / SR
    for bar in range(bars):
        ch = chords[bar % 4]
        for k in range(8):                                             # music-box arpeggio in eighths
            f = key_hz * 2 ** ((ch[k % 3] + (12 if k >= 4 else 0)) / 12)
            s = sum(a * np.sin(2 * np.pi * f * h * t16) for h, a in ((1, .5), (2, .18), (3, .08), (5.4, .05))) * np.exp(-t16 / 0.45) * np.minimum(1, t16 / 0.004) * 0.16
            at = int(SR * BEAT * (bar * 4 + k * 0.5))
            out[at:at + len(s)] += s[:n - at]
        for semis in ch:                                               # soft pad under it
            f = key_hz * 2 ** ((semis - 12) / 12)
            s = (np.sin(2 * np.pi * f * tbar) + 0.3 * np.sin(4 * np.pi * f * tbar)) * np.minimum(1, tbar / 0.4) * np.minimum(1, (tbar[-1] - tbar) / 0.3) * 0.035
            at = int(SR * BAR * bar)
            out[at:at + len(s)] += s[:n - at]
    return out


def reverb(x, wet=0.16):
    from scipy.signal import fftconvolve
    ir = np.random.default_rng(1).standard_normal(int(SR * 0.9)) * np.exp(-np.arange(int(SR * 0.9)) / (SR * 0.22))
    ir[0] = 0
    w = fftconvolve(x, ir)[:len(x)]
    return x + wet * w / (np.abs(w).max() or 1) * np.abs(x).max()


if __name__ == "__main__":      # self-check of the parts that need no model
    assert lines_of("Tiny little lights are glowing, wires humming soft and low.") == ["Tiny little lights are glowing,", "wires humming soft and low,"]
    assert [n[1] for n in tune(8, 0, False)] == [.5] * 6 + [.75, 1.25] and tune(6, 1, True)[-1] == (0, 2.25)
    assert len(backing(2, 164)) > SR * BAR * 2
    print("ok")
