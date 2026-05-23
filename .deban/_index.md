---
project: procedural-chip-texture
created: 2026-05-23
status: active
mode: solo
stale_threshold_days: 30
---

# procedural-chip-texture — Index

## Brief
A solo exploratory web tool that procedurally generates IC die imagery — floorplan-first (BSP slicing, pad ring, macros vs. standard-cell sea), layered routing with per-layer preferred direction (M1 horizontal, M2 vertical, …) via Manhattan staircases and via stamps, OPC artifacts and line-edge roughness, thin-film interference tint, oxidation/dishing, and optical/sensor effects last. Mobile-first PWA, deterministic from a seed, client-side render. Goal: ship a basic v1 to iterate on — a single rendered die from a seed, the floorplan layer plus at least one routing layer plus thin-film tint, displayed in an installable mobile-first shell with cache-busting + service-worker invalidation in place.

## Active Roles
- [[pm]] — owner: Gerald (Jelaludo) — drives v1 scope and unblocks
- [[arch]] — owner: Gerald — render pipeline + tech choice
- [[dev]] — owner: Gerald — implementation
- [[ux]] — owner: Gerald — mobile-first interactions, controls
- [[qa]] — owner: Gerald — visual quality bar, regression
- [[devops]] — owner: Gerald — PWA shell, cache-busting, deploy

## Key Decisions
<!-- Cross-role summary, maintained by COMPACT -->

## Open Questions (cross-role)
- [ ] What is the explicit "done" criterion for v1? — owner: [[pm]] — since: 2026-05-23
- [ ] Canvas2D vs WebGL vs SVG vs hybrid for the layered render on mobile GPUs? — owner: [[arch]] — since: 2026-05-23
- [ ] Does v1 ship interactive controls (seed, layer toggles, zoom) or just a generated image with a "regenerate" button? — owner: [[pm]] / [[ux]] — since: 2026-05-23
