// Motherboard generator smoke test — runs the board pipeline in Node and
// asserts the motherboard-v1 acceptance criteria on the typed scene (not the
// rendered pixels).
//
// Same esbuild-on-the-fly trick as scripts/smoke-test.mjs.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = mkdtempSync(join(tmpdir(), 'boardsmoke-'));
const entryFile = join(tmp, 'entry.mjs');
writeFileSync(entryFile, `export { buildBoardScene } from '${join(process.cwd(), 'src/board/scene.ts')}';\n`);

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

const { buildBoardScene } = await import(pathToFileURL(bundleFile).href);

const SEED = 'board-smoke-1';

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  PASS:', msg);
}

console.log(`[smoke-board] building scene for seed=${SEED}`);
const t0 = performance.now();
const { scene } = buildBoardScene({ seed: SEED });
const t1 = performance.now();
console.log(`[smoke-board] built in ${(t1 - t0).toFixed(0)}ms`);

// 1–6. Component counts by kind
const byKind = (k) => scene.components.filter((c) => c.kind === k);
assert(byKind('cpu').length >= 1, '>=1 CPU');
assert(byKind('northbridge').length >= 1, '>=1 northbridge');
assert(byKind('southbridge').length >= 1, '>=1 southbridge');
assert(byKind('ram').length >= 2, '>=2 RAM slots');
const allCaps = byKind('cap-electro').length + byKind('cap-ceramic').length;
assert(allCaps >= 4, `>=4 capacitors (electro+ceramic, got ${allCaps})`);
assert(byKind('pcie').length >= 1, '>=1 PCIe slot');
assert(byKind('inductor').length >= 1, '>=1 VRM inductor');
assert(byKind('rom').length >= 1, '>=1 ROM/BIOS');
assert(byKind('io-panel').length >= 1, '>=1 I/O panel cutout');
assert(byKind('mount-hole').length === 4, 'four mounting holes (corners)');

// 7. Trace count
assert(scene.traces.length >= 10, `>=10 PCB traces (got ${scene.traces.length})`);

// CPU↔RAM serpentine: at least one cpu-ram trace must have a noticeable
// number of polyline points (serpentine adds many bends).
const ramTraces = scene.traces.filter((t) => t.net === 'cpu-ram');
assert(ramTraces.length >= 2, 'CPU↔RAM bus has multiple parallel traces');
const hasSerpentine = ramTraces.some((t) => t.points.length >= 10);
assert(hasSerpentine, 'at least one CPU↔RAM trace carries a length-matching serpentine');

const sbTraces = scene.traces.filter((t) => t.net === 'cpu-sb');
assert(sbTraces.length >= 1, 'CPU↔Southbridge bus present');

// 8. No bounding-box overlaps
function overlap(a, b, pad = 0.001) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}
let overlapPairs = 0;
for (let i = 0; i < scene.components.length; i++) {
  for (let j = i + 1; j < scene.components.length; j++) {
    if (overlap(scene.components[i].rect, scene.components[j].rect)) {
      overlapPairs++;
      console.error(`  overlap: ${scene.components[i].kind} (${scene.components[i].id || '-'}) x ${scene.components[j].kind} (${scene.components[j].id || '-'})`);
    }
  }
}
assert(overlapPairs === 0, `no component bounding-box overlaps (found ${overlapPairs})`);

// All components must fit inside the PCB rect
const off = scene.components.filter(
  (c) => c.rect.x < 0 || c.rect.y < 0 ||
         c.rect.x + c.rect.w > scene.pcbW ||
         c.rect.y + c.rect.h > scene.pcbH,
);
assert(off.length === 0, 'all components fit inside the PCB rect');

// 9. Determinism: re-run with same seed → byte-stable scene.
const b2 = buildBoardScene({ seed: SEED }).scene;
assert(b2.components.length === scene.components.length, 'deterministic: same component count');
assert(b2.traces.length === scene.traces.length, 'deterministic: same trace count');
assert(b2.labels.length === scene.labels.length, 'deterministic: same label count');
const sigA = JSON.stringify(scene.components.map((c) => [c.kind, c.id, c.rect.x.toFixed(3), c.rect.y.toFixed(3), c.rect.w.toFixed(3), c.rect.h.toFixed(3)]));
const sigB = JSON.stringify(b2.components.map((c) => [c.kind, c.id, c.rect.x.toFixed(3), c.rect.y.toFixed(3), c.rect.w.toFixed(3), c.rect.h.toFixed(3)]));
assert(sigA === sigB, 'deterministic: identical component layout signature');
const trA = JSON.stringify(scene.traces.map((t) => [t.net, t.points.length, t.points[0].x.toFixed(2), t.points[0].y.toFixed(2)]));
const trB = JSON.stringify(b2.traces.map((t) => [t.net, t.points.length, t.points[0].x.toFixed(2), t.points[0].y.toFixed(2)]));
assert(trA === trB, 'deterministic: identical trace signature');

// Different seed → different scene
const b3 = buildBoardScene({ seed: 'different-board-seed' }).scene;
const sigC = JSON.stringify(b3.components.map((c) => [c.kind, c.rect.x.toFixed(3), c.rect.y.toFixed(3)]));
assert(sigC !== sigA, 'different seed → different board layout');

// 10. Silkscreen labels present, no label-vs-component overlap
assert(scene.labels.length >= 5, `>=5 silkscreen labels (got ${scene.labels.length})`);
for (const lab of scene.labels) {
  const labBox = { x: lab.x, y: lab.y, w: lab.text.length * lab.size * 0.7, h: lab.size };
  for (const c of scene.components) {
    if (overlap(labBox, c.rect, 0.05)) {
      console.error(`  label "${lab.text}" overlaps component ${c.kind} (${c.id || '-'})`);
      process.exit(1);
    }
  }
}
console.log('  PASS: no silkscreen label overlaps any component');

console.log('');
console.log('[smoke-board] scene summary:');
console.log(`  pcb:         ${scene.pcbW} x ${scene.pcbH} mm`);
console.log(`  components:  ${scene.components.length}`);
console.log(`    cpu=${byKind('cpu').length} nb=${byKind('northbridge').length} sb=${byKind('southbridge').length}`);
console.log(`    ram=${byKind('ram').length} rom=${byKind('rom').length} pcie=${byKind('pcie').length} io=${byKind('io-panel').length}`);
console.log(`    caps=${allCaps} (electro=${byKind('cap-electro').length} ceramic=${byKind('cap-ceramic').length})`);
console.log(`    vrm: inductor=${byKind('inductor').length} mosfet=${byKind('mosfet').length}`);
console.log(`    holes=${byKind('mount-hole').length}`);
console.log(`  traces:      ${scene.traces.length}`);
console.log(`    cpu-ram=${ramTraces.length} cpu-sb=${sbTraces.length} cpu-nb=${scene.traces.filter(t=>t.net==='cpu-nb').length} power=${scene.traces.filter(t=>t.net==='power').length} misc=${scene.traces.filter(t=>t.net==='misc').length}`);
console.log(`  vias:        ${scene.vias.length}`);
console.log(`  labels:      ${scene.labels.length}`);
console.log('');
console.log('[smoke-board] all checks passed.');
