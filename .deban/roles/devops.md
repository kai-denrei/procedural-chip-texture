---
role: devops
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-23
---

# DevOps — PWA Shell, Cache-Busting, Deploy

## Scope
Owns the PWA manifest, service worker registration / update strategy, cache invalidation policy, asset fingerprinting, deploy target, and the "did the new build actually ship to my phone" feedback loop.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-23 | `vite-plugin-pwa` with `registerType: 'autoUpdate'` and a visible "refresh to update" toast on new SW. | Default SW behavior strands users on stale builds for an entire session — fatal for a project we want to iterate fast on. AutoUpdate + a visible toast is the standard fix. | [[dev]] |
| 2026-05-23 | Cache-busting layered: (1) Vite's built-in content-hash fingerprinting on all bundled assets; (2) anti-cache `<meta>` tags on the HTML shell; (3) explicit `Cache-Control` headers on deploy (no-cache for `index.html`, immutable for hashed assets); (4) a visible build-id badge in the UI corner so a human can verify at a glance which build is live. | The cache-busting skill's central insight: defense in depth. Any single layer can fail silently; the visible badge is the human-readable trip wire. | [[ux]] |
| 2026-05-23 | Deploy target: static host (Netlify or Vercel). | Both have free tiers, both serve fingerprinted assets with sensible defaults, both make custom `Cache-Control` headers trivial. Netlify slightly preferred for `_headers` file simplicity. | [[pm]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Build-id source: git short SHA, ISO timestamp, or both? Proposed: both — `<shortsha>-<iso>` — SHA for traceability, timestamp for human readability. — owner: devops — since: 2026-05-23
- [ ] PWA icon set: generated programmatically (run the chip generator on a fixed seed and crop) or hand-designed placeholder? Proposed: generated — it's on-brand and is a 30-minute task vs. a half-day. — owner: devops / [[ux]] — since: 2026-05-23

## Assumptions
- [DEVOPS] We are willing to require HTTPS — PWAs do not work over HTTP except on localhost. — status: validated — since: 2026-05-23
- [DEVOPS] No backend, no auth, no rate-limiting — pure static. — status: validated — since: 2026-05-23

## Dependencies
Blocked by: [[dev]] (build tool choice)
Feeds into: [[pm]] (ship readiness), [[ux]] (install + update flow)

## Session Log
2026-05-23 — INIT — drafted layered cache-busting plan and deploy target.
