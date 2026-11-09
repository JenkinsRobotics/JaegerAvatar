// Live mic lip sync, for performing as the character: your voice moves her mouth. Loaded only when turned on. Nothing is recorded or sent.
// The idea comes from local-avatar-demo/public/js/tracking-map.js; see the README's source record.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// One moment of microphone sound as the mouth shapes the rig understands. spectrum is in decibels, as an AnalyserNode gives it.
export function mouthFrom(samples, spectrum, sampleRate) {
  let e = 0;
  for (const s of samples) e += s * s;
  const rms = Math.sqrt(e / samples.length), unit = sampleRate / (spectrum.length * 2);
  const band = (lo, hi) => { let sum = 0; for (let i = Math.floor(lo / unit); i < Math.min(spectrum.length, hi / unit); i++) sum += 10 ** (spectrum[i] / 20); return sum; };
  const low = band(200, 900), mid = band(1500, 3000), hiss = band(4000, 8000), level = clamp((rms - 0.012) * 9);
  const round = low > mid * 2.7 ? 1 : 0, teeth = clamp(hiss / (low + mid + hiss + 1e-6) * 2 - 0.3) * clamp(level * 3);
  return { open: level * (round ? 0.55 : 0.9) * (1 - teeth * 0.7), wide: round ? 0 : clamp(mid / (low + 1e-6)) * level, round: round * level, teeth, energy: level, pitch: 0 };
}

// ctx: the page's AudioContext. Returns { read, stop }.
export async function start(ctx) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  const analyser = ctx.createAnalyser(), source = ctx.createMediaStreamSource(stream);
  analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.35;
  source.connect(analyser);                 // never connected onward, so you don't hear yourself
  const samples = new Float32Array(1024), spectrum = new Float32Array(512);
  return {
    read() { analyser.getFloatTimeDomainData(samples); analyser.getFloatFrequencyData(spectrum); return mouthFrom(samples, spectrum, ctx.sampleRate); },
    stop() { source.disconnect(); stream.getTracks().forEach(t => t.stop()); },
  };
}
