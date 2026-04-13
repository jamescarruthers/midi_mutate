// Placeholder compute shader for spectrogram generation.
// Full FFT-based spectrogram is a future enhancement.
// This shader takes audio sample data and writes magnitude values
// to an output storage buffer that can be copied to a texture.

struct Params {
  sampleCount: u32,
  binCount: u32,
  columnIndex: u32,
  _padding: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> audioData: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let binIndex = gid.x;
  if (binIndex >= params.binCount) {
    return;
  }

  // Simplified magnitude estimation (placeholder for real FFT).
  // Averages a window of samples corresponding to this frequency bin.
  let samplesPerBin = params.sampleCount / params.binCount;
  let start = binIndex * samplesPerBin;
  let end = min(start + samplesPerBin, params.sampleCount);

  var sum: f32 = 0.0;
  for (var i = start; i < end; i = i + 1u) {
    let s = audioData[i];
    sum = sum + s * s;
  }

  let rms = sqrt(sum / f32(end - start));

  // Write into the output buffer at the column offset
  let outIndex = params.columnIndex * params.binCount + binIndex;
  output[outIndex] = rms;
}
