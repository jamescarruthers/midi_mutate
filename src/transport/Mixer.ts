import type { TrackMixState } from '../types/transport';

/**
 * Audio mixing bus with per-track gain, mute/solo, and a master limiter.
 *
 * Signal chain per track:
 *   trackGainNode  ->  masterGain  ->  compressor (limiter)  ->  destination
 *
 * An AnalyserNode can be tapped off the master bus for visualisation.
 */
export class Mixer {
  private audioContext: AudioContext;

  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;

  /** Per-track gain nodes keyed by trackId. */
  private trackBuses: Map<string, GainNode> = new Map();

  /** Per-track mix state keyed by trackId. */
  private trackStates: Map<string, TrackMixState> = new Map();

  /** Lazily created analyser node. */
  private analyser: AnalyserNode | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;

    // Master gain feeds into a compressor (configured as a limiter).
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 1;

    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 3;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(audioContext.destination);
  }

  // ---------------------------------------------------------------------------
  // Track buses
  // ---------------------------------------------------------------------------

  /**
   * Create (or return existing) a GainNode for the given track, already
   * connected to the master bus. Synth engines should connect their output
   * to the returned node.
   */
  createTrackBus(trackId: string): AudioNode {
    const existing = this.trackBuses.get(trackId);
    if (existing) return existing;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(this.masterGain);

    this.trackBuses.set(trackId, gainNode);
    this.trackStates.set(trackId, {
      trackId,
      gain: 1,
      muted: false,
      solo: false,
    });

    return gainNode;
  }

  // ---------------------------------------------------------------------------
  // Per-track controls
  // ---------------------------------------------------------------------------

  setTrackGain(trackId: string, gain: number): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    state.gain = Math.max(0, Math.min(1, gain));
    this.applyTrackGains();
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    state.muted = muted;
    this.applyTrackGains();
  }

  setTrackSolo(trackId: string, solo: boolean): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    state.solo = solo;
    this.applyTrackGains();
  }

  getTrackState(trackId: string): Readonly<TrackMixState> | undefined {
    const state = this.trackStates.get(trackId);
    return state ? { ...state } : undefined;
  }

  // ---------------------------------------------------------------------------
  // Master controls
  // ---------------------------------------------------------------------------

  setMasterGain(gain: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, gain));
  }

  // ---------------------------------------------------------------------------
  // Analyser
  // ---------------------------------------------------------------------------

  /**
   * Return an AnalyserNode connected to the master bus, creating it lazily.
   * Useful for waveform / FFT visualisation in the UI.
   */
  getAnalyserNode(): AnalyserNode {
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      // Insert the analyser between master gain and compressor.
      this.masterGain.disconnect(this.compressor);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.compressor);
    }
    return this.analyser;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    for (const [, gainNode] of this.trackBuses) {
      gainNode.disconnect();
    }
    this.trackBuses.clear();
    this.trackStates.clear();

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.masterGain.disconnect();
    this.compressor.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Recompute the effective gain for every track bus, taking mute and solo
   * state into account.
   *
   * Solo logic: if ANY track is soloed, only soloed tracks are audible.
   * Mute takes precedence over solo (a muted+soloed track is still muted).
   */
  private applyTrackGains(): void {
    const anySoloed = Array.from(this.trackStates.values()).some((s) => s.solo);

    for (const [trackId, state] of this.trackStates) {
      const bus = this.trackBuses.get(trackId);
      if (!bus) continue;

      let effectiveGain = state.gain;

      if (state.muted) {
        effectiveGain = 0;
      } else if (anySoloed && !state.solo) {
        effectiveGain = 0;
      }

      bus.gain.value = effectiveGain;
    }
  }
}
