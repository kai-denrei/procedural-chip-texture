/**
 * Motherboard renderer — Canvas2D paint of a BoardScene.
 *
 * Layer order (back to front):
 *   1. Solder-mask base (green) + low-frequency noise modulation
 *   2. Copper traces + vias
 *   3. Silver solder pads under packages (ball/lead pads)
 *   4. ENIG-gold on PCIe + DIMM fingers + I/O contact strips
 *   5. Component bodies
 *   6. Ball/lead/finger detail on top of bodies
 *   7. Silkscreen labels + auto-refs
 *   8. Mounting hole drills
 *
 * No randomness inside render — every byte of variation is already on the
 * BoardScene from upstream.
 */

import { createNoise2D } from 'simplex-noise';
import type { BoardScene, Component, Trace, PinFeature } from './types.js';
import { makeRng } from '../rng.js';

export interface BoardRenderOptions {
  /** Output canvas pixel width — height auto-derived from scene aspect. */
  pixelWidth: number;
}

interface Palette {
  pcbGreen: string;
  pcbGreenDark: string;
  copper: string;
  copperDark: string;
  copperPower: string;
  via: string;
  pad: string;
  padShade: string;
  gold: string;
  goldDark: string;
  bodyDark: string;
  bodyMid: string;
  bodyLight: string;
  bodyMosfet: string;
  inductorCore: string;
  inductorWire: string;
  electroTop: string;
  electroRim: string;
  silk: string;
  silkDim: string;
  hole: string;
}

const PALETTE: Palette = {
  pcbGreen:       '#0f5234',
  pcbGreenDark:   '#093321',
  copper:         '#c87a32',
  copperDark:     '#7a3f1c',
  copperPower:    '#d68d3a',
  via:            '#1c1610',
  pad:            '#b8b5ac',
  padShade:       '#8c8a82',
  gold:           '#e0b75a',
  goldDark:       '#9b7a30',
  bodyDark:       '#1a1814',
  bodyMid:        '#2b2722',
  bodyLight:      '#3a3530',
  bodyMosfet:     '#171717',
  inductorCore:   '#3a2a1c',
  inductorWire:   '#c87a32',
  electroTop:     '#1c1f24',
  electroRim:     '#9e9e9e',
  silk:           '#eef0ec',
  silkDim:        '#cdd1cc',
  hole:           '#020201',
};

export function renderBoard(
  canvas: HTMLCanvasElement,
  scene: BoardScene,
  opts: BoardRenderOptions,
): void {
  const px = opts.pixelWidth;
  // Map PCB mm → canvas pixels so the longer side fits.
  const scale = px / scene.pcbW;
  const pxH = Math.round(scene.pcbH * scale);
  canvas.width = px;
  canvas.height = pxH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('renderBoard: no 2d context');

  // ---------- 1. PCB solder-mask base ----------
  ctx.fillStyle = PALETTE.pcbGreen;
  ctx.fillRect(0, 0, px, pxH);
  drawSolderMaskNoise(ctx, px, pxH, scene.seed);

  // Board edge bevel (slight inset shadow)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, px - 2, pxH - 2);

  // ---------- 2. Copper traces ----------
  for (const t of scene.traces) drawTrace(ctx, t, scale);
  // Vias on top of traces
  for (const v of scene.vias) {
    ctx.fillStyle = PALETTE.via;
    ctx.beginPath();
    ctx.arc(v.cx * scale, v.cy * scale, Math.max(0.6, v.r * scale * 1.4), 0, Math.PI * 2);
    ctx.fill();
    // Inner copper ring annulus highlight
    ctx.fillStyle = PALETTE.copperDark;
    ctx.beginPath();
    ctx.arc(v.cx * scale, v.cy * scale, Math.max(0.3, v.r * scale * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 3. ENIG gold on PCIe + DIMM + IO fingers ----------
  for (const c of scene.components) {
    if (c.kind === 'pcie' || c.kind === 'ram') drawGoldFingerStrip(ctx, c, scale);
    if (c.kind === 'io-panel') drawIoContactStrip(ctx, c, scale);
  }

  // ---------- 4. Silver solder pads under packages ----------
  for (const c of scene.components) drawSolderPads(ctx, c, scale);

  // ---------- 5. Component bodies ----------
  for (const c of scene.components) drawBody(ctx, c, scale);

  // ---------- 6. Pin/ball/lead detail on top of body where appropriate ----------
  for (const c of scene.components) drawPinDetail(ctx, c, scale);

  // ---------- 7. Silkscreen labels ----------
  ctx.fillStyle = PALETTE.silk;
  ctx.textBaseline = 'top';
  for (const lab of scene.labels) {
    ctx.font = `${Math.max(8, Math.round(lab.size * scale))}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = PALETTE.silkDim;
    ctx.fillText(lab.text, lab.x * scale, lab.y * scale);
  }

  // Top-labels (the big CPU / MCH / ICH / DIMM / PCIE text on package tops)
  for (const c of scene.components) {
    if (!c.topLabel) continue;
    drawTopLabel(ctx, c, scale);
  }

  // ---------- 8. Mounting hole drills (on top so they punch through) ----------
  for (const c of scene.components) {
    if (c.kind !== 'mount-hole') continue;
    drawMountHole(ctx, c, scale);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function drawSolderMaskNoise(ctx: CanvasRenderingContext2D, w: number, h: number, seed: string): void {
  // Cheap low-frequency noise via simplex-noise, multiplicatively darkening
  // a fraction of the green to give the board some "texture under the mask".
  const rng = makeRng(`mask:${seed}`);
  const noise = createNoise2D(() => rng.next());
  const cell = 8;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const n = noise(x / 90, y / 90); // [-1, 1]
      const t = (n + 1) / 2;            // [0, 1]
      // Mix between mid green and dark green
      const r = Math.round(0x0f + (0x09 - 0x0f) * t);
      const g = Math.round(0x52 + (0x33 - 0x52) * t);
      const b = Math.round(0x34 + (0x21 - 0x34) * t);
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function drawTrace(ctx: CanvasRenderingContext2D, t: Trace, scale: number): void {
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  // Underlay shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, (t.width + 0.05) * scale + 0.6);
  ctx.beginPath();
  ctx.moveTo(t.points[0]!.x * scale, t.points[0]!.y * scale);
  for (let i = 1; i < t.points.length; i++) {
    ctx.lineTo(t.points[i]!.x * scale, t.points[i]!.y * scale);
  }
  ctx.stroke();
  // Copper top
  ctx.strokeStyle = t.net === 'power' ? PALETTE.copperPower : PALETTE.copper;
  ctx.lineWidth = Math.max(0.8, t.width * scale);
  ctx.beginPath();
  ctx.moveTo(t.points[0]!.x * scale, t.points[0]!.y * scale);
  for (let i = 1; i < t.points.length; i++) {
    ctx.lineTo(t.points[i]!.x * scale, t.points[i]!.y * scale);
  }
  ctx.stroke();
  // Highlight stripe
  ctx.strokeStyle = 'rgba(255,210,160,0.45)';
  ctx.lineWidth = Math.max(0.3, t.width * scale * 0.35);
  ctx.beginPath();
  ctx.moveTo(t.points[0]!.x * scale, t.points[0]!.y * scale);
  for (let i = 1; i < t.points.length; i++) {
    ctx.lineTo(t.points[i]!.x * scale, t.points[i]!.y * scale);
  }
  ctx.stroke();
}

function drawGoldFingerStrip(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  // For PCIe slots the gold edge is the slot opening (long thin strip
  // centred on the y-axis). For DIMM the fingers sit inside the slot.
  if (c.kind === 'pcie') {
    const x = c.rect.x * scale;
    const y = c.rect.y * scale;
    const w = c.rect.w * scale;
    const h = c.rect.h * scale;
    // Slot backplane in ENIG gold
    ctx.fillStyle = PALETTE.goldDark;
    ctx.fillRect(x, y, w, h);
    // Finger combs
    ctx.fillStyle = PALETTE.gold;
    const pitch = 1.0 * scale;
    const finW = 0.55 * scale;
    let fx = x + 3 * scale;
    while (fx + finW < x + w - 3 * scale) {
      ctx.fillRect(fx, y + h * 0.15, finW, h * 0.7);
      fx += pitch;
    }
  } else if (c.kind === 'ram') {
    // DIMM slot body (dark plastic) is drawn in drawBody; the gold fingers
    // are visible inside the central slot opening.
    const x = c.rect.x * scale;
    const y = c.rect.y * scale;
    const w = c.rect.w * scale;
    const h = c.rect.h * scale;
    // Inset gold strip down the centre
    const stripH = h * 0.40;
    const stripY = y + (h - stripH) / 2;
    ctx.fillStyle = PALETTE.goldDark;
    ctx.fillRect(x + 4 * scale, stripY, w - 8 * scale, stripH);
    ctx.fillStyle = PALETTE.gold;
    const pitch = 0.85 * scale;
    const finW = 0.45 * scale;
    let fx = x + 5 * scale;
    while (fx + finW < x + w - 5 * scale) {
      ctx.fillRect(fx, stripY + 1, finW, stripH - 2);
      fx += pitch;
    }
  }
}

function drawIoContactStrip(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  const x = c.rect.x * scale;
  const y = c.rect.y * scale;
  const w = c.rect.w * scale;
  const h = c.rect.h * scale;
  // Hollow rectangle: outer body (dark), inner cavity (very dark), then a
  // gold tongue inside.
  ctx.fillStyle = PALETTE.bodyDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#050606';
  ctx.fillRect(x + 1.2, y + 1.2, w - 2.4, h - 2.4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x + w * 0.08, y + h * 0.42, w * 0.84, h * 0.16);
}

function drawSolderPads(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  // RAM/PCIE/IO contacts were handled separately; mounting holes have no pads.
  if (c.kind === 'ram' || c.kind === 'pcie' || c.kind === 'io-panel' || c.kind === 'mount-hole') return;
  const ox = c.rect.x * scale;
  const oy = c.rect.y * scale;
  for (const p of c.pkg.pins) {
    if (p.r !== undefined) {
      ctx.fillStyle = PALETTE.padShade;
      ctx.beginPath();
      ctx.arc(ox + p.cx * scale, oy + p.cy * scale, Math.max(1.2, p.r * scale * 1.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.w !== undefined && p.h !== undefined) {
      ctx.fillStyle = PALETTE.padShade;
      ctx.fillRect(
        ox + (p.cx - p.w / 2) * scale,
        oy + (p.cy - p.h / 2) * scale,
        p.w * scale,
        p.h * scale,
      );
    }
  }
}

function drawBody(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  const x = c.rect.x * scale;
  const y = c.rect.y * scale;
  const w = c.rect.w * scale;
  const h = c.rect.h * scale;

  switch (c.kind) {
    case 'cpu':
    case 'northbridge': {
      // Dark IC body with a subtle highlight along the top edge.
      ctx.fillStyle = PALETTE.bodyDark;
      ctx.fillRect(x, y, w, h);
      // Inner panel
      ctx.fillStyle = PALETTE.bodyMid;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      // Top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 2, y + 2, w - 4, Math.max(1, h * 0.05));
      // Pin-1 chamfer dot
      ctx.fillStyle = '#8a8478';
      ctx.beginPath();
      ctx.arc(x + 5, y + 5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'southbridge': {
      // QFP — slightly lighter, larger highlight margin to let the leads breathe
      ctx.fillStyle = PALETTE.bodyMid;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PALETTE.bodyLight;
      const m = Math.min(w, h) * 0.12;
      ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
      // Pin-1 dot
      ctx.fillStyle = '#bababa';
      ctx.beginPath();
      ctx.arc(x + m + 2, y + m + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rom': {
      ctx.fillStyle = PALETTE.bodyMid;
      ctx.fillRect(x, y, w, h);
      // Pin-1 notch
      ctx.fillStyle = PALETTE.bodyDark;
      ctx.beginPath();
      ctx.arc(x + w / 2, y, w * 0.18, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'ram': {
      // DIMM socket — long black plastic with two end-caps and a centre slot
      ctx.fillStyle = '#0e0e10';
      ctx.fillRect(x, y, w, h);
      // End caps
      ctx.fillStyle = '#1c1c20';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);
      // Latch tabs at the ends
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(x + 1, y + h * 0.30, 2, h * 0.40);
      ctx.fillRect(x + w - 3, y + h * 0.30, 2, h * 0.40);
      break;
    }
    case 'pcie': {
      // Already painted slot background in gold; draw retention edges
      ctx.fillStyle = '#0e0e10';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y + h - 2, w, 2);
      // Stop-tab near the right end
      ctx.fillRect(x + w - 16, y + 2, 4, h - 4);
      break;
    }
    case 'cap-electro': {
      // Round can with a centre stamped cross
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2 - 1;
      ctx.fillStyle = PALETTE.electroRim;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.electroTop;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Stamped + cross
      ctx.strokeStyle = '#3a3d40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(cx, cy + r * 0.7);
      ctx.stroke();
      // Highlight arc
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, r - 2.5, -Math.PI * 0.9, -Math.PI * 0.45);
      ctx.stroke();
      break;
    }
    case 'cap-ceramic': {
      ctx.fillStyle = '#a9926f';
      ctx.fillRect(x, y, w, h);
      // Centre stripe (mass-printed dielectric edge)
      ctx.fillStyle = '#8d7855';
      ctx.fillRect(x + w * 0.30, y, w * 0.40, h);
      break;
    }
    case 'inductor': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2 - 0.5;
      // Toroid core
      ctx.fillStyle = PALETTE.inductorCore;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // Coil wraps — short tangential arcs
      ctx.strokeStyle = PALETTE.inductorWire;
      ctx.lineWidth = Math.max(1, r * 0.18);
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const ix = cx + Math.cos(a) * r;
        const iy = cy + Math.sin(a) * r;
        const ox = cx + Math.cos(a) * (r * 0.5);
        const oy = cy + Math.sin(a) * (r * 0.5);
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(ox, oy);
        ctx.stroke();
      }
      // Central post
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.30, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mosfet': {
      ctx.fillStyle = PALETTE.bodyMosfet;
      ctx.fillRect(x, y, w, h);
      // Marking line
      ctx.fillStyle = '#a3a097';
      ctx.fillRect(x + w * 0.15, y + h * 0.25, w * 0.7, 0.7);
      break;
    }
    case 'io-panel': {
      // Already drawn in drawIoContactStrip
      break;
    }
    case 'mount-hole': {
      // Drawn last; only the silver annulus here (drill comes in drawMountHole)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2 - 0.5;
      ctx.fillStyle = PALETTE.pad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawPinDetail(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  // For BGA we render the solder balls as visible dots peeking out from the
  // pad edges (mimics a side glimmer). QFP/SOIC leads are drawn as silver
  // tabs around the package perimeter.
  const ox = c.rect.x * scale;
  const oy = c.rect.y * scale;

  if (c.pkg.kind === 'bga') {
    for (const p of c.pkg.pins) {
      ctx.fillStyle = PALETTE.pad;
      ctx.beginPath();
      ctx.arc(ox + p.cx * scale, oy + p.cy * scale, Math.max(0.6, (p.r ?? 0.3) * scale * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (c.pkg.kind === 'qfp' || c.pkg.kind === 'soic') {
    for (const p of c.pkg.pins) {
      if (p.w === undefined || p.h === undefined) continue;
      ctx.fillStyle = PALETTE.pad;
      ctx.fillRect(
        ox + (p.cx - p.w / 2) * scale,
        oy + (p.cy - p.h / 2) * scale,
        p.w * scale,
        p.h * scale,
      );
      // Lead top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(
        ox + (p.cx - p.w / 2) * scale,
        oy + (p.cy - p.h / 2) * scale,
        Math.max(1, p.w * scale * 0.8),
        Math.max(0.6, p.h * scale * 0.18),
      );
    }
  }
  // DIMM / PCIe fingers already drawn in drawGoldFingerStrip
}

function drawTopLabel(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  if (!c.topLabel) return;
  const cx = (c.rect.x + c.rect.w / 2) * scale;
  const cy = (c.rect.y + c.rect.h / 2) * scale;
  let fontSize = Math.max(8, Math.min(c.rect.w, c.rect.h) * scale * 0.18);
  if (c.kind === 'pcie' || c.kind === 'ram') fontSize = Math.min(c.rect.h * scale * 0.55, 11);
  ctx.font = `600 ${fontSize}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.kind === 'pcie' || c.kind === 'ram' ? '#d0d0d0' : '#e8e2cf';
  ctx.fillText(c.topLabel, cx, cy);
  ctx.textAlign = 'start';
}

function drawMountHole(ctx: CanvasRenderingContext2D, c: Component, scale: number): void {
  const cx = (c.rect.x + c.rect.w / 2) * scale;
  const cy = (c.rect.y + c.rect.h / 2) * scale;
  const r = (Math.min(c.rect.w, c.rect.h) / 2 - 1.0) * scale;
  ctx.fillStyle = PALETTE.hole;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, r * 0.55), 0, Math.PI * 2);
  ctx.fill();
}

// Eliminate unused-import warning if PinFeature is only referenced via types.
export type _PinFeatureRef = PinFeature;
