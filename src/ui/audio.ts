// Tiny synthesized sound effects (no audio files). Audio starts only after the
// player's first interaction, and stops when the game is paused.

type Sfx = "click" | "coin" | "rank" | "error" | "open" | "day" | "event";

export class Audio {
  private ctx: AudioContext | null = null;
  enabled = true;
  private suspended = false;

  unlock(): void {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  pause(): void {
    this.suspended = true;
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    this.suspended = false;
    void this.ctx?.resume().catch(() => {});
  }

  play(s: Sfx): void {
    if (!this.enabled || !this.ctx || this.suspended) return;
    const seq: Record<Sfx, [number, number, OscillatorType, number][]> = {
      click: [[660, 0.05, "triangle", 0.06]],
      open: [[520, 0.06, "sine", 0.06], [780, 0.08, "sine", 0.05]],
      coin: [[988, 0.07, "square", 0.04], [1319, 0.14, "square", 0.04]],
      rank: [[523, 0.12, "triangle", 0.08], [659, 0.12, "triangle", 0.08], [784, 0.12, "triangle", 0.08], [1047, 0.3, "triangle", 0.09]],
      error: [[220, 0.12, "sawtooth", 0.04], [180, 0.15, "sawtooth", 0.04]],
      day: [[392, 0.1, "sine", 0.06], [523, 0.18, "sine", 0.06]],
      event: [[740, 0.08, "triangle", 0.06], [554, 0.12, "triangle", 0.06]],
    };
    let t = this.ctx.currentTime;
    for (const [freq, dur, type, vol] of seq[s]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur * 0.85;
    }
  }
}
