/**
 * Silkscreen labels.
 *
 * Iterates placed components and assigns:
 *   - U-prefix to ICs (CPU, NB, SB, ROM)
 *   - C-prefix to capacitors (electrolytic + ceramic SMD)
 *   - J-prefix to connectors (RAM slots, PCIe slots, I/O panel)
 *   - L-prefix to inductors
 *   - Q-prefix to MOSFETs
 *
 * Label placement: try a short list of candidate positions around the
 * component (above, below, left, right) and pick the first one whose
 * bounding box doesn't overlap any other component or already-placed label.
 * If nothing fits we skip the label — better no label than a colliding one.
 */

import type { Component, Label } from './types.js';

interface Box { x: number; y: number; w: number; h: number; }

const PREFIX: Record<Component['kind'], string | null> = {
  cpu: 'U',
  northbridge: 'U',
  southbridge: 'U',
  rom: 'U',
  ram: 'J',
  pcie: 'J',
  'io-panel': 'J',
  'cap-electro': 'C',
  'cap-ceramic': 'C',
  inductor: 'L',
  mosfet: 'Q',
  'mount-hole': null,
};

function intersects(a: Box, b: Box, pad = 0.2): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function fits(box: Box, occupied: Box[], pad = 0.2): boolean {
  for (const o of occupied) if (intersects(box, o, pad)) return false;
  return true;
}

export function assignLabels(components: Component[]): {
  components: Component[];
  labels: Label[];
} {
  // 1. Assign incrementing IDs per prefix.
  const counters: Record<string, number> = {};
  const labeled = components.map((c) => {
    const p = PREFIX[c.kind];
    if (!p) return c;
    counters[p] = (counters[p] ?? 0) + 1;
    return { ...c, id: `${p}${counters[p]}` };
  });

  // 2. Place silkscreen labels around each labeled component.
  const labels: Label[] = [];
  const componentBoxes: Box[] = components.map((c) => c.rect);
  const labelBoxes: Box[] = [];

  for (const c of labeled) {
    if (!c.id) continue;

    // Big ICs (CPU/NB/SB/ROM) print their label INSIDE the package top
    // (that's the topLabel rendered already) and skip the U-prefix silkscreen
    // to keep things readable. Other components (caps, inductors, RAM slots)
    // get an external silkscreen ref.
    if (c.kind === 'cpu' || c.kind === 'northbridge' || c.kind === 'southbridge') {
      continue;
    }

    const text = c.id;
    // Heuristic: label width ≈ chars * 0.7 * size mm, height ≈ size mm.
    const size = c.kind === 'cap-ceramic' || c.kind === 'mosfet' ? 1.1 : 1.6;
    const tw = text.length * size * 0.7;
    const th = size;

    // Candidate positions around the component:
    const candidates: Box[] = [
      { x: c.rect.x, y: c.rect.y - th - 0.4, w: tw, h: th },                                 // above
      { x: c.rect.x, y: c.rect.y + c.rect.h + 0.4, w: tw, h: th },                            // below
      { x: c.rect.x + c.rect.w + 0.4, y: c.rect.y, w: tw, h: th },                            // right
      { x: c.rect.x - tw - 0.4, y: c.rect.y, w: tw, h: th },                                  // left
      { x: c.rect.x + c.rect.w / 2 - tw / 2, y: c.rect.y - th - 0.4, w: tw, h: th },          // above-centred
      { x: c.rect.x + c.rect.w / 2 - tw / 2, y: c.rect.y + c.rect.h + 0.4, w: tw, h: th },    // below-centred
    ];

    for (const cand of candidates) {
      // Don't run off the PCB
      if (cand.x < 0 || cand.y < 0) continue;
      if (fits(cand, componentBoxes, 0.1) && fits(cand, labelBoxes, 0.3)) {
        labels.push({ text, x: cand.x, y: cand.y, size });
        labelBoxes.push(cand);
        break;
      }
    }
  }

  return { components: labeled, labels };
}
