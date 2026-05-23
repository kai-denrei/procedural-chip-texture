/**
 * Standard-cell row + SRAM bitcell generation.
 *
 * Pipeline stage 2 (continuation of "clean geometry on a grid"):
 *  - Fill each `sea` block with horizontal rows of fixed pitch.
 *  - Each row has VDD/VSS power rails along its top and bottom edges
 *    (rendered later — here we only emit the row geometry and the cells).
 *  - Each row is populated with quantized-width cells snapped to the
 *    placement-grid pitch — this is what produces the horizontal banding
 *    that reads as "logic" at a glance.
 *  - SRAM blocks are tiled with a much smaller bitcell motif at a fine,
 *    regular pitch — the textural contrast with the cell sea is the
 *    single biggest "this is memory" cue.
 */

import type { Rng } from '../rng.js';
import type { Block, Rect, Row, SramTile } from './types.js';

export interface CellsInput {
  blocks: Block[];
  /** Std-cell row height in unit-grid cells. */
  rowHeight?: number;
  /** Min cell width (in placement-grid units). */
  minCellW?: number;
  /** Max cell width. */
  maxCellW?: number;
  /** Placement grid pitch — cell widths are multiples of this. */
  placementPitch?: number;
  /** Inner margin inside sea blocks (channels). */
  seaPad?: number;
  /** SRAM bitcell side length (square). */
  sramCellSize?: number;
  /** SRAM internal padding (gives an interior border). */
  sramPad?: number;
}

export interface CellsResult {
  rows: Row[];
  sramTiles: SramTile[];
}

export function generateCells(rng: Rng, input: CellsInput): CellsResult {
  const opts = {
    rowHeight: input.rowHeight ?? 4,
    minCellW: input.minCellW ?? 2,
    maxCellW: input.maxCellW ?? 12,
    placementPitch: input.placementPitch ?? 2,
    seaPad: input.seaPad ?? 2,
    sramCellSize: input.sramCellSize ?? 2,
    sramPad: input.sramPad ?? 2,
  };

  const rows: Row[] = [];
  const sramTiles: SramTile[] = [];

  for (const block of input.blocks) {
    if (block.kind === 'sea') {
      const rng2 = rng.fork(block.id * 0x9e37 + 1);
      const innerX = block.x + opts.seaPad;
      const innerY = block.y + opts.seaPad;
      const innerW = block.w - 2 * opts.seaPad;
      const innerH = block.h - 2 * opts.seaPad;
      if (innerW < opts.minCellW || innerH < opts.rowHeight) continue;

      const rowCount = Math.floor(innerH / opts.rowHeight);
      for (let r = 0; r < rowCount; r++) {
        const ry = innerY + r * opts.rowHeight;
        const rowRect: Rect = { x: innerX, y: ry, w: innerW, h: opts.rowHeight };
        const cells: Rect[] = [];

        // Walk the row left-to-right packing quantized-width cells. Leave a
        // small random gap occasionally — real layouts have placement gaps.
        let cx = innerX;
        const xEnd = innerX + innerW;
        // Cell body sits slightly inside row (top + bottom strips reserved for rails)
        const cellY = ry + 1;
        const cellH = opts.rowHeight - 2;
        if (cellH < 1) continue;

        while (cx < xEnd) {
          // 8% chance of a gap (placement skipped)
          if (rng2.chance(0.08)) {
            cx += opts.placementPitch * rng2.int(1, 2);
            continue;
          }
          const widthQ = rng2.int(
            Math.max(1, Math.floor(opts.minCellW / opts.placementPitch)),
            Math.max(1, Math.floor(opts.maxCellW / opts.placementPitch))
          );
          const w = widthQ * opts.placementPitch;
          if (cx + w > xEnd) break;
          cells.push({ x: cx, y: cellY, w, h: cellH });
          cx += w;
        }

        rows.push({ blockId: block.id, rect: rowRect, cells });
      }
    } else if (block.kind === 'sram') {
      // Tile a fine, regular bitcell motif. SRAM bitcells are arranged in a
      // strict grid — that uniform periodic texture is the visual signature.
      const innerX = block.x + opts.sramPad;
      const innerY = block.y + opts.sramPad;
      const innerW = block.w - 2 * opts.sramPad;
      const innerH = block.h - 2 * opts.sramPad;
      if (innerW < opts.sramCellSize || innerH < opts.sramCellSize) continue;

      // Bitcell columns and rows
      const colCount = Math.floor(innerW / opts.sramCellSize);
      const rowCount = Math.floor(innerH / opts.sramCellSize);
      for (let cy = 0; cy < rowCount; cy++) {
        for (let cx2 = 0; cx2 < colCount; cx2++) {
          sramTiles.push({
            blockId: block.id,
            rect: {
              x: innerX + cx2 * opts.sramCellSize,
              y: innerY + cy * opts.sramCellSize,
              w: opts.sramCellSize,
              h: opts.sramCellSize,
            },
          });
        }
      }
    }
    // analog: leave as a hollow custom-shape block, rendered as a faint block
  }

  return { rows, sramTiles };
}
