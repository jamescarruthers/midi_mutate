export interface ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export type OscWaveform = OscillatorType | 'pulse' | 'noise-white' | 'noise-pink';

export interface InstrumentPreset {
  id: string;
  name: string;
  category: 'keys' | 'bass' | 'lead' | 'pad' | 'drums' | 'custom';
  osc: {
    waveform: OscWaveform;
    detune: number;
    pulseWidth?: number;
    unison?: { voices: number; spread: number };
  };
  filter: {
    type: BiquadFilterType;
    cutoff: number;
    resonance: number;
    envAmount: number;
    adsr: ADSR;
  };
  amp: {
    adsr: ADSR;
    velocitySensitivity: number;
  };
  gain: number;
}

export interface InstrumentEngine {
  noteOn(pitch: number, velocity: number, time: number): void;
  noteOff(pitch: number, time: number): void;
  dispose(): void;
}
