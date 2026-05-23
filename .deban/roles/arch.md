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
| 2026-05-23 | Deterministic from seed end-to-end — no `Math.random()`, all randomness routed through a seeded PRNG (e.g. mulberry32 or splitmix). | A regeneratable, shareable seed is the entire iteration UX. Non-determinism would also make visual QA impossible. | [[dev]], [[qa]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Canvas2D vs WebGL vs SVG vs hybrid? Proposed: **Canvas2D for v1.** It handles the geometric layers (floorplan, cells, routing) fluently with the right API surface for rectangles and lines, and PNG export is one line. WebGL becomes attractive only when (a) thin-film interference is done per-pixel as a true shader, or (b) we hit interactive frame-rate territory. v1's interference can be a baked noise field + RGB ramp in JS — slow but adequate at 1024². — owner: arch — since: 2026-05-23
- [ ] Worker-thread render or main-thread? Proposed: **main thread for v1**; revisit if regen exceeds 1.5 s on target devices. OffscreenCanvas in a Worker is the v2 escape hatch. — owner: arch — since: 2026-05-23
- [ ] Coordinate system: integer "track-pitch" grid throughout, with a final scale-to-canvas pass? Strongly yes — the spec demands wires snap to tracks, and a unit-grid internal model makes the per-layer-direction rule trivial to enforce. — owner: arch — since: 2026-05-23

## Assumptions
- [ARCH] Mid-range mobile WebView can comfortably run a 1024² Canvas2D fill + stroke workload in under 3 s. — status: untested — since: 2026-05-23
- [ARCH] Thin-film interference as a CPU-side noise → RGB-ramp pass at 1024² fits within the v1 perf budget. — status: untested — since: 2026-05-23
- [ARCH] Simplex/Perlin noise libs (e.g. `simplex-noise`) are acceptable as deps; rolling our own is not v1 work. — status: untested — since: 2026-05-23

## Dependencies
Blocked by: [[pm]] (v1 scope and perf budget)
Feeds into: [[dev]]

## Session Log
2026-05-23 — INIT — drafted v1 render-stack proposal (Canvas2D, main thread, seeded PRNG, unit-grid internal model).
