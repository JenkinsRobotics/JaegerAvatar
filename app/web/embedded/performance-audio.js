// Pack-owned performance audio. Hosts supply state, explicit audio unlock and volume.
export class PerformanceAudio {
  constructor(base, report = () => {}, status = () => {}) {
    this.base = base; this.report = report; this.status = status; this.enabled = true; this.volume = .75;
    this.key = ''; this.generation = 0; this.cache = new Map(); this.state = null;
    this.disposed = false; this.manifest = fetch(base + 'manifest.json').then(r => { if (!r.ok) throw Error('Performance audio pack unavailable'); return r.json(); });
    this.manifest.catch(e => this.report(String(e)));
  }
  async unlock() {
    if (this.disposed || !this.enabled || this.context?.state === 'running') return;
    try {
      if (!this.context) {
        this.context = new AudioContext({latencyHint:'interactive'});
        this.gain = this.context.createGain(); this.gain.connect(this.context.destination);
      }
      await this.context.resume();
      if (this.disposed) return;
      this.report(this.context.state === 'running' ? '' : 'Click Effects to enable sound');
      this.update(this.state, true);
    } catch (e) { this.report('Effects unavailable: ' + String(e)); }
  }
  setVolume(volume) { this.volume = Math.max(0, Math.min(1, volume)); this.mix(); }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.stop(); else void this.unlock().then(()=>this.update(this.state, true)); }
  mix() { if (this.gain) this.gain.gain.setTargetAtTime(this.volume * (this.state?.speaking ? .25 : 1), this.context.currentTime, .04); }
  stop() { this.status('Ready'); this.generation++; if (this.source) { try { this.source.stop(); } catch {} this.source.disconnect(); this.source = null; } }
  update(state, retry = false) {
    const old = this.state; this.state = state; this.mix();
    const clip = state?.clip || '';
    const key = clip ? `${state.session}:clip:${state.clip_seq}:${state.clip_started_at_ms}`
      : state?.reaction ? `${state.session}:reaction:${state.reaction_seq}`
      : `${state?.session}:emotion:${state?.emotion || 'neutral'}`;
    if (key === this.key && !retry) return;
    // A repeated unlock must not restart a sound which is already playing.
    if (key === this.key && this.source) return;
    const initial = !old; this.key = key; this.stop();
    if (!state || !this.enabled || !this.context || this.context.state !== 'running') return;
    const kind = clip ? 'clips' : state.reaction ? 'reactions' : 'emotions';
    const name = clip || state.reaction || state.emotion;
    if (initial && kind !== 'clips') return;
    const started = kind === 'clips' ? state.clip_started_at_ms : Date.now();
    const generation = this.generation;
    void this.play(kind, name, started, generation);
  }
  async play(kind, name, started, generation) {
    try {
      const manifest = await this.manifest;
      if (manifest.schema !== 'mochi-performance-audio/v1') throw Error('Unsupported audio pack');
      const track = manifest[kind]?.[name]; if (!track) return;
      if (!/^[a-z0-9_]+\.wav$/.test(track.file)) throw Error('Invalid audio asset');
      if (!this.cache.has(track.file)) {
        const pending = fetch(this.base + track.file).then(r => { if (!r.ok) throw Error('Missing effect: ' + name); return r.arrayBuffer(); }).then(bytes => this.context.decodeAudioData(bytes));
        this.cache.set(track.file, pending); pending.catch(() => this.cache.delete(track.file));
      }
      const buffer = await this.cache.get(track.file);
      if (this.disposed || generation !== this.generation || !this.enabled) return;
      const offset = Math.max(0, (Date.now() - started) / 1000);
      if (offset >= buffer.duration) return; // Never replay old cues after reconnect/unmute.
      const source = this.context.createBufferSource(); source.buffer = buffer;
      source.connect(this.gain); this.source = source;
      source.onended = () => { source.disconnect(); if (this.source === source) {this.source = null;this.status('Ready');} };
      source.start(0, offset); this.report(''); this.status('Playing ' + name.replaceAll('_',' '));
    } catch (e) { if (generation === this.generation) this.report('Effects unavailable: ' + String(e)); }
  }
  dispose() { this.disposed = true; this.stop(); this.cache.clear(); void this.context?.close(); }
}
