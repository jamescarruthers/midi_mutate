import type { Track } from '../types/song';
import type { TrackMixState } from '../types/transport';

export interface MixerPanelProps {
  tracks: Track[];
  trackMixStates: TrackMixState[];
  onTrackGain: (trackId: string, gain: number) => void;
  onTrackMute: (trackId: string, muted: boolean) => void;
  onTrackSolo: (trackId: string, solo: boolean) => void;
  masterGain: number;
  onMasterGain: (gain: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const styles = {
  panel: {
    backgroundColor: '#16213e',
    borderTop: '1px solid #333',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    borderBottom: '1px solid #333',
  },
  headerTitle: {
    color: '#e0e0e0',
    fontSize: '13px',
    fontWeight: 600 as const,
  },
  collapseButton: {
    backgroundColor: 'transparent',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '3px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  body: {
    padding: '8px 16px',
    maxHeight: '250px',
    overflowY: 'auto' as const,
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid #222',
  },
  trackName: {
    color: '#e0e0e0',
    fontSize: '12px',
    width: '120px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  slider: {
    accentColor: '#4a9eff',
    cursor: 'pointer',
    width: '100px',
    height: '4px',
  },
  gainLabel: {
    color: '#999',
    fontSize: '11px',
    width: '32px',
    textAlign: 'right' as const,
  },
  toggleButton: {
    width: '24px',
    height: '24px',
    borderRadius: '3px',
    border: '1px solid #333',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700 as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
  },
  muteActive: {
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: '1px solid #d32f2f',
  },
  muteInactive: {
    backgroundColor: '#0f3460',
    color: '#e0e0e0',
  },
  soloActive: {
    backgroundColor: '#f9a825',
    color: '#1a1a2e',
    border: '1px solid #f9a825',
  },
  soloInactive: {
    backgroundColor: '#0f3460',
    color: '#e0e0e0',
  },
  masterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0 4px',
    borderTop: '1px solid #444',
    marginTop: '4px',
  },
  masterLabel: {
    color: '#4a9eff',
    fontSize: '12px',
    fontWeight: 600 as const,
    width: '120px',
    flexShrink: 0,
  },
} as const;

export function MixerPanel({
  tracks,
  trackMixStates,
  onTrackGain,
  onTrackMute,
  onTrackSolo,
  masterGain,
  onMasterGain,
  collapsed,
  onToggleCollapse,
}: MixerPanelProps) {
  return (
    <div style={styles.panel}>
      <div style={styles.header} onClick={onToggleCollapse}>
        <span style={styles.headerTitle}>Mixer</span>
        <button
          style={styles.collapseButton}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
        >
          {collapsed ? '\u25BC' : '\u25B2'}
        </button>
      </div>

      {!collapsed && (
        <div style={styles.body}>
          {tracks.map((track) => {
            const mixState = trackMixStates.find((m) => m.trackId === track.id);
            if (!mixState) return null;

            return (
              <div key={track.id} style={styles.trackRow}>
                <span style={styles.trackName} title={track.name}>
                  {track.name}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={mixState.gain}
                  onChange={(e) => onTrackGain(track.id, parseFloat(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.gainLabel}>
                  {Math.round(mixState.gain * 100)}%
                </span>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(mixState.muted ? styles.muteActive : styles.muteInactive),
                  }}
                  onClick={() => onTrackMute(track.id, !mixState.muted)}
                  title="Mute"
                >
                  M
                </button>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(mixState.solo ? styles.soloActive : styles.soloInactive),
                  }}
                  onClick={() => onTrackSolo(track.id, !mixState.solo)}
                  title="Solo"
                >
                  S
                </button>
              </div>
            );
          })}

          {/* Master gain */}
          <div style={styles.masterRow}>
            <span style={styles.masterLabel}>Master</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterGain}
              onChange={(e) => onMasterGain(parseFloat(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.gainLabel}>
              {Math.round(masterGain * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
