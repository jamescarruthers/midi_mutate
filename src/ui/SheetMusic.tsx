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
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a2e',
  },
  container: {
    width: '100%',
    height: '100%',
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
  },
  // Invisible spacer inside the scroll container — its width drives
  // the scrollbar range while the canvas stays viewport-sized.
  spacer: {
    pointerEvents: 'none' as const,
    height: '1px',
  },
  canvas: {
    display: 'block' as const,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    pointerEvents: 'none' as const,
  },
  // Transparent overlay on top of the canvas to capture clicks
  clickOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SheetMusicRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const [autoScrollLocal, setAutoScrollLocal] = useState(autoScrollProp);

  // Volatile playback values in refs — read by rAF, not useEffect deps.
  const currentTickRef = useRef(currentTick);
  const currentBarIndexRef = useRef(currentBarIndex);
  currentTickRef.current = currentTick;
  currentBarIndexRef.current = currentBarIndex;

  // Create renderer when canvas mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new SheetMusicRenderer(canvas);
    return () => { rendererRef.current = null; };
  }, []);

  // Resize canvas to match the wrapper (viewport), not the song.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, []);

  // Animation loop — continuous while song is loaded.
  useEffect(() => {
    if (!song) return;

    const animate = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !container || !renderer) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const scrollX = container.scrollLeft;
      const dpr = window.devicePixelRatio || 1;
      renderer.render(song, scrollX, currentTickRef.current, currentBarIndexRef.current, dpr);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [song]);

  // Auto-scroll to keep current bar visible
  useEffect(() => {
    if (!autoScrollLocal || !song) return;
    const container = containerRef.current;
    if (!container) return;

    const barX = HEADER_WIDTH + currentBarIndex * BAR_WIDTH;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    if (barX < viewLeft + HEADER_WIDTH || barX + BAR_WIDTH > viewRight) {
      container.scrollLeft = Math.max(0, barX - HEADER_WIDTH - 50);
    }
  }, [currentBarIndex, autoScrollLocal, song]);

  // Click handler on the overlay div
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const renderer = rendererRef.current;
      if (!container || !renderer || !song) return;

      const rect = container.getBoundingClientRect();
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

  // Total scrollable width
  const maxBars = Math.max(...song.tracks.map((t) => t.bars.length), 0);
  const totalWidth = HEADER_WIDTH + maxBars * BAR_WIDTH;
  const totalHeight = song.tracks.length * (STAFF_HEIGHT + TRACK_PADDING);

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div ref={containerRef} style={styles.container}>
        {/* Spacer to create the scrollbar range */}
        <div style={{ ...styles.spacer, width: totalWidth, minHeight: totalHeight }} />
      </div>
      {/* Canvas is viewport-sized, positioned on top */}
      <canvas ref={canvasRef} style={styles.canvas} />
      {/* Click overlay */}
      <div style={styles.clickOverlay} onClick={handleClick} />
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
