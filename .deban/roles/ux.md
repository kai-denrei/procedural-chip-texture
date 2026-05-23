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
| 2026-05-23 | **Dark UI chrome (closed).** Background `#0a0d11`, amber accent `#d9a441` for primary action and build badge. | Die imagery is photographed-through-a-microscope — matching dark chrome makes it feel like a viewer, not a webpage. | [[devops]] |
| 2026-05-23 | **Seed UX (closed):** visible compact text field, dice-icon "random" button, primary "Generate" button, download-arrow save button. URL `?seed=X` mirrors the input so a chip can be shared by link. | Three-button bottom dock — fits 375px portrait without horizontal scroll. Save-as-PNG ships in v1 because it's two lines (`canvas.toBlob` + anchor download) and is what makes the artifact shareable. | [[pm]] |
| 2026-05-23 | **iOS PWA install: passive (closed).** Manifest + apple-touch-icon + status-bar-style meta. No active install prompt. | iOS doesn't support `beforeinstallprompt`; a custom helper is fiddly and not v1. The manifest + iOS head tags are present and validated. | [[devops]] |
| 2026-05-23 | **Update toast: explicit "Refresh" button, never silent.** Pinned bottom-center above the dock. | Dispatch's "refresh-to-update toast" requirement; also: silent updates strand users on inconsistent state mid-session. | [[devops]] |
| 2026-05-23 | **motherboard-v1 nav (closed).** Top-of-viewport 36 px nav row with two buttons: "Chip" and "Board". Active route highlighted with the amber accent. Hits `history.pushState` via `src/ui/router.ts` — no full page reload. | Two-route SPA: a tab strip is the simplest possible affordance and stays out of the canvas's way. Top placement (vs. bottom) keeps the existing bottom dock unchanged so the chip view's UX is byte-identical post-refactor. | [[dev]] |
| 2026-05-23 | **Board canvas aspect ratio: 4:3 landscape (closed).** `body.view-board #chip-canvas { aspect-ratio: 4/3 }` overrides the chip view's 1:1. Width on narrow screens caps at `min(100%, (100vh-180px)*4/3)` so the canvas never overflows. | Real motherboards are wider than tall; a square canvas would crop the I/O strip or the PCIe slots. The board renderer maps PCB-mm to canvas-px so the longer side fills. | [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
- Bottom-anchored controls in a viewport-fixed layout require `env(safe-area-inset-bottom)` padding on iOS or the home-bar overlaps the buttons. Wired up.
- `touch-action: none` on `#canvas-wrap` (not on body) keeps the controls reachable while canvas owns the gestures.

## Open Questions
- [ ] Pinch-zoom currently transforms the canvas with CSS — that means the bitmap is upscaled, losing crispness. v1.1 path: re-render the scene at a higher resolution on zoom-in. — owner: ux — since: 2026-05-23
- [ ] Seed history (last N seeds in local storage, recall menu). Cuttable from v1; cheap v1.1. — owner: ux — since: 2026-05-23
- [ ] Layer-toggle controls (M1 only, M2 only, no-tint, etc.) — useful for understanding the generator but not v1. — owner: ux — since: 2026-05-23

## Assumptions
- [UX] Primary target form factor is portrait phone (375–430 px wide). — status: validated (layout tested in CSS reasoning) — since: 2026-05-23
- [UX] Landscape and tablet are nice-to-have, not required for v1. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]]

## Session Log
2026-05-23 — MOTHERBOARD-V1 — added top-of-viewport nav (`#view-nav`) with Chip/Board tabs, styled to match the dark chrome. Body class `view-board` toggles the canvas aspect-ratio override for board mode. Build-id badge slid down 42 px so the cb-corner-widget (lower-right) has clear vertical room. Bottom dock untouched.
2026-05-23 — V1 — DOM + CSS wired in `index.html`, `src/styles.css`. Bottom dock with seed text + dice button + Generate + save. Pinch-zoom + pan via PointerEvents. Update toast slides up above the dock. Build-id badge top-right.
2026-05-23 — INIT — drafted single-screen mobile layout with bottom controls and pinch-zoom on the canvas only.
