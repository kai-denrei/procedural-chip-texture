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

## Open Questions (cross-role)
- [ ] **v1.1: lift routing to M3+** — 30-min lift since the per-layer-direction API already supports it. — owner: [[pm]] / [[arch]]
- [ ] **v1.1: LER + corner rounding** — biggest realism return per LoC, runs in the deferred "geometric imperfection" pipeline stage. — owner: [[arch]] / [[qa]]
- [ ] **v1.1: regenerate PWA icons from a fixed-seed generator run.** — owner: [[devops]] / [[ux]]
- [ ] **v1.1: WebGL fragment shader for the interference tint** — single biggest phone perf cliff currently. — owner: [[arch]]
- [ ] **Deploy: pick Netlify vs. Vercel and ship.** — owner: [[devops]]
