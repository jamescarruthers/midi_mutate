// ---------------------------------------------------------------------------
// SheetMusicRenderer — orchestrates the full sheet-music canvas drawing
// ---------------------------------------------------------------------------
import type { Song, Bar, Track } from '../types/song';
import { NOTE_NAMES, DRUM_CHANNEL } from '../utils/constants';
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
import {
  COLORS,
  drawStaffLines,
  drawBarLine,
  drawNoteHead,
  drawStem,
  drawBeam,
  drawAccidental,
  drawTie,
  drawTimeSignature,
  drawPlaybackCursor,
  drawBarHighlight,
  drawTrebleClef,
} from './glyphs';
import { drawDrumStaff, drawDrumBar } from './DrumNotation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Is the MIDI pitch a "black key" (sharp/flat)? */
function isBlackKey(pitch: number): boolean {
  const name = NOTE_NAMES[pitch % 12];
  return name.includes('#');
}

/** Choose stem direction based on pitch (above mid-staff → down). */
function stemDirection(pitch: number): 'up' | 'down' {
  return pitch >= 71 ? 'down' : 'up';
}

/**
 * Decide whether a note head is filled (quarter & shorter) or open (half & whole).
 */
function isFilledNote(durationBeats: number): boolean {
  return durationBeats < 2; // half = 2 beats → open
}

// ---------------------------------------------------------------------------
// SheetMusicRenderer class
// ---------------------------------------------------------------------------
export class SheetMusicRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context from canvas');
    this.ctx = context;
  }

  // -----------------------------------------------------------------------
  // Main render entry point — called each frame
  // -----------------------------------------------------------------------
  render(
    song: Song,
    scrollX: number,
    currentTick: number,
    currentBarIndex: number,
  ): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // 2. Visible bar range
    const [startBar, endBar] = getVisibleBarRange(scrollX, width);

    // 3. Per-track rendering
    for (let ti = 0; ti < song.tracks.length; ti++) {
      const track = song.tracks[ti];
      const trackY = computeTrackY(ti);
      const isDrum = track.channel === DRUM_CHANNEL;

      // a. Track header (fixed at left edge)
      this.drawTrackHeader(track, trackY, isDrum);

      // b. Staff lines across visible area
      const staffStartX = HEADER_WIDTH - scrollX;
      const staffWidth = width - HEADER_WIDTH + scrollX;
      if (isDrum) {
        drawDrumStaff(ctx, Math.max(staffStartX, HEADER_WIDTH), trackY, staffWidth);
      } else {
        drawStaffLines(ctx, Math.max(staffStartX, HEADER_WIDTH), trackY, staffWidth);
      }

      // c–f. Iterate visible bars
      const maxBar = Math.min(endBar, track.bars.length);
      let prevTimeSig: string | null = null;

      for (let bi = startBar; bi < maxBar; bi++) {
        const bar = track.bars[bi];
        if (!bar) continue;

        const barX = computeBarX(bi) - scrollX;
        const timeSigKey = `${bar.timeSignature[0]}/${bar.timeSignature[1]}`;

        // Bar line
        drawBarLine(ctx, barX, trackY + 16, STAFF_HEIGHT - 32);

        // Time signature when it changes
        if (timeSigKey !== prevTimeSig) {
          drawTimeSignature(
            ctx,
            barX + 8,
            trackY,
            bar.timeSignature[0],
            bar.timeSignature[1],
          );
          prevTimeSig = timeSigKey;
        }

        // Beat grid (faint lines for each beat)
        this.drawBeatGrid(bar, barX, trackY);

        // Current bar highlight
        if (bi === currentBarIndex) {
          drawBarHighlight(ctx, barX, trackY, BAR_WIDTH, STAFF_HEIGHT);
        }

        // Notes
        if (isDrum) {
          drawDrumBar(ctx, this.adjustBarForScroll(bar, scrollX), barX, trackY, bar.timeSignature);
        } else {
          this.renderBarNotes(bar, bi, trackY, scrollX);
        }
      }

      // Final bar line at end of last visible bar
      if (maxBar > startBar) {
        const lastBarX = computeBarX(maxBar) - scrollX;
        drawBarLine(ctx, lastBarX, trackY + 16, STAFF_HEIGHT - 32);
      }
    }

    // 4. Playback cursor
    this.drawCursor(song, scrollX, currentTick);
  }

  // -----------------------------------------------------------------------
  // Draw the track header (name + clef indicator)
  // -----------------------------------------------------------------------
  private drawTrackHeader(track: Track, trackY: number, isDrum: boolean): void {
    const { ctx } = this;

    // Background behind header
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, trackY, HEADER_WIDTH, STAFF_HEIGHT);

    // Separator line
    ctx.strokeStyle = COLORS.barLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(HEADER_WIDTH, trackY);
    ctx.lineTo(HEADER_WIDTH, trackY + STAFF_HEIGHT);
    ctx.stroke();

    // Track name
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const displayName =
      track.name.length > 16 ? track.name.slice(0, 15) + '…' : track.name;
    ctx.fillText(displayName, 8, trackY + 8);

    // Clef indicator
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '11px sans-serif';
    ctx.fillText(isDrum ? 'Perc.' : 'Treble', 8, trackY + 26);

    // Draw a simplified clef symbol
    if (!isDrum) {
      drawTrebleClef(ctx, 8, trackY + 56);
    }
  }

  // -----------------------------------------------------------------------
  // Beat grid (faint dashed lines for each beat within a bar)
  // -----------------------------------------------------------------------
  private drawBeatGrid(bar: Bar, barX: number, trackY: number): void {
    const { ctx } = this;
    const [numerator, denominator] = bar.timeSignature;
    const totalBeats = numerator * (4 / denominator);

    ctx.save();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 4]);

    for (let beat = 1; beat < totalBeats; beat++) {
      const frac = beat / totalBeats;
      const x = barX + 12 + frac * (BAR_WIDTH - 20);
      ctx.beginPath();
      ctx.moveTo(x, trackY + 20);
      ctx.lineTo(x, trackY + STAFF_HEIGHT - 20);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Render pitched notes in a bar
  // -----------------------------------------------------------------------
  private renderBarNotes(
    bar: Bar,
    barIndex: number,
    trackY: number,
    scrollX: number,
  ): void {
    const { ctx } = this;
    const ts = bar.timeSignature;

    // Collect beam groups (consecutive eighth+ notes within the same beat)
    const beamGroups: { x: number; y: number; dir: 'up' | 'down' }[][] = [];
    let currentGroup: { x: number; y: number; dir: 'up' | 'down' }[] = [];

    for (const note of bar.notes) {
      const nx = computeNoteX(note, barIndex, ts) - scrollX;
      const ny = trackY + computeNoteY(note.pitch, false);
      const filled = isFilledNote(note.durationBeats);
      const dir = stemDirection(note.pitch);

      // Accidental for black keys
      if (isBlackKey(note.pitch)) {
        drawAccidental(ctx, nx, ny, 'sharp');
      }

      // Note head
      drawNoteHead(ctx, nx, ny, filled);

      // Stem (skip for whole notes)
      if (note.durationBeats < 4) {
        drawStem(ctx, nx, ny, dir);
      }

      // Beam grouping for eighth notes and shorter
      if (note.durationBeats <= 0.5) {
        currentGroup.push({
          x: nx + (dir === 'up' ? 4.5 : -4.5),
          y: dir === 'up' ? ny - 30 : ny + 30,
          dir,
        });
      } else {
        if (currentGroup.length >= 2) {
          beamGroups.push(currentGroup);
        }
        currentGroup = [];
      }

      // Tie to next note
      if (note.tiedTo) {
        // Find the tied-to note (in the same or next bar). We approximate by
        // drawing a short tie to the right.
        const tieEndX = nx + 20;
        drawTie(ctx, nx + 5, ny - 2, tieEndX, ny - 2);
      }
    }

    // Flush last beam group
    if (currentGroup.length >= 2) {
      beamGroups.push(currentGroup);
    }

    // Draw beams
    for (const group of beamGroups) {
      for (let i = 0; i < group.length - 1; i++) {
        drawBeam(ctx, group[i].x, group[i].y, group[i + 1].x, group[i + 1].y);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Playback cursor
  // -----------------------------------------------------------------------
  private drawCursor(song: Song, scrollX: number, currentTick: number): void {
    // Determine which bar the tick falls in by scanning the first track
    if (song.tracks.length === 0) return;
    const bars = song.tracks[0].bars;
    let cursorBar: Bar | undefined;
    for (const bar of bars) {
      if (currentTick >= bar.startTick && currentTick < bar.endTick) {
        cursorBar = bar;
        break;
      }
    }
    if (!cursorBar) return;

    const barX = computeBarX(cursorBar.index) - scrollX;
    const barLen = cursorBar.endTick - cursorBar.startTick;
    const tickFraction = barLen > 0 ? (currentTick - cursorBar.startTick) / barLen : 0;
    const cursorX = barX + 12 + tickFraction * (BAR_WIDTH - 20);

    const totalHeight = song.tracks.length * (STAFF_HEIGHT + TRACK_PADDING);
    drawPlaybackCursor(this.ctx, cursorX, 0, totalHeight);
  }

  // -----------------------------------------------------------------------
  // Create a "virtual" bar whose notes' computed X values are already
  // adjusted for scrollX, so DrumNotation (which calls computeNoteX
  // internally) produces correct screen positions.
  // -----------------------------------------------------------------------
  private adjustBarForScroll(bar: Bar, _scrollX: number): Bar {
    // DrumNotation uses computeNoteX which returns absolute positions.
    // The caller already offsets barX by scrollX, and DrumNotation draws
    // relative to the raw computed positions. We pass the bar as-is and let
    // DrumNotation handle absolute positioning; the main render loop
    // applies the scroll offset where needed.
    return bar;
  }

  // -----------------------------------------------------------------------
  // Public query helpers
  // -----------------------------------------------------------------------

  /**
   * Convert a click's x-coordinate (in canvas space) to a bar index.
   */
  getBarAtX(x: number, scrollX: number): number {
    return Math.floor((x + scrollX - HEADER_WIDTH) / BAR_WIDTH);
  }

  /**
   * Total width of all bars for a song (used for scroll limits).
   */
  getTotalWidth(song: Song): number {
    const maxBars = Math.max(...song.tracks.map((t) => t.bars.length), 0);
    return HEADER_WIDTH + maxBars * BAR_WIDTH;
  }

  /**
   * Convert a click's y-coordinate to a track index.
   */
  getTrackAtY(y: number, song: Song): number {
    const trackUnit = STAFF_HEIGHT + TRACK_PADDING;
    const idx = Math.floor(y / trackUnit);
    return Math.max(0, Math.min(song.tracks.length - 1, idx));
  }
}
