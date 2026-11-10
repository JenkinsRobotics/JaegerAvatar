// The exhibit under the stage: each avatar doubles as a lesson in one way of animating a character.
// It says how the shown render moves, lays out a face sheet (every feeling, reaction and mouth at its setpoint),
// and shows the files the pack ships: sprite sheets played frame by frame, bitmaps, GIFs, clips and images.
// The face sheet is a preview drawn by the character's own renderer; the live animation never reads it.
import { Rig, EMOTIONS } from './rig.js';
import { REACTIONS } from './eyes.js';

// How each style works, in plain words. `moves` is what drives it; `good` and `hard` are its trade-offs.
export const STYLES = {
  led: { name: 'Procedural screen face', moves: 'Code, every frame',
    how: 'Nothing here is a picture. Each eye is one outline of 64 points, and every feeling is a set of numbers for it: width, height, curve, tilt, a heart or star blend. Springs carry the numbers from one feeling to the next, so the shape morphs instead of swapping, and the mouth follows the voice.',
    good: 'Tiny, sharp at any size, never repeats exactly, any feeling can interrupt any other.', hard: 'Every new look is code to write, not art to draw.' },
  screen3d: { name: 'Modelled body, procedural face', moves: 'Code drives the face; the body is a 3D model',
    how: 'The body is a 3D model the renderer lights and turns. Its screen is a drawing surface: the same procedural face as the flat screen robots is painted onto it every frame and wrapped onto the model.',
    good: 'A real object you can turn, with a face that stays crisp and expressive.', hard: 'Needs a 3D renderer; the body itself only moves where it has joints.' },
  sdf: { name: 'Code-built 3D (raymarched)', moves: 'Code: maths shapes and a skeleton',
    how: 'There is no mesh and no texture. The body is made of mathematical shapes (spheres, capsules, cones) melted together, and the graphics card works out every pixel by stepping a ray into them. Feelings and speech change the numbers that size and place each shape; a skeleton of joints poses the body.',
    good: 'Every expression is continuous, the files are tiny, and the shapes can be anything you can describe.', hard: 'Needs a real GPU, and hand-tuning shapes to match a reference is slow.' },
  anime: { name: '3D drawn as 2D (cel and ink)', moves: 'Code: one 3D body, flattened',
    how: 'One true 3D character, shaded with two hard tones and outlined by an ink pass. The head is squashed toward the camera, the trick used by anime-style games, so it reads as a flat drawing from every angle while turning like a solid.',
    good: 'Turns without breaking proportions, which layered 2D art cannot do.', hard: 'Needs a GPU; the drawn look depends on careful tuning.' },
  vector: { name: 'Procedural vector drawing', moves: 'Code: 2D shapes',
    how: 'A flat drawing made of curves the code draws each frame: head, hair, eyes, brows and mouth are paths whose points come from the rig, so every expression and every mouth shape is drawn fresh.',
    good: 'Light enough for anything, resolution-free, every part responds.', hard: 'Only faces the front; detail costs code.' },
  vrm: { name: 'Artist-made 3D model', moves: 'A sculpted model with bones and blend shapes',
    how: 'An artist built this as a mesh with textures, a skeleton and blend shapes: sculpted copies of the face for each mouth and eye pose. The rig sets bone angles and how much of each blend shape to mix in, so the art does the looking and the code does the timing.',
    good: 'Looks as good as the artist made it; the standard format works in Blender and games.', hard: 'Each new expression has to be sculpted, and the file is large.' },
  image: { name: 'Still image', moves: 'Nothing; it is one picture',
    how: 'A single drawn or rendered picture, shown as it is. It is what the character looks like at its best, used for the library card and for previews.',
    good: 'Exactly what the artist intended.', hard: 'Cannot change expression, talk or turn.' },
  video: { name: 'Pre-recorded clips', moves: 'Playback of recorded frames',
    how: 'Each expression was animated or filmed ahead of time and saved as a short video. The player picks the clip that fits the moment and plays it; talking switches between an open- and closed-mouth version.',
    good: 'Any look at all, with every frame exactly as made.', hard: 'Only the moments someone recorded; large files; nothing in between.' },
  sprite: { name: 'Sprite sheet', moves: 'Frames picked from a grid',
    how: 'One image holds a grid of frames. The player shows one cell at a time: a cell per expression, a row per mouth state, and short strips of frames that play in order to get from one expression to another.',
    good: 'Exact pixel art, cheap to show on small screens and LED matrices.', hard: 'Only the frames drawn; smoothness costs more frames.' },
  gif: { name: 'Animated GIF', moves: 'A looped strip of frames',
    how: 'A GIF is a sprite sheet stored as a looping animation: every frame is a whole picture, played at a fixed speed, over and over.',
    good: 'Plays anywhere with no code at all.', hard: 'One loop only; it cannot react, talk or change feeling.' },
  bitmap: { name: 'Bitmap faces', moves: 'Pixel maps swapped by name',
    how: 'Each face is a grid of on/off pixels sized for a tiny display, for example 72 x 32. The player shows the bitmap named for the moment (neutral, happy, closed, looking down) and swaps between them.',
    good: 'Fits the smallest, cheapest screens and microcontrollers.', hard: 'Blocky, and it jumps between faces instead of moving.' },
  math: { name: 'Procedural script (robot side)', moves: 'A program on the robot',
    how: 'A small program that draws the face from formulas on the robot itself. The library keeps it as a source; it is not run in this page, which never executes pack code.',
    good: 'Endless variety from very little code.', hard: 'Has to run on the device; not previewable here.' },
  look: { name: 'Screen look', moves: 'Settings for a procedural screen',
    how: 'Not a body: a frozen set of style settings (eye shape, mouth shape, colours) that any display robot can wear. The same character looks identical on every screen that wears it.',
    good: 'Locked by fingerprints, so it never drifts.', hard: 'Needs a body with a screen to show on.' },
};
const ADAPTER = { 'nori-led': 'led', 'kin-momo': 'screen3d', 'nori-3d': 'sdf', 'nori-anime': 'anime', 'jaeger-study': 'vector', 'nori-vrm': 'vrm', 'kin-vrm': 'vrm',
  sprite: 'sprite', gif: 'gif', bitmap: 'bitmap', math: 'math', video: 'video', image: 'image', 'screen-face': 'look' };
export const styleOf = rep => rep.adapter === 'media' ? (rep.mediaType === 'video' ? 'video' : /\.gif$/i.test(rep.asset ?? '') ? 'gif' : rep.exhibit?.kind === 'sprite_sheet' ? 'sprite' : 'image')
  : ADAPTER[rep.adapter] ?? (rep.exhibit?.kind === 'sprite_sheet' ? 'sprite' : rep.exhibit?.kind === 'clip_set' ? 'video' : 'image');
export const LIVE = new Set(['led', 'screen3d', 'sdf', 'anime', 'vector', 'vrm']);   // drawn by code from the rig, so they get a face sheet

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// The panel for the render on show.
export function styleCard(rep) {
  const s = STYLES[styleOf(rep)], card = el('div', 'style');
  card.append(el('div', 'tiny', 'How this is animated'), el('h4', null, s.name), el('p', null, s.how));
  const dl = el('dl');
  for (const [k, v] of [['Moved by', s.moves], ['Good at', s.good], ['Hard part', s.hard]]) dl.append(el('dt', null, k), el('dd', null, v));
  card.append(dl);
  return card;
}

// --- The face sheet ---------------------------------------------------------------
const PEAK = { blink: .1, wink: .6, sideeye: 1.2, sparkle: 1.2, heart: 1.4, roll: .9, peek: .8, doze: 2.2, groove: 1.3, wake: .6 };
const V = o => ({ open: 0, wide: 0, round: 0, teeth: 0, energy: .7, pitch: 0, shut: 0, tuck: 0, ...o });
export const MOUTHS = [['rest', null], ['"aa"', V({ open: .75, vowels: { aa: .8 } })], ['"ee"', V({ open: .32, wide: .9, vowels: { ee: .8 } })],
  ['"oo"', V({ open: .3, round: .9, vowels: { ou: .8 } })], ['m / b / p', V({ open: .7, shut: 1 })], ['f / v', V({ open: .7, tuck: 1 })]];
export function settled({ emotion = 'neutral', reaction, voice } = {}) {
  const r = new Rig(); r.setEmotion(emotion);
  const hold = () => { r.nextBlink = 1e9; r.look(0, 0); };   // no blinks, eyes to the front
  for (let i = 0; i < 180; i++) { hold(); r.tick(1 / 60); }
  if (voice) { r.voice = voice; for (let i = 0; i < 40; i++) { hold(); r.tick(1 / 120); } }
  if (reaction) { r.react(reaction); for (let a = 0; a < PEAK[reaction]; a += 1 / 60) { hold(); r.tick(1 / 60); } }
  return r;
}
export const sheetCells = () => [
  ...Object.keys(EMOTIONS).map(n => ['Feelings', n, { emotion: n }]),
  ...Object.keys(REACTIONS).map(n => ['Reactions', n, { reaction: n }]),
  ...MOUTHS.map(([n, v]) => ['Mouth shapes', n, { voice: v }]),
];

// Draws every cell with a second, hidden copy of the character's renderer, one cell per frame so the page keeps moving.
// `live` is the face on stage, so the copy wears the same screen style.
export async function faceSheet(c, live, host, { W = 300, H = 190 } = {}) {
  const work = el('div', 'sheetWork'), canvas = el('canvas'), ov = el('canvas', 'ov');   // the stage's panes have an overlay canvas too
  work.append(canvas, ov); document.body.append(work);
  const out = [];
  let f;
  try {
    f = c.make(canvas, ov);
    if (f.stage) { f.stage.bootAt = -Infinity; if (live?.stage) f.stage.faceStyle = live.stage.faceStyle; }   // already awake (JP01 boots for 2 s), same screen style
    await Promise.race([f.loaded, new Promise(r => setTimeout(r, 15000))]);
    let section = null;
    for (const [group, name, setpoint] of sheetCells()) {
      if (!host.isConnected) break;   // the avatar changed while drawing
      if (group !== section) { section = group; host.append(el('div', 'tiny sheetHead', group)); }
      const r = settled(setpoint);
      if (!f.gl) { canvas.width = W; canvas.height = H; }
      for (let i = 0; i < 12; i++) { r.t += .1; f.draw(r, W, H, .1); }   // time runs so swaps and flickers finish; the pose stays
      const cell = el('figure'), shot = el('canvas'); shot.width = W; shot.height = H;
      const src = f.stage?.face ?? canvas, g = shot.getContext('2d');   // a screen robot's sheet is its screen
      g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);
      const k = Math.min(W / src.width, H / src.height); g.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);
      cell.append(shot, el('figcaption', null, name)); host.append(cell); out.push([group, name, shot]);
      await new Promise(r => requestAnimationFrame(r));
    }
  } finally {
    f?.dispose?.(); f?.suspend?.();
    if (f?.gl) for (const kind of ['webgl2', 'webgl']) {   // free the copy's GPU context; asking for the other kind would fire an error
      const gl = canvas.getContext(kind); if (gl) { gl.getExtension('WEBGL_lose_context')?.loseContext(); break; }
    }
    work.remove();
  }
  return out;
}

// One picture of the whole sheet, for keeping or sharing.
export function sheetPng(cells, title) {
  const cols = 8, w = 300, h = 190, cap = 22, head = 40, rows = Math.ceil(cells.length / cols), c = el('canvas');
  c.width = cols * w; c.height = head + rows * (h + cap); const g = c.getContext('2d');
  g.fillStyle = '#0b0d12'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#e6e9ef'; g.font = '600 22px system-ui'; g.fillText(title, 12, 28);
  g.font = '15px system-ui'; g.textAlign = 'center';
  cells.forEach(([group, name, shot], i) => { const x = (i % cols) * w, y = head + Math.floor(i / cols) * (h + cap); g.drawImage(shot, x, y, w, h); g.fillText(name, x + w / 2, y + h + 16); });
  return c.toDataURL('image/png');
}

// --- The files a pack ships -------------------------------------------------------
// A sprite sheet: the whole grid with its cells named, and a player that steps through a strip's frames.
function spriteSheet(file) {
  const p = file.props ?? {}, [cols, rows] = p.grid ?? [1, 1], img = new Image(), wrap = el('div', 'asset sprite');
  img.src = file.url; img.alt = file.name;
  const names = Object.entries(p.cells ?? p.frames ?? {}).sort((a, b) => a[1] - b[1]).map(([n]) => n);
  const view = el('canvas'); view.width = view.height = 128;
  const g = view.getContext('2d'); g.imageSmoothingEnabled = p.scaling !== 'nearest';
  let frame = 0, timer = 0;
  const show = i => { frame = i; const cw = img.naturalWidth / cols, ch = img.naturalHeight / rows; g.clearRect(0, 0, 128, 128); g.drawImage(img, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, 0, 0, 128, 128); label.textContent = `frame ${i + 1} of ${cols * rows}` + (names[i] ? ` · ${names[i]}` : ''); };
  const label = el('div', 'tiny');
  const play = () => { clearInterval(timer); let i = 0; show(0); timer = setInterval(() => { if (!wrap.isConnected) return clearInterval(timer); if (++i >= cols * rows) { clearInterval(timer); return; } show(i); }, 1000 / (p.fps ?? 6)); };
  img.onload = () => show(0);
  img.onclick = e => { const r = img.getBoundingClientRect(); show(Math.floor((e.clientX - r.left) / r.width * cols) + cols * Math.floor((e.clientY - r.top) / r.height * rows)); };
  const btn = el('button', null, '▶ Play frames'); btn.onclick = play;
  wrap.append(el('div', 'tiny', `${file.name.replace(/_/g, ' ')} · ${p.name ?? 'sprite sheet'} · ${cols} × ${rows} grid of ${(p.cell_size ?? []).join(' × ')} px cells`), img, el('div', 'row'));
  wrap.lastChild.append(view, el('div', 'col'));
  wrap.lastChild.lastChild.append(label, btn, el('p', null, (p.hint ?? '').trim()));
  return wrap;
}
// A bitmap face is a grid of pixel values; drawn as square pixels it shows exactly what a small display would.
function bitmaps(file) {
  const wrap = el('div', 'asset'), row = el('div', 'row'), p = file.props ?? {}, named = Object.fromEntries(Object.entries(p.files ?? {}).map(([n, f]) => [f.split('/').pop(), n]));
  wrap.append(el('div', 'tiny', `${p.name ?? file.name} · ${file.count} bitmap faces · ${(p.ideal_size ?? []).join(' × ')}`), row, el('p', null, (p.hint ?? '').trim()));
  for (const url of file.urls ?? []) {
    const fig = el('figure'), c = el('canvas');
    fig.append(c, el('figcaption', null, named[decodeURIComponent(url.split('/').pop())] ?? url.split('/').pop().replace('.json', '')));
    row.append(fig);
    fetch(url).then(r => r.json()).then(b => {
      c.width = b.width * 3; c.height = b.height * 3; const g = c.getContext('2d'); g.fillStyle = '#05070b'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#f2f5fa';
      b.data.forEach((v, i) => { if (v) g.fillRect((i % b.width) * 3, Math.floor(i / b.width) * 3, 3, 3); });
    }).catch(() => fig.remove());
  }
  return wrap;
}
function media(file, onPick) {
  const wrap = el('div', 'asset'), urls = file.urls ?? (file.url ? [file.url] : []);
  const video = u => /\.(mp4|webm)$/i.test(u), row = el('div', 'row');
  wrap.append(el('div', 'tiny', `${file.name} · ${file.type?.replace('_', ' ')}` + (file.count ? ` · ${file.count} files` : '')), row);
  for (const u of urls.filter(u => !/\.json$/i.test(u)).slice(0, 12)) {
    const m = video(u) ? el('video') : el('img');
    if (video(u)) { m.muted = true; m.loop = true; m.playsInline = true; m.preload = 'metadata'; m.onmouseenter = () => m.play().catch(() => {}); m.onmouseleave = () => m.pause(); m.title = 'Hover to play'; }
    m.src = u; m.alt = file.name; if (onPick) m.onclick = () => onPick(u); row.append(m);
  }
  return wrap;
}
export function assetCard(file) {
  if (file.missing) return null;
  if (file.type === 'sprite_sheet' && file.url) return spriteSheet(file);
  if (file.type === 'bitmap_set') return bitmaps(file);
  if (file.url || file.urls?.some(u => !/\.json$/i.test(u))) return media(file);
  return null;
}
