import { useRef, useEffect } from 'react';
import { WaveformVisualiser } from '../gpu/WaveformVis';
import { SpectrumVisualiser } from '../gpu/SpectrumVis';
import { CanvasFallbackVis } from '../gpu/CanvasFallback';

export interface VisualiserPanelProps {
  analyserNode: AnalyserNode | null;
  gpuDevice: GPUDevice | null;
  gpuSupported: boolean;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 120;

const styles = {
  panel: {
    display: 'flex',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#16213e',
    borderTop: '1px solid #333',
    flexWrap: 'wrap' as const,
  },
  visBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  label: {
    color: '#e0e0e0',
    fontSize: '11px',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  canvas: {
    borderRadius: '4px',
    border: '1px solid #333',
    backgroundColor: '#1a1a2e',
  },
} as const;

export function VisualiserPanel({
  analyserNode,
  gpuDevice,
  gpuSupported: _gpuSupported,
}: VisualiserPanelProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Store visualiser instances in refs for cleanup
  const waveformVisRef = useRef<WaveformVisualiser | null>(null);
  const spectrumVisRef = useRef<SpectrumVisualiser | null>(null);
  const fallbackWaveformRef = useRef<CanvasFallbackVis | null>(null);
  const fallbackSpectrumRef = useRef<CanvasFallbackVis | null>(null);

  useEffect(() => {
    const waveformCanvas = waveformCanvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!waveformCanvas || !spectrumCanvas) return;

    // Set canvas dimensions
    waveformCanvas.width = CANVAS_WIDTH;
    waveformCanvas.height = CANVAS_HEIGHT;
    spectrumCanvas.width = CANVAS_WIDTH;
    spectrumCanvas.height = CANVAS_HEIGHT;

    let waveformVis: WaveformVisualiser | null = null;
    let spectrumVis: SpectrumVisualiser | null = null;
    let fallbackWaveform: CanvasFallbackVis | null = null;
    let fallbackSpectrum: CanvasFallbackVis | null = null;

    const useGPU = gpuDevice != null;

    if (useGPU) {
      try {
        waveformVis = new WaveformVisualiser(waveformCanvas, gpuDevice);
        spectrumVis = new SpectrumVisualiser(spectrumCanvas, gpuDevice);
        waveformVisRef.current = waveformVis;
        spectrumVisRef.current = spectrumVis;
      } catch {
        // Fall back to canvas if WebGPU context fails
        fallbackWaveform = new CanvasFallbackVis(waveformCanvas);
        fallbackSpectrum = new CanvasFallbackVis(spectrumCanvas);
        fallbackWaveformRef.current = fallbackWaveform;
        fallbackSpectrumRef.current = fallbackSpectrum;
        waveformVis = null;
        spectrumVis = null;
      }
    } else {
      fallbackWaveform = new CanvasFallbackVis(waveformCanvas);
      fallbackSpectrum = new CanvasFallbackVis(spectrumCanvas);
      fallbackWaveformRef.current = fallbackWaveform;
      fallbackSpectrumRef.current = fallbackSpectrum;
    }

    if (!analyserNode) {
      fallbackWaveform?.clear();
      fallbackSpectrum?.clear();
      return;
    }

    const fftSize = analyserNode.fftSize;
    const timeDomainData = new Float32Array(fftSize);
    const frequencyData = new Float32Array(analyserNode.frequencyBinCount);

    let disposed = false;

    const animate = () => {
      if (disposed) return;
      if (!analyserNode) return;

      // Read analyser data
      analyserNode.getFloatTimeDomainData(timeDomainData);
      analyserNode.getFloatFrequencyData(frequencyData);

      // Normalise frequency data from dB range [-100, 0] to [0, 1]
      const normalizedFreq = new Float32Array(frequencyData.length);
      for (let i = 0; i < frequencyData.length; i++) {
        normalizedFreq[i] = Math.max(0, Math.min(1, (frequencyData[i] + 100) / 100));
      }

      if (waveformVis) {
        waveformVis.update(timeDomainData);
        waveformVis.render();
      } else if (fallbackWaveform) {
        fallbackWaveform.renderWaveform(timeDomainData);
      }

      if (spectrumVis) {
        spectrumVis.update(normalizedFreq);
        spectrumVis.render();
      } else if (fallbackSpectrum) {
        fallbackSpectrum.renderSpectrum(normalizedFreq);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      waveformVis?.dispose();
      spectrumVis?.dispose();
      waveformVisRef.current = null;
      spectrumVisRef.current = null;
      fallbackWaveformRef.current = null;
      fallbackSpectrumRef.current = null;
    };
  }, [analyserNode, gpuDevice]);

  return (
    <div style={styles.panel}>
      <div style={styles.visBlock}>
        <span style={styles.label}>Waveform</span>
        <canvas
          ref={waveformCanvasRef}
          style={styles.canvas}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />
      </div>
      <div style={styles.visBlock}>
        <span style={styles.label}>Spectrum</span>
        <canvas
          ref={spectrumCanvasRef}
          style={styles.canvas}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />
      </div>
    </div>
  );
}
