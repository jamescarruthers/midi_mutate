// Centralised WebGPU initialisation
// Detects support, requests adapter + device
// Returns null if WebGPU unavailable (fallback to Canvas)
let gpuDevice: GPUDevice | null = null;
let gpuContext: { adapter: GPUAdapter; device: GPUDevice } | null = null;

export async function initGPU(): Promise<{ adapter: GPUAdapter; device: GPUDevice } | null> {
  if (gpuContext) return gpuContext;
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    gpuDevice = device;
    gpuContext = { adapter, device };
    return gpuContext;
  } catch {
    return null;
  }
}

export function getGPUDevice(): GPUDevice | null {
  return gpuDevice;
}

export function isWebGPUSupported(): boolean {
  return !!navigator.gpu;
}
