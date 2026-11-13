// The stage follows an agent outside the avatar. The page attaches with the body's declared controls, polls the
// link's state every 50 ms (as the embedded renderer does) and turns each change into the calls its own buttons make.
const REST = { session: null, emotion: 'neutral', reaction_seq: 0, act_seq: 0, speak_seq: 0, stop_seq: 0, gaze: [0, 0] };

// What changed between two avatar-state/v1 snapshots, as commands for the stage. A new session starts from rest.
export function changes(prev, next) {
  const p = prev && prev.session === next.session ? prev : { ...REST, session: next.session };
  if (next.stop_seq > p.stop_seq)   // a stop resets everything; what came after it in the same poll still plays
    return [{ kind: 'stop', value: null }, ...changes({ ...REST, session: next.session, stop_seq: next.stop_seq, reaction_seq: next.stop_seq, act_seq: next.stop_seq, speak_seq: next.stop_seq }, next)];
  const out = [];
  if (next.emotion !== p.emotion) out.push({ kind: 'feel', value: next.emotion });
  if (next.reaction_seq > p.reaction_seq && next.reaction) out.push({ kind: 'react', value: next.reaction });
  if (next.act_seq > p.act_seq && next.act) out.push({ kind: 'act', value: next.act });
  const [x, y] = next.gaze ?? [0, 0], [px, py] = p.gaze ?? [0, 0];
  if (Math.abs(x - px) > 0.01 || Math.abs(y - py) > 0.01) out.push({ kind: 'look', value: [x, y] });
  if (next.speak_seq > p.speak_seq && next.speak) out.push({ kind: 'speak', value: next.speak });
  return out;
}

// Attach, poll, and re-attach whenever the body on stage (or what it may be told) changes.
export function startControlLink({ capabilities, avatar, apply, note = () => {} }) {
  let key = '', prev = null, busy = false, session = null, standing = false;
  const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const caps = capabilities(), name = avatar(), k = name + JSON.stringify(caps);
      if (k !== key) {
        const r = await post('/control/attach', { avatar: name, capabilities: caps }); if (!r.ok) return;
        ({ session } = await r.json()); key = k; prev = null; standing = false;
      }
      const s = await (await fetch('/control/state?session=' + session)).json();
      if (s.taken) { if (!standing) note('Another page is following the control link; this one waits until it closes.'); standing = true; return; }
      if (!s.attached) { key = ''; return; }   // the server restarted, or the page that took over has closed: attach again
      for (const c of changes(prev, s)) { try { apply(c); } catch (e) { console.warn('control link', c.kind, e); } }
      prev = s;
    } catch { /* the demo server is down or restarting; try again next tick */ } finally { busy = false; }
  };
  setInterval(tick, 50);
  return { get standing() { return standing; } };   // true while a newer page has the body: this page then leaves it alone
}
