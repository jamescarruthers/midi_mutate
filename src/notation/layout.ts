import type { Note } from '../types/song';

/** Pixels per bar in 4/4 time */
export const BAR_WIDTH = 200;

/** Pixels for one staff system (single track) */
export const STAFF_HEIGHT = 120;

/** Padding between tracks */
export const TRACK_PADDING = 20;

/** Left margin for track name / clef */
export const HEADER_WIDTH = 140;

/** Internal left padding within a bar for the first note */
const BAR_LEFT_PAD = 12;

/** Internal right padding within a bar after the last beat */
const BAR_RIGHT_PAD = 8;

/**
 * Scale BAR_WIDTH for time signatures other than 4/4.
 * A 3/4 bar is 75% the width of a 4/4 bar, a 6/8 bar is 75%, etc.
 */
export function scaledBarWidth(timeSignature: [number, number]): number {
  const [numerator, denominator] = timeSignature;
  const beats = numerator * (4 / denominator);
  return BAR_WIDTH * (beats / 4);
}

/**
 * X position of a bar's left edge.
 * For simplicity we use a fixed BAR_WIDTH (4/4). Variable-width bars would
 * require a prefix-sum but that is beyond the scope of this simplified renderer.
 */
export function computeBarX(barIndex: number): number {
  return HEADER_WIDTH + barIndex * BAR_WIDTH;
}

/**
 * X position of a note within its bar, based on startBeat.
 * Notes are positioned proportionally across the usable bar width.
 */
export function computeNoteX(
  note: Note,
  barIndex: number,
  timeSignature: [number, number],
): number {
  const [numerator, denominator] = timeSignature;
  const totalBeats = numerator * (4 / denominator);
  const barX = computeBarX(barIndex);
  const usable = BAR_WIDTH - BAR_LEFT_PAD - BAR_RIGHT_PAD;
  const fraction = note.startBeat / totalBeats;
  return barX + BAR_LEFT_PAD + fraction * usable;
}

/**
 * Y offset within a staff for a given MIDI pitch.
 *
 * Pitched instruments:
 *   Middle C (60) sits at the staff baseline (bottom line of treble staff).
 *   Each semitone moves ~2.5 px.  Higher pitches go UP (lower y).
 *   We clamp the result so notes don't fly off-screen.
 *
 * Drums are handled separately (see DrumNotation).
 */
export function computeNoteY(pitch: number, isDrum: boolean): number {
  if (isDrum) {
    // Drum y is handled by DrumNotation; return a sensible default.
    return STAFF_HEIGHT / 2;
  }

  const baseline = STAFF_HEIGHT - 20; // bottom of usable area
  const pxPerSemitone = 2.5;
  const offset = (pitch - 60) * pxPerSemitone;
  const y = baseline - offset;

  // Clamp to keep within [4, STAFF_HEIGHT - 4]
  return Math.max(4, Math.min(STAFF_HEIGHT - 4, y));
}

/**
 * Y offset for a given track system.
 */
export function computeTrackY(trackIndex: number): number {
  return trackIndex * (STAFF_HEIGHT + TRACK_PADDING);
}

/**
 * Returns [startBar, endBar) indices of bars visible given the current
 * horizontal scroll and viewport width.
 */
export function getVisibleBarRange(
  scrollX: number,
  viewportWidth: number,
): [number, number] {
  const start = Math.max(0, Math.floor((scrollX - HEADER_WIDTH) / BAR_WIDTH));
  const end = Math.ceil((scrollX + viewportWidth - HEADER_WIDTH) / BAR_WIDTH) + 1;
  return [start, Math.max(start, end)];
}
