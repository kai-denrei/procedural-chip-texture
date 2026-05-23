/**
 * Canvas2D renderer — pure consumer of the typed Scene + InterferenceField.
 *
 * Pipeline stage 4 (compositing): the geometry is drawn back-to-front
 * (substrate → blocks → cells/SRAM → power rails → routing → vias → pads),
 * then the interference tint is overlaid via a per-pixel multiply/screen
 * blend driven by the sampled film-thickness field.
 *
 * No randomness here — everything is deterministic from the upstream Scene.
 * No animation loop — a single `renderScene` call paints one frame.
 */

import type { InterferenceField } from '../gen/effects.js';
import { sampleField } from '../gen/effects.js';
import type { Scene } from '../gen/types.js';

export interface RenderOptions {
  /** Output canvas pixel size — internal render resolution. */
  pixelSize: number;
  /** Whether to apply the interference tint pass. */
  applyInterference?: boolean;
  /** Optional rail-direction debug overlay. */
  debug?: boolean;
}

interface Palette {
  substrate: string;
  sealRing: string;
  pad: string;
  padHighlight: string;
  blockSea: string;
  blockSram: string;
  blockAnalog: string;
  cell: string;
  cellEdge: string;
  vddRail: string;
  vssRail: string;
  sramCell: string;
  routingM1: string;
  routingM2: string;
  via: string;
}

const PALETTE: Palette = {
  substrate: '#0a0d11',
  sealRing: '#5a4a32',
  pad: '#c9a96a',
  padHighlight: '#e3c490',
  blockSea: '#1a2230',
  blockSram: '#1f1828',
  blockAnalog: '#22201a',
  cell: '#3a4a5e',
  cellEdge: '#1a2330',
  vddRail: '#b85a4a',
  vssRail: '#3a85a8',
  sramCell: '#6a4a78',
  routingM1: '#9ab8d6',
  routingM2: '#d8b86a',
  via: '#f0e2a0',
};

export function renderScene(
  canvas: HTMLCanvasElement,
  scene: Scene,
  interference: InterferenceField,
  opts: RenderOptions
): void {
  const px = opts.pixelSize;
  canvas.width = px;
  canvas.height = px;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas2D context unavailable');

  // Unit→pixel scale (chip is square; pad with letterboxing if not).
  const sx = px / scene.dieW;
  const sy = px / scene.dieH;
  const u = (n: number) => n * sx;
  const v = (n: number) => n * sy;

  // 1. Substrate
  ctx.fillStyle = PALETTE.substrate;
  ctx.fillRect(0, 0, px, px);

  // 2. Inner blocks — fills first so cells/routing land on top
  for (const b of scene.blocks) {
    ctx.fillStyle =
      b.kind === 'sram' ? PALETTE.blockSram : b.kind === 'analog' ? PALETTE.blockAnalog : PALETTE.blockSea;
    ctx.fillRect(u(b.x), v(b.y), u(b.w), v(b.h));
  }

  // 3. Seal ring (just inside the pad ring)
  ctx.strokeStyle = PALETTE.sealRing;
  ctx.lineWidth = Math.max(1, Math.min(sx, sy) * 1.5);
  ctx.strokeRect(u(scene.sealRing.x), v(scene.sealRing.y), u(scene.sealRing.w), v(scene.sealRing.h));

  // 4. SRAM bitcell texture — fine periodic grid. Render before std cells so
  //    SRAM blocks get a uniform finer texture distinct from the sea.
  ctx.fillStyle = PALETTE.sramCell;
  for (const t of scene.sramTiles) {
    // Draw small bitcell with a thin gap to maintain the periodic look.
    const w = Math.max(1, u(t.rect.w) - 0.5);
    const h = Math.max(1, v(t.rect.h) - 0.5);
    ctx.fillRect(u(t.rect.x), v(t.rect.y), w, h);
  }

  // 5. Standard-cell rows: rails + individual cells
  // Rails are drawn as horizontal strips along top + bottom of each row.
  for (const row of scene.rows) {
    const railH = Math.max(1, v(0.6));
    // Top rail = VDD (red-ish), bottom rail = VSS (blue-ish).
    ctx.fillStyle = PALETTE.vddRail;
    ctx.fillRect(u(row.rect.x), v(row.rect.y), u(row.rect.w), railH);
    ctx.fillStyle = PALETTE.vssRail;
    ctx.fillRect(u(row.rect.x), v(row.rect.y + row.rect.h) - railH, u(row.rect.w), railH);

    // Cells inside the row
    for (const c of row.cells) {
      ctx.fillStyle = PALETTE.cell;
      ctx.fillRect(u(c.x), v(c.y), u(c.w), v(c.h));
      ctx.strokeStyle = PALETTE.cellEdge;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(u(c.x) + 0.25, v(c.y) + 0.25, u(c.w) - 0.5, v(c.h) - 0.5);
    }
  }

  // 6. Routing — M1 horizontal, M2 vertical, alternating up. Lower layers
  //    are thinner and busier; upper layers are progressively thicker.
  ctx.lineCap = 'butt';
  for (const seg of scene.routing.segments) {
    const isOdd = seg.layer % 2 === 1; // M1, M3, … horizontal
    const baseWidth = 0.9 + (seg.layer - 1) * 0.6;
    ctx.lineWidth = Math.max(0.6, Math.min(sx, sy) * baseWidth * 0.7);
    ctx.strokeStyle = isOdd ? PALETTE.routingM1 : PALETTE.routingM2;
    ctx.beginPath();
    ctx.moveTo(u(seg.x1), v(seg.y1));
    ctx.lineTo(u(seg.x2), v(seg.y2));
    ctx.stroke();
  }

  // 7. Vias — small bright squares at every layer transition / bend
  ctx.fillStyle = PALETTE.via;
  for (const via of scene.routing.vias) {
    const viaSize = Math.max(1, Math.min(sx, sy) * 1.4);
    ctx.fillRect(u(via.x) - viaSize / 2, v(via.y) - viaSize / 2, viaSize, viaSize);
  }

  // 8. Pad ring — bright squares with a highlight rim around the perimeter
  for (const p of scene.pads) {
    ctx.fillStyle = PALETTE.pad;
    ctx.fillRect(u(p.rect.x), v(p.rect.y), u(p.rect.w), v(p.rect.h));
    ctx.strokeStyle = PALETTE.padHighlight;
    ctx.lineWidth = Math.max(0.5, Math.min(sx, sy) * 0.4);
    ctx.strokeRect(u(p.rect.x) + 0.5, v(p.rect.y) + 0.5, u(p.rect.w) - 1, v(p.rect.h) - 1);
  }

  // 9. Thin-film interference tint pass
  if (opts.applyInterference !== false) {
    applyInterferenceTint(ctx, px, interference);
  }

  if (opts.debug) drawDebugOverlay(ctx, px, scene);
}

/**
 * Per-pixel tint pass: read back the canvas, blend each pixel with the
 * bilinearly-sampled interference colour. Strength controls the mix.
 *
 * Implementation note: ImageData per-pixel is the slow path. For v1 it's
 * within budget on desktop and acceptable at 1024² on phones; v1.1 path is
 * to do this in a WebGL fragment shader. Recorded as an Open Question in
 * .deban/roles/arch.md.
 */
function applyInterferenceTint(
  ctx: CanvasRenderingContext2D,
  px: number,
  field: InterferenceField
): void {
  const img = ctx.getImageData(0, 0, px, px);
  const data = img.data;
  const s = field.strength;
  const invS = 1 - s;
  // Sample the field once per ~4px to stay fast — bilinear interp masks the
  // coarseness. Use a quick lookup grid that's the same size as the canvas
  // but indexed cheaply.
  for (let y = 0; y < px; y++) {
    const v = y / (px - 1);
    for (let x = 0; x < px; x++) {
      const u = x / (px - 1);
      const [tr, tg, tb] = sampleField(field, u, v);
      const idx = (y * px + x) * 4;
      // Screen-blend the tint over the base: base + tint*(1-base)
      // Modulated by strength. Keeps darks dark, lightens midtones with hue.
      const r = data[idx]! / 255;
      const g = data[idx + 1]! / 255;
      const b = data[idx + 2]! / 255;
      const sr = r + tr * (1 - r);
      const sg = g + tg * (1 - g);
      const sb = b + tb * (1 - b);
      data[idx] = Math.min(255, Math.max(0, (invS * r + s * sr) * 255));
      data[idx + 1] = Math.min(255, Math.max(0, (invS * g + s * sg) * 255));
      data[idx + 2] = Math.min(255, Math.max(0, (invS * b + s * sb) * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, px: number, scene: Scene): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(
    `${scene.dieW}×${scene.dieH} u  blocks=${scene.blocks.length}  rows=${scene.rows.length}  segs=${scene.routing.segments.length}  vias=${scene.routing.vias.length}`,
    8,
    14
  );
  ctx.fillText(`seed=${scene.seed}  px=${px}`, 8, 28);
  ctx.restore();
}
