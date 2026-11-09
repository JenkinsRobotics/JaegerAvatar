// A classic worker, so MediaPipe's blocking WASM inference stays off the thread that draws. Frames stay in this browser.
self.exports = {};
importScripts('vision_bundle.js');
let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FaceLandmarker, FilesetResolver } = self.exports;
      const files = await FilesetResolver.forVisionTasks(new URL('wasm', location.href).href);
      tracker = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: new URL('face_landmarker.task', location.href).href, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && tracker) {
      try { self.postMessage({ type: 'result', result: tracker.detectForVideo(data.image, data.time) }); } finally { data.image.close(); }
    }
  } catch (e) { self.postMessage({ type: 'error', message: e.message }); }
};
