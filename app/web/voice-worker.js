// Audio analysis and the built-in vocals are the longest single jobs on the page, so they run here instead of stalling the drawing.
import { analyze, singOver, synthSing, synthSpeech, synthVocal } from './voice.js';
const JOBS = { analyze, singOver, synthSing, synthSpeech, synthVocal };
self.onmessage = ({ data: { id, job, args } }) => { self.postMessage({ id, result: JOBS[job](...args) }); };
