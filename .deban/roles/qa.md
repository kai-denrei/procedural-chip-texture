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
| 2026-05-23 | **Smoke test (`scripts/smoke-test.mjs`) is the v1 regression bar.** Bundles the generator with esbuild and asserts: M1 segments all `dir: 'h'`, M2 all `dir: 'v'`, vias > 0, SRAM blocks > 0, SRAM tiles > 0, rows > 0, pads on all four edges, deterministic per-seed, distinct across seeds. Runs in <100 ms. | Catches every regression in the *encoded structural rules* without requiring a browser. Visual A/B (golden PNG hash) is a v1.1 cherry on top. | [[dev]] |
| 2026-05-23 | **motherboard-v1 acceptance bar (closed).** `scripts/smoke-test-board.mjs` runs the board pipeline and asserts every count + topology + determinism criterion from the spec. The chip smoke test still runs unchanged (chip pipeline was not modified). Both tests are in the project root scripts/ folder and called via `npm run smoke` and `npm run smoke:board`. | Mirrors the v1 structural-acceptance pattern. Catches "I broke the layout invariants without noticing" regressions. <100 ms to run. | [[dev]] |

## Acceptance status (v1 close-out)
- [x] **(1) Per-layer preferred routing direction with via stamps at bends** — smoke test asserts every M1 segment is `'h'` and every M2 segment is `'v'`; 161 vias emitted on the smoke seed.
- [x] **(2) Standard-cell rows with horizontal power-rail striping** — 107 rows, 754 cells on the smoke seed. Each row painted with a VDD rail (top) and VSS rail (bottom). Renderer code: `src/render/canvas.ts` lines for `row.rect.y + railH`.
- [x] **(3) ≥1 SRAM macro with finer periodic texture than the cell sea** — smoke seed shows 1 SRAM macro with 4154 bitcell tiles vs 754 std cells over a much larger total area; texture-density contrast is structural.
- [x] **(4) Pad ring around the perimeter** — smoke test asserts pads on all four edges; 96 pads on the smoke seed.
- [x] **(5) Thin-film interference tint** — `gen/effects.ts` generates a low-frequency 2D noise → sinusoidal RGB ramp field, sampled per-pixel and screen-blended in the renderer. Strength 0.32 by default.
- [x] **(6) Installable PWA** — manifest with name/short_name/start_url/scope/standalone/192/512/maskable-512 icons; iOS head tags + apple-touch-icon-180; service worker via vite-plugin-pwa; `offline.html` precached + navigateFallback wired; "refresh to update" toast.
- [x] **(7) Cache-busting toolkit wired into build** — `scripts/bust.sh` runs as `prebuild`/`predev` npm script. Generates `src/build-id.generated.ts` (badge source) + `public/build-id.json` (out-of-band deploy sanity check). Layered with Vite content-hash fingerprinting + meta no-cache + visible badge.
- [x] **(8) Visible build-id badge** — `#build-badge` in `index.html`, painted from `BUILD_ID` constant at app init. Top-right corner.
- [x] **(9) `npm run build` + `npm run preview`** — both verified locally; preview serves on :4173, all artifacts (HTML, SW, manifest, icons, build-id.json) reachable.

## Acceptance status (motherboard-v1 close-out)
- [x] **(1) `/board` route exists, navigable from `/`, shared seed via URL** — pathname router in `src/ui/router.ts`; nav buttons in `index.html`; verified `curl http://localhost:4173/board` returns the SPA shell.
- [x] **(2) All 10 component categories render** — CPU, NB, SB, RAM (2–4), ROM, electrolytic+ceramic caps, PCIe (1–2), VRM inductors+MOSFETs, I/O panel, silkscreen labels. Smoke test asserts each minimum count.
- [x] **(3) CPU↔RAM bus visible as multi-trace bundle w/ length-matching serpentine** — `traces.ts` emits 3 traces per RAM slot from CPU's right edge; `addSerpentine` mutates one trace to a polyline of ≥10 points. Smoke test asserts both.
- [x] **(4) CPU↔Southbridge bus visible** — emitted in `traces.ts`, routes around NB obstacle. Smoke test asserts ≥1 trace on the `cpu-sb` net.
- [x] **(5) Silkscreen labels render without collisions** — `silkscreen.ts` tries 6 candidate positions around each component and skips the label rather than collide. Smoke test asserts no label-vs-component overlap.
- [x] **(6) Cache-busting skill installed; favicon visibly changes per build; corner widget shows tiles + token** — `public/cb-shapes/00..63.svg` shipped; `index.html` head has `<meta name="cb">` + shape favicon + cb-badge.js. Verified the favicon cell changes across consecutive `bash scripts/bust.sh` runs (e.g. cell 32 → cell 1).
- [x] **(7) Chip view at `/` is unchanged — its smoke test still passes** — verified: `node scripts/smoke-test.mjs` exits 0 with all 14 chip assertions green. No file under `src/gen/` or `src/render/canvas.ts` was modified.
- [x] **(8) Board smoke test asserts every acceptance criterion** — 24 assertions, all green on seed `board-smoke-1`.
- [x] **(9) `npm run build` + `npm run preview` green** — build completes in ~125 ms; preview serves both routes correctly (SPA fallback on `/board`).
- [x] **(10) Mobile-first 375px-width layout** — the canvas uses `width: min(100vmin, 100%)` (chip) and `width: min(100%, …)` (board); top nav is 36 px high with thumb-reachable buttons; bottom dock unchanged. The board canvas downsamples to 800 px wide on narrow viewports.

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
- Structural acceptance ("the rule is encoded in the types") is *cheaper* to verify than visual acceptance ("the pixels look right") and catches the more critical regressions. Visual drift is a polish issue; structural-rule drift makes the thing not read as a die at all.

## Open Questions
- [ ] v1.1: golden-seed PNG hash regression. Headless browser, three seeds, snapshot bitmap → SHA. — owner: qa / [[dev]] — since: 2026-05-23
- [ ] v1.1: pin 3–5 real decapped-chip micrographs to a `references/` folder for side-by-side QA. — owner: qa — since: 2026-05-23

## Assumptions
- [QA] Visual QA is subjective and judged by Gerald, not by automated metric, for v1. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[arch]] (pipeline), [[dev]] (implementation)
Feeds into: [[pm]] (ship decision)

## Session Log
2026-05-23 — MOTHERBOARD-V1 — board smoke test (`scripts/smoke-test-board.mjs`) green with 24 structural assertions: ≥1 CPU/NB/SB, ≥2 RAM, ≥4 caps, ≥1 PCIe, ≥1 VRM inductor, 4 mounting holes, ≥10 traces (actually 34), CPU↔RAM serpentine present, CPU↔SB bus present, no component bounding-box overlaps, all components inside PCB rect, byte-stable layout + trace signatures across re-runs with the same seed, different seed produces different layout, no silkscreen label overlaps. Chip smoke test still green (untouched). `npm run build` succeeds. Favicon shape + colour visibly differ across builds.
2026-05-23 — V1 — smoke test green; all 5 ranked acceptance criteria pass on every seed exercised; PWA delivery criteria (6)–(9) verified via preview server.
2026-05-23 — INIT — drafted ranked acceptance criteria; (1)–(3) are non-negotiable for v1.
