import { useState, useRef, useEffect, useCallback } from 'react';
import type { Song } from '../types/song';
import type { InstrumentEngine } from '../types/synth';
import type { TransportState, TrackMixState } from '../types/transport';
import { Transport } from '../transport/Transport';
import { Mixer } from '../transport/Mixer';
import { SubtractiveSynth } from '../synth/SubtractiveSynth';
import { DrumSynth } from '../synth/DrumSynth';
import { PRESETS, DEFAULT_PRESET_ID } from '../synth/presets';
import { DRUM_CHANNEL } from '../utils/constants';

export interface UseTransportReturn {
  state: TransportState;
  currentTick: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekToBar: (index: number) => void;
  tempoScale: number;
  setTempoScale: (scale: number) => void;
  loopEnabled: boolean;
  setLoop: (enabled: boolean, start?: number, end?: number) => void;
  loopStartBar: number;
  loopEndBar: number;
  trackMixStates: TrackMixState[];
  setTrackGain: (trackId: string, gain: number) => void;
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;
  masterGain: number;
  setMasterGain: (gain: number) => void;
  analyserNode: AnalyserNode | null;
  changePreset: (trackId: string, presetId: string) => void;
}

/**
 * Manages Transport, Mixer, and synth engine instances.
 *
 * - Creates Transport and Mixer when `audioContext` becomes available.
 * - When `song` changes, creates synth engines per track (DrumSynth for
 *   channel 9, SubtractiveSynth for all others) and loads them into the
 *   Transport.
 * - Exposes reactive state for transport status, current tick, per-track mix,
 *   loop, and tempo scale.
 * - Cleans up Transport and Mixer on unmount.
 */
export function useTransport(
  audioContext: AudioContext | null,
  song: Song | null,
): UseTransportReturn {
  // -----------------------------------------------------------------------
  // Refs for non-reactive instances
  // -----------------------------------------------------------------------
  const transportRef = useRef<Transport | null>(null);
  const mixerRef = useRef<Mixer | null>(null);
  const enginesRef = useRef<Map<string, InstrumentEngine>>(new Map());

  // -----------------------------------------------------------------------
  // Reactive state
  // -----------------------------------------------------------------------
  const [state, setState] = useState<TransportState>('stopped');
  const [currentTick, setCurrentTick] = useState(0);
  const [tempoScale, setTempoScaleState] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStartBar, setLoopStartBar] = useState(0);
  const [loopEndBar, setLoopEndBar] = useState(0);
  const [trackMixStates, setTrackMixStates] = useState<TrackMixState[]>([]);
  const [masterGain, setMasterGainState] = useState(1);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // -----------------------------------------------------------------------
  // Create / tear down Transport + Mixer when audioContext changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!audioContext) return;

    const transport = new Transport(audioContext);
    const mixer = new Mixer(audioContext);

    transport.onStateChange = (newState: TransportState) => {
      setState(newState);
    };

    // Throttle tick updates to animation-frame rate instead of every 25ms
    // scheduler pass. The scheduler fires at 40Hz but React re-renders are
    // expensive — batching to rAF (~60Hz cap, but only one render per
    // frame) prevents the entire component tree from thrashing.
    let pendingTick: number | null = null;
    let rafId = 0;
    transport.onTickUpdate = (tick: number) => {
      pendingTick = tick;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          if (pendingTick !== null) {
            setCurrentTick(pendingTick);
            pendingTick = null;
          }
          rafId = 0;
        });
      }
    };

    transportRef.current = transport;
    mixerRef.current = mixer;

    // Create the analyser node eagerly so visualisations can bind.
    setAnalyserNode(mixer.getAnalyserNode());

    return () => {
      cancelAnimationFrame(rafId);
      transport.dispose();
      mixer.dispose();
      disposeEngines();
      transportRef.current = null;
      mixerRef.current = null;
      setAnalyserNode(null);
      setState('stopped');
      setCurrentTick(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext]);

  // -----------------------------------------------------------------------
  // Load song: create engines, connect to mixer, load into transport
  // -----------------------------------------------------------------------
  useEffect(() => {
    const transport = transportRef.current;
    const mixer = mixerRef.current;

    if (!audioContext || !transport || !mixer || !song) {
      // No song to load -- reset mix states.
      setTrackMixStates([]);
      return;
    }

    // Dispose any previous engines.
    disposeEngines();

    const newEngines = new Map<string, InstrumentEngine>();

    for (const track of song.tracks) {
      const bus = mixer.createTrackBus(track.id);

      let engine: InstrumentEngine;

      if (track.channel === DRUM_CHANNEL) {
        engine = new DrumSynth(audioContext, bus);
      } else {
        const preset =
          PRESETS[track.instrumentPresetId] ?? PRESETS[DEFAULT_PRESET_ID];
        engine = new SubtractiveSynth(audioContext, preset, bus);
      }

      newEngines.set(track.id, engine);
    }

    enginesRef.current = newEngines;
    transport.loadSong(song, newEngines);

    // Build initial mix states from song tracks.
    const initialMix: TrackMixState[] = song.tracks.map((t) => ({
      trackId: t.id,
      gain: 1,
      muted: false,
      solo: false,
    }));
    setTrackMixStates(initialMix);

    // Reset playback-related state for the new song.
    setState('stopped');
    setCurrentTick(0);

    return () => {
      // When song changes or component unmounts, stop + dispose engines.
      transport.stop();
      disposeEngines();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext, song]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function disposeEngines(): void {
    for (const engine of enginesRef.current.values()) {
      engine.dispose();
    }
    enginesRef.current = new Map();
  }

  // -----------------------------------------------------------------------
  // Transport controls (stable callbacks)
  // -----------------------------------------------------------------------

  const play = useCallback(() => {
    transportRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    transportRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    transportRef.current?.stop();
  }, []);

  const seekToBar = useCallback((index: number) => {
    transportRef.current?.seekToBar(index);
  }, []);

  const setTempoScale = useCallback((scale: number) => {
    transportRef.current?.setTempoScale(scale);
    setTempoScaleState(scale);
  }, []);

  const setLoop = useCallback(
    (enabled: boolean, start?: number, end?: number) => {
      transportRef.current?.setLoop(enabled, start, end);
      setLoopEnabled(enabled);
      if (start !== undefined) setLoopStartBar(start);
      if (end !== undefined) setLoopEndBar(end);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Mixer controls (stable callbacks)
  // -----------------------------------------------------------------------

  const setTrackGain = useCallback((trackId: string, gain: number) => {
    mixerRef.current?.setTrackGain(trackId, gain);
    setTrackMixStates((prev) =>
      prev.map((s) => (s.trackId === trackId ? { ...s, gain } : s)),
    );
  }, []);

  const setTrackMute = useCallback((trackId: string, muted: boolean) => {
    mixerRef.current?.setTrackMute(trackId, muted);
    setTrackMixStates((prev) =>
      prev.map((s) => (s.trackId === trackId ? { ...s, muted } : s)),
    );
  }, []);

  const setTrackSolo = useCallback((trackId: string, solo: boolean) => {
    mixerRef.current?.setTrackSolo(trackId, solo);
    setTrackMixStates((prev) =>
      prev.map((s) => (s.trackId === trackId ? { ...s, solo } : s)),
    );
  }, []);

  const setMasterGain = useCallback((gain: number) => {
    mixerRef.current?.setMasterGain(gain);
    setMasterGainState(gain);
  }, []);

  // -----------------------------------------------------------------------
  // Preset change
  // -----------------------------------------------------------------------

  const changePreset = useCallback(
    (trackId: string, presetId: string) => {
      const mixer = mixerRef.current;
      const transport = transportRef.current;

      if (!audioContext || !mixer || !transport || !song) return;

      const track = song.tracks.find((t) => t.id === trackId);
      if (!track) return;

      // Dispose the old engine for this track.
      const oldEngine = enginesRef.current.get(trackId);
      if (oldEngine) {
        oldEngine.dispose();
      }

      // Create a new engine with the requested preset, connected to the
      // existing mixer bus.
      const bus = mixer.createTrackBus(trackId);
      let newEngine: InstrumentEngine;

      if (track.channel === DRUM_CHANNEL) {
        // Drums always use DrumSynth regardless of preset change request.
        newEngine = new DrumSynth(audioContext, bus);
      } else {
        const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET_ID];
        newEngine = new SubtractiveSynth(audioContext, preset, bus);
      }

      enginesRef.current.set(trackId, newEngine);

      // Reload the song into transport with the updated engines map so that
      // subsequent play() calls use the new engine.
      transport.loadSong(song, enginesRef.current);
    },
    [audioContext, song],
  );

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    state,
    currentTick,
    play,
    pause,
    stop,
    seekToBar,
    tempoScale,
    setTempoScale,
    loopEnabled,
    setLoop,
    loopStartBar,
    loopEndBar,
    trackMixStates,
    setTrackGain,
    setTrackMute,
    setTrackSolo,
    masterGain,
    setMasterGain,
    analyserNode,
    changePreset,
  };
}
