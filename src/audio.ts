const KEY = 'pp_sound';

/**
 * All sound effects are synthesized with the Web Audio API — no audio files,
 * so the game stays a single self-contained bundle.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  enabled = localStorage.getItem(KEY) !== 'off';
  private last: Record<string, number> = {};

  /** Browsers only allow audio after a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    void this.ctx.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem(KEY, this.enabled ? 'on' : 'off');
    return this.enabled;
  }

  private ok(kind: string, minGapMs: number): boolean {
    const now = performance.now();
    if (now - (this.last[kind] ?? 0) < minGapMs) return false;
    this.last[kind] = now;
    return true;
  }

  private beep(
    freq: number, dur: number, vol: number,
    type: OscillatorType = 'sine', slideTo?: number
  ): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(Math.min(vol, 0.6), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Sharp click of two balls colliding; volume follows impact speed. */
  ballClick(intensity: number): void {
    if (intensity < 0.02 || !this.ok('ball', 30)) return;
    const v = Math.min(1, intensity) * 0.45;
    this.beep(1700 + Math.random() * 400, 0.035, v, 'square');
  }

  /** Dull thud off the cushion. */
  rail(intensity: number): void {
    if (intensity < 0.04 || !this.ok('rail', 40)) return;
    this.beep(170, 0.07, Math.min(1, intensity) * 0.3, 'sine');
  }

  /** Ball dropping into a pocket. */
  pocket(): void {
    if (!this.ok('pocket', 60)) return;
    this.beep(320, 0.18, 0.5, 'sine', 70);
  }

  /** Cue tip striking the ball. */
  cue(power: number): void {
    this.beep(1100, 0.04, 0.2 + power * 0.3, 'triangle');
  }
}

export const audio = new AudioEngine();
