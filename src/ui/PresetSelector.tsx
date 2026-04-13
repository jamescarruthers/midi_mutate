import { useMemo } from 'react';
import { PRESETS } from '../synth/presets';
import type { InstrumentPreset } from '../types/synth';

export interface PresetSelectorProps {
  currentPresetId: string;
  onChange: (presetId: string) => void;
  category?: string;
}

const CATEGORY_ORDER = ['keys', 'bass', 'lead', 'pad', 'drums', 'custom'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  keys: 'Keys',
  bass: 'Bass',
  lead: 'Lead',
  pad: 'Pad',
  drums: 'Drums',
  custom: 'Custom',
};

const styles = {
  select: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '3px',
    padding: '3px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    maxWidth: '130px',
  },
} as const;

export function PresetSelector({
  currentPresetId,
  onChange,
  category,
}: PresetSelectorProps) {
  const groupedPresets = useMemo(() => {
    const groups: Record<string, InstrumentPreset[]> = {};

    for (const preset of Object.values(PRESETS)) {
      if (category && preset.category !== category) continue;
      if (!groups[preset.category]) {
        groups[preset.category] = [];
      }
      groups[preset.category].push(preset);
    }

    return groups;
  }, [category]);

  return (
    <select
      value={currentPresetId}
      onChange={(e) => onChange(e.target.value)}
      style={styles.select}
    >
      {CATEGORY_ORDER.map((cat) => {
        const presets = groupedPresets[cat];
        if (!presets || presets.length === 0) return null;

        return (
          <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
