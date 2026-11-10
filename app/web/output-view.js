// A live view of one simulated hardware stream: exactly the pixels the device receives, shown large and faithful.
// A screen is drawn pixel for pixel (or as round LEDs, for an LED panel); a ring shows its 24 x 1 row and the same
// row laid out as the ring it is on the robot. Used inline under the app and in its own window (output.html).
import { HARDWARE, CHANNEL, STAND_IN } from './hardware.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function mountViewer(host, hw, outId, { size = 256 } = {}) {
  const out = HARDWARE[hw].outputs.find(o => o.id === outId), key = hw + '/' + outId, ring = out.kind === 'ring';
  const box = el('div', 'hwView'), head = el('div', 'tiny', `${HARDWARE[hw].name} · ${out.label} · ${out.w} × ${out.h}`), view = el('canvas'), stats = el('div', 'tiny hwStats', 'Waiting for frames…');
  const native = el('canvas'); native.width = out.w; native.height = out.h;
  const ng = native.getContext('2d'), g = view.getContext('2d');
  let leds = !ring && out.w <= 128;   // a big-pixel panel reads best as round LEDs
  const toggle = el('button', null, leds ? 'Show square pixels' : 'Show as LEDs'); toggle.onclick = () => { leds = !leds; toggle.textContent = leds ? 'Show square pixels' : 'Show as LEDs'; };
  const scale = ring ? Math.max(8, Math.floor(size * 1.6 / out.w)) : Math.max(1, Math.floor(size / out.w));
  if (ring) { view.width = size; view.height = size; } else { view.width = out.w * scale; view.height = out.h * scale; }
  const strip = el('canvas'); strip.width = out.w * scale; strip.height = scale; const sg = strip.getContext('2d');
  box.append(head, view, ...(ring ? [strip] : [toggle]), stats);
  if (!ring) box.append(el('div', 'tiny standIn', STAND_IN));
  host.append(box);

  let frames = 0, last = -1, dropped = 0, t0 = 0, fps = 0, character = '';
  const draw = () => {
    if (ring) {
      sg.imageSmoothingEnabled = false; sg.clearRect(0, 0, strip.width, strip.height); sg.drawImage(native, 0, 0, strip.width, strip.height);
      g.fillStyle = '#05070b'; g.fillRect(0, 0, size, size);
      const d = ng.getImageData(0, 0, out.w, 1).data, r = size * .38;
      for (let i = 0; i < out.w; i++) {
        const a = i / out.w * Math.PI * 2 - Math.PI / 2, x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r, c = `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`;
        g.fillStyle = '#111'; g.beginPath(); g.arc(x, y, size * .045, 0, 7); g.fill();
        g.fillStyle = c; g.shadowColor = c; g.shadowBlur = size * .04; g.beginPath(); g.arc(x, y, size * .035, 0, 7); g.fill(); g.shadowBlur = 0;
      }
    } else if (leds) {
      g.fillStyle = '#05070b'; g.fillRect(0, 0, view.width, view.height);
      const d = ng.getImageData(0, 0, out.w, out.h).data;
      for (let i = 0; i < out.w * out.h; i++) {
        if (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 6) continue;
        g.fillStyle = `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`; g.beginPath(); g.arc((i % out.w + .5) * scale, (Math.floor(i / out.w) + .5) * scale, scale * .42, 0, 7); g.fill();
      }
    } else { g.imageSmoothingEnabled = false; g.drawImage(native, 0, 0, view.width, view.height); }
  };
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = e => {
    const m = e.data; if (m?.key !== key) return;
    ng.putImageData(new ImageData(new Uint8ClampedArray(m.data), m.w, m.h), 0, 0); draw();
    if (last >= 0 && m.seq > last + 1) dropped += m.seq - last - 1;
    last = m.seq; frames++; character = m.character;
    if (!t0) t0 = m.t; else if (m.t - t0 >= 1000) { fps = frames / ((m.t - t0) / 1000); frames = 0; t0 = m.t; }
    stats.textContent = `${character} · ${fps ? fps.toFixed(0) + ' fps' : 'measuring'} · frame ${m.seq} · ${dropped} skipped · ${(m.w * m.h * 4 / 1024).toFixed(m.w * m.h > 4096 ? 0 : 1)} KB a frame`;
  };
  let shown = false;   // the box is put on the page just after this returns; it's gone once it has been shown and removed
  const want = () => { if (box.isConnected) shown = true; else if (shown) { clearInterval(timer); ch.close(); return; } ch.postMessage({ want: key }); };
  const timer = setInterval(want, 500); want();
  return box;
}
