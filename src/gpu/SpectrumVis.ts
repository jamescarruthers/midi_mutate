/**
 * FFT spectrum bar display via WebGPU.
 * Renders frequency-domain data as vertical bars using instanced rendering.
 * Color gradient from blue (low frequency) to magenta (high frequency).
 */

const SPECTRUM_SHADER = /* wgsl */ `
struct Uniforms {
  binCount: u32,
  _padding1: u32,
  _padding2: u32,
  _padding3: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normalizedHeight: f32,
  @location(1) normalizedBin: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> magnitudes: array<f32>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let bins = f32(uniforms.binCount);
  let barWidth = 2.0 / bins;
  let gap = barWidth * 0.1;
  let magnitude = magnitudes[instanceIndex];

  // 6 vertices per quad (two triangles)
  //   0---1
  //   | / |
  //   2---3
  let quadX = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
  let quadY = array<f32, 6>(1.0, 1.0, 0.0, 0.0, 0.0, 1.0);

  let localX = quadX[vertexIndex];
  let localY = quadY[vertexIndex];

  let xBase = f32(instanceIndex) * barWidth - 1.0;
  let x = xBase + localX * (barWidth - gap);
  let height = magnitude * 2.0; // scale magnitude to clip space height
  let y = localY * height - 1.0; // bars grow upward from bottom

  var out: VertexOutput;
  out.position = vec4f(x, y, 0.0, 1.0);
  out.normalizedHeight = localY;
  out.normalizedBin = f32(instanceIndex) / bins;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // Gradient from blue (low frequency) to magenta (high frequency)
  let blue = vec3f(0.0, 0.4, 1.0);
  let magenta = vec3f(1.0, 0.0, 0.8);
  let color = mix(blue, magenta, in.normalizedBin);
  // Brighten towards the top of each bar
  let brightness = mix(0.5, 1.0, in.normalizedHeight);
  return vec4f(color * brightness, 1.0);
}
`;

/** Minimum uniform buffer size — 16 bytes (one vec4-aligned u32 + 3 padding). */
const UNIFORM_SIZE = 16;

export class SpectrumVisualiser {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private magnitudeBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private binCount = 0;
  private disposed = false;

  private bindGroupLayout: GPUBindGroupLayout;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    this.device = device;

    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
      throw new Error('Failed to get WebGPU context from canvas');
    }
    this.context = ctx;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    const shaderModule = this.device.createShaderModule({
      label: 'spectrum-shader',
      code: SPECTRUM_SHADER,
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'spectrum-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'spectrum-pipeline-layout',
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'spectrum-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // Uniform buffer is fixed size — just binCount + padding
    this.uniformBuffer = this.device.createBuffer({
      label: 'spectrum-uniform-buffer',
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Upload new frequency-domain data and prepare for rendering.
   * @param data Float32Array of magnitude values, typically normalised 0..1.
   */
  update(data: Float32Array): void {
    if (this.disposed) return;

    const newBinCount = data.length;
    const byteLength = data.byteLength;

    // Recreate magnitude buffer if bin count changed
    if (!this.magnitudeBuffer || this.binCount !== newBinCount) {
      this.magnitudeBuffer?.destroy();
      this.magnitudeBuffer = this.device.createBuffer({
        label: 'spectrum-magnitude-buffer',
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.binCount = newBinCount;

      // Update uniform buffer with new bin count
      const uniformData = new Uint32Array([this.binCount, 0, 0, 0]);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

      // Rebuild bind group with new magnitude buffer
      this.bindGroup = this.device.createBindGroup({
        label: 'spectrum-bind-group',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.magnitudeBuffer } },
        ],
      });
    }

    this.device.queue.writeBuffer(this.magnitudeBuffer, 0, data);
  }

  /**
   * Execute the render pass, drawing the current spectrum bars.
   */
  render(): void {
    if (this.disposed || !this.bindGroup || this.binCount === 0) return;

    let texture: GPUTexture;
    try {
      texture = this.context.getCurrentTexture();
    } catch {
      return;
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: 'spectrum-command-encoder',
    });

    const passEncoder = commandEncoder.beginRenderPass({
      label: 'spectrum-render-pass',
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.18, a: 1.0 }, // #1a1a2e
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    // 6 vertices per quad, one instance per frequency bin
    passEncoder.draw(6, this.binCount);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Clean up all GPU resources.
   */
  dispose(): void {
    this.disposed = true;
    this.magnitudeBuffer?.destroy();
    this.magnitudeBuffer = null;
    this.uniformBuffer.destroy();
    this.bindGroup = null;
  }
}
