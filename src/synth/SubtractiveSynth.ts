import type { ADSR, InstrumentEngine, InstrumentPreset } from '../types/synth';
import { midiNoteToFrequency } from '../utils/constants';

interface Voice {
  oscillators: (OscillatorNode | AudioBufferSourceNode)[];
  filter: BiquadFilterNode;
  vca: GainNode;
  gainNode: GainNode;
  releaseTimeout?: ReturnType<typeof setTimeout>;
}

/**
 * Creates a white noise AudioBuffer.
 */
function createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Creates a pink noise AudioBuffer using the Voss-McCartney algorithm.
 */
function createPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

/**
 * Creates a PeriodicWave approximating a pulse wave with the given duty cycle (0-1).
 */
function createPulseWave(ctx: AudioContext, pulseWidth: number): PeriodicWave {
  const duty = pulseWidth ?? 0.5;
  const harmonics = 64;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);

  real[0] = 0;
  imag[0] = 0;
  for (let n = 1; n < harmonics; n++) {
    // Fourier series for pulse wave
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/**
 * Applies an ADSR envelope to an AudioParam, scheduling the attack, decay, and sustain
 * phases starting at the given time. Returns nothing — release is handled separately.
 */
function applyADSR(
  param: AudioParam,
  adsr: ADSR,
  peakValue: number,
  sustainValue: number,
  time: number,
): void {
  param.cancelScheduledValues(time);
  param.setValueAtTime(0, time);
  // Attack
  param.linearRampToValueAtTime(peakValue, time + adsr.attack);
  // Decay to sustain
  param.linearRampToValueAtTime(sustainValue, time + adsr.attack + adsr.decay);
}

/**
 * Schedules the release phase of an ADSR envelope on the given AudioParam.
 */
function applyRelease(
  param: AudioParam,
  release: number,
  time: number,
): void {
  param.cancelScheduledValues(time);
  param.setValueAtTime(param.value, time);
  param.linearRampToValueAtTime(0, time + release);
}

export class SubtractiveSynth implements InstrumentEngine {
  private ctx: AudioContext;
  private preset: InstrumentPreset;
  private destination: AudioNode;
  private voices: Map<number, Voice> = new Map();
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private disposed = false;

  constructor(audioContext: AudioContext, preset: InstrumentPreset, destination: AudioNode) {
    this.ctx = audioContext;
    this.preset = preset;
    this.destination = destination;
  }

  /** Update the preset used for future noteOn calls. Active voices are unaffected. */
  updatePreset(preset: InstrumentPreset): void {
    this.preset = preset;
  }

  /** Return a deep copy of the current preset. */
  getPreset(): InstrumentPreset {
    return JSON.parse(JSON.stringify(this.preset));
  }

  noteOn(pitch: number, velocity: number, time: number): void {
    if (this.disposed) return;

    // If a voice for this pitch already exists, release it first
    if (this.voices.has(pitch)) {
      this.noteOff(pitch, time);
    }

    const freq = midiNoteToFrequency(pitch);
    const preset = this.preset;

    // Velocity scaling: gain = (1 - velSens) + velSens * (velocity / 127)
    const velFactor =
      (1 - preset.amp.velocitySensitivity) +
      preset.amp.velocitySensitivity * (velocity / 127);
    const peakGain = preset.gain * velFactor;
    const sustainGain = peakGain * preset.amp.adsr.sustain;

    // Output gain node
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(preset.gain, time);
    gainNode.connect(this.destination);

    // VCA (amplitude envelope)
    const vca = this.ctx.createGain();
    vca.connect(gainNode);
    applyADSR(vca.gain, preset.amp.adsr, peakGain, sustainGain, time);

    // VCF (filter with envelope)
    const filter = this.ctx.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.Q.setValueAtTime(preset.filter.resonance, time);
    filter.connect(vca);

    // Filter envelope: modulate cutoff from base to base + envAmount
    const baseCutoff = preset.filter.cutoff;
    const peakCutoff = baseCutoff + preset.filter.envAmount;
    const sustainCutoff = baseCutoff + preset.filter.envAmount * preset.filter.adsr.sustain;
    applyADSR(filter.frequency, preset.filter.adsr, peakCutoff, sustainCutoff, time);

    // VCO(s)
    const oscillators: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const waveform = preset.osc.waveform;
    const isNoise = waveform === 'noise-white' || waveform === 'noise-pink';

    if (isNoise) {
      const source = this.createNoiseSource(waveform);
      source.connect(filter);
      source.start(time);
      oscillators.push(source);
    } else {
      const unisonVoices = preset.osc.unison?.voices ?? 1;
      const unisonSpread = preset.osc.unison?.spread ?? 0;

      for (let i = 0; i < unisonVoices; i++) {
        const osc = this.ctx.createOscillator();

        if (waveform === 'pulse') {
          const pw = preset.osc.pulseWidth ?? 0.5;
          osc.setPeriodicWave(createPulseWave(this.ctx, pw));
        } else {
          osc.type = waveform as OscillatorType;
        }

        osc.frequency.setValueAtTime(freq, time);

        // Calculate detune: base detune + unison spread
        let detune = preset.osc.detune;
        if (unisonVoices > 1) {
          // Spread voices evenly across the range
          const offset = unisonSpread * ((i / (unisonVoices - 1)) - 0.5);
          detune += offset;
        }
        osc.detune.setValueAtTime(detune, time);

        osc.connect(filter);
        osc.start(time);
        oscillators.push(osc);
      }
    }

    const voice: Voice = { oscillators, filter, vca, gainNode };
    this.voices.set(pitch, voice);
  }

  noteOff(pitch: number, time: number): void {
    if (this.disposed) return;

    const voice = this.voices.get(pitch);
    if (!voice) return;

    const ampRelease = this.preset.amp.adsr.release;
    const filterRelease = this.preset.filter.adsr.release;

    // Trigger release on amp envelope
    applyRelease(voice.vca.gain, ampRelease, time);

    // Trigger release on filter envelope
    const baseCutoff = this.preset.filter.cutoff;
    voice.filter.frequency.cancelScheduledValues(time);
    voice.filter.frequency.setValueAtTime(voice.filter.frequency.value, time);
    voice.filter.frequency.linearRampToValueAtTime(baseCutoff, time + filterRelease);

    // Stop oscillators after the longer of the two release times
    const stopTime = Math.max(ampRelease, filterRelease);

    // Clean up after release completes
    voice.releaseTimeout = setTimeout(() => {
      this.stopVoice(voice);
      this.voices.delete(pitch);
    }, (stopTime + 0.05) * 1000);
  }

  dispose(): void {
    this.disposed = true;
    for (const [pitch, voice] of this.voices) {
      if (voice.releaseTimeout) clearTimeout(voice.releaseTimeout);
      this.stopVoice(voice);
      this.voices.delete(pitch);
    }
  }

  private stopVoice(voice: Voice): void {
    for (const osc of voice.oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
      try {
        osc.disconnect();
      } catch {
        // Already disconnected
      }
    }
    try { voice.filter.disconnect(); } catch { /* noop */ }
    try { voice.vca.disconnect(); } catch { /* noop */ }
    try { voice.gainNode.disconnect(); } catch { /* noop */ }
  }

  private createNoiseSource(
    type: 'noise-white' | 'noise-pink',
  ): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();

    if (type === 'noise-white') {
      if (!this.whiteNoiseBuffer) {
        this.whiteNoiseBuffer = createWhiteNoiseBuffer(this.ctx);
      }
      source.buffer = this.whiteNoiseBuffer;
    } else {
      if (!this.pinkNoiseBuffer) {
        this.pinkNoiseBuffer = createPinkNoiseBuffer(this.ctx);
      }
      source.buffer = this.pinkNoiseBuffer;
    }

    source.loop = true;
    return source;
  }
}
