// The live data flow. Every stage of the app reports what it just did, with real timings and contents, to the
// Data flow window (flow.html) over a BroadcastChannel. Nothing leaves the browser, and nothing is sent while no
// Data flow window is open: the window says hello every second, and the app only talks while it hears that.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('jaeger-flow') : null;
let heardAt = -1e9, snapshot = () => ({});
const now = () => performance.timeOrigin + performance.now();   // wall-clock ms, the same clock in every window
export const flowOpen = () => performance.now() - heardAt < 2500;

if (channel) channel.onmessage = e => {
  if (e.data?.type !== 'hello') return;
  const first = !flowOpen();
  heardAt = performance.now();
  if (first || e.data.fresh) channel.postMessage({ type: 'snapshot', at: now(), ...snapshot() });
};
// What the window shows in its header: who is on stage and what drives them. app.js supplies it.
export function describe(fn) { snapshot = fn; }
export function resend() { if (flowOpen()) channel.postMessage({ type: 'snapshot', at: now(), ...snapshot() }); }

// stage: mic, stt, agent, perform, tts, speaker, anim, control. data is copied as is, so keep it small and plain.
export function trace(stage, event, data = {}) {
  if (channel && flowOpen()) try { channel.postMessage({ type: 'event', at: now(), stage, event, data }); } catch (e) { console.warn('flow trace', stage, event, e); }
}

// The animation channels themselves, about 15 times a second: what every slider is set to right now.
let lastFrame = 0;
export function channels(rig) {
  const t = performance.now();
  if (!channel || !flowOpen() || t - lastFrame < 66) return;
  lastFrame = t;
  const out = {};
  for (const [k, v] of Object.entries(rig.out)) if (typeof v === 'number') out[k] = Math.round(v * 1000) / 1000;
  const v = rig.voice;
  channel.postMessage({ type: 'channels', at: now(), mode: rig.mode, emotion: rig.emotion, out,
    voice: v ? { open: +(v.open ?? 0).toFixed(3), wide: +(v.wide ?? 0).toFixed(3), round: +(v.round ?? 0).toFixed(3) } : null,
    layers: { gestures: rig.gestures.length, reaction: rig.reaction?.name ?? null, move: rig.act?.name ?? null } });
}
