# Brief for Claude Code: M4 Export, shareable state, MapTiler source (S3)

**Project:** Brand-to-Basemap, P0 prototype
**Milestone:** M4 (S3 in the plan): make the prototype shippable. Export, shareable state, inline notices, MapTiler tile source.
**From:** PM chat (owner: Artem)
**Status:** ready to start. M3 (presets) is live at https://artmarchuk.github.io/brand-to-basemap-poc/. Items marked **[DECIDED]** are confirmed by Artem. Items marked **[PM DEFAULT]** are proposals: build on them, keep them easy to change, and flag them in your report. Item 1 (colour persistence) is **[PM DEFAULT, pending Artem's confirmation]**.

---

## 1. Goal

A designer picks a preset, sets 1-3 colours, and leaves with something they can use: a style they can paste into their project, and a link that restores exactly what they made. This milestone also adds MapTiler as a second tile source, because the project is a case study for MapTiler.

You are **not** building: dark mode, Streets v2, new presets, logo remap, poster export, UI polish (the design agency pass comes after P0), a sample data overlay, or place search.

## 2. Scope

### 2.1 Colour persistence across presets [PM DEFAULT, pending confirmation]

Today some colours reset when the user switches presets. Replace that with one rule:
- The **primary colour is global.** Changing it in any preset updates the primary of all presets, and every derived ("auto") slot recomputes from it.
- **Each preset remembers its own typed values.** Typed non-primary slots and per-token overrides are stored per preset. Switching away and back restores them; nothing is lost.
- **"Reset this preset"** clears that preset's typed values and overrides back to derived. It never changes the primary colour and never touches other presets.
- **"Reset all"** clears typed values and overrides in every preset. It also keeps the primary colour.
- Derived slots always follow the current primary and are never stored. A typed value does not follow a later primary change; the state must make typed and derived values distinguishable so the UI can show which will follow.

`BrandState` gets a version bump: `primary`, `presetId`, `perPreset: { [id]: { slots, overrides } }`, `recede`, detail toggles, view. Keep it JSON-safe. Remove the one-step undo only if the new rule makes it redundant, and say so in the report.

### 2.2 Shareable state: URL hash and local autosave [DECIDED]

- Serialise the full `BrandState` plus the map view (centre, zoom) into the URL hash. Opening the link in a fresh browser restores the same map.
- Autosave the same state to localStorage and restore it on load. A hash in the URL wins over autosave.
- **The MapTiler key is never in the URL or in an exported file by default.** It lives in localStorage only.
- Old or malformed hashes degrade gracefully (a short notice, defaults loaded), never a crash.

### 2.3 Export (F6) [DECIDED]

A persistent Export control produces:
1. **Style JSON:** a self-contained MapLibre style for the current state (preset, slots, overrides, recede, toggles), with attribution included.
2. **Embed snippet:** a minimal HTML page or snippet with `maplibre-gl` from a CDN that renders the map, with visible attribution. Provide a copy button for each output.
3. **Data anchor layer:** the style contains a stable, documented layer ID (suggested `b2b-data-anchor`) positioned above land, water and roads and below labels. A comment in the snippet shows one line: add your layer with `beforeId: 'b2b-data-anchor'`. Add a test that proves a GeoJSON layer added this way renders under the labels.
4. **Key handling:** with the OpenFreeMap source, no key is involved. With the MapTiler source, the export contains a `YOUR_MAPTILER_KEY` placeholder and a short note. Offer an explicit opt-in "include my key" with a warning not to share the file publicly.
5. Exports reflect the current Data mode setting (recede). No overlay is ever exported.

### 2.4 MapTiler tile source [DECIDED]

- A source switch: OpenFreeMap (default, no key) or MapTiler (the user pastes their own key).
- Both use the OpenMapTiles schema, so the compiled Liberty-based style should work with MapTiler tiles by swapping the tile, glyph and sprite sources. Verify rather than assume: render Zurich at z4, z8, z12 and z16 for each preset on both sources and list every difference (missing layers, schema or version differences, fonts, POIs, labels).
- Check that the fonts the style uses exist on the MapTiler glyph service and fix any gap.
- **Attribution and logo:** MapTiler's free plan requires its logo and attribution on the map. When the MapTiler source is on, show them in the app and include them in exports. Check the current terms and note anything else in the report.
- The deployed site still ships no key. Keep the build check that fails if a key or a MapTiler style reaches `dist/`.
- Do not add Streets v2.

### 2.4b Notices [DECIDED]

- Show auto-fix notices inline next to the slot that caused them, including "used: #xxxxxx" where a key colour was adjusted. These exist in part; make them complete and consistent for all presets and Data mode.
- Per-zoom-stop pass or fail (F4/F5) is **optional**: do it only if it is cheap with the existing checks, and say what you skipped.

## 3. Deliverables

1. Code and tests: state schema and persistence rule (including a property test that switching presets back and forth loses nothing), URL hash and autosave round trip, export generators, anchor layer test, source switch, notices.
2. **Exported-snippet check:** a script or test that opens the exported HTML in a headless browser and confirms the map renders with attribution visible, for both sources (MapTiler with a test key from the environment, never committed).
3. **Source comparison sheet:** `docs/screens/m4/` with OpenFreeMap vs MapTiler for each preset, Zurich, at the four zoom stops, and a short list of differences.
4. `docs/export.md`: what the outputs contain, how the anchor layer works, key handling and known limits.
5. Updated `docs/p0-requirements.md` and `CLAUDE.md`. A fresh history scan before any merge.
6. Deploy to Pages (same URL) after the scan.
7. **Report** to Artem.

## 4. Acceptance criteria

- [ ] Switching presets back and forth never loses typed values; changing the primary updates every preset's derived slots; "Reset this preset" works.
- [ ] A shared link restores the same map in a fresh browser; autosave restores after a reload; no key ever appears in the URL.
- [ ] The exported snippet, pasted into a blank page, renders the map with attribution, for both sources.
- [ ] A layer added with `beforeId` on the anchor draws above fills and roads and below labels.
- [ ] The MapTiler source works with a user key, shows the logo and attribution, and the differences from OpenFreeMap are listed.
- [ ] The deployed bundle contains no key and no MapTiler style; the build check still passes.
- [ ] Auto-fix notices appear next to the slot in all presets and Data mode.

## 5. What to report back

1. What works, with the live link and the sheets.
2. Differences between the two tile sources and anything you could not make equal.
3. Decisions you made yourself.
4. Open questions for Artem or the PM, each with your recommendation.
5. What is left before Checkpoint C.

## 6. Checkpoint C (Artem, about 15 minutes)

Artem will: make a map, copy the snippet into a blank page and see it render; open a share link in a different browser; switch to MapTiler with his own key; switch between presets and confirm nothing he typed was lost.

## 7. Working agreements

- **The app UI is a proof of concept.** No layout or visual polish.
- **Judge by looking.** Review your own sheets before showing them.
- **Ask early** if a decision here conflicts with what you find, especially around MapTiler terms and the colour persistence rule.
- Small commits, no secrets, keep `docs/` current.
- **Pace.** Target a reviewable result in one working session.
