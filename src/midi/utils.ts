import type { TempoEvent } from '../types/song';

/**
 * Get the BPM at a given tick position by finding the most recent tempo event.
 * Defaults to 120 BPM if no tempo events exist or the tick is before the first event.
 */
export function getTempoAtTick(tick: number, tempoMap: TempoEvent[]): number {
  if (tempoMap.length === 0) {
    return 120;
  }

  let bpm = tempoMap[0].bpm;
  for (const event of tempoMap) {
    if (event.tick <= tick) {
      bpm = event.bpm;
    } else {
      break;
    }
  }
  return bpm;
}

/**
 * Convert a tick position to seconds using the tempo map.
 * Walks through each tempo segment and accumulates time.
 */
export function tickToSeconds(tick: number, tempoMap: TempoEvent[], ppq: number): number {
  if (tempoMap.length === 0) {
    // Default 120 BPM
    const secondsPerTick = 60 / (120 * ppq);
    return tick * secondsPerTick;
  }

  let seconds = 0;
  let prevTick = 0;
  let currentBpm = tempoMap[0].tick === 0 ? tempoMap[0].bpm : 120;

  // If the first tempo event is not at tick 0, use default 120 BPM for the initial segment
  if (tempoMap[0].tick > 0) {
    const segmentEnd = Math.min(tick, tempoMap[0].tick);
    const secondsPerTick = 60 / (120 * ppq);
    seconds += segmentEnd * secondsPerTick;
    prevTick = tempoMap[0].tick;
    if (tick <= tempoMap[0].tick) {
      return seconds;
    }
  }

  for (let i = 0; i < tempoMap.length; i++) {
    const event = tempoMap[i];
    if (i > 0 || event.tick === 0) {
      currentBpm = event.bpm;
      prevTick = event.tick;
    }

    const nextEventTick = i + 1 < tempoMap.length ? tempoMap[i + 1].tick : Infinity;
    const segmentEnd = Math.min(tick, nextEventTick);

    if (segmentEnd > prevTick) {
      const deltaTicks = segmentEnd - prevTick;
      const secondsPerTick = 60 / (currentBpm * ppq);
      seconds += deltaTicks * secondsPerTick;
    }

    if (tick <= nextEventTick) {
      break;
    }

    prevTick = nextEventTick;
  }

  return seconds;
}

/**
 * Convert seconds to tick position using the tempo map.
 * Inverse of tickToSeconds — walks through tempo segments.
 */
export function secondsToTick(seconds: number, tempoMap: TempoEvent[], ppq: number): number {
  if (tempoMap.length === 0) {
    const ticksPerSecond = (120 * ppq) / 60;
    return Math.round(seconds * ticksPerSecond);
  }

  let remainingSeconds = seconds;
  let currentTick = 0;
  let currentBpm = tempoMap[0].tick === 0 ? tempoMap[0].bpm : 120;

  // Handle segment before first tempo event if it's not at tick 0
  if (tempoMap[0].tick > 0) {
    const secondsPerTick = 60 / (120 * ppq);
    const segmentDuration = tempoMap[0].tick * secondsPerTick;
    if (remainingSeconds <= segmentDuration) {
      return Math.round(remainingSeconds / secondsPerTick);
    }
    remainingSeconds -= segmentDuration;
    currentTick = tempoMap[0].tick;
  }

  for (let i = 0; i < tempoMap.length; i++) {
    currentBpm = tempoMap[i].bpm;
    currentTick = tempoMap[i].tick;

    const nextEventTick = i + 1 < tempoMap.length ? tempoMap[i + 1].tick : Infinity;
    const secondsPerTick = 60 / (currentBpm * ppq);

    if (nextEventTick === Infinity) {
      // Last segment — consume all remaining seconds
      return Math.round(currentTick + remainingSeconds / secondsPerTick);
    }

    const segmentTicks = nextEventTick - currentTick;
    const segmentDuration = segmentTicks * secondsPerTick;

    if (remainingSeconds <= segmentDuration) {
      return Math.round(currentTick + remainingSeconds / secondsPerTick);
    }

    remainingSeconds -= segmentDuration;
  }

  // Fallback (shouldn't reach here)
  const secondsPerTick = 60 / (currentBpm * ppq);
  return Math.round(currentTick + remainingSeconds / secondsPerTick);
}

/**
 * Convert a tick position to a beat number (0-based).
 * One beat = one quarter note = ppq ticks.
 */
export function tickToBeat(tick: number, ppq: number): number {
  return tick / ppq;
}
