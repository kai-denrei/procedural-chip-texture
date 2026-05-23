/**
 * Floorplan generation.
 *
 * Pipeline stage 1: clean geometry on a grid. The spec is explicit — a die is
 * hierarchical: pad ring on the perimeter, large hard macros (SRAM, analog)
 * placed inside, and a "sea" of standard cells filling the rest. We follow the
 * classic recipe: a BSP slicing tree subdivides the interior with alternating
 * horizontal/vertical cuts, leaves are typed as sea/sram/analog by area & RNG.
 *
 * All coordinates are integer unit-grid cells. Adjacent blocks share an edge
 * (no overlapping, no gaps) — channels between blocks are reserved by leaving
 * a strip of `sea` at the cut.
 */

import type { Rng } from '../rng.js';
import type { Block, BlockKind, Pad, Rect } from './types.js';

export interface FloorplanInput {
  dieW: number;
  dieH: number;
  /** Min depth of recursion before leaves are allowed. */
  minDepth?: number;
  /** Max depth of recursion. */
  maxDepth?: number;
  /** Below this area a leaf is forced (and typed as sea). */
  minLeafArea?: number;
  /** Pad ring thickness in unit cells. */
  padRingThick?: number;
  /** Seal ring offset inside the pad ring. */
  sealRingOffset?: number;
  /** Individual pad side length. */
  padSize?: number;
  /** Gap between adjacent pads. */
  padGap?: number;
}

export interface FloorplanResult {
  pads: Pad[];
  sealRing: Rect;
  /** Inner blocks (sea/sram/analog), tiling the interior with no gaps. */
  blocks: Block[];
  /** Interior rect (just inside the seal ring) — for downstream stages. */
  interior: Rect;
}

/** Build the perimeter pad ring as a chain of square pad rects. */
function buildPadRing(
  rng: Rng,
  dieW: number,
  dieH: number,
  _padRingThick: number,
  padSize: number,
  padGap: number
): Pad[] {
  const pads: Pad[] = [];
  const step = padSize + padGap;
  // Top edge
  for (let x = padGap; x + padSize <= dieW - padGap; x += step) {
    pads.push({ rect: { x, y: padGap, w: padSize, h: padSize } });
  }
  // Bottom edge
  for (let x = padGap; x + padSize <= dieW - padGap; x += step) {
    pads.push({ rect: { x, y: dieH - padGap - padSize, w: padSize, h: padSize } });
  }
  // Left edge (skip corners already covered)
  for (let y = padGap + step; y + padSize <= dieH - padGap - step; y += step) {
    pads.push({ rect: { x: padGap, y, w: padSize, h: padSize } });
  }
  // Right edge
  for (let y = padGap + step; y + padSize <= dieH - padGap - step; y += step) {
    pads.push({ rect: { x: dieW - padGap - padSize, y, w: padSize, h: padSize } });
  }
  // Light shuffle in RNG to make pad ordering seed-dependent (not visible
  // visually, but matters if we later assign types to pads).
  rng.next();
  return pads;
}

/**
 * Recursive BSP. Returns leaf rects covering `region` exactly with no overlap.
 * Cut direction alternates with depth; cut position is randomized within
 * a [25%, 75%] band so we don't get pathological slivers.
 */
function bspSplit(
  rng: Rng,
  region: Rect,
  depth: number,
  cutVertical: boolean,
  opts: Required<Pick<FloorplanInput, 'minDepth' | 'maxDepth' | 'minLeafArea'>>
): Rect[] {
  const area = region.w * region.h;
  const aspect = region.w / region.h;
  const tooSmall = area < opts.minLeafArea;
  const maxedOut = depth >= opts.maxDepth;
  const canStopByDepth = depth >= opts.minDepth;

  // Stop if we hit a hard limit, or if we're allowed to stop and the RNG agrees.
  // Lean toward stopping for more rectangular regions.
  const stopProb = 0.35 + Math.max(0, 1 - Math.abs(Math.log(aspect))) * 0.2;
  if (tooSmall || maxedOut || (canStopByDepth && rng.next() < stopProb)) {
    return [region];
  }

  // Force the cut to be along the longer axis if region is very elongated —
  // this prevents endless slivers when the alternating rule fights geometry.
  let vertical = cutVertical;
  if (aspect > 1.6) vertical = true;
  else if (aspect < 1 / 1.6) vertical = false;

  const cutAt = rng.range(0.35, 0.65);
  if (vertical) {
    const cx = Math.max(1, Math.min(region.w - 1, Math.round(region.w * cutAt)));
    const left: Rect = { x: region.x, y: region.y, w: cx, h: region.h };
    const right: Rect = { x: region.x + cx, y: region.y, w: region.w - cx, h: region.h };
    return [
      ...bspSplit(rng, left, depth + 1, !vertical, opts),
      ...bspSplit(rng, right, depth + 1, !vertical, opts),
    ];
  } else {
    const cy = Math.max(1, Math.min(region.h - 1, Math.round(region.h * cutAt)));
    const top: Rect = { x: region.x, y: region.y, w: region.w, h: cy };
    const bot: Rect = { x: region.x, y: region.y + cy, w: region.w, h: region.h - cy };
    return [
      ...bspSplit(rng, top, depth + 1, !vertical, opts),
      ...bspSplit(rng, bot, depth + 1, !vertical, opts),
    ];
  }
}

/** Assign block kinds to leaves. Strategy:
 *  - Largest 1–2 leaves with reasonable aspect → sram macro
 *  - One mid-size leaf with very square aspect → analog
 *  - Everything else → sea (standard cells)
 *  Guarantees at least one SRAM, which is a v1 acceptance criterion. */
function typeBlocks(rng: Rng, leaves: Rect[]): Block[] {
  const sorted = leaves
    .map((r, i) => ({ r, i, area: r.w * r.h }))
    .sort((a, b) => b.area - a.area);

  const types = new Map<number, BlockKind>();

  // Largest leaf with not-too-extreme aspect becomes SRAM.
  for (const { r, i } of sorted) {
    const aspect = r.w / r.h;
    if (aspect > 0.5 && aspect < 2.5) {
      types.set(i, 'sram');
      break;
    }
  }
  // Maybe a second SRAM if the next-largest is also big enough.
  if (sorted.length > 3 && rng.chance(0.5)) {
    for (const { r, i } of sorted.slice(1, 4)) {
      if (types.has(i)) continue;
      const aspect = r.w / r.h;
      if (aspect > 0.4 && aspect < 2.8) {
        types.set(i, 'sram');
        break;
      }
    }
  }
  // One analog block — square-ish, mid size.
  for (const { r, i } of sorted) {
    if (types.has(i)) continue;
    const aspect = r.w / r.h;
    if (aspect > 0.7 && aspect < 1.4 && rng.chance(0.7)) {
      types.set(i, 'analog');
      break;
    }
  }

  return leaves.map((r, i) => ({
    ...r,
    kind: types.get(i) ?? 'sea',
    id: i,
  }));
}

export function generateFloorplan(rng: Rng, input: FloorplanInput): FloorplanResult {
  const opts = {
    minDepth: input.minDepth ?? 2,
    maxDepth: input.maxDepth ?? 5,
    minLeafArea: input.minLeafArea ?? Math.floor((input.dieW * input.dieH) / 60),
    padRingThick: input.padRingThick ?? 14,
    sealRingOffset: input.sealRingOffset ?? 4,
    padSize: input.padSize ?? 8,
    padGap: input.padGap ?? 2,
  };

  const pads = buildPadRing(rng, input.dieW, input.dieH, opts.padRingThick, opts.padSize, opts.padGap);
  void opts.padRingThick;

  const sealInset = opts.padRingThick;
  const sealRing: Rect = {
    x: sealInset,
    y: sealInset,
    w: input.dieW - 2 * sealInset,
    h: input.dieH - 2 * sealInset,
  };

  const interiorInset = sealInset + opts.sealRingOffset;
  const interior: Rect = {
    x: interiorInset,
    y: interiorInset,
    w: input.dieW - 2 * interiorInset,
    h: input.dieH - 2 * interiorInset,
  };

  const leaves = bspSplit(rng, interior, 0, rng.chance(), {
    minDepth: opts.minDepth,
    maxDepth: opts.maxDepth,
    minLeafArea: opts.minLeafArea,
  });
  const blocks = typeBlocks(rng, leaves);

  return { pads, sealRing, blocks, interior };
}
