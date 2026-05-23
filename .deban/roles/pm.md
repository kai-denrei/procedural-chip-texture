---
role: pm
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# PM — Product / Scope

## Scope
Owns v1 definition, scope cuts, sequencing, and the "done" bar. Decides what is in v1 and what is explicitly deferred. Resolves cross-role contention.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | Project framed as solo exploratory, not product. | User stated "solo project to explore"; reduces gold-plating risk; lets quality bar be calibrated as we go rather than committed up front. | [[arch]] |
| 2026-05-23 | Mobile-first PWA shell as the delivery substrate. | User instruction; also: a deterministic-from-seed generator is naturally offline-capable, so PWA is cheap and the install flow doubles as a portfolio artifact. | [[devops]], [[ux]] |
| 2026-05-23 | Cache-busting must be wired in before v1 ships, not bolted on. | User instruction; also: a PWA + service worker is the worst environment in which to debug "why is my new build invisible." Better to install the discipline up front than reverse-engineer staleness later. | [[devops]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->

## Open Questions
- [ ] What is the explicit "done" criterion for v1? Proposed cut: single rendered die from a seed input; visible floorplan (BSP + pad ring + std-cell sea + ≥1 SRAM-like macro); at least one routing layer with per-layer preferred direction and via stamps; thin-film interference tint pass; rendered to a canvas displayed in an installable PWA shell. Everything else (OPC serifs, oxidation, dishing, optics, multi-layer power mesh, H-tree clock, dummy fill, scratches) is post-v1 polish. — owner: pm — since: 2026-05-23
- [ ] Does v1 ship interactive controls or just "regenerate"? Proposed cut: seed input, "regenerate" button, save-as-PNG. No layer toggles, no live parameter sliders in v1 — those are v2. — owner: pm / [[ux]] — since: 2026-05-23
- [ ] What is the target render time on a mid-range mobile (e.g. iPhone 12 / Pixel 6)? Proposed cut: under 3 s for v1; under 500 ms is v2. — owner: pm / [[arch]] — since: 2026-05-23
- [ ] What is the target canvas resolution for v1? A real die micrograph at 2048² is gorgeous but heavy on mobile GPUs. Proposed cut: 1024² internal render, CSS-scaled to viewport. — owner: pm / [[arch]] — since: 2026-05-23

## Assumptions
- [PM] User wants something shippable and iterable, not a research artifact. — status: untested — since: 2026-05-23
- [PM] The visual quality bar in the spec (line 23: "photographed through a microscope") is aspirational for the project, not the v1 acceptance criterion. — status: untested — since: 2026-05-23
- [PM] No external API / backend in scope; everything client-side. — status: untested — since: 2026-05-23
- [PM] No user accounts, no persistence beyond local-storage seed history. — status: untested — since: 2026-05-23

## Dependencies
Blocked by:
Feeds into: [[arch]] (scope drives tech choice), [[dev]] (scope drives build order), [[ux]] (scope drives surface area)

## Session Log
2026-05-23 — INIT — drafted v1 scope proposal as Open Questions to be confirmed by user or PM agent in dispatch.
