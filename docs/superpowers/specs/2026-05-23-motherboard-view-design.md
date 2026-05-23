# Motherboard View — Design Spec

**Date:** 2026-05-23
**Status:** approved, dispatched
**Predecessor:** v1 chip generator (shipped 2026-05-23 — see `.deban/_index.md`)

## Goal

Extend the procedural IC chip viz from a single die to a motherboard composing many packaged chips, discrete components, and PCB traces — accessible as a separate view, sharing the seed system, PWA shell, and cache-busting plumbing already in place.

## Visual reference

Aesthetic: top-down photograph of a packaged motherboard (think canonical 2000s–2010s desktop board), not a schematic. Green solder mask, copper traces, opaque component packages with silkscreen labels. The chips are blocks with pin patterns underneath, not visible dies.

## Approach (decided)

- **Chip rendering:** packaged components — BGA solder-ball grids, QFP leaded edges, SOIC bodies, DIMM sockets with gold edge fingers. No visible dies at this zoom level. (Hybrid click-to-decap is explicitly out of scope for this iteration.)
- **Layout algorithm:** anchored-preset with seeded variation. Real motherboards have conventional anchor zones (CPU upper-center, RAM right of CPU, VRM around CPU, southbridge lower-right, PCIe lower-left, I/O panel top edge). Variation lives in exact positions, sizes, label text, and component counts — not in which-zone-holds-what. Pure BSP was rejected: it would put PCIe slots mid-board.
- **Route topology:** single SPA, two views — `/` (chip view, unchanged) and `/board` (motherboard). Tiny pathname-based router, no library. Same seed input on both views; same seed → same motherboard with the same chips inside.
- **Visual versioning:** install the cache-busting skill's full toolkit (shape favicon + corner widget) on top of the existing `bust.sh` build-id stamp. They compose — `bust.sh` writes the build-id receipt and stamps the badge, the cache-busting installer adds the favicon + corner shapes that change visibly per build.

## File layout

```
src/
├── board/                      NEW
│   ├── types.ts                Component, Trace, Package, PCB, Scene
│   ├── packages.ts             BGA, QFP, SOIC, DIMM-slot, PCIe-slot, header geometry
│   ├── components.ts           electrolytic caps, ceramic SMDs, inductors, MOSFETs, resistor packs
│   ├── layout.ts               anchored-zone preset → typed Components w/ seeded variation
│   ├── traces.ts               PCB Manhattan routing, diff pairs, length-match serpentines, vias
│   ├── silkscreen.ts           auto-labels (U1, C44, J3, …) with collision-avoidance
│   ├── scene.ts                orchestrator (mirror of src/gen/scene.ts)
│   └── render.ts               PCB green base + copper traces + component bodies + pads + silkscreen
├── ui/
│   └── router.ts               NEW — pathname switch, navigates between chip & board
├── app.ts                      becomes the shell — mounts chip OR board view based on router
└── (rest of src/ unchanged)
```

## Component vocabulary (must-render for motherboard-v1)

1. **CPU** — large BGA package, opaque top with "CPU" / cores-style label, optional integrated-heat-spreader outline. ~15–20% of board area.
2. **Northbridge / memory controller** — medium BGA, "NB" / "MCH" label. Half CPU size.
3. **Southbridge** — medium QFP with visible leaded edges, "SB" / "ICH" label.
4. **RAM** — 2–4 DIMM or SODIMM slots, long rectangular sockets with gold edge fingers visible inside the slot opening.
5. **ROM/BIOS** — 1× small SOIC-8 or PLCC-32.
6. **Capacitor cluster** — mix of electrolytic cylinders (round footprint with top-stamped cross) and ceramic SMD blocks (small rectangles) around the VRM zone.
7. **PCIe** — 1–2 horizontal edge slots at the bottom of the board.
8. **VRM** — row of inductor toroids (round + central post) and MOSFETs (small rectangles) near the CPU power-in side.
9. **I/O panel** — rectangular cut-outs along the top edge (USB, audio, etc. — abstract shapes, not legible jack drawings).
10. **Silkscreen** — white auto-numbered component refs (U1, C44, J3) on the solder mask near each component.

## PCB aesthetics

- Green solder-mask base with low-frequency noise modulation (board texture).
- Copper traces in orange/gold, Manhattan routing with right-angle bends. Differential pairs and bus traces visible as parallel multi-trace bundles. At least one length-matching serpentine on the CPU↔RAM bus.
- Via holes as small dark circles at bends.
- Solder pads tinned silver under each package's pin grid.
- ENIG gold finish on exposed contact areas (PCIe edge fingers, I/O panel tongues).
- Mounting holes at the four PCB corners.

## Routing rules (PCB)

- All traces orthogonal, snapped to a PCB unit grid (coarser than the chip-level track pitch).
- Differential pairs travel as parallel pairs with constant gap.
- The CPU↔RAM bus has at least one segment with a length-matching serpentine (3–5 zigzags).
- The CPU↔SB bus is shorter and routes through the layout's natural channels (between zones).
- Traces never cross under components — they route through the gaps.

## UX

- Top of viewport: small nav with two buttons — "Chip" and "Board" — highlight the active one.
- Seed input shared across both views (kept in URL: `/?seed=foo` and `/board?seed=foo`).
- Generate / random-seed / save-as-PNG controls work on both views.
- Pinch-zoom + pan on the canvas (board view especially benefits from zooming into traces).
- Build-id badge in the corner stays as-is.
- Cache-busting skill's corner widget (3 shape tiles + 8-char token) lives alongside the build-id badge, lower-right.

## Cache-busting / visual versioning

- Run the skill's installer: `bash /Users/minikai/.claude-kainode/skills/cache-busting/scripts/install.sh --target /Users/minikai/Dev/procedural-chip-texture --webp`
- The installer will add `scripts/fingerprint-urls.py`, `public/cb-shapes/`, `public/cb-badge.js`, the `<meta name="cb">` tag in `index.html`, and the `<link rel="icon">` pointing at one of the shape cells.
- Wire `bust.sh` + the skill's `bust.sh` together: the skill's `bust.sh` will replace the project's existing one. Preserve the build-id generation logic (the `src/build-id.generated.ts` + `public/build-id.json` writers) by appending those steps to the new `bust.sh` so they run after the token bump.
- Re-running `npm run dev` / `npm run build` must:
  1. Generate a new build-id token.
  2. Update `src/build-id.generated.ts` and `public/build-id.json`.
  3. Re-fingerprint all `?v=...` asset URLs in `index.html`.
  4. Update `<meta name="cb">` and the favicon `<link>` to point at the new shape cell.
  5. Update the corner-widget tiles to match.

## Acceptance criteria for motherboard-v1

1. `/board` route exists, navigable from `/`; both share seed via URL.
2. All 10 component categories render on a green PCB.
3. CPU↔RAM bus visible as a multi-trace bundle with at least one length-matching serpentine.
4. CPU↔SB trace bundle visible.
5. Silkscreen labels render and don't collide with traces or components.
6. The cache-busting skill's installer has run, the favicon visibly changes shape/color on each `npm run build`, and the corner widget shows 3 shape tiles + the token.
7. The chip view at `/` is unchanged — its existing smoke test still passes.
8. New smoke test (`scripts/smoke-test-board.mjs`) asserts:
   - ≥1 CPU, ≥1 NB, ≥1 SB
   - ≥2 RAM slots
   - ≥4 capacitors
   - ≥1 PCIe slot
   - ≥1 inductor in the VRM zone
   - ≥10 PCB traces
   - No component bounding-box overlaps
   - Byte-stable scene per seed
9. `npm run build` + `npm run preview` green.
10. Mobile-first: layout works at 375 px viewport width — canvas fills, controls thumb-reachable.

## Explicitly out of scope (v2+)

- Click-to-decap / micrograph reveal of individual chips
- Backside of the board
- Heatsinks, fans, 3D shading on packages
- Animated data flow on traces
- Schematic/netlist consistency (it must look right, not be electrically correct)
- More than 1 routing layer on the PCB
- Per-component datasheet-accurate pin patterns

## `.deban/` updates the PM agent must make

- New role file `roles/board.md` (or extend `arch.md`) recording the motherboard-specific decisions.
- `pm.md` gets a new section "motherboard-v1 scope" with the same explicit-cut discipline.
- Resolve the Open Question "Deploy: pick Netlify vs. Vercel" — out of scope for this dispatch, leave as Open Question.
- The remaining v1.1 chip Open Questions (M3+ routing, LER, WebGL tint, icon regen) stay open — they are not in scope for the motherboard work.

## Reporting back

When the motherboard-v1 ships:
- All 10 acceptance criteria verified
- Two smoke tests green (`scripts/smoke-test.mjs` and `scripts/smoke-test-board.mjs`)
- `npm run build` green
- `.deban/` synced (touched role files have new Decisions, Open Questions resolved or moved, session-log appended)
- Git commit titled `motherboard-v1: PCB layout + traces + cache-busting visual versioning`
- Concise report (<400 words) covering: what got built, criteria status, scope cuts, dead ends, commands to see it.
