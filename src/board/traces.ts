/**
 * PCB trace routing.
 *
 * Strategy: don't try to be a real maze router. Emit traces that look right —
 *   - CPU↔RAM bus: parallel multi-trace bundle (one trace per RAM stripe) with
 *     a length-matching serpentine on at least one trace.
 *   - CPU↔Southbridge: a shorter parallel bundle, routed around the NB.
 *   - CPU↔NB: short hop (the memory-controller link).
 *   - Power & misc: a handful of extra traces between caps, VRM, and I/O so
 *     the board doesn't read as empty.
 *
 * Rules:
 *   - All segments are axis-aligned (Manhattan). Each Trace is a polyline whose
 *     points alternate (or repeat) along x/y only.
 *   - Traces never cross under component bodies. We route around obstacles by
 *     pulling traces into "channel" strips above/below or left/right of the
 *     occupied region.
 *   - Vias are emitted at every L-bend (visual flair — they're not actually
 *     required electrically, but real boards have a lot of them).
 */

import type { Rng } from '../rng.js';
import type { Component, Point, Trace, Via } from './types.js';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Build a list of inflated obstacle rectangles to route around. */
function obstacles(components: Component[], inflate = 0.6): Box[] {
  return components.map((c) => ({
    x: c.rect.x - inflate,
    y: c.rect.y - inflate,
    w: c.rect.w + 2 * inflate,
    h: c.rect.h + 2 * inflate,
  }));
}

function pointInBox(p: Point, b: Box): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function segmentHitsBox(a: Point, b: Point, obs: Box[], skip: Set<Box> = new Set()): boolean {
  // Treat as a thin segment; if axis-aligned, simple range check.
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  for (const o of obs) {
    if (skip.has(o)) continue;
    if (maxX < o.x || minX > o.x + o.w) continue;
    if (maxY < o.y || minY > o.y + o.h) continue;
    return true;
  }
  return false;
}

/** Route a Manhattan polyline from `from` to `to` skirting `obs`.
 *  Tries L-bend first, then Z-bend through an intermediate channel. */
function routeAround(
  from: Point,
  to: Point,
  obs: Box[],
  skipBoxes: Box[],
  rng: Rng,
): Point[] | null {
  const skip = new Set(skipBoxes);

  // 1. Try simple L (horizontal then vertical, then vice versa)
  const candidates: Point[][] = [
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  ];
  for (const path of candidates) {
    let ok = true;
    for (let i = 0; i < path.length - 1; i++) {
      if (segmentHitsBox(path[i]!, path[i + 1]!, obs, skip)) {
        ok = false;
        break;
      }
    }
    if (ok) return path;
  }

  // 2. Try Z-bend (3 segments with a midpoint stride). Sweep a few offsets.
  for (let stride = 6; stride <= 40; stride += 4) {
    const xMidOptions = [
      from.x + stride,
      from.x - stride,
      to.x + stride,
      to.x - stride,
      (from.x + to.x) / 2 + rng.range(-stride, stride),
    ];
    for (const xm of xMidOptions) {
      const path = [from, { x: xm, y: from.y }, { x: xm, y: to.y }, to];
      let ok = true;
      for (let i = 0; i < path.length - 1; i++) {
        if (segmentHitsBox(path[i]!, path[i + 1]!, obs, skip)) {
          ok = false; break;
        }
      }
      if (ok) return path;
    }
    const yMidOptions = [
      from.y + stride,
      from.y - stride,
      to.y + stride,
      to.y - stride,
    ];
    for (const ym of yMidOptions) {
      const path = [from, { x: from.x, y: ym }, { x: to.x, y: ym }, to];
      let ok = true;
      for (let i = 0; i < path.length - 1; i++) {
        if (segmentHitsBox(path[i]!, path[i + 1]!, obs, skip)) {
          ok = false; break;
        }
      }
      if (ok) return path;
    }
  }

  return null;
}

/** Insert a length-matching serpentine (3 zigzags) on the middle straight
 *  segment of a polyline. Returns a new polyline. */
function addSerpentine(path: Point[], amp = 2.5, zigs = 4): Point[] {
  if (path.length < 3) return path;
  // Pick the longest segment.
  let bestIdx = 0;
  let bestLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(a.x - b.x, a.y - b.y);
    if (len > bestLen) {
      bestLen = len;
      bestIdx = i;
    }
  }
  const a = path[bestIdx]!;
  const b = path[bestIdx + 1]!;
  if (bestLen < zigs * 3) return path;

  const horizontal = Math.abs(a.x - b.x) > Math.abs(a.y - b.y);
  const steps = zigs * 2;
  const stepLen = (horizontal ? b.x - a.x : b.y - a.y) / steps;
  const seg: Point[] = [a];
  for (let k = 1; k < steps; k++) {
    const sign = k % 2 === 1 ? 1 : -1;
    if (horizontal) {
      seg.push({ x: a.x + stepLen * k, y: a.y });
      seg.push({ x: a.x + stepLen * k, y: a.y + sign * amp });
      seg.push({ x: a.x + stepLen * (k + 0.5), y: a.y + sign * amp });
      seg.push({ x: a.x + stepLen * (k + 0.5), y: a.y });
      k += 0; // (cosmetic, k++ in for loop)
    } else {
      seg.push({ x: a.x, y: a.y + stepLen * k });
      seg.push({ x: a.x + sign * amp, y: a.y + stepLen * k });
      seg.push({ x: a.x + sign * amp, y: a.y + stepLen * (k + 0.5) });
      seg.push({ x: a.x, y: a.y + stepLen * (k + 0.5) });
    }
  }
  seg.push(b);
  return [...path.slice(0, bestIdx), ...seg, ...path.slice(bestIdx + 2)];
}

export interface TraceInput {
  components: Component[];
  pcbW: number;
  pcbH: number;
  rng: Rng;
}

export interface TraceResult {
  traces: Trace[];
  vias: Via[];
}

function edgeAnchor(c: Component, side: 'top' | 'bottom' | 'left' | 'right', t = 0.5): Point {
  switch (side) {
    case 'top':    return { x: c.rect.x + c.rect.w * t, y: c.rect.y };
    case 'bottom': return { x: c.rect.x + c.rect.w * t, y: c.rect.y + c.rect.h };
    case 'left':   return { x: c.rect.x,                y: c.rect.y + c.rect.h * t };
    case 'right':  return { x: c.rect.x + c.rect.w,     y: c.rect.y + c.rect.h * t };
  }
}

export function generateTraces(input: TraceInput): TraceResult {
  const { components, rng } = input;
  const traces: Trace[] = [];
  const vias: Via[] = [];

  const cpu = components.find((c) => c.kind === 'cpu');
  const rams = components.filter((c) => c.kind === 'ram');
  const nb = components.find((c) => c.kind === 'northbridge');
  const sb = components.find((c) => c.kind === 'southbridge');
  const pcies = components.filter((c) => c.kind === 'pcie');
  const electros = components.filter((c) => c.kind === 'cap-electro');
  const ind = components.filter((c) => c.kind === 'inductor');
  const ios = components.filter((c) => c.kind === 'io-panel');

  const obs = obstacles(components);

  function emitTrace(path: Point[], width: number, net: Trace['net']): void {
    if (path.length < 2) return;
    traces.push({ points: path, width, net });
    // Vias at every L-bend.
    for (let i = 1; i < path.length - 1; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const c = path[i + 1]!;
      const bendH = (a.y === b.y && b.x === c.x) || (a.x === b.x && b.y === c.y);
      if (bendH) vias.push({ cx: b.x, cy: b.y, r: 0.3 });
    }
  }

  // ---------- CPU ↔ RAM bus (parallel bundle, serpentine on one) ----------
  if (cpu && rams.length > 0) {
    const busRng = rng.fork(0xaa);
    // For each RAM slot, emit 2 parallel traces from CPU right edge.
    const tracesPerSlot = 3;
    rams.forEach((ram, slotIdx) => {
      for (let k = 0; k < tracesPerSlot; k++) {
        const t = 0.25 + (k / tracesPerSlot) * 0.5;
        const from = edgeAnchor(cpu, 'right', t + busRng.range(-0.04, 0.04));
        const to = { x: ram.rect.x, y: ram.rect.y + ram.rect.h * (0.2 + (k / tracesPerSlot) * 0.6) };
        const skipBoxes = obs.filter(
          (b) => pointInBox(from, b) || pointInBox(to, b)
        );
        const path = routeAround(from, to, obs, skipBoxes, busRng);
        if (path) {
          // Serpentine on the first trace of the first RAM slot.
          const finalPath = (slotIdx === 0 && k === 0)
            ? addSerpentine(path, 1.8, 5)
            : (k === 1 ? addSerpentine(path, 1.2, 3) : path);
          emitTrace(finalPath, 0.20, 'cpu-ram');
        }
      }
    });
  }

  // ---------- CPU ↔ Northbridge ----------
  if (cpu && nb) {
    const nbRng = rng.fork(0xbb);
    for (let k = 0; k < 4; k++) {
      const fromSide = nb.rect.y > cpu.rect.y + cpu.rect.h / 2 ? 'bottom' : 'top';
      const toSide = fromSide === 'bottom' ? 'top' : 'bottom';
      const from = edgeAnchor(cpu, fromSide, 0.4 + k * 0.05 + nbRng.range(-0.02, 0.02));
      const to = edgeAnchor(nb, toSide, 0.3 + k * 0.1);
      const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
      const path = routeAround(from, to, obs, skipBoxes, nbRng);
      if (path) emitTrace(path, 0.18, 'cpu-nb');
    }
  }

  // ---------- CPU ↔ Southbridge (longer, around NB) ----------
  if (cpu && sb) {
    const sbRng = rng.fork(0xcc);
    for (let k = 0; k < 4; k++) {
      const from = edgeAnchor(cpu, 'bottom', 0.6 + k * 0.05);
      const to = edgeAnchor(sb, 'top', 0.3 + k * 0.1);
      const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
      const path = routeAround(from, to, obs, skipBoxes, sbRng);
      if (path) emitTrace(path, 0.18, 'cpu-sb');
    }
  }

  // ---------- SB ↔ PCIe (short hops) ----------
  if (sb && pcies.length > 0) {
    const pRng = rng.fork(0xdd);
    pcies.forEach((p) => {
      for (let k = 0; k < 3; k++) {
        const from = edgeAnchor(sb, 'left', 0.3 + k * 0.15);
        const to = edgeAnchor(p, 'top', 0.4 + k * 0.1);
        const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
        const path = routeAround(from, to, obs, skipBoxes, pRng);
        if (path) emitTrace(path, 0.18, 'misc');
      }
    });
  }

  // ---------- Power: electrolytics ↔ CPU & VRM inductors ----------
  if (cpu && electros.length > 0) {
    const pwrRng = rng.fork(0xee);
    electros.forEach((cap, i) => {
      const from = edgeAnchor(cap, 'right', 0.5);
      const to = edgeAnchor(cpu, 'left', 0.2 + (i / Math.max(1, electros.length)) * 0.6);
      const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
      const path = routeAround(from, to, obs, skipBoxes, pwrRng);
      if (path) emitTrace(path, 0.35, 'power');
    });
  }
  if (cpu && ind.length > 0) {
    const indRng = rng.fork(0xef);
    ind.forEach((coil, i) => {
      const from = edgeAnchor(coil, 'bottom', 0.5);
      const to = edgeAnchor(cpu, 'top', 0.2 + (i / Math.max(1, ind.length)) * 0.6);
      const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
      const path = routeAround(from, to, obs, skipBoxes, indRng);
      if (path) emitTrace(path, 0.35, 'power');
    });
  }

  // ---------- I/O panel ↔ Southbridge (sprinkle) ----------
  if (sb && ios.length > 0) {
    const ioRng = rng.fork(0xf0);
    ios.forEach((io) => {
      for (let k = 0; k < 2; k++) {
        const from = edgeAnchor(io, 'bottom', 0.3 + k * 0.4);
        const to = edgeAnchor(sb, 'top', 0.5 + ioRng.range(-0.2, 0.2));
        const skipBoxes = obs.filter((b) => pointInBox(from, b) || pointInBox(to, b));
        const path = routeAround(from, to, obs, skipBoxes, ioRng);
        if (path) emitTrace(path, 0.18, 'misc');
      }
    });
  }

  return { traces, vias };
}
