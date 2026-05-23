/**
 * Anchored-preset layout.
 *
 * Real motherboards have conventional anchor zones — CPU upper-centre, RAM to
 * the right of CPU, VRM around CPU, southbridge lower-right, PCIe lower-left,
 * I/O along the top edge, mounting holes at the corners. We use a zone preset
 * here and apply seeded variation to:
 *   - exact zone rectangles (small jitter on dimensions and origins)
 *   - exact component sizes within a zone
 *   - component counts (2–4 RAM slots, 1–2 PCIe slots, cap & MOSFET counts)
 *   - top labels (CPU model names, MCH/ICH variants)
 *
 * Layout never decides which-zone-holds-what; that's the whole point of the
 * preset approach. Variation lives inside the zones.
 *
 * Critical guarantees:
 *   - No bounding-box overlaps between any two components (post-pad inflation).
 *   - All components fit inside the PCB rect minus a board margin.
 */

import type { Rng } from '../rng.js';
import type { Component } from './types.js';
import {
  makeCpu,
  makeNorthbridge,
  makeSouthbridge,
  makeRam,
  makeRom,
  makeElectro,
  makeCeramic,
  makePcie,
  makeInductor,
  makeMosfet,
  makeIo,
  makeMountHole,
} from './components.js';

const CPU_LABELS = ['CPU', 'CORE i7', 'CORE i9', 'RYZEN', 'XEON', 'EPYC'];
const NB_LABELS = ['MCH', 'NB', 'PCH-N'];
const SB_LABELS = ['ICH', 'SB', 'PCH-S'];

export interface LayoutInput {
  /** PCB dimensions in mm. */
  pcbW: number;
  pcbH: number;
  /** PRNG bound to the scene seed (forked into sub-streams here). */
  rng: Rng;
}

export interface LayoutResult {
  components: Component[];
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function intersects(a: Box, b: Box, pad = 1.2): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function fits(box: Box, placed: Box[], pad = 1.2): boolean {
  for (const p of placed) if (intersects(box, p, pad)) return false;
  return true;
}

/** Place a component if it fits; bail out on first conflict (caller retries). */
function tryPlace(out: Component[], placed: Box[], c: Component, pad = 1.2): boolean {
  if (!fits(c.rect, placed, pad)) return false;
  out.push(c);
  placed.push(c.rect);
  return true;
}

export function generateLayout(input: LayoutInput): LayoutResult {
  const { pcbW, pcbH, rng } = input;
  const out: Component[] = [];
  const placed: Box[] = [];

  // Reserve the board margin (no components touch the edge).
  const margin = 6;
  const topMargin = 12; // I/O panel needs the top strip
  const board: Box = {
    x: margin,
    y: topMargin,
    w: pcbW - 2 * margin,
    h: pcbH - margin - topMargin,
  };

  // ---------- 1. Mounting holes (corners) ----------
  const holeR = 2.4;
  const holeSize = holeR * 2 + 1.5;
  const holeOff = margin - 0.5;
  const holes = [
    [holeOff, holeOff],
    [pcbW - holeOff - holeSize, holeOff],
    [holeOff, pcbH - holeOff - holeSize],
    [pcbW - holeOff - holeSize, pcbH - holeOff - holeSize],
  ];
  for (const [x, y] of holes) {
    out.push(
      makeMountHole({
        kind: 'mount-hole', zone: 'CORNER',
        x: x!, y: y!, w: holeSize, h: holeSize, rng,
      })
    );
    placed.push({ x: x!, y: y!, w: holeSize, h: holeSize });
  }

  // ---------- 2. I/O panel along the top edge ----------
  // 3–5 cut-outs of varying widths sitting flush against the top margin.
  const ioRng = rng.fork(0x10);
  const ioCount = ioRng.int(3, 5);
  const ioStripX = board.x + 4;
  const ioStripW = board.w - 8;
  const ioH = 9;
  const ioY = margin + 1;
  let cursor = ioStripX;
  for (let i = 0; i < ioCount; i++) {
    const remaining = ioStripX + ioStripW - cursor;
    if (remaining < 14) break;
    const w = Math.min(remaining - 4, ioRng.range(14, Math.min(34, remaining)));
    const c = makeIo({
      kind: 'io-panel', zone: 'IO',
      x: cursor, y: ioY, w, h: ioH, rng: ioRng,
    });
    tryPlace(out, placed, c, 0.6);
    cursor += w + ioRng.range(2.5, 5.0);
  }

  // ---------- 3. CPU — upper-centre ----------
  const cpuRng = rng.fork(0x20);
  const cpuW = cpuRng.range(46, 56);
  const cpuH = cpuRng.range(46, 56);
  const cpuX = (pcbW - cpuW) / 2 - cpuRng.range(-6, 14); // shift slightly left for RAM space
  const cpuY = topMargin + 12 + cpuRng.range(0, 6);
  out.push(
    makeCpu({
      kind: 'cpu', zone: 'CPU',
      x: cpuX, y: cpuY, w: cpuW, h: cpuH, rng: cpuRng,
      topLabel: CPU_LABELS[cpuRng.int(0, CPU_LABELS.length - 1)]!,
    })
  );
  placed.push({ x: cpuX, y: cpuY, w: cpuW, h: cpuH });
  const cpuCenter = { x: cpuX + cpuW / 2, y: cpuY + cpuH / 2 };

  // ---------- 4. RAM slots — to the right of CPU ----------
  const ramRng = rng.fork(0x30);
  const ramCount = ramRng.int(2, 4);
  const ramW = 8;
  const ramH = Math.min(78, board.h - 30);
  const ramTopY = topMargin + 18 + ramRng.range(0, 4);
  let ramX = cpuX + cpuW + 14 + ramRng.range(0, 4);
  for (let i = 0; i < ramCount; i++) {
    if (ramX + ramW > board.x + board.w - 4) break;
    const c = makeRam({
      kind: 'ram', zone: 'RAM',
      x: ramX, y: ramTopY, w: ramW, h: ramH, rng: ramRng,
    });
    if (!tryPlace(out, placed, c, 0.8)) break;
    ramX += ramW + 3.2;
  }

  // ---------- 5. Northbridge — between CPU and RAM (or just below CPU) ----------
  const nbRng = rng.fork(0x40);
  const nbW = nbRng.range(22, 28);
  const nbH = nbRng.range(22, 28);
  // Sit it below the CPU, biased toward RAM side
  let nbX = cpuX + cpuW * 0.4 + nbRng.range(0, 6);
  let nbY = cpuY + cpuH + 10 + nbRng.range(0, 4);
  // Walk it right if it conflicts (RAM column may block)
  for (let tries = 0; tries < 8; tries++) {
    const box = { x: nbX, y: nbY, w: nbW, h: nbH };
    if (fits(box, placed, 1.5) && box.x + box.w < board.x + board.w - 6) {
      out.push(makeNorthbridge({
        kind: 'northbridge', zone: 'NB',
        x: nbX, y: nbY, w: nbW, h: nbH, rng: nbRng,
        topLabel: NB_LABELS[nbRng.int(0, NB_LABELS.length - 1)]!,
      }));
      placed.push(box);
      break;
    }
    nbY += 4;
    if (nbY + nbH > board.y + board.h - 30) { nbY = cpuY + cpuH + 10; nbX += 4; }
  }

  // ---------- 6. Southbridge — lower-right ----------
  const sbRng = rng.fork(0x50);
  const sbW = sbRng.range(20, 26);
  const sbH = sbRng.range(20, 26);
  let sbX = board.x + board.w - sbW - 18 + sbRng.range(-4, 0);
  let sbY = board.y + board.h - sbH - 22 + sbRng.range(-4, 0);
  for (let tries = 0; tries < 8; tries++) {
    const box = { x: sbX, y: sbY, w: sbW, h: sbH };
    if (fits(box, placed, 1.5)) {
      out.push(makeSouthbridge({
        kind: 'southbridge', zone: 'SB',
        x: sbX, y: sbY, w: sbW, h: sbH, rng: sbRng,
        topLabel: SB_LABELS[sbRng.int(0, SB_LABELS.length - 1)]!,
      }));
      placed.push(box);
      break;
    }
    sbX -= 4;
  }

  // ---------- 7. PCIe slots — bottom-left, running horizontally ----------
  const pcieRng = rng.fork(0x60);
  const pcieCount = pcieRng.int(1, 2);
  const pcieW = pcieRng.range(80, 95);
  const pcieH = 6;
  const pcieX = board.x + 6 + pcieRng.range(0, 6);
  let pcieY = board.y + board.h - 14;
  for (let i = 0; i < pcieCount; i++) {
    const box = { x: pcieX, y: pcieY, w: pcieW, h: pcieH };
    if (fits(box, placed, 1.0) && box.x + box.w < board.x + board.w - 30) {
      out.push(makePcie({
        kind: 'pcie', zone: 'PCIE',
        x: pcieX, y: pcieY, w: pcieW, h: pcieH, rng: pcieRng,
        topLabel: pcieRng.chance(0.5) ? 'PCIE x16' : 'PCIE x8',
      }));
      placed.push(box);
    }
    pcieY -= 12;
  }

  // ---------- 8. ROM/BIOS — south-east of CPU, before SB row ----------
  const romRng = rng.fork(0x70);
  const romW = romRng.range(7, 9);
  const romH = romRng.range(11, 13);
  // Try a few spots near the SB
  const romCandidates = [
    { x: board.x + board.w - 16, y: cpuY + cpuH + 18 },
    { x: cpuX + cpuW + 2, y: cpuY + cpuH + 36 },
    { x: board.x + board.w - 26, y: cpuY + cpuH + 24 },
  ];
  for (const cand of romCandidates) {
    const box = { x: cand.x, y: cand.y, w: romW, h: romH };
    if (fits(box, placed, 1.2) && box.x + box.w < board.x + board.w - 6) {
      out.push(makeRom({
        kind: 'rom', zone: 'ROM',
        x: cand.x, y: cand.y, w: romW, h: romH, rng: romRng,
      }));
      placed.push(box);
      break;
    }
  }

  // ---------- 9. VRM zone — inductors, MOSFETs, electrolytics around CPU ----------
  // Inductors run along the top edge of the CPU (between CPU and I/O strip).
  const vrmRng = rng.fork(0x80);
  const indCount = vrmRng.int(4, 6);
  const indW = 7;
  const indH = 7;
  const indStripY = cpuY - indH - 2;
  let indX = cpuX;
  for (let i = 0; i < indCount; i++) {
    const box = { x: indX, y: indStripY, w: indW, h: indH };
    if (fits(box, placed, 0.8) && box.x + box.w < cpuX + cpuW + 2) {
      out.push(makeInductor({
        kind: 'inductor', zone: 'VRM',
        x: indX, y: indStripY, w: indW, h: indH, rng: vrmRng,
      }));
      placed.push(box);
    }
    indX += indW + 1.0;
  }

  // MOSFETs sit just above the inductors (between them and I/O).
  const mosCount = vrmRng.int(6, 10);
  const mosW = 4.2;
  const mosH = 3.4;
  let mosX = cpuX;
  const mosY = indStripY - mosH - 1.6;
  if (mosY > board.y + 1) {
    for (let i = 0; i < mosCount; i++) {
      const box = { x: mosX, y: mosY, w: mosW, h: mosH };
      if (fits(box, placed, 0.6) && box.x + box.w < cpuX + cpuW + 2) {
        out.push(makeMosfet({
          kind: 'mosfet', zone: 'VRM',
          x: mosX, y: mosY, w: mosW, h: mosH, rng: vrmRng,
        }));
        placed.push(box);
      }
      mosX += mosW + 0.6;
    }
  }

  // Electrolytics — a row of 3–5 to the left of the CPU
  const elCount = vrmRng.int(3, 5);
  const elD = vrmRng.range(7, 9);
  const elStripX = cpuX - elD - 6;
  let elY = cpuY + 4;
  if (elStripX > board.x + 2) {
    for (let i = 0; i < elCount; i++) {
      const box = { x: elStripX, y: elY, w: elD, h: elD };
      if (fits(box, placed, 0.8) && box.y + box.h < cpuY + cpuH) {
        out.push(makeElectro({
          kind: 'cap-electro', zone: 'VRM',
          x: elStripX, y: elY, w: elD, h: elD, rng: vrmRng,
        }));
        placed.push(box);
      }
      elY += elD + 1.2;
    }
  }

  // ---------- 10. Ceramic SMD caps — sprinkled around CPU & RAM (decoupling) ----------
  const cerRng = rng.fork(0x90);
  const cerTarget = cerRng.int(14, 22);
  const cerW = 2.0;
  const cerH = 1.2;
  let attempts = 0;
  let placedCer = 0;
  while (placedCer < cerTarget && attempts < 200) {
    attempts++;
    // Bias placement near CPU / RAM / VRM
    const zoneRoll = cerRng.next();
    let cx: number;
    let cy: number;
    if (zoneRoll < 0.5) {
      // Around CPU
      cx = cpuCenter.x + cerRng.range(-cpuW * 0.7, cpuW * 0.7);
      cy = cpuCenter.y + cerRng.range(-cpuH * 0.7, cpuH * 0.7);
    } else if (zoneRoll < 0.85) {
      // Between RAM and CPU
      cx = cpuX + cpuW + cerRng.range(2, 16);
      cy = ramTopY + cerRng.range(0, ramH);
    } else {
      // Lower board (near SB / PCIe)
      cx = cerRng.range(board.x + 4, board.x + board.w - 4);
      cy = sbY + cerRng.range(-8, 8);
    }
    const box = { x: cx, y: cy, w: cerW, h: cerH };
    // Stay on the board
    if (box.x < board.x + 1 || box.x + box.w > board.x + board.w - 1) continue;
    if (box.y < board.y + 1 || box.y + box.h > board.y + board.h - 1) continue;
    if (fits(box, placed, 0.5)) {
      out.push(makeCeramic({
        kind: 'cap-ceramic', zone: 'VRM',
        x: cx, y: cy, w: cerW, h: cerH, rng: cerRng,
      }));
      placed.push(box);
      placedCer++;
    }
  }

  return { components: out };
}
