---
project: procedural-chip-texture
created: 2026-05-23
status: active
mode: solo
stale_threshold_days: 30
---

# procedural-chip-texture — Index

## Brief
A solo exploratory web tool that procedurally generates IC die imagery — floorplan-first (BSP slicing, pad ring, macros vs. standard-cell sea), layered routing with per-layer preferred direction (M1 horizontal, M2 vertical, …) via Manhattan staircases and via stamps, OPC artifacts and line-edge roughness, thin-film interference tint, oxidation/dishing, and optical/sensor effects last. Mobile-first PWA, deterministic from a seed, client-side render. **v1 shipped 2026-05-23.**

## Active Roles
- [[pm]] — owner: Gerald (Jelaludo) — v1 scope closed; v1.1 backlog active
- [[arch]] — owner: Gerald — Canvas2D + main-thread + unit-grid model in production
- [[dev]] — owner: Gerald — Vite + TS + vite-plugin-pwa shipped
- [[ux]] — owner: Gerald — single-screen bottom-dock UI shipped
- [[qa]] — owner: Gerald — all 5 acceptance criteria green via smoke test
- [[devops]] — owner: Gerald — PWA + layered cache-busting shipped; deploy target TBD

## Key Decisions
- **2026-05-23** (closed) — v1 stack: Vite + TS + vite-plugin-pwa, Canvas2D, mulberry32 PRNG, simplex-noise — see [[arch]], [[dev]]
- **2026-05-23** (closed) — Per-layer routing direction encoded in the `Segment.dir` type and asserted in the smoke test — see [[arch]], [[qa]]
- **2026-05-23** (closed) — v1 controls: seed input + random + Generate + save-as-PNG. URL `?seed=X` mirror. — see [[pm]], [[ux]]
- **2026-05-23** (closed) — Out of scope for v1 explicitly: LER, OPC, oxidation, dishing, global optics, H-tree clock, dummy fill, multi-layer power mesh. — see [[pm]]
- **2026-05-23** (closed) — `registerType: 'prompt'` instead of `'autoUpdate'`: keeps the consent-gated refresh toast. — see [[devops]]
- **2026-05-23** (closed) — Cache-busting: Vite content hashes + bust.sh build-id stamp + visible badge + /build-id.json receipt + meta no-cache. — see [[devops]]

## motherboard-v1 (closed)
- **2026-05-23** (closed) — Packaged chips, not visible dies, at the motherboard zoom level. Hybrid click-to-decap is v2+. — see [[arch]]
- **2026-05-23** (closed) — Anchored-preset layout (CPU upper-centre, RAM right, NB between, SB lower-right, PCIe lower-left, VRM ringing CPU, I/O top edge, mount holes at corners). Variation lives in dimensions/positions/labels, not zones. — see [[arch]]
- **2026-05-23** (closed) — `/board` route — pathname-based SPA router, no library. Shared seed system via `?seed=` URL param. Same seed → same board with same chips. — see [[arch]], [[ux]]
- **2026-05-23** (closed) — Cache-busting skill installed atop existing `bust.sh`. Composed cleanly: token + favicon cell + meta cb tag from skill; build-id stamp + json receipt preserved by appending the old generation logic to the new `bust.sh`. — see [[devops]]
- **2026-05-23** (closed) — Board pipeline: `src/board/{types,packages,components,layout,traces,silkscreen,scene,render}.ts` mirrors the chip pipeline's contract. `src/views/{chip,board}.ts` plus `src/ui/router.ts`; old `src/app.ts` became a shell. — see [[dev]]
- **2026-05-23** (closed) — Board acceptance criteria green: ≥1 CPU/NB/SB, ≥2 RAM, ≥4 caps, ≥1 PCIe, ≥1 inductor, ≥10 traces, no overlaps, byte-stable per seed, CPU↔RAM serpentine + CPU↔SB bus present. — see [[qa]]

## Open Questions (cross-role)
- [ ] **v1.1: lift routing to M3+** — 30-min lift since the per-layer-direction API already supports it. — owner: [[pm]] / [[arch]]
- [ ] **v1.1: LER + corner rounding** — biggest realism return per LoC, runs in the deferred "geometric imperfection" pipeline stage. — owner: [[arch]] / [[qa]]
- [ ] **v1.1: regenerate PWA icons from a fixed-seed generator run.** — owner: [[devops]] / [[ux]]
- [ ] **v1.1: WebGL fragment shader for the interference tint** — single biggest phone perf cliff currently. — owner: [[arch]]
- [ ] **Deploy: pick Netlify vs. Vercel and ship.** — owner: [[devops]]
