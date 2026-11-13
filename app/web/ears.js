// The microphone: finds where someone starts and stops talking, then hands the words to the Whisper model on the local server.
// Audio only leaves the page to reach localhost. Vad and isEcho use no browser APIs, so `node test.mjs` can check them.
export const RATE = 16000, FRAME = 480;   // 30 ms frames
const frames = s => Math.round(s * RATE / FRAME);
const START = frames(0.15), PAUSE = frames(0.35), END = frames(0.65), PRE = frames(0.35), MIN = frames(0.25), MAX = frames(20);
const QUIET_GATE = 0.012, OVER_FLOOR = 3.5, STRICT = 3;

// Feed it frames in order. Returns 'start', 'pause' (a gap, maybe the end: read .audio for the words so far), 'resume' (it wasn't the end),
// 'cancel' (too short to be speech), 'end' (read .audio) or null. strict: her voice is playing, so only something clearly louder counts as a new start.
export class Vad {
  floor = 0.002; on = false; loud = 0; pre = []; heard = []; voiced = 0; quiet = 0; audio = null;
  push(x, strict = false) {
    let e = 0;
    for (const s of x) e += s * s;
    const level = Math.sqrt(e / x.length), gate = Math.max(QUIET_GATE, this.floor * OVER_FLOOR);
    if (!this.on) {
      const hit = level > gate * (strict ? STRICT : 1);
      if (level < gate) this.floor += (level - this.floor) * (level < this.floor ? 0.2 : 0.02);
      this.pre.push(x);
      if (this.pre.length > PRE) this.pre.shift();
      this.loud = hit ? this.loud + 1 : 0;
      if (this.loud < START) return null;
      this.on = true; this.heard = this.pre; this.pre = []; this.voiced = this.loud; this.quiet = 0; this.loud = 0;
      return 'start';
    }
    this.heard.push(x);
    if (level > gate * 0.6) { const back = this.quiet >= PAUSE; this.voiced++; this.quiet = 0; if (back) return 'resume'; } else this.quiet++;
    if (this.quiet === PAUSE) { this.audio = join(this.heard); return 'pause'; }
    if (this.quiet < END && this.heard.length < MAX) return null;
    if (this.heard.length >= MAX) this.floor = Math.max(this.floor, level);   // a sound that never stops is the room, not a person
    this.on = false;
    const enough = this.voiced >= MIN;
    this.audio = enough ? join(this.heard) : null;
    this.heard = [];
    return enough ? 'end' : 'cancel';
  }
}
function join(chunks) {
  const out = new Float32Array(chunks.length * FRAME);
  chunks.forEach((c, i) => out.set(c, i * FRAME));
  return out;
}

// Her own voice leaking from the speakers into the mic comes back as her own words. Real interruptions don't.
const words = s => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
export function isEcho(heard, said) {
  const w = words(heard), own = new Set(words(said));
  return !w.length || w.filter(x => own.has(x)).length / w.length >= 0.75;
}

const WORKLET = `registerProcessor('mic', class extends AudioWorkletProcessor { process([[x]]) { if (x) this.port.postMessage(x.slice()); return true; } })`;

// on: { start, pause(Float32Array), resume, cancel, end(Float32Array), frame(Float32Array, event)? }. strict() says whether her voice is playing right now.
let worklet = null;   // a processor name can only be registered once per page
export async function openMic(ctx, on, strict) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  await (worklet ??= ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))));
  const src = ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(ctx, 'mic'), mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(node).connect(mute).connect(ctx.destination);   // silent, but only a connected node is sure to keep running
  const vad = new Vad(), step = ctx.sampleRate / RATE;
  let frame = new Float32Array(FRAME), n = 0, sum = 0, got = 0, pos = 0;
  node.port.onmessage = ({ data }) => {
    for (const s of data) {                                    // average down to 16 kHz
      sum += s; got++;
      if (++pos < step) continue;
      pos -= step;
      frame[n++] = sum / got; sum = got = 0;
      if (n < FRAME) continue;
      const event = vad.push(frame, strict());
      on.frame?.(frame, event);                                // the voice loop listens on its own: it is offered every frame
      frame = new Float32Array(FRAME); n = 0;                  // the Vad keeps the old one
      if (event === 'end' || event === 'pause') on[event](vad.audio);
      else if (event) on[event]();
    }
  };
  return () => { stream.getTracks().forEach(t => t.stop()); node.port.onmessage = null; src.disconnect(); node.disconnect(); mute.disconnect(); };
}

// Float samples to what /hear wants: 16-bit PCM.
export function toPcm(x) {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
  return out;
}

// The other way: the voice loop's sound (base64, 16-bit) back as samples.
export function fromPcm(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return Float32Array.from(new Int16Array(bytes.buffer, 0, bytes.length >> 1), v => v / 32768);
}

// What the voice loop gets to hear. It listens on its own, so it gets every frame while she is quiet. While she talks it
// gets nothing (it would hear her), until the Vad says someone is talking over her: then the last 0.6 s and on until they stop.
// push returns the frames to send now. Frames held while she talked are dropped when she stops: they are her last words.
const HOLD = frames(0.6);
export class Gate {
  held = []; open = false;
  push(frame, talking, event) {
    if (event === 'start') this.open = true;
    let out = [frame];
    if (this.open) out = [...this.held, frame];
    else if (talking) { out = []; this.held.push(frame); if (this.held.length > HOLD) this.held.shift(); }
    if (out.length) this.held = [];
    if (event === 'end' || event === 'cancel') this.open = false;
    return out;
  }
}
