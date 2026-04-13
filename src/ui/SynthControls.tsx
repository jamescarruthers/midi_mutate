import { useCallback } from 'react';
import type { InstrumentPreset, ADSR, OscWaveform } from '../types/synth';

export interface SynthControlsProps {
  preset: InstrumentPreset;
  onChange: (preset: InstrumentPreset) => void;
}

const WAVEFORMS: { value: OscWaveform; label: string }[] = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'square', label: 'Square' },
  { value: 'pulse', label: 'Pulse' },
];

const FILTER_TYPES: { value: BiquadFilterType; label: string }[] = [
  { value: 'lowpass', label: 'LP' },
  { value: 'highpass', label: 'HP' },
  { value: 'bandpass', label: 'BP' },
];

const s = {
  panel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '10px',
    padding: '10px 8px',
    backgroundColor: '#111428',
    borderTop: '1px solid #333',
    borderBottom: '1px solid #444',
  } as React.CSSProperties,
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#4a9eff',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '2px',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  label: {
    fontSize: '10px',
    color: '#999',
    width: '32px',
    flexShrink: 0,
  } as React.CSSProperties,
  slider: {
    flex: 1,
    accentColor: '#4a9eff',
    cursor: 'pointer',
    height: '3px',
    minWidth: '40px',
  } as React.CSSProperties,
  value: {
    fontSize: '10px',
    color: '#ccc',
    width: '38px',
    textAlign: 'right' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  select: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '10px',
    cursor: 'pointer',
  } as React.CSSProperties,
};

function ADSRControls({
  label,
  adsr,
  onChange,
}: {
  label: string;
  adsr: ADSR;
  onChange: (adsr: ADSR) => void;
}) {
  return (
    <>
      <div style={s.sectionTitle}>{label}</div>
      <Param label="A" value={adsr.attack} min={0.001} max={2} step={0.001}
        format={(v) => v < 0.1 ? `${(v * 1000).toFixed(0)}ms` : `${v.toFixed(2)}s`}
        onChange={(v) => onChange({ ...adsr, attack: v })} />
      <Param label="D" value={adsr.decay} min={0.01} max={2} step={0.01}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(v) => onChange({ ...adsr, decay: v })} />
      <Param label="S" value={adsr.sustain} min={0} max={1} step={0.01}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        onChange={(v) => onChange({ ...adsr, sustain: v })} />
      <Param label="R" value={adsr.release} min={0.01} max={3} step={0.01}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(v) => onChange({ ...adsr, release: v })} />
    </>
  );
}

function Param({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={s.row}>
      <span style={s.label}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={s.slider} />
      <span style={s.value}>{format(value)}</span>
    </div>
  );
}

export function SynthControls({ preset, onChange }: SynthControlsProps) {
  const update = useCallback(
    (partial: Partial<InstrumentPreset>) => {
      onChange({ ...preset, ...partial });
    },
    [preset, onChange],
  );

  return (
    <div style={s.panel}>
      {/* ---- OSC ---- */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Oscillator</div>
        <div style={s.row}>
          <span style={s.label}>Wave</span>
          <select style={s.select} value={preset.osc.waveform}
            onChange={(e) => update({
              osc: { ...preset.osc, waveform: e.target.value as OscWaveform },
            })}>
            {WAVEFORMS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <Param label="Detune" value={preset.osc.detune} min={-100} max={100} step={1}
          format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}c`}
          onChange={(v) => update({ osc: { ...preset.osc, detune: v } })} />
        {preset.osc.waveform === 'pulse' && (
          <Param label="PW" value={preset.osc.pulseWidth ?? 0.5} min={0.05} max={0.95} step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => update({ osc: { ...preset.osc, pulseWidth: v } })} />
        )}
        <Param label="Gain" value={preset.gain} min={0} max={1} step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(v) => update({ gain: v })} />
      </div>

      {/* ---- FILTER ---- */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Filter</div>
        <div style={s.row}>
          <span style={s.label}>Type</span>
          <select style={s.select} value={preset.filter.type}
            onChange={(e) => update({
              filter: { ...preset.filter, type: e.target.value as BiquadFilterType },
            })}>
            {FILTER_TYPES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <Param label="Cutoff" value={preset.filter.cutoff} min={20} max={18000} step={1}
          format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
          onChange={(v) => update({ filter: { ...preset.filter, cutoff: v } })} />
        <Param label="Reso" value={preset.filter.resonance} min={0.1} max={20} step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(v) => update({ filter: { ...preset.filter, resonance: v } })} />
        <Param label="Env" value={preset.filter.envAmount} min={0} max={5000} step={10}
          format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
          onChange={(v) => update({ filter: { ...preset.filter, envAmount: v } })} />
      </div>

      {/* ---- FILTER ADSR ---- */}
      <div style={s.section}>
        <ADSRControls label="Filter Env" adsr={preset.filter.adsr}
          onChange={(adsr) => update({ filter: { ...preset.filter, adsr } })} />
      </div>

      {/* ---- AMP ADSR ---- */}
      <div style={s.section}>
        <ADSRControls label="Amp Env" adsr={preset.amp.adsr}
          onChange={(adsr) => update({ amp: { ...preset.amp, adsr } })} />
        <Param label="Vel" value={preset.amp.velocitySensitivity} min={0} max={1} step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(v) => update({ amp: { ...preset.amp, velocitySensitivity: v } })} />
      </div>
    </div>
  );
}
