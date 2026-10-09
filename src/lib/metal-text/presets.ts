/**
 * Bundled palettes. Only the values that differ between presets live here —
 * everything the presets share (drift direction, intensity, distortion,
 * complexity, blur, all-opaque palette alphas) is baked into the shader as
 * constants.
 */
import type { MetalFxPreset } from '@beastjs/metal-fx';

export interface PresetMode {
  /** 5-stop plasma palette at t = 0, 0.25, 0.5, 0.75, 1. */
  colors: [string, string, string, string, string];
  /** Time multiplier applied before the shader. */
  speed: number;
  /** Noise zoom — smaller = chunkier features. */
  scale: number;
  /** Vignette range (0..1). */
  vignette: number;
  /** Vignette darkening strength (0..1). */
  vigOpacity: number;
  /** Final alpha multiplier (0..1). */
  opacity: number;
}

export const PRESETS: Record<MetalFxPreset, Record<'dark' | 'light', PresetMode>> = {
  chromatic: {
    dark: { colors: ['#000000', '#aae8ff', '#c5fe9e', '#f7888d', '#0d0d0d'], speed: 1.2, scale: 1.6, vignette: 0.26, vigOpacity: 0.6, opacity: 1 },
    light: { colors: ['#ffffff', '#ffffff', '#ffffff', '#ffb3b3', '#adadad'], speed: 1.2, scale: 2.5, vignette: 0.24, vigOpacity: 0.16, opacity: 1 }
  },
  silver: {
    dark: { colors: ['#000000', '#dedede', '#747270', '#e5e5e5', '#0d0d0d'], speed: 1.2, scale: 2.5, vignette: 0.26, vigOpacity: 0.6, opacity: 0.88 },
    light: { colors: ['#f6f6f6', '#ffffff', '#ffffff', '#f7f7f7', '#c9c9c9'], speed: 1.2, scale: 2.5, vignette: 0.2, vigOpacity: 0.26, opacity: 1 }
  },
  gold: {
    dark: { colors: ['#000000', '#ffffff', '#ffffff', '#f7d488', '#0d0d0d'], speed: 1.0, scale: 2.5, vignette: 0.26, vigOpacity: 0.6, opacity: 0.92 },
    light: { colors: ['#fff8e1', '#fffbe0', '#ffffff', '#fff6d6', '#d2c7a7'], speed: 1.2, scale: 2.5, vignette: 0.22, vigOpacity: 0.24, opacity: 1 }
  }
};
