/**
 * Canvas 2D fallback visualiser for browsers without WebGPU support.
 * Provides waveform and spectrum rendering using the standard Canvas 2D API.
 */

const BG_COLOR = '#1a1a2e';
const WAVEFORM_COLOR = '#00ffcc';

export class CanvasFallbackVis {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get Canvas 2D context');
    }
    this.ctx = ctx;
  }

  /**
   * Draw a waveform using the Canvas 2D API.
   * Renders a simple line in cyan (#00ffcc) over a dark background.
   * @param data Float32Array of time-domain sample values, typically in range [-1, 1].
   */
  renderWaveform(data: Float32Array): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Clear with dark background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = WAVEFORM_COLOR;
    ctx.lineWidth = 1.5;

    const sliceWidth = width / (data.length - 1);

    for (let i = 0; i < data.length; i++) {
      const x = i * sliceWidth;
      // Map sample value [-1, 1] to canvas y: midY is 0, top is 1, bottom is -1
      const y = midY - data[i] * midY;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  /**
   * Draw spectrum bars using the Canvas 2D fillRect API.
   * Uses a blue-to-magenta gradient based on frequency bin position.
   * @param data Float32Array of frequency magnitude values, typically normalised 0..1.
   */
  renderSpectrum(data: Float32Array): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    // Clear with dark background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    const barWidth = width / data.length;
    const gap = barWidth * 0.1;

    for (let i = 0; i < data.length; i++) {
      const magnitude = data[i];
      const barHeight = magnitude * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Interpolate from blue (0, 102, 255) to magenta (255, 0, 204)
      const t = data.length > 1 ? i / (data.length - 1) : 0;
      const r = Math.round(t * 255);
      const g = Math.round((1 - t) * 102);
      const b = Math.round(255 - t * 51);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, Math.max(barWidth - gap, 1), barHeight);
    }
  }

  /**
   * Clear the canvas with the dark background color.
   */
  clear(): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
