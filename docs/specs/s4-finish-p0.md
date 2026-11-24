# Spec: S4 batch, finish P0

**Project:** Brand-to-Basemap, P0 prototype
**From:** PM chat (owner: Artem)
**Status:** ready. M4 is live and accepted. This batch finishes P0 before the design agency pass.
**Branch:** one branch, `s4-finish-p0`. One workstream per commit series. Run the full test suite after each workstream.

---

## 1. Goal

Close P0 with five small, independent workstreams. They touch different parts of the code (docs, export, engine, map view, repo front page), so they should not collide. Build them in the order below. If time runs short, drop workstream 4 and then 3, but always finish 5, because it captures the final state.

**Out of scope:** UI or layout polish (the design agency owns it), new presets, dark mode, Streets v2, poster export, logo remap, hosting icons, per-zoom-stop pass/fail (dropped from P0).

## 2. Workstreams

### 2.1 Housekeeping (docs and scripts only)

- `CLAUDE.md`: replace "MapTiler Streets v2" with "MapTiler tiles (v3-openmaptiles) with the Liberty-based style". Record the confirmed colour persistence rule as DECIDED.
- `docs/p0-requirements.md`: mark per-zoom-stop pass/fail as dropped from P0. Keep token export in F6 as P0 (built in 2.2). Add the colour-vision preview to F5 (built in 2.4). Record the MapTiler terms note: fine for the case study with user-supplied keys; a public or commercial product needs MapTiler's agreement.
- Fix `capture-app-m3.mjs`: it clicks the undo notice, which no longer exists. Fix it or retire it.

**Done when:** the docs match what is built, and every capture script runs.

### 2.2 Token export (F6)

Add a third output to the Export panel, next to the snippet and the style JSON, with Copy and Download:
- **Design tokens (DTCG JSON):** the resolved map tokens for the current state (preset, slots, overrides, mode, recede), one entry per token with `$type: "color"` and `$value` as hex, grouped under `map`. Put the preset id, the primary colour, the tile source and the state schema version in `$extensions`.
- **CSS custom properties:** the same tokens as `--b2b-<token>: #xxxxxx;` in a `:root` block.

**Done when:** a test confirms both outputs contain every resolved token and match the colours the map renders; the token export never contains a key. Add a short section to `docs/export.md`.

### 2.3 Data-mode auto-fix (engine)

Run the existing per-preset auto-fix on the data-mode colours after the recede transform, with the same rules: never change a colour the user typed, and show a notice (labelled "In data mode:") when something was adjusted.

**Done when:** the yellow-primary case at recede 80 now passes the road threshold, and a property test over the 10 fixtures x 3 presets x recede 0-100 in steps of 10 finds every check passing or a notice raised.

### 2.4 Colour-vision preview (F5, map view only)

- A control in the map view: none, protanopia, deuteranopia, tritanopia, achromatopsia. It applies a colour-matrix filter to the map canvas (for example an SVG `feColorMatrix` with the Machado et al. 2009 matrices for the three dichromacies, and luminance for achromatopsia).
- Preview only. It changes nothing in the tokens, the state, the link or the exports.
- **Report, not checks:** a table in `docs/colour-vision.md` giving, for each preset and the 10 fixtures, the OKLab distance of the carrier pairs (water vs land, fabric vs water, field vs deep, major roads vs ground) under each simulation. Name the pairs that collapse below the existing separation thresholds. Do not add new auto-fix rules.

**Done when:** the filter works on both tile sources, and the report exists with the collapsing pairs named.

### 2.5 Repo front page and demo capture

- `README.md` for the public repo, which is part of the case study:
  - one paragraph on what it is, and the live link;
  - how to use it in three steps;
  - one screenshot per preset (from the M3 and M4 sheets in git, never the third-party reference frames);
  - the export example with `beforeId: 'b2b-data-anchor'`;
  - a short architecture section (the pipeline from preset and slots to auto-fix, overrides, data transform and style compiler);
  - credits and attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap contributors, MapTiler, MapLibre) and the licence.
- A short demo capture (GIF or MP4, under 30 seconds) recorded with Playwright on the live build: pick a preset, change the primary colour, switch presets, sweep the zoom stops, open Export. Save it in `docs/screens/demo/` and embed it in the README.

**Done when:** the README renders correctly on GitHub and the demo plays.

## 3. Finish

1. Full tests, lint, typecheck and build, then `npm run check-export`.
2. A fresh history scan for keys and MapTiler style files.
3. Merge to `main` and deploy to the same Pages URL.
4. Report to Artem.

## 4. Report format

1. What is built, with links (live app, README, demo, colour-vision report).
2. What was dropped for time, if anything.
3. Decisions you made yourself.
4. Open questions, each with your recommendation.
5. What is left in P0, if anything.
