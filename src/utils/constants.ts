export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

export function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// General MIDI drum map (channel 10)
export const GM_DRUM_MAP: Record<number, string> = {
  35: 'kick',
  36: 'kick',
  38: 'snare',
  40: 'snare',
  42: 'hihat-closed',
  44: 'hihat-closed',
  46: 'hihat-open',
};

// MIDI channel 10 (0-indexed: 9) is drums in GM
export const DRUM_CHANNEL = 9;
