---
role: qa
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# QA — Visual Quality Bar & Regression

## Scope
Owns the visual acceptance criteria for v1 and the regression discipline: which features make the output "read as a die" vs. "read as a sci-fi prop."

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | v1 visual acceptance criteria (must-hit, ranked by realism contribution): (1) per-layer preferred routing direction with via stamps at bends; (2) standard-cell rows with horizontal power rail striping; (3) at least one SRAM-like macro with a finer, more-regular periodic texture than the cell sea; (4) pad ring around the perimeter; (5) some form of thin-film interference tint, even if crude. Failure on any of (1)–(3) means it does not read as a die. (4)–(5) are nice but rescuable in v1.1. | The spec explicitly identifies these as the constraints that separate "circuit-looking" from "die-looking" (lines 1, 5–9). Skipping the per-layer-direction rule especially is the single biggest tell of a fake. | [[pm]], [[arch]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Reference micrographs to A/B against during dev — pin 3–5 real decapped-chip images to a `references/` folder for side-by-side QA. — owner: qa — since: 2026-05-23
- [ ] Side-by-side viewer in dev mode (real micrograph next to generated) — useful but cuttable from v1. — owner: qa — since: 2026-05-23

## Assumptions
- [QA] Visual QA is subjective and judged by Gerald, not by automated metric, for v1. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[arch]] (pipeline), [[dev]] (implementation)
Feeds into: [[pm]] (ship decision)

## Session Log
2026-05-23 — INIT — drafted ranked acceptance criteria; (1)–(3) are non-negotiable for v1.
