/**
 * Shared WebGL renderer. One offscreen GL canvas renders the plasma; every
 * mounted MetalFx copies a cropped slice of it onto its own 2D canvas and
 * clips it to a cached text mask. Adapted from @beastjs/metal-fx 2.0.1.
 * Copyright (c) 2026 Jakub Antalik. MIT license: ./LICENSE.
 */
import { PRESETS, type PresetMode } from './presets';
import { FRAG_SRC, VERT_SRC } from './shader';

const FRAME_MS = 66; // ~15fps — the blurred, slow plasma hides the stepping.
const GL_SIZE = 96; // The plasma is soft; more pixels are wasted fragment work.
const GL_DPR_CAP = 2;

const UNIFORMS = [
  'u_resolution', 'u_time', 'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_color5',
  'u_scale', 'u_vignette', 'u_vigOpacity', 'u_opacity'
] as const;
type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

export interface Instance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  mask: HTMLCanvasElement;
  preset: PresetMode;
  opacity: number;
  visible: boolean;
  paused: boolean;
  /** True once a frame has been copied, so a paused mount still paints once. */
  painted: boolean;
  onFirstPaint?: () => void;
}

interface Shared {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  gl: WebGLRenderingContext;
  uniforms: Uniforms;
  offscreen: boolean;
  bitmap: ImageBitmap | null;
  lost: boolean;
  dirty: boolean;
  preset: PresetMode | null;
  startMs: number;
  lastMs: number;
  raf: number;
  instances: Set<Instance>;
}

let S: Shared | null = null;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('metal-fx: createShader failed');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`metal-fx: shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function buildPipeline(gl: WebGLRenderingContext): Uniforms {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const program = gl.createProgram();
  if (!program) throw new Error('metal-fx: createProgram failed');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`metal-fx: program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {} as Uniforms;
  for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
  return uniforms;
}

function ensureShared(): Shared {
  if (S) return S;
  const size = Math.round(GL_SIZE * Math.min(GL_DPR_CAP, devicePixelRatio || 1));
  const offscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas = offscreen ? new OffscreenCanvas(size, size) : document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: !offscreen
  }) as WebGLRenderingContext | null;
  if (!gl) throw new Error('metal-fx: WebGL not supported');

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (S?.canvas === canvas) S.lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!S || S.canvas !== canvas) return;
    S.uniforms = buildPipeline(S.gl);
    S.dirty = true;
    S.lost = false;
    wake();
  });

  S = {
    canvas, gl, uniforms: buildPipeline(gl), offscreen, bitmap: null, lost: false, dirty: true, preset: null,
    startMs: performance.now(), lastMs: 0, raf: 0, instances: new Set()
  };
  return S;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function renderFrame(s: Shared, now: number, preset: PresetMode): void {
  const { gl, uniforms: u, canvas } = s;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (s.dirty || s.preset !== preset) {
    s.preset = preset;
    gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
    const colors = [u.u_color1, u.u_color2, u.u_color3, u.u_color4, u.u_color5];
    for (let i = 0; i < 5; i++) gl.uniform3f(colors[i], ...hexToRgb(preset.colors[i]));
    gl.uniform1f(u.u_scale, preset.scale);
    gl.uniform1f(u.u_vignette, preset.vignette);
    gl.uniform1f(u.u_vigOpacity, preset.vigOpacity);
    gl.uniform1f(u.u_opacity, preset.opacity);
    s.dirty = false;
  }
  gl.uniform1f(u.u_time, ((now - s.startMs) / 1000) * preset.speed);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  if (s.offscreen) {
    s.bitmap?.close();
    s.bitmap = (canvas as OffscreenCanvas).transferToImageBitmap();
  }
}

function paint(s: Shared, inst: Instance): void {
  const { ctx, canvas } = inst;
  const dw = canvas.width;
  const dh = canvas.height;
  const cw = s.canvas.width;
  const ch = s.canvas.height;
  const sw = Math.min(cw, ch * dw / dh);
  const sh = Math.min(ch, cw * dh / dw);

  ctx.clearRect(0, 0, dw, dh);
  ctx.globalAlpha = inst.opacity;
  ctx.drawImage(s.bitmap ?? s.canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, dw, dh);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(inst.mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  inst.painted = true;
  if (inst.onFirstPaint) {
    const cb = inst.onFirstPaint;
    inst.onFirstPaint = undefined;
    cb();
  }
}

function tick(now: number): void {
  const s = S;
  if (!s) return;
  s.raf = 0;
  if (s.lost) return;
  let work = false;
  for (const inst of s.instances) {
    if (inst.visible && (!inst.paused || !inst.painted)) {
      work = true;
      break;
    }
  }
  if (!work) return;
  s.raf = requestAnimationFrame(tick);
  if (now - s.lastMs < FRAME_MS) return;
  s.lastMs = now;

  const groups = new Map<PresetMode, Instance[]>();
  for (const inst of s.instances) {
    if (inst.visible && !(inst.paused && inst.painted)) {
      const group = groups.get(inst.preset) ?? [];
      group.push(inst);
      groups.set(inst.preset, group);
    }
  }
  for (const [mode, instances] of groups) {
    renderFrame(s, now, mode);
    for (const inst of instances) paint(s, inst);
  }
}

/** Restart the loop if it idled (all paused or offscreen). Browsers already
 *  suspend rAF in hidden tabs, so no visibility handling is needed. */
export function wake(): void {
  if (S && S.raf === 0 && !S.lost) S.raf = requestAnimationFrame(tick);
}

export function updateAppearance(inst: Instance, mode: PresetMode, paused: boolean, strength: number): void {
  inst.preset = mode;
  inst.paused = paused;
  inst.opacity = Math.max(0, Math.min(1, strength));
  inst.painted = false;
  wake();
}

export function mount(canvas: HTMLCanvasElement, onFirstPaint: () => void): Instance {
  const s = ensureShared();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('metal-fx: 2D context unavailable');
  const inst: Instance = {
    canvas, ctx, dpr: 1, mask: document.createElement('canvas'), preset: PRESETS.silver.light, opacity: 1,
    visible: true, paused: false, painted: false, onFirstPaint
  };
  s.instances.add(inst);
  return inst;
}

export function unmount(inst: Instance): void {
  if (!S) return;
  S.instances.delete(inst);
  if (S.instances.size > 0) return;
  cancelAnimationFrame(S.raf);
  S.bitmap?.close();
  S.gl.getExtension('WEBGL_lose_context')?.loseContext();
  S = null;
}

export function resize(inst: Instance, cssWidth: number, cssHeight: number, text: string, font: string): void {
  inst.dpr = devicePixelRatio || 1;
  const w = Math.max(1, Math.round(cssWidth * inst.dpr));
  const h = Math.max(1, Math.round(cssHeight * inst.dpr));
  if (inst.canvas.width !== w) inst.canvas.width = w;
  if (inst.canvas.height !== h) inst.canvas.height = h;
  inst.mask.width = w;
  inst.mask.height = h;
  const mask = inst.mask.getContext('2d');
  if (!mask) throw new Error('metal-text: 2D mask unavailable');
  mask.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
  mask.font = font;
  mask.textAlign = 'center';
  mask.textBaseline = 'alphabetic';
  const metrics = mask.measureText(text);
  const y = cssHeight / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  mask.fillText(text, cssWidth / 2, y);
  // Resize, text, and font changes need a new frame even when paused.
  inst.painted = false;
  wake();
}
