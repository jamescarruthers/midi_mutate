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
  out.color = vec3f(0.0, 1.0, 0.8);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
