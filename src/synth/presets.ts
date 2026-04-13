import type { InstrumentPreset } from '../types/synth';

const piano: InstrumentPreset = {
  id: 'piano',
  name: 'Piano',
  category: 'keys',
  osc: { waveform: 'triangle', detune: 3 },
  filter: {
    type: 'lowpass',
    cutoff: 3000,
    resonance: 1,
    envAmount: 500,
    adsr: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.3 },
  },
  amp: {
    adsr: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 },
    velocitySensitivity: 0.8,
  },
  gain: 0.7,
};

const electricPiano: InstrumentPreset = {
  id: 'electric-piano',
  name: 'Electric Piano',
  category: 'keys',
  osc: { waveform: 'sine', detune: 0, unison: { voices: 2, spread: 1200 } },
  filter: {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1,
    envAmount: 800,
    adsr: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.4 },
  },
  amp: {
    adsr: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.4 },
    velocitySensitivity: 0.7,
  },
  gain: 0.6,
};

const bass: InstrumentPreset = {
  id: 'bass',
  name: 'Bass',
  category: 'bass',
  osc: { waveform: 'sawtooth', detune: 0 },
  filter: {
    type: 'lowpass',
    cutoff: 800,
    resonance: 2,
    envAmount: 600,
    adsr: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.1 },
  },
  amp: {
    adsr: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.1 },
    velocitySensitivity: 0.5,
  },
  gain: 0.7,
};

const pad: InstrumentPreset = {
  id: 'pad',
  name: 'Pad',
  category: 'pad',
  osc: { waveform: 'sawtooth', detune: 0, unison: { voices: 4, spread: 15 } },
  filter: {
    type: 'lowpass',
    cutoff: 1500,
    resonance: 1,
    envAmount: 400,
    adsr: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.8 },
  },
  amp: {
    adsr: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 1.0 },
    velocitySensitivity: 0.3,
  },
  gain: 0.5,
};

const lead: InstrumentPreset = {
  id: 'lead',
  name: 'Lead',
  category: 'lead',
  osc: { waveform: 'square', detune: 0 },
  filter: {
    type: 'lowpass',
    cutoff: 2500,
    resonance: 4,
    envAmount: 700,
    adsr: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.15 },
  },
  amp: {
    adsr: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.15 },
    velocitySensitivity: 0.6,
  },
  gain: 0.6,
};

const strings: InstrumentPreset = {
  id: 'strings',
  name: 'Strings',
  category: 'pad',
  osc: { waveform: 'sawtooth', detune: 0, unison: { voices: 3, spread: 10 } },
  filter: {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1,
    envAmount: 300,
    adsr: { attack: 0.3, decay: 0.3, sustain: 0.6, release: 0.5 },
  },
  amp: {
    adsr: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 0.5 },
    velocitySensitivity: 0.4,
  },
  gain: 0.5,
};

const kick: InstrumentPreset = {
  id: 'kick',
  name: 'Kick',
  category: 'drums',
  osc: { waveform: 'sine', detune: 0 },
  filter: {
    type: 'lowpass',
    cutoff: 200,
    resonance: 1,
    envAmount: 0,
    adsr: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
  },
  amp: {
    adsr: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    velocitySensitivity: 0.3,
  },
  gain: 0.9,
};

const snare: InstrumentPreset = {
  id: 'snare',
  name: 'Snare',
  category: 'drums',
  osc: { waveform: 'noise-white', detune: 0 },
  filter: {
    type: 'bandpass',
    cutoff: 3000,
    resonance: 2,
    envAmount: 0,
    adsr: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
  },
  amp: {
    adsr: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
    velocitySensitivity: 0.4,
  },
  gain: 0.7,
};

const hihatClosed: InstrumentPreset = {
  id: 'hihat-closed',
  name: 'HH Closed',
  category: 'drums',
  osc: { waveform: 'noise-white', detune: 0 },
  filter: {
    type: 'highpass',
    cutoff: 7000,
    resonance: 1,
    envAmount: 0,
    adsr: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
  },
  amp: {
    adsr: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
    velocitySensitivity: 0.3,
  },
  gain: 0.5,
};

const hihatOpen: InstrumentPreset = {
  id: 'hihat-open',
  name: 'HH Open',
  category: 'drums',
  osc: { waveform: 'noise-white', detune: 0 },
  filter: {
    type: 'highpass',
    cutoff: 6000,
    resonance: 1,
    envAmount: 0,
    adsr: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.15 },
  },
  amp: {
    adsr: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.15 },
    velocitySensitivity: 0.3,
  },
  gain: 0.5,
};

export const PRESETS: Record<string, InstrumentPreset> = {
  piano,
  'electric-piano': electricPiano,
  bass,
  pad,
  lead,
  strings,
  kick,
  snare,
  'hihat-closed': hihatClosed,
  'hihat-open': hihatOpen,
};

export const DEFAULT_PRESET_ID = 'piano';

/**
 * Returns an appropriate preset ID for the given MIDI channel (0-indexed).
 * Channel 9 is drums (GM standard), channels 1-3 get bass, everything else defaults to piano.
 */
export function getPresetForChannel(channel: number): string {
  if (channel === 9) return 'kick';
  if (channel >= 1 && channel <= 3) return 'bass';
  return 'piano';
}
