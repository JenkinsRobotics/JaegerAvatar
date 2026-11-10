// Simulated hardware: the exact video stream each real device would receive, next to the high-resolution digital twin
// on stage. A device is a set of outputs (a face screen, a ring of LEDs as a 24 x 1 row); each is produced at its
// native size every frame and sent to any open stream viewer (output.html). The avatar never writes a device's
// pixels: the device decodes the stream and lights them itself.
// ponytail: hardware is hard-coded here until devices declare themselves; a new device is one more entry.
export const HARDWARE = {
  jp01: { name: 'JP01', outputs: [
    { id: 'face', label: 'Face', w: 64, h: 64, kind: 'screen', note: '64 × 64 LED panel, large pixels' },
    { id: 'ringL', label: 'Left ring', w: 24, h: 1, kind: 'ring', note: '24 RGB LEDs, one row of pixels' },
    { id: 'ringR', label: 'Right ring', w: 24, h: 1, kind: 'ring', note: '24 RGB LEDs, one row of pixels' },
  ] },
  mochi: { name: 'Mochi', outputs: [
    { id: 'face', label: 'Face', w: 256, h: 256, kind: 'screen', note: '256 × 256 screen, dense pixels' },
  ] },
};
// Which device a render is the twin of.
export const hardwareFor = c => c.rep.preset === 'jp01' ? 'jp01' : ['mochi', 'momo'].includes(c.rep.preset) ? 'mochi' : null;
// None of today's packs ships a look made at a device's native size, so the face stream is the twin's screen scaled
// down (area-averaged, as each LED would average it). A pack with its own native look replaces this.
export const STAND_IN = 'Stand-in: the twin\'s screen scaled to native size. No pack ships a look made for this resolution yet.';

export const CHANNEL = 'jaeger-hardware';
const native = {}, wanted = new Map();   // output key -> last time a viewer asked for it
let channel = null, seq = 0;

function shrink(src, w, h) {   // halve until close, then the last step: an average per target pixel, not a nearest sample
  let c = src;
  while (c.width / 2 >= w * 1.5 && c.height / 2 >= h * 1.5) {
    const n = document.createElement('canvas'); n.width = Math.max(w, c.width >> 1); n.height = Math.max(h, c.height >> 1);
    const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); c = n;
  }
  return c;
}
function faceFrame(src, out) {
  const key = out.id + out.w, c = native[key] ??= Object.assign(document.createElement('canvas'), { width: out.w, height: out.h }), g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, out.w, out.h);
  const s = shrink(src, out.w, out.h), k = Math.min(out.w / s.width, out.h / s.height);   // whole screen, letterboxed if its shape differs
  g.imageSmoothingQuality = 'high'; g.drawImage(s, (out.w - s.width * k) / 2, (out.h - s.height * k) / 2, s.width * k, s.height * k);
  return g.getImageData(0, 0, out.w, out.h).data;
}
function ringFrame(leds, out) {
  const d = new Uint8ClampedArray(out.w * 4), off = out.id === 'ringR' ? 24 : 0;
  for (let i = 0; i < out.w; i++) {
    const c = leds?.[off + i]?.material?.color;
    d.set(c ? [c.r * 255, c.g * 255, c.b * 255, 255] : [0, 0, 0, 255], i * 4);
  }
  return d;
}

// Called once per drawn frame with the character on stage and its renderer.
export function publish(c, face) {
  if (!channel) { channel = new BroadcastChannel(CHANNEL); channel.onmessage = e => { if (e.data?.want) wanted.set(e.data.want, performance.now()); }; }
  const hw = hardwareFor(c), now = performance.now();
  if (!hw || ![...wanted.values()].some(t => now - t < 2000)) return;
  const screen = face?.stage?.face ?? face?.eyes?.c;   // the twin's own screen, drawn at high resolution
  seq++;
  for (const out of HARDWARE[hw].outputs) {
    const key = hw + '/' + out.id;
    if (!(now - (wanted.get(key) ?? -1e9) < 2000)) continue;
    const data = out.kind === 'ring' ? ringFrame(face?.stage?.rings, out) : screen ? faceFrame(screen, out) : null;
    if (data) channel.postMessage({ key, w: out.w, h: out.h, seq, t: now, character: c.label, standIn: out.kind === 'screen', data });   // a few KB to a few hundred KB a frame
  }
}
