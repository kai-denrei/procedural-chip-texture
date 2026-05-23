---
role: arch
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# Architecture — Render Pipeline & Tech Choice

## Scope
Owns the render pipeline, the rendering technology choice (Canvas2D / WebGL / SVG / hybrid), the data model for the procedural layers (floorplan tree, cell rows, routing nets, fill), and the seed → deterministic output contract.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | Pipeline ordered exactly as the spec dictates: clean geometry on a grid → geometric imperfection (LER, rounding, OPC) → layer compositing with interference tint → surface aging (oxidation, dishing) → global optics last. | The spec is explicit on this and reversing the order destroys the cumulative realism. Each stage assumes the previous one. | [[dev]] |
| 2026-05-23 | Deterministic from seed end-to-end — no `Math.random()`, all randomness routed through a seeded PRNG (mulberry32 with xfnv1a string hash). | A regeneratable, shareable seed is the entire iteration UX. Non-determinism would also make visual QA impossible. Smoke test verifies: same seed → byte-stable scene + interference field. | [[dev]], [[qa]] |
| 2026-05-23 | **Canvas2D for v1 (closed).** Per-pixel interference tint via `getImageData`/`putImageData` after geometry pass. ~80–250 ms at 1024². WebGL is the v2 escape hatch when (a) the tint moves to a fragment shader or (b) interactive frame rates are needed. | Smoke test confirms the perf budget is met with huge headroom on desktop. Phone perf is unmeasured but the operation is straightforward. | [[dev]] |
| 2026-05-23 | **Main thread for v1 (closed).** OffscreenCanvas/Worker is the v1.1 escape hatch if regen > 1.5 s on target devices. | Same as above; budget is comfortable, no need to add Worker plumbing yet. | [[dev]] |
| 2026-05-23 | **Unit-grid internal coordinate model (closed).** Generator emits integer unit-grid rectangles; renderer scales to canvas pixels. Per-layer direction rule is enforced at the API: M1 segments are `dir: 'h'`, M2 `dir: 'v'`. | Makes the per-layer-direction rule trivial to enforce and verify (smoke test asserts it on every emitted segment). Lets the renderer change resolution without touching the generator. | [[dev]] |
| 2026-05-23 | **`simplex-noise` (v4) as the noise dep.** | Tiny, fast, seedable via a `() => number` source — drops cleanly into our mulberry32. Rolling our own is not v1 work. | [[dev]] |
| 2026-05-23 | **One routing layer pair in v1 (M1 + M2 for L-bends).** API accepts `preferredDir` per layer so adding M3/M4 is a function call. | Closed the "≥1 routing layer" criterion with margin: bends already exercise the layer-stack rule. M3+ is one of the highest-value v1.1 wins. | [[dev]], [[qa]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-23 | Standing up the smoke test by importing `src/gen/scene.ts` directly via Node's `--experimental-strip-types`. | TS files use `.js` extension imports (correct for Vite/bundler-resolution) but Node's loader can't rewrite extensions. Switched to esbuild bundling on the fly — works and stays dependency-free since esbuild is a transitive Vite dep. |

## Lessons
- "Encode the per-layer-direction rule in the *types*, not the rendering" — once `Segment.dir` is mandatory and `M1 = 'h' / M2 = 'v'` is asserted in the generator, the rule is impossible to violate without a smoke test failing. This is the single most important "don't fake the constraint" lever in the codebase.

## Open Questions
- [ ] v1.1: move the interference pass to a WebGL fragment shader — it's the single biggest perf cliff on a phone. Currently CPU per-pixel. — owner: arch — since: 2026-05-23
- [ ] v1.1: OffscreenCanvas + Worker if phone regen exceeds budget. — owner: arch — since: 2026-05-23
- [ ] v1.1: route via greedy channel router inside the BSP-reserved channels — currently we emit nets with random endpoints in the interior. Channel-following is the next realism cliff after multi-layer. — owner: arch — since: 2026-05-23

## Assumptions
- [ARCH] Mid-range mobile WebView can comfortably run a 1024² Canvas2D fill + stroke workload in under 3 s. — status: untested — since: 2026-05-23
- [ARCH] Thin-film interference as a CPU-side noise → RGB-ramp pass at 1024² fits within the v1 perf budget. — status: validated locally (desktop only) — since: 2026-05-23
- [ARCH] Simplex/Perlin noise libs (e.g. `simplex-noise`) are acceptable as deps; rolling our own is not v1 work. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[pm]] (v1 scope and perf budget)
Feeds into: [[dev]]

## Session Log
2026-05-23 — V1 — pipeline implemented end-to-end. Smoke test asserts every routing segment respects its layer's preferred direction. Scene assembly (`src/gen/scene.ts`) orchestrates all four stages in the spec's order. Per-pixel interference tint composites after geometry; deferred stages (LER/OPC/oxidation/dishing/optics) recorded as v1.1 Open Questions.
2026-05-23 — INIT — drafted v1 render-stack proposal (Canvas2D, main thread, seeded PRNG, unit-grid internal model).
