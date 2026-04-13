/**
 * Real-time oscilloscope waveform visualiser using WebGPU.
 * Renders time-domain audio data as a line-strip in bright cyan.
 */

const WAVEFORM_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@group(0) @binding(0) var<storage, read> samples: array<f32>;

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
  let total = arrayLength(&samples);
  let x = f32(idx) / f32(total - 1u) * 2.0 - 1.0;
  let y = samples[idx];
  var out: VertexOutput;
  out.position = vec4f(x, y, 0.0, 1.0);
  out.color = vec3f(0.0, 1.0, 0.8); // #00ffcc
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
`;

export class WaveformVisualiser {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private pipeline: GPURenderPipeline;
  private sampleBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private vertexCount = 0;
  private disposed = false;

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
      label: 'waveform-shader',
      code: WAVEFORM_SHADER,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      label: 'waveform-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'waveform-pipeline-layout',
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'waveform-pipeline',
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
        topology: 'line-strip',
        stripIndexFormat: undefined,
      },
    });
  }

  /**
   * Upload new waveform time-domain data and prepare for rendering.
   * @param data Float32Array of sample values, typically in range [-1, 1].
   */
  update(data: Float32Array): void {
    if (this.disposed) return;

    const byteLength = data.byteLength;

    // Recreate the buffer if the size changed or doesn't exist yet
    if (!this.sampleBuffer || this.sampleBuffer.size < byteLength) {
      this.sampleBuffer?.destroy();
      this.sampleBuffer = this.device.createBuffer({
        label: 'waveform-sample-buffer',
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const bindGroupLayout = this.pipeline.getBindGroupLayout(0);
      this.bindGroup = this.device.createBindGroup({
        label: 'waveform-bind-group',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.sampleBuffer } },
        ],
      });
    }

    this.device.queue.writeBuffer(this.sampleBuffer, 0, data);
    this.vertexCount = data.length;
  }

  /**
   * Execute the render pass, drawing the current waveform data.
   */
  render(): void {
    if (this.disposed || !this.bindGroup || this.vertexCount === 0) return;

    let texture: GPUTexture;
    try {
      texture = this.context.getCurrentTexture();
    } catch {
      // Canvas may have been resized or detached
      return;
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: 'waveform-command-encoder',
    });

    const passEncoder = commandEncoder.beginRenderPass({
      label: 'waveform-render-pass',
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
    passEncoder.draw(this.vertexCount);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Clean up all GPU resources.
   */
  dispose(): void {
    this.disposed = true;
    this.sampleBuffer?.destroy();
    this.sampleBuffer = null;
    this.bindGroup = null;
  }
}
