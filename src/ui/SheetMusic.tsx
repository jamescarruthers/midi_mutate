import { useRef, useEffect, useState, useCallback } from 'react';
import type { Song } from '../types/song';
import { SheetMusicRenderer } from '../notation/SheetMusicRenderer';
import { BAR_WIDTH, HEADER_WIDTH, STAFF_HEIGHT, TRACK_PADDING } from '../notation/layout';

export interface SheetMusicProps {
  song: Song | null;
  currentTick: number;
  currentBarIndex: number;
  onSeekToBar: (barIndex: number) => void;
  autoScroll: boolean;
}

const styles = {
  wrapper: {
    position: 'relative' as const,
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #333',
  },
  container: {
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
    maxHeight: '60vh',
  },
  canvas: {
    display: 'block' as const,
  },
  autoScrollToggle: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'rgba(22, 33, 62, 0.9)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #333',
    zIndex: 10,
  },
  label: {
    color: '#e0e0e0',
    fontSize: '11px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  checkbox: {
    accentColor: '#4a9eff',
    cursor: 'pointer',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#666',
    fontSize: '14px',
  },
} as const;

export function SheetMusic({
  song,
  currentTick,
  currentBarIndex,
  onSeekToBar,
  autoScroll: autoScrollProp,
}: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SheetMusicRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const [autoScrollLocal, setAutoScrollLocal] = useState(autoScrollProp);

  // Store volatile playback values in refs so the rAF loop reads them
  // without causing the effect to restart.
  const currentTickRef = useRef(currentTick);
  const currentBarIndexRef = useRef(currentBarIndex);
  currentTickRef.current = currentTick;
  currentBarIndexRef.current = currentBarIndex;

  // Create renderer when canvas mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new SheetMusicRenderer(canvas);
    return () => {
      rendererRef.current = null;
    };
  }, []);

  // Resize canvas to fit song content
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !song) return;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const totalWidth = renderer.getTotalWidth(song);
    const totalHeight = song.tracks.length * (STAFF_HEIGHT + TRACK_PADDING);
    canvas.width = totalWidth;
    canvas.height = totalHeight;
  }, [song]);

  // Animation loop — runs continuously while a song is loaded, reads
  // tick/bar from refs so it never tears down on playback updates.
  useEffect(() => {
    if (!song) return;

    const animate = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !container || !renderer) return;

      const scrollX = container.scrollLeft;
      renderer.render(song, scrollX, currentTickRef.current, currentBarIndexRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [song]);

  // Auto-scroll to keep current bar visible
  useEffect(() => {
    if (!autoScrollLocal || !song) return;
    const container = containerRef.current;
    if (!container) return;

    const barX = HEADER_WIDTH + currentBarIndex * BAR_WIDTH;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    // Scroll if the current bar is not fully visible
    if (barX < viewLeft + HEADER_WIDTH || barX + BAR_WIDTH > viewRight) {
      container.scrollLeft = Math.max(0, barX - HEADER_WIDTH - 50);
    }
  }, [currentBarIndex, autoScrollLocal, song]);

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !container || !renderer || !song) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const scrollX = container.scrollLeft;
      const barIndex = renderer.getBarAtX(x, scrollX);

      const maxBars = Math.max(...song.tracks.map((t) => t.bars.length), 0);
      if (barIndex >= 0 && barIndex < maxBars) {
        onSeekToBar(barIndex);
      }
    },
    [song, onSeekToBar],
  );

  if (!song) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.placeholder}>
          Open a MIDI file to view the sheet music
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.container}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          onClick={handleClick}
        />
      </div>
      <div style={styles.autoScrollToggle}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={autoScrollLocal}
            onChange={(e) => setAutoScrollLocal(e.target.checked)}
            style={styles.checkbox}
          />
          {' '}Auto-scroll
        </label>
      </div>
    </div>
  );
}
