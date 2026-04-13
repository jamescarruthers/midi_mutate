export interface Song {
  meta: SongMeta;
  tracks: Track[];
  tempoMap: TempoEvent[];
  timeSignatures: TimeSigEvent[];
}

export interface SongMeta {
  name: string;
  ppq: number;
  durationTicks: number;
  durationSeconds: number;
}

export interface Track {
  id: string;
  name: string;
  channel: number;
  instrumentPresetId: string;
  bars: Bar[];
}

export interface Bar {
  index: number;
  startTick: number;
  endTick: number;
  timeSignature: [number, number];
  tempo: number;
  notes: Note[];
}

export interface Note {
  pitch: number;
  velocity: number;
  startTick: number;
  durationTicks: number;
  startBeat: number;
  durationBeats: number;
  tiedFrom?: string;
  tiedTo?: string;
}

export interface TempoEvent {
  tick: number;
  bpm: number;
}

export interface TimeSigEvent {
  tick: number;
  numerator: number;
  denominator: number;
}

export function getBarsSlice(song: Song, trackId: string, startBar: number, endBar: number): Bar[] {
  const track = song.tracks.find(t => t.id === trackId);
  if (!track) return [];
  return track.bars.slice(startBar, endBar);
}
