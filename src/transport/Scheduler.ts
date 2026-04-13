import type { Song, Bar } from '../types/song';
import type { InstrumentEngine } from '../types/synth';
import type { TransportConfig } from '../types/transport';
import { tickToSeconds } from '../midi/utils';

/** Interval in ms between scheduling passes. */
const SCHEDULER_INTERVAL_MS = 25;

/** How far ahead (in seconds) to schedule notes. */
const LOOKAHEAD_SECONDS = 0.1;

/**
 * Lookahead note scheduler using the "Two Clocks" pattern (Chris Wilson).
 *
 * Uses a setInterval timer to periodically look ahead in AudioContext time
 * and schedule any notes that fall within the lookahead window via the
 * Web Audio API's precise timing.
 */
export class Scheduler {
  private audioContext: AudioContext;

  private song: Song | null = null;
  private engines: Map<string, InstrumentEngine> = new Map();
  private config: TransportConfig = {
    tempoScale: 1,
    loopEnabled: false,
    loopStartBar: 0,
    loopEndBar: 0,
  };

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentTick = 0;
  private playing = false;

  /**
   * AudioContext time corresponding to tick 0 (or the start-tick on resume).
   * All tick-to-time conversions are relative to this anchor.
   */
  private playbackStartTime = 0;

  /**
   * The seconds-offset that corresponds to `startTick` at the moment
   * playback began. This lets us map wall-clock time back to a tick.
   */
  private startTickSeconds = 0;

  /**
   * Set of "trackId:pitch:startTick" keys for notes already scheduled in
   * the current playback pass, so we never double-schedule.
   */
  private scheduledNotes: Set<string> = new Set();

  /** Optional callback invoked every scheduling pass with the current tick. */
  onTick: ((tick: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Begin playback from a given tick position.
   */
  start(
    song: Song,
    engines: Map<string, InstrumentEngine>,
    config: TransportConfig,
    startTick = 0,
  ): void {
    // Stop any existing playback first.
    this.clearInterval();

    this.song = song;
    this.engines = engines;
    this.config = { ...config };
    this.currentTick = startTick;
    this.playing = true;
    this.scheduledNotes.clear();

    // Compute the seconds offset for the starting tick so we can anchor
    // AudioContext.currentTime to the tick timeline.
    this.startTickSeconds = this.tickToScaledSeconds(startTick);
    this.playbackStartTime = this.audioContext.currentTime;

    this.intervalId = setInterval(() => this.schedulingPass(), SCHEDULER_INTERVAL_MS);
  }

  pause(): void {
    this.clearInterval();
    this.playing = false;
  }

  stop(): void {
    this.clearInterval();
    this.playing = false;
    this.currentTick = 0;
    this.scheduledNotes.clear();
  }

  seekToTick(tick: number): void {
    const wasPlaying = this.playing;
    this.clearInterval();
    this.scheduledNotes.clear();

    this.currentTick = tick;

    if (wasPlaying && this.song) {
      this.startTickSeconds = this.tickToScaledSeconds(tick);
      this.playbackStartTime = this.audioContext.currentTime;
      this.playing = true;
      this.intervalId = setInterval(() => this.schedulingPass(), SCHEDULER_INTERVAL_MS);
    }
  }

  seekToBar(barIndex: number, song: Song): void {
    const bars = song.tracks[0]?.bars;
    if (!bars || barIndex < 0 || barIndex >= bars.length) return;
    this.seekToTick(bars[barIndex].startTick);
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Update the config on the fly (e.g. tempo scale change).
   * If currently playing, restarts scheduling from the current tick.
   */
  updateConfig(config: TransportConfig): void {
    this.config = { ...config };
    if (this.playing && this.song) {
      // Restart from the current tick with the new config.
      this.start(this.song, this.engines, this.config, this.currentTick);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Convert a tick to seconds, scaled by tempoScale.
   * A tempoScale of 2 means twice as fast => half the duration.
   */
  private tickToScaledSeconds(tick: number): number {
    if (!this.song) return 0;
    const rawSeconds = tickToSeconds(tick, this.song.tempoMap, this.song.meta.ppq);
    return rawSeconds / this.config.tempoScale;
  }

  /**
   * Map an AudioContext wall-clock time to a tick position, taking
   * tempoScale into account.
   */
  private audioTimeToTick(audioTime: number): number {
    const elapsedAudio = audioTime - this.playbackStartTime;
    const elapsedScaledSeconds = this.startTickSeconds + elapsedAudio;
    // Invert: find tick whose scaled-seconds equals elapsedScaledSeconds.
    // We use a binary search over the tick range for efficiency.
    return this.scaledSecondsToTick(elapsedScaledSeconds);
  }

  /**
   * Inverse of tickToScaledSeconds using binary search.
   */
  private scaledSecondsToTick(targetSeconds: number): number {
    if (!this.song) return 0;
    const maxTick = this.song.meta.durationTicks;
    let lo = 0;
    let hi = maxTick;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.tickToScaledSeconds(mid) < targetSeconds) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /**
   * Convert a tick position to an AudioContext time suitable for scheduling.
   */
  private tickToAudioTime(tick: number): number {
    const tickSeconds = this.tickToScaledSeconds(tick);
    return this.playbackStartTime + (tickSeconds - this.startTickSeconds);
  }

  /**
   * Core scheduling pass — called every SCHEDULER_INTERVAL_MS.
   */
  private schedulingPass(): void {
    if (!this.song || !this.playing) return;

    const now = this.audioContext.currentTime;
    const lookaheadEnd = now + LOOKAHEAD_SECONDS;

    // Determine the tick window to scan.
    const windowStartTick = this.audioTimeToTick(now);
    let windowEndTick = this.audioTimeToTick(lookaheadEnd);

    // Update current tick for external consumers.
    this.currentTick = windowStartTick;

    // Handle loop boundary.
    if (this.config.loopEnabled) {
      const loopEndTick = this.getLoopEndTick();
      const loopStartTick = this.getLoopStartTick();

      if (windowStartTick >= loopEndTick) {
        // We've passed the loop end — jump back.
        this.seekToTick(loopStartTick);
        return;
      }

      // Clamp the window so we don't schedule past the loop end in this pass.
      if (windowEndTick > loopEndTick) {
        windowEndTick = loopEndTick;
      }
    }

    // Detect end of song.
    if (windowStartTick >= this.song.meta.durationTicks) {
      this.stop();
      this.onTick?.(this.currentTick);
      return;
    }

    // Schedule notes for every track.
    for (const track of this.song.tracks) {
      const engine = this.engines.get(track.id);
      if (!engine) continue;

      this.scheduleTrackNotes(track.bars, engine, track.id, windowStartTick, windowEndTick);
    }

    this.onTick?.(this.currentTick);
  }

  /**
   * Iterate over bars/notes for a single track and schedule any that
   * start within [windowStart, windowEnd).
   */
  private scheduleTrackNotes(
    bars: Bar[],
    engine: InstrumentEngine,
    trackId: string,
    windowStart: number,
    windowEnd: number,
  ): void {
    if (!this.song) return;

    for (const bar of bars) {
      // Skip bars that are entirely before or after the window.
      if (bar.endTick <= windowStart) continue;
      if (bar.startTick >= windowEnd) break;

      for (const note of bar.notes) {
        // Only schedule notes whose start falls in the window.
        if (note.startTick < windowStart || note.startTick >= windowEnd) continue;

        const noteKey = `${trackId}:${note.pitch}:${note.startTick}`;
        if (this.scheduledNotes.has(noteKey)) continue;
        this.scheduledNotes.add(noteKey);

        const noteOnTime = this.tickToAudioTime(note.startTick);
        const noteOffTick = note.startTick + note.durationTicks;
        const noteOffTime = this.tickToAudioTime(noteOffTick);

        engine.noteOn(note.pitch, note.velocity, noteOnTime);
        engine.noteOff(note.pitch, noteOffTime);
      }
    }
  }

  /**
   * Get the tick at the start of the loop region.
   */
  private getLoopStartTick(): number {
    if (!this.song) return 0;
    const bars = this.song.tracks[0]?.bars;
    if (!bars || this.config.loopStartBar >= bars.length) return 0;
    return bars[this.config.loopStartBar].startTick;
  }

  /**
   * Get the tick at the end of the loop region.
   */
  private getLoopEndTick(): number {
    if (!this.song) return 0;
    const bars = this.song.tracks[0]?.bars;
    if (!bars) return 0;
    const endBarIndex = Math.min(this.config.loopEndBar, bars.length - 1);
    return bars[endBarIndex].endTick;
  }
}
