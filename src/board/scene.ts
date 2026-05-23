/**
 * Board scene assembly — mirrors the chip pipeline's contract:
 *
 *   buildBoardScene({ seed }) → { scene }
 *
 * Stages (each gets its own forked RNG so changes in one stage don't shift
 * downstream output of unrelated stages):
 *
 *   1. layout  — anchored zones, seeded variation → Components
 *   2. labels  — auto-numbered silkscreen refs (U1, C44, J3) + collision-aware placement
 *   3. traces  — Manhattan PCB routing + length-matched serpentines + vias
 */

import { makeRng } from '../rng.js';
import { generateLayout } from './layout.js';
import { generateTraces } from './traces.js';
import { assignLabels } from './silkscreen.js';
import type { BoardScene } from './types.js';

export interface BuildBoardSceneInput {
  seed: string;
  /** PCB dimensions in mm. Default: 244 x 200 (mini-ATX-ish landscape). */
  pcbW?: number;
  pcbH?: number;
}

export interface BuildBoardSceneResult {
  scene: BoardScene;
}

export function buildBoardScene(input: BuildBoardSceneInput): BuildBoardSceneResult {
  const pcbW = input.pcbW ?? 244;
  const pcbH = input.pcbH ?? 200;
  const rng = makeRng(`board:${input.seed}`);

  const layout = generateLayout({
    pcbW, pcbH, rng: rng.fork(0x01),
  });

  const labeled = assignLabels(layout.components);

  const routing = generateTraces({
    components: labeled.components,
    pcbW, pcbH, rng: rng.fork(0x02),
  });

  const scene: BoardScene = {
    pcbW, pcbH,
    components: labeled.components,
    traces: routing.traces,
    vias: routing.vias,
    labels: labeled.labels,
    seed: input.seed,
  };

  return { scene };
}
