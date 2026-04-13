import { useRef, useEffect, useState } from 'react';
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
    alignItems: 'flex-start',
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
  toggleBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: '#0f3460',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '4px',
    cursor: 'pointer',
    alignSelf: 'center' as const,
  },
  disabledMsg: {
    color: '#666',
    fontSize: '12px',
    alignSelf: 'center' as const,
    padding: '8px',
  },
} as const;

export function VisualiserPanel({
  analyserNode,
  gpuDevice,
  gpuSupported: _gpuSupported,
}: VisualiserPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const waveformCanvas = waveformCanvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!waveformCanvas || !spectrumCanvas) return;

    waveformCanvas.width = CANVAS_WIDTH;
    waveformCanvas.height = CANVAS_HEIGHT;
    spectrumCanvas.width = CANVAS_WIDTH;
    spectrumCanvas.height = CANVAS_HEIGHT;

    let waveformVis: WaveformVisualiser | null = null;
    let spectrumVis: SpectrumVisualiser | null = null;
    let fallbackWaveform: CanvasFallbackVis | null = null;
    let fallbackSpectrum: CanvasFallbackVis | null = null;

    if (gpuDevice != null) {
      try {
        waveformVis = new WaveformVisualiser(waveformCanvas, gpuDevice);
        spectrumVis = new SpectrumVisualiser(spectrumCanvas, gpuDevice);
      } catch {
        fallbackWaveform = new CanvasFallbackVis(waveformCanvas);
        fallbackSpectrum = new CanvasFallbackVis(spectrumCanvas);
        waveformVis = null;
        spectrumVis = null;
      }
    } else {
      fallbackWaveform = new CanvasFallbackVis(waveformCanvas);
      fallbackSpectrum = new CanvasFallbackVis(spectrumCanvas);
    }

    if (!analyserNode) {
      fallbackWaveform?.clear();
      fallbackSpectrum?.clear();
      return;
    }

    const fftSize = analyserNode.fftSize;
    const binCount = analyserNode.frequencyBinCount;
    const timeDomainData = new Float32Array(fftSize);
    const frequencyData = new Float32Array(binCount);
    const normalizedFreq = new Float32Array(binCount);

    let disposed = false;
    // Throttle to ~30fps — visualiser doesn't need 60fps
    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30;

    const animate = (now: number) => {
      if (disposed) return;

      if (now - lastFrame >= FRAME_INTERVAL) {
        lastFrame = now;

        analyserNode.getFloatTimeDomainData(timeDomainData);
        analyserNode.getFloatFrequencyData(frequencyData);

        for (let i = 0; i < binCount; i++) {
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
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      waveformVis?.dispose();
      spectrumVis?.dispose();
    };
  }, [enabled, analyserNode, gpuDevice]);

  return (
    <div style={styles.panel}>
      <button
        style={styles.toggleBtn}
        onClick={() => setEnabled(!enabled)}
      >
        {enabled ? 'Disable' : 'Enable'} Visualiser
      </button>
      {enabled ? (
        <>
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
        </>
      ) : (
        <span style={styles.disabledMsg}>
          Visualiser disabled for performance
        </span>
      )}
    </div>
  );
}
