/**
 * Visual effects fields — pipeline stage 4 (compositing tint).
 *
 * Scope cut for v1: only the thin-film interference tint is produced here.
 * Oxidation, dishing, OPC, scratches, vignette are explicitly deferred (see
 * .deban/roles/pm.md Decisions and the dispatch's out-of-scope list).
 *
 * The thin-film tint imitates the oil-slick sheen visible on real decapped
 * dies: a low-frequency 2D noise field acts as "local dielectric film
 * thickness" which is mapped to RGB by a sinusoidal interference ramp,
 * phase-shifted per channel. Cheap to compute, gets the colour-cycle look.
 *
 * We sample the noise on a coarse grid (much smaller than the canvas) and
 * let the renderer bilinearly interpolate during composition. This is the
 * cheapest possible "thin-film" pass; v1.1 would replace it with a proper
 * Fresnel thin-film LUT.
 */

import { createNoise2D } from 'simplex-noise';
import type { Rng } from '../rng.js';

export interface EffectsInput {
  /** Output field width / height in samples. */
  fieldW: number;
  fieldH: number;
  /** Spatial frequency of the film-thickness noise. */
  frequency?: number;
  /** Strength of the tint when composited. 0 = no tint, 1 = strong tint. */
  strength?: number;
  /** Overall hue rotation in cycles. */
  hueShift?: number;
}

export interface InterferenceField {
  width: number;
  height: number;
  /** Per-cell RGB triples in [0, 1]. Layout: [r0,g0,b0,r1,g1,b1,...] row-major. */
  rgb: Float32Array;
  /** Mixing strength in [0,1]. */
  strength: number;
}

export function generateInterferenceField(rng: Rng, input: EffectsInput): InterferenceField {
  const frequency = input.frequency ?? 0.012;
  const strength = input.strength ?? 0.32;
  const hueShift = input.hueShift ?? rng.range(0, 1);

  // simplex-noise v4 takes a `() => number` to seed itself.
  const noise = createNoise2D(() => rng.next());
  const noise2 = createNoise2D(() => rng.next());

  const w = input.fieldW;
  const h = input.fieldH;
  const rgb = new Float32Array(w * h * 3);

  // Phase offsets per channel — gives the soap-bubble cycle by ensuring R/G/B
  // each peak at slightly different thicknesses.
  const phaseR = 0.0 + hueShift;
  const phaseG = 0.33 + hueShift;
  const phaseB = 0.67 + hueShift;
  // Number of full interference cycles across the thickness range.
  const cycles = 2.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Two-octave smooth noise → film thickness in [0,1].
      const n1 = noise(x * frequency, y * frequency);
      const n2 = noise2(x * frequency * 2.3, y * frequency * 2.3);
      const thickness = 0.5 + 0.45 * n1 + 0.15 * n2;
      const t = Math.max(0, Math.min(1, thickness));

      const angle = 2 * Math.PI * (t * cycles);
      const r = 0.5 + 0.5 * Math.sin(angle + 2 * Math.PI * phaseR);
      const g = 0.5 + 0.5 * Math.sin(angle + 2 * Math.PI * phaseG);
      const b = 0.5 + 0.5 * Math.sin(angle + 2 * Math.PI * phaseB);

      const idx = (y * w + x) * 3;
      rgb[idx + 0] = r;
      rgb[idx + 1] = g;
      rgb[idx + 2] = b;
    }
  }

  return { width: w, height: h, rgb, strength };
}

/** Bilinear sample of the RGB field at normalized coords (u,v) in [0,1]. */
export function sampleField(field: InterferenceField, u: number, v: number): [number, number, number] {
  const x = Math.max(0, Math.min(field.width - 1.0001, u * (field.width - 1)));
  const y = Math.max(0, Math.min(field.height - 1.0001, v * (field.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const idx00 = (y0 * field.width + x0) * 3;
  const idx10 = (y0 * field.width + (x0 + 1)) * 3;
  const idx01 = ((y0 + 1) * field.width + x0) * 3;
  const idx11 = ((y0 + 1) * field.width + (x0 + 1)) * 3;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const r = lerp(lerp(field.rgb[idx00]!, field.rgb[idx10]!, fx), lerp(field.rgb[idx01]!, field.rgb[idx11]!, fx), fy);
  const g = lerp(lerp(field.rgb[idx00 + 1]!, field.rgb[idx10 + 1]!, fx), lerp(field.rgb[idx01 + 1]!, field.rgb[idx11 + 1]!, fx), fy);
  const b = lerp(lerp(field.rgb[idx00 + 2]!, field.rgb[idx10 + 2]!, fx), lerp(field.rgb[idx01 + 2]!, field.rgb[idx11 + 2]!, fx), fy);
  return [r, g, b];
}
