import type { Bar, Note, TempoEvent, TimeSigEvent } from '../types/song';
import { getTempoAtTick } from './utils';

/**
 * Represents a raw note extracted from the MIDI file before bar assignment.
 */
export interface RawNote {
  pitch: number;
  velocity: number;
  startTick: number;
  durationTicks: number;
}

/**
 * Represents the boundaries and metadata for a single bar.
 */
export interface BarBoundary {
  index: number;
  startTick: number;
  endTick: number;
  timeSignature: [number, number];
  tempo: number;
}

/**
 * Compute bar boundaries from time signatures, tempo map, and total duration.
 *
 * Each bar's length in ticks is derived from the time signature:
 *   barLengthTicks = numerator * (4 / denominator) * ppq
 *
 * For example, in 4/4 at ppq=480: 4 * (4/4) * 480 = 1920 ticks per bar.
 * In 3/4: 3 * (4/4) * 480 = 1440 ticks per bar.
 * In 6/8: 6 * (4/8) * 480 = 1440 ticks per bar.
 */
export function computeBarBoundaries(
  durationTicks: number,
  timeSignatures: TimeSigEvent[],
  ppq: number
): BarBoundary[] {
  const boundaries: BarBoundary[] = [];

  // Default to 4/4 if no time signature events
  const timeSigs: TimeSigEvent[] = timeSignatures.length > 0
    ? [...timeSignatures].sort((a, b) => a.tick - b.tick)
    : [{ tick: 0, numerator: 4, denominator: 4 }];

  let barIndex = 0;
  let currentTick = 0;

  for (let i = 0; i < timeSigs.length; i++) {
    const sig = timeSigs[i];
    const numerator = sig.numerator;
    const denominator = sig.denominator;
    const barLengthTicks = numerator * (4 / denominator) * ppq;

    // Determine how far this time signature extends
    const nextSigTick = i + 1 < timeSigs.length ? timeSigs[i + 1].tick : durationTicks;

    // If we're behind the time signature change tick, catch up
    // (the first time sig might not be at tick 0)
    if (i === 0 && sig.tick > 0) {
      // Fill bars before the first time signature with default 4/4
      const defaultBarLength = 4 * ppq;
      while (currentTick < sig.tick) {
        const endTick = Math.min(currentTick + defaultBarLength, sig.tick);
        boundaries.push({
          index: barIndex,
          startTick: currentTick,
          endTick,
          timeSignature: [4, 4],
          tempo: getTempoAtTick(currentTick, []),
        });
        barIndex++;
        currentTick = endTick;
      }
    }

    // Align currentTick to the time signature change point
    if (currentTick < sig.tick) {
      currentTick = sig.tick;
    }

    while (currentTick < nextSigTick) {
      const endTick = Math.min(currentTick + barLengthTicks, durationTicks);
      if (endTick <= currentTick) break;

      boundaries.push({
        index: barIndex,
        startTick: currentTick,
        endTick,
        timeSignature: [numerator, denominator],
        tempo: 0, // Will be filled in by quantiseTrack
      });
      barIndex++;
      currentTick = endTick;

      if (currentTick >= durationTicks) break;
    }

    if (currentTick >= durationTicks) break;
  }

  return boundaries;
}

let tieIdCounter = 0;

function generateTieId(): string {
  tieIdCounter++;
  return `tie_${tieIdCounter}_${Date.now().toString(36)}`;
}

/**
 * Assign notes to bars, splitting notes that cross bar boundaries with tie information.
 * Computes startBeat and durationBeats for each note within its bar.
 */
export function quantiseTrack(
  notes: RawNote[],
  barBoundaries: BarBoundary[],
  tempoMap: TempoEvent[]
): Bar[] {
  // Fill in tempo for each bar boundary
  const boundaries = barBoundaries.map((b) => ({
    ...b,
    tempo: getTempoAtTick(b.startTick, tempoMap),
  }));

  // Initialize empty bars
  const bars: Bar[] = boundaries.map((b) => ({
    index: b.index,
    startTick: b.startTick,
    endTick: b.endTick,
    timeSignature: b.timeSignature,
    tempo: b.tempo,
    notes: [],
  }));

  if (bars.length === 0) {
    return bars;
  }

  // Sort notes by start tick for efficient processing
  const sortedNotes = [...notes].sort((a, b) => a.startTick - b.startTick);

  for (const rawNote of sortedNotes) {
    const noteStart = rawNote.startTick;
    const noteEnd = rawNote.startTick + rawNote.durationTicks;

    // Find the bar that contains the note's start tick
    const startBarIdx = findBarIndex(bars, noteStart);
    if (startBarIdx === -1) continue;

    // Find the bar that contains the note's end tick
    const endBarIdx = findBarIndex(bars, noteEnd - 1);
    const lastBarIdx = endBarIdx === -1 ? bars.length - 1 : endBarIdx;

    if (startBarIdx === lastBarIdx) {
      // Note fits entirely within one bar
      const bar = bars[startBarIdx];
      const ppqFromTimeSig = computeBarPpq(bar);
      bars[startBarIdx].notes.push({
        pitch: rawNote.pitch,
        velocity: rawNote.velocity,
        startTick: rawNote.startTick,
        durationTicks: rawNote.durationTicks,
        startBeat: (rawNote.startTick - bar.startTick) / ppqFromTimeSig,
        durationBeats: rawNote.durationTicks / ppqFromTimeSig,
      });
    } else {
      // Note spans multiple bars — split it
      let previousTieId: string | undefined;

      for (let barIdx = startBarIdx; barIdx <= lastBarIdx; barIdx++) {
        const bar = bars[barIdx];
        const ppqFromTimeSig = computeBarPpq(bar);

        const segStart = Math.max(rawNote.startTick, bar.startTick);
        const segEnd = Math.min(noteEnd, bar.endTick);
        const segDuration = segEnd - segStart;

        if (segDuration <= 0) continue;

        const isFirst = barIdx === startBarIdx;
        const isLast = barIdx === lastBarIdx;

        const tieId = !isLast ? generateTieId() : undefined;

        const note: Note = {
          pitch: rawNote.pitch,
          velocity: rawNote.velocity,
          startTick: segStart,
          durationTicks: segDuration,
          startBeat: (segStart - bar.startTick) / ppqFromTimeSig,
          durationBeats: segDuration / ppqFromTimeSig,
        };

        if (!isFirst && previousTieId) {
          note.tiedFrom = previousTieId;
        }

        if (!isLast && tieId) {
          note.tiedTo = tieId;
        }

        bars[barIdx].notes.push(note);
        previousTieId = tieId;
      }
    }
  }

  return bars;
}

/**
 * Find which bar a tick belongs to using binary search.
 */
function findBarIndex(bars: Bar[], tick: number): number {
  if (bars.length === 0) return -1;
  if (tick < bars[0].startTick) return -1;
  if (tick >= bars[bars.length - 1].endTick) return -1;

  let lo = 0;
  let hi = bars.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const bar = bars[mid];

    if (tick < bar.startTick) {
      hi = mid - 1;
    } else if (tick >= bar.endTick) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  return -1;
}

/**
 * Compute the tick duration of one beat in a bar based on its time signature.
 * A "beat" is one quarter note in standard time signatures.
 * For compound meters (denominator 8), we still use quarter-note beats
 * to be consistent with PPQ (pulses per quarter note).
 *
 * This returns PPQ-equivalent ticks per beat unit for the bar.
 * Since PPQ is defined as ticks per quarter note, one beat = ppq ticks
 * when time signature denominator is 4. For denominator 8, one eighth
 * note = ppq/2 ticks, etc.
 *
 * We compute this from bar length: barTicks / numerator * (denominator / 4)
 * which simplifies to ppq (ticks per quarter note).
 *
 * Actually, to convert ticks to beats within a bar, we want:
 *   beat = tickOffsetInBar / ticksPerBeatUnit
 * where ticksPerBeatUnit = ppq * (4 / denominator)
 * So for 4/4: ticksPerBeatUnit = ppq * 1 = ppq
 * For 6/8: ticksPerBeatUnit = ppq * 0.5 = ppq/2
 *
 * We derive ppq from the bar's tick length:
 *   barTicks = numerator * (4 / denominator) * ppq
 *   ppq = barTicks * denominator / (numerator * 4)
 *   ticksPerBeatUnit = (barTicks * denominator / (numerator * 4)) * (4 / denominator)
 *                    = barTicks / numerator
 *
 * So one beat = barTicks / numerator, meaning startBeat ranges from 0 to numerator.
 */
function computeBarPpq(bar: Bar): number {
  const barTicks = bar.endTick - bar.startTick;
  const [numerator] = bar.timeSignature;
  return barTicks / numerator;
}
