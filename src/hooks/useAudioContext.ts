import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioContextReturn {
  audioContext: AudioContext | null;
  resume: () => Promise<void>;
}

/**
 * Creates and manages a single AudioContext instance.
 *
 * - Lazy initialisation: the AudioContext is created on the first call to
 *   `resume()` or the first render, whichever comes first.
 * - Handles browser autoplay policy by exposing a `resume()` helper that
 *   callers can wire to a user-interaction event.
 * - Cleans up (closes) the AudioContext when the component unmounts.
 */
export function useAudioContext(): UseAudioContextReturn {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const closedRef = useRef(false);

  // Lazily create the AudioContext on first render.
  if (!ctxRef.current && !closedRef.current) {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      // We intentionally set state synchronously during the initial render so
      // downstream hooks that depend on audioContext get it on the very first
      // commit.  React 19 supports this pattern via useState initialiser, but
      // we also need the ref, so we set both here.
      setAudioContext(ctx);
    } catch {
      // AudioContext construction can throw in restricted environments.
    }
  }

  const resume = useCallback(async (): Promise<void> => {
    if (closedRef.current) return;

    // If for some reason the context was not created during render, create it
    // now (e.g. a very restrictive browser).
    if (!ctxRef.current) {
      try {
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        setAudioContext(ctx);
      } catch {
        return;
      }
    }

    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Resuming can fail if the context was closed.
      }
    }
  }, []);

  // Cleanup on unmount: close the AudioContext.
  useEffect(() => {
    return () => {
      closedRef.current = true;
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.close().catch(() => {
          // Closing can fail if already closed.
        });
        ctxRef.current = null;
      }
    };
  }, []);

  return { audioContext, resume };
}
