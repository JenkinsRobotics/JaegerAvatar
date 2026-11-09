// Webcam tracking, as a plugin: the page imports this only when someone turns it on, and it only ever sets rig.puppet.
// Adapted from local-avatar-demo/public/js/{puppet,tracking-map,face-worker}.js; see the README's source record.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// MediaPipe's result to the rig's face channels, mirrored: turn to your right and she turns to the viewer's right, as in a mirror.
// The signs were measured by showing the tracker a rendered head at known angles. BLINK_FLOOR and BLINK_RANGE are the knobs if eyes close too easily or not fully.
const BLINK_FLOOR = 0.2, BLINK_RANGE = 0.45, HEAD_GAIN = 1.6;
const closed = b => clamp((b - BLINK_FLOOR) / BLINK_RANGE);
export function faceToPuppet(result) {
  const cats = result?.faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(cats) || cats.some(c => !Number.isFinite(c.score))) return null;
  const b = Object.fromEntries(cats.map(c => [c.categoryName, c.score])), get = n => b[n] ?? 0;
  const out = {
    blinkL: closed(get('eyeBlinkLeft')), blinkR: closed(get('eyeBlinkRight')),
    brow: clamp(get('browInnerUp') - (get('browDownLeft') + get('browDownRight')) * 0.5, -1, 1),
    smile: clamp((get('mouthSmileLeft') + get('mouthSmileRight')) * 0.7),
    jaw: clamp(get('jawOpen') * 1.5), round: clamp(get('mouthPucker') + get('mouthFunnel')), wide: clamp((get('mouthStretchLeft') + get('mouthStretchRight')) * 0.8),
    gazeX: clamp((get('eyeLookOutLeft') - get('eyeLookInLeft') + get('eyeLookInRight') - get('eyeLookOutRight')) * 0.8, -1, 1) * -1,
    gazeY: clamp((get('eyeLookUpLeft') + get('eyeLookUpRight') - get('eyeLookDownLeft') - get('eyeLookDownRight')) * 0.7, -1, 1),
    yaw: 0, pitch: 0, roll: 0,
  };
  const m = result.facialTransformationMatrixes?.[0]?.data;
  if (m && (m.length !== 16 || !Array.from(m).every(Number.isFinite))) return null;
  if (m?.length === 16) {
    out.yaw = clamp(-Math.asin(clamp(m[8], -1, 1)) * HEAD_GAIN, -1, 1);
    out.pitch = clamp(Math.atan2(m[9], m[10]) * HEAD_GAIN, -1, 1);
    out.roll = clamp(Math.atan2(m[1], m[0]) * HEAD_GAIN, -1, 1);
  }
  return out;
}

// Own every resource from initialization through stop; late async work cannot revive a session.
export async function start(rig, status, onStopped = () => {}) {
  const worker = new Worker(new URL('worker.js', import.meta.url));
  let stream, video, tick, closed = false, busy = false, seenAt = 0, zero = null;
  const stop = () => {
    if (closed) return;
    closed = true;
    clearInterval(tick);
    worker.onmessage = worker.onerror = null;
    worker.terminate();
    stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    if (video) { video.pause(); video.srcObject = null; }
    rig.puppet = null;
  };
  const fail = message => {
    if (closed) return;
    stop(); onStopped(); status(message);
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the face tracker took too long to load')), 30000);
      worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message)); };
      worker.onmessage = ({ data }) => { clearTimeout(timer); data.type === 'ready' ? resolve() : reject(new Error(data.message)); };
      worker.postMessage({ type: 'init' });
    });
    worker.onerror = e => fail(`Tracking stopped: ${e.message}`);
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: { ideal: 30, max: 30 } }, audio: false });
    // A worker may fail while the browser's permission prompt is open.
    if (closed) { stream.getTracks().forEach(t => t.stop()); throw new Error('the face tracker stopped during camera startup'); }
    video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: stream });
    await video.play();
    if (closed) throw new Error('the face tracker stopped during camera startup');
    stream.getTracks().forEach(t => { t.onended = () => fail('Camera disconnected. Turn webcam tracking on to reconnect.'); });
    worker.onmessage = ({ data }) => {
      if (closed) return;
      busy = false;
      if (data.type === 'error') return fail(`Tracking stopped: ${data.message}`);
      if (data.type !== 'result') return;
      const face = faceToPuppet(data.result);
      if (face) {
        zero ??= { yaw: face.yaw, pitch: face.pitch, roll: face.roll };
        for (const k in zero) face[k] = clamp(face[k] - zero[k], -1, 1);
        rig.puppet = face; seenAt = performance.now();
        status('Tracking your face. Video stays on this machine.');
      }
    };
    // One frame in flight; stale tracking releases the face to procedural acting.
    tick = setInterval(() => {
      if (closed) return;
      if (performance.now() - seenAt > 500 && rig.puppet) { rig.puppet = null; status('Looking for your face…'); }
      if (busy || video.readyState < 2) return;
      busy = true;
      createImageBitmap(video).then(image => {
        if (closed) { image.close(); return; }
        try { worker.postMessage({ type: 'frame', image, time: performance.now() }, [image]); }
        catch (e) { image.close(); fail(`Tracking stopped: ${e.message}`); }
      }).catch(() => { busy = false; });
    }, 50);
    status('Looking for your face…');
    return stop;
  } catch (e) { stop(); throw e; }
}
