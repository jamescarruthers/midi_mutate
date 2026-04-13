// ---------------------------------------------------------------------------
// Percussion staff rendering
// ---------------------------------------------------------------------------
import type { Bar } from '../types/song';
import { GM_DRUM_MAP } from '../utils/constants';
import { computeNoteX } from './layout';
import { COLORS, drawDrumHit } from './glyphs';

// ---------------------------------------------------------------------------
// Drum category → vertical position within the drum staff
// ---------------------------------------------------------------------------
type DrumCategory = 'kick' | 'snare' | 'hihat';

const DRUM_STAFF_LINES = 3;
const DRUM_LINE_SPACING = 16;
const DRUM_TOP_PAD = 30;

/**
 * Map a GM drum map label to one of the three staff rows.
 * Kick = bottom, snare = middle, hihat (open & closed) = top.
 */
function drumCategory(pitch: number): DrumCategory {
  const label = GM_DRUM_MAP[pitch] ?? '';
  if (label.startsWith('hihat')) return 'hihat';
  if (label.startsWith('snare')) return 'snare';
  if (label.startsWith('kick')) return 'kick';
  // Default unmapped percussion to snare row
  return 'snare';
}

function drumRowY(category: DrumCategory, staffY: number): number {
  const offsets: Record<DrumCategory, number> = {
    hihat: 0,
    snare: 1,
    kick: 2,
  };
  return staffY + DRUM_TOP_PAD + offsets[category] * DRUM_LINE_SPACING;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw the 3-line drum staff.
 */
export function drawDrumStaff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.staffLines;
  ctx.lineWidth = 1;

  for (let i = 0; i < DRUM_STAFF_LINES; i++) {
    const ly = y + DRUM_TOP_PAD + i * DRUM_LINE_SPACING;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + width, ly);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render all drum hits in a bar as X marks at the appropriate row positions.
 */
export function drawDrumBar(
  ctx: CanvasRenderingContext2D,
  bar: Bar,
  _barX: number,
  trackY: number,
  timeSignature: [number, number],
): void {
  for (const note of bar.notes) {
    const nx = computeNoteX(note, bar.index, timeSignature);
    const cat = drumCategory(note.pitch);
    const ny = drumRowY(cat, trackY);
    drawDrumHit(ctx, nx, ny);
  }
}
