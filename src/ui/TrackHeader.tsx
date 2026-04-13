import type { Track } from '../types/song';
import { PresetSelector } from './PresetSelector';

export interface TrackHeaderProps {
  track: Track;
  presetName: string;
  onPresetChange: (presetId: string) => void;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    padding: '6px 8px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #333',
    borderRight: '1px solid #333',
    minWidth: '130px',
  },
  trackName: {
    color: '#e0e0e0',
    fontSize: '12px',
    fontWeight: 600 as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  presetName: {
    color: '#999',
    fontSize: '10px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
} as const;

export function TrackHeader({
  track,
  presetName,
  onPresetChange,
}: TrackHeaderProps) {
  return (
    <div style={styles.container}>
      <span style={styles.trackName} title={track.name}>
        {track.name}
      </span>
      <span style={styles.presetName} title={presetName}>
        {presetName}
      </span>
      <PresetSelector
        currentPresetId={track.instrumentPresetId}
        onChange={onPresetChange}
      />
    </div>
  );
}
