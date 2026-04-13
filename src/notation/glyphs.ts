// ---------------------------------------------------------------------------
// Musical glyph drawing helpers for Canvas 2D
// ---------------------------------------------------------------------------
// Dark-theme palette
export const COLORS = {
  background: '#1a1a2e',
  staffLines: '#444',
  note: '#e0e0e0',
  accidental: '#aaa',
  barLine: '#666',
  highlight: '#4a9eff',
  cursor: '#4a9eff',
  rest: '#999',
  beam: '#e0e0e0',
  tie: '#888',
  text: '#ccc',
  dimText: '#777',
  drumHit: '#e0e0e0',
  headerBg: '#16162a',
  barHighlight: 'rgba(74, 158, 255, 0.08)',
} as const;

// ---------------------------------------------------------------------------
// Treble clef (simplified drawn shape)
// ---------------------------------------------------------------------------
export function drawTrebleClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.font = 'bold 42px serif';
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'middle';
  // Unicode treble clef works in most system fonts
  ctx.fillText('\u{1D11E}', x, y + 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bass clef (simplified)
// ---------------------------------------------------------------------------
export function drawBassClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.font = 'bold 38px serif';
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'middle';
  ctx.fillText('\u{1D122}', x, y + 6);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Staff lines — 5 horizontal lines evenly spaced within the staff height
// ---------------------------------------------------------------------------
export function drawStaffLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void {
  const lineSpacing = 12;
  const topPad = 20; // first line offset from the top of the staff area

  ctx.save();
  ctx.strokeStyle = COLORS.staffLines;
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i++) {
    const ly = y + topPad + i * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + width, ly);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bar line
// ---------------------------------------------------------------------------
export function drawBarLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.barLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Note head (ellipse, filled or open)
// ---------------------------------------------------------------------------
export function drawNoteHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  filled: boolean,
): void {
  const rx = 5;
  const ry = 3.8;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2);

  if (filled) {
    ctx.fillStyle = COLORS.note;
    ctx.fill();
  } else {
    ctx.strokeStyle = COLORS.note;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Stem
// ---------------------------------------------------------------------------
const STEM_LENGTH = 30;

export function drawStem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'up' | 'down',
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.note;
  ctx.lineWidth = 1.2;

  const xOff = direction === 'up' ? 4.5 : -4.5;
  const endY = direction === 'up' ? y - STEM_LENGTH : y + STEM_LENGTH;

  ctx.beginPath();
  ctx.moveTo(x + xOff, y);
  ctx.lineTo(x + xOff, endY);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Beam connecting eighth+ notes
// ---------------------------------------------------------------------------
export function drawBeam(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.beam;
  const thickness = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y2 + thickness);
  ctx.lineTo(x1, y1 + thickness);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Accidental (sharp / flat)
// ---------------------------------------------------------------------------
export function drawAccidental(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'sharp' | 'flat',
): void {
  ctx.save();
  ctx.fillStyle = COLORS.accidental;
  ctx.font = '13px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(type === 'sharp' ? '♯' : '♭', x - 7, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tie — quadratic Bézier arc between two note positions
// ---------------------------------------------------------------------------
export function drawTie(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.tie;
  ctx.lineWidth = 1.2;

  const midX = (x1 + x2) / 2;
  const cpY = Math.min(y1, y2) - 14;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, cpY, x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rest symbols (simplified)
// ---------------------------------------------------------------------------
export function drawRest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  beats: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.rest;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  if (beats >= 4) {
    // Whole rest — filled rectangle hanging from a line
    ctx.fillRect(x - 7, y - 4, 14, 5);
  } else if (beats >= 2) {
    // Half rest — filled rectangle sitting on a line
    ctx.fillRect(x - 7, y, 14, 5);
  } else {
    // Quarter rest — stylised squiggle approximated as text
    ctx.font = '18px serif';
    ctx.fillText('𝄾', x, y);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Time signature (two stacked numbers)
// ---------------------------------------------------------------------------
export function drawTimeSignature(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  numerator: number,
  denominator: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(String(numerator), x, y + 26);
  ctx.fillText(String(denominator), x, y + 44);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Playback cursor — bright vertical line
// ---------------------------------------------------------------------------
export function drawPlaybackCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.cursor;
  ctx.lineWidth = 2;
  ctx.shadowColor = COLORS.cursor;
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bar highlight — semi-transparent overlay on the current bar
// ---------------------------------------------------------------------------
export function drawBarHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.barHighlight;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drum hit — X mark
// ---------------------------------------------------------------------------
export function drawDrumHit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const size = 4;

  ctx.save();
  ctx.strokeStyle = COLORS.drumHit;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  ctx.restore();
}
