/** Short, locally synthesized accents. No network request or music autoplay. */
export class AudioFeedback {
  private context?: AudioContext;
  enabled = false;

  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Visual interaction remains available without audio. */
    }
  }

  play(kind: "card" | "chip" | "win") {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const ctx = this.context;
    const tones =
      kind === "win"
        ? [523.25, 659.25, 783.99]
        : [kind === "card" ? 720 : 1250];
    tones.forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.075;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 0.68,
        start + 0.13,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        kind === "win" ? 0.05 : 0.028,
        start + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + (kind === "win" ? 0.65 : 0.13),
      );
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.7);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
