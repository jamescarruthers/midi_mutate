import { useState } from 'react';
import type { Track } from '../types/song';
import type { InstrumentPreset } from '../types/synth';
import type { TrackMixState } from '../types/transport';
import { PresetSelector } from './PresetSelector';
import { SynthControls } from './SynthControls';
import { DRUM_CHANNEL } from '../utils/constants';

export interface MixerPanelProps {
  tracks: Track[];
  trackMixStates: TrackMixState[];
  presetAssignments: Record<string, string>;
  customPresets: Record<string, InstrumentPreset>;
  onTrackGain: (trackId: string, gain: number) => void;
  onTrackMute: (trackId: string, muted: boolean) => void;
  onTrackSolo: (trackId: string, solo: boolean) => void;
  onChangePreset: (trackId: string, presetId: string) => void;
  onUpdatePreset: (trackId: string, preset: InstrumentPreset) => void;
  masterGain: number;
  onMasterGain: (gain: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const styles = {
  panel: {
    backgroundColor: '#16213e',
    borderTop: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    borderBottom: '1px solid #333',
    flexShrink: 0,
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
    padding: '8px 12px',
    overflowY: 'auto' as const,
    flex: 1,
  },
  trackBlock: {
    marginBottom: '2px',
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 0',
    borderBottom: '1px solid #222',
  },
  trackName: {
    color: '#e0e0e0',
    fontSize: '12px',
    width: '80px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    cursor: 'pointer',
  },
  slider: {
    accentColor: '#4a9eff',
    cursor: 'pointer',
    width: '60px',
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
  expandBtn: {
    backgroundColor: 'transparent',
    color: '#666',
    border: '1px solid #333',
    borderRadius: '3px',
    padding: '1px 5px',
    cursor: 'pointer',
    fontSize: '9px',
    flexShrink: 0,
  },
  expandBtnActive: {
    color: '#4a9eff',
    borderColor: '#4a9eff',
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
    width: '80px',
    flexShrink: 0,
  },
} as const;

export function MixerPanel({
  tracks,
  trackMixStates,
  presetAssignments,
  customPresets,
  onTrackGain,
  onTrackMute,
  onTrackSolo,
  onChangePreset,
  onUpdatePreset,
  masterGain,
  onMasterGain,
  collapsed,
  onToggleCollapse,
}: MixerPanelProps) {
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

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

            const isDrum = track.channel === DRUM_CHANNEL;
            const currentPresetId = presetAssignments[track.id] ?? track.instrumentPresetId;
            const isExpanded = expandedTrack === track.id;
            const preset = customPresets[track.id];

            return (
              <div key={track.id} style={styles.trackBlock}>
                <div style={styles.trackRow}>
                  <span
                    style={styles.trackName}
                    title={`${track.name} — click to ${isExpanded ? 'collapse' : 'expand'} synth controls`}
                    onClick={() => setExpandedTrack(isExpanded ? null : track.id)}
                  >
                    {track.name}
                  </span>
                  {!isDrum && (
                    <PresetSelector
                      currentPresetId={currentPresetId}
                      onChange={(presetId) => onChangePreset(track.id, presetId)}
                    />
                  )}
                  {isDrum && (
                    <span style={{ color: '#666', fontSize: '11px', width: '130px', flexShrink: 0 }}>
                      Drums (GM)
                    </span>
                  )}
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
                  {!isDrum && (
                    <button
                      style={{
                        ...styles.expandBtn,
                        ...(isExpanded ? styles.expandBtnActive : {}),
                      }}
                      onClick={() => setExpandedTrack(isExpanded ? null : track.id)}
                      title="Synth controls"
                    >
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </button>
                  )}
                </div>
                {isExpanded && !isDrum && preset && (
                  <SynthControls
                    preset={preset}
                    onChange={(p) => onUpdatePreset(track.id, p)}
                  />
                )}
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
