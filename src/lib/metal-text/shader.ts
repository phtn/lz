/**
 * Plasma shader. Every bundled preset shares direction (80°), intensity (2),
 * distortion (0.3), complexity (0.68), blur (1) and all-1 palette alphas, so
 * those are folded into constants below; the output is identical to the
 * uniform-driven original.
 */
export const VERT_SRC = /* glsl */ `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

export const FRAG_SRC = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color1, u_color2, u_color3, u_color4, u_color5;
uniform float u_scale, u_vignette, u_vigOpacity, u_opacity;

const vec2 DIRECTION = vec2(0.17364817766693, 0.98480775301221); // 80deg
const float INTENSITY = 2.0;
const float DISTORTION = 0.3;
const float FREQ = 8.44;       // 3 + complexity(0.68) * 8
const int OCTAVES = 5;         // int(3 + complexity(0.68) * 4)
const float BLUR_R = 0.02;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float val = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    val += amp * snoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return val;
}

vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  float w1 = exp(-64.0 * t * t);
  float w2 = exp(-64.0 * (t - 0.25) * (t - 0.25));
  float w3 = exp(-64.0 * (t - 0.5) * (t - 0.5));
  float w4 = exp(-64.0 * (t - 0.75) * (t - 0.75));
  float w5 = exp(-64.0 * (t - 1.0) * (t - 1.0));
  return (u_color1 * w1 + u_color2 * w2 + u_color3 * w3 + u_color4 * w4 + u_color5 * w5)
    / (w1 + w2 + w3 + w4 + w5 + 0.0001);
}

vec3 plasma(vec2 uv, float aspect, float t) {
  vec2 p = (uv - 0.5) * u_scale;
  p.x *= aspect;
  p += DIRECTION * t * 0.15;

  float val = sin(p.x * FREQ + t)
    + sin(p.y * FREQ + t * 1.3)
    + sin((p.x + p.y) * FREQ * 0.7 + t * 0.7)
    + sin(length(p) * FREQ * 0.8 - t * 1.5);
  vec2 w = vec2(fbm(p + vec2(t * 0.1, 0.0)), fbm(p + vec2(0.0, t * 0.12) + 5.0)) * DISTORTION * 2.0;
  val += (w.x + w.y) * DISTORTION;
  return palette(val * 0.2 * INTENSITY + 0.5);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;

  // 5-tap cross blur.
  vec3 col = plasma(uv, aspect, u_time) * 0.4
    + plasma(uv + vec2(BLUR_R, 0.0), aspect, u_time) * 0.15
    + plasma(uv - vec2(BLUR_R, 0.0), aspect, u_time) * 0.15
    + plasma(uv + vec2(0.0, BLUR_R), aspect, u_time) * 0.15
    + plasma(uv - vec2(0.0, BLUR_R), aspect, u_time) * 0.15;

  col = pow(col, vec3(1.3));

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float range = (40.0 / min(u_resolution.x, u_resolution.y)) * (1.0 + u_vignette * 3.0);
  col *= mix(1.0, smoothstep(0.0, 1.0, edge * edge / (range * range)), u_vignette * u_vigOpacity);

  gl_FragColor = vec4(col, u_opacity);
}
`;
