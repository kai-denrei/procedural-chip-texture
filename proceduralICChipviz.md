The thing that separates "looks like a circuit" from "looks like a die" is almost never the wires themselves — it's that real layouts are the product of hard constraints and a strict hierarchy. Random orthogonal lines read as sci-fi prop. So the generator should encode the constraints first and treat the visuals as emergent.

**Generate top-down, floorplan first.** A die is hierarchical: pad ring around the perimeter, then large hard macros (SRAM, analog, IP blocks), then a "sea" of standard cells filling the rest, with routing channels between blocks. The classic way to produce this procedurally maps directly onto how floorplanning is actually conceptualized — a *slicing tree*: recursively subdivide the die with alternating horizontal/vertical cuts, each leaf becoming a block with an aspect-ratio constraint. BSP gives you believable block sizes and the channels fall out naturally. Reserve the outer ring for bond pads (regular squares with the characteristic flared lead-in) and a seal ring just inside the edge.

**Standard-cell rows are what give a die its horizontal banding.** Logic isn't placed freely — it sits in fixed-height rows. Each row has power rails running horizontally along its top and bottom (VDD/VSS), which is why micrographs show that strong horizontal striping at the cell level. So fill the "sea" regions with rows of fixed pitch, draw the rails, and populate each row with cells of varying width. You don't need real logic — just quantized-width rectangles snapped to a placement grid reads correctly.

**Macros want regularity that contrasts with the cell sea.** SRAM is the giveaway: tile a tiny bitcell motif across a dense periodic grid, far more regular and finer-pitched than anything around it. The eye reads "memory" instantly. Analog/IP blocks read as larger irregular custom shapes. The *contrast* in texture density between blocks is most of the realism.

**Routing is the visually defining layer, and the single most important real-world rule is per-layer preferred direction.** Each metal layer routes predominantly one way: M1 horizontal, M2 vertical, M3 horizontal, alternating up the stack. Wires snap to a track pitch (design-rule minimum spacing) and quantized widths. To turn, you don't bend a wire on its own layer — you drop a *via* and continue on the layer above in the orthogonal direction. That single discipline is what makes routing look real instead of like a maze screensaver. Implementation options, cheapest to most faithful:

- L-shaped / staircase Manhattan paths between net endpoints, switching layer at each bend and stamping a via there. Fast, looks great.
- Greedy channel routing inside the reserved channels between blocks.
- Actual maze/Lee or A* on a grid if you want congestion to look organic — but it's usually overkill for visuals.

Render lower metals thin and busy, upper metals progressively thicker and sparser. Vias are bright little squares at every layer transition; for power, draw *via arrays* (a small grid of them) since real designs stack many vias for current.

**Overlay a power mesh on the top layers** — a coarse orthogonal grid of wide straps, much thicker than signal routing, sitting visually above everything. And if you want a flourish that's both real and beautiful: the **clock tree is an H-tree**, a recursive balanced fractal that distributes the clock with matched path lengths. Generating one (recursive H subdivision, buffers at branch points) gives you a striking organized structure amid the chaos.

**Fill the empty space, because real dies have no empty space.** CMP planarity rules require *dummy metal fill* in open areas — faint regular dotted or hatched texture everywhere there isn't real routing. This is what kills the "too clean" look more than anything; bare substrate between sparse wires is the tell of a fake.

---

Now the patina, which is where it stops looking like a vector diagram and starts looking *photographed through a microscope*:

**Line-edge roughness (LER).** Real wire edges aren't straight — lithography leaves nanometer-scale wiggle. Perturb every edge with low-amplitude 1D noise along its length. Subtle, but it's the difference between CAD output and silicon.

**Corner rounding and OPC artifacts.** Diffraction can't print sharp 90° corners, so they round off. Round all corners. Then add the *optical proximity correction* features designers add to fight that: hammerhead serifs at line ends, dogbone pads at vias, small assist features near edges. These little serifs are a deep cut that anyone who's seen real layout will recognize.

**Thin-film interference — the oil-slick sheen.** This is the most distinctive decapped-chip cue. The rainbow iridescence comes from optical path differences in the transparent dielectric/passivation stack. Fake it by driving a low-frequency noise field as "local film thickness" and mapping thickness → color through an interference ramp (a sinusoidal RGB approximation, phase-shifted per channel, gets you the soap-bubble cycle cheaply; a proper thin-film LUT if you want it physical). Modulate it by which metal layer is exposed. Get this right and it stops looking generated.

**Oxidation and corrosion.** Exposed aluminum (especially bond pads) goes dull and brownish; add patchy desaturation/discoloration via another noise mask, concentrated at pads and die edges.

**CMP dishing.** Wide copper features dish slightly during polish — subtle brightness gradient across large straps and pads, dimmer in the center.

**Optics last.** Everything is shot diffraction-limited: a touch of blur over the whole thing, mild chromatic aberration toward the edges, vignetting / non-uniform illumination (one corner brighter), and fine sensor grain. A few scratches, dust specks, and the odd particle defect or metal void sell "physical object." Worley/cellular noise works well for grain and particulate; Perlin/simplex for the smooth fields (illumination, oxidation, film thickness).

Order of operations matters: build clean geometry on a real grid → apply geometric imperfection (LER, rounding, OPC) → composite layers with interference tint → apply surface aging (oxidation, dishing) → apply optical/sensor effects globally on top.

