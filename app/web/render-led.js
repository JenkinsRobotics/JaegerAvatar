// Tier 1. Two display robots with one set of eyes: Mochi on a desk, whose shell never moves, and Vee, a hovering visor.
import { FaceAnimator, drawFace } from './eyes.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const DISPLAY = { mode: 'mouth' };                // mouth, eyes (eyes only) or pixels (Mochi's 128x64 OLED look)
const plainBg = () => document.body.dataset.bg && document.body.dataset.bg !== 'room';

function mouthPath(ctx, cx, cy, w, o, gain = 1) {
  const W = w * (1 + o.wide * 0.35 - o.round * 0.55 + o.smile * 0.2), h = w * o.jaw * 0.85 * gain + o.round * w * 0.18 * gain;
  const curve = o.smile * w * 0.32, sk = o.mouthX * w * 0.25;
  const lx = cx - W + sk, rx = cx + W + sk, ly = cy - curve * 0.6 - o.mouthX * w * 0.12, ry = cy - curve * 0.6 + o.mouthX * w * 0.12;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(cx + sk, cy + curve * 0.55 - h * 0.3, rx, ry);
  ctx.quadraticCurveTo(cx + sk, cy + curve * 0.55 + h * 1.15, lx, ly);
  ctx.closePath();
}

// The display: eyes on their own clear layer, so a surprised ring can punch through them without touching the screen behind.
class EyeLayer {
  constructor() { this.c = document.createElement('canvas'); this.g = this.c.getContext('2d', { willReadFrequently: false }); this.anim = new FaceAnimator(); this.p = null; }
  paint(rig, w, h, dt, { tint = false } = {}) {
    const g = this.g, c = this.c, o = rig.out;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const emotion = rig.attentive && rig.emotion === 'neutral' ? 'listening' : rig.emotion;
    this.p = this.anim.update({ ...o, emotion, moodAge: rig.t - rig.emotionAt, reaction: rig.reaction, energy2: rig.energy }, dt, rig.t);
    const k = w / 1024, color = tint ? `rgb(${clamp(o.tintR, 0, 1) * 255 | 0},${clamp(o.tintG, 0, 1) * 255 | 0},${clamp(o.tintB, 0, 1) * 255 | 0})` : undefined;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    g.setTransform(k, 0, 0, k, 0, (h - 512 * k) / 2);
    drawFace(g, this.p, rig.t, k, color);
    if (DISPLAY.mode !== 'eyes') {
      const p = this.p;
      g.fillStyle = g.strokeStyle = color ?? `rgb(${clamp(p.red, 0, 255) | 0},${clamp(p.green, 0, 255) | 0},${clamp(p.blue, 0, 255) | 0})`;
      g.shadowColor = g.fillStyle; g.shadowBlur = 8 * k;
      mouthPath(g, 512 + p.x * 0.7, 440 + p.y * 0.4, 34, o, 1.3);
      if (o.jaw + o.round < 0.05) { g.lineWidth = 7; g.lineCap = 'round'; g.stroke(); } else g.fill();
      g.shadowBlur = 0;
    }
    return c;
  }
}

// --- Visor --------------------------------------------------------------------
export class VisorFace {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.eyes = new EyeLayer(); }
  draw(rig, W, H, dt = 1 / 60) {
    const ctx = this.ctx, o = rig.out, S = Math.min(W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!plainBg()) {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#d9dce3'); bg.addColorStop(1, '#a8adb9');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    }
    ctx.translate(W / 2 + o.yaw * S * 0.035, H / 2 - o.lift * S * 0.05 + o.pitch * -S * 0.02 + o.crouch * S * 0.05);
    ctx.rotate(o.roll * 0.3);
    ctx.scale(1 + o.lean * 0.05, 1 + o.lean * 0.05);

    // Shell
    const shellW = S * 0.84, shellH = S * 0.72;
    const shell = ctx.createRadialGradient(-S * 0.14, -S * 0.3, S * 0.04, 0, 0, S * 0.65);
    shell.addColorStop(0, '#ffffff'); shell.addColorStop(0.65, '#e4e7ee'); shell.addColorStop(1, '#a7adba');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.ellipse(0, 0, shellW / 2, shellH / 2, 0, 0, Math.PI * 2); ctx.fill();

    // Visor glass, with the eyes behind it
    const vx = o.yaw * S * 0.02, vy = -o.pitch * S * 0.018 + S * 0.01, vw = S * 0.34, vh = S * 0.235;
    const glass = ctx.createLinearGradient(0, -vh, 0, vh);
    glass.addColorStop(0, '#0d1118'); glass.addColorStop(1, '#03050a');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.roundRect(vx - vw, vy - vh, vw * 2, vh * 2, vh * 0.92); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.drawImage(this.eyes.paint(rig, Math.max(1, Math.round(vw * 2)), Math.max(1, Math.round(vh * 2)), dt, { tint: true }), vx - vw, vy - vh, vw * 2, vh * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.ellipse(vx - vw * 0.3, vy - vh * 0.68, vw * 0.55, vh * 0.15, -0.08, 0, Math.PI * 2); ctx.fill();
  }
}

// --- Mochi: the shell and camera never move. All the acting happens on the screen. ---------------
export class OledFace {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.eyes = new EyeLayer();
    this.low = document.createElement('canvas'); this.low.width = 128; this.low.height = 64;
    this.lc = this.low.getContext('2d', { willReadFrequently: true });
    this.hi = document.createElement('canvas'); this.hi.width = 128; this.hi.height = 64;
    this.hc = this.hi.getContext('2d');
    this.img = this.hc.createImageData(128, 64);
  }
  // Exactly where the shell sits, from nothing but the window size.
  shellRect(W, H) {
    const px = Math.max(2, Math.floor(Math.min(W * 0.86 / 128, H * 0.8 / 64))), sw = px * 128, sh = px * 64;
    return { px, sw, sh, x: Math.round((W - sw) / 2), y: Math.round((H - sh) / 2), pad: px * 7 };
  }
  paintShell(W, H, plain) {
    const { px, sw, sh, x, y, pad } = this.shellRect(W, H);
    const c = this.shell ??= document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), L = x - pad, T = y - pad, BW = sw + pad * 2, BH = sh + pad * 2, R = pad * 2.4;
    if (!plain) {
      const room = g.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.5, Math.max(W, H) * 0.72);
      room.addColorStop(0, '#34404a'); room.addColorStop(0.55, '#1b2129'); room.addColorStop(1, '#0c0f14');
      g.fillStyle = room; g.fillRect(0, 0, W, H);
      const floor = g.createRadialGradient(W / 2, T + BH + pad * 1.4, 0, W / 2, T + BH + pad * 1.4, BW * 0.62);
      floor.addColorStop(0, 'rgba(0,0,0,.6)'); floor.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(0, (T + BH + pad * 1.4) * 0.86); g.scale(1, 0.14); g.fillStyle = floor; g.fillRect(0, 0, W, (T + BH + pad * 1.4) * 2); g.restore();
    }
    // Rubber feet
    g.fillStyle = '#3a3531';
    for (const fx of [L + BW * 0.17, L + BW * 0.83 - pad * 3.2]) { g.beginPath(); g.roundRect(fx, T + BH - pad * 0.5, pad * 3.2, pad * 1.25, pad * 0.5); g.fill(); }
    // Ceramic body: lit from above, with a darker lip underneath
    const body = g.createLinearGradient(0, T, 0, T + BH);
    body.addColorStop(0, '#fffaf1'); body.addColorStop(0.5, '#efe7da'); body.addColorStop(0.88, '#d5cabb'); body.addColorStop(1, '#a89d90');
    g.fillStyle = body; g.beginPath(); g.roundRect(L, T, BW, BH, R); g.fill();
    const sheen = g.createLinearGradient(0, T, 0, T + pad * 1.6);
    sheen.addColorStop(0, 'rgba(255,255,255,.85)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen; g.beginPath(); g.roundRect(L + pad * 0.5, T + pad * 0.14, BW - pad, pad * 1.6, [R * 0.8, R * 0.8, 0, 0]); g.fill();
    const edge = g.createLinearGradient(L, 0, L + BW, 0);
    edge.addColorStop(0, 'rgba(90,70,60,.22)'); edge.addColorStop(0.07, 'rgba(90,70,60,0)'); edge.addColorStop(0.93, 'rgba(90,70,60,0)'); edge.addColorStop(1, 'rgba(90,70,60,.26)');
    g.fillStyle = edge; g.beginPath(); g.roundRect(L, T, BW, BH, R); g.fill();
    // Recessed screen
    g.fillStyle = '#a79c8e'; g.beginPath(); g.roundRect(x - px * 3, y - px * 3, sw + px * 6, sh + px * 6, px * 5.5); g.fill();
    g.fillStyle = '#020305'; g.beginPath(); g.roundRect(x - px * 2, y - px * 2, sw + px * 4, sh + px * 4, px * 4); g.fill();
    // Small details under the screen: a status light and a speaker
    const by = y + sh + px * 5;
    g.fillStyle = '#6fe3c8'; g.shadowColor = '#6fe3c8'; g.shadowBlur = px * 2; g.beginPath(); g.arc(L + pad * 1.9, by, px * 0.7, 0, 7); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#9d9184';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(L + BW - pad * 1.9 - i * px * 2.2, by - px * 0.5, px * 1.2, px, px * 0.5); g.fill(); }
  }
  draw(rig, W, H, dt = 1 / 60) {
    const ctx = this.ctx, { px, sw, sh, x, y } = this.shellRect(W, H);
    // The shell never changes, so it's painted once per size and only stamped after that.
    const plain = !!plainBg(), key = `${W}x${H}/${plain}`;
    if (this.shellKey !== key) { this.shellKey = key; this.paintShell(W, H, plain); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.shell, 0, 0);

    const layer = this.eyes.paint(rig, sw, sh, dt);
    if (DISPLAY.mode !== 'pixels') { ctx.drawImage(layer, x, y); return; }

    // The OLED look: the same eyes, thresholded to 1 bit at 128x64 and scaled up with visible pixels.
    this.lc.clearRect(0, 0, 128, 64); this.lc.drawImage(layer, 0, 0, 128, 64);
    const src = this.lc.getImageData(0, 0, 128, 64).data, dst = this.img.data;
    for (let i = 0; i < src.length; i += 4) {
      const on = src[i + 3] > 110 && src[i] + src[i + 1] + src[i + 2] > 180;
      dst[i] = on ? 176 : 3; dst[i + 1] = on ? 238 : 5; dst[i + 2] = on ? 255 : 8; dst[i + 3] = 255;
    }
    this.hc.putImageData(this.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.3; ctx.filter = `blur(${px * 1.6}px)`;
    ctx.drawImage(this.hi, x, y, sw, sh);
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.hi, x, y, sw, sh);
    if (px >= 3) {
      ctx.fillStyle = 'rgba(2,3,5,0.62)';
      for (let i = 1; i < 128; i++) ctx.fillRect(x + i * px - 1, y, 1, sh);
      for (let i = 1; i < 64; i++) ctx.fillRect(x, y + i * px - 1, sw, 1);
    }
  }
}
