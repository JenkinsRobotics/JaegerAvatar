#!/usr/bin/env node
// JP01's face as a program, for a robot with no browser: control state in, the panel's pixels out.
//
//   node panel-run.mjs [--face mochi_wave] [--fps 30]
//
// In, on stdin: the latest avatar-state/v1 snapshot as one JSON object a line (jaeger_avatar/embedded Controller.snapshot()),
// several times a second. With no line for a second the face rests, so a host that has gone away leaves a calm face.
// Out, on stdout, every tick: the 64 x 64 face, then the 24-LED ring. Each is 8 bytes (width and height as 16-bit numbers,
// the frame number as 32-bit, little-endian) and then width x height x 3 bytes of RGB, row by row: the same form as the
// app's /hardware/stream. Lighting the LEDs is the robot's own driver's job.
import { PanelFace } from './panel.js';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
let panel;
try { panel = new PanelFace({ face: arg('face', 'mochi_wave') }); } catch (error) { console.error(error.message); process.exit(2); }

let state = null, heard = 0, number = 0, rest = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  const lines = (rest + chunk).split('\n'); rest = lines.pop();
  for (const line of lines) if (line.trim()) try { state = JSON.parse(line); heard = Date.now(); } catch { /* a broken line is skipped; the last good state stands */ }
});
process.stdin.on('end', () => process.exit(0));          // the host closed the pipe
process.stdout.on('error', () => process.exit(0));       // nobody is reading

const head = (w, h) => { const b = Buffer.alloc(8); b.writeUInt16LE(w, 0); b.writeUInt16LE(h, 2); b.writeUInt32LE(number, 4); return b; };
setInterval(() => {
  number++;
  const { face, ring } = panel.frame(Date.now() - heard < 1000 ? state : null, performance.now() / 1000);
  process.stdout.write(Buffer.concat([head(64, 64), face, head(24, 1), ring]));
}, 1000 / Math.min(60, Math.max(1, +arg('fps', 30) || 30)));
