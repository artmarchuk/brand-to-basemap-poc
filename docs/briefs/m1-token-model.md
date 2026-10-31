# Brief for Claude Code: M1 Token Model Foundation (F0)

**Project:** Brand-to-Basemap, P0 prototype
**Milestone:** M1, token-to-layer mapping spike
**From:** PM chat (owner: Artem)
**Status:** ready to start. Confirmed decisions are marked **[DECIDED]**. Any remaining **[ASSUMPTION]** is a PM default: build on it, keep it easy to change, and flag it in your report.

---

## 1. Context

Brand-to-Basemap is a web prototype where a designer enters 2-5 brand colours and gets a quality-checked MapLibre basemap in light, dark and data modes, then copies an embed snippet. It is a client-side-only app on the open stack (MapLibre GL JS, OpenMapTiles-schema tiles from OpenFreeMap and MapTiler). The prototype is also a case study for a design leadership application, so code quality, clarity and a clean architecture matter as much as the visuals.

Full requirements: the P0 Product Requirements doc (shared by Artem). This brief covers only F0, the foundation every other feature reads from.

**Why F0 comes first:** the map, modes, accessibility checks and exports must all read from one token set. Until the token-to-layer mapping exists, nothing else can be built.

## 2. Goal of this milestone

Produce, and prove with a running harness, a **semantic token model** that can restyle a real base style from about 12 tokens and nothing else:

1. A written, versioned **token schema**.
2. A **mapping** from each token to style layers, for one OpenFreeMap style and one MapTiler style.
3. An **apply function**: `applyTokens(baseStyle, tokenSet, options) -> styleJSON`.
4. A **report of layers that fit no token**, with the derived value each one gets.
5. A **harness page** (plain MapLibre, no app UI) showing the result, to demonstrate that the exported style renders the same outside the prototype.

You are **not** building the palette derivation engine (brand colours to tokens, M2), the dark or data transforms (M2/M5), or any UI (M4). Hand-written token sets are enough to prove the model here.

## 2a. Setup first (before the M1 work)

Spend your first hour on a scaffold, so later steps don't wait on it:

1. Repo with the stack above, a public deploy (GitHub Pages or Vercel, your call; no secrets in the repo).
2. **UI token pipeline.** The tool's own interface will be styled only through design tokens. Figma Variables will become the source of truth later (a design pass comes after the prototype works). For now: a DTCG-format JSON file with placeholder UI tokens (neutral colour scale, surface/text/border/focus/accent roles, spacing, radius, type scale, shadow), a build step that turns it into CSS custom properties (Style Dictionary or Terrazzo, your pick), and a lint check that fails the build when a component hard-codes a colour, size or font. The later Figma sync should only need to replace the JSON file.
3. A short stack confirmation note (a few lines, no waiting for a reply).

Keep the UI token family separate from the map tokens in section 4: the map tokens are generated from brand colours at runtime, while the UI tokens style the tool itself.

## 3. Scope

### In scope
- Inspect the actual style JSONs and build the mapping from what is really in them.
- Token schema, mapping files, apply function, unmapped-layer report, harness, tests.
- Zoom behaviour carried by tokens (see 4.3).
- Toggle groups as metadata on the mapping (see 4.4), because F2 depends on them.

### Out of scope
- Brand colours to tokens derivation, dark and data mode logic, overrides, auto-fix, contrast checks.
- Any app UI, zoom strip, export UI, provider switch UI.
- Fonts and icons: keep each provider's own glyphs and sprites untouched.
- Terrain, 3D, satellite, custom tilesets.

## 4. Requirements

### 4.1 Token set (fixed, about 12)

| Token | Purpose |
| --- | --- |
| `background` | Map background / canvas |
| `land` | General land and landcover fill |
| `water` | Water fill and waterway lines |
| `park` | Parks, green landuse and landcover |
| `roadMajor` | Motorway, trunk, primary, secondary |
| `roadMinor` | Tertiary, residential, service, paths |
| `building` | Building fill and outline |
| `boundary` | Admin boundary lines |
| `labelPrimary` | Main place labels and major road labels |
| `labelSecondary` | Minor place labels, POI and minor road labels |
| `halo` | Text halo colour |
| `accent` | Highlight colour (e.g. POI icons or emphasis); define its exact role in the mapping and document it |

If inspecting the styles shows a token is missing or one must be split, **propose the change in your report; do not silently add tokens**. The set must stay small.

The token set is the **single source of truth**. Nothing else in the codebase may hold a colour that the map renders.

### 4.2 Mapping

- Each token maps to a set of layers by **layer ID and `source-layer`**, plus the **paint/layout property** to write (e.g. `fill-color`, `line-color`, `text-color`, `text-halo-color`).
- Prefer **rules** (match by `source-layer` + `class`/`subclass` filter + layer type) over long hard-coded ID lists, but fall back to explicit IDs where rules would be fragile. Document which is which.
- One mapping file per supported base style. **[DECIDED, Oct 31, 2026]** P0 base styles: **OpenFreeMap Liberty** and **MapTiler Streets v2** (one per provider). Revisit only if you find a blocking mapping problem, and raise it in your report. Make the mapping format generic so a third style could be added by writing a new mapping file only.
- Fetch the styles from the providers rather than inventing them. OpenFreeMap needs no key. MapTiler needs a key: read it from the `MAPTILER_KEY` environment variable, **never commit it** and never write it into fixtures or snapshots (strip it from any saved style JSON). If the key is missing, ask Artem.
- Save a **pinned copy** of each base style in the repo (key stripped) so builds and tests are reproducible. Record the fetch date and source URL.

### 4.3 Zoom behaviour

- A token's colour change must stay correct at every zoom. Where the base style uses `interpolate`/`step` expressions on colour or on width/size, the apply function must **preserve the expression structure** and replace only the colour stops, mapping each stop to a token or a derived tint of it.
- Define how a derived tint is expressed (e.g. lightness/alpha offset relative to the token) so that stops stay ordered and contrasting.
- Width and label-size ramps stay as the base style defines them in P0, but the schema must leave room for a per-token ramp override later. Document the extension point; do not build it.

### 4.4 Toggle groups (metadata for F2)

Tag every mapped layer with one group so F2 can toggle them without a layer list in the UI:

`core` (always on), `pois`, `transit`, `buildings`, `landuse`, `minorRoads`, `boundaries`, `labels` (with a density level: low / medium / high where the style allows it).

The default state per F2 is: land, water, parks, major roads, place labels on; everything else off. Expose this as `applyTokens(..., { groups: [...] })` and as a default group set. Layers in the `core` group can never be hidden.

### 4.5 Layers that fit no token

- Every layer in the base style must end up in exactly one of: **mapped**, **derived**, or **hidden by design**.
- A layer that fits no token must **never keep its original colour**. It gets a derived value (e.g. a tint or shade of the nearest token), and it is listed in a generated report.
- Output `unmapped-report.md` (or JSON plus a readable summary) per base style with: layer ID, type, source-layer, original colour, assigned derivation and why. Sort by visual importance if you can judge it.
- Add a **test that fails if any colour value from the original style survives** in the output, unless it was explicitly allow-listed (e.g. fully transparent, white or black used structurally). Keep the allow-list short and commented.

### 4.6 Token schema (versioned)

- Define the schema as JSON Schema (or equivalent TypeScript types plus a generated JSON Schema), with a `schemaVersion` field starting at `0.1.0`.
- Colours are stored as hex in the exported JSON. **[DECIDED]** Palette derivation will use OKLCH rules (M2); for now keep colour handling behind a small interface so the colour library can change. Suggested library: `culori`.
- The schema must have room for: mode (light/dark/data) variants of the same token, per-token overrides, and metadata (name, provider/base style used). Do not implement modes now, but do not paint ourselves into a corner. Show in the doc how a mode transform and an override would layer on top of base tokens.
- Also provide an export of the token set as **CSS custom properties** (naming scheme documented, e.g. `--b2b-land`). This is a small function, but it fixes the naming early.

### 4.6a Layering model **[DECIDED as default, Oct 31, 2026]**

`brand input -> base tokens -> per-mode transform (light / dark / data) -> per-mode overrides -> auto-fix adjustments`

Each layer is separately visible and resettable. For M1, only "base tokens" has to exist. Structure the code so the later layers are pure functions that take a token set and return a token set, and so `applyTokens` only ever receives the final resolved set.

## 5. Technical constraints

- **Client-side only.** The apply function must run in the browser with no backend. Node is fine for scripts and tests.
- **Stack [DECIDED, Oct 31, 2026]:** Vite + TypeScript + React, `maplibre-gl`, `culori`, Vitest, plain CSS custom properties, Radix UI primitives (unstyled, accessible). If you see a concrete blocker, say so in your first message; otherwise proceed.
- **Pure and deterministic:** the same inputs always give the same style JSON. No mutation of the pinned base style.
- **Provider-agnostic core.** Provider-specific logic lives only in the mapping files and a thin adapter (tile URLs, glyphs, sprite, attribution, key placement).
- **Attribution** (provider and OpenStreetMap) must be preserved in the output style's `sources`.
- Keep the architecture and file layout clean and documented: a reviewer will read this repo.

Suggested structure (adjust if you have a better one):

```
/src/tokens/        schema, types, defaults, css export
/src/mapping/       mapping format, one file per base style
/src/style/         applyTokens, expression rewriting, report generation
/base-styles/       pinned base style JSONs (keys stripped)
/harness/           plain MapLibre page + sample token sets
/tests/
/docs/token-model.md
```

## 6. Deliverables

1. **Code** for schema, mapping, `applyTokens`, report generator, CSS export.
2. **Two mapping files** (Liberty, Streets v2) and their **unmapped-layer reports**.
3. **Harness page**: plain MapLibre (no app UI), loads each provider's output style, with at least **3 hand-written token sets** (e.g. one neutral, one saturated brand, one dark-looking set) switchable via a simple select. Include a default view in a water-rich dense city and one at each of z4, z8, z12, z16 for quick visual inspection.
4. **Screenshots** of the harness for each style x token set x the four zooms (committed under `/docs/screens/`), so Artem and the design agency can review without running the code.
5. **`/docs/token-model.md`**: the token list with roles, the mapping approach, the zoom-behaviour approach, the layering model, how to add a new base style, known limits.
6. **Report** back to Artem (see section 8).

## 7. Acceptance criteria

- [ ] Both base styles restyle from the 12 tokens alone: changing one token visibly changes only the layers mapped to it, at all zoom levels tested.
- [ ] No original colour from the base style survives in the output (test passes, allow-list documented).
- [ ] Every layer in each base style is accounted for in the report as mapped, derived or hidden by design.
- [ ] Zoom-dependent colour/width expressions still work after restyling (no flat colours where the original ramped, no broken expressions, no console errors or warnings from MapLibre style validation).
- [ ] The output style loads and renders in a **plain MapLibre page** with no prototype code involved.
- [ ] `applyTokens` is pure, with unit tests for mapping rules, expression rewriting and the survivor-colour check.
- [ ] Token JSON validates against the published schema, and the CSS export works.
- [ ] Adding a third base style requires only a new mapping file (demonstrated in docs, not necessarily built).
- [ ] The MapTiler key appears nowhere in the repo, fixtures or screenshots.

## 8. What to report back

When done (or if blocked), send Artem a short report with:

1. **Result:** what works, with links to the harness and screenshots.
2. **Unmapped layers:** the count per style and the 5 to 10 most visually important ones, with your proposed handling.
3. **Token set feedback:** any token you think should be added, split or merged, with the reason.
4. **Surprises:** how the two styles differ in structure (this feeds the risk "base styles differ more than expected between providers").
5. **Stack confirmation or changes** versus the assumptions above.
6. **Open questions** that need a PM or Artem decision, each phrased as a question with your recommendation.

Keep it concise. Do not paste large JSON into the report; link to files.

## 9. Working agreements

- **Ask early.** If a requirement conflicts with what you find in the style JSONs, stop and raise it with a recommendation rather than working around it silently.
- **No scope creep.** Do not start on palette derivation, UI or checks, even if it looks easy. M2 and later are planned separately.
- **Small commits** with clear messages. Do not commit secrets.
- **Pace.** There is no hard deadline, but the target is a working, presentable P0 in 1-2 days. Keep scope lean, avoid round trips, and decide small things yourself (note them in the report). Artem reviews at short checkpoints; the first one is the harness screenshots from this milestone.

## 10. What comes next (for awareness only)

M2 builds the palette engine (brand colours to the 12 tokens in OKLCH, dark and data transforms, override layer) on top of your token model, and the UI work (M4) consumes it. A clean, documented token interface from this milestone is the main thing they depend on.
