// Generator smoke test — runs the pipeline in Node and asserts the v1 QA
// acceptance criteria are met by the typed scene (not the rendered pixels).
//
// Bundles src/gen/scene.ts via esbuild on the fly so we can run pure Node
// without a separate tsx dep.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = mkdtempSync(join(tmpdir(), 'chipsmoke-'));
const entryFile = join(tmp, 'entry.mjs');
writeFileSync(entryFile, `export { buildScene } from '${join(process.cwd(), 'src/gen/scene.ts')}';\n`);

const out = await build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  external: [],
});
const bundleFile = join(tmp, 'bundle.mjs');
writeFileSync(bundleFile, out.outputFiles[0].text);

const { buildScene } = await import(pathToFileURL(bundleFile).href);

const SEED = 'smoke-test-seed-1';

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  PASS:', msg);
}

console.log(`[smoke] building scene for seed=${SEED}`);
const t0 = performance.now();
const { scene, interference } = buildScene({ seed: SEED, dieW: 256, dieH: 256 });
const t1 = performance.now();
console.log(`[smoke] built in ${(t1 - t0).toFixed(0)}ms`);

// 1. Per-layer preferred direction encoded
const m1 = scene.routing.segments.filter((s) => s.layer === 1);
const m2 = scene.routing.segments.filter((s) => s.layer === 2);
assert(m1.length > 0, 'M1 segments present');
assert(m2.length > 0, 'M2 segments present (used for bends)');
assert(m1.every((s) => s.dir === 'h'), 'every M1 segment is horizontal');
assert(m2.every((s) => s.dir === 'v'), 'every M2 segment is vertical');

// 2. Vias at bends
assert(scene.routing.vias.length > 0, 'vias emitted at bends');

// 3. At least one SRAM macro
const srams = scene.blocks.filter((b) => b.kind === 'sram');
assert(srams.length >= 1, 'at least one SRAM macro block');
assert(scene.sramTiles.length > 0, 'SRAM bitcell tiles emitted');

// 4. Std-cell rows
assert(scene.rows.length > 0, 'std-cell rows emitted');
assert(scene.rows.some((r) => r.cells.length > 0), 'cells placed in rows');

// 5. Pads on all four sides
const padsTop = scene.pads.filter((p) => p.rect.y < 20);
const padsBot = scene.pads.filter((p) => p.rect.y > scene.dieH - 20);
const padsLeft = scene.pads.filter((p) => p.rect.x < 20);
const padsRight = scene.pads.filter((p) => p.rect.x > scene.dieW - 20);
assert(padsTop.length > 0 && padsBot.length > 0 && padsLeft.length > 0 && padsRight.length > 0,
  'pads present on all four edges');

// 6. Determinism
const b2 = buildScene({ seed: SEED, dieW: 256, dieH: 256 });
assert(b2.scene.routing.segments.length === scene.routing.segments.length,
  'deterministic: same segment count for same seed');
assert(b2.scene.rows.length === scene.rows.length,
  'deterministic: same row count for same seed');
assert(b2.interference.rgb[0] === interference.rgb[0],
  'deterministic: interference field byte-stable');

// Different seed → different scene
const b3 = buildScene({ seed: 'different-seed-xyz', dieW: 256, dieH: 256 });
assert(b3.scene.routing.segments.length !== scene.routing.segments.length
    || b3.scene.rows.length !== scene.rows.length
    || b3.interference.rgb[0] !== interference.rgb[0],
  'different seed → different scene');

console.log('');
console.log('[smoke] scene summary:');
console.log(`  pads:        ${scene.pads.length}`);
console.log(`  blocks:      ${scene.blocks.length} (sram=${srams.length}, analog=${scene.blocks.filter(b=>b.kind==='analog').length}, sea=${scene.blocks.filter(b=>b.kind==='sea').length})`);
console.log(`  rows:        ${scene.rows.length}  (total cells: ${scene.rows.reduce((a,r)=>a+r.cells.length,0)})`);
console.log(`  sram tiles:  ${scene.sramTiles.length}`);
console.log(`  segments:    ${scene.routing.segments.length}  (M1=${m1.length}, M2=${m2.length})`);
console.log(`  vias:        ${scene.routing.vias.length}`);
console.log('');
console.log('[smoke] all checks passed.');
