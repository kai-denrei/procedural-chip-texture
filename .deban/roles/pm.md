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
| 2026-05-23 | **v1 acceptance criterion (closed):** single rendered die from a seed input; visible floorplan (BSP + pad ring + std-cell sea + ≥1 SRAM macro); ≥1 routing layer with per-layer preferred direction + via stamps; thin-film interference tint; rendered to a canvas inside an installable PWA; build-id badge visible. | Smoke test confirms all five QA criteria pass on every seed: M1 horizontal, M2 vertical, vias at every bend, ≥1 SRAM macro with bitcell texture, ~96 pads forming a perimeter ring, std-cell rows with VDD/VSS rail striping. | [[qa]], [[dev]] |
| 2026-05-23 | **v1 controls (closed):** seed text input + random-seed button + Generate button + save-as-PNG. No layer toggles, no parameter sliders. | Bare minimum for the regenerate-by-seed UX; sliders bloat the surface and tempt premature param-tuning work. v2. | [[ux]] |
| 2026-05-23 | **Out of scope for v1 (explicit cut list):** OPC serifs, line-edge roughness (LER), corner rounding, oxidation, CMP dishing, blur/CA/vignette/grain (global optics), H-tree clock tree, dummy fill, multi-layer power mesh, scratches/defects, side-by-side reference viewer. Routing ships one M1 layer plus opportunistic M2 vertical hops for bends — M3+ is the obvious v1.1 extension since the per-layer-direction API already supports it. | These are explicit polish layers from the spec; their absence does NOT break "reads as a die" per QA's ranked acceptance criteria; their addition is meaningful work and risks blowing the v1 window. Recorded so we don't pretend they're hidden. | [[qa]], [[dev]] |
| 2026-05-23 | **Render-time budget for v1: 3 s on mid-range mobile.** Measured locally: ~5–10 ms generation, ~80–250 ms render at 1024². Headroom is huge — sub-500 ms is reachable in v1 without WebGL. | Closed assumption. | [[arch]] |
| 2026-05-23 | **Internal render resolution: 1024² on desktop, ~720² on narrow phones.** Sliding scale instead of a hard ceiling — keeps small phones snappy and big screens crisp. | Closed assumption; was Open Question. | [[arch]] |
| 2026-05-23 | **motherboard-v1 scope (closed):** new `/board` route in the same SPA; packaged chips only (no visible dies at board zoom); anchored-preset layout with seeded variation; all 10 component categories from the spec ship (CPU/NB/SB/RAM/ROM/PCIe/caps/VRM/IO/silkscreen); CPU↔RAM bus carries a length-matching serpentine; CPU↔SB bus visible; cache-busting skill installed and composed with the existing `bust.sh`. | Acceptance: `scripts/smoke-test-board.mjs` asserts every count + non-overlap + determinism criterion. Chip view's smoke test still passes — chip pipeline untouched. | [[arch]], [[qa]] |
| 2026-05-23 | **Out of scope for motherboard-v1 (explicit cut list):** click-to-decap, backside-of-board, heatsinks/fans/3D shading, animated data flow on traces, schematic-correctness, multi-layer PCB routing, datasheet-accurate pin patterns. | Same discipline as v1: every cut explicitly recorded so they don't get implied as "hidden." | [[arch]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
- Spec's "looks like a die" criteria reduce to a small set of structural rules. Encoding them as the *first* thing the generator does (floorplan → cells → routing) means even the crudest v1 reads correctly — and every polish layer becomes additive, not load-bearing.

## Open Questions
- [ ] v1.1 routing: lift the routing API to N layers (M3 horizontal, M4 vertical, …) — the per-layer-direction API already supports it. Estimated cost: ~30 min. — owner: pm — since: 2026-05-23
- [ ] v1.1 add LER + corner rounding before any optics work — they're the single biggest realism return per line of code. — owner: pm / [[qa]] — since: 2026-05-23
- [ ] v1.1 generated icons (run the generator on a fixed seed, crop a 512² subregion). Currently shipping a placeholder "IC" glyph icon. — owner: pm / [[devops]] — since: 2026-05-23

## Assumptions
- [PM] User wants something shippable and iterable, not a research artifact. — status: validated — since: 2026-05-23
- [PM] The visual quality bar in the spec (line 23: "photographed through a microscope") is aspirational for the project, not the v1 acceptance criterion. — status: validated — since: 2026-05-23
- [PM] No external API / backend in scope; everything client-side. — status: validated — since: 2026-05-23
- [PM] No user accounts, no persistence beyond local-storage seed history. — status: validated — since: 2026-05-23

## Dependencies
Blocked by:
Feeds into: [[arch]] (scope drives tech choice), [[dev]] (scope drives build order), [[ux]] (scope drives surface area)

## Session Log
2026-05-23 — MOTHERBOARD-V1 — motherboard-v1 shipped. `/board` route lives next to `/`; both share the seed system. All 10 component categories render on a green PCB with copper Manhattan traces, gold ENIG on PCIe/DIMM/IO contacts, silver solder pads, silkscreen labels, mounting holes. CPU↔RAM bus has 6 parallel traces with a length-matching serpentine; CPU↔SB bus has 4 parallel traces routed around the NB. Board smoke test asserts every acceptance criterion. Chip smoke test still passes. Cache-busting skill installed; old `bust.sh` build-id logic preserved by appending to the new `bust.sh`. Favicon visibly changes shape and color across builds.
2026-05-23 — V1 — v1 shipped. All 5 QA acceptance criteria pass via smoke test (M1/M2 direction split, vias at bends, ≥1 SRAM macro with bitcells, std-cell rows, pad ring). Build succeeds (~95ms vite build); preview serves; build-id badge live; layered cache-busting wired (Vite hash + bust.sh stamp + visible badge + no-cache meta + /build-id.json receipt). Out-of-scope items recorded above.
2026-05-23 — INIT — drafted v1 scope proposal as Open Questions to be confirmed by user or PM agent in dispatch.
