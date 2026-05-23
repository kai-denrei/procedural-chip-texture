---
role: dev
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# Dev — Implementation

## Scope
Owns the actual code: build tool, language, dependencies, module layout, the procedural generator implementation, PWA scaffolding wiring, and cache-busting wiring.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | Vite + TypeScript + `vite-plugin-pwa`. | Vite gives instant HMR for a tight iteration loop on visuals; TS catches the kind of off-by-one and unit-mismatch bugs that will plague a grid-based generator; `vite-plugin-pwa` is the path of least resistance for a PWA + Workbox + auto-update SW. | [[arch]], [[devops]] |
| 2026-05-23 | Module layout: `src/gen/floorplan.ts`, `src/gen/cells.ts`, `src/gen/routing.ts`, `src/gen/effects.ts`, `src/render/canvas.ts`, `src/rng.ts`, `src/app.ts`. Each generator stage takes a typed input and returns typed output; render is a separate pass. | Mirrors the pipeline order from [[arch]]; lets us swap any stage without entangling the rest; testable in isolation. | [[arch]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Noise library: `simplex-noise` (small, fast) or hand-rolled? Proposed: `simplex-noise` for v1 — same-seed determinism is supported and rolling our own is not v1-critical. — owner: dev — since: 2026-05-23
- [ ] Test strategy for a visual generator? Proposed: golden-seed regression — pick three seeds, snapshot their PNG hash, fail CI on drift. Not v1-blocking but cheap to add. — owner: dev / [[qa]] — since: 2026-05-23

## Assumptions
- [DEV] Node 20+ available locally. — status: untested — since: 2026-05-23
- [DEV] No SSR / no Next.js; pure static SPA. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[arch]] (tech choice), [[pm]] (v1 scope)
Feeds into: [[qa]], [[devops]]

## Session Log
2026-05-23 — INIT — drafted build tool + module layout.
