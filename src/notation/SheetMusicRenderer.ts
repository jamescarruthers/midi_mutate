import type { Song, Bar, Track } from '../types/song';
import { DRUM_CHANNEL } from '../utils/constants';
import {
  BAR_WIDTH,
  STAFF_HEIGHT,
  TRACK_PADDING,
  HEADER_WIDTH,
  computeBarX,
  computeNoteX,
  computeNoteY,
  computeTrackY,
  getVisibleBarRange,
} from './layout';
import { COLORS } from './glyphs';
import { drawDrumStaff, drawDrumBar } from './DrumNotation';

// ---------------------------------------------------------------------------
// Lookup tables (avoid per-frame work)
// ---------------------------------------------------------------------------
const BLACK_KEY = new Uint8Array(12);
BLACK_KEY[1] = 1; // C#
BLACK_KEY[3] = 1; // D#
BLACK_KEY[6] = 1; // F#
BLACK_KEY[8] = 1; // G#
BLACK_KEY[10] = 1; // A#

function isBlackKey(pitch: number): boolean {
  return BLACK_KEY[pitch % 12] === 1;
}

function stemDirection(pitch: number): 'up' | 'down' {
  return pitch >= 71 ? 'down' : 'up';
}

function isFilledNote(durationBeats: number): boolean {
  return durationBeats < 2;
}

// ---------------------------------------------------------------------------
// SheetMusicRenderer
// ---------------------------------------------------------------------------
export class SheetMusicRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Cannot get 2D context from canvas');
    this.ctx = context;
  }

  // -----------------------------------------------------------------------
  // Main render — canvas is viewport-sized, we translate for scroll.
  // -----------------------------------------------------------------------
  render(
    song: Song,
    scrollX: number,
    currentTick: number,
    currentBarIndex: number,
    dpr: number,
  ): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Logical viewport size
    const width = cw / dpr;
    const height = ch / dpr;

    // 1. Clear only the viewport
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // 2. Visible bar range
    const [startBar, endBar] = getVisibleBarRange(scrollX, width);

    // 3. Per-track rendering
    for (let ti = 0; ti < song.tracks.length; ti++) {
      const track = song.tracks[ti];
      const trackY = computeTrackY(ti);
      if (trackY > scrollX + height + STAFF_HEIGHT) break; // off-screen below (no vertical scroll yet but defensive)
      const isDrum = track.channel === DRUM_CHANNEL;

      // a. Track header (fixed at left)
      this.drawTrackHeader(ctx, track, trackY, isDrum);

      // b. Staff lines — draw once across visible area
      const staffX = HEADER_WIDTH;
      const staffW = width - HEADER_WIDTH;
      if (isDrum) {
        drawDrumStaff(ctx, staffX, trackY, staffW);
      } else {
        this.drawStaffLinesFast(ctx, staffX, trackY, staffW);
      }

      // c–f. Visible bars
      const maxBar = Math.min(endBar, track.bars.length);
      let prevTimeSig: number = -1; // encoded numerator*100+denominator

      for (let bi = startBar; bi < maxBar; bi++) {
        const bar = track.bars[bi];
        if (!bar) continue;

        const barX = computeBarX(bi) - scrollX;

        // Bar line
        ctx.strokeStyle = COLORS.barLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX, trackY + 16);
        ctx.lineTo(barX, trackY + STAFF_HEIGHT - 16);
        ctx.stroke();

        // Time signature when it changes
        const sigKey = bar.timeSignature[0] * 100 + bar.timeSignature[1];
        if (sigKey !== prevTimeSig) {
          ctx.fillStyle = COLORS.text;
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(bar.timeSignature[0]), barX + 8, trackY + 26);
          ctx.fillText(String(bar.timeSignature[1]), barX + 8, trackY + 44);
          prevTimeSig = sigKey;
        }

        // Beat grid
        this.drawBeatGrid(ctx, bar, barX, trackY);

        // Current bar highlight
        if (bi === currentBarIndex) {
          ctx.fillStyle = COLORS.barHighlight;
          ctx.fillRect(barX, trackY, BAR_WIDTH, STAFF_HEIGHT);
        }

        // Notes
        if (isDrum) {
          drawDrumBar(ctx, bar, barX, trackY, bar.timeSignature);
        } else {
          this.renderBarNotes(ctx, bar, bi, trackY, scrollX);
        }
      }

      // Final bar line
      if (maxBar > startBar) {
        const lastBarX = computeBarX(maxBar) - scrollX;
        ctx.strokeStyle = COLORS.barLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastBarX, trackY + 16);
        ctx.lineTo(lastBarX, trackY + STAFF_HEIGHT - 16);
        ctx.stroke();
      }
    }

    // 4. Playback cursor
    this.drawCursor(ctx, song, scrollX, currentTick, currentBarIndex, height);
  }

  // -----------------------------------------------------------------------
  // Fast staff lines — no save/restore
  // -----------------------------------------------------------------------
  private drawStaffLinesFast(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
  ): void {
    ctx.strokeStyle = COLORS.staffLines;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ly = y + 20 + i * 12;
      ctx.moveTo(x, ly);
      ctx.lineTo(x + width, ly);
    }
    ctx.stroke();
  }

  // -----------------------------------------------------------------------
  // Track header
  // -----------------------------------------------------------------------
  private drawTrackHeader(
    ctx: CanvasRenderingContext2D,
    track: Track,
    trackY: number,
    isDrum: boolean,
  ): void {
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, trackY, HEADER_WIDTH, STAFF_HEIGHT);

    ctx.strokeStyle = COLORS.barLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(HEADER_WIDTH, trackY);
    ctx.lineTo(HEADER_WIDTH, trackY + STAFF_HEIGHT);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const name = track.name.length > 16 ? track.name.slice(0, 15) + '\u2026' : track.name;
    ctx.fillText(name, 8, trackY + 8);

    ctx.fillStyle = COLORS.dimText;
    ctx.font = '11px sans-serif';
    ctx.fillText(isDrum ? 'Perc.' : 'Treble', 8, trackY + 26);
  }

  // -----------------------------------------------------------------------
  // Beat grid — batch into one path, use dashed line set once
  // -----------------------------------------------------------------------
  private drawBeatGrid(
    ctx: CanvasRenderingContext2D,
    bar: Bar,
    barX: number,
    trackY: number,
  ): void {
    const [numerator, denominator] = bar.timeSignature;
    const totalBeats = numerator * (4 / denominator);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();

    for (let beat = 1; beat < totalBeats; beat++) {
      const frac = beat / totalBeats;
      const x = barX + 12 + frac * (BAR_WIDTH - 20);
      ctx.moveTo(x, trackY + 20);
      ctx.lineTo(x, trackY + STAFF_HEIGHT - 20);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }

  // -----------------------------------------------------------------------
  // Render notes — batched paths, minimal state changes
  // -----------------------------------------------------------------------
  private renderBarNotes(
    ctx: CanvasRenderingContext2D,
    bar: Bar,
    barIndex: number,
    trackY: number,
    scrollX: number,
  ): void {
    const ts = bar.timeSignature;
    const notes = bar.notes;
    if (notes.length === 0) return;

    // Pre-compute all note positions
    const len = notes.length;
    const xs = new Float64Array(len);
    const ys = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      xs[i] = computeNoteX(notes[i], barIndex, ts) - scrollX;
      ys[i] = trackY + computeNoteY(notes[i].pitch, false);
    }

    // --- Pass 1: Draw all accidentals ---
    ctx.fillStyle = COLORS.accidental;
    ctx.font = '13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i < len; i++) {
      if (isBlackKey(notes[i].pitch)) {
        ctx.fillText('\u266F', xs[i] - 7, ys[i]);
      }
    }

    // --- Pass 2: Draw all filled noteheads in one path ---
    ctx.fillStyle = COLORS.note;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      if (isFilledNote(notes[i].durationBeats)) {
        ctx.moveTo(xs[i] + 5, ys[i]);
        ctx.ellipse(xs[i], ys[i], 5, 3.8, -0.2, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // --- Pass 3: Draw all open noteheads in one path ---
    ctx.strokeStyle = COLORS.note;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      if (!isFilledNote(notes[i].durationBeats)) {
        ctx.moveTo(xs[i] + 5, ys[i]);
        ctx.ellipse(xs[i], ys[i], 5, 3.8, -0.2, 0, Math.PI * 2);
      }
    }
    ctx.stroke();

    // --- Pass 4: Draw all stems in one path ---
    ctx.strokeStyle = COLORS.note;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      if (notes[i].durationBeats >= 4) continue; // whole notes = no stem
      const dir = stemDirection(notes[i].pitch);
      const xOff = dir === 'up' ? 4.5 : -4.5;
      const endY = dir === 'up' ? ys[i] - 30 : ys[i] + 30;
      ctx.moveTo(xs[i] + xOff, ys[i]);
      ctx.lineTo(xs[i] + xOff, endY);
    }
    ctx.stroke();

    // --- Pass 5: Beams ---
    // Collect beam groups: consecutive eighth+ notes
    ctx.fillStyle = COLORS.beam;
    let groupStart = -1;
    for (let i = 0; i <= len; i++) {
      const isBeamable = i < len && notes[i].durationBeats <= 0.5;
      if (isBeamable && groupStart === -1) {
        groupStart = i;
      } else if (!isBeamable && groupStart !== -1) {
        const groupEnd = i;
        if (groupEnd - groupStart >= 2) {
          ctx.beginPath();
          for (let j = groupStart; j < groupEnd - 1; j++) {
            const dir = stemDirection(notes[j].pitch);
            const xOff = dir === 'up' ? 4.5 : -4.5;
            const y1 = dir === 'up' ? ys[j] - 30 : ys[j] + 30;
            const dir2 = stemDirection(notes[j + 1].pitch);
            const xOff2 = dir2 === 'up' ? 4.5 : -4.5;
            const y2 = dir2 === 'up' ? ys[j + 1] - 30 : ys[j + 1] + 30;
            ctx.moveTo(xs[j] + xOff, y1);
            ctx.lineTo(xs[j + 1] + xOff2, y2);
            ctx.lineTo(xs[j + 1] + xOff2, y2 + 3);
            ctx.lineTo(xs[j] + xOff, y1 + 3);
            ctx.closePath();
          }
          ctx.fill();
        }
        groupStart = -1;
      }
    }

    // --- Pass 6: Ties ---
    ctx.strokeStyle = COLORS.tie;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < len; i++) {
      if (notes[i].tiedTo) {
        const x1 = xs[i] + 5;
        const y1 = ys[i] - 2;
        const x2 = xs[i] + 25;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(midX, y1 - 14, x2, y1);
        ctx.stroke();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Playback cursor — no shadow, uses currentBarIndex directly
  // -----------------------------------------------------------------------
  private drawCursor(
    ctx: CanvasRenderingContext2D,
    song: Song,
    scrollX: number,
    currentTick: number,
    currentBarIndex: number,
    viewportHeight: number,
  ): void {
    if (song.tracks.length === 0) return;
    const bars = song.tracks[0].bars;
    if (currentBarIndex < 0 || currentBarIndex >= bars.length) return;

    const cursorBar = bars[currentBarIndex];
    const barX = computeBarX(cursorBar.index) - scrollX;
    const barLen = cursorBar.endTick - cursorBar.startTick;
    const tickFrac = barLen > 0 ? (currentTick - cursorBar.startTick) / barLen : 0;
    const cursorX = barX + 12 + tickFrac * (BAR_WIDTH - 20);

    const totalH = Math.min(
      song.tracks.length * (STAFF_HEIGHT + TRACK_PADDING),
      viewportHeight,
    );

    ctx.strokeStyle = COLORS.cursor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, totalH);
    ctx.stroke();
  }

  // -----------------------------------------------------------------------
  // Public query helpers
  // -----------------------------------------------------------------------
  getBarAtX(x: number, scrollX: number): number {
    return Math.floor((x + scrollX - HEADER_WIDTH) / BAR_WIDTH);
  }

  getTotalWidth(song: Song): number {
    const maxBars = Math.max(...song.tracks.map((t) => t.bars.length), 0);
    return HEADER_WIDTH + maxBars * BAR_WIDTH;
  }

  getTrackAtY(y: number, song: Song): number {
    const trackUnit = STAFF_HEIGHT + TRACK_PADDING;
    const idx = Math.floor(y / trackUnit);
    return Math.max(0, Math.min(song.tracks.length - 1, idx));
  }
}
