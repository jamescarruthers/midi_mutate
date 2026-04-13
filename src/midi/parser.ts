import { Midi } from '@tonejs/midi';
import type { Song, SongMeta, Track, TempoEvent, TimeSigEvent } from '../types/song';
import { DRUM_CHANNEL } from '../utils/constants';
import { computeBarBoundaries, quantiseTrack } from './quantise';
import type { RawNote } from './quantise';

/**
 * Parse a .mid file (as an ArrayBuffer) into the Song data model.
 */
export function parseMidiFile(data: ArrayBuffer): Song {
  const midi = new Midi(new Uint8Array(data));

  // Extract tempo map
  const tempoMap: TempoEvent[] = midi.header.tempos.map((t) => ({
    tick: t.ticks,
    bpm: t.bpm,
  }));

  // Ensure tempo map is sorted by tick
  tempoMap.sort((a, b) => a.tick - b.tick);

  // If no tempo events, default to 120 BPM
  if (tempoMap.length === 0) {
    tempoMap.push({ tick: 0, bpm: 120 });
  }

  // Extract time signatures
  const timeSignatures: TimeSigEvent[] = midi.header.timeSignatures.map((ts) => ({
    tick: ts.ticks,
    numerator: ts.timeSignature[0],
    denominator: ts.timeSignature[1],
  }));

  // Ensure time signatures are sorted by tick
  timeSignatures.sort((a, b) => a.tick - b.tick);

  const ppq = midi.header.ppq;
  const durationTicks = midi.durationTicks;
  const durationSeconds = midi.duration;

  // Compute bar boundaries once for all tracks
  const barBoundaries = computeBarBoundaries(durationTicks, timeSignatures, ppq);

  // Parse tracks
  const tracks: Track[] = midi.tracks
    .filter((t) => t.notes.length > 0) // Skip empty tracks
    .map((midiTrack, index) => {
      // Determine channel from the track's channel property,
      // falling back to 0 if not set
      const channel = midiTrack.channel ?? 0;

      // Determine instrument preset
      const isDrum = channel === DRUM_CHANNEL;
      const instrumentPresetId = isDrum ? 'kick' : 'piano';

      // Convert notes to raw notes
      const rawNotes: RawNote[] = midiTrack.notes.map((n) => ({
        pitch: n.midi,
        velocity: Math.round(n.velocity * 127), // @tonejs/midi normalises to 0-1
        startTick: n.ticks,
        durationTicks: n.durationTicks,
      }));

      // Quantise notes into bars
      const bars = quantiseTrack(rawNotes, barBoundaries, tempoMap);

      const track: Track = {
        id: `track_${index}`,
        name: midiTrack.name || `Track ${index + 1}`,
        channel,
        instrumentPresetId,
        bars,
      };

      return track;
    });

  const meta: SongMeta = {
    name: midi.name || 'Untitled',
    ppq,
    durationTicks,
    durationSeconds,
  };

  const song: Song = {
    meta,
    tracks,
    tempoMap,
    timeSignatures,
  };

  return song;
}
