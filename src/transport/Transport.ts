import type { Song } from '../types/song';
import type { InstrumentEngine } from '../types/synth';
import type { TransportState, TransportConfig } from '../types/transport';
import { Scheduler } from './Scheduler';

/**
 * High-level transport controller that manages playback state and
 * delegates scheduling to the Scheduler.
 */
export class Transport {
  private audioContext: AudioContext;
  private scheduler: Scheduler;

  private state: TransportState = 'stopped';
  private config: TransportConfig = {
    tempoScale: 1,
    loopEnabled: false,
    loopStartBar: 0,
    loopEndBar: 0,
  };

  private song: Song | null = null;
  private engines: Map<string, InstrumentEngine> = new Map();

  /** Called whenever the transport state changes. */
  onStateChange: ((state: TransportState) => void) | null = null;

  /** Called on each scheduling pass with the current tick. */
  onTickUpdate: ((tick: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.scheduler = new Scheduler(audioContext);

    // Wire up the scheduler's tick callback to our own.
    this.scheduler.onTick = (tick: number) => {
      this.onTickUpdate?.(tick);
    };
  }

  // ---------------------------------------------------------------------------
  // Song / engine loading
  // ---------------------------------------------------------------------------

  /**
   * Store a song and its per-track instrument engines for playback.
   * If currently playing, stops first.
   */
  loadSong(song: Song, engines: Map<string, InstrumentEngine>): void {
    if (this.state !== 'stopped') {
      this.stop();
    }
    this.song = song;
    this.engines = engines;
  }

  // ---------------------------------------------------------------------------
  // Transport controls
  // ---------------------------------------------------------------------------

  play(): void {
    if (!this.song) return;

    // Resume AudioContext if it was suspended (browser autoplay policy).
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.state === 'stopped') {
      this.scheduler.start(this.song, this.engines, this.config, 0);
      this.setState('playing');
    } else if (this.state === 'paused') {
      // Resume from where we paused.
      const tick = this.scheduler.getCurrentTick();
      this.scheduler.start(this.song, this.engines, this.config, tick);
      this.setState('playing');
    }
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.scheduler.pause();
    this.setState('paused');
  }

  stop(): void {
    this.scheduler.stop();
    this.setState('stopped');
  }

  // ---------------------------------------------------------------------------
  // Seeking
  // ---------------------------------------------------------------------------

  seekToBar(barIndex: number): void {
    if (!this.song) return;
    this.scheduler.seekToBar(barIndex, this.song);
  }

  seekToTick(tick: number): void {
    this.scheduler.seekToTick(tick);
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  setTempoScale(scale: number): void {
    this.config.tempoScale = scale;

    if (this.state === 'playing' && this.song) {
      // Restart the scheduler from the current tick with the new tempo scale
      // so the lookahead window is recalculated.
      this.scheduler.updateConfig(this.config);
    }
  }

  setLoop(enabled: boolean, startBar?: number, endBar?: number): void {
    this.config.loopEnabled = enabled;
    if (startBar !== undefined) this.config.loopStartBar = startBar;
    if (endBar !== undefined) this.config.loopEndBar = endBar;

    this.scheduler.updateConfig(this.config);
  }

  getConfig(): Readonly<TransportConfig> {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // State queries
  // ---------------------------------------------------------------------------

  getState(): TransportState {
    return this.state;
  }

  getCurrentTick(): number {
    return this.scheduler.getCurrentTick();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.stop();
    this.onStateChange = null;
    this.onTickUpdate = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private setState(newState: TransportState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChange?.(newState);
  }
}
