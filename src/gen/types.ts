/**
 * Shared types for the generator pipeline.
 *
 * Coordinates are in **unit-grid** space (one unit = one routing track / one
 * placement-grid step). The renderer scales unit-grid coordinates to physical
 * canvas pixels. This decoupling is what makes the per-layer-direction routing
 * rule trivial to enforce — a wire on M1 moves only in +x, on M2 only in +y.
 */

export type BlockKind = 'sea' | 'sram' | 'analog' | 'pad';

/** Axis-aligned rectangle in unit-grid coordinates. Integer endpoints. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Block extends Rect {
  kind: BlockKind;
  /** Stable id, useful when debugging or doing diff-style regression. */
  id: number;
}

/** A standard-cell row inside a `sea` block. */
export interface Row {
  /** Block this row belongs to. */
  blockId: number;
  /** Row rectangle in unit-grid coords. */
  rect: Rect;
  /** Individual cell rectangles tiled along the row. */
  cells: Rect[];
}

/** A bitcell tile inside an `sram` macro. */
export interface SramTile {
  blockId: number;
  rect: Rect;
}

/** A pad on the perimeter pad ring. */
export interface Pad {
  rect: Rect;
}

/** Preferred routing direction. M1 horizontal, M2 vertical, alternating up. */
export type RoutingDir = 'h' | 'v';

/** A Manhattan-routed segment on a single metal layer. */
export interface Segment {
  layer: number; // 1 = M1, 2 = M2, …
  dir: RoutingDir;
  /** Start point in unit-grid coords. */
  x1: number;
  y1: number;
  /** End point in unit-grid coords. */
  x2: number;
  y2: number;
}

/** A via stamp at a layer transition or a bend. */
export interface Via {
  x: number;
  y: number;
  /** Lower of the two connected layers. */
  layer: number;
}

export interface RoutingResult {
  segments: Segment[];
  vias: Via[];
}

/** The complete typed scene produced by the generator. */
export interface Scene {
  /** Die size in unit-grid cells. */
  dieW: number;
  dieH: number;
  /** Outer pad ring blocks. */
  pads: Pad[];
  /** Seal ring rect (just inside the pad ring). */
  sealRing: Rect;
  /** Inner blocks: sea / sram / analog. */
  blocks: Block[];
  /** Std-cell rows inside sea blocks. */
  rows: Row[];
  /** SRAM bitcell tiles. */
  sramTiles: SramTile[];
  /** Routing layers. */
  routing: RoutingResult;
  /** Seed used to generate this scene, for the badge. */
  seed: string;
}
