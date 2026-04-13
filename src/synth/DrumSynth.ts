import type { InstrumentEngine } from '../types/synth';
import { GM_DRUM_MAP } from '../utils/constants';

/**
 * Creates a white noise AudioBuffer for drum synthesis.
 */
function createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class DrumSynth implements InstrumentEngine {
  private ctx: AudioContext;
  private destination: AudioNode;
  private noiseBuffer: AudioBuffer | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private disposed = false;

  constructor(audioContext: AudioContext, destination: AudioNode) {
    this.ctx = audioContext;
    this.destination = destination;
  }

  noteOn(pitch: number, velocity: number, time: number): void {
    if (this.disposed) return;

    const drumType = GM_DRUM_MAP[pitch] ?? 'default';
    const velGain = velocity / 127;

    switch (drumType) {
      case 'kick':
        this.playKick(time, velGain);
        break;
      case 'snare':
        this.playSnare(time, velGain);
        break;
      case 'hihat-closed':
        this.playHihatClosed(time, velGain);
        break;
      case 'hihat-open':
        this.playHihatOpen(time, velGain);
        break;
      default:
        this.playDefault(time, velGain);
        break;
    }
  }

  /**
   * Drums are self-contained — noteOff is a no-op.
   */
  noteOff(_pitch: number, _time: number): void {
    // Drums auto-stop; nothing to do.
  }

  dispose(): void {
    this.disposed = true;
    for (const node of this.activeNodes) {
      try { node.disconnect(); } catch { /* noop */ }
    }
    this.activeNodes.clear();
  }

  /**
   * Kick: short sine with pitch envelope (150Hz -> 60Hz over 50ms)
   */
  private playKick(time: number, velGain: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.05);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    filter.Q.setValueAtTime(1, time);

    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.9 * velGain, time + 0.001);
    vca.gain.linearRampToValueAtTime(0, time + 0.25);

    osc.connect(filter);
    filter.connect(vca);
    vca.connect(this.destination);

    osc.start(time);
    osc.stop(time + 0.3);

    this.trackAutoCleanup(osc, vca, filter, 0.3, time);
  }

  /**
   * Snare: noise + sine 180Hz, bandpass 3kHz
   */
  private playSnare(time: number, velGain: number): void {
    // Noise component
    const noiseSource = this.createNoiseSource();
    const noiseBP = this.ctx.createBiquadFilter();
    noiseBP.type = 'bandpass';
    noiseBP.frequency.setValueAtTime(3000, time);
    noiseBP.Q.setValueAtTime(2, time);

    const noiseVca = this.ctx.createGain();
    noiseVca.gain.setValueAtTime(0, time);
    noiseVca.gain.linearRampToValueAtTime(0.7 * velGain, time + 0.001);
    noiseVca.gain.linearRampToValueAtTime(0, time + 0.18);

    noiseSource.connect(noiseBP);
    noiseBP.connect(noiseVca);
    noiseVca.connect(this.destination);
    noiseSource.start(time);
    noiseSource.stop(time + 0.25);

    // Sine component at 180Hz
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, time);

    const oscVca = this.ctx.createGain();
    oscVca.gain.setValueAtTime(0, time);
    oscVca.gain.linearRampToValueAtTime(0.5 * velGain, time + 0.001);
    oscVca.gain.linearRampToValueAtTime(0, time + 0.12);

    osc.connect(oscVca);
    oscVca.connect(this.destination);
    osc.start(time);
    osc.stop(time + 0.2);

    this.trackAutoCleanup(noiseSource, noiseVca, noiseBP, 0.3, time);
    this.trackAutoCleanup(osc, oscVca, null, 0.3, time);
  }

  /**
   * Hihat closed: white noise through highpass 7kHz, very short envelope
   */
  private playHihatClosed(time: number, velGain: number): void {
    const noiseSource = this.createNoiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(7000, time);
    hp.Q.setValueAtTime(1, time);

    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.5 * velGain, time + 0.001);
    vca.gain.linearRampToValueAtTime(0, time + 0.07);

    noiseSource.connect(hp);
    hp.connect(vca);
    vca.connect(this.destination);
    noiseSource.start(time);
    noiseSource.stop(time + 0.12);

    this.trackAutoCleanup(noiseSource, vca, hp, 0.15, time);
  }

  /**
   * Hihat open: white noise through highpass 6kHz, longer envelope
   */
  private playHihatOpen(time: number, velGain: number): void {
    const noiseSource = this.createNoiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6000, time);
    hp.Q.setValueAtTime(1, time);

    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.5 * velGain, time + 0.001);
    vca.gain.linearRampToValueAtTime(0.05 * velGain, time + 0.2);
    vca.gain.linearRampToValueAtTime(0, time + 0.35);

    noiseSource.connect(hp);
    hp.connect(vca);
    vca.connect(this.destination);
    noiseSource.start(time);
    noiseSource.stop(time + 0.4);

    this.trackAutoCleanup(noiseSource, vca, hp, 0.45, time);
  }

  /**
   * Default for unmapped notes: short noise hit
   */
  private playDefault(time: number, velGain: number): void {
    const noiseSource = this.createNoiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2000, time);
    bp.Q.setValueAtTime(1, time);

    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.4 * velGain, time + 0.001);
    vca.gain.linearRampToValueAtTime(0, time + 0.1);

    noiseSource.connect(bp);
    bp.connect(vca);
    vca.connect(this.destination);
    noiseSource.start(time);
    noiseSource.stop(time + 0.15);

    this.trackAutoCleanup(noiseSource, vca, bp, 0.2, time);
  }

  private createNoiseSource(): AudioBufferSourceNode {
    if (!this.noiseBuffer) {
      this.noiseBuffer = createWhiteNoiseBuffer(this.ctx);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    return source;
  }

  /**
   * Track nodes for cleanup on dispose, and auto-disconnect after the voice completes.
   */
  private trackAutoCleanup(
    source: OscillatorNode | AudioBufferSourceNode,
    vca: GainNode,
    filter: BiquadFilterNode | null,
    durationSeconds: number,
    time: number,
  ): void {
    this.activeNodes.add(source);
    this.activeNodes.add(vca);
    if (filter) this.activeNodes.add(filter);

    const cleanupDelay = (time - this.ctx.currentTime + durationSeconds + 0.05) * 1000;
    const delay = Math.max(0, cleanupDelay);

    setTimeout(() => {
      try { source.disconnect(); } catch { /* noop */ }
      try { vca.disconnect(); } catch { /* noop */ }
      if (filter) {
        try { filter.disconnect(); } catch { /* noop */ }
        this.activeNodes.delete(filter);
      }
      this.activeNodes.delete(source);
      this.activeNodes.delete(vca);
    }, delay);
  }
}
