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
  // Vertex order: 0-1-2, 2-1-3 forming a quad
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
