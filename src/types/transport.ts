export type TransportState = 'stopped' | 'playing' | 'paused';

export interface TransportConfig {
  tempoScale: number;       // 0.25 – 2.0
  loopEnabled: boolean;
  loopStartBar: number;
  loopEndBar: number;
}

export interface TrackMixState {
  trackId: string;
  gain: number;    // 0-1
  muted: boolean;
  solo: boolean;
}
