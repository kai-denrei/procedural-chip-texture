/**
 * Scene assembly — orchestrates all generator stages in the spec's order:
 *   1. clean geometry on a grid:
 *      a. floorplan (pad ring, seal ring, BSP-typed blocks)
 *      b. cells (std-cell rows in sea blocks, SRAM bitcells in macros)
 *   2. routing (per-layer preferred-direction Manhattan + via stamps)
 *   3. (deferred for v1) geometric imperfection (LER, rounding, OPC serifs)
 *   4. (deferred for v1, separately produced) thin-film interference tint
 *   5. (deferred for v1) surface aging — oxidation, dishing
 *   6. (deferred for v1) global optics — blur, CA, vignette, grain
 *
 * The `Scene` returned here is the input to the renderer, with the
 * interference field passed alongside.
 */

import { makeRng } from '../rng.js';
import { generateFloorplan } from './floorplan.js';
import { generateCells } from './cells.js';
import { generateRouting } from './routing.js';
import { generateInterferenceField, type InterferenceField } from './effects.js';
import type { Scene } from './types.js';

export interface BuildSceneInput {
  seed: string;
  dieW?: number;
  dieH?: number;
  /** Resolution of the interference noise field (independent of canvas size). */
  effectsFieldRes?: number;
}

export interface BuildSceneResult {
  scene: Scene;
  interference: InterferenceField;
}

export function buildScene(input: BuildSceneInput): BuildSceneResult {
  const dieW = input.dieW ?? 256;
  const dieH = input.dieH ?? 256;
  const rng = makeRng(input.seed);

  const fp = generateFloorplan(rng.fork(0xa1), { dieW, dieH });
  const cells = generateCells(rng.fork(0xb2), { blocks: fp.blocks });
  const routing = generateRouting(rng.fork(0xc3), {
    region: fp.interior,
    obstacles: fp.blocks,
  });

  const fieldRes = input.effectsFieldRes ?? 96;
  const interference = generateInterferenceField(rng.fork(0xd4), {
    fieldW: fieldRes,
    fieldH: fieldRes,
  });

  const scene: Scene = {
    dieW,
    dieH,
    pads: fp.pads,
    sealRing: fp.sealRing,
    blocks: fp.blocks,
    rows: cells.rows,
    sramTiles: cells.sramTiles,
    routing,
    seed: input.seed,
  };

  return { scene, interference };
}
