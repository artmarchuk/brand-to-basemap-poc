# Brand-to-Basemap — P0 Product Requirements

Oct 31, 2026 · Artem · Status: current, with all P0 decisions recorded

## Context and P0 goal

**P0 goal:** a working web prototype in which a designer turns 2–5 brand colours into a shippable, quality-checked basemap — light, dark and data modes — and copies it into their project, in under 5 minutes, without touching a layer list.

P0 must make the four parts of the core hypothesis visible in one session: a designer-friendly GUI, a semantic token model, quality checks, and an open stack.

### Success criteria

| Criterion | Target |
| --- | --- |
| Time from first load to a copied embed snippet, for a first-time user | Under 5 minutes |
| Decisions required before a usable branded map appears | Brand colours only; everything else has a default |
| Exported style renders identically outside the prototype | Same result in a plain MapLibre page |
| Default output passes WCAG AA for labels (4.5:1) after auto-fix | 100% of checked label pairs |
| Works with no account or key | Yes, on OpenFreeMap |
| Scripted demo (brand in, dark mode, data slider, zoom stops, auto-fix, export) | Runs end to end in about 2 minutes |

## Users and core job

**Primary user:** a designer or design-literate developer at a small team or agency who needs a map that matches a brand, on the open MapLibre stack, and has no cartography skills.

**Core job:** "Give me a map that looks like part of my product — in light and dark, behind my data, readable at every zoom — and a snippet I can paste."

P0 serves both segments (agencies/freelancers and small product teams) with the same flow. No segment-specific onboarding in P0.

## Core flow

1. **Enter brand colours** — 2–5 colours, one marked primary. *(the only required decision)*
2. **See the branded map** — minimal-first canvas, live.
3. **Add detail** — toggle groups and label density.
4. **Switch modes** — light, dark, data (recede slider).
5. **Check zooms** — zoom stops (z4 / z8 / z12 / z16) on the main map, with a sweep and a review dot per stop.
6. **Check accessibility** — pass/fail per mode, colour-vision simulation, auto-fix.
7. **Choose provider** — OpenFreeMap (default) or MapTiler with own key.
8. **Export** — style JSON per mode, tokens (JSON, CSS), embed snippet.

Only the first step needs a decision; every later step has a working default, and the user can loop back to any step. Exports are reachable at any point, not only at the end.

## Functional requirements

Six P0 features, each with the outcome it must deliver and its minimum requirements.

### F0. Token model (foundation)

Everything else depends on this, so it is specified first.

- A fixed set of 11 semantic tokens: land, water, park, road major, road minor, building, boundary, label primary, label secondary, halo, accent.
- Each token maps to a set of style layers by layer ID and source-layer, for every supported base style. Layers that fit no token are listed and get a sensible derived value, never their original colour.
- Tokens carry zoom behaviour (for example, road width and label size ramps) so one colour change stays correct at every zoom.
- The token set is the single source of truth: the map, the modes, the checks and the exports all read from it.

### F1. Brand input to token set

**Outcome:** brand colours become a complete, coherent token set in one step.

- Input 2–5 colours via a colour picker or pasted hex values. One is marked primary.
- Second colour rule: the lightest low-chroma brand colour seeds the land tint, within the chroma cap; the second most chromatic seeds road minor, boundary and the building tint.
- The system derives all 11 tokens from the input, with harmonised neutrals for land and labels, derived by OKLCH rules (lightness and chroma targets per token, hue taken from the brand) and tested on a set of 10 palettes.
- The map updates live, within about 300 ms of a change.
- Any single token can be overridden by hand; an override survives later changes to the brand colours until reset.
- Reset to derived values, per token and for all.

### F2. Minimal-first canvas with detail toggles

**Outcome:** the map starts quiet and beautiful; detail is added only on request, already in brand.

- Default state: land, water, parks, major roads, place labels, and minor roads from about z14. Everything else off.
- Toggle groups: POIs, transit, buildings, landuse, minor roads below z14 (low-zoom clutter only), boundaries, and label density (low, medium, high).
- A group switched on appears already styled from the tokens, with no extra decisions.
- No layer list in the main UI.

### F3. Modes from one brand: light, dark, data

**Outcome:** one brand produces three consistent variants without separate styling work.

- Light is the default. Dark is derived automatically from the same tokens, not a separate style.
- Data mode: one "recede for data" slider (0–100) scales fill and line chroma down to about 20%, pulls land and road lightness toward each other, hides POIs above 30 and thins minor labels above 60. Labels are thinned, never faded, so they keep passing the contrast check. In P0 data mode applies to the light palette only; dark with data recede is P1.
- The sample data overlay was dropped from the app (S2 scope reminder). A dev-only generator stays in the harness (`#overlay=1`), outside the app bundle and never exported. Data mode keeps the recede slider, the POI and label rules, and one line of explanation.
- All three modes are exportable.

### F4. Zoom stops

**Outcome:** breakage across zoom levels is visible before shipping.

- Four zoom stops (about z4, z8, z12, z16) sit as chips on the main map. Selecting one flies the single map to that zoom at the current centre.
- A sweep button animates a smooth zoom through the whole range, so abrupt jumps in colour, line width or label visibility between stops become visible.
- Each stop has a review dot. Any style change resets all dots to unreviewed; viewing a stop marks it reviewed. The dots are a reminder, not a gate.
- Each stop also shows the F5 pass/fail status evaluated at its zoom, so a failing stop is flagged before the user visits it.
- The location is the main map's: the user can pan anywhere or pick from 6 curated cities (default Zurich).
- The stops are one click away at all times. P0 renders no second map; side-by-side comparison and per-zoom editing are out of scope.

### F5. Accessibility check and auto-fix

**Outcome:** the user knows the map is readable and can fix it in one click.

- Checks contrast for label primary (7:1) and secondary (4.5:1) against the colours they sit on, with and without halo.
- Checks features against land: road major and boundary 3:1; road minor 1.5:1; water and park by OKLab colour distance, not a ratio (threshold to be set from the per-palette values in `docs/contrast-report.md`; proposed 0.05).
- In data mode the road major / land threshold slides linearly from 3:1 at recede 0 to 1.5:1 at recede 100. Labels stay AA.
- Shows a clear pass or fail summary, per mode and per zoom stop, with the failing token pairs named.
- Colour-vision simulation toggle: protanopia, deuteranopia, tritanopia.
- Auto-fix adjusts token lightness, keeping hue as close to the brand as possible, until checks pass. Shows what changed and allows undo.
- Checks run on every change, not on demand only.

### F6. Export, embed and provider switch

**Outcome:** the user leaves with something they can ship, on the provider they choose.

- Provider switch: OpenFreeMap (default, no key) or MapTiler (user pastes their own key, stored in localStorage, never in the URL). The deployed app ships with no key and there is no demo key.
- Switching provider keeps the token set and re-applies it to that provider's base style.
- Exports: MapLibre style JSON per mode; the token set as JSON and as CSS variables; a copy-paste HTML/JS embed snippet.
- The exported style includes a stable, documented anchor layer ID for "add your data above this, below the labels".
- Required attribution is included automatically for the chosen provider.
- The current state can be saved and reopened (decided: URL-encoded state in the hash plus local autosave; the MapTiler key is never put in the URL).
- A persistent Export button opens the export panel at any time. There is no forced final step; the scripted demo ends in the export panel.

## Non-functional requirements and constraints

- **Client-side only.** No backend required for P0; styling, checks and exports run in the browser.
- **Open stack.** MapLibre GL JS for rendering; OpenMapTiles-schema tiles from OpenFreeMap and MapTiler.
- **Performance.** Live updates feel instant (about 300 ms); the single main map, including the zoom sweep and per-stop checks, stays smooth on a typical laptop.
- **Desktop first.** Designed for laptop and desktop browsers; mobile only needs to not break.
- **No accounts.** No sign-up, no user database. A MapTiler key, if entered, stays in the user's browser.
- **Attribution.** Provider and OpenStreetMap attribution always visible and included in exports.
- **The tool's own UI meets WCAG AA.**
- **Quality bar.** In P0 the interface is functional, calm and minimal, on placeholder UI tokens. The final UX, UI and branding come in Phase 2 (design pass after the prototype works).

## Out of scope for P0

- Use-case presets and use-case funnels (P1)
- Figma import and export of map styles (P1)
- Logo or image to palette (P1/P2)
- WCAG AAA preset (P1/P2)
- Natural-language tweaks (P2)
- Print and high-resolution export (P2)
- Dark mode combined with data recede (P1)
- Per-zoom style editing and side-by-side zoom comparison (backlog)
- Accounts, teams, hosting of styles, billing
- Providers beyond OpenFreeMap and MapTiler; custom tilesets or user data upload
- Place search (needs a key)
- Typography and icon customisation beyond what the base style provides
- Terrain, 3D and satellite

## Dependencies, risks and decisions

### Critical dependency

**Token-to-layer mapping (F0)** for at least one OpenFreeMap style and one MapTiler style. Until it exists, F1–F6 cannot be built. First engineering task: inspect the actual style JSONs and produce the mapping plus a list of layers that don't fit.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Base styles differ more than expected between providers | Provider switch looks inconsistent | One base style per provider for P0; accept small visual differences |
| Derived dark mode looks muddy for some brand palettes | Weak demo moment | Test with a set of 10 palettes; allow token overrides in dark mode |
| Per-stop checks and the zoom sweep slow the map | Editing feels laggy | Debounce checks; cache results per zoom stop; run them off the render path |
| Auto-fix drifts too far from brand colours | Users reject the fix | Adjust lightness only; show before/after; undo |
| Fonts and icons differ per provider | Labels or POIs look broken after switching | Use each provider's own glyphs and sprites; document limits |

### Decisions (Oct 31, 2026)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Base style per provider | OpenFreeMap **Liberty** + MapTiler **Streets v2**. We repaint every layer from tokens, so what matters is layer richness (POIs, transit, buildings for the F2 toggles). Revisit only if M1 finds a blocking mapping problem. |
| Q2 | How the derived palette is generated | **OKLCH** rules (lightness and chroma targets per token, hue from the brand), tested on a 10-palette set. |
| Q3 | Save and share | **URL-encoded state** (brand colours, overrides, toggles, mode, location) in the hash, plus local autosave. The MapTiler key is never put in the URL. The token JSON export already serves as a project file. |
| Q4 | What the data-mode slider changes, and which overlay | 0→100 scales chroma down (to about 20%), compresses land/road lightness toward each other, hides POIs above 30 and minor labels above 60. Receding acts on fills and lines; labels are thinned, never faded. The sample overlay was later dropped from the app; see F3. In P0, data mode applies to the light palette only. |
| Q5 | Default location and how to change it | **Zurich** by default; the user can pan anywhere or pick from 6 curated cities, Kyiv among them. The other four are still to be chosen for variety (proposal: Barcelona, New York, Tokyo, Nairobi). No place search in P0. |
| Q6 | What "done" looks like | No forced final step; a persistent **Export** button; the scripted demo ends in the export panel. |

**Other decisions**

- Timeline: no hard deadline. Target is a working, presentable P0 in 1–2 days, lean scope; Artem's time is the bottleneck.
- Stack: Vite, TypeScript, React, maplibre-gl, culori, Vitest, plain CSS custom properties, Radix UI primitives.
- UI tokens: Figma Variables are the source of truth, exported as DTCG JSON into the repo and built into CSS variables; components use only those variables. Until the design agency delivers, P0 runs on placeholder UI tokens.
- Design agency: delivers app UX, UI and branding after the working prototype exists (Phase 2).
- Token layering (F0): brand input → base tokens → per-mode transform → per-mode overrides → auto-fix adjustments. Adopted as the default.

## Open items for the PM (spec additions, defaults apply unless Artem objects)

- **Auto-fix vs manual overrides.** Default: auto-fix does not change a token the user set by hand; it flags the failing override and asks.
- **Contrast pair matrix.** The feature thresholds are decided (see F5). Still open: the OKLab threshold for water and park, the fixed list of label pairs per mode, and how the halo counts.
- **Measuring the success criteria.** "Under 5 minutes" needs a timed test with 2–3 first-time users; "renders identically" needs a scripted check (export → plain MapLibre page → visual diff).
- **Hosting and public link.** Claude Code's call (GitHub Pages or Vercel); no secrets in the repo.
- **Test palettes.** Use palettes inspired by well-known brands but shown under fictional brand names, to avoid trademark use in a public case study.
- **Export format details.** Versioned token JSON schema, CSS variable naming, and what the embed snippet contains (CDN MapLibre version, inline style vs hosted style URL).
- **Browser support.** Latest Chrome, Safari, Firefox and Edge.

## Plan (2-day target)

Owners: **CC** = Claude Code, **PM** = the PM chat, **A** = Artem, **DA** = design agency project (Phase 2, after the prototype works). Artem is needed at three short checkpoints and one final review; everything between runs without him.

| Step | Scope | Owner | Artem's touchpoint |
| --- | --- | --- | --- |
| S0 Setup | Repo and stack scaffold; public deploy; UI token pipeline (DTCG JSON → CSS variables, lint against hard-coded values) with placeholder tokens; short stack confirmation note | CC | None |
| S1 Token model and palette engine (M1 + M2) | F0 mapping for Liberty and Streets v2, applyTokens, unmapped-layer report; OKLCH derivation, dark and data transforms, overrides; harness page and screenshots on 10 test palettes | CC | Checkpoint A: review screenshots (about 15 min) |
| S2 App shell (F1–F4) | Brand input, live map, overrides and reset, detail toggles, light, dark and data modes, recede slider, zoom stops | CC | Checkpoint B: try the app (about 15 min) |
| S3 Quality and shipping (F5–F6) | Contrast checks per mode and zoom stop, colour-vision simulation, auto-fix with undo, provider switch, exports with a data anchor layer, URL state, attribution | CC | Checkpoint C: try auto-fix and export (about 15 min) |
| S4 Validation and demo | Export-fidelity check in a plain MapLibre page, run on 10 palettes, WCAG AA audit of the tool's own UI, 2-minute demo script, public URL; optional 2–3 timed first-time-user sessions | CC, PM, A | Final review (about 30 min) |
| Phase 2: design pass (after P0) | App UX, UI and branding for the working prototype, in Figma; Figma Variables become the source of UI tokens; sync into the repo via the Figma MCP; restyle | DA, CC, A | Reviews |

## Backlog

- **Side-by-side zoom comparison (live strip).** Show several zoom levels at once, as live maps or as snapshots from one hidden renderer. Needs a performance spike first.
- **Per-zoom style editing.** Tune colours, line widths or label visibility for one zoom range. The zoom stops give a natural place to build on; the token schema should leave room for per-zoom overrides.
