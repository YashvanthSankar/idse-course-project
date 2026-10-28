// Procedural sound design: every effect is synthesized with the Web Audio API,
// so the game ships no audio files. Audio starts on the first user gesture.
import { useSettings } from "./settings";

export type SfxName =
  | "type" | "rustle" | "pin" | "string" | "coin" | "stamp" | "correct" | "wrong"
  | "tick" | "terminal" | "whoosh" | "drumroll" | "buzz";
export type LoopName = "rain" | "jazz" | "heartbeat";

type Stop = () => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private loops = new Map<LoopName, Stop>();

  constructor() {
    if (typeof window === "undefined") return;
    useSettings.subscribe(() => this.applyVolume());
  }

  /** Create (or resume) the AudioContext. Safe to call from any user gesture. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ready = this.ready();
    if (!ready) return;
    const [ctx, out] = ready;
    const t = ctx.currentTime;
    switch (name) {
      case "type":
        this.noiseBurst(out, t, 0.018, 1800 + Math.random() * 2200, 0.35, 6);
        this.tone(out, "square", 3200 + Math.random() * 400, t, 0.008, 0.04);
        break;
      case "rustle":
        for (let i = 0; i < 4; i++) this.noiseBurst(out, t + i * 0.05, 0.09, 3500, 0.12, 1.5);
        break;
      case "pin":
        this.noiseBurst(out, t, 0.01, 5000, 0.4, 4);
        this.tone(out, "sine", 1800, t, 0.07, 0.15);
        break;
      case "string": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(110, t + 0.35);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.5);
        break;
      }
      case "coin":
        this.tone(out, "square", 988, t, 0.07, 0.08);
        this.tone(out, "square", 1319, t + 0.07, 0.18, 0.08);
        break;
      case "stamp": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.36);
        this.noiseBurst(out, t, 0.12, 500, 0.7, 0.8, "lowpass");
        break;
      }
      case "correct":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(out, "triangle", f, t + i * 0.09, 0.5, 0.18),
        );
        break;
      case "wrong":
        this.tone(out, "sawtooth", 110, t, 0.6, 0.18, 900);
        this.tone(out, "sawtooth", 116.5, t, 0.6, 0.18, 900);
        break;
      case "tick":
        this.tone(out, "square", 2200, t, 0.012, 0.06);
        break;
      case "terminal":
        this.tone(out, "square", 600 + Math.random() * 600, t, 0.02, 0.03);
        break;
      case "whoosh": {
        const src = this.noiseSource(ctx);
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        f.type = "bandpass";
        f.Q.value = 1.2;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        src.connect(f).connect(g).connect(out);
        src.start(t);
        src.stop(t + 0.4);
        break;
      }
      case "drumroll":
        for (let i = 0; i < 24; i++) {
          this.noiseBurst(out, t + i * 0.055, 0.04, 900, 0.08 + i * 0.012, 1, "lowpass");
        }
        this.noiseBurst(out, t + 1.35, 0.4, 4000, 0.5, 0.6);
        this.tone(out, "sine", 70, t + 1.35, 0.4, 0.6);
        break;
      case "buzz":
        this.tone(out, "sawtooth", 120, t, 0.12, 0.04, 2000);
        break;
    }
  }

  /** Start a loop (idempotent). Returns a function that stops it. */
  loop(name: LoopName): Stop {
    const existing = this.loops.get(name);
    if (existing) return existing;
    const ready = this.ready();
    if (!ready) return () => {};
    const stop = this.startLoop(name, ...ready);
    const wrapped = () => {
      stop();
      this.loops.delete(name);
    };
    this.loops.set(name, wrapped);
    return wrapped;
  }

  stop(name: LoopName): void {
    this.loops.get(name)?.();
  }

  // ---- internals -------------------------------------------------------

  private ready(): [AudioContext, GainNode] | null {
    if (!this.ctx || !this.master || this.ctx.state === "closed") return null;
    return [this.ctx, this.master];
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const { volume, muted } = useSettings.getState();
    this.master.gain.setTargetAtTime(muted ? 0 : volume, this.ctx.currentTime, 0.05);
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    return src;
  }

  private noiseBurst(
    out: AudioNode, t: number, dur: number, freq: number, gain: number, q: number,
    type: BiquadFilterType = "bandpass",
  ): void {
    const ctx = this.ctx!;
    const src = this.noiseSource(ctx);
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  private tone(
    out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, gain: number,
    lowpass?: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node = o.connect(f);
    }
    node.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private startLoop(name: LoopName, ctx: AudioContext, out: GainNode): Stop {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.connect(out);
    const fadeIn = (level: number) => bus.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 2);
    const timers: number[] = [];
    const nodes: AudioScheduledSourceNode[] = [];

    if (name === "rain") {
      const src = this.noiseSource(ctx);
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      const lp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 400;
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      src.connect(hp).connect(lp).connect(bus);
      src.start();
      nodes.push(src);
      fadeIn(0.12);
      timers.push(window.setInterval(() => {
        if (Math.random() < 0.6) {
          this.tone(bus, "sine", 2200 + Math.random() * 1800, ctx.currentTime, 0.03, 0.15);
        }
      }, 180));
    } else if (name === "jazz") {
      // Slow noir pad: Dm9 → G13 → Cmaj9 → A7(b9), a chord every 4 s, soft bass underneath.
      const chords = [
        [146.83, 174.61, 220.0, 261.63, 329.63],
        [98.0, 174.61, 246.94, 329.63, 349.23],
        [130.81, 164.81, 196.0, 246.94, 293.66],
        [110.0, 138.59, 196.0, 233.08, 277.18],
      ];
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.connect(bus);
      let step = 0;
      const playChord = () => {
        const t = ctx.currentTime;
        const chord = chords[step % chords.length];
        chord.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = i === 0 ? "sine" : "triangle";
          o.frequency.value = i === 0 ? f / 2 : f;
          o.detune.value = (Math.random() - 0.5) * 12;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(i === 0 ? 0.22 : 0.07, t + 0.8);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
          o.connect(g).connect(lp);
          o.start(t);
          o.stop(t + 4.3);
        });
        step++;
      };
      playChord();
      timers.push(window.setInterval(playChord, 4000));
      fadeIn(0.5);
    } else {
      const beat = () => {
        const t = ctx.currentTime;
        [0, 0.22].forEach((d, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.setValueAtTime(70, t + d);
          o.frequency.exponentialRampToValueAtTime(40, t + d + 0.15);
          g.gain.setValueAtTime(i === 0 ? 0.9 : 0.6, t + d);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
          o.connect(g).connect(bus);
          o.start(t + d);
          o.stop(t + d + 0.2);
        });
      };
      beat();
      timers.push(window.setInterval(beat, 900));
      fadeIn(0.8);
    }

    return () => {
      timers.forEach((id) => window.clearInterval(id));
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0.0001, t, 0.3);
      window.setTimeout(() => {
        nodes.forEach((n) => n.stop());
        bus.disconnect();
      }, 1500);
    };
  }
}

export const sfx = new SoundEngine();
