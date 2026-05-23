/**
 * Routing layer generation.
 *
 * Pipeline stage 3: routing — the single most visually defining stage.
 *
 * The hard rule from the spec: each metal layer has a *preferred direction*.
 * M1 horizontal, M2 vertical, M3 horizontal, alternating up the stack. A wire
 * does NOT bend on its own layer — to turn you drop a *via* and continue on
 * the next layer in the orthogonal direction. Encoding this discipline is
 * what separates "looks like a circuit" from "looks like a maze screensaver."
 *
 * V1 ships one routing layer (M1, horizontal) plus opportunistic two-segment
 * L-paths that hop to M2 (vertical) to bend. The API accepts a `preferredDir`
 * argument so adding M3/M4 later is just calling the routine again. Via
 * stamps are emitted at every bend.
 */

import type { Rng } from '../rng.js';
import type { Block, Rect, RoutingDir, RoutingResult, Segment, Via } from './types.js';

export interface RoutingInput {
  /** Region in which to route. */
  region: Rect;
  /** Blocks to avoid placing segment endpoints inside (typically: sram macros). */
  obstacles: Block[];
  /** Number of nets to attempt. */
  netCount?: number;
  /** Track pitch in unit-grid cells. Segments snap to this. */
  trackPitch?: number;
  /** Min/max segment length in unit-grid cells. */
  minLen?: number;
  maxLen?: number;
}

/** Snap a value to a multiple of `pitch`. */
function snap(v: number, pitch: number): number {
  return Math.round(v / pitch) * pitch;
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function pointInAny(x: number, y: number, rects: Rect[]): boolean {
  for (const r of rects) if (pointInRect(x, y, r)) return true;
  return false;
}

/**
 * Emit a single L-shaped net from (sx,sy) → (ex,ey).
 * Lower-layer (M1) carries the horizontal leg, upper layer (M2) carries the
 * vertical leg. A via is stamped at the bend.
 */
function routeNet(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  baseLayer: number,
  baseDir: RoutingDir,
  rng: Rng
): { segs: Segment[]; vias: Via[] } {
  const segs: Segment[] = [];
  const vias: Via[] = [];

  // Decide which leg comes first based on baseDir. baseLayer routes along
  // its preferred direction; the orthogonal leg goes up one layer.
  const bendFirstAlongBaseDir = rng.chance();

  if (baseDir === 'h') {
    if (bendFirstAlongBaseDir) {
      // horizontal leg on baseLayer, then vertical leg on baseLayer+1
      if (sx !== ex) segs.push({ layer: baseLayer, dir: 'h', x1: sx, y1: sy, x2: ex, y2: sy });
      if (sy !== ey) segs.push({ layer: baseLayer + 1, dir: 'v', x1: ex, y1: sy, x2: ex, y2: ey });
      if (sx !== ex && sy !== ey) vias.push({ x: ex, y: sy, layer: baseLayer });
    } else {
      // vertical first on baseLayer+1, then horizontal on baseLayer
      if (sy !== ey) segs.push({ layer: baseLayer + 1, dir: 'v', x1: sx, y1: sy, x2: sx, y2: ey });
      if (sx !== ex) segs.push({ layer: baseLayer, dir: 'h', x1: sx, y1: ey, x2: ex, y2: ey });
      if (sx !== ex && sy !== ey) vias.push({ x: sx, y: ey, layer: baseLayer });
    }
  } else {
    if (bendFirstAlongBaseDir) {
      if (sy !== ey) segs.push({ layer: baseLayer, dir: 'v', x1: sx, y1: sy, x2: sx, y2: ey });
      if (sx !== ex) segs.push({ layer: baseLayer + 1, dir: 'h', x1: sx, y1: ey, x2: ex, y2: ey });
      if (sx !== ex && sy !== ey) vias.push({ x: sx, y: ey, layer: baseLayer });
    } else {
      if (sx !== ex) segs.push({ layer: baseLayer + 1, dir: 'h', x1: sx, y1: sy, x2: ex, y2: sy });
      if (sy !== ey) segs.push({ layer: baseLayer, dir: 'v', x1: ex, y1: sy, x2: ex, y2: ey });
      if (sx !== ex && sy !== ey) vias.push({ x: ex, y: sy, layer: baseLayer });
    }
  }

  return { segs, vias };
}

export function generateRouting(rng: Rng, input: RoutingInput): RoutingResult {
  const trackPitch = input.trackPitch ?? 2;
  const netCount = input.netCount ?? 280;
  const minLen = input.minLen ?? 6;
  const maxLen = input.maxLen ?? 60;

  // Exclude SRAM interiors as routing endpoint regions — routing channels
  // run around SRAM macros, not through them.
  const obstacles: Rect[] = input.obstacles
    .filter((b) => b.kind === 'sram')
    .map((b) => b);

  const segments: Segment[] = [];
  const vias: Via[] = [];

  const region = input.region;
  // Try several times per net to find non-overlapping endpoints.
  for (let n = 0; n < netCount; n++) {
    let placed = false;
    for (let attempt = 0; attempt < 6 && !placed; attempt++) {
      const sx = snap(rng.int(region.x, region.x + region.w), trackPitch);
      const sy = snap(rng.int(region.y, region.y + region.h), trackPitch);
      if (pointInAny(sx, sy, obstacles)) continue;

      // Random short hop in a random direction
      const dx = (rng.chance() ? 1 : -1) * snap(rng.int(minLen, maxLen), trackPitch);
      const dy = (rng.chance() ? 1 : -1) * snap(rng.int(minLen, maxLen), trackPitch);
      let ex = Math.max(region.x, Math.min(region.x + region.w, sx + dx));
      let ey = Math.max(region.y, Math.min(region.y + region.h, sy + dy));
      ex = snap(ex, trackPitch);
      ey = snap(ey, trackPitch);
      if (pointInAny(ex, ey, obstacles)) continue;

      // Sometimes emit a straight wire (no bend) — they're the majority on
      // a preferred-direction layer.
      if (rng.chance(0.45)) {
        // Force one axis to match start coords for a pure horizontal wire on M1
        if (rng.chance()) ey = sy; else ex = sx;
      }

      const { segs, vias: v } = routeNet(sx, sy, ex, ey, 1, 'h', rng);
      // Drop nets that collapsed to nothing
      if (segs.length === 0) continue;
      segments.push(...segs);
      vias.push(...v);
      placed = true;
    }
  }

  return { segments, vias };
}
