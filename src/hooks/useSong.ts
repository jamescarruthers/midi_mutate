import { useState, useCallback } from 'react';
import type { Song } from '../types/song';
import { parseMidiFile } from '../midi/parser';

export interface UseSongReturn {
  song: Song | null;
  loadFile: (file: File) => Promise<void>;
  error: string | null;
}

/**
 * Manages the loaded Song state.
 *
 * - `loadFile` reads a File as an ArrayBuffer, parses it with `parseMidiFile`,
 *   and stores the resulting Song.
 * - Parse errors are caught and surfaced via the `error` field.
 */
export function useSong(): UseSongReturn {
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File): Promise<void> => {
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseMidiFile(arrayBuffer);
      setSong(parsed);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Failed to parse MIDI file';
      setError(message);
      setSong(null);
    }
  }, []);

  return { song, loadFile, error };
}
