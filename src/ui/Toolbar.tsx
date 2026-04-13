import { useRef } from 'react';
import type { TransportState } from '../types/transport';

export interface ToolbarProps {
  state: TransportState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onFileOpen: (file: File) => void;
  tempoScale: number;
  onTempoScaleChange: (scale: number) => void;
  loopEnabled: boolean;
  loopStartBar: number;
  loopEndBar: number;
  onLoopChange: (enabled: boolean, start?: number, end?: number) => void;
  totalBars: number;
  songName: string | null;
}

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap' as const,
    minHeight: '48px',
  },
  button: {
    backgroundColor: '#0f3460',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
    transition: 'background-color 0.15s',
  },
  buttonActive: {
    backgroundColor: '#4a9eff',
    color: '#fff',
  },
  label: {
    color: '#e0e0e0',
    fontSize: '12px',
    whiteSpace: 'nowrap' as const,
  },
  slider: {
    accentColor: '#4a9eff',
    cursor: 'pointer',
    height: '4px',
  },
  numberInput: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '3px',
    padding: '3px 6px',
    width: '48px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  checkbox: {
    accentColor: '#4a9eff',
    cursor: 'pointer',
  },
  separator: {
    width: '1px',
    height: '28px',
    backgroundColor: '#333',
    flexShrink: 0,
  },
  songName: {
    color: '#4a9eff',
    fontSize: '13px',
    fontWeight: 600 as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    maxWidth: '200px',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
} as const;

export function Toolbar({
  state,
  onPlay,
  onPause,
  onStop,
  onFileOpen,
  tempoScale,
  onTempoScaleChange,
  loopEnabled,
  loopStartBar,
  loopEndBar,
  onLoopChange,
  totalBars,
  songName,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileOpen(file);
      // Reset the input so the same file can be re-opened
      e.target.value = '';
    }
  };

  const isPlaying = state === 'playing';
  const bpmDisplay = Math.round(120 * tempoScale);

  return (
    <div style={styles.toolbar}>
      {/* File open */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        style={styles.button}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a5276'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0f3460'; }}
      >
        Open .mid
      </button>

      <div style={styles.separator} />

      {/* Transport controls */}
      <div style={styles.group}>
        <button
          style={{
            ...styles.button,
            ...(isPlaying ? styles.buttonActive : {}),
          }}
          onClick={isPlaying ? onPause : onPlay}
          onMouseEnter={(e) => {
            if (!isPlaying) e.currentTarget.style.backgroundColor = '#1a5276';
          }}
          onMouseLeave={(e) => {
            if (!isPlaying) e.currentTarget.style.backgroundColor = '#0f3460';
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          style={styles.button}
          onClick={onStop}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a5276'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0f3460'; }}
        >
          Stop
        </button>
      </div>

      <div style={styles.separator} />

      {/* Tempo */}
      <div style={styles.group}>
        <span style={styles.label}>Tempo:</span>
        <input
          type="range"
          min={0.25}
          max={2.0}
          step={0.05}
          value={tempoScale}
          onChange={(e) => onTempoScaleChange(parseFloat(e.target.value))}
          style={{ ...styles.slider, width: '100px' }}
        />
        <span style={styles.label}>{tempoScale.toFixed(2)}x ({bpmDisplay} BPM)</span>
      </div>

      <div style={styles.separator} />

      {/* Loop controls */}
      <div style={styles.group}>
        <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => onLoopChange(e.target.checked, loopStartBar, loopEndBar)}
            style={styles.checkbox}
          />
          Loop
        </label>
        {loopEnabled && (
          <>
            <span style={styles.label}>Bar</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, loopEndBar - 1)}
              value={loopStartBar}
              onChange={(e) => {
                const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, loopEndBar - 1));
                onLoopChange(true, val, loopEndBar);
              }}
              style={styles.numberInput}
            />
            <span style={styles.label}>to</span>
            <input
              type="number"
              min={loopStartBar + 1}
              max={totalBars}
              value={loopEndBar}
              onChange={(e) => {
                const val = Math.max(loopStartBar + 1, Math.min(parseInt(e.target.value) || 0, totalBars));
                onLoopChange(true, loopStartBar, val);
              }}
              style={styles.numberInput}
            />
          </>
        )}
      </div>

      {/* Song name */}
      {songName && (
        <>
          <div style={styles.separator} />
          <span style={styles.songName} title={songName}>{songName}</span>
        </>
      )}
    </div>
  );
}
