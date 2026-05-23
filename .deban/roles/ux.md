---
role: ux
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# UX — Mobile-First Interaction

## Scope
Owns the visible interface, controls, viewport behavior, install prompt UX, and gesture interactions on the rendered die.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | Single-screen app: chip canvas fills the viewport, minimal controls anchored at the bottom (regenerate, seed input, save). | Mobile-first means thumb-reachable controls and zero chrome competing with the artifact. The image is the product. | [[pm]] |
| 2026-05-23 | Pinch-zoom and pan via CSS `touch-action: none` + a small pan/zoom helper, NOT browser default zoom. | Browser zoom would zoom the whole UI including controls. We want the canvas alone to zoom — micrograph behavior, not webpage behavior. | [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] iOS Safari "Add to Home Screen" UX: passive (manifest only) or active prompt with a custom helper? Proposed: passive for v1; iOS does not support the `beforeinstallprompt` event so a custom helper is fiddly and easy to defer. — owner: ux — since: 2026-05-23
- [ ] Dark UI chrome around a bright canvas vs. light? Proposed: dark — the die imagery is photographed-through-a-microscope; matching dark chrome makes it feel like a viewer, not a webpage. — owner: ux — since: 2026-05-23
- [ ] Seed input UX: free text, slot machine roller, or hidden behind a "..." button? Proposed: visible compact text field with a die-roll icon button next to "regenerate". — owner: ux — since: 2026-05-23

## Assumptions
- [UX] Primary target form factor is portrait phone (375–430 px wide). — status: untested — since: 2026-05-23
- [UX] Landscape and tablet are nice-to-have, not required for v1. — status: untested — since: 2026-05-23

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]]

## Session Log
2026-05-23 — INIT — drafted single-screen mobile layout with bottom controls and pinch-zoom on the canvas only.
