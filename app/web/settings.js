// The Settings window: the app's own agent, voice and hearing. Agent and hearing settings live on the server
// (app/.cache/settings.json); voice choice and speed belong to this browser, like the rest of the voice box.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const show = v => v === '' ? '—' : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);

// Why each JaegerAgent setting has the value it has in this app. Set above = editable on this page.
const WHY = {
  provider: 'The agent loads the model file itself with llama.cpp, inside its own process. This is the only way the app runs a model: no model server, no HTTP.',
  model: 'Set above.', max_tokens: 'Set above (Longest reply).', temperature: 'Set above (Creativity).', timeout_s: 'Set above.',
  base_url: 'Not used: the model runs inside the agent, so there is no address to call.', api_key_env: 'A local model needs no key.',
  model_path: 'The GGUF file the agent has loaded. Chosen above (Model).',
  ctx: 'Tokens of conversation the model keeps in view.', gpu_layers: '-1 = every layer on the GPU (Metal on this Mac).',
  system_prompt: 'Built for each character from its pack persona plus the acting rules. The Data flow window shows the exact prompt of every turn.',
  tools_enabled: 'Off. Tools would let the agent act on this Mac (files, commands, the web); turning them on is a separate decision.',
  max_iterations: 'One model call per turn, because tools are off.',
};
const AUDIO = 'Not used. This app runs its own hearing and voice in the browser (the Hearing and Voice pages), so the mouth can follow each clip. ' +
  'Audio modes: plain and structured are half duplex (the mic is closed while it speaks; structured also tells the model how you spoke); ' +
  'quasi keeps the mic open through an echo canceller so you can interrupt; full listens all the time and merges what you say while it talks. ' +
  "The app's own mic already lets you talk over her: her voice ducks, and a clearly louder voice starts a new turn.";

// With Jaeger Agent's voice loop the agent runs its tools and its own hearing and voice (the Jaeger modules); the server reports each part.
const LOOP_WHY = {
  tools_enabled: 'On. The agent uses its tools: the avatar tool moves this character, and the short tool list covers the clock, the web and the like.',
  max_iterations: 'The most model calls one turn may take: a tool call, then the answer. A plain question takes one.',
};
const LOOP_AUDIO = 'In use. The agent hears and speaks through the Jaeger modules (named above under "Brain now"); this page sends it the microphone and plays the sound it voices, ' +
  'reading the mouth shapes from that sound. Half duplex (plain), speech out, no wake word. The page holds the microphone back while she talks, unless a clearly louder voice starts.';
const part = i => i ? `${i.module} ${i.version} on ${i.compute} (${i.model})` : 'not reported';
export const partsLine = p => !p?.voice ? '' : ` Voice loop: voice ${part(p.voice)}; hearing ${part(p.hearing)}; ${p.ctx} tokens of context; ` +
  `tools ${p.tools_enabled ? `on (${p.tool_list}, up to ${p.max_iterations} model calls a turn)` : 'off'}; loaded in ${p.load_s} s.`;

function allSettings(ja, agent, parts) {
  if (!ja?.agent) return ja?.error ? `JaegerAgent did not report its settings: ${esc(ja.error)}` : 'The agent has not reported its settings yet (is the agent running?).';
  const value = k => k in agent ? agent[k] : ja.in_app[k];
  const table = (props, valueOf, why) => `<table><tr><th>Setting</th><th>In this app</th><th>JaegerAgent default</th><th>What it is</th></tr>${Object.entries(props).map(([k, p]) =>
    `<tr><td><code>${k}</code></td><td>${esc(show(valueOf(k)))}</td><td>${esc(show(p.default ?? ''))}${p.enum ? '<br>' + esc(p.enum.join(' · ')) : ''}${p.minimum != null ? `<br>${p.minimum}–${p.maximum ?? '∞'}` : ''}</td><td>${esc(p.description ?? '')}${why(k) ? `<br><b>Here:</b> ${esc(why(k))}` : ''}</td></tr>`).join('')}</table>`;
  const loop = !!parts?.voice, used = { audio_mode: 'plain', output_mode: 'speech', wake_required: false, stt_model: parts?.hearing?.model };
  return `JaegerAgent ${esc(ja.version)}. The brain settings come from its <code>AgentConfig</code>, the audio pipeline from <code>MultimodalConfig</code>.` +
    `<h3>Brain</h3>${table(ja.agent, value, k => (loop && LOOP_WHY[k]) || WHY[k])}<h3>Its own audio pipeline (half and full duplex)</h3><p>${esc(loop ? LOOP_AUDIO : AUDIO)}</p>` +
    table(ja.multimodal, loop ? k => used[k] ?? ja.multimodal[k].default ?? '' : () => 'not used', () => '');
}

export function startSettings({ speed, setSpeed }) {
  const dlg = $('#settings'), msg = t => { $('#settingsMsg').textContent = t; };
  const tabs = [...dlg.querySelectorAll('[role=tab]')];
  const page = id => tabs.forEach(b => { const on = b.dataset.page === id; b.setAttribute('aria-selected', on); $('#' + b.dataset.page).hidden = !on; });
  tabs.forEach(b => { b.onclick = () => page(b.dataset.page); });
  const fill = (sel, entries, value) => { sel.replaceChildren(...entries.map(([v, label]) => new Option(label, v))); sel.value = value; };

  async function load() {
    const s = await (await fetch('/settings')).json(), models = s.options.models;
    fill($('#setModel'), (models.includes(s.agent.model) ? models : [s.agent.model, ...models]).map(m => [m, m]), s.agent.model);
    $('#setTemp').value = $('#setTempOut').value = s.agent.temperature;
    $('#setTokens').value = s.agent.max_tokens;
    $('#setTimeout').value = s.agent.timeout_s; $('#setSkip').checked = s.agent.skip_thinking;
    $('#agentAllBody').innerHTML = allSettings(s.jaeger_agent, s.agent, s.parts);
    fill($('#setStt'), Object.entries(s.options.whisper).map(([m, size]) => [m, `${m} · ${size}`]), s.hearing.model);
    fill($('#setLang'), Object.entries(s.options.languages), s.hearing.language);
    $('#setLang').disabled = s.hearing.model.endsWith('.en');
    $('#agentNow').textContent = `Brain now: ${s.brain}. The model runs inside the agent (llama.cpp, on the GPU). Model files are read from ${s.model_dirs.join(' and ')}` + (models.length ? '.' : ': none found there.') + partsLine(s.parts);
    $('#hearingNow').textContent = s.parts?.hearing ? `Hearing now: ${part(s.parts.hearing)}, inside Jaeger Agent's voice loop.` : s.hearing_ready ? `Hearing now: ${s.hearing_where}. It runs on the GPU when this machine has one.` : `Whisper ${s.hearing.model}: loading.`;
  }
  async function save(patch) {
    msg('Saving…');
    const r = await fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const out = await r.json().catch(() => ({}));
    msg(r.ok ? 'Saved.' : `Not saved: ${out.error ?? r.status}`);
    await load();
  }
  $('#setModel').onchange = e => save({ agent: { model: e.target.value } });
  $('#setTemp').oninput = e => { $('#setTempOut').value = e.target.value; };
  $('#setTemp').onchange = e => save({ agent: { temperature: +e.target.value } });
  $('#setTokens').onchange = e => save({ agent: { max_tokens: Math.round(+e.target.value) } });
  $('#setTimeout').onchange = e => save({ agent: { timeout_s: +e.target.value } });
  $('#setSkip').onchange = e => save({ agent: { skip_thinking: e.target.checked } });
  $('#setStt').onchange = e => save({ hearing: { model: e.target.value } });
  $('#setLang').onchange = e => save({ hearing: { language: e.target.value } });
  $('#setSpeed').value = speed(); $('#setSpeedOut').value = speed() + '×';
  $('#setSpeed').oninput = e => { $('#setSpeedOut').value = e.target.value + '×'; };
  $('#setSpeed').onchange = e => setSpeed(+e.target.value);

  const open = id => { page(id); msg(''); dlg.showModal(); load().catch(() => msg('The server did not answer.')); };
  $('#settingsOpen').onclick = () => open('setAgent');
  $('#voiceSettings').onclick = () => open('setVoice');
  $('#settingsClose').onclick = () => dlg.close();
}
