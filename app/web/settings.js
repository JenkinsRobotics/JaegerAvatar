// The Settings window: the app's own agent, voice and hearing. Agent and hearing settings live on the server
// (app/.cache/settings.json); voice choice and speed belong to this browser, like the rest of the voice box.
const $ = s => document.querySelector(s);

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
    fill($('#setStt'), Object.entries(s.options.whisper).map(([m, size]) => [m, `${m} · ${size}`]), s.hearing.model);
    fill($('#setLang'), Object.entries(s.options.languages), s.hearing.language);
    $('#setLang').disabled = s.hearing.model.endsWith('.en');
    $('#agentNow').textContent = `Brain now: ${s.brain}. Models come from LM Studio at ${s.lmstudio}` + (models.length ? '.' : ', which is not answering.');
    $('#hearingNow').textContent = `Whisper (faster-whisper) on this Mac's CPU: ${s.hearing.model}, ${s.hearing_ready ? 'loaded' : 'loads when you first talk'}.`;
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
