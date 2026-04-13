import { useState, useEffect } from 'react';
import { initGPU, isWebGPUSupported } from '../gpu/device';

export interface UseGPUReturn {
  gpuDevice: GPUDevice | null;
  supported: boolean;
  loading: boolean;
}

/**
 * Initialises WebGPU on mount.
 *
 * - Checks `isWebGPUSupported()` first; if not supported, returns immediately
 *   with `supported: false` and a null device.
 * - Otherwise calls `initGPU()` and exposes the resulting device.
 * - While the async initialisation is in flight, `loading` is true.
 */
export function useGPU(): UseGPUReturn {
  const [gpuDevice, setGpuDevice] = useState<GPUDevice | null>(null);
  const [supported, setSupported] = useState<boolean>(() => isWebGPUSupported());
  const [loading, setLoading] = useState<boolean>(() => isWebGPUSupported());

  useEffect(() => {
    if (!isWebGPUSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);

    initGPU()
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setGpuDevice(result.device);
          setSupported(true);
        } else {
          setGpuDevice(null);
          setSupported(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setGpuDevice(null);
        setSupported(false);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { gpuDevice, supported, loading };
}
