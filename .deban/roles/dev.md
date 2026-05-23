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
| 2026-05-23 | Module layout: `src/gen/{floorplan,cells,routing,effects,scene,types}.ts`, `src/render/canvas.ts`, `src/rng.ts`, `src/app.ts`. Each generator stage takes a typed input and returns typed output; render is a separate pass. | Mirrors the pipeline order from [[arch]]; lets us swap any stage without entangling the rest; testable in isolation (smoke test imports `gen/scene.ts` only). | [[arch]] |
| 2026-05-23 | **`simplex-noise` v4 (closed Open Question).** Seeded via `() => rng.next()`. | Cheap, deterministic, tiny. | [[arch]] |
| 2026-05-23 | **Smoke test via esbuild-on-the-fly bundling.** `scripts/smoke-test.mjs` bundles `src/gen/scene.ts` with esbuild (transitive Vite dep, no new install) and runs the assertions in pure Node. Asserts: every routing segment respects its layer's preferred direction, vias exist at bends, ≥1 SRAM macro, ≥1 std-cell row, pads on all four edges, same seed produces byte-identical scene + interference field. | Browser-only visual regression requires a headless browser; node-canvas requires native compilation. The structural-assertion smoke test catches every "encoded rule" regression in <100 ms with zero new deps. Visual A/B (golden PNG hash) is a v1.1 add. | [[qa]] |
| 2026-05-23 | **Placeholder PNG icons via a tiny pure-Node generator.** `scripts/gen-icons.mjs` writes 192/512/maskable-512/180 icons by drawing an "IC" glyph over a pad-ring + routing-grid motif — no native PNG deps, just zlib + a hand-rolled encoder. | Postpones the "run the generator and crop" approach without blocking install-on-iOS. Recorded as a v1.1 follow-up. | [[devops]] |
| 2026-05-23 | **motherboard-v1 module layout.** `src/board/{types,packages,components,layout,traces,silkscreen,scene,render}.ts` parallels the chip pipeline. `src/views/{chip,board}.ts` extract view-specific bootstrap; `src/ui/router.ts` switches them. `src/app.ts` became a shell that owns nav + seed input + build badge + update toast. `src/gen/*` and `src/render/canvas.ts` were not modified — chip view's smoke test still passes. | Same separation rule as v1: each stage takes a typed input, returns typed output; the smoke test imports `scene.ts` only. | [[arch]] |
| 2026-05-23 | **board smoke test (`scripts/smoke-test-board.mjs`) mirrors the chip smoke test.** Same esbuild-on-the-fly trick, same assertion style. Asserts: ≥1 CPU/NB/SB, ≥2 RAM, ≥4 caps, ≥1 PCIe, ≥1 inductor, four mounting holes, ≥10 traces (~30 actual), CPU↔RAM serpentine (polyline length ≥10 points), CPU↔SB bus, no bounding-box overlaps, determinism (same seed → byte-identical layout + trace signatures), labels don't overlap components. | Structural assertions catch the kind of "I broke the layout invariants without noticing" regression that would otherwise need visual review. <100 ms to run. | [[qa]] |
| 2026-05-23 | **`bust.sh` composition strategy (closed).** The cache-busting skill's installer overwrites `scripts/bust.sh`; we append the existing project's build-id generation + the two file writers (`src/build-id.generated.ts`, `public/build-id.json`) to the new script. Both layers run on every `npm run dev` and `npm run build`. | Simplest possible composition — no wrapper script, no `prebuild` chaining, no fragile sed-injection into the skill's tree. The new `bust.sh` is fully ours now. | [[devops]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-23 | Running the smoke test via `node --experimental-strip-types`. | Node doesn't rewrite `.js` import specifiers to `.ts` during strip-types; bundler-resolution-style imports break. Workaround was esbuild bundling — also avoids ever shipping a `tsx` dev dep just to run one node script. |
| 2026-05-23 | Using `registerType: 'autoUpdate'` per the dispatch's literal text. | Conflicts with the dispatch's *other* instructions ("do NOT call skipWaiting() unconditionally" and "visible refresh-to-update toast") — autoUpdate by definition skips waiting silently. Switched to `'prompt'` mode, which is also what `virtual:pwa-register`'s `onNeedRefresh` callback hooks into. Net behavior matches the dispatch's spirit (consent-gated, user-visible). Decision recorded in [[devops]]. |
| 2026-05-23 | Shipping generated chip-output icons. | Would require either rendering the generator at build time (we don't have a Node Canvas2D), or post-building once and crop-saving the PNGs by hand. Not v1 work; placeholder icons unblock the install flow. |

## Lessons
- "Type the constraint, then encode it in the generator, then assert it in the test." The per-layer-direction rule passes through all three: `Segment.dir` is mandatory, `routing.ts` only emits `'h'` on layer 1 / `'v'` on layer 2, smoke test asserts it on every segment. The rule is *structural*, not stylistic.
- Auto-generated build-id files (`src/build-id.generated.ts`) need to be importable as TS modules. Path is: write the `.ts` file from the bust script, Vite bundles it normally, content-hashing kicks in on the bundle. The badge in the UI then shows the current build id at all times.

## Open Questions
- [ ] Golden-seed PNG hash regression test. Pick 3 seeds, render to canvas-bitmap in a headless browser, hash, snapshot. Fails CI on visual drift. Not v1-blocking. — owner: dev / [[qa]] — since: 2026-05-23
- [ ] Move per-pixel interference tint to a WebGL pass for phone perf. — owner: dev / [[arch]] — since: 2026-05-23

## Assumptions
- [DEV] Node 20+ available locally. — status: validated (v24 on kainode) — since: 2026-05-23
- [DEV] No SSR / no Next.js; pure static SPA. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[arch]] (tech choice), [[pm]] (v1 scope)
Feeds into: [[qa]], [[devops]]

## Session Log
2026-05-23 — MOTHERBOARD-V1 — built `src/board/{types,packages,components,layout,traces,silkscreen,scene,render}.ts`. Extracted view bootstraps to `src/views/{chip,board}.ts`; new `src/ui/router.ts` does pathname-based SPA routing with history.pushState. `src/app.ts` became a thin shell that owns the shared chrome (nav, seed input, build badge, update toast) and delegates to the active view. Added top-of-viewport nav + `body.view-board` CSS class to let the canvas aspect-ratio swap (chip is 1:1, board is 4:3). Wrote `scripts/smoke-test-board.mjs`. Added `npm run smoke` + `npm run smoke:board` scripts. Folded the existing project's build-id stamp into the cache-busting skill's `bust.sh` by appending it to the new script. `npm run build` succeeds (~125 ms); both routes serve correctly under `vite preview` (SPA fallback handles `/board`).
2026-05-23 — V1 — implemented `src/rng.ts` (mulberry32 + xfnv1a hash + fork), `src/gen/{types,floorplan,cells,routing,effects,scene}.ts`, `src/render/canvas.ts`, `src/app.ts` (DOM wiring, pinch-zoom, save-as-PNG, build-badge, update-toast). Smoke test asserts all v1 QA criteria + determinism. `npm run build` succeeds. `npm run preview` serves on :4173.
2026-05-23 — INIT — drafted build tool + module layout.
