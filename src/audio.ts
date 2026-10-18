/** Short, locally synthesized accents. Created only after an explicit sound gesture. */
export class AudioFeedback {
  private context?: AudioContext;
  private enabledValue = false;
  private blocked = false;
  private disposed = false;
  private revision = 0;
  private resumeWaits = new Set<() => void>();
  private voices = new Map<OscillatorNode, GainNode>();
  private readonly onHidden = () => { if (document.hidden) this.suspend(); };
  private readonly onSuspend = () => this.suspend();
  private readonly enforceSilence = (event: Event) => {
    const context = event.currentTarget as AudioContext;
    // A cancelled resume may complete after suspend. Preserve the latest explicit sound intent.
    if (context.state === 'running' && (!this.enabled || this.blocked || this.disposed || document.hidden))
      void context.suspend().catch(() => {});
  };

  constructor() {
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onSuspend);
    window.addEventListener('wendao:suspend', this.onSuspend);
  }
  get enabled() { return this.enabledValue; }
  set enabled(value: boolean) {
    if (value === this.enabledValue) return;
    this.enabledValue = value;
    if (!value) this.suspend();
  }

  /** Call directly from a user gesture; returning to the foreground never auto-resumes sound. */
  async unlock(): Promise<boolean> {
    if (!this.enabled || this.disposed || document.hidden) return false;
    this.blocked = false;
    const revision = this.revision;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context?.removeEventListener('statechange', this.enforceSilence);
        this.context = new AudioContext();
        this.context.addEventListener('statechange', this.enforceSilence);
      }
      const context = this.context;
      if (!await this.resumeContext(context)) return false;
      if (!this.enabled || this.blocked || this.disposed || document.hidden) {
        if (context.state !== 'closed') void context.suspend().catch(() => {});
        return false;
      }
      return revision === this.revision && context.state === 'running';
    } catch { return false; }
  }

  private async resumeContext(context: AudioContext): Promise<boolean> {
    let cancel = () => {};
    const cancelled = new Promise<boolean>(resolve => {
      cancel = () => resolve(false);
      this.resumeWaits.add(cancel);
    });
    try {
      // Some engines leave resume pending when a suspend immediately follows it.
      return await Promise.race([context.resume().then(() => true), cancelled]);
    } finally { this.resumeWaits.delete(cancel); }
  }

  async preview(kind: 'card' | 'chip' | 'win') {
    if (await this.unlock()) this.play(kind);
  }

  play(kind: 'card' | 'chip' | 'win') {
    if (!this.enabled || this.blocked || this.disposed || document.hidden || this.context?.state !== 'running') return;
    const context = this.context;
    const tones = kind === 'win' ? [523.25, 659.25, 783.99] : [kind === 'card' ? 720 : 1250];
    tones.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.075;
      const oscillator = context.createOscillator(), gain = context.createGain();
      this.voices.set(oscillator, gain);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.68, start + 0.13);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(kind === 'win' ? 0.05 : 0.028, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (kind === 'win' ? 0.65 : 0.13));
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator);
      };
      oscillator.start(start); oscillator.stop(start + 0.7);
    });
  }

  suspend() {
    this.blocked = true; this.revision++;
    for (const cancel of this.resumeWaits) cancel();
    this.resumeWaits.clear();
    // Drop scheduled accents before suspension, so they cannot replay on resume.
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
    if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.suspend();
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onSuspend);
    window.removeEventListener('wendao:suspend', this.onSuspend);
    const context = this.context;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => {}).finally(() => context.removeEventListener('statechange', this.enforceSilence));
    } else context?.removeEventListener('statechange', this.enforceSilence);
    this.context = undefined;
  }
}
