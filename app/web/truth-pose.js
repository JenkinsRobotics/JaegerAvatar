// Truth's body: a joint skeleton posed by keyframes and settled by springs, drawn by render-truth.js.
// The kneel is measured from the reference sculpt (jaeger_sculpted's card, 415 px = 1 head = 1 unit): one knee
// up with the forearm lying across it and the hand hanging, the other leg folded under, a hand flat on the floor.
// Stand and sit are visits; Truth always settles back to the kneel. Floor at y 0, Truth faces +z, x is screen right.
export const JOINTS = ['pelvis', 'chest', 'neck', 'shL', 'elL', 'wrL', 'hdL', 'shR', 'elR', 'wrR', 'hdR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR', 'cam', 'head'];
const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));

const KNEEL = {
  pelvis: [.07, .33, -.02], chest: [.05, .86, 0], neck: [.02, 1.2, .03],
  shL: [-.34, 1.07, .03], elL: [-.68, .93, .36], wrL: [-.2, .92, .52], hdL: [-.15, .7, .58],    // across the knee, hand hanging
  shR: [.31, 1.05, 0], elR: [.5, .6, .02], wrR: [.72, .17, .1], hdR: [.95, .07, .2],          // propped, hand flat on the floor
  hipL: [-.12, .35, .06], knL: [-.46, .74, .46], anL: [-.66, .12, .5],                         // the raised knee
  hipR: [.17, .3, 0], knR: [.48, .2, .4], anR: [.02, .08, -.2],                                 // the leg folded under
  cam: [0, 0, 0], head: [.04, .14, 0],                                                           // head: roll, pitch (down), yaw
};
const SIT = {
  pelvis: [0, .32, -.06], chest: [0, .86, -.08], neck: [0, 1.2, -.05],
  shL: [-.34, 1.06, -.06], elL: [-.4, .8, .38], wrL: [-.1, .74, .58], hdL: [-.02, .7, .66],      // arms round the knees
  shR: [.34, 1.06, -.06], elR: [.4, .8, .38], wrR: [.1, .74, .58], hdR: [.02, .7, .66],
  hipL: [-.14, .3, 0], knL: [-.22, .7, .4], anL: [-.22, .08, .62],
  hipR: [.14, .3, 0], knR: [.22, .7, .4], anR: [.22, .08, .62],
  cam: [0, 0, 0], head: [0, .18, 0],
};
const STAND = {
  pelvis: [0, 1.36, 0], chest: [0, 1.84, .02], neck: [0, 2.16, .03],
  shL: [-.34, 2.02, .02], elL: [-.4, 1.55, .04], wrL: [-.42, 1.07, .1], hdL: [-.43, .87, .12],
  shR: [.34, 2.02, .02], elR: [.4, 1.55, .04], wrR: [.42, 1.07, .1], hdR: [.43, .87, .12],
  hipL: [-.15, 1.32, 0], knL: [-.16, .7, .06], anL: [-.16, .07, 0],
  hipR: [.15, 1.32, 0], knR: [.16, .7, .06], anR: [.16, .07, 0],
  cam: [0, .45, 1.6], head: [0, .04, 0],
};
export const BASES = { kneel: KNEEL, sit: SIT, stand: STAND };
// Bone lengths, measured on the kneel. Every pose is pulled to them, so limbs never stretch or shrink mid-move.
const CHAINS = [[['shL', 'elL', .49], ['elL', 'wrL', .49], ['wrL', 'hdL', .22]], [['shR', 'elR', .49], ['elR', 'wrR', .49], ['wrR', 'hdR', .22]],
  [['hipL', 'knL', .64], ['knL', 'anL', .64]], [['hipR', 'knR', .64], ['knR', 'anR', .64]]];
export const BONES = CHAINS.flat();
function keepLengths(p) {
  for (const chain of CHAINS) for (const [a, b, len] of chain) {
    const i = J[a] * 3, k = J[b] * 3, d = [p[k] - p[i], p[k + 1] - p[i + 1], p[k + 2] - p[i + 2]], n = Math.hypot(...d) || 1;
    for (let c = 0; c < 3; c++) p[k + c] = p[i + c] + d[c] / n * len;
  }
  return p;
}
const env = (u, a = .15, b = .2) => Math.max(0, Math.min(1, u / a, (1 - u) / b));
const add = (p, j, v, w = 1) => { for (let k = 0; k < 3; k++) p[J[j] * 3 + k] += v[k] * w; };
const set = (p, j, v, w = 1) => { for (let k = 0; k < 3; k++) p[J[j] * 3 + k] += (v[k] - p[J[j] * 3 + k]) * w; };
const at = (p, j) => [p[J[j] * 3], p[J[j] * 3 + 1], p[J[j] * 3 + 2]];
const shiftUpper = (p, d, arms = .6) => {
  for (const j of ['chest', 'neck', 'shL', 'shR']) add(p, j, d);
  for (const j of ['elL', 'elR']) add(p, j, d, arms);
};

// Moves on top of the base pose: fn(pose, u 0..1, t seconds since start).
export const MOVES = {
  clap: { label: 'Clap', icon: '✦', dur: 3.2, fn(p, u, t) {
    const e = env(u, .12, .18), c = at(p, 'chest'), open = .5 + .5 * Math.cos(t * Math.PI * 2 * 2.4);
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'L' : 'R', x = c[0] + s * (.03 + .17 * open);
      set(p, 'el' + side, [c[0] + s * .32, c[1] - .14, c[2] + .2], e);                     // forearms reach so the bones keep their length
      set(p, 'wr' + side, [x, c[1] - .02, c[2] + .6], e); set(p, 'hd' + side, [x - s * .015, c[1] + .16, c[2] + .7], e);
    }
    add(p, 'head', [0, -.07 * Math.sin(t * 15) * e, 0]);
  } },
  lean: { label: 'Lean back', icon: '↶', dur: 4, fn(p, u) {
    const e = env(u, .25, .3);
    shiftUpper(p, [0, -.05 * e, -.24 * e]);
    set(p, 'elR', [.46, .46, -.2], e); set(p, 'wrR', [.58, .1, -.36], e); set(p, 'hdR', [.66, .06, -.58], e);   // the floor hand props behind
    add(p, 'head', [0, -.3 * e, 0]);
  } },
  sway: { label: 'Sway', icon: '↔', dur: 4.4, fn(p, u, t) {
    const e = env(u, .15, .2), s = Math.sin(t * Math.PI) * e;
    shiftUpper(p, [.13 * s, -.015 * Math.abs(s), 0]); add(p, 'wrL', [.06 * s, 0, 0]); add(p, 'hdL', [.06 * s, 0, 0]);
    add(p, 'head', [-.18 * s, 0, .08 * s]);
  } },
  stand: { label: 'Stand', icon: '↑', dur: 8, base: 'stand' },
  sit: { label: 'Sit', icon: '↓', dur: 8, base: 'sit' },
  kneel: { label: 'Kneel', icon: '◟', dur: .1, base: 'kneel' },
};

export class TruthBody {
  constructor() {
    this.cur = Float32Array.from(JOINTS.flatMap(j => KNEEL[j])); this.vel = new Float32Array(this.cur.length);
    this.moves = []; this.base = 'kneel'; this.until = 0;
  }
  get poses() { return Object.keys(MOVES); }
  play(name, t) {
    const m = MOVES[name]; if (!m) return;
    if (m.base) { this.base = m.base; this.until = m.base === 'kneel' ? 0 : t + m.dur; }   // a visit: back to the kneel after
    else this.moves = [...this.moves.filter(x => x.name !== name), { name, start: t }];
  }
  // The target pose for time t, with the rig's continuous channels (breath, lean, sway, talking hand, wave).
  target(o, t) {
    if (this.until && t > this.until) { this.base = 'kneel'; this.until = 0; }
    const B = BASES[this.base], p = Float32Array.from(JOINTS.flatMap(j => B[j]));
    shiftUpper(p, [(o.roll || 0) * .12 + Math.sin(t * .37) * .015, Math.sin(t * 1.4) * .012 + (o.lift || 0) * .04 - (o.crouch || 0) * .05, (o.lean || 0) * .08], .5);
    if (this.base === 'kneel') { const h = o.hand || 0; add(p, 'wrL', [0, h * .05, h * .04]); add(p, 'hdL', [.03 * h, h * .14, h * .1]); }   // the hanging hand lifts as Truth talks
    if (o.wave > .01) {
      const e = Math.min(1, o.wave), sh = at(p, 'shR'), x = sh[0] + .38 + .12 * Math.sin(t * 10);
      set(p, 'elR', [sh[0] + .32, sh[1] + .1, sh[2] + .08], e); set(p, 'wrR', [x, sh[1] + .5, sh[2] + .12], e); set(p, 'hdR', [x + .02, sh[1] + .7, sh[2] + .12], e);
    }
    this.moves = this.moves.filter(m => t - m.start < MOVES[m.name].dur);
    for (const m of this.moves) MOVES[m.name].fn(p, (t - m.start) / MOVES[m.name].dur, t - m.start);
    return keepLengths(p);
  }
  // Springs carry each joint to its target, so changes of pose arrive with weight instead of snapping.
  step(o, t, dt) {
    const p = this.target(o, t), K = 60, C = 2 * .9 * Math.sqrt(K), h = Math.min(dt, 1 / 30);
    for (let i = 0; i < p.length; i++) { this.vel[i] += (K * (p[i] - this.cur[i]) - C * this.vel[i]) * h; this.cur[i] += this.vel[i] * h; }
    return keepLengths(this.cur);   // the springs blend positions; the bones stay their length
  }
}
