---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

## Scope

The whole site: a single-page showcase at `index.html` (Vite build). Visitor mode: Experience.

## Audience and job

Friends and peers opening a shared link, mostly on phones. Job: play with it, see what Armaan has built, share it.

## Action and proof

Primary action: open the chest. Closing action: share the link once the binder is full (Web Share API, copy-link fallback). Proof: the eight real projects in PRODUCT.md, with only the numbers listed there.

## Constraints

- No pink or magenta anywhere.
- Cards carry a generic rarity (Common, Uncommon, Rare, Epic, Legendary) with its color on the frame, beam and chip; the user chose rarities over platform labels on 2026-09-29. No invented stats.
- Every project must be reachable without pulling (binder shows all cards; pulling is the fun path, not a gate for reading).
- WebGL is progressive: no WebGL or reduced motion still gives a complete, readable binder.
- No screenshots exist yet; card art is authored per project and must not pose as a screenshot.

## Memorable moment

The chest shakes, the lid bursts open, a beam in the project's platform color shoots up, and a foil card spins out to the camera where you can tilt it with your finger.

## Unresolved

- GitHub username (`Armaan-dev-ops`) unconfirmed.
- Whether to add real screenshots to cards later.

## Direction contract

THESIS: Every project is a drop pulled from a chest and kept in a binder you can finish and share. Refuses the dev-portfolio default of a floating hero object over a project grid.

OWN-WORLD: Night-blue void (#0E1016) under one warm key light; a chunky low-poly chest in dark steel with gold trim (#F7B32B, the only UI accent). Rarities color beams, card frames and foil: Common silver, Uncommon green, Rare blue, Epic violet, Legendary yellow. Lilita One display, Rubik body. Cards are thick foil slabs with holo sheen that follows tilt.

STORY: The visitor opens the chest, a project flies out as a card, reads what it is, pulls again until the binder reads 8/8, then shares the link.

FIRST VIEWPORT: Full-screen WebGL stage. Chest centered in the lower half with light leaking from its seams; ARMAAN K. small top-left; binder counter 0/8 top-right; the gold "Open the chest" button directly under the chest.

FORM: Loot Chest, my top-ranked grounded candidate (1 of 7), taken as the pick card over the assigned direction. Seed key 22b9efa6.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
