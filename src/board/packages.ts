/**
 * Package geometry generators.
 *
 * Each function returns a PackageGeometry: a set of pin/ball/finger footprints
 * laid out relative to the component's bounding box origin (0,0 = top-left).
 *
 * All randomness is passed in as an Rng; nothing here is timestamp-driven.
 */

import type { Rng } from '../rng.js';
import type { PackageGeometry, PinFeature } from './types.js';

/** Square/rectangular BGA: full ball grid under the body. */
export function bga(opts: {
  w: number;
  h: number;
  rng: Rng;
  ballPitch?: number;      // mm between balls
  ballR?: number;          // ball radius in mm
  edgeMargin?: number;     // mm from body edge to first ball ring
  centreVoid?: boolean;    // skip a centre region (typical for big BGAs)
}): PackageGeometry {
  const pitch = opts.ballPitch ?? 1.0;
  const r = opts.ballR ?? 0.35;
  const m = opts.edgeMargin ?? 1.2;

  const innerW = opts.w - 2 * m;
  const innerH = opts.h - 2 * m;
  const nx = Math.max(4, Math.floor(innerW / pitch) + 1);
  const ny = Math.max(4, Math.floor(innerH / pitch) + 1);
  // Centre the ball grid inside the package.
  const startX = m + (innerW - (nx - 1) * pitch) / 2;
  const startY = m + (innerH - (ny - 1) * pitch) / 2;

  const pins: PinFeature[] = [];
  const voidR = opts.centreVoid ? Math.min(nx, ny) * 0.25 : 0;
  const cx = (nx - 1) / 2;
  const cy = (ny - 1) / 2;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (voidR > 0) {
        const dx = i - cx;
        const dy = j - cy;
        if (Math.hypot(dx, dy) < voidR) continue;
      }
      pins.push({
        cx: startX + i * pitch,
        cy: startY + j * pitch,
        r,
      });
    }
  }

  // Light jitter on a few balls (manufacturing-style irregularity)
  for (let k = 0; k < Math.floor(pins.length * 0.01); k++) {
    const idx = opts.rng.int(0, pins.length - 1);
    const p = pins[idx]!;
    p.cx += opts.rng.range(-0.04, 0.04);
    p.cy += opts.rng.range(-0.04, 0.04);
  }

  return {
    kind: 'bga',
    pins,
    pin1: { x: m * 0.7, y: m * 0.7 },
  };
}

/** Quad Flat Pack: leaded edges on all four sides, no balls underneath. */
export function qfp(opts: {
  w: number;
  h: number;
  rng: Rng;
  leadPitch?: number;  // mm between leads
  leadW?: number;      // lead width (across the edge)
  leadH?: number;      // lead length (perpendicular)
  edgeInset?: number;  // distance from body edge to first lead
}): PackageGeometry {
  const pitch = opts.leadPitch ?? 0.65;
  const lw = opts.leadW ?? 0.30;
  const lh = opts.leadH ?? 0.85;
  const inset = opts.edgeInset ?? 0.8;

  const pins: PinFeature[] = [];

  // Number of leads along each axis (subtract corners so the count fits)
  const nx = Math.max(6, Math.floor((opts.w - 2 * inset) / pitch));
  const ny = Math.max(6, Math.floor((opts.h - 2 * inset) / pitch));

  const startX = inset + ((opts.w - 2 * inset) - (nx - 1) * pitch) / 2;
  const startY = inset + ((opts.h - 2 * inset) - (ny - 1) * pitch) / 2;

  // Top edge
  for (let i = 0; i < nx; i++) {
    pins.push({ cx: startX + i * pitch, cy: lh / 2 - 0.1, w: lw, h: lh });
  }
  // Bottom edge
  for (let i = 0; i < nx; i++) {
    pins.push({ cx: startX + i * pitch, cy: opts.h - lh / 2 + 0.1, w: lw, h: lh });
  }
  // Left edge
  for (let j = 0; j < ny; j++) {
    pins.push({ cx: lh / 2 - 0.1, cy: startY + j * pitch, w: lh, h: lw });
  }
  // Right edge
  for (let j = 0; j < ny; j++) {
    pins.push({ cx: opts.w - lh / 2 + 0.1, cy: startY + j * pitch, w: lh, h: lw });
  }

  // Pin-1 marker bottom-left corner (chamfer convention varies; this is fine)
  return {
    kind: 'qfp',
    pins,
    pin1: { x: opts.w * 0.1, y: opts.h * 0.1 },
  };
}

/** Small Outline IC (e.g. SOIC-8 / SOIC-16). Leads on two long sides. */
export function soic(opts: {
  w: number;
  h: number;
  rng: Rng;
  leadPitch?: number;
  leadW?: number;
  leadH?: number;
}): PackageGeometry {
  const pitch = opts.leadPitch ?? 1.27;
  const lw = opts.leadW ?? 0.50;
  const lh = opts.leadH ?? 1.0;

  // Number of leads per long side
  const n = Math.max(4, Math.floor((opts.h - 1.0) / pitch));
  const startY = (opts.h - (n - 1) * pitch) / 2;

  const pins: PinFeature[] = [];
  for (let j = 0; j < n; j++) {
    // Left side
    pins.push({ cx: lh / 2 - 0.05, cy: startY + j * pitch, w: lh, h: lw });
    // Right side
    pins.push({ cx: opts.w - lh / 2 + 0.05, cy: startY + j * pitch, w: lh, h: lw });
  }

  return {
    kind: 'soic',
    pins,
    pin1: { x: lh * 0.6, y: startY - pitch * 0.3 },
  };
}

/** DIMM socket — long narrow slot with gold edge fingers along its length. */
export function dimm(opts: {
  w: number;
  h: number;
  rng: Rng;
  fingerPitch?: number;  // mm between fingers
  fingerH?: number;      // finger length
}): PackageGeometry {
  const pitch = opts.fingerPitch ?? 0.85;
  const fh = opts.fingerH ?? Math.min(2.0, opts.h * 0.35);
  // Fingers run along the long axis; subtract end caps from the body length.
  const usable = opts.w - 4;
  const n = Math.max(20, Math.floor(usable / pitch));
  const startX = (opts.w - (n - 1) * pitch) / 2;

  // Slot lives down the centre line; fingers are inside the slot.
  const slotCY = opts.h / 2;
  const pins: PinFeature[] = [];
  for (let i = 0; i < n; i++) {
    pins.push({
      cx: startX + i * pitch,
      cy: slotCY,
      w: 0.35,
      h: fh,
    });
  }
  return {
    kind: 'dimm',
    pins,
  };
}

/** PCIe edge slot — long, with gold-tipped edge fingers visible inside. */
export function pcie(opts: {
  w: number;
  h: number;
  rng: Rng;
  fingerPitch?: number;
}): PackageGeometry {
  const pitch = opts.fingerPitch ?? 1.0;
  const usable = opts.w - 6;
  const n = Math.max(24, Math.floor(usable / pitch));
  const startX = (opts.w - (n - 1) * pitch) / 2;
  const cy = opts.h / 2;
  const pins: PinFeature[] = [];
  for (let i = 0; i < n; i++) {
    pins.push({ cx: startX + i * pitch, cy, w: 0.5, h: opts.h * 0.55 });
  }
  return {
    kind: 'pcie',
    pins,
  };
}

/** Electrolytic capacitor — round footprint, two pad-leads underneath. */
export function electrolytic(opts: { w: number; h: number; rng: Rng }): PackageGeometry {
  // Pads are at ±35% of the diameter from the centre.
  const d = Math.min(opts.w, opts.h);
  const off = d * 0.35;
  return {
    kind: 'electro',
    pins: [
      { cx: opts.w / 2 - off, cy: opts.h / 2, r: 0.4 },
      { cx: opts.w / 2 + off, cy: opts.h / 2, r: 0.4 },
    ],
  };
}

/** Ceramic SMD capacitor / resistor block: two pads on short ends. */
export function ceramicSmd(opts: { w: number; h: number; rng: Rng }): PackageGeometry {
  const padW = opts.w * 0.30;
  const padH = opts.h * 0.85;
  return {
    kind: 'ceramic',
    pins: [
      { cx: padW / 2, cy: opts.h / 2, w: padW, h: padH },
      { cx: opts.w - padW / 2, cy: opts.h / 2, w: padW, h: padH },
    ],
  };
}

/** VRM toroidal inductor — round with central post. */
export function inductorToroid(opts: { w: number; h: number; rng: Rng }): PackageGeometry {
  const d = Math.min(opts.w, opts.h);
  const off = d * 0.30;
  return {
    kind: 'inductor',
    pins: [
      { cx: opts.w / 2 - off, cy: opts.h * 0.9, w: 1.4, h: 0.8 },
      { cx: opts.w / 2 + off, cy: opts.h * 0.9, w: 1.4, h: 0.8 },
    ],
  };
}

/** MOSFET — SOT-23-ish small rectangle with three pads. */
export function mosfet(opts: { w: number; h: number; rng: Rng }): PackageGeometry {
  const pw = 0.8;
  const ph = 0.6;
  return {
    kind: 'mosfet',
    pins: [
      { cx: opts.w * 0.25, cy: opts.h - 0.2, w: pw, h: ph },
      { cx: opts.w * 0.75, cy: opts.h - 0.2, w: pw, h: ph },
      { cx: opts.w * 0.5, cy: 0.2, w: pw * 1.4, h: ph },
    ],
  };
}

/** I/O panel cut-out: rectangular slot with a tab/contact strip inside. */
export function ioPanel(opts: { w: number; h: number; rng: Rng }): PackageGeometry {
  // Treat the I/O as a hollow rectangle with a single contact bar inside.
  return {
    kind: 'io',
    pins: [
      { cx: opts.w / 2, cy: opts.h * 0.5, w: opts.w * 0.85, h: opts.h * 0.18 },
    ],
  };
}
