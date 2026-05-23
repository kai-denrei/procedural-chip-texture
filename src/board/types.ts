/**
 * Motherboard scene types.
 *
 * Coordinate space: PCB millimetres (logical). The renderer maps mm → canvas
 * pixels at a fixed scale (PX_PER_MM). Using physical-ish units makes pad
 * pitches, trace widths, and BGA balls compose at sane sizes by inspection.
 *
 * Conventions:
 *  - All component positions are stored as bounding-box rectangles (x, y, w, h)
 *    in mm, with the package body centred on (x + w/2, y + h/2).
 *  - Pin/ball/finger geometry lives inside the package, computed once at
 *    layout time and stored on the Component so the renderer is purely
 *    geometry-driven (no procedural surprises in render.ts).
 *  - All randomness descends from the shared seeded PRNG — no Math.random
 *    anywhere under src/board/.
 */

/** Axis-aligned PCB-space rectangle in millimetres. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A 2D point in PCB millimetres. */
export interface Point {
  x: number;
  y: number;
}

/** Package style — drives pin/ball geometry and silkscreen prefix. */
export type PackageKind =
  | 'bga'        // Ball Grid Array, square/rect, ball grid underneath
  | 'qfp'        // Quad Flat Pack, leads on all four sides
  | 'soic'       // Small Outline IC, leads on two sides
  | 'dimm'       // RAM socket with gold edge fingers inside a slot opening
  | 'pcie'       // PCIe edge slot with ENIG gold fingers
  | 'electro'    // electrolytic capacitor (round + top cross)
  | 'ceramic'    // ceramic SMD block
  | 'inductor'   // VRM toroid (round + central post)
  | 'mosfet'     // SOT-style MOSFET
  | 'io';        // I/O panel cut-out

/** Top-level functional role — determines layout zone & label prefix. */
export type ComponentKind =
  | 'cpu'
  | 'northbridge'
  | 'southbridge'
  | 'ram'
  | 'rom'
  | 'cap-electro'
  | 'cap-ceramic'
  | 'pcie'
  | 'inductor'
  | 'mosfet'
  | 'io-panel'
  | 'mount-hole';

/** Layout zone an instance was placed into. */
export type Zone =
  | 'CPU'
  | 'NB'
  | 'SB'
  | 'RAM'
  | 'ROM'
  | 'VRM'
  | 'PCIE'
  | 'IO'
  | 'CORNER'
  | 'FREE';

/** A single ball / lead / finger in package space (mm, relative to component). */
export interface PinFeature {
  /** Centre relative to component bounding box origin. */
  cx: number;
  cy: number;
  /** Footprint radius (balls / round pads) — use undefined for rectangular leads. */
  r?: number;
  /** Rectangular lead dimensions (mm). */
  w?: number;
  h?: number;
}

export interface PackageGeometry {
  kind: PackageKind;
  /** Solder-pad/ball/finger footprints under or around the package body. */
  pins: PinFeature[];
  /** Optional pin-1 marker (notch / dot) in component-local coords. */
  pin1?: Point;
}

export interface Component {
  /** Stable id (e.g. "U1", "C44") — assigned by silkscreen. May be empty pre-label. */
  id: string;
  kind: ComponentKind;
  zone: Zone;
  /** Bounding box in PCB mm. */
  rect: Rect;
  /** Package geometry (pins/leads/fingers) baked at layout time. */
  pkg: PackageGeometry;
  /** Optional label text shown on top of the package body (e.g. "CPU", "MCH"). */
  topLabel?: string;
  /** Rotation in degrees — 0 unless the part is naturally rotated (DIMMs). */
  rot?: 0 | 90 | 180 | 270;
}

/** A single PCB copper trace. Manhattan: points alternate axis-aligned. */
export interface Trace {
  /** Polyline points in PCB mm. Length >= 2. Each successive pair is axis-aligned. */
  points: Point[];
  /** Trace width in mm. */
  width: number;
  /** Bus the trace belongs to — useful for colouring or filtering in QA. */
  net?: 'cpu-ram' | 'cpu-sb' | 'cpu-nb' | 'power' | 'misc';
}

/** A via dot painted at a corner / layer transition. */
export interface Via {
  cx: number;
  cy: number;
  r: number;
}

/** Auto-generated silkscreen label near a component. */
export interface Label {
  text: string;
  /** Position in PCB mm — top-left of the text box. */
  x: number;
  y: number;
  /** Font size in mm (rendered ≈ 1.6mm). */
  size: number;
}

/** The complete typed motherboard scene. */
export interface BoardScene {
  /** PCB dimensions in mm. */
  pcbW: number;
  pcbH: number;
  /** All placed components (incl. mounting holes & I/O cutouts). */
  components: Component[];
  /** PCB copper traces. */
  traces: Trace[];
  /** Via dots. */
  vias: Via[];
  /** Silkscreen labels. */
  labels: Label[];
  /** Seed used to build the scene. */
  seed: string;
}
