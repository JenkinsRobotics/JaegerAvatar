// JP01's face with no browser: the control state in (avatar-state/v1: feeling, reaction, gaze, speaking, jaw), the real
// panel's pixels out. Everything it uses is arithmetic (eyes.js, jp01.js), so it runs in Node on a robot exactly as it
// runs in the page: the same animator, the same wake-up, the same look made for the panel.
// ponytail: the state-to-face mapping is also written out in embedded/embedded.js (Mochi's page); share it when either changes.
import { FACE_MOODS, REACTIONS, FaceAnimator } from './eyes.js';
import { FACES, GRID, WAKE, RING_LEDS, wakeFace, ringLevels } from './jp01.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), KEYS = Object.keys(REACTIONS);

export class PanelFace {
  // layout: how the face sits on JP01's square screen (the twin's own numbers, renderer.js faceLayout).
  constructor({ face = 'mochi_wave', layout = { scale: 1.55, spread: .8 } } = {}) {
    if (!FACES[face]?.native) throw new Error(`The face "${face}" has no look made for the panel`);
    Object.assign(this, { look: FACES[face], layout, animator: new FaceAnimator(), mood: 'neutral', moodAt: 0, reactionSeq: 0, reactionAt: 0, bootAt: null, last: null });
  }

  // One frame. state: the latest avatar-state/v1 snapshot, or null when nobody is driving (the face rests, neutral).
  // t: seconds on any steady clock. Returns { face: 64 x 64 x 3 bytes of RGB, row by row; ring: 24 x 3 bytes }.
  frame(state, t) {
    const dt = this.last == null ? 0 : clamp(t - this.last, 0, .05);
    this.last = t; this.bootAt ??= t;
    const mood = FACE_MOODS.includes(state?.emotion) ? state.emotion : 'neutral', seq = state?.reaction_seq || 0;
    if (mood !== this.mood) { this.mood = mood; this.moodAt = t; }
    if (seq !== this.reactionSeq) { this.reactionSeq = seq; this.reactionAt = t; }
    const reaction = KEYS.includes(state?.reaction) ? state.reaction : '', progress = reaction ? clamp((t - this.reactionAt) / REACTIONS[reaction].duration) : 0;
    const jaw = state?.speaking ? clamp(state.jaw || 0) : 0;
    const v = { jaw, faceMood: FACE_MOODS.indexOf(mood) / (FACE_MOODS.length - 1), faceMoodAge: t - this.moodAt, faceEnergy: 1,
      faceReaction: reaction ? (KEYS.indexOf(reaction) + 1) / KEYS.length : 0, faceProgress: progress, gazeX: state?.gaze?.[0] || 0, gazeY: state?.gaze?.[1] || 0 };
    const wake = reaction === 'wake' ? progress * WAKE : t - this.bootAt < WAKE ? t - this.bootAt : null;   // as the twin wakes (renderer.js wakeAge)
    const p = wakeFace(this.animator.update(v, dt, t), wake), P = this.look.native(p, jaw, { mood, reaction, t, v, layout: this.layout });
    const face = new Uint8Array(GRID * GRID * 3), ring = new Uint8Array(RING_LEDS * 3);
    for (let i = 0; i < GRID * GRID; i++) face.set(P.data.subarray(i * 4, i * 4 + 3), i * 3);
    const colour = this.look.ring || [p.red, p.green, p.blue];
    ringLevels(wake, t, jaw).forEach((level, i) => ring.set(colour.map(c => clamp(c, 0, 255) * level), i * 3));
    return { face, ring };
  }
}
