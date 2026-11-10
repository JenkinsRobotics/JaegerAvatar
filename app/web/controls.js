// The controls an agent may drive the body on stage with. A pack declares them (presentation.controls); a list it
// leaves out is what the body can do today. The engine exposes exactly these and invents none of its own.
import { EMOTIONS } from './rig.js';
import { REACTIONS } from './eyes.js';

export function controlsOf(rep, { led, moves, poses }) {
  const own = rep?.controls ?? {};
  return {
    emotions: own.emotions ?? Object.keys(EMOTIONS),
    reactions: own.reactions ?? (led ? Object.keys(REACTIONS) : []),
    actions: own.actions ?? (poses?.length ? poses : moves),
  };
}
